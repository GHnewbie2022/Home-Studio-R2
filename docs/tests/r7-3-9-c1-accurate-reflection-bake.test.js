import assert from 'node:assert/strict';
import fs from 'node:fs';

const spec = JSON.parse(fs.readFileSync('docs/data/r7-3-9-c1-accurate-reflection-surface-spec.json', 'utf8'));
const accepted = JSON.parse(fs.readFileSync('docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json', 'utf8'));
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');

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
  'floor_primary_c1',
  'iron_door_west',
  'speaker_stands_rotated_boxes',
  'speaker_cabinets_rotated_boxes'
]);

assert.equal(spec.surfaceTargets[0].kind, 'planar');
assert.equal(spec.surfaceTargets[1].kind, 'planar');
assert.equal(spec.surfaceTargets[2].kind, 'rotated-box-family');
assert.equal(spec.surfaceTargets[3].kind, 'rotated-box-family');
assert.deepEqual(spec.accuracyPolicy.requiredRuntimeTargets, ['floor_primary_c1']);
assert.deepEqual(spec.accuracyPolicy.deferredRuntimeTargets, [
  'iron_door_west',
  'speaker_stands_rotated_boxes',
  'speaker_cabinets_rotated_boxes'
]);
assert.equal(spec.surfaceTargets[0].material.acceptedReflectionRoughness, 0.1);
assert.equal(spec.directionCache.fallbackWhenDirectionMissing, 'reject_package_before_runtime');
assert.equal(spec.diagnosticOnly.cubemapRuntimeEnabled, false);
assert.equal(accepted.floorRoughnessForReflection, 0.1);
assert.deepEqual(accepted.surfaceTargets, ['floor_primary_c1']);
assert.deepEqual(accepted.deferredSurfaceTargets, [
  'iron_door_west',
  'speaker_stands_rotated_boxes',
  'speaker_cabinets_rotated_boxes'
]);
assert.equal(accepted.validation.targetCounts.iron_door_west, 0);
assert.equal(accepted.validation.targetCounts.speaker_stands_rotated_boxes, 0);
assert.equal(accepted.validation.targetCounts.speaker_cabinets_rotated_boxes, 0);

assert.match(homeStudio, /uR739C1AccurateReflectionMode/);
assert.match(homeStudio, /tR739C1ReflectionSurfaceCacheTexture/);
assert.match(initCommon, /window\.reportR739C1AccurateReflectionAfterSamples/);
assert.match(initCommon, /window\.loadR739C1AccurateReflectionPackage/);
assert.match(initCommon, /window\.waitForR739C1AccurateReflectionReady/);
assert.match(initCommon, /loadR739C1AccurateReflectionPackage\(\)\.catch/);
assert.match(shader, /uniform float uR739C1AccurateReflectionMode;/);
assert.match(shader, /r739SampleAccurateSurfaceReflection/);
assert.match(shader, /uFloorRoughness\s*>=\s*0\.999/);
assert.match(shader, /r739C1AccurateReflectionReplacesTarget/);
assert.match(shader, /return targetId == 1;/);
assert.match(runner, /--accurate-reflection-capture/);
assert.match(runner, /floorRoughness:\s*0\.1/);
assert.match(initCommon, /floorRoughnessForReflection:\s*floorRoughness/);
assert.match(initCommon, /options\.floorRoughness\)\s*\?\s*options\.floorRoughness\s*:\s*0\.1/);
assert.doesNotMatch(shader, /tR739C1ReflectionProbeTexture/);

console.log('R7-3.9 C1 accurate reflection bake contract passed');
