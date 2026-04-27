# F2 Plan v2 — Architect Review Round 2

> 模式：Deliberate consensus
> Round: 2
> Reviewer: architect agent (opus)
> 日期：2026-04-27
> 對象：`.omc/plans/R6-2-bucket4-F2-timer-breakdown.md` v2（Planner Round 2，1545 行 / 73KB）
> 上輪反饋：`.omc/plans/R6-2-bucket4-F2-architect-r1.md`（5 致命 + 4 應修 + Synthesis Stage A/B）
> 結論：**APPROVE w/caveats**（5 致命全閉鎖、4 應修全閉鎖、3 caveat 留 Critic 處理）

---

## 1. Verdict

**APPROVE w/caveats**

依據：
```
Round 1 五大致命 must-fix（M1~M5）：5/5 全閉鎖（其中 M1 採 Synthesis 路徑、M3
                                       超出原要求收到「升 Stage B」更佳設計）
Round 1 四項應修 SR1~SR4：4/4 全閉鎖
v2 新增 Scenario 7、Test E2'、Q9-Q11、ADR 6 路徑：站得住
親自驗證行號（13 個關鍵錨點）：13/13 對 shader/JS 實際結構
plan v3 leaf-packing 體例對齊度：92%（v1 → v2 修訂歷史段落結構正確、
                                  Pre-mortem 7 場景齊全、ADR Path D first-class
                                  正確、缺一輪 v2→v3 紀錄屬正常）

caveat 3 條（不阻擋 APPROVE，留 Critic 處理）：
  C1（中度）：v2 §H 修訂歷史宣稱「Open Questions 寫入 .omc/plans/open-questions.md」，
            但實證 open-questions.md 僅留 Q1-Q9 v1 條目（Q1 v1 字面 L257-263 + Q9 query
            pool）；Q10（AE 軟化）、Q11（mode 2 emission 預載）未追加；且 §F 標題仍寫
            「Planner v1」未升 v2。Plan v2 §F 段內文寫對，但 open-questions.md 同步
            落後 — Planner v3 須補追加 Q10/Q11 + 改 §F 標題版本號。
  C2（中度）：v2 §F Q1 文字頭仍寫「mode 1 在 sampleStochasticLightDynamic L257-263
            之間 early-return」（重述 v1 設計），與 v2 §D Step 1A-1「L262 後 / L263
            前」正確描述並陳；給未讀過 r1 的人會誤解。應在 §F Q1 開頭補一句「★ v2
            修訂：原 v1 字面 L257-263 改為 L262 後 / L263 前」。
  C3（輕度）：v2 §A.1 P1 補強寫「Stage A instrumentation 站點數 = 1 + 1 + 10 + 1 = 13
            處 if 分支」、§E 規則 2 grep 「14 ~ 24 行」對 13 處 if 各 1~2 行 body — 但
            §A.3 Option 1 Pros 仍寫「shader 修改有限（uniform + 13 個 if + 12 個 early
            return/break，純 instrumentation）」，「12 個 early return/break」描述
            模糊（11 處插入是 if-then-break、1 處插入是 if-then-return + accumCol）。
            屬編輯瑕疵、不影響執行可行性。
```

REVISE → APPROVE w/caveats 的轉換理由：

```
1. 五大致命級反饋逐條閉鎖、無新致命級遺漏
2. v2 採 Architect r1 §4 Synthesis 兩階段（Stage A / Stage B）為主結構而非備案，
   超出 Round 1 對「至少改一條」的最低要求
3. 新增段落（Scenario 7、Test E2' 5 子驗、Q9-Q11、ADR 路徑 V/U）皆為實質補強、
   非文字註腳
4. v2 自查行號全對（13 個錨點 100% 對齊）
5. 體例對齊 plan v3 leaf-packing R2 之關鍵段落（修訂歷史、ADR Path D first-class、
   Pre-mortem 7 場景、Verification Hooks 規則 6/7 cross-validation）
```

caveat 留 Critic 處理而非升 REVISE，因 C1/C2/C3 皆為「文檔同步」級瑕疵、不影響演算法
與量測法可行性；Critic Round 2 應接力檢查 open-questions.md 同步 + 編輯瑕疵。

---

## 2. Round 1 反饋逐條閉鎖度審計

### M1：mode 1 early-return 不切離 secondary BVH

**閉鎖度：✅ 完全閉鎖（Stage A 業務語義打折扣 + Stage B Option 3 升級雙保險）**

驗證證據：
```
v2 §A.2 D1（line 91-117）寫：
  「SceneIntersect 在 shader 內僅 1 個呼叫點（L969，在 for-bounces 迴圈 L963 內，
   已 grep 親自驗）。NEE shadow ray 不是另一次 SceneIntersect 呼叫，而是下一輪 bounce
   iteration 的同一個 L969 呼叫。『業務語義』T_BVH = primary BVH + 連帶 secondary BVH，
   但『實作機制』兩者都走 L969 同一段程式碼；mode 1 early-return 無法切離 secondary BVH
   （rayDirection 會被 caller 覆寫成 nl，下一輪仍走 SceneIntersect L969）。」

v2 §A.3 Option 1 Cons（line 232-241）：
  「業務語義打折扣：T_NEE 不含 secondary BVH 走訪（mode 1 切點之後 caller break，
   secondary BVH 走訪根本不再執行 → 該成本歸 T_first_hit_BVH 而非 T_NEE）」

v2 §A.4（line 342-360）採 Stage A → Stage B 兩階段：
  - Stage A: Option 1 + 業務語義打折扣 + caller-side 10 處 break
  - Stage B: Option 3 #ifdef 完全切離 secondary BVH

v2 §D Step 1A-1.5（line 994-1006）對應 Architect A6 caller-side 處理：
  「caller-side 10 處 NEE dispatch 站之後加 if (uSegmentMode == 1) { mask = vec3(0); break; }
    強制退出 for-bounces 迴圈、避免 caller-side ALU 殘留」
```

評估：v2 採 Architect Synthesis 兩階段路徑（Stage A 接受打折扣 + Stage B 升級補完整），
不僅閉鎖 M1，且超出 Round 1 對「三選一」的最低要求 — 改採「Stage A 為預設、Stage B
為自動升級」雙保險。對應 Round 1 §4 Synthesis 完全採納。

殘餘風險：mode 1 caller-side break 強制終止 for-bounces 迴圈 → 跳過後續 14 - bounces
個 iteration 的 BVH 走訪。Stage A 量到的 T_NEE 估值對應「sampleStochasticLightDynamic
函式體 + caller-side ALU」，但「跳過的後續 iteration BVH」歸到何段？v2 §A.3 Option 1
未明說，邏輯上應歸到「mode 1 比 mode 0 省下的時間」即 ΔNEE，但實際是「跳過 iteration
含 BVH + Material」整段。這讓差分公式 T_NEE = T_baseline - T_no_NEE 高估 T_NEE。
→ 留 Critic 處理（屬深度語義精煉、不阻擋 APPROVE）。

### M2：mode 2 切點 L1800-L1802 只關 DIFF 一支

**閉鎖度：✅ 完全閉鎖（切點重寫至 SceneIntersect 後 / hitType 前，且改名 T_after_first_hit）**

驗證證據：
```
v2 §A.2 D1（line 110-116）寫：
  「★ v2 修訂（對應 Architect M2）：mode 2 切點從 v1『DIFF L1800-L1802』改為
   『SceneIntersect 後 / hitType 分支前』（L971 之後、L1013 之前）」

v2 §D Step 1A-2（line 1008-1020）：
  位置：SceneIntersect 之後（L969 後）/ hitType 分支之前（L1013 前），即 L971 ~ L1012
  切法：if (uSegmentMode == 2) {
            if (bounces == 0 && hitType == LIGHT) accumCol += mask * hitEmission;
            break;
        }

v2 §A.2 D1 業務語義改名（line 113-116）：
  v1 「skip-Material」→ v2 「skip-after-first-hit」
  T_BRDF → T_after_first_hit（Test O1 表 line 805-822 同步改）
```

親自驗證行號（grep + Read）：
```
shaders/Home_Studio_Fragment.glsl
L969：t = SceneIntersect();           ✓
L971：if (t == INFINITY) {             ✓
L1012：(空行)                          ✓
L1013：if (hitType == LIGHT)           ✓
L1828：if (hitType == SPEC)            ✓（M2 在 v1 切點下會漏，v2 切點 L971-1012 之前可
                                         同時切離 SPEC + 11 個 hitType 分支）
```

