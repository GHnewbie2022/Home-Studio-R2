// R3-2 kelvinToRGB contract-test
// 執行：node docs/tests/r3-2-kelvin.test.js
// 模式：contract-test（函式本體複製自 js/Home_Studio.js R3-2 Step 1）
// 警告：改動 js/Home_Studio.js 中 kelvinToRGB 時須同步更新此檔副本。

// ========== 以下為 kelvinToRGB 函式本體副本 ==========
const KELVIN_ANCHORS = [2000, 3000, 4000, 6500, 10000];
const KELVIN_RGB_TABLE = [
    { r: 1.00, g: 0.54, b: 0.17 },
    { r: 1.00, g: 0.75, b: 0.42 },
    { r: 1.00, g: 0.89, b: 0.76 },
    { r: 1.00, g: 0.99, b: 1.00 },
    { r: 0.79, g: 0.87, b: 1.00 },
];

function _pchipTangents(xs, ys) {
    const n = xs.length;
    const dk = new Array(n - 1);
    for (let k = 0; k < n - 1; k++) {
        dk[k] = (ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]);
    }
    const m = new Array(n);
    m[0] = dk[0];
    m[n - 1] = dk[n - 2];
    for (let k = 1; k < n - 1; k++) {
        if (dk[k - 1] * dk[k] <= 0) m[k] = 0;
        else m[k] = (dk[k - 1] + dk[k]) / 2;
    }
    return m;
}

const _TAN_R = _pchipTangents(KELVIN_ANCHORS, KELVIN_RGB_TABLE.map(c => c.r));
const _TAN_G = _pchipTangents(KELVIN_ANCHORS, KELVIN_RGB_TABLE.map(c => c.g));
const _TAN_B = _pchipTangents(KELVIN_ANCHORS, KELVIN_RGB_TABLE.map(c => c.b));

function _pchipEval(K, channel, tangents) {
    if (K <= KELVIN_ANCHORS[0]) return KELVIN_RGB_TABLE[0][channel];
    if (K >= KELVIN_ANCHORS[KELVIN_ANCHORS.length - 1]) {
        return KELVIN_RGB_TABLE[KELVIN_ANCHORS.length - 1][channel];
    }
    let k = 0;
    while (k < KELVIN_ANCHORS.length - 1 && K > KELVIN_ANCHORS[k + 1]) k++;
    const x0 = KELVIN_ANCHORS[k], x1 = KELVIN_ANCHORS[k + 1];
    const y0 = KELVIN_RGB_TABLE[k][channel], y1 = KELVIN_RGB_TABLE[k + 1][channel];
    const m0 = tangents[k], m1 = tangents[k + 1];
    const h = x1 - x0;
    const t = (K - x0) / h;
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1;
}

function kelvinToRGB(K) {
    return {
        r: _pchipEval(K, 'r', _TAN_R),
        g: _pchipEval(K, 'g', _TAN_G),
        b: _pchipEval(K, 'b', _TAN_B),
    };
}
// ========== 函式本體副本結束 ==========

let failed = 0;
function assertNear(actual, expected, tol, label) {
    const diff = Math.abs(actual - expected);
    if (diff <= tol) {
        console.log(`  PASS  ${label}  (diff=${diff.toExponential(2)})`);
    } else {
        console.log(`  FAIL  ${label}  actual=${actual} expected=${expected} diff=${diff} tol=${tol}`);
        failed++;
    }
}
function assertRGB(K, exp, tol, label) {
    const rgb = kelvinToRGB(K);
    assertNear(rgb.r, exp.r, tol, `${label} .r`);
    assertNear(rgb.g, exp.g, tol, `${label} .g`);
    assertNear(rgb.b, exp.b, tol, `${label} .b`);
}

console.log('=== R3-2 kelvinToRGB contract-test ===\n');

