// SLSS_DIAG_TEMPORARY — Application subclass that bootstraps the diagnostic
// logger as early as possible in every process. Registered via
// android:name=".SolarSystemApplication" in the manifest. Removable with the
// rest of the diagnostic system (search SLSS_DIAG_TEMPORARY).
package com.livesolar.solarsystem

import android.app.Application
import android.os.Build
import com.livesolar.solarsystem.diag.SlssLogger
import com.livesolar.solarsystem.diag.SlssLoggerObservers
import java.util.Locale
import java.util.TimeZone

class SolarSystemApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        // Gate the entire diag bootstrap on the COMPILE constant so R8 can prune the
        // observer/metrics/sensor class tree from RELEASE (the unconditional install()
        // otherwise roots them past the runtime no-op). Debug/diagnostic set
        // SLSS_DIAG_ENABLED=true → byte-identical behaviour; release was already inert.
        if (BuildConfig.SLSS_DIAG_ENABLED) {
            SlssLogger.init(this)
            emitSessionStart()
            SlssLoggerObservers.install(this)
        }
    }

    /**
     * Captures device + display + locale context once per process start so
     * every later event can be reconciled against the hardware/config it ran on.
     */
    private fun emitSessionStart() {
        val dm = resources.displayMetrics
        val config = resources.configuration
        SlssLogger.logEvent(
            "session_start",
            mapOf(
                "hello" to "world",
                "process_name" to Application.getProcessName(),
                "package" to packageName,
                "device" to mapOf(
                    "manufacturer" to Build.MANUFACTURER,
                    "model" to Build.MODEL,
                    "device" to Build.DEVICE,
                    "product" to Build.PRODUCT,
                    "hardware" to Build.HARDWARE,
                    "fingerprint" to Build.FINGERPRINT,
                    "sdk_int" to Build.VERSION.SDK_INT,
                    "release" to Build.VERSION.RELEASE,
                    "supported_abis" to Build.SUPPORTED_ABIS.toList()
                ),
                "display" to mapOf(
                    "density" to dm.density,
                    "density_dpi" to dm.densityDpi,
                    "width_px" to dm.widthPixels,
                    "height_px" to dm.heightPixels,
                    "xdpi" to dm.xdpi,
                    "ydpi" to dm.ydpi
                ),
                "config" to mapOf(
                    "orientation" to config.orientation,
                    "screen_width_dp" to config.screenWidthDp,
                    "screen_height_dp" to config.screenHeightDp,
                    "smallest_screen_width_dp" to config.smallestScreenWidthDp,
                    "ui_mode" to config.uiMode,
                    "font_scale" to config.fontScale
                ),
                "locale" to Locale.getDefault().toLanguageTag(),
                "timezone" to TimeZone.getDefault().id
            )
        )
    }
}
