// SLSS_DIAG_TEMPORARY — passive system-event observers.
// Part of the temporary diagnostic logging system (plan §1, §3.5-3.7, §3.15-3.16, §4.4).
// Installs: ActivityLifecycleCallbacks, ComponentCallbacks2 (trim/config),
// DisplayManager.DisplayListener, DeviceStateManager.DeviceStateCallback,
// the hinge-angle SensorEventListener, and the runtime screen-state receiver.
// Remove with the rest of the diag/ package (grep -r SLSS_DIAG_TEMPORARY).
package com.livesolar.solarsystem.diag

import android.app.Activity
import android.app.Application
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.IntentFilter
import android.content.res.Configuration
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.display.DisplayManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import kotlin.math.abs

internal object SlssLoggerObservers {

    private const val TAG = "SlssDiag"
    private var installed = false
    private val handler = Handler(Looper.getMainLooper())
    private var screenReceiver: SlssScreenStateReceiver? = null

    // Hinge angle is logged only when it moves by at least this many degrees.
    private const val HINGE_MIN_DELTA_DEG = 5f
    private var lastLoggedHinge = Float.NaN

    fun install(app: Application) {
        if (!SlssLogger.enabled || installed) return
        installed = true
        installLifecycle(app)
        installComponentCallbacks(app)
        installDisplayListener(app)
        // NOTE: android.hardware.devicestate.DeviceStateManager is a @SystemApi
        // and is not reachable from a normal app. Foldable posture is instead
        // captured precisely via the hinge-angle sensor below (continuous
        // degrees) and via display-geometry deltas feeding the fold_unfold
        // synthetic event — both public APIs.
        installHingeSensor(app)
        installScreenReceiver(app)
        // Seed the fold detector with the current default-display geometry.
        seedDisplayGeometry(app)
    }

