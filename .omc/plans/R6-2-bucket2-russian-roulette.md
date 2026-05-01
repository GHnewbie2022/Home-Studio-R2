# R6-2 桶 2 #2 — Russian Roulette 路徑提早終結優化 Plan v2（ralplan 共識草案）

> 版本：v2
> 日期：2026-04-28
> 模式：Short consensus（無 `--deliberate`、無 high-risk auto-trigger；不必 pre-mortem 與 expanded test plan；但因 Architect r1 命題碰觸 path tracer 正確性 hard gate，本 v2 修訂以 deliberate-equivalent 嚴審處理）
> Round：v2（Planner 第 2 輪、回應 Architect r1 + Critic r1 全部 ITERATE 清單）
> 上層脈絡：
>   - HANDOVER：`.omc/HANDOVER-R6-2.md` §候選路徑 B（推薦下一步）
>   - ROADMAP：`.omc/ROADMAP-R6-2-optimization-buckets.md` §桶 2 #2（風險低、收穫保守 ≤ 10%）
>   - Phase 1.0 baseline：`.omc/REPORT-R6-2-Phase-1.0.md`（C1=29.9 / C2=32.4 / C3=33.3 / C4=33.7 秒、78 box、GPU saturated）
>   - 最近結案：`.omc/REPORT-R6-2-bucket4-F1-conclusion.md`（C3 frame-skip 結案、不修）
>   - 體例參考：`.omc/plans/R6-2-bucket4-F2-timer-breakdown.md` v3（RALPLAN-DR + Step 0 探針 + ADR 樣板）
>   - SOP：`docs/SOP/R6：渲染優化.md` §守門禁忌、整體順序
>   - 前輪共識文件：
>     - `.omc/plans/R6-2-bucket2-russian-roulette-architect-r1.md`（Architect Round 1，CRITICAL_REVISION_REQUIRED，984 行）
>     - `.omc/plans/R6-2-bucket2-russian-roulette-critic-r1.md`（Critic Round 1，ITERATE，2 MAJOR + 5 MINOR + 認同 Architect 5 致命 + 5 應修）

> 範圍邊界（守門禁忌、違反立即拒入 commit）：
>   1. 純 path tracer 提早終結優化：不動 BVH 結構、不動 BRDF 材質分支、不動 NEE pool、不動 MIS heuristic、不動 emission baking
>   2. 動的檔案（預期）：
>      - `shaders/Home_Studio_Fragment.glsl`（加 `uRussianRouletteEnabled` / `uRRMinBounces` uniform、加 `uRRProbeStat` 探針 SSBO 統計 sentinel uniform、bounce 迴圈內 throughput-based termination 一處 + energy compensation 一處 + mask 分佈量測 instrumentation 一處）
>      - `js/Home_Studio.js`（pathTracingUniforms 註冊、可選 GUI toggle）
>      - `.omc/REPORT-R6-2-bucket2-russian-roulette.md`（量測結果與結案）
>   3. 不動：buildSceneBVH / updateBoxDataTexture / sampleStochasticLightDynamic 內部 / 所有材質與光源分支內部 / GUI 風格 / BVH builder JS
>   4. 守 SOP §守門禁忌 2「不破壞 path tracer 正確性」：**從 v1「1024-spp pixel diff = 0 強制」改為 v2「KS test + 3-sigma mean diff 統計閘」**（修訂理由見 §修訂歷史 v1→v2 MR1）
>   5. 守 user feedback「Path Tracing clamp 是診斷訊號不是 fix」：禁用 clamp 蓋過 RR 引入的 firefly；firefly 出現時排查 mask 上游量綱、不調 0.05 下限蓋過
>   6. 守 user feedback「PT 5×5 cross-bilateral 是 blur 不是 denoise」：禁用後處理 denoiser 蓋過 RR firefly
>   7. 守 user feedback「Path Tracing cd 路徑嚴禁多除 π」：energy compensation 公式必對齊既有 mask 量綱（mask /= continueProb 純無單位倒數補償、不引入 π / sr⁻¹ / cd 量綱混淆）
>   8. 守 user feedback「PT 黑白畫面 debug 先掃 accumCol 寫入點，別先跳 hitType 分支假說」：v2 §F-fast-skip 之 root cause 假說範圍含 mask 上游量綱 + continueProb 觸上界、優先檢查最基本的數學前提

---

## 修訂歷史（v1 → v2 fix coverage table、置頂以利 Critic Round 2 對照）

| Fix ID | Source | v2 解決位置 | 摘要 |
|--------|--------|------------|------|
| **F-1** | Architect r1 §F-1 | §A.1 P4 + §B.4 + §D.4 + §E.2 + §H.3 | hard gate 從「1024-spp pixel diff = 0 / AE = 0 / mean diff ≤ 1e-4」改寫為 KS test (p>0.05) + 3-sigma mean diff 統計閘 |
| **F-2** | Architect r1 §F-2 | §B.4 | 補完整 Variance + Mean 統計性質、引用 Veach §10.4.2、明確標「mean unbiased ≠ pixel-exact」、刪除 v1「1024-spp pixel diff = 0 可達」謬誤推論 |
| **F-3** | Architect r1 §F-3 | §A 程式碼骨架 + §C.4 / §C.5 / §C.6 / §C.7 | 程式碼骨架加 `willNeedDiffuseBounceRay == FALSE` 守門、§C 加 mask flow 三子問題（觸上界 / 量綱放大 / break 漏 reset）分析 |
| **F-4** | Architect r1 §F-4 | §A.2 D2 + §G 踩坑點 1 | RNG 引用對齊 PathTracingCommon.js L3070-L3093 實際機制（IQ Shadertoy hash + uvec2 seed 自累 / Jacco Bikker rand 獨立 state） |
| **F-5** | Architect r1 §F-5 | §A.3 + §D + §H.5 | minBounces 從單檔 3 改三 build #ifdef sweep（A1=max-channel+3、A2=max-channel+5、A3=luminance+3）；統一 bounce 編號約定為 shader iteration count |
| **M-1** | Architect r1 §M-1 | §A.3 + §D 三 build 探針 | viable options 探索深度從 1 升 3（A1/A2/A3 同期試）、修 fast-skip 單點失敗風險 |
| **M-2** | Architect r1 §M-2 | §A.4（新增）+ §B.1 | 補述 ROADMAP「≤ 10%」估值含義拆解 + 條件式期望收益表 |
| **M-3** | Architect r1 §M-3 | §H.1 + §H.2 | spp/sec 量測 C3 棄權 / 1024-spp 視覺驗證 C3 不棄權分拆 |
| **M-4** | Architect r1 §M-4 | §G 踩坑點 4 改寫 | firefly mitigation 第 1 層保留 0.05 下限、第 2 層加 mask 上游量綱排查；禁用 clamp band-aid pattern |
| **M-5** | Architect r1 §M-5 | §G 踩坑點 7（新增）+ §F Step 0 第 0 步 | 加 ANGLE Metal select() codegen 自身拖慢踩坑點 + RR uniform OFF baseline 量測 |
| **MJ-A** | Critic r1 §5 | §C.6（新增）+ §D.4 + §F-fast-skip 7 條 root cause + §G 踩坑 7（合併） | 加 continueProb 觸 1.0 上界比例 detection 機制（閾值 80%）+ 退場分流（>80% 推 Option 3 / [50%,80%] 推 Option 1+sweep / <50% 整段結案） |
| **MJ-B** | Critic r1 §5 | §A.3 重寫 invalidation rationale | Option 2 / 3 排除理由刪 strawman、改為「Option 2 與 Option 1 失敗風險高度相關 → MR4 三 build sweep 已涵蓋；Option 3 為真備案、觸發條件 = mask 觸上界 > 80%」 |
| **SR1** | Architect r1 §SR1 | §A.4 + §B.1 | 與 M-2 同位置處理 |
| **SR2** | Architect r1 §SR2 | §G 踩坑 4 | 與 M-4 同位置處理 |
| **SR3** | Architect r1 §SR3 | §G 踩坑 7 + §F Step 0-0 | 與 M-5 同位置處理 |
| **SR4** | Architect r1 §SR4 | §A.3 | Option 2/3 從「v2 備案」改「v2 sweep 候選」（A1/A2/A3 三 build 內含）、Option 3 維持備案 |
| **SR5** | Critic r1 §3 + Architect r1 §SR5 | §F-fast-skip F-3 | root cause 假說 6 條 → 7 條（加 ANGLE codegen 拖慢、加 continueProb 觸上界）；root cause 必同時列「mask 分佈量測結果支持哪條」 |
| **MN-A** | Critic r1 §6 | §H.1 註腳 | Step 0 / Step 1 / Step 2 三表格目的分拆（探針期 / 煙霧測試 / vsync jitter 重跑） |
| **MN-B** | Critic r1 §6 | §G 踩坑 5 | uMaxBounces 互動驗證從「肉眼三檔」改「magick compare + luminance histogram peak 遞增」 |
| **MN-C** | Critic r1 §6 | §F Step 3-4 | SOP 加段位置改寫為「§86 結構優化分流之後新增 §87 桶 2 #2 RR 結案」、wording 對齊 §86 a/d 結案段體例（Verdict / 收益 / rollback path / follow-up 4 段） |
| **MN-D** | Critic r1 §6 | §A.4（新增）| 補條件式收益表（觸上界 < 50% / [50%,80%] / > 80% 三檔對應預期 +5~10% / +1~5% / ≤+1% 整段結案） |
| **MN-E** | Critic r1 §6 | §B.4 | 補 Variance 公式 mask² × (1/p − 1) + 引用 Veach §10.4.2 |
| **歧義 1** | Critic r1 §8 | §B.3 統一寫法 | bounce 編號約定統一為「shader iteration count」、加 footnote 說明 NEE 一一對應僅是業務語義近似 |
| **歧義 2** | Critic r1 §8 | §A.1 P4' | 由 MR1 統計閘改寫直接消除 |
| **歧義 3** | Critic r1 §8 | §A 改動範圍 | 統一規格：shader 改動 ≤ 22 行（含 2 行 uniform + 8 行 RR check + 8 行 mask 分佈 instrumentation + 4 行註解 / 空行）、§A.3 Option 1 ≤ 6 行 GLSL（不含註解） |
| **Gap 1** | Critic r1 §7 | §C.6 + §D Step 0 | continueProb 觸上界比例量測 + 閾值 80% |
| **Gap 2** | Critic r1 §7 | §H.4 | Step 2 重跑漂移處理：N=3 中位數 / 3 次內 > 5% 視為量測誤差不可接受、回滾 |
| **Gap 4** | Critic r1 §7 | §F-fast-skip F-2 | cache busting query 「保留至下個桶 R 主線結案後清理」 |
| **Gap 5** | Critic r1 §7 | §F Step 0 / §A 改動範圍 | #ifdef 三 build cache busting 命名 ?v=r6-2-rr-step0-A1 / -A2 / -A3 |
| open-questions 同步紀律 | Critic r1 §13 | §F Step 3-4 | v2 §F Step 3-4 加同步 `.omc/plans/open-questions.md` 之必修紀律 |

延遲 / 不修項目（justification 必須能讓 Critic r2 接受）：
- **Gap 3 Brave 桌面 ontouchstart 誤判**：Critic r1 §7 已標「影響極小、列為 gap 但不必修」；本 v2 plan §B.2 GUI scaffold 段落改為「v2 不暴露 RR GUI（Step 1~3 階段全用 hardcoded uniform 跑）」即繞過此互動風險、無需修
- **Gap 6 visual-verdict skill 啟用**：Critic r1 §7 已標「nice-to-have、本計畫範圍內可選不強制」；本 v2 §H.2 暫不引入 visual-verdict skill，理由：MR1 統計閘 + 3-sigma mean diff + KS test 已是定量機制，再疊 visual-verdict 屬冗餘；若 Stage B commit 後肉眼檢仍有疑義可在 Step 3 結案 report 階段補做、不阻擋 Step 0 / Step 1 / Step 2
- **Gap 7 mask /= p 代數驗證**：Critic r1 §7 已標「公式正確（Veach §10.4.1）、屬數學嚴謹性 gap、非阻擋、不列必修」；本 v2 §B.4 加引用 Veach §10.4.1 + §10.4.2 但不展開完整代數推導（節省篇幅、Architect r1 已認可 plan 數學基礎）
- **NTH2 commit message 範本**：Architect r1 §NTH2 屬建議級；本 v2 §E.4 commit message 範本已含 KS test p-value + 3-sigma mean diff 欄位、覆蓋此項
- **NTH3 plan 標題 v1 → v2**：本 v2 plan 已執行（標題 v2 + 修訂歷史置頂）

```
v1 → v2 修訂工程量實績：
  MR1 hard gate 統計閘改寫：完成（§A.1 P4'、§B.4、§D.4、§E.2、§H.3 五處連動）
  MR2 RNG 引用更正：完成（§A.2 D2、§G 踩坑 1）
  MR3 mask flow + 程式碼骨架：完成（§A 改動範圍、§C.4~§C.7、§G 踩坑 6）
  MR4 三 build 探針：完成（§A.3、§D、§F Step 0、§H.5）
  MR5 §H 測試矩陣分拆：完成（§H.1、§H.2）
  + Critic r1 MJ-A / MJ-B / MN-A~MN-E / Gap 1/2/4/5 全閉鎖
```

---

## A. RALPLAN-DR Summary（短模式）

### A.1 Principles（治理原則 5 條）

