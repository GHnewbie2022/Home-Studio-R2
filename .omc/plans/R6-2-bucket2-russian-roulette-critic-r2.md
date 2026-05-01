# R6-2 桶 2 #2 Russian Roulette Plan v2 — Critic Review Round 2

> Round: 2
> Reviewer: critic agent (opus)
> Mode: THOROUGH（無 ESCALATION 條件命中、未升 ADVERSARIAL；理由見 §6 Verdict Justification）
> 日期：2026-04-28
> 對象：
>   - `.omc/plans/R6-2-bucket2-russian-roulette.md` v2（Planner Round 2、1455 行）
>   - `.omc/plans/R6-2-bucket2-russian-roulette-architect-r2.md`（Architect Round 2、673 行、APPROVE_WITH_CAVEATS）
> 上層脈絡：
>   - HANDOVER：`.omc/HANDOVER-R6-2.md` 候選路徑 B
>   - 自身前輪：`.omc/plans/R6-2-bucket2-russian-roulette-critic-r1.md`（602 行、ITERATE、2 MAJOR + 5 MINOR + 7 Gap + 3 歧義）
>   - Architect r1：`.omc/plans/R6-2-bucket2-russian-roulette-architect-r1.md`（984 行、CRITICAL_REVISION_REQUIRED、5 致命 + 5 應修）
>   - 體例對齊：`.omc/plans/R6-2-bucket4-F2-critic-r2.md`、leaf packing v3 critic-r2
>   - SOP：`docs/SOP/R6：渲染優化.md`

---

## §1. Summary verdict

**APPROVE**（白話：v2 已閉鎖 r1 全部結構性問題、Architect r2 發現的 4 條 caveat 都是 false-fail conservative 級非阻擋；ralplan 共識可在此輪定稿、不必再開 v3、Step 0 探針可動工）

可以升 APPROVE 而非 APPROVE_WITH_CAVEATS 的核心理由（必須單條足以撐起 APPROVE）：

```
J1（升 APPROVE 的最強支撐）：r1 ITERATE 清單全閉鎖
        Architect r1 之 5 致命 + 5 應修 + 7 推薦：5/5 + 5/5 + 7/7 全閉鎖
        Critic r1 之 2 MAJOR + 5 MINOR + 7 Gap + 3 歧義：2/2 + 5/5 + 4/4 ＋ 3/3
        全閉鎖（Gap 3/6/7 延遲合理）
        v2 fix coverage table（plan 置頂）逐條對照 v1→v2 解決位置可獨立追蹤
        無 r1 殘骸、無新致命

J2（Architect r2 caveats 性質判斷）：4 條 caveat 全部「false-fail conservative」
        C1 / C2：統計閘設計過敏感、誤判方向 = 把可 commit build 推回滾（保守
                 方向）、不會「假過閘」（假過閘 = 危險方向）；對 path tracer 正
                 確性無傷害、僅讓 Step 0 ROI 略低
        C3：80% 閾值 anchor 缺失、誤判方向 = 條件式收益表分流邊緣 ±5% 不確定、
            屬「灰色帶」處理範疇、不影響 RR ON 是否打破 path tracer 正確性
        C4：「3 build #ifdef」術語不準確、實際是「2 binary × 3 config」、影響
            僅是 executor 量測時是否多跑 1 次重複 build；不影響 plan 結構或 hard gate
        → 全部 caveat 屬 v3 文件化或 executor 階段就地閉鎖即可、不阻擋 ralplan
          達成共識

J3（自身 r1 §9.3 期望對齊）：r1 §9.3 Skeptic 結論已預期「v3 必須是 definitive、
        不再 r3 / r4 重複迴圈、Architect r2 + Critic r2 必為 APPROVE w/caveats、
        否則 ROI 倒掛」；本 r2 嚴審 Architect r2 後判其 caveat 性質均屬非阻擋級、
        升 APPROVE 對齊 r1 §9.3 預期、ralplan ROI 守住

J4（ralplan budget 紀律）：仍剩 v3/v4/v5 三輪預算、但「保留預算」不是「應動用」
        理由；v2 已達執行可行水準、開 v3 屬 over-engineering（Architect r2 §8.2
        路徑 C「不推薦」與本 r2 結論一致）；caveats C1~C4 在 executor 階段就地
        閉鎖工時 ~ 1~3 hr、與 v3 共識輪 ~ 4~6 hr 相比、就地閉鎖 ROI 更高
```

不升 APPROVE_WITH_CAVEATS（與 Architect r2）而升 APPROVE 的差別：

```
Architect r2 verdict = APPROVE_WITH_CAVEATS、Critic r2 verdict = APPROVE
差異點：Architect r2 將 caveats 升為「進 Critic r2 升 APPROVE 前須對齊」之軟阻擋
        條件；本 r2 認定 caveats 為「執行階段 / v3 文件化階段就地閉鎖」之 follow-up、
        不應升為 ralplan 共識輪的阻擋條件
        理由：caveats 4 條全屬 false-fail conservative、不影響 path tracer 正確性、
              不影響 RR commit 門檻方向；Architect r2 §8.2 自身亦把「路徑 B 直接進
              Critic r2、由 Critic r2 決定」列為次選、實際上路徑 B 等價於本 r2 升 APPROVE
              + caveats 入 v3 follow-up 追蹤
              本 r2 採路徑 B 加強版：直接升 APPROVE、caveats 入 §7 v3 follow-up 追蹤、
              不需另開 v3 共識輪
```

對齊 r1 預期 Verdict（§9.3 Skeptic：「Architect r2 + Critic r2 必為 APPROVE w/caveats」）：本 r2 升 APPROVE，比 r1 §9.3 預期略強（理由見 J2）；不升 APPROVE_WITH_CAVEATS 是因為 Architect r2 caveats 性質均非阻擋。

---

## §2. Independent audit of Planner v2 vs Critic r1 issues

本節獨立審查 v2 是否真實解決 r1 提出的每一條問題、不依賴 Architect r2 之同類審查。逐條對照 v2 §對應位置 + 親驗 v2 文字。

### 2.1 r1 MAJOR Findings

#### MJ-A：continueProb 觸 1.0 上界 detection 機制缺失

```
r1 要求：
  a. v2 §F-fast-skip F-3 退場報告 root cause 假說擴充為 7 條（含「踩坑 7：
     continueProb 觸 1.0 上界比例 > 80%」）
  b. v2 §D Step 0 第 0 步必加 mask max-channel 分佈直方圖量測 + 觸上界比例單一統計值
  c. v2 §F-fast-skip 退場分流必加：> 80% 推 Option 3、∈ [50%, 80%] 推 Option 1 +
     minBounces sweep、< 50% 整段結案

v2 §對應位置（plan v2 fix coverage table line 47）：
  §C.6（mask 分佈 instrumentation 新增）+ §D.4（量測表 D.3.4）+ §F-fast-skip 7 條
  root cause + §G 踩坑 7（合併）

獨立審查（親驗 v2）：
  a. §F Step F-fast-skip-spp line 1080-1088 列 7 條 root cause 假說、第 7 條為
     「ANGLE Metal select() codegen 自身拖慢」、明確覆蓋 r1 要求
     ⚠ 但細看：r1 MJ-A 要求的「踩坑 7：continueProb 觸上界」與 v2 「踩坑 7：ANGLE
        codegen 拖慢」是兩個不同的 root cause；v2 把 mask 觸上界拆到獨立分支
        Step F-fast-skip-mask-overflow（line 1070-1076）、在 Step 0-5 獨立分流、
        實質結構比 r1 要求的更嚴謹（因為 mask 觸上界 80% 應在 Step 0 階段直接
        fast-skip、而非到 spp/sec 量測完才退場）
     ✓ 結構合格：mask-overflow 獨立分支 + spp 分支 7 條 root cause = 8 條總分流路徑、
       涵蓋面比 r1 要求更廣

  b. §D.3.4 mask 分佈量測表（line 880-890）+ §C.6 mask 分佈 instrumentation 設計
     （line 785-798）+ §A 程式碼骨架 line 558-570 instrumentation 程式碼骨架
     ✓ 量測協定明確、JS 端讀回統計、依 §A.4 條件式收益表分流

  c. §A.4 條件式收益表（line 423-428）三檔分流（< 50% / [50%, 80%] / > 80%）+
     §F Step 0-5 line 1029-1036 同步三檔分流
     ✓ 三檔分流完整、推 v3 Option 3 路徑明確（mask-overflow 退場分支 line 1070-1076
       推 Option 3 真備案）

判決：MJ-A **完全閉鎖**（且結構優於 r1 要求；mask-overflow 獨立分支比 r1 建議的
       「7 條 root cause 之一」更嚴謹）
```

#### MJ-B：A.3 Option 2 / Option 3 invalidation rationale strawman

```
r1 要求：
  a. v2 §A.3 Option 2 排除理由刪「砍率過高 → 偏色」未實證主張、改為「Option 2 與
     Option 1 失敗風險高度相關」
  b. v2 §A.3 Option 3 排除理由保留 13 處 if 拖慢 + diffuse bounce ray 互動兩條、
     刪「+1%~+5% 灰色帶」strawman、改為「啟動條件 = mask 觸上界 > 80%」
  c. v2 §A.3 統整段對齊 Architect §4 Synthesis Stage A：明確列「3 build sweep 是
     公平 alternatives 探索的最小單位」

v2 §對應位置（fix coverage table line 48）：
  §A.3 重寫 invalidation rationale

獨立審查（親驗 v2）：
  a. §A.3 Option 2 line 337-348 重寫：
     新版「實際情況：在 NEE bake 後 mask 量綱被 uLegacyGain × uIndirectMultiplier
           推高情境下、Option 2 luminance 與 Option 1 max-channel 同樣會觸 1.0 上界」
     新版「Option 2 排除主因不是 perceptual 偏色、是與 Option 1 失敗風險高度相關
           （同因同果）」
     ✓ strawman 已刪、改為與 r1 建議一致的「同因同果」rationale
     v2 補強：明確 sweep 結果分流（A1 過閘 + A3 fail-fast → A1 為勝者；A1 fail-fast
              + A3 過閘 → 公式形態是關鍵變數、進 v3 用 luminance）

  b. §A.3 Option 3 line 392-402 重寫：
     新版「Option 3 啟動條件 = Step 0 三 build 探針之 mask 分佈量測顯示 continueProb
           觸 1.0 上界比例 > 80%」
     新版「若 ∈ [50%, 80%]：站點仍可用、但 minBounces sweep 是關鍵變數」
     新版「若 < 50%：站點 / 公式都對、根因是場景對 RR 不友善」
     ✓ strawman 灰色帶 +1%~+5% 觸發條件已刪、改為 mask 上界比例 > 80% 觸發
     ✓ 13 處 if 拖慢理由保留（line 384-386）+ diffuse bounce 互動理由保留（line 387-390）

  c. §A.3 統整段 line 404-409：
     新版「v2 Step 0 三 build 探針同期試 Option 1 (A1) + Option 1' (A2 minBounces
           sweep) + Option 2 (A3 公式族 sweep)；Option 3 是真備案、觸發條件 = mask
           分佈量測 > 80% 觸上界」
     ✓ 對齊 Architect Synthesis Stage A 三 build sweep + Option 3 觸發條件

判決：MJ-B **完全閉鎖**（rationale 改寫忠實對齊 r1 建議；統整段升級為 sweep 結果
       分流而非 strawman 排除）
```

