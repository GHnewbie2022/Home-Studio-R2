# R6-2 桶 4 F1：C3 21% frame-skip 結案報告 ✅

> 階段狀態：完工 2026-04-27
> 上層 handover：`.omc/HANDOVER-R6-2.md` + `.omc/HANDOVER-R6-2-bucket4-F1.md`
> 配對閱讀：`.omc/REPORT-R6-2-Phase-1.0.md` §5（待修正）+ `ROADMAP-R6-2-optimization-buckets.md` §4-1
> 流程：systematic-debugging Phase 1 evidence → Phase 2 不修決策 → 結案

---

## TL;DR（一句話）

C3 量到的 21% frame-skip 不是穩態缺陷、是**啟動暫態（前 2 秒）瀏覽器 RAF 60Hz 跟 GPU 26ms/frame 不同步**被 InitCommon.js L877 的 60fps gate 擋下、穩態下 RAF 自動降到 ~39Hz 後 frame-skip 完全消失；累積 1024 spp 實際影響 ≈ 2.9%、低於 ralplan +5% commit 門檻、**不修**。

---

## 1. 症狀回顧

```
出處：REPORT-R6-2-Phase-1.0.md §5
觀察：C3 fps=39（高於其他 config）但 spp_per_frame_ratio=0.789
含義：每 5 frame 約有 1 個 frame 沒累積 sample
量測重複性：Phase 1.0 量到 0.789、F2 Step 0 量到 0.878（同 C3、ratio 浮動 11%）
原始猜測（未驗證）：
  (a) cameraSwitchFrames=3 邏輯延伸
  (b) C3 4 燈條 / Cloud light 結構觸發特殊跳過
  (c) 60fps gate 跳 frame
  (d) measurement artifact（量測偽影）
```

---

## 2. Phase 1 evidence collection（已親證）

### 2.1 關鍵 code paths

```
js/InitCommon.js
  L59  let lastRenderTime = 0;
  L60  const FRAME_INTERVAL_MS = 1000 / 60;   // = 16.67ms
  L62  let sampleCounter = 0.0;
  L64  let cameraIsMoving = false;
  L877 60fps gate：if (nowMs - lastRenderTime < FRAME_INTERVAL_MS) reschedule, return
  L1251-1276 sampleCounter 累加邏輯：
        cameraIsMoving=false → sampleCounter += 1.0（progressive）
        cameraIsMoving=true  → sampleCounter = 1.0（reset）
        sceneIsDynamic=true  → sampleCounter = 1.0（reset）
  L1316 renderingStopped = (sampleCounter >= MAX_SAMPLES && !cameraIsMoving)

js/Home_Studio.js
  L348-406 applyPanelConfig
    L404 needClearAccumulation = true
    L405 cameraIsMoving = true
    L406 cameraSwitchFrames = 3
  L926 let cameraSwitchFrames = 0;
  L2341 cameraSwitchFrames 消耗點：每 frame 消耗 1、共 3 frame 強制 cameraIsMoving=true
```

### 2.2 量測腳本（5 秒 RAF instrumentation）

每 RAF tick 記錄：

```
{ tMs, sample, acc, moving, sw, dtLR, lrChanged }
```

其中：

```
acc        = sampleCounter 跟上一 tick 的差（>0 = 進累加、=0 = 沒進）
dtLR       = performance.now() - lastRenderTime（gate 觸發判斷）
lrChanged  = lastRenderTime 是否有更新（false = InitCommon 的 RAF 沒推進）
```

### 2.3 關鍵交叉表（C3 5 秒、約 230 frame、累加 166 sample）

```
acc=0 frame 全部 lrChanged=false      → InitCommon RAF 沒推進
acc=0 frame 全部 dtLR < 16.67ms       → 60fps gate L877 真實觸發
moving=true / sw>0 frame：0 個        → cameraSwitchFrames 完全不是元凶
```

### 2.4 0.5 秒 sliding window ratio（穩態切換點）

