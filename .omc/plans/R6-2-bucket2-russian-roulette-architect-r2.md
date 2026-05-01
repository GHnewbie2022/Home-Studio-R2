# R6-2 桶 2 #2 Russian Roulette Plan v2 — Architect Review Round 2

> 模式：Short consensus（v2 Planner 自註以 deliberate-equivalent 嚴審處理）
> Round：2
> Reviewer：architect agent (opus)
> 日期：2026-04-28
> 對象：`.omc/plans/R6-2-bucket2-russian-roulette.md` v2（Planner Round 2、1455 行）
> 上層脈絡：
>   - Architect r1（984 行、CRITICAL_REVISION_REQUIRED、5 致命 + 5 應修）
>   - Critic r1（601 行、ITERATE、2 MAJOR + 5 MINOR + 認同 Architect r1 全部）
>   - HANDOVER：`.omc/HANDOVER-R6-2.md` 候選路徑 B
> 結論：**APPROVE_WITH_CAVEATS**（r1 致命 / 應修全閉鎖、Critic r1 MAJOR / MINOR 全閉鎖、但 v2 引入 4 條新 caveat 屬非阻擋級、可在 v3 共識或 Step 0 執行階段就地修正；無新 fatal）

---

## §1. Summary verdict

**APPROVE_WITH_CAVEATS**（白話：v2 已經修到可進 Critic r2 final approval 的程度、Step 0 探針可動工；但 4 條新 caveat 必須在執行前對齊或就地修正、否則統計閘判讀會失真）

不能升 APPROVE 的核心理由（任一條足以保留 caveats 級判定）：

```
C1（caveat、必對齊）：KS test 在 1024 × resolution 像素級 sample size 下 p-value
                      解析度過高、p > 0.05 hard gate 會在統計上微小但物理上可
                      接受的 RR 引入差異上誤觸發 → Step 0 統計閘可能 false-fail、
                      把可 commit 的 build 誤判為破壞 path tracer 正確性
                      影響：Step 0 退場分流誤判、進 F-fail-correctness 是錯誤的、
                      但仍會回滾、不破壞既有正確性；屬於「過度敏感」非「不可達」、
                      與 r1 F-1 之「不可達」性質不同，故為 caveat 而非 fatal

C2（caveat、必對齊）：σ_path 估計器以 N=4 baseline run 之 per-pixel std + 取場景
                      median 為估計值、N=4 之 sample std 相對誤差 ~30%、且 NEE
                      bake 區域 σ 與場景 median 可差 1~2 個量級 → 3-sigma 閘針
                      對 NEE-rich 區域會過嚴、針對暗區會過鬆
                      影響：mean diff threshold 在不同區域有效嚴格度不一致；
                      與 C1 同屬統計閘參數選擇問題、屬 caveat 級

C3（caveat、需文件化）：continueProb 觸 1.0 上界 80% 閾值無形式化推導、屬經驗值
                          → 50%/80% 切點之選擇 anchor 缺失
                          影響：條件式收益表 §A.4 三檔分流之中段 [50%,80%] 邊
                          界判讀缺實證 anchor、易招 v3 質疑

C4（caveat、術語精確度）：v2 §A.3 / §D 多處宣稱「三 build #ifdef sweep」、實際
                            shader 程式碼僅 RR_BUILD_A3_LUMINANCE 一個 #ifdef、
                            A1 / A2 為同一 binary uniform 切換（uRRMinBounces=3
                            vs 5）；A3 為獨立 binary
                            → 實際是「2 binary × 1 uniform sweep」非「3 binary
                            #ifdef sweep」、Critic r1 歧義 3 之「16 行 / 8 行」
                            同類問題在 v2 仍微殘
                            影響：ANGLE codegen 拖慢踩坑點 7 之預期樣貌可能不
                            如 plan 描述（A1/A2 同 binary 拖慢相同、不能用 A1
                            驗 A2 拖慢以節省工時）；屬術語精確度 caveat
```

「APPROVE w/caveats」含義：v2 結構性問題已解（r1 致命 5 + 應修 5 + Critic r1 MJ-A/MJ-B + SR1~5 + MN-A~E + Gap 1/2/4/5 全閉鎖、Gap 3/6/7 + NTH2/3 延遲合理），但 C1~C4 必須在 Critic r2 升 APPROVE 前以 v3 一輪修正、或交付 executor 時於 Step 0 第 0 步前就地閉鎖；否則統計閘失真可能造成 Step 0 退場結論誤判（誤判類型：把可 commit 的 build 推 fail-correctness、或把 mask 觸上界 70% 誤分流）。

預期 Critic r2 對齊（Critic r1 §9.3 已預期 r2 verdict = APPROVE w/caveats、本 r2 對齊）。

---

## §2. r1 issue resolution audit（F-1~F-5 / M-1~M-5）

### 2.1 致命級 F-1 ~ F-5

| r1 ID | v2 解決位置 | 獨立判讀 | 結論 |
|-------|------------|----------|------|
| **F-1**（pixel diff = 0 hard gate fail-by-design） | §A.1 P4 + §B.4 + §D.4 + §E.2 + §H.3（五處連動） | v2 P4 已重寫為「KS test (p>0.05) AND 3-sigma mean diff (≤ 3 × σ_path / √1024)」雙條件、明確刪除「pixel diff = 0」字樣；§B.4 補完 Variance increase 公式 + 引用 Veach §10.4.2 + 明確標「mean unbiased ≠ pixel-exact」；§D.4 量測協定列 N=4 baseline + KS test 執行；§E.2 commit gate 改寫；§H.3 過閘規則對齊。**結構性閉鎖完整、無殘骸。** | **CLOSED**（但見 §1 C1 / C2 caveat） |
| **F-2**（mean unbiased → pixel diff = 0 統計謬誤） | §B.4 重寫 | v2 §B.4 列 Mean unbiased + Variance increase 雙公式、引用 Veach §10.4.1 + §10.4.2、明確刪除 v1 「→ 1024-spp pixel diff = 0 可達」謬誤推論、加 σ(mean_1024) ≈ σ_X × √((1+1/p_avg)/1024) 量級估計。**數學基礎重建完整、與 F-1 統計閘改寫對齊。** | **CLOSED** |
| **F-3**（mask flow 互動分析錯誤） | §A 程式碼骨架 + §C.4 / §C.5 / §C.6 / §C.7 | v2 §A 程式碼骨架已加 `willNeedDiffuseBounceRay == FALSE` 守門（與 r1 MR3 建議完全對齊）；§C.4 重寫 mask flow 分析、列出三子問題（A 觸上界 / B 量綱推高 / C break 漏 reset）；§C.5 補強 willNeedDiffuseBounceRay 切換互動；§C.6 加 mask 分佈 instrumentation；§C.7 補 sentinel uniform 紀律。**三子問題全部閉鎖、程式碼骨架對齊。** | **CLOSED** |
| **F-4**（RNG 引用錯誤） | §A.2 D2 + §G 踩坑點 1 | v2 §A.2 D2 引用 PathTracingCommon.js L3070-L3093 完整原文（rng() = IQ Shadertoy hash + uvec2 seed += uvec2(1) + 1103515245U；rand() = Jacco Bikker + randNumber + blueNoise + frameCounter×0.618、明確標「兩者獨立 RNG state、不是 wrapper 關係」）；§G 踩坑 1 同步更正。**引用準確、與實際機制完全對齊。** | **CLOSED** |
| **F-5**（minBounces=3 在 Cloud rod 場景嚴重不足） | §A.3 + §D + §H.5 | v2 採三 build sweep（A1: max-ch + min=3 / A2: max-ch + min=5 / A3: lum + min=3）、§D Step 0 三 build 量測表完整、§H.5 minBounces sweep 矩陣明列；§B.3 bounce 編號約定統一為 shader iteration count（修 r1 F-5 sub-issue「業務語義 vs shader iteration count」）。**sweep 機制建立、bounce 編號對齊。** | **CLOSED**（但見 §1 C4 caveat：A1/A2 實際同 binary） |

