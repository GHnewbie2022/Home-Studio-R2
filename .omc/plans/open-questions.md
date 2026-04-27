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

## R6-2 Phase 1.5 Step 2 leaf fetch packing — 2026-04-27（Planner v1）

來源：`.omc/plans/R6-2-Phase-1.5-Step2-leaf-fetch-packing.md` §F

- [ ] **Q1**：5-texel 順序重排「真的能 early-out 省 fetch」嗎？— ANGLE 編譯後是否 serialize texelFetch、是否 burst coalesce 已抹平人工 early-out 收益 — 影響整個 Option 3 的核心假設；建議 Architect 提 steelman antithesis「人工 early-out 收穫 0%」並設低成本反證實驗。
- [ ] **Q2**：是否存在 Option 5（4-texel layout）？— uintBitsToFloat 把 fixtureGroup/cullable/meta/type 四個整數 pack 進單 channel，per-box 直接省 20% fetch 數 — 影響是否升級首選方案；待 Architect/Critic 評估「不損精度」邊界。
- [ ] **Q3**：updateBoxDataTexture 之外是否有第三條 boxData 寫入路徑？— grep `tBoxDataTexture.value` 確認 — 影響 Step B 雙端同步完整性；交 Critic 驗。
- [ ] **Q4**：NEE shadow 路徑是否也呼叫 fetchBoxData？— grep `fetchBoxData(` 全部呼叫點 — 影響 Step C 是否漏改一處；交 Architect 驗 grep 結果。
- [ ] **Q5**：C3 21% frame-skip 異常是否會把 Step D 量測污染到誤判通過？— 建議 commit 門檻改「C1/C2/C4 至少 2 個 ≥ +5%」、C3 取消投票權僅供參考；交 Critic 裁決。
- [ ] **Q6**：本步驟是否同步把 BVH_TEX_W 從 512 升 1024 為 R3-8 採購擴張預留？— 建議否（守 P1 域純度），R3-8 階段獨立做；交使用者最終裁定。
- [ ] **Q7**：USE_PACKED_BOXDATA 切 hard-code `#define` 還是 runtime uniform？— 建議 hard-code（compile-time）以 Step D 跑兩個 build 對比；交 Architect 確認對 Step E 後續維護負擔評估。
