# R7-3.10 嫩芽擴張計畫大綱 CODEX版

> **給執行代理：** 必讀子技能：使用 `superpowers:subagent-driven-development`（建議）或 `superpowers:executing-plans`，依任務逐步執行本計畫。步驟使用核取方塊（checkbox）語法追蹤。

**目標：** 用快速預覽模式低成本驗證「整間漫射烘焙 + 即時計算反射」架構，第一階段只做 C1；C1 成功後再用同架構類推 C2，判斷它是否能保留地板粗糙度 `0.1` 並降低初期噪點與運算負擔。

**架構：** 第一階段只做快速預覽模式架構驗證，不把快速預覽模式烘焙成果貼進趨近真實模式。R7-3.8 已證明嫩芽區漫射烘焙可行；R7-3.10 先將這個概念擴張到 C1 全室漫射，反射維持即時路徑追蹤（live path tracing），不再把 R7-3.9 反射烘焙當正式路線。若 C1 快速預覽模式架構成立，再類推 C2；若快速預覽模式架構成立，再用相同架構進入趨近真實模式正式全室烘焙。

**技術範圍：** 原生 JavaScript（Vanilla JavaScript）、網頁圖形函式庫第二版（WebGL2）、OpenGL 著色器語言（GLSL）片段著色器（fragment shader）、執行期物件（Three.js runtime objects）、斷言測試（Node.js assertion tests）、Chrome 開發者工具協定（Chrome DevTools Protocol）執行器（CDP runner）。

---

## 使用者鎖定目標

```markdown
1.  主要目標是先試整間漫射烘焙。
2.  第一輪使用快速預覽模式當烘焙基準，因為 C1 光源簡單，較容易取得剛好 1000SPP 的光照資料。
3.  快速預覽模式烘焙只用來驗證架構，不貼進趨近真實模式。
4.  架構若可行，再用趨近真實模式依照同架構做正式全室烘焙。
5.  反射不再走 R7-3.9 反射烘焙，改由即時路徑追蹤（live path tracing）計算。
6.  地板粗糙度 0.1 是使用者依真實米色大理石磁磚肉眼校準出的材質值，第一輪必須保留。
7.  如果改善效果很好，保留粗糙度 0.1，後續再加入英特爾開放影像降噪（OIDN, Intel Open Image Denoise）或其他降噪加速技術，服務趨近真實模式。
8.  如果改善效果不好，再把粗糙度 1.0 作為快速預覽模式的迭代可用性退路；趨近真實模式的材質參數不因此改變。
9.  執行順序先 C1；C1 成功後再類推 C2，C3、C4 較複雜，後續再擴。
10. C1 內部不可一次把所有表面全做；先建立全室表面清單，再依投資報酬排序（ROI）從高到低分批加入。
```

## 目前已知事實

```markdown
1.  R7-3.8 嫩芽區漫射烘焙已驗收可行。
2.  R7-3.8 目前的漫射專用套件（`diffuseOnly` package）儲存的是完整漫射輻射亮度（full diffuse radiance）。
3.  完整漫射輻射亮度（full diffuse radiance）的意思是：關閉地板鏡面分支後，照常跑路徑追蹤漫射輻射亮度（path-traced diffuse radiance）。
4.  它不是只有間接光（indirect-only）。
5.  執行期（runtime）讀取這種烘焙資料後不可再額外加直接光（direct light），否則會重複計光。
6.  R7-3.9 嫩芽 V2 反射烘焙已被 1SPP A/B 測試推翻。
7.  粗糙度 1.0 與粗糙度 0.1 對整體光照分布差異不大，但地板噪點型態差異明顯。
8.  粗糙度 0.1 較接近真實房間地板質感。
9.  快速預覽模式與趨近真實模式是兩個獨立渲染模式。
10. 趨近真實模式的所有參數，包含地板粗糙度 0.1，在 R7-3.10 範圍內不變動。
11. 任何加速收斂機制只能影響收斂速度，不可變動材質參數。
```

## 檔案結構

