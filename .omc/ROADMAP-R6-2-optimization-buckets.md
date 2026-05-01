# R6-2 優化方向桶分類（Y 擱置後的後續路徑地圖）

> 最後更新：2026-04-27
> 用途：Z 路徑（R6-2 結案）採用後，未來重新觸發優化時的參考清單
> 上層脈絡：`.omc/HANDOVER-R6-2.md` §候選路徑（X / Y / Z）
> 配對閱讀：`docs/SOP/R6：渲染優化.md` §86 分流規則 + 各 REPORT-*.md

---

## 為何要這份文件

R6-2 內部已有三次失敗（R6-1 撤回 / SAH -39% / leaf packing ≤ 1%），SOP §86 a+d 雙失敗使「BVH 結構優化整支可信度下降」。X 與 Y 的 ROI 都不正向，主推 Z 結案。

但「結案」不代表永遠不再優化——R3-8 採購擴張、廠商討論模式變化、未來框架升級都可能 trigger 再啟動。本文件按「啟動門檻 / ROI 不確定度」分五桶整理，避免下次接手再從零盤點。

---

## 桶 1：SOP §86 內未試項目（最近、但 ROI 不正向）

### b) BVH node packing（節點記憶體存取模式優化）

```
改動：BVH 樹節點資料的記憶體排列重打包
範圍：builder JS + fragment shader 兩端
風險：高
預期：a + d 已雙敗，估收穫上限 ≤ 5%
推薦：不進（除非桶 4 F2 三段 timer 量到 BVH traversal 占比 ≥ 30%）
```

### c) Stack-based → while-loop traversal（樹走訪邏輯改寫）

```
改動：fragment shader 的 BVH 走訪由「堆疊式」改「迴圈式」
範圍：fragment shader 重寫
風險：高（需 1024-spp 像素逐像素驗、視覺崩潰風險高）
預期：≤ 5%
工時：3~5 天
OMC：必須 ralplan 三輪共識
推薦：不進（即原 HANDOVER 路徑 X）
```

---

## 桶 2：SOP 未列、Path Tracing 通用優化方向

### 2-1. 自適應採樣 (Adaptive Sampling)

```
想法：噪點多的像素多打 ray、已乾淨的少打
實作：variance estimator + ray budget 動態分配
工時：3~5 天（演算法層）
風險：中
預期：對「螢火蟲區域」收斂效果好
備註：對廠商靜態討論場景幫助小，對動態鏡頭幫助大
```

### 2-2. Russian Roulette 路徑提早終結優化

```
想法：低貢獻 ray 提早砍斷，省 ray bounces
實作：throughput-based termination 加閾值調校
工時：1~2 天
風險：低
預期：≤ 10%
推薦：✅ 若要繼續優化，這是「桶 2 內最低風險」項目
```

### 2-3. ReSTIR (Reservoir Spatio-Temporal Importance Resampling)

```
想法：用「水塘抽樣」演算法在多光源場景下提升直接光採樣品質
實作：複雜（需 reservoir buffer + temporal reuse）
工時：2~3 週
風險：高
預期：對多光源（Cloud / 軌道燈）場景顯著
推薦：等 R3-8 採購擴張光源變多後再評估
```

### 2-4. Material BRDF 分支扁平化

```
想法：fragment shader 內材質 if-else 改 lookup table
工時：3~5 天
風險：中
預期：未知（Phase 1.0 沒拆 Material 占比，桶 4 F2 解開後才能評估）
推薦：先做 F2 才知道值不值
```

### 2-5. RGBA32F → RGBA16F 紋理格式

```
想法：boxData / BVH texture 半精度
風險：高（BVH 座標精度可能崩，BoxIntersect 反向風險）
推薦：不進（守門禁忌 2「不破壞 BVH traversal 正確性」）
```

---

## 桶 3：等場景變大才動（R3-8 採購 ≥ 200 box trigger）

這些是「78-box 太小所以失敗」的項目，box 變多收益翻轉：

### 3-1. 重跑 SAH builder

