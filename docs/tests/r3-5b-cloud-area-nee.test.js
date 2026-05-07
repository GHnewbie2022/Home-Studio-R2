// R6-3 Phase 1C computeCloudRadiance + Cloud arc-area NEE contract-test
// 執行：node docs/tests/r3-5b-cloud-area-nee.test.js
// 模式：contract-test（函式本體複製自 js/Home_Studio.js R6-3 Phase 1C 區段）
// 警告：改動 computeCloudRadiance / CLOUD_ARC_AREA_SCALE / CLOUD_ROD_CENTER / CLOUD_ROD_HALF_EXTENT
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
    const arcArea = Math.max(faceArea * CLOUD_ARC_AREA_SCALE, 1e-8);
    return lm_total / (K * Math.PI * arcArea);
}
// ========== 函式本體副本結束 ==========

// 常量副本（與 js/Home_Studio.js R6-3 Phase 1C 區段對齊）
const CLOUD_ARC_AREA_SCALE = Math.PI * 0.5;
const CLOUD_ARC_RADIUS = 0.016;
const NEE_POOL_SIZE       = 11;
const CLOUD_ROD_LENGTH = [2.368, 2.368, 1.768, 1.768];
const CLOUD_ROD_LUMENS_REF_480 = CLOUD_ROD_LENGTH.map(length => 480 * length);
const CLOUD_ROD_LUMENS_CURRENT_1600 = CLOUD_ROD_LENGTH.map(length => 1600 * length);
const CLOUD_ROD_FACE_AREA = CLOUD_ROD_LENGTH.map(length => CLOUD_ARC_RADIUS * length);
// Rod centers (world-space metres)
const ROD_CENTERS = [
    { x:  0.892, y: 2.795, z:  0.498 },  // E
    { x: -0.892, y: 2.795, z:  0.498 },  // W
    { x:  0.000, y: 2.795, z:  1.690 },  // S
    { x:  0.000, y: 2.795, z: -0.694 },  // N
];
const ROD_HALF_EXTENTS = [
    { x: 0.008, y: 0.008, z: 1.184 },  // E
    { x: 0.008, y: 0.008, z: 1.184 },  // W
    { x: 0.884, y: 0.008, z: 0.008 },  // S
    { x: 0.884, y: 0.008, z: 0.008 },  // N
];
const shader = require('fs').readFileSync(require('path').resolve(__dirname, '../../shaders/Home_Studio_Fragment.glsl'), 'utf8');

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

console.log('=== R6-3 Phase 1C Cloud arc area NEE contract-test ===\n');

// [A] computeCloudRadiance(1136.64, 4000, 0.037888) ground truth
// 手算：A_arc=(π/2)×0.037888；1136.64 / (320 · π · A_arc) ≈ 18.9977 W/(sr·m²)
console.log('[A] computeCloudRadiance(1136.64, 4000, 0.037888) ≈ 18.9977:');
const r_A = computeCloudRadiance(1136.64, 4000, 0.037888);
assertRelErr(r_A, 18.9977, 0.001, 'radiance 對 E/W rod 算式對齊 A_arc 分母');

// [B] lm=0 守門
console.log('\n[B] computeCloudRadiance(0, 4000, E/W faceArea) === 0:');
const r_B = computeCloudRadiance(0, 4000, CLOUD_ROD_FACE_AREA[0]);
assertEq(r_B, 0, 'lm=0 → 0');

// [C] faceArea=0 守門（max(A, 1e-8)）
console.log('\n[C] computeCloudRadiance(E/W 480 lm/m flux, 4000, 0) finite:');
const r_C = computeCloudRadiance(CLOUD_ROD_LUMENS_REF_480[0], 4000, 0);
assertTrue(Number.isFinite(r_C), 'radiance finite when A=0', `actual=${r_C}`);

// [D] A_arc = (π/2) × A_face 契約
console.log('\n[D] CLOUD_ARC_AREA_SCALE === π/2:');
assertRelErr(CLOUD_ARC_AREA_SCALE, Math.PI / 2, 1e-12, 'arc area scale = π/2');
assertRelErr(CLOUD_ROD_FACE_AREA[0] * CLOUD_ARC_AREA_SCALE, 0.0595143, 0.0001, 'E/W A_arc ≈ 0.0595143 m²');

// [E] 色溫：K(2700)=280 vs K(6500)=340 → radiance ratio 340/280 ≈ 1.214（Φ 固定）
console.log('\n[E] radiance(2700) / radiance(6500) = 340/280:');
const r_warm = computeCloudRadiance(CLOUD_ROD_LUMENS_REF_480[0], 2700, CLOUD_ROD_FACE_AREA[0]);
const r_cold = computeCloudRadiance(CLOUD_ROD_LUMENS_REF_480[0], 6500, CLOUD_ROD_FACE_AREA[0]);
assertRelErr(r_warm / r_cold, 340 / 280, 0.01, 'K(warm)=280, K(cold)=340 → r_warm/r_cold=340/280');

// [F] Rod geometry: E/W half-extent = (0.008, 0.008, 1.184)；S/N = (0.884, 0.008, 0.008)
console.log('\n[F] rod half-extent 幾何契約:');
assertEq(ROD_HALF_EXTENTS[0].x, 0.008, 'E rod halfX');
assertEq(ROD_HALF_EXTENTS[0].y, 0.008, 'E rod halfY');
assertEq(ROD_HALF_EXTENTS[0].z, 1.184, 'E rod halfZ');
assertEq(ROD_HALF_EXTENTS[2].x, 0.884, 'S rod halfX');
assertEq(ROD_HALF_EXTENTS[2].y, 0.008, 'S rod halfY');
assertEq(ROD_HALF_EXTENTS[2].z, 0.008, 'S rod halfZ');