```markdown
docs/superpowers/plans/嫩芽擴張計畫大綱 CODEX版.MD
  本 SOP 大綱。明確鎖定 R7-3.10 範圍、驗收門檻與執行順序。

docs/superpowers/plans/2026-05-11-r7-3-8-c1-1000spp-bake-capture.md
  既有 R7-3.8 嫩芽區漫射烘焙流程的參考計畫。

docs/data/r7-3-8-c1-bake-accepted-package.json
  既有已驗收嫩芽區漫射套件（package）指標。除非 R7-3.10 建立新的套件（package）指標，否則只讀取參考。

.omc/r7-3-8-c1-1000spp-bake-capture/20260511-154229/manifest.json
  既有套件清單（package manifest），用來證明目前 R7-3.8 烘焙的 `diffuseOnly` 欄位為 `true`。

js/InitCommon.js
  既有擷取（capture）與套件（package）載入輔助函式（helper）。R7-3.10 應新增全室輔助函式（helper），不改動已驗收的 R7-3.8 語意。

js/PathTracingCommon.js
  既有擷取模式（capture mode）入口。若進入實作，R7-3.10 在這裡定義全室圖集（atlas）光線設定。

shaders/Home_Studio_Fragment.glsl
  既有輻射亮度（radiance）與貼回流程。若進入實作，R7-3.10 在這裡加入全室漫射查表與即時計算反射整合。

docs/tools/r7-3-8-c1-bake-capture-runner.mjs
  既有 Chrome 開發者工具協定（Chrome DevTools Protocol）執行器（CDP runner）。R7-3.10 可延伸或分出此執行器（runner），用於 C1 全室烘焙驗證；C1 通過後才加入 C2。

docs/SOP/Debug_Log.md
  執行後記錄架構探測（probe）結果、指令、成果檔與使用者目視裁決。
```

---

### 任務 1：記錄執行期（runtime）合約

**檔案：**

