# R6-2 階段 1.0：現況盤點報告 ✅

> 階段狀態：完工 2026-04-27
> 上層 SOP：`docs/SOP/R6：渲染優化.md` 主線 2 BVH 加速
> 後續：階段 1.5（分流優化）

---

## 1. 量測項目對照表

| SOP 量測項目 | 狀態 | 備註 |
|---|---|---|
| 1. fragment shader 每 frame 耗時 | ✅（從 fps 反推）| 詳第 4 節 |
| 2. C1/C2/C3/C4 1024-spp 達成秒數 | ✅ | 詳第 2 節 |
| 3. BVH traversal vs Light NEE vs Material BRDF 三段佔比 | ⚠ 部分 | 從 C1→C4 速率差反推光源端 ≤ 12%，三段詳細未拆 |
| 4. 哪個 BVH builder 被實際使用 | ✅ Fast builder | explore agent 確認 |

---

## 2. 完整盤點表

| Config | 場景描述 | fps | spp/sec | 1024-spp 牆鐘 | spp/frame ratio | 狀態 |
|--------|---------|-----|---------|----------------|-----------------|------|
| C1 | 基本吸頂燈 | 35.5 | 34.30 | 29.9 秒 | 0.967 | GPU saturated |
| C2 | 吸頂燈 + 軌道 | 32.7 | 31.56 | 32.4 秒 | 0.964 | GPU saturated |
| C3 | 4 燈條 | 39.0 | 30.78 | 33.3 秒 | 0.789 | ⚠ 啟動暫態 frame-skip（穩態 0%、見 F1 結案） |
| C4 | C3 + 軌道 | 32.0 | 30.39 | 33.7 秒 | 0.951 | GPU saturated |

### 2.1 量測方法

```javascript
(() => {
  const spp_t0 = sampleCounter;
  const t0 = performance.now();
  let frames_t0 = 0;
  const cb = () => { frames_t0++; if (performance.now() - t0 < 5000) requestAnimationFrame(cb); };
  requestAnimationFrame(cb);
  setTimeout(() => {
    const spp_t1 = sampleCounter;
    const elapsed_sec = (performance.now() - t0) / 1000;
    const fps = frames_t0 / elapsed_sec;
    const spp_per_sec = (spp_t1 - spp_t0) / elapsed_sec;
    const ratio = spp_per_sec / fps;
    console.log({ elapsed_sec, spp_t0, spp_t1, MAX_SAMPLES, fps, spp_per_sec, spp_per_frame_ratio: ratio });
  }, 5100);
})();
```

操作流程：點 Config N → 立刻貼腳本 → 等 5 秒 → JSON 回報。

### 2.2 數據可信度

- 線性度：每 config 約 160 frame、5 秒 window，spp 從 ~60 累到 ~220，距 1000 cap 安全
- 量測誤差：±1 fps（vsync 抖動），spp/sec ±5%
- 環境：Brave（M4 Pro Metal Renderer）DevTools Console，使用者親自跑

---

## 3. 量測過程踩坑紀錄

### 3.1 setInterval 線性回歸量測偏低 30%（撤回）

第一輪用 `setInterval(250ms)` 收 timeline 線性回歸，C1 量到 23.34 spp/sec、1024-spp 牆鐘 43.88 秒。比第二輪 RAF 量法低 31%。

原因：sampleCounter 接近 `MAX_SAMPLES = 1000` cap 時，`renderingStopped` flag 觸發，STEP 1 path tracing render 被 throttle，但 setInterval 仍在收 timeline，回歸吃到 idle 段把斜率拉低。

修正：改用 RAF 計數 + 5 秒 window，spp_t0 ~60、spp_t1 ~220，全程在 cap 之前，數據乾淨。

### 3.2 任務 1 vs 任務 4 fps 矛盾的解釋

第一次量「frame timing」跑 600 frame、平均 16.67ms（60 fps），但「spp_per_frame_ratio」量到 35.5 fps。差異原因：

- 任務 1：使用者沒切 Config，sampleCounter 已 = 1000 cap → STEP 1 跳過 → 每 frame 只跑 STEP 2/3 → vsync idle 60 fps
- 任務 4：使用者剛切 Config 1（reset 累積）→ STEP 1 真跑 → GPU saturated 35.5 fps

對齊 R2-6 教訓的 `renderingStopped` 邏輯（`Debug_Log.md` R2-6 章）。

### 3.3 MAX_SAMPLES 是 const 改不了

量測時嘗試把 `MAX_SAMPLES = 99999` 想拉開上限便於不間斷量測，遭 `Assignment to constant variable` 拒絕。改策略：用 5 秒 window + Config 切換 reset 累積，cap 在量測 window 之外，不必改源碼。

