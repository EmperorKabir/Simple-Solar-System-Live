# Diagnostic logging — comprehensive plan

> **TEMPORARY measure.** This logging system is designed for diagnostic-mode-only use to unblock the moon camera + widget + lock-screen investigations. Every piece of code added under this plan MUST be gated behind `BuildConfig.DEBUG` and removed cleanly once root-cause findings are confirmed. A cleanup checklist is at the bottom of this document.

---

## 0. Goals and non-negotiables

- Diagnose three currently-blind failure modes:
  - **Moon camera** — where Sun / parent / moon land in the frame, what zoom level was applied, why the chosen camera distance failed
  - **Widget orbit centring** — why rings sit asymmetrically in the bitmap despite framing math claiming symmetric extents
  - **Lock-screen shift bug** — solar system shifts to the side on screen on/off or fold/unfold, sometimes corrects later, sometimes doesn't
- Capture enough data on every event to diagnose offline without needing the user to describe what they see
- Memory / CPU / storage intensive is acceptable per user — Z Fold 6/7 hardware can handle it
- May prompt user for additional Android permissions if needed
- All logging code gated by `BuildConfig.DEBUG` AND a runtime `SlssLogger.enabled` flag (so we can flip off without rebuilding)
- Per-moon, per-planet, per-surface separability of every event
- Cross-process correlation (main app, widget worker, home wallpaper, lock wallpaper run in separate processes; logs must be reconcilable by `session_id` + `process` + `wall_time_ms`)

## 1. Architecture overview

### Components

- `SlssLogger` — Kotlin singleton (object) in `app/src/main/java/com/livesolar/solarsystem/diag/SlssLogger.kt`
  - Thread-safe ring buffer + file appender
  - `logEvent(eventType: String, data: Map<String, Any?>)` primary API
  - Auto-includes envelope: `ts_ms`, `ts_iso`, `event_type`, `process`, `session_id`, `seq`, `build_commit`, `pid`, `thread_name`
- `SlssLoggerJsBridge` — `@JavascriptInterface` wrapper exposed to WebView as `window.SlssLog`
  - JS methods: `event(typeStr, payloadJsonStr)`, `markFrame()`, `markCameraReset()`
- `SlssLoggerSinks` — pluggable sinks:
  - `JsonlFileSink` — primary, writes JSON Lines to `filesDir/slss_logs/`
  - `LogcatMirrorSink` — also emits to logcat tag `SlssDiag` for live `adb logcat` viewing
  - `MemoryBufferSink` — last 1000 events held in RAM for in-app share/export
- `SlssLoggerLifecycleObservers` — listeners for app/system events that need passive monitoring:
  - `Application.ActivityLifecycleCallbacks`
  - `DisplayManager.DisplayListener`
  - `DeviceStateManager.DeviceStateCallback` (API 31+)
  - `ComponentCallbacks2.onTrimMemory`
  - Manifest-registered `BroadcastReceiver` for `ACTION_SCREEN_ON` / `ACTION_SCREEN_OFF` / `ACTION_USER_PRESENT` / `ACTION_CONFIGURATION_CHANGED`

### Initialisation point

- `SolarSystemApplication.onCreate` (new `Application` subclass; manifest registers it via `android:name=".SolarSystemApplication"`)
- Bootstraps the logger BEFORE any other process-local work so wallpaper services + widget worker pick up the same logger config on their own process starts

### Per-process behaviour

- Each Android process (main, widget worker, home wallpaper, lock wallpaper) starts its own `Application` instance → its own `SlssLogger`
- All four loggers write to the SAME `filesDir/slss_logs/` directory because `filesDir` is shared per-UID
- File naming includes process discriminator: `slss-<session_id>-<process_short>-<rolled_index>.jsonl`
  - process_short = main | wwkr | hwlp | lwlp
- Session ID is shared if generated at boot via a sentinel file `filesDir/slss_logs/.session_id`; first process to start writes it, others read

---

## 2. Storage, format, and rotation

### Directory layout

```
filesDir/slss_logs/
  ├── .session_id                  (sentinel; UUID written once per boot)
  ├── slss-<sid>-main-001.jsonl    (active main process log)
  ├── slss-<sid>-main-002.jsonl.gz (rolled, gzipped)
  ├── slss-<sid>-wwkr-001.jsonl
  ├── slss-<sid>-hwlp-001.jsonl
  ├── slss-<sid>-lwlp-001.jsonl
  └── manifest.json                (index of all sessions/files for export tooling)
```

### Format

- **JSON Lines** (one event per line, JSON object, newline-terminated)
- Common envelope every event includes:
  - `ts_ms` — `System.currentTimeMillis()`
  - `ts_mono_ns` — `SystemClock.elapsedRealtimeNanos()` for sub-ms ordering
  - `ts_iso` — ISO-8601 with millisecond precision and timezone
  - `event_type` — string discriminator
  - `process` — main | wwkr | hwlp | lwlp
  - `pid` — `android.os.Process.myPid()`
  - `tid` — `android.os.Process.myTid()`
  - `thread_name` — `Thread.currentThread().name`
  - `session_id` — UUID for this device-uptime session
  - `seq` — monotonic per-process sequence number
  - `build_commit` — short git SHA from `BuildConfig.BUILD_COMMIT` (added via gradle build script)
  - `build_variant` — `BuildConfig.BUILD_TYPE`
  - `correlation_id` — optional span ID for related events (set by caller)
  - `parent_correlation_id` — optional, for hierarchical spans

