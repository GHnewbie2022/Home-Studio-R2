# R6-3 v20：Movement Protection SOP

## 目標

降低移動期間的低 SPP 噪點遮擋，讓使用者移動視角時仍看得清楚。

v19 first-frame burst 已解掉 1 SPP 黑幕，但 4 SPP 畫面仍然太髒。v20 不追求增加第一張 SPP，而是保護移動期間的可視性。

## 參考架構

```
1. three.js WebGPU SSGI
   參考：
     https://github.com/mrdoob/three.js/blob/master/examples/webgpu_postprocessing_ssgi.html

   可借用概念：
     MRT / velocity / temporal AA
     使用上一幀資訊穩定畫面

2. three.js WebGPU AO
   參考：
     https://github.com/mrdoob/three.js/blob/master/examples/webgpu_postprocessing_ao.html

   可借用概念：
     half-resolution effect
     temporal filtering

3. three.js lightmap
   參考：
     https://github.com/mrdoob/three.js/blob/master/examples/webgpu_materials_lightmap.html

   可借用概念：
     靜態場景可保存較乾淨的光照結果
```

## 導入順序

```
1. 總開關與量測框架

   目標：
     可以一鍵開關 v20 movement protection。
     Console 可回報模式、穩定畫面狀態、混合強度。
     靜止後最終畫面維持原本 path tracing 收斂。

   驗收：
     setMovementProtectionConfig({ enabled: false })
     setMovementProtectionConfig({ enabled: true })
     reportMovementProtectionConfig()


2. 保存上一張穩定畫面

   目標：
     相機靜止且 sampleCounter 達到門檻後，保存目前 ScreenOutput 結果。

   預設門檻：
     minStableSamples = 16

   驗收：
     reportMovementProtectionConfig().stableReady === true


3. 移動時混入上一張穩定畫面

   目標：
     保留穩定畫面混合能力，供 Console 手動診斷 4 SPP 噪點遮擋。
     新累積畫面仍會繼續更新，停止移動後回到正常收斂。

   預設：
     movingBlend = 0.0
     spatialPreviewStrength = 0.0
     widePreviewStrength = 0.95

   驗收：
     預設移動時沒有舊視角殘影。
     需要 A/B 時才用 setMovementProtectionConfig({ movingBlend: 0.45 }) 手動打開。


4. edge / normal 保護

   目標：
     若第 3 步有殘影，先用現有 alpha edge channel 降低邊緣混合。

   啟動條件：
     第 3 步肉眼有效，但牆角、物件邊界有拖影。


5. depth / velocity 類判斷

   目標：
     讓大幅移動時自動降低舊畫面比例。

   啟動條件：
     第 4 步仍有明顯錯位，且 movement protection 已被使用者判定值得繼續。
```

## v20 首輪範圍

```
本輪實作：
  1. 總開關與量測框架
  2. 保存上一張穩定畫面
  3. 移動時混入上一張穩定畫面

本輪暫緩：
  4. edge / normal 保護
  5. depth / velocity 類判斷
```

## v20a 修正

```
使用者回報：
  v20 開啟後，4 SPP 仍然很髒。

根因：
  首輪 v20 已經能保存穩定畫面。
  移動開始時 accumulation reset 又把 stableReady 清掉。
  Step 3 顯示合成又吃到 first-frame burst 的 activeRenderCameraMoving=false。
  結果是移動期間 uMovementProtectionBlend 保持 0。

修正：
  1. movementProtectionPreserveStableAcrossCameraReset = true。
  2. 移動清除與 first-frame 清除期間保留上一張穩定畫面。
  3. Step 3 用實際 cameraIsMoving 決定 movement protection blend。
  4. 停止移動後才更新穩定畫面。

驗證：
  CDP movement-check 顯示：
    before move:
      stableReady = true
      lastBlend = 0
      lastCaptureSamples = 21

    during move:
      cameraIsMoving = true
      currentSamples = 4
      lastBlend = 0.65
      stableReady = true
```

## v20b 修正