### 2.2 r1 MINOR Findings

#### MN-A：§H 測試矩陣三表格相同 → 重驗目的模糊

```
r1 要求：v2 §H.1 加註腳分拆 Step 0 探針期 / Step 1 煙霧測試 / Step 2 vsync jitter 重跑

v2 §對應位置：§H.1（line 1259-1292）

獨立審查（親驗 v2）：
  - Step 0 RR ON 探針表（line 1262-1267）+ 重點段 line 1269-1273（spp/sec 過閘 +
    maxCh ≥1 比例 + KS p-value + 3σ mean diff 三類）
  - Step 1 commit 後煙霧測試表（line 1275-1281）+ 重點段「僅做煙霧測試（spp/sec
    抽 1 config 跑一次）」
  - Step 2 vsync jitter 容忍重跑表（line 1283-1292）+ 重點段「vsync jitter 容忍
    重跑、應落在 Step 0 ±5% 內 + 全 4 config 重做統計閘」

判決：MN-A **完全閉鎖**（三表分拆 + 各表重點目的明確）
```

#### MN-B：§G 踩坑 5 uMaxBounces 互動驗證量化不足

```
r1 要求：v2 改為「magick compare + luminance histogram peak 遞增」量化驗證

v2 §對應位置：§G 踩坑 5（line 1196-1210）

獨立審查（親驗 v2）：
  - line 1206 「拉 uMaxBounces 1 / 7 / 14 三檔（v2 不暴露 GUI、用 JS 直改 uniform value）」
  - line 1207 「各跑 256-spp 截圖、magick compare（uMaxBounces=1 整體最暗、=14 整體
                最亮、=7 介中）」
  - line 1208 「luminance histogram peak 應呈遞增（histogram peak luminance @1 < @7 < @14）」
  - line 1209 「對齊 §H.2 magick AE 量測協定」

判決：MN-B **完全閉鎖**（量化驗證 + magick 體例對齊）
```

#### MN-C：§F SOP 加段位置 / wording 模糊

```
r1 要求：v2 §F Step 3-4 改為「在 docs/SOP/R6：渲染優化.md §86 結構優化分流之後新增段
        『§87 桶 2 #2 Russian Roulette 結案』、wording 對齊 §86 a/d 結案段體例（含
        Verdict / 收益 / rollback path / follow-up 4 段）」

v2 §對應位置：§F Step 3 line 1129-1135

獨立審查（親驗 v2）：
  - line 1129 「在 §86 結構優化分流之後新增段『§87 桶 2 #2 Russian Roulette 結案』」
  - line 1130-1135 §87.1 Verdict / §87.2 收益 / §87.3 rollback path / §87.4 follow-up
    四段體例明列

判決：MN-C **完全閉鎖**（位置 + wording 明確、對齊 §86 體例）
```

#### MN-D：補 §A.4 條件式收益段

```
r1 要求：v2 補 §A.4 期望收益段（對齊 leaf-packing v3 體例）三檔條件式收益表

v2 §對應位置：§A.4 期望收益（line 412-437）

獨立審查（親驗 v2）：
  - line 414-421 ROADMAP「≤ 10%」估值含義拆解 4 條
  - line 423-428 條件式收益表（< 50% / [50%, 80%] / > 80% 三檔對應 +5~10% / +1~5% / ≤ +1%）
  - line 430-436 ANGLE Metal select() codegen 拖慢校正三檔分流（≥ 3% / [1%, 3%) / < 1%）

判決：MN-D **完全閉鎖**（且補強 ANGLE codegen 校正、超出 r1 要求）
```

#### MN-E：§B.4 Variance 公式 + LaTeX 量綱缺失

```
r1 要求：v2 §B.4 補完整統計性質段（Mean + Variance 並列）+ 引用 Veach §10.4.2

v2 §對應位置：§B.4 Energy compensation（line 643-662）

獨立審查（親驗 v2）：
  - line 644-647 Mean unbiased 公式（保留 v1 對的部分）
  - line 648-651 Variance increase 公式 `Var = mask^2 × (1/p - 1)` + p < 1 / p = 1
                 兩境況分析
  - line 652-657 1024-spp 收斂性質（sample mean 標準差量級估計）
  - line 658-660 v1 推論「→ 1024-spp pixel diff = 0 可達」錯之刪除說明
  - line 662 引用 Veach §10.4.1 + §10.4.2

判決：MN-E **完全閉鎖**（Mean + Variance + Sample mean 三段並列、引用完整）
```

### 2.3 r1 SR1~SR5（Architect r1 應修對應）

| Critic r1 SR ID | 對應 Architect r1 修訂 | v2 解決位置 | 獨立判讀 | 結論 |
|-----------------|------------------------|-------------|----------|------|
| **SR1** | M-2 同位置處理 | §A.4 + §B.1 | 與 MN-D 同位置、條件式收益 + ROADMAP 拆解 | **CLOSED** |
| **SR2** | M-4 同位置處理 | §G 踩坑 4（line 1171-1194）| 兩層 mitigation + 4 條禁止 + R3-7 體例對齊「0.05 下限是工程平衡、不是物理參數」 | **CLOSED** |
| **SR3** | M-5 同位置處理 | §G 踩坑 7（line 1225-1238）+ §F Step 0-1 | F2 step0-noop 1.24% 實證 anchor + Step 0 第 0 步 RR uniform OFF baseline 量測 + 三檔分流 | **CLOSED** |
| **SR4** | Option 2/3 從「v2 備案」改「v2 sweep 候選」 | §A.3 | 與 MJ-B 同位置、A1/A2/A3 同期試、Option 3 維持備案（觸發條件 = > 80% 觸上界） | **CLOSED** |
| **SR5** | root cause 假說 6 → 7 條 + 必同時列 mask 分佈量測支持哪條 | §F-fast-skip F-3（line 1078-1088）| 7 條 root cause 假說（line 1081-1087）+ line 1088「root cause 必同時列『mask 分佈量測結果支持哪條』」 | **CLOSED** |

整體閉鎖度：5/5 CLOSED。

### 2.4 r1 Gaps 1/2/4/5（Gap 3/6/7 延遲）

| Gap ID | r1 要求 | v2 解決位置 | 獨立判讀 | 結論 |
|--------|---------|-------------|----------|------|
| **Gap 1** | continueProb 觸上界比例 Step 0 量測閾值 | §C.6 + §D Step 0-5 + §A.4 條件式收益表 | 80% 閾值定義 + mask 分佈 instrumentation + Step 0-5 獨立分流 | **CLOSED**（但 80% anchor 缺失、見 §3 C3 caveat） |
| **Gap 2** | Step 0 探針失敗 N 次後放棄策略 | §H.4（line 1313-1319）| line 1318-1319「重啟 Step 0 量測 N=3 取中位數、3 次內仍漂移 > 5% → 視為量測誤差不可接受、回滾」 | **CLOSED** |
| **Gap 4** | cache busting query 「保留至下個桶 R 主線結案後清理」 | §F-fast-skip F-2（line 1057）| line 1057「cache busting query 留作實證痕跡（保留至下個桶 R 主線結案後清理、Critic Gap 4）」 | **CLOSED** |
| **Gap 5** | #ifdef 三 build cache busting 命名規則 | §F Step 0 + §A 改動範圍（line 578-585）| `?v=r6-2-rr-step0-{A1\|A2\|A3\|off}` 四檔命名 | **CLOSED** |

整體閉鎖度：4/4 CLOSED。

### 2.5 r1 歧義 1/2/3

| 歧義 ID | r1 要求 | v2 解決位置 | 獨立判讀 | 結論 |
|---------|---------|-------------|----------|------|
| **歧義 1** | bounce 編號約定（業務語義 vs shader iteration count） | §B.3（line 630-639）+ §A.2 D3（line 257-264）| line 631-639 統一寫 shader iteration count、line 638-639 footnote「v1『bounce 1 = 第 1 次 NEE 直接光』業務語義近似為『primary 命中後的 secondary ray』」 | **CLOSED** |
| **歧義 2** | P4 hard gate「在 vsync jitter / RNG sequence 容忍區內 ≤ 1e-4 mean diff」 | §A.1 P4'（line 129-146）| MR1 統計閘改寫直接消除歧義（KS test + 3-sigma mean diff、無 1e-4 表述） | **CLOSED** |
| **歧義 3** | 「Step 0 探針 ≤ 8 行 GLSL」之計數規則 | §A 改動範圍（line 532）+ §A.3 Option 1（line 293）| line 532「shader 改動 ≤ 22 行（含 2 行 uniform + 8 行 RR check + 8 行 mask 分佈 + 4 行註解 / 空行）」+ line 293「§A.3 Option 1 ≤ 6 行 GLSL（不含註解）」 | **CLOSED** |

整體閉鎖度：3/3 CLOSED（但見 §3 C4：「3 build #ifdef」術語不準確同類殘漏）。

### 2.6 r1 §13 體例對齊（open-questions.md 同步紀律）

