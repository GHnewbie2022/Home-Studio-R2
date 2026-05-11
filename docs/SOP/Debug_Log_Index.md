# Debug Log Index

> 目的：讓接手代理先用本檔路由，再回 `Debug_Log.md` 讀必要章節。`Debug_Log.md` 保留為完整總帳，不建議每次接手全讀。
> 更新日：2026-05-08

---

## 使用方式

```
1.  先讀本檔，判斷目前任務屬於哪條路線。
2.  再讀 `Debug_Log.md` 對應章節。
3.  若任務涉及目前 R 階段，必讀目前 R 階段 MD。
4.  若遇到 bug 或非預期行為，先讀「永久必讀」與對應觸發章節，再進 systematic debugging。
5.  新量測、新結論、新地雷與實驗路徑變更，仍寫回目前 R 階段 MD 與 `Debug_Log.md`。
```

快速定位章節：

```bash
rtk rg -n '^## |^### |R7-3|v3k|effectiveStrength|sampleCounter|S2' docs/SOP/Debug_Log.md
```

---

## 永久必讀

這些章節是跨 R 階段護欄，任務碰到 debug、shader、GUI 或 progressive accumulation 時先讀。

```
1.  `⚠ 必讀：通用 Debug 紀律`
    何時讀：
      - 任何 artifact、黑線、幾何怪象、材質污染。
      - 接手者想改 shader hitType 或複用 material type。
    核心：
      - 先定位 hitType，再讀完整分支。
      - material type 用物件語義。
      - 修復宣告前要有足夠視角與 spp 驗證。

2.  `R2-6｜MAX_SAMPLES 過曝`
    何時讀：
      - sampleCounter、MAX_SAMPLES、render pass 停止、累積 buffer 異常。
    核心：
      - 停止累積要同時停 counter 與 render pass。

3.  `R2-11｜切換 Cam 殘影揮之不去`
    何時讀：
      - Cam 切換、配置切換、幾何或光源狀態變更後殘影。
    核心：
      - progressive renderer 需要清空 accumulation buffer 才能瞬切。

4.  `R4-1｜UI 骨架復刻`
    何時讀：
      - 新增或調整左下、右上、浮動控制列。
    核心：
      - cache-bust 要全覆蓋。
      - 浮動 UI 要處理 pointer-lock guard。
      - slider 初始值要對齊 uniform 初始值。

5.  `R6-3 Phase2｜Cloud visibility probe v4/v5 亮度回歸教訓`
    何時讀：
      - Cloud NEE、normal、PDF、MIS、probe readback。
    核心：
      - probe 診斷 normal 不可污染正常渲染。
      - probe 數字通過不代表正常畫面通過。
```

---

## 目前優先路線

### R7-3 quick preview terminal fixed curve closeout

