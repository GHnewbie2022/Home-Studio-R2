# Debug Log

---

## ⚠ 必讀：通用 Debug 紀律（所有 R 階段進入前必先閱讀）

以下三條為 3D Path Tracing 專案之血淚規則，R2-14 曾連續翻車三次（fix02 幾何、fix03 Z-fighting、fix04 shadow 自遮蔽）才找到真因。任何下一任 Claude 接手 debug 前，必須先讀完本章。

### 規則一：複用既有 material type 前，必先 Read 該 type 在 shader 中的完整分支

shader 中每個 `if (hitType == X)` 分支可能內含**尺寸條件判斷、UV pattern 繪製、貼圖映射**等依幾何參數變化的邏輯。複用者只看到「表象白漫射」就貼標，會踩到新物件尺寸誤觸原分支內部條件的地雷。

**禁止**：僅憑「看起來是白色」、「看起來是金屬」這類表象就複用既有 type。
**必做**：Read 完該 type 的 `if (hitType == X) { ... }` 整塊，逐行確認分支邏輯對新物件的 halfSize / normal / UV 皆安全。

### 規則二：material type 命名必須為「物件語義」而非「材質特徵」

正確命名：`OUTLET`（插座）、`TRACK`（軌道）、`SPEAKER`（喇叭）、`LAMP_SHELL`（燈殼）
錯誤命名：`WHITE_DIFF`、`SHINY`、`DARK_BOX`

一旦 material type 命名為語義，PLAN 文件寫「軌道 box 標成 OUTLET」時，審查者一看語義不符就能當場擋下。若命名為材質特徵，語義防線消失，一污染就是跨類污染。

### 規則三：debug artifact 時，第一步先 Read artifact 所在物件之 hitType 分支

收到 artifact 回報後，診斷流程強制順序：
```
  1. 定位 artifact 對應的 box index 與 hitType
  2. 讀 shader 中該 hitType 的完整分支
  3. 逐行檢查分支邏輯是否會因該 box 之 halfSize/normal/UV 產生 artifact
  4. 若分支邏輯排除，再往幾何（BoxIntersect、BVH）或光路（shadow、NEE）方向
```

**禁止**：在未讀 material 分支的狀態下，直接跳到「幾何衝突」、「shadow 自遮蔽」、「BVH 錯誤」之類假說。
**理由**：R2-14 的 fix03、fix04 皆違反此條，每次都花數小時 + 多次失敗驗證才發現真因在 material 分支第 900-941 行。

### 驗證紀律（附加）

**宣告 fix 成功前必須**：
- Cam 1、Cam 2、Cam 3 三視角各至少 500 spp
- 每視角截圖比對
- 未達此門檻一律不得宣告完工

R2-14 fix04 曾於 Cam 1 17 spp 乍看乾淨就宣告成功，Cam 3 876 spp 才暴露真相，留下錯誤 memory 污染後續對話。此為反例。

---

## R2-3｜牆面 16 個 Box 幾何

### 症狀
房間渲染正常（奶油色牆面），但完全看不到梁柱凸出，也看不到門洞缺口。

### 根本原因（共三個，疊加）

**1. 瀏覽器快取 shader**
`.glsl` 檔案是由 JS 以 `fileLoader.load()` 動態載入，硬刷新（Cmd+Shift+R）只清 HTML 直接引用的資源，不清 JS 非同步載入的檔案。導致修改 shader 完全沒有效果，瀏覽器一直吃舊的 R1 shader。

修法：在 `Home_Studio.js` 的 `demoFragmentShaderFileName` 加上 `?v=Date.now()` cache-busting 參數。

**2. `BoxInteriorIntersect` 在相機於 box 外部時回傳背面**
`BoxInteriorIntersect` 的原始碼中，處理「相機在 box 外部（t0 > 0）」的程式區塊是被 comment 掉的。函式直接落到 `t1 > 0` 分支，回傳遠端面（背面）。

R2-3 的 16 個牆板 box 沒有任何一個包住相機，相機永遠在所有 box 的外部。導致：
- 梁柱的背面落在外牆裡面，深度比同位置的牆板更遠，被牆板遮住 → 梁柱不可見
- 牆板渲染在外牆位置（outer face），而非室內面（inner face）

修法：SceneIntersect 的 loop 改用 `BoxIntersect`（回傳 t0，正確的室內面），並加上 `out int isRayExiting` 參數。

**3. `type = 10` 在 CalculateRadiance 沒有對應分支**
框架的材質常數：`LIGHT = 0`、`DIFF = 1`、`REFR = 2`、`SPEC = 3`。
所有 box 使用 `type = 10`，CalculateRadiance 沒有處理 type 10 的分支，射線打到牆面後直接回傳黑色。

修法：SetupScene 中所有 box 的 type 從 `10` 改為 `DIFF`（框架漫射材質）。R3/R4 實作完整自訂材質系統後再換回自訂 type。

### 診斷過程關鍵步驟
- 改燈光顏色為綠色作為 shader 重載診斷 → 燈光不變綠，確認快取問題
- 加 cache-busting 後黑畫面 → 確認 shader 被載入，type=10 是第二個 bug
- 改 DIFF 後房間正常 + 梁柱/門洞可見 → 三個 bug 全部修完

### 副作用
- 效能：從 1 個 BoxInteriorIntersect 改為 16 個 BoxIntersect，運算量 16 倍。開發期 pixelRatio 改為 1.0，等 R6 BVH 加速後再恢復。
- 牆壁自動隱藏功能消失（BoxInteriorIntersect 的自然行為），留到 R4 處理。

---

## R2-4｜攝影機 Preset 切換疊影

### 症狀
Cam 1、Cam 2 反覆切換正常。一按 Cam 3（yaw = -π）就出現兩個視角疊加的畫面。反覆按 Cam 3 會在正確視角與初始視角之間交替閃爍。

### 根本原因
Three.js 的 **四元數 ↔ Euler 反向分解歧義**。

框架每幀執行 `cameraControlsYawObject.rotateY(inputMovementHorizontal)`（InitCommon.js line 945）。即使 `inputMovementHorizontal = 0`，`rotateY(0)` 仍然會觸發 `_onChangeCallback` → `rotation.setFromQuaternion`。

對於 yaw = -π 的四元數 `(0, -1, 0, 0)`，Euler XYZ 分解的合法結果有兩組：
- `(x=0, y=-π, z=0)` ← 我們設定的
- `(x=π, y=0, z=π)` ← Three.js 選的（數學等價，但 Euler 角完全不同）

如果只用 `rotation.y = -π` 設定單軸，被污染的 `x=π, z=π` 不會被清除。合成的 Euler `(π, -π, π)` = Rx(π)·Ry(-π)·Rz(π) = **恆等旋轉**，攝影機跳回面向前方。

下一幀 `rotateY(0)` 把恆等四元數分解回 `(0, 0, 0)`，再設 `rotation.y = -π` 得到正確的 `(0, -π, 0)`。如此每幀交替正確/錯誤，progressive renderer 將兩個角度混合成疊影。

小角度（Cam 1 yaw=0、Cam 2 yaw=-0.25）的四元數分解不會產生歧義，所以不受影響。

### 修法
所有設定 rotation 的地方改用 `rotation.set(x, y, z)` 同時清除三軸：
```javascript
// 錯誤（只設單軸，其他軸可能被四元數反向分解污染）
cameraControlsYawObject.rotation.y = cam.yaw;
cameraControlsPitchObject.rotation.x = cam.pitch;

// 正確（同時清除三個分量）
cameraControlsYawObject.rotation.set(0, cam.yaw, 0);
cameraControlsPitchObject.rotation.set(cam.pitch, 0, 0);
```

### 通則
在使用 `rotateY` / `rotateX`（delta 模式）的 Three.js 專案中，任何直接設定 `Object3D.rotation` 的操作都必須用 `.set()` 清除全部三軸。此規則對所有角度生效，但只有 ±π 附近的角度會實際觸發可見 bug。

---

## R2-6｜喇叭貼圖水平方向被壓窄 + 白色角落

### 症狀
KH 150 喇叭正面/背面貼圖載入成功，但影像在面板上被水平壓縮，喇叭看起來瘦長。修正壓縮後，面板四角出現白色像素（產品照白色背景 + 喇叭圓角造成）。

### 根本原因
舊專案載入 Thomann `padthumb600x600`（600×600 正方形含白色 padding）後，用 `mOff()` 函式裁切掉 padding，再縮放到 1024×1024 上傳 GPU。新專案直接把整張正方形圖丟進 GPU，UV [0,1]×[0,1] 把正方形圖拉伸到非正方形面板（0.225m 寬 × 0.345m 高，比例 0.652:1），導致水平壓縮。

### 修法（共兩步）

**1. 改用原始比例圖片**
將 Thomann 原始比例圖片（401×600 / 402×600，比例 0.668:1）下載到本地 `textures/kh150_front.jpg`、`textures/kh150_back.jpg`，用 `THREE.TextureLoader` 直接載入。原圖比例與面板比例差距僅 2.5%，shader UV 獨立正規化 X/Y 軸，直接映射即可。

**2. canvas 黑底 + 放大裁白邊**
產品照白色背景 + 喇叭圓角導致面板四角出現白色。解法：canvas 先填 `#1f1f1f`（接近箱體色），再將圖片從中心放大 4%（`zoom = 1.04`），白色角落溢出 canvas 邊界被自然裁切。

```javascript
function prepSpeakerTex(img) {
    var c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, c.width, c.height);
    var zoom = 1.04;
    var dw = img.width * zoom, dh = img.height * zoom;
    var dx = (img.width - dw) / 2, dy = (img.height - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}
```

### 診斷過程中踩到的坑

**嘗試 1：只換圖片來源 → 失敗**
把 padthumb600x600 換成本地原圖（401×600），畫面無變化。原因：WebGL `texture(sampler, uv)` 無視圖片原始比例，UV [0,1] 永遠映射整張圖。圖片比例本身不影響渲染結果，關鍵是圖片內容是否含 padding。

**嘗試 2：照搬舊專案 mOff() 裁切 → 三個新問題**
1. 圖片上下顛倒：`CanvasTexture` 設了 `flipY = false`，但 shader UV.y=0 對應面板底部、UV.y=1 對應頂部，需要 `flipY = true`（預設值）
2. 超級模糊：從 401×600 原圖裁切出 ~330×510 像素，拉伸到 1024×1024 canvas，寬度放大 3 倍
3. 正方形 canvas 無意義：面板比例 0.652:1，canvas 不需要是正方形

### 通則（KH750 適用）
載入產品照貼圖時，使用 `prepSpeakerTex()` 處理：canvas 尺寸 = 原圖尺寸（保持清晰度），黑底填充 + 從中心微幅放大裁掉白色角落。`zoom` 值依圖片白邊大小調整。

---

## R2-6｜MAX_SAMPLES 過曝

### 症狀
設定 sample 上限後，放置一段時間畫面持續變亮直到全白過曝。

### 根本原因
框架的 progressive rendering 架構分三步：
1. **STEP 1**：path tracing shader 將新 sample **累加**進 `pathTracingRenderTarget` buffer
2. **STEP 2**：ping-pong 複製到 `screenCopyRenderTarget`
3. **STEP 3**：screen output shader 從 buffer 讀值，乘以 `1/sampleCounter` 正規化後顯示

第一版修法只在 JS 端阻止 `sampleCounter` 遞增（clamp 回 1000），但 STEP 1 每幀照跑，持續往 buffer 累加新 sample。buffer 實際累計了 N 幀的光能量，除數永遠 = 1000 → 亮度 = N/1000，N 無限增長 → 過曝。

### 修法（兩層防護）

**1. 阻止 counter 遞增**（InitCommon.js）
```javascript
// 原本
else sampleCounter += 1.0;
// 改為
else if (typeof MAX_SAMPLES === 'undefined' || sampleCounter < MAX_SAMPLES)
    sampleCounter += 1.0;
```

**2. 跳過渲染步驟**（InitCommon.js）
```javascript
var renderingStopped = (typeof MAX_SAMPLES !== 'undefined' && sampleCounter >= MAX_SAMPLES && !cameraIsMoving);
if (!renderingStopped) {
    // STEP 1: path tracing render
    // STEP 2: ping-pong copy
}
// STEP 3: screen output（永遠執行，保持畫面顯示）
```

### 通則
要停止 progressive renderer 的累積，**必須同時停止 counter 遞增和 render pass 執行**。只停 counter 不停 render 會導致 buffer 累計量與正規化除數脫鉤。`cameraIsMoving` 時解除停止，讓使用者移動攝影機後可以重新累積。

---

## R2-5 補完｜門貼圖實作 + 框架降噪導致所有貼圖模糊

### 症狀（共兩個）

**1. 鐵門 / 木門沒有材質貼圖**
R2-5 建立的兩扇門（北牆木門 index 25、西牆鐵門 index 26）使用 `type = 1`（DIFF 純色漫射），沒有套用貼圖。舊專案有木門（`duk.tw/awVrEr.png`）和鐵門（`duk.tw/DTlLYO.jpg`）貼圖。

**2. 所有貼圖表面（門、喇叭、窗外景色）看起來模糊**
貼圖 image 尺寸正確（木門 1280×3328、鐵門 687×1024），GPU `MAX_TEXTURE_SIZE = 16384` 足夠，console 確認 canvas 尺寸與原圖一致。但所有有貼圖的表面（不只門）都明顯模糊，與原圖直接比對差距很大。

### 根本原因

**門貼圖**：單純缺實作。需要新增 shader type、uniform、UV 採樣邏輯。

**所有貼圖模糊**：框架的 `ScreenOutput_Fragment.glsl` 內建 **7×7 降噪模糊核心**（37 像素空間平均）。此 shader 透過 `pixelSharpness`（儲存在 alpha channel）判斷像素是否為 edge：
- `alpha < 1.0`（非 edge）→ 與周圍最多 37 個像素做加權平均 → 紋理細節被平均掉
- `alpha == 1.0`（edge）→ 隨 sample 數遞增逐漸回到中心像素原色，`edgeSharpenSpeed = 0.05` 意味約 20 samples 後完全不模糊

CalculateRadiance 中 `pixelSharpness` 預設 = 0.0，只有射線未命中物件（天空/背景）時設為 1.0。所有命中漫射表面的像素（包括有貼圖的表面）都會被降噪模糊。舊專案沒有這個降噪 shader，所以貼圖清晰。

### 排除的錯誤假設

| 假設 | 排除方式 |
|------|----------|
| 貼圖被 Three.js 縮小 | console 確認 image/canvas 尺寸 = 原圖尺寸 |
| GPU 貼圖上限不足 | `gl.MAX_TEXTURE_SIZE = 16384`，遠超貼圖尺寸 |
| GLSL `texture()` LOD 選錯 | 改用 `textureLod(uv, 0.0)` 強制 LOD 0，仍模糊 |
| pixelRatio 太低（Retina 2x） | pixelRatio 影響整體渲染解析度，舊專案相同條件不模糊 |
| TextureLoader vs CanvasTexture | 兩種載入方式都一樣模糊 |

### 修法

**1. 門貼圖實作**

JS（`Home_Studio.js`）：
- 下載貼圖到本地 `textures/wood_door.jpeg`、`textures/iron_door.jpg`
- 木門 type `1 → 7`（WOOD_DOOR）、鐵門 type `1 → 8`（IRON_DOOR）
- 用 `Image` + `CanvasTexture` 載入（與 KH150 同樣作法），傳入 `uWoodDoorTex`、`uIronDoorTex` uniform

Shader（`Home_Studio_Fragment.glsl`）：
- 新增 `uniform sampler2D uWoodDoorTex, uIronDoorTex`
- 新增 `#define WOOD_DOOR 7` / `#define IRON_DOOR 8`
- 木門取 Z 面貼圖（`abs(hitNormal).z > 0.5`），鐵門取 X 面貼圖（`abs(hitNormal).x > 0.5`）
- UV 從 hitPoint 對 box center/half-size 正規化，gamma 2.2 校正
- 其餘面保持原色漫射

**2. 降噪模糊修正**

在 `CalculateRadiance` 中，第一次彈跳命中有貼圖的表面時，設 `pixelSharpness = 1.0`：
```glsl
if (bounces == 0)
{
    objectID = hitObjectID;
    if (hitType == BACKDROP || hitType == SPEAKER || hitType == WOOD_DOOR || hitType == IRON_DOOR)
        pixelSharpness = 1.0;
}
```
這讓降噪 shader 將該像素視為 edge，約 20 samples 後完全不做空間模糊，保留紋理原始細節。

### UV 方向注意

- 木門（北牆，Z 面）：`uv.x = lp.x / hs.x * 0.5 + 0.5`（無負號）
- 鐵門（西牆，X 面）：`uv.x = -lp.z / hs.z * 0.5 + 0.5`（需負號）
- 初始版本兩扇門都水平翻轉，因為正負號搞反

### 通則
此框架的 `ScreenOutput_Fragment.glsl` 會對所有 `pixelSharpness < 1.0` 的像素做 7×7 降噪模糊。任何新增的貼圖表面都必須在第一次彈跳時設 `pixelSharpness = 1.0`，否則紋理細節會被模糊核心平均掉。

---

## R2-11｜切換 Cam 殘影揮之不去

### 症狀
點擊 Cam 1/2/3 切換按鈕後，新視角畫面要 1~2 秒才逐步「蓋過」舊視角，期間兩張畫面明顯交疊。切換瞬間的觀感劣於原生遊戲引擎。

### 根本原因
progressive renderer 依賴 `sampleCounter` 計數 + accumulation buffer 加總光能量。攝影機切換時僅將 `cameraIsMoving = true` 並觸發 `sampleCounter = 1` 重置，但 `pathTracingRenderTarget` 本身的舊 sample 像素仍在 buffer 內，新 sample 疊加幾幀後才能在分母增長下被「沖淡」。因此視覺上呈現漸進交疊而非瞬間切換。

### 修法
切換 Cam 時同步清空兩個 render target（path tracing 累加 buffer + ping-pong 拷貝 buffer）：

```javascript
// Home_Studio.js 切換 Cam callback
needClearAccumulation = true;

// InitCommon.js animate() 開頭
if (needClearAccumulation)
{
    renderer.setRenderTarget(pathTracingRenderTarget);
    renderer.clear();
    renderer.setRenderTarget(screenCopyRenderTarget);
    renderer.clear();
    needClearAccumulation = false;
}
```

### 權衡
清空 buffer 會讓新視角第 1 幀呈現純雜訊（無累加），接下來 30~60 幀才逐步收斂。比起漸進交疊殘影，短暫雜訊觀感更接近即時引擎的切換反應，使用者偏好此 trade-off。

### 通則
progressive path tracer 的「切換殘影」本質上是 accumulation buffer 的記憶，不是單純 counter 重置可解。若要瞬間切換，必須實際 clear buffer；若要平滑過渡，則讓 counter 重置配合 progressive 累加自行收斂。兩者擇一，無中間解。

### 延伸應用（2026-04-18 R2-17 驗收期追補）
**本修法不限於 Cam 切換，凡「GUI toggle 連動幾何位置改變」皆適用。**

R2-17 驗收期間使用者回報：Cloud 吸音板 toggle 切換時，因連動吸頂燈 z 座標（0.591 ↔ -1.5）位移達 2m 以上，前位留下明顯殘影，需轉動視角始消。診斷對照本節，症同根同，僅觸發點不同——非視角切換，而是場景幾何位置切換。

**通用判準**：任何 onChange callback 若改動了影響 path 結果的 uniform（位置、旋轉、幾何 toggle、光源參數等大幅變動）且僅 `wakeRender()` 不足以消除視覺殘影時，補一行 `needClearAccumulation = true;` 即可。純 visibility toggle（如 fixtureGroup gating）通常靠 `cameraIsMoving=true` + sampleCounter 重置自然沖淡即可，不必強清。

分界線：**位置/姿態變動 → 強清；僅顯隱變動 → 軟收斂**。

---

## R2-11｜Bloom 金字塔演進（無作用 → 馬賽克 → 業界標準）

### 演進史
R2-11 的 bloom 實作經歷三個版本：

| 版本 | 架構 | 問題 |
|------|------|------|
| v1 | 單 pass Gaussian blur（1/4 res） | 參數保守，使用者看不出效果；調大後視覺無感 |
| v2 | 3 層金字塔（1/2, 1/4, 1/8, 1/16）+ 9-tap tent 可調 radius | 作用有但調大 radius 會馬賽克 |
| v3 | 7 層金字塔（1/2 ~ 1/128）+ 13-tap Karis brightpass + radius 鎖 1 | 定版，halo 廣域且無馬賽克 |

### v1 看不出效果的根因：Reinhard tone mapping 吞掉貢獻
lamp HDR ≈ 46（brightness=800 × 0.05764）。intensity=0.03 下：
- bloom 前 Reinhard `y = 46/(1+46) = 0.9787`
- bloom 後 `y = (46+8.75×0.03)/(1+46.26) = 0.9788`
- 差值 0.0001，人眼完全不可見

中間亮度區（HDR=5）差值 0.004、遠角（HDR=0.1）差值 0.003，全部落在感知閾值以下。單層 bloom 若 intensity 小會被 tone mapping 整條吃掉。

### v2 馬賽克的根因：tap spacing 超出 source texel
Upsample shader 使用 `vec2 o = (1.0 / srcSize) * uBloomRadius;`，tap 間距 = uBloomRadius 個 source texel。
- radius=1：tap 間隔 1 texel，落在相鄰像素中央，bilinear filter 平滑銜接 ✓
- radius=3：tap 間隔 3 texel，中間 2 texel 沒取樣，9 個 tap 變成 9 個離散斑點 ✗
- radius=8：離散 8 texel，最上層 mip (80×35) 的 9 tap 跨 ±8 texel = 畫面 22% 寬度，離散斑點被後續 upsample 放大到全畫面變馬賽克

### v3 定版：Jimenez / Unreal / Blender Eevee 演算法
參考 Jorge Jimenez "Next Generation Post Processing in Call of Duty: Advanced Warfare" SIGGRAPH 2014。三塊組合：

**1. 13-tap Karis average brightpass**
13 個 tap 分 5 個重疊 2x2 組，每組內用 Karis 加權：`w_i = 1/(1+luma_i)`，再組合為 `0.5 × center + 0.125 × (TL+TR+BL+BR)`。Karis 平均防止 path tracer firefly 單像素把整塊 mip 染白，解決 HDR 高亮度帶來的金字塔品質問題。

**2. 13-tap partial average downsample**（後續層）
同 13-tap 布局但不做 Karis（firefly 已在 brightpass 壓制）。簡化為一次加權總和 = 1.0。

**3. 9-tap tent upsample，radius 固定 1**
halo 廣度由金字塔層數決定而非 tap 間距。7 層在 1080p 提供 halo 有效寬度 ≈ full-res ±512 px，足以覆蓋整個天花板讓「房間光暈感」成立。radius 永遠 1 source texel 保證 bilinear 無縫銜接，根治馬賽克。

### 關鍵洞察
- 「bloom 只影響直接光」是使用者的錯覺 —— bloom 只看 HDR 亮度閾值，不分直接/間接光。間接光牆面 HDR < 0.3 所以不進 bloom 是正確行為
- 「房間光暈感」要靠 halo 擴散範圍達成，不是降 brightpass 門檻讓牆面自己發光（那樣不物理）
- 金字塔 mosaic 不是 weight 問題是 tap spacing 問題，加權只能遮掩、換 radius=1 + 多層才根治

### 通則
path tracer 上做 bloom 強制要 Karis average（普通 box filter 會把 firefly 像素擴散到全畫面）。金字塔 halo 廣度以「層數」調而非「radius」調。Reinhard tone mapping 下，additive bloom 需足夠 intensity（或足夠廣的 halo）才看得見，單層小 intensity 必被吞掉。

---

## R2-11｜samplesPerFrame UI 誤導

### 症狀
使用者觀察到 UI 有 `samples_per_frame` 滑桿 1~8，預設 8。拖到 1 與 8 畫面品質完全無差異，使用者疑惑。

### 根本原因
`uSamplesPerFrame` uniform 在 `Home_Studio.js` 有寫入，但 `Home_Studio_Fragment.glsl` 從未宣告也未使用。滑桿是前代保留的 UI 殘骸（可能是其他框架範例留下），shader 端從未實作「每幀跑 N 個 sample 後再寫入 accumulation buffer」的 for loop。

### 修法
預設值從 8.0 改為 1.0（三處：全域變數、GUI 物件、reset default），UI 滑桿保留為日後實裝 multi-sample 時復用。

### 通則
UI 層與 shader 層之間的 uniform 若非雙向活綁，容易產生「看起來能調實際無作用」的誤導。新增或維護 UI 控制項時要核對 shader 端實作，否則該 UI 應標示為 stub 或直接拔掉。

---

## R2-8｜吸音板 Config 切換後殘留舊畫面

### 症狀
點擊 Config 1 / Config 2 切換按鈕後，BVH 正確重建（box 數量正確），但螢幕上仍殘留上一個配置的幾何陰影。需等攝影機移動後才會完全更新。

### 根本原因
`InitCommon.js` line 768 在每個 `animate()` 迴圈開頭執行 `cameraIsMoving = false`。`applyPanelConfig` 在 GUI callback 中設定的 `cameraIsMoving = true` 會在下一幀被立刻覆蓋為 `false`，導致 `sampleCounter` 不會重置為 1，progressive accumulation 繼續混合舊畫面。

框架內建的 `switchCamera()` 能正常運作，是因為它同時設定了 `cameraSwitchFrames = 3`，而 `updateVariablesAndUniforms()` 在每幀檢查此計數器並持續設定 `cameraIsMoving = true` 共 3 幀。

### 修法
在 `applyPanelConfig` 中加入 `cameraSwitchFrames = 3;`，與 `switchCamera` 使用相同機制。

### 通則
此框架中，從 GUI callback 或外部函式設定 `cameraIsMoving = true` 不夠 — 必須搭配 `cameraSwitchFrames` 才能讓旗標跨過 `animate()` 開頭的重置。任何需要觸發累積緩衝區清除的操作（BVH 重建、場景幾何變更）都應使用此模式。


---

## R2-13｜木門西側 wall 2b asymmetric 暗化色差

### 症狀
北牆觀測時，木門（X∈[-1.52, -0.73]）**西側**緊鄰牆面（wall 2b, X∈[-1.91, -1.52]，寬 0.39m）出現區域性暗化；木門**東側**對應牆面（wall 3a, X∈[-0.73, 1.91]，寬 2.64m）完全正常。X-ray toggle ON/OFF 皆顯現，非 R2-13 framework regression。

### 排除假設
- **J（beam/wall 幾何重疊）**：雖東西側皆存在幾何重疊，但數量不匹配（2b 有 41% X 寬度被樑蓋、3a 僅 2.3%），光照差異遠不足以造成觀測到的暗化程度
- **K（木門共平面 X=-1.52）**：兩側對稱存在此接面
- **B'（denoise 邊界占比）**：單純面積比例稀釋不足以解釋
- **I（物理色滲 hemisphere）**：第一性原理重算後，Q' (wall 3a) 之 hemisphere 含雙倍深色喇叭，理論上應更暗而非更亮，反駁物理色滲主因

### 根本原因
`Home_Studio_Fragment.glsl` 行 377 之結構性 `uWallAlbedo` 套用條件寫為 `if (boxIdx >= 1 && boxIdx <= 15)`。R2-10 之前此範圍對應所有牆/樑/柱；但 fix10 將地板/天花板由原先的「單片」重切為 7 片後陣列索引重排，**牆體 2a/2b 雖仍落於 [1,15]，3a 起則被推至 16+ 脫出範圍**。

使用者在 GUI 以 wallAlbedo slider 拖至 0.1 作驗證實驗：僅地板、天花板、wall 2a/2b、木門西側區域變暗，其他牆壁完全無變化 — 直接確認此索引範圍脫鉤。

### 修法
```glsl
// 原：
if (boxIdx >= 1 && boxIdx <= 15) hitColor *= uWallAlbedo;
// 改為：
if (boxIdx <= 31) hitColor *= uWallAlbedo;  // 覆蓋 0..31 全部結構（地板/天花板/牆/樑/柱）
```

同時於 `InitCommon.js` 將 `uWallAlbedo` 預設值由 0.8 調整為 0.9，使整體結構表面反射率更符合 C_WALL [1.0, 0.984, 0.949] 原色期待。

### 通則
fix10 等結構性重切改動陣列長度時，**所有 shader 端以陣列索引硬編碼之 if 條件都必須同步審視**。以索引範圍劃分「結構 vs 傢俱」之兩個辦法選一：
1. 改為 **由上界單側** 包絡（如 `boxIdx <= 31`），讓未來新增結構時只需維持新 box 插在前段即可
2. 為每個 box 增一個 `group_id` meta 欄位，shader 讀 meta 而非 index

本專案採 1。新增結構 box 時，必須保持 `addBox()` 呼叫順序為「結構 → 家具 → 貼圖物件」，並更新 `boxIdx` 邊界註解。

### 診斷過程記錄（K 神思考 + systematic-debugging 交叉應用）
- 初判假設：前次 OPUS 曾宣稱「wall 2a vs 9/10 NW corner overlap」為根因並以此方向修法失敗。本次以 systematic-debugging Phase 1 重新 Repro 並繞過前次失敗假設
- 以第一性原理（Light Arithmetic）重算 wall 2b 與 wall 3a 之 hemisphere 命中，發現 3a 應更暗（雙倍深色喇叭命中），反駁「純物理色滲」假設
- 使用者 GUI slider 實驗是決定性證據：把 wallAlbedo 拉至 0.1 時僅局部表面變暗，立即暴露索引範圍問題

