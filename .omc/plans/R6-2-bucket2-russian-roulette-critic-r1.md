# R6-2 桶 2 #2 Russian Roulette Plan v1 — Critic Review Round 1

> Round: 1
> Reviewer: critic agent (opus)
> Mode: THOROUGH → 後段升 ADVERSARIAL（理由見 §10 Verdict Justification）
> 日期：2026-04-27
> 對象：
>   - `.omc/plans/R6-2-bucket2-russian-roulette.md` v1（Planner Round 1，837 行）
>   - `.omc/plans/R6-2-bucket2-russian-roulette-architect-r1.md`（Architect Round 1，984 行，CRITICAL_REVISION_REQUIRED）
> 上層脈絡：
>   - HANDOVER：`.omc/HANDOVER-R6-2.md`（R6-2 內已四連敗、桶 2 #2 為推薦下一步）
>   - 體例對齊：`.omc/plans/R6-2-bucket4-F2-critic-r2.md`（4 MAJOR + 5 MINOR + 3 建議結構）
>   - SOP：`docs/SOP/R6：渲染優化.md` §守門禁忌

---

## 1. Verdict

**ITERATE（白話：必須修，但 Architect 已經抓得很準，Planner v2 直接照清單套即可進 Critic Round 2 final approval）**

不能 APPROVE 的核心理由（單條足以阻擋）：

```
J1（必修）：F-1 / F-2 構成的「pixel-exact hard gate fail-by-design」結構性死結
          已被 Architect r1 確認，Planner v1 §A.1 P4 / §B.4 / §D.4 / §E.2 / §H.3
          全部斷裂；不修則 Step 0 視覺驗證必觸 AE > 容忍 → 立即回滾 → plan 走不到
          Step 1 commit。屬 CRITICAL_REVISION_REQUIRED 級。

J2（必修）：F-3 mask flow 互動分析錯誤已親驗（grep 結果 mask *= weight × uLegacyGain
          10 處 + mask = diffuseBounceMask × uIndirectMultiplier 13+ 處），且
          Architect r1 §10.3 / §10.4 之事實清單我親自驗證屬實。本 critic 補強：
          willNeedDiffuseBounceRay == FALSE 守門對 break 路徑能量損失的修補必要、
          且 v1 程式碼骨架沒列、屬於「沒看到的盲點」級漏洞。

J3（必修）：F-3 之外、本 critic 額外抓到 v1 §B.4 / §B.6 / §B.7 三段內含一個
          Architect r1 沒明確點出的二階問題：「continueProb 觸 1.0 上界 → 形同沒做
          RR」雖然 spp/sec Δ ≈ 0% 看起來像 fail-fast 正確結案，但實質根因是「RR
          沒運作、不是 RR 沒效果」；plan 沒有 detection 機制可以區分這兩者，等於
          Step 0 退場報告的 root cause 假說會誤判。詳 §6 額外 MAJOR 問題 MJ-A。

J4（必修）：A.3 invalidation rationale 對 Option 2 / Option 3 的淘汰理由含 strawman
          成分（特別是 Option 2 luminance-based 之「砍率過高 → 偏色」推論未經實證、
          與 Architect F-3 量測未做之事實衝突）。詳 §5 Architect 觀點認同度。
```

ITERATE 含義：v2 必修 Architect r1 之 MR1~MR5 + 本 review §6 / §7 之額外 MAJOR / MINOR；無新致命級反饋；v2 完成後可一輪內升 Critic Round 2 APPROVE。

預期 Verdict 對齊：使用者交付任務指定「預期 Verdict ITERATE」與本判斷一致；Architect r1 已 CRITICAL_REVISION_REQUIRED、不會直接 APPROVE 之預測命中。

---

## 2. Quality Criteria 評估表

| 維度 | 評分 | 證據與判斷 |
|------|------|------------|
| Principle-Option Consistency | **Pass with reservations** | P1~P5 5 條原則完整，且 Option 1 對 P1 純度 / P3 atomic / P5 紀律對齊；但 P4「pixel-exact correctness gate」與 Option 1 RR ON 機制本質互斥（Architect F-1 / F-2、本 critic 認同），屬 plan 內部死結。修法：P4 改寫為統計閘（MR1）即解決一致性。 |
| Fair Alternatives | **Fail** | Option 數 = 3 ✓、bounded pros/cons ✓、但 Option 2 / Option 3 之 invalidation rationale 含 strawman（見 §5 對 §A.3 之認同度）。Option 2 「luminance 砍率過高 → 偏色」未經實證即排除，與 Architect M-1「viable options 探索深度不足」呼應。 |
| Risk Mitigation Clarity | **Pass with reservations** | 6 個踩坑點 + 風險矩陣總表完整，但：(a) 踩坑 4 firefly mitigation 含 clamp band-aid pattern（user feedback 違例，Architect M-4）；(b) 缺 ANGLE select() codegen 拖慢踩坑（Architect M-5）；(c) 缺「continueProb 觸 1.0 上界 → 形同沒做 RR」debugging 路徑（本 critic MJ-A 新抓）。 |
| Testable Acceptance Criteria | **Fail** | 「spp/sec Δ ≥ +5%」可機械驗 ✓；「1024-spp pixel diff = 0」在 RR ON 不可機械驗 ✗（F-1 已斷）；「視覺驗證」描述為「肉眼檢 firefly / banding」過於主觀、未對齊 magick AE 量化規則 7 體例（F2 critic-r2 §2 指出之問題本 plan 沿用）。 |
| Concrete Verification Steps | **Pass with reservations** | §F Step 0 ~ Step 3 編號清楚、含 5 秒 RAF 量測腳本可執行 ✓；但 §H 測試矩陣 Step 0 / Step 1 / Step 2 三列數據格相同 → 無法判斷 Step 1 commit 後重驗應該驗什麼（Architect 沒抓、本 critic 補 MN-A）。 |

加權結論：5 維度中 **2 Fail + 3 Pass with reservations**，無 1 維度純 Pass，對應 Verdict ITERATE。