```markdown
建立或修改：docs/data/r7-3-10-full-room-diffuse-bake-contract.json
測試：docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

- [ ] **步驟 1：建立合約 JSON（contract JSON）**

使用以下內容：

```json
{
  "version": "r7-3-10-full-room-diffuse-bake-architecture-probe",
  "phase": "quick_preview_architecture_probe",
  "configs": [1],
  "nextConfigs": [2],
  "deferredConfigs": [3, 4],
  "bakeMode": "quick_preview",
  "quickPreviewSamples": 1000,
  "comparisonMode": "sample_milestones",
  "comparisonSampleMilestones": [100, 200, 500, 1000],
  "exactSamplesRequired": true,
  "acceptBelow1000": false,
  "acceptAbove1000": false,
  "finalTruthModeBake": false,
  "runtimeReflection": "live_path_tracing",
  "bakedRadianceKind": "full_diffuse_radiance",
  "indirectOnly": false,
  "directLightAlreadyIncluded": true,
  "addDirectLightAfterBakeLookup": false,
  "floorRoughnessPrimary": 0.1,
  "floorRoughnessFallback": 1.0,
  "floorRoughnessFallbackMeaning": "iteration_usability_fallback",
  "truthModeMaterialParametersMutable": false,
  "renderingModes": {
    "quickPreviewMode": {
      "displayName": "快速預覽模式",
      "floorRoughnessPrimary": 0.1,
      "floorRoughnessFallback": 1.0,
      "fallbackMeaning": "iteration_usability_fallback",
      "fallbackTrigger": "r7-3-10 架構 probe 無法降低快速預覽模式反射噪點"
    },
    "approachingTruthMode": {
      "displayName": "趨近真實模式",
      "floorRoughness": 0.1,
      "parametersFrozen": true,
      "fallbackAllowed": false,
      "purpose": "approaching_truth_reference",
      "purposeDisplayName": "採購決策以趨近真實模式為準",
      "accelerationOnly": "denoising or accumulation may be added; material parameters must not change"
    }
  },
  "surfaceRolloutStrategy": {
    "oneShotFullRoomBake": false,
    "orderBy": "roi_descending",
    "finalC1CoverageRequired": true,
    "finalMissingSurfaceNamesMustBeEmpty": true,
    "batches": [
      ["floor"],
      ["walls"],
      ["ceiling"],
      ["large_acoustic_panels", "door", "large_boxes", "large_static_furniture"],
      ["speaker_diffuse_shells", "speaker_stand_diffuse_components", "fixture_housings", "small_static_surfaces", "edges_and_corners"],
      ["reflective_surface_diffuse_components"]
    ]
  },
  "acceptedSproutBaseline": {
    "pointer": "docs/data/r7-3-8-c1-bake-accepted-package.json",
    "kind": "full_diffuse_radiance",
    "diffuseOnly": true
  },
  "invalidatedReflectionBake": {
    "pointer": "docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json",
    "runtimeEnabled": false
  },
  "successDecision": {
    "keepRoughnessPointOneWhen": [
      "c1_full_room_diffuse_paste_is_stable",
      "live_reflection_still_tracks_current_camera",
      "low_spp_noise_is_visibly_lower_than_unbaked_baseline"
    ],
    "useRoughnessOneFallbackWhen": [
      "full_room_diffuse_bake_does_not_reduce_noise_enough",
      "floor_reflection_remains_unusable_for_quick_preview_iteration"
    ]
  }
}
```

- [ ] **步驟 2：建立合約測試（contract test）**

使用以下內容：

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';

const contract = JSON.parse(fs.readFileSync('docs/data/r7-3-10-full-room-diffuse-bake-contract.json', 'utf8'));
const r738 = JSON.parse(fs.readFileSync('docs/data/r7-3-8-c1-bake-accepted-package.json', 'utf8'));
const r739 = JSON.parse(fs.readFileSync('docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json', 'utf8'));

assert.equal(contract.version, 'r7-3-10-full-room-diffuse-bake-architecture-probe');
assert.equal(contract.phase, 'quick_preview_architecture_probe');
assert.deepEqual(contract.configs, [1]);
assert.deepEqual(contract.nextConfigs, [2]);
assert.deepEqual(contract.deferredConfigs, [3, 4]);
assert.equal(contract.bakeMode, 'quick_preview');
assert.equal(contract.quickPreviewSamples, 1000);
assert.equal(contract.comparisonMode, 'sample_milestones');
assert.deepEqual(contract.comparisonSampleMilestones, [100, 200, 500, 1000]);
assert.equal(contract.exactSamplesRequired, true);
assert.equal(contract.acceptBelow1000, false);
assert.equal(contract.acceptAbove1000, false);
assert.equal(contract.finalTruthModeBake, false);
assert.equal(contract.runtimeReflection, 'live_path_tracing');
assert.equal(contract.bakedRadianceKind, 'full_diffuse_radiance');
assert.equal(contract.indirectOnly, false);
assert.equal(contract.directLightAlreadyIncluded, true);
assert.equal(contract.addDirectLightAfterBakeLookup, false);
assert.equal(contract.floorRoughnessPrimary, 0.1);
assert.equal(contract.floorRoughnessFallback, 1.0);
assert.equal(contract.floorRoughnessFallbackMeaning, 'iteration_usability_fallback');
assert.equal(contract.truthModeMaterialParametersMutable, false);
assert.equal(contract.renderingModes.quickPreviewMode.displayName, '快速預覽模式');
assert.equal(contract.renderingModes.quickPreviewMode.floorRoughnessPrimary, 0.1);
assert.equal(contract.renderingModes.quickPreviewMode.floorRoughnessFallback, 1.0);
assert.equal(contract.renderingModes.quickPreviewMode.fallbackMeaning, 'iteration_usability_fallback');
assert.equal(contract.renderingModes.approachingTruthMode.displayName, '趨近真實模式');
assert.equal(contract.renderingModes.approachingTruthMode.floorRoughness, 0.1);
assert.equal(contract.renderingModes.approachingTruthMode.parametersFrozen, true);
assert.equal(contract.renderingModes.approachingTruthMode.fallbackAllowed, false);
assert.equal(contract.renderingModes.approachingTruthMode.purpose, 'approaching_truth_reference');
assert.equal(contract.renderingModes.approachingTruthMode.purposeDisplayName, '採購決策以趨近真實模式為準');
assert.equal(contract.surfaceRolloutStrategy.oneShotFullRoomBake, false);
assert.equal(contract.surfaceRolloutStrategy.orderBy, 'roi_descending');
assert.equal(contract.surfaceRolloutStrategy.finalC1CoverageRequired, true);
assert.equal(contract.surfaceRolloutStrategy.finalMissingSurfaceNamesMustBeEmpty, true);
assert.deepEqual(contract.surfaceRolloutStrategy.batches[0], ['floor']);
assert.deepEqual(contract.surfaceRolloutStrategy.batches[1], ['walls']);
assert.deepEqual(contract.surfaceRolloutStrategy.batches[2], ['ceiling']);
assert.equal(contract.surfaceRolloutStrategy.batches.length, 6);

assert.equal(r738.packageStatus, 'accepted');
assert.equal(r738.diffuseOnly, true);
assert.equal(contract.acceptedSproutBaseline.kind, 'full_diffuse_radiance');

assert.equal(r739.runtimeEnabled, false);
assert.equal(contract.invalidatedReflectionBake.runtimeEnabled, false);

console.log('R7-3.10 full-room diffuse bake architecture contract passed');
```

- [ ] **步驟 3：執行合約測試（contract test）**

執行：

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

預期結果：

