# R6-2 Handover — 桶 4 F1 ✅ 結案，使用者選留候補（下一步桶 2 #2 Russian Roulette 待啟動）

> 最後更新：2026-05-01（R6 後製子線 LGG-r30 完工後使用者裁示「留候補」）
> 下一步交接：`.omc/HANDOFF-next-russian-roulette.md`
> 狀態：
>   - Phase 1.0 ✅ 完工（baseline 30~34 秒 1024-spp 牆鐘）
>   - Phase 1.5 Step 1 SAH builder 切換 ❌ 失敗 -39% 回滾
>   - Phase 1.5 Step 2 ralplan v3 ✅ APPROVED
>   - Phase 1.5 Step 2 Step 0 探針閘 ❌ fail-fast（leaf P4 fetch Δ ≤ 1%）
>   - SOP §86 a + d 雙失敗 → BVH 結構優化整支可信度下降
>   - Y 擱置（廠商討論場景靜態為主、reproject 動機未到）→ 五桶 ROADMAP 落地
>   - 桶 4 F2 三段 timer 拆解 ralplan v3 ✅ APPROVE w/caveats（共識 v1→v2→v3）
>   - 桶 4 F2 Step 0 探針閘 ❌ fail-fast（probe overhead ≥ 1.24%、Stage A 不可行）
>   - 使用者採 B 選項：F2 結案、撤回探針程式碼、跳到桶 4 F1
>   - R6-2 內累計四連敗（R6-1 / SAH / leaf packing / F2 Stage A）
>   - 桶 4 F1 ✅ 結案 2026-04-27（root cause = 啟動暫態 RAF cadence + 60fps gate、不修）

---

## 接手第一步（不得跳過）

依序讀：

```
1. .omc/REPORT-R6-2-bucket4-F1-conclusion.md（最新：F1 結案、暫態 RAF cadence + 60fps gate、不修）
2. .omc/REPORT-R6-2-bucket4-F2-step0-noop.md（前次：F2 Step 0 fail-fast、桶 4 F1 推薦）
3. .omc/REPORT-R6-2-Phase-1.5-Step2-step0-noop.md（前前次：leaf packing fail-fast）
4. .omc/REPORT-R6-2-Phase-1.5-Step1-SAH-rollback.md（前前前次：SAH -39%）
5. .omc/REPORT-R6-2-Phase-1.0.md（Phase 1.0 完整 baseline、§5 C3 frame-skip 已標 ✅ 結案）
6. .omc/plans/R6-2-Phase-1.5-Step2-leaf-fetch-packing.md（v3 ralplan APPROVED 計畫）
7. .omc/plans/R6-2-bucket4-F2-timer-breakdown.md（v3 共識計畫、Step 0 fail-fast 後保留作體例參考）
8. .omc/ROADMAP-R6-2-optimization-buckets.md（五桶後續路徑地圖、桶 4 F1 ✅ + F2 ⏸）
9. docs/SOP/R6：渲染優化.md（主線 2 + a/d 雙失敗已標記）
10. docs/SOP/Debug_Log.md 開頭通用 Debug 紀律三條
```

---

## ralplan + 兩次實證的核心結論

```
ralplan v3 三輪共識（leaf packing）預測上限可能 ≈ 0%（Architect A1+A4）
Step 0 探針 30 分鐘量測實證：C1=0.00% / C2=0.00% / C4=0.98% Δ
→ ANGLE Metal 已自動 DCE 或 fetch cache locality 緊密
→ packing 上限 ≤ 1%，遠低於 +5% commit 門檻
→ 整段 Step 1A~1E 9 hr 工程跳過，淨節省 8 hr

ralplan v3 三輪共識（F2 三段 timer，2026-04-27）：
  Critic Round 2 OQ1 嚴格版預測：「Stage A probe overhead ≥ 1%、Stage A 大概率沉沒」
  Step 0 探針 1 hr 寫程式碼 + 5 分鐘量測實證：
    C1 -8.0% (含 frame-skip 污染) / C2 -1.24% (高可信度) / C4 -3.88%
  → 1 處 if 已超嚴格 1% 閘、13 處加齊必加倍
  → Stage A + Stage B 9~13 hr 工程跳過、F2 結案

ralplan ROI 累計：4 次 R6 失敗（R6-1 / SAH / leaf packing / F2 Stage A）
  其中後 2 次靠 ralplan + Step 0 探針 fast-skip、共節省約 17~21 hr 工程
```

