import assert from 'node:assert/strict';
import fs from 'node:fs';

const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));
const r738 = JSON.parse(fs.readFileSync('docs/data/r7-3-8-c1-bake-accepted-package.json', 'utf8'));
const r739 = JSON.parse(fs.readFileSync('docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json', 'utf8'));
const r7310 = JSON.parse(fs.readFileSync('docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json', 'utf8'));
assert.equal(fs.existsSync('docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json'), true);
const r7310NorthWall = JSON.parse(fs.readFileSync('docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json', 'utf8'));
assert.equal(fs.existsSync('docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json'), true);
const r7310EastWall = JSON.parse(fs.readFileSync('docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json', 'utf8'));

function summarizeAtlasLuma(pointer)
{
	const atlasPath = `${pointer.packageDir}/${pointer.artifacts.atlasPatch0}`;
	assert.equal(fs.existsSync(atlasPath), true);
	const bytes = fs.readFileSync(atlasPath);
	const floats = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
	let maxLuma = 0.0;
	let sumLuma = 0.0;
	let nonzeroTexels = 0;
	for (let i = 0; i < floats.length; i += 4)
	{
		const luma = (floats[i] + floats[i + 1] + floats[i + 2]) / 3;
		if (luma > 0.0) nonzeroTexels += 1;
		if (luma > maxLuma) maxLuma = luma;
		sumLuma += luma;
	}
	return {
		maxLuma,
		meanLuma: sumLuma / Math.max(1, floats.length / 4),
		nonzeroTexels
	};
}

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const pathTracingCommon = fs.readFileSync('js/PathTracingCommon.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const html = fs.readFileSync('Home_Studio.html', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const runner = fs.readFileSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs', 'utf8');
const r7310RuntimeLoader = initCommon.slice(
  initCommon.indexOf('async function loadR7310C1FullRoomDiffuseRuntimePackage'),
  initCommon.indexOf('async function loadR7310C1NorthWallDiffuseRuntimePackage')
);
const bakeCaptureBlock = pathTracingCommon.match(/if \(uR738C1BakeCaptureMode == 2\)[\s\S]*?SetupScene\(\);/)?.[0] || '';
const pasteUniformBlock = initCommon.match(/function updateR738C1BakePastePreviewUniforms\(\)[\s\S]*?function r7310C1FullRoomDiffuseRuntimeConfigAllowed/)?.[0] || '';
const fullRuntimeUniformBlock = initCommon.match(/function updateR7310C1FullRoomDiffuseRuntimeUniforms\(\)[\s\S]*?function buildR7310C1CombinedDiffuseRuntimeTexture/)?.[0] || '';

