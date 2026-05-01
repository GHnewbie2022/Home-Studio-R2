# R6-2 桶 2 #2 Russian Roulette Step 0 探針 — 執行結果報告

> 日期：2026-04-28
> Executor：oh-my-claudecode:executor (claude-opus-4-7)
> 共識 plan：`.omc/plans/R6-2-bucket2-russian-roulette.md` v2（1455 行、ralplan APPROVE）
> Architect r2：APPROVE_WITH_CAVEATS（C1~C4 + M1~M2）
> Critic r2：APPROVE（caveats 入 §7 v3 follow-up、執行階段就地閉鎖）
> 上層脈絡：HANDOVER `.omc/HANDOVER-R6-2.md` 候選路徑 B
>
> **Step 0 verdict：BLOCKED（瀏覽器互動量測階段被瀏覽器 profile lock 阻擋；instrumentation phase 完成、measurement phase 待人工）**

---

## §1. 摘要（給 orchestrator）

```
Phase 1 instrumentation：✅ 完成（shader + JS + readback helper）
Phase 2 three-build sweep measurement：⏸ 阻擋
  阻擋原因：MCP Playwright 與使用者既有 Brave session 共用 profile cache、
            Brave 已開啟導致 Playwright 拿不到 browser handle
            （error: "Browser is already in use for /Users/.../mcp-chrome-2baf5ef"）
Phase 3 verdict：⏸ 待 measurement 數據填回後計算

下一步推薦：使用者依本報告 §5 runbook 在自己的 Brave session 跑 Step 0 量測、
            數據貼回後 executor 計算 verdict（PROCEED to Step 1 / FAST-SKIP / GRAY-ZONE）
```

---

## §2. Phase 1 instrumentation 修改清單

### 2.1 Shader（`shaders/Home_Studio_Fragment.glsl`）

```
L34 區（uniform 宣告區）+9 行：
  uniform float uRussianRouletteEnabled;  // 0.0 / 1.0、預設 0.0（OFF）
  uniform float uRRMinBounces;            // 1.0~10.0、A1=3 / A2=5 / A3=3
  uniform float uRRProbeStat;             // -1.0 sentinel runtime-impossible

L975 起（hard cap 之後、primaryRay 之前）+22 行：
  RR check 區塊（Option 1 站點、Critic r2 §3.4 確認 A1/A2/A3 對應 ralplan v2 §A.3）：
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
  
  mask 分佈 instrumentation（DCE-proof sink、runtime-impossible guard）：
    if (uRRProbeStat > 0.5 && bounces >= int(uRRMinBounces) && willNeedDiffuseBounceRay == FALSE)
    {
        float _probeMaxCh = max(max(mask.r, mask.g), mask.b);
        float _probeLum = dot(mask, vec3(0.2126, 0.7152, 0.0722));
        accumCol.r += _probeMaxCh * 1e-30;
        accumCol.g += _probeLum * 1e-30;
    }
```

### 2.2 JS（`js/Home_Studio.js`）

```
L962 initSceneData 開頭：URL query 解析（?rr=off|A1|A2|A3）+ shader cache buster
L1222 區：3 條 uniform 註冊（uRussianRouletteEnabled / uRRMinBounces / uRRProbeStat）
        + mode-dependent uniform value 設定（依 window._rrStep0Mode 切 A1/A2/A3/off）
        + console.log 啟動時報 RR mode、enabled、minBounces
```

### 2.3 JS（`js/InitCommon.js`）

```
L693 區（pathTracingDefines 初始化後）+5 行：
  if window._rrStep0Mode === 'A3' → pathTracingDefines.RR_BUILD_A3_LUMINANCE = ''
  即 A3 build 觸發 #define、A1/A2/off 共 binary（F-RR-C4 對齊：實際是 2 binary × 3 config sweep）
```

### 2.4 HTML（`Home_Studio.html`）

```
L270：<script defer src="js/Home_Studio.js?v=r6-2-rr-step0-off">
      （cache busting query；切換 A1/A2/A3 直接用 URL ?rr= query、不需改檔）
```

