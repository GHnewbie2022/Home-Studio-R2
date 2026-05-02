# REPORT — R6-3 Phase 1C Step 0 Cloud formula inventory

> Date: 2026-05-02
> Scope: read-only formula inventory for Cloud radiance / area / PDF / MIS consistency.
> Inputs:
> - `.omc/MAP-R6-3-Phase1C-cloud-effective-surface-contract.md`
> - `docs/R3_燈具產品規格.md`
> - `js/Home_Studio.js`
> - `shaders/Home_Studio_Fragment.glsl`
> Status: read-only report. No shader / JS code changed.

---

## 0. Step 0 goal

Phase 1A and Phase 1B both failed visual validation. Phase 1C therefore audits the Cloud sample scoring chain instead of changing sample placement first.

The scoring chain is:

```
Cloud product data
  -> JS luminous flux constants
  -> JS computeCloudRadiance()
  -> shader Cloud target distribution
  -> shader geometry term
  -> shader throughput area
  -> shader pdfNeeOmega
  -> shader MIS w_nee
  -> shader BSDF reverse pNeeReverse / w_bsdf
```

This report inventories all current formulas that use:

```
A
2A
sqrt(2)A
lm/m
faceNormal
selectPdf
pdfNeeOmega
pNeeReverse
MIS weight
```

---

## 1. Product ground truth

Source:

```
docs/R3_燈具產品規格.md
```

Relevant product facts:

```
Cloud aluminium channel:
  Cross-section: 16 mm x 16 mm.
  Installation: Cloud panel top edge / corner channel.
  Output direction: outward + upward around 45 degrees.

LED tape:
  Model: D-35NA12V4DR1.
  Luminous flux: 480 lm/m.
```

Per-rod ground-truth luminous flux:

```
E rod length = 2.4 m:
  480 * 2.4 = 1152 lm

W rod length = 2.4 m:
  480 * 2.4 = 1152 lm

S rod length = 1.768 m:
  480 * 1.768 = 848.64 lm

N rod length = 1.768 m:
  480 * 1.768 = 848.64 lm

Total Cloud:
  4001.28 lm
```

Phase 1C interpretation:

```
The 45-degree optical normal is plausible because the real diffuser is a quarter-arc / corner-channel output surface.
The unresolved part is not the 45-degree direction by itself.
The unresolved part is the area / PDF / radiance contract around that direction.
```

---

## 2. JS Cloud constants

Source:

```
js/Home_Studio.js:200-221
```

Current code:

```javascript
// R3-3：商品規格 D-35NA12V4DR1 軟條燈 480 lm/m。
const CLOUD_ROD_LUMENS    = [1600 * 2.4, 1600 * 2.4, 1600 * 1.768, 1600 * 1.768];
const CLOUD_ROD_FACE_AREA = [0.016 * 2.4, 0.016 * 2.4, 0.016 * 1.768, 0.016 * 1.768];
const CLOUD_FACE_COUNT = 2;
```

Inventory:

```
CLOUD_ROD_LUMENS:
  Actual current default = 1600 lm/m * length.
  Comment / product spec = 480 lm/m * length.
  Ratio = 1600 / 480 = 3.333333...

CLOUD_ROD_FACE_AREA:
  A = 0.016 * length.
  This is one rectangular face area, not two faces.

CLOUD_FACE_COUNT:
  2.
  Meaning from comments: +Y top face + outer long face.
```

Numeric table:

| Rod | Length | A = 0.016L | 2A | sqrt(2)A | lm @ 480/m | lm @ current 1600/m |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| E | 2.4 | 0.038400 | 0.076800 | 0.054306 | 1152.000 | 3840.000 |
| W | 2.4 | 0.038400 | 0.076800 | 0.054306 | 1152.000 | 3840.000 |
| S | 1.768 | 0.028288 | 0.056576 | 0.040005 | 848.640 | 2828.800 |
| N | 1.768 | 0.028288 | 0.056576 | 0.040005 | 848.640 | 2828.800 |

User decision note:

