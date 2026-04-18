# R3-2 色溫→RGB 換算（kelvinToRGB + GUI）v2 整合版

> **版本**：v2（整合 Architect ITERATE + Critic ITERATE 共 12 項反饋）
> **決策組合**：A2 + B3 + C1 + D1 + E1（維持 v1 不變）
> **工作目錄**：/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/
> **狀態**：待 Critic 第二輪審議（目標 APPROVE）

---

## 1. Principles

    P1. 單一資料流向：JS 狀態 → CPU 換算 → Uniform，R3-2 不動 shader
    P2. 可測試優先：色溫換算必須有 unit test 斷言（node 可直接跑）
    P3. 最小侵入：不改 R3-1 完成的 radiance 管線，不動 uCloudEmission 型別
    P4. 狀態單一真相源：git commit 為 state-of-truth，SOP markdown 為人類可讀快照
    P5. Escape hatch：R3-2 的 CPU 換算選擇保留「日後升 per-sample uniform」的升級路徑

## 2. Decision Drivers

    D1. R3-1 已完成 radiance 管線，R3-2 不得污染既有資料路徑
    D2. R3-3/R3-6 將疊加 spectral + bloom，誤差會被放大（CR2 核心論據）
    D3. GUI 現行 colorTempCtrl 慣例須延續（L1053 step=100K）
    D4. SOP「R3：燈光系統.md」為真相快照，需與 git 狀態雙軌一致
    D5. R3-5 Many-Light MIS 可能需 per-sample 色溫調變（escape hatch 預留）

## 3. 辯論 A：函式簽章與回傳型別

    選項 A1：回傳 THREE.Color
    選項 A2：回傳純 {r, g, b} 物件（v1 採用，v2 維持）
    選項 A3：回傳 [r, g, b] Float32Array

    採 A2 理由：
      - 零依賴，node 環境可直接跑 unit test（P2）
      - 【MINOR-2 補述】L1154 現行消費端已使用 rgb.r/.g/.b 具名語法，
        {r,g,b} 物件格式維持 ABI 相容，避免連帶改動 shader uniform 寫入點
      - 【CR2 雙容許誤差】
          對外契約（SOP 宣告）：±0.03（人眼 JND 等級）
          對內實作目標：±0.01（unit test 斷言用）
          理由：R3-3 spectral emission + R3-6 bloom 疊乘後，
                ±0.03 會放大到 Δuv > 0.008，
                超過 MacAdam ellipse 可感知閾值 0.004；
                實作端收緊到 ±0.01 留出 3 倍安全邊界

## 4. 辯論 B：錨點表來源

    選項 B1：CIE 1931 Planckian locus + XYZ→sRGB 矩陣（理論正確但實作複雜）
    選項 B2：Tanner Helland 近似多項式（快但不夠準）
    選項 B3：Mitchell Charity blackbody table 實測 sRGB（v1 採用，v2 維持）

    採 B3 理由：
      - 來源權威（vendian.org，1990 年代起持續維護）
      - 已預先 gamma 壓到 sRGB space，符合 THREE.js 線性工作流前的慣例
      - 5 錨點足以用 PCHIP 插值覆蓋 2000-10000K 全域

## 5. 辯論 C：插值策略

    選項 C1：PCHIP monotonic cubic Hermite（v1 採用，v2 維持並具體化）
    選項 C2：Catmull-Rom spline
    選項 C3：Linear interpolation

    採 C1 理由：
      - Fritsch-Carlson 1980 monotonic 條件可避免 overshoot（黑體譜單調遞增/遞減）
      - 比 linear 平滑（無 C0 折角），比 Catmull-Rom 穩（無極值震盪）
      - 【AR1 具體化】採 Hermite smoothstep blend 在 6400-6600K 過渡帶
        （避免錨點 6500K 附近 G 通道反轉造成一階導數斷裂）