```
出處：Step 1 SAH rollback report §8 F2
觸發：sceneBoxes.length ≥ 200
理由：78-box 對 SAH 過度切分樹深；200+ box 可能反轉為快
預期動作：1 行 import 還原 + 4 個 5 秒量測 = 5 分鐘工程
```

### 3-2. 重跑 leaf fetch packing 探針

```
出處：Step 2 step0-noop report §8 F2
觸發：sceneBoxes.length ≥ 200
理由：box 多 → fetch 占比可能升 → packing 收益顯現
預期動作：依 plan v3 §D Step 0a 重做雙條件量測
```

### 3-3. BVH_TEX_W 從 512 升 1024

```
出處：Plan v3 §F Q6
觸發：sceneBoxes.length × 5 > 512（即 ≥ 103 box）
範圍：純擴容、不動演算法
風險：低
推薦：R3-8 採購階段獨立做、不混進 R6-2
```

---

## 桶 4：Phase 1.0 留下的待解 follow-up（小型技術債）

### 4-1. C3 異常：21% frame 跳過 ✅ 結案 2026-04-27

```
出處：REPORT-R6-2-Phase-1.0.md §5 + §8 F1
詳：.omc/REPORT-R6-2-bucket4-F1-conclusion.md

Root cause：啟動暫態（前 2 秒）瀏覽器 RAF 60Hz 跟 GPU 26ms/frame 不同步、
            被 InitCommon.js L877 60fps gate 擋下、穩態下 RAF 自動降到
            ~39Hz 後 frame-skip 完全消失

關鍵證據：
  - 5 秒 RAF instrumentation + 0.5 秒 sliding window
  - acc=0 frame 100% 對應 dtLR < 16.67ms（gate L877 條件）
  - moving=true / sw>0 全 trace 0 個 → cameraSwitchFrames 完全不是元凶
  - sliding window ratio 從 0.5 平滑爬到 1.0、明確 transient 模式

影響：
  - 穩態損失 ≈ 0%
  - 累積 1024 spp 影響 ≈ 2.9%（低於 ralplan +5% commit 門檻）
  - Phase 1.0 ratio 浮動 11% 解釋：量測 window 起點與 panel 切換的相對距離

Phase 2 三方案評估：
  方案 A：移除 60fps gate ❌（成本高、風險高、收益 ~3%）
  方案 B：暖機 ❌（cosmetic、無實質意義）
  方案 C：不修、修正 Phase 1.0 §5 描述 ✅ 採用

決策：不修
```

### 4-2. 三段佔比拆解（BVH / NEE / Material 各占 frame 多少 ms）⏸ 暫緩 2026-04-27

```
出處：REPORT-R6-2-Phase-1.0.md §1 量測項目 3 + §8 F2
方法（plan v3）：EXT_disjoint_timer_query_webgl2 + segment-mode uniform 差分法
                 Stage A probe (uniform branch) → Stage B Option 3 #ifdef N+1 build 升級
工時：原估 1~2 天

狀態：⏸ 暫緩（Step 0 fail-fast 觸發 2026-04-27）
詳：.omc/REPORT-R6-2-bucket4-F2-step0-noop.md
原因：
  - Stage A probe 1 處 if 分支已對 mode 0 拖慢 ≥ 1.24%（C2 高可信度）
  - 超過 plan v3 嚴格版「< 1% 合格」門檻
  - 13 處 if 加齊後拖慢必加倍 → 不可逆觸發升 Stage B
  - Stage B 工程量 +1.5~4 hr 投資不對齊「fast-skip」精神 + R6 內已四連敗
  - ralplan 三輪共識 ROI：~1 hr 程式碼 + 5 分鐘量測 → 節省 9~13 hr Stage A+B 工程

ralplan 過程紀錄（保留作體例參考）：
  .omc/plans/R6-2-bucket4-F2-timer-breakdown.md（v1→v2→v3 1545 行）
  .omc/plans/R6-2-bucket4-F2-architect-r1.md（5 致命 + 4 應修）
  .omc/plans/R6-2-bucket4-F2-architect-r2.md（APPROVE w/caveats）
  .omc/plans/R6-2-bucket4-F2-critic-r2.md（ITERATE，4 MAJOR + 5 MINOR）

觸發再啟動條件（follow-up）：
  - R3-8 採購擴張 sceneBoxes.length ≥ 200 box（box 多 → BVH/Material 占比結構性改變）
  - 或廠商討論模式從靜態 → 動態鏡頭（時序 reproject 動機回升、需先量三段）
  - 或 erichlof 框架升級 WebGPU（compute shader timestamp query 不必 uniform branch）

Stage B 升級路徑（Option 3 #ifdef N+1 build）保留為 follow-up F-F2-3
```