assert.equal(contract.version, 'r7-3-10-full-room-diffuse-bake-architecture-probe');
assert.equal(contract.phase, 'quick_preview_architecture_probe');
assert.deepEqual(contract.configs, [1]);
assert.deepEqual(contract.nextConfigs, [2]);
assert.deepEqual(contract.deferredConfigs, [3, 4]);
assert.equal(contract.bakeMode, 'quick_preview');
assert.equal(contract.quickPreviewSamples, 1000);
assert.equal(contract.comparisonMode, 'sample_milestones');
assert.deepEqual(contract.comparisonSampleMilestones, [100, 200, 500, 1000]);
assert.equal(contract.exactSamplesRequired, true);
assert.equal(contract.acceptBelow1000, false);
assert.equal(contract.acceptAbove1000, false);
assert.equal(contract.finalTruthModeBake, false);
assert.equal(contract.runtimeReflection, 'live_path_tracing');
assert.equal(contract.bakedRadianceKind, 'full_diffuse_radiance');
assert.equal(contract.indirectOnly, false);
assert.equal(contract.directLightAlreadyIncluded, true);
assert.equal(contract.addDirectLightAfterBakeLookup, false);
assert.equal(contract.floorRoughnessPrimary, 0.1);
assert.equal(contract.floorRoughnessFallback, 1.0);
assert.equal(contract.floorRoughnessFallbackMeaning, 'iteration_usability_fallback');
assert.equal(contract.truthModeMaterialParametersMutable, false);
assert.equal(contract.renderingModes.quickPreviewMode.displayName, '快速預覽模式');
assert.equal(contract.renderingModes.quickPreviewMode.floorRoughnessPrimary, 0.1);
assert.equal(contract.renderingModes.quickPreviewMode.floorRoughnessFallback, 1.0);
assert.equal(contract.renderingModes.quickPreviewMode.fallbackMeaning, 'iteration_usability_fallback');
assert.equal(contract.renderingModes.approachingTruthMode.displayName, '趨近真實模式');
assert.equal(contract.renderingModes.approachingTruthMode.floorRoughness, 0.1);
assert.equal(contract.renderingModes.approachingTruthMode.parametersFrozen, true);
assert.equal(contract.renderingModes.approachingTruthMode.fallbackAllowed, false);
assert.equal(contract.renderingModes.approachingTruthMode.purpose, 'approaching_truth_reference');
assert.equal(contract.renderingModes.approachingTruthMode.purposeDisplayName, '採購決策以趨近真實模式為準');
assert.equal(contract.surfaceRolloutStrategy.oneShotFullRoomBake, false);
assert.equal(contract.surfaceRolloutStrategy.orderBy, 'roi_descending');
assert.equal(contract.surfaceRolloutStrategy.finalC1CoverageRequired, true);
assert.equal(contract.surfaceRolloutStrategy.finalMissingSurfaceNamesMustBeEmpty, true);
assert.deepEqual(contract.surfaceRolloutStrategy.batches[0], ['floor']);
assert.deepEqual(contract.surfaceRolloutStrategy.batches[1], ['walls']);
assert.deepEqual(contract.surfaceRolloutStrategy.batches[2], ['ceiling']);
assert.equal(contract.surfaceRolloutStrategy.batches.length, 6);
assert.deepEqual(contract.c1FloorBatch.worldBounds, {
  xMin: -2.11,
  xMax: 2.11,
  zMin: -2.074,
  zMax: 3.256,
  y: 0.01
});
assert.equal(contract.c1FloorBatch.surfaceName, 'c1_floor_full_room');
assert.equal(contract.c1FloorBatch.targetId, 1001);
assert.equal(contract.c1FloorBatch.invalidTexelRegions, undefined);
assert.deepEqual(contract.c1NorthWallBatch.worldBounds, {
  xMin: -2.11,
  xMax: 2.11,
  yMin: 0.0,
  yMax: 2.905,
  z: -1.874
});
assert.equal(contract.c1NorthWallBatch.surfaceName, 'c1_north_wall');
assert.equal(contract.c1NorthWallBatch.targetId, 1002);
assert.equal(contract.c1NorthWallBatch.mapping, 'planar_xy');
assert.deepEqual(contract.c1NorthWallBatch.invalidTexelRegions.doorHole, {
  xMin: -1.52,
  xMax: -0.73,
  yMin: 0.0,
  yMax: 2.03
});
assert.equal(contract.c1NorthWallBatch.invalidTexelRegions.wardrobeContact, undefined);
assert.deepEqual(contract.c1EastWallBatch.worldBounds, {
  zMin: -1.874,
  zMax: 3.056,
  yMin: 0.0,
  yMax: 2.905,
  x: 1.91
});
assert.equal(contract.c1EastWallBatch.surfaceName, 'c1_east_wall');
assert.equal(contract.c1EastWallBatch.targetId, 1003);
assert.equal(contract.c1EastWallBatch.mapping, 'planar_zy');
assert.equal(contract.c1EastWallBatch.invalidTexelRegions, undefined);
assert.equal(r7310.packageStatus, 'architecture_probe');
assert.equal(r7310.runtimeScope, 'c1_floor_full_room_diffuse_short_circuit');
assert.equal(r7310.runtimeEnabledDefault, false);
assert.equal(r7310.targetId, 1001);
assert.equal(r7310.requestedSamples, 1000);
assert.equal(r7310.artifacts.atlasPatch0, 'atlas-patch-000-rgba-f32.bin');
assert.equal(r7310NorthWall.packageStatus, 'architecture_probe');
assert.equal(r7310NorthWall.runtimeScope, 'c1_north_wall_diffuse_short_circuit');
assert.equal(r7310NorthWall.runtimeEnabledDefault, false);
assert.equal(r7310NorthWall.targetId, 1002);
assert.equal(r7310NorthWall.requestedSamples, 1000);
assert.equal(r7310NorthWall.surfaceName, 'c1_north_wall');
assert.equal(r7310NorthWall.artifacts.atlasPatch0, 'atlas-patch-000-rgba-f32.bin');
assert.equal(r7310EastWall.packageStatus, 'architecture_probe');
assert.equal(r7310EastWall.runtimeScope, 'c1_east_wall_diffuse_short_circuit');
assert.equal(r7310EastWall.runtimeEnabledDefault, false);
assert.equal(r7310EastWall.targetId, 1003);
assert.equal(r7310EastWall.requestedSamples, 1000);
assert.equal(r7310EastWall.surfaceName, 'c1_east_wall');
assert.equal(r7310EastWall.artifacts.atlasPatch0, 'atlas-patch-000-rgba-f32.bin');
const r7310FloorAtlasStats = summarizeAtlasLuma(r7310);
const r7310NorthWallAtlasStats = summarizeAtlasLuma(r7310NorthWall);
const r7310EastWallAtlasStats = summarizeAtlasLuma(r7310EastWall);
assert.ok(r7310FloorAtlasStats.nonzeroTexels > 0);
assert.ok(r7310FloorAtlasStats.meanLuma > 0.001);
assert.ok(r7310NorthWallAtlasStats.nonzeroTexels > 0);
assert.ok(r7310NorthWallAtlasStats.meanLuma > 0.001);
assert.ok(r7310EastWallAtlasStats.nonzeroTexels > 0);
assert.ok(r7310EastWallAtlasStats.meanLuma > 0.001);
assert.ok(r7310EastWallAtlasStats.maxLuma > 0.01);

