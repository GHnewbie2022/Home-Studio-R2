# R4：UI控制層（舊專案 1:1 復刻）

## 🚨 接手第一步（不得跳過）

1. 先讀 `Debug_Log.md` 開頭「通用 Debug 紀律」
2. 確認分支：`git branch --show-current` 應為 `r3-light`（R3 完工後不另開 r4 分支，延用至 R4 merge 前）
3. 讀本檔 + `.omc/HANDOVER-R4.md`

---

## 前提定調

- **「Wabi-sabi」不是設計目標**：該標籤來自先前 Gemini 對話，應忽略。真正方向是將舊專案 UI/UX 1:1 復刻；新 R3 功能（舊專案無）必須以與舊專案一致的風格整合進同一版面。
- **吸音板顏色控制**：僅作為美學預覽工具保留，Dimi Music 僅售白色 GIK，已非採購決策依據。
- **R4 不處理 CONFIG 3 噪點**：屬後續 denoising 階段。
- **驗收**：使用者直接操作 UX，**無 A/B 截圖比對階段**（無 R4-6）。
- **文件-only commit**：不需 cache-buster。

---

## 階段總覽

| 階段 | 主題 | 狀態 |
|------|------|------|
| R4-0 | 舊專案 UI 盤點 + 新 R3 控件整合策略 | ✅ |
| R4-1 | UI 骨架復刻（HTML panel + CSS + createS 工廠 + DOM adapter；丟棄 lil-gui；含 InitCommon.js 改造） | ✅ |
| R4-2 | 鷹架移除（12 處 shader 分支扁平化 + sampleStochasticLight11 刪除 + 3 uniform 移除） | ✅ |
| R4-3 | 控件接線（CONFIG 1/2/3、A/B radio、色溫 radio、lumens slider、GIK 色控、light checkbox） | ✅ |
| R4-4 | 甜蜜點 UI（Track 5 + Wide 5 slider；光度量測模型；BVH 兩層更新策略） | ⬜ |
| R4-5 | 互動打磨（折疊預設、Cam 按鈕、Help、Hide、FPS/sample、snapshot、loading） | ⬜ |

---

## R4-0 舊專案 UI 盤點 + 整合策略 ✅

**來源檔**：`/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D_OLD/Path Tracking 260412a 5.4 Clarity.html`（2272 行、單檔自包含；CSS 與 JS 全 inline；唯一外部 JS 為 `sylvester.min.js` CDN）。

### 🚨 關鍵技術落差（先看，否則 R4-1 會搞錯方向）

- **舊專案 UI 不用 lil-gui**。它是自製 HTML panel + inline CSS + inline JS，以 `createS(divId, label, min, max, step, init, onChange)` 做 slider、以 `.action-btn` + `.glow-*` CSS class 做色溫 / A/B radio、以 `panel-header + panel-content.collapsed` 做可折疊 group。
- `.omc/HANDOVER-R4.md` Step 2/R4-1 中「lil-gui folder 復刻」字樣屬交接當下推測；本 R4-0 盤點後應改為「自製 HTML panel 骨架復刻」，於 R4-1 修正。
- 主專案目前之 lil-gui 版本需整包丟棄，改搬舊專案 HTML body + CSS + `createS` 工廠函式。`createPostControl` 因影像後製面板於 R4-0 決議移除，一併不搬。

### 舊專案 UI 結構盤點

#### 主控制面板（`#ui-container`，左側折疊柱）

容器根：`<div id="app-container">` → `<div id="ui-container">` → 五個 `panel-group > panel-header + panel-content.collapsed` 區塊。