```
The code comment and product spec point to 480 lm/m as the purchased LED tape reference.
The live default and UI slider default use 1600 lm/m by user decision.

Reason recorded on 2026-05-02:
  After moving to path tracing, the previous C4 setup lit Cloud + Track + Wide together and became too bright.
  The user therefore separated Cloud into C3-only and disabled Cloud in C4.
  With C3 Cloud-only, 480 lm/m looked too dark, so the user raised Cloud to the highest product-spec tier: 1600 lm/m.

Current status:
  Treat 1600 lm/m as an intentional user-selected lighting design value, not a bug.
  Still keep 480 lm/m as the lower product reference and test comparison value.
```

---

## 3. JS radiance formula

Source:

```
js/Home_Studio.js:674-686
js/Home_Studio.js:1411-1418
```

Current formula:

```javascript
function computeCloudRadiance(lm_total, kelvin, faceArea) {
    const K = kelvinToLuminousEfficacy(kelvin);
    const A = Math.max(faceArea, 1e-8);
    return (lm_total / 2) / (K * Math.PI * A);
}
```

Meaning:

```
L = (Phi_rod / 2) / (K * pi * A)

Phi_rod:
  per-rod luminous flux in lumens.

K:
  luminous efficacy lookup from kelvin.

A:
  one rectangular face area.

/2:
  divides rod flux equally between two same-area emitting faces:
    +Y top face
    outer long face
```

Then:

```javascript
radiance = computeCloudRadiance(CLOUD_ROD_LUMENS[i], cloudKelvin, CLOUD_ROD_FACE_AREA[i]);
uCloudEmission[i] = radiance * linearKelvinRGB;
```

Contract currently implied by JS:

```
Optical area model in JS = two rectangular faces.
Radiance denominator = 2 * A, represented as (Phi / 2) / A.
```

Important note:

```
If current lm/m remains 1600, radiance is 3.333333 times product-ground-truth radiance.
This is independent from the 2A vs sqrt(2)A mismatch.
```

---

## 4. JS UI luminous flux override

Source:

```
js/Home_Studio.js:2249-2257
```

Current UI slider:

```javascript
createS('slider-lumens', '光通量 (lm/m)', 0, 4000, 1, 1600, function(v) {
    CLOUD_ROD_LUMENS[0] = v * 2.4;
    CLOUD_ROD_LUMENS[1] = v * 2.4;
    CLOUD_ROD_LUMENS[2] = v * 1.768;
    CLOUD_ROD_LUMENS[3] = v * 1.768;
    computeLightEmissions();
    wakeRender();
    return v;
});
```

Inventory:

```
Slider label:
  光通量 (lm/m)

Slider range:
  0 to 4000 lm/m

Current default:
  1600 lm/m

Product spec:
  480 lm/m
```

Implication:

```
The UI can represent product truth, but the current default does not use it.
If 1600 is intentional, it should be documented as a calibration / compensation default.
If product truth is required, default should align with 480.
```

---

## 5. Shader common PDF / MIS helpers

Source:

```
shaders/Home_Studio_Fragment.glsl:217-246
```

Current helpers:

```glsl
float misPowerWeight(float p1, float p2)
{
    float p1sq = p1 * p1;
    float p2sq = p2 * p2;
    float denom = p1sq + p2sq;
    if (denom < 1e-12) return 0.5;
    return p1sq / denom;
}

float cosWeightedPdf(vec3 dir, vec3 normal)
{
    return max(0.0, dot(dir, normal)) * ONE_OVER_PI;
}

float pdfNeeForLight(vec3 x, vec3 lightPoint, vec3 lightNormal, float lightArea, float selectPdfArg)
{
    vec3 toLight = lightPoint - x;
    float dist2 = max(dot(toLight, toLight), 1e-4);
    float cosLight = max(1e-6, dot(-normalize(toLight), lightNormal));
    float safeArea = max(lightArea, 1e-6);
    return selectPdfArg * (dist2 / (cosLight * safeArea));
}
```

Inventory:

```
MIS heuristic:
  w = p1^2 / (p1^2 + p2^2)

BSDF cosine PDF:
  p_bsdf = cos(theta) / pi

NEE solid-angle PDF:
  p_nee = selectPdf * dist^2 / (cosLight * lightArea)
```

Important dependency:

```
pdfNeeForLight() is only as correct as lightPoint, lightNormal, and lightArea passed into it.
For Phase 1C, Cloud must define those three as one coherent effective surface.
```