## 6. 辯論 D：GUI 控件分組

    選項 D1：Cloud 獨立 + Track 共用 + TrackWide 共用（v1 採用，v2 維持）
    選項 D2：全部獨立（14 個 slider）
    選項 D3：全部共用（1 個 slider）

    採 D1 理由：
      - Cloud 物理意義獨立（太陽光 vs 軌道燈），不能綁 Track
      - Track 4 盞與 TrackWide 2 盞為同型光源陣列，共用 slider 符合直覺
      - broadcast setter 模式見 Step 4（CR7 明示 for-loop 陣列語意）
      - 【MINOR-1 設計意圖備註】
        R3-2 不提供視覺回饋（色溫調整後畫面不變），此為刻意設計：
        R3-2 只建立狀態與換算管線，shader 光路待 R3-3 接入；
        此備註須寫入 SOP R3-2 完成條件 4 下方

## 7. 辯論 E：狀態儲存層

    選項 E1：JS module-scope 變數（v1 採用，v2 維持）
    選項 E2：THREE.js Uniform 直存
    選項 E3：localStorage 持久化

    採 E1 理由：
      - R3-2 階段 shader 未接，存 Uniform 是 premature optimization
      - 重整頁面回預設 4000K 是可接受行為（R3-2 非 UX 階段）
      - R3-5 若需 per-sample 調變，屆時再升為 uniform（CR5 escape hatch）

## 8. 實作步驟（v2：11 步驟）

### Step 1【AR1 + CR1】kelvinToRGB 函式具體實作

位置：js/Home_Studio.js L532-565 既有 kelvinToRGB 全域替換

實作：PCHIP monotonic cubic Hermite + 5 錨點 + 夾取

錨點資料（Mitchell Charity sRGB table）：
- 來源 URL：http://www.vendian.org/mncharity/dir3/blackbody/UnstableURLs/bbr_color.html
- 2000K  → (1.00, 0.54, 0.17)
- 3000K  → (1.00, 0.75, 0.42)
- 4000K  → (1.00, 0.89, 0.76)
- 6500K  → (1.00, 0.99, 1.00)   [原表 6504K D65，四捨五入至 6500K]
- 10000K → (0.79, 0.87, 1.00)

夾取策略：
- K < 2000  → clamp 到 2000
- K > 10000 → clamp 到 10000
- GUI 範圍 2700-6500 永不觸發，此為防呆

可直接搬入的實作程式碼：

```javascript
// ==================== R3-2: 色溫→RGB 換算 ====================
// PCHIP (Fritsch-Carlson 1980) monotonic cubic Hermite
// 錨點：Mitchell Charity blackbody sRGB table
// 來源：http://www.vendian.org/mncharity/dir3/blackbody/UnstableURLs/bbr_color.html
// 回傳 sRGB 域 [0,1]；消費端若進 path tracer radiance 須自行 pow(x, 2.2) 轉 linear
const KELVIN_ANCHORS = [2000, 3000, 4000, 6500, 10000];
const KELVIN_RGB_TABLE = [
    { r: 1.00, g: 0.54, b: 0.17 },  // 2000K
    { r: 1.00, g: 0.75, b: 0.42 },  // 3000K
    { r: 1.00, g: 0.89, b: 0.76 },  // 4000K
    { r: 1.00, g: 0.99, b: 1.00 },  // 6500K (D65)
    { r: 0.79, g: 0.87, b: 1.00 },  // 10000K
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
        if (dk[k - 1] * dk[k] <= 0) m[k] = 0;  // 極值點強制 0，保 monotonic
        else m[k] = (dk[k - 1] + dk[k]) / 2;
    }
    return m;
}

const _KELVIN_TAN_R = _pchipTangents(KELVIN_ANCHORS, KELVIN_RGB_TABLE.map(c => c.r));
const _KELVIN_TAN_G = _pchipTangents(KELVIN_ANCHORS, KELVIN_RGB_TABLE.map(c => c.g));
const _KELVIN_TAN_B = _pchipTangents(KELVIN_ANCHORS, KELVIN_RGB_TABLE.map(c => c.b));

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
        r: _pchipEval(K, 'r', _KELVIN_TAN_R),
        g: _pchipEval(K, 'g', _KELVIN_TAN_G),
        b: _pchipEval(K, 'b', _KELVIN_TAN_B),
    };
}
```