| 區塊 | header id / icon / 中文 | 控件清單（id） | label / 型態 | 範圍 / step / 初值 | state 變數 | onChange 副作用 |
|---|---|---|---|---|---|---|
| 光追設定 | `#ray-header` ⚙️ | `#btnGroupA` / `#btnGroupB` | 趨近真實 / 快速預覽（`action-btn` radio） | A/B 切換 | `activeGroup` | 切換 `group-a-controls` / `group-b-controls` 顯示；覆寫 bounces/clamp/mult 預設值（原 `postState` 同步已隨 R4 移除後製面板作廢） |
| 光追設定 | 同上 | `#slider-bounces` | 彈跳次數 | 1 ~ 8 / 1 / A=8, B=4 | `maxBounces` | A/B 預設值切換時一併覆寫 |
| 光追設定（A） | 同上 | `#slider-clamp-a` | 亮截斷上限 | 1 ~ 50000 / 1 / 2000 | `fireflyClampA` | — |
| 光追設定（A） | 同上 | `#slider-mult-a` | 間接光倍率 | 0.1 ~ 5.0 / 0.1 / 1.0 | `indirectMultA` | — |
| 光追設定（B） | 同上 | `#slider-clamp-b` | 亮截斷上限 | 1 ~ 5000 / 1 / 500 | `fireflyClampB` | — |
| 光追設定（B） | 同上 | `#slider-mult-b` | 間接光倍率 | 0.1 ~ 5.0 / 0.1 / 2.0 | `indirectMultB` | — |
| 影像後製【R4 移除】 | `#post-header` 📷 | `#slider-edge-sigma`（placeholder，未 wire up） | — | — | — | 檔案殘留 div，無 createS binding |
| 影像後製【R4 移除】 | 同上 | `#slider-bloom-intensity` | Bloom 強度 | 0.0 ~ 2.0 / 0.01 / 0.15 | `bloomIntensity` | `if (sampleCount>=1500) renderPost()` |
| 影像後製【R4 移除】 | 同上 | `#slider-bloom-radius` | Bloom 半徑 | 1.0 ~ 20.0 / 0.5 / 2.0 | `bloomRadius` | 同上 |
| 影像後製【R4 移除】 | 同上 | 6 條 `createPostControl` sliders | 曝光(EV) / 高光 / 陰影 / 對比 / 飽和度 / Gamma（每條附獨立 checkbox 切開關） | 見 HTML L2258 | `postState[activeGroup]` | 即時 `renderPost()` |
| 空腔設定【R4 移除】 | `#cavity-header` 🧱 | `#btnSideCavity` / `#btnNorthCavity` | 側牆 / 北牆（toggle） | on/off | `sS` / `sN` | `updateCavity('side'/'north', bool)` |
| 材質設定 | `#mat-header` 🔲 | `#slider-wall-albedo` | 牆面反射率 | 0.1 ~ 1.0 / 0.05 / 0.8 | `wallAlbedo` | — |
| 材質設定 | 同上 | `#groupGikPresets` × 2 | 北牆灰/其餘白、北牆灰/頂白/側牆紅（`action-btn` radio） | 2 preset | — | 套用到 gik-minimap |
| 材質設定 | 同上 | `.gik-minimap`（5 row：全部 / 天花板 / 北牆 / 東牆 / 西牆；共 13 個 `.gik-block`） | 每塊點擊循環 4 色 | `data-color=0/1/2/3` | `gikColors[]` | `cameraIsMoving=true` |
| 燈光設定 | `#light-header` 💡 | `#slider-emissive-clamp` | 發光面上限 | 10 ~ 500 / 1 / 250 | `emissiveClamp` | — |
| 燈光設定：Cloud | 同上 | `#chkCloud`（checkbox） | Cloud 漫射燈 開關 | checked 預設 | `cloudOn` | 重啟累積 |
| 燈光設定：Cloud | 同上 | `#groupCloudColor` × 3 | 暖光 3000K / 自然 4000K / 白光 6500K（`action-btn` 配 `glow-orange/white/blue`） | 單選 | `cloudColorMode` | `cameraIsMoving=true` |
| 燈光設定：Cloud | 同上 | `#slider-lumens` | 光通量 (lm/m) | 0 ~ 4000 / 1 / 800 | `lumens` | — |
| 燈光設定：Track | 同上 | `#chkTrack` | 軌道燈 開關 | checked 預設 | `trackOn` | — |
| 燈光設定：Track | 同上 | `#groupTrackMeshColor` × 2 | 黑 / 白（外觀色，`action-btn glow-white`） | 單選 | `trackMeshColorMode` | — |
| 燈光設定：Track | 同上 | `#groupTrackColor` × 4 | 全暖 3000K / 全冷 6000K / 北暖南冷（`glow-gradient-ob`）/ 北冷南暖 | 單選 | `trackColorMode` | — |
| 燈光設定：Track | 同上 | `#slider-track-lumens` | 光通量 (單盞) | 0 ~ 3000 / 50 / 500 | `trackLumens` | — |
| 燈光設定：Track | 同上 | `#slider-track-beam-inner` | 光束角(內) | 1 ~ 90 / 1 / 30 | `trackBeamInner` | `min(v, trackBeamOuter)` clamp |
| 燈光設定：Track | 同上 | `#slider-track-beam-outer` | 光束角(外) | 15 ~ 90 / 1 / 55 | `trackBeamOuter` | `max(v, trackBeamInner)` clamp |
| 燈光設定：Track | 同上 | `#slider-track-tilt` | 傾斜角 | 0 ~ 90 / 1 / 45 | `trackTilt` | — |
| 燈光設定：Track | 同上 | `#slider-track-space` | 光斑間距 | 0 ~ 180 / 1 / 150 | `trackSpacing` | — |
| 燈光設定：Track | 同上 | `#slider-track-x` | 距Cloud邊距 | 0.05 ~ 0.90 / 0.01 / 0.05 | `trackBaseX = 0.90 + v` | — |
| 燈光設定：TrackWide | 同上 | `#chkTrackWideSouth` / `#chkTrackWideNorth` | 南/北側電源 | 2 checkbox | `wideSouthOn` / `wideNorthOn` | — |
| 燈光設定：TrackWide | 同上 | `#groupTrackWideMeshColor` × 2 | 黑 / 白 | 單選 | `trackWideMeshColorMode` | — |
| 燈光設定：TrackWide | 同上 | `#groupTrackWideColorSouth` × 3 | 暖 3000K / 自然 4000K / 白 6000K（南側） | 單選 | `trackWideColorSouth` | — |
| 燈光設定：TrackWide | 同上 | `#groupTrackWideColorNorth` × 3 | 同上（北側） | 單選 | `trackWideColorNorth` | — |
| 燈光設定：TrackWide | 同上 | `#slider-track-wide-lumens` | 光通量 (單盞) | 0 ~ 4000 / 50 / 2500 | `trackWideLumens` | — |
| 燈光設定：TrackWide | 同上 | `#slider-track-wide-beam-inner` | 廣角束角(內) | 10 ~ 160 / 1 / 95 | `trackWideBeamInner` | clamp |
| 燈光設定：TrackWide | 同上 | `#slider-track-wide-beam-outer` | 廣角束角(外) | 60 ~ 160 / 1 / 120 | `trackWideBeamOuter` | clamp |
| 燈光設定：TrackWide | 同上 | `#slider-track-wide-tilt-south` | 南側傾斜角 | -70 ~ 70 / 1 / 15 | `trackWideTiltSouth` | — |
| 燈光設定：TrackWide | 同上 | `#slider-track-wide-tilt-north` | 北側傾斜角 | -70 ~ 70 / 1 / -25 | `trackWideTiltNorth` | — |
| 燈光設定：TrackWide | 同上 | `#slider-track-wide-z` | 距Cloud邊距 | 0.10 ~ 1.30 / 0.01 / 0.10 | `trackWideZ = 1.20 + v` | — |

