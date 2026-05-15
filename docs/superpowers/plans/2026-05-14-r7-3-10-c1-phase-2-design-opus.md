# R7-3.10 C1 接縫除錯 Phase 2 設計報告（OPUS 版本）

日期：2026-05-14 起草；2026-05-15 進入第 3 輪修正版
狀態：Phase 2 設計階段，第 3 輪 CODEX 審查完成、OPUS 第 3 輪修正後版本。CODEX 第 3 輪條件式同意已成立。本檔只承載 Step 1 / 2 / 3 設計結果，未動 shader / JS。
範圍：B' shader 數值 probe 設計、C' fixed-X 暗帶外溢根因確認、H8 / H7 / C' 第一輪修法方案設計（H5 / H3' 延後至第二輪獨立決策）
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

**下一步**：等使用者裁定是否進入 Phase 2 第一輪實作。實作起點為 Step 3.5 順序的第 1 項（Step 3.1.3 H8 combined texture / ready loader 設計選方案，OPUS 推薦方案 a'）。

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
| - [ ] | Phase 2 設計：使用者裁定是否進入第一輪實作 | 使用者 |
| - [ ] | Phase 2 實作 Step 3.1.3 H8 combined texture / ready loader 設計選方案 | TBD |
| - [ ] | Phase 2 實作 Step 3.1.1 / 3.1.2 H8 per-surface gate | TBD |
| - [ ] | Phase 2 實作 Step 3.3 C' bake UV | TBD |
| - [ ] | Phase 2 重烘 floor / north atlas | TBD |
| - [ ] | Phase 2 第一階段驗收：西側黑線消失、嫩芽與 north baked 共存 | 使用者 |
| - [ ] | Phase 2 實作 Step 1 B' probe（shader levels 2~6 + JS API 擴充） | TBD |
| - [ ] | Phase 2 使用者跑 B' probe 取數值 | 使用者 |
| - [ ] | Phase 2 實作 Step 3.2 H7 inside-geometry guard（含新增 hitIsRayExiting hit-state） | TBD |
| - [ ] | Phase 2 第二階段驗收：相機進入地板實體不再見 baked 貼回 | 使用者 |
| - [ ] | Phase 2 第一輪結束評估：H5 / H3' 是否啟動第二輪 | OPUS + CODEX + 使用者 |

第二輪（候選，視第一輪結果再啟動）：

| 狀態 | 步驟 | 等誰 |
|---|---|---|
| - [ ] | Phase 2 第二輪 Step 3.4 H5 / H3' alpha mask 啟動決策 | OPUS + CODEX + 使用者 |
| - [ ] | Phase 2 實作 Step 3.4 H5 / H3'（如啟動） | TBD |
| - [ ] | Phase 2 重烘 atlas（含 mask） | TBD |
| - [ ] | Phase 2 第二輪驗收 | 使用者 |
| - [ ] | Phase 2 East wall runtime 設計（如需要） | OPUS + CODEX |

---

## 2026-05-15 OPUS 旁支：北牆橫擺 GIK 貼圖旋轉修復完成

> 本段為 OPUS 在 Phase 2 主線旁同步處理的子任務紀錄，與 CODEX 第一刀 H8 + C' 平行進行、互不衝突。CODEX 對位檔已同步更新「協作邊界」與新增「2026-05-15 OPUS GIK 修復完成回報」段。

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

**Phase 2 第二刀重啟條件**：

CODEX 接手第二刀（B' probe + H7 guard）時無須避開 GIK；但 ACOUSTIC_PANEL 分支與 `gik244_*.jpeg` 已成定論，第二刀不必再動。OPUS 可在第二刀過程中接續審查、討論延後項（H5 / H3' / East wall runtime）。

**Git 狀態**：本批改動目前全部在 unstaged 區，未 commit；待使用者決定如何與 CODEX 第一刀 staged 內容（H8 + C' + 重烘輸出）合併入 commit history。