```
P1. Domain purity（範圍純度）
    僅在 bounce 主迴圈內加：
      - throughput-based termination 一處（< 8 行 GLSL）
      - energy compensation 一處（同 if-block 內）
      - mask 分佈 instrumentation 一處（runtime-impossible guard 包裹、不打 mode 0）
    + 2 條 uniform 宣告 + 1 條探針 sentinel uniform。
    不改任一 BSDF 分支內部、NEE 函式內部、emission accumulation 邏輯。
    對齊 R6-2 已四連敗（R6-1 / SAH / leaf packing / F2 Stage A）後「fast-skip + 純
    instrumentation 或純 termination 之外不動」精神。
    四連敗具體教訓內化（v2 新增、修 M-5）：
      - R6-1 / SAH：演算法效果未知時 prototype-first（本 plan 對齊 ✓）
      - leaf packing：ANGLE Metal 已對 hot path 自動 DCE、人為 packing 上限 ≤ 1%
      - F2 Stage A：1 處 if 分支 ANGLE Metal 編譯為 select() / cmov、實證拖慢
        ≥ 1.24% (C2 高可信度)、13 處加齊必加倍；本 plan 1 處 if 同類風險、預估
        自身拖慢 1~2%，必 Step 0 第 0 步量測校正

P2. Prototype-first verification（最便宜驗證優先）★ hard gate
    Step 0 探針閘必前置：在「最少 1 處」（bounce 迴圈尾、SceneIntersect 之前的 RR
    check 站）實作 throughput-based termination + 補償，但 v2 修訂為三 build #ifdef
    切換（修 F-5 / M-1 / MJ-B）：
      A1：max-channel + minBounces=3（v1 原始）
      A2：max-channel + minBounces=5（minBounces sweep）
      A3：luminance + minBounces=3（公式族 sweep）
    量 spp/sec 與 1024-spp 統計訊號（修 F-1 / F-2）。
      - 若三 build 全部 spp/sec Δ < +5% AND continueProb 觸上界 < 80% → fail-fast、
        整段 ralplan 結案（公式族 + 站點不可行）
      - 若三 build 任一 spp/sec Δ ≥ +5% AND 統計閘過 → 取勝者進 Stage B
      - 若 continueProb 觸 1.0 上界比例 > 80% → 形同沒做 RR、root cause 屬「站點 /
        mask 量綱不對」、推 Option 3（NEE 後站點）為 v2 備案、整段結案
    對齊 user feedback「對均勻雜點 / 螢火蟲皆不可用 clamp 或 denoiser 蓋過」。
    對齊 user feedback「PT 黑白畫面 debug 先掃 accumCol 寫入點」：Step 0 第一步
    必檢查 mask 分佈最基本的數學前提，不是先跳 Option 公式族切換假說。

P3. Atomic + reversible commits（原子且可逆 commit）
    Step 0 / Step 1 / Step 2 / Step 3 / 收尾 各自獨立 commit、獨立 git revert。任一
    step 失敗 rollback 點清楚不留殘骸。對齊 plan v3 leaf-packing 與 F2 體例。

P4. Statistical correctness gate（路徑正確性閘，統計版）★ hard gate ★ v2 重寫
    本計畫屬「正確的 path tracer 隨機提早終結」（理論上 unbiased + energy-preserving）；
    v1 設「1024-spp pixel diff = 0」為 hard gate 屬 fail-by-design（修 F-1 / F-2）。
    v2 改寫為 P4'：
      a. RR OFF baseline 跑 N=4 次（不同 frame seed）取 sample mean per-pixel +
         σ_path（path 層級平均標準差）
      b. RR ON 跑 1 次、對 RR OFF sample mean 計算：
         - mean diff（per-pixel）：|RR_ON - baseline_mean| ≤ K × σ_path / √1024
           （K=3、3-sigma；備案 K=4、需在 plan 內明註保守上界）
         - KS test：p-value > 0.05（不能拒絕「同分佈」假設）
      c. 兩條件均過 → 過閘；任一不過 → 回滾、走退場路徑
    實作面以下 4 項只要任一發生即視為「破壞 path tracer 正確性」：
      a. RNG state 撞 progressive sampling 收斂節奏 → banding（mean 偏離 baseline）
      b. minBounces 太低砍到直接光 + emission accumulation → 整體偏暗（mean diff
         系統性負偏 + KS test 拒絕）
      c. continueProb 漏除 mask（energy loss）→ 整體偏暗（與 b 表象一致、根因不同；
         由 mask 上游量綱排查鑑別）
      d. continueProb 過小 + 1/p 補償 → firefly（KS test 因 outlier pixel 失敗）

P5. Threshold discipline（門檻紀律）
    - commit 門檻：spp/sec Δ ≥ +5%（單站點 Option 1/2/3 任一勝者）；ROADMAP「≤ 10%」
      估值含義拆解見 §A.4 / §B.1（修 M-2 / SR1）
    - ANGLE Metal select() codegen 自身拖慢校正：Step 0 第 0 步必跑 RR uniform OFF
      vs Phase 1.0 baseline 之 spp/sec Δ；若 OFF 拖慢 ≥ 1%、扣回門檻基準後再判 ON
      之 +5%；若 OFF 拖慢 ≥ 3%、整段結案（修 M-5 / SR3）
    - 量測誤差容忍 ±5%（對齊 Phase 1.0 §2.2 vsync jitter 實測精度）
    - C1/C2/C4 至少 2 個一致才算可信（spp/sec 量測；C3 啟動暫態 frame-skip 棄權、對齊
      F1 結案）；1024-spp 視覺驗證 C3 不棄權（穩態 frame-skip ≈ 0、修 M-3）
    - 量測協定對齊 Phase 1.0 §2.1 RAF 5 秒法（切 Config N → 等 1500ms → 5 秒
      RAF 計數 → spp/sec = (spp_t1 - spp_t0) / 5）
    - 視覺驗證：1024-spp KS test + 3-sigma mean diff（hard gate、與 P4' 同；不再用
      pixel-exact AE = 0）
```

### A.2 Decision Drivers（決策驅動因子，前 3）

```
D1. RR check 站位置正確性（最重要）
    bounce 主迴圈（L963 `for (int bounces = 0; bounces < 14; bounces++)`）內每輪會：
      1. uMaxBounces hard cap 早返（L965）
      2. SceneIntersect（L969）
      3. INFINITY 處理（L971~L991，含 willNeedDiffuseBounceRay 切換 + state-clear）
      4. 14+ 個 hitType 分支（LIGHT / TRACK_LIGHT / TRACK_WIDE_LIGHT / CLOUD_LIGHT /
         BACKDROP / SPEAKER / WOOD_DOOR / IRON_DOOR / SUBWOOFER / ACOUSTIC_PANEL /
         TRACK / OUTLET / DIFF / SPEC / 預留），各自累乘 mask、dispatch NEE、設
         willNeedDiffuseBounceRay
      5. continue 回 for 頭 → 下一輪 SceneIntersect

    RR check 候選站點：
      候選 a. for 頭、L965 hard cap 之後、L969 SceneIntersect 之前
              優點：在最重的 SceneIntersect 之前砍掉 → 直接省下昂貴的 BVH walk
              缺點：bounces==0 primary ray 必須 protect（mask=vec3(1) 永遠 > 任何
                    閾值，理論上不會被砍；但 minBounces 守門必須對齊 bounces >=
                    minBounces 才啟動）
              v2 補強（修 F-3）：必加 willNeedDiffuseBounceRay == FALSE 守門、避免
              break 跳過 diffuseBounceMask reset 造成能量損失
      候選 b. SceneIntersect 之後、hitType 分支之前
              優點：可看到 hit 結果再決定是否續走（例如命中 LIGHT 不可砍）
              缺點：BVH walk 已花掉、節省失效；增加分支複雜度
      候選 c. 各 hitType 分支內 NEE dispatch 之後 / continue 之前
              優點：mask 此時已乘 weight × uLegacyGain，throughput 真實值
              缺點：14+ 處要加同樣邏輯、違 P1 純度、複雜度爆

    ★ Step 0 採候選 a（for 頭、SceneIntersect 之前）+ #ifdef 三 build sweep（A1/A2/A3）：
      最低風險、最大潛在收益、單一站點（對齊 P1 純度）；三 build 探索深度修 F-5 / M-1。
      若三 build 全 fail-fast、整段 ralplan 結案；若 continueProb 觸上界 > 80%、
      推 Option 3 候選 c（v2 備案、由 v3 共識決定是否啟動）。

    切錯典型錯誤（D1 的 fail mode、修 F-3）：
      - 在 bounces == 0 砍 → primary ray 黑屏（minBounces ≥ 3 守門必有）
      - 在 sampleLight == TRUE 之後砍但忘了 break out → NEE shadow ray 沒結算
      - 在 willNeedDiffuseBounceRay == TRUE 路徑砍但忘了清 state → SPEC→DIFF 切換時
        殘留前一輪 misWPrimaryNeeLast 等 6 個 R3-6 R4 state（對齊 shader L984
        / L1057 / L1099 / L1137 / L1181 / L1201 / L1252 / L1290 / L1339 / L1390 /
        L1498 / L1537 / L1598 等 13 處 state-clear pattern）
        v2 修：守門 willNeedDiffuseBounceRay == FALSE、若 TRUE 不 RR

D2. RNG / continueProb 公式設計（v2 重寫，修 F-4）
    RNG 來源（已 grep + Read PathTracingCommon.js L3070-L3093 確認，v2 修訂）：
      - rng()：IQ Shadertoy hash、內部 uvec2 seed 自累；每呼叫 advance state；
        不接 uv/frameCounter（init 階段才接）；shader L269 NEE slot pick + L367
        Cloud rod jitter 已實證
        實際機制（PathTracingCommon.js L3086-L3093）：
          uvec2 seed;          // 全域變數
          float rng()
          {
              seed += uvec2(1);
              uvec2 q = 1103515245U * ( (seed >> 1U) ^ (seed.yx) );
              uint  n = 1103515245U * ( (q.x) ^ (q.y >> 3U) );
              return float(n) * ONE_OVER_MAX_INT;
          }
      - rand()：Jacco Bikker 2024、randNumber 自累 + blueNoise + frameCounter×0.618
        （與 rng() 是兩個獨立 RNG state、不是 wrapper 關係；v1 描述為 wrapper 錯）
        實際機制（PathTracingCommon.js L3072-L3082）：
          float blueNoise;     // 全域變數
          float randNumber;    // 全域變數
          float rand()
          {
              randNumber += (blueNoise + (mod(uFrameCounter, 32.0) * 0.61803399));
              return fract(randNumber);
          }
      - 與 progressive sampling 相容性：每 frame init 不同（main 入口 seed/randNumber
        用 fragCoord + frameCounter 種子）→ 不撞 banding
      - 但 RR ON 多消耗 1 次 rng() → 後續所有 rng()/rand() 抽到的數 shift 1 步 →
        路徑改變 → 1024-spp pixel diff 必 ≠ 0（→ MR1 統計閘改寫）

    continueProb 公式選擇（≥ 2 viable options 見 §A.3，v2 三 build sweep）：
      - 基線 A1：max-channel throughput
        `float maxThroughput = max(max(mask.r, mask.g), mask.b);`
        `float continueProb = clamp(maxThroughput, 0.05, 1.0);`
        對齊 user feedback「Spotlight max-channel normalize 保色比」精神
      - sweep A2：max-channel + minBounces=5（保護 1 次以上 GI、修 F-5）
      - sweep A3：luminance-based
        `float lum = dot(mask, vec3(0.2126, 0.7152, 0.0722));`
        `float continueProb = clamp(lum, 0.05, 1.0);`
        對 NEE bake 後 mask 量綱推高情境、與 max-channel 同樣會觸上界（修 MJ-B
        strawman）；A3 真正的鑑別力在於 perceptual 維度的補強信號
      - 補償：`mask /= continueProb;` 並僅在 RR 通過時應用、未通過則 break
        對齊 user feedback「cd 路徑嚴禁多除 π」：continueProb ∈ [0.05, 1.0] 為純無單位
        機率倒數，與 mask 已是無單位的「累積 BSDF / NEE weight」量綱一致，不引入 π /
        sr⁻¹ / cd 等量綱失配
      - lower bound 0.05：對齊已知踩坑點 4「continueProb 過小 + mask /= p 放大 noise
        成 firefly」之 mitigation；0.05 → 1/p ≤ 20 倍補償，量級可控
      - upper bound 1.0：對齊「mask 仍滿能量時不 RR」自然語意（但實測 mask 在 NEE
        bake 後常 ≥ 1、需 Step 0 量測觸上界比例驗證、修 F-3 / MJ-A）

D3. minBounces 與 uMaxBounces hard cap 共存策略（v2 補述 bounce 編號約定，修歧義 1）
    既有 uMaxBounces uniform（L34）：runtime 1~14、編譯期 hard cap 14、L965 break。
    新增 uRRMinBounces uniform：runtime 1~10、預設依三 build 不同（A1/A3 = 3、A2 = 5）。

    bounce 編號約定統一（v2 修歧義 1）：
      - 採 shader iteration count 寫法（bounce N = N-th iteration of for-loop）
      - bounces == 0 必為 primary ray（L966 primaryRay flag = 1）
      - bounces == 1 之後可能是：BSDF bounce / diffuse 切換 / SPEC chain 中段
        （非必然「直接 NEE」、業務語義「第 1 次 NEE」僅是統計上常見、不是必然）
      - bounces == 2 之後可能是更深的 secondary chain / 從 INFINITY 切換來的 first DIFF
      - footnote：v1 的「bounce 1 = 第 1 次 NEE 直接光」業務語義近似為「primary
        命中後的 secondary ray」、不是 NEE-specific count

    共存規則：
      - bounces < uRRMinBounces → 不啟動 RR、永遠 continue（保護早期 bounce）
      - uRRMinBounces ≤ bounces < uMaxBounces → 啟動 RR、依 continueProb 決定
      - bounces >= uMaxBounces → 既有 hard cap break（L965 不動）

    minBounces sweep（修 F-5 / M-1）：
      - A1 minBounces = 3：保護 bounces 0 / 1 / 2、bounces >= 3 才允許 RR
        Cloud rod 4-rod + 軌道 6 燈場景 GI 路徑長度分佈偏 4~7、bounces==3 RR 砍可能
        砍到「光源相互照明後的天花板反射回到地板」典型 GI 路徑（5~6 bounces）→
        Cloud 下方天花板區域 mean diff 可能偏暗
      - A2 minBounces = 5：保護到 bounces 4、bounces >= 5 才允許 RR
        對 Cloud rod 多光源場景的「1 次以上 GI」全保留、預期 mean diff 偏暗風險
        最低；但砍率減少 → spp/sec Δ 預期較 A1 / A3 低
      - A3 minBounces = 3：與 A1 同 minBounces、但用 luminance 公式、評估公式族 sweep
        對 NEE bake 後 mask 量綱推高情境、預期與 A1 失敗風險高度相關（修 MJ-B）
      - 比較：取 spp/sec Δ ≥ +5% 與 KS test + 3-sigma mean diff 過 P4' 同時成立的
        最佳 build 進 Stage B
```