#### 固定位置控件（非 ui-container）

| 位置 | id | 功能 | 備註 |
|---|---|---|---|
| 右上 `#top-right-group` | `#btnCam1` / `#btnCam2` / `#btnCam3` | 視角 1 / 2 / 3（各自 eye / angleX / angleY / fov 硬編碼） | `cam-btn` class |
| 右下 `#bottom-right-group` | `#help-btn` | `?` 圖示 hover 展開 `#instructions` 說明 | pure CSS hover |
| 右下 同上 | `#hide-btn` | 隱藏 `ui-container` + info-panel + top/bottom-right-group | `isUiVisible=false` |
| 左下 `#info-panel` | `#fps-counter` / `#sample-counter` | FPS、累計採樣（唯讀顯示） | — |
| 左下 `#snapshot-bar` | 動態填入 milestone 快照縮圖 | `snapshotMilestones` 到達時 `capturedMilestones.add()` | 搭 snapshot-preview hover |
| 左下 `#snapshot-actions` | `#btn-save-all` 📦 打包下載全部 | 匯出 milestone zip | 預設 `display:none`，有快照才現 |
| 過場 | `#loading-screen` + `#loading-ring` + `#loading-text` | 起始 loading 0~100% | SVG 環形進度 |

### CSS 特徵（抽離至 `css/default.css` 的單元）

