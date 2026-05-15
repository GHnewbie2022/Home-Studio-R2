# R7-3.10 C1 Phase 2 第一刀 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 先完成 R7-3.10 C1 接縫線第一刀：H8 runtime gate 隔離與 C' bake UV 半 texel 修正，重烘 floor / north 後用同視角驗證西側黑線、嫩芽共存與開關語意。

**Architecture:** 第一刀只處理已完成根因調查且可形成最小閉環的 H8 與 C'。runtime 保留 combined texture，改成 per-slot ready / mode 控制；bake capture path 移除多加的半 texel，正常 camera ray 不動。B' probe、H7 guard、H5 / H3' alpha mask、East wall runtime 與北牆 GIK 貼圖旋轉問題全部延後。

**Tech Stack:** JavaScript、GLSL string source in `js/PathTracingCommon.js`、three.js `DataTexture`、Node contract tests、existing CDP smoke runner。

---

## 目前狀態

日期：2026-05-14 起草；2026-05-15 CODEX / OPUS 第 3 輪審查後成立；2026-05-15 CODEX 完成第一刀。
狀態：第一刀 H8 + C' 已實作、1000SPP floor / north 已重烘、runtime pointer 已更新；同視角實機驗收待使用者確認。
範圍：H8 per-surface gate、C' bake UV 半 texel 修正、重烘 floor / north、第一階段同視角驗收。
暫緩：B' shader 數值 probe、H7 inside-geometry / ray-side guard、H5 / H3' alpha mask、East wall runtime。
協作邊界：OPUS 北牆 GIK 貼圖旋轉與貼圖頂底偽影已於 2026-05-15 完成（gik-north-rotate-uv-r4，使用者四個 Config 全數實機驗收通過）。CODEX 第二刀（B' probe / H7 guard 等）解除 GIK 邊界；惟 ACOUSTIC_PANEL 分支與 textures/gik244_*.jpeg 已成定論，第二刀無須再動。改動清單詳見本檔下方「## 2026-05-15 OPUS GIK 修復完成回報」。

---

## 對位檔案

| 檔案 | 角色 |
|---|---|
| `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-opus.md` | OPUS 工作副本，含完整三輪修正紀錄。 |
| `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md` | CODEX 目前實作導航與 TODO 主檔。 |
| `docs/superpowers/plans/2026-05-14-r7-3-10-c1-seam-debug-consensus-codex.md` | Phase 1 根因共識主檔，提供 H8 / H7 / C' / H5 證據。 |

---

## 設計結論

| 狀態 | 項目 | 共識 |
|---|---|---|
| - [x] | C' 根因 | `js/PathTracingCommon.js` 的 `vec2 r738BakeUv = (gl_FragCoord.xy + vec2(0.5)) / uResolution;` 多加 0.5 texel。`gl_FragCoord.xy` 已是 fragment center，除以 `uResolution` 即可對齊 metadata 的 `(i + 0.5) / N`。 |
| - [x] | C' 數值驗算 | floor col 419：metadata worldX = 1.347598，bake worldX = 1.351719，差 0.004121 m，剛好半 texel，從衣櫃外側推進 xMin 內側。floor row 131 則從 zMax 內側推出外側。north / east 交叉驗算同向。 |
| - [x] | C' 第一輪修法 | 只改 bake capture path：`r738BakeUv = gl_FragCoord.xy / uResolution;`。正常 camera ray 的 `pixelPos` 不動。修完後重烘 floor / north atlas。 |
| - [x] | H8 修法 | 採方案 a'：保留 combined texture，加入 per-slot ready 與 mode flag 防取樣。未 ready slot 使用 black placeholder；該 slot 對應 mode flag 維持 0，shader 不取樣。第一輪不讀 alpha、不做 valid fallback。 |
| - [x] | H8 嫩芽互斥 | R7-3.8 嫩芽 paste 只與 floor runtime 互斥。north baked 開啟時，嫩芽仍存在。 |
| - [x] | B' probe | 暫緩。第一刀先處理 H8 + C'，再決定 B' probe 實作時機。 |
| - [x] | H7 guard | 暫緩。需等 B' probe 取得 `isRayExiting`、camera position、visibleNormal、visiblePosition、rayDir 等數值後再決定 guard 形狀。 |
| - [x] | H5 / H3' | 第一刀不做 alpha mask。第一刀驗收後仍見家具 footprint 暗區異常貼回，才啟動第二輪。 |
| - [x] | East wall runtime | 第一刀不納入。若後續需要 east runtime，另設計第三 slot、UI 與 package ready。 |

---

## 第一刀檔案責任

