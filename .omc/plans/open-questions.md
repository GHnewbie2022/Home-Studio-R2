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

## R6-2 桶 4 F2 三段 timer 拆解 — 2026-04-27（Planner v3，Critic ITERATE 後採 OQ1 嚴格版）

來源：`.omc/plans/R6-2-bucket4-F2-timer-breakdown.md` §F + §H v3 條目

> v3 修訂歷程：
>   Planner v1 → Architect r1 REVISE（5 致命 + 4 應修）
>   → Planner v2（5 致命全閉鎖）→ Architect r2 APPROVE w/caveats（3 caveat）
>   → Critic r2 ITERATE（4 MAJOR + 5 MINOR + 3 建議）
>   → 使用者裁示採 B 選項：跳過 Round 3 共識、採 OQ1 嚴格版
>   → Planner v3（4 MAJOR + 3 caveat 全閉鎖、本檔同步）

- [ ] **Q1**：probe 切點位置是否最佳？— Stage A：mode 1 在 sampleStochasticLightDynamic L262 後 / L263 前 early-return + caller-side 10 處 NEE dispatch break；mode 2 在 SceneIntersect 後 (L971) / hitType 分支前 (L1013) 區間 break + 4 個發光 hitType emission 預載（LIGHT + TRACK_LIGHT + TRACK_WIDE_LIGHT + CLOUD_LIGHT）。Stage B 改 #ifdef N+1 編譯時 build。改切點則差分公式變、業務語義變、§A.2 D1 須重寫；v3 已 lock。
- [ ] **Q2**：NEE shadow ray 之 secondary SceneIntersect 算入 BVH 還是 NEE？— Stage A 採前者（業務語義打折扣、T_NEE 不含 secondary BVH 走訪、歸 T_first_hit_BVH）；Stage B Option 3 #ifdef 整段 wrap 後可徹底切離。v3 lock：兩階段策略採納。
- [ ] **Q3**：量測 window 內 sampleCounter 安全區間？— 當前 [10, MAX_SAMPLES − 100]、替代 sceneIsDynamic = true 強制 sampleCounter = 1.0（會打亂 progressive refinement 視覺對比） — 影響 RAF host throttle 對齊紀律；交 Critic 評是否需 needClearAccumulation 自動觸發。
- [ ] **Q4**：C3 21% frame-skip 處理 — v3 lock 採「標棄權無投票權」（對齊 plan v3 leaf-packing §C.5 體例 + Phase 1.0 §5 21% frame-skip 教訓）；替代「加投票權 + 5% 修正係數補償」延後評估、僅作 follow-up F-F2-2。
- [ ] **Q5**：probe build 半年保留還是即移除？— v3 lock 採「保留半年」（對齊 plan v3 ADR 體例 + USE_PACKED_BOXDATA 同期）；F2 完工後評估 follow-up F-F2-1。
- [ ] **Q6**：若 Step 0 fail-fast，升 Option 3 (N+1 編譯時 build) 還是退場？— v3 lock 採嚴格版：< 1% 合格 / ≥ 1% 即升 Stage B（Option 3 #ifdef）、Stage B 仍 fail-fast 才退場（Path U）；取消 v2「1%~3% 警告繼續 Stage A」帶（Critic MJ2）。
- [ ] **Q7**：若 mode 1/mode 2 視覺截圖肉眼判斷與預期不符（如 mode 1 不夠暗）是否需 GPU pipeline trace 補證？— 影響 Test I3/I4 acceptance 標準；交 Architect 評。
- [ ] **Q8**：結論判斷規則「≥ 30% 為瓶頸」之灰色帶（28~30%）處理？— 標「準瓶頸」還是「不可信」 — SOP §86 寫「>30%」與本計畫採「≥ 30%」差 1% 視為對齊但灰色帶處理需明確；交 Critic 確認。
- [ ] **Q9**：EXT_disjoint_timer_query_webgl2 query pool 大小？— 當前推測 8（ANGLE/Metal 限制）、替代 4 / 16 — 影響 Scenario 2 GPU_DISJOINT 觸發率；2026-04-27 探針已驗 EXT 支援、pool size 待 Step 0-2.5 量測補驗。
- [ ] **Q10（v3 新增，Critic MJ4）**：mode 2 emission 預載是否該擴大到所有發光 hitType？— v3 採「LIGHT + TRACK_LIGHT + TRACK_WIDE_LIGHT + CLOUD_LIGHT」共 4 個發光 hitType（Cam 1 視場含吸頂燈 + 軌道燈、必須涵蓋）；shader 親證 hitType 平行分支共 17 處、其中 4 個為發光體；若實作後仍有發光體分支漏列（如 second CLOUD_LIGHT L1664 OR-and case），補列即可。
- [ ] **Q11（v3 新增，Critic OQ1）**：Stage A 失敗為「預期常態」還是「異常」？— v3 採嚴格版「預期常態」、視為 Step 0a fast-skip 探針價值（即使 Stage A 9 hr 工程沉沒、Stage B 升級路徑仍有效）；對應 Critic 推薦 OQ1 嚴格版。
