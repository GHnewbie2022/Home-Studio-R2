// R6-1 bilateral kernel JS reference + contract-test
// 執行：node docs/tests/r6-1-bilateral-kernel.test.js
// 模式：contract-test（函式本體為 GLSL 端 PostDenoise_Fragment.glsl 的 JS 副本）
//
// !!警告：本檔 bilateralKernel function 是 GLSL 端 PostDenoise_Fragment.glsl 的 JS 副本，
// !!      改動 GLSL 時必須同步更新本檔，否則 GLSL vs JS pixel diff 驗證失效。
// !!      同步紀律：改 sigmaC/sigmaS/edgeMask/sumW fallback 邏輯，本檔一律同步改。

// ========== bilateralKernel JS 副本（與 PostDenoise_Fragment.glsl 邏輯對齊）==========
//
// 參數說明：
//   image       : Float32Array，RGBA flat layout（width × height × 4）
//   x, y        : 中央像素座標（整數）
//   width, height: 圖像尺寸
//   sigmaSpace  : 空間 sigma（5×5 kernel 建議值 2.0）
//   sigmaColor  : 顏色 sigma（per-sample 域）
//   kernelHalf  : 鄰域半徑（5×5 → kernelHalf=2）
//   isEdgePixel : bool，centerPixel.a == 1.0 → 邊緣 pixel 直通
//
// 回傳：[r, g, b]（per-sample 域 filtered RGB）
//
// GLSL 對應邏輯（PostDenoise_Fragment.glsl 偽碼）：
//   centerRGB = centerPixel.rgb * uOneOverSampleCounter
//   if (isEdge) return centerRGB（直通）
//   sigmaC = sigmaColor（本函式不做 sample_count normalize，GLSL 端另外做）
//   for dy/dx: edgeMask = (nPixel.a==1.0)?0:1
//              wC = exp(-dC²/(2σC²+1e-8)), wS = exp(-dS²/(2σS²+1e-8))
//              w = wC * wS * edgeMask
//   sumW > 1e-6 → sumRGB/sumW，否則 centerRGB

function bilateralKernel(image, x, y, width, height, sigmaSpace, sigmaColor, kernelHalf, isEdgePixel) {
    // 讀取指定座標的 RGBA（越界回 0）
    function getPixel(px, py) {
        if (px < 0 || px >= width || py < 0 || py >= height) {
            return [0.0, 0.0, 0.0, 0.0];
        }
        const idx = (py * width + px) * 4;
        return [image[idx], image[idx + 1], image[idx + 2], image[idx + 3]];
    }

    const center = getPixel(x, y);
    const centerR = center[0];
    const centerG = center[1];
    const centerB = center[2];

    // 邊緣 pixel 直通（P3：centerPixel.a == 1.0）
    if (isEdgePixel) {
        return [centerR, centerG, centerB];
    }

    // sigma=0 特殊處理（sigmaSpace=0 退化為中央 pixel；sigmaColor=0 只取同色 pixel）
    // 實作：加 1e-8 分母守門，sigma=0 時 exp(-x²/1e-8) 對 x>0 趨近 0（數值退化等效）
    const sigS2 = sigmaSpace * sigmaSpace;
    const sigC2 = sigmaColor * sigmaColor;

    let sumR = 0.0;
    let sumG = 0.0;
    let sumB = 0.0;
    let sumW = 0.0;

    for (let dy = -kernelHalf; dy <= kernelHalf; dy++) {
        for (let dx = -kernelHalf; dx <= kernelHalf; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            const neighbor = getPixel(nx, ny);
            const nR = neighbor[0];
            const nG = neighbor[1];
            const nB = neighbor[2];
            const nA = neighbor[3];

            // 鄰域邊緣 pixel spatial weight × 0（Architect 修訂 #4）
            const edgeMask = (nA === 1.0) ? 0.0 : 1.0;

            // 顏色距離
            const dR = nR - centerR;
            const dG = nG - centerG;
            const dB = nB - centerB;
            const dC2 = dR * dR + dG * dG + dB * dB;

            // 空間距離
            const dS2 = dx * dx + dy * dy;

            // bilateral weights（+1e-8 分母守門，避免 sigma=0 時除以零）
            const wC = Math.exp(-dC2 / (2.0 * sigC2 + 1e-8));
            const wS = Math.exp(-dS2 / (2.0 * sigS2 + 1e-8));
            const w = wC * wS * edgeMask;

            sumR += nR * w;
            sumG += nG * w;
            sumB += nB * w;
            sumW += w;
        }
    }

    // sumW < 1e-6 → fallback 回中央 pixel 原值
    if (sumW < 1e-6) {
        return [centerR, centerG, centerB];
    }

    return [sumR / sumW, sumG / sumW, sumB / sumW];
}
// ========== bilateralKernel JS 副本結束 ==========

