// SLSS_DIAG_TEMPORARY — screen power + timezone broadcast receiver.
// Part of the temporary diagnostic logging system (plan §3.6, §4.3, §5).
// ACTION_SCREEN_ON/OFF/USER_PRESENT are delivered ONLY to runtime-registered
// receivers (never manifest-declared), so this is registered dynamically in
// SlssLoggerObservers.install(), NOT in AndroidManifest. Remove with the rest
// of the diag/ package (grep -r SLSS_DIAG_TEMPORARY).
package com.livesolar.solarsystem.diag

import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import java.util.Locale
import java.util.TimeZone

internal class SlssScreenStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (!SlssLogger.enabled) return
        when (intent.action) {
            Intent.ACTION_SCREEN_ON,
            Intent.ACTION_SCREEN_OFF,
            Intent.ACTION_USER_PRESENT -> emitScreenPower(context, intent.action!!)

            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_LOCALE_CHANGED -> emitEnvChange(intent.action!!)
        }
    }

    private fun emitScreenPower(context: Context, action: String) {
        val km = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
        val shortAction = when (action) {
            Intent.ACTION_SCREEN_ON -> "SCREEN_ON"
            Intent.ACTION_SCREEN_OFF -> "SCREEN_OFF"
            else -> "USER_PRESENT"
        }
        SlssSyntheticEventDetector.noteChild("screen_$shortAction")
        SlssLogger.logEvent(
            "screen_power",
            mapOf(
                "action" to shortAction,
                "keyguard_locked" to (km?.isKeyguardLocked ?: false),
                "keyguard_secure" to (km?.isDeviceSecure ?: false),
                "power_save_mode" to (pm?.isPowerSaveMode ?: false),
                "thermal_status" to (pm?.currentThermalStatus ?: -1),
                "interactive" to (pm?.isInteractive ?: false)
            )
        )
    }

    private fun emitEnvChange(action: String) {
        SlssLogger.logEvent(
            "env_change",
            mapOf(
                "action" to action,
                "timezone" to TimeZone.getDefault().id,
                "locale" to Locale.getDefault().toLanguageTag()
            )
        )
    }
}