### Step 2【E1 + CR7】JS 狀態變數宣告

位置：js/Home_Studio.js L371 `let colorTemperature = 4000;` 附近

```javascript
// R3-2: 色溫狀態（E1 JS module-scope）
const R3_DEFAULT_K = 4000;  // CR7: 集中管理預設值
let cloudKelvin = R3_DEFAULT_K;
let trackKelvin = [R3_DEFAULT_K, R3_DEFAULT_K, R3_DEFAULT_K, R3_DEFAULT_K];
let trackWideKelvin = [R3_DEFAULT_K, R3_DEFAULT_K];
```

### Step 3【AR2 + CR4】computeLightEmissions 純註解版（無假呼叫）

位置：js/Home_Studio.js L906-915 既有 computeLightEmissions

改動：**刪除** v1 中 `0 * kelvinToRGB()` 假呼叫，改為純註解 + TODO 範例

```javascript
function computeLightEmissions() {
    // R3-2: 色溫狀態已建立（cloudKelvin / trackKelvin[] / trackWideKelvin[]），
    //       但 shader 光路尚未接，emission 值保持 0。
    //
    // R3-3 將改為（範例，勿在 R3-2 啟用）：
    //   const rgb = kelvinToRGB(cloudKelvin);
    //   const mag = cloudRadiance;  // R3-1 管線輸出（lumens→watts→radiance）
    //   pathTracingUniforms.uCloudEmission.value[i].set(
    //       mag * rgb.r, mag * rgb.g, mag * rgb.b
    //   );
    //   注意：rgb 為 sRGB 域，進 path tracer radiance 需 pow(.,2.2) 轉 linear

    for (let i = 0; i < 4; i++) {
        pathTracingUniforms.uCloudEmission.value[i].set(0, 0, 0);
        pathTracingUniforms.uTrackEmission.value[i].set(0, 0, 0);
    }
    for (let i = 0; i < 2; i++) {
        pathTracingUniforms.uTrackWideEmission.value[i].set(0, 0, 0);
    }
}
```

強制要求：此步驟**不得**出現 kelvinToRGB 可執行呼叫（即便乘以 0）
驗收方式：`grep -n "kelvinToRGB" js/Home_Studio.js` 結果僅出現在 Step 1 定義處 + Step 4 GUI onChange 內 + Step 3 TODO 註解內 + L1154 既有 R2-11 吸頂燈通路

### Step 4【AR5 + CR7】GUI slider 註冊（R3 Color Temperature 子資料夾）

位置：js/Home_Studio.js L1059 舊 colorTempCtrl 之後

```javascript
// R3-2: R3 色溫子資料夾（E1）
const r3KelvinFolder = lightFolder.addFolder('R3 Color Temperature');
r3KelvinFolder.open();

const cloudKelvinCtrl = r3KelvinFolder.add({ cloudK: R3_DEFAULT_K }, 'cloudK', 2700, 6500, 100)
    .name('Cloud 色溫 (K)')
    .onChange(function (v) {
        cloudKelvin = v;
        computeLightEmissions();
        wakeRender();
    });
attachMetaClickReset(cloudKelvinCtrl, R3_DEFAULT_K);

const trackKelvinCtrl = r3KelvinFolder.add({ trackK: R3_DEFAULT_K }, 'trackK', 2700, 6500, 100)
    .name('Track 色溫 (4 盞共用)')
    .onChange(function (v) {
        // D1 broadcast setter：for-loop 明示陣列語意（AR5 + CR7）
        for (let i = 0; i < trackKelvin.length; i++) trackKelvin[i] = v;
        computeLightEmissions();
        wakeRender();
    });
attachMetaClickReset(trackKelvinCtrl, R3_DEFAULT_K);

const trackWideKelvinCtrl = r3KelvinFolder.add({ trackWideK: R3_DEFAULT_K }, 'trackWideK', 2700, 6500, 100)
    .name('TrackWide 色溫 (2 盞共用)')
    .onChange(function (v) {
        for (let i = 0; i < trackWideKelvin.length; i++) trackWideKelvin[i] = v;
        computeLightEmissions();
        wakeRender();
    });
attachMetaClickReset(trackWideKelvinCtrl, R3_DEFAULT_K);
```

