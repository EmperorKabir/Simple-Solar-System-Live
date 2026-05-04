package com.livesolar.solarsystem

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView

/**
 * Shared settings UI for widget and live-wallpaper configuration.
 *
 * Subclasses provide:
 *   - the SharedPreferences namespace via [namespace]
 *   - what to do on Save via [onSaved] (e.g. trigger widget refresh, finish())
 */
abstract class SurfaceSettingsActivity : Activity() {

    abstract val namespace: String
    abstract fun onSaved(settings: SurfaceSettings)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val settings = SurfaceSettings(this, namespace)

        val pad = (resources.displayMetrics.density * 20).toInt()

        val title = TextView(this).apply {
            text = "Configure Solar System"
            textSize = 18f
            setPadding(0, 0, 0, pad)
        }

        val offsetLabel = TextView(this).apply {
            text = "Vertical offset (push scene down):"
            setPadding(0, pad, 0, pad / 4)
        }
        val spinner = Spinner(this).apply {
            val adapter = ArrayAdapter(
                this@SurfaceSettingsActivity,
                android.R.layout.simple_spinner_item,
                SurfaceSettings.OFFSET_LABELS
            )
            adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            this.adapter = adapter
            // Pre-select stored value
            val currentIdx = SurfaceSettings.OFFSET_OPTIONS.indexOfFirst {
                kotlin.math.abs(it - settings.offsetY) < 0.01f
            }.coerceAtLeast(0)
            setSelection(currentIdx)
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                    settings.offsetY = SurfaceSettings.OFFSET_OPTIONS[pos]
                }
                override fun onNothingSelected(parent: AdapterView<*>?) {}
            }
        }

        val tiltLabel = TextView(this).apply {
            text = "Camera tilt (0% = top-down, 70% = nearly side-on):"
            setPadding(0, pad, 0, pad / 4)
        }
        val tiltSpinner = Spinner(this).apply {
            val a = ArrayAdapter(
                this@SurfaceSettingsActivity,
                android.R.layout.simple_spinner_item,
                SurfaceSettings.TILT_LABELS
            )
            a.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
            adapter = a
            val currentIdx = SurfaceSettings.TILT_OPTIONS.indexOfFirst {
                kotlin.math.abs(it - settings.tilt) < 0.01f
            }.coerceAtLeast(0)
            setSelection(currentIdx)
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                    settings.tilt = SurfaceSettings.TILT_OPTIONS[pos]
                }
                override fun onNothingSelected(parent: AdapterView<*>?) {}
            }
        }

        val labelsSwitch = Switch(this).apply {
            text = "Show body labels"
            isChecked = settings.labelsEnabled
            setOnCheckedChangeListener { _, isChecked -> settings.labelsEnabled = isChecked }
            setPadding(0, pad, 0, pad)
        }

        val saveBtn = Button(this).apply {
            text = "Save"
            setOnClickListener { onSaved(settings) }
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
            gravity = Gravity.TOP
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            addView(title)
            addView(offsetLabel)
            addView(spinner)
            addView(tiltLabel)
            addView(tiltSpinner)
            addView(labelsSwitch)
            addView(saveBtn)
        }
        setContentView(root)
    }
}