### 2.2 應修級 M-1 ~ M-5

| r1 ID | v2 解決位置 | 獨立判讀 | 結論 |
|-------|------------|----------|------|
| **M-1**（viable options 探索深度不足） | §A.3 + §D 三 build 探針 | v2 同期試 A1/A2/A3、Option 3 為真備案（觸發條件 = mask 觸上界 > 80%）；探索深度從 1 點升 3 點。**符合 r1 SR4 + Synthesis Stage A 設計。** | **CLOSED** |
| **M-2**（commit 門檻 +5% 與 ROADMAP ≤ 10% 關係模糊） | §A.4 + §B.1 | v2 新增 §A.4 期望收益段、ROADMAP「≤ 10%」拆解為三檔條件式收益表（< 50% / [50%, 80%] / > 80% 觸上界比例對應 +5~10% / +1~5% / ≤ +1%）、+5% 門檻定位為「單站點合格線」非「桶 2 #2 整段合格線」。**含義拆解清晰。** | **CLOSED**（但見 §1 C3 caveat：80% 切點 anchor 缺失） |
| **M-3**（C3 視覺驗證棄權誤判） | §H.1 + §H.2 | v2 §H.1 三表分拆、明確標「spp/sec C3 棄權 / 1024-spp 視覺驗證 C3 不棄權」；§H.2 量測協定對齊 Phase 1.0 §5.2「穩態 frame-skip ≈ 0」結案結論。**分拆正確、邏輯清晰。** | **CLOSED** |
| **M-4**（firefly mitigation 帶 clamp band-aid 風險） | §G 踩坑 4 改寫 | v2 §G 踩坑 4 mitigation 兩層（第 1 層 0.05 下限保留、第 2 層 mask 上游量綱排查）、明確列 4 條「禁止」（emission clamp / 5×5 cross-bilateral / 直接調 0.05 下限 / band-aid pattern）；對齊 R3-7 方向 A 體例「0.05 下限是工程平衡、不是物理參數」。**對齊 user feedback「Path Tracing clamp 是診斷訊號不是 fix」紀律。** | **CLOSED** |
| **M-5**（四連敗教訓未充分內化、缺 ANGLE codegen 拖慢踩坑） | §G 踩坑 7（新增）+ §F Step 0 第 0 步 | v2 §G 踩坑 7 完整、列 F2 step0-noop 1.24% 實證 anchor、預估自身拖慢 1~2%；§F Step 0-1 / §D.3.0 RR uniform OFF baseline 量測表 + 三檔分流（≥3% 整段結案 / [1%,3%) 扣回 +5% 門檻 / <1% 名義門檻有效）。**踩坑 + 量測 + 分流三段完整。** | **CLOSED** |

### 2.3 r1 致命 / 應修 整體閉鎖度

```
F-1 ~ F-5：5/5 CLOSED（無殘骸）
M-1 ~ M-5：5/5 CLOSED（無殘骸）
r1 SR1~SR5 + NTH1：對應位置全部閉鎖（見 v2 fix coverage table）
r1 NTH2 / NTH3：延遲屬建議級、本 r2 認可（NTH2 commit message 已含 KS p-value 欄位、覆蓋；NTH3 標題 v2 已執行）
```

r1 整體閉鎖度：100%（10 條結構性 + 6 條建議級全閉鎖或合理覆蓋）。

---

## §3. Critic r1 issue audit（MJ-A / MJ-B / SR1~5 / MN-A~E / Gaps / Ambiguities）

### 3.1 MAJOR Findings

| Critic r1 ID | v2 解決位置 | 獨立判讀 | 結論 |
|--------------|------------|----------|------|
| **MJ-A**（continueProb 觸上界 detection 機制缺失） | §C.6（新增）+ §D.4 + §F-fast-skip 7 條 root cause + §G 踩坑 7（合併） | v2 §C.6 加 mask 分佈 instrumentation、量測 maxCh / luminance 直方圖 + 觸上界比例；§D.3.4 量測表 + §A.4 條件式收益表三檔分流；§F-fast-skip-mask-overflow 退場分支獨立、明確推 v3 Option 3。**detection 機制建立、退場分流明確。** | **CLOSED**（但見 §1 C3 caveat：80% 閾值 anchor） |
| **MJ-B**（A.3 invalidation rationale strawman） | §A.3 重寫 | v2 §A.3 Option 2 rationale 改寫：刪 v1「砍率過高 → 偏色」strawman、改為「Option 2 與 Option 1 失敗風險高度相關（同因同果）→ MR4 三 build sweep 已涵蓋」；Option 3 rationale 改寫：刪 v1「+1%~+5% 灰色帶」strawman、改為「啟動條件 = mask 觸上界 > 80%」。**對齊 Critic r1 MJ-B 兩項建議。** | **CLOSED** |

### 3.2 MINOR Findings

