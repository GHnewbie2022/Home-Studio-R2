// R3-4 computeTrackRadiance + lumenToCandela + smoothstep gate contract-test
// 執行：node docs/tests/r3-4-track-radiance.test.js
// 模式：contract-test（函式本體複製自 js/Home_Studio.js R3-1 / R3-4）
// 警告：改動 lumenToCandela / candelaToRadiance / kelvinToLuminousEfficacy / computeTrackRadiance 時須同步更新此檔副本。

// ========== 函式本體副本（與 js/Home_Studio.js 對齊）==========
function lumenToCandela(lm, fullBeamAngleDeg) {
    const halfDeg = Math.max(0.01, fullBeamAngleDeg / 2);
    const halfRad = halfDeg * Math.PI / 180;
    return lm / (2 * Math.PI * (1 - Math.cos(halfRad)));
}
function candelaToRadiance(cd, emitterAreaM2) {
    if (!Number.isFinite(cd)) return 0;
    const A = Math.max(emitterAreaM2, 1e-8);
    return cd / A;
}
function kelvinToLuminousEfficacy(kelvin) {
    if (kelvin <= 2700) return 280;
    if (kelvin <= 3000) return 300;
    if (kelvin <= 4000) return 320;
    if (kelvin <= 5000) return 330;
    if (kelvin <= 6500) return 340;
    return 350;
}
function computeTrackRadiance(lm, T_K, A_m2, beamFullDeg) {
    // R3-4 fix07：L = Φ / (K · π · A)（radiometric，與 Cloud 同量綱）
    if (!Number.isFinite(lm) || lm <= 0) return 0;
    const K = kelvinToLuminousEfficacy(T_K);
    const A = Math.max(A_m2, 1e-8);
    return lm / (K * Math.PI * A);
}
// GLSL smoothstep 之 JS 副本（edge0 < edge1）
function smoothstep(edge0, edge1, x) {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}
// ========== 函式本體副本結束 ==========

// 常量副本（與 js/Home_Studio.js R3-4 區段對齊）
const TRACK_LAMP_EMITTER_AREA  = Math.PI * 0.03 * 0.03;
const TRACK_LAMP_LUMENS_MAX    = 2000;
const TRACK_BEAM_INNER_HALF_DEG = 15;
const TRACK_BEAM_OUTER_HALF_DEG = 30;
const TRACK_BEAM_FULL_DEG       = TRACK_BEAM_OUTER_HALF_DEG * 2;
const TRACK_LAMP_ID_BASE        = 400;
const TRACK_BEAM_COS_INNER      = Math.cos(TRACK_BEAM_INNER_HALF_DEG * Math.PI / 180);
const TRACK_BEAM_COS_OUTER      = Math.cos(TRACK_BEAM_OUTER_HALF_DEG * Math.PI / 180);

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

console.log('=== R3-4 Track spot radiance contract-test ===\n');

// [A] lumenToCandela(2000, 60) ground truth
// 手算：2π(1 - cos(30°)) = 2π × (1 - √3/2) = 2π × 0.13397 ≈ 0.84170
// 2000 / 0.84170 ≈ 2376.06 cd
console.log('[A] lumenToCandela(2000, 60) vs. hand-computed ground truth:');
const cdA = lumenToCandela(2000, 60);
assertRelErr(cdA, 2376.06, 0.01, 'lumenToCandela(2000, 60) ≈ 2376.06');

// [B] computeTrackRadiance 數值非零且為正
console.log('\n[B] computeTrackRadiance(2000, 4000, 2.827e-3, 60) > 0:');
const r_B = computeTrackRadiance(2000, 4000, TRACK_LAMP_EMITTER_AREA, 60);
assertTrue(Number.isFinite(r_B) && r_B > 0, 'radiance finite and > 0', `actual=${r_B}`);

// [C] lm=0 守門
console.log('\n[C] computeTrackRadiance(0, 4000, A, 60) === 0:');
const r_C = computeTrackRadiance(0, 4000, TRACK_LAMP_EMITTER_AREA, 60);
assertEq(r_C, 0, 'lm=0 → radiance=0');

