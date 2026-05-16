# HANDOFF：OPUS GIK 修復完成 → CODEX 整合

**日期**：2026-05-15
**from**：OPUS（Claude Opus 4.7）
**to**：CODEX
**branch**：`codex/r7-3-10-c1-full-floor-diffuse-bake`
**任務 id**：`gik-north-rotate-uv-r4`
**狀態**：使用者 Config 1 / 2 / 3 / 4 四個情境全部實機驗收通過。

---

## 1. 為什麼有這份 hand-off

OPUS 在 Phase 2 主線（你在跑的 H8 + C' 第一刀）旁同步處理了使用者另一條線：北牆橫擺 GIK 貼圖變形與貼圖頂底邊緣白線。這兩件事彼此獨立，OPUS 全程不碰你的 H8 / C' / runtime / atlas / metadata / contract test 範圍。

但因為兩個 agent 共用同一條 branch，OPUS 的改動目前全部在 unstaged 區、你的第一刀則在 staged 區，使用者希望由你（CODEX）來決定如何整合 commit 與 commit 訊息。

本檔目的：給你一份自包含的清單，讓你在不必回頭讀其他檔的情況下就能整合。

---

## 2. 改動兩條線（兩線各自獨立）

### 線 1：shader UV 沒對應橫擺旋轉

**症狀**：Config 2 / 3 / 4 北牆三片橫擺 GIK（N1 / N2 / N3，X 軸 1.2 m × Y 軸 0.6 m）正面 LOGO 與 GEMINI 標誌被水平拉寬、垂直壓縮。

**根因**：`shaders/Home_Studio_Fragment.glsl` 的 `ACOUSTIC_PANEL` 分支（R2-LOGO-FIX）為直擺面板寫死「U → box X 軸、V → box Y 軸」；R6-3 將北牆 GIK 從一片直擺 N_v 改成三片橫擺 N1 / N2 / N3 後，1440 × 2912 直立貼圖被映射到 X 長 Y 短的橫擺面板上必然變形。

**修法**：box 自描述 `rotateUV90` 旗標走 box data texture pixel 4 的 `.b` 槽位（R2-18 註解的保留欄位之一）。shader 在 `ACOUSTIC_PANEL` 三個 hitNormal 子分支結束後做整體 90° 順時針 UV 旋轉。物件語義屬性而非幾何條件，符合 CLAUDE.md Rule 2。

### 線 2：貼圖檔頂底 padding 偽影

**症狀**：線 1 修完後，橫擺 GIK 上下側面與正面交界出現白色細邊；C1 直擺 GIK 東西牆頂邊、C3 / C4 天花板 Cloud GIK 北端也有同類白邊。

**根因**：`textures/gik244_grey.jpeg` 與 `textures/gik244_white.jpeg` 上下邊緣留有原圖製作時的 padding 偽影：
- `gik244_grey.jpeg` 頂部 row 0~4 fade `237→136`、底部 row 2907~2911 跳變 `77→47→60→112`
- `gik244_white.jpeg` 頂部 row 0~8 fade `241→208`、底部 row 2907~2911 跳變 `167→153→167→205→198`

R2-LOGO-FIX 採整條 0~1 必然碰到。旋轉後位置從不易察覺處（直擺時）甩到顯眼處（橫擺與天花板）。

**修法**：用 PIL 將兩張貼圖的頂底偽影 row 用相鄰健康 row mirror 覆蓋（grey 頂部 row 0~4 取 row 5~9 mirror、底部 row 2907~2911 取 row 2902~2906 mirror；white 範圍同策略但頂部修補寬度 9 row）。JPEG 重存 quality=95, subsampling=0。原檔備份於 `textures/gik244_*.jpeg.bak-pre-padding-fix`。

---

## 3. 完整改動清單（6 個檔案 + 2 個 backup）

