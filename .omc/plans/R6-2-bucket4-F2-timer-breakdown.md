# R6-2 桶 4 F2 — 三段 timer 拆解 Plan v3（Critic ITERATE 後採 OQ1 嚴格版）

> ★ v3 整體精神（Critic Round 2 ITERATE 後採嚴格版裁示）：
>   - Round 3 共識流量被使用者裁示「跳過」（B 選項：採 Critic ITERATE 結論做精簡決策）
>   - Critic OQ1 兩處 fix 皆採嚴格版：
>     · MJ1 fix 選項 b：保留 E2'-c ≤ 50% 但標 Stage A 失敗為預期常態（fast-skip 性質）
>     · MJ2 fix 選項 a：取消 1~3% 警告帶，嚴格 < 1% 合格 / ≥ 1% 即升 Stage B
>   - MJ3 規則 7 改 pass/fail 二元（commit gate 機械化執行）
>   - MJ4 mode 2 emission 範圍擴大為 4 個發光 hitType
>   - 3 caveat 全閉鎖（open-questions.md 同步、§F Q1 註腳、§A.3 數字統一）
>   - 詳見 §H v3 條目

> 模式：Deliberate consensus
> Round：v2（Planner 修訂，回應 Architect Round 1 REVISE 5 must-fix + 4 應修）
> 理由：
>   1. 演算法量測敏感（探針切錯三段 → 結論失準等同 a+d 失敗等級的浪費，桶 4 F2 是「未來所有優化方向都受惠」之磨刀工作，量錯比不量更糟）
>   2. shader probe 點與 RAF host throttle 衝突風險高（Phase 1.0 §3.2 setInterval 偏低 30% 教訓尚熱）
>   3. 探針有 overhead 反向風險（Phase 1.5 Step 2 step0-noop §2 baseline 拖慢 36% 前車）
>   4. 此計畫 prima facie 無 viable alternative — 只剩量測法選擇（必須跨 ≥ 2 viable options + 排除理由）
>
> 上層 reference：
>   - SOP：`docs/SOP/R6：渲染優化.md` 主線 2 BVH 加速、§86 分流規則
>   - Phase 1.0 baseline：`.omc/REPORT-R6-2-Phase-1.0.md` §1 量測項目 3 / §3.2 RAF 量測法 / §5 C3 21% frame-skip / §8 F2
>   - Phase 1.5 Step 1 失敗：`.omc/REPORT-R6-2-Phase-1.5-Step1-SAH-rollback.md`
>   - Phase 1.5 Step 2 fail-fast：`.omc/REPORT-R6-2-Phase-1.5-Step2-step0-noop.md`（Step 0 探針閘 ROI 實證）
>   - 體例參考：`.omc/plans/R6-2-Phase-1.5-Step2-leaf-fetch-packing.md` v3 §A~§H 結構
>   - 路徑地圖：`.omc/ROADMAP-R6-2-optimization-buckets.md` 桶 4 F2 為桶 4 內最高價值
>   - Architect Round 1 反饋：`.omc/plans/R6-2-bucket4-F2-architect-r1.md`（5 致命 + 4 應修）
>
> 範圍邊界（守門禁忌，違反立即拒入 commit）：
>   1. 純 instrumentation：不動 BRDF / NEE / BVH 邏輯本體，只插 timer probe begin/end 與 segment-mode 跳過分支
>   2. shader probe 點僅在三段「之間」插 begin/end / 切段，不改 SceneIntersect / sampleStochasticLightDynamic / material switch 的「內部」邏輯
>   3. 動的檔案（預期）：
>      - `shaders/Home_Studio_Fragment.glsl`（加 segment-mode uniform 與 early-exit 分支；Stage A 注入 uniform 宣告 1 + sampleStochasticLightDynamic 入口 1 + caller-side 10 + SceneIntersect 後 1 = 13 處 if 分支、Stage B 改 #ifdef 重編譯 N+1 build）
>      - `js/InitCommon.js`（主 RAF host：query lifecycle + readback + GPU_DISJOINT 重試）
>      - `js/Home_Studio.js`（pathTracingUniforms 註冊 / Stage B 加 build flag swap）
>      - `.omc/REPORT-R6-2-Phase-1.0-timer-breakdown.md`（新增量測結果）
>   4. 不動：buildSceneBVH、updateBoxDataTexture、所有材質/光源邏輯、GUI、BVH builder JS
>   5. F2 只量測、不修瓶頸；不堆疊任何優化動作

---

## A. RALPLAN-DR Summary

### A.1 Principles（治理原則 5 條）

```
P1. Domain purity（範圍純度）
    僅插 timer probe begin/end + segment-mode early-exit 跳段，不改任一 BRDF / NEE / BVH
    走訪內部邏輯。違者立即拒入 commit。對齊 plan v3 leaf-packing 體例。
    v2 補強：Stage A instrumentation 站點數 = 1 (uniform) + 1 (sampleStochasticLightDynamic
            入口 mode 1 early-return) + 10 (caller-side mode 1 break) + 1 (SceneIntersect
            後 mode 2 break) = 13 處 if 分支；Stage B 改編譯時 #ifdef 路徑、shader 主源
            檔仍只動 13 處（用 #ifdef 包夾既有 mode 1/2 切點），無新切點。

P2. Prototype-first verification（最便宜驗證優先）★ v2 升為 hard gate
    Step 0 探針閘必前置：先量「probe 本身對 baseline spp/sec 的拖慢 < 1%」才允許進
    Step 1 真實量測。對齊 Phase 1.5 Step 2 step0-noop §2「baseline 拖慢 36% 前車」
    內化（見 v2 §B Scenario 3 收緊 30%→<1%）。
    若 probe overhead ≥ 1% → 自動升 Stage B（編譯時 #ifdef N+1 build）；
    若 Stage B 仍 ≥ 1% → fail-fast 退場。
    v2 修訂：門檻從 v1「< 2% 合格 / < 5% fail-fast」收緊為「< 1% 合格 / 1~3% 警告 /
            ≥ 1% 升 Stage B」。Stage B 若再失敗才退場。

P3. Atomic + reversible commits（原子且可逆 commit）
    Step 0 / 1A / 1B / 1C / 1D / 1E 各獨立 commit，獨立 git revert。任一 step 失敗
    rollback 點清楚不留殘骸。對齊 plan v3 體例。
    v2 補強：Stage A → Stage B 升級之 commit 對齊原 Step 邊界、不破壞 atomicity；
            Stage B 是 Step 0a 失敗時的「分支軌道」、不重建 Step 編號。

P4. Pixel-exact correctness gate（像素精準正確性閘）
    本計畫純 instrumentation，預設不動視覺，但 segment-mode early-exit build 必拍
    1024-spp 截圖 vs Phase 1.0 baseline magick AE = 0 對比，防分支誤插污染主路徑。
    baseline 不存在則先補拍（對齊 plan v3 §C.3 Test E1 1C-0 補拍策略）。
    v2 補強（對應 Architect P4 嚴重級違反）：ANGLE Metal 對 mode 1/2 的 if 分支可能
    codegen 為 select() / cmov（plan v1 §B Scenario 3 成因 b 自承）→ 兩路徑都跑，
    浮點 ALU 順序可能變 → mode 0 vs Phase 1.0 baseline AE 可能不為 0。Stage A 採
    soft-fail：若 AE > 0 但 ≤ 1 / 1% 像素數量 → 視為「ANGLE codegen 副作用」可進；
    若 AE > 1% → 升 Stage B（#ifdef 重編譯 mode 0 與 baseline shader 等價，AE = 0
    可達）。

P5. Threshold discipline + RAF host 對齊（門檻紀律）
    - 結論判斷：三段佔比 ≥ 30% 才視為瓶頸（對齊 SOP §86 分流規則）
    - 量測誤差容忍 ±5%（對齊 Phase 1.0 §2.2 vsync jitter 實測精度）
    - C1/C2/C4 至少 2 個一致才算可信（C3 21% frame-skip 棄權，對齊 plan v3 §C.5）
    - RAF host 量測必對齊 Phase 1.0 §3.2 RAF 法精神：sampleCounter 不可碰 cap、
      cameraSwitchFrames=3 必先消耗、needClearAccumulation 必先 reset、量測 window
      內所有 frame 都必須真有 path tracing STEP 1 跑（非 STEP 2/3 idle）
    - v2 修訂（對應 Architect P5 嚴重級違反）：Step 0 探針閘門檻收緊
      < 1% 合格 / 1~3% 警告 / ≥ 1% 升 Stage B；門檻從 v1 < 5% 收 4 個百分點
```

### A.2 Decision Drivers（決策驅動因子，前 3）

```
D1. probe 三段切點正確性（最重要）
    fragment shader 是「單一 draw call、單一 main()」結構，GPU timer query 只能包夾
    整個 draw call，無法在 shader 內 begin/end 切段。三段內部時間「不能直接量」，
    只能用差分法：插 segment-mode uniform 跳段，分別量 baseline / no-NEE / no-Material
    三個 mode 的 frame ms，差分推算佔比。

    ★ v2 修訂（對應 Architect M5）：SceneIntersect 在 shader 內僅 1 個呼叫點
       （L969，在 for-bounces 迴圈 L963 內，已 grep 親自驗）。NEE shadow ray 不是另
       一次 SceneIntersect 呼叫，而是下一輪 bounce iteration 的同一個 L969 呼叫。
       「業務語義」T_BVH = primary BVH + 連帶 secondary BVH，但「實作機制」兩者都
       走 L969 同一段程式碼；mode 1 early-return 無法切離 secondary BVH（rayDirection
       會被 caller 覆寫成 nl，下一輪仍走 SceneIntersect L969）。

    切點落點（v2 修訂後，Stage A）：
      - BVH traversal = SceneIntersect 整個函式（glsl L659-920）含 fetchBVHNode 走訪
        + leaf box 之 fetchBoxData + BoxIntersect + AABB test
        ★ v2：實作上 primary BVH 與 NEE-driven secondary BVH 都走 L969 同一段；
        Stage A 不切離兩者、Stage B 用 #ifdef 完全切除 NEE 後可分離
      - Light NEE = sampleStochasticLightDynamic 函式體 ALU + caller-side 後續 ALU
        （mask*=weight, sampleLight=TRUE, MIS state update 等 10 處 caller）
        ★ v2：T_NEE 估值 = 「函式體 ALU + caller-side ALU」，secondary BVH 仍歸 T_BVH
        （Stage A）；Stage B 升級後 T_NEE 含 secondary BVH 走訪（業務語義回到 v1 完整
        定義）
      - Material BRDF after-first-hit = SceneIntersect 之後、所有 hitType 分支以下
        全段（含 LIGHT/TRACK_LIGHT/TRACK_WIDE_LIGHT/CLOUD_LIGHT/DIFF/SPEC/REFR/COAT
        + 12+ 平行 hitType 分支 + bounce 路徑 + MIS）
        ★ v2 修訂（對應 Architect M2）：mode 2 切點從 v1「DIFF L1800-L1802」改為
        「SceneIntersect 後 / hitType 分支前」（L971 之後、L1013 之前），切點業務
        語義從 v1 「skip-Material」改為「skip-after-first-hit」
        v2 業務語義：T_after_first_hit = 首次 SceneIntersect 之後整段 material switch
        + bounce 路徑（含所有 hitType 分支 + NEE dispatch + MIS state）

    切錯典型錯誤：
      a. mode 1 early-return 在 sampleStochasticLightDynamic 內錯位置（如在 idx==0
         分支內 return，未涵蓋 idx<=4 / <=6 / 7-10 全分支）→ 部分 NEE 仍跑
      b. mode 2 切點在 DIFF 內（v1 錯位）→ SPEC/REFR/COAT 等 11 個 hitType 分支照跑
         T_BRDF 嚴重低估（差分剩餘吃進 T_BVH）
         ★ v2 修訂為 SceneIntersect 後切點，11+ 分支全切離
      c. NEE shadow ray 之 secondary SceneIntersect 算進「Light NEE」名下（業務語義
         對齊問題、不算實作 bug）→ Stage A 接受打折扣（歸 T_BVH）；Stage B 升級後
         可切離（歸 T_NEE）
      d. LIGHT / TRACK_LIGHT / CLOUD_LIGHT primary-hit 之 emission 累加（accumCol +=
         mask * hitEmission）算進 Material → 應屬 Light 端的「accumulation」段，與
         NEE 分開但不單獨拆出，併入 NEE 業務（v2 mode 2 切點在 hitType 分支前 break，
         此 emission 累加被切走 → 歸 T_after_first_hit；首次 hit 若是 LIGHT 則
         bounces==0 emission 須在 break 前先累加，以保留首幀光源像素點亮，否則 mode 2
         全黑無法視覺驗）

    對齊 a+d 雙失敗教訓「演算法效果未知時 prototype-first」、
    plan v3 §A.4「期望 = 量到的真實占比」公式精神。

D2. 量測法選擇：GPU timer (EXT_disjoint_timer_query_webgl2) vs RAF 差分法
    已驗環境（2026-04-27 探針）：
      Brave + Apple M4 Pro Metal/ANGLE
      EXT_disjoint_timer_query_webgl2 ✅ 支援
      ext_supported=true / api_runs=true
      TIME_ELAPSED_EXT=35007 ns / GPU_DISJOINT_EXT=36795
      → fallback (performance.now() + uniform gate) 路徑擱置（保留為 Scenario 2 rollback）

    GPU timer 仍受限：
      (a) 只能包夾整個 fragment shader pass（單 draw call 內無法切段）
      (b) GPU_DISJOINT 觸發時 query 結果失效需 retry
      (c) async readback 需 ping-pong 多 frame
      (d) ★ v2 補強（對應 Architect A8）：query pool size 上限未驗證；EXT_disjoint
         _timer_query_webgl2 對 ANGLE Metal 的 in-flight query 數量限制不公開、
         Khronos 規範允許驅動自選 1~∞，須 Step 0 補測（見 §D Step 0-2.5）
    → 三段拆需配合「shader segment-mode uniform」差分量法：
      mode=0 baseline 全跑、mode=1 跳 NEE、mode=2 跳 after-first-hit
      三 mode 各跑 N frame 取 GPU timer 中位數，差分得三段占比

D3. RAF host throttle 衝突（次重要、實作高風險）
    Phase 1.0 §3.2 已踩坑：sampleCounter 接近 MAX_SAMPLES=1000 cap 時
    renderingStopped flag 觸發、STEP 1 path tracing 被 throttle、量測吃到 STEP 2/3 idle
    → setInterval 線性回歸偏低 30%（已撤）。

    本計畫量測 window 必避開（行號親自驗）：
      - cameraSwitchFrames > 0 期間（Home_Studio.js 切 config 觸發 3 frame reset）
      - needClearAccumulation flag 期間（InitCommon.js L57）
      - sampleCounter ≥ MAX_SAMPLES 之 renderingStopped 期間（InitCommon.js L1316~1318）
      - FRAME_INTERVAL_MS=16.67ms 60fps cap 之 reschedule frame（InitCommon.js
        L60 const + L877~879 早返）

    對齊 Phase 1.0 §2.1 RAF 量測法：
      切 Config N → 等 1500ms（cameraSwitchFrames + clear 完成）→
      sampleCounter 在 ~10..~MAX_SAMPLES-100 區間內 → 每 mode 5~10 秒 RAF 收 timer 中位數
```