| Critic r1 ID | v2 解決位置 | 獨立判讀 | 結論 |
|--------------|------------|----------|------|
| **MN-A**（§H 三表格相同重驗目的模糊） | §H.1 註腳分拆 | v2 §H.1 三表格分拆（Step 0 探針期 / Step 1 煙霧測試 / Step 2 vsync jitter 重跑）、明列各 Step 重點 | **CLOSED** |
| **MN-B**（§G 踩坑 5 uMaxBounces 互動驗證量化不足） | §G 踩坑 5 | v2 改為「magick compare + luminance histogram peak 遞增」量化驗證、對齊 §H.2 magick AE 體例 | **CLOSED** |
| **MN-C**（SOP 加段位置 / wording 模糊） | §F Step 3-4 改寫 | v2 §F Step 3-4 + §F 步驟 3-4 明列「§86 結構優化分流之後新增 §87、wording 對齊 §86 a/d 結案段體例（Verdict / 收益 / rollback path / follow-up 4 段）」 | **CLOSED** |
| **MN-D**（plan 寫死 +5% 為下界、未對齊 M-2 拆解） | §A.4（新增） | v2 §A.4 條件式收益表三檔對應（< 50% / [50%, 80%] / > 80%）、與 MJ-A / M-2 / Gap 1 連動 | **CLOSED**（但見 §1 C3） |
| **MN-E**（§B.4 Variance 公式 + LaTeX 量綱缺失） | §B.4 重寫 | v2 §B.4 補 Variance increase 公式 + 引用 Veach §10.4.2 + Mean / Variance / Sample mean 三公式並列 | **CLOSED** |

### 3.3 Critic r1 SR1~SR5

```
SR1 = M-2 同位置處理 → §A.4 / §B.1 ✓
SR2 = M-4 同位置處理 → §G 踩坑 4 ✓
SR3 = M-5 同位置處理 → §G 踩坑 7 + §F Step 0-1 ✓
SR4 = Option 2/3 從「v2 備案」改「v2 sweep 候選」→ §A.3 ✓
SR5 = root cause 假說 6 → 7 條 + 必同時列 mask 分佈量測支持哪條 → §F-fast-skip F-3 ✓

整體閉鎖度：5/5 CLOSED
```

### 3.4 Critic r1 Gaps（1/2/4/5）+ 歧義（1/2/3）

```
Gap 1：continueProb 觸上界比例量測 + 80% 閾值 → §C.6 + §D Step 0 ✓（C3 caveat 屬閾值 anchor 缺失、非實作 gap）
Gap 2：Step 2 重跑漂移處理 N=3 中位數 + 5% 閾值 → §H.4 ✓
Gap 4：cache busting query 保留紀律 → §F-fast-skip F-2 ✓
Gap 5：?v=r6-2-rr-step0-{A1|A2|A3|off} 命名規則 → §F Step 0 / §A 改動範圍 ✓
歧義 1：bounce 編號約定（業務語義 vs shader iteration count）→ §B.3 統一寫法 + footnote ✓
歧義 2：MR1 統計閘改寫直接消除 → §A.1 P4' ✓
歧義 3：≤ 8 行 vs 16 行 GLSL → §A 改動範圍「shader 改動 ≤ 22 行（含 2 行 uniform + 8 行 RR check + 8 行 mask 分佈 + 4 行註解 / 空行）、§A.3 Option 1 ≤ 6 行 GLSL（不含註解）」✓（但見 §1 C4：「3 binary」vs 「2 binary」術語精確度同類殘漏）

整體閉鎖度：4/4 Gaps CLOSED + 3/3 歧義 CLOSED（C4 為新引入殘漏、歸入 §5）
```

---

## §4. Deferred-item judgement（Gap 3 / Gap 6 / Gap 7 / NTH2 / NTH3）

### 4.1 Gap 3（Brave 桌面 ontouchstart 誤判）

```
v2 延遲理由：「v2 不暴露 RR GUI、Step 1~3 階段全用 hardcoded uniform 跑、即繞過此互動風險、無需修」
獨立審查：
  - PathTracingUniforms 註冊 3 條 uniform（uRussianRouletteEnabled / uRRMinBounces /
    uRRProbeStat）僅是 Three.js shader uniform 註冊、不會自動產生 GUI 滑桿（GUI 是
    setupGUI() 顯式 add 出來的）
  - v2 §B.2 line 500-502 明確標「Step 1~3 階段全用 hardcoded uniform 跑」
  - 對齊 user feedback「Brave 桌面 ontouchstart 誤判」之 mouseControl 守門問題（影響 GUI
    操作、不影響 hardcoded uniform path）→ 繞過路徑成立、與 user feedback 紀律不衝突
  - 若日後 v3 暴露 GUI、再評估 Brave 守門
判決：DEFERRAL APPROVED（airtight）
```

### 4.2 Gap 6（visual-verdict skill 啟用）

```
v2 延遲理由：「MR1 統計閘 + 3-sigma mean diff + KS test 已是定量機制、再疊 visual-verdict
              屬冗餘；若 Stage B commit 後肉眼檢仍有疑義可在 Step 3 結案 report 階段補做、
              不阻擋 Step 0 / Step 1 / Step 2」
獨立審查：
  - statistical gate（KS test + 3-sigma）確實比 visual-verdict skill 之 Structured Visual
    QA 更嚴格、是定量化升級、不是替代品
  - Critic r1 §7 已自評「nice-to-have、不必修」、屬建議級
判決：DEFERRAL APPROVED
```

### 4.3 Gap 7（mask /= p 代數驗證）

```
v2 延遲理由：「公式正確（Veach §10.4.1）、屬數學嚴謹性 gap、非阻擋；v2 §B.4 加引用 Veach
              §10.4.1 + §10.4.2 但不展開完整代數推導、節省篇幅」
獨立審查：
  - r1 已認可 plan 數學基礎；v2 §B.4 補 Mean / Variance / Sample mean 三公式 + 引用 ≥ 已
    達數學嚴謹性合理門檻
  - 完整 ∫f cos(θ)/p alignment 推導屬教科書級複述、對 plan 結構性無增益
判決：DEFERRAL APPROVED
```

### 4.4 NTH2（commit message 範本）

```
v2 §E.4 commit message 範本已含 KS test p-value + 3-sigma mean diff + maxCh ≥1 比例三欄位、
原 r1 NTH2 建議覆蓋
判決：DEFERRAL APPROVED（已併入）
```

### 4.5 NTH3（plan 標題 v1 → v2）

```
v2 plan 已標 v2 + 修訂歷史置頂（fix coverage table）+ §修訂歷史 v1→v2 詳列
判決：DEFERRAL APPROVED（已執行）
```

