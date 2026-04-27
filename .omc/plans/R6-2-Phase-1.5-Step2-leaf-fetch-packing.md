# R6-2 Phase 1.5 Step 2 leaf fetch packing — Plan v3（ITERATE 後修訂）

> 模式：Deliberate consensus（高風險 shader 結構變更，前有 R6-1 撤回 + SAH 失敗紀錄）
> 上層 SOP：`docs/SOP/R6：渲染優化.md` 主線 2 BVH 加速、第 86 行 d 項
> Baseline 報告：`.omc/REPORT-R6-2-Phase-1.0.md`
> 失敗前案：`.omc/REPORT-R6-2-Phase-1.5-Step1-SAH-rollback.md`
> 範圍邊界：僅動 `js/Home_Studio.js` 的 boxData texture 寫入 + `shaders/Home_Studio_Fragment.glsl` 的 fetchBoxData/leaf 分支 + `js/InitCommon.js` 主 RAF 加 timer query；**不動** BVH builder JS、不動材質 BRDF、不動 NEE pool、不動 GUI
> v1 → v2 修訂原因：Architect REVISE 裁定 P2（prototype-first）違規；插入 Step 0 量測探針作為強制 gate
> v2 → v3 修訂原因：Critic ITERATE 5 substantive findings + 2 [建議] 升 [必執行] + 3 編輯瑕疵 + 3 Pre-mortem 補強

---

## A. RALPLAN-DR Summary

### A.1 Principles（治理原則 5 條）

```
P1. Domain purity（範圍純度）
    僅碰 boxData 序列化與 fetchBoxData 解碼兩端，不順手改 BVH builder、
    不改材質分支、不改 NEE。違者立即拒入 commit（守門禁忌 2/3）。
    v2 強化：Step 0 探針期間禁止任何業務改動，僅 uniform + 三行 ternary。

P2. Prototype-first verification（最便宜驗證優先）★ v2 升為 hard gate
    Step 0 強制：1.5 hr 雙條件量測（force-full-fetch + EXT_disjoint_timer）
    雙條件未過則跳過整段 Step A~D。對齊 SAH 探針「1 行 Edit + 4 個 5 秒量測」精神。
    R6-1 撤回 + SAH 失敗皆因「沒先 prototype 直接整段改」。
    v3 強化：Step 0a 加 early-out（4 config 全 < 3% fail-fast / 全 ≥ 10% 直跳 1A），
            僅灰色帶 3%~10% 才跑 0b 雙驗證。

P3. Atomic + reversible commits（原子且可逆 commit）
    每步 commit 獨立可 git revert。v2 強化：Step D 拆 D1（C2 single config 量測）+
    D2（C1/C4 補測）；D1 < +5% 立刻 rollback，避免 D2 浪費 6 hr。
    v3 修訂：D1 前哨從 C1 改 C2（C2 為中位 baseline，C1 是最快 config 不具代表性）。

P4. Pixel-exact correctness gate（像素精準正確性閘）
    1024-spp 4 視角 ImageMagick AE = 0 才能進下一步。任何 1 frame 誤差
    立即回滾（守門禁忌 2）。
    v3 補強：1024-spp baseline 16 張不存在，必先在 Step 1C 內補拍 flag=false 路徑
            16 張作對比基準，commit 進 `.omc/baselines/phase-1.0/`。

P5. Threshold discipline（門檻紀律）
    +5% spp/sec 為 commit 最低門檻、目標為 Step 0 量到的真實上限 × 命中率。
    v2 修訂：C3 21% frame-skip 異常排除投票權，僅供參考；
    投票池 = C1/C2/C4 至少 2 個 ≥ +5%。
```

### A.2 Decision Drivers（決策驅動因子，前 3）

```
D1. GPU texel cache 命中模式（最重要）
    Apple M4 Pro Metal/ANGLE 的 RGBA32F texture cache line 寬度未公開。
    78 boxes × 5 texels = 390 texels 仍在單 row，理論上 5-fetch 與 3-fetch
    的差距主因不在 cache miss 而在 fetch 指令數本身。
    v2 補強：Step 0a force-full-fetch 探針直接量「fetch 指令是否真的占成本」。

D2. Shader 編譯器死碼消除（DCE）能力
    fetchBoxData 一次回 10 個 out 變數，但 leaf 分支前若有 isFixtureDisabled /
    isBoxCulled gate 提早拒絕，未用值的 fetch 是否被 DCE 取決於編譯器
    可見性（目前 fetch 在 gate 之前 → 5 次 fetch 全做）。
    v2 補強：Step 0a 直接揭穿 ANGLE 是否已自動 DCE；若已 DCE 則 Step 2 預期 0%。
    v3 補強：Step 0a-5 加 spectorJS GLSL→HLSL 翻譯檢查（明確 acceptance pattern）。

D3. boxData 容量上限與未來擴展
    現況 5 texel/box × 78 = 390 ≤ 512 cap；packing 到 3 texel/box = 234，
    剩 278 texel 餘裕。R3-8 採購擴張到 200 box 才需升 1024 寬。
    本步驟不動 width（守 P1），R3-8 階段獨立做。
```

### A.3 Viable Options（可行方案 ≥ 2）

#### Option 1：3-texel packing + gate-first 重排（排除）

```
Layout：P0=[min,fixtureGroup]、P1=[max,cullable]、P2=[emission, packed_misc]
       packed_misc.b = color packed RGB → 8-bit each
裁定排除：color packing 違 P4 像素精準閘（256³ vs FP32 必有 byte diff）
```

#### Option 2：3-texel packing + 8-bit roughness/metalness（排除）

```
裁定排除：8-bit roughness 1/255=0.39% 經 GGX D 項平方放大不可控；
         emission 從 type 推導違 P1 範圍純度
```

#### Option 3：5-texel 順序重排 + gate-first early-out（建議首選）

```
Layout（5 個 RGBA32F texel，順序重排）：
  P0 = [min.xyz,        fixtureGroup]   ← gate 必讀，置首
  P1 = [max.xyz,        cullable]       ← gate 必讀，置次
  P2 = [color.rgb,      type]           ← 視覺主路徑
  P3 = [emission.rgb,   meta]           ← 光源/特殊用
  P4 = [roughness, metalness, 0, 0]     ← 材質特性

Fetch 數：
  - 不可見 box（isFixtureDisabled / isBoxCulled 拒絕）：2 fetch（P0+P1）
  - 可見 box：5 fetch（P0~P4）
  - 混合期望：取決於 early-out 命中率

Pros：
  - P1 域純度 100%（只動順序、不損精度）
  - P4 像素精準 100%（浮點 1:1）
  - 回滾 1 行 swap 順序

Cons：
  - 收穫上限取決於「early-out 真能跳 3 fetch」與「leaf fetch 占 frame 時間 ≥ 15%」
    → 必由 Step 0 探針驗證
  - GPU SIMD quad-divergence 可能讓 single-lane early-out 0 收穫
    → 命中率折扣 0.6× 計入期望

裁定：唯一倖存方案，但收穫須由 Step 0 量測閘鎖定
```