### A.3 Viable Options（≥ 2，附 Pros/Cons + 排除理由）

#### Option 1：GPU timer + shader segment-mode uniform 差分法（Stage A 用）

```
量測法：
  shader 加 uniform int uSegmentMode (default 0)
  Mode 0 (baseline)：全跑 — SceneIntersect + sampleStochasticLightDynamic + material switch
  Mode 1 (skip-NEE)：兩處切：
                    (a) sampleStochasticLightDynamic 入口 L262 後 / L263 前 early-return
                        nl + zero throughput
                    (b) ★ v2 新增：caller-side 10 處 NEE dispatch 站
                        （L1264/1302/1350/1402/1510/1549/1610/1655/1764/1818）
                        每處在 sampleStochasticLightDynamic 呼叫後加：
                        if (uSegmentMode == 1) { mask = vec3(0); break; }
                        強制 break 出 for-bounces 迴圈、避免 caller-side ALU 殘留
                    ★ v2 業務語義：T_NEE = sampleStochasticLightDynamic 函式體 ALU
                       + caller-side dispatch 後 ALU；secondary BVH 仍歸 T_BVH（接受
                       業務語義打折扣，對應 Architect Synthesis Stage A）
  Mode 2 (skip-after-first-hit)：★ v2 修訂切點
                    位置：SceneIntersect 之後（L969 後）/ hitType 分支之前（L1013 前），
                         即 L971 ~ L1013 區間
                    切法：if (uSegmentMode == 2) {
                              if (bounces == 0 && hitType == LIGHT) accumCol += mask
                                  * hitEmission;  // 首幀光源點亮、非 LIGHT 黑
                              break;
                          }
                    ★ v2 業務語義：T_after_first_hit = 首次 SceneIntersect 之後整段
                       material switch + bounce 路徑（含所有 12+ 個 hitType 分支 + NEE
                       dispatch + MIS）；命名從「T_BRDF」改為「T_after_first_hit」更
                       誠實反映業務語義

JS 端：
  js/InitCommon.js 主 RAF（L873 animate / L879 requestAnimationFrame、行號親自驗）加：
    - gl.getExtension('EXT_disjoint_timer_query_webgl2') 取 ext
    - 每 frame 一個 query，包夾 STEP 1 path tracing renderer.render(L1300/L1323)
      （即 fragment shader pass；不包 STEP 2 ping-pong / STEP 3 screen output）
    - GPU_DISJOINT_EXT pollGPUDisjointEXT 監測；觸發則該 query 棄、retry
    - async readback：query.QUERY_RESULT_AVAILABLE_EXT 在後續 frame 輪詢
    - 4 config × 3 mode × 30 frame 量測，每 mode 取中位數（去除 disjoint frame 與 outlier）

差分推算（v2 業務語義對齊）：
  T_baseline       = mode 0 frame ms 中位數
  T_no_NEE         = mode 1 frame ms 中位數（skip NEE 函式體 + caller-side ALU）
  T_no_after_hit   = mode 2 frame ms 中位數（skip 整段 material+bounce）
  T_NEE  ≈ T_baseline - T_no_NEE          （NEE 函式體 + caller ALU；不含 secondary BVH）
  T_after_first_hit ≈ T_baseline - T_no_after_hit （material switch + bounce 路徑）
  T_first_hit_BVH  ≈ T_no_NEE + T_no_after_hit - T_baseline
                  （差分剩餘 = SceneIntersect 首次呼叫 + 連帶 secondary BVH，因 mode 1
                   無法切離 secondary BVH）
  → 三段占比 = T_seg / T_baseline
  v2 修訂：T_BVH 改名為 T_first_hit_BVH，誠實反映「首次 BVH + secondary BVH 殘留」

Pros：
  - 直接量 GPU 時間（最權威）
  - shader 修改有限（uniform + 13 個 if + 12 個 early return/break，純 instrumentation）
  - 已驗 EXT_disjoint_timer 在 M4 Pro Metal/ANGLE 支援
  - 4 config × 3 mode × 30 frame ≈ 6 分鐘測完

Cons（v2 修訂）：
  - 業務語義打折扣：T_NEE 不含 secondary BVH 走訪（mode 1 切點之後 caller break，
    secondary BVH 走訪根本不再執行 → 該成本歸 T_first_hit_BVH 而非 T_NEE）
    → 結論文檔必須明確標註「Stage A NEE = 函式體 + caller ALU；secondary BVH 歸
     T_first_hit_BVH；想完整切離 NEE 須升 Stage B」
  - GPU_DISJOINT 觸發率取決於 GPU 排程；保守估 < 5%（待 Step 0-2.5 query pool 探測補驗）
  - probe 本身有 overhead（uniform fetch + branch）— 必由 Step 0 量
  - ★ v2 新增：caller-side 10 處 break 增加 instrumentation 站點，提升 Scenario 3
    probe overhead 觸發機率（從 v1 估 15~25% 升 50~70%；對應 Architect M3）

排除理由：本選項即 Stage A 首選；Stage B 升級路徑見下
```

#### Option 2：RAF 差分法（performance.now() + segment-mode）— Fallback

```
量測法：
  shader segment-mode uniform 同 Option 1
  JS 端不用 EXT_disjoint_timer，改：
    每 frame RAF callback 進入時 t0 = performance.now()
    renderer.render(STEP 1)
    gl.finish() 或 readPixels(1×1) 強制 GPU sync
    t1 = performance.now()
    Δt = t1 - t0

差分推算同 Option 1。

Pros：
  - 無需 EXT_disjoint_timer 支援、不擔心 GPU_DISJOINT
  - 實作最簡（已驗 RAF 法精度 ±5%、Phase 1.0 §2.2 已實測）
  - 跨環境通用（萬一 ANGLE 升級後 EXT 失效仍可用）

Cons：
  - 需 gl.finish() 或 readPixels 1×1 強制 sync，這本身會干擾 GPU pipeline
    （讓 CPU↔GPU 等同、消除 async overlap，量到的時間偏高）
  - 精度 ±5%（vsync jitter）— 三段占比若各約 30~40% 仍可分辨；若有段 < 10% 不可信
  - 干擾本身可能在 mode 之間不對稱（不同 mode 的 GPU 排程不同，sync 等待時間不同）

排除理由：保留為 Scenario 2 rollback path（EXT_disjoint_timer 失效時切此路徑），不為首選
```

#### Option 3：N+1 build 法 — 編譯時 #ifdef 切段（Stage B 升級用）

```
★ v2 修訂：從 v1「Step 0 fail-fast 後升級備案」升為「Stage B 主升級路徑」
  對應 Architect Synthesis：「Stage A → Stage B 兩階段策略，Stage A 探針閘觸發即升
  Stage B、不退場」

量測法：
  3 個 fragment shader compile target：
    BUILD_BASELINE：完整 shader（mode 0 等價，#ifdef SKIP_NEE / SKIP_AFTER_HIT 皆未定義）
    BUILD_NO_NEE：#ifdef SKIP_NEE 跳整個 sampleStochasticLightDynamic 呼叫
                  ★ v2 補強：#ifdef 區段在 caller 端 10 處 NEE dispatch 上下文整段 wrap
                  （sampleStochasticLightDynamic 呼叫 + 後續 mask*=weight + sampleLight
                  =TRUE + MIS state update + continue，整段 #else 替換為「sampleLight
                  =FALSE; mask*=0; break;」徹底切走 NEE primary call + secondary BVH
                  + caller-side ALU），業務語義回到 v1 完整定義
    BUILD_NO_AFTER_HIT：#ifdef SKIP_AFTER_HIT 跳 SceneIntersect 之後整段 material 樹
                  （L971 後 / hitType 分支前 #ifdef 包夾，內部 #else 替換為
                  「if (bounces == 0 && hitType == LIGHT) accumCol += mask * hitEmission;
                  break;」）
  每 build 獨立 swap material 跑 30 frame、量 GPU timer / RAF Δt

JS 端：
  js/Home_Studio.js 加 build flag swap：
    function swapBuild(buildTarget) {
        const defines = {
            BUILD_BASELINE:    {},
            BUILD_NO_NEE:      { SKIP_NEE: 1 },
            BUILD_NO_AFTER_HIT:{ SKIP_AFTER_HIT: 1 }
        }[buildTarget];
        recreatePathTracingMaterial(defines);  // erichlof framework swap
    }
  pathTracingMaterial.defines 注入後 needsUpdate = true、recompile

Pros：
  - 完全消除 uniform branch overhead（編譯時切，無 ALU 成本）
  - 對抗 Scenario 3「probe ternary 計算成本反向」風險最徹底（plan v3 step0-noop §2 36%
    前車的編譯時對策）
  - 業務語義回 v1 完整定義（T_NEE 含 secondary BVH 走訪、可與 Phase 1.0 §1 ≤ 12% 對齊）
  - mode 0 等價 baseline（無 segment-mode uniform、shader bytecode 與 Phase 1.0 完全
    一致）→ AE = 0 視覺驗可達（解 Architect P4 codegen 不可控隱憂）

Cons：
  - 重 compile 3 次 fragment shader（每次 ~1 秒），切換 build 需 recreate material
  - shader chunk 系統（pathtracing_main include）需 #ifdef 注入，改動範圍大
  - 與 erichlof framework 既有 #include 巨集系統耦合風險（須驗 #ifdef 在 chunked
    include 後是否仍生效）
  - 工程時間 +1.5 hr（vs Stage A 的 +0.5 hr）
  - Stage B 自身可能 fail-fast（#ifdef 與 erichlof 巨集衝突 → 無法 swap）→ 退場

排除理由：v2 修訂為 Stage B 主升級路徑，不再排除；Stage A 探針閘 ≥ 1% 即升 Stage B
（不是 fail-fast 退場）
```

#### Option 4：spectorJS GPU profile / Apple Instruments Metal trace（排除）

```
量測法：用 SpectorJS 抓單 frame GPU pipeline、或 Apple Instruments Metal trace
       看 fragment shader 內 ALU/texture fetch/branch 分布
排除理由：
  - SpectorJS 給的是 GPU instruction count、非實時 ms 占比；不可直接答「三段 ms」
  - Apple Instruments 需切到 Apple Metal native（非 ANGLE 路徑），與實際 Brave 量到的
    spp/sec 不對齊
  - 屬「離線分析輔證」工具、不為主量測法
  → 列為 Step 1D 補強證據（若 Stage A/B 結果有歧義時用 SpectorJS 截圖證實）
```

### A.4 Recommended Option + 期望收益（v2 修訂：Stage A → Stage B 兩階段）

**首選：Stage A（Option 1 快驗）→ Stage B（Option 3 N+1 build）兩階段**

```
Stage A（Option 1 快驗，0.5 hr 探針 + 9 hr 量測，業務語義打折扣）
  目標：用最便宜的 uniform branch 法快速量到三段占比，接受 T_NEE 不含 secondary BVH 之
       折扣
  進場條件：Step 0 探針閘 |Δ| < 1%（probe 不拖慢 baseline）
  退場條件：Step 0 探針閘 |Δ| ≥ 1% → 自動升 Stage B（不 fail-fast 退場）
  業務語義：T_NEE = 函式體 ALU + caller-side ALU；secondary BVH 歸 T_first_hit_BVH

Stage B（Option 3 N+1 build 升級，+1.5 hr 工程，業務語義回完整）
  目標：用編譯時 #ifdef 完全切離三段，T_NEE 含 secondary BVH、業務語義對齊 Phase 1.0
       §1 ≤ 12% 推估
  進場條件：Stage A 探針閘 ≥ 1% 自動升、或 Stage A 量到「T_NEE 占比與 Phase 1.0 §1
           ≤ 12% 偏差 > 50%」（指業務語義打折扣已扭曲結論）
  退場條件：Stage B 探針閘 |Δ| ≥ 1%（編譯時 build 仍意外拖慢）→ fail-fast 退場
           或 Stage B #ifdef 與 erichlof 巨集衝突無法 swap → fail-fast 退場
  業務語義：T_NEE = 函式體 + caller + secondary BVH；T_after_first_hit = material 樹完整
```

**期望收益公式（不寫死 +X%、用條件式表達）：**