---

## R2-13｜牆↔牆共邊 raw noise 永存（像油漆接縫塗不好）

### 症狀
fix19 解決色差後，使用者回報：牆↔牆共邊（如 wall 2b ↔ wall 3a 於木門頂）、物件↔貼圖物件邊緣，存在大量未降噪之原始雜點，視覺如「油漆或 silicon 沒塗好的接縫」。收斂 1000 samples 後仍在。牆↔天花板等處亦同。

### 根本原因
`PathTracingCommon.js` 之 edge detection（lines 3287~3340）：
```glsl
float objectDifference = min(fwidth(objectID), 1.0);
if (colorDifference > 0.0 || normalDifference >= 0.9 || objectDifference >= 1.0)
    pixelSharpness = 1.0;
```
且 edge markers 具 stickiness：`if (previousPixel.a == 1.0) currentPixel.a = 1.0;`，一旦某像素被標為 edge，之後世代仍維持 sharp 狀態，`ScreenOutput_Fragment.glsl` 的 7×7 降噪核心永遠跳過該像素，保留原始 raw noise。

原 `hitObjectID = float(objectCount + boxIdx)` 為每個 box 給予獨立 ID，**牆↔牆共邊**處相鄰像素分屬不同 box → `fwidth(objectID) >= 1` → 觸發 `pixelSharpness=1` → 該邊永遠不降噪。牆↔天花板等處雖亦觸發，但那是法線變化處（`normalDifference >= 0.9`），本就應保銳利，物理上正確。

### 修法
`Home_Studio_Fragment.glsl` 行 385，結構組（索引 0..31）統一 objectID：
```glsl
// fix20：結構性 box 統一 objectID=1，使邊界間 fwidth(objectID)=0
hitObjectID = float(objectCount + (boxIdx <= 31 ? 1 : boxIdx + 1));
// 傢俱/貼圖物件保留各自 ID（+1 讓最小為 33 避開結構組）
```

結果：
- 牆↔牆、天花板內部分段、地板內部分段：`fwidth(objectID) = 0`，不觸發 edge marker，降噪正常套用 → 接縫消失
- 牆↔天花板、牆↔家具：`fwidth(normal)` 或 `fwidth(color)` 仍觸發，edge 依然銳利

### 權衡與框架考量
原考慮修 `PathTracingCommon.js`（共享檔案），但會影響全部 65 個範例專案。最終選擇 Home_Studio-specific 之 objectID assignment，以最小擾動解決單專案問題。

### 通則
框架 edge 檢測以 `fwidth(objectID)` 作為觸發之一，凡相鄰像素分屬不同 objectID 即被標 edge。在**相同材質之結構共邊**（如同色牆板之段間邊界）應統一 objectID，避免接縫 raw noise 永存；**不同材質 / 法線變化處**（牆↔天花板、牆↔家具）則本就應保 edge sharp，無須特別處理。

---

## R2-13｜X-ray 視角下結構體外延至牆外（使用者觀察：西樑、東樑、天花板 edge、東牆、西牆太長）

### 症狀
X-ray 透視（Cam 1 由南向北看）視角下，使用者回報「北邊的天花板、地板、西樑、東樑應該要短一點」、「東西牆也要短一點」，因為鐵門北側貼北牆、東北衣櫃貼北牆。南側亦觀察到同類問題，且冷氣主體卡進南牆 12.5cm。

### 根本原因
R2-3 原設計沿用 MIN_Z=-2.074、MAX_Z=3.256（外牆邊界）作為結構 box 之 Z 邊界。室內 mode 下這些延伸段被北/南牆板本身遮住不可見。但 R2-13 開啟 X-ray 後，北/南牆板被剔除，樑/柱/天花板/東西牆之 Z 延伸段（朝向外牆之 20cm）直接暴露，視覺上為「牆已透明但有根 20cm 樑骨凸出」。冷氣則單純是建模時 `bmax.z=3.181` 直接穿過南牆內面 3.056。

### 修法（fix21/22/23）
| fix | 修改 box | bmin.z | bmax.z |
|-----|----------|--------|--------|
| 21  | beam 12 西樑 | MIN_Z → -1.874 | — |
| 21  | beam 13 東樑 | MIN_Z → -1.874 | — |
| 22  | wall 5 東牆 | MIN_Z → -1.874 | — |
| 22  | wall 9 西牆鐵門上方 | MIN_Z → -1.874 | — |
| 22  | wall 10 西牆門坎 | MIN_Z → -1.874 | — |
| 23  | 天花板 1e/1f/1g/1i | — | MAX_Z → 3.056 |
| 23  | wall 5 東牆 | — | MAX_Z → 3.056 |
| 23  | wall 11 西牆南段 | — | MAX_Z → 3.056 |
| 23  | beam 12/13 東西樑 | — | MAX_Z → 3.056 |
| 23  | 柱 14/15 東南西南 | — | MAX_Z → 3.056 |
| 23  | 冷氣 box 35 | — | 3.181 → 3.056 |

### 通則
凡於 X-ray 模式下會被剔除之 box（cullable=1/2），其對向之「內向軸」座標必須切齊內牆面（Z=-1.874 / Z=3.056 / X=±1.91 / Y=0 / Y=2.905），不得沿用外牆邊界。若結構體須穿牆（如樑嵌入牆內），應視情況改以兩段 box 或重新規劃 cullable 值。

---

## R2-12 GIK 吸音板側面 LOGO 穿幫

### 症狀
使用者實測回報：東西牆垂直 GIK 吸音板（120×60×11.8cm）從側面角度觀察時，11.8cm 的薄邊上可見到正面貼圖右上角的 LOGO。Config 2（9 片）多角度觀察更明顯。

### 根因
`shaders/Home_Studio_Fragment.glsl` 的 ACOUSTIC_PANEL 分支對所有六個面皆採「local pos ÷ half size → [0,1]」UV 映射，代表每個面（含 11.8cm 窄邊）都會把整張 1:1 貼圖拉伸覆蓋。正面 LOGO 位於右上角，被拉伸後出現在窄邊頂端區域。

### 修法
UV 分母改為薄軸感知：

     先計算 `minHS = min(hs.x, min(hs.y, hs.z))`，判定 `thinIsX/Y/Z`
     `maxFront = 非薄軸中較大者的 half size`（本案恆為 0.60，即 120cm 的一半）
     對每個面分支，若該面之 UV 軸恰為薄軸方向，分母改用 `2.0 * maxFront`（即 1.20m），否則維持 `2.0 * hs_axis`
     結果：側面沿薄軸 UV ∈ [0.5 ± hs_thin/maxFront] = [0.451, 0.549]，僅取紋理中央 9.8% 細條
     正面仍覆蓋全紋理 [0, 1]，視覺一致

紋理密度在所有面一致（texels per meter 相同），側面取得之中央條狀區域天然避開右上角 LOGO。

### 通則
AABB 多面共用單張貼圖時，若各面尺寸比例差距大（如板材類：薄軸 / 正面比 ≈ 1 / 10），僅以「lp / hs」分軸會造成薄邊嚴重拉伸。正確做法是以 **正面的 texels per meter 為基準密度**，側面之 UV 範圍依物理長度比例縮窄並居中，令紋理內容連續無變形。此模式適用於任何「正面是主要貼圖、側面應為延伸材質」的板材 / 盒子物件。

---

## R2-14｜東西投射燈軌道底面黑線（material type 重用污染）

### 症狀
使用者於 Cam 3、876 spp 高采樣觀察，東西兩條 2m 投射燈軌道**底面**各浮現黑色細線/矩形，南北各有兩條，位置介於燈具（z=±0.252 / ±1.248）與軌道接縫（z=0.498）之間，約距軌道 1m 半段中點 ±2.5cm 處。**側面完全乾淨，僅底面有此現象。**

外觀如「反射率為 0 的插座孔」。

### 根因
**軌道 8 顆 box（37-44）與牆面插座 6 顆 box（29-34）共用 `type = 11 (OUTLET)`。**

`shaders/Home_Studio_Fragment.glsl:891-941` 的 OUTLET 分支內含「插座孔繪製」邏輯：

     bool isFront = (aN.y > 0.5 && hs.y < 0.01) || ...  // line 902
     if (isFront) {
         float u_r = abs(lp.z) - 0.025;
         isHole = abs(u_r) < 0.008 && abs(lp.y + 0.008) < 0.002;  // line 920
         if (isHole) hitColor = vec3(0.0);
     }

軌道底座 halfSize=(0.0175, 0.01, 0.5)，`hs.y = 0.01` 於 float32 精度下實為 0.00999994（因 `2.905 - 2.885` 在 FP 下為 0.01999988），**剛好 < 0.01**，`isFront` 於 Y 法線面（即頂底面）為 TRUE。頂面貼天花板不可見，僅底面暴露。

`isHole` pattern 於 `|lp.z| ≈ 0.025` 處繪出兩條黑帶，對應軌道半段中點 ±2.5cm——正是使用者所見位置。

### 三任連續翻車歷程（fix02 → fix03 → fix04）
- **fix02（幾何假說）**：懷疑軌道頂面與天花板共面觸發 Z-fighting，試圖調整 addBox 順序。未檢查 material 分支。失敗。
- **fix03（Z-fighting 假說）**：將 box.max.y 從 2.905 下降 1mm 至 2.904。未檢查 material 分支。失敗並寫入 feedback memory（嚴禁再試）。
- **fix04（shadow 自遮蔽假說）**：懷疑 primary 命中天花板後 diffuse bounce 起點陷入軌道 box 內導致 shadow ray 被軌道自身頂面阻擋。修改 `BoxIntersect` 拒絕 OUTLET inside-box 出射命中。**Cam 1 17 spp 乍看乾淨就宣告成功，寫入成功 memory。Cam 3 876 spp 才暴露失敗。** 回滾。

三任均未翻閱 `shader:891-941` OUTLET 分支原始碼。

### 修法（R2-14 最終；commit b0f563c，cache-buster `r2-14-track-type`）
1. `shaders/Home_Studio_Fragment.glsl:61` 新增 `#define TRACK 13`
2. `shaders/Home_Studio_Fragment.glsl:892-910` OUTLET 分支前插入 TRACK 分支（純 DIFF 邏輯，無 isFront/isHole）
3. `js/Home_Studio.js:114-123` 軌道 8 顆 box 的 type 參數由 `11` 改 `13`
4. shader:631 「有貼圖表面跳過降噪」列表**不**加 TRACK（軌道應吃降噪）
5. `Home_Studio.html:40` cache-buster 更新

### 驗證結果（使用者確認通過）
- 軌道底面黑線完全消失（Cam 3 多視角、多 spp 驗證通過）
- 軌道表面平滑（吃降噪生效）
- 牆面 6 顆插座雙孔正常（OUTLET 分支未受影響）
- 無 shader compile error

### 遺緒（留待 R3 處理）
軌道兩側視覺亮度對稱——因 R2 僅單光源 NEE（`ceilingLampQuad`），軌道於 y=2.885 位於光源 y=2.835 之上方且光源朝下單向發射，軌道完全收不到直射光，僅 ambient bounce。R2-14 軌道投射燈頭 emission=0 非真光源。若需「軌道面向光源亮、背光側暗」之物理對比，需進 R3 光照升級（參舊專案 `Path Tracking 260412a 5.4 Clarity.html` 之 CLOUD 4-quad 扇形 + track spot 的 10-light MIS 架構）。本議題非 bug 屬設計。

### 通則（已提升至本檔頂部「通用 Debug 紀律」章節）
本案衍生三條鐵律：
1. 複用 material type 前必讀該 type 完整 shader 分支
2. material type 命名須為物件語義（OUTLET / TRACK），禁用材質特徵（WHITE_DIFF）
3. debug artifact 時第一步讀所在物件的 hitType 分支，禁止跳過此步進入幾何/光路假說

違反任一條都是未來再度翻車的導火線。

---

## R2-15 南北廣角燈軌道（2026-04-18 完工）

### 結論
此階段於一次 iteration 後 DONE，實作踩到兩坑，皆於使用者回報後立即排除。

### 坑一：SOP 漏寫廣角燈頭幾何
**現象**：依 `R2：所有幾何物件.md:865-879` 只列 4 個 Box（兩軌兩支架），實裝後使用者回報「廣角燈具本人沒出現」。
**根因**：SOP 遺漏廣角燈頭圓柱規格；R2-14 燈頭是在 shader 用 `CylinderSegmentIntersect` 繪出（非 Box），該慣例未被 R2-15 SOP 繼承。
**修法**：撈舊專案 `Home Studio 3D Pace Tracing/Path Tracking 260412a 5.4 Clarity.html:1031-1043` 廣角燈筒規格（半徑 0.05m、長度 0.072m、2 盞，pivot 於支架底 y=2.845），比照 R2-14 之 `uTrackLampPos` 架構，新增 `uTrackWideLampPos[2]` + `uTrackWideLampDir[2]` uniform 與 shader 圓柱碰撞區塊。
**教訓**：**R2 之「軌道」與「燈頭」分家繪製（Box + shader Cylinder）為已建架構，SOP 新增階段若僅列 Box 即視為漏寫**，須主動比對 R2-14 模式補齊燈頭。

### 坑二：`isFixtureDisabled` cascading `<` 比較漏下界
**現象**：關「廣角燈軌道 (南北)」toggle 時，東西軌道一併消失。
**根因**：初版 shader gating 為
```glsl
if (fixtureGroup < 1.5 && uTrackLightEnabled < 0.5) return true; // R2-14
if (fixtureGroup < 2.5 && uWideTrackLightEnabled < 0.5) return true; // R2-15
```
第二條僅查上界 `< 2.5`，同時命中 fixtureGroup=1 之 R2-14 軌道，故南北 toggle 連帶關東西。
**修法**：改為早返排他式——
```glsl
if (fixtureGroup < 0.5) return false; // 恆顯
if (fixtureGroup < 1.5) return uTrackLightEnabled < 0.5; // group 1
if (fixtureGroup < 2.5) return uWideTrackLightEnabled < 0.5; // group 2
return false;
```
前一條 return 後自然排除，無需下界檢查。
**教訓**：**多群 gating 用 `if (x < upperBound) return ...` 而非 `if (x < upperBound && cond) return true`**——前者隱含「低於此上界且未被前條 return 排除」之排他區間，後者在條件不成立時漏下去撞下一條上界。此坑日後若擴至 fixtureGroup=3/4/5（R2-16/17）仍有效。

### 驗證結果（使用者確認通過）
- 燈具可見（矮胖圓柱，與 R2-14 投射燈長瘦圓柱形狀對比明顯）
- 兩 toggle 獨立作用（關南北不影響東西、關東西不影響南北）

### 遺緒（留待 R3 處理）
與 R2-14 共遺緒：廣角燈頭 emission=0 非真光源，為視覺幾何。R3 燈光系統需以多光源 MIS 補足（2 盞廣角燈 + 4 盞投射燈 + CLOUD 4-quad 天花反射 = 舊專案 10-light 架構）。

---

## R2-17｜Cloud 漫射燈條「採樣體積 vs 可見幾何」誤植

### 症狀
R2-17 首次實作 4 支 Cloud 燈條後，使用者截圖回報「燈條太粗」。視覺上燈條寬達 15cm、厚 5cm，比舊專案所見明顯粗大，像是大型光槽而非長條燈條。

### 根本原因
**SOP R2-17 座標表把舊專案的「採樣體積尺寸」誤抄為「可見幾何尺寸」，兩者相差約 10 倍。**

舊專案 `Path Tracking 260412a 5.4 Clarity.html`：
- 可見幾何（line 514-515，type 9）：`c=[±0.892, 2.795, 0.498], s=[0.016, 0.016, 2.4]` → **1.6×1.6×240cm**
- 採樣體積（line 1245-1251，shader `sampleLightPos`）：寬 0.15 × 高 0.05 × 長 2.4 m（為軟陰影散射用，非實體 box）

SOP R2-17 設計澄清寫「沿用舊專案採樣體積尺寸（寬 0.15m × 高 0.05m）」——此為作者筆誤，應為「沿用舊專案可見幾何尺寸」。SOP 表格 s=[0.15, 0.05, 2.4] 直接當 addBox 全尺寸使用，得出 15×5×240cm 之大箱。

### 診斷過程關鍵步驟
1. 使用者暗示「HALF vs FULL 搞混」。先驗證 s 欄之半/全語義：SOP line 1045「長邊方向半尺寸 1.2m」 vs 表格 s[2]=2.4，故 s 欄確為全尺寸（若為半，長邊 4.8m 超出 Cloud 範圍 2.4m）。
2. 故障非單純 HALF/FULL，差距 10× 而非 2×。
3. Grep 舊專案 `Path Tracking 260412a 5.4 Clarity.html` 找 Cloud 燈條真實可見 box，發現 line 514-515 之 s=[0.016, 0.016, 2.4]。
4. 與舊專案 shader `sampleLightPos` 之 0.15/0.05/2.4 對照，證實 SOP 抄錯欄位。

### 修法
四支燈條 addBox min/max 依舊專案真實可見幾何 1.6×1.6×240（東西）/ 1768×1.6×1.6cm（南北）重算：
- y 中心 2.795（底 2.787 貼 Cloud 頂、頂 2.803，box 厚 1.6cm）
- 東/西燈條 x ± 0.008（中心 ±0.892）
- 南/北燈條 z ± 0.008（中心 1.690 / -0.694）

SOP 原 y 中心 2.828 與「厚 0.05m」推導皆隨 s 欄誤植而同錯，一併修正為 2.795。

### 教訓（跨 R 階段通用）
**舊專案的 `s` 欄並非單一語義。同一份舊 .html 內可能同時存在：**
- **可見幾何 box**（addBox 或 boxes 陣列）：s 為全尺寸，直接 × ½ 得 half-size
- **採樣體積**（shader `sampleLightPos` 之隨機散射範圍）：亦以 s 命名，但非實體，僅供光源 importance sampling 散射面積

**複用舊專案座標時，必先 grep 舊專案該物件對應之 boxes/addBox 條目**；若找到實體條目即採其 s，**禁止以 shader 內 `sampleLightPos` 之散射範圍當 box 尺寸**。此原則補強 Debug_Log 規則一（複用前必讀分支）：不僅 material type 分支要讀，幾何數值來源也要讀到對的地方。

此坑與 R2-7 subwoofer「舊專案 s 為全尺寸，需除以 2」同科但不同源；日後若見 SOP 表格與舊專案 shader 採樣體積數值完全吻合、但與舊專案實體 box 尺寸天差地別，優先懷疑本類誤植。

### 驗證結果（使用者確認通過）
- Cam 視角可見 4 支 1.6cm 細柱沿 Cloud 周邊分布
- 無 Z-fighting（貼死 Cloud 頂 y=2.787 未現閃爍）
- toggle 獨立開關、X-ray 隨 Cloud 一同剝離

---

## R2-18｜ISO-PUCK 狀態洩漏（CylinderIntersect 漏寫材質值）

### 症狀
使用者於 R2-18 Step 4 金屬路徑接通後反映：「當視角稍微高於上平台時，ISO-PUCK 位置出現奇怪透視現象，彷彿上平台更靠近攝影機」。PUCK 黑色橡膠體應為純漫反射，卻呈現鏡面反射上平台之錯位影像。

### 根本原因
Step 1 DataTexture 5-pixel 擴容雖在 Box 路徑（BVH traversal）正確寫入 `hitRoughness` / `hitMetalness`，但 `CylinderIntersect` 所在之 4 處非 BVH 命中點（ISO-PUCK、吸頂燈 LAMP_SHELL、R2-14 投射燈頭、R2-15 廣角燈頭）皆漏寫這兩個全域變數。命中順序若前一物件為腳架 C_STAND（metalness=1.0），狀態殘留至 PUCK 命中時 shader DIFF 分支讀到 hitMetalness=1.0，誤觸 Step 4 新增的 `rand() < hitMetalness` 金屬路徑，產生鏡面反射假象。

### 診斷關鍵步驟
1. 使用者描述「奇怪透視」非幾何位移、而是材質觀感異常。先排除 CylinderIntersect t 值問題。
2. 比對 Step 1 骨架提交與 Step 4 行為差異，猜測是 metal gate 觸發。
3. Grep `hitRoughness =` / `hitMetalness =` 定位所有寫入點，發現 4 處 CylinderIntersect 命中後完全沒寫。
4. 確認前一物件為 C_STAND（metalness=1.0）時，DIFF 分支必中 `rand()<1.0` 走金屬路徑。

### 修法（fix05-puckleak）
1. `SceneIntersect` 入口補防禦性預設：
   ```glsl
   hitRoughness = 1.0;
   hitMetalness = 0.0;
   ```
2. 4 處 CylinderIntersect 命中點顯式寫入：PUCK 寫 (1.0, 0.0)、吸頂燈 (1.0, 0.0)、投射燈頭 / 廣角燈頭各依物件語義寫入。

### 教訓（跨 R 階段通用）
**任何非 BVH 命中點（CylinderIntersect、StadiumPillarIntersect、自訂 intersect）凡會設置 `hitType` 者，必須同步寫入 `hitRoughness` / `hitMetalness`**。遺漏即洩漏前一物件狀態，產生跨物件材質污染。此坑與 R2-14「material type 命名語義化」屬同層防禦——材質全域變數寫入完整性 = 語義命名完整性，兩者同樣防污染。

`SceneIntersect` 入口補預設僅為第二層防線，**不得依賴入口預設省略分支內寫入**；每個命中點獨立寫入才是正解。

### 驗證結果（使用者確認通過）
PUCK 於 Cam 1~3 視角均正常呈現黑色漫射，無鏡面反射錯覺。

---

## R2-18｜metalness 硬閾值 → Monte Carlo 機率分支

### 症狀
使用者於 fix08 GUI 滑桿驗收時反映：「為什麼所有的 metalness 感覺是以 0.50 為一個硬分界？0.50～1 沒啥變化就是有反射，0.50 以下是完全沒反射，回歸貼圖的樣子」。物理 PBR 應呈連續金屬度漸變，卻呈二元開關觀感。

### 根本原因
shader 中 4 處金屬 gate（DIFF / SPEAKER / SUBWOOFER / IRON_DOOR）皆以 `if (hitMetalness > 0.5)` 硬閾值判定：
- metalness ≤ 0.5 → 永不進金屬路徑 → 100% 走漫射
- metalness > 0.5 → 永遠進金屬路徑 → 100% 走 `mix(reflDir, diffDir, roughness²)`

兩段間無過渡，中間值 0.3 或 0.7 與 0.0 / 1.0 視覺完全等同。

### 修法（fix10-metalrand）
改為 Monte Carlo 機率分支：
```glsl
if (rand() < hitMetalness) {
    // 金屬路徑
}
```
- metalness=0.3 → 30% 光線走金屬、70% 走漫射
- 多 spp 平均後呈平滑 blend，符合 PBR 連續金屬度

`rand()` 來自 `PathTracingCommon.js` 行 3076（Jacco Bikker 風格，藍噪 + uFrameCounter×golden ratio 驅動）。套用於 DIFF、SPEAKER、SUBWOOFER、IRON_DOOR 四處金屬 gate。

### 教訓（跨 R 階段通用）
**Path Tracing shader 的材質混合必用 Monte Carlo 機率分支，禁用硬閾值**。硬閾值在離線渲染（accumulation）下呈二元觀感，與 PBR 線性金屬度期望相悖。此原則可推廣至任何兩路徑混合決策（clearcoat、subsurface、emission mix 等）。

`rand() < weight` 模式於本框架已可用（blue noise 提供低變異隨機數）；新增任何材質分支切換時優先採此模式，不得再寫 `if (weight > 0.5)`。

### 驗證結果（使用者確認通過）
金屬三類（IRON_DOOR、C_STAND、C_STAND_PILLAR）於 Cam 1~3 觀察 metalness 0.0→0.3→0.65→1.0 呈連續反射強度遞增，無硬邊。對應 feedback memory：`feedback_pathtracing_metal_rand_branch.md`。

---

## R3-1 fix01｜computeLightEmissions 呼叫早於 uniform 宣告（初始化 TypeError）

### 症狀
R3-1 管線施工完成（四支光度學函式 + 三組 emission uniform 陣列 + `uR3EmissionGate` gate + GUI slider disable + HTML cache-buster），以 `?v=r3-1-lumens-uniform-pipeline` 載入後：
- Canvas 全黑
- `Scene Setup` / `Light Settings` / `Bloom` / `Snapshot` 四個 GUI folder 全消失
- `samples_per_frame` 裸 slider 亦缺
- 唯一倖存的是 `pixel_Resolution`（由 `InitCommon.js` 較早掛載）
- FPS 指示區塊無數字

### 根本原因
計畫書 `.omc/plans/r3-1-lumens-radiance.md` §6 Step 3 指示在 `applyPanelConfig(config)` 尾端與 `initSceneData()` 尾端各呼叫一次 `computeLightEmissions()`（為 R3-3 dirty-flag 預留鉤點）。但：

1. `initSceneData()` 於 `js/Home_Studio.js` L607 起、L655 呼叫 `applyPanelConfig(1)` 設初始 Config。
2. `applyPanelConfig(config)` 末端 L333 即呼叫 `computeLightEmissions()`。
3. `computeLightEmissions()` 於 L904 存取 `pathTracingUniforms.uCloudEmission.value[i].set(...)`。
4. 但 `uCloudEmission` 宣告位於 L856（在 `initSceneData` L655 呼叫點之後 200 多行）—— 此時尚未被建立。
5. 故 `pathTracingUniforms.uCloudEmission` 為 `undefined`，`.value[i].set()` 拋 `TypeError: Cannot read properties of undefined (reading 'value')`。
6. `initSceneData` 於 L655 中斷，後續 uniform 宣告（L840~892）、`setupGUI()`（L897）全未執行 → GUI 消失、animate loop 未啟動、canvas 全黑。

既有既存 code 其他 uniform 操作（如 `uCloudPanelEnabled` / `uTrackLightEnabled`）都用 `if (pathTracingUniforms && pathTracingUniforms.uCloudPanelEnabled)` 防禦式判斷（L304/307/310/313），`computeLightEmissions()` 是**唯一**裸呼叫，故崩。

### 修法（方案 B：架構修正，非 guard 補丁）
移除 `applyPanelConfig` L333 的 `computeLightEmissions()` 呼叫，只保留 `initSceneData` L894 uniform 宣告後的單次呼叫。該處以註解保留 R3-3 鉤點位置備忘：

```javascript
cameraSwitchFrames = 3;
// R3-1 fix01：computeLightEmissions() 原本掛於此（供 R3-3 dirty-flag 鉤點），
// 但 applyPanelConfig(1) 在 initSceneData 中段（L655）即被呼叫，
// 此時 uCloudEmission 等 uniform 尚未宣告（L856~859），
// 呼叫會拋 TypeError 中斷初始化 → GUI 消失、canvas 全黑。
// 故 R3-1 只保留 initSceneData L894 uniform 宣告後的單次呼叫，
// R3-3 接手時再於此處重建 Config 切換 dirty-flag 鉤點。
```

cache-buster 從 `r3-1-lumens-uniform-pipeline` bump 為 `r3-1-fix01-guard-ordering`。

### 診斷過程關鍵步驟
1. **對稱性分析**：GUI 只剩 `pixel_Resolution` 倖存 → InitCommon.js 完成、Home_Studio.js 中斷。排除 shader 編譯 fail（那樣 GUI 完整、僅 canvas 黑）。
2. **Read 施工位置**：`js/Home_Studio.js` L355~420（新函式 scope 確認頂層宣告，排除 SyntaxError 假說）、L840~910（uniform 宣告 + computeLightEmissions 定義）、L275~335（applyPanelConfig body）。
3. **Grep 呼叫點**：整檔 `computeLightEmissions` 共 2 個呼叫（L333 applyPanelConfig、L894 initSceneData）+ 1 個定義（L901）。
4. **時序推導**：`initSceneData` L655 呼叫 `applyPanelConfig(1)` → L333 `computeLightEmissions()` → L856 宣告尚未到達 → TypeError。
5. **症狀對帳**：canvas 全黑 / GUI 大部分消失 / FPS 無值，全部符合「initSceneData 於 L655 中斷」之單一假說。
6. 未跑 DevTools Console cross-check，因檔內證據鏈已 100% 閉合，使用者肉眼驗收 fix01 像素級回復 R3-0 基線即完成裁決。

### 教訓（跨 R 階段通用）
**uniform 宣告與使用的時序不可倒置；規劃 dirty-flag 鉤點時須 trace 呼叫鏈是否跨越宣告點**。本案計畫書 §6 Step 3 犯的結構性錯是「把鉤點掛在中途會被呼叫的函式尾端」，而該函式在 `initSceneData` 中段即被觸發，天然早於 uniform 宣告。規劃階段若 trace `applyPanelConfig` 的既有呼叫點（L655 于 initSceneData 內），即可在 ralplan Critic 階段被攔截。

**類比 R2-3 bug #3**（type=10 在 CalculateRadiance 無分支，射線直接回傳黑）：兩者本質皆「使用點存在、但被使用的實體尚未就位」。R2-3 是 shader side、R3-1 是 JS side，同一類時序缺陷。

### 驗證結果（使用者確認通過）
cache-buster `r3-1-fix01-guard-ordering` 載入後使用者回報「有畫面了，跟 R2 做完一樣」。emission=0 + gate=0 雙重保險達成「像素級一致 R3-0 基線」之 R3-1 驗收門檻。

---

## R3-4 fix07｜軌道燈 lumens slider 與輸出解耦（photometric↔radiometric 量綱失配）