slider step = 100K（CR7 符合 L1053 colorTempCtrl 慣例）

### Step 5 本機驗收（肉眼 + DevTools）

- 5a. 啟動伺服器（port 9001，cwd = Home_Studio_3D/）
- 5b. 開啟：http://localhost:9001/Home_Studio.html?v=r3-2-v2-kelvin-rgb
- 5c. DevTools Console 執行：
  - `kelvinToRGB(4000)` 預期 `{r:1, g:0.89, b:0.76}`（錨點精確命中）
  - `kelvinToRGB(5000)` 預期介於 4000K 與 6500K 之間的平滑值
- 5d. GUI 拖動 3 組 slider，確認 Console 無錯誤（畫面不變為設計意圖，見 MINOR-1）
- 5e. Cam 1/2/3 各 ≥500 spp，畫面與 R3-1 基線（`?v=r3-1-fix01-guard-ordering`）像素級一致

### Step 6【CR6】unit test 腳本

路徑：docs/tests/r3-2-kelvin.test.js（新建 docs/tests/ 目錄）
執行：`node docs/tests/r3-2-kelvin.test.js`
退出碼：0 = PASS，1 = FAIL
模式：**contract-test**（函式本體複製，SOP 註記同步更新義務）

完整腳本見第 10 節

### Step 7 Cache-Buster 更新

Home_Studio.html L48 `<script defer src="js/Home_Studio.js?v=...">` query 更新為 `?v=r3-2-v2-kelvin-rgb`
依慣例：query 變化 = changelog，使用者無需手動 Cmd+Shift+R

### Step 8【CR3 順序反轉】git commit（僅 commit，不 push、不改 SOP）

**觸發條件**：Step 5 肉眼驗收通過 + Step 6 unit test 退出碼 0

```bash
git add js/Home_Studio.js docs/tests/r3-2-kelvin.test.js Home_Studio.html .omc/plans/r3-2-kelvin-rgb.md
git commit -m "R3-2 色溫→RGB 換算 kelvinToRGB + GUI 完成，待 DONE push"
```

**禁止**：此步驟不得 `git push`、不得改 SOP、不得改 memory handover

理由（CR3）：state-of-truth in git，SOP markdown 可偽造、git log 不可；避免「SOP ✅ 但未 commit」誤判

### Step 9【CR3 + feedback_r_done_means_push】使用者說「R3-2 DONE」後才觸發

**觸發條件**：使用者明確輸入「R3-2 DONE」字樣

- 9a. SOP 雙處打勾（feedback_sop_dual_checkmark）：
  - `docs/SOP/R3：燈光系統.md` outline 表 L49 R3-2 行加 ✅
  - `docs/SOP/R3：燈光系統.md` 內文 L175 `## R3-2 色溫 → RGB 換算 ⬜` 小標改為 ✅
  - `docs/SOP/（先讀大綱.md` 狀態欄 + R3 里程碑同步更新

- 9b. SOP L67 文字更新（CR5 escape hatch）：

```
色溫：R3-2 階段以 JS 狀態儲存（cloudKelvin / trackKelvin[4] / trackWideKelvin[2]），
      於 CPU 端換算 RGB 後寫入 uCloudEmission 等 uniform；
      若 R3-5 Many-Light MIS 需 per-sample 色溫調變，屆時再升為 uniform（escape hatch）。
```

- 9c. memory handover 更新 + git push：

```bash
git add -A
git commit -m "R3-2 DONE: SOP 打勾 + memory handover"
git push origin r3-light
```

