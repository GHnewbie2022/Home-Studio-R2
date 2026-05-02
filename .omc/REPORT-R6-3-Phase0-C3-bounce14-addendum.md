# REPORT ADDENDUM — R6-3 Phase 0 C3 14-bounce 截圖補充

> Date: 2026-05-01
> Parent report: `.omc/REPORT-R6-3-Phase0-initial-convergence-triage.md`
> Scope: 補充 C3 14-bounce 1~3000 spp 截圖觀察；未修改 shader / BVH / 採樣演算法。

---

## 0. 資料來源

截圖資料夾：

```
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/snapshot/260501-cam1-default C3 bounce14
```

已確認截圖節點：

```
1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 / 16 / 24 / 32 / 48 / 64 / 80 /
100 / 150 / 200 / 300 / 500 / 750 / 1000 / 1500 / 2000 / 3000 spp
```

燈光與 bounce 定義：

```
C3 = 只開 Cloud 漫射燈
bounce = 14
```

---

## 1. 使用者校正後的分段結論

根據 C3 14-bounce 1~3000 spp 截圖，以及上一輪人工觀察結論，C3 的收斂問題應拆成兩段：

```
1 ~ 48 spp：
  初始爆噪問題。
  畫面剛開始整張高變異，視覺上最嚇人。

48 ~ 20000 spp：
  尾端慢慢清髒點問題。
  畫面大致成形後，暗部小亮點 / 高亮光斑 / firefly 拖很久。
```

注意：

```
這個分段不代表 48 spp 後完全乾淨。
它代表主要問題型態從「全圖初始爆噪」逐漸轉成「少數亮點與暗部殘留拖尾」。
```

---

## 2. 對修法方向的含義

### A. 1 ~ 48 spp：初始爆噪

較適合方向：

```
1. 時序累積
2. 重投影
3. SVGF（時空變異引導濾波）
4. preview-only denoise / resolve
```

目標：

```
剛切換 camera / lighting / material 後，不要從視覺上很嚇人的砂紙畫面開始。
這段修法偏互動預覽體驗，不必等同最終物理正確解。
```

### B. 48 ~ 20000 spp：尾端清髒點

較適合方向：

```
1. firefly clamp
2. 高亮離群值限制
3. radiance / throughput 權重檢查
4. 間接光路徑權重檢查
5. 光源取樣權重檢查
```

目標：

```
讓暗部小亮點與高亮光斑不要拖到很高 spp 才消失。
這段比較像少數樣本權重過大，拖慢視覺收斂。
```

---

## 3. 與原 Phase 0 triage 的關係

此補充資料支持原報告第 7 節的下一步順序：

```
第一優先：讀目前累積 / resolve / screen output pipeline
  目標：判斷能否做 preview-only temporal denoise / SVGF / reproject。

第二優先：讀 radiance accumulation 與 firefly 高亮路徑
  目標：判斷是否能安全加 firefly clamp，且不破壞 1024+ spp 主觀色彩。
```

原因：

```
C3 14-bounce 新截圖把 1~48 spp 初始爆噪切得更清楚。
因此 R6-3 第一刀仍應先 review accumulation / resolve / screen output pipeline。
firefly clamp / 高亮權重檢查仍重要，但屬第二優先。
```

---

## 4. 建議更新到主報告的摘要

建議在主報告中加入：

```
C3 14-bounce 1~3000 spp 截圖補充顯示：
1~48 spp 主要是初始爆噪，較適合 temporal / reproject / SVGF / preview-only resolve；
48 spp 之後主要轉為暗部小亮點與高亮光斑拖尾，較適合 firefly clamp 與路徑權重檢查。
```

---

## 5. 守門

```
此 addendum 只整合截圖觀察與 triage 結論。
尚未做新的像素統計。
任何 shader 實作前，仍需先產出小 plan。
不要把 C3 / C4 混為同一種燈光型態。
不要把 R6-2 Russian Roulette 當作收斂修法；它會增加 variance。
```