    private fun installLifecycle(app: Application) {
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityCreated(a: Activity, b: Bundle?) =
                emit(a, "onCreate", mapOf("saved_instance_state_present" to (b != null)))

            override fun onActivityStarted(a: Activity) = emit(a, "onStart")
            override fun onActivityResumed(a: Activity) = emit(a, "onResume")

            override fun onActivityPaused(a: Activity) {
                emit(a, "onPause")
                SlssLogger.flush()
            }

            override fun onActivityStopped(a: Activity) {
                emit(a, "onStop")
                SlssLogger.flush()
            }

            override fun onActivitySaveInstanceState(a: Activity, b: Bundle) =
                emit(a, "onSaveInstanceState")

            override fun onActivityDestroyed(a: Activity) {
                emit(a, "onDestroy")
                SlssLogger.flush()
            }

            private fun emit(a: Activity, cb: String, extra: Map<String, Any?> = emptyMap()) {
                val data = HashMap<String, Any?>()
                data["component_class"] = a.javaClass.simpleName
                data["callback"] = cb
                data["intent_action"] = a.intent?.action
                data["intent_categories"] = a.intent?.categories?.toList()
                if (extra.isNotEmpty()) data["extras"] = extra
                SlssLogger.logEvent("lifecycle", data)
            }
        })
    }

    private fun installComponentCallbacks(app: Application) {
        // Track previous config so we can log a true delta on each change.
        var prev = Configuration(app.resources.configuration)
        app.registerComponentCallbacks(object : ComponentCallbacks2 {
            override fun onConfigurationChanged(newConfig: Configuration) {
                val flags = ArrayList<String>()
                if (prev.orientation != newConfig.orientation) flags.add("orientation")
                if (prev.screenWidthDp != newConfig.screenWidthDp) flags.add("screenWidth")
                if (prev.screenHeightDp != newConfig.screenHeightDp) flags.add("screenHeight")
                if (prev.smallestScreenWidthDp != newConfig.smallestScreenWidthDp) flags.add("smallestScreenWidth")
                if (prev.densityDpi != newConfig.densityDpi) flags.add("density")
                if (prev.uiMode != newConfig.uiMode) flags.add("uiMode")
                if (prev.fontScale != newConfig.fontScale) flags.add("fontScale")
                SlssSyntheticEventDetector.noteChild("config_change")
                SlssLogger.logEvent(
                    "config_change",
                    mapOf(
                        "old_orientation" to prev.orientation,
                        "new_orientation" to newConfig.orientation,
                        "old_screen_width_dp" to prev.screenWidthDp,
                        "new_screen_width_dp" to newConfig.screenWidthDp,
                        "old_screen_height_dp" to prev.screenHeightDp,
                        "new_screen_height_dp" to newConfig.screenHeightDp,
                        "old_smallest_width_dp" to prev.smallestScreenWidthDp,
                        "new_smallest_width_dp" to newConfig.smallestScreenWidthDp,
                        "old_density_dpi" to prev.densityDpi,
                        "new_density_dpi" to newConfig.densityDpi,
                        "old_ui_mode" to prev.uiMode,
                        "new_ui_mode" to newConfig.uiMode,
                        "changed_flags" to flags
                    )
                )
                prev = Configuration(newConfig)
            }

            override fun onLowMemory() {
                SlssLogger.logEvent("lifecycle", mapOf("component_class" to "Application", "callback" to "onLowMemory"))
                SlssLogger.flush()
            }

            override fun onTrimMemory(level: Int) {
                SlssLogger.logEvent(
                    "lifecycle",
                    mapOf(
                        "component_class" to "Application",
                        "callback" to "onTrimMemory",
                        "extras" to mapOf("trim_level_int" to level)
                    )
                )
                SlssLogger.flush()
            }
        })
    }

    private fun installDisplayListener(app: Application) {
        val dm = app.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager ?: return
        dm.registerDisplayListener(object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) = report(dm, displayId, "onDisplayAdded")
            override fun onDisplayRemoved(displayId: Int) =
                SlssLogger.logEvent("display_state_change", mapOf("source" to "onDisplayRemoved", "display_id" to displayId))

            override fun onDisplayChanged(displayId: Int) = report(dm, displayId, "onDisplayChanged")
        }, handler)
    }

    private fun report(dm: DisplayManager, displayId: Int, source: String) {
        val d = try {
            dm.getDisplay(displayId)
        } catch (_: Throwable) {
            null
        } ?: return
        // Ignore our own off-screen render displays.
        if (d.name?.startsWith("SolarRenderer-") == true) return
        val size = android.graphics.Point().also {
            @Suppress("DEPRECATION")
            d.getRealSize(it)
        }
        SlssLogger.logEvent(
            "display_state_change",
            mapOf(
                "source" to source,
                "display_id" to displayId,
                "display_name" to d.name,
                "display_state_int" to d.state,
                "display_state_str" to displayStateName(d.state),
                "display_size_px" to mapOf("w" to size.x, "h" to size.y),
                "display_rotation_int" to d.rotation,
                "display_refresh_rate_hz" to d.refreshRate
            )
        )
        if (displayId == Display.DEFAULT_DISPLAY) {
            SlssSyntheticEventDetector.noteDisplayGeometry(size.x, size.y)
        }
    }

    private fun seedDisplayGeometry(app: Application) {
        val dm = app.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager ?: return
        val d = try {
            dm.getDisplay(Display.DEFAULT_DISPLAY)
        } catch (_: Throwable) {
            null
        } ?: return
        val size = android.graphics.Point().also {
            @Suppress("DEPRECATION")
            d.getRealSize(it)
        }
        SlssSyntheticEventDetector.noteDisplayGeometry(size.x, size.y)
    }

    private fun installHingeSensor(app: Application) {
        val sm = app.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
        val hinge = try {
            sm.getDefaultSensor(Sensor.TYPE_HINGE_ANGLE)
        } catch (_: Throwable) {
            null
        } ?: return
        sm.registerListener(object : SensorEventListener {
            override fun onSensorChanged(event: SensorEvent) {
                val angle = event.values.firstOrNull() ?: return
                SlssSyntheticEventDetector.noteHingeAngle(angle)
                if (lastLoggedHinge.isNaN() || abs(angle - lastLoggedHinge) >= HINGE_MIN_DELTA_DEG) {
                    lastLoggedHinge = angle
                    SlssLogger.logEvent("hinge_angle", mapOf("angle_deg" to angle))
                }
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }, hinge, SensorManager.SENSOR_DELAY_NORMAL)
    }

    private fun installScreenReceiver(app: Application) {
        val r = SlssScreenStateReceiver()
        screenReceiver = r
        val filter = IntentFilter().apply {
            addAction(android.content.Intent.ACTION_SCREEN_ON)
            addAction(android.content.Intent.ACTION_SCREEN_OFF)
            addAction(android.content.Intent.ACTION_USER_PRESENT)
            addAction(android.content.Intent.ACTION_TIMEZONE_CHANGED)
            addAction(android.content.Intent.ACTION_LOCALE_CHANGED)
        }
        try {
            app.registerReceiver(r, filter)
        } catch (e: Throwable) {
            Log.w(TAG, "screen receiver registration failed: ${e.message}")
        }
    }

    private fun displayStateName(state: Int): String = when (state) {
        Display.STATE_OFF -> "STATE_OFF"
        Display.STATE_ON -> "STATE_ON"
        Display.STATE_DOZE -> "STATE_DOZE"
        Display.STATE_DOZE_SUSPEND -> "STATE_DOZE_SUSPEND"
        Display.STATE_VR -> "STATE_VR"
        Display.STATE_ON_SUSPEND -> "STATE_ON_SUSPEND"
        else -> "STATE_$state"
    }
}