### Rotation policy

- 10 MB per active file
- On reaching 10 MB: close current file → gzip in background → start next sequence number
- Retain last 200 MB total per process (auto-prune oldest on rotation)
- Retain across reboot — do NOT delete on app cold start

### Buffering and flush

- Single-threaded writer with a `LinkedBlockingDeque<Event>` (capacity 10 000)
- Flush trigger: every 1 s OR every 100 events OR on explicit `flush()` call
- Explicit flush on:
  - Activity `onPause`
  - Service `onDestroy`
  - `onTrimMemory(TRIM_MEMORY_*)`
  - Before any moon-select event
  - Before any widget-render event
- Backpressure: if deque full, drop OLDEST events and emit one `dropped_events` event indicating how many were lost (rare, but visible in logs)

### Permissions

- `filesDir` requires NO permissions — preferred home for the logs
- Optional: also dump rolled, gzipped logs to `Environment.getExternalStorageDirectory()/slss_logs/` for easier `adb pull`
  - Requires `WRITE_EXTERNAL_STORAGE` on API ≤ 29; on API 30+ uses Scoped Storage / MediaStore — defer to ADB pull from `filesDir` instead via `adb shell run-as`
- `POST_NOTIFICATIONS` (API 33+) — request at runtime IF we add the optional ongoing-notification sink described in §10
- `READ_LOGS` — NOT grantable to user apps; logcat mirror sink works only for our own process's log output, which is sufficient

---

## 3. Event taxonomy (full schemas)

> Every schema below extends the common envelope from §2. The fields shown are the additional event-specific payload.

### 3.1 `moon_select` — primary moon camera diagnostic

Emitted from JS when `flyToBody` is invoked with a moon target. Captures both the input geometry and the output camera placement.

```json
{
  "event_type": "moon_select",
  "trigger": "tap_3d | dropdown | url_diag",
  "moon": {
    "name": "Triton",
    "host": "Neptune",
    "size_scene": 0.135,
    "config_period_days": -5.87685,
    "config_dist_param": 9.05,
    "current_world": {"x": 65.42, "y": 1.81, "z": -12.93},
    "current_world_mag": 67.29
  },
  "host": {
    "name": "Neptune",
    "size_scene": 1.04,
    "visualDist": 76.10,
    "current_world": {"x": 63.55, "y": 0.0, "z": -11.21}
  },
  "sun_world": {"x": 0, "y": 0, "z": 0},
  "sun_visual_radius": 2.5,
  "scene_aspect": 0.612,
  "viewport_w_css": 1185,
  "viewport_h_css": 1935,
  "dpr": 1.0,
  "moon_to_host": {"vec": {"x": -1.87, "y": -1.81, "z": 1.72}, "len": 3.13},
  "moon_to_sun":  {"vec": {"x": -65.42, "y": -1.81, "z": 12.93}, "len": 66.69},
  "moon_to_host_xz_norm": {"x": -0.74, "z": 0.68},
  "moon_to_sun_xz_norm":  {"x": -0.98, "z": 0.19},
  "dotHS_xz": 0.86,
  "bisector_len_xz": 1.74,
  "vertical_offset": 1.81,
  "vertical_threshold": 0.94,
  "case_resolved": "A | B | C",
  "subcase_resolved": "perpendicular | neg_bisector | pos_bisector | tilted_down | tilted_up",
  "camera_before": {
    "position": {"x":..., "y":..., "z":...},
    "target":   {"x":..., "y":..., "z":...},
    "up":       {"x":..., "y":..., "z":...},
    "fov_deg":  45,
    "aspect":   0.612
  },
  "camera_after": {
    "position": {"x":..., "y":..., "z":...},
    "target":   {"x":..., "y":..., "z":...},
    "up":       {"x":..., "y":..., "z":...},
    "fov_deg":  70,
    "aspect":   0.612,
    "cam_dist_from_moon": 3.06,
    "view_dir": {"x":..., "y":..., "z":...},
    "view_dir_dot_orbital_up": 0.02,
    "right_axis": {"x":..., "y":..., "z":...},
    "up_axis":    {"x":..., "y":..., "z":...}
  },
  "projections": {
    "moon":   {"ndc_x": 0.02, "ndc_y": -0.01, "depth": 3.06, "screen_radius_pct_halffov": 4.4},
    "host":   {"ndc_x": 0.94, "ndc_y": -0.18, "depth": 4.10, "screen_radius_pct_halffov": 30.1},
    "sun":    {"ndc_x": -0.97, "ndc_y": 0.05, "depth": 68.4, "screen_radius_pct_halffov": 5.3}
  },
  "acceptance_checks": {
    "moon_centred_within_5pct": true,
    "planet_half_visible": true,
    "sun_third_visible": false,
    "planet_sun_opposite_halves": true,
    "moon_not_obscured_by_planet": true
  },
  "warnings": ["sun_too_far_off_frame", "..."]
}
```

