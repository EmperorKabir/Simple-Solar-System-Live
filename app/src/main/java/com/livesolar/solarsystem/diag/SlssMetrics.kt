// SLSS_DIAG_TEMPORARY — memory + CPU sampling (plan §3.9, §3.10, §4.5, §5).
// A periodic background sampler plus on-demand snapshots around named events.
// All work runs on a dedicated background HandlerThread; nothing touches the
// main/UI thread. Remove with the rest of the diag/ package
// (grep -r SLSS_DIAG_TEMPORARY).
package com.livesolar.solarsystem.diag

import android.app.ActivityManager
import android.content.Context
import android.os.Debug
import android.os.Handler
import android.os.HandlerThread
import android.os.Process
import java.io.File

internal object SlssMetrics {

    private const val PERIOD_MS = 10_000L

    private var appContext: Context? = null
    private var thread: HandlerThread? = null
    private var handler: Handler? = null
    @Volatile private var running = false

    // Previous CPU jiffies for delta computation (process + per-thread).
    private var prevProcJiffies: Long = -1
    private var prevSampleMs: Long = 0
    private val prevThreadJiffies = HashMap<Int, Long>()

    fun start(context: Context) {
        if (!SlssLogger.enabled || running) return
        appContext = context.applicationContext
        val t = HandlerThread("SlssMetrics", Process.THREAD_PRIORITY_BACKGROUND)
        t.start()
        thread = t
        val h = Handler(t.looper)
        handler = h
        running = true
        h.post(object : Runnable {
            override fun run() {
                if (!running) return
                try {
                    snapshotMemory("periodic_10s")
                    sampleCpu()
                } catch (_: Throwable) {
                }
                h.postDelayed(this, PERIOD_MS)
            }
        })
    }

    fun stop() {
        running = false
        try {
            thread?.quitSafely()
        } catch (_: Throwable) {
        }
        thread = null
        handler = null
    }

    /** On-demand memory snapshot (e.g. pre_/post_ a render). Runs on the
     *  metrics thread if available, otherwise inline. */
    fun snapshotMemoryAsync(trigger: String) {
        val h = handler
        if (h != null) h.post { snapshotMemory(trigger) } else snapshotMemory(trigger)
    }

    private fun snapshotMemory(trigger: String) {
        if (!SlssLogger.enabled) return
        val ctx = appContext ?: return
        val rt = Runtime.getRuntime()
        val maxHeap = rt.maxMemory()
        val totalHeap = rt.totalMemory()
        val freeHeap = rt.freeMemory()

        val mi = Debug.MemoryInfo()
        Debug.getMemoryInfo(mi)

        val am = ctx.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        val amInfo = ActivityManager.MemoryInfo()
        am?.getMemoryInfo(amInfo)

        val procState = ActivityManager.RunningAppProcessInfo()
        try {
            ActivityManager.getMyMemoryState(procState)
        } catch (_: Throwable) {
        }

        SlssLogger.logEvent(
            "memory_snapshot",
            mapOf(
                "trigger" to trigger,
                "runtime" to mapOf(
                    "max_heap_bytes" to maxHeap,
                    "total_heap_bytes" to totalHeap,
                    "free_heap_bytes" to freeHeap,
                    "used_heap_bytes" to (totalHeap - freeHeap)
                ),
                "debug_memory_info" to mapOf(
                    "total_pss_kb" to mi.totalPss,
                    "total_private_dirty_kb" to mi.totalPrivateDirty,
                    "total_shared_dirty_kb" to mi.totalSharedDirty,
                    "total_private_clean_kb" to mi.totalPrivateClean,
                    "dalvik_pss_kb" to mi.dalvikPss,
                    "native_pss_kb" to mi.nativePss,
                    "other_pss_kb" to mi.otherPss,
                    "summary_java_heap_kb" to safeStat(mi, "summary.java-heap"),
                    "summary_native_heap_kb" to safeStat(mi, "summary.native-heap"),
                    "summary_graphics_kb" to safeStat(mi, "summary.graphics"),
                    "summary_code_kb" to safeStat(mi, "summary.code"),
                    "summary_stack_kb" to safeStat(mi, "summary.stack"),
                    "summary_system_kb" to safeStat(mi, "summary.system"),
                    "summary_total_pss_kb" to safeStat(mi, "summary.total-pss")
                ),
                "activity_manager_memory_info" to mapOf(
                    "available_mem_bytes" to amInfo.availMem,
                    "total_mem_bytes" to amInfo.totalMem,
                    "threshold_bytes" to amInfo.threshold,
                    "low_memory" to amInfo.lowMemory
                ),
                "process_importance" to procState.importance
            )
        )
    }

    private fun safeStat(mi: Debug.MemoryInfo, key: String): Long =
        try {
            mi.getMemoryStat(key)?.toLongOrNull() ?: -1L
        } catch (_: Throwable) {
            -1L
        }

    private fun sampleCpu() {
        if (!SlssLogger.enabled) return
        val nowMs = System.currentTimeMillis()
        val procJiffies = readProcJiffies(File("/proc/self/stat"))
        val threads = ArrayList<Map<String, Any?>>()
        val taskDir = File("/proc/self/task")
        val tids = taskDir.list() ?: emptyArray()
        for (tidStr in tids) {
            val tid = tidStr.toIntOrNull() ?: continue
            val statFile = File(taskDir, "$tidStr/stat")
            val j = readProcJiffies(statFile)
            if (j < 0) continue
            val prev = prevThreadJiffies[tid]
            val delta = if (prev != null) j - prev else 0L
            prevThreadJiffies[tid] = j
            threads.add(
                mapOf(
                    "tid" to tid,
                    "name" to readThreadName(statFile),
                    "jiffies_delta" to delta
                )
            )
        }
        val procDelta = if (prevProcJiffies >= 0) procJiffies - prevProcJiffies else 0L
        val windowMs = if (prevSampleMs > 0) nowMs - prevSampleMs else PERIOD_MS
        prevProcJiffies = procJiffies
        prevSampleMs = nowMs

        SlssLogger.logEvent(
            "cpu_sample",
            mapOf(
                "sample_window_ms" to windowMs,
                "process_jiffies_delta" to procDelta,
                "clock_ticks_per_sec" to 100,
                "threads" to threads.sortedByDescending { it["jiffies_delta"] as? Long ?: 0L }.take(20)
            )
        )
    }

    // /proc stat fields 14 (utime) + 15 (stime), space-separated AFTER the
    // comm field which may itself contain spaces inside parentheses.
    private fun readProcJiffies(stat: File): Long {
        return try {
            val text = stat.readText()
            val close = text.lastIndexOf(')')
            if (close < 0) return -1
            val rest = text.substring(close + 2).trim().split(" ")
            // After comm, field 3 is state; utime is field 14 overall = index 11
            // here (state is index 0 of rest). utime=rest[11], stime=rest[12].
            val utime = rest.getOrNull(11)?.toLongOrNull() ?: return -1
            val stime = rest.getOrNull(12)?.toLongOrNull() ?: return -1
            utime + stime
        } catch (_: Throwable) {
            -1
        }
    }

    private fun readThreadName(stat: File): String {
        return try {
            val text = stat.readText()
            val open = text.indexOf('(')
            val close = text.lastIndexOf(')')
            if (open in 0 until close) text.substring(open + 1, close) else "?"
        } catch (_: Throwable) {
            "?"
        }
    }
}