### 4-3. spectorJS GLSL→HLSL dump 看 ANGLE 編譯後實況

```
出處：Step 2 step0-noop report §8 F1
價值：搞清楚 a + d 為何雙敗的真正根因（A1 ANGLE auto-DCE vs A4 cache locality）
優先序：低（不影響推進）
推薦：閒暇做、列在桶 4 末
```

---

## 桶 5：跳出 R6 範圍（長期、現在不動）

### 5-1. WebGL2 → WebGPU compute shader 改寫

```
收益：可能 2~5×（compute shader 比 fragment shader 適合 path tracing）
工時：4~8 週（整個渲染管線重寫）
風險：很高（erichlof 框架不支援 WebGPU）
推薦：等下世代專案
```

### 5-2. 預烘焙 Light Cache / Photon Map

```
工時：2~3 週
風險：高（採購展示用途與烘焙模式衝突，相機要能自由轉）
推薦：不進
```

### 5-3. OIDN（Intel Open Image Denoise）

```
出處：R6 主線 1 階段 3
需要：WASM backend
推薦：等主線 1 階段 2 (reproject) 後評估
```

---

## 推薦排序（若 R6-2 結案後仍要繼續）

```
優先做（風險低、收穫保守）：★ 2026-04-27 修訂後
  桶 2 #2  ★ Russian Roulette 調校 — 風險最低的 path tracer 調優
    成本：1~2 天
    收益：≤ 10% spp/sec 提升

R3-8 觸發後做：
  桶 3 全部（場景變大才有意義，現在做沒意義）
  桶 4 F2 重評（box ≥ 200 後 BVH/Material 占比結構性改變、Stage A 可能翻盤）

需要 ralplan 共識且風險高，不主動做：
  桶 1 b/c
  桶 2 #1 / #3 / #4
  桶 5 全部

永久不進（違守門禁忌）：
  桶 2 #5（半精度紋理）

✅ 已完成：
  桶 4 F1  C3 21% frame 跳過 debug（root cause = 啟動暫態 RAF cadence + 60fps gate、不修）
    詳：.omc/REPORT-R6-2-bucket4-F1-conclusion.md

⏸ 暫緩（已嘗試、Step 0 fail-fast）：
  桶 4 F2  三段 timer 拆解（Stage A probe overhead ≥ 1.24% 失敗）
    詳：.omc/REPORT-R6-2-bucket4-F2-step0-noop.md
    Stage B (Option 3 #ifdef) 升級路徑列入 follow-up F-F2-3
```

---

## 觸發再啟動的條件（哪一條先發生就重評估）

```
A. R3-8 採購擴張 sceneBoxes.length ≥ 200
   → 自動觸發桶 3 全部、可能觸發桶 2 #3 (ReSTIR)

B. 廠商討論模式從「靜態看清單」變「動態鏡頭巡覽」
   → 主線 1 階段 2 (reproject) 動機回升，路徑 Y 重新評估

C. 1024-spp 牆鐘從 30 秒退化到 ≥ 60 秒（任何原因）
   → 桶 4 F2 立即啟動，依 timer 結果分流

D. erichlof 框架升級或換 WebGPU backend
   → 桶 5 #1 評估
```

---

## 修訂歷史

- 2026-04-27 初版（R6-2 路徑 Y 擱置討論後落地，整理五桶供後續接手快速定向）