```
必讀：
  - `docs/SOP/R7：採樣演算法升級.md`
  - `Debug_Log.md` 的 `R7-3-quick-preview-terminal-v3`

目前狀態：
  - R7-3 已收尾。
  - R7-3 terminal fill 是 path shader reachedMaxBounces 補預覽光。
  - v1b / v2 顯示端補洞已 no-go。
  - v3j 拆掉 1~4SPP 可輸入欄位，改為 display-only 固定曲線。
  - v3al 預設 ON，R7-3 terminal fill 套用範圍已回到 C3-only；C4 保留丟可見 1SPP。
  - v3s 已新增 C3/C4 GIK vs wall 低 SPP 量測 helper。
  - v3t 已新增 C4-only GIK dark-only lift。
  - v3q 只恢復最小 ON/OFF 開關，給高 SPP 同場景 A/B 驗證；曲線輸入仍不恢復。
  - 高 SPP 驗收已過：使用者測 1000SPP，R7-3 ON / OFF 完全一樣。
  - 黑色物件保護先列觀察項，不實作；目前使用者沒有覺得深色物體被明顯抬亮。
  - 目前固定曲線：
      1SPP = 3.20
      2SPP = 1.70
      3SPP = 1.50
      4SPP = 1.25
      5SPP 起由 1.25 每次減半靠近 1.00
  - 使用者肉眼回報 C3 目前差不多，曲線暫收。
  - C4 同曲線已量到：mean ratio 只低約 3%~5%，但 GIK p50 明顯偏低、p90 已經很亮。
  - v3t 第二刀用 pre-terminal luma 當 dark gate，lift strength = 1.45。
  - v3t 量測：C4 GIK p50 2SPP 0.208→0.295、4SPP 0.281→0.309、8SPP 0.313→0.329；p90 幾乎不動。
  - v3u 依使用者肉眼回報，把 C4 wall terminal scale 設成 0.88、GIK dark lift strength 設成 2.10。
  - v3u 量測：C4 wall p50 約 0.464→0.456；C4 GIK p50 2SPP 0.295→0.318、4SPP 0.309→0.327、8SPP 0.329→0.337；p90 沒上升。
  - v3v 依使用者肉眼回報，把 C4 wall terminal scale 設成 0.78、GIK dark lift strength 設成 3.20。
  - v3v 量測：C4 wall p50 約 0.456→0.445~0.450；C4 GIK p50 2SPP 0.318→0.351、4SPP 0.327→0.350、8SPP 0.337→0.353；p90 沒明顯上升。
  - v3ah 依使用者修正，改看 C4 2~16SPP 全段，停止只用 2/4/8 代表前段。
  - v3ah 依使用者肉眼回報，拆掉多層 sample-specific gate 與 final front GIK boost，處理 2/3 牆面斷層與 GIK 前段過亮。
  - v3ah 實作：C4 wall terminal scale 0.58、GIK dark lift 3.60、low-luma lift 0.25，final wall 改成 smoothstep(2,8) 的平滑前段 gate。
  - v3ah 量測：2SPP wall/GIK p50 0.360/0.398；3SPP 0.359/0.405；4SPP 0.478/0.340；5SPP 0.373/0.406；6SPP 0.379/0.407。
  - v3ai 依使用者回報改成 C4 wall-only 調參：暫停 C4 GIK 專用 lift，移除 C4 wall post-luma bright gate、final 4SPP 特例、final front gate。
  - v3ai fresh-page 重測後，舊量測的 4SPP 凸點判定為量測流程污染；v3ai 牆面 p50 仍太平，2SPP 0.423、4SPP 0.421、16SPP 0.420。
  - v3aj 實作：C4 wall terminal scale 0.58→1.10，C4 wall terminal fade 改成 `1.0 / (1.0 + 1.60 * max(0.0, uSampleCounter - 2.0))`，先追牆面 2~16SPP 快速衰減曲線。
  - v3aj fresh-page 量測按 actualSamples 看：2SPP 0.482、4SPP 0.453、5SPP 0.448、6SPP 0.445、7SPP 0.442、9SPP 0.438、10SPP 0.436、12SPP 0.433、14SPP 0.431、16SPP 0.429、17SPP 0.428。
  - v3ak 依使用者要求把 C4 回到原本狀態：R7-3 terminal fill 改回 C3-only，shader 移除 C4 wall-only 曲線。
  - v3al 依使用者補充修正：C4 保留第一個可見畫格直接到 2SPP，C4 仍不套 R7-3 terminal fill。
  - v3k 未解的 S2 疑似吃到 S1 已在 v3l 找到根因並修正。
  - 根因是 first-frame recovery 連續 render S1~S4 時，R7-3 terminal uniform 在 path render 後才更新。
  - v3l 改成每個 sample render 前更新 R7-3 uniform。

最新未解：
  - C4 若未來再重試 terminal fill 曲線，需要另開新路線；v3al 目前以 C4 丟 1SPP、無 R7-3 曲線為準。
  - 黑色吸音板、喇叭、腳架的發灰保護。
  - 24SPP 後退場與 1024SPP 正式收斂守門。

下一步：
  - 使用者驗 C4 快速預覽前牆是否暗到位、GIK 是否亮到位，並看亮區是否過亮。
```

---

## 觸發式路由

### Shader / 材質 / hitType

```
讀：
  - `⚠ 必讀：通用 Debug 紀律`
  - `R2-14｜東西投射燈軌道底面黑線`
  - `R2-18｜ISO-PUCK 狀態洩漏`
  - `R2-18｜metalness 硬閾值 → Monte Carlo 機率分支`

適用：
  - 黑線、假孔洞、物件材質被前一個命中污染。
  - 新增 CylinderIntersect 或自訂 intersect。
  - 新增 metalness / roughness / 材質分支。
```

### 幾何 / X-ray / cullable

```
讀：
  - `R2-13｜X-ray 視角下結構體外延至牆外`
  - `R3-6｜Many-Light + MIS 整合收尾補丁` 的 fix05 / fix06
  - `R6-LGG-r30` 的窗外背板 X-ray fix

適用：
  - 透視剝離錯誤。
  - 天花板、地板、牆角、柱子外延或缺口。
  - 背景、窗外貼圖被錯誤剝離。
```

