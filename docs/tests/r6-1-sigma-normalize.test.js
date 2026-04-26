// R6-1 step 1b：sigma_normalize contract-test
// 執行：node docs/tests/r6-1-sigma-normalize.test.js
// 模式：contract-test（函式本體與常數為 GLSL/JS 端同步副本）
//
// 警告：本檔 sigmaNormalize function 與 SIGMA_PRESETS 與
//       GLSL 端 PostDenoise_Fragment.glsl + JS 端 Home_Studio.js applyPanelConfig
//       是同步副本，改動任一處必須同步。

// ========== sigmaNormalize 函式本體副本 ==========
//
// sigmaBase  : per-config sigma_color base（來自 §F.6 表）
// sampleCount: 累積 sample 數（uSampleCounter）
// 回傳       : sigma_color_eff
//
// 公式（§F.4）：
//   sigma_color_eff = sigmaBase × max(1, 4.0 / sqrt(sampleCount))
//
// 物理意義：
//   N=1  → noise 最髒，sigma 放大 4 倍
//   N=16 → sigma 維持 base（4/√16=1.0，floor 起作用）
//   N>16 → noise 已收斂，sigma 繼續維持 base（禁止縮小，避免 bilateral 退化為只取中央）

function sigmaNormalize(sigmaBase, sampleCount) {
    const factor = Math.max(1.0, 4.0 / Math.sqrt(sampleCount));
    return sigmaBase * factor;
}

// ========== per-config sigma preset 常數（§F.6 表，使用者反饋已套用）==========
//
// 2026-04-26 使用者反饋：C1/C2 整體視覺乾淨，sigma_color base 改為 0.00
// （完全不降噪，bilateral pass 退化為 passthrough）
// C3/C4 朝外光源，cosLight ≈ 0，variance 高，維持推導值 0.20/0.22

const SIGMA_PRESETS = {
    1: { space: 2.0, color: 0.00 },  // C1：使用者反饋，整體已乾淨
    2: { space: 2.0, color: 0.00 },  // C2：使用者反饋，整體已乾淨
    3: { space: 2.0, color: 0.20 },  // C3：朝外光源，NEE 採樣 50%+ 浪費
    4: { space: 2.0, color: 0.22 }   // C4：朝外光源，加軌道輔光
};

// ========== 測試輔助 ==========

let passed = 0;
let failed = 0;

function pass(label) {
    console.log(`  PASS  ${label}`);
    passed++;
}

function fail(label, detail) {
    console.log(`  FAIL  ${label}  ← ${detail}`);
    failed++;
}

/**
 * 相對誤差斷言（tol=1e-7）
 * 若 expected 趨近 0 則改用絕對誤差
 */
function assertRelErr(actual, expected, label, tol) {
    tol = tol !== undefined ? tol : 1e-7;
    const absErr = Math.abs(actual - expected);
    const ref = Math.abs(expected);
    const err = ref > 1e-12 ? absErr / ref : absErr;
    if (err <= tol) {
        pass(`${label}  (actual=${actual.toExponential(6)}, expected=${expected.toExponential(6)}, relErr=${err.toExponential(2)})`);
    } else {
        fail(`${label}`, `actual=${actual} expected=${expected} relErr=${err.toExponential(2)} tol=${tol}`);
    }
}

/**
 * 精確相等斷言（abs diff < tol）
 */
function assertEq(actual, expected, label, tol) {
    tol = tol !== undefined ? tol : 1e-7;
    const diff = Math.abs(actual - expected);
    if (diff <= tol) {
        pass(`${label}  (actual=${actual}, diff=${diff.toExponential(2)})`);
    } else {
        fail(`${label}`, `actual=${actual} expected=${expected} diff=${diff} tol=${tol}`);
    }
}

// ========== contract-test cases ==========

console.log('=== R6-1 sigma_normalize contract-test ===\n');

// [A] N=16 時 normalize 因子 = 1
//     4/√16 = 4/4 = 1.0 → max(1, 1.0) = 1.0 → sigma_eff = sigmaBase × 1.0 = 0.20
console.log('[A] N=16：normalize 因子 = 1（4/√16=1.0，floor 起作用）');
assertRelErr(sigmaNormalize(0.20, 16), 0.20, 'sigmaBase=0.20, N=16 → sigma_eff=0.20');

// [B] N=1 時 sigma 放 4 倍
//     4/√1 = 4.0 → max(1, 4.0) = 4.0 → sigma_eff = 0.20 × 4.0 = 0.80
console.log('\n[B] N=1：sigma 放 4 倍（4/√1=4.0）');
assertRelErr(sigmaNormalize(0.20, 1), 0.80, 'sigmaBase=0.20, N=1 → sigma_eff=0.80');

// [C] N=10000 時 floor at base
//     4/√10000 = 4/100 = 0.04 < 1 → max(1, 0.04) = 1.0 → sigma_eff = 0.20
console.log('\n[C] N=10000：floor at base（4/√10000=0.04 < 1，max(1,…)=1）');
assertRelErr(sigmaNormalize(0.20, 10000), 0.20, 'sigmaBase=0.20, N=10000 → sigma_eff=0.20（floor）');

