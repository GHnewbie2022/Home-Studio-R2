# R3-4 軌道投射燈真光源計畫（spot cone NEE，DELIBERATE / HIGH RISK）

> 角色：Planner（ralplan consensus 首棒）
> 階段：初版（待 Architect + Critic 審）
> 風險等級：DELIBERATE（踩 R3-3 五輪前車之鑑，emissive + NEE 架構交界點多）
> cache-buster 預留：`r3-4-track-spot-nee`（若改多輪，沿用 SOP 慣例加 `-fixNN-<desc>`）

---

## 1. RALPLAN-DR 摘要（審查前必見）

### 1.1 Principles（五條）

其一、**物件語義命名優於材質特徵**。軌道燈 emitter 圓柱必以 `TRACK_LIGHT`（或 `TRACK_SPOT`）獨立 hitType 承載，不得沿用 R2-14 之 `DIFF` 偽身；語義命名方能與 L1071 之軌道鋁槽 `TRACK`（box 本體）分家，阻斷跨類污染。此規係 Debug_Log.md 通用紀律規則二之直接應用。

其二、**emissive 分支禁以 uniform 當係數**。R3-3 fix01c 全白之禍源，正在於 `accumCol += uR3EmissionGate × Σemission` 之「uniform 作係數」寫法；gate 翻 1 秒即全 pixel 疊死。R3-4 新 emissive 路徑必採 runtime-impossible guard 或獨立 hitType-only branch，禁重蹈覆轍。

其三、**產品規格為唯一真值**。lumens（2000 lm 單盞）、beam（15°~60°）、emitter 面積（π × 0.03² ≈ 2.827e-3 m²）、色溫三檔（3000/4000/6000K），一切數字引自 `docs/R3_燈具產品規格.md` 第三節；嚴禁自揣抽象單位，亦嚴禁沿用舊專案 500 lm 預設（低估 4 倍）。

其四、**shader / JS 介面必有 assertion 守門**。R3-3 曾踩 `CLOUD_BOX_IDX_BASE` 註解 55 vs 實 71 之陷阱。R3-4 之 hitObjectID 編碼為 `objectCount + 400 + li`（li∈[0,3]），JS 側須設 `TRACK_LAMP_ID_BASE = 400` 常數並於 `computeLightEmissions()` 起首 assertion，若 shader uniform `uTrackLampIdBase` 與 JS 常數不一致即 throw，於開發期即斷。

其五、**MVP 先過線，MIS 留 R3-5**。R3-4 僅建 primary/specular emissive + 5 選 1 stochastic NEE（flat prior）；完整 multi-light power heuristic MIS、balance heuristic、indirectMul 歸一皆屬 R3-5/R3-6 範疇，此階段不動。

### 1.2 Decision Drivers（top 3）

其一、**與 R3-3 既有架構相容，降低回歸風險**。R3-3 之 Cloud 走「primary/specular emissive + 無專屬 NEE，NEE 仍用 quadLight[0]」路徑；R3-4 若偏離此模式，將逼 R3-5 MIS 同時對付兩套異構權重，工期爆炸。

其二、**變動面積可控，第一輪 integrate 可完成**。R3-3 翻五輪的半數禍根為「單輪塞太多」（fix01 / fix01b / fix01c / fix02 / fix03 漸進細分）。R3-4 目標為首輪 Cam 1/2/3 × 500 spp 可驗收，不追物理極致。

其三、**500 spp variance 門檻**。使用者常用 500 spp 做肉眼驗收；聚光燈 beam cone 立體角小（outer 半角 30° → 2π(1−cos 30°) ≈ 0.843 sr），若全賴 BSDF sampling 命中，4 盞合計 emitter 面積 0.0113 m² → BSDF-only 命中率 ~1%，500 spp × 1% ≈ 5 樣本/牆像素，variance 遠超可接受帶。此 driver 強制採「5 選 1 stochastic NEE」（Option A'），將 track 命中率拉至 100% / bounce，補足 variance 缺口；Option A（無專屬 NEE）降為 fallback。

### 1.3 Viable Options

#### Option A — 沿用 R3-3 MVP（emissive-only，無專屬 NEE）【fallback only】

> 定位：**僅作退路使用**。若 A' shader 翻車可退 A + 肉眼 Cam 3 1000 spp 驗收。

做法：新增 `#define TRACK_LIGHT 15`（避開 TRACK=13 與現行型別），SceneIntersect L636-655 emitter 圓柱改 `hitType = TRACK_LIGHT`、`hitEmission = uTrackEmission[li]`；CalculateRadiance 新增 branch：僅在 `bounceIsSpecular || sampleLight` 條件下做 `accumCol += mask × emission × spotFalloff` 後 `break`。NEE 仍沿用 L1065 之 `sampleQuadLight(x, nl, light, weight)`（吸頂燈 quadLight[0]），不增 shadow ray。

- Pros：
  - shader 改動最小（~30 行），與 R3-3 Cloud 架構一致
  - 不破 R3-5 MIS 介面（MIS 可在後階段統一重建 NEE 層）
  - 雙計風險低（emissive 只在 primary/specular，BSDF-indirect 不累加）
- Cons：
  - 聚光燈 beam cone 小，靠 BSDF sampling 命中機率低 → 牆面 GIK 光斑在 500 spp 下粒狀明顯
  - 間接漫射項仍靠 indirectMul=1.7 近似，physical correctness 留給 R3-6
  - 使用者肉眼驗收可能卡「光斑顆粒」迴歸，引發額外 fix 輪
- 預期畫質：Cam 1/2 可見光斑但顆粒（Cam 3 876 spp 以上方平滑），beam 邊緣 smoothstep 平滑

#### Option A' — Option A + 5 選 1 stochastic NEE（emitter center 點取）【recommended】

做法：Option A 之 emissive primary/specular 路徑全保留 + 於每 diffuse bounce 將原 `sampleQuadLight(x, nl, quadLight[0], weight)` 單源 NEE 改為「5 選 1 stochastic」：吸頂燈 quadLight[0] 1 盞 + 軌道投射燈 4 盞共 5 候選，`selectPdf = 1/5`；track 候選採「emitter center 點取」（`uTrackLampPos[li]` 為目標點），PDF 為 `selectPdf × 1 / (distance² × cos_light)`，衰減含 `smoothstep(uTrackBeamCos[li].y, uTrackBeamCos[li].x, cos_ax)`。**不做 disk 面採樣**，避開 Option B 之 disk PDF cos 項遺漏陷阱（見 pre-mortem §2 情境三）。每 diffuse bounce 單 shadow ray，保 R3-3 既有 NEE 通道數不膨脹。

- Pros：
  - 於 500 spp 下牆面光斑 variance 可接受（5 倍候選、單光源 sample budget 降為 1/5 但 track 專屬 shadow ray 保證命中率）
  - shader 改動中等（~50 行，相較 B 之 disk sampling 少一層 orthonormal basis）
  - 不破 R3-5 MIS 介面：5 候選 stochastic selector 本就是 power heuristic MIS 之特例（power=1 所有候選等權），R3-5 升級只換權重計算
- Cons：
  - 較 Option A 多一條 stochastic 分支邏輯，assertion 守門與 PDF 正確性須嚴驗
  - emitter center 點取屬「點光源」近似，近距離（<0.3 m）有輕微 bias；但 track 燈距牆 ≥ 1.5 m，bias 可忽略
  - selectPdf=1/5 屬 flat prior，若某盞 lumens 明顯大（目前 4 盞同 2000 lm，無此情形）會 suboptimal；R3-5 再修