// [G] Rod center 對稱：E/W 鏡像（x 軸），S/N 大致對稱（z 軸，房間非嚴格對稱）
console.log('\n[G] rod center 對稱:');
assertEq(ROD_CENTERS[0].x, -ROD_CENTERS[1].x, 'E/W x 鏡像');
assertEq(ROD_CENTERS[2].x, ROD_CENTERS[3].x, 'S/N x 對齊');
assertTrue(Math.abs(ROD_CENTERS[2].z + ROD_CENTERS[3].z) < 1.0, 'S/N z 大致對稱（房間非嚴格鏡像）');

// [H] 目前預設 1600 lm/m，480 lm/m 保留為商品低檔參考值
console.log('\n[H] 1600 lm/m current default vs 480 lm/m product reference:');
const r_ref480 = computeCloudRadiance(CLOUD_ROD_LUMENS_REF_480[0], 4000, CLOUD_ROD_FACE_AREA[0]);
const r_current1600 = computeCloudRadiance(CLOUD_ROD_LUMENS_CURRENT_1600[0], 4000, CLOUD_ROD_FACE_AREA[0]);
assertRelErr(r_current1600 / r_ref480, 1600 / 480, 0.001, 'current/reference radiance ratio = 1600/480');
assertRelErr(r_current1600, 63.3257, 0.001, 'E/W current 1600 lm/m radiance ≈ 63.3257');

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
// E/W: lm=480×2.368=1136.64, A=0.016×2.368=0.037888 → lm/A=30000
// S/N: lm=480×1.768=848.64, A=0.016×1.768=0.028288 → lm/A=30000
console.log('\n[K] radiance E/W vs S/N 同值（lm/faceArea 比不變）:');
const r_EW = computeCloudRadiance(CLOUD_ROD_LUMENS_CURRENT_1600[0], 4000, CLOUD_ROD_FACE_AREA[0]);
const r_SN = computeCloudRadiance(CLOUD_ROD_LUMENS_CURRENT_1600[2], 4000, CLOUD_ROD_FACE_AREA[2]);
assertRelErr(r_EW, r_SN, 0.001, '所有 rod 同 K 下 radiance 同值');

// [L] radiometric 量綱範圍確認：current 1600 lm/m Cloud rod radiance 應落 O(10~100) W/(sr·m²)
console.log('\n[L] Cloud radiance 量綱範圍 O(10~100):');
assertTrue(r_EW > 10 && r_EW < 100, 'Cloud radiance 在合理量綱範圍', `actual=${r_EW}`);

// [M] Cloud arc emission normal：probe 模式可用反向法線分類，但正常渲染維持既有 localNormal 亮度
console.log('\n[M] Cloud arc emission normal is probe-only:');
assertTrue(shader.includes('vec3 cloudArcEmissionNormal'), 'shader exposes Cloud emission-normal helper');
assertTrue(shader.includes('return -cloudArcNormal(rodIdx, theta);'), 'Cloud emission normal is inverse of geometric arc normal');
assertTrue(shader.includes('vec3 cloudArcRenderNormal'), 'Cloud render normal helper keeps probe normal selection centralized');
assertTrue(shader.includes('return (uCloudVisibilityProbeMode > 0) ? cloudArcEmissionNormal(rodIdx, theta) : cloudArcNormal(rodIdx, theta);'), 'Cloud NEE uses emission normal only when probe is enabled');
assertTrue(shader.includes('vec3 emissionNormal = cloudArcRenderNormal(rodIdx, theta);'), 'Cloud NEE reads normal through the probe-gated helper');
assertTrue(shader.includes('dot(-cloudDir, emissionNormal)'), 'Cloud NEE facing term uses emission normal');
assertTrue(shader.includes('pdfNeeForLight(x, cloudTarget, emissionNormal'), 'Cloud NEE PDF uses emission normal');
assertTrue(shader.includes('vec3 reverseEmissionNormal = (uCloudVisibilityProbeMode > 0) ? -hitNormal : hitNormal;'), 'Cloud reverse-NEE PDF uses room-facing normal only when probe is enabled');
assertTrue(shader.includes('pdfNeeForLight(misBsdfBounceOrigin, x, reverseEmissionNormal'), 'Cloud reverse-NEE PDF uses the selected normal');
assertTrue(shader.includes('float cloudPdfArea = cloudThetaImportanceEffectiveArcArea(cloudArcArea, thetaPdfCompensationMultiplier);'), 'Cloud NEE uses theta-importance effective area');
assertTrue(shader.includes('throughput = cloudEmit * cloudGeom * cloudPdfArea / selectPdf;'), 'Cloud NEE throughput uses theta PDF compensation');
assertTrue(shader.includes('pdfNeeForLight(x, cloudTarget, emissionNormal, cloudPdfArea, selectPdf);'), 'Cloud NEE PDF uses theta PDF compensation');
assertTrue(shader.includes('float reverseCloudPdfArea = cloudThetaImportanceEffectiveArcAreaForNormal(rodIdx, cloudArcArea, hitNormal);'), 'Cloud reverse-NEE PDF uses theta-importance effective area');
assertTrue(shader.includes('pdfNeeForLight(misBsdfBounceOrigin, x, reverseEmissionNormal, reverseCloudPdfArea'), 'Cloud reverse-NEE PDF applies theta PDF compensation');

console.log(`\n=== 結果：${failed === 0 ? 'PASS' : `FAIL (${failed})`} ===`);
process.exit(failed === 0 ? 0 : 1);