```
r1 要求：v2 應加 §F Step 3-4 條目同步 Q12「continueProb 觸上界 detection」+ Q13
        「ANGLE codegen 拖慢」之提交紀律

v2 §對應位置：§F-fast-skip F-6（line 1065-1068、1076、1090、1101）+ Step 3-5
                （line 1136-1138）

獨立審查（親驗 v2）：
  - Step F-fast-skip-codegen F-6（line 1065-1068）：Q-RR-1（#ifdef N+1 build 編譯時切）
  - Step F-fast-skip-mask-overflow F-6（line 1076）：Q-RR-2（v3 Option 3 ralplan 啟動）
  - Step F-fast-skip-spp F-6（line 1090）：Q-RR-3（場景對 RR 友善度差是否 scene-specific）
  - Step F-fail-correctness F-6（line 1101）：Q-RR-4（mask 量綱拆分為 BSDF / NEE-baked 雙 track）
  - Step 3-5（line 1136-1138）：清理 Q-RR-1~Q-RR-4（若已解決）+ 列 commit hash + 結案日期

判決：**CLOSED**（4 個分支各自 sync、每個對應一個 Q-RR-N、結案 step 統一清理）
```

### 2.7 r1 整體閉鎖度

```
MJ-A / MJ-B：2/2 CLOSED
MN-A ~ MN-E：5/5 CLOSED
SR1 ~ SR5：5/5 CLOSED
Gap 1/2/4/5：4/4 CLOSED
歧義 1/2/3：3/3 CLOSED
open-questions 同步紀律：CLOSED

延遲 Gap 3 / 6 / 7：3/3（理由見 §4）

整體：18/18 CLOSED + 3/3 deferred = 21/21 結構性處理度 100%
```

無 r1 殘骸、無 r1 級新致命；v2 fix coverage table 之逐條對照可獨立追蹤。

---

## §3. Adjudication of Architect r2's caveats

獨立審查 Architect r2 §1 列的 4 條 caveat（C1~C4）+ §7 列的 2 條 minor（M1~M2）；不依賴 Architect r2 自己的判斷、以本 Critic 視角重新評估嚴重度與性質。

### 3.1 C1：KS test sample-size 失真（false-fail conservative）

```
Architect r2 主張：
  - 1024 × resolution（典型 1M pixel）級 sample size、p < 0.001 易達
  - RR ON / OFF 即使 mean diff 量級 1e-3 仍可能 KS p < 0.05、被判破壞正確性
  - 屬「過度敏感」非「不可達」、誤判方向 = 把可 commit build 推 fail-correctness（保守方向）

本 Critic 獨立審查：
  Architect r2 之數學推導合理（D_0.05 ≈ 1.36 × √(2/N) 在 N = 1e6 為 1.92e-3、與
  RR variance 增量觀測量級匹配、KS test 確實會 false-fail）。

  但本 Critic 多看一層：
    a. Architect r2 §5.1 line 242 已建議「v2 §D.4 line 919 之 AND 改 OR 是最低工程量
       修法」、即「mean diff (3-sigma) AND/OR KS test」之邏輯運算改寫
    b. v2 §D.4 line 918-921 過閘判定實際是「mean diff ≤ threshold（per-pixel 全過 OR
       pixel violation rate ≤ 1%）AND KS test p > 0.05、兩條件均過 → 過閘」
       → AND 結構、KS test 失真確實會 false-fail
    c. 但「false-fail」對 path tracer 正確性無傷害（保守方向）：
       - 真實情況：RR ON 是 unbiased path tracer、mean unbiased、僅 variance 增；
         若 KS test 因 sample-size 過敏而拒絕、實際 RR 結果仍是正確的
       - 退場路徑：F-fail-correctness（line 1093-1102）、git revert + 寫退場報告
       - 實際損失：~ 4~5 hr Step 0 工程白做、ralplan ROI 略低、無正確性風險
    d. mitigation 路徑明確：Architect r2 §5.1 line 238-243 建議三條修法（KS 降為
       diagnostic / 改 OR / sub-sample N=1000）、任一可解、屬 executor 階段 ~ 30 分
       鐘可閉鎖

評估：
  - severity：MEDIUM（不是 CRITICAL、不阻擋 v2 升 APPROVE）
  - 性質：false-fail conservative（fatal 級必為 false-pass / 危險方向）
  - 是否 fatal：NO（不破壞既有正確性、退場路徑明確、修法簡單）
  - 是否阻擋 ralplan 共識：NO（屬 executor 階段就地閉鎖之 follow-up）

本 Critic 判決：**ACCEPT**（同意 Architect r2 之 caveat 級判定、不升 fatal、不阻擋
                          ralplan APPROVE）
v3 follow-up 建議：見 §7 C1
```

### 3.2 C2：σ_path 估計器統計穩健性（false-fail conservative）

```
Architect r2 主張：
  - N=4 sample std 相對標準誤差 ~30%（χ² 分佈推導）
  - 取場景 median 為 σ_path 對 NEE 區 / 暗區 σ 差異 1~2 量級
  - 3-sigma threshold 不同區域有效嚴格度不一致

本 Critic 獨立審查：
  Architect r2 之統計推導合理（√(1/(2(N-1))) = √(1/6) ≈ 0.41、N=4 確實 ~ 30% 相對
  誤差；NEE 區 σ 與暗區 σ 差 1~2 量級也對齊 path tracing 場景之 BSDF importance
  sampling 變異特性）。

  本 Critic 多看一層：
    a. v2 §D.4 line 905-911 設計「對 4 次取樣的 per-pixel std → 取場景 median 為
       σ_path[c]」確實是場景級單值估計、不是 per-pixel 估計
    b. mean diff (3-sigma) 之 per-pixel 計算（line 914）使用「mean diff ≤ threshold[c]
       （per-pixel 全過 OR pixel violation rate ≤ 1%）」
       → 「per-pixel violation rate ≤ 1%」之 1% 容忍實質吸收了 NEE 區 σ 過嚴的問題
       （因為 NEE 區占場景比例 ≤ 5%、所以 NEE 區 violation 5% × 區域內 violation 比例
        會被 1% 容忍吸收、除非 NEE 區 violation ≥ 20% 才會打破 1% 上限）
    c. Architect r2 §5.2 建議改 per-pixel σ_path[c, x, y]（line 268）但 v2 設計已有
       「pixel violation rate ≤ 1%」之 robust mechanism、實質保護面已有
    d. 影響：與 C1 同屬「過度嚴格」方向、可能 false-fail；不會 false-pass

評估：
  - severity：MEDIUM
  - 性質：false-fail conservative
  - 是否 fatal：NO
  - 是否阻擋 ralplan 共識：NO（v2 設計已有 robust mechanism 部分吸收、executor 階段
                                就地調整 ~ 30 分鐘可閉鎖）

本 Critic 判決：**ACCEPT with extension**
  ACCEPT：caveat 級判定合理、不阻擋 APPROVE
  EXTEND：本 Critic 補一條 Architect r2 沒明說的 mitigation：v2 §D.4 line 918 之
          「pixel violation rate ≤ 1%」實質已部分吸收 σ_path 場景 median 偏差問題、
          不必 N 升到 8（Architect r2 §5.2 line 270 建議）；executor 階段若 false-fail
          發生、優先檢查 violation 是否集中在 NEE 區再決定是否需 N=8
v3 follow-up 建議：見 §7 C2
```

### 3.3 C3：continueProb 觸上界 80% 閾值 anchor 缺失

```
Architect r2 主張：
  - 80% / 50% 切點無形式化推導
  - Step 0 結束結論若觸上界 78% → 進 Option 1 sweep；若 82% → 推 Option 3 → 結論
    可能因 ±2% 量測誤差而異
  - 屬 caveat 級（不影響功能正確性、僅邊界判讀不確定）

本 Critic 獨立審查（必須對自己 r1 MJ-A 之 80% 數字誠實）：
  r1 MJ-A 之 80% 閾值原始來源：本 Critic 自己提的；當時依據是「max-channel
  throughput 在 NEE bake 後機率高、80% 是『實質沒做 RR』之合理 cutoff」之經驗判斷。

  Architect r2 §5.3 line 286-295 提出之 anchor 補述路徑（80% 等價於「至少 80% 路徑
  mask /= p 退化為 mask /= 1、實質 RR ON / OFF mean 差異 ≤ 20%」）合理；50% anchor
  「超過半數路徑 RR check 真的砍 ray」也合理。

  本 Critic 對自己 80% 的誠實判斷：
    a. 80% 是 r1 寫得有點隨便的數字、anchor 確實當時沒寫
    b. 但 80% / 50% 之「分流」思想本身正確（極端 > 90% 必然「沒做 RR」、< 30% 必然
       「做了 RR」、中段灰色）、僅閾值精確度可改進
    c. 影響範圍：邊界判讀（78% vs 82%）不確定、不影響極端情境（30% / 90%）之分流
       正確性
    d. mitigation 路徑明確：v3 文件化階段 ~ 20 分鐘補 anchor、或將閾值降為「定性
       指引」+ 量測誤差 ±10% 灰色帶處理（Architect r2 §5.3 line 297 建議）

  本 Critic 對 Architect r2 caveat 級判定的審查：
    severity 認同（MEDIUM）、性質認同（邊界判讀不確定、非 fatal）

評估：
  - severity：MEDIUM
  - 性質：documentation gap（anchor 缺失）
  - 是否 fatal：NO
  - 是否阻擋 ralplan 共識：NO（v3 文件化或 executor 階段 ~ 20 分鐘可閉鎖）

本 Critic 判決：**ACCEPT**（同意 Architect r2 caveat 級判定；對自己 r1 MJ-A 之 80%
                          數字承擔 anchor 缺失責任）
v3 follow-up 建議：見 §7 C3
```

### 3.4 C4：「3 build #ifdef sweep」術語不準確

```
Architect r2 主張：
  - 實際是「2 binary（A1/A2 共 binary、A3 獨立）× 3 config sweep」
  - v2 §A.3 / §D.1 等多處宣稱「三 build #ifdef sweep」術語不精確
  - ANGLE codegen 拖慢踩坑點 7 預期樣貌可能不如 plan 描述（A1/A2 同 binary 拖慢相同）

本 Critic 獨立審查（親驗 v2 §A 程式碼骨架 line 547-555）：
  v2 §A 改動範圍 line 549-552：
    #if defined(RR_BUILD_A3_LUMINANCE)
        float continueProb_raw = dot(mask, vec3(0.2126, 0.7152, 0.0722));
    #else
        float continueProb_raw = max(max(mask.r, mask.g), mask.b);
    #endif

  → 確實只有 1 個 #ifdef、A3 為獨立 binary；A1/A2 共 binary、minBounces 透過
    uRRMinBounces uniform value 切換（v2 §A.1 D3 line 274-285 設計）
  → Architect r2 之觀察正確、術語不精確

  本 Critic 補強：
    a. r1 歧義 3「≤ 8 行 vs 16 行 GLSL」同類「術語精確度」殘漏在 v2 仍微殘
    b. Architect r2 §5.4 之修法建議（line 326-331）合理（拆「max-channel binary ×
       {min=3, min=5}」+「luminance binary × min=3」），執行階段量測表合併即可
    c. 影響：executor 量測時可能多跑 1 次重複 build（A1/A2 各跑 codegen 拖慢量測）、
       浪費 ~ 10~30 分鐘、不影響統計閘正確性

評估：
  - severity：LOW（minor）
  - 性質：documentation 術語精確度
  - 是否 fatal：NO
  - 是否阻擋 ralplan 共識：NO（v3 文件化或 executor 階段 ~ 15 分鐘可閉鎖）

本 Critic 判決：**ACCEPT**（同意 Architect r2 caveat 級判定；屬可在 executor 階段
                          就地修正之 minor 殘漏）
v3 follow-up 建議：見 §7 C4
```

