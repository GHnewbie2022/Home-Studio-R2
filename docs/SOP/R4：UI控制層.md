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
| R4-3 | 控件接線（CONFIG 1/2/3、A/B 單選按鈕、色溫 radio、lumens slider、GIK 色控、light checkbox） | ✅ |
| R4-3-追加 | 解除漫射反射上限實驗（拆 erichlof 2-bounce 截斷 + 補償魔數歸一） | ✅ |
| R4-4 | 甜蜜點 UI（Track 5 + Wide 5 slider；光度量測模型；BVH 兩層更新策略） | ✅ |
| R4-5 | 互動打磨（折疊預設、Cam 按鈕、Help、Hide、FPS/sample、snapshot、loading） | ✅ |

---

## 演算法基準（2026-04-24 R4-3-追加 之後，R4-4+ 必讀）

R4-3-追加（commit `0594f00`）後，渲染管線演算法基準與 R3 時代完全不同，後續 R4-4 / R4-5 所有滑桿預設值、光度計算、光強度調整皆以此基準為準。

### Shader 行為變更

| 項目 | R3 時代 | R4-3-追加 之後 |
|---|---|---|
| 漫射反彈層數 | 2 層截斷（`diffuseCount == 1` gate 鎖死） | 1~14 可調（`float(diffuseCount) < uMaxBounces`） |
| MIS BSDF cache | 鎖第 1 次漫射命中 | 每層漫射命中都更新 |
| swap handler diffuseCount | `= 1`（強制 reset） | `++`（累計） |
| ceiling NEE accumCol | `= ...`（覆寫，潛伏 bug） | `+= ...`（正確累加，L1021/1029/1033） |
| `uIndirectMultiplier` | 1.7（補償 2-bounce 截斷） | 1.0（歸一） |
| `uLegacyGain` | 1.5（補償 NEE throughput） | 1.0（歸一） |

### UI 預設值基準

| 模式 | bounces | 補償 mult | 牆面反射率 |
|---|---|---|---|
| A 趨近真實（載入預設） | 14 | 1.0 | 0.85 |
| B 快速預覽 | 4 | 2.5 | 1.0 |

### 對 R4-4 / R4-5 的影響

1. **光度量測模型（R4-4）**：所有 lumens → candela / radiance 換算以 `uIndirectMultiplier = 1.0 / uLegacyGain = 1.0` 為基準。任何新增滑桿的預設值必須在此基準下肉眼校準，不得假設歷史 1.7 / 1.5 魔數仍存在。
2. **甜蜜點滑桿預設（R4-4）**：Track / Wide 滑桿預設值調校時，需在 A 模式（14 bounces + 0.85 反射率）下驗收，因為這是使用者主要使用情境。
3. **新加光源的 NEE 分支**：若後續增加新 emitter type 的 NEE 命中處理，**務必用 `accumCol += ...`** 不用 `accumCol = ...`（TRACK_LIGHT / CLOUD_LIGHT 是正確範例，ceiling 是 R3 以來的 outlier 已修復）。
4. **Path tracing 陰影銳利度**：近貼光源（幾公分）的遮擋物陰影邊界會極窄，視覺上可能感覺「沒陰影」，這是物理正確行為，非 bug（R4-3-追加 debug 驗證：Cloud E/W rod ↔ Track 5.8cm 與 Cloud S/N rod ↔ Wide 41cm 的陰影落差為距離差異）。

### 歷史參照

- 未歸一的 R3 時代補償魔數原委：`docs/SOP/Debug_Log.md` 「Phase 2 漫射能量 2-bounce truncation 說明（R3-7 寫入）」章節 + 該章末尾「2026-04-24 追記」
- R4-3-追加 實驗詳細經過：本檔「R4-3-追加 解除漫射反射上限實驗 ✅」小節
- Commit diff：`git show 0594f00`

---

## R4-0 舊專案 UI 盤點 + 整合策略 ✅

**來源檔**：`/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D_OLD/Path Tracking 260412a 5.4 Clarity.html`（2272 行、單檔自包含；CSS 與 JS 全 inline；唯一外部 JS 為 `sylvester.min.js` CDN）。

### 🚨 關鍵技術落差（先看，否則 R4-1 會搞錯方向）

- **舊專案 UI 不用 lil-gui**。它是自製 HTML panel + inline CSS + inline JS，以 `createS(divId, label, min, max, step, init, onChange)` 做 slider、以 `.action-btn` + `.glow-*` CSS class 做色溫 / A/B 單選按鈕、以 `panel-header + panel-content.collapsed` 做可折疊 group。
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

**2026-04-24 R4-4 Plan v5 決策紀錄補註修訂**：上述第 2 條「光度量測模型」部分被 R4-4 Plan v5 覆蓋 — 保留光束角影響中心亮度目標，但以**商品規格書反冪律擬合**（`cd = 41696 × θ^(−0.7925) × lm/2000`）取代純立體角公式 `cd = lm / (2π(1 − cos(halfAngle)))`。觸發 commit：R4-3-追加 `0594f00`（量綱歸一後，純立體角推出 37,209 cd vs 廠商商品實測 4,800 cd @ 15°，脫鉤 8 倍，採購決策視覺評估失準）。主文不動（R3-7 魔數註解手法），詳細決策紀錄見下方「## R4-4 甜蜜點 UI」章節。

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

## R4-3-追加 解除漫射反射上限實驗 ✅

> Ralplan 共識：2026-04-24 兩輪 Planner+Architect+Critic 迭代 APPROVE。本節為修訂版，替代原初版。

### 背景與動機

- R3-7 已文件化：`uIndirectMultiplier = 1.7` + `uLegacyGain = 1.5` 為 erichlof 框架「漫射間接反射第 2 次命中就停」截斷之補償魔數，定性為近似版物理模型之永久補償。
- 本實驗驗證：拆掉該截斷 + 補償歸一後，視覺是否更接近真實物理，供使用者評估錄音室燈光採購時能看到更真實之參考。
- 本實驗為 R4 階段之分支探索；**R3 git 歷史與 R3 文件絕不動**（R3 就是兩次反射近似的物理模型紀錄，即使實驗通過亦不回頭改寫 R3 定性）。

### 範圍限定（使用者採購決策場景務必先讀）

本實驗的架構本質是「erichlof 框架的 swap 迴圈上限解除」，**不是教科書定義的純 N 層全域照明**。意即「更真實感」來自多次 swap + single-stored indirect ray 的累積效果，而非逐層 Lambertian bounce 的物理積分。採購決策時須意識此限制。

### 分支策略

- 主分支：`r3-light` 保持不動（R4-4 隨時可回）
- 實驗分支：`experiment/r4-uncap-test` 從 `r3-light` 開
- 通過 → 合回 `r3-light`、本節補完工紀錄、R4-4 依新基準進
- 失敗 → 分支丟棄、`Debug_Log.md` 留案、R4-4 照現況進
- **已評估拒絕 shader fork 路線**：fork 屬分支維度非 commit 維度，維護雙份 shader 成本過高；side-by-side 視覺需求由「實驗分支內場景參考 patch」替代（見驗收客觀錨點段）。

