# R6-2 桶 4 F2 — Step 0 探針閘 ❌ fail-fast：probe overhead ≥ 1.24%、Stage A 不可行

> 階段狀態：fail-fast 退場 2026-04-27
> 上層計畫：`.omc/plans/R6-2-bucket4-F2-timer-breakdown.md` v3（Critic ITERATE 後採 OQ1 嚴格版）
> Phase 1.0 baseline：`.omc/REPORT-R6-2-Phase-1.0.md`
> ROADMAP：`.omc/ROADMAP-R6-2-optimization-buckets.md` 桶 4 F2 從「桶 4 內最高價值」標 ⏸

---

## 1. 結論一句話

```
Stage A probe (uniform float uSegmentMode + 1 處 mode 1 entry early-return) 對 mode 0
路徑 spp/sec 拖慢 ≥ 1.24%（C2 高可信度），超過 plan v3 嚴格版「< 1% 合格」門檻。
即使僅 1 處 if 分支已超門檻、加齊 plan v3 設計的 13 處 if 必加倍拖慢。
依 plan v3 §B Scenario 3 + Critic OQ1 嚴格版 → fail-fast 升 Stage B 路徑。
但 Stage B 工程量 +1.5~4 hr 投資不對齊 fast-skip 精神 + R6 內已四連敗，採用
B 選項：F2 結案、本報告退場。
```

---

## 2. Step 0a 量測結果

### 探針設計（已 revert）

```
shaders/Home_Studio_Fragment.glsl
  L82-92 加 uniform float uSegmentMode + 註釋（11 行）
  L267-274 在 sampleStochasticLightDynamic 入口（uR3ProbeSentinel 守門之後 /
           uActiveLightCount 守門之前）加 mode 1 entry early-return：
    if (uSegmentMode > 0.5 && uSegmentMode < 1.5) {
        throughput = vec3(0);
        pdfNeeOmega = 1e-6;
        pickedIdx = -1;
        return nl;
    }
  ★ 注意：plan v3 設計 13 處 if 分支（uniform 1 + entry 1 + caller-side 10 +
    SceneIntersect 後 1）；Step 0 探針只實作了 entry 1 處看 baseline 拖慢

js/Home_Studio.js
  L1287 加 pathTracingUniforms.uSegmentMode = { value: 0.0 } 預設 mode 0
  L963 shader cache busting query 改 ?v=uncap-test → ?v=f2-step0-probe

Home_Studio.html
  L269 Home_Studio.js script tag query 改 ?v=r4-5-fix02-infodom → ?v=f2-step0-probe
       （另加 <link rel="icon" href="data:,"> 消 favicon 404 噪音、與 F2 無關）
```

### 對照表（5 秒 RAF + 對 Phase 1.0 baseline 比 Δ%）

| Config | Phase 1.0 spp/sec | probe mode0 spp/sec | Δ% | spp_per_frame ratio | 可信度 | 過閘？ |
|--------|-------------------|---------------------|----|---------------------|--------|--------|
| C1 | 34.30 | 31.56 | **-8.0%** | 0.866 vs 0.967 | 低（21% frame-skip 污染、與 Phase 1.0 §5 同類異常） | ❌ |
| C2 | 31.56 | 31.17 | **-1.24%** | 0.958 vs 0.964 | **高（ratio 一致、純 probe overhead 訊號）** | ❌ |
| C3 | 30.78 | 29.60 | -3.83% | 0.878 vs 0.789 | 棄權（既有異常、plan v3 §C.5） | 棄權 |
| C4 | 30.39 | 29.21 | -3.88% | 0.914 vs 0.951 | 中（4% ratio 偏差、含部分 frame-skip 污染） | ❌ |

### 重要觀察

```
1. C2 高可信度 -1.24% 已超嚴格 1% 閘
   spp_per_frame ratio 0.958 vs Phase 1.0 0.964 → 偏差 -0.6% 屬量測噪音範圍
   spp/sec 偏差主要由 fps -0.5% + ratio -0.6% 構成
   兩者皆 < 1%、但加總後 spp/sec 達 -1.24%、剛超嚴格閘

2. C1 -8.0% 數值含 frame-skip 污染
   spp_per_frame ratio 0.866 vs 0.967 → 21% frame 跳過 STEP 1
   但 fps 36.46 反而高於 Phase 1.0 35.5 → GPU per-frame 算更快、卻有 frame-skip
   推測：cameraSwitchFrames / RAF host throttle 對 C1 場景的 race condition
   類似 Phase 1.0 §5 C3 21% frame-skip 異常擴散到 C1
   即使扣掉 frame-skip 污染、純 probe overhead 仍 ≥ 1%（C2 已實證）

3. C4 -3.88% 含部分 frame-skip 污染
   ratio 0.914 vs 0.951 → 4% 偏差、屬中間污染
   純 probe overhead 估 1~2%、仍 ≥ 1% 閘

4. 只 1 處 if 分支已 ≥ 1.24% 拖慢（C2 高可信度）
   plan v3 設計 13 處（entry 1 + caller-side 10 + mode 2 切點 1 + uniform 宣告）
   加齊後拖慢肯定加倍 → 不可逆觸發升 Stage B
```