### 3.5 M1：fast-skip 4-branch exit 灰色帶 documentation

```
Architect r2 主張：
  - §F Step 0-6 加 sub-branch：「若 mask 觸上界 ∈ [50%, 80%] AND 全 build spp < +5%
    → 走 F-fast-skip-spp 但 root cause 標『灰色帶』、推 v3 Option 3」
  - 或 §F-fast-skip-spp 加第 8 條 root cause 假說「灰色帶 + RR 砍率邊際」

本 Critic 獨立審查（親驗 v2 §F Step F-fast-skip-spp）：
  v2 §F Step F-fast-skip-spp line 1080-1088 列 7 條 root cause、line 1088「root
  cause 必同時列『mask 分佈量測結果支持哪條』」。

  問題確實存在：
    a. 灰色帶 [50%, 80%] + spp 全不過閘的情境、現行 7 條 root cause 沒明列、需依賴
       executor 從「mask 分佈量測結果支持哪條」line 1088 之 reflective 紀律自行
       推導
    b. v2 §A.4 line 426-427「灰色帶；若 [+1%, +5%) 全部 → 整段結案，記為 v3 Option 3
       候選」與 §F Step F-fast-skip-spp 路徑分流略不齊
    c. 風險：executor 在灰色帶情境寫退場報告時、root cause 假說可能寫「公式族 +
       站點 + minBounces sweep 全不可行」而非「灰色帶 + RR 砍率邊際 + 推 v3 Option 3」

  本 Critic 補強：
    Architect r2 之修法（加第 8 條 root cause）合理；本 Critic 認為不阻擋 APPROVE、
    屬 executor 階段就地對齊之 minor underdocumentation；但建議 executor 動工前
    在 §F Step F-fast-skip-spp 加 8 號 root cause 假說（~ 10 分鐘文件編輯）。

評估：
  - severity：LOW
  - 性質：documentation underdocumentation
  - 是否阻擋 ralplan 共識：NO

本 Critic 判決：**ACCEPT**（同意 Architect r2 minor 級判定）
v3 follow-up 建議：見 §7 M1
```

### 3.6 M2：Step 0 instrumentation readback 機制延遲到實作階段

```
Architect r2 主張：
  - v2 §A 程式碼骨架 line 567「(具體 imageStore / texelFetch 細節由 Step 0 實作時補完)」
  - readback 機制（imageStore SSBO / framebuffer texture 解碼 / readPixels）延遲
  - 屬 plan-to-executor handoff ambiguity

本 Critic 獨立審查：
  v2 §A line 567「(具體 imageStore / texelFetch 細節由 Step 0 實作時補完)」確實是
  延遲、不是 ambiguity：
    a. Three.js + erichlof framework 之標準 readback 路徑（WebGLRenderTarget +
       renderer.readRenderTargetPixels）對 executor 屬「應知」、不必 plan 範本
    b. v2 §C.6 line 793「imageStore / 累乘到 accumCol 的低位 sink、JS 端讀回統計」
       已給出兩條候選實作路徑（imageStore SSBO / accumCol low-bits sink）
    c. v2 §A line 568-569 之 DCE-proof sink pattern（accumCol += maxCh × 1e-30）
       已是「累乘 + 寫低位 sink」實作骨架、readback 路徑明確（讀 RGBA8 framebuffer
       + JS 端 reduce）
    d. 風險：executor 在 Step 0 第 0-5 步前可能花 30 分鐘~ 2 hr 設計 readback、
       屬 handoff 工時、不影響 plan 結構正確性

  本 Critic 補強：
    Architect r2 之 minor 級判定合理；本 Critic 不認為 plan 必須給 readback 範本
    （Three.js 標準做法、executor 應知）。屬 v3 文件化或 executor 階段 ~ 30 分鐘
    補完。

評估：
  - severity：LOW
  - 性質：plan-to-executor handoff ambiguity
  - 是否阻擋 ralplan 共識：NO

本 Critic 判決：**ACCEPT**（同意 Architect r2 minor 級判定）
v3 follow-up 建議：見 §7 M2
```

### 3.7 Architect r2 caveat 整體判決

```
C1（KS test sample-size 失真）：ACCEPT、false-fail conservative
C2（σ_path 估計器穩健性）：ACCEPT with extension（v2 已有 violation rate ≤ 1% 部分吸收）
C3（80% 閾值 anchor 缺失）：ACCEPT（80% 是本 Critic r1 自己的數字、誠實承認 anchor 缺失）
C4（「3 build #ifdef」術語不準確）：ACCEPT（minor）
M1（fast-skip 4-branch exit 灰色帶 documentation）：ACCEPT（minor）
M2（Step 0 instrumentation readback handoff）：ACCEPT（minor）

整體：6/6 ACCEPT（含 1 EXTEND）；無一條升 fatal、無一條阻擋 ralplan 共識
       全部屬 v3 文件化或 executor 階段就地閉鎖之 follow-up（總工時 ~ 1.5~3 hr）
```

對齊 §1 J2 結論：4 條 caveat + 2 minor 全屬 false-fail conservative 或 documentation 級非阻擋；ralplan 共識可在此輪定稿。

---

## §4. Deferred-item review（Gap 3 / Gap 6 / Gap 7 / NTH2 / NTH3）

獨立審查 v2 對延遲 5 項之 justification、不依賴 Architect r2 §4 之 deferral approval。

### 4.1 Gap 3：Brave 桌面 ontouchstart 誤判

```
v2 延遲理由：「v2 不暴露 RR GUI、Step 1~3 階段全用 hardcoded uniform 跑、即繞過
              此互動風險、無需修」

Critic r2 獨立審查：
  - v2 §B.2 line 500-502 確實明確「Step 1~3 階段全用 hardcoded uniform 跑」
  - pathTracingUniforms 註冊 3 條 uniform（v2 §A line 573-576）僅是 Three.js shader
    uniform binding、不會自動建立 GUI 滑桿（GUI 是 setupGUI() 顯式 add）
  - JS 端切 uniform value 是 `pathTracingUniforms.uXxx.value = N`、與 mouseControl 無關
  - r1 §7「影響極小、列為 gap 但不必修」自評本就是建議級
  - 對齊 user feedback「Brave 桌面 ontouchstart 誤判」之 mouseControl 守門問題、
    繞過路徑成立、無互動風險

  本 Critic r2 對齊 Architect r2 §4.1 DEFERRAL APPROVED 判決。

判決：**CONCUR**（延遲合理、airtight）
```

### 4.2 Gap 6：visual-verdict skill 啟用

```
v2 延遲理由：「MR1 統計閘 + 3-sigma mean diff + KS test 已是定量機制、再疊
              visual-verdict 屬冗餘；若 Stage B commit 後肉眼檢仍有疑義可在 Step 3
              結案 report 階段補做、不阻擋 Step 0 / Step 1 / Step 2」

Critic r2 獨立審查：
  - statistical gate（KS test + 3-sigma + mean diff + violation rate）確實比
    visual-verdict skill 之 Structured Visual QA 更嚴格（量化）
  - visual-verdict 是 nice-to-have、屬「結案報告質量提升」、不屬阻擋級
  - r1 §7「nice-to-have、本計畫範圍內可選不強制」自評本就是建議級
  - 對齊 v2 §E.3 firefly / banding 視覺檢查（line 959-974）+ §H 測試矩陣 magick
    AE 體例已部分覆蓋

  本 Critic r2 對齊 Architect r2 §4.2 DEFERRAL APPROVED 判決。

判決：**CONCUR**
```

### 4.3 Gap 7：mask /= p 代數驗證

```
v2 延遲理由：「公式正確（Veach §10.4.1）、屬數學嚴謹性 gap、非阻擋；v2 §B.4 加引用
              Veach §10.4.1 + §10.4.2 但不展開完整代數推導、節省篇幅、Architect r1
              已認可 plan 數學基礎」

Critic r2 獨立審查：
  - v2 §B.4 line 644-662 補 Mean / Variance / Sample mean 三公式 + 引用 Veach
    §10.4.1 + §10.4.2，已達數學嚴謹性合理門檻
  - 完整 ∫f cos(θ)/p alignment 推導屬教科書級複述、對 plan 結構性無增益
  - r1 §7「公式正確、屬數學嚴謹性 gap、非阻擋、不列必修」自評本就是建議級
  - 對齊 user feedback「PT 黑白畫面 debug 先掃 accumCol 寫入點」精神：v2 §F-fast-skip
    7 條 root cause + Step 0-5 mask 分佈量測 已涵蓋「先檢查最基本數學前提」

  本 Critic r2 對齊 Architect r2 §4.3 DEFERRAL APPROVED 判決。

判決：**CONCUR**
```

### 4.4 NTH2：commit message 範本

```
v2 延遲理由：「§E.4 commit message 範本已含 KS test p-value + 3-sigma mean diff +
              maxCh ≥1 比例三欄位、覆蓋此項」

Critic r2 獨立審查（親驗 v2 §E.4 line 977-989）：
  - line 984「統計閘：KS test p-value = X、3-sigma mean diff ≤ Y per-pixel
    （C1/C2/C3/C4）」
  - line 985「mask 分佈：continueProb 觸 1.0 上界比例 = Z%（< 50% / [50%, 80%] / > 80%）」
  - 三欄位完整覆蓋、超出 NTH2 原建議（NTH2 僅要求 KS p-value + 3-sigma、v2 額外加
    mask 觸上界比例）

  本 Critic r2 對齊 Architect r2 §4.4 DEFERRAL APPROVED 判決。

判決：**CONCUR**（已併入、無需獨立追蹤）
```