### A.3 Viable Options（≥ 2、bounded pros/cons、v2 重寫 invalidation rationale 修 MJ-B / SR4）

#### Option 1：RR check 站 = bounce 迴圈頭、SceneIntersect 之前；continueProb = max-channel throughput；minBounces = 3 ★ Step 0 build A1 採用

```
位置：shaders/Home_Studio_Fragment.glsl L965 hard cap 之後、L967 primaryRay 之前
程式碼骨架（≤ 6 行 GLSL，純 instrumentation 級新增；不含註解；歧義 3 修訂）：
    if (uRussianRouletteEnabled > 0.5 && bounces >= int(uRRMinBounces)
        && willNeedDiffuseBounceRay == FALSE)  // F-3 / MR3 守門
    {
        float maxThroughput = max(max(mask.r, mask.g), mask.b);
        float continueProb = clamp(maxThroughput, 0.05, 1.0);
        if (rng() >= continueProb) break;
        mask /= continueProb;
    }
量測：5 秒 RAF spp/sec × C1/C2/C3/C4 + 1024-spp KS test + 3-sigma mean diff（修 F-1）
判斷：spp/sec Δ ≥ +5% 過閘 AND continueProb 觸上界 < 80% AND P4' 統計閘過、否則
      fail-fast 結案

優點：
  - 站點最早（在 SceneIntersect 之前）→ 砍 ray 收益最大化
  - 單一站點、≤ 6 行 GLSL（不含註解）→ P1 純度最佳
  - max-channel throughput 對色光場景（軌道燈 3000K + 廣角 6500K + Cloud 4 rod）保色比
  - continueProb ∈ [0.05, 1.0] 補償倍率上限 20 倍、firefly 風險可控
  - bounces >= 3 hard guard 保護早期 bounce（但對 Cloud rod 多光源場景的 1 次以上
    GI 保護不足、由 A2 sweep 驗證；修 F-5）
  - GUI uniform toggle 提供 ON/OFF（v2 不暴露 GUI、Step 1~3 全用 hardcoded uniform）
缺點：
  - bounces==0 primary 永遠 protect（minBounces=3 守門）→ 收益期望 ≤ 10%（對齊
    ROADMAP 桶 2 #2 「≤ 10%」估值；條件式收益見 §A.4）
  - 與 R3-6 MIS 互動：mask 在 RR check 時已含先前 NEE 的 weight × uLegacyGain
    → continueProb 在 NEE-rich 路徑可能觸 1.0 上界、形同沒做 RR（修 F-3 / MJ-A、
    必由 §C.6 mask 分佈 instrumentation 量測驗證）
  - C3 啟動暫態 frame-skip 污染 spp/sec 量測 → spp/sec C3 棄權、靠 C1/C2/C4 三票決；
    但 1024-spp 視覺驗證 C3 不棄權（修 M-3）
```

#### Option 2：continueProb = luminance-based；minBounces = 3 ★ Step 0 build A3 採用

```
位置：同 Option 1（站點 + minBounces 與 Option 1 一致、僅 continueProb 公式換 luminance）
程式碼骨架（continueProb 替換為 luminance）：
    float lum = dot(mask, vec3(0.2126, 0.7152, 0.0722));
    float continueProb = clamp(lum, 0.05, 1.0);

優點：
  - luminance（Rec.709）為 perceptual 一致、人眼亮度感知對齊
  - 對「色光場景但希望以人眼感知為主」之 RR 友善度提供另一個鑑別維度
  - 與 Option 1 同站點 / 同 minBounces / 同 break 守門、改動量極小、可 #ifdef 切

invalidation rationale（v2 重寫，修 MJ-B）：
  - 不再宣稱「luminance 砍率過高 → R 通道收斂變慢、出現偏色風險」（v1 strawman）
  - 實際情況：在 NEE bake 後 mask 量綱被 uLegacyGain × uIndirectMultiplier 推高
    情境下、Option 2 luminance 與 Option 1 max-channel 同樣會觸 1.0 上界（任一
    通道 ≥ 1 → max ≥ 1；luminance 為加權平均、與 max 比僅在 mask 通道差異大時
    才有 ratio < 1 的差異；NEE bake mask 各通道近似同階推高、ratio 接近 1）
  - Option 2 排除主因不是 perceptual 偏色、是與 Option 1 失敗風險高度相關（同因同果）
  - v2 修法：Option 2 進 Step 0 build A3（不再「v2 備案」、即時試）、與 Option 1
    並列驗證；若 A1/A3 均 fail-fast、確診「公式族整體不可行」
  - 若 A1 過閘 + A3 fail-fast：max-channel 是公式族的最佳選擇（不一定意味 luminance
    錯、可能僅是該場景下 max 公式碰巧過閘）
  - 若 A1 fail-fast + A3 過閘：公式形態是關鍵變數、進 v3 用 luminance
```

#### Option 1'：max-channel + minBounces = 5 ★ Step 0 build A2 採用（minBounces sweep）

```
位置：與 Option 1 同站點、同公式、僅 minBounces 從 3 改 5

優點：
  - 對 Cloud rod 多光源場景的「1 次以上 GI」全保留（bounces 0~4 不 RR）
  - 預期 mean diff 偏暗風險最低（保護更多 GI 貢獻）
  - 對 R6-2 場景（Cloud 4-rod + 軌道 6 燈）的 RR 友善度測試最保守

缺點：
  - 砍率減少 → spp/sec Δ 預期較 A1 低（保護更多 bounce）
  - 若 A1 過閘 + A2 fail-fast：minBounces=3 是甜蜜點、A1 為勝者
  - 若 A1 fail-fast + A2 過閘：minBounces=5 才是甜蜜點、進 v3 用 A2

invalidation rationale：
  - 不排除、屬 Step 0 sweep 必跑（修 F-5 / M-1）
```

#### Option 3：RR check 站 = NEE dispatch 之後、各 hitType 分支內（v2 真備案、觸發條件明確）

```
位置：13 處 NEE dispatch 後（L1265 / 1303 / 1351 / 1403 / 1511 / 1550 / 1611 /
      1656 / 1765 / 1819 等共 10+ 處 NEE dispatch、SPEAKER / WOOD_DOOR / IRON_DOOR
      / SUBWOOFER / ACOUSTIC_PANEL / TRACK 等 hitType 分支共 13 處）

優點：
  - mask 此時尚未經過下一輪 BSDF bounce、throughput 反映「上一輪 hit 後 但下一輪
    bounce 之前」的純 throughput、與 Option 1 站點之 mask 量綱差異較小（NEE bake
    放大效應差異有限、需實證）
  - 可分 hitType 微調 minBounces（例如 LIGHT / TRACK_LIGHT 永不 RR、TRACK 可早 RR）

缺點：
  - 違 P1 純度（13 處改動 + 4 個 R3-6 R4 state-clear pattern 必對齊 → 行數爆）
  - 與 F2 step0-noop §2 教訓對齊：「13 處 if 加齊後拖慢必加倍」、Step 0 在 1 處已
    > 1% 拖慢、13 處幾無可能達 +5% spp/sec
  - 與既有 willNeedDiffuseBounceRay 切換 + diffuseBounceMask cache 邏輯互動：
    若 RR break 在 NEE dispatch 之後、willNeedDiffuseBounceRay 設定之前 → 漏發
    diffuse bounce ray、收斂變慢；若在之後 → 又要清 misXxx state，與 R3-6 R4 規則
    打架

invalidation rationale（v2 重寫，修 MJ-B / SR4）：
  - Option 3 啟動條件 = Step 0 三 build 探針之 mask 分佈量測顯示 continueProb 觸
    1.0 上界比例 > 80%（修 MJ-A、Critic Gap 1）
  - 若 > 80% → 確診「站點 / mask 量綱不對」、Option 1/1'/2 同類失敗（NEE bake 後
    mask 推高、無法在 SceneIntersect 之前評估真實 throughput）→ 進 v3 ralplan 共識
    評估 Option 3 是否值得 13 處 if 改動（含 ANGLE codegen 拖慢 1.5% × 13 ≈ 20%
    自身 overhead 風險）
  - 若 ∈ [50%, 80%]：站點仍可用、但 minBounces sweep 是關鍵變數（A1 vs A2）
  - 若 < 50%：站點 / 公式都對、根因是場景對 RR 不友善（單純 +5% 上限不夠）→ 整段結案
  - Option 3 不進 Step 0 三 build sweep（13 處改動工程量 ≥ 1 天、不對齊 fast-skip
    精神）；保留為 v3 真備案（觸發條件明確）

> Invalidation rationale 統整（v2 重寫，修 MJ-B）：v2 Step 0 三 build 探針同期試
> Option 1 (A1) + Option 1' (A2 minBounces sweep) + Option 2 (A3 公式族 sweep)；
> Option 3 是真備案、觸發條件 = mask 分佈量測 > 80% 觸上界。三條 viable options
> 結構雖在站點上同（A1/A2/A3 同站點族），但在 minBounces / 公式上有 sweep；失敗
> 風險不再單點集中。Step 0 一槍試三 build、fail-fast 即整段結案，但 root cause
> 鑑別力從 v1 的 1 維升 v2 的 3 維（minBounces 維 + 公式維 + mask 上界比例維）。
```

### A.4 期望收益（v2 新增，修 M-2 / MN-D / SR1）

```
ROADMAP 桶 2 #2「≤ 10%」估值含義拆解：
  - 上限 10% 來自「教科書級 RR 在 path tracing 一般場景的典型加速比」之先驗
  - Home_Studio_3D 場景特化（box 78 + Cloud 4-rod + 軌道 6 燈 + 多 NEE 站點）
    對 RR 砍率有何加成 / 削弱、無實證、屬未驗 prior
  - +5% 門檻是「Option 1/1'/2 任一勝者單站點」的合格線，不是桶 2 #2 整段的合格線；
    若任一過 +5% 但 < +7%、可進 v3 試 Option 3 NEE 後站點榨額外 +2~3%
  - 若 Option 1/1'/2 三 build 全 < +5%、整段結案（公式族整體不可行 / 場景對 RR 不友善）

條件式收益表（基於 mask 分佈量測之 continueProb 觸 1.0 上界比例）：
  | 觸上界比例    | 預期 spp/sec Δ | Step 0 分流 |
  |---------------|----------------|-------------|
  | < 50%         | +5~10%         | A1/A2/A3 比較取勝、進 Stage B commit |
  | [50%, 80%]    | +1~5%          | 灰色帶；若任一過 +5% 進 Stage B；若 [+1%, +5%) 全部 → 整段結案，記為 v3 Option 3 候選 |
  | > 80%         | ≤ +1%          | 整段結案（站點 / mask 量綱不對）、推 v3 Option 3 真備案 |

ANGLE Metal select() codegen 拖慢校正（修 M-5 / SR3）：
  - Step 0 第 0 步：RR uniform OFF（uRussianRouletteEnabled = 0.0）vs Phase 1.0
    baseline 之 spp/sec Δ；扣回 OFF 自身拖慢
  - 預估 RR uniform OFF 自身拖慢 1~2%（與 F2 step0-noop 1.24% 同類）
  - 實質有效 commit 門檻：名義 +5%、扣回 OFF 拖慢 → 實質 RR 自身的 +5% 對應 ON vs
    Phase 1.0 之 +6~7%
  - 若 OFF 拖慢 ≥ 3%、整段結案（branch 自身代價已壓死收益、不必試 ON）
```

---

## B. 任務目標與現況

### B.1 任務目標

對 Home_Studio_3D fragment shader 主 bounce 迴圈引入 **Russian Roulette throughput-based
路徑提早終結**（unbiased + energy-preserving），目標：

```
spp/sec Δ ≥ +5%（hard commit gate；對齊桶 2 #2 ROADMAP 「≤ 10%」估值之下界；
                  實質有效門檻含 ANGLE codegen 拖慢校正、見 §A.4）
1024-spp KS test + 3-sigma mean diff 統計閘（path tracer 正確性 hard gate；v2 重寫，
                                                      修 F-1 / F-2）
fail-fast：任一 hard gate 不過 → 整段結案、回滾、不留殘骸
條件式收益見 §A.4
```

### B.2 現況（已 explore、不必再 grep）

