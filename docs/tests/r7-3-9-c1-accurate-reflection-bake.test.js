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
assert.equal(accepted.routeStatus, 'accepted');
assert.equal(accepted.runtimeEnabled, true);
assert.equal(accepted.acceptedRoute, 'runtime_path_tracing_current_view');
assert.equal(accepted.cubemapRuntimeEnabled, false);
assert.deepEqual(accepted.surfaceTargets, ['sprout_reflection_c1']);
assert.deepEqual(accepted.deferredSurfaceTargets, []);
assert.equal(accepted.checkpoint.label, 'r7-3-9-config1-sprout-v2-success-20260513');
assert.equal(accepted.routeContract.config, 1);
assert.equal(accepted.routeContract.target, 'sprout_reflection_c1');
assert.equal(accepted.routeContract.roughness, 0.1);
assert.equal(accepted.routeContract.samplesForReferenceOnlyProbe, 1000);
assert.equal(accepted.routeContract.exactSamplesRequired, true);
assert.equal(accepted.visualAcceptance.acceptedByUser, true);
assert.match(accepted.visualAcceptance.roughnessOneObservation, /roughness 1/);
assert.match(accepted.visualAcceptance.roughnessPointOneObservation, /roughness 0\.1/);
assert.equal(accepted.validation.automatedStatus, 'pass');
assert.equal(accepted.validation.userVisualAcceptance, 'pass');
assert.equal(accepted.validation.latestActualSamples, 1000);
assert.equal(accepted.validation.cameraStateVariation, true);
assert.equal(accepted.packageDir, null);
assert.equal(accepted.artifacts, undefined);
assert.doesNotMatch(JSON.stringify(accepted), /20260511-190523|20260511-235900|20260512-134902/);

assert.match(resetSop, /C1 means Config 1/);
assert.match(resetSop, /free.*move|move freely/i);
assert.match(resetSop, /fixed samples = exactly 1000 spp/);
assert.match(resetSop, /Any finite validation-view reflection bake promoted as the final answer/);
assert.match(implementationSop, /current-view runtime route/);
assert.match(implementationSop, /sprout V2/i);
assert.doesNotMatch(implementationSop, /Choose Route A|Route B|Route C/);

assert.match(homeStudio, /uR739C1CurrentViewReflectionMode/);
assert.match(homeStudio, /uR739C1CurrentViewReflectionReady/);
assert.match(homeStudio, /uR739C1CurrentViewReflectionRoughness/);
assert.match(initCommon, /window\.reportR739C1CurrentViewReflectionConfig/);
assert.match(initCommon, /window\.setR739C1CurrentViewReflectionValidationEnabled/);
assert.match(initCommon, /let r739C1CurrentViewReflectionPreviewEnabled = true;/);
assert.match(initCommon, /window\.setR739C1CurrentViewReflectionPreviewEnabled/);
assert.match(initCommon, /previewEnabled: r739C1CurrentViewReflectionPreviewEnabled/);
assert.match(initCommon, /window\.setR739Config1ValidationCameraState/);
assert.match(initCommon, /window\.runR739C1CurrentViewReflectionValidation/);
assert.doesNotMatch(initCommon, /loadR739C1AccurateReflectionPackage\(\)\.catch/);

const currentViewUniformUpdate = initCommon.match(/function updateR739C1CurrentViewReflectionUniforms\(\)[\s\S]*?\n}/)?.[0] || '';
assert.match(currentViewUniformUpdate, /r739C1CurrentViewReflectionPreviewEnabled\s*\|\|\s*r739C1CurrentViewReflectionValidationEnabled/);
const initThreeFunction = initCommon.match(/function initTHREEjs\(\)[\s\S]*?\n} \/\/ end function initTHREEjs/)?.[0] || '';
assert.match(initThreeFunction, /updateR739C1CurrentViewReflectionUniforms\(\);/);

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
