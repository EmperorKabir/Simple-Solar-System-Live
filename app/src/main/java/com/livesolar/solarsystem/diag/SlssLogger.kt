// SLSS_DIAG_TEMPORARY — core diagnostic logger.
// Part of the temporary diagnostic logging system (see
// the diagnostic-logging design).
// Gated at compile time by BuildConfig.SLSS_DIAG_ENABLED (release = false) and
// at runtime by the [enabled] flag. Zero-cost in release builds: init() is a
// no-op and logEvent() returns immediately. Removable as a whole diag/ package
// (search SLSS_DIAG_TEMPORARY).
package com.livesolar.solarsystem.diag

import android.content.Context
import android.os.Build
import android.os.Process
import android.os.SystemClock
import android.util.Log
import com.livesolar.solarsystem.BuildConfig
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.LinkedBlockingDeque
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong

/**
 * Thread-safe singleton diagnostic logger.
 *
 * Design:
 * - One [logEvent] entry point; an auto-built envelope is merged with the
 *   caller's payload.
 * - Producers append to a bounded [LinkedBlockingDeque]; a single dedicated
 *   background thread drains it to the sinks. Keeps producer cost ~µs and all
 *   file I/O off the caller threads.
 * - Backpressure: if the queue is full, the oldest event is dropped and a
 *   running counter is flushed as a `dropped_events` line.
 * - Per-boot [sessionId] shared across processes via a sentinel file so the
 *   per-process logs reconcile.
 */
object SlssLogger {

    private const val TAG = "SlssDiag"

    @Volatile
    var enabled: Boolean = false
        private set

    /** Flips per-frame TRACE capture (frame_trace/gpu_info). Off by default. */
    @Volatile
    var enableTrace: Boolean = false

    private val seq = AtomicLong(0)
    private val dropped = AtomicInteger(0)

    private lateinit var sessionId: String
    private lateinit var processShort: String
    private var pid: Int = 0

    private val sinks = CopyOnWriteArrayList<SlssSink>()
    private var memoryBuffer: MemoryBufferSink? = null

    private val queue = LinkedBlockingDeque<JSONObject>(10_000)

    @Volatile
    private var running = false
    private var writerThread: Thread? = null