- 配色：底 `#0c0c0c`、文字 `#d3d3d1 / #aaa / #ccc`、panel 背景 `rgba(28,28,26,0.9)`
- 字型 10~12px、圓角 3~4px
- `.action-btn` 基色 `rgba(0,0,0,0.2)`，hover `rgba(255,255,255,0.05)`
- `.action-btn.glow-white` → 中性 4000K 視覺（白光環）
- `.action-btn.glow-orange` → 3000K 暖光視覺（橘光環）
- `.action-btn.glow-blue` → 6000/6500K 冷光視覺（藍光環）
- `.action-btn.glow-gradient-ob` / `.glow-gradient-bo` → 漸層（北暖南冷 / 南暖北冷）
- `.panel-header`（可點擊 toggle `.collapsed`）、`.panel-content.collapsed { display:none }`
- `.control-row` / `.label-group` / `.label-text` slider+number 組合列
- `.sub-panel` / `.item-divider` 縮排與分隔線
- `.gik-minimap / .gik-row / .gik-label / .gik-blocks / .gik-block`（吸音板小地圖）
- `.cam-btn` 小型圓角視角按鈕

### 新 R3 控件整合策略

| 新 R3 控件 | 目前狀態（主專案 lil-gui） | 舊專案對應 | R4 處置 |
|---|---|---|---|
| R3-6 MIS 啟用 checkbox | lil-gui `uR3MisEnabled` toggle | 無對應 | **R4-2 刪除**；shader 端 `uR3MisEnabled = 1.0` hardcode、清 else-branch |
| R3-6.5 動態光源池 checkbox | lil-gui toggle + N 顯示 | 無對應 | **R4-2 刪除**；`uR3DynamicPoolEnabled = 1.0` hardcode、N 顯示移除 |
| CONFIG 1 / 2 / 3 切換 | 目前 lil-gui 下拉或 radio | 無對應（新功能） | **R4-3 新增**；沿用 `.action-btn` + `glow-white` radio 模式，建議置於新「場景切換」panel-group（⚙️ 光追設定之上）或併入光追設定頂端。CONFIG 3 噪點由後續 denoising 階段處理 |
| 色溫：Cloud / Track / TrackWide 獨立 | lil-gui 各自 slider 或 radio | `#groupCloudColor`、`#groupTrackColor`、`#groupTrackWideColorSouth` / North | **R4-3 1:1 復刻**，色溫 radio 按鈕與 glow-orange/white/blue 視覺映射 |
| Lumens：Cloud / Track / TrackWide | lil-gui 3 sliders | `slider-lumens` / `slider-track-lumens` / `slider-track-wide-lumens` | **R4-3 1:1 復刻**，沿用舊範圍 / step / 初值 |
| 吸音板色控 | lil-gui preset + color picker | `#groupGikPresets` + `.gik-minimap`（13 塊） | **R4-3 1:1 復刻**，定位為美學預覽（Dimi Music 僅售白色 GIK） |
| R3-5a 甜蜜點：燈傾角 / beam 角 / 軌到 GIK 距 / 同側燈距 | 目前 shader 端已用實測值寫死 | `slider-track-tilt` / `slider-track-beam-inner+outer` / `slider-track-x` / `slider-track-space` | **R4-4 復刻**，跨 shader geometry + JS uniforms + HTML slider 三層 |
| 間接光補償（R3-7 更名「框架限制」） | lil-gui slider 已更名 | `slider-mult-a` / `slider-mult-b`（A/B 兩套） | **R4-3 整合**，A/B 切換保留（驅動 bounces / clamp / mult 預設值），後製 `postState` 隨 post-panel 移除；視 R4-3 決策沿用 A/B 兩條 mult slider 或簡化為單 slider |
| `uLegacyGain = 1.5`（R3-0 遺留 uniform） | 目前主專案 shader 有 uniform、lil-gui 無 slider | 無對應 | **R4 不動**，維持 uniform 但不暴露給 UI（R3-7 已定性為永久補償） |

### R4 面板保留 / 移除決策

**移除**

- `#cavity-panel`（空腔設定）
  - 理由：GIK 244 為 fibreglass 為主的綜合型吸音板；空腔拉出對速度型吸收機制加分、對殼體壓力共振扣分，一來一往互抵，無淨益於採購評估
  - 決策：2026-04-20 使用者另行衡量後確立
