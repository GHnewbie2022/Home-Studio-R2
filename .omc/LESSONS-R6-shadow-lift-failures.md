# Lessons — R6 陰影補光（Shadow Lift）全路線失敗紀錄

> Date: 2026-04-30
> Status: 所有以「亮度（luma）」為依據的陰影補光路線在 Home_Studio 場景全數失敗。
>          已決定 pivot 到 PS / LR 風格的後製調色面板，由使用者手動決定如何提亮。
>
> **Update 2026-04-30 後續**：使用者選定風格 D（DaVinci LGG），並要求加 ACES Filmic
> 色調映射 toggle。實作已落地（驗證網址 ?v=r6lgg01-davinci-aces）。
> 5 條陰影補光滑桿、相關 uniform、bloom mip 借用全部拆除。
> 保留：postProcessChanged 機制、wakePostProcess()、sat-a/sat-b 兩條飽和度滑桿。
> alpha 物件保護未沿用至 LGG（LGG 為全域調色，無物件區隔需求）。
>
> **Update 2 2026-04-30 LGG-r14 final**（甜蜜點 locked）：
> - A 模 ACES SAT 三條（暗中亮）合成 1 條 GLOBAL SAT slider，B 模同步合一（單一條同步寫 3 個 uniform）。
> - 新增 EXP（pre-tonemap HDR 線性曝光），A/B 各自獨立 slider（E2 路線）。
> - EXP gate 在 uACESEnabled — ACES 關閉時 EXP 與 ACES SAT 雙雙失效，回到純 Reinhard 對照基準。
> - 甜蜜點 locked 為預設：
>   - A：chkAces=on、ACES%=0.20、SAT=0.90、EXP=0.90
>   - B：chkAces=on、ACES%=0.30、SAT=0.90、EXP=0.80、chkLgg=on、LGG%=0.50、Lift=-0.10、Gamma=1.00、Gain=1.00
> - 備份標記：`*.r6lgg14-bak`（4 檔：ScreenOutput shader、Home_Studio.js、InitCommon.js、Home_Studio.html）。
> - 詳見 `.omc/HANDOFF-R6-aces-lgg-pending.md`。
>
> **Update 3 2026-05-01 LGG-J3 暗角借光 r29 final**（深暗角真光問題收尾）：
> - 走 J3 雙 buffer 路線：1/8 res 14 彈借光 buffer 並行於主 4 彈 pass，主 path tracer 在 reachedMaxBounces 時讀借光值補暗角。
> - 13 輪 debug 後最終修法（r29）：拆 darkGate（per-frame stochastic gate 平均後產生空間 banding），只留 positionGate(borrow_luma) 收緊到 (0.0, 0.3)。
> - 詳細失敗時序、根因、教訓寫在 `docs/SOP/Debug_Log.md` 的「R6-LGG-J3」章節。
> - 新增 UI：B 模「暗角借光」slider（slider-borrow-strength-b），範圍 0~2.0，預設 0.5。
> - 新增 uniforms：tBorrowTexture、uBorrowStrength、uIsBorrowPass。
> - 新增 render targets：borrowPathTracingRenderTarget + borrowScreenCopyRenderTarget（1/8 res ping-pong）。
> - PathTracingCommon.js pathtracing_main chunk 加 source-side firefly clamp（uIsBorrowPass > 0.5 時 currentPixel.rgb min(1.0)）。
> - 備份標記：`*.r6lgg29-bak`（6 檔：兩 shader + 三 JS + HTML）。
>
> **Hard Rule（從本輪 13 連敗淬鍊）**：
> - 必先 isolation test（最小變因 set strength=0、AB 切換對比）鎖根因再動工，禁瞎猜瞎改
> - per-frame stochastic gate 嚴禁用作 spatially-variant 條件，多 frame 平均後 E 值會形成空間結構造成 banding
> - blur 上游須先 source clamp 防 spike，否則 blur 把 spike 抹大、視覺更糟
> - 速度優化嚴禁在功能/正確性未驗證收斂前先做，副作用跟既有 bug 互疊難 debug

---

## 失敗時序

### 嘗試 1 — R6-sat05：path-tracer ambient injection（已棄）