```markdown
R7-3.10 full-room diffuse bake architecture contract passed
```

---

### 任務 2：保留既有嫩芽區漫射基準

**檔案：**

```markdown
讀取：docs/data/r7-3-8-c1-bake-accepted-package.json
讀取：.omc/r7-3-8-c1-1000spp-bake-capture/20260511-154229/manifest.json
讀取：js/InitCommon.js
讀取：js/PathTracingCommon.js
讀取：shaders/Home_Studio_Fragment.glsl
測試：docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

- [ ] **步驟 1：確認目前 R7-3.8 烘焙語意**

確認以下事實：

```markdown
1.  docs/data/r7-3-8-c1-bake-accepted-package.json 的 `diffuseOnly` 欄位為 `true`。
2.  .omc/r7-3-8-c1-1000spp-bake-capture/20260511-154229/manifest.json 的 `diffuseOnly` 欄位為 `true`。
3.  js/InitCommon.js 的 `captureR738C1DirectSurfaceTexelPatch` 函式（function）會把 `uR738C1BakeDiffuseOnlyMode` 設成 1.0。
4.  js/PathTracingCommon.js 的擷取模式 2（capture mode 2）會從烘焙紋素表面點（bake texel surface points）發出光線。
5.  shaders/Home_Studio_Fragment.glsl 使用 `r738DiffuseOnlyActive` 阻擋地板菲涅耳（Fresnel）反射分支。
6.  既有程式沒有把烘焙拆成只有直接光（direct-only）或只有間接光（indirect-only）的通道（channel）。
```

- [ ] **步驟 2：保留 R7-3.8 已驗收指標（accepted pointer）不動**

不可修改：

```markdown
docs/data/r7-3-8-c1-bake-accepted-package.json
.omc/r7-3-8-c1-1000spp-bake-capture/20260511-154229/
```

- [ ] **步驟 3：在 R7-3.10 文件中記錄語意規則**

執行開始時，加入這句到 R7-3.10 實作筆記：

```markdown
R7-3.8 `diffuseOnly` 的意思是：關閉地板反射分支後得到完整漫射輻射亮度（full diffuse radiance）；執行期（runtime）烘焙查表後不可再加直接光（direct light）。
```

---

### 任務 3：加入 C1 全室烘焙表面覆蓋

**檔案：**

```markdown
修改：js/InitCommon.js
修改：js/PathTracingCommon.js
修改：shaders/Home_Studio_Fragment.glsl
測試：docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

- [ ] **步驟 1：定義 C1 表面目標（surface targets）**

先建立完整 C1 全室清單，再依投資報酬排序（ROI）分批加入。最終 C1 驗收仍要求全室覆蓋，但實作時不可一次把所有表面全做。

投資報酬排序（ROI）如下：

```markdown
1.  地板。
2.  牆面。
3.  天花板。
4.  大型吸音板、擴散板、牆上大型面板。
5.  門與大型垂直平面。
6.  大型箱體、櫃體、大型固定家具。
7.  喇叭本體的漫射外殼部分。
8.  喇叭架的非金屬漫射部分。
9.  燈具外殼、軌道、天花板附近固定結構的漫射部分。
10. 小型固定物件。
11. 細縫、邊角、踢腳線、牆角交界。
12. 高反射、金屬、鏡面材質本體只處理漫射成分；反射維持即時計算。
```

分批執行規則：

```markdown
1.  第一批：地板，單獨執行，作為 R7-3.8 嫩芽演算法擴大驗證（scale-up）試金石。
2.  第二批：牆面，驗證地板圖集（atlas）邊緣與牆面圖集（atlas）邊緣的接縫對齊。
3.  第三批：天花板，驗證牆面圖集（atlas）上緣與天花板圖集（atlas）邊緣的接縫對齊。
4.  第四批：大型吸音板、門、大型箱體、主要固定家具。
5.  第五批：喇叭漫射外殼、喇叭架漫射成分、燈具外殼、小型固定物件、邊角補洞。
6.  第六批，可選：反射表面漫射成分；只有 C1 存在可分離的反射表面漫射成分時才執行。
7.  每批都必須輸出覆蓋報告（coverage report）與舊架構 / 新架構對照。
8.  每批通過後才加入下一批。
9.  最終 C1 通過時，`missingSurfaceNames` 必須為空。
```

建立包含所有 C1 表面類別的表面目標表（surface target table）：