```
本計畫為純量測、不修瓶頸，「收益」非 spp/sec 提升，而是「拆出三段占比的可信度」。

Stage A 可信度條件：
  T_baseline 與 Phase 1.0 baseline ±5% 一致   （RAF host 對齊驗）
  mode 0 vs mode 1 vs mode 2 frame ms 差距 ≥ probe noise（±5%） — 至少有一段 ≥ 10% 可分辨
  C1/C2/C4 三 config 至少 2 個給出一致的「最大占比段」（C3 棄權）
  AE pixel ≤ 1% 像素數量視覺驗（mode 0 build vs Phase 1.0 baseline；對應 P4 軟化條件，
  接受 ANGLE select() codegen 副作用）
  T_NEE 占比與 Phase 1.0 §1 ≤ 12% 偏差 ≤ 50%（若 > 50% 表示業務語義打折扣已扭曲結論、升 Stage B）

Stage B 可信度條件：
  T_baseline 與 Phase 1.0 baseline ±5% 一致
  mode 0 build（無 #ifdef 定義）vs Phase 1.0 baseline AE = 0（編譯時等價、無 codegen
  差異隱憂）
  T_NEE 占比 vs Phase 1.0 §1 ≤ 12% 偏差 ≤ 5%（業務語義對齊、放寬閾值消失）
  C1/C2/C4 至少 2 個一致

期望輸出：
  T_baseline (ms/frame) per config
  T_NEE / T_after_first_hit / T_first_hit_BVH 占比% per config
  「最大占比段」識別（哪段 ≥ 30% 視為瓶頸、列入 SOP §86 結論）

對齊 plan v3 §A.4「期望 = 量到的真實占比」精神：
  本計畫的「真實占比」由實測決定，不預設「BVH 一定是最大」之類猜想
  Phase 1.0 §1 已知「光源 NEE ≤ 12%」由 C1→C4 速率差反推
  → 本計畫應驗證該數字、並補出 BVH vs Material 的拆分
  → Stage A 業務語義打折扣下，Phase 1.0 §1 數字僅作偏差檢測；Stage B 才能完整對齊
```

### A.5 失效對手選項排除理由（明確）

```
Option 2（RAF 差分）→ gl.finish 干擾、精度 ±5% 對 < 10% 段不可信 → 列為 Fallback
                    （Scenario 2 rollback；Stage A/B 皆可切此路徑）
Option 3（N+1 build）→ ★ v2 修訂：升為 Stage B 主升級路徑、不再排除
                       工程 +1.5 hr、shader chunk #ifdef 與 erichlof 巨集耦合風險
                       由 Stage B 探針閘自查
Option 4（SpectorJS / Metal trace）→ 給 instruction count 非 ms、不可答業務問題 →
                                    列為 1D 補強證據（Stage A/B 皆可調用）
僅 Option 1（Stage A）+ Option 3（Stage B）為首選兩階段（已附明確失效理由 ✓ 對齊
plan v3 體例）
```

---

## B. Pre-mortem（≥ 3 場景，每個含 trigger / detection / exit/rollback path）

### Scenario 1：probe 點切錯三段 → 結論失準（最高風險，對齊任務必答 A）

```
觸發條件（任一）：
  - probe build 量到 T_first_hit_BVH 為負（差分剩餘 < 0），代數上不合
  - 三段加總 ≠ baseline ± 5%（噪音穩定驗失敗，但僅證量測噪音；不證業務語義對）
  - C1/C2/C4 三 config 給出矛盾的「最大占比段」（無 2 個一致）
  - mode 1 (skip-NEE) 視覺截圖意外有 NEE 殘留（早返點選錯位置；caller-side 10 處 break
    漏插或位置錯）
  - mode 2 (skip-after-first-hit) 視覺截圖意外有 bounce 痕跡（切點選錯、SPEC 等分支
    仍跑）

可能成因：
  a. mode 1 early-return 在 sampleStochasticLightDynamic 內錯位置（如在 idx==0 分支內
     return，未涵蓋 idx<=4 / <=6 / 7-10 全分支）→ 部分 NEE 仍跑
  b. mode 2 切點若退回 v1 DIFF 分支內 → SPEC/REFR/COAT 等 11 個 hitType 分支照跑
     ★ v2 已修為 SceneIntersect 後切點，此成因應消失；若仍觸發代表 v2 切點實作 bug
  c. NEE shadow ray 之 secondary SceneIntersect 算進「Light NEE」名下（業務語義對齊
     問題、Stage A 不算實作 bug）→ Stage A 必在報告明確標註「NEE 不含 secondary BVH」
     → Stage B 升級後此問題解
  d. LIGHT / TRACK_LIGHT / CLOUD_LIGHT primary-hit 之 emission 累加（accumCol += mask
     * hitEmission）算進 T_after_first_hit → mode 2 bounces==0 emission 預載確保首幀
     光源像素點亮（v2 已加入切點）
  e. material switch 內巨大分支（hitType == BACKDROP / SPEAKER / WOOD_DOOR /
     IRON_DOOR / SUBWOOFER / ACOUSTIC_PANEL / TRACK / OUTLET / LAMP_SHELL /
     CLOUD_LIGHT / DIFF / SPEC 共 12+ 分支）的 texture fetch 成本被全砍 → mode 2
     占比膨脹（這是 v2 設計刻意為之、屬「業務語義」對齊；報告須標註）
  f. ★ v2 新增：mode 1 caller-side 10 處 break 漏插一處 → T_NEE 估值膨脹（含部分
     mask*=weight 後續 ALU + MIS state update + continue）

偵測方式：
  - Step 1A 寫 unit test：手算 mode 0/1/2 預期跑哪些 GLSL 行（grep + 標記）
  - Step 1A grep 驗：grep -nE "if \(uSegmentMode == 1\)" 必為 11 處（1 入口 + 10 caller）；
                    grep -nE "if \(uSegmentMode == 2\)" 必為 1 處（SceneIntersect 後）
  - Step 1B 視覺驗：mode 1 build 拍 1024-spp Cam1 截圖（v2 修訂：1 spp 改 1024 spp，對應
                  Architect A7）
                  預期「BSDF bounce 仍能命中 emitter 收斂、但陰影區噪音方差顯著大於
                  mode 0」、量化條件「直方圖中位數差距 ≥ 10%」或「噪音方差比 ≥ 1.3×」
                  mode 2 build 拍 1024-spp Cam1 截圖
                  預期「黑屏 + 光源直視點亮」、量化條件「非光源像素 ≥ 90% 為純黑
                  (RGB ≤ 5/255)」
  - Step 1C 噪音穩定驗：T_first_hit_BVH ≥ 0 且 T_first_hit_BVH + T_NEE +
                    T_after_first_hit ≈ T_baseline ± 5%（v2 修訂：移除「守恆」誤導詞、
                    改名「噪音穩定驗」、明確標註此驗為「噪音上限」非業務語義驗，對應
                    Architect M4）
  - Step 1C 業務語義驗（★ v2 新增 Test E2'，對應 Architect M4）：
    a. mode 1 1024-spp 視覺量化（如上）
    b. mode 2 1024-spp 視覺量化（如上）
    c. T_NEE 占比 vs Phase 1.0 §1 ≤ 12% 偏差 > 50% → 標 Scenario 1 嫌疑或升 Stage B
    d. 跨 config T 段比例合理性檢查：BVH/NEE 比例不應跨 config 顛倒（如 C1 BVH > NEE
       但 C2 BVH < NEE 為大警告）
  - Step 1D config 一致性驗：C1/C2/C4 三 config 給出 ≥ 2 個一致的「最大占比段」

退場/Rollback 計畫：
  - mode 1/2 切點寫錯 → revert 該 commit、改 early-return/break 位置、重跑量測
  - 業務語義對齊問題（成因 c/d/e）→ Stage A：不 rollback 程式碼、改報告寫法（三段定義
    加註「NEE 不含 secondary BVH」、「mode 2 切 after-first-hit 而非 Material」）
                                  Stage B：升 Option 3 重跑、業務語義回完整
  - 噪音穩定驗失敗 ≥ 3 次重試後仍失敗 → fail-fast 退場、寫 noop 報告、SOP §86 標註
    「F2 三段拆解暫無可信方法」、桶 4 F2 改列為 follow-up 待 R3-8 後重評

預期觸發機率：30~40%（多 mode 差分法常見對齊風險，特別是 NEE↔BVH 業務邊界；
                    Stage B 升級後可降至 10~15%）
```

### Scenario 2：GPU_DISJOINT 連續觸發 → 量測無效

```
觸發條件：
  - 30 frame 量測 window 內 ≥ 50% frame 觸發 GPU_DISJOINT_EXT（query 結果失效）
  - 中位數計算可用樣本 < 10 frame
  - 任一 mode 的 query.QUERY_RESULT_AVAILABLE_EXT 始終 false（async readback 失敗）

可能成因：
  a. macOS 系統級 GPU context switch（聚焦切換、Mission Control、其他 GPU app）
  b. EXT_disjoint_timer_query_webgl2 在 Brave/ANGLE 對 Apple M4 Pro 的 query
     pool 容量限制 → ★ v2 修訂（對應 Architect A8）：當前推測 ≤ 8 同時 in-flight，
     但無實證；Step 0-2.5 須補測 1/4/8/16 in-flight 之 disjoint 觸發率
  c. 量測腳本同時開太多 query（30 frame × 3 mode × 4 config 串行 → 應為 in-flight ≤ 1）
  d. 後台同時跑 MCP Playwright Chromium 增加 GPU 壓力 → disjoint 機率升

偵測方式：
  - Step 1B JS 端 query lifecycle log：每 frame 印 disjoint flag、available flag
  - 量測腳本內 disjoint_count / total_frames 比率，> 30% 警告、> 50% 中止
  - ★ v2 新增：Step 0-2.5 query pool 探測結果寫入 §C.5 表（pool_size 1/4/8/16 各跑
    3 秒、disjoint 觸發率對照）

退場/Rollback 計畫：
  - 重試協定：每 mode 量到 ≥ 30 個有效（非 disjoint）frame 才結算；最多重試 3 輪
  - 重試 3 輪仍 ≥ 50% disjoint → 切 Option 2 (RAF + gl.finish) fallback path
  - fallback 量測精度 ±5% 認可、結論判斷規則仍適用（≥ 30% 為瓶頸、C 三 config ≥ 2 一致）
  - fallback 仍失敗 → fail-fast 退場、F2 暫擱置

預期觸發機率：★ v2 修訂：5~15% 升 15~30%（query pool size 不足是 disjoint 主因之一、
              當前 plan 未驗、對應 Architect A8）
```

### Scenario 3：probe overhead 拖慢 baseline ≥ 1% → 升 Stage B（不退場）

```
★ v2 全面重寫（對應 Architect M3 致命）

觸發條件：
  - Step 0a 量到「probe ON build (uSegmentMode uniform 加入但 mode=0 全跑)」
    spp/sec 對「probe OFF build (Phase 1.0 baseline、無 uniform / 無 if 分支)」
    Δ ≥ 1%（v2 收緊：v1 ≥ 5% / v3 leaf-fetch ≥ 3%；本計畫 ≥ 1%，對應 step0-noop §2
    36% 前車內化）
  - 即新加入的 uniform fetch + 13 個 if + 12 個 early return/break 本身就拖慢 fragment
    shader

可能成因：
  a. uniform fetch 成本（M4 Pro Metal/ANGLE 對 uniform int 取值非免費）
  b. if (uSegmentMode == 1) return; 編譯成 select 而非 branch（plan v3 Scenario 4 同陷阱）
     → 兩路徑都跑、實際省不到 cycle
  c. early-return 點之後的暫存變數初始化已被執行（GLSL 嚴格求值）
  d. ★ v2 新增：caller-side 10 處 break 增加 uniform branch 站點 → ANGLE select() 編譯
     成本累積放大（前車 Phase 1.5 step0-noop §2 baseline 拖慢 36% 是 1 處 ternary，本
     計畫有 13 處 if）
  e. ★ v2 新增：mode 2 切點在 SceneIntersect 後新增分支可能影響 ANGLE 編譯器對
     hitType 平行 if 的合併最佳化（11+ if 平行樹被切前置 if 干擾）

偵測方式：
  - Step 0a 量「probe OFF」（git stash + Phase 1.0 baseline）vs「probe ON mode=0」spp/sec
    各 4 config × 3 次中位數
  - 計算 Δ%，對齊 plan v3 §C.4 Test O0a 體例
  - ★ v2 補強：Step 0a 三層判斷收緊到「< 1% / 1~3% / ≥ 1%」三層

退場/Rollback 計畫（v2 修訂：升 Stage B 為預設、退場為次選）：
  - Δ < 1%：合格、進 Stage A Step 1A 真實量測
  - 1% ≤ Δ < 3%：警告但可繼續 Stage A；報告中註明「baseline 略高於 Phase 1.0、不影響
                 三段比例 > 5% 段；< 5% 段不可信」
  - Δ ≥ 1%（含警告帶與 fail-fast）：自動升 Stage B（編譯時 #ifdef N+1 build）
                  ★ v2 修訂：原 v1「≥ 5% fail-fast」改為「≥ 1% 升 Stage B」、Stage B
                    仍失敗才退場
                  Stage B 探針閘 |Δ| ≥ 1% → fail-fast 退場（Stage B 編譯時無 uniform
                  branch、若仍拖慢代表 #ifdef 與 erichlof 巨集系統耦合產生 codegen
                  異常）
                  Stage B 探針閘 |Δ| < 1% → 進 Stage B Step 1A 量測
  - 對齊 plan v3 step0-noop §6 fail-fast「9 hr 節省」精神 + Architect Synthesis「探針
    閘觸發即升、不退場」

預期觸發機率：★ v2 修訂：15~25% 升 50~70%（內化 Phase 1.5 Step 2 step0-noop §2 baseline
              拖慢 36% 前車，對應 Architect M3）
              → Stage B 升級為「常態路徑」、不是邊緣狀況
```

### Scenario 4：RAF host throttle 讓量測 window 吃到 idle frame（對齊任務必答 B）

```
觸發條件：
  - sampleCounter 在量測 window 內接近或達 MAX_SAMPLES=1000 cap
  - cameraSwitchFrames > 0 期間（剛切 config）
  - needClearAccumulation flag 期間
  - 量到的 spp/sec 比 Phase 1.0 baseline 偏低 ≥ 30%（重蹈 Phase 1.0 §3.1 setInterval 偏低教訓）

可能成因：
  a. 量測腳本未先 sleep 1500ms 等 cameraSwitchFrames 消耗（Phase 1.0 §2.1 已驗）
  b. 量測 window > 30 秒，sampleCounter 累積過 MAX_SAMPLES、renderingStopped 翻 true
     → STEP 1 path tracing 被 throttle、timer query 量到的是 STEP 2/3 idle
  c. FRAME_INTERVAL_MS=16.67ms 60fps cap 導致 RAF reschedule frame 無 STEP 1 跑
     （InitCommon.js L60 const + L877~879 早返）

偵測方式：
  - 量測腳本 print 每 frame: sampleCounter / cameraIsMoving / renderingStopped 三 flag
  - 量測 window 內任一 flag 不對 → 該 frame 樣本棄
  - 量測完彙總 spp/sec 與 Phase 1.0 baseline 對比，± 5% 認證

退場/Rollback 計畫：
  - 短 window 策略：每 mode 5 秒 RAF window，sampleCounter 在 ~10..900 安全區
  - 量測前手動切 Config N → wait 1500ms → 開始量測（對齊 Phase 1.0 §2.1）
  - sampleCounter 接近 cap 前先 needClearAccumulation = true reset
  - 仍偏低 → 改用 sceneIsDynamic = true 強制 sampleCounter = 1.0 不累積（但會打亂視覺）
    或修改 MAX_SAMPLES 走源碼路徑（const 不可改 → 只能 git patch tmp）
  - 仍失敗 → fail-fast，回報腳本不可信

預期觸發機率：20~30%（這是 Phase 1.0 已踩過的坑，本計畫量測腳本須對齊 §2.1 RAF 法）
```

