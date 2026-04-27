# R6-2 Handover — Phase 1.5 Step 2 ralplan v3 ✅ APPROVED，等使用者裁示執行 OMC

> 最後更新：2026-04-27
> 狀態：
>   - Phase 1.0 ✅ 完工
>   - Phase 1.5 Step 1（SAH 切換）❌ 失敗回滾
>   - Phase 1.5 Step 2 ralplan v3 ✅ APPROVED（Architect PASS + Critic APPROVE）
>   - 等使用者裁示執行 OMC 工具走哪條

---

## 接手第一步（不得跳過）

依序讀：

```
1. .omc/plans/R6-2-Phase-1.5-Step2-leaf-fetch-packing.md（ralplan v3 APPROVED 完整計畫）
2. .omc/REPORT-R6-2-Phase-1.0.md（Phase 1.0 baseline 完整盤點）
3. .omc/REPORT-R6-2-Phase-1.5-Step1-SAH-rollback.md（SAH 失敗教訓）
4. docs/SOP/R6：渲染優化.md（主線 2 + 守門禁忌）
5. docs/SOP/Debug_Log.md 開頭通用 Debug 紀律三條
6. .omc/plans/open-questions.md（R6-2-Step2 7 條 open questions、Q1/Q4/Q5 已 v3 閉鎖）
```

---

## ralplan 共識歷程

```
v1: Architect REVISE → 5 addenda（強制 Step 0 探針閘等）
v2: Architect PASS w/caveats（6 caveat） + Critic ITERATE（12 finding）
v3: 12 finding 全 CLOSED + 6 caveat embed → Architect PASS + Critic APPROVE
```

---

## v3 Plan 核心結構

```
Step 0：探針閘（強制前置，1.5 hr）
  0a: force-full-fetch 量測（A1 falsify）
      0a-5: spectorJS 5 步驟驗 ternary 編成 conditional move
      0a-5b: 失敗 fallback compile-time #ifdef 雙 build
      0a-6: early-out 三層（<3% fail / ≥10% pass / 灰色帶才跑 0b）
  0b: EXT_disjoint_timer leaf 段佔比量測（A4 falsify）
      fallback 公式：T_full/T_dce/leaf_占比 = (T_full - T_dce)/T_full
  0c: 三條件閘
      (a) X ≥ 5%（leaf fetch 真實影響）
      (b) leaf 段佔比 ≥ 15%
      (c) X × Y_estimate × 0.6 ≥ 5%（命中率乘積條件）
      Y_estimate 兩選一：選 A GPU atomic counter / 選 B offline JS analysis（建議 B）

Step 1A：JS reference packing function + contract test
Step 1B：buildSceneBVH + updateBoxDataTexture 雙寫入點 #if 同步
Step 1C：fragment shader fetchBoxData 改寫 + flag=false baseline 補拍 16 張 1024-spp
Step 1D1：C2 single config 量測（前哨）→ +5% 才進 D2
Step 1D2：C1/C4 補測 + 16 張視覺 AE=0
Step 1E：commit 或 rollback

Pre-mortem 7 scenarios（S0~S6 含 trigger/detection/rollback/機率估計）
Acceptance thresholds 8 條全 testable
Verification hooks 5 條（grep + magick + git）
```

---

## Phase 1.0 結論（baseline 不變）

```
| Config | spp/sec | 1024-spp 牆鐘 |
|--------|---------|----------------|
| C1     | 34.30   | 29.9 秒        |
| C2     | 31.56   | 32.4 秒        |
| C3     | 30.78   | 33.3 秒（21% frame skip 異常）|
| C4     | 30.39   | 33.7 秒        |
```

GPU saturated、光源 NEE ≤ 12%、BVH+Material 共用 ≥ 88%。

---

## Phase 1.5 Step 1（SAH 切換）失敗紀錄不變

四 config 一致 -38~39%，已回滾保留 Fast。詳 `.omc/REPORT-R6-2-Phase-1.5-Step1-SAH-rollback.md`。

---

## Step 2 執行 OMC 候選（待使用者裁示）

```
路徑 A：/oh-my-claudecode:ultrawork
  適合：plan 已含完整 Step 0/1A/1B/1C/1D1/1D2/1E task list
  優：plan 已 APPROVED、task 結構齊備、background 跑長量測
  風險：循序依賴鏈，每 Step fail 即停
  工時：樂觀 12 hr / Step 0 早期止損 1.5 hr / D1 中期止損 11 hr

路徑 B：/oh-my-claudecode:team N:executor
  適合：Step 0a / Step 0b 可並行（不同 GPU instrumentation）
  優：可平行兩 worker 跑 0a 與 0b、再合併
  風險：Step 0 內子任務有依賴（0a 跑完才決定 0b 跑不跑）
  工時：與 ultrawork 接近、可能稍快

路徑 C：直接動工（手動跑每 Step）
  優：最大控制力、踩坑可即時調整
  風險：使用者要全程在場
  工時：和 ultrawork 接近，但人力成本高

建議：路徑 A /ultrawork（plan 已具備執行所需所有資訊）
```

---

## 環境快取

```
GPU: Apple M4 Pro (Metal Renderer via ANGLE)
WebGL: hardware accelerated
量測時環境：
  Server: python3 -m http.server 9001（cwd=Home_Studio_3D/）
  Browser: Brave + MCP Playwright Chromium 雙端

接手時必須驗證：
  1. server 是否還在跑（lsof -iTCP:9001）
  2. Playwright session 是否還活
  3. baseline 數據以 .omc/REPORT-R6-2-Phase-1.0.md 為準
  4. ralplan v3 plan 路徑：.omc/plans/R6-2-Phase-1.5-Step2-leaf-fetch-packing.md
  5. 工作樹乾淨：git status --short 應只有 docs/架構升級計畫/ untracked
```

---

## Hard rule

```
DO NOT 動 shader 結構優化前未跑 Step 0 探針三條件閘
DO NOT 跳過 1024-spp pixel diff = 0 視覺驗證
DO NOT 多優化疊一 commit
DO NOT 自動啟動 Step 2（等使用者明確選 A / B / C）
DO NOT 重做 SAH 切換實驗（已驗證 -39%）
DO NOT 把 PathTracingCommon.js 當 RAF host（RAF 在 InitCommon.js:879）
DO NOT 假設 1024-spp baseline 已存在（必先 Step 1C-0 補拍）
DO NOT 用 Y_estimate 選 A 而不評估 atomic counter revert 成本（建議選 B）
```