### 4.6 延遲整體判決

```
Gap 3 / Gap 6 / Gap 7 / NTH2 / NTH3：5/5 DEFERRAL APPROVED
無任一延遲隱藏 fatal 級風險、無需 escalate
```

---

## §5. New-issue hunt（v2 新增 618 行的 attack surface）

v2 新增 618 行涵蓋：KS test + 3-sigma 統計閘、三 build #ifdef sweep、mask 分佈 instrumentation（DCE-proof sink）、continueProb 上界 80% 退場分流、7-hypothesis fast-skip + 4-branch exit、bounce 編號約定統一、ANGLE codegen 校正。逐項審查：

### 5.1 KS test 統計閘 sample-size 問題（→ §1 C1 caveat）

```
位置：v2 §A.1 P4' / §B.4 / §D.4 / §E.2 / §H.3
問題敘述：
  v2 設計「KS test p-value > 0.05」為過閘條件之一。但 KS test 在大樣本下 p-value 解析度
  極高、p < 0.001 易達；對 1024-spp × resolution（典型 1024 × 1024 = 約 1M 像素）級別
  sample size、即使 RR ON 與 RR OFF baseline 之分佈差異極小（如 mean 偏移 1e-5）仍可能
  KS p-value < 0.05、被判破壞正確性
證據：
  - KS test statistic D = sup|F1(x) - F2(x)|；在 N1 = N2 = 1e6 sample 下、臨界 D_0.05
    ≈ 1.36 × √(2/N) ≈ 1.36 × √(2e-6) ≈ 1.92e-3
  - RR ON 引入的「per-pixel mean diff 觀測值 ~ σ(mean) × N(0,1)」其分佈差異對 D
    statistic 的貢獻、即使 mean diff 量級 1e-3（< 3-sigma 閘）仍可能 D > 1.92e-3
    → KS p < 0.05 但 mean diff 過閘 → 兩條件互斥
  - 教科書 KS test 對「分佈是否完全相同」過於敏感、適用於小 sample（N < 1000）
影響：
  - Step 0 統計閘可能 false-fail、把可 commit 的 build 誤判為破壞 path tracer 正確性
  - 與 r1 F-1 之「不可達」性質不同、屬於「過度敏感」
  - 退場分流誤入 F-fail-correctness、整段結案、但不破壞既有正確性
為什麼 caveat 級而非 fatal：
  - mean diff (3-sigma) 條件仍是有效閘、單獨可用
  - KS test 失真不會造成「假過閘」（false-pass、危險方向）、只造成「假回滾」（false-fail、保守方向）
  - 修法簡單：可改 KS test 為 sub-sample（pixel sample N=1000）、或改用 Anderson-Darling /
    Wasserstein distance、或將 KS test 從 hard gate 降為 secondary diagnostic
建議修法（v3 一輪內可修）：
  a. KS test 從 hard gate 降為 secondary diagnostic、僅報 p-value 不入過閘判斷
  b. 過閘改為 mean diff (3-sigma) + per-pixel violation rate ≤ 1% 雙條件
  c. 或 KS test 改 sub-sample N=1000~10000、保留 KS p > 0.05 作為過閘
參考：v2 §D.4 line 919「mean diff ≤ threshold[c]（per-pixel 全過 OR pixel violation rate ≤ 1%）AND KS test p-value > 0.05、兩條件均過 → 過閘」之 AND 改 OR 是最低工程量修法
```

### 5.2 σ_path 估計器統計穩健性問題（→ §1 C2 caveat）

```
位置：v2 §D.4 line 905-911
問題敘述：
  v2 設計「σ_path = 對 4 次取樣的 per-pixel std → 取場景 median 為 σ_path」
  N=4 sample std 統計性質：
    - sample variance 之 χ² 分佈、自由度 ν=N-1=3
    - sample std 之相對標準誤差 ≈ √(1/(2(N-1))) = √(1/6) ≈ 0.41 → ~30%
  取場景 median 為單一 σ_path：
    - NEE-rich 區域（軌道燈光斑、Cloud rod 下方）pixel σ 可能 0.1~1.0
    - 暗區（陰影 / 牆面）pixel σ 可能 0.001~0.01
    - median 可能落 0.01 量級、對 NEE 區嚴 100×、對暗區鬆 100×
影響：
  - 3-sigma threshold 在不同區域有效嚴格度不一致：NEE 區 RR variance 增量可能誤判
    為「破壞正確性」、暗區 RR variance 增量可能漏判
  - 與 §1 C1 同屬統計閘參數選擇問題、屬 caveat 級
為什麼 caveat 級而非 fatal：
  - 均值偏移（mean diff）仍會被偵測到、不會「假過閘」
  - 修法簡單：σ_path 改 per-pixel local std（5×5 鄰域）、或 N 升到 8~16、或改用
    bootstrap CI
建議修法（v3 一輪內或 Step 0 執行階段就地修正）：
  a. σ_path 改為 per-pixel σ_path[c, x, y]（從 N=4 baseline 各 pixel 各自計算）、不取 median
  b. 過閘改為「per-pixel mean diff ≤ 3 × σ_path[c, x, y] / √1024」（per-pixel threshold）
  c. 或 baseline N 升到 N=8（工時增 +1 倍 baseline、約 +30 分鐘）、降低 σ 估計誤差到 ~21%
  d. 暗區 σ 偏低觸發誤判時、σ_path 加 floor（例如 σ_path = max(σ_path_local, 1e-3)）
參考：v2 §D.4 line 916-921 過閘判定改為 per-pixel σ + 場景 violation rate ≤ 1% 是
      最簡修法
```

### 5.3 continueProb 觸上界 80% 閾值 anchor 缺失（→ §1 C3 caveat）