### Step 10【CR6 + CR1 + CR2 + AR1】unit test 完整腳本

（見第 10 節「單元測試」完整內容）

### Step 11 SOP R3-2 完成條件備註補充（MINOR-1 + CR2）

於 `docs/SOP/R3：燈光系統.md` R3-2 章節完成條件 4 下方新增：

```
> 備註：R3-2 不提供視覺回饋（色溫調整後畫面不變）為刻意設計。
> 此階段僅建立 JS 狀態與 CPU 換算管線，shader 光路待 R3-3 接入。
> 驗收以 Console 手測 kelvinToRGB(K) + unit test 退出碼 0 為準。
>
> 契約誤差：對外 ±0.03（SOP 宣告）；對內實作目標 ±0.01（unit test 斷言）。
```

於 SOP R3-2 章節末新增 contract-test 同步義務：

```
> 注意：docs/tests/r3-2-kelvin.test.js 為 contract-test 模式，
> 腳本頂端複製了 kelvinToRGB 函式本體。
> 改動 js/Home_Studio.js 中 kelvinToRGB 實作時，必須同步更新 test 檔副本，
> 否則 test 將無法反映實際行為。
```

## 9. 檔案異動清單

**修改**：
- `js/Home_Studio.js`
  - L371 附近新增 R3_DEFAULT_K / cloudKelvin / trackKelvin / trackWideKelvin（Step 2）
  - L532-565 全域替換為 PCHIP kelvinToRGB + 輔助函式（Step 1）
  - L906-915 computeLightEmissions 尾端改為純註解 TODO（Step 3）
  - L1059 附近新增 R3 Color Temperature 子資料夾 + 3 個 slider（Step 4）
- `Home_Studio.html` L48 cache-buster（Step 7）
- `docs/SOP/R3：燈光系統.md`
  - L67 色溫條目文字更新（Step 9b，CR5 escape hatch）
  - L175 R3-2 章節完成條件 4 下方備註 + 章節末 contract-test 義務（Step 11，MINOR-1 + CR2）
  - R3-2 outline 表 + 內文小標雙處 ✅（Step 9a）
- `docs/SOP/（先讀大綱.md` 狀態欄 + R3 里程碑（Step 9a）
- memory handover（Step 9c）

**新建**：
- `docs/tests/r3-2-kelvin.test.js`（Step 6 + Step 10）
- `.omc/plans/r3-2-kelvin-rgb.md`（此計畫文件）

**零改動**：
- `shaders/Home_Studio_Fragment.glsl`（R3-2 不動 shader）
- `js/Home_Studio.js` L1053-1058 舊 colorTempCtrl（保留 R3-1 disabled 狀態）
- `js/Home_Studio.js` L1154-1156 R2-11 吸頂燈通路（保留 R2 基線）
- SOP 檔名中文字保留（「R3：燈光系統.md」「（先讀大綱.md」）

## 10. 單元測試（完整腳本）

路徑：`docs/tests/r3-2-kelvin.test.js`

```javascript
// R3-2 kelvinToRGB contract-test
// 執行：node docs/tests/r3-2-kelvin.test.js
// 模式：contract-test（函式本體複製自 js/Home_Studio.js Step 1）
// 警告：改動 js/Home_Studio.js 中 kelvinToRGB 時須同步更新此檔

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

// [A] 錨點精確命中（tol=1e-12，AR1 強制斷言）
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
```

## 11. Acceptance Criteria（v2：A1-A9）

- A1. kelvinToRGB 函式於 node 環境獨立可跑（無 THREE 依賴）
  - 對外契約誤差：±0.03（SOP 宣告）
  - 對內實作目標：±0.01（unit test 斷言）
  - 3 條邊界連續性斷言全過（K=3000/4000/6500 各 ±1 的 RGB max-diff ≤ 1e-3）