---

## 3. Architect r1 觀點認同度（逐條評估）

### 3.1 致命級 F-1 ~ F-5

| Finding | 認同度 | 補充意見 |
|---------|--------|----------|
| **F-1**（pixel diff = 0 hard gate 數學不可達） | **完全認同** | Architect 推論完整。本 critic 額外驗證：plan §B.4「→ 1024-spp pixel diff = 0 可達」推論錯（mean unbiased ≠ pixel-exact），與 F-2 重疊但 F-1 焦點在「hard gate 設計」、F-2 焦點在「數學基礎錯誤」、兩條應分開列、Architect 處理正確。**本 critic 加碼**：plan §A.1 P4 寫「在 vsync jitter / RNG sequence 容忍區內 ≤ 1e-4 mean diff」這句的「RNG sequence 容忍」用詞自己就承認 RNG 會偏離，但又設 AE = 0 為 hard gate，是 plan 自相矛盾的明證。 |
| **F-2**（mean unbiased → pixel diff = 0 是統計謬誤） | **完全認同** | Architect 之 σ 推導正確。本 critic 補：教科書 Veach §10.4.2 之 RR variance increase factor 推導為 `Var = E[1/p × X²] − E[X]² ≥ E[X²] − E[X]²`，其中 E[1/p] ≥ 1，等號僅當 p = 1（永不 RR）；plan §B.4 假設 p_avg = 1 是 Option 1 觸 1.0 上界場景的退化。 |
| **F-3**（mask flow 互動分析錯誤） | **完全認同 + 加碼** | Architect 之三個子問題（A 觸上界、B mask 量綱、C willNeedDiffuseBounceRay 守門）我親驗 grep 屬實。**本 critic 加碼**：MR3 程式碼骨架加 `willNeedDiffuseBounceRay == FALSE` 守門是必要但不充分的修補；還需要量化「破窗時 mask 上游量綱實際分佈」（即 Architect §4 Synthesis Stage A 之 mask max-channel 分佈量測）才能判斷是否要再加 percentile-based 公式。詳 §6 MJ-A。 |
| **F-4**（RNG state 來源描述錯誤） | **完全認同** | 我親驗 PathTracingCommon.js L3070~L3093（透過 Architect §10.1 之引用 + grep 確認）：rng() 是 IQ Shadertoy hash + uvec2 seed 自累、rand() 是 Jacco Bikker + randNumber + blueNoise + frameCounter×0.618、兩者獨立 RNG state。plan §A.2 D2 描述為「rng() 為 hash(uv, frameCounter, bounces) 派生」+「rand() 為 rng() 同源 wrapper」均錯。Architect 之 MR2 修法（引用 PathTracingCommon.js L3070~L3093 實際機制）是必修。**Severity 補述**：F-4 雖然致命級分類，但 root cause 是「文件引用錯誤」、不是「設計錯誤」；fix 工程量極小（~0.5 hr）；對 plan 整體可信度的衝擊大、是 Architect 排「致命」之合理理由。 |
| **F-5**（minBounces = 3 在 Cloud rod 場景嚴重不足） | **部分認同** | Architect 推論「Cloud rod 4-rod 多光源 GI 路徑 4~7 bounces」之數量級對；但「bounces ≥ 3 起 RR 砍 → 第 2 次 GI 砍掉」之含義在 Option 1 站點（SceneIntersect 之前）需要再校準：bounces = 3 RR check 對應的是「即將開始 bounce 3 之 SceneIntersect」、實際從 0 開始算的「第 3 次 GI」、不是「第 2 次 GI」。這是業務語義 vs shader bounce 編號之歧義（Architect §F-5 之 sub-issue「bounce 編號約定不一致」其實已點出，但結論段又把「砍掉第 2 次 GI」當定論、矛盾）。**修法不變**：MR4 三 build minBounces sweep 仍是正解、本 critic 認同；但 v2 plan 寫作上需要把 bounce 編號約定統一（業務語義 vs shader iteration count）。 |

### 3.2 應修級 M-1 ~ M-5

| Finding | 認同度 | 補充意見 |
|---------|--------|----------|
| **M-1**（viable options 探索深度不足） | **完全認同** | T3 tradeoff 推論正確。本 critic 加碼：F2 critic-r2 之 OQ1 已確認此 pattern 是 R6-2 內 ralplan 共識的系統性問題（leaf packing v3 / F2 v3 都犯同類錯）、屬於「ralplan 系統踩坑」、需在 R6-2 全局 SOP 補一條（建議入 follow-up）。 |
| **M-2**（commit 門檻 +5% 與 ROADMAP ≤ 10% 關係模糊） | **完全認同** | SR1 修法（補述拆解）合理、工程量小。 |
| **M-3**（C3 視覺驗證棄權誤判） | **完全認同 + 修正方向認同** | Architect 之分拆「spp/sec C3 棄權 / 1024-spp C3 不棄權」是正解；對 Cloud rod 4-rod 是 RR 友善度的關鍵測試樣本之判斷正確。 |
| **M-4**（firefly mitigation 帶 clamp band-aid pattern） | **完全認同 + 體例對齊** | SR2 修法（加 mask 上游量綱排查第 2 層 mitigation）對齊 user feedback「Path Tracing clamp 是診斷訊號不是 fix」精神。本 critic 補：v2 §G 踩坑 4 寫法應對齊 R3-7「方向 A 定性文件化（1.7 / 1.5 框架補償非歸一魔數）」之體例：明確標「0.05 下限是工程平衡、不是物理參數」。 |
| **M-5**（四連敗教訓未充分內化、缺 ANGLE select() codegen 拖慢踩坑） | **完全認同** | SR3 加踩坑 7 + Step 0 第 0 步 RR uniform OFF baseline 量測是必修。**本 critic 加碼**：F2 step0-noop 之 1.24% 拖慢實證 + 本 plan 之 if 結構 + mask /= continueProb 算術（mode 0 也要付 ANGLE select() codegen 之兩路徑 dead code 成本），預估自身拖慢比 F2 略高、≥ 1.5% 量級；v2 SR3 量測時應把這個預期數字標出。 |