```
位置：v2 §A.4 條件式收益表 + §C.6 + §D.3.4 + §F-fast-skip-mask-overflow
問題敘述：
  v2 設計三檔分流（< 50% / [50%, 80%] / > 80%）、80% 與 50% 切點無形式化推導：
    - 為什麼是 80%、不是 70% / 90%？
    - 為什麼 [50%, 80%] 為灰色帶、不是 [40%, 70%]？
  Critic r1 MJ-A 之原始建議用 80% 閾值、但未提供 anchor；v2 沿用、亦無 anchor
影響：
  - 邊界判讀缺實證 anchor、易招 v3 質疑
  - Step 0 結束結論若觸上界比例 = 78% → 進 Option 1 + minBounces sweep；若 = 82% →
    推 Option 3 → 結論可能因 ±2% 量測誤差而異
為什麼 caveat 級而非 fatal：
  - 即使閾值偏差、退場分流仍是合理區隔（極端 > 90% 必然「沒做 RR」、< 30% 必然
    「做了 RR」）；中段 [50%, 80%] 灰色帶判讀不確定屬可控
  - 修法簡單：把閾值定義為「定性指引」而非「hard gate」、或補形式化推導 anchor
建議修法（v3 文件化）：
  a. 80% 閾值之 anchor 補述：「continueProb 觸上界比例 > 80% 等價於『至少 80% 路
     徑 mask /= p 退化為 mask /= 1 = mask、未引入 1/p 補償』、實質 RR ON / OFF mean
     差異 ≤ 20%、預期 spp/sec Δ ≤ +5% 對齊 v2 §A.4 條件式收益表」
  b. 50% 閾值之 anchor 補述：「< 50% 等價於『超過半數路徑 RR check 真的砍 ray』、
     RR 確實在運作、收益期望 +5~10% 對齊 ROADMAP 上限」
  c. 或將閾值降為「定性指引」、明列「±10% 量測誤差時應走灰色帶處理」
```

### 5.4 三 build #ifdef sweep 術語不準確（→ §1 C4 caveat）

```
位置：v2 §A.3 / §D.1 / §F Step 0-2~0-4 / §H.5
問題敘述：
  v2 plan 多處宣稱「三 build #ifdef sweep」(A1: max-ch + min=3 / A2: max-ch + min=5
  / A3: lum + min=3)、但實際 shader 程式碼僅 1 個 #ifdef：
    #if defined(RR_BUILD_A3_LUMINANCE)
        float continueProb_raw = dot(mask, vec3(0.2126, 0.7152, 0.0722));
    #else
        float continueProb_raw = max(max(mask.r, mask.g), mask.b);
    #endif
  uRRMinBounces 為 uniform、A1=3 / A2=5 透過 JS 端切 uniform value、不需重編 shader
  → 實際是「2 binary（A1/A2 共 binary、A3 獨立 binary）× 1 uniform sweep」
  → 非「3 binary #ifdef sweep」
影響：
  - 術語精確度問題、Critic r1 歧義 3「16 行 / 8 行」同類問題在 v2 仍微殘
  - ANGLE codegen 拖慢踩坑點 7 預期樣貌可能不如 plan 描述：
    - A1 / A2 同 binary、ANGLE codegen 結果相同、拖慢測得 1 次即可代表兩者
    - A3 獨立 binary、ANGLE codegen 結果可能不同、需獨立量測
  - 工程實質量影響有限（少 1 次 build → 約 -10 分鐘量測）、但量測表 §D.3 標
    「A1 build」/ 「A2 build」/ 「A3 build」三組獨立量測可能誤導 executor 重複跑
為什麼 caveat 級：
  - 不影響統計閘正確性、不影響退場分流邏輯
  - 屬術語不準確、可在 v3 文件化階段或 executor 階段就地對齊
建議修法（v3 文件化或 executor 對齊）：
  a. v2 §A.3 / §D.1 改為「2 binary × 3 config sweep（A1/A2 共 binary、uniform
     uRRMinBounces 切換；A3 獨立 #ifdef binary）」
  b. §D.3.1 / D.3.2 量測表合併為「max-channel binary × {minBounces=3, minBounces=5}」、
     §D.3.3 為「luminance binary × minBounces=3」
  c. §G 踩坑 7 預期：A1 拖慢 = A2 拖慢、A3 拖慢可能不同、需獨立量測
```

### 5.5 mask sentinel `uRRProbeStat > 0.5` runtime-impossible 守門驗證

```
位置：v2 §A 程式碼骨架 line 562 + §C.7 sentinel uniform 紀律
獨立審查：
  - uRRProbeStat 預設 -1.0（runtime-impossible 之外 1 個量級）
  - guard `if (uRRProbeStat > 0.5)` 在 mode 0 (RR off) 與 mode 1 (RR on) 主路徑均不
    觸發（因為 uRRProbeStat = -1.0 永遠 ≤ 0.5）
  - 對齊 R3-1 DCE-proof sink pattern「uR3EmissionGate < -0.5」（gate ∈ {0, 1}、永遠
    ≤ -0.5 為 false）
  - 對齊 user feedback「Path Tracing DCE-sink gate 係數陷阱：DCE-proof sink 嚴禁用
    業務 gate 作係數、改用 runtime-impossible guard」精神
  - Step 0 mask 分佈量測階段：JS 端設 uRRProbeStat = 1.0、跑 single frame 量測；
    回到 spp/sec 量測階段：JS 端設 -1.0、不打 mode 0 主路徑
判決：runtime-impossible guard 紀律守住 ✓（無 caveat）
```

### 5.6 mask 分佈 instrumentation 寫入幅度檢查

```
位置：v2 §A 程式碼骨架 line 568-569
程式碼：
    accumCol.r += maxCh * 1e-30;
    accumCol.g += lum * 1e-30;
獨立審查：
  - mask 量級：path tracing 場景累乘後、maxCh 典型 ∈ [0.05, 100]、極端 NEE bake 後
    可達 1000~10000（uLegacyGain × uIndirectMultiplier × emit baked 多 bounce 累積）
  - 寫入幅度 = maxCh × 1e-30 ≈ [5e-32, 1e-26]
  - accumCol 主路徑量級 ~ 1.0（path tracing radiance accumulator）
  - 比例 ≤ 1e-26 / 1.0 = 1e-26、遠低於 fp32 mantissa precision (~1e-7)
  - 即使 uRRProbeStat = 1.0（量測階段觸發）、寫入值在 fp32 加法下被吃掉、不影響
    accumCol 可見輸出
  - 等同 R3-1 DCE-proof sink pattern「accumCol += sum(uniforms) × 1e-30」精神
判決：寫入幅度安全、不污染 mode 0 / mode 1 主路徑（無 caveat）
注意：v2 §A 程式碼骨架明確標「具體 imageStore / texelFetch 細節由 Step 0 實作時補完」
      → readback 機制仍是 ambiguity（見 §5.8）
```

### 5.7 fast-skip 4-branch exit 分割完整性

