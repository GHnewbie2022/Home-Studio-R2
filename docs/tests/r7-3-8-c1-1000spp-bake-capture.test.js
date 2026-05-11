import fs from 'node:fs';
import assert from 'node:assert/strict';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');
const pathTracingCommon = fs.readFileSync('js/PathTracingCommon.js', 'utf8');
const shader = fs.readFileSync('shaders/Home_Studio_Fragment.glsl', 'utf8');
const spec = JSON.parse(fs.readFileSync('docs/data/r7-3-8-c1-bake-surface-spec.json', 'utf8'));

assert.equal(spec.version, 'r7-3-8-c1-1000spp-bake-capture');
assert.equal(spec.config, 1);
assert.equal(spec.patches.length, 1);
assert.equal(spec.patches[0].patchId, 0);
assert.equal(spec.patches[0].resolution.width, 512);
assert.equal(spec.patches[0].resolution.height, 512);
assert.equal(spec.patches[0].samplesPerTexel, 1000);
assert.equal(spec.patches[0].upscaled, false);

assert.match(homeStudio, /R7_3_8_C1_BAKE_CAPTURE_VERSION/);
assert.match(homeStudio, /uR738C1BakeCaptureMode/);
assert.match(shader, /uniform int uR738C1BakeCaptureMode;/);
assert.match(shader, /r738C1SurfaceClassColor/);
assert.match(shader, /r738C1BakeSurfacePoint/);
assert.match(pathTracingCommon, /uR738C1BakeCaptureMode\s*==\s*2/);
assert.match(pathTracingCommon, /r738C1BakeSurfacePoint/);
assert.match(initCommon, /window\.prepareR738C1BakeCapture/);
assert.match(initCommon, /window\.reportR738C1BakeCaptureAfterSamples/);
assert.match(initCommon, /window\.getR738C1BakeCaptureArtifacts/);
assert.match(initCommon, /readR738RenderTargetFloatPixels/);
assert.match(initCommon, /captureR738C1DirectSurfaceTexelPatch/);
assert.match(initCommon, /screenCopyRenderTarget/);
assert.match(initCommon, /upscaled:\s*false/);
assert.match(initCommon, /targetAtlasResolution/);
assert.doesNotMatch(initCommon, /appendChild\([^)]*R738/i);
assert.doesNotMatch(homeStudio, /R7-3\.8[^\n]*(checkbox|overlay|badge)/i);
assert.doesNotMatch(initCommon, /patchSize:\s*64/);
assert.ok(fs.existsSync('docs/data/r7-3-8-c1-bake-surface-spec.json'));
assert.ok(fs.existsSync('docs/tools/r7-3-8-c1-bake-capture-runner.mjs'));

console.log('R7-3.8 C1 1000SPP bake capture contract passed');
