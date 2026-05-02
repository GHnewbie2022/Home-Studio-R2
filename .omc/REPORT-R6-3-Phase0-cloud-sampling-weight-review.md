# REPORT — R6-3 Phase 0 Cloud sampling / weight review

> Date: 2026-05-01
> Parent reports:
> - `.omc/REPORT-R6-3-Phase0-initial-convergence-triage.md`
> - `.omc/REPORT-R6-3-Phase0-accum-resolve-pipeline-review.md`
> Focus: 第二層 code review：盡量不走降噪，先檢查 C3 Cloud 光源取樣 / PDF / radiance / early-spp sample pattern。
> Scope: 只讀 code 與整理 plan；未修改 shader / JS / BVH / 採樣演算法。

---

## 0. 本次讀到的核心檔案

```
shaders/Home_Studio_Fragment.glsl
js/Home_Studio.js
js/PathTracingCommon.js
js/InitCommon.js
```

---

## 1. C3 Cloud 光源目前怎麼表示

C3 是只開 Cloud 漫射燈。JS 端 Cloud 燈條是 4 支細長 rod：

```
E / W：長 2.4m
S / N：長 1.768m
截面厚度：16mm x 16mm
```

對應資料：

```
js/Home_Studio.js
  CLOUD_ROD_LUMENS
  CLOUD_ROD_FACE_AREA
  CLOUD_FACE_COUNT = 2
  CLOUD_ROD_CENTER
  CLOUD_ROD_HALF_EXTENT
```

Shader 端 active light pool 在 C3 只會放 Cloud slots：

```
uActiveLightIndex = [7, 8, 9, 10]
uActiveLightCount = 4
```

也就是每次 NEE 只從 4 支 Cloud rod 中抽 1 支。

---

## 2. C3 早期爆噪的非降噪疑點

### A. 1~48 spp 可能有 light coverage 不足

目前 `sampleStochasticLightDynamic()` 用：

```glsl
int slot = int(floor(rng() * float(uActiveLightCount)));
```

C3 只有 4 支 Cloud rod，因此每個 diffuse hit 每次只隨機抽 1 支。

推論：

```
1~48 spp 時，每個 pixel 對 4 支 rod 的覆蓋可能不均。
某些 pixel 早期可能連續抽到不利 rod / 不利位置，造成全圖高變異。
```

不靠降噪的改善方向：

```
早期 sample 使用 stratified light selection。
例如 C3 activeLightCount=4 時，讓前幾個 spp 更平均覆蓋 4 支 rod。
```

---

### B. Cloud 目前是 1D long-axis jitter，不是真正 2D 面取樣

Cloud NEE 現在建立一個 diagonal Lambertian 方向：

```glsl
faceNormal = 45-degree outer/up normal
faceOffset = rod outer-top edge
longAxisJitter = rng() * 2.0 - 1.0
cloudTarget = rodCenter + faceOffset + longAxisOffset
```

也就是 sample target 在「外上棱線」上沿長軸 jitter。

推論：

```
這比較像線光源 / 棱線取樣，不是完整面光源取樣。
它避免了舊 2-face 方案的硬斑，但早期 sample 仍可能因目標點集中在一條線上而高變異。
```

不靠降噪的改善方向：

```
把 Cloud target 從 1D long-axis jitter 升成 virtual diagonal rectangle 的 2D stratified sample。
一軸沿 rod 長度，一軸沿 45-degree diagonal width。
```

---

### C. throughput 面積與 MIS PDF 面積不一致

Cloud NEE throughput 用：

```glsl
throughput = cloudEmit * cloudGeom * uCloudFaceArea[rodIdx] * uCloudFaceCount / selectPdf;
```

其中：

```
uCloudFaceCount = 2
```

但 MIS PDF 用：

```glsl
cloudDiagArea = uCloudFaceArea[rodIdx] * sqrt(2)
pdfNeeOmega = pdfNeeForLight(..., cloudDiagArea, selectPdf)
```

註解也寫到：

```
throughput 的 x2 係保守偏亮 ~1.4x 容忍區間。
```

推論：

```
這不一定是單一 bug，因為它可能是舊視覺校準留下的能量補償。
但對 MIS heuristic 來說，throughput 的有效面積與 PDF 的面積不一致，會讓 NEE / BSDF 命中 emitter 的權重不完全對稱。
這可能增加早期變異，也可能影響 48 spp 後尾端亮點。
```

不靠降噪的改善方向：

```
先做一個 no-op / diagnostic plan，確認：
1. throughput area 是否應改為 cloudDiagArea。
2. computeCloudRadiance 是否應跟 virtual diagonal area 同步重算。
3. 若保留 x2 視覺補償，MIS PDF 是否也要用同一個 effective area。
```