**Rationale（強制專屬 NEE 之量化依據）**：
- emitter 面積 = 4 × π × 0.03² ≈ **0.0113 m²**（單盞 π × 0.03² ≈ 2.827e-3 m²，4 盞合計）
- beam 30° 半角立體角 = 2π(1 − cos 30°) ≈ **0.843 sr**（半球佔比 13.4%）
- BSDF-only 命中機率 ≈ 1%：牆面漫射 bounce 隨機射往 4π sr 中 emitter 方向之機率約 emitter solid angle / 2π ≈ 1%
- 500 spp × 1% 有效命中率 → **~5 樣本 / 牆像素**，variance 遠超可接受帶（經驗門檻 >20 樣本）
- 結論：非專屬 NEE shadow ray 不能在 500 spp 達 §3.3-1 通過門檻，故必採 A'（Option A 僅當 fallback）

#### Option A NEE 架構 shader 改法（§4.2 變更 11 落地錨）

每 diffuse bounce 取代既有單 quadLight NEE：
```glsl
// 原（L1065）：
// rayDirection = sampleQuadLight(x, nl, light, weight);

// A' 改為 5 選 1 stochastic（吸頂 1 + 軌道 4）
int neeIdx = int(floor(rand() * 5.0));       // 0..4
neeIdx = clamp(neeIdx, 0, 4);
float selectPdf = 1.0 / 5.0;
if (neeIdx == 0) {
    // 既有 quadLight[0] 吸頂燈路徑
    rayDirection = sampleQuadLight(x, nl, quadLight[0], weight);
    weight /= selectPdf;
} else {
    int li = neeIdx - 1;                     // 0..3 → 4 盞軌道燈
    vec3 target = uTrackLampPos[li];         // emitter center 點取
    vec3 toLight = target - x;
    float dist2 = dot(toLight, toLight);
    vec3 ldir = toLight / sqrt(dist2);
    float cos_light = max(0.0, dot(-ldir, uTrackLampDir[li]));
    float cos_ax = cos_light;                // center 點取時兩者同
    float falloff = smoothstep(uTrackBeamCos[li].y, uTrackBeamCos[li].x, cos_ax);
    vec3 emit = uTrackEmission[li] * falloff;
    weight = emit * max(0.0, dot(nl, ldir)) * cos_light / max(dist2, 1e-4);
    weight /= selectPdf;
    rayDirection = ldir;
}
mask *= weight * uLegacyGain;
sampleLight = TRUE;
continue;
```
> 落地原則：保留 `sampleLight = TRUE` 以接續 R3-3 既有 MIS 旗標；`selectPdf` 倒除確保 unbiased。shadow ray 實際遮擋判斷由 R3-3 既有 SceneIntersect 處理（TRACK_LIGHT 命中即 emitter 可見）。
>
> **weight 三項明細**：`cos_light` 為 emitter 出射方向餘弦（`dot(-ldir, uTrackLampDir[li])`），`dot(nl, ldir)` 為 shading point 入射餘弦，`dist2` 為平方距離。center 點取（point estimator）之點光源估計含 `L · cos_nl · cos_light / dist²` 三項；本 R3-4 階段屬此近似。R3-5 升為 disk area sampling 時須於分母額外除 emitter area（`π × 0.03² ≈ 2.827e-3 m²`）並調整 PDF，本層三項結構可直接延用。

#### Option B — 完整 spot cone NEE（shadow ray 專打 4 盞）

做法：Option A 之上 + 新 shader 函式 `sampleTrackSpotLight(x, nl, idx, out weight)`，每 diffuse bounce 在 quadLight[0] NEE 之外額外發 shadow ray 至 stochastic 選中之一盞軌道燈。PDF 含 emitter disk 面採樣（1 / emitterArea）× cos 項 × outer cone solid angle × smoothstep gating。NEE 抉擇分兩子選：

- B1：併跑（quadLight[0] + track stochastic，每 bounce 發兩 shadow ray，兩者獨立 unbiased estimator 平均）
- B2：stochastic 五選一（吸頂 1 + 軌道 4，selectPdf = 1/5），每 bounce 單 shadow ray

- Pros：
  - variance 收斂快，500 spp 光斑可接近 R3-5 水準
  - 物理正確（含 cos、distance²、emitter area PDF）
  - 為 R3-5 MIS 搭好 multi-light infrastructure
- Cons：
  - shader 複雜度升一階（新增 emitter disk sampling、orthonormal basis、solid angle PDF）
  - R3-3 已踩 5 輪，B 之變動面積 > R3-3 × 2，翻車機率高
  - disk emitter PDF 含 cos 項易漏（pre-mortem §2 情境 3）
  - 近距離 distance² → 0 可能 firefly，須 uEmissiveClamp 加碼
  - 首輪大機率要拆 fix01 / fix02 / fix03

#### Option C — 混合（emissive + 簡易 NEE，p-probability）

做法：Option A 基礎上加簡化 NEE：每 diffuse bounce 以機率 p 做 track stochastic NEE（p 預設 0.2），keep quadLight[0] NEE always。track NEE 採 emitter disk center（不做 disk 面採樣）+ cosine falloff + smoothstep，避開 B 之 PDF 陷阱。

- Pros：
  - variance 改善明顯（光斑顆粒比 A 改善 ~50%）
  - 複雜度介於 A / B 之間，shader 改動 ~60 行
  - p 為自由參數，R3-5 改 MIS 時可回收
- Cons：
  - 非嚴謹 unbiased estimator（emitter 當點光源而非面光源 → bias）
  - p 為 magic number，R3-5 MIS 重建時得砍掉重練
  - 能量守恆驗收困難（MVP 限制下使用者無法直覺判「是否對」）

### 1.4 推薦方案與 invalidation 說明

**推薦：Option A'（emissive + 5 選 1 stochastic NEE，emitter center 點取）**

理由：
1. 補足 Option A 之 variance 缺口（emitter 面積 0.0113 m² × beam 0.843 sr → BSDF-only 命中率 ~1%），使 500 spp 可達 §3.3-1 牆面光斑通過門檻
2. 不做 disk 面採樣，避開 Option B 之 PDF cos 項遺漏陷阱（pre-mortem §2 情境三）
3. 5 選 1 stochastic 為 R3-5 power heuristic MIS 之 flat prior 特例，升級路徑無痛
4. 若首輪 shader 實作翻車，可降階退 Option A（僅拆 NEE 分支，保留 emissive primary 路徑），不必全盤重寫

Option A 降為 fallback 理由：emitter 面積小 + beam 立體角小致 BSDF-only variance 遠超可接受帶；僅保留為 A' 翻車時之保底路徑（Cam 3 需拉 1000 spp 以上驗收）。

Option B 否決理由：變動面積過大，R3-3 踩 5 輪之教訓直接反證；disk 面採樣 PDF 與 MIS balance 應一次性在 R3-5 做，不在 R3-4 做半套。

Option C 否決理由：p-probability 屬 magic parameter，與 R3-5 power heuristic MIS 不相容；引入 bias 破壞 R3-3 既有 unbiased 結構；R3-5 重構時必砍，屬負工。

---

## 2. Pre-mortem（假設一週後回看 R3-4 失敗，四情境）