```
shader 端：
  L34   uniform float uMaxBounces;           // 既有 hard cap 1~14、編譯期 14
  L36+  v2 新增：uniform float uRussianRouletteEnabled;
                  uniform float uRRMinBounces;
                  uniform float uRRProbeStat;       // mask 分佈 instrumentation sentinel
  L204  #include <pathtracing_random_functions>  // rng() / rand() 兩獨立 RNG state
  L253  vec3 sampleStochasticLightDynamic(...)   // R3-6.5 Dynamic NEE pool
  L382  sampleStochasticLightDynamic 函式體尾
  L923  vec3 CalculateRadiance(...)               // path tracer 主入口
  L928  vec3 accumCol = vec3(0);
  L929  vec3 mask = vec3(1);                      // throughput init
  L944  int bounceIsSpecular = TRUE;
  L945  int sampleLight = FALSE;
  L946  int willNeedDiffuseBounceRay = FALSE;
  L955~L960  R3-6 MIS state（misWPrimaryNeeLast / misPBsdfNeeLast /
                              lastNeePickedIdx / misBsdfBounceNl /
                              misBsdfBounceOrigin / misPBsdfStashed）
  L963  for (int bounces = 0; bounces < 14; bounces++)
  L965  if (bounces >= int(uMaxBounces)) break;   // ← RR check 站插這之後
  L966+ v2 新增：RR check（≤ 6 行 GLSL、見 §A 改動範圍）
                  + mask 分佈 instrumentation（≤ 8 行、runtime-impossible guard 包裹）
  L967  primaryRay = (bounces == 0) ? 1 : 0;     // v1 與 RR check 之相對位置
  L969  t = SceneIntersect();                     // 最重的一段
  L971~L991  INFINITY 處理 + diffuseBounce 切換
  L1013~ 各 hitType 分支（14+ 個）
    └ NEE dispatch 後：mask *= weight * uLegacyGain;
       sampleLight = TRUE;
       misWPrimaryNeeLast = neePdfOmega;
       misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
       lastNeePickedIdx = neePickedIdx;
       continue;
  L1838 (約) for-bounces 迴圈尾 } 結束
  L1842~L1862  R3-1 DCE-proof sink（uR3EmissionGate < -0.5 守門 / runtime-impossible）
  L1864  return max(vec3(0), accumCol);
  L1869~ SetupScene + #include <pathtracing_main>

JS 端 uniform 註冊路徑：
  js/Home_Studio.js pathTracingUniforms = { ... }（既有 ~30 個 uniform、加入
  uRussianRouletteEnabled / uRRMinBounces / uRRProbeStat 三條，跟既有風格對齊）

GUI（v2 修訂）：
  v2 不暴露 GUI、Step 1~3 階段全用 hardcoded uniform 跑（修 Critic Gap 3「Brave 桌面
  ontouchstart 誤判」之 GUI 風險繞過）；若日後使用者要求暴露 GUI、屬 v3 follow-up。

baseline 數據：
  Phase 1.0 spp/sec：C1=34.30 / C2=31.56 / C3=30.78 / C4=30.39
  Phase 1.0 1024-spp 牆鐘：C1=29.9 / C2=32.4 / C3=33.3 / C4=33.7 秒
  C3 21% frame-skip：啟動暫態、F1 結案、spp/sec 量測棄權；1024-spp 視覺驗證穩態
                      frame-skip ≈ 0、不棄權（修 M-3）

全 codebase grep 確認無既有實作：
  russianRoulette / russian_roulette / rouletteFactor → 0 命中
  → 新增實作不會撞名、不會與舊邏輯衝突

GPU / Browser：
  Apple M4 Pro（Metal Renderer via ANGLE）+ Brave + MCP Playwright
  EXT_disjoint_timer_query_webgl2 ✅ 可用（F2 探針已驗）但本計畫不必（spp/sec
  + 1024-spp KS test 已是充分訊號）

PathTracingCommon.js RNG 機制（v2 親驗 L3070-L3093，修 F-4）：
  rng()：IQ Shadertoy hash + uvec2 seed 自累 + 1103515245U 乘法 hash
  rand()：Jacco Bikker 2024 + randNumber 自累 + blueNoise + frameCounter×0.618
  兩者獨立 RNG state、不是 wrapper 關係
```

---

## C. 完整實作 Plan

### §A 改動範圍

```
shaders/Home_Studio_Fragment.glsl（新增 ≤ 22 行；歧義 3 規格化）
  L36 區（uniform 宣告區）新增 3 條 uniform：
    uniform float uRussianRouletteEnabled;  // 0.0 = off, 1.0 = on（預設 1.0）
    uniform float uRRMinBounces;            // 1.0 ~ 10.0（A1=3 / A2=5 / A3=3）
    uniform float uRRProbeStat;             // -1.0 sentinel（runtime-impossible）

  L965 hard cap 之後、L967 primaryRay 之前新增 RR check（單一 RR check 站、對齊
  §A.3 Option 1/A1/A2/A3）（≤ 6 行 GLSL 不含註解、≤ 12 行含註解 + 守門）：
    // R6-2 桶 2 #2：Russian Roulette throughput-based termination（unbiased、energy-preserving）
    // RNG: shader 端 rng() 為 IQ Shadertoy hash + uvec2 seed 自累（PathTracingCommon.js L3086-L3093）
    // continueProb 採 max-channel throughput / luminance（#ifdef 切換、A1/A3 差異）
    // mask /= continueProb 為純無單位機率倒數補償（對齊 user feedback「cd 路徑嚴禁多除 π」）
    // willNeedDiffuseBounceRay == FALSE 守門避免 break 跳過 diffuseBounceMask reset（修 F-3）
    if (uRussianRouletteEnabled > 0.5 && bounces >= int(uRRMinBounces)
        && willNeedDiffuseBounceRay == FALSE)
    {
        #if defined(RR_BUILD_A3_LUMINANCE)
            float continueProb_raw = dot(mask, vec3(0.2126, 0.7152, 0.0722));
        #else
            float continueProb_raw = max(max(mask.r, mask.g), mask.b);
        #endif
        float continueProb = clamp(continueProb_raw, 0.05, 1.0);
        if (rng() >= continueProb) break;
        mask /= continueProb;
    }

  mask 分佈 instrumentation（≤ 8 行、runtime-impossible guard 包裹、不打 mode 0；
  對齊 R3-1 DCE-proof sink pattern；修 F-3 / MJ-A）：
    // mask 分佈 instrumentation：runtime-impossible guard、不打 mode 0
    // 量測 continueProb_raw 在 bounces ∈ [3, 14] 之分佈（max-channel 與 luminance 兩維）
    if (uRRProbeStat > 0.5)  // runtime-impossible（uniform 預設 -1.0、Step 0 才開）
    {
        float maxCh = max(max(mask.r, mask.g), mask.b);
        float lum = dot(mask, vec3(0.2126, 0.7152, 0.0722));
        // 寫入 debug RT 對應 bounces / channel；JS 端讀回統計
        // (具體 imageStore / texelFetch 細節由 Step 0 實作時補完)
        accumCol.r += maxCh * 1e-30;  // DCE-proof sink、不影響可見輸出
        accumCol.g += lum * 1e-30;
    }

js/Home_Studio.js（新增 3 行 uniform 註冊）
  pathTracingUniforms 區段加：
    uRussianRouletteEnabled: { value: 1.0 },
    uRRMinBounces:           { value: 3.0 },     // A1=3 / A2=5 / A3=3 由 #define 切
    uRRProbeStat:            { value: -1.0 },    // Step 0 mask 分佈量測時改 1.0
  shader cache busting query：
    A1 build：?v=r6-2-rr-step0-A1
    A2 build：?v=r6-2-rr-step0-A2
    A3 build：?v=r6-2-rr-step0-A3
    OFF 量測：?v=r6-2-rr-step0-off
    （依 user feedback「驗證網址規則」、Critic Gap 5 規格化）

Home_Studio.html（cache busting query）
  <script defer src="js/Home_Studio.js?v=r6-2-rr-step0-{A1|A2|A3|off}">

新增測試 / 量測 helper（Step 0 / 1 / 2 用、不入 commit）：
  瀏覽器 DevTools 內貼 5 秒 RAF 量測腳本（對齊 Phase 1.0 §2.1）
  + N=4 RR OFF baseline 量測腳本（修 MR1 統計閘 / F-1）
  + KS test JS 端執行（讀 RR ON/OFF 各自 1024-spp pixel 統計、跑 Kolmogorov-Smirnov）
  + mask max-channel / luminance 分佈直方圖讀回 + continueProb 觸上界比例計算（修 F-3 / MJ-A）

不動的檔案（守門）：
  buildSceneBVH / updateBoxDataTexture / sampleStochasticLightDynamic / 所有 hitType
  分支內部 / R3-6 MIS state-clear 17 處 site / GUI 風格 / BVH builder JS
```

### §B 演算法設計

```
B.1 RNG 來源（v2 重寫，修 F-4）
  使用 shader 內既有 rng()（PathTracingCommon.js L3086-L3093）
  實際機制：IQ Shadertoy hash + uvec2 seed 自累 + 1103515245U 乘法 hash
            （v1 描述「hash(uv, frameCounter, bounces) 派生」錯）
  特性：每呼叫 rng() advance state（seed += uvec2(1)）、不接 uv/frameCounter（init
        階段才接）；shader L269 NEE slot pick + L367 Cloud rod jitter 已實證
  rand() 與 rng() 是兩個獨立 RNG state（v1 描述「同源 wrapper」錯）：
    rand()：Jacco Bikker 2024、randNumber += blueNoise + frameCounter×0.618
            shader L1240/1327/1378/... metal gate 用
  與 progressive sampling 相容性：每 frame init 不同（main 入口 seed/randNumber 用
    fragCoord + frameCounter 種子）→ 不撞 banding（mean 收斂正常）
  踩坑點 1 mitigation：複用既有 rng() 不會破 banding（mean 層）
  但對「會破壞 baseline RNG sequence」的影響：
    RR ON 多消耗 1 次 rng() → 後續所有 rng()/rand() 抽到的數 shift 1 步 → 路徑改變
    → 1024-spp pixel diff 必 ≠ 0
    → MR1 統計閘改寫（不再宣稱「不會破 banding」是「pixel diff = 0」的充分 mitigation）

B.2 continueProb 公式（v2 三 build sweep，修 F-5 / M-1 / MJ-B）
  共同：clamp(*, 0.05, 1.0)、lower bound 0.05 firefly 上限 1/0.05 = 20 倍補償
  A1：max-channel = max(max(mask.r, mask.g), mask.b)
       對齊 user feedback「Spotlight max-channel normalize 保色比」
  A2：max-channel + minBounces=5（minBounces sweep）
  A3：luminance = dot(mask, vec3(0.2126, 0.7152, 0.0722))
       Rec.709 perceptual 一致

  upper bound 1.0：mask 滿能量時不 RR（continueProb=1 → rng() < 1 必 true → 永
    不 break）；但 mask 在 NEE bake 後常 ≥ 1 → 觸上界比例必由 Step 0 mask 分佈
    instrumentation 量測（修 F-3 / MJ-A）

B.3 minBounces 閾值（v2 修歧義 1，bounce 編號約定統一為 shader iteration count）
  A1：uRRMinBounces = 3.0
       bounces < 3 → 不啟動 RR、保護：
         - bounces == 0：primary ray（必跑 SceneIntersect）
         - bounces == 1：secondary ray（可能是 NEE shadow / BSDF bounce / SPEC chain）
         - bounces == 2：deeper secondary 或 first DIFF（從 INFINITY 切換）
       bounces >= 3：第 2+ 次 secondary 之後才允許 RR
       footnote：v1「bounce 1 = 第 1 次 NEE 直接光」業務語義近似為「primary 命中
                  後的 secondary ray」、不是 NEE-specific count；shader iteration
                  count 才是 minBounces 真正的判準
  A2：uRRMinBounces = 5.0（保守 sweep、保護到 bounces 4、修 F-5）
  A3：uRRMinBounces = 3.0（與 A1 同、僅公式換 luminance）

B.4 Energy compensation（統計性質，v2 重寫修 F-2 / MN-E）
  Mean unbiased：
    E[mask after RR | mask before] = continueProb × (mask / continueProb) +
                                       (1 - continueProb) × 0 = mask
    → 期望值不變（mean unbiased）
  Variance increase（Veach §10.4.2）：
    Var[mask after RR | mask before] = mask² × (1/p − 1)
    當 p < 1：Var > 0（RR 必引入 variance、不為零）
    當 p = 1：Var = 0（永不 RR、退化為 baseline）
  1024-spp 收斂性質：
    sample mean 之標準差 σ(mean_1024) ≈ σ_X × √((1+1/p_avg)/1024)
    典型 σ_X = 0.01~0.1（path tracing per-pixel σ）、p_avg = 0.5 → σ(mean) ≈
      1e-3 ~ 1e-2
    對 1024-spp pixel diff：
      期望值 ~ 0（mean unbiased）
      觀測值 ~ σ(mean) × N(0,1)（central limit）
  v1 推論「→ 1024-spp pixel diff = 0 可達」錯（修 F-2、刪除）：
    mean unbiased ≠ pixel-exact；1024 樣本不是無限樣本；σ(mean) > 容忍 1e-4
  v2 改寫：用 P4' 統計閘（KS test + 3-sigma mean diff）取代 pixel-exact 閘
  引用：Veach §10.4.1（mask /= p 補償公式）+ §10.4.2（variance 增量推導）

B.5 與 uMaxBounces 共存策略
  bounces < uRRMinBounces  →  跳過 RR check（保護早期 bounce）
  uRRMinBounces ≤ bounces < uMaxBounces  →  RR check（throughput-based）
  bounces >= uMaxBounces  →  既有 hard cap break（L965、不動）
  → 三層守門互不衝突（順序：L965 hard cap 早返 → L965+ RR check → L967~ 主邏輯）

B.6 與 R3-6 MIS state-clear 互動
  RR break 點在 SceneIntersect 之前 → 不影響 MIS state（state 在 hitType 分支內
  累乘 + state-clear 在 SPEC→DIFF / 各分支處理）
  RR break 等同「自然 break 出迴圈」、與既有 INFINITY 處理 + uMaxBounces hard cap
  break 同類、不需新增 state-clear（state 是 thread-local、break 後函式 return、自動釋放）
  → 不違 R3-6 R4「17 處 state-clear site」規則

B.7 與 willNeedDiffuseBounceRay 互動（v2 重寫，修 F-3）
  willNeedDiffuseBounceRay 在各 hitType 分支內設 TRUE，意義是「INFINITY / LIGHT
  hit 時、若要切換到 diffuse bounce 替代路徑」。
  v1 假設 RR check 在下一輪 for 頭 → mask 已是新值 → 無互動 bug；
  v2 修正：若 RR break 發生時 willNeedDiffuseBounceRay == TRUE 但 RR 還沒觸發
  diffuseBounceMask reset → break 直接跳出 for、diffuseBounceMask 累積資源被丟棄、
  能量損失。
  v2 修法：守門 `willNeedDiffuseBounceRay == FALSE`、若 TRUE 不 RR；待下一輪
  diffuseBounce 切換完成、mask 已 reset 為 diffuseBounceMask × uIndirectMultiplier、
  再下一輪才 RR check。

B.8 量綱紀律（對齊 user feedback「cd 路徑嚴禁多除 π」）
  mask: 無單位（累積 BSDF weight × NEE weight × uLegacyGain）
  continueProb: 無單位（∈ [0.05, 1.0] 機率）
  mask /= continueProb: 仍無單位（不引入 π / sr⁻¹ / cd 量綱）
  → 量綱檢查通過、對齊既有 mask 量綱（與 L1265 `mask *= weight * uLegacyGain;`
    同層級無單位累乘）
```

