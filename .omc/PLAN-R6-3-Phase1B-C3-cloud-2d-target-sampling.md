# PLAN / IMPLEMENTATION RECORD — R6-3 Phase 1B C3 Cloud 2D target sampling

> Date: 2026-05-02
> Scope: C3 Cloud non-denoise convergence experiment after Phase 1A no-go.
> Goal: Test whether Cloud target shape, not rod slot selection, is the dominant reason for `1~48 spp` initial noise.

---

## 1. Phase 1A gate

```
Phase 1A status: FAIL / no-go.

User visual judgment:
"肉眼判斷，跟原本的一模一樣，完全沒有改善"

Decision:
Remove the early-spp Cloud rod slot override and return rod slot selection to the original rng() path.
```

---

## 2. Implemented Phase 1B patch

Target:

```
shaders/Home_Studio_Fragment.glsl
sampleStochasticLightDynamic()
Cloud rod branch, neeIdx 7..10
```

Change:

```
Previous Cloud target:
  rodCenter + faceOffset + longAxisOffset

New Cloud target:
  rodCenter + longAxisOffset + crossOffset

longAxisOffset:
  E / W rods: z axis
  S / N rods: x axis

crossOffset:
  crossJitter < 0:
    sample the +Y top face across the rod width

  crossJitter >= 0:
    sample the outer long face from top edge to bottom edge
```

Important implementation adjustment:

```
The original Phase 1B plan described a virtual diagonal rectangle centered on the rod.
During implementation review, that shape could place target points inside the rod volume.

Current shadow-ray acceptance only counts Cloud hits on:
  +Y top face
  outer long face

Therefore the patch uses a visibility-safe unfolded 2D sample over those two accepted faces.
It still keeps the diagonal faceNormal / cloudDiagArea weighting so Phase 1B only changes target placement.
```

Unchanged contracts:

```
1. selectPdf remains 1.0 / float(uActiveLightCount).
2. throughput remains cloudEmit * cloudGeom * uCloudFaceArea[rodIdx] * uCloudFaceCount / selectPdf.
3. pdfNeeOmega still uses cloudDiagArea = uCloudFaceArea[rodIdx] * sqrt(2).
4. computeCloudRadiance remains unchanged.
5. CLOUD_FACE_COUNT remains 2.
6. No ScreenOutput denoise, SVGF, reproject, accumulation change, or firefly clamp.
```

BSDF reverse-NEE:

```
Updated representative Cloud target from old outer-top edge to uCloudRodCenter[rodIdx].
This keeps the reverse PDF representative point closer to the new 2D target distribution.
```

---

## 3. Verification so far

```
[x] node docs/tests/r3-3-cloud-radiance.test.js
[x] node docs/tests/r3-5b-cloud-area-nee.test.js
[x] git diff --check
[x] Brave headless smoke loaded Home_Studio.html and shader resources.
[x] No GLSL compile error observed in smoke console output.
```

Smoke note:

```
Headless Brave was stopped manually after page load.
The final GPU process exit message is from stopping the smoke process.
ReadPixels performance warnings were present and are existing browser/GPU noise.
```

---

## 4. Required visual validation

New snapshot folder:

```
snapshot/260502-cam1-default C3 bounce14 phase1B
```

Compare against:

```
snapshot/260501-cam1-default C3 bounce14
snapshot/260502-cam1-default C3 bounce14 phase1A
```

Use the same spp milestones:

```
1
2
3
4
5
6
7
8
16
24
32
48
64
80
100
150
200
300
500
750
1000
```

Decision criteria:

```
1. If 1~48 spp still looks identical to baseline, Phase 1B is no-go.
2. If 1~48 spp improves but Cloud shape becomes stripey / segmented / projector-like, Phase 1B is unsafe.
3. If 1~48 spp improves and Cloud remains diffuse, proceed to Phase 1C effective area / radiance / PDF / MIS review.
```

---

## 5. Visual validation result

Captured in:

```
snapshot/260502-cam1-default C3 bounce14 phase1B
```

Observed files at decision time:

```
1
2
3
4
5
6
7
8
16
24
32
48
64
80
100
150
200
300
```

User visual judgment:

```
"一樣是完全沒有改善，肉眼判斷與原本一模一樣"
```

Phase 1B result:

```
FAIL / no-go.

Interpretation:
Changing Cloud target placement from 1D edge sampling to visibility-safe 2D top/outer-face sampling did not visibly improve C3 `1~48 spp` initial noise.

The dominant variance is therefore unlikely to be solved by:
  1. Cloud rod slot stratification alone.
  2. Cloud NEE target position dimensionality alone.

Next non-denoise branch:
  Phase 1C: Cloud effective area / computeCloudRadiance / pdfNeeOmega / MIS weight consistency review.
```