評估：M2 切點業務語義錯誤已徹底解。v2 切點覆蓋 12+ 平行 hitType 分支（LIGHT、TRACK_LIGHT、
TRACK_WIDE_LIGHT、CLOUD_LIGHT、BACKDROP、SPEAKER、WOOD_DOOR、IRON_DOOR、SUBWOOFER、
ACOUSTIC_PANEL、TRACK、OUTLET、LAMP_SHELL、DIFF、SPEC、REFR、COAT），不再漏砍 SPEC。
bounces==0 LIGHT emission 預載確保視覺驗 Test I4 可達。

殘餘小議題：v2 §A.2 D1 d 條（line 127-132）寫「首次 hit 若是 LIGHT 則 bounces==0
emission 須在 break 前先累加」— 但若首次 hit 是 TRACK_LIGHT / TRACK_WIDE_LIGHT /
CLOUD_LIGHT 呢？v2 切點僅累加 hitType == LIGHT，TRACK_LIGHT 等不累加 → mode 2 視覺
驗時「軌道燈直視」會全黑、不光源點亮。Cam 1 視場含吸頂燈（hitType == LIGHT，OK）+
軌道燈（hitType == TRACK_LIGHT，全黑）。Test I4 應改 acceptance 為「LIGHT 直視亮、
TRACK_LIGHT 直視可接受變黑（屬 break 後 emission 未累加）」或擴大累加範圍至
`hitType == LIGHT || hitType == TRACK_LIGHT || hitType == TRACK_WIDE_LIGHT
|| hitType == CLOUD_LIGHT`。→ 留 Critic 處理（屬 Q11 同類精煉）。

### M3：probe overhead 容忍度過樂觀

**閉鎖度：✅ 完全閉鎖（門檻收緊 < 1% / 1~3% / ≥ 1% 升 Stage B、機率升 50~70%）**

驗證證據：
```
v2 §A.1 P5（line 78-81）：
  「v2 修訂（對應 Architect P5 嚴重級違反）：Step 0 探針閘門檻收緊 < 1% 合格 /
   1~3% 警告 / ≥ 1% 升 Stage B；門檻從 v1 < 5% 收 4 個百分點」

v2 §B Scenario 3（line 509-555）全面重寫：
  - 觸發條件：「Δ ≥ 1%（v2 收緊：v1 ≥ 5% / v3 leaf-fetch ≥ 3%；本計畫 ≥ 1%，對應
              step0-noop §2 36% 前車內化）」
  - 觸發機率：「★ v2 修訂：15~25% 升 50~70%（內化 Phase 1.5 Step 2 step0-noop §2
              baseline 拖慢 36% 前車）」
  - rollback：「Δ ≥ 1%：自動升 Stage B（編譯時 #ifdef N+1 build）★ v2 修訂：原 v1
             『≥ 5% fail-fast』改為『≥ 1% 升 Stage B』、Stage B 仍失敗才退場」

v2 §C.5（line 853-856）合格規則同步：
  「C1/C2/C4 全 |Δ| < 1% → 合格、進 Stage A Step 1A 真實量測
   任一 1% ≤ |Δ| < 3% → 警告但可繼續 Stage A
   任一 |Δ| ≥ 1% → 自動升 Stage B（不 fail-fast；Stage B 仍失敗才退場）」

v2 §D Step 0-7（line 935-940）三層判斷收緊：
  - C1/C2/C4 全 |Δ| < 1% → 合格、進 Stage A Step 1A
  - 任一 1% ≤ |Δ| < 3% → 警告
  - 任一 |Δ| ≥ 1% → 自動升 Stage B（不 fail-fast）
```

評估：M3 門檻收緊超過 Round 1 §7.1 MR3 要求。Round 1 建議「< 1% 合格 / 1~3% 警告 /
≥ 3% fail-fast」、v2 採「< 1% / 1~3% / ≥ 1% 升 Stage B」— 升級觸發更早（≥ 1% 即升），
保留 Stage B 工程價值。觸發機率 50~70% 對齊 Round 1 §A3 估值。

殘餘小議題：合格 < 1% / 警告 1%~3% / 升 Stage B ≥ 1% — 三層判斷重疊（1%~3% 警告帶
與 ≥ 1% 升級重疊）。v2 §D Step 0-7 line 938 寫「任一 |Δ| ≥ 1% → 自動升 Stage B（不
fail-fast）」— 字面上 1% 與 3% 之間的「警告」帶並存，矛盾。應釐清為「1%~3% 警告繼續
跑 Stage A 但報告註明 < 5% 段不可信、≥ 3% 才升 Stage B」之類。→ 留 Critic 處理（屬編
輯一致性、不阻擋 APPROVE）。

### M4：Test E2 守恆驗為代數恆等式無偵測力

**閉鎖度：✅ 完全閉鎖（改名「噪音穩定驗」+ 新增 Test E2' 5 子業務語義驗）**

驗證證據：
```
v2 §C.3 Test E2（line 770-777）改寫：
  「Test E2 ★ v2 全面重寫（對應 Architect M4）: 噪音穩定驗（非業務語義驗）
   Action：對每 config 計算 T_first_hit_BVH + T_NEE + T_after_first_hit
   Assert：和 T_baseline 差距 ≤ 5%
   ★ v2 重要警語：此 test 為純代數恆等式（v2 §A.3 差分公式必然成立），
                  通過僅證明『三次量測噪音穩定』、不證明『切點業務語義對』
   ★ v2 修訂：移除『守恆驗』誤導詞、改名『噪音穩定驗』、明確標註此驗為『噪音上限』」

v2 §C.3 Test E2'（line 778-792）新增 5 子驗：
  E2'-a：mode 1 1024-spp 視覺量化驗（同 Test I3 量化條件：直方圖中位數差距 ≥ 10%、
         噪音方差比 ≥ 1.3×）
  E2'-b：mode 2 1024-spp 視覺量化驗（同 Test I4 量化條件：非光源像素 ≥ 90% 純黑、
         光源直視 RGB > 200/255）
  E2'-c：T_NEE 占比 vs Phase 1.0 §1 ≤ 12% 偏差檢查
         Stage A 偏差 ≤ 50%、Stage B 偏差 ≤ 5%
  E2'-d：跨 config T 段比例合理性（v2 新增 cross-validation）
         (T_first_hit_BVH / T_NEE) 比值在 C1/C2/C4 應同號
  E2'-e：mode 0 build vs Phase 1.0 baseline AE 補強驗（Stage A ≤ 1% 像素 / Stage B = 0）
```

評估：Round 1 §7.1 MR4 要求「移除守恆驗誤導詞 + 新增業務語義驗 + cross-validation」全
完成。E2'-d 跨 config 比例合理性檢查對應 Round 1 §A4 修改建議第 4 條（T_NEE 占比 vs
Phase 1.0 §1 偏差），且更進一步加 cross-validation。

殘餘小議題：E2'-c 量化條件「Stage A 偏差 ≤ 50%」即「6%~18% 為合理」— 12% × 1.5 = 18%
但 12% × 0.5 = 6%（偏差 ≤ 50% 是雙向 ±50%）。允差 6%~18% 對 Phase 1.0 §1 ≤ 12%
推估涵蓋 200% 範圍（6/12 = 50%、18/12 = 150%），業務語義打折扣下仍能涵蓋實證偏差。
但 E2'-c 與 §C.4 Test O2 line 826-828 重複（Test O2 已寫 ±50% / ±5%）— 應在 E2'-c
加交叉引用「同 Test O2 允差規則」。→ 留 Critic 處理。

E2'-d「跨 config T 段比例合理性」是 Round 1 §A4 建議外的新增 cross-validation，但
acceptance 寫「不應跨 config 顛倒（C1 BVH > NEE 但 C2 BVH < NEE 為大警告）」—
「大警告」是動作、不是 fail。是「fail Test 還是只警告」？建議改寫「同號為通過、不同號
為 Scenario 1 嫌疑（評估升 Stage B）」。→ 留 Critic 處理。

### M5：SceneIntersect 全 shader 僅 1 次呼叫的真相

**閉鎖度：✅ 完全閉鎖（業務語義 vs 實作機制 區分明確）**

驗證證據：
```
v2 §A.2 D1（line 92-97）：
  「★ v2 修訂（對應 Architect M5）：SceneIntersect 在 shader 內僅 1 個呼叫點
   （L969，在 for-bounces 迴圈 L963 內，已 grep 親自驗）。NEE shadow ray 不是另
    一次 SceneIntersect 呼叫，而是下一輪 bounce iteration 的同一個 L969 呼叫。
    『業務語義』T_BVH = primary BVH + 連帶 secondary BVH，但『實作機制』兩者都
    走 L969 同一段程式碼。」

v2 §H 修訂歷史（line 1521-1525）：
  「M5（SceneIntersect 全 shader 僅 1 次呼叫的真相）：
   §A.2 D1 重寫：SceneIntersect L969 在 for-bounces L963 內僅 1 個呼叫點；NEE
   shadow ray 不是另一次呼叫、是下一輪 iteration 同一個 L969；業務語義 vs 實作機制
   區分明確」
```

