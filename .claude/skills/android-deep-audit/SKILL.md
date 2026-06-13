---
name: android-deep-audit
disable-model-invocation: true
description: >-
  Explicitly invoked via /android-deep-audit only; never auto-selected. A
  three-lens parallel optimisation audit of an Android project — a
  model-reasoning lens, a Context7-documentation lens, and a Superpowers-
  methodology lens each write full findings to their own file; the session then
  cross-examines those files directly, resolves conflicts, and applies only
  changes that survive an adversarial preservation gate, all tracked by a
  multi-level checklist. Objective: code minimisation — footprint, battery,
  memory, CPU, storage, and app-store-acceptance.
---

# Android Deep Audit

## Overview

A disciplined, multi-lens optimisation audit for an Android project. The objective is **code minimisation** — minimal footprint, faster execution, reduced battery/memory/CPU/storage drain, and maximal app-store-acceptance likelihood — executed through three independent audit lenses, a direct cross-examination of their written findings, autonomous conflict resolution, and a mandatory adversarial preservation gate before any change is applied. Every phase is tracked by a checklist that forbids deferral.

**Core principle:** Accuracy, depth, and breadth over speed and token consumption. Minimisation is the goal; preservation is a verification gate the goal must pass through, not a competing objective.

This skill drives the **active session** (the main agent) — not a subagent. Follow it directly.

---

## Phase 0 — Scope determination (FIRST action)

Before anything else:

- If the invoking prompt **already specified** scope, use it.
- Otherwise **ask** exactly: *"Audit the entire codebase, or only changes since the last commit?"* **Do not proceed until answered.**

Then route:

- **Entire** → **chunked traversal.** Segment the codebase into batches each sized to remain within a subagent's context limit. Track every batch as a checklist item. No batch is skipped.
- **Recent changes** → restrict the audit to the **diff against the last commit** PLUS the **immediate dependency surface of changed symbols** (callers/callees and types directly touching each changed symbol — one hop, not a transitive sweep).

---

## Phase 1 — Checklist enforcement (the spine)

Create `.audit_checklist.md` with **multi-level checkboxes** at three granularities:

- **File** — every in-scope file.
- **Component** — logical units (a service, a renderer, a screen, a worker, a module).
- **Architectural layer** — UI, domain/logic, data, platform/host, build.

Rules (non-negotiable):

- **Read `.audit_checklist.md` before every new action.**
- **No task may be deferred or skipped.** (Banned: "deferred", "later", "follow-up", "TODO", "for now".)
- A checkbox is marked complete **only after its verification is fully executed** — not when work is merely started or planned.
- The following are themselves explicit checklist items, in order: scope determination · tooling preconditions · each traversal batch (if entire) · the three independent audits · the cross-examination pass · the conflict-resolution pass · the per-candidate preservation gate · execution · cleanup.

If scope is "entire," the batch list lives in the checklist and each batch is checked off only when all three lenses have covered it.

---

## Phase 2 — Tooling preconditions

- **Detect** Context7 (MCP) and Superpowers in the project/environment.
- **Install any not present.** Do not proceed to the lenses until both are available.
- **Confirm Context7 is connected to the main session** so subagents inherit it. Subagents inherit the main conversation's MCP tools **only when their `tools` field is omitted** (or left unrestricted).
- **Do NOT restrict the subagents' `tools` field** in any way that strips inherited MCP access. The Context7 lens cannot function without it.

---

## Phase 3 — Three parallel subagents (heterogeneous by design)

These are **not three identical auditors.** They are three distinct lenses. **Spawn them in parallel** (issue all three Agent/Task calls in a single message). Each subagent writes its **complete findings — full reasoning, not a compressed summary — to its own file**:

| Lens | File | Mandate |
|------|------|---------|
| **1 — Reasoning** | `.audit_findings_reasoning.md` | Audit the in-scope code using **model reasoning alone**. Identify correctness defects, inefficiency, redundancy, excess footprint, and hardware-drain sources. |
| **2 — Context7** | `.audit_findings_context7.md` | For **every third-party library and Android/Jetpack API the in-scope code imports**, query Context7 for **version-accurate** documentation and verify usage against current APIs. Flag deprecated calls, misuse, version-mismatched patterns, and API-level inefficiencies. *Context7 supplies the documentation; the subagent performs the reasoning over it.* |
| **3 — Superpowers** | `.audit_findings_superpowers.md` | Apply the **Superpowers verification and planning methodology** as a disciplined structured-review pass over the in-scope code, producing findings under that methodology. |

