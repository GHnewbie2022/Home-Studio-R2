// R3-5b computeCloudRadiance + CLOUD_FACE_COUNT contract-test
// 執行：node docs/tests/r3-5b-cloud-area-nee.test.js
// 模式：contract-test（函式本體複製自 js/Home_Studio.js R3-5b 區段）
// 警告：改動 computeCloudRadiance / CLOUD_FACE_COUNT / CLOUD_ROD_CENTER / CLOUD_ROD_HALF_EXTENT
//       時須同步更新此檔副本。

// ========== 函式本體副本（與 js/Home_Studio.js 對齊）==========
function kelvinToLuminousEfficacy(kelvin) {
    if (kelvin <= 2700) return 280;
    if (kelvin <= 3000) return 300;
    if (kelvin <= 4000) return 320;
    if (kelvin <= 5000) return 330;
    if (kelvin <= 6500) return 340;
    return 350;
}
function computeCloudRadiance(lm_total, kelvin, faceArea) {
    if (!Number.isFinite(lm_total) || lm_total <= 0) return 0;
    const K = kelvinToLuminousEfficacy(kelvin);
    const A = Math.max(faceArea, 1e-8);
    return (lm_total / 2) / (K * Math.PI * A);
}
// ========== 函式本體副本結束 ==========

// 常量副本（與 js/Home_Studio.js R3-5b 區段對齊）
const CLOUD_FACE_COUNT    = 2;
const NEE_POOL_SIZE       = 11;
const CLOUD_ROD_LUMENS    = [480 * 2.4, 480 * 2.4, 480 * 1.768, 480 * 1.768];
const CLOUD_ROD_FACE_AREA = [0.016 * 2.4, 0.016 * 2.4, 0.016 * 1.768, 0.016 * 1.768];
// Rod centers (world-space metres)
const ROD_CENTERS = [
    { x:  0.892, y: 2.795, z:  0.498 },  // E
    { x: -0.892, y: 2.795, z:  0.498 },  // W
    { x:  0.000, y: 2.795, z:  1.690 },  // S
    { x:  0.000, y: 2.795, z: -0.694 },  // N
];
const ROD_HALF_EXTENTS = [
    { x: 0.008, y: 0.008, z: 1.200 },  // E
    { x: 0.008, y: 0.008, z: 1.200 },  // W
    { x: 0.884, y: 0.008, z: 0.008 },  // S
    { x: 0.884, y: 0.008, z: 0.008 },  // N
];

let failed = 0;
function pass(label, extra) { console.log(`  PASS  ${label}${extra ? '  ' + extra : ''}`); }
function fail(label, extra) { console.log(`  FAIL  ${label}${extra ? '  ' + extra : ''}`); failed++; }
function assertRelErr(actual, expected, tol, label) {
    const rel = Math.abs(actual - expected) / Math.abs(expected);
    if (rel <= tol) pass(label, `rel=${rel.toExponential(2)} actual=${actual}`);
    else fail(label, `actual=${actual} expected=${expected} rel=${rel} tol=${tol}`);
}
function assertAbs(actual, expected, tol, label) {
    if (Math.abs(actual - expected) <= tol) pass(label, `actual=${actual}`);
    else fail(label, `actual=${actual} expected=${expected} ±${tol}`);
}
function assertEq(actual, expected, label) {
    if (actual === expected) pass(label, `actual=${actual}`);
    else fail(label, `actual=${actual} expected=${expected}`);
}
function assertTrue(cond, label, extra) {
    if (cond) pass(label, extra);
    else fail(label, extra);
}

console.log('=== R3-5b Cloud 2-face area NEE contract-test ===\n');

// [A] computeCloudRadiance(1152, 4000, 0.0384) ground truth
// 手算：(1152/2) / (320 · π · 0.0384) = 576 / (320 · 3.14159 · 0.0384)
//      = 576 / 38.5793 ≈ 14.93 W/(sr·m²)
console.log('[A] computeCloudRadiance(1152, 4000, 0.0384) ≈ 14.93:');
const r_A = computeCloudRadiance(1152, 4000, 0.0384);
assertRelErr(r_A, 14.93, 0.01, 'radiance 對 E/W rod 算式對齊 /2 分母');

// [B] lm=0 守門
console.log('\n[B] computeCloudRadiance(0, 4000, 0.0384) === 0:');
const r_B = computeCloudRadiance(0, 4000, 0.0384);
assertEq(r_B, 0, 'lm=0 → 0');

// [C] faceArea=0 守門（max(A, 1e-8)）
console.log('\n[C] computeCloudRadiance(1152, 4000, 0) finite:');
const r_C = computeCloudRadiance(1152, 4000, 0);
assertTrue(Number.isFinite(r_C), 'radiance finite when A=0', `actual=${r_C}`);

// [D] CLOUD_FACE_COUNT = 2 契約（三源同值：NEE face pick / hit-branch / JS Φ 分母）
console.log('\n[D] CLOUD_FACE_COUNT === 2:');
assertEq(CLOUD_FACE_COUNT, 2, '2-face 甲案 三源契約');