| 檔案 | 動作 | 責任 |
|---|---|---|
| `docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js` | 修改 | 先寫 contract，鎖住 H8 與 C' 行為。 |
| `js/InitCommon.js` | 修改 | 拆 H8 runtime gate、per-slot ready、嫩芽互斥。 |
| `js/PathTracingCommon.js` | 修改 | 移除 bake capture path 的 `+ vec2(0.5)`。 |
| `docs/tools/r7-3-8-c1-bake-capture-runner.mjs` | 不改 | 只跑既有 helper 與 smoke。 |
| `js/Home_Studio.js` | 不改 | UI 按鈕既有綁定先不動。 |
| `Home_Studio.html` | 不改 | 不新增 UI。 |
| `shaders/Home_Studio_Fragment.glsl` | 不改 | 第一刀用既有 floor / north mode flag 控制取樣。 |

---

## 2026-05-15 第一刀執行結果

| 狀態 | 項目 | 結果 |
|---|---|---|
| - [x] | H8 runtime gate | `updateR7310C1FullRoomDiffuseRuntimeUniforms()` 已改為 `floorApplied` / `northWallApplied` 分開計算。 |
| - [x] | H8 loader 隔離 | floor loader 與 north loader 已分開載入；combined atlas 保留兩格，缺資料 slot 使用 black placeholder，取樣由 per-surface mode flag 控制。 |
| - [x] | H8 嫩芽互斥 | R7-3.8 嫩芽 paste 只與 floor runtime 互斥；north runtime 不再關掉嫩芽 paste。 |
| - [x] | C' bake UV | bake capture path 已改成 `vec2 r738BakeUv = gl_FragCoord.xy / uResolution;`；正常 camera ray 未改。 |
| - [x] | 1000SPP floor | 新 package：`.omc/r7-3-10-full-room-diffuse-bake/20260515-112620/`。 |
| - [x] | 1000SPP north | 新 package：`.omc/r7-3-10-full-room-diffuse-bake/20260515-112717/`。 |
| - [x] | runtime pointer | floor / north pointer 已更新到 2026-05-15 新 package。 |
| - [x] | smoke | contract、syntax、runtime short-circuit、north-wall runtime、UI toggle 均通過。 |
| - [ ] | 同視角實機驗收 | 等使用者確認 floor / north 黑線是否退掉，以及 north 開啟時嫩芽是否仍存在。 |
| - [ ] | 下一刀判斷 | 若實機仍有內部發光或暗區貼回，再進 B' probe 與 H7 guard。 |

---

## 2026-05-15 第一刀實機回報與 Debug

使用者回報：

```text
1.  地板烘焙開啟時：
      - 東北衣櫃底部西側邊界黑線已不見。
      - 東北衣櫃底部南側邊界稍微偏深；使用者不確定是否第一刀後才明顯。

2.  北牆烘焙開啟時：
      - 東北衣櫃西側垂直邊界黑線已不見。
      - 東北衣櫃頂部北側邊界出現黑線；使用者確認原本沒有。

3.  內部視角：
      - 地板烘焙開啟時，地板內部仍會發光。
      - 地板烘焙關閉時，地板內部只剩嫩芽區會發光。
      - 北牆烘焙開啟已不再影響嫩芽區域。
```

Systematic debugging 結論：

| 狀態 | 現象 | 證據 | 判讀 |
|---|---|---|---|
| - [x] | H8 嫩芽互斥 | 使用者確認 north 開啟已不再影響嫩芽；runner `--r7310-north-wall-runtime-test` 與 `--r7310-ui-toggle-test` 通過。 | H8 第一刀成立。 |
| - [x] | floor fixed-X 黑線消失 | floor col 419 舊包 mean 0.003628 / p50 0；新包 mean 0.316591 / p50 0.315657。 | C' 修正讓 fixed-X 邊界格回到亮值。 |
| - [x] | north fixed-X 黑線消失 | north col 419 舊包 mean 0.000969 / p50 0；新包 mean 0.409004 / p50 0.416011。 | C' 修正讓 north fixed-X 邊界格回到亮值。 |
| - [x] | floor fixed-Z 南側邊界變深 | floor row 131 舊包 mean 0.367539 / p50 0.369889；新包 mean 0.005740 / p50 0。row 132 新包仍亮，p50 0.376268。 | 暗格從 fixed-X 問題轉成 fixed-Z 邊界格；屬於新包 atlas 資料端變化。 |
| - [x] | north fixed-Y 頂部北側邊界變黑 | north row 344 舊包 mean 0.252991 / p50 0.254330；新包 mean 0.005483 / p50 0。row 345 新包仍亮，p50 0.257726。 | 暗格落在 fixed-Y 邊界格；屬於新包 atlas 資料端變化。 |
| - [x] | metadata 未漂移 | floor row 131 col 453 新舊 metadata 皆為 world z -0.705064；north row 344 col 453 新舊 metadata 皆為 world y 1.954634。 | 問題不是 metadata 座標變了，而是修正 bake UV 後，邊界格實際採樣落回遮擋區。 |
| - [x] | 地板內部仍發光 | `r7310C1RuntimeSurfaceIsTrueFloor()` 仍只看 objectID / normal / y position；沒有 camera / ray-side guard。 | H7 尚未處理，符合原計畫的下一刀。 |

