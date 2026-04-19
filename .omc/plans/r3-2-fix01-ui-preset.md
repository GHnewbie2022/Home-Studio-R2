# R3-2-fix01 色溫 UI 改 preset + Config 聯動

建立：2026-04-19
分支：r3-light
依據：R3-2 主階段既有 PCHIP kelvinToRGB + per-group state（commit b05e534）
產品規格：docs/R3_燈具產品規格.md
舊專案對照：Home_Studio_3D_OLD/Path Tracking 260412a 5.4 Clarity.html L295-358

## 一、Scope

1. 將 R3 Color Temperature 3 slider（2700-6500K）改為 4 個 lil-gui dropdown
2. 色溫離散化為三檔 preset：暖 / 自然 / 冷，數值依商品規格
3. 東西軌道燈增加 5 preset：全暖 / 全自然 / 全冷 / 北暖南冷 / 北冷南暖
4. 南北廣角燈南北分離（2 個 dropdown，獨立控制）
5. 吸頂燈 colorTempCtrl：Config 1/2 enable、Config 3 disable
6. R3 3 組 dropdown：Config 1/2 disable、Config 3 enable

## 二、Non-scope（勿觸）

- PCHIP kelvinToRGB 本體（已 ABI frozen + contract-test locked）
- computeLightEmissions 函式（仍純註解、emission=0 凍結）
- 吸頂燈 emission 通路（L1231 colorTemperature 不動）
- docs/SOP/ 任何檔案（DONE 觸發）
- memory handover（DONE 觸發）
- git push（DONE 觸發）

## 三、色溫映射（商品規格 + 舊專案三方一致）

```
             暖 WARM   自然 NEUTRAL   冷 COLD
  Cloud      3000K     4000K          6500K      (LED 軟條燈四款取三)
  Track      3000K     4000K          6000K      (22W COB 三款全用)
  TrackWide  3000K     4000K          6000K      (25W 廣角三款全用)
```

## 四、Track 5 preset 映射（依 L909-914 NW/NE/SW/SE）

```
  trackKelvin[0]=NW, [1]=NE, [2]=SW, [3]=SE
  WARM=3000K, NATURAL=4000K, COLD=6000K

  全暖       [W, W, W, W]
  全自然     [N, N, N, N]        ← 預設
  全冷       [C, C, C, C]
  北暖南冷   [W, W, C, C]
  北冷南暖   [C, C, W, W]
```

## 五、TrackWide 南北分離（依 L927-930）

```
  trackWideKelvin[0] = 南 (z=2.1)
  trackWideKelvin[1] = 北 (z=-1.1)
  獨立 dropdown：trackWideColorSouth, trackWideColorNorth
  預設：南=NEUTRAL, 北=NEUTRAL
```

## 六、File diff

### js/Home_Studio.js

- 移除 L376-379 R3_DEFAULT_K + 舊單值 state
- 新增 module-scope 色溫 mode state + 產品規格映射表 +controller 引用
- 新增 syncR3ColorUIEnable() 函式（依 currentPanelConfig 切 enable/disable）
- applyPanelConfig 尾端呼叫 syncR3ColorUIEnable()
- L1099-1105 colorTempCtrl：移除 .disable()、改名「吸頂燈色溫 (K)」、賦值給 module-scope 引用
- L1107-1136 原 3 slider 區塊 → 4 dropdown（Cloud / Track / 廣角南 / 廣角北）
- setupGUI 結尾呼叫 syncR3ColorUIEnable() 初始化

### Home_Studio.html

- L48 cache-buster：`r3-2-v2-kelvin-rgb` → `r3-2-fix01-ui-preset`

### docs/tests/r3-2-kelvin.test.js

- 零改動（PCHIP 本體未變，contract-test 應保持 25/25 PASS）

### .omc/prd.json

- 覆寫為 R3-2-fix01 的 7 個 user story

## 七、Step-by-step

1. 起草 plan + PRD（本檔 + .omc/prd.json）
2. js/Home_Studio.js module-scope state/ref 改動（移除 R3_DEFAULT_K）
3. js/Home_Studio.js 新增 syncR3ColorUIEnable() + applyPanelConfig 尾端呼叫
4. js/Home_Studio.js setupGUI colorTempCtrl 改（module-scope 賦值 + 移 disable）
5. js/Home_Studio.js setupGUI R3 4 dropdown 建構 + setupGUI 結尾同步呼叫
6. Home_Studio.html cache-buster bump
7. node docs/tests/r3-2-kelvin.test.js（regression：應維持 PASS）
8. git add 4 檔（js + plan + html）+ commit，不 push、不改 SOP
9. Architect verify 依 prd.json acceptance criteria
10. ai-slop-cleaner 掃 changed surface
11. Post-deslop regression（重跑 node test）
12. 報告終局

## 八、Acceptance Criteria（見 .omc/prd.json US-F01..F07）

關鍵：
- Cloud/Track/TrackWide 的 WARM/NEUTRAL/COLD 映射數值依商品規格分別為 (3000,4000,6500) / (3000,4000,6000) / (3000,4000,6000)
- Track 5 preset 正確 broadcast 到 trackKelvin[0..3] NW/NE/SW/SE 對應
- TrackWide 南/北獨立寫入 trackWideKelvin[0] / trackWideKelvin[1]
- colorTempCtrl Config 1/2 enable、Config 3 disable（applyPanelConfig 切換時即時生效）
- R3 4 dropdown Config 1/2 disable、Config 3 enable
- 預設（第一次進畫面 + Config 1）：吸頂燈滑桿 4000K 可拉，R3 4 dropdown 全灰
- contract-test 仍 25/25 PASS
- commit 不 push、docs/SOP/ 零動

## 九、DONE 觸發項（out-of-scope）

- SOP R3：燈光系統.md 雙處打勾 ✅
- SOP 備註補充（R3-2-fix01 改 UI preset 歷程）
- memory handover 更新
- git push origin r3-light
- 吸頂燈 Config 3 emission 歸 0（另立 fix，等 R3-3/4/5 完工後）
