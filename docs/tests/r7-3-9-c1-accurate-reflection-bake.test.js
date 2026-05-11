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

{
  const packageDir = accepted.packageDir;
  const mask = new Uint8Array(fs.readFileSync(`${packageDir}/${accepted.artifacts.mask}`));
  const cacheBuffer = fs.readFileSync(`${packageDir}/${accepted.artifacts.surfaceCache}`);
  const cache = new Float32Array(cacheBuffer.buffer, cacheBuffer.byteOffset, cacheBuffer.byteLength / 4);
  let floorCount = 0;
  let floorMaxLuma = 0;
  for (let p = 0; p < mask.length; p += 1) {
    if (mask[p] !== 1) continue;
    const i = p * 4;
    const luma = 0.299 * cache[i] + 0.587 * cache[i + 1] + 0.114 * cache[i + 2];
    floorCount += 1;
    floorMaxLuma = Math.max(floorMaxLuma, luma);
  }
  assert.equal(floorCount, accepted.validation.targetCounts.floor_primary_c1);
  assert(floorMaxLuma > 0.05, `Accepted floor reflection cache is too dark: max luma ${floorMaxLuma}`);
}

assert.match(homeStudio, /uR739C1AccurateReflectionMode/);
assert.match(homeStudio, /tR739C1ReflectionSurfaceCacheTexture/);
assert.match(initCommon, /window\.reportR739C1AccurateReflectionAfterSamples/);
assert.match(initCommon, /window\.loadR739C1AccurateReflectionPackage/);
assert.match(initCommon, /window\.waitForR739C1AccurateReflectionReady/);
assert.match(initCommon, /loadR739C1AccurateReflectionPackage\(\)\.catch/);
assert.match(shader, /uniform float uR739C1AccurateReflectionMode;/);
assert.match(shader, /uniform float uR739C1ReflectionFloorRoughness;/);
assert.match(shader, /r739SampleAccurateSurfaceReflection/);
assert.match(shader, /bool r739C1AccurateReflectionReplacesTarget\(int targetId,\s*vec3 visiblePosition\)/);
assert.match(shader, /r738C1BakePastePreviewUv\(visiblePosition,\s*r739SproutUv\)/);
{
  const replaceFunction = shader.match(/bool r739C1AccurateReflectionReplacesTarget[\s\S]*?\n}/)?.[0] || '';
  assert.doesNotMatch(replaceFunction, /uFloorRoughness/);
  assert.doesNotMatch(replaceFunction, /uR739C1ReflectionFloorRoughness/);
}
assert.doesNotMatch(shader, /targetId == 1 && uFloorRoughness\s*>=\s*0\.999\)\s*return vec3\(0\.0\);/);
assert.match(runner, /--accurate-reflection-capture/);
assert.match(runner, /floorRoughness:\s*0\.1/);
assert.doesNotMatch(initCommon, /fullReadback\.pixels\[i\][\s\S]{0,80}\/ divisor/);
assert.match(initCommon, /floorRoughnessForReflection:\s*floorRoughness/);
assert.match(initCommon, /uR739C1ReflectionFloorRoughness/);
assert.match(initCommon, /sproutReplacementActive/);
assert.match(initCommon, /surroundingLiveFloorReplacementActive/);
{
  const configFunction = initCommon.match(/window\.reportR739C1AccurateReflectionConfig = function\(\)[\s\S]*?\n};/)?.[0] || '';
  assert.doesNotMatch(configFunction, /Math\.abs\(Number\(floorRoughness\) - Number\(packageFloorRoughness\)\)/);
}
assert.match(initCommon, /options\.floorRoughness\)\s*\?\s*options\.floorRoughness\s*:\s*0\.1/);
assert.doesNotMatch(shader, /tR739C1ReflectionProbeTexture/);

console.log('R7-3.9 C1 accurate reflection bake contract passed');