### 症狀
R3-4 fix05 狀態，Option A'（emissive + 5 選 1 stochastic NEE）落地、per-face gate 修好燈具外觀。肉眼回報：
- 新加入的「東西軌道燈 lm」slider 拉到 5 lm 畫面仍過曝（正常應幾近不可見）
- slider 0 → 2000 全區段光斑亮度無視覺差，亮度與 lumens 完全解耦
- 調整「間接光倍率」與「最大彈跳數」皆無改善 → 排除間接光路成因

### 根本原因（量綱失配 + band-aid clamp 雙重遮蔽）

**上游**：`computeTrackRadiance(lm, T_K, A, beamDeg)` 舊公式為 `lm / (Ω · A)`（Ω = 2π(1-cos(beam/2))），產物為 **photometric cd/m²**（luminance）。shader tonemap 視輸入為 **radiometric W/(sr·m²)**（radiance）。量綱錯誤，無對應 `/K(T)` 與 `/π` 的 Lambertian 換算。

- 2000 lm / 60° 全角：Ω ≈ 0.842 sr → cd = 2375；L_phot = 2375 / 2.827e-3 ≈ 8.4e5
- 對照 Cloud 正確 radiometric：`Φ/(K·π·A)` ≈ 700（K=320@4000K，π Lambertian）
- 差距約 1195×，且色溫 K(T) 完全不作用於 radiance（3000K vs 6500K 經 Ω 運算輸出恆等），故「色溫切換光斑顏色不變」

**下游 band-aid 遮蔽訊號**：
- `sampleStochasticLight5` 末段 fix05 `throughput` max-channel cap 50：lumens > ~0.1 lm 即永遠 fire，吞掉 lumens 變化
- TRACK_LIGHT primary 分支 fix03 `bounces==0 → clampMax=10` 雙段 clamp：商品亮度永遠 fire，primary 直視近乎恆等

### 診斷過程（systematic-debugging Phase 1）

對齊 feedback memory `systematic_debugging_check_all_accumcol`，第一步 grep 全部 `accumCol` 寫入點（7 處）確認 accumulation path，而非先跳 hitType branch 假說。發現：
- TRACK_LIGHT primary 分支與 sampleStochasticLight5 NEE 各有獨立 clamp
- 二者 clamp 門檻皆低於量綱錯誤造成的 overshoot，但因 emit 色比被 max-channel normalize 保留，畫面看似「色溫還在」但其實亮度被鎖定

對照 Cloud `computeCloudRadiance = (Φ/3) / (K·π·A)`（W/(sr·m²)，radiometric）與 Track 舊 `Φ/(Ω·A)`（cd/m²，photometric）直接揭示量綱錯誤。`candelaToRadiance` 的 docstring 已自警「須再乘 (1/π) 補 Lambertian」，但 `computeTrackRadiance` 未落實 → 規劃階段埋下缺失。

### 修法（單次根因修復，非 clamp 調參）

**JS 端**（`js/Home_Studio.js` `computeTrackRadiance`）：
```javascript
// 舊：lm / (Ω · A) — photometric cd/m²
// 新：lm / (K(T) · π · A) — radiometric W/(sr·m²)，與 computeCloudRadiance 同量綱
function computeTrackRadiance(lm, T_K, A_m2, beamFullDeg) {
    if (!Number.isFinite(lm) || lm <= 0) return 0;
    const K = kelvinToLuminousEfficacy(T_K);
    const A = Math.max(A_m2, 1e-8);
    return lm / (K * Math.PI * A);
}
```

**Shader 端**（`shaders/Home_Studio_Fragment.glsl`）：
- 新增 `const float TRACK_LAMP_EMITTER_AREA = PI * 0.03 * 0.03;`（雙源同步契約與 JS 值一致）
- `sampleStochasticLight5` track 分支 throughput 改 `emit * geom * TRACK_LAMP_EMITTER_AREA / selectPdf`（disk-area integrand，radiance × 面積還原 flux contribution）
- 移除 fix05 throughput max-channel cap 50（上游量綱修正後不再 firefly）
- TRACK_LIGHT primary 分支：移除 fix03 `(bounces==0) ? 10.0 : 1.0` 雙段 clamp，改用既有 `uEmissiveClamp`（預設 50）max-channel normalize

cache-buster 由 `r3-4-fix06b-defaults` bump 為 `r3-4-fix07-radiometric-unit`。

### 驗證

**contract-test**（`docs/tests/r3-4-track-radiance.test.js`）新增兩條斷言：
- [G] `computeTrackRadiance(2000, 4000, A, 60) ≈ 703.43 W/(sr·m²)` rel tol 1%（手算 2000/(320·π·2.827e-3)）+ 與 Cloud 同序 O(10²~10³)
- [H] `r(2700K)/r(6500K) = 340/280`（K(T) 確實經 radiance 作用於色溫）

修復前 [G] rel=1193.58（FAIL，直接證實 ~1200× overshoot），[H] ratio=1（FAIL，色溫完全不作用）。修復後 11 PASS / 0 FAIL；r3-3 Cloud regression 8 PASS、r3-2 Kelvin regression 25 PASS 皆未破。

**肉眼驗收**（2026-04-19 使用者回報）：
- trackLumens slider 任意數值視覺預期一致，過曝消失
- 直接光光斑柔邊自然
- 色溫切換（北暖南冷／全暖／全冷）光斑色差清晰可辨

### 教訓（跨 R 階段通用）

1. **光度↔輻射量綱失配是 path tracer 最難抓的一類 bug**：結果「看起來合理」（色比對、幾何對、變化方向對），只是尺度錯 1000×。須在 photometry 函式的 docstring 明確標註回傳量綱，並在施工時對齊既有正確管線（本案應從 R3-1 階段就對齊 Cloud 的 `Φ/(K·π·A)`）。
2. **clamp 是診斷訊號，不是 fix**：fix05/fix03 兩道 clamp 都在「上游量綱錯」的條件下被迫加入。事後看兩道 clamp 吞掉了 overshoot 訊號 + lumens 調整訊號，反而延後找到根因。規則：當 clamp 必須打到「基準商品亮度」時，應立即質疑上游而非調 clamp 係數。
3. **對比既有正確實作 > 從零推導**：Cloud 漫射燈條 R3-3 已落地正確 `Φ/(K·π·A)`，軌道燈 R3-4 只需對齊即可；當初若直接 diff 兩者公式，量綱錯誤會在 5 分鐘內自曝。
4. **Lambertian `/π` 因子是 radiometric vs photometric 的標記**：`cd/m²` 除 `K(T)` 得 `W/(sr·m²)`；若忽略 `/π` 則雖量綱對但比例仍偏 3.14×。本案 `computeTrackRadiance` 同時漏兩者。

---

## R3-5b｜Cloud 漫射燈條 NEE 補漏四連翻車（fix04~fix07，2026-04-20）

### 症狀演進

R3-5b 把 Cloud 4 rod 納入 stochastic NEE pool（sampleStochasticLight7 → sampleStochasticLight11），初版 MVP 編譯通過但連續四次翻車：

| 版本 | 症狀 |
|------|------|
| fix04 前 MVP | Cloud NEE shadow ray 命中自身 rod 卻無 emission 入帳；天花板全黑 |
| fix04 | 天花板出現四個方正光斑（像四顆投射燈），非預期漫射光池 |
| fix05（2-face 甲案：+Y ∪ 外長側） | 天花板光斑邊緣銳利，呈「東西南北四軸投射」形貌；user：「看起來像被限制往東西南北打的投射燈」 |
| fix06（改 per-rod 45° 對角 Lambertian） | 天花板光池形狀對但仍呈 4 離散光斑，而非 2.4m 連續燈條 |
| fix07 前（fix06 OK） | CLOUD 燈終於照出 口 字形光帶；但側牆軌道燈關閉時殘留冷暖光斑 |
| fix07 後 | 全部條件達成，user：「這版的燈光終於正確了」 |

### 根本原因（四個獨立 bug 被計畫 ralplan 共識錯判為單一問題）

**fix04：NEE catch-all 搶先攔截 Cloud shadow ray**

shader `directLightSample` L1001 catch-all 分支針對 `hitType == LIGHT / DIFF` 做 emission 計算。Cloud rod 本體 hitType=CLOUD_LIGHT（14），catch-all 不識別 → Cloud NEE shadow ray 命中自身 rod 時被歸類為「miss emission target」→ throughput 歸零。

修法：catch-all 前插入 CLOUD_LIGHT 專用 NEE-hit pre-branch，優先於 catch-all 處理 hitType==14。

**fix05：2-face 甲案 face-pick 產生 cos(θ) 硬邊**

ralplan DELIBERATE 共識採 2-face 甲案（+Y 頂 ∪ 外長側），per-rod face-pick 隨機 `rng()<0.5 ? 頂 : 側`。兩張 face-normal 皆為軸對齊（+Y 或 +X/-X/+Z/-Z），shading point 角度分佈離散 → 合成亮度在 NDotL 交界形成四軸硬邊，視覺即「東西南北投射燈」。

修法：廢 2-face pick，改 per-rod 單一 45° 對角 Lambertian normal（E/W rod=(±1,1,0)/√2；S/N rod=(0,1,±1)/√2），一面柔順連續發光取代二面硬邊切換。此改動偏離 ralplan 甲案 ADR，但符合肉眼唯一驗收基準「口字柔光帶」。

**fix06：cloudTarget 單點取樣 → 4 離散光斑而非線段**

fix05 版 shadow ray target = rod 中心 + normal × halfExtent 單點，4 rod → 天花板 4 個離散亮點，無燈條連續感。

修法：`cloudTarget = center + normal·halfExtent + longAxisJitter * halfLength`，其中 `longAxisJitter = rng()*2-1`，沿 rod 長軸（E/W：z 軸；S/N：x 軸）在 ±halfLength 內均勻分佈。2.4m 線段 uniform sample 還原為連續燈條。

**fix07：sampleStochasticLight11 pool gate 不對稱**

sampleStochasticLight11 原 Cloud idx 7-10 分支（L263）有 `if (uCloudLightEnabled < 0.5) { throughput=0; return nl; }` gate；但 idx 1-4（Track）與 idx 5-6（Wide）分支**無**對應 gate。

後果：GUI 關掉 trackLightEnabled / wideTrackLightEnabled checkbox 僅擋 primary-hit emission；NEE 層 shadow ray 仍攜 uTrackEmission（3000K 暖）與 uWideEmission（6500K 冷）沉積至牆面 → 牆上持續殘留冷暖光斑。

修法：於 L224 Track 分支與 L243 Wide 分支首行插入 mirror gate，pattern 對齊 L263 Cloud gate；三類光源 NEE gate 達成對稱。

### 教訓（跨 R 階段通用）

1. **ralplan DELIBERATE 共識的 ADR 不是物理法則**：R3-5b 甲案（2-face pick）經 Planner+Architect+Critic 三角簽字，仍敗在 cos(θ) 離散發射造成硬邊。ADR 保障**過程正確**，不保障**視覺正確**。user 給的「口字柔光帶」唯一肉眼基準才是真 AC；ADR 偏離須即報告，不得隱瞞。
2. **NEE pool 的每條分支都須鏡像 primary-hit gate**：凡 GUI 可關的光源，必須在「primary-hit emission branch」與「sampleStochasticLightN 對應 idx 分支」兩處皆加 `if (uXxxEnabled < 0.5) bypass`。單側 gate 會讓 checkbox 變成「只擋直射、不擋間接」的半截開關。診斷口訣：關燈仍有色斑 → 立查 NEE pool gate 對稱性。
3. **線型 emitter 不可只取中心點**：rod、燈管、線燈的 NEE target 須沿長軸 uniform jitter，單點 target 會讓 N 根 rod 塌陷成 N 個離散光斑，完全沒有「燈條」視覺。長軸 jitter 為線型 emitter 的必要條件，非優化項。
4. **face-pick 硬邊 ≠ face-pick 錯誤**：2-face 甲案能量守恆算式正確（face-area integrand + face-pick 1/2 補償）仍產生硬邊，根因是**軸對齊 normal 的 cos(θ) 分佈離散**，非量綱錯。解法是換 normal 拓撲（對角、球冠分散），不是改 PDF 係數。
5. **Phase 1 grep 所有 `uXxxEnabled` 使用點**：下次再加光源時，第一步搜 `grep -n "uCloudLightEnabled"` 找出全部出現位置（通常 3~4 處：primary-hit、NEE pool branch、isFixtureDisabled、indirect-emission），同批加 gate 才不會 fix04→fix07 一路追打補丁。

---

## R3-6｜Many-Light + MIS 整合收尾補丁（fix04 ~ fix06）

### 背景
R3-6 Many-Light Sampling + Multiple Importance Sampling（多重要性採樣，power heuristic β=2）由背景 executor 依 ralplan deliberate APPROVE iter 2 甲案落地（cache-buster `r3-6-fix03-mis-math`）。使用者 2026-04-20 肉眼驗收四條（金屬反射、無螢火蟲/漏光、MIS rollback 等價、checkbox 牆面無殘光）全過。但驗收過程發現三項非 MIS 本身的缺漏，以 fix04~fix06 連續補丁收尾。

### fix04｜Cloud 漫射燈條 GUI checkbox 補齊

**症狀**
GUI camera folder 內只有「投射燈軌道 (東西)」、「廣角燈軌道 (南北)」兩個 checkbox，無 Cloud 漫射燈條獨立 checkbox。Config 3 進場時 Cloud 開、Config 1/2 自動關，但使用者無法在 Config 3 下單獨關 Cloud 比對 Track/Wide 效果。

**根因**
shader `uCloudLightEnabled` uniform 三處 gate（primary-hit L330、NEE pool L330、BSDF-hit MIS L1679）早在 R3-5b 就位；JS uniform 宣告 `uCloudLightEnabled = { value: 0.0 }`（L1006）與 applyPanelConfig Config 切換同步（L337-339）也到位。**只差 lil-gui camera folder 的 checkbox 實體與 state 同步區塊**——R2-18 fix22 決定「Cloud 吸音板+燈條已整合為 Acoustic Panels Config 3，camera folder 不再重複出現」，此決策在 R3 升級真光源後不再適用（shader 已能單獨關 Cloud 貢獻，UI 層應對稱開放）。

**修法**
1. `js/Home_Studio.js` L420 區新增 `let cloudLightState = null, cloudLightCtrl = null;` 全域變數
2. `applyPanelConfig` Config 切換尾端（L361）加 cloudLightState.cloudLight sync 區塊（mirror trackLightState / wideTrackLightState pattern）
3. cameraFolder 廣角燈 checkbox 後（L1371）新增 `cameraFolder.add(cloudLightState, 'cloudLight').name('Cloud 漫射燈條').onChange(...)` 寫 uCloudLightEnabled + wakeRender

**教訓**
完整 feature 收尾必 grep `uXxxEnabled` 全部使用點（shader gate × N + JS uniform 宣告 + Config 聯動 + **GUI checkbox 實體** + state sync）。R3-5b fix07 已立下「gate 對稱原則」，fix04 延伸為「UI 對稱原則」：shader 層 gate 就位 ≠ feature 完整，GUI 沒 checkbox 等同使用者看不到 feature 存在。

---

### fix05｜天花板 1e Center 南側延伸

**症狀**
使用者 Cam（pos ≈ (-1.79, 1.90, 2.17), pitch=0.53, yaw=-0.965）仰視 + 向西南看，畫面右上露出**黑色楔形缺口**：天花板延伸到某 Z 位置突然斷邊，斷邊與南牆之間漏出外景（窗外建築）。

**根因**
R2 fix23 把 1e 天花板 Center box 的 bmax.z 從 MAX_Z（3.256）縮到 3.056 對齊南牆內面，並宣告「N/S edge 依賴 1a/1c/1g/1i 覆蓋」。但 1g SW corner = `x∈[MIN_X,-1.91]`、1i SE corner = `x∈[1.91, MAX_X]`，中央 `x∈[-1.91, 1.91]` 的 `z∈[3.056, MAX_Z]` 區段**無 box 覆蓋**——1a/1c 是北角，1g/1i 是南角但只補兩側。這是 fix23 遺留的**幾何缺口**，相機在南向仰視時看穿該空隙。

**修法**
`addBox([-1.91, 2.905, -1.874], [1.91, MAX_Y, MAX_Z], ...)` — 1e Center 的 bmax.z 從 3.056 回推到 MAX_Z，把中央南段補滿。cullable 保持 0（延長段不隨 X-ray 剝離，符合「使用者想看到這塊」意圖）。

**教訓**
「corner 覆蓋依賴」策略（center 縮短 + 四角補齊）須驗證**三軸 9 宮格全覆蓋**：N/S/E/W 四 edge + NW/NE/SW/SE 四 corner + Center，共 9 塊。fix23 只補了 4 個 corner，漏了**南/北中央 edge 條帶**。下次收 center/corner 架構務必對照 9 宮格 checklist。

---

### fix06｜地板 0e 對稱補長 + 西南/東南柱 cullable=3 X-only tier

**症狀 1（地板對稱）**
fix05 修完天花板後，地板 0e Center 同構的 bmax.z=3.056 缺口也存在。使用者主動要求對稱補長（地板視角不常見但為保一致性）。

**症狀 2（柱剝離綁定錯）**
X-ray 透視原 cullable=2 邏輯「box 中心位於相機同側半空間（X + Z 雙軸）即剝離」——使用者發現相機在**南側房外**時，南牆 + 西南柱 + 東南柱一起隱形；期望：南牆隱形時兩根柱子仍可見，且西南柱只跟西牆、東南柱只跟東牆連動剝離（使用者原話：「不要綁在南牆連動」）。

**根因（症狀 2）**
現有 cullable tier：
- 0 = 不剝
- 1 = 薄板貼牆內向角（牆板/GIK/插座）
- 2 = 大型遮擋雙軸半空間（柱）

西南/東南柱為 cullable=2，其 boxCenter.z > roomCenter.z（南半），uCamPos.z > uRoomMax.z（相機南房外）時判式成立 → 柱被剝離。這是雙軸語義的必然結果，不符使用者「只跟側牆綁」的單軸意圖。

**修法**
1. `js/Home_Studio.js` L75 地板 0e Center：bmax.z `3.056 → MAX_Z`（對稱 fix05）
2. `shaders/Home_Studio_Fragment.glsl` L594-634 `isBoxCulled` 新增 **cullable=3 tier**（單軸 X-only 半空間判）：僅 X 軸雙向判式，Z 軸條件移除
3. `js/Home_Studio.js` L107/108 西南柱 14 + 東南柱 15 的 cullable 參數 `2 → 3`

cullable tier 更新後定義：
```
0 = 家具（永不透）
1 = 牆/樑/GIK/插座（薄板貼牆內向角）
2 = 柱等大型遮擋 X + Z 雙軸（目前場景無使用，保留語義）
3 = 大型遮擋僅 X 軸（西南/東南角柱專用；南牆 X-ray 時柱保持可視）
```

**教訓**
cullable 機制原「雙層 tier」擴充為「三層 tier」的正確方式：**新增分支而非改現有語義**。若直接把 cullable=2 的 Z 軸拿掉會破壞未來可能的「雙軸柱」需求（例如房間正中心的獨立大柱）。保留 cullable=2 語義 + 新增 cullable=3 = 可讀性與擴充性雙贏。JS 端 box 資料不需 schema 遷移（cullable 本為 float，值 3 直接可用）。

---

## R3-6.5｜廣角燈 tilt 配置錯誤（北牆明暗交界假陰影）

**症狀**
R3-6.5 收尾 Cam 3 × CONFIG 3 全開驗收時，使用者肉眼發現**北牆有一道水平明暗交界**，不是廣角燈自身 pattern。

**排除假設**
先懷疑 R3-6.5 動態池本身（N=10 LUT 重建 / uActiveLightCount 錯算），但 N=1 退化路徑驗證乾淨、contract test 全綠，排除動態池 bug。

**診斷（A/B probe，不跳 UI）**
使用者提示「直接改一個 TILT 值跟 20 差多一點」，避免為了診斷先花半天做 UI slider。把南北廣角燈 tilt 從「對打 20°」臨時改成 45° 做 A/B 對比 → 北牆交界位置隨 tilt 漂移 → 確認是廣角燈光路被遮擋產生的**假陰影**、不是動態池演算法錯。

**根因**
R2-15 南北廣角燈重建時**憑印象設成對打配置**（南→北打、北→南打、tilt 都 20°）。真實空間兩盞廣角燈**不對稱**：南方廣角燈 **+15° 朝南打（外側）**、北方廣角燈 **-25° 朝北打（外側）**。對打配置讓南方廣角燈光路穿過房間中心被 **Cloud 吸音板（GIK 版）擋住** → 北牆形成水平陰影交界。

**修法**
查舊專案 `Home_Studio_3D_OLD/Path Tracking 260412a 5.4 Clarity.html` L422-423 實測值還原：
```js
// js/Home_Studio.js L1116-1132
var _wideSinS = Math.sin( 15 * Math.PI / 180);
var _wideCosS = Math.cos( 15 * Math.PI / 180);
var _wideSinN = Math.sin(-25 * Math.PI / 180);
var _wideCosN = Math.cos(-25 * Math.PI / 180);
pathTracingUniforms.uTrackWideLampDir = { value: [
    new THREE.Vector3(0, -_wideCosS,  _wideSinS), // 南燈 +15° 朝南打
    new THREE.Vector3(0, -_wideCosN,  _wideSinN)  // 北燈 -25° 朝北打
] };
```
還原後北牆水平交界消失，Cam 3 畫面正常。

**教訓**
1. **R2 重建不可憑「該對稱吧」美感直覺猜數值**。真實空間配置常不對稱（地形 / 設備位置 / 使用需求造成）。廣角燈這類具物理配置語義的元件，重建前必 grep 舊專案實測值（`trackWideTiltSouth` / `trackWideTiltNorth`）。
2. **A/B probe 值變化是 debug 首選**，不要為了診斷先花半天做 UI。使用者提示「直接改一個值做對比」比 UI slider 快 10 倍。
3. **北牆假陰影 vs 動態池 bug** 容易誤判為同一個系統（R3-6.5 收尾時發生），必須用 tilt A/B 獨立隔離因子才能歸因到 R2-15 而非 R3-6.5。memory feedback_r2_rebuild_check_legacy_numbers.md 已記錄警示。

---

## Phase 2 漫射能量 2-bounce truncation 說明（R3-7 寫入）

本章為後續任何 Claude / 工程師接手時的必讀參考。目的：**防止再次誤以為 `uIndirectMultiplier = 1.7` 與 `uLegacyGain = 1.5` 是可透過提 `max_bounces` 歸一的臨時魔數**。

### 症狀起點

R3-7 原計畫（見 `docs/SOP/R3：燈光系統.md` 舊版 R3-7 章節）假設：
> R3-6 MIS 上線後，理論上提高 max_bounces 能自然收斂到正確能量，不必靠 1.7。

做法為 `max_bounces` 4→6→8 × `indirectMul` 1.7 / 1.5 / 1.3 / 1.0 四級 × Cam 1/2/3 × 2000 spp，比對亮度分佈。

使用者 2026-04-20 提問：「我目前預設彈跳不是 4 嗎 為何這一段寫 2 截斷？然後目前我是覺得 4～8 肉眼沒有差異」。此觀察推翻原假設。

### 根因：erichlof 框架 `diffuseCount == 1` 單掛旗

`shaders/Home_Studio_Fragment.glsl` L1386-1392 的漫射反彈機制：

```glsl
diffuseCount++;
if (diffuseCount == 1)            // ★ 只有第 1 次漫射才掛旗
{
    diffuseBounceMask = mask;
    diffuseBounceRayOrigin = rayOrigin;
    diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
    willNeedDiffuseBounceRay = TRUE;
}
```

流程：

```
第 1 次打到漫射面：
  - 做 NEE（直接射向光源的陰影採樣）
  - 掛旗 willNeedDiffuseBounceRay = TRUE（等 NEE 結算完再從這點隨機彈 1 次）
  - continue 往 NEE 目標走

第 2 次打到漫射面（從掛旗點彈出來）：
  - 再做 NEE
  - diffuseCount 已經 = 2，上面 if 不成立 → **不再掛旗**

第 3 次以後打到漫射面：
  - 永遠不會發生（沒人掛旗讓它彈）
```

所以不管 `uMaxBounces` 給多少（目前 4，設 8 / 14 同理），**漫射能量累加永遠停在第 2 次**。剩餘的 bounce 預算只影響 specular / mirror / refraction 路徑；Home_Studio 場景幾乎全為 DIFF 材質（牆、地、天花板、GIK、Cloud、木質家具），多出來的 bounce 大多用不到。

### 框架普遍性（非 Home_Studio 專案簡化）

2026-04-20 抽樣 4 支 erichlof 代表範例 shader，`diffuseCount == 1` 單掛旗模式全部一致：

| 範例 shader | 位置 | `willNeedDiffuseBounceRay = TRUE` 夾於 `if (diffuseCount == 1)` |
|---|---|---|
| Cornell_Box_Fragment.glsl | L322 | ✓ |
| Global_Illumination_Wikipedia1_Fragment.glsl | L457 | ✓ |
| Kajiya_TheRenderingEquation_Fragment.glsl | L584 | ✓ |
| Geometry_Showcase_Fragment.glsl | L501 | ✓ |

連 erichlof 為了示範 Kajiya 經典全局光渲染方程式而寫的 Kajiya_TheRenderingEquation 範例都是 2 層截斷。這代表 **此限制是 erichlof 框架核心設計決策**，非 bug、非 Home_Studio 簡化。

推測動機：
- shader GPU worst-case work bound（無限漫射鏈會讓 per-pixel 成本爆炸）
- 多數場景第 3 次以上漫射能量貢獻已在 noise 內
- 單層掛旗狀態機比多層 chain 更容易避 MIS 雙計陷阱（R3-6 MIS 整合 fix01~fix06 可資佐證）

### `uIndirectMultiplier = 1.7` 正當性

- 這個係數補償的是**第 3 次以後永遠不再累加**的能量缺口
- 1.7 是使用者 R2-18 fix21 肉眼對齊**真實工作室**的校準值
- 渲染器本來就是「對齊您的眼睛」而非「對齊物理公式」——它是校準工具，不是純物理模擬
- 提 `max_bounces` 無法移除這個補償（框架結構限制），只能動框架（見下方方向 B/C）

### `uLegacyGain = 1.5` 同性質

JS L1058 引入，shader 10 處 `mask *= weight * uLegacyGain` 套用於 NEE dispatch 直接光分支。同屬 R2 時代視覺校準傳承值，R3-7 方向 A 同樣定性為框架補償，不實驗歸一。

### 1.7 / 1.5 對採購評估的影響（C3 dream 語境）

兩者皆為**均勻純量乘數**，對所有漫射路徑一視同仁。故：

- **相對比較永遠成立**：2000 lm vs 3000 lm 在同場景下的比例不會因補償失真
- **色溫比對永遠成立**：純量乘數不動 RGB 比例
- **幾何遮擋完全物理正確**：GIK / Cloud / 軌道擋光判斷純幾何，與 1.7 無關
- **空間梯度微偏**：強依賴多反彈的角落（天花板四角、書櫃底下）會相對「平」一點；不翻盤採購決策

結論：對「C3 採購評估」目的（R3-8）完全可用。

### 方向 B / C（延後至 R6 完工後 — 原為 R5，2026-04-26 R5 撤回後改為 R6）

若未來要徹底消除 1.7 補償（歸物理正確），有兩條路：

**方向 B：動框架讓漫射鏈無限**
- 移除 `if (diffuseCount == 1)` 單掛旗限制，每次漫射都 stash + 重新掛旗
- 配合 Russian Roulette（俄羅斯輪盤機率終止）防 throughput 太低還追
- 重新驗證 MIS 不雙計（R3-6 框架只驗過 2 層）
- 風險：等同偏離 erichlof 整套設計哲學

**方向 C：Russian Roulette 完整重構 bounce loop**
- 把「硬上限 `bounces >= uMaxBounces` break」換成標準機率終止
- 影響面：整個 `CalculateRadiance()` 主迴圈 + 17 處 diffuseBounce dispatch site
- 風險：等於重做 path tracer 核心

**2026-04-20 決議**：方向 B/C 延後至 R3 + R4 + R5 全部完工、token 預算充裕後才挑戰。若使用者主動提起，先確認 token 充裕再動手——中途停工會留下半完工框架污染。

**2026-04-26 條件更新**：R5 整階段已撤回（見 `R5：Cloud光源重構.md` §R5-Z），延後條件改為「R3 + R4 + R6 全部完工後」。R6 = 渲染效能優化（BVH + 後處理降噪雙主線）。

### Blender 接軌觀點（2026-04-20 補充）

使用者未來可能把此專案校準資料導入 Blender Cycles 做最終渲染。對照表：

| 項目 | erichlof 框架 | Blender Cycles 接軌 |
|---|---|---|
| 幾何 (中心, halfSize) | `addBox()` 實測值 | Mesh 尺寸數值直接吃 |
| 光通量 → radiance | `lumensToWatts` / `Φ/(K·π·A)` | Cycles Light Watt + Kelvin 直接吃 |
| PBR (roughness/metalness) | per-class uniforms | Principled BSDF 同名欄位 |
| 商品規格 | 4 種 Cloud / 5 段 Track / 2 支 Wide | Cycles Area/Spot Light 直接吃 |
| GLSL shader code | 1800+ 行 | ✗ Cycles 用 OSL Shader Node |
| 2-bounce 截斷 + 1.7 補償 | 框架限制 | ✗ Cycles 原生多反彈 + Russian Roulette |
| `CalculateRadiance` | 自訂 path tracing loop | ✗ Cycles 核心接手 |