```js
const R7310_C1_FULL_ROOM_DIFFUSE_TARGETS = Object.freeze([
  { id: 1001, config: 1, name: 'c1_floor', kind: 'floor' },
  { id: 1002, config: 1, name: 'c1_walls', kind: 'wall' },
  { id: 1003, config: 1, name: 'c1_ceiling', kind: 'ceiling' },
  { id: 1004, config: 1, name: 'c1_large_objects', kind: 'object' },
  { id: 1005, config: 1, name: 'c1_small_static_surfaces', kind: 'small_static_surface' },
  { id: 1006, config: 1, name: 'c1_reflective_surface_diffuse_component', kind: 'reflective_surface_diffuse_component' }
]);
```

- [ ] **步驟 1a：讓 R7-3.10 目標編號（target IDs）使用獨立命名空間（namespace）**

使用以下命名空間（namespace）規則：

```markdown
1.  R7-3.10 目標編號（target IDs）必須命名與處理為 `r7310TargetId` 變數。
2.  Config 1 使用 1001-1099。
3.  C1 通過後，Config 2 才可使用 1101-1199。
4.  Config 3 後續可使用 1201-1299。
5.  Config 4 後續可使用 1301-1399。
6.  不可重用 R7-3.9 的目標編號 1-4。
7.  不可把 `r7310TargetId` 值傳入 `r739C1ReflectionTargetId` 邏輯。
```

- [ ] **步驟 2：依表面類型選擇圖集映射（atlas mapping）**

使用這組第一版映射規則。最終 C1 全室的意思是：每個靜態可見表面都必須有烘焙表示：

```markdown
1.  地板與天花板使用平面 x/z 映射（planar x/z mapping）。
2.  南北牆使用 x/y 映射（x/y mapping）。
3.  東西牆使用 z/y 映射（z/y mapping）。
4.  大型箱狀物件使用主可見面映射（dominant visible face mapping）。
5.  小型靜態表面必須出現在圖集（atlas）裡。
6.  反射或金屬表面保留即時計算反射，但它們的漫射成分仍必須出現在圖集（atlas）裡。
7.  C1 覆蓋報告（coverage report）必須說明地板、牆、天花板、大型物件、小型靜態表面、反射漫射成分是否都有覆蓋。
8.  每批執行時可記錄尚未加入的表面；最終 C1 架構探測（probe）通過的條件：`missingSurfaceNames` 必須為空。
```

- [ ] **步驟 3：加入擴張填邊（dilation）要求**

每個圖集區塊（atlas patch）都必須包含擴張填邊流程（dilation pass）或等效的邊界填色：

```markdown
1.  有效紋素（texels）必須向外擴張至少 4 像素。
2.  邊界無效紋素（texels）在雙線性濾波（bilinear filtering）取樣時不可維持黑色。
3.  擴張填邊（Dilation）必須納入驗證輸出（validation output）。
```

- [ ] **步驟 4：加入 C1 覆蓋報告（coverage report）要求**

每次 C1 烘焙都必須寫出覆蓋報告（coverage report），內容包含：

```markdown
1.  `config`
2.  `surfaceTargetCount`
3.  `coveredSurfaceNames`
4.  `missingSurfaceNames`
5.  `validTexelRatioBySurface`
6.  `dilationAppliedBySurface`
7.  `atlasPathBySurface`
8.  `allMajorSurfacesCovered`
9.  `allStaticVisibleSurfacesAccountedFor`
10. `allStaticVisibleSurfacesCovered`
```

---

### 任務 4：用快速預覽模式烘焙完整漫射輻射亮度（full diffuse radiance）

**檔案：**

```markdown
修改：js/InitCommon.js
修改：docs/tools/r7-3-8-c1-bake-capture-runner.mjs
寫入產物：.omc/r7-3-10-full-room-diffuse-bake/<timestamp>/
```

- [ ] **步驟 1：加入擷取選項（capture options）**

執行器（runner）必須支援：

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --config=1 --samples=1000 --angle=metal --timeout-ms=180000
```

- [ ] **步驟 2：烘焙內容**

圖集（atlas）儲存內容：

```markdown
1.  `fullDiffuseRadiance`
2.  `surfaceId`
3.  `worldPositionMetadata`
4.  `worldNormalMetadata`
5.  `validTexelMask`
6.  `configId`
7.  `requestedSamples`
8.  `actualSamples`
9.  `timedOut`
10. `coverageReport`
```

精確取樣規則：

```markdown
1.  `requestedSamples` 必須是 1000。
2.  `actualSamples` 必須剛好是 1000。
3.  `actualSamples` 低於 1000 時拒收 C1 烘焙成果。
4.  `actualSamples` 高於 1000 時拒收 C1 烘焙成果。
5.  `timedOut` 欄位為 `true` 時拒收 C1 烘焙成果。
6.  每個圖集（atlas）目標都必須回報 `actualSamples` 剛好 1000。
```

- [ ] **步驟 3：執行期（runtime）規則**

執行期（runtime）查表必須使用此規則：

```markdown
若路徑光線（path ray）命中已烘焙漫射表面：
  從圖集（atlas）讀取完整漫射輻射亮度（full diffuse radiance）；
  將 `mask * bakedRadiance` 加入 `accumCol`；
  結束該漫射分支。

