// R3-5a computeTrackWideRadiance + lumenToCandela + smoothstep gate contract-test
// 執行：node docs/tests/r3-5a-track-wide-radiance.test.js
// 模式：contract-test（函式本體複製自 js/Home_Studio.js R3-1 / R3-5a）
// 警告：改動 lumenToCandela / candelaToRadiance / kelvinToLuminousEfficacy / computeTrackWideRadiance 時須同步更新此檔副本。

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
function computeTrackWideRadiance(lm, T_K, A_m2, beamFullDeg) {
    // R3-5a：L = Φ / (K · π · A)（radiometric，與 R3-3 Cloud / R3-4 Track 同量綱）
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

// 常量副本（與 js/Home_Studio.js R3-5a 區段對齊）
const TRACK_WIDE_LAMP_EMITTER_AREA  = Math.PI * 0.05 * 0.05;
const TRACK_WIDE_LAMP_LUMENS_MAX    = 2500;
const TRACK_WIDE_BEAM_INNER_HALF_DEG = 55;
const TRACK_WIDE_BEAM_OUTER_HALF_DEG = 60;
const TRACK_WIDE_BEAM_FULL_DEG       = TRACK_WIDE_BEAM_OUTER_HALF_DEG * 2;
const TRACK_WIDE_LAMP_ID_BASE        = 700;
const TRACK_WIDE_BEAM_COS_INNER      = Math.cos(TRACK_WIDE_BEAM_INNER_HALF_DEG * Math.PI / 180);
const TRACK_WIDE_BEAM_COS_OUTER      = Math.cos(TRACK_WIDE_BEAM_OUTER_HALF_DEG * Math.PI / 180);

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

console.log('=== R3-5a Track wide radiance contract-test ===\n');

// [A] lumenToCandela(2500, 120) ground truth（全角 120° → 半角 60°）
// 手算：2π(1 - cos(60°)) = 2π × (1 - 0.5) = π ≈ 3.14159
// 2500 / π ≈ 795.77 cd
console.log('[A] lumenToCandela(2500, 120) vs. hand-computed ground truth:');
const cdA = lumenToCandela(2500, 120);
assertRelErr(cdA, 795.77, 0.01, 'lumenToCandela(2500, 120) ≈ 795.77');

// [B] computeTrackWideRadiance 數值非零且為正
console.log('\n[B] computeTrackWideRadiance(2500, 4000, 7.854e-3, 120) > 0:');
const r_B = computeTrackWideRadiance(2500, 4000, TRACK_WIDE_LAMP_EMITTER_AREA, 120);
assertTrue(Number.isFinite(r_B) && r_B > 0, 'radiance finite and > 0', `actual=${r_B}`);

// [C] lm=0 守門
console.log('\n[C] computeTrackWideRadiance(0, 4000, A, 120) === 0:');
const r_C = computeTrackWideRadiance(0, 4000, TRACK_WIDE_LAMP_EMITTER_AREA, 120);
assertEq(r_C, 0, 'lm=0 → radiance=0');

// [D] emitterArea=0 不爆 NaN/Inf（內部 max(A, 1e-8) 守門）
console.log('\n[D] computeTrackWideRadiance(2500, 4000, 0, 120) finite:');
const r_D = computeTrackWideRadiance(2500, 4000, 0, 120);
assertTrue(Number.isFinite(r_D), 'radiance Number.isFinite even when A=0', `actual=${r_D}`);

// [E] smoothstep gate 三端點（edge0=cos_outer < edge1=cos_inner，與 GLSL 同序）
console.log('\n[E] smoothstep(cos_outer, cos_inner, cos_ax) gate 三端點:');
const f_axis  = smoothstep(TRACK_WIDE_BEAM_COS_OUTER, TRACK_WIDE_BEAM_COS_INNER, 1.0);
const f_outer = smoothstep(TRACK_WIDE_BEAM_COS_OUTER, TRACK_WIDE_BEAM_COS_INNER, TRACK_WIDE_BEAM_COS_OUTER + 1e-6);
const cosMid  = (TRACK_WIDE_BEAM_COS_INNER + TRACK_WIDE_BEAM_COS_OUTER) / 2;
const f_mid   = smoothstep(TRACK_WIDE_BEAM_COS_OUTER, TRACK_WIDE_BEAM_COS_INNER, cosMid);
assertEq(f_axis, 1.0, 'cos_ax=1.0 → falloff=1.0');
assertAbs(f_outer, 0, 1e-3, 'cos_ax=cos_outer+ε → falloff≈0');
// smoothstep 性質：input 為 (edge0+edge1)/2 時，output 必為 0.5（嚴格成立）
assertAbs(f_mid, 0.5, 0.05, 'cos_ax=(cos_inner+cos_outer)/2 → falloff≈0.5');

// [F] TRACK_WIDE_LAMP_ID_BASE 常數契約（避開 400 spot emitter / 500 wide housing / 600 spot housing）
console.log('\n[F] TRACK_WIDE_LAMP_ID_BASE 常數契約:');
assertEq(TRACK_WIDE_LAMP_ID_BASE, 700, 'TRACK_WIDE_LAMP_ID_BASE === 700');

// [G] radiometric 量綱：L = Φ / (K · π · A)（W/(sr·m²)，與 Cloud / Track 同序）
// 手算：2500 / (320 · π · 7.854e-3) = 2500 / 7.8957 ≈ 316.63
console.log('\n[G] radiometric computeTrackWideRadiance(2500, 4000, A, 120) ≈ 316:');
const r_G = computeTrackWideRadiance(2500, 4000, TRACK_WIDE_LAMP_EMITTER_AREA, 120);
assertRelErr(r_G, 316.63, 0.01, 'radiance 與 Cloud / Track 同量綱 Φ/(K·π·A) ≈ 316 W/(sr·m²)');
// Cloud 單面 ~70, Track ~700, Wide ~316 — 均於 O(10²~10³) 區間
assertTrue(r_G > 100 && r_G < 10000, 'radiance 與 Cloud/Track 同序（O(10²~10³)）', `actual=${r_G}`);

// [H] 色溫影響：2700K (K=280) 比 6500K (K=340) 高 340/280=1.214x radiance（Φ 固定時）
console.log('\n[H] 色溫經由 K(T) 作用於 radiance:');
const r_warm = computeTrackWideRadiance(2500, 2700, TRACK_WIDE_LAMP_EMITTER_AREA, 120);
const r_cold = computeTrackWideRadiance(2500, 6500, TRACK_WIDE_LAMP_EMITTER_AREA, 120);
assertRelErr(r_warm / r_cold, 340 / 280, 0.01, 'K(warm)=280, K(cold)=340 → r_warm/r_cold=340/280');

// [I] emitter 面積比率：wide (r=5cm) / spot (r=3cm) = 25/9 ≈ 2.778
console.log('\n[I] emitter 面積比率 wide/spot = (0.05/0.03)² ≈ 2.778:');
const TRACK_LAMP_EMITTER_AREA = Math.PI * 0.03 * 0.03;
const areaRatio = TRACK_WIDE_LAMP_EMITTER_AREA / TRACK_LAMP_EMITTER_AREA;
assertRelErr(areaRatio, 25 / 9, 0.01, 'wide/spot area ratio ≈ 2.778');

console.log(`\n=== 結果：${failed === 0 ? 'PASS' : `FAIL (${failed})`} ===`);
process.exit(failed === 0 ? 0 : 1);