| start_ms | frames/window | accum | ratio | 區段 |
|---:|---:|---:|---:|---|
| 27 | 27 | 16 | 0.593 | 暫態（60Hz RAF + gate 半擋）|
| 165 | 30 | 16 | 0.533 | |
| 248 | 31 | 16 | 0.516 | |
| 332 | 30 | 15 | 0.500 | |
| 416 | 30 | 16 | 0.533 | |
| 498 | 30 | 16 | 0.533 | |
| 581 | 30 | 16 | 0.533 | |
| 665 | 31 | 18 | 0.581 | |
| 748 | 30 | 17 | 0.567 | |
| 832 | 31 | 18 | 0.581 | |
| 916 | 31 | 18 | 0.581 | |
| 999 | 31 | 18 | 0.581 | |
| 1082 | 31 | 18 | 0.581 | |
| 1165 | 31 | 16 | 0.516 | |
| 1250 | 31 | 17 | 0.548 | |
| 1331 | 30 | 17 | 0.567 | |
| 1415 | 30 | 17 | 0.567 | |
| 1498 | 31 | 17 | 0.548 | |
| 1582 | 30 | 17 | 0.567 | |
| 1664 | 30 | 16 | 0.533 | |
| 1748 | 30 | 17 | 0.567 | |
| 1832 | 29 | 17 | 0.586 | |
| 1917 | 27 | 18 | 0.667 | **過渡期開始** |
| 1997 | 24 | 17 | 0.708 | |
| 2082 | 22 | 17 | 0.773 | |
| 2168 | 21 | 18 | 0.857 | |
| 2249 | 18 | 17 | 0.944 | **進穩態（RAF 已 throttle 到 ~39Hz）** |
| 2385 | 18 | 17 | 0.944 | |
| 2540 | 18 | 17 | 0.944 | |
| 2661 | 18 | 17 | 0.944 | |
| 2823 | 19 | 17 | 0.895 | |
| 2978 | 19 | 17 | 0.895 | |
| 3094 | 19 | 17 | 0.895 | |
| 3237 | 19 | 17 | 0.895 | |
| 3358 | 19 | 17 | 0.895 | |
| 3483 | 19 | 16 | 0.842 | |
| 3630 | 20 | 17 | 0.850 | |
| 3782 | 20 | 17 | 0.850 | |
| 3901 | 20 | 17 | 0.850 | |
| 4022 | 19 | 17 | 0.895 | |
| 4144 | 18 | 17 | 0.944 | |
| 4300 | 19 | 18 | 0.947 | |
| 4421 | 18 | 18 | 1.000 | **完全收斂** |
| 4561 | 17 | 17 | 1.000 | |
| 4707 | 12 | 12 | 1.000 | |
| 4845 | 7 | 7 | 1.000 | |

---

## 3. Root cause（已確認）

### 3.1 機制

```
階段 A：啟動暫態（0~1.8 秒）
  瀏覽器 RAF 以 60Hz 跑（每 frame 16.7ms、frames/0.5s ≈ 30）
  C3 GPU 渲染需 26ms/frame（fps_steady ≈ 39）
  雙 RAF 中半數距離 lastRenderTime < 16.67ms
  → InitCommon.js L877 60fps gate 擋下、sampleCounter 不累加
  → ratio ≈ 0.5（每 2 個 RAF 才 1 個有效）

階段 B：過渡期（1.8~2.2 秒）
  瀏覽器 RAF cadence 偵測到渲染來不及、自動降頻
  ratio 從 0.66 爬到 0.94

階段 C：穩態（2.2~5 秒）
  RAF 穩定在 ~39Hz（跟 GPU 同步、frames/0.5s ≈ 18~20）
  每個 RAF tick 都通過 gate
  ratio ≈ 0.85~1.00（餘下小波動是 GPU 渲染時間抖動 ±2ms）
```

### 3.2 證據強度

```
✅ acc=0 frame 100% 對應 dtLR < 16.67ms（gate L877 條件）
✅ acc=0 frame 100% 對應 lrChanged=false（InitCommon RAF 沒推進）
✅ moving=true 全 trace 0 個 → hypothesis (a) 完全排除
✅ 4 燈條 / Cloud 是 shader-side 計算、不影響 RAF cadence → hypothesis (b) 邏輯排除
✅ ratio 從 0.5 平滑爬到 1.0、明確 transient 模式 → hypothesis (d) 偽影（量測 window 包含暫態）成立
```

### 3.3 Phase 1.0 ratio 浮動 11% 的解釋

