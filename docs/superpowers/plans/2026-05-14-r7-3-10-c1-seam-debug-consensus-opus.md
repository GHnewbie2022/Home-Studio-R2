# R7-3.10 C1 接縫除錯共識與 TODO（OPUS 工作副本）

日期：2026-05-14 起草；2026-05-15 Phase 2 第一刀 + 第二刀完成；2026-05-15 第三刀前 OPUS / CODEX 雙向 10 問共識封口；2026-05-15 件 3 H7' readback probe + follow-up probe + camera-y guard 全完成、CODEX 審查通過、使用者視覺驗收通過；2026-05-15 件 1 / 件 2 H5 / H3' 第二輪以 1024 bake resolution 收斂。
狀態：Phase 1 根因調查已結案；Phase 2 第一刀 H8 + C'、第二刀 B' probe + H7 guard、件 3 H7' camera-y guard、件 1 / 件 2 1024 bake resolution 全完成。
CODEX 審查接受 OPUS guard 實作與 1024 收斂結論。使用者肉眼確認「地板內部已成功全黑、烘焙開關不影響」，並確認東北衣櫃底部南側與頂部北側黑線在 1024 看不出來。
H7' guard 不回退；後續不得改成單看 `firstVisibleIsRayExiting`。C runtime fallback 已移除，不回退。下一步往全相關靜態漫射面烘焙推進。
詳見「## 2026-05-15 R7-3.10 H5/H3' 第二輪收尾：1024 bake resolution」。
範圍：C1 full-room diffuse bake 的衣櫃接縫黑線、地板內部發光、R7-3.10 / R7-3.8 短路路徑互相影響
協作來源：CODEX 與 OPUS 對同一批使用者截圖與觀察的收斂共識

本檔為 OPUS 專用副本，避免與 CODEX 同步打勾衝突。CODEX 的工作副本為同目錄無 `-opus` 後綴版本。

## 給接手代理的閱讀指引

```
1.  本檔為 OPUS 端的 Phase 1 全節紀錄（A / B / C / D / F）；CODEX 在同目錄無 -opus 後綴的主檔有獨立紀錄。
2.  兩份紀錄已經多輪審查收斂，Step F 結束後已達成全面共識，沒有實質矛盾。
3.  CODEX 主檔的「Phase 1 觀察紀錄」表收錄了交叉確認過的證據位置；
      OPUS 副本（本檔）則保留比較詳細的根因鏈推演（A1~A5、B1~B6、C1~C6、D1~D5、F1~F4）。
4.  B' 子任務狀態：
      靜態 code 部分已由 CODEX 結案（BoxIntersect 內存在 isRayExiting，但 R7-3.10 short-circuit 沒讀取它）。
      使用者已確認「相機整個進入地板實體空間內部」，相機位置觸發面不再需要 probe。
      B' shader 當下數值 probe 已於第二刀完成，並導出 H7 exiting-hit guard。
5.  Phase 1 進度：A / B / C / D / E / F 全部完成，Phase 1 結案。
      C / D 結果在「Phase 1 OPUS 發現報告」C 節 / D 節；E 由 CODEX 完成、OPUS 交叉確認，紀錄在 CODEX 主檔；F 由 OPUS 紀錄，見「F 節 — H4 多視角排除」。
```

## 關鍵檔案行號摘要

> **行號漂移注意**：以下行號為 2026-05-15 Phase 2 第二刀 commit `fc6b35f` 之後的快照。
> 後續任何 commit 都可能讓行號偏移，接手請以 `grep` symbol 為準，不要照舊行號插點。

| 主題 | 檔案 | 行號（fc6b35f 快照） | 用途 |
|---|---|---|---|
| r7310 短路函式 | `shaders/Home_Studio_Fragment.glsl` | 546（函式起點） | shader 端 per-surface 分支結構；含 H7 `visibleIsRayExiting == TRUE` guard（L551） |
| r7310 地板表面判定 | `shaders/Home_Studio_Fragment.glsl` | 487（函式起點） | 修前根因快照：此函式 normal-only + position guard，本身未改。現況：H7（第二刀）ray-side guard 已在外層 `r7310C1FullRoomDiffuseShortCircuit`；H7'（第三刀）camera-y guard 已在 R7-3.8 paste path（`uCamPos.y >= 0.025`），CODEX 審查接受、使用者驗收通過、不回退。 |
| r7310 北牆表面判定 | `shaders/Home_Studio_Fragment.glsl` | 493（函式起點） | 含 X / Y / Z 範圍邊界 |
| r7310 短路呼叫位置 | `shaders/Home_Studio_Fragment.glsl` | 2985 | DIFF 分支內，break 跳出 bounce loop；已含 `hitIsRayExiting` 參數 |
| 嫩芽 paste mix 路徑 | `shaders/Home_Studio_Fragment.glsl` | 3106 起（最外層 if 含 `cloudVisibleSurfaceIsFloor(firstVisible*)`） | 受 `uR738C1BakePastePreviewMode` gate。修前根因快照：缺 camera-side guard（件 3）。現況：已加 `uCamPos.y >= 0.025` camera-y guard 於最外層 if，CODEX 審查接受、使用者肉眼確認地板內部全黑、不回退。 |
| r7310 runtime uniform 更新 | `js/InitCommon.js` | 1237（函式起點） | 已拆 `floorApplied` / `northWallApplied`（H8 第一刀） |
| 嫩芽 paste uniform 更新 | `js/InitCommon.js` | 1200（函式起點） | 互斥條件已改為只與 floor runtime 互斥（H8 第一刀） |
| BoxIntersect 主呼叫點 | `shaders/Home_Studio_Fragment.glsl` | 約 L1572 / L1612 / L1630 | 含 isRayExiting 輸出旗標；命中點寫入 `hitIsRayExiting`（第二刀新增） |
| `firstVisible*` 宣告與寫入 | `shaders/Home_Studio_Fragment.glsl` | 1902 起（宣告）/ 1961 起（寫入） | `firstVisibleIsRayExiting` 槽位 H7' probe 已補。現況：此訊號只作 probe 證據（normal / inside view 都 100% exiting，不可單獨當 guard）；實際 guard 採 `uCamPos.y >= 0.025` camera-y guard，不依賴此槽位。 |
| UI 開關按鈕 | `Home_Studio.html` | 53–54 | btn-r7310-floor-diffuse、btn-r7310-north-wall-diffuse |

## B' 子任務狀態（已結案，保留為歷史紀錄）

> **2026-05-15 更新**：B' probe 已於第二刀完成，本段降級為歷史紀錄。
> 完整 B' 量測結果與 H7 guard 證據鏈見「## 2026-05-15 Phase 2 第一刀 + 第二刀完成 + 第三刀前共識封口」。

```
靜態 code 部分：CODEX 已結案。
      js/PathTracingCommon.js BoxIntersect 在 ray 位於 box 內部時
      會走 t1 分支並設 isRayExiting = TRUE，但原 R7-3.10 short-circuit 沒讀取它。
      所以 H7 的「短路缺 inside-geometry / ray-side guard」結論在靜態程式碼層級成立。

觸發面情境部分：已由使用者觀察確認。
      使用者已確認：
        a. 相機整個進入地板實體空間內部。
        b. 在內部移動可看到多個 baked surface 貼圖發光。
        c. 家具區呈黑色陰影（與 H5 atlas footprint 暗區直接對應）。

B' probe 實作（第二刀已完成）：
      shader 端擴充 uR7310C1RuntimeProbeMode levels 2~6（visibleNormal、visiblePosY、
      rayDirY、isRayExiting、cameraPosY），並新增 hitIsRayExiting hit-state；
      JS 端擴充 reportR7310C1FullRoomDiffuseRuntimeProbe(options) 加 probeLevel /
      samplePoints / samplePointSpace / decodeMode 與 rtPixel / decoded 回傳欄位。

B' 量測結果（第二刀已完成）：
      pre-guard inside-floor L5 sample = isRayExiting TRUE
      pre-guard inside-floor L1 short = 879262 / 921600
      post-guard inside-floor L1 short = 0
      post-guard 正常 runtime smoke：bakedSurfaceHitCount = 96170 / shortCircuit = 190559

H7 guard（第二刀已實作）：
      r7310C1FullRoomDiffuseShortCircuit 入口加 visibleIsRayExiting == TRUE 排除。
      使用者實機驗收通過：地板烘焙 ON 時地板內部全黑。

H5 / H3' 證據（持續成立）：
      atlas 內 furniture footprint / contact 相關範圍的暗值分布
      在相機從地板實體內部看時被直接攤開檢視。
      第一刀 C' 修正後再次揭露：fixed-Z / fixed-Y 邊界格 nearest-policy 衝突
      （件 1 / 件 2 → H5 / H3' 第二輪）。
```

## 使用方式

本檔用來鎖定目前假設編號、優先順序與證據收集進度。接手代理先讀本檔，再依 TODO 表逐項執行。
Phase 1 已結案。Phase 2 紀律：B' / C' / 修法方案需先設計共識再動 code，不允許跳 code 修；不回到舊 flood-fill / contact invalid 路線。

## 使用者觀察

| 狀態 | 觀察 | 初步意義 |
|---|---|---|
| - [x] | 北牆烘焙開啟時，衣櫃西側面與北牆的垂直接縫出現黑線。 | 問題落在固定 X 邊界。 |
| - [x] | 北牆烘焙開啟時，衣櫃頂面與北牆的水平接縫乾淨。 | 固定 Y 邊界暫未重現同型黑線。 |
| - [x] | 地板烘焙開啟時，衣櫃西側與地板的南北向接縫出現黑線。 | 同樣落在固定 X 邊界。 |
| - [x] | 地板烘焙開啟時，衣櫃南側與地板的東西向接縫乾淨。 | 固定 Z 邊界暫未重現同型黑線。 |
| - [x] | 相機進入地板內部、地板烘焙開啟時，整片地板表面發光，且看得到家具 footprint 暗影。 | baked radiance 被直接貼回，且 floor atlas 內已有家具暗區。 |
| - [x] | 地板烘焙關閉、北牆烘焙關閉時，只看到 R7-3.8 嫩芽區發光。 | R7-3.8 嫩芽路徑仍可顯示。 |
| - [x] | 地板烘焙關閉、北牆烘焙開啟時，R7-3.8 嫩芽區發光消失。 | R7-3.10 北牆開關影響了非北牆區域。 |
| - [x] | Step F 多視角複查：地板烘焙開啟時，東北衣櫃底部南側接縫乾淨、西側接縫黑線。 | 斜視角度下 fixed-Z 邊界仍乾淨，fixed-X 仍黑線；排除 H4 透視壓縮假設。 |
| - [x] | Step F 多視角複查：北牆烘焙開啟時，東北衣櫃頂部北側接縫乾淨、西側接縫黑線。 | 斜視角度下 fixed-Y 邊界仍乾淨，fixed-X 仍黑線；排除 H4 透視壓縮假設。 |