### 交付物

`shaders/Home_Studio_Fragment.glsl`、`js/InitCommon.js`（uniform 初值）、`js/Home_Studio.js`（如需配套 + 中央桌 patch geometry）

### 改動清單（同一個 commit，不得拆步）

**五改動為強耦合原子單元**。拆 commit 會產生不可編譯中間態或視覺爆錯；commit message 鎖「五改動 + PASS-8 N=2 誤差 <3% 基線」。

1. **shader gate 放寬**：10 處 `if (diffuseCount == 1)` 改為跟隨 `uMaxBounces`
   - 精確行號：L1254 / L1292 / L1341 / L1392 / L1500 / L1539 / L1600 / L1645 / L1754 / L1807
   - 現有 `slider-bounces` 1~14 UI 控制，使用者拉動即時看效果
2. **`uIndirectMultiplier` 歸一**：1.7 → 1.0
   - 作用點：6 處 SPEC→DIFF swap（L978 / L1051 / L1093 / L1131 / L1176 / L1724）
   - 實際只乘 1 次 stored indirect ray（Architect R2 確認），非 N 次疊乘
3. **`uLegacyGain` 歸一**：1.5 → 1.0
   - 作用點：10 處 NEE dispatch `mask *= weight * uLegacyGain`（L1265 / L1303 / L1351 / L1403 / L1511 / L1550 / L1611 / L1656 / L1765 / L1818）
   - 作用於 NEE throughput，與 bounce 深度無直接關係
4. **reset 改寫**（Ralplan 迭代 2 補，原漏列）：7 處 `diffuseCount = 1` → `diffuseCount++`
   - 精確行號：L986 / L1059 / L1101 / L1139 / L1183 / L1203 / L1731
   - 理由：若只解除截斷但計數器仍強制重設為 1，實驗等於沒做（對應 Pre-mortem S4 結構性無效）
5. **MIS cache 單層策略保留**（commit 設計鎖定）：`if (diffuseCount == 1)` 分支寫入 `misBsdfBounceNl / misBsdfBounceOrigin / misPBsdfStashed` 不動
   - 理由：Veach 1997 MIS 基線，commit 階段不擴展為 N 層完整方案
   - 檢核：以 PASS-8 N=2 vs N=1 差 <3% 作客觀驗證
   - 若 PASS-8 fail：升級完整方案為另次 commit 處理

**五者缺一即壞視覺**：
- 缺 1：截斷仍在，無法驗證
- 缺 2：`uIndirectMultiplier` 偏多 stored indirect ray → 過曝
- 缺 3：`uLegacyGain` NEE throughput 偏高 → 整體過亮
- 缺 4：`diffuseCount` reset 停在 1 → 結構性無效（S4）
- 缺 5：MIS 策略擴展引入 pdf 重加權 → Veach 1997 基線失守 → N=2 誤差可能超 3%

### Pre-mortem 四情境

**S1 間接光過曝**
- 觸發：`uIndirectMultiplier` = 1.0 + N=3 + Cloud 800 lumens，Cloud 實驗分支比 `r3-light` 亮 40%+
- 緩解：配合場景參考 patch 量測定值（見驗收客觀錨點）

**S2 量綱失配**
- 觸發：解除 gate 後 `uLegacyGain` 仍保 1.5
- 症狀：亮度與 lumens 解耦，色溫失效
- 緩解：合回前 `uLegacyGain` 必歸 1.0（Architect C5 反向修訂）

**S3 效能塌陷**
- 觸發：N=3 + 複雜 BVH + 1080p viewport
- 依據：`r3-light` N=1 實測 4800~5200 spp @ 1080p（Cam 2 / 自然 4000K / CONFIG 1）
  - N=2 推估成本 +30~50% → 2500~3500 spp
  - N=3 推估 2000~2800 spp
- 保守區間：2000~5000 spp；下限觸發退回 N=2

**S4 結構性無效**（Ralplan 迭代 2 新增核心顧慮）
- 本質：erichlof swap 解除 ≠ 真 N 層累積
- 觸發：只改 gate 沒改 reset，`diffuseCount` 停在 1
- 症狀：N=1/2/3 輸出肉眼無差異，實驗結論失效
- 緩解鏈：
  - (a) 改動 4（reset 7 處 `++`）不可省，commit 原子性
  - (b) PASS-8 場景參考 patch N=2 vs N=1 差 >3% 作結構有效證據
  - (c) 實測失敗（<3%）即判本次實驗結構性無效，回滾 commit

### 進分支後查證（低優先，僅失敗時處置）

**主迴圈 NEE / bounce 換軌節奏**
- erichlof「NEE shadow ray ↔ 漫射 bounce ray」交替跑，原設計僅容 1 層間接
- 若 `diffuseCount >= 2` 時 `willNeedDiffuseBounceRay` swap 失靈 → 畫面黑塊 / 某方向完全無光
- 處置：調整 swap 時機或 `willNeedDiffuseBounceRay` reset 條件
- 備註：若 PASS-8 fail 可能指向此問題，升級 MIS 完整方案前先排除 swap 時序

### 驗收方式

**主觀判讀**（照 R4 SOP「使用者直接操作 UX」原則）：
- 使用者自由操作 `slider-bounces`（1~14）逐格拉動
- 切換 Cam 1 / Cam 2 / Cam 3 + CONFIG 1 / 2 / 3
- 房間走動、切色溫、開關燈、觀察間接反射分佈
- **無 A/B 截圖對比**

**客觀錨點**（Ralplan 迭代 2 新增，對抗 S4）：
- 實驗分支**中央工作桌桌面正中央**新增 **15~20 cm 見方** 50% 灰 Lambertian 參考 patch
- 法線 +Y 朝天花板，對應 Cloud / Track 主要入射角
- 生命週期：實驗分支永久存在（commit 進 `experiment/r4-uncap-test`），分支丟棄即消失
- patch 不改 `r3-light` geometry 主體
- 用途：使用者拉滑桿時讀 patch RGB 值作客觀判讀基礎，類比音訊工程用 1kHz 測試信號校對系統

### 通過 / 失敗判準

**通過條件**（全部滿足）：
- **PASS-1**  shader compile 無 error（browser console 驗）
- **PASS-2**  N=1 實驗分支輸出 ≈ `r3-light` HEAD 輸出（patch 輻射亮度差 <1%，回歸驗證）
- **PASS-3**  N=2 vs N=1 patch 輻射亮度差在 **3%~15%** 區間（有累積 + 未過曝）
- **PASS-4**  N=3 vs N=2 patch 輻射亮度差 <8%（收斂跡象，避免發散）
- **PASS-5**  `uLegacyGain` = 1.0 時色溫 2700 / 4000 / 6500K 色比漂移 <2%
- **PASS-6**  spp 不低於 2000 @ 1080p（Cam 2 基準）
- **PASS-7**  Cloud / Track / Wide 獨立開關無誤（GUI 對稱）
- **PASS-8**  加強選項（Architect inline 條件）：
  - 基準：CONFIG 1 / Cam 2 / 自然 4000K / Cloud 800 lumens
  - N=2 vs N=1 patch 差 **>3%** 且 **<20%**（結構有效下限 + 非爆錯上限）
  - 量測 spp **≥ 512**（雜訊壓得下 3% 訊號）
  - 與 `r3-light` HEAD 同 patch 比對，差值落在 0%~15% 物理預估區間