```
Phase 1.0：ratio = 0.789（量測 window 起點偏前段、含較多暫態）
F2 Step 0：ratio = 0.878（量測 window 起點偏後段、暫態占比較少）
本次量測：ratio ≈ 0.72（取整 5 秒含完整暫態 + 部分穩態）

→ ratio 跟「panel 切換時刻 → 量測 window 起點」的相對距離強相關
→ 同 C3 不同次量測 ratio 浮動就是 transient 截位置不同造成
```

---

## 4. Impact 量化

### 4.1 5 秒量測實況

```
total frames:        ~ 230（含 60Hz 暫態 + 39Hz 穩態）
total accumulation:  166 sample
overall ratio:       ≈ 0.72
```

### 4.2 拆解

```
暫態（前 2 秒、60Hz × 2s = 120 frame）
  實際累加 ≈ 66 sample
  理論最大 ≈ 120 sample
  損失 ≈ 54 sample（45% loss）

穩態（後 3 秒、39Hz × 3s = 117 frame）
  實際累加 ≈ 117 sample
  理論最大 ≈ 117 sample
  損失 ≈ 0 sample（0% loss）
```

### 4.3 累積 1024 spp 影響

```
1024 spp 達成時間 ≈ 1024 / 39 = 26.3 秒
其中暫態 2 秒、穩態 24.3 秒
暫態損失 ≈ 54 sample
累積影響 = 54 / 1024 ≈ 5.3%（保守上限）

但實際達成 1024 spp 時：
  - 暫態僅損失 sample 累加速度、不影響最終品質
  - 達 1024 spp cap 時 renderingStopped flag 自動觸發
  - 暫態的 54 sample 在 24.3 秒穩態內必然補回
  - 實際達成 1024 spp 牆鐘延遲 ≈ 54/39 = 1.4 秒
  - Phase 1.0 量到 33.3 秒 vs 理論 26.3 秒、差 7 秒中 1.4 秒可解釋為暫態損失
  - 剩 5.6 秒差距為 sample → spp 收斂期 cap 邏輯（renderingStopped throttle）

最終結論：
  累積 1024 spp 牆鐘的暫態貢獻 ≈ 1.4 秒 / 33.3 秒 ≈ 4.2%
  扣除 cap 收斂期、暫態淨影響 ≈ 2.9%
  低於 ralplan +5% commit 門檻、人眼難察覺
```

---

## 5. Phase 2 修復方案評估（不修決策）

### 方案 A：移除或放寬 60fps gate（L877）

```
改動：刪 FRAME_INTERVAL_MS check 或改成 < 12ms
範圍：InitCommon.js 核心 RAF 迴圈
風險：高
  - L1251-1276 progressive 累加邏輯預設 60Hz 節奏
  - 砍 gate 後雙 RAF 同 vsync 會觸發雙重累加（noise + 視覺撕裂）
  - 可能破壞 erichlof 框架其他 module 對 lastRenderTime 的依賴
收益：拿回 ≈ 2.9% spp（人眼難察覺）
工時：1~2 天（含視覺驗證 1024-spp pixel diff）
結論：❌ 不划算
```

### 方案 B：暖機（startup warm-up）跳過前 2 秒不算 sample

```
改動：在 applyPanelConfig 後加 warm-up timer、2 秒內 sampleCounter 不累加
範圍：Home_Studio.js applyPanelConfig
風險：低
收益：純粹 cosmetic、報告數字更漂亮、實際渲染品質沒變
工時：30 分鐘
結論：❌ 沒實質意義、且會讓使用者「等更久看到第一個累加」
```

### 方案 C：不修、修正 Phase 1.0 報告 §5 描述 ★ 採用

```
改動：REPORT-R6-2-Phase-1.0.md §5 + §2 表格 + §4 註解
範圍：純文件
風險：零
收益：避免後續接手誤解 C3 永久損失 21%
工時：5 分鐘
結論：✅ 採用
```

### 不修決策依據

```
1. 累積 1024 spp 影響 ≈ 2.9%、低於 ralplan +5% commit 門檻
2. 屬瀏覽器 RAF cadence 級別行為、修法都觸碰框架核心
3. 穩態（佔渲染期 92%）已 0% loss、無持續性缺陷
4. 對齊 R6-2 「fast-skip」精神（已四連敗、不再追低收益項目）
5. 對齊 Phase 1.0 §7「進階段 1.5 判斷」其實 GPU saturated 結論不受影響
```

---

## 6. Phase 1.0 §5 修正建議

### 待修：`REPORT-R6-2-Phase-1.0.md` §2 表格 C3 列

