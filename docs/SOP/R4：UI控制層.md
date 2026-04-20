# R4：UI控制層（舊專案 1:1 復刻）

## 🚨 接手第一步（不得跳過）

1. 先讀 `Debug_Log.md` 開頭「通用 Debug 紀律」
2. 確認分支：`git branch --show-current` 應為 `r3-light`（R3 完工後不另開 r4 分支，延用至 R4 merge 前）
3. 讀本檔 + `.omc/HANDOVER-R4.md`

---

## 前提定調

- **「Wabi-sabi」不是設計目標**：該標籤來自先前 Gemini 對話，應忽略。真正方向是將舊專案 UI/UX 1:1 復刻；新 R3 功能（舊專案無）必須以與舊專案一致的風格整合進同一版面。
- **吸音板顏色控制**：僅作為美學預覽工具保留，Dimi Music 僅售白色 GIK，已非採購決策依據。
- **R4 不處理 CONFIG 3 噪點**：屬後續 denoising 階段。
- **驗收**：使用者直接操作 UX，**無 A/B 截圖比對階段**（無 R4-6）。
- **文件-only commit**：不需 cache-buster。

---

## 階段總覽

| 階段 | 主題 | 狀態 |
|------|------|------|
| R4-0 | 舊專案 UI 盤點 + 新 R3 控件整合策略 | ⬜ |
| R4-1 | UI 骨架復刻（lil-gui folder / CSS / naming 對齊舊專案） | ⬜ |
| R4-2 | 鷹架移除（R3-6 MIS checkbox + R3-6.5 動態池 checkbox / N 顯示 hardcode 為 1.0） | ⬜ |
| R4-3 | 保留 R3 控件併入舊版面（CONFIG 1/2/3、色溫 radio、lumens sliders、吸音板色） | ⬜ |
| R4-4 | R3-5a 甜蜜點 UI 復刻（4 sliders：燈傾角 / beam 角 / 軌到 GIK 距離 / 同側燈距） | ⬜ |
| R4-5 | 互動打磨（reset、listen-bound、hotkeys 視需） | ⬜ |

---

## R4-0 舊專案 UI 盤點 + 整合策略 ⬜

- 目標：列出舊專案每個 GUI folder / 控件 / label / CSS 特徵，並為每個新 R3 控件標註整合策略。
- 產出：本檔此節完整表格（待 Step 2 填入）。

## R4-1 UI 骨架復刻 ⬜

- 目標：依 R4-0 盤點結果，在本專案用 lil-gui 按舊專案的 folder 結構、CSS、命名 1:1 復刻版面骨架（先空殼，控件行為接線於後續階段）。

## R4-2 鷹架移除 ⬜

- 目標：拆除 R3-6 MIS 啟用 checkbox 與 R3-6.5 動態池 checkbox / N 顯示；shader 端 `uR3MisEnabled = 1.0` 與 `uR3DynamicPoolEnabled = 1.0` 寫死，移除死分支 else-branch。

## R4-3 保留 R3 控件併入舊版面 ⬜

- 目標：將保留的 R3 控件按舊專案風格整合進舊版面——CONFIG 1/2/3 切換、色溫 **radio buttons**（對齊舊觀感）、lumens sliders（Cloud / Track / Wide）、吸音板顏色控制。

## R4-4 R3-5a 甜蜜點 UI 復刻 ⬜

- 目標：跨 shader 幾何 + JS uniform + GUI 三層復刻舊專案 4 條 sweet-spot slider：燈傾角、beam 角、軌道到 GIK 距離、同側燈距。

## R4-5 互動打磨 ⬜

- 目標：reset 按鈕、listen-bound values、必要的 hotkeys。

---

## 驗收紀律

- R4 無 spp 比對驗收（UI 層）；由使用者直接操作每一控件確認反應正確。
- 關鍵行為錯誤（如色溫 radio 不切換、lumens slider 無效）當場修掉，不累到後段。