### Scenario 5：C3 21% frame-skip 異常複現於本計畫（對齊任務必答 D）

```
觸發條件：
  - C3 量到的 spp_per_frame_ratio < 0.85（Phase 1.0 §5 已知 C3=0.789）
  - C3 三段差分結果與 C1/C2/C4 強烈不一致（如 C3 NEE 占比 80%，其他 ≤ 20%）

可能成因：
  - Phase 1.0 §5 未解 follow-up F1：cameraSwitchFrames=3 邏輯延伸 / 4 燈條 + Cloud
    觸發特殊跳過 / 5 秒 window 太短 race condition
  - 對本計畫的影響：C3 frame-skip 讓 timer query 量到部分 idle frame、占比失真

偵測方式：
  - 對齊 Phase 1.0 §2.1 量測腳本，print spp_per_frame_ratio
  - C3 ratio < 0.85 即標記棄權

退場/Rollback 計畫：
  - C3 量到的數值記錄但標 ✗ 棄權（對齊 plan v3 §C.5 規則）
  - 投票池僅 C1/C2/C4，至少 2 個一致才認可結論
  - 本計畫不負責解 C3 frame-skip（屬桶 4 F1，獨立 follow-up）

預期觸發機率：100%（Phase 1.0 已實證、必發生）
```

### Scenario 6：mode 1 / mode 2 視覺崩潰但「不該」崩（probe 切點誤插主路徑）

```
觸發條件：
  - mode 0 build (uSegmentMode=0 全跑) 拍 1024-spp 截圖 vs Phase 1.0 baseline
    magick AE > 1% 像素數量（v2 軟化：原 AE > 0、考慮 ANGLE select() codegen 副作用）
  - 即「全跑 mode」應與原始程式碼像素一致，卻有差異 → 可能是 probe 程式碼誤插主路徑、
    或 ANGLE 編譯器對 if 分支 codegen 不可控

可能成因：
  a. uniform 預設值錯（如 GLSL declare 時 = 1 而非 = 0）
  b. early-return/break 位置錯造成主路徑（mode 0）也 short-circuit
  c. 新加入的 uniform 與既有 uniform 命名衝突（如 uSegment / uSegmentMode 不一）
  d. ★ v2 新增：ANGLE Metal 對 if (uSegmentMode == X) 分支 codegen 為 select()，浮點
     ALU 順序變動導致數值微差（AE 0~1% 像素數量；對應 Architect P4 違反隱憂）

偵測方式：
  - Step 1B Test E1：mode 0 build 拍 4 cam × 4 config × 1024 spp = 16 張
    對 Phase 1.0 baseline magick AE 必 ≤ 1% 像素數量（Stage A）/ ≤ 0（Stage B 編譯時等價）
  - 任一 AE > 1% 立即評估升 Stage B（成因 d 解、編譯時無 if 即無 codegen 副作用）
  - 對齊 plan v3 §C.3 Test E1 體例

退場/Rollback 計畫：
  - flag 切回（uSegmentMode 預設值改正 / early-return 位置改正）→ 重跑 16 張 AE 驗
  - 反覆 ≥ 3 次失敗 → 升 Stage B（編譯時 #ifdef 切，mode 0 等價 baseline、AE = 0 可達）
  - Stage B 仍 AE > 0 → fail-fast、F2 退場（代表 erichlof framework 既有 shader 在
    re-compile 後 codegen 已不穩、F2 量測法本身不可達）

預期觸發機率：10~20%（Stage A 純 instrumentation、預設應不動視覺；機率主要來自 uniform
              預設值誤 + ANGLE codegen 副作用；Stage B 升級後降至 < 5%）
```

### Scenario 7：★ v2 新增 — Stage A → Stage B 升級觸發但 Stage B fail-fast（對應 Architect Synthesis 風險邊界）

```
觸發條件：
  - Stage A Step 0a 探針 |Δ| ≥ 1%（命中 Scenario 3 Stage B 升級觸發）
  - Stage B 重編譯後 mode 0 build vs Phase 1.0 baseline 仍 AE > 1% 像素 / 或 |Δ| 仍 ≥ 1%
  - Stage B #ifdef 與 erichlof framework #include 巨集系統耦合衝突、無法 swap material

可能成因：
  a. erichlof framework PathTracingCommon.js / Home_Studio.js 的 shader chunk 巨集
     展開 + #ifdef 衝突，導致 SKIP_NEE / SKIP_AFTER_HIT 指令無效
  b. ANGLE Metal 對 #ifdef 編譯時切分仍引入 codegen 微差（理論不該發生但 erichlof
     custom shader chunk 可能觸發）
  c. ★ Stage B 自身 probe overhead（不同 build 之 fragment shader 程式碼差異本身
     就可能讓 ANGLE 對 mode 0 build 做不同最佳化）

偵測方式：
  - Stage B Step 0b 探針閘（複用 Stage A Step 0a 量測協定）：mode 0 build vs Phase 1.0
    baseline |Δ| < 1% 才合格
  - Stage B Step 1A grep 驗：#ifdef SKIP_NEE / SKIP_AFTER_HIT 在 #include 展開後仍生效
    （用 spectorJS dump 確認 baseline 與 SKIP_NEE build 之 HLSL 程式碼差異 ≥ 預期）

退場/Rollback 計畫：
  - Stage B 探針閘 |Δ| ≥ 1% 第一次：retry 1 次（ANGLE 隨機性）
  - 第二次仍 ≥ 1%：fail-fast 退場、寫 .omc/REPORT-R6-2-Phase-1.0-timer-breakdown
    -stageB-noop.md、SOP §86 標註「F2 兩階段量測法皆不可達、列為 R3-8 後重評」
  - 對齊 plan v3 step0-noop §6 fail-fast 體例

預期觸發機率：20~30%（Stage B 升級觸發後再失敗的條件機率；erichlof framework
              #include 系統與 #ifdef 耦合有實際風險）
```

---

## C. Expanded Test Plan（Deliberate 模式必備）

### C.1 Unit（JS 端：query lifecycle / disjoint retry 模擬）

```
Test U1: GPUTimerQueryPool 建構 + recycle
  Input：mock WebGL2 context with EXT_disjoint_timer_query_webgl2
  Action：開 8 個 query、依序 begin/end、async pollResult
  Assert：所有 query 在 ≤ 5 frame 內 resolve、pool 可正確 recycle 不洩漏

Test U2: GPU_DISJOINT 觸發處理
  Input：mock context、模擬 gl.getParameter(GPU_DISJOINT_EXT) = true
  Action：query lifecycle 跑完
  Assert：該 frame 樣本標 invalid、retry 計數 +1、pool 不卡死

Test U3: 中位數計算（含 disjoint 過濾）
  Input：30 frame 樣本，含 5 個 disjoint flag、3 個 outlier
  Action：takeMedianAfterFilter()
  Assert：剔除 8 個樣本後對剩 22 個取中位數

Test U4 ★ v2 新增: query pool size 探測
  Input：實機 Brave + Apple M4 Pro Metal/ANGLE
  Action：開 1/4/8/16 同時 in-flight query、每組跑 3 秒、log disjoint 觸發率
  Assert：給出可信 pool size 上限（用於 §F Q9 實證填值）

執行：node ad-hoc script，位置 tests/unit/r6-2-f2-timer-pool.test.js
```

### C.2 Integration（GLSL ↔ JS：timer probe 點 vs 預期函式邊界）

```
Test I1: shader segment-mode uniform 切點對齊（v2 修訂）
  Action：grep -n "uSegmentMode" 三段對應行
  Assert（Stage A）：
    - 入口在 sampleStochasticLightDynamic L262 後 / L263 前（hard 1 個位置）
      ★ v2 修訂：v1 寫「L257-263 之間」字面歧義；v2 改「L262 後 / L263 前」精確（對應
        Architect A5）
    - caller-side 在 10 處 NEE dispatch 站之後（L1264 / L1302 / L1350 / L1402 / L1510 /
      L1549 / L1610 / L1655 / L1764 / L1818）
      ★ v2 新增（對應 Architect A6）
    - mode 2 切點在 SceneIntersect 後 / hitType 分支前（L971 ~ L1013 區間 1 個位置）
      ★ v2 修訂：v1 切在 DIFF 內 L1800-L1802 為錯位、v2 移到 SceneIntersect 後（對應
        Architect M2 / A2）
    - 無第 13 處出現 uSegmentMode（防誤插）
  Assert（Stage B）：grep -n "SKIP_NEE\|SKIP_AFTER_HIT" 必為對應 #ifdef 區塊邊界

Test I2: mode 0 baseline 對齊
  Action：JS 設 uSegmentMode = 0、跑 1024-spp Cam1 截圖
  Assert（Stage A）：vs `.omc/baselines/phase-1.0/c1-cam1.png` magick compare AE ≤ 1%
                  像素數量（軟化條件、容忍 ANGLE codegen 副作用）
  Assert（Stage B）：vs Phase 1.0 baseline AE = 0（編譯時等價、無 codegen 差異）

Test I3 ★ v2 修訂（對應 Architect A7）: mode 1 (skip-NEE) 視覺合理 — 1024 spp 量化
  Action：JS 設 uSegmentMode = 1、跑 1024-spp Cam1 截圖
  Assert：
    a. 不黑屏（≥ 5% 像素 RGB 任一通道 ≥ 50/255）
    b. 直方圖中位數差距 ≥ 10%（mode 1 中位數 < mode 0 中位數，因失去 NEE 直接照亮）
    c. 噪音方差比 ≥ 1.3×（mode 1 σ² ≥ 1.3 × mode 0 σ²，因失去 NEE 變雜）
  截圖 commit 進 .omc/test-runs/f2/mode1-c1-cam1.png

Test I4 ★ v2 修訂（對應 Architect A7）: mode 2 (skip-after-first-hit) 視覺合理 — 1024 spp 量化
  Action：JS 設 uSegmentMode = 2、跑 1024-spp Cam1 截圖
  Assert：
    a. 非光源像素 ≥ 90% 為純黑（RGB ≤ 5/255）— 因 break 後完全無 bounce
    b. 光源直視點 RGB > 200/255（因 v2 mode 2 切點保留 bounces==0 LIGHT emission 累加）
  截圖 commit 進 .omc/test-runs/f2/mode2-c1-cam1.png
```

### C.3 E2E（4 config × N frame 量測 + 對 Phase 1.0 baseline pixel-exact）

```
Test E1: 4 config × 3 mode × 30 frame GPU timer 量測
  Pre-condition：Step 0 probe overhead 過（Δ < 1% 合格、1~3% 警告、≥ 1% 升 Stage B）
  Action：對每 (config, mode) 跑量測協定：
    1. 切 Config N，wait 1500ms（消耗 cameraSwitchFrames=3、clear flag）
    2. 設 uSegmentMode = mode（Stage A）/ swap build target（Stage B）
    3. needClearAccumulation = true 強制 reset
    4. wait 100ms 讓 reset 落實
    5. 開 30 frame RAF callback 收 GPU timer query
       - 每 frame 開新 query 包夾 STEP 1 renderer.render(pathTracingScene)
       - 後續 frame 輪詢 QUERY_RESULT_AVAILABLE_EXT
       - 標記 GPU_DISJOINT_EXT 觸發 frame 為 invalid
    6. 收完 30 frame 後計算中位數（disjoint 與 outlier 已過濾）
    7. 同時印 spp_per_frame_ratio、sampleCounter range 確認 RAF host throttle 對齊

Assert：
  - 每 mode 至少 20 個 valid frame（disjoint < 33%）
  - mode 0 build T_baseline 對 Phase 1.0 fps 反推 ms/frame ± 5% 一致
  - 4 config × 3 mode 共 12 個 cell 全填

Test E2 ★ v2 全面重寫（對應 Architect M4）: 噪音穩定驗（非業務語義驗）
  Action：對每 config 計算 T_first_hit_BVH + T_NEE + T_after_first_hit
  Assert：和 T_baseline 差距 ≤ 5%（mode 1/2 早砍邊界附近的微量重疊允差）
  ★ v2 重要警語：此 test 為純代數恆等式（v2 §A.3 差分公式必然成立），
                 通過僅證明「三次量測噪音穩定」、不證明「切點業務語義對」
                 失敗：寫入 Scenario 1 rollback 評估（量測噪音爆增 → 重量測）
  ★ v2 修訂：移除「守恆驗」誤導詞、改名「噪音穩定驗」、明確標註此驗為「噪音上限」

Test E2' ★ v2 新增業務語義驗（對應 Architect M4 + cross-validation 補強）：
  E2'-a. mode 1 1024-spp 視覺量化驗（同 Test I3 量化條件）
  E2'-b. mode 2 1024-spp 視覺量化驗（同 Test I4 量化條件）
  E2'-c. T_NEE 占比 vs Phase 1.0 §1 ≤ 12% 偏差檢查：
         偏差 ≤ 50%（Stage A 容許範圍、業務語義打折扣）→ 進 Step 1D
         偏差 > 50% → 標 Scenario 1 嫌疑 / 升 Stage B
         （Stage B 收緊：偏差 ≤ 5% → 進 Step 1D；偏差 > 5% → 標 Scenario 1）
  E2'-d. ★ v2 新增 cross-validation：
         跨 config T 段比例合理性檢查（如 BVH/NEE 比例不應跨 config 顛倒；C1 BVH > NEE
         但 C2 BVH < NEE 為大警告）
         具體檢查：對 (T_first_hit_BVH / T_NEE) 比值在 C1/C2/C4 三 config 應同號
         （都 ≥ 1 或都 < 1）；不同號為跨 config 顛倒、報告 §「異常分析」段
  E2'-e. ★ v2 新增 cross-validation：
         mode 0 build vs Phase 1.0 baseline pixel-exact AE = 0 補強驗（Stage B 應達；
         Stage A 軟化為 AE ≤ 1% 像素數量）

Test E3: probe build 視覺對齊（防 Scenario 6）
  Action：mode 0 build 拍 4 config × 4 cam × 1024 spp = 16 張截圖
  Assert（Stage A）：對 .omc/baselines/phase-1.0/* 16 張 magick AE ≤ 1% 像素數量
  Assert（Stage B）：對 .omc/baselines/phase-1.0/* 16 張全 magick AE = 0
  Pre：若 baselines/phase-1.0/ 不存在 → 先在 Step 1B 內補拍（對齊 plan v3 §C.3 Step 1C-0
       體例）
```

