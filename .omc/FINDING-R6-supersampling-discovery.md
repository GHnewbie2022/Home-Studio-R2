# R6 重要發現：超採樣（Super-Sampling）作為實用化解法

> Date: 2026-04-29
> Status: 重大認知更新，影響 R6 後續方向

---

## 緣起

R6 主線目標是解決 path tracing 雜訊（noise cleanup）。原本路線圖預設「演算法極限是真極限」、需要從 NEE PDF（G diagnosis）下手解決。

今天為了解決快照解析度問題，把 render target 固定在 2560×1440（從原本 ~1458×741 的視窗大小提升），並開了 4 個視窗並行跑 path tracing。

意外觀察到：**超採樣（super-sampling）對視覺品質的提升遠超預期。**

---

## 觀察事實

```
解析度 2560×1440 + C3 場景 + 1000 SPP
  → 牆壁交界暗影處 firefly 幾乎消失
  → 全局僅剩細緻均勻磨砂雜訊
  → 1500 SPP 即達「實用可看」標準
  → 跑更高 SPP 主要差異在暗部更乾淨

對比原本路線圖預測（C3 需要 ~20000 SPP 才實用）
  → 預測偏悲觀，主因是低解析度放大 firefly 視覺破壞力
```

---

## 原理（音訊類比）

| Path Tracing 概念 | 音訊類比 |
|---|---|
| SPP（每像素採樣數） | 取樣次數 |
| 解析度（resolution） | 採樣率（sample rate） |
| Firefly（極端亮點） | 數位削波瞬間爆音 |

192kHz 錄音裡的瞬間爆音樣本依然存在，但縮回 44.1kHz 顯示時被前後 4 個樣本平均稀釋，聽感變不明顯。

Path tracing 同理：高解析度渲染後顯示縮放（或人眼空間平均）= 對 firefly 做天然 super-sampling 預過濾。爆掉的 ray 數值還在，但被周圍 3 個正常像素稀釋，視覺上看不見。

---

## 對 R6 路線圖的修正

### 真極限（與解析度無關）

```
全局磨砂雜訊（uniform Monte Carlo noise）
  遵守 √N 衰減定律
  SPP 翻 4 倍 → 雜訊減半
  解析度提升不影響此衰減速度
```

### 假極限（被解析度放大）

```
Firefly 視覺破壞力
  低解析度：每個 firefly 是大像素 → 明顯
  高解析度：每個 firefly 是小像素 → 被天然空間平均吞掉
  視覺急迫性大幅下降
```

### G diagnosis 的角色

原本路線圖預設「小光源被過度低估的採樣機率」是 firefly 兇手。但視覺急迫性已從「必須修」降為「優化項」，因為超採樣已掩蓋大部分症狀。

進一步觀察推翻了原本假說方向，詳見下方「假說方向修正」段。

---

## 假說方向修正（2026-04-29）

### 推翻舊假說的觀察

```
舊假說：小高亮燈源 PDF 被低估 → firefly 兇手
        懷疑兇手 = 22W COB + 25W 廣角軌道燈

實際觀察：
  C3 配置（細長鋁槽燈條，面積大）→ firefly 嚴重
  C4 配置（小點軌道燈 + 25W 廣角）→ 反而還好

如果舊假說成立，C4 才該是重災區。
觀察與預測相反 → 舊假說方向錯誤。
```

### 新嫌疑：細長 emitter + 遮擋幾何

C3 與 C4 的關鍵幾何差別：

```
C4 軌道燈、廣角燈
  點 / 小圓盤，發光面朝外、無遮擋
  NEE ray 從任意角度都能直接看到 → 穩定

C3 鋁槽燈條
  細長條躺在凹槽底部
  + 鋁槽內有 cloud 遮擋體（R5 設計）
  NEE ray 從某些角度會被遮擋體擋住
  從某些角度會穿過縫隙看到 emitter
  「看到」是稀有事件 × 高能量
  → 稀有 × 高能量 ÷ 低機率 = firefly 爆掉
```

這是典型的 **visibility-driven firefly（可見性驅動的螢火蟲）**，跟 PDF 大小無關。

### 新假說候選（依可能性排序）

```
假說 1 — 細長 emitter + 鋁槽遮擋幾何造成 visibility 不穩
  ← 最符合 C3 嚴重 / C4 還好的觀察

假說 2 — emitter 形狀採樣公式對細長條失配
  面積採樣時從某些角度看 emitter 角度極小，
  cosine 項接近 0 造成數值不穩定

假說 3 — emit 量綱對細長 emitter 特殊
  依 photometric ↔ radiometric 量綱記憶 Φ/(K·π·A)
  A（面積）對鋁槽燈條的算法可能跟點燈不同公式

假說 4 — cone falloff 方向性問題
  如果燈條帶方向性發光，cone 邊緣數值不穩定
```

### G diagnosis 計畫改寫