- **RECORD-1**  合回 `r3-light` 前必要條件：
  - 基準條件下量測 Cloud / Track / Wide 三組等效亮度偏移量（N=1/2/3 × 3 光源 = 9 筆值）
  - 寫入 R4-4 預設值調整表（`.omc/R4-4-baseline.md` 或 `Debug_Log.md`）

**失敗條件**（任一觸發即回滾 commit）：
- **FAIL-1**  N=2 vs N=1 patch 差 <3%（結構性無效 S4）
- **FAIL-2**  N=3 發散（patch 差 >30%）
- **FAIL-3**  spp <2000（效能塌陷 S3）
- **FAIL-4**  `uLegacyGain` = 1.0 時色比漂移 >5%（量綱失配 S2）
- **FAIL-5**  shader compile error >3 次（Architect inline 條件，防無限試錯）
- **FAIL-6**  5000 spp 仍 noisy 到無法判讀
- **FAIL-7**  半日內無解

**通過後處置**：
- 合回 `r3-light`
- 合回時：`uLegacyGain` 與 `uIndirectMultiplier` 同歸 1.0（Architect C5 反向修訂）
- `R3-7` `Debug_Log.md` 條目加註解：「1.7 / 1.5 魔數定性僅描述歷史，`r3-light` HEAD shader 已進化為 N-bounce 可調」
- 本節補完工紀錄 + ✅ 雙標（階段總覽表 + 本小節 ### 標題）
- R4 工作手冊新增「演算法基準：解除反射上限」小節
- R4-4 甜蜜點滑桿預設值依 RECORD-1 重調
- R3 文件、R3 git 歷史、R3-7 魔數定性紀錄**絕不回頭改**（僅 `Debug_Log.md` 加註歷史說明）

**失敗後處置**：
- 分支丟棄
- `Debug_Log.md` 留案（失敗原因 + 驗證條件 + patch RGB 數值）
- `.omc/HANDOVER-R4.md` pending 段改寫為「已驗證不採用」
- R4-4 直接進

### Observability

每個驗收 checkpoint 在 `Debug_Log.md` 記錄：

```
[R4-3-exp][N=?][YYYY-MM-DD][Cam ?][color ?K][lumens ?][spp ?]
  patch(center 50%gray @ desk): R=0.??? G=0.??? B=0.???
```

指標監控：
- **sample-counter**：累加正常、單張 2000 spp 時間 basis 記錄
- **fps-counter**：N=14 時不低於 10 fps；<5 fps → shader 卡死徵兆
- **browser console**：零 GLSL error / warning / context lost
- **GPU frame time**：N=2 vs N=8 應接近線性 4×；8× 以上有 swap 機制 bug
- **GPU context lost 緊急處置**：降 N 到 8、reload，不強續跑（macOS Brave + Metal 已知風險）

### Ralplan 共識 ADR（2026-04-24 兩輪迭代 APPROVE）

- **Decision**：Option B 修訂版 — 五改動同 commit + 場景參考 patch 錨點 + branch 路線
- **Drivers**：
  - D1 結構性有效性（reset `++` 是實驗能否真正生效的關鍵）
  - D2 回滾成本低（單 commit + 分支 + 量化紀錄）
  - D3 R4-4 需要量化偏移量基準才能續做預設值調整
- **Alternatives Considered**：
  - Option A（僅三改動）→ 否決（結構性無效 S4 風險）
  - Option C（shader 全重構）→ 延後至 R5+
  - Option D（shader fork）→ 否決（fork 屬分支維度，已用 branch + 場景 patch 替代）
- **Why Chosen**：五改動同 commit 確保結構有效性 + 量綱一致性 + Veach 1997 MIS 基線三層保護同時到位，缺一即破
- **Consequences**：
  - 實驗分支可量化驗證 N 層漫射累積
  - `R3-7` `Debug_Log.md` 加註解（歷史補償描述）
  - `uLegacyGain` 成為後續 R4+ shader 層標準補償開關
  - `Debug_Log.md` 多一類紀錄格式
- **Follow-ups**：
  - F1 產出 Cloud / Track / Wide 等效亮度偏移量表（9 筆值）
  - F2 R4-4 預設值調整表引用 F1 數值
  - F3 實驗通過合回時 `uLegacyGain` / `uIndirectMultiplier` 同歸 1.0
  - F4 `R3-7` `Debug_Log.md` 條目加註解

### OMC 工具路徑

- 計畫階段：`/oh-my-claudecode:ralplan`（已完成 2 輪迭代 APPROVE）
- 執行階段：`/oh-my-claudecode:ultrawork`

### 執行檢查清單

- [ ] `git checkout r3-light && git checkout -b experiment/r4-uncap-test`
- [ ] shader 五改動（同一 commit，不得拆步）：
  - [ ] 改動 1：10 處 `if (diffuseCount == 1)` gate 放寬跟 `uMaxBounces`
  - [ ] 改動 2：`uIndirectMultiplier` 1.7 → 1.0
  - [ ] 改動 3：`uLegacyGain` 1.5 → 1.0
  - [ ] 改動 4：7 處 `diffuseCount = 1` → `diffuseCount++`
  - [ ] 改動 5：MIS cache 單層策略註解鎖定（實際不動 code，commit message 明記）
- [ ] 中央工作桌桌面中央新增 15~20 cm 見方 50% 灰 Lambertian patch（sceneBoxes + shader hitType 對應）
- [ ] cache-buster 更新：`shaders/Home_Studio_Fragment.glsl?v=uncap-test`
- [ ] shader 編譯通過 + 瀏覽器 console 零 error
- [ ] 使用者拉 `slider-bounces` / 切視角 / 切 CONFIG / 走房間肉眼審查
- [ ] PASS-8 客觀錨點量測：基準條件下 patch RGB 值記錄
- [ ] N=2 vs N=1 patch 差檢核：>3% 且 <20%（spp ≥ 512）
- [ ] RECORD-1 量化偏移量表產出（9 筆值）寫入 `Debug_Log.md`
- [ ] 判定通過 / 失敗 → 走對應分叉

### ultrawork 執行紀律