### 3.3 Architect r1 整體素質

```
Antithesis 段（§2）：✅ steelman 完整、6 條反方論點 + 5 條 Architect 自己承認反方有道理的部分
Tradeoff Tensions（§3）：✅ T1~T3 三條真實 tension、條條打到 plan 結構
Synthesis（§4）：✅ Stage A 三 build #ifdef 探針 + KS test 統計閘是高品質方案
F1~F5 致命級：✅ 全部認同（F-5 部分認同、含 sub-issue 校準）
M-1~M-5 應修級：✅ 全部認同
親驗事實清單（§10）：✅ 8 條 grep / Read 結果可信（本 critic 親驗 §10.1 / §10.3 / §10.4）
範圍純度檢查（§11）：✅ 守門禁忌全列、v2 修訂後仍合格判斷正確

Architect r1 漏抓的盲點（→ 本 critic §6 / §7 補）：
  - MJ-A：「continueProb 觸 1.0 上界 → 形同沒做 RR」之 detection 機制缺失
  - MJ-B：A.3 Option 2 / Option 3 invalidation rationale 之 strawman 成分
  - MN-A：§H 測試矩陣 Step 0 / Step 1 / Step 2 三列數據格相同 → 重驗目的模糊
  - MN-B：§G 踩坑點 5「uMaxBounces 互動」之驗證手段「拉 1/7/14 三檔肉眼檢」量化不足
  - MN-C：plan §F Step 3-4 「更新 SOP §階段 1.5 後加段」具體位置 / wording 模糊
```

整體：Architect r1 是 R6-2 內最高品質的 review 之一，與 Planner v1 一起構成已涵蓋約 85% 重要問題的雙文件，本 critic 補的 5 條（2 MAJOR + 3 MINOR）屬於補強而非翻盤。

---

## 4. CRITICAL Findings

無。

理由：F-1 ~ F-5 雖屬致命級設計死結，但全部已被 Architect r1 抓出 + 提供具體修法（MR1~MR4）；本 critic 認同 Architect 評估、不另開 CRITICAL。

---

## 5. MAJOR Findings（造成顯著重工或結論偽通過）

### MJ-A（continueProb 觸 1.0 上界 → 形同沒做 RR、無 detection 機制 → Step 0 退場報告 root cause 誤判）

```
位置：plan v1 §B.2 + §D.4 + §F-fast-skip + §G 風險矩陣總表

問題敘述：
  Architect F-3 已點出「mask 在 NEE bake 後 + diffuse 切換後 ≥ 1 機率高、continueProb
  觸 1.0 上界比例可能 > 80%」之 mask flow 結構問題。但 Architect 的修法（MR3 加
  willNeedDiffuseBounceRay 守門 + Stage A mask 分佈量測）解決的是「不要 RR 期間錯誤
  break」，沒有解決「RR check 通過率 100% → spp/sec Δ ≈ 0% → Step 0 fail-fast → 退場
  報告寫『RR 收益期望不足』」之 root cause 誤判。

  具體 fail mode 推演：
    1. Step 0 探針跑：RR ON、minBounces = 3、max-channel
    2. 量測：C1/C2/C4 spp/sec Δ = +0.3% / +0.1% / +0.5%（皆 < +5%）
    3. plan §F-fast-skip F-3 寫 root cause 「最大概率：踩坑點 4 firefly 風險未現但
       站點收益期望 < +5%、或踩坑點 6 NEE 互動讓 RR 砍率過低」
    4. 結論：「Option 1 不可行、考慮路徑 D Option 2 / 路徑 E Option 3」
    5. 真實 root cause：continueProb 觸 1.0 上界比例 > 80% → RR 沒運作、不是 RR
       無收益；換 Option 2 luminance 也救不了（luminance 對 NEE bake 後 mask 同樣
       會觸上界）；換 Option 3 NEE 後站點才可能解（mask 在 NEE 之前 throughput < 1
       的機率高）

Confidence：HIGH

backtick 證據：
  plan v1 §B.2 寫 `continueProb = clamp(max(mask.r, mask.g, mask.b), 0.05, 1.0)`
              + `upper bound 1.0：mask 滿能量時不 RR`
  plan v1 §G 風險矩陣總表「踩坑 6 NEE 互動」detection 寫 `✅ pixel diff`
  → pixel diff 在「RR 沒運作」場景下 = 0（因為 mask 沒被 /p 補償、與 baseline 完全
     一致）→ 偵測機制反向失效
  shader 親驗（§Architect §10.3 grep 結果）：
    `mask *= weight * uLegacyGain` 10 處（uLegacyGain = 1.5）
    `mask = diffuseBounceMask * uIndirectMultiplier` 13+ 處（uIndirectMultiplier ≥ 1）
  → mask 累乘後任一通道 ≥ 1 之機率高（與 Architect F-3 量化一致）

Why this matters：
  - Architect §4 Synthesis Stage A 之 mask 分佈量測解決 detection 問題（Architect 漏點明）
  - 但 Stage A 工程量 +1.5~2.5 hr、Planner v2 可能省略量測腳本、退化為 v1 同類盲點
  - Step 0 退場報告 root cause 假說範圍若沒擴充到「continueProb 觸上界」，未來 Option 1
    fail-fast 時、推薦下一步會誤導（Option 2 同樣會 fail，但會被誤以為「沒試過」）
  - 對齊 user feedback「PT 黑白畫面 debug 先掃 accumCol 寫入點、別先跳 hitType 分支
    假說」精神：Phase 1 第一步必檢查最基本的數學前提（continueProb 分佈），不是先
    跳 Option 公式族切換假說

Fix（v3 必修，作為 Architect MR3 + MR4 補強條件）：
  a. v2 §F-fast-skip F-3 退場報告 root cause 假說擴充為 7 條（不是現在的 6 條）：
     新增「踩坑 7：continueProb 觸 1.0 上界比例 > 80% → RR check 永過、形同沒做 RR」
  b. v2 §D Step 0 第 0 步必加：mask max-channel 分佈直方圖量測（Architect §4 Stage A
     已涵蓋）+ continueProb 觸上界比例之單一統計值（建議閾值 80%）
  c. v2 §F-fast-skip F-3 退場分流必加：
     若 continueProb 觸上界比例 > 80% → 推薦下一步 Option 3（NEE 後站點）、而非
     Option 2（luminance），因為 Option 2 同樣會觸上界
     若 continueProb 觸上界比例 ∈ [50%, 80%] → 推薦 Option 1 + minBounces sweep
     若 continueProb 觸上界比例 < 50% → Option 1 公式 + 站點都對、根因是場景對 RR
     不友善（單純 +5% 上限不夠）→ 整段結案
```

