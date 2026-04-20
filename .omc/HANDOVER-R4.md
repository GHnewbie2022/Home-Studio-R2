# Handover: R4-0 DONE → R4-1~R4-5 entry

**Branch**: `r3-light`
**Status**: R3-0 ~ R3-7 ✅, R4-0 ✅. R4-1 ~ R4-5 pending SOP expansion.
**Next task**: `/ralplan` to reach consensus on R4-1 ~ R4-5 full SOP bodies, then user decides execution path.

---

## Completed commits on this branch (latest → oldest)

| Commit | Scope |
|---|---|
| `a9c0fe6` | R4-0 revision — cavity-panel + post-panel removed from scope; color control reclassified as the sole 美學預覽 item |
| `97f70de` | R4-0 old-project UI inventory (tables + integration strategy + lil-gui assumption correction) |
| `deb2c99` | R4 entry cleanup — R5 SOP deleted, R3-8 chapter stripped, R4 SOP expanded to R4-0 ~ R4-5 skeleton |
| `d2a6544` | R3-7 DONE (prior stage, reference) |

## Pre-reads (in order)

1. `docs/SOP/Debug_Log.md` — universal debug discipline (never skip)
2. `docs/SOP/（先讀大綱.md` — stage overview, current ✅ / ⬜ snapshot
3. `docs/SOP/R4：UI控制層.md` — R4 SOP with R4-0 inventory table, integration strategy, and R4-1 ~ R4-5 skeletons (one-line goals, bodies still pending)
4. `CLAUDE.md` + `AGENTS.md` — project-level conventions

## Step 3 — R4-1 ~ R4-5 full SOP expansion (pending user trigger)

1. User runs `/ralplan` to get Planner + Architect + Critic consensus on each of R4-1 ~ R4-5.
2. Areas expected to carry real risk surface (worth pushing in ralplan):
   - **R4-1** — how to strip the existing lil-gui cleanly without breaking shader uniform dispatch, while HTML panel skeleton is built in parallel (switchover cutover point).
   - **R4-2** — scaffold removal order matters: `uR3MisEnabled` / `uR3DynamicPoolEnabled` dead-branch deletion in GLSL requires shader recompile verification at each step.
   - **R4-3** — integration style for new R3 controls (CONFIG 1/2/3, per-light color temperature radios, lumens sliders) into the old HTML layout; radio button group visual glow mapping (warm/neutral/cold).
   - **R4-4** — R3-5a sweet-spot UI crosses shader geometry + JS uniforms + HTML sliders; highest coupling.
   - **R4-5** — reset / listen-bound / hotkeys mostly low-risk polish.
3. After ralplan consensus, user picks execution path (likely `/ultrawork` or direct executor per phase).

## Constraints / non-negotiables

- **No R4-6.** User verifies UX directly; no A/B screenshot phase.
- **Wabi-sabi is not the design goal** — ignore any prior Gemini-era framing; the directive is 1:1 old-project replication, new R3 controls styled consistently with the old layout.
- **Old project does not use lil-gui.** It's hand-rolled HTML + inline CSS + inline JS with `createS(...)` factory. R4-1 ports the HTML panel skeleton, CSS, and `createS` factory; the current main-project lil-gui implementation is discarded whole.
- **R4-0 removal decisions (2026-04-20, user):**
  - `#cavity-panel` removed — GIK 244 is composite-type; cavity pulls cancel between porous/resonant modes, no net benefit for procurement evaluation.
  - `#post-panel` removed — R3 physics-correct pipeline makes post layer unnecessary; keeping it would slide output back to "pretty screenshot" rather than faithful model.
  - 吸音板色控 kept as the only "美學預覽" item (Dimi Music sells white GIK only).
- **No cache-buster bump** for doc-only commits.
- **CONFIG 3 path-tracing noise** is deferred to a later denoising stage, not R4.
- **uLegacyGain = 1.5** stays a framework-compensation uniform, not UI-exposed.

## R4 sub-phase skeleton (one-liner reminder; full bodies are Step 3 output)

| Phase | Goal |
|---|---|
| R4-1 | HTML panel skeleton port (3 panels after removals) + CSS + `createS` factory; drop lil-gui |
| R4-2 | Scaffold removal — strip R3-6 MIS checkbox + R3-6.5 dynamic-pool checkbox / N-display; hardcode `uR3MisEnabled = 1.0` and `uR3DynamicPoolEnabled = 1.0`; delete dead else-branches |
| R4-3 | Merge retained R3 controls: CONFIG 1/2/3 switch, per-light color-temp radios, lumens sliders (Cloud / Track / Wide), GIK color control |
| R4-4 | R3-5a sweet-spot UI — 4 sliders (lamp tilt / beam angle / track-to-GIK distance / same-side lamp spacing) spanning shader + JS uniforms + GUI |
| R4-5 | Interaction polish (reset, listen-bound values, hotkeys if needed) |