**嚴禁（任何情況，違者即停手並回報使用者）**：
- `git push` — 本地獨立實驗，不推遠端
- `git rebase` / `git commit --amend` — 不改歷史
- `git merge` 回 `r3-light` — 合回屬驗收後使用者授權動作，非實驗範圍
- `--force` 任何旗標
- `git reset --hard` — 自動化情境絕不執行；若需回退停手回報使用者
- `git branch -D` — 不自動刪分支
- 動 `r3-light` 分支任何檔案（僅操作 `experiment/r4-uncap-test`）
- 動 R3 相關文件：`docs/SOP/R3：*.md`、R3-7 `Debug_Log.md` 條目
- 動 Obsidian LLM Wiki 任何檔案
- 拆多個 commit（五改動 + patch + cache-buster 為原子單元）
- 升級 MIS 完整方案（commit 階段鎖保守，PASS-8 fail 才另次 commit 處理）

**失敗停手觸發點（停手、回報、由使用者決定下一步）**：
- shader compile error >3 次
- grep 發現實際行號與 SOP 不一致（shader 檔案偏移）→ 先 re-grep 確認、不盲改
- 任何 uniform 初值改動後 console throw
- 任何涉及上述「嚴禁」項的需求

**正常回報節點**：
- 五改動 + patch + cache-buster 完工 → commit hash 回報
- 每個失敗停手觸發點 → 即時回報現況 + 建議選項

---

## R4-4 甜蜜點 UI ✅

> **Plan v5 共識**：2026-04-24 計畫者 / 架構師 / 評判者多輪迭代收斂（v1→v2 需迭代→v3→架構師通過加 2 項小修→v4→評判者通過→v5 納入商品規格書反冪律擬合）。本節為 Plan v5 決策紀錄定案，覆蓋上方 2026-04-20 三方共識第 2 條舊版光度量測公式。

### 目標

在介面面板接線 10 條滑桿（投射燈 5 + 廣角燈 5 甜蜜點滑桿），供使用者實地調整甜蜜點（光束角、傾斜角、間距、距 Cloud 邊距、光通量）作投射燈採購決策視覺評估工具。

### 守則

1. **滑桿值域 / 步進 / 初值 1:1 對齊舊專案**（介面層 1:1；光物理行為由守則 2 承接，不保證舊物理 1:1）
2. **量綱鎖死輻射度量 L = Φ / (K · π · A)**，光束角影響中心亮度透過 `trackLampCandela()` **反冪律擬合商品規格書**（非純立體角公式，避免輻射度量 ↔ 光度學量綱失配）
3. **BVH 重建成本隔離**：間距 / 距 Cloud 邊距 類滑桿走指針按下鎖 + 指針放開 + 50 ms 尾端防抖觸發重建；光束角 / 傾斜角 / 發光量 類即時更新 uniform
4. **A/B 單選按鈕 不擴張覆寫 R4-4 新滑桿**（避免狀態爆炸；現有 A/B 僅覆寫 bounces / mult / wallAlbedo）
5. **原子交付**：10 滑桿回呼 + 4 recompute 輔助函式 + 1 個 `trackLampCandela()` 反冪律函式 + 光束角互鎖 + BVH 指針策略，同一 commit

### 決策動機

- **D1 採購決策時效**：使用者需要這 10 條滑桿才能在 3D 場景中實地調光束角 / 傾斜角 / 間距、比對桌面光斑做採購評估
- **D2 光學量綱失配風險最高**：純立體角公式 `cd = lm / (2π(1−cos(θ/2)))` 推算 15° / 2000 lm 得 37,209 cd vs 廠商商品實測 4,800 cd，脫鉤 8 倍，採購視覺評估失準；反冪律擬合量綱不變只加無單位乘數可規避
- **D3 BVH 拖動期間重建成本指針語意化隔離**：間距 / 距 Cloud 邊距 滑桿拖動會觸發 sceneBoxes 位置變動 → BVH 重建，若每次輸入事件都重建會介面卡頓

### 採用方案

純 uniform 路徑 + 商品規格書反冪律擬合：
- 光束角影響中心亮度透過 `trackLampCandela()` 反冪律擬合（15° vs 60° 對齊商品實測 3 倍比例）
- 量綱鎖死輻射度量，反冪律只加無單位純量乘數
- BVH 重建成本用指針按下鎖 + 指針放開觸發策略隔離
- 10 條滑桿預設值直譯舊專案，僅投射燈 / 廣角燈光通量肉眼偏光明顯才重校

### 光度量測公式（A′ 核心）

**商品規格書來源**（`docs/R3_燈具產品規格.md` L79）：

```
飛利明Varilumi 22W COB 軌道燈：
  15° → 4,800 cd  @ 2,000 lm
  60° → 1,600 cd  @ 2,000 lm
  比例 = 3.00x 精確
```

**反冪律擬合**：

```
cd(θ) = a × θ^b

兩點解：
  4,800 = a × 15^b
  1,600 = a × 60^b
  b = log(1600 / 4800) / log(60 / 15) = log(1/3) / log(4) = −0.7925
  a = 4,800 × 15^0.7925 = 41,696

最終公式（2000 lm 基準）：
  cd(θ, 光通量) = 41,696 × θ^(−0.7925) × (光通量 / 2,000)

驗算：
  cd(15°, 2000) = 4,800 cd  ✓
  cd(60°, 2000) = 1,600 cd  ✓
  cd(30°, 2000) = 2,770 cd  （中間內插，廠商未給）
  cd(45°, 2000) = 1,982 cd
```

**實作位置**：`js/Home_Studio.js` 新增 `trackLampCandela(lumens, beamFullDeg)`，納入 `computeTrackRadiance` 取代純立體角路徑：

```javascript
function trackLampCandela(lumens, beamFullDeg) {
  // 飛利明Varilumi 22W COB 規格擬合：15° → 4800 cd / 60° → 1600 cd @ 2000 lm
  // 反冪律：cd = 41696 × θ^(−0.7925) × (lm / 2000)
  const a = 41696, b = -0.7925;
  return a * Math.pow(beamFullDeg, b) * (lumens / 2000);
}
```

`computeTrackRadiance` 啟用 `beamFullDeg` 參數（R3-4 起死參數復活）：

```
cd = trackLampCandela(lumens, beamFullDeg)
radiance = cd × colorTempToRGB(K) / (emitterArea × 683)
```

**全角選擇**：代入 `beamFullDeg = trackBeamOuter`（`trackBeamOuter` 本身即為全角，舊專案 `lumenToCandela(lm, beamAngleDeg)` 入參也是全角，內部自行除 2 取半角）。

**內緣角不入公式**：`trackBeamInner` 只進著色器平滑過渡函式控制光斑邊緣柔和度，不影響中心亮度。內緣 / 外緣比例無法從廠商規格書推導（需要 IES 檔或實測光束剖面），預設值沿用舊專案經驗值（投射燈 30/55、廣角燈 95/120）；使用者肉眼對照實體商品可自行微調內緣滑桿。

**廣角燈**：廠商規格書僅給 120° 固定全角（無變焦），保持現有輻射度量路徑不變；若未來廣角燈變焦需求浮現，另擬合反冪律。

### 交付物