// ========== 測試輔助函式 ==========
let failed = 0;
let passed = 0;

function pass(label, extra) {
    console.log(`  PASS  ${label}${extra ? '  ' + extra : ''}`);
    passed++;
}
function fail(label, extra) {
    console.log(`  FAIL  ${label}${extra ? '  ' + extra : ''}`);
    failed++;
}
function assertEq(actual, expected, label) {
    if (actual === expected) pass(label, `actual=${actual}`);
    else fail(label, `actual=${actual} expected=${expected}`);
}
function assertRelErr(actual, expected, tol, label) {
    const rel = Math.abs(actual - expected) / (Math.abs(expected) + 1e-12);
    if (rel <= tol) pass(label, `rel=${rel.toExponential(2)} actual=${actual.toExponential(4)}`);
    else fail(label, `actual=${actual} expected=${expected} rel=${rel} tol=${tol}`);
}
function assertAbs(actual, expected, tol, label) {
    const diff = Math.abs(actual - expected);
    if (diff <= tol) pass(label, `diff=${diff.toExponential(2)}`);
    else fail(label, `actual=${actual} expected=${expected} diff=${diff} tol=${tol}`);
}
function assertTrue(cond, label, extra) {
    if (cond) pass(label, extra);
    else fail(label, extra || 'condition false');
}

// 建構純色圖（width × height 全填 [r,g,b,a]）
function makeFlatImage(width, height, r, g, b, a) {
    const img = new Float32Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        img[i * 4 + 0] = r;
        img[i * 4 + 1] = g;
        img[i * 4 + 2] = b;
        img[i * 4 + 3] = a;
    }
    return img;
}

// 設定單一 pixel 值
function setPixel(img, width, x, y, r, g, b, a) {
    const idx = (y * width + x) * 4;
    img[idx]     = r;
    img[idx + 1] = g;
    img[idx + 2] = b;
    img[idx + 3] = a;
}

// 讀取單一 pixel 值
function getPixel(img, width, x, y) {
    const idx = (y * width + x) * 4;
    return [img[idx], img[idx + 1], img[idx + 2], img[idx + 3]];
}

// ========== 測試案例 ==========

console.log('=== R6-1 bilateral kernel JS reference contract-test ===\n');
console.log('!! 警告：本檔為 PostDenoise_Fragment.glsl 的 JS 副本，改動 GLSL 必須同步更新本檔 !!\n');

