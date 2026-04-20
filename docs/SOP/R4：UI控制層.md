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
| R4-0 | 舊專案 UI 盤點 + 新 R3 控件整合策略 | ⬜ |
| R4-1 | UI 骨架復刻（HTML panel-group + CSS + createS 工廠，對齊舊專案自製 UI；丟棄主專案 lil-gui） | ⬜ |
| R4-2 | 鷹架移除（R3-6 MIS checkbox + R3-6.5 動態池 checkbox / N 顯示 hardcode 為 1.0） | ⬜ |
| R4-3 | 保留 R3 控件併入舊版面（CONFIG 1/2/3、色溫 radio、lumens sliders、吸音板色） | ⬜ |
| R4-4 | R3-5a 甜蜜點 UI 復刻（4 sliders：燈傾角 / beam 角 / 軌到 GIK 距離 / 同側燈距） | ⬜ |
| R4-5 | 互動打磨（reset、listen-bound、hotkeys 視需） | ⬜ |

---

## R4-0 舊專案 UI 盤點 + 整合策略 ⬜

**來源檔**：`/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D_OLD/Path Tracking 260412a 5.4 Clarity.html`（2272 行、單檔自包含；CSS 與 JS 全 inline；唯一外部 JS 為 `sylvester.min.js` CDN）。

### 🚨 關鍵技術落差（先看，否則 R4-1 會搞錯方向）

- **舊專案 UI 不用 lil-gui**。它是自製 HTML panel + inline CSS + inline JS，以 `createS(divId, label, min, max, step, init, onChange)` 做 slider、以 `.action-btn` + `.glow-*` CSS class 做色溫 / A/B radio、以 `panel-header + panel-content.collapsed` 做可折疊 group。
- `.omc/HANDOVER-R4.md` Step 2/R4-1 中「lil-gui folder 復刻」字樣屬交接當下推測；本 R4-0 盤點後應改為「自製 HTML panel 骨架復刻」，於 R4-1 修正。
- 主專案目前之 lil-gui 版本需整包丟棄，改搬舊專案 HTML body + CSS + createS / createPostControl 工廠函式。

### 舊專案 UI 結構盤點

#### 主控制面板（`#ui-container`，左側折疊柱）

容器根：`<div id="app-container">` → `<div id="ui-container">` → 五個 `panel-group > panel-header + panel-content.collapsed` 區塊。

| 區塊 | header id / icon / 中文 | 控件清單（id） | label / 型態 | 範圍 / step / 初值 | state 變數 | onChange 副作用 |
|---|---|---|---|---|---|---|
| 光追設定 | `#ray-header` ⚙️ | `#btnGroupA` / `#btnGroupB` | 趨近真實 / 快速預覽（`action-btn` radio） | A/B 切換 | `activeGroup` | 切換 `group-a-controls` / `group-b-controls` 顯示 + `postState` 同步 |
| 光追設定 | 同上 | `#slider-bounces` | 彈跳次數 | 1 ~ 8 / 1 / A=8, B=4 | `maxBounces` | A/B 預設值切換時一併覆寫 |
| 光追設定（A） | 同上 | `#slider-clamp-a` | 亮截斷上限 | 1 ~ 50000 / 1 / 2000 | `fireflyClampA` | — |
| 光追設定（A） | 同上 | `#slider-mult-a` | 間接光倍率 | 0.1 ~ 5.0 / 0.1 / 1.0 | `indirectMultA` | — |
| 光追設定（B） | 同上 | `#slider-clamp-b` | 亮截斷上限 | 1 ~ 5000 / 1 / 500 | `fireflyClampB` | — |
| 光追設定（B） | 同上 | `#slider-mult-b` | 間接光倍率 | 0.1 ~ 5.0 / 0.1 / 2.0 | `indirectMultB` | — |
| 影像後製 | `#post-header` 📷 | `#slider-edge-sigma`（placeholder，未 wire up） | — | — | — | 檔案殘留 div，無 createS binding |
| 影像後製 | 同上 | `#slider-bloom-intensity` | Bloom 強度 | 0.0 ~ 2.0 / 0.01 / 0.15 | `bloomIntensity` | `if (sampleCount>=1500) renderPost()` |
| 影像後製 | 同上 | `#slider-bloom-radius` | Bloom 半徑 | 1.0 ~ 20.0 / 0.5 / 2.0 | `bloomRadius` | 同上 |
| 影像後製 | 同上 | 6 條 `createPostControl` sliders | 曝光(EV) / 高光 / 陰影 / 對比 / 飽和度 / Gamma（每條附獨立 checkbox 切開關） | 見 HTML L2258 | `postState[activeGroup]` | 即時 `renderPost()` |
| 空腔設定 | `#cavity-header` 🧱 | `#btnSideCavity` / `#btnNorthCavity` | 側牆 / 北牆（toggle） | on/off | `sS` / `sN` | `updateCavity('side'/'north', bool)` |
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
| 間接光補償（R3-7 更名「框架限制」） | lil-gui slider 已更名 | `slider-mult-a` / `slider-mult-b`（A/B 兩套） | **R4-3 整合**，沿用 A/B `postState` 機制或簡化為單 slider（視 R4-3 decision） |
| `uLegacyGain = 1.5`（R3-0 遺留 uniform） | 目前主專案 shader 有 uniform、lil-gui 無 slider | 無對應 | **R4 不動**，維持 uniform 但不暴露給 UI（R3-7 已定性為永久補償） |

