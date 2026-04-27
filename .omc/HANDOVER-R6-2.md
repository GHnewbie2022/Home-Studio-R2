# R6-2 Handover — Phase 1.0 ✅ 完工，Phase 1.5 待啟動

> 最後更新：2026-04-27
> 狀態：Phase 1.0 已封閉，等使用者裁示啟動 Phase 1.5

---

## 接手第一步（不得跳過）

依序讀：

```
1. docs/SOP/R6：渲染優化.md（主線 2，含 Phase 1.0 完工標記）
2. .omc/REPORT-R6-2-Phase-1.0.md（Phase 1.0 完整盤點報告）
3. docs/SOP/R6-1：雙邊濾波後處理降噪.md §R6-1-W（演算法效果未知時 prototype-first）
4. docs/SOP/Debug_Log.md 開頭通用 Debug 紀律三條
5. memory feedback_pathtracing_clamp_bandaid_masks_root_cause.md（band-aid clamp 警示）
```

---

## Phase 1.0 完工結論

```
1024-spp 牆鐘：C1=29.9s / C2=32.4s / C3=33.3s / C4=33.7s
GPU saturated（spp_per_frame ≈ 1，除 C3 21% frame 跳過異常）
光源端 NEE 成本 ≤ 12%
剩下 ≥ 88% 在 BVH traversal + Material BRDF 共用路徑
BVH builder 現用 Fast，SAH 閒置（切換成本 2 行）

→ 進 Phase 1.5
→ 第一步：SAH builder 切換（最便宜驗證）
```

完整數據、量測腳本、踩坑紀錄、follow-up 全在 `.omc/REPORT-R6-2-Phase-1.0.md`。

---

## Phase 1.5 啟動指引（待使用者裁示）

依 SOP 第 86 行分流規則，第一步 SAH builder 切換：

```
1. shaders/Home_Studio_Fragment.glsl 完全不動
2. 改 Home_Studio.html：把 BVH_Acc_Structure_Iterative_Fast_Builder.js
   import 換成 BVH_Acc_Structure_Iterative_SAH_Builder.js
3. 改 js/Home_Studio.js：BVH_Build_Iterative 函式名換成 SAH 對應名
   （SAH builder 內函式名需 grep 確認）
4. 重整頁面，每個 Config 跑 5 秒 RAF 量測腳本（見報告 §2.1）
5. 對比 Phase 1.0 baseline：
   - 變快 ≥ 5% → 確認 BVH 結構是瓶頸要素，commit + 進 leaf packing
   - 變快 < 5% 或變慢 → 排除 BVH 結構，回滾 commit、下一步動 leaf fetch / material
6. 視覺驗證：1024-spp pixel diff vs Phase 1.0 baseline = 0（守門禁忌 2）
```

OMC 工具推薦：直接動工（單檔瑣事級改動，不需 ralplan）。

---

## 環境快取（量測時狀態，非 live）

```
量測時環境（2026-04-27）：
  Server: python3 -m http.server 9001（cwd=Home_Studio_3D/）
  Browser: Brave + MCP Playwright Chromium 雙端
  GPU: Apple M4 Pro Metal Renderer（ANGLE）
  WebGL: hardware accelerated

接手時必須驗證：
  1. server 是否還在跑（lsof -iTCP:9001）
  2. Playwright session 是否還活（先 evaluate location.href）
  3. Phase 1.0 baseline 數據以 .omc/REPORT-R6-2-Phase-1.0.md 為準
```

---

## Hard rule

```
DO NOT 動 shader 結構優化前未量 baseline
DO NOT 多個優化疊一個 commit（bisect 成本爆）
DO NOT 跳過 1024-spp pixel diff = 0 視覺驗證
DO NOT 自動啟動 Phase 1.5（等使用者「繼續」/「開始 1.5」/「OK」）
```