// ------------------------------------------------------------------
// [A] sigmaColor → ∞ 退化成純高斯空間模糊
// 設計：sigmaColor=1e10 時顏色 weight ≈ 1，退化為純 spatial Gaussian
// 驗證：混色中心 vs 鄰域，輸出應接近 spatial Gaussian 加權平均
// ------------------------------------------------------------------
console.log('[A] sigmaColor=1e10 退化成純 spatial Gaussian blur:');
{
    const W = 11, H = 11;
    // 棋盤格：奇偶不同顏色
    const img = new Float32Array(W * H * 4);
    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const v = ((px + py) % 2 === 0) ? 0.8 : 0.2;
            setPixel(img, W, px, py, v, v, v, 0.0);
        }
    }

    // 純高斯加權平均（手動計算 5×5 鄰域，sigmaSpace=2.0）
    const cx = 5, cy = 5;
    const sigS = 2.0, kH = 2;
    let gSumR = 0.0, gSumW = 0.0;
    for (let dy = -kH; dy <= kH; dy++) {
        for (let dx = -kH; dx <= kH; dx++) {
            const px = cx + dx, py = cy + dy;
            const idx = (py * W + px) * 4;
            const v = img[idx];
            const dS2 = dx * dx + dy * dy;
            const wS = Math.exp(-dS2 / (2.0 * sigS * sigS));
            gSumR += v * wS;
            gSumW += wS;
        }
    }
    const gaussianExpected = gSumR / gSumW;

    const result = bilateralKernel(img, cx, cy, W, H, 2.0, 1e10, 2, false);
    assertAbs(result[0], gaussianExpected, 1e-4, '[A] sigmaColor=1e10 output ≈ pure Gaussian blur');
}

// ------------------------------------------------------------------
// [B] sigmaSpace → 0 退化為中央 pixel
// sigmaSpace=1e-6 → 空間 weight 對非中央鄰居趨近 0，輸出 = 中央 pixel
// ------------------------------------------------------------------
console.log('\n[B] sigmaSpace=1e-6 退化為中央 pixel:');
{
    const W = 9, H = 9;
    const img = makeFlatImage(W, H, 0.5, 0.3, 0.7, 0.0);
    // 鄰域加入不同顏色干擾
    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            if (!(px === 4 && py === 4)) {
                setPixel(img, W, px, py, 0.0, 0.0, 0.0, 0.0);
            }
        }
    }

    const result = bilateralKernel(img, 4, 4, W, H, 1e-6, 0.1, 2, false);
    assertAbs(result[0], 0.5, 1e-4, '[B] sigmaSpace≈0 → output.r = center.r');
    assertAbs(result[1], 0.3, 1e-4, '[B] sigmaSpace≈0 → output.g = center.g');
    assertAbs(result[2], 0.7, 1e-4, '[B] sigmaSpace≈0 → output.b = center.b');
}

// ------------------------------------------------------------------
// [C] 平坦輸入 idempotent
// image 全部同色（非邊緣）→ 輸出 = 輸入（bilateral 不改變均勻區域）
// ------------------------------------------------------------------
console.log('\n[C] 平坦輸入 idempotent（全同色 → 輸出 = 輸入）:');
{
    const W = 9, H = 9;
    const img = makeFlatImage(W, H, 0.6, 0.4, 0.2, 0.0);
    const result = bilateralKernel(img, 4, 4, W, H, 2.0, 0.1, 2, false);
    assertAbs(result[0], 0.6, 1e-6, '[C] flat input idempotent r');
    assertAbs(result[1], 0.4, 1e-6, '[C] flat input idempotent g');
    assertAbs(result[2], 0.2, 1e-6, '[C] flat input idempotent b');
}

// ------------------------------------------------------------------
// [D] 階梯邊緣不互相污染（cross-bilateral 核心契約）
// 左半亮（0.9）右半暗（0.1），中央在邊界左側
// sigmaColor 小 → 顏色差距大的鄰居 weight 趨近 0 → 不被右半污染
// ------------------------------------------------------------------
console.log('\n[D] 階梯邊緣不互相污染（cross-bilateral 核心契約）:');
{
    const W = 11, H = 11;
    const img = new Float32Array(W * H * 4);
    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const v = (px < 6) ? 0.9 : 0.1;  // 左半亮，右半暗
            setPixel(img, W, px, py, v, v, v, 0.0);
        }
    }

    // 中央在 (5, 5)（左半邊界最右側，值 0.9）
    // sigmaColor=0.05 → 右半（0.1，diff=0.8）的 weight ≈ exp(-0.64/(2×0.0025+1e-8)) ≈ 0
    const result = bilateralKernel(img, 5, 5, W, H, 2.0, 0.05, 2, false);
    assertAbs(result[0], 0.9, 0.01, '[D] 左側中央 pixel 不被右半污染（output ≈ 0.9）');
}

