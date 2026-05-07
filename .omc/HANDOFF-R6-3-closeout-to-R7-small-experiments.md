# HANDOFF — R6-3 結案，交棒 R7 小實驗與 WebGPU 小型驗證

日期：2026-05-06

## 接手定位

```
這份交棒給下一窗 AI。

目標：
  不延續 R6-3 WebGL path tracing 低 SPP 修補線。
  下一步先做 R7-1 blue noise 小實驗。
  WebGPU / hybrid preview 只保留小型概念驗證。

使用者決策：
  R6 到此為止。
  該記錄的紀錄。
  WebGPU 的事情交棒給下一窗 AI。
  後續追問後，決策修正為：不要太快進 WebGPU 魔改，R7 小項目先探。
```

## 必讀順序

```
1. /Users/eajrockmacmini/.codex/AGENTS.md
2. /Users/eajrockmacmini/.codex/memories/MEMORY.md
3. /Users/eajrockmacmini/.codex/memories/Home_Studio_3D.md
4. /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R0：全景地圖.md
5. /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R6：渲染優化.md
6. /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R6-3-v20：movement protection.md
7. /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md
8. 本檔
```

## R6-3 最終結論

```
核心痛點：
  C3 / C4 移動時 1 / 2 / 4 SPP 都會產生滿版黑白點。
  使用者肉眼判定這會形成視覺障礙。

目前 WebGL path tracing 低 SPP 修補線已停止：
  1. 1SPP 黑幕：
     v19 first-frame recovery 可避免黑幕。

  2. 4SPP 髒畫面：
     v20 ~ v22 多輪顯示端處理仍無法達到可接受移動視線。

  3. v22d：
     C3 / C4 移動降到 2SPP 並跳過 borrow pass。
     使用者仍判定黑點太多。
```

## 已排除路線

```
1. 舊穩定畫面混合
   問題：
     殘影。

2. 顯示端模糊 / spatial preview / wide preview
   問題：
     糊、卡，且仍遮擋視線。

3. 簡化 deterministic preview
   問題：
     會閃出灰色廉價模型。

4. 移動中同一畫格硬算 4SPP
   問題：
     FPS 與手感下降。

5. 移動中 2SPP + 跳過 borrow pass
   問題：
     FPS 成本下降，但黑白點仍太多。

6. 繼續包裝 1 / 2 / 4 SPP path tracing 畫面
   判斷：
     ROI 很低。
```

## 保留成果

```
1. 快照開關
   預設關閉。
   可避免大量快照造成卡頓。

2. first-frame recovery
   可避免剛移動時看到 1SPP 黑幕。

3. C1 / C2 成本修正
   C1 / C2 reportFirstFrameRecoveryConfig().configTargetSamples = 1。

4. C3 / C4 v22d 狀態
   移動時 reportFirstFrameRecoveryConfig().configTargetSamples = 2。
   停止後 reportFirstFrameRecoveryConfig().configTargetSamples = 4。
   reportMovementProtectionConfig().lowCostMovingActive 可看移動輕量狀態。

5. 診斷工具與合約測試
   docs/tests/r6-3-v20-movement-protection.test.js
   docs/tests/r6-3-cloud-mis-weight-probe.test.js
   docs/tests/r6-3-max-samples.test.js
```

## 下一階段方向

```
第一順位：
  R7-1 blue noise sampling 升級。

目標：
  讓低 SPP 黑白點變得比較不刺眼。
  先用小、可逆、容易驗收的改動測 ROI。

驗收：
  C3 / C4 1 / 2 / 4 / 8 SPP 對照。
  靜止高 SPP 收斂不可走樣。

第二順位：
  R7-2 光源 importance sampling 機率優化。

目標：
  在既有 R3-6 / R3-6.5 採樣架構內降低變異。

驗收：
  C1~C4 光源狀態不可走樣。
  C3 / C4 低 SPP 與 1024 SPP 都要 A/B。

第三順位：
  WebGPU / hybrid preview 小型概念驗證。

目標：
  移動時走乾淨 preview。
  停止後回正式 path tracing 收斂。

最低驗收：
  1. C3 / C4 移動時沒有滿版黑白點。
  2. 移動 FPS 與手感優於 v22d。
  3. preview 保留正式材質顏色、主要燈光、基本遮蔽。
  4. 不出現灰色廉價模型。
  5. 停止後可以回到正式品質收斂。

暫緩：
  WebGPU 整套搬遷。
  ReSTIR。
  path guiding 重做。
```

## 可參考資料

```
使用者提過的參考來源：
  /Users/eajrockmacmini/Documents/VS Code/My Project/LGL_Tracer
  /Users/eajrockmacmini/Documents/VS Code/My Project/WGPU_Path_Tracing Demo
  https://threejs.org/examples/webgpu_lights_ies_spotlight.html
  https://github.com/mrdoob/three.js/
  https://github.com/mrdoob/three.js/blob/master/examples/webgpu_postprocessing_ssgi.html
  https://github.com/mrdoob/three.js/blob/master/examples/webgpu_postprocessing_ao.html
  https://github.com/mrdoob/three.js/blob/master/examples/webgpu_materials_lightmap.html

WebGPU 搬遷注意：
  https://threejs.org/manual/en/webgpurenderer
  three.js 官方 migration 文件指出 ShaderMaterial / RawShaderMaterial 不支援。
  本專案目前高度依賴自訂 shader，所以整套搬遷風險高。
```

## 交棒注意

```
1. 不要把 R6-3 的 no-go 路線重新包裝成新方案。
2. 不要再要求使用者肉眼驗收 1 / 2 / 4 SPP path tracing 低樣本修補。
3. 先做 R7-1 blue noise 小實驗。
4. WebGPU 只做小範圍概念驗證，再談整體搬遷。
5. 回覆使用國中生程度白話文。
6. 技術縮寫第一次出現時給中文意思，後面優先用中文說明。
```