// [A] 錨點精確命中（tol=1e-12）
console.log('[A] 錨點精確命中 (tol=1e-12):');
assertRGB(2000,  { r: 1.00, g: 0.54, b: 0.17 }, 1e-12, 'K=2000');
assertRGB(3000,  { r: 1.00, g: 0.75, b: 0.42 }, 1e-12, 'K=3000');
assertRGB(4000,  { r: 1.00, g: 0.89, b: 0.76 }, 1e-12, 'K=4000');
assertRGB(6500,  { r: 1.00, g: 0.99, b: 1.00 }, 1e-12, 'K=6500');
assertRGB(10000, { r: 0.79, g: 0.87, b: 1.00 }, 1e-12, 'K=10000');

// [B] 內部樣本點（tol=0.01，CR2 對內實作目標）
console.log('\n[B] 內部樣本點 (tol=0.01):');
const rgb5000 = kelvinToRGB(5000);
if (rgb5000.g > 0.89 && rgb5000.g < 0.99) {
    console.log(`  PASS  K=5000 .g in (0.89, 0.99)  actual=${rgb5000.g.toFixed(4)}`);
} else { console.log(`  FAIL  K=5000 .g=${rgb5000.g}`); failed++; }
if (rgb5000.b > 0.76 && rgb5000.b < 1.00) {
    console.log(`  PASS  K=5000 .b in (0.76, 1.00)  actual=${rgb5000.b.toFixed(4)}`);
} else { console.log(`  FAIL  K=5000 .b=${rgb5000.b}`); failed++; }
const rgb2700 = kelvinToRGB(2700);
if (rgb2700.g > 0.54 && rgb2700.g < 0.75) {
    console.log(`  PASS  K=2700 .g in (0.54, 0.75)  actual=${rgb2700.g.toFixed(4)}`);
} else { console.log(`  FAIL  K=2700 .g=${rgb2700.g}`); failed++; }

// [C] 夾取行為
console.log('\n[C] 夾取行為:');
assertRGB(1500, { r: 1.00, g: 0.54, b: 0.17 }, 1e-12, 'K=1500 clamp→2000');
assertRGB(15000, { r: 0.79, g: 0.87, b: 1.00 }, 1e-12, 'K=15000 clamp→10000');

// [D] 邊界連續性（AR1 3 條斷言，tol=1e-3）
console.log('\n[D] 邊界連續性 (tol=1e-3):');
function maxDiff(rgbA, rgbB) {
    return Math.max(
        Math.abs(rgbA.r - rgbB.r),
        Math.abs(rgbA.g - rgbB.g),
        Math.abs(rgbA.b - rgbB.b),
    );
}
const d3000 = maxDiff(kelvinToRGB(2999), kelvinToRGB(3001));
const d4000 = maxDiff(kelvinToRGB(3999), kelvinToRGB(4001));
const d6500 = maxDiff(kelvinToRGB(6499), kelvinToRGB(6501));
if (d3000 <= 1e-3) console.log(`  PASS  |RGB(2999)-RGB(3001)|=${d3000.toExponential(2)} ≤ 1e-3`);
else { console.log(`  FAIL  錨點 3000K 斷裂 diff=${d3000}`); failed++; }
if (d4000 <= 1e-3) console.log(`  PASS  |RGB(3999)-RGB(4001)|=${d4000.toExponential(2)} ≤ 1e-3`);
else { console.log(`  FAIL  錨點 4000K 斷裂 diff=${d4000}`); failed++; }
if (d6500 <= 1e-3) console.log(`  PASS  |RGB(6499)-RGB(6501)|=${d6500.toExponential(2)} ≤ 1e-3`);
else { console.log(`  FAIL  錨點 6500K 斷裂 diff=${d6500}`); failed++; }

// [E] 回傳型別（A2 {r,g,b} 物件契約）
console.log('\n[E] 回傳型別契約:');
const rgbType = kelvinToRGB(4000);
const hasRGB = typeof rgbType.r === 'number'
            && typeof rgbType.g === 'number'
            && typeof rgbType.b === 'number';
if (hasRGB) console.log('  PASS  回傳 { r, g, b } 皆為 number');
else { console.log('  FAIL  回傳型別不符 A2 契約'); failed++; }

console.log(`\n=== 結果：${failed === 0 ? 'PASS' : `FAIL (${failed})`} ===`);
process.exit(failed === 0 ? 0 : 1);
