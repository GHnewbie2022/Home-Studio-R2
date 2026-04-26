# R6：渲染效能優化（BVH 加速 + 後處理降噪）

> 2026-04-26 重寫：合併 R5-0 撤回後的「後處理降噪」階段。原 R6 = BVH 加速（從未執行），現擴充為「渲染效能優化」涵蓋兩條主線：
>   1. **BVH 加速**（既有目標）：改善 SceneIntersect 求交效能
>   2. **後處理降噪**（R5-0 撤回後新增）：用後處理改善 C3 / C4 朝外光源的視覺乾淨度
>
> 兩條主線可獨立進行，建議「後處理降噪」優先（短期 ROI 高）、BVH 加速延後（既有 SceneIntersect 已可接受）。

---

## 🚨 接手第一步（不得跳過）

依序讀：

```
1. docs/SOP/R5：Cloud光源重構.md §R5-Z 結論段（理解為何走後處理降噪而非減光源）
2. docs/SOP/Debug_Log.md 開頭通用 Debug 紀律三條
3. memory feedback_pathtracing_clamp_bandaid_masks_root_cause.md（後處理降噪 ≠ 治根，必先區分）
```

---

## 主線 1：後處理降噪（優先）

### 動機

C3（4 燈條）/ C4（軌道+廣角燈）/ R5-Z 撤回後保留的所有「朝外光源」config，物理上 NEE 採樣多半浪費（cosLight ≈ 0），收斂變異大。靠採樣端解決需大改架構（path guiding / ReSTIR）成本高。**後處理降噪**屬於低成本高效益路徑。

### 階段索引

```
階段 1：雙邊濾波後處理降噪
  狀態：ralplan 三輪共識 APPROVED 2026-04-26（工時 3.4 工作天）
  完整 SOP：docs/SOP/R6-1：雙邊濾波後處理降噪.md
  待 ultrawork 啟動

階段 2（中期，1~2 週）：時序累積 reproject + path guiding 簡化版
  已有時序累積（cameraSwitchFrames），加上 motion vector reproject
  對 C3/C4 朝外光源特別有效
  增記憶體、相機移動時需 reset 累積
  評估時機：階段 1 完工驗收後

階段 3（長期，重大投資）：OIDN AI 降噪
  接 NVIDIA OIDN 或 Intel Open Image Denoise
  業界最佳效果
  需架接 WASM / backend；erichlof 框架需動
  評估時機：階段 1 + 2 完成後若仍不滿意才上
```

### 階段 1 摘要（完整見 R6-1 SOP）

```
方案：方案 C — 並排 PostDenoise pass（不取代既有 walk denoiser）
拓撲：pathTracing → screenCopy → PostDenoise → ScreenOutput
   執行域 HDR-linear per-sample（× uOneOverSampleCounter 之後）
   Bloom 不享降噪（C-1 案 a；Karis 13-tap 自帶 firefly 抑制）

關鍵取捨
   C-1  Bloom 不共享降噪通路，省同步點維護債
   C-2  toggle 與 config 切換行為分離：toggle 不清累積、config 必清累積
   C-3  邊緣 pixel 對稱 / N 寫法，浮點誤差 < 1e-7 vs 驗收門檻 1e-4 三數量級安全邊

工時 3.4 工作天 < 3.5 上限，5 月底前可完工
```

### 守門禁忌（4 條，本主線整體紀律）

```
1. 嚴禁把降噪當「治螢火蟲」用：螢火蟲的根因是 NEE 採樣變異，後處理只是症狀治療
   memory feedback_pathtracing_clamp_bandaid_masks_root_cause.md 同樣適用降噪
   若發現 ralph 又出現 fix0X 系列「螢火蟲變多」必先回頭查 NEE 端公式

2. 嚴禁讓降噪參數依「視覺感知」調整：
   雙邊濾波 sigma_color/sigma_space 應有物理意義（影像 noise SNR）
   不可為了肉眼好看而盲調
   階段 1 SOP §F 已提供 sigma per-config 物理推導表

3. 嚴禁全 config 套同樣降噪參數：
   C1/C2 已乾淨，套強濾波會吃細節
   C3/C4 髒，需強濾波
   階段 1 SOP §F.6 表已分 C1/C2/C3/C4 四檔

4. 嚴禁刪掉 path tracer 輸出對照：
   GUI toggle 隨時關掉降噪看原圖，避免誤把治症當治根
   階段 1 採方案 C 並排 pass，toggle off 由 RT 指向切換還原（不動 shader）
```