// [E] 色溫：K(2700)=280 vs K(6500)=340 → radiance ratio 340/280 ≈ 1.214（Φ 固定）
console.log('\n[E] radiance(2700) / radiance(6500) = 340/280:');
const r_warm = computeCloudRadiance(1152, 2700, 0.0384);
const r_cold = computeCloudRadiance(1152, 6500, 0.0384);
assertRelErr(r_warm / r_cold, 340 / 280, 0.01, 'K(warm)=280, K(cold)=340 → r_warm/r_cold=340/280');

// [F] Rod geometry: E/W half-extent = (0.008, 0.008, 1.200)；S/N = (0.884, 0.008, 0.008)
console.log('\n[F] rod half-extent 幾何契約:');
assertEq(ROD_HALF_EXTENTS[0].x, 0.008, 'E rod halfX');
assertEq(ROD_HALF_EXTENTS[0].y, 0.008, 'E rod halfY');
assertEq(ROD_HALF_EXTENTS[0].z, 1.200, 'E rod halfZ');
assertEq(ROD_HALF_EXTENTS[2].x, 0.884, 'S rod halfX');
assertEq(ROD_HALF_EXTENTS[2].y, 0.008, 'S rod halfY');
assertEq(ROD_HALF_EXTENTS[2].z, 0.008, 'S rod halfZ');

// [G] Rod center 對稱：E/W 鏡像（x 軸），S/N 大致對稱（z 軸，房間非嚴格對稱）
console.log('\n[G] rod center 對稱:');
assertEq(ROD_CENTERS[0].x, -ROD_CENTERS[1].x, 'E/W x 鏡像');
assertEq(ROD_CENTERS[2].x, ROD_CENTERS[3].x, 'S/N x 對齊');
assertTrue(Math.abs(ROD_CENTERS[2].z + ROD_CENTERS[3].z) < 1.0, 'S/N z 大致對稱（房間非嚴格鏡像）');

// [H] 短端能量損失 ≈ 0.66%（甲案 2-face 接受誤差，見 ADR 附錄 A）
// E rod (長 2.4m)：2-face emissive area = 2 × 0.016×2.4 = 0.0768 m²
// 短端 total area = 2 × 0.016×0.016 = 0.000512 m²
// 損失比 = 0.000512 / (0.0768 + 0.000512) ≈ 0.0066
console.log('\n[H] 短端能量損失 ≈ 0.66%:');
const A_long  = 2 * 0.016 * 2.4;     // 2 emissive faces (top + outer long)
const A_short = 2 * 0.016 * 0.016;   // 2 short-end faces
const lossRatio = A_short / (A_long + A_short);
assertRelErr(lossRatio, 0.0066, 0.05, '短端 / (2-face + 短端) ≈ 0.66%');

// [I] NEE pool size = 11（7 R3-5a lights + 4 Cloud rods）
console.log('\n[I] NEE pool size = 11:');
assertEq(NEE_POOL_SIZE, 11, 'pool = 7 (quad+spot+wide) + 4 cloud');

// [J] selectPdf 由 1/7 縮至 1/11，variance 輕微上升
console.log('\n[J] selectPdf 從 1/7 擴到 1/11（variance 略升）:');
const pdfNew = 1 / NEE_POOL_SIZE;
const pdfOld = 1 / 7;
assertRelErr(pdfNew, 1 / 11, 0.001, 'selectPdf_new = 1/11 ≈ 0.0909');
assertTrue(pdfNew < pdfOld, 'selectPdf 縮小（variance 略升）');

// [K] 所有 rod 同 K 下 radiance 同值（lm / faceArea 比例不變）
// E/W: lm=480×2.4=1152, A=0.016×2.4=0.0384 → lm/A=30000
// S/N: lm=480×1.768=848.64, A=0.016×1.768=0.028288 → lm/A=30000
console.log('\n[K] radiance E/W vs S/N 同值（lm/faceArea 比不變）:');
const r_EW = computeCloudRadiance(CLOUD_ROD_LUMENS[0], 4000, CLOUD_ROD_FACE_AREA[0]);
const r_SN = computeCloudRadiance(CLOUD_ROD_LUMENS[2], 4000, CLOUD_ROD_FACE_AREA[2]);
assertRelErr(r_EW, r_SN, 0.001, '所有 rod 同 K 下 radiance 同值');

// [L] radiometric 量綱範圍確認：Cloud rod radiance 應落 O(10~100) W/(sr·m²)
console.log('\n[L] Cloud radiance 量綱範圍 O(10~100):');
assertTrue(r_EW > 5 && r_EW < 200, 'Cloud radiance 在合理量綱範圍', `actual=${r_EW}`);

console.log(`\n=== 結果：${failed === 0 ? 'PASS' : `FAIL (${failed})`} ===`);
process.exit(failed === 0 ? 0 : 1);
