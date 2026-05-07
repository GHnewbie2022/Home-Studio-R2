/**
 * R6-3 Phase2 Cloud sampling budget diagnostic contract.
 * Run: node docs/tests/r6-3-cloud-sampling-budget-diagnostic.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const jsPath = path.resolve(__dirname, '../../js/Home_Studio.js');
const htmlPath = path.resolve(__dirname, '../../Home_Studio.html');

const js = fs.readFileSync(jsPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

assert(js.includes('CLOUD_SAMPLING_BUDGET_DIAGNOSTIC_VERSION'), 'JS missing Cloud sampling budget diagnostic version label');
assert(js.includes('window.reportCloudSamplingBudgetDiagnostic = function'), 'JS missing Cloud sampling budget diagnostic report helper');
assert(js.includes("analysisScope: 'cloudSamplingBudgetDiagnostic'"), 'Cloud sampling budget diagnostic must label its scope');
assert(js.includes("renderPathMutation: false"), 'Cloud sampling budget diagnostic must not mutate normal render path');
assert(js.includes("shaderMutation: false"), 'Cloud sampling budget diagnostic must not mutate shader behavior');
assert(js.includes("questions: ['cloudPickRatio', 'otherLightCompetition', 'misDilution', 'directVsIndirect']"), 'Cloud sampling budget diagnostic must name the four investigation questions');
assert(js.includes('activeLightCount: activeCount'), 'Cloud sampling budget diagnostic must report active light count');
assert(js.includes('activeLightIndex: activeIndices'), 'Cloud sampling budget diagnostic must report the active light LUT');
assert(js.includes('cloudLightCount: counts.cloud'), 'Cloud sampling budget diagnostic must report active Cloud count');
assert(js.includes('cloudPickRatio: ratio(counts.cloud, activeCount)'), 'Cloud sampling budget diagnostic must report Cloud pick ratio');
assert(js.includes('perCloudRodPickRatio: ratio(1, activeCount)'), 'Cloud sampling budget diagnostic must report per-rod pick ratio');
assert(js.includes('otherLightPickRatio: ratio(counts.ceiling + counts.track + counts.wide, activeCount)'), 'Cloud sampling budget diagnostic must report other-light competition');
assert(js.includes('selectPdf: activeCount > 0 ? 1 / activeCount : 0'), 'Cloud sampling budget diagnostic must report selectPdf');
assert(js.includes("otherLightsCompeteWithCloud: (counts.ceiling + counts.track + counts.wide) > 0"), 'Cloud sampling budget diagnostic must flag other light competition');
assert(js.includes("cloudDirectNeeMis: 'wNee = powerHeuristic(pNee, pBsdf)'"), 'Cloud sampling budget diagnostic must document direct Cloud NEE MIS');
assert(js.includes("cloudBsdfReverseMis: 'wBsdf = powerHeuristic(pBsdf, pNeeReverse)'"), 'Cloud sampling budget diagnostic must document reverse Cloud MIS');
assert(js.includes("directIsolationControl: 'uIndirectMultiplier = 0'"), 'Cloud sampling budget diagnostic must document direct isolation control');
assert(js.includes("baselineIndirectControl: 'uIndirectMultiplier = 1'"), 'Cloud sampling budget diagnostic must document baseline indirect control');
assert(js.includes("recommendedNextStep: 'directVsIndirectScreenshotProbe'"), 'Cloud sampling budget diagnostic must recommend direct-vs-indirect screenshot probe');
assert(js.includes('CLOUD_SAMPLING_BUDGET_DIAGNOSTIC_VERSION,'), 'Cloud sampling budget diagnostic must include version in returned report');
assert(js.includes('r7-1-blue-noise-sampling-v1'), 'JS shader cache token must identify latest R7-1 experiment version');
assert(html.includes('Home_Studio.js?v=r7-1-blue-noise-sampling-v1'), 'HTML must cache-bust JS for latest R7-1 experiment version');

console.log('PASS  R6-3 Cloud sampling budget diagnostic contract');
