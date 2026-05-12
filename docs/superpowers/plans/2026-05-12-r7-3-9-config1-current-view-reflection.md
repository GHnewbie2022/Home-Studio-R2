# R7-3.9 Config 1 Current-View Reflection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first R7-3.9 Config 1 sprout reflection route whose runtime reflection remains correct while the user moves freely inside the room.

**Architecture:** Keep the accepted R7-3.8 sprout diffuse bake as the protected default. Replace the invalid finite reflection bake contract with a current-view runtime route: Config 1, sprout patch bounds `x=-1..1`, `z=-1..1`, route roughness `0.1`, and reflection radiance computed from the active camera state. Baked R7-3.9 artifacts remain `reference_only` probes and must run to exactly `1000 spp`.

**Tech Stack:** Vanilla JavaScript, WebGL2 GLSL fragment shader, Three.js runtime objects already present in `js/InitCommon.js` and `js/Home_Studio.js`, Node.js assertion tests, CDP runner `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`.

---

## Requirements Locked By The User

```text
1.  C1 means Config 1, selected by applyPanelConfig(1).
2.  C1 does not mean Camera 1.
3.  The final target is free camera movement inside Config 1.
4.  The accepted reflection must stay physically tied to the current floor surface point and current camera direction.
5.  Finite camera views, nearest direction lookup, direction interpolation, cubemap substitution, screen copy, Config 1 camera reference image, zero fill, and live-noise fallback cannot be promoted as the final answer.
6.  The first implementation surface is sprout_reflection_c1 only.
7.  sprout_reflection_c1 bounds are x=-1..1 and z=-1..1 on the floor plane.
8.  The sprout reflection route uses roughness 0.1.
9.  Every Config 1 R7-3.9 reference_only probe artifact must finish at exactly 1000 spp.
10. actualSamples below 1000 rejects the probe artifact.
11. actualSamples above 1000 rejects the probe artifact.
12. Reaching exactly 1000 spp is evidence, not acceptance by itself.
```

## File Structure

```text
docs/superpowers/plans/2026-05-11-r7-3-9-c1-reflection-bake.md
  Guard SOP. Preserve its reset history and acceptance gates. Update only if implementation discovers a gate wording conflict.

docs/superpowers/plans/2026-05-12-r7-3-9-config1-current-view-reflection.md
  This execution SOP.

docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json
  Replace the invalid finite-cache acceptance schema with the current-view route schema.

docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json
  Keep runtime disabled until the current-view route passes every gate. Replace package wording with route wording.

docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
  Define the current-view route acceptance test.

js/Home_Studio.js
  Declare current-view route uniforms and keep legacy R7-3.9 cache uniforms inert.

js/InitCommon.js
  Replace accepted reflection package loading with route reporting, validation toggles, and camera-state helpers.

shaders/Home_Studio_Fragment.glsl
  Route sprout_reflection_c1 through live current-view path tracing at roughness 0.1 while the route is active.

docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  Add current-view free-movement validation and exact-1000 reference_only probe checks.

docs/SOP/Debug_Log.md
  Record the implementation result, commands, artifacts, and visual gate status after execution.
```

---

### Task 1: Define The New Current-View Contract Test

**Files:**
```text
Modify: docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
```

- [ ] **Step 1: Replace the test file with the current-view acceptance test**

Use this full file content:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const spec = JSON.parse(fs.readFileSync('docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json', 'utf8'));
const accepted = JSON.parse(fs.readFileSync('docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json', 'utf8'));
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const resetSop = fs.readFileSync('docs/superpowers/plans/2026-05-11-r7-3-9-c1-reflection-bake.md', 'utf8');
const implementationSop = fs.readFileSync('docs/superpowers/plans/2026-05-12-r7-3-9-config1-current-view-reflection.md', 'utf8');

assert.equal(spec.version, 'r7-3-9-config1-current-view-reflection');
assert.equal(spec.config, 1);
assert.equal(spec.status, 'current_view_route_required');
assert.equal(spec.terminology.c1Means, 'Config 1');
assert.equal(spec.terminology.selectedBy, 'applyPanelConfig(1)');
assert.equal(spec.finalGoal.freeCameraMovement, true);
assert.equal(spec.finalGoal.currentCameraStateRequired, true);
assert.equal(spec.finalGoal.finiteViewBakeAllowedAsFinal, false);
assert.equal(spec.firstTarget.name, 'sprout_reflection_c1');
assert.equal(spec.firstTarget.bounds.xMin, -1.0);
assert.equal(spec.firstTarget.bounds.xMax, 1.0);
assert.equal(spec.firstTarget.bounds.zMin, -1.0);
assert.equal(spec.firstTarget.bounds.zMax, 1.0);
assert.equal(spec.firstTarget.routeRoughness, 0.1);
assert.equal(spec.referenceOnlyProbeContract.samples, 1000);
assert.equal(spec.referenceOnlyProbeContract.exactSamplesRequired, true);
assert.equal(spec.referenceOnlyProbeContract.acceptBelow1000, false);
assert.equal(spec.referenceOnlyProbeContract.acceptAbove1000, false);
assert.equal(spec.acceptedRuntimeRoute.requiredRadiance, 'current_view_reflection_radiance');
assert.equal(spec.acceptedRuntimeRoute.computeFromCurrentCamera, true);
assert.equal(spec.acceptedRuntimeRoute.allowFiniteCameraViewLookup, false);
assert.equal(spec.acceptedRuntimeRoute.allowNearestDirectionLookup, false);
assert.equal(spec.acceptedRuntimeRoute.allowDirectionInterpolation, false);
assert.equal(spec.acceptedRuntimeRoute.allowCubemapSubstitution, false);
assert.equal(spec.acceptedRuntimeRoute.allowScreenCopyFallback, false);
assert.equal(spec.acceptedRuntimeRoute.allowZeroFillFallback, false);
assert.deepEqual(spec.allowedBakedData.sort(), [
  'diffuse_bake',
  'roughness_metadata',
  'surface_normal_metadata',
  'surface_position_metadata',
  'target_mask'
].sort());