```
使用者回報：
  配置 1 移動時，4 SPP 變得超暗。

根因：
  v20a 保留穩定畫面的範圍太大。
  配置切換、視角按鈕、燈光池重建、參數變動都沿用上一張穩定畫面。
  移動時混入舊狀態，配置 1 會被舊暗圖壓低亮度。

修正：
  1. 新增 invalidateMovementProtectionStableFrame(reason)。
  2. applyPanelConfig 會清掉舊穩定圖。
  3. switchCamera 會清掉舊穩定圖。
  4. rebuildActiveLightLUT 會清掉舊穩定圖。
  5. sceneParamsChanged 會清掉舊穩定圖。
  6. 一般滑鼠移動仍保留穩定圖，維持 4 SPP movement protection。

驗證：
  CDP movement-check / config 1 / cam1：
    before move:
      stableReady = true
      lastBlend = 0
      lastCaptureSamples = 20

    during move:
      cameraIsMoving = true
      currentSamples = 4
      stableReady = true
      lastBlend = 0.65
      meanLuma(full) = 141.035252
      veryDarkRatio(full) = 0
```

## v20c 修正

```
使用者回報：
  v20b 後，配置 1 移動時 4 SPP 仍然超暗。

判讀：
  配置 1 / 2 不是 R6-3 movement protection 的主要痛點。
  這兩個配置套 movement protection 會增加混合風險。

修正：
  1. movementProtectionConfigAllowed() 只允許配置 3 / 4。
  2. 配置 1 / 2 移動時 uMovementProtectionBlend 固定為 0。
  3. reportMovementProtectionConfig() 新增 configAllowed。

驗證：
  CDP movement-check / config 1 / cam1：
    movementProtection.version = r6-3-phase2-movement-protection-v20c
    configAllowed = false
    during move lastBlend = 0
    during move meanLuma(full) = 140.744454
    during move veryDarkRatio(full) = 0
```

## v20d 修正

```
使用者回報：
  C3 / C4 也是 4 SPP 超暗，不能只排除 C1 / C2。

根因：
  C3 / C4 切換後立刻移動時，還沒有 Samples >= 16 的穩定畫面。
  v20 / v20a / v20b 的 history mix 路線無圖可混，最後仍顯示原始 4 SPP 暗畫面。

修正：
  1. C3 / C4 移動中新增 low-SPP preview fallback。
  2. 即使 stableReady = false，也會用 display-space preview curve 提亮可視性。
  3. 有穩定畫面時仍保留原 history mix。
  4. C1 / C2 繼續不跑 movement protection。

預設：
  movementProtectionLowSppPreviewStrength = 0.55

驗證：
  C3 / 4SPP / movement-check：
    configAllowed = true
    stableReady = false
    lastPreviewStrength = 0.55
    meanLuma(full): 95.351693 -> 110.437023
    veryDarkRatio(full): 0.082047 -> 0.016100

  C4 / 4SPP / movement-check：
    configAllowed = true
    stableReady = false
    lastPreviewStrength = 0.55
    meanLuma(full): 87.920790 -> 104.796660
    veryDarkRatio(full): 0.053099 -> 0.009472
```

## v20e 修正

```
使用者回報：
  重新整理後 Console 出現 ScreenOutput fragment shader compile error。

根因：
  ScreenOutput_Fragment.glsl 呼叫 Three 注入的 ReinhardToneMapping(filteredPixelColor)。
  目前 three 版本注入函式不接受 vec3，導致 shader 編譯失敗。
  ScreenOutput 壞掉後，後面的 movement protection 驗證都失去意義。

修正：
  1. 新增 HomeStudioReinhardToneMap(vec3 color)。
  2. ScreenOutput 改呼叫本地 vec3 helper。
  3. InitCommon 與 ScreenOutput cache token bump 到 v20e。

驗證：
  node docs/tests/r6-3-v20-movement-protection.test.js
  node docs/tests/r6-3-cloud-mis-weight-probe.test.js
  node docs/tests/r6-3-max-samples.test.js
  node --check js/InitCommon.js
  node --check js/Home_Studio.js
  git diff --check
```

## v20f 修正

```
使用者回報：
  C3 4SPP 不會暗畫面了，但是有殘影問題。

根因：
  v20e 後 ScreenOutput shader 已正常編譯。
  原本預設 movementProtectionMovingBlend = 0.65。
  相機移動時會把上一張穩定畫面混進目前畫面，造成舊視角雙影。

修正：
  1. movementProtectionMovingBlend 預設改為 0.0。
  2. C3 / C4 low-SPP preview fallback 保持預設開啟。
  3. 穩定畫面 history mix 能力保留給 Console 手動 A/B。
  4. InitCommon 與 ScreenOutput cache token bump 到 v20f。

驗收：
  reportMovementProtectionConfig()
    version = r6-3-phase2-movement-protection-v20f
    movingBlend = 0
    lastBlend = 0
    peakPreviewStrength = 0.55 以實際移動後回報為準

  C3 / C4 / 4SPP 移動時：
    畫面可維持 v20e 的亮度改善。
    物件邊緣不再出現上一個視角的透明雙影。
```