## 已鎖定假設表

| 狀態 | 編號 | 假設 | 目前排序 | 判定 |
|---|---|---|---|---|
| - [x] | H1a | 雙線性混合造成黑線。 | 無 | 撤回。runtime 目前使用 `NearestFilter`。 |
| - [x] | H1b | `NearestFilter` 的 texel-center 邊界選取對 X 邊界敏感（U 軸 axis-level 泛化版本）。 | 撤回 | **泛化 U 軸版本正式撤回**：Step E 顯示東牆 U 軸（Z=-0.703）是亮邊界，axis-level 假設不成立。「fixed-X / wardrobe xMin texel-center 特例」併入 Phase 2 C' 子任務，不再以 atlas U / V 軸角度追查。 |
| - [x] | H3' | shared occluder / alpha policy 缺口，衣櫃 footprint 或 contact 區仍被當有效烘焙資料。 | 第三組 | **強烈確認**：Step C 量化顯示衣櫃 footprint / contact 相關範圍 atlas alpha 全為 1.0，衣櫃 footprint 內 luma=0 直接寫入；沒有 occluder mask、沒有 dilation。註：north wall 門洞區仍有 alpha=0，本結論限定在「衣櫃相關範圍」。詳見 C / D 結果。 |
| - [x] | H4 | 透視壓縮造成其他邊界黑線不可見。 | 已排除 | **正式排除**：Step F 使用者多視角複查顯示 fixed-Y / fixed-Z 接縫在斜視角度下仍乾淨，fixed-X 接縫在同樣斜角度下仍黑線。若 H4 成立應觀察到角度依存差異，實機結果與 atlas 量化結果方向一致。 |
| - [x] | H5 | bake 端 atlas 已含家具 footprint 暗區。 | 第三組 | **強烈確認**：Step C 量化顯示 X=1.35 邊界 luma 從 0.32 暴跌到 0.0036，Z=-0.703 / Y=1.955 邊界往「內」反而是亮值。X 與 V 軸邊界處理不對稱是 V 軸無黑線的直接原因。詳見 C / D 結果。 |
| - [ ] | H6 | runtime hit / UV / epsilon 一般情況造成衣櫃西側附近選錯 texel 或判錯 hit。 | 第四組 | 保留，待 H8 / H7 / H5 結果後再升降權。 |
| - [x] | H7 | floor short-circuit 套用範圍太寬，包含穿模、背面或內面視角。 | 第二 | **靜態 code 條件缺口成立 + 相機位置觸發面已由使用者確認**：r7310C1RuntimeSurfaceIsTrueFloor 只檢查 objectID + normal.y + position.y，缺少相機位置 / ray origin / ray direction guard。BoxIntersect 靜態資訊已確認，`isRayExiting` 存在但 short-circuit 未使用。使用者已確認相機整個進入地板實體空間內部，並可看到多個 baked surface 貼圖發光。B' 改為 shader 當下數值 probe（camera position / ray origin / visibleNormal / visiblePosition / isRayExiting / 短路命中表面），留 Phase 2。 |
| - [x] | H8 | per-surface 開關沒有真正隔離，R7-3.10 全域狀態污染 R7-3.8 嫩芽路徑。 | 第一 | **強烈確認**：嫩芽 paste 的 applied 條件含 `!r7310RuntimeApplied`，任一 R7-3.10 surface（floor 或 north wall）啟用且 ready 時即關閉嫩芽 paste。直接命中「北牆開、嫩芽消失」症狀。詳見 A3 / A4。 |

## 優先順序

| 狀態 | 排序 | 假設 | 理由 |
|---|---|---|---|
| - [x] | 1 | H8 | gate 污染會讓 floor-only / north-only isolation 觀察不乾淨。 |
| - [x] | 2 | H7 | 地板內部發光表示短路範圍可能套到不合理視角。 |
| - [x] | 3 | H5 / H3' | raw atlas 已量化確認暗帶存在；衣櫃相關範圍 atlas alpha 全為 1.0；剩下 C' 追查 fixed-X 暗帶外溢來源，留 Phase 2。 |
| - [x] | 4 | H6 / H1b | H1b 泛化 U 軸版本經 Step E 已撤回；H6 仍保留低權重待 runtime probe。 |
| - [x] | 5 | H4 | 已排除：Step F 多視角實機觀察與 atlas 量化方向一致，H4 解釋力歸零。 |

## Phase 1 TODO

| 狀態 | 步驟 | 目標假設 | 要讀或檢查的範圍 | 產出 |
|---|---|---|---|---|
| - [x] | A | H8 | `r7310C1FullRoomDiffuseShortCircuit()`、所有 R7-3.10 uniform / mode flag / ready flag、R7-3.8 與 R7-3.10 短路呼叫順序與互斥條件。 | **已完成**：詳見下方「Phase 1 OPUS 發現報告」A 節。H8 強烈確認。 |
| - [x] | B | H7 | hit normal 用法、相機 / ray origin 與地板 box 的相對位置、背面 / 內面條件、BoxIntersect 法線輸出方向。 | **已完成**：詳見下方「Phase 1 OPUS 發現報告」B 節。H7 靜態條件缺口成立；BoxIntersect 靜態行為已由 CODEX 結案（`isRayExiting` 存在但 short-circuit 未使用）。使用者已確認相機觸發面進入地板實體內部；第二刀 B' probe 已完成，並導出 H7 exiting-hit guard。 |
| - [x] | C | H5 / H3' | raw atlas column / row：floor `20260513-165203`、north `20260513-210338`。 | **已完成**：詳見下方 C / D 發現報告。H5 / H3' 強烈確認。 |
| - [x] | D | H5 / H3' | `texel-metadata-patch-000-f32.bin`。 | **已完成**：詳見下方 C / D 發現報告。找到 X 邊界 texel center 在外側 2mm 但烘焙成內側暗值的不對稱現象。 |
| - [x] | E | H1b / H6 | east wall 歷史包 `20260513-214539`。 | **由 CODEX 完成、OPUS 交叉確認**：東牆 U 軸 Z=-0.703 接縫格 mean luma=0.539942（亮邊界）、Y=1.955 接縫格 mean=0.294735。axis-level 假設不成立，H1b 泛化 U 軸版本撤回；wardrobe xMin instance-level 勝出，併入 Phase 2 C'。詳見 CODEX 主檔 E 節。 |
| - [x] | F | H4 | 使用者多視角複查。 | **已完成**：詳見下方「F 節 — H4 多視角排除」。H4 正式排除。 |

## Phase 1 OPUS 發現報告（A / B / C / D / F 全節結果）

完成日期：2026-05-14。
A / B / C / D 為讀檔與靜態 code 證據，未動 code。
F 為使用者實機多視角觀察 + atlas 量化交叉驗證。
E 由 CODEX 完成、OPUS 交叉確認，紀錄在 CODEX 主檔。

### A 節 — H8（per-surface 開關沒有真正隔離）

**結論：強烈確認。**

#### A1. Shader 端 per-surface gate 結構（隔離正確）

`shaders/Home_Studio_Fragment.glsl:543-565` 的 `r7310C1FullRoomDiffuseShortCircuit()` 內部：

```glsl
// L546：外層 gate
if (uR7310C1FullRoomDiffuseMode < 0.5 || uR7310C1FullRoomDiffuseReady < 0.5)
    return false;
// L549–555：floor 分支獨立 gate `uR7310C1FloorDiffuseMode > 0.5`
// L556–563：north wall 分支獨立 gate `uR7310C1NorthWallDiffuseMode > 0.5`
```

shader 內部 floor 與 north wall 分支條件是分離的。

#### A2. JS 端 applied 邏輯（污染來源）

`js/InitCommon.js:1211-1241` 的 `updateR7310C1FullRoomDiffuseRuntimeUniforms()`：

```js
// L1215
var surfaceEnabled = r7310C1FloorDiffuseRuntimeEnabled || r7310C1NorthWallDiffuseRuntimeEnabled;
// L1216–1220
var applied = surfaceEnabled &&
    r7310C1FullRoomDiffuseRuntimeReady &&
    r7310C1NorthWallDiffuseRuntimeReady &&        // ← 強制要求 NorthWallReady
    r7310C1FullRoomDiffuseRuntimeConfigAllowed() &&
    captureMode === 0;
// L1222
pathTracingUniforms.uR7310C1FullRoomDiffuseMode.value = applied ? 1.0 : 0.0;
// L1226 / L1228
pathTracingUniforms.uR7310C1FloorDiffuseMode.value = applied && r7310C1FloorDiffuseRuntimeEnabled ? 1.0 : 0.0;
pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value = applied && r7310C1NorthWallDiffuseRuntimeEnabled ? 1.0 : 0.0;
```

關鍵 cross-coupling：

```
1.  applied 同時要求 FullRoomDiffuseReady 與 NorthWallDiffuseReady。
2.  所以即使只想啟用 floor，若 NorthWallReady 還沒完成載入，
    整個 applied = false，連 floor 都關掉。
3.  反過來：只要 surface 任一打開（floor OR northwall）且兩個 ready 都完成，
    applied = true，全域 uR7310C1FullRoomDiffuseMode 翻成 1.0。
```

#### A3. 嫩芽 paste preview 互斥邏輯（污染後果）

`js/InitCommon.js:1174-1203` 的 `updateR738C1BakePastePreviewUniforms()`：