### 情境一：TRACK_LIGHT 新 hitType 未觸達 CalculateRadiance 對應分支，畫面出現未知材質黑斑

**可能成因**：新增 `#define TRACK_LIGHT 15` 於 shader 頂，SceneIntersect 改 hitType 寫入，但 CalculateRadiance 主 loop 只有 `LIGHT / DIFF / TRACK / OUTLET / ... / SPEC` 分支未加 `TRACK_LIGHT`。命中時 shader 落入預設行為（沿用 previousIntersecType 之殘值或走 miss path），畫面呈現黑斑或 banding。

**防呆**：
1. shader 改動後 `grep -n "hitType ==" shaders/Home_Studio_Fragment.glsl` 比對 SceneIntersect 寫入點 vs CalculateRadiance 分支，要求 1:1 完整覆蓋
2. CalculateRadiance 末端 `else { accumCol = vec3(1,0,1); break; }` debug sentinel（magenta 顯著），驗收通過後拆除
3. Code review 強制檢查：新 hitType 必同步出現於 SceneIntersect + CalculateRadiance

### 情境二：spotFalloff smoothstep 參數反向（outer/inner 順序錯），光束成反向遮罩

**可能成因**：GLSL `smoothstep(edge0, edge1, x)` 要求 edge0 < edge1 才正向，但 cos 函數單調遞減（角度越大 cos 越小）→ `cos(outer) < cos(inner)` 才正確。若誤寫 `smoothstep(cos(inner), cos(outer), dot(...))` 即遮罩反向，光束中心全黑、外環發光。R2-14 fix04 shadow 自遮蔽即此類正負號陷阱。

**防呆**：
1. 公式註解強制對照 SOP L403 原稿：`smoothstep(uTrackBeamCos.y, uTrackBeamCos.x, cos_ax)`，其中 `.y = cos(outer)`、`.x = cos(inner)`
2. JS 端 uniform 初始化嚴禁拆 .x / .y 分兩行寫入（整包 vec2 建構，減少手誤）
3. 單元測試 `docs/tests/r3-4-track-radiance.test.js`：給定 axis 對齊 ray（cos_ax = 1），falloff 必回傳 1.0；beam 外 ray（cos_ax = 0），falloff 必回傳 0.0

### 情境三：disk emitter 面 NEE PDF 遺漏 cos 項，近距離 emitter 能量 bias（僅 Option B/C 風險，但 A 沿用 quadLight[0] 若誤以 track radiance 替換亦會中招）

**可能成因**：即使採 Option A，若日後想把 track 寫入 `light` 變數替換 `ceilingLampQuad` 作 NEE 來源，會忘 Quad 面採樣 PDF 需乘 `cosθ_light / distance²`；emitter 本身面積小（2.827e-3 m²）導致能量爆增 100~1000 倍，畫面部分區域過曝（超過 uEmissiveClamp）→ 經 tonemap 後呈死白塊。

**防呆**：
1. Option A 嚴守「NEE 仍用 quadLight[0] = 吸頂燈」，不碰 `light` 變數
2. Option A' 採「emitter center 點取」而非 disk 面採樣，cos_light 項直接由 `dot(-ldir, uTrackLampDir[li])` 取得，PDF 無 emitter area 分母，規避此陷阱
3. shader 新增 `uTrackEmitterArea[4]` uniform（即 2.827e-3 m²），供 R3-5 MIS 時直接讀取，R3-4 設為 reserved（JS 寫入但 shader 不讀）
4. 若 A' 第一輪驗收 firefly 過重（近距離 distance² → 0），分拆 fix02 輪加 `dist2 = max(dist2, 1e-4)` 下限；不在 fix01 混做

### 情境四：Option A / A' 首輪牆面光斑樣本不足（系統性 variance 失效，非寫壞）

**成因**：
- emitter 面積 = 4 × π × 0.03² ≈ **0.0113 m²**
- beam 30° 半角立體角 = 2π(1 − cos 30°) ≈ **0.843 sr**（僅半球 13.4%）
- 500 spp × 1% BSDF 命中率 ≈ **5 樣本 / 牆像素**，variance 遠超可接受帶
- 即使程式碼全對，Option A 在 500 spp 亦無法使牆面光斑達 §3.3-1 通過門檻；Option A' 之 5 選 1 stochastic NEE 將 track 命中率強制拉至 100%（每 bounce 必發一條 shadow ray 至某 track 候選），variance 才可接受

**防呆**：
1. **事前量化估計**：本 plan 已於 §1.3 Option A' Rationale 節算出面積 × 立體角 × 命中率 × spp → 有效樣本數 ~5，主動預告 Option A 單走必敗；Architect / Critic 審核時要求驗證此計算
2. **事後若失敗直接退 fallback 選項**：A' 翻車退 A（觀察是否 shader 架構自身壞）；A 若同步失敗退 Option B（disk 面採樣 + MIS）。**嚴禁疊 fix 輪追調 lumens / uEmissiveClamp / smoothstep 參數**，該類調參僅在「架構正確、單一參數偏離」時有用，對 variance 系統性不足無效
3. 首輪若 Cam 3 500 spp 光斑不可見，先用「Cam 3 pinned 2000 spp」作對照：若 2000 spp 光斑浮現即確認為 variance 不足（非寫壞），直接切 Option；若 2000 spp 仍無光斑才查程式碼

---

## 3. 擴展測試計畫

### 3.1 Unit Tests

**新建檔**：`/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/tests/r3-4-track-radiance.test.js`

比照 R3-3 `r3-3-cloud-radiance.test.js` 格式，包含：

- 斷言 1：`lumenToCandela(2000, 60)` ≈ 2387.32 cd（全角 60°，查表對照產品規格 L79 之 1600 cd @ 60° 為下限估，2000 lm 理論值高於此）
- 斷言 2：`lumenToCandela(2000, 15)` ≈ ... 對照 4800 cd @ 15° 產品值
- 斷言 3：新函式 `computeTrackRadiance(lm, T_K, A_m2, beamFullDeg)`：
  - 輸入 (2000, 4000, 2.827e-3, 60) → 輸出 radiance scalar，≥ 0
  - 輸入 (0, 4000, 2.827e-3, 60) → 輸出 0（lm=0 守門）
  - 輸入 (2000, 4000, 0, 60) → 不得 NaN/Inf（emitterArea 底線 clamp 1e-8，承 R3-1 慣例）
- 斷言 4：smoothstep gate 端點：beam 正前方 cos_ax=1 回 1.0；beam 外 cos_ax=0 回 0.0；邊緣 cos_ax = cos((inner+outer)/2) 回 ≈ 0.5（±0.05）
- 斷言 5：色溫 RGB 一致性：`kelvinToRGB(3000) → 暖色 r>g>b`、`kelvinToRGB(6000) → 冷色 b>g>r`（R3-2 已測，本檔僅重驗 3000/4000/6000K 三錨點）
- 斷言 6：TRACK_LAMP_ID_BASE runtime 常數 === 400（JS ↔ shader 契約）

**執行方式**：沿用 R3-3 既有 node 執行 pattern（手動 `node docs/tests/r3-4-track-radiance.test.js` 或接 npm script）。

### 3.2 Integration Tests（瀏覽器 console / devtools）