### MJ-B（A.3 Option 2 / Option 3 invalidation rationale 含 strawman 成分、未對齊「Fair Alternatives」紀律）

```
位置：plan v1 §A.3 Option 2 排除理由 + Option 3 排除理由

問題敘述：
  Option 2 luminance-based 排除理由 4 條中：
    - 「砍率過高 → R 通道收斂變慢、出現偏色風險」
    - 「暗暖場景 lum 可能 < 0.05 一直觸 lower bound、補償倍率永遠 20 倍 → firefly
       風險 > Option 1」
  兩條都是「未經實證的猜測」。Architect F-3 / 本 critic MJ-A 之共同論點是「mask 在
  NEE bake 後常 ≥ 1」、那 luminance = dot(mask, vec3(0.2126, 0.7152, 0.0722)) 同樣
  會 ≥ 1 → continueProb 同樣觸 1.0 上界 → 「砍率過高」之假設不成立。

  Option 3 NEE 後站點排除理由 3 條中：
    - 「13 處 if 加齊後拖慢必加倍」（對齊 F2 step0-noop §2 教訓）
    - 「與既有 willNeedDiffuseBounceRay 切換 + diffuseBounceMask cache 邏輯互動：
      若 RR break 在 NEE dispatch 之後、willNeedDiffuseBounceRay 設定之前 → 漏發
      diffuse bounce ray、收斂變慢」
  第 1 條合理（F2 實證對齊）；第 2 條合理（本 critic 同意）。但 plan §A.3 結語寫
  「保留為 v2 備案：若 Option 1 過閘但 Δ ∈ [+1%, +5%) 灰色帶（理論上 Option 3 更準
  可能多榨 +2~3%），再啟動 ralplan 共識評估」之觸發條件是 strawman：Architect MJ-A
  / 本 critic 推測 Option 1 大概率因「continueProb 觸 1.0 上界」而 spp/sec Δ ≈ 0%、
  落不到「+1%~+5% 灰色帶」、Option 3 永不被啟動 → 實質排除。

Confidence：HIGH

backtick 證據：
  plan v1 §A.3 Option 2 排除理由 line 207-210：
    `Option 1 max-channel 已是「保色比 + 補償倍率可控」雙優、Option 2 僅在 perceptual
     層面理論優、實作面缺點壓倒`
  plan v1 §A.3 Option 3 排除理由 line 235-238：
    `保留為 v2 備案：若 Option 1 過閘但 Δ ∈ [+1%, +5%) 灰色帶（理論上 Option 3
     更準可能多榨 +2~3%），再啟動 ralplan 共識評估`
  plan v1 §A.3 統整 line 242-245：
    `三條 viable options 結構一致（同站點族 / 同公式族），失敗風險高度相關 →
     Step 0 一槍試 Option 1、fail-fast 即整段結案`
  → 「失敗風險高度相關」承認 Option 2 可能同樣 fail；那為什麼還排「保留 v2 備案」？

Why this matters：
  - 對齊 ralplan 紀律「Fair Alternatives」：fair 的標準是「未採選項的排除理由必須對
    主選項同等嚴格」，本 plan 對 Option 1 的攻擊面遠不如 Architect r1 的攻擊面、
    對 Option 2 / 3 的攻擊面卻偏多 → 不公平
  - Step 0 fast-skip 路徑被 Option 2/3 排除的問題卡住：若 Architect MR4 三 build
    sweep 沒被 v2 接受、Step 0 結果只有 Option 1 一張、fail-fast 後使用者推到 path D
    （Option 2）/ path E（Option 3）的決策無實證支撐

Fix（v3 必修）：
  a. v2 §A.3 Option 2 排除理由刪掉「砍率過高 → 偏色」之未實證主張，改為：
     「Option 2 luminance 與 Option 1 max-channel 同屬 mask 純度評估族、在 NEE bake
      後 mask 量綱被 uLegacyGain × uIndirectMultiplier 推高情境下、兩者 continueProb
      觸 1.0 上界比例可能同階；Option 2 排除主因不是 perceptual 偏色、是與 Option 1
      失敗風險高度相關（同因同果）→ Architect MR4 已覆蓋（A1/A2/A3 三 build sweep
      含 Option 2）」
  b. v2 §A.3 Option 3 排除理由保留 13 處 if 拖慢 + diffuse bounce ray 互動兩條，刪掉
     「+1%~+5% 灰色帶」strawman 觸發條件、改為「Option 3 啟動條件 = Architect Stage A
     mask 分佈量測顯示 continueProb 觸 1.0 上界比例 > 80%」
  c. v2 §A.3 統整段對齊 Architect §4 Synthesis Stage A：明確列「3 build sweep 是
     公平 alternatives 探索的最小單位、Option 1 + Option 2 同期試（含 minBounces
     sweep），Option 3 才是真正的『v2 備案』因為涉及 13 處 caller-side 改動」
```

---

## 6. MINOR Findings（建議改善但不阻擋）

