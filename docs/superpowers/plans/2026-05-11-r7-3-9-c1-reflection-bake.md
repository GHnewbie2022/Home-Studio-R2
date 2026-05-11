# R7-3.9 C1 Accurate Reflection Bake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** First obtain the central-sprout-only 0.1 reflection bake package for C1. Later expansion to iron door, speaker stands, and speaker cabinets stays blocked until the sprout package is correct.

**Architecture:** Treat reflection as view-dependent radiance, not as a single room-center environment photo. First capture a C1 path-traced reflection reference layer as ground truth, then build a central-sprout-only reflection cache aligned to the accepted R7-3.8 diffuse patch. Runtime uses the accepted diffuse atlas for matte light and adds baked 0.1 reflection only inside that same sprout patch.

**Tech Stack:** HTML / JavaScript / WebGL2 / GLSL, existing Three.js renderer, existing path tracer, Codex-run CDP runner, `.omc` artifact packages, JSON specs, Float32 binary caches.

---

## 2026-05-12 Supersession: Sprout-Only Package First

```text
This section overrides older floor_primary_c1 steps in this plan.

Highest priority:
  Obtain the central-sprout-only 0.1 reflection bake package.

Required target:
  sprout_reflection_c1

Required bounds:
  xMin: -1.0
  xMax:  1.0
  zMin: -1.0
  zMax:  1.0
  y:     0.01

Required relationship to R7-3.8:
  Reuse the same central sprout patch bounds as docs/data/r7-3-8-c1-bake-surface-spec.json.
  Keep docs/data/r7-3-8-c1-bake-accepted-package.json as the diffuse source package.
  The R7-3.9 reflection package must line up with the R7-3.8 diffuse patch.

Invalid current package:
  .omc/r7-3-9-c1-accurate-reflection-bake/20260511-235900/

Why invalid:
  The package has corrected 0.1 reflection brightness.
  The target is still floor_primary_c1.
  floor_primary_c1 covers C1 visible floor beyond the sprout patch.
  Metadata scan found masked pixels outside x=-1..1 and z=-1..1.

Acceptance gate:
  surfaceTargets contains sprout_reflection_c1.
  surfaceTargets does not contain floor_primary_c1 for the first accepted sprout package.
  outsideSproutPixels = 0.
  insideSproutPixels > 0.
  nonFiniteReflectionSamples = 0.
  reflectionMaxLuma > 0.05.
  sproutReplacementActive = true.
  surroundingLiveFloorReplacementActive = false.

Stop conditions:
  Stop if the produced package still names floor_primary_c1 as the accepted target.
  Stop if any target metadata pixel is outside x=-1..1 or z=-1..1.
  Stop if runtime replacement is controlled only by roughness match.
  Stop if roughness 1 removes baked reflection from the central sprout patch.
```

## User Decision Override

```text
Decision date:
  2026-05-11

User requirement:
  Accuracy has priority over speed.
  Reflection bake must first prove the central sprout patch.
  The first accepted reflection package must be central-sprout-only at roughness 0.1.
  Later packages may expand to iron door, speaker stands, and speaker cabinets.

Consequence:
  A single cubemap probe is not acceptable as the R7-3.9 main path.
  Cubemap probe may only be used as a diagnostic comparison or fallback note.
  The immediate implementation target is sprout_reflection_c1.
  The previous floor_primary_c1 target is a rejected first-package target.
```

## Accuracy Contract

```text
Hard rule:
  If the baked reflection is visibly in the wrong place, the bake fails.
  If a fast method hides missing data with a plausible-looking approximation, the bake fails.
  If a target reflective surface is missing, the bake fails.

Required immediate reflective target:
  sprout_reflection_c1, matching the accepted R7-3.8 diffuse sprout patch.

Deferred reflective targets:
  iron door
  left speaker stand base / pillar / top
  right speaker stand base / pillar / top
  left speaker cabinet
  right speaker cabinet

Required truth source:
  Use the current path tracer as the reference for reflection radiance.
  Validate runtime cache output against the C1 path-traced reference layer.

Rejected runtime shortcut:
  A single room-center 360-degree capture.
  A cubemap used as the active C1 reflection answer.
  A missing-direction fallback that silently returns live noise or zero and still marks the package accepted.

Accepted failure behavior:
  If any sprout_reflection_c1 target pixel is outside x=-1..1 or z=-1..1, reject the package.
  If a package names floor_primary_c1 as the first accepted runtime target, reject the package.
  If a surface point or outgoing direction is missing from the reflection cache, report the missing target and reject the package.
  If speaker stand transforms are not respected, reject the package.
  If iron door reflection does not align with x = -1.96 and normal = [1, 0, 0], reject the package.
```

## Protected Baseline

```text
Branch checkpoint:
  codex/r7-3-8-c1-1000spp-bake-capture

Protected commit:
  superseded by the floor roughness UI recovery commit on 2026-05-11

Protected tag:
  r7-3-8-c1-diffuse-bake-success-20260511

Previous sprout success commit:
  4bf4297 feat: preserve R7-3.8 C1 diffuse bake success

Updated sprout success rule:
  The tag now represents the accepted R7-3.8 diffuse bake plus the usable floor roughness UI above the snapshot controls.
  The accepted diffuse package pointer remains unchanged.

Current reflection branch:
  codex/r7-3-9-c1-reflection-bake

Accepted diffuse package:
  .omc/r7-3-8-c1-1000spp-bake-capture/20260511-154229

Accepted proof:
  Floor roughness = 1.0
  Around 350SPP: floor-center patch boundary is already hard to see.
  At 1000SPP: patch is visually invisible.
  Floor roughness UI is usable above snapshot controls, with the right edge aligned to manual capture.
  Number input fits 0.00 and does not squeeze the range control.
```

