/**
 * R7-2 Light Importance Sampling — Contract Test
 * Run: node docs/tests/r7-2-light-importance-sampling.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const js = fs.readFileSync(path.join(root, 'js/Home_Studio.js'), 'utf8');
const shader = fs.readFileSync(path.join(root, 'shaders/Home_Studio_Fragment.glsl'), 'utf8');
const html = fs.readFileSync(path.join(root, 'Home_Studio.html'), 'utf8');
const r7Sop = fs.readFileSync(path.join(root, 'docs/SOP/R7：採樣演算法升級.md'), 'utf8');

const ACTIVE_LIGHT_POOL_MAX = 11;
const ACTIVE_LIGHT_LUT_SENTINEL = -1;
const CLOUD_ROD_LENGTH = [2.368, 2.368, 1.768, 1.768];

function buildImportanceLut(config, cloudOn, trackOn, wideSouthOn, wideNorthOn, enabled) {
    const lut = new Array(ACTIVE_LIGHT_POOL_MAX).fill(ACTIVE_LIGHT_LUT_SENTINEL);
    const pdf = new Array(ACTIVE_LIGHT_POOL_MAX).fill(0);
    const cdf = new Array(ACTIVE_LIGHT_POOL_MAX).fill(0);
    let count = 0;

    if (config === 1 || config === 2) {
        lut[count++] = 0;
    } else if (config === 3 || config === 4) {
        if (trackOn) { lut[count++] = 1; lut[count++] = 2; lut[count++] = 3; lut[count++] = 4; }
        if (wideSouthOn) { lut[count++] = 5; }
        if (wideNorthOn) { lut[count++] = 6; }
        if (cloudOn) { lut[count++] = 7; lut[count++] = 8; lut[count++] = 9; lut[count++] = 10; }
    }

    if (count <= 0) return { count, lut, pdf, cdf };

    const weights = lut.slice(0, count).map((idx) => {
        if (!enabled) return 1;
        if (idx === 0) return 1;
        if (idx >= 1 && idx <= 4) return 2000;
        if (idx >= 5 && idx <= 6) return 2500;
        if (idx >= 7 && idx <= 10) return 1600 * CLOUD_ROD_LENGTH[idx - 7];
        return 1;
    });
    const sum = weights.reduce((acc, weight) => acc + weight, 0);
    let running = 0;
    for (let i = 0; i < count; i++) {
        pdf[i] = weights[i] / sum;
        running += pdf[i];
        cdf[i] = i === count - 1 ? 1 : running;
    }
    return { count, lut, pdf, cdf };
}

function approx(actual, expected, tolerance, label) {
    assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
}

{
    const { count, lut, pdf, cdf } = buildImportanceLut(3, true, false, false, false, true);
    assert.strictEqual(count, 4, 'C3 count');
    assert.deepStrictEqual(lut.slice(0, 4), [7, 8, 9, 10], 'C3 LUT');
    approx(pdf[0], 0.286266, 0.00001, 'C3 east rod pdf');
    approx(pdf[1], 0.286266, 0.00001, 'C3 west rod pdf');
    approx(pdf[2], 0.213734, 0.00001, 'C3 south rod pdf');
    approx(pdf[3], 0.213734, 0.00001, 'C3 north rod pdf');
    approx(cdf[3], 1, 0, 'C3 final cdf');
    console.log('U1 PASS  C3 Cloud rod PDF follows rod length / flux');
}

{
    const { count, lut, pdf, cdf } = buildImportanceLut(4, false, true, true, true, true);
    assert.strictEqual(count, 6, 'C4 count');
    assert.deepStrictEqual(lut.slice(0, 6), [1, 2, 3, 4, 5, 6], 'C4 LUT');
    approx(pdf[0], 2000 / 13000, 0.00001, 'C4 track pdf');
    approx(pdf[4], 2500 / 13000, 0.00001, 'C4 wide pdf');
    approx(cdf[5], 1, 0, 'C4 final cdf');
    console.log('U2 PASS  C4 Wide gets a larger pick PDF than Track');
}

{
    const { count, pdf, cdf } = buildImportanceLut(3, true, false, false, false, false);
    assert.strictEqual(count, 4, 'uniform C3 count');
    pdf.slice(0, 4).forEach((value, index) => approx(value, 0.25, 0, `uniform C3 pdf ${index}`));
    approx(cdf[3], 1, 0, 'uniform C3 final cdf');
    console.log('U3 PASS  disabled R7-2 mode keeps uniform active-light sampling');
}

assert(js.includes("R7_2_LIGHT_IMPORTANCE_VERSION = 'r7-2-light-importance-sampling-v1-r7-2d-step-history'"), 'JS missing R7-2 version label');
assert(js.includes('let r72LightImportanceSamplingEnabled = false'), 'R7-2 must default off for A/B safety');
assert(js.includes('window.setR72LightImportanceSamplingEnabled = function'), 'R7-2 missing console setter');
assert(js.includes('window.reportR72LightImportanceSamplingConfig = function'), 'R7-2 missing console reporter');
assert(js.includes('window.setR72QuickPreviewIsolation = function'), 'R7-2B missing quick-preview isolation setter');
assert(js.includes('window.reportR72QuickPreviewIsolationConfig = function'), 'R7-2B missing quick-preview isolation reporter');
assert(js.includes("r72QuickPreviewIsolationBorrowStrength: getSliderValue('slider-borrow-strength-b')"), 'R7-2B reporter must expose B-mode borrow strength');
assert(js.includes("setSliderValue('slider-borrow-strength-b', 0.0)"), 'R7-2B isolation must set quick-preview borrow strength to 0');
assert(js.includes("btnGroupB") && js.includes("btnConfig3"), 'R7-2B isolation must target quick preview and C3 controls');
assert(js.includes('uActiveLightPickPdf'), 'JS missing active light pick PDF uniform');
assert(js.includes('uActiveLightPickCdf'), 'JS missing active light pick CDF uniform');
assert(js.includes('lightImportanceWeightForIndex'), 'JS missing importance weight helper');
assert(js.includes('writeActiveLightSamplingPdfAndCdf'), 'JS missing PDF/CDF writer');

assert(shader.includes('uniform float uActiveLightPickPdf[11];'), 'Shader missing active light pick PDF uniform');
assert(shader.includes('uniform float uActiveLightPickCdf[11];'), 'Shader missing active light pick CDF uniform');
assert(shader.includes('uniform float uR72LightImportanceSamplingMode;'), 'Shader missing R7-2 mode uniform');
assert(shader.includes('sampleActiveLightSlot'), 'Shader missing weighted active-light slot sampler');
assert(shader.includes('activeLightPickPdfByIndex'), 'Shader missing reverse MIS PDF lookup');
assert(shader.includes('float selectPdf = uActiveLightPickPdf[slot];'), 'Shader direct NEE must use per-slot pick PDF');
assert(!shader.includes('float selectPdf = 1.0 / float(uActiveLightCount);'), 'Shader must not hard-code uniform selectPdf in the direct NEE picker');
assert(!shader.includes('pdfNeeForLight(misBsdfBounceOrigin, x, reverseEmissionNormal, reverseCloudPdfArea, 1.0 / float(uActiveLightCount))'), 'Cloud reverse MIS must use activeLightPickPdfByIndex');

assert(html.includes('Home_Studio.js?v=r7-3-quick-preview-fill-v3al'), 'HTML must cache-bust Home_Studio.js for current R7 experiment');
assert(js.includes('Home_Studio_Fragment.glsl?v=r7-3-quick-preview-fill-v3al'), 'JS must cache-bust shader for current R7 experiment');
assert(r7Sop.includes('R7-2 light importance sampling v1'), 'R7 SOP must record R7-2 v1');

console.log('PASS  R7-2 light importance sampling contract');