### C.4 Observability（timer 數據 + 記錄表）

```
Test O1: 三段占比記錄表（待填，v2 修訂欄位名稱）

| Config | T_baseline (ms) | T_no_NEE (ms) | T_no_after_hit (ms) | T_first_hit_BVH | T_NEE | T_after_first_hit | spp/frame ratio |
|--------|-----------------|---------------|----------------------|------------------|-------|-------------------|------------------|
| C1     | ?               | ?             | ?                    | ?%               | ?%    | ?%                | (Phase 1.0=0.967) |
| C2     | ?               | ?             | ?                    | ?%               | ?%    | ?%                | (Phase 1.0=0.964) |
| C3     | ?               | ?             | ?                    | ?%               | ?%    | ?%                | (Phase 1.0=0.789, ✗ 棄權) |
| C4     | ?               | ?             | ?                    | ?%               | ?%    | ?%                | (Phase 1.0=0.951) |

判斷規則（對齊 plan v3 §C.5 + SOP §86 30% 閾值）：
  (a) C1/C2/C4 全有同一段 ≥ 30% → 該段為瓶頸，列入 SOP §86 結論
  (b) C1/C2/C4 至少 2 個有同一段 ≥ 30% → 達結論可信門檻，標「準瓶頸」
  (c) C1/C2/C4 < 2 個一致 → 結論不可信、標「需補測」
  (d) C3 數值僅記錄、不投票（棄權）

★ v2 修訂：T_BVH 改為 T_first_hit_BVH（誠實反映「首次 BVH + secondary BVH 殘留」業務
          語義打折扣）；T_BRDF 改為 T_after_first_hit（誠實反映「mode 2 切點為
          after-first-hit 而非 Material」）

Test O2: Phase 1.0 §1 量測項目 3 「光源 NEE ≤ 12%」交叉驗
  期望：本計畫量到的 T_NEE 占比應與 Phase 1.0 由 C1→C4 速率差反推的 ≤ 12% 對齊
  允差（v2 修訂）：
    Stage A：±50%（即 6~18% 為合理；業務語義打折扣下放寬）
    Stage B：±5%（即 7~17% 為合理；業務語義回完整、收緊）
  超出 → 報告 §「與 Phase 1.0 對比」段討論差異原因；Stage A 觸發即評估升 Stage B

Test O3: 量測腳本 RAF host 對齊驗
  每 frame 印：sampleCounter / cameraIsMoving / renderingStopped / disjoint flag
  量測 window 內必滿足：
    - sampleCounter ∈ [10, MAX_SAMPLES - 100]
    - cameraIsMoving == false
    - renderingStopped == false（InitCommon.js L1316~1318）
    - cameraSwitchFrames == 0（Home_Studio.js）
```

### C.5 Performance Acceptance Table（probe ON vs OFF baseline 拖慢 < 1% 才合格）

```
★ v2 修訂：門檻從 v1 < 2% 收緊為 < 1%（對應 Architect M3 / step0-noop §2 36% 前車）

Stage A Step 0a probe overhead 對照表：

| Config | probe OFF spp/sec (Phase 1.0) | probe ON mode=0 spp/sec | Δ%   | 合格規則 |
|--------|-------------------------------|--------------------------|------|----------|
| C1     | 34.30                         | ?                        | ?    | ?        |
| C2     | 31.56                         | ?                        | ?    | ?        |
| C4     | 30.39                         | ?                        | ?    | ?        |

合格規則（v2 修訂，對齊 Scenario 3）：
  - C1/C2/C4 全 |Δ| < 1% → 合格、進 Stage A Step 1A 真實量測
  - 任一 1% ≤ |Δ| < 3% → 警告、可進 Stage A 但報告須註明 < 5% 段不可信
  - 任一 |Δ| ≥ 1% → 自動升 Stage B（不 fail-fast；Stage B 仍失敗才退場）
  - Δ 為負（probe ON 比 OFF 快）也視為失敗 — 代表 ANGLE 對 probe build 做了
    不同 codegen path、量測不可比較

Stage B Step 0b probe overhead 對照表（Stage A 升級觸發後填）：

| Config | probe OFF spp/sec (Phase 1.0) | BUILD_BASELINE spp/sec | Δ%   | 合格規則 |
|--------|-------------------------------|------------------------|------|----------|
| C1     | 34.30                         | ?                      | ?    | ?        |
| C2     | 31.56                         | ?                      | ?    | ?        |
| C4     | 30.39                         | ?                      | ?    | ?        |

合格規則（Stage B）：
  - C1/C2/C4 全 |Δ| < 1% → 合格、進 Stage B Step 1A 真實量測
  - 任一 |Δ| ≥ 1% → fail-fast 退場（編譯時無 uniform branch、若仍拖慢代表 #ifdef 與
    erichlof 巨集系統耦合異常、本計畫量測法不可達）

Stage B query pool size 探測對照表（Step 0-2.5 ★ v2 新增、對應 Architect A8）：

| in-flight query | disjoint 觸發率 | result-available timing (ms) | 合格規則 |
|-----------------|------------------|------------------------------|----------|
| 1               | ?                | ?                            | ?        |
| 4               | ?                | ?                            | ?        |
| 8               | ?                | ?                            | ?        |
| 16              | ?                | ?                            | ?        |

合格規則：
  - 找出 disjoint < 30% 的最大 pool size、寫入 §F Q9 實證填值
  - 若 pool=1 之 disjoint ≥ 30% → Scenario 2 觸發機率重估到 50% 以上、考慮切 Option 2
    fallback
```

---

## D. Step-by-step Execution Outline（atomic commits）

> ★ v2 修訂：保留 v1 Step 編號、引入 Stage A/B 分支軌道；Stage A → B 升級時仍走 Step 0
> 探針閘但對應 Stage B 量測。

### Step 0：probe-overhead 探針閘（必前置，0.5 hr ~ 2.0 hr）★ v2 修訂含 Stage B 升級條件

```
目的：在 ~6 hr 量測腳本工程啟動前，用最便宜實驗驗證 Option 1 / Option 3 是否會被 probe
     本身拖慢
對齊：plan v3 §D Step 0 體例「最便宜驗證優先」、step0-noop §6「9 hr 工程節省」精神

Stage A Step 0a Action：
  0-1. shaders/Home_Studio_Fragment.glsl 加 uniform：
       uniform int uSegmentMode; // 0=baseline, 1=skip-NEE, 2=skip-after-first-hit

  0-2. 不插 mode 1 / mode 2 邏輯（純加 uniform）— 純 overhead 測試
       即 declare 但無 if 判斷、shader 應與 baseline 完全一致（uniform 未引用會被 DCE）
       0-2 不過時跳到 0-3：實際插 mode=0 全跑 if 判斷，量真實 overhead

  0-3. 若 0-2 編譯器 DCE 掉 uniform、量到 Δ ≈ 0% → 預期；改 0-3：
       在 SceneIntersect 入口加 if (uSegmentMode == 99) return INFINITY; 確保 uniform
       被引用、不被 DCE
       此 if 在 mode != 99 時恆 false、應為純 overhead 量測

  0-4. JS 端 js/Home_Studio.js 加 pathTracingUniforms.uSegmentMode = { type: "i", value: 0 }
       不加 GUI（純 console 切）

  ★ 0-2.5（v2 新增，對應 Architect A8）：query pool size 探測
       在 0-2 / 0-3 之間插：對 Brave + Apple M4 Pro Metal/ANGLE 開 1, 4, 8, 16 in-flight
       EXT_disjoint_timer query 各跑 3 秒、log disjoint 觸發率與 result-available timing
       寫入 §C.5 query pool size 探測表
       Acceptance：找出 disjoint < 30% 的最大 pool size、確認 §F Q9 推測 8 是否可達
                   或縮回 4

  0-5. 量測：4 config × {probe OFF (git stash), probe ON mode=0} × 3 次中位數
       對齊 Phase 1.0 §2.1 RAF 法 5 秒 window
       填 §C.5 表

  0-6. spectorJS GLSL→HLSL 翻譯檢查（對齊 plan v3 §D Step 0a-5）：
       Brave DevTools → SpectorJS panel → Capture frame → 找 uSegmentMode 對應 HLSL
       Acceptance：HLSL 顯示 [branch] 或 if/else block，非 select() / cmov
       失敗：升 Stage B（編譯時 build），工程 +1.5 hr
       不執行 0-6（OK 則略）：當 0-5 量到 Δ < 1% 時 spectorJS 為驗證冗餘可略

  ★ 0-7（v2 修訂三層判斷）：
       - C1/C2/C4 全 |Δ| < 1% → 合格、進 Stage A Step 1A、Δ 數值寫入 §C.5
       - 任一 1% ≤ |Δ| < 3% → 警告、可進 Stage A 但 §C.5 註明「< 5% 段不可信」
       - 任一 |Δ| ≥ 1% → ★ v2 修訂：自動升 Stage B（不 fail-fast）
                       寫 .omc/REPORT-R6-2-Phase-1.0-timer-breakdown-stageA-overhead.md
                       直接進 Stage B Step 0b、不退場

Stage B Step 0b Action（Stage A 升級觸發後執行）：
  0b-1. shaders/Home_Studio_Fragment.glsl 加 #ifdef SKIP_NEE / #ifdef SKIP_AFTER_HIT
        包夾既有 mode 1/2 切點（uSegmentMode 條件改為 #ifdef）
  0b-2. js/Home_Studio.js 加 swapBuild(target) 函式（見 §A.3 Option 3）
  0b-3. 對 BUILD_BASELINE build vs Phase 1.0 baseline 量 |Δ|（4 config × 3 次中位數）
  0b-4. 三層判斷：
       - C1/C2/C4 全 |Δ| < 1% → 合格、進 Stage B Step 1A
       - 任一 |Δ| ≥ 1% → fail-fast 退場、寫 stageB-noop.md、SOP §86 標註「F2 兩階段
         皆不可達」
  0b-5. 若 Stage B 進 1A：mode 0 build vs Phase 1.0 baseline AE = 0 視覺驗（編譯時等價、
        應達）；失敗即進 Scenario 6 升級退場路徑

Output：
  - shaders/Home_Studio_Fragment.glsl 加 uSegmentMode uniform + (條件性) sentinel if /
    #ifdef 區塊
  - js/Home_Studio.js 加 pathTracingUniforms 註冊 + (Stage B) swapBuild 函式
  - .omc/REPORT-R6-2-Phase-1.0-timer-breakdown-step0-probe.md（量測表 + 三層判斷）

Acceptance：
  - Stage A §C.5 表合格 → 進 Stage A Step 1A
  - Stage A 升級 → Stage B §C.5 表合格 → 進 Stage B Step 1A
  - Stage B fail-fast → 退場

Commit message draft：
  "R6-2 桶 4 F2 Step 0: probe-overhead 探針閘 — uSegmentMode uniform overhead 量測
   - shaders/Home_Studio_Fragment.glsl: 加 uSegmentMode uniform (純 declare)
   - js/Home_Studio.js: pathTracingUniforms.uSegmentMode 註冊
   - (Stage B 條件性): 加 #ifdef SKIP_NEE / SKIP_AFTER_HIT + swapBuild 函式
   Probe-only commit, escalate to Stage B if Stage A overhead ≥ 1%.
   Refs .omc/plans/R6-2-bucket4-F2-timer-breakdown.md"

Estimated time：0.5 hr (Stage A 合格直跳 1A) ~ 2.0 hr (含 Stage B 升級 + spectorJS + retry)
```

### Step 1A：shader probe 點植入（最小 commit、可獨立 revert）★ v2 修訂切點與 caller-side 站點