#### Option 4：2-texel 極限（排除）

```
裁定排除：min/max 16-bit 量化致 BVH AABB 反向風險，整段 path tracer 崩潰
```

### A.4 Recommended Option + 期望收益（v2 修訂）

**首選：Option 3（5-texel 順序重排 + gate-first early-out）**

**期望收益公式（v2 修訂，不再寫死 +20%）：**

```
期望 Δspp/sec = Step 0 量到的真實 leaf-fetch 占比 (X%)
              × early-out 命中率 (Y%)
              × quad-divergence 折扣 (0.6×)

範例：
  Step 0 量到 leaf fetch 真實占 25%、典型場景 50% box 被 gate 拒
  期望 = 25% × 50% × 0.6 = 7.5% Δspp/sec

→ commit 門檻 +5% 對應「leaf 占比 ≥ 14% × 命中率 50% × 0.6」
  亦即 Step 0 雙條件：
    (a) force-full-fetch 探針顯示 leaf fetch 影響 ≥ 5%
    (b) EXT_disjoint_timer 顯示 leaf 段時間佔比 ≥ 15%
    (c) X × Y_estimate × 0.6 ≥ 5%（v3 補：避免 X 大但命中率低的假樂觀）
  三條件均過才進 Step 1A~1E
```

**失效對手選項排除理由：**

```
Option 1 → color RGB packing 必踩 P4 → 排除
Option 2 → 8-bit 量化 + emission 推導違 P1+P4 → 排除
Option 4 → 16-bit 場景座標致 BVH 反向 → 物理崩 → 排除
僅 Option 3 倖存（已附明確失效理由 ✓）
```

---

## B. Pre-mortem（v3 擴充至 7 場景）

### Scenario 0：Step 0 探針顯示 leaf fetch 不是瓶頸（最可能觸發）

```
觸發條件（任一）：
  - Step 0a force-full-fetch 探針：uForceFullFetch=1.0 vs 0.0 兩 build spp/sec
    差距 < 5%（即 leaf fetch 真實影響 < 5%）
  - Step 0b EXT_disjoint_timer：BVH leaf 段佔 frame 時間 < 15%

可能成因：
  a. ANGLE 已 DCE 未用 fetch（gate 前 fetch 但 gate 後丟棄的值已自動清）
  b. fetch 已被 GPU memory controller burst 合併（5 fetch ≈ 1 transaction）
  c. frame 主成本在 BVH node traversal、shading、NEE，而非 leaf fetch

偵測方式：
  - Step 0a 於 0.5 hr 內回報 spp/sec 雙 build 差距
  - Step 0b 於 Step 0a 同一 build 加 EXT_DISJOINT_TIMER_QUERY 量

退場/Rollback 計畫：
  - revert Step 0 探針 commit（uniform + ternary + timer query 全清）
  - 撰寫 .omc/REPORT-R6-2-Phase-1.5-Step2-step0-noop.md 記錄探針數值
  - SOP §86 d 項加 ⏭️ 跳過註記（leaf fetch 不是瓶頸已驗）
  - 路徑切到 SOP §86 c（while-loop traversal）或 R6-2 結案

預期觸發機率（基於 SAH 失敗教訓 + ANGLE 編譯器普遍智慧）：30~50%
若觸發：節省 9 hr 工時、留下「探針數值」永久 follow-up 證據
```

### Scenario 1：Step 1D1 量測（C2 single config）顯示 < +5%（SAH 式反向）

```
觸發條件：
  - Step 1D1 C2 量測 < +5% 提升
  - 或 C2 反向（< 0%）

可能成因：
  a. gate-first 重排對 GPU shader compiler 已被自動優化過
  b. early-out 在 SIMD quad lockstep 模式下單 lane early-out 不省 cycle
  c. Step 1B 寫入路徑改動有 hidden 副作用（如 cache thrash）
  d. Step 0 已過但 Step 1C 實作的 #if 雙路徑誤觸 ANGLE 不同 codegen path

偵測方式：
  - Step 1D1 量測：5 秒 RAF × 3 次取中位數
  - C2 不過門檻立刻 stop，不進 D2

退場/Rollback 計畫：
  - flag 切回 OFF（USE_PACKED_BOXDATA = false）
  - 撰寫 .omc/REPORT-R6-2-Phase-1.5-Step2-rollback.md
  - SOP §86 d 項加 ❌ 註記
  - 路徑切到 R6-2 結案
```

### Scenario 2：視覺 artifact 出現（layout sync 不一致）

```
觸發條件：1024-spp 4 視角任一像素 ImageMagick AE > 0
可能成因：
  a. JS 端 packBoxDataLayout 寫入索引錯
  b. shader 端 fetchBoxData 解碼 swizzle 錯
  c. updateBoxDataTexture 與 buildSceneBVH 不同步（已知 5 處 reference 風險）
  d. 第三寫入點未列入 #if 分支
偵測：Step 1A U1~U3 unit test、Step 1C debug shader、Step 1D1 視覺對比
Rollback：flag 切 OFF 即還原
```

### Scenario 3：Apple M4 Pro Metal/ANGLE 編譯/執行失敗

```
觸發條件：shader compile error / 黑畫面 / GL_INVALID_OPERATION
可能成因：
  a. #if USE_PACKED_BOXDATA 巨集編譯路徑錯
  b. ANGLE GLSL→HLSL/Metal 翻譯 reject vec4 swizzle
  c. EXT_disjoint_timer_query_webgl2 在 Metal/ANGLE 不支援
  d. uForceFullFetch ternary 被 ANGLE 編譯成 select 而非 branch
偵測：Step 1C 完成後瀏覽器 Console 第一時間檢查
Rollback：flag 切 OFF；ANGLE 兼容問題用 MCP Playwright Chromium 雙檢
```

### Scenario 4（v3 新增）：probe ternary 計算成本 > 它跳過的 fetch 成本

```
觸發條件：
  - Step 0a 量到 uForceFullFetch=1.0 比 0.0 還慢（負 Δ%）
  - 或量到極小 Δ < 1%（探針本身被反向加速 / 抵消）

可能成因：
  a. ternary 條件分支增加 ALU 成本超過省下 fetch 成本
  b. ANGLE 編譯成 select() 強制兩路徑都跑
  c. gate_passed 計算被 1.0 build 視為死碼但 0.0 build 視為活碼，
     量測差異 = gate 計算成本而非 fetch 成本

偵測方式：
  - Step 0a-5 spectorJS HLSL output 檢查（看是 if-branch 還是 select）
  - 若編譯成 select → 探針失敗，需改 #ifdef compile-time 雙 build

退場/Rollback 計畫：
  - 改 Step 0a-5b：compile-time 雙 build（USE_PROBE_FORCE_FULL #ifdef）
    分別跑 full vs dce，重做 Step 0a 量測（額外 0.5 hr）
  - 若雙 build 仍量到負 Δ → leaf fetch 真的不貴 → 進 Scenario 0 路徑

預期觸發機率：10~20%（ANGLE 對 ternary 處理視 driver 而定）
```

