# REPORT — R6-3 Phase 0 accumulation / resolve / screen output pipeline review

> Date: 2026-05-01
> Parent report: `.omc/REPORT-R6-3-Phase0-initial-convergence-triage.md`
> Focus: 第一優先 code review：讀目前累積 / resolve / screen output pipeline。
> Scope: 只讀 code 與整理 plan；未修改 shader / JS / BVH / 採樣演算法。

---

## 0. 本次讀到的核心檔案

```
js/InitCommon.js
js/PathTracingCommon.js
shaders/ScreenCopy_Fragment.glsl
shaders/ScreenOutput_Fragment.glsl
shaders/Bloom_Brightpass_Fragment.glsl
js/Home_Studio.js
```

---

## 1. 現有畫面管線

目前主畫面是典型 ping-pong accumulation：

```
PathTracing pass:
  previous sum texture + current sample
  -> pathTracingRenderTarget

ScreenCopy pass:
  pathTracingRenderTarget
  -> screenCopyRenderTarget
  -> 下一 frame 當 tPreviousTexture

ScreenOutput pass:
  pathTracingRenderTarget
  -> 37-tap edge-aware blur / resolve
  -> 除以 sampleCounter
  -> bloom composite
  -> exposure / saturation / tonemap / gamma / LGG / WB / Hue
  -> screen
```

重要細節：

```
pathTracingRenderTarget / screenCopyRenderTarget 是 RGBA FloatType。
RGB 儲存的是「累積總和」，不是已平均顏色。
A 通道儲存 edge / sharpness flag，用於 screen resolve。
```

---

## 2. accumulation 目前怎麼做

`js/PathTracingCommon.js` 的 `pathtracing_main` 末端：

```glsl
currentPixel = CalculateRadiance(...);
previousPixel = texelFetch(tPreviousTexture, pixel);
pc_fragColor = vec4(previousPixel.rgb + currentPixel.rgb, currentPixel.a);
```

也就是：

```
累積 buffer = 前一張累積總和 + 這一 frame 的單樣本 radiance
```

最後平均不是在 path tracing pass 做，而是在 screen output：

```glsl
filteredPixelColor *= uOneOverSampleCounter;
```

推論：

```
如果某一個 currentPixel.rgb 是高亮離群值，它會永久進入 sum。
後面只能靠 sampleCounter 變大慢慢稀釋。
這解釋了 48 spp 後 firefly / 高亮光斑拖很久的現象。
但這屬第二優先，不是本輪第一刀。
```

---

## 3. camera moving / reset 現況

`js/InitCommon.js` 每 frame 會先把 `cameraIsMoving = false`，再由 resize / sceneParamsChanged / input / GUI 等重新拉起。

靜止時：

```js
sampleCounter += 1.0;
```

移動時：

```js
uPreviousSampleCount = sampleCounter;
sampleCounter = 1.0;
```

`pathtracing_main` 在移動或剛移動後會做舊圖 / 新 sample 各 0.5 的 blend：

```glsl
if (uFrameCounter == 1.0) {
  previousPixel.rgb *= (1.0 / uPreviousSampleCount) * 0.5;
  currentPixel.rgb *= 0.5;
}
else if (uCameraIsMoving) {
  previousPixel.rgb *= 0.5;
  currentPixel.rgb *= 0.5;
}
```

另外某些切換會直接清空兩個 ping-pong buffer：

```js
needClearAccumulation = true;
renderer.clear(pathTracingRenderTarget);
renderer.clear(screenCopyRenderTarget);
sampleCounter = 1.0;
```

例子：

```
camera preset 切換
config 切換
active light LUT rebuild
```

推論：

```
目前已有非常簡單的 temporal blend，但沒有重投影。
清空 buffer 的切換會從 1 spp 重新開始，因此 C3 1~48 spp 初始爆噪仍會直接暴露。
```

---

## 4. screen output resolve 現況

`shaders/ScreenOutput_Fragment.glsl` 會讀 37 個鄰近 texel：

```glsl
m37[0..36] = texelFetch(tPathTracedImageTexture, neighbor);
```

流程：

```
1. 先做大範圍 edge-aware blur。
2. 如果遇到 edge flag，就停止跨邊混合。
3. 對 edge pixel 再做較小 13-tap kernel。
4. 靜態場景中，edge pixel 會隨 sampleCounter 逐步回到 centerPixel。
5. 最後乘 uOneOverSampleCounter。
```

推論：