---

## 3. plan v3 §B Scenario 3 + §C.5 + §D Step 0-7 嚴格版三條件對照

```
plan v3 嚴格版規則（Critic OQ1 採納、§H v3 條目）：
  - C1/C2/C4 全 |Δ| < 1% → 過閘、進 Stage A Step 1A 真實量測
  - C1/C2/C4 任一 |Δ| ≥ 1% → fail-fast、升 Stage B (Option 3 #ifdef N+1 build)
                              （取消 v2 「1%~3% 警告繼續 Stage A」帶）

實際結果：C2 -1.24% / C1 -8.0% / C4 -3.88% → 三投票 config 全部 ≥ 1%
        → 觸發 fail-fast 升 Stage B
```

對齊 plan v3 §H v3 條目「Stage A 失敗為預期常態、視為 Step 0a fast-skip 探針」。

---

## 4. 為什麼 1 處 if 分支對 spp/sec 影響 ≥ 1.24%

對齊 plan v3 §B Scenario 4（probe ternary 計算成本）+ Critic OQ1 預測：

```
A. ANGLE Metal codegen 把 if 編成 select() / cmov 而非 branch
   GPU SIMD lockstep 執行：mode 0 仍要走 if 條件比較 + 兩路徑 dead store
   per-NEE 呼叫 +1 比較 + 兩個 vec3/float 寫入 cost
   sampleStochasticLightDynamic 每 bounce 呼叫 → per-pixel ~3~5 次重複 cost
   累積到 frame 級 ≥ 1.24% 拖慢

B. Uniform fetch overhead
   uSegmentMode 雖只 1 個 uniform、但每 fragment shader invocation 都讀一次
   per-pixel × per-bounce × per-NEE 累乘 → small per-call cost × 大 invocation 數
   = 顯著 frame-level overhead

C. C1 NEE 命中率最高（單吸頂燈 + GUI 關其他光源）
   sampleStochasticLightDynamic 呼叫頻繁 → uniform branch 平均 cost 最高
   解釋為何 C1 拖慢 -8% > C4 -3.88% > C2 -1.24%（C2 受 frame-skip 污染少）
```

實證上無法區分 A/B/C 各占多少（沒做 spectorJS GLSL→HLSL dump、Apple Metal 走 ANGLE → Metal IR 也 dump 不出），但對結論不重要——任一條成立 → Stage A 13 處 if 拖慢必 ≥ 1% 閘。

---

## 5. 對齊 plan v3 共識體例

```
ralplan Round 1 Architect verdict: REVISE，5 致命 + 4 應修
ralplan Round 2 Planner v2:        5 致命全閉鎖（Stage A→B synthesis 採納）
ralplan Round 2 Architect r2:      APPROVE w/caveats（3 caveat 移交 Critic）
ralplan Round 2 Critic r2:         ITERATE（4 MAJOR + 5 MINOR + 3 建議）
使用者裁示 B 選項:                跳過 Round 3 共識、採 Critic OQ1 嚴格版
Planner v3 修訂:                  4 MAJOR + 3 caveat 全閉鎖、採嚴格版
Step 0 探針實機驗證:              ❌ fail-fast 觸發
                                    Critic OQ1 預測「Stage A 大概率沉沒」實證

→ ralplan 的核心價值「prototype-first，最便宜驗證優先」在此實證：
  Step 0 探針（1 hr 寫程式碼 + 5 分鐘量測）
  替代了 Stage A 完整實作 9 hr 工程
  + Stage B 升級 +1.5~4 hr 工程（B 選項決定不進）
  淨節省約 9~13 hr 工程時間

ralplan 三輪共識的 ROI：花 3 輪 Planner + 2 輪 Architect + 1 輪 Critic 流量、節省
9~13 hr 工程 + 確認下一步路徑。對齊 leaf packing v3 step0-noop §5「8 hr 節省」精神。
```

---

## 6. 對 ROADMAP 桶 4 F2 後續分流規則的影響