### 4.5 NTH3：plan 標題 v1 → v2

```
v2 延遲理由：「v2 plan 已標 v2 + 修訂歷史置頂（fix coverage table）+ §修訂歷史
              v1→v2 詳列」

Critic r2 獨立審查（親驗 v2 plan 開頭）：
  - line 1「Plan v2（ralplan 共識草案）」
  - line 3 「版本：v2」
  - line 33-83 修訂歷史 v1 → v2 fix coverage table 置頂
  - line 1418-1454 §修訂歷史段詳列 v1 / Architect r1 / Critic r1 / v2 四階段
  - 對齊 plan v3 leaf-packing 體例（標題 + 修訂歷史置頂 + 體例對齊段）

  本 Critic r2 對齊 Architect r2 §4.5 DEFERRAL APPROVED 判決。

判決：**CONCUR**（已執行、無需獨立追蹤）
```

### 4.6 延遲整體判決

```
Gap 3：CONCUR（airtight、不暴露 GUI 繞過 Brave 互動）
Gap 6：CONCUR（visual-verdict 冗餘、statistical gate 已涵蓋）
Gap 7：CONCUR（數學嚴謹性 gap、引用 Veach 已達合理門檻）
NTH2：CONCUR（commit message 範本已含三統計欄位）
NTH3：CONCUR（標題 v1→v2 + 修訂歷史置頂已執行）

整體：5/5 CONCUR、無一項需 escalate；對齊 r1 §7 自評之「nice-to-have」級判斷
```

無延遲項目需升 fatal、無 hidden 風險。

---

## §5. New-issue hunt（v2 + Architect r2 雙文件覆蓋之外的 attack surface）

獨立審查 v2 + Architect r2 兩份文件未覆蓋之 attack surface、特別針對 spawning 任務指定的 5 個風險方向：

### 5.1 firefly artefact 是否會被「mask 而非 fix」

```
spawning 任務問：「v2 是否留下任何路徑、firefly artefacts 可能被 masked 而非 fixed？」

Critic r2 獨立審查（親驗 v2 §G 踩坑 4 + §E.3 + §F-fail-correctness）：
  - §G 踩坑 4（line 1171-1194）兩層 mitigation：
    第 1 層 clamp(continueProb_raw, 0.05, 1.0) lower bound 0.05 → 補償 ≤ 20×
    第 2 層 mask 上游量綱排查（uLegacyGain × uIndirectMultiplier × emit baked 疊加）
  - §G 踩坑 4 line 1187-1190 4 條禁止：
    a. 加 emission clamp 蓋 firefly（user feedback 紀律）
    b. 加 5×5 cross-bilateral 蓋 firefly（user feedback 紀律）
    c. 直接調 0.05 下限到更大（band-aid pattern）
  - §E.3 line 971-974 同樣 4 條禁止
  - §F-fail-correctness F-3 line 1098-1099「mask 上游量綱排查 + 對齊 user feedback
    『Path Tracing clamp 是診斷訊號不是 fix』嚴禁加 clamp 蓋過」

  關鍵自審：clamp(continueProb_raw, 0.05, 1.0) 之 0.05 下限是否本身屬「mask 而非
            fix」？
    - 0.05 下限是「continueProb 機率下限」、不是「emission clamp」
    - 數學意義：limit 1/p 補償倍率上限為 20× → 防止 RR variance 在 mask 為大量級
                時產生過大 firefly
    - 對齊 user feedback「Path Tracing clamp 是診斷訊號不是 fix」之原意（emission
      clamp）：0.05 下限與 emission clamp 概念正交
    - v2 §G 踩坑 4 line 1192-1193「0.05 下限是工程平衡、不是物理參數」對齊 R3-7
      方向 A 體例

  自審結論：v2 設計之 0.05 下限不違反 user feedback「clamp 是診斷訊號」紀律、
            mitigation 兩層 + 4 條禁止之結構正確、無「mask 而非 fix」路徑

  v2 留下唯一可能「被 mask」風險：mitigation 第 2 層 line 1185-1186「若疊加正常、
  firefly 是 RR 自身 variance 過大、改 minBounces sweep + 升 0.1 下限為次選緩解
  （仍須 v3 共識）」之「升 0.1 下限」屬 caveat 級、需 v3 共識才可動、不是即時可
  執行之 band-aid

判決：**無「mask 而非 fix」路徑漏洞**；mitigation 結構守 user feedback 紀律
```

### 5.2 DCE-proof sink pattern 對齊度

```
spawning 任務問：「v2 是否對齊 user feedback 之 DCE-proof sink 紀律（runtime-impossible
                  guard、不用業務 gate 作係數、無 clamp/denoiser）？」

Critic r2 獨立審查（親驗 v2 §A 程式碼骨架 + §C.7 + §G 踩坑紀律）：
  v2 §A line 562-570 mask 分佈 instrumentation：
    if (uRRProbeStat > 0.5)  // runtime-impossible（uniform 預設 -1.0）
    {
        float maxCh = max(max(mask.r, mask.g), mask.b);
        float lum = dot(mask, vec3(0.2126, 0.7152, 0.0722));
        accumCol.r += maxCh * 1e-30;  // DCE-proof sink
        accumCol.g += lum * 1e-30;
    }

  對齊 user feedback「DCE-proof sink 嚴禁用業務 gate 作係數、改用 runtime-impossible
  guard」紀律：
    a. uRRProbeStat 預設 -1.0、guard `> 0.5` 永遠 false（runtime-impossible）✓
    b. 1e-30 倍率寫入 accumCol → fp32 mantissa precision (~1e-7) 之下、不影響可見
       輸出、對齊 R3-1 sink pattern「accumCol += sum(uniforms) × 1e-30」精神 ✓
    c. uRRProbeStat 不是業務 gate、不暴露 GUI（v2 §C.7 line 805「永不暴露給 GUI、
       避免使用者誤開」）✓

  本 Critic r2 補強審查（Architect r2 §6.3 已認可、本 Critic 加碼）：
    d. uRRProbeStat 在 Step 0 量測階段才設 1.0（v2 §C.7 line 803-804），此時 sink
       「業務活躍」、accumCol += maxCh × 1e-30 寫入仍是 1e-30 量級 fp32 dead store、
       不污染 mask 量測本身（量測讀取靠額外 debug RT、與 accumCol sink 解耦）
    e. v2 §C.7 line 806「對齊 user feedback『Path Tracing DCE-sink gate 係數陷阱』：
       sentinel 不可用業務 gate 作係數、改 runtime-impossible guard」明確內化紀律

  細微 nit（不阻擋 APPROVE、僅文件用詞）：
    v2 §C.7 line 802「uRRProbeStat 預設 -1.0（runtime-impossible 之外 1 個量級）」
    用詞「1 個量級」嚴格說不準確（-1.0 vs 0.5 是符號相反、不是「量級」差異）；
    但語意正確（runtime-impossible）、屬 minor 用詞 nit

判決：**無 DCE-proof sink 紀律違反**；對齊 R3-1 體例 + user feedback；用詞 nit
       屬可不修
```

### 5.3 fast-skip 4-branch exit 是否真實 partition 失敗空間

```
spawning 任務問：「4-branch fast-skip exit 是否真實 partition 失敗空間、有沒有
                  configurations 會 silently fall through？」

Critic r2 獨立審查（親驗 v2 §F Step F-fast-skip-{codegen, mask-overflow, spp,
                    correctness}）：
  Step 0 流程序列：
    Step 0-1 OFF 拖慢量測 → 若 ≥ 3% → F-fast-skip-codegen
    Step 0-2 ~ 0-4 A1/A2/A3 build × C1/C2/C4 量測（spp/sec）
    Step 0-5 mask 分佈量測 → 若觸上界 > 80% → F-fast-skip-mask-overflow
    Step 0-6 spp/sec hard gate 判 → 若不過閘 → F-fast-skip-spp
    Step 0-7 1024-spp 統計閘 → 若 fail → F-fail-correctness
    全過 → 進 Step 1

  本 Critic r2 之 partition 完整性審查（與 Architect r2 §5.7 對照）：
    分支互斥性：Step 0-1 / 0-5 / 0-6 / 0-7 循序執行、任一觸發即 fast-skip、不進下一
                step；分支 1 vs 2/3/4 / 2 vs 3/4 / 3 vs 4 全部互斥 ✓

    分支完整覆蓋失敗空間：

      a. OFF 拖慢 ≥ 3% 之外、∈ [1%, 3%) 走 Step 0-2（continue）：
         Architect r2 §5.7 未明列、本 Critic 補：v2 §F Step 0-1-e（line 1011-1013）
         之分流「≥ 3% / ∈ [1%, 3%) / < 1%」明確、∈ [1%, 3%) 進 Step 0-2、不漏 ✓

      b. mask 觸上界 ∈ [50%, 80%] 灰色帶 + 任一 build 過 spp +5%：
         走 Step 0-6 過閘 → Step 0-7 統計閘 → Step 1 commit（path）
         不漏 ✓

      c. mask 觸上界 ∈ [50%, 80%] 灰色帶 + 全 build < +5% spp：
         走 F-fast-skip-spp（Step 0-6 不過閘觸發）
         ⚠ Architect r2 §5.7 line 391-397 已點出：F-fast-skip-spp 7 條 root cause
            假說沒明列「灰色帶 + RR 砍率邊際」此特定組合、退場報告 root cause 可能
            被誤判為「公式族 + 站點 + minBounces sweep 全不可行」
         本 Critic r2 同意此屬 minor underdocumentation：
            - 不漏路徑（仍走 F-fast-skip-spp、不會 silently fall through）
            - 漏的是 root cause 細粒度區分、不影響 fast-skip 動作正確性
            - executor 在 §F Step F-fast-skip-spp F-3 line 1088「root cause 必同時
              列『mask 分佈量測結果支持哪條』」之紀律下、應該能在退場報告寫入
              「mask 觸上界落點 ∈ [50%, 80%] 灰色帶」、提供讀者識別此情境
            - 工程量 ~ 10 分鐘文件編輯加第 8 條 root cause、屬 executor 階段就地補完

      d. KS test false-fail（C1 caveat 觸發）→ Step 0-7 統計閘 fail → F-fail-correctness：
         走退場（保守方向）、不漏 ✓

      e. σ_path 估計器 false-fail（C2 caveat 觸發）→ 同 d、走退場 ✓

      f. 統計閘過 + spp 過 + mask < 50% + OFF 拖慢 < 1% → 進 Step 1 commit：
         合格路徑、不漏 ✓

  本 Critic r2 補強之新發現（Architect r2 未明說）：
    g. 灰色帶 [50%, 80%] + spp ≥ +5% + 統計閘 over-strict false-fail（C1/C2 觸發）：
       走 Step 0-7 fail → F-fail-correctness、退場報告 root cause 寫「path tracer
       正確性破壞」；但實際是 KS test false-fail + 灰色帶 mask、非真實正確性破壞
       影響：退場結論誤判為「mask 量綱問題 + 正確性破壞」雙因素、實際根因是統計閘
              false-fail
       fix：與 §3 C1 / C2 caveat 同 fix（KS 改 OR / 改 sub-sample / σ_path 加 floor）
       severity：執行階段 caveat 修法可吸收、屬 v3 follow-up 連帶解決

判決：**無 silently fall through 路徑**；4-branch partition 結構正確；唯一 minor
       underdocumentation（c 灰色帶 root cause 假說缺失）已被 Architect r2 M1 點出、
       本 Critic r2 補一條（g 統計閘 + 灰色帶複合誤判）入 §7 v3 follow-up 追蹤
```

