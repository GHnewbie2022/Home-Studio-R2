# R6-2 Handover — Phase 1.5 Step 1 SAH 失敗回滾，下一步待裁示

> 最後更新：2026-04-27
> 狀態：
>   - Phase 1.0 ✅ 完工
>   - Phase 1.5 Step 1（SAH 切換）❌ 失敗回滾
>   - Phase 1.5 Step 2 待使用者裁示走哪條路徑

---

## 接手第一步（不得跳過）

依序讀：

```
1. docs/SOP/R6：渲染優化.md（主線 2，含 Phase 1.0 完工 + Phase 1.5 step 1 SAH ❌ 標記）
2. .omc/REPORT-R6-2-Phase-1.0.md（Phase 1.0 完整盤點報告）
3. .omc/REPORT-R6-2-Phase-1.5-Step1-SAH-rollback.md（SAH 失敗對照表 + 推測 + 下一步建議）
4. docs/SOP/R6-1：雙邊濾波後處理降噪.md §R6-1-W（演算法效果未知時 prototype-first）
5. docs/SOP/Debug_Log.md 開頭通用 Debug 紀律三條
```

---

## Phase 1.0 結論（不變）

```
1024-spp 牆鐘：C1=29.9s / C2=32.4s / C3=33.3s / C4=33.7s
GPU saturated（spp_per_frame ≈ 1）
光源端 NEE 成本 ≤ 12%
剩下 ≥ 88% 在 BVH traversal + Material BRDF 共用路徑
```

---

## Phase 1.5 Step 1（SAH 切換）❌ 失敗回滾

```
| Config | Fast spp/sec | SAH spp/sec | 變化 |
|--------|--------------|-------------|------|
| C1 | 34.30 | 21.17 | -38% |
| C2 | 31.56 | 19.21 | -39% |
| C3 | 30.78 | 18.63 | -39% |
| C4 | 30.39 | 18.43 | -39% |

四 config 一致變慢 ~39%、1024-spp 牆鐘從 30~34 秒拉到 48~56 秒。
立即回滾保留 Fast。
推測原因：78 box 對 SAH 是小場景、過度切分導致樹深增加。
詳見 .omc/REPORT-R6-2-Phase-1.5-Step1-SAH-rollback.md
```

---

## Phase 1.5 Step 2 候選路徑（待使用者裁示）

```
路徑 A：leaf fetch packing
  改動：
    - js/Home_Studio.js: BVH 寫入 boxData texture 5 條 vec4 → 合併 2~3 條
    - shaders/Home_Studio_Fragment.glsl: fetchBoxData() 改寫
  風險：中（fragment shader 動結構 + 必須 1024-spp pixel diff = 0 視覺驗證）
  預期：+20% ~ +40% spp/sec
  工時：1~2 天
  OMC 工具：建議 /ralplan 取共識（多階段演算法敏感）→ /ultrawork 執行

路徑 B：放棄結構優化、改 NEE cache
  Phase 1.0 推論光源 NEE ≤ 12% 成本
  收穫上限 12%
  風險：低
  工時：0.5~1 天
  OMC 工具：直接動工

路徑 C：R6-2 結案
  1024-spp 30~34 秒可接受、Apple M4 Pro 上路徑追蹤已合理
  進到主線 1 階段 2 reproject 評估（時序累積降噪）
  R6 SOP 整體順序最後段
```

---

## 環境快取（量測時狀態，非 live）

```
GPU: Apple M4 Pro (Metal Renderer via ANGLE)
WebGL: hardware accelerated
量測時環境：
  Server: python3 -m http.server 9001（cwd=Home_Studio_3D/）
  Browser: Brave + MCP Playwright Chromium 雙端

接手時必須驗證：
  1. server 是否還在跑（lsof -iTCP:9001）
  2. Playwright session 是否還活（先 evaluate location.href）
  3. baseline 數據以 .omc/REPORT-R6-2-Phase-1.0.md 為準
  4. 工作樹乾淨：git status --short 應只有 docs/架構升級計畫/ untracked
```

---

## Hard rule

```
DO NOT 動 shader 結構優化前未量 baseline
DO NOT 多個優化疊一個 commit（bisect 成本爆）
DO NOT 跳過 1024-spp pixel diff = 0 視覺驗證
DO NOT 自動啟動 Phase 1.5 Step 2（等使用者明確選 A / B / C）
DO NOT 重做 SAH 切換實驗（已驗證 -39%，2026-04-27 已歸檔）
```