---

## 6. Shader Cloud effective area constant

Source:

```
shaders/Home_Studio_Fragment.glsl:247-250
```

Current code:

```glsl
const float CLOUD_DIAGONAL_FACE_AREA_SCALE = 1.4142135623730951; // sqrt(2)
```

Comment intent:

```
Diagonal area = A_face * sqrt(2).
This is used for Cloud MIS p_nee.
Radiometric uCloudFaceArea is intentionally kept separate.
```

Inventory:

```
A_face:
  one rectangular face area from uCloudFaceArea[rodIdx]

Cloud diagonal PDF area:
  A_pdf = A_face * sqrt(2)

Cloud direct throughput area:
  A_throughput = A_face * uCloudFaceCount = 2A
```

Mismatch ratio:

```
A_throughput / A_pdf = 2A / (sqrt(2)A) = sqrt(2) = 1.41421356
```

---

## 7. Shader Cloud light selection

Source:

```
shaders/Home_Studio_Fragment.glsl:253-277
js/Home_Studio.js:1519-1546
```

Shader selection:

```glsl
int slot = int(floor(rng() * float(uActiveLightCount)));
slot = clamp(slot, 0, uActiveLightCount - 1);
int neeIdx = uActiveLightIndex[slot];
float selectPdf = 1.0 / float(uActiveLightCount);
```

For C3 Cloud-only pool, JS adds:

```javascript
if (cloudOn) { lut[count++] = 7; lut[count++] = 8; lut[count++] = 9; lut[count++] = 10; }
```

Inventory:

```
C3 active light count:
  4

Cloud rod slots:
  7, 8, 9, 10

Per-rod selectPdf:
  1 / 4
```

Phase 1C status:

```
No current evidence that selectPdf is missing the rod-selection probability.
Phase 1A already tested early rod slot stratification and visually no-go.
```

---

## 8. Shader Cloud target distribution

Source:

```
shaders/Home_Studio_Fragment.glsl:354-388
```

Current target setup:

```glsl
int rodIdx = neeIdx - 7;
vec3 rodCenter = uCloudRodCenter[rodIdx];
vec3 rodHalf = uCloudRodHalfExtent[rodIdx];
```

Virtual optical normal:

```glsl
E: vec3( 0.7071, 0.7071, 0.0)
W: vec3(-0.7071, 0.7071, 0.0)
S: vec3( 0.0, 0.7071, 0.7071)
N: vec3( 0.0, 0.7071,-0.7071)
```

Target distribution after Phase 1B:

```glsl
longAxisJitter = rng() * 2.0 - 1.0;

crossJitter = rng() * 2.0 - 1.0;
if (crossJitter < 0.0) {
    target is on +Y top face;
} else {
    target is on outer long face;
}

cloudTarget = rodCenter + longAxisOffset + crossOffset;
```

Inventory:

```
Actual sampled point:
  on one of two rectangular faces:
    +Y top face
    outer long face

Selection between top / outer:
  50% / 50% via crossJitter sign

Optical normal used later:
  not the actual face normal.
  always the 45-degree virtual normal.
```

Phase 1C interpretation:

```
This can be a valid hybrid model for a real quarter-arc diffuser:
  rectangular faces = shadow-hit proxy
  diagonal normal = optical diffuser direction

But PDF area and contribution area must match this hybrid contract.
```

---

## 9. Shader Cloud geometry term and direct throughput

Source:

```
shaders/Home_Studio_Fragment.glsl:388-397
```

Current formula:

```glsl
vec3 cloudTo = cloudTarget - x;
float cloudDist2 = max(dot(cloudTo, cloudTo), 1e-4);
vec3 cloudDir = cloudTo * inversesqrt(cloudDist2);
float cloudCosLight = max(0.0, dot(-cloudDir, faceNormal));
float cloudGeom = max(0.0, dot(nl, cloudDir)) * cloudCosLight / cloudDist2;
vec3 cloudEmit = uCloudEmission[rodIdx];
throughput = cloudEmit * cloudGeom * uCloudFaceArea[rodIdx] * uCloudFaceCount / selectPdf;
```

Inventory:

```
cloudTarget:
  top / outer rectangular surface point.

faceNormal:
  45-degree virtual optical normal.

cloudCosLight:
  dot(-cloudDir, virtual 45-degree normal).

cloudGeom:
  cosSurface * cosLight / dist^2.

cloudEmit:
  JS radiance from computeCloudRadiance().

throughput area:
  A * uCloudFaceCount = 2A.

selectPdf:
  1 / activeLightCount.
```

Current direct estimator implied area:

```
Direct NEE contribution uses 2A.
```

---

## 10. Shader Cloud pdfNeeOmega

Source:

```
shaders/Home_Studio_Fragment.glsl:398-400
```

Current formula:

```glsl
float cloudDiagArea = uCloudFaceArea[rodIdx] * CLOUD_DIAGONAL_FACE_AREA_SCALE;
pdfNeeOmega = pdfNeeForLight(x, cloudTarget, faceNormal, cloudDiagArea, selectPdf);
```

Expanded:

```
pdfNeeOmega = selectPdf * dist^2 / (cosLight * (A * sqrt(2)))
```

Inventory:

```
lightPoint:
  same cloudTarget as direct contribution.

lightNormal:
  same virtual 45-degree faceNormal as direct contribution.

lightArea:
  A * sqrt(2).
```

Current PDF implied area:

```
NEE PDF uses sqrt(2)A.
```

Mismatch with direct contribution:

```
Direct contribution area = 2A.
NEE PDF area = sqrt(2)A.
Ratio = sqrt(2).
```

---

## 11. Shader Cloud NEE-hit accumulation

Sources:

```
shaders/Home_Studio_Fragment.glsl:1164-1191
shaders/Home_Studio_Fragment.glsl:1682-1717
```

Fast Cloud NEE-hit branch:

```glsl
if (hitType == CLOUD_LIGHT && sampleLight == TRUE && uR3EmissionGate > 0.5) {
    cloudIsEmissiveFace = top || outerLong;
    if (cloudIsEmissiveFace) {
        if (lastNeePickedIdx >= 7 && lastNeePickedIdx <= 10) {
            float wNee = misPowerWeight(misWPrimaryNeeLast, misPBsdfNeeLast);
            accumCol += mask * wNee;
        } else {
            accumCol += mask;
        }
    }
}
```

Later Cloud branch contains equivalent sampleLight logic:

```glsl
if (sampleLight == TRUE) {
    if (lastNeePickedIdx >= 7 && lastNeePickedIdx <= 10) {
        float wNee = misPowerWeight(misWPrimaryNeeLast, misPBsdfNeeLast);
        accumCol += mask * wNee;
    } else {
        accumCol += mask;
    }
}
```

Inventory:

```
For NEE-hit Cloud:
  emission is already baked into mask by throughput.
  hit branch multiplies by MIS wNee only.

wNee inputs:
  p1 = misWPrimaryNeeLast = pdfNeeOmega from sampleStochasticLightDynamic()
  p2 = misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl)
```

Phase 1C implication:

```
Any error in pdfNeeOmega directly changes wNee.
Any direct throughput / pdfNeeOmega area mismatch changes both energy and MIS balance.
```

---

## 12. Shader Cloud BSDF reverse PDF and w_bsdf

Source:

```
shaders/Home_Studio_Fragment.glsl:1722-1736
```

Current formula:

```glsl
vec3 faceNormal;
// same 45-degree normal per rod
vec3 cloudTarget = uCloudRodCenter[rodIdx];
float cloudDiagArea = uCloudFaceArea[rodIdx] * CLOUD_DIAGONAL_FACE_AREA_SCALE;
float pNeeReverse = pdfNeeForLight(misBsdfBounceOrigin, cloudTarget, faceNormal, cloudDiagArea, 1.0 / float(uActiveLightCount));
float wBsdf = misPowerWeight(misPBsdfStashed, pNeeReverse);
accumCol += min(mask * emission * wBsdf, vec3(uEmissiveClamp));
```

Inventory:

```
Reverse lightPoint:
  uCloudRodCenter[rodIdx]

Forward lightPoint distribution:
  top / outer 2D target from cloudTarget.

Reverse lightNormal:
  45-degree virtual normal.

Reverse lightArea:
  A * sqrt(2).

Reverse selectPdf:
  1 / uActiveLightCount.
```

