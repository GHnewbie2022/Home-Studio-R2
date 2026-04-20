# Handover: R4-3 ✅ → R4-4 execution entry

**Branch**: `r3-light`
**Status**: R3-0 ~ R3-7 ✅, R4-0 ✅, R4-1 ✅, R4-2 ✅, R4-3 ✅ (2026-04-21).
**Next task**: R4-4 甜蜜點 UI（Track 5 + Wide 5 slider；光度量測模型啟用；BVH 兩層更新策略）

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

## R4-2 completion summary

### What was done
- GLSL: Flattened 12 `uR3DynamicPoolEnabled` branches, deleted `sampleStochasticLight11` function (~120 lines).
- GLSL: Flattened 5 `uR3MisEnabled` branches, removed DCE sentinel.
- GLSL/JS: Removed 3 uniform declarations (`uR3MisEnabled`, `uR3MisPickMode`, `uR3DynamicPoolEnabled`) and JS throw-first guards.
- HTML/CSS/JS: Implemented CONFIG 1/2/3 radio buttons UI, replacing the old system and successfully connecting to `applyPanelConfig()`.
- Verified step-by-step compilation and checked scene rendering.

---

## R4-3 completion summary

### What was done
- JS: 全面控件接線：A/B radio（bounces/mult 切換）、色溫 radio 群組（Cloud/Track/Wide South/North）、Lumens slider（Cloud/Track/Wide）、Light enable checkbox（Cloud/Track/Wide South/Wide North）、牆面反射率 slider、間接光補償 A/B slider
- JS: GIK minimap 完整接線：9 塊牆板 + All + Ceil，palette（灰/白 2 色，紅色因廠商無貨移除）；索引映射 Config 1/2/3 正確對齊 sceneBoxes
- JS: Track / Wide 外觀色 radio（黑/白）→ sceneBoxes color 更新
- JS: 視角按鈕 cam1/2/3 → `switchCamera()` 接線
- JS: Hide UI 按鈕接線

### User decisions (scope changes vs original SOP)
- `slider-emissive-clamp` 移除：使用者主動決定（固定值 50 已足夠，不需 UI 暴露）
- `#groupGikPresets` 2 個預設按鈕整合進 GIK palette：使用者主動決定
- `🔲材質設定` 獨立 panel 整合進配置/光追面板：使用者主動決定
- GIK 只保留灰/白 2 色：廠商無紅色 GIK 貨，CSS data-color=2/3 為 dead code

### Known R4-4 scope items (carried forward)
- Sweet-spot sliders（beam-inner/outer, tilt, spacing, x/z）= wakeRender shell，待 R4-4 接真實 uniform
- Wide track per-side mesh (housing) visibility 需 shader 端分開 uniform（延後）
- A/B bounces/mult 初始值未細調，待使用者決定後 R4-4 一併處理

### Session hotfix (2026-04-21, post R4-3)
- **Bug fix**: CONFIG 3 吸頂燈出現黑色圓柱於房間北方
  - Root cause: `uCeilingLampPos.value.z = -1.5` 落在房間內（北牆 z=-1.874）；`CylinderIntersect` 無條件執行，emission=0 → 黑色幾何體可見
  - Fix: `applyPanelConfig` L373 改為 `cloudOn ? 100.0 : 0.591`（房間 z_max=3.056，100.0 確保光線永不命中）

### Pending research — 打破間接漫射 2 層截斷（使用者已確認列入待辦）
- **背景**: erichlof 框架在每個漫射材質分支以 `if (diffuseCount == 1)` 存間接反彈路徑，第 2 次漫射命中後停止存檔 → 無論 `uMaxBounces` 設多高，間接漫射最多 2 層
- **使用者需求**: 實驗真實 8 bounce 渲染（移除截斷） + 快速預覽 4 bounce 預設；想確認視覺差異
- **執行方式**: 把 shader 裡 10+ 處 `if (diffuseCount == 1)` 的 `willNeedDiffuseBounceRay = TRUE` 條件改為每次漫射命中都觸發，或抽共用函式
- **風險**: 多點 shader 改動，影響所有材質渲染路徑 → **建議先 `/ralplan` 取共識再執行**
- **附帶**: 同時設定 slider-bounces A 預設值 8、B 預設值 4（快速預覽）

---

## Completed commits on this branch (latest → oldest)

| Commit | Scope |
|---|---|
| `03e0454` | R4-3 DONE: 控件接線（UI 事件全面綁定，GIK Minimap 索引修正與舊版視角參數復刻）|
| `f0be38b` | R4-2 DONE: 12 shader branches flattened, sampleLight11 removed, 3 uniforms removed, CONFIG radio UI implemented |
| `7d754cb` | docs: R4-1 Debug_Log 經驗紀錄 + HANDOVER 交接訊息 |
| `017bfe0` | R4-1 DONE: UI skeleton + CSS + createS + DOM adapters + lil-gui removal + fix01-fix06 |
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
| R4-2 | 12-point shader flattening + sampleStochasticLight11 deletion + 3 uniform removal | ✅ DONE |
| R4-3 | CONFIG 1/2/3, A/B radio, color-temp radios, lumens, GIK minimap, light checkboxes | ✅ DONE |
| R4-4 | Track 5 + Wide 5 sweet-spot sliders; photometric model; BVH debounce | Beam→candela coupling; sceneBoxes mutation cost |
| R4-5 | Fold defaults, Cam buttons, Help, Hide, FPS/sample, snapshot, loading | Low risk |