- **位置**：`Home_Studio_Fragment.glsl`、每個 diffuse 散射分支
- **公式**：`accumCol += mask * vec3(uAmbientFloor)`（10 處注入點）
- **症狀**：強度 0.10 已造成牆面被「暴力刷白」
- **量化根因**：
  ```
  4 彈在白牆上 mask 等比 ≈ 0.85 + 0.72 + 0.61 + 0.52 ≈ 2.7 倍
  ambient 0.10 × 2.7 = 0.27 絕對亮度
  牆面原亮度約 0.6 → 增量 32~50% → 視覺刷白
  ```
- **物理錯誤**：違反 Phong `k_a × I_a` 「環境光該獨立於彈跳次數」原則。每彈乘上 mask（含表面反射率）讓 ambient 被 geometric series 放大。
- **處置**：拆掉整套（uniform + 10 處注入點 + UI slider）

### 嘗試 2 — Route X v1：HDR-space exponential decay（已棄）

- **位置**：`ScreenOutput_Fragment.glsl`、tonemap 之前
- **公式**：`lift = uShadowLift * exp(-lumaPre / uShadowLiftKnee)`
- **症狀**：強度 0.03 即出現刷白感
- **根因**：HDR linear space 與 display space 的亮度刻度錯位
  ```
  顯示亮度 0.50 ≈ HDR 0.067
  顯示亮度 0.15 ≈ HDR 0.005
  knee=0.15 在 HDR 空間實際涵蓋顯示空間的「中灰以上」
  → 半亮區也被波及
  ```
- **處置**：搬到 gamma 之後（display-referred）

### 嘗試 3 — Route X Plan A：display-space exponential decay（已棄）

- **位置**：`ScreenOutput_Fragment.glsl`、gamma 之後
- **公式**：`lift = uShadowLift * exp(-lumaDisplay / uShadowLiftKnee)`
- **症狀（使用者回報）**：
  - KH150 / KH750 喇叭被刷白
  - 灰色 GIK 吸音板被刷白
  - 桌下接觸陰影被刷白
  - Cloud 結構中央被刷白
  - 真正想補的地板廣域陰影、牆壁陰影沒效果
- **根因**：luma 訊號無法區分「黑色物件」與「白色物件在陰影中」
  ```
  KH150 表面 luma ≈ 0.18（深灰物件）→ 公式判定為「陰影」→ 滿補
  牆壁陰影 luma ≈ 0.30（中間調）→ 公式判定為「半亮」→ 少補
  ```

### 嘗試 4 — alpha 物件保護（部分成功）

- **修補**：補光區塊條件加 `&& centerPixel.a < 1.0`
- **依據**：`centerPixel.a == 1.0` 是 walk denoiser 的「鋒利物件標記」（家具/喇叭/燈具/貼圖）
- **成功部分**：
  - KH150 / KH750 喇叭排除 ✓
  - 軌道燈 / COB 燈 / 螢幕 / 其他家具排除 ✓
- **失敗部分**：
  - 桌下陰影仍被刷白（floor 表面 alpha < 1.0）
  - Cloud 中央仍被刷白（ceiling alpha < 1.0）
- **根因**：alpha 標記只區分「鋒利物件 vs 平滑表面」，無法區分「平滑表面在亮處 vs 平滑表面在接觸陰影中」

### 嘗試 5 — 5 滑桿 Bandpass（已棄）

- **公式**：
  ```
  lift = uShadowLift × smoothstep(deepLow, deepProtect, luma) × exp(-(luma - deepProtect) / knee)
  ```
- **滑桿**：強度 / 深陰影保護 / 保護軟膝 / 亮端軟膝 / 純白比例
- **使用者回饋**：「效果都不太好」
- **根因（推測）**：本場景的「想提亮的陰影 luma」與「想保護的接觸陰影 luma」在分佈上重疊。任何單變量（luma）的分類器都無法精確區分，曲線形狀調整無濟於事。

---

## 共同根因

luma-based shadow detection 在本場景失效，因為「亮度低 = 陰影」假設不成立：

```
 黑色物件     luma 低     不是陰影      不該補
 接觸陰影     luma 低     是陰影但物理上應留     不該補
 廣域陰影     luma 中     是陰影想被補         該補
 半亮區       luma 中     非陰影              不該補
```