```js
// js/InitCommon.js:1178-1181（在 updateR738C1BakePastePreviewUniforms 內）
var r7310RuntimeApplied =
    (r7310C1FloorDiffuseRuntimeEnabled || r7310C1NorthWallDiffuseRuntimeEnabled) &&
    r7310C1FullRoomDiffuseRuntimeReady &&
    r7310C1FullRoomDiffuseRuntimeConfigAllowed() &&
    captureMode === 0;
// js/InitCommon.js:1182-1186
var applied = r738C1BakePastePreviewEnabled &&
    r738C1BakePastePreviewReady &&
    r738C1BakePastePreviewConfigAllowed() &&
    captureMode === 0 &&
    !r7310RuntimeApplied;                          // ← 直接互斥
// js/InitCommon.js:1188
pathTracingUniforms.uR738C1BakePastePreviewMode.value = applied ? 1.0 : 0.0;
```

註：本函式裡的 `r7310RuntimeApplied` 只要求 `r7310C1FullRoomDiffuseRuntimeReady`；
與 A2 引用的 `updateR7310C1FullRoomDiffuseRuntimeUniforms()` 內的 `applied` 不同
（後者同時要求 `r7310C1NorthWallDiffuseRuntimeReady`）。兩個 applied 是兩個函式各自的區域變數。

#### A4. 根因鏈

```
1.  使用者點「北牆烘焙：開」按鈕。
2.  r7310C1NorthWallDiffuseRuntimeEnabled = true。
3.  updateR7310C1FullRoomDiffuseRuntimeUniforms() 內：
      surfaceEnabled = true。
      applied = true（其他前置條件滿足）。
      uR7310C1FullRoomDiffuseMode = 1.0。
4.  updateR738C1BakePastePreviewUniforms() 內：
      r7310RuntimeApplied = true。
      嫩芽 paste applied = ... && !r7310RuntimeApplied = false。
      uR738C1BakePastePreviewMode = 0.0。
5.  shader L3074–3086 嫩芽 paste post-process 因 mode=0 整段跳過。
6.  使用者看到「嫩芽消失」。
```

這條鏈是設計上的互斥，不是 bug 旁徵側流。R7-3.10 與 R7-3.8 被當成兩條互斥路徑，
任一 R7-3.10 surface 啟用就會關掉嫩芽 paste。

#### A5. 對接縫黑線症狀的影響

```
1.  floor / north wall 獨立開關是 UI 假象，shader uniform 同步隨 single applied 旗標翻動。
2.  使用者用「只開地板」「只開北牆」做 isolation 觀察時，
    背後其實兩個 mode 都是 applied 旗標控制下的子集，
    且 R7-3.8 嫩芽 paste 在兩種情境都被關閉。
3.  CODEX 在共識中所說「gate 污染會讓 floor-only / north-only isolation 觀察不乾淨」
    已從程式碼層級確認。
```

---

### B 節 — H7（floor short-circuit 套用範圍太寬）

**結論：靜態 code 條件缺口成立。BoxIntersect 靜態細節已由 CODEX 結案（isRayExiting 存在但 short-circuit 沒讀取）。相機位置觸發面已由使用者確認（相機整個進入地板實體內部）。B' 後續用途改為 shader 當下數值 probe，留 Phase 2。**

#### B1. r7310C1RuntimeSurfaceIsTrueFloor 條件清單

`shaders/Home_Studio_Fragment.glsl:484-489`：

```glsl
bool r7310C1RuntimeSurfaceIsTrueFloor(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
    return visibleObjectID < 1.5 &&
        visibleNormal.y > 0.5 &&
        visiblePosition.y <= 0.025;
}
```

#### B2. 缺項清單

```
1.  ✗ 相機位置 guard：未檢查 cameraPosition 是否在地板實體內。
2.  ✗ ray origin guard：未檢查 rayOrigin.y 是否在地板上表面之上。
3.  ✗ ray direction guard：未檢查 rayDirection.y 是否向下（從上方入射）。
4.  ✗ Inside-geometry guard：未檢查命中是否為 box 的內表面。
5.  ✓ normal 方向：用 `visibleNormal.y > 0.5`，但仰賴 nl 與 BoxIntersect 法線方向慣例正確。
```

對應 CODEX 的修正：normal 確實有檢查（CODEX 已糾正我先前「沒檢查」的錯誤陳述），缺的是 ray-side / inside-geometry guard。

#### B3. 呼叫位置與參數

`shaders/Home_Studio_Fragment.glsl:2964`：

```glsl
if (r7310C1FullRoomDiffuseShortCircuit(hitType, hitObjectID, nl, x, r7310BakedRadiance))
{
    if (uR7310C1RuntimeProbeMode > 0.5)
        accumCol += ...; // diagnostic colors
    else
        accumCol += mask * r7310BakedRadiance;
    break;
}
```

第三參數傳 `nl`（front-facing normal）。

#### B4. nl 翻轉與 BoxIntersect 慣例

```
1.  標準路徑追蹤：nl = (dot(rayDirection, hitNormal) < 0) ? hitNormal : -hitNormal。
2.  地板 box 上表面：outward normal = (0, +1, 0)。
3.  相機在房間內、ray 向下打到地板上表面：
      dot(rayDir, n) = (0,-1,0) · (0,+1,0) = -1 < 0
      nl = n = (0, +1, 0) → nl.y = +1 → 通過 `> 0.5` 檢查 ✓
4.  相機在地板實體內或下方、ray 向上：
      若 BoxIntersect 對「相機在 box 內」回傳 exit 點且外向法線方向不翻：
        n = (0, +1, 0)（外向）
        dot(rayDir, n) = +1 > 0
        nl = -n = (0, -1, 0) → nl.y = -1 → 不通過 ✗
5.  以上分析顯示：若 BoxIntersect 行為標準、nl 翻轉正確，
    從下方仰望理論上應該 fail。
    但使用者實際截圖顯示「從下方仰望地板仍發光」。
    所以 BoxIntersect 對 inside-hit 法線輸出可能與標準慣例不同。
```

#### B5. 已找到的 BoxIntersect 線索

`shaders/Home_Studio_Fragment.glsl:1564`：

```glsl
d = BoxIntersect(boxMin, boxMax, rayOrigin, rayDirection, n, isRayExiting);
```

BoxIntersect 有 `isRayExiting` 輸出旗標，代表函式知道光線是進入還是離開 box。
但目前 short-circuit 路徑沒有讀取 `isRayExiting`，所以 inside-hit 是否會通過 normal 檢查
取決於 BoxIntersect 在 ray exit 時對 `n` 的方向慣例。CODEX 已確認 BoxIntersect 內存在 `isRayExiting` 但 R7-3.10 short-circuit 沒讀取它（見 `js/PathTracingCommon.js:2748-2772`），所以 BoxIntersect 靜態行為已結案。使用者也已確認相機整個進入地板實體內部，相機位置觸發面不再待 probe；第二刀 B' probe 已完成，並確認 inside-floor 視角為 exiting hit。

#### B6. 對接縫黑線症狀的關連

```
1.  H7 直接解釋「地板下方仰望仍發光」現象。
2.  H7 對接縫黑線的關連較弱，黑線症狀仍高度指向 H5 / H3'。
3.  H7 與 H8 共同顯示 R7-3.10 短路架構在「啟動範圍」上設計太寬。
4.  即使 H7 修好（加 inside-geometry guard），接縫黑線仍可能存在，
    因為黑線根因在 atlas 內家具 footprint 暗區（H5 / H3'）。
    Step C / D 已確認 raw atlas 暗帶與 Y / Z 亮 rim；剩 C' 追查 fixed-X 暗帶外溢來源，留 Phase 2。
```

---

### C 節 — H5（atlas 內含家具 footprint 暗區）

**結論：強烈確認。X 軸 / V 軸邊界處理不對稱已直接找到根因指紋。**

完成日期：2026-05-14。分析腳本：`docs/tools/r7-3-10-step-c-d-analyze.mjs`。

#### C1. 取樣設定

```
Floor package：.omc/r7-3-10-full-room-diffuse-bake/20260513-165203
North wall package：.omc/r7-3-10-full-room-diffuse-bake/20260513-210338
Atlas 解析度：512 × 512，RGBA Float32
Metadata：12 floats / texel（worldPos[3], worldNormal[3], type, configId, padding[2], u, v）
衣櫃 OOBB：X[1.35, 1.91], Y[0, 1.955], Z[-1.874, -0.703]
```

#### C2. Floor X=1.35 邊界（黑線邊界）luma 切片

```
col 414 (dx=-5, 外側 41mm)   mean luma 0.3263
col 418 (dx=-1, 外側  9mm)   mean luma 0.3190
col 419 (dx=+0, 邊界 / 外側 2mm)   mean luma 0.0036  ← 暴跌
col 420 (dx=+1, 內側  6mm)   mean luma 0.0037
col 424 (dx=+5, 內側 41mm)   mean luma 0.0036
取樣紋素 Alpha = 1.000（限定於本切片範圍），n = 113 texel / column。
```

跳變寬度：< 1 texel（X pitch ≈ 8.24mm）。

#### C3. Floor Z=-0.703 邊界（乾淨邊界）luma 切片

```
row 126 (dy=-5, 內側 51mm)   mean luma 0.0000
row 130 (dy=-1, 內側 12mm)   mean luma 0.0000
row 131 (dy=+0, 邊界 / 內側 2mm)   mean luma 0.3675  ← 暴升「往外」
row 132 (dy=+1, 外側  8mm)   mean luma 0.3713
row 136 (dy=+5, 外側 49mm)   mean luma 0.3816
取樣紋素 Alpha = 1.000（限定於本切片範圍），n = 69 texel / row。
```

#### C4. North wall X=1.35 邊界（黑線邊界）luma 切片

```
col 418 (dx=-1, 外側  9mm)   mean luma 0.4114
col 419 (dx=+0, 邊界 / 外側 2mm)   mean luma 0.0010  ← 暴跌
col 420 (dx=+1, 內側  6mm)   mean luma 0.0008
取樣紋素 Alpha = 1.000（限定於本切片範圍），n = 345 texel / column。
```

#### C5. North wall Y=1.955 邊界（乾淨邊界）luma 切片

```
row 343 (dy=-1, 內側 6mm)   mean luma 0.0000
row 344 (dy=+0, 邊界 / 內側 0mm)   mean luma 0.2530  ← 暴升「往外」
row 345 (dy=+1, 外側 5mm)   mean luma 0.2559
取樣紋素 Alpha = 1.000（限定於本切片範圍），n = 69 texel / row。
```