## v20g 修正

```
使用者回報：
  v20f 不會有殘影了，但 C3 4SPP 看起來跟今天一開始差不多髒。

根因：
  v20f 只保留 low-SPP display lift。
  display lift 會一起提亮牆面與白色亮點，無法降低 4SPP 高頻亮暗雜點。
  history mix 已被判定會造成殘影，因此本輪不再走舊畫面混合。

修正：
  1. 新增 movementProtectionSpatialPreviewStrength，預設 0.90。
  2. C3 / C4 移動中，ScreenOutput 在 tone mapping 前做 spatial moving preview。
  3. 使用 13 點局部平均建立 movementSpatialPreviewHdr。
  4. 用 movementBrightLimit 壓回過亮 speckle。
  5. 對過暗點做少量 local lift。
  6. path tracing accumulation 不讀這個 preview 結果。
  7. InitCommon 與 ScreenOutput cache token bump 到 v20g。

驗收：
  reportMovementProtectionConfig()
    version = r6-3-phase2-movement-protection-v20g
    movingBlend = 0
    lowSppPreviewStrength = 0.35
    spatialPreviewStrength = 0.90
    uniformSpatialPreviewStrength = 0.90 以實際移動中回報為準

  C3 / C4 / 4SPP 移動時：
    不應出現上一視角透明雙影。
    白色亮點密度與黑點突兀感應低於 v20f。
    停止移動後仍回到正常 path tracing 收斂。
```

## v20h 修正

```
使用者回報：
  v20g 還是超髒。

根因：
  v20g 的 13 點局部清理仍然太小。
  C3 / C4 的 4SPP 噪點是整片樣本圖樣在擋視線。
  只壓少數 speckle 無法讓移動時畫面變得可讀。

修正：
  1. v20g 13 點 spatial preview 預設關閉。
  2. low-SPP display lift 降到 0.15。
  3. 新增 37 點 wide moving preview，預設 0.95。
  4. wide preview 只吃目前這一幀，不吃舊視角。
  5. 過亮中心點會先被 movementWideBrightLimit 壓回局部範圍。
  6. 移動中用寬域平均換取可讀性，停止後回正常 path tracing 收斂。
  7. InitCommon 與 ScreenOutput cache token bump 到 v20h。

驗收：
  reportMovementProtectionConfig()
    version = r6-3-phase2-movement-protection-v20h
    movingBlend = 0
    lowSppPreviewStrength = 0.15
    spatialPreviewStrength = 0
    widePreviewStrength = 0.95
    uniformWidePreviewStrength = 0.95 以實際移動中回報為準

  C3 / C4 / 4SPP 移動時：
    允許畫面比 v20g 模糊。
    噪點遮擋應低於 v20g。
    不應出現上一視角透明雙影。
```

## v21a 修正

```
使用者回報：
  v20h 還是一樣很髒。

根因：
  v20 / v20g / v20h 都是在處理同一張 4SPP 畫面。
  後製清理只能糊掉一部分圖樣，無法補足樣本不足。
  C3 / C4 movement pain point 的根因回到：移動中的當前畫面只有 4SPP。

修正：
  1. 保留 firstFrameRecoveryTargetSamples = 4，避免影響其他配置。
  2. 新增 firstFrameRecoveryMovingTargetSamples = 16。
  3. 僅 C3 / C4 且 cameraIsMoving 時，把同一個 visible frame 的 pass target 拉到 16。
  4. movement protection history mix 仍維持 movingBlend = 0。
  5. v20h wide preview 保留，但主要改善來源改成更多當前樣本。
  6. InitCommon 與 ScreenOutput cache token bump 到 v21a。

驗收：
  reportFirstFrameRecoveryConfig()
    targetSamples = 4
    movingTargetSamples = 16

  C3 / C4 / 4SPP 移動時：
    左下 Samples 應從 4 提升到 16。
    畫面應比 v20h 少噪點遮擋。
    FPS 可能下降，這是本輪用效能換可讀性的代價。
```

## v22a 第一性原理改向