```
MN-A（§H 測試矩陣 Step 0 / Step 1 / Step 2 三列數據格相同 → 重驗目的模糊）
  位置：plan v1 §H.1 line 731-736
  問題：三列「Step 0 RR ON / Step 1 commit / Step 2 重跑驗證」格式完全相同、無說明
        Step 1 commit 後重驗應該驗什麼（commit 不應改變數據、那為什麼要重驗？）
  Fix：v2 §H.1 加註腳：
       Step 0 RR ON：探針期、重點 spp/sec Δ + 1024-spp 統計閘
       Step 1 commit：commit 後僅做煙霧測試（spp/sec 抽 1 config 跑一次確認 commit
                       hash 不影響執行、不必跑全 4 config）
       Step 2 重跑驗證：vsync jitter 容忍重跑（C1/C2/C4 各重跑 1 次、應落在 Step 0
                         ±5% 內）+ 視覺驗證
  對齊體例：F2 v3 §C.5 三表分拆 Stage A / Stage B 體例

MN-B（§G 踩坑點 5「uMaxBounces 互動」驗證手段量化不足）
  位置：plan v1 §G 踩坑 5 line 691-699
  問題：「GUI 拉 uMaxBounces 1 / 7 / 14 三檔、確認視覺合理變化（1 = 直接光最暗、
        7 = 中、14 = 全亮）」是肉眼定性檢、不是量化驗證
  Fix：v2 改為「GUI 拉 uMaxBounces 1 / 7 / 14 三檔、各跑 256-spp 截圖、magick
       compare 證明（uMaxBounces=1 整體最暗、=14 整體最亮、=7 介中）+ luminance
       histogram peak 應呈遞增」
  對齊體例：plan §H.2 magick AE 量測協定

MN-C（§F Step 3-4「更新 SOP §階段 1.5 後加段」具體位置 / wording 模糊）
  位置：plan v1 §F Step 3-4 line 650
  問題：「階段 1.5 後加段『桶 2 #2 RR 已結案、收益 +X%』」這個「加段」位置不明（是
        新增段還是改既有段？wording 是 plan 範本還是自由發揮？）
  Fix：v2 §F Step 3-4 改為：
       「在 docs/SOP/R6：渲染優化.md §86 結構優化分流之後新增段『§87 桶 2 #2
        Russian Roulette 結案』、wording 對齊 §86 a/d 結案段體例（含 Verdict / 收益 /
        rollback path / follow-up 4 段）」
  對齊體例：HANDOVER §86 a/d 結案段格式

MN-D（plan §A.4 期望收益寫死「+5% 為下界」、未對齊 Architect M-2 拆解）
  位置：plan §A.4 不存在（plan v1 沒有 §A.4 節，但 §B.1 line 256-260 寫死收益門檻）
  問題：Architect M-2 已點出 ROADMAP「≤ 10%」估值之含義拆解、本 critic 認同；但
        plan v1 §A.1 P5 / §B.1 都沒對應段
  Fix：v2 補 §A.4 期望收益段（對齊 leaf-packing v3 體例）：
       「條件式收益表達：
        - mask 分佈量測顯示 continueProb 觸上界 < 50% + minBounces sweep 找到甜蜜點
          → 預期 +5~10%
        - 觸上界比例 ∈ [50%, 80%] → 預期 +1~5%（灰色帶、Option 3 升級觸發條件）
        - 觸上界比例 > 80% → 預期 ≤ +1%、整段結案」
  對齊體例：leaf packing v3 step0-noop 條件式收益段

MN-E（plan §B.4 數學期望段公式排版 + LaTeX 量綱缺失）
  位置：plan v1 §B.4 line 387-394
  問題：寫成 `E[mask after RR | mask before] = continueProb × (mask / continueProb) +
        (1 - continueProb) × 0 = mask` 之 ASCII 表達 OK、但 Architect F-2 點出之
        Variance 公式 `Var = mask² × (1/p − 1)` 在 v1 plan 完全沒列、屬數學基礎不全
  Fix：v2 §B.4 補完整統計性質段（Mean + Variance 並列）+ 引用 Veach §10.4.2
  對齊體例：plan v3 leaf-packing §B 演算法設計段
```

---

## 7. What's Missing（gaps、unhandled edge cases、unstated assumptions）

```
Gap 1：「continueProb 觸 1.0 上界比例」之 Step 0 量測閾值未設
  → MJ-A 已詳列、必修

Gap 2：Step 0 探針執行「失敗 N 次後放棄」策略未列
  → 若 Step 0 跑 1 次過閘、Step 1 commit 後 Step 2 重跑漂移、再回到 Step 0 排查...
     plan §H.4 寫「重跑 N 次取中位數」但 N 未指定、漂移閾值未指定 → 有可能無限循環
  → Fix：v2 §H.4 加「N=3 中位數 / 3 次內漂移仍 > 5% 視為量測誤差不可接受、回滾」

Gap 3：Brave 桌面 ontouchstart 誤判 user feedback 未引用
  → user feedback「Brave 桌面 ontouchstart 誤判」指 mouseControl 守門、與本 plan
     的 RR uniform GUI 切換可能互動（GUI scaffold 在 plan §B.2 line 300-304 提到
     「Step 3 視覺驗證後再決定是否暴露 GUI」）
  → 影響極小、列為 gap 但不必修

Gap 4：Step 0 fail-fast 後 git checkout 之 Home_Studio.html cache busting query
  保留作為實證痕跡（plan §F-fast-skip F-2「cache busting query 留作實證痕跡」對齊
  F2 step0-noop 體例）→ 這條對 v1 寫對 ✓、但「實證痕跡保留」之語意未定義保留多久 /
  下次重啟 RR ralplan 時要不要清掉
  → 建議 v2 §F-fast-skip F-2 加「保留至下個桶 R 主線結案後清理」

Gap 5：探針程式碼之 GLSL preprocessor #ifdef 切換（Architect MR4 三 build sweep）
  之具體 cache busting 命名規則未定
  → 建議：?v=r6-2-rr-step0-A1 / -A2 / -A3 三檔切換、對齊 plan §F Step 0-3 的 query
     體例

Gap 6：visual verdict skill 未啟用
  → plan §H.2「視覺驗證跑 magick AE」可進一步用 visual-verdict skill 之 Structured
     Visual QA 報告體例強化、但本計畫範圍內可選不強制
  → 列為 nice-to-have

Gap 7：plan §C.6 關於「mask /= p 是否正確」之代數驗證未列
  → 公式正確（Veach §10.4.1）、但 plan 沒對 RR 與既有 BSDF 路徑追蹤之 ∫f cos(θ)/p
     重要性抽樣框架的 algebraic alignment 寫一段 → 屬數學嚴謹性 gap、非阻擋
  → 不列必修
```

