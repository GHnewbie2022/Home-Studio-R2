# F2 Plan v2 — Critic Review Round 2

> Round: 2
> Reviewer: critic agent (opus)
> 日期：2026-04-27
> 對象：`.omc/plans/R6-2-bucket4-F2-timer-breakdown.md` v2（Planner Round 2，1545 行）
> 上輪反饋：`.omc/plans/R6-2-bucket4-F2-architect-r2.md`（APPROVE w/caveats，3 caveat C1/C2/C3 + 2 antithesis A9/A10 移交）

---

## 1. Verdict

**ITERATE**

不能直升 APPROVE 的核心理由（單條足以阻擋）：

```
J1（必修）：caveat C1 未閉鎖 — open-questions.md §「R6-2 桶 4 F2 三段 timer 拆解」標題仍寫
          「Planner v1」、Q10/Q11 完全未追加（grep 親證 line 31「Planner v1」+ 全檔僅 Q1-Q9）
          plan v2 §H 修訂歷史 line 1544「★ Open Questions 寫入 .omc/plans/open-questions.md」
          為虛假宣稱。Architect r2 §5.7 已實證、本 review 再驗證屬實。
          deliberate 體例硬要求「Open Questions 集中歸檔」、宣稱與實證不符 = plan 文檔不可信
          性風險，不可放水。

J2（必修）：caveat C2 未閉鎖 — plan v2 §F Q1 開頭仍把 v1 字面與 v2 修訂並陳，未以「★ v2
          修訂註腳」明確區隔。讀者看到 §F Q1 兩處不同行號描述會困惑。Architect r2 已點出、
          Planner v2 未補。

J3（必修）：caveat C3 細節仍存 — plan v2 §A.3 Option 1 Pros 寫「12 個 early return/break」、
          §A.1 P1 寫「13 處 if 分支」、Architect r2 §1 caveat C3 點出實際應為「11 break +
          1 entry early-return + 1 conditional accumulation」。三處數字不一致（12 vs 13 vs
          11+1+1）造成 grep verifier 規則 2「14~24 行」無法精確定錨。

J4（必修，深度語義）：A9 caller-side break 副作用未被 v2 §A.2 D1 業務語義段補述，但 Test
          E2'-c acceptance「Stage A 偏差 ≤ 50%」可能被 30~50% 高估直接打穿（Architect r2
          §7 A9 已估）。本計畫以「結論可信度」為唯一收益，acceptance 邊界穿透 = 結論偽通過
          風險，必修。
```

ITERATE 含義：v3 必修上述 4 條，無新致命級反饋；v3 完成後可一輪內升 APPROVE。

---

## 2. Quality Criteria 評分（1~10）

| 維度 | 分數 | 證據 |
|------|------|------|
| Principle-Option 一致性 | 9 | P1~P5 5 條全到位、Option 1+3 為 Stage A/B 主路徑、與 P2 hard gate / P4 軟化 / P5 紀律對齊 |
| Fair Alternatives | 8 | Option 1~4 + Path D first-class + Stage A→B 二維、Option 4 SpectorJS 排除理由實證 |
| Risk Mitigation 清晰度 | 7 | 7 場景 trigger/detection/rollback 齊全、但 Scenario 3 三層判斷邏輯重疊（Architect r2 8.4） |
| Testable Acceptance | 7 | 多數可量化（≥ 10% / ≥ 1.3× / ≥ 90% / > 200/255）、但 E2'-d 用「警告」非 fail、Scenario 7 detection acceptance 未量化 |
| Concrete Verification | 9 | §E 7 條規則含 grep + magick 腳本、規則 6/7 cross-validation 補強、機械化執行可達 |
| Pre-mortem 完整性 | 9 | 7 場景 + Stage B fail-fast 退場路徑齊全、唯一缺漏：EXT_disjoint_timer pool size 用盡導致 query 部分丟失（被吞進 Scenario 2 但未獨立場景化） |
| Test Plan 完整性 | 9 | U1~U4 + I1~I4 + E1~E3+E2' 5 子驗 + O1~O3 + §C.5 三表，Stage A/B 雙覆蓋齊全 |
| 體例對齊度 | 7 | §A~§H 結構齊全、修訂歷史 v1→v2 正確；扣分點：open-questions.md 未同步（caveat C1） |
| 編輯品質 | 6 | caveat C2/C3 未修、§F Q1 字面歧義、Pros 數字不一致、§H line 1544 虛假宣稱；屬編輯紀律問題 |