目前 root cause 分流：

```text
1.  已修好的部分：
      H8 gate 污染已修好。
      C' fixed-X 半 texel 偏移已修好。

2.  新接縫現象：
      C' 修正後，fixed-Z / fixed-Y 邊界格從舊包的亮 rim 變成新包的暗格。
      這表示第一刀把 fixed-X 對齊修正了，同時揭露出 contact / occluder 邊界格的資料政策問題。
      目前不直接修，先記為 H5 / H3' 第二輪候選，需搭配 alpha / valid / contact policy 再設計。

3.  地板內部發光：
      H7 runtime guard 仍缺。這不是第一刀已處理的項目。
      下一刀應先做 B' shader probe，量 camera position、rayDir、visibleNormal、visiblePosition、isRayExiting 與 short-circuit surface。
```

下一步：

```text
1.  不回退 H8，因為 north 與嫩芽已分開。
2.  不先改 shader guard，先補 B' probe，把地板內部發光的 shader 當下數值抓出來。
3.  不直接做 alpha mask，先把 fixed-Z / fixed-Y 新黑線登記為 H5 / H3' 邊界資料政策問題。
4.  待 B' 數字回來後，再決定 H7 guard 與 H5 / H3' 是否拆成兩刀。
```

---

## 2026-05-15 OPUS GIK 修復完成回報

> CODEX 接手第二刀（B' probe / H7 guard 等）時，請把以下內容當作既定事實；本段為 OPUS 留給 CODEX 的 hand-off 訊息。

**狀態**：北牆橫擺 GIK LOGO 變形 + 貼圖頂底邊緣白線 / 暗線兩件事已合併修復為 `gik-north-rotate-uv-r4`，使用者 Config 1 / 2 / 3 / 4 全部實機驗收通過。

**根因兩條線（皆已修）**：

1. **shader UV 未對應橫擺旋轉**：R2-LOGO-FIX 為直擺面板寫死，R6-3 改三片橫擺 N1/N2/N3 後 1440×2912 直立貼圖被 X 長 Y 短映射 → 拉寬壓扁。
2. **貼圖檔頂底 padding 偽影**：`gik244_grey.jpeg` 頂部 row 0~4 fade `237→136`、底部 row 2907~2911 跳變；`gik244_white.jpeg` 頂部 row 0~8 fade `241→208`、底部 row 2907~2911 跳變。R2-LOGO-FIX 採整條 0~1 必然碰到。

**改動清單（CODEX 第二刀避免重複動這些位置）**：

| 檔案 | 動到的範圍 |
|---|---|
| `js/Home_Studio.js` | `addBox` 新增 `rotateUV90` 參數、`panelConfig2` N1/N2/N3 加 `rotateUV90: 1`、`applyPanelConfig` 兩條 forEach 透傳、`buildSceneBVH` 與 `updateBoxDataTexture` 寫入 box data pixel 4 的 `.b` 槽位（R2-18 保留欄位之一）、shader cache-buster 升至 `gik-north-rotate-uv-r4` |
| `shaders/Home_Studio_Fragment.glsl` | 全域 `hitRotateUV90` 宣告、`fetchBoxData` out `rotateUV90` 讀 `p4.z`、`SceneIntersect` 防漏寫預設 0 與命中寫入、`ACOUSTIC_PANEL` 三個 hitNormal 子分支結束後加入整體 90° UV 旋轉 `vec2 rel = uv - 0.5; uv = vec2(0.5 - rel.y, 0.5 + rel.x);` |
| `Home_Studio.html` | cache-buster 三處同步升至 `gik-north-rotate-uv-r4` |
| `textures/gik244_grey.jpeg` | 頂部 row 0~4 / 底部 row 2907~2911 mirror 修補（JPEG quality=95, subsampling=0），原檔備份於 `.bak-pre-padding-fix` |
| `textures/gik244_white.jpeg` | 同上策略，頂部 row 0~8 / 底部 row 2907~2911 mirror 修補，原檔備份於 `.bak-pre-padding-fix` |
| `docs/SOP/Debug_Log.md` | 新增章節「GIK｜北牆橫擺面板 UV 旋轉 + 貼圖頂底偽影修補」（id `gik-north-rotate-uv-r4`） |