// ------------------------------------------------------------------
// [E] noise 抑制（lab condition）
// 常值 0.5 + 隨機 N(0, 0.05) noise，sigmaColor=0.1，sigmaSpace=2.0
// 輸出 σ < 0.02（noise 壓低至少 60%）
// 附註：本 case 為 lab condition，scene σ 估值 0.05；步驟 4 (I) 真實場景門檻 ≥30%
// ------------------------------------------------------------------
console.log('\n[E] noise 抑制（lab condition，輸出 σ < 0.02）:');
{
    const W = 31, H = 31;
    // 使用確定性偽隨機，避免測試不穩定（線性同餘法）
    let seed = 12345;
    function lcg() {
        seed = (seed * 1664525 + 1013904223) & 0xffffffff;
        return (seed >>> 0) / 0xffffffff;
    }
    function randn() {
        // Box-Muller transform
        const u1 = Math.max(lcg(), 1e-10);
        const u2 = lcg();
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }

    const img = new Float32Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
        const v = 0.5 + randn() * 0.05;
        img[i * 4 + 0] = v;
        img[i * 4 + 1] = v;
        img[i * 4 + 2] = v;
        img[i * 4 + 3] = 0.0;
    }

    // 對中心 13×13 區域（避開邊界截斷效應）跑 bilateral，收集輸出 σ
    const results = [];
    const margin = 2;
    for (let py = margin; py < H - margin; py++) {
        for (let px = margin; px < W - margin; px++) {
            // sigmaColor=0.15：≈ 1.5 × σ_noise(0.1)，§F.3 推導（sigma_color_eff ≈ 1.5 × σ_N，N=1）
            const r = bilateralKernel(img, px, py, W, H, 2.0, 0.15, margin, false);
            results.push(r[0]);
        }
    }
    const mean = results.reduce((s, v) => s + v, 0) / results.length;
    const variance = results.reduce((s, v) => s + (v - mean) ** 2, 0) / results.length;
    const sigma = Math.sqrt(variance);

    assertTrue(sigma < 0.02, '[E] noise σ 抑制 bilateral σ < 0.02', `sigma=${sigma.toFixed(4)}`);
}

// ------------------------------------------------------------------
// [F] 全黑無 NaN/Inf
// image 全 0 → 輸出全 0，無 NaN / Inf
// ------------------------------------------------------------------
console.log('\n[F] 全黑無 NaN/Inf:');
{
    const W = 7, H = 7;
    const img = new Float32Array(W * H * 4);  // 全 0
    const result = bilateralKernel(img, 3, 3, W, H, 2.0, 0.1, 2, false);
    assertTrue(Number.isFinite(result[0]) && result[0] === 0.0, '[F] 全黑 output.r = 0, 無 NaN', `r=${result[0]}`);
    assertTrue(Number.isFinite(result[1]) && result[1] === 0.0, '[F] 全黑 output.g = 0, 無 NaN', `g=${result[1]}`);
    assertTrue(Number.isFinite(result[2]) && result[2] === 0.0, '[F] 全黑 output.b = 0, 無 NaN', `b=${result[2]}`);
}

// ------------------------------------------------------------------
// [G] 邊界 pixel 不爆（x=0, y=0 kernel 截斷）
// 左上角，kernel 越界部分 getPixel 回 0 → 輸出有效，無 NaN
// ------------------------------------------------------------------
console.log('\n[G] 邊界 pixel 不爆（x=0, y=0）:');
{
    const W = 7, H = 7;
    const img = makeFlatImage(W, H, 0.4, 0.4, 0.4, 0.0);
    const result = bilateralKernel(img, 0, 0, W, H, 2.0, 0.1, 2, false);
    assertTrue(Number.isFinite(result[0]), '[G] 邊界 pixel output.r finite', `r=${result[0]}`);
    assertTrue(Number.isFinite(result[1]), '[G] 邊界 pixel output.g finite', `g=${result[1]}`);
    assertTrue(Number.isFinite(result[2]), '[G] 邊界 pixel output.b finite', `b=${result[2]}`);
    // 全同色圖，邊界截斷後仍應輸出接近中央值
    assertAbs(result[0], 0.4, 0.01, '[G] 邊界 pixel output ≈ center value（全同色輸入）');
}