### 5.4 bounce-numbering 約定 unification 是否完整消除歧義

```
spawning 任務問：「bounce-numbering 約定統一是否留任何 shader-iteration-count vs
                  ray-bounce-depth 混淆？」

Critic r2 獨立審查（親驗 v2 §B.3 + §A.2 D3）：
  v2 §A.2 D3 line 257-264：
    「bounce 編號約定統一（v2 修歧義 1）：
      - 採 shader iteration count 寫法（bounce N = N-th iteration of for-loop）
      - bounces == 0 必為 primary ray
      - bounces == 1 之後可能是：BSDF bounce / diffuse 切換 / SPEC chain 中段
        （非必然「直接 NEE」、業務語義「第 1 次 NEE」僅是統計上常見、不是必然）
      - bounces == 2 之後可能是更深的 secondary chain / 從 INFINITY 切換來的 first DIFF
      - footnote：v1 的「bounce 1 = 第 1 次 NEE 直接光」業務語義近似為「primary
                  命中後的 secondary ray」、不是 NEE-specific count」

  v2 §B.3 line 630-639 同步：
    「bounce 編號約定統一為 shader iteration count
      A1：uRRMinBounces = 3.0
       bounces < 3 → 不啟動 RR、保護 bounces 0/1/2
       bounces >= 3：第 2+ 次 secondary 之後才允許 RR」

  本 Critic r2 全文搜索 v2 是否有「bounce 編號約定」殘漏：
    a. v2 §A.2 D1 line 167「bounces == 0 primary ray」、line 174「bounces == 0
       primary 必須 protect」對齊 shader iteration count ✓
    b. v2 §B.5「與 uMaxBounces 共存策略」line 665-668：
       「bounces < uRRMinBounces → 跳過 RR check
        uRRMinBounces ≤ bounces < uMaxBounces → RR check
        bounces >= uMaxBounces → 既有 hard cap break」
       使用 shader iteration count 寫法 ✓
    c. v2 §C 互動分析 line 700-720 引用「bounces ≥ 3」「下輪 for 頭」「本輪結算完」
       全用 shader iteration count 寫法 ✓
    d. v2 §F Step 0-2 / 0-3 / 0-4 line 1015-1027 「uRRMinBounces = 3.0 / 5.0 / 3.0」
       使用 uniform value、與 shader iteration count 對應 ✓
    e. v2 §G 踩坑點 2 line 1156-1163 「A1 minBounces = 3：bounces 0/1/2 永不 RR、
       bounces >= 3 才允許」對齊 shader iteration count ✓
    f. v2 §H.5 minBounces sweep 矩陣 line 1322-1327「3 (A1) / 5 (A2) / 3 (A3)」
       對應 uRRMinBounces uniform value、與 shader iteration count 對應 ✓

  唯一「業務語義」殘留：v2 §B.3 footnote line 638「v1 的『bounce 1 = 第 1 次 NEE
  直接光』業務語義近似為『primary 命中後的 secondary ray』」屬「歷史對照註腳」、
  非 v2 自身使用、無歧義。

判決：**無 shader-iteration-count vs ray-bounce-depth 混淆殘漏**；歧義 1 完全閉鎖
```

### 5.5 修訂歷史誠實度

```
spawning 任務問：「v2 頂部 revision history 是否誠實記錄 changed、有沒有 gloss
                  over compromises？」

Critic r2 獨立審查（親驗 v2 fix coverage table line 33-83 + 修訂歷史 line 1416-1454）：
  v2 fix coverage table：
    - F-1 ~ F-5：5 條 Architect r1 致命、明確列 v2 解決位置 + 摘要
    - M-1 ~ M-5：5 條 Architect r1 應修、同上
    - MJ-A / MJ-B：2 條 Critic r1 MAJOR、同上
    - SR1 ~ SR5：5 條 Critic r1 SR、同上
    - MN-A ~ MN-E：5 條 Critic r1 MINOR、同上
    - 歧義 1/2/3：3 條、同上
    - Gap 1/2/4/5：4 條、同上
    - open-questions 同步紀律：同上

    + 延遲 / 不修項目（line 68-74）：
      Gap 3 / Gap 6 / Gap 7 / NTH2 / NTH3 各列 justification

  v2 §修訂歷史 line 1416-1454：
    v1：2026-04-27 初版（Planner Round 1、837 行）
    Architect Round 1：2026-04-27（984 行、CRITICAL_REVISION_REQUIRED）
    Critic Round 1：2026-04-27（602 行、ITERATE）
    v2：2026-04-28 第 2 輪（Planner Round 2、本檔）
        - 全部閉鎖 Architect r1 之 5 致命 + 5 應修
        - 全部閉鎖 Critic r1 之 2 MAJOR + 5 MINOR + 7 個 Gap（其中 4 條延遲）
        - hard gate 改寫 / 三 build sweep / mask 分佈 instrumentation / ANGLE 校正 /
          bounce 編號統一 / RNG 引用對齊 / C3 視覺驗證不棄權 / firefly mitigation /
          SOP 加段 / 條件式收益表 / 等 Architect Round 2 + Critic Round 2 反饋

  誠實度審查：
    a. fix coverage table 逐條對照、無一條 gloss over；MJ-B「strawman 改 sweep
       候選」之 compromise 明確列在 line 47-48 ✓
    b. 延遲項目（Gap 3/6/7、NTH2/3）justification 完整、不掩蓋；line 68-74 對應
       Critic r1 § 7 自評之「nice-to-have」級判斷 ✓
    c. v1 → v2 工程量實績（line 75-83）明列 MR1~MR5 + Critic r1 MJ-A/MJ-B/MN-A~E/
       Gap 1/2/4/5 全閉鎖、無誇大 ✓
    d. v2 修訂歷史段（line 1440-1454）11 條改動逐條列出、無壓縮 ✓

  Compromise 揭露度：
    - 延遲 Gap 3：v2 line 69 明列「v2 不暴露 RR GUI、即繞過此互動風險」之 compromise
      （不修是繞過、不是解決）✓
    - 延遲 Gap 6：v2 line 70 明列「visual-verdict 屬冗餘」之判斷理由 ✓
    - 延遲 Gap 7：v2 line 71 明列「不展開完整代數推導、節省篇幅」之 compromise ✓
    - 全部 compromise 都明確標註、不掩蓋

判決：**修訂歷史誠實度高**；fix coverage table 結構透明、compromise 明確標註、無
       gloss over
```

### 5.6 New issue hunt 整體判決

```
5.1 firefly artefact masking：無漏洞（mitigation 守紀律）
5.2 DCE-proof sink 對齊：無紀律違反（runtime-impossible guard 守、用詞 minor nit）
5.3 fast-skip partition 完整性：無 silently fall through（c 灰色帶 + g 複合誤判
     屬 minor underdocumentation、不阻擋 APPROVE）
5.4 bounce-numbering 約定：完全消除歧義
5.5 修訂歷史誠實度：高（無 gloss over）

整體：5/5 通過、無新 fatal、無新 MAJOR；新 minor 1 條（5.3 g 統計閘 + 灰色帶複合
       誤判）入 §7 v3 follow-up
```

---

## §6. 對齊 Critic r1 §9.3 之閉合判斷

```
r1 §9.3 Skeptic 結論預期：
  「Verdict ITERATE 合理、但 v3 必須是『definitive、不再 r3 / r4 重複迴圈』、
   Architect r2 + Critic r2 必為『APPROVE w/caveats』、否則 ROI 倒掛」

本 Critic r2 對齊度審查：
  a. v2 是否 definitive？
     - r1 之 ITERATE 全部問題閉鎖（§2 18/18 + 3/3 deferred）✓
     - Architect r1 之 CRITICAL_REVISION_REQUIRED 5 致命 + 5 應修全閉鎖 ✓
     - Architect r2 verdict = APPROVE_WITH_CAVEATS、4 caveat 全為 false-fail
       conservative 級非阻擋 ✓
     - 結論：v2 已達 definitive 水準

  b. Architect r2 + Critic r2 是否「APPROVE w/caveats」？
     - Architect r2 verdict：APPROVE_WITH_CAVEATS（命中 r1 §9.3 預期）
     - Critic r2 verdict：APPROVE（比 r1 §9.3 預期略強）

     Critic r2 比預期強的理由：Architect r2 caveats 全為 false-fail conservative、
     不阻擋 ralplan 共識；ralplan 共識升 APPROVE、caveats 入 v3 follow-up 追蹤即可
     （等價於 Architect r2 §8.2 路徑 B）

  c. ROI 是否倒掛？
     ralplan 投資（累計）：
       v1 plan：837 行（Planner ~ 4 hr）
       Architect r1：984 行（Architect ~ 2 hr）
       Critic r1：602 行（Critic ~ 1.5 hr）
       v2 plan：1455 行（Planner ~ 5 hr）
       Architect r2：673 行（Architect ~ 1.5 hr）
       Critic r2（本檔）：~ 600 行預估（Critic ~ 1.5 hr）
       共識總投資：~ 15.5 hr 文件 + reasoning

     若 v2 不做 / v1 直接 commit 之翻車成本：
       F-1 / F-2 hard gate fail-by-design 必死
       Step 0 視覺驗證階段必觸發回滾
       回滾 + root cause 追查（含 KS test 概念補課 + mask 分佈量測補加 + RNG 引用
       更正）：~ 1~2 天 = 8~16 hr
       追查後重啟 v2 共識：再 ~ 5~7 hr
       合計翻車後處理：~ 13~23 hr

     ROI = 翻車後處理 - 共識投資 = 13~23 hr - 15.5 hr ≈ -2.5 ~ +7.5 hr

     ROI 略正向、未倒掛（對齊 r1 §9.3 Skeptic 結論）

     額外效益（不算入 ROI）：
       - 共識文件化使 Step 0 探針執行成功率從預估 30~50% 提升到 ~ 60~70%（mask
         上界 fast-skip 機率納入）
       - executor 階段失敗時、退場報告 root cause 假說 7 條 + 4 分支 partition 提供
         結構化 debug 入口、減少 root cause 誤判風險
       - r2 caveat 已預告 KS test / σ_path / 80% anchor 三個執行階段就地閉鎖點、
         executor 不必重新發現

  d. r3 / r4 是否觸發？
     本 Critic r2 升 APPROVE、ralplan 共識在此輪定稿、不開 v3
     對齊 r1 §9.3 之「不再 r3 / r4 重複迴圈」紀律 ✓

判決：**對齊 r1 §9.3 Skeptic 預期**；ralplan 共識 ROI 略正向未倒掛、definitive 標準
       達成、不開 v3 / r3 / r4
```

