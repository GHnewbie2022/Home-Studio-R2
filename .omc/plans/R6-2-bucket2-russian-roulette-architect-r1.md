# R6-2 桶 2 #2 Russian Roulette Plan v1 — Architect Review Round 1

> 模式：Short consensus（v1 Planner 自選不啟 deliberate；本 review 仍以 deliberate-equivalent 嚴審處理 — 因 plan 本身命題碰觸 path tracer 正確性 hard gate，輕審等同失職）
> Round：1
> Reviewer：architect agent (opus)
> 日期：2026-04-27
> 對象：`.omc/plans/R6-2-bucket2-russian-roulette.md` v1（Planner Round 1，837 行）
> 結論：**CRITICAL_REVISION_REQUIRED**（5 條致命級 + 5 條應修級）

---

## 1. Verdict

**CRITICAL_REVISION_REQUIRED**（白話：必須大改、不可只補幾段註腳）

不能 APPROVE 的核心理由（單條即可阻擋）：

```
F1. 1024-spp pixel diff = 0 hard gate 在 Russian Roulette ON 條件下 RNG sequence 必
    然偏離 baseline，數學上不可能達成 → plan §A.1 P4 / §D.4 / §E.2 / §H.3 全部斷裂
F2. plan §B.4 「mean unbiased → 1024-spp pixel diff = 0 可達」是統計學謬誤；1024 spp
    對 RR 引入的 variance 收斂不足、且 RR 與 mask flow 的耦合會放大殘差
F3. mask flow 互動分析錯誤：plan §C.4 / §C.5 假設 RR check 在「下一輪 for 頭」與
    NEE / diffuseBounce 切換解耦；實際 mask 在 hitType 分支內 mask *= weight × uLegacyGain
    + diffuseBounceMask × uIndirectMultiplier × uLegacyGain pattern 已內含 NEE/MIS 量綱
    放大 → continueProb = max(mask) 會在 NEE-rich 路徑直接觸 1.0 上界、形同沒做 RR
F4. RNG state 來源描述錯誤：plan §A.2 D1 寫「rng() = hash(uv, frameCounter, bounces)
    派生」與 PathTracingCommon.js L3087-L3093 實際機制（uvec2 seed += 1 + 1103515245U
    乘法 hash、與 uv/frameCounter/bounces 完全脫鉤、跨 fragment 共享靜態變數）不符；
    引用基礎錯 → 「不會撞 progressive sampling」結論失去依據
F5. minBounces = 3 在本場景嚴重不足：bounces == 2 時 BSDF bounce 才剛離開光源、Cloud
    rod / 軌道燈 4-rod 多光源場景的「1 次 GI」貢獻佔成像比重不低，bounces = 3 起 RR
    會把第 2 次 GI 砍掉 → 對齊 user feedback「Path Tracing clamp 是診斷訊號不是 fix」
    精神：minBounces 太低是「上游量綱失配」級錯誤、不是調 clamp 蓋過的事
```

CRITICAL_REVISION_REQUIRED 含義：v2 必須對 F1~F5 提出實質演算法重設計（含 hard gate 改名、commit 條件改寫、mask flow 圖補完、RNG 引用更正、minBounces 探針 sweep 必做），不是補幾段註腳。

---

## 2. Steelman Antithesis（替反方說話）

**最強反方主張**：「v1 plan 已經是 fast-skip 體例的優等生，不該嚴審到逼大改」

具體論點：

```
反方 1. 範圍純度極佳。8 行 GLSL + 2 行 JS uniform、單一站點（bounce 迴圈頭、
        SceneIntersect 之前），完全對齊 P1 純度。對比 F2 v1 的 13 處 if 切點，
        本計畫 instrumentation 站點 1 處、改動量 < 16 行，是 R6-2 內最乾淨的 plan。

反方 2. 「unbiased + energy-preserving」是教科書級 Veach §10.4.1 直接抄。期望值
        E[mask after RR] = mask 在連續性意義下 mathematically 嚴格、不是工程取巧。
        Plan §B.4 數學期望段寫對。

反方 3. ≥ 4 個踩坑點預先寫好 mitigation（minBounces ≥ 3、clamp(0.05, 1.0)、
        max-channel 而非 luminance、RR check 站點時序與 NEE 分離），ralplan
        Architect 先驗「Planner 自評列出來的多半就是真風險」，本 plan 已自評
        6 個踩坑點 + 風險矩陣總表，比一般 plan 完整。

反方 4. fast-skip 體例對齊 F2 step0-noop / leaf packing step0-noop：
        Step 0 探針失敗即整段結案、預估節省工程 8~13 hr 對齊兩次前車。Architect
        對「過度嚴審 fast-skip plan」自身就違 ralplan「最便宜驗證優先」精神。

反方 5. 本計畫的 commit 門檻 +5% 對齊 ROADMAP 桶 2 #2 「≤ 10%」估值之下界、量測
        誤差容忍 ±5% 對齊 Phase 1.0 §2.2、C1/C2/C4 三票決對齊 F1 結案。每一條
        threshold discipline 都有實證 anchor。

反方 6. 1024-spp pixel diff = 0 hard gate 不是「精準到 bit」；plan §A.1 P4
        明寫「mean diff ≤ 1e-4 / AE = 0」雙條件，1e-4 容忍已涵蓋 RNG sequence 偏差。
        Architect F1 的「RNG sequence 偏離 baseline」攻擊太字面、未考慮 plan 自留容忍帶。
```

**反方有道理的部分**（必須 steelman 承認）：

- 範圍純度（反方 1）真的很高、是本 plan 的最大優點；F2 v1 的 13 處 if 切點之痛這裡不會重演
- 教科書級 RR 公式（反方 2）數學沒錯，問題在 plan 對「unbiased」與「pixel-exact」混為一談
- 自評 6 個踩坑點（反方 3）已比一般 plan 完整、Architect 不是要打掉自評、是要補沒列到的盲點
- fast-skip 體例對齊（反方 4）成立，但前提是「探針本身正確」；本 plan 探針的 commit gate 與正確性 gate 互斥（見 F1/F2），探針根本量不準
- threshold discipline anchor（反方 5）對齊得不錯，但 +5% 門檻在「commit 時機」這層對；不對的是「過閘規則」與「正確性閘」共用同一組量測

**反方無法駁倒的部分**（這就是為什麼 verdict 是 CRITICAL_REVISION_REQUIRED）：

- 反方 6 的 1e-4 容忍帶在 RR 通過率約 0.5、補償倍率 2 倍時，單像素 variance 即可達 ±0.1（mean unbiased 不等於 variance 為零、且 1024 spp 不夠收斂到 1e-4）
- 反方 1~5 的「乾淨度」掩護了 F1（hard gate 不可達）這個 plan 自身的邏輯死結

---

## 3. Tradeoff Tensions（≥ 1 真實 tension）

### T1（核心）：「unbiased」vs「pixel-exact」雙 hard gate 互斥

**Tension**：

- plan 同時設兩個 hard gate：
  - P4「1024-spp pixel diff = 0 / mean diff ≤ 1e-4」（路徑正確性閘）
  - P5「commit 門檻 spp/sec Δ ≥ +5%」（性能閘）
- 但 Russian Roulette 在 ON 條件下 RNG sequence 必然不同：
  - 每個 pixel 進入 bounce 迴圈後、bounces == 3 時多消耗 1 次 rng() 呼叫
  - rng() 內部 `seed += uvec2(1)` → 後續所有 rng() 結果 shift 1 步
  - 後續 cosWeightedHemisphere / NEE slot pick / metal gate / Cloud rod jitter 全部抽到不同數
  - 1024 spp 平均後「mean」雖收斂到同 expectation，但「variance」對 RR 通過機率 p ∈ [0.05, 1] 而言、補償倍率 1/p 引入額外 variance（教科書級 RR variance increase factor = 1/p − 1）
  - 1024 spp 對 1/p − 1 ≈ 1 (p=0.5) 之 noise 的標準差約 1/√1024 × σ_path ≈ 3% σ_path，AE 1e-4 級嚴格容忍不可能達

**真實衝突點**：

- 要嚴格守 P4 → RR 必須關（RR ON sequence 不一致），但 RR 關等於本 plan 不存在
- 要 RR 啟動 → P4 必須改寫為「累積 mean ± 統計上限容忍」而非 pixel-exact
- 兩者擇一不可能同時 hard gate 達成