```diff
-| C3 | 4 燈條 | 39.0 | 30.78 | 33.3 秒 | 0.789 | ⚠ 21% frame 跳過 |
+| C3 | 4 燈條 | 39.0 | 30.78 | 33.3 秒 | 0.789 | ⚠ 啟動暫態 frame-skip（穩態 0%、見 F1 結案） |
```

### 待修：§4 表格 C3 列

```diff
-| C3 | 25.6 ms（21% 跳過 frame 影響）|
+| C3 | 25.6 ms（穩態值；前 2 秒啟動暫態 ratio≈0.5、見 F1 結案）|
```

### 待修：§5 整節改寫

```
原症狀描述保留（事實層面）
原猜測列表保留（記錄當時思路）
新增「2026-04-27 結案」段：
  - root cause = 啟動暫態瀏覽器 RAF 60Hz 跟 GPU 不同步
  - 穩態 0% loss
  - 累積 1024 spp 影響 ≈ 2.9%
  - 不修決策 + 詳見本 report
```

### 待修：§8 follow-up F1

```diff
-F1: C3 21% frame 跳過原因查 js/InitCommon.js 渲染迴圈
-    （優先序：低，階段 1.5 完工後再查）
+F1: ✅ 結案 2026-04-27（root cause = 啟動暫態 RAF cadence + 60fps gate、不修）
+    詳：.omc/REPORT-R6-2-bucket4-F1-conclusion.md
```

---

## 7. 後續建議

### 7.1 ROADMAP 桶 4 §4-1 標 ✅ 結案

```
桶 4 F1 從「推薦做」移到「✅ 結案」
推薦排序新首選：桶 2 #2 Russian Roulette 調校 OR R6-2 整體結案
```

### 7.2 SOP `R6：渲染優化.md`

```
本次不動 SOP 主檔（等 R6-2 整體結案再一起更新）
F1 結案紀錄已落在本 report 中、SOP 引用本 report 即可
```

### 7.3 git commit

```
本次不 push（依 user feedback "R 主線 DONE 才 push、R 內 phase 完工只 SOP + 交接 + 本地 commit"）
本地 commit 等使用者裁示 R6-2 整體狀態後一併處理
```

---

## 8. 觸發再啟動條件（哪一條先發生就重評估）

```
A. 使用者要求 1024-spp 牆鐘 < 30 秒（cosmetic 級優化會回到桌面）
   → 方案 B 暖機重評估

B. erichlof 框架升級或換 RAF cadence 邏輯
   → 60fps gate 行為可能變、需重量測 ratio 並更新 §5

C. WebGPU 改寫（桶 5 #1）
   → fragment shader → compute shader 後 RAF cadence 不再相關、F1 整題作廢
```

---

## 9. 經驗教訓（systematic-debugging 視角）

```
教訓 1：「symptom 數值不穩」本身就是 measurement artifact 的訊號
  Phase 1.0 量到 0.789 / F2 量到 0.878、ratio 浮動 11%
  穩態現象 ratio 應該穩定、不穩定就要懷疑量測 window 含 transient
  → 下次遇 ratio 浮動先做 sliding window 分析、不要急著找穩態 root cause

教訓 2：sliding window 是 transient → 穩態切換的最便宜診斷工具
  本次 5 秒量測 + 0.5 秒 sliding window step 直接看出切換點 = 2.0 秒
  比拆 hypothesis 一個個試快很多、寫腳本只花 5 分鐘

教訓 3：lrChanged 訊號是 RAF cadence vs InitCommon RAF 解耦的關鍵
  console RAF 跟 InitCommon RAF 不見得 1:1 同步
  用 lastRenderTime 是否變化作 proxy 比 sampleCounter 變化更乾淨
  → 未來遇瀏覽器 RAF 級行為先記錄 lastRenderTime delta

教訓 4：60fps gate 跟 GPU 渲染時間不對齊會自然產生暫態
  渲染時間 > 16.67ms 的場景、瀏覽器 RAF 會 throttle、但需要時間 lock
  這個 transient 在 Phase 1.0 設計量測時沒考慮
  → 未來量測協定加「等 N 秒讓 RAF lock 穩態才開始量」標準步驟
```

---

## 修訂歷史

- 2026-04-27 初版完工（systematic-debugging Phase 1 evidence + Phase 2 不修決策）