#### C6. Atlas 內容結構

```
1.  衣櫃 footprint / contact 相關範圍 Alpha 通道全部 = 1.0：
      烘焙完全沒有把衣櫃 footprint 紋素標為 invalid。
      H3'（shared occluder / alpha policy 缺口）強烈確認。
      註：north wall 門洞區仍有 alpha = 0，本結論限定在「衣櫃相關範圍」，
      不是「整張 atlas alpha 全 1.0」。
2.  衣櫃 footprint 內部紋素：mean luma = 0 / 接近 0（純黑）。
3.  衣櫃外部紋素：mean luma = 0.25 ~ 0.42（正常受光）。
4.  邊界紋素行為「不對稱」：
      X 邊界（col 419, worldX=1.348, 應在衣櫃外 2mm）→ luma=0.0036，被當衣櫃內。
      Z 邊界（row 131, worldZ=-0.705, 應在衣櫃內 2mm）→ luma=0.3675，被當衣櫃外。
      Y 邊界（row 344, worldY=1.955, 剛好邊界）→ luma=0.2530，被當衣櫃外。
5.  Metadata `valid` 欄位（floor index[7]）全為 0，這是寫入慣例、不是 invalid mask 訊號。
      H3' 主要證據放在 atlas alpha 與 raw luma 暗帶，metadata valid 不單獨拿來當 mask 證據。
```

---

### D 節 — Metadata（紋素中心相對衣櫃 OOBB 的位置）

**結論：metadata 顯示 texel center 直接落在邊界附近，但烘焙結果與 metadata 預期方向相反。**

#### D1. Floor X=1.35 邊界附近 texel center

```
col 417 worldX = 1.331  → 應在衣櫃外  9mm  → luma 0.32 ✓ 一致
col 418 worldX = 1.339  → 應在衣櫃外  2mm  → luma 0.32 ✓ 一致
col 419 worldX = 1.348  → 應在衣櫃外  2mm  → luma 0.0036 ✗ 反直覺（變成衣櫃內）
col 420 worldX = 1.356  → 應在衣櫃內  6mm  → luma 0.0037 ✓ 一致
col 421 worldX = 1.364  → 應在衣櫃內 14mm  → luma 0.0037 ✓ 一致
```

#### D2. Floor Z=-0.703 邊界附近 texel center

```
row 129 worldZ = -0.726 → 應在衣櫃內 23mm  → luma 0.0000 ✓ 一致
row 130 worldZ = -0.715 → 應在衣櫃內 12mm  → luma 0.0000 ✓ 一致
row 131 worldZ = -0.705 → 應在衣櫃內  2mm  → luma 0.3675 ✗ 反直覺（變成衣櫃外）
row 132 worldZ = -0.695 → 應在衣櫃外  8mm  → luma 0.3713 ✓ 一致
row 133 worldZ = -0.684 → 應在衣櫃外 19mm  → luma 0.3726 ✓ 一致
```

#### D3. North wall Y=1.955 邊界附近 texel center

```
row 343 worldY = 1.949 → 應在衣櫃內 6mm  → luma 0.0000 ✓ 一致
row 344 worldY = 1.955 → 剛好邊界          → luma 0.2530 ✗ 邊界紋素被當衣櫃外
row 345 worldY = 1.960 → 應在衣櫃外 5mm  → luma 0.2559 ✓ 一致
```

#### D4. 不對稱根因（待 C' 子任務確認）

```
1.  X 軸邊界 texel（worldX=1.348，理論外側 2mm）烘焙成「衣櫃內」暗值。
2.  Z 軸邊界 texel（worldZ=-0.705，理論內側 2mm）烘焙成「衣櫃外」亮值。
3.  Y 軸邊界 texel（worldY=1.955，剛好邊界）烘焙成「衣櫃外」亮值。
4.  方向性結論：
      X 軸：邊界 texel「歸內」（暗區比幾何邊往外擴 ≈ 1 texel）。
      Z / Y 軸：邊界 texel「歸外」（亮區直接覆蓋到幾何邊）。
5.  可能原因（C' 子任務待查）：
      a. 衣櫃在 scene 中的 BoxIntersect xMin 不是嚴格 1.35，
         可能含 epsilon padding（例如 xMin=1.348）。
      b. 烘焙 surface point 沿某個方向 nudge 偏移，X 軸有偏 +X 方向。
      c. 浮點精度 / ray epsilon 在 X vs Z / Y 軸判定上不一致。
6.  C' 子任務不在 Phase 1 必修範圍，可留待 Phase 2 確認後再修。
```

#### D5. 對接縫黑線的解釋（H5 完整因果鏈）

```
1.  X 邊界 atlas 表現：
      atlas X 軸方向，衣櫃 footprint「暗區」起點比幾何邊提早 ≈ 1 texel（8mm）。
2.  從相機視角看：
      相機看到地板上 X ∈ [1.342, 1.350] 這片約 8mm 寬地板，
      照理應該是亮的（在衣櫃外），但 atlas 給暗值。
3.  NearestFilter 命中這片暗紋素：
      runtime 把這 8mm 寬條帶染黑，畫面上呈現一條沿 Z 軸延伸的黑線。
4.  Y / Z 邊界 atlas 表現：
      邊界 texel 直接給亮值，亮區覆蓋到衣櫃幾何邊。
      從相機視角看，衣櫃幾何邊兩側都是亮，沒有銳利視覺跳變。
5.  「為何 V 軸沒黑線」之謎完整解開：
      不是 V 軸沒 atlas dark texel，而是 V 軸邊界 texel「方向歸類」剛好朝外，
      因此沒形成「暗區擴張到衣櫃幾何邊外側」這個視覺現象。
```

---

### F 節 — H4（透視壓縮）多視角排除

**結論：H4 正式排除。**

完成日期：2026-05-14。證據來源：使用者實機多視角複查 + 截圖回報。

#### F1. 實機觀察（東北衣櫃）

```
情境 1：地板烘焙：開、北牆烘焙：關
   觀察點：東北衣櫃底部南側接縫（fixed-Z，z=-0.703，東西向水平線）
   結果：接縫乾淨，無黑線。
   觀察點：東北衣櫃西側接縫（fixed-X，x=1.35，南北向垂直線）
   結果：黑線清楚可見。

情境 2：地板烘焙：關、北牆烘焙：開
   觀察點：東北衣櫃頂部北側接縫（fixed-Y，y=1.955，東西向水平線）
   結果：接縫乾淨，無黑線。
   觀察點：東北衣櫃西側接縫（fixed-X，x=1.35，南北向垂直線）
   結果：黑線清楚可見。
```

#### F2. 視角條件

```
1.  使用者截圖中的攝影機角度屬於「斜視」而非「正交」：
      可同時看到衣櫃兩個鄰接面（南面+西面、頂面+西面），
      代表光軸與兩個邊界平面都不是嚴格垂直。
2.  斜視角度下透視壓縮應該「最小」，被遮蔽的瑕疵反而最容易暴露。
3.  若 H4 成立（透視壓縮造成 fixed-Y / fixed-Z 黑線不可見），
      預期在斜視角度應看到 fixed-Y / fixed-Z 黑線出現。
4.  實際觀察：fixed-Y / fixed-Z 仍乾淨，fixed-X 黑線同角度下仍可見。
5.  結論：透視壓縮並非 fixed-Y / fixed-Z 接縫看起來乾淨的原因。
```

#### F3. 與 atlas 量化結果交叉確認

```
1.  Step C / D 已量化：
      fixed-X 邊界外側第一格 luma 暴跌（暗區外溢到衣櫃幾何邊外側 ≈ 8mm）。
      fixed-Y / fixed-Z 邊界接縫第一格 luma 維持亮值（亮 rim）。
2.  Step F 實機觀察方向與 atlas 量化方向完全一致：
      fixed-X：atlas 暗 → 畫面黑線 ✓
      fixed-Y / fixed-Z：atlas 亮 rim → 畫面乾淨 ✓
3.  atlas 二進位資料已能完整解釋「為何 V 軸沒黑線」，H4 無額外解釋力。
```

#### F4. 假設樹效果

```
1.  H4 由「排除項」改為「正式排除」。
2.  原本「H4 解釋力極低」的判斷由實機觀察補上最後一塊證據。
3.  Phase 1 全部 TODO 結案：A / B / C / D / E / F 全完成。
```

---

### 對假設樹的影響

```
1.  H8 從「保留待驗」升級為「強烈確認」（A 節）。
2.  H7 從「待 shader 條件審查」升級為「靜態 code 條件缺口成立 + 相機位置觸發面已由使用者確認」，
      B' 改為 shader 當下數值 probe，留 Phase 2。
3.  H5 從「高信心、待量化」升級為「強烈確認」，並找到不對稱現象與精準暗區寬度（C / D 節）。
4.  H3' 從「保留待量化」升級為「強烈確認」
      （衣櫃 footprint / contact 相關範圍 atlas alpha 全 = 1.0，沒有 occluder mask）。
5.  H1b 泛化 U 軸 axis-level 版本「正式撤回」：
      Step E 顯示東牆 U 軸（Z=-0.703）亮邊界，axis-level 假設不成立。
      「fixed-X / wardrobe xMin texel-center 特例」併入 Phase 2 C' 子任務，
      不再以 atlas U / V 軸角度追查。
6.  H6 維持低權重保留，待 runtime probe 才能進一步升降權。
7.  H4 已正式排除（Step F）：使用者多視角實機觀察方向與 atlas 量化方向一致，
      fixed-Y / fixed-Z 在斜視角度下仍乾淨，fixed-X 同角度下仍黑線。
8.  新增 C' 子任務：
      確認 wardrobe xMin（X=1.35 幾何邊）為何在 atlas 中暗區外溢 ≈ 1 texel。
      候選方向：
        a. 衣櫃 BoxIntersect / OOBB epsilon。
        b. bake surface point 沿某方向 nudge（OPUS 推測可能取 +U +V 角而非中心）。
        c. ray origin offset / 浮點邊界判定不對稱。
      不在 Phase 1 必修範圍，留 Phase 2 統一處理。
```