---

## SOP §86 結構優化分流現況

```
a) SAH_Builder 切換             ❌ -39%（Phase 1.5 Step 1）
b) BVH node packing             未試（風險高、a+d 雙失敗使可信度低）
c) Stack vs while-loop traversal 未試（fragment shader 重寫，risk)
d) leaf fetch packing            ❌ ≤ 1%（Phase 1.5 Step 2 Step 0）
```

---

## ROADMAP 五桶現況（Y 擱置 + F2 fast-skip 後）

```
桶 1 SOP §86 b/c           不進（a+d 雙失敗使可信度低）
桶 2 通用優化               #2 Russian Roulette 風險低、收穫保守 ≤ 10% ★ 推薦下一步
桶 3 R3-8 觸發               場景 ≥ 200 box 才動
桶 4 F1 C3 21% frame-skip   ✅ 結案 2026-04-27（暫態 RAF cadence、不修）
桶 4 F2 三段 timer          ⏸ 暫緩（Step 0 fail-fast 2026-04-27）
桶 4 F3 spectorJS dump      閒暇做、優先序低
桶 5 跳出 R6 範圍           等下世代專案

詳：.omc/ROADMAP-R6-2-optimization-buckets.md
```

---

## 下一步候選路徑（待使用者裁示）

```
路徑 A：桶 4 F1 C3 21% frame-skip debug ✅ 已完成 2026-04-27
  詳：.omc/REPORT-R6-2-bucket4-F1-conclusion.md

路徑 B：桶 2 #2 Russian Roulette 調校 ★ 推薦
  工時：1~2 天
  風險：低
  預期：≤ 10% spp/sec 提升
  OMC：可直接 executor

路徑 C：R6-2 整體結案
  R6-2 1024-spp 30~34 秒在 Apple M4 Pro 是合理水準
  桶 1/2/3/5 全擱置
  推薦：可做、但路徑 B 風險低工時短、可優先消化
```

---

## 環境快取

```
GPU: Apple M4 Pro (Metal Renderer via ANGLE)
Server: python3 -m http.server 9001（cwd=Home_Studio_3D/）
Browser: Brave + MCP Playwright Chromium 雙端
工作樹乾淨：git status --short 應只有 docs/架構升級計畫/ untracked

接手必驗：
  1. server 是否還在跑（lsof -iTCP:9001）
  2. shader/JS 已 revert（git diff HEAD shaders/Home_Studio_Fragment.glsl 應為空、
     js/Home_Studio.js uniform 註冊段應無 uSegmentMode）
  3. F2 探針痕跡：Home_Studio.html 留 ?v=f2-step0-probe + favicon link，
     js/Home_Studio.js L963 query 同（無功能影響、實證痕跡保留）
  4. baseline 數據以 .omc/REPORT-R6-2-Phase-1.0.md 為準
```

---

## Hard rule

```
DO NOT 重做 SAH 切換（已驗證 -39%）
DO NOT 重做 leaf fetch packing（已驗證 ≤ 1%）
DO NOT 重做 F2 Stage A probe（已驗證 probe overhead ≥ 1.24%）
DO NOT 重做 F1 frame-skip 量測（已結案、root cause = 啟動暫態 RAF cadence + 60fps gate、不修）
DO NOT 重啟 F2 ralplan（plan v3 已落地、Stage B follow-up 等 R3-8 觸發）
DO NOT 自動進路徑 B/C（使用者明確選才動）
DO NOT 跳過 1024-spp pixel diff = 0 視覺驗證（若日後 BVH 結構優化重啟）
DO NOT 重啟 ralplan 共識後不對齊 plan 第一性原理（探針優先）
```