---

## 主線 2：BVH 加速（延後）

> ⚠ **2026-04-26 審視紀錄：本段與現況不符，待重新盤點**
>
> 撰寫原 R6 SOP 時假設「BVH 從未執行、shader 仍是線性求交」。實際 grep 現況：
>
> 1. **BVH 已是 LIVE 程式碼**（不是延後評估）
>    `shaders/Home_Studio_Fragment.glsl` line 7-8 有 `tBVHTexture` uniform，
>    line 564 `fetchBVHNode` 函式，line 674 註解 `// 2) BVH traversal for boxes`，
>    line 688 實際呼叫。求交路徑早就是 BVH，不是線性掃描。
>
> 2. **builder 檔名不符**
>    SOP 列 `BVH_Acc_Structure_Iterative_Builder.js` + `_Iterative_Fast_Builder.js`。
>    實際 `js/` 內存在 `_Iterative_Fast_Builder.js` + `_Iterative_SAH_Builder.js`。
>    （沒有 `Iterative_Builder.js`，多一個 `SAH_Builder`）
>
> 3. **sceneBoxes 數量估值需重算**
>    SOP 寫「~85 個」，實測 addBox 呼叫 79 處（複合家具多次 push，動態總數需算）。
>    既然 BVH 已 LIVE，原「O(N) 線性可接受」前提整個失效。
>
> 4. **「從舊專案搬運」整段過時**
>    所列「缺 shader traversal、缺 tBVHTexture sampler」與實際相反。
>    `buildBVHNode` / `flattenBVH` / `updateBVH` 在 `js/Home_Studio.js` 端的整合度
>    尚未驗證，待重新盤點。
>
> **下一步**：階段 1 雙邊濾波（主線 1）完工後，重新審視本段並改寫，
> 可能方向：BVH 既已就位 → 主線 2 改為「BVH 結構優化／品質升級」而非「從零導入」。
> 期間若需動到 BVH 的任何決策，必先 grep 現況再判斷，禁用本段過時前提。

### 動機

當前 `SceneIntersect` 對所有 sceneBoxes 線性求交。box 數量 ~85 個，O(N) 求交對 fragment shader 可接受。但若未來：
- 加入更多家具細節（>200 boxes）
- 加入三角網格資產（千萬級面）

則需 BVH 樹型加速結構降到 O(log N)。

### 從舊專案搬運

```
1. js/BVH_Acc_Structure_Iterative_Builder.js 已存在（建構器）
2. js/BVH_Acc_Structure_Iterative_Fast_Builder.js 已存在
3. 缺：buildBVHNode / flattenBVH / updateBVH 整合到 sceneBoxes 工作流
4. 缺：BVH texture 與 data 管理（uBVHTexture sampler 等）
5. 缺：shader 端 BVH traversal 程式碼（取代當前 SceneIntersect 的 line scan）
```

### 評估時機

```
1. 完成「主線 1 後處理降噪」階段 1 + 2 後評估
2. 若 fragment shader 跑滿 60 fps 且 sceneBoxes < 200 → 不必加 BVH（複雜度不值）
3. 若加入新資產讓 fragment shader 掉到 < 30 fps → 考慮加 BVH
4. 若僅加部分 box（e.g. 細部家具）→ 考慮兩階段：粗 BVH（房間幾何）+ 細 BVH（家具）
```

---

## 整體階段順序建議

```
[現在] R5-Z 撤回完成

主線 1 階段 1 雙邊濾波後處理 ← 從這裡開始
主線 1 階段 1 驗證
   ↓ 滿意？
   是 → 繼續主線 1 階段 2 / 主線 2 評估
   否 → 進階段 2 / 評估 OIDN

主線 1 階段 2 時序累積 + path guiding
主線 2 BVH 加速（如必要）
主線 1 階段 3 OIDN（如必要）
```

---

## 不在範圍

```
1. R5 整面光板實驗（已撤回，見 R5：Cloud光源重構.md §R5-Z）
2. 任何「減光源加速降噪」相關提案（物理本質不行）
3. 改 emission 分布（per-segment cosine 加權等）：屬光源端，不屬效能端
4. UI 風格大改（R4 凍結）
```