加權總分：8.0/10（單項 < 7 的兩項皆為 caveat 處理範圍、修完即升）

---

## 3. Architect r2 caveat 處理

### C1（中度，open-questions.md 同步）：**未閉鎖** — 升 [必執行]

```
本 review 親自驗證（grep 結果）：
  line 31: ## R6-2 桶 4 F2 三段 timer 拆解 — 2026-04-27（Planner v1）
  全檔 Q10/Q11 0 hits

plan v2 §H line 1544 「★ Open Questions 寫入 .omc/plans/open-questions.md」 = 虛假宣稱

修改要求（v3 必修）：
  C1-1. open-questions.md line 31 標題改為「Planner v2」
  C1-2. Q10（AE 軟化）+ Q11（mode 2 emission 預載）追加於 line 43 Q9 之後
  C1-3. plan v2 §H line 1544 條目改為實證描述
```

### C2（中度，§F Q1 v2 修訂註腳）：**未閉鎖** — 升 [必執行]

```
本 review 親自驗證：plan v2 §F Q1 line 1362-1368 已修正為精確描述、字面 OK ✓
但 open-questions.md line 35 Q1 仍是 v1 原文：
  「**Q1**：probe 切點位置是否最佳？— mode 1 在 sampleStochasticLightDynamic L257-263 之間
   early-return、mode 2 在 hitType==DIFF L1800-1802 之間 early-break」

→ caveat C2 真正未閉鎖處在「open-questions.md Q1 條目同步」、不在 plan v2 §F Q1。

修改要求（v3 必修）：
  C2-1. open-questions.md line 35 Q1 全文改寫為 v2 精確描述
  C2-2. open-questions.md Q4/Q5/Q6 與 plan v2 §F 內文已修訂內容不一致 — 全部同步至 v2 內文
```

### C3（輕度，Option 1 Pros「12 個」描述模糊）：**部分閉鎖** — 升 [建議]

```
plan v2 §A.3 Option 1 Pros line 228:「shader 修改有限（uniform + 13 個 if + 12 個 early return/break」
plan v2 §A.1 P1 line 41-44:「= 13 處 if 分支」

實際拆解：
  - 1 entry early-return（L262 後 mode 1 入口）
  - 10 caller-side break（L1264 + 9 同構）
  - 1 conditional accumulation + break（mode 2 切點）
  → 共 12 個「early return/break」+ 1 conditional accumulation
  → §A.1 P1 算「13 處 if」（含外層 if (uSegmentMode == X)）

修改要求（v3 建議）：
  C3-1. plan v2 §A.3 Option 1 Pros line 228 改為：
       「shader 修改有限（13 處 if 分支：1 入口 early-return + 10 caller-side break + 1
        conditional emission + break，純 instrumentation）」
```

---

## 4. Findings

### CRITICAL（阻擋執行）

無。

### MAJOR（造成顯著重工或結論偽通過）

#### MJ1（A9 caller-side break 副作用未被 §A.2 D1 業務語義補述、E2'-c 邊界可能被打穿）

```
位置：plan v2 §D Step 1A-1.5（line 994-1006）+ §A.2 D1（line 105-108）+ §C.3 Test E2'-c（line 781-784）

Architect r2 §7 A9 量化估計：「mode 1 caller-side break 強制退出 for-bounces、T_NEE 估值
含『跳過後續 14-bounces 個 iteration 之 BVH + Material 累積成本』、實際偏高 30~50%
取決於平均 bounce 深度。」

數學推算：mode 0 一般跑 ~3~5 個 iteration、mode 1 caller-side break 在 bounces==0 即跳出
→ 跳過 2~4 個額外 iteration 之 BVH+Material 全段。Phase 1.0 §1 推估 NEE ≤ 12%、
若 mode 1 量到的 ΔT 含 30~50% 額外 iteration 成本 → T_NEE 估值 18%~25%、
與 12% 偏差 50%~108%、可能直接打穿 E2'-c Stage A ≤ 50% acceptance、
自動觸發升 Stage B（即 Stage A 全失敗、Architect Synthesis 兩階段策略的 Stage A 失去意義）。

Confidence：HIGH

Why this matters：
  若 Stage A 必然失敗、整個 Stage A→B 兩階段策略退化為「Stage A 是浪費的形式檢查」、
  plan v2 預估工程 Stage A 9 hr 全沉沒。

Fix（v3 必修）：
  a. §A.2 D1 補述 caller-side break 副作用
  b. §C.3 Test E2'-c Stage A 容許邊界二擇一：
     選項 1：放寬到 ≤ 100%
     選項 2：保留 ≤ 50% 但明確標「ANGLE select() codegen 機率約 70%、E2'-c 將推 60~80%
            機率自動升 Stage B；Stage A 失敗為預期常態、視為 fast-skip」
  c. §A.4 期望收益公式補述「Stage A 接受高機率升 Stage B、其價值在於 Step 0a 探針閘的
     fast-skip 而非 1A 量測結論」
  d. §H 修訂歷史在 v3 段補一條
```

