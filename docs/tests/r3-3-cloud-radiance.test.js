// R6-3 Phase 1C computeCloudRadiance + kelvinToLuminousEfficacy contract-test
// 執行：node docs/tests/r3-3-cloud-radiance.test.js
// 模式：contract-test（函式本體複製自 js/Home_Studio.js）
// 警告：改動 kelvinToLuminousEfficacy / computeCloudRadiance 時須同步更新此檔副本。

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
    const arcArea = Math.max(faceArea * CLOUD_ARC_AREA_SCALE, 1e-8);
    return lm_total / (K * Math.PI * arcArea);
}
// ========== 函式本體副本結束 ==========

const CLOUD_BOX_IDX_BASE = 71;  // R3-3 fix01：sceneBoxes 陣列 index（非註解邏輯 ID 55）
const CLOUD_ARC_AREA_SCALE = Math.PI * 0.5;
const CLOUD_ARC_RADIUS = 0.016;
const ROD_LENGTH    = [2.368, 2.368, 1.768, 1.768];
const ROD_LUMENS    = ROD_LENGTH.map(length => 480 * length);
const ROD_FACE_AREA = ROD_LENGTH.map(length => CLOUD_ARC_RADIUS * length);

let failed = 0;
function pass(label, extra) { console.log(`  PASS  ${label}${extra ? '  ' + extra : ''}`); }
function fail(label, extra) { console.log(`  FAIL  ${label}${extra ? '  ' + extra : ''}`); failed++; }
function assertRange(actual, lo, hi, label) {
    if (actual >= lo && actual <= hi) pass(label, `actual=${actual}`);
    else fail(label, `actual=${actual} expected ∈ [${lo}, ${hi}]`);
}
function assertRelErr(actual, expected, tol, label) {
    const rel = Math.abs(actual - expected) / Math.abs(expected);
    if (rel <= tol) pass(label, `rel=${rel.toExponential(2)}`);
    else fail(label, `actual=${actual} expected=${expected} rel=${rel} tol=${tol}`);
}

console.log('=== R6-3 Phase 1C Cloud arc radiance contract-test ===\n');

// [A] kelvinToLuminousEfficacy LUT 鎖定（4000K → 320 lm/W）
console.log('[A] kelvinToLuminousEfficacy LUT 鎖定:');
assertRange(kelvinToLuminousEfficacy(4000), 318, 322, 'K(4000K) ∈ [318, 322]');
assertRange(kelvinToLuminousEfficacy(3000), 298, 302, 'K(3000K) ∈ [298, 302]');
assertRange(kelvinToLuminousEfficacy(6500), 338, 342, 'K(6500K) ∈ [338, 342]');

// [B] computeCloudRadiance 對 hand-computed ground truth（E rod, 1136.64 lm, 4000K, A_face=0.037888 m²）
// 手算：A_arc=(π/2)×0.037888；1136.64 / (320 × π × A_arc) ≈ 18.9977 W/(sr·m²)
console.log('\n[B] computeCloudRadiance vs. hand-computed ground truth:');
assertRelErr(computeCloudRadiance(ROD_LUMENS[0], 4000, ROD_FACE_AREA[0]), 18.9977, 0.001, 'E rod 480 lm/m @ 4000K ≈ 18.9977');
assertRelErr(computeCloudRadiance(ROD_LUMENS[2], 4000, ROD_FACE_AREA[2]), 18.9977, 0.002, 'S rod 480 lm/m @ 4000K ≈ 18.9977（同 Φ/A 比 → 同 radiance）');

// [C] K(T) 反比例獨立驗證：固定 Φ/A 下 radiance(3000K)/radiance(4000K) = K(4000)/K(3000) = 320/300
console.log('\n[C] radiance ∝ 1/K(T) 獨立驗證:');
const r3000 = computeCloudRadiance(ROD_LUMENS[0], 3000, ROD_FACE_AREA[0]);
const r4000 = computeCloudRadiance(ROD_LUMENS[0], 4000, ROD_FACE_AREA[0]);
assertRelErr(r3000 / r4000, 320 / 300, 0.001, 'ratio r(3000K)/r(4000K) = K(4000)/K(3000)');

// [D] 5600K 單調性（階梯 LUT：K(4000)=320, K(5600)=K(6500)=340 → radiance(4000K) > radiance(5600K) = radiance(6500K)）
console.log('\n[D] 5600K 單調:');
const r5600 = computeCloudRadiance(ROD_LUMENS[0], 5600, ROD_FACE_AREA[0]);
const r6500 = computeCloudRadiance(ROD_LUMENS[0], 6500, ROD_FACE_AREA[0]);
if (r5600 <= r4000 && r5600 >= r6500) pass('r(5600K) 介於 r(4000K) 與 r(6500K)', `r4000=${r4000.toFixed(4)} r5600=${r5600.toFixed(4)} r6500=${r6500.toFixed(4)}`);
else fail('5600K 單調性破', `r4000=${r4000} r5600=${r5600} r6500=${r6500}`);

// [E] objectIdBase 計算契約：uCloudObjIdBase = CLOUD_BOX_IDX_BASE + 1
console.log('\n[E] objectIdBase 計算契約:');
// shader 端 hitObjectID = objectCount(0) + boxIdx + 1；boxIdx=71 → 72
const objIdBase = CLOUD_BOX_IDX_BASE + 1;
if (objIdBase === 72) pass('CLOUD_BOX_IDX_BASE + 1 === 72');
else fail('uCloudObjIdBase 常量錯', `got=${objIdBase}`);

console.log(`\n=== 結果：${failed === 0 ? 'PASS' : `FAIL (${failed})`} ===`);
process.exit(failed === 0 ? 0 : 1);
