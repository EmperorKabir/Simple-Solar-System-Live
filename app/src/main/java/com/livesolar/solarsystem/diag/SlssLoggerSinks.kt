// SLSS_DIAG_TEMPORARY — pluggable sinks for the diagnostic logger.
// Part of the temporary diagnostic logging system (see
// the diagnostic-logging design).
// Remove the whole diag/ package when the investigation concludes
// (grep -r SLSS_DIAG_TEMPORARY for the full cleanup hit list).
package com.livesolar.solarsystem.diag

import android.util.Log
import org.json.JSONObject
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.ArrayDeque
import java.util.zip.GZIPOutputStream

/**
 * A destination for diagnostic log lines. [write] receives the already
 * serialised JSONL string plus the source [JSONObject] (in case a sink wants
 * structured access). All sink methods are called ONLY from the single
 * background writer thread in [SlssLogger], so implementations need not be
 * thread-safe among themselves.
 */
internal interface SlssSink {
    fun write(line: String, event: JSONObject)
    fun flush()
    fun close()
}

/**
 * Primary sink: appends JSON Lines to `filesDir/slss_logs/`, rotates at
 * [maxBytesPerFile], gzips rolled files, and prunes oldest files to keep the
 * per-process footprint under [maxBytesTotal]. Survives cold starts by
 * resuming the highest existing (non-gz) sequence index for this
 * session+process.
 */
internal class JsonlFileSink(
    private val dir: File,
    private val sessionId: String,
    private val processShort: String,
    private val maxBytesPerFile: Long = 10L * 1024 * 1024,
    private val maxBytesTotal: Long = 200L * 1024 * 1024,
) : SlssSink {

    private var index = 1
    private var current: File? = null
    private var out: BufferedOutputStream? = null
    private var bytesWritten = 0L

    init {
        dir.mkdirs()
        resumeOrOpen()
    }

    private fun prefix() = "slss-$sessionId-$processShort-"

    private fun fileName(i: Int) = prefix() + i.toString().padStart(3, '0') + ".jsonl"

    /** Pick up where a previous process/run for this session+process left off. */
    private fun resumeOrOpen() {
        val existing = dir.listFiles { f ->
            f.name.startsWith(prefix()) && f.name.endsWith(".jsonl")
        }?.sortedBy { it.name } ?: emptyList()
        val last = existing.lastOrNull()
        if (last != null) {
            // Parse index out of the trailing NNN before .jsonl
            val idxStr = last.name.removePrefix(prefix()).removeSuffix(".jsonl")
            index = idxStr.toIntOrNull() ?: 1
            if (last.length() >= maxBytesPerFile) {
                rotate()
            } else {
                current = last
                bytesWritten = last.length()
                out = BufferedOutputStream(FileOutputStream(last, /* append = */ true))
            }
        } else {
            openCurrent()
        }
    }

    private fun openCurrent() {
        val f = File(dir, fileName(index))
        current = f
        bytesWritten = if (f.exists()) f.length() else 0L
        out = BufferedOutputStream(FileOutputStream(f, /* append = */ true))
    }

    override fun write(line: String, event: JSONObject) {
        val stream = out ?: return
        val bytes = (line + "\n").toByteArray(Charsets.UTF_8)
        stream.write(bytes)
        bytesWritten += bytes.size
        if (bytesWritten >= maxBytesPerFile) {
            rotate()
        }
    }

    private fun rotate() {
        // Close + gzip the file we just filled, then advance the index.
        try {
            out?.flush()
            out?.close()
        } catch (_: Exception) {
        }
        val filled = current
        if (filled != null && filled.exists() && filled.length() > 0L) {
            try {
                val gz = File(filled.parentFile, filled.name + ".gz")
                GZIPOutputStream(BufferedOutputStream(FileOutputStream(gz))).use { zos ->
                    filled.inputStream().use { it.copyTo(zos) }
                }
                filled.delete()
            } catch (e: Exception) {
                Log.w("SlssDiag", "gzip rotate failed: ${e.message}")
            }
        }
        index += 1
        openCurrent()
        prune()
    }

    /** Delete oldest files (by name, which is time-ordered) until under cap. */
    private fun prune() {
        val files = dir.listFiles { f ->
            f.name.startsWith(prefix()) &&
                (f.name.endsWith(".jsonl") || f.name.endsWith(".jsonl.gz"))
        }?.sortedBy { it.name }?.toMutableList() ?: return
        var total = files.sumOf { it.length() }
        var i = 0
        while (total > maxBytesTotal && i < files.size - 1) {
            val victim = files[i]
            val sz = victim.length()
            if (victim.delete()) total -= sz
            i++
        }
    }

    override fun flush() {
        try {
            out?.flush()
        } catch (_: Exception) {
        }
    }

    override fun close() {
        try {
            out?.flush()
            out?.close()
        } catch (_: Exception) {
        }
        out = null
    }
}

/**
 * Mirrors every line to logcat under tag `SlssDiag` for live
 * `adb logcat -s SlssDiag` viewing. Logcat truncates very long lines, so we
 * chunk anything over ~3500 chars with an index suffix.
 */
internal class LogcatMirrorSink(private val tag: String = "SlssDiag") : SlssSink {
    override fun write(line: String, event: JSONObject) {
        if (line.length <= CHUNK) {
            Log.d(tag, line)
            return
        }
        var start = 0
        var part = 0
        while (start < line.length) {
            val end = minOf(start + CHUNK, line.length)
            Log.d(tag, "[$part] " + line.substring(start, end))
            start = end
            part++
        }
    }

    override fun flush() {}
    override fun close() {}

    companion object {
        private const val CHUNK = 3500
    }
}

/**
 * Keeps the last [capacity] serialised lines in RAM for in-app export
 * (see plan §7 in-app share). Read via [snapshot]. Only mutated on the writer
 * thread; [snapshot] copies under lock.
 */
internal class MemoryBufferSink(private val capacity: Int = 1000) : SlssSink {
    private val ring = ArrayDeque<String>(capacity)

    override fun write(line: String, event: JSONObject) {
        synchronized(ring) {
            if (ring.size >= capacity) ring.pollFirst()
            ring.addLast(line)
        }
    }

    fun snapshot(): List<String> = synchronized(ring) { ring.toList() }

    override fun flush() {}
    override fun close() {
        synchronized(ring) { ring.clear() }
    }
}