// ------------------------------------------------------------------
// [H] 邊緣 pixel 直通（isEdgePixel=true）
// 輸出 = 中央 pixel 原值（abs diff < 1e-7）
// Critical case（P3：centerPixel.a == 1.0 邊緣訊號直通）
// tol=1e-7：Float32Array 存入 JS number 時本身有 ~1.19e-7 精度損失，屬物理限制非邏輯錯誤
// ------------------------------------------------------------------
console.log('\n[H] 邊緣 pixel 直通（isEdgePixel=true）:');
{
    const W = 7, H = 7;
    // 中央為邊緣 pixel（a=1.0），鄰域為各種顏色干擾
    const img = makeFlatImage(W, H, 0.9, 0.1, 0.5, 0.0);
    setPixel(img, W, 3, 3, 0.3, 0.7, 0.2, 1.0);  // 中央是邊緣 pixel

    const result = bilateralKernel(img, 3, 3, W, H, 2.0, 0.1, 2, true);  // isEdgePixel=true
    // tol=1e-7：Float32Array float32 精度 ≈ 1.19e-7，JS float64 讀回有量化誤差
    assertAbs(result[0], 0.3, 1e-7, '[H] 邊緣直通 output.r = center.r（tol=Float32 精度）');
    assertAbs(result[1], 0.7, 1e-7, '[H] 邊緣直通 output.g = center.g（tol=Float32 精度）');
    assertAbs(result[2], 0.2, 1e-7, '[H] 邊緣直通 output.b = center.b（tol=Float32 精度）');
}

// ------------------------------------------------------------------
// [I] 鄰域邊緣 pixel weight=0（Critical case）
// 5×5 鄰域內某 pixel.a=1.0 → 該 pixel 不貢獻
// 驗證：手動計算排除邊緣 pixel 後的加權平均，與 bilateralKernel 輸出一致
// ------------------------------------------------------------------
console.log('\n[I] 鄰域邊緣 pixel（a=1.0）不貢獻（edgeMask × 0）:');
{
    const W = 9, H = 9;
    const img = makeFlatImage(W, H, 0.5, 0.5, 0.5, 0.0);  // 全同色，非邊緣
    // 在鄰域 (cx+1, cy) 設一個邊緣 pixel（a=1.0），同時給不同顏色
    const cx = 4, cy = 4;
    setPixel(img, W, cx + 1, cy, 0.9, 0.9, 0.9, 1.0);  // 邊緣 pixel，不應貢獻

    // 計算期望值：不含 (cx+1, cy) 的 bilateral 平均
    // 由於其他 pixel 全是 (0.5, 0.5, 0.5)，期望輸出仍接近 0.5
    const result = bilateralKernel(img, cx, cy, W, H, 2.0, 0.1, 2, false);

    // 若邊緣 pixel 被納入，其顏色 (0.9) 與中央 (0.5) 差距大，wC 很小但仍有貢獻
    // 若邊緣 pixel 被排除（edgeMask=0），其他全是 0.5，輸出應嚴格 = 0.5
    assertAbs(result[0], 0.5, 1e-5, '[I] 鄰域邊緣 pixel 被排除，output = 中央同色值 0.5 (r)');
    assertAbs(result[1], 0.5, 1e-5, '[I] 鄰域邊緣 pixel 被排除，output = 中央同色值 0.5 (g)');
    assertAbs(result[2], 0.5, 1e-5, '[I] 鄰域邊緣 pixel 被排除，output = 中央同色值 0.5 (b)');

    // 額外驗證：若移除 edgeMask，(0.9) 的 pixel 不同色 + 空間 weight，輸出會略偏 0.5+
    // 此驗證確認 edgeMask 確實讓結果嚴格等於 0.5（全同色場景無色偏）
    assertTrue(Math.abs(result[0] - 0.5) < 1e-5,
        '[I] 驗證 edgeMask=0 有效：output 與排除後期望值嚴格一致');
}

