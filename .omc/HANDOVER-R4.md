# Handover: R4-4 ✅ → R4-5 execution entry

**Branch**: `r3-light`
**Status**: R3-0 ~ R3-7 ✅, R4-0 ✅, R4-1 ✅, R4-2 ✅, R4-3 ✅ (2026-04-21), R4-3-追加 ✅ (2026-04-24), R4-4 ✅ (2026-04-24).
**Next task**: R4-5 互動打磨（折疊預設、Cam 按鈕、Help、Hide、FPS/sample、snapshot、loading）

---

## R4-1 completion summary

### What was done
- CSS: ~180 lines of panel UI styles ported from old project (css/default.css)
- HTML: lil-gui removed; `#ui-container` with 3 panel-groups (⚙️光追設定 / 🔲材質設定 / 💡燈光設定) + cam buttons + help/hide + loading-screen + snapshot-bar
- JS: `createS` factory with meta+click reset; 5 DOM adapters (setSliderValue, getSliderValue, setSliderEnabled, setSliderLabel, setCheckboxChecked); `initUI()` replaces `setupGUI()`
- InitCommon.js: `gui = new GUI()` removed; pixel_Resolution ported to createS; pointer-lock events rebound to `#ui-container`
- lil-gui.module.min.js deleted

### User verification fixes (fix01-fix06)
- fix01: CSS cache-buster (panels invisible without it)
- fix02: InitCommon.js cache-buster (Stats.js still showing)
- fix03: Button group toggle handlers added
- fix04: Hide UI + info-panel cleanup + slider defaults aligned to shader uniforms
- fix05: Hide button stays visible; camera buttons pointer-lock guard; button glow matches old project
- fix06: Color temperature glow (orange/blue/gradient per old project); "南北側燈光"→"廣角燈" rename; per-side wide emission zeroing via syncWideEmissions(); panel max-height reduced to avoid snapshot overlap

### Known R4-3 scope items
- Wide track per-side mesh (housing) visibility needs shader-level separate uniforms
- Slider callbacks are wakeRender shells (R4-3 wires real logic)
- GIK preset buttons set block colors but don't update shader uniforms yet

---

## R4-2 completion summary

### What was done
- GLSL: Flattened 12 `uR3DynamicPoolEnabled` branches, deleted `sampleStochasticLight11` function (~120 lines).
- GLSL: Flattened 5 `uR3MisEnabled` branches, removed DCE sentinel.
- GLSL/JS: Removed 3 uniform declarations (`uR3MisEnabled`, `uR3MisPickMode`, `uR3DynamicPoolEnabled`) and JS throw-first guards.
- HTML/CSS/JS: Implemented CONFIG 1/2/3 radio buttons UI, replacing the old system and successfully connecting to `applyPanelConfig()`.
- Verified step-by-step compilation and checked scene rendering.

---

## R4-3 completion summary

### What was done
- JS: 全面控件接線：A/B radio（bounces/mult 切換）、色溫 radio 群組（Cloud/Track/Wide South/North）、Lumens slider（Cloud/Track/Wide）、Light enable checkbox（Cloud/Track/Wide South/Wide North）、牆面反射率 slider、間接光補償 A/B slider
- JS: GIK minimap 完整接線：9 塊牆板 + All + Ceil，palette（灰/白 2 色，紅色因廠商無貨移除）；索引映射 Config 1/2/3 正確對齊 sceneBoxes
- JS: Track / Wide 外觀色 radio（黑/白）→ sceneBoxes color 更新
- JS: 視角按鈕 cam1/2/3 → `switchCamera()` 接線
- JS: Hide UI 按鈕接線

### User decisions (scope changes vs original SOP)
- `slider-emissive-clamp` 移除：使用者主動決定（固定值 50 已足夠，不需 UI 暴露）
- `#groupGikPresets` 2 個預設按鈕整合進 GIK palette：使用者主動決定
- `🔲材質設定` 獨立 panel 整合進配置/光追面板：使用者主動決定
- GIK 只保留灰/白 2 色：廠商無紅色 GIK 貨，CSS data-color=2/3 為 dead code

