package com.livesolar.solarsystem

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.Box
import androidx.glance.layout.fillMaxSize
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.background

class AstronomyWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        // The widget provides scalable 2D layouts using Glance Box/Row/Column modifiers
        provideContent {
            Box(modifier = androidx.glance.GlanceModifier
                .fillMaxSize()
                .background(ColorProvider(android.graphics.Color.BLACK))
            ) {
                Text(
                    text = "Live Solar Alignments",
                    style = TextStyle(color = ColorProvider(android.graphics.Color.WHITE))
                )
                // Draw nodes here for the Moon/Earth/Pluto scaling natively with Foldables
            }
        }
    }
}

class AstronomyWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = AstronomyWidget()
}