// ------------------------------------------------------------------
// [J] sumW=0 fallback（所有鄰域 weight=0 → fallback 回中央 pixel）
// 構造場景：中央為非邊緣 pixel，但鄰域全是邊緣 pixel（a=1.0）
// → edgeMask 全 0 → sumW=0 → fallback 回中央 pixel
// ------------------------------------------------------------------
console.log('\n[J] sumW=0 fallback → 回中央 pixel:');
{
    const W = 7, H = 7;
    const img = makeFlatImage(W, H, 0.9, 0.9, 0.9, 1.0);  // 全部是邊緣 pixel
    // 中央設為非邊緣 pixel，其他全是邊緣（edgeMask=0）
    setPixel(img, W, 3, 3, 0.3, 0.5, 0.7, 0.0);  // 中央非邊緣

    // 所有鄰域 a=1.0 → edgeMask=0 → sumW=0 → fallback
    const result = bilateralKernel(img, 3, 3, W, H, 2.0, 0.1, 2, false);
    // tol=1e-7：Float32Array float32 精度 ≈ 1.19e-7，同 [H] 物理精度限制
    assertAbs(result[0], 0.3, 1e-7, '[J] sumW=0 fallback → output.r = center.r（tol=Float32 精度）');
    assertAbs(result[1], 0.5, 1e-7, '[J] sumW=0 fallback → output.g = center.g（tol=Float32 精度）');
    assertAbs(result[2], 0.7, 1e-7, '[J] sumW=0 fallback → output.b = center.b（tol=Float32 精度）');
}

// ------------------------------------------------------------------
// [K] 對稱性
// 對稱輸入（左右鏡像）→ 中央輸出對稱，bilateral kernel 本身應保持對稱
// ------------------------------------------------------------------
console.log('\n[K] 對稱性（對稱輸入 → 對稱輸出）:');
{
    const W = 11, H = 11;
    const img = new Float32Array(W * H * 4);

    // 建立左右對稱的圖像（垂直中軸對稱）
    for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
            const mirrorX = W - 1 - px;
            const v = 0.3 + 0.5 * Math.sin(py * 0.5) * Math.cos(px * 0.3);
            // 確保左右完全鏡像
            if (px <= W / 2) {
                setPixel(img, W, px, py, v, v * 0.8, v * 0.6, 0.0);
                setPixel(img, W, mirrorX, py, v, v * 0.8, v * 0.6, 0.0);
            }
        }
    }

    // 中軸兩側對稱點：(4, 5) 和 (6, 5)（中央在 (5,5)，鏡像軸 x=5）
    const resultLeft  = bilateralKernel(img, 4, 5, W, H, 2.0, 0.1, 2, false);
    const resultRight = bilateralKernel(img, 6, 5, W, H, 2.0, 0.1, 2, false);

    // 由於圖像對稱，兩點的 bilateral 輸出應對稱（相同絕對值）
    assertAbs(resultLeft[0], resultRight[0], 1e-4, '[K] 對稱輸入：左右對稱點 output.r 相等');
    assertAbs(resultLeft[1], resultRight[1], 1e-4, '[K] 對稱輸入：左右對稱點 output.g 相等');
    assertAbs(resultLeft[2], resultRight[2], 1e-4, '[K] 對稱輸入：左右對稱點 output.b 相等');
}

// ========== 結果統計 ==========
console.log(`\n=== 結果：PASS=${passed} FAIL=${failed} ===`);
process.exit(failed === 0 ? 0 : 1);
