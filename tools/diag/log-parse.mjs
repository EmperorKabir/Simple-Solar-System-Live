#!/usr/bin/env node
// SLSS_DIAG_TEMPORARY — parse + summarise pulled diagnostic logs.
// Reads slss_logs/*.jsonl(.gz) in a directory, groups by session + process +
// correlation_id, and prints focused reports for the three investigations:
//   1. moon_select  — predicted vs ACTUAL framing per moon (+ acceptance)
//   2. widget framing_diagnostics_js — SIGNED per-planet L/R/T/B extents
//   3. lock_shift_observation — drift timeline
// Plus a memory/CPU summary. Part of the temporary diagnostic system.
//
// Usage: node tools/diag/log-parse.mjs <dir-or-file> [more...]

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';

function* walk(p) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) yield* walk(path.join(p, e));
  } else if (p.endsWith('.jsonl') || p.endsWith('.jsonl.gz')) {
    yield p;
  }
}

function loadEvents(targets) {
  const events = [];
  for (const t of targets) {
    for (const f of walk(t)) {
      let text;
      try {
        const buf = readFileSync(f);
        text = f.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
      } catch (e) {
        console.error(`skip ${f}: ${e.message}`);
        continue;
      }
      for (const line of text.split('\n')) {
        const s = line.trim();
        if (!s) continue;
        try {
          events.push(JSON.parse(s));
        } catch (_) {
          /* tolerate a torn final line */
        }
      }
    }
  }
  events.sort((a, b) => (a.ts_mono_ns || 0) - (b.ts_mono_ns || 0));
  return events;
}

const fmt = (n, d = 2) => (typeof n === 'number' ? n.toFixed(d) : String(n));

function reportMoon(events) {
  const selects = events.filter((e) => e.event_type === 'moon_select');
  if (!selects.length) return;
  console.log('\n=== MOON CAMERA ===');
  for (const s of selects) {
    const corr = s.correlation_id;
    const frames = events.filter((e) => e.event_type === 'moon_select_frames' && e.parent_correlation_id === corr);
    const last = frames[frames.length - 1];
    console.log(`\n• ${s.moon?.name} (host ${s.moon?.host})  case=${s.case_resolved}/${s.subcase_resolved}  aspect=${fmt(s.scene_aspect, 3)}`);
    const pp = s.predicted_projections || {};
    console.log(`  predicted screen_x  moon=${fmt(pp.moon?.screen_x)} host=${fmt(pp.host?.screen_x)} sun=${fmt(pp.sun?.screen_x)}`);
    if (last) {
      console.log(`  ACTUAL ndc_x (f${last.frame_idx_since_select}) moon=${fmt(last.proj_moon?.ndc_x)} host=${fmt(last.proj_host?.ndc_x)} sun=${fmt(last.proj_sun?.ndc_x)}`);
      console.log(`  ACTUAL ndc_y          moon=${fmt(last.proj_moon?.ndc_y)} host=${fmt(last.proj_host?.ndc_y)} sun=${fmt(last.proj_sun?.ndc_y)}`);
    }
    const ac = s.acceptance_checks || {};
    console.log(`  acceptance: moonCentred=${ac.moon_centred_within_5pct} planetVisible=${ac.planet_visible} sunVisible=${ac.sun_visible} oppositeHalves=${ac.planet_sun_opposite_halves}`);
    if (s.warnings?.length) console.log(`  warnings: ${s.warnings.join(', ')}`);
    console.log(`  frames captured: ${frames.length}`);
  }
}

function reportMoonSettled(events) {
  const s = events.filter((e) => e.event_type === 'moon_view_settled');
  if (!s.length) return;
  console.log('\n=== MOON VIEW SETTLED (user hand-tuned framing targets) ===');
  // Group by moon; show the LAST settled view per moon (the chosen target).
  const byMoon = {};
  for (const e of s) {
    const key = `${e.moon}@${fmt(e.scene_aspect, 2)}`;
    (byMoon[key] = byMoon[key] || []).push(e);
  }
  for (const key of Object.keys(byMoon)) {
    const g = byMoon[key];
    const last = g[g.length - 1];
    const m = last.proj_moon || {}, h = last.proj_host || {}, su = last.proj_sun || {};
    console.log(`\n• ${key}  (${g.length} adjustments, showing final)`);
    console.log(`  zoom(orbit_distance)=${fmt(last.orbit_distance)} polar=${fmt(last.orbit_polar_rad)} azimuth=${fmt(last.orbit_azimuth_rad)}`);
    console.log(`  final NDC: moon=[${fmt(m.ndc_x)},${fmt(m.ndc_y)}] host=[${fmt(h.ndc_x)},${fmt(h.ndc_y)}] sun=[${fmt(su.ndc_x)},${fmt(su.ndc_y)}]`);
  }
}