```
使用者回報：
  v21a 變得更爛。
  16SPP 前像被丟掉，畫面超模糊又卡手。
  截圖顯示 FPS 掉到 3，移動 UX no-go。

根因：
  v21a 把移動中的 visible frame 拉到 16SPP，直接增加 GPU 工作量。
  v20g / v20h 的顯示端平均只會把髒點抹成糊，不會產生新資訊。
  低 SPP path tracing 的髒來自隨機取樣；4SPP 畫面缺少足夠樣本，後製無法補回。

修正：
  1. firstFrameRecoveryMovingTargetSamples 改回 1。
  2. movementProtectionLowSppPreviewStrength / spatialPreviewStrength / widePreviewStrength 預設全關。
  3. 新增 movementPreviewEnabled，C3 / C4 移動中預設開。
  4. PathTracingCommon 新增 uMovementPreviewMode。
  5. uMovementPreviewMode 開啟時，pixelOffset 固定 0、aperture jitter 固定 0、previousTexture 不混入。
  6. Home_Studio_Fragment 新增 CalculateMovementPreview：只跑一次 SceneIntersect，用第一個命中點 + deterministic hemispheric/key light 做乾淨預覽。
  7. 移動預覽期間跳過 borrow pass。
  8. 停止移動後回到原本 path tracing 累積。
  9. InitCommon / Home_Studio / ScreenOutput cache token bump 到 v22a。

驗收：
  reportMovementProtectionConfig()
    version = r6-3-phase2-movement-protection-v22a
    movementPreviewEnabled = true
    lowSppPreviewStrength = 0
    spatialPreviewStrength = 0
    widePreviewStrength = 0
    moving 時 uniformMovementPreviewMode = 1

  reportFirstFrameRecoveryConfig()
    targetSamples = 4
    movingTargetSamples = 1

  C3 / C4 移動時：
    左下 Samples 應維持 1 或低樣本，不再被拉到 16。
    手感應明顯比 v21a 順。
    移動中材質與光照可較粗略，但應少掉大面積白黑噪點遮擋。
    停止後回正常 path tracing 收斂。
```

## v22b 回撤預設簡化預覽

```
使用者回報：
  v22a 一直閃出灰色廉價建模。
  使用者判定這種預設 UX 不可接受。

根因：
  v22a 把 C3 / C4 移動中的畫面整張切到 CalculateMovementPreview。
  CalculateMovementPreview 只做一次命中與簡化光照，缺少正式 path tracing 的材質、間接光與紋理表現。

修正：
  1. movementPreviewEnabled 預設改 false。
  2. CalculateMovementPreview 保留在 shader 內，改成 Console 診斷用。
  3. C3 / C4 一般移動預設回正式 path tracing 畫面。
  4. firstFrameRecoveryMovingTargetSamples 保留 1，但只有手動開 movementPreviewEnabled 時才會生效。
  5. InitCommon / Home_Studio / ScreenOutput cache token bump 到 v22c。

驗收：
  reportMovementProtectionConfig()
    version = r6-3-phase2-movement-protection-v22c
    movementPreviewEnabled = false
    moving 時 uniformMovementPreviewMode = 0

  C3 / C4 移動時：
    不應再閃出灰色簡化模型。
    畫面會回到正式 path tracing 的低 SPP 樣貌。
    後續 ROI 改走不破壞正式材質的路線。
```

## v22c C1 / C2 FPS 回復

```
使用者回報：
  setFirstFrameRecoveryConfig({ targetSamples: 1 }) 之後，C1 / C2 就正常順了。

根因：
  firstFrameRecoveryTargetSamples = 4 原本是全域設定。
  movementProtectionConfigAllowed() 只管 C3 / C4 的 movement protection。
  C1 / C2 移動時也會被 first-frame recovery 拉到 4SPP，因此 FPS 一起下降。

修正：
  1. 新增 firstFrameRecoveryConfigTargetSamples(activeCameraMoving)。
  2. C1 / C2 回傳 1。
  3. C3 / C4 保留 firstFrameRecoveryTargetSamples = 4。
  4. reportFirstFrameRecoveryConfig() 新增 configTargetSamples，方便 Console 驗證。
  5. InitCommon / Home_Studio / ScreenOutput cache token bump 到 v22c。

驗收：
  C1 / C2：
    reportFirstFrameRecoveryConfig().configTargetSamples = 1
    移動 FPS 應接近使用者手動 targetSamples: 1 的順暢感。

  C3 / C4：
    reportFirstFrameRecoveryConfig().configTargetSamples = 4
    仍保留原本早期低樣本保護路徑。
```