| 檔案 | 改動內容 | 函式 / 段落 |
|---|---|---|
| `js/Home_Studio.js` | `addBox` 簽名末尾新增 `rotateUV90` 參數（第 11 個） | `function addBox(min, max, emission, color, type, meta, cullable, fixtureGroup, roughness, metalness, rotateUV90)` |
| `js/Home_Studio.js` | `panelConfig2` 的 N1 / N2 / N3 三片各加 `rotateUV90: 1` | `panelConfig2` 陣列前三項 |
| `js/Home_Studio.js` | `applyPanelConfig` 兩條 forEach 透傳 `p.rotateUV90 || 0` | `applyPanelConfig(config)` 內 `if (config === 1)` 與 `else if (config === 2 \|\| 3 \|\| 4)` |
| `js/Home_Studio.js` | `buildSceneBVH` 寫入 `boxArr[(p+4)*4+2] = b.rotateUV90 \|\| 0;` | box data texture pixel 4 `.b` 槽位 |
| `js/Home_Studio.js` | `updateBoxDataTexture` 同步寫入 `boxArr[(p+4)*4+2] = b.rotateUV90 \|\| 0;` | 同上 |
| `js/Home_Studio.js` | `demoFragmentShaderFileName` shader cache-buster 升至 `gik-north-rotate-uv-r4` | 檔內單行字串 |
| `shaders/Home_Studio_Fragment.glsl` | 新增全域 `float hitRotateUV90;` | hit state 全域宣告區（緊鄰 `hitRoughness` / `hitMetalness`） |
| `shaders/Home_Studio_Fragment.glsl` | `fetchBoxData` 新增 `out float rotateUV90` 並讀 `p4.z` | `fetchBoxData(int idx, ...)` 函式簽名與函式體尾 |
| `shaders/Home_Studio_Fragment.glsl` | `SceneIntersect` 防漏寫預設 `hitRotateUV90 = 0.0;` | `SceneIntersect()` 函式開頭與 `hitRoughness` / `hitMetalness` 並列 |
| `shaders/Home_Studio_Fragment.glsl` | `SceneIntersect` 命中時寫入 `hitRotateUV90 = boxRotateUV90;` | BVH 命中區，緊鄰 `hitMetalness = boxMetalness;` |
| `shaders/Home_Studio_Fragment.glsl` | `ACOUSTIC_PANEL` 三個 hitNormal 子分支結束後加整體 90° UV 旋轉 | `if (hitRotateUV90 > 0.5) { vec2 rel = uv - vec2(0.5); uv = vec2(0.5 - rel.y, 0.5 + rel.x); }` |
| `Home_Studio.html` | cache-buster 三處同步升至 `gik-north-rotate-uv-r4` | `css/default.css`、`js/InitCommon.js`、`js/Home_Studio.js` 三個 src 上的 `?v=` |
| `textures/gik244_grey.jpeg` | 頂部 row 0~4 / 底部 row 2907~2911 用相鄰健康 row mirror 覆蓋 | JPEG 重存 quality=95, subsampling=0 |
| `textures/gik244_white.jpeg` | 頂部 row 0~8 / 底部 row 2907~2911 用相鄰健康 row mirror 覆蓋 | 同上策略 |
| `textures/gik244_grey.jpeg.bak-pre-padding-fix` | 新增備份檔（原貼圖一字不動） | untracked |
| `textures/gik244_white.jpeg.bak-pre-padding-fix` | 新增備份檔（原貼圖一字不動） | untracked |
| `docs/SOP/Debug_Log.md` | 新增章節「GIK｜北牆橫擺面板 UV 旋轉 + 貼圖頂底偽影修補」 | 緊接導讀區後（在「R7-3.10｜C1 Phase 2 第一刀 H8 + C' 完成」之前） |

---

## 4. 對 CODEX 第二刀的非衝突保證

OPUS 全程**沒有動過**以下 CODEX 第二刀可能會碰的範圍：

- `js/PathTracingCommon.js`（你的 C' bake UV 修法所在）
- `js/InitCommon.js` 的 H8 runtime gate / per-surface ready / loader 隔離邏輯
- `updateR7310C1FullRoomDiffuseRuntimeUniforms()` 與 `updateR738C1BakePastePreviewUniforms()`
- H8 / C' / H7 / H5 / H3' 任何相關 atlas、runtime、metadata、contract test
- `docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js`
- R7-3.8 / R7-3.9 / R7-3.10 任何 bake 或 contract 邏輯
- `box data texture pixel 4` 的 `.a` 槽位（OPUS 只佔用 `.b`，`.a` 仍保留可用）
- 任何 lighting / NEE / BSDF / bounce / camera ray 路徑

---

## 5. 對 CODEX 第二刀的注意事項

1. **`fetchBoxData` 簽名變了**：在原本 11 個 out 參數後新增第 12 個 `out float rotateUV90`。目前唯一呼叫點在 `SceneIntersect` 內已配合處理。你若新增呼叫點請補上對應 receiver 變數。
2. **`addBox` 簽名變了**：在原本 10 個參數後新增第 11 個 `rotateUV90`。新呼叫不需要傳此參數（預設 `0`）。
3. **box data texture pixel 4 `.b` 已佔用**：`.a` 仍為保留槽位，你若需第三類 per-box bit 可直接使用。
4. **貼圖檔本身被改了**：cache-buster 不含貼圖檔路徑，瀏覽器需要硬重載（Cmd+Shift+R）一次才會 refetch 新貼圖。第二刀如不再動貼圖檔則無此需求。
5. **未來如新增「橫擺薄板」**：只要在該 box 物件加 `rotateUV90: 1` 即可，shader 不需要修、不需要碰 `ACOUSTIC_PANEL` 分支邏輯。
6. **未來如換貼圖**：請預先用 PIL 取 row 0~10 / row h-10~h 全寬平均色跟 row h/2 中央色比對，超出 ±10 RGB 視為偽影需先修補。

---

## 6. Git 狀態

截至 2026-05-15 hand-off 當下：

