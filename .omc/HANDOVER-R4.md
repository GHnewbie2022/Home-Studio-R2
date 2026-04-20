# Handover: R4-1 ✅ → R4-2 execution entry

**Branch**: `r3-light`
**Status**: R3-0 ~ R3-7 ✅, R4-0 ✅, R4-1 ✅ (2026-04-21).
**Next task**: R4-2 鷹架移除（12 處 shader 分支扁平化 + sampleStochasticLight11 刪除 + 3 uniform 移除）

---

## R4-1 completion summary

### What was done
- CSS: ~180 lines of panel UI styles ported from old project (css/default.css)
- HTML: lil-gui removed; `#ui-container` with 3 panel-groups (⚙️光追設定 / 🔲材質設定 / 💡燈光設定) + cam buttons + help/hide + loading-screen + snapshot-bar
- JS: `createS` factory with meta+click reset; 5 DOM adapters (setSliderValue, getSliderValue, setSliderEnabled, setSliderLabel, setCheckboxChecked); `initUI()` replaces `setupGUI()`
- InitCommon.js: `gui = new GUI()` removed; pixel_Resolution ported to createS; pointer-lock events rebound to `#ui-container`
- lil-gui.module.min.js deleted

### User verification fixes (fix01-fix06)
- fix01: CSS cache-buster (panels invisible without it)
- fix02: InitCommon.js cache-buster (Stats.js still showing)
- fix03: Button group toggle handlers added
- fix04: Hide UI + info-panel cleanup + slider defaults aligned to shader uniforms
- fix05: Hide button stays visible; camera buttons pointer-lock guard; button glow matches old project
- fix06: Color temperature glow (orange/blue/gradient per old project); "南北側燈光"→"廣角燈" rename; per-side wide emission zeroing via syncWideEmissions(); panel max-height reduced to avoid snapshot overlap

### Known R4-3 scope items
- Wide track per-side mesh (housing) visibility needs shader-level separate uniforms
- Slider callbacks are wakeRender shells (R4-3 wires real logic)
- GIK preset buttons set block colors but don't update shader uniforms yet

---

## Completed commits on this branch (latest → oldest)

| Commit | Scope |
|---|---|
| *(pending)* | R4-1 DONE: UI skeleton + CSS + createS + DOM adapters + lil-gui removal + fix01-fix06 |
| `4eb2187` | R4-0 HANDOVER update |
| `a9c0fe6` | R4-0 revision — cavity-panel + post-panel removed |
| `97f70de` | R4-0 old-project UI inventory |
| `deb2c99` | R4 entry cleanup |
| `d2a6544` | R3-7 DONE |

## Pre-reads (in order)

1. `docs/SOP/Debug_Log.md` — universal debug discipline (never skip)
2. `docs/SOP/（先讀大綱.md` — stage overview, current ✅ / ⬜ snapshot
3. `docs/SOP/R4：UI控制層.md` — fully expanded SOP with R4-1~R4-5 detailed bodies
4. `CLAUDE.md` — project-level conventions

## Ralplan consensus decisions (2026-04-20, Planner+Architect+Critic 2 iterations)

1. **Option A — atomic switch**: R4-1 ports HTML skeleton + CSS + createS factory in one commit; lil-gui removed simultaneously.
2. **Photometric beam model**: R4-4 beam angle sliders affect brightness. `computeTrackRadiance` activates `beamFullDeg` parameter.
3. **BVH two-tier update**: beam/tilt/emission = instant uniform-only; spacing/distance = sceneBoxes mutation → 200ms debounce → `buildSceneBVH()`.
4. **InitCommon.js in R4-1 scope**: `gui = new GUI()` removed, pixel_Resolution ported to createS, pointer-lock rebound.
5. **DOM adapters replace lil-gui API**: setSliderValue / getSliderValue / setSliderEnabled / setSliderLabel / setCheckboxChecked.

## Constraints / non-negotiables

- **No R4-6.** User verifies UX directly; no A/B screenshot phase.
- **1:1 old-project replication** — not wabi-sabi.
- **R4-0 removal decisions**: `#cavity-panel` removed, `#post-panel` removed.
- **No cache-buster bump** for doc-only commits.
- **CONFIG 3 path-tracing noise** deferred to later denoising stage.
- **uLegacyGain = 1.5** stays framework-compensation uniform, not UI-exposed.

## R4 sub-phase summary

| Phase | Goal | Key risk |
|---|---|---|
| R4-1 | HTML panel skeleton + CSS + createS + DOM adapters; drop lil-gui + modify InitCommon.js | ✅ DONE |
| R4-2 | 12-point shader flattening + sampleStochasticLight11 deletion + 3 uniform removal | Step-by-step compile verification; DCE sentinel at L2027 |
| R4-3 | CONFIG 1/2/3, A/B radio, color-temp radios, lumens, GIK minimap, light checkboxes | A/B group display toggle + CONFIG interaction |
| R4-4 | Track 5 + Wide 5 sweet-spot sliders; photometric model; BVH debounce | Beam→candela coupling; sceneBoxes mutation cost |
| R4-5 | Fold defaults, Cam buttons, Help, Hide, FPS/sample, snapshot, loading | Low risk |