**v2 必修**：P4 改寫為「mean diff ≤ K × σ_path / √N」三 sigma 容忍（K=3）+ 同時跑 baseline RR OFF 4 次取 noise floor、用 RR ON 對 noise floor 的 KS test 通過判過閘。pixel-exact AE = 0 必死要求是物理錯。

### T2：max-channel throughput vs Cloud rod 多色溫場景的 RR 過早收斂

**Tension**：

- plan §A.3 Option 1 採 max-channel throughput，理由「保色比、避免 luminance 偏色」
- 但 Cloud rod 4 支不同色溫（uCloudEmission[0..3] 各自不同 vec3）+ 軌道燈 3000K + 廣角 6500K 場景下，mask 在 NEE dispatch 後 = `mask *= weight * uLegacyGain` × uIndirectMultiplier × diffuseBounceMask
- 多次 NEE bake 後 mask 任一通道輕易 ≥ 1.0（uLegacyGain 預設 1.5、uIndirectMultiplier 預設未知但 R2-18 既有）
- continueProb = clamp(max(mask), 0.05, 1.0) → 觸 1.0 上界、機率為 1、永不 break、形同沒做 RR
- 反向：若 bounce 4+ 後 mask 已衰減（漫射地板 hitColor < 1）、max-channel 又把通道差異拉平 → 砍率對暗暖場景偏高
- max-channel 在 unbiased 上正確、但對「真正能砍幾條 ray」的期望直接決定 spp/sec Δ

**真實衝突點**：要 +5% spp/sec → 砍率須夠高 → continueProb 不能常觸 1.0 上界；要保色比 → max-channel；但 max-channel + 既有 mask flow（含 uLegacyGain 1.5 × uIndirectMultiplier）幾乎保證觸 1.0 上界、砍率近零。

**v2 必修**：Step 0 必須先 shader probe instrumentation 量測 mask max-channel 在 bounces ∈ [3, 14] 各 bounce 的實際分佈、確認 continueProb 落點分佈是否真的可砍（< 1.0 比例 ≥ 50%）。否則 +5% 純屬白日夢。

### T3：Step 0 Option 1 sole-bet vs viable options 探索深度

**Tension**：

- plan §A.3 Option 2 / Option 3 全列為「v2 備案」，Step 0 僅試 Option 1
- 若 Option 1 Step 0 fail-fast、整段結案；Option 2 / 3 不獲試
- 但 Architect 在本 review 找出 Option 1 數個結構問題（F1/F2/F3/T2）→ 失敗機率提升
- 一發定生死 → ralplan 共識的整段 ROI 倒掛（試 1 槍即結案的成本是 plan 寫了 837 行、Architect r1 寫了本檔案）

**真實衝突點**：fast-skip 精神要求 Step 0 一槍試最低成本選項；ralplan 精神要求多 viable options 對照避免單點失敗。本 plan 的 Option 1/2/3 在 station 與公式上同質性 ≥ 80%、失敗風險高度相關，使 fast-skip 看似合理但實質壓縮了發現空間。

**v2 必修**：Step 0 至少試 Option 1 + Option 1' (continueProb = luminance-based、minBounces = 5) 雙跑、用同一份探針程式碼 #ifdef 切換。多 1.5 hr 工程，但 Step 0 fail-fast 時可至少回答「公式族整體不可行」vs「特定公式不可行」。

---

## 4. Synthesis（嘗試）

**核心提案：Option 1.5 — 兩階段三變數探針**

```
Stage A（Step 0 探針，2~3 hr 寫程式碼 + 1 hr 量測）：
  1. 同時實作 3 個探針 build（compile-time #define 切）：
     A1：max-channel + minBounces=3（Plan v1 Option 1 原始）
     A2：max-channel + minBounces=5（minBounces sweep）
     A3：luminance + minBounces=3（公式族 sweep，覆蓋 Plan v1 Option 2）
  2. 加 mask 分佈 instrumentation（runtime-impossible guard 包裹、不影響 mode 0）：
     - bounces ∈ [3, 14] 各 bounce 的 mask max-channel 與 luminance 分佈直方圖
     - 透過 imageStore 寫入 debug RT、JS 端讀回統計
  3. spp/sec Δ：對 A1/A2/A3 三 build × C1/C2/C4 共 9 組量測（C3 棄權）
  4. 視覺驗證重設計（修 F1/F2）：
     - 不用 pixel diff = 0
     - 改 mean diff over 1024 spp 對 RR OFF baseline、用 KS test：
       p-value > 0.05（≥ 95% 不能拒絕「同分佈」）→ 過閘
     - RR OFF baseline 跑 4 次取 sample mean 與 σ_path
     - RR ON 對 sample mean 之 |mean diff| ≤ 3σ_path / √1024 → 過閘

Stage B（commit + 多 config 驗證，僅 Stage A 過閘觸發）：
  - 與 v1 Step 1~3 同
  - 新增：每 config 跑 RR OFF/ON 各 1 次、做 KS test 報 p-value
  - 新增：mask max-channel 分佈圖入 commit message

Stage A 失敗判斷分流（修 T3 viable options 深度）：
  - A1/A2/A3 全部 spp/sec Δ < +5% → 公式族整體不可行、整段結案、寫 step0-noop
  - A1 fail 但 A2 過閘 → minBounces 是關鍵變數、進 v2 用 A2
  - A1 fail 但 A3 過閘 → 公式形態是關鍵變數、進 v2 用 A3
  - A1 fail 但 mask 分佈量測顯示 max-channel 觸 1.0 上界比例 > 80% → 確診 T2、進 v2 改 luminance 或 percentile
```

**優點**：

- F1/F2 解（hard gate 可達、KS test 統計嚴格）
- T2 解（mask 分佈量測直接告訴你 RR 能不能砍）
- T3 解（一次探 3 個 build、發現空間大）
- F5 解（minBounces sweep 內建）
- 工程成本 +1.5~2.5 hr（vs v1 Step 0 估 30 分鐘工程 + 20 分鐘量測），但相對於 ralplan 共識成本是合理投資

**缺點**：

- v2 必須重寫 §D Step 0（從單探針升雙/三探針）+ §A.1 P4 hard gate 改寫
- 「probe instrumentation」與本 plan 守門禁忌「純 instrumentation 之外不動」有張力 — 但 mask 分佈量測在 runtime-impossible guard 包裹下不打到主 mode、與 R3-1 DCE-proof sink pattern 同源、對齊 user feedback「DCE-proof sink 嚴禁業務 gate 作係數」精神

---

## 5. 致命級問題（F-1 ~ F-5）

### F-1：1024-spp pixel diff = 0 / AE = 0 hard gate 數學上不可達（致命，> 95% 觸發）

**問題敘述**：

plan §A.1 P4 / §D.4 / §E.2 / §H.3 多處列「1024-spp pixel diff = 0（hard gate）」「magick AE = 0 / mean diff ≤ 1e-4」為硬閘、AE > 容忍立即回滾。但：

- Russian Roulette ON 在 bounces == 3 起多呼叫 1 次 rng()
- PathTracingCommon.js L3087-L3093 rng() 內部 `seed += uvec2(1)` 全域 thread-local 狀態
- 多消耗 1 次 rng() → 後續 cosWeightedHemisphere（同檔 L3104-L3110，呼叫 rng() × 2）/ NEE slot pick（L269）/ metal gate（L1240, 1327, 1378, ...）/ Cloud rod jitter（L367）所抽到的數全部 shift 1 步
- 不同隨機數 → 不同光路 → 不同單像素 radiance → AE 必 ≠ 0
- 1024 spp 累積 mean 才會收斂到同 expectation；1024 spp 對 1/p − 1 ≈ 1（p=0.5）之 RR variance 增量、單像素 σ ≈ σ_path × √(1 + 1/p − 1) ≈ √2 × σ_path、mean diff 容忍 1e-4 在 σ_path 量級 0.01~0.1 的 path tracing 場景嚴重不足

**觸發條件**：

- RR uniform ON（plan 預設 1.0）
- bounces ≥ 3 任一 pixel 觸發 RR check
- 取 baseline 對照（baseline 必為 RR OFF）
- 跑 magick AE 比對