### §C 互動分析

```
C.1 與 NEE / MIS 互動（踩坑點 6）
  RR check 站在 SceneIntersect 之前、hitType 分支之前 → 不切斷 NEE shadow ray。
  NEE dispatch 在 hitType 分支內（L1264 / 1302 / 1350 / 1402 / 1510 / 1549 / 1610 /
  1655 / 1764 / 1818 等共 10+ 處）發生於本輪 hit 後、設 sampleLight=TRUE 後 continue
  下輪。
  下輪 for 頭：
    if (RR check passed) → 繼續 SceneIntersect（NEE shadow ray 此時走 SceneIntersect
    L969 同一段、命中 emitter 則由 hitType 分支處理）
    if (RR check break) → NEE shadow ray 不再發射、本輪 hit 已結算、合理「直接光蓋
    面、後續間接光提早終結」
  → mask 在 NEE 之後立即砍會破 stochastic light pool 能量平衡的擔憂，僅在「砍
    在 NEE dispatch 後 / sampleLight=TRUE 之後 / continue 之前」才會發生（即
    Option 3 站點）。Option 1 站點不受影響：NEE 在「本輪結算完」、RR 在「下輪開始
    前」、時序上分離。

C.2 與 R3-6 MIS heuristic 互動
  R3-6 misPowerWeight(p_nee, p_bsdf) 在 LIGHT/CLOUD_LIGHT 分支內計算（L1028 / 1045
  / 1167）。
  RR break 點在 SceneIntersect 之前 → 若 break、本輪沒命中任何 hitType、不會走
  MIS heuristic 計算路徑、自然不影響。
  下輪若不 break、SceneIntersect 命中 emitter（LIGHT/CLOUD_LIGHT/TRACK_LIGHT/
  TRACK_WIDE_LIGHT），既有 MIS heuristic 仍正常運作（state 從上輪 NEE dispatch
  時設好的 misWPrimaryNeeLast/misPBsdfNeeLast/lastNeePickedIdx 取）。
  → 兼容。

C.3 與 sampleStochasticLightDynamic 內部 R3-6.5 S2 互動
  sampleStochasticLightDynamic 內含：
    - L257 uR3ProbeSentinel < -100 sentinel（runtime-impossible，DCE proof）
    - L263 uActiveLightCount <= 0 black-out
    - L269 slot pick + LUT
    - 14 處 emitter-specific 分支（idx 0 / <=4 / <=6 / 7-10、各帶 gate）
  本計畫不動此函式。RR check 在呼叫此函式之前的 for 迴圈頭、與此函式內部互不影響。
  → 對齊踩坑點 6「RR check 點該放在 BSDF bounce 之前還之後」之答：放 BSDF bounce
    開始之前（即 SceneIntersect 之前）、不放 NEE 之後。

C.4 與 path tracer 既有 mask flow 對齊（v2 重寫，修 F-3）
  既有 mask flow（已 explore）：
    L929 mask = vec3(1);                                  // init
    L1241 mask *= hitColor;                                // SPEAKER metal gate
    L1250 mask *= hitColor;                                // SPEAKER diff fallback
    L1265 mask *= weight * uLegacyGain;                    // SPEAKER NEE dispatch
    L1288 mask *= hitColor;                                // WOOD_DOOR
    L1303 mask *= weight * uLegacyGain;                    // WOOD_DOOR NEE
    L1328 mask *= hitColor;                                // IRON_DOOR metal
    L1337 mask *= hitColor;                                // IRON_DOOR diff fallback
    L1351 mask *= weight * uLegacyGain;                    // IRON_DOOR NEE
    （以下類推 SUBWOOFER / ACOUSTIC_PANEL / TRACK / ... 約 30 處 mask *= ...）
  v1 結論「對既有 mask flow 透明、無互動 bug 風險」錯；v2 修正：
    問題 A（觸 1.0 上界）：mask 在 NEE 後 = mask *= weight × uLegacyGain（uLegacyGain
                            = 1.5、weight = stochastic NEE throughput 經 emit baked、
                            典型量級 O(1)~O(10)）→ 任一通道 ≥ 1 機率高 →
                            continueProb = max(mask) 觸 1.0 上界、永不砍、形同沒
                            做 RR
    問題 B（量綱推高）：「在 SceneIntersect 之前」站點看似乾淨，但「上一輪 hitType
                          分支內的 mask *= weight × uLegacyGain」與「下一輪 RR check」
                          之間沒有 mask 衰減環節 → continueProb 評到的是「已被
                          NEE bake 過的、含 emit 量綱推高的 mask」、不是純 BSDF
                          衰減累積
    問題 C（break 漏 reset）：見 §B.7 + C.5；v2 修法 willNeedDiffuseBounceRay ==
                                FALSE 守門
  → v2 §C.6 加 mask 分佈 instrumentation 量測 continueProb 觸上界比例，依 §A.4
    條件式收益表分流。

C.5 與 willNeedDiffuseBounceRay 切換 / diffuseBounceMask cache 互動（v2 補強，修 F-3）
  既有切換邏輯（L976~L988、L1049~L1061、L1091~L1103 等共 13 處）：
    if (willNeedDiffuseBounceRay == TRUE)
    {
        mask = diffuseBounceMask * uIndirectMultiplier;
        rayOrigin = diffuseBounceRayOrigin;
        rayDirection = diffuseBounceRayDirection;
        willNeedDiffuseBounceRay = FALSE;
        bounceIsSpecular = FALSE;
        misXxx = ...;  // R3-6 R4 state-clear
        sampleLight = FALSE;
        diffuseCount++;
        continue;
    }
  此切換發生在 INFINITY 處理 / LIGHT primary-hit 處理等 13 處、會 reset mask =
  diffuseBounceMask × uIndirectMultiplier。
  v1 假設 RR check 在下一輪 for 頭 → 切換已完成、mask 已是新值 → RR check 對新 mask
  評估 → 行為合理；
  v2 修正：若 RR break 發生時 willNeedDiffuseBounceRay == TRUE（已被上一輪設、
  下一輪要切換）、break 跳出 for、diffuseBounceMask 累積資源被丟棄、能量損失。
  v2 修法：守門 willNeedDiffuseBounceRay == FALSE 才 RR；TRUE 時跳過 RR、待下一輪
  切換完成、mask 已 reset、再下一輪才 RR check。

C.6 mask 分佈 instrumentation（v2 新增，修 F-3 / MJ-A / Critic Gap 1）
  目的：量測 continueProb 觸 1.0 上界比例、依 §A.4 條件式收益表分流。
  實作：runtime-impossible guard `if (uRRProbeStat > 0.5)` 包裹（uRRProbeStat 預設
        -1.0、Step 0 mask 分佈量測時改 1.0；對齊 R3-1 DCE-proof sink pattern；
        不打 mode 0 主路徑）。
  量測：每 fragment 每 frame、若 bounces ∈ [3, 14]：
        - 計算 maxCh = max(mask.r, mask.g, mask.b)
        - 計算 lum = dot(mask, vec3(0.2126, 0.7152, 0.0722))
        - 寫入 debug RT（imageStore / 累乘到 accumCol 的低位 sink、JS 端讀回統計）
        - JS 端聚合：直方圖 + 觸上界（>= 1.0）比例
  分流（§A.4）：
        - > 80% → Option 1 不可行、推 v3 Option 3 真備案
        - ∈ [50%, 80%] → 灰色帶、minBounces sweep 是關鍵
        - < 50% → 站點 / 公式都對、走正常 fail-fast 邏輯

C.7 sentinel uniform 紀律（v2 新增）
  uRRProbeStat：預設 -1.0（runtime-impossible 之外 1 個量級、確保 ANGLE Metal DCE
                即使 codegen 為 select() / cmov 也不打 mode 0 主路徑）
  Step 0 mask 分佈量測階段：JS 端設 1.0、跑單一 config 1 frame 量測
  Step 0 spp/sec 量測階段：JS 端設 -1.0、量測不含 instrumentation 之純 RR overhead
  Step 1+ commit 階段：JS 端固定 -1.0、永不暴露給 GUI、避免使用者誤開
  對齊 user feedback「Path Tracing DCE-sink gate 係數陷阱」：sentinel 不可用業務
                                                                  gate 作係數、改 runtime-impossible guard
```

### §D Step 0 探針設計（v2 三 build sweep + mask 分佈量測 + RR uniform OFF baseline，修 F-1 / F-3 / F-5 / M-1 / M-5 / MJ-A / MJ-B）

```
D.1 探針程式碼（≤ 22 行 GLSL、對齊 §A 改動範圍）
  shaders/Home_Studio_Fragment.glsl L36 / L965+ 兩處新增（如 §A 列）
  js/Home_Studio.js pathTracingUniforms 加 3 條 uniform
  Home_Studio.html cache busting ?v=r6-2-rr-step0-{A1|A2|A3|off}
  #ifdef 三 build 切換：A1 (max-ch + min=3) / A2 (max-ch + min=5) / A3 (lum + min=3)

D.2 量測協定（對齊 Phase 1.0 §2.1 RAF 5 秒法）
  per-build per-config 動作：
    1. 切 build（A1/A2/A3/off）：改 #define + cache busting query + JS uniform
       重啟 server（python3 -m http.server 9001）+ 瀏覽器強制 reload（Cmd+Shift+R）
    2. 切 Config N（C1 / C2 / C3 / C4）、按 panel 切換按鈕
    3. 等 1500 ms（cameraSwitchFrames + needClearAccumulation reset 完成）
    4. 立刻貼 DevTools 腳本（既有 5 秒 RAF）：
       (() => {
         const spp_t0 = sampleCounter;
         const t0 = performance.now();
         let frames_t0 = 0;
         const cb = () => { frames_t0++; if (performance.now() - t0 < 5000) requestAnimationFrame(cb); };
         requestAnimationFrame(cb);
         setTimeout(() => {
           const spp_t1 = sampleCounter;
           const elapsed_sec = (performance.now() - t0) / 1000;
           const fps = frames_t0 / elapsed_sec;
           const spp_per_sec = (spp_t1 - spp_t0) / elapsed_sec;
           const ratio = spp_per_sec / fps;
           console.log({ build: 'AN', config: 'CN', elapsed_sec, fps, spp_per_sec, ratio });
         }, 5100);
       })();
    5. 收 JSON、記入下表

  RR OFF baseline N=4 量測（修 MR1 / F-1）：
    uRussianRouletteEnabled = 0.0、跑 4 次（不同 frame seed）取 sample mean per-pixel
    + σ_path（path 平均標準差）
    用於 KS test + 3-sigma mean diff 統計閘

  mask 分佈量測（修 MR3 / F-3 / MJ-A / Critic Gap 1）：
    uRRProbeStat = 1.0、跑 single frame 量測 mask max-channel 與 luminance 直方圖
    JS 端讀 debug RT、聚合 continueProb 觸上界（>= 1.0）比例
    依 §A.4 條件式收益表分流

D.3 Step 0 量測表（待填）
  D.3.0：RR uniform OFF 自身拖慢量測（修 M-5 / SR3、Step 0 第 0 步必跑）
    | Config | Phase 1.0 spp/sec | RR OFF spp/sec | 自身拖慢 Δ% | 是否 ≥ 3% 整段結案？ |
    |--------|-------------------|----------------|-------------|------------------------|
    | C1     | 34.30             | _              | _           | _                      |
    | C2     | 31.56             | _              | _           | _                      |
    | C4     | 30.39             | _              | _           | _                      |
    判：若 C1/C2/C4 ≥ 2 個自身拖慢 ≥ 3% → 整段結案（branch 自身代價已壓死收益）
        若 ≥ 1% < 3% → 扣回名義 +5% 門檻、實質有效門檻 +6~7%
        若 < 1% → 名義 +5% 門檻有效

  D.3.1：A1 build (max-ch + min=3)
    | Config | Phase 1.0 | A1 spp/sec | Δ% | spp/frame ratio | 過閘？ |
    |--------|-----------|------------|----|-----------------|--------|
    | C1     | 34.30     | _          | _  | _               | _      |
    | C2     | 31.56     | _          | _  | _               | _      |
    | C3     | 30.78     | _          | _  | _               | 棄權   |
    | C4     | 30.39     | _          | _  | _               | _      |

  D.3.2：A2 build (max-ch + min=5)
    | Config | Phase 1.0 | A2 spp/sec | Δ% | spp/frame ratio | 過閘？ |
    | C1/C2/C4 同上格式 |

  D.3.3：A3 build (lum + min=3)
    | Config | Phase 1.0 | A3 spp/sec | Δ% | spp/frame ratio | 過閘？ |
    | C1/C2/C4 同上格式 |

  D.3.4：mask 分佈量測（修 MR3 / MJ-A / Gap 1）
    | Config | maxCh 觸上界比例 | luminance 觸上界比例 | 分流 |
    |--------|------------------|----------------------|------|
    | C1     | _                | _                    | _    |
    | C2     | _                | _                    | _    |
    | C3     | _                | _                    | _    |
    | C4     | _                | _                    | _    |
    分流（§A.4）：
      > 80% → 整段結案 + 推 v3 Option 3
      ∈ [50%, 80%] → 灰色帶、看 spp/sec 過閘情況
      < 50% → 走正常邏輯（取 spp/sec 勝者）

  過閘規則（hard gate、含 ANGLE codegen 校正）：
    - D.3.0 RR OFF 自身拖慢 ≥ 3% → 整段結案、不必試 ON
    - D.3.4 mask 觸上界 > 80% → 整段結案、推 v3 Option 3
    - D.3.1/2/3 A1/A2/A3 至少 1 build × C1/C2/C4 ≥ 2 config Δ ≥ +5%（名義門檻）
      實質有效 = +5% + RR OFF 自身拖慢 → 進 D.4 統計閘
    - 全 build × 全 config Δ < +5% → fail-fast、結案、回滾
    - 任一 Δ < 0% → 立即回滾（RR 不應反向變慢、出現 = 公式錯誤）
    - C3 spp/sec Δ 棄權（啟動暫態 frame-skip 污染、對齊 F1 結案）

D.4 1024-spp 統計閘（v2 重寫，修 F-1 / F-2 / MR1）
  Step 0 D.3 過閘後、Step 1 commit 前必跑：
  
  1. RR OFF baseline N=4：
     - C1/C2/C3/C4（C3 不棄權，修 M-3）各跑 RR OFF 1024-spp、不同 frame seed × 4 次
     - 計算 sample mean per-pixel：mean_baseline[c, x, y] (c=config, x,y=pixel)
     - 計算 σ_path：對 4 次取樣的 per-pixel std → 取場景 median 為 σ_path[c]
       （path 層級平均標準差、用於 3-sigma 容忍計算）
     - 工程：~ 1024 × 4 × 4 = 16384 spp 量測，Apple M4 Pro 估 ~ 5~8 分鐘 per config
       共 4 config ≈ 20~30 分鐘量測

  2. RR ON 各 build × C1/C2/C3/C4 跑 1024-spp（單次）：
     - 對 mean_baseline[c, x, y] 計算：
       a. mean diff（per-pixel）：|RR_ON[c, x, y] - mean_baseline[c, x, y]|
       b. 3-sigma threshold：threshold[c] = 3 × σ_path[c] / √1024
       c. KS test：對 RR_ON[c, *, *] vs mean_baseline[c, *, *] 之 pixel value
          distribution 跑 Kolmogorov-Smirnov test、取 p-value
     - 過閘：mean diff ≤ threshold[c]（per-pixel 全過 OR pixel violation rate ≤ 1%）
              AND KS test p-value > 0.05
              兩條件均過 → 過閘

  3. 備案：若 K=3 容忍仍嚴、可放寬到 K=4，但需在 plan 內明註「對 RR variance 補償
     倍率上限 1/0.05 = 20 倍時、4-sigma 是統計學保守上界」

D.5 結案規則（對齊 leaf packing v3 step0-noop §5 + F2 v3 step0-noop §5）
  D.3.0 OFF 自身拖慢 ≥ 3% → 寫退場報告 `.omc/REPORT-R6-2-bucket2-rr-step0-noop.md`
        root cause = ANGLE Metal select() codegen 自身代價已壓死收益（修 SR3）
  D.3.4 mask 觸上界 > 80% → 寫退場報告同檔
        root cause = mask 量綱在 NEE bake 後推高、Option 1/1'/2 站點不適用、推 v3
        Option 3 真備案（修 MJ-A）
  D.3.1/2/3 全 fail-fast → 寫退場報告同檔
        root cause = 公式族 + 站點 + minBounces sweep 全不可行、場景對 RR 不友善
        + 7 條 root cause 假說對齊（修 SR5）
  D.4 統計閘 fail → 寫退場報告同檔
        root cause = path tracer 正確性破壞、KS test 拒絕 OR 3-sigma mean diff 超容忍
        + 列差異區域 + mask 上游量綱排查（嚴禁加 clamp 蓋過、user feedback「clamp 是
        診斷訊號」）
  全過 → 進 Step 1（commit）→ Step 2（多 config 驗證）→ Step 3（收尾 + 結案 report）
```

