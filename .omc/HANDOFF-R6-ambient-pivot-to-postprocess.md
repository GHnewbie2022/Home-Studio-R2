# Handoff — R6 ambient floor pivot to post-process shadow lift

> Date: 2026-04-29（原始）/ 2026-04-30（最終狀態更新）
> Status: **Route X 全部 attempts 失敗**。改 pivot 到 PS / LR-style tone panel。
>          詳細失敗紀錄、Hard Rules、現況與未來展望請見：
>          `.omc/LESSONS-R6-shadow-lift-failures.md`
>
> 本檔以下內容為 2026-04-29 原始實作計畫（已歷史化），保留作為 Route X 設計脈絡。
> 後續開工請以 LESSONS 檔為主檔。

---

## Required prior reading (in order)

1. This file
2. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-ui-saturation-pending.md`
3. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/FINDING-R6-supersampling-discovery.md`

(2) and (3) cover R6 hibernation, default mode B, super-sampling pivot, hard rules. Do not repeat them here.

---

## User profile (load-bearing)

- Music producer (mix / mastering). No engineering background.
- Spell out all technical terms in plain Chinese plus full English. **Never use abbreviations** like NEE / MIS / BSDF / PDF / DCE / GLSL when talking to user.
- Always present options. Never pick. Wait for explicit choice before writing code.
- Traditional Chinese only. No Simplified, no Mainland-isms.
- Browser: Brave (desktop). Use Brave for Playwright work if available.
- Forbidden Chinese sentence patterns: 不是A而是B / 不是A只是B / 是A而非B / 是A而不是B (the AB-negation form).

---

## Recent work landed (verified by user unless noted)

**R6-mult01: Indirect-multiplier once-only fix (verified)**
- `uIndirectMultiplier` was applied at every diffuse-bounce-mask consumption site → exponential compounding (`(albedo × mult)^N`), bounce count increase caused overexposure instead of parabolic flattening.
- Fixed via `bool indirectMultApplied` flag declared at `Home_Studio_Fragment.glsl:941`.
- All 7 consumption sites now use ternary `(indirectMultApplied ? 1.0 : uIndirectMultiplier)`. After first apply, flag flips, subsequent sites pass-through.
- User verified: parabolic flattening behavior restored across bounce slider 1–14.

**R6-sat02: Chroma-mask threshold widened (verified)**
- `ScreenOutput_Fragment.glsl` saturation block: `smoothstep(0.15, 0.85, chromaNorm)` (was 0.55).
- Default sat 1.5 now produces visible wall color bleed without needing 2.0–3.0.

**R6-sat03: Quick preview default values (verified)**
- `slider-sat-b` default: 1.2 → 1.5 (`Home_Studio.js:1766`).
- `btnB.onclick`: `applyWallAlbedo(0.85)` (was 1.0, `Home_Studio.js:1807`).
- Final mode B defaults: pixel-res 0.5 / bounces 4 / mult 2.5 / sat 1.5 / wallAlbedo 0.85.

**R6-sat04: Auto white-balance compensation (verified)**
- In `ScreenOutput_Fragment.glsl` saturation block, AFTER the chroma-mask saturation `mix()`:
  ```glsl
  if (uSaturation > 1.0) {
      float comp = (uSaturation - 1.0) * satMask;
      filteredPixelColor.r *= 1.0 + comp * 0.12; // 補紅抗綠
      filteredPixelColor.b *= 1.0 + comp * 0.12; // 補藍抗黃
  }
  ```
- Hardcoded gain 0.12. Compensates yellow-green tint that chroma-mask introduces by amplifying low-chroma warm-bias regions.
- Tunable on feedback. KEEP THIS BLOCK during Route X migration — it stays in ScreenOutput.

**R6-sat05: Wall ambient injection fix (verified, but ABOUT TO BE REVERTED)**
- Discovered DIFF (wall/floor/ceiling/beam/column) branch had blank line between `diffuseCount++` and `mask *= hitColor`, causing earlier replace_all to skip it.
- Manual edit added 10th ambient injection site at the wall branch.
- Verified GIK panels and walls now lift uniformly. **This whole ambient-floor injection is being torn out in Route X.**

---

## CURRENT TASK — Route X: pivot ambient to post-process shadow lift

### Why pivot