**對 CODEX 第二刀的非衝突保證**：

- `box data texture pixel 4 .b` 此次被 OPUS 佔用（R2-18 註解原本標記為「保留槽位」；現用途：rotateUV90 旗標）。`.a` 仍為保留槽位，CODEX 若需第三類 per-box bit 可使用 `.a`。
- `fetchBoxData` 簽名新增了一個 out 參數，CODEX 修改其呼叫處時需要同步加上對應 receiver 變數（已在 `SceneIntersect` 唯一呼叫點處理；CODEX 若新增呼叫處請補上）。
- `addBox` 簽名末尾追加了 `rotateUV90` 參數（第 11 個參數），CODEX 若新增 addBox 呼叫不需要傳此參數（預設 `0`）。
- 貼圖檔本體已改，瀏覽器需要硬重載一次才會 refetch（cache-buster 不含貼圖檔路徑）。

**對 CODEX 第二刀的注意事項**：

- 若需要再針對其他「橫擺」薄板加 90° UV 旋轉，只要在該 box 屬性加 `rotateUV90: 1` 即可。不需要修 shader、不需要碰 ACOUSTIC_PANEL 分支邏輯。
- 若未來換貼圖，新貼圖檔請預先檢查上下邊緣是否有 padding 偽影（用 PIL 取 row 0~10 / row h-10~h 全寬平均色，跟 row h/2 中央色比對；超出 ±10 RGB 視為偽影需修補）。

**Git 狀態（截至 2026-05-15）**：本次 OPUS 改動全部位於 unstaged 區，未 commit，等使用者裁定如何與 CODEX 第一刀 staged 內容合併入 commit history。

---

## Task 1: Contract Test 先行

**Files:**

| 類型 | 路徑 |
|---|---|
| Modify | `docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js` |

- [x] **Step 1.1: 加 C' bake UV contract**

加入檢查：

```javascript
const bakeCaptureBlock = pathTracingCommon.match(/if \(uR738C1BakeCaptureMode == 2\)[\s\S]*?SetupScene\(\);/)?.[0] || '';
assert.doesNotMatch(bakeCaptureBlock, /gl_FragCoord\.xy \+ vec2\(0\.5\)/);
assert.match(bakeCaptureBlock, /vec2 r738BakeUv = gl_FragCoord\.xy \/ uResolution;/);
```

- [x] **Step 1.2: 加 H8 嫩芽互斥 contract**

加入檢查：

```javascript
const pasteUniformBlock = initCommon.match(/function updateR738C1BakePastePreviewUniforms\(\)[\s\S]*?function r7310C1FullRoomDiffuseRuntimeConfigAllowed/)?.[0] || '';
assert.match(pasteUniformBlock, /r7310FloorRuntimeApplied/);
assert.doesNotMatch(pasteUniformBlock, /r7310C1NorthWallDiffuseRuntimeEnabled[\s\S]*!r7310RuntimeApplied/);
assert.doesNotMatch(pasteUniformBlock, /r7310C1FloorDiffuseRuntimeEnabled \|\| r7310C1NorthWallDiffuseRuntimeEnabled/);
```

- [x] **Step 1.3: 加 H8 per-slot ready contract**

加入檢查：

```javascript
const fullRuntimeUniformBlock = initCommon.match(/function updateR7310C1FullRoomDiffuseRuntimeUniforms\(\)[\s\S]*?function buildR7310C1CombinedDiffuseRuntimeTexture/)?.[0] || '';
assert.match(fullRuntimeUniformBlock, /floorApplied/);
assert.match(fullRuntimeUniformBlock, /northWallApplied/);
assert.match(fullRuntimeUniformBlock, /uR7310C1FloorDiffuseMode\.value = floorApplied \? 1\.0 : 0\.0/);
assert.match(fullRuntimeUniformBlock, /uR7310C1NorthWallDiffuseMode\.value = northWallApplied \? 1\.0 : 0\.0/);
assert.doesNotMatch(fullRuntimeUniformBlock, /r7310C1FullRoomDiffuseRuntimeReady &&\s*r7310C1NorthWallDiffuseRuntimeReady/);
```

- [x] **Step 1.4: 執行 contract，確認會先失敗**

Run:

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected:

```text
AssertionError
```

失敗原因應對到 H8 或 C' 新增 contract。