assert.equal(r738.packageStatus, 'accepted');
assert.equal(r738.diffuseOnly, true);
assert.equal(contract.acceptedSproutBaseline.kind, 'full_diffuse_radiance');

assert.equal(r739.runtimeEnabled, false);
assert.equal(contract.invalidatedReflectionBake.runtimeEnabled, false);

assert.match(shader, /r7310C1BakeSurfacePoint/);
assert.match(shader, /r7310C1BakePastePreviewUv/);
assert.match(shader, /r7310C1RuntimeSurfaceIsTrueFloor/);
assert.match(shader, /visiblePosition\.y <= 0\.025/);
assert.doesNotMatch(
  shader.match(/bool r7310C1FullRoomDiffuseShortCircuit[\s\S]*?\n}/)?.[0] || '',
  /cloudVisibleSurfaceIsFloor/
);
assert.match(shader, /uniform sampler2D tR7310C1FullRoomDiffuseAtlasTexture;/);
assert.doesNotMatch(shader, /tR7310C1NorthWallDiffuseAtlasTexture/);
assert.match(shader, /uR7310C1FullRoomDiffuseMode/);
assert.match(shader, /uR7310C1FloorDiffuseMode/);
assert.match(shader, /uR7310C1NorthWallDiffuseMode/);
assert.match(shader, /r7310C1FullRoomDiffuseShortCircuit/);
assert.match(shader, /r7310C1FloorHiddenByStaticContact/);
assert.match(shader, /r7310C1NorthWallDiffuseUv/);
assert.match(shader, /r7310C1RuntimeSurfaceIsNorthWall/);
assert.match(shader, /r7310C1NorthWallHiddenByStaticContact/);
assert.match(shader, /r7310NorthWallBakedRadiance/);
assert.match(shader, /r7310C1EastWallDiffuseUv/);
assert.match(shader, /r7310C1RuntimeSurfaceIsEastWall/);
assert.match(shader, /r7310C1EastWallHiddenByStaticContact/);
assert.match(shader, /uR7310C1EastWallDiffuseMode/);
assert.match(shader, /r7310EastWallBakedRadiance/);
assert.match(shader, /r7310C1CombinedAtlasUv\(atlasUv, 2\.0\)/);
assert.match(shader, /r7310C1CombinedAtlasUv/);
assert.match(shader, /uR7310C1RuntimeAtlasPatchResolution/);
assert.match(shader, /uR7310C1RuntimeAtlasPatchCount/);
assert.match(shader, /\(safeUv\.x \+ patchSlot\) \/ patchCount/);
assert.match(shader, /\+ 0\.5\) \/ resolution/);
assert.match(shader, /accumCol \+= mask \* r7310BakedRadiance;/);
assert.match(shader, /uR7310C1RuntimeProbeMode/);
assert.match(shader, /hitIsRayExiting/);
assert.match(shader, /r7310C1RuntimeProbeMode > 1\.5/);
assert.match(shader, /r7310C1RuntimeProbeMode < 2\.5/);
assert.match(shader, /r7310C1RuntimeProbeMode < 3\.5/);
assert.match(shader, /r7310C1RuntimeProbeMode < 4\.5/);
assert.match(shader, /r7310C1RuntimeProbeMode < 5\.5/);
assert.match(shader, /r7310C1RuntimeProbeMode < 6\.5/);
assert.match(shader, /hitIsRayExiting == TRUE/);
assert.match(shader, /r7310C1FullRoomDiffuseShortCircuit\([^)]*int visibleIsRayExiting/);
assert.match(shader, /if \(visibleIsRayExiting == TRUE\)\s+return false;/);
assert.match(shader, /bounces == 0 &&\s*r7310C1FullRoomDiffuseShortCircuit\(hitType, hitObjectID, nl, x, hitIsRayExiting, r7310BakedRadiance\)/);
assert.match(shader, /uCamPos\.y - 0\.5/);
assert.match(shader, /uR7310C1BakeFloorWorldBounds/);
assert.match(pathTracingCommon, /r7310C1BakeSurfacePoint/);
assert.doesNotMatch(bakeCaptureBlock, /gl_FragCoord\.xy \+ vec2\(0\.5\)/);
assert.match(bakeCaptureBlock, /vec2 r738BakeUv = gl_FragCoord\.xy \/ uResolution;/);
assert.match(initCommon, /captureR7310C1FloorDiffuseAtlas/);
assert.match(initCommon, /buildR7310C1FloorTexelMetadata/);
assert.match(initCommon, /captureR7310C1NorthWallDiffuseAtlas/);
assert.match(initCommon, /buildR7310C1NorthWallTexelMetadata/);
assert.match(initCommon, /maskR7310C1NorthWallAtlasPixels/);
assert.match(initCommon, /window\.reportR7310C1NorthWallDiffuseBakeAfterSamples/);
assert.match(initCommon, /captureR7310C1EastWallDiffuseAtlas/);
assert.match(initCommon, /buildR7310C1EastWallTexelMetadata/);
assert.match(initCommon, /window\.reportR7310C1EastWallDiffuseBakeAfterSamples/);
assert.match(shader, /patchId == 1002/);
assert.match(shader, /x >= -1\.52 && x <= -0\.73 && y >= 0\.0 && y <= 2\.03/);
assert.doesNotMatch(shader, /x >= 1\.35 && x <= 1\.91 && y >= 0\.0 && y <= 1\.955/);
assert.match(shader, /patchId == 1003/);
assert.match(shader, /position = vec3\(1\.91, y, z\)/);
assert.doesNotMatch(shader, /z >= -1\.874 && z <= -0\.703 && y >= 0\.0 && y <= 1\.955/);
assert.doesNotMatch(shader, /z >= 0\.198 && z <= 0\.798 && y >= 0\.655 && y <= 1\.855/);
assert.doesNotMatch(initCommon, /R7310_C1_FLOOR_INVALID_TEXEL_REGIONS/);
assert.doesNotMatch(initCommon, /R7310_C1_NORTH_WALL_STATIC_CONTACT_REGIONS/);
assert.doesNotMatch(initCommon, /R7310_C1_EAST_WALL_INVALID_TEXEL_REGIONS/);
assert.doesNotMatch(initCommon, /maskR7310C1FloorAtlasPixels/);
assert.doesNotMatch(initCommon, /maskR7310C1EastWallAtlasPixels/);
assert.doesNotMatch(initCommon, /fillR7310C1InvalidAtlasPixelsFromNearestValid/);
assert.match(initCommon, /window\.reportR7310C1FloorDiffuseBakeAfterSamples/);
assert.match(initCommon, /loadR7310C1FullRoomDiffuseRuntimePackage/);
assert.match(initCommon, /R7310_C1_NORTH_WALL_DIFFUSE_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /loadR7310C1NorthWallDiffuseRuntimePackage/);
assert.match(initCommon, /R7310_C1_EAST_WALL_DIFFUSE_RUNTIME_PACKAGE_URL/);
assert.match(initCommon, /loadR7310C1EastWallDiffuseRuntimePackage/);
assert.match(initCommon, /buildR7310C1CombinedDiffuseRuntimeTexture/);
assert.match(initCommon, /window\.setR7310C1FullRoomDiffuseRuntimeEnabled/);
assert.match(initCommon, /window\.setR7310C1FloorDiffuseRuntimeEnabled/);
assert.match(initCommon, /window\.setR7310C1NorthWallDiffuseRuntimeEnabled/);
assert.match(initCommon, /window\.setR7310C1EastWallDiffuseRuntimeEnabled/);
assert.match(pasteUniformBlock, /r7310C1FloorToggleOwnsSproutPaste/);
assert.match(pasteUniformBlock, /disabledByR7310FloorToggle/);
assert.doesNotMatch(pasteUniformBlock, /!r7310FloorRuntimeApplied/);
assert.doesNotMatch(pasteUniformBlock, /r7310C1NorthWallDiffuseRuntimeEnabled[\s\S]*!r7310RuntimeApplied/);
assert.doesNotMatch(pasteUniformBlock, /r7310C1FloorDiffuseRuntimeEnabled \|\| r7310C1NorthWallDiffuseRuntimeEnabled/);
assert.match(fullRuntimeUniformBlock, /floorApplied/);
assert.match(fullRuntimeUniformBlock, /northWallApplied/);
assert.match(fullRuntimeUniformBlock, /eastWallApplied/);
assert.match(fullRuntimeUniformBlock, /uR7310C1FloorDiffuseMode\.value = floorApplied \? 1\.0 : 0\.0/);
assert.match(fullRuntimeUniformBlock, /uR7310C1NorthWallDiffuseMode\.value = northWallApplied \? 1\.0 : 0\.0/);
assert.match(fullRuntimeUniformBlock, /uR7310C1EastWallDiffuseMode\.value = eastWallApplied \? 1\.0 : 0\.0/);
assert.doesNotMatch(fullRuntimeUniformBlock, /r7310C1FullRoomDiffuseRuntimeReady &&\s*r7310C1NorthWallDiffuseRuntimeReady/);
assert.match(initCommon, /window\.reportR7310C1FullRoomDiffuseRuntimeProbe/);
assert.match(initCommon, /bakedSurfaceHitCount/);
assert.match(initCommon, /bakedSurfaceShortCircuitCount/);
assert.match(initCommon, /options\.probeLevel/);
assert.match(initCommon, /options\.samplePoints/);
assert.match(initCommon, /options\.samplePointSpace/);
assert.match(initCommon, /options\.decodeMode/);
assert.match(initCommon, /options\.cameraState/);
assert.match(initCommon, /decodeR7310C1RuntimeProbeSample/);
assert.match(initCommon, /normalizeR7310C1RuntimeProbeSamplePoints/);
assert.match(initCommon, /samplePoints: r7310ProbeSamples/);
assert.match(runner, /r7310RuntimeProbeSampleTest/);
assert.match(runner, /--r7310-runtime-probe-sample-test/);
assert.match(runner, /probeLevel: level/);
assert.match(runner, /samplePointSpace: 'canvasCssPixel'/);
assert.match(initCommon, /uiMeaningOff:\s*'all_live_path_tracing'/);
assert.match(initCommon, /uiMeaningOn:\s*'selected_floor_north_or_east_wall_1024_baked_diffuse_plus_live_reflection'/);
assert.doesNotMatch(initCommon, /sprout_patch_plus_live_floor/);
assert.match(initCommon, /sproutPasteApplied/);
assert.match(initCommon, /sproutPasteUniformMode/);
assert.match(runner, /all_live_path_tracing/);
assert.match(runner, /sproutPasteApplied === false/);
assert.match(runner, /uniformFloorMode === 1/);
assert.match(runner, /uniformNorthWallMode === 1/);
assert.match(runner, /uniformEastWallMode === 1/);
assert.match(initCommon, /uR7310C1RuntimeAtlasPatchCount\.value = 3\.0/);
assert.match(html, /id="r7310-full-floor-actions"/);
assert.match(html, /id="btn-r7310-floor-diffuse"/);
assert.match(html, /id="btn-r7310-north-wall-diffuse"/);
assert.match(html, /id="btn-r7310-east-wall-diffuse"/);
assert.match(html, />地板烘焙：關</);
assert.match(html, />北牆烘焙：關</);
assert.match(html, />東牆烘焙：關</);
assert.doesNotMatch(html, /btn-r739-ab-|data-r739-ab-mode|A 漫射|B 原V2|C 反射|D 粗1/);
assert.match(homeStudio, /bindR7310FullFloorDiffuseControls/);
assert.match(homeStudio, /refreshR7310FullFloorDiffuseButton/);
assert.match(initCommon, /setR7310C1FullRoomDiffuseRuntimeEnabled/);
assert.match(homeStudio, /setR7310C1FloorDiffuseRuntimeEnabled/);
assert.match(homeStudio, /setR7310C1NorthWallDiffuseRuntimeEnabled/);
assert.match(homeStudio, /setR7310C1EastWallDiffuseRuntimeEnabled/);
assert.match(homeStudio, /地板烘焙：開/);
assert.match(homeStudio, /北牆烘焙：開/);
assert.match(homeStudio, /東牆烘焙：開/);
assert.doesNotMatch(homeStudio, /bindR739SproutABControls|refreshR739SproutABButtons|btn-r739-ab-|r739-sprout-ab-actions/);
assert.match(homeStudio, /'snapshot-controls', 'floor-roughness-actions', 'r7310-full-floor-actions', 'snapshot-bar', 'snapshot-actions'/);
assert.match(runner, /--r7310-full-room-diffuse-bake/);
assert.match(runner, /--r7310-surface=/);
assert.match(runner, /--r7310-runtime-short-circuit-test/);
assert.match(runner, /--r7310-north-wall-runtime-test/);
assert.match(runner, /--r7310-east-wall-runtime-test/);
assert.match(runner, /--r7310-ui-toggle-test/);
assert.match(runner, /btn-r7310-floor-diffuse/);
assert.match(runner, /btn-r7310-north-wall-diffuse/);
assert.match(runner, /btn-r7310-east-wall-diffuse/);
assert.match(runner, /--target-samples=/);

console.log('R7-3.10 full-room diffuse bake architecture contract passed');