After R6-sat05, user observed walls "violently whitewashed" by per-bounce `accumCol += mask × vec3(uAmbientFloor)`. Math behind it: 4-bounce path on white wall accumulates ≈ 0.85 + 0.72 + 0.61 + 0.52 ≈ 2.7 × ambient (geometric series). At ambient=0.10 that adds 0.27 absolute brightness — about 30–50% of natural wall brightness, hence "刷白" perception.

User reasoned through the conceptual implication:
- True ambient should be **bounce-independent** (matches Phong `k_a × I_a`).
- True ambient should **not be multiplied by mask** (which carries surface albedo and bounce decay).
- Cleanest "shadow-only lift" requires per-pixel luma awareness, which is unavailable mid-path-trace.
- Therefore the cleanest solution is post-process shadow lift in ScreenOutput, accepting that this is genuinely post-process. User explicitly approved Route X despite originally rejecting post-process for shadow work.

### What Route X does

```glsl
// in ScreenOutput_Fragment.glsl, AFTER saturation + WB compensation block,
// BEFORE tonemap (around current line 380-381):
if (uShadowLift > 0.0) {
    float lumaPre = dot(filteredPixelColor, vec3(0.299, 0.587, 0.114));
    float lift = uShadowLift * smoothstep(LIFT_HIGH, LIFT_LOW, lumaPre);
    filteredPixelColor += vec3(lift);
}
```

Suggested initial thresholds: `LIFT_HIGH = 0.5`, `LIFT_LOW = 0.0` (smoothstep arg order chosen so output is 1.0 at pure black, 0.0 at luma ≥ 0.5; tune on feedback).

### Implementation checklist

1. **Add `uShadowLift` uniform** to `screenOutputUniforms` in `js/InitCommon.js` (around the area where `uSaturation` is added — `~line 755`).
2. **Add `uniform float uShadowLift;`** in `shaders/ScreenOutput_Fragment.glsl` near other uniforms (~line 19).
3. **Insert lift logic** in `ScreenOutput_Fragment.glsl` after the WB compensation `}` and BEFORE `filteredPixelColor = uUseToneMapping ? ReinhardToneMapping(...) ...` line (currently ~line 381).
4. **Tear out path-tracer ambient injection**:
   - Delete `uniform float uAmbientFloor;` declaration in `Home_Studio_Fragment.glsl` (~line 35).
   - Delete `pathTracingUniforms.uAmbientFloor` line in `js/InitCommon.js`.
   - Delete the 10 ambient injection lines in `Home_Studio_Fragment.glsl` (search `uAmbientFloor > 0.0` to find them all).
   - One injection has different surrounding indent (DIFF branch ~line 1812); the other 9 share the standard scatter pattern.
5. **Rewire UI slider** `slider-ambient-b` in `js/Home_Studio.js`:
   - Slider id can stay or rename to `slider-lift-b`. If renaming, update `Home_Studio.html` div id and `js/Home_Studio.js` createS call to match. Recommend rename to `slider-lift-b` for clarity.
   - Label change: "環境底光" → "陰影補光" (or "暗部補光").
   - createS callback: set `screenOutputUniforms.uShadowLift.value = v` (was `pathTracingUniforms.uAmbientFloor.value = v`).
   - `btnA.onclick`: set `screenOutputUniforms.uShadowLift.value = 0.0`.
   - `btnB.onclick`: set `screenOutputUniforms.uShadowLift.value = getSliderValue('slider-lift-b')`.
   - Default initial value: 0.10 (carry over from current `slider-ambient-b`).
6. **Verification URL bump**: `?v=r6lift01-postprocess`.

### Verification points (when user returns)

```
快速預覽（B）+ 陰影補光 0.10
  → 陰影區（角落、家具背面、低光區）溫和提升
  → 已亮的牆面/家具/燈具幾乎不動（luma 高，smoothstep 輸出 ≈ 0）
  → 不再「暴力刷白」

實際渲染（A）→ 陰影補光強制 0、跟改前一致

如果效果不對的調整方向：
  - 過渡太硬（亮暗交界突然變色）→ 把 LIFT_HIGH 拉高（0.7）或多段 smoothstep
  - 已亮區仍被推 → LIFT_HIGH 降低（0.3）
  - 陰影區提升不夠 → 滑桿值上拉，或 LIFT_LOW 改負值讓提升更深
  - 全圖看起來霧 → 滑桿值下拉（這是 0.10 太強的徵兆）
```

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
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-ui-saturation-pending.md`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/FINDING-R6-supersampling-discovery.md`

Stand by for user instruction. Most likely next step is greenlight to start Route X implementation; user may also ask for clarification on threshold values before approving.