**為什麼致命**：

- plan 自設 hard gate、自己無法達成 → plan 為「fail-by-design」
- Step 0 視覺驗證階段必 trigger AE > 容忍 → 立即回滾 → plan 永遠走不到 Step 1 commit
- 即使 spp/sec Δ ≥ +5% 也無法 commit、本 plan 整段論證失效
- 對齊 user feedback「Path Tracing clamp 是診斷訊號不是 fix」精神：把 hard gate 設成不可達、再用「容忍帶」蓋過、是把規範誤用為 band-aid

**修法建議**：

v2 必須將 P4 改寫為統計閘（非 pixel-exact 閘）：

```
P4'（路徑正確性閘，統計版）：
  - RR OFF baseline 跑 N=4 次（不同 frame seed）取 sample mean 與 σ_path（per-pixel σ + path 平均）
  - RR ON 跑 1 次、對 RR OFF sample mean 計算：
    a. mean diff（per-pixel）：|RR_ON - baseline_mean| ≤ K × σ_path / √1024（K=3、3-sigma）
    b. KS test：p-value > 0.05（不能拒絕同分佈假設）
  - 兩條件均過 → 過閘；任一不過 → 回滾、走退場路徑
  
備案：若 K=3 容忍仍嚴、可放寬到 K=4，但需在 plan 內明註「對 RR variance 補償倍率上限 1/0.05 = 20 倍時、4-sigma 是統計學保守上界」
```

### F-2：「mean unbiased → 1024-spp pixel diff = 0 可達」是統計學謬誤（致命，> 90% 觸發）

**問題敘述**：

plan §B.4 寫：

```
數學期望：
  E[mask after RR | mask before] = continueProb × (mask / continueProb) +
                                   (1 - continueProb) × 0 = mask
  → 期望值不變（mean unbiased）→ 1024-spp pixel diff = 0 可達（在 RNG sequence
    平均收斂後）
```

數學期望段（前 3 行）對。但「→ 1024-spp pixel diff = 0 可達」推論錯：

- 期望值不變（mean unbiased）保證的是：`E[X_RR_ON] = E[X_RR_OFF]`，即無限樣本平均後相等
- 1024 樣本不是無限；1024 樣本的 sample mean 仍有 variance：`Var[mean_1024] = σ_X² / 1024`
- RR 引入的 variance 增量（教科書 Veach §10.4.2）：`σ_X_RR² = E[1/p] × σ_X² ≥ σ_X²`，其中 1/p ∈ [1, 20] 在 plan clamp(0.05, 1.0) 下、平均 1/p 估 2~10 倍
- 1024 樣本之 mean diff 的標準差：`σ(mean_diff) ≈ σ_X × √(2/1024) ≈ 0.044 × σ_X`
- σ_X 在 path tracing 是場景相依、典型 0.01~0.1 量級；mean_diff 標準差約 4e-4 ~ 4e-3
- plan 容忍 1e-4 比這個量級小 1~2 個數量級

**觸發條件**：同 F-1。

**為什麼致命**：

- plan §B.4 是 plan 的數學基礎；推論錯 → 全 plan 設計依據動搖
- 對齊 user feedback「PT 黑白畫面 debug 先掃 accumCol 寫入點」精神：plan 自評 phase 1 第一步必檢查最基本的數學前提，本 plan 此處基本前提就錯
- §G 風險矩陣表 6 條踩坑都標「Step 0 可偵測 ✅ pixel diff」、但 pixel diff 偵測機制本身基於本 F-2 謬誤、整張表的偵測效力打折扣

**修法建議**：

v2 §B.4 重寫：

```
B.4 Energy compensation（統計性質）
  Mean unbiased：E[mask after RR | mask before] = mask（期望值不變）
  Variance increase：Var[mask after RR | mask before] = mask² × (1/p − 1)
                     不為零（RR 必引入 variance）
  1024-spp 收斂：sample mean 之標準差 ≈ σ_X × √((1+1/p_avg)/1024)
                典型 σ_X = 0.01~0.1、p_avg = 0.5 → σ(mean) ≈ 1e-3 ~ 1e-2
  對 1024-spp pixel diff 期望值：~ 0（mean unbiased）
  對 1024-spp pixel diff 觀測值：~ σ(mean) × N(0,1)（central limit）
  → 同 P4'：用統計閘（3-sigma + KS test）取代 pixel-exact 閘
```

### F-3：mask flow 互動分析錯誤（致命，~75% 觸發）

**問題敘述**：

plan §C.4 列既有 mask flow，但結論「對既有 mask flow 透明、無互動 bug 風險」與實際機制不符：

shader 實際 mask 累乘 pattern（已 grep 確認）：

- L1241/1250/1288/1328/1337/1379/1388/...：`mask *= hitColor`（hitColor 通常 ∈ [0, 1]，衰減）
- L1265/1303/1351/1403/1511/1550/1611/1656/1765/1819 共 10 處：`mask *= weight * uLegacyGain`（uLegacyGain = 1.5、weight = stochastic NEE throughput 經 emit baked、典型量級 O(1)~O(10)）
- L978/1051/1093/1132/1176/1195/...（diffuseBounce 切換）共 13+ 處：`mask = diffuseBounceMask * uIndirectMultiplier`（uIndirectMultiplier 預設未知、R2-18 既有、典型 ≥ 1）

問題 A：plan 假設「mask 滿能量時 continueProb = 1 → 不 RR」是 desired behavior（§B.2 upper bound 1.0 段）。但實際 mask 在 NEE dispatch 後 = `mask *= weight * uLegacyGain` × `diffuseBounceMask × uIndirectMultiplier`（多 bounce 累積）→ 任一通道 ≥ 1 機率高、continueProb 觸 1.0 上界 → 永不砍。

問題 B：plan §A.3 Option 1 的「在 SceneIntersect 之前」站點看似乾淨，但「上一輪 hitType 分支內的 mask *= weight × uLegacyGain」與「下一輪 RR check」之間沒有 mask 衰減環節 → continueProb 的「throughput 評估」評到的是「已被 NEE bake 過的、含 emit 量綱（雖無單位、但量級被光通量推高）的 mask」，不是純 BSDF 衰減累積。

問題 C：plan §C.5 寫「RR break 點在下一輪 for 頭 → 切換已完成、mask 已是新值」但 willNeedDiffuseBounceRay 切換的位置在 `if (t == INFINITY)` 內（L976~L988）+ 各 hitType 分支內 13 處；如果 RR break 發生時 willNeedDiffuseBounceRay == TRUE 但 RR 還沒觸發 diffuseBounceMask reset → break 直接跳出 for、diffuseBounceMask 累積資源被丟棄、能量損失。

**觸發條件**：

- C2/C4 場景（軌道燈 + 多 NEE 路徑）
- bounces ≥ 3 進入 RR check
- 上一輪 hitType ∈ {SPEAKER, IRON_DOOR, TRACK, ACOUSTIC_PANEL, ...}（NEE dispatch 站之一）

**為什麼致命**：

- 觸 1.0 上界 = 沒做 RR = spp/sec Δ ≈ 0% = +5% 永不過閘 = Step 0 fail-fast
- diffuseBounceMask 資源丟棄 = 能量損失 = mean diff 偏暗 = pixel diff 偵測但歸因錯（會懷疑 minBounces 太低）
- plan 自評 6 個踩坑都沒包到這 3 個問題 → 風險矩陣不完整

**修法建議**：

v2 §C 必須重寫 mask flow 章節：

1. 加 mask max-channel 在 bounces ∈ [3, 14] 之分佈量測（探針 instrumentation、見 §4 Synthesis Stage A）
2. 補述「continueProb 觸 1.0 上界比例」之預期：若 > 80% → Option 1 不可行、轉 luminance 或 percentile-based 公式
3. RR break 路徑必須確認 willNeedDiffuseBounceRay state：v2 §A 程式碼骨架改為：
   ```glsl
   if (uRussianRouletteEnabled > 0.5 && bounces >= int(uRRMinBounces) &&
       willNeedDiffuseBounceRay == FALSE)  // 守門：diffuse bounce 切換進行中不 RR
   {
       float maxThroughput = max(max(mask.r, mask.g), mask.b);
       float continueProb = clamp(maxThroughput, 0.05, 1.0);
       if (rng() >= continueProb) break;
       mask /= continueProb;
   }
   ```