#### MJ2（Scenario 3 三層判斷邏輯重疊矛盾）

```
位置：plan v2 §B Scenario 3（line 539-549）+ §C.5 Stage A 表 + §D Step 0-7

邏輯矛盾：1%~3% 區間既「警告繼續 Stage A」又「自動升 Stage B」、字面互斥。

Confidence：HIGH（直接邏輯矛盾、文字證據自證）

Fix（v3 必修）：
  二擇一：
  a. 嚴格版：< 1% 合格 / ≥ 1% 即升 Stage B（取消「警告」帶）
  b. 放寬版：< 1% 合格 / 1%~3% 警告繼續 Stage A / ≥ 3% 升 Stage B
  本 critic 推薦 (a)
```

#### MJ3（Test E2'-d acceptance 「警告」非 fail、無法成為 verification 規則 7）

```
位置：plan v2 §C.3 Test E2'-d（line 786-789）+ §E 規則 7（line 1289）

E2'-d 既然在 §E Verification Hooks 規則 7 中、應為 pass/fail 二元。
「警告」會讓規則 7 在 grep diff verifier 中無法決定是否阻擋 commit。

Fix（v3 必修）：
  §C.3 Test E2'-d acceptance 改為：
  「(T_first_hit_BVH / T_NEE) 比值在 C1/C2/C4 同號 → 通過 E2'-d；不同號 → fail E2'-d、
   視為 Scenario 1 嫌疑、自動升 Stage B；若 Stage B 仍不同號 → fail-fast 退場」
```

#### MJ4（mode 2 emission 累加範圍只含 LIGHT、其他 emitter 全黑會誤 fail Test I4）

```
位置：plan v2 §D Step 1A-2（line 1011-1015）+ §C.2 Test I4（line 740-745）

shader 親證 hitType 平行分支共 17 處 if（v2 寫「12+」、實際 17）：
  LIGHT (L1013) / TRACK_LIGHT (L1069) / TRACK_WIDE_LIGHT (L1109) / CLOUD_LIGHT (L1150 + L1664)
  — 共 4+ 個發光 hitType。mode 2 切點僅累加 LIGHT、軌道燈/雲燈直視全黑。

Cam 1 視場含吸頂燈（hitType==LIGHT）+ 軌道燈（hitType==TRACK_LIGHT）。Test I4 (b) 對軌道燈
直視點會誤 fail。

Fix（v3 必修）：
  §D Step 1A-2 切法擴大累加範圍：
  ```
  if (uSegmentMode == 2) {
      if (bounces == 0 && (hitType == LIGHT || hitType == TRACK_LIGHT ||
                           hitType == TRACK_WIDE_LIGHT || hitType == CLOUD_LIGHT))
          accumCol += mask * hitEmission;
      break;
  }
  ```
  同步更新 Test I4 (b) + §A.2 D1.b 「12+ hitType 分支」改為實證 17 處
```

### MINOR（建議改善但不阻擋）

```
MN1（§B Scenario 7 detection acceptance 未量化）
  「≥ 預期」未量化。建議：「SKIP_NEE build HLSL 行數比 baseline 少 ≥ 30%、或
  sampleStochasticLightDynamic 函式定義消失」

MN2（Stage A → Stage B 切換時 baseline 路徑分流）
  Stage A 16 張圖與 Stage B 16 張圖混在 .omc/test-runs/f2/ 會撞檔名

MN3（plan v2 §A.2 D1.b 寫「12+」hitType 分支與 shader 親證 17 處不對齊）

MN4（§G ADR Path V 未涵蓋 Stage B 後落 Path Z）

MN5（Pre-mortem 缺 EXT_disjoint_timer pool size 用盡導致 query 部分丟失場景）
```