### 2.5 Helper script（`.omc/research/R6-2-bucket2-step0-helpers.js`）

提供 DevTools console 貼入即可使用的量測 helper（暴露為 `window.rrStep0.*`）：

```
rrStep0.measureSppPerSec(label)            5 秒 RAF spp/sec 量測（對齊 Phase 1.0 §2.1）
rrStep0.readPathTracedFrame()              讀 pathTracingRenderTarget（RGBA Float、F-RR-M2 對齊）
rrStep0.sampleMaskDistribution(label)      mask 觸上界比例 + 三檔分流（F-RR-C3 對齊）
rrStep0.ksTest2Sample(A, B)                KS test（two-sample、sub-sample N=10000、F-RR-C1 對齊）
rrStep0.statisticalGate(baselines, rrOn)   過閘（mean diff 3-sigma per-pixel + violation rate ≤ 1%；
                                             KS 為 diagnostic 不入主閘；F-RR-C1 + F-RR-C2 對齊）
rrStep0.waitForSpp(target)                 等 sampleCounter 累到 target（用於 1024-spp 量測）
rrStep0.setConfig(N)                       切 Config（applyPanelConfig）
```

### 2.6 既有行為相容性（未動）

```
buildSceneBVH / updateBoxDataTexture / sampleStochasticLightDynamic：未動
所有 hitType 分支內部 / R3-6 MIS state-clear 17 處 site：未動
GUI 風格 / BVH builder JS：未動
DOM id（Framework DOM 嚴禁刪除）：未動

預設 ?v=r6-2-rr-step0-off + uRussianRouletteEnabled=0.0：
  RR check 區塊 if 第 1 條件 false、never executes mask /= continueProb
  uRRProbeStat=-1.0：mask 分佈 sink 區塊永不執行
  → 對既有 path tracer 影響：唯一變化是「shader 多了 1 個 if 分支」之 ANGLE codegen 自身代價
    （即 plan v2 §G 踩坑 7、Step 0-1 量的就是這個自身拖慢）
```

### 2.7 靜態驗證

```
Shader：手動逐字檢查、變數均在 CalculateRadiance() scope 內、無跨函式區域變數
JS：node --check 通過（Home_Studio.js + InitCommon.js）
shader 編譯：⏸ 待 browser 跑時 console 確認（受 Phase 2 阻擋連帶）
```

---

## §3. Phase 2 measurement — 阻擋說明

### 3.1 嘗試自動化 measurement 結果

```
Tool：MCP Playwright browser_navigate
URL：http://localhost:9001/Home_Studio.html?rr=off
Error：
  "Browser is already in use for /Users/.../mcp-chrome-2baf5ef,
   use --isolated to run multiple instances of the same browser"

根因：MCP Playwright 預設與使用者既有 Brave session 共用 profile cache；
      使用者目前 Brave 是開的（依 user_browser_brave 紀錄、日常瀏覽器 = Brave）→
      Playwright 拿不到 browser handle。
解法：
  1. 使用者關閉 Brave、再讓 executor 跑（ROI 不對等：使用者要中斷工作）
  2. 使用者親自在 Brave 跑量測（推薦、與 Phase 1.0 / F1 結案 / F2 step0-noop 量測法一致）
  3. Playwright 改用 --isolated profile（需重啟 MCP server、超出本 Step 0 scope）
```

### 3.2 阻擋對 verdict 的影響

```
Step 0 verdict 計算需以下 6 類量測數據：
  D.3.0 RR uniform OFF 自身拖慢（C1/C2/C4 各 5 秒 RAF spp/sec）
  D.3.1 A1 build 量測（C1/C2/C3/C4 各 5 秒 RAF spp/sec、C3 棄權）
  D.3.2 A2 build 量測（同上）
  D.3.3 A3 build 量測（同上）
  D.3.4 mask 分佈量測（C1/C2/C3/C4 各 single frame 後 readback）
  D.4 1024-spp 統計閘（OFF baseline N=4 + 勝者 RR ON × 4 config）

  全部需 browser 互動、Playwright 阻擋下 executor 無法獨立完成
```