---

## Task 2: H8 Runtime Gate 與 Loader 隔離

**Files:**

| 類型 | 路徑 |
|---|---|
| Modify | `js/InitCommon.js` |

- [x] **Step 2.1: 新增 black placeholder helper**

在 `buildR7310C1CombinedDiffuseRuntimeTexture()` 前加入：

```javascript
function createR7310C1BlackRuntimeSlot(resolution)
{
	var safeResolution = Math.max(1, Math.trunc(Number(resolution) || 1));
	return new Float32Array(safeResolution * safeResolution * 4);
}
```

- [x] **Step 2.2: 新增 combined texture refresh helper**

在 `buildR7310C1CombinedDiffuseRuntimeTexture()` 後加入：

```javascript
function refreshR7310C1CombinedDiffuseRuntimeTexture()
{
	if (!THREE || !r7310C1FullRoomDiffuseRuntimePackage)
		return false;
	var resolution = r7310C1FullRoomDiffuseRuntimePackage.targetAtlasResolution || 512;
	var floorPixels = r7310C1FullRoomDiffuseRuntimeTexture instanceof Float32Array
		? r7310C1FullRoomDiffuseRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	var northWallPixels = r7310C1NorthWallDiffuseRuntimeTexture instanceof Float32Array
		? r7310C1NorthWallDiffuseRuntimeTexture
		: createR7310C1BlackRuntimeSlot(resolution);
	if (floorPixels.length !== resolution * resolution * 4)
		floorPixels = createR7310C1BlackRuntimeSlot(resolution);
	if (northWallPixels.length !== resolution * resolution * 4)
		northWallPixels = createR7310C1BlackRuntimeSlot(resolution);
	r7310C1CombinedDiffuseRuntimeTexture = buildR7310C1CombinedDiffuseRuntimeTexture(
		floorPixels,
		northWallPixels,
		resolution
	);
	return true;
}
```

Implementation note：若目前變數名稱已用 `r7310C1FullRoomDiffuseRuntimeTexture` 表示 GPU `DataTexture`，實作時需先拆成兩個角色，避免同名變數同時表示 Float32Array 與 DataTexture。

- [x] **Step 2.3: 拆 floor runtime source 與 combined DataTexture**

目前 `r7310C1FullRoomDiffuseRuntimeTexture` 在 loader 內被設成 combined `DataTexture`。第一刀需改成：

```javascript
// 建議新增檔案內變數命名
// r7310C1FloorDiffuseRuntimePixels: Float32Array
// r7310C1NorthWallDiffuseRuntimeTexture: Float32Array, 保留既有名稱也可
// r7310C1FullRoomDiffuseRuntimeTexture: THREE.DataTexture, 保留給 uniform
```

驗收條件：

```text
1. floor atlas 讀回後，先存在 floor Float32Array。
2. north atlas 讀回後，先存在 north Float32Array。
3. combined DataTexture 由 refresh helper 建立。
4. 任一 slot 缺資料時，combined texture 仍可建立，但該 slot mode flag 必須是 0。
```

- [x] **Step 2.4: 改 `loadR7310C1FullRoomDiffuseRuntimePackage()`**

目標行為：

```text
1. 只載 floor pointer、validation、atlas。
2. 不強制 await north loader。
3. floor 載入成功後設定 floor ready。
4. refresh combined texture。
5. 呼叫 updateR7310C1FullRoomDiffuseRuntimeUniforms()。
```

保留條件：

```javascript
if (pointer.packageStatus !== 'architecture_probe' || pointer.runtimeScope !== 'c1_floor_full_room_diffuse_short_circuit')
	throw new Error('R7-3.10 full floor diffuse runtime pointer failed contract');
if (pointer.targetId !== R7310_C1_FLOOR_TARGET_ID || pointer.requestedSamples !== 1000 || pointer.diffuseOnly !== true || pointer.upscaled !== false)
	throw new Error('R7-3.10 full floor diffuse runtime package metadata mismatch');
```

- [x] **Step 2.5: 改 `loadR7310C1NorthWallDiffuseRuntimePackage()`**

目標行為：

```text
1. 只載 north pointer、validation、atlas。
2. north 載入成功後設定 north ready。
3. 若 floor package 已有 resolution，檢查 north resolution 一致。
4. refresh combined texture。
5. 呼叫 updateR7310C1FullRoomDiffuseRuntimeUniforms()。
```

- [x] **Step 2.6: 改 `ensureR7310C1FullRoomDiffuseRuntimeLoading()`**

目標行為：

