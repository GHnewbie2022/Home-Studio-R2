/**
 * R6-3 Phase2 Cloud Visibility Probe - Contract Test
 * Run: node docs/tests/r6-3-cloud-visibility-probe.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const shaderPath = path.resolve(__dirname, '../../shaders/Home_Studio_Fragment.glsl');
const jsPath = path.resolve(__dirname, '../../js/Home_Studio.js');
const htmlPath = path.resolve(__dirname, '../../Home_Studio.html');

const shader = fs.readFileSync(shaderPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

assert(shader.includes('uniform int uCloudVisibilityProbeMode;'), 'shader missing uCloudVisibilityProbeMode uniform');
assert(shader.includes('uniform int uCloudVisibilityProbeRod;'), 'shader missing uCloudVisibilityProbeRod uniform');
assert(shader.includes('uniform int uCloudVisibilityProbeClass;'), 'shader missing selected blocker class uniform');
assert(shader.includes('uniform int uCloudVisibilityProbeThetaBin;'), 'shader missing v5a theta-bin probe uniform');
assert(shader.includes('uniform int uCloudVisibilityProbeThetaBinCount;'), 'shader missing v5a theta-bin-count probe uniform');
assert(shader.includes('cloudVisibilityProbeMatches'), 'shader missing probe rod-match helper');
assert(shader.includes('cloudVisibilityProbeThetaBin'), 'shader missing v5a theta-bin helper');
assert(shader.includes('cloudVisibilityProbeThetaBinMatches'), 'shader missing v5a theta-bin filter helper');
assert(shader.includes('cloudVisibilityProbeHasContribution'), 'shader missing zero-contribution probe helper');
assert(shader.includes('cloudVisibilityProbeVisibleColor'), 'shader missing visible event color');
assert(shader.includes('cloudVisibilityProbeBlockedColor'), 'shader missing blocked event color');
assert(shader.includes('cloudVisibilityProbeBlockerClass'), 'shader missing blocker classification helper');
assert(shader.includes('cloudVisibilityProbeIsZeroContributionClass'), 'shader missing zero-contribution subgroup matcher');
assert(shader.includes('lastNeeZeroContributionClass'), 'shader must track why Cloud NEE contribution became zero');
assert(shader.includes('out int zeroContributionClass'), 'Cloud NEE sampler must expose zero-contribution cause');
assert(shader.includes('lastNeeSourceObjectID'), 'shader must track source object ID for self-blocker diagnosis');
assert(shader.includes('lastNeeSourceHitType'), 'shader must track source hit type for self-blocker diagnosis');
assert(shader.includes('cloudVisibilityProbeClassColor'), 'shader missing blocker classification color helper');
assert(shader.includes('uCloudVisibilityProbeMode > 0'), 'shader must guard probe behind disabled-by-default mode');

assert(js.includes('uCloudVisibilityProbeMode = { value: 0 }'), 'JS probe mode must default off');
assert(js.includes('uCloudVisibilityProbeRod = { value: -1 }'), 'JS probe rod must default to all rods');
assert(js.includes('uCloudVisibilityProbeThetaBin = { value: -1 }'), 'JS theta-bin probe filter must default off');
assert(js.includes('uCloudVisibilityProbeThetaBinCount = { value: CLOUD_VISIBILITY_PROBE_THETA_BIN_COUNT_DEFAULT }'), 'JS theta-bin count must default to the v5a bin count');
const modeNormalizer = js.match(/function normalizeCloudVisibilityProbeMode\(mode\) \{([\s\S]*?)\n\}/);
assert(modeNormalizer && modeNormalizer[1].includes('Math.min(4, Math.trunc(n))'), 'JS probe mode clamp must allow selected-class mode 3 and facing-diagnostic mode 4');
assert(js.includes('function normalizeCloudVisibilityProbeThetaBin'), 'JS missing theta-bin normalizer');
assert(js.includes('function normalizeCloudVisibilityProbeThetaBinCount'), 'JS missing theta-bin-count normalizer');
assert(js.includes('window.setCloudVisibilityProbe'), 'JS missing window.setCloudVisibilityProbe helper');
assert(js.includes('window.setCloudVisibilityProbeClass'), 'JS missing selected blocker class helper');
assert(js.includes('window.setCloudVisibilityProbeThetaBin'), 'JS missing v5a theta-bin setter helper');
assert(js.includes('window.reportCloudVisibilityProbeThetaScan'), 'JS missing v5a theta-bin scan helper');
assert(js.includes('window.reportCloudVisibilityProbeAfterSamples = async function'), 'JS missing auto-wait probe report helper');
assert(js.includes('window.reportCloudVisibilityProbeThetaScanAfterSamples = async function'), 'JS missing auto-wait theta scan helper');
assert(js.includes('window.reportCloudFacingDiagnosticAfterSamples = async function'), 'JS missing auto-wait facing diagnostic helper');
assert(js.includes('waitForCloudVisibilityProbeSamples'), 'JS missing sample wait helper');
assert(js.includes('sampleCounter >= targetSamples'), 'auto-wait helper must wait for sampleCounter to reach the target');
assert(js.includes('renderCloudVisibilityProbeReadbackSampleIfNeeded(3)'), 'auto-wait helper must prime one raw probe sample before waiting');
const waitHelper = js.match(/function waitForCloudVisibilityProbeSamples\(targetSamples, timeoutMs, pollMs\) \{([\s\S]*?)\n\}/);
assert(waitHelper && !waitHelper[1].includes('wakeRender()'), 'auto-wait helper must not reset accumulation while waiting');
assert(js.includes('window.reportCloudVisibilityProbe'), 'JS missing window.reportCloudVisibilityProbe helper');
assert(js.includes('cloudVisibilityProbeSummary'), 'JS missing probe summary histogram');
assert(js.includes('function cloudVisibilityProbeSummary(options)'), 'probe summary must accept logging options');
assert(js.includes('const logTable = !(options && options.logTable === false);'), 'probe summary must support silent readback for scan helpers');
assert(js.includes('if (logTable) console.table(summary);'), 'manual probe report must keep a single opt-in table print');
function sliceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert(start >= 0, 'missing start marker: ' + startMarker);
    assert(end > start, 'missing end marker: ' + endMarker);
    return source.slice(start, end);
}
const instantThetaScanHelper = sliceBetween(
    js,
    'window.reportCloudVisibilityProbeThetaScan = function',
    'function waitForCloudVisibilityProbeSamples'
);
assert(instantThetaScanHelper.includes('cloudVisibilityProbeSummary({ logTable: false })'), 'theta scan must not print one summary table per bin');
const autoProbeHelper = sliceBetween(
    js,
    'window.reportCloudVisibilityProbeAfterSamples = async function',
    'window.reportCloudVisibilityProbeThetaScanAfterSamples = async function'
);
assert(autoProbeHelper.includes('cloudVisibilityProbeSummary({ logTable: false })'), 'auto-wait single probe helper must read summary silently');
assert(!autoProbeHelper.includes('console.table('), 'auto-wait single probe helper must return data and leave final table formatting to the caller');
const autoThetaScanHelper = sliceBetween(
    js,
    'window.reportCloudVisibilityProbeThetaScanAfterSamples = async function',
    'window.reportCloudVisibilityProbe ='
);
assert(autoThetaScanHelper.includes('cloudVisibilityProbeSummary({ logTable: false })'), 'auto-wait theta scan helper must read each bin silently');
assert(!autoThetaScanHelper.includes('console.table('), 'auto-wait theta scan helper must return bins and leave final table formatting to the caller');
assert(js.includes('CLOUD_VISIBILITY_PROBE_CLASS_LABELS'), 'JS missing blocker classification labels');
assert(js.includes('visibleMass'), 'JS report must preserve visibility mass summary');
assert(js.includes("'zeroContribution'"), 'JS report missing zero-contribution label');
assert(js.includes("'zeroSourceMask'"), 'JS report missing source-mask zero-contribution label');
assert(js.includes("'zeroSourceFacing'"), 'JS report missing source-facing zero-contribution label');
assert(js.includes("'zeroCloudFacing'"), 'JS report missing Cloud-facing zero-contribution label');
assert(js.includes("'zeroFacingBoth'"), 'JS report missing double-facing zero-contribution label');
assert(js.includes("'zeroOther'"), 'JS report missing other zero-contribution label');
assert(js.includes("'correctCloudRod'"), 'JS report missing correct Cloud rod label');
assert(js.includes("'wrongCloudRod'"), 'JS report missing wrong Cloud rod blocker label');
assert(js.includes("'cloudAluminium'"), 'JS report missing Cloud aluminium blocker label');
assert(js.includes("'cloudGikPanel'"), 'JS report missing Cloud GIK blocker label');
assert(js.includes("'sameAcousticPanel'"), 'JS report missing same acoustic panel self-blocker label');
assert(js.includes("'northAcousticPanel'"), 'JS report missing north acoustic panel blocker label');
assert(js.includes("'eastAcousticPanel'"), 'JS report missing east acoustic panel blocker label');
assert(js.includes("'westAcousticPanel'"), 'JS report missing west acoustic panel blocker label');
assert(js.includes("'miss'"), 'JS report missing miss blocker label');
assert(js.includes("label + 'Pixels'"), 'JS report missing dynamic blocker pixel fields');
assert(js.includes("label + 'Mass'"), 'JS report missing dynamic blocker mass fields');
assert(js.includes("label + 'Ratio'"), 'JS report missing dynamic blocker ratio fields');
assert(js.includes('selectedClassRatio'), 'JS report missing selected class mask ratio');
assert(js.includes('thetaBinRatio'), 'JS report missing v5a theta-bin ratio field');
assert(js.includes('thetaStartDeg'), 'JS report missing v5a theta-bin start angle');
assert(js.includes('thetaEndDeg'), 'JS report missing v5a theta-bin end angle');
assert(js.includes('probeVersion'), 'JS report missing probe version for browser cache verification');
assert(js.includes('readbackMode'), 'JS report missing readback mode for raw-vs-screen diagnosis');
assert(js.includes("rawFloatReadback ? 'rawPathTracingTarget' : 'screenCanvas'"), 'JS report must label whether summary came from raw target or postprocessed screen');
assert(js.includes('renderCloudVisibilityProbeReadbackSampleIfNeeded'), 'mode 3 report must render one sample before reading a freshly cleared raw target');
assert(js.includes('renderCloudVisibilityProbeReadbackSampleIfNeeded(mode)'), 'probe summary must call the readback sample guard before raw readback');
assert(js.includes('if (mode < 3)'), 'JS report must suppress palette-class fields in selected-class and facing-diagnostic modes');
assert(js.includes('if (mode >= 3 && mode < 4)'), 'JS report must keep selected-class fields out of facing-diagnostic mode');
assert(js.includes('readRenderTargetPixels(pathTracingRenderTarget'), 'selected-class mode must read raw path tracing target before post processing');
const setProbeHelper = js.match(/window\.setCloudVisibilityProbe = function[\s\S]*?\n\};/);
assert(setProbeHelper && setProbeHelper[0].includes('resetCloudVisibilityProbeAccumulation()'), 'probe mode/class changes must hard-clear accumulated buffers');
assert(js.includes('resetCloudVisibilityProbeAccumulation'), 'probe mode/class changes must immediately clear render targets before next readback');
assert(shader.includes('vec3 emissionNormal = cloudArcRenderNormal(rodIdx, theta);'), 'emission-normal classification must go through the probe-gated render-normal helper');
assert(shader.includes('vec3 reverseEmissionNormal = (uCloudVisibilityProbeMode > 0) ? -hitNormal : hitNormal;'), 'reverse Cloud PDF must preserve normal render when probe is off');
assert(shader.includes('vec3 cloudVisibilityProbeSelectedClassColor(int blockerClass, int thetaBin)'), 'selected-class probe output must accept a theta-bin filter');
assert(shader.includes('cloudVisibilityProbeSelectedClassColor(blockerClass, lastNeeProbeThetaBin)'), 'selected-class probe output must pass the sampled theta bin');
assert(js.includes('r6-3-movement-preview-v22d'), 'shader cache-bust token must identify latest R6-3 closeout version');
assert(js.includes('r6-3-phase2-sampling-budget-diagnostic'), 'JS probe version must report sampling-budget diagnostic version');
assert(html.includes('Home_Studio.js?v=r6-3-movement-preview-v22d'), 'HTML must cache-bust Home_Studio.js for latest R6-3 closeout version');

console.log('PASS  R6-3 Cloud visibility probe contract');