### Scenario 5（v3 新增）：D1 過但 D2 揭示 C1 是 outlier

```
觸發條件：
  - Step 1D1 C2 ≥ +5%
  - Step 1D2 補測 C1/C4 反向（任一 < 0%）或低於門檻
  - 即 C2 過但其他兩個 config 抓不到一致改善

可能成因：
  a. C2 場景特性（家具密集 / fixture 多）剛好觸發 early-out 命中率高
  b. C1（最快 baseline）已接近上限，packing 收穫被噪音吞
  c. C4（最慢 baseline）瓶頸在 NEE pool 而非 leaf fetch

偵測方式：
  - Step 1D2 完整 C1/C2/C4 數據填入 §C.5 表
  - 觸發 §C.5 規則 (b)/(c) rollback path

退場/Rollback 計畫：
  - flag 切 OFF、依 §C.5 (b)/(c) 規則 rollback
  - 在 rollback 報告中註記「C2 單獨成功為 outlier，非泛用收穫」
  - 為未來 follow-up：是否有 config-specific packing 變體（過度設計，本步驟拒）

預期觸發機率：15~25%（多 config 量測常見 outlier 模式）
```

### Scenario 6（v3 新增）：buildSceneBVH packed write 與 updateBoxDataTexture packed write 資料分歧

```
觸發條件：
  - 視覺 1024-spp AE = 0（Step 1D1 過）
  - GUI 操作後（toggle uTrackLightEnabled / config 切換）AE > 0
  - 即靜態畫面對但 dynamic update 後分歧

可能成因（grep 已揭示 5 處 reference）：
  a. buildSceneBVH L296-306 寫入迴圈改 packed layout
     但 updateBoxDataTexture L334-342 寫入迴圈漏改或 layout 不一致
  b. P4 後段（[0, 0]）若 layout 重排 updateBoxDataTexture 漏同步補
  c. tBoxDataTexture L319/322 first-bind 與 rebind layout 不同步

偵測方式：
  - Step 1A U3 unit test「buildSceneBVH 與 updateBoxDataTexture 一致性」
  - Test E2「動態 GUI 操作後仍像素一致」
  - Step 1B 開機自檢：buildSceneBVH 跑完 USE_PACKED_BOXDATA=true 時做內存比對

退場/Rollback 計畫：
  - flag 切 OFF
  - 修 updateBoxDataTexture L334-342 漏寫差異後重跑 Test E2
  - 若 Test E2 反覆失敗 → flag 切 OFF 永久放棄、寫 rollback 報告

預期觸發機率：20~30%（多寫入點 layout 同步常見 bug 模式）
```

---

## C. Expanded Test Plan（Deliberate 模式必備）

### C.1 Unit（JS 端，不需瀏覽器）

```
Test U1: boxData layout round-trip
  Input:  原 sceneBoxes 78 個（Phase 1.0 baseline 完整 fixture）
  Action: packBoxData(sceneBoxes) → boxArr_packed
          unpackBoxData(boxArr_packed) → sceneBoxes_recovered
  Assert: deep-equal {emission, type, color, meta, min, max,
          cullable, fixtureGroup, roughness, metalness}
  通過門檻：78/78 box 全相等

Test U2: boxArr 寫入位元組對位
  Input:  已 pack 的 boxArr (Float32Array)
  Action: 對 box[42] 改 emission.r 直接寫 boxArr[正確 index]
  Assert: unpackBoxData(boxArr).boxes[42].emission[0] == 改後的值

Test U3: updateBoxDataTexture 與 buildSceneBVH 一致性
  跑 buildSceneBVH 得 boxArr_v1
  改 sceneBoxes[5].type 後跑 updateBoxDataTexture 得 boxArr_v2
  重跑 buildSceneBVH 得 boxArr_v3
  Assert: boxArr_v2 == boxArr_v3
  v3 強化：U3 必對 5 處 reference（L319/322/329/330/344）皆通過
          特別檢 P4 後段 [0, 0] 兩函式寫入完全一致

執行：node ad-hoc script，位置：tests/unit/r6-2-step2-pack.test.js
```

### C.2 Integration（GLSL 端對 JS 端）

```
Test I1: fetchBoxData 解碼 vs JS reference 一致
  shader uniform uDebugBoxIdx + uDebugDumpRT
  for boxIdx in 0..77: render 1 frame → readPixels → assert ≈ JS expected
  通過門檻：78 box × 10 欄位 = 780 浮點全部 1e-6 epsilon 內

Test I2: BVH leaf 分支端到端
  spectorJS 抓 GPU pipeline，對比 packed vs unpacked t/hitType/hitColor/hitEmission
  CRC32 hash 對比 3 frame 連續相同
```

### C.3 E2E（視覺像素精準）

```
Test E1: 4 視角 × 4 config × 1024 spp pixel-exact
  ★ v3 修訂：baseline 不存在，必先在 Step 1C 內補拍
  baseline：Step 1C 內 flag=false 路徑跑 4 config × 4 cam = 16 張 1024-spp
            commit 進 .omc/baselines/phase-1.0/
  packed：Step 1C 完成後 flag=true 跑 16 張
  for each pair: magick compare -metric AE → 必 == 0
  通過門檻：16/16 AE = 0
  失敗處置：Scenario 2 rollback

Test E2: 動態 GUI 操作後仍像素一致
  GUI 動作序列（切 Config / toggle uTrackLightEnabled / slider uWallAlbedo）
  每張對 baseline 同操作序列截圖 AE = 0
  v3 強化：E2 觸發 Scenario 6 偵測（buildSceneBVH vs updateBoxDataTexture 同步）
```

### C.4 Observability（量測協定）