```
js/Home_Studio.js 改動：
  1. 10 個 createS 滑桿回呼（對應投射燈 5 + 廣角燈 5）
  2. 4 個 recompute 輔助函式：
     recomputeTrackGeometry()   投射燈光束角 / 傾斜角 → uTrackBeamCos / uTrackLampDir（僅更新 uniform）
     recomputeTrackPositions()  投射燈間距 / 距 Cloud 邊距 → sceneBoxes 支架 + uTrackLampPos（BVH 重建）
     recomputeWideGeometry()    廣角燈光束角 / 傾斜角 → uTrackWideBeamCos / uTrackWideLampDir（僅更新 uniform）
     recomputeWidePositions()   廣角燈距 Cloud 邊距 → sceneBoxes 廣角支架 + uTrackWideLampPos（BVH 重建）
  3. trackLampCandela(lumens, fullAngleDeg) 反冪律函式
  4. 光束角互鎖夾自身邏輯（投射燈 + 廣角燈）
  5. BVH 指針按下鎖 + 指針放開 + 50 ms 尾端防抖策略
  6. 值變動鏈：滑桿 → 更新 JS 變數 → recompute* → computeLightEmissions() → wakeRender()
  7. sceneBoxes 改動用具名引用（TRACK_STAND_IDX / TRACK_WIDE_STAND_IDX），避免硬編索引
```

**著色器無改動**：現有 `uTrackBeamCos` smoothstep 光錐 + 發光輻射管線即支援。

### 滑桿完整清單

#### 投射燈（5 條，光通量已在 R4-3 接線）

| 識別符 | 標籤 | 範圍 | 步進 | 預設 | 狀態變數 |
|---|---|---|---|---|---|
| `slider-track-beam-inner` | 光束角(內) | 1 ~ 90 | 1 | 30 | `trackBeamInner` |
| `slider-track-beam-outer` | 光束角(外) | 15 ~ 90 | 1 | 55 | `trackBeamOuter` |
| `slider-track-tilt` | 傾斜角 | 0 ~ 90 | 1 | 45 | `trackTilt` |
| `slider-track-space` | 間距 (cm) | 0 ~ 180 | 1 | 150 | `trackSpacing` |
| `slider-track-x` | 距Cloud邊距 | 0.05 ~ 0.90 | 0.01 | 0.05 | `trackBaseX = 0.90 + v` |

#### 廣角燈（5 條，光通量已在 R4-3 接線）

| 識別符 | 標籤 | 範圍 | 步進 | 預設 | 狀態變數 |
|---|---|---|---|---|---|
| `slider-track-wide-beam-inner` | 廣角束角(內) | 10 ~ 160 | 1 | 95 | `trackWideBeamInner` |
| `slider-track-wide-beam-outer` | 廣角束角(外) | 60 ~ 160 | 1 | 120 | `trackWideBeamOuter` |
| `slider-track-wide-tilt-south` | 南側傾斜角 | -70 ~ 70 | 1 | 15 | `trackWideTiltSouth` |
| `slider-track-wide-tilt-north` | 北側傾斜角 | -70 ~ 70 | 1 | -25 | `trackWideTiltNorth` |
| `slider-track-wide-z` | 距Cloud邊距 | 0.10 ~ 1.30 | 0.01 | 0.10 | `trackWideZ = 1.20 + v` |

### 光束角互鎖（v5：卡自己，非推對側）

- 內緣 onChange → `v = Math.min(v, trackBeamOuter)`（內緣最高 = 當時外緣值）
- 外緣 onChange → `v = Math.max(v, trackBeamInner)`（外緣最低 = 當時內緣值）

同樣適用廣角燈的內緣與外緣。**不**推對側（舊專案原版即卡自己）。

### BVH 更新策略（指針按下鎖 + 指針放開 + 50 ms 尾端防抖）

```
slider-track-space / slider-track-x / slider-track-wide-z：
  pointerdown   → rebuildLock = true
  onInput       → 更新 JS 變數 + uniform + sceneBoxes 位置，不重建 BVH
  pointerup     → 清 rebuildLock + 50 ms 防抖 → buildSceneBVH()
  pointerleave  → 也清 rebuildLock（後備；指針被其他介面吞的保險）

其他滑桿（光束角內/外緣 / 傾斜角 / 光通量）：
  onInput       → 即時更新 uniform，零重建
```

拖動期間：光源位置即時跟（uniform 更新），但 BVH 未重建 → 陰影暫時滯留（1 幀級）。放開瞬間 BVH 重建完成、陰影對齊回正確位置。此為**已知取捨**。

### A/B 單選按鈕 不擴張（守則 4）

R4-3-追加 commit `0594f00` 的 `btnA.onclick / btnB.onclick` 覆寫彈跳次數 / 間接光補償 / 牆面反射率三者。R4-4 **不擴張** A/B 邏輯覆寫 10 條新滑桿；使用者在 A 模式下調光束角 / 傾斜角 / 間距，切 B 再切回 A 後調整值仍保留。

Commit 前 grep 驗證：

```
grep "setSliderValue" js/Home_Studio.js | grep -E "slider-track-(beam|tilt|space|x|wide-)"
```

上述 grep 應**無匹配**（A/B 回呼不動這 10 條滑桿）。若有匹配即刪除或改為加保護。

### 值變動呼叫鏈

每條滑桿回呼 → 更新 JS 變數 → `recomputeTrackGeometry/Positions()` 或 `recomputeWideGeometry/Positions()`（依類型）→ `computeLightEmissions()` → `wakeRender()`。

### 事前驗屍（5 情境）

**S1 BVH 指針漏事件**
- 觸發：`pointerup` 被其他介面處理器吞（例如 createS meta-click 重設、指針鎖守門）
- 症狀：rebuildLock 不解、畫面位置不同步
- 緩解：`pointerleave` 也清鎖；50 ms 尾端防抖當後備

**S2 量綱失配**
- 觸發：誤用純立體角公式 `cd = lm / (2π(1−cos(θ/2)))`
- 症狀：整張畫面亮度失控（15° 情境 cd 差 8 倍）
- 緩解：完全走 `trackLampCandela()` 反冪律路徑；`computeTrackRadiance` 只呼叫此函式取 cd

**S3 預設值偏光**
- 觸發：R4-3-追加 新基準下舊預設值（光束角內外緣 30/55、傾斜角 45 等）偏亮或偏暗
- 症狀：A 模式載入光斑明顯偏光
- 緩解：**只重校投射燈 / 廣角燈光通量 2 個值**（非 10 個）；肉眼驗收若明顯偏光才重校；其他 8 個值直譯舊專案

**S4 sceneBoxes / BVH 拖動期間同步延遲**
- 觸發：間距 / 距 Cloud 邊距 滑桿拖動中 uniform 已更新但 BVH 未重建
- 症狀：光源位置移動但陰影滯留舊位置、「陰影錯位」瞬間
- 緩解：接受為**已知拖動期取捨**，放開瞬間 BVH 重建 + 畫面對齊