- `#post-panel`（影像後製，含 edge-sigma placeholder + 2 條 bloom slider + 6 條 `createPostControl`）
  - 理由：舊專案架構物理性不足，須靠 tone curve / bloom / 曝光等後製層對齊肉眼期待，結果偏「精美截圖」性質；R3 真光源 + MIS + 動態光源池上線後，渲染管線已貼近物理正確，後製層失去必要性，保留反而會讓輸出從真實模型滑回精美截圖
  - 決策：2026-04-20 使用者裁定
  - 連動：`createPostControl` 工廠、`postState` 物件、`postSyncers` / `syncPostUI`、`sampleCount >= 1500 → renderPost()` callback 全部不搬

**保留（美學預覽）**

- 吸音板色控（`#groupGikPresets` 2 presets + `.gik-minimap` 5 row × 13 blocks）
  - Dimi Music 僅售白色 GIK，色控為視覺預覽工具，非採購決策依據

### R4 架構決策（2026-04-20 ralplan 三方共識）

以下決策經 Planner / Architect / Critic 兩輪迭代確立，R4 全程適用。

1. **Option A — 原子切換**：R4-1 一次搬完 HTML 骨架 + CSS + `createS` factory，同時丟棄 lil-gui。不採 Option B（lil-gui 共存漸進搬遷）——兩套 UI 共存期間同一 uniform 有兩個控件驅動，race condition 風險高於單次切換。
2. **光度量測模型（photometric）**：R4-4 beam 角度 slider 影響亮度（收窄 beam = 中心更亮）。`computeTrackRadiance` 啟用 `beamFullDeg` 參數：`candela = lm / (2π(1 − cos(halfAngle)))`，對齊舊專案 `lumenToCandela` 行為。
3. **BVH 兩層更新策略**：beam/tilt/emission 更新 = 即時 uniform-only（低成本）；spacing/distance 更新 = `sceneBoxes` 位置變動 → 200ms debounce 後呼叫 `buildSceneBVH()`。
4. **InitCommon.js 納入 R4-1 範圍**：`gui = new GUI()` 在 `InitCommon.js:439`，非 `Home_Studio.js`。R4-1 必須同步改造此檔案。
5. **DOM adapter 取代 lil-gui API**：`applyPanelConfig()` 內 `.setValue()` / `.disable()` / `.updateDisplay()` 等 lil-gui 方法改為自製 adapter 函式。

---

## R4-1 UI 骨架復刻 ✅

### 目標

依 R4-0 盤點結果，搬舊專案自製 HTML panel 骨架（3 個 panel-group：⚙️光追設定 / 🔲材質設定 / 💡燈光設定）+ CSS + `createS` 工廠 + DOM adapter 進本專案；**丟棄 lil-gui 整包**。骨架空殼化（所有 slider onChange 暫接 `wakeRender()` 空殼，真正接線留 R4-3 / R4-4）。

### 交付物

`Home_Studio.html`、`css/default.css`、`js/Home_Studio.js`、`js/InitCommon.js`、刪除 `js/lil-gui.module.min.js`

### 不搬（依 R4-0 決策）

- `#cavity-panel` 整區（`#btnSideCavity` / `#btnNorthCavity` + `updateCavity` 邏輯）
- `#post-panel` 整區（edge-sigma placeholder + bloom 2 slider + 6 條 post control）
- `createPostControl` 工廠、`postState` 物件、`postSyncers` / `syncPostUI`、`renderPost()` 相關觸發

### 步驟

1. **`css/default.css`**：從舊專案 `<style>` 抽取所有 panel / button / slider / gik CSS class（約 130 行），附加於現有 base 樣式尾端
2. **`Home_Studio.html`**：
   - 移除 `<style>` 中 lil-gui 巢狀縮排覆寫 4 行（L10-14）
   - 移除 `<script type="module">` 中 `import GUI ...` + `window.GUI = GUI`
   - 新增 `<div id="ui-container">` 含 3 個 panel-group（HTML 結構照搬舊專案，扣除 post + cavity）
   - 新增右上角視角按鈕群組 `#top-right-group`
   - 新增右下角 help + hide 按鈕群組 `#bottom-right-group`
   - 新增左下角 info-panel（FPS + sample counter）
   - 新增 snapshot-bar + snapshot-preview + snapshot-actions
   - 新增 loading-screen（SVG 圓環進度）