---

## 4. fragment shader 每 frame 耗時

| Config | per-frame 時長 |
|--------|----------------|
| C1 | 28.2 ms |
| C2 | 30.6 ms |
| C3 | 25.6 ms（穩態值；前 2 秒啟動暫態 ratio≈0.5、見 F1 結案）|
| C4 | 31.3 ms |

從 fps 反推（1000/fps）。包含：

```
STEP 1 path tracing fragment shader（主成本，~95%）
STEP 2 ping-pong copy（pathTracingRT → screenCopyRT，cheap）
STEP 3 screen output（walk denoiser + tone map，cheap）
```

---

## 5. C3 異常：21% frame 跳過（✅ 已結案 2026-04-27）

### 5.1 原始症狀（保留作 systematic-debugging 紀錄）

```
症狀：fps=39（高於其他 config）但 spp_per_frame_ratio=0.789
含義：每 5 frame 有 1 個 frame 沒累積 sample
猜測原因（未驗證）：
  - applyPanelConfig 切換的 cameraSwitchFrames=3 邏輯延伸
  - C3 的 4 燈條 / Cloud light 結構觸發特殊 frame 跳過
  - 5 秒 window 太短 + 切換瞬間 race condition
影響：
  - 對「是否進階段 1.5」結論不影響（GPU 仍是瓶頸）
  - 對 C3 真實 spp/sec 估值有 ~21% 誤差（保守估 30.78 → 真實可能 ~38）
```

### 5.2 結案結論（2026-04-27）

```
Root cause：啟動暫態（前 2 秒）瀏覽器 RAF 60Hz 跟 GPU 26ms/frame 不同步、
            被 InitCommon.js L877 60fps gate 擋下；穩態下 RAF 自動降到
            ~39Hz 後 frame-skip 完全消失。
穩態損失：≈ 0%
累積 1024 spp 影響：≈ 2.9%（低於 ralplan +5% commit 門檻）
ratio 浮動 11% 解釋：量測 window 起點與 panel 切換時刻的相對距離不同、
                     window 含暫態多寡造成 ratio 浮動
決策：不修（修法都觸碰框架核心、收益人眼難察覺）
詳細論證：.omc/REPORT-R6-2-bucket4-F1-conclusion.md
```

---

## 6. 環境資訊

```
GPU: Apple M4 Pro (Metal Renderer via ANGLE)
GL_RENDERER: ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Version 15.7.5)
GL_VERSION: OpenGL ES 3.0 (ANGLE 2.1.27286)
WebGL: Hardware accelerated
WebGPU: Hardware accelerated
Skia Graphite: Enabled
瀏覽器: Brave Browser（使用者端）+ MCP Playwright Chromium（自動化端）
Server: python3 -m http.server 9001 (cwd=Home_Studio_3D/)
```

---

## 7. 階段 1.5 進入判斷

```
✓ GPU saturated 確認（spp_per_frame ≈ 1，除 C3 異常）
✓ fragment shader 任何加速 1:1 變 spp/sec
✓ C1→C4 速率差 11.4% → 光源端 NEE per-frame 成本貢獻 ≤ 12%
✓ 剩下 ≥ 88% 在 BVH traversal + Material BRDF（共用路徑）
✓ 1024-spp 牆鐘 30~34 秒，廠商討論時等 30 秒仍卡節奏

→ 進階段 1.5
→ 第一步：SAH builder 切換（SOP 第 86 行 a 項）
   - 改動量：1 行 import + 1 行函式名
   - 驗證：spp/sec 量 + 1024-spp pixel diff 視覺驗證
   - 變快 → 確認 BVH 結構是瓶頸要素，再進 leaf packing
   - 沒變快 → 排除 BVH 結構，下一步動 leaf fetch / material
   - 對齊 R6-1 教訓「演算法效果未知時 prototype-first」
```

---

## 8. follow-up

```
F1: ✅ 結案 2026-04-27（root cause = 啟動暫態 RAF cadence + 60fps gate、不修）
    詳：.omc/REPORT-R6-2-bucket4-F1-conclusion.md

F2: 量測項目 3 三段佔比拆解
    （階段 1.5 動 shader 時順手加 EXT_disjoint_timer_query_webgl2
     對 BVH traversal / NEE / Material 三段加 timer）

F3: 階段 1.5 完工後重跑本表
    對比加速效果（spp/sec 提升 % + 1024-spp 牆鐘縮短秒數）
```

---

## 修訂歷史

- 2026-04-27 初版完工（MCP Playwright Chromium + 使用者 Brave 雙端量測）