這段規則的意思是：路徑光線（path ray）打到已烘焙漫射表面時，讀取圖集（atlas）中的完整漫射輻射亮度（full diffuse radiance），把 `mask * bakedRadiance` 加進 `accumCol`，然後結束該漫射分支。查表後不可再加直接光（direct light）。
```

- [ ] **步驟 4：反射規則**

反射維持即時計算：

```markdown
1.  主光線（Primary ray）打到粗糙度 0.1 的地板後，進入反射分支。
2.  反射光線（Reflection ray）與場景求交。
3.  如果命中已烘焙漫射表面，讀取完整漫射輻射亮度（full diffuse radiance）並結束。
4.  如果命中反射或金屬小物件，繼續即時路徑追蹤（live path tracing）。
```

- [ ] **步驟 5：鎖定執行期（runtime）短路位置**

烘焙查表必須發生在最早的有效命中點：

```markdown
1.  路徑光線（path ray）打到表面後，只要著色器（shader）已經有足夠資料判斷它是不是已烘焙漫射表面，就立刻檢查 R7-3.10 圖集（atlas）查表。
2.  如果命中已烘焙漫射表面，執行：
      `accumCol += mask * bakedRadiance;`
      結束這條路徑分支（path branch）。
3.  這個短路必須發生在下一事件估計（NEE）、漫射彈跳取樣、金屬 / 鏡面散射、或後續光線散射之前。
4.  不可跑路徑追蹤（path tracing）完整迴圈後，才把完成的 `accumCol` 跟烘焙值混合或覆蓋。
5.  如果實作無法把短路放在下一事件估計（NEE）/ 散射之前，這次架構探測（probe）標為無法判定，不可宣稱有加速結果。
```

儀表化（instrumentation）要求：

```markdown
1.  實作必須暴露已烘焙表面命中計數（`bakedSurfaceHitCount`）。
2.  實作必須暴露已烘焙表面短路計數（`bakedSurfaceShortCircuitCount`）。
3.  這些計數器（counters）可透過除錯報告（debug report）欄位、回讀緩衝（readback buffers），或其他執行器（runner）可讀取的明確診斷路徑輸出。
4.  每次比較執行的計數器（counters）必須分別記錄。
5.  全室烘焙啟用且畫面中有可見已烘焙表面時，兩個計數器（counters）都必須大於零。
6.  如果 `bakedSurfaceHitCount` 大於零，但 `bakedSurfaceShortCircuitCount` 是零，代表架構探測（probe）沒有通過短路診斷。
7.  如果執行器（runner）無法觀察計數器（counters），短路結果標為無法判定，不可宣稱有加速結果。
```

---

### 任務 5：比較舊架構與新架構的渲染成本

**檔案：**

```markdown
修改：docs/tools/r7-3-8-c1-bake-capture-runner.mjs
寫入產物：.omc/r7-3-10-full-room-diffuse-bake-comparison/<timestamp>/
```

- [ ] **步驟 1：擷取舊架構基準**

用同一個相機位置，以固定每像素取樣數（SPP）里程碑跑舊架構：

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=old --target-samples=100 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=old --target-samples=200 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=old --target-samples=500 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=old --target-samples=1000 --angle=metal
```

- [ ] **步驟 2：擷取新架構**