```
位置：v2 §F Step 0-6 + §F-fast-skip-{codegen, mask-overflow, spp, correctness}
獨立審查 4 branch 分割是否完整：
  1. Step 0-1 OFF 拖慢 ≥ 3% → F-fast-skip-codegen
  2. Step 0-5 mask 觸上界 > 80% → F-fast-skip-mask-overflow
  3. Step 0-6 spp/sec 全 build 不過閘 → F-fast-skip-spp
  4. Step 0-7 統計閘失敗 → F-fail-correctness
四分支彼此互斥嗎：
  - 1 vs 2/3/4：1 早返、不進 2/3/4（Step 0-1 後直接 fast-skip）✓
  - 2 vs 3/4：2 在 Step 0-5、3 在 Step 0-6、4 在 Step 0-7、循序執行；2 觸發即 fast-skip、
    不進 3/4 ✓
  - 3 vs 4：3 在 Step 0-6、4 在 Step 0-7、循序；3 觸發即 fast-skip、不進 4 ✓
四分支彼此完整覆蓋失敗空間嗎：
  ⚠ 灰色帶 [50%, 80%] mask 觸上界 + 任一 build 過 spp +5% 閘 + 統計閘過：
    - 此情境屬「mask 接近觸上界但未到 80%、RR 仍砍了部分 ray」
    - v2 §A.4 line 423-428 條件式收益表標「進 Stage B commit」、與 §F Step 0-6 過閘
      路徑一致 ✓
  ⚠ 灰色帶 [50%, 80%] mask 觸上界 + 全 build < +5% spp 閘：
    - v2 §A.4 line 426-427「灰色帶；若 [+1%, +5%) 全部 → 整段結案，記為 v3 Option 3
      候選」
    - §F Step 0-6 此情境 spp 不過閘 → 走 F-fast-skip-spp（branch 3）
    - F-fast-skip-spp root cause 假說 7 條中無「mask 觸上界灰色帶 + spp 不過」此特定
      組合 → 退場報告會把 root cause 歸為「公式族 + 站點 + minBounces sweep 全不可行」
      但實際 root cause 可能是「灰色帶 + RR 砍率邊際、+5% 嚴格、應降門檻或推 Option 3」
影響：
  - 4-branch 分割實際是「分支 3 吞掉灰色帶 spp 不過情境」、與 plan §A.4 條件式收益表
    [50%, 80%] 對應「±5% 期望 / [+1%, +5%) 全部則整段結案，記為 v3 Option 3 候選」
    略有出入
  - 屬 documentation 對 implementation path 的微小不齊（minor underdocumentation）
為什麼 caveat 級：
  - 不影響功能正確性（fast-skip 路徑仍是回滾、寫退場報告、本地 commit）
  - 退場報告 root cause 假說範圍可能誤判、但 7 條 root cause + mask 分佈量測結果 必同
    時列已能讓 reader 識別灰色帶情境
建議修法（v3 文件化或 executor 階段就地修正）：
  a. §F Step 0-6 加 sub-branch：「若 mask 觸上界 ∈ [50%, 80%] AND 全 build spp < +5%
     → 走 F-fast-skip-spp 但 root cause 標『灰色帶』、推 v3 Option 3」
  b. 或 §F-fast-skip-spp 加第 8 條 root cause 假說「灰色帶 + RR 砍率邊際」
  c. 退場報告必同時列「mask 觸上界比例落點 + 對應 §A.4 三檔分流」
判決：documentation 微殘、不影響執行正確性 → caveat 級
```

### 5.8 Step 0 instrumentation readback 機制延遲到實作階段

```
位置：v2 §A 程式碼骨架 line 567「(具體 imageStore / texelFetch 細節由 Step 0 實作時補完)」
問題敘述：
  v2 plan 將 mask 分佈 instrumentation 之 GPU → CPU readback 機制（imageStore SSBO /
  framebuffer texture 解碼 / readPixels 等）延遲到 Step 0 實作階段補完
  - 對 Three.js + erichlof framework：常用做法是 RenderTarget + readRenderTargetPixels
  - 對 mask 直方圖 / 觸上界比例之聚合：JS 端 reduce 或 GPU compute pass、皆未列
影響：
  - Step 0 第 0-5 步「mask 分佈量測」之執行細節未定型、executor 可能就地花 1~2 hr 設計
    readback 路徑、屬於 plan-to-executor handoff 的 ambiguity
  - 對 plan 結構性無影響、屬執行細節 gap
為什麼 caveat 級而非 fatal：
  - readback 機制屬技術實作細節、非設計決策、Step 0 實作階段補完是合理的延遲
  - Three.js + erichlof 的 readRenderTargetPixels pattern 是標準做法、executor 不需 plan 給範本
建議修法（v3 文件化或 executor 階段補完）：
  a. v3 §C.6 加「readback 機制 = WebGLRenderTarget + renderer.readRenderTargetPixels()
     讀回 RGBA8 或 R32F、JS 端聚合 maxCh ≥ 1.0 比例」、提供範本程式碼
  b. 或 executor 在 Step 0 第 0-5 步前花 30 分鐘設計 readback、屬合理工時
判決：plan-to-executor handoff ambiguity、caveat 級
```

### 5.9 v2 新增 618 行整體攻擊面

```
v2 新增 attack surface 涵蓋 7 大塊：
  1. KS test + 3-sigma 統計閘：見 §5.1（C1 caveat）+ §5.2（C2 caveat）
  2. 三 build #ifdef sweep：見 §5.4（C4 caveat 術語）
  3. mask 分佈 instrumentation：見 §5.5（safe）+ §5.6（safe）+ §5.8（caveat readback）
  4. continueProb 上界 80% 退場分流：見 §5.3（C3 caveat 閾值 anchor）
  5. 7-hypothesis fast-skip + 4-branch exit：見 §5.7（minor underdocumentation）
  6. bounce 編號約定統一：r1 F-5 sub-issue 修正、無新風險
  7. ANGLE codegen 校正：對齊 r1 M-5 / SR3、無新風險

整體：4 條 caveat（C1~C4）+ 1 條 minor underdocumentation + 2 條 safe pattern + 1 條
      handoff ambiguity；無新 fatal、所有 caveat 屬統計設計 / 文件精確度級、可在 v3
      一輪內或 executor 階段就地修正
```

---

## §6. Cross-cut concerns（erichlof / Brave / DCE-proof / clamp ban）

### 6.1 erichlof framework: pixelSharpness 是 walk-denoiser sharpness flag

