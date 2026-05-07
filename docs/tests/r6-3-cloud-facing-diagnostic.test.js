/**
 * R6-3 Phase2 Cloud facing diagnostic contract test.
 * Run: node docs/tests/r6-3-cloud-facing-diagnostic.test.js
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

function sliceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);
    assert(start >= 0, 'missing start marker: ' + startMarker);
    assert(end > start, 'missing end marker: ' + endMarker);
    return source.slice(start, end);
}

assert(shader.includes('out vec3 facingDiagnostic'), 'Cloud NEE sampler must expose source/normal/probe facing diagnostics');
assert(shader.includes('lastNeeFacingDiagnostic'), 'radiance loop must keep the last Cloud facing diagnostic vector');
assert(shader.includes('cloudVisibilityProbeFacingDiagnosticColor'), 'shader must expose mode 4 facing diagnostic color helper');
assert(shader.includes('uCloudVisibilityProbeMode >= 4'), 'shader must route mode 4 to facing diagnostic output');

const cloudNee = sliceBetween(
    shader,
    '// R6-3 Phase 1C: neeIdx 7-10',
    '// 世界空間垂直圓柱交叉'
);
assert(cloudNee.includes('vec3 normalEmissionNormal = cloudArcNormal(rodIdx, theta);'), 'diagnostic must compute normal-render Cloud normal');
assert(cloudNee.includes('vec3 probeEmissionNormal = cloudArcEmissionNormal(rodIdx, theta);'), 'diagnostic must compute probe Cloud normal');
assert(cloudNee.includes('facingDiagnostic = vec3('), 'Cloud NEE must fill RGB facing diagnostic channels');

assert(js.includes('CLOUD_FACING_DIAGNOSTIC_LABELS'), 'JS report must expose facing diagnostic labels');
assert(js.includes('CLOUD_FACING_DIAGNOSTIC_DEFINITIONS'), 'JS report must expose facing diagnostic field definitions');
assert(js.includes("'sourceFacingZero'"), 'JS report missing source-facing diagnostic label');
assert(js.includes("'normalCloudFacingZero'"), 'JS report missing normal Cloud-facing diagnostic label');
assert(js.includes("'probeCloudFacingZero'"), 'JS report missing probe Cloud-facing diagnostic label');
assert(js.includes("legacyZeroCloudFacingAlias: 'probeCloudFacingZero'"), 'JS report must mark zeroCloudFacing as a legacy probe-facing alias');
assert(js.includes("renderEnergyNormal: 'cloudArcNormal'"), 'JS report must name the normal-render Cloud energy normal');
assert(js.includes("probeClassificationNormal: 'cloudArcEmissionNormal'"), 'JS report must name the probe-classification Cloud normal');
assert(js.includes('window.reportCloudFacingDiagnosticAfterSamples = async function'), 'JS missing auto-wait facing diagnostic helper');
assert(js.includes('window.reportCloudFacingDiagnosticThetaScanAfterSamples = async function'), 'JS missing auto-wait facing diagnostic theta scan helper');
assert(js.includes('window.reportCloudFacingDiagnosticRodThetaScanAfterSamples = async function'), 'JS missing rod-by-rod facing theta scan helper');
assert(js.includes('CLOUD_THETA_IMPORTANCE_CANDIDATE_VERSION'), 'JS missing theta-importance candidate version label');
assert(js.includes('CLOUD_THETA_IMPORTANCE_AB_VERSION'), 'JS missing theta-importance probe-only A/B version label');
assert(js.includes('CLOUD_THETA_IMPORTANCE_STRENGTH_SWEEP_VERSION'), 'JS missing theta-importance strength sweep version label');
assert(js.includes('CLOUD_THETA_IMPORTANCE_SHADER_AB_VERSION'), 'JS missing theta-importance shader A/B version label');
assert(js.includes('function summarizeCloudFacingThetaScan'), 'JS missing facing theta scan summary helper');
assert(js.includes('function summarizeCloudFacingThetaGeometry'), 'JS missing facing theta geometry summary helper');
assert(js.includes('function summarizeCloudFacingRodThetaScans'), 'JS missing rod-by-rod facing theta scan summary helper');
assert(js.includes('function summarizeCloudThetaImportanceSamplingCandidate'), 'JS missing theta-importance candidate summary helper');
assert(js.includes('function summarizeCloudThetaImportanceProbeAB'), 'JS missing theta-importance probe-only A/B helper');
assert(js.includes('function summarizeCloudThetaImportanceStrengthSweep'), 'JS missing theta-importance strength sweep helper');
assert(js.includes('window.setCloudThetaImportanceShaderAB = function'), 'JS missing theta-importance shader A/B setter');
assert(js.includes('window.reportCloudThetaImportanceShaderAB = function'), 'JS missing theta-importance shader A/B report helper');
assert(js.includes('window.summarizeCloudThetaImportanceSamplingCandidate = summarizeCloudThetaImportanceSamplingCandidate'), 'JS must expose the theta-importance candidate helper for probe-only browser analysis');
assert(js.includes('window.summarizeCloudThetaImportanceProbeAB = summarizeCloudThetaImportanceProbeAB'), 'JS must expose the theta-importance probe-only A/B helper for browser analysis');
assert(js.includes('window.summarizeCloudThetaImportanceStrengthSweep = summarizeCloudThetaImportanceStrengthSweep'), 'JS must expose the theta-importance strength sweep helper for browser analysis');
assert(js.includes('summary: summarizeCloudFacingThetaScan(bins)'), 'facing theta scan result must include an automatic summary');
assert(js.includes("label + 'Ratio'"), 'JS facing diagnostic summary missing dynamic ratio fields');
assert(js.includes('normalMinusProbeFacingZeroRatio'), 'JS facing diagnostic summary missing normal-vs-probe difference');
assert(js.includes('Math.min(4, Math.trunc(n))'), 'JS probe mode clamp must allow mode 4 diagnostics');

const facingThetaScanHelper = sliceBetween(
    js,
    'window.reportCloudFacingDiagnosticThetaScanAfterSamples = async function',
    'window.reportCloudVisibilityProbe ='
);
assert(facingThetaScanHelper.includes('window.setCloudVisibilityProbe(4'), 'facing theta scan must use mode 4 diagnostics');
assert(facingThetaScanHelper.includes('normalCloudFacingZeroRatio'), 'facing theta scan bins must include normal-facing ratio');
assert(facingThetaScanHelper.includes('probeCloudFacingZeroRatio'), 'facing theta scan bins must include probe-facing ratio');
assert(facingThetaScanHelper.includes('normalMinusProbeFacingZeroRatio'), 'facing theta scan bins must include normal-vs-probe ratio difference');
assert(facingThetaScanHelper.includes('waitTimedOut'), 'facing theta scan bins must report wait timeout status');
assert(facingThetaScanHelper.includes('summary: summarizeCloudFacingThetaScan(bins)'), 'facing theta scan must return a compact summary');
assert(!facingThetaScanHelper.includes('console.table('), 'auto-wait facing theta scan must return data without printing per-bin tables');

const thetaScanSummaryHelper = sliceBetween(
    js,
    'function summarizeCloudFacingThetaScan',
    'window.reportCloudFacingDiagnosticThetaScanAfterSamples = async function'
);
assert(thetaScanSummaryHelper.includes('minDiffBin'), 'facing theta scan summary must name the minimum difference bin');
assert(thetaScanSummaryHelper.includes('maxDiffBin'), 'facing theta scan summary must name the maximum difference bin');
assert(thetaScanSummaryHelper.includes('normalCloudFacingZeroRatioRange'), 'facing theta scan summary must include normal-facing ratio range');
assert(thetaScanSummaryHelper.includes('probeCloudFacingZeroRatioRange'), 'facing theta scan summary must include probe-facing ratio range');
assert(thetaScanSummaryHelper.includes('normalMinusProbeFacingZeroRatioRange'), 'facing theta scan summary must include difference ratio range');
assert(thetaScanSummaryHelper.includes('diffTrend'), 'facing theta scan summary must classify the difference trend');
assert(thetaScanSummaryHelper.includes('const geometryHint = summarizeCloudFacingThetaGeometry'), 'facing theta scan summary must compute geometry hint');
assert(thetaScanSummaryHelper.includes('geometryHint,'), 'facing theta scan summary must return geometry hint');
assert(thetaScanSummaryHelper.includes('maxDiffNearHighUpwardEnd'), 'facing theta scan summary must compare max diff to high-upward theta bins');

const thetaGeometryHelper = sliceBetween(
    js,
    'function summarizeCloudFacingThetaGeometry',
    'function summarizeCloudFacingThetaScan'
);
assert(thetaGeometryHelper.includes('cloudArcNormalFormula'), 'geometry helper must name the Cloud arc normal formula');
assert(thetaGeometryHelper.includes('cloudArcEmissionNormalRelation'), 'geometry helper must name the probe normal relation');
assert(thetaGeometryHelper.includes('normalUpwardTrend'), 'geometry helper must classify normal upward trend');
assert(thetaGeometryHelper.includes('maxNormalUpwardBin'), 'geometry helper must expose the highest-upward theta bin');
assert(thetaGeometryHelper.includes('highUpwardBinStart'), 'geometry helper must define the high-upward bin zone');

const rodThetaScanHelper = sliceBetween(
    js,
    'window.reportCloudFacingDiagnosticRodThetaScanAfterSamples = async function',
    'window.reportCloudVisibilityProbe ='
);
assert(rodThetaScanHelper.includes('window.reportCloudFacingDiagnosticThetaScanAfterSamples(rod'), 'rod theta scan must reuse the per-rod theta scan helper');
assert(rodThetaScanHelper.includes('summary: summarizeCloudFacingRodThetaScans(rods)'), 'rod theta scan must return a compact cross-rod summary');
assert(rodThetaScanHelper.includes('CLOUD_VISIBILITY_PROBE_ROD_LABELS.length'), 'rod theta scan must cover all Cloud rods');

const rodThetaScanSummaryHelper = sliceBetween(
    js,
    'function summarizeCloudFacingRodThetaScans',
    'window.reportCloudFacingDiagnosticRodThetaScanAfterSamples = async function'
);
assert(rodThetaScanSummaryHelper.includes('maxDiffByRod'), 'rod theta scan summary must list max difference by rod');
assert(rodThetaScanSummaryHelper.includes('uniqueMaxDiffBins'), 'rod theta scan summary must list unique max-difference bins');
assert(rodThetaScanSummaryHelper.includes('sharedMaxDiffBin'), 'rod theta scan summary must identify a shared max-difference bin');
assert(rodThetaScanSummaryHelper.includes('maxDiffBinPattern'), 'rod theta scan summary must classify same vs mixed max-difference bins');
assert(rodThetaScanSummaryHelper.includes('allRodsMaxDiffNearHighUpwardEnd'), 'rod theta scan summary must compare rods to high-upward theta bins');
assert(rodThetaScanSummaryHelper.includes('dominantRod'), 'rod theta scan summary must name the rod with the largest max difference');

const thetaImportanceCandidateHelper = sliceBetween(
    js,
    'function summarizeCloudThetaImportanceSamplingCandidate',
    'window.reportCloudFacingDiagnosticRodThetaScanAfterSamples = async function'
);
assert(thetaImportanceCandidateHelper.includes('analysisScope: \'probeOnlyThetaImportanceCandidate\''), 'theta-importance candidate must label itself as probe-only analysis');
assert(thetaImportanceCandidateHelper.includes('renderPathMutation: false'), 'theta-importance candidate must not mutate the normal render path');
assert(thetaImportanceCandidateHelper.includes('shaderMutation: false'), 'theta-importance candidate must not mutate shader behavior');
assert(thetaImportanceCandidateHelper.includes('requiresThetaPdfCompensation: true'), 'theta-importance candidate must keep the PDF compensation contract explicit');
assert(thetaImportanceCandidateHelper.includes('renderEnergyNormal: CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.renderEnergyNormal'), 'theta-importance candidate must use the render-energy normal definition');
assert(thetaImportanceCandidateHelper.includes('probeClassificationNormal: CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.probeClassificationNormal'), 'theta-importance candidate must use the probe-classification normal definition');
assert(thetaImportanceCandidateHelper.includes('metric: \'normalMinusProbeFacingZeroRatio\''), 'theta-importance candidate must state the metric used for bin weighting');
assert(thetaImportanceCandidateHelper.includes('protectedFloor: 0.65'), 'theta-importance candidate must cap how far high-diff bins are reduced');
assert(thetaImportanceCandidateHelper.includes('uniformThetaBinPdf'), 'theta-importance candidate must report the uniform baseline PDF');
assert(thetaImportanceCandidateHelper.includes('candidateThetaBinPdf'), 'theta-importance candidate must report the candidate theta-bin PDF');
assert(thetaImportanceCandidateHelper.includes('pdfCompensationMultiplier'), 'theta-importance candidate must report the PDF compensation multiplier');
assert(thetaImportanceCandidateHelper.includes('maxPdfCompensationMultiplier'), 'theta-importance candidate must summarize PDF compensation risk');
assert(thetaImportanceCandidateHelper.includes('sharedMaxDiffBin'), 'theta-importance candidate must carry forward the shared max-difference bin');
assert(thetaImportanceCandidateHelper.includes('recommendedNextStep: \'probeOnlyAB\''), 'theta-importance candidate must recommend probe-only A/B before shader rollout');

const thetaImportanceABHelper = sliceBetween(
    js,
    'function summarizeCloudThetaImportanceProbeAB',
    'window.reportCloudFacingDiagnosticRodThetaScanAfterSamples = async function'
);
assert(thetaImportanceABHelper.includes('analysisScope: \'probeOnlyThetaImportanceAB\''), 'theta-importance A/B must label itself as probe-only analysis');
assert(thetaImportanceABHelper.includes('renderPathMutation: false'), 'theta-importance A/B must not mutate the normal render path');
assert(thetaImportanceABHelper.includes('shaderMutation: false'), 'theta-importance A/B must not mutate shader behavior');
assert(thetaImportanceABHelper.includes('baselineStrategy: \'uniformTheta\''), 'theta-importance A/B must name the uniform theta baseline');
assert(thetaImportanceABHelper.includes('candidateStrategy: \'thetaImportanceCandidate\''), 'theta-importance A/B must name the candidate strategy');
assert(thetaImportanceABHelper.includes('estimateBasis: \'rodThetaScanBinAverages\''), 'theta-importance A/B must state the estimate basis');
assert(thetaImportanceABHelper.includes('estimatedUniformWasteProxy'), 'theta-importance A/B must compute the uniform waste proxy');
assert(thetaImportanceABHelper.includes('estimatedCandidateWasteProxy'), 'theta-importance A/B must compute the candidate waste proxy');
assert(thetaImportanceABHelper.includes('estimatedWasteProxyReductionRatio'), 'theta-importance A/B must report the estimated reduction ratio');
assert(thetaImportanceABHelper.includes('candidateToUniformSampleRatio'), 'theta-importance A/B must report per-bin candidate-to-uniform sample ratio');
assert(thetaImportanceABHelper.includes('pdfCompensationMultiplier'), 'theta-importance A/B must keep per-bin PDF compensation visible');
assert(thetaImportanceABHelper.includes('recommendedNextStep: \'shaderAB\''), 'theta-importance A/B must recommend shader A/B as the next gated step');

const thetaImportanceStrengthSweepHelper = sliceBetween(
    js,
    'function summarizeCloudThetaImportanceStrengthSweep',
    'window.reportCloudFacingDiagnosticRodThetaScanAfterSamples = async function'
);
assert(thetaImportanceStrengthSweepHelper.includes('analysisScope: \'probeOnlyThetaImportanceStrengthSweep\''), 'theta-importance strength sweep must label itself as probe-only analysis');
assert(thetaImportanceStrengthSweepHelper.includes('renderPathMutation: false'), 'theta-importance strength sweep must not mutate the normal render path');
assert(thetaImportanceStrengthSweepHelper.includes('shaderMutation: false'), 'theta-importance strength sweep must not mutate shader behavior');
assert(thetaImportanceStrengthSweepHelper.includes('protectedFloors: [0.5, 0.65, 0.8]'), 'theta-importance strength sweep must compare the agreed protectedFloor set');
assert(thetaImportanceStrengthSweepHelper.includes('summarizeCloudThetaImportanceProbeAB(rodThetaScan, { protectedFloor })'), 'theta-importance strength sweep must reuse probe-only A/B for each protectedFloor');
assert(thetaImportanceStrengthSweepHelper.includes('bestByReduction'), 'theta-importance strength sweep must report the best reduction candidate');
assert(thetaImportanceStrengthSweepHelper.includes('safestByPdf'), 'theta-importance strength sweep must report the lowest PDF-compensation candidate');
assert(thetaImportanceStrengthSweepHelper.includes('recommendedProtectedFloor'), 'theta-importance strength sweep must report the selected protectedFloor for the next gate');
assert(thetaImportanceStrengthSweepHelper.includes('recommendedNextStep: \'reviewStrengthSweepBeforeShaderAB\''), 'theta-importance strength sweep must keep shader A/B behind a review gate');

assert(shader.includes('uniform int uCloudThetaImportanceShaderABMode;'), 'shader missing theta-importance shader A/B mode uniform');
assert(shader.includes('const float CLOUD_THETA_IMPORTANCE_SHADER_AB_PROTECTED_FLOOR = 0.5;'), 'shader must state protectedFloor 0.50 for B group');
assert(shader.includes('float cloudThetaImportancePdfCompensationForBin(int thetaBin)'), 'shader missing per-bin PDF compensation helper');
assert(shader.includes('float cloudThetaImportanceSampleTheta(float u, out int thetaBin, out float pdfCompensationMultiplier)'), 'shader missing B-group theta sampler');
assert(shader.includes('float cloudThetaImportanceEffectiveArcArea(float cloudArcArea, float pdfCompensationMultiplier)'), 'shader missing effective area helper');
assert(shader.includes('float cloudThetaImportanceEffectiveArcAreaForNormal(int rodIdx, float cloudArcArea, vec3 normal)'), 'shader missing reverse-PDF effective area helper');
assert(cloudNee.includes('float thetaPdfCompensationMultiplier = 1.0;'), 'Cloud NEE must default A group to no PDF compensation');
assert(cloudNee.includes('float thetaRandom = rng();'), 'Cloud NEE must draw theta from one stored random value');
assert(cloudNee.includes('cloudThetaImportanceSampleTheta(thetaRandom, sampledThetaBin, thetaPdfCompensationMultiplier)'), 'Cloud NEE must use B-group sampler only through shader A/B mode');
assert(cloudNee.includes('float cloudPdfArea = cloudThetaImportanceEffectiveArcArea(cloudArcArea, thetaPdfCompensationMultiplier);'), 'Cloud NEE must apply theta PDF compensation to effective area');
assert(cloudNee.includes('throughput = cloudEmit * cloudGeom * cloudPdfArea / selectPdf;'), 'Cloud NEE throughput must use compensated effective area');
assert(cloudNee.includes('pdfNeeForLight(x, cloudTarget, emissionNormal, cloudPdfArea, selectPdf)'), 'Cloud NEE PDF must use compensated effective area');

assert(js.includes('uCloudThetaImportanceShaderABMode = { value: 0 }'), 'JS shader A/B mode must default to uniform A group');
assert(js.includes('resetCloudVisibilityProbeAccumulation()'), 'shader A/B mode changes must clear accumulated buffers');
assert(js.includes('shaderABMode: pathTracingUniforms.uCloudThetaImportanceShaderABMode.value'), 'JS shader A/B report must expose current mode');

assert(js.includes('r6-3-phase2-sampling-budget-diagnostic'), 'JS probe version must report sampling-budget diagnostic version');
assert(js.includes('r7-1-blue-noise-sampling-v1'), 'JS shader cache token must identify latest R7-1 experiment version');
assert(html.includes('Home_Studio.js?v=r7-1-blue-noise-sampling-v1'), 'HTML must cache-bust JS for latest R7-1 experiment version');

console.log('PASS  R6-3 Cloud facing diagnostic contract');
