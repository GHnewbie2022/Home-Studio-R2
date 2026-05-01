# Handoff — R6 hibernation + UI work（saturation 已落地，ambient pivot 已 fail）

> Date: 2026-04-29（內容對齊 2026-04-30 程式碼現況）
> Status: Hibernation 完成、UI 預設完成、saturation 設計（chroma-mask + 白平衡補償）已落地並 verified。
>
> **後續陰影補光（Route X）全部 attempts 失敗**（2026-04-30）。
>          失敗紀錄與 pivot 計畫見 `.omc/LESSONS-R6-shadow-lift-failures.md`（後續主檔）。
>          Route X 原始設計脈絡仍見 `HANDOFF-R6-ambient-pivot-to-postprocess.md`（已歷史化）。

---

## Required prior reading (in order)

1. This file
2. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/FINDING-R6-supersampling-discovery.md`

`FINDING-...` covers the R6 pivot (super-sampling discovery, acceleration roadmap, hard rules, hypothesis revisions). Don't repeat that here.

---

## User profile (load-bearing)

- Music producer (mix / mastering). No engineering background.
- Spell out all technical terms in plain Chinese + full English. **Never use abbreviations** like NEE / MIS / BSDF / PDF / DCE / GLSL etc. when talking to user.
- Always present options. Never pick for them. Wait for an explicit choice before writing code.
- Traditional Chinese only. No Simplified, no Mainland-isms.
- Browser: Brave (desktop). Use Brave for any Playwright work if available.

---

## Recent work landed (verified working unless noted)

**Hibernation rewrite (FPS=0, GPU=0 at MAX_SAMPLES)**
- Modeled on the old single-file `Path Tracking 260412a 5.4 Clarity.html` lines 1882–1889: keep `requestAnimationFrame` running, but skip every `gl.*` call inside `animate()` when `renderingStopped` is true.
- `renderingStopped` now also gates STEP 3 in `js/InitCommon.js` (~line 1382). Display string in `js/Home_Studio.js` (~line 2403) hard-writes `FPS: 0`, `Samples: MAX_SAMPLES`, `(休眠)` when hibernating, ignoring lagging counter.
- Wake-up is implicit: any UI handler that sets `cameraIsMoving = true` or `sceneParamsChanged = true` is enough; no event listeners needed.
- `MAX_SAMPLES` 目前為 **20000**（`js/Home_Studio.js:759`，已恢復正式值）。

**Snapshot checkpoints**
- `SNAPSHOT_MILESTONES` in `Home_Studio.js` is `[8, 100, 300, 500, 1000, 2000, 3000, 5000, 7500, 15000]`. Plus the auto rule `% 10000 === 0` for 10000 / 20000. Total 12 chips.

**UI layout**
- `snapshot-bar` `bottom: 60px` (clears the 手動存圖 button at 28px).
- `cameraInfo` inline `left: 15px` (aligned with snapshot-actions).
- CONFIG radios are a 2×2 grid of 50px buttons.
- `min-width: 190px` removed from `.panel-content`, moved to `.control-row` as `min-width: 127px`. Label 50px, number 36px, slider ~25px. Panel auto-fits when only CONFIG is open.
- 「吸音板顏色」renamed to **「吸音板色」**, moved to be the last section after 光追設定.

**Default mode = 快速預覽 (btnB)**
- HTML: `glow-white` is on `btnGroupB`; `group-a-controls` defaults `display:none`; `group-b-controls` defaults visible.
- `btnA.onclick` / `btnB.onclick` apply per-mode values for: bounces, indirect-mult slider, saturation slider, wall albedo, pixel-res, ambient-floor (B 限定)。
  - 快速預覽（B）值：bounces 4、mult 2.5、sat 1.5、wallAlbedo 0.85、pixel-res 0.5、ambient 0.10（slider 預設值）。
  - 實際渲染（A）值：14 / 1.0 / 1.0 / 0.85 / 1.0；A 模式強制 `uAmbientFloor = 0.0`。
- **Init-order trap (resolved)**: `initUI()` is called from inside `initSceneData` (mid-`initTHREEjs`). At that point `pathTracingUniforms.uMaxBounces` (created at `InitCommon.js:690`) and `screenOutputUniforms.uSaturation` (created at `InitCommon.js:755`) don't exist yet, AND `InitCommon.js:649` later calls `setSliderValue('slider-pixel-res', pixelRatio=1.0)` which clobbers the slider. Fix: `setTimeout(function() { btnB.onclick(); }, 0)` so it runs after all sync init completes.
- 最近一次 verified URL：`?v=r6hib09-deferred-init`。後續 Route X 實作將推進至 `?v=r6lift01-postprocess`。

**Cmd+Click context-aware reset**
- Generic helper `installContextReset(sliderId, getDefaultByMode, applyDefault)` in `Home_Studio.js`. Capture-phase `mousedown` listener calls `stopImmediatePropagation` to override the createS factory's reset.
- Wired for `slider-bounces` (A→14, B→4) and `slider-pixel-res` (A→1.0, B→0.5).

---

## Saturation 設計（已落地）

使用者選定 **chroma-mask saturation** 路線，並追加白平衡補償區塊：

- **R6-sat02**：`shaders/ScreenOutput_Fragment.glsl:380` 改成 `smoothstep(0.15, 0.85, chromaNorm)`（低彩度像素吃較重 saturation，高彩度像素近乎免疫）。
- **R6-sat04**：同檔 `:385` 區塊在 chroma-mask `mix()` 之後加白平衡補償，gain 寫死 `0.12`（紅藍同步補強，抗黃綠偏色）。Route X 遷移時必須保留此區塊。
- 對應滑桿預設：`slider-sat-b` 1.5（`Home_Studio.js:1766`）、`slider-sat-a` 1.0（`:1758`）。
- 最終整體預設：實際渲染 14 / 1.0 / 1.0 / 0.85 / 1.0；快速預覽 4 / 2.5 / 1.5 / 0.85 / 0.5（+ ambient 0.10，待 Route X 拆除）。

Saturation 區塊本身視為穩定，後續若要進一步分離 direct / indirect，需動 path tracer 輸出兩通道的大改寫，目前不在工作區。

## 後續主軸 — Route X（ambient pivot）

陰影補光從 path tracer 的 `uAmbientFloor` 拆掉、改為 `ScreenOutput_Fragment.glsl` 的後製 `uShadowLift`（依 luma `smoothstep` 提升暗部）。

主檔：`HANDOFF-R6-ambient-pivot-to-postprocess.md`，那邊有完整六步驟清單與驗證點。本檔的 saturation / 白平衡補償區塊在 Route X 不動。

---

## Hard rules (do not break)

- DO NOT clamp values to mask noise — hides root cause.
- DO NOT use post-process blur for noise — confirmed wrong direction in R6-1.
- DO NOT retry RR Option 1 (NEE-after placement) — confirmed failed.
- DO NOT deprioritize G in favor of H — geometry ruled out.
- DO NOT introduce technical abbreviations in user-facing text.
- DO NOT use the AB-negation Chinese sentence patterns (不是A而是B / 是A而非B etc.).

---

## Key files

- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/Home_Studio.html`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/js/Home_Studio.js`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/js/InitCommon.js`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/shaders/Home_Studio_Fragment.glsl`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/shaders/ScreenOutput_Fragment.glsl`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/css/default.css`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-ambient-pivot-to-postprocess.md`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/FINDING-R6-supersampling-discovery.md`

本檔內容已對齊 2026-04-30 程式碼現況（hibernation / UI 預設 / saturation 全部 verified）。當前主軸已交給 Route X，請以 `HANDOFF-R6-ambient-pivot-to-postprocess.md` 為實作主檔。