### 3.2 `moon_select_frames` — per-frame trace for N frames after a moon_select

To capture transitions, OrbitControls behaviour, and any post-jump correction. Triggered for 60 frames after every `moon_select` event.

```json
{
  "event_type": "moon_select_frames",
  "parent_correlation_id": "<from moon_select>",
  "frame_idx_since_select": 0..59,
  "camera_position": {...},
  "camera_target":   {...},
  "camera_quaternion": {"x":..., "y":..., "z":..., "w":...},
  "orbit_controls_target":   {...},
  "orbit_controls_distance": 3.06,
  "orbit_controls_polar_rad": 1.57,
  "orbit_controls_azimuth_rad": 0.0,
  "view_mode": "PLANET",
  "target_planet_name": "Triton",
  "frame_dt_ms": 16.7,
  "vsync_hint_dropped": false
}
```

### 3.3 `widget_render` — widget bitmap composition

Emitted from `SolarSystemWidgetWorker` and `WebViewBitmapRenderer` jointly. One event per render attempt; nested correlation across worker → renderer → composer stages.

```json
{
  "event_type": "widget_render",
  "stage": "worker_start | renderer_construct | js_snapshot_ready | compose_done | callback_returned",
  "widget_id": 58,
  "trigger_source": "options_changed | periodic_update | broadcast | configure_save | manual",
  "options_bundle": {
    "MIN_WIDTH_dp":  280,
    "MAX_WIDTH_dp":  580,
    "MIN_HEIGHT_dp": 280,
    "MAX_HEIGHT_dp": 920,
    "SIZES_list_sizef": [{"w":280,"h":580}, ...],
    "CATEGORY_keyguard": false
  },
  "display": {
    "orientation": "portrait | landscape",
    "density": 2.5,
    "screen_width_px": 2184,
    "screen_height_px": 1968,
    "device_state": "folded | unfolded | half_open"
  },
  "requested_dims_px": {"w": 1185, "h": 1935},
  "css_aspect": 0.612,
  "url_params": "?surface=widget&offsetY=0&tilt=0&labels=on&pluto=on",
  "shared_prefs_snapshot": {
    "pluto_hidden": false,
    "labels_enabled": true,
    "offsetY": 0.0,
    "tilt": 0.0
  },
  "render_timings_ms": {
    "worker_to_renderer": 12,
    "renderer_to_pageload": 187,
    "pageload_to_snapshot": 4123,
    "snapshot_to_compose":  84,
    "compose_to_callback":  3,
    "total_worker_to_callback": 4409
  },
  "scene_bitmap_dims_px": {"w": 1185, "h": 1935},
  "compose_meta": {
    "offsetY_meta": 0.0,
    "scene_css_h": 1935,
    "fullW_meta": 1185,
    "labels_count": 9,
    "draw_w_px": 1185,
    "draw_h_px": 1935,
    "draw_top_px": 0,
    "src_rect": [0,0,1185,1935],
    "dst_rect": [0,0,1185,1935]
  },
  "framing_diagnostics": {
    "visible_planets": ["Mercury", "Venus", ..., "Pluto"],
    "ring_samples_per_planet": 360,
    "max_screen_x_per_planet_signed": {
      "Mercury": {"min": -4.5, "max": 4.5},
      "Pluto":   {"min": -82.1, "max": 87.8}
    },
    "max_screen_y_per_planet_signed": {...},
    "surface_margin": 1.15,
    "required_dist_x": 380.4,
    "required_dist_y": 222.7,
    "required_dist_final": 380.4,
    "safety_net_fired": false,
    "safety_net_max_ndc_before": 0.873,
    "safety_net_k_applied": null,
    "camera_position_final": {...},
    "camera_up_final": {...}
  },
  "post_compose_centroid": {
    "x_pct": 0.25, "y_pct": -0.28,
    "L_pct": 90.5, "R_pct": 81.8, "T_pct": 52.8, "B_pct": 55.0,
    "ring_pixel_count": 28440
  },
  "dump_path": "files/diag/render_<ts>_1185x1935_widget.png",
  "errors": []
}
```

### 3.4 `wallpaper_render` — home / lock wallpaper composition

Same schema as `widget_render` plus:

```json
{
  "surface": "home | lock",
  "service_class": "SolarSystemHomeWallpaperService | SolarSystemLockWallpaperService",
  "engine_visible": true,
  "engine_preview": false,
  "engine_offset": {"x": 0.5, "y": 0.5},
  "surface_holder_dims_px": {"w": 2184, "h": 1968},
  "throttle_state": {
    "last_render_ts_ms": 0,
    "ms_since_last": 12345,
    "skipped_due_to_throttle": false
  },
  "lock_screen_shift_marker": {
    "previous_camera_position": {...},
    "previous_camera_target":   {...},
    "delta_x_scene": 0.0,
    "delta_y_scene": 0.0,
    "delta_z_scene": 0.0,
    "drift_detected_pct": 0.0
  }
}
```