### Step F 完成紀要

```
1.  A / B / C / D / E / F 全部完成。
2.  Step F 由使用者實機多視角複查完成，H4（透視壓縮）正式排除。
      實機觀察方向與 Step C / D atlas 量化方向一致：
      fixed-X 邊界畫面有黑線（atlas 暗區外溢 ≈ 8mm）。
      fixed-Y / fixed-Z 邊界畫面乾淨（atlas 邊界亮 rim）。
3.  runtime 視覺對照（floor-only / north-only 對開實驗）在 H8 / H7 未修前不要做，
      因為 gate 污染會讓觀察不可信。
      Step F 屬於「同情境多角度」對照，未踩到這條禁區。
4.  H8 / H7 / B' shader 數值 probe / C' 邊界不對稱根因的處理留到 Phase 2，本檔不提修法。
```

---

## Raw Atlas 量化 TODO

| 狀態 | Package | Surface | 切片 | 目的 | 結果 |
|---|---|---|---|---|---|
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-165203/` | floor | X=1.35 column | 檢查衣櫃西側 fixed-X 暗區。 | 邊界紋素 luma 0.32 → 0.0036 暴跌；暗區比幾何邊往外擴約 1 texel（≈8mm）。 |
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-165203/` | floor | Z=-0.703 row | 對照衣櫃南側固定 Z 邊界。 | 邊界紋素 luma=0.3675，跟外側 0.3713 幾乎相同，無視覺跳變。 |
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-210338/` | north wall | X=1.35 column | 檢查衣櫃西側 fixed-X 暗區。 | 邊界紋素 luma 0.41 → 0.0010 暴跌；與 floor X 邊界同型。 |
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-210338/` | north wall | Y=1.955 row | 對照衣櫃頂面固定 Y 邊界。 | 邊界紋素 luma=0.2530，跟外側 0.2559 幾乎相同，無視覺跳變。 |
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-214539/` | east wall | Z=-0.703 對應邊界 | 鑑別 axis-level 與 instance-level。 | CODEX：接縫格 mean luma=0.539942（亮邊界，U 軸無外溢黑線）。打掉 axis-level 假設。 |
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-214539/` | east wall | Y=1.955 對應邊界 | 鑑別 axis-level 與 instance-level。 | CODEX：接縫格 mean luma=0.294735（亮邊界）。與 floor / north V 軸同型。 |

## Metadata TODO

| 狀態 | Package | Surface | 邊界 | 要確認的 texel center | 結果 |
|---|---|---|---|---|---|
| - [x] | `20260513-165203` | floor | X=1.35 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | 邊界 texel center 在外側 2mm（worldX=1.348）但烘焙為衣櫃內暗值。方向歸類偏內。 |
| - [x] | `20260513-165203` | floor | Z=-0.703 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | 邊界 texel center 在內側 2mm（worldZ=-0.705）但烘焙為衣櫃外亮值。方向歸類偏外。 |
| - [x] | `20260513-210338` | north wall | X=1.35 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | 同 floor X 邊界，邊界 texel center 在外側 2mm 但烘焙為內側暗值。 |
| - [x] | `20260513-210338` | north wall | Y=1.955 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | 邊界 texel center 剛好在 Y=1.955 但烘焙為衣櫃外亮值。方向歸類偏外。 |
| - [x] | `20260513-214539` | east wall | Z=-0.703 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | CODEX 確認東牆 U 軸（Z=-0.703）為亮邊界、無外溢黑線。詳見 CODEX 主檔 E 節。 |
| - [x] | `20260513-214539` | east wall | Y=1.955 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | CODEX 確認東牆 V 軸（Y=1.955）為亮邊界。 |

## Phase 2 候選子任務（已完成 / 進入第三刀）

| 狀態 | 子任務 | 目標 | 結果 |
|---|---|---|---|
| - [x] | B' | shader 當下數值 probe：量化 H7 觸發面的具體執行路徑。 | **第二刀已完成**。shader probe levels 2~6 + JS readback API 擴充已實作；inside-floor 視角 isRayExiting = TRUE 已量測確認；H7 guard 後 inside-floor L1 short = 0。詳見「## 2026-05-15 Phase 2 第一刀 + 第二刀完成 + 第三刀前共識封口」。 |
| - [x] | C' | 追查 fixed-X 暗帶外溢與 fixed-Y / fixed-Z 亮 rim 的不對稱來源。 | **第一刀已完成**。根因為 `js/PathTracingCommon.js` bake capture path 的 `+ vec2(0.5)` 半 texel 偏移；移除後重烘 floor / north 1000SPP 已通過實機驗收。OPUS D4 推測 b（bake surface point nudge）方向證實。 |
| - [x] | H7' | R7-3.8 sprout paste 缺能區分 normal view 與 inside-floor view 的 ray-side / camera-side guard。 | **已修**：H7' readback / follow-up probe 與 camera-y guard（`uCamPos.y >= 0.025`）已由 OPUS 完成（2026-05-15），CODEX 審查接受、使用者肉眼驗收通過（地板內部全黑、烘焙開關不影響）、不回退。後續不得改成單看 `firstVisibleIsRayExiting`。 |
| - [x] | H5 / H3' 第二輪 | floor / north 邊界格 nearest-policy 衝突。 | 已以 1024 bake resolution 收斂；使用者肉眼確認兩條黑線看不出來。C runtime fallback 已移除，不列為候選。 |

## 鎖定禁區（Phase 1 結案版；Phase 2 第三刀前禁區見最末新章節）

| 狀態 | 禁區 | 理由 |
|---|---|---|
| - [x] | 不回到整張 atlas flood-fill。 | 已造成白線與亮值污染。 |
| - [x] | 不直接恢復舊 contact invalid region 修法。 | 先前路線已被使用者視覺回報與 OPUS 審查推翻。 |
| - [x] | Phase 2 修法需先設計共識、不允許直接跳 code 修。 | Phase 1 已結案，避免根因確認後仍做症狀修補；H8 / H7 / H5 / H3' 修法方案需先有共識文件再動 code。 |
| ~~- [x]~~ | ~~不把 C' 當成已定案。~~ **2026-05-15 已撤回** | C' 第一刀已完成、實機驗收通過、雙向共識封口；C' 物理方向正確、不回退、不重烘。新禁區見最末章節「不回退 C' bake UV 修正」。 |

## 下一步

A / B / C / D / E / F 全部完成。Phase 1 結案。

```
1.  Phase 1 全部 TODO 已收尾，假設樹定案：
      H8 強烈確認、H7 靜態 + 觀察確認、H5 / H3' 強烈確認、
      H1b 撤回、H6 保留低權重、H4 正式排除。
2.  Phase 1 完成前的「不提修法」禁區自此解除；
      但任何 shader / JS 改動仍需先有 Phase 2 設計共識，
      不允許直接跳 code 修。
```

修法不在本檔範圍。
留待 Phase 2 處理的 sub-task 清單：

- B' shader 當下數值 probe（H7：camera position / ray origin / visibleNormal / visiblePosition / isRayExiting / 短路命中表面；相機位置觸發面已由使用者確認，不再 probe）
- C' 邊界判定不對稱根因（wardrobe xMin 為何在 atlas 中暗區外溢 ≈ 1 texel）
- H8 / H7 / H5 / H3' 修法方案設計

詳見上方「B' 子任務狀態」、D 節 D4 小節、F 節、與「對假設樹的影響」。

---

## 2026-05-15 Phase 2 第一刀 + 第二刀完成 + 第三刀前共識封口

> ⚠️ 歷史紀錄（當輪狀態快照，非現況）：
> H7' camera-y guard 已於後段「## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過」
> 完成、經 CODEX 審查與使用者肉眼驗收、不回退。
> 本章節內所有「本輪只做 readback / 不加 guard / 下一步 probe / 待 CODEX 主導」字樣
> 均為第三刀前當時表述，非現況。
>
> 本段為 Phase 2 第一刀 / 第二刀執行完成、第三刀前根因判讀對齊紀錄。
> Phase 1 結論不變；C' 子任務在第一刀完成後改寫為「bake UV 多了 0.5 texel 偏移」根因，與 D 節 D4 推測 b（bake surface point 沿某方向 nudge）方向一致。
> 件 1 / 件 2 / 件 3 為第一刀實機驗收後新發現的三件事，OPUS / CODEX 雙向 10 問共識已封口。

### Phase 2 執行進度

| 狀態 | 刀次 | 內容 | 結果 |
|---|---|---|---|
| - [x] | 第一刀 | H8 runtime gate 拆解（per-slot ready 方案 a'）+ C' bake UV 半 texel 修正 + 重烘 floor / north 1000SPP atlas + runtime pointer 更新 | 全部完成；contract / syntax / runtime short-circuit / north-wall runtime / UI toggle smoke 均通過。floor `.omc/r7-3-10-full-room-diffuse-bake/20260515-112620/`、north `20260515-112717/`。 |
| - [x] | 第二刀 | B' probe levels 2~6 + JS readback API 擴充 + H7 `hitIsRayExiting` guard | 全部完成；pre-guard inside-floor L1 short = 879262 / 921600，post-guard = 0；正常地板 runtime smoke 仍 pass（bakedSurfaceHitCount = 96170 / shortCircuit = 190559）。 |
| - [x] | 第三刀 / 件 3 H7' readback probe | OPUS 主導實作 + 跑 12 cases；CODEX 審查接受根因 | 已完成 2026-05-15。 |
| - [x] | 第三刀 / H7' follow-up probe | L3 firstVisiblePosition.y / L6 cameraPos.y 分布、H7'-A / H7'-B 假設 | 已完成 2026-05-15；CODEX 審查接受。 |
| - [x] | 第三刀 / H7' camera-y guard | `uCamPos.y >= 0.025` | 已完成 2026-05-15；CODEX 審查接受、使用者肉眼確認地板內部全黑、不回退。詳見後段「## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過」。 |
| - [ ] | 下一刀 / 件 1 / 件 2 H5 / H3' probe | nearest hit interval + visible-hit runtime row / col probe | 下一刀執行；OPUS 或 CODEX 任一方；與 H7' 無依賴。 |

### 第一刀實機回報的三件事（使用者 2026-05-15 同視角驗收）