3. **`js/Home_Studio.js`**：
   - 搬入 `createS(id, label, min, max, step, init, cb, reset=true)` 工廠（舊專案 L2083-2089，7 行；內建 meta+click reset）
   - 搬入 panel-header toggle 折疊邏輯
   - 重構 `setupGUI()` → `initUI()`：所有 `gui.add()` / `gui.addFolder()` / `attachMetaClickReset()` 移除，改用 `createS` 空殼呼叫
   - 移除 `gui.domElement.addEventListener('click', ...)` 防冒泡 → 改綁 `#ui-container`
   - 新增 DOM adapter 函式（取代 lil-gui API）：
     - `setSliderValue(sliderId, value)` — 設定 createS slider 的 range + number input 值
     - `getSliderValue(sliderId)` — 讀取 slider 當前值
     - `setSliderEnabled(sliderId, enabled)` — toggle pointer-events + opacity
     - `setSliderLabel(sliderId, label)` — 更新 `.label-text` 內容
     - `setCheckboxChecked(checkboxId, checked)` — 同步 checkbox 狀態
   - `applyPanelConfig()` 內所有 `brightnessCtrl.setValue/disable/enable/name` → 改呼叫 adapter
   - `trackLightCtrl.updateDisplay()` → `setCheckboxChecked('chkTrack', ...)`（同理 wide / cloud）
4. **`js/InitCommon.js`**：
   - 移除 L439 `gui = new GUI()` 及 L441-442 style 設定
   - `pixel_Resolution` slider：移至 HTML panel（⚙️光追設定頂端），改用 `createS`
   - L462-472 pointer-lock guard（`gui.domElement.addEventListener mouseenter/mouseleave`）→ 改綁 `#ui-container`
   - L682 `pixel_ResolutionController.setValue(pixelRatio)` → `setSliderValue('slider-pixel-res', pixelRatio)`
   - L931 `pixel_ResolutionController.getValue()` → `getSliderValue('slider-pixel-res')`
   - L446-458 `_attachMetaClickReset` 使用 lil-gui `.domElement` + `.setValue()` → 改用 `createS` 內建的 meta+click reset（無需額外處理）
   - Mobile `Orthographic_Camera` toggle → HTML checkbox in ray-panel
5. **刪除 `js/lil-gui.module.min.js`**

### 驗收

- 頁面載入無 console error
- 3 個 panel（⚙️光追設定 / 🔲材質設定 / 💡燈光設定）可折疊展開
- pixel_Resolution slider 可拖曳並影響渲染解析度
- CONFIG 1/2/3 切換正常（`applyPanelConfig` DOM adapter 運作）
- Cam 1 下 64 spp 渲染正常、無視覺異常

---

## R4-2 鷹架移除 ✅

### 目標

刪除 R3-6 MIS checkbox + R3-6.5 動態池 checkbox + Active N 顯示；shader 分支扁平化 + 死碼清理。

### 交付物

`js/Home_Studio.js`、`shaders/Home_Studio_Fragment.glsl`

### 移除清單（12 處 shader 分支 + 函式 + 3 uniform）

**GLSL `uR3DynamicPoolEnabled` — 12 處**：
- 10 dispatch if/else：L1396, L1438, L1490, L1546, L1658, L1701, L1766, L1815, L1928, L1986 → 保留 true-branch（`sampleStochasticLightDynamic`），刪除 else-branch（`sampleStochasticLight11` 呼叫）
- 2 inline ternary：L1176, L1882 → `uR3DynamicPoolEnabled > 0.5 ? 1.0/float(uActiveLightCount) : 1.0/11.0` → 簡化為 `1.0 / float(uActiveLightCount)`

**GLSL `uR3MisEnabled` — 5 處**：
- L1158, L1168, L1297, L1854, L1868 → 條件中移除 `uR3MisEnabled > 0.5 &&`（保留其餘條件）

**死碼**：
- `sampleStochasticLight11` 函式（L261-378，約 120 行）→ 扁平化後無呼叫者，整段刪除
- L2027 DCE sentinel `accumCol += vec3(uR3MisEnabled + uR3MisPickMode)` → 刪除

**uniform 移除**：
- GLSL：`uniform float uR3MisEnabled` / `uR3MisPickMode` / `uR3DynamicPoolEnabled` 三行宣告
- JS：對應 `pathTracingUniforms.uR3MisEnabled` / `.uR3MisPickMode` / `.uR3DynamicPoolEnabled` 三處 uniform 註冊
- JS：`computeLightEmissions()` 內 throw-first guard（檢查 uR3MisEnabled / uR3MisPickMode 是否存在）→ 刪除

### 步驟（每步驗 shader 編譯）