---

## 8. Ambiguity Risks

```
歧義 1：plan §B.3「bounce 1 = 第 1 次 NEE 直接光」業務語義 vs shader bounce 編號
  Quote：「bounce 0 = primary ray、bounce 1 = 第 1 次 NEE 直接光、bounce 2 = 1 次間接光」
  Interpretation A（業務語義）：每個 bounce 對應「視角累積一次光路相遇」，與
                              hitType 分支直接光 NEE 一一對應
  Interpretation B（shader 實作）：bounce N = N-th iteration of for-loop、與
                                NEE-specific count 解耦；bounce 1 可能是 BSDF
                                bounce / 可能是 diffuse 切換 / 可能是 NEE shadow
  風險：v2 Planner 若依 Interpretation A 寫 minBounces 描述、會誤導實作 reviewer
        誤以為「bounces == 1 必為 NEE」、從而忽略 bounces == 1 是 SPEC chain
        中段的可能性
  Fix：v2 §B.3 統一用 Interpretation B（shader iteration count）寫法、配合
       「若 bounces == 1 對應 SPEC 路徑中的反射、bounces == 2 才是真正 BSDF 間接光」
       之 footnote

歧義 2：plan §A.1 P4 hard gate「在 vsync jitter / RNG sequence 容忍區內 ≤ 1e-4
       mean diff」
  Quote：「1024-spp pixel diff = 0 強制（與 Phase 1.0 baseline 比 magick AE = 0
         或在 vsync jitter / RNG sequence 容忍區內 ≤ 1e-4 mean diff）」
  Interpretation A：AE = 0 是首選、≤ 1e-4 是備選
  Interpretation B：AE = 0 是 hard gate、≤ 1e-4 只是說明文字、實際還是 AE = 0
  風險：兩種解讀給出不同 commit 條件 → Architect F-1 之「fail-by-design」攻擊本來
        基於 Interpretation B、若 v2 改寫為 Interpretation A 似乎可以保住 hard
        gate；但 1e-4 對 RR variance 增量仍嚴（F-2 計算 σ_X × √2/1024 ≈ 4e-4），
        Interpretation A 也死
  Fix：v2 直接照 Architect MR1 改寫為 P4' 統計閘、消除歧義

歧義 3：「Step 0 探針 ≤ 8 行 GLSL」之計數規則
  Quote：plan §A 改動範圍「shaders/Home_Studio_Fragment.glsl（新增 < 16 行）」
        + plan §A.3 Option 1「程式碼骨架（≤ 8 行 GLSL，純 instrumentation 級新增）」
  Interpretation A：8 行是 RR check 站點程式碼、16 行含 uniform 宣告 + 註解
  Interpretation B：8 行是含註解、與「16 行」矛盾
  風險：v2 review 時若用 grep 行數驗證、「8 行」與「16 行」可能挑哪個有歧義
  Fix：v2 統一規格「shader 改動 ≤ 16 行（含 2 行 uniform + 4 行註解 + 8 行 RR check
       + 2 行空行）」+ §A.3 Option 1 改「≤ 6 行 GLSL（不含註解）」
  對齊體例：F2 critic-r2 之「13 處 if 之 12 vs 13 vs 11+1+1」三處數字不一致同類
            問題、本 plan 應預先解決
```

---

## 9. Multi-Perspective Notes

### 9.1 Executor 視角

```
能不能照 plan 走完每一步而不卡關？
  Step 0 探針 → 卡：plan v1 沒列「continueProb 觸上界比例」量測腳本（MJ-A）
  Step 1 commit → 半卡：plan §E.4 commit message 範本對齊 OK、但 §H.1 三表格相同
                         讓 executor 不確定 Step 1 commit 後要驗什麼（MN-A）
  Step 2 多 config 驗證 → OK
  Step 3 結案 report → 半卡：§F Step 3-4 SOP 加段位置 / wording 模糊（MN-C）

執行 Step F-fast-skip 退場時 → 卡：root cause 假說 6 條沒涵蓋 MJ-A 之「觸上界形同
  沒做 RR」、executor 會誤判 root cause 為「公式不對 → 試 Option 2」、而真實 root
  cause 是「站點 / mask 量綱不對 → 試 Option 3」
```

### 9.2 Stakeholder 視角

```
plan 是否真解決 stated problem？
  stated problem：spp/sec +5~10% 提升、1024-spp 牆鐘 30~34s → 縮短
  實際：plan v1 的 hard gate 設計（pixel-exact）使探針必觸發回滾、永不 commit、
        實質不解決 stated problem
  → 這是 Architect F-1 攻擊的核心、也是本 critic Verdict ITERATE 的根本理由

success criteria 是否 measurable？
  spp/sec Δ ≥ +5%：✓ measurable
  1024-spp pixel diff = 0：✗ not measurable（在 RR ON）
  視覺檢無 firefly / banding：✗ subjective、未對齊 magick AE 體例

scope 是否 appropriate？
  對齊 R6-2 桶 2 #2 ROADMAP「≤ 10%」估值、scope OK
  但若 Stage A 三 build 探針 + KS test 統計閘升級成立、scope 從 1~2 天升到 ~4~5 天
  → Stakeholder 要重新評估 ROI
```

### 9.3 Skeptic 視角