### Known R4-4 scope items (carried forward)
- Sweet-spot sliders（beam-inner/outer, tilt, spacing, x/z）= wakeRender shell，待 R4-4 接真實 uniform
- Wide track per-side mesh (housing) visibility 需 shader 端分開 uniform（延後）
- A/B bounces/mult 初始值未細調，待使用者決定後 R4-4 一併處理

### Session hotfix (2026-04-21, post R4-3)
- **Bug fix**: CONFIG 3 吸頂燈出現黑色圓柱於房間北方
  - Root cause: `uCeilingLampPos.value.z = -1.5` 落在房間內（北牆 z=-1.874）；`CylinderIntersect` 無條件執行，emission=0 → 黑色幾何體可見
  - Fix: `applyPanelConfig` L373 改為 `cloudOn ? 100.0 : 0.591`（房間 z_max=3.056，100.0 確保光線永不命中）

---

## R4-3-追加 completion summary（2026-04-24 DONE，commit `0594f00`）

### What was done（原子 commit，single atomic unit）

Shader（`shaders/Home_Studio_Fragment.glsl`）：
- 10 處漫射閘門 `if (diffuseCount == 1)` → `if (float(diffuseCount) < uMaxBounces)`
- MIS cache 三行（`misBsdfBounceNl / misBsdfBounceOrigin / misPBsdfStashed`）跟著閘門一起放寬，每層 diffuse hit 更新
- 7 處 swap handler `diffuseCount = 1` → `diffuseCount++`（L986/1059/1101/1139/1183/1203/1731）
- **ceiling NEE 潛伏 bug 發現與修復**（L1021/1029/1033）：`accumCol = ...` → `accumCol += ...`
  - 原版 `== 1` 閘門下每條路徑最多 1 次 ceiling NEE hit，`=` 與 `+=` 等效 → bug 潛伏
  - 解除截斷後多層 NEE hit 互相覆寫，留最深層（最弱）貢獻 → bounces 越多畫面越暗（反向症狀）
  - fix 後對齊 TRACK_LIGHT / CLOUD_LIGHT 分支既有 `+=` 慣例

JS 補償魔數歸一（`js/Home_Studio.js`）：
- `uIndirectMultiplier` 1.7 → 1.0
- `uLegacyGain` 1.5 → 1.0
- `slider-mult-a/b` createS default 1.7 → 1.0

A/B 預設值更新：
- A 趨近真實：bounces=14、補償 mult=1.0、牆面反射率 0.85
- B 快速預覽：bounces=4、補償 mult=2.5、牆面反射率 1.0
- 載入預設 A 模式（HTML btnGroupA 已 glow-white）
- `uMaxBounces` uniform 初值 4.0 → 14.0（`js/InitCommon.js`）
- `wallAlbedo` JS 初值 1.0 → 0.85；`C_WALL` 系列初值 × 0.85
- 新增 `applyWallAlbedo(v)` helper，A/B onclick 同步 slider + C_WALL

桌面參考塊：
- 中央工作桌正中央 18×18×0.1cm 50% 灰 DIFF patch（`sceneBoxes` index 59）
- `bmin=[-0.09, 0.758, 0.337]`、`bmax=[0.09, 0.759, 0.517]`
- 微抬法 y=+1mm 防 Z-fighting

Cache-buster：`?v=uncap-test`

### 驗收紀錄

- bounces 4/8/12/14 逐格肉眼驗收：單調變亮，符合拋物線趨緩預期
- A 模式畫面比對使用者實體錄音室光影，符合真實印象
- CONFIG 3 軌道陰影不對稱疑問：驗證後確認**非 bug**，是 Cloud 燈條距離差異導致的陰影銳利度物理差（E/W rod ↔ Track 5.8cm vs S/N rod ↔ Wide 41cm）

### 過程中走過的錯路（systematic-debugging 紀律下定位根因）

1. 解法 A（gate 拆 block、MIS cache 鎖 `== 1`）→ 多層變暗 → 撤回
2. 解法 B（gate + MIS cache 一起放寬）→ 多層仍變暗 → 撤回
3. 走 `/systematic-debugging` 四階段，讀全 shader 發現 ceiling 分支 `=` 而非 `+=` → 才是 R3 以來潛伏的 root cause