### §E Commit 條件（hard gate）

```
E.1 spp/sec hard gate（v2 補述 ANGLE codegen 校正）
  名義門檻：A1/A2/A3 任一 build × C1/C2/C4 ≥ 2 個 Δ ≥ +5%（5 秒 RAF 量、Phase 1.0
            baseline 對比）
  實質有效門檻：+5% + RR OFF 自身拖慢（D.3.0 量測）→ 預估 +6~7%
  ratio 偏差 < 5%（量測 window 純度、對齊 F1 結案教訓）
  C3 棄權（不入 commit 判準；1024-spp 視覺驗證 C3 不棄權）

E.2 1024-spp 統計閘（v2 重寫，修 F-1 / F-2 / MR1）
  C1/C2/C3/C4 各跑 RR ON 1024-spp（不棄權 C3，修 M-3）、與 RR OFF baseline N=4
  sample mean 比：
    a. mean diff（per-pixel）≤ 3 × σ_path / √1024（3-sigma；備案 4-sigma）
    b. KS test p-value > 0.05（不能拒絕同分佈）
    兩條件均過 → 過閘
  任一不過 → 立即回滾、視為「破壞 path tracer 正確性」、整段結案

E.3 firefly / banding 視覺檢查（v2 補強，修 M-4 / SR2）
  Step 1 / 2 過 hard gate 後加做：
    - 暗場景（C1 dim 模式、若 GUI 有）：肉眼檢有無新增 firefly
    - 平面區（地板 / 牆面）：肉眼檢有無 banding
  若有任一：
    - 不調 0.05 下限（band-aid pattern、user feedback 紀律）
    - 量測 mask max-channel 在 bounces ∈ [3, 14] 之分佈（已由 Step 0 D.3.4 涵蓋）
    - 確認 mask 是否在 NEE bake 後 × uLegacyGain × uIndirectMultiplier 疊加溢出
      （uLegacyGain 1.5 × uIndirectMultiplier 預估 1.0~2.0 = 1.5~3.0 per NEE）
    - 若疊加溢出、根因在上游量綱、不在 RR；整段結案、寫退場報告
    - 若疊加正常、firefly 是 RR 自身 variance 過大、改 minBounces sweep（A2）+ 升
      0.1 下限為次選緩解（仍須 v3 共識）
  禁止：
    - 加 emission clamp 蓋 firefly（user feedback 紀律）
    - 加 5×5 cross-bilateral 蓋 firefly（user feedback 紀律）
    - 直接調 0.05 下限到更大（屬 band-aid）

E.4 commit message 風格（對齊既有 R 主線 commit 風格 + v2 加統計閘欄位）
  範例：
    R6-2 桶 2 #2: Russian Roulette throughput-based termination (build A{1|2|3})
    - shader: 加 uRussianRouletteEnabled / uRRMinBounces / uRRProbeStat uniform
              + bounce loop RR check + willNeedDiffuseBounceRay 守門
              + mask 分佈 instrumentation (DCE-proof sink, mode 0 不打)
    - js: pathTracingUniforms 註冊 3 條 + cache busting query r6-2-rr-step0-A{N}
    - 量測：C1/C2/C4 spp/sec 平均 Δ +X%（實質 +Y% 含 ANGLE OFF 拖慢校正）
    - 統計閘：KS test p-value = X、3-sigma mean diff ≤ Y per-pixel（C1/C2/C3/C4）
    - mask 分佈：continueProb 觸 1.0 上界比例 = Z%（< 50% / [50%, 80%] / > 80%）
    - 對齊 user feedback「Path Tracing cd 路徑嚴禁多除 π」（mask /= p 純無單位補償）
    - 對齊 user feedback「max-channel normalize 保色比」（A1/A2 用）
    - 對齊 PathTracingCommon.js L3070-L3093 RNG 機制（rng() / rand() 獨立 state）
    - SOP §守門禁忌 2 統計閘（KS test + 3-sigma）✅

E.5 git push 規則（對齊 user feedback「R 幾 DONE 即授權 git push」）
  本計畫屬 R6-2 內子任務（桶 2 #2）→ 不 push、僅本地 commit
  R6-2 整段 DONE 才 push（含本桶 2 #2 結案 + 任何後續桶結案）
```

### §F 實作步驟（編號、含 each step 的 5 秒量測 + 統計閘驗證 + open-questions 同步）

```
Step 0：探針閘（必前置、~ 4~5 hr 工程 + 1.5~2 hr 量測）★ fast-skip 守門
  0-0. 撿 .omc/HANDOVER-R6-2.md 接手清單、確認 git status 乾淨、server 在跑（lsof
       -iTCP:9001）、Phase 1.0 baseline 數據可信（REPORT-R6-2-Phase-1.0.md）
  
  Step 0-1：RR uniform OFF 自身拖慢量測（修 M-5 / SR3、Step 0 第 0 步必跑、新增）
    a. shader edit：L36 加 3 條 uniform、L965+ 加 RR check（uRussianRouletteEnabled
       = 0.0 跑、即 OFF 模式、但 ANGLE codegen 仍要走 if 分支）
    b. js edit：pathTracingUniforms 加 3 條 + uRussianRouletteEnabled = 0.0 +
       cache busting query ?v=r6-2-rr-step0-off
    c. server 重啟 + Cmd+Shift+R
    d. C1/C2/C4 各 5 秒 RAF spp/sec 量測（D.3.0 表）
    e. 判：若 ≥ 2 個自身拖慢 ≥ 3% → 走 Step F-fast-skip-codegen（root cause = ANGLE
       codegen 拖慢）
       若 ≥ 1% < 3% → 扣回 +5% 門檻、實質 +6~7%、繼續 Step 0-2
       若 < 1% → 名義 +5% 門檻有效、繼續 Step 0-2

  Step 0-2：A1 build (max-ch + min=3) 量測
    a. shader edit：#define RR_BUILD_A1 + uRRMinBounces = 3.0
    b. js edit：cache busting query 改 ?v=r6-2-rr-step0-A1
    c. server 重啟 + Cmd+Shift+R
    d. C1/C2/C3/C4 各 5 秒 RAF spp/sec 量測（D.3.1 表、C3 棄權）

  Step 0-3：A2 build (max-ch + min=5) 量測
    a. shader edit：#define RR_BUILD_A2 + uRRMinBounces = 5.0（A2 mode）
    b. cache busting ?v=r6-2-rr-step0-A2、重啟、量測（D.3.2 表）

  Step 0-4：A3 build (lum + min=3) 量測
    a. shader edit：#define RR_BUILD_A3_LUMINANCE + uRRMinBounces = 3.0
    b. cache busting ?v=r6-2-rr-step0-A3、重啟、量測（D.3.3 表）

  Step 0-5：mask 分佈量測（修 MR3 / MJ-A / Gap 1、新增）
    a. js edit：uRRProbeStat = 1.0（runtime-impossible guard 開啟 instrumentation）
    b. C1/C2/C3/C4 各跑 single frame 量測 maxCh / luminance 直方圖
    c. JS 端讀 debug RT、聚合 continueProb 觸上界比例（D.3.4 表）
    d. 判：若 > 80% → 走 Step F-fast-skip-mask-overflow（root cause = mask 量綱推高、
       推 v3 Option 3）
       若 ∈ [50%, 80%] → 灰色帶、看 spp/sec 過閘情況
       若 < 50% → 站點 / 公式都對、繼續 Step 0-6

  Step 0-6：spp/sec hard gate 判（含 ANGLE codegen 校正）
    A1/A2/A3 任一 build × C1/C2/C4 ≥ 2 個 Δ ≥ 名義 +5%？（實質 +6~7% 含 OFF 拖慢校正）
    過 → 取勝者進 Step 0-7（統計閘）
    不過 → 走 Step F-fast-skip-spp（root cause = 公式族 + 站點 + minBounces sweep
                                     全不可行、場景對 RR 不友善）

  Step 0-7：1024-spp 統計閘（v2 重寫，修 F-1 / MR1）
    a. RR OFF baseline N=4：C1/C2/C3/C4 各跑 1024-spp × 4 次（不同 frame seed）、
       計算 mean_baseline + σ_path（修 M-3 不棄權 C3）
       工程：~ 20~30 分鐘量測
    b. 勝者 build RR ON 跑：C1/C2/C3/C4 各 1024-spp（單次）
    c. 對 mean_baseline 計算 mean diff per-pixel + KS test
    d. 過 P4'：mean diff ≤ 3 × σ_path / √1024 AND KS p-value > 0.05
       → 進 Step 1
    e. 不過：走 Step F-fail-correctness（記下統計值與差異區域、列入退場報告、
              對齊 user feedback「clamp 是診斷訊號不是 fix」嚴禁加 clamp 蓋過）

Step F-fast-skip-codegen（OFF 自身拖慢 ≥ 3%、修 M-5 / SR3）：
  F-1. git checkout shaders/ + js/Home_Studio.js（撤回探針）
  F-2. cache busting query 留作實證痕跡（保留至下個桶 R 主線結案後清理、Critic Gap 4）
  F-3. 寫 .omc/REPORT-R6-2-bucket2-rr-step0-noop.md：
       - 列 D.3.0 表實際數據
       - root cause = ANGLE Metal select() codegen 自身代價已壓死收益
       - 對齊 F2 step0-noop 體例
       - 推薦：放棄 RR 計畫、整段結案
  F-4. 更新 ROADMAP 桶 2 #2 從「★ 推薦」改「⏸ 暫緩 + Step 0 fail-fast (codegen 拖慢)」
  F-5. 更新 HANDOVER-R6-2 加最新狀態
  F-6. 同步 .omc/plans/open-questions.md（v2 新增、Critic §13）：
       Q-RR-1：RR check 站點是否值得用 #ifdef N+1 build 編譯時切（無 runtime branch
              overhead）、屬 v2 備案、已記入 follow-up
  F-7. 本地 commit、不 push

Step F-fast-skip-mask-overflow（mask 觸上界 > 80%、修 MJ-A）：
  F-1 / F-2 / F-5 / F-7 同上
  F-3. 寫退場報告同 step0-noop、root cause = mask 量綱在 NEE bake 後推高
       推薦下一步：v3 ralplan 共識評估 Option 3 NEE 後站點（13 處 if 改動工程量大、
       但 mask 在 NEE 之前 throughput 評估為純 BSDF 衰減累積、上界比例可能 < 50%）
  F-4. ROADMAP 桶 2 #2 改「⏸ 暫緩 + v3 Option 3 候選」
  F-6. open-questions 同步 Q-RR-2：v3 Option 3 ralplan 共識何時啟動、需使用者裁示

Step F-fast-skip-spp（spp/sec 全 fail-fast、修 SR5 7 條 root cause）：
  F-1 / F-2 / F-5 / F-7 同上
  F-3. 寫退場報告同 step0-noop、root cause 假說 7 條（v2 擴充、修 SR5）：
       1. RNG state 撞 progressive sampling 收斂（mean 偏離；已由 D.4 KS test 驗）
       2. minBounces 太低砍直接光（已由 A1/A2 sweep 鑑別）
       3. continueProb 補償漏除（code review 確認）
       4. continueProb 過小 firefly（已由 D.4 statistical guard）
       5. uMaxBounces 互動破 hard cap（已由 §G 踩坑 5 magick + histogram 驗）
       6. NEE / MIS 互動（已由 mask flow 分析 + Option 3 備案）
       7. ANGLE Metal select() codegen 自身拖慢（已由 D.3.0 量測校正、修 SR3）
       root cause 必同時列「mask 分佈量測結果支持哪條」（修 SR5）
  F-4. ROADMAP 桶 2 #2 改「⏸ 暫緩 + 公式族整體不可行」
  F-6. open-questions 同步 Q-RR-3：場景對 RR 友善度差是否屬「scene-specific
        permanent」、需 v3 共識決定是否值得 R3-8 後重評

Step F-fail-correctness（D.4 統計閘失敗、修 F-1 / MR1）：
  F-1 / F-2 / F-5 / F-7 同上
  F-3. 寫退場報告同 step0-noop、root cause = path tracer 正確性破壞
       - KS test p-value ≤ 0.05 OR 3-sigma mean diff > 容忍
       - 列差異區域（per-pixel mean diff 熱區圖）
       - mask 上游量綱排查（uLegacyGain × uIndirectMultiplier × emit baked 是否疊加溢出）
       - 對齊 user feedback「Path Tracing clamp 是診斷訊號不是 fix」嚴禁加 clamp 蓋過
  F-4. ROADMAP 桶 2 #2 改「⏸ 暫緩 + 統計閘失敗」
  F-6. open-questions 同步 Q-RR-4：mask 量綱是否值得 v3 拆分為「BSDF mask」+
        「NEE-baked mask」雙 track、需 ralplan 共識

Step 1：commit Step 0 探針程式碼（過閘後、~ 30 分鐘）
  1-1. git add shaders/Home_Studio_Fragment.glsl + js/Home_Studio.js + Home_Studio.html
       （勝者 build 為主、A1 / A2 / A3 三 build 可用 #ifdef 留 commit、預設啟動勝者）
  1-2. commit message 對齊 §E.4 風格、附 D.3 / D.4 表實際數據 + KS p-value + 3-sigma
  1-3. git log 確認 commit hash、寫入 §G 風險紀錄區供 rollback 用

Step 2：多 config 驗證（~ 30 分鐘量測）（修 M-3 / MN-A）
  2-1. C1/C2/C3/C4 各跑 1024-spp、重做 D.4 統計閘驗收（C3 不棄權）
  2-2. C1/C2/C4 重跑一次 5 秒 RAF（驗 Step 0 數據可重現、防量測 vsync jitter）
       Step 1 commit 煙霧測試（commit hash 不影響執行、跑 1 config 確認）
       目的不同於 Step 0：Step 0 是探針期、Step 2 是 vsync jitter 容忍重跑
  2-3. 暗場景 / 平面區肉眼檢 firefly / banding（§E.3、含 mask 上游量綱排查 SR2）
  2-4. 任一 fail：
       - 統計閘 fail：git revert Step 1 commit、寫退場報告（root cause = 統計閘失敗）
       - vsync jitter > 5%：跑 N=3 中位數、3 次內仍 > 5% → git revert + 退場（修 Gap 2）
  2-5. 全過 → 進 Step 3

Step 3：收尾 + 結案 report（~ 30 分鐘）
  3-1. 寫 .omc/REPORT-R6-2-bucket2-russian-roulette.md：
       - 對照表：Phase 1.0 baseline vs RR ON 之 spp/sec / 1024-spp 牆鐘 / 統計閘
       - 對齊 ralplan 共識體例（leaf packing v3 / F2 v3 結尾段）
       - 列 follow-up：是否值得試 Option 3 多 +2~3% 升級（v3 ralplan 評估）
  3-2. 更新 .omc/HANDOVER-R6-2.md：桶 2 #2 ✅ 結案
  3-3. 更新 .omc/ROADMAP-R6-2-optimization-buckets.md：桶 2 #2 從「★ 推薦」改
       「✅ 結案」+ 推薦下一步（路徑 C 整體結案 / 路徑 D 桶 4 F3 spectorJS dump）
  3-4. 更新 docs/SOP/R6：渲染優化.md（修 MN-C）：
       在 §86 結構優化分流之後新增段「§87 桶 2 #2 Russian Roulette 結案」
       wording 對齊 §86 a/d 結案段體例：
         §87.1 Verdict（✅ commit / ⏸ 暫緩 / ❌ 失敗）
         §87.2 收益（spp/sec Δ + 1024-spp 牆鐘 + KS p-value + 3-sigma mean diff）
         §87.3 rollback path（commit hash + git revert 步驟）
         §87.4 follow-up（Option 3 v3 候選 / R3-8 後重評 / 其他）
  3-5. 同步 .omc/plans/open-questions.md（v2 新增、Critic §13）：
       清理 Q-RR-1~Q-RR-4（若已解決）+ 列 commit hash + 結案日期
  3-6. 本地 commit「桶 2 #2 RR 結案：spp/sec +X% 統計閘 ✅」、不 push（依 R 主線 push 規則）
```