- **GUI roundtrip**：
  1. 開 `http://localhost:9001/Home_Studio.html?v=r3-4-track-spot-nee`
  2. Console 執行 `pathTracingUniforms.uTrackEmission.value.map(v => [v.x, v.y, v.z])` 預期 4 組 non-zero vec3
  3. GUI 下拉「東西軌道燈」切「全暖」→ console 重跑上條，期望 4 組皆偏暖（r > b）
  4. 切「全冷」→ 期望 4 組偏冷（b > r）
  5. 切「北暖南冷」→ trackKelvin[0]=3000, [1]=3000, [2]=6000, [3]=6000，emission[0/1] 暖、[2/3] 冷
- **onChange hook 驗收**：於 L1188-1204 `trackColorCtrl.onChange` 尾端須補 `computeLightEmissions()`（目前僅 wakeRender）；不補則 uniform 永遠為 R3-3 initSceneData 時寫入之舊值
- **toggle 驗收**：勾銷 `uTrackLightEnabled`（Config 1/2）→ shader SceneIntersect L636-655 跳過 emitter 圓柱；畫面無軌道燈光斑；重勾（Config 3）即恢復
- **console.log 契約**：`computeLightEmissions` 末尾 console.log 必含 `trackKelvin`, `trackLumens`, `trackRadiance[0..3]`, `trackLampIdBase`（比照 R3-3 格式）

### 3.3 E2E Tests（肉眼驗收）

**矩陣**：Cam 1 × Cam 2 × Cam 3 × 三色溫（全暖/全自然/全冷）× 兩 enable 狀態（開/關）= 18 組截圖

**每組要求**：
- Cam 1（主視角）：≥ 500 spp
- Cam 2（俯視）：≥ 500 spp
- Cam 3（側視 / 近距）：≥ 500 spp
- 切換 `trackColorCtrl` 立即 wakeRender → SPP 歸零重累，無需手動 reload

**通過門檻**：
1. 牆面 GIK / 地板 / 家具可見 4 盞軌道燈形成之光斑（非 R2-14 emission=0 黑燈頭）

   > **Falsifiability 註解**：首輪若門檻 1 失敗，無光斑可能源自五類解讀，首輪**不先調參**，先切 Option 分析：
   > - a. Option 先天不適（Option A 之 BSDF-only variance 系統性不足 → 切 A' 或 B；見 §2 情境四）
   > - b. lumens 未到（`TRACK_LAMP_LUMENS_MAX` 被意外覆寫為 0 或 computeLightEmissions 未觸發 → console.log 驗 uTrackEmission 值）
   > - c. uEmissiveClamp 夾太低（預設 50 下仍夾死 emitter → 暫拉到 200 測試，確認後回調）
   > - d. beam 全角取值錯（§4.6 定 60°，若誤輸 120° 會讓 smoothstep 退化為恆 1 或反向 → grep `beamFullDeg` 比對）
   > - e. smoothstep 參數反（`.x / .y` 順序錯 → 中心黑、外環亮；見 §2 情境二防呆 3）
   > 五類須依序排除（a 先，e 最後），排除後才進第二輪。
2. 光斑邊緣 smoothstep 衰減自然，無硬邊、無環帶 artifact
3. 色溫三檔切換：全暖光斑偏橘紅、全自然近白、全冷偏藍白；目視可辨
4. 關燈（Config 1/2）畫面回歸 R2-17 黑燈頭基線，無殘留光斑
5. Cam 3 500 spp 無 firefly（uEmissiveClamp=50 可抑）；若出現則需 Clamp 降至 30 試
6. 光源本體（emitter 圓柱）不過曝（primary ray 直擊 emitter 須受 uEmissiveClamp 規範）

**不通過即拆 fix02**，非一次性繼續疊。

### 3.4 Observability（shader / JS log）

- shader 端：因 WebGL2 無 printf，改以「debug hitType colorize」sentinel：
  - 加 `uDebugHitType` uniform（0=關、1=將 TRACK_LIGHT 命中塗 magenta）；驗收後砍
- JS 端：
  - `computeLightEmissions` 末 console.log 全 trackKelvin / trackLumens / radiance 供第一時間校對
  - `uTrackLampIdBase` uniform（預設 `objectCount + 400`）寫入時 console.log，若與 JS 常數 `TRACK_LAMP_ID_BASE = 400` 不符則 throw `AssertionError`
- Tonemap 前抽樣：若出現全白疑似 R3-3 fix01c 回歸，立即執行：
  ```
  grep -n "accumCol +=" shaders/Home_Studio_Fragment.glsl
  ```
  全部寫入點盤點，比對新增分支是否誤用 `uR3EmissionGate × emission` pattern

---

## 4. 主計畫本文

### 4.1 目標檔案（絕對路徑 + 行號錨點）

- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/shaders/Home_Studio_Fragment.glsl`
  - L77：`uniform vec3 uTrackEmission[4];`（既存，R3-4 注值）
  - L86-87：`uTrackLampPos[4] / uTrackLampDir[4]`（既存，R3-4 消費）
  - L104：`#define TRACK 13`（現有，R3-4 新增 `#define TRACK_LIGHT 15` 緊跟）
  - L636-655：SceneIntersect 投射燈 emitter 圓柱分支（R3-4 改 hitType）
  - L1071-1101：`if (hitType == TRACK)` 軌道鋁槽 box 分支（R3-4 不動，強調區隔）
  - CalculateRadiance 新增 `if (hitType == TRACK_LIGHT)` 分支（約 L1101 後、OUTLET 前插入）
  - L1323-1333：DCE-proof sink（R3-4 不動；新增 uniform 不掛此 sink，改 hitType-only 路徑）
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/js/Home_Studio.js`
  - L403-413：`TRACK_MODE_K` / `trackKelvin[4]`（既存）
  - L950：`uTrackEmission` uniform 宣告（既存）
  - L966-977：`uTrackLampPos / uTrackLampDir` init（既存）
  - L1000-1023：`computeLightEmissions()`（R3-4 改寫 track 分支 0→實際值）
  - L1188-1204：`trackColorCtrl.onChange`（R3-4 補 `computeLightEmissions()` 呼叫）
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/tests/r3-4-track-radiance.test.js`（新建）
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R3：燈光系統.md`（R3-4 段 DONE 打勾 + 小標 ✅）
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md`（若翻車，加 R3-4 fix 紀錄段）
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/Home_Studio.html`（cache-buster query 從 `r3-3-fix03-inner-face-skip` 改 `r3-4-track-spot-nee`）

### 4.2 變更清單

#### 變更 1：shader 新增 `TRACK_LIGHT` 材質常數
- **做什麼**：L104 下方加 `#define TRACK_LIGHT 15`（避開 14 = CLOUD_LIGHT）
- **為何**：語義命名（Debug_Log 規則二），與 `TRACK = 13`（軌道鋁槽 box）分家
- **副作用**：無（新常數，不影響既有分支）

#### 變更 2：shader SceneIntersect 投射燈分支改 hitType
- **做什麼**：L648-652 之 `hitType = DIFF` 改 `hitType = TRACK_LIGHT`、`hitEmission = uTrackEmission[li]`、`hitColor = vec3(0)`、`hitRoughness = 1.0`、`hitMetalness = 0.0`（emitter 不走金屬分支）
- **L652 hitObjectID 雙源同步（必改）**：現行 `hitObjectID = float(objectCount + 400 + li);` 屬 hardcode 400；本 plan 引入 `uniform float uTrackLampIdBase` 與 JS `TRACK_LAMP_ID_BASE = 400` 對齊後，L652 必一併改寫為：
  ```glsl
  hitObjectID = float(objectCount) + uTrackLampIdBase + float(li);
  ```
  避免「JS 改 uniform 但 shader 仍讀 400」之雙源分歧（R3-3 `CLOUD_BOX_IDX_BASE` 註解 55 vs 實 71 之同型陷阱）。