### Ralplan 迭代路徑
- 2026-04-20 初版：Option B + 單 commit + 場景 patch 錨點（APPROVE）
- 2026-04-24 兩輪迭代修訂：補加 `diffuseCount` reset `++`、桌面 patch 錨點、Pre-mortem S4 結構性無效情境

---

## R4-4 completion summary（2026-04-24 DONE）

R4-4 以 11 個 fix 漸進交付。量綱鎖死、甜蜜點校正、UX 打磨三軸獨立迭代，物理正確性優先於舊基準連續性。詳見 `docs/SOP/R4：UI控制層.md` 的 `R4-4 甜蜜點 UI ✅ → ### 完工紀錄（2026-04-24 DONE）` 段。

### fix 序列摘要

| fix | 主題 | 關鍵改動 |
|---|---|---|
| fix01 | 原子實作 | 10 滑桿 + `trackLampCandela()` 反冪律 + 4 recompute 輔助 + BVH pointer 策略 + 光束角互鎖 |
| fix01-idx | sceneBoxes index 錯位修正 | 4 具名索引 `TRACK_BASE_IDX=53` / `TRACK_STAND_IDX=57` / `TRACK_WIDE_BASE_IDX=61` / `TRACK_WIDE_STAND_IDX=63` + load-time `fixtureGroup` throw-first 守門 |
| fix02-radiance | **量綱修正（物理正確優先）** | `computeTrackRadiance` cd 路徑 `cd/(K·π·A)` → `cd/(K·A)` 移除多餘 /π（cd 已是 per-steradian，不需再做 Lambertian 分攤）；舊路徑 Φ/(K·π·A) 的 /π 保留 |
| fix03-presets | 甜蜜點預設校正 | Cloud 1600 lm/m、Track 2000 lm、Wide tilt 0/-30、trackWideZ 0.20 |
| fix04-tilt | 南側 tilt 校正 | 0°→30°（避 Cam 3 視野高光點） |
| fix05-config4 | CONFIG 3 拆 3/4 | CONFIG 3 = 全吸音 + 僅 Cloud（工作）；CONFIG 4 = 全吸音 + 軌道+廣角（氣氛）；CONFIG 4 Cloud 預設關可手動補光 |
| fix06-beam | beam 角度微調 | Track 30/55 → 40/60；Wide 95/120 → 90/120 |
| fix07-ui-gate | Section disable | checkbox-gated section `opacity:0.35 + pointer-events:none` |
| fix08-hide | Section 隱藏 | `display:none` 替代 disable；CONFIG 4 Cloud 保留顯示 |
| fix09-tight | 緊湊版面 | 2 divider 移入 section 內；slider-brightness 在 CONFIG 3/4 display:none |
| fix10-reorder-grayscale | 面板順序 + checkbox 灰階 | UI 順序 `🔧 配置 → 💡 燈光設定 → ⚙️ 光追設定`；未勾 checkbox → section 內容灰階 + disable（Wide 南/北 checkbox 保持可點） |
| fix11-gik-panel | GIK 獨立面板 | `🎨 吸音板顏色` 拆為頂層獨立面板（第 2 位），預設折疊 |

### 量綱修正（fix02 核心）

使用者肉眼察覺「整體刷白、冷暖對比淡化、桌子偏暗」，systematic-debugging 四階段根因定位為 `computeTrackRadiance` 的 cd 路徑**多除一個 π**：

```
錯：L = cd / (K · π · A)  ← 把已是 per-steradian 的 cd 當作總 Φ 做 Lambertian /π 分攤
對：L = cd / (K · A)      ← cd 已含方向性強度，只需 /A 歸面積、/K 轉 radiometric
```

修後投射燈 radiance 從舊 Lambertian 基準的 87% 回升至 273.5%（π 倍），採購視覺基準重設。I5 驗證 `cd(2000,15°)/cd(2000,60°) = 3.0001` 精確維持（規格書 4800/1600 cd）。