function reportWidgetFraming(events) {
  const fr = events.filter((e) => e.event_type === 'widget_render' && e.stage === 'framing_diagnostics_js');
  if (!fr.length) return;
  console.log('\n=== WIDGET / WALLPAPER FRAMING (signed NDC per planet) ===');
  for (const f of fr) {
    console.log(`\n• surface=${f.surface} aspect=${fmt(f.camera_aspect, 3)} reqDist x=${fmt(f.required_dist_x)} y=${fmt(f.required_dist_y)} final=${fmt(f.required_dist_final)} safetyNet=${f.safety_net_fired}`);
    const nx = f.per_planet_ndc_x_signed || {};
    const ny = f.per_planet_ndc_y_signed || {};
    console.log('  planet        ndc_x[min..max]      ndc_y[min..max]     L/R asym');
    for (const name of f.visible_planets || []) {
      const x = nx[name] || {}, y = ny[name] || {};
      const asym = (Math.abs(x.min ?? 0) - Math.abs(x.max ?? 0));
      console.log(`  ${name.padEnd(12)} [${fmt(x.min)}..${fmt(x.max)}]   [${fmt(y.min)}..${fmt(y.max)}]   ${fmt(asym)}`);
    }
  }
  // Render centroid summary (Kotlin probe).
  const cen = events.filter((e) => (e.event_type === 'widget_render' || e.event_type === 'wallpaper_render') && e.stage === 'post_compose_centroid' && e.post_compose_centroid);
  if (cen.length) {
    console.log('\n  -- post-compose centroid (Kotlin probe) --');
    for (const c of cen) {
      const p = c.post_compose_centroid;
      console.log(`  ${c.surface} ${p.bitmap_w}x${p.bitmap_h} off_x=${fmt(p.x_pct)}% off_y=${fmt(p.y_pct)}% L=${fmt(p.L_pct, 1)} R=${fmt(p.R_pct, 1)} T=${fmt(p.T_pct, 1)} B=${fmt(p.B_pct, 1)}`);
    }
  }
}

function reportLockShift(events) {
  const ls = events.filter((e) => e.event_type === 'lock_shift_observation');
  const fu = events.filter((e) => e.event_type === 'fold_unfold');
  if (!ls.length && !fu.length) return;
  console.log('\n=== LOCK-SHIFT / FOLD ===');
  for (const f of fu) {
    console.log(`  fold_unfold ${f.direction}  ${JSON.stringify(f.previous_display_size_px)} -> ${JSON.stringify(f.new_display_size_px)}  hinge=${f.hinge_angle_deg}`);
  }
  for (const s of ls) {
    console.log(`  ! lock_shift ${s.surface} precededBy=${(s.preceded_by || []).join('/')} driftX=${fmt(s.centroid_drift_x_pct)}% driftY=${fmt(s.centroid_drift_y_pct)}% (base ${fmt(s.baseline_centroid_x_pct)},${fmt(s.baseline_centroid_y_pct)} -> ${fmt(s.current_centroid_x_pct)},${fmt(s.current_centroid_y_pct)})`);
  }
}

function reportPerf(events) {
  const mem = events.filter((e) => e.event_type === 'memory_snapshot');
  const cpu = events.filter((e) => e.event_type === 'cpu_sample');
  if (!mem.length && !cpu.length) return;
  console.log('\n=== PERF ===');
  if (mem.length) {
    const pss = mem.map((m) => m.debug_memory_info?.total_pss_kb).filter((v) => typeof v === 'number');
    const used = mem.map((m) => m.runtime?.used_heap_bytes).filter((v) => typeof v === 'number');
    if (pss.length) console.log(`  total_pss_kb: min=${Math.min(...pss)} max=${Math.max(...pss)} last=${pss[pss.length - 1]}`);
    if (used.length) console.log(`  used_heap_mb: min=${fmt(Math.min(...used) / 1048576)} max=${fmt(Math.max(...used) / 1048576)} last=${fmt(used[used.length - 1] / 1048576)}`);
    const lowmem = mem.filter((m) => m.activity_manager_memory_info?.low_memory);
    if (lowmem.length) console.log(`  !! low_memory flagged ${lowmem.length} time(s)`);
  }
  if (cpu.length) {
    const proc = cpu.map((c) => c.process_jiffies_delta).filter((v) => typeof v === 'number');
    if (proc.length) console.log(`  process_jiffies/sample: min=${Math.min(...proc)} max=${Math.max(...proc)}`);
  }
  // frame_trace dt distribution
  const ft = events.filter((e) => e.event_type === 'frame_trace' && typeof e.render_dt_ms === 'number' && e.render_dt_ms > 0);
  if (ft.length) {
    const dts = ft.map((e) => e.render_dt_ms).sort((a, b) => a - b);
    const pct = (p) => dts[Math.min(dts.length - 1, Math.floor(p * dts.length))];
    console.log(`  frame_dt_ms: n=${dts.length} p50=${fmt(pct(0.5))} p95=${fmt(pct(0.95))} max=${fmt(dts[dts.length - 1])}`);
  }
}

function main() {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.error('usage: log-parse.mjs <dir-or-file> [more...]');
    process.exit(1);
  }
  const events = loadEvents(targets);
  const byType = {};
  for (const e of events) byType[e.event_type] = (byType[e.event_type] || 0) + 1;
  const sessions = [...new Set(events.map((e) => e.session_id))];
  console.log(`Loaded ${events.length} events across ${sessions.length} session(s): ${sessions.join(', ')}`);
  console.log('Event counts:');
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(7)}  ${k}`);
  }
  const errors = events.filter((e) => e.event_type === 'error');
  if (errors.length) {
    console.log(`\n=== ERRORS (${errors.length}) ===`);
    for (const e of errors.slice(0, 20)) console.log(`  [${e.severity}/${e.source}] ${e.message}`);
  }
  reportMoon(events);
  reportMoonSettled(events);
  reportWidgetFraming(events);
  reportLockShift(events);
  reportPerf(events);
}

main();
