package com.livesolar.solarsystem

import android.app.Activity
import android.app.WallpaperManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.widget.Toast

/**
 * One-shot launcher Activity that opens Android's live-wallpaper preview
 * pointed directly at SolarSystemWallpaperService.
 *
 * Some OEM skins (notably Samsung One UI) hide third-party live
 * wallpapers from their wallpaper picker. This launcher is shown as a
 * separate icon ("Solar Wallpaper") in the app drawer so users can apply
 * the wallpaper without hunting through OEM menus.
 */
class SolarSystemWallpaperLauncher : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val component = ComponentName(this, SolarSystemWallpaperService::class.java)
        val direct = Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER).apply {
            putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, component)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            startActivity(direct)
        } catch (e: Exception) {
            try {
                startActivity(Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (e2: Exception) {
                Toast.makeText(this, "Live wallpaper picker not available on this device", Toast.LENGTH_LONG).show()
            }
        }
        finish()
    }
}