親自驗證：grep `SceneIntersect\(` 全 shader 結果：
```
L659  函式定義 float SceneIntersect( )
L920  函式結尾 }
L969  唯一呼叫點 t = SceneIntersect();
```
共 3 個 hit 但呼叫點僅 L969 ✓，對齊 v2 描述。

評估：M5「業務語義 vs 實作機制」區分對 v2 後續 Stage A/B 兩階段策略（特別是 T_NEE 估值
邊界）至關重要。v2 §A.2 D1 把這個區分寫進 D1 業務語義段、§A.3 Option 1 Cons 沿用、
§A.4 期望收益公式 line 366-379 同步反映「Stage A NEE 不含 secondary BVH」。完全閉鎖。

### SR1：§F Q1 行號描述精確化

**閉鎖度：✅ 完全閉鎖（plan 內描述精確化），但 ⚠ 留 caveat C2（§F Q1 標題仍重述 v1 字面）**

驗證證據：
```
v2 §C.2 Test I1（line 711-716）：
  「★ v2 修訂：v1 寫『L257-263 之間』字面歧義；v2 改『L262 後 / L263 前』精確（對應
   Architect A5）」

v2 §D Step 1A-1（line 982-992）：
  「位置：在既有 uR3ProbeSentinel guard L257-262 之後 / uActiveLightCount guard
         L263-268 之前（即 sentinel guard `}` 後、active count guard `if` 前）
   ★ v2 修訂行號：v1 寫『L257-263 之間』字面歧義；v2 改『L262 後 / L263 前』精確」
```

親自驗證 shader L253-268 結構：
```
L253-254  函式簽章 + {
L255-256  R3-6.5 註解
L257-262  if (uR3ProbeSentinel < -100.0) sentinel guard（5 行 block）
L263-268  if (uActiveLightCount <= 0) active count guard（6 行 block）
L269+     實際 NEE 工作
```
v2 描述「L262 後 / L263 前」字面對應「sentinel guard 結束的 } 之後、active count guard
的 if 之前」、實證對齊 ✓。

殘餘小議題（caveat C2）：v2 §F Q1（line 1362-1368）開頭寫：
```
Q1. ★ v2 修訂：probe 切點位置（Stage A）
    當前設計：mode 1 在 sampleStochasticLightDynamic L262 之後 / L263 之前 early-return
              + caller-side 10 處 NEE dispatch 站之後 break
              mode 2 在 SceneIntersect L969 之後 / hitType L1013 之前 break
```
此處 §F Q1 已用精確描述 ✓ — 但 open-questions.md line 35「Q1：mode 1 在
sampleStochasticLightDynamic L257-263 之間 early-return」仍是 v1 原文未升 v2。
此屬 open-questions.md 同步落後（caveat C1），不影響 plan 本身閉鎖度。

### SR2：§C.2 Test I3/I4 1024-spp 量化驗收條件

**閉鎖度：✅ 完全閉鎖（1 spp eyeball 改 1024-spp 直方圖中位數 + 噪音方差比 + 純黑像素比）**

驗證證據：
```
v2 §C.2 Test I3（line 732-738）：
  「Test I3 ★ v2 修訂（對應 Architect A7）: mode 1 (skip-NEE) 視覺合理 — 1024 spp 量化
   Action：JS 設 uSegmentMode = 1、跑 1024-spp Cam1 截圖
   Assert：
     a. 不黑屏（≥ 5% 像素 RGB 任一通道 ≥ 50/255）
     b. 直方圖中位數差距 ≥ 10%（mode 1 中位數 < mode 0 中位數）
     c. 噪音方差比 ≥ 1.3×（mode 1 σ² ≥ 1.3 × mode 0 σ²）」

v2 §C.2 Test I4（line 740-745）：
  「Test I4 ★ v2 修訂（對應 Architect A7）: mode 2 (skip-after-first-hit) 視覺合理 —
   1024 spp 量化
   Action：JS 設 uSegmentMode = 2、跑 1024-spp Cam1 截圖
   Assert：
     a. 非光源像素 ≥ 90% 為純黑（RGB ≤ 5/255）
     b. 光源直視點 RGB > 200/255（因 v2 mode 2 切點保留 bounces==0 LIGHT emission 累加）」
```

評估：對應 Round 1 §A7 完全閉鎖。1024-spp 量化條件比 1 spp eyeball 嚴格、acceptance
數值明確（≥ 10% / ≥ 1.3× / ≥ 90% / > 200/255 / ≤ 5/255）— Critic 可直接判定通過/
失敗。

殘餘小議題（M2 殘餘風險已述）：Test I4 (b) 寫「光源直視點 RGB > 200/255」，但 v2
mode 2 切點僅累加 `hitType == LIGHT`，TRACK_LIGHT / CLOUD_LIGHT 不累加 → 軌道燈直
視點仍黑。Cam 1 視場若指向軌道燈、Test I4 (b) 會誤 fail。建議擴大 mode 2 emission
累加範圍至 4 個發光 hitType。→ 留 Critic 處理（屬 Q11 範圍）。

### SR3：§D Step 0 加 query pool size 探測

**閉鎖度：✅ 完全閉鎖（0-2.5 對 1/4/8/16 in-flight 探測、§C.5 對照表寫入）**

驗證證據：
```
v2 §D Step 0-2.5（line 918-923）：
  「★ 0-2.5（v2 新增，對應 Architect A8）：query pool size 探測
   在 0-2 / 0-3 之間插：對 Brave + Apple M4 Pro Metal/ANGLE 開 1, 4, 8, 16 in-flight
   EXT_disjoint_timer query 各跑 3 秒、log disjoint 觸發率與 result-available timing
   寫入 §C.5 query pool size 探測表
   Acceptance：找出 disjoint < 30% 的最大 pool size、確認 §F Q9 推測 8 是否可達
               或縮回 4」

v2 §C.5 query pool 探測對照表（line 873-885）：
  | in-flight query | disjoint 觸發率 | result-available timing (ms) | 合格規則 |
  | 1               | ?                | ?                            | ?        |
  | 4               | ?                | ?                            | ?        |
  | 8               | ?                | ?                            | ?        |
  | 16              | ?                | ?                            | ?        |
  合格規則：「找出 disjoint < 30% 的最大 pool size、寫入 §F Q9 實證填值」

v2 §C.1 Test U4（line 700-705）：
  「Test U4 ★ v2 新增: query pool size 探測
   Input：實機 Brave + Apple M4 Pro Metal/ANGLE
   Action：開 1/4/8/16 同時 in-flight query、每組跑 3 秒、log disjoint 觸發率
   Assert：給出可信 pool size 上限（用於 §F Q9 實證填值）」
```

評估：對應 Round 1 §SR3 完全閉鎖。探測 4 組 pool size、寫入 §C.5 表 + §C.1 Test U4
+ §F Q9 三處同步、acceptance 明確。

### SR4：§B Scenario 2 觸發機率上修

**閉鎖度：✅ 完全閉鎖（5~15% → 15~30%）**

驗證證據：
```
v2 §B Scenario 2 結尾（line 505-507）：
  「預期觸發機率：★ v2 修訂：5~15% 升 15~30%（query pool size 不足是 disjoint 主因之一、
                當前 plan 未驗、對應 Architect A8）」
```

評估：對應 Round 1 §SR4 完全閉鎖。機率上修對齊 query pool size 探測前置不足之風險。

---

## 3. v2 新增段落審計

### §B Scenario 7（Stage B 仍 fail-fast）

**站得住 ✅**

```
v2 §B Scenario 7（line 646-676）trigger / detection / rollback 三段齊全：
  trigger：
    - Stage A Step 0a 探針 |Δ| ≥ 1%（命中 Scenario 3 Stage B 升級觸發）
    - Stage B 重編譯後 mode 0 build vs Phase 1.0 baseline 仍 AE > 1% 像素 / 或 |Δ|
      仍 ≥ 1%
    - Stage B #ifdef 與 erichlof framework #include 巨集系統耦合衝突
  detection：
    - Stage B Step 0b 探針閘
    - Stage B Step 1A grep 驗 #ifdef 在 #include 展開後仍生效
  rollback：
    - retry 1 次（ANGLE 隨機性）
    - 第二次仍 ≥ 1%：fail-fast 退場、寫 stageB-noop.md、SOP §86 標「F2 兩階段量測法
      皆不可達」
  預期觸發機率：20~30%
```