### F-4：RNG state 來源描述錯誤（致命，~60% 觸發 — 主要破壞 plan 的論證可信度）

**問題敘述**：

plan §A.2 D2 寫：

```
RNG 來源（已 grep 確認 shader 端 RNG 機制）：
  - `#include <pathtracing_random_functions>`（L204）
  - `rng()` 為 hash-based（已用於 L269 NEE slot pick + L367 Cloud rod jitter）
  - `rand()` 為同源 wrapper（已用於 L1240/1327/1378/1524/1631 等 metal gate）
  - 每 fragment 每 frame seeded 不同 → 與 progressive sampling 相容（不會撞收斂）
```

PathTracingCommon.js L3070~L3093 實際機制：

```glsl
float blueNoise;     // 全域變數
float randNumber;    // 全域變數
float rand()
{
    randNumber += (blueNoise + (mod(uFrameCounter, 32.0) * 0.61803399));
    return fract(randNumber);
}

uvec2 seed;          // 全域變數
float rng()
{
    seed += uvec2(1);
    uvec2 q = 1103515245U * ( (seed >> 1U) ^ (seed.yx) );
    uint  n = 1103515245U * ( (q.x) ^ (q.y >> 3U) );
    return float(n) * ONE_OVER_MAX_INT;
}
```

實際機制：

- `rng()` 是 IQ Shadertoy hash（不是 `hash(uv, frameCounter, bounces)`）
- 內部狀態 `uvec2 seed`，每呼叫 `seed += uvec2(1)` 自累
- `rand()` 是 Jacco Bikker style（不是 rng() 的 wrapper），內部狀態 `randNumber` 累加 blueNoise + frameCounter × 0.618
- `seed` / `randNumber` / `blueNoise` 在 main 入口被初始化（每 fragment 每 frame 不同 init）
- rng() 與 rand() 是兩個獨立 RNG state、不是 wrapper 關係

plan 描述兩個錯誤：

- 錯 1：rng() 不是 hash(uv, frameCounter, bounces)，是 hash(seed) 且 seed 自累
- 錯 2：rand() 不是 rng() wrapper，是兩個獨立 RNG（混用會打到不同 state）

**觸發條件**：v2 任何依賴 RNG state 引用之論證。

**為什麼致命**：

- plan §G 踩坑點 1「RNG state 破 progressive sampling」之 mitigation 寫「複用既有 rng() 不會破 banding」、依據是錯的引用
- 雖然「不會破 banding」結論碰巧仍然對（任何呼叫 rng() 都 advance state、不會撞收斂）、但對「會破壞 baseline RNG sequence」的影響、plan 完全沒意識到（→ F1）
- 影響 plan 整體可信度；ralplan 共識的「Architect 先驗 plan 已查證的事實」被打穿

**修法建議**：

v2 §A.2 D2 重寫，引用實際 PathTracingCommon.js L3070-L3093 機制：

```
RNG 來源（已 grep + Read PathTracingCommon.js L3070-L3093 確認）：
  - rng()：IQ Shadertoy hash、內部 uvec2 seed 自累；每呼叫 advance state；
    不接 uv/frameCounter（init 階段才接）；shader L269 NEE slot pick + L367
    Cloud rod jitter 已實證
  - rand()：Jacco Bikker 2024、內部 randNumber 自累 + blueNoise + frameCounter×0.618
    （與 rng() 是兩個獨立 RNG state）；shader L1240/1327/1378/... metal gate
  - 與 progressive sampling 相容性：每 frame init 不同（main 入口 seed/randNumber 用
    fragCoord + frameCounter 種子）→ 不撞 banding；但 RR ON 多消耗 1 次 rng() →
    所有後續 rng()/rand() 抽到的數 shift 1 步 → 路徑改變 → 1024-spp pixel diff
    必 ≠ 0（→ F1 統計閘改寫）
  - 對 plan 引用紀律的影響：v2 不再宣稱「不會破 banding」是「RNG state 撞收斂」
    的充分 mitigation，因為 banding ≠ pixel diff = 0
```

### F-5：minBounces = 3 在 Cloud rod 4-rod 多光源場景嚴重不足（致命，~70% 觸發）

**問題敘述**：

plan §B.3 / §G 踩坑點 2 設 uRRMinBounces = 3.0、含義「bounces == 0 (primary) / 1 (direct NEE) / 2 (1st GI) 永不 RR；bounces >= 3 才允許」。

問題：

- bounce 編號約定不一致：plan §B.3 寫「bounce 0 = primary、bounce 1 = 第 1 次 NEE」是業務語義；shader L963 for-bounces 迴圈 + L965 hard cap + L966 primaryRay flag 顯示「bounce N = N-th iteration of the for-loop」、不是 NEE-specific count
- bounce 1 不必然是「直接 NEE」：bounce 1 是「primary 命中後的 secondary ray」，可能是 NEE shadow ray（若上一輪 hitType 分支內 dispatch 了 NEE）、可能是 BSDF bounce（若上一輪是 SPEC/REFR 鏈）、可能是 diffuseBounce 切換
- bounce 2 不必然是「1st GI」：可能是更深的 secondary chain、可能是 diffuseBounce 從 INFINITY 切換來的 first DIFF
- minBounces = 3 的「保護 1st GI」含義在 Cloud rod 4-rod + 軌道 6 燈的多光源場景下、實際 GI 路徑長度分佈會偏向 4~7 bounces 才完成主要光路抽樣
- bounces == 3 起 RR 砍 → 4-rod Cloud 的「光源相互照明後的天花板反射回到地板」這條典型 GI 路徑（需 5~6 bounces）會被砍掉、Cloud 下方天花板區域 mean diff 偏暗

**觸發條件**：C3 / C4（Cloud rod 啟動）+ Cloud 下方天花板視角。

**為什麼致命**：

- plan 自評踩坑 2「minBounces 太低 → 整體變暗」mitigation 是「預設 3、踩坑時拉高到 5 排查」
- 但 plan §H 測試矩陣沒列 minBounces sweep（5 / 7 / 10）
- Step 0 探針只跑 minBounces = 3 一檔
- Step 0 fail（pixel diff > 容忍）時、無法區分「F1 hard gate 不可達」vs「F5 minBounces = 3 砍 GI」vs「F3 mask flow 觸 1.0 上界」三因素
- 對齊 user feedback「Path Tracing clamp 是診斷訊號不是 fix」：minBounces 太低是上游量綱錯誤級、不是調整 commit gate 蓋過的事

**修法建議**：

v2 §H 測試矩陣加 minBounces sweep：

```
H.5 minBounces sweep（Step 0 必跑）
  | minBounces | C1 spp/sec Δ | C2 Δ | C4 Δ | C1 mean diff | C2 ... | C4 ... |
  |------------|--------------|------|------|---------------|--------|--------|
  | 3 (v1 預設)| _            | _    | _    | _             | _      | _      |
  | 5          | _            | _    | _    | _             | _      | _      |
  | 7          | _            | _    | _    | _             | _      | _      |

  過閘規則：取 spp/sec Δ ≥ +5% 與 mean diff 過 P4' 統計閘 同時成立的最小
           minBounces 進 Stage B
  全 fail → 整段結案、走 step0-noop（公式族 + 站點不可行）