### 3.5 `display_state_change` — DisplayManager + DeviceStateManager

Fired by `DisplayManager.DisplayListener` and `DeviceStateManager.DeviceStateCallback`.

```json
{
  "event_type": "display_state_change",
  "source": "DisplayListener.onDisplayChanged | DeviceStateCallback.onStateChanged | configChange",
  "display_id": 0,
  "display_name": "Built-in Screen",
  "display_state_int": 2,
  "display_state_str": "STATE_ON",
  "display_size_px": {"w": 1968, "h": 2184},
  "display_density_dpi": 420,
  "display_refresh_rate_hz": 120,
  "display_rotation_int": 0,
  "device_state_id": 0,
  "device_state_name": "CLOSED | HALF_OPENED | OPENED (manufacturer-specific)",
  "configuration": {
    "orientation": 1,
    "screen_layout_int": 0x...,
    "screen_width_dp": 280,
    "screen_height_dp": 580,
    "smallest_screen_width_dp": 280,
    "density_dpi": 420,
    "ui_mode": 0x...
  }
}
```

### 3.6 `screen_power` — screen on/off and user-present

```json
{
  "event_type": "screen_power",
  "action": "SCREEN_ON | SCREEN_OFF | USER_PRESENT",
  "keyguard_locked": true,
  "keyguard_secure": true,
  "power_save_mode": false,
  "thermal_status": 0
}
```

### 3.7 `lifecycle` — activity + service + WebView lifecycle

```json
{
  "event_type": "lifecycle",
  "component_class": "MainActivity | SolarSystemWidgetWorker | SolarSystemHomeWallpaperService | ...",
  "callback": "onCreate | onStart | onResume | onPause | onStop | onDestroy | onConfigurationChanged | onTrimMemory",
  "extras": {
    "saved_instance_state_size_bytes": 0,
    "intent_action": "android.intent.action.MAIN",
    "intent_categories": ["android.intent.category.LAUNCHER"],
    "intent_extras": {},
    "config_diff": ["orientation", "screenSize"],
    "trim_level_int": 60
  }
}
```

### 3.8 `webview_console` — capture JS console output

