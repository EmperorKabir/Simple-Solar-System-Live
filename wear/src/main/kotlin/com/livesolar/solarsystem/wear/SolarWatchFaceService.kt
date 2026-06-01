package com.livesolar.solarsystem.wear

import android.view.SurfaceHolder
import androidx.wear.watchface.ComplicationSlotsManager
import androidx.wear.watchface.WatchFace
import androidx.wear.watchface.WatchFaceService
import androidx.wear.watchface.WatchFaceType
import androidx.wear.watchface.WatchState
import androidx.wear.watchface.style.CurrentUserStyleRepository

/**
 * Live Solar System — Wear OS watch face.
 *
 * A standalone watch face: it draws a top-down solar system (Sun + orbits +
 * planets) natively on the watch's Canvas, with optional time/date overlays.
 * Options (labels / show Pluto / tilt / time / date) are exposed as UserStyle
 * settings reached through the standard watch-face customise flow (added in a
 * later step). Renders cheaply on a coarse cadence — no live WebGL, watch-face-
 * safe and ambient-friendly.
 */
class SolarWatchFaceService : WatchFaceService() {

    override suspend fun createWatchFace(
        surfaceHolder: SurfaceHolder,
        watchState: WatchState,
        complicationSlotsManager: ComplicationSlotsManager,
        currentUserStyleRepository: CurrentUserStyleRepository
    ): WatchFace {
        val renderer = SolarRenderer(
            context = applicationContext,
            surfaceHolder = surfaceHolder,
            watchState = watchState,
            currentUserStyleRepository = currentUserStyleRepository
        )
        return WatchFace(WatchFaceType.DIGITAL, renderer)
    }
}