1. JS 端：移除 MIS checkbox + 動態池 checkbox + Active N 顯示 + `uR3MisPickMode` uniform → **瀏覽器驗 shader 編譯**
2. GLSL Phase A：分 3 批扁平化 12 處 `uR3DynamicPoolEnabled`（每批 4 處 → **驗編譯**）
3. GLSL Phase A'：刪除 `sampleStochasticLight11` 整段 → **驗編譯**
4. GLSL Phase B：扁平化 5 處 `uR3MisEnabled` + 刪除 DCE sentinel → **驗編譯**
5. GLSL Phase C：移除 3 uniform 宣告 + JS uniform 註冊 + throw-first guard → **驗編譯**

### 驗收

- CONFIG 1/2/3 × Cam 1，64 spp 渲染正常
- Console 零 error、零 warning

---

## R4-3 控件接線 ✅

### 目標

將保留的 R3 控件按舊專案風格整合進 HTML 面板，全部接線到現有 JS / shader uniform。

### 交付物

`Home_Studio.html`（div 結構微調）、`js/Home_Studio.js`

### 控件清單

1. **CONFIG 1/2/3 radio**：🔧配置區塊，3 個 `.config-radio` → `applyPanelConfig(n)`
   - **配色連動邏輯**：
     - **C1**：3 片吸音板（東西北各一）。預設全灰，可切換全灰/全白。
     - **C2**：9 片吸音板。北牆（3片）預設全灰，可選全灰/全白。東西牆（6片）預設全白，可選全白/全灰/全紅。
     - **C3**：9 片吸音板 + 6 片 Cloud。牆面吸音板同 C2。Cloud（6片）必須全同色，預設全白，可選全白/全灰/全紅。
2. **A/B 趨近真實/快速預覽 radio**：⚙️光追設定，2 個 `.action-btn` → 切換 `activeGroup`，覆寫 bounces/clamp/mult 預設值（邏輯從舊專案 L2097-2109 搬入）
3. **色溫 radio button 群組**：
   - Cloud：3 button（暖 3000K / 自然 4000K / 白光 6500K）→ `glow-orange` / `glow-white` / `glow-blue`
   - Track：4 button（全暖 / 全冷 / 北暖南冷 / 北冷南暖）→ 含 `glow-gradient-ob` 漸層
   - Wide South / North：各 3 button
   - Track / Wide 外觀色：各 2 button（黑 / 白）
4. **Lumens slider**：Cloud（0~4000, step 1, init 800）/ Track（0~3000, step 50, init 500）/ Wide（0~4000, step 50, init 2500）
5. **其他 slider**：牆面反射率（0.1~1.0）/ 彈跳次數（1~8）/ 間接光補償（A/B 各一，0.1~5.0）
6. **Light enable checkbox**：Cloud / Track / Wide South / Wide North → 各自 uniform + `rebuildActiveLightLUT`
7. **GIK 色控**：2 preset button + 13 block minimap（懸浮選色面板）→ `gikColors[]` → `cameraIsMoving=true`

### 驗收

- 每組控件接線後即時測試：slider 拖曳可見渲染效果、radio 切換可見色溫 / 配置變化
- CONFIG 1/2/3 切換：燈具顯示/隱藏正確、checkbox 連動同步

---

## R4-4 甜蜜點 UI ⬜

### 目標

跨 HTML slider → JS 變數 → shader uniform 三層復刻舊專案 sweet-spot slider。採光度量測模型（收窄 beam = 中心更亮）。

### 交付物

`js/Home_Studio.js`（HTML slider div 已在 R4-1 存在）

### Slider 完整清單

#### Track 投射燈（5 條，lumens 已在 R4-3 接線）

| id | label | 範圍 | step | 預設 | state 變數 |
|---|---|---|---|---|---|
| `slider-track-beam-inner` | 光束角(內) | 1 ~ 90 | 1 | 30 | `trackBeamInner` |
| `slider-track-beam-outer` | 光束角(外) | 15 ~ 90 | 1 | 55 | `trackBeamOuter` |
| `slider-track-tilt` | 傾斜角 | 0 ~ 90 | 1 | 45 | `trackTilt` |
| `slider-track-space` | 間距 (cm) | 0 ~ 180 | 1 | 150 | `trackSpacing` |
| `slider-track-x` | 距Cloud邊距 | 0.05 ~ 0.90 | 0.01 | 0.05 | `trackBaseX = 0.90 + v` |

#### Wide 廣角燈（5 條，lumens 已在 R4-3 接線）

