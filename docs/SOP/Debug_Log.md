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

### 方向 B / C（延後至 R5 完工後）

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