R7-3.9 starts from this baseline. Do not overwrite `docs/data/r7-3-8-c1-bake-accepted-package.json` unless the user explicitly asks to replace the accepted diffuse package.

## Official Sources Read

| Source | Official short excerpt | Chinese translation | R7-3.9 meaning |
|---|---|---|---|
| [Unity Ray-Traced Reflections](https://docs.unity.cn/Packages/com.unity.render-pipelines.high-definition%407.3/manual/Ray-Traced-Reflections.html) | "more accurate, ray-traced solution" | 光線追蹤反射是更準確的反射解法。 | The accuracy-first route should use path-traced / ray-traced reference data. |
| [Unity Path Tracing](https://docs.unity.cn/Packages/com.unity.render-pipelines.high-definition%407.1/manual/Ray-Tracing-Path-Tracing.html) | "mirror or glossy reflections" | path tracing 可計算鏡面或光澤反射。 | The current path tracer is the ground-truth source for baked reflection reference. |
| [Unreal Planar Reflections](https://dev.epicgames.com/documentation/en-us/unreal-engine/planar-reflections-in-unreal-engine?application_version=5.6) | "renders the level again" | 平面反射會從反射方向再畫一次場景。 | Flat surfaces such as floor and iron door need planar or path-traced reference, not a room-center cubemap. |
| [Unreal Reflections Example](https://dev.epicgames.com/documentation/en-us/unreal-engine/reflections-example?application_version=4.27) | "capturing the static level at many points" | 靜態反射會在多個位置擷取場景。 | A single capture point cannot be the final answer for multiple reflective objects. |
| [Three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html) | "0.0 means a smooth mirror reflection" | roughness 0 代表鏡面反射。 | Roughness decides whether high-accuracy reflection is visible. |
| [Three.js PMREMGenerator](https://threejs.org/docs/pages/PMREMGenerator.html) | "different levels of blur" | 依粗糙度準備不同模糊程度。 | Roughness still matters, but prefiltering must be fed by correct surface reference data. |
| [Three.js CubeCamera](https://threejs.org/docs/pages/CubeCamera.html) | "render its surroundings into a cube render target" | cubemap 會把某一點周遭畫成六面環境圖。 | Cubemap explains the rejected approximation: one origin cannot give exact reflections on every surface. |

## Core Accuracy Principle

Reflection is a function of:

```text
surface point:
  where the ray starts

surface normal:
  which way the surface faces

view direction:
  where the camera or eye is

material:
  roughness, metalness, Fresnel behavior

scene:
  what the reflected ray sees after it leaves the surface
```

The accepted diffuse atlas stores mostly view-independent lighting. Reflection needs at least one additional dimension: direction. Accuracy-first R7-3.9 therefore uses these data classes:

```text
Class A: C1 camera reflection reference layer
  Purpose:
    Exact visual reference for the current C1 camera preset.
  Data:
    Per-screen-pixel reflection contribution captured by the current path tracer.
  Use:
    Ground truth and first visual proof.
  Limitation:
    Valid for the captured C1 view.

Class B: planar-surface reflection cache
  Purpose:
    High-accuracy reflection for flat reflective surfaces.
  First targets:
    floor
    iron door
  Data:
    Surface point + reflected direction + path-traced radiance.
  Use:
    Runtime reflection for planes, with exact surface position.

Class C: object-surface directional cache
  Purpose:
    High-accuracy reflection for speaker stands and speaker cabinets.
  First targets:
    left stand base / pillar / top
    right stand base / pillar / top
    left speaker cabinet
    right speaker cabinet
  Data:
    Surface texels plus outgoing direction bins sampled from C1 view rays.
  Use:
    Runtime reflection on rotated boxes and speaker faces.

Class D: cubemap diagnostic only
  Purpose:
    Comparison against the rejected fast approximation.
  Runtime role:
    Disabled by default.
```

## Required Target Surfaces

The accepted first reflection package must include this runtime replacement target:

```text
sprout_reflection_c1:
  source:
    accepted R7-3.8 diffuse sprout patch
  required bounds:
    x = [-1.0, 1.0]
    y = 0.01
    z = [-1.0, 1.0]
  material:
    dielectric floor
  accepted reflection roughness:
    0.1
  note:
    This is the original floor reflection value for the sprout reflection proof package.
```

Deferred targets keep live reflection until their own accurate packages exist:

```text

iron_door_west:
  source:
    js/Home_Studio.js addBox index 26
  bounds:
    min = [-2.00, 0.09, -1.874]
    max = [-1.96, 2.04, -0.984]
  visible interior plane:
    x = -1.96
    normal = [1, 0, 0]
  material:
    roughness 0.3
    metalness 1.0

left_speaker_stand:
  source:
    rotatedObjects left stand base / pillar / top
  object centers:
    base   = [-0.56825, 0.015, 0.9842]
    pillar = [-0.56825, 0.46, 0.9842]
    top    = [-0.56825, 0.89, 0.9842]
  rotY:
    -Math.PI / 6
  material:
    C_STAND / C_STAND_PILLAR with current roughness and metalness scales

right_speaker_stand:
  source:
    rotatedObjects right stand base / pillar / top
  object centers:
    base   = [0.56825, 0.015, 0.9842]
    pillar = [0.56825, 0.46, 0.9842]
    top    = [0.56825, 0.89, 0.9842]
  rotY:
    Math.PI / 6
  material:
    C_STAND / C_STAND_PILLAR with current roughness and metalness scales

speaker_cabinets:
  source:
    rotatedObjects left / right speaker
  centers:
    left  = [-0.56825, 1.0965, 0.9842]
    right = [0.56825, 1.0965, 0.9842]
  material:
    type SPEAKER, roughness 0.4, metalness 0.0
  purpose:
    dielectric cabinet reflection and visual consistency
```

## Data Rules

```text
Diffuse data:
  path:
    docs/data/r7-3-8-c1-bake-accepted-package.json
  role:
    accepted matte lighting baseline
  rule:
    preserve unchanged

Accurate reflection data:
  path:
    docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json
  role:
    surface and direction contract
  rule:
    new branch only

C1 reference package:
  path:
    .omc/r7-3-9-c1-accurate-reflection-bake/YYYYMMDD-HHMMSS/
  role:
    high-SPP reference output from current path tracer
  rule:
    generated by Codex runner
```

Final composition:

```glsl
finalColor = acceptedDiffuseLighting + accurateReflectionContribution;
```

For the central sprout patch, baked 0.1 reflection stays present for every UI floor roughness value.
For the surrounding live floor, roughness `1.0` evaluates as total diffuse with no mirror-like reflection.

## Package Shape

Create:

```text
docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json
```

Initial content:

```json
{
  "version": "r7-3-9-c1-accurate-reflection-bake",
  "config": 1,
  "description": "Accuracy-first C1 central sprout reflection bake. Reflection data is clipped to the accepted R7-3.8 sprout patch.",
  "diffuseCheckpoint": {
    "commit": "4bf4297",
    "tag": "r7-3-8-c1-diffuse-bake-success-20260511",
    "acceptedPackagePointer": "docs/data/r7-3-8-c1-bake-accepted-package.json"
  },
  "accuracyPolicy": {
    "priority": "accuracy_over_speed",
    "cubemapRuntimeEnabled": false,
    "requirePathTracedReference": true,
    "requireSurfaceSpecificReflection": true,
    "referencePolicy": "path_traced_or_fail",
    "missingDirectionPolicy": "reject_package",
    "requireRotatedObjectTransforms": true,
    "requiredRuntimeTargets": [
      "sprout_reflection_c1"
    ],
    "deferredRuntimeTargets": [
      "iron_door_west",
      "speaker_stands_rotated_boxes",
      "speaker_cabinets_rotated_boxes"
    ]
  },
  "cameraReference": {
    "name": "c1_cam1_reflection_reference",
    "preset": "cam1",
    "samples": 1000,
    "width": 1280,
    "height": 720,
    "outputs": [
      "c1-camera-reflection-reference-rgba-f32.bin",
      "c1-camera-reflection-mask-u8.bin",
      "c1-camera-reflection-object-id-u16.bin"
    ]
  },
  "surfaceTargets": [
    {
      "surfaceId": 0,
      "name": "sprout_reflection_c1",
      "kind": "planar",
      "plane": { "axis": "y", "value": 0.01, "normal": [0, 1, 0] },
      "bounds": { "xMin": -1.0, "xMax": 1.0, "zMin": -1.0, "zMax": 1.0 },
      "material": { "class": "dielectric_floor", "acceptedReflectionRoughness": 0.1, "roughnessValues": [0.1], "metalness": 0.0 },
      "firstImplementation": true
    },
    {
      "surfaceId": 1,
      "name": "iron_door_west",
      "kind": "planar",
      "plane": { "axis": "x", "value": -1.96, "normal": [1, 0, 0] },
      "bounds": { "yMin": 0.09, "yMax": 2.04, "zMin": -1.874, "zMax": -0.984 },
      "material": { "class": "iron_door", "roughnessValues": [0.3], "metalness": 1.0 },
      "firstImplementation": true
    },
    {
      "surfaceId": 2,
      "name": "speaker_stands_rotated_boxes",
      "kind": "rotated-box-family",
      "objectNames": [
        "uLeftStandBaseInvMatrix",
        "uLeftStandPillarInvMatrix",
        "uLeftStandTopInvMatrix",
        "uRightStandBaseInvMatrix",
        "uRightStandPillarInvMatrix",
        "uRightStandTopInvMatrix"
      ],
      "material": { "class": "stand_metal", "useRuntimeRoughnessMetalnessScales": true },
      "firstImplementation": true
    },
    {
      "surfaceId": 3,
      "name": "speaker_cabinets_rotated_boxes",
      "kind": "rotated-box-family",
      "objectNames": [
        "uLeftSpeakerInvMatrix",
        "uRightSpeakerInvMatrix"
      ],
      "material": { "class": "speaker_dielectric", "roughnessValues": [0.4], "metalness": 0.0 },
      "firstImplementation": true
    }
  ],
  "directionCache": {
    "mode": "c1-visible-outgoing-directions-first",
    "minimumDirectionsPerSurfaceTexel": 1,
    "directionEncoding": "octahedral-f32",
    "fallbackWhenDirectionMissing": "reject_package_before_runtime"
  },
  "diagnosticOnly": {
    "cubemapProbeAllowed": true,
    "cubemapRuntimeEnabled": false,
    "reason": "A single probe origin cannot satisfy the accuracy requirement for the central sprout patch."
  }
}
```

Formal output directory:

```text
.omc/r7-3-9-c1-accurate-reflection-bake/YYYYMMDD-HHMMSS/
```

Required files:

```text
manifest.json
c1-camera-reflection-reference-rgba-f32.bin
c1-camera-reflection-mask-u8.bin
c1-camera-reflection-object-id-u16.bin
surface-reflection-cache-rgba-f32.bin
surface-reflection-direction-metadata-f32.bin
surface-reflection-texel-metadata-f32.bin
reflection-target-summary.json
validation-report.json
```

`manifest.json` must include:

```json
{
  "version": "r7-3-9-c1-accurate-reflection-bake",
  "config": 1,
  "policy": "accuracy_over_speed",
  "diffuseCheckpointTag": "r7-3-8-c1-diffuse-bake-success-20260511",
  "cameraReferenceSamples": 1000,
  "floorRoughnessForReflection": 0.1,
  "surfaceTargets": ["sprout_reflection_c1"],
  "deferredSurfaceTargets": ["iron_door_west", "speaker_stands_rotated_boxes", "speaker_cabinets_rotated_boxes"],
  "sproutBounds": { "xMin": -1.0, "xMax": 1.0, "zMin": -1.0, "zMax": 1.0, "y": 0.01 },
  "cubemapRuntimeEnabled": false
}
```

## Detailed Execution SOP

### SOP 0: Confirm Accuracy Policy

Entry condition:

```text
Current branch:
  codex/r7-3-9-c1-reflection-bake

Protected baseline:
  r7-3-8-c1-diffuse-bake-success-20260511
```

Commands:

```bash
git branch --show-current
git log --oneline --decorate -3
git status -sb
```

Required output:

```text
branch:
  codex/r7-3-9-c1-reflection-bake

history:
  r7-3-8-c1-diffuse-bake-success-20260511 points to the latest accepted sprout success commit.
```

Stop condition:

```text
Stop if the branch is main.
Stop if docs/data/r7-3-8-c1-bake-accepted-package.json is modified.
Stop if the plan still names cubemap probe as the first runtime implementation.
```

### SOP 1: Protect R7-3.8 Diffuse Bake

Commands:

```bash
git diff -- docs/data/r7-3-8-c1-bake-accepted-package.json
node docs/tests/r7-3-8-c1-bake-paste-preview.test.js
node docs/tests/r7-3-8-c1-1000spp-bake-capture.test.js
node docs/tests/r6-3-max-samples.test.js
```

Required output:

```text
R7-3.8 C1 bake paste-preview contract passed
R7-3.8 C1 1000SPP bake capture contract passed
PASS  MAX_SAMPLES = 1000
```

Exit condition:

```text
The existing diffuse bake remains valid before reflection work begins.
```

Stop condition:

```text
Stop if floor roughness default changes away from 1.0.
Stop if MAX_SAMPLES changes away from 1000.
Stop if the accepted diffuse package pointer changes.
```

### SOP 2: Add Accuracy-First Spec And Contract Test

Files:

```text
Create:
  docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json
  docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
```

Test content:

```js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const specPath = path.join(repoRoot, 'docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json');
const homeStudioPath = path.join(repoRoot, 'js/Home_Studio.js');
const initCommonPath = path.join(repoRoot, 'js/InitCommon.js');
const shaderPath = path.join(repoRoot, 'shaders/Home_Studio_Fragment.glsl');
const runnerPath = path.join(repoRoot, 'docs/tools/r7-3-8-c1-bake-capture-runner.mjs');

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const homeStudio = fs.readFileSync(homeStudioPath, 'utf8');
const initCommon = fs.readFileSync(initCommonPath, 'utf8');
const shader = fs.readFileSync(shaderPath, 'utf8');
const runner = fs.readFileSync(runnerPath, 'utf8');

assert.equal(spec.version, 'r7-3-9-c1-accurate-reflection-bake');
assert.equal(spec.accuracyPolicy.priority, 'accuracy_over_speed');
assert.equal(spec.accuracyPolicy.cubemapRuntimeEnabled, false);
assert.equal(spec.accuracyPolicy.requirePathTracedReference, true);
assert.equal(spec.accuracyPolicy.requireSurfaceSpecificReflection, true);
assert.equal(spec.accuracyPolicy.referencePolicy, 'path_traced_or_fail');
assert.equal(spec.accuracyPolicy.missingDirectionPolicy, 'reject_package');
assert.equal(spec.accuracyPolicy.requireRotatedObjectTransforms, true);

const targetNames = spec.surfaceTargets.map((target) => target.name);
assert.deepEqual(targetNames, [
  'sprout_reflection_c1'
]);

assert.equal(spec.surfaceTargets[0].kind, 'planar');
assert.deepEqual(spec.accuracyPolicy.requiredRuntimeTargets, targetNames);
assert.equal(spec.surfaceTargets[0].bounds.xMin, -1.0);
assert.equal(spec.surfaceTargets[0].bounds.xMax, 1.0);
assert.equal(spec.surfaceTargets[0].bounds.zMin, -1.0);
assert.equal(spec.surfaceTargets[0].bounds.zMax, 1.0);
assert.equal(spec.directionCache.fallbackWhenDirectionMissing, 'reject_package_before_runtime');
assert.equal(spec.diagnosticOnly.cubemapRuntimeEnabled, false);

assert.match(homeStudio, /uR739C1AccurateReflectionMode/);
assert.match(homeStudio, /tR739C1ReflectionSurfaceCacheTexture/);
assert.match(initCommon, /window\.reportR739C1AccurateReflectionAfterSamples/);
assert.match(initCommon, /window\.loadR739C1AccurateReflectionPackage/);
assert.match(shader, /uniform float uR739C1AccurateReflectionMode;/);
assert.match(shader, /r739SampleAccurateSurfaceReflection/);
assert.match(shader, /uFloorRoughness\s*>=\s*0\.999/);
assert.match(runner, /--accurate-reflection-capture/);
assert.doesNotMatch(shader, /tR739C1ReflectionProbeTexture/);

console.log('R7-3.9 C1 accurate reflection bake contract passed');
```

Commands:

```bash
node docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
```

Expected first result:

```text
AssertionError
```

The first failure should point to missing R7-3.9 runtime symbols.

Commit:

```bash
git add docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
git commit -m "test: add R7-3.9 accurate reflection contract"
```

### SOP 3: Add Specular Reference Capture Mode

Purpose:

```text
Create a path-traced reference layer for C1 reflections.
This layer is the truth source used to judge later surface caches.
```

Files:

```text
Modify:
  js/Home_Studio.js
  js/InitCommon.js
  shaders/Home_Studio_Fragment.glsl
  docs/tools/r7-3-8-c1-bake-capture-runner.mjs
```

Required runtime symbols:

```text
uR739C1AccurateReflectionMode
uR739C1ReflectionReferenceMode
uR739C1ReflectionSurfaceMaskMode
window.reportR739C1AccurateReflectionAfterSamples
window.getR739C1AccurateReflectionArtifacts
--accurate-reflection-capture
```

Capture modes:

```text
0:
  normal render

1:
  camera-view reflection contribution only

2:
  camera-view reflection surface mask

3:
  surface-cache capture
```

Work steps:

```text
1.  Add R739 uniforms in js/Home_Studio.js.
2.  Add matching shader uniforms.
3.  Add reflection-only output mode in shader.
4.  Add mask output mode for target surfaces.
5.  Add InitCommon report helper.
6.  Extend runner with --accurate-reflection-capture.
7.  Keep normal runtime output unchanged when mode is 0.
```

Commands:

```bash
node docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
node --check js/Home_Studio.js
node --check js/InitCommon.js
node --check js/PathTracingCommon.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
git diff --check
```

Exit condition:

```text
Static contract passes.
Normal render mode remains default.
```

Stop condition:

```text
Stop if R7-3.8 tests fail.
Stop if reflection-only mode changes normal render when disabled.
```

### SOP 4: Capture C1 Camera Reflection Reference

Purpose:

```text
Capture the exact C1 camera-view reflection contribution at 1000SPP.
This gives an image-space truth layer for the current C1 preset.
```

Command:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --accurate-reflection-capture --reference-only --samples=1000 --timeout-ms=300000 --http-port=9002 --cdp-port=9240 --angle=metal
```

Required output directory:

```text
.omc/r7-3-9-c1-accurate-reflection-bake/YYYYMMDD-HHMMSS/
```

Required files:

```text
c1-camera-reflection-reference-rgba-f32.bin
c1-camera-reflection-mask-u8.bin
c1-camera-reflection-object-id-u16.bin
reflection-target-summary.json
validation-report.json
```

Validation requirements:

```text
actualSamples = 1000
referenceWidth = 1280
referenceHeight = 720
reflectionReferenceFloatCount = 3686400
nonFinitePixels = 0
targetMaskIncludesSprout = true
outsideSproutPixels = 0
insideSproutPixels > 0
targetMaskExcludesIronDoorRuntimeReplacement = true
targetMaskExcludesSpeakerStandsRuntimeReplacement = true
targetMaskExcludesSpeakerCabinetsRuntimeReplacement = true
```

Exit condition:

```text
Reference package status is pass.
The runner closes its test browser after capture.
```

Stop condition:

```text
Stop if any target surface is missing from the mask.
Stop if nonFinitePixels is greater than 0.
Stop if actualSamples is less than 1000.
```

### SOP 5: Build Surface-Specific Reflection Cache

Purpose:

```text
Bake reflection data by surface and direction, starting from the directions visible in C1.
```

Required cache layout:

```text
surface-reflection-cache-rgba-f32.bin:
  For each target sample:
    RGBA reflection radiance

surface-reflection-direction-metadata-f32.bin:
  For each target sample:
    surfaceId
    texelU
    texelV
    directionOctX
    directionOctY
    roughness
    metalness
    weight

surface-reflection-texel-metadata-f32.bin:
  For each target texel:
    surfaceId
    worldX
    worldY
    worldZ
    normalX
    normalY
    normalZ
    targetClass
```

Work steps:

```text
1.  For floor and iron door, sample planar surface texels.
2.  For speaker stands and speaker cabinets, sample rotated-box faces.
3.  For each visible C1 target sample, compute outgoing direction from surface point to camera.
4.  Evaluate reflection radiance through the existing path tracer at 1000SPP.
5.  Store radiance with direction metadata.
6.  Store target mask and object ids for validation.
```

Command:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --accurate-reflection-capture --surface-cache --samples=1000 --timeout-ms=600000 --http-port=9002 --cdp-port=9240 --angle=metal
```

Validation requirements:

```text
surfaceCacheStatus = pass
includedTargets = sprout_reflection_c1
sampleCountPerIncludedTarget > 0
nonFiniteReflectionSamples = 0
outsideSproutPixels = 0
roughnessOneSurroundingLiveFloorHasNoMirrorReflection = true
centralSproutPatchKeepsBakedReflectionAtEveryUIRoughness = true
```

Exit condition:

```text
sprout_reflection_c1 has reflection samples.
Surrounding live floor roughness 1.0 returns total diffuse.
Central sprout patch still keeps baked diffuse plus baked 0.1 reflection.
```

Stop condition:

```text
Stop if sprout_reflection_c1 samples are missing.
Stop if any sprout target pixel is outside x=-1..1 or z=-1..1.
Stop if surrounding live floor roughness 1.0 still has mirror-like reflection energy.
Stop if central sprout patch loses baked reflection when UI roughness changes.
```

### SOP 6: Create Accepted Accurate Reflection Pointer

Create:

```text
docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json
```

Required JSON shape:

```json
{
  "version": "r7-3-9-c1-accurate-reflection-bake",
  "packageStatus": "accepted",
  "packageDir": ".omc/r7-3-9-c1-accurate-reflection-bake/YYYYMMDD-HHMMSS",
  "diffuseCheckpointTag": "r7-3-8-c1-diffuse-bake-success-20260511",
  "policy": "accuracy_over_speed",
  "floorRoughnessForReflection": 0.1,
  "cubemapRuntimeEnabled": false,
  "surfaceTargets": ["sprout_reflection_c1"],
  "deferredSurfaceTargets": ["iron_door_west", "speaker_stands_rotated_boxes", "speaker_cabinets_rotated_boxes"],
  "sproutBounds": { "xMin": -1.0, "xMax": 1.0, "zMin": -1.0, "zMax": 1.0, "y": 0.01 },
  "artifacts": {
    "reference": "c1-camera-reflection-reference-rgba-f32.bin",
    "mask": "c1-camera-reflection-mask-u8.bin",
    "objectIds": "c1-camera-reflection-object-id-u16.bin",
    "surfaceCache": "surface-reflection-cache-rgba-f32.bin",
    "directionMetadata": "surface-reflection-direction-metadata-f32.bin",
    "texelMetadata": "surface-reflection-texel-metadata-f32.bin",
    "summary": "reflection-target-summary.json",
    "validationReport": "validation-report.json"
  },
  "validation": {
    "status": "pass",
    "actualSamples": 1000,
    "nonFinitePixels": 0
  }
}
```

The runner must fill exact byte lengths and SHA-256 hashes before this file is accepted.

Commit:

```bash
git add docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json
git commit -m "data: accept R7-3.9 accurate reflection package"
```

Stop condition:

```text
Stop if packageDir points to a failing package.
Stop if targetSurfaces omits iron door or speaker stands.
Stop if any hash field is missing from the generated accepted pointer.
```

### SOP 7: Runtime Preview With Accurate Reflection Cache

Purpose:

```text
Apply the accepted surface/direction reflection cache in C1 while preserving the R7-3.8 diffuse base.
```

Files:

```text
Modify:
  js/InitCommon.js
  shaders/Home_Studio_Fragment.glsl
  docs/tools/r7-3-8-c1-bake-capture-runner.mjs
```

Runtime enable rule:

```text
enabled = true
ready = true
currentPanelConfig = 1
captureMode = normal render
accepted package policy = accuracy_over_speed
cubemapRuntimeEnabled = false
```

Shader behavior:

```text
1.  Identify the first visible surface.
2.  If the surface belongs to a target surface, compute surface UV and outgoing direction.
3.  Look up the closest matching reflection cache sample.
4.  If there is no matching direction, report missingDirection and reject the package before acceptance.
5.  Add reflection contribution after diffuse base.
6.  Clip accepted baked reflection to the central sprout patch.
7.  Keep surrounding floor on live path tracing for every UI roughness value.
8.  For surrounding live floor, roughness 1.0 returns total diffuse.
```

Runner command:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --accurate-reflection-preview-test --timeout-ms=60000 --http-port=9002 --cdp-port=9241 --angle=metal
```

Required report:

```text
status = pass
ready = true
applied = true
currentPanelConfig = 1
policy = accuracy_over_speed
cubemapRuntimeEnabled = false
```

Stop condition:

```text
Stop if runtime loads any cubemap reflection texture as the active R7-3.9 path.
Stop if C2, C3, or C4 reports applied=true.
Stop if the runner leaves port 9241 open.
```

### SOP 8: User Visual Acceptance

URL:

```text
http://localhost:9002/Home_Studio.html
```

Visual check A:

```text
Floor roughness = 1.0

Expected:
  Diffuse floor remains visually identical to the protected R7-3.8 look.
  Reflection contribution is absent.
  Samples reaches 1000.
  FPS becomes 0 in hibernation.
```

Visual check B:

```text
Floor roughness = 0.1

Expected:
  Floor reflection appears in the correct physical position for C1.
  No square cache boundary is visible.
  Reflection follows the visible surface position.
```

Visual check C:

```text
Iron door

Expected:
  Door reflection aligns with the door plane.
  Reflection respects metalness 1.0 and roughness 0.3.
  Door texture is not erased by the reflection term.
```

Visual check D:

```text
Speaker stands

Expected:
  Stand base, pillar, and top have reflection on their own surfaces.
  Reflection follows each rotated object orientation.
  Reflections do not float as if sampled from room center.
```

Visual check E:

```text
Speaker cabinets

Expected:
  Cabinet reflection remains subtle because material is roughness 0.4 and metalness 0.0.
  Existing speaker front/back texture behavior stays intact.
```

Pass condition:

```text
All required surfaces show physically plausible reflection.
Roughness 1.0 keeps the accepted diffuse look.
C1 reaches Samples: 1000 and hibernates.
No room-center cubemap artifact is visible.
```

No-go condition:

```text
Reflection position is visibly wrong on floor or iron door.
Speaker stand reflection ignores object rotation.
Reflection appears when floor roughness is 1.0.
C1 hibernation breaks.
```

### SOP 9: Resource Cleanup

After every runner:

```bash
lsof -nP -iTCP:9240 -sTCP:LISTEN
lsof -nP -iTCP:9241 -sTCP:LISTEN
```

Expected:

```text
No output for completed CDP ports.
```

If a headless test browser remains:

```bash
pkill -f "remote-debugging-port=9240"
pkill -f "remote-debugging-port=9241"
```

### SOP 10: Documentation And Closeout

Update:

```text
docs/SOP/Debug_Log.md
docs/SOP/R7：採樣演算法升級.md
docs/SOP/Debug_Log_Index.md
```

Record:

```text
branch
commit
package path
surface targets
reference hash
surface cache hash
validation commands
user visual result
known limits
```

Validation commands:

```bash
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

Commit:

```bash
git add Home_Studio.html js/Home_Studio.js js/InitCommon.js js/PathTracingCommon.js shaders/Home_Studio_Fragment.glsl docs/tools/r7-3-8-c1-bake-capture-runner.mjs docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js docs/SOP/Debug_Log.md docs/SOP/Debug_Log_Index.md "docs/SOP/R7：採樣演算法升級.md"
git commit -m "feat: add R7-3.9 accurate C1 reflection bake"
git push -u origin codex/r7-3-9-c1-reflection-bake
```

## Phase Gates

```text
Gate A: Accuracy policy gate
  cubemapRuntimeEnabled = false
  required targets include floor, iron door, speaker stands, speaker cabinets

Gate B: Reference gate
  C1 reflection reference reaches 1000 samples
  nonFinitePixels = 0
  target masks include all required targets

Gate C: Surface cache gate
  each required surface has samples
  surface cache stores direction metadata
  central sprout patch keeps baked reflection at every UI roughness
  surrounding live floor roughness 1.0 has no mirror-like reflection

Gate D: Runtime gate
  C1 applied=true
  C2/C3/C4 applied=false
  cubemap runtime path remains disabled

Gate E: Visual gate
  floor, iron door, stands, and speaker cabinets pass user visual acceptance
  C1 reaches Samples: 1000 and hibernates
```

## Failure Response SOP

```text
If the plan starts using cubemap as runtime main path:
  Stop.
  Restore accuracy_over_speed policy.

If surrounding live floor roughness 1.0 shows mirror-like reflection:
  Stop.
  Check roughness guard and reportFloorRoughness().

If central sprout patch roughness 1.0 loses baked reflection:
  Stop.
  Check central sprout patch clipping and bake composition.

If iron door reflection position is wrong:
  Stop.
  Check plane x = -1.96 and normal = [1, 0, 0].
  Check surface UV mapping.

If speaker stand reflection ignores rotation:
  Stop.
  Check rotatedObjects transform and inverse matrix use.
  Check surface texel world position.

If speaker texture is erased:
  Stop.
  Separate texture albedo from reflection contribution.

If GPU remains busy after tests:
  Close only matching headless runner processes.
  Keep localhost:9002 when the user is still viewing the page.
```

## Tasks

### Task 1: Add Accuracy-First Reflection Spec

**Files:**
- Create: `docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json`
- Create: `docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js`

- [x] **Step 1: Create the spec JSON**

Write `docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json` with the JSON in "Package Shape".

- [x] **Step 2: Create the contract test**

Use the test content from SOP 2.

- [x] **Step 3: Run the test**

```bash
node docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
```

Expected:

```text
AssertionError
```

- [x] **Step 4: Commit**

Implementation note:
  Committed together with the final R7-3.9 feature closeout instead of as a separate early checkpoint.

```bash
git add docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
git commit -m "test: add R7-3.9 accurate reflection contract"
```

### Task 2: Add Reflection-Only Reference Mode

**Files:**
- Modify: `js/Home_Studio.js`
- Modify: `js/InitCommon.js`
- Modify: `shaders/Home_Studio_Fragment.glsl`
- Modify: `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`

- [x] **Step 1: Add uniforms**

```js
pathTracingUniforms.uR739C1AccurateReflectionMode = { value: 0.0 };
pathTracingUniforms.uR739C1ReflectionReferenceMode = { value: 0.0 };
pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode = { value: 0.0 };
pathTracingUniforms.uR739C1ReflectionReady = { value: 0.0 };
```

- [x] **Step 2: Add browser helpers**

```js
window.reportR739C1AccurateReflectionAfterSamples = async function(targetSamples, timeoutMs, options)
{
    return {
        version: 'r7-3-9-c1-accurate-reflection-bake',
        targetSamples: targetSamples || 1000,
        policy: 'accuracy_over_speed',
        cubemapRuntimeEnabled: false,
        status: 'capture-contract'
    };
};

window.getR739C1AccurateReflectionArtifacts = function()
{
    return window.__r739C1AccurateReflectionLastArtifacts || null;
};
```

- [x] **Step 3: Add runner flag**

```js
else if (arg === '--accurate-reflection-capture') out.accurateReflectionCapture = true;
```

- [x] **Step 4: Run checks**

```bash
node docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
node --check js/Home_Studio.js
node --check js/InitCommon.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
```

Expected:

```text
R7-3.9 C1 accurate reflection bake contract passed
```

### Task 3: Capture C1 Reference And Surface Cache

**Files:**
- Modify: `js/InitCommon.js`
- Modify: `shaders/Home_Studio_Fragment.glsl`
- Modify: `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`

- [x] **Step 1: Run reference capture**

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --accurate-reflection-capture --reference-only --samples=1000 --timeout-ms=300000 --http-port=9002 --cdp-port=9240 --angle=metal
```

- [x] **Step 2: Run surface cache capture**

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --accurate-reflection-capture --surface-cache --samples=1000 --timeout-ms=600000 --http-port=9002 --cdp-port=9240 --angle=metal
```

- [x] **Step 3: Validate package**

Result:
  Superseded initial package:
    .omc/r7-3-9-c1-accurate-reflection-bake/20260511-190523/
  Corrected-brightness large-floor package after sample double-division fix:
    .omc/r7-3-9-c1-accurate-reflection-bake/20260511-235900/
  Validation:
    status = pass
    actualSamples = 1000
    floorRoughnessForReflection = 0.1
    nonFiniteReflectionSamples = 0
    floor_primary_c1 = 96170
    iron_door_west = 0
    speaker_stands_rotated_boxes = 0
    speaker_cabinets_rotated_boxes = 0
  Status after 2026-05-12 sprout review:
    invalid as accepted sprout package
    target is floor_primary_c1
    required next target is sprout_reflection_c1
    required next proof is outsideSproutPixels = 0

Expected:

```text
actualSamples = 1000
nonFinitePixels = 0
targetMaskIncludesSprout = true
outsideSproutPixels = 0
insideSproutPixels > 0
targetMaskExcludesIronDoorRuntimeReplacement = true
targetMaskExcludesSpeakerStandsRuntimeReplacement = true
targetMaskExcludesSpeakerCabinetsRuntimeReplacement = true
surfaceCacheStatus = pass
```

### Task 4: Runtime Preview And Visual Acceptance

**Files:**
- Modify: `js/InitCommon.js`
- Modify: `shaders/Home_Studio_Fragment.glsl`
- Modify: `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`

- [x] **Step 1: Add accepted package pointer**

Create `docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json` from the passing package.

- [x] **Step 2: Run preview test**

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --accurate-reflection-preview-test --timeout-ms=60000 --http-port=9002 --cdp-port=9241 --angle=metal
```

Expected:

```text
status = pass
policy = accuracy_over_speed
cubemapRuntimeEnabled = false
```

- [ ] **Step 3: User visual check**

Status:
  Ready for user visual check at http://localhost:9002/Home_Studio.html.
  Automated preview test passed:
    .omc/r7-3-9-c1-accurate-reflection-preview/20260511-190846/

Use:

```text
http://localhost:9002/Home_Studio.html
```

Check:

```text
floor roughness 0.1
iron door live reflection remains visible
speaker stands live reflection remains visible
speaker cabinets live reflection remains visible
Samples: 1000 hibernation
```

### Task 5: Documentation And Closeout

**Files:**
- Modify: `docs/SOP/Debug_Log.md`
- Modify: `docs/SOP/R7：採樣演算法升級.md`
- Modify: `docs/SOP/Debug_Log_Index.md`

- [x] **Step 1: Run final static checks**

```bash
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

- [x] **Step 2: Update docs**

Record:

```text
accuracy_over_speed policy
target surfaces
package path
reference hash
surface cache hash
validation output
user visual result
remaining limits
```

- [x] **Step 3: Commit and push**

Closeout note:
  Final Git closeout is recorded in the chat turn that implemented this plan.

```bash
git add Home_Studio.html js/Home_Studio.js js/InitCommon.js js/PathTracingCommon.js shaders/Home_Studio_Fragment.glsl docs/tools/r7-3-8-c1-bake-capture-runner.mjs docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js docs/SOP/Debug_Log.md docs/SOP/Debug_Log_Index.md "docs/SOP/R7：採樣演算法升級.md"
git commit -m "feat: add R7-3.9 accurate C1 reflection bake"
git push -u origin codex/r7-3-9-c1-reflection-bake
```

## Self-Review Checklist

```text
Spec coverage:
  User accuracy requirement is explicit.
  Cubemap runtime path is disabled.
  sprout_reflection_c1 is the immediate accepted target.
  Iron door, speaker stands, and speaker cabinets are deferred until sprout passes.
  C1 path-traced reference layer is required.
  Surface and direction cache is required.
  R7-3.8 sprout bounds are required.
  outsideSproutPixels = 0 is required.

Placeholder scan:
  No placeholder markers.
  All future package values are generated by runner outputs.

Type consistency:
  Prefix is R739.
  Version is r7-3-9-c1-accurate-reflection-bake.
  Spec file is docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json.
  First accepted target name is sprout_reflection_c1.
```

## Execution Handoff

```text
Implement docs/superpowers/plans/2026-05-11-r7-3-9-c1-reflection-bake.md task by task.

Branch:
  codex/r7-3-9-c1-reflection-bake

Protected baseline:
  r7-3-8-c1-diffuse-bake-success-20260511 points to the latest accepted sprout success commit.
  previous commit: 4bf4297 feat: preserve R7-3.8 C1 diffuse bake success
  tag: r7-3-8-c1-diffuse-bake-success-20260511

Required rule:
  Accuracy has priority over speed.
  The highest priority is to produce a central-sprout-only 0.1 reflection package.
  Required target name is sprout_reflection_c1.
  Required sprout bounds are x=-1..1, z=-1..1, y=0.01.
  The first accepted sprout reflection package must not use floor_primary_c1 as its accepted target.
  The current .omc/r7-3-9-c1-accurate-reflection-bake/20260511-235900/ package is invalid as acceptance proof because it targets floor_primary_c1.
  Preserve the accepted R7-3.8 diffuse atlas and surrounding live floor roughness 1.0 behavior.
  Capture reflection from the current path tracer as ground truth.
  Bake reflection by surface and outgoing direction for sprout_reflection_c1 first.
  Defer iron door, speaker stands, and speaker cabinets until sprout_reflection_c1 passes.
  Keep cubemap runtime disabled.
  Runtime floor replacement must be clipped to the central sprout patch.
  Central sprout patch always uses accepted baked diffuse plus accepted baked 0.1 reflection.
  Surrounding floor always follows the UI floor roughness through live path tracing.
  Surrounding roughness 0 means live mirror reflection.
  Surrounding roughness 0.05 to 0.95 means live glossy reflection.
  Surrounding roughness 1 means live total diffuse.
  At roughness 0.1, 1SPP should show clean central sprout data and noisy surrounding live data.
  At roughness 0.1, 1000SPP should make surrounding live data converge toward the central sprout patch.
  Reflection cache build must use the screenCopy averaged readback directly; do not divide full - disabled by samples again.
  Accepted floor reflection cache must not be near-black; contract test requires max luma above 0.05.
  The decisive package validation is outsideSproutPixels = 0.
  The decisive runtime validation is sproutReplacementActive = true and surroundingLiveFloorReplacementActive = false.
  Codex runner must capture, validate, and close test resources.
```