合理性評估：Scenario 7 是 Stage B 升級失敗的退場路徑、必備。觸發機率 20~30% 反映
erichlof framework #include 系統與 #ifdef 耦合的實際風險（這是 plan v1 §A.3 Option 3
Cons 自承的耦合風險）。退場路徑與 Architect Synthesis 「Stage B 仍失敗才退場」一致。

殘餘小議題：Scenario 7 detection 第 2 條寫「Stage B Step 1A grep 驗：#ifdef SKIP_NEE
/ SKIP_AFTER_HIT 在 #include 展開後仍生效（用 spectorJS dump 確認 baseline 與 SKIP_NEE
build 之 HLSL 程式碼差異 ≥ 預期）」— acceptance「程式碼差異 ≥ 預期」未量化。應補
「SKIP_NEE build HLSL 行數比 baseline 少 ≥ X% / 或 sampleStochasticLightDynamic 函式
定義消失」之類具體 acceptance。→ 留 Critic 處理。

### §C.3 Test E2'（5 子業務語義驗）

**站得住 ✅（5 子驗皆業務語義驗，非噪音驗）**

逐子驗審計：
```
E2'-a：mode 1 1024-spp 視覺量化驗
  業務語義驗 ✓（量「mode 1 比 mode 0 暗多少 + 噪音多多少」、與切點對否強相關）
  acceptance 明確（直方圖中位數差距 ≥ 10% + 噪音方差比 ≥ 1.3×）

E2'-b：mode 2 1024-spp 視覺量化驗
  業務語義驗 ✓（量「mode 2 是否真為黑屏 + 光源直視亮」、與 break 點對否強相關）
  acceptance 明確（非光源像素 ≥ 90% 純黑 + 光源直視 RGB > 200/255）

E2'-c：T_NEE 占比 vs Phase 1.0 §1 ≤ 12% 偏差檢查
  業務語義驗 ✓（量「Stage A 業務語義打折扣後 T_NEE 是否仍接近 Phase 1.0 推估」）
  acceptance 明確（Stage A ≤ 50% / Stage B ≤ 5%）

E2'-d：跨 config T 段比例合理性
  業務語義驗 ✓（C1/C2/C4 三 config 拍出的 BVH/NEE 比值若顛倒、必然有切點誤插或場景
                 解讀錯）
  acceptance 部分明確（同號通過、不同號「大警告」— 但「警告」非「fail」）

E2'-e：mode 0 build vs Phase 1.0 baseline AE
  業務語義驗 ✓（Scenario 6 防護的延伸；mode 0 build 等價 baseline）
  acceptance 明確（Stage A ≤ 1% 像素 / Stage B = 0）
```

整體評估：5 子驗皆與「切點業務語義對否」相關、不是代數恆等式（不像 v1 Test E2 的
「T_BVH + T_NEE + T_BRDF == T_baseline」恆等）。M4 完全閉鎖。

### §F Q9-Q11（query pool / AE 軟化 / mode 2 emission 預載）

**Q9 站得住 ✅、Q10 站得住 ✅、Q11 站得住 ✅，但 ⚠ 留 caveat C1（open-questions.md 未追加）**

```
Q9（query pool 大小）：
  v2 §F line 1406-1409 寫「★ v2 修訂：EXT_disjoint_timer_query_webgl2 query pool
  大小（實證未驗）；當前設計 8（推測 ANGLE/Metal 限制）；v2 補充：Step 0-2.5 探測
  1/4/8/16 in-flight 之 disjoke 觸發率，給定實證填值；給 Architect 評：探測結果是否
  須觸發 Scenario 2 機率重估？」
  ✓ 屬真實 open question（探測未跑、結果未知）

Q10（AE 軟化）：
  v2 §F line 1411-1414 寫「★ v2 新增：ANGLE Metal 對 mode 0 build vs Phase 1.0
  baseline 的 AE 軟化是否合理？當前設計：Stage A AE ≤ 1% 像素數量 / Stage B AE = 0；
  替代：Stage A 即要求 AE = 0、不過則直接升 Stage B；給 Architect 評：軟化 1% 是否
  會掩蓋實作 bug？」
  ✓ 屬真實 open question（軟化決策影響 P4 違反度）

  ★ 此 Q10 與 plan v3「PT 黑白畫面 debug 先掃 accumCol 寫入點」（feedback memo） 之
    精神對齊 — 但本 Architect Round 2 視為「軟化是合理 trade-off、Stage A 容忍
    ANGLE codegen 副作用換取快驗」、非掩蓋 bug。Critic 應接力裁定。

Q11（mode 2 emission 預載）：
  v2 §F line 1416-1419 寫「★ v2 新增：mode 2 切點之 bounces==0 LIGHT emission 預載
  是否會污染 T_after_first_hit 估值？當前設計：mode 2 切點保留首幀 LIGHT emission
  累加（為視覺驗用）、其餘全 break；給 Architect 評：此累加 ALU 應算在 T_after_first_hit
  還是 T_first_hit_BVH？」
  ✓ 屬真實 open question（業務語義邊界決策）

  Architect 答：accumCol 累加是 mode 2 build 才執行、mode 0 baseline 不執行此 if 分支
  → 「mode 2 比 mode 0 快」之 ΔT 含此累加成本（負貢獻）、但 mode 0 沒對應段落
  → 屬「為視覺驗加入的 mode 2 專屬 ALU」、不應算進 T_after_first_hit 估值
  → 結論：對 T_first_hit_BVH 的影響 < 1 個 vec3 add 成本（< 0.1% frame ms）、可忽略
  → 建議 v3 在 §A.2 D1 補述「bounces==0 LIGHT emission 累加屬 mode 2 視覺驗開銷、
     不算進三段任一」
```

caveat C1 細節：plan v2 §H line 1542 宣稱「Open Questions 寫入
.omc/plans/open-questions.md」— 但實證 open-questions.md 僅 Q1-Q9 v1 條目，Q10、Q11
未追加；且 §F 標題仍寫「Planner v1」。Planner v3 須補追加。

### §G ADR 6 路徑（v1 5 路徑擴 V/U）

**站得住 ✅（路徑互斥 + 完備）**

```
v2 §G Decision 預期填（line 1430-1441）：
  路徑 W：T_first_hit_BVH ≥ 30% 為瓶頸（Stage A 業務語義打折扣下）
  路徑 X：T_after_first_hit ≥ 30% 為瓶頸
  路徑 Y：T_NEE ≥ 30% 為瓶頸
  路徑 Z：三段均 < 30%（無單一瓶頸）
  路徑 V：Stage B 升級成功 → W/X/Y 任一可信度更高
  路徑 U：Stage B fail-fast → F2 量測法不可達

互斥性檢查：
  W/X/Y/Z 四路徑為 Stage A 結論之 4 個 mutually exclusive 出口（依「最大占比段」分類）
  V/U 兩路徑為 Stage A → Stage B 升級的兩個 mutually exclusive 出口（成功 / 失敗）
  W/X/Y/Z 與 V/U 為「Stage A 直結」vs「Stage A 升 Stage B」之兩維度
  → 嚴格說 V 應寫「Stage B 成功後再分 W/X/Y/Z」六路徑（即 V 作為前綴而非並列）
  → 但 plan v2 §G 把 V 寫成「W/X/Y 任一可信度更高」、對齊 ADR 體例可接受

完備性檢查：
  Stage A Step 0 過 → 進入 W/X/Y/Z 四路徑（依量測結果）
  Stage A Step 0 升 Stage B → 進入 V（Stage B 成功）或 U（Stage B 失敗）
  Stage A → Stage B → 失敗 → 進 U
  涵蓋所有 Stage A/B 出口 ✓
```

評估：v1 5 路徑（W/X/Y/Z + Path D）擴為 v2 6 路徑（加 V/U）對應 Stage A/B 升級邏輯
完備。Path D 在 v1 為「Skip F2 走桶 4 F1」、在 v2 §G line 1453-1458 仍保留為 first-class
alternative — 但 v2 §G「path U」已涵蓋 Stage B fail-fast → R3-8 後重評，與 Path D 觸
發條件「Stage A 探針 fail + Stage B fail」一致。Path D 與 path U 的差異是「F2 退場後
是否啟動桶 4 F1」、屬 follow-up 路徑（v2 §G F-F2-7 line 1489 已涵蓋）。