- OPUS 改動：**全部在 unstaged 區**，未 add、未 commit。
- CODEX 第一刀（H8 + C' + 重烘 + Debug_Log 大幅更新）：**staged 區，未 commit**。
- 兩批改動在 `Home_Studio.html`、`js/Home_Studio.js`、`shaders/Home_Studio_Fragment.glsl`、`docs/SOP/Debug_Log.md` 四個檔案上**同檔不同段**重疊。
- OPUS 沒有 stash、沒有 add、沒有 commit；index 維持你（CODEX）staged 第一刀時的狀態。

---

## 7. 建議的整合方式（你決定）

### 選項 A — 兩筆獨立 commit，你先 OPUS 後

```
# 把 OPUS unstaged 全部納入第二筆 commit
git add js/Home_Studio.js shaders/Home_Studio_Fragment.glsl Home_Studio.html \
        textures/gik244_grey.jpeg textures/gik244_white.jpeg \
        textures/gik244_grey.jpeg.bak-pre-padding-fix \
        textures/gik244_white.jpeg.bak-pre-padding-fix \
        docs/SOP/Debug_Log.md \
        docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md \
        docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-opus.md \
        .omc/plans/HANDOFF-2026-05-15-opus-gik-to-codex.md
```

但因為這幾個檔案在 `MM` 狀態（CODEX staged + OPUS unstaged 都有改動），`git add` 會把 working tree 完整版蓋回 index，會把你已 staged 的部分一併蓋掉。你需要先 commit 自己 staged 的內容，再做這步。順序：

```
# Step 1: 先 commit 你（CODEX）的第一刀 staged 內容
git commit -m "feat(R7-3.10-c1-phase2): land first knife H8 per-surface gate + C' bake UV half-texel fix"

# Step 2: add 並 commit OPUS GIK 改動
git add ...（如上）
git commit -m "fix(gik): rotate north horizontal panel UV + repair texture top/bottom padding"
```

### 選項 B — 你想自己選 commit hunk 粒度

用 `git add -p` 分 hunk 挑。

### 選項 C — 你決定先放著，等使用者再下一輪指示時一起整合

OK，OPUS 不催、不動 git。

---

## 8. 建議的 commit 訊息草稿（你可改）

**CODEX 第一刀**：

```
feat(R7-3.10-c1-phase2): land first knife H8 per-surface gate + C' bake UV half-texel fix

- updateR7310C1FullRoomDiffuseRuntimeUniforms 拆 floor / north applied
- updateR738C1BakePastePreviewUniforms 改為僅與 floor runtime 互斥
- PathTracingCommon bake capture path 移除 +vec2(0.5) 半 texel 偏移
- 1000SPP floor / north 重烘輸出於 .omc/r7-3-10-full-room-diffuse-bake/20260515-{112620,112717}/
- runtime pointer 更新至 2026-05-15 新 package
- Debug_Log 大幅補錄 Phase 2 第一刀執行結果與實機回報

依 docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md 第一刀範圍。
```

**OPUS GIK**：

```
fix(gik): rotate north horizontal panel UV + repair texture top/bottom padding

- box data pixel 4 .b 新增 rotateUV90 旗標（R2-18 保留槽位）
- panelConfig2 N1/N2/N3 三片標記 rotateUV90=1
- shader ACOUSTIC_PANEL 三個 hitNormal 分支結束後加整體 90° UV 旋轉
- textures/gik244_grey.jpeg 頂部 row 0~4 / 底部 row 2907~2911 mirror 修補
- textures/gik244_white.jpeg 頂部 row 0~8 / 底部 row 2907~2911 mirror 修補
- 原貼圖備份於 .bak-pre-padding-fix
- Debug_Log 新增 gik-north-rotate-uv-r4 章節
- Config 1/2/3/4 使用者實機驗收通過

依 docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-opus.md 旁支任務。
```

---

## 9. 驗收清單（供你回顧 / 第二刀回歸檢查）

使用者已通過：

| Config | GIK 位置 | 確認項 |
|---|---|---|
| C1 | E2 / W2 / N_v 三片直擺灰色 GIK | 正面 LOGO 與 GEMINI 標誌位置不變、頂邊無白線（迴歸） |
| C2 | N1 / N2 / N3 三片橫擺灰色 GIK | 順時針 90° 旋轉、無拉寬壓扁、四周無白線；E1-E3 / W1-W3 六片白色 GIK 無白線 |
| C3 | 天花板 Cloud C1-C6 灰色 GIK | 北端 / 南端皆無白線 / 暗線 |
| C4 | 同 C3 | 同 C3 |

第二刀完成後可一併再跑這份回歸（不應有任何變化）。

---

## 10. 對位 plan 檔同步狀態

- `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md` 已更新「協作邊界」+ 新增「2026-05-15 OPUS GIK 修復完成回報」段 + 鎖定禁區段更新。
- `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-opus.md` 已新增對等紀錄段於檔尾。
- `docs/SOP/Debug_Log.md` 已新增 systematic-debugging 完整紀錄章節（id `gik-north-rotate-uv-r4`）。

---

**OPUS 端任務完結。下一步交給 CODEX 決定整合方式與時機。**