```text
1.  地板烘焙 ON：東北衣櫃底部南側邊緣（fixed-Z）仍有輕微黑邊。
2.  北牆烘焙 ON：東北衣櫃頂部北側邊緣（fixed-Y）有更明顯黑邊。
3.  地板烘焙 OFF：地板內部仍可看到嫩芽區發光。
4.  地板烘焙 ON：地板內部已全黑（H7 guard 通過、不回退）。
```

### 件 1 / 件 2 / 件 3 OPUS / CODEX 雙向共識（10 問封口）

| 件 | 根因判讀 | 共識狀態 | 對應假設 |
|---|---|---|---|
| 件 1（floor fixed-Z 南側黑線） | H5 / H3' 邊界格 nearest-policy。floor row 131 metadata z = -0.705064 落在衣櫃 zMax=-0.703 內側 ≈ 2 mm；C' 對齊後 atlas 取樣回到 texel center，物理正確；但 runtime NearestFilter 把可見地板 z ≈ -0.701 命中到 row 131 → 黑值 → 黑線。CODEX 量化證據：row 131 zero=68/69、row 132 zero=0/69。 | OPUS / CODEX 雙向確認 | H5 / H3' 第二輪 |
| 件 2（north fixed-Y 頂部黑線） | 件 1 鏡像。north row 344 metadata y = 1.954634 落在衣櫃 yMax=1.955 內側 ≈ 0.36 mm；同型 nearest-policy 衝突。CODEX 量化證據：row 344 zero=68/69、row 345 zero=0/69。 | OPUS / CODEX 雙向確認 | H5 / H3' 第二輪（與件 1 同一工單） |
| 件 3（inside-floor sprout glow） | **已修**：R7-3.8 paste 路徑缺 camera-side guard。H7' camera-y guard 已採 `uCamPos.y >= 0.025`（R7-3.8 paste path 最外層 if），CODEX 審查接受、使用者肉眼驗收通過、不回退。`firstVisibleIsRayExiting` 只作證據（normal / inside view 都 100% exiting），不單獨當 guard。 | OPUS / CODEX 雙向確認；guard 已落地 | H7' / sprout-paste-inside-guard（獨立於 H5 / H3' 第二輪） |

### CODEX 對 OPUS 第一版報告的三點修正（OPUS 已認證）

```text
1.  件 1 row 132 z 數字錯誤（OPUS 認錯）
    OPUS 寫 row 132 ≈ -0.715，正確為 row 132 z = -0.694654。
    -0.715 落在 row 130 附近，方向反了一個 row。
    根因類別不變。

2.  件 2 V 軸方向假設修正（OPUS 認錯）
    OPUS 假設「row index ↑ → world y ↓」錯，實測「row index ↑ → world y ↑」。
    CODEX 提供 row 343-346 完整 metadata：
      row 343: 1.948960   在衣櫃內較深（預期黑）
      row 344: 1.954634   在衣櫃內 0.36 mm（黑）
      row 345: 1.960308   在衣櫃外（亮）
      row 346: 1.965981   衣櫃外更高（亮）
    根因類別不變，但 OPUS 之前推 row 345 ≈ 1.949 完全錯。

3.  Q3 措辭修正（OPUS 接受 CODEX 改寫）
    原句「bake surface point epsilon 已無殘留偏差」太滿。
    改寫為：目前症狀不支持 bake surface point epsilon 是主因；
            根因優先級降至 H6 / 後備檢查層級，
            未來若件 1 / 件 2 修法後仍有殘留再翻。
```

### 假設樹現況更新（疊在原本 A / B / C / D / F 結論之上）

```text
1.  H8、C'：第一刀已實作完成、實機驗收通過。
    不回退 H8 floor / north 拆 ready；不回退 C' bake UV 修正。

2.  H7（hitIsRayExiting guard）：第二刀已實作完成、實機驗收通過。
    不回退 H7 guard。

3.  H5 / H3' 第二輪：件 1 / 件 2 視為同一工單；C' 修正揭露邊界格 nearest-policy
    不對稱問題。候選修法方向（不展開）：
      a. atlas 端寫入 alpha / valid mask（push-pull dilation 配合）。
      b. runtime 端 occluder OOBB fallback。
      c. bake 端把邊界 texel 取樣點推離 occluder。
    H5 / H3' 第二輪設計討論在件 3 + 件 1/2 殘留 probe 全數封口後再開。

4.  H7'（sprout-paste-inside-guard）：件 3 獨立工單。
    根因 = `firstVisible*` 缺 `firstVisibleIsRayExiting` 槽位 + R7-3.8 paste 缺 guard。
    與 H7 同型錯誤但 H7 guard 完全沒抓到，因 paste 用 `firstVisible*` 而非 `hit*`。

5.  H6：根因優先級維持低權重後備檢查；epsilon 主因假設已撤回（OPUS Q3 措辭修正）。
```

### 第三刀殘留 probe 清單（CODEX 補充、OPUS 接受）

```text
件 3（H7' / sprout-paste-inside-guard）— CODEX 主導，**本輪只做 readback、不加 guard**

  本輪 probe pass criteria（讀取性質、不改視覺）：
    a.  inside-floor 視角下，R7-3.8 paste 入口 if 通過 fragment 數可量到。
    b.  firstVisibleNormal / firstVisiblePosition.y 在 inside-floor 視角下可讀回。
    c.  臨時 firstVisibleIsRayExiting readback 在 inside-floor 視角下確認為 TRUE。
    本輪不引入 guard、不改變視覺、不重烘 atlas。

  Probe 三步：
    1.  R7-3.8 paste 入口 readback：
          在 shaders/Home_Studio_Fragment.glsl L3106 之前加 probe mode，
          回讀「inside-floor 視角下，這條 if 通過了多少 fragment」。
          預估接近全幅。
    2.  firstVisibleNormal / firstVisiblePosition.y 量化：
          確認 inside-floor 視角下 normal.y > 0.5 仍成立。
    3.  臨時 readback：
          在 shader L1961-1964 同位置加 firstVisibleIsRayExiting = hitIsRayExiting;
          （只 readback、不加 guard），跑 inside-floor 視角，
          確認真的會是 TRUE。

  未來 guard 驗證規格（不是本輪、留作 H7' 第二回合設計輸入）：
    沿用第二刀 H7 規格：pre-guard inside-floor L1 short → post-guard 應歸零；
    正常 runtime smoke `bakedSurfaceHitCount` 不退化。

件 1 / 件 2 殘留 probe — OPUS 或 CODEX 任一方做，無先後依賴

  1.  nearest hit interval：
        floor row 131 對應的 visible world z 命中區間。
        north row 344 對應的 visible world y 命中區間。
        結果換算成 mm，比對使用者眼睛量到的黑邊寬度。
        預估上限 ≈ 1 texel ≈ 5 mm；若眼睛量到 > 1 texel 要再找補根因。

  2.  visible-hit runtime probe：
        在畫面黑線 sample point 直接回讀 runtime atlas row / col。
        確認該 pixel 真的命中 row 131 / row 344，
        排除 postprocess 或相鄰 surface 混入的可能性。
```

### 第三刀前鎖定禁區（六條，OPUS / CODEX 共識）

```text
1.  不回退 H7 guard。
2.  不回退 H8 floor / north 拆 ready。
3.  不回退 C' bake UV 修正。
4.  不重烘 floor / north atlas（新包 mean = 0.005 是正確值）。
5.  不直接複製鄰格修補邊界格（會打掉 atlas 物理意義）。
6.  件 3 修法不在本回合展開，需 probe 證據齊備後另開設計輪。
```

### 對應的 Debug_Log 章節

| 段落 id | 內容 |
|---|---|
| `R7-3.10-c1-phase2-first-knife-h8-cprime` | 第一刀 H8 + C' 實作摘要與驗證 |
| `R7-3.10-c1-phase2-first-knife-user-debug` | 第一刀實機回報與三件事根因分流 |
| `R7-3.10-c1-phase2-second-knife-bprime-h7` | 第二刀 B' probe + H7 guard 證據鏈 |

### 第三刀下一步（共識封口）

```
1.  使用者明確轉達「開始件 3 probe 實作」後，CODEX 才會動 code。
2.  件 3 probe 只做 readback、不加 guard、不改視覺行為。
3.  件 1 / 件 2 殘留兩條 probe 與件 3 probe 無依賴，可併行。
4.  H5 / H3' 第二輪設計討論在件 3 probe + 件 1/2 殘留 probe 全數封口後再開。
5.  鎖定禁區六條維持不變。
```

---

## 2026-05-15 件 3 H7' / sprout-paste-inside-guard probe 完成 + CODEX 審查共識

> ⚠️ 歷史紀錄（當輪狀態快照，非現況）：
> H7' camera-y guard 已於後段「## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過」
> 完成、經 CODEX 審查與使用者肉眼驗收、不回退。
> 本章節「本輪只做 readback / 不加 guard / 下一步 follow-up probe」均為當時表述，非現況。
>
> 本段為第三刀件 3 readback probe 執行結果與 CODEX 審查 finding 對齊紀錄。
> 改由 OPUS 主導 probe 實作（第二刀後 CODEX 授權），已通過 CODEX 審查。
> 當輪 probe-only：未送 guard 修法。

### 執行進度

| 狀態 | 子項目 | 結果 |
|---|---|---|
| - [x] | OPUS 實作 H7' probe（4 檔案 diff） | 完成；contract / syntax / R7-3.10 short-circuit smoke 全 pass |
| - [x] | 跑 12 cases probe（3 cameras × 4 levels） | status pass；package `.omc/r7-3-8-sprout-paste-probe/20260515-143914/` |
| - [x] | CODEX 審查 probe 結果 | 接受根因；指出 P1 限制（見下） |
| - [x] | follow-up probe（H7'-A / H7'-B 假設驗證 + L3 / L6 normal vs inside view 分布） | 已完成 2026-05-15；CODEX 審查接受 |
| - [x] | H7' camera-y guard（`uCamPos.y >= 0.025`） | 已完成 2026-05-15；CODEX 審查接受、使用者視覺驗收通過、不回退 |

### Probe 量化結果