### [建議] (Nice-to-have)

```
[1] §H 修訂歷史 line 1544 文檔誠信修訂
[2] Architect r2 §8.9 caller-side break 副作用補述（已併入 MJ1 fix）
[3] Stage B 工程量 timeout：「≥ 4 hr 仍未過 Step 0b → 視同 fail-fast 退場」
```

---

## 5. ADR 完整性審計

| 檢查項 | 結果 |
|--------|------|
| Decision 6 路徑（W/X/Y/Z/V/U） | ✓ |
| Drivers D1/D2/D3 對齊 §A.2 | ✓ |
| Alternatives Path D first-class | ✓ |
| Why chosen 對齊 P1~P5 | ✓ |
| Consequences 正/負面對稱 | ✓ |
| Follow-ups F-F2-1~10 | ✓ |
| 路徑互斥性 | △ V 與 Z 邊界模糊（MN4） |
| 路徑覆蓋完備性 | ✓ |
| Path D 與 Path U 區別 | △ 兩者都是 R3-8 後重評 |

整體 ADR 8/9 ✓，2 處邊界模糊屬 MINOR。

---

## 6. Open Questions 清理建議

```
| Q  | 狀態 | 建議 |
|----|------|------|
| Q1 | v2 §F 已精確化、open-questions.md 未同步 | 移出 + 同步 |
| Q2 | v2 §F 已答 | 移出 §F、保 ADR |
| Q3 | v2 §F 仍 open | 留 open |
| Q4 | v2 §F 已答 | 移出 |
| Q5 | v2 §F 已答 | 移出 ADR Consequences |
| Q6 | v2 §F 已答 / 與 MJ2 重疊 | 留 open（MJ2 解決後關） |
| Q7 | v2 §F 仍 open | 留 open |
| Q8 | v2 §F 仍 open | 留 open |
| Q9 | v2 §F 已實證待 Step 0-2.5 量 | 留 open |
| Q10 | caveat C1：open-questions.md 未追加 | C1 修後留 open |
| Q11 | caveat C1：open-questions.md 未追加 | C1 修後 + MJ4 解決後關 |
```

---

## 7. Verdict Justification

```
Mode：THOROUGH（無 CRITICAL，4 MAJOR 集中在 caveat 處理 + A9 副作用 + 邏輯一致性、屬同類）
Realist Check：無 downgrade（4 MAJOR 全條維持原評）

Deliberate 5 hard requirement 檢查：
  ✓ Pre-mortem ≥ 3：實際 7 場景
  ✓ 5 段 test plan：U/I/E/O/C5 五段齊全
  △ Acceptance 可量化：多數可量化、但 E2'-d 警告 / Scenario 7 detection 未量化（MJ3/MN1）
  ✓ Verification 機械化：§E 7 條全 grep + magick 可執行
  ✓ Alternatives fair：4 options + Path D + Stage A/B 二維

  → 4.5/5 綠燈、扣 0.5 在 MJ3 acceptance 量化未閉鎖。

升 APPROVE 條件：MJ1~MJ4 + caveat C1/C2/C3 全閉鎖。
```

---

## 8. Open Questions for User Decision

```
OQ1（給使用者裁定）：MJ1 fix 選項 1 vs 選項 2 / MJ2 fix 選項 a vs 選項 b — 兩處決策本質
                  是「Stage A 是常態 fast-skip 還是常態進 1A 量測」之態度。本 critic
                  推薦兩處皆選嚴格版（≤ 50% / 嚴格 1% 即升），讓 Stage A 變成 9 hr 投資
                  前的 0.5 hr 探針 fast-skip。但這會讓 Stage A 9 hr 工程量大概率沉沒。

OQ2（給 Architect r3 接力）：A10 BUILD_BASELINE AE = 0 之 ANGLE codegen 假設可達性 — 機
                          率 10~20% 觸發、但 v2 已內化（Scenario 7）、不需修改但需在
                          Stage B 升級前實證。

OQ3（給使用者裁定）：MN5 EXT_disjoint_timer pool size 用盡是否獨立 Scenario 化 — 取決於
                  Step 0-2.5 探測結果。
```

---

## 修訂歷史

- 2026-04-27 r2 初版（Critic Round 2 review，ITERATE，4 MAJOR + 5 MINOR + 3 建議）