- **為何**：讓 CalculateRadiance 能識別此為 emitter，而非漫射燈殼；hitColor=0 避免 BSDF 二次 mask
- **副作用**：R2-14 原「DIFF 白色外殼」視覺消失，R3-4 emitter 圓柱將自發光取代，為預期效果

#### 變更 3：shader 新增 `uTrackBeamCos[4]` uniform + 預設值 uniform
- **做什麼**：L88 附近新增 `uniform vec2 uTrackBeamCos[4];`（`.x = cos(inner_half)`、`.y = cos(outer_half)`）
- **為何**：供 CalculateRadiance 分支計算 smoothstep 邊界；per-lamp 獨立以利 R3-5 每燈獨立 beam
- **副作用**：新 uniform 宣告，JS 端須對應寫入

#### 變更 4：shader CalculateRadiance 新增 `TRACK_LIGHT` 分支
- **做什麼**：於 `if (hitType == OUTLET)` 之前插入：
  ```glsl
  if (hitType == TRACK_LIGHT)
  {
      // Option A：primary/specular 路徑累加 emission，BSDF-indirect 不重複計
      if (bounceIsSpecular || sampleLight)
      {
          int lampIdx = int(hitObjectID - float(objectCount) - uTrackLampIdBase + 0.5);
          lampIdx = clamp(lampIdx, 0, 3);
          vec3 dirToHit = normalize(rayDirection);  // ray 由相機射出
          // cos_ax = dot(-rayDir, lampAxis)，量測命中方向與燈軸夾角
          float cos_ax = dot(-dirToHit, uTrackLampDir[lampIdx]);
          float falloff = smoothstep(uTrackBeamCos[lampIdx].y, uTrackBeamCos[lampIdx].x, cos_ax);
          vec3 emit = uTrackEmission[lampIdx] * falloff;
          emit = min(emit, vec3(uEmissiveClamp));  // firefly clamp
          accumCol += mask * emit;
      }
      break;
  }
  ```
- **為何**：sole emissive 累加點，hitType-only branch，符合 Principle 其二（無 uniform 當係數，無 runtime 翻牌陷阱）
- **副作用**：`break` 終止此 ray path，符合 LIGHT 型語義；不觸發 BSDF 後續 bounce

#### 變更 5：JS 新增 `computeTrackRadiance` 函式
- **做什麼**：仿 R3-3 `computeCloudRadiance` 格式：
  ```javascript
  const TRACK_LAMP_EMITTER_AREA = Math.PI * 0.03 * 0.03;  // 2.827e-3 m²
  const TRACK_LAMP_LUMENS_MAX = 2000;  // 單盞最大
  const TRACK_BEAM_INNER_HALF_DEG = 15;  // inner 半角 15°（smoothstep 邊緣平滑起點 cos_inner）
  const TRACK_BEAM_OUTER_HALF_DEG = 30;  // outer 半角 30°（smoothstep 邊緣衰減終點 cos_outer）
  const TRACK_BEAM_FULL_DEG = TRACK_BEAM_OUTER_HALF_DEG * 2;  // 全角 = outer × 2 = 60°（= lumenToCandela 之 beamFullDeg 輸入）

  function computeTrackRadiance(lm, T_K, A_m2, beamFullDeg) {
      if (!Number.isFinite(lm) || lm <= 0) return 0;
      const cd = lumenToCandela(lm, beamFullDeg);
      return candelaToRadiance(cd, Math.max(A_m2, 1e-8));
  }
  ```
- **為何**：真值換算 single source；沿用 R3-1 已測函式
- **副作用**：新 export const 汙染 global namespace，但符合 R3-1 既有風格

#### 變更 6：JS `computeLightEmissions()` 改寫 track 分支
- **做什麼**：L1010 原 `pathTracingUniforms.uTrackEmission.value[i].set(0, 0, 0)` 改為：
  ```javascript
  for (let i = 0; i < 4; i++) {
      const trackSrgb = kelvinToRGB(trackKelvin[i]);
      const trackR = Math.pow(trackSrgb.r, 2.2);
      const trackG = Math.pow(trackSrgb.g, 2.2);
      const trackB = Math.pow(trackSrgb.b, 2.2);
      const trackRadiance = computeTrackRadiance(
          TRACK_LAMP_LUMENS_MAX,
          trackKelvin[i],
          TRACK_LAMP_EMITTER_AREA,
          TRACK_BEAM_OUTER_HALF_DEG * 2  // 全角 = outer × 2 = 60°（inner 半角 15°、outer 半角 30°、全角 60°）
      );
      pathTracingUniforms.uTrackEmission.value[i].set(
          trackRadiance * trackR,
          trackRadiance * trackG,
          trackRadiance * trackB
      );
  }
  ```
- **為何**：實際注入真光源 radiance
- **副作用**：SPP 歸零（wakeRender 由 onChange 觸發）

> **Beam 語義單一定案（依 Critic instruction 2）**：採「inner 半角 15°、outer 半角 30°、全角 = outer × 2 = 60°」為本 plan 唯一正規定義。理由：符合 GLSL `smoothstep(cos_outer, cos_inner, cos_ax)` 半角語義、落在產品 `Varilumi zoom range` upper 60°、與 `lumenToCandela(lm, 60)` 一致。
>
> 跨檔一致性註記（非本階段動手）：上游 SOP `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R3：燈光系統.md` L383-384 本自述矛盾（「outer 預設 30°（= 全角 60°）」之寫法與某些段落之「inner+outer=45°」歷史字句並存），本 plan 交付後由 executor 一併修 SOP 為此三行統一敘述：
> - `inner 半角 15°（smoothstep 邊緣平滑起點 cos_inner）`
> - `outer 半角 30°（smoothstep 邊緣衰減終點 cos_outer）`
> - `全角 = outer × 2 = 60°（= lumenToCandela 之 beamFullDeg 輸入）`

#### 變更 7：JS 新增 `uTrackBeamCos` uniform + init
- **做什麼**：L950 附近加 `pathTracingUniforms.uTrackBeamCos = { value: [V2(), V2(), V2(), V2()] }`；`computeLightEmissions()` 內為 4 盞同寫 `(cos(15°), cos(30°))`
- **為何**：shader smoothstep 邊界值由 JS 計（避免 GLSL 內呼叫 cos 浪費）
- **副作用**：新 uniform，shader 端須對應宣告

#### 變更 8：JS `trackColorCtrl.onChange` 補 `computeLightEmissions`
- **做什麼**：L1203 `wakeRender()` 之前加 `computeLightEmissions();`
- **為何**：dropdown 切換時 trackKelvin 已更新，但 R3-3 時段未接 track 分支故無此呼叫；R3-4 必補，否則 uniform 永停 initSceneData 寫入之舊值
- **副作用**：切換色溫即時反映於畫面（符合 SOP 完成條件 4）