```
v2 是否誤觸 pixelSharpness 邊界？
  - v2 改動範圍：bounce 主迴圈內 RR check + mask 分佈 instrumentation
  - pixelSharpness 屬 erichlof InitCommon.js 之走步降噪流程、不在 path tracing
    fragment shader 主迴圈
  - v2 不動 pixelSharpness 之 mark / read 邏輯、不入 walk denoiser 後處理
  - 對齊 user feedback「erichlof pixelSharpness 不是 edge mask、後處理 shader 借用會
    讓家具光源全跳過 bilateral」
判決：v2 與 pixelSharpness 邏輯解耦、無互動風險 ✓
```

### 6.2 Brave 桌面 ontouchstart 誤判

```
v2 是否觸發 mouseControl false 連鎖？
  - v2 §B.2 line 500-502 明確「v2 不暴露 GUI、Step 1~3 階段全用 hardcoded uniform 跑」
  - pathTracingUniforms 註冊 3 條 uniform 是 Three.js shader uniform binding、不會自
    動建立 GUI 滑桿（GUI 是 setupGUI() 顯式 add 出來的）
  - JS 端切 uniform value 是 `pathTracingUniforms.uXxx.value = N`、與 mouseControl 無關
  - 對齊 user feedback「Brave 桌面 ontouchstart 誤判讓 mouseControl=false、scene
    setupGUI 禁用 mouseControl 守門」
判決：Gap 3 延遲 airtight、無 framework DOM null.style 連鎖 ✓
注意：v2 §A 改動範圍不刪 DOM、不動 InitCommon.js、無「Framework DOM id 嚴禁刪除」
      user feedback 觸發風險 ✓
```

### 6.3 DCE-proof sink pattern 紀律

```
v2 instrumentation 是否守 runtime-impossible guard？
  - v2 §A 程式碼骨架 line 562-570：
    if (uRRProbeStat > 0.5) {
        ...
        accumCol.r += maxCh * 1e-30;
        accumCol.g += lum * 1e-30;
    }
  - uRRProbeStat 預設 -1.0、guard `> 0.5` 在 mode 0 / mode 1 主路徑均 false（runtime
    永不觸發）
  - 對齊 R3-1 sink pattern「uR3EmissionGate < -0.5」（gate ∈ {0, 1}、永遠 false）
  - 對齊 user feedback「DCE-proof sink 嚴禁用業務 gate 作係數、改用 runtime-impossible
    guard」
判決：DCE-proof sink 紀律守住 ✓
注意：Step 0 量測階段 JS 端設 uRRProbeStat = 1.0、guard 觸發、accumCol += maxCh × 1e-30；
      此時 sink 為「業務活躍」、但寫入幅度 ≤ 1e-26、不污染 mode 0 / mode 1 量測（見 §5.6）
```

### 6.4 clamp / post-process denoiser 禁忌

```
v2 是否提議 emission clamp 蓋 firefly？
  - v2 §G 踩坑 4 mitigation 兩層：
    第 1 層：clamp(continueProb_raw, 0.05, 1.0)（保留 v1 設計、補償倍率上限 20×）
    第 2 層：mask 上游量綱排查（mask × uLegacyGain × uIndirectMultiplier 疊加溢出檢查）
  - §E.3 firefly / banding 視覺檢查 → 4 條「禁止」明列：
    - 加 emission clamp 蓋 firefly（user feedback 紀律）
    - 加 5×5 cross-bilateral 蓋 firefly（user feedback 紀律）
    - 直接調 0.05 下限到更大（band-aid pattern）
  - clamp(continueProb, 0.05, 1.0) 是「continueProb 機率上下限」非「emission clamp」、
    屬 RR 公式之必要參數、不是 firefly band-aid
  - 對齊 user feedback「Path Tracing clamp 是診斷訊號不是 fix」+「PT 5×5 cross-bilateral
    是 blur 不是 denoise」
判決：v2 全段無 clamp / post-process denoiser 蓋 firefly 之提議 ✓
注意：0.05 lower bound 是「continueProb 機率下限」、與 emission clamp 概念正交、
      不違反 user feedback 紀律
```

### 6.5 cross-cut 整體判決

```
erichlof pixelSharpness：無互動 ✓
Brave ontouchstart：Gap 3 延遲 airtight ✓
DCE-proof sink：runtime-impossible guard 守 ✓
clamp / post-process denoiser 禁忌：v2 無提議 ✓
Path Tracing cd 路徑嚴禁多除 π：v2 §B.8 量綱紀律守 ✓
Framework DOM id 嚴禁刪除：v2 不動 DOM ✓
PT 黑白畫面 debug 先掃 accumCol 寫入點：v2 §F-fast-skip 7 條 root cause 含 mask 上游量綱 ✓

整體 cross-cut 合格度：7/7 ✓
```

---

## §7. Caveats / recommendations for v3

v2 升 APPROVE 之前須對齊以下 4 條 caveat（C1~C4），對齊路徑可選 v3 一輪文件修正、或 executor 在 Step 0 第 0 步前就地閉鎖：

```
C1（KS test sample-size 失真）優先序 1：
  問題：1024-spp × resolution ≈ 1M pixel sample、KS test p > 0.05 hard gate 過於敏感
  建議修法（v3 一輪內）：
    a. KS test 從 hard gate 降為 secondary diagnostic、僅報 p-value 不入過閘判斷
    b. 過閘改為「mean diff (3-sigma) AND per-pixel violation rate ≤ 1%」雙條件
    c. 或 KS test 改 sub-sample N=1000~10000 隨機 pixel、保留 KS p > 0.05 作為過閘
  工時：~ 30 分鐘文件 + 0~30 分鐘 JS 端 KS test 實作調整

C2（σ_path 估計器統計穩健性）優先序 2：
  問題：N=4 sample std ~30% 相對誤差 + 場景 median 取值對 NEE 區 / 暗區 σ 差異 1~2 量級
  建議修法（v3 一輪內或 Step 0 執行階段就地修正）：
    a. σ_path 改 per-pixel σ_path[c, x, y]、不取場景 median
    b. 過閘改「per-pixel mean diff ≤ 3 × σ_path[c, x, y] / √1024」
    c. 或 baseline N 升到 N=8、降低 σ 估計誤差到 ~21%
    d. 暗區 σ 加 floor（σ_path = max(σ_path_local, 1e-3)）
  工時：~ 30 分鐘文件 + 30 分鐘 JS 端 σ 計算實作調整 + ~ 30 分鐘 baseline N=8 量測（可選）

C3（continueProb 80% 閾值 anchor 缺失）優先序 3：
  問題：80% / 50% 切點無形式化推導、易招 v3 質疑、邊界判讀 ±2% 量測誤差時不確定
  建議修法（v3 文件化）：
    a. 80% anchor：「continueProb 觸上界比例 > 80% 等價於至少 80% 路徑 mask /= p
       退化為 mask /= 1、實質 RR ON / OFF mean 差異 ≤ 20%」
    b. 50% anchor：「< 50% 等價於超過半數路徑 RR check 真的砍 ray、收益期望 +5~10%」
    c. 或將閾值降為「定性指引」、明列「±10% 量測誤差時應走灰色帶處理」
  工時：~ 20 分鐘文件

C4（三 build #ifdef sweep 術語不準確）優先序 4：
  問題：實際是「2 binary（A1/A2 共 binary、A3 獨立）× 3 config sweep」、非「3 #ifdef binary」
  建議修法（v3 文件化或 executor 對齊）：
    a. v3 §A.3 / §D.1 改為「2 binary × 3 config sweep」
    b. §D.3.1/2 量測表合併為「max-channel binary × {minBounces=3, minBounces=5}」
    c. §G 踩坑 7 預期：A1 拖慢 = A2 拖慢、A3 拖慢可能不同、需獨立量測
  工時：~ 15 分鐘文件
```

