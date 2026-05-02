/**
 * R3-6.5 Dynamic Light Pool — Contract Tests
 * Run: node docs/tests/r3-6-5-dynamic-pool.test.js
 *
 * buildActiveLightLUT is a pure-logic copy of rebuildActiveLightLUT (js/Home_Studio.js L1300-1339)
 * with DOM/uniform side-effects removed. Logic is kept byte-for-byte identical.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Pure-logic clone of rebuildActiveLightLUT
// ---------------------------------------------------------------------------
const ACTIVE_LIGHT_LUT_SIZE = 11;
const ACTIVE_LIGHT_LUT_SENTINEL = -1;

function buildActiveLightLUT(config, cloudOn, trackOn, wideOn) {
    const lut = new Array(ACTIVE_LIGHT_LUT_SIZE).fill(ACTIVE_LIGHT_LUT_SENTINEL);
    let count = 0;

    if (config === 1 || config === 2) {
        lut[count++] = 0;
    } else if (config === 3) {
        if (trackOn) { lut[count++] = 1; lut[count++] = 2; lut[count++] = 3; lut[count++] = 4; }
        if (wideOn)  { lut[count++] = 5; lut[count++] = 6; }
        if (cloudOn) { lut[count++] = 7; lut[count++] = 8; lut[count++] = 9; lut[count++] = 10; }
    }

    return { count, lut };
}

// ---------------------------------------------------------------------------
// U1: config=1, cloudOn=false, trackOn=false, wideOn=false → count=1, LUT[0]=0
// ---------------------------------------------------------------------------
{
    const { count, lut } = buildActiveLightLUT(1, false, false, false);
    assert.strictEqual(count, 1, 'U1 count');
    assert.strictEqual(lut[0], 0, 'U1 LUT[0]');
    console.log('U1 PASS  config=1 all-off → count=' + count + ' LUT[0]=' + lut[0]);
}

// ---------------------------------------------------------------------------
// U2: config=3, all on → count=10, LUT[0..9]=[1..10]
// ---------------------------------------------------------------------------
{
    const { count, lut } = buildActiveLightLUT(3, true, true, true);
    assert.strictEqual(count, 10, 'U2 count');
    for (let i = 0; i < 10; i++) {
        assert.strictEqual(lut[i], i + 1, 'U2 LUT[' + i + ']');
    }
    console.log('U2 PASS  config=3 all-on → count=' + count + ' LUT[0..9]=' + JSON.stringify(lut.slice(0, 10)));
}

// ---------------------------------------------------------------------------
// U3: config=3, cloudOn=false, trackOn=true, wideOn=true → count=6 (4 track + 2 wide)
// ---------------------------------------------------------------------------
{
    const { count, lut } = buildActiveLightLUT(3, false, true, true);
    assert.strictEqual(count, 6, 'U3 count');
    // track slots 1-4
    assert.strictEqual(lut[0], 1, 'U3 LUT[0]');
    assert.strictEqual(lut[1], 2, 'U3 LUT[1]');
    assert.strictEqual(lut[2], 3, 'U3 LUT[2]');
    assert.strictEqual(lut[3], 4, 'U3 LUT[3]');
    // wide slots 5-6
    assert.strictEqual(lut[4], 5, 'U3 LUT[4]');
    assert.strictEqual(lut[5], 6, 'U3 LUT[5]');
    console.log('U3 PASS  config=3 cloud-off → count=' + count + ' LUT[0..5]=' + JSON.stringify(lut.slice(0, 6)));
}

// ---------------------------------------------------------------------------
// U4: config=3, all off → count=0
// ---------------------------------------------------------------------------
{
    const { count } = buildActiveLightLUT(3, false, false, false);
    assert.strictEqual(count, 0, 'U4 count');
    console.log('U4 PASS  config=3 all-off → count=' + count);
}

// ---------------------------------------------------------------------------
// U5: shader Cloud contract checks for Phase 1C arc emitter
// ---------------------------------------------------------------------------
{
    const shaderPath = path.resolve(
        __dirname, '../../shaders/Home_Studio_Fragment.glsl'
    );
    const src = fs.readFileSync(shaderPath, 'utf8');
    assert(src.includes('CLOUD_ARC_AREA_SCALE'), 'U5 CLOUD_ARC_AREA_SCALE missing');
    assert(src.includes('CloudArcIntersect'), 'U5 CloudArcIntersect missing');
    assert(src.includes('cloudArcArea'), 'U5 cloudArcArea missing');
    assert(!src.includes('CLOUD_DIAGONAL_FACE_AREA_SCALE'), 'U5 old diagonal area scale still present');
    assert(!src.includes('uCloudFaceCount'), 'U5 old Cloud face-count uniform still present');
    console.log('U5 PASS  shader uses Phase 1C arc Cloud contract');
}

console.log('\nAll 5 contract tests PASSED.');