結論：**shader 層不無縫，科學校準層 100% 無縫**。1.7 / 1.5 補償在跨引擎時自動消失——這也是為何 R3-7 不值得為歸一投入工程量的另一原因。

### 教訓

1. **別把「Phase 2」當時限標籤看待**：SOP 早期寫「Phase 2 2-bounce truncation」給人一種「之後 Phase 3 會解」的錯覺；實則這是 erichlof 框架固定行為，不會自動升級
2. **`max_bounces` 與「漫射能量累加深度」是兩件事**：前者是所有射線類型的總迴圈上限，後者被 `diffuseCount == 1` 單掛旗鎖在 2 層
3. **渲染器的驗收標準是使用者眼睛，不是物理公式**：1.7 是對齊真實空間的校準產物；R2-18 定案時已經通過此門檻

### 2026-04-24 追記（R4-3-追加 實驗後續進化，歷史註解）

本章撰寫於 R3-7 時點，描述「1.7 / 1.5 為 erichlof 框架補償魔數、不建議歸一」。
**R4-3-追加 實驗（experiment/r4-uncap-test，commit 0594f00 合回 r3-light）已推翻本章結論**：

- `uIndirectMultiplier` 1.7 → **1.0（歸一）**
- `uLegacyGain` 1.5 → **1.0（歸一）**
- shader 10 處漫射閘門 `if (diffuseCount == 1)` → `if (float(diffuseCount) < uMaxBounces)`
- shader 7 處 swap handler `diffuseCount = 1` → `diffuseCount++`
- 實驗同時發現並修復 ceiling NEE 潛伏 bug：L1021 / L1029 / L1033 三處 `accumCol =` → `accumCol +=`（原版 2-bounce 截斷下覆寫等效於累加，解除截斷後 bug 暴露為「多層反而變暗」）

**進化後行為**：shader 已為 N-bounce 可調（uMaxBounces slider 1~14），不再需要框架補償。
A 模式（趨近真實）= 14 bounces、補償 1.0、牆面反射率 0.85；
B 模式（快速預覽）= 4 bounces、補償 2.5、牆面反射率 1.0。

本章「不值得為歸一投入工程量」的結論僅適用於 R3-7 時點之框架現況；R4-3-追加 以單一 commit 原子完成了歸一 + 結構修復 + bug fix。R3 git 歷史不動，R3 仍為「2-bounce 截斷 + 魔數補償」版本紀錄。

---

## R4-1｜UI 骨架復刻（lil-gui → 自製 HTML panel）

### 症狀群（使用者 Brave 瀏覽器肉眼驗收回報 6 輪 fix）

fix01-02：面板完全不可見 / Stats.js FPS 計數器殘留
fix03：色溫 radio 按鈕點擊無視覺切換
fix04-05：隱藏 UI 後無法還原（pointer lock 搶走點擊）；視角按鈕觸發 pointer lock
fix06：軌道燈色溫同時多顆發光；廣角燈南北 checkbox 無獨立控制；面板與快照縮圖重疊

### 根本原因與修法

#### 1. 外部資源 cache-buster 必須全覆蓋

CSS `<link>` 和所有 `<script>` 都必須帶 `?v=` query。只改 JS 不改 CSS → Brave 繼續服務舊 CSS → `position:fixed` 缺失 → 整個 `#ui-container` 被 canvas 蓋住。

**通則**：每次修改任何外部資源檔，同步遞增對應 `<link>` / `<script>` tag 的 `?v=` 值。遺漏一個就有一個快取地雷。

#### 2. pointer-lock 守門三件套（所有互動 UI 元素必備）

InitCommon.js 的 `document.body.addEventListener("click", ...)` 會檢查 `ableToEngagePointerLock` 再呼叫 `requestPointerLock()`。任何浮動 UI 若少了以下三步，點擊就會觸發視角旋轉鎖定：

```
element.addEventListener('mouseenter', () => { ableToEngagePointerLock = false; });
element.addEventListener('mouseleave', () => { ableToEngagePointerLock = true; });
element.addEventListener('click', e => { e.stopPropagation(); });
```

R4-1 受害元素：`#ui-container`、`#bottom-right-group`、`#top-right-group`。日後新增任何 fixed/absolute UI 都必須補齊。

#### 3. 色溫 glow class 不可用通用 glow-white 代替

舊專案的色溫 radio 每組有專屬 glow 映射：
- Cloud / Wide（暖/自然/冷）：`glow-orange` / `glow-white` / `glow-blue`
- Track（全暖/全冷/北暖南冷/北冷南暖）：`glow-orange` / `glow-blue` / `glow-gradient-ob` / `glow-gradient-bo`

若統一用 `glow-white` 切換，會造成：(a) 舊 gradient class 未移除 → 多顆同時發光；(b) 暖冷色視覺無區別。

**通則**：按鈕切換 handler 的 `classList.remove(...)` 必須列舉該組所有可能的 glow class，不能只移除 `glow-white`。

#### 4. 單一 uniform 控制多光源的陷阱

`uWideTrackLightEnabled` 是一個 float 同時 gate 南北兩盞廣角燈。checkbox 用 `anyOn` 邏輯保持 uniform=1.0 → shader 對兩側一視同仁 → 取消勾選一側仍雙側發光。

R4-1 解法：`syncWideEmissions()` 在 checkbox 切換時呼叫 `computeLightEmissions()` 重算後，將未勾選側的 `uTrackWideEmission.value[i]` 歸零。LUT 也依各自 checkbox 狀態獨立加入 slot 5/6。

**殘留限制**：未勾選側的燈具外殼（housing mesh）仍在 BVH 中以暗色可見，完全隱藏需 R4-3 加入逐側 shader uniform 或場景重建。

#### 5. slider 預設值必須對齊 shader uniform 初始值

`createS()` 的 `init` 參數決定 slider 啟始位置，但不會回寫 shader uniform——uniform 在 `initSceneData()` 中獨立賦值。若 slider init ≠ uniform default，畫面與 UI 顯示不一致。

R4-1 命中案例：
- `slider-wall-albedo` init=0.8 vs `uWallAlbedo`=1.0 → 改 init=1.0
- `slider-emissive-clamp` init=250 vs `uEmissiveClamp`=50 → 改 init=50
- `slider-pixel-res` init=0.5 vs 使用者期望 1.0 → 改 init=1.0

#### 6. Dark Reader 瀏覽器擴充功能會干擾驗收

Brave 的 Dark Reader 會反轉 CSS 色彩，導致 glow 效果和 GIK 色塊外觀錯誤。驗收 UI 色彩相關功能時必須先關閉 Dark Reader。

---

## R6-LGG-J3｜借光 buffer 13 輪 debug 與根因（per-frame stochastic gate 平均後產生空間 banding）

### 症狀

B 模 4 彈快速預覽開啟「暗角借光」（slider-borrow-strength-b > 0）後，C1/C2 高反彈場景（白牆 + 大吸頂燈）牆面與天花板交界、AO 帶等位置出現空間結構性光斑/條紋，跟一般 path tracing noise 不同——多採樣不會收斂消失，是真實的 mean 結構。

### 13 輪失敗時序（r17~r28，最終 r29 修好）

```
 r17  5×5 cross blur on borrow（無 source clamp、無 gate）
       使用者：「光斑被抹大了」
       失敗原因：blur 把所有 borrow 值（亮 + 暗）一起平均，亮面被推、暗角被均化

 r18  同 r17 邏輯，僅微調

 r19  source-side firefly clamp（pathtracing_main chunk，借光 pass 進入 accumulator 前 clamp 1.0）
       改善 firefly 但 1/8 res chunk 仍在

 r20  accumCol gate（per-path 撞光與否，exp(-accumLuma × 100)）
       使用者：「C1/C2 wall top 被推亮，光暗顛倒」
       失敗原因：AO 帶 path 收到弱光，gate 給半套，加上 14 彈 borrow 高 wraparound luma → AO 帶被推得比中段牆還亮

 r21  雙重 gate：accumCol gate × positionGate(borrow_luma, 0.2~0.6)
       使用者當時驗收 OK，但其實 banding 仍在、只是 r20 inversion 太明顯掩蓋
       本輪即埋下 r28 的種子

 r22  cleanup（移甜蜜點預設、拆暗角補光）

 r23  速度優化嘗試：tighter gate (0.25, 0.35) + Russian Roulette + 5-tap blur
       使用者：「C1/C2 wall top 不明光斑」
       失敗原因（事後分析）：tighter gate 把 1/8 borrow texel 邊界亮度差直接放大成硬邊；
                              RR 在白牆高反彈場景 mask /= survival 偶爆 firefly；
                              blur 抹大 RR spike 變大塊光斑

 r24  rollback gate to (0.20, 0.45)
       使用者：「還是有」
       失敗原因：根因不是 gate 寬窄，是 RR + darkGate 組合

 r25  in-shader 5-tap cross blur on borrow
       使用者：「還是有阿」
       失敗原因：RR 仍在跑，blur + RR spike 互相疊加

 r26  rollback to r21 state（拆 RR、拆 blur、gate 回 0.2~0.6）
       使用者：「這版一樣是有光斑」
       重大發現：banding 不是 r23~r25 引入的、r21 就有、只是當時 r20 inversion 蓋過

 r27  4-tap 半 texel 偏移 blur 修 bilinear 跨 borrow 邊界跳變
       使用者：「失敗 還是有」
       失敗原因：bilinear 跳變不是根因（事後追究是 darkGate 平均後形成空間結構）

 r28  拆 darkGate，只留 positionGate (0.2, 0.6)
       使用者：「光斑變成向外擴散，連旁邊都髒髒的」
       失敗原因：positionGate (0.2, 0.6) 範圍太寬，亮面 borrow_luma 0.4~0.6 仍給 0.5 級 gate，
                 contribution 受 1/8 borrow per-texel variance 影響、向外擴散變髒
```

### 真正的根因

`darkGate = exp(-accumLuma × 100)` 是 per-frame 對「該 path 撞光與否」做機率分類，看似合理但 **多 frame 平均後 E[darkGate] 直接等於該 pixel「沒撞光機率」**：

```
 pixel 撞光機率 60% → E[darkGate] ≈ 0.4 × 1 + 0.6 × ~0 = 0.4
 pixel 撞光機率 40% → E[darkGate] ≈ 0.6 × 1 + 0.4 × ~0 = 0.6
```

牆面不同高度的撞光機率隨 NEE 幾何漸變（離吸頂燈愈近的牆愈容易撞到光）→ E[darkGate] 隨高度漸變 → contribution mean 形成沿 NEE 機率等高線的水平 banding。**這不是雜訊，是真實空間結構，再多採樣也不會消失。**

### r29 修法（成功）

拆 darkGate，positionGate 收緊到 (0.0, 0.3)：

```glsl
if (uBorrowStrength > 0.0)
{
    vec2 borrowUv = gl_FragCoord.xy / uResolution;
    vec3 borrowedSum = texture(tBorrowTexture, borrowUv).rgb;
    vec3 borrowedAvg = borrowedSum / max(uSampleCounter, 1.0);
    borrowedAvg = min(borrowedAvg, vec3(1.0));
    float borrowLuma = dot(borrowedAvg, vec3(0.299, 0.587, 0.114));
    float positionGate = 1.0 - smoothstep(0.0, 0.3, borrowLuma);
    accumCol += mask * borrowedAvg * uBorrowStrength * positionGate;
}
```

`positionGate` 用穩定收斂的 `borrow_luma` 判位置「14 彈下本來是不是亮的」，不是 per-frame 隨機，多 frame 平均後不會產生 banding。範圍 (0.0, 0.3) 比 r28 的 (0.2, 0.6) 嚴：

```
 borrow_luma 0    → gate 1.0   (深暗角全套)
 borrow_luma 0.15 → gate 0.5   (corner edge)
 borrow_luma 0.25 → gate 0.07  (almost off)
 borrow_luma 0.3+ → gate 0     (wall, ceiling, lit area, all blocked)
```

### 教訓（永久紀律）

```
 1. 必先 isolation test 鎖根因再動工
    使用者一句「strength=0 就無 banding」精準定位「根因在 borrow 機制內」，
    我前 4 輪沒做這步、瞎猜瞎改、燒掉 4 個版本

 2. per-frame stochastic gate 是危險的
    per-frame 0/1 機率分類在多 frame 平均後 E 值等於該 pixel 機率
    若該機率隨幾何漸變（NEE 視野角度、AO 程度）→ 形成空間結構
    這個 mean 結構是「真實正確的數學期望值」、不是 noise，多採樣不會消除

 3. 跟 LESSONS-R6 5 路 luma-based shadow detection 失敗的對照
    失敗組：post-process 階段用「顯示亮度」per-pixel 分類
    本組  ：path tracer terminal 階段用「該 path 收到光多少」per-frame 分類
    都是「per-frame 樣本基礎的分類」，平均後若樣本機率有空間漸變即產生 banding
    教訓 same：per-frame stochastic gating 不可靠，要用穩定收斂的位置量

 4. blur 不是萬能藥
    r17 / r25 兩次 blur 都失敗、不是 blur 本身有問題、是 blur 上游有 firefly / RR spike
    blur 把 spike 抹大 → 視覺更糟
    blur 應在「source 已經 clamped 不會 spike」時才上

 5. 速度優化要在功能正確之後再做
    r23~r25 都是在功能（其實當時還沒收斂）尚未驗證乾淨時就開始優化速度
    結果優化的副作用跟既有 bug 互相疊加、debug 路線完全混亂
```

---

## R6-LGG-r30｜White Balance + Hue + per-config stateful 切換 + 窗外背板 X-ray fix

### 範圍

R6-LGG-r29 完工狀態之後累積的延伸工作（B 模快速預覽）：

```
 1. WB / Hue 雙滑桿（純後製、display-space 最末端、不觸發採樣重置）
 2. per-config 預設體系（C1 / C2 / C3 / C4 各自 10 欄甜蜜點）
 3. stateful per-config 切換（離開 snapshot、進入 restore-or-init）
 4. cmd+click 重置回該 config 預設（8 條後製 + 牆面反射率共 9 條）
 5. C1 / C2 全套滑桿對齊使用者實測截圖
 6. C4 局部細調（Gamma 2.0、WB -0.2、Hue 2、Lift -0.1、ACES SAT 1.0）
 7. 窗外景色背板（box 27）cullable 1 → 0 修 X-ray 透視剝離 bug
```

### 教訓 1｜粗糙色彩濾鏡 vs LR / DaVinci 物理 WB / Hue 不同數學

第一版實作把「色溫藍↔黃 / 色調綠↔紅」做成直接 R / G / B 通道乘加：

```glsl
displayColor.r *= 1.0 + uTempB * 0.30;
displayColor.b *= 1.0 - uTempB * 0.30;
displayColor.g *= 1.0 - uTintB * 0.30;
```

使用者糾正：「我要的是 WHITE BALANCE 跟 HUE，剛剛做的看起來則是套用顏色濾鏡，效果完全不一樣」。

差異本質：

```
 粗糙色彩濾鏡       3 個獨立 channel 偏移；對應 PS Color Balance Tool 那種「整體染色」感
 White Balance     von Kries chromatic adaptation：模擬光源 illuminant 位移
                    暖端 +1（≈3000K Tungsten）：R *= 1.25、G *= 1.00、B *= 0.65
                    冷端 -1（≈9000K cool target）：R *= 0.85、G *= 1.00、B *= 1.18
                    G channel 在 D illuminant 上幾乎不變（Y 為支點），R / B 非對稱反向
 Hue               NTSC luma-preserving 色相環旋轉（繞 (1,1,1)/√3 軸）
                    紅 → 橘 → 黃 → 綠 → 青 → 藍 → 紫 → 紅 整環平移、亮度幾乎不變
```

**Hard Rule**：使用者要求「白平衡 / 色相」滑桿時，必走物理 chromatic adaptation + hue rotation matrix 數學，禁用粗糙 R / G / B 偏移。

### 教訓 2｜「切標籤不重置」與「切標籤套預設」的衝突 → stateful 架構

兩條使用者需求曾衝突：

```
 A  切到 C4 → 自動套 Gamma 2.0 等 C4 預設（要看 C4 樣貌）
 B  切離 C1 → 切回 C1 → 我先前在 C1 調的值還在（不要丟）
```

第一版做 A 不做 B：使用者抱怨「臨時調整的值會不見」。
第二版做 B 不做 A：使用者抱怨「切到 C4 仍是 Gamma 1.5」。

正解：**stateful per-config 架構**。

```
 全域狀態：
   configPostDefaults  4 個 config 第一次進入時的初值 + cmd+click 重置目標
   configState         4 個 config 離開時的 slider 值快照

 切 config 時：
   1. snapshot oldConfig 當前 slider → configState[oldConfig]
   2. enter newConfig：
        configState[newConfig] 存在 → restore（恢復離開前狀態）
        configState[newConfig] 是 null → 套 configPostDefaults[newConfig]（第一次進該 config）
```

兩條需求同時成立。

### 教訓 3｜窗外景色背板 cullable bug 與 X-ray 範疇定位

R2-13 X-ray 透視剝離邏輯（cullable=1 走 line 635-638）：

```glsl
if (uCamPos.z > uRoomMax.z + eps && bmin.z > uRoomMax.z - T) return true;
```

意思：「相機在 z+ 房間外、box 在 z+ 遠端」→ 剝離。

box 27（窗外景色背板）位於 z=14.9~15.0、cullable=1 → 當 cam1 / cam2 在 z=3.7 / 3.9（roomMax.z 約 3.13）外時，條件成立 → 窗外背板被剝離 → 從室內看出去窗戶變空。

根因：「窗外背板」是「永遠該被看見的背景貼圖」、不屬於 X-ray 牆系剝離範疇，cullable 應該設 0。

修法：line 131 cullable 1 → 0。

**Hard Rule**：cullable 標記是給「會擋視線、剝離後露出室內的牆系幾何」用的；背景 / 天空 / 永遠該見的貼圖物件 cullable=0。

### 程式現況（r30 final）

```
 4 檔備份標記 r6lgg30-bak：
   Home_Studio.html
   js/Home_Studio.js
   js/InitCommon.js
   shaders/ScreenOutput_Fragment.glsl

 詳細交接：.omc/HANDOFF-R6-r30-final.md
```

---

## R6-3 Phase2｜Cloud visibility probe v4/v5 亮度回歸教訓（2026-05-03）

### 範圍

R6-3 Phase2 Step2 原本目標是降低 Cloud NEE probe 裡的 `zeroCloudFacing`。v4 用反向 emission normal 讓 probe 數字變好，但後續 v5 嘗試與回退過程造成 C3 正常畫面偏暗。使用者肉眼回報後，用 systematic-debugging 重新追根因，最後把 v4 normal 改為 probe-only。

### 症狀

```
 1. C3 正常畫面明顯偏暗
 2. C3 uniform 狀態正確：
      Cloud on
      Track off
      Wide off
      Cloud slider = 1600 lm/m
      activeLightIndex = [7, 8, 9, 10]
 3. 頁面已載到 v4 / v5 回退後檔案，已排除快取為主因
```

### 根因

v4 把 Cloud 弧面反向 normal 直接套進正常渲染：

```glsl
vec3 emissionNormal = cloudArcEmissionNormal(rodIdx, theta);
float cloudCosLight = max(0.0, dot(-cloudDir, emissionNormal));
pdfNeeOmega = pdfNeeForLight(x, cloudTarget, emissionNormal, cloudArcArea, selectPdf);
```

這會讓 probe 分類看到較少 `zeroCloudFacing`，但同時改變 C3 真正畫面的 Cloud NEE 能量分佈。結果是 probe 數字改善，正常渲染亮度被拉低。

### 量測證據

同一台 headless Brave、同一 C3、同一 cam3、同一 64 spp、同一 1600 lm/m：

```
 1. HEAD 原始版
      roomCenter avgLuma = 0.274220

 2. 壞掉 v4
      roomCenter avgLuma = 0.158872
      約為 HEAD 的 58%

 3. 修正後 v4-probe-only
      roomCenter avgLuma = 0.274170
      與 HEAD 差 0.000050
```

### 修法

只在 probe 模式使用反向 emission normal；正常渲染維持既有 `localNormal / hitNormal`：

```glsl
vec3 emissionNormal =
    (uCloudVisibilityProbeMode > 0) ? cloudArcEmissionNormal(rodIdx, theta) : localNormal;

vec3 reverseEmissionNormal =
    (uCloudVisibilityProbeMode > 0) ? -hitNormal : hitNormal;
```

cache token 同步更新：

```
 1. Home_Studio.html
      js/Home_Studio.js?v=r6-3-cloud-visibility-probe-v4-probe-only

 2. js/Home_Studio.js
      CLOUD_VISIBILITY_PROBE_VERSION = r6-3-phase2-mode3-emission-normal-v4-probe-only
      Home_Studio_Fragment.glsl?v=r6-3-cloud-visibility-probe-emission-normal-v4-probe-only
```

### 這次浪費時間的原因

```
 1. 一開始只看 probe 數字，沒有同步做 C3 正常畫面亮度 A/B

 2. v5 修法失敗後，只確認 v5 visible-arc 程式碼已移除，沒有立刻確認 v4 本身仍會改正常渲染

 3. 把「debug probe 的分類 normal」跟「production render 的 energy normal」綁在一起

 4. CDP 直接從 WebGL canvas drawImage 算 luma 曾回傳接近 0，後續改用 Page.captureScreenshot 存 PNG，再用 PIL 算 luma 才穩定
```

### 新硬規則

```
 1. 任何 Cloud NEE / normal / PDF / MIS 改動，必須同時做兩組驗證：
      A. probe 數字
      B. probe off 的 C3 正常畫面亮度 A/B

 2. probe 用的診斷 normal、分類顏色、blocker class，不可直接影響正常渲染能量。
    若要共用 shader helper，必須被 uCloudVisibilityProbeMode gate 包住。

 3. 若使用者回報「畫面變暗 / 變亮 / 變髒」，第一步先量：
      scriptSrc
      shaderFile
      configRadio
      uCloudLightEnabled / uTrackLightEnabled / uWideTrackLightEnabled
      uActiveLightIndex
      uCloudEmission
      screenshot PNG luma

 4. probe 數字通過只代表診斷畫面通過，不能代表正常畫面通過。

 5. v5 類型修改若要再做，先建立 baseline：
      HEAD 或目前穩定版 C3 64 spp screenshot luma
      目前穩定版 mode3 zeroCloudFacing selectedClassRatio
      修改後同條件重跑兩者
```

### 這次已跑驗證

```
 1. rtk node docs/tests/r6-3-cloud-visibility-probe.test.js
 2. rtk node docs/tests/r6-3-max-samples.test.js
 3. rtk node docs/tests/r3-3-cloud-radiance.test.js
 4. rtk node docs/tests/r3-5b-cloud-area-nee.test.js
 5. rtk node docs/tests/r3-6-5-dynamic-pool.test.js
 6. rtk node --check js/Home_Studio.js
 7. rtk git diff --check
 8. CDP C3 64 spp screenshot luma：
      修後 roomCenter avgLuma = 0.274170
 9. CDP mode3 probe：
      probeVersion = r6-3-phase2-mode3-emission-normal-v4-probe-only
      zeroCloudFacing selectedClassRatio = 0.1464 at 3 samples
```

### v5b-normal-sampling no-go 紀錄（2026-05-03）

v5b-normal-sampling 嘗試讓 Cloud NEE 先用正常渲染的 Cloud normal 挑可見 theta，再把有效 theta 面積同步套進 throughput 與 `pdfNeeForLight(...)`。使用者以 cam1、target 200 samples、8 theta bins 做肉眼與 Console 驗證。

使用者回傳表格：

```text
thetaLabel  samples  selectedClassRatio  waitTimedOut  thetaStartDeg  thetaEndDeg
all         202      0.3282              false         0              90
0/8         202      0.5052              false         0              11.25
1/8         202      0.4603              false         11.25          22.5
2/8         202      0.4197              false         22.5           33.75
3/8         202      0.3960              false         33.75          45
4/8         202      0.3804              false         45             56.25
5/8         202      0.3695              false         56.25          67.5
6/8         202      0.3665              false         67.5           78.75
7/8         202      0.3942              false         78.75          90
```

判讀：

```text
 1. v5b-normal-sampling 已正確載入。
    Console scriptSrc 顯示 v5b-normal-sampling。

 2. 自動等待成功。
    每列 samples 約 202，waitTimedOut 全部 false。

 3. zeroCloudFacing 變差。
    v5a wait-fix2 使用者驗證 all = 0.2105。
    v5b-normal-sampling 使用者驗證 all = 0.3282。

 4. 初版 v5b 的 all = 0.1233 不可當正式改善證據。
    根因是初版 v5b 讓 probe normal 影響 theta sampling。
```

目前根因判斷：

```text
 1. v5b-normal-sampling 用正常渲染的 Cloud normal 篩 theta：
      cloudArcThetaFacesPoint(...)
      vec3 renderNormal = cloudArcNormal(rodIdx, theta);

 2. mode3 probe 判斷 zeroCloudFacing 時，仍用 probe 的反向 emission normal：
      vec3 emissionNormal = cloudArcRenderNormal(rodIdx, theta);
      float cloudCosLight = max(0.0, dot(-cloudDir, emissionNormal));

 3. 因此 v5b 篩 theta 的方向，與 probe 分類 zeroCloudFacing 的方向不一致。
    這會讓樣本更集中到「正常渲染覺得可見」的位置，但 probe 又用反向 normal 判定，導致 zeroCloudFacing 比 v5a 更高。
```

結論：

```text
 1. v5b-normal-sampling 視為 no-go。
 2. 不要在這條 visible-theta-normal-sampling 路線上疊更多修補。
 3. 下一步先做診斷版，不先改能量：
      A. 同一個樣本同時回報 normal-facing 與 probe-facing 的分類。
      B. 分開統計 source-facing、normal cloud-facing、probe cloud-facing。
      C. 確認 zeroCloudFacing 到底是 probe 定義問題，或是真正的 PDF / 面積 / MIS 問題。
 4. 任何後續修改仍需同時檢查：
      A. probe 數字
      B. probe off 的 C3 正常亮度 A/B
```

### mode4 facing diagnostic 欄位定義整理（2026-05-04）

整理目標：

```text
 1. 把正常 C3 畫面用的 Cloud normal 與 probe 分類用的 Cloud normal 分清楚。
 2. 保留舊 mode3 `zeroCloudFacing` 入口，避免舊 Console 指令失效。
 3. 正式比較改看 mode4 的兩個拆分欄位：
      A. normalCloudFacingZero
      B. probeCloudFacingZero
```

欄位定義：

```text
 1. sourceFacingZero
      代表 shading point 的 normal 看不到 Cloud sample。
      shader 對應：
        cloudSourceCos = max(0.0, dot(nl, cloudDir))

 2. normalCloudFacingZero
      代表正常 C3 畫面能量用的 Cloud normal 看不到 shading point。
      shader 對應：
        normalEmissionNormal = cloudArcNormal(rodIdx, theta)
        normalCloudCos = max(0.0, dot(-cloudDir, normalEmissionNormal))

 3. probeCloudFacingZero
      代表 probe 分類用的反向 Cloud normal 看不到 shading point。
      shader 對應：
        probeEmissionNormal = cloudArcEmissionNormal(rodIdx, theta)
        probeCloudCos = max(0.0, dot(-cloudDir, probeEmissionNormal))

 4. zeroCloudFacing
      舊 mode3 selected-class 名稱。
      目前語意對齊 probeCloudFacingZero，保留作舊指令相容欄位。
```

本次量測結果：

```text
 1. mode3 zeroCloudFacing selectedClassRatio
      180 samples = 0.2107
      判讀：回到 v5a wait-fix2 基準附近。

 2. mode4 facing diagnostic
      sourceFacingZeroRatio = 0.1457
      normalCloudFacingZeroRatio = 0.6851
      probeCloudFacingZeroRatio = 0.1692
      normalMinusProbeFacingZeroRatio = 0.5159

 3. C3 正常亮度 A/B
      舊 v4-probe-only baseline avgLuma = 0.274360
      新 mode4-facing-diagnostic avgLuma = 0.274307
      差值 = -0.000053
      判讀：mode4 診斷沒有污染正常 C3 亮度。
```

mode4 theta scan 快速診斷：

```text
 1. 測試條件
      targetSamples = 8
      thetaBinCount = 8
      configRadio = 3
      Cloud on、Track off、Wide off
      Cloud slider = 1600 lm/m
      waitTimedOut 全部 false

 2. 每段結果
      thetaLabel  normalCloudFacingZeroRatio  probeCloudFacingZeroRatio  normalMinusProbeFacingZeroRatio
      0/8         0.4634                      0.2617                     0.2017
      1/8         0.4743                      0.2505                     0.2238
      2/8         0.4901                      0.2347                     0.2554
      3/8         0.5047                      0.2201                     0.2846
      4/8         0.5165                      0.2081                     0.3084
      5/8         0.5258                      0.1990                     0.3268
      6/8         0.5325                      0.1923                     0.3402
      7/8         0.5295                      0.1951                     0.3344

 3. 判讀
      normal/probe 差距從 0/8 到 6/8 逐步變大，7/8 仍維持高差距。
      這代表差距跟 Cloud 弧面角度有明顯關係，後續若要碰 PDF / 面積 / MIS，先用這張表當定位入口。
```

mode4 theta scan 自動摘要 helper：