額外建議（非 caveat、屬 minor 改善）：

```
M1（fast-skip 4-branch exit 灰色帶 documentation）：
  §F Step 0-6 加 sub-branch：「若 mask 觸上界 ∈ [50%, 80%] AND 全 build spp < +5%
  → 走 F-fast-skip-spp 但 root cause 標『灰色帶』、推 v3 Option 3」
  工時：~ 10 分鐘文件

M2（Step 0 instrumentation readback 範本）：
  §C.6 加 readback 機制範本：「WebGLRenderTarget + renderer.readRenderTargetPixels()
  讀回 R32F、JS 端聚合 maxCh ≥ 1.0 比例」、提供 erichlof framework 慣例 snippet
  工時：~ 30 分鐘文件 + executor 端少 1~2 hr handoff
```

C1~C4 + M1~M2 整體工時：~ 2~3 hr（v3 文件化 ~ 1.5 hr + executor 階段 ~ 0.5~1.5 hr）；
與 v2 工程量級對齊、ROI 正向。

---

## §8. Final verdict + next-step routing

### 8.1 Final verdict

**APPROVE_WITH_CAVEATS**

```
r1 致命 F-1 ~ F-5：5/5 CLOSED（無殘骸）
r1 應修 M-1 ~ M-5：5/5 CLOSED（無殘骸）
Critic r1 MAJOR MJ-A / MJ-B：2/2 CLOSED
Critic r1 MINOR MN-A ~ MN-E：5/5 CLOSED
Critic r1 SR1 ~ SR5：5/5 CLOSED
Critic r1 Gap 1 / 2 / 4 / 5：4/4 CLOSED
Critic r1 歧義 1 / 2 / 3：3/3 CLOSED
延遲 Gap 3 / 6 / 7 + NTH2 / NTH3：5/5 DEFERRAL APPROVED
新 caveat C1 ~ C4：4 條（KS test sample-size / σ_path 估計 / 80% 閾值 anchor / 三 build 術語）
新 minor underdocumentation：1 條（fast-skip 灰色帶）
新 handoff ambiguity：1 條（instrumentation readback）
cross-cut（erichlof / Brave / DCE / clamp）：7/7 守住

結構性閉鎖度：100%（r1 + Critic r1 全閉鎖）
新引入 caveat 級殘漏：4 + 1 + 1 = 6 條（全為非阻擋級）
新引入 fatal 級問題：0 條
```

### 8.2 next-step routing

```
路徑 A（推薦）：v3 一輪文件化修正（C1~C4 + M1~M2、~ 1.5~3 hr）
                 → Critic r2 升 APPROVE
                 → executor 進 Step 0 探針

路徑 B（次選）：直接進 Critic r2、由 Critic r2 決定是否要求 v3 再修
                 → Critic r2 預期判 APPROVE w/caveats（與本 r2 對齊）
                 → executor 在 Step 0 執行階段就地閉鎖 C1~C4 + M1~M2
                 → 工時略高於路徑 A、但避免 v3 文件迴圈

路徑 C（不推薦）：要求 v3 大改
                   → 與 r2 verdict 不對齊、ralplan ROI 倒掛
                   → 屬 over-engineering、不採
```

本 r2 推薦路徑 A 或路徑 B、取決於使用者對「v3 文件迴圈成本 vs executor 階段就地閉鎖」之偏好。Critic r1 §9.3 預測 r2 verdict = APPROVE w/caveats 已對齊；r2 verdict 順理進 Critic r2（按 ralplan 流程）。

### 8.3 Hard constraints（對 Planner v3 / executor）

```
DO 對齊 C1~C4 + M1~M2（v3 或 Step 0 執行階段就地）
DO 守 v2 §G 7 條踩坑 + 風險矩陣總表
DO 守 Step 0 第 0 步 RR uniform OFF baseline 量測（不可省略）
DO 守 fast-skip 4-branch exit 路徑（不可繞過）
DO 守 user feedback 紀律（clamp / post-process denoiser / mask 上游量綱排查 / DCE-proof guard / cd 量綱）

DON'T 把 KS test 從 secondary diagnostic 升回 hard gate（除非改 sub-sample）
DON'T 用 σ_path 場景 median 替代 per-pixel σ（除非 baseline N ≥ 8）
DON'T 把「三 build #ifdef sweep」術語誤為三獨立 binary（A1/A2 共 binary）
DON'T 對 mask 觸上界 [50%, 80%] 灰色帶情境直接整段結案、必檢查 spp 是否邊際
DON'T 跳過 Step 0 instrumentation readback 機制設計、屬 plan-to-executor handoff 必補
```

---

## 修訂歷史

```
v1：2026-04-27 Architect Round 1（984 行、CRITICAL_REVISION_REQUIRED、5 致命 + 5 應修）
v2：2026-04-28 Planner Round 2（1455 行、本檔 review 對象；MR1~MR5 + SR1~SR5 + Critic r1
                MJ-A/MJ-B + SR1~5 + MN-A~E + Gap 1/2/4/5 + 歧義 1/2/3 全閉鎖；延遲 Gap
                3/6/7 + NTH2/3 五項合理）
r2：2026-04-28 Architect Round 2（本檔；APPROVE w/caveats；C1~C4 新 caveat + M1~M2 minor
                + 7/7 cross-cut 守住 + 0 新 fatal；推薦路徑 A v3 文件化 / 路徑 B 進 Critic r2）
```