```
Test O0a: Step 0a force-full-fetch 探針量測（v2 新增）
  shader 加 uniform float uForceFullFetch (default 0.0)
  fetchBoxData 內 P2/P3/P4 三 fetch 用 ternary：
    vec4 p2 = (uForceFullFetch > 0.5 || gate_passed) ? texelFetch(...) : vec4(0);
    vec4 p3 = (uForceFullFetch > 0.5 || gate_passed) ? texelFetch(...) : vec4(0);
    vec4 p4 = (uForceFullFetch > 0.5 || gate_passed) ? texelFetch(...) : vec4(0);
  注意：gate_passed 由 P0/P1 fetch 後計算（isFixtureDisabled || isBoxCulled 反義）
  量測：4 config 各跑 uForceFullFetch=1.0 與 0.0 兩次（5 秒 RAF script 中位數）
  結果若：
    - 兩者 spp/sec 相同（差 < 2%）→ ANGLE 已 DCE → Step 2 上限 0% → 跳過
    - 0.0 build 快 X% → leaf fetch 占 X%，Step 2 上限 = X% × 命中率 × 0.6

Test O0b: Step 0b EXT_disjoint_timer leaf 段佔比量測（v3 修訂位置）
  ★ v3 修訂：RAF host 是 js/InitCommon.js（PathTracingCommon.js 是 shader chunk module）
  js/InitCommon.js 主 RAF（L873 animate(), L879 requestAnimationFrame(animate)）
    加 EXT_DISJOINT_TIMER_QUERY_WEBGL2 query
  query 1 包夾整個 fragment shader pass
  query 2 包夾 BVH leaf 段（透過 #define LEAF_TIMER_PROBE 加 begin/end timer 點）
  量 leaf_time / total_time ≈ 占比
  雙條件門檻：占比 ≥ 15% 才進 Step 1A
  注意：EXT_disjoint_timer_query_webgl2 在 Apple M4 Pro Metal/ANGLE 上的支援度
       須先以 ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') 檢查
       不支援則改用 fallback（v3 補：明確算式見 §D Step 0b-fallback）

Test O1: Phase 1.0 baseline 量測腳本（直接複用）
  位置：.omc/REPORT-R6-2-Phase-1.0.md §2.1
  量測點：
    - Phase 1.0 baseline（已有）
    - Step 0 探針 build（uForceFullFetch=1.0 與 0.0 兩數據點）
    - Step 1B 完成後（packed layout 寫入但 shader 未啟用）
    - Step 1D1 完成後（C2 single config 量測）
    - Step 1D2 完成後（C1/C4 補測）
  每測點 4 config × 3 次取中位數

Test O2: 每 frame 時長量測（用於 Δms 判斷）
  window.requestAnimationFrame timing API
  1024-spp 累積過程 frame.duration histogram
```

### C.5 Performance Acceptance Table（commit 門檻，v2 修訂）

```
| Config | Phase 1.0 baseline | Step 2 packed | Δ%  | 投票權 | 通過？ |
|--------|--------------------|----------------|-----|--------|---------|
| C1     | 34.30 spp/sec      | ?              | ?   | ✓     | ?       |
| C2     | 31.56              | ?              | ?   | ✓     | ?       |
| C3     | 30.78              | ?              | ?   | ✗ 棄權 | 參考      |
| C4     | 30.39              | ?              | ?   | ✓     | ?       |

v2 修訂規則：
  - C3 因 21% frame-skip 異常（Phase 1.0 報告 §5）排除投票權
  - Commit 門檻：C1/C2/C4 中至少 2 個 ≥ +5%
  - 反向 trigger（C1/C2/C4 任一 < 0%）：立即 rollback
  - C3 數值仍記錄供未來 follow-up（F-S2-2）

v3 修訂規則：
  (a) C1/C2/C4 全 ≥ +5% → 大成功，進 Step 1E commit path
  (b) C1/C2/C4 至少 2 個 ≥ +5% → 達 commit 門檻，進 Step 1E commit
  (c) C1/C2/C4 < 2 個 ≥ +5% 或任一反向 → 進 Step 1E rollback path
```

---

## D. Step-by-step Execution Outline（v3 atomic commits，Step 0 為強制 gate）

> ★ v2 重大變動：原 Step A~E 改為 Step 1A~1E，前置強制 Step 0 探針閘
> ★ 失敗於 Step 0 雙條件 → 整段跳過、寫探針報告、SOP 加 ⏭️ 註記
> ★ v3 修訂：Step 0a 加 early-out（fail-fast 跳 0b）、Step 0a-5 spectorJS 詳化、
>           Step 0b-fallback 公式明確化、Step 0c 三條件閘、Step 1C baseline 補拍、
>           Step 1D1 前哨 C1 改 C2

### Step 0：探針閘（Probe Gate，0.5 hr ~ 1.5 hr，強制前置）