### 第 10 條滑桿（wide-z）公式裁決

SOP L700 Plan v5 `trackWideZ = 1.20 + v`（對稱於 z=0）與 R2-15 非對稱 uniform 預設 2.1/-1.1 矛盾。佐證 `SOP/R2：所有幾何物件.md:882` 註記「新 R2 以絕對座標替代」。裁決採**選項 C 真字面「距 Cloud 邊距」**：

```
南軌 z = 1.698 + v    (Cloud 南邊緣 + 距離)
北軌 z = -0.702 - v   (Cloud 北邊緣 - 距離)
範圍 0.05 ~ 1.15（上界讓北軌 z=-1.852 距北牆 22mm 安全邊界）
預設 0.40（對應舊 uniform ±2mm）
```

### CONFIG 拆分決策（fix05）

原 Plan v5 CONFIG 3 將 Cloud + 軌道 + 廣角三光源 checkbox-gated 共存，使用者發現工作光源需求（全亮）與氣氛光源需求（冷暖對比）難以共用 scope。裁決為：

- CONFIG 3 = **全吸音 + 僅 Cloud 漫射燈**（全亮好工作）
- CONFIG 4 = **全吸音 + 軌道+廣角燈**（冷暖有氣氛）

CONFIG 4 下 Cloud 區 UI 仍可見但 `chkCloud` 預設未勾，使用者可手動補光（Cloud 重構 R5 之前的暫行方案）。

### User decisions（SOP Plan v5 之外）

- CONFIG 3 拆 3/4（fix05）
- 面板順序重排 + 🎨 吸音板顏色獨立頂層面板（fix10/fix11）
- 量綱修正（fix02，Plan v5 L640-646 與本專案 kelvinToLuminousEfficacy 量綱體系不合；實作以物理正確性收斂）

### Known carry-forward to R5

- **F5 Cloud 光源重構（R5 主任務）**：4 rod → 1 大 panel 長方體 + 16mm 內縮遮擋箱 + face-selective emission。Φ=13,338 lm / A=0.267 m² / L=49.67 W/(sr·m²) 三項與現況精確等效（計算驗證 0.34% 偏差）。pool 4→1 可望 CONFIG 3 收斂加速 ~4×。需 shader 改動（stochastic NEE 採樣邏輯重寫），獨立階段前先 ralplan。
- **F6 A/B 模式去留評估**：使用者提「視覺偏差太大考慮拿掉」；R5 開頭一併裁決。
- **stochastic NEE pool size 收斂問題**：MC variance ∝ pool size，CONFIG 3 pool=4 需 ~4× SPP 才達 pool=1 噪點水準。shader 端採樣策略（全展開 vs stochastic pick）需在 R5 shader 改動時一併驗證。

### Brave 指紋保護觸發兼容問題（2026-04-24）

使用者反映 Brave 瀏覽器於 R4-4-fix11 突然失效，切 Chrome 正常。可能與 Brave 指紋保護策略更新有關（與 memory 記錄的「R4-1 桌面 ontouchstart 誤判 mouseControl」同類）。非 R4-4 blocker，留作後續排查。

---

## Completed commits on this branch (latest → oldest)