#### 變更 9：HTML cache-buster
- **做什麼**：`Home_Studio.html` 內 `Home_Studio.js?v=...` query 改 `r3-4-spot-nee-stochastic`（避免舊命名 `r3-4-track-spot-nee` 語義失配 — NEE 實發 5 選 1 stochastic shadow ray 非僅 beam cone 標記）
- **為何**：強制瀏覽器重載新 JS；命名對齊 Option A' 之語義（stochastic NEE 而非單純「spot-nee」）
- **副作用**：SOP 定案格式 query 具意義後綴當 changelog

#### 變更 10：新建 unit test file
- **做什麼**：`docs/tests/r3-4-track-radiance.test.js`（見 §3.1）
- **為何**：契約測試防未來回歸
- **副作用**：無

#### 變更 11：shader `sampleQuadLight` 單源 NEE 改 5 選 1 stochastic（Option A' 落地）
- **做什麼**：shader `if (hitType == DIFF)` 分支 L1065 原
  ```glsl
  rayDirection = sampleQuadLight(x, nl, light, weight);
  mask *= weight * uLegacyGain;
  sampleLight = TRUE;
  continue;
  ```
  改寫為 §1.3 Option A' shader 改法節所載之 5 選 1 stochastic block：以 `rand()` 取 neeIdx ∈ [0,4]，`neeIdx == 0` 走既有 `sampleQuadLight(x, nl, quadLight[0], weight)`、`neeIdx ∈ [1,4]` 走 track emitter center 點取（含 smoothstep falloff + distance² + cos_light），`selectPdf = 1/5`，`weight /= selectPdf` 保 unbiased。
- **作用域**：僅 `hitType == DIFF` 分支 L1065 單處；`TRACK / OUTLET / CLOUD_LIGHT / TRACK_LIGHT` 分支內若有類似 NEE 呼叫亦須同步（grep `sampleQuadLight(x,` 掃盡改點）。
- **為何**：補 §1.3 Rationale 所載之 variance 缺口；R3-5 MIS 重構時將 selectPdf=1/5 flat prior 換為 power heuristic，本層結構可留。
- **R3-4 weight 項（center 點取三項）**：`weight = emit × cos_nl × cos_light / dist²`，其中 `cos_light = dot(-ldir, uTrackLampDir[li])`；本階段採 point estimator 近似。**R3-5 升 disk area sampling 之落地對應**：R3-5 時將 emitter 視為面光源，PDF 改為 `1 / emitterArea`，weight 分母須額外除 `emitterArea`（`π × 0.03² ≈ 2.827e-3 m²`），並於 emitter disk 面上隨機採樣取代 center 點取；本變更 11 之三項結構（cos_nl / cos_light / dist²）可直接延用，唯分母多一面積項。
- **副作用**：SPP 歸零；吸頂燈 NEE 採樣頻率由原 100% 降為 20%，但 quadLight[0] 面積大（~1 m²）+ 距離近，variance 餘裕大，實測預期無影響。若首輪驗收發現吸頂燈 variance 上升，可將 `selectPdf` 改為按 lumens 加權（吸頂燈 ~3000 lm 單算、軌道共 8000 lm 4 分） — 此為 fix02 範疇，不在 fix01 做。

### 4.3 Assertion 守門清單

比照 R3-3 之 `CLOUD_BOX_IDX_BASE = 71` assertion，R3-4 必於 `computeLightEmissions()` **起首第一行**採 **throw-first** 模式（非 short-circuit `if (x && ...)`，避免 uniform 未建時靜默通過）：

```javascript
const TRACK_LAMP_ID_BASE = 400;  // shader L652 hitObjectID 偏移基底

function computeLightEmissions() {
    // 第一層：uniform 存在性（throw-first，嚴禁 short-circuit）
    if (!pathTracingUniforms.uTrackLampIdBase) {
        throw new Error(
            'uTrackLampIdBase uniform missing — ' +
            'computeLightEmissions called before initSceneData uniform setup'
        );
    }
    // 第二層：值比對守門（JS ↔ shader 契約）
    if (pathTracingUniforms.uTrackLampIdBase.value !== TRACK_LAMP_ID_BASE) {
        throw new Error(
            '[R3-4] shader/JS TRACK_LAMP_ID_BASE mismatch: ' +
            pathTracingUniforms.uTrackLampIdBase.value + ' vs ' + TRACK_LAMP_ID_BASE
        );
    }
    // 第三層：4 盞 emission 向量非 NaN 斷言（寫入後末段執行）
    // ...（下略，見原 computeLightEmissions 本體）
    // 末段：
    for (let i = 0; i < 4; i++) {
        const v = pathTracingUniforms.uTrackEmission.value[i];
        if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
            throw new Error('[R3-4] uTrackEmission[' + i + '] NaN/Inf');
        }
    }
}
```

**為何採 throw-first 非 short-circuit**：R3-3 曾踩 `CLOUD_BOX_IDX_BASE` 註解 55 vs 實 71 之陷阱；若此處寫成 `if (pathTracingUniforms.uTrackLampIdBase && value !== ...)`，當 uniform 根本未建時條件為 false，整個斷言被 short-circuit 略過，錯誤蔓延至 shader，畫面翻車後才 debug。throw-first 在「uniform 缺失」與「uniform 值錯」兩情形皆必 throw，開發期立斷。

> 備註：shader 端 L652 現行 hardcode `400` 將於變更 2 改為 `uTrackLampIdBase`（見 §4.2 變更 2 L652 雙源同步段）。shader 端 CalculateRadiance `TRACK_LIGHT` 分支亦以 `int(hitObjectID - float(objectCount) - uTrackLampIdBase + 0.5)` 取 lampIdx（變更 4 所載），全流程無 400 hardcode。此升級使 400 這數字由 JS 側控制，符合 R3-3 `uCloudObjIdBase` 慣例。

### 4.4 DCE-proof 設計

R3-4 新 emissive branch **不受 `uR3EmissionGate` 影響**。理由：

1. gate 原為 R3-1 設計之「軟開關」，R3-3 fix02 之教訓是「gate 翻 1 瞬變全白」，故 gate 目前固定為 1.0 不再翻牌（改翻 runtime-impossible guard 保 DCE）
2. R3-4 之 TRACK_LIGHT 分支為 hitType-only branch：只在 emitter 被命中時才累加 emission，`uTrackEmission = 0` 時仍加 0（無害），`uTrackEmission ≠ 0` 時依 smoothstep 衰減後有界（受 uEmissiveClamp=50 夾取）
3. 若需關閉軌道燈貢獻，用既有 `uTrackLightEnabled = 0` toggle → SceneIntersect 直接 skip emitter 圓柱命中，CalculateRadiance 不觸發 TRACK_LIGHT 分支，能量自然歸零
4. L1323-1333 DCE-proof sink 不需擴充（uTrackEmission 已被 CalculateRadiance 讀取，GLSL compiler 不會 DCE）

### 4.5 NEE 架構決策

**採 Option A'（emissive + 5 選 1 stochastic NEE）**：

