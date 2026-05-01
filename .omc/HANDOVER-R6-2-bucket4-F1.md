# R6-2 桶 4 F1 mini-handover — ✅ 結案 2026-04-27（C3 21% frame-skip debug）

> 上層 handover：`/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOVER-R6-2.md`
> 結案 report：`/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/REPORT-R6-2-bucket4-F1-conclusion.md`
> 上層 handover 已含完整 R6-2 全局狀態 + 接手第一步讀檔清單

---

## 結案摘要（2026-04-27）

```
Root cause：啟動暫態（前 2 秒）瀏覽器 RAF 60Hz 跟 GPU 26ms/frame 不同步、
            被 InitCommon.js L877 60fps gate 擋下、穩態下 RAF 自動降到
            ~39Hz 後 frame-skip 完全消失
穩態損失：≈ 0%
累積 1024 spp 影響：≈ 2.9%（低於 ralplan +5% commit 門檻）
ratio 浮動 11% 解釋：量測 window 起點與 panel 切換時刻的相對距離不同
決策：不修（修法都觸碰框架核心、收益人眼難察覺）
詳細論證：.omc/REPORT-R6-2-bucket4-F1-conclusion.md
```

---

## 結案流程紀錄

```
systematic-debugging Phase 1 evidence（已收）
  - 讀完 InitCommon.js + Home_Studio.js 關鍵段落
  - 4 個 hypothesis 排序

Phase 1 instrumentation（5 秒 RAF trace + 0.5 秒 sliding window）
  - acc=0 frame 100% 對應 dtLR < 16.67ms（gate L877 條件）
  - acc=0 frame 100% 對應 lrChanged=false
  - moving=true / sw>0 全 trace 0 個 → hypothesis (a) 排除
  - sliding window ratio 從 0.5 平滑爬到 1.0、明確 transient → 穩態切換點 = 2 秒

Phase 2 修復方案評估
  方案 A：移除 60fps gate（成本高、風險高、收益 ~3%）❌
  方案 B：暖機跳過前 2 秒不算 sample（cosmetic、無實質意義）❌
  方案 C：不修、修正 Phase 1.0 報告 §5 描述 ✅ 採用

Phase 3 + 4：跳過（不修決策、無實作 + 驗證需求）

文件更新（已完成）
  - REPORT-R6-2-bucket4-F1-conclusion.md（新增）
  - REPORT-R6-2-Phase-1.0.md §2 + §4 + §5 + §8（修正 21% 描述、F1 標 ✅）
  - HANDOVER-R6-2.md（F1 標 ✅、Hard rule 加一條、推薦改桶 2 #2）
  - HANDOVER-R6-2-bucket4-F1.md（本檔、改結案版）
  - ROADMAP-R6-2-optimization-buckets.md（§4-1 標 ✅、推薦排序更新）

未動：
  - SOP/R6：渲染優化.md（等 R6-2 整體結案再一起更新）
  - git commit（等使用者裁示 R6-2 整體狀態）
```

---

## 給接手 AI 的 Hard rule

```
DO NOT 重做 F1 frame-skip 量測（已結案）
DO NOT 重新啟動 F1 hypothesis (a)/(b)/(c)/(d) 評估（已收斂）
DO NOT 動 InitCommon.js L877 60fps gate（不修決策、修法觸碰框架核心）
DO NOT 加 startup warm-up（cosmetic、收益低）

如使用者改變主意要修：
  - 強制讀完 .omc/REPORT-R6-2-bucket4-F1-conclusion.md §5 三方案完整評估
  - ralplan 三輪共識後再動工（修法都觸碰框架核心、屬高風險）
  - 必驗 1024-spp pixel diff = 0
```

---

## 下一步（給接手 AI）

```
F1 已結案、進入 R6-2 下一步候選：

路徑 B：桶 2 #2 Russian Roulette 調校 ★ 推薦
  工時：1~2 天、風險：低、預期：≤ 10% spp/sec 提升

路徑 C：R6-2 整體結案
  桶 1/2/3/5 全擱置

詳：.omc/HANDOVER-R6-2.md §下一步候選路徑
```

---

## 修訂歷史

- 2026-04-27 初版（F2 結案後流量稀缺、開新窗交接 F1 Phase 1 進度）
- 2026-04-27 結案版（systematic-debugging Phase 1 evidence + Phase 2 不修決策完工）