const specText = JSON.stringify(spec);
assert.doesNotMatch(specText, /minimumDirectionsPerSurfaceTexel/);
assert.doesNotMatch(specText, /directionEncoding/);
assert.doesNotMatch(specText, /surface_position_and_outgoing_direction/);
assert.doesNotMatch(specText, /reject_package_before_runtime/);

assert.equal(accepted.version, 'r7-3-9-config1-current-view-reflection');
assert.equal(accepted.packageStatus, 'none');
assert.equal(accepted.routeStatus, 'none');
assert.equal(accepted.runtimeEnabled, false);
assert.equal(accepted.acceptedRoute, null);
assert.equal(accepted.cubemapRuntimeEnabled, false);
assert.deepEqual(accepted.surfaceTargets, []);
assert.deepEqual(accepted.deferredSurfaceTargets, ['sprout_reflection_c1']);
assert.match(accepted.runtimeBlockReason, /current-view reflection route/i);
assert.equal(accepted.packageDir, null);
assert.equal(accepted.artifacts, undefined);
assert.doesNotMatch(JSON.stringify(accepted), /20260511-190523|20260511-235900|20260512-134902/);

assert.match(resetSop, /C1 means Config 1/);
assert.match(resetSop, /free.*move|move freely/i);
assert.match(resetSop, /fixed samples = exactly 1000 spp/);
assert.match(resetSop, /Any finite validation-view reflection bake promoted as the final answer/);
assert.match(implementationSop, /current-view runtime route/);
assert.doesNotMatch(implementationSop, /legacy finite-route choice label/i);

assert.match(homeStudio, /uR739C1CurrentViewReflectionMode/);
assert.match(homeStudio, /uR739C1CurrentViewReflectionReady/);
assert.match(homeStudio, /uR739C1CurrentViewReflectionRoughness/);
assert.match(initCommon, /window\.reportR739C1CurrentViewReflectionConfig/);
assert.match(initCommon, /window\.setR739C1CurrentViewReflectionValidationEnabled/);
assert.match(initCommon, /window\.setR739Config1ValidationCameraState/);
assert.match(initCommon, /window\.runR739C1CurrentViewReflectionValidation/);
assert.doesNotMatch(initCommon, /loadR739C1AccurateReflectionPackage\(\)\.catch/);

assert.match(shader, /uniform float uR739C1CurrentViewReflectionMode;/);
assert.match(shader, /bool r739C1CurrentViewReflectionActiveForTarget/);
assert.match(shader, /float r739C1CurrentViewFloorRoughness/);
assert.match(shader, /r739C1CurrentViewFloorRoughness\(r739TargetId,\s*x\)/);
assert.doesNotMatch(shader, /texture\s*\(\s*tR739C1ReflectionSurfaceCacheTexture/);

const pasteBlock = shader.match(/if \(uR738C1BakeCaptureMode == 0 &&[\s\S]*?r738C1BakePastePreviewSample[\s\S]*?\n\t}/)?.[0] || '';
assert.match(pasteBlock, /!r739C1CurrentViewReflectionActiveForTarget/);

const currentViewRoughnessFunction = shader.match(/float r739C1CurrentViewFloorRoughness[\s\S]*?\n}/)?.[0] || '';
assert.match(currentViewRoughnessFunction, /uR739C1CurrentViewReflectionRoughness/);
assert.match(currentViewRoughnessFunction, /0\.1|uR739C1CurrentViewReflectionRoughness/);

assert.match(runner, /r739-current-view-validation/);
assert.match(runner, /actualSamples === 1000/);
assert.match(runner, /sproutVisiblePixels/);
assert.match(runner, /sproutDeltaMeanLuma/);
assert.match(runner, /cameraStateVariation/);
assert.doesNotMatch(runner, /packageStatus:\s*validation\.status === 'pass' \? 'accepted'/);
assert.doesNotMatch(runner, /r7-3-9-c1-accurate-reflection-accepted-package\.json[\s\S]{0,160}writeFileSync/);