---

### D. primary / specular Cloud hit 有 clamp，但 NEE path 靠 baked mask

Cloud emissive direct/specular hit：

```glsl
emission = min(uCloudEmission[rodIdx], vec3(uEmissiveClamp));
accumCol = min(mask * emission, vec3(uEmissiveClamp));
```

Cloud NEE hit：

```glsl
accumCol += mask * wNee;
```

因為 NEE path 的 emission 已經 baked 在 `mask *= weight`。

推論：

```
NEE path 沒有在 hit branch 重新乘 emission 是正確契約。
但真正高亮來源會在 sampleStochasticLightDynamic() 的 weight 形成時進入 mask。
如果要處理 48 spp 後 firefly，第二優先應回到 weight / throughput 進入 mask 前處理。
```

本輪守門：

```
這屬 firefly clamp / weight clamp，先記錄，不作為第一個實作。
```

---

## 3. random / sample pattern 現況

Pixel jitter：

```glsl
if (uSampleCounter < 50.0)
  pixelOffset = tentFilter(rand()), tentFilter(rand())
else
  pixelOffset = tentFilter(uRandomVec2.x), tentFilter(uRandomVec2.y)
```

其中 `rand()` 由 blue noise + frameCounter golden ratio 演進。

Cloud light selection / long-axis jitter 使用 `rng()`。

推論：

```
1~48 spp 問題剛好落在 uSampleCounter < 50 的 early sampling 區。
目前 early pixel jitter 有 blue-noise-ish 設計，但 Cloud light selection 還是純 rng。
因此可以優先試「只改 light selection / Cloud target stratification」，不用碰 ScreenOutput denoise。
```

---

## 4. 建議非降噪優先順序

### 第一候選：C3 early-spp stratified light selection

目標：

```
在 C3 activeLightCount=4 時，讓低 spp 更平均抽到 4 支 Cloud rod。
```

可能策略：

```
slot = (base + sampleIndex + pixelHash) mod activeLightCount
```

或：

```
前 48 spp 使用低差異 sequence 選 slot；
48 spp 後回到現有 rng。
```

優點：

```
不模糊。
不改 screen resolve。
不動 accumulation。
理論上直接改善 1~48 spp 光源覆蓋。
```

風險：

```
若 pattern 設計不好，可能產生規律條紋或格狀 pattern。
需要用 C3 bounce14 1/8/16/24/32/48 spp 截圖肉眼驗證。
```

---

### 第二候選：Cloud target 2D stratification

目標：

```
把 Cloud target 從 1D 棱線 jitter 改為 virtual diagonal rectangle 的 2D sample。
```

優點：

```
更接近面光源。
可能降低局部亮斑與早期高變異。
```

風險：

```
會改變 Cloud 光形。
需要使用者肉眼確認 Cloud 光是否仍符合「漫射燈」觀感。
```

---

### 第三候選：Cloud effective area / PDF 一致化

目標：

```
整理 throughput area、computeCloudRadiance 分母、MIS pdf area 的三方契約。
```

優點：

```
更物理一致。
可能降低 MIS 權重不對稱。
```

風險：

```
可能改變整體亮度。
如果以前是靠 x2 視覺補償調到可用，改掉後可能需要重新校準 Cloud 亮度。
```

---

### 暫不作為第一刀：ScreenOutput denoise

理由：

```
使用者明確偏好先找非降噪方法。
Screen-space denoise 有糊邊風險。
只有在 sampling / weight / PDF 方向走不通時，再回頭考慮。
```

---

## 5. 建議下一步小 plan

先產出 patch plan，不直接改 shader：

```
Plan A：C3 early-spp stratified light selection

1. 只在 uActiveLightCount == 4 且 sampleCounter <= 48/64 時啟用。
2. 僅改 sampleStochasticLightDynamic() 的 slot 選擇，不改 Cloud 能量公式。
3. slot 選擇需混入 pixel hash，避免全畫面同 spp 抽同一支 rod。
4. 48/64 spp 後回到現有 rng selection。
5. 驗證節點：C3 bounce14 1 / 8 / 16 / 24 / 32 / 48 / 64 / 100 spp。
```

若 Plan A 有改善且無規律 pattern，再評估：

```
Plan B：Cloud target 2D stratification。
Plan C：Cloud effective area / PDF 一致化。
```

守門：

```
不要先做降噪。
不要先做 full SVGF / reproject。
不要先做 firefly clamp。
不要把 C3 / C4 混為同一問題。
任何 shader 實作前，先讓使用者確認小 patch plan。
```