```
這裡已經是 preview-only resolve 的自然插入點。
優點：不碰 path tracing 物理計算；可以只影響螢幕輸出。
風險：它目前只看 alpha edge flag，沒有 depth / normal / object id buffer 可供更準的 SVGF / reproject。
```

---

## 5. bloom 不是主畫面解法

`shaders/Bloom_Brightpass_Fragment.glsl` 已經有 Karis average：

```glsl
w = 1.0 / (1.0 + luma);
```

它的註解也明確說是為了避免 path tracer firefly 把 bloom mip 染白。

推論：

```
Bloom pass 已有防 firefly 的局部處理。
但這只救 bloom，不會讓主畫面本體變乾淨。
所以 R6-3 不應把 bloom brightpass 當成 C3 初始爆噪的主要解法。
```

---

## 6. 目前缺什麼資料

若要做完整 SVGF / reproject，通常需要：

```
previous camera matrix
current/previous depth
normal buffer
motion vector 或 world position
material/object id
variance / moments buffer
history length / validity mask
```

目前這輪第一優先讀到：

```
主 accumulation target 只有 RGBA float。
RGB = radiance sum。
A = edge / sharpness flag。
未看到獨立 depth / normal / motion / variance history buffer。
```

推論：

```
完整 SVGF / 幾何重投影不是「直接插一段 shader」就能做。
若要做，需先擴充 G-buffer / history buffer，工程量較大。
```

---

## 7. 可插入點評估

### A. ScreenOutput preview-only resolve

位置：

```
shaders/ScreenOutput_Fragment.glsl
```

用途：

```
只在低 sampleCounter，例如 1~48 或 1~100 spp，增加更積極的 screen-space denoise。
```

優點：

```
不改 path tracing accumulation。
不破壞 1024+ spp 的主觀色彩。
符合 MD 第一優先：先救快速預覽初始爆噪。
```

風險：

```
只有 screen-space 鄰域資訊，容易糊邊。
需要受 edge flag / sampleCounter 控制，避免高 spp 還在抹細節。
```

### B. Temporal display buffer

位置：

```
新增或複用 screen-level postprocess ping-pong target。
```

用途：

```
對「螢幕最後顯示結果」做 preview-only temporal blend。
```

優點：

```
可降低 1~48 spp 閃爍。
比完整 reproject 簡單。
```

風險：

```
沒有 motion vector / depth 時，camera 或 scene 切換會有殘影。
必須嚴格受 reset / cameraIsMoving / sampleCounter 控制。
```

### C. Full SVGF / reproject

位置：

```
需要新增 G-buffer / history buffer / variance pass。
```

優點：

```
方向最完整。
長期可同時改善初期爆噪與部分尾端收斂。
```

風險：

```
工程量大。
需要重新設計多個 render target。
目前不適合作為 R6-3 第一個最小實作。
```

---

## 8. 建議第一個小實作方向

建議先做：

```
preview-only ScreenOutput early-spp denoise gate
```

基本策略：

```
只在 sampleCounter <= 48 或 <= 100 時啟用。
只作用在 ScreenOutput resolve，不回寫 accumulation sum。
高 spp 自動淡出，避免改變最終收斂色彩。
沿用現有 edge flag，避免跨物體邊界糊掉。
```

這符合：

```
1~48 spp：初始爆噪 -> 先救觀感。
48 spp 後 firefly 拖尾 -> 留給第二優先 radiance / firefly path review。
```

---

## 9. 下一步小 plan

實作前建議先寫一個更小的 patch plan：

```
1. 在 ScreenOutput_Fragment.glsl 設計 earlySampleWeight：
   sampleCounter 低時權重高，48/100 spp 後淡出。

2. 在現有 37-tap resolve 結果與 centerPixel 之間重新調配：
   low spp 偏向 denoised filteredPixelColor；
   high spp 偏向現有邏輯。

3. edge pixel 保守處理：
   centerPixel.a == 1.0 或 nextToAnEdgePixel 時降低 denoise 強度。

4. 不碰 PathTracingCommon accumulation：
   避免把 preview-only 視覺處理寫回 sum。

5. 驗證 C3 bounce14：
   對比 1 / 8 / 16 / 24 / 32 / 48 / 64 / 100 spp。
```

守門：

```
不要在這一刀做 full SVGF。
不要在這一刀做 firefly clamp。
不要改變 accumulation sum 的物理資料。
不要把 C3 / C4 混成同一個問題。
```