四類目標的 luma 區間嚴重重疊。要精確分類需要 luma 以外的訊號（depth / normal / AO term / object id），這些訊號在純後製階段無法取得。

---

## Hard Rules（新增，禁止違反）

```
 DO NOT 嘗試 luma-based shadow detection 作為陰影提亮的唯一依據
   不論 HDR space / display space / bandpass / 任何曲線形狀
   本場景的 luma 分佈不足以區分目標區域與保護區域

 DO NOT 重啟 path-tracer-side ambient injection
   geometric series 必導致牆面刷白（已驗證）

 DO NOT 在後製階段嘗試「自動偵測陰影」
   後製只有 luma + alpha sharp flag 兩個訊號
   兩者皆不足以做精確陰影分類

 DO NOT 重做 R6 sat05 / Route X v1 / Plan A / Bandpass 的等價路線
   每條路線的失敗模式都已驗證並紀錄於本檔
```

---

## 程式碼現況（2026-04-30）

5 滑桿 bandpass 實作仍在原位、等使用者決定是否拆除：

```
 uniforms（screenOutputUniforms）
   uShadowLift               強度
   uShadowLiftDeepProtect    深陰影保護門檻
   uShadowLiftDeepKnee       保護軟膝寬度
   uShadowLiftKnee           亮端軟膝
   uShadowLiftAutoBlend      純白比例
   tBloomLowMipTexture       借 bloomMip[6] 的色相來源

 sliders（B 模式 group-b-controls）
   slider-lift-b
   slider-lift-deep-b
   slider-lift-deep-knee-b
   slider-lift-knee-b
   slider-lift-blend-b

 機制（保留，未來新方案可繼承）
   alpha 物件保護           centerPixel.a < 1.0 gate
   postProcessChanged       後製滑桿不重啟累積
   wakePostProcess()        後製專用喚醒函式
   bloom 鏈 || lift > 0     bloom mip 借用時必跑
```

備份位置（Route X v1 HDR-space 版本，作為 fallback）：

```
 shaders/ScreenOutput_Fragment.glsl.routeXa-bak
 shaders/Home_Studio_Fragment.glsl.routeXa-bak
 js/InitCommon.js.routeXa-bak
 js/Home_Studio.js.routeXa-bak
 Home_Studio.html.routeXa-bak
```

---

## 未來展望：Pivot to PS / LR-style Tone Panel

放棄「自動偵測陰影」這個目標，改提供完整後製調色工具，由使用者手動決定提哪邊壓哪邊。

候選風格（待使用者選定）：

```
 風格 A — LR 4 條（推薦）
   曝光 / 對比 / 高光 / 陰影
   理由：音樂製作人對 LR 概念熟、4 條覆蓋 90% 後製需求

 風格 B — LR 6 條（完整）
   曝光 / 對比 / 高光 / 陰影 / 白色 / 黑色

 風格 C — PS Levels（簡單）
   黑點 / 白點 / Gamma

 風格 D — DaVinci LGG（影像業界標準）
   Lift / Gamma / Gain
```

實作前應確認：

```
 1. 風格 A / B / C / D 哪個
 2. 現有 5 條陰影補光滑桿 + uniforms 全拆 or 部分保留
 3. alpha 物件保護是否套用至新調色面板
 4. A 模式（趨近真實）是否允許調色
```

---

## 驗證網址歷史

```
 ?v=r6lift01-postprocess         嘗試 2（HDR-space exp）
 ?v=r6lift02-displayspace        嘗試 3（display-space exp / Plan A）
 ?v=r6lift03-no-reset            postProcessChanged 機制
 ?v=r6lift04-postprocess-no-reset    sat 兩條改 wakePostProcess
 ?v=r6lift05-object-mask         alpha 物件保護
 ?v=r6lift06-bandpass            5 條滑桿 bandpass
```

---

## 相關檔案

- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-ambient-pivot-to-postprocess.md`（已標註本檔為後續主檔）
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-ui-saturation-pending.md`（早期 R6 UI 工作紀錄）
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/FINDING-R6-supersampling-discovery.md`（R6 超採樣發現）

修改的程式檔：

- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/Home_Studio.html`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/js/Home_Studio.js`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/js/InitCommon.js`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/shaders/Home_Studio_Fragment.glsl`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/shaders/ScreenOutput_Fragment.glsl`