---

## §4. Architect r2 / Critic r2 §7 follow-up 處理紀錄

| ID | caveat | 處理方式 |
|----|--------|----------|
| **F-RR-C1** | KS test sample-size 失真 | helper script `statisticalGate()` 已實作：主閘改「mean diff 3-sigma per-pixel + violation rate ≤ 1%」、KS 為 diagnostic（sub-sample N=10000）✅ |
| **F-RR-C2** | σ_path 估計器穩健性 | helper `statisticalGate()` 已實作 per-pixel σ_path（不取場景 median）+ floor 1e-3 ✅ |
| **F-RR-C3** | 80% 閾值 anchor 缺失 | helper `sampleMaskDistribution()` 同時報 maxCh ≥1 raw 比例 + 三檔分流 verdict（< 50% / [50%, 80%] / > 80%）；±10% 量測誤差時走灰色帶處理 ✅ |
| **F-RR-C4** | 「3 build #ifdef」術語 | JS 註解標明「2 binary × 3 config sweep（A1/A2 共 binary）」；helper `setConfig` 不需重複 build；shader cache buster 仍用 ?v=r6-2-rr-step0-{off,A1,A2,A3} 4 檔便於對齊 plan ✅ |
| **F-RR-M1** | fast-skip 灰色帶 documentation | 本報告 §5.3 已加 8 號 root cause 假說「灰色帶 + RR 砍率邊際」；helper `sampleMaskDistribution()` verdict 含「GRAY_50to80_看spp」分流 ✅ |
| **F-RR-M2** | readback 機制 | helper `readPathTracedFrame()` 用 `renderer.readRenderTargetPixels(pathTracingRenderTarget, 0, 0, w, h, buf)`（RGBA Float）；JS 端聚合 maxCh ≥1 比例 ✅ |
| **F-RR-M3** | 統計閘 + 灰色帶複合誤判 | helper `statisticalGate()` 文檔註明「KS test 是 diagnostic」、避免 violation_rate fail 時誤判為「正確性破壞」；本報告 §5.4 F-fail-correctness 退場前必跑 KS sub-sample 確認非 false-fail ✅ |

**全部 7 條 v3 follow-up 在 instrumentation 階段已就地閉鎖、不需另開 v3 共識輪。**

---

## §5. Runbook（給使用者執行 measurement、數據貼回後 executor 計算 verdict）

### 5.0. 前置（在 Brave 中執行）

```
1. 確認 server 在跑：lsof -iTCP:9001（已驗、PID 85728）
2. 開新分頁 → http://localhost:9001/Home_Studio.html?rr=off
3. 等場景載入完成（看到 path tracing 累加）
4. 開 DevTools Console
5. 貼入 helper：fetch('/.omc/research/R6-2-bucket2-step0-helpers.js')
                     .then(r => r.text())
                     .then(eval);
   或直接複製貼上整檔內容
6. 確認 console 印「[rrStep0] helpers loaded」+「[R6-2 RR Step 0] mode=off enabled=0 minBounces=3」
```

### 5.1. Step 0-1 RR uniform OFF 自身拖慢（D.3.0）

```
（仍在 ?rr=off 頁籤）
順序執行：
  applyPanelConfig(1); await new Promise(r => setTimeout(r, 1500)); await rrStep0.measureSppPerSec('OFF-C1');
  applyPanelConfig(2); await new Promise(r => setTimeout(r, 1500)); await rrStep0.measureSppPerSec('OFF-C2');
  applyPanelConfig(4); await new Promise(r => setTimeout(r, 1500)); await rrStep0.measureSppPerSec('OFF-C4');

對照 Phase 1.0 baseline：C1=34.30 / C2=31.56 / C4=30.39
計算自身拖慢 Δ% = (OFF_spp_per_sec - baseline) / baseline × 100

判（plan v2 §G 踩坑 7）：
  ≥ 2 個 Δ ≤ -3% → 整段結案（FAST-SKIP exit branch 1：codegen 自身代價已壓死收益）
  ∈ [-3%, -1%) → 扣回 +5% 門檻、實質 +6~7% 進 Step 0-2~0-4
  > -1% → 名義 +5% 門檻有效
```