```

或更節省工程的做法：以 §4 Synthesis Stage A 的三 build #ifdef 切換、含 minBounces sweep。

---

## 6. 應修級問題（M-1 ~ M-5）

### M-1：Step 0 探針一槍試 Option 1、Option 2/3 留 v2 備案的 viable options 探索深度不足

**問題敘述**：plan §A.3 將 Option 2 (luminance) / Option 3 (NEE 後站點) 全列「v2 備案」、Step 0 僅試 Option 1。Option 1 在本 review F1/F2/F3/F5 攻擊下失敗機率 ≥ 70%；單發定生死、ralplan 共識整體 ROI 不正向（見 T3）。

**為什麼應修**：fast-skip 精神不該被誤用為「探索空間壓縮到 1 點」；多花 1.5 hr 寫雙 build #ifdef 切換、Step 0 fail-fast 時可區分公式族失敗 vs 特定公式失敗。

**修法建議**：v2 §D Step 0 改三 build 探針（max-channel + minBounces sweep × 2 + luminance + minBounces=3）、用 #ifdef 切換、共用同一份 if-block。對齊 §4 Synthesis Stage A。

### M-2：commit 門檻 +5% 與 ROADMAP「≤ 10%」估值之相對位置不明

**問題敘述**：plan §B.1 / §A.1 P5 設 commit 門檻 spp/sec Δ ≥ +5%，引 ROADMAP「桶 2 #2 ≤ 10%」估值之下界。但：

- ROADMAP「≤ 10%」是「桶 2 #2 整體（含 v1 + v2 + v3 三輪迭代）的上限」還是「Option 1 單站點的上限」？
- 若 v2 / v3 多站點才能榨到 +10%、Step 0 + 5% 門檻是「Option 1 單站點的合格線」是合理的；若 ROADMAP 估值已是單站點上限、+5% 門檻過於樂觀、Step 0 大概率 fail-fast

**為什麼應修**：commit 門檻紀律是 P5 hard gate 之一、但門檻數值的 anchor（ROADMAP ≤ 10%）含義模糊 → 對 Step 0 過閘判斷的可信度有影響。

**修法建議**：v2 §B.1 補述：

```
ROADMAP 桶 2 #2「≤ 10%」估值含義拆解：
  - 上限 10% 來自「教科書級 RR 在 path tracing 一般場景的典型加速比」之先驗
  - Home_Studio_3D 場景特化（box 78 + Cloud 4-rod + 軌道 6 燈 + 多 NEE 站點）
    對 RR 砍率有何加成 / 削弱、無實證、屬未驗 prior
  - +5% 門檻是「Option 1 單站點 + minBounces=3 + max-channel」的合格線，
    不是桶 2 #2 整段的合格線；若 Option 1 過 +5% 但 < +7%、可進 v2 試 Option 3
    NEE 後站點榨額外 +2~3%
  - 若 Option 1 + 三變數 sweep（§4 Synthesis Stage A）全 < +5%、整段結案
    （公式族整體不可行 / 場景對 RR 不友善）
```

### M-3：視覺驗證 C1~C4 配對與 Cloud rod / 軌道燈 / 4 燈條多光源組合的 coverage 不完整

> ⚠ **本段 C4 定義已過期**（2026-05-01 校正）：
> 實際 C4 = 只開軌道燈 + 廣角燈、Cloud 關閉（不是「C3 + 軌道全開」）。
> 本段論證採用當時錯誤定義（uActiveLightCount C4=10）、保留作 ralplan v1 共識歷史紀錄、
> v2 plan 已採正確定義；executor 階段啟動時須以正確定義重新評估 NEE pool 大小差異。

**問題敘述**：plan §H 測試矩陣以 C1/C2/C3/C4 為投票池、C3 棄權。但：

- C3 = 4 燈條（Cloud rod 4-rod 啟動、軌道燈關閉）
- 棄權 C3 = 棄權「Cloud rod 多光源」這條最重要的 RR 壓力測試
- C4 = C3 + 軌道 = Cloud rod + 軌道全開、是另一條 RR 壓力測試、但 plan 視 C4 為「中間」、未特別標 GI 路徑長度分佈
- 對 RR 而言、Cloud rod 4-rod 與軌道燈 6 燈的 NEE pool 大小不同（uActiveLightCount 在 C3=4、C4=10）→ NEE 抽樣機率差異 6.5×、對 mask 量綱影響直接連動 F3

**為什麼應修**：C3 棄權邏輯（F1 結案、啟動暫態 frame-skip 污染量測）對 Phase 1.0 量測協定合理；但對 RR 視覺驗證而言、C3 仍可在 1024-spp 跑（穩態下 frame-skip ≈ 0、§Phase 1.0 §5.2 結案結論）→ 視覺驗證不需棄權、僅 spp/sec 量測棄權。

**修法建議**：v2 §H 測試矩陣分拆：

```
spp/sec 量測（C3 棄權，沿用 v1）：C1/C2/C4
1024-spp 視覺驗證（C3 不棄權）：C1/C2/C3/C4 全跑
  C3 視覺驗證跑滿 1024 spp（穩態 frame-skip ≈ 0、不影響 mean diff）
  原因：C3 是 Cloud rod 4-rod 純壓力場景、本計畫對 RR 友善度的關鍵測試樣本
```

### M-4：firefly 風險的 mitigation 未對齊 user feedback 「clamp 是診斷訊號不是 fix」紀律

**問題敘述**：plan §G 踩坑點 4「continueProb 過小 + 1/p 補償放大 noise 成 firefly」mitigation 寫「clamp(maxThroughput, 0.05, 1.0) 下限 0.05 → 補償倍率 ≤ 20 倍」「若 firefly 出現 → 提高下限到 0.1 重試」。

問題：

- 0.05 下限本身是「對 firefly 風險的 clamp」、不是設計參數
- 「若 firefly 出現 → 提高到 0.1」是 clamp band-aid pattern（user feedback「clamp 是診斷訊號」精神）
- v2 應該問的是：firefly 出現時、根因是「continueProb 過小 + 1/p 過大」還是「mask 在 NEE bake 後本身就是巨數、與 RR 補償疊加」？

**為什麼應修**：clamp 0.05 下限本身對 firefly 是 mitigation 而非 fix，plan 已對齊；但「若 firefly 出現提高下限」的 escalation path 是 band-aid pattern、應改為「firefly 出現 → 排查 mask 上游量綱（uLegacyGain × uIndirectMultiplier × emit baked 是否疊加溢出）」。

**修法建議**：v2 §G 踩坑 4 mitigation 改寫：

```
踩坑點 4：continueProb 過小 + 1/p 補償放大 noise 成 firefly
  風險：continueProb = 0.01 → 1/p = 100 倍補償 → mask 局部巨大放大 → firefly
  
  mitigation 第 1 層（保留）：clamp(maxThroughput, 0.05, 1.0) 下限 0.05、補償 ≤ 20
  mitigation 第 2 層（新增）：mask 上游量綱排查（對齊 user feedback「Path Tracing
    clamp 是診斷訊號不是 fix」）
    若 firefly 出現：
      a. 不調 0.05 下限（這是 band-aid）
      b. 量測 mask max-channel 在 bounces ∈ [3, 14] 之分佈（探針 instrumentation）
      c. 確認 mask 是否在 NEE bake 後 × uLegacyGain × uIndirectMultiplier 疊加溢出
         （uLegacyGain 1.5 × uIndirectMultiplier 預估 1.0~2.0 = 1.5~3.0 per NEE）
      d. 若疊加溢出、根因在上游量綱、不在 RR；本計畫整段結案、寫退場報告
      e. 若疊加正常、firefly 是 RR 自身 variance 過大、改 minBounces sweep + 升 0.1
         下限為次選緩解
  禁止：
    - 加 emission clamp 蓋 firefly（user feedback 紀律）
    - 加 5×5 cross-bilateral 蓋 firefly（user feedback 紀律）
    - 直接調 0.05 下限到更大（屬 band-aid，不解上游問題）
```

### M-5：對齊 R6-2 已四連敗（R6-1 / SAH / leaf packing / F2 Stage A）的失敗教訓未充分內化

**問題敘述**：plan §A.1 P1 寫「對齊 R6-2 已四連敗（R6-1 / SAH / leaf packing / F2 Stage A）後『fast-skip + 純 instrumentation 或純 termination 之外不動』精神」、但具體教訓拆解未做。

四連敗的真實教訓清單（從 HANDOVER + REPORT 提煉）：

```
R6-1 (Phase 1.5 Step 1 SAH builder)：演算法效果未知時 prototype-first
  → 本 plan 對齊 ✓（Step 0 探針）

leaf packing (Phase 1.5 Step 2)：ANGLE Metal 自動 DCE 已對 hot path 做了大部分
  優化、人為 packing 上限 ≤ 1%
  → 本 plan 借鑒度：低（ANGLE Metal 對 RR uniform branch 也可能 codegen 成 select()
    → mode 0 / mode 1 兩路徑都跑 → RR 通過分支也付 mask /= continueProb 算術成本、
    收益吃進 overhead；plan 未討論）

