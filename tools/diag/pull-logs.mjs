#!/usr/bin/env node
// SLSS_DIAG_TEMPORARY — pull diagnostic logs off the device via ADB.
// Streams each file with `adb exec-out run-as <pkg> cat ...` (binary-safe,
// avoids the PowerShell `>` corruption), gunzips rolled .gz files, and writes
// everything under docs/diag/<date>/<serial>/. Part of the temporary
// diagnostic system — delete with tools/diag/ when done.
//
// Usage:
//   node tools/diag/pull-logs.mjs [--serial <id>] [--pkg <id>] [--out <dir>]
// Defaults: pkg=com.livesolar.solarsystem.diag, out=docs/diag/<YYYY-MM-DD>

import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function adbPath() {
  if (process.env.ADB) return process.env.ADB;
  const local = process.env.LOCALAPPDATA;
  if (local) return path.join(local, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
  return 'adb';
}

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { pkg: 'com.livesolar.solarsystem.diag', serial: null, out: null };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--serial') o.serial = a[++i];
    else if (a[i] === '--pkg') o.pkg = a[++i];
    else if (a[i] === '--out') o.out = a[++i];
  }
  if (!o.out) {
    const d = new Date().toISOString().slice(0, 10);
    o.out = path.join('docs', 'diag', d);
  }
  return o;
}

const ADB = adbPath();
const opts = parseArgs();

function adbArgs(rest) {
  return opts.serial ? ['-s', opts.serial, ...rest] : rest;
}

// exec-out returns a Buffer (binary-safe). run-as runs as the debuggable app uid.
function runAsCat(remotePath) {
  return execFileSync(ADB, adbArgs(['exec-out', `run-as ${opts.pkg} cat ${remotePath}`]), {
    maxBuffer: 256 * 1024 * 1024
  });
}

function listFiles(remoteDir) {
  try {
    const out = execFileSync(
      ADB,
      adbArgs(['exec-out', `run-as ${opts.pkg} sh -c 'ls -1 ${remoteDir} 2>/dev/null'`]),
      { encoding: 'utf8' }
    );
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

function main() {
  console.log(`adb: ${ADB}`);
  console.log(`pkg: ${opts.pkg}  serial: ${opts.serial || '(default)'}`);
  const serialDir = opts.serial || 'device';
  const outDir = path.join(opts.out, serialDir);
  mkdirSync(outDir, { recursive: true });

  const remoteDir = 'files/slss_logs';
  const files = listFiles(remoteDir);
  if (files.length === 0) {
    console.error(`No files found in ${remoteDir}. Is the diagnostic build installed and run at least once?`);
    process.exit(2);
  }

  let pulled = 0;
  for (const f of files) {
    try {
      const buf = runAsCat(`${remoteDir}/${f}`);
      if (f.endsWith('.gz')) {
        const raw = gunzipSync(buf);
        const outName = f.replace(/\.gz$/, '');
        writeFileSync(path.join(outDir, outName), raw);
        console.log(`  ${f} -> ${outName} (gunzipped ${buf.length} -> ${raw.length} bytes)`);
      } else {
        writeFileSync(path.join(outDir, f), buf);
        console.log(`  ${f} (${buf.length} bytes)`);
      }
      pulled++;
    } catch (e) {
      console.error(`  FAILED ${f}: ${e.message}`);
    }
  }

  // Also pull the rendered PNG dumps (filesDir/diag) if present.
  const diagFiles = listFiles('files/diag');
  if (diagFiles.length) {
    const diagOut = path.join(outDir, 'render_dumps');
    mkdirSync(diagOut, { recursive: true });
    for (const f of diagFiles) {
      try {
        const buf = runAsCat(`files/diag/${f}`);
        writeFileSync(path.join(diagOut, f), buf);
        pulled++;
      } catch (e) {
        console.error(`  FAILED diag/${f}: ${e.message}`);
      }
    }
    console.log(`  + ${diagFiles.length} render dumps -> render_dumps/`);
  }

  console.log(`\nPulled ${pulled} file(s) to ${outDir}`);
  console.log(`Parse with: node tools/diag/log-parse.mjs ${outDir}`);
}

main();