WebChromeClient.onConsoleMessage forwards every JS console line. Useful for catching JS errors in widget/wallpaper WebViews (which we can't open DevTools against).

```json
{
  "event_type": "webview_console",
  "webview_owner": "MainActivity | WebViewBitmapRenderer",
  "level": "DEBUG | LOG | WARNING | ERROR | TIP",
  "source_id": "https://appassets.androidplatform.net/assets/index.html",
  "line_number": 2245,
  "message": "[CAM] flyToBody isMoon=Triton case=A camDist=3.06 ..."
}
```

### 3.9 `memory_snapshot` — periodic + on every named event

```json
{
  "event_type": "memory_snapshot",
  "trigger": "periodic_10s | pre_moon_select | post_moon_select | pre_widget_render | post_widget_render | pre_wallpaper_render | post_wallpaper_render | onTrimMemory",
  "runtime": {
    "max_heap_bytes":   536870912,
    "total_heap_bytes": 312345600,
    "free_heap_bytes":  84321024,
    "used_heap_bytes":  228024576
  },
  "debug_memory_info": {
    "totalPss_kb": 312345,
    "totalPrivateDirty_kb": 211223,
    "totalSharedDirty_kb":  18034,
    "totalPrivateClean_kb": 12044,
    "totalSharedClean_kb":  41233,
    "totalSwappablePss_kb": 28811,
    "nativePss_kb": 134231,
    "dalvikPss_kb": 73402,
    "otherPss_kb":  104712,
    "summary_java_heap_kb": 73402,
    "summary_native_heap_kb": 134231,
    "summary_code_kb": 12321,
    "summary_stack_kb": 1024,
    "summary_graphics_kb": 41523,
    "summary_private_other_kb": 14242,
    "summary_system_kb": 35602,
    "summary_total_pss_kb": 312345,
    "summary_total_swap_pss_kb": 0
  },
  "activity_manager_memory_info": {
    "available_mem_bytes": 4123456789,
    "total_mem_bytes":     11811160064,
    "threshold_bytes":     268435456,
    "low_memory": false
  },
  "webview_native_heap_estimate_bytes": 87654321
}
```

### 3.10 `cpu_sample` — CPU usage sample

Reads `/proc/self/stat` and `/proc/self/task/<tid>/stat` for per-thread time.

```json
{
  "event_type": "cpu_sample",
  "sample_window_ms": 1000,
  "process_user_jiffies_delta": 23,
  "process_sys_jiffies_delta": 4,
  "threads": [
    {"tid": 12345, "name": "main", "user_jiffies_delta": 18, "sys_jiffies_delta": 1},
    {"tid": 12346, "name": "RenderThread", "user_jiffies_delta": 5, "sys_jiffies_delta": 2}
  ]
}
```

### 3.11 `gpu_info` — WebGL renderer info + draw call counter

Per-frame in main app (TRACE level, opt-in).

```json
{
  "event_type": "gpu_info",
  "trigger": "render_loop_tick | scene_construction_done | reset_view",
  "renderer_info": {
    "calls": 38,
    "triangles": 245678,
    "lines": 3892,
    "points": 0,
    "frame": 12435,
    "geometries": 64,
    "textures": 22,
    "programs": 18
  },
  "renderer_capabilities": {
    "max_anisotropy": 16,
    "precision": "highp",
    "max_texture_size": 16384,
    "max_combined_texture_image_units": 32
  },
  "scene": {
    "children_count": 78,
    "labels_visible_count": 8,
    "hidden_orbit_lines": 0
  }
}
```

### 3.12 `frame_trace` — per-frame timing (TRACE level)

Off by default. Enabled by `?trace=frames` URL param or `SlssLogger.enableTrace = true`.

```json
{
  "event_type": "frame_trace",
  "frame_idx": 12435,
  "render_dt_ms": 16.7,
  "animate_dt_ms": 14.2,
  "labels_dt_ms":   2.5,
  "view_mode": "PLANET",
  "target_planet": "Triton",
  "camera_pos_delta_since_last": 0.0,
  "camera_target_delta_since_last": 0.0,
  "raf_interval_ms": 16.66
}
```

### 3.13 `texture_load` — per-texture decode timing

```json
{
  "event_type": "texture_load",
  "key": "Pluto",
  "url": "textures/Pluto.jpg",
  "load_ms": 312,
  "success": true,
  "anisotropy_set": 16,
  "bytes_estimated": 2097152,
  "error": null
}
```

### 3.14 `touch_input` — touch coords around moon-select moments

Optional; off by default. Useful to confirm tap landed on intended planet vs nearby.

```json
{
  "event_type": "touch_input",
  "phase": "down | move | up",
  "x_css": 612.4,
  "y_css": 942.0,
  "hit_test_result": "Triton",
  "miss_distance_px": 12.4
}
```

### 3.15 `config_change` — Activity.onConfigurationChanged

```json
{
  "event_type": "config_change",
  "old_orientation": 1,
  "new_orientation": 2,
  "old_screen_width_dp": 280,
  "new_screen_width_dp": 580,
  "old_density_dpi": 420,
  "new_density_dpi": 420,
  "config_change_flags_handled": ["orientation", "screenSize", "screenLayout", "smallestScreenSize", "density"],
  "config_change_flags_not_handled": []
}
```

### 3.16 `fold_unfold` — synthetic event derived from display + device-state changes

When the display dimensions change in a manner consistent with a fold transition, emit a higher-level summary. Cross-correlate `display_state_change`, `screen_power`, and `config_change` to detect the transition.

```json
{
  "event_type": "fold_unfold",
  "direction": "fold | unfold",
  "previous_state": "OPENED",
  "new_state": "CLOSED",
  "previous_display_size_px": {"w": 2184, "h": 1968},
  "new_display_size_px": {"w": 1080, "h": 2316},
  "events_window_ms": 412,
  "child_events_correlated": ["display_state_change#1234", "config_change#1235", "screen_power#1236"]
}
```

### 3.17 `lock_shift_observation` — synthetic event for the lock-screen shift bug

Fires when the lock-wallpaper render is preceded by a screen_power=SCREEN_ON OR fold_unfold within the prior 2 seconds AND the bitmap centroid deviates from baseline by more than 5 % on either axis.

```json
{
  "event_type": "lock_shift_observation",
  "preceded_by": "screen_on | unfold | fold",
  "delay_ms": 187,
  "baseline_centroid_x_pct": 0.25,
  "baseline_centroid_y_pct": -0.27,
  "current_centroid_x_pct": 12.4,
  "current_centroid_y_pct": -0.3,
  "centroid_drift_x_pct": 12.15,
  "centroid_drift_y_pct": 0.03,
  "correction_observed_within_ms": 1800,
  "correction_centroid_x_pct": 0.31,
  "correction_centroid_y_pct": -0.29,
  "render_count_during_shift_window": 3,
  "engine_visible_during_window": [true, false, true],
  "surface_changed_during_window": false,
  "camera_position_during_window": [{...}, {...}, {...}]
}
```

### 3.18 `error` — any exception / promise rejection / null safety violation

```json
{
  "event_type": "error",
  "severity": "warn | error | fatal",
  "source": "kotlin | js | webview_renderer_process_gone | system",
  "message": "...",
  "stack": "...",
  "context": {
    "active_event_type": "moon_select",
    "active_correlation_id": "..."
  }
}
```

### 3.19 `dropped_events` — backpressure indicator

```json
{
  "event_type": "dropped_events",
  "count": 234,
  "since_ts_ms": 1748520000000,
  "until_ts_ms": 1748520001000
}
```

---

## 4. Per-area coverage map

### 4.1 Moon camera diagnosis

- On every `flyToBody` call where target is a moon:
  - PRE: `memory_snapshot{trigger:pre_moon_select}` + read camera state
  - Compute placement and CAPTURE `moon_select` event with full schema (3.1)
  - POST: `memory_snapshot{trigger:post_moon_select}`
  - Schedule a `moon_select_frames` trace for the next 60 frames
- Mirror to `webview_console` so we also see the data in `adb logcat`
- Add an in-JS sanity assertion that BEFORE setting `camera.position`, the algorithm's predicted projections match the camera's own projection matrix (validates the maths)

### 4.2 Widget orbit centring diagnosis

- On every `SolarSystemWidgetWorker.startWork`:
  - Emit `widget_render{stage:worker_start}` with full options bundle (including `OPTION_APPWIDGET_SIZES` list — never logged before)
  - Each subsequent stage emits another event with shared `correlation_id`
- Inside `WebViewBitmapRenderer.composeBitmap`:
  - Emit `widget_render{stage:compose_done}` with all compose-rect calculations
- Inside JS `calcResetView`:
  - Emit `widget_render{stage:framing_diagnostics_js}` via `window.SlssLog` with full per-planet projected extents (signed min/max separately, NOT just absolute — critical for diagnosing the L vs R asymmetry)
- After bitmap is on disk, run the in-process centroid measurement (port `tools/diag/measure-centroid.mjs` logic to Kotlin) and emit `widget_render{stage:post_compose_centroid}`

### 4.3 Lock-screen shift bug diagnosis

- Both wallpaper engines (`SolarSystemHomeWallpaperEngine`, `SolarSystemLockWallpaperEngine`) emit `wallpaper_render` events on every render
- Manifest-registered `BroadcastReceiver` for `ACTION_SCREEN_ON` / `ACTION_SCREEN_OFF` / `ACTION_USER_PRESENT` emits `screen_power`
- `DisplayManager.DisplayListener` + `DeviceStateManager.DeviceStateCallback` emit `display_state_change`
- Synthetic `fold_unfold` event correlates dimensional transitions
- Synthetic `lock_shift_observation` event fires post-hoc when a wallpaper render is preceded by `screen_on` or `fold_unfold` within 2 s AND centroid drift > 5 %
- Continue wallpaper engine running in the background to keep monitoring even when no render is needed (low-overhead poll every 5 s for centroid)

### 4.4 Fold/unfold coverage

- Already partially handled in Phase D (the `configChanges` manifest attribute keeps MainActivity alive). Logging adds:
  - `config_change` event with EVERY config flag delta
  - `display_state_change` events from `DisplayManager.DisplayListener`
  - `device_state_change` source from `DeviceStateManager.DeviceStateCallback` (Samsung's foldable state)
  - Synthetic `fold_unfold` summary with correlated child events

### 4.5 Main app

- `lifecycle` events on every Activity callback
- `frame_trace` on every animation frame (OPT-IN, off by default — flip on via `?trace=frames`)
- `gpu_info` every 60 frames + on viewMode transitions + on reset-view triggers
- `texture_load` for every texture decode
- `touch_input` around moon-select moments (last 5 touches buffered, flushed on a moon_select)

---

## 5. Extra dimensions

### Sensor data

- `SensorManager.getDefaultSensor(Sensor.TYPE_DEVICE_ORIENTATION)` — orientation transitions (correlates with fold/unfold motion)
- `Sensor.TYPE_HINGE_ANGLE` (API 30+, foldables) — hinge angle in degrees; logged whenever it changes by ≥ 5°. Emits `hinge_angle{angle_deg:135.2}`
- Optional: accelerometer for fold/unfold motion fingerprinting

### Network state (low priority)

- `ConnectivityManager.NetworkCallback` — only useful if texture loads fail; otherwise skip

### Battery / thermal

- `BatteryManager` — battery level, charging state on every periodic snapshot
- `PowerManager.ThermalStatus` — useful if performance throttling correlates with bug

### Locale / timezone

- Logged once at session start; emitted again on any `ACTION_TIMEZONE_CHANGED` broadcast
- Relevant because the app shows live planet positions; time/zone errors could explain off-positioning

### Process state

- `ActivityManager.getMyMemoryState(RunningAppProcessInfo)` — IMPORTANCE level (foreground, visible, perceptible, ...)
- Logged on every memory_snapshot

### Render correctness

- Per-frame: `THREE.WebGLRenderer.info.render.calls / triangles / lines`
- Capture the projection matrix as a 16-float array on every moon_select for offline reproducibility
- Capture the view matrix similarly

### Widget options reasonableness

- For widget renders, log Samsung One UI's `OPTION_APPWIDGET_SIZES` list verbatim. We have NEVER logged this before — the API has been a black box

---

## 6. Implementation files

### New Kotlin

- `app/src/main/java/com/livesolar/solarsystem/SolarSystemApplication.kt` — Application subclass, registers `SlssLogger`, broadcast receivers, display listeners
- `app/src/main/java/com/livesolar/solarsystem/diag/SlssLogger.kt` — core logger
- `app/src/main/java/com/livesolar/solarsystem/diag/SlssLoggerSinks.kt` — file + logcat + memory-buffer sinks
- `app/src/main/java/com/livesolar/solarsystem/diag/SlssLoggerLifecycleObservers.kt` — Application.ActivityLifecycleCallbacks, ComponentCallbacks2, DisplayManager.DisplayListener, DeviceStateManager.DeviceStateCallback wiring
- `app/src/main/java/com/livesolar/solarsystem/diag/SlssLoggerJsBridge.kt` — `@JavascriptInterface` for `window.SlssLog`
- `app/src/main/java/com/livesolar/solarsystem/diag/SlssScreenStateReceiver.kt` — `BroadcastReceiver` for `ACTION_SCREEN_ON / OFF / USER_PRESENT / TIMEZONE_CHANGED`
- `app/src/main/java/com/livesolar/solarsystem/diag/SlssCentroidProbe.kt` — Kotlin port of the centroid measurement so we can log centroid drift after every wallpaper render in-process
- `app/src/main/java/com/livesolar/solarsystem/diag/SlssSyntheticEventDetector.kt` — fires `fold_unfold` + `lock_shift_observation` synthetic events

### Modified Kotlin

- `app/src/main/AndroidManifest.xml` — add `android:name=".SolarSystemApplication"`, declare `SlssScreenStateReceiver`
- `app/src/main/java/com/livesolar/solarsystem/MainActivity.kt` — call `SlssLogger.lifecycle(...)` on each callback; install `WebChromeClient` that forwards `onConsoleMessage` to `webview_console`
- `app/src/main/java/com/livesolar/solarsystem/SolarSystemWidgetWorker.kt` — emit `widget_render{stage:worker_start}` and pass `correlation_id` to renderer
- `app/src/main/java/com/livesolar/solarsystem/WebViewBitmapRenderer.kt` — emit `widget_render{stage:renderer_construct / js_snapshot_ready / compose_done / callback_returned}`; install `WebChromeClient` for console forwarding inside the Presentation WebView too
- `app/src/main/java/com/livesolar/solarsystem/SolarSystemWallpaperService.kt` — emit `wallpaper_render`, monitor surface dimensions, run `SlssCentroidProbe` on each output bitmap

### New JS

- `app/src/main/assets/js/SlssLog.mjs` — thin JS wrapper that calls `window.SlssLog.event(...)` if present, otherwise no-op (so non-diagnostic builds are zero-cost)
- Hooks into `index.html` for `flyToBody`, `calcResetView`, `animate`, texture loader, touch handlers, WebGL renderer info

### New Node tooling

- `tools/diag/log-parse.mjs` — reads `slss_logs/*.jsonl(.gz)`, groups by `session_id` + `process` + `correlation_id`, produces:
  - Per-moon HTML/markdown report summarising every moon_select event
  - Per-widget-render report with side-by-side L/R/T/B charts
  - Lock-shift timeline visualisation
  - Memory + CPU charts over time
- `tools/diag/log-watch.mjs` — `adb logcat` mirror + JSONL pretty-printer for real-time monitoring
- `tools/diag/pull-logs.mjs` — wraps `adb shell run-as ... cat ...` for each rolled file, gunzip, concatenate, output structured directory under `docs/diag/`

---

## 7. Pull / export mechanisms

### ADB-based (primary, no UI required)

```bash
adb shell run-as com.livesolar.solarsystem.diag find files/slss_logs -type f \
  | while read f; do
      adb exec-out "run-as com.livesolar.solarsystem.diag cat $f" \
        > docs/diag/$(date -I)/$(basename "$f")
    done
```

Wrapped in `tools/diag/pull-logs.mjs`.

### In-app share button (secondary, for the user)

- Long-press the SLSS warning icon (existing UI element, no new widget needed) → triggers `SlssLogger.exportZip()`
- Builds a zip of all log files in `filesDir/slss_logs/` plus the last 200 rendered bitmaps in `filesDir/diag/`
- Launches `Intent.ACTION_SEND` with `EXTRA_STREAM` set to the zip (via `FileProvider`)
- User can share to Drive / email / save to Downloads / send to me

### Permissions

- `FileProvider` — declared in AndroidManifest, requires `<provider>` block with `android.support.FILE_PROVIDER_PATHS` resource
- No runtime permission grant required
- If the user prefers writing to public Downloads instead: API 30+ uses `MediaStore.Downloads` — handled via Storage Access Framework, no permission required

---

## 8. Performance budget

- Per-event cost: < 50 µs (JSON encode + queue append)
- Queue: lock-free `LinkedBlockingDeque` capacity 10 000
- Background writer thread: dedicated, priority `Process.THREAD_PRIORITY_BACKGROUND`
- File rotation: amortised — done on the same writer thread, not the main thread
- `memory_snapshot` periodic (10 s): adds ~ 5 ms per snapshot per process; 4 processes × every 10 s = 2 ms/s on average
- `frame_trace` per-frame: ~ 200 µs per frame at 60 FPS = 1.2 % overhead. OFF by default
- Expected log volume: 2-5 MB/h baseline, up to 50 MB/h with frame_trace and gpu_info enabled
- Z Fold 6/7 hardware can handle this comfortably

---

## 9. Cleanup checklist (to remember when this is no longer needed)

- Remove `app/src/main/java/com/livesolar/solarsystem/diag/` directory entirely
- Remove `app/src/main/assets/js/SlssLog.mjs` and all `import` references in `index.html`
- Remove `android:name=".SolarSystemApplication"` from manifest
- Remove `<receiver>` declarations for `SlssScreenStateReceiver`
- Remove `<provider>` declaration for the export FileProvider
- Revert MainActivity / WidgetWorker / WallpaperService instrumentation calls
- Remove `tools/diag/log-*.mjs` scripts
- Remove `docs/diag/2026-05-*/slss_logs*/` artefacts
- Git tag: `pre-logging-removal-<date>` before the cleanup commit so the diagnostic system is recoverable later if needed

Add a `// SLSS_DIAG_TEMPORARY` marker comment at the top of every added/modified file so `grep -r SLSS_DIAG_TEMPORARY` produces the full cleanup hit list.

---

## 10. Optional / stretch features

- **Real-time WebSocket sink** — `WebSocket(SlssLogger)` connecting to a small Node server on the user's laptop, streaming events live. Useful if I want to watch the log during a fold/unfold without pulling files between runs. Adds `INTERNET` permission (already granted).
- **Ongoing notification** — persistent foreground notification showing "SLSS diagnostic logging active, X events queued, Y MB written". Requires `POST_NOTIFICATIONS` runtime permission on API 33+.
- **Logcat capture trigger** — long-press warning icon → captures `adb logcat -d -b all` worth of logs via `Runtime.exec("logcat -d -b all")` and saves to `filesDir/slss_logs/logcat_<ts>.txt`. Requires no extra permission (logcat for own UID is allowed).
- **In-app browser viewer** — a hidden URL `/slss_log_viewer` that loads a JS-based viewer over recent events held in `MemoryBufferSink`. Lets me triage on-device without pulling.

---

## 11. Implementation phasing (not part of the temporary code, just a build order)

- Phase L0 (≈ 30 min): `SolarSystemApplication`, `SlssLogger`, `JsonlFileSink`, `LogcatMirrorSink`, basic envelope. Hello-world event from each process.
- Phase L1 (≈ 1 h): Lifecycle observers; `lifecycle`, `screen_power`, `display_state_change`, `config_change`, `fold_unfold` synthetic event.
- Phase L2 (≈ 2 h): JS bridge; `moon_select` end-to-end with full schema (3.1); `moon_select_frames` 60-frame trace.
- Phase L3 (≈ 2 h): Widget + wallpaper instrumentation; `widget_render`, `wallpaper_render`, `lock_shift_observation` synthetic event; in-process centroid probe.
- Phase L4 (≈ 1 h): Memory + CPU + GPU snapshots; `memory_snapshot`, `cpu_sample`, `gpu_info`, `texture_load`.
- Phase L5 (≈ 1 h): WebView console capture, touch_input, error event types.
- Phase L6 (≈ 1 h): Pull tooling (`tools/diag/pull-logs.mjs`, `tools/diag/log-parse.mjs`), in-app share button.
- Phase L7 (≈ 1 h): Sensor/battery/thermal extras, hinge angle.
- Phase L8 (optional): WebSocket sink, in-app viewer, notification, logcat capture.

Total: ~ 9 h of implementation work for Phases L0-L7, gated behind `BuildConfig.DEBUG`.

---

## 12. Open questions for the user before implementation

- Confirm: install location for the share-exported zip — Downloads folder, or push to a specific path I can pull via ADB?
- Confirm: WebSocket sink to laptop — yes/no? If yes, I'll need your laptop's IP on the same Wi-Fi as the phone.
- Confirm: hinge angle / sensor capture is wanted for fold-unfold timing diagnosis (or do you want me to skip and just rely on `display_state_change`)?
- Confirm: per-frame `frame_trace` should default OFF (currently planned) — the per-frame data is huge and only needed if the moon-select transitions need investigating?
- Confirm: lock-screen shift bug — has it occurred under particular conditions you remember (cold morning, after a particular app, after a specific app launch sequence)? Any clue would let me narrow the synthetic-event window from 2 s to something tighter.

---

## 13. Why this WILL help

- Every claim the moon-camera algorithm makes about where it placed the camera, what NDC the planet projects to, what zoom level it picked — written to a log I can read offline
- Every widget render reveals the actual `OPTION_APPWIDGET_SIZES` list Samsung's launcher provides — a black box until now
- Every wallpaper render captures the engine's `surfaceChanged` / `visibilityChanged` events plus a centroid measurement, so if the lock-screen shift happens once in twenty fold/unfold cycles, we'll have the data for THAT one
- Offline log analysis replaces 5-second user-facing iteration cycles with batch-scoped triage. I expect to identify the moon camera root cause within one or two log-collection rounds (vs. the ~10 rounds we've burned so far)
- Memory + CPU + GPU snapshots let us answer the Phase E performance questions in passing without a separate investigation

---

## 14. What this WILL NOT do

- Fix any of the bugs by itself — this is purely a measurement system
- Survive past the diagnostic phase — strictly temporary
- Affect production / Play-Store builds — gated by `BuildConfig.DEBUG`
- Slow the user's main usage perceptibly — the 1.2 % overhead at 60 FPS is hidden by GPU vsync

---

Ready to implement Phase L0-L7 once you've reviewed and signed off. Open questions in §12 — reply with answers and I'll execute the plan, then come back to the moon camera with a log harvest to inform the next fix.
