# F2 Plan v1 — Architect Review Round 1

> 模式：Deliberate consensus
> Round: 1
> Reviewer: architect agent (opus)
> 日期：2026-04-27
> 對象：`.omc/plans/R6-2-bucket4-F2-timer-breakdown.md` v1（Planner Round 1，1063 行）
> 結論：**REVISE**（5 條 must-fix 致命級 + 4 條應修）

---

## 1. Verdict

**REVISE**

不能 APPROVE 的核心理由（單條即可阻擋）：

```
M1. mode 1 early-return 機制錯誤：return nl + throughput=0 不等於「不發射 NEE」，
    會讓 caller 把 nl 設成 rayDirection、下一個 bounce 仍走 SceneIntersect，
    secondary BVH 反而照跑 → 差分公式無法切離「NEE 連帶 secondary BVH」段。
    這直接打死 plan §A.3 Option 1 Cons 第一條「mode 1 砍 NEE 連帶砍 secondary BVH」
    的核心假設（assumption）。

M2. mode 2 break 點切錯：在 L1800 後 / L1802 前 break，只關 DIFF 一支，
    SPEC（L1828）/ FRESNEL / METAL 分支仍跑 → mode 2 不是「skip-Material」，
    而是「skip-DIFF-and-NEE-dispatch」。Material BRDF 段切離不完整。

M3. Scenario 3 probe overhead 容忍度過樂觀：Phase 1.5 Step 2 step0-noop §2
    實證「探針 baseline 拖慢 36%」前車。plan §B Scenario 3 「< 2% 合格 /
    < 5% 警告 / ≥ 5% fail-fast」門檻對 36% 級風險太鬆，等同 Phase 1.5 v3
    教訓未內化。

M4. Test E2 守恆驗是代數恆等式假象：T_BVH + T_NEE + T_BRDF == T_baseline ± 5%
    為差分公式必然成立的恆等式（代數證見 §6.4），± 5% 只反映量測噪音，
    不能偵測「切點業務語義錯」。plan §C.3 把它列為 Scenario 1 的偵測手段
    是把噪音檢測誤包裝成語義驗證，會讓 Scenario 1（30~40% 機率）的真實
    bug 漏網。

M5. SceneIntersect 機制描述錯誤：plan §A.2 D1 寫「BVH = SceneIntersect 整個
    函式 + 含 NEE shadow ray 的二次 SceneIntersect 呼叫」。實證 grep
    `SceneIntersect\(` 全 shader 只有 1 次呼叫（L969，在 for-bounces 迴圈內）。
    NEE shadow ray 不是另一次呼叫，而是下一輪 bounce iteration 的同一個
    L969 呼叫。「業務語義」描述對，「實作機制」描述錯，兩者區分對 v2 的
    Q1 行號重寫至關重要。
```

REVISE 含義：v2 必須對 M1~M5 提出具體修正方案，不是補幾段文字註腳；M1/M2 涉及 §D Step 1A 切點重寫。

---

## 2. Antithesis（依機率/嚴重度排序）

### A1（致命，> 90% 觸發）：mode 1 early-return 不切離 secondary BVH

**主張**：plan §A.3 Option 1 描述 mode 1 = 「在 sampleStochasticLightDynamic 入口 early-return nl + zero throughput → 等同關 NEE，僅留 BVH + Material；NEE shadow ray 的二次 SceneIntersect 也連帶被跳（sampleLight=FALSE）」。但實作上 early-return 之後 caller 的下一行：

```glsl
shaders/Home_Studio_Fragment.glsl L1818-1820（與 L1264 / L1302 / ... 共 10 處同構）：
    rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx);
    mask *= weight * uLegacyGain;
    sampleLight = TRUE;
```

mode 1 return nl → `rayDirection = nl`（朝法線方向）；`weight = (0,0,0)` → `mask *= 0`（變黑）；但 `sampleLight = TRUE`。

下一輪 for 迴圈 iteration 仍跑 `t = SceneIntersect()`（L969），ray 仍走 BVH 走訪。**secondary BVH 沒有被砍**，只是命中後 `mask` 已是 0、emission 累加為零。

T_BVH 段業務語義 = 「primary BVH」+「NEE shadow secondary BVH」之 plan 假設，與實作行為不一致：mode 1 砍掉的是「sampleStochasticLightDynamic 內的 PDF 計算」+「accumCol 累加」，沒砍 secondary BVH 走訪。

**證據**：
- shader L1818-1824（caller 結構）
- shader L260-262 / 263-268（mode 1 模仿的 sentinel/active-count guard 結構）
- shader L969（唯一 SceneIntersect 呼叫點）
- shader L963（`for (int bounces = 0; bounces < 14; bounces++)`）
- shader L257-262（uR3ProbeSentinel guard 已採同樣 return nl + throughput=0 模式，可作 baseline 行為驗證點）

**Planner 既有應對**：plan §A.3 Option 1 Cons 第一條已寫「mode 1 跳掉會減少 secondary BVH」業務語義註腳；Scenario 1 成因 c 寫「業務語義對齊問題不算 bug、改報告寫法」。

**評估**：應對不充分。「業務語義」與「實作機制」的差距讓 plan 自己宣稱的「primary BVH 走訪」被高估（mode 1 baseline 仍含 secondary BVH，等於沒切離）；T_NEE 估值會等同「sampleStochasticLightDynamic 函式體內的 ALU + accumCol 累加」，**遠小於 plan 預期的「NEE primary call + secondary BVH」總和**。Phase 1.0 §1 推估「光源 NEE ≤ 12%」是「全 NEE 路徑」（含 shadow ray BVH），Test O2 交叉驗會給出嚴重不一致數據（plan §F Q4 暗示處理但未解）。

**修改建議**：v2 必須三選一：
1. **重寫 mode 1 機制**：在 caller 端（10 處 NEE dispatch 站）加 `if (uSegmentMode == 1) { rayDirection = vec3(0); break; }` — 真正 break 出 for 迴圈、徹底跳過 secondary BVH。但會跳過 mask 衰減後續、視覺崩潰風險升。
2. **接受業務語義不完美**：T_NEE = sampleStochasticLightDynamic 函式體 ALU 成本（不含 secondary BVH）。secondary BVH 仍歸 T_BVH。但這要求 plan §A.4 期望輸出公式重寫、Test O2 交叉驗門檻放寬。
3. **改用 N+1 build 法 (Option 3)**：編譯時 `#ifdef SKIP_NEE` 把整個 NEE dispatch 區塊（L1818~L1824 等 10 處）+ caller 的 `t=SceneIntersect()` 後續處理徹底切。工程 +1.5 hr。

### A2（致命，~80% 觸發）：mode 2 break 不切完 Material 全部分支

**主張**：plan §D Step 1A-2 寫「在 hitType == DIFF L1773 分支內、L1800 之後 / L1802 之前加 `if (uSegmentMode == 2) break;`」。但 shader L1773-1826 是 `if (hitType == DIFF)` block，break 跳出 for 迴圈（不是 if 區塊）。實際 shader 在 L1828 之後還有：

```glsl
1828:    if (hitType == SPEC) { ... }
1860+:   if (hitType == REFR) { ... }
1900+:   if (hitType == COAT) { ... }
... 多個 hitType 分支
```

mode 2 只在 hitType==DIFF 命中時觸發 break；如果 primary ray 命中 SPEC（hitObjectID 是金屬鏡面 / 玻璃），mode 2 行為等於 mode 0。

**plan 自己的描述（§A.2 D1）**：「Material BRDF = CalculateRadiance 主迴圈 material switch + bounce 路徑（L1013-1838 內，扣除 SceneIntersect 與 sampleStochasticLightDynamic 呼叫之外的時間；含 hitType 分支、Fresnel、metalness mix、cosWeightedHemisphere、diffuseBounce state）」。

mode 2 切點 L1800-1802 涵蓋的只有 DIFF 分支內的 mask 累加 + diffuseBounce setup + NEE dispatch；SPEC（L1828+）/ REFR / COAT / 其他材質分支完全沒砍。

**證據**：
- shader L1773（`if (hitType == DIFF)` 起點）
- shader L1826（DIFF 分支結尾 `}`）
- shader L1828（`if (hitType == SPEC)` 起點 — 跳過 DIFF 之後仍會被執行）
- shader L1858（CalculateRadiance 結尾 `}`，主 if-else 樹結束在 L1858 之內）

**Planner 既有應對**：plan §A.2 D1 末段「保留首次 hit 的 first-bounce 累加正確性、跳過 NEE dispatch + state cache + diffuse bounce ray」— 描述涵蓋對的範圍，但實作 break 點選錯。Scenario 1 成因 e 提及 12+ hitType 分支，但沒連結到 mode 2 切點的不完整覆蓋。

**評估**：嚴重不足。primary ray 命中金屬地板 / 牆面 / 鏡面（hitObjectID=1 isFloor + Fresnel reflective + per-box metalness 等）皆走 SPEC 路徑；mode 2 = mode 0 行為對這些 ray = T_BRDF 估值 = 0（看似零成本）。實際場景 C1/C2/C4 含吸頂燈金屬反射、金屬軌道燈 housing、地板 dielectric Fresnel 反射，T_BRDF 占比會嚴重低估（差分剩餘吃進 T_BVH）。

**修改建議**：v2 必須改 mode 2 切點為「在 SceneIntersect 命中後、material switch 開始之前」early-return CalculateRadiance：

```glsl
位置：shader L969 之後（t = SceneIntersect() 完）、L1013（hitType==LIGHT 分支）之前
    if (uSegmentMode == 2) {
        if (bounces == 0) accumCol += mask * hitEmission * float(hitType == LIGHT || hitType == TRACK_LIGHT || hitType == CLOUD_LIGHT);
        break;
    }
```

或乾淨地 `if (uSegmentMode == 2) break;` 切在 L971（hitType detect 之後、所有 material 分支之前），但需面對 first-hit emission 累加缺失問題（畫面全黑，業務語義變「skip-everything-after-first-hit」非 skip-Material）。

兩條都會改 plan §A.2 D1 對 T_BRDF 業務語義的定義，且需重新評估與 Phase 1.0 baseline 之 cross-check 可行性。

### A3（高，~70% 觸發）：probe overhead 門檻過於樂觀（Phase 1.5 前車 36% 教訓未內化）

**主張**：plan §B Scenario 3 設「Δ < 2% 合格 / 2~5% 警告 / ≥ 5% fail-fast」，但 Phase 1.5 Step 2 step0-noop 報告 §2 實證：

```
.omc/REPORT-R6-2-Phase-1.5-Step2-step0-noop.md §2 第 33-34 行：
"baseline (uForceFullFetch=1.0) 量到 21.96 spp/sec，但 Phase 1.0 Fast-builder
baseline 是 34.30 spp/sec → 探針本身（fetchBoxData 內 gate_passed 計算成本）
拖慢 baseline 36%。"
```

前車「ternary + boolean gate 計算」探針即拖慢 36%。本計畫 mode 1 / mode 2 的 if 分支也是「uniform fetch + integer compare + branch」結構，同類風險。「< 5% 即 fail-fast」門檻被前車打穿—36% 不是「警告級」是「災難級」。

**證據**：step0-noop §2 對照表 / step0-noop §6 對齊「Architect A3 quad-divergence 風險」前置教訓。

**Planner 既有應對**：plan §B Scenario 3 預期觸發機率 15~25%、提供 R1 (升 Option 3) / R2 (退場) 雙 rollback。

**評估**：機率估太低。前車已驗 36%；本計畫雖然 if 結構稍簡（無 ternary 抽取 + 無 fetchBoxData 結構搬遷），但：
- mode 1 在 sampleStochasticLightDynamic 入口加 if，與 fetchBoxData 內 gate 同層級 instruction
- ANGLE Metal 已實證對 uniform branch 偏向 select() 編譯（plan §B Scenario 3 成因 b 自己提到，但機率估只給 15~25%）

實際機率估應升到 50~70%。Step 0 fail-fast 觸發是常態，不是邊緣狀況。

**修改建議**：v2 §B Scenario 3 升級：
1. 觸發機率改 50~70%（內化前車 36% 教訓）
2. 「< 2% 合格」改「< 1% 合格」（前車 0.98% 已是雜訊邊緣）
3. 警告帶縮小到 1~3%
4. ≥ 3% 進警告 / ≥ 5% fail-fast（壓力測試）
5. R1 (升 Option 3) 升為「預設路徑」、R2 (退場) 為次選 — 因 Option 3 工程僅 +1.5 hr，相比 Step 1A~1E 9 hr，賭一發合理

### A4（高，~60% 觸發）：Test E2 守恆驗為代數恆等式、不能偵測切點誤插

**主張**：plan §C.3 Test E2 寫「T_BVH + T_NEE + T_BRDF ≈ T_baseline ± 5% 失敗 → 進 Scenario 1 rollback 評估」。代數展開：

```
定義：
    T_baseline = T_full
    T_no_NEE = T_full - ΔNEE  （mode 1 早 return 省下的時間）
    T_no_Material = T_full - ΔMaterial
    T_NEE := T_baseline - T_no_NEE = ΔNEE
    T_BRDF := T_baseline - T_no_Material = ΔMaterial
    T_BVH := T_no_NEE + T_no_Material - T_baseline
           = (T_full - ΔNEE) + (T_full - ΔMaterial) - T_full
           = T_full - ΔNEE - ΔMaterial
           = T_baseline - T_NEE - T_BRDF

加總：
    T_BVH + T_NEE + T_BRDF = (T_baseline - T_NEE - T_BRDF) + T_NEE + T_BRDF = T_baseline ✓ 恆成立
```

**這是純代數恆等式**，無論 mode 1/2 切點多錯、業務語義多偏，加總都會等於 T_baseline。± 5% 範圍內的誤差只反映三次量測的獨立噪音，不反映業務語義錯誤。

換言之，Test E2 通過 ≠ 切點對；Test E2 失敗 ≠ 切點錯。

**證據**：plan §A.3 Option 1 差分公式（lines 152-156）。簡單代數驗算。

**Planner 既有應對**：無；plan 把 Test E2 包裝成 Scenario 1（probe 點切錯）的偵測手段。

**評估**：嚴重誤導。Scenario 1 是 plan 自評最高觸發機率（30~40%）的場景；偵測它的主力（守恆驗）卻是恆等式。M1+M2 致命已舉例：mode 1/2 切點切錯，T_NEE / T_BRDF 估值偏差，但守恆仍成立。Test E2 通過 → false confidence。

**修改建議**：v2 §C.3 Test E2 重寫：
1. 移除「守恆驗」標題（誤導）
2. 改名「噪音上限驗」並明確標註「此 test 通過僅證明三次量測噪音穩定，不證明切點業務語義對」
3. 補入新的 Test E2'（業務語義驗）：
   - 對 mode 1：grep 確認 sampleStochasticLightDynamic 內 early-return 之後仍跑了 0 行 NEE 計算（用 spectorJS dump HLSL 確認）
   - 對 mode 2：實測 mode 2 拍 1024-spp Cam1 + Cam3，預期「黑屏 + 光源直視點亮 + 金屬鏡面正確（若 mode 2 不切 SPEC）」三條件
   - 對 mode 1：實測 mode 1 拍 1024-spp Cam1，預期「無光斑 + 全靠 BSDF bounce 命中 emitter 變很暗」
4. 加入交叉驗：T_NEE 占比 vs Phase 1.0 §1 ≤ 12% 偏差 > 50% → 標 Scenario 1 嫌疑（不一定 fail，但提示業務語義對齊問題）

### A5（高，~70% 觸發）：plan §F Q1 行號 L257-263 / L1800-1802 與實際 shader 結構錯配

**主張**：plan §F Q1 寫「mode 1 在 sampleStochasticLightDynamic L257-263 之間 early-return」。實際 shader：

```
L253:  vec3 sampleStochasticLightDynamic(...)
L254:  {
L255:  // R3-6.5 S2.5：DCE runtime-impossible guard
L256:  // uR3ProbeSentinel runtime 恆 1.0；手動設 -200 觸發 sentinel 分支驗證 DCE 未 strip
L257:      if (uR3ProbeSentinel < -100.0) {
L258:          pickedIdx = -42;
L259:          throughput = vec3(0);
L260:          pdfNeeOmega = 1e-6;
L261:          return nl;
L262:      }
L263:      if (uActiveLightCount <= 0) {
L264:          throughput = vec3(0);
L265:          pdfNeeOmega = 1e-6;
L266:          pickedIdx = -1;
L267:          return nl;
L268:      }
```

「L257-263 之間」字面上指 L258-262 區間，但 L258-262 是 sentinel guard 的內部，不是兩個 guard 之間。plan §D Step 1A-1 明確寫「在既有 uR3ProbeSentinel guard L257 與 uActiveLightCount guard L263 之間」— 這語法上指 L262 之後 / L263 之前，即「sentinel guard `}` 之後、active count guard `if` 之前」。

兩處描述不一致：§F Q1 寫「L257-263 之間」（內含），§D Step 1A-1 寫「L257 sentinel 與 L263 active count 之間」（兩 guard 之間）。實作位置應是後者（L263 行前），plan §F Q1 行號應改寫為 L262-L263 之間或「L262 之後」。

**證據**：shader L257-268 實際結構（已 Read 驗證）。

**Planner 既有應對**：無；§F Q1 列為 Architect 評審項。

**評估**：行號描述不精確雖屬編輯瑕疵、不致命，但本是 Open Question 留給 Architect 評。本 review 直接給定：「mode 1 切點應在 L262 後 / L263 前」，並建議 v2 §F Q1 改寫為具體選擇（接受/反對 caller-side 切法，若接受 caller-side 則行號會改 L1818 + 9 處同構站全改）。

至於 L1800-1802：實際 L1800 是 `mask *= hitColor;`，L1801 空行，L1802 是 `bounceIsSpecular = FALSE;`。plan §D Step 1A-2 寫「位置：在 L1800 之後、L1802 之前」字面對。但 M2 已論證 L1800-1802 切點業務語義錯，因此即便行號精確，仍須改切點位置。

**修改建議**：v2 §F Q1 與 §D Step 1A-1/1A-2 統一行號描述格式，且依 M1/M2 結論重寫切點位置。

### A6（中，~50% 觸發 — Architect 新增）：mode 1 入口切點漏多 NEE dispatch 站

**主張（新 antithesis）**：plan §D Step 1A 設計只在 sampleStochasticLightDynamic **入口**（L262 後）加 mode 1 early-return。但 caller 端 10 處 NEE dispatch 站（L1264、L1302、L1350、L1402、L1510、L1549、L1610、L1655、L1764、L1818）的下游邏輯：

```glsl
caller 結構（以 L1818-1824 為例）：
    rayDirection = sampleStochasticLightDynamic(...);  // mode 1 return nl, weight=0
    mask *= weight * uLegacyGain;                       // mask 變零
    sampleLight = TRUE;                                  // ← 仍設 TRUE！
    misWPrimaryNeeLast = neePdfOmega;
    misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
    lastNeePickedIdx = neePickedIdx;
    continue;
```

問題 1：`sampleLight = TRUE` 仍被設定 → 下一輪 bounce 命中 emitter 時走 NEE-hit 分支（L1023 `else if (sampleLight == TRUE)` 等 7 處），accumCol 累加邏輯被觸發，但因 mask 已是 0、累加為零。**邏輯路徑仍跑（包含分支判斷成本）**。

問題 2：`misWPrimaryNeeLast` / `misPBsdfNeeLast` / `lastNeePickedIdx` 仍被更新 → MIS state 被「假 NEE」污染。下一輪 bounce 真的命中 emitter 時，MIS 用此 state 算 reverse-NEE PDF / heuristic w_bsdf — **計算成本仍跑、結果無業務意義**。

問題 3：**部分 NEE 計算（cosWeightedPdf 等）仍在 caller 端跑**，沒被 mode 1 切離。

T_NEE 估值會偏低（caller-side 開銷未切）；Scenario 1 成因 b 「sampleStochasticLightDynamic 內的 pdfNeeForLight 算進 Material → 屬 NEE 端」描述對，但 plan 沒處理 caller-side ALU。

**證據**：
- shader L1818-1824（典型 caller 結構）
- shader L1264-1267 / L1302-1305 / L1350-1353 / L1402-1405 / L1510-1513 / L1549-1552 / L1610-1613 / L1655-1658 / L1764-1767 共 9 同構站

**修改建議**：v2 必須增列 mode 1 caller-side 處理：
1. 選 A：caller 端在每處 NEE dispatch 後加 `if (uSegmentMode == 1) { mask = vec3(0); break; }` — 切到 break 出迴圈
2. 選 B：accept caller-side ALU 留在 T_NEE 估值內，但需在 §A.2 D1 補述「T_NEE 含 sampleLight=TRUE 後續分支判斷 + MIS state update」

### A7（中，~50% 觸發 — Architect 新增）：mode 1 視覺驗 (Test I3) 預期不夠精確、mode 1 Cam1 1024-spp 可能與 mode 0 像素差異 < AE 閾值

**主張（新 antithesis）**：plan §C.2 Test I3 寫「mode 1 build 拍 1 spp Cam1 截圖、預期『畫面顯著比 mode 0 暗（NEE 全關，僅靠 BSDF bounce 命中 emitter）』；不黑屏；allow eyeball check」。

問題：
1. 1 spp 截圖噪音極大（path tracing 1 spp = 隨機亂點），「顯著比 mode 0 暗」eyeball check 不可信
2. mode 1 砍 NEE 但 BSDF bounce 仍能命中 emitter（隨機 cosine weighted hemisphere 14 bounces 內，命中 ceiling lampQuad / Cloud 機率高） — Cam1 是吸頂燈正下方視角、emitter 占視場大、BSDF bounce 命中率高 → 收斂到的能量不一定明顯比 mode 0 暗
3. NEE 主要降低噪音，不必然降低收斂後的能量總量。1024-spp 收斂後 mode 1 vs mode 0 的能量差異可能 < 5% pixel value

**證據**：
- Phase 1.0 §1 推估 NEE ≤ 12% spp/sec 成本（時間維度）
- ceiling lampQuad 對 Cam1 視場占比 ~30~40%（從 Cloud_Light_Calculation.md / R3-6 ref 截圖反推）

**修改建議**：v2 §C.2 Test I3 改：
1. 截圖 1024-spp（不是 1 spp）
2. 預期「Cam1 視場內陰影區（家具背面、地板暗角）顯著噪音變大但能量近似」+「光斑邊緣（落影）變模糊」
3. acceptance 改「直方圖中位數差距 ≥ X%」之類量化，不依 eyeball
4. mode 2 同理 — 1 spp 太噪音，改 1024-spp + 量化 acceptance

### A8（中，~30% 觸發 — Architect 新增）：query pool size 8 推測對 ANGLE Metal 過度樂觀，無實證

**主張（新 antithesis）**：plan §F Q9 「EXT_disjoint_timer_query_webgl2 query pool 大小 — 當前推測 8（ANGLE/Metal 限制）」。Phase 1.5 Step 1 SAH rollback / Step 2 step0-noop 兩份 report 都未驗 query pool size 上限。2026-04-27 探針只驗了 ext_supported / api_runs / 單個 query 結果，**沒查 pool size**。

ANGLE Metal 對 EXT_disjoint_timer_query 的 in-flight query 數量限制不公開；Khronos 規範未硬性規定（驅動可選 1~∞）。Apple Metal 一般對 MTLCounterSampleBuffer 的 max sample count = 32 或更高（依 GPU family），但 ANGLE 包裝層可能更嚴。

**證據**：
- step0-noop §1 結論一句話寫「leaf packing 對 spp/sec 提升上限 ≤ 1%」，但未涉及 timer pool size
- plan §A.2 D2 寫「已驗 EXT_disjoint_timer 在 M4 Pro Metal/ANGLE 支援」— 已驗的是 ext + 單 query；沒驗 pool

**修改建議**：v2 §D Step 0 加 0-2.5：「query pool size 探測 — 對 ANGLE Metal 開 1, 4, 8, 16 in-flight query 各跑一輪、看 disjoint flag 觸發率與 result-available timing」。或更簡單：plan §B Scenario 2 觸發機率從 5~15% 升到 15~30%（pool 不足是 disjoint 主因之一）。

---

## 3. Tradeoff Tensions（≥ 1 真實 tension）

### T1（核心）：「業務語義對齊」vs「實作機制可達」之間沒有完美平衡點

**Tension**：
- plan §A.2 D1 明確採「業務語義對齊」路線（T_NEE = NEE primary call + 連帶 secondary BVH；T_BVH = primary BVH 走訪），對齊 Phase 1.0 §1 「光源 NEE ≤ 12%」之概念定義。
- 但實作上 mode 1 early-return（M1 / A1）做不到切離 secondary BVH；mode 2 break（M2 / A2）做不到切離 SPEC/REFR/COAT 等非 DIFF 材質分支。
- 退而求其次接受「實作機制」定義：T_NEE = sampleStochasticLightDynamic 函式體 ALU；T_BRDF = DIFF 分支內 ALU。但這偏離 Phase 1.0 §1 推估的「光源 NEE 整體成本」概念，Test O2 交叉驗無法成立。

**真實衝突點**：要完整保留 plan §A.2 D1 的業務語義 → 須用 N+1 build 法（Option 3，編譯時切，工程 +1.5 hr，與 erichlof framework #include 系統耦合）。要快速驗證 → uniform branch（Option 1）但業務語義打折扣。

**Synthesis 嘗試**（見 §4）：兩階段 — 先用 Option 1 快驗 + 接受業務語義打折，若結論可信度不足再升 Option 3 補。

### T2：probe overhead 與切點完整度的反向耦合

**Tension**：
- A3 提示 probe overhead 大概率超 5%，建議升 Option 3（編譯時切）
- A1/A2 提示切點不完整、切完整需在 caller 端 10+ 處插，uniform branch 方法 → overhead 累乘上升
- 升 Option 3 一次解決 overhead + 切點完整度，但工程成本 +1.5 hr 且 erichlof #include 巨集系統耦合風險（plan §A.3 Option 3 Cons）

**真實衝突點**：保留 Option 1 兩個問題都不完美解；升 Option 3 兩問題都解，但 Phase 1.0 框架補償（1.7/1.5 魔數）+ erichlof #include 系統的耦合風險，使 Option 3 自身可能 fail-fast。

### T3：F2 是純量測 vs 量測本身已是優化動作

**Tension**：
- 守門禁忌 1「純 instrumentation，不動 path tracer 主路徑」
- 但 mode 1/2 的 if 分支被 ANGLE Metal 編譯成 select() 等 → 兩路徑都跑（plan §B Scenario 3 成因 b） → mode 0 build 的 fragment shader 程式碼路徑已被改變
- mode 0 vs Phase 1.0 baseline 的 magick AE = 0 視覺驗（Test E3）能過嗎？plan §C.3 Test E3 假設能過，但若 ANGLE 對 if 分支 codegen 引入浮點 ALU 順序變動，AE = 0 可能失敗（即便數值幾乎一致）

**真實衝突點**：守門禁忌 1 vs 視覺像素閘 P4 vs ANGLE codegen 不可控。

---

## 4. Synthesis（嘗試）

**核心提案：Option 1.5 — 兩階段量測（折衷 Option 1 + Option 3）**

```
Stage A（Option 1 快驗，1.5 hr）：
    1. mode 1 切點：sampleStochasticLightDynamic 入口 L262 後 (修 A5 行號)
       接受業務語義打折扣 (A1)：T_NEE = 函式體 ALU；secondary BVH 仍歸 T_BVH
    2. mode 2 切點：改放 SceneIntersect 之後 / hitType 分支之前 (修 A2)
       即 L971 ~ L1013 之間加 if (uSegmentMode == 2) break;
       業務語義變「skip-all-material-and-bounce」非「skip-Material」
    3. Step 0 探針閘門檻收緊 (修 A3)：< 1% 合格 / 1~3% 警告 / ≥ 3% 升 Stage B
    4. 移除 Test E2 守恆驗的「偵測 Scenario 1」屬性 (修 A4)
       改補 mode 1 / mode 2 1024-spp 視覺量化驗 (修 A7)

Stage B（Option 3 N+1 build 升級，+1.5 hr，僅 Stage A fail-fast 觸發）：
    1. 編譯時 #ifdef SKIP_NEE 切整個 NEE dispatch 區塊（10 處）
    2. 編譯時 #ifdef SKIP_MATERIAL 切整個 hitType material 樹（L1013-1858）
    3. 業務語義回到 plan §A.2 D1 完整定義
    4. Phase 1.0 §1 ≤ 12% NEE 估值 cross-check 重啟

Stage A 驗收條件：
    - Step 0 過 (Δ < 1%)
    - mode 0 vs Phase 1.0 視覺 AE = 0
    - T_NEE 占比與 Phase 1.0 §1 推估「整體 NEE 成本 ≤ 12%」差異 ≤ 50%
      （若差 > 50% 表示業務語義打折扣已扭曲結論，升 Stage B）

Stage A 結論可信度判斷：
    - 「最大占比段」≥ 30% 且 C1/C2/C4 ≥ 2 個一致 → SOP §86 路徑判斷可進
    - 否則升 Stage B
```

優點：
- 多數情況 Stage A 已給可用結論（占比 30%+ 之大段對業務語義打折扣不敏感）
- Stage B 是 fallback，不是預設工程路徑
- 探針閘門檻收緊讓 Stage A→B 切換早觸發，避免 Step 1A~1E 跑完才發現

缺點：
- v2 必須重寫 §A.2 D1（業務語義從「完整」改「兩階段」）
- 增 Stage B 規格描述工程量

---

## 5. Principle 違反清單（Deliberate 模式硬性要求）

### 嚴重級違反

**P5 違反（Threshold discipline + RAF host 對齊）**

```
位置：plan §B Scenario 3
違反：「< 2% 合格 / 2~5% 警告 / ≥ 5% fail-fast」門檻對 Phase 1.5 Step 2 step0-noop §2
     實證 36% 探針拖慢前車，明顯過鬆。
證據：.omc/REPORT-R6-2-Phase-1.5-Step2-step0-noop.md §2
影響：Step 0 探針閘失效機率被低估，可能讓 baseline 已被拖慢 10~30% 的探針誤判合格、進
     Step 1A 跑 9 hr 後才發現結論不可信。
嚴重度：高（直接拖累工程效率 + 違反 P2 prototype-first 精神）
```

**P4 違反（Pixel-exact correctness gate）**

```
位置：plan §C.3 Test E3
違反：mode 0 build vs Phase 1.0 baseline magick AE = 0 假設能過。但 ANGLE Metal 對
     mode 1/2 的 if 分支可能 codegen 為 select()（plan §B Scenario 3 成因 b 自承）→
     兩路徑都跑 → 即便 mode 0 邏輯結果相同，浮點 ALU 順序可能變 → AE 不為 0。
影響：plan 內含 P4 視覺驗作為 commit gate，但實作上 P4 可能無法達成（ANGLE codegen
     不可控）。Step 1A 結束時 AE > 0 → 卡死。
嚴重度：高（P4 是硬閘、達不到等於 plan 不可執行）
```

### 中度違反

**P2 違反（Prototype-first verification）**

```
位置：plan §A.4 + §D Step 0
違反程度：部分違反。Step 0 探針閘設計對齊 P2 精神，但 Step 0 自身的 acceptance 閾
       值（M3）過鬆，等於探針未真正前置。
影響：與 Phase 1.5 Step 2 v3 plan 體例對齊度打折扣（plan v3 探針閘 < 3% fail-fast、
     本計畫 < 5%，鬆了 2 個百分點）。
嚴重度：中（屬於 hard gate threshold discipline 的衍生問題）
```

### 輕度違反 / 無違反

**P1 範圍純度（Domain purity）：合格**

```
plan §C.5 / §E 對白名單檔嚴格、grep diff 守門腳本完整、commit message 範本明確。
唯一隱憂：A6 提示需 caller-side 改動 10 處（L1818 + 9 同構站），可能讓「純
instrumentation」變「10 處插入式 instrumentation」，邊界仍清楚但工程量上升。
```

**P3 Atomic + reversible commits：合格**

```
Step 0 / 1A / 1B / 1C / 1D / 1E 各獨立 commit、commit message 範本對齊 plan v3 體例。
```

### 互不衝突檢查

P1 範圍純度 vs P5 量測精度：A6 提示 caller-side 切點增加可能讓 P1 邊界擴大（10 處插入），但與 P5 量測精度（切點完整度）方向一致 — 這是 plan 的合理衝突，由 Synthesis Stage A 接受打折扣方式緩解。

P4 視覺像素閘 vs P5 量測法：A4 / Test E3 衝突已論證，需在 v2 §C.3 補述若 P4 達不到的退路。

---

## 6. 必親自驗證事實清單（grep/Read 結果）

### 6.1 NEE 函式真名

```
查詢：grep -nE "sampleStochasticLight" shaders/Home_Studio_Fragment.glsl
結果：所有 11 處皆 sampleStochasticLightDynamic
       L253 函式定義 / L1264, L1302, L1350, L1402, L1510, L1549, L1610, L1655,
       L1764, L1818 共 10 處 caller
結論：plan v1 寫對（sampleStochasticLightDynamic）；Phase 1.0 §1 提到的
     sampleStochasticLightN 是早期文件命名遺跡，不是現在的函式名
影響 plan：無；命名一致
```

### 6.2 sampleStochasticLightDynamic 入口結構（L253-268）

```
查詢：Read shader L253-268
結果：
  L253-254  函式簽章 + {
  L255-256  R3-6.5 S2.5 註解
  L257-262  if (uR3ProbeSentinel < -100.0) sentinel guard（5 行 block）
  L263-268  if (uActiveLightCount <= 0) active count guard（6 行 block）
  L269+     實際 NEE 工作（slot 抽選、neeIdx 分支）
結論：mode 1 切點實際位置應在 L262 之後 / L263 之前
plan §F Q1「L257-263 之間」描述不精確（字面 L258-262 是 sentinel 內部）；
plan §D Step 1A-1「sentinel L257 與 active count L263 之間」對
影響 plan：A5 / v2 §F Q1 行號統一
```

### 6.3 hitType == DIFF 分支結構（L1773-1826）

```
查詢：Read shader L1773-1826
結果：
  L1773  if (hitType == DIFF) {
  L1777-1788  isFloor dielectric Fresnel 分支
  L1789-1797  per-box hitMetalness 金屬路徑分支
  L1798  diffuseCount++;
  L1800  mask *= hitColor;
  L1801  空行
  L1802  bounceIsSpecular = FALSE;
  L1803  MIS state reset
  L1805  rayOrigin = x + nl * uEPS_intersect;
  L1807-1814  diffuseBounce setup
  L1816-1823  NEE dispatch (L1818) + state update
  L1824  continue;
  L1826  }
結論：plan §D Step 1A-2 切點 L1800 後 / L1802 前實際位置在 mask*=hitColor 之後、
     bounceIsSpecular=FALSE 之前。但這位置 break 會跳過 diffuseBounce setup、
     NEE dispatch、MIS state — 業務語義是「skip-DIFF-bounce-setup-and-NEE」非
     「skip-Material」
影響 plan：M2 / A2
```

### 6.4 SceneIntersect 在 shader 內呼叫位置

```
查詢：grep -n "SceneIntersect(" shaders/Home_Studio_Fragment.glsl（含函式定義）
結果：
  L659  函式定義 float SceneIntersect( )
  L920  函式結尾 }
  L969  唯一呼叫點 t = SceneIntersect();（在 for-bounces 迴圈 L963 內）
結論：NEE shadow ray 不是「另一次 SceneIntersect 呼叫」，而是下一輪 for iteration
     的同一個 L969 呼叫。plan §A.2 D1 「BVH = SceneIntersect 整個函式 + 含 NEE
     shadow ray 的二次 SceneIntersect 呼叫」描述業務語義對、實作機制錯。
影響 plan：M5 / A1 / v2 §A.2 D1 改寫
```

### 6.5 CalculateRadiance 邊界 + main bounce 迴圈

```
查詢：grep -n "^vec3 CalculateRadiance|^void main|^[}]$" shaders/Home_Studio_Fragment.glsl
結果：
  L923  vec3 CalculateRadiance(...)
  L963  for (int bounces = 0; bounces < 14; bounces++)
  L969  t = SceneIntersect();
  L1013-1191  hitType == LIGHT / TRACK_LIGHT / CLOUD_LIGHT primary-hit + NEE-hit 累加
  L1773-1826  hitType == DIFF
  L1828+      hitType == SPEC, REFR, COAT, etc.
  L1858  CalculateRadiance 結尾（return max(vec3(0), accumCol);）
  L1880  最後函式（SetupScene）結尾
結論：plan 描述的「material switch」不是真的 switch 語法，是 12+ if (hitType == X) 平行分支。
     mode 2 切點若在 DIFF 分支內 break，SPEC 等其他分支不被切。
影響 plan：M2 / A2
```

### 6.6 RAF host 結構（js/InitCommon.js）

```
查詢：grep RAF / animate / FRAME_INTERVAL_MS / sampleCounter
結果：
  L57   let needClearAccumulation = false;
  L60   const FRAME_INTERVAL_MS = 1000 / 60;
  L62   let sampleCounter = 0.0;
  L866  animate();
  L873  function animate()
  L877  if (nowMs - lastRenderTime < FRAME_INTERVAL_MS) requestAnimationFrame(animate); return;
  L879  requestAnimationFrame(animate);
  L1316 var renderingStopped = (sampleCounter >= MAX_SAMPLES && !cameraIsMoving);
  L1318 if (!renderingStopped) {
  L1320   STEP 1
  L1323-1324  renderer.setRenderTarget(pathTracingRenderTarget); renderer.render(pathTracingScene, worldCamera);
  L1326   STEP 2
  L1329   ping-pong copy
  L1383 STEP 3
  L1391 requestAnimationFrame(animate);
  L1393 } end animate
結論：plan §D Step 1B-2「animate() L1318~1331 包夾 STEP 1」位置正確。
     plan §A.2 D3「InitCommon.js L877~881」FRAME_INTERVAL_MS 16.67ms cap 位置正確。
     plan §F Q3 sampleCounter 安全區間 [10, MAX_SAMPLES - 100] 與 L1316 renderingStopped flag 對齊。
影響 plan：無；行號正確
```

### 6.7 EXT_disjoint_timer 是否已用過

```
查詢：grep -nE "(EXT_disjoint_timer|GPUTimerQueryPool|TIME_ELAPSED_EXT|GPU_DISJOINT)" js/InitCommon.js js/Home_Studio.js
結果：0 hits
結論：本計畫是首次引入 EXT_disjoint_timer 到 production code path。
     2026-04-27 探針只在 console 一次性驗 ext_supported / api_runs；query pool 大小、
     in-flight 上限、async readback timing 全未驗。
影響 plan：A8 / v2 §D Step 0 加 0-2.5 query pool 探測 / §B Scenario 2 觸發機率上修
```

### 6.8 baselines 目錄狀態

```
查詢：ls .omc/baselines/ .omc/test-runs/
結果：
  .omc/baselines/   不存在
  .omc/test-runs/   不存在
結論：plan §C.3 Test E3「對 .omc/baselines/phase-1.0/* 16 張 magick AE = 0」要求
     必須先 1C-0 補拍 16 張。plan §D Step 1C-0 已對齊 plan v3 體例補拍 0.5 hr 工時。
     plan §E 驗證腳本最後段「cd .omc/test-runs/f2/ ... compare ../../baselines/phase-1.0/$base」
     依賴此補拍。
影響 plan：plan 已涵蓋；無新建議
```

### 6.9 plan v3 leaf-fetch packing 體例對齊度

```
查詢：Read .omc/plans/R6-2-Phase-1.5-Step2-leaf-fetch-packing.md L1-80
結果：
  - P1~P5 5 條 principles 結構：本計畫對齊 ✓
  - Step 0 探針閘設計：本計畫對齊 ✓（但門檻不對齊，見 M3）
  - 期望收益不寫死 +X%：本計畫對齊 ✓（用「結論可信度」表達）
  - C1/C2/C4 投票池、C3 棄權：本計畫對齊 ✓
  - 1024-spp 16 張 baseline 補拍策略：本計畫對齊 ✓
  - Pre-mortem ≥ 3 場景 trigger/detection/rollback：本計畫 6 個場景結構齊全 ✓
  - §C.5 Performance Acceptance Table：本計畫對齊 ✓
  - §E Verification Hooks 對應守門禁忌 1~5：本計畫對齊 ✓
結論：體例對齊整體高品質（同一 Planner 寫，預期之中）。瑕疵僅在 M3 門檻數值不對齊
     v3「< 3% fail-fast」（v1 用 < 5%）。
影響 plan：M3 / A3
```

### 6.10 NEE caller 端 dispatch 站總數

```
查詢：grep -n "rayDirection = sampleStochasticLightDynamic" shaders/Home_Studio_Fragment.glsl
結果：10 hits — L1264, L1302, L1350, L1402, L1510, L1549, L1610, L1655, L1764, L1818
結論：plan §D Step 1A-1 只在 sampleStochasticLightDynamic 入口（L262 後）切 mode 1，
     未動 caller。但 caller 端有 9~10 個非 trivial 後續處理（mask*=weight, sampleLight=TRUE,
     misWPrimaryNeeLast 更新 etc.）— 這些 ALU 留在 mode 1 的 T_no_NEE 量測內，意味
     T_NEE 估值偏低。
影響 plan：A6 / v2 §A.2 D1 / Step 1A-1 必須處理
```

### 6.11 hitType 平行分支總數

```
查詢：grep -nE "if \(hitType == " shaders/Home_Studio_Fragment.glsl
結果：12+ 個分支 — LIGHT (L1013), TRACK_LIGHT (L1069), TRACK_LAMP_HOUSING, TRACK_WIDE_LIGHT (L1106),
     CLOUD_LIGHT (L1150 + L1664), DIFF (L1773), SPEC (L1828), REFR, COAT, ...
結論：mode 2 切點若在 DIFF 內 break，其餘 11+ 分支照跑。Material BRDF 段切離不完整。
影響 plan：M2 / A2
```

---

## 7. 對 Planner v2 的具體修改要求清單

### 7.1 必修（Must-fix，等同 REVISE 條件）

```
MR1. §A.2 D1 重寫（對應 M5 / A1 / A6）
     當前文字：「BVH traversal = SceneIntersect 整個函式（glsl L659-920）含 NEE shadow
              ray 的二次 SceneIntersect 呼叫」
     改為：「SceneIntersect 在 shader 內僅 1 個呼叫點（L969），位於 for-bounces 迴圈內。
           NEE shadow ray 不是另一次呼叫，而是下一輪 bounce iteration 的同一個 L969 呼叫。
           『業務語義』T_BVH = primary BVH + 連帶 secondary BVH，但『實作機制』兩者都走
           L969 同一段程式碼；mode 1 early-return 無法切離 secondary BVH（rayDirection
           被設成 nl、下一輪仍走 SceneIntersect）。本計畫 Stage A 接受此業務語義打折
           扣，T_NEE 估值 = sampleStochasticLightDynamic 函式體 ALU + caller-side 後續
           ALU；secondary BVH 仍歸 T_BVH。」

MR2. §A.3 / §D Step 1A-2 mode 2 切點重寫（對應 M2 / A2）
     當前位置：DIFF 分支內 L1800 後 / L1802 前
     改為：SceneIntersect 之後 / hitType 分支之前（即 L971 ~ L1013 區間內）
     新切點：「if (uSegmentMode == 2) { if (bounces == 0) accumCol += mask * hitEmission;
            break; }」
     業務語義改名：T_BRDF 改為「T_after_first_hit」= 首次 hit 之後的整段 material switch +
                bounce 路徑（含所有 hitType 分支 + NEE dispatch + MIS）
     §A.2 D1 / §A.4 期望輸出格式同步重寫

MR3. §B Scenario 3 + §D Step 0-7 三層判斷門檻收緊（對應 M3 / A3）
     當前門檻：< 2% 合格 / 2~5% 警告 / ≥ 5% fail-fast
     改為：< 1% 合格 / 1~3% 警告 / ≥ 3% fail-fast
     觸發機率：15~25% 升 50~70%（內化 Phase 1.5 Step 2 step0-noop §2 36% 前車）
     R1 (升 Option 3) 升為「預設路徑」、R2 (退場) 為次選

MR4. §C.3 Test E2 守恆驗重寫（對應 M4 / A4）
     當前內容：「T_BVH + T_NEE + T_BRDF == T_baseline ± 5% 失敗 → Scenario 1 rollback」
     改為：
       1. 改名「噪音穩定驗」（移除「守恆」誤導詞）
       2. 明確標註「此 test 通過僅證明三次量測噪音穩定，不證明切點業務語義對」
       3. 補新 Test E2'「業務語義驗」：
          a. mode 1 1024-spp Cam1 視覺驗 + 直方圖中位數量化 acceptance（對齊 A7）
          b. mode 2 1024-spp Cam1 + Cam3 視覺驗 + 量化 acceptance
          c. T_NEE 占比 vs Phase 1.0 §1 ≤ 12% 偏差 > 50% → 標 Scenario 1 嫌疑

MR5. §D Step 1A 加 caller-side 處理（對應 A6）
     當前設計：只切 sampleStochasticLightDynamic 入口
     新增：caller 端 10 處 NEE dispatch 站（L1264 / L1302 / L1350 / L1402 / L1510 / L1549 /
          L1610 / L1655 / L1764 / L1818）每處在 sampleStochasticLightDynamic 呼叫後加：
          if (uSegmentMode == 1) { mask = vec3(0); break; }
     若不加 caller-side 切點：§A.2 D1 必補述「T_NEE 估值不含 caller-side ALU」
```

### 7.2 應修（Should-fix，影響 plan 完整度但非阻擋）

```
SR1. §F Q1 行號描述精確化（對應 A5）
     當前文字：「mode 1 在 sampleStochasticLightDynamic L257-263 之間 early-return」
     改為：「mode 1 切點在 L262 之後 / L263 之前（即 sentinel guard `}` 後、active count
          guard `if` 前）」
     §D Step 1A-1 同步使用此精確描述

SR2. §C.2 Test I3 / I4 驗收條件量化（對應 A7）
     當前：1 spp + eyeball check
     改：1024-spp + 直方圖中位數差距 ≥ X% / 噪音方差比 ≥ Y% 量化條件

SR3. §D Step 0 增 0-2.5 query pool size 探測（對應 A8）
     在 0-2 / 0-3 之間加：
     0-2.5：對 ANGLE Metal 開 1, 4, 8, 16 in-flight EXT_disjoint_timer query 各跑一輪、
            log disjoint 觸發率與 result-available timing；確認 plan §F Q9 推測 8 是否
            可達 / 或縮回 4

SR4. §B Scenario 2 觸發機率上修（對應 A8）
     當前：5~15%
     改：15~30%（query pool size 不足是 disjoint 主因之一，當前 plan 未驗）
```