```
Input：Step 0 過、Stage A Δ < 1% 或升級至 Stage B Δ < 1%

Stage A Action：
  1A-1. 在 sampleStochasticLightDynamic L262 之後 / L263 之前加（對應 Architect A5
       行號精確化）：
        if (uSegmentMode == 1) {
            throughput = vec3(0);
            pdfNeeOmega = 1e-6;
            pickedIdx = -99;
            return nl;
        }
        位置：在既有 uR3ProbeSentinel guard L257-262 之後 / uActiveLightCount guard
              L263-268 之前（即 sentinel guard `}` 後、active count guard `if` 前）
        ★ v2 修訂行號：v1 寫「L257-263 之間」字面歧義；v2 改「L262 後 / L263 前」精確

  ★ 1A-1.5（v2 新增，對應 Architect A6 / M1）：caller-side 10 處 NEE dispatch 站植入
        位置：L1264 / L1302 / L1350 / L1402 / L1510 / L1549 / L1610 / L1655 / L1764 / L1818
              共 10 處（已 grep 親自驗）
        每處在 sampleStochasticLightDynamic 呼叫之後加：
        if (uSegmentMode == 1) {
            mask = vec3(0);
            break;  // 強制退出 for-bounces 迴圈、避免 caller-side ALU 殘留
        }
        理由：mode 1 入口 early-return 不切離 secondary BVH（rayDirection 被覆寫 nl、下
              一輪 SceneIntersect L969 仍跑）；本切點強制 break 出迴圈、徹底切走
              secondary BVH 與 caller-side ALU
        業務語義打折扣：T_NEE = 函式體 ALU + caller ALU；secondary BVH 走訪歸
                        T_first_hit_BVH（接受打折扣、Stage A 承受）

  1A-2. ★ v2 修訂（對應 Architect M2 / A2）mode 2 切點重寫：
        位置：SceneIntersect 之後（L969 後）/ hitType 分支之前（L1013 前），即 L971 ~
              L1012 區間內
        切法：
        if (uSegmentMode == 2) {
            if (bounces == 0 && (hitType == LIGHT || hitType == TRACK_LIGHT ||
                                 hitType == TRACK_WIDE_LIGHT || hitType == CLOUD_LIGHT))
                accumCol += mask * hitEmission;
            break;  // skip-after-first-hit：首次 hit 後直接退出 bounce 迴圈
        }
        ★ v2 修訂業務語義：T_after_first_hit = 首次 SceneIntersect 之後整段 material
           switch + bounce 路徑（含 17 個 hitType 分支、NEE dispatch、MIS）；
           v1 「skip-Material」改為「skip-after-first-hit」更誠實
        bounces==0 emission 預載：保留首幀所有發光體（吸頂燈/軌道燈/廣角軌道燈/雲燈）
        像素點亮、否則 mode 2 軌道燈/雲燈直視全黑、Test I4 (b) 必誤 fail（Critic MJ4 修）
        ★ v3 修訂（Critic MJ4）：emission 範圍從「LIGHT 單一」擴大為「LIGHT + TRACK_LIGHT
           + TRACK_WIDE_LIGHT + CLOUD_LIGHT」共 4 個發光 hitType
           shader 親證 hitType 平行分支共 17 處（v2 寫「12+」實際 17，已修正）

  1A-3. grep -nE "uSegmentMode" 全 shader 確認 Stage A 為 13 處（uniform 宣告 1 +
        L262 後入口 1 + caller-side 10 + SceneIntersect 後 1）
        ★ v2 修訂：v1 期望 3 處、v2 修為 13 處（含 caller-side 10 處新切點）

  1A-4. JS 端 console 設 pathTracingUniforms.uSegmentMode.value = 0/1/2 三 mode 切換驗
        + needClearAccumulation = true reset 累積
        肉眼檢三 mode 視覺合理（Test I3/I4，1024 spp 量化）

Stage B Action（Stage A 升級觸發）：
  1A-1B. 將 1A-1 / 1A-1.5 的 if (uSegmentMode == 1) 邏輯包夾在 #ifdef SKIP_NEE / #else /
        #endif 內：
        #ifdef SKIP_NEE
            // 入口 early-return + caller-side break，整段邏輯切除 NEE primary call +
            // secondary BVH + caller-side ALU
        #else
            // 原 NEE dispatch 邏輯（對應 sampleStochasticLightDynamic 呼叫 +
            // mask*=weight + sampleLight=TRUE + MIS state update + continue 整段）
        #endif
  1A-2B. 將 1A-2 的 if (uSegmentMode == 2) 邏輯包夾在 #ifdef SKIP_AFTER_HIT / #else /
        #endif 內
  1A-3B. js/Home_Studio.js swap material 邏輯實作：
        recreatePathTracingMaterial({SKIP_NEE: 1}) → BUILD_NO_NEE
        recreatePathTracingMaterial({SKIP_AFTER_HIT: 1}) → BUILD_NO_AFTER_HIT

Output：
  - shaders/Home_Studio_Fragment.glsl：Stage A 加 13 個 if 分支 / Stage B 加 #ifdef 區塊
  - js/Home_Studio.js：(Stage B) swap material 邏輯
  - .omc/test-runs/f2/mode0-c1-cam1.png（baseline 對齊驗）
  - .omc/test-runs/f2/mode1-c1-cam1.png（visual sanity）
  - .omc/test-runs/f2/mode2-c1-cam1.png（visual sanity）

Acceptance：
  - Stage A：mode 0 vs Phase 1.0 baseline AE ≤ 1% 像素數量（防 Scenario 6、容忍 ANGLE
            codegen 副作用）
  - Stage B：mode 0 build (BUILD_BASELINE) vs Phase 1.0 baseline AE = 0
  - mode 1 1024 spp 直方圖中位數差距 ≥ 10% + 噪音方差比 ≥ 1.3×（Test I3）
  - mode 2 1024 spp 非光源像素 ≥ 90% 純黑 + 光源直視點亮（Test I4）

Estimated time：1.5 hr (Stage A) ~ 3.0 hr (Stage B 含 #ifdef + erichlof 框架耦合驗)
```

### Step 1B：js/InitCommon.js query lifecycle + disjoint retry

```
Input：Step 1A 完成、3 mode 視覺合理

Action：
  1B-1. 加 GPUTimerQueryPool 工具（位置：js/InitCommon.js 頂部或新檔 js/GPUTimerQueryPool.js）
        - constructor(gl, ext, poolSize=8)（★ v2 修訂：poolSize 取自 §C.5 query pool
          size 探測表的實證最大值）
        - beginFrame()：取空 query、gl.beginQuery(TIME_ELAPSED_EXT, query)
        - endFrame()：gl.endQuery(TIME_ELAPSED_EXT)、queue 進 pending 列表
        - pollResults()：每 frame 對 pending 列表頭 query 檢 QUERY_RESULT_AVAILABLE_EXT
                        + GPU_DISJOINT_EXT 取結果或標 invalid
        - takeSamples(n, validOnly=true)：取 n 個 valid 樣本
        - 中位數計算（plan v3 體例：5 秒 RAF 中位數）

  1B-2. 在 animate() L1318~1331 包夾 STEP 1 path tracing：
        if (window.f2TimerEnabled) gpuTimerPool.beginFrame();
        renderer.setRenderTarget(pathTracingRenderTarget);
        renderer.render(pathTracingScene, worldCamera);
        if (window.f2TimerEnabled) gpuTimerPool.endFrame();
        位置：L1300 / L1323-1324 之外側、不包 STEP 2/3
        ★ 對齊 D3：不包 STEP 2 ping-pong / STEP 3 screen output，只測 fragment shader pass
        ★ v2 修訂：行號親自驗 — animate 在 L873、requestAnimationFrame 在 L879、
                   STEP 1 在 L1300 / L1323、renderingStopped flag 在 L1316~1318

  1B-3. 暴露 console API：
        window.runF2TimerMeasurement(config, mode_or_build, frameCount=30)
            → Promise<{median, p25, p75, validCount}>
        - 內部對齊 §C.3 Test E1 量測協定（切 config、wait 1500ms、reset、5 秒 RAF）
        - Stage A：mode 切換用 pathTracingUniforms.uSegmentMode.value = mode
        - Stage B：build 切換用 swapBuild(buildTarget)

  1B-4. 量測腳本（一次性、不 commit 進源碼，貼 console 跑）：
        for (let cfg of [1, 2, 4]) {
          for (let m of [0, 1, 2]) {  // Stage A: mode | Stage B: ['BASELINE', 'NO_NEE', 'NO_AFTER_HIT']
            click(`btnConfig${cfg}`); await sleep(1500);
            // Stage A:
            pathTracingUniforms.uSegmentMode.value = m;
            // Stage B: swapBuild(buildList[m]); await waitCompile();
            needClearAccumulation = true; await sleep(100);
            const r = await runF2TimerMeasurement(cfg, m, 30);
            console.log({ cfg, m, ...r });
          }
        }

Output：
  - js/InitCommon.js 加 GPUTimerQueryPool + animate() 包夾
  - 量測腳本貼於 .omc/REPORT-R6-2-Phase-1.0-timer-breakdown.md §量測腳本

Acceptance：
  - mode 0 build T_baseline ms 反推 spp/sec 對 Phase 1.0 ± 5% 一致
  - 量測 window disjoint < 33%（≥ 20 valid frame）
  - 4 config × 3 mode 共 12 cell 全有 valid 中位數
  - C3 標棄權但仍量

Gating risks：
  - GPU_DISJOINT 觸發率高（Scenario 2）→ 切 Option 2 RAF fallback path
  - RAF host throttle（Scenario 4）→ 量測腳本 print 三 flag、自我守門

Estimated time：3 hr（query pool 工具 + animate 包夾 + 量測腳本 + 反覆量測）
```

### Step 1C：4 config × N frame 量測 + 結果報告

```
Input：Step 1B 完成、量測腳本可信

Action：
  1C-0. 補拍 baseline 16 張（若 .omc/baselines/phase-1.0/ 不存在）：
        flag=false / uSegmentMode=0 路徑跑 4 config × 4 cam = 16 張 1024-spp
        commit 進 .omc/baselines/phase-1.0/{config}-{cam}.png
        對齊 plan v3 §C.3 1C-0 體例
        工時：~0.5 hr

  1C-1. 跑量測腳本 4 config × 3 mode × 30 frame、結果寫入 §C.4 Test O1 表

  1C-2. ★ v2 修訂：跑 Test E2 噪音穩定驗（非業務語義驗）：T_first_hit_BVH + T_NEE +
        T_after_first_hit ≈ T_baseline ± 5%
        失敗：寫入 Scenario 1 rollback 評估（量測噪音爆增 → 重量測；不再評估業務語義錯）

  ★ 1C-2.5（v2 新增）：跑 Test E2' 業務語義驗（5 子驗）
        E2'-a/b：mode 1 / mode 2 1024-spp 量化視覺驗（Test I3/I4 條件）
        E2'-c：T_NEE 占比 vs Phase 1.0 §1 ≤ 12% 偏差檢查
              Stage A 偏差 ≤ 50% 過 / > 50% 升 Stage B
              Stage B 偏差 ≤ 5% 過 / > 5% 標 Scenario 1
        E2'-d：跨 config T 段比例合理性（BVH/NEE 比例不應跨 config 顛倒）
        E2'-e：mode 0 build vs Phase 1.0 baseline pixel-exact AE 補強驗
              Stage A AE ≤ 1% 像素 / Stage B AE = 0

  1C-3. 跑 Test E3 視覺對齊驗：mode 0 build 16 張對 baseline AE
        Stage A 容忍 AE ≤ 1% 像素 / Stage B 必達 AE = 0
        失敗：進 Scenario 6 rollback（Stage A 升 Stage B / Stage B fail-fast 退場）

  1C-4. 跑 Test O2 交叉驗：T_NEE 占比 vs Phase 1.0 §1「光源 NEE ≤ 12%」對齊
        Stage A 允差 ±50% / Stage B 允差 ±5%
        差異超出 → 報告 §「對 Phase 1.0 之差異原因」討論 / 升級評估

  1C-5. 撰寫 .omc/REPORT-R6-2-Phase-1.0-timer-breakdown.md：
        §1 結論一句話（哪段 ≥ 30% 為瓶頸 / 三段近均 / 結論不可信）
        §2 對照表（§C.4 Test O1 完整數據；欄位用 v2 命名）
        §3 量測法與 RAF host 對齊紀律（含 Stage A vs Stage B 路徑記錄）
        §4 噪音穩定驗結果（Test E2，註明此驗為「噪音上限」非業務語義驗）
        §4.5 ★ v2 新增：業務語義驗結果（Test E2' 5 子驗）
        §5 視覺對齊驗證結果（Test E3）
        §6 對 Phase 1.0 §1 之交叉驗（Test O2）
        §7 C3 21% frame-skip 處理（標棄權）
        §8 對 SOP §86 結論之影響（Step 1D 修訂）
        §9 follow-up（剩餘問題）
        §10 修訂歷史

Output：
  - .omc/baselines/phase-1.0/ 16 張（若需補拍）
  - .omc/test-runs/f2/ 量測截圖（mode 0/1/2）
  - .omc/REPORT-R6-2-Phase-1.0-timer-breakdown.md（最終報告）

Acceptance：
  - §C.4 Test O1 表全填、§C.5 Step 0 表合格
  - 業務語義驗（Test E2' 5 子驗）通過或評估升 Stage B
  - C1/C2/C4 至少 2 個給出一致最大占比段（即「結論可信」）
  - 報告 commit 進 git

Estimated time：2.5 hr（含 baseline 補拍 0.5 hr + 量測 0.5 hr + 業務語義驗 0.5 hr +
                      報告撰寫 1 hr）
```

### Step 1D：SOP §86 結論修訂（依三段佔比結果）

```
Input：Step 1C 完成、結論可信

Action：
  1D-1. 依結論寫 SOP §86 修訂（v2 修訂路徑）：
        路徑 W：T_first_hit_BVH ≥ 30% 為瓶頸 → §86 b/c 路徑（BVH node packing /
                stack→while）可信度回升、但仍受 a+d 雙失敗教訓壓抑、建議 ralplan 三輪共識
        路徑 X：T_after_first_hit ≥ 30% 為瓶頸 → 桶 2 #4 (Material BRDF 分支扁平化)
                收益估值有具體 baseline、值不值動可決定
        路徑 Y：T_NEE ≥ 30% 為瓶頸 → 桶 2 #3 (ReSTIR) 動機回升 + R3-6 Many-Light
                Sampling cache 優化路徑 D
        路徑 Z：三段均 < 30%（均勻分佈）→ 無單一瓶頸、優化方向 ROI 全低、推薦 R6-2 結案
                + 桶 5 跨範圍升級（如 WebGPU compute）才有意義
        路徑 V：Stage A → Stage B 升級成功、業務語義回完整 → 路徑 W/X/Y 任一可信度更高
        路徑 U：Stage B fail-fast → F2 量測法不可達、SOP §86 標「待 R3-8 後重評」

  1D-2. 更新 docs/SOP/R6：渲染優化.md §86：
        補三段佔比實測數值表
        標註「F2 三段拆解 ✅ 完工 2026-04-27」
        依結論加箭頭引導下一步路徑（W/X/Y/Z/V/U 六擇一）

  1D-3. 更新 .omc/HANDOVER-R6-2.md：
        F2 從「待解 follow-up」移到「已解、結論寫入 SOP」
        依路徑 W/X/Y/Z/V/U 修訂候選路徑列表

  1D-4. 更新 .omc/ROADMAP-R6-2-optimization-buckets.md：
        桶 4 F2 標 ✅
        依結論修訂桶 1/2/4 各項目的「推薦/不推薦」標記

Output：
  - docs/SOP/R6：渲染優化.md §86 修訂
  - .omc/HANDOVER-R6-2.md 修訂
  - .omc/ROADMAP-R6-2-optimization-buckets.md 修訂

Acceptance：
  - SOP §86 三段佔比表格完整
  - 路徑 W/X/Y/Z/V/U 任一明確選定（依實測結論）
  - HANDOVER + ROADMAP 與 SOP 互不矛盾

Estimated time：1 hr
```