```
目的：在 9 hr 重構工程啟動前，用最便宜實驗驗證 Option 3 是否有上限空間
對齊：SAH rollback §6「1 行 Edit + 4 個 5 秒量測 = 1 分鐘工程時間」精神
v3 動態工時：50% 機率 0.5 hr fail-fast / 50% 機率 1.5 hr 完整雙條件

Step 0a：force-full-fetch 探針（A1 falsifying experiment，0.5 hr）
  Action：
    0a-1. shader 加 uniform float uForceFullFetch (default 0.0)
    0a-2. fetchBoxData 內 P2/P3/P4 三 fetch 改 ternary：
          vec4 p2 = (uForceFullFetch > 0.5 || gate_passed) ? texelFetch(...) : vec4(0);
          其中 gate_passed = !(isFixtureDisabled(...) || isBoxCulled(...))
          gate_passed 必由 P0/P1 已 fetch 後計算（不可前置 fetch P2~P4）
    0a-3. JS 加 uForceFullFetch uniform setter 與 toggle UI（dat.GUI 一個 checkbox）
    0a-4. 量測：4 config × {uForceFullFetch=1.0, 0.0} × 3 次中位數
          記錄表：
            | Config | full-fetch (1.0) spp/sec | dce-fetch (0.0) spp/sec | Δ% |
            |--------|--------------------------|--------------------------|-----|
            | C1     | ?                        | ?                        | ?   |
            | C2     | ?                        | ?                        | ?   |
            | C3     | ?                        | ?                        | ?   |
            | C4     | ?                        | ?                        | ?   |

    0a-5. spectorJS GLSL→HLSL 翻譯檢查（v3 詳化）：
          (i) Brave 安裝 SpectorJS extension（chrome web store 或 npm i -g spector.js）
          (ii) Brave DevTools → SpectorJS panel → Capture frame
          (iii) 找 fetchBoxData 對應的 fragment program → HLSL output
          (iv) grep "if (uForceFullFetch" 或對應 [branch] HLSL 標記
          (v) Acceptance pattern：
              pass = ternary 編譯成兩個 if-branch（看到 [branch] 或 if/else block）
              fail = ternary 編譯成 select() / cmov（兩路徑都跑，量測無意義）
                   → 改 0a-5b 路徑：USE_PROBE_FORCE_FULL #ifdef compile-time 雙 build
                     分別 compile + 分別 capture，量測差異 = 純 fetch 成本
                     額外工時 0.5 hr，視為 Scenario 4 rollback path

    0a-6. Early-out 三層判斷（v3 [必執行]）：
          - 若 C1/C2/C4 全 Δ < 3% → ANGLE 明確已 DCE → fail-fast，跳 0b 直接 Step 0c noop
          - 若 C1/C2/C4 全 Δ ≥ 10% → 明確有空間 → 跳 0b 預設過，直接進 1A（0b 不做）
          - 僅 3% ≤ Δ < 10% 灰色帶 → 跑 0b 雙驗證
          總時間：0.5 hr (50% 機率 fail-fast 或 直跳) ~ 1.5 hr (灰色帶)

  條件 (a)：C1/C2/C4 至少 2 個 Δ ≥ 5%（leaf fetch 真實影響 ≥ 5%）

Step 0b：EXT_disjoint_timer leaf 段佔比（A4 falsifying experiment，0.5 hr，僅灰色帶觸發）
  Action：
    0b-1. js/InitCommon.js 主 RAF（L873 animate / L879 requestAnimationFrame(animate)）
          取得 ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
          若未支援，改 fallback（見 0b-fallback）
    0b-2. 設兩個 query：
          - q_total：包夾整個 fragment shader pass
          - q_leaf：包夾 BVH leaf 段（shader 內加 #define LEAF_TIMER_PROBE
            begin/end 標記，主 RAF 用 ext.beginQueryEXT/endQueryEXT 包夾）
    0b-3. 量測：4 config × 30 frame 平均，計算 leaf_time / total_time 占比
          記錄表：
            | Config | total ms/frame | leaf ms/frame | 占比% |
            |--------|----------------|---------------|--------|
            | C1     | ?              | ?             | ?      |
            | C2     | ?              | ?             | ?      |
            | C3     | ?              | ?             | ?      |
            | C4     | ?              | ?             | ?      |

  Step 0b-fallback（EXT_disjoint_timer 不支援時，v3 補明確算式）：
    fallback 公式：
      T_full = median(performance.now() Δ frame, uForceFullFetch=1.0, 30 frame)
      T_dce  = median(performance.now() Δ frame, uForceFullFetch=0.0, 30 frame)
      leaf_占比 ≈ (T_full - T_dce) / T_full
    fallback 精度：±3~5%（vsync jitter），仍可區分 ≥ 15% 門檻
    fallback 觸發時，Step 0c 條件 (b) 改寫為「Step 0a Δ ≥ 8%」單條件補償
    （即 0b 不可信時，把 (b) 改鎖在 (a) Δ ≥ 8% 上）

  條件 (b)：C1/C2/C4 至少 2 個占比 ≥ 15%（fallback 模式：(a) Δ ≥ 8%）

Step 0c：三條件閘決策（v3 修訂）
  - (a) C1/C2/C4 至少 2 個 force-full-fetch Δ ≥ 5%
  - (b) C1/C2/C4 至少 2 個 leaf 段時間佔比 ≥ 15%（fallback 改 (a) Δ ≥ 8%）
  - (c) X × Y_estimate × 0.6 ≥ 5%（v3 補：避免 X 大但命中率低）

  Y_estimate 測量法（兩選一）：
    選 A (GPU instrumentation): shader 加 atomic counter
      uOpaqueLeafHitCount + uTotalLeafHitCount
      per-frame readback via gl.readPixels
      4 config 取中位
      Step 0 完成後 atomic counter revert 列入探針可逆性檢查
    選 B (offline analysis): JS 端 4-config camera-fixed snapshot
      + sceneBoxes 對 current uniform values 對照
      估 hit rate without GPU instrumentation
    建議選 B（lower verification cost、不污染 shader）

  決策：
  - (a) AND (b) AND (c) 三過 → 進 Step 1A，期望上限 ≈ X × Y × 0.6
  - 任一不過 → revert 探針 commit（uniform + ternary + timer 全清）
                寫 .omc/REPORT-R6-2-Phase-1.5-Step2-step0-noop.md
                SOP §86 d 項加 ⏭️ 跳過註記
                路徑切 §86 c（while-loop traversal）或 R6-2 結案

Output：
  - shaders/Home_Studio_Fragment.glsl 加 uForceFullFetch uniform 與 ternary（探針期）
  - js/Home_Studio.js 加 uniform setter + GUI toggle（探針期）
  - js/InitCommon.js 加 timer query（探針期，v3 修訂位置）
  - .omc/REPORT-R6-2-Phase-1.5-Step2-step0-probe.md（量測表 + 三條件判斷）

Acceptance：
  - 三條件均過：進 Step 1A，並把 §A.4 期望收益公式套入實際數據
  - 任一不過：revert + 報告 + 跳整段 Step 2

Gating risks：
  - EXT_disjoint_timer 在 Apple M4 Pro Metal/ANGLE 不支援 → fallback 路徑（0b-fallback）
  - uForceFullFetch ternary 可能被 ANGLE 編譯器消除（0a-5 spectorJS 必檢；
    若編譯成 select → 0a-5b compile-time #ifdef 雙 build）
  - gate_passed 計算成本本身可能拖慢 baseline（量測差異 = 純 fetch 成本，
    對齊：dce-fetch 0.0 中 gate_passed 仍計算，full-fetch 1.0 中 gate 計算結果未用）

Commit message draft（探針 commit）：
  "R6-2 Phase 1.5 Step 2 (0): probe-gate uniform + ternary for leaf-fetch DCE check
   - shaders/Home_Studio_Fragment.glsl: uForceFullFetch uniform + P2/P3/P4 ternary
   - js/Home_Studio.js: uniform setter + GUI toggle
   - js/InitCommon.js: EXT_disjoint_timer_query_webgl2 leaf segment timer
   Probe-only commit, revert if Step 0c fails triple gate.
   Refs .omc/plans/R6-2-Phase-1.5-Step2-leaf-fetch-packing.md"

Estimated time：0.5 hr (fail-fast or 直跳) ~ 1.5 hr (灰色帶完整)
```

### Step 1A：JS 端 packing 函式 + 單元測試（不動 shader）

```
Input：
  - Step 0 三條件已過，期望上限套入 §A.4 公式
  - sceneBoxes 陣列現況（78 box）
  - 現有 buildSceneBVH 函式（Home_Studio.js:247）

Action：
  1A-1. 新增 js/Home_Studio_BoxData_Packed.js
        export packBoxDataLayout / unpackBoxDataLayout
        Layout：Option 3 順序
          P0=[min,fixtureGroup], P1=[max,cullable]
          P2=[color,type], P3=[emission,meta], P4=[roughness,metalness,0,0]
  1A-2. 新增 tests/unit/r6-2-step2-pack.test.js
        實作 Test U1/U2/U3
        v3 強化：U3 必對 5 處 reference（L319/322/329/330/344）皆通過

Output：
  - js/Home_Studio_BoxData_Packed.js（新檔，未被引用）
  - tests/unit/r6-2-step2-pack.test.js（新檔，可獨立 node 跑）

Acceptance：U1/U2/U3 全綠；Home_Studio.html 引入清單未變

Estimated time：1.5 hr
```

### Step 1B：boxData texture 雙路徑寫入（packed 與舊 layout 並存，v3 強化）