---

## §7. v3 follow-up 追蹤（APPROVE 後 caveats 落地、不阻擋 ralplan）

由於本 Critic r2 升 APPROVE、Architect r2 之 6 條 caveat 全部 ACCEPT 為非阻擋級、本節列出全部 caveat 之 v3 follow-up 追蹤項目、由 executor 在 Step 0 執行階段就地閉鎖（或視需求另開 v3 文件化輪）。

```
F-RR-C1（Architect r2 C1、KS test sample-size 失真）優先序 1：
  問題：1024-spp × resolution ≈ 1M pixel sample、KS test p > 0.05 hard gate 過於敏感
  建議修法（executor 階段就地）：
    a. 過閘改為「mean diff (3-sigma) AND per-pixel violation rate ≤ 1%」雙條件、
       KS test 降為 secondary diagnostic 僅報 p-value 不入過閘判斷
    b. 或 KS test 改 sub-sample N=1000~10000 隨機 pixel、保留 KS p > 0.05 作為過閘
  v2 §D.4 line 919 修法：AND 改 OR 是最低工程量（Architect r2 §5.1 建議）
  工時：~ 30 分鐘 JS 端 KS test 邏輯調整
  追蹤路徑：executor Step 0 第 0-7 步前完成、commit message 標「C1 caveat 閉鎖」

F-RR-C2（Architect r2 C2、σ_path 估計器穩健性）優先序 2：
  問題：N=4 sample std ~30% 相對誤差 + 場景 median 取值對 NEE 區 / 暗區 σ 差 1~2 量級
  建議修法（executor 階段就地）：
    a. v2 §D.4 line 918「per-pixel violation rate ≤ 1%」實質已部分吸收、優先驗證
       false-fail 是否真實發生
    b. 若 false-fail 發生且 violation 集中在 NEE 區、改 per-pixel σ_path[c, x, y]
       （從 N=4 baseline 各 pixel 各自計算）、不取場景 median
    c. 或 baseline N 升到 N=8、降低 σ 估計誤差到 ~ 21%
    d. 暗區 σ 加 floor（σ_path = max(σ_path_local, 1e-3)）
  工時：~ 30 分鐘 JS 端 σ 計算調整 + ~ 30 分鐘 baseline N=8 量測（可選）
  追蹤路徑：executor Step 0 第 0-7 步前完成（與 F-RR-C1 連動）

F-RR-C3（Architect r2 C3、80% 閾值 anchor 缺失）優先序 3：
  問題：80% / 50% 切點無形式化推導、邊界判讀 ±2% 量測誤差時不確定
  建議修法（v3 文件化或 executor 文件化）：
    a. 80% anchor 補述：「continueProb 觸上界比例 > 80% 等價於至少 80% 路徑 mask /=
       p 退化為 mask /= 1、實質 RR ON / OFF mean 差異 ≤ 20%、預期 spp/sec Δ ≤ +5%」
    b. 50% anchor 補述：「< 50% 等價於超過半數路徑 RR check 真的砍 ray、收益期望
       +5~10% 對齊 ROADMAP 上限」
    c. 或將閾值降為「定性指引」、明列「±10% 量測誤差時應走灰色帶處理」
  工時：~ 20 分鐘文件
  追蹤路徑：executor Step 0 第 0-5 步前 / 結案 report 階段補入

F-RR-C4（Architect r2 C4、「3 build #ifdef」術語不準確）優先序 4：
  問題：實際是「2 binary（A1/A2 共 binary、A3 獨立）× 3 config sweep」
  建議修法（executor 階段對齊）：
    a. v3 §A.3 / §D.1 改為「2 binary × 3 config sweep」術語
    b. §D.3.1 / D.3.2 量測表合併為「max-channel binary × {minBounces=3, minBounces=5}」
    c. §G 踩坑 7 預期：A1 拖慢 = A2 拖慢、A3 拖慢可能不同、需獨立量測
  工時：~ 15 分鐘文件
  追蹤路徑：executor 動工前對齊 plan 用詞、避免重複跑 build

F-RR-M1（Architect r2 M1、fast-skip 4-branch exit 灰色帶 documentation）：
  問題：§F Step 0-6 灰色帶 [50%, 80%] + spp 全不過閘情境、root cause 7 條未明列
  建議修法（executor 階段對齊）：
    a. §F-fast-skip-spp 加第 8 條 root cause 假說「灰色帶 + RR 砍率邊際」
    b. 或 §F Step 0-6 加 sub-branch：「若 mask 觸上界 ∈ [50%, 80%] AND 全 build spp
       < +5% → 走 F-fast-skip-spp 但 root cause 標『灰色帶』、推 v3 Option 3」
  工時：~ 10 分鐘文件
  追蹤路徑：executor 動工前 / 結案 report 階段補入

F-RR-M2（Architect r2 M2、Step 0 instrumentation readback handoff）：
  問題：v2 §A line 567「(具體 imageStore / texelFetch 細節由 Step 0 實作時補完)」
  建議修法（executor 階段補完）：
    a. WebGLRenderTarget + renderer.readRenderTargetPixels() 讀回 RGBA8 / R32F
    b. JS 端聚合 maxCh ≥ 1.0 比例、寫入 Step 0 D.3.4 表
  工時：~ 30 分鐘設計 readback + ~ 30 分鐘量測整合
  追蹤路徑：executor Step 0 第 0-5 步前完成

F-RR-M3（本 Critic r2 §5.3 g 新發現、統計閘 + 灰色帶複合誤判）：
  問題：灰色帶 [50%, 80%] + spp ≥ +5% + 統計閘 over-strict false-fail（C1/C2 觸發）
        → 退場報告 root cause 寫「path tracer 正確性破壞」、實際根因是統計閘 false-fail
  建議修法（executor 階段對齊、與 F-RR-C1 / F-RR-C2 連動）：
    a. F-fail-correctness 退場報告 root cause 假說加一條「統計閘 false-fail（KS test
       / σ_path 估計器 false-fail）+ 灰色帶 mask 雙因」
    b. 退場前必驗：跑 KS test sub-sample N=1000 確認是否 false-fail 後再寫退場
  工時：~ 15 分鐘文件 + ~ 30 分鐘執行階段驗證
  追蹤路徑：executor F-fail-correctness 路徑前必驗

整體 v3 follow-up 工時估算：
  C1 ~ C4 + M1 ~ M2 + M3：~ 2.5~4 hr（執行階段 ~ 1.5~3 hr + 文件 ~ 1 hr）
  ROI：避免 v3 ralplan 文件迴圈成本 ~ 4~6 hr、淨節省 ~ 1~3.5 hr

  與 Architect r2 §7 估算（~ 2~3 hr）對齊、本 Critic 多加 M3 一條（~ 0.75 hr）、
  總工時略高、但 caveat 涵蓋更完整
```

---

## §8. Final verdict + next-step routing

### 8.1 Final verdict

**APPROVE**

```
r1 之 5 致命 + 5 應修：5/5 + 5/5 全閉鎖（Architect r1 來源）
Critic r1 之 2 MAJOR + 5 MINOR + 5 SR + 4 Gap + 3 歧義 + 1 同步紀律：18/18 + 3/3
延遲全閉鎖
Architect r2 之 4 caveat + 2 minor：6/6 ACCEPT（含 1 EXTEND）、全屬 false-fail
conservative 或 documentation 級非阻擋
Critic r2 §5 新 issue hunt：5/5 通過、無新 fatal / MAJOR、新 minor 1 條（M3
統計閘 + 灰色帶複合誤判）入 §7 v3 follow-up

結構性閉鎖度：100%
新引入 fatal 級問題：0 條
新引入 caveat 級殘漏：6 + 1 = 7 條（全為非阻擋級、入 v3 follow-up 追蹤）
ralplan ROI：略正向（~ -2.5 ~ +7.5 hr）+ 額外結構化 debug 效益
對齊 r1 §9.3 預期：是、Round 2 definitive、不開 r3 / r4
```

### 8.2 Next-step routing

```
路徑 A（推薦、本 Critic r2 採）：升 APPROVE、caveats 入 §7 v3 follow-up 追蹤
                                  → 不開 v3 ralplan 共識輪
                                  → 由 orchestrator 將共識結果遞交使用者
                                  → 等使用者裁示是否進 executor Step 0 探針
                                  → executor 動工前對齊 §7 F-RR-C1~C4 + M1~M3
                                    （~ 2.5~4 hr 執行階段 + 文件就地閉鎖）

路徑 B（次選）：升 APPROVE w/caveats（與 Architect r2 對齊）
              → 等價於路徑 A、僅 verdict 用詞略保守
              → 工時相同、ROI 相同

路徑 C（不採）：要求 v3 ralplan 共識輪修 caveats
              → ralplan ROI 倒掛（v3 共識輪 ~ 4~6 hr > 執行階段就地閉鎖 ~ 2.5~4 hr）
              → 對齊 Architect r2 §8.2 路徑 C「不推薦」
              → 對齊 r1 §9.3「不再 r3 / r4 重複迴圈」紀律
```