用同一個相機位置，以固定每像素取樣數（SPP）里程碑跑新架構：

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=full-room-diffuse-live-reflection --target-samples=100 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=full-room-diffuse-live-reflection --target-samples=200 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=full-room-diffuse-live-reflection --target-samples=500 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=full-room-diffuse-live-reflection --target-samples=1000 --angle=metal
```

- [ ] **步驟 3：記錄量測指標（metrics）**

每份報告必須包含：

```markdown
1.  `config`
2.  `mode`
3.  `targetSamples`
4.  `actualSamples`
5.  `wallClockMs`
6.  `samplesPerSecond`
7.  `floorRoughness`
8.  `fullRoomDiffuseBakeEnabled`
9.  `liveReflectionEnabled`
10. `nonFinitePixels`
11. `screenshotPath`
12. `userVisualNote`
```

- [ ] **步驟 4：決策門檻**

主要指標：

```markdown
1.  在相同每像素取樣數（SPP）里程碑下，新架構畫面乾淨度優於舊架構。
2.  在相同每像素取樣數（SPP）里程碑下，新架構噪點低於舊架構。
3.  粗糙度 0.1 的地板反射在 200SPP 到 500SPP 之間已可接受。
4.  C1 通過貼回穩定性檢查（paste stability checks）。
5.  最終 C1 覆蓋報告（coverage report）確認每個靜態可見表面都有覆蓋，且 `missingSurfaceNames` 為空。
```

加分指標：

```markdown
1.  達到相同 `targetSamples` 所需的 `wallClockMs` 低於舊架構。
2.  `samplesPerSecond` 高於舊架構。
3.  `samplesPerSecond` 達舊架構 2 倍以上是強正向訊號，但不是唯一驗收指標。
```

診斷觸發條件：

```markdown
1.  若每秒取樣數（`samplesPerSecond`）落在舊架構 1.3 倍與 2 倍之間，不立即判失敗（fail）。
2.  若視覺改善不穩定，不立即判失敗（fail）。
3.  進入短路診斷子任務。
4.  靜態確認烘焙查表位於下一事件估計（NEE）/ 散射之前。
5.  在執行期（runtime）確認啟用全室烘焙時，`bakedSurfaceHitCount` 與 `bakedSurfaceShortCircuitCount` 有被記錄，且兩者不是零。
6.  修正短路後，重新跑舊架構 / 新架構對照。
```

只有符合以下條件時，才判定改善效果不好：

```markdown
1.  相同每像素取樣數（SPP）里程碑下，畫面乾淨度沒有變好。
2.  同每像素取樣數（SPP）噪點沒有降低。
3.  粗糙度 0.1 的地板反射到 500SPP 仍不可用。
4.  全室貼回有可見接縫、映射錯誤，或遺漏未處理的表面。
5.  短路診斷證明烘焙查表位置正確，但架構仍沒有改善結果。
```

---

### 任務 6：依結果分流

**檔案：**

```markdown
修改：docs/SOP/Debug_Log.md
修改：docs/superpowers/plans/嫩芽擴張計畫大綱 CODEX版.MD
```

- [ ] **步驟 1：如果改善效果很好**

記錄：

```markdown
1.  保留地板粗糙度 0.1。
2.  用同一套快速預覽模式架構從 C1 擴張到 C2。
3.  C2 擴張也通過後，才把全室漫射烘焙架構提升為趨近真實模式的實作候選。
4.  另開英特爾開放影像降噪（OIDN, Intel Open Image Denoise）或其他降噪加速計畫，服務趨近真實模式流程。
5.  保持 R7-3.9 反射烘焙已推翻（invalidated）且執行期停用（runtime disabled）。
6.  不刪除 R7-3.9 資料（data）、文件（docs）、執行器掛鉤（runner hooks）、探測（probes）、報告（reports）。
```

- [ ] **步驟 2：如果改善效果不好**

記錄：

```markdown
1.  不把粗糙度 1.0 當成趨近真實模式的材質答案。
2.  粗糙度 1.0 只可作為快速預覽模式的迭代可用性退路。
3.  趨近真實模式保留粗糙度 0.1。
4.  趨近真實模式的所有材質參數保持不變。
5.  決定是否繼續降噪研究，或暫停反射恢復。
6.  保留 R7-3.9 已推翻（invalidated）證據；清理工作必須等 R7-3.10 完成後另開計畫。
```

- [ ] **步驟 3：除錯紀錄（Debug log）條目模板**

附加：

```markdown
### 2026-05-13 — R7-3.10 C1 全室漫射烘焙架構探測（probe）