**S5 A/B 回呼衝突**
- 觸發：守則 4「不擴張覆寫」被現有 A/B 程式碼隱藏邏輯打臉
- 症狀：切換 A/B 時 R4-4 新滑桿值被重寫
- 緩解：commit 前 grep 驗證；若發現匹配即刪除或改為 `if (!userOverridden)`

### 測試計畫

**整合驗收（使用者肉眼）**：

- **I1** 10 條滑桿從最小拉到最大，光斑變化順暢無跳格
- **I2** 光束角互鎖「卡自己」：內緣拉超過外緣被卡在外緣值；外緣低於內緣被卡在內緣值
- **I3** 拖間距 / 距 Cloud 邊距 放手後 1 秒內畫面不卡；放手瞬間光源位置 + 陰影同步變
- **I4** Cam 1/2/3 × CONFIG 1/2/3 × A/B 切換後 10 條滑桿值保留使用者調整
- **I5** **採購視覺驗證（核心）**：A 模式下外緣光束角全角 15° × 桌面中央 50% 灰參考塊亮度 ÷ 外緣光束角全角 60° × 同位置亮度 **≈ 3.00 倍 ± 5%**（對齊商品 4800 / 1600 cd）
- **I6** A/B 單選按鈕 切換時 R4-4 的 10 滑桿不被覆寫（直接看數字）
- **I7** 間距 / 距 Cloud 邊距 拖動期間畫面位置即時跟（陰影可能暫時不對）；放手瞬間陰影對齊

**端對端使用情境**：
- **E1** 採購場景：A 模式外緣光束角 15° → 30° → 60° 觀察桌面光斑（大小 + 中心亮度同步變化）

**可觀測紀錄**：
- **O1** 瀏覽器 console 列印 `[R4-4] uniform-only update` / `[R4-4] BVH rebuild <ms>ms` 供事後回溯

### 驗證清單（15 項，commit 前逐項打勾）

```
- [ ] git branch == r3-light，工作區乾淨
- [ ] 著色器編譯：瀏覽器 console 零錯誤 / 警告（若有改著色器）
- [ ] 10 滑桿逐一介面視覺驗收（I1）
- [ ] 光束角互鎖卡自己（I2，非推對側）
- [ ] 間距 / 距 Cloud 邊距 指針重建不卡（I3）
- [ ] Cam / CONFIG / A/B 狀態保留（I4）
- [ ] 採購光束角比例 15° vs 60° ≈ 3 倍 ± 5%（I5）
- [ ] A/B 不擴張（I6，grep setSliderValue 對新滑桿無匹配）
- [ ] 間距拖動僅更新 uniform（I7）
- [ ] 採購場景操作（E1）
- [ ] 瀏覽器 console [R4-4] 標記輸出正確（O1）
- [ ] sceneBoxes 改動用具名引用（TRACK_STAND_IDX / TRACK_WIDE_STAND_IDX），避免硬編索引碰撞桌面參考塊 index 59
- [ ] 快取破壞參數：若改著色器 → ?v=r4-4-preview；純 JS → 不動
- [ ] commit 訊息含改動明細 + Co-Authored-By
- [ ] 使用者肉眼最終驗收通過
```

### 回滾策略

- commit 失敗 / 未 push → `git reset --hard 36b20cc` 回 R4-3-追加 DONE 狀態
- commit 已 push → `git revert <R4-4-commit>`（保留歷史）
- 不 `--force` push、不刪分支

### 決策紀錄（Plan v5 定案）

**決策**：介面 1:1 復刻舊專案值域 / 步進 / 初值；輻射度量 L = Φ/(K·π·A) 維持 R4-3-追加 基準；光束角影響中心亮度透過 `trackLampCandela()` **反冪律擬合商品規格書**（`cd = 41,696 × θ^(−0.7925) × 光通量/2000`）；間距 / 距 Cloud 邊距 走指針按下鎖 + 指針放開 + 50 ms 尾端防抖觸發 `buildSceneBVH()`；光束角 / 傾斜角 / 發光量即時更新 uniform；4 個 recompute 輔助函式不合併；光束角互鎖卡自己；投射燈 / 廣角燈光通量肉眼偏光明顯才重校。

**動機**：
- D1 採購決策時效
- D2 量綱失配風險最高（反冪律擬合量綱不變只加無單位乘數）
- D3 BVH 指針語意化成本隔離

**為何選定**：守則 1 介面 1:1 / 守則 2 輻射度量鎖死 + 反冪律擬合 / 守則 3 BVH 成本隔離三層保護同時到位；與 commit `0594f00` 量綱基準完全相容；商品規格書 3 倍精確對齊採購認知。

**影響**：
- `computeTrackRadiance` 的 `beamFullDeg` 死參數復活並使用
- 新增 `trackLampCandela()` 反冪律函式
- 2026-04-20 SOP L191 三方共識「純立體角公式」段以決策紀錄補註覆蓋，主文不動
- 4 個 recompute 輔助函式並存，守則 3 成本隔離可觀測
- R4-5 截圖 / 可觀測紀錄可直接消費 `[R4-4]` console 標記

**追蹤項**：
- F1 廣角燈規格書僅給 120° 固定；若後續廣角燈變焦需求浮現 → 另擬合反冪律
- F2 投射燈 / 廣角燈光通量肉眼偏光明顯時補量測寫入 `Debug_Log.md`
- F3 R4-5 截圖里程碑觸發條件對齊 `[R4-4]` console 標記
- F4 廠商規格書若未來補 30° / 45° 中間點 cd 值 → 擬合曲線精修

### OMC 工具路徑

- 計畫階段：`/oh-my-claudecode:ralplan`（已完成 v1→v2 需迭代→v3→架構師通過加 2 項小修→v4→評判者通過→v5 納入反冪律擬合）
- 執行階段：`/oh-my-claudecode:ultrawork`

### ultrawork 執行紀律（R4-4 專用）

**嚴禁**：
- `git push` / `git rebase` / `git commit --amend` / `git reset --hard` 未經使用者授權
- 變更著色器 `Home_Studio_Fragment.glsl`（本階段無需改著色器；若 Executor 發現必要，**停手回報**）
- 改動 `computeTrackRadiance` 量綱結構（只能呼叫新函式取 cd，不改輻射度量量綱定義）
- 啟用純立體角公式（即使舊 SOP 字面如此；已被 Plan v5 覆蓋）
- 擴張 A/B 單選按鈕 邏輯覆寫 10 條新滑桿

**停手觸發點**：
- `Home_Studio_Fragment.glsl` 意外必要改動
- grep 發現 A/B 回呼已隱式覆寫新滑桿
- BVH 重建耗時 > 200 ms（需重評防抖策略）
- 商品規格書反冪律擬合在 `lumenToCandela` 呼叫點出現結果脫鉤 5 倍以上

**正常回報節點**：
- 10 滑桿接線 + 4 recompute 輔助函式 + 反冪律函式完 → commit hash
- 每個失敗停手觸發點即時回報現況 + 建議選項