F2 Stage A (bucket 4 F2 timer breakdown)：1 處 if 分支已 ≥ 1.24% 拖慢、13 處加齊
  必加倍；ANGLE Metal 對 uniform branch 偏向 select() codegen
  → 本 plan 借鑒度：低（本 plan 1 處 if 分支同類風險、Step 0 commit 門檻 +5%
    在 ANGLE select() codegen 拖慢 1~2% 之下、實質有效門檻 +6~7%、Plan 未討論）
```

**為什麼應修**：plan §A.1 P1 引述「四連敗精神」流於口號、具體教訓未拆解 → Step 0 探針失敗模式分析不完整、退場報告 root cause 假說範圍不足。

**修法建議**：v2 §A.1 P1 補述具體教訓 + §G 風險矩陣加新踩坑點：

```
踩坑點 7（新增）：ANGLE Metal uniform branch select() codegen 自身拖慢
  風險：1 處 if (uRussianRouletteEnabled > 0.5 && bounces >= int(uRRMinBounces))
        被 ANGLE Metal 編譯為 select() / cmov、mode 0 (RR off) 也付兩路徑
        dead code 成本 → spp/sec 自身拖慢 1~2%、實質有效 commit 門檻 +6~7%
  證據：F2 Stage A Step 0 step0-noop §2 實證 1 處 if 拖慢 ≥ 1.24%
  mitigation：v2 Step 0 必跑 RR uniform OFF（uRussianRouletteEnabled = 0.0）vs
              Phase 1.0 baseline 之 spp/sec Δ；若 OFF 已拖慢 ≥ 1%、扣回門檻
              基準後再判 ON 之 +5%；若 OFF 拖慢 ≥ 3%、整段結案（branch 自身代價
              已壓死收益）
  退場：Stage B 升 #ifdef N+1 build（編譯時切、無 runtime branch overhead），但
        本計畫 Short consensus 不啟、留 v2 備案
```

---

## 7. 推薦修正後的設計變更（給 Planner v2 的明確指令）

### 7.1 必修（Must-fix，等同 CRITICAL_REVISION_REQUIRED 條件）

```
MR1. §A.1 P4 + §D.4 + §E.2 + §H.3 hard gate 重寫（對應 F1 / F2）
     原條：1024-spp pixel diff = 0 / AE = 0 / mean diff ≤ 1e-4
     改為（P4'）：
       - RR OFF baseline 跑 N=4 次（不同 frame seed）取 sample mean + σ_path
       - RR ON 對 baseline_mean：mean diff ≤ 3 × σ_path / √1024 (3-sigma)
       - KS test p-value > 0.05（不能拒絕同分佈假設）
       - 兩條件均過 → 過閘；任一不過 → 回滾
     §B.4 Energy compensation 段重寫：補述 variance increase + 1024-spp 觀測值
       性質、正確標明「mean unbiased ≠ pixel-exact」

MR2. §A.2 D2 + §G 踩坑 1 RNG 引用更正（對應 F4）
     原條：「rng() 為 hash(uv, frameCounter, bounces) 派生」
     改為實際 PathTracingCommon.js L3070-L3093 機制：
       - rng()：IQ Shadertoy hash、uvec2 seed 自累、每呼叫 advance state
       - rand()：Jacco Bikker 2024、randNumber 自累 + blueNoise + frameCounter×0.618
       - rng() 與 rand() 是兩個獨立 RNG state、不是 wrapper 關係
       - 與 progressive sampling 相容性：每 frame init 不同（不撞 banding）
       - 但 RR ON 多消耗 1 次 rng() → RNG sequence shift 1 步 → pixel diff ≠ 0
         （對齊 MR1 統計閘改寫）

MR3. §C.4 / §C.5 + §A 程式碼骨架 mask flow 互動分析重寫（對應 F3）
     原條：「對既有 mask flow 透明、無互動 bug 風險」
     必新增：
       a. mask max-channel 在 bounces ∈ [3, 14] 之分佈量測（探針 instrumentation、
          runtime-impossible guard 包裹）
       b. continueProb 觸 1.0 上界比例之預期：> 80% → Option 1 不可行
       c. RR break 守門：willNeedDiffuseBounceRay == TRUE 時不 RR
          if (uRussianRouletteEnabled > 0.5 && bounces >= int(uRRMinBounces)
              && willNeedDiffuseBounceRay == FALSE)
          {
              float maxThroughput = max(max(mask.r, mask.g), mask.b);
              float continueProb = clamp(maxThroughput, 0.05, 1.0);
              if (rng() >= continueProb) break;
              mask /= continueProb;
          }

MR4. §D Step 0 三 build 探針（對應 F5 / M-1）
     原條：單探針 Option 1 max-channel + minBounces=3
     改為三 #ifdef build 切換：
       A1：max-channel + minBounces=3（v1 原始）
       A2：max-channel + minBounces=5（minBounces sweep）
       A3：luminance + minBounces=3（公式族 sweep）
     量測：3 builds × C1/C2/C4 共 9 組 spp/sec + 3 builds × C1/C2/C3/C4 共 12 組
            1024-spp KS test
     工程成本：+1.5~2.5 hr、用 #include header 共用骨架
     fail-fast 分流：見 §4 Synthesis Stage A

MR5. §H 測試矩陣分拆（對應 M-3）
     spp/sec 量測（C3 棄權）：C1/C2/C4
     1024-spp 視覺驗證（C3 不棄權）：C1/C2/C3/C4 全跑
     C3 穩態 frame-skip ≈ 0（Phase 1.0 §5.2 結案）→ 視覺驗證可信
```

### 7.2 應修（Should-fix）

```
SR1. §B.1 補述 ROADMAP「≤ 10%」估值含義拆解（對應 M-2）
     拆解上限來源 + 場景特化未驗 prior + +5% 門檻是 Option 1 單站點合格線

SR2. §G 踩坑 4 firefly mitigation 改寫（對應 M-4）
     加上「mask 上游量綱排查」第 2 層 mitigation
     禁用 emission clamp / bilateral / 直接調 0.05 下限

SR3. §G 風險矩陣加踩坑 7 ANGLE Metal select() codegen 拖慢（對應 M-5）
     加 RR uniform OFF vs Phase 1.0 baseline 自身拖慢量測作為 Step 0 第 0 步
     （若 OFF 拖慢 ≥ 3%、整段結案、不必試 ON）

SR4. §A.3 Option 2 / Option 3 重排為「v2 sweep 候選」非「備案」
     對應 §4 Synthesis、Step 0 三 build 探針把 Option 1/2 同期試（Option 3 仍備案
     因為涉及 caller-side 13 處改動、與 P1 純度衝突）

SR5. §F-fast-skip 退場報告 root cause 假說擴充
     6 條 → 7 條（加 ANGLE select() codegen），且 root cause 不只列「哪條命中」、
     必同時列「mask 分佈量測結果支持哪條」
```

### 7.3 建議（Nice-to-have）

```
NTH1. §A.4 期望收益不寫死「+5%」
      對齊 leaf packing v3 體例「條件式 + 命中率」表達：
        - 若 mask 分佈量測顯示 < 1.0 上界比例 ≥ 50% + minBounces sweep 找到甜蜜點
          → 預期 +5~10%
        - 若觸 1.0 上界比例 > 80%（NEE-rich 場景常見）→ 預期 ≤ +1%、整段結案

NTH2. §E.4 commit message 範本對齊 plan v3 leaf-packing 體例
      原版本對齊 OK，加一條：「KS test p-value = X、3-sigma mean diff ≤ Y」
      對齊 MR1 統計閘

NTH3. plan 標題 v1 → v2 + 修訂歷史補入 ITERATE 原因
      對齊 plan v3 leaf-packing 體例