```javascript
if (r7310C1FloorDiffuseRuntimeEnabled && !r7310C1FullRoomDiffuseRuntimeReady)
	loadR7310C1FullRoomDiffuseRuntimePackage().catch(function() {});
if (r7310C1NorthWallDiffuseRuntimeEnabled && !r7310C1NorthWallDiffuseRuntimeReady)
	loadR7310C1NorthWallDiffuseRuntimePackage().catch(function() {});
if (!r7310C1FloorDiffuseRuntimeEnabled && !r7310C1NorthWallDiffuseRuntimeEnabled)
	resetR738MainAccumulation();
```

- [x] **Step 2.7: 改 `updateR7310C1FullRoomDiffuseRuntimeUniforms()`**

目標行為：

```javascript
var captureMode = pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0;
var configAllowed = r7310C1FullRoomDiffuseRuntimeConfigAllowed();
var floorApplied = r7310C1FloorDiffuseRuntimeEnabled &&
	r7310C1FullRoomDiffuseRuntimeReady &&
	configAllowed &&
	captureMode === 0;
var northWallApplied = r7310C1NorthWallDiffuseRuntimeEnabled &&
	r7310C1NorthWallDiffuseRuntimeReady &&
	configAllowed &&
	captureMode === 0;
var applied = floorApplied || northWallApplied;
```

Uniform 更新目標：

```javascript
pathTracingUniforms.uR7310C1FullRoomDiffuseMode.value = applied ? 1.0 : 0.0;
pathTracingUniforms.uR7310C1FullRoomDiffuseReady.value = applied ? 1.0 : 0.0;
pathTracingUniforms.uR7310C1FloorDiffuseMode.value = floorApplied ? 1.0 : 0.0;
pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value = northWallApplied ? 1.0 : 0.0;
```

- [x] **Step 2.8: 改 `updateR738C1BakePastePreviewUniforms()`**

目標行為：

```javascript
var captureMode = pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0;
var r7310FloorRuntimeApplied = r7310C1FloorDiffuseRuntimeEnabled &&
	r7310C1FullRoomDiffuseRuntimeReady &&
	r7310C1FullRoomDiffuseRuntimeConfigAllowed() &&
	captureMode === 0;
var applied = r738C1BakePastePreviewEnabled &&
	r738C1BakePastePreviewReady &&
	r738C1BakePastePreviewConfigAllowed() &&
	captureMode === 0 &&
	!r7310FloorRuntimeApplied;
```

驗收條件：

```text
1. north runtime enabled 不會關掉 R7-3.8 嫩芽 paste。
2. floor runtime enabled 仍會依 floor 互斥規則關掉 R7-3.8 嫩芽 paste。
```

- [x] **Step 2.9: 更新 report 欄位**

`window.reportR7310C1FullRoomDiffuseRuntimeConfig()` 加入或保留足夠辨識資訊：

```javascript
floorReady: r7310C1FullRoomDiffuseRuntimeReady,
northWallReady: r7310C1NorthWallDiffuseRuntimeReady,
uniformFloorMode: pathTracingUniforms && pathTracingUniforms.uR7310C1FloorDiffuseMode ? pathTracingUniforms.uR7310C1FloorDiffuseMode.value : null,
uniformNorthWallMode: pathTracingUniforms && pathTracingUniforms.uR7310C1NorthWallDiffuseMode ? pathTracingUniforms.uR7310C1NorthWallDiffuseMode.value : null,
```

---

## Task 3: C' Bake UV 修正

**Files:**

| 類型 | 路徑 |
|---|---|
| Modify | `js/PathTracingCommon.js` |

- [x] **Step 3.1: 只改 bake capture path**

修改：

```glsl
vec2 r738BakeUv = (gl_FragCoord.xy + vec2(0.5)) / uResolution;
```

成為：

```glsl
vec2 r738BakeUv = gl_FragCoord.xy / uResolution;
```

保留：

```text
1. 正常 camera ray 的 pixelPos 不動。
2. r738C1BakeSurfacePoint / r7310C1BakeSurfacePoint 呼叫不改。
3. r738BakePoint + normal * EPS 起點不改。
```

- [x] **Step 3.2: 確認 R7-3.8 共用風險**

記錄在實作備註或 final：

```text
R7-3.8 sprout C1 包共用同一 bake capture path。
第一刀修改後，舊 sprout atlas 不會自動重烘。
本刀只驗 R7-3.10 floor / north 接縫；R7-3.8 sprout 視覺差異需另行判斷。
```

---

## Task 4: 靜態驗證

**Files:**