console.log('R7-3.9 Config 1 current-view reflection route contract passed');
```

- [ ] **Step 2: Continue directly to the data contract**

```text
1.  This test defines the final success contract for this implementation pass.
2.  It checks the spec, pointer, JS runtime hooks, shader route, and runner validation hook.
3.  Run this test as the acceptance check after Task 5 has added every required piece.
```

- [ ] **Step 3: Keep the new test in the worktree**

```text
1.  Do not commit yet.
2.  Continue to Task 2.
3.  The first source commit happens after the acceptance test passes.
```

---

### Task 2: Rewrite The Data Contract

**Files:**
```text
Modify: docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json
Modify: docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json
Test: docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
```

- [ ] **Step 1: Replace the surface spec JSON**

Use this full file content:

```json
{
  "version": "r7-3-9-config1-current-view-reflection",
  "config": 1,
  "status": "current_view_route_required",
  "description": "R7-3.9 Config 1 sprout reflection contract. The accepted runtime route must compute reflection from the current camera state while the user moves freely inside Config 1.",
  "terminology": {
    "c1Means": "Config 1",
    "selectedBy": "applyPanelConfig(1)",
    "cameraPresetMeaning": "Camera presets are validation viewpoints only and cannot define the final reflection answer"
  },
  "diffuseCheckpoint": {
    "commit": "4bf4297",
    "tag": "r7-3-8-c1-diffuse-bake-success-20260511",
    "acceptedPackagePointer": "docs/data/r7-3-8-c1-bake-accepted-package.json"
  },
  "finalGoal": {
    "freeCameraMovement": true,
    "currentCameraStateRequired": true,
    "finiteViewBakeAllowedAsFinal": false,
    "nearestDirectionLookupAllowed": false,
    "directionInterpolationAllowed": false,
    "cubemapSubstitutionAllowed": false,
    "screenCopyFallbackAllowed": false,
    "zeroFillFallbackAllowed": false,
    "liveNoiseFallbackAllowed": false
  },
  "firstTarget": {
    "surfaceId": 1,
    "name": "sprout_reflection_c1",
    "kind": "planar_floor_patch",
    "plane": {
      "axis": "y",
      "value": 0.01,
      "normal": [0, 1, 0]
    },
    "bounds": {
      "xMin": -1.0,
      "xMax": 1.0,
      "zMin": -1.0,
      "zMax": 1.0
    },
    "routeRoughness": 0.1,
    "metalness": 0.0
  },
  "referenceOnlyProbeContract": {
    "label": "reference_only",
    "config": 1,
    "samples": 1000,
    "exactSamplesRequired": true,
    "acceptBelow1000": false,
    "acceptAbove1000": false,
    "roughness": 0.1,
    "runtimeAcceptanceFromProbeAlone": false
  },
  "acceptedRuntimeRoute": {
    "requiredRadiance": "current_view_reflection_radiance",
    "computeFromCurrentCamera": true,
    "requiredInputs": [
      "surface_target_id",
      "surface_world_position",
      "surface_world_normal",
      "current_camera_position",
      "current_outgoing_direction",
      "roughness"
    ],
    "allowedRouteKinds": [
      "runtime_path_tracing_current_view",
      "runtime_planar_reflection_current_view"
    ],
    "allowFiniteCameraViewLookup": false,
    "allowNearestDirectionLookup": false,
    "allowDirectionInterpolation": false,
    "allowCubemapSubstitution": false,
    "allowScreenCopyFallback": false,
    "allowZeroFillFallback": false,
    "allowLiveNoiseFallback": false
  },
  "allowedBakedData": [
    "target_mask",
    "surface_position_metadata",
    "surface_normal_metadata",
    "roughness_metadata",
    "diffuse_bake"
  ],
  "diagnosticOnly": {
    "cameraReferenceAllowed": true,
    "cameraReferenceRuntimeEnabled": false,
    "finiteCameraViewBakeAllowed": true,
    "finiteCameraViewBakeRuntimeEnabled": false,
    "cubemapProbeAllowed": true,
    "cubemapRuntimeEnabled": false,
    "directionBinProbeAllowed": true,
    "directionBinProbeRuntimeEnabled": false
  },
  "validation": {
    "automatedDomain": "user_accessible_config1_room_camera_movement",
    "sampledCameraStatesDoNotRedefineGoal": true,
    "eachSampledStateMustUseCurrentViewRoute": true,
    "userVisualFreeMovementAcceptanceRequired": true
  }
}
```

- [ ] **Step 2: Replace the accepted pointer JSON**

Use this full file content:

```json
{
  "version": "r7-3-9-config1-current-view-reflection",
  "packageStatus": "none",
  "routeStatus": "none",
  "runtimeEnabled": false,
  "acceptedRoute": null,
  "cubemapRuntimeEnabled": false,
  "packageDir": null,
  "surfaceTargets": [],
  "deferredSurfaceTargets": [
    "sprout_reflection_c1"
  ],
  "runtimeBlockReason": "R7-3.9 Config 1 reflection remains disabled until a current-view reflection route passes automated free-movement validation and user visual acceptance.",
  "clearedAt": "2026-05-12",
  "clearedPackages": [
    ".omc/r7-3-9-c1-accurate-reflection-bake/",
    ".omc/r7-3-9-c1-accurate-reflection-preview/"
  ],
  "activeDiffusePackage": "docs/data/r7-3-8-c1-bake-accepted-package.json"
}
```

- [ ] **Step 3: Keep the data contract in the worktree**

```text
1.  Do not commit yet.
2.  Continue to Task 3.
3.  The current-view contract test will verify this JSON after Task 5.
```

---

### Task 3: Add Current-View Runtime State And Validation Helpers

**Files:**
```text
Modify: js/Home_Studio.js
Modify: js/InitCommon.js
Test: docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
```

- [ ] **Step 1: Add the current-view uniforms in `js/Home_Studio.js`**

Find the existing R7-3.9 uniform block containing `uR739C1AccurateReflectionMode`. Add these uniforms beside it:

```js
uR739C1CurrentViewReflectionMode: { value: 0.0 },
uR739C1CurrentViewReflectionReady: { value: 0.0 },
uR739C1CurrentViewReflectionRoughness: { value: 0.1 },
```

Keep the legacy cache uniforms in place with default disabled values so existing code loads, but the new route must not sample `tR739C1ReflectionSurfaceCacheTexture`.

- [ ] **Step 2: Add current-view route state in `js/InitCommon.js`**

Insert after the existing R7-3.9 state variables:

```js
let r739C1CurrentViewReflectionValidationEnabled = false;
let r739C1CurrentViewReflectionReady = false;
let r739C1CurrentViewReflectionError = null;
let r739C1CurrentViewReflectionRoughness = 0.1;
```

- [ ] **Step 3: Add uniform update and report functions**

Insert after `r739C1AccurateReflectionConfigAllowed()`:

```js
function r739C1CurrentViewReflectionConfigAllowed()
{
	return (typeof currentPanelConfig === 'number') ? currentPanelConfig === 1 : false;
}

function updateR739C1CurrentViewReflectionUniforms()
{
	if (!pathTracingUniforms) return false;
	var captureMode = pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0;
	var referenceMode = pathTracingUniforms.uR739C1ReflectionReferenceMode ? pathTracingUniforms.uR739C1ReflectionReferenceMode.value : 0;
	var maskMode = pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode ? pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value : 0;
	var applied = r739C1CurrentViewReflectionValidationEnabled &&
		r739C1CurrentViewReflectionReady &&
		r739C1CurrentViewReflectionConfigAllowed() &&
		captureMode === 0 &&
		referenceMode === 0 &&
		maskMode === 0;
	if (pathTracingUniforms.uR739C1CurrentViewReflectionMode)
		pathTracingUniforms.uR739C1CurrentViewReflectionMode.value = applied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR739C1CurrentViewReflectionReady)
		pathTracingUniforms.uR739C1CurrentViewReflectionReady.value = r739C1CurrentViewReflectionReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR739C1CurrentViewReflectionRoughness)
		pathTracingUniforms.uR739C1CurrentViewReflectionRoughness.value = r739C1CurrentViewReflectionRoughness;
	return applied;
}

window.setR739C1CurrentViewReflectionValidationEnabled = function(enabled)
{
	r739C1CurrentViewReflectionValidationEnabled = !!enabled;
	r739C1CurrentViewReflectionReady = r739C1CurrentViewReflectionValidationEnabled;
	r739C1CurrentViewReflectionError = null;
	updateR739C1CurrentViewReflectionUniforms();
	resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-9-current-view-reflection-validation-toggle');
	return window.reportR739C1CurrentViewReflectionConfig();
};