Mismatch:

```
Forward PDF point varies over top / outer faces.
Reverse PDF uses rod center representative point.
```

Phase 1C implication:

```
Reverse PDF should be treated as dependent on the final forward effective surface contract.
Do not perfect reverse PDF before deciding the forward model.
```

---

## 13. Current formula matrix

| Chain stage | Current symbol / formula | Area used | Normal used | Point used | Notes |
| --- | --- | ---: | --- | --- | --- |
| Product data | 480 lm/m | n/a | 45-degree output | physical diffuser | Ground truth spec. |
| JS default | 1600 lm/m | n/a | n/a | n/a | 3.333x product spec. |
| JS radiance | `(lm_total / 2) / (K*pi*A)` | 2A implied | n/a | n/a | Two rectangular face contract. |
| Cloud target | top / outer 2D target | n/a | n/a | actual square proxy face | Phase 1B current path. |
| Cloud geometry | `cosSurface * cosLight / dist2` | n/a | 45-degree virtual | top / outer target | Hybrid model. |
| Direct throughput | `emit * geom * A * 2 / selectPdf` | 2A | 45-degree virtual | top / outer target | Energy side uses 2A. |
| NEE PDF | `selectPdf * dist2 / (cosLight * A*sqrt(2))` | sqrt(2)A | 45-degree virtual | top / outer target | PDF side uses sqrt(2)A. |
| NEE MIS | `wNee = pNee^2 / (pNee^2 + pBsdf^2)` | from pNee | n/a | n/a | Sensitive to PDF area. |
| Reverse PDF | `pdfNeeForLight(origin, rodCenter, normal, A*sqrt(2), selectPdf)` | sqrt(2)A | 45-degree virtual | rod center | Representative approximation. |
| BSDF MIS | `wBsdf = pBsdf^2 / (pBsdf^2 + pNeeReverse^2)` | from pNeeReverse | n/a | n/a | Sensitive to reverse PDF model. |

---

## 14. Step 0 conclusions

```
1. The 45-degree Cloud normal is physically defensible.
   It matches the real aluminium-channel diffuser direction.

2. The current renderer is a hybrid model:
   top / outer rectangular faces for shadow-hit acceptance,
   45-degree virtual normal for optical output.

3. The hybrid model is not the problem by itself.
   The problem is that effective area is split:
     radiance / direct contribution use 2A,
     PDF / reverse PDF use sqrt(2)A.

4. The current default Cloud flux is 1600 lm/m.
   This is an intentional user-selected value after C3/C4 separation, not a bug.
   480 lm/m remains the lower purchased-LED reference value.
   However, if formula corrections reduce the old C4 over-brightness, C3/C4 integration can be reconsidered.

5. Reverse PDF currently uses rod center as a coarse representative point.
   This should wait until forward effective surface is defined.
```

---

## 15. Recommended next step

Phase 1C Step 1 should decide the effective surface contract before code changes.

Recommended contract to evaluate first:

```
Hybrid rectangular-hit / diagonal-optical model.

Keep:
  top / outer faces as shadow-hit proxy.
  45-degree normal as optical diffuser direction.

Decide explicitly:
  effective area = 2A or sqrt(2)A or named A_eff.

Then apply the same A_eff to:
  direct throughput area,
  pdfNeeOmega lightArea,
  pNeeReverse lightArea,
  test expectations.
```

Do not change these in Step 1 unless intentionally scoped:

```
No denoise.
No SVGF.
No temporal reprojection.
No accumulation rewrite.
No firefly clamp as the first response.
No Blender / native Mac / Metal / WebGPU pivot.
```

---

## 16. Open decision items for Step 1

```
1. Keep 1600 lm/m as the current user-selected C3 Cloud-only default.
   After formula correction, re-check whether the old C4 over-brightness was partly caused by formula mismatch; if yes, C3/C4 may be eligible for reintegration.

2. Should A_eff be 2A, sqrt(2)A, or another named diffuser approximation?

3. If A_eff changes, should computeCloudRadiance denominator change too,
   or should only throughput / PDF be aligned?

4. Should reverse PDF remain representative, be disabled for Cloud BSDF hits,
   or be upgraded after forward contract is chosen?
```