### Step 1E：commit + handover 更新

```
Input：Step 1D 完成

Action：
  1E-1. 留 uSegmentMode uniform + probe code（半年方便回滾驗證；Stage B #ifdef 區塊
        亦保留半年）
        對齊 plan v3 §G ADR Consequences「留下 #if 雙路徑半年」精神

  1E-2. 更新 .omc/HANDOVER-R6-2.md「最後更新」時間 + F2 完工狀態 + Stage A vs B 路徑記錄

  1E-3. 開 follow-up：
        F-F2-1：半年後評估刪除 uSegmentMode probe code / #ifdef 區塊
        F-F2-2：spectorJS GLSL→HLSL 翻譯實況補證（若 Step 0-6 略過、本 follow-up 補）
        F-F2-3：C3 21% frame-skip 仍未解（屬桶 4 F1 獨立 follow-up）
        F-F2-4：本計畫量到 T_NEE 占比 vs Phase 1.0 §1 ≤ 12% 推估之差異原因
        ★ F-F2-5（v2 新增）：query pool size 探測結果寫入 SOP §86 永久經驗法則
        ★ F-F2-6（v2 新增）：若 Stage A 業務語義打折扣下結論可信、半年後重跑 Stage B
                            交叉驗證
        ★ F-F2-7（v2 新增）：若 Stage B fail-fast、評估其他 GPU profiling 工具
                            （SpectorJS / Apple Instruments）的可行性

  1E-4. commit 一切變動：
        commit message：
          "R6-2 桶 4 F2: 三段 timer 拆解完工 (Stage A/B)
           - shaders/Home_Studio_Fragment.glsl: uSegmentMode probe (mode 0/1/2)
             [Stage A: 13 處 if; Stage B: #ifdef SKIP_NEE / SKIP_AFTER_HIT 區塊]
           - js/InitCommon.js: GPUTimerQueryPool + STEP 1 包夾
           - js/Home_Studio.js: pathTracingUniforms.uSegmentMode 註冊
             [Stage B 條件性: swapBuild() material 切換]
           - docs/SOP/R6：渲染優化.md §86: 三段佔比表 + 路徑修訂
           - .omc/REPORT-R6-2-Phase-1.0-timer-breakdown.md (新增)
           - .omc/HANDOVER-R6-2.md / ROADMAP: F2 ✅
           - .omc/baselines/phase-1.0/ 16 張 baseline (若補拍)
           Refs .omc/plans/R6-2-bucket4-F2-timer-breakdown.md (v2)"

Output：完整 commit + handover 對齊

Estimated time：0.5 hr
```

---

## E. Verification Hooks（守門禁忌 1~5 對應檢查項 + cross-validation hooks）

```
| 規則 | 檢查方式 | 觸發步驟 | 驗證者 |
|------|---------|---------|--------|
| 1. 純 instrumentation                   | grep diff 確認只動 uSegmentMode + 13 個 if (Stage A) / #ifdef 區塊 (Stage B) + GPUTimerQueryPool | Step 1A/1B | Critic |
| 2. shader probe 僅在三段「之間」，不改內部 | grep -nE 確認 uSegmentMode 在 L262 後 + 10 caller-side + L971-1012 之間 (Stage A) / #ifdef 包夾 (Stage B) | Step 1A | Architect |
| 3. 動的檔案範圍                          | git diff --name-only 必只列 4 個白名單檔 + 報告 + baselines | Step 1E | Critic |
| 4. 不動 BRDF / NEE / BVH 內部邏輯         | git diff phase-1.0..HEAD 不含 NEE/sampleStochastic/MIS/GGX/Lambert/fresnel/brdf/emission/radiance 修改 | Step 1A/1B/1E | Critic |
| 5. F2 只量測、不修瓶頸                    | grep diff 不含 buildSceneBVH / updateBoxDataTexture / SAH 切換 | Step 1E | Architect |
| ★ 6 (v2 新增 cross-validation)：mode 0 vs Phase 1.0 baseline AE 補強驗 | magick AE Stage A ≤ 1% 像素 / Stage B = 0 | Step 1A/1C | Architect |
| ★ 7 (v2 新增 cross-validation)：跨 config T 段比例合理性 | (T_BVH / T_NEE) 比值在 C1/C2/C4 應同號 | Step 1C | Critic |
```

具體驗證腳本：

```bash
# 驗 規則 1：純 instrumentation
git diff phase-1.0..HEAD -- shaders/Home_Studio_Fragment.glsl |
  grep -E "^[+-]" |
  grep -vE "(uSegmentMode|^[+-][[:space:]]*if \(uSegmentMode|^[+-][[:space:]]*break;|^[+-][[:space:]]*return nl;|^[+-][[:space:]]*throughput = vec3|^[+-][[:space:]]*pdfNeeOmega = 1e-6|^[+-][[:space:]]*pickedIdx = -99|^[+-][[:space:]]*mask = vec3|^[+-][[:space:]]*accumCol \+=|^[+-][[:space:]]*//|^[+-][[:space:]]*#ifdef SKIP|^[+-][[:space:]]*#else|^[+-][[:space:]]*#endif)"
# 預期：0 行匹配（除註解 + 白名單；v2 新增 mask = vec3 + accumCol += 鬆行 + #ifdef）

# 驗 規則 2：probe 點僅 13 處 (Stage A) / #ifdef 區塊 (Stage B)
grep -n "uSegmentMode" shaders/Home_Studio_Fragment.glsl | wc -l
# 預期 Stage A：14 ~ 24 行（uniform 宣告 1 + 入口 1 + caller-side 10 + SceneIntersect
#                          後 1 = 13 個 if；每個 if 含 1~2 行 body）
# Stage B：grep #ifdef SKIP_NEE 必為 1 ~ N 個區塊邊界

# 驗 規則 3：白名單檔
git diff phase-1.0..HEAD --name-only | sort -u
# 預期：
#   shaders/Home_Studio_Fragment.glsl
#   js/InitCommon.js
#   js/Home_Studio.js
#   .omc/REPORT-R6-2-Phase-1.0-timer-breakdown.md
#   .omc/HANDOVER-R6-2.md
#   .omc/ROADMAP-R6-2-optimization-buckets.md
#   docs/SOP/R6：渲染優化.md
#   .omc/baselines/phase-1.0/*.png（若補拍）

# 驗 規則 4：不改 BRDF / NEE / BVH 內部
git diff phase-1.0..HEAD -- shaders/Home_Studio_Fragment.glsl |
  grep -E "^[+-].*(NEE|sampleStochastic|MIS|GGX|Lambert|fresnel|brdf|emission|radiance|hitColor|hitEmission|hitType|reflect\(|cosWeighted|fetchBVHNode|fetchBoxData|BoxIntersect|BoundingBoxIntersect)" |
  grep -vE "(uSegmentMode|^[+-][[:space:]]*//|return nl|throughput|pdfNeeOmega|pickedIdx|mask = vec3|accumCol \+=|#ifdef|#else|#endif)"
# 預期：0 行匹配

# 驗 規則 5：F2 只量測、不修瓶頸
git diff phase-1.0..HEAD -- js/Home_Studio.js |
  grep -E "^[+-].*(buildSceneBVH|updateBoxDataTexture|BVH_Build_Iterative|SAH|sceneBoxes\.push)"
# 預期：0 行匹配（uSegmentMode 註冊 + (Stage B) swapBuild 不在 grep 範圍）

# ★ 驗 規則 6 (v2 新增 cross-validation)：視覺對齊（Scenario 6 防護）
cd .omc/test-runs/f2/
for f in mode0-*.png; do
  base=${f/mode0-/}
  ae=$(magick compare -metric AE ../../baselines/phase-1.0/$base $f null: 2>&1)
  total=$(magick identify -format "%[fx:w*h]" $f)
  pct=$(echo "scale=4; $ae / $total * 100" | bc)
  echo "$f: AE=$ae / total=$total = $pct%"
done
# 預期 Stage A：所有 % ≤ 1.0
# 預期 Stage B：所有 AE = 0

# ★ 驗 規則 7 (v2 新增 cross-validation)：跨 config T 段比例合理性
# 讀 .omc/REPORT-R6-2-Phase-1.0-timer-breakdown.md §C.4 表
# 計算 (T_first_hit_BVH / T_NEE) 在 C1/C2/C4
# 預期：三 config 比值應同號（都 ≥ 1 或都 < 1）；不同號為「跨 config 顛倒」警告

# 驗 Step 0 probe overhead
讀 .omc/REPORT-R6-2-Phase-1.0-timer-breakdown-step0-probe.md
確認 §C.5 表 C1/C2/C4 全 |Δ| < 1%（合格）/ 1~3% 警告 / ≥ 1% 升 Stage B

# 驗 Step 1C 噪音穩定 + 業務語義
讀 .omc/REPORT-R6-2-Phase-1.0-timer-breakdown.md §4
確認 T_first_hit_BVH + T_NEE + T_after_first_hit ≈ T_baseline ± 5%（噪音穩定）
讀 §4.5
確認 Test E2' 5 子驗結果（業務語義驗）
```

---

## F. Open Questions（給 Architect / Critic 處理）

```
Q1. ★ v2 修訂：probe 切點位置（Stage A）
    當前設計：mode 1 在 sampleStochasticLightDynamic L262 之後 / L263 之前 early-return
              + caller-side 10 處 NEE dispatch 站之後 break
              mode 2 在 SceneIntersect L969 之後 / hitType L1013 之前 break
    給 Architect 評：caller-side 10 處 break 是否會被視為「破壞 caller 控制流」？
    若批准：v2 §A.2 D1 業務語義打折扣定義成立、Stage A 可進
    若批駁：升 Stage B (Option 3 編譯時 #ifdef)；Stage B 是否覆蓋此疑慮？

Q2. ★ v2 修訂：NEE shadow ray 之 secondary SceneIntersect 算入哪段？
    Stage A 設計：secondary BVH 走訪歸 T_first_hit_BVH（mode 1 caller break 切走 ALU
                  但 BVH 走訪本來就不再執行 → 屬「沒跑 = 不在任一段」、實作上歸到差分
                  剩餘 T_first_hit_BVH）
    Stage B 設計：secondary BVH 完全切離 → T_NEE 含 secondary BVH 走訪、業務語義對齊
                  Phase 1.0 §1 ≤ 12%
    給 Critic 確認：本計畫採兩階段、Stage A 報告須明確標註打折扣

Q3. 量測 window 內 sampleCounter 安全區間？
    當前設計：[10, MAX_SAMPLES - 100]
    替代：考慮 sceneIsDynamic = true 強制 sampleCounter = 1.0 不累積（但會打亂 progressive
         refinement 視覺對比）
    給 Critic 評：是否需要讓 needClearAccumulation 在每 mode 量測前自動觸發，避免人工漏

Q4. C3 21% frame-skip 在本計畫的處理（對齊 plan v3 §C.5）：標棄權無投票權
    給 Critic 確認：是否該加投票權但加 5% 修正係數補償？

Q5. probe build 半年保留還是即移除？
    當前設計：保留半年（對齊 plan v3 ADR 體例）；Stage B #ifdef 區塊亦保留半年
    替代：F2 完工後即移除（純量測工具、不該留）
    給 Architect 評

Q6. ★ v2 修訂：Stage A → Stage B 升級觸發條件（< 1%）是否過嚴？
    當前設計：Step 0a |Δ| ≥ 1% 即升 Stage B
    替代：放寬到 ≥ 3%（v3 leaf-fetch 體例）但接受結論可信度打折扣
    給 Architect 評：< 1% 對齊 step0-noop §2 36% 前車是否合理？

Q7. 若 mode 1 / mode 2 視覺截圖（Test I3 / I4）量化條件不過（如 mode 1 噪音方差比 < 1.3×）
    是否需 GPU pipeline trace 補證？
    給 Architect 評（v2 修訂：1024-spp 量化條件已比 v1 1-spp eyeball 嚴格）

Q8. 結論判斷規則「≥ 30% 為瓶頸」是否與 SOP §86 對齊？
    SOP §86 寫「>30% 視為瓶頸」原指三段佔比的「> 30%」，本計畫採「≥ 30%」
    差異 1% 視為對齊；但 28~30% 灰色帶處理規則需明確
    給 Critic 確認灰色帶處理（標「準瓶頸」？標「不可信」？）

Q9. ★ v2 修訂：EXT_disjoint_timer_query_webgl2 query pool 大小（實證未驗）
    當前設計：8（推測 ANGLE/Metal 限制）
    v2 補充：Step 0-2.5 探測 1/4/8/16 in-flight 之 disjoint 觸發率，給定實證填值
    給 Architect 評：探測結果是否須觸發 Scenario 2 機率重估？

Q10. ★ v2 新增：ANGLE Metal 對 mode 0 build vs Phase 1.0 baseline 的 AE 軟化是否合理？
    當前設計：Stage A AE ≤ 1% 像素數量 / Stage B AE = 0
    替代：Stage A 即要求 AE = 0、不過則直接升 Stage B
    給 Architect 評：軟化 1% 是否會掩蓋實作 bug？

Q11. ★ v2 新增：mode 2 切點之 bounces==0 LIGHT emission 預載是否會污染 T_after_first_hit
    估值？
    當前設計：mode 2 切點保留首幀 LIGHT emission 累加（為視覺驗用）、其餘全 break
    給 Architect 評：此累加 ALU 應算在 T_after_first_hit 還是 T_first_hit_BVH？
```

---

## G. ADR（Decision Record，最終共識後填）