### 完工紀錄（2026-04-24 DONE）

R4-4 以 11 個漸進 fix 交付。量綱修正、預設校正、UX 打磨三軸獨立迭代，物理正確性優先於基準連續性。

#### 量綱鎖死（fix01~fix02）

- **fix01**：原子實作 10 滑桿 + `trackLampCandela()` 反冪律函式 + 4 個 `recompute*()` 輔助 + BVH pointerdown-lock + 50ms debounce 策略 + 光束角互鎖（卡自己）。
- **fix01-idx**：首次載入黑畫面 throw `[R4-4] TRACK_STAND_IDX 錯位 fg=1 vs fg=0`。根因是註解邏輯 ID 誤當 sceneBoxes 陣列 index（地面 0a/0c/... 複合物件每子塊各 push 一次；R3-3 `CLOUD_BOX_IDX_BASE=71` 是同型 guardrail 證據）。修為 4 具名索引 + load-time throw-first 守門：
  - `TRACK_BASE_IDX=53`（軌道底座 4 片）
  - `TRACK_STAND_IDX=57`（投射支架 4 片）
  - `TRACK_WIDE_BASE_IDX=61`（廣角軌道 2 片）
  - `TRACK_WIDE_STAND_IDX=63`（廣角支架 2 片）
- **fix02-radiance**：使用者肉眼察覺整體刷白、冷暖對比淡化、桌子偏暗。systematic-debugging 四階段追出 `computeTrackRadiance` 的 cd 路徑量綱失配：
  - 錯：`L = cd / (K · π · A)` — 把 `cd [lm/sr]` 當作 `Φ [lm]` 做 Lambertian 分攤 `/π`，等於多做一次均勻散射歸一。
  - 對：`L = cd / (K · A)` — cd 已是方向性強度（per-steradian），只需 `/A` 歸一面積、`/K` 轉 photometric → radiometric。
  - 修後 radiance 回升至舊 Lambertian 基準的 π 倍（273.5%，物理正確，非視覺參考）。
  - fallback Φ 路徑 `L = Φ/(K·π·A)` 的 `/π` 保留（Lambertian 面光源物理必要）。

#### 第 10 條滑桿（wide-z）公式裁決

SOP L700 Plan v5 寫 `trackWideZ = 1.20 + v`（對稱於 z=0）與 R2-15 重建後 uniform 非對稱 2.1/-1.1 預設矛盾。`SOP/R2：所有幾何物件.md:882` 註記「新 R2 以絕對座標替代」佐證 Plan v5 公式直譯舊專案疏漏。裁決採**選項 C 真字面「距 Cloud 邊距」**：
```
南軌 z = 1.698 + v    (Cloud 南邊緣 + 距離)
北軌 z = -0.702 - v   (Cloud 北邊緣 - 距離)
```
範圍 `0.05 ~ 1.15`（上界 v=1.15 讓北軌 z=-1.852 距北牆內面 22mm 安全邊界）、預設 `0.40`（對應原 uniform 2.1/-1.1 ±2mm）。

#### 甜蜜點預設校正（fix03~fix06）

使用者在 fix02 物理正確基準下重新抓採購視覺甜蜜點：

| 項目 | 舊值 | 新值 | 來源 |
|---|---|---|---|
| Cloud 光通量 lm/m | 800 | 1600 | fix03 肉眼偏光校正 |
| Track 光通量 單盞 | 500 | 2000 | fix03 商品規格書滿刻度 |
| Track beam 內/外 | 30/55 | 40/60 | fix06 COB 硬邊典型 + cd(2000,60)=1625 貼齊規格 1600 cd |
| Wide beam 內/外 | 95/120 | 90/120 | fix06 散光柔和內緣 |
| Wide 南 tilt | 15 → 0 → 30 | 30 | fix03→fix04 避 Cam3 高光點 |
| Wide 北 tilt | -25 | -30 | fix03 對稱外傾 |
| Wide 距 Cloud 邊距 | 0.40 | 0.20 | fix03 貼近 Cloud 邊緣 |
| `uTrackWideLampPos` 南 z | 2.100 | 1.898 | 隨 trackWideZ=0.20 同步 |
| `uTrackWideLampPos` 北 z | -1.100 | -0.902 | 同上 |

Track beam 40/60 差 20、Wide beam 90/120 差 30 的柔和度梯度：Δcos = 0.074 / 0.207（2.8 倍），地面投影柔和帶 0.45 m / 2.09 m（4.6 倍），符合商品語感「廣角更柔和」。

#### CONFIG 拆分（fix05）

原 CONFIG 3「Cloud + 軌道 + 廣角」三光源共存改為：

- **CONFIG 3 = 全吸音 + 僅 Cloud 漫射燈**（全亮好工作）
- **CONFIG 4 = 全吸音 + 軌道+廣角燈**（冷暖有氣氛）

`applyPanelConfig` 語義改寫：
```
fullAbsorb = (config === 3 || config === 4)   → Cloud 板開 + 吸頂拆除
cloudLampOn = (config === 3)                   → Cloud 燈條
trackLampOn = (config === 4)                   → 軌道+廣角燈
```

CONFIG 4 允許使用者**手動**勾 chkCloud 補光（checkbox 預設關但 UI 可見），Cloud 重構（R5）前的暫行對策。

`rebuildActiveLightLUT` 分支擴為 `config === 3 || config === 4`，checkbox-gated LUT 保留彈性。

#### UX 打磨（fix07~fix11）

- **fix07-ui-gate**：CONFIG 切換時對無效燈光區塊套 `opacity:0.35 + pointer-events:none`（使用者稱「凍結」）。
- **fix08-hide**：凍結改隱藏（`display:none`）— CONFIG 4 Cloud 區保留顯示（手動補光路徑）。
- **fix09-tight**：兩條 item-divider 移入下一 section 頂端（section 隱藏則 divider 同步隱藏、無空白殘留）；slider-brightness 在 CONFIG 3/4 也套 display:none 徹底消失。
- **fix10-reorder-grayscale**：
  - UI 面板順序 `配置 → 燈光設定 → 光追設定`（原 `光追設定 → 配置 → 燈光設定`）
  - checkbox 未勾時 section 內容灰階 + pointer-events:none（CSS `.light-section.inactive .sub-panel`）；Wide 內建南/北兩 checkbox 以 `label pointer-events:auto` 保持可點。
- **fix11-gik-panel**：吸音板顏色 minimap 從 config-panel 子面板拆出為頂層獨立面板 `🎨 吸音板顏色`，預設折疊，置於配置與燈光設定之間。

#### 收斂性現狀

使用者觀察 CONFIG 3/4 感覺比 CONFIG 1/2 慢。診斷：
- LUT 確實排除（console 可見 `[R3-6.5] active pool rebuild { count: 4|6 }`）
- 但 stochastic NEE MC variance ∝ pool size，pool=4 需約 4× SPP 才達到 pool=1 同等噪點
- shader 端全展開或 stochastic pick 策略差異未驗證（不在 R4-4 scope）
- 終極解在 R5 Cloud 重構：4 rod → 1 panel + 遮擋箱，pool 縮至 1