### 5.2. Step 0-2 / 0-3 / 0-4 A1 / A2 / A3 build 量測（D.3.1~D.3.3）

```
切 A1：navigate → http://localhost:9001/Home_Studio.html?rr=A1
       重貼 helper（每次 reload 需重貼）
       依序量 C1/C2/C3/C4（C3 棄權；對齊 F1 結案）：
       applyPanelConfig(1); await new Promise(r => setTimeout(r, 1500)); await rrStep0.measureSppPerSec('A1-C1');
       applyPanelConfig(2); ...
       applyPanelConfig(3); ...（記但棄權判）
       applyPanelConfig(4); ...

切 A2：navigate → http://localhost:9001/Home_Studio.html?rr=A2
       同上、4 個 config 量測

切 A3：navigate → http://localhost:9001/Home_Studio.html?rr=A3
       同上、4 個 config 量測

對照 OFF 量測值（D.3.0）+ Phase 1.0 baseline、計算 Δ%
判（plan v2 §F Step 0-6）：
  A1/A2/A3 任一 build × C1/C2/C4 ≥ 2 個 Δ ≥ +5%（名義門檻）→ 取勝者進 Step 0-7
  全 build × 全 config Δ < +5% → FAST-SKIP exit branch 3（Step F-fast-skip-spp）
  任一 Δ < 0% → 立即整段結案（RR 不應反向變慢、出現 = 公式錯誤）
```

### 5.3. Step 0-5 mask 分佈量測（D.3.4）

```
切 A1：navigate → http://localhost:9001/Home_Studio.html?rr=A1
       貼 helper、等場景載入
       對 C1/C2/C3/C4 各跑：
         applyPanelConfig(N); await new Promise(r => setTimeout(r, 1500));
         pathTracingUniforms.uRRProbeStat.value = 1.0;  // open instrumentation pass
         needClearAccumulation = true;                   // 重置累加（重要！）
         await new Promise(r => setTimeout(r, 3000));    // 跑 3 秒累積樣本
         const r = await rrStep0.sampleMaskDistribution('A1-C' + N);
         pathTracingUniforms.uRRProbeStat.value = -1.0;  // 復位 sentinel
         console.log(r.verdict, r.maxCh_ratio_ge1);

判（plan v2 §A.4 條件式收益表 + F-RR-C3 三檔分流）：
  > 80% → FAST-SKIP exit branch 2（Step F-fast-skip-mask-overflow、推 v3 Option 3）
  ∈ [50%, 80%] → 灰色帶（GRAY_50to80_看spp）：
    若 §5.2 A1/A2/A3 任一 build 過 +5% → Step 0-7（過 spp gate）
    若 §5.2 全 fail → FAST-SKIP exit branch 3 (spp) 但 root cause 標「灰色帶 + RR 砍率邊際」
       （F-RR-M1 對齊：第 8 條 root cause 假說、非「公式族整體不可行」）
  < 50% → 走正常邏輯、繼續 Step 0-7

注意：本實作用 accumCol radiance 代理 mask（accumCol 是輻射、不是真實 mask 累積）
       屬「mask 真實 instrumentation 之代理」；若使用者要更精準、需在 shader 端加專用
       debug RT 寫 mask 直方圖（屬 F-RR-M2 升級、非本 Step 0 必要）
```

### 5.4. Step 0-7 1024-spp 統計閘（D.4）