window.reportR739C1CurrentViewReflectionConfig = function()
{
	var applied = updateR739C1CurrentViewReflectionUniforms();
	return {
		version: 'r7-3-9-config1-current-view-reflection',
		enabled: r739C1CurrentViewReflectionValidationEnabled,
		ready: r739C1CurrentViewReflectionReady,
		applied: applied,
		error: r739C1CurrentViewReflectionError,
		currentPanelConfig: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0,
		configAllowed: r739C1CurrentViewReflectionConfigAllowed(),
		routeKind: applied ? 'runtime_path_tracing_current_view' : null,
		computeFromCurrentCamera: applied,
		finiteViewBakeRuntimeEnabled: false,
		nearestDirectionLookupEnabled: false,
		directionInterpolationEnabled: false,
		cubemapRuntimeEnabled: false,
		screenCopyFallbackEnabled: false,
		zeroFillFallbackEnabled: false,
		liveNoiseFallbackEnabled: false,
		surfaceTarget: 'sprout_reflection_c1',
		bounds: R739_C1_SPROUT_REFLECTION_BOUNDS,
		routeRoughness: r739C1CurrentViewReflectionRoughness,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0),
		cameraPosition: worldCamera ? {
			x: worldCamera.position.x,
			y: worldCamera.position.y,
			z: worldCamera.position.z
		} : null
	};
};
```

- [ ] **Step 4: Update capture and restore state**

In `captureR738BakeState()`, add:

```js
r739CurrentViewReflectionMode: pathTracingUniforms && pathTracingUniforms.uR739C1CurrentViewReflectionMode ? pathTracingUniforms.uR739C1CurrentViewReflectionMode.value : 0.0,
r739CurrentViewReflectionReady: pathTracingUniforms && pathTracingUniforms.uR739C1CurrentViewReflectionReady ? pathTracingUniforms.uR739C1CurrentViewReflectionReady.value : 0.0,
```

In `restoreR738BakeState(state)`, add:

```js
if (pathTracingUniforms && pathTracingUniforms.uR739C1CurrentViewReflectionMode) pathTracingUniforms.uR739C1CurrentViewReflectionMode.value = state.r739CurrentViewReflectionMode;
if (pathTracingUniforms && pathTracingUniforms.uR739C1CurrentViewReflectionReady) pathTracingUniforms.uR739C1CurrentViewReflectionReady.value = state.r739CurrentViewReflectionReady;
if (typeof updateR739C1CurrentViewReflectionUniforms === 'function') updateR739C1CurrentViewReflectionUniforms();
```

- [ ] **Step 5: Add validation camera helper**

Insert near the existing camera probe helpers:

```js
window.setR739Config1ValidationCameraState = function(state)
{
	if (!state || !state.position)
		throw new Error('R7-3.9 validation camera state missing position');
	if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
	cameraControlsObject.position.set(state.position.x, state.position.y, state.position.z);
	cameraControlsPitchObject.rotation.set(Number(state.pitch) || 0, 0, 0);
	cameraControlsYawObject.rotation.set(0, Number(state.yaw) || 0, 0);
	inputRotationHorizontal = Number(state.yaw) || 0;
	inputRotationVertical = Number(state.pitch) || 0;
	oldYawRotation = inputRotationHorizontal;
	oldPitchRotation = inputRotationVertical;
	worldCamera.fov = Number.isFinite(Number(state.fov)) ? Number(state.fov) : 55;
	fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
	pathTracingUniforms.uVLen.value = Math.tan(fovScale);
	pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;
	cameraControlsObject.updateMatrixWorld(true);
	worldCamera.updateMatrixWorld(true);
	pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
	resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-9-current-view-validation-camera');
	return window.reportR739C1CurrentViewReflectionConfig();
};
```

- [ ] **Step 6: Keep the runtime helper work in the worktree**

```text
1.  Do not commit yet.
2.  Continue to Task 4.
3.  The current-view contract test will verify these hooks after Task 5.
```

---

### Task 4: Route The Sprout Patch Through Current-View Path Tracing

**Files:**
```text
Modify: shaders/Home_Studio_Fragment.glsl
Test: docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
```

- [ ] **Step 1: Add shader uniforms**

Add near the existing R7-3.9 uniforms:

```glsl
uniform float uR739C1CurrentViewReflectionMode;
uniform float uR739C1CurrentViewReflectionReady;
uniform float uR739C1CurrentViewReflectionRoughness;
```

- [ ] **Step 2: Add current-view helper functions**

Insert after `r739C1AccurateReflectionReplacesTarget(...)`:

```glsl
bool r739C1CurrentViewReflectionActiveForTarget(int targetId, vec3 visiblePosition)
{
	return uR739C1CurrentViewReflectionMode > 0.5
		&& uR739C1CurrentViewReflectionReady > 0.5
		&& r739C1AccurateReflectionReplacesTarget(targetId, visiblePosition);
}

float r739C1CurrentViewFloorRoughness(int targetId, vec3 visiblePosition)
{
	if (r739C1CurrentViewReflectionActiveForTarget(targetId, visiblePosition))
		return clamp(uR739C1CurrentViewReflectionRoughness, 0.0, 1.0);
	return uFloorRoughness;
}
```

- [ ] **Step 3: Keep reference disable logic from blocking the current-view route**

In `r739C1ReflectionReferenceDisablesTarget(...)`, keep this behavior:

```glsl
return uR739C1ReflectionReferenceMode > 1.5
	&& r739C1AccurateReflectionReplacesTarget(targetId, visiblePosition);
```

The current-view route is controlled by `uR739C1CurrentViewReflectionMode`, so `uR739C1AccurateReflectionMode` cannot disable live path tracing for the sprout patch.

- [ ] **Step 4: Use effective roughness in the floor reflection branch**

In the `if (hitType == DIFF)` floor material branch, compute the target id and effective roughness after these existing lines:

```glsl
bool isFloor = (hitObjectID < 1.5 && hitNormal.y > 0.5 && hitBoxMax.y < 0.1);
bool r738DiffuseOnlyActive = (uR738C1BakeCaptureMode == 2 && uR738C1BakeDiffuseOnlyMode > 0.5);
```

Add:

```glsl
int r739TargetId = r739C1ReflectionTargetId(hitType, hitObjectID, nl, x);
float r739EffectiveFloorRoughness = r739C1CurrentViewFloorRoughness(r739TargetId, x);
```

Then update the next existing booleans so they reuse `r739TargetId`:

```glsl
bool r739ReferenceDisabled = r739C1ReflectionReferenceDisablesTarget(hitType, hitObjectID, nl, x);
bool r739ReflectionOnlyTarget = uR739C1ReflectionReferenceMode > 0.5 &&
	uR739C1ReflectionReferenceMode < 1.5 &&
	r739C1AccurateReflectionReplacesTarget(r739TargetId, x);