```text
Package: .omc/r7-3-8-sprout-paste-probe/20260515-143914/sprout-paste-probe-sample-report.json

normal_floor_view（控制組，相機 y=1.45）
  pastePassCount = 7,295 / 921,600（0.79%）
  rayExitingTrueCount = 7,295 / 921,600
  → 100% paste-pass 都是 firstVisibleIsRayExiting=TRUE

inside_floor_level_view（相機 y=-0.08，水平視角）
  pastePassCount = 393,289 / 921,600（42.7%）
  rayExitingTrueCount = 393,289 / 921,600
  → 100% paste-pass 都是 firstVisibleIsRayExiting=TRUE
  → firstVisibleNormal = (0, 1, 0)

inside_floor_up_view（相機 y=-0.08，仰望）
  pastePassCount = 921,600 / 921,600（100%）
  rayExitingTrueCount = 921,600 / 921,600
  → 100% paste-pass 都是 firstVisibleIsRayExiting=TRUE

H7 短路無 regression：bakedSurfaceHitCount = 96,170 / shortCircuit = 190,559
（與第二刀 post-guard 完全一致）
```

### CODEX 審查 P1 finding（OPUS 已認證）

```
正常 view 與 inside-floor view 的 paste-pass fragment 都 100% 是 firstVisibleIsRayExiting=TRUE。
這意味 firstVisibleIsRayExiting 可以證明 H7' 存在，
但不能單獨作為 guard 條件——否則會把使用者已驗收的正常 sprout paste 也擋掉。
```

OPUS 自我檢討：之前 probe 結論報告把 normal_floor_view sample 的 decoded True/False 混合
誤判為「巧合」、沒抓住「7,295 全紅 = 100% exiting」的整體統計結論。

### OPUS 對「為何 normal view 也 100% exiting」的初步解讀（待 follow-up probe 確認）

```
H7'-A：firstVisibleHit 不是 floor box 本身，而是 sprout patch 內穿過的別的 box
H7'-B：BoxIntersect 對極薄 floor box 的 isRayExiting 規則與既有理解不符
```

### 給下一輪 H7' guard 設計輪的 OPUS 預備案（候選、不送修）

```
方向 1：firstVisiblePosition.y >= floor.yMax + ε
方向 2：uCamPos.y >= floor.yMax + ε（OPUS 推測最簡單可靠）
方向 3：firstVisibleIsRayExiting == FALSE OR cameraPos.y > threshold
方向 4：firstVisible* + sprout patch 中心方向比對

實際選方向需先 probe L6（cameraPos.y）+ L3（firstVisiblePosition.y）在
normal vs inside view 的真實分布。
```

### CODEX P2 既有風格小風險（OPUS 確認非新引入）

```
js/InitCommon.js 兩個 reporter（reportR7310C1FullRoomDiffuseRuntimeProbe、
reportR738C1SproutPasteRuntimeProbe）的 finally 都只在 savedRenderTarget 存在時 restore。
若原本 render target 為 null，理論應 setRenderTarget(null)。
本回合不修；列為獨立 sub-task「reporter finally null-restore 修補」。
```

### 第三刀後 OPUS / CODEX 共識封口

```
1.  H7' 根因成立：R7-3.8 paste path 缺 inside-geometry guard。
2.  Guard 設計不能單看 firstVisibleIsRayExiting；
    需配合 firstVisiblePosition.y / cameraPos.y / ray-side 等附加條件。
3.  Probe 為 readback-only，預設行為 100% 與原 paste mix 相同。
4.  H7' guard 設計輪暫緩；OPUS 建議下一個動作為 follow-up probe（H7'-A / H7'-B + L3 / L6 分布）。
5.  鎖定禁區七條（含「H7' 不直接加 guard」）維持。
```

### 待寫 Debug_Log 章節

```
待寫：R7-3.10-c1-phase2-third-knife-h7prime-probe
（OPUS 留給 CODEX 第三刀正式收尾時加入；OPUS 此輪不動 Debug_Log）
```

---

## 2026-05-15 H7' follow-up probe 完成 + CODEX 審查共識（推薦 camera-y guard）

> ⚠️ 歷史紀錄（當輪狀態快照，非現況）：
> H7' camera-y guard 已於後段「## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過」
> 完成、經 CODEX 審查與使用者肉眼驗收、不回退。
> 本章節「給下一輪 H7' guard 設計輪的 OPUS 預備案 / guard 設計輪暫緩 / 待 H7' guard 設計輪實作 /
> CODEX / OPUS 對 H7' guard 設計輪共識」均為當時表述，非現況。
>
> 本段為第三刀件 3 follow-up probe 執行結果與 CODEX 審查（V1）finding 對齊紀錄。
> probe-only：當輪未送 guard 修法；推薦 guard 方向已收斂到 `uCamPos.y >= 0.025`（後續已落地）。

### Probe 量化結果（3 cameras × 6 levels = 18 cases）

```text
Package: .omc/r7-3-8-sprout-paste-probe/20260515-153545/sprout-paste-probe-sample-report.json

normal_floor_view（cameraState position.y = 1.45）
  L1 paste-pass = 7,295 / 921,600
  L4 rayExitTrue = 7,295 / 921,600 → 100% paste-pass = exiting
  L6 cameraPos.y：sample 7 點全沒落在 paste-pass 區（normal cam y = 1.45 來自 cameraState，
                  非 sample readback 證據）

inside_floor_level_view（cameraState position.y = -0.08）
  L1 paste-pass = 393,289 / 921,600
  L4 rayExitTrue = 393,289 / 921,600
  L5 firstVisibleHitType=1 / objectID=1 → ✅ sample readback：first hit 是 floor box
  L6 cameraPos.y = -0.08 → ✅ sample readback 直接量到

inside_floor_up_view（cameraState position.y = -0.08）
  L1 paste-pass = 921,600 / 921,600
  L4 rayExitTrue = 921,600 / 921,600
  L5 hitType=1 / objectID=1 → ✅ sample readback
  L6 cameraPos.y = -0.08 → ✅ sample readback 直接量到

H7 短路無 regression：bakedSurfaceHitCount = 96,170 / shortCircuit = 190,559
```

### CODEX V1 審查 P2 修正（OPUS 已認證並更新 MD 表述）

```
P2.1 OPUS 第一版 follow-up 報告寫「L6 cameraPos.y normal=1.45」太滿。
     正確分層：
       inside view 的 -0.08 = sample readback 直接量到（sample 在 paste-pass 區內）
       normal view 的 1.45 = runner cameraState 設定，非 sample readback
       （normal view 的 7 sample 全沒落在 paste-pass 區，
        decode 出 1.719/2.064/0.058/.../0.162 是 path tracer 渲染值的「假值」）

P2.2 H7'-A（normal view paste-pass 7,295 fragment 的 firstVisibleHitType / objectID）
     仍未直接驗證，OPUS 已標低優先；CODEX 接受不阻擋 guard 設計（推薦 guard 不依賴 hitType/objectID）。
```

### H7'-B 靜態 code review（PathTracingCommon.js:2748-2774）

```
BoxIntersect 邏輯：isRayExiting=TRUE 只在 ray origin 完全在 box 內（t0 ≤ 0）才成立。
矛盾觀察：normal cam y=1.45 完全在 floor box (y∈[0, 0.01]) 外，理論上應 isRayExiting=FALSE。
         但 probe 顯示 normal view paste-pass 100% 是 isRayExiting=TRUE。
最可能解釋：normal view paste-pass 的 first visible hit 不是 floor box，
           而是某個包住相機的 box（候選：天花板 cloud emission、wall、X-ray 透視 box）。
此假設待 H7'-A 直接 sample readback 才能完整驗證；對 guard 設計無影響。
```

### CODEX / OPUS 對 H7' guard 設計輪共識

```glsl
// 推薦條件（待 H7' guard 設計輪實作；本回合不送）
uCamPos.y >= 0.025
```

理由：
```
1.  uCamPos.y 是 uniform，與 first visible hit 無關，
    避開 H7' P1（不能單看 firstVisibleIsRayExiting）與 H7'-A 黑盒（hitType 未直接驗證）。
2.  完美 separate normal (1.45) 與 inside (-0.08)，閾值 0.025 ≈ floor.yMax + 0.015 m 安全餘裕。
3.  邊界 case（相機穿地板，y∈[0, 0.025]）擋掉嫩芽屬合理。
4.  不依賴 firstVisibleIsRayExiting / firstVisibleHitType / firstVisibleObjectID。
```

### Guard 設計輪驗收要求（給未來主導者）

```text
1.  shader 加 uCamPos.y >= 0.025 條件到 R7-3.8 paste mix 外層 if
2.  syntax check 三檔
3.  R7-3.10 short-circuit smoke：H7 無 regression（96,170 / 190,559）
4.  H7' probe pre/post-guard 對比：
      pre-guard inside paste-pass = 393,289 / 921,600
      post-guard inside paste-pass 應接近 0
      pre-guard normal paste-pass = 7,295
      post-guard normal paste-pass 應仍接近 7,295（不被誤擋）
5.  使用者實機驗收：
      地板烘焙 OFF + 正常視角 → 嫩芽顯示
      地板烘焙 OFF + 相機進入地板內部 → 嫩芽消失
      H8 / C' / H7 既有行為不變
```

### 殘留 follow-up（不阻擋 guard 設計輪）

```text
1.  H7'-A 直接 sample readback：先讀 sprout patch bounds 再對齊 sample point
2.  H7'-B 完整邏輯：找包住相機的 box 是哪個
3.  reporter finally null-restore 修補（既有風格、不在本輪修）
```

### CODEX V1 審查雙輪通過確認

```
✅ H7' readback probe 18 cases pass（CODEX 第一輪審查接受）
✅ H7' follow-up probe 18 cases pass（CODEX V1 審查接受、OPUS P2.1 表述已修正）
✅ H7' camera-y guard（uCamPos.y >= 0.025）已完成（CODEX 審查接受、使用者視覺驗收通過、不回退）
✅ H7 路徑無 regression（96,170 / 190,559）

下一步（現況）：H5 / H3' nearest hit interval + visible-hit runtime row / col probe。
詳見後段「## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過」。
```

---

## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過

> 白話現況：這輪把「相機鑽進地板裡還看到嫩芽光」修好了；
> 衣櫃邊緣兩條黑線是另一個已知問題，下一刀要處理取樣邊界。

