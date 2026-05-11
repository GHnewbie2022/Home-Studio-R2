/**
 * R7-3 Quick Preview Fill — Contract Test
 * Run: node docs/tests/r7-3-quick-preview-fill.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'Home_Studio.html'), 'utf8');
const initCommon = fs.readFileSync(path.join(root, 'js/InitCommon.js'), 'utf8');
const homeStudio = fs.readFileSync(path.join(root, 'js/Home_Studio.js'), 'utf8');
const pathShader = fs.readFileSync(path.join(root, 'shaders/Home_Studio_Fragment.glsl'), 'utf8');
const screenOutput = fs.readFileSync(path.join(root, 'shaders/ScreenOutput_Fragment.glsl'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/default.css'), 'utf8');

const version = 'r7-3-quick-preview-fill-v3al-c1c2-fps1';

function assertOrder(source, before, after, message) {
	const beforeIndex = source.indexOf(before);
	const afterIndex = source.indexOf(after);
	assert(beforeIndex >= 0, message + ' (missing before marker)');
	assert(afterIndex >= 0, message + ' (missing after marker)');
	assert(beforeIndex < afterIndex, message);
}

function functionBody(source, name) {
	const marker = `function ${name}()`;
	const start = source.indexOf(marker);
	assert(start >= 0, `missing function ${name}`);
	const nextFunction = source.indexOf('\nfunction ', start + marker.length);
	return source.slice(start, nextFunction >= 0 ? nextFunction : source.length);
}

assert(!html.includes('css/default.css?v=fixed-1440p-r7-3-ui-v1'), 'R7-3 fixed curve must not keep the old UI CSS cache token');
assert(html.includes(`InitCommon.js?v=${version}`), 'HTML must cache-bust InitCommon for R7-3');
assert(html.includes(`Home_Studio.js?v=${version}`), 'HTML must cache-bust Home_Studio for R7-3');
assert(homeStudio.includes(`R7_3_QUICK_PREVIEW_FILL_VERSION = '${version}'`), 'Home_Studio must expose R7-3 version');
assert(homeStudio.includes(`Home_Studio_Fragment.glsl?v=${version}`), 'Home shader cache token must identify R7-3');
assert(initCommon.includes(`ScreenOutput_Fragment.glsl?v=${version}`), 'ScreenOutput shader cache token must identify R7-3');

assert(!html.includes('id="r73-quick-preview-fill-controls"'), 'R7-3 validation toggle must be removed from the bottom-left UI');
assert(!html.includes('id="chk-r73-quick-preview-fill"'), 'R7-3 validation toggle must not expose a checkbox');
assert(!html.includes('input-r73-quick-preview-fill-spp'), 'R7-3 UI must not expose editable SPP fields');
assert(!html.includes('class="r73-fill-spp-input"'), 'R7-3 UI must remove number inputs');
assert(!css.includes('#r73-quick-preview-fill-controls'), 'R7-3 validation toggle styling must be removed');
assert(!css.includes('.r73-fill-toggle'), 'R7-3 compact toggle styling must be removed');
assert(!css.includes('.r73-fill-spp-input'), 'R7-3 UI must not keep editable field styling');

assert(initCommon.includes('let r73QuickPreviewFillEnabled = true'), 'R7-3 fixed curve must default on');
assert(initCommon.includes('const R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT = [3.20, 1.70, 1.50, 1.25]'), 'R7-3 v3p must use the fixed user-selected curve');
assert(initCommon.includes('function r73QuickPreviewFillConfigAllowed()'), 'R7-3 fill must gate itself by C3/C4 only');
const r73ConfigAllowedBody = functionBody(initCommon, 'r73QuickPreviewFillConfigAllowed');
assert(r73ConfigAllowedBody.includes('return config === 3;'), 'R7-3 fixed curve must apply to C3 only after C4 rollback');
assert(!r73ConfigAllowedBody.includes('config === 4'), 'R7-3 fixed curve must not apply to C4 after rollback');
assert(!r73ConfigAllowedBody.includes('return movementProtectionConfigAllowed();'), 'R7-3 fixed curve must not inherit the C3/C4 movement-protection gate');
assert(initCommon.includes('function r73QuickPreviewFillQuickModeActive()'), 'R7-3 fill must gate itself by quick-preview mode');
assert(initCommon.includes('function updateR73QuickPreviewFillUniforms()'), 'R7-3 fill must update screen-output uniforms');
assert(initCommon.includes('function computeR73QuickPreviewFillEffectiveStrength(samples)'), 'R7-3 v3j must compute a fixed SPP strength curve');
assert(initCommon.includes('if (samples <= 4.0)'), 'R7-3 v3j must use the fixed 1-4SPP values');
assert(initCommon.includes('1.0 + (spp4Strength - 1.0) / Math.pow(2.0, samples - 4.0)'), 'R7-3 v3j curve must decay from the 4SPP value toward 1.0');
assert(initCommon.includes('r73QuickPreviewFillEffectiveStrength'), 'R7-3 v3j must track effective strength separately');
assert(initCommon.includes('window.setR73QuickPreviewFillEnabled = function'), 'R7-3 fill must expose an enable helper');
assert(!initCommon.includes('window.setR73QuickPreviewFillCurve = function'), 'R7-3 v3j must remove the editable curve helper');
assert(initCommon.includes('window.reportR73QuickPreviewFillConfig = function'), 'R7-3 fill must expose a reporter');
assert(initCommon.includes('window.reportR73GikWallLumaComparisonAfterSamples = async function'), 'R7-3 must expose a C3/C4 GIK-vs-wall luma comparison helper');
assert(initCommon.includes('captureR73GikWallSurfaceMask'), 'R7-3 comparison helper must capture visible-surface masks');
assert(initCommon.includes('summarizeR73GikWallLuma'), 'R7-3 comparison helper must summarize luma under each mask');
assert(initCommon.includes('surfaceLumaRatio: gikSummary && wallSummary'), 'R7-3 comparison helper must report GIK/wall ratio');
assert(initCommon.includes('r73QuickPreviewFillApplied: applied'), 'R7-3 reporter must expose the actual applied state');
assert(!initCommon.includes('function normalizeR73QuickPreviewFillCurveValue'), 'R7-3 v3j must remove input normalizer');
assert(!initCommon.includes('function updateR73QuickPreviewFillCurveFromControls()'), 'R7-3 v3j must remove editable SPP field handling');
assert(!initCommon.includes('function rebuildR73QuickPreviewFillAccumulationForCurrentSamples()'), 'R7-3 v3j must remove low-SPP rebuild tied to field edits');
assert(!initCommon.includes('function updateR73QuickPreviewFillControls()'), 'R7-3 validation toggle sync function must be removed');
assert(!initCommon.includes('function initR73QuickPreviewFillControls()'), 'R7-3 validation toggle init function must be removed');
assert(!initCommon.includes("document.getElementById('chk-r73-quick-preview-fill')"), 'R7-3 validation toggle must not bind a checkbox');
assert(!initCommon.includes("document.getElementById('input-r73-quick-preview-fill-spp1')"), 'R7-3 UI must not bind removed SPP fields');
assert(initCommon.includes('strengthCurve: R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT.slice()'), 'R7-3 reporter must expose the fixed curve');
assert(initCommon.includes('baseStrength: R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[0]'), 'R7-3 reporter must expose the fixed 1SPP strength');
assert(!homeStudio.includes("'r73-quick-preview-fill-controls'"), 'Hide/pointer guard must not include the removed R7-3 validation toggle');
assert(initCommon.includes('wakeRender();'), 'R7-3 v3 must restart accumulation because terminal preview lives in the path shader');
assert(initCommon.includes('updateR73QuickPreviewFillUniforms();'), 'R7-3 uniforms must refresh during the render loop');

const firstFrameLoopStart = initCommon.indexOf('for (var firstFrameRecoveryPassSample = sampleCounter; firstFrameRecoveryPassSample <= firstFrameRecoveryPassTarget; firstFrameRecoveryPassSample += 1.0)');
assert(firstFrameLoopStart >= 0, 'R7-3 test must find the first-frame recovery loop');
const firstFrameLoopPathRender = initCommon.indexOf('renderer.render(pathTracingScene, worldCamera);', firstFrameLoopStart);
assert(firstFrameLoopPathRender >= 0, 'R7-3 test must find the path shader render inside first-frame recovery');
const firstFrameLoopBeforePathRender = initCommon.slice(firstFrameLoopStart, firstFrameLoopPathRender);
assert(firstFrameLoopBeforePathRender.includes('updateR73QuickPreviewFillUniforms();'), 'R7-3 must update the SPP curve before each first-frame recovery path render');
assertOrder(firstFrameLoopBeforePathRender, 'pathTracingUniforms.uSampleCounter.value = sampleCounter;', 'updateR73QuickPreviewFillUniforms();', 'R7-3 must compute terminal strength after the current sampleCounter is written');

assert(initCommon.includes('uR73QuickPreviewFillMode: { type: "f", value: 0.0 }'), 'ScreenOutput uniforms must include R7-3 mode');
assert(initCommon.includes('uR73QuickPreviewFillStrength: { type: "f", value: r73QuickPreviewFillEffectiveStrength }'), 'ScreenOutput uniforms must include R7-3 effective strength');
assert(homeStudio.includes('uR73QuickPreviewTerminalMode = { value: 0.0 }'), 'Path shader uniforms must include R7-3 terminal mode');
assert(homeStudio.includes('uR73QuickPreviewTerminalStrength = { value: 0.0 }'), 'Path shader uniforms must include R7-3 terminal strength');
assert(homeStudio.includes('uR73GikWallProbeMode = { value: 0 }'), 'Path shader uniforms must include R7-3 GIK/wall probe mode');
assert(initCommon.includes('pathTracingUniforms.uR73QuickPreviewTerminalMode.value = applied ? 1.0 : 0.0'), 'R7-3 helper must update terminal mode');
assert(initCommon.includes('pathTracingUniforms.uR73QuickPreviewTerminalStrength.value = effectiveStrength'), 'R7-3 helper must update terminal strength with SPP curve');

assert(screenOutput.includes('uniform float uR73QuickPreviewFillMode;'), 'ScreenOutput shader must expose R7-3 mode');
assert(screenOutput.includes('uniform float uR73QuickPreviewFillStrength;'), 'ScreenOutput shader must expose R7-3 strength');
assert(screenOutput.includes('r73QuickPreviewWideSum'), 'R7-3 shader must build a local low-cost fill estimate');
assert(screenOutput.includes('r73QuickPreviewHighLimit'), 'R7-3 v2 shader must clamp bright speckles, not only lift dark holes');
assert(screenOutput.includes('r73QuickPreviewLowLift'), 'R7-3 v2 shader must still lift dark dropouts');
assert(screenOutput.includes('r73QuickPreviewDenoisedHdr = mix(r73QuickPreviewClampedHdr, r73QuickPreviewFillHdr, 0.62);'), 'R7-3 v2 shader must blend toward the local estimate visibly at low SPP');
assert(screenOutput.includes('filteredPixelColor = mix(filteredPixelColor, r73QuickPreviewDenoisedHdr, r73QuickPreviewFillMask * r73QuickPreviewStrength);'), 'R7-3 v2 shader must apply the full low-SPP preview denoise candidate');
assert(!screenOutput.includes('smoothstep(r73QuickPreviewFillLuma * 0.72, r73QuickPreviewFillLuma * 0.35'), 'R7-3 shader must not use reversed smoothstep edges');
assert(screenOutput.includes('nextToAnEdgePixel == FALSE'), 'R7-3 shader must avoid obvious geometry edges');
assert(screenOutput.includes('1.0 - smoothstep(4.0, 24.0, uSampleCounter)'), 'R7-3 shader must fade out after low SPP');
assert(!screenOutput.includes('vec3 r73QuickPreviewCandidateHdr = max(filteredPixelColor, r73QuickPreviewFillHdr * 0.72);'), 'R7-3 v2 must not preserve bright speckles with max-only fill');

assert(pathShader.includes('uniform float uR73QuickPreviewTerminalMode;'), 'Path shader must expose R7-3 terminal mode');
assert(pathShader.includes('uniform float uR73QuickPreviewTerminalStrength;'), 'Path shader must expose R7-3 terminal strength');
assert(pathShader.includes('uniform int uR73GikWallProbeMode;'), 'Path shader must expose R7-3 GIK/wall probe mode');
assert(pathShader.includes('if (uR73GikWallProbeMode > 0)'), 'Path shader must have a probe-only first-visible surface path');
assert(pathShader.includes('uR73GikWallProbeMode == 1 && cloudVisibleSurfaceIsGik'), 'R7-3 GIK/wall probe must classify GIK first-visible pixels');
assert(pathShader.includes('uR73GikWallProbeMode == 2 && cloudVisibleSurfaceIsWall'), 'R7-3 GIK/wall probe must classify wall first-visible pixels');
assert(!pathShader.includes('r73QuickPreviewC4FirstVisibleSpp4Gate'), 'R7-3 v3al must remove sample-specific first-visible C4 gates to avoid visible steps');
assert(pathShader.includes('r73QuickPreviewTerminalColor'), 'R7-3 v3 must add light at the max-bounce terminal, not only in ScreenOutput');
assert(pathShader.includes('if (uR73QuickPreviewTerminalMode > 0.5 && uR73QuickPreviewTerminalStrength > 0.0)'), 'R7-3 terminal preview must be gated by the console helper');
assert(pathShader.includes('accumCol += mask * r73QuickPreviewTerminalColor * uR73QuickPreviewTerminalStrength'), 'R7-3 terminal preview must add through throughput mask');
assert(!pathShader.includes('r73QuickPreviewC4LightSetup'), 'R7-3 v3al must remove C4-specific terminal tuning after rollback');
assert(!pathShader.includes('r73QuickPreviewC4WallActive'), 'R7-3 v3al must remove C4 wall-specific terminal tuning after rollback');
assert(!pathShader.includes('r73QuickPreviewC4WallScale'), 'R7-3 v3al must remove C4 wall scale after rollback');
assert(!pathShader.includes('r73QuickPreviewC4WallFastFade'), 'R7-3 v3al must remove C4 wall sample curve after rollback');
assert(!pathShader.includes('r73QuickPreviewC4WallBrightGate'), 'R7-3 v3al must remove luma-driven C4 wall suppression after rollback');
assert(!pathShader.includes('r73QuickPreviewC4Spp4Gate'), 'R7-3 v3al must remove sample-specific terminal C4 gates after rollback');
assert(!pathShader.includes('r73QuickPreviewC4GikDarkLiftActive'), 'R7-3 v3al must remove C4 GIK-specific tuning after rollback');
assert(!pathShader.includes('r73QuickPreviewC4GikDarkGate'), 'R7-3 v3al must remove C4 GIK dark gate after rollback');
assert(!pathShader.includes('r73QuickPreviewC4GikHighlightCap'), 'R7-3 v3al must remove C4 GIK highlight cap after rollback');
assert(!pathShader.includes('r73QuickPreviewC4GikLiftStrength'), 'R7-3 v3al must remove C4 GIK lift strength after rollback');
assert(!pathShader.includes('r73QuickPreviewC4GikLowGate'), 'R7-3 v3al must remove C4 GIK low-luma floor after rollback');
assert(!pathShader.includes('r73QuickPreviewC4FinalSpp4Gate'), 'R7-3 v3al must remove the final 4SPP correction after rollback');
assert(!pathShader.includes('r73QuickPreviewC4FinalFrontGate'), 'R7-3 v3al must remove the final front gate after rollback');
assert(!pathShader.includes('r73QuickPreviewC4FinalFrontGikLowGate'), 'R7-3 v3al must remove final front GIK boost after rollback');
assert(!pathShader.includes('* r73QuickPreviewTerminalStrength *'), 'R7-3 terminal preview must not reference an undeclared bare strength identifier');

console.log('PASS  R7-3 quick preview fill contract');