// [D] emitterArea=0 不爆 NaN/Inf（candelaToRadiance 內部 max(A, 1e-8) 守門）
console.log('\n[D] computeTrackRadiance(2000, 4000, 0, 60) finite:');
const r_D = computeTrackRadiance(2000, 4000, 0, 60);
assertTrue(Number.isFinite(r_D), 'radiance Number.isFinite even when A=0', `actual=${r_D}`);

// [E] smoothstep gate 三端點（edge0=cos_outer < edge1=cos_inner，與 GLSL 同序）
console.log('\n[E] smoothstep(cos_outer, cos_inner, cos_ax) gate 三端點:');
const f_axis  = smoothstep(TRACK_BEAM_COS_OUTER, TRACK_BEAM_COS_INNER, 1.0);
const f_outer = smoothstep(TRACK_BEAM_COS_OUTER, TRACK_BEAM_COS_INNER, TRACK_BEAM_COS_OUTER + 1e-6);
const cosMid  = (TRACK_BEAM_COS_INNER + TRACK_BEAM_COS_OUTER) / 2;
const f_mid   = smoothstep(TRACK_BEAM_COS_OUTER, TRACK_BEAM_COS_INNER, cosMid);
assertEq(f_axis, 1.0, 'cos_ax=1.0 → falloff=1.0');
assertAbs(f_outer, 0, 1e-3, 'cos_ax=cos_outer+ε → falloff≈0');
// smoothstep 性質：input 為 (edge0+edge1)/2 時，output 必為 0.5（嚴格成立）
assertAbs(f_mid, 0.5, 0.05, 'cos_ax=(cos_inner+cos_outer)/2 → falloff≈0.5');

// [F] TRACK_LAMP_ID_BASE 常數契約
console.log('\n[F] TRACK_LAMP_ID_BASE 常數契約:');
assertEq(TRACK_LAMP_ID_BASE, 400, 'TRACK_LAMP_ID_BASE === 400');

// [G] fix07 radiometric 量綱：L = Φ / (K · π · A)（W/(sr·m²)，與 Cloud 同序）
// 手算：2000 / (320 · π · 2.827e-3) = 2000 / 2.84344 ≈ 703.43
// 舊版 Φ/(Ω·A)=840,213 為 photometric cd/m² 誤餵 radiometric tonemap → ~1195× overshoot
console.log('\n[G] fix07 radiometric computeTrackRadiance(2000, 4000, A, 60) ≈ 703:');
const r_G = computeTrackRadiance(2000, 4000, TRACK_LAMP_EMITTER_AREA, 60);
assertRelErr(r_G, 703.43, 0.01, 'radiance 與 Cloud 同量綱 Φ/(K·π·A) ≈ 703 W/(sr·m²)');
// 與 Cloud 單面 2000/3 lm, K=320, A≈3e-3 同序對照（Cloud ~70, Track ~700，量級 O(10²~10³) 不超三位）
assertTrue(r_G > 100 && r_G < 10000, 'radiance 與 Cloud 同序（O(10²~10³)）', `actual=${r_G}`);

// [H] fix07 色溫影響：2700K (K=280) 比 6500K (K=340) 高 340/280=1.214x radiance（Φ 固定時）
console.log('\n[H] fix07 色溫經由 K(T) 作用於 radiance:');
const r_warm = computeTrackRadiance(2000, 2700, TRACK_LAMP_EMITTER_AREA, 60);
const r_cold = computeTrackRadiance(2000, 6500, TRACK_LAMP_EMITTER_AREA, 60);
assertRelErr(r_warm / r_cold, 340 / 280, 0.01, 'K(warm)=280, K(cold)=340 → r_warm/r_cold=340/280');

console.log(`\n=== 結果：${failed === 0 ? 'PASS' : `FAIL (${failed})`} ===`);
process.exit(failed === 0 ? 0 : 1);