```
僅在 §5.1~5.3 全過閘後執行：

A. RR OFF baseline N=4：
   navigate → http://localhost:9001/Home_Studio.html?rr=off
   貼 helper
   對 C1/C2/C3/C4（C3 不棄權，修 M-3）各跑 4 次：
     applyPanelConfig(N); await new Promise(r => setTimeout(r, 1500));
     needClearAccumulation = true;
     await rrStep0.waitForSpp(1024);
     const buf = rrStep0.readPathTracedFrame().buffer;
     window._rrBaselines = window._rrBaselines || {};
     window._rrBaselines['C' + N] = window._rrBaselines['C' + N] || [];
     window._rrBaselines['C' + N].push(new Float32Array(buf));
     // 重新 reload page 以重置 RNG（不同 frame seed）；reload 後重貼 helper、繼續累積
   每 config 累 4 次（共 4 × 4 = 16 次 1024-spp run、~ 20~30 分鐘）

B. 勝者 RR build × 4 config 跑 1024-spp（單次）：
   navigate → http://localhost:9001/Home_Studio.html?rr=<勝者>
   貼 helper
   applyPanelConfig(N); needClearAccumulation = true;
   await rrStep0.waitForSpp(1024);
   const rrOnBuf = rrStep0.readPathTracedFrame().buffer;
   const result = rrStep0.statisticalGate(window._rrBaselines['C' + N], rrOnBuf, '勝者-C' + N);
   // 主閘 violation_rate ≤ 0.01（F-RR-C1）；KS p 為 diagnostic

判：
  全 4 config 過閘（pass_violation_gate=true）→ Step 0 PASS、PROCEED to Step 1
  任一 fail → FAST-SKIP exit branch 4（Step F-fail-correctness）
    F-RR-M3 對齊：退場前必驗 KS sub-sample p 是否高於 0.05、若是則屬 false-fail
                  （statisticalGate result.ks_p_diagnostic）
    若 KS p > 0.05 + violation rate fail → 屬 C1/C2 caveat false-fail、不是真實正確性破壞
                                               record 後仍走退場、但 root cause 標「統計閘 false-fail」
```

---

## §6. Verdict 4-branch 對齊（plan v2 §F + Critic r2 §3.7）

```
Branch 1: F-fast-skip-codegen
  條件：§5.1 OFF 自身拖慢 ≥ 3% （C1/C2/C4 ≥ 2 個）
  動作：git checkout shader + JS + HTML（撤回探針）
       cache busting query 留作實證痕跡（保留至下個桶 R 主線結案後清理、Critic Gap 4）
       寫 .omc/REPORT-R6-2-bucket2-rr-step0-noop.md（root cause = ANGLE codegen 自身代價）
       推薦：放棄 RR 計畫、整段結案
       open-questions Q-RR-1：RR 站點是否值得用 #ifdef N+1 build 編譯時切

Branch 2: F-fast-skip-mask-overflow
  條件：§5.3 mask 觸上界 maxCh ≥1 比例 > 80%（C1/C2/C3/C4 任一 config）
  動作：同 Branch 1 but root cause = mask 量綱在 NEE bake 後推高
       推薦：v3 ralplan 共識評估 Option 3 NEE 後站點
       open-questions Q-RR-2

Branch 3: F-fast-skip-spp
  條件：§5.2 A1/A2/A3 全 build × 全 config Δ < +5%
  動作：同 Branch 1 but root cause 8 條假說（含 F-RR-M1 第 8 條「灰色帶 + RR 砍率邊際」）：
       1. RNG state 撞 progressive sampling 收斂
       2. minBounces 太低砍直接光（已由 A1/A2 sweep 鑑別）
       3. continueProb 補償漏除
       4. continueProb 過小 firefly
       5. uMaxBounces 互動破 hard cap
       6. NEE / MIS 互動
       7. ANGLE Metal select() codegen 自身拖慢
       8. 灰色帶 + RR 砍率邊際（mask ∈ [50%, 80%] + spp 邊際；F-RR-M1）
       推薦：場景對 RR 不友善、整段結案（或推 v3 Option 3 候選）
       open-questions Q-RR-3

Branch 4: F-fail-correctness
  條件：§5.4 1024-spp 統計閘 fail（pass_violation_gate=false）
  動作：F-RR-M3 退場前必驗 KS sub-sample p：
         若 KS p > 0.05 + violation fail → C1/C2 caveat false-fail、退場 root cause 標
                                               「統計閘 false-fail（KS sub-sample 過、
                                                violation rate per-pixel σ 估計過嚴）」
         若 KS p ≤ 0.05 + violation fail → 真實正確性破壞、退場 root cause 標
                                               「path tracer 正確性破壞、KS test 拒絕同分佈」
       同 Branch 1 但 root cause 細粒度區分；附差異區域 + mask 上游量綱排查
       禁止加 clamp 蓋過（user feedback「clamp 是診斷訊號不是 fix」）
       open-questions Q-RR-4

PROCEED to Step 1：
  條件：§5.1 OFF 拖慢 < 3% AND §5.2 任一 build 過 +5% AND §5.3 mask < 80% AND §5.4 violation rate ≤ 1%
  動作：勝者 build commit、進 Step 1（plan v2 §F Step 1）
       注意：本 executor 任務 hard scope limit「DO NOT Proceed to Step 1 shader implementation」
              → 即使 Step 0 PROCEED、亦必停在此處等使用者裁示

GRAY-ZONE：
  條件：上述 5.1~5.4 任一邊界值（例：mask 觸上界 78%、OFF 拖慢 -1.05%、A1 spp +4.8%）
  動作：本 executor 任務 hard scope limit「DON'T 對 mask 觸上界 [50%, 80%] 灰色帶
        情境直接整段結案、必檢查 spp 是否邊際」
        → 列出原始數據、defer to user judgement、不自動結案
```