- 範圍：C1 快速預覽模式全室漫射烘焙架構探測（probe）；C1 通過後才進 C2。
- 執行順序：先列完整 C1 全室清單，再依投資報酬排序（ROI）分批加入，不一次全做。
- 烘焙種類：完整漫射輻射亮度（full diffuse radiance），不是只有間接光（indirect-only）。
- 取樣數：C1 快速預覽模式烘焙剛好完成 1000SPP。
- 覆蓋：每個 C1 靜態可見表面都有覆蓋；`missingSurfaceNames` 為空。
- 反射：即時路徑追蹤（live path tracing）維持啟用。
- 地板粗糙度：`0.1` 保留為真實房間材質值。
- 基準：舊架構 100 / 200 / 500 / 1000SPP 渲染對照。
- 候選：全室漫射烘焙 + 即時計算反射 100 / 200 / 500 / 1000SPP 渲染對照。
- 成果檔：`.omc/r7-3-10-full-room-diffuse-bake-comparison/<timestamp>/`。
- R7-3.9：已推翻（invalidated）證據保留；執行期（runtime）維持停用。
- 決策：`<保留粗糙度 0.1 / 粗糙度 1.0 只作為快速預覽模式迭代可用性退路 / 繼續調查>`。
```

---

## 驗收門檻

```markdown
1.  R7-3.8 已驗收嫩芽區漫射基準保持不動。
2.  R7-3.9 反射烘焙在執行期（runtime）驗收上維持已推翻（invalidated）。
3.  R7-3.9 資料（data）、文件（docs）、執行器掛鉤（runner hooks）、探測（probes）、報告（reports）都保留為已推翻（invalidated）證據。
4.  第一階段只執行 C1。
5.  C1 通過前不執行 C2；C3 與 C4 不納入第一階段。
6.  C1 內部依投資報酬排序（ROI）分批加入，不一次全做。
7.  每批通過後才加入下一批。
8.  C1 全室烘焙剛好完成 1000SPP。
9.  C1 烘焙成果若 `actualSamples` 低於或高於 1000，一律拒收。
10. C1 烘焙成果若 `timedOut` 欄位為 `true`，一律拒收。
11. 最終 C1 覆蓋報告（coverage report）確認每個靜態可見表面都有覆蓋，且 `missingSurfaceNames` 為空。
12. R7-3.10 目標編號（target IDs）使用 1001+ 命名空間（namespace），不重用 R7-3.9 的目標編號 1-4。
13. 烘焙資料明確記錄為完整漫射輻射亮度（full diffuse radiance）。
14. 執行期（runtime）讀取完整漫射輻射亮度（full diffuse radiance）後不再加直接光（direct light）。
15. 執行期（runtime）在下一事件估計（NEE）/ 散射之前短路已烘焙漫射命中，並記錄命中 / 短路計數。
16. 反射維持即時路徑追蹤（live path tracing）。
17. 地板粗糙度 0.1 維持第一候選。
18. 粗糙度 1.0 只可作為快速預覽模式的迭代可用性退路。
19. 趨近真實模式材質參數不受這次探測（probe）變動。
20. C1 舊架構與新架構各有 100 / 200 / 500 / 1000SPP 截圖（screenshots）與量測指標（metrics）。
21. 使用者目視判斷決定改善效果是否足夠。
22. Debug_Log 記錄決策與成果檔路徑。
```

## 指令

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-full-room-diffuse-bake --config=1 --samples=1000 --angle=metal --timeout-ms=180000
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=old --target-samples=1000 --angle=metal
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=full-room-diffuse-live-reflection --target-samples=1000 --angle=metal
git diff --check -- docs/superpowers/plans/嫩芽擴張計畫大綱\ CODEX版.MD docs/data/r7-3-10-full-room-diffuse-bake-contract.json docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js js/InitCommon.js js/PathTracingCommon.js shaders/Home_Studio_Fragment.glsl docs/tools/r7-3-8-c1-bake-capture-runner.mjs docs/SOP/Debug_Log.md
```

## 自我審查結果

```markdown
規格覆蓋：
  本 SOP 已覆蓋使用者目標：快速預覽模式先做 C1 全室漫射烘焙、反射即時計算、C1 內部依投資報酬排序（ROI）分批加入且不一次全做，並將地板、牆面、天花板拆成前三個獨立批次以分別驗證擴大驗證（scale-up）與接縫風險、C1 快速預覽模式烘焙剛好 1000SPP、渲染比較改用 100 / 200 / 500 / 1000SPP 里程碑而非固定時間、最終所有 C1 靜態可見表面都有覆蓋且 `missingSurfaceNames` 為空、改善效果好就保留粗糙度 0.1、粗糙度 1.0 只作為快速預覽模式迭代可用性退路、C1 通過後才擴張到 C2。

占位文字掃描：
  沒有使用延後補上的占位文字。需要寫程式才能決定的執行細節，已表達為任務與驗收門檻。

型別一致性：
  本計畫一致使用 r7-3-10-full-room-diffuse-bake-architecture-probe 作為路線名稱，並將烘焙資料視為完整漫射輻射亮度（full_diffuse_radiance）。
```
