/**
 * R6-3 Phase2 v5b Cloud visible-theta no-go guard.
 * Run: node docs/tests/r6-3-cloud-visible-theta-v5b.test.js
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

assert(!shader.includes('CLOUD_ARC_VISIBLE_THETA_STEPS'), 'v5b visible-theta bin count must not remain after no-go');
assert(!shader.includes('cloudArcThetaFacesPoint'), 'v5b visible-theta facing helper must not remain after no-go');
assert(!shader.includes('cloudArcVisibleThetaCount'), 'v5b visible-theta counter must not remain after no-go');
assert(!shader.includes('cloudArcVisibleThetaRatio'), 'v5b visible-theta ratio helper must not remain after no-go');
assert(!shader.includes('cloudArcVisibleArea'), 'v5b effective visible-area helper must not remain after no-go');
assert(!shader.includes('sampleCloudArcVisibleTheta'), 'v5b visible-theta sampler must not remain after no-go');

const cloudNee = sliceBetween(
    shader,
    '// R6-3 Phase 1C: neeIdx 7-10',
    '// 世界空間垂直圓柱交叉'
);
assert(cloudNee.includes('float thetaRandom = rng();'), 'Cloud NEE must keep one theta random value for uniform fallback');
assert(cloudNee.includes('uCloudThetaImportanceShaderABMode > 0'), 'Cloud NEE theta-importance sampling must be gated by the shader A/B flag');
assert(cloudNee.includes(': thetaRandom * CLOUD_ARC_THETA_MAX;'), 'Cloud NEE default A path must remain full-arc uniform theta after v5b no-go');
assert(cloudNee.includes('float cloudPdfArea = cloudThetaImportanceEffectiveArcArea(cloudArcArea, thetaPdfCompensationMultiplier);'), 'Cloud NEE must route area through the shader A/B effective-area helper');
assert(cloudNee.includes('throughput = cloudEmit * cloudGeom * cloudPdfArea / selectPdf;'), 'Cloud NEE throughput must use the shader A/B effective area');
assert(cloudNee.includes('pdfNeeOmega = pdfNeeForLight(x, cloudTarget, emissionNormal, cloudPdfArea, selectPdf);'), 'Cloud NEE PDF must use the shader A/B effective area');

const thetaAreaHelper = sliceBetween(
    shader,
    'float cloudThetaImportanceEffectiveArcArea(float cloudArcArea, float pdfCompensationMultiplier)',
    'float cloudThetaImportanceEffectiveArcAreaForNormal'
);
assert(thetaAreaHelper.includes('if (uCloudThetaImportanceShaderABMode <= 0)'), 'Cloud theta A/B area helper must guard the default path');
assert(thetaAreaHelper.includes('return cloudArcArea;'), 'Cloud theta A/B default area must stay full arc');

const cloudReverse = sliceBetween(
    shader,
    'else if (diffuseCount >= 1 && misPBsdfStashed > 0.0 && !(uCloudLightEnabled < 0.5))',
    'float wBsdf = misPowerWeight'
);
assert(!cloudReverse.includes('cloudArcVisibleThetaCount'), 'Cloud reverse NEE must not keep v5b visible-theta counting after no-go');
assert(!cloudReverse.includes('cloudReverseArcArea'), 'Cloud reverse NEE must not keep v5b effective visible area after no-go');
assert(cloudReverse.includes('float reverseCloudPdfArea = cloudThetaImportanceEffectiveArcAreaForNormal(rodIdx, cloudArcArea, hitNormal);'), 'Cloud reverse NEE must route area through the shader A/B effective-area helper');
assert(cloudReverse.includes('pdfNeeForLight(misBsdfBounceOrigin, x, reverseEmissionNormal, reverseCloudPdfArea'), 'Cloud reverse NEE PDF must use the shader A/B effective area');

const reverseThetaAreaHelper = sliceBetween(
    shader,
    'float cloudThetaImportanceEffectiveArcAreaForNormal(int rodIdx, float cloudArcArea, vec3 normal)',
    'bool cloudVisibilityProbeThetaBinMatches'
);
assert(reverseThetaAreaHelper.includes('if (uCloudThetaImportanceShaderABMode <= 0)'), 'Cloud reverse theta A/B area helper must guard the default path');
assert(reverseThetaAreaHelper.includes('return cloudArcArea;'), 'Cloud reverse theta A/B default area must stay full arc');

assert(!js.includes('visible-theta-v5b-normal-sampling'), 'JS must not report the no-go v5b normal-sampling version');
assert(!html.includes('v5b-normal-sampling'), 'HTML must not cache-bust to the no-go v5b normal-sampling build');

console.log('PASS  R6-3 Cloud visible-theta v5b no-go guard');
