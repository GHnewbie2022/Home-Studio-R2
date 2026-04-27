# R6-2 Handover — Phase 1.5 Step 2 Step 0 ❌ fail-fast，等使用者裁示走 X/Y/Z

> 最後更新：2026-04-27
> 狀態：
>   - Phase 1.0 ✅ 完工（baseline 30~34 秒 1024-spp 牆鐘）
>   - Phase 1.5 Step 1 SAH builder 切換 ❌ 失敗 -39% 回滾
>   - Phase 1.5 Step 2 ralplan v3 ✅ APPROVED
>   - Phase 1.5 Step 2 Step 0 探針閘 ❌ fail-fast（leaf P4 fetch Δ ≤ 1%）
>   - SOP §86 a + d 雙失敗 → BVH 結構優化整支可信度下降
>   - 等使用者裁示走 X/Y/Z 候選路徑

---

## 接手第一步（不得跳過）

依序讀：

```
1. .omc/REPORT-R6-2-Phase-1.5-Step2-step0-noop.md（最新失敗紀錄 + X/Y/Z 候選）
2. .omc/REPORT-R6-2-Phase-1.5-Step1-SAH-rollback.md（前次失敗 SAH -39%）
3. .omc/REPORT-R6-2-Phase-1.0.md（Phase 1.0 完整 baseline）
4. .omc/plans/R6-2-Phase-1.5-Step2-leaf-fetch-packing.md（v3 ralplan APPROVED 計畫）
5. docs/SOP/R6：渲染優化.md（主線 2 + a/d 雙失敗已標記）
6. docs/SOP/Debug_Log.md 開頭通用 Debug 紀律三條
```

---

## ralplan + 兩次實證的核心結論

```
ralplan v3 三輪共識預測 leaf fetch packing 上限可能 ≈ 0%（Architect A1+A4）
Step 0 探針 30 分鐘量測實證：C1=0.00% / C2=0.00% / C4=0.98% Δ
→ ANGLE Metal 已自動 DCE 或 fetch cache locality 緊密
→ packing 上限 ≤ 1%，遠低於 +5% commit 門檻
→ 整段 Step 1A~1E 9 hr 工程跳過，淨節省 8 hr

ralplan ROI：3 輪 Planner+Architect+Critic 流量 vs 8 hr 工程節省 + 第三次失敗教訓
（前兩次：R6-1 撤回 0.6 d、SAH -39%）
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

## 候選路徑 X/Y/Z（待使用者裁示）

```
路徑 X：嘗試 SOP §86 c (while-loop traversal)
  改動：fragment shader BVH traversal 由 stack-based 改 while-loop
  風險：高
  預期：≤ 5%（a/d 都失敗，估收穫上限低）
  工時：3~5 天
  OMC：必須 ralplan
  建議：不進

路徑 Y：跳到主線 1 階段 2 時序累積 reproject
  R6-1 撤回不否定本階段（時序面 vs 空間面物理機制不同）
  工時：1~2 週
  OMC：ralplan 三輪
  風險：中
  預期：對「均勻雜點」物理上有效（previous frame motion vector 累積）

路徑 Z：R6-2 結案
  1024-spp 30~34 秒在 Apple M4 Pro 上是合理水準
  廠商討論用 C1（30 秒）可接受
  工時：0
  風險：0
  推薦：✅ 強烈建議
```

---

## 推薦路徑 Z 的理由

```
1. SAH (a) -39% + leaf packing (d) ≤ 1% 兩次失敗證明 BVH 結構優化空間幾乎已用盡
2. 剩餘 b/c 收穫上限估 ≤ 5%、風險高（fragment shader 重寫）、ROI 不正向
3. 主線 1 階段 2 reproject 是「投資不同維度」工時 1~2 週、回報未知
4. 30 秒 1024-spp 在 M4 Pro 是合理基準，廠商討論不卡節奏
5. R6-1 撤回 + SAH 失敗 + leaf packing 失敗 = 三次 R6 內部失敗
   合理停損點：R6 結案、轉軸進實體錄音室 config 研究（5 月底前主軸）
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
  2. shader/JS 已 revert（git diff HEAD shaders/Home_Studio_Fragment.glsl 應為空）
  3. baseline 數據以 .omc/REPORT-R6-2-Phase-1.0.md 為準
```

---

## Hard rule

```
DO NOT 重做 SAH 切換（已驗證 -39%）
DO NOT 重做 leaf fetch packing（已驗證 ≤ 1%）
DO NOT 自動進路徑 X/Y（必須使用者明確選）
DO NOT 跳過 1024-spp pixel diff = 0 視覺驗證（若日後路徑 X/Y 啟動）
DO NOT 重啟 ralplan 共識後不對齊 plan 第一性原理（探針優先）
```