### 保留為美學預覽的區塊

- `#cavity-panel`（空腔設定）：R2 階段幾何 toggle，R4 保留
- `#post-panel`（影像後製）：6 條 post control + bloom，R4 保留
- 吸音板色控：保留

### R4-1 ~ R4-5 影響

- **R4-1**（骨架復刻）：複製舊 HTML `<div id="ui-container">` 整區塊 + `.panel-header` / `.panel-content.collapsed` 折疊機制 + CSS 抽到 `css/default.css` + `createS` / `createPostControl` 工廠搬進 `js/Home_Studio.js`。
- **R4-2**（鷹架移除）：先行拆掉目前 lil-gui 實體 + 兩個舊 checkbox（R3-6 / R3-6.5），確保 R4-1 之後 shader gate uniform 的預設值 `1.0` 生效。
- **R4-3**（保留控件整合）：針對新 R3 控件按本表策略逐一接線。
- **R4-4**（甜蜜點 UI）：4 slider 跨層接線（HTML + JS + shader uniform）。
- **R4-5**（互動打磨）：折疊預設值、`cameraIsMoving=true` 觸發、⌘/Ctrl+Click slider 還原預設、Cam1/2/3 按鈕還原視角、help / hide / snapshot milestone bar 是否保留由使用者驗收時決。

## R4-1 UI 骨架復刻 ⬜

- 目標：依 R4-0 盤點結果，搬舊專案自製 HTML panel 骨架（`<div id="ui-container">` 五個 `panel-group`）+ CSS（抽到 `css/default.css`）+ `createS` / `createPostControl` 工廠函式進本專案；**丟棄目前主專案的 lil-gui 實作**。骨架空殼化（控件存在但 onChange 暫不接新 R3 uniform，接線留給 R4-3 / R4-4）。

## R4-2 鷹架移除 ⬜

- 目標：拆除 R3-6 MIS 啟用 checkbox 與 R3-6.5 動態池 checkbox / N 顯示；shader 端 `uR3MisEnabled = 1.0` 與 `uR3DynamicPoolEnabled = 1.0` 寫死，移除死分支 else-branch。

## R4-3 保留 R3 控件併入舊版面 ⬜

- 目標：將保留的 R3 控件按舊專案風格整合進舊版面——CONFIG 1/2/3 切換、色溫 **radio buttons**（對齊舊觀感）、lumens sliders（Cloud / Track / Wide）、吸音板顏色控制。

## R4-4 R3-5a 甜蜜點 UI 復刻 ⬜

- 目標：跨 shader 幾何 + JS uniform + GUI 三層復刻舊專案 4 條 sweet-spot slider：燈傾角、beam 角、軌道到 GIK 距離、同側燈距。

## R4-5 互動打磨 ⬜

- 目標：reset 按鈕、listen-bound values、必要的 hotkeys。

---

## 驗收紀律

- R4 無 spp 比對驗收（UI 層）；由使用者直接操作每一控件確認反應正確。
- 關鍵行為錯誤（如色溫 radio 不切換、lumens slider 無效）當場修掉，不累到後段。