```

Replace floor reflection checks and roughness mixes with `r739EffectiveFloorRoughness`:

```glsl
if (isFloor && !r738DiffuseOnlyActive && !r739ReferenceDisabled && r739EffectiveFloorRoughness < 0.999)
{
	float floorSpecularChance = mix(0.55, 0.08, r739EffectiveFloorRoughness);
	float floorRoughnessSquared = max(0.001, r739EffectiveFloorRoughness * r739EffectiveFloorRoughness);
```

In the `r739ReflectionOnlyTarget` branch, replace `uFloorRoughness` with `r739EffectiveFloorRoughness` in the threshold and `mix(...)` roughness factor. This makes the sprout patch use roughness `0.1` while surrounding floor still follows the UI roughness.

- [ ] **Step 5: Prevent the R7-3.8 diffuse paste from erasing the current-view reflection**

In the R7-3.8 paste block condition, add the current-view exclusion:

```glsl
&& !r739C1CurrentViewReflectionActiveForTarget(r739C1ReflectionTargetId(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition), firstVisiblePosition)
```

The resulting condition must still use `cloudVisibleSurfaceIsFloor(firstVisiblePosition, firstVisibleNormal)`.

- [ ] **Step 6: Keep the legacy reflection cache sampler inert**

Keep `r739SampleAccurateSurfaceReflection(...)` returning zero or remove its runtime use. The shader must not contain:

```glsl
texture(tR739C1ReflectionSurfaceCacheTexture
```

- [ ] **Step 7: Keep the shader route in the worktree**

```text
1.  Do not commit yet.
2.  Continue to Task 5.
3.  The current-view contract test will verify this shader route after Task 5.
```

---

### Task 5: Add Exact-1000 Probe And Free-Movement Validation

**Files:**
```text
Modify: js/InitCommon.js
Modify: docs/tools/r7-3-8-c1-bake-capture-runner.mjs
Test: docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
```

- [ ] **Step 1: Add validation states in `js/InitCommon.js`**

Insert near the R7-3.9 helpers:

```js
const R739_C1_CURRENT_VIEW_VALIDATION_CAMERA_STATES = Object.freeze([
	{
		name: 'center_forward',
		position: { x: 0.0, y: 1.6, z: 4.5 },
		yaw: 0.0,
		pitch: -0.18,
		fov: 55
	},
	{
		name: 'left_forward',
		position: { x: -1.8, y: 1.6, z: 4.0 },
		yaw: 0.22,
		pitch: -0.16,
		fov: 55
	},
	{
		name: 'right_forward',
		position: { x: 1.8, y: 1.6, z: 4.0 },
		yaw: -0.22,
		pitch: -0.16,
		fov: 55
	},
	{
		name: 'near_sprout',
		position: { x: 0.0, y: 1.35, z: 2.2 },
		yaw: 0.0,
		pitch: -0.38,
		fov: 55
	},
	{
		name: 'diagonal_walk',
		position: { x: 1.4, y: 1.55, z: 2.8 },
		yaw: -0.45,
		pitch: -0.25,
		fov: 55
	}
]);

const R739_C1_CURRENT_VIEW_VALIDATION_SWEEP_STATES = Object.freeze([
	{ name: 'sweep_00', position: { x: -1.6, y: 1.55, z: 4.4 }, yaw: 0.25, pitch: -0.18, fov: 55 },
	{ name: 'sweep_01', position: { x: -1.2, y: 1.55, z: 4.0 }, yaw: 0.20, pitch: -0.20, fov: 55 },
	{ name: 'sweep_02', position: { x: -0.8, y: 1.55, z: 3.6 }, yaw: 0.14, pitch: -0.23, fov: 55 },
	{ name: 'sweep_03', position: { x: -0.4, y: 1.50, z: 3.2 }, yaw: 0.07, pitch: -0.27, fov: 55 },
	{ name: 'sweep_04', position: { x: 0.0, y: 1.45, z: 2.8 }, yaw: 0.0, pitch: -0.31, fov: 55 },
	{ name: 'sweep_05', position: { x: 0.4, y: 1.50, z: 3.2 }, yaw: -0.07, pitch: -0.27, fov: 55 },
	{ name: 'sweep_06', position: { x: 0.8, y: 1.55, z: 3.6 }, yaw: -0.14, pitch: -0.23, fov: 55 },
	{ name: 'sweep_07', position: { x: 1.2, y: 1.55, z: 4.0 }, yaw: -0.20, pitch: -0.20, fov: 55 },
	{ name: 'sweep_08', position: { x: 1.6, y: 1.55, z: 4.4 }, yaw: -0.25, pitch: -0.18, fov: 55 }
]);
```

- [ ] **Step 2: Add exact sample rendering helper**

Add this function beside `renderR739MainReadback(...)`:

```js
async function renderR739CurrentViewExactSamples(targetSamples, timeoutMs, currentViewEnabled)
{
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	if (target !== 1000)
		throw new Error('R7-3.9 current-view validation requires exactly 1000 samples');
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var startedAt = performance.now();
	window.setR739C1CurrentViewReflectionValidationEnabled(!!currentViewEnabled);
	resetR738MainAccumulation();
	if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(true);
	var samples = 0;
	for (var sample = 1; sample <= target; sample += 1)
	{
		if (performance.now() - startedAt > timeout)
			break;
		sampleCounter = sample;
		frameCounter = sample + 1.0;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		pathTracingUniforms.uCameraIsMoving.value = false;
		pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		if (screenOutputUniforms)
		{
			if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
			if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
			if (screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = false;
		}
		updateR739C1CurrentViewReflectionUniforms();
		renderer.setRenderTarget(pathTracingRenderTarget);
		renderer.render(pathTracingScene, worldCamera);
		renderer.setRenderTarget(screenCopyRenderTarget);
		renderer.render(screenCopyScene, orthoCamera);
		samples = sample;
		if (sample % 16 === 0)
			await new Promise(function(resolve) { setTimeout(resolve, 0); });
	}
	renderer.setRenderTarget(null);
	if (samples !== 1000)
		throw new Error('R7-3.9 current-view validation finished at ' + samples + ' samples instead of exactly 1000');
	return {
		actualSamples: samples,
		readback: await readR738RenderTargetFloatPixels(screenCopyRenderTarget)
	};
}

function summarizeR739SproutCurrentViewDelta(onReadback, offReadback, maskReadback, samples)
{
	var divisor = Math.max(1.0, Number(samples) || 1.0);
	var pixels = onReadback.pixels;
	var offPixels = offReadback.pixels;
	var maskPixels = maskReadback.pixels;
	var sproutVisiblePixels = 0;
	var nonFiniteDeltaPixels = 0;
	var deltaSumLuma = 0.0;
	var deltaMaxLuma = 0.0;
	var onSumLuma = 0.0;
	for (var i = 0; i < pixels.length; i += 4)
	{
		var targetId = Math.round(maskPixels[i]);
		if (targetId !== 1) continue;
		sproutVisiblePixels += 1;
		var onR = pixels[i] / divisor;
		var onG = pixels[i + 1] / divisor;
		var onB = pixels[i + 2] / divisor;
		var offR = offPixels[i] / divisor;
		var offG = offPixels[i + 1] / divisor;
		var offB = offPixels[i + 2] / divisor;
		if (!Number.isFinite(onR) || !Number.isFinite(onG) || !Number.isFinite(onB) ||
			!Number.isFinite(offR) || !Number.isFinite(offG) || !Number.isFinite(offB))
		{
			nonFiniteDeltaPixels += 1;
			continue;
		}
		var deltaLuma = Math.abs(0.2126 * (onR - offR) + 0.7152 * (onG - offG) + 0.0722 * (onB - offB));
		var onLuma = 0.2126 * onR + 0.7152 * onG + 0.0722 * onB;
		deltaSumLuma += deltaLuma;
		onSumLuma += onLuma;
		if (deltaLuma > deltaMaxLuma) deltaMaxLuma = deltaLuma;
	}
	return {
		sproutVisiblePixels: sproutVisiblePixels,
		nonFiniteDeltaPixels: nonFiniteDeltaPixels,
		sproutDeltaMeanLuma: sproutVisiblePixels > 0 ? deltaSumLuma / sproutVisiblePixels : 0.0,
		sproutDeltaMaxLuma: deltaMaxLuma,
		sproutOnMeanLuma: sproutVisiblePixels > 0 ? onSumLuma / sproutVisiblePixels : 0.0
	};
}

function r739CameraStateVariation(results)
{
	if (!results || results.length < 2) return 0.0;
	var minValue = Infinity;
	var maxValue = -Infinity;
	for (var i = 0; i < results.length; i += 1)
	{
		var value = results[i].sproutSummary ? results[i].sproutSummary.sproutOnMeanLuma : 0.0;
		if (value < minValue) minValue = value;
		if (value > maxValue) maxValue = value;
	}
	return Number.isFinite(minValue) && Number.isFinite(maxValue) ? maxValue - minValue : 0.0;
}
```

- [ ] **Step 3: Add browser-side validation function**

Add:

```js
window.runR739C1CurrentViewReflectionValidation = async function(options)
{
	options = options || {};
	var timeoutMs = normalizeR738PositiveInt(options.timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	var results = [];
	try
	{
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		var validationStates = R739_C1_CURRENT_VIEW_VALIDATION_CAMERA_STATES.concat(R739_C1_CURRENT_VIEW_VALIDATION_SWEEP_STATES);
		for (var i = 0; i < validationStates.length; i += 1)
		{
			var cameraState = validationStates[i];
			window.setR739Config1ValidationCameraState(cameraState);
			window.setR739C1CurrentViewReflectionValidationEnabled(false);
			var maskReadback = await captureR739SurfaceReadback(1.0);
			var offReport = await renderR739CurrentViewExactSamples(1000, timeoutMs, false);
			var onReport = await renderR739CurrentViewExactSamples(1000, timeoutMs, true);
			var routeReport = window.reportR739C1CurrentViewReflectionConfig();
			var sproutSummary = summarizeR739SproutCurrentViewDelta(onReport.readback, offReport.readback, maskReadback, 1000);
			results.push({
				name: cameraState.name,
				cameraState: cameraState,
				routeReport: routeReport,
				actualSamples: onReport.actualSamples,
				offSamples: offReport.actualSamples,
				finiteViewBakeRuntimeEnabled: routeReport.finiteViewBakeRuntimeEnabled,
				cubemapRuntimeEnabled: routeReport.cubemapRuntimeEnabled,
				currentViewApplied: routeReport.applied,
				sproutSummary: sproutSummary,
				readbackSummary: summarizeR738RawHdrPixels(onReport.readback, onReport.actualSamples)
			});
		}
		var cameraStateVariation = r739CameraStateVariation(results);
		var visibleResults = results.filter(function(result) { return result.sproutSummary.sproutVisiblePixels > 0; });
		var deltaResults = visibleResults.filter(function(result) { return result.sproutSummary.sproutDeltaMeanLuma > 0.000001; });
		var checks = {
			config1: results.every(function(result) { return result.routeReport.currentPanelConfig === 1; }),
			currentViewApplied: results.every(function(result) { return result.currentViewApplied === true; }),
			exactSamples: results.every(function(result) { return result.actualSamples === 1000 && result.offSamples === 1000; }),
			noFiniteViewBakeRuntime: results.every(function(result) { return result.finiteViewBakeRuntimeEnabled === false; }),
			noCubemapRuntime: results.every(function(result) { return result.cubemapRuntimeEnabled === false; }),
			finiteReadback: results.every(function(result) { return result.readbackSummary.nonFinitePixels === 0; }),
			sproutVisiblePixels: visibleResults.length >= 3,
			sproutFiniteDelta: results.every(function(result) { return result.sproutSummary.nonFiniteDeltaPixels === 0; }),
			sproutDeltaMeanLuma: deltaResults.length >= 2,
			cameraStateVariation: cameraStateVariation > 0.00001
		};
		return {
			version: 'r7-3-9-config1-current-view-reflection',
			label: 'reference_only_validation',
			status: Object.keys(checks).every(function(key) { return checks[key]; }) ? 'pass' : 'fail',
			checks: checks,
			cameraStateVariation: cameraStateVariation,
			visibleStateCount: visibleResults.length,
			deltaStateCount: deltaResults.length,
			missingSproutStates: results.filter(function(result) { return result.sproutSummary.sproutVisiblePixels === 0; }).map(function(result) { return result.name; }),
			anchorStateCount: R739_C1_CURRENT_VIEW_VALIDATION_CAMERA_STATES.length,
			sweepStateCount: R739_C1_CURRENT_VIEW_VALIDATION_SWEEP_STATES.length,
			results: results
		};
	}
	finally
	{
		window.setR739C1CurrentViewReflectionValidationEnabled(false);
		restoreR738BakeState(state);
	}
};
```

- [ ] **Step 4: Add runner flags**

In `parseArgs`, add booleans for:

```js
currentViewValidation: args.includes('--r739-current-view-validation'),
```

- [ ] **Step 5: Add runner branch for current-view validation**

Add this branch before the existing `accurateReflectionPreviewTest` branch:

```js
if (args.currentViewValidation) {
  console.error('[r739-runner] running current-view reflection validation');
  const validation = await evaluate(cdp, `(() => {
    return window.runR739C1CurrentViewReflectionValidation({
      samples: 1000,
      timeoutMs: ${Math.min(args.timeoutMs, 3600000)},
      sweep: true
    });
  })()`, {
    awaitPromise: true,
    timeoutMs: Math.min(args.timeoutMs * 24, 3600000) + 180000
  });
  const validationDir = path.join(repoRoot, '.omc', 'r7-3-9-config1-current-view-reflection', timestampForPath());
  fs.mkdirSync(validationDir, { recursive: true });
  fs.writeFileSync(path.join(validationDir, 'validation-report.json'), `${JSON.stringify(validation, null, 2)}\n`);
  console.log('R7-3.9 Config 1 current-view reflection validation completed');
  console.log(`samples: ${validation.actualSamples}`);
  console.log(`states: ${validation.results.length}`);
  console.log(`sproutVisiblePixels: ${validation.results.map((result) => result.summary.sproutVisiblePixels).join(',')}`);
  console.log(`sproutDeltaMeanLuma: ${validation.results.map((result) => result.summary.sproutDeltaMeanLuma.toFixed(8)).join(',')}`);
  console.log(`status: ${validation.status}`);
  console.log(`report: ${path.relative(repoRoot, validationDir)}`);
  if (validation.status !== 'pass') process.exitCode = 1;
  completed = true;
  return;
}
```

- [ ] **Step 6: Strengthen reference_only artifact validation**

In the existing R7-3.9 reference capture validation, replace:

```js
actualSamples: report.actualSamples >= report.requestedSamples,
```

with:

```js
actualSamples: report.actualSamples === 1000 && report.requestedSamples === 1000,
```

Also ensure runner source contains this exact-sample guard:

```js
if (validationReport.actualSamples !== 1000) throw new Error('R7-3.9 reference_only probe must finish at exactly 1000 spp');
```

- [ ] **Step 7: Run the contract test**

Run:

```bash
node docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
```

Expected:

```text
R7-3.9 Config 1 current-view reflection route contract passed
```

- [ ] **Step 8: Commit the first green source checkpoint**

```bash
git add docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json js/Home_Studio.js js/InitCommon.js shaders/Home_Studio_Fragment.glsl docs/tools/r7-3-8-c1-bake-capture-runner.mjs docs/superpowers/plans/2026-05-12-r7-3-9-config1-current-view-reflection.md
git commit -m "feat: add config1 current-view sprout reflection route"
```

---

### Task 6: Run Automated Validation

**Files:**
```text
Read: docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
Write artifacts: .omc/r7-3-9-config1-current-view-reflection/<timestamp>/
```

- [ ] **Step 1: Run static contract test**

```bash
node docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
```

Expected:

```text
R7-3.9 Config 1 current-view reflection route contract passed
```

- [ ] **Step 2: Start local server if no server is already serving the app**

```bash
python3 -m http.server 9002
```

Expected:

```text
Serving HTTP on :: port 9002
```

If port `9002` is already serving `Home_Studio.html`, use that existing server.

- [ ] **Step 3: Run current-view validation**

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r739-current-view-validation --samples=1000 --angle=metal --timeout-ms=180000
```

Expected:

```text
R7-3.9 Config 1 current-view reflection validation completed
status: pass
samples: 1000
states: 14
cameraStateVariation: true
```

- [ ] **Step 4: Inspect the generated report**

Open the report printed by the runner and confirm:

```text
1.  status is pass.
2.  checks.config is true.
3.  checks.currentViewRouteApplied is true.
4.  checks.exactSamples is true.
5.  checks.rejectsFiniteViewBakeRuntime is true.
6.  checks.rejectsLookupFallbacks is true.
7.  checks.sproutVisiblePixels is true.
8.  checks.sproutDeltaMeanLuma is true.
9.  checks.cameraStateVariation is true.
10. Every result.actualSamples is 1000.
11. Every result.offSamples is 1000.
12. Every result.routeReport.routeKind is runtime_path_tracing_current_view.
13. visibleStateCount is at least 3.
14. deltaStateCount is at least 2.
15. missingSproutStates is recorded as validation coverage data, not promoted as a runtime reflection failure.
```

- [ ] **Step 5: Preserve the validation report path for the documentation task**

This repo usually keeps `.omc` reports untracked. Do not commit source files again in this task. Copy the report path printed by the runner into Task 7 documentation.

```text
1.  Leave .omc/r7-3-9-config1-current-view-reflection/<timestamp>/ untracked.
2.  Keep the report path for Debug_Log.md.
3.  Continue to Task 7.
```

---

### Task 7: Visual Acceptance Handoff

**Files:**
```text
Modify after validation: docs/SOP/Debug_Log.md
Modify after validation: docs/superpowers/plans/2026-05-11-r7-3-9-c1-reflection-bake.md
```

- [ ] **Step 1: Keep the accepted pointer disabled before user visual approval**

Confirm this stays true:

```json
{
  "packageStatus": "none",
  "routeStatus": "none",
  "runtimeEnabled": false,
  "acceptedRoute": null
}
```

- [ ] **Step 2: Provide the user with the live URL**

Use:

```text
http://localhost:9002/Home_Studio.html
```

Ask the user to test Config 1 free movement with these acceptance points:

```text
1.  Move freely inside the room.
2.  Watch the sprout patch on the floor.
3.  The reflection must stay attached to the floor patch.
4.  The reflected shape may shift with the viewing angle.
5.  The shift must feel like a current-view reflection, with no camera-fixed silhouette.
6.  At UI roughness 1, surrounding floor has no mirror-like reflection.
7.  At UI roughness 1, sprout patch follows the route roughness 0.1 behavior and needs explicit user approval.
8.  At route roughness 0.1 and 1000 spp, the sprout patch must visually join the surrounding live floor.
```

- [ ] **Step 3: Record validation outcome in Debug Log**

Append this entry after the validation run, replacing the report path with the actual generated path:

```markdown
### 2026-05-12 — R7-3.9 Config 1 current-view sprout reflection validation

- Scope: `sprout_reflection_c1`, Config 1, bounds `x=-1..1`, `z=-1..1`, route roughness `0.1`.
- Contract: runtime reflection is computed from the current camera state; finite camera-view reflection bake remains probe-only.
- Static test: `node docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js` passed.
- Runtime validation: `node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r739-current-view-validation --samples=1000 --angle=metal --timeout-ms=180000` passed.
- Validation report: `.omc/r7-3-9-config1-current-view-reflection/<timestamp>/validation-report.json`.
- Automated coverage: 5 anchor camera states and 9 deterministic sweep states, with exact 1000 spp on/off renders for every state.
- Sprout checks: `visibleStateCount`, `deltaStateCount`, and `cameraStateVariation` passed; states without sprout mask visibility are recorded in `missingSproutStates`.
- Pointer status: `docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json` remains disabled until user visual acceptance.
```

- [ ] **Step 4: Update reset SOP with implementation result**

Append a short implementation note to `docs/superpowers/plans/2026-05-11-r7-3-9-c1-reflection-bake.md`:

````markdown
## 14. Current-View Route Implementation Evidence

Status: automated validation complete, visual acceptance pending.

Evidence:

```text
1.  Config 1 current-view route is implemented for sprout_reflection_c1.
2.  The route uses current camera state at runtime.
3.  The route roughness is 0.1.
4.  The automated validation sampled 5 anchor camera states and 9 deterministic sweep states.
5.  Every sampled state rendered current-view on and current-view off at exactly 1000 spp.
6.  Sprout mask visibility reached at least 3 sampled camera states; current-view delta reached at least 2 visible states; camera-state variation passed.
7.  The accepted pointer remains disabled until user visual acceptance.
```
````

- [ ] **Step 5: Commit documentation updates**

```bash
git add docs/SOP/Debug_Log.md docs/superpowers/plans/2026-05-11-r7-3-9-c1-reflection-bake.md
git commit -m "docs: record current-view reflection validation evidence"
```

---

## Acceptance Gates

```text
1.  The static test passes.
2.  The spec says C1 is Config 1.
3.  The spec rejects finite camera-view reflection bake as final runtime data.
4.  The accepted pointer remains disabled before user visual approval.
5.  The shader has no runtime texture sample from tR739C1ReflectionSurfaceCacheTexture.
6.  The current-view route computes from the current camera state.
7.  The sprout patch uses route roughness 0.1.
8.  Surrounding floor still follows UI roughness.
9.  The runner validates 5 anchor camera states and 9 deterministic sweep states in Config 1.
10. Every current-view on render and current-view off render finishes at exactly 1000 spp.
11. At least 3 sampled camera states see sprout_reflection_c1 through the surface mask.
12. At least 2 visible sampled states have a measurable sprout current-view on/off delta.
13. The sweep reports measurable camera-state variation across sprout reflections.
14. The runner writes a report under .omc/r7-3-9-config1-current-view-reflection/.
15. The user visually approves free movement inside the room before any accepted pointer patch.
```

## Commands

```bash
node docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js
python3 -m http.server 9002
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r739-current-view-validation --samples=1000 --angle=metal --timeout-ms=180000
git diff --check -- docs/tests/r7-3-9-c1-accurate-reflection-bake.test.js docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json js/Home_Studio.js js/InitCommon.js shaders/Home_Studio_Fragment.glsl docs/tools/r7-3-8-c1-bake-capture-runner.mjs docs/superpowers/plans/2026-05-12-r7-3-9-config1-current-view-reflection.md docs/superpowers/plans/2026-05-11-r7-3-9-c1-reflection-bake.md docs/SOP/Debug_Log.md
```

## Self-Review Result

```text
Spec coverage:
  The plan implements Config 1 terminology, sprout-only scope, roughness 0.1, exact 1000 spp probes, current-view runtime radiance, finite-view rejection, and user free-movement acceptance.

Placeholder scan:
  No deferred implementation markers are used. Each code-changing task includes concrete snippets or complete file content.

Type consistency:
  Current-view route names use r739C1CurrentViewReflection across JS, GLSL, tests, and runner. Legacy AccurateReflection package names remain only as disabled compatibility points.
```

## Sprout V2 Checkpoint Result

```text
Status:
  accepted

Checkpoint:
  r7-3-9-config1-sprout-v2-success-20260513

User visual acceptance:
  Roughness 1 shows a hard boundary because the floor outside the sprout patch has no reflection.
  Roughness 0.1 at exactly 1000 spp blends into a complete ceiling-lamp reflection.

Runtime result:
  R7-3.8 sprout diffuse bake remains active.
  R7-3.9 current-view sprout reflection route is active.
  Finite-view R7-3.9 reflection cache packages remain unaccepted.

Latest validation report:
  .omc/r7-3-9-config1-current-view-reflection/20260513-005253/validation-report.json
```