| 類型 | 路徑 |
|---|---|
| Verify | `docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js` |
| Verify | `js/InitCommon.js` |
| Verify | `js/PathTracingCommon.js` |
| Verify | `js/Home_Studio.js` |
| Verify | `docs/tools/r7-3-8-c1-bake-capture-runner.mjs` |

- [x] **Step 4.1: 跑 contract**

Run:

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected:

```text
R7-3.10 full-room diffuse bake architecture contract passed
```

- [x] **Step 4.2: 跑 syntax checks**

Run:

```bash
node --check js/InitCommon.js
node --check js/PathTracingCommon.js
node --check js/Home_Studio.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
```

Expected:

```text
各指令 exit code = 0
```

---

## Task 5: 最小瀏覽器 Smoke

**Files:**

| 類型 | 路徑 |
|---|---|
| Verify | `docs/tools/r7-3-8-c1-bake-capture-runner.mjs` |

- [x] **Step 5.1: Runtime short-circuit smoke**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --timeout-ms=180000
```

Expected:

```text
status: pass
```

- [x] **Step 5.2: North-wall runtime smoke**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-north-wall-runtime-test --timeout-ms=180000
```

Expected:

```text
status: pass
```

- [x] **Step 5.3: UI toggle smoke**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-ui-toggle-test --timeout-ms=180000
```

Expected:

```text
status: pass
```

- [ ] **Step 5.4: 手動 Console 檢查 north 與嫩芽共存**

在已開頁面 Console 執行：

```javascript
await window.waitForR7310C1FullRoomDiffuseRuntimeReady(60000);
window.setR738C1BakePastePreviewEnabled(true);
window.setR7310C1FloorDiffuseRuntimeEnabled(false);
window.setR7310C1NorthWallDiffuseRuntimeEnabled(true);
window.reportR738C1BakePastePreviewConfig();
```

Expected:

```text
uniformMode = 1
```

再執行：

```javascript
window.setR7310C1FloorDiffuseRuntimeEnabled(true);
window.reportR738C1BakePastePreviewConfig();
```

Expected:

```text
uniformMode = 0
```

---

## Task 6: 重烘 Floor / North Atlas

**Files:**

| 類型 | 路徑 |
|---|---|
| Output | `.omc/r7-3-10-full-room-diffuse-bake/<timestamp>/` |

- [x] **Step 6.1: 先跑 1000SPP floor**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=floor --samples=1000 --atlas-resolution=512 --timeout-ms=3600000
```

Expected:

```text
status: pass
package: .omc/r7-3-10-full-room-diffuse-bake/<timestamp>
```

- [x] **Step 6.2: 再跑 1000SPP north-wall**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=north-wall --samples=1000 --atlas-resolution=512 --timeout-ms=3600000
```

Expected:

```text
status: pass
package: .omc/r7-3-10-full-room-diffuse-bake/<timestamp>
```

- [x] **Step 6.3: 更新 runtime pointer**

只在 1000SPP smoke package pass 後更新：

```text
docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json
docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json
```

更新內容只改 packageDir 與該 package 對應必要 metadata。不得接入 east wall runtime。

- [ ] **Step 6.4: 高 SPP 夜間重烘**

使用者睡前可用已開頁面跑 17000SPP 版本，或由 runner 跑：

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=floor --samples=17000 --atlas-resolution=512 --timeout-ms=7200000
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --r7310-surface=north-wall --samples=17000 --atlas-resolution=512 --timeout-ms=7200000
```

Expected:

```text
status: pass
```

高 SPP package 需獨立記錄，不覆蓋 1000SPP smoke 結論。

---

## Task 7: 第一階段實機驗收

**Files:**

| 類型 | 路徑 |
|---|---|
| Verify | `http://127.0.0.1:9002/Home_Studio.html?v=r7-3-10-spp-cap-v1` |

- [ ] **Step 7.1: 同視角 A/B 驗 floor**

操作：

```text
1. 開同一個使用者驗收視角。
2. 地板烘焙：關；北牆烘焙：關。
3. 地板烘焙：開；北牆烘焙：關。
4. 比對東北衣櫃底部西側黑線。
```

Expected:

```text
西側黑線消失或明顯退掉。
沒有新增白線、亮格、大片髒貼回。
```

- [ ] **Step 7.2: 同視角 A/B 驗 north**

操作：

```text
1. 地板烘焙：關。
2. 北牆烘焙：關 / 開來回切。
3. 比對東北衣櫃頂部西側黑線。
4. 同時確認嫩芽仍存在。
```

Expected:

```text
north baked 開啟時，嫩芽仍存在。
北牆西側黑線消失或明顯退掉。
```

- [ ] **Step 7.3: Report 檢查**

Console:

```javascript
window.reportR7310C1FullRoomDiffuseRuntimeConfig();
window.reportR738C1BakePastePreviewConfig();
```

Expected:

```text
floorEnabled / northWallEnabled 與 UI 一致。
uniformFloorMode / uniformNorthWallMode 與 ready 狀態一致。
north enabled 時，R7-3.8 paste preview uniformMode 仍可為 1。
floor enabled 時，R7-3.8 paste preview uniformMode 為 0。
```

---

## Task 8: 收尾與文件同步

**Files:**

| 類型 | 路徑 |
|---|---|
| Modify | `docs/SOP/Debug_Log.md` |
| Modify | `docs/SOP/Debug_Log_Index.md` |
| Modify | `docs/superpowers/plans/2026-05-14-r7-3-10-c1-seam-debug-consensus-codex.md` |
| Modify | `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md` |

- [x] **Step 8.1: 更新本檔 checkbox**

完成哪些步驟就只勾哪些步驟，不預先勾後續項。

- [x] **Step 8.2: 更新 Debug_Log**

新增一段，至少包含：

```text
1. H8 runtime gate 修正摘要。
2. C' bake UV 修正摘要。
3. 新 floor / north package 路徑。
4. 同視角驗收結果。
5. 是否需要進 B' / H7 下一刀。
```

- [x] **Step 8.3: 更新 Debug_Log_Index**

新增或更新 R7-3.10 Phase 2 第一刀索引，指向本檔與 Debug_Log 段落。

- [x] **Step 8.4: 更新 seam debug consensus**

把 Phase 2 第一刀結果寫回 `2026-05-14-r7-3-10-c1-seam-debug-consensus-codex.md`，標明 H8 / C' 狀態與是否進 B' / H7。

---

## 鎖定禁區

| 禁區 | 理由 |
|---|---|
| 不回到整張 atlas flood-fill。 | 已造成白線與亮值污染。 |
| 不恢復舊 contact invalid region 修法。 | 先前路線已被使用者視覺回報與 OPUS 審查推翻。 |
| 第一刀不引入 alpha / valid fallback。 | 這屬於 H5 / H3' 第二輪；第一刀 H8 只用 mode flag 防取樣。 |
| 第一刀不實作 H5 / H3' alpha mask。 | 第一階段驗收後再看症狀是否仍存在。 |
| 第一刀不納入 East wall runtime。 | 現況 east wall 只作 bake / evidence 對照；runtime 沒有第三 slot。 |
| 第二刀不再修改 ACOUSTIC_PANEL 分支與 textures/gik244_*.jpeg。 | OPUS 已於 2026-05-15 完成 gik-north-rotate-uv-r4，使用者全 Config 驗收通過；改動清單見「2026-05-15 OPUS GIK 修復完成回報」。 |
| 不把 C' 修法套到 R7-3.8 既有 sprout atlas 結論。 | R7-3.8 sprout C1 包共用同一 bake UV 計算，需另行視覺判斷。 |

---

## 待辦總表

| 狀態 | 步驟 | 負責 |
|---|---|---|
| - [x] | Phase 2 設計：OPUS 初版與三輪修正。 | OPUS |
| - [x] | Phase 2 設計：CODEX 三輪審查。 | CODEX |
| - [x] | Phase 2 設計：CODEX / OPUS 第一輪設計共識成立。 | CODEX + OPUS |
| - [x] | 第一刀 TODO 展開。 | CODEX |
| - [x] | Task 1：contract test 先行。 | CODEX |
| - [x] | Task 2：H8 runtime gate 與 loader 隔離。 | CODEX |
| - [x] | Task 3：C' bake UV 修正。 | CODEX |
| - [x] | Task 4：靜態驗證。 | CODEX |
| - [x] | Task 5：最小瀏覽器 smoke 5.1 到 5.3；5.4 留給使用者已開頁面實機 Console。 | CODEX / 使用者 |
| - [x] | Task 6：重烘 floor / north 1000SPP atlas；17000SPP 夜間高 SPP 另跑。 | CODEX / 使用者夜間高 SPP |
| - [ ] | Task 7：第一階段實機驗收。 | 使用者 + CODEX |
| - [x] | Task 8：收尾與文件同步。 | CODEX |
| - [ ] | 下一刀：B' probe。 | 待第一刀結果 |
| - [ ] | 下一刀：H7 inside-geometry / ray-side guard。 | 待 B' probe |
| - [ ] | 第二輪：H5 / H3' alpha mask。 | 待第一刀與 H7 結果 |
| - [ ] | 第二輪：East wall runtime。 | 待使用者裁定 |