```
最強反方主張：「plan v1 + Architect r1 已經 985 + 837 = 約 1822 行、再寫 critic r1 +
                  Planner v2 + Architect r2 + Critic r2 + executor 工程量、ralplan
                  ROI 是負的」

具體攻擊：
  - F2 ralplan v3（leaf packing v3）合計 ~5500 行 + Architect r1~r3 + Critic r1~r3、
    最終 Step 0 fail-fast、淨節省工程 8~13 hr 但 ralplan 自身已花 ~4~6 hr
    → 兩次 ralplan 累計 ROI ≈ +20~30 hr 但消耗 ~10~15 hr 共識文件工程
  - 本 plan 規模類似、ROI 預估也類似
  - 與其多輪 ralplan、不如 v1 + Architect r1 即定稿、進 v2 編輯版 + executor 直接跑

反方無法駁倒的部分：
  - 若 Critic r1 不執行、F-1 死結進 executor 階段、回滾 + root cause 追查 1~2 天 = 8~16 hr
  - Critic r1 執行成本 ~1~2 hr（本 review 共識文件） + Architect r2 + Critic r2 各
    ~1~2 hr = 3~6 hr 投資、防禦 8~16 hr 翻車成本、ROI 仍 +5~10 hr
  - 對齊 user feedback「ralplan + Step 0 探針 fast-skip pattern」之系統性 ROI 已實證

Skeptic 結論：Verdict ITERATE 合理、但 v3 必須是「definitive、不再 r3 / r4 重複迴圈」、
              Architect r2 + Critic r2 必為「APPROVE w/caveats」、否則 ROI 倒掛
```

---

## 10. Verdict Justification

```
本 review 操作模式：
  Phase 1 Pre-commitment 預測 5 條：
    1. F-1 / F-2 之 hard gate 死結（已被 Architect 點出）→ 命中 ✓
    2. mask flow 觸上界 → 命中 ✓（Architect F-3 + 本 critic MJ-A 加碼）
    3. RNG 引用錯誤 → 命中 ✓（Architect F-4）
    4. minBounces 探索深度不足 → 命中 ✓（Architect F-5 + M-1）
    5. ANGLE codegen 拖慢未校正 → 命中 ✓（Architect M-5）

  → 5/5 命中、Architect r1 已涵蓋 ~85% 重要問題、本 critic 補強 15%

  Phase 2 ~ 4 投入：~1.5 hr review、含 PathTracingCommon.js / shader L963-L1840
  / open-questions.md 親驗

  ESCALATION 觸發：
    - 0 CRITICAL（Architect 已涵蓋）→ 不升 ADVERSARIAL
    - 2 MAJOR（MJ-A / MJ-B）+ 5 MINOR（MN-A~MN-E）→ THOROUGH 結束
    - 但 MJ-A 屬「Architect 漏抓的 detection 機制盲點」+ MJ-B 屬「fairness 問題」
      → 後段升 LIGHT-ADVERSARIAL（檢視 Architect §A.3 / §F-fast-skip / §H.1 三段）
    結果：升級確認 Architect r1 已抓到 8.5/10 分、本 critic 補完成 9.5/10 分

  Phase 4.5 Self-Audit：
    - MJ-A confidence HIGH、有 mask flow grep + 觸上界推演證據（MEDIUM 升 HIGH）
    - MJ-B confidence HIGH、quote-based 自證
    - MN-A~MN-E confidence MEDIUM ~ HIGH、無下移
    → 全保留、無移到 Open Questions

  Phase 4.75 Realist Check：
    MJ-A：realistic worst case = Step 0 fail-fast 後使用者推 Option 2 浪費 1~2 hr
          → 不嚴重、但 detection 機制缺失之 root cause 誤判是真的、保 MAJOR
    MJ-B：realistic worst case = v3 invalidation rationale 改寫的編輯工程、< 1 hr
          → 但「Fair Alternatives」是 ralplan 紀律、保 MAJOR
    → 無 downgrade

對齊預期 Verdict：使用者交付任務指定「預期 Verdict ITERATE（因 Architect 已
                CRITICAL_REVISION_REQUIRED、不會直接 APPROVE）」、本 critic 對齊。

Architect r1 整體素質評分：8.5/10（致命 5 + 應修 5 全對、漏 2 個 detection 與
                                      fairness 盲點）
```

---

## 11. Ralplan summary row

```
Principle/Option Consistency: Pass with reservations（P4 與 Option 1 互斥、Architect MR1 修法即解）
Alternatives Depth: Fail（A.3 invalidation rationale 含 strawman、本 critic MJ-B + Architect M-1 雙抓）
Risk/Verification Rigor: Pass with reservations（6 踩坑 + 矩陣完整、缺 ANGLE codegen + continueProb 觸上界 detection 兩條）
Deliberate Additions：N/A（本 plan 短模式、不啟 deliberate）

ITERATE 條件：
  必修 → MR1（hard gate 統計閘改寫）+ MR2（RNG 引用更正）+ MR3（mask flow + willNeedDiffuseBounceRay 守門）
       + MR4（三 build #ifdef sweep 探針）+ MR5（C3 視覺驗證不棄權）
       + MJ-A（continueProb 觸上界 detection 補強）+ MJ-B（A.3 invalidation rationale 改寫）
       + 7 條 root cause 假說（v2 §F-fast-skip）

  應修 → SR1~SR5 + MN-A~MN-E

升 APPROVE 條件：
  v2 必修 + 應修 全閉鎖 + 無新致命 + Architect r2 給「APPROVE w/caveats」、
  本 critic r2 一輪內可升 APPROVE。
```

---

## 12. v2 必修清單（按優先序、給 Planner 明確指令）