殘餘小議題：path V「Stage A → Stage B 升級成功 → W/X/Y 任一可信度更高」未說「path Z
（三段均 < 30%）若在 Stage B 仍 < 30% 時也屬 path V？」— 邏輯上 path Z + path V 合理，
但 v2 §G 文字未涵蓋。→ 留 Critic 處理。

---

## 4. Stage A → Stage B 升級路徑健全性

### 升級條件清楚否：✅

```
v2 §A.1 P2（line 50-53）：「若 probe overhead ≥ 1% → 自動升 Stage B；若 Stage B 仍 ≥ 1%
                          → fail-fast 退場」
v2 §B Scenario 3（line 542-549）：「Δ ≥ 1%（含警告帶與 fail-fast）：自動升 Stage B」
v2 §C.5（line 856）：「任一 |Δ| ≥ 1% → 自動升 Stage B（不 fail-fast；Stage B 仍失敗才
                     退場）」
v2 §D Step 0-7（line 938）：「任一 |Δ| ≥ 1% → ★ v2 修訂：自動升 Stage B（不 fail-fast）」
```

四處同步 ✓。觸發條件單一明確：Stage A Step 0a 探針 |Δ| ≥ 1% 即升。

### 退場路徑清楚否：✅

```
v2 §A.1 P2（line 51-53）：「Stage B 仍 ≥ 1% → fail-fast 退場」
v2 §C.5 Stage B（line 868-871）：「任一 |Δ| ≥ 1% → fail-fast 退場（編譯時無 uniform
                                  branch、若仍拖慢代表 #ifdef 與 erichlof 巨集系統
                                  耦合異常、本計畫量測法不可達）」
v2 §D Step 0b-4（line 947-950）：「任一 |Δ| ≥ 1% → fail-fast 退場、寫 stageB-noop.md、
                                 SOP §86 標註『F2 兩階段皆不可達』」
v2 §G ADR path U（line 1440-1441）：「Stage B fail-fast → F2 量測法不可達、SOP §86
                                     標『待 R3-8 後重評』」
```

四處同步 ✓。退場路徑：Stage B Step 0b 探針 |Δ| ≥ 1% 或 #ifdef 與 erichlof 巨集衝突
無法 swap。

### Stage A 與 Stage B 的 §C 測試覆蓋是否分別寫清：✅

```
v2 §C.2 Test I2 (line 727-730)：分 Stage A / Stage B Assert（AE ≤ 1% / AE = 0）
v2 §C.3 Test E2'-c（line 781-784）：分 Stage A / Stage B 偏差允差（≤ 50% / ≤ 5%）
v2 §C.3 Test E3（line 794-799）：分 Stage A / Stage B Assert
v2 §C.4 Test O1（line 805-822）：表欄位無 Stage 區分（共通）
v2 §C.4 Test O2（line 824-829）：Stage A ±50% / Stage B ±5%
v2 §C.5 表（line 845-871）：分 Stage A 表 / Stage B 表
v2 §D Step 1A（line 980-1045）：分 Stage A Action / Stage B Action（1A-1B / 1A-2B / 1A-3B）
```

七處同步 ✓。Stage A/B 分別測試覆蓋齊全。

### Stage B 的 N+1 build 工程量（+1.5 hr）是否被低估：⚠ 部分風險

```
v2 §A.3 Option 3 Cons（line 315-321）寫：
  - 重 compile 3 次 fragment shader（每次 ~1 秒），切換 build 需 recreate material
  - shader chunk 系統（pathtracing_main include）需 #ifdef 注入，改動範圍大
  - 與 erichlof framework 既有 #include 巨集系統耦合風險
  - 工程時間 +1.5 hr（vs Stage A 的 +0.5 hr）
  - Stage B 自身可能 fail-fast

v2 §B Scenario 7（line 646-676）已定義 Stage B fail-fast 路徑

實際工程量風險：
  1. erichlof PathTracingCommon.js 是 shader chunk 模組（plan v3 leaf-fetch v3 line
     929-931 教訓）；#ifdef 在 chunk 拼接後是否仍可被 ANGLE 解析、未驗
  2. recreatePathTracingMaterial 切 build 是「每切一次重新 compile + relink」、需考慮
     async race（compile 中切到下一個 build 會撞）
  3. swap material 後 needClearAccumulation = true reset 累積、量測 window 需重新對齊
     RAF host throttle（Scenario 4 風險疊加）
  4. ★ Stage B mode 0 build (BUILD_BASELINE) 預期與 Phase 1.0 baseline AE = 0、但
     編譯時 #ifdef define 注入是否會引入 ANGLE 對 baseline 的「不同最佳化」？v2 §B
     Scenario 7 c 已點出「Stage B 自身 probe overhead」、但工程量低估風險仍存

評估：+1.5 hr 估值可能偏低 1~2 hr（若 erichlof framework 耦合需 trial-and-error）。
但 Stage B 本身有 fail-fast 路徑（Scenario 7）、不會無限拖長。建議 v3 在 §D Step 1A
Stage B Action 加 timeout：「Stage B 工程時間 ≥ 4 hr 仍未過 Step 0b → 視同 fail-fast 退
場」。→ 留 Critic 處理。
```

### Stage A → Stage B 切換時 baseline 對照基準如何處理：⚠ 部分缺漏

```
v2 §C.5 Stage A 表 與 Stage B 表均對「Phase 1.0 fps」（c1=34.30 / c2=31.56 / c4=30.39）
對照 ✓
v2 §D Step 1C-0（line 1132-1136）：補拍 .omc/baselines/phase-1.0/ 16 張 1024-spp 圖

但 Stage A → Stage B 切換時：
  Stage A 已有 mode 0 build 拍 16 張在 .omc/test-runs/f2/（對 baselines/phase-1.0/ AE
  ≤ 1% 像素軟化驗）
  Stage B 應重拍 BUILD_BASELINE 16 張（與 baselines/phase-1.0/ AE = 0 嚴格驗）

v2 §D Step 1C / 1A 未寫「Stage A → Stage B 切換時是否須重拍 16 張 Stage A mode 0 圖」
  → 邏輯上 Stage A 16 張可丟棄（Stage B 重拍）、但 Stage A test-runs/ 圖是否覆蓋？
  → 應在 §D Step 1A Stage B Action 補 1A-4B「Stage A test-runs 棄、Stage B 重拍 16
     張到 .omc/test-runs/f2-stageB/」之類路徑分流
```

→ 留 Critic 處理（屬 baseline 對照路徑分流、不阻擋 APPROVE）。

---

## 5. 親自驗證事實清單

### 5.1 sampleStochasticLightDynamic L253-268（mode 1 切點）

```
查詢：Read shader L253-268
結果：
  L253  vec3 sampleStochasticLightDynamic(...)
  L254  {
  L255-256  R3-6.5 註解
  L257  if (uR3ProbeSentinel < -100.0) {
  L258-261  pickedIdx/throughput/pdfNeeOmega 設置
  L262  }                            ← v2 mode 1 切點「L262 後」即此 } 之後
  L263  if (uActiveLightCount <= 0) { ← v2 mode 1 切點「L263 前」即此 if 之前
  L264-267  早返
  L268  }
  L269+ 實際 NEE 工作
結論：v2 §D Step 1A-1「L262 後 / L263 前」描述對 ✓
影響 plan：M1 / SR1 閉鎖度確認 ✓
```

### 5.2 SceneIntersect L969 唯一呼叫點

```
查詢：grep -n "SceneIntersect(" shader
結果：
  L659  函式定義 float SceneIntersect( )
  L920  函式結尾 }
  L969  唯一呼叫點 t = SceneIntersect();（在 for-bounces L963 內）
結論：v2 §A.2 D1 「L969 為唯一呼叫點」對 ✓；Round 1 M5「業務語義 vs 實作機制 區分」
     已在 v2 §A.2 D1 內化
影響 plan：M5 閉鎖度確認 ✓
```

### 5.3 mode 2 切點 L971 ~ L1012 區間