## v22d C3 / C4 移動輕量 2SPP

```
使用者決策：
  試試看選項 4，移除選項 1。

選項 1：
  移動中同一個可見畫格硬算到 4SPP。
  實測會拖低 FPS 與手感。

選項 4：
  C3 / C4 移動中降低單張成本。
  停止移動後再補回正常 early recovery。

根因：
  C3 / C4 原本移動時 configTargetSamples = 4。
  每個可見畫格都要多跑 path tracing pass。
  借光 pass 也會一起跑，C3 / C4 手感被雙重成本壓住。

修正：
  1. firstFrameRecoveryMovingTargetSamples 改成 2。
  2. C1 / C2 保持 configTargetSamples = 1。
  3. C3 / C4 移動時 configTargetSamples = 2。
  4. C3 / C4 停止移動與 refill 時 configTargetSamples = 4。
  5. C3 / C4 移動期間跳過 borrow pass。
  6. reportMovementProtectionConfig() 新增 lowCostMovingActive。
  7. InitCommon / Home_Studio / ScreenOutput cache token bump 到 v22d。

驗收：
  C1 / C2：
    reportFirstFrameRecoveryConfig().configTargetSamples = 1

  C3 / C4 移動時：
    reportFirstFrameRecoveryConfig().configTargetSamples = 2
    reportMovementProtectionConfig().lowCostMovingActive = true

  C3 / C4 停止後：
    reportFirstFrameRecoveryConfig().configTargetSamples = 4
    reportMovementProtectionConfig().lowCostMovingActive = false
```

## v22d 使用者驗收與本路線結案

```
使用者回報：
  2SPP 也是黑點很多，等於卡一個視覺障礙。
  使用者判斷這套架構可能已經搞不定低 SPP 移動痛點。

本路線結論：
  v20 ~ v22d 已驗證下列方案：
    舊穩定畫面混合：
      會有殘影。

    顯示端模糊 / spatial preview：
      會糊、會卡，且仍遮擋視線。

    簡化 deterministic preview：
      會閃出灰色廉價模型。

    移動中硬算 4SPP：
      FPS 與手感下降。

    移動中 2SPP + 跳過 borrow pass：
      FPS 成本下降，但黑白點仍太多。

停止理由：
  目前問題已從單一 shader bug，轉為架構層級 UX 問題。
  WebGL path tracing 的 1 / 2 / 4 SPP 畫面都不足以成為乾淨移動預覽。
  後續繼續包裝同一張低 SPP path tracing 畫面，ROI 很低。

保留成果：
  1. 快照開關，預設關閉。
  2. first-frame recovery，可避免 1SPP 黑幕。
  3. C1 / C2 first-frame target 回到 1，恢復移動手感。
  4. movement protection console reporter / setter。
  5. v22d cache token 與合約測試。

下一方向：
  1. 先做 R7 丁 blue noise 小實驗。
     目標是讓低 SPP 顆粒比較不刺眼。

  2. 若改善有限，再做 R7 丙光源機率優化。
     目標是在既有 R3-6 / R3-6.5 採樣架構內降低變異。

  3. WebGPU / hybrid preview 只保留小型概念驗證。
     目標是驗證移動時乾淨 preview，停止後再走高品質 path tracing 收斂。
     不進整套 WebGPU 搬遷。
```

## 風險

```
1. 舊視角殘影
   原因：
     移動期間混入上一張穩定畫面。

   控制：
     movingBlend 預設為 0。
     只有 Console 手動調高時才會混入舊畫面。
     停止移動後混合關閉。

2. 穩定畫面太舊
   原因：
     燈光或參數改變後仍保存舊結果。

   控制：
     resize 時同步標記 stableReady = false。
     移動清除期間保留穩定畫面，確保 v20a 能保護 4 SPP 移動畫面。

3. 靜止畫面被污染
   原則：
     movement protection 只作用於顯示合成。
     path tracing accumulation 不讀 movement protection texture。
```

## 完成條件

```
1. Console 開關可用。
2. 快照關閉時手感仍順。
3. 移動期間視線遮擋低於 v19a。
4. 停止移動後能回到正常 path tracing 收斂。
5. docs/SOP/R6：渲染優化.md 與 docs/SOP/Debug_Log.md 同步更新。
```