- **Emissive primary / specular 路徑**（沿用 Option A）：`TRACK_LIGHT` 分支為 emitter 命中終點，在 `bounceIsSpecular || sampleLight` gate 下累加 `mask × emission × spotFalloff` 後 `break`（見變更 4）
- **Diffuse NEE 路徑**（Option A' 新增）：`hitType == DIFF` 分支之 L1065 單源 NEE 改為 5 選 1 stochastic（`selectPdf = 1/5`），吸頂 quadLight[0] 1 盞 + 軌道 TRACK_LIGHT 4 盞共 5 候選（見變更 11）
  - `neeIdx == 0`：既有 `sampleQuadLight(x, nl, quadLight[0], weight)` 路徑
  - `neeIdx ∈ [1,4]`：track emitter center 點取 + distance² + cos_light + smoothstep（**不做 disk 面採樣**，避 §2 情境三陷阱）
  - `weight /= selectPdf` 保 unbiased；`sampleLight = TRUE` 接續 R3-3 既有 MIS 旗標
- **`bounceIsSpecular || sampleLight` gate** 沿用 R3-3 Cloud pattern：
  - `bounceIsSpecular = TRUE` 代表 primary ray 或純 specular path（NEE 未涵蓋）
  - `sampleLight = TRUE` 代表上一跳是 NEE shadow ray，hit emitter 為刻意事件
  - BSDF diffuse indirect 不直接累加 track emission（避與 NEE 雙計）；靠 NEE 路徑專打 emitter
- R3-5 MIS 時將 selectPdf=1/5 flat prior 換為 power heuristic（按 lumens 加權），`TRACK_LIGHT` hitType / `uTrackEmission` / `uTrackBeamCos` 皆可直接消費，無需拆除

### 4.6 Beam 參數來源（單一定案）

**本 plan 唯一正規定義（三行統一敘述）**：
- **inner 半角 15°**（smoothstep 邊緣平滑起點 cos_inner）
- **outer 半角 30°**（smoothstep 邊緣衰減終點 cos_outer）
- **全角 = outer × 2 = 60°**（= `lumenToCandela` 之 `beamFullDeg` 輸入，落產品 Varilumi zoom range upper）

初值：

```javascript
TRACK_BEAM_INNER_HALF_DEG = 15;  // 內半角
TRACK_BEAM_OUTER_HALF_DEG = 30;  // 外半角
TRACK_BEAM_FULL_DEG = TRACK_BEAM_OUTER_HALF_DEG * 2;  // 全角 60°（不是 inner+outer=45°）
uTrackBeamCos[i] = new THREE.Vector2(
    Math.cos(TRACK_BEAM_INNER_HALF_DEG * Math.PI / 180),  // .x = cos(15°) ≈ 0.9659
    Math.cos(TRACK_BEAM_OUTER_HALF_DEG * Math.PI / 180)   // .y = cos(30°) ≈ 0.8660
);
// 驗證 .x > .y（smoothstep 要求）
```

> **跨檔一致性註記**：上游 SOP `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R3：燈光系統.md` L383-384 本自述矛盾（「outer 30°（全角 60°）」與偶現之「inner+outer=45°」歷史字句並存），本 plan 交付後由 executor 一併修 SOP 為此三行統一敘述；本階段 plan 內變更 6 之註解已更新為「全角 = outer × 2 = 60°」與此段一致。
>
> 若使用者要「偏聚」（全角 30° 甚或 15°），留 R3-4 第二輪或 R3-5 加 beam slider，不在本階段動。

### 4.7 GUI 鉤點

- **既有 `trackColorCtrl.onChange`（L1188-1204）**：補 `computeLightEmissions();` 於 `wakeRender()` 前
- **新 GUI 控件**：R3-4 **不加** lumens slider、不加 beam slider。理由：
  - SOP 完成條件 5 寫「lumens 0 → 2000 連續滑動亮度線性變化」，但此屬物理驗收而非 GUI 驗收；可在 console 手動改 `TRACK_LAMP_LUMENS_MAX` 後 `computeLightEmissions()` 驗。GUI slider 列為可選，延後至 R3-6 GUI 總整理階段
  - beam slider 同理，當前 inner=15/outer=30 單值足以驗受；動態 beam 若要加，R3-5 MIS 時一併加
- 若使用者堅持第一輪即要 lumens slider（列為 Critic 可挑戰項），加於 L1203 之後：
  ```javascript
  trackLumensCtrl = lightFolder.add({ l: TRACK_LAMP_LUMENS_MAX }, 'l', 0, 2000, 50)
      .name('東西軌道燈 lm')
      .onChange(function (v) {
          // 4 盞同值；若要獨立，改 per-lamp slider
          TRACK_LAMP_LUMENS_CUR = v;
          computeLightEmissions();
          wakeRender();
      });
  ```

### 4.8 Cache-buster

- 首輪：**`r3-4-spot-nee-stochastic`**（由原 `r3-4-track-spot-nee` 改，避命名與內容語義失配 — NEE 實發 5 選 1 stochastic shadow ray，非僅 beam cone 標記）
- 若翻 fix 輪：`r3-4-spot-nee-stochastic-fix01-<主題>`（例：`fix01-emitter-hitType`、`fix02-falloff-sign`、`fix03-nee-selectpdf`），符合 R3-3 演進慣例

### 4.9 驗收流程（依 R3-3 教訓，首輪大整合，不拆太細）

1. **shader 改動一次到位 + grep 雙源檢查**：
   - `TRACK_LIGHT` 常數 + SceneIntersect hitType 改寫 + L652 改 `uTrackLampIdBase`（變更 2）+ CalculateRadiance 新分支（變更 4）+ diffuse NEE 改 5 選 1（變更 11）+ `uTrackBeamCos[4]` / `uTrackLampIdBase` uniform 宣告
   - **強制 grep 檢查**（兩條 grep 皆須 0 命中方進步驟 2）：
     ```
     grep -n "objectCount + 400" shaders/
     grep -nE "-\s*400\.0" shaders/
     ```
     第一條 grep 掃「正形式 hardcode」（`objectCount + 400`）；第二條 grep 掃「負形式 hardcode」（`- 400.0` 含空白、小數點），涵蓋 CalculateRadiance 分支 `hitObjectID - float(objectCount) - 400.0` 此類 false-negative 寫法——第一條 grep 對此形式漏抓。兩條**皆須 0 命中**，任一命中即表示雙源分歧未完全消除。
   - 同步建議 grep：
     ```
     grep -n "sampleQuadLight(x," shaders/Home_Studio_Fragment.glsl
     ```
     比對變更 11 作用域（DIFF 分支 L1065 必改；其他分支若有亦須改或明確豁免）。
2. **JS 改動一次到位**：`TRACK_LAMP_*` 常數 + `computeTrackRadiance` + `computeLightEmissions` 改寫 track 分支 + **起首 throw-first assertion**（§4.3）+ `uTrackBeamCos` / `uTrackLampIdBase` init + `trackColorCtrl.onChange` 補呼叫
3. **unit test 先跑**：`node docs/tests/r3-4-track-radiance.test.js` 全 PASS 方進第 4 步
4. **本地 integrate**：`http://localhost:9001/Home_Studio.html?v=r3-4-spot-nee-stochastic` 開啟 → Cam 1 × 500 spp 首輪目視
5. **三機位驗收**：Cam 1/2/3 × 500 spp × 三色溫（全暖/全自然/全冷）+ 關燈 toggle = 共 18+ 組截圖比對
   - 首輪若門檻 1 失敗，依 §3.3 falsifiability 註解五類解讀**依序排除**（先切 Option，最後才調參）
   - 全通過即宣告 DONE；未通過先分析 root cause，再決策「切 Option（A'→A→B）」或「拆 fix02 輪」

---