### §G 風險與緩解（含已知 7 個踩坑點處理、v2 加 ANGLE codegen + continueProb 觸上界）

```
踩坑點 1：RNG state 來源破 progressive sampling 收斂（v2 重寫，修 F-4）
  風險：用同 frame 同 RNG 重複呼叫 → banding（同一像素同一 frame 內固定隨機數）
  緩解：複用 shader 內既有 rng()（PathTracingCommon.js L3086-L3093）
        rng() 為 IQ Shadertoy hash + uvec2 seed 自累、每次呼叫 advance state
        rand() 為 Jacco Bikker 2024（與 rng() 是兩個獨立 RNG state、不是 wrapper）
        L269 NEE slot pick + L367 Cloud rod jitter 已實證與 progressive sampling 相容
  驗證：Step 0 D.4 KS test + 3-sigma mean diff、若有 banding 則 KS p-value ≤ 0.05
        → 立即回滾、列入退場報告 root cause
  注意（v2 新增）：「不會破 banding」結論碰巧仍對（任何 rng() 呼叫都 advance state）、
                    但「會破壞 baseline RNG sequence」的影響由 MR1 統計閘吸收

踩坑點 2：minBounces 太低砍直接光 → 整體變暗（v2 sweep 化）
  風險：minBounces = 0 / 1 → primary ray / 直接光被砍 → 整體暗
  緩解：v2 三 build sweep
        - A1 minBounces = 3：bounces 0/1/2 永不 RR、bounces >= 3 才允許
        - A2 minBounces = 5：bounces 0~4 永不 RR、保護 1 次以上 GI
        - A3 minBounces = 3 + luminance：與 A1 同 minBounces、僅公式不同
  驗證：Step 0 D.3.1 / D.3.2 / D.3.3 sweep + D.4 統計閘
        若 A1 偏暗 + A2 不偏暗 → 確診 minBounces=3 不足、進 Stage B 用 A2
        若 A1/A2 都偏暗 → 場景 GI 路徑長度分佈偏 6+、整段結案

踩坑點 3：continueProb 補償漏除 → energy loss → 整體變暗
  風險：mask /= continueProb 漏寫 → mean unbiased 失敗、RR 通過率 < 1 直接砍能量
  緩解：§A 程式碼骨架 mask /= continueProb 必跟 if (rng() >= continueProb) break 配對
        Step 0 D.4 統計閘顯著負偏 → 直接命中此踩坑點
  驗證：code review 確認 mask /= continueProb 在 break 之外、rng() 通過分支內

踩坑點 4：continueProb 過小 + 1/p 補償放大 noise 成 firefly（v2 改寫，修 M-4 / SR2）
  風險：continueProb = 0.01 → 1/p = 100 倍補償 → 偶發 RR 通過時 mask 被放大 100 倍 → firefly
  
  mitigation 第 1 層（保留）：clamp(*, 0.05, 1.0) 下限 0.05 → 補償倍率 ≤ 20 倍
        max-channel throughput 比 luminance 對暗暖場景更友善（暖場景 R 通道主導、max
        > luminance）→ 觸 0.05 下限機率較低
  mitigation 第 2 層（v2 新增）：mask 上游量綱排查（對齊 user feedback「Path Tracing
        clamp 是診斷訊號不是 fix」）
    若 firefly 出現：
      a. 不調 0.05 下限（這是 band-aid）
      b. 量測 mask max-channel 在 bounces ∈ [3, 14] 之分佈（已由 Step 0 D.3.4 涵蓋）
      c. 確認 mask 是否在 NEE bake 後 × uLegacyGain × uIndirectMultiplier 疊加溢出
         （uLegacyGain 1.5 × uIndirectMultiplier 預估 1.0~2.0 = 1.5~3.0 per NEE）
      d. 若疊加溢出、根因在上游量綱、不在 RR；本計畫整段結案、寫退場報告
      e. 若疊加正常、firefly 是 RR 自身 variance 過大、改 minBounces sweep + 升 0.1
         下限為次選緩解（仍須 v3 共識）
  禁止：
    - 加 emission clamp 蓋 firefly（user feedback 紀律）
    - 加 5×5 cross-bilateral 蓋 firefly（user feedback 紀律）
    - 直接調 0.05 下限到更大（屬 band-aid，不解上游問題）
  
  踩坑紀錄補強（對齊 R3-7 方向 A 體例）：0.05 下限是工程平衡、不是物理參數；屬可
                                          調設計參數、需 Step 1/2 視覺驗證後定稿
  驗證：Step 1 / 2 暗場景 / 平面區肉眼檢 firefly（§E.3）+ Step 0 D.4 統計閘 outlier

踩坑點 5：uMaxBounces 互動破 hard cap（v2 量化驗證，修 MN-B）
  風險：RR 在 uMaxBounces 達標前 break、之後又被 if (bounces >= uMaxBounces) break
        重複攔截 → 邏輯死碼 / GUI 滑桿失效
  緩解：bounce 迴圈順序：L965 uMaxBounces hard cap 早返 → §A RR check（bounces >=
        uRRMinBounces 才檢查、且 break 路徑與 uMaxBounces hard cap break 同類自然
        return）
        三層守門互不衝突：bounces < uRRMinBounces < uMaxBounces 時走完整路徑、
                          uRRMinBounces ≤ bounces < uMaxBounces 時 RR 可砍、
                          bounces >= uMaxBounces 時 hard cap 必砍
  驗證（v2 量化，修 MN-B）：
    - 若 GUI 暴露：拉 uMaxBounces 1 / 7 / 14 三檔
      （v2 不暴露 GUI、用 JS 直改 uniform value）
    - 各跑 256-spp 截圖、magick compare（uMaxBounces=1 整體最暗、=14 整體最亮、=7 介中）
    - luminance histogram peak 應呈遞增（histogram peak luminance @1 < @7 < @14）
    - 對齊 §H.2 magick AE 量測協定

踑坑點 6：NEE / MIS 互動破 stochastic light pool 能量平衡（v2 補強，修 F-3）
  風險：RR check 站若放在 NEE dispatch 之後（Option 3） → mask 已乘 weight × uLegacyGain
        → continueProb 反映「NEE 後 throughput」、砍率分布偏 NEE 後路徑 → light
        pool 能量平衡破壞
  緩解：站點選擇 Option 1 / A1 / A2 / A3（SceneIntersect 之前）→ NEE 在「本輪結算完」、
        RR 在「下輪開始前」、時序分離 → mask 反映的是「上輪 hitType 分支累乘後 + 下輪
        SceneIntersect 之前」的純 throughput
        v2 補強：willNeedDiffuseBounceRay == FALSE 守門避免 break 跳過 reset
        對 R3-6 MIS heuristic 透明（state 在 hitType 分支內讀寫、RR break 點之外）
  驗證：D.4 統計閘全場景（含 C2/C3/C4 多光源 config、修 M-3 不棄權 C3）
        若 NEE-rich 區域（軌道燈光斑、Cloud rod 下方）pixel diff 偏暗 → 命中此踩坑點
        → 回滾、Option 1 不可行、視 D.3.4 mask 觸上界比例決定 Option 3 v3 啟動

踑坑點 7（v2 新增，修 M-5 / SR3）：ANGLE Metal uniform branch select() codegen 自身拖慢
  風險：1 處 if (uRussianRouletteEnabled > 0.5 && bounces >= int(uRRMinBounces)
        && willNeedDiffuseBounceRay == FALSE) 被 ANGLE Metal 編譯為 select() / cmov、
        mode 0 (RR off) 也付兩路徑 dead code 成本 → spp/sec 自身拖慢 1~2%、實質有效
        commit 門檻 +6~7%
  證據：F2 Stage A Step 0 step0-noop §2 實證 1 處 if 拖慢 ≥ 1.24%（C2 高可信度）
  緩解：v2 Step 0 第 0 步 (D.3.0) 必跑 RR uniform OFF (uRussianRouletteEnabled = 0.0)
        vs Phase 1.0 baseline 之 spp/sec Δ
  驗證：
    - 若 OFF 拖慢 ≥ 3% → 整段結案（branch 自身代價已壓死收益、不必試 ON）
    - 若 OFF 拖慢 ∈ [1%, 3%) → 扣回 +5% 門檻、實質 +6~7%
    - 若 OFF 拖慢 < 1% → 名義 +5% 門檻有效
  退場：Stage B 升 #ifdef N+1 build（編譯時切、無 runtime branch overhead）但本計畫
        Short consensus 不啟、留 v2 / v3 備案

風險矩陣總表（v2 加踩坑 7 + continueProb 觸上界）：
  | 踩坑 | 機率 | 影響 | 緩解狀態 | Step 0 可偵測？ |
  |------|------|------|----------|------------------|
  | 1 RNG | 低 | 高（banding） | 複用 rng() | ✅ KS test (v2) |
  | 2 minBounces | 中 | 中（暗） | A1/A2 sweep | ✅ D.3 sweep + D.4 |
  | 3 漏除 | 極低 | 高（暗） | code review | ✅ D.4 統計閘 |
  | 4 firefly | 中 | 高（亮點） | 0.05 下限 + 量綱排查 | ⚠ D.4 outlier + 肉眼 |
  | 5 hard cap | 低 | 中（GUI 失效） | 三層守門 | ⚠ 需 magick + histogram (v2) |
  | 6 NEE 互動 | 中 | 中（NEE-rich 偏暗） | Option 1 + willNeed 守門 | ✅ D.4 + D.3.4 |
  | 7 codegen 拖慢 (v2) | 中 | 中（OFF 自身拖慢） | D.3.0 RR OFF baseline | ✅ D.3.0 |
  | continueProb 觸上界 (v2、MJ-A) | 中 | 高（形同沒做 RR） | mask 分佈量測 | ✅ D.3.4 |

  「Step 0 可偵測」= ✅：D.3.0 / D.3.4 / D.4 一輪量測即可暴露
  「Step 0 可偵測」= ⚠：需 Step 1 / 2 magick compare + 肉眼或統計工具才暴露
```

