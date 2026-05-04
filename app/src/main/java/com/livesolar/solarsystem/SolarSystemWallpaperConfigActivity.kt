package com.livesolar.solarsystem

class SolarSystemWallpaperConfigActivity : SurfaceSettingsActivity() {
    override val namespace: String = SurfaceSettings.WALLPAPER_NAMESPACE
    override fun onSaved(settings: SurfaceSettings) { finish() }
}
