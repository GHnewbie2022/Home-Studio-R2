# PLAN — R6-3 Phase 1 C3 Cloud non-denoise convergence improvement

> Date: 2026-05-01
> Scope: Phase 1A implementation plan and verification record.
> Goal: Improve C3 Cloud `1~48 spp` initial convergence without denoise, SVGF, reproject, firefly clamp, accumulation changes, or Cloud energy/PDF/MIS changes.

---

## 1. Implemented patch

Target:

```
shaders/Home_Studio_Fragment.glsl
sampleStochasticLightDynamic()
```

Change:

```
Keep the original rng() slot selection call.
Only when the active light pool is exactly Cloud rods [7,8,9,10] and uSampleCounter <= 48:
  pixelPhase = floor(blueNoise * 4)
  samplePhase = mod(uSampleCounter - 1, 4)
  slot = mod(pixelPhase + samplePhase, 4)
Otherwise:
  use the original random slot.
```

Expected effect:

```
C3 Cloud-only early samples cover the 4 Cloud rods more evenly.
This should reduce 1~48 spp full-frame high variance without blurring the image.
```

---

## 2. Guardrails

This patch intentionally does not:

```
1. Change ScreenOutput resolve or add denoise.
2. Change path tracing accumulation.
3. Change Cloud brightness, radiance, PDF, MIS weight, or effective area.
4. Change Cloud target long-axis jitter.
5. Change snapshot milestones or UI.
6. Affect non-C3 pools where uActiveLightIndex is not exactly [7,8,9,10].
```

---

## 3. Verification checklist

Smoke test:

```
[x] Page loads without GLSL compile error. Brave headless + SwiftShader loaded shader resources successfully.
[x] No black screen exception observed in console.
[x] No NaN / all-white blowout exception observed in console.
```

Smoke test note:

```
2026-05-01: First Brave headless attempt failed because WebGL was disabled.
Second attempt with --enable-webgl --use-gl=swiftshader --enable-unsafe-swiftshader loaded Home_Studio.html and shaders.
Observed console output contained normal project logs and GPU ReadPixels performance warnings, but no GLSL compile error.
```

C3 bounce14 comparison:

```
[x] Capture 1 spp.
[x] Capture 2 spp.
[x] Capture 3 spp.
[x] Capture 4 spp.
[x] Capture 5 spp.
[x] Capture 6 spp.
[x] Capture 7 spp.
[x] Capture 8 spp.
[x] Capture 16 spp.
[x] Capture 24 spp.
[x] Capture 32 spp.
[x] Capture 48 spp.
[x] Capture 64 spp.
[x] Capture 80 spp.
[x] Capture 100 spp.
[x] Capture 150 spp.
[x] Capture 200 spp.
[x] Capture 300 spp.
[x] Capture 500 spp.
[x] Capture 750 spp.
[x] Capture 1000 spp.
[ ] Capture 1500 spp.
[ ] Capture 2000 spp.
[ ] Capture 3000 spp.
```

Compare against:

```
snapshot/260501-cam1-default C3 bounce14
```

Phase 1A capture folder:

```
snapshot/260502-cam1-default C3 bounce14 phase1A
```

User visual checks:

```
[x] User compared Phase 1A against baseline and reported no visible improvement.
[ ] 1~48 spp has less full-frame initial noise. FAIL: user reports it looks identical to baseline.
[ ] No visible checkerboard / stripe / fixed pattern.
[ ] Cloud still reads as diffuse light, not segmented spots.
[ ] Walls, object boundaries, and furniture edges do not get worse.
```

Phase 1A result:

```
FAIL / no-go.

2026-05-02 user visual judgment:
"肉眼判斷，跟原本的一模一樣，完全沒有改善"

Interpretation:
The initial C3 1~48 spp problem is not meaningfully improved by light-slot stratification alone.
The dominant variance is therefore likely not just uneven selection among the 4 Cloud rods.
Do not spend more time polishing Phase 1A unless a later metric contradicts the visual result.
Proceed to the next non-denoise branch:
  1. Phase 1B: Cloud target sampling shape review, especially current 1D long-axis jitter.
  2. Phase 1C: Cloud area / radiance / MIS pdf consistency review.
```

Metric checks:

```
[ ] Use 3000 spp reference.
[ ] Recompute low-spp luminance error.
[ ] Recompute high-brightness outlier count.
[ ] Confirm 1~48 spp improves or at least does not regress.
```

Regression checks:

```
[ ] C4 is unaffected because its active pool is not [7,8,9,10].
[ ] A mode / non-C3 14-bounce behavior is unchanged.
[ ] After 48 spp selection returns to original random behavior.
```

---

## 4. Follow-up gates

If Phase 1A improves early C3 convergence and has no visible pattern:

```
Plan Phase 1B: Cloud target 1D long-axis jitter -> virtual diagonal rectangle 2D stratified sampling.
```

If Phase 1A improves little:

```
Current gate outcome: Phase 1A improves little / not visible.
Next planning target should move past light-slot selection.

Priority order:
1. Phase 1B: Cloud target 1D long-axis jitter -> virtual diagonal rectangle 2D stratified sampling.
2. Phase 1C: Cloud effective area / computeCloudRadiance / MIS pdf area consistency review.
```

Only after sampling / weight / PDF options are exhausted:

```
Reconsider preview-only ScreenOutput denoise.
```