### §H 測試矩陣（v2 重寫，修 M-3 + MN-A）

```
H.1 測試矩陣（v2 加註腳分拆 Step 0 / Step 1 / Step 2 目的，修 MN-A）

  Step 0 RR ON 探針（spp/sec、C3 棄權；mask 分佈、C1~C4 全跑；統計閘、C1~C4 全跑）：
    | Build | C1 spp/sec | C2 spp/sec | C3 spp/sec | C4 spp/sec | maxCh ≥1 比例 | KS p-value | 3σ mean diff |
    |-------|------------|------------|------------|------------|----------------|-------------|--------------|
    | OFF   | _          | _          | _ (棄權)   | _          | N/A            | N/A         | N/A          |
    | A1    | _          | _          | _ (棄權)   | _          | _              | _           | _            |
    | A2    | _          | _          | _ (棄權)   | _          | _              | _           | _            |
    | A3    | _          | _          | _ (棄權)   | _          | _              | _           | _            |
    
    Step 0 重點：
      - spp/sec：探針期、C1/C2/C4 ≥ 2 個 Δ ≥ +5%（含 ANGLE codegen 校正）
      - maxCh ≥1 比例（C1~C4 全跑）：分流 §A.4 條件式收益表
      - KS p-value + 3σ mean diff（C1~C4 全跑、C3 視覺驗證不棄權，修 M-3）：
        path tracer 正確性 hard gate
  
  Step 1 commit 後煙霧測試：
    | Build | C1 spp/sec |
    |-------|------------|
    | 勝者  | _          |
    
    Step 1 重點：
      - 僅做煙霧測試（spp/sec 抽 1 config 跑一次確認 commit hash 不影響執行）
      - 不必跑全 4 config、不必重做統計閘（commit 不應改變數據）
  
  Step 2 vsync jitter 容忍重跑：
    | Build | C1 spp/sec | C2 spp/sec | C4 spp/sec | C1~C4 統計閘 |
    |-------|------------|------------|------------|---------------|
    | 勝者  | _          | _          | _          | _             |
    
    Step 2 重點：
      - vsync jitter 容忍重跑（C1/C2/C4 各重跑 1 次、應落在 Step 0 ±5% 內）
      - 全 4 config 重做統計閘（修 M-3 不棄權 C3）
      - 視覺驗證 §E.3（含 mask 上游量綱排查 SR2）

H.2 量測協定
  spp/sec：5 秒 RAF（§D.2）
  RR OFF baseline N=4：對 mean_baseline + σ_path（§D.4）
  KS test + 3-sigma mean diff：JS 端 statistical 計算（§D.4）
  mask 分佈 instrumentation：uRRProbeStat = 1.0、debug RT 讀回（§C.6 + §D.3.4）
  C3 棄權：spp/sec only（啟動暫態 frame-skip 污染、F1 結案）
  C3 不棄權：1024-spp 視覺驗證（穩態 frame-skip ≈ 0、修 M-3）
  uMaxBounces 量化驗證：256-spp + magick compare + luminance histogram peak 遞增
                          （修 MN-B、§G 踩坑 5）

H.3 過閘規則（v2 重寫，修 F-1 / MR1）
  Step 0：
    a. spp/sec：A1/A2/A3 任一 build × C1/C2/C4 ≥ 2 個 Δ ≥ +5%（含 ANGLE codegen 校正）
    b. maxCh ≥1 比例 < 80%（修 MJ-A）
    c. KS test p-value > 0.05 AND 3-sigma mean diff ≤ 3 × σ_path / √1024（C1~C4 全跑）
    三條件均過 → 進 Step 1
  Step 1：commit 後僅煙霧測試（commit hash 不影響執行）
  Step 2：重跑 spp/sec 應落在 Step 0 ±5% 內（vsync jitter 容忍）AND 統計閘重做全過

H.4 失敗處理（v2 補強，修 Gap 2）
  spp/sec 不過閘 → Step F-fast-skip-spp（§F）
  mask 觸上界 > 80% → Step F-fast-skip-mask-overflow（§F）
  OFF 自身拖慢 ≥ 3% → Step F-fast-skip-codegen（§F）
  統計閘破壞 → Step F-fail-correctness（§F）
  Step 1 commit 後 Step 2 重跑數據漂移 > 5% → 重啟 Step 0 量測 N=3 取中位數、
    3 次內仍漂移 → 視為「量測誤差不可接受」、回滾、寫退場報告（修 Gap 2）

H.5 minBounces sweep 矩陣（v2 新增，整合 D.3.1/2/3 至 §H、修 F-5）
  | minBounces | continueProb 公式 | C1 Δ | C2 Δ | C4 Δ | C1 KS | C2 KS | C3 KS | C4 KS |
  |------------|--------------------|------|------|------|-------|-------|-------|-------|
  | 3 (A1)     | max-channel        | _    | _    | _    | _     | _     | _     | _     |
  | 5 (A2)     | max-channel        | _    | _    | _    | _     | _     | _     | _     |
  | 3 (A3)     | luminance          | _    | _    | _    | _     | _     | _     | _     |
  
  過閘規則：取 spp/sec Δ ≥ +5% AND KS test p > 0.05 AND mean diff ≤ 3σ/√1024 AND
           maxCh ≥1 比例 < 80% 同時成立的最佳 build 進 Stage B
  全 fail → 整段結案、走 step0-noop（§F）
```

---

## D. 體例對齊參考（F2 ralplan v1→v2→v3 樣板）

```
F2 plan: .omc/plans/R6-2-bucket4-F2-timer-breakdown.md（v3、1545 行）

對齊項目：
  - 結構：A RALPLAN-DR / B 任務目標 / C 完整 plan / D 體例參考 / E ADR
  - A.1 Principles（5 條 P1~P5、含 hard gate 標記、v2 加四連敗具體教訓）
  - A.2 Decision Drivers（前 3 條 D1~D3、含切錯典型錯誤、v2 RNG 引用更正）
  - A.3 Viable Options（≥ 2 + invalidation rationale、v2 重寫修 MJ-B）
  - C.§A 改動範圍 / §B 演算法設計 / §C 互動分析 / §D Step 0 探針 / §E commit / §F 步驟 / §G 風險 / §H 測試
  - Step 0 fast-skip 體例：對齊 leaf packing v3 step0-noop §5「8 hr 節省」+ F2 v3
    step0-noop §5「9~13 hr 節省」精神
  - 退場報告路徑體例：.omc/REPORT-R6-2-bucket2-rr-step0-noop.md（fail-fast、v2 含
                       4 種分流 codegen / mask / spp / correctness）/
                       .omc/REPORT-R6-2-bucket2-russian-roulette.md（成功結案）
  - cache busting query 體例：?v=r6-2-rr-step0-{A1|A2|A3|off}（v2 修 Critic Gap 5）

不啟 deliberate mode 的差異：
  - 本 plan 是 Short consensus（無 --deliberate flag、無 high-risk auto-trigger）
  - 不必 pre-mortem 3 失敗情境（F2 v1 §B 有、本 plan §G 風險矩陣替代）
  - 不必 expanded test plan 全層（unit/integration/e2e/observability）
  - 但 §G 風險與緩解仍須完整覆蓋 7 個踩坑點（v1 6 條 + v2 加踩坑 7 codegen + 補充
    continueProb 觸上界 detection）

v2 修訂後對齊度：90%（vs v1 60%、修 Critic §13 列出之 8 結構問題其中 7 條閉鎖、
                      open-questions 同步紀律 1 條由 §F Step F-X 各分支補入）

ADR 結構：v1 留 placeholder、v3 共識後補完（對齊 F2 v3 §H 體例）
```

---

## E. ADR Skeleton（v2 placeholder、v3 共識後補完）

```
E.1 Decision
  [v3 補完] 採用 build A{1|2|3}、minBounces = M、continueProb = max-channel / luminance、
            站點 = SceneIntersect 之前 + willNeedDiffuseBounceRay == FALSE 守門

E.2 Drivers
  [v3 補完] 對齊 §A.2 D1~D3 + Architect Round 1~N 反饋 + Critic Round 1~N 反饋

E.3 Alternatives considered
  [v3 補完]
    Option 1 (A1)：max-channel + minBounces=3
    Option 1' (A2)：max-channel + minBounces=5（minBounces sweep）
    Option 2 (A3)：luminance + minBounces=3（公式族 sweep）
    Option 3：NEE 後站點（v3 真備案、觸發條件 = mask 觸上界 > 80%）
    各自 invalidation rationale 見 §A.3（v2 已重寫、修 MJ-B）

E.4 Why chosen
  [v3 補完] 勝者 build 之三項優勢（站點純度 + 補償 mathematics 安全 + 改動 ≤ 22 行）
            + Step 0 探針實證（spp/sec Δ = X% / KS p-value = Y / 3σ mean diff ≤ Z /
                                  maxCh ≥1 比例 = W%）

E.5 Consequences
  [v3 補完]
    正面：
      - spp/sec +X%（C1/C2/C4 平均、含 ANGLE codegen 校正）
      - 1024-spp 牆鐘從 30~34 秒縮短到 _ ~ _ 秒
      - 對齊 ROADMAP 桶 2 #2 條件式收益（§A.4）
    負面 / 限制：
      - GUI 不暴露（v2 修訂、繞過 Brave ontouchstart 互動）
      - 後續任何優化（桶 1/2/3）若改動 bounce 迴圈邏輯需重驗 RR 互動
      - 對齊踩坑點 1~7 的 mitigation 必須保留在 SOP 中、不可後續放鬆

E.6 Follow-ups
  [v3 補完]
    F-RR-1：Option 3 NEE 後站點 v3 ralplan（若 mask 觸上界 > 80% 確診）
    F-RR-2：#ifdef N+1 build 編譯時切（無 runtime branch overhead、避踩坑 7）
    F-RR-3：R3-8 採購擴張（≥ 200 box）後重跑 RR、評估 minBounces / continueProb 公式調整
    F-RR-4：與桶 2 #1 adaptive sampling 結合評估（v2 / v3 round 後決定是否同期共識）
    F-RR-5：與主線 1 階段 2 reproject 評估互動（若使用者裁示啟動）
    F-RR-6（v2 新增）：visual-verdict skill 啟用評估（Critic Gap 6）
    F-RR-7（v2 新增）：mask 量綱拆分為「BSDF mask」+「NEE-baked mask」雙 track（若
                          統計閘失敗 + mask 上游量綱排查確診）
```

---

## 修訂歷史（時序版、簡要）

```
v1：2026-04-27 初版（Planner Round 1、837 行）
    - 完成 RALPLAN-DR Summary（短模式、不啟 deliberate）
    - §A 改動範圍 / §B 演算法設計 / §C 互動分析 / §D Step 0 探針 / §E commit / §F 步驟 /
      §G 風險（6 踩坑點全覆蓋） / §H 測試矩陣
    - ≥ 3 viable options + invalidation rationale
    - ADR Skeleton 留 placeholder（v3 共識後補完）
    - 體例對齊 F2 v3（1545 行）
    - 等 Architect Round 1 反饋

Architect Round 1：2026-04-27（984 行、CRITICAL_REVISION_REQUIRED）
    - 5 致命級（F-1 hard gate fail-by-design / F-2 統計謬誤 / F-3 mask flow / F-4 RNG
      引用錯 / F-5 minBounces 不足）
    - 5 應修級（M-1~M-5）
    - 7 推薦修正（MR1~MR4 + SR1~SR5 + NTH1~NTH3）

Critic Round 1：2026-04-27（602 行、ITERATE）
    - 認同 Architect r1 之 5 致命 + 5 應修（補強 F-3 + F-5）
    - 額外 2 MAJOR（MJ-A continueProb 觸上界 detection / MJ-B Option 2/3 strawman）
    - 額外 5 MINOR（MN-A~MN-E）
    - 7 條 v2 必修清單 + 5 條應修清單 + open-questions 同步紀律

v2：2026-04-28 第 2 輪（Planner Round 2、本檔）
    - 全部閉鎖 Architect r1 之 5 致命 + 5 應修（MR1~MR5 + SR1~SR5）
    - 全部閉鎖 Critic r1 之 2 MAJOR + 5 MINOR + 7 個 Gap（其中 4 條延遲，理由見置頂
      修訂歷史 fix coverage table）
    - hard gate 從「1024-spp pixel diff = 0」改為「KS test + 3-sigma mean diff」（修 F-1）
    - Step 0 從單 build 升三 build #ifdef sweep（A1/A2/A3、修 F-5 / M-1 / MJ-B）
    - 新增 mask 分佈 instrumentation（runtime-impossible guard、修 F-3 / MJ-A）
    - 新增踩坑點 7 ANGLE Metal codegen 拖慢 + RR uniform OFF baseline（修 M-5 / SR3）
    - bounce 編號約定統一為 shader iteration count（修歧義 1）
    - RNG 引用對齊 PathTracingCommon.js L3070-L3093（修 F-4 / MR2）
    - C3 視覺驗證不棄權（修 M-3）
    - firefly mitigation 加 mask 上游量綱排查（修 M-4 / SR2）
    - SOP 加段位置具體化（修 MN-C）
    - 條件式收益表 §A.4 新增（修 M-2 / MN-D）
    - 等 Architect Round 2 + Critic Round 2 反饋（目標 APPROVE w/caveats + APPROVE）
```