```
Input：Step 1A 完成、單元測試全綠

Action：
  1B-1. Home_Studio.js 頂部加 const USE_PACKED_BOXDATA = false
  1B-2. 修 buildSceneBVH（:247，實際資料寫入 loop L296-306 5×4 寫入迴圈）
        加 if 分支
  1B-3. 修 updateBoxDataTexture（:326，實際資料寫入 loop L334-342 5×4 寫入迴圈）
        加 if 分支
        ★ v3 強化：updateBoxDataTexture 在 P4 後段（[0, 0]）若 layout 重排
          必同步補（grep 證實 5 處 reference：L319/322/329/330/344）
          - L319, 322: uniform binding（first-bind vs rebind，無 layout 風險）
          - L329, 330: read access（layout 透通）
          - L344: needsUpdate flag（layout 透通）
          僅 L296-306 + L334-342 兩處資料寫入需同步加 if 分支
  1B-4. 開機自檢：buildSceneBVH 跑完 USE_PACKED_BOXDATA=true 時做內存比對
        對 packBoxDataLayout(sceneBoxes) 結果一致性

Output：Home_Studio.js 兩函式各加 if 分支，flag 預設 false

Acceptance：
  - flag=false spp/sec 與 baseline ±2% 內
  - flag=true boxArr 對 packBoxDataLayout 一致
  - 開機自檢通過（防 Scenario 6 觸發）

Estimated time：1.5 hr
```

### Step 1C：shader 端 fetchBoxData 對應 packed layout + 補拍 baseline 16 張（v3 修訂）

```
Input：Step 1B 完成

Action：
  ★ v3 新增順序：
  1C-0. 先在 flag=false 路徑跑 4 config × 4 cam = 16 張 1024-spp baseline
        commit 進 .omc/baselines/phase-1.0/
        檔名格式：phase-1.0-{config}-{cam}.png（如 phase-1.0-c1-cam1.png）
        工時：0.5 hr（16 張 × ~30 秒 1024-spp 累積 + I/O）

  1C-1. 修 fetchBoxData（Home_Studio_Fragment.glsl:580）加 #if USE_PACKED_BOXDATA 雙路徑
  1C-2. 修 BVH leaf 分支（:694-726）加早 fetch 2 + early-out + 後 fetch 3
  1C-3. grep "fetchBoxData(" 全部呼叫點，統一加 #if（已知唯一 caller 是 leaf 分支
        L700，但仍須 grep 確認沒第二處；若 grep 發現第二處，須同步加 #if）
  1C-4. 切 flag=true 後跑 16 張 packed 截圖 → 對 baseline AE 必 = 0

Output：
  - shaders/Home_Studio_Fragment.glsl 加 #if 雙路徑
  - .omc/baselines/phase-1.0/ 16 張 1024-spp 截圖（v3 新增）
  - .omc/test-runs/phase-1.5-step2/ 16 張 packed 截圖

Acceptance：
  - flag=false：1024-spp 4 cam 對 baseline AE=0
  - flag=true 但 JS flag=false：故意層級不對齊，視覺崩潰證明 shader 路徑被執行

Estimated time：3.5 hr（含 0.5 hr baseline 補拍）
```

### Step 1D1：C2 single config 量測（v3 修訂：C1 改 C2）

```
目的：先用 C2 單一 config 篩掉「反向變慢」case，避免寫完 16 張視覺對比才發現
v3 修訂：原 C1 前哨改 C2
  理由：C1（34.30 spp/sec）是最快、最不需優化的 config（接近上限）
       C2（31.56）是中位 baseline，更代表「典型」性能
       D1 前哨用 C2 比 C1 更具代表性

Input：Step 1A/1B/1C 完成、flag=false 路徑 AE=0 已驗

Action：
  1D1-1. JS 端 USE_PACKED_BOXDATA = true、shader #define = 1
  1D1-2. 跑 C2 Cam 1 視角 1024-spp 1 張（單 cam 視覺驗）
         magick compare baseline.png test.png AE 必 = 0
         若 AE > 0 → 立刻 rollback（flag 全切回）→ 進 Step 1E rollback
  1D1-3. 跑 Test O1 量測但只 C2：5 秒 RAF × 3 次取中位數
  1D1-4. 判斷：
         - C2 Δ ≥ +5% → 進 Step 1D2 補測
         - C2 Δ < +5% 或反向 → 立刻 rollback、不進 D2、進 Step 1E rollback

Output：
  - .omc/test-runs/phase-1.5-step2/c2-cam1-1024spp.png（1 張）
  - .omc/REPORT-R6-2-Phase-1.5-Step2-d1-results.md（C2 量測 + 判斷）

Acceptance：
  - 視覺 AE=0（C2/Cam1 單張）
  - 性能 C2 Δ ≥ +5% 才進 D2

Gating risks：
  - C2 Δ ≥ +5% 但其他 config 反向（D2 才會抓）→ 接受此 D2 才暴露的風險
    換取 D1 的「反向 case 早期偵測」收益
  - 量測 jitter > ±2% → 多跑 5 次中位數

Commit message draft（如 D1 過進 D2）：
  暫不 commit，留 flag=true 進 D2

Estimated time：1.5 hr（含 1 張視覺 + 3 次量測）
```

### Step 1D2：C1/C4 補測 + C3 參考（v3 修訂：補測對象由 C2/C4 改 C1/C4）

```
目的：Step 1D1（C2 過）後，補測 C1/C4 投票配 + C3 參考；完整 16 張視覺驗

Input：Step 1D1 過（C2 ≥ +5%）

Action：
  1D2-1. 跑 Test E1 完整 16 張（4 cam × 4 config × 1024 spp）
         magick compare 16 張全 AE = 0（任一非 0 → rollback）
  1D2-2. 跑 Test O1 量測 C1/C3/C4：5 秒 RAF × 3 次取中位數
  1D2-3. 填 §C.5 Performance Table（C3 標 ✗ 棄權）
  1D2-4. 判斷（v3 修訂規則）：
         a. C1/C2/C4 全 ≥ +5% → 大成功，進 Step 1E commit path
         b. C1/C2/C4 至少 2 個 ≥ +5% → 達 commit 門檻，進 Step 1E commit
         c. C1/C2/C4 < 2 個 ≥ +5% 或任一反向 → 進 Step 1E rollback path
         （C3 數值僅記錄供 F-S2-2 follow-up）

Output：
  - .omc/test-runs/phase-1.5-step2/ 16 張截圖
  - .omc/REPORT-R6-2-Phase-1.5-Step2-results.md 完整量測表 + 判斷

Acceptance：16 張 AE=0；性能達門檻 OR rollback

Estimated time：2 hr（含 16 張視覺對比 + C1/C3/C4 量測）
```

### Step 1E：commit OR rollback 決策路徑

