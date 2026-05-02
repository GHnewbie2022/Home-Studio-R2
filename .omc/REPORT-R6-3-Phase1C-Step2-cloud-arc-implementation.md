# REPORT — R6-3 Phase 1C Step 2 Cloud arc implementation

> Date: 2026-05-02
> Scope: Cloud aluminium-channel light-bar physical surface implementation in existing HTML / WebGL2 renderer.
> Renderer scope: no Blender / WebGPU / native Metal pivot.
> Status: implementation note; visual acceptance still requires user-side judgment.

---

## 0. Decision

Phase 1C implements Cloud as an analytic 1/4 arc diffuser.

```
A_face = 0.016 * rodLength
A_arc  = (pi / 2) * A_face
L      = Phi_rod / (K(T) * pi * A_arc)
```

This replaces the previous mixed contract:

```
direct throughput area = 2A
NEE PDF area           = sqrt(2)A
reverse PDF point      = rod center / diagonal representative
```

The new contract uses the same arc surface for:

```
1. JS radiance denominator
2. shader NEE target distribution
3. shader geometry term normal
4. shader NEE solid-angle PDF
5. shader BSDF reverse PDF
6. shader direct Cloud hit geometry
```

---

## 1. Physical model

Cloud product interpretation:

```
The light is a 16 mm corner aluminium channel.
The aluminium plate body is modelled visually, but its thickness is not subtracted from the optical arc.
The inner-side aluminium plate is non-emissive aluminium.
The curved outside surface is the diffuser.
The diffuser fills the 16 mm x 16 mm quarter-pizza outline and is approximated as a long 1/4 cylinder with 16 mm radius.
```

The renderer still keeps the rectangular rod data as a source of placement and dimensions.

```
Rectangular proxy:
  supplies rod center, half extent, length, and object id.

Analytic arc:
  supplies real hit surface, local normal, sampled target, and optical area.
```

---

## 2. Code patch range

Changed files:

```
js/Home_Studio.js
Home_Studio.html
shaders/Home_Studio_Fragment.glsl
docs/tests/r3-3-cloud-radiance.test.js
docs/tests/r3-5b-cloud-area-nee.test.js
docs/tests/r3-6-5-dynamic-pool.test.js
```

Shader-level changes:

```
1. Added CLOUD_ARC_AREA_SCALE = pi / 2.
2. Added Cloud arc helpers:
   cloudOutAxis()
   cloudLongAxis()
   cloudLongHalf()
   cloudCrossHalf()
   cloudArcRadius()
   cloudArcCenter()
   cloudArcNormal()
   CloudArcIntersect()
3. Cloud NEE now samples theta uniformly on [0, pi/2] and length uniformly on the rod axis.
4. Cloud NEE throughput now uses cloudArcArea.
5. Cloud NEE PDF now uses the same cloudTarget, localNormal, and cloudArcArea.
6. SceneIntersect skips the rectangular Cloud proxy as geometry and adds analytic arc intersections.
7. Cloud hit branch treats analytic arc hits as emissive surface hits.
8. BSDF reverse PDF now uses the actual hit point x, hitNormal, and cloudArcArea.
9. Removed old uCloudFaceCount / CLOUD_DIAGONAL_FACE_AREA_SCALE contract from live shader and JS.
```

JS-level changes:

```
1. Added CLOUD_ARC_RADIUS = 0.016.
2. Added CLOUD_ARC_AREA_SCALE = Math.PI * 0.5.
3. computeCloudRadiance() now divides by A_arc.
4. 1600 lm/m remains the current user-selected default.
5. 480 lm/m remains recorded as product lower reference.
6. Cloud debug log now reports cloudArcAreaScale.
```

---

## 3. Current numeric anchors

For 4000 K, using K(T)=320:

```
480 lm/m reference:
  E/W rod Phi = 1136.64 lm
  A_face = 0.037888 m^2
  A_arc = 0.0595143312 m^2
  L = 18.9977 W/(sr*m^2)

1600 lm/m current default:
  E/W rod Phi = 3788.8 lm
  A_face = 0.037888 m^2
  A_arc = 0.0595143312 m^2
  L = 63.3257 W/(sr*m^2)

Current / reference ratio:
  1600 / 480 = 3.3333333333
```

---

## 4. Tests updated

Updated tests now protect the Phase 1C contract:

```
docs/tests/r3-3-cloud-radiance.test.js
  Locks computeCloudRadiance() to A_arc = (pi / 2) * A_face.

docs/tests/r3-5b-cloud-area-nee.test.js
  Locks A_arc numeric anchor, 1600/480 ratio, rod geometry, and pool size.

docs/tests/r3-6-5-dynamic-pool.test.js
  Replaces brittle pdfNeeForLight occurrence count with semantic shader checks:
    CLOUD_ARC_AREA_SCALE present
    CloudArcIntersect present
    cloudArcArea present
    old diagonal area scale absent
    old Cloud face-count uniform absent
```

---

## 5. Machine validation

Ran on 2026-05-02:

```
node docs/tests/r3-3-cloud-radiance.test.js
  PASS

node docs/tests/r3-5b-cloud-area-nee.test.js
  PASS

node docs/tests/r3-6-5-dynamic-pool.test.js
  PASS

git diff --check
  PASS, no output
```

Headless Brave smoke:

```
Loaded http://localhost:9002/Home_Studio.html through a local python3 http.server.
Observed JS init logs, BVH rebuild logs, and WebGL context activity.
No GLSL shader compile error was observed in console output before the smoke process was stopped.
Brave emitted GPU initialization / ReadPixels performance messages under headless SwiftShader.
```

---

## 6. Remaining validation

Machine-side validation can confirm compile and contract consistency.

Visual validation still needs the user to judge:

```
1. Does C3 Cloud-only still look physically plausible?
2. Did early-spp Cloud speckle improve, degrade, or stay similar?
3. After formula correction, should C3 and C4 brightness policy be revisited?
```

---

## 7. 2026-05-02 visual follow-up

User visual verdict after comparing Phase 1C against Phase 1A at 300 spp:

```
1. Noise improvement is small, roughly 5% by eye.
2. Main visible improvement is that the central Cloud shadow becomes soft-edged.
3. Side-wall top light/dark boundary is also improved.
4. Wall illumination is slightly brighter and more physically plausible.
```

Conclusion:

```
Phase 1C is worth keeping for more realistic lighting, even though it is not a major noise fix.
```

Follow-up geometry patch:

```
Observed issue:
  E/W rods visually overlap the S/N rods near the four corners.

Decision:
  Trim both ends of the E/W rods by 16 mm.
  Keep S/N rods unchanged.

Reason:
  This creates four 16 mm x 16 mm non-emissive corner reliefs.
  The model is symmetric and closer to real aluminium-channel end caps / corner hardware.
  It avoids assigning each corner to an arbitrary rod direction.

Updated E/W length:
  old = 2.400 m
  new = 2.368 m

Energy handling:
  CLOUD_ROD_LENGTH now drives both CLOUD_ROD_LUMENS and CLOUD_ROD_FACE_AREA.
  Radiance per metre remains unchanged.
  Total Cloud flux is reduced only by the removed physical length.
```

---

## 8. 2026-05-02 aluminium channel plate completion

User observation:

```
Looking from the inner side of the Cloud panel toward the aluminium channel,
the non-emissive aluminium plates are missing.
The physical channel should have:
  1. bottom aluminium plate
  2. inner-side aluminium plate
  3. outer curved diffuser surface
```

Patch v1:

```
Added 8 non-emissive Cloud aluminium boxes:
  E bottom plate
  E inner-side plate
  W bottom plate
  W inner-side plate
  S bottom plate
  S inner-side plate
  N bottom plate
  N inner-side plate

Bottom plate y range:
  2.788 .. 2.789

Reason:
  GIK top is y=2.787.
  The bottom aluminium plate is lifted 1 mm to avoid overlap.

Material:
  color     = C_STAND_PILLAR
  roughness = 0.55
  metalness = 1.0

Visibility:
  fixtureGroup = 4, same as Cloud light-strip geometry.
```

Index update:

```
Cloud rods stay at sceneBoxes[71..74].
Cloud aluminium plates occupy sceneBoxes[75..82].
Desk reference block moves to sceneBoxes[83].
BASE_BOX_COUNT changes from 75 to 83.
```

Patch v2:

```
User verdict:
  Bottom plates looked wrong where the light strip touches the GIK panel.
  The bottom side is mostly hidden in normal views.

Change:
  Removed all 4 bottom plates.
  Kept only the 4 inner-side aluminium plates.

Current aluminium plate set:
  E inner-side plate
  W inner-side plate
  S inner-side plate
  N inner-side plate

Current index update:
  Cloud rods stay at sceneBoxes[71..74].
  Cloud inner-side aluminium plates occupy sceneBoxes[75..78].
  Desk reference block moves to sceneBoxes[79].
  BASE_BOX_COUNT changes from 83 to 79.
```

Physical interpretation:

```
The real product should emit from the curved PC diffuser surface.
The aluminium bottom and inner side should not emit.
End caps, if present, should also be non-emissive.

Patch v2 renderer contract:
  emissive surface = analytic 1/4 arc only
  inner aluminium  = non-emissive matte aluminium
  bottom aluminium = omitted to avoid contact artifacts with GIK
  end caps         = omitted for now
```

Patch v3:

```
User decision:
  Restore the bottom aluminium plate as a physical 1 mm plate.
  Keep the full external aluminium-channel body at 16 mm x 16 mm.
  Let the diffuser arc grow from the top of that bottom plate.

Geometry:
  bottom aluminium plate y range = 2.787 .. 2.788
  inner-side aluminium plate y range = 2.788 .. 2.803
  diffuser arc center y = 2.788
  diffuser arc radius = 0.015 m

Optical area:
  A_face = 0.015 * rodLength
  A_arc  = (pi / 2) * A_face

Index update:
  Cloud rods stay at sceneBoxes[71..74].
  Cloud aluminium plates occupy sceneBoxes[75..82].
  Desk reference block moves to sceneBoxes[83].
  BASE_BOX_COUNT changes from 79 to 83.

Current renderer contract:
  emissive surface = analytic 1/4 arc only
  bottom aluminium = non-emissive matte aluminium, 1 mm thick
  inner aluminium  = non-emissive matte aluminium
  end caps         = omitted for now
```

Patch v4:

```
User decision:
  Remove the old desktop Lambertian reference block.
  The block is not used and is not visible in the current validation views.

Index update:
  Cloud rods stay at sceneBoxes[71..74].
  Cloud aluminium plates occupy sceneBoxes[75..82].
  No desktop reference block remains in base geometry.
  BASE_BOX_COUNT changes from 83 to 82.
```

Patch v5:

```
User visual finding:
  The 15 mm arc made the aluminium edge protrude by about 1 mm in close-up views.

Decision:
  Restore the optical diffuser to the full 16 mm quarter-pizza outline.
  Keep aluminium plates as visual non-emissive geometry.
  Do not subtract aluminium-plate thickness from the diffuser radius.

Geometry:
  diffuser arc center returns to the 16 mm proxy lower-inner corner
  diffuser arc radius = 0.016 m
  bottom aluminium plate y range = 2.786 .. 2.787
  pizza outline y range = 2.787 .. 2.803

Optical area:
  A_face = 0.016 * rodLength
  A_arc  = (pi / 2) * A_face

Current numeric anchor, E/W at 4000 K:
  480 lm/m  -> 18.9977 W/(sr*m^2)
  1600 lm/m -> 63.3257 W/(sr*m^2)
```