```text
 1. 新增目的
      reportCloudFacingDiagnosticThetaScanAfterSamples(...) 回傳 summary。
      summary 會自動整理 minDiffBin、maxDiffBin、ratio range、diffTrend。

 2. 真頁面快速驗證
      pageUrl = http://localhost:9003/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-visibility-probe-mode4-facing-theta-scan
      probeVersion = r6-3-phase2-mode4-facing-theta-scan
      targetSamples = 8
      thetaBinCount = 8
      waitTimedOutCount = 0

 3. 摘要結果
      minDiffBin = 0/8
      minDiffValue = 0.2015
      maxDiffBin = 6/8
      maxDiffValue = 0.3402
      diffTrend = risesAndStaysHigh
      normalMinusProbeFacingZeroRatioRange.spread = 0.1387

 4. 判讀方式
      minDiffBin 代表 normal/probe 差距最小的角度段。
      maxDiffBin 代表 normal/probe 差距最大的角度段。
      diffTrend = risesAndStaysHigh 代表差距往後段變大，最後一段仍留在高差距區。
```

mode4 theta geometry hint：

```text
 1. 新增目的
      summary.geometryHint 會把 theta bin 對應到 Cloud 弧面 normal 方向。
      這讓 6/8 最大差距可以接回幾何原因，而不只是一張數字表。

 2. 真頁面快速驗證
      pageUrl = http://localhost:9003/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-visibility-probe-mode4-facing-geometry-hint
      probeVersion = r6-3-phase2-mode4-facing-geometry-hint
      targetSamples = 8
      thetaBinCount = 8
      waitTimedOutCount = 0

 3. 幾何摘要
      cloudArcNormalFormula = outAxis * cos(theta) + up * sin(theta)
      cloudArcEmissionNormalRelation = -cloudArcNormal
      normalUpwardTrend = increasesWithTheta
      highUpwardBinStart = 6
      maxNormalUpwardBin = 7/8
      maxDiffNearHighUpwardEnd = true

 4. 對照結果
      minDiffBin = 0/8
      maxDiffBin = 6/8
      6/8 的 normalUpward = 0.9569
      7/8 的 normalUpward = 0.9952
      判讀：差距最大段落在 normal 向上成分很高的區域。
      6/8 比 7/8 稍高，代表場景內的 shade point 分布也有影響。
```

mode4 rod-by-rod theta scan 快速診斷：

```text
 1. 新增目的
      reportCloudFacingDiagnosticRodThetaScanAfterSamples(...) 會逐支跑 E/W/S/N。
      用途是判斷 6/8 高差距來自共同弧面角度，或某支 Cloud 燈條特別高。

 2. 真頁面快速驗證
      pageUrl = http://localhost:9003/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-visibility-probe-mode4-facing-rod-theta-scan
      probeVersion = r6-3-phase2-mode4-facing-rod-theta-scan
      targetSamples = 2
      thetaBinCount = 8
      waitTimedOutCount = 0 for E/W/S/N

 3. 每支最大差距
      E maxDiffBin = 6/8, maxDiffValue = 0.2278
      W maxDiffBin = 6/8, maxDiffValue = 0.2242
      S maxDiffBin = 6/8, maxDiffValue = 0.2171
      N maxDiffBin = 6/8, maxDiffValue = 0.2376

 4. 總摘要
      uniqueMaxDiffBins = [6]
      sharedMaxDiffBin = 6
      maxDiffBinPattern = same
      allRodsMaxDiffNearHighUpwardEnd = true
      dominantRod = N
      maxDiffValueRange.spread = 0.0205

 5. 判讀
      四支 Cloud 的最大差距都落在 6/8。
      這表示主要方向是共同弧面角度問題。
      N 的數字最高，但四支最大差距 spread 只有 0.0205，先當次要線索。
      這輪 targetSamples = 2，只用來看型態；精密數值仍要用較高 samples 重跑。
      8 samples × 32 段超過 CDP 等待時間，後續若要精密版，需分批跑每支或提高 CDP timeout。
```

後續 SOP：

```text
 1. 若任務是看正常 C3 畫面能量：
      先看 renderEnergyNormal = cloudArcNormal。

 2. 若任務是看 probe 分類：
      先看 probeClassificationNormal = cloudArcEmissionNormal。

 3. 若任務是比較兩種 normal 的差距：
      使用 window.reportCloudFacingDiagnosticAfterSamples(...)
      讀取 normalCloudFacingZeroRatio 與 probeCloudFacingZeroRatio。

 4. 若任務是看兩種 normal 的差距集中在哪些角度：
      使用 window.reportCloudFacingDiagnosticThetaScanAfterSamples(-1, 8, 200, 120000)
      先讀取 summary，再看 geometryHint 與每個 theta bin 的 normalCloudFacingZeroRatio、probeCloudFacingZeroRatio、normalMinusProbeFacingZeroRatio。

 5. 若任務是分別看四支 Cloud：
      使用 window.reportCloudFacingDiagnosticRodThetaScanAfterSamples(8, 2, 120000)
      先讀 summary.maxDiffByRod、summary.sharedMaxDiffBin、summary.maxDiffBinPattern。
      targetSamples = 2 只適合快速看型態。
      需要精密比較時，改成分批跑單支 rod 的 theta scan。

 6. 若舊文件或舊 Console 指令提到 zeroCloudFacing：
      當成 legacy probe-facing 名稱。
      新報告要同步列 probeCloudFacingZero，避免名稱誤導。

 7. 任何 Cloud NEE / normal / PDF / MIS 改動後，仍要同時跑：
      A. mode3 或 mode4 probe 數字
      B. probe off 的 C3 正常亮度 A/B
```

theta importance candidate probe-only helper（2026-05-04）：

```text
 1. 新增目的
      summarizeCloudThetaImportanceSamplingCandidate(scan)
      用上一輪 rod-by-rod theta scan 的結果，產生一份「角度抽樣候選表」。
      這份表目前只做分析，不改正式 C3 畫面，不改 shader。

 2. 安全邊界
      analysisScope = probeOnlyThetaImportanceCandidate
      renderPathMutation = false
      shaderMutation = false
      metric = normalMinusProbeFacingZeroRatio
      renderEnergyNormal = cloudArcNormal
      probeClassificationNormal = cloudArcEmissionNormal
      requiresThetaPdfCompensation = true
      protectedFloor = 0.65

 3. TDD 與版本
      先讓 docs/tests/r6-3-cloud-facing-diagnostic.test.js 紅燈：
        JS missing theta-importance candidate version label
      補 JS helper 與 cache token 後轉綠。
      script token = js/Home_Studio.js?v=r6-3-cloud-visibility-probe-theta-importance-candidate
      probeVersion = r6-3-phase2-theta-importance-candidate
      candidateVersion = r6-3-phase2-theta-importance-candidate-v1

 4. 真頁面驗證前置
      pageUrl = http://localhost:9004/Home_Studio.html
      必須先切到 applyPanelConfig(3) 與 switchCamera('cam1')。
      若用新開頁面的預設 config 1 跑，theta 結果會全平，不能拿來判讀 C3。

 5. 真頁面 C3/cam1 快速驗證
      targetSamples = 2
      thetaBinCount = 8
      waitTimedOutCount = 0 for E/W/S/N

      E maxDiffBin = 6/8, maxDiffValue = 0.2278
      W maxDiffBin = 7/8, maxDiffValue = 0.2326
      S maxDiffBin = 6/8, maxDiffValue = 0.2171
      N maxDiffBin = 6/8, maxDiffValue = 0.2376

      uniqueMaxDiffBins = [6, 7]
      maxDiffBinPattern = mixed
      allRodsMaxDiffNearHighUpwardEnd = true
      dominantRod = N
      maxDiffValueRange.spread = 0.0205

 6. candidate 計算結果
      maxPdfCompensationMultiplier = 1.1956
      maxReductionBin = 6/8
      6/8 averageNormalMinusProbeFacingZeroRatio = 0.2267
      6/8 relativeToUniform = 0.8364
      6/8 pdfCompensationMultiplier = 1.1956

      reducedBins:
        3/8 relativeToUniform = 0.9721
        4/8 relativeToUniform = 0.9132
        5/8 relativeToUniform = 0.8740
        6/8 relativeToUniform = 0.8364
        7/8 relativeToUniform = 0.8455

      boostedBins:
        0/8 relativeToUniform = 1.2868
        1/8 relativeToUniform = 1.2007
        2/8 relativeToUniform = 1.0713

 7. 判讀
      這輪確認：有機會針對高向上角度做 importance sampling 候選。
      最大 PDF 補償約 1.1956，屬於溫和候選。
      目前只代表「可進入 probe-only A/B」，還不能直接上正式 C3 shader。

 8. 下一步 SOP
      A. 做 probe-only A/B helper：同一份 C3/cam1 場景，輸出 uniform theta 與 candidate theta 的預估表。
      B. A/B helper 必須明列每個 theta bin 的 candidateThetaBinPdf 與 pdfCompensationMultiplier。
      C. 若 probe-only A/B 通過，再做 shader A/B。
      D. shader A/B 通過後，才做 probe off 的 C3 正常亮度 A/B。
```

theta importance probe-only A/B helper（2026-05-04）：

```text
 1. 新增目的
      summarizeCloudThetaImportanceProbeAB(scan)
      用同一份 rod-by-rod theta scan，同時輸出：
        A. uniformTheta baseline
        B. thetaImportanceCandidate candidate

      這是估算工具，不改正式 C3 畫面，不改 shader。

 2. 安全邊界
      analysisScope = probeOnlyThetaImportanceAB
      renderPathMutation = false
      shaderMutation = false
      baselineStrategy = uniformTheta
      candidateStrategy = thetaImportanceCandidate
      estimateBasis = rodThetaScanBinAverages
      metric = normalMinusProbeFacingZeroRatio

 3. TDD 與版本
      先讓 docs/tests/r6-3-cloud-facing-diagnostic.test.js 紅燈：
        JS missing theta-importance probe-only A/B version label
      補 JS helper 與 cache token 後轉綠。
      script token = js/Home_Studio.js?v=r6-3-cloud-visibility-probe-theta-importance-probe-ab
      probeVersion = r6-3-phase2-theta-importance-probe-ab
      abVersion = r6-3-phase2-theta-importance-probe-ab-v1

 4. 真頁面 C3/cam1 快速驗證
      pageUrl = http://localhost:9004/Home_Studio.html
      前置狀態：
        applyPanelConfig(3)
        switchCamera('cam1')

      targetSamples = 2
      thetaBinCount = 8
      waitTimedOutCount = 0 for E/W/S/N

      E maxDiffBin = 6/8, maxDiffValue = 0.2392
      W maxDiffBin = 6/8, maxDiffValue = 0.2349
      S maxDiffBin = 6/8, maxDiffValue = 0.2290
      N maxDiffBin = 6/8, maxDiffValue = 0.2491

      uniqueMaxDiffBins = [6]
      sharedMaxDiffBin = 6
      maxDiffBinPattern = same
      allRodsMaxDiffNearHighUpwardEnd = true
      dominantRod = N
      maxDiffValueRange.spread = 0.0201

 5. candidate 抽樣比例
      maxReductionBin = 6/8
      maxPdfCompensationMultiplier = 1.2354

      6/8:
        averageNormalMinusProbeFacingZeroRatio = 0.2380
        candidateToUniformSampleRatio = 0.8095
        pdfCompensationMultiplier = 1.2354

      7/8:
        averageNormalMinusProbeFacingZeroRatio = 0.2240
        candidateToUniformSampleRatio = 0.8848
        pdfCompensationMultiplier = 1.1302

 6. A/B 估算結果
      estimatedUniformWasteProxy = 0.202625
      estimatedCandidateWasteProxy = 0.198770
      estimatedWasteProxyDelta = 0.003855
      estimatedWasteProxyReductionRatio = 0.0190

 7. 判讀
      A/B helper 工作正常，也再次確認 6/8 是共同高差距角度。
      candidate 會把抽樣從 6/8、7/8 移到 0/8、1/8、2/8。
      最大 PDF 補償 1.2354，仍屬溫和範圍。
      估算下降比例約 1.9%，幅度偏小。
      這表示方向可繼續，但不能期待下一輪馬上有很大的肉眼改善。

 8. 下一步 SOP
      A. 先做 candidate strength sweep，仍維持 probe-only。
      B. strength sweep 比較 protectedFloor = 0.50 / 0.65 / 0.80。
      C. 每個版本都列 maxPdfCompensationMultiplier 與 estimatedWasteProxyReductionRatio。
      D. 若較強版本仍只有小幅改善，再評估 shader A/B 是否值得做。
      E. 若某個版本明顯改善且 PDF 補償不爆衝，再進 shader A/B。
```

theta importance strength sweep probe-only helper（2026-05-04）：

```text
 1. 新增目的
      summarizeCloudThetaImportanceStrengthSweep(scan)
      用同一份 rod-by-rod theta scan 比較三個 protectedFloor：
        0.50 / 0.65 / 0.80

      這是 probe-only 估算工具，不改正式 C3 畫面，不改 shader。

 2. 安全邊界
      analysisScope = probeOnlyThetaImportanceStrengthSweep
      renderPathMutation = false
      shaderMutation = false
      baselineStrategy = uniformTheta
      candidateStrategy = thetaImportanceCandidate
      estimateBasis = rodThetaScanBinAverages
      recommendedNextStep = reviewStrengthSweepBeforeShaderAB

 3. TDD 與版本
      先讓 docs/tests/r6-3-cloud-facing-diagnostic.test.js 紅燈：
        JS missing theta-importance strength sweep version label
      補 JS helper 與 cache token 後轉綠。
      script token = js/Home_Studio.js?v=r6-3-cloud-visibility-probe-theta-importance-strength-sweep
      probeVersion = r6-3-phase2-theta-importance-strength-sweep
      sweepVersion = r6-3-phase2-theta-importance-strength-sweep-v1

 4. 真頁面 C3/cam1 快速驗證
      pageUrl = http://localhost:9004/Home_Studio.html
      前置狀態：
        applyPanelConfig(3)
        switchCamera('cam1')

      targetSamples = 2
      thetaBinCount = 8
      waitTimedOutCount = 0 for E/W/S/N

      E maxDiffBin = 5/8, maxDiffValue = 0.2282
      W maxDiffBin = 6/8, maxDiffValue = 0.2242
      S maxDiffBin = 7/8, maxDiffValue = 0.2221
      N maxDiffBin = 6/8, maxDiffValue = 0.2376

      uniqueMaxDiffBins = [5, 6, 7]
      sharedMaxDiffBin = null
      maxDiffBinPattern = mixed
      allRodsMaxDiffNearHighUpwardEnd = false
      dominantRod = N
      maxDiffValueRange.spread = 0.0155

 5. strength sweep 結果
      protectedFloor = 0.50
        estimatedWasteProxyReductionRatio = 0.0325
        maxPdfCompensationMultiplier = 1.3716
        maxReductionBin = 6/8
        candidateToUniformSampleRatio = 0.7291

      protectedFloor = 0.65
        estimatedWasteProxyReductionRatio = 0.0200
        maxPdfCompensationMultiplier = 1.2001
        maxReductionBin = 6/8
        candidateToUniformSampleRatio = 0.8333

      protectedFloor = 0.80
        estimatedWasteProxyReductionRatio = 0.0102
        maxPdfCompensationMultiplier = 1.0929
        maxReductionBin = 6/8
        candidateToUniformSampleRatio = 0.9150

 6. 判讀
      0.50 是目前最佳 probe-only 候選，預估下降約 3.25%。
      PDF 補償最高到 1.3716，仍在可做 shader A/B 的觀察範圍內。
      0.65 較保守，預估下降約 2.00%。
      0.80 很保守，預估下降約 1.02%。
      這輪快速 scan 的 rod max bin 從前一輪 same 變 mixed，後續 shader A/B 需要保留正常亮度與肉眼噪點驗收。

 7. 下一步 SOP
      A. 做 shader A/B 候選，protectedFloor 先採 0.50。
      B. shader A/B 必須明列 theta PDF 與補償倍率。
      C. 預設保留原本 uniform theta 作為 A 組。
      D. B 組只開在可回退的 debug flag 或版本 token 內。
      E. shader A/B 後要做 C3/cam1 肉眼驗收：
           1. 亮度不能變暗或漂白。
           2. Cloud 早期噪點若有改善，才進更長 spp 比對。
           3. 若肉眼無改善，這條路徑標 no-go。
```

theta importance shader A/B 候選（2026-05-04）：

```text
 1. 新增目的
      把上一輪 protectedFloor = 0.50 的 theta importance candidate 放進 shader。
      A 組維持原本 uniform theta。
      B 組用 debug flag 開啟 theta importance candidate。
      這一輪只建立可切換版本與亮度安全證據，肉眼噪點改善另外驗收。

 2. 安全邊界
      uCloudThetaImportanceShaderABMode = 0 為預設值。
      window.setCloudThetaImportanceShaderAB(0) 進 A 組。
      window.setCloudThetaImportanceShaderAB(1) 進 B 組。
      B 組畫面左下 camera info 會出現 CloudTheta: B0.50。

 3. PDF 補償契約
      B 組 theta bin PDF：
        [0.182214, 0.164555, 0.139731, 0.124376, 0.108893, 0.094690, 0.091107, 0.094434]

      B 組補償倍率：
        [0.6860, 0.7596, 0.8946, 1.0050, 1.1479, 1.3201, 1.3720, 1.3237]

      NEE throughput 使用 cloudPdfArea：
        throughput = cloudEmit * cloudGeom * cloudPdfArea / selectPdf

      pdfNeeForLight 正向與 reverse MIS 也使用 cloudPdfArea / reverseCloudPdfArea。
      這代表抽樣比例改變時，亮度權重同步補回來。

 4. TDD 與版本
      先讓 docs/tests/r6-3-cloud-facing-diagnostic.test.js 紅燈：
        JS missing theta-importance shader A/B version label

      先讓 docs/tests/r3-5b-cloud-area-nee.test.js 紅燈：
        Cloud NEE missing effective area with theta PDF compensation

      補 JS helper、shader helper、cache token 後轉綠。

      script token = js/Home_Studio.js?v=r6-3-cloud-visibility-probe-theta-importance-shader-ab
      shader token = Home_Studio_Fragment.glsl?v=r6-3-cloud-visibility-probe-theta-importance-shader-ab
      sourceProbeVersion = r6-3-phase2-theta-importance-shader-ab
      shaderABVersion = r6-3-phase2-theta-importance-shader-ab-v1

 5. 真頁面 C3/cam1 64 spp screenshot 驗證
      pageUrl = http://localhost:9004/Home_Studio.html
      configRadio = 3
      camera = cam1
      Cloud = on
      Track = off
      Wide = off
      activeLightCount = 4
      activeLightIndex = [7, 8, 9, 10]

      A 組：
        screenshotPath = /private/tmp/home_studio_theta_ab_cam1_64_A.png
        shaderABMode = 0
        modeLabel = uniformThetaBaseline
        samples = 66
        cameraInfo = FPS: 0 / FOV: 55 / Samples: 65 / 耗時: 02m29s

      B 組：
        screenshotPath = /private/tmp/home_studio_theta_ab_cam1_64_B.png
        shaderABMode = 1
        modeLabel = thetaImportanceCandidateProtectedFloor050
        samples = 65
        cameraInfo = FPS: 0 / FOV: 55 / Samples: 64 / 耗時: 02m23s / CloudTheta: B0.50

 6. screenshot PNG luma
      A full.avgLuma = 0.289289
      B full.avgLuma = 0.287709
      delta = -0.001580

      A roomCenter.avgLuma = 0.420130
      B roomCenter.avgLuma = 0.417592
      delta = -0.002538

      A cloudArea.avgLuma = 0.392840
      B cloudArea.avgLuma = 0.390498
      delta = -0.002342

      判讀：
        B 組沒有黑畫面。
        B 組亮度與 A 組接近。
        這次沒有重演 v4/v5b 的 C3 正常畫面亮度污染。

 7. 下一步 SOP
      A. 請使用者肉眼比較 A 組與 B 組。
      B. 驗收重點：
           1. B 組左下角要顯示 CloudTheta: B0.50。
           2. B 組整體亮度不能明顯變暗。
           3. B 組整體亮度不能明顯漂白。
           4. B 組 Cloud 早期噪點若有改善，再進長時間 A/B。
      C. 若 B 組肉眼有改善且亮度正常，下一輪做 200 / 500 spp screenshot A/B。
      D. 若 B 組肉眼無改善，這條 shader A/B 路線標 no-go。
```

theta importance shader A/B 肉眼 no-go（2026-05-04）：

```text
 1. 使用者驗收
      使用者提供 48 spp A / B0.50 對照圖：
        /Users/eajrockmacmini/Downloads/260504-cam1-default-48spp A.png
        /Users/eajrockmacmini/Downloads/260504-cam1-default-48spp B.png

      使用者判斷：
        48 SPP A 跟 B0.5 幾乎一樣，沒改善。

 2. 數字對照
      A full.avgLuma = 0.435436
      B full.avgLuma = 0.433194
      delta = -0.002242

      A roomCenter.avgLuma = 0.401842
      B roomCenter.avgLuma = 0.399848
      delta = -0.001994

      A cloudArea.avgLuma = 0.611325
      B cloudArea.avgLuma = 0.607842
      delta = -0.003483

      highFreqDelta：
        full = -0.001087
        roomCenter = -0.001250
        cloudArea = -0.000374

 3. 判讀
      B0.50 沒有明顯污染 C3 亮度。
      B0.50 也沒有造成可用的 C3 早期噪點改善。
      protectedFloor = 0.50 theta-importance shader A/B 路線標 no-go。

 4. 下一步 SOP
      A. 改查 C3 active light pool。
      B. 改查 Cloud 與其他燈的抽樣競爭。
      C. 改查 Cloud MIS 權重套用點。
      D. 改查直接 NEE 與間接反彈哪段更可疑。
```

Cloud sampling budget diagnostic（2026-05-04）：

```text
 1. 新增目的
      reportCloudSamplingBudgetDiagnostic()
      用現有 uniform / active light LUT 回答四個問題：
        A. Cloud light 被抽到的比例夠不夠。
        B. Cloud 跟其他燈的選擇權重有沒有讓 C3 太吃虧。
        C. MIS 權重在哪些 Cloud 路徑套用。
        D. 直接光跟間接反彈要如何隔離。

      這是 JS 診斷 helper。
      renderPathMutation = false
      shaderMutation = false

 2. TDD 與版本
      先讓 docs/tests/r6-3-cloud-sampling-budget-diagnostic.test.js 紅燈：
        JS missing Cloud sampling budget diagnostic version label

      補 helper 與 cache token 後轉綠。

      script token = js/Home_Studio.js?v=r6-3-cloud-visibility-probe-sampling-budget-diagnostic
      shader token = Home_Studio_Fragment.glsl?v=r6-3-cloud-visibility-probe-sampling-budget-diagnostic
      probeVersion = r6-3-phase2-sampling-budget-diagnostic
      diagnosticVersion = r6-3-phase2-sampling-budget-diagnostic-v1

 3. 真頁面 C3/cam1 診斷
      pageUrl = http://localhost:9004/Home_Studio.html
      currentPanelConfig = 3
      activeLightCount = 4
      activeLightIndex = [7, 8, 9, 10]
      activeLightBreakdown:
        ceiling = 0
        track = 0
        wide = 0
        cloud = 4

      cloudPickRatio = 1.000000
      perCloudRodPickRatio = 0.250000
      otherLightPickRatio = 0.000000
      selectPdf = 0.25
      otherLightsCompeteWithCloud = false
      c3CloudSampleBudgetVerdict = cloudOwnsActivePool

 4. 四個問題的目前答案
      A. Cloud light 被抽到的比例夠不夠：
           C3 裡 Cloud 佔 active pool 100%。
           每支 rod 25%。

      B. Cloud 跟其他燈的選擇權重有沒有讓 C3 太吃虧：
           C3 裡其他燈沒有進 active pool。
           這一輪證據不支持「其他燈吃掉 Cloud 抽樣」。

      C. MIS 權重有沒有讓有效樣本被稀釋：
           Cloud direct NEE 使用：
             wNee = powerHeuristic(pNee, pBsdf)

           Cloud BSDF hit reverse MIS 使用：
             wBsdf = powerHeuristic(pBsdf, pNeeReverse)

           目前已定位套用點。
           權重分布尚未量化，下一輪需做 MIS weight histogram / heat probe。

      D. 直接光跟間接反彈哪一段在製造主要顆粒：
           使用 uIndirectMultiplier 做快速隔離：
             baseline = 1
             directOnly = 0

           8 spp screenshot：
             baseline path = /private/tmp/home_studio_sampling_budget_baseline_indirect1_8.png
             directOnly path = /private/tmp/home_studio_sampling_budget_direct_only_8.png

           full.avgLuma:
             baseline = 0.224045
             directOnly = 0.115403

           roomCenter.avgLuma:
             baseline = 0.347328
             directOnly = 0.232511

           cloudArea.avgLuma:
             baseline = 0.369614
             directOnly = 0.348745

           highFreq：
             full baseline = 0.039583
             full directOnly = 0.021028
             roomCenter baseline = 0.040482
             roomCenter directOnly = 0.017664
             cloudArea baseline = 0.022661
             cloudArea directOnly = 0.018231

 5. 判讀
      C3 採樣名額分配本身看起來正常。
      C3 主要問題不像是 Cloud 被抽太少。
      直接 NEE 跟反彈段關聯要繼續拆。
      8 spp 快速隔離顯示，房間中間區的顆粒與間接反彈有明顯關聯。
      Cloud 區域亮度在 directOnly 下接近 baseline，表示 Cloud 直射區仍要另外看 MIS 權重與可見命中率。

 6. 下一步 SOP
      A. 做 Cloud MIS weight probe。
      B. 分開輸出：
           direct NEE wNee
           BSDF-hit reverse wBsdf
           pNee / pBsdf 比值區間
      C. 若 wNee 長期偏低，查 pNee 面積 PDF 或 pBsdf 估算。
      D. 若 reverse wBsdf 分布造成少量高能樣本，查間接反彈路徑。
```

Cloud MIS weight probe（2026-05-04）：

```text
 1. 新增目的
      reportCloudMisWeightProbeAfterSamples()
      用 Console helper 量 C3 Cloud 兩段 MIS：
        A. direct NEE：
             wNee = powerHeuristic(pNee, pBsdf)
        B. BSDF-hit reverse：
             wBsdf = powerHeuristic(pBsdf, pNeeReverse)

      probe 預設 mode = 0。
      mode = 0 時正常渲染不走診斷輸出。

 2. 實作護欄
      新增 shader uniform：
        uCloudMisWeightProbeMode

      新增 4 個讀回模式：
        1 = directNeeWeight
        2 = directNeePdf
        3 = bsdfHitWeight
        4 = bsdfHitPdf

      後續發現 raw bsdfHitWeight channel 會混到 PDF channel 型資料。
      主報告改用 PDF 比值反推穩定 MIS 權重：
        direct NEE:
          weight = ratio^2 / (ratio^2 + 1)
          ratio = pNee / pBsdf

        BSDF-hit:
          weight = 1 / (ratio^2 + 1)
          ratio = pNeeReverse / pBsdf

      raw channel 仍保留在：
        directNeeWeightChannelAverage
        bsdfHitWeightChannelAverage

 3. 真頁面條件
      pageUrl = http://127.0.0.1:9004/Home_Studio.html
      currentPanelConfig = 3
      currentCameraPreset = cam1
      mode = 趨近真實
      currentIndirectMultiplier = 1
      currentMaxBounces = 14
      targetSamples = 4 isolated samples

 4. 真頁面結果
      activeLightCount = 4
      activeLightIndex = [7, 8, 9, 10]
      cloudPickRatio = 1
      otherLightPickRatio = 0

      directNeeAverageWeight = 1
      directNeeAveragePdfRatio = 44993661.245384
      directNeeAveragePnee = 7062341
      directNeeAveragePbsdf = 0.156963
      directNeeEventMass = 2057211.683012

      bsdfHitAverageWeight = 0.264908
      bsdfHitAveragePdfRatio = 1.6658
      bsdfHitAveragePneeReverse = 4.042537
      bsdfHitAveragePbsdf = 2.426785
      bsdfHitEventMass = 6719.683012

 5. 判讀
      C3 Cloud direct NEE 權重接近 1，沒有被 MIS 稀釋。
      C3 Cloud BSDF-hit reverse 權重約 0.265，會被 MIS 壓低。
      BSDF-hit eventMass 比 direct NEE eventMass 小很多。
      目前證據指向：
        C3 主要顆粒更像來自間接反彈 / 少量 BSDF-hit 路徑。
        Cloud 抽燈名額不足與其他燈競爭可先排後。

 6. 下一步 SOP
      A. 不優先改 direct NEE。
      B. 先做 BSDF-hit / indirect isolation patch。
      C. 候選方向：
           提高間接段對 Cloud 的有效命中率。
           或把 BSDF-hit reverse MIS 的 PDF 契約拆更細。
      D. 每個候選改動都要先用 probe 量，再做 48 spp 肉眼驗收。
```

BSDF-hit contribution probe smoke（2026-05-05）：