// [D] sigmaBase=0 退化（C1/C2 使用者反饋落地驗證）
//     無論 N 為何，0 × factor = 0 → bilateral 完全不降噪
console.log('\n[D] sigmaBase=0 退化（C1/C2 使用者反饋：整體乾淨，sigma=0）');
assertEq(sigmaNormalize(0, 16),    0, 'sigmaBase=0, N=16   → sigma_eff=0');
assertEq(sigmaNormalize(0, 1),     0, 'sigmaBase=0, N=1    → sigma_eff=0');
assertEq(sigmaNormalize(0, 10000), 0, 'sigmaBase=0, N=10000 → sigma_eff=0');

// [E] preset 表單調性
//     C1.color = C2.color = 0.00（同等乾淨，使用者反饋）
//     C3.color = 0.20，C4.color = 0.22（朝外類別，C3 ≤ C4）
console.log('\n[E] preset 表單調性');
if (SIGMA_PRESETS[1].color === SIGMA_PRESETS[2].color) {
    pass(`C1.color === C2.color（都是 ${SIGMA_PRESETS[1].color}，使用者反饋同等乾淨）`);
} else {
    fail('C1.color === C2.color', `C1=${SIGMA_PRESETS[1].color} C2=${SIGMA_PRESETS[2].color}`);
}
if (SIGMA_PRESETS[2].color < SIGMA_PRESETS[3].color) {
    pass(`C2.color(${SIGMA_PRESETS[2].color}) < C3.color(${SIGMA_PRESETS[3].color})`);
} else {
    fail('C2.color < C3.color', `C2=${SIGMA_PRESETS[2].color} C3=${SIGMA_PRESETS[3].color}`);
}
if (SIGMA_PRESETS[3].color <= SIGMA_PRESETS[4].color) {
    pass(`C3.color(${SIGMA_PRESETS[3].color}) <= C4.color(${SIGMA_PRESETS[4].color})`);
} else {
    fail('C3.color <= C4.color', `C3=${SIGMA_PRESETS[3].color} C4=${SIGMA_PRESETS[4].color}`);
}

// [F] preset.space 全 > 0（避免 bilateral kernel 中 sigma_spatial=0 導致 div by zero）
console.log('\n[F] preset.space 全 > 0（避免 div by zero）');
for (const [k, v] of Object.entries(SIGMA_PRESETS)) {
    if (v.space > 0) {
        pass(`C${k}.space = ${v.space} > 0`);
    } else {
        fail(`C${k}.space > 0`, `space = ${v.space}`);
    }
}

// [G] sigma=0 + N=1 邊界（C1/C2 切到 N=1 仍維持 0）
//     C1/C2 sigma=0 時任何 factor 都不影響結果
console.log('\n[G] sigma=0 + N=1 邊界（C1/C2 切到 N=1 仍 sigma_eff=0）');
assertEq(sigmaNormalize(SIGMA_PRESETS[1].color, 1), 0, 'C1 sigmaBase=0, N=1 → sigma_eff=0');
assertEq(sigmaNormalize(SIGMA_PRESETS[2].color, 1), 0, 'C2 sigmaBase=0, N=1 → sigma_eff=0');

// [H] 連續性（sigmaBase=0.20 時，N 增大 sigma_eff 單調遞減）
//     N=4  → 4/√4=2.0 → sigma_eff=0.40
//     N=9  → 4/√9≈1.33 → sigma_eff≈0.267
//     N=16 → 4/√16=1.0 → sigma_eff=0.20（floor，不再縮）
//     N=100 → floor → sigma_eff=0.20（與 N=16 相同）
console.log('\n[H] 連續性：sigmaBase=0.20，N 增大時 sigma_eff 單調遞減（直至 floor）');
const effN4  = sigmaNormalize(0.20, 4);
const effN9  = sigmaNormalize(0.20, 9);
const effN16 = sigmaNormalize(0.20, 16);
const effN100 = sigmaNormalize(0.20, 100);

assertRelErr(effN4, 0.40, 'N=4  → 4/√4=2.0 → sigma_eff=0.40');
if (effN4 > effN9) {
    pass(`N=4 sigma_eff(${effN4.toFixed(6)}) > N=9 sigma_eff(${effN9.toFixed(6)})（單調遞減）`);
} else {
    fail('N=4 > N=9 單調性', `N=4=${effN4} N=9=${effN9}`);
}
if (effN9 > effN16) {
    pass(`N=9 sigma_eff(${effN9.toFixed(6)}) > N=16 sigma_eff(${effN16.toFixed(6)})（單調遞減）`);
} else {
    fail('N=9 > N=16 單調性', `N=9=${effN9} N=16=${effN16}`);
}
if (Math.abs(effN16 - effN100) < 1e-12) {
    pass(`N=16 sigma_eff = N=100 sigma_eff = ${effN16.toFixed(6)}（floor at base，不再縮）`);
} else {
    fail('N=16 = N=100（floor 守門）', `N=16=${effN16} N=100=${effN100}`);
}

// ========== 結果統計 ==========

console.log(`\n=== 結果：PASS=${passed} FAIL=${failed} ===`);
if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