### 同步重點（8 點現況）

```text
1.  H7' readback probe、follow-up probe、camera-y guard 都已完成。
2.  CODEX 審查接受 OPUS guard 實作，無 P0 / P1 阻擋問題。
3.  使用者肉眼確認：地板內部已成功全黑，烘焙開關不影響。
4.  地板烘焙 ON 的東北衣櫃底部南側頂邊黑線仍在。
5.  北牆烘焙 ON 的東北衣櫃頂部北側頂邊黑線仍在。
6.  第 4 / 5 點歸入 H5 / H3' nearest-policy / 邊界格取樣問題，下一刀處理。
7.  H7' guard 不回退；後續不得改成單看 firstVisibleIsRayExiting。
8.  下一步聚焦 H5 / H3' nearest hit interval 與 visible-hit runtime row / col probe。
```

### Guard 實作 + probe harness bug fix

```text
shader：R7-3.8 paste path 最外層 if 加 uCamPos.y >= 0.025
js/InitCommon.js：reportR738C1SproutPasteRuntimeProbe single-frame render 前
                  補 uCamPos 同步（setFromMatrixPosition），
                  修「probe harness uCamPos 殘留上一個 case」bug。

systematic debugging root cause：
  uCamPos 只在 render loop 每幀（Home_Studio.js:7052）由 cameraControlsObject.position 設定；
  probe 強制 single-frame render 不經 render loop，guard 讀到殘留相機位置。
  guard 邏輯本身正確，是 probe harness 沒同步 uCamPos。
```

### 三輪 pre/post 對比（L1 paste-pass count）

```text
                          pre-guard   post-guard(buggy)   post-guard(fixed)
                          153545      160727              161108
normal_floor_view         7,295       7,295               7,295    ← 正常視角保留 ✓
inside_floor_level_view   393,289     393,289             0        ← guard 擋住 ✓
inside_floor_up_view      921,600     0                   0        ← guard 擋住 ✓
```

### 使用者肉眼驗收回報（2026-05-15）與根因分流

```text
1.  地板內部已成功全黑、烘焙開關不影響 → 件 3 H7' guard 視覺驗收通過 ✅
2.  地板烘焙 ON、東北衣櫃底部南側黑線仍在 → 件 1，H5 / H3' 第二輪未修，非 regression
3.  北牆烘焙 ON、東北衣櫃頂部北側黑線仍在 → 件 2，H5 / H3' 第二輪未修，非 regression

件 1 / 件 2 非 H7' guard regression 證據：
  H7' guard 改 R7-3.8 paste path（firstVisible* 體系）；
  件 1 / 件 2 來源是 R7-3.10 floor/north baked atlas 短路（hit* 體系）；
  兩路徑完全獨立，H7' guard 不碰 atlas / C' / NearestFilter。
  旁證：guard 加入後 R7-3.10 short-circuit smoke = 96,170 / 190,559（零變動）。
```

### 假設樹現況更新

```text
H7'：已修。camera-y guard（uCamPos.y >= 0.025）實作完成、使用者視覺驗收通過、不回退。
件 1 / 件 2（H5 / H3' nearest-policy）：已由 1024 bake resolution 收斂。
  歷史：當時下一刀執行兩條已封口 probe（不改視覺）：
    1. nearest hit interval：反推 floor row 131 / north row 344 命中區間，
       換算 mm 比對使用者肉眼黑線寬度。
    2. visible-hit runtime probe：黑線 sample point 回讀 runtime atlas row / col，
       確認命中 row 131 / row 344，排除 postprocess 混入。
  現況：兩條 probe 已完成；第二輪裁定採 1024 bake resolution。C runtime fallback 已移除。
```

### 驗證清單

```text
✅ node --check js/InitCommon.js
✅ R7-3.10 short-circuit smoke：96,170 / 190,559（H7 / H8 / C' 無 regression）
✅ H7' probe post-guard-fixed 18 cases pass
✅ 使用者肉眼確認件 3 視覺驗收通過

結果檔：
  .omc/r7-3-8-sprout-paste-probe/20260515-161108/sprout-paste-probe-sample-report.json
  .omc/r7-3-10-full-room-diffuse-runtime/20260515-161145/runtime-report.json
```

### 待 CODEX 第三刀正式收尾

```text
件 3 H7' guard 已視覺驗收通過。後續 CODEX 收刀範圍已升級為：
  Debug_Log / Index、cache-buster、commit，並納入 1024 bake resolution closeout。
```

### CODEX review 殘留建議（commit 前處理，OPUS 同步自 CODEX 主檔）

```text
1.  runner 的 status: pass 目前只檢查 sample 是否為有限數值。
    commit 前建議補成語意檢查：normal = 7,295 保留、inside = 0。

2.  相關註解需從「第三刀前 / 不加 guard / probe 1~4」更新為目前狀態：
    - H7' guard 已落地。
    - probe levels 已擴到 1~6。

以上兩條屬 CODEX 第三刀正式收尾範圍；OPUS 此輪不動，僅同步記錄避免遺漏。
```

---

## 2026-05-15 R7-3.10 H5/H3' 第二輪收尾：1024 bake resolution（OPUS 執行，CODEX 裁定）

> 本段為 CODEX directive #5 文件收尾，記錄件 1 / 件 2 黑線第二輪以「提高 bake atlas 解析度 512→1024」修法的最終結果。OPUS 同步自 CODEX directive 裁定。

### 黑線結論：1024 已解（雙證）

```text
使用者肉眼（2026-05-15）：東北衣櫃頂部北側、底部南側黑線在 1024 完全看不出來
  （132/297 採樣即判定；黑線屬結構性特徵、不受採樣數影響）。
離線 nearest-interval（docs/tools/r7-3-10-h5-nearest-interval.mjs，已改解析度感知）：
  north 可見黑帶 512=3.46mm → 1024=0.125mm（約 28× 變細）→ 2048=1.30mm（相位退化）
  floor texel pitch 10.43→5.21→2.60mm 單調減半；可見黑帶為相位相依、非單調。
裁定：1024 鎖為 R7-3.10 floor/north 目前正式候選；2048 本輪不推進
  （對最顯眼北牆黑線，2048 相位較差會退化，非改善）。
```

### Package / 備份 / 驗證

```text
floor 1024 package：.omc/r7-3-10-full-room-diffuse-bake/20260515-215727
north 1024 package：.omc/r7-3-10-full-room-diffuse-bake/20260515-212509
512 指針備份：.omc/r7-3-10-1024-pointer-backups/20260515-212327/
  （north-512-pointer.json / floor-512-pointer.json，可隨時還原）
指針改動：floor/north 各最小 2 欄位（packageDir + targetAtlasResolution）。
contract test pass；short-circuit smoke pass 96170/190559（H7/H8/C' 無退化）；
H5 black-line probe pass（north dominantRow=682、totalInBand=1494）。
Task 5 結構性阻擋：runner H5 probe 經 L3631 必先載 floor；floor 仍 512 時
  north 1024 撞 combined 解析度防呆（InitCommon L1548-1550）→ CODEX 裁定選項 A
  （補烤 floor 1024）→ floor/north 同 1024 後防呆不再觸發，問題解除。
```

### partial bake vs LIVE 亮差根因（程式碼實證，CODEX 已接受）

```text
現象：只開地板烘焙 → 北牆(LIVE)偏亮；地板+北牆都烘 → 北牆正常；
  LIVE vs 烘焙雙開 → 櫃子(LIVE)偏亮。SPP100 即定型，非採樣未收斂假象。
根因：深度相加。shaders/Home_Studio_Fragment.glsl L2992-3033
  命中烘焙面：accumCol += mask * r7310BakedRadiance; break;
  LIVE 用 k 段抵達烘焙面，烘焙值內含「自該面再 N 次反彈」收斂解
  → 總有效深度 k+N，不重新封頂在 N（uMaxBounces 預設 4，
  Home_Studio.js L6480 快速預覽；烘焙走同 shader/同 uniform，非無限深）。
  OPUS 前述「幾乎無限深」陳述已更正作廢。
判定：partial bake 過渡狀態的交界假象；全相關面烘焙時交界消失、自解。
  非缺陷、非拒收 1024 理由。
正式驗收基準改為：全相關靜態漫射面 bake vs 全 LIVE（皆 4 次反彈），
  不再以 partial bake vs full LIVE 作接受/拒收標準。
```

### bake 吃 bake 防污染（CODEX directive #4，Option A 保留 + Option B 已加）

```text
Option A（保留為長期遙測）：captureR738C1DirectSurfaceTexelPatch render loop 後、
  finally restore 前快照 uR7310C1FullRoomDiffuseMode/Ready/FloorDiffuseMode/
  NorthWallDiffuseMode + uR738C1BakeCaptureMode，經 atlasSummary 帶進
  validation-report.json + runner console。實測 north 1024：4 個 runtime
  short-circuit uniform 全 0、captureMode=2 → 本輪無 bake 吃 bake。
Option B（CODEX 核准已加）：r7310C1FullRoomDiffuseShortCircuit() 開頭
  bakedRadiance=vec3(0.0); 後加 if (uR738C1BakeCaptureMode != 0) return false;
  物理安全邊界、不依呼叫順序，補「未來 runtime bake 已開頁面手動觸發
  capture」破口。後驗證：node --check 兩檔 pass、contract pass、
  smoke 96170/190559（與加 B 前完全相同）、H5 probe 682/1494（完全相同）
  → runtime 零退化（guard 僅 captureMode!=0 啟動）。
C fallback：已由 CODEX 移除，不回退、不重啟、不改鄰格取樣。
```

### Debug_Log 待寫內容（OPUS 此輪不動 Debug_Log，待 CODEX 收刀寫入 + commit + cache-buster）

```text
依本 session 既定協定（收刀時 Debug_Log 章節 + Debug_Log_Index + commit +
cache-buster 由 CODEX 擁有），OPUS 不直接寫 docs/SOP/Debug_Log.md /
Debug_Log_Index.md，避免雙勾號歧義與檔案衝突。待寫章節內容即上列四段
（黑線結論 / package 驗證 / 亮差根因 / 防污染 A+B）。請 CODEX 於收刀時
轉寫並負責 commit。
```