```text
 1. 新增目的
      在原本 Cloud MIS weight probe 上補兩個 contribution 讀回模式：
        directNeeContribution
        bsdfHitContribution

      目標是先量「實際亮度貢獻量」，再決定 BSDF-hit / indirect 要不要進 patch。

 2. 實作護欄
      新增 uCloudContributionProbeMode，將 contribution 讀回跟原本 MIS weight / PDF 讀回分開。
      mode = 0 時正常渲染維持原狀。
      report 會輸出：
        directNeeContributionMass
        bsdfHitContributionMass
        bsdfHitContributionAliasedToPdf
        bsdfHitContributionReadbackReliable

 3. 真頁面 1 sample smoke
      pageUrl = http://127.0.0.1:9004/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-bsdf-hit-contribution-probe-v4
      shaderFile = Home_Studio_Fragment.glsl?v=r6-3-cloud-bsdf-hit-contribution-probe-v2
      currentPanelConfig = 3
      currentCameraPreset = cam1
      activeLightIndex = [7, 8, 9, 10]
      currentIndirectMultiplier = 1
      currentMaxBounces = 14

      directNeeContributionMass = 262644.639078
      directNeeAverageContributionLuma = 0.5106808
      directNeeAverageUnweightedContributionLuma = 0.7632675

      bsdfHitContributionMass = 2798.411238
      bsdfHitAverageContributionLuma = 1.6658
      bsdfHitAverageUnweightedContributionLuma = 0.4120678
      bsdfHitContributionAliasedToPdf = true
      bsdfHitContributionPhysicallyPlausible = false
      bsdfHitContributionReadbackReliable = false

 4. 判讀
      directNeeContribution 讀回可用。
      BSDF-hit contribution 讀回目前會跟 BSDF PDF channel 同形。
      因此 BSDF-hit contribution 欄位目前只能當「讀回失敗警示」，不能拿來判斷畫面噪點或修法方向。

 5. 下一步 SOP
      A. 先修 BSDF-hit contribution 讀回隔離。
      B. 修好後重跑 reportCloudMisWeightProbeAfterSamples(1, 120000) smoke。
      C. smoke 顯示 bsdfHitContributionReadbackReliable = true 後，再跑 4 samples。
      D. 4 samples 通過後，再決定是否進 48 spp 肉眼 A/B。
```

BSDF-hit contribution sentinel v6 追查（2026-05-05）：

```text
 1. 追查目的
      使用者手動 report 顯示：
        directNeeContribution 可讀。
        bsdfHitContributionReadbackReliable = false。
        bsdfHitContribution channel 仍與 BSDF PDF 同形。

      因此新增 probe-only sentinel，先確認問題卡在哪一層。

 2. 新增 probe-only 模式
      mode 7 = bsdfHitContributionSentinel
        預期每個有效 BSDF-hit Cloud event 輸出：
          r/g = 0.125
          b/g = 0.5

      mode 8 = probeUniformSentinel
        預期整張圖輸出：
          r/g = 0.25
          b/g = 0.75

      mode 9 = contributionUniformSentinel
        預期整張圖輸出：
          r/g = 0.375
          b/g = 0.875

 3. 真頁面 1 sample smoke
      pageUrl = http://127.0.0.1:9004/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-bsdf-hit-contribution-sentinel-v6
      shaderFile = Home_Studio_Fragment.glsl?v=r6-3-cloud-bsdf-hit-contribution-sentinel-v6
      currentPanelConfig = 3
      currentCameraPreset = cam1
      activeLightIndex = [7, 8, 9, 10]

      probeUniformSentinelPass = true
      contributionUniformSentinelPass = true
      bsdfHitContributionSentinelPass = false

      raw mode 7:
        actualMisUniformMode = 7
        actualContributionUniformMode = 3
        channelMass = { r: 2798.411238, g: 1679.920753, b: 692.241295 }
        averageContributionLuma = 1.6658
        averageUnweightedContributionLuma = 0.4120678

      normal report mode 6:
        bsdfHitContributionAliasedToPdf = true
        bsdfHitContributionPhysicallyPlausible = false
        bsdfHitContributionReadbackReliable = false

 4. 判讀
      mode 8 通過，代表主 probe mode uniform 與 readback 是活的。
      mode 9 通過，代表 contribution uniform 與 readback 是活的。
      mode 7 失敗，且 raw mode 7 仍讀成 BSDF PDF channel。
      mode 3、mode 6、mode 7 目前都會讀到同一組 BSDF PDF 形狀。

      可用結論：
        direct Cloud NEE contribution 讀回可用。
        BSDF-hit contribution 讀回仍不可用。
        BSDF-hit contribution 欄位目前只能當故障警示，不能拿來判斷修法方向。

 5. 下一步 SOP
      A. 先查 BSDF-hit probe readback 為何固定掉到 PDF channel。
      B. 不准用 bsdfHitContributionMass 或 bsdfHitAverageContributionLuma 做亮度修法。
      C. 修到 mode 7 sentinel 通過後，才恢復 mode 6 contribution 判讀。
      D. mode 6 顯示 bsdfHitContributionReadbackReliable = true 後，再進 4 samples 與 48 spp 肉眼 A/B。
```

BSDF-hit terminal isolation v7 追查（2026-05-05）：

```text
 1. 追查目的
      v6 mode 7 讀到的 1.675999 形狀原先看似 BSDF PDF。
      追加暫時 shader patch 後確認：
        A. mode 7 放到 CalculateRadiance() 開頭可正確輸出 sentinel。
        B. mode 8 / mode 9 uniform sentinel 仍正常。
        C. 關掉非 Cloud 終端顏色後，mode 7 的 1.675999 假訊號消失。

 2. 根因
      BSDF-hit mode3 / mode4 / mode6 / mode7 讀回混入正常畫面的終端顏色。
      主要污染來源是：
        A. BACKDROP branch 的貼圖顏色
        B. LAMP_SHELL branch 的 specular terminal emission

      因此 v6 的：
        bsdfHitAverageWeight
        bsdfHitAveragePdfRatio
        bsdfHitContributionMass
        bsdfHitAverageContributionLuma
      都不可用。

 3. v7 修法
      probe mode 開啟時，禁止上述非 Cloud 終端顏色寫入 readback：
        if (hitType == BACKDROP) 且 uCloudMisWeightProbeMode > 0 時直接 break。
        if (hitType == LAMP_SHELL && bounceIsSpecular == TRUE) 且 uCloudMisWeightProbeMode > 0 時直接 break。

      JS 判讀同步補強：
        A. zero-event BSDF PDF 不再算 alias。
        B. null PDF ratio 不再推導成 BSDF weight = 1。
        C. sentinel report 增加：
             bsdfHitContributionSentinelNoEvent
             bsdfHitContributionSentinelContaminated

 4. 真頁面 v7 smoke
      pageUrl = http://127.0.0.1:9004/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-bsdf-hit-terminal-isolation-v7
      shaderFile = Home_Studio_Fragment.glsl?v=r6-3-cloud-bsdf-hit-terminal-isolation-v7

      reportCloudBsdfContributionSentinelAfterSamples(1, 120000):
        probeUniformSentinelPass = true
        contributionUniformSentinelPass = true
        bsdfHitContributionSentinelPass = false
        bsdfHitContributionSentinelNoEvent = true
        bsdfHitContributionSentinelContaminated = false
        mode7 eventMass = 0

      reportCloudMisWeightProbeAfterSamples(1, 120000):
        directNeeAverageWeight = 1
        directNeeAveragePdfRatio = 45951758.143125
        directNeeContributionMass = 259846.227839
        bsdfHitAverageWeight = null
        bsdfHitEventMass = 0
        bsdfHitAveragePdfRatio = null
        bsdfHitContributionMass = 0
        bsdfHitContributionObserved = false
        bsdfHitPdfObserved = false
        bsdfHitContributionAliasedToPdf = false
        bsdfHitContributionReadbackReliable = false

 5. 判讀
      v7 已清掉 BSDF-hit probe 的假訊號。
      目前 1 isolated sample 沒觀察到真正的 BSDF-hit Cloud event。
      所以現在不能用 BSDF-hit contribution 欄位做亮度修法。

 6. 下一步 SOP
      A. 增加 isolated samples，確認真 BSDF-hit event 是否只是太少。
      B. 若仍沒有 event，新增 forced-BSDF-hit probe。
      C. forced probe 能穩定打進 Cloud 後，再恢復 mode6 contribution 判讀。
      D. mode6 真的觀察到 event 且 readbackReliable = true 後，再進 4 samples 與 48 spp 肉眼 A/B。
```

Forced BSDF-hit probe v8b（2026-05-05）：

```text
 1. 新增目的
      v7 已清掉 BSDF-hit probe 的終端顏色污染。
      使用者實測 1 samples 與 4 samples 都沒有自然 BSDF-hit Cloud event：
        bsdfHitEventMass = 0
        bsdfHitContributionReadbackReliable = false

      因此新增 forced analytic BSDF-hit probe：
        reportForcedCloudBsdfHitProbeAfterSamples()

      目的不是量自然命中頻率。
      目的只是在 probe-only 路徑強制產生一個 Cloud BSDF-hit 分析樣本，
      先確認 BSDF-hit 權重 / PDF / contribution 編碼與 readback 能穩定工作。

 2. 實作護欄
      新增 mode labels：
        10 = forcedBsdfHitSentinel
        11 = forcedBsdfHitContribution
        12 = forcedBsdfHitPdf
        13 = forcedBsdfHitWeight

      forced helper：
        cloudMisWeightProbeForcedBsdfHit()

      scope：
        forcedAnalyticBsdfHitIgnoresOcclusion = true

      這代表它只測「如果 BSDF-hit 到 Cloud，PDF / 權重 / contribution 怎麼算」。
      它不測自然隨機樣本多久會打到 Cloud。

 3. 真頁面條件
      pageUrl = http://127.0.0.1:9004/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-forced-bsdf-hit-v8b
      shaderFile = Home_Studio_Fragment.glsl?v=r6-3-cloud-forced-bsdf-hit-v8b
      currentPanelConfig = 3
      currentCameraPreset = cam1
      activeLightIndex = [7, 8, 9, 10]

 4. 真頁面結果
      reportForcedCloudBsdfHitProbeAfterSamples(1, 120000):
        forcedBsdfHitEventObserved = true
        forcedSentinelPass = true
        forcedBsdfHitAverageWeight = 0.004869
        forcedBsdfHitDerivedWeightFromAveragePdfRatio = 0
        forcedBsdfHitWeightChannelAverage = 0.004869
        forcedBsdfHitAveragePdfRatio = 1639.395956
        forcedBsdfHitContributionMass = 69711.185801
        forcedBsdfHitAverageContributionLuma = 0.1665238
        forcedBsdfHitAverageUnweightedContributionLuma = 38.55344

      same page natural report:
        directNeeAverageWeight = 1
        directNeeAveragePdfRatio = 43637709.640688
        directNeeEventMass = 1058252
        directNeeContributionMass = 1214002.240876
        bsdfHitAverageWeight = null
        bsdfHitAveragePdfRatio = null
        bsdfHitEventMass = 0
        bsdfHitContributionMass = 0
        bsdfHitContributionReadbackReliable = false

 5. 判讀
      forced probe 已能穩定打進 Cloud BSDF-hit 分析路徑。
      sentinel 通過，代表 forced BSDF-hit branch 與 readback 活著。
      自然 4 samples 仍沒有 BSDF-hit event，代表自然命中頻率極低或目前樣本太少。

      forced path 的權重很低：
        forcedBsdfHitAverageWeight = 0.004869

      PDF 比值很大：
        forcedBsdfHitAveragePdfRatio = 1639.395956

      注意：
        forcedBsdfHitDerivedWeightFromAveragePdfRatio = 0
      這是因為「先平均 PDF ratio 再推權重」會被極端比值壓到 6 位小數以下。
      目前以 forcedBsdfHitWeightChannelAverage / forcedBsdfHitAverageWeight 為主要判讀。

 6. 下一步 SOP
      A. 不回頭使用 v6 / v7 之前的 bsdfHitAverageWeight 舊污染讀值。
      B. 先把自然 BSDF-hit 稀有程度量清楚：
           增加 isolated samples，或新增自然事件計數專用 probe。
      C. 若自然事件長期接近 0：
           C3 早期髒感主因更可能是 direct NEE 可見性 / 間接 diffuse cleanup tail，
           而不是大量 BSDF-hit contribution。
      D. 若自然事件在更高 samples 才出現：
           用 forced v8b 的 PDF / 權重欄位當公式參考，再設計自然 event histogram。
```

Natural BSDF-hit frequency probe v9（2026-05-05）：

```text
 1. 新增目的
      v8b 已證明：
        A. forced BSDF-hit probe 可以穩定打進 Cloud BSDF-hit 分析路徑。
        B. forced BSDF-hit 權重很低。
        C. 但 forced probe 不量自然出現頻率。

      因此 v9 新增：
        reportNaturalCloudBsdfHitFrequencyAfterSamples()

      目標是直接回答：
        自然隨機渲染裡，Cloud BSDF-hit 到底多久出現一次。

 2. 實作護欄
      使用既有自然 sentinel mode：
        mode 7 = bsdfHitContributionSentinel

      先跑 forced mode 10 當參考：
        forcedReferencePass 必須為 true。

      再跑自然 sentinel plan：
        [1, 4, 16, 64]

      報告欄位：
        naturalBsdfHitFrequencyPlan
        naturalBsdfHitObserved
        naturalBsdfHitFirstObservedAtSamples
        naturalBsdfHitNoEventUpToSamples
        naturalBsdfHitEventMass
        naturalBsdfHitEventsPerIsolatedSample
        naturalBsdfHitEventRatePerPixelSample

 3. 真頁面條件
      pageUrl = http://127.0.0.1:9004/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-natural-bsdf-frequency-v9
      shaderFile = Home_Studio_Fragment.glsl?v=r6-3-cloud-natural-bsdf-frequency-v9
      currentPanelConfig = 3
      currentCameraPreset = cam1
      activeLightIndex = [7, 8, 9, 10]

 4. 真頁面結果
      reportNaturalCloudBsdfHitFrequencyAfterSamples([1, 4, 16, 64], 120000):
        forcedReferencePass = true
        naturalBsdfHitObserved = false
        naturalBsdfHitFirstObservedAtSamples = null
        naturalBsdfHitNoEventUpToSamples = 64
        naturalBsdfHitEventMass = 0
        naturalBsdfHitEventsPerIsolatedSample = 0
        naturalBsdfHitEventRatePerPixelSample = 0

      rows:
        1 samples  -> eventMass = 0, noEvent = true, contaminated = false
        4 samples  -> eventMass = 0, noEvent = true, contaminated = false
        16 samples -> eventMass = 0, noEvent = true, contaminated = false
        64 samples -> eventMass = 0, noEvent = true, contaminated = false

      same page forced reference:
        forcedBsdfHitEventObserved = true
        forcedSentinelPass = true
        forcedBsdfHitAverageWeight = 0.004869
        forcedBsdfHitAveragePdfRatio = 1639.395956
        forcedBsdfHitContributionMass = 69711.185801
        forcedBsdfHitAverageContributionLuma = 0.1665238
        forcedBsdfHitAverageUnweightedContributionLuma = 38.55344

 5. 判讀
      forcedReferencePass = true，代表工具與讀回仍正常。
      自然 sentinel 到 64 isolated samples 仍是 0 event。
      這代表 Cloud BSDF-hit 在目前 C3 / cam1 條件下非常稀有。

      因此：
        A. 不應再把 v6 / v7 之前的 bsdfHitAverageWeight 舊污染讀值當依據。
        B. Cloud BSDF-hit 不適合當目前 C3 早期髒點主嫌。
        C. 下一輪優先回到 direct NEE 可見性、間接 diffuse cleanup tail、或其他自然頻率較高的路徑。

 6. 下一步 SOP
      A. 若還要保留 BSDF-hit 線，最多跑更大的自然 plan：
           [128, 256]
         但 ROI 變低。

      B. 主線建議改查：
           direct NEE 可見 / 不可見事件的貢獻分布
           indirect diffuse tail 的空間分布
           8 / 16 / 48 spp 亮點座標是否固定

      C. 每一條新線仍要維持：
           probe-only
           normal render mode = 0
           先量測，再做肉眼 A/B
```

Direct NEE screen-band probe v10（2026-05-05）：

```text
 1. 新增目的
      使用者追問早期觀察：
        Cloud 打出去的光靠近畫面上方時，髒感比較重。

      v9 已把自然 Cloud BSDF-hit 降優先度：
        naturalBsdfHitEventMass = 0
        naturalBsdfHitNoEventUpToSamples = 64

      因此 v10 回到 direct NEE：
        reportCloudDirectNeeScreenBandProbeAfterSamples()

      目標：
        把畫面分成 top / upperMid / lowerMid / bottom 四段，
        直接量 Cloud direct NEE contribution 是否集中在畫面上方。

 2. 實作護欄
      JS-only helper，沿用既有 mode 5：
        directNeeContribution

      沒有修改 normal render。
      沒有新增 shader branch。
      新增 uniform sentinel 分帶檢查：
        uniformBandSentinelPass

      若 uniform sentinel 通過，代表分帶讀回方向與 buffer 對齊。

 3. 真頁面條件
      pageUrl = http://127.0.0.1:9004/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-direct-nee-screen-bands-v10
      shaderFile = Home_Studio_Fragment.glsl?v=r6-3-cloud-direct-nee-screen-bands-v10
      currentPanelConfig = 3
      currentCameraPreset = cam1
      activeLightIndex = [7, 8, 9, 10]

 4. 真頁面結果
      reportCloudDirectNeeScreenBandProbeAfterSamples(64, 120000):
        uniformBandSentinelPass = true
        directNeeTotal.eventMass = 16932032
        directNeeTotal.contributionMass = 19424035.854042
        directNeeTotal.averageContributionLuma = 1.147177

      top:
        eventMass = 5296448
        contributionMass = 10593673.056151
        averageContributionLuma = 2.000147
        contributionShare = 0.54539
        eventShare = 0.312806
        averageContributionLift = 1.743538

      upperMid:
        eventMass = 5834432
        contributionMass = 5199963.20296
        averageContributionLuma = 0.8912544
        contributionShare = 0.267708
        eventShare = 0.34458

      lowerMid:
        eventMass = 3266752
        contributionMass = 1717297.169004
        averageContributionLuma = 0.5256895
        contributionShare = 0.088411
        eventShare = 0.192933

      bottom:
        eventMass = 2534400
        contributionMass = 1913102.425926
        averageContributionLuma = 0.7548542
        contributionShare = 0.098491
        eventShare = 0.149681

      derived:
        topVsBottomAverageContributionRatio = 2.649713
        topContributionLiftVsEvents = 1.743541
        topBandContributionDominatesEvents = true
        topAverageContributionDominatesBottom = true

      BSDF frequency regression on same page:
        forcedReferencePass = true
        naturalBsdfHitObserved = false
        naturalBsdfHitNoEventUpToSamples = 64
        naturalBsdfHitEventMass = 0

 5. 判讀
      這次取得新的可量化證據：
        top 1/4 畫面只佔約 31.3% direct NEE events，
        卻佔約 54.5% direct NEE weighted contribution。

      top 每次事件平均亮度約為 bottom 的 2.65 倍。

      所以上方髒感路線目前指向：
        direct NEE contribution spatial concentration

      這比繼續追自然 BSDF-hit 更有價值，因為同頁 v9 regression 仍是 0 event。

 6. 下一步 SOP
      A. 先用使用者 Console 驗收 v10：
           await reportCloudDirectNeeScreenBandProbeAfterSamples(64, 120000)

      B. 驗收重點：
           uniformBandSentinelPass 要是 true。
           topContributionShare 約 0.545。
           topEventShare 約 0.313。
           topVsBottomAverageContributionRatio 約 2.65。

      C. 下一輪建議：
           針對 top band 做 hotspot / percentile probe，
           再決定要做 Cloud direct NEE 多樣本、分層抽樣，或保留物理亮度但加快收斂。
```

Direct NEE screen-band probe v10 使用者驗收補記（2026-05-05）：

```text
 1. 使用者真頁面驗收
      command:
        await reportCloudDirectNeeScreenBandProbeAfterSamples(64, 120000)

      script token:
        Home_Studio.js?v=r6-3-cloud-direct-nee-screen-bands-v10

      table:
        top:
          eventMass = 34439808
          contributionMass = 42246025.511841
          averageContributionLuma = 1.226663
          contributionShare = 0.593603
          eventShare = 0.262761
          averageContributionLift = 2.259101

        upperMid:
          eventMass = 38079488
          contributionMass = 16611670.949211
          averageContributionLuma = 0.4362367
          contributionShare = 0.233412
          eventShare = 0.29053
          averageContributionLift = 0.803401

        lowerMid:
          eventMass = 30555136
          contributionMass = 6098551.40605
          averageContributionLuma = 0.1995917
          contributionShare = 0.085691
          eventShare = 0.233122
          averageContributionLift = 0.367581

        bottom:
          eventMass = 27994688
          contributionMass = 6212613.045704
          averageContributionLuma = 0.2219211
          contributionShare = 0.087294
          eventShare = 0.213587
          averageContributionLift = 0.408704

      derived:
        topVsBottomAverageContributionRatio = 5.527474
        topContributionLiftVsEvents = 2.259099

 2. 使用者追問後的判讀修正
      使用者指出：
        Cloud 燈具本來在上方，上方自然會比較亮。
        Cloud 燈條很細，直射光自然也容易變成少數樣本。

      因此 v10 的結論要收斂成：
        A. v10 支持「上方 direct NEE 貢獻集中」。
        B. 這個現象符合細長燈條的物理直覺。
        C. v10 本身不構成修法依據。
        D. 下一步要量的是「少數高亮樣本是否拖慢早期收斂」。

 3. probe 目前看的是什麼
      mode 5 / reportCloudDirectNeeScreenBandProbeAfterSamples() 量的是：
        Cloud direct NEE hit 事件。
        事件必須命中 Cloud rod。
        contribution 會包含接收點的 path mask 與 wNee。
        分帶依最後畫面 pixel 的位置切 top / upperMid / lowerMid / bottom。

      目前尚未拆開：
        primary-surface Cloud NEE
        bounced-surface Cloud NEE

      這代表 v10 已經看進接收者 path mask，
      但還不能回答「第一次看到的表面」與「反彈後表面」各自佔多少。

 4. 需要避開的地雷
      A. 不把「上方比較亮」當成 bug。
      B. 不把 v10 解讀成 Cloud 亮度公式錯。
      C. 不回頭使用 v7 前 BSDF-hit 污染讀值。
      D. 不重跑 Phase 1A / 1B target-shape no-go 路線。
      E. 不先上大型後處理遮掉現象。

 5. 目前 ROI 最高項目
      第一順位：
        top band hotspot / percentile probe

      要量：
        p50 / p90 / p99 / max contribution
        top band 裡少數樣本是否主導 contributionMass

      第二順位：
        direct NEE diffuseCount split probe

      要分：
        primary-surface Cloud NEE
        bounced-surface Cloud NEE

      判讀：
        primary 主導 → 細長燈條 direct sampling 問題。
        bounced 主導 → indirect diffuse cleanup tail 問題。

 6. 未來實驗路徑
      A. 先做 top band hotspot / percentile probe。
      B. 再做 primary / bounced split。
      C. 依結果選 Cloud direct NEE 多抽、4 rod 分層輪抽，或 indirect cleanup tail 追查。
      D. 每次修法只做最小 A/B。
      E. 驗收看 8 / 16 / 48 spp，並確認 1024 spp 不偏離既有畫面。
```

Direct NEE top-band percentile probe v11（2026-05-05）：

```text
 1. 新增目的
      v10 已確認 top 1/4 畫面的 Cloud direct NEE weighted contribution 高度集中。
      使用者提醒：Cloud 燈具本來就在上方，上方較亮符合物理直覺。

      因此 v11 的問題改成：
        top band 裡面，是整段一起偏亮，
        還是少數超亮 direct NEE events 拉高平均值。

 2. 實作護欄
      新增 JS-only helper：
        reportCloudDirectNeeTopBandPercentileProbeAfterSamples()

      沿用既有 mode 5：
        directNeeContribution

      沒有新增 shader branch。
      沒有修改 normal render。
      新增 uniformTopBandSentinelPass，確認 top band readback 與 contribution encoding 正常。

      分位數使用 log2 histogram 估算：
        p50 / p90 / p99 / max

 3. 真頁面條件
      pageUrl = http://127.0.0.1:9004/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-direct-nee-top-band-percentiles-v11
      currentPanelConfig = 3
      currentCameraPreset = cam1
      targetSamples = 64

 4. 真頁面結果
      reportCloudDirectNeeTopBandPercentileProbeAfterSamples(64, 120000):
        version = r6-3-phase2-cloud-direct-nee-top-band-percentiles-v11
        analysisScope = cloudDirectNeeTopBandPercentileProbe
        renderPathMutation = false
        probeShaderMutation = false
        normalRenderProbeMode = 0
        uniformTopBandSentinelPass = true

      topBand:
        activePixels = 5296448
        eventMass = 5296448
        contributionMass = 10593673.056151
        averageContributionLuma = 2.000147
        averageUnweightedContributionLuma = 3.071524

      topBandContributionPercentiles:
        method = log2Histogram
        p50 = 0.1886456
        p90 = 4.087589
        p99 = 38.88792
        max = 165.7287
        min = 0

      ratios:
        topBandP90ToP50Ratio = 21.668086
        topBandP99ToP50Ratio = 206.142735
        topBandHotspotDominanceRatio = 878.518767
        topBandHotspotDominatesMedian = true
        topBandP99DominatesMedian = true

 5. 判讀
      top band 的典型 direct NEE event 偏低：
        p50 = 0.1886456

      top band 的亮尾端非常高：
        p99 = 38.88792
        max = 165.7287

      p99 約為 p50 的 206 倍。
      max 約為 p50 的 879 倍。

      這輪結果支持：
        C3 Cloud 上方早期髒感主要來自少數超亮 direct NEE events。

      這輪結果也表示：
        v10 的 top contribution concentration 具有明顯亮尾端。
        目前要追「哪些 surface / bounce state 產生這些超亮 direct NEE events」。

 6. 下一步 SOP
      A. 做 direct NEE diffuseCount split probe。
      B. 把 Cloud direct NEE 分成：
           primary-surface Cloud NEE
           bounced-surface Cloud NEE
      C. 若 primary 主導：
           先試 Cloud direct NEE 多抽 / 4 rod 分層輪抽 / top band targeted sampling。
      D. 若 bounced 主導：
           先查天花板 / 牆面 indirect diffuse cleanup tail。
      E. 每個候選修法仍維持：
           probe-only 先量測
           再做 8 / 16 / 48 spp 肉眼 A/B
           1024 spp 不偏離既有畫面
```

Direct NEE diffuseCount split probe v12（2026-05-05）：

```text
 1. 新增目的
      v11 已確認 top band 有少數超亮 direct NEE events。

      v12 的問題是：
        這些 Cloud direct NEE 貢獻主要發生在第一次看到的表面，
        還是反彈後才看到的表面。

 2. 實作護欄
      新增 helper：
        reportCloudDirectNeeDiffuseCountSplitProbeAfterSamples()

      量測分成三組：
        allDirectNeeContribution
        primaryDirectNeeContribution
        bouncedDirectNeeContribution

      probe branch 使用：
        uCloudContributionProbeMode = 4 → diffuseCount == 0
        uCloudContributionProbeMode = 5 → diffuseCount >= 1

      normal render 維持：
        normalRenderProbeMode = 0
        renderPathMutation = false

      shader 只新增 probe-only 分流。

 3. 真頁面條件
      pageUrl = http://127.0.0.1:9004/Home_Studio.html
      scriptSrc = js/Home_Studio.js?v=r6-3-cloud-direct-nee-diffuse-count-split-v12
      currentPanelConfig = 3
      currentCameraPreset = cam1

 4. 真頁面結果
      reportCloudDirectNeeDiffuseCountSplitProbeAfterSamples(8, 120000):
        version = r6-3-phase2-cloud-direct-nee-diffuse-count-split-v12
        analysisScope = cloudDirectNeeDiffuseCountSplitProbe
        renderPathMutation = false
        probeShaderMutation = true
        normalRenderProbeMode = 0
        targetSamples = 8

      allDirectNeeContribution:
        activePixels = 2116504
        eventMass = 2116504
        contributionMass = 2428004.481752
        averageContributionLuma = 1.147177
        averageUnweightedContributionLuma = 1.759664

      primaryDirectNeeContribution:
        activePixels = 0
        eventMass = 0
        contributionMass = 0

      bouncedDirectNeeContribution:
        activePixels = 2116504
        eventMass = 2116504
        contributionMass = 2428004.481752
        averageContributionLuma = 1.147177
        averageUnweightedContributionLuma = 1.759664

      ratios:
        primaryContributionShare = 0
        bouncedContributionShare = 1
        primaryVsBouncedContributionRatio = 0
        splitVsAllContributionRatio = 1
        splitMassMatchesAllContribution = true
        dominantDirectNeeSurfaceClass = bouncedSurface
        recommendedNextStep = inspectIndirectDiffuseCloudNeeTail

      使用者端 Console 驗收補記：
        command = await reportCloudDirectNeeDiffuseCountSplitProbeAfterSamples(8, 120000)
        script token = Home_Studio.js?v=r6-3-cloud-direct-nee-diffuse-count-split-v12
        allContributionMass = 8896107.614104
        primaryContributionMass = 0
        bouncedContributionMass = 8896107.614104
        splitContributionMass = 8896107.614104
        primaryContributionShare = 0
        bouncedContributionShare = 1
        primaryVsBouncedContributionRatio = 0
        splitVsAllContributionRatio = 1
        dominantDirectNeeSurfaceClass = bouncedSurface

 5. 判讀
      8 samples 下，Cloud direct NEE contribution 全部落在 bounced-surface 分流。

      splitVsAllContributionRatio = 1，代表 primary + bounced 分流總量與 all direct NEE 相符。

      使用者端驗收與自動化實頁驗證比例一致：
        primary = 0
        bounced = 1
        split/all = 1

      目前最高 ROI 已從 Cloud direct NEE primary sampling 轉到：
        indirect diffuse cleanup tail

 6. 下一步 SOP
      A. 做 bounced direct NEE hotspot / surface-class probe。
      B. 優先分辨是天花板、北牆、東牆、西牆或 acoustic panel 拉出亮尾端。
      C. 若單一表面類別主導：
           先做局部 sampling / clamp candidate。
      D. 若多表面平均分散：
           先查 indirect diffuse path mask 分布。
      E. 每個候選修法仍維持：
           probe-only 先量測
           8 / 16 / 48 spp 肉眼 A/B
           1024 spp 不偏離既有畫面
```