### 7.3 建議（Nice-to-have）

```
NTH1. §G ADR Decision 預期填入文字加 Stage A / Stage B 分支
     當前：路徑 W/X/Y/Z/V 五分支
     改：W~Z 四分支 + Stage A 結論可信度 → Stage B 升級觸發條件
       （對應 §4 Synthesis Stage A/B 兩階段）

NTH2. §F Q9 query pool size 直接給定推薦值
     根據 SR3 探測結果在 v2 給定具體數值，不留 Open Question

NTH3. plan 標題 v1 → v2 之版本號 + 修訂歷史補入
     對齊 plan v3 leaf-fetch 體例「v1→v2 修訂原因 / v2→v3 修訂原因」
```

---

## 8. 範圍純度檢查（守門禁忌 1）

```
範圍邊界檢查：
  ✓ 不修 BRDF / NEE / BVH 邏輯本體 — plan §A.5 / §E Verification Hooks 規則 4 守門
    嚴格，但 MR5 caller-side 處理會使「shader 動的位置」從 2 處升到 12 處。Plan 應在
    v2 §範圍邊界 補述「instrumentation 站點數 = 1 (uniform) + 1 (sampleStochasticLightDynamic
    入口) + 1 (SceneIntersect 後) + 10 (caller-side break) = 13 處 if 分支」
  ✓ 不動 buildSceneBVH / updateBoxDataTexture — 守
  ✓ 不動 GUI — 守（pathTracingUniforms.uSegmentMode 註冊不算 GUI）
  ✓ 不動材質 / 光源邏輯 — 守
  ✓ commit 邊界可逆 — Step 0 / 1A / 1B / 1C / 1D / 1E 各獨立 commit、git revert 可達

「順手改」誘惑檢查：
  ✓ 沒有 BVH builder JS 改動誘惑（plan 已禁止）
  ✓ 沒有材質參數順手改（plan 已禁止）
  ✓ 沒有 GUI 加 segment-mode 切換器（plan 已禁止「不加 GUI（純 console 切）」）
  ⚠ A8 提示加 query pool 探測（0-2.5），這是 Step 0 內部探針的一部分、不算範圍擴大

結論：範圍純度合格，但 v2 必須補述 instrumentation 站點數從「2 處 if」升「12 處 if」
     之事實，對應 MR5。
```