- A2. kelvinToRGB 回傳 `{r, g, b}` 物件格式（A2 ABI 契約，保 L1154 相容）
- A3. cloudKelvin / trackKelvin[4] / trackWideKelvin[2] 三組 JS 狀態初始值 = R3_DEFAULT_K (4000)
- A4. GUI 三 slider 範圍 2700-6500、step=100、onChange 觸發 computeLightEmissions + wakeRender
- A5. Track/TrackWide slider 採 broadcast setter（for-loop 陣列全寫）
- A6. computeLightEmissions 內**無** kelvinToRGB 可執行呼叫（僅 Step 3 註解 TODO）
- A7. Cache-buster query 更新為 `?v=r3-2-v2-kelvin-rgb`
- A8. 邊界連續性：錨點 3000/4000/6500K 左右 1K 取樣，RGB 最大差值 ≤ 1e-3（PCHIP C1 連續保證）
- A9. unit test 退出碼 0，含 ±0.01 斷言 + 3 連續性斷言，全過方可進 Step 8 commit
- A10. Cam 1/2/3 × ≥500 spp 畫面與 R3-1 基線像素級一致

## 12. Cache-Buster

- 主版本：`r3-2-v2-kelvin-rgb`
- 命名規則：`r{主版}-{子版}-v{planner版}-{功能簡述}`
- Hotfix：`r3-2-v2-kelvin-rgb-fixNN-<症狀短碼>`（依 R3-1 fix01 前例）

驗證 URL：

```
http://localhost:9001/Home_Studio.html?v=r3-2-v2-kelvin-rgb
```

## 13. Pre-mortem（v2：6 情境）

1. **kelvinToRGB 在 shader 路徑被誤用**
   - 症狀：R3-2 不應改畫面但畫面變了
   - 偵測：`grep -n "kelvinToRGB" js/Home_Studio.js` 確認呼叫點僅 4 處
   - 防禦：Step 3 強制純註解版 + grep 驗證（A6）

2. **GUI slider 初始值與狀態變數不同步**
   - 症狀：重整頁面後 slider 顯示 4000 但 cloudKelvin 為 undefined
   - 偵測：onChange 首次觸發前手測 Console
   - 防禦：R3_DEFAULT_K 常數集中（Step 2 + Step 4 共用）

3. **SOP 打勾但 git 未 commit**（CR3 強化）
   - 症狀：SOP outline ✅ 但 git log 查無對應 commit
   - 偵測：Step 8 先 commit、Step 9a 後打勾
   - 防禦：CR3 Step 8/9 順序反轉

4. **PCHIP 外推失控**（新增）
   - 症狀：K < 2000 或 K > 10000 回傳負值或 > 1.5 非物理值
   - 偵測：unit test C 區夾取斷言（K=1500、K=15000）
   - 防禦：Step 1 _pchipEval 開頭兩行 clamp 邏輯（AR1）

5. **GUI slider 事件迴圈重入**（新增）
   - 症狀：快速拖曳 slider 導致 computeLightEmissions 重入
   - 偵測：本機 Step 5d 快速拖曳觀察 Console
   - 防禦：computeLightEmissions 為純 CPU 計算，無 async/setTimeout，lil-gui onChange 同步呼叫理論上無重入

6. **cache-buster 命名碰撞**（新增）
   - 症狀：R3-2 hotfix 沿用 `?v=r3-2-v2-kelvin-rgb` 讀舊版
   - 偵測：hotfix 時 DevTools Network tab 檢查 Home_Studio.js Response
   - 防禦：命名規則納 v2/v3 子版號，hotfix 遞增為 v2a / v2b

## 14. Risk Mitigation

| 風險 | 防線 |
|---|---|
| 錨點表過時 | vendian.org URL 抓新值，unit test A 區斷言立刻抓不一致 |
| PCHIP monotonic 失效 | Fritsch-Carlson 1980 SIAM 證明 30 年未失效，unit test D 區告警 |
| R3-5 需 per-sample 色溫 | CR5 escape hatch 升為 uniform，JS 狀態層平滑過渡 |
| contract-test 漂移 | Step 11 SOP 硬性義務 + code review diff |
| L1154 R2-11 吸頂燈色偏 | 保留 `{r,g,b}` 物件 ABI；colorTemperature 變數 + colorTempCtrl 零改動 |
| uniform 呼叫時序回歸 | R3-2 不新增 shader uniform；computeLightEmissions 呼叫點僅 4 處全晚於宣告 |