```
Path 1E-COMMIT（D2 通過門檻）：
  1E-1. 留 USE_PACKED_BOXDATA flag 半年方便回滾
  1E-2. 更新 .omc/HANDOVER-R6-2.md 進度
  1E-3. 更新 docs/SOP/R6：渲染優化.md 第 86 行 d 項加 ✅
  1E-4. 開新 follow-up F-S2-1「半年後評估刪除 #else 路徑」
  1E-5. 進 Phase 1.5 Step 3 評估

Path 1E-ROLLBACK（D1 或 D2 未通過）：
  1E-1. JS flag = false、shader #define = 0
  1E-2. 撰寫 .omc/REPORT-R6-2-Phase-1.5-Step2-rollback.md
  1E-3. 更新 docs/SOP/R6：渲染優化.md 第 86 行 d 項加 ❌
  1E-4. 評估下一條路徑：BVH node packing (b)、stack→while (c)、或 R6-2 結案

Estimated time：1 hr commit / 2 hr rollback
```

---

## E. Verification Hooks（守門禁忌 1~5 對應檢查項，v2 增 Step 0 + D1/D2 拆分）

```
| 規則 | 檢查方式 | 觸發步驟 | 驗證者 |
|------|---------|---------|--------|
| 1. 不跳過 prototype-first | Step 0 三條件閘必先於 1A；Step 1A 必先於 1B/1C | Step 0 → 1A | Architect |
| 2. 不破壞 BVH traversal 正確性 | Test E1 4 cam × 4 config AE = 0 | Step 1C/1D2 | Critic + executor |
| 3. 不改材質/光源邏輯 | grep diff 確認只動 fetchBoxData + leaf branch + JS write | Step 1B/1C | Critic |
| 4. 不刪 fallback | Step 1C #else 路徑保留半年；Step 1E commit 不刪 | Step 1E | Architect |
| 5. 不堆疊多優化 | 每 Step 獨立 commit；0/1A/1B/1C/1D1/1D2/1E 各自可 git revert | Step 0~1E | Architect |
```

具體驗證腳本（v3 修訂）：

```
驗 Step 0 探針可逆性：
  git log --oneline | grep "Step 2 (0)"
  → 找到探針 commit hash
  → 若 Step 0c 三條件不過：git revert <hash> 必能還原 baseline
  → revert 後跑 Test O1 對 Phase 1.0 baseline ±2% 內
  → 若 Step 0c 用了 Y_estimate 選 A（atomic counter），revert 必同步清
  失敗：探針引入永久副作用 → 違 P3 → 阻斷後續

驗 R3（不改材質光源）：
  git diff phase-1.0..HEAD -- shaders/Home_Studio_Fragment.glsl |
    grep -E "^[+-].*(NEE|sampleStochastic|MIS|GGX|Lambert|fresnel|brdf|emission|radiance)"
  預期：0 行匹配（uForceFullFetch ternary 不含這些關鍵字）

驗 R5（commit 原子性）：
  git log phase-1.0..HEAD --oneline | wc -l
  預期 commit 計數：
    - Step 0 進 1A~1E 完整路徑：≥ 7 (0 + 1A + 1B + 1C + 1D2 + 1E commit + report)
    - Step 0 失敗跳過：1 (探針) + 1 (revert) + 1 (探針報告) = 3

驗 R2（pixel exact）：
  cd .omc/test-runs/phase-1.5-step2/
  for f in *.png; do
    magick compare -metric AE ../../baselines/phase-1.0/$f $f null: 2>&1
  done
  預期：所有輸出皆為 "0"
  ★ v3 注意：baselines/phase-1.0/ 需先在 Step 1C-0 補拍

驗 Step 0 三條件數值（v3 修訂）：
  讀 .omc/REPORT-R6-2-Phase-1.5-Step2-step0-probe.md
  確認：
    (a) C1/C2/C4 至少 2 個 force-full-fetch Δ ≥ 5%（fail-fast 跳過則 N/A）
    (b) C1/C2/C4 至少 2 個 leaf 段時間佔比 ≥ 15%（fallback 改 (a) Δ ≥ 8%）
    (c) X × Y_estimate × 0.6 ≥ 5%
  三條件均過才允許 1A 進入；任一不過 1A 必拒入

驗 spectorJS HLSL 翻譯（v3 新增）：
  讀 Step 0a-5 截圖或筆記
  確認：HLSL output 顯示 [branch] 或 if/else block，非 select() / cmov
  若 select → 觸發 0a-5b compile-time 雙 build 路徑（額外 0.5 hr）
```

---

## F. Open Questions（v3：給 Critic / executor 處理）

> v3 修訂：原「Closed Questions」標題誤導，本段僅留真正 open 的 Q2/Q3/Q6/Q7
> 閉鎖的 Q1/Q4/Q5 已移到對應主體段落（§A.2 / §C.5 / §D Step 1C）

### Q2【保留 open】Option 5：4-texel layout 是否可行？

```
原問題：fixtureGroup + cullable + meta + type 4 個整數欄位 uintBitsToFloat 三合一
v2 仍 open：給 Critic 評估「8-bit cullable + 8-bit fixtureGroup + 8-bit meta +
            8-bit type ⊆ 32-bit float」是否違 P4
本步驟暫不採納，作為 Phase 1.5 Step 3 候選
```

### Q3【保留 open】updateBoxDataTexture 第三寫入點（v3 修訂答案）

```
原問題：grep "tBoxDataTexture.value" 全結果應只有 2 處
v3 grep 答案（已查證 5 處 reference）：
  - L319, 322: uniform binding（first-bind vs rebind，無 layout 風險）
  - L329, 330: read access（layout 透通）
  - L344: needsUpdate flag（layout 透通）
  實際資料寫入 loop：
  - L296-306（buildSceneBVH 內 5×4 寫入迴圈）
  - L334-342（updateBoxDataTexture 內 5×4 寫入迴圈）
  → 無第三處資料寫入，僅 2 處需同步加 #if 分支（已寫入 §D Step 1B）
v3 處置：Q3 主體已閉鎖；保留 open 給 Critic 驗 grep map 正確性
```

### Q6【保留 open】R3-8 採購擴張到 ≥ 200 box 時 BVH_TEX_W=512 升 1024

```
v2 處置：本步驟不動 width（守 P1），R3-8 階段獨立做
此問題寫入 .omc/plans/open-questions.md 跨 plan 追蹤
```

### Q7【保留 open】shader USE_PACKED_BOXDATA #define 是 hard-code 還是 uniform？

```
v2 處置：建議 hard-code（compile-time #define）
理由：Step 1D1 量測就是兩 build 對比（hard-code 切換需重 compile）
Step 0 探針期 uForceFullFetch 用 uniform（探針期需動態切）兩者不衝突
此問題 Critic 確認後可閉鎖
```

---

## G. ADR（Decision Record，最終共識後填）