Each subagent prompt must: state its lens and file; pass the resolved scope (batch list or changed-file set + dependency surface); carry the mandatory analytical targets (Phase 4); carry the preservation-gate framing (Phase 5) so each finding is pre-annotated with its bug-defence hypothesis; and instruct full reasoning, not a summary. Omit the `tools` field so MCP access is inherited.

---

## Phase 4 — Mandatory analytical targets (all three lenses)

Prioritise **accuracy, depth, and breadth over speed and token consumption.** Optimise toward minimal code footprint, faster execution, and reduced battery, memory, CPU, and storage drain, plus maximal app-store-acceptance likelihood.

Explicitly assess, **at minimum**:

- **Kotlin coroutine dispatcher selection and efficiency** (Main/IO/Default correctness, blocking on the wrong dispatcher, dispatcher thrash).
- **Jetpack Compose recomposition scope and unnecessary-recomposition metrics** (unstable params, missing keys, reads that widen recomposition scope).
- **Media codec hardware-acceleration usage** (hardware vs software codecs, formats, surface paths).
- **Memory allocation and leak surfaces** (per-frame/hot-loop allocation, retained contexts, listener/receiver/lifecycle leaks).
- **Wakelock and background-work power cost** (wakelocks, alarms, WorkManager/JobScheduler cadence, foreground-service cost).
- **APK/AAB size contributors** (oversized assets, duplicated resources, unused dependencies, uncompressed/uncompressible payloads).

Analyse **depth, breadth, impact, and interdependence between elements** — not isolated line-level findings. A finding about one element must state how it interacts with the others.

---

## Phase 5 — Preservation as a verification gate (not a competing objective)

The objective is minimisation. **However**, before any code is removed or adjusted, each candidate change must pass a deliberate **adversarial second-pass re-examination** that assumes the apparently-removable, inefficient, orphaned, or redundant code **may be an intentional, subtle fix for a prior bug.**

For each candidate, state explicitly:

- **why it is genuinely safe to change**, and
- **what previous condition the existing code might be defending against**, and
- **why that condition cannot occur.**

Use git history (`git log -S`, `git log --follow -p`, commit messages) and in-code comments as evidence of original intent wherever available.

**A candidate that does not survive this re-examination is left untouched.**

This step exists because first-pass analysis has historically mis-flagged necessary code as removable and reversed only after challenge. **Perform the challenge proactively, rather than waiting for it.**

---

## Phase 6 — Cross-examination (autonomous)

After all three findings files are written:

- **Read the three files directly** (`.audit_findings_reasoning.md`, `.audit_findings_context7.md`, `.audit_findings_superpowers.md`) — **not** the subagents' returned summaries.
- Cross-examine and compare to **refine results**, **surface omissions one lens caught and others missed**, and **eliminate errors**.

---

## Phase 7 — Conflict resolution (autonomous)

Where the three lenses disagree:

- Apply **deep model reasoning to the discrepancy**, prioritising **accuracy over speed**, to determine the correct resolution.
- **Record the resolution and its justification** (append to the cross-examination notes or the checklist).

---

## Phase 8 — Execution

- Apply **only** the changes that survive **both** the preservation gate (Phase 5) **and** conflict resolution (Phase 7).
- **Complete all operations within this invocation.** Minimise manual review checkpoints.
- Verify each applied change (build/compile/tests where available) before checking its item complete.

---

## Phase 9 — Cleanup

- When **every** `.audit_checklist.md` item is checked, **delete** `.audit_checklist.md` and the three findings files (`.audit_findings_reasoning.md`, `.audit_findings_context7.md`, `.audit_findings_superpowers.md`).
- Do not delete them earlier — they are the working record until the audit is fully applied.

---

## Red flags — STOP

- About to spawn the three subagents sequentially instead of in one parallel message → STOP; spawn in parallel.
- About to restrict a subagent's `tools` field → STOP; the Context7 lens loses MCP access.
- About to read a subagent's returned summary instead of its findings file → STOP; read the file directly.
- About to remove "obviously dead/redundant" code without writing its bug-defence hypothesis → STOP; run the preservation gate.
- About to mark a checkbox complete before its verification ran → STOP; verification first.
- About to defer/skip any in-scope item → STOP; there is no deferral.