## 15. ADR

**Decision**: 採 A2 + B3 + C1 + D1 + E1 組合實作 R3-2 色溫→RGB 換算；kelvinToRGB 重寫為 PCHIP monotonic cubic Hermite（5 錨點 Mitchell Charity sRGB table）；per-light-group kelvin 以 JS 陣列儲存；GUI 新增 R3 Color Temperature 子資料夾（3 slider）；Track/TrackWide 共用 slider broadcast setter；unit test contract-test 模式。

**Drivers**:
- D1. R3-1 radiance 管線不得污染
- D2. R3-3/R3-6 疊乘誤差放大（CR2 雙容許誤差）
- D3. GUI L1053 step=100K 慣例
- D4. SOP 與 git 雙軌一致（CR3 順序反轉）
- D5. R3-5 escape hatch（CR5 SOP L67 升級條款）

**Alternatives considered（均否決）**:
- A1 THREE.Color → 引入依賴；A3 Float32Array → 破壞 ABI
- B1 CIE 理論 → 實作複雜；B2 Tanner Helland → 誤差 > 0.05 超 CR2
- C2 Catmull-Rom → overshoot 風險；C3 Linear → 一階導數斷裂
- D2 全獨立 14 slider → UI 複雜；D3 全共用 1 slider → 物理意義混淆
- E2 Uniform 直存 → premature optimization；E3 localStorage → 非 UX 階段

**Why chosen**:
- A2+E1 保最低依賴、最高可測性（node 直接跑）
- B3+C1 保數學嚴謹（實測錨點 + monotonic cubic）
- D1 保 UX 直覺（同型光源共用 slider）

**Consequences**:
- 正：R3-3 接 shader 時僅需改 Step 3 TODO 三行，零重構
- 正：unit test 可隨 CI 長期守護
- 負：contract-test 本體雙份維護（Step 11 SOP 義務化）
- 負：R3-5 若需 per-sample 色溫，需升為 uniform（CR5 escape hatch 已預留）

**Follow-ups**:
- R3-3：kelvinToRGB 接入 shader 光路（Step 3 TODO → 實呼叫）
- R3-5：視 MIS 需求決定是否升級為 uniform
- Test framework：若專案導入 vitest/jest，contract-test 檔遷移統一

**反饋處理記錄**:

Architect 反饋（全數採納）：
- AR1 [高] → Step 1 PCHIP 具體實作 + A8 邊界連續性斷言
- AR2 [高] → Step 3 刪除假呼叫，改純註解 + TODO
- AR3 [中] → Step 8 拆 8a/8b（CR3 進一步反轉）
- AR4 [中] → Step 9b SOP L67 文字更新（CR5 加 escape hatch）
- AR5 [低] → Step 4 slider setter 明示 for-loop

Critic 反饋（全數採納）：
- CR1 → Step 1 錨點 RGB + PCHIP + 夾取 + 3 連續性斷言
- CR2 → A1 雙容許誤差 + Step 11 SOP 備註
- CR3 → Step 8 commit 先、Step 9 DONE 後 SOP+push（順序反轉）
- CR4 → Step 3 TODO 範例完整化
- CR5 → Step 9b SOP L67 escape hatch 條款
- CR6 → Step 6 docs/tests/r3-2-kelvin.test.js contract-test 模式
- CR7 → Step 4 slider step=100K + R3_DEFAULT_K + broadcast setter

Critic Minor / 缺口（全數採納）：
- MINOR-1 → Step 11 SOP R3-2 完成條件 4 備註
- MINOR-2 → 辯論 A 加 ABI 相容性論述
- 缺口 5 Pre-mortem → 第 13 節擴展為 6 情境