```
Decision: （Step 1E commit 後填）
  TBD pending Step 0 三條件 + Step 1D1/1D2 量測結果。
  預期填（v3 修訂）：
    路徑 W：「Step 0a fail-fast（Δ < 3%）→ Step 2 跳過、SOP §86 d 項標 ⏭️」
    路徑 X：「Step 0 三條件均過、Option 3 packed flag ON、保留 #else 路徑半年」
    路徑 Y：「Step 0 條件不過、Step 2 跳過、SOP §86 d 項標 ⏭️」
    路徑 Z：「Step 0 過但 1D1/1D2 量測未達門檻、rollback、SOP §86 d 項標 ❌」

Drivers:（來自 §A.2）
  D1. GPU texel cache 命中
  D2. shader 編譯器 DCE
  D3. boxData 容量上限與擴展

Alternatives considered:
  Option 1（color packing 損精度）→ 違 P4 排除
  Option 2（roughness/metalness 8-bit + emission 推導）→ 違 P1+P4 排除
  Option 4（2-texel 極限）→ 物理崩潰排除
  Path D（v3 新增 first-class）：「Skip Step 2，直接走 SOP §86 c (while-loop traversal)
                                  或 R6-2 結案」
    cost: 0
    benefit: 0（保守）
    trigger: Step 0 三條件不過時自動切到此路徑
    為何留作 first-class：deliberate 模式公平性要求「do nothing」是有效選項
    follow-up：若觸發此路徑，自動啟動 §86 c 獨立 ralplan

Why chosen:
  Option 3 唯一同時滿足 P1+P4，且 Step 0 探針可低成本驗證 P2+P5

Consequences:
  正面：
  - 期望 Δspp/sec = Step 0 量到的真實上限 × 命中率 × 0.6
  - 範圍最小、回滾最快
  - Step 0 三條件閘最壞節省 9 hr 工時
  - v3 fail-fast 機制讓 50% 機率 0.5 hr 即決
  負面：
  - 留下 #if USE_PACKED_BOXDATA 雙路徑半年增加維護
  - 若 Step 0 不過或 1D1/1D2 未達 +5% 將 rollback + 寫失敗報告
  - Step 0 探針 0.5~1.5 hr 為「pre-cost」，Step 0 失敗時是純沉沒成本（但避免 9 hr 大沉沒）

Follow-ups:
  F-S2-1：半年後評估刪除 USE_PACKED_BOXDATA #else 路徑
  F-S2-2：Phase 1.0 報告 §8 F1 C3 21% frame-skip 仍未解，本步驟順道驗
  F-S2-3：若 Step 2 過、進 Step 3 評估 BVH node packing 或 stack→while
  F-S2-4：Step 0 EXT_disjoint_timer 在 Apple M4 Pro Metal/ANGLE 不支援的
                    fallback 方案（performance.now() + uForceFullFetch 推算法）
                    需驗證精度足以區分 ≥ 15% 門檻
  F-S2-5：若 Step 0 三條件不過，將 step0-noop.md 報告數值轉為
                    SOP §86 永久經驗法則「78-box 級小場景 leaf fetch 非瓶頸」
  F-S2-6（v3 新增）：§86 c (while-loop traversal) 是另一條 BVH 結構優化路徑
                    與 leaf packing 不重疊（c 改 traversal 邏輯而非 fetch layout）
                    若 Step 0 失敗 → 自動啟動 §86 c 獨立 ralplan
                    若 Step 0 過但 1D1/1D2 未達門檻 → §86 c 仍是有效備案
```

---

## H. 修訂歷史

```
- 2026-04-27 v1 Planner 初版（Deliberate consensus 模式、待 Architect/Critic 審）
- 2026-04-27 v2 Planner 修訂（Architect REVISE 後）：
  ★ A1~A4 antithesis 全 hit：
    1. 強制插入 Step 0 雙條件探針閘（force-full-fetch + EXT_disjoint_timer，1.5 hr）
    2. §A.4「+20% 期望」改為「真實上限 × 命中率 × 0.6」
    3. Q1/Q4/Q5 由 Step 0a / grep / §C.5 規範閉鎖
    4. Step D 拆 D1（單 config）+ D2（補測 + 16 張）
    5. Pre-mortem 加 Scenario 0
  ★ 編號重整：原 Step A~E → Step 1A~1E
  ★ Verification Hooks 加「Step 0 探針可逆性」驗證腳本
  ★ ADR Follow-ups 加 F-S2-4 + F-S2-5

- 2026-04-27 v3 Planner 修訂（Critic ITERATE 後，Round 2/5）：
  ★ 2 CRITICAL 修：
    1. Phase 1.0 baseline 16 張不存在 → §C.3 + §D Step 1C 加 1C-0 先補拍 baseline
       commit 進 .omc/baselines/phase-1.0/，路徑乾淨無增 Step 數
    2. PathTracingCommon.js 是 shader chunk module 不是 RAF host
       → §C.4 Test O0b、§D Step 0b-1、§D Step 0 commit msg、§G ADR follow-up
       全 s/PathTracingCommon\.js/InitCommon.js/，並補 L873/L879 行號
  ★ 4 MAJOR 修：
    3. §D Step 0a-5 spectorJS 詳化：5 步驟 + Acceptance pattern
       + 失敗 fallback 路徑（0a-5b compile-time #ifdef 雙 build）
    4. §D Step 0b-fallback 公式明確化：T_full / T_dce / leaf_占比 算式
       + 精度 ±3~5% + fallback 觸發時 (b) 改寫為 (a) Δ ≥ 8%
    5. §D Step 0c 三條件 + Y_estimate 實作（選 A GPU instrumentation /
       選 B offline analysis；建議選 B 不污染 shader）
    6. §F Q3 + §D Step 1B 補 grep 5 處 reference map（L319/322/329/330/344）
       特別點明 updateBoxDataTexture L334-342 漏寫差異風險
  ★ 2 [建議] 升 [必執行]：
    7. §D Step 0a-6 early-out 三層判斷：fail-fast (< 3%) / 直跳 (≥ 10%) / 灰色帶 (3~10%) 雙驗
    8. §D Step 1D1 前哨 C1 改 C2（C2 中位 baseline 更具代表性）
       同步 §D Step 1D2 補測對象由 C2/C4 改 C1/C4
  ★ 3 編輯瑕疵修：
    9. §F「Closed Questions」改為「Open Questions」，僅留 Q2/Q3/Q6/Q7
    10. §G ADR Alternatives 加 Path D「Skip Step 2」first-class
    11. §G Follow-ups 加 F-S2-6「§86 c while-loop traversal」備案 preview
  ★ 3 Pre-mortem 補強：
    12. Scenario 4：probe ternary 計算成本 > fetch 成本（select 編譯陷阱）
    13. Scenario 5：D1 過但 D2 揭示 C1 是 outlier（rollback by §C.5 (b)/(c)）
    14. Scenario 6：buildSceneBVH vs updateBoxDataTexture 寫入分歧（layout 漏同步）
       每個 scenario 含 trigger / detection method / exit/rollback path
```