## 5. ADR 草案

### 5.1 Decision
採 **Option A'（emissive + 5 選 1 stochastic NEE）**，以 hitType = `TRACK_LIGHT` 獨立承載 4 盞投射燈 emitter，primary/specular 路徑累加 `emission × smoothstep(cos_outer, cos_inner, cos_ax)` 後 break；`hitType == DIFF` 分支 L1065 單源 NEE 改為 5 選 1 stochastic（吸頂 quadLight[0] + 軌道 TRACK_LIGHT × 4，selectPdf=1/5），track 候選採 emitter center 點取 + distance² + cos_light + smoothstep，**不做 disk 面採樣**。

### 5.2 Drivers
1. 與 R3-3 既有架構相容：emissive primary/specular 路徑對齊 Cloud pattern；stochastic NEE 為 R3-5 MIS 之 flat prior 特例，升級無痛
2. 變動面積可控（~70 行 shader + ~60 行 JS + 5 選 1 stochastic block ~25 行），首輪 integrate 可驗收
3. 500 spp 畫質達 §3.3-1 門檻：專屬 shadow ray 補 emitter 面積 0.0113 m² × beam 0.843 sr 導致之 BSDF-only 1% 命中率缺口

### 5.3 Alternatives considered
- **Option A（emissive-only，無專屬 NEE）**—— 降為 fallback：500 spp 下牆面光斑有效樣本 ~5（emitter 面積 × beam 立體角 × BSDF 命中率），variance 系統性不足；僅於 A' shader 翻車時退回，Cam 3 須拉至 1000 spp 以上驗收
- **Option B（完整 spot cone NEE，含 disk emitter 面採樣 + 5-light stochastic selection）**—— 否決：變動面積過大，R3-3 五輪教訓反證；disk PDF cos 項易漏（pre-mortem §2 情境三）；MIS balance 屬 R3-5 一次性重建之範疇
- **Option C（混合 emissive + p-probability 簡易 NEE）**—— 否決：magic parameter p 違 Principle 其三產品真值；R3-5 MIS 重建時必砍屬負工

### 5.4 Why chosen
- R3-3 相同 emissive 架構已過驗收（Cloud 漫射燈條 4 根）；R3-4 屬平行擴展 + 為聚光燈 beam cone variance 問題補 stochastic NEE
- 首輪 integrate 可完成，shader 改動仍在「一次整合不拆多輪」之 R3-3 五輪血訓可承受範圍
- 保留 R3-5 MIS 重建空間：TRACK_LIGHT hitType / uTrackEmission / uTrackBeamCos / 5 選 1 stochastic selector 皆可於 MIS 階段被 Multi-light power-heuristic sampler 消費，無需拆除
- A' 翻車有降階退路（Option A），非一條路走到黑

### 5.5 Consequences
- **正向**：500 spp 驗收通過機率高（估 A' 70% / A 40% / B 30%）、R3-5 重構時無技術債、shader 語義清晰
- **負向**：shader diffuse NEE 分支複雜度提高（新增 5 選 1 stochastic block ~25 行），assertion 守門與 PDF 正確性須嚴驗；emitter center 點取屬點光源近似，近距離（<0.3 m）有輕微 bias（但 track 距牆 ≥ 1.5 m，實務可忽略）
- **中性**：`uTrackBeamCos` / `uTrackLampIdBase` 為新 uniform，R3-5 可直接消費；selectPdf=1/5 flat prior 於 R3-5 MIS 換為 lumens 加權 power heuristic
- **新增 NEE 路徑**（Option A 原無此層）：`hitType == DIFF` 分支 L1065 由單源 `sampleQuadLight` 升為 5 選 1 stochastic 分流，每 diffuse bounce 仍單 shadow ray（通道數不膨脹），吸頂燈 NEE 採樣頻率由 100% 降為 20%。實測預期 quadLight[0] 大面積 + 近距離 variance 餘裕可吸收此下降；若首輪發現吸頂燈 variance 上升，fix02 改為 lumens 加權 selectPdf（屬可預見之一階調優，不是架構翻車）

### 5.6 Follow-ups
1. **R3-5**：Multi-light stochastic NEE + power heuristic MIS，重新校光斑 variance
2. **R3-6**：indirectMul 歸一評估；若 R3-5 MIS 到位，`uLegacyGain = 1.5` 與 `uIndirectMultiplier = 1.7` 皆可回 1.0 試試
3. **可選**：R3-4 驗收後若使用者要求 lumens / beam slider，開 R3-4.1 補 GUI
4. **可選**：TRACK_LIGHT 分支加 `uDebugHitType` sentinel（驗收後砍）協助未來 debug

---

## 6. 約束與邊界（此階段不做）

- **不做 MIS**：multi-light power heuristic、balance heuristic、inverse-variance weighting 皆屬 R3-5 範疇
- **不做 disk emitter 面採樣**：Option B 之 `sampleTrackSpotLight` 函式不建
- **不做 indirectMul 歸一**：`uIndirectMultiplier = 1.7` 保留，R3-6 處理
- **不做 uLegacyGain 歸一**：`uLegacyGain = 1.5` 保留，R3-6 與 indirectMul 耦合處理
- **不做 廣角燈（TrackWide）**：留 R3-5 一併處理（廣角燈半角 60° 與投射燈 30° 不同 beam，且 R3-5 會加 MIS 才一次做）
- **不加 lumens slider / beam slider**：列為可選，延後至 R3-6 GUI 整理
- **不動 quadLight[0] NEE 本體**：`sampleQuadLight(x, nl, quadLight[0], weight)` 函式簽名與內部實作不變；Option A' 僅在其外層包 5 選 1 stochastic selector，`neeIdx == 0` 時仍呼叫此函式本體，R3-5 MIS 時才換權重
- **不動 R3-3 Cloud 分支**：CLOUD_LIGHT 既有 emissive path 不改
- **不動 uR3EmissionGate 值**：維持 1.0，新 TRACK_LIGHT 分支繞過此 gate
- **不動 uEmissiveClamp 預設**：維持 50，除非首輪驗收出現 firefly

---

## 7. 交付清單

- 主計畫：本檔 `/Users/eajrockmacmini/Documents/Claude Code/.omc/plans/r3-4-track-spot.md`
- 本輪（iteration 1）由 Architect + Critic ITERATE，Planner 已依 Critic 5 條指令修訂：新增 Option A' 並升為推薦、beam 語義單一定案（全角 60° = outer × 2）、L652 hitObjectID 雙源同步、assertion throw-first、pre-mortem 第四情境 + §3.3 falsifiability 註解
- 下一棒：Architect / Critic 複審修訂版是否達共識，或進入 iteration 2
- 再下一棒：使用者確認 Option A'（或降階退 A / B）後方進 executor 實作
- Architect / Critic 審視重點：
  - §1.3 Option A' 之 5 選 1 stochastic NEE shader 改法（含 PDF 正確性、weight 無 NaN 分支）
  - §4.2 變更 11 之作用域（DIFF 分支 L1065 + grep `sampleQuadLight(x,` 其他改點）
  - §4.3 throw-first 兩層守門（uniform 存在 + 值比對）之順序與整合處（initSceneData 之後）
  - §4.6 與 §4.2 變更 6 beam 註解一致性（全角 60°，三行敘述）
  - §2 情境四之 fallback 切換策略（失敗不調參，直接切 Option）是否可操作