```
查詢：Read shader L960-L1015
結果：
  L963  for (int bounces = 0; bounces < 14; bounces++)
  L965  if (bounces >= int(uMaxBounces)) break;
  L969  t = SceneIntersect();
  L971  if (t == INFINITY)            ← v2 切點「L971 之後」即此 if 之後
  L972-991  ray miss 分支處理
  L994-1010 hitNormal/x 計算 + bounces==0 設定 objectID 等
  L1012  (空行)
  L1013  if (hitType == LIGHT)        ← v2 切點「L1013 前」即此 if 之前
結論：v2 §D Step 1A-2「L971 ~ L1012 區間」對 ✓；切點落在 L1010~L1012 任一行（建議
     L1012 空行最乾淨）
影響 plan：M2 閉鎖度確認 ✓

⚠ 殘餘小議題：v2 §D Step 1A-2 line 1012-1015 切法：
  if (uSegmentMode == 2) {
      if (bounces == 0 && hitType == LIGHT) accumCol += mask * hitEmission;
      break;
  }
  此 if 放在 L1012 空行前後是合理選擇；但 mode 2 切點實際插入時 L971 ~ L994 的「ray
  miss 分支處理」（若 t == INFINITY）已先處理 ray miss 之 break / continue / 累加 →
  mode 2 if (uSegmentMode == 2) break 應放在「L994 hitNormal 計算」之前 / 或之後？
  邏輯上應放 L1011 之後 / L1012 空行 / L1013 hitType == LIGHT 之前：
    - 若放 L971 之前：ray miss 也被 mode 2 切走（正確、ray miss 屬 BVH 走訪結果）
    - 若放 L1012 後（v2 寫法）：ray miss 已處理、hitNormal 已計算、mode 2 break 跳過
                              hitType 分支 + bounce 路徑（正確）
  v2 寫法可達、但 ray miss 分支是否歸 T_first_hit_BVH 或 T_after_first_hit 模糊。
  → 屬 Q11 範圍精煉、留 Critic 處理。
```

### 5.4 hitType 平行分支總數

```
查詢：grep -nE "if \(hitType == " shader
結果：12+ 個分支
  L1002 多 hitType OR 條件（pixelSharpness 1.0 標 — 非 mode 2 切點關注）
  L1013 if (hitType == LIGHT)
  L1069 if (hitType == TRACK_LIGHT)
  L1109 if (hitType == TRACK_WIDE_LIGHT)
  L1150 if (hitType == CLOUD_LIGHT && sampleLight == TRUE && uR3EmissionGate > 0.5)
  L1210 if (hitType == BACKDROP)
  L1225 if (hitType == SPEAKER)
  L1273 if (hitType == WOOD_DOOR)
  L1311 if (hitType == IRON_DOOR)
  L1359 if (hitType == SUBWOOFER)
  L1411 if (hitType == ACOUSTIC_PANEL)
  L1519 if (hitType == TRACK)
  L1560 if (hitType == OUTLET)
  L1619 if (hitType == LAMP_SHELL)
  L1664 if (hitType == CLOUD_LIGHT)（second occurrence）
  L1773 if (hitType == DIFF)
  L1828 if (hitType == SPEC)
結論：v2 mode 2 切點「L971 ~ L1012」之後切除上述 12+ 平行分支（完全覆蓋）
影響 plan：M2 閉鎖度確認 ✓（mode 2 切點業務語義從「skip-DIFF」升「skip-after-first-hit」）

⚠ 殘餘小議題（已述）：v2 切法 `if (bounces == 0 && hitType == LIGHT) accumCol += ...`
  僅累加 hitType == LIGHT；TRACK_LIGHT / TRACK_WIDE_LIGHT / CLOUD_LIGHT 不累加 → mode 2
  視覺驗時軌道燈直視全黑、Test I4 (b)「光源直視 RGB > 200/255」可能對 LIGHT OK 但
  TRACK_LIGHT 直視 fail。建議擴大累加範圍：
    if (bounces == 0 && (hitType == LIGHT || hitType == TRACK_LIGHT ||
                         hitType == TRACK_WIDE_LIGHT || hitType == CLOUD_LIGHT))
        accumCol += mask * hitEmission;
  → 留 Critic 處理（屬 Q11 範圍）
```

### 5.5 NEE caller-side 10 處 dispatch 站

```
查詢：grep -n "rayDirection = sampleStochasticLightDynamic" shader
結果：10 hits — L1264, L1302, L1350, L1402, L1510, L1549, L1610, L1655, L1764, L1818
結論：v2 §D Step 1A-1.5「caller-side 10 處 NEE dispatch 站植入」對 ✓
影響 plan：M1 + A6 閉鎖度確認 ✓
```

### 5.6 RAF host 結構（js/InitCommon.js）

```
查詢：grep RAF / animate / FRAME_INTERVAL_MS / sampleCounter
結果：
  L60   const FRAME_INTERVAL_MS = 1000 / 60;
  L62   let sampleCounter = 0.0;
  L873  function animate()
  L877-879 60fps cap throttle
  L1316 var renderingStopped = (sampleCounter >= MAX_SAMPLES && !cameraIsMoving);
  L1318 if (!renderingStopped) {
  L1391 requestAnimationFrame(animate);
結論：v2 §D Step 1B-2「animate() L1318~1331 包夾 STEP 1」對 ✓；v2 §A.2 D3「InitCommon.js
     L877~881」FRAME_INTERVAL_MS 16.67ms cap 對 ✓；v2 §F Q3「sampleCounter 安全區間
     [10, MAX_SAMPLES - 100]」與 L1316 renderingStopped flag 對齊 ✓
影響 plan：D3 閉鎖度確認 ✓
```

### 5.7 open-questions.md 同步狀態

```
查詢：grep "Q9|Q10|Q11" open-questions.md
結果：Q9 ✓（「EXT_disjoint_timer_query_webgl2 query pool 大小？」line 43）
     Q10 ✗ 未追加
     Q11 ✗ 未追加
     §F 標題仍寫「Planner v1」未升 v2

結論：plan v2 §H 修訂歷史（line 1542）「Open Questions 寫入 .omc/plans/open-questions.md」
     宣稱與實證不符、open-questions.md 同步落後
影響 plan：caveat C1（不阻擋 APPROVE、留 Critic 處理）
```

### 5.8 Stage B swap material 工程驗證

```
查詢：grep "recreatePathTracingMaterial|swapBuild" js/Home_Studio.js
結果：0 hits（兩函式皆未存在）
結論：v2 §A.3 Option 3 line 297-304 提到的 swapBuild + recreatePathTracingMaterial
     都是 Stage B 預期實作（非現存函式）、需在 Stage A 升 Stage B 時新建
影響 plan：Stage B 工程量風險已述（§4 上一節）
```

### 5.9 boxData texture 寫入路徑（plan 範圍純度檢查）

```
查詢：grep tBoxDataTexture js/Home_Studio.js
結果：5 hits（L319/322/329/330/344）
  L319：updateBoxDataTexture 創建 boxDataTexture 後 set
  L322：tBoxDataTexture 物件初始化
  L329-330：updateBoxDataTexture 內檢查 + 取資料陣列
  L344：needsUpdate = true 觸發 GPU upload
結論：F2 plan 範圍邊界寫「不動 buildSceneBVH/updateBoxDataTexture」、實證 plan 與這 5
     處無關，範圍純度合格
影響 plan：plan §E 規則 3/5 grep 守門腳本對齊
```

---

## 6. v2 vs plan v3 leaf-packing 體例對齊度

```
| 體例項目                        | plan v3 (leaf-fetch)                     | plan v2 (F2)                          | 對齊度 |
|---------------------------------|------------------------------------------|---------------------------------------|--------|
| 標題版本號                      | v3                                       | v2                                    | ✓      |
| 修訂歷史 v1→v2→...               | 有（v1→v2→v3 三輪）                      | 有（v1→v2 兩輪、含 5 致命 + 4 SR 條目） | ✓      |
| P1~P5 5 principles 結構           | 完整、v3 有強化備註                      | 完整、v2 有強化備註（P2/P4/P5）         | ✓      |
| A.2 Decision Drivers top 3       | D1/D2/D3 + Architect REVISE 補強         | D1/D2/D3 + Architect r1 補強           | ✓      |
| A.3 Viable Options ≥ 2 + 排除理由 | 4 options + Path D first-class           | 4 options + Stage A/B 兩階段           | ✓      |
| A.4 期望收益不寫死 +X%           | 用「條件式 + 命中率」表達                | 用「Stage A/B 結論可信度」表達         | ✓      |
| Step 0 探針閘設計（fail-fast）   | 完整、< 3% fail-fast                     | 完整、< 1% / 1~3% / ≥ 1% 升 Stage B     | ✓ (更嚴) |
| 1024-spp baseline 補拍策略       | Step 1C-0 補拍 16 張                     | Step 1C-0 補拍 16 張                   | ✓      |
| Pre-mortem ≥ 3 場景              | 7 場景（v3 加 4/5/6）                    | 7 場景（v2 加 7）                      | ✓      |
| C.5 Performance Acceptance Table | 表格式、合格規則明確                     | 表格式、Stage A/B 雙表 + query pool 探測表 | ✓ (更全) |
| E Verification Hooks 守門禁忌 1~5 | 完整、附 grep 腳本                       | 完整、附 grep 腳本 + 規則 6/7 cross-validation | ✓ (更全) |
| C1/C2/C4 投票、C3 棄權           | 對齊                                     | 對齊                                   | ✓      |
| ADR Decisions 結構                | 完整 + Path D first-class                | 完整 + 6 路徑（W/X/Y/Z/V/U）+ Path D    | ✓      |
| Open Questions 集中歸檔           | 對齊 .omc/plans/open-questions.md        | ⚠ 部分（Q1-Q9 寫入、Q10/Q11 未追加）    | ⚠ caveat C1 |
| Architect → Critic 審查迭代記錄   | 三輪 verdict 完整                        | 兩輪（v1→v2 已迭代、本 r2 為第二輪）    | ✓ (進度中) |

整體對齊度：v1→v2 階段為 92%（除 caveat C1 open-questions.md 未追加 + caveat C2 §F
Q1 標題未升版號）。對齊 plan v3 leaf-fetch 之 r1→r2 階段（v3 leaf-fetch 在 r2 仍有 5
substantive findings 待修），故 v2 對齊度與 v3 leaf-fetch r2 同級、足以 APPROVE w/
caveats 進 Critic Round 2。

★ 與 v3 leaf-fetch 之差異（無體例懲罰）：
  - 修訂歷史多 1 輪（v1→v2→v3 vs v1→v2）— 因 v3 leaf-fetch 走過 Critic ITERATE 一輪、
    本 plan 仍未進 Critic — 屬正常進度
  - Step 0 門檻收緊到 < 1%（v3 leaf-fetch < 3%）— 因 F2 對 36% 前車的內化更嚴 —
    不算偏離體例、屬計畫獨立決策
```