```
P1（必修第一個、否則後續修法都白搭、對齊 Architect §13 之「對 Planner v2 的最關鍵 1 條」）：
  MR1：§A.1 P4 + §B.4 + §D.4 + §E.2 + §H.3 hard gate 統計閘改寫
       原條：1024-spp pixel diff = 0 / AE = 0 / mean diff ≤ 1e-4
       改為：RR OFF baseline 跑 N=4 次取 sample mean + σ_path、RR ON 對 baseline_mean
            mean diff ≤ 3 × σ_path / √1024 (3-sigma) + KS test p-value > 0.05、雙條件
            均過 → 過閘
       理由：F-1 / F-2 是 plan 唯一的 fail-by-design；F-1 修好之前 F-3~F-5 / MJ-A 都
            無法被 Step 0 探針正確偵測

P2（必修第二個）：
  MR3 + MJ-A：§C.4 / §C.5 + §A 程式碼骨架 mask flow 互動分析重寫
        a. 加 mask max-channel 在 bounces ∈ [3, 14] 之分佈量測（Architect Stage A 已
           涵蓋）
        b. 加「continueProb 觸 1.0 上界比例」單一統計值（閾值 80%）
        c. 程式碼骨架加 `willNeedDiffuseBounceRay == FALSE` 守門
        d. v2 §F-fast-skip F-3 退場 root cause 假說從 6 條擴充為 7 條（加「踩坑 7：
           continueProb 觸上界」）
        e. 退場分流：觸上界 > 80% → 推 Option 3、∈ [50%, 80%] → 推 Option 1 + minBounces
           sweep、< 50% → 場景對 RR 不友善、整段結案
        理由：MR3（Architect F-3）+ MJ-A（本 critic）合修；不解此條 Step 0 退場報告
              root cause 必誤判

P3（必修第三個）：
  MR4：§D Step 0 三 build #ifdef 探針
       A1: max-channel + minBounces=3
       A2: max-channel + minBounces=5
       A3: luminance + minBounces=3
       工程：~1.5~2.5 hr 寫程式碼、用 #include header 共用骨架
       理由：F-5 + M-1 + MJ-B 合修；fast-skip 探索深度從 1 點升 3 點、ROI 正向

（後續優先序：MR2 / MR5 / SR1~SR5 / MN-A~MN-E、見 §5 / §6 / §7）
```

---

## 13. 體例對齊評估（vs F2 ralplan v3 共識體例）

```
| 體例項目                          | F2 v3 體例（前車）                      | 本 plan v1 + r1            | 對齊度 |
|-----------------------------------|------------------------------------------|----------------------------|--------|
| RALPLAN-DR Summary 結構           | A.1 5 Principles + A.2 D1~D3 + A.3 ≥ 2 options | 對齊                       | ✓      |
| Architect r1 結構                 | Verdict + Antithesis + Tradeoff + Synthesis + F1~Fn + M1~Mn | 對齊                       | ✓      |
| Critic r1 結構                    | Verdict + Quality Criteria + Architect 認同度 + 額外 MAJOR + 額外 MINOR + v2 必修清單 | 本檔對齊                   | ✓      |
| Step 0 探針 fast-skip 體例        | F2 step0-noop / leaf packing step0-noop | 對齊（plan §F-fast-skip）    | ✓      |
| 退場報告路徑體例                   | .omc/REPORT-R6-2-bucket4-F2-step0-noop.md | .omc/REPORT-R6-2-bucket2-rr-step0-noop.md | ✓      |
| cache busting query 體例          | ?v=f2-step0-probe                        | ?v=r6-2-rr-step0           | ✓      |
| commit message 範本               | F2 v3 §E.4 體例                          | 對齊                       | ✓      |
| open-questions.md 同步紀律        | F2 v3 caveat C1 之必同步紀律             | 本 plan v1 沒列、v2 必補    | ✗      |
| ADR 結構（v3 補完）               | F2 v3 §E ADR Decision/Drivers/...       | 對齊（v1 placeholder）      | ✓      |
| 修訂歷史                           | v1 → v2 → v3 修訂原因明列                 | v1 留 placeholder、v2 必補  | △      |

整體對齊度：90%（10/11 ✓ + 1 缺 + 1 △）
缺漏項：open-questions.md 同步紀律（v2 應加 §F Step 3-4 條目同步 Q12「continueProb
        觸上界 detection」+ Q13「ANGLE codegen 拖慢」之提交紀律）
```

---

## 14. 修訂歷史

```
v1 → v2 修訂原因（待 Planner v2 補入）：
  - F-1 / F-2：1024-spp pixel diff = 0 hard gate 數學不可達 → MR1 統計閘改寫
  - F-3：mask flow 互動分析錯誤 → MR3 加 mask 分佈量測 + willNeedDiffuseBounceRay 守門
  - F-4：RNG 引用錯誤 → MR2 對齊 PathTracingCommon.js L3070-L3093
  - F-5：minBounces 單檔不足 → MR4 三 build #ifdef sweep
  - M-1：viable options 探索深度不足 → MR4 + MJ-B 合修
  - M-2：commit 門檻 +5% 與 ROADMAP 估值關係模糊 → SR1
  - M-3：C3 視覺驗證棄權誤判 → MR5 分拆
  - M-4：firefly mitigation 帶 band-aid 風險 → SR2 加上游量綱排查
  - M-5：四連敗教訓未充分內化 → SR3 加 ANGLE codegen 踩坑 7
  - MJ-A（本 critic）：continueProb 觸上界 detection 機制缺失 → MR3 + §F-fast-skip 7 條 root cause
  - MJ-B（本 critic）：A.3 Option 2 / 3 invalidation rationale strawman → §A.3 改寫
  - MN-A：§H 測試矩陣三列重複 → 註腳分拆
  - MN-B：§G 踩坑 5 驗證量化不足 → magick + histogram
  - MN-C：§F SOP 加段位置 / wording 模糊 → 對齊 §86 體例
  - MN-D：補 §A.4 條件式收益段
  - MN-E：補 §B.4 Variance 公式

修訂歷史：
- 2026-04-27 r1 初版（Critic Round 1 review、ITERATE、0 CRITICAL + 2 MAJOR + 5 MINOR
                       + 認同 Architect r1 之 5 致命 + 5 應修；對 plan v1 837 行 +
                       Architect r1 984 行）
```