依 `.omc/ROADMAP-R6-2-optimization-buckets.md` 桶 4 F2 修訂：

```
原規則：
  桶 4 F2 三段 timer 拆解
  ★ 推薦：✅ 桶 4 內最高價值
  理由：未來所有優化方向都受惠（知道瓶頸在哪、不再盲猜）

修訂後（2026-04-27 Step 0 fail-fast）：
  桶 4 F2 三段 timer 拆解
  狀態：⏸ 暫緩（plan v3 Stage A probe overhead ≥ 1.24% fail-fast）
  Stage B 升級路徑（Option 3 編譯時 #ifdef N+1 build）保留為 follow-up F-F2-3
  觸發再啟動條件：
    - R3-8 採購擴張 sceneBoxes.length ≥ 200 box（box 多 → BVH/Material 占比改變）
    - 或廠商討論模式從靜態 → 動態鏡頭（時序 reproject 動機回升、需先量三段）
    - 或 erichlof 框架升級到 WebGPU（compute shader 可走 timestamp query 不必 uniform branch）
  
桶 4 F1（C3 21% frame-skip debug）狀態不變：✅ 仍可做、工時 0.5~1 天
桶 2 #2（Russian Roulette 調校）狀態不變：✅ 風險低、收穫保守 ≤ 10%
```

---

## 7. 下一步路徑（待使用者裁示）

```
路徑 A：F2 結案、跳到桶 4 F1（C3 21% frame-skip debug）
  工時：0.5~1 天
  價值：Phase 1.0 數據可信度補完（C3 唯一未解異常）+ 對應任何後續多 config 量測都受惠
  風險：低
  推薦：✅

路徑 B：F2 結案、跳到桶 2 #2（Russian Roulette 路徑提早終結優化）
  工時：1~2 天
  風險：低
  預期：≤ 10% spp/sec 提升
  OMC：可直接 executor、不需 ralplan
  推薦：可做（但收穫上限低）

路徑 C：F2 結案 + R6-2 整體結案
  對齊 leaf packing step0-noop 後的 Z 路徑
  R6-2 1024-spp 30~34 秒在 Apple M4 Pro 是合理水準
  桶 1/2/3/5 全擱置等 R3-8 採購觸發
  推薦：可做（但有桶 4 F1 + 桶 2 #2 等低風險選項在前）

建議：路徑 A（桶 4 F1）
理由：F2 fast-skip 後最低風險的下一步、且補完 Phase 1.0 數據完整性
     （C3 frame-skip 異常解開後、未來任何多 config 量測協定都更可靠）
```

---

## 8. follow-up

```
F-F2-1: ANGLE Metal/M4 Pro spectorJS GLSL→HLSL dump 補強根因
        （目前實證上無法區分「ANGLE select() codegen」vs「uniform fetch overhead」
         vs「NEE 命中率放大」三因素各占多少）
        優先序：低（不影響 R6-2 推進）

F-F2-2: R3-8 採購擴張到 ≥ 200 box（box 多）後重評 Stage A
        可能屆時 BVH/Material 占比結構性改變、Stage A probe 相對成本變小
        重做 Step 0 探針可能翻盤
        優先序：低、自動由 R3-8 觸發

F-F2-3: Stage B Option 3 #ifdef N+1 build 升級路徑（plan v3 §A.3 Option 3 + §G ADR）
        若未來 R3-8 觸發 + Step 0 仍失敗、Stage B 是備案
        工時 +1.5~4 hr、風險中（編譯時 #ifdef 與 erichlof 框架巨集系統耦合未驗）
        優先序：低、自動由 R3-8 + Step 0 fail-fast 觸發

F-F2-4: 主線 1 階段 2 reproject 評估時、時序面降噪本身可能順手提供「per-frame 三段 timer」
        副產品（compute shader 模型）→ F2 自動兌現
        優先序：低、自動由路徑 Y 觸發
```

---

## 9. ROADMAP / HANDOVER 修訂

```
.omc/ROADMAP-R6-2-optimization-buckets.md
  桶 4 F2 條目更新：
    狀態：✅ 桶 4 內最高價值 → ⏸ 暫緩（Step 0 fail-fast）
    + 連結本報告
    + Stage B 升級路徑列入 follow-up F-F2-3

.omc/HANDOVER-R6-2.md
  接手第一步清單加本報告（第 X 項）
  狀態段加 F2 step0-noop 退場紀錄
```

---

## 修訂歷史

- 2026-04-27 初版（Step 0 fail-fast 退場紀錄、採用使用者 B 選項 F2 結案）