Patch v6:

```
User visual finding:
  The inner aluminium side still showed a 90-degree gap in close-up views.
  South/North bottom plates were present in code, but y=2.786..2.787 made them hard to see behind the GIK top surface.

Decision:
  Keep the optical 16 mm pizza unchanged.
  Adjust only the non-emissive aluminium plate geometry.

Geometry:
  inner-side aluminium plates:
    y range = 2.786 .. 2.803
    visible height = 17 mm

  bottom aluminium plates:
    y range = 2.786 .. 2.787
    cross-section width = 15 mm

Reason:
  The 17 mm inner plate covers the y=2.787..2.788 seam.
  The 15 mm bottom plate avoids protruding past the 16 mm optical pizza outline.
  The optical area and Cloud radiance formula remain unchanged.
```

Patch v7:

```
User visual finding:
  The 15 mm bottom plate disappears from some angles.
  A small gap appears between the bottom plate and the 16 mm pizza arc edge.

Decision:
  Keep inner-side aluminium plates at 17 mm height.
  Restore bottom plate cross-section width to 16 mm.
  Let the extra 1 mm of the inner-side plate cover the interior 90-degree seam.

Geometry:
  inner-side aluminium plates:
    y range = 2.786 .. 2.803
    visible height = 17 mm

  bottom aluminium plates:
    y range = 2.786 .. 2.787
    cross-section width = 16 mm

Reason:
  The 16 mm bottom plate reaches the 16 mm pizza arc edge.
  The 17 mm inner-side plate covers the seam from the interior view.
  The optical area and Cloud radiance formula remain unchanged.
```

Patch v8:

```
User visual finding:
  South/North bottom plates still disappear from some viewing angles.

Root cause:
  Bottom plates were at y=2.786..2.787.
  Cloud GIK panels occupy y=2.669..2.787.
  Therefore the bottom plates were embedded into the GIK top boundary.

Decision:
  Move all bottom aluminium plates above the GIK top.
  Keep bottom plate width at 16 mm.
  Keep inner-side aluminium plates at 17 mm height.
  Keep the optical 16 mm pizza and radiance formula unchanged.

Geometry:
  bottom aluminium plates:
    y range = 2.787 .. 2.788
    cross-section width = 16 mm

  inner-side aluminium plates:
    y range = 2.786 .. 2.803
    visible height = 17 mm
```

Patch v9:

```
User visual finding:
  The north Cloud strip still looked like it was missing its inner aluminium side plate.

Root cause:
  The N inner-side plate existed in sceneBoxes, but it was only 1 mm thick:
    z range = -0.686 .. -0.685
  Its outer boundary sits exactly on the analytic arc center edge:
    z = -0.686
  From north-side close-up views, the bright analytic arc can visually eat this thin edge,
  making the aluminium side look absent.

Decision:
  Keep the optical 16 mm pizza unchanged.
  Keep bottom plates unchanged.
  Expand only the N inner-side non-emissive aluminium plate inward by 1 mm.

Geometry:
  N inner-side aluminium plate:
    old z range = -0.686 .. -0.685
    new z range = -0.686 .. -0.684
    y range     =  2.786 ..  2.803

Reason:
  The extra 1 mm goes toward the Cloud center side, away from the emitting arc surface.
  Therefore it improves visible aluminium coverage without changing Cloud arc area,
  Cloud radiance, NEE PDF, or MIS formulas.
```

Patch v10:

```
User visual finding:
  The north inner aluminium plate is not the only issue.
  East/West inner aluminium plates are visibly lit, while the channel interior should stay dark
  with only weak reflected ceiling light.

Root cause:
  Cloud aluminium plates used the speaker-stand aluminium material:
    roughness = 0.55
    metalness = 1.0
  In the current path tracer, that sends the plates through the rough metal reflection path.
  Near a very bright Cloud arc emitter, the inner baffle can therefore reflect the emitter strongly.

Decision:
  Revert the temporary N inner-side 2 mm thickness change.
  Keep all plate geometry at the Patch v8 dimensions.
  Add a shader-side Cloud aluminium baffle path for object IDs 76..83.

Behavior:
  Cloud aluminium baffle surfaces:
    skip Cloud NEE
    skip metal mirror path
    continue only with cosine-weighted diffuse bounce

Reason:
  This keeps the aluminium plate visible as a non-emissive blocker.
  The inside of the channel receives light only through later reflected paths,
  matching the intended dark interior with weak ceiling-reflection glow.
  Cloud arc area, radiance, NEE PDF, and MIS formulas remain unchanged.
```

Patch v11:

```
User correction:
  Debugging must explain why the north side fails while the other three sides look normal.

Revised root cause:
  CloudArcIntersect accepted both the front side and back side of the analytic arc.
  The north close-up view can see into the back side of the N arc through the channel interior.
  That makes the arc itself appear where the dark inner aluminium plate should dominate.

Decision:
  Remove the shader-wide Cloud aluminium baffle shortcut from Patch v10.
  Keep aluminium material behavior unchanged.
  Make the analytic Cloud arc one-sided by accepting an arc hit only when:
    dot(rayDirection, arcNormal) < 0

Reason:
  The diffuser arc emits on its outward/upward side.
  From the inward side, the camera should not see an emissive back face.
  This directly targets the north-only close-up failure without changing all aluminium plates.

Formula impact:
  Cloud arc area, radiance, NEE PDF, and MIS formulas remain unchanged.
  Only direct visibility / intersection acceptance of the arc back side changes.
```

Patch v12:

```
User visual finding:
  Patch v11 made the north strip look transparent.

Root cause:
  Patch v11 made the arc one-sided at intersection time.
  That removed the back-side intersection entirely.
  From the north inner view, rays then passed through the diffuser instead of hitting an opaque surface.

Decision:
  Keep one unified rule for all four rods:
    the analytic arc is double-sided for intersection / occlusion
    the analytic arc is single-sided for emission

Implementation:
  CloudArcIntersect again accepts valid arc hits from both sides.
  CLOUD_LIGHT handling now checks:
    cloudFrontFacing = dot(rayDirection, hitNormal) < 0

  If front-facing:
    use normal emissive Cloud logic.

  If back-facing:
    do not emit.
    do not accumulate NEE.
    treat the surface as an opaque dark diffuser with weak indirect bounce.

Reason:
  This prevents transparency and prevents back-side self-emission.
  It applies identically to E/W/S/N rods, while fixing the north-only visible failure.
```

Patch v13:

```
User visual finding:
  The north inner aluminium plate is still empty.
  West inner aluminium plate is visible and dark; north should match that behavior.

Root cause:
  The N inner-side aluminium plate is the final Cloud aluminium addBox.
  Its sceneBoxes index is 82.

  Live code had:
    BASE_BOX_COUNT = 82

  Later config rebuild logic does:
    sceneBoxes.length = BASE_BOX_COUNT

  JavaScript length 82 keeps indices 0..81 and drops index 82.
  Therefore only the N inner-side aluminium plate was actually removed.
  E/W/S inner plates survive because their indices are 79..81.

Evidence:
  Cloud section addBox count = 12
  CLOUD_BOX_IDX_BASE = 71
  expected BASE_BOX_COUNT = 71 + 12 = 83
  actual BASE_BOX_COUNT before patch = 82
  dropped index = 82

Decision:
  Set BASE_BOX_COUNT to 83.
  Remove the speculative Patch v12 back-facing Cloud arc shading branch.

Reason:
  The observed north-only failure is caused by sceneBoxes truncation, not by arc-sidedness.
  Fixing the count preserves all eight aluminium plates and restores N inner plate parity.
```