#### 驗收清單覆盤

原 15 項驗收清單逐項對照結果：

- [x] git branch == r3-light，工作區乾淨
- [x] 著色器零改動（R4-4 嚴禁成立）
- [x] 10 滑桿逐一介面視覺驗收（I1）
- [x] 光束角互鎖卡自己（I2）
- [x] 間距 / 距 Cloud 邊距 指針重建不卡（I3，BVH rebuild < 50 ms 實測）
- [x] Cam / CONFIG / A/B 狀態保留（I4）
- [x] 採購光束角比例 15° vs 60° ≈ 3 倍 ± 5%（I5，精確 3.0001）
- [x] A/B 不擴張（I6，grep NO_MATCH 維持）
- [x] 間距拖動僅更新 uniform（I7）
- [x] 採購場景操作（E1）
- [x] 瀏覽器 console `[R4-4]` 標記輸出正確（O1）
- [x] sceneBoxes 改動用具名引用 + throw-first 守門（含 fix01-idx 修正）
- [x] 快取破壞參數：fix01 → fix11 每版獨立 query
- [x] commit 訊息含改動明細 + Co-Authored-By
- [x] 使用者肉眼最終驗收通過（2026-04-24）

#### Scope 追加事項（SOP 原 Plan v5 外的使用者新增）

- CONFIG 3 拆 3/4：原 SOP 無此計畫，使用者 fix05 當下決定
- 面板順序重排 + 🎨 吸音板顏色獨立：原 SOP 無此計畫，使用者 fix10/fix11 打磨
- 量綱修正（fix02）：Plan v5 L640-646 `radiance = cd × colorTempToRGB(K) / (emitterArea × 683)` 與本專案 `kelvinToLuminousEfficacy` 量綱體系不吻合；實作走 `cd / (K · A)` 對齊既有 Φ 路徑 `/K · π · A` 的 /K 量綱；公式決定值高於 SOP 字面。

#### 待結案轉交項

- **F1（仍有效）**：廣角燈規格書僅給 120° 固定；若後續變焦需求浮現 → 另擬合反冪律
- **F2（仍有效）**：光通量肉眼偏光明顯時補量測寫入 Debug_Log.md
- **F3（仍有效）**：R4-5 截圖里程碑觸發條件對齊 `[R4-4]` console 標記
- **F4（仍有效）**：廠商規格書若補 30°/45° 中間 cd → 擬合曲線精修
- **F5（R5）**：Cloud 光源重構（4 rod → 1 panel + face-selective emission + 遮擋箱）。Φ=13,338 lm、A=0.267 m²、L=49.67 W/(sr·m²) 與現況幾何精確等效（計算驗證 0.34% 偏差）。pool 4→1 可望 CONFIG 3 收斂加速 ~4×。需 shader 改動，獨立階段前先 ralplan 取共識
- **F6（待評估）**：A/B 模式是否拆除（使用者提「視覺偏差太大考慮拿掉」，R4-4 scope 外，留給 R5 判斷）

---

## R4-5 互動打磨 ✅

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

### 完工紀錄（2026-04-24 DONE）

R4-5 8 項中 6 項先前已由 R4-1/R4-3/R4-4 跨階段完成，R4-5 本階段以 2 個 fix 收尾：

#### SOP 8 項對照

| # | SOP 要求 | 交付狀態 | 完成階段 |
|---|---|---|---|
| 1 | Panel 折疊預設 | ✅（config 按使用者裁決保持展開；ray/light/gik collapsed）| R4-1 + R4-4-fix11 |
| 2 | Cam 1/2/3 按鈕 | ✅ | R4-3 |
| 3 | X-ray toggle | ✅（使用者裁決僅保留 `uXrayEnabled=1` 功能，不加 UI checkbox）| R2-13 功能 |
| 4 | Hide UI | ✅（R4-5-fix01 擴展含左下 cameraInfo + snapshot-bar 同步隱藏）| R4-3 + R4-5-fix01 |
| 5 | Help hover | ✅（純 CSS `#help-wrapper:hover`）| R4-1 |
| 6 | FPS + sample counter | ✅（R4-5-fix01 實作：cameraInfo 加 FPS 前綴 `FPS: N / FOV: 55 / Samples: 1000` 斜線分隔；0.5 秒平滑累積器）| R4-5-fix01 |
| 7 | Snapshot milestone+bar+下載 | ✅（R4-5-fix01 調整：bar bottom 50px→28px、thumb 60px→45px、label 分 2 行）| R4-1 + R4-5-fix01 |
| 8 | Loading screen | ✅（使用者裁決不需 SVG 進度環，本地資源載入快）| - |

#### R4-5-fix01 polish

- HTML：移除畫面頂白字標題 `<div id="info">` 視覺顯示
- JS：`cameraInfo` innerHTML 重寫加入 FPS 前綴，以 `window._fpsAcc` 0.5s 平滑累積器避免跳動
- JS：`buildSnapshotBar()` img.width 60→45、label `innerHTML = samples + '<br>spp'`
- JS：`hideBtn.onclick` 擴展隱藏範圍（+ `cameraInfo` + `snapshot-bar`）
- CSS：`#snapshot-bar { bottom: 28px }` 更貼近畫面底

#### R4-5-fix02 infodom

fix01 後首次載入黑畫面 + console 錯：

```
InitCommon.js:115 Cannot read properties of null (reading 'style')
InitCommon.js:440 Cannot access 'mouseControl' before initialization
InitCommon.js:320 Cannot read properties of undefined (reading 'setPixelRatio')
```

根因：fix01 移除 `<div id="info">` DOM，但 `js/InitCommon.js:114` `let infoElement = document.getElementById('info');` + L115 `infoElement.style.cursor = "default";` 將 null 當物件讀 → init 中斷連鎖崩。

修法：`#info` DOM 保留但 `style="display:none;"`（視覺不顯示、JS 引用可取得）。

**教訓登錄 memory**：framework 共用檔（`InitCommon.js` 等）引用的 DOM id 嚴禁刪除，只能 `display:none` 隱藏。

#### User decisions

- config-panel 保持展開（非 SOP 要求的全 collapsed）— 使用者裁決 CONFIG radio 是主要入口，每次展開成本不划算
- X-ray 不做 UI checkbox — 使用者裁決功能保留即可
- Loading screen 不做進度環 — 使用者裁決本地資源載入快，非必要

#### 無遺留項

R4-5 無 carry-forward；R4 整階段（R4-0~R4-5）至此全部完成。

---

## 驗收紀律

- R4 無 spp 比對驗收（UI 層）；由使用者直接操作每一控件確認反應正確。
- 關鍵行為錯誤（如色溫 radio 不切換、lumens slider 無效）當場修掉，不累到後段。
- R4-2 shader 修改例外：CONFIG 1/2/3 × Cam 1，64 spp 確認渲染無異常。
