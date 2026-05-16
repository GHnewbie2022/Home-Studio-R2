# R7-3.10 C1 接縫除錯 Phase 2 設計報告（OPUS 版本）

日期：2026-05-14 起草；2026-05-15 進入第 3 輪修正版；2026-05-15 第一刀 + 第二刀完成；2026-05-15 第三刀前 OPUS / CODEX 雙向 10 問共識封口；2026-05-15 件 3 H7' readback probe + follow-up probe + camera-y guard 全完成、CODEX 審查通過、使用者視覺驗收通過
狀態：第一刀 H8 + C' 已完成、第二刀 B' probe + H7 guard 已完成、件 3 H7' readback probe + follow-up probe + camera-y guard（`uCamPos.y >= 0.025`）全完成。CODEX 審查接受 OPUS guard 實作，無 P0 / P1 阻擋。使用者肉眼確認「地板內部已成功全黑、烘焙開關不影響」（件 3 視覺驗收通過）。件 1（floor fixed-Z 南側黑線）與件 2（north fixed-Y 頂部黑線）仍在，已確認為 H5 / H3' 邊界格 nearest-policy 第二輪未修項、非 regression；下一刀聚焦 H5 / H3' nearest hit interval 與 visible-hit runtime row / col probe。詳見「## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過」。
範圍：B' shader 數值 probe 設計、C' fixed-X 暗帶外溢根因確認、H8 / H7 / C' 第一輪修法方案設計（H5 / H3' 延後至第二輪獨立決策）；新增件 1 / 件 2 / 件 3 第三刀前根因判讀
對位：本檔為 OPUS 工作副本，供 CODEX 主檔代理審查。CODEX 端如同意，請以平行檔（無 -opus 後綴）回覆共識。

---

## CODEX 審查紀錄（2026-05-14 第 1 輪）

CODEX 結論：**部分同意，C' 根因方向成立，修法方向同意，但有 4 處需修正後再進實作。**

| 項目 | CODEX 立場 | OPUS 修正動作 |
|---|---|---|
| C' 根因（bake UV 多 0.5 texel） | 同意，並引 Khronos `gl_FragCoord` 規範佐證 | 表格 col 418 / col 420 bake worldX 已重算，固定 ±4.121 mm 半 texel 差距 |
| C' 修法方向（刪掉 `+vec2(0.5)`） | 同意，限於 bake capture path | 已標註只改 bake capture，不動正常 camera ray |
| H8 per-surface gate | 部分同意，缺 combined texture / ready loader 相依設計 | 新增 Step 3.1.3 補 loader 相依、提案 3 候選方案，推薦 (a) per-slot ready |
| B' probe JS API | 部分同意，既有 API 只回傳色碼計數，不能寫成已支援 | B'-5 改寫為「明確列為 API 擴充」，列出新增 options / 回傳欄位 |
| H7 isRayExiting guard | 部分同意，但 isRayExiting 是 SceneIntersect 區域變數需要新增 hit-state | Step 3.2 仍保留設計方向，實作時需新增 `hitIsRayExiting` 並在所有 BoxIntersect 命中點寫入 |
| H5 / H3' 方案 A | 部分同意，但 metadata valid flag 語意 floor / east 與 north 不一致，且建議延後 | Step 3.4 改標為「**延後成獨立決策點**」，第一輪不做；第二輪視結果再啟動 |
| East wall runtime | 提醒目前只是 bake / evidence 對照，runtime 沒有 east branch | Step 3.5 順序明確標註 east 不在第一輪範圍 |

修正後共識：採 CODEX 建議的 Phase 2 第一輪實作順序（見 Step 3.5），第一輪完成後再評估 H5 / H3' 是否啟動第二輪。

---

## CODEX 審查紀錄（2026-05-14 第 2 輪）

CODEX 結論：**部分同意，C' 數值表與 NORTH / east 交叉驗算到位，H5 / H3' 延後對齊，但仍有 3 處需要修正。**

