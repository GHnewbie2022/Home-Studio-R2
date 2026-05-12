# R7-3.9 C1 Reflection Bake SOP Reset

Date: 2026-05-12
Branch: `codex/r7-3-9-c1-reflection-bake`
Status: reset to R7-3.8 C1 sprout diffuse-only runtime

## 0. Current Runtime Contract

R7-3.9 reflection has no accepted runtime package.

Terminology:

```text
C1 means Config 1, selected by applyPanelConfig(1).
C1 does not mean Camera 1.
All final reflection requirements apply to Config 1 as the active room scene while the user moves the camera freely inside that scene.
```

Current allowed visual state:

```text
1.  Config 1 central sprout area uses the accepted R7-3.8 pure diffuse bake.
2.  R7-3.9 reflection pointer stays at packageStatus = none.
3.  Runtime starts with R7-3.9 reflection disabled.
4.  No R7-3.9 reflection cache is loaded at startup.
5.  .omc/r7-3-9-c1-accurate-reflection-bake/ is cleared.
6.  .omc/r7-3-9-c1-accurate-reflection-preview/ is cleared.
```

Pointer file:

```text
docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json
```

The pointer may change to `accepted` only through a reviewed patch after this SOP's automated and visual gates pass.

## 1. Official Reference Basis

Future work must start from these facts. Keep the source links with the SOP so the next agent can refresh them.

| Source | Official excerpt | 中文翻譯 | SOP consequence |
| --- | --- | --- | --- |
| Unreal Engine Planar Reflections | "renders the level again from the direction of the reflection" | 從反射方向重新渲染場景。 | 自由移動的正確反射必須依目前視角重新取得反射方向資料；有限視角 bake 不可當最終解。 |
| Unity HDRP Screen Space Reflection | "uses the depth and color buffer of the screen" | 使用目前畫面的深度與色彩 buffer。 | SSR 是目前畫面資料，會受相機與畫面可見範圍限制。 |
| Unity Ray-Traced Reflections | "can make use of off screen data" | 可以使用畫面外資料。 | 高精度自由視角反射需要依目前視角追蹤反射方向並取得畫面外資料。 |
| three.js CubeCamera | "positioned in 3D space to render its surroundings" | 放在 3D 空間中的位置，用來渲染周圍環境。 | Cubemap 是某個 3D 位置的環境 probe，不能證明整片平面 patch 的精確反射。 |
| pbrt BSDF Representation | "given pair of directions" | 給定一組方向配對。 | 反射資料必須把觀看方向納入 key；單一表面位置資料不足以代表視角變化。 |

URLs:

```text
https://dev.epicgames.com/documentation/en-us/unreal-engine/planar-reflections-in-unreal-engine
https://docs.unity.cn/Packages/com.unity.render-pipelines.high-definition%4012.1/manual/Override-Screen-Space-Reflection.html
https://docs.unity.cn/Packages/com.unity.render-pipelines.high-definition%407.1/manual/Ray-Traced-Reflections.html
https://threejs.org/docs/pages/CubeCamera.html
https://www.pbr-book.org/4ed/Reflection_Models/BSDF_Representation
```

## 2. Failed Attempt Root Cause

The failed R7-3.9 runtime sampled a Config 1 camera-reference texture with screen coordinates:

```glsl
gl_FragCoord.xy / uResolution
```

Observed user symptom:

```text
The reflected silhouette looked fixed to one Config 1 camera view.
When the camera moved, the silhouette moved with the camera.
```

Root cause:

```text
1.  The cache address was screen space, not floor surface space.
2.  The cached image was a Config 1 camera reference layer, not reflection data evaluated from the current camera state.
3.  Sample count was irrelevant after the coordinate system failed.
4.  A 1000 spp camera-space cache can still be physically invalid.
```

## 3. Cleared Invalid Artifacts

These paths are invalid source data:

```text
.omc/r7-3-9-c1-accurate-reflection-bake/20260511-190523/
.omc/r7-3-9-c1-accurate-reflection-bake/20260511-235900/
.omc/r7-3-9-c1-accurate-reflection-bake/20260512-134902/
.omc/r7-3-9-c1-accurate-reflection-preview/
```

Failure summary:

```text
1.  20260511-190523 and 20260511-235900 were large-floor / wrong-target packages.
2.  20260512-134902 was sample-averaged and sprout-clipped, but still camera-space reference data from Config 1.
3.  Preview reports from those packages only prove that a wrong cache was displayed.
```

## 4. Final Goal And First Valid Target

Final user goal:

```text
1.  The user must be able to move freely inside the room.
2.  In Config 1, reflections must remain physically correct for the current camera position and direction.
3.  The reflection may change with viewpoint, but it must change because the current surface point and outgoing direction are physically evaluated.
4.  The final accepted solution must not be limited to a finite list of baked camera views.
5.  The final accepted solution must not use nearest-direction lookup, direction interpolation, cubemap substitution, screen copy, Config 1 camera reference image, zero fill, or live-noise fallback to fake missing directions.
```

The first future target remains:

```text
target name = sprout_reflection_c1
x range = -1.0 .. 1.0
z range = -1.0 .. 1.0
y = 0.01
normal = [0, 1, 0]
floor roughness for route/probe = 0.1
fixed samples = exactly 1000 spp for every Config 1 reference_only probe artifact
```

Important contract:

```text
The UI floor roughness controls the surrounding live floor.
The future sprout reflection route uses roughness 0.1 for the sprout patch.
At UI roughness 1, surrounding floor has no mirror-like reflection.
At UI roughness 1, sprout patch behavior follows the explicit route contract and must be visually approved.
```

Config 1 1000 spp probe premise:

```text
1.  Config 1 is selected for probe work because it can reach 1000 spp quickly.
2.  Future R7-3.9 Config 1 reflection probes and reference_only artifacts must run to exactly 1000 spp.
3.  Probe coordinate correctness is evaluated using the 1000 spp Config 1 artifact.
4.  The probe sample count is fixed because the comparison target is live path tracing after it reaches 1000 spp and hibernates.
5.  actualSamples below 1000 rejects the artifact.
6.  actualSamples above 1000 rejects the artifact.
7.  Reaching exactly 1000 spp is probe evidence, not acceptance by itself.
8.  A 1000 spp probe artifact still fails if surface position, outgoing direction, target mask, roughness, or free-movement validation fails.
```

## 5. Required Runtime Data Model

A future accepted R7-3.9 reflection solution must use this route:

```text
runtime model =
  live path-traced or planar-reflection-equivalent evaluation from the current camera

allowed baked data =
  view-independent surface data only, such as target mask, surface position metadata, surface normal metadata, roughness metadata, and diffuse bake

address =
  surface target id
  surface texel or world position
  current outgoing direction from current camera
  roughness value

required payload =
  current-view reflection radiance RGB
  current outgoing direction vector
  surface position metadata
  surface normal metadata
  roughness metadata
  target mask

missing data rule =
  Missing target, position, normal, roughness, or current-view reflection route rejects the solution before runtime.
```

Planar reflection pass role:

```text
Allowed as a candidate runtime route for planar sprout floor reflection if it is evaluated from the current camera.
It may help verify reflected viewpoint geometry.
It does not allow finite baked camera-view substitution.
```

## 6. Free-Movement Reflection Contract

Official-source conclusion:

```text
1.  Ray-traced reflection gets the needed off-screen scene data by tracing rays for the current view.
2.  Planar reflection gets the needed reflected view by rendering the scene again from the reflected direction.
3.  Cubemap stores surrounding directions only from one 3D probe position.
4.  BSDF evaluation depends on a pair of directions.
```

R7-3.9 final consequence:

```text
1.  A finite camera-view bake cannot satisfy the final goal.
2.  Direction bins cannot satisfy the final goal unless they are mathematically exact for every possible camera position inside the allowed room movement domain, which is not practical for this project.
3.  The accepted runtime must compute or render the reflection for the current camera state.
4.  The accepted runtime may use baked surface metadata, masks, and diffuse data.
5.  The accepted runtime must not use baked reflection radiance captured from a finite set of camera views as the final reflection answer.
```

Allowed final routes:

```text
1.  Runtime ray/path tracing for sprout_reflection_c1 using the current camera, current surface position, current surface normal, current roughness, and current outgoing direction.
2.  Runtime planar reflection for sprout_reflection_c1, if it renders the scene again from the current reflected viewpoint and uses the sprout target mask.
3.  Hybrid route where baked data supplies only view-independent inputs and runtime computes current-view reflection radiance.
```

Rejected final routes:

```text
1.  Any finite validation-view reflection bake promoted as the final answer.
2.  Any outgoing-direction bin table promoted as the final answer through interpolation or nearest lookup.
3.  Any precomputed Config 1 camera reflection texture promoted as runtime reflection.
4.  Any cubemap or probe promoted as runtime reflection.
5.  Any fallback that uses zero, live noise, surrounding floor color, screen copy, or camera reference image when current-view reflection data is unavailable.
6.  Any result that is visually acceptable only from one Config 1 camera pose or a small set of camera positions.
```

Free-movement validation domain:

```text
1.  The validation domain is the user-accessible room camera movement range, not a finite camera list.
2.  Automated validation may sample many camera states from that domain, but sampled validation does not redefine the goal.
3.  A sampled camera state passes only if runtime reflection is computed from that current camera state.
4.  A failed sampled camera state fails the route.
5.  Passing sampled validation still requires user visual acceptance during free camera movement.
```

## 7. Probe-Only Tools

These tools can diagnose problems, but cannot become accepted runtime data:

```text
1.  Config 1 camera reference render.
2.  Cubemap probe.
3.  One-off screenshot comparison.
4.  Preview overlay.
5.  Cropped camera image.
6.  Roughness-matched whole-floor cache.
7.  Finite camera-view reflection bake.
8.  Direction-bin reflection table.
```

All probe outputs must be labeled `reference_only` and kept inside `.omc`.

## 8. Blocked Directions

The following directions are hard no-go for R7-3.9 acceptance:

```text
1.  Crop a large-floor reflection package into sprout_reflection_c1.
2.  Use a Config 1 camera screenshot as runtime reflection data.
3.  Use a camera-reference layer as runtime reflection data.
4.  Address reflection data with gl_FragCoord, screen UV, canvas UV, or camera-facing raster coordinates.
5.  Promote a route based only on 1000 spp while coordinate correctness still fails.
6.  Accept a cubemap runtime as the R7-3.9 answer.
7.  Treat roughness match as proof that the cache is physically valid.
8.  Let a capture runner write the accepted pointer automatically.
9.  Accept a route without free-movement validation.
10. Accept a route whose preview only tests the original Config 1 camera pose.
11. Accept any finite camera-view reflection bake as the final free-movement answer.
12. Accept any outgoing-direction bin table as the final free-movement answer.
13. Use nearest-direction lookup or interpolation to fake current-view reflection.
14. Fill missing directions with cubemap, screen copy, Config 1 camera reference image, zero, or live-noise fallback.
15. Claim success from one Config 1 camera pose, three-view, or other sampled-view validation.
```

## 9. Automated Acceptance Gates

A route can become accepted only after all gates pass:

```text
1.  Pointer status changes from none to accepted in a reviewed patch.
2.  First accepted target list is exactly ["sprout_reflection_c1"].
3.  outsideSproutPixels = 0.
4.  insideSproutPixels > 0.
5.  nonFiniteReflectionSamples = 0.
6.  Radiance is averaged by actualSamples.
7.  actualSamples equals exactly 1000 for the Config 1 reference_only probe artifact.
8.  Reflection route/probe roughness is exactly 0.1.
9.  Runtime sampler contains no gl_FragCoord lookup for reflection cache addressing.
10. Runtime sampler contains no screen UV or canvas UV reflection cache addressing.
11. Runtime address includes surface position or surface texel.
12. Runtime computes outgoing direction from current camera state.
13. Runtime reflection radiance is computed or rendered for the current camera state.
14. Runtime contains no finite-view reflection radiance lookup promoted as final answer.
15. Runtime contains no nearest-direction or interpolation fallback for reflection radiance.
16. Runtime contains no cubemap, screen copy, Config 1 camera reference image, zero fill, or live-noise fallback for missing current-view reflection.
17. Automated free-movement validation samples camera states across the user-accessible room movement domain.
18. Every sampled camera state uses the current-view reflection route.
19. Any failed sampled camera state fails the route.
20. Capture runner writes reference-pointer.json only, until manual acceptance.
21. R7-3.8 diffuse pointer remains unchanged unless the user explicitly asks to replace it.
```

## 10. Visual Acceptance Gates

Visual checks must happen after automated gates pass.

Required checks:

```text
1.  Move freely inside the room through the user-accessible camera movement range.
2.  Reflection must stay locked to the floor patch under camera movement.
3.  Reflection content may shift with viewing angle, and the shift must come from current-view reflection computation.
4.  No camera-fixed silhouette may appear.
5.  At UI roughness 1, floor outside sprout patch has no mirror-like reflection.
6.  At UI roughness 1, sprout patch behavior matches the explicit route contract.
7.  At UI roughness 0.1 and 1000 spp, sprout patch joins surrounding live floor without visible seam.
8.  Ceiling light reflection shape must match the physically traced reference for the same surface and direction route.
9.  No camera position inside the user-accessible movement range may reveal finite-view popping, direction-bin stepping, nearest-direction snapping, or interpolation smear.
```

User visual acceptance is required for the final seam and reflection-shape judgement.

## 11. Runtime Loader Rules

Runtime loader behavior:

```text
1.  Load R7-3.8 diffuse bake normally.
2.  Treat R7-3.9 pointer status none, reference_only, or rejected as disabled.
3.  Keep uR739C1AccurateReflectionMode = 0 when packageStatus is not accepted.
4.  Keep uR739C1ReflectionReady = 0 when packageStatus is not accepted.
5.  Do not fetch .omc reflection cache binaries during startup while packageStatus = none.
```

Capture runner behavior:

```text
1.  A runner may create .omc reference packages.
2.  A runner writes .omc/.../reference-pointer.json.
3.  A runner does not update docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json.
4.  Promotion to accepted requires manual patch review.
```

## 12. Required Tests Before Any Future Promotion

Required test set:

```text
node docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
node docs/tests/r7-3-8-c1-bake-paste-preview.test.js
node docs/tests/r7-3-8-c1-1000spp-bake-capture.test.js
node docs/tests/r6-3-max-samples.test.js
node --check js/Home_Studio.js
node --check js/InitCommon.js
node --check js/PathTracingCommon.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
git diff --check
```

Additional required grep checks:

```text
No accepted R7-3.9 pointer unless promotion is intentional.
No gl_FragCoord inside the runtime reflection cache sampler.
No screen UV / canvas UV reflection cache addressing.
No references to cleared .omc R7-3.9 packages as source data.
No finite-view reflection radiance lookup promoted as final answer.
No direction-bin reflection table promoted as final answer.
No nearest-direction or interpolation fallback for current-view reflection radiance.
No missing-direction fallback through cubemap, screen copy, Config 1 camera reference image, zero fill, or live-noise fallback.
```

## 13. Handoff For Next Agent

Read this file first:

```text
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/superpowers/plans/2026-05-11-r7-3-9-c1-reflection-bake.md
```

Immediate task when R7-3.9 resumes:

```text
1.  Preserve current R7-3.8 Config 1 sprout diffuse-only runtime.
2.  Implement a current-view reflection route for free camera movement.
3.  Add failing tests for that route.
4.  Generate exact 1000 spp Config 1 reference_only probe artifacts only for comparison.
5.  Keep accepted pointer at packageStatus = none until every gate above passes.
6.  Ask for user visual acceptance only after automated evidence is clean.
```

## 14. Current-View Route Implementation Evidence

Status: automated validation complete; sprout V2 user visual acceptance invalidated by 1 spp A/B check.

Evidence:

```text
1.  Config 1 current-view route is implemented for sprout_reflection_c1.
2.  The route computes from the active camera state at runtime.
3.  The route roughness is 0.1.
4.  The automated validation sampled 5 anchor camera states and 9 deterministic sweep states.
5.  Every current-view on render and current-view off render finished at exactly 1000 spp.
6.  The runner passed with visibleStateCount = 3, deltaStateCount = 2, and cameraStateVariation = true.
7.  The validation report is .omc/r7-3-9-config1-current-view-reflection/20260512-234138/validation-report.json.
8.  The accepted pointer records routeStatus = invalidated_by_ab_visual_check and runtimeEnabled = false.
```

Follow-up fix:

```text
1.  Initial implementation enabled the route only through the validation helper.
2.  Manual visual review therefore saw no sprout reflection in normal runtime.
3.  r739C1CurrentViewReflectionPreviewEnabled now defaults to true for visual acceptance.
4.  Exact 1000 spp validation still temporarily disables preview during off/on comparison, then restores it.
5.  Revalidated report: .omc/r7-3-9-config1-current-view-reflection/20260513-000236/validation-report.json.
```

Startup sync fix:

```text
1.  Preview enabled state alone was not enough because Home_Studio.js initialized uR739C1CurrentViewReflectionMode to 0.0.
2.  Normal page load did not call the current-view uniform sync function, so manual visual review still saw mode 0.
3.  initTHREEjs() now calls updateR739C1CurrentViewReflectionUniforms() after initSceneData().
4.  Revalidated report: .omc/r7-3-9-config1-current-view-reflection/20260513-003133/validation-report.json.
```

Sprout V2 visual acceptance:

```text
1.  Later A/B visual check at 1 spp invalidated the sprout V2 acceptance.
2.  A diffuse mode shows the central sprout patch clean.
3.  B original V2 and C reflection-only are both noisy like live path tracing.
4.  D roughness 1 proves the central patch roughness is forced to 0.1.
5.  The previous 1000 spp blend did not prove baked diffuse plus reflection integration.
6.  The active safe baseline returns to R7-3.8 sprout diffuse bake.
7.  Current-view reflection remains diagnostic until a new integration route preserves baked diffuse at 1 spp.
```