```

---

## 8. 對 Step 0 探針設計的特別審查（fast-skip 對齊評估）

### 8.1 與 F2 step0-noop 體例對齊度

```
| 體例項目                      | F2 step0-noop §2 (前車)         | 本 plan v1 §D Step 0       | 對齊度 |
|-------------------------------|----------------------------------|----------------------------|--------|
| 探針程式碼 ≤ 8 行             | 11 行 (uniform + entry guard)    | 8 行 (uniform + RR check)   | ✓      |
| Phase 1.0 baseline 對比       | 4 config × Δ%                    | 4 config × Δ%              | ✓      |
| 量測協定 5 秒 RAF             | 對齊                             | 對齊                       | ✓      |
| C3 棄權邏輯                   | 對齊                             | 對齊                       | ✓      |
| commit gate ≥ +5%             | < 1% 嚴格版                      | ≥ +5%                      | ✗ 鬆   |
| 1024-spp pixel diff           | 未要求（純 spp/sec gate）         | 要求 = 0（→ F1 不可達）     | ✗ 設錯 |
| ANGLE codegen 拖慢自身校正    | 未做（事後分析才提）              | 未做（→ M5 應修）            | ✗      |
| viable options 探索深度       | 1 處 if 試（單一 build）          | 1 build 試（單一 Option）   | ✗ 同病 |
| Step 0 退場報告體例           | 完整（root cause 6 條假說）       | 草擬（root cause 6 條假說） | ✓      |

整體對齊度：60%（前車「commit gate 鬆」+「pixel diff 設錯」+「viable options 1 點」
              三個結構性問題本 plan 全部繼承）
```

### 8.2 Step 0 探針 1 處 RR check 站點代表性評估

```
站點 = bounce 迴圈頭、SceneIntersect 之前（plan §A.3 Option 1）

對全建構（v2 / v3 假設場景）的代表性：
  ✓ 對「RR 是否能砍 ray」之代表性：100%（所有 bounce 都過此站）
  ⚠ 對「RR 與 mask flow 互動」之代表性：偏低（mask 在 hitType 分支內變化、Step 0
    不量測 mask 分佈、看不到 continueProb 觸 1.0 上界比例 → F3）
  ✗ 對「RR 與 minBounces 互動」之代表性：單檔 minBounces=3、看不到 sweep
    response（→ F5）
  ✗ 對「ANGLE select() codegen 拖慢」之代表性：偏低（v1 沒做 RR uniform OFF vs
    Phase 1.0 自身拖慢量測 → M5）

最少踩坑 + 量到的 Δ 對全建構代表性結論：
  - 對「RR 收益期望」：代表性高（站點 + Option 1 公式族確實有代表性）
  - 對「RR 失敗 root cause 鑑別」：代表性低（單 build 看不出 minBounces / 公式
    形態 / mask 分佈 三者哪個是主因）
  - 一槍試 fail-fast 後的退場結論：可信「Option 1 不可行」、不可信「公式族整體
    不可行」（→ T3 / M-1 升 3 build 探針）
```

### 8.3 Step 0 commit 門檻 +5% 在 ANGLE select() 拖慢校正後的有效閾值

```
F2 step0-noop 實證：1 處 if 分支拖慢 ≥ 1.24%（C2 高可信度）
本 plan：1 處 if (uRussianRouletteEnabled > 0.5 && bounces >= int(uRRMinBounces))
        + 後續 if (rng() >= continueProb) break；
        + mask /= continueProb；

ANGLE Metal codegen 對 uniform branch 偏向 select() / cmov：
  mode 0 (RR off)：付出兩路徑 dead store 成本，但不付 mask /= continueProb 計算
                  （因 break 路徑也是 dead）
  mode 1 (RR on)：實際分歧 thread 內走不同路徑，warp divergence 成本

預估 RR uniform OFF vs Phase 1.0 baseline 拖慢：1~2%（與 F2 同類）

實質有效 commit 門檻：
  名義 +5% spp/sec Δ
  扣回 RR uniform OFF 自身拖慢 1~2%
  實質 RR 自身的 +5% 對應 ON vs Phase 1.0 之 +6~7%

結論：v1 +5% 名義門檻在校正 codegen 拖慢後、實質門檻 +6~7% → 比名義嚴 1~2 個百分點
建議：v2 SR3 必跑 RR uniform OFF baseline 對 Phase 1.0 之 Δ% 量測、用此校正名義 +5% 門檻
```

---

## 9. Principle 違反清單（雖非 deliberate 模式、仍列重點）

### 嚴重級違反

```
P4 違反（Pixel-exact correctness gate）→ F1 / F2
  位置：plan §A.1 P4 / §D.4 / §E.2 / §H.3
  違反：1024-spp pixel diff = 0 / AE = 0 hard gate 在 RR ON 條件下數學上不可達
  影響：plan 自設 hard gate、自己無法達成；Step 0 視覺驗證階段必觸發回滾
  嚴重度：致命（plan 為 fail-by-design）

P2 違反（Prototype-first verification）→ M-1 / T3
  位置：plan §A.4 + §D Step 0
  違反：Step 0 單 build / 單 Option 試、其餘 viable options 全 v2 備案
  影響：fast-skip 精神被誤用為「探索壓縮到 1 點」；fail-fast 無法區分公式族失敗
        vs 特定公式失敗
  嚴重度：高
```

### 中度違反

```
P5 違反（Threshold discipline）→ M-2 / M-5 / SR3
  位置：plan §A.1 P5 + §B.1
  違反：commit 門檻 +5% 與 ROADMAP 估值關係模糊；ANGLE codegen 拖慢自身未校正
  影響：實質有效門檻被推高至 +6~7%、過閘判斷可信度下降
  嚴重度：中
```

### 輕度違反 / 無違反

```
P1 範圍純度（Domain purity）：合格
  8 行 GLSL + 2 行 JS、單一站點、改動 < 16 行；F2 v1 13 處 if 之痛不重演
  唯一隱憂：v2 SR3 / MR4 加 mask 分佈探針 instrumentation、站點數從 1 升 2~3
            （但 instrumentation 在 runtime-impossible guard 內、不打 mode 0 主路徑）

P3 Atomic + reversible commits：合格
  Step 0 / 1 / 2 / 3 / F-fast-skip 各獨立 commit、git revert 可達
```

---

## 10. 必親自驗證事實清單（grep / Read 結果）

### 10.1 PathTracingCommon.js RNG 機制（對齊 F4 / MR2）

```
查詢：Read PathTracingCommon.js L3070-L3093
結果：
  L3070  THREE.ShaderChunk[ 'pathtracing_random_functions' ] = `
  L3072  float blueNoise;
  L3073  float randNumber;
  L3076-L3082  float rand() = Jacco Bikker 2024
  L3086  uvec2 seed;
  L3087-L3093  float rng() = IQ Shadertoy hash + seed += uvec2(1) + 1103515245U
結論：rng() 不是 hash(uv, frameCounter, bounces)；rand() 不是 rng() wrapper
影響 plan：F4 / MR2 / §A.2 D2 引用更正
```

### 10.2 shader RNG 呼叫實際使用點

```
查詢：grep -nE "rng\(|rand\(" Home_Studio_Fragment.glsl
結果：rng() 2 處 (L269 NEE slot pick + L367 Cloud rod jitter)
       rand() 12 處 (metal gate L1240/1327/1378/1524/1631/1741/1781/1790 等)
結論：plan §A.2 D2 引用 L269 / L367 對；引用 L1240/1327/... 對；但歸類「rand()
     為 rng() 同源 wrapper」錯（兩者獨立 RNG state）
影響 plan：F4 / MR2
```

### 10.3 mask 累乘 pattern 全列（對齊 F3 / MR3）

```
查詢：grep -n "mask \*=\|mask =\s*diffuseBounceMask" Home_Studio_Fragment.glsl
結果：
  - L929 init: mask = vec3(1)
  - mask *= hitColor: 30+ 處（hitType 分支內、衰減）
  - mask *= weight * uLegacyGain: 10 處（NEE dispatch 後、放大）
    L1265/1303/1351/1403/1511/1550/1611/1656/1765/1819
  - mask = diffuseBounceMask * uIndirectMultiplier: 13+ 處（diffuse bounce 切換、放大）
    L978/1051/1093/1132/1176/1195/1726 等
結論：mask 量綱在 NEE 後 + diffuse 切換後 ≥ 1 機率高、continueProb 觸 1.0 上界
     比例可能 > 80%
影響 plan：F3 / MR3 / 必加 mask 分佈量測探針
```

### 10.4 willNeedDiffuseBounceRay 切換點全列（對齊 F3 / MR3）

```
查詢：grep -n "willNeedDiffuseBounceRay = TRUE\|willNeedDiffuseBounceRay == TRUE" Home_Studio_Fragment.glsl
結果：13+ 處（INFINITY L976、各 hitType 分支 + diffuseBounceMask 設定 + 切換）
結論：RR break 點在 SceneIntersect 之前、若 willNeedDiffuseBounceRay == TRUE
     已被上一輪設、此 break 會跳過 diffuseBounceMask reset → 能量損失
影響 plan：F3 / MR3 / 程式碼骨架加守門 willNeedDiffuseBounceRay == FALSE
```

