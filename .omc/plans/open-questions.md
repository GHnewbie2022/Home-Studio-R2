# Open Questions

> 跨 plan 的未解問題、延後決策、待使用者裁定事項集中於本檔。
> Planner / Analyst 產出新 plan 時把 open questions 追加於此，而非散落於各 plan。

## R3-6.5 動態光源池 — 2026-04-20（iter 2 更新）

- [ ] **Q2**：shader helper 雙函式並存 vs 單函式 `uR3DynamicPoolEnabled` 分支 — 前者（iter 2 採納）rollback 二分定位乾淨但維護成本 × 2、後者維護簡潔但有 GLSL Dead Code Elimination（死碼消除）風險（對齊 memory `feedback_pathtracing_dce_sink_gate_trap.md`） — 影響日後刪除 legacy helper 的時機（FU3）。Architect iter 2 可複核此選擇，若仍堅持單函式則須附 DCE 量化證據。
- [ ] **Q4**：contract test `docs/tests/r3-6-5-dynamic-pool.test.js` 落地時機 — Step 6 與 End-to-End 驗收合併 fix06 vs 獨立 `r3-6-5-fix07-contract-test` — 影響 cache-buster 數量與 ultrawork 迭代粒度。

> iter 2 已決議移除：
> - ~~Q1（pdfNeeForLight 讀 uniform vs 加參數）~~ → 採「加 `float selectPdfArg` 參數」，記入 R3-6.5.md ADR Decisions
> - ~~Q3（observability N 值顯示位置）~~ → 採「GUI label 即時顯示 N」，Step 6 實作 `activeLightCountDisplay` textCtrl

## R6-1 階段 1（Bilateral Post-Denoise）

> Open Questions 已遷入 docs/SOP/R6-1：雙邊濾波後處理降噪.md §G