---

## 9. plan v3 leaf-packing 體例對齊度（明細）

```
| 體例項目                        | plan v3 (leaf-fetch)                     | plan v1 (F2)                          | 對齊度 |
|---------------------------------|------------------------------------------|---------------------------------------|--------|
| 標題版本號                      | v3                                       | v1                                    | -      |
| 修訂歷史 v1→v2→v3 段             | 有（明確列 ITERATE 修訂原因）             | 無（v1 初版）                          | -      |
| P1~P5 5 principles 結構           | 完整                                     | 完整                                   | ✓      |
| A.2 Decision Drivers top 3       | D1/D2/D3 + Architect REVISE 補強         | D1/D2/D3                              | ✓      |
| A.3 Viable Options ≥ 2 + 排除理由 | 4 options + 明確排除理由                 | 4 options + 明確排除理由               | ✓      |
| A.4 期望收益不寫死 +X%           | 用「條件式 + 命中率」表達                | 用「結論可信度」表達                   | ✓      |
| Step 0 探針閘設計（fail-fast）   | 完整、< 3% fail-fast                     | 完整、< 5% fail-fast                  | ✗ 寬   |
| 1024-spp baseline 補拍策略       | Step 1C-0 補拍 16 張                     | Step 1C-0 補拍 16 張                  | ✓      |
| Pre-mortem ≥ 3 場景              | 6 場景 trigger/detection/rollback 齊全    | 6 場景 trigger/detection/rollback 齊全 | ✓      |
| C.5 Performance Acceptance Table | 表格式、合格規則明確                     | 表格式、合格規則明確                   | ✓      |
| E Verification Hooks 守門禁忌 1~5 | 完整、附 grep 腳本                       | 完整、附 grep 腳本                     | ✓      |
| C1/C2/C4 投票、C3 棄權           | 對齊                                     | 對齊                                   | ✓      |
| ADR Decisions 結構                | 完整                                     | 完整（但 Decision 寫 TBD pending）     | ✓      |
| Open Questions 集中歸檔           | 對齊 .omc/plans/open-questions.md        | 對齊 .omc/plans/open-questions.md      | ✓      |
| Architect → Critic 審查迭代記錄   | 三輪 verdict 完整                        | 尚未開始（本 review 為第一輪）         | -      |

整體對齊度：90%（唯一不對齊處為 Step 0 探針閘門檻數值，對應 MR3）
```

---

## 修訂歷史

- 2026-04-27 r1 初版（Architect Round 1 review）