    // SimpleDateFormat is not thread-safe; one instance per thread.
    private val isoFmt = object : ThreadLocal<SimpleDateFormat>() {
        override fun initialValue(): SimpleDateFormat =
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US)
    }

    /**
     * Bootstrap the logger. Safe to call from any process's
     * Application.onCreate. No-op in release builds or if already initialised.
     */
    fun init(context: Context) {
        if (!BuildConfig.SLSS_DIAG_ENABLED) return
        synchronized(this) {
            if (enabled) return
            try {
                val base = File(context.filesDir, "slss_logs")
                base.mkdirs()
                sessionId = resolveSessionId(base)
                processShort = resolveProcessShort(context)
                pid = Process.myPid()

                val fileSink = JsonlFileSink(base, sessionId, processShort)
                val logcatSink = LogcatMirrorSink(TAG)
                val memSink = MemoryBufferSink()
                memoryBuffer = memSink
                sinks.addAll(listOf(fileSink, logcatSink, memSink))

                running = true
                writerThread = Thread(::drainLoop, "SlssLogger-writer").apply {
                    isDaemon = true
                    start()
                }
                enabled = true
                Log.i(TAG, "SlssLogger init: session=$sessionId process=$processShort pid=$pid commit=${BuildConfig.BUILD_COMMIT}")
            } catch (e: Exception) {
                Log.e(TAG, "SlssLogger init failed: ${e.message}", e)
                enabled = false
            }
        }
    }

    /**
     * Primary API. Builds the common envelope, merges [data], and enqueues for
     * the background writer. Returns immediately.
     */
    fun logEvent(
        eventType: String,
        data: Map<String, Any?> = emptyMap(),
        correlationId: String? = null,
        parentCorrelationId: String? = null,
    ) {
        if (!enabled) return
        try {
            val now = System.currentTimeMillis()
            val o = JSONObject()
            o.put("ts_ms", now)
            o.put("ts_mono_ns", SystemClock.elapsedRealtimeNanos())
            o.put("ts_iso", isoFmt.get()!!.format(now))
            o.put("event_type", eventType)
            o.put("process", processShort)
            o.put("pid", pid)
            o.put("tid", Process.myTid())
            o.put("thread_name", Thread.currentThread().name)
            o.put("session_id", sessionId)
            o.put("seq", seq.getAndIncrement())
            o.put("build_commit", BuildConfig.BUILD_COMMIT)
            o.put("build_variant", BuildConfig.BUILD_TYPE)
            correlationId?.let { o.put("correlation_id", it) }
            parentCorrelationId?.let { o.put("parent_correlation_id", it) }
            for ((k, v) in data) {
                o.put(k, JSONObject.wrap(v) ?: JSONObject.NULL)
            }
            enqueue(o)
        } catch (e: Exception) {
            Log.w(TAG, "logEvent($eventType) failed: ${e.message}")
        }
    }

    /**
     * Ingest a pre-built payload (e.g. from the JS bridge). Wraps the common
     * envelope around the caller's JSON object. Caller-supplied keys override
     * envelope keys only if they collide (they shouldn't).
     */
    fun logRaw(eventType: String, payload: JSONObject, correlationId: String? = null) {
        if (!enabled) return
        try {
            val now = System.currentTimeMillis()
            val o = JSONObject()
            o.put("ts_ms", now)
            o.put("ts_mono_ns", SystemClock.elapsedRealtimeNanos())
            o.put("ts_iso", isoFmt.get()!!.format(now))
            o.put("event_type", eventType)
            o.put("process", processShort)
            o.put("pid", pid)
            o.put("tid", Process.myTid())
            o.put("thread_name", Thread.currentThread().name)
            o.put("session_id", sessionId)
            o.put("seq", seq.getAndIncrement())
            o.put("build_commit", BuildConfig.BUILD_COMMIT)
            o.put("build_variant", BuildConfig.BUILD_TYPE)
            correlationId?.let { o.put("correlation_id", it) }
            val keys = payload.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                o.put(k, payload.get(k))
            }
            enqueue(o)
        } catch (e: Exception) {
            Log.w(TAG, "logRaw($eventType) failed: ${e.message}")
        }
    }

    /** Drain the queue and flush all sinks. Call on onPause/onDestroy/onTrimMemory. */
    fun flush() {
        if (!enabled) return
        var spins = 0
        while (queue.isNotEmpty() && spins < 400) {
            try {
                Thread.sleep(5)
            } catch (_: InterruptedException) {
                break
            }
            spins++
        }
        sinks.forEach { it.flush() }
    }

    /** Snapshot of the in-RAM ring for in-app export. */
    fun memorySnapshot(): List<String> = memoryBuffer?.snapshot() ?: emptyList()

    /** Generate a short correlation id for a span of related events. */
    fun newCorrelationId(): String = UUID.randomUUID().toString().substring(0, 8)

    // ---- internals -------------------------------------------------------

    private fun enqueue(o: JSONObject) {
        if (!queue.offerLast(o)) {
            queue.pollFirst() // drop oldest
            dropped.incrementAndGet()
            queue.offerLast(o)
        }
    }

    private fun drainLoop() {
        Process.setThreadPriority(Process.THREAD_PRIORITY_BACKGROUND)
        val batch = ArrayList<JSONObject>(128)
        while (running || queue.isNotEmpty()) {
            val first = try {
                queue.pollFirst(1, TimeUnit.SECONDS)
            } catch (_: InterruptedException) {
                null
            } ?: continue
            batch.clear()
            batch.add(first)
            queue.drainTo(batch, 99)

            emitDroppedMarkerIfAny()

            for (ev in batch) {
                val line = ev.toString()
                for (s in sinks) {
                    try {
                        s.write(line, ev)
                    } catch (e: Exception) {
                        Log.w(TAG, "sink write failed: ${e.message}")
                    }
                }
            }
            for (s in sinks) {
                try {
                    s.flush()
                } catch (_: Exception) {
                }
            }
        }
    }

    private fun emitDroppedMarkerIfAny() {
        val d = dropped.getAndSet(0)
        if (d <= 0) return
        try {
            val now = System.currentTimeMillis()
            val o = JSONObject()
            o.put("ts_ms", now)
            o.put("ts_mono_ns", SystemClock.elapsedRealtimeNanos())
            o.put("ts_iso", isoFmt.get()!!.format(now))
            o.put("event_type", "dropped_events")
            o.put("process", processShort)
            o.put("pid", pid)
            o.put("tid", Process.myTid())
            o.put("thread_name", Thread.currentThread().name)
            o.put("session_id", sessionId)
            o.put("seq", seq.getAndIncrement())
            o.put("build_commit", BuildConfig.BUILD_COMMIT)
            o.put("build_variant", BuildConfig.BUILD_TYPE)
            o.put("count", d)
            val line = o.toString()
            for (s in sinks) s.write(line, o)
        } catch (_: Exception) {
        }
    }

    /**
     * Per-boot session id shared across processes. Stored in a sentinel file
     * with the approximate boot epoch; if the stored boot epoch is within 5 s
     * of the current computed boot epoch we treat it as the same boot and
     * reuse the id, otherwise we mint a new session.
     */
    private fun resolveSessionId(base: File): String {
        val sentinel = File(base, ".session_id")
        val bootEpochNow = System.currentTimeMillis() - SystemClock.elapsedRealtime()
        if (sentinel.exists()) {
            try {
                val obj = JSONObject(sentinel.readText())
                val storedBoot = obj.optLong("boot_epoch_ms", 0L)
                val id = obj.optString("id", "")
                if (id.isNotEmpty() && kotlin.math.abs(storedBoot - bootEpochNow) <= 5_000L) {
                    return id
                }
            } catch (_: Exception) {
                // fall through to regenerate
            }
        }
        val id = UUID.randomUUID().toString().substring(0, 12)
        try {
            sentinel.writeText(
                JSONObject().put("id", id).put("boot_epoch_ms", bootEpochNow).toString()
            )
        } catch (_: Exception) {
        }
        return id
    }

    /**
     * Map the OS process name to a short discriminator. All components
     * currently share one process (no android:process in the manifest), so
     * this resolves to "main"; the mapping is kept for if/when a dedicated
     * wallpaper/widget process is split out. Events additionally carry
     * component_class to disambiguate within a process.
     */
    private fun resolveProcessShort(context: Context): String {
        val pn = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            android.app.Application.getProcessName()
        } else {
            context.packageName
        }
        return when {
            pn.endsWith(":widget") || pn.endsWith(":wwkr") -> "wwkr"
            pn.endsWith(":home") || pn.endsWith(":hwlp") -> "hwlp"
            pn.endsWith(":lock") || pn.endsWith(":lwlp") -> "lwlp"
            else -> "main"
        }
    }
}