| 項目 | CODEX 立場 | OPUS 修正動作 |
|---|---|---|
| C'-3 / C'-4 數值表 | 同意已修正到位（col 417~421、row 129~133 半 texel 差距、反轉列正確） | 無需再改 |
| NORTH_BOUNDS / east bounds 交叉驗算 | 同意，north X 半 texel 4.121 mm、north Y 半 texel 2.837 mm、east Z 半 texel 4.814 mm，全部支持 +0.5 texel 根因 | 無需再改 |
| H5 / H3' 延後到第二輪 | 同意對齊 | 無需再改 |
| Step 3.1.3 H8 方案 (a) 還混入 alpha / valid fallback 語意 | 第一輪不應引入 alpha mask 語意 | 改名為方案 (a')，明確切割：第一輪只做 combined texture + per-slot ready + mode flag 防取樣，**不讀 alpha、不做 valid fallback** |
| B'-5 缺 samplePoints 座標系與既有欄位名稱 | 需明寫座標系（render target pixel / canvas CSS pixel / readPixels y 軸 / device pixel ratio），既有欄位原名保留 | B'-5 補上 `samplePointSpace` 欄位定義 + 座標系規範表 + `rtPixel` 回傳欄位；既有 6 個 hit-count 欄位（`bakedSurfaceHitCount` 等）原名保留 |
| 文件尾端清單與待辦舊版殘留 | 審查清單第 6 點仍問 H5 / H3' 方案 A vs B；待辦缺 CODEX 第 2 輪審查列 | 審查清單第 6 點改為「確認 H5 / H3' 延後策略是否成立」；待辦補 CODEX 第 2 輪審查（已完成）與 OPUS 第 2 輪修正版（已完成）兩列，並新增 CODEX 第 3 輪審查（最後確認）列 |

---

## CODEX 審查紀錄（2026-05-15 第 3 輪）

CODEX 結論：**條件式同意，3 大修正點（H8 方案 a'、B'-5 API 擴充、H5 / H3' 延後策略與待辦）皆對齊，剩 1 個範例小錯。修正後 Phase 2 第一輪設計共識成立。**

| 項目 | CODEX 立場 | OPUS 修正動作 |
|---|---|---|
| H8 方案 (a') | 同意已對齊 | 無需再改 |
| B'-5 API 擴充（samplePointSpace / rtPixel / 既有欄位保留） | 同意已對齊 | 無需再改 |
| H5 / H3' 延後策略與待辦 | 同意已對齊 | 無需再改 |
| B'-5 範例 rtPixel 在 renderTargetPixel 模式下的值 | 指正：輸入 (640, 360) 在 renderTargetPixel 模式下，rtPixel 應為 (640, 360)，不能寫成 (1280, 720)。dpr / y 軸反轉只在 canvasCssPixel 模式才會套用 | B'-5 範例 rtPixel 改為 `{ x: 640, y: 360 }`，並補註解明示兩種模式對應的轉換：renderTargetPixel 與輸入相同、canvasCssPixel 才會 ×dpr + y 反轉 |

**CODEX 第 3 輪宣告**：修正範例小錯後，Phase 2 第一輪設計共識成立，可交由使用者裁定是否進入實作。

---

## 使用方式

本檔目的：把 Phase 1 假設樹定案後 Phase 2 要做的三件事擺到設計層級，等 OPUS 與 CODEX 共識後，才能進入 Phase 2 實作（動 code）。
任何 shader / JS 改動仍受 Phase 1 鎖定禁區「Phase 2 修法需先設計共識、不允許直接跳 code 修」管轄。

---

## Step 2 — C' fixed-X 暗帶外溢根因確認（最重要的發現）

本段先寫，因為 Step 2 是 Phase 2 三步裡最終於有明確根因可指認的一步，會影響 Step 3 修法方案的形狀。

### C'-1 根因摘要

**fixed-X 暗帶外溢與 fixed-Y / fixed-Z 亮 rim 不對稱的根因，是 bake 端 UV 計算多了 0.5 texel 的偏移。**

具體位置：`js/PathTracingCommon.js:3300`

```glsl
if (uR738C1BakeCaptureMode == 2)
{
    vec2 r738BakeUv = (gl_FragCoord.xy + vec2(0.5)) / uResolution;
    ...
}
```

問題：`gl_FragCoord.xy` 依 GLSL / WebGL 規範，pixel (i, j) 的 fragment center 為 (i+0.5, j+0.5)。
所以 `(gl_FragCoord.xy + vec2(0.5)) / uResolution = (i + 1.0) / N`，不是 texel center `(i + 0.5) / N`。
這比 metadata builder 約定的 texel center 多了 +0.5 texel 偏移。

### C'-2 metadata 約定（texel center）

`js/InitCommon.js:1814-1815` 的 `buildR738TexelMetadata()`：

```js
var u = (x + 0.5) / size;
var v = (y + 0.5) / size;
var worldX = bounds.xMin + (bounds.xMax - bounds.xMin) * u;
var worldZ = bounds.zMin + (bounds.zMax - bounds.zMin) * v;
```

這是標準 texel center UV 約定：texel index i 對應 `(i + 0.5) / N`。
metadata 把每個 texel 的「中心對應的 world position」記下來。

### C'-3 不對稱效應數值驗證

`docs/tools/r7-3-10-step-c-d-analyze.mjs` 與 OPUS Phase 1 D 節已量化：

| Texel index | metadata 報告 worldX | bake shader 實際取樣 worldX | 差距 | 衣櫃 xMin = 1.35 判定 |
|---|---|---|---|---|
| col 417 | 1.331113 | 1.335234 | +0.004121 m (恰好 0.5 texel) | 兩者皆衣櫃外側 |
| col 418 | 1.339355 | 1.343477 | +0.004121 m | 兩者皆衣櫃外側（bake 端離邊界更近，約 6.5 mm） |
| col 419 | 1.347598 | 1.351719 | +0.004121 m | metadata 外側 2.4 mm；bake **內側 1.7 mm**（關鍵反轉列） |
| col 420 | 1.355840 | 1.359961 | +0.004121 m | 兩者皆衣櫃內側 |
| col 421 | 1.364082 | 1.368203 | +0.004121 m | 兩者皆衣櫃內側 |

**注意**：上表每列差距固定為 0.004121 m，恰好等於 0.5 texel（X pitch = 4.22 / 512 = 0.008242 m）。
之前版本的表格在 col 418 / col 420 列誤把鄰格 metadata 當成自己的 bake 值，已修正。CODEX 審查指出此處表格錯誤；col 419 關鍵列原本就正確。

**col 419 是關鍵列**：metadata 報告 texel center 在衣櫃外側 2 mm，但 bake shader 實際從衣櫃內側 2 mm 取樣 radiance。
bake 從衣櫃內側取樣的結果是「光線往上打入衣櫃內部」→ 取到衣櫃 wood 反彈值或被天花板擋住 → 暗。
此 texel atlas luma 0.0036（暗）寫入。
runtime 沿用 metadata 約定計算 atlasUv：camera ray 命中 floor (1.348, 0, z)，atlasUv.x = (1.348 - (-2.11)) / 4.22 ≈ 0.8195，NearestFilter 命中 texel 419，讀到暗值 → 畫面出現西側黑線。

### C'-4 fixed-Z / fixed-Y 為何反向

| Texel index | metadata 報告 worldZ | bake shader 實際取樣 worldZ | 差距 | 衣櫃 zMax = -0.703 判定 |
|---|---|---|---|---|
| row 129 | -0.725885 | -0.720680 | +0.005205 m (恰好 0.5 texel) | 兩者皆衣櫃內側 |
| row 130 | -0.715475 | -0.710270 | +0.005205 m | metadata 內側 12.5 mm；bake 內側 7.3 mm |
| row 131 | -0.705064 | -0.699859 | +0.005205 m | metadata **內側 2.1 mm**；bake **外側 3.1 mm**（關鍵反轉列） |
| row 132 | -0.694654 | -0.689449 | +0.005205 m | 兩者皆衣櫃外側 |
| row 133 | -0.684244 | -0.679039 | +0.005205 m | 兩者皆衣櫃外側 |

**注意**：Z pitch = 5.33 / 512 = 0.010410 m，半 texel = 5.205 mm。
固定差距吻合「bake UV 加 +0.5 texel」推論。row 131 是反轉列，metadata 視角下在衣櫃內側 2 mm，bake 端實際從衣櫃外側 3 mm 取樣 → 取得亮值 → atlas 內側亮 rim → 但被衣櫃幾何遮蔽，畫面不見視覺異常。

row 131 也是關鍵列：metadata 報告 texel center 在衣櫃內側 2 mm，bake shader 實際從衣櫃外側 3 mm 取樣。
bake 從衣櫃外側取樣：光線往上打到沒有衣櫃遮擋的天花板 / 牆 → 取得亮 radiance → atlas 寫入 0.3675。
runtime 把這格判定為「在衣櫃內」，但 floor (1.6, 0, -0.705) 實際被衣櫃幾何遮擋，camera 看不到。所以 atlas 內側亮 rim 不會出現在畫面上，看起來「乾淨」。

**方向性結論**：
- 衣櫃西側 (xMin = 1.35)：bake +0.5 texel 偏移把外側 texel 推進衣櫃內 → 外側畫面看到暗值。
- 衣櫃南側 (zMax = -0.703)：bake +0.5 texel 偏移把內側 texel 推出衣櫃 → 內側畫面被衣櫃幾何遮蔽，亮值看不到。
- 衣櫃頂面 (yMax = 1.955)：與 zMax 同理。

這就是「為何 V 軸沒黑線」的真正答案：與 V 軸無關，與「邊界座標是 boxMin 還是 boxMax」、以及偏移方向 (+0.5 texel 永遠往 +U / +V 推) 的交互結果有關。

### C'-5 與東牆案的對照

`.omc/r7-3-10-full-room-diffuse-bake/20260513-214539/` 東牆歷史包：U 軸邊界 Z = -0.703 接縫第一格 mean luma 0.539942（亮 rim）。
原因：東牆 U 軸映射 `u = (z - zMin) / zRange`，z 邊界值 -0.703 是衣櫃 zMax（不是 boxMin）。
+0.5 texel 偏移把東牆 texel center 在「邊界第一格」往 +U 推 → 跨出衣櫃 z 範圍 → 取樣外側亮值 → 亮 rim。
與 fixed-Z 在 floor 上的行為一致，跟「U / V 軸」無關。
H1b 泛化 U 軸版本撤回的判斷，在這個根因下重新解釋為「U / V 軸不是分類維度，重要的是邊界座標是 boxMin 還是 boxMax」。

### C'-6 對 H5 / H3' 的補充意義

- **H5（atlas 內含家具 footprint 暗區）**：依然成立。bake 端正確把家具遮擋寫入 atlas，這是符合物理的。
- **H3'（alpha mask / occluder policy 缺口）**：依然成立。即使 C' 根因修好，atlas 內仍有 9 cm × 56 cm 衣櫃 footprint 完全暗區（除了 1 texel boundary 偏移），這個暗區會在「使用者進入地板實體內部」這類異常視角下被 H7 的 short-circuit 貼回畫面（地板內部發光症狀的成因）。

**重要**：C' 修法可解掉「西側接縫黑線」這個畫面症狀，但「地板內部發光」症狀仍要靠 H7 修法（inside-geometry guard）才能解。

---

## Step 1 — B' shader 當下數值 probe 設計

### B'-1 目的

H7 假設「floor short-circuit 套用範圍太寬，包含穿模、背面或內面視角」在 Phase 1 已由靜態 code 條件缺口 + 使用者觀察支持：
- shader `r7310C1RuntimeSurfaceIsTrueFloor` 只檢查 objectID + normal.y + position.y
- 缺 inside-geometry / ray-side guard
- BoxIntersect 內部出射時設 isRayExiting = TRUE，但 short-circuit 沒讀取
- 使用者實機已確認相機進入地板實體內部、可看到多個 baked surface 貼圖發光

B' 的目的是把這條鏈在 runtime 量化：哪些 fragment 真的觸發了 floor short-circuit、當下 camera position / ray origin / visibleNormal / visiblePosition / isRayExiting 的數值是多少。
這份 probe 證據會喂回 H7 修法的 guard 設計，確認「加什麼 guard 才剛好擋掉異常觸發，又不影響正常視角」。

### B'-2 既有 probe 基礎建設

shader 已經有 `uR7310C1RuntimeProbeMode`（diagnostic color mode）：
```glsl
// shaders/Home_Studio_Fragment.glsl:2966-2967
if (uR7310C1RuntimeProbeMode > 0.5)
    accumCol += r7310C1RuntimeSurfaceIsEastWall(...) ? vec3(1.0, 0.0, 1.0)
              : (r7310C1RuntimeSurfaceIsNorthWall(...) ? vec3(0.0, 1.0, 1.0) : vec3(0.0, 1.0, 0.0));
else
    accumCol += mask * r7310BakedRadiance;
```

JS 端也已經有 `window.reportR7310C1FullRoomDiffuseRuntimeProbe`（InitCommon.js:3479）做 readback。

B' 設計在這個基礎上擴充 probe levels，**不引入新 uniform**，只把現有 uR7310C1RuntimeProbeMode 從「布林開關」升級為「分階段 selector」。

### B'-3 probe levels 規格

| 值 | 含義 | accumCol 輸出意義 |
|---|---|---|
| 0.0 | probe 關閉 | 正常 baked radiance 貼回 |
| 1.0 | 既有 surface class 色碼 | green = floor / cyan = north wall / magenta = east wall |
| 2.0 | visibleNormal probe | rgb = nl * 0.5 + 0.5（法線壓到 [0,1]） |
| 3.0 | visiblePosition.y probe | r = (vp.y + 0.05) / 0.10（地板 y 軸近 [0, 0.05] 區段壓到 [0, 1]） |
| 4.0 | rayDirection.y probe | r = (rayDir.y + 1.0) / 2.0；rayDir.y < 0 → r < 0.5（從上往下射） |
| 5.0 | isRayExiting probe | r = isRayExiting ? 1.0 : 0.0（短路命中時的 BoxIntersect 內外側狀態） |
| 6.0 | cameraPosition.y probe | r = (cameraPos.y - 0.5) / 3.0（相機 y 軸壓到地板上下範圍） |

實作上 probe levels 2~6 共用既有 short-circuit 命中分支，在 `if (uR7310C1RuntimeProbeMode > 0.5) accumCol += ...` 裡多加幾條 else if 即可。
不動既有 uniform，不動 atlas 取樣，不動畫面正常路徑。

### B'-4 isRayExiting 取得方式

目前 short-circuit 簽名沒帶 isRayExiting：
```glsl
bool r7310C1FullRoomDiffuseShortCircuit(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, out vec3 bakedRadiance)
```

要把 BoxIntersect 的 `isRayExiting` 拉到 short-circuit，最低成本作法是在 SceneIntersect 那一輪把 `isRayExiting` 暫存成全域變數（已存在類似 pattern），probe 直接讀。
**Phase 2 設計約定**：probe 加 isRayExiting 屬於可逆 instrumentation。實作時把它寫成「probe-only 路徑」，不引入新的修法相依（H7 真正修法另外設計）。

### B'-5 JS 端 readback 流程（明確列為 API 擴充）

**現況（既有 API 不足）**：

`window.reportR7310C1FullRoomDiffuseRuntimeProbe(options)`（`js/InitCommon.js:3479` 起，實作 hit-count 統計於 L3549-3586）目前回傳的欄位包含：
- `bakedSurfaceHitCount`、`bakedSurfaceShortCircuitCount`
- `northWallSurfaceHitCount`、`northWallShortCircuitCount`
- `eastWallSurfaceHitCount`、`eastWallShortCircuitCount`
- 各 surface 的 pass / fail verdict、applied 狀態與 currentSamples 等元資料

既有 API 用於 surface classification 計數，**沒有 samplePoints / decoded 數值欄位**。

**B' 設計新增的 API 擴充**（屬於 Phase 2 實作項目，本檔不寫實作 code）：

```js
// 新增的 options 欄位
options = {
    probeLevel: 2 | 3 | 4 | 5 | 6,           // 新增：選擇 probe level（既有 API 只支援 0 / 1）
    samplePoints: [                            // 新增：要取的座標清單
        { x: 640, y: 360 },                    // 必填項，至少 1 點
        ...
    ],
    samplePointSpace: 'renderTargetPixel'      // 新增：samplePoints 座標系（CODEX 第 2 輪審查指正後加入）
                    | 'canvasCssPixel',        //   - 'renderTargetPixel'：render target 像素座標
                                                //   - 'canvasCssPixel'：CSS 像素，內部會乘 devicePixelRatio 轉成 RT 像素
                                                //   無論哪一種，y 軸採 WebGL readPixels 慣例：原點在左下，向上為正
                                                //   實作端負責處理 canvas height 反轉與 device pixel ratio
    decodeMode: 'visibleNormal' | 'visiblePosY' | 'rayDirY' | 'isRayExiting' | 'cameraPosY'
                                                // 新增：rgb → 實際數值的解碼方式（與 probeLevel 對應）
}

// 新增的回傳欄位（既有欄位原名保留、不重命名）
{
    // === 既有欄位（向下相容、欄位名不變）===
    bakedSurfaceHitCount: ...,
    bakedSurfaceShortCircuitCount: ...,
    northWallSurfaceHitCount: ...,
    northWallShortCircuitCount: ...,
    eastWallSurfaceHitCount: ...,
    eastWallShortCircuitCount: ...,
    applied: ...,
    currentSamples: ...,

    // === 新增欄位 ===
    probeLevel: 2,
    samplePointSpace: 'renderTargetPixel',
    samplePoints: [
        {
            x: 640, y: 360,                    // 回傳原樣，仍依 samplePointSpace 的座標系
            rtPixel: { x: 640, y: 360 },       // 實際讀取的 render target 像素座標
                                                //   renderTargetPixel 模式：與輸入 x / y 相同
                                                //   canvasCssPixel 模式：乘 devicePixelRatio + y 軸反轉後的值
                                                //   例如 dpr = 2 + canvas height = 720 時，CSS (640, 360) → rtPixel (1280, 720)
            r: 0.51, g: 0.99, b: 0.50,         // raw rgb readback
            decoded: { x: 0.02, y: 0.98, z: 0.00 }   // 已依 decodeMode 解碼的實際值
        },
        ...
    ]
}
```

**座標系規範（CODEX 第 2 輪審查指正後補上）**：

| samplePointSpace | x / y 來源 | 內部處理 |
|---|---|---|
| `renderTargetPixel` | render target 實際像素（0 ~ rtWidth-1 / 0 ~ rtHeight-1） | 直接送 `gl.readPixels`，y 軸採 readPixels 原點左下慣例 |
| `canvasCssPixel` | canvas CSS 像素（0 ~ canvas.clientWidth / 0 ~ canvas.clientHeight） | 乘 `window.devicePixelRatio`、做 y 軸反轉，再送 `gl.readPixels` |

兩種模式回傳的 `rtPixel` 欄位都會帶最終實際讀取的 render target 像素座標，方便 caller 驗證。

**實作切割**：
- shader 端：擴充 `uR7310C1RuntimeProbeMode` 從布林 (0 / 1) 升級為 levels (0~6)，在 `r7310C1FullRoomDiffuseShortCircuit` 命中分支內加 else if 處理 levels 2~6。
- JS 端：擴充 `reportR7310C1FullRoomDiffuseRuntimeProbe(options)`，新增 options.probeLevel / options.samplePoints / options.samplePointSpace / options.decodeMode 與對應回傳欄位，**既有 6 個 hit-count 欄位原名保留、不重命名**。
- 使用者操作：用 console 命令呼叫 `await reportR7310C1FullRoomDiffuseRuntimeProbe({ probeLevel: 5, samplePoints: [{x: 640, y: 360}], samplePointSpace: 'canvasCssPixel', decodeMode: 'isRayExiting' })`，取得單點數值。

**驗證**：
- 既有 probeLevel = 1（surface color）的 API 行為不變，6 個 hit-count 欄位向下相容、欄位名稱保留。
- 新增 levels 2~6 的回傳值與肉眼判讀的 probe 顏色一致（兩種 readback 路徑交叉確認）。
- samplePointSpace 兩種模式對同一畫面位置取樣，rtPixel 與 rgb / decoded 結果一致（座標系不影響數值內容）。

### B'-6 觸發場景

Phase 1 已由使用者實機確認三個場景：

| 場景 | 預期 probe 結果 | 用途 |
|---|---|---|
| 相機在房間內、看地板（正常） | visibleNormal ≈ (0, +1, 0)，rayDir.y < 0，isRayExiting = false | 對照組：H7 修法後不應該擋掉這條 |
| 相機進入地板實體內部、往上看地板背面 | visibleNormal ≈ (0, +1, 0)？或 (0, -1, 0)？isRayExiting = true | 異常觸發：H7 修法應擋這條 |
| 相機在房間內、看北牆 | visibleNormal ≈ (0, 0, +1)，rayDir.z < 0 | 對照組：north wall 也要不誤擋 |

B' probe 不會在本檔範圍實作。本檔只設計，等 CODEX 共識後才動 code。

---

## Step 3 — 修法方案設計

按 Phase 1 假設樹排序設計：H8 → H7 → C' → H5 / H3'。
本檔不寫 code，只寫修法藍圖與相依關係。

### Step 3.1 — H8 per-surface gate 隔離修法

**問題（Phase 1 A 節）**：
- `js/InitCommon.js:1174-1188` 的 `updateR738C1BakePastePreviewUniforms` 內，`r7310RuntimeApplied` 是 floor OR north 的 OR。
- 嫩芽 paste applied 條件含 `!r7310RuntimeApplied`，導致任一 R7-3.10 surface 啟用就停用嫩芽。
- 直接命中使用者觀察「北牆烘焙開、嫩芽消失」。
- 此外，`updateR7310C1FullRoomDiffuseRuntimeUniforms` 內 applied 條件同時要求 `r7310C1FullRoomDiffuseRuntimeReady` 與 `r7310C1NorthWallDiffuseRuntimeReady`。floor-only 也被 northWallReady 牽制。

**修法設計**：

**Step 3.1.1 拆 ready coupling**
```js
// 期望
var floorApplied = r7310C1FloorDiffuseRuntimeEnabled
    && r7310C1FullRoomDiffuseRuntimeReady  // floor patch 本身的 ready
    && r7310C1FullRoomDiffuseRuntimeConfigAllowed()
    && captureMode === 0;
var northApplied = r7310C1NorthWallDiffuseRuntimeEnabled
    && r7310C1NorthWallDiffuseRuntimeReady  // north patch 本身的 ready
    && r7310C1FullRoomDiffuseRuntimeConfigAllowed()
    && captureMode === 0;
pathTracingUniforms.uR7310C1FloorDiffuseMode.value = floorApplied ? 1.0 : 0.0;
pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value = northApplied ? 1.0 : 0.0;
pathTracingUniforms.uR7310C1FullRoomDiffuseMode.value = (floorApplied || northApplied) ? 1.0 : 0.0;
```

關鍵變化：floor 與 north 各看自己的 ready，互不牽制。

**Step 3.1.2 嫩芽 paste 互斥條件改 per-surface**
```js
// 期望
var r7310FloorRuntimeApplied = floorApplied;  // 與 3.1.1 同步
var spacePreviewApplied = r738C1BakePastePreviewEnabled
    && r738C1BakePastePreviewReady
    && r738C1BakePastePreviewConfigAllowed()
    && captureMode === 0
    && !r7310FloorRuntimeApplied;  // 只與 floor 互斥，不與 north 互斥
```

理由：嫩芽 paste 只貼在 floor 表面（shader L3074-3086 條件含 `cloudVisibleSurfaceIsFloor`），與北牆是兩個不同表面。北牆烘焙開啟不應該關掉嫩芽。

**Step 3.1.3 補：combined texture 與 ready loader 相依**

CODEX 審查指出：現況 `loadR7310C1FullRoomDiffuseRuntimePackage()` 會在啟用任一 surface 時主動載入 floor 與 north 兩個 package。`buildR7310C1CombinedDiffuseRuntimeTexture()` 把 floor 與 north 拼成 2-slot 合併 texture，`uR7310C1RuntimeAtlasPatchCount` 固定為 2.0。
這代表：即使 UI 只開啟 floor，runtime 仍然必須等到 north package 也載完，combined texture 才能成立。Step 3.1.1 拆 per-surface ready 還不夠，必須同時處理「north 未 ready 時 floor texture 怎麼成立」。

候選作法（OPUS 在本檔提案，等 CODEX 共識後再選一條）：

| 方案 | 摘要 | 優點 | 缺點 |
|---|---|---|---|
| (a') 合併 texture 保留 + per-slot ready + mode flag 防取樣 | 未 ready 的 slot 填 black placeholder texture；該 slot 對應的 `uR7310C1FloorDiffuseMode` 或 `uR7310C1NorthWallDiffuseMode` 維持 0，shader 不會取樣該 slot。**第一輪不讀 alpha、不做 valid fallback。** | 改動最小，沿用既有 combined texture 結構。 | 仍會在「只開 floor」時下載 north package（網路 / 解碼成本不變）。 |
| (b) 改為 per-surface 獨立 texture | 拆 `tR7310C1FloorDiffuseAtlasTexture` 與 `tR7310C1NorthWallDiffuseAtlasTexture` 兩個 texture uniform。combined texture 取消，shader sample function 改回 per-surface texture。 | UI 開哪個就載哪個，網路 / 記憶體最節省。 | 需要重構 shader 取樣路徑與 loader；影響面較大。 |
| (c) 維持 combined texture 與「全載」行為，僅拆 UI 顯示語意 | 後台 loader 不變，UI 仍按下 floor 開關就開始載入 north；只在「per-surface applied」這層拆開，讓 floor-only 顯示時，north slot 雖載入完成但 mode flag 為 0 不會被 short-circuit 命中。 | 改動最小；保留既有 prefetch 行為。 | UI 與實際 runtime 行為仍綁，floor-only 偵錯時要記得 north 也在背景載入。 |

**OPUS 推薦方案 (a')**：以 ready 為單位 per-slot 判定 + mode flag 防取樣。理由：
- 不重構 combined texture 結構，能順著現有 `r7310C1CombinedAtlasUv(localUv, patchSlot)` 的 patchSlot 0 = floor、1 = north 既有對位。
- unready slot 雖然在 combined texture 內填 placeholder，shader 端不會取樣（mode flag = 0 直接擋在 `r7310C1FullRoomDiffuseShortCircuit` 的 floor / north 分支外層）。
- **第一輪不引入 alpha 或 valid flag fallback 邏輯**：alpha / valid 訊號屬於 H5 / H3' 第二輪範圍（CODEX 第 2 輪審查指正：第一輪不能把 alpha mask 語意預先導入），第一輪只做 mode flag 級別的防取樣即可。

**風險**：
- 既有 shader 沒有 floor-only / north-only 拆開使用 `uR7310C1FullRoomDiffuseMode`：shader L546 外層 gate 只看 `uR7310C1FullRoomDiffuseMode > 0.5`。拆開 floor / north 後，shader 仍可繼續用 full-room gate 當總開關，不影響邏輯。
- 既有 capture mode（bake 過程）邏輯保留。
- combined texture loader 行為改變屬於 Step 3.1.3 範圍，未由 Step 3.1.1 涵蓋，CODEX 審查指正此缺口。

**驗證**：
- 用例 A：floor 開、north 關 → 嫩芽存在、floor baked diffuse 貼回、north wall 不貼回。
- 用例 B：floor 關、north 開 → 嫩芽存在、floor 不貼回、north wall 貼回。
- 用例 C：floor 開、north 開 → 嫩芽不存在（floor 互斥）、floor & north 都貼回。
- 用例 D：兩個都關 → 嫩芽存在、回到 R7-3.8 路徑。

### Step 3.2 — H7 inside-geometry / ray-side guard 修法

**問題（Phase 1 B 節）**：
- `r7310C1RuntimeSurfaceIsTrueFloor` 只檢查 visibleObjectID + visibleNormal.y + visiblePosition.y，不檢查相機位置或 ray 方向。
- 相機進入地板實體內部時，floor short-circuit 仍可能觸發（取決於 BoxIntersect 的 isRayExiting 與 normal 翻轉慣例）。
- BoxIntersect 在 ray 在 box 內部時設 `isRayExiting = TRUE`，但 short-circuit 沒讀取。

**修法設計**：

**Step 3.2.1 把 isRayExiting 接到 short-circuit**

在 shader 的命中流程裡，BoxIntersect 已經填 isRayExiting；把這個值傳遞到 R7-3.10 short-circuit。
最低成本作法：在 SceneIntersect 結束後把 `isRayExiting` 暫存到 fragment-local 變數（已存在類似 pattern），short-circuit 簽名加一個輸入參數：

```glsl
bool r7310C1FullRoomDiffuseShortCircuit(
    int visibleHitType,
    float visibleObjectID,
    vec3 visibleNormal,
    vec3 visiblePosition,
    bool isInsideHit,                 // 新增
    out vec3 bakedRadiance
)
{
    bakedRadiance = vec3(0.0);
    if (isInsideHit) return false;    // inside-geometry guard
    if (uR7310C1FullRoomDiffuseMode < 0.5 || uR7310C1FullRoomDiffuseReady < 0.5)
        return false;
    ...
}
```

**Step 3.2.2 加 ray-side guard（額外保險）**

如果未來 BoxIntersect 行為改動，光靠 isRayExiting 不足，可加第二層 guard：

```glsl
bool r7310C1RuntimeSurfaceIsTrueFloor(
    int visibleHitType,
    float visibleObjectID,
    vec3 visibleNormal,
    vec3 visiblePosition,
    vec3 viewDirection            // 新增：camera → hit 的方向
)
{
    return visibleObjectID < 1.5
        && visibleNormal.y > 0.5
        && visiblePosition.y <= 0.025
        && dot(viewDirection, visibleNormal) < 0.0;  // 光線從正面命中地板
}
```

第二項 `dot(viewDirection, visibleNormal) < 0.0` 對 floor / north wall / east wall 都通用，可以放到一個共用 helper。

**Step 3.2.3 north wall / east wall 同步加 guard**

同樣作法套用 `r7310C1RuntimeSurfaceIsNorthWall` 與 `r7310C1RuntimeSurfaceIsEastWall`。

**Step 3.2.4 B' probe 結果回饋**

如果 B' probe 數值顯示 isRayExiting 在異常觸發時為 TRUE，3.2.1 一個改動就夠。
如果顯示 isRayExiting 在異常觸發時仍為 FALSE，要靠 3.2.2 的 ray-side guard。
這條相依鏈代表 H7 修法必須在 B' probe 之後設計細部，但「加 guard」這個方向已確定。

**風險**：
- 「相機在房間內、看地板」這個正常路徑不應該被新 guard 擋掉。B' probe 場景 A 是這條的對照組。
- BoxIntersect 對於 ray 起點正好在 box 邊界的數值穩定性需要實機驗證；正常 camera 不會剛好在地板表面，風險低。

### Step 3.3 — C' bake UV half-texel offset 修法

**問題（本檔 Step 2 已確認）**：
- `js/PathTracingCommon.js:3300` 的 `vec2 r738BakeUv = (gl_FragCoord.xy + vec2(0.5)) / uResolution;` 多了 0.5 texel 偏移。
- 與 metadata 的 `u = (x + 0.5) / size` 約定不一致，造成 fixed-X 暗帶外溢、fixed-Y / fixed-Z 亮 rim 不對稱。

**修法設計**：

```glsl
// 修法：與 metadata 的 texel center 約定對齊
vec2 r738BakeUv = gl_FragCoord.xy / uResolution;
```

理由：`gl_FragCoord.xy` 在 GLSL ES 規範下已經是 fragment center (i+0.5, j+0.5)，除以 uResolution 得到的就是 texel center UV `(i+0.5)/N`。
原來的 `+ vec2(0.5)` 是多餘的偏移，移除即可。

**注意**：本修法不只影響 R7-3.10 floor / north / east bake，也影響 R7-3.8 floor patch bake（共用同一段 code）。需要評估 R7-3.8 既有 atlas 是否有對應的接縫問題。

**Step 3.3.1 影響範圍**

- R7-3.8 C1 floor 烘焙：使用同一 r738BakeUv 計算。
- R7-3.10 C1 floor / north / east 烘焙：使用同一 r738BakeUv 計算（patchId ≥ 1000 走 r7310 surface point，但 UV 計算是共用的）。

**Step 3.3.2 既有 atlas 包是否需要重烘**

修法後既有的 `.omc/r7-3-10-full-room-diffuse-bake/*` 包都帶有 +0.5 texel 偏移，必須重烘才能消除 fixed-X 西側黑線。
R7-3.8 既有的 sprout C1 包也帶相同偏移，但 sprout 的視覺敏感度與衣櫃接縫不同，需要先評估視覺差異是否可察。

**Step 3.3.3 與 H5 / H3' 的關係**

修法後：
- fixed-X 西側黑線：從畫面消失（atlas col 419 重烘後變亮）。
- 衣櫃 footprint 內部暗區：仍存在（這是物理正確的烘焙結果）。
- 「地板內部發光」異常：仍存在（這由 H7 修法處理）。

C' 修法只解一個畫面症狀（西側黑線），不解 H5 / H3'。

### Step 3.4 — H5 / H3' atlas footprint occluder mask 修法（**延後成獨立決策點**）

CODEX 審查建議：H5 / H3' 不要綁在第一輪修法，先做 H8 + C' + 重烘 + B' probe + H7 guard 即可解掉「西側黑線」「嫩芽消失」「相機進入地板異常貼回」三個畫面症狀。第一輪結束後再評估 H5 / H3' alpha mask 是否仍是必要 sub-task。

**為何延後**：
- 第一輪 H7 修法後，「相機在地板實體內部仍見 baked 貼回」會被擋掉。剩下的 H5 / H3' 症狀只在「異常視角下穿透到家具 footprint 暗區」才會浮現，可能再無顯式症狀。
- alpha mask 牽涉家具 occluder OOBB 清單、metadata valid flag 語意統一、shader runtime alpha 判讀路徑，是 Phase 2 中改動最大的子任務。
- 第一輪結束、使用者實機驗收後再決策，可避免 over-engineering。

以下方案 A / B 內容保留作為 Phase 2 第二輪的設計輸入，待第一輪驗收完成後重新評估。


**問題（Phase 1 C / D 節）**：
- 衣櫃 footprint / contact 相關範圍 atlas alpha 全為 1.0，沒有 occluder mask。
- 「地板內部發光」異常下，相機進入地板實體看到 baked atlas 把衣櫃 footprint 暗值貼回（家具區呈黑色陰影）。

**修法設計（兩個方案，候選）**：

**方案 A：bake 端寫入 occluder alpha**

於 `buildR7310C1FloorTexelMetadata` 增加：
```js
var insideWardrobe = isInsideWardrobeXZ(worldX, worldZ);  // 用 wardrobe OOBB 判定
metadata[offset + 7] = insideWardrobe ? 0.0 : 1.0;  // valid flag
```

並於 `captureR738C1DirectSurfaceTexelPatch` 內套用 mask（與 northWall 的 `maskR7310C1NorthWallAtlasPixels` 同 pattern）。
runtime 端 shader `r7310C1FullRoomDiffuseShortCircuit` 取樣時讀 alpha，<0.5 視為 invalid，回退到 live path tracing。

**優點**：根因處理，atlas 一次烘對。
**缺點**：要枚舉所有 occluder（衣櫃 + 其他家具）並維護 OOBB 清單。

**方案 B：runtime 端 occluder OOBB 清單**

shader 端在 `r7310C1FullRoomDiffuseShortCircuit` 內檢查 visiblePosition 是否在已知 occluder OOBB 內，若是則 short-circuit return false。
不動 atlas，只動 shader runtime 判斷。

**優點**：不需重烘 atlas。
**缺點**：每個 frame 每個 fragment 多做 OOBB 檢查；occluder OOBB 清單與場景物件清單需保持同步。

**推薦**：方案 A。理由：
- H5 與 H3' 的根因都在 atlas 端寫入了不該寫的暗值。
- bake 是一次性操作，runtime 是每 frame 操作；把成本放在 bake 端是常識選擇。
- north wall 已經有 `maskR7310C1NorthWallAtlasPixels` 對應 door hole 的成功 pattern，floor / east wall 套用同 pattern 不增加新概念。

**Step 3.4.1 occluder 清單來源**

從 `js/Home_Studio.js` 的 addBox 呼叫枚舉 wood / metal furniture box，過濾出與 floor / north wall / east wall surface 有 footprint 重疊的 box。
此清單在 bake 時讀進 JS 端 metadata builder。建議寫成 const 表，附對應 R-stage 標籤。

### Step 3.5 — 修法順序與相依（依 CODEX 審查共識更新）

CODEX 審查建議：把 H5 / H3' alpha mask 推遲到獨立決策點。第一輪只做 H8 + C' + B' probe + H7 guard，第一輪驗收完再決定 H5 / H3' 是否仍需要。

**Phase 2 第一輪實作順序（共識版）**：

```
1. Step 3.1.3 補 H8 combined texture / ready loader 設計（推薦方案 a：per-slot ready）
       ↓
2. Step 3.1.1 / 3.1.2 H8 per-surface gate 拆解
       （per-surface ready 各自判定、嫩芽 paste 只與 floor 互斥）
       ↓
3. Step 3.3 C' bake UV 修正（刪掉 +vec2(0.5)）
       ↓
4. 重烘 floor / north atlas
       （east wall 不在本輪範圍，現況只作 bake / evidence 對照；
        若 Phase 2 第二輪納入 east runtime，需獨立設計第三 slot 與 UI / package ready）
       ↓
5. 使用者實機驗收：西側黑線消失、嫩芽與 north baked 共存
       ↓
6. Step 1 B' probe 實作（probe levels 2~6 + JS API 擴充）
       ↓
7. 使用者實機跑 B' probe，取得 isRayExiting / camera position / visibleNormal 等數值
       ↓
8. Step 3.2 H7 inside-geometry guard 實作
       （依 B' 數值決定 3.2.1 isRayExiting guard 或 3.2.1 + 3.2.2 ray-side guard）
       ↓
9. 使用者實機驗收：相機進入地板實體內部不再見 baked 貼回
       ↓
10. 第一輪結束。評估 H5 / H3' alpha mask 是否仍是必要 sub-task。
```

**Phase 2 第二輪（候選，視第一輪結果再啟動）**：

```
若第一輪結束後仍見家具 footprint 暗區異常貼回（任何視角下）：
   Step 3.4 H5 / H3' alpha mask（方案 A：bake 端 metadata valid flag + JS occluder OOBB 清單）
       ↓
   重烘 atlas（含 mask）
       ↓
   使用者驗收
若第一輪結束後家具 footprint 異常已不再顯式：
   H5 / H3' 留作 hypothesis 紀錄，不實作。
```

**為何 H7 排在 B' probe 之後**：H7 修法需要 B' probe 結果決定 guard 形狀（單一 isRayExiting guard 或加 ray-side guard）。其他修法可獨立進行，先把 UI 端兩個畫面症狀（西側黑線 + 嫩芽消失）處理掉，再處理穿模症狀（地板內部發光）。

---

## 修法後驗收計畫

**第一輪驗收（H8 + C' + B' + H7 修法後）**：

| 驗收場景 | 預期結果 | 命中假設 |
|---|---|---|
| floor 烘焙：開、north 烘焙：關 | 衣櫃西側無黑線、嫩芽存在、floor baked diffuse 貼回 | H8 + C' |
| floor 烘焙：關、north 烘焙：開 | 衣櫃頂面北側無黑線、嫩芽存在、north wall baked diffuse 貼回 | H8 + C' |
| floor 烘焙：開、north 烘焙：開 | 衣櫃所有接縫無黑線、嫩芽消失（floor 互斥）、兩個 surface 都貼回 | H8 + C' |
| 相機進入地板實體內部 | 不再看到 baked surface 貼圖發光（H5 / H3' 暗區若仍存在但不再被穿模觸發） | H7 |
| 既有 R7-3.8 嫩芽 ab 控制 | 與 R7-3.10 共存，互不影響（floor 一起開時除外） | H8 |
| 既有 R7-3.9 反射、R7-3.8 烘焙、其他 R 階段 | 無視覺回歸 | 全體 |

每個場景至少 500 samples / pixel 後再宣告通過（既有 R2-14 規則）。

**第一輪結束後評估點（決定第二輪是否啟動）**：

| 評估場景 | 第二輪是否需要 |
|---|---|
| 第一輪驗收後，所有正常視角下無視覺異常 | H5 / H3' 留作 hypothesis 紀錄，不啟動第二輪 |
| 第一輪驗收後，仍見家具 footprint 暗區異常（任何視角下） | 啟動第二輪 Step 3.4 H5 / H3' alpha mask |
| 第一輪驗收後，需要納入 east wall runtime | 啟動 East wall 第三 slot 設計 |

**第二輪驗收（候選，視第一輪結果再啟動）**：

| 驗收場景 | 預期結果 | 命中假設 |
|---|---|---|
| 任何視角下，家具 footprint 範圍 | 由 alpha mask 阻擋 atlas 取樣、fallback 到 live path tracing | H5 + H3' |
| east wall 烘焙：開（如啟動 east runtime） | east wall baked diffuse 貼回 | east runtime 擴充 |

---

## 鎖定禁區（Phase 2 持續適用）

| 禁區 | 理由 |
|---|---|
| 不回到整張 atlas flood-fill。 | 已造成白線與亮值污染。 |
| 不直接恢復舊 contact invalid region 修法。 | 先前路線已被使用者視覺回報與 OPUS 審查推翻。 |
| 修法需先設計共識、不允許直接跳 code 修。 | Phase 1 已結案，避免根因確認後仍做症狀修補；本檔即此設計共識的 OPUS 端輸入。 |
| 不把 C' bake UV 修法套到 R7-3.8 既有 atlas 而不評估視覺差異。 | R7-3.8 sprout C1 包共用同一 r738BakeUv 計算，修法後需要評估 sprout 視覺變化。 |
| 不在第一輪實作 H5 / H3' alpha mask。 | CODEX 審查建議延後至第二輪獨立決策，避免 over-engineering；第一輪結束後再評估必要性。 |
| 不在第一輪納入 East wall runtime。 | 現況 east wall 只作 bake / evidence 對照，runtime combined texture 沒有 east branch；如要納入需獨立設計第三 slot 與 UI / package ready。 |
| 不把 H8 修法侷限於 applied flag 拆解。 | CODEX 審查指正：combined texture 與 ready loader 相依在 Step 3.1.3 必須一起處理，否則 floor-only 仍會等 north package。 |

---

## 三輪審查後的設計共識總結

**狀態**：三輪 CODEX 審查全部完成。第 3 輪條件式同意已落實。Phase 2 第一輪設計共識正式成立。
本段用以記錄三輪審查的最終結論，供後續 Phase 2 實作前快速回顧。

1. **C' 根因：bake UV 多了 0.5 texel 偏移**。
   位置：`js/PathTracingCommon.js:3300` 的 `(gl_FragCoord.xy + vec2(0.5)) / uResolution` 與 `js/InitCommon.js:1814-1815` 的 metadata `(x + 0.5) / size` 約定不一致。
   結論：CODEX 第 1 輪同意根因方向，並引 Khronos `gl_FragCoord` 規範佐證。

2. **C'-3 / C'-4 數值驗算**。
   FLOOR_BOUNDS = {-2.11, 2.11, -2.074, 3.256, y=0.01}；NORTH_BOUNDS / east bounds 交叉驗算結果：north X 半 texel = 4.121 mm、north Y 半 texel = 2.837 mm、east Z 半 texel = 4.814 mm。
   結論：CODEX 第 2 輪同意全部數值，並用 NORTH / east 交叉驗算支持同一根因。

3. **Step 3.1 H8 修法**。
   拆 ready coupling + per-surface 互斥條件，嫩芽 paste 只與 floor 互斥；Step 3.1.3 補 combined texture / ready loader 相依（CODEX 第 1 輪指正後加入）；方案 a' 不引入 alpha / valid fallback（CODEX 第 2 輪指正後修正）。
   結論：CODEX 第 3 輪同意現版 Step 3.1.3 + 方案 a' 的整套設計。

4. **Step 3.2 H7 修法**。
   isRayExiting guard 為主、ray-side guard 為輔；實作時需新增 `hitIsRayExiting` hit-state 並在所有 BoxIntersect 命中點寫入（CODEX 第 1 輪指正後標註）。
   結論：CODEX 同意「先做 B' probe、再依 probe 數值決定 3.2.1 或 3.2.1 + 3.2.2」順序。

5. **Step 3.3 C' 修法簡潔性**。
   只刪掉一個 `+ vec2(0.5)`，整體 atlas 需重烘。
   結論：CODEX 同意此範圍。R7-3.8 既有 sprout atlas 同樣帶半 texel 偏移，重烘前需評估 sprout 視覺變化（鎖定禁區 4）。

6. **H5 / H3' 延後策略**（CODEX 第 2 輪建議後替換原方案 A vs B 選擇）。
   Step 3.4 已標為「延後成獨立決策點」，第一輪只做 H8 + C' + B' + H7；第一輪驗收完成後再依下列評估點決定是否啟動第二輪：
   - 所有正常視角下無視覺異常 → 不啟動第二輪，H5 / H3' 留作 hypothesis 紀錄
   - 仍見家具 footprint 暗區異常（任何視角下）→ 啟動 Step 3.4 H5 / H3' alpha mask
   - 需要納入 east wall runtime → 啟動 East wall 第三 slot 設計
   結論：CODEX 同意延後策略，OPUS 與 CODEX 均不在第一輪實作 H5 / H3'。

7. **B'-5 API 擴充**（第 3 輪確認）。
   新增 `options.probeLevel`、`options.samplePoints`、`options.samplePointSpace`、`options.decodeMode` 與對應回傳欄位；既有 6 個 hit-count 欄位原名保留；rtPixel 在 renderTargetPixel 模式下與輸入相同、canvasCssPixel 模式下乘 dpr + y 軸反轉。
   結論：CODEX 第 3 輪條件式同意，OPUS 第 3 輪修正範例後成立。

**下一步（已更新）**：第一刀 + 第二刀已於 2026-05-15 完成；下一步是第三刀前 probe（H7' + 件 1/2 殘留）。詳見下方「## 2026-05-15 Phase 2 第一刀 + 第二刀完成 + 第三刀前共識封口」。
（歷史紀錄：本段原寫「等使用者裁定是否進入 Phase 2 第一輪實作」，2026-05-15 已完成裁定並執行完第一刀 + 第二刀。）

---

## 2026-05-15 Phase 2 第一刀 + 第二刀完成 + 第三刀前共識封口

> ⚠️ 歷史紀錄（當輪狀態快照，非現況）：
> H7' camera-y guard 已於後段「## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過」
> 完成、經 CODEX 審查與使用者肉眼驗收、不回退。
> 本章節內所有「本輪只做 readback / 不加 guard / 下一步 probe / 待 CODEX 主導」字樣
> 均為第三刀前當時表述，非現況。
>
> 本段為 2026-05-15 第一刀 / 第二刀執行完成、第三刀前根因判讀對齊紀錄。
> 設計共識仍延續本檔三輪審查結論；此處只記錄執行結果與第三刀前的新假設與雙向共識。

### 執行進度（多次更新；最近一次 2026-05-15 件 3 H7' probe 完成後）

| 狀態 | 刀次 | 內容 | 結果 |
|---|---|---|---|
| - [x] | 第一刀 | H8 runtime gate 拆解 + C' bake UV 半 texel 修正 + 重烘 floor / north 1000SPP atlas + runtime pointer 更新 | 全部完成；contract / syntax / runtime short-circuit / north-wall runtime / UI toggle smoke 均通過。 |
| - [x] | 第二刀 | B' probe levels 2~6 + JS readback API 擴充 + H7 `hitIsRayExiting` guard | 全部完成；pre-guard inside-floor L1 short = 879262，post-guard = 0；正常地板 runtime smoke 仍 pass。 |
| - [x] | 第三刀 / 件 3 H7' readback probe | OPUS 主導實作 + 跑 12 cases | 已完成 2026-05-15；CODEX 審查接受根因。 |
| - [x] | 第三刀 / H7' follow-up probe | L3 firstVisiblePosition.y / L6 cameraPos.y 分布、H7'-A / H7'-B 假設 | 已完成 2026-05-15；CODEX 審查接受。詳見「## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過」。 |
| - [x] | 第三刀 / H7' camera-y guard | `uCamPos.y >= 0.025` | 已完成 2026-05-15；CODEX 審查接受、使用者肉眼確認地板內部全黑、不回退。 |
| - [x] | 下一刀 / 件 1 / 件 2 H5 / H3' probe | nearest hit interval + visible-hit runtime row / col probe | OPUS 已完成；1024 resolution 收斂，使用者肉眼驗收通過。 |

### 第一刀實機回報的三件事（使用者 2026-05-15 同視角驗收）

```text
1.  地板烘焙 ON：東北衣櫃底部南側邊緣（fixed-Z）仍有輕微黑邊。
2.  北牆烘焙 ON：東北衣櫃頂部北側邊緣（fixed-Y）有更明顯黑邊。
3.  地板烘焙 OFF：地板內部仍可看到嫩芽區發光。
4.  地板烘焙 ON：地板內部已全黑（H7 guard 通過、不回退）。
```

### 第三刀前 OPUS / CODEX 雙向共識（2026-05-15 10 問封口）

| 件 | 根因判讀 | 共識狀態 |
|---|---|---|
| 件 1（floor fixed-Z 南側黑線） | H5 / H3' 邊界格 nearest-policy。floor row 131 metadata z = -0.705064 落在衣櫃 zMax=-0.703 內側 ≈ 2 mm；C' 對齊後 atlas 取樣回到 texel center，物理正確；但 runtime NearestFilter 把可見地板 z ≈ -0.701 命中到 row 131 → 黑值 → 黑線。CODEX 提供 row 131 zero=68/69、row 132 zero=0/69 量化證據。 | OPUS / CODEX 雙向確認；C' 不回退、不重烘 atlas。 |
| 件 2（north fixed-Y 頂部黑線） | 件 1 的鏡像。north row 344 metadata y = 1.954634 落在衣櫃 yMax=1.955 內側 ≈ 0.36 mm；同型 nearest-policy 衝突。 | OPUS / CODEX 雙向確認；視為與件 1 同一工單（H5 / H3' 第二輪）。 |
| 件 3（地板烘焙 OFF inside-floor sprout glow） | R7-3.8 paste 路徑（`shaders/Home_Studio_Fragment.glsl` L3106-3118）缺能區分 normal view 與 inside-floor view 的 ray-side / camera-side guard。H7 guard 寫在 `r7310C1FullRoomDiffuseShortCircuit`（L551），完全沒覆蓋 R7-3.8 paste mix 路徑。`firstVisibleIsRayExiting`（OPUS probe 為此補的 first-visible 槽位）是證據之一，**但 2026-05-15 H7' probe 證實不能單獨當 guard**：normal view 與 inside-floor view 的 paste-pass fragment 都 100% 是 `firstVisibleIsRayExiting=TRUE`。 | OPUS / CODEX 雙向確認；命名為 H7' / sprout-paste-inside-guard，獨立於 H5 / H3' 第二輪；guard 條件待 follow-up probe 後決定。 |

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

### 第三刀前殘留 probe 清單（CODEX 補充、OPUS 接受）

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

### 當時下一步交接（歷史，已由 1024 收尾段取代）

```
1.  使用者明確轉達「開始件 3 probe 實作」後，CODEX 才會動 code。
2.  件 3 probe 只做 readback、不加 guard、不改視覺行為。
3.  件 1 / 件 2 殘留兩條 probe 與件 3 probe 無依賴，可併行。
4.  H5 / H3' 第二輪設計討論在件 3 probe + 件 1/2 殘留 probe 全數封口後再開。
    當時候選方向（不展開）：alpha mask / push-pull dilation / runtime fallback 三選一；現況已採 1024 bake resolution，C runtime fallback 已移除。
5.  鎖定禁區六條維持不變。
```

---

## 2026-05-15 件 3 H7' / sprout-paste-inside-guard probe 完成 + CODEX 審查共識

> ⚠️ 歷史紀錄（當輪狀態快照，非現況）：
> H7' camera-y guard 已於後段「## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過」完成、
> 經 CODEX 審查與使用者肉眼驗收、不回退。
> 本章節內的「本輪只做 readback / 不加 guard / 下一步 follow-up probe」均為當時表述，請勿讀成現況。
>
> 本段為第三刀件 3 readback probe 執行結果與 CODEX 審查 finding 對齊紀錄。
> probe-only：當輪未送 guard 修法。

### Probe 實作（4 檔案 diff，OPUS 端尚未 commit）

| 檔案 | 改動 |
|---|---|
| `shaders/Home_Studio_Fragment.glsl` | L56 加 `uniform float uR738C1SproutPasteProbeMode;`；L1908 加 `int firstVisibleIsRayExiting = FALSE;`；L1970 加 `firstVisibleIsRayExiting = hitIsRayExiting;`；L3121-3137 R7-3.8 paste path 加 5-level probe 分支 |
| `js/Home_Studio.js` | L5455 加 `pathTracingUniforms.uR738C1SproutPasteProbeMode = { value: 0.0 };` |
| `js/InitCommon.js` | L3788 起加 `r738C1SproutPasteProbeDecodeModeForLevel`、`decodeR738C1SproutPasteProbeSample`、`window.reportR738C1SproutPasteRuntimeProbe` 三個 helper |
| `docs/tools/r7-3-8-c1-bake-capture-runner.mjs` | L37 / L64 加 `--r738-sprout-paste-probe-test` 旗標；L621-624 helper expression 加分支；L810-895 加 handler |

預設行為：probe mode = 0 時 R7-3.8 paste mix 路徑 100% 與原本相同。

### Probe 量化結果（3 cameras × 4 levels = 12 cases，每組 1 SPP）

```text
Package: .omc/r7-3-8-sprout-paste-probe/20260515-143914/sprout-paste-probe-sample-report.json

normal_floor_view（控制組，相機 y=1.45 向地板斜下看）
  pastePassCount         = 7,295   / 921,600   (0.79%)
  rayExitingTrueCount    = 7,295   / 921,600
  →  paste-pass 範圍是 sprout patch；100% paste-pass 都是 firstVisibleIsRayExiting=TRUE

inside_floor_level_view（相機 y=-0.08 在地板實體內、水平視角）
  pastePassCount         = 393,289 / 921,600  (42.7%)
  rayExitingTrueCount    = 393,289 / 921,600
  →  100% paste-pass 都是 firstVisibleIsRayExiting=TRUE
  →  firstVisibleNormal = (0, 1, 0)（地板上表面外法線）

inside_floor_up_view（相機 y=-0.08 仰望）
  pastePassCount         = 921,600 / 921,600  (100%)
  rayExitingTrueCount    = 921,600 / 921,600
  →  100% paste-pass 都是 firstVisibleIsRayExiting=TRUE

H7 短路無 regression：bakedSurfaceHitCount = 96,170 / shortCircuit = 190,559
（與第二刀 post-guard 完全一致）
```

### CODEX 審查 P1 finding（OPUS 認證）

```
正常 view 與 inside-floor view 的 paste-pass fragment 都 100% 是 firstVisibleIsRayExiting=TRUE。
這意味 firstVisibleIsRayExiting 可以證明 H7' 存在，
但不能單獨作為 guard 條件——否則會把使用者已驗收的正常 sprout paste 也擋掉。
```

OPUS 自我檢討：之前報告把 normal_floor_view sample 的 decoded True/False 混合
誤判為「巧合」、沒抓住「7,295 全紅 = 100% exiting」的整體統計。CODEX 解讀正確。

### OPUS 對「為何 normal view 也 100% exiting」的初步解讀（待 follow-up probe 確認）

```
H7'-A：firstVisibleHit 不是 floor box 本身，而是 sprout patch 內穿過的別的 box
       （emission box、CeilingLamp、TRACK 等貼近 floor 表面的薄 box）。
       這些 box 從相機方向看，BoxIntersect 走某個分支設 isRayExiting=TRUE。

H7'-B：BoxIntersect 對極薄 floor box (y ∈ [0, 0.01]) 的「ray 第一個交點」
       isRayExiting 計算規則與 OPUS 之前理解不同；
       Box 內外判定可能存在 epsilon 邊界。
```

兩條皆需 follow-up probe（記為 H7'-A / H7'-B），本回合不做。

### 給下一輪 H7' guard 設計輪的 OPUS 預備案（候選、不送修）

| 方向 | 條件 | 優點 | 風險 |
|---|---|---|---|
| 1. firstVisiblePosition.y 範圍 | `firstVisiblePosition.y >= floor.yMax + ε` | 直接、語意清楚 | inside-floor view 的 first hit 也可能 ≥ yMax，需 probe L3 確認分布 |
| 2. camera y position | `uCamPos.y >= floor.yMax + ε` | 最簡單可靠；正常 cam=1.45 vs inside cam=-0.08 完全分離 | 相機剛好穿地板表面時可能漏接 |
| 3. ray-side 組合 | `firstVisibleIsRayExiting == FALSE OR cameraPos.y > threshold` | 既保 H7' 訊號又能涵蓋邊界 | 條件複雜 |
| 4. firstVisible* + patch 中心比對 | 比對方向向量 | 通用 | 計算成本高、邊界 case 多 |

**OPUS 推測方向 2 最簡單可靠**，但 epsilon 閾值需先 probe L6（cameraPos.y）+ L3（firstVisiblePosition.y）的正常分布。

### CODEX P2 既有風格小風險（OPUS 確認非新引入）

```
js/InitCommon.js
  L3782-3784  既有 reportR7310C1FullRoomDiffuseRuntimeProbe finally
              if (savedRenderTarget && renderer) renderer.setRenderTarget(savedRenderTarget);
  約 L3947    OPUS 新 reportR738C1SproutPasteRuntimeProbe finally（同 pattern）
```

兩個 reporter 都應支援 `null` restore，但屬既有 pattern 一致性問題、不該只修新版。
列為獨立 sub-task「reporter finally null-restore 修補」、本回合不修。

### 第三刀後 OPUS / CODEX 共識封口

```
1.  H7' 根因成立：R7-3.8 paste path 缺 inside-geometry guard。
2.  Guard 設計**不能單看** firstVisibleIsRayExiting；
    需配合 firstVisiblePosition.y / cameraPos.y / ray-side 等附加條件區分視角。
3.  Probe 為 readback-only，預設行為 100% 與原 paste mix 相同。
4.  H7' guard 設計輪暫緩，等使用者明確開始才動 code。
5.  OPUS 建議下一個動作：先做 follow-up probe（L3 + L6 在 normal vs inside view 的分布、
    H7'-A / H7'-B 假設驗證）再開 guard 設計輪。
```

### 對應 Debug_Log 章節

```
待寫：R7-3.10-c1-phase2-third-knife-h7prime-probe（OPUS 留給 CODEX 第三刀正式收尾時加入）
```

### CODEX 自跑驗證（OPUS 紀錄供未來追溯）

```
node --check js/Home_Studio.js                                           pass
node --check js/InitCommon.js                                            pass
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs                 pass
git diff --check                                                          pass
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js           pass
（CODEX 未重跑 browser runner；H7 短路無 regression 依 OPUS 結果檔為準）
```

---

## 2026-05-15 H7' follow-up probe 完成 + CODEX 審查共識（推薦 camera-y guard）

> ⚠️ 歷史紀錄（當輪狀態快照，非現況）：
> H7' camera-y guard 已於後段「## 2026-05-15 H7' camera-y guard 完成 + 使用者視覺驗收 + CODEX 審查通過」完成、
> 經 CODEX 審查與使用者肉眼驗收、不回退。
> 本章節內的「給下一輪 H7' guard 設計輪的 OPUS 預備案 / guard 設計輪暫緩 / 待 H7' guard 設計輪實作」
> 均為當時表述，請勿讀成現況。
>
> 本段為第三刀件 3 follow-up probe 執行結果與 CODEX 審查 finding 對齊紀錄。
> probe-only：當輪未送 guard 修法；推薦 guard 方向已收斂到「camera-y 閾值」（後續已落地）。

### Probe 實作（4 檔案 diff，與第三刀 readback probe 同基礎擴充）

| 檔案 | 改動 |
|---|---|
| `shaders/Home_Studio_Fragment.glsl` | 第三刀 paste path probe 擴充：L5 firstVisibleHitType / objectID（R/G/B 三通道編碼）、L6 cameraPos.y（[-1, +4] 線性編碼到 [0, 1]） |
| `js/Home_Studio.js` | 無變（uniform 第三刀已加） |
| `js/InitCommon.js` | `r738C1SproutPasteProbeDecodeModeForLevel` 加 L5/L6 mapping；`decodeR738C1SproutPasteProbeSample` 加 `firstVisibleHitObject` / `cameraPosY` decode；probeLevel 範圍 0-4 → 0-6 |
| `docs/tools/r7-3-8-c1-bake-capture-runner.mjs` | sample point 改 7 點 grid（中心 + 4 邊 + 2 角）；levels [1,2,3,4] → [1,2,3,4,5,6] |

### Probe 量化結果（3 cameras × 6 levels = 18 cases）

```text
Package: .omc/r7-3-8-sprout-paste-probe/20260515-153545/sprout-paste-probe-sample-report.json

normal_floor_view（runner cameraState position.y = 1.45）
  L1 pastePassCount = 7,295 / 921,600
  L4 rayExitingTrueCount = 7,295 / 921,600 → 100% paste-pass = exiting
  L5 firstVisibleHitType / objectID：sample 7 點全沒落在 paste-pass 區，
                                    decode 結果是 path tracer 渲染值（不可作 paste-pass 證據）
  L6 cameraPos.y：sample 7 點全沒落在 paste-pass 區，decode 出 1.719/2.064/0.058/.../0.162
                  （是 path tracer 渲染 r 通道用 L6 公式的「假值」，非 readback 證據）
                  → 真實 normal cam y = 1.45 來自 cameraState，**非 sample readback**

inside_floor_level_view（runner cameraState position.y = -0.08）
  L1 pastePassCount = 393,289 / 921,600
  L4 rayExitingTrueCount = 393,289 / 921,600
  L5 firstVisibleHitType=1 / objectID=1 → ✅ sample readback：first hit 是 floor box
  L6 cameraPos.y = -0.08 → ✅ sample readback 直接量到
  L2 firstVisibleNormal = (0, 1, 0) → 地板上表面外法線
  L3 firstVisiblePosition.y = clamp(-0.05)（編碼範圍上限）

inside_floor_up_view（runner cameraState position.y = -0.08）
  L1 pastePassCount = 921,600 / 921,600
  L4 rayExitingTrueCount = 921,600 / 921,600
  L5 hitType=1 / objectID=1 → ✅ sample readback
  L6 cameraPos.y = -0.08 → ✅ sample readback 直接量到

H7 短路無 regression：bakedSurfaceHitCount = 96,170 / shortCircuit = 190,559
```

### CODEX 審查 P2 finding（OPUS 已認證並修正表述）

```
P2.1 OPUS 報告原句「L6 cameraPos.y normal = 1.45」太滿。
     正確分層：
       inside view 的 -0.08 是 sample readback 直接量到（sample 在 paste-pass 區內）
       normal view 的 1.45 來自 runner cameraState，不是 sample readback
       （normal view 的 7 sample 全沒落在 paste-pass 區）

P2.2 H7'-A（normal view 7,295 paste-pass first hit 是哪個 box）仍未直接驗證。
     CODEX 接受 OPUS 標為低優先；不阻擋 guard 設計（推薦 guard 不依賴 hitType/objectID）。
     需保留此限制於 MD。
```

### H7'-B 靜態 code review（PathTracingCommon.js:2748-2774）

```glsl
float BoxIntersect(...) {
    if (t0 > t1) return INFINITY;
    if (t0 > 0.0) {                          // ray origin 在 box 外
        isRayExiting = FALSE;
        return t0;
    }
    if (t1 > 0.0) {                          // ray origin 在 box 內 (t0 ≤ 0)
        isRayExiting = TRUE;
        return t1;
    }
}
```

```
邏輯：isRayExiting = TRUE 只在 ray origin 完全在 box 內（t0 ≤ 0）才成立。

矛盾觀察：normal cam y=1.45 完全在 floor box (y∈[0, 0.01]) 外
         → ray 從上方打進地板，理論上 isRayExiting=FALSE
         但 probe 顯示 normal view paste-pass 100% 是 isRayExiting=TRUE。

最可能解釋（H7'-B 暫定假設）：
  normal view paste-pass fragment 的 first visible hit 不是 floor box，
  而是某個包住相機的 box（候選：天花板 cloud emission 結構、wall、X-ray 透視 box）。
  cam 在那個 box 內 → t0 ≤ 0 → isRayExiting=TRUE。
  此假設待 H7'-A 直接 sample readback 才能完整驗證。
  對 guard 設計無影響（推薦 guard 用 cameraPos.y）。
```

### 推薦 H7' guard 條件（CODEX / OPUS 雙向共識）

```glsl
// shader 改動方向（待 H7' guard 設計輪實作；本回合不送）
if (uR738C1BakeCaptureMode == 0 &&
    uR738C1BakePastePreviewMode > 0.5 &&
    uR738C1BakePastePreviewReady > 0.5 &&
    uCamPos.y >= 0.025 &&                                   // ← H7' guard
    cloudVisibleSurfaceIsFloor(firstVisible*) &&
    !r739C1CurrentViewReflectionActiveForTarget(...))
{
    // paste mix
}
```

理由：
```
1.  uCamPos.y 是 uniform，與 first visible hit 無關，
    避開 H7' P1（不能單看 firstVisibleIsRayExiting）與 H7'-A 黑盒（hitType 未直接驗證）。
2.  完美 separate normal (1.45) 與 inside (-0.08)，閾值 0.025 ≈ floor.yMax + 0.015 m 安全餘裕。
3.  邊界 case（相機穿地板，y∈[0, 0.025]）擋掉嫩芽屬合理。
4.  不依賴 firstVisibleIsRayExiting / firstVisibleHitType / firstVisibleObjectID。
```

### 殘留 follow-up（不阻擋 guard 設計輪）

```text
1.  H7'-A 直接 sample readback 完成
    方法：先跑 reportR738C1BakePastePreviewConfig() 取 sprout patch bounds，
          再從相機矩陣推算 sprout patch 中心在螢幕的投影座標，
          用該座標當 sample point 跑 L5 readback。
    目的：直接驗證 normal view paste-pass first hit 是哪個 box。
    優先級：低（不影響 guard 設計）。

2.  H7'-B 完整邏輯追蹤
    方法：找出包住相機 (y=1.45) 的 box 是哪個。
    目的：理解為何 normal view first hit 不是 floor。
    優先級：低（不影響 guard 設計）。

3.  reporter finally null-restore 修補（CODEX P2 原列、既有風格、本回合不修）
    js/InitCommon.js 兩個 reporter 的 finally 都應支援 null restore。
```

### Guard 設計輪實作要求（給未來主導者）

```text
推薦實作步驟：
  1. shader 加 `uCamPos.y >= 0.025` 條件到 R7-3.8 paste mix 外層 if
  2. node --check 三檔
  3. 跑 R7-3.10 short-circuit smoke：H7 路徑無 regression（96,170 / 190,559）
  4. 跑 H7' probe pre/post-guard 對比：
     pre-guard inside view paste-pass = 393,289 / 921,600
     post-guard inside view paste-pass 應接近 0
     pre-guard normal view paste-pass = 7,295
     post-guard normal view paste-pass 應仍接近 7,295（不被誤擋）
  5. 使用者實機驗收：
     - 地板烘焙 OFF + 正常視角 → 嫩芽顯示
     - 地板烘焙 OFF + 相機進入地板內部 → 嫩芽消失
     - H8 / C' / H7 既有行為不變

禁區：
  1. 不修 H7 / H8 / C'
  2. 不重烘 atlas
  3. 不碰 ACOUSTIC_PANEL / textures/gik244_*.jpeg
  4. guard 不得單看 firstVisibleIsRayExiting（CODEX P1）
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

### Guard 實作（diff 範圍，OPUS 端尚未 commit）

| 檔案 | 改動 |
|---|---|
| `shaders/Home_Studio_Fragment.glsl` | R7-3.8 paste path 最外層 if 加 `uCamPos.y >= 0.025 &&`（符合共識「外層條件」；probe 不 bypass，使 pre/post-guard probe L1 能驗證 guard 生效） |
| `js/InitCommon.js` | `reportR738C1SproutPasteRuntimeProbe` single-frame render 前補 `uCamPos` 同步（`worldCamera.updateMatrixWorld(true)` + `uCamPos.value.setFromMatrixPosition(worldCamera.matrixWorld)`），修 probe harness uCamPos 殘留 bug |

### 過程中發現並修掉的 probe harness bug（systematic debugging 結論）

```text
症狀：
  第一次 post-guard probe（160727）結果自相矛盾——
  inside_floor_level_view L1 paste 通過（393,289，guard 沒擋），
  但同 camera L6 讀到 uCamPos.y = -1（< 0.025，guard 該擋）。
  inside_floor_up_view 卻被正確擋（0）。兩者 camera position 相同 y=-0.08。

root cause：
  uCamPos uniform 只在 render loop 每幀（js/Home_Studio.js:7052）
  由 cameraControlsObject.position 設定。
  reportR738C1SproutPasteRuntimeProbe 強制 single-frame render，
  只 copy uCameraMatrix，沒同步 uCamPos。
  → guard 讀到上一個 probe case 殘留的相機位置，每個 case 跳值。
  → guard 邏輯本身正確，是 probe harness 沒同步 uCamPos。

fix：
  reporter single-frame render 前補 uCamPos 同步到 worldCamera 世界位置。
  修正後重跑（161108）三組 camera 結果完全符合預期。
```

### 三輪 pre/post 對比（L1 paste-pass count）

```text
                          pre-guard   post-guard(buggy)   post-guard(fixed)
                          153545      160727              161108
normal_floor_view         7,295       7,295               7,295    ← 正常視角保留 ✓
inside_floor_level_view   393,289     393,289             0        ← guard 擋住 ✓
inside_floor_up_view      921,600     0                   0        ← guard 擋住 ✓
```

### 使用者肉眼驗收回報（2026-05-15）

```text
1.  地板內部已經成功全黑，烘焙開關不影響 → 件 3 H7' guard 視覺驗收通過 ✅
2.  地板烘焙 ON，東北衣櫃底部南側頂邊仍有黑線 → 件 1，H5 / H3' 第二輪未修，非 regression
3.  北牆烘焙 ON，東北衣櫃頂部北側頂邊仍有黑線 → 件 2，H5 / H3' 第二輪未修，非 regression
```

### 件 1 / 件 2 非 H7' guard regression 的 code path 證據

```text
H7' guard 改動：R7-3.8 paste path（main 尾段 firstVisible* 體系）uCamPos.y >= 0.025
件 1 / 件 2 來源：R7-3.10 floor / north baked atlas runtime 短路
                （bounce loop 內 r7310C1FullRoomDiffuseShortCircuit、hit* 體系）
兩條路徑完全獨立；H7' guard 不碰 atlas、不碰 C'、不碰 NearestFilter 取樣。
旁證：guard 加入後 R7-3.10 short-circuit smoke = 96,170 / 190,559
     與第二刀 post-guard 完全一致 → R7-3.10 路徑零變動。
```

### 驗證清單

```text
✅ node --check js/InitCommon.js
✅ R7-3.10 short-circuit smoke：96,170 / 190,559（H7 / H8 / C' 無 regression）
✅ H7' probe post-guard-fixed 18 cases pass
✅ 三輪 pre/post 對比符合驗收標準
✅ 使用者肉眼確認件 3 視覺驗收通過
```

### 結果檔路徑

```text
.omc/r7-3-8-sprout-paste-probe/20260515-161108/sprout-paste-probe-sample-report.json   ← post-guard-fixed
.omc/r7-3-10-full-room-diffuse-runtime/20260515-161145/runtime-report.json             ← H7 無 regression
```

### 當時下一步（歷史，已由 1024 收尾段取代）

```text
件 3 H7' guard 已視覺驗收通過 → 待 CODEX 第三刀正式收尾
                                （cache-buster 升級 + commit + Debug_Log）
件 1 / 件 2 進 H5 / H3' 第二輪：下一刀執行兩條已封口 probe（不改視覺）：
  1. nearest hit interval：反推 floor row 131 / north row 344 的
     visible world z / y 命中區間，換算 mm 比對使用者肉眼黑線寬度
  2. visible-hit runtime probe：在黑線 sample point 回讀 runtime atlas row / col，
     確認黑線 pixel 真的命中 row 131 / row 344，排除 postprocess 混入
兩條 probe 封口後才開 H5 / H3' 第二輪設計輪
當時候選方向：alpha mask / push-pull dilation / runtime fallback 三選一；現況已採 1024 bake resolution，C runtime fallback 已移除。
```

現況：CODEX 已完成 Debug_Log / Index / cache-buster / commit；件 1 / 件 2 已以 1024 bake resolution 收斂，C runtime fallback 已移除。

### CODEX review 殘留建議（commit 前處理，OPUS 同步自 CODEX 主檔）

```text
1.  runner 的 status: pass 目前只檢查 sample 是否為有限數值。
    commit 前建議補成語意檢查：normal = 7,295 保留、inside = 0。

2.  相關註解需從「第三刀前 / 不加 guard / probe 1~4」更新為目前狀態：
    - H7' guard 已落地。
    - probe levels 已擴到 1~6。

以上兩條屬 CODEX 第三刀正式收尾範圍；OPUS 此輪不動，僅同步記錄避免遺漏。
```

### 鎖定禁區更新

```text
H7' guard 不回退；後續不得改成單看 firstVisibleIsRayExiting
（CODEX P1：normal view 與 inside view 的 paste-pass 都 100% exiting）。
其餘第一刀 / 第二刀 / 第三刀前禁區維持。
```

---

## 待辦清單（Phase 2 設計接 Phase 2 實作的 hand-off）

第一輪（共識版，依 CODEX 審查順序）：

| 狀態 | 步驟 | 等誰 |
|---|---|---|
| - [x] | Phase 2 設計：OPUS 初版 | OPUS（已完成） |
| - [x] | Phase 2 設計：CODEX 第 1 輪審查 | CODEX（已完成） |
| - [x] | Phase 2 設計：OPUS 第 1 輪修正版 | OPUS（已完成） |
| - [x] | Phase 2 設計：CODEX 第 2 輪審查 | CODEX（已完成） |
| - [x] | Phase 2 設計：OPUS 第 2 輪修正版 | OPUS（已完成） |
| - [x] | Phase 2 設計：CODEX 第 3 輪審查（條件式同意） | CODEX（已完成 2026-05-15） |
| - [x] | Phase 2 設計：OPUS 第 3 輪修正版（本檔） | OPUS（已完成 2026-05-15） |
| - [x] | Phase 2 設計：使用者裁定進入第一輪實作 | 使用者（已裁定 2026-05-15） |
| - [x] | Phase 2 實作 Step 3.1.3 H8 combined texture / ready loader 設計選方案（採 a' per-slot ready） | CODEX 第一刀（已完成 2026-05-15） |
| - [x] | Phase 2 實作 Step 3.1.1 / 3.1.2 H8 per-surface gate | CODEX 第一刀（已完成 2026-05-15） |
| - [x] | Phase 2 實作 Step 3.3 C' bake UV | CODEX 第一刀（已完成 2026-05-15） |
| - [x] | Phase 2 重烘 floor / north 1000SPP atlas | CODEX 第一刀（已完成 2026-05-15）。floor `.omc/r7-3-10-full-room-diffuse-bake/20260515-112620/`、north `20260515-112717/` |
| - [x] | Phase 2 第一階段實機驗收：H8 嫩芽共存通過；fixed-X 西側黑線消失通過；fixed-Z / fixed-Y 新黑線登記 H5 / H3'；inside-floor sprout glow 登記 H7' | 使用者 + OPUS + CODEX（已完成 2026-05-15） |
| - [x] | Phase 2 實作 Step 1 B' probe（shader levels 2~6 + JS API 擴充） | CODEX 第二刀（已完成 2026-05-15） |
| - [x] | Phase 2 跑 B' probe 取數值（pre-guard / post-guard L1 short readback） | CODEX 第二刀（已完成 2026-05-15） |
| - [x] | Phase 2 實作 Step 3.2 H7 inside-geometry guard（含新增 hitIsRayExiting hit-state） | CODEX 第二刀（已完成 2026-05-15） |
| - [x] | Phase 2 第二階段實機驗收：地板烘焙 ON 時相機進入地板實體不再見 baked 貼回 | 使用者（已通過 2026-05-15） |
| - [x] | Phase 2 第一輪結束評估：件 1 / 件 2 啟動 H5 / H3' 第二輪；件 3 獨立啟動 H7' | OPUS + CODEX + 使用者（已完成 2026-05-15 雙向 10 問共識封口） |
| - [x] | Phase 2 第三刀 件 3（H7' / sprout-paste-inside-guard）readback probe 實作與執行 | OPUS 主導實作（2026-05-15）；CODEX 審查接受根因 |
| - [x] | CODEX 審查 H7' probe 結果（指出 P1：guard 不得單看 firstVisibleIsRayExiting） | CODEX（已完成 2026-05-15） |
| - [x] | H7' follow-up probe（L3 firstVisiblePosition.y 分布、L6 cameraPos.y 分布、H7'-A 假設、H7'-B 假設） | OPUS 已完成 2026-05-15；CODEX 審查接受 |
| - [x] | H7' camera-y guard（`uCamPos.y >= 0.025`） | OPUS 已完成 2026-05-15；CODEX 審查接受、使用者視覺驗收通過、不回退 |
| - [x] | 下一刀 件 1 / 件 2 H5 / H3' probe（nearest hit interval、visible-hit runtime row / col probe） | OPUS 已完成；1024 resolution 收斂，使用者肉眼驗收通過 |
| - [ ] | reporter finally null-restore 修補（CODEX P2、既有風格、本回合不修） | OPUS 或 CODEX 任一方 |
| - [x] | 件 1 / 件 2 H5 / H3' probe 封口後，啟動 H5 / H3' 第二輪設計 | CODEX 裁定採 1024 bake resolution；C fallback 已移除 |

第二輪（候選，視第三刀 probe 結果再啟動）：

| 狀態 | 步驟 | 等誰 |
|---|---|---|
| - [x] | Phase 2 第二輪 H5 / H3' 修法設計啟動決策 | CODEX 裁定採 1024 bake resolution，不走 fallback |
| - [x] | Phase 2 實作 H5 / H3' 第二輪修法 | OPUS 執行 floor / north 1024 bake，CODEX 審查 |
| - [x] | Phase 2 第二輪驗收 | 使用者確認兩條黑線在 1024 看不出來 |
| - [ ] | Phase 2 East wall runtime 設計（如需要） | OPUS + CODEX |

---

## 2026-05-15 OPUS 旁支：北牆橫擺 GIK 貼圖旋轉修復完成

> 本段為 OPUS 在 Phase 2 主線旁同步處理的子任務紀錄，與 CODEX 第一刀 H8 + C' 平行進行、互不衝突。CODEX 對位檔已同步更新「協作邊界」與新增「2026-05-15 OPUS GIK 修復完成回報」段。
> **2026-05-15 補注**：第二刀（B' probe + H7 guard）已完成；GIK 修復已落入 commit `518d3aa`、第二刀已落入 commit `fc6b35f`。本段以下「CODEX 接手第二刀」字樣為 Git 落地前的歷史敘述，現已成為既定事實。

**任務 id**：`gik-north-rotate-uv-r4`
**結果**：使用者 Config 1 / 2 / 3 / 4 四個情境全部實機驗收通過。
**Debug 紀錄**：寫入 `docs/SOP/Debug_Log.md` 同名章節（含 symptom / root cause / implementation / verification / pitfalls / rules reinforced 六段）。

**根因兩條獨立線**：

1. shader UV 邏輯（`ACOUSTIC_PANEL` 分支）為直擺 GIK 寫死 U→X、V→Y；R6-3 把北牆 GIK 改成三片橫擺（X 軸 1.2 m、Y 軸 0.6 m）後 1440×2912 直立貼圖被映射到橫擺面板上必然拉寬壓扁。
2. `gik244_grey.jpeg` 與 `gik244_white.jpeg` 上下邊緣留有原圖製作時的 padding 偽影（grey 頂部 row 0~4 fade `237→136`、底部 row 2907~2911 跳變；white 頂部 row 0~8 fade `241→208`、底部 row 2907~2911 跳變），R2-LOGO-FIX 採整條 0~1 必然碰到，旋轉後位置從不易察覺處甩到顯眼處。

**修法（兩條線各自獨立、不互相 hack）**：

- 線 1（shader）：box 自描述 `rotateUV90` 旗標走 box data texture pixel 4 的 `.b` 槽位（R2-18 註解的保留欄位），shader 在 `ACOUSTIC_PANEL` 三個 hitNormal 子分支結束後做整體 90° 順時針 UV 旋轉。物件語義屬性而非幾何條件，符合 CLAUDE.md Rule 2。
- 線 2（貼圖）：PIL 將兩張貼圖的頂底偽影 row 用相鄰健康 row mirror 覆蓋（grey 頂部 row 0~4 取 row 5~9 mirror、底部 row 2907~2911 取 row 2902~2906 mirror；white 範圍同策略但頂部修補寬度 9 row）。原檔備份於 `.bak-pre-padding-fix`。

**改動清單**：見 CODEX 主檔同段。共 6 個檔案：`js/Home_Studio.js`、`shaders/Home_Studio_Fragment.glsl`、`Home_Studio.html`、`textures/gik244_grey.jpeg`、`textures/gik244_white.jpeg`、`docs/SOP/Debug_Log.md`。

**對 Phase 2 主線的非衝突保證**：

- 不動 `js/PathTracingCommon.js`（CODEX C' 修改範圍）
- 不動 `js/InitCommon.js` 的 H8 runtime gate 邏輯
- 不動 H8 / C' / H7 / H5 / H3' 任何相關 atlas、runtime、metadata 結構
- 不動 R7-3.8 / R7-3.9 / R7-3.10 任何 bake 或 contract test
- 對 `box data texture pixel 4` 只佔用 `.b` 槽位，`.a` 仍為保留欄位

**Phase 2 後續 probe 注意事項**：

第二刀 B' probe + H7 guard 已完成。後續第三刀 probe 不需要避開 GIK；但 ACOUSTIC_PANEL 分支與 `gik244_*.jpeg` 已成定論，不再納入 Phase 2 probe 改動。OPUS 可接續審查、討論延後項（H5 / H3' / East wall runtime）。

**Git 狀態（已更新 2026-05-15）**：OPUS GIK 修復已 commit 為 `518d3aa fix(gik): rotate north horizontal panel UV and repair texture padding`；CODEX 第一刀 H8 + C' 已 commit 為 `198427e feat(R7-3.10-c1-phase2): land first knife H8 gate and bake UV fix`；CODEX 第二刀 H7 guard 已 commit 為 `fc6b35f fix(R7-3.10-c1-phase2): guard floor runtime exiting hits`。三個 commit 已落入 `codex/r7-3-10-c1-full-floor-diffuse-bake` 分支歷史。

---

## 2026-05-15 R7-3.10 H5/H3' 第二輪收尾鏡像：1024 bake resolution

> 完整共識記錄見 `2026-05-14-r7-3-10-c1-seam-debug-consensus-opus.md` 同日「1024 bake resolution」段。本段為設計檔鏡像，僅記關鍵結論與待辦狀態。

```text
件 1 / 件 2 黑線：以 bake atlas 512→1024 修法，使用者肉眼確認完全消失。
  floor 1024 .omc/r7-3-10-full-room-diffuse-bake/20260515-215727
  north 1024 .omc/r7-3-10-full-room-diffuse-bake/20260515-212509
  512 備份 .omc/r7-3-10-1024-pointer-backups/20260515-212327/
  1024 鎖為正式候選；2048 本輪不推進（北牆相位退化）。
驗證：contract pass、smoke 96170/190559、H5 probe 682/1494。
亮差根因：LIVE↔bake 交界深度相加（shader L2992-3033 splice+break），
  partial bake 過渡假象、全烘焙自解；驗收基準改全相關面 bake vs 全 LIVE。
防污染：Option A snapshot 保留為遙測；Option B
  `if (uR738C1BakeCaptureMode != 0) return false;` 已加（CODEX 核准），
  後驗證 runtime 零退化。C fallback 已移除不回退。
Debug_Log / Index + cache-buster 已由 CODEX 補齊；commit 由 CODEX 執行。
```

### 待辦清單狀態更新（第二輪）

```text
- [x] 件 1 / 件 2 H5 / H3' 第二輪修法（採「提高 bake 解析度 512→1024」，
      非 alpha mask；CODEX 裁定、OPUS 執行、使用者肉眼驗收通過 2026-05-15）
- [x] Option A bake 污染遙測 + Option B captureMode guard（CODEX directive #4）
- [x] CODEX 收刀：Debug_Log 章節 + Debug_Log_Index + cache-buster 已補齊；commit 由 CODEX 執行
- [ ] 後續方向：往「全相關靜態漫射面烘焙」推進（floor+north 為第一組成功樣本，
      減少 partial bake 與 live 交界）
```