```
原計畫：印 PDF 數值找「小光源被低估」
新計畫：印 NEE ray「visibility 命中率」找「遮擋兇手」

具體步驟：
 1. 在 shader 加偵測代碼，記錄每盞燈 NEE 詢問次數與
    visibility 命中（沒被擋）次數
 2. 找出命中率極低（< 5%）但命中時貢獻爆值的燈
 3. 對應解法路徑：
    a. MIS（multiple importance sampling，多重重要性採樣）
    b. 重新設計遮擋幾何（讓燈條更裸露、或採樣方式換）
    c. 調整 emitter 取樣公式針對細長條
```

---

## R6 後續方向更新

### 已達成（部分）

```
原目標：C3 視覺可用
現況：1500 SPP + 2560×1440 render target ≈ 視覺可用
代價：4 視窗並行需 ~19 分鐘到 1350 SPP
      預計 20000 SPP 約 5 小時（單次）
```

### 新主線：加速

目標重定義為「**30 秒～1 分鐘達到 90% 品質**」。

預期：完全 realtime 零延遲不可達，但 30 秒到 1 分鐘達 90% 品質是合理目標。

#### 加速方向（依容易度 × ROI 雙重排序）

```
第 1 優先 — G diagnosis（visibility 診斷，假說方向已修正）
  容易度：⭐⭐⭐⭐（探測 1-2 天 + 解法 0.5-1 天）
  ROI：中
  理由：成本仍低、已 ready，無論結果是真是假都是淨收益。
        探測目標從原本「PDF 數值找小燈」修正為
        「NEE ray visibility 命中率找遮擋元兇」。
        詳見上方「假說方向修正」段。

第 2 優先 — OIDN 離線降噪流程（不改框架）
  容易度：⭐⭐⭐⭐（外部工具，shell script + 一個按鈕）
  ROI：極高
  理由：把 SPP 降到 100~500，存 PNG 出來，
        用桌面版 OIDN（Intel Open Image Denoise）跑後處理，
        驗證「AI denoiser 能否達 90% 品質」這個關鍵假設。
        成本極低，只加個流程，不動渲染管線。
        結果好再決定要不要往第 3 步走 realtime 版本。

第 3 優先 — SVGF 即時降噪整合
  容易度：⭐⭐（純 shader 實作，1-2 週深度工作）
  ROI：極高
  理由：把 OIDN 離線驗證的概念做進 realtime 渲染管線。
        論文有開源 reference，要自己整合到 erichlof 框架。
        如第 2 步驗證 AI denoiser 路線可行，這步幾乎是必走的。
        達 5-15 SPP 看起來像 1000 SPP 純樣本。

第 4 優先 — Path Guiding 或 ReSTIR（二選一）
  容易度：⭐（演算法結構大改，數週工作）
  ROI：極高
  理由：業界最先進。如果前三步加起來還不夠 30 秒到 1 分鐘 90% 品質，
        再考慮投入。WebGL 上參考實作較少，門檻高。
        ReSTIR 對動態場景特別強；
        Path Guiding 對 firefly 從根本緩解。
```

#### 建議推進節奏

```
本週：跑完 G diagnosis（成本最低，先排除/確認 NEE PDF 假說）
下週：搭 OIDN 離線降噪流程，驗證 denoiser 路線
驗證後決策：
  好  → 投入第 3 步 SVGF（realtime 整合）
  不好 → 跳到第 4 步 ReSTIR
```

前 1+2 步加起來只需 3~5 天工作量。先把這兩個低成本驗證做完，再決定要不要花數週投入 SVGF 或 ReSTIR。

---

## 操作層面副產品

R6 期間為超採樣需求衍生的工具改動（已落地）：

```
1. 渲染解析度滑桿（slider-pixel-res）上限 2.0 → 4.0
2. Render target 固定 2560×1440（與視窗大小解耦）
3. CSS letterbox 維持 16:9 顯示比例
4. 快照永遠輸出 2560×1440（不受視窗大小、滑桿影響）
5. 採樣上限 MAX_SAMPLES：Infinity → 20000
6. 新增渲染計時器（FPS 列顯示「耗時: XXmXXs」）
```

---

## 結論

R6 noise cleanup 的本質目標（C3 視覺可用）藉由超採樣已基本達成。後續工作從「解決演算法極限」轉為「加速達成相同品質」。G diagnosis 仍可做但不再是 critical path。

---

## Hard Rules（硬規則，不可違反）

```
DO NOT retry RR Option 1 (NEE-after placement) — confirmed failed
DO NOT use post-process blur for noise — confirmed wrong direction
DO NOT clamp values to mask noise — hides root cause, not a fix
DO NOT deprioritize G in favor of H — geometry ruled out
```

---

## Prior Context Files（深入脈絡可選讀）

- /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOVER-R6-noise-G-diagnosis.md
- /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/REPORT-R6-convergence-diagnosis.md
- /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/ROADMAP-R6-noise-cleanup-priority.md
- /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/REPORT-R6-2-bucket2-rr-step0-noop.md