### Progressive accumulation / sampleCounter / 暫停單步

```
讀：
  - `R2-6｜MAX_SAMPLES 過曝`
  - `R2-11｜切換 Cam 殘影揮之不去`
  - `R2-8｜吸音板 Config 切換後殘留舊畫面`
  - `R7-snapshot-step-history-buttons`

適用：
  - sampleCounter 回退或未回退。
  - 暫停、下一個採樣、上一個採樣。
  - 改 UI 後畫面沒重算、或重算太多次。
```

### Camera preset / FOV / 透視比例

```
讀：
  - `R7-3｜滾輪縮放後切視角造成左右拉伸`
  - `R2-11｜切換 Cam 殘影揮之不去`

適用：
  - 滾輪縮放後按視角 1 / 2 / 3。
  - 畫面左右拉伸、水平比例怪、FOV 顯示恢復但畫面比例未恢復。
  - 切視角後相機位置正確，但 ray tracing 投影比例錯。

核心：
  - path tracer 不靠 three.js projection matrix。
  - FOV 改動必須同步更新 `uVLen` 與 `uULen`。
  - `uULen = uVLen * worldCamera.aspect`，少更新就會留下舊水平縮放。
```

### Cloud / C3 / C4 / MIS / PDF

```
讀：
  - `Cloud / GIK 名詞鎖定`
  - `R3-5b｜Cloud 漫射燈條 NEE 補漏四連翻車`
  - `R3-6｜Many-Light + MIS 整合收尾補丁`
  - `R6-3 Phase2｜Cloud visibility probe v4/v5 亮度回歸教訓`
  - `Cloud MIS weight probe`
  - `BSDF-hit terminal isolation v7`
  - `Forced BSDF-hit probe v8b`
  - `Natural BSDF-hit frequency probe v9`
  - `Direct NEE screen-band probe v10`
  - `Direct NEE top-band percentile probe v11`
  - `Direct NEE diffuseCount split probe v12`

適用：
  - Cloud 亮度變暗或變亮。
  - probe readback 怪值。
  - direct NEE / BSDF-hit / reverse MIS / PDF 契約。
  - C3 早期髒點與 direct NEE 亮尾端。

目前穩定結論：
  - Cloud GIK = 吊頂 6 片白色 GIK 吸音板；Cloud 燈條 / Cloud rod = 4 支 CLOUD_LIGHT 光源。
  - `gikPanel` 是 probe 分類，對應 ACOUSTIC_PANEL，可能包含牆面 GIK 與 Cloud GIK。
  - Cloud 抽樣名額正常。
  - direct NEE 權重健康。
  - v7 前 BSDF-hit 讀值受污染，不可再用。
  - 自然 BSDF-hit 在 C3/cam1 目前很稀有。
  - C3 早期髒感後來轉向 direct NEE 亮尾端、bounced-surface 與低 SPP coverage 問題。
```

### 快速預覽 / R6 movement protection / 移動期遮擋

```
讀：
  - `R6-LGG-J3｜借光 buffer 13 輪 debug`
  - `R6-3-Phase2-v19-first-frame-burst`
  - `R6-3-Phase2-v20-movement-protection` 到 `v22c`
  - `R7-2：光源 importance sampling 機率優化`
  - `R7-3-quick-preview-terminal-v3`
  - `R7-3｜C3/C4 快速預覽丟掉可見 1SPP 實驗`
  - C3 丟掉可見 1SPP 已由使用者回報手感可接受；原因是 1SPP 最髒，2SPP / 3SPP 較接近，且目前 FPS 本來就不高。

適用：
  - C3 / C4 快速預覽低 SPP 很髒。
  - 移動時黑幕、卡手、殘影、簡化模型閃爍。
  - 顯示端補洞或 history mix 類候選。
  - 想讓 C3 第一個可見畫格從 2SPP 開始。

重要 no-go：
  - R6 v20g / v20h 顯示端清理仍無法處理 4SPP 大面積樣本圖樣。
  - R6 v21a 拉高移動 samples 到 16 造成卡手與模糊。
  - R6 v22a deterministic preview 出現廉價簡化模型閃爍，預設已關。
  - R7-3 v1b / v2 顯示端補洞無效，已轉 path terminal。
```