| id | label | 範圍 | step | 預設 | state 變數 |
|---|---|---|---|---|---|
| `slider-track-wide-beam-inner` | 廣角束角(內) | 10 ~ 160 | 1 | 95 | `trackWideBeamInner` |
| `slider-track-wide-beam-outer` | 廣角束角(外) | 60 ~ 160 | 1 | 120 | `trackWideBeamOuter` |
| `slider-track-wide-tilt-south` | 南側傾斜角 | -70 ~ 70 | 1 | 15 | `trackWideTiltSouth` |
| `slider-track-wide-tilt-north` | 北側傾斜角 | -70 ~ 70 | 1 | -25 | `trackWideTiltNorth` |
| `slider-track-wide-z` | 距Cloud邊距 | 0.10 ~ 1.30 | 0.01 | 0.10 | `trackWideZ = 1.20 + v` |

### 新增函式

- **`recomputeTrackGeometry()`**（uniform-only，低成本）：
  - 從 `trackBeamInner/Outer` 重新計算 `cos(halfAngle)` → 寫入 `uTrackBeamCos[0..3]`
  - 從 `trackTilt` 重新計算燈頭方向 → 寫入 `uTrackLampDir[0..3]`
  - 同理 `recomputeWideTrackGeometry()` → `uTrackWideBeamCos[0..1]`
- **`recomputeTrackPositions()`**（geometry + BVH rebuild，高成本）：
  - 從 `trackSpacing` / `trackBaseX` 重新計算燈頭位置 → 寫入 `uTrackLampPos[0..3]`
  - 更新 `sceneBoxes` 中軌道支架位置（min/max 座標）
  - 呼叫 `buildSceneBVH()`（**200ms debounce**，trailing edge）
  - 同理 `recomputeWideTrackPositions()` → `uTrackWideLampPos[0..1]` + 廣角支架 sceneBoxes

### 光度量測模型

`computeTrackRadiance(lm, T_K, A_m2, beamFullDeg)` 啟用 `beamFullDeg` 參數：
```
halfAngleRad = beamFullDeg / 2 * π / 180
candela = lm / (2π * (1 − cos(halfAngleRad)))
radiance = candela / A_m2
```
效果：收窄 beam → candela 上升 → 中心更亮（對齊舊專案 `lumenToCandela` 行為）。

### beam inner/outer 互鎖

- inner onChange → `Math.min(v, trackBeamOuter)`
- outer onChange → `Math.max(v, trackBeamInner)`
（同樣適用 wide beam）

### onChange 呼叫鏈

每條 slider callback → 更新 JS 變數 → `recomputeTrackGeometry()` 或 `recomputeTrackPositions()`（依類型）→ `computeLightEmissions()` → `wakeRender()`

### 驗收

- CONFIG 3 下拖動每條 slider → 光斑位置、角度、大小、亮度即時變化
- beam 互鎖正確：inner 不超過 outer、outer 不低於 inner

---

## R4-5 互動打磨 ⬜

### 目標

固定控件、視覺收尾、使用者直接驗收。

### 交付物

`Home_Studio.html`、`js/Home_Studio.js`

### 項目

1. **Panel 折疊預設**：所有 panel 預設 `collapsed`（使用者展開感興趣項目）
2. **Cam 1/2/3 按鈕**：`#btnCam1/2/3` → `switchCamera()` 切預設視角
3. **X-ray toggle**：checkbox → `uXrayEnabled`
4. **Hide UI**：`#hide-btn` → toggle 所有 UI 群組顯示
5. **Help hover**：`#help-wrapper:hover #instructions` pure CSS 展開
6. **FPS + sample counter**：`#info-panel` 搬入，bind `requestAnimationFrame` 更新
7. **Snapshot**：milestone 自動截圖 + bar 縮圖 + 打包下載
8. **Loading screen**：SVG 圓環進度（shader compile → 0~100%）

### 驗收

- 使用者直接操作每個固定控件確認反應正確
- 可折疊、可隱藏、可截圖、loading 正常

---

## 驗收紀律

- R4 無 spp 比對驗收（UI 層）；由使用者直接操作每一控件確認反應正確。
- 關鍵行為錯誤（如色溫 radio 不切換、lumens slider 無效）當場修掉，不累到後段。
- R4-2 shader 修改例外：CONFIG 1/2/3 × Cam 1，64 spp 確認渲染無異常。