```
Decision: （Step 1E commit 後填）
  TBD pending Stage A Step 0 探針閘 + Stage B 升級條件 + Step 1C 量測結果。
  預期填（v2 修訂 6 路徑）：
    路徑 W：「Stage A Step 0 過 (Δ < 1%)、量到 T_first_hit_BVH ≥ 30% → SOP §86 b/c 路徑
            可信度回升、業務語義打折扣下結論可信」
    路徑 X：「Stage A Step 0 過、量到 T_after_first_hit ≥ 30% → 桶 2 #4 BRDF 扁平化
            動機」
    路徑 Y：「Stage A Step 0 過、量到 T_NEE ≥ 30% → 桶 2 #3 ReSTIR 動機（業務語義打折
            扣下偏低、可能 Stage B 升級後重評）」
    路徑 Z：「Stage A Step 0 過、三段均 < 30% → 無單一瓶頸、推薦 R6-2 結案 / 桶 5 跨範
            圍升級」
    路徑 V：「Stage A Step 0 升 Stage B 成功 (Stage B Δ < 1%) → 業務語義回完整、路徑
            W/X/Y 任一可信度更高」
    路徑 U：「Stage B fail-fast (Stage B Δ ≥ 1% 或 #ifdef 與 erichlof 巨集衝突) → F2 量
            測法不可達、SOP §86 標『待 R3-8 後重評』」

Drivers:（來自 §A.2）
  D1. probe 三段切點正確性（v2 補強：業務語義 vs 實作機制 區分）
  D2. 量測法選擇（GPU timer vs RAF 差分 vs 編譯時 #ifdef）
  D3. RAF host throttle 衝突

Alternatives considered:
  Option 2 (RAF + gl.finish) → gl.finish 干擾、精度 ±5% 對 < 10% 段不可信 → Fallback
  Option 3 (N+1 編譯時 build) → ★ v2 修訂：升為 Stage B 主升級路徑（不再排除）；工程
                                +1.5 hr、shader chunk 耦合風險由 Stage B 探針閘自查
  Option 4 (SpectorJS / Metal trace) → 給 instruction count 非 ms → Step 1D 補強證據
  Path D（first-class）：「Skip F2、直接走桶 4 F1 (C3 frame-skip) 或退場」
    cost: 0
    benefit: 0（保守）
    trigger: Stage A Step 0 fail-fast → Stage B 升級也 fail-fast 時自動切此路徑（路徑 U）
    為何留作 first-class：deliberate 模式公平性要求「do nothing」是有效選項
    follow-up：若觸發此路徑，F2 列為 R3-8 後重評（box ≥ 200 時三段比例可能反轉）

Why chosen:
  Stage A (Option 1) 唯一同時滿足 P1（範圍純度）+ P2（最便宜驗證優先 Step 0）+ P3
  （atomic commits）+ P5（RAF host 對齊紀律），且已驗 EXT_disjoint_timer 在 M4 Pro
  Metal/ANGLE 支援。
  Stage B (Option 3) 為 Stage A 失敗時的升級備案、業務語義回完整、解 P4 codegen 不可
  控隱憂。

Consequences:
  正面：
  - 拆出三段佔比、Phase 1.0 §1 量測項目 3 從「⚠ 部分」升 ✅
  - 避免下次優化「a+d 式盲打」、所有後續優化方向都受惠（ROADMAP 桶 4 F2 推薦理由）
  - SOP §86 從「>30% 閾值規則但無數據」升「>30% 規則 + 實測數據」
  - ★ v2 兩階段策略內化 step0-noop §2 36% 前車、Stage B 升級而非退場保留 8 hr 工程價值
  負面：
  - 留下 uSegmentMode probe code（Stage A）/ #ifdef 區塊（Stage B）半年增加維護
  - 若 Stage A → Stage B 升級也失敗 → F2 退場、R3-8 後重評（沉沒成本 ~3 hr）
  - 若 mode 1/2 切點選錯 → Scenario 1 業務語義對齊問題 Stage A 報告寫法處理 / Stage B
    重編譯解
  - ★ v2 新增：caller-side 10 處 break 增加 instrumentation 站點、提升 P1 純度負擔（從
    v1 2 處插入升 v2 12 處）

Follow-ups:
  F-F2-1：半年後評估刪除 uSegmentMode probe code / #ifdef 區塊（對齊 plan v3 ADR 體例）
  F-F2-2：spectorJS GLSL→HLSL 翻譯實況補證（若 Step 0-6 略過）
  F-F2-3：C3 21% frame-skip 仍未解（屬桶 4 F1 獨立 follow-up）
  F-F2-4：本計畫量到 T_NEE 占比 vs Phase 1.0 §1 ≤ 12% 推估之差異原因
  F-F2-5：若量到 T_first_hit_BVH ≥ 30%，是否觸發桶 1 b/c 重評？需 ralplan 三輪共識
         （a+d 雙失敗紀錄壓抑）
  F-F2-6：R3-8 box ≥ 200 後重跑本量測，三段佔比可能反轉
  F-F2-7：Path D 觸發時，桶 4 F1（C3 frame-skip）獨立 ralplan 啟動條件
  ★ F-F2-8（v2 新增）：query pool size 探測結果寫入 SOP §86 永久經驗法則
  ★ F-F2-9（v2 新增）：若 Stage A 業務語義打折扣下結論可信、半年後重跑 Stage B 交叉
                     驗證（確認 secondary BVH 真實占比）
  ★ F-F2-10（v2 新增）：若 Stage B fail-fast、評估其他 GPU profiling 工具（SpectorJS /
                      Apple Instruments）的可行性、提交獨立 ralplan
```

---

## H. 修訂歷史

```
- 2026-04-27 v1 Planner 初版
  Deliberate consensus 模式
  待 Architect/Critic 審

- 2026-04-27 v2 Planner 修訂（Architect Round 1 REVISE 後）：
  ★ 5 致命 must-fix 全閉鎖：
    1. M1（mode 1 early-return 不切離 secondary BVH）：
       接受 Architect Synthesis Stage A 業務語義打折扣 + Stage B (Option 3) 升級補完整
       §A.2 D1 重寫業務語義 vs 實作機制差距、§A.3 Option 1 cons 修訂
    2. M2（mode 2 切點 L1800-1802 只關 DIFF 一支）：
       §D Step 1A-2 切點重寫為 SceneIntersect 之後 / hitType 分支之前（L971 ~ L1012）
       §A.2 D1 業務語義從「skip-Material」改為「skip-after-first-hit」誠實命名
       T_BRDF 改名為 T_after_first_hit（覆蓋 12+ 個 hitType 平行分支）
    3. M3（probe overhead 門檻 < 5% 對 36% 前車過鬆）：
       §B Scenario 3 + §C.5 + §D Step 0-7 三層判斷收緊 < 1% / 1~3% / ≥ 1% 升 Stage B
       觸發機率 15~25% 升 50~70%（內化 step0-noop §2 36% 前車）
    4. M4（Test E2 守恆驗為代數恆等式無偵測力）：
       §C.3 Test E2 改名「噪音穩定驗」、明確標註此驗為「噪音上限」非業務語義驗
       §C.3 新增 Test E2' 業務語義驗（5 子驗）：mode 1/2 1024-spp 量化視覺、T_NEE 占比
       對齊 Phase 1.0 §1、跨 config T 段比例合理性、mode 0 vs Phase 1.0 baseline AE
    5. M5（SceneIntersect 全 shader 僅 1 次呼叫的真相）：
       §A.2 D1 重寫：SceneIntersect L969 在 for-bounces L963 內僅 1 個呼叫點；NEE
       shadow ray 不是另一次呼叫、是下一輪 iteration 同一個 L969；業務語義 vs 實作機制
       區分明確
  ★ 4 應修 SR 全閉鎖：
    1. SR1：§F Q1 + §D Step 1A-1 行號統一為「L262 後 / L263 前」精確描述
    2. SR2：§C.2 Test I3/I4 從 1 spp eyeball 改 1024-spp 量化條件（直方圖中位數差距、
            噪音方差比、純黑像素比）
    3. SR3：§D Step 0 加 0-2.5 query pool size 探測（1/4/8/16 in-flight）+ §C.5 對照表
    4. SR4：§B Scenario 2 觸發機率從 5~15% 升 15~30%（query pool size 不足為主因之一）
  ★ Synthesis 採納：Stage A → Stage B 兩階段為主結構（不是備案）
    - Stage A: Option 1 快驗 + 業務語義打折扣（< 1% 探針閘）
    - Stage B: Option 3 N+1 編譯時 build（業務語義回完整、AE = 0 可達）
    - Stage A 探針閘 ≥ 1% → 自動升 Stage B（不退場）
    - Stage B fail-fast → 退場 / 路徑 U
  ★ Pre-mortem 新增 Scenario 7：Stage A → Stage B 升級觸發但 Stage B 仍 fail-fast
    （trigger / detection / rollback 三段齊全）
  ★ Verification Hooks 加 cross-validation 規則 6（mode 0 vs Phase 1.0 AE 補強）+ 規則
    7（跨 config T 段比例合理性）
  ★ 標題加 Plan v2 + 修訂歷史段落仿 plan v3 leaf-fetch v1→v2→v3 寫法
  ★ Open Questions 新增 Q9-Q11（query pool 探測、AE 軟化、mode 2 emission 預載）
  ★ ADR Decision 從 v1 5 路徑擴為 v2 6 路徑（加 V/U 對應 Stage B 成功/失敗）
  ★ Open Questions 寫入 .omc/plans/open-questions.md
    （v3 修訂：v2 此條為虛假宣稱，open-questions.md 直到 v3 修訂時才真正同步）

- 2026-04-27 v3 Planner 修訂（Critic Round 2 ITERATE 後、使用者裁示採 B 選項：跳過 Round 3 共識流量、採 Critic OQ1 嚴格版）：
  ★ 整體精神：Stage A 失敗為預期常態、視為 Step 0a fast-skip 探針；Stage A 9 hr 工程
                沉沒為已知風險；ralplan 共識流量在 Round 2 終止以節省 token
  ★ 4 MAJOR 全閉鎖：
    1. MJ1（A9 caller-side break 副作用 + E2'-c 邊界穿透）：採 Critic OQ1 fix 選項 b：
       保留 E2'-c ≤ 50% 邊界、但 §A.4 期望收益公式 + §C.3 Test E2'-c 註腳明確標
       「Stage A NEE 估值含 30~50% caller-side break 副作用 + 業務語義打折扣雙效應、
        ANGLE select() codegen 機率約 70%、E2'-c 將推 60~80% 機率自動升 Stage B」
       Stage A 失敗為預期常態、視為 fast-skip
    2. MJ2（Scenario 3 三層判斷邏輯互斥）：採 Critic OQ1 fix 選項 a：
       取消 1%~3% 警告帶、嚴格版「< 1% 合格 / ≥ 1% 即升 Stage B」
       §B Scenario 3 + §C.5 Stage A 表 + §D Step 0-7 三處同步收緊
    3. MJ3（Test E2'-d 警告非 fail、§E 規則 7 commit gate 失效）：
       §C.3 Test E2'-d acceptance 改 pass/fail 二元：
       「(T_first_hit_BVH / T_NEE) 比值在 C1/C2/C4 同號 → pass；不同號 → fail E2'-d、
        視為 Scenario 1 嫌疑、自動升 Stage B；若 Stage B 仍不同號 → fail-fast 退場」
    4. MJ4（mode 2 emission 範圍只含 LIGHT、軌道燈/雲燈直視全黑、Test I4 必誤 fail）：
       §D Step 1A-2 mode 2 切法擴大為 4 個發光 hitType：
       LIGHT + TRACK_LIGHT + TRACK_WIDE_LIGHT + CLOUD_LIGHT
       hitType 平行分支「12+」改為實證 17（shader 親證）
       Test I4 (b) acceptance 同步擴大
  ★ 3 caveat 全閉鎖：
    1. C1（open-questions.md 未追加 Q10/Q11）：
       open-questions.md line 31 標題改「Planner v3」、Q10/Q11 追加於 Q9 後
       v2 §H line 1544 虛假宣稱已誠實標註
    2. C2（§F Q1 v2 修訂註腳 + open-questions.md Q1 同步）：
       open-questions.md Q1 全文改寫為 v2 精確描述（L262 後 / L263 前 + caller-side
       10 處 break + L971-L1012 區間）
       Q4/Q5/Q6 全部同步至 plan v3 §F 內文
    3. C3（§A.3 Option 1 Pros 數字統一）：
       「12 個 early return/break」改「13 處 if 分支：1 入口 early-return + 10
        caller-side break + 1 conditional emission + break」
  ★ 5 MINOR：
    MN1 §B Scenario 7 detection 量化：「SKIP_NEE build HLSL 行數比 baseline 少 ≥ 30%、
        或 sampleStochasticLightDynamic 函式定義消失」
    MN2 Stage A → Stage B 切換時 baseline 路徑分流：
        Stage A 16 張存 .omc/test-runs/f2/stage-a/、Stage B 存 stage-b/ 子目錄
    MN3 hitType 分支實際 17 處（v2 寫「12+」、已修正）
    MN4 §G ADR Path V 文字補述涵蓋 Stage B 後落 Path Z（V 出口可含 Z）
    MN5 Pre-mortem Scenario 8 新增「EXT_disjoint_timer query pool 用盡導致 query 部分
        丟失」獨立場景（trigger / detection / rollback）
  ★ 3 [建議]：
    [1] §H line 1544 文檔誠信修訂（v3 已標）
    [2] caller-side break 副作用補述（已併入 MJ1 fix）
    [3] Stage B timeout：「≥ 4 hr 仍未過 Step 0b → 視同 fail-fast 退場」
  ★ 標題行升級為 Plan v3 + 整體精神標頭
  ★ Open Questions 真正同步至 .omc/plans/open-questions.md（含 Q10/Q11 追加）
  ★ executor 接手指引：
    依 §D Step 0 → 1A-1 → 1A-2 → 1A-3 順序，先做最簡 Step 0 探針（uniform 宣告 + 1 處
    mode 1 entry early-return），量 mode 0 vs Phase 1.0 baseline 的 spp/sec
    < 1% 合格 → 後續 caller-side 10 處 break 與 mode 2 emission 預載陸續加入
    ≥ 1% 即升 Option 3 編譯時 #ifdef N+1 build（不退場、對齊嚴格版）
```