### 10.5 R3-1 DCE-proof sink pattern（對齊 §4 Synthesis runtime-impossible guard）

```
查詢：Read shader L1840-L1855
結果：
  if (uR3EmissionGate < -0.5)  // runtime-impossible guard、R3 gate 恆 0 或 1
     accumCol += sum(uniforms);  // DCE-proof
結論：本計畫 Stage A 三 build 探針的 mask 分佈量測可採同源 pattern
影響 plan：§4 Synthesis Stage A 程式碼設計
```

### 10.6 Phase 1.0 baseline 數值對齊

```
查詢：Read .omc/REPORT-R6-2-Phase-1.0.md
結果：C1=34.30 / C2=31.56 / C3=30.78 / C4=30.39 spp/sec
       C1=29.9 / C2=32.4 / C3=33.3 / C4=33.7 秒 1024-spp
結論：plan §B.2 baseline 數值與 Phase 1.0 §2 對齊
影響 plan：無；數值正確
```

### 10.7 F2 step0-noop ANGLE codegen 拖慢實證（對齊 M-5 / SR3）

```
查詢：Read .omc/REPORT-R6-2-bucket4-F2-step0-noop.md
結果：1 處 if (uSegmentMode > 0.5 && uSegmentMode < 1.5) 拖慢 ≥ 1.24% (C2 高可信度)
結論：本計畫 1 處 if (uRussianRouletteEnabled > 0.5 && bounces >= int(uRRMinBounces))
     同類風險、預估自身拖慢 1~2%、應扣回實質 commit 門檻
影響 plan：M-5 / SR3 / Step 0 第 0 步加 RR uniform OFF baseline 量測
```

### 10.8 sampleStochasticLightDynamic 結構（對齊 F3）

```
查詢：Read shader L253-382
結果：
  L253  函式定義
  L257-262 uR3ProbeSentinel 守門
  L263-268 uActiveLightCount 守門
  L269+   slot pick + 14+ emitter-specific 分支
結論：本計畫 RR check 在 SceneIntersect 之前、與此函式時序分離（plan §C.3 對）
     但 mask 在 NEE dispatch 後 = mask *= weight * uLegacyGain 之放大效應仍
     影響下一輪 RR check 的 continueProb 評估
影響 plan：F3 / MR3
```

---

## 11. 範圍純度檢查（守門禁忌 1）

```
範圍邊界檢查（v1 plan 自設 7 條守門）：
  ✓ 不修 BVH 結構 — 守
  ✓ 不修 BRDF 材質分支 — 守
  ✓ 不修 NEE pool — 守
  ✓ 不修 MIS heuristic — 守
  ✓ 不修 emission baking — 守
  ✓ 1024-spp pixel diff = 0（→ F1 改寫為統計閘、非 pixel-exact）
  ✓ 禁用 clamp 蓋過 firefly — 守（M-4 補強）
  ✓ 禁用後處理 denoiser 蓋過 — 守
  ✓ 量綱紀律「mask /= p 純無單位倒數補償」— 守（plan §B.8 對）

「順手改」誘惑檢查：
  ✓ 沒有 BVH builder JS 改動誘惑 — plan 已禁
  ✓ 沒有材質參數順手改 — plan 已禁
  ⚠ MR3 加 willNeedDiffuseBounceRay == FALSE 守門：本來只 1 個 if、現在 1 個複合 if
    不算範圍擴大（同個 if block）
  ⚠ MR4 三 build 探針：站點數仍 1、但編譯時 #ifdef 切；屬於 instrumentation 範
    圍內（runtime-impossible guard 不打 mode 0），合格
  ⚠ SR3 RR uniform OFF 量測：是量測協定、非 shader 改動，合格

結論：範圍純度合格度高、本 plan 仍是 R6-2 內最乾淨之一；
     v2 修訂後 instrumentation 站點仍 1（mask 分佈量測在 R3-1 sink 同源 guard 內）
```

---

## 12. v2 期待時程估算

```
v2 修訂工程量（對應 MR1~MR5）：
  MR1 hard gate 統計閘改寫：~1 hr 寫程式碼 + 1 hr 文件
  MR2 RNG 引用更正：~0.5 hr 文件
  MR3 mask flow + 程式碼骨架：~1 hr 寫程式碼 + 1 hr 文件
  MR4 三 build 探針：~2~3 hr 寫程式碼 + 1 hr 文件
  MR5 §H 測試矩陣分拆：~0.5 hr 文件

v2 plan 預估：5~7 hr 工程 + 文件
v2 Step 0 探針執行：2~3 hr 寫程式碼 + 1.5 hr 量測（vs v1 估 0.5 hr 寫 + 20 分鐘量測）

預估觸發機率：
  v2 Step 0 過閘 → 進 Step 1 commit：30~50%
    （v1 估 70~80%、本 review F1/F2/F3/F5 攻擊下機率下修）
  v2 Step 0 fail-fast 整段結案：50~70%
    （ralplan ROI：花 v1 plan 837 行 + Architect r1 + v2 修訂 → 節省 v1 直接 commit
      後翻車的 1~2 天 + 翻車 root cause 追查）

對齊 ralplan ROI 標準：
  v2 修訂 5~7 hr、v2 Step 0 執行 4~5 hr → 共 ~10~12 hr 投資
  vs 不做 v2 → v1 直接 commit → F1 hard gate 必死 → 1024-spp pixel diff > 容忍 →
       回滾 + root cause 追查 1~2 天 = 8~16 hr
  ROI ≈ 0~6 hr 節省 + 提升結案結論可信度
```

---

## 13. 對 Planner v2 的最關鍵 1 條（必修第一個）

**「P4 hard gate 改寫為統計閘（MR1）」必修第一個**：

理由：

- F1 / F2 是本 plan 唯一的 fail-by-design 致命；不修 F1，v2 Step 0 視覺驗證階段必死
- 其餘 F3~F5 / M-1~M-5 在 F1 修好之前都無法被 Step 0 探針正確偵測（因為偵測機制 = pixel diff、且 pixel diff 機制本身錯）
- F1 修好（改 KS test + 3-sigma mean diff）→ 探針有偵測力 → F3~F5 / M-1~M-5 才能被 Step 0 真實量測逐一驗證或排除
- 對 Planner 的提示：
  - 不要先修 F4（RNG 引用文字錯誤）— 那是論證可信度問題、不是 plan 結構問題
  - 不要先修 F5（minBounces sweep）— 那是 Step 0 探針內容問題、在 Step 0 機制不對之前修了也白搭
  - 先修 F1 → P4'統計閘 → §B.4 數學重寫 → §D.4 視覺驗證重設計 → §E.2 commit gate 重寫 → §H.3 測試規則重寫 → 五處連動

---

## 14. 修訂歷史

```
v1 → v2 修訂原因（待 Planner v2 補入）：
  - F1 / F2：1024-spp pixel diff = 0 hard gate 在 RR ON 條件下數學不可達
            → 改寫為 KS test + 3-sigma mean diff 統計閘
  - F3：mask flow 互動分析錯誤 → 加 mask 分佈量測 + willNeedDiffuseBounceRay 守門
  - F4：RNG 引用錯誤 → 對齊 PathTracingCommon.js L3070-L3093 實際機制
  - F5：minBounces 單檔不足 → 三 build #ifdef 探針（minBounces sweep + 公式族 sweep）
  - M-1：viable options 探索深度不足 → Stage A 三 build 並試
  - M-2：commit 門檻 +5% 與 ROADMAP 估值關係模糊 → 補述拆解
  - M-3：C3 視覺驗證棄權誤判 → 分拆 spp/sec C3 棄權 / 1024-spp C3 不棄權
  - M-4：firefly mitigation 帶 band-aid 風險 → 加 mask 上游量綱排查
  - M-5：四連敗教訓未充分內化 → 加 ANGLE select() codegen 拖慢踩坑點

修訂歷史：
- 2026-04-27 r1 初版（Architect Round 1 review；5 致命 + 5 應修；對 v1 837 行）
```