| Commit | Scope |
|---|---|
| `bb83f94` | R4-4 DONE: 10 滑桿 + 反冪律 + BVH pointer 策略 + 量綱修正（cd/(K·A)）+ 甜蜜點預設校正 + CONFIG 3 拆 3/4 + UI 面板順序重排 + 🎨 吸音板顏色獨立 + checkbox 未勾灰階（11 fix 漸進交付） |
| `fafc740` | docs: R4-4 Plan v5 決策紀錄寫入 SOP + 敘述中文化 + 品牌名統一 |
| `36b20cc` | docs: R4-3-追加 通過後處置（SOP ✅ 雙標 + HANDOVER 完工紀錄 + 演算法基準小節）|
| `0594f00` | R4-3-追加 DONE: 解除漫射反射上限 + ceiling NEE bug 修復（accumCol = → +=）+ A/B 預設值（A=14/1.0/0.85, B=4/2.5/1.0）+ 桌面參考塊 + cache-buster ?v=uncap-test |
| `03e0454` | R4-3 DONE: 控件接線（UI 事件全面綁定，GIK Minimap 索引修正與舊版視角參數復刻）|
| `f0be38b` | R4-2 DONE: 12 shader branches flattened, sampleLight11 removed, 3 uniforms removed, CONFIG radio UI implemented |
| `7d754cb` | docs: R4-1 Debug_Log 經驗紀錄 + HANDOVER 交接訊息 |
| `017bfe0` | R4-1 DONE: UI skeleton + CSS + createS + DOM adapters + lil-gui removal + fix01-fix06 |
| `4eb2187` | R4-0 HANDOVER update |
| `a9c0fe6` | R4-0 revision — cavity-panel + post-panel removed |
| `97f70de` | R4-0 old-project UI inventory |
| `deb2c99` | R4 entry cleanup |
| `d2a6544` | R3-7 DONE |

## Pre-reads (in order)

1. `docs/SOP/Debug_Log.md` — universal debug discipline (never skip)
2. `docs/SOP/（先讀大綱.md` — stage overview, current ✅ / ⬜ snapshot
3. `docs/SOP/R4：UI控制層.md` — fully expanded SOP with R4-1~R4-5 detailed bodies
4. `CLAUDE.md` — project-level conventions

## Ralplan consensus decisions (2026-04-20, Planner+Architect+Critic 2 iterations)

1. **Option A — atomic switch**: R4-1 ports HTML skeleton + CSS + createS factory in one commit; lil-gui removed simultaneously.
2. **Photometric beam model**: R4-4 beam angle sliders affect brightness. `computeTrackRadiance` activates `beamFullDeg` parameter.
3. **BVH two-tier update**: beam/tilt/emission = instant uniform-only; spacing/distance = sceneBoxes mutation → 200ms debounce → `buildSceneBVH()`.
4. **InitCommon.js in R4-1 scope**: `gui = new GUI()` removed, pixel_Resolution ported to createS, pointer-lock rebound.
5. **DOM adapters replace lil-gui API**: setSliderValue / getSliderValue / setSliderEnabled / setSliderLabel / setCheckboxChecked.

## Constraints / non-negotiables

- **No R4-6.** User verifies UX directly; no A/B screenshot phase.
- **1:1 old-project replication** — not wabi-sabi.
- **R4-0 removal decisions**: `#cavity-panel` removed, `#post-panel` removed.
- **No cache-buster bump** for doc-only commits.
- **CONFIG 3 path-tracing noise** deferred to later denoising stage.
- ~~**uLegacyGain = 1.5** stays framework-compensation uniform, not UI-exposed.~~ **作廢（R4-3-追加 commit 0594f00 已歸一 1.0）**。shader 已進化為 N-bounce 可調，補償魔數不再需要。

## R4 sub-phase summary

| Phase | Goal | Key risk |
|---|---|---|
| R4-1 | HTML panel skeleton + CSS + createS + DOM adapters; drop lil-gui + modify InitCommon.js | ✅ DONE |
| R4-2 | 12-point shader flattening + sampleStochasticLight11 deletion + 3 uniform removal | ✅ DONE |
| R4-3 | CONFIG 1/2/3, A/B radio, color-temp radios, lumens, GIK minimap, light checkboxes | ✅ DONE |
| R4-3-追加 | Uncap diffuse bounce + ceiling NEE bug fix + A/B 預設值（14/1.0/0.85 vs 4/2.5/1.0）| ✅ DONE |
| R4-4 | Track 5 + Wide 5 sweet-spot sliders; photometric model; BVH debounce | ✅ DONE (2026-04-24) |
| R4-4 追加 | CONFIG 3 拆 3/4 + UI 面板順序 + 🎨 吸音板顏色獨立 + checkbox 未勾灰階 | ✅ DONE (2026-04-24，含在 R4-4 commit 內) |
| R4-5 | Fold defaults, Cam buttons, Help, Hide, FPS/sample, snapshot, loading | Low risk |