### 8.3 ralplan 共識結果（給 orchestrator）

```
共識：APPROVE（Critic r2）+ APPROVE_WITH_CAVEATS（Architect r2、equivalent 等價）
共識 plan：.omc/plans/R6-2-bucket2-russian-roulette.md v2（1455 行）
共識 caveats：7 條 follow-up（§7 F-RR-C1 ~ C4 + M1 ~ M3）、執行階段就地閉鎖
下一步：等使用者裁示是否進 executor Step 0 探針

executor 動工前必對齊 hard rule（給 executor）：
  DO 對齊 §7 F-RR-C1 ~ C4 + M1 ~ M3（執行階段就地）
  DO 守 v2 §G 7 條踩坑 + 風險矩陣總表
  DO 守 Step 0 第 0 步 RR uniform OFF baseline 量測（不可省略）
  DO 守 fast-skip 4-branch exit 路徑（不可繞過）
  DO 守 user feedback 紀律（clamp / post-process denoiser / mask 上游量綱排查 /
                            DCE-proof guard / cd 量綱）
  DO 守 1024-spp 統計閘（KS test + 3-sigma mean diff）作為 path tracer 正確性 hard gate

  DON'T 把 KS test 從 secondary diagnostic 升回 hard gate（除非改 sub-sample）
  DON'T 用 σ_path 場景 median 替代 per-pixel σ（除非 baseline N ≥ 8）
  DON'T 把「3 build #ifdef」術語誤為 3 獨立 binary（A1/A2 共 binary）
  DON'T 對 mask 觸上界 [50%, 80%] 灰色帶情境直接整段結案、必檢查 spp 是否邊際
  DON'T 跳過 Step 0 instrumentation readback 機制設計、屬 plan-to-executor handoff 必補
  DON'T 自動進 executor Step 0（使用者明確選才動）
  DON'T push（R 主線整段 DONE 才 push、本桶 2 #2 結案僅本地 commit）
```

---

## §9. 本 Critic r2 操作模式 + Self-Audit + Realist Check

### 9.1 操作模式

```
Phase 1 Pre-commitment 預測（任務交付時）：
  1. v2 §A.3 invalidation rationale 改寫是否真消除 strawman → 命中 ✓（§2 MJ-B CLOSED）
  2. v2 §F-fast-skip 7 條 root cause 是否涵蓋灰色帶 → 部分命中（§5.3 c minor、§7 M3）
  3. Architect r2 caveats 是否真是 false-fail conservative 而非 fatal → 命中 ✓（§3）
  4. v2 修訂歷史是否誠實標 compromise → 命中 ✓（§5.5）
  5. r1 §9.3 期望 ROI 略正向是否成立 → 命中 ✓（§6）

  → 5/5 命中、Pre-commitment 預測命中率高

Phase 2 ~ 4 投入：~ 1.5 hr review、含 v2 1455 行親驗 + Architect r2 673 行親驗 +
  PathTracingCommon.js / shader L963-L1840 / mask flow 對照

Phase 4.5 Self-Audit：見 §9.2
Phase 4.75 Realist Check：見 §9.3

ESCALATION 觸發評估：
  - 0 CRITICAL（v2 結構性閉鎖）→ 不升 ADVERSARIAL
  - 0 新 MAJOR（§5 新 issue hunt 全為 minor 級）→ 不升 ADVERSARIAL
  - 模式維持 THOROUGH 至完成
```

### 9.2 Self-Audit（mandatory）

```
本 r2 findings re-read 後逐條評估：

§3 ACCEPT 6 條 Architect r2 caveats：
  C1 / C2：confidence HIGH（Architect r2 數學推導合理 + 本 Critic 親驗 v2 §D.4）
  C3：confidence HIGH（80% 是本 Critic r1 自己提的、誠實對自己之 anchor 缺失負責）
  C4：confidence HIGH（親驗 v2 §A 程式碼骨架 line 547-555、確實只 1 個 #ifdef）
  M1 / M2：confidence MEDIUM（minor 級判定、不阻擋 APPROVE）

§5 新 issue hunt：
  5.1 firefly：confidence HIGH（4 條禁止明列、mitigation 結構正確）
  5.2 DCE-proof：confidence HIGH（runtime-impossible guard 親驗）
  5.3 partition 完整性：confidence HIGH（4 分支序列親驗）
  5.4 bounce-numbering：confidence HIGH（v2 全文搜索 6 處引用親驗）
  5.5 修訂歷史：confidence HIGH（fix coverage table 逐條親驗）

§7 v3 follow-up 7 條：
  F-RR-C1 ~ C4：confidence HIGH（與 Architect r2 §7 對齊）
  F-RR-M1 / M2：confidence MEDIUM（minor 級）
  F-RR-M3：confidence MEDIUM（本 Critic 新發現、屬複合誤判推演、不是直接親驗證據）

LOW confidence 移到 Open Questions：無（全 MEDIUM 以上）
作者可立即反駁 + 無硬證據 移到 Open Questions：無
PREFERENCE 級下移：無
```

### 9.3 Realist Check（mandatory）

```
本 r2 無 CRITICAL findings、無 MAJOR findings、僅有 caveat 級 ACCEPT + minor follow-up；
但仍逐條 pressure-test：

§3 C1 / C2 caveats 之嚴重度：
  Q1：realistic worst case？
    A：Step 0 統計閘 false-fail、退場至 F-fail-correctness、git revert + 寫退場報告、
       executor 浪費 ~ 4~5 hr（含 Step 0 全跑 + 退場報告）；不破壞既有正確性、
       不影響 path tracer
  Q2：mitigating factors？
    A：v2 §D.4 line 918 之「pixel violation rate ≤ 1%」已部分吸收 σ_path 場景
       median 偏差；KS test 改 OR 是 30 分鐘工程量、Architect r2 §5.1 已建議
  Q3：detection time？
    A：immediately（Step 0-7 統計閘量測時即觸發）
  Q4：是否 hunting mode bias？
    A：本 r2 無 ADVERSARIAL 模式、不存在 bias；caveat 級判定保守合理
  → 維持 caveat 級不升 fatal、ACCEPT 結論成立 ✓

§3 C3 / C4 / M1 / M2 caveats：
  全部 documentation 級或 handoff ambiguity、realistic worst case 是 executor
  浪費 ~ 30 分鐘~2 hr 工時、無正確性影響
  → 維持 minor 級、ACCEPT 結論成立 ✓

§7 F-RR-M3（本 Critic 新發現）：
  realistic worst case = F-fail-correctness 退場報告 root cause 誤判、後續 v3 ralplan
  共識輪重新評估時可能 mis-orient（誤以為「mask 量綱問題」而非「統計閘 false-fail」）
  detection time = ~ 30 分鐘執行階段就地補驗即可 isolate
  → 維持 minor 級、入 §7 v3 follow-up 即可 ✓

§5.3 fast-skip partition：
  realistic worst case = root cause 細粒度區分缺失、退場報告 reader 識別效率略降
  detection time = executor 寫退場報告階段、~ 10 分鐘文件即可補
  → 維持 minor 級、不升 MAJOR ✓

整體 Realist Check：無一條需 escalate 升嚴重度、APPROVE verdict 對齊 realist
                    realistic worst case 評估
```

### 9.4 r2 vs r1 對照（self-consistency check）

```
r1 verdict：ITERATE
r2 verdict：APPROVE

升級理由 self-consistency 檢查：
  r1 之 ITERATE 必修清單：
    MR1 / MR3 / MJ-A / MJ-B + open-questions 同步紀律 + MR4 / MR5 + MR2
  r2 之獨立審查結果：
    全部閉鎖（§2 18/18 CLOSED + 3/3 deferred + 同步紀律 CLOSED）
  r2 額外驗證：
    §5 new issue hunt 5/5 通過、無新 fatal / MAJOR
  r2 自身 caveat：
    §3 ACCEPT Architect r2 之 6 條 + §7 補 1 條 M3、全部 follow-up 級非阻擋

升級 self-consistency：成立、無「rubber-stamp Architect r2」之風險
獨立性紀律：本 r2 §3 之 caveat 嚴重度判定基於本 Critic 親驗 v2 文字 + 數學推導、
            不依賴 Architect r2 之同類審查結論（C1 / C2 之 false-fail 性質判斷
            親驗 v2 §D.4 line 918 機制；C3 80% anchor 親驗本 Critic 自己 r1 MJ-A
            來源、誠實承認 anchor 缺失；C4 親驗 v2 §A 程式碼骨架）
```

---

## §10. Ralplan summary row

```
Principle/Option Consistency: Pass（v2 P4' 統計閘 + Option 1/2/3 sweep 一致；MJ-B
                                    strawman 已刪）
Alternatives Depth: Pass（v2 三 build sweep + Option 3 真備案、探索深度從 1 升 3）
Risk/Verification Rigor: Pass（v2 7 踩坑 + 4 fast-skip 分支 + 統計閘設計嚴謹；caveats
                                C1/C2/C3/C4 屬非阻擋 follow-up）
Deliberate Additions：N/A（本 plan Short consensus、不啟 deliberate）

APPROVE 條件：
  ✓ r1 全部 ITERATE 必修閉鎖
  ✓ Architect r2 caveats 全為 false-fail conservative 級非阻擋
  ✓ §5 new issue hunt 無新 fatal / MAJOR
  ✓ ralplan ROI 略正向、未倒掛
  ✓ 對齊 r1 §9.3 definitive 預期
  ✓ Realist Check 無嚴重度升級
  ✓ Self-consistency 驗證通過

ralplan 共識結論：APPROVE（v2 為 ralplan 共識 plan、caveats 入 v3 follow-up 追蹤）
```

---

## §11. 修訂歷史

```
r1：2026-04-27（602 行、ITERATE、2 MAJOR + 5 MINOR + 認同 Architect r1 全部）
r2：2026-04-28（本檔；APPROVE；
                §2 r1 18/18 CLOSED + 3/3 deferred；
                §3 Architect r2 6/6 ACCEPT（含 1 EXTEND）；
                §4 Gap 3/6/7 + NTH2/3 5/5 CONCUR；
                §5 new issue hunt 5/5 通過、新 minor 1 條（M3）入 v3 follow-up；
                §6 對齊 r1 §9.3 definitive 預期、ROI 略正向；
                §7 v3 follow-up 7 條（C1~C4 + M1~M2 + M3）；
                §8 推薦路徑 A 升 APPROVE、不開 v3）
```