### 光度 / 色溫 / 光源角度

```
讀：
  - `R3-4 fix07｜軌道燈 lumens slider 與輸出解耦`
  - `R3-6.5｜廣角燈 tilt 配置錯誤`
  - `R6-LGG-r30` 的 White Balance / Hue 章節

適用：
  - lm slider 無效或過曝。
  - 色溫、白平衡、色相、光源方向。
  - 廣角燈造成假陰影。

核心：
  - 光通量要對齊 radiometric 量綱。
  - 真實燈具數值不要靠對稱直覺猜，要查舊專案實測值。
```

### 貼圖 / 降噪 / edge marker

```
讀：
  - `R2-5 補完｜門貼圖實作 + 框架降噪導致所有貼圖模糊`
  - `R2-6｜喇叭貼圖水平方向被壓窄 + 白色角落`
  - `R2-12 GIK 吸音板側面 LOGO 穿幫`
  - `R2-13｜牆↔牆共邊 raw noise 永存`

適用：
  - 產品圖比例錯、白邊、LOGO 穿幫。
  - 貼圖表面被降噪糊掉。
  - 牆面共邊出現 raw noise。
```

---

## 歷史章節群

這些章節通常不需要接手時先讀，除非任務直接碰到對應區域。

```
R2 幾何與互動：
  - R2-3 牆面 Box 幾何
  - R2-4 攝影機 Preset 切換
  - R2-8 Config 切換殘留
  - R2-11 Cam 殘影、Bloom、samplesPerFrame UI
  - R2-13 牆面色差、共邊 raw noise、X-ray 外延
  - R2-15 / R2-17 燈具與 Cloud 可見幾何

R3 燈光與 MIS：
  - R3-1 uniform 宣告順序
  - R3-4 軌道燈量綱
  - R3-5b Cloud NEE
  - R3-6 / R3-6.5 Many-Light 與廣角燈 tilt
  - R3-7 / R4-3 追加 N-bounce 演進

R6 視覺收斂：
  - R6-LGG 借光、白平衡、per-config state
  - R6-3 Phase2 Cloud probe 全系列
  - R6 movement protection v19 到 v22c

R7 採樣升級：
  - R7-1 blue noise seed mix no-go
  - R7-2 light importance sampling 已驗收，但快速預覽主痛點未解
  - R7-3 quick preview terminal fixed curve 目前接手點
  - R7-Bake-Probe / R7-3.5 已排在 R7-4 ReSTIR、R7-5 path guiding 前；先驗高 SPP 表面光照輸出能否給快速預覽讀取
  - R7-3.8 C1 1000SPP bake capture 已建立 Codex runner、surface spec、512 atlas package；讀 `Debug_Log.md` 的 `R7-3.8-c1-1000spp-bake-capture-package`
  - R7-3.8 C1 floor-center paste preview 已把正式 atlas 貼回 C1 畫面；讀 `Debug_Log.md` 的 `R7-3.8-c1-bake-floor-patch-paste-preview`
  - R7-3.8 C1 diffuse-only paste fix 已移除 floor patch 內的 ceiling-lamp reflection spike，補休眠 framePending=false、keyboard idle、snapshot UI、1000SPP 顯示、floor roughness UI 驗證；後續使用者肉眼確認 350SPP 已難見界線、1000SPP 隱形，diffuse bake 架構通過 floor-center patch 驗收，反射另開處理線；讀 `Debug_Log.md` 的 `R7-3.8-c1-bake-diffuse-paste-fix1`
  - R7-3.9 C1 accurate reflection bake 已新增 accuracy_over_speed surface spec、1000SPP C1 visible-direction floor reflection package、runtime loader、preview test；目前 accepted package 使用原始地板反射粗糙度 0.1 且只替換地板，鐵門、喇叭架、喇叭箱維持 live reflection；讀 `Debug_Log.md` 的 `R7-3.9-c1-accurate-reflection-bake`
```

---

## 寫回規則

```
1.  新增量測或使用者回報數字：
    寫進目前 R 階段 MD 與 `Debug_Log.md`。

2.  新 no-go：
    寫進目前 R 階段 MD、`Debug_Log.md`，並在本索引對應路由補一句。

3.  新常見地雷：
    若是跨階段規則，補到本檔「永久必讀」或對應觸發式路由。

4.  單次工具輸出、暫存 PNG、CDP JSON：
    放總帳章節即可，索引只留結論與讀取入口。
```
