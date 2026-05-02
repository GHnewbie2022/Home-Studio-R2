# MAP — R6-3 Phase 1C Cloud effective surface contract

> Date: 2026-05-02
> Scope: R6-3 Phase 1C code review map for Cloud aluminium-channel light-bar sampling / radiance / PDF / MIS consistency.
> Renderer scope: existing HTML / WebGL2 renderer only.
> Status: review map only; no shader / JS implementation in this document.

---

## 0. Why this map exists

Phase 1A and Phase 1B were both visually judged no-go for C3 Cloud low-spp initial noise.

```
Phase 1A:
  Changed early-spp Cloud rod slot selection.
  Result: no visible improvement.

Phase 1B:
  Changed Cloud target from 1D outer-top edge jitter to 2D top / outer-face target sampling.
  Result: no visible improvement.
```

Therefore Phase 1C should stop asking only:

```
Are we sampling the wrong rod or wrong target point?
```

Phase 1C should ask:

```
After a Cloud sample is chosen, is its score mathematically consistent?

Score chain:
  radiance
  geometry term
  effective area
  NEE PDF
  MIS weight
  BSDF reverse PDF
```

---

## 1. Real-world Cloud aluminium-channel model

Source reference:

```
docs/R3_燈具產品規格.md
```

The physical Cloud light is not a flat rectangular strip facing only upward or outward.

It is better understood as:

```
1. A 16 mm x 16 mm corner aluminium channel.
2. Cross-section resembles a quarter pizza slice.
3. The two straight sides are aluminium plates and do not emit light.
4. The curved outer side is the PC diffuser and emits light.
5. LED tape is inside the channel.
6. The main emitted light direction is outward + upward, approximately 45 degrees.
```

Plain mental picture:

```
The real emitter is a long quarter-cylinder-like diffuser surface.
The useful lighting direction is the diagonal direction between top and outer side.
```

Important consequence:

```
Using a 45-degree diagonal Lambertian normal is physically plausible.
The main problem is not the 45-degree normal by itself.
The main problem is whether all area / PDF / radiance terms agree with that model.
```

---

## 2. Current simplified project model

The project does not model the true curved diffuser geometry.

It simplifies each Cloud light bar as a square-section rectangular rod:

```
Geometry cross-section:
  16 mm x 16 mm square

Accepted emissive faces:
  +Y top face
  outer long face

Non-emissive faces:
  bottom face
  inner long face
  short end faces
```

This simplified model uses two rectangular faces to approximate the physical curved diffuser.

The current shader also uses a 45-degree virtual normal to approximate the diffuser's average output direction.

This creates a hybrid model:

```
A. Shadow-ray hit acceptance:
   top face + outer long face on the square rod.

B. Optical emission direction:
   45-degree diagonal Lambertian normal.

C. Area / PDF / MIS contract:
   currently mixed between 2A and sqrt(2)A.
```

This hybrid can be valid, but only if the contract is explicit and internally consistent.

---

## 3. Four Phase 1C tracking points

### Point 1 — Decide the Cloud effective surface model

Phase 1C first needs one written contract for what Cloud represents mathematically.

Candidate models:

```
A. Two-rectangle model
   Emission surface = top face + outer long face.
   Effective area = 2A.
   Normals may need face-specific treatment.

B. Virtual diagonal model
   Emission surface = one virtual 45-degree diffuser plane.
   Effective area may be A * sqrt(2), or another explicitly chosen diffuser approximation.
   Normal = 45-degree outward-upward.

C. Hybrid practical model
   Shadow hit acceptance = top face + outer long face.
   Optical model = virtual 45-degree diffuser.
   Effective area must be named and used consistently everywhere.
```

Given the real aluminium-channel shape, the current best review hypothesis is:

```
Use model C.

Keep top / outer faces for hit acceptance because the renderer geometry is rectangular.
Keep 45-degree normal because it matches the real curved diffuser's average output direction.
But unify the effective area and PDF contract.
```

---

### Point 2 — Unify effective area across radiance / throughput / PDF / reverse PDF

Current observed code contract:

```
JS computeCloudRadiance:
  L = (lm_total / 2) / (K * pi * A)

Shader NEE throughput:
  cloudEmit * cloudGeom * A * 2 / selectPdf

Shader NEE PDF:
  pdfNeeOmega uses A * sqrt(2)

Shader BSDF reverse PDF:
  pNeeReverse also uses A * sqrt(2)
```

Where:

```
A = uCloudFaceArea[rodIdx]
2A = top + outer rectangular faces
sqrt(2)A = virtual diagonal projected area currently used for PDF
```

The mismatch:

```
Radiance / throughput effectively use 2A.
PDF / reverse PDF use sqrt(2)A.
```

This does not automatically prove the image is wrong, because old visual calibration may have leaned on this ratio.

But for Phase 1C, the mismatch must be resolved or documented as an intentional compensation.

Phase 1C checklist:

```
1. Pick one effective area name.
2. Use that area consistently in direct NEE contribution.
3. Use that same area consistently in pdfNeeOmega.
4. Use the matching representative surface in BSDF reverse PDF.
5. If a brightness compensation remains, name it as compensation instead of hiding it inside area mismatch.
```

---

### Point 3 — Verify Cloud lumens per metre against product ground truth

Product spec says:

```
Cloud LED tape: 480 lm/m
```

Ground-truth per-rod luminous flux from the spec document:

```
East rod:
  480 * 2.4 = 1152 lm

West rod:
  480 * 2.4 = 1152 lm

South rod:
  480 * 1.768 = 848.64 lm

North rod:
  480 * 1.768 = 848.64 lm

Total Cloud:
  about 4000 lm
```

Current main code observed in `js/Home_Studio.js`:

```
CLOUD_ROD_LUMENS = [1600 * 2.4, 1600 * 2.4, 1600 * 1.768, 1600 * 1.768]
```

This is:

```
1600 / 480 = 3.333333...
```

So the current Cloud luminous flux is about 3.33 times the product spec value.

Phase 1C interpretation:

```
If 1600 lm/m is intentional visual compensation:
  expose it as a named compensation factor and document why.

If R3 product-ground-truth is the intended basis:
  main code should return to 480 lm/m and downstream exposure / tonemap should handle the visual result.
```

This point is separate from PDF consistency, but it directly affects early-spp high-value samples.

---

### Point 4 — Treat reverse PDF as dependent on the forward contract

Current BSDF-indirect Cloud reverse PDF uses:

```
cloudTarget = uCloudRodCenter[rodIdx]
cloudDiagArea = A * sqrt(2)
pNeeReverse = pdfNeeForLight(misBsdfBounceOrigin, cloudTarget, faceNormal, cloudDiagArea, 1.0 / uActiveLightCount)
```

This is only a representative approximation.

If the forward model changes, this reverse path must change with it.

Phase 1C rule:

```
Do not perfect reverse PDF first.
First define the forward Cloud effective surface contract.
Then make reverse PDF match that contract.
```

Possible outcomes:

```
A. Keep reverse approximation
   Accept it as coarse representative PDF.
   Document limitations.

B. Remove BSDF-indirect Cloud MIS weighting
   Let BSDF-hit Cloud follow a simpler path if reverse PDF is too approximate.

C. Implement matching reverse PDF
   Only after the forward target distribution and effective area are finalized.
```

---

## 4. Current review findings mapped to Phase 1C

```
Finding 1:
  Cloud direct contribution uses 2A, while PDF uses sqrt(2)A.
  Status: central Phase 1C issue.

Finding 2:
  Target points are on top / outer faces, while normal and PDF use virtual diagonal surface.
  Status: not automatically wrong after real-product clarification.
  Updated interpretation: valid hybrid model candidate, but contract must be explicit.

Finding 3:
  Reverse PDF uses rod center as representative target.
  Status: secondary until forward contract is fixed.

Finding 4:
  Tests still use 480 lm/m while main code uses 1600 lm/m.
  Status: important because product spec confirms 480 lm/m as ground truth.

Finding 5:
  Dynamic pool test expects old pdfNeeForLight occurrence count.
  Status: test fragility; fix after Phase 1C code shape is known.
```

---

## 5. Working hypothesis

The most likely useful Phase 1C direction is not to abandon the 45-degree diagonal model.

The better hypothesis is:

```
The 45-degree diagonal normal is the right abstraction for the real quarter-arc diffuser.

The unstable part is the unresolved contract between:
  two rectangular hit faces,
  virtual diagonal optical normal,
  radiance denominator,
  direct contribution area,
  NEE PDF area,
  reverse PDF area,
  and current 1600 lm/m visual boost.
```

Phase 1C should therefore produce one explicit Cloud effective surface contract before changing behavior.

---

## 6. Suggested Phase 1C progress checklist

```
1. Read-only math audit
   Confirm every Cloud formula that uses A, 2A, sqrt(2)A, lm/m, and faceNormal.

2. Choose effective surface contract
   Prefer hybrid rectangular-hit / diagonal-optical model unless contradicted by visual validation.

3. Define named constants
   Avoid hidden area compensation.
   Any visual boost should have an explicit name.

4. Update tests after contract is chosen
   Do not let old structural tests define new physics.

5. Implement one minimal patch
   Keep scope limited to Cloud radiance / area / PDF / MIS consistency.
   No denoise, no SVGF, no reprojection, no accumulation rewrite.

6. Visual validation
   Compare the same C3 bounce14 milestones against baseline, Phase 1A, and Phase 1B.
```

---

## 7. Guardrails

```
Do not pivot to Blender.
Do not pivot to native Mac / Metal.
Do not pivot to WebGPU.
Do not add denoise.
Do not add SVGF.
Do not add temporal reprojection.
Do not change accumulation pipeline.
Do not hide a physics mismatch behind a firefly clamp.
```

