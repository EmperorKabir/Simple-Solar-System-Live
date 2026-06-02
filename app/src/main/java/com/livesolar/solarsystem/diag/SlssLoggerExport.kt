// SLSS_DIAG_TEMPORARY — in-app diagnostic log export + share.
// Zips filesDir/slss_logs + filesDir/diag into filesDir/slss_export/ and fires
// an ACTION_SEND chooser via FileProvider so the bundle can be shared
// (Drive / email / save). Removable with the rest of the diag/ package and the
// <provider> + res/xml/slss_file_paths.xml (search SLSS_DIAG_TEMPORARY).
package com.livesolar.solarsystem.diag

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

internal object SlssLoggerExport {

    fun exportAndShare(context: Context) {
        if (!SlssLogger.enabled) return
        val app = context.applicationContext
        // Build the zip off the main thread, then launch the chooser on it.
        Thread({
            val zip = try {
                buildZip(app)
            } catch (e: Exception) {
                Log.w("SlssDiag", "export zip failed: ${e.message}")
                null
            }
            Handler(Looper.getMainLooper()).post {
                if (zip == null || !zip.exists()) {
                    toast(app, "SLSS export failed")
                    return@post
                }
                try {
                    val uri = FileProvider.getUriForFile(
                        app, "${app.packageName}.slssdiag.fileprovider", zip
                    )
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "application/zip"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        putExtra(Intent.EXTRA_SUBJECT, "SLSS diagnostic logs")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    val chooser = Intent.createChooser(send, "Share SLSS diagnostic logs")
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    app.startActivity(chooser)
                } catch (e: Exception) {
                    Log.w("SlssDiag", "export share failed: ${e.message}")
                    toast(app, "SLSS share failed: ${e.message}")
                }
            }
        }, "SlssExport").start()
    }

    private fun buildZip(app: Context): File {
        SlssLogger.flush()
        val exportDir = File(app.filesDir, "slss_export")
        exportDir.mkdirs()
        // Stable name so we never accumulate export zips (idempotent).
        val zipFile = File(exportDir, "slss-logs.zip")
        ZipOutputStream(zipFile.outputStream().buffered()).use { zos ->
            addDir(zos, File(app.filesDir, "slss_logs"), "slss_logs")
            addDir(zos, File(app.filesDir, "diag"), "diag")
        }
        return zipFile
    }

    private fun addDir(zos: ZipOutputStream, dir: File, prefix: String) {
        val files = dir.listFiles() ?: return
        for (f in files) {
            if (f.isDirectory) {
                addDir(zos, f, "$prefix/${f.name}")
                continue
            }
            try {
                zos.putNextEntry(ZipEntry("$prefix/${f.name}"))
                f.inputStream().use { it.copyTo(zos) }
                zos.closeEntry()
            } catch (e: Exception) {
                Log.w("SlssDiag", "zip add ${f.name} failed: ${e.message}")
            }
        }
    }

    private fun toast(context: Context, msg: String) {
        try {
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        } catch (_: Throwable) {
        }
    }
}