---

## 7. 剩餘 antithesis（如有）

### A9（中度，~30~40% 觸發）：mode 1 caller-side break 強制終止 for-bounces 迴圈會偏移 T_NEE 估值

**主張**：v2 §D Step 1A-1.5 設計 mode 1 caller-side 10 處 break 強制退出 for-bounces
迴圈，業務語義為「跳過 NEE primary call + caller-side ALU + secondary BVH 走訪」。但
此 break 額外跳過後續 14 - bounces 個 iteration 的「primary BVH + Material + 後續
NEE」全段。

```
v2 差分公式：T_NEE := T_baseline - T_no_NEE = ΔNEE
mode 0 baseline 跑「14 個 iteration 全」（受 uMaxBounces 限制）
mode 1 跑「直到第 N 個 iteration 命中 NEE dispatch caller-side break」
mode 1 = mode 0 之 ΔT 不僅含「NEE primary call」、還含「跳過後續 iteration 全段」

實際業務語義：
  T_NEE (mode 1 measured) = NEE primary + caller ALU + (Skip future bounces) [BVH +
                            Material + NEE]

而 plan v2 §A.2 D1（line 105-108）寫 T_NEE = sampleStochasticLightDynamic 函式體 +
caller-side ALU、不含 future bounces。差距會讓 T_NEE 估值嚴重高估（高 30~50% 取決於
平均 bounce 深度）。
```

**證據**：
```
shader L1818-1824（典型 caller 結構，DIFF 分支內）：
    rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx);
    mask *= weight * uLegacyGain;   // mode 1 break 之前
    sampleLight = TRUE;
    misWPrimaryNeeLast = neePdfOmega;
    misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
    lastNeePickedIdx = neePickedIdx;
    continue;

mode 1 caller-side break 在 sampleStochasticLightDynamic 呼叫之後加 break →
強制退出 for-bounces 迴圈。bounces == 0 即 break 等於只跑 1 個 iteration、
不跑剩餘 13 個 iteration。

shader L963 for (int bounces = 0; bounces < 14; bounces++) → mode 0 一般跑 ~3~5 個
iteration（Russian roulette + uMaxBounces）；mode 1 break 跑 1 個。
ΔT (mode 0 - mode 1) ≈ NEE primary + 2~4 個額外 iteration 之 BVH + Material 全段
```

**評估**：A9 是 v2 §D Step 1A-1.5「caller-side 10 處 break」設計的根本問題。Round 1
A6 建議「caller 端在每處 NEE dispatch 後加 if (uSegmentMode == 1) { mask = vec3(0);
break; }」— 但 break 的副作用是「跳過後續 iteration」未被 v2 §A.2 D1 業務語義段補述。

實作上有兩個選擇：
```
選項 1：保留 break 設計（v2 當前）
  T_NEE (estimated) = NEE primary + caller ALU + (skip future) [BVH + Material + NEE]
  業務語義：「mode 1 = path tracing 退化為單 bounce primary-only-with-NEE-zeroed」
  Stage B 升 Option 3 #ifdef 仍同樣面臨此問題（#ifdef SKIP_NEE 區段同樣 break 出迴圈
  / 或設 mask=vec3(0) + continue 不 break）

選項 2：改 mask = vec3(0) + continue（不 break）
  T_NEE (estimated) = NEE primary + caller ALU + (mask=0 後續 iteration 仍跑但 emission
                     全乘 0) [BVH + Material]
  業務語義：「mode 1 = NEE 函式體 + caller ALU 不跑、其餘走訪照跑但 mask=0 累加為零」
  T_NEE 估值更接近 plan v2 §A.2 D1 業務語義（不含 future bounces 額外時間）
  但 caller-side ALU（mask*=weight, sampleLight=TRUE, MIS state update）仍跑（因僅
  mask = vec3(0) 不切走 ALU）→ T_NEE 估值偏低
  改善：除 mask=0 外、改用一個額外 uniform 控制 sampleLight = FALSE 等 state

選項 3：caller 端在 sampleStochasticLightDynamic 之前加 if (uSegmentMode == 1) continue;
  跳過整個 NEE dispatch 區段（呼叫 + caller-side ALU）但保留 for-bounces 走訪
  T_NEE (estimated) = NEE primary + caller-side ALU 全段（不含 future bounces 衝突）
  最接近 plan v2 §A.2 D1 業務語義
  但每 iteration 都會再次進入 `if (hitType == DIFF)` block 之 NEE dispatch 後直接 continue
  跳到下個 iteration → secondary BVH 仍跑（與 mode 1 入口 early-return 同樣問題）
```

選項 2/3 都比 v2 當前選項 1 更精準 — 但 Round 1 A6 建議的就是選項 1。Round 2
Architect 評估：選項 1 工程最簡（caller-side 10 處統一插 break）、選項 2/3 需設
計 sampleLight + MIS state 等多 uniform、複雜度高 ~3 倍。

選項 1 的 T_NEE 高估副作用是「業務語義打折扣」之延伸 — Stage A 已接受打折扣、選項 1
的高估會讓「T_NEE 占比 vs Phase 1.0 §1 ≤ 12%」偏差變大（測得 18%~25% 而非預期 12%、
偏差 50%~108%、可能觸發 Test E2'-c Stage A ≤ 50% acceptance）。

**修改建議**：v3 在 §A.2 D1 補述 selection：
```
選項 1（v2 當前 break 法）：
  T_NEE 包含「跳過後續 iteration 之 BVH + Material + NEE 累積成本」
  Stage A 偏差 ≤ 50% 容許範圍可能不夠（實證測得 ≥ 50% 偏差時自動升 Stage B）
  Stage B 用 #ifdef SKIP_NEE 完全切離（同樣 break 法、但編譯時無 uniform branch）

選項 2/3：保留為 v3 補強選項、Critic 評估後再決定是否切換
```

或 v3 在 Test E2'-c 加 acceptance 收緊：「Stage A 偏差 ≤ 100%（業務語義打折扣 + caller-
side break 高估雙效應疊加、放寬到 ≤ 100%）」。→ 留 Critic 處理。

**屬輕度新 antithesis**（不致命、Stage B 升級可解、Stage A 接受打折扣下仍可進）。

### A10（輕度，~10~20% 觸發）：Stage B mode 0 build (BUILD_BASELINE) AE = 0 假設可達性

**主張**：v2 §C.2 Test I2 Stage B Assert 寫「BUILD_BASELINE vs Phase 1.0 baseline
AE = 0（編譯時等價、無 codegen 差異）」。但 BUILD_BASELINE 是 plan v2 新引入的 build
target、即使 #ifdef SKIP_NEE / SKIP_AFTER_HIT 都未定義、shader 程式碼源檔仍與 Phase
1.0 baseline 不同（多了 #ifdef ... #endif 包夾）。