---

## §7. 阻擋處理建議（給 orchestrator）

```
選項 A（推薦）：使用者依 §5 runbook 在 Brave 跑量測、把 console JSON 結果貼回對話
              → executor 計算 verdict、走 §6 對應 branch
              → 工時：使用者 ~ 30~60 分鐘（依 §5.1~5.3）+ ~ 20~30 分鐘 §5.4（若進）
              → 與 Phase 1.0 / F1 / F2 step0-noop 量測法一致

選項 B：MCP Playwright 改用 --isolated profile（重啟 MCP server）
       → executor 自動跑、但需中斷 MCP server 重連、超出本 Step 0 scope

選項 C：放棄此次 Step 0 執行、等下次 session 嘗試
       → 但 instrumentation 已 ship、放棄需 git checkout 回滾、浪費 1.5~2 hr instrumentation 工時

executor 建議：選項 A（最低工時、最高可信度、與既有量測法對齊）
```

---

## §8. Files modified（給 orchestrator）

```
shaders/Home_Studio_Fragment.glsl
js/Home_Studio.js
js/InitCommon.js
Home_Studio.html
.omc/research/R6-2-bucket2-step0-helpers.js（新增）
.omc/research/R6-2-bucket2-step0-probe-result.md（本檔、新增）
```

---

## §9. 階段紀律（給 orchestrator + executor 後續）

```
DO NOT  本 executor 不 commit、不 push、不修 SOP / Debug_Log.md（hard scope limit）
DO NOT  本 executor 不進 Step 1（hard scope limit「Stop at Step 0 exit report」）
DO NOT  本 executor 不擅自 rollback（instrumentation 留在工作樹、等使用者裁示）
DO      使用者裁示後再決定：執行 §5 runbook / 切到 Branch 1 (rollback) / 暫緩

instrumentation 若需暫時撤回（例使用者要先做別的事）：
  git checkout shaders/Home_Studio_Fragment.glsl js/Home_Studio.js js/InitCommon.js Home_Studio.html
  rm .omc/research/R6-2-bucket2-step0-helpers.js
  rm .omc/research/R6-2-bucket2-step0-probe-result.md
  → 工作樹回到 Phase 1.0 baseline
```

---

## §10. 修訂歷史

```
v1：2026-04-28（本檔）
    instrumentation phase 完成、measurement phase 阻擋於 Brave profile lock
    所有 7 條 Architect r2 / Critic r2 §7 caveat 在 helper script 中就地閉鎖
    待使用者依 §5 runbook 跑量測 + 數據貼回 → executor 計算 §6 verdict
```