Bounced direct NEE floor/GIK 與 receiver-class probe v13/v14（2026-05-05）：

```text
 1. 觸發原因
      使用者看圖指出：
        髒點看起來地板與 GIK 板最多。

      v12 已確認 C3 Cloud direct NEE contribution 全部落在 bounced-surface。
      因此先做 floor + GIK priority probe，再把剩餘 otherSurface 拆成 ceiling / wall / object。

 2. v13 floor/GIK priority probe
      新增 helper：
        reportCloudBouncedDirectNeeFloorGikProbeAfterSamples()

      分類：
        floorBouncedSurface = uCloudContributionProbeMode 6
        gikBouncedSurface = uCloudContributionProbeMode 7
        otherBouncedSurface = uCloudContributionProbeMode 8

      實頁條件：
        pageUrl = http://127.0.0.1:9004/Home_Studio.html
        scriptSrc = js/Home_Studio.js?v=r6-3-cloud-bounced-nee-floor-gik-v13
        currentPanelConfig = 3
        currentCameraPreset = cam1
        targetSamples = 1

      實頁結果：
        bouncedContributionMass = 303500.560219
        floorContributionMass = 174.911961
        gikContributionMass = 1474.276134
        otherContributionMass = 301851.372125
        floorContributionShare = 0.000576
        gikContributionShare = 0.004858
        otherContributionShare = 0.994566
        floorPlusGikContributionShare = 0.005434
        classifiedVsBouncedContributionRatio = 1
        dominantBouncedDirectNeeReceiverClass = otherSurface

      判讀：
        使用者肉眼看到地板 / GIK 板附近髒。
        但 energy contribution 主體落在 otherSurface。
        需要把 otherSurface 再拆細。

 3. v14 receiver-class probe
      新增 helper：
        reportCloudBouncedDirectNeeReceiverClassProbeAfterSamples()

      分類：
        floor = uCloudContributionProbeMode 6
        gikPanel = uCloudContributionProbeMode 7
        ceiling = uCloudContributionProbeMode 9
        wall = uCloudContributionProbeMode 10
        object = uCloudContributionProbeMode 11

      實頁條件：
        pageUrl = http://127.0.0.1:9004/Home_Studio.html
        scriptSrc = js/Home_Studio.js?v=r6-3-cloud-bounced-nee-receiver-class-v14
        currentPanelConfig = 3
        currentCameraPreset = cam1
        targetSamples = 4

      實頁結果：
        bouncedContributionMass = 1214002.240876
        classifiedContributionMass = 1214002.240876
        classifiedVsBouncedContributionRatio = 1

        classMasses:
          floor = 699.647844
          gikPanel = 5897.104536
          ceiling = 771758.441084
          wall = 417358.017508
          object = 18289.029904

        receiverClassShares:
          floor = 0.000576
          gikPanel = 0.004858
          ceiling = 0.635714
          wall = 0.343787
          object = 0.015065

        dominantBouncedDirectNeeReceiverClass = ceiling
        dominantReceiverClassContributionShare = 0.635714
        recommendedNextStep = testCeilingBouncedNeeCleanupCandidate

 4. 白話判讀
      看圖最髒的位置像是在地板與 GIK 板。
      量測顯示製造 Cloud bounced direct NEE 亮尾端的主要接收面是 ceiling，其次是 wall。

      目前比例：
        ceiling 約 63.6%
        wall 約 34.4%
        floor + GIK 約 0.54%

      這代表：
        畫面髒點會出現在地板 / GIK 板附近，
        但高亮 contribution 的主要來源是天花板與牆面接收 Cloud 後的 bounced NEE。

 4b. 使用者修正與判讀降級
      使用者指出：
        反彈光總 contribution 最大來自天花板，其次是牆壁，這符合直覺。
        這和「地板 / GIK 可見螢火蟲很多」是不同問題。

      因此 v14 判讀降級為：
        A. receiver-class probe 證明分類讀值路徑有接對。
        B. classifiedVsBouncedContributionRatio = 1 主要是儀器檢查。
        C. ceiling / wall 佔比最大主要確認常識與分類沒有明顯錯位。
        D. v14 沒有回答地板 / GIK 可見 firefly 密度。

      後續規則：
        如果 probe 只是確認 uniform、cache-bust、readback、分類加總或分類是否錯位，
        必須在回報中明講「這是儀器檢查」。
        不得把儀器檢查無限上綱成任務已解決。
        需要另做 visible-surface firefly / hotspot probe，依第一眼可見表面分類異常高亮點。

 4c. v15 visible-surface hotspot probe
      新增 helper：
        reportCloudVisibleSurfaceHotspotProbeAfterSamples()

      分類：
        floor = uCloudContributionProbeMode 12 / visiblePixelMode 17
        gikPanel = uCloudContributionProbeMode 13 / visiblePixelMode 18
        ceiling = uCloudContributionProbeMode 14 / visiblePixelMode 19
        wall = uCloudContributionProbeMode 15 / visiblePixelMode 20
        object = uCloudContributionProbeMode 16 / visiblePixelMode 21

      實頁條件：
        pageUrl = http://127.0.0.1:9004/Home_Studio.html
        scriptSrc = js/Home_Studio.js?v=r6-3-cloud-visible-surface-hotspot-v15
        currentPanelConfig = 3
        currentCameraPreset = cam1
        targetSamples = 8

      實頁結果：
        dominantVisibleSurfaceHotspotClass = ceiling
        dominantVisibleSurfaceHotspotDensity = 0.079704
        floorGikHotspotPixelDensity = 0.036074
        floorGikHotspotPixelCount = 73616
        floorGikVisiblePixelSamples = 2040704

        ceiling:
          hotspotPixelDensity = 0.079704
          p50 = 0.1454656
          p99 = 52.66418
          max = 67.18923
          maxToP50Ratio = 461.890853

        wall:
          hotspotPixelDensity = 0.057561
          p50 = 0.1074137
          p99 = 12.07332
          max = 165.7287
          maxToP50Ratio = 1542.900952

        gikPanel:
          hotspotPixelDensity = 0.043426
          p50 = 0.01231235
          p99 = 6.303923
          max = 58.44717
          maxToP50Ratio = 4747.036106

        object:
          hotspotPixelDensity = 0.039702
          p50 = 0.02804233
          p99 = 7.496671
          max = 124.8972
          maxToP50Ratio = 4453.880972

        floor:
          hotspotPixelDensity = 0.023925
          p50 = 0.06116075
          p99 = 26.33209
          max = 82.06091
          maxToP50Ratio = 1341.725044

      判讀：
        以每個可見像素的異常高亮密度看，天花板最高，牆面第二。
        GIK 板密度第三，但 maxToP50Ratio 最高。
        白話說：GIK 板平常偏暗，亮點一冒出來就特別刺眼，所以肉眼會覺得它很髒。
        地板也有亮點，但每個可見像素的異常高亮密度最低。

      限制：
        targetSamples = 8 與 targetSamples = 4 呈現等倍放大。
        目前 v15 可用來比較同一張隔離樣本內的表面排序。
        目前不能拿來證明跨隨機樣本的穩定性。
        若下一步要確認穩定性，需要補能推進隨機樣本的讀回方式。

 4d. v16 dark visible-surface source probe
      新增 helper：
        reportCloudDarkVisibleSurfaceHotspotSourceProbeAfterSamples()

      目的：
        只看肉眼髒的暗表面 floor / GIK。
        拆它們的亮點是由哪一類反彈來源製造。

      實頁條件：
        pageUrl = http://127.0.0.1:9004/Home_Studio.html
        scriptSrc = js/Home_Studio.js?v=r6-3-cloud-dark-visible-source-v16
        currentPanelConfig = 3
        currentCameraPreset = cam1
        targetSamples = 4

      共同可見表面門檻：
        floor = 0.6116075
        gikPanel = 0.1231235

      實頁結果：
        dominantDarkVisibleSurfaceHotspotSource:
          visibleSurface = gikPanel
          sourceSurface = ceiling
          absoluteHotspotPixelDensity = 0.016336

        groupedByVisibleSurface:
          floor:
            dominantSourceSurface = ceiling
            dominantSourceAbsoluteHotspotPixelDensity = 0.015659

          gikPanel:
            dominantSourceSurface = ceiling
            dominantSourceAbsoluteHotspotPixelDensity = 0.016336

        floor 來源排序：
          ceiling = 0.015659
          wall = 0.007882
          object = 0.00025
          gikPanel = 0.000135
          floor = 0

        GIK 來源排序：
          ceiling = 0.016336
          wall = 0.01324
          gikPanel = 0.012799
          object = 0.001051
          floor = 0

      判讀：
        天花板可見表面本身不一定異常。
        但天花板作為反彈來源時，確實會在 GIK / 地板暗表面製造尖峰亮點。
        牆面是第二來源。
        因此修法不應壓天花板本身，應壓「暗可見表面上，由天花板 / 牆面來源造成的尖峰」。

 4e. v16 dark visible-surface cleanup candidate
      新增 helper：
        setCloudDarkSurfaceCleanupCandidate()
        reportCloudDarkSurfaceCleanupCandidateAfterSamples()

      候選範圍：
        visible surface = floor 或 GIK
        source surface = ceiling 或 wall
        clamp luma = 1.0
        default = off

      實頁條件：
        reportCloudDarkSurfaceCleanupCandidateAfterSamples(4, 120000, 1.0)

      結果：
        floor:
          baselineHotspotPixelDensity = 0.023925
          candidateHotspotPixelDensity = 0.023925
          hotspotDensityReductionRatio = 0
          baselineP99 = 26.33209
          candidateP99 = 1.021897
          p99ReductionRatio = 0.961192
          baselineMax = 82.06091
          candidateMax = 5.912088
          maxReductionRatio = 0.927955

        gikPanel:
          baselineHotspotPixelDensity = 0.043426
          candidateHotspotPixelDensity = 0.043426
          hotspotDensityReductionRatio = 0
          baselineP99 = 6.303923
          candidateP99 = 1.021897
          p99ReductionRatio = 0.837895
          baselineMax = 58.44717
          candidateMax = 1.867045
          maxReductionRatio = 0.968056

        ceiling / wall / object:
          p99ReductionRatio = 0
          maxReductionRatio = 0

      判讀：
        這個候選沒有減少亮點顆數。
        它降低的是亮點尖銳程度。
        目前數據顯示對 floor / GIK 的 p99 與 max 有明顯壓制。
        目前數據顯示可見 ceiling / wall / object 未被影響。

      低 SPP 圖面驗證：
        已輸出：
          /private/tmp/home_studio_cleanup_off_16spp.png
          /private/tmp/home_studio_cleanup_on_16spp.png

      下一步：
        使用者肉眼檢查 8 / 16 / 48 SPP。
        若接受，再跑 256 / 1024 SPP 高採樣保護。

 4f. 使用者肉眼 no-go 與方向修正
      使用者回報：
        v16 cleanup candidate 雖然消掉部分亮點，
        但 GIK 變土色，地板變霧面。
        觀感像把物體該有的反光硬拔掉，只剩泥土感。

      判定：
        v16 hard clamp cleanup candidate = NO-GO。
        此候選只能作為診斷證據，不能進正常 render。

      新判讀：
        低 SPP 髒感可能主要來自正常亮色出來太慢。
        一開始畫面有很多暗點，少數像素先抽到正常亮光，
        人眼會把「暗點太多 + 局部正常亮點」看成髒點。
        時間拉長後，亮樣本慢慢補齊，暗點變少，最後畫面才接近正確光照。

      新方向：
        亮樣本覆蓋率。

      要回答的問題：
        GIK / 地板在低 SPP 時，有多少像素已經抽到該有亮度？
        同一片 GIK / 地板上，有多少像素還沒抽到該有亮度？
        問題主要是亮點太尖，還是暗點太多、亮度補得太慢？

      下一個最高 ROI：
        A. 找出同一片 GIK / 地板上，哪些像素已經抽到正常亮光。
        B. 用附近相似像素的資訊，補給還沒抽到亮度的暗像素。
        C. 用法線、材質、距離守門，避免跨邊界把牆光抹到物件上。
        D. 只在低 SPP 開強一點，SPP 變高後慢慢退場。

      回報紀律：
        這條線要直接回答低 SPP 降噪。
        若只是在確認資料通道、分類、readback、cache-bust 或數值是否接對，
        必須明講「這是儀器檢查」。
        不得把儀器檢查包裝成已改善畫面。

 4g. v17 bright sample coverage probe
      新增 helper：
        reportCloudBrightSampleCoverageProbeAfterSamples()

      目的：
        量 floor / GIK 低 SPP 時，已抽到正常 Cloud NEE 亮度的可見樣本比例。
        同時量還在等亮度補齊的比例。

      實頁條件：
        pageUrl = http://127.0.0.1:9005/Home_Studio.html
        scriptSrc = js/Home_Studio.js?v=r6-3-cloud-bright-sample-coverage-v17
        currentPanelConfig = 3
        currentCameraPreset = cam1
        targetSamples = 4
        resultJson = /private/tmp/home_studio_coverage_probe_c3_result.json

      實頁結果：
        floor + GIK:
          visiblePixelSamples = 1020352
          medianBrightPixelCount = 89664
          medianBrightCoverage = 0.087876
          darkWaitingShareAtMedian = 0.912124
          strongBrightCoverage = 0.017833
          darkWaitingShareAtStrong = 0.982167

        floor:
          visiblePixelSamples = 384696
          contributionEventSamples = 49464
          contributionEventDensity = 0.128579
          normalBrightThreshold = 0.06116075
          medianBrightCoverage = 0.064612
          darkWaitingShareAtMedian = 0.935388
          maxToP50Ratio = 1341.725044
          coverageVerdict = coverageInsufficient

        gikPanel:
          visiblePixelSamples = 635656
          contributionEventSamples = 129296
          contributionEventDensity = 0.203406
          normalBrightThreshold = 0.01231235
          medianBrightCoverage = 0.101955
          darkWaitingShareAtMedian = 0.898045
          maxToP50Ratio = 4747.036106
          coverageVerdict = coverageInsufficient

      交叉檢查：
        C1 預設頁面跑同一 helper 時，floor / GIK 皆沒有 Cloud NEE 事件。
        切回 C3 後，p50 / p99 / max 對上 v15 visible-surface hotspot probe 的既有數字。
        因此 v17 helper 沒有重算亮度分布，它新增的是可見樣本覆蓋率分母與覆蓋率判讀。

      判讀：
        floor / GIK 可見樣本很多，但已拿到一般亮度的比例很低。
        合計只有約 8.8% 可見樣本拿到同片表面一般 Cloud NEE 亮度。
        約 91.2% 可見樣本仍在等亮度補齊。
        這支持低 SPP 髒感主要來自正常亮樣本覆蓋不足。
        v16 hard clamp 會破壞材質觀感；下一步改做補暗候選。

      下一步：
        設計 guarded same-surface dark-fill candidate。
        候選必須預設關閉，先用 A/B toggle 驗證。
        作用範圍先限制 floor / GIK。
        借樣條件需守住同片表面、相似法線、相似材質、近距離。
        低 SPP 作用較強，SPP 增加後退場。

 4h. v18a same-surface dark-fill candidate
      新增 helper：
        setCloudSameSurfaceDarkFillCandidate()
        reportCloudSameSurfaceDarkFillCandidateAfterSamples()

      目的：
        針對 floor / GIK 上已經有 Cloud NEE 事件、但亮度仍低於該表面一般亮度的樣本，
        把它往該表面一般亮度補一點。
        候選預設關閉。
        只在低 SPP 早期作用，SPP 增加後退場。

      守門：
        visible surface 只限 floor / GIK。
        只作用 diffuse bounce 後的 Cloud NEE contribution。
        使用 sampleCounter fade：
          strength = 1.0
          maxSamples = 64
        補光目標：
          baseline measured p50 * 1.25

      實頁條件：
        pageUrl = http://127.0.0.1:9005/Home_Studio.html
        scriptSrc = js/Home_Studio.js?v=r6-3-cloud-same-surface-dark-fill-v18a
        currentPanelConfig = 3
        currentCameraPreset = cam1
        targetSamples = 4
        resultJson = /private/tmp/home_studio_same_surface_dark_fill_c3_v18a_result.json

      實頁結果：
        medianBrightCoverageLiftAverage = 0.029199
        candidatePassesFirstMetric = true

        floor:
          baselineMedianBrightCoverage = 0.064612
          candidateMedianBrightCoverageAtBaselineThreshold = 0.094298
          medianBrightCoverageLift = 0.029686
          darkWaitingShareReductionRatio = 0.031737
          candidateMaxToP50Ratio = 1080.417537

        gikPanel:
          baselineMedianBrightCoverage = 0.101955
          candidateMedianBrightCoverageAtBaselineThreshold = 0.130668
          medianBrightCoverageLift = 0.028713
          darkWaitingShareReductionRatio = 0.031973
          candidateMaxToP50Ratio = 3822.527385

      判讀：
        v18a 有把 floor / GIK 的一般亮度覆蓋率往上推。
        幅度偏保守，平均多約 2.9 個百分點。
        暗等待比例約下降 3.2%。
        maxToP50Ratio 也下降，表示亮尾端相對一般亮度沒有那麼誇張。
        使用者肉眼回報：
          8 SPP 以下好像有改善。
          更高 SPP 差異不大。
        這符合候選設計：早期幫忙，後面退場或影響變小。
        這是第一版候選，不能直接開成正式值。

    - id: R6-3-Phase2-v18b-same-surface-dark-fill-curve
      date: 2026-05-06
      type: candidate_curve_adjustment
      files:
        - shaders/Home_Studio_Fragment.glsl
        - js/Home_Studio.js
        - Home_Studio.html
        - docs/tests/r6-3-cloud-mis-weight-probe.test.js
      version: r6-3-phase2-cloud-same-surface-dark-fill-v18b
      user_report:
        - v18a 在 8 SPP 以下好像有改善。
        - 更高 SPP 差異不大。
        - 目前退場太快。
        - 肉眼來看，64 SPP 前都要有作用會比較好。
      old_curve_v18a:
        maxSamples: 64
        meaning: 從第 1 SPP 開始線性退場，到 64 SPP 幾乎關閉。
        values:
          spp_1: 1.000
          spp_8: 0.891
          spp_16: 0.766
          spp_32: 0.516
          spp_48: 0.266
          spp_64: 0.016
          spp_65_plus: 0.000
      new_curve_v18b:
        maxSamples: 64
        meaning: 1 到 64 SPP 維持完整作用，64 到 128 SPP 用 smoothstep 平順退場。
        values:
          spp_1: 1.000
          spp_8: 1.000
          spp_16: 1.000
          spp_32: 1.000
          spp_48: 1.000
          spp_64: 1.000
          spp_80: 0.844
          spp_96: 0.500
          spp_112: 0.156
          spp_128: 0.000
      browser_probe:
        pageUrl: http://127.0.0.1:9005/Home_Studio.html?probe=v18b-candidate
        currentPanelConfig: 3
        targetSamples: 4
        resultJson: /private/tmp/home_studio_same_surface_dark_fill_c3_v18b_result.json
        medianBrightCoverageLiftAverage: 0.029199
        candidatePassesFirstMetric: true
        rows:
          floor:
            baselineMedianBrightCoverage: 0.064612
            candidateMedianBrightCoverageAtBaselineThreshold: 0.094298
            medianBrightCoverageLift: 0.029686
            darkWaitingShareReductionRatio: 0.031737
          gikPanel:
            baselineMedianBrightCoverage: 0.101955
            candidateMedianBrightCoverageAtBaselineThreshold: 0.130668
            medianBrightCoverageLift: 0.028713
            darkWaitingShareReductionRatio: 0.031973
        interpretation: 4 SPP 位於 v18a 與 v18b 的強作用區，數字相同屬於合理結果；v18b 主要差異需看 32 到 64 SPP。
      validation_focus:
        - 開啟候選後，1 到 64 SPP 都應該有可見補暗效果。
        - 96 SPP 附近效果應該開始明顯變弱。
        - 128 SPP 後回到保護材質與收斂結果優先。

    - id: R6-3-Phase2-v18b-user-screenshot-no-visible-delta
      date: 2026-05-06
      type: user_visual_regression_report
      files:
        - /Users/eajrockmacmini/Downloads/260506-cam1-default-4spp (on).png
        - /Users/eajrockmacmini/Downloads/260506-cam1-default-4spp (off).png
      user_report:
        - 有開與沒開看起來完全一樣。
        - 先前覺得有改善屬於心理作用。
      image_measurement:
        dimensions: 2560x1440
        full_mean_abs_rgb:
          r: 15.0672
          g: 14.9132
          b: 13.8369
        full_luma:
          on: 91.1775
          off: 97.5957
          delta: -6.4182
        center_panels_luma:
          on: 71.5918
          off: 78.0030
          delta: -6.4112
        right_gik_luma:
          on: 81.6637
          off: 88.3503
          delta: -6.6867
      revised_interpretation:
        - v18b 的診斷數字沒有轉成主畫面可見差異。
        - 同表面補暗候選目前視覺 no-go。
        - 先前 probe 量到的是 Cloud contribution 診斷通道覆蓋率，不等於一般 render 的肉眼改善。
      next_step:
        - 暫停沿 v18b 調 strength 或退場曲線。
        - 下一步改做主畫面 screen-delta probe，或回頭查 4 SPP 主要噪點來源。

    - id: R6-3-Phase2-1spp-screen-dark-hole-probe
      date: 2026-05-06
      type: screen_probe
      trigger:
        user_report:
          - 最該查的是 1 SPP。
          - 因為黑點最多，等於每次移動都要被閃一次黑幕。
      page:
        pageUrl: http://127.0.0.1:9005/Home_Studio.html?probe=screen-dark-1spp
        currentPanelConfig: 3
        currentCameraPreset: cam1
        scriptSrc: js/Home_Studio.js?v=r6-3-cloud-same-surface-dark-fill-v18b
        shaderFile: Home_Studio_Fragment.glsl?v=r6-3-cloud-same-surface-dark-fill-v18b
        cloudSameSurfaceDarkFillMode: 0
        cloudMisWeightProbeMode: 0
        activeLightIndex: [7, 8, 9, 10]
      screenshots:
        - /private/tmp/home_studio_1spp_dark_probe/cam1-c3-1spp.png
        - /private/tmp/home_studio_1spp_dark_probe/cam1-c3-2spp.png
        - /private/tmp/home_studio_1spp_dark_probe/cam1-c3-4spp.png
        - /private/tmp/home_studio_1spp_dark_probe/cam1-c3-8spp.png
        - /private/tmp/home_studio_1spp_dark_probe/cam1-c3-16spp.png
      local_dark_hole_metric:
        definition: local45_min30 means local average luma >= 30 and pixel luma < 45 percent of local average.
        full:
          spp_1: 0.010699
          spp_2: 0.010047
          spp_4: 0.008776
          spp_8: 0.006014
          spp_16: 0.003624
        lower_floor:
          spp_1: 0.025070
          spp_2: 0.020000
          spp_4: 0.017680
          spp_8: 0.011690
          spp_16: 0.006743
        right_gik:
          spp_1: 0.018313
          spp_2: 0.013280
          spp_4: 0.013015
          spp_8: 0.010382
          spp_16: 0.007933
      cloud_bright_sample_coverage_1spp:
        resultJson: /private/tmp/home_studio_coverage_probe_c3_1spp_result.json
        floorGikMedianBrightCoverage: 0.087876
        floorGikDarkWaitingShareAtMedian: 0.912124
        coverageInsufficientSurfaces: [floor, gikPanel]
        floor:
          visiblePixelSamples: 96174
          contributionEventDensity: 0.128579
          medianBrightCoverage: 0.064612
          darkWaitingShareAtMedian: 0.935388
          maxToP50Ratio: 1341.725044
        gikPanel:
          visiblePixelSamples: 158914
          contributionEventDensity: 0.203406
          medianBrightCoverage: 0.101955
          darkWaitingShareAtMedian: 0.898045
          maxToP50Ratio: 4747.036106
      revised_interpretation:
        - 使用者判斷正確，1 SPP 是最該先解的痛點。
        - 第一張主畫面的黑點集中在 lower_floor、right_gik、深色物件區。
        - floor / GIK 約九成可見像素在 1 SPP 還沒達到一般亮度。
        - same-surface dark-fill 只改已經抽到 Cloud contribution 的樣本，無法補第一張沒有抽到有效亮度的像素。
      next_step:
        - 停止沿 v18b 補暗候選微調。
        - 建立主畫面 screen-delta / local dark-hole probe 作為新指標。
        - 優先研究移動後前 1 到 4 SPP 的顯示端保護。
        - 若改採樣端，目標要能增加第一張 floor/GIK 有效 coverage。

    - id: R6-3-Phase2-v19-first-frame-burst
      date: 2026-05-06
      type: implementation_and_screen_probe
      trigger:
        user_decision:
          - 先做 first-frame 相關治療。
          - 目標是降低移動後 1 SPP 黑幕感。
      version:
        label: r6-3-phase2-first-frame-burst-v19
        html_cache:
          InitCommon: js/InitCommon.js?v=r6-3-first-frame-burst-v19
          Home_Studio: js/Home_Studio.js?v=r6-3-first-frame-burst-v19
          Fragment: Home_Studio_Fragment.glsl?v=r6-3-first-frame-burst-v19
      implementation:
        files:
          - js/InitCommon.js
          - js/Home_Studio.js
          - Home_Studio.html
          - docs/tests/r6-3-cloud-mis-weight-probe.test.js
        config:
          firstFrameRecoveryEnabled: true
          firstFrameRecoveryTargetSamples: 4
          firstFrameRecoveryClearWhileMoving: true
        console_helpers:
          - reportFirstFrameRecoveryConfig()
          - setFirstFrameRecoveryConfig({ enabled: false })
          - setFirstFrameRecoveryConfig({ enabled: true, targetSamples: 4, clearWhileMoving: true })
        behavior:
          - 第一張可見畫面先跑到 4 SPP。
          - 移動中預設先清掉舊累積，再用目前視角跑 4 次。
          - 這是顯示節奏治療，不改 Cloud 採樣公式。
      measurement:
        browser: headless Brave CDP
        pageUrl: http://127.0.0.1:9005/Home_Studio.html?probe=v19-first-frame-on
        currentPanelConfig: 3
        currentCameraPreset: cam1
        scripts:
          capture: /private/tmp/home_studio_1spp_dark_probe.mjs
        screenshots:
          - /private/tmp/home_studio_v19_first_frame_probe_on/cam1-c3-on-1spp.png
          - /private/tmp/home_studio_v19_first_frame_probe_on/cam1-c3-on-2spp.png
          - /private/tmp/home_studio_v19_first_frame_probe_on/cam1-c3-on-4spp.png
          - /private/tmp/home_studio_v19_first_frame_probe_on/cam1-c3-on-8spp.png
          - /private/tmp/home_studio_v19_first_frame_probe_on/cam1-c3-on-16spp.png
        summaryJson: /private/tmp/home_studio_v19_first_frame_probe_on/capture-summary.json
        first_visible_frame:
          requestedSamples: 1
          actualSamples: 4
          firstFrameRecovery:
            enabled: true
            targetSamples: 4
            lastPassCount: 4
            clearWhileMoving: true
          metrics:
            full:
              local45Min30Ratio: 0.023737544
              veryDarkRatio: 0.023590874
              meanLuma: 121.279218
            lower_floor:
              local45Min30Ratio: 0.050730684
              veryDarkRatio: 0.062237687
              meanLuma: 79.175004
            right_gik:
              local45Min30Ratio: 0.051921169
              veryDarkRatio: 0.063606532
              meanLuma: 84.142870
      validation:
        contract:
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - node --check js/InitCommon.js
          - node --check js/Home_Studio.js
        result: pass
      interpretation:
        - v19 已確認 requested 1 SPP 時，第一張實際顯示為 4 SPP。
        - 黑幕感應可明顯下降。
        - 噪點仍存在，因為它沒有增加總照明命中率，只是讓第一眼不再停在 1 SPP。
        - GPU 成本會增加，需使用者用互動手感驗收。
      next_step:
        - 先請使用者用 http://localhost:9005/Home_Studio.html 檢查 C3 / cam1 移動後是否不再黑一下。
        - 若手感變慢，將 targetSamples 先測 2 或 3。
        - 若手感可接受但噪點仍刺眼，再研究局部 dark-hole repair 或 history hold。

    - id: R6-3-Phase2-v19a-snapshot-toggle-default-off
      date: 2026-05-06
      type: user_report_and_implementation
      trigger:
        user_report:
          - v19 first-frame burst 已經不黑。
          - 但看起來像先不顯示畫面，移動時會有卡手感。
          - 自動 SPP 快照也會造成卡頓，會干擾真實手感判斷。
      implementation:
        files:
          - Home_Studio.html
          - js/Home_Studio.js
          - docs/tests/r6-3-max-samples.test.js
        html:
          - 保留 snapshot-bar。
          - 保留手動存圖與打包下載。
          - 新增 btn-toggle-snapshots，預設文字為「快照：關」。
        js:
          SNAPSHOT_CAPTURE_ENABLED: false
          SNAPSHOT_MILESTONES: []
          SNAPSHOT_MILESTONE_PRESET: [1, 2, 3, 4, 5, 6, 7, 8, 16, 24, 32, 48, 64, 80, 100, 150, 200, 300, 500, 750, 1000]
          console_helper: setSnapshotCaptureEnabled(enabled)
        behavior:
          - 預設不跑自動快照。
          - 預設手動存圖不會進入 PNG 編碼。
          - 開啟後恢復原本節點式 SPP 快照。
      validation:
        contract:
          - node docs/tests/r6-3-max-samples.test.js
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - node --check js/Home_Studio.js
          - node --check js/InitCommon.js
        result: pass
      interpretation:
        - 接下來使用者測到的卡頓會更接近 first-frame burst 與 renderer 本身的成本。
        - 若快照關閉後仍卡，下一輪先調 targetSamples 2 或 3，再評估是否改成 history hold。

    - id: R6-3-Phase2-v19a-user-handfeel-and-visibility-report
      date: 2026-05-06
      type: user_visual_and_handfeel_report
      user_report:
        - 關閉快照確實很順。
        - 沒有 1 SPP 黑幕後，閃黑幕消失。
        - 4 SPP 還是很髒，移動時視線仍受阻礙。
      interpretation:
        - 快照造成的卡頓已被使用者排除。
        - first-frame burst 的成果是消除黑幕，不足以解決移動期視線可讀性。
        - 繼續提高 first-frame targetSamples 可能讓等待更明顯，ROI 下降。
      next_step:
        - 下一輪優先做 movement visibility protection。
        - 方案候選包含短暫沿用上一張穩定畫面、淡入新累積、或移動期間局部 dark-hole / firefly 緩和。
        - 必須保留 A/B 開關，且不污染靜止後最終收斂畫面。

    - id: R6-3-Phase2-v20-movement-protection
      date: 2026-05-06
      type: sop_and_implementation
      sop:
        path: docs/SOP/R6-3-v20：movement protection.md
        scope:
          - 總開關與量測框架。
          - 保存上一張穩定畫面。
          - 移動時混入上一張穩定畫面。
        deferred:
          - edge / normal 保護。
          - depth / velocity 類判斷。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - shaders/ScreenOutput_Fragment.glsl
          - docs/tests/r6-3-v20-movement-protection.test.js
        js:
          movementProtectionRenderTarget: true
          movementProtectionEnabled: true
          movementProtectionMovingBlend: 0.65
          movementProtectionMinStableSamples: 16
          movementProtectionStableReady: false
          console_helpers:
            - setMovementProtectionConfig()
            - reportMovementProtectionConfig()
        shader:
          uniforms:
            - tMovementProtectionStableTexture
            - uMovementProtectionMode
            - uMovementProtectionBlend
          behavior:
            - moving 時 displayColor 混入 movementStableColor。
        cache_bust:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v20a
          ScreenOutput: shaders/ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v20
      smoke_test:
        pageUrl: http://127.0.0.1:9005/Home_Studio.html?probe=v20-movement-protection-cache-smoke
        summaryJson: /private/tmp/home_studio_v20_movement_probe_cache/capture-summary.json
        state:
          version: r6-3-phase2-movement-protection-v20a
          enabled: true
          stableReady: true
          movingBlend: 0.65
          minStableSamples: 16
          lastCaptureSamples: 18
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - node docs/tests/r6-3-max-samples.test.js
          - node --check js/InitCommon.js
          - node --check js/Home_Studio.js
          - git diff --check
        result: pass
      interpretation:
        - v20 首輪已具備 A/B 開關與上一張穩定畫面保存。
        - 使用者需肉眼驗收 movingBlend 是否降低移動期視線遮擋。
        - 若拖影明顯，下一輪先做 edge / normal 保護。

    - id: R6-3-Phase2-v20a-movement-protection-active-blend-fix
      date: 2026-05-06
      type: user_no_go_root_cause_and_fix
      user_report:
        - v20 開啟後，4 SPP 還是很髒。
      root_cause:
        - v20 已能在靜止後保存 movementProtectionRenderTarget。
        - 移動開始時，needClearAccumulation 與 firstFrameRecoveryWasCleared 又把 movementProtectionStableReady 清為 false。
        - Step 3 顯示合成使用 firstFrameRecoveryActiveRenderCameraMoving；first-frame burst 會把它改成 false。
        - 兩個條件合在一起，移動期間 uMovementProtectionBlend 實際保持 0。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        js:
          version: r6-3-phase2-movement-protection-v20a
          movementProtectionPreserveStableAcrossCameraReset: true
          behavior:
            - 移動清除與 first-frame 清除期間保留穩定畫面。
            - Step 3 用實際 cameraIsMoving 決定 movement protection blend。
            - cameraIsMoving 為 false 時才 captureMovementProtectionStableFrame。
        html:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v20a
      cdp_movement_check:
        pageUrl: http://127.0.0.1:9005/Home_Studio.html?probe=v20a-movement-protection-active-blend-2
        summaryJson: /private/tmp/home_studio_v20a_movement_probe_2/capture-summary.json
        before_move:
          stableReady: true
          lastCaptureSamples: 21
          lastBlend: 0
        during_move:
          cameraIsMoving: true
          currentSamples: 4
          stableReady: true
          lastBlend: 0.65
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - node docs/tests/r6-3-max-samples.test.js
          - node --check js/InitCommon.js
          - node --check js/Home_Studio.js
          - git diff --check
        result: pass
      interpretation:
        - v20a 已確認移動中的 4 SPP frame 會混入上一張穩定畫面。
        - 是否足夠降低肉眼髒點遮擋，需要使用者在 http://localhost:9005/Home_Studio.html 重整後驗收。
        - 若仍覺得髒，下一輪直接提高 movingBlend 或導入 edge / normal 保護。

    - id: R6-3-Phase2-v20b-movement-protection-stale-stable-invalidation
      date: 2026-05-06
      type: user_no_go_root_cause_and_fix
      user_report:
        - 配置 1 移動時，4 SPP 變得超暗。
      root_cause:
        - v20a 保留穩定畫面的範圍太大。
        - 配置切換、視角按鈕、燈光池重建、參數變動也沿用上一張穩定畫面。
        - 移動時混入舊狀態，配置 1 會被舊暗圖壓低亮度。
      implementation:
        files:
          - Home_Studio.html
          - js/Home_Studio.js
          - js/InitCommon.js
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        js:
          version: r6-3-phase2-movement-protection-v20b
          invalidateMovementProtectionStableFrame: true
          invalidation_sources:
            - applyPanelConfig
            - switchCamera
            - rebuildActiveLightLUT
            - sceneParamsChanged
          preserved_source:
            - 一般滑鼠移動仍保留穩定畫面。
        html:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v20b
      cdp_movement_check:
        pageUrl: http://127.0.0.1:9005/Home_Studio.html?probe=v20b-config1-movement-dark-fix
        summaryJson: /private/tmp/home_studio_v20b_config1_movement_probe/capture-summary.json
        screenshot: /private/tmp/home_studio_v20b_config1_movement_probe/cam1-c3-on-18spp.png
        during_move:
          currentPanelConfig: 1
          cameraIsMoving: true
          currentSamples: 4
          stableReady: true
          lastBlend: 0.65
          meanLumaFull: 141.035252
          veryDarkRatioFull: 0
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - node docs/tests/r6-3-max-samples.test.js
          - node --check js/InitCommon.js
          - node --check js/Home_Studio.js
          - git diff --check
        result: pass
      interpretation:
        - v20b 已把內容狀態變更與一般滑鼠移動分開。
        - 配置 1 CDP 截圖不再出現使用者回報的超暗狀態。
        - 下一輪仍需使用者肉眼驗收真實互動手感與拖影程度。

    - id: R6-3-Phase2-v20c-movement-protection-config-gate
      date: 2026-05-06
      type: user_no_go_scope_gate_and_fix
      user_report:
        - v20b 後，配置 1 移動時 4 SPP 仍然超暗。
      interpretation:
        - 配置 1 / 2 不是 R6-3 movement protection 的主要痛點。
        - 這兩個配置套 movement protection 會增加混合風險。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        js:
          version: r6-3-phase2-movement-protection-v20c
          movementProtectionConfigAllowed: true
          allowed_configs:
            - 3
            - 4
          blocked_configs:
            - 1
            - 2
          reporter:
            - configAllowed
        html:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v20c
      cdp_movement_check:
        pageUrl: http://127.0.0.1:9005/Home_Studio.html?probe=v20c-config1-gate-check
        summaryJson: /private/tmp/home_studio_v20c_config1_gate_probe/capture-summary.json
        during_move:
          currentPanelConfig: 1
          configAllowed: false
          currentSamples: 4
          lastBlend: 0
          meanLumaFull: 140.744454
          veryDarkRatioFull: 0
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
        result: pass
      interpretation_after_probe:
        - 配置 1 在 v20c 已確認不再跑 movement protection 混合。
        - 若使用者仍看到配置 1 超暗，下一步先確認瀏覽器是否載到 v20c，再查 first-frame burst 的配置 1 行為。

    - id: R6-3-Phase2-v20d-c3-c4-low-spp-preview-fallback
      date: 2026-05-06
      type: user_no_go_root_cause_and_fix
      user_report:
        - C3 / C4 也是 4 SPP 超暗，不能只排除 C1 / C2。
      root_cause:
        - C3 / C4 切換後立刻移動時，還沒有 Samples >= 16 的穩定畫面。
        - v20 / v20a / v20b 的 history mix 路線無圖可混，最後仍顯示原始 4 SPP 暗畫面。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - shaders/ScreenOutput_Fragment.glsl
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        js:
          version: r6-3-phase2-movement-protection-v20d
          movementProtectionLowSppPreviewStrength: 0.55
          reporter:
            - lowSppPreviewStrength
            - lastPreviewStrength
        shader:
          uniform:
            - uMovementProtectionLowSppPreviewStrength
          behavior:
            - C3 / C4 移動中用 display-space preview curve 提亮低 SPP 可視性。
        html:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v20d
      cdp_movement_check:
        c3:
          pageUrl: http://127.0.0.1:9005/Home_Studio.html?probe=v20d-c3-4spp-preview-check
          summaryJson: /private/tmp/home_studio_v20d_c3_4spp_preview_probe/capture-summary.json
          before_preview:
            meanLumaFull: 95.351693
            veryDarkRatioFull: 0.082047
          during_preview:
            lastPreviewStrength: 0.55
            meanLumaFull: 110.437023
            veryDarkRatioFull: 0.016100
        c4:
          pageUrl: http://127.0.0.1:9005/Home_Studio.html?probe=v20d-c4-4spp-preview-check
          summaryJson: /private/tmp/home_studio_v20d_c4_4spp_preview_probe/capture-summary.json
          before_preview:
            meanLumaFull: 87.920790
            veryDarkRatioFull: 0.053099
          during_preview:
            lastPreviewStrength: 0.55
            meanLumaFull: 104.796660
            veryDarkRatioFull: 0.009472
      interpretation:
        - v20d 先處理 C3 / C4 4SPP 超暗。
        - 4SPP 髒點仍存在，下一輪需要針對移動期 dirty 視線遮擋做 spatial / firefly preview。

    - id: R6-3-Phase2-v20e-screenoutput-reinhard-compile-fix
      date: 2026-05-06
      type: user_console_error_root_cause_and_fix
      user_report:
        - 重新整理後 Console 出現 ScreenOutput fragment shader compile error。
        - 錯誤指向 ReinhardToneMapping(filteredPixelColor) 不接受 vec3。
      root_cause:
        - ScreenOutput_Fragment.glsl 呼叫 Three 注入的 ReinhardToneMapping(filteredPixelColor)。
        - 目前 three 版本注入函式不接受 vec3，導致 ScreenOutput shader 編譯失敗。
        - ScreenOutput 壞掉後，movement protection 的亮度驗證全部失去意義。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - shaders/ScreenOutput_Fragment.glsl
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        shader:
          - 新增 HomeStudioReinhardToneMap(vec3 color)。
          - ScreenOutput 改呼叫本地 vec3 helper。
        cache_bust:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v20e
          ScreenOutput: shaders/ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v20e
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - node docs/tests/r6-3-max-samples.test.js
          - node --check js/InitCommon.js
          - node --check js/Home_Studio.js
          - git diff --check
        result: pass
      next_verification:
        - 使用者刷新 http://localhost:9005/Home_Studio.html?v=v20e 後，先確認 Console 不再出現 ScreenOutput shader compile error。
        - compile error 消失後，再重新判斷 C3 / C4 4SPP movement protection 是否有效。

    - id: R6-3-Phase2-v20f-c3-c4-ghosting-default-history-off
      date: 2026-05-06
      type: user_visual_no_go_and_targeted_fix
      user_report:
        - C3 4SPP 不會暗畫面了，但是有殘影問題。
        - 截圖顯示舊視角透明雙影，尤其天花板雲燈與牆面物件錯位明顯。
      root_cause:
        - v20e 修掉 ScreenOutput shader 後，movement history mix 開始正常作用。
        - movementProtectionMovingBlend 預設 0.65，移動時會把上一張穩定畫面混進目前畫面。
        - 這個預設值直接造成舊視角殘影。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        behavior:
          - movementProtectionMovingBlend 預設改為 0.0。
          - C3 / C4 low-SPP preview fallback 保持開啟。
          - history mix 保留 Console 手動 A/B 能力。
        cache_bust:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v20f
          ScreenOutput: shaders/ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v20f
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
        expected_runtime_report:
          - reportMovementProtectionConfig().version = r6-3-phase2-movement-protection-v20f
          - reportMovementProtectionConfig().movingBlend = 0
          - reportMovementProtectionConfig().lastBlend = 0
      next_verification:
        - 使用者刷新 http://localhost:9005/Home_Studio.html?v=v20f 後，測 C3 / C4 4SPP 移動。
        - 驗收重點是移動時沒有舊視角透明雙影，且低 SPP 提亮仍有效。

    - id: R6-3-Phase2-v20g-c3-c4-moving-spatial-preview
      date: 2026-05-06
      type: user_visual_no_go_and_targeted_fix
      user_report:
        - v20f 不會有殘影了。
        - C3 4SPP 看起來跟今天一開始相比沒有明顯差別。
      root_cause:
        - v20f 的 low-SPP display lift 只提亮目前 4SPP 畫面。
        - C3 / C4 4SPP 的主要遮擋來自高頻亮暗雜點，白色亮點也會被一起提亮。
        - history mix 已造成殘影，不能再作為預設路線。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - shaders/ScreenOutput_Fragment.glsl
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        behavior:
          - movementProtectionLowSppPreviewStrength 降為 0.35。
          - 新增 movementProtectionSpatialPreviewStrength，預設 0.90。
          - C3 / C4 移動中啟用 uMovementProtectionSpatialPreviewStrength。
          - ScreenOutput 在 tone mapping 前建立 movementSpatialPreviewHdr。
          - 使用 movementBrightLimit 壓回局部過亮 speckle。
          - 對過暗點做少量 local lift。
          - path tracing accumulation 不讀 preview 結果。
        cache_bust:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v20g
          ScreenOutput: shaders/ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v20g
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
        expected_runtime_report:
          - reportMovementProtectionConfig().version = r6-3-phase2-movement-protection-v20g
          - reportMovementProtectionConfig().movingBlend = 0
          - reportMovementProtectionConfig().lowSppPreviewStrength = 0.35
          - reportMovementProtectionConfig().spatialPreviewStrength = 0.90
          - moving 時 reportMovementProtectionConfig().uniformSpatialPreviewStrength = 0.90
      next_verification:
        - 使用者刷新 http://localhost:9005/Home_Studio.html?v=v20g 後，測 C3 / C4 4SPP 移動。
        - 驗收重點是白色亮點密度與黑點突兀感低於 v20f，且沒有上一視角透明雙影。

    - id: R6-3-Phase2-v20h-c3-c4-moving-wide-preview
      date: 2026-05-06
      type: user_visual_no_go_and_targeted_fix
      user_report:
        - v20g 還是超髒。
        - 截圖顯示整片 4SPP 樣本圖樣遮住視線。
      root_cause:
        - v20g 的 13 點局部清理太弱。
        - C3 / C4 4SPP 遮擋不是少量亮點，而是整片高頻樣本圖樣。
        - history mix 已造成殘影，仍不可作為預設路線。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - shaders/ScreenOutput_Fragment.glsl
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        behavior:
          - movementProtectionLowSppPreviewStrength 降到 0.15。
          - movementProtectionSpatialPreviewStrength 預設關閉。
          - 新增 movementProtectionWidePreviewStrength，預設 0.95。
          - ScreenOutput 新增 37 點 wide moving preview。
          - wide preview 只吃目前這一幀，不吃舊視角。
          - 過亮中心點先用 movementWideBrightLimit 壓回局部範圍。
        cache_bust:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v20h
          ScreenOutput: shaders/ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v20h
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
        expected_runtime_report:
          - reportMovementProtectionConfig().version = r6-3-phase2-movement-protection-v20h
          - reportMovementProtectionConfig().movingBlend = 0
          - reportMovementProtectionConfig().lowSppPreviewStrength = 0.15
          - reportMovementProtectionConfig().spatialPreviewStrength = 0
          - reportMovementProtectionConfig().widePreviewStrength = 0.95
          - moving 時 reportMovementProtectionConfig().uniformWidePreviewStrength = 0.95
      next_verification:
        - 使用者刷新 http://localhost:9005/Home_Studio.html?v=v20h 後，測 C3 / C4 4SPP 移動。
        - 驗收重點是允許移動中較糊，但噪點遮擋必須低於 v20g，且沒有上一視角透明雙影。

    - id: R6-3-Phase2-v21a-c3-c4-moving-current-samples-16
      date: 2026-05-06
      type: user_visual_no_go_and_targeted_fix
      user_report:
        - v20h 還是一樣很髒。
        - 使用者不再截圖，直接判定 ScreenOutput 類修補 no-go。
      root_cause:
        - v20 / v20g / v20h 都在處理同一張 4SPP 畫面。
        - 後製清理無法補足樣本不足。
        - C3 / C4 移動中的當前畫面仍只有 4SPP。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        behavior:
          - firstFrameRecoveryTargetSamples 保持 4。
          - 新增 firstFrameRecoveryMovingTargetSamples = 16。
          - C3 / C4 且 cameraIsMoving 時，visible frame 內部 pass target 拉到 16。
          - history mix 繼續維持 movingBlend = 0。
        cache_bust:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v21a
          ScreenOutput: shaders/ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v21a
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
        expected_runtime_report:
          - reportFirstFrameRecoveryConfig().targetSamples = 4
          - reportFirstFrameRecoveryConfig().movingTargetSamples = 16
          - C3 / C4 moving 時左下 Samples 應顯示 16
      next_verification:
        - 使用者刷新 http://localhost:9005/Home_Studio.html?v=v21a 後，測 C3 / C4 移動。
        - 驗收重點是噪點遮擋低於 v20h；FPS 下降屬預期代價。

    - id: R6-3-Phase2-v22a-c3-c4-deterministic-movement-preview
      date: 2026-05-06
      type: user_visual_no_go_and_architecture_pivot
      user_report:
        - v21a 變得更爛。
        - 16SPP 前像被丟掉。
        - 畫面超模糊又卡手。
        - 截圖顯示 FPS = 3。
      root_cause:
        - v21a 將 C3 / C4 移動 visible frame 拉到 16SPP，直接造成卡手。
        - v20g / v20h 顯示端抹平會把髒點變成模糊，沒有產生新樣本資訊。
        - 4SPP path tracing 的白黑噪點本質來自隨機取樣不足。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - js/Home_Studio.js
          - js/PathTracingCommon.js
          - shaders/Home_Studio_Fragment.glsl
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        behavior:
          - firstFrameRecoveryMovingTargetSamples 改為 1。
          - movementProtectionLowSppPreviewStrength / movementProtectionSpatialPreviewStrength / movementProtectionWidePreviewStrength 預設 0。
          - 新增 movementPreviewEnabled，C3 / C4 移動時預設啟用。
          - PathTracingCommon 新增 uMovementPreviewMode。
          - uMovementPreviewMode 開啟時關閉 pixel jitter、aperture jitter、previousTexture history。
          - Home_Studio_Fragment.glsl 新增 CalculateMovementPreview，只跑一次 SceneIntersect 與 deterministic preview light。
          - movement preview 期間跳過 borrow pass。
        cache_bust:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v22a
          Home_Studio: shaders/Home_Studio_Fragment.glsl?v=r6-3-movement-preview-v22a
          ScreenOutput: shaders/ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v22a
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - node --check js/InitCommon.js
          - node --check js/Home_Studio.js
          - node --check js/PathTracingCommon.js
        expected_runtime_report:
          - reportMovementProtectionConfig().version = r6-3-phase2-movement-protection-v22a
          - reportMovementProtectionConfig().movementPreviewEnabled = true
          - C3 / C4 moving 時 reportMovementProtectionConfig().uniformMovementPreviewMode = 1
          - reportFirstFrameRecoveryConfig().movingTargetSamples = 1
      next_verification:
        - 使用者刷新 http://localhost:9005/Home_Studio.html?v=v22a 後，測 C3 / C4 移動。
        - 驗收重點是手感優先，不再出現 v21a 的 16SPP 卡頓與大面積糊化。

    - id: R6-3-Phase2-v22c-disable-cheap-movement-preview-default
      date: 2026-05-06
      type: user_visual_no_go_and_default_rollback
      user_report:
        - v22a 一直閃出灰色廉價建模。
        - 使用者判定這樣不行。
      root_cause:
        - v22a 的 CalculateMovementPreview 只做一次 SceneIntersect 與簡化光照。
        - 這條路徑缺少正式 path tracing 的材質、紋理與間接光觀感。
        - 把它作為預設移動畫面會產生簡化模型閃爍感。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - js/Home_Studio.js
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        behavior:
          - movementPreviewEnabled 預設改 false。
          - uMovementPreviewMode 預設維持 0。
          - CalculateMovementPreview 保留作 Console 診斷用途。
          - C3 / C4 一般移動預設回正式 path tracing 畫面。
        cache_bust:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v22c
          Home_Studio: js/Home_Studio.js?v=r6-3-movement-preview-v22c
          ScreenOutput: shaders/ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v22c
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - node docs/tests/r6-3-max-samples.test.js
          - node --check js/InitCommon.js
          - node --check js/Home_Studio.js
          - node --check js/PathTracingCommon.js
          - git diff --check
        expected_runtime_report:
          - reportMovementProtectionConfig().version = r6-3-phase2-movement-protection-v22c
          - reportMovementProtectionConfig().movementPreviewEnabled = false
          - C3 / C4 moving 時 reportMovementProtectionConfig().uniformMovementPreviewMode = 0
      next_verification:
        - 使用者刷新 http://localhost:9005/Home_Studio.html?v=v22c 後，測 C3 / C4 移動。
        - 驗收重點是灰色簡化模型不再閃出。

    - id: R6-3-Phase2-v22c-c1-c2-first-frame-recovery-target-1
      date: 2026-05-06
      type: user_console_evidence_and_targeted_fix
      user_report:
        - 使用者執行 setFirstFrameRecoveryConfig({ targetSamples: 1 }) 後，C1 / C2 正常順了。
      root_cause:
        - firstFrameRecoveryTargetSamples = 4 原本是全域成本。
        - movementProtectionConfigAllowed() 只管 C3 / C4 movement protection。
        - C1 / C2 沒有 movement protection 需求，仍被 first-frame recovery 拉到 4SPP。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        behavior:
          - 新增 firstFrameRecoveryConfigTargetSamples(activeCameraMoving)。
          - C1 / C2 回傳 1。
          - C3 / C4 回傳 firstFrameRecoveryTargetSamples，也就是 4。
          - reportFirstFrameRecoveryConfig() 新增 configTargetSamples。
        cache_bust:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v22c
          Home_Studio: js/Home_Studio.js?v=r6-3-movement-preview-v22c
          ScreenOutput: shaders/ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v22c
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - node docs/tests/r6-3-max-samples.test.js
          - node --check js/InitCommon.js
          - node --check js/Home_Studio.js
          - node --check js/PathTracingCommon.js
          - git diff --check
        expected_runtime_report:
          - C1 / C2 reportFirstFrameRecoveryConfig().configTargetSamples = 1
          - C3 / C4 reportFirstFrameRecoveryConfig().configTargetSamples = 4
      next_verification:
        - 使用者刷新 http://localhost:9005/Home_Studio.html?v=v22c 後，測 C1 / C2 移動 FPS。
        - 驗收重點是 C1 / C2 接近手動 targetSamples: 1 的順暢感。

    - id: R6-3-Phase2-v22d-c3-c4-moving-target-2-skip-borrow
      date: 2026-05-06
      type: targeted_performance_fix
      user_report:
        - C1 / C2 透過 setFirstFrameRecoveryConfig({ targetSamples: 1 }) 驗證後恢復順暢。
        - 使用者詢問 C3 / C4 是否一定要降 FPS 才能丟掉 1SPP。
        - 使用者決策：試選項 4，移除選項 1。
      root_cause:
        - C3 / C4 移動時原本 configTargetSamples = 4。
        - 每個可見畫格會多跑 path tracing pass。
        - borrow pass 也會一起跑，移動手感被額外成本壓住。
      implementation:
        files:
          - Home_Studio.html
          - js/InitCommon.js
          - js/Home_Studio.js
          - docs/tests/r6-3-v20-movement-protection.test.js
          - docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - docs/SOP/R6-3-v20：movement protection.md
          - docs/SOP/R6：渲染優化.md
          - docs/SOP/Debug_Log.md
        behavior:
          - firstFrameRecoveryMovingTargetSamples 改成 2。
          - C1 / C2 configTargetSamples 維持 1。
          - C3 / C4 移動時 configTargetSamples = 2。
          - C3 / C4 停止後 refill configTargetSamples = 4。
          - C3 / C4 移動期間跳過 borrow pass。
          - reportMovementProtectionConfig() 新增 lowCostMovingActive。
        cache_bust:
          InitCommon: js/InitCommon.js?v=r6-3-movement-protection-v22d
          Home_Studio: js/Home_Studio.js?v=r6-3-movement-preview-v22d
          ScreenOutput: shaders/ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v22d
      validation:
        contract:
          - node docs/tests/r6-3-v20-movement-protection.test.js
          - node docs/tests/r6-3-cloud-mis-weight-probe.test.js
          - node docs/tests/r6-3-max-samples.test.js
          - node --check js/InitCommon.js
          - node --check js/Home_Studio.js
          - node --check js/PathTracingCommon.js
          - git diff --check
        expected_runtime_report:
          - C1 / C2 reportFirstFrameRecoveryConfig().configTargetSamples = 1
          - C3 / C4 moving reportFirstFrameRecoveryConfig().configTargetSamples = 2
          - C3 / C4 moving reportMovementProtectionConfig().lowCostMovingActive = true
          - C3 / C4 stopped reportFirstFrameRecoveryConfig().configTargetSamples = 4
      next_verification:
        - 使用者刷新 http://localhost:9005/Home_Studio.html?v=v22d 後，測 C3 / C4 移動 FPS 與髒感。
        - 驗收重點是移動手感比 v22c 順，同時不再出現灰色簡化模型。

    - id: R6-3-Phase2-closeout-webgl-low-spp-movement-no-go
      date: 2026-05-06
      type: user_visual_no_go_and_stage_closeout
      user_report:
        - 使用者刷新 http://localhost:9005/Home_Studio.html?v=v22d 後，確認 2SPP 仍黑點很多。
        - 使用者回報 2SPP 等於卡一個視覺障礙。
        - 使用者判斷目前 WebGL path tracing 架構內可能已經搞不定。
        - 使用者決策：R6 到此為止，先整理至今紀錄；後續方向交棒給下一窗 AI。
        - 使用者後續追問是否需要這麼快進 WebGPU，要求評估 R7 選項。
      conclusion:
        - R6-3 的 WebGL path tracing 低 SPP 修補線停止加碼。
        - 1 / 2 / 4 SPP 直接顯示都不足以提供乾淨移動視線。
        - 舊畫面混合、顯示端模糊、簡化 preview、硬算更多樣本、2SPP 輕量路徑都已有 no-go 或低 ROI 證據。
        - 下一階段先做 R7 丁 blue noise 小實驗，再評估 R7 丙光源機率優化。
        - WebGPU / hybrid preview 保留為小型概念驗證，不做整套搬遷。
      preserved_work:
        - 快照開關，預設關閉。
        - first-frame recovery，避免 1SPP 黑幕。
        - C1 / C2 first-frame target 回到 1，恢復移動手感。
        - movement protection console reporter / setter。
        - Cloud / direct NEE / visible-surface probes 與合約測試。
        - R6-3 movement protection SOP。
      updated_docs:
        - docs/SOP/R0：全景地圖.md
        - docs/SOP/R6：渲染優化.md
        - docs/SOP/R7：採樣演算法升級.md
        - docs/SOP/R6-3-v20：movement protection.md
        - docs/SOP/Debug_Log.md
        - .omc/HANDOFF-R6-3-closeout-to-R7-small-experiments.md
      next_handoff:
        path: .omc/HANDOFF-R6-3-closeout-to-R7-small-experiments.md
        scope:
          - 下一窗 AI 先讀交棒 MD。
          - 下一階段先做 R7 丁 blue noise 小實驗。
          - 第二順位是 R7 丙光源機率優化。
          - WebGPU / hybrid preview 僅作第三順位小型概念驗證。

      final_note:
        - 早期低 SPP shader 修補線停止。
        - v15 / v16 / v17 / v18a 的 probe 與 candidate 保留為歷史資料。
        - 下一步不再安排 v18a 肉眼 A/B。
        - 下一窗 AI 先接 R7 丁 blue noise 小實驗。
        - WebGPU / hybrid preview 小型概念驗證保留，整套搬遷暫緩。
```