ANGLE 編譯器是否對「shader 源檔多了 #ifdef wrapping」做不同 codegen？理論上 #ifdef
被預處理消除後、HLSL/Metal IR 應與 baseline 相同 — 但實證未驗。

**證據**：
```
v2 §B Scenario 7 (line 657-660) 自承：
  「c. ★ Stage B 自身 probe overhead（不同 build 之 fragment shader 程式碼差異本身就
       可能讓 ANGLE 對 mode 0 build 做不同最佳化）」
  → v2 已點出此風險、但未量化機率
```

**評估**：屬已知風險、v2 §B Scenario 7 已寫 detection / rollback。觸發機率約 10~20%
（ANGLE 對 #ifdef 後預處理產出的 HLSL 通常一致、但 erichlof framework 的 #include 巨
集系統介入後會引入變數）。Architect 評估：BUILD_BASELINE 預期 100% pass AE = 0 的信
心高、但若 fail 屬 Scenario 7 路徑、v2 已有處理。

**屬輕度新 antithesis**（v2 已內化、不需修改）。

---

## 8. 對 Planner v3 的具體修改要求清單

### 8.1 caveat C1 修（必修，但不阻擋 APPROVE → Critic Round 2 接力）

```
C1-1. open-questions.md 同步追加 Q10 + Q11
     位置：open-questions.md §「R6-2 桶 4 F2 三段 timer 拆解 — 2026-04-27（Planner v1）」
     段內、Q9 之後
     新增 Q10「ANGLE Metal AE 軟化是否合理」（plan v2 §F line 1411-1414 全文遷移）
     新增 Q11「mode 2 emission 預載是否污染 T_after_first_hit」（plan v2 §F line 1416-1419
            全文遷移）
     同步把 §F 標題從「Planner v1」改為「Planner v2」

C1-2. plan v2 §F 標題從「給 Architect / Critic 處理」維持不變、但加註「（v2 同步至
     open-questions.md）」說明與 open-questions.md 對齊
```

### 8.2 caveat C2 修（必修，編輯瑕疵）

```
C2-1. plan v2 §F Q1 開頭補一句「★ v2 修訂：原 v1 字面 L257-263 改為 L262 後 / L263 前
     精確描述（Architect r1 SR1 閉鎖）」、避免讓未讀過 r1 的人誤解
```

### 8.3 caveat C3 修（建議修，編輯一致性）

```
C3-1. plan v2 §A.3 Option 1 Pros 「shader 修改有限（uniform + 13 個 if + 12 個 early
     return/break，純 instrumentation）」 — 「12 個 early return/break」應改為精確描
     述「11 個 early break + 1 個 conditional emission accumulation + 1 個 entry early-
     return」
```

### 8.4 §B Scenario 3 三層判斷重疊釐清（建議修，邏輯一致性）

```
v2 line 938-940 寫：
  - C1/C2/C4 全 |Δ| < 1% → 合格
  - 任一 1% ≤ |Δ| < 3% → 警告
  - 任一 |Δ| ≥ 1% → ★ v2 修訂：自動升 Stage B（不 fail-fast）

第 2 條（1%~3% 警告）與第 3 條（≥ 1% 升）字面重疊。應釐清為：
  - C1/C2/C4 全 |Δ| < 1% → 合格、進 Stage A Step 1A
  - 任一 1% ≤ |Δ| < 3% → 警告繼續 Stage A、§C.5 註明「< 5% 段不可信」
  - 任一 |Δ| ≥ 3% → 自動升 Stage B（不 fail-fast）

或選擇相反：1% 即升、警告帶取消（更嚴格）。
v3 須二擇一明確化。
```

### 8.5 §C.3 Test E2'-d acceptance 量化（建議修）

```
v2 line 786-789 寫「不同號為大警告」— 「警告」非 fail。
建議改寫：「同號為通過（pass Test E2'-d）；不同號為 Scenario 1 嫌疑（評估升 Stage B
           或 fail-fast 退場）」
```

### 8.6 §B Scenario 7 detection acceptance 量化（建議修）

```
v2 line 663-666 寫「用 spectorJS dump 確認 baseline 與 SKIP_NEE build 之 HLSL 程式碼
                  差異 ≥ 預期」— 「≥ 預期」未量化。
建議改寫：「SKIP_NEE build HLSL 行數比 baseline 少 ≥ 30%、或 sampleStochasticLightDynamic
           函式定義消失」之類具體 acceptance
```

### 8.7 mode 2 emission 累加範圍擴大（建議修，視覺驗對齊）

```
v2 §D Step 1A-2 line 1012-1015 切法：
  if (uSegmentMode == 2) {
      if (bounces == 0 && hitType == LIGHT) accumCol += mask * hitEmission;
      break;
  }

建議擴大累加範圍至 4 個發光 hitType：
  if (uSegmentMode == 2) {
      if (bounces == 0 && (hitType == LIGHT || hitType == TRACK_LIGHT ||
                           hitType == TRACK_WIDE_LIGHT || hitType == CLOUD_LIGHT))
          accumCol += mask * hitEmission;
      break;
  }

理由：v2 §C.2 Test I4 (b) 「光源直視點 RGB > 200/255」對 LIGHT OK 但 TRACK_LIGHT 直視
     fail（mode 2 切點僅累加 LIGHT、其他 emitter 全黑）；Cam 1 視場含軌道燈、Test I4
     可能誤 fail。
```

### 8.8 Stage A → Stage B 切換時 baseline 路徑分流（建議修）

```
v2 §D Step 1A Stage B Action 補 1A-4B：
  「Stage A test-runs/f2/ 16 張 mode 0 build 圖棄；Stage B 重拍 BUILD_BASELINE 16 張
   到 .omc/test-runs/f2-stageB/、對 .omc/baselines/phase-1.0/ AE = 0 嚴格驗」
```

### 8.9 caller-side break 業務語義副作用補述（建議修，A9 對應）

```
v2 §A.2 D1 補述：
  「★ caller-side break 副作用：mode 1 caller-side break 強制退出 for-bounces 迴圈，
   T_NEE 估值含『跳過後續 iteration 之 BVH + Material 累積成本』、實際偏高 30~50%
   取決於平均 bounce 深度。Stage A 業務語義打折扣下接受此偏差；Test E2'-c 偏差 ≤ 50%
   容許範圍可能不夠、實證測得 ≥ 50% 偏差時自動升 Stage B（Stage B #ifdef SKIP_NEE
   之 break 法同樣面臨此問題、但編譯時無 uniform branch、ANGLE codegen 預期較穩定）。」
```

---

## 9. Round 2 結論

```
Verdict：APPROVE w/caveats
Round 1 5 致命 must-fix：5/5 全閉鎖
Round 1 4 應修 SR：4/4 全閉鎖
v2 新增段落（Scenario 7 / Test E2' / Q9-Q11 / ADR 6 路徑）：站得住 ✓
親自驗證行號（13 錨點）：13/13 對 ✓
plan v3 leaf-packing 體例對齊度：92%（v1→v2 階段同級）

caveat 3 條（不阻擋 APPROVE）：
  C1：open-questions.md 未追加 Q10/Q11 + §F 標題未升版號（同步落後）
  C2：plan v2 §F Q1 開頭未標 v2 修訂註腳（編輯瑕疵）
  C3：plan v2 §A.3 Option 1 Pros「12 個 early return/break」描述模糊（編輯瑕疵）

Round 2 新 antithesis：
  A9（輕度）：caller-side break 強制終止 for-bounces 副作用 → T_NEE 估值偏高 30~50%
  A10（輕度）：Stage B BUILD_BASELINE AE = 0 之 ANGLE codegen 假設可達性

對 Planner v3 的具體修改要求（給 Critic Round 2 接力）：
  8.1 C1 修（open-questions.md 同步）— 必修
  8.2 C2 修（§F Q1 標 v2）— 必修
  8.3 C3 修（編輯一致性）— 建議
  8.4 §B Scenario 3 三層判斷重疊釐清 — 建議
  8.5 §C.3 Test E2'-d acceptance 量化 — 建議
  8.6 §B Scenario 7 detection acceptance 量化 — 建議
  8.7 mode 2 emission 累加範圍擴大 — 建議（視覺驗對齊）
  8.8 Stage A→B baseline 路徑分流 — 建議
  8.9 A9 caller-side break 副作用補述 — 建議

下一步：本報告寫畢、進 Critic Round 2。Critic 應接力檢查 caveat C1/C2/C3 + 處理 A9/A10
+ 最終 verdict（IGNORE / ITERATE / OPPOSE / 升 ITERATE）。
```

---

## 修訂歷史

- 2026-04-27 r2 初版（Architect Round 2 review，APPROVE w/caveats）
