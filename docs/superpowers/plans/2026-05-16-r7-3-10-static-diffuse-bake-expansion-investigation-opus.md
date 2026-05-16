# R7-3.10 全相關靜態漫射面烘焙 — Read-Only 調查交接草案（OPUS → CODEX）

日期：2026-05-16
作者：OPUS（Claude Opus 4.7）
性質：**純調查 / 規劃草案。本輪未改任何 code / MD / pointer，未做任何 Git 動作。**
目標讀者：CODEX（後續實作代理）
前置分支現況：`codex/r7-3-10-integration`（CODEX step A 完成、OPUS 審查通過，僅作本機整合保存，本輪不碰其 Git 收尾）
實作開分支建議：若要改 code / MD / pointer，下一輪先從現狀開 `codex/r7-3-10-static-bake-expansion`，勿直接改 `codex/r7-3-10-integration`

> 本文自包含。CODEX 不必回頭讀其他檔即可接手。所有檔案路徑相對專案根
> `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/`。
> 行號來自 OPUS 程式追蹤代理 + `2026-05-14-r7-3-10-c1-seam-debug-consensus-opus.md`
> 雙重佐證；shader 檔仍在演進，CODEX 動工前請以 grep 重新定位確切行號（標為「待 CODEX 查證」處同此原則）。

---

## 0. 名詞對照（給非圖學讀者）

- bake / 烘焙：把某面收斂後的光照結果（radiance, 輻射亮度）預先算好存成貼圖（atlas, 圖集），執行時直接查表，不再即時光線追蹤。
- LIVE / 即時：該面照常跑 path tracing（路徑追蹤）即時計算。
- short-circuit / 短路：光線命中已烘焙面時，直接取烘焙值並中止這條路徑（break），不再往下彈跳。
- accumCol：shader 內累積像素最終色的變數；mask 是路徑沿途的能量穿透係數（throughput）。
- partial bake / 部分烘焙：只有部分面烘焙、其餘維持 LIVE 的過渡狀態。
- 全相關靜態漫射面：C1 場景內所有「靜態 + 漫射（無反射/金屬/動態）」且對畫面光照有貢獻的面。

---

## 1. 現有 floor/north bake 與 LIVE 混用偏亮的程式路徑整理

### 1.1 烘焙資料如何取樣

- 取樣器（sampler）：`tR7310C1FullRoomDiffuseAtlasTexture`，單一張「合併 atlas」：左半 slot 0 = 全地板，右半 slot 1 = 北牆（兩格）。
- 取樣函式：`shaders/Home_Studio_Fragment.glsl`
  - `r7310C1FullRoomDiffuseSample(vec2 atlasUv)` 約 L478–481：`texture(...).rgb`，**只取 .rgb，alpha 被丟棄**。
  - `r7310C1CombinedAtlasUv(localUv, patchSlot)` 約 L482–488：用 `uR7310C1RuntimeAtlasPatchResolution`(512 或 1024) 與 `uR7310C1RuntimeAtlasPatchCount`(=2) 算出半 texel 內縮後的合併 UV。
- 「此命中是 bake 還是 LIVE」決策函式（核心）：`r7310C1FullRoomDiffuseShortCircuit(...)` 約 **L548–574**
  - L551 `if (uR738C1BakeCaptureMode != 0) return false;`（bake-capture 時不短路，防 bake 吃 bake，Option B）
  - L553 `uR7310C1FullRoomDiffuseMode < 0.5 || ...Ready < 0.5` → false（主開關 / 載入閘）
  - L555 `if (visibleIsRayExiting == TRUE) return false;`（H7 guard：光線正穿出實體 → 非有效正面）
  - L558–564 地板分支：`uR7310C1FloorDiffuseMode>0.5 && r7310C1RuntimeSurfaceIsTrueFloor(...) && r7310C1BakePastePreviewUv(...)` → 取 slot 0 → return true
  - L565–572 北牆分支：`uR7310C1NorthWallDiffuseMode>0.5 && r7310C1RuntimeSurfaceIsNorthWall(...) && r7310C1NorthWallDiffuseUv(...)` → 取 slot 1 → return true
- 面身分判定（不靠 hitType，靠 objectID + 法線 + 世界座標框）：
  - `r7310C1RuntimeSurfaceIsTrueFloor` 約 L489–494：`objectID<1.5 && normal.y>0.5 && position.y<=0.025`
  - `r7310C1RuntimeSurfaceIsNorthWall` 約 L495–505：`objectID<1.5 && normal.z>0.5 && z∈[-1.88,-1.86] && x∈[-2.11,2.11] && y∈[0,2.905]`
- runtime 載入與 uniform 推送：`js/InitCommon.js`
  - `loadR7310C1FullRoomDiffuseRuntimePackage()` 約 L1467–1517（地板，讀 pointer JSON → 驗 contract → 讀 f32 atlas → 建合併貼圖 → ready=true）
  - `loadR7310C1NorthWallDiffuseRuntimePackage()` 約 L1519–1567（北牆，slot 1，平行結構）
  - `buildR7310C1CombinedDiffuseRuntimeTexture()` 約 L1288–1323（左半 floor、右半 north；`THREE.DataTexture`、`FloatType`、`NearestFilter`、無 mipmap、`flipY=false`）
  - `updateR7310C1FullRoomDiffuseRuntimeUniforms()` 約 L1237–1271：`applied = floorApplied || northWallApplied`，任一面開啟即 applied=true；推 mode/ready/floor/north flag、atlas、`uR7310C1RuntimeAtlasPatchResolution`(=`r7310C1RuntimeAtlasResolution()` L1273–1279 回傳 pointer.targetAtlasResolution)、`uR7310C1RuntimeAtlasPatchCount=2`。
  - 合併解析度防呆：`js/InitCommon.js` 約 L1548–1550（floor/north 解析度不一致會擋）。
  - 套件 URL 常數：`js/Home_Studio.js` 約 L1067–1069；uniform 預設：`js/Home_Studio.js` 約 L5444–5459。

### 1.2 baked radiance 怎麼加進 accumCol、break 在哪

唯一生產消費點：`shaders/Home_Studio_Fragment.glsl`，`CalculateRadiance()` 內 `if (hitType == DIFF)` 分支（分支起點約 L2942），短路消費段約 **L2994–L3036**：

```glsl
vec3 r7310BakedRadiance = vec3(0.0);
if (r7310C1FullRoomDiffuseShortCircuit(hitType, hitObjectID, nl, x, hitIsRayExiting, r7310BakedRadiance))
{
    // L2997+ probe modes（uR7310C1RuntimeProbeMode>0.5 才啟用，正常算圖時不走）
    else
        accumCol += mask * r7310BakedRadiance;   // ★ L3034 生產唯一累加點
    break;                                       // ★ L3035 路徑在此終止
}
```

- accumCol / mask 初始化約 L1861–1862（`accumCol=vec3(0); mask=vec3(1)`）。
- 命中迴圈：約 L1918–1920 `for (bounces<14)`，內含 `if (bounces>=uMaxBounces) break;`。
- 若**未**短路（LIVE 漫射）：約 L3037 起 `diffuseCount++`、L3039 `mask *= hitColor`、L3046–3053 排 cosine BSDF 反彈、L3055–3070 隨機 NEE、L3070 `continue`（繼續多次反彈，靠多 sample 平均收斂）。
- 函式回傳約 L3217 `return max(vec3(0), accumCol);`。

> 行號對位：consensus-opus 文件記此段為 L2992–3033，OPUS 追蹤代理量到生產行為 L3034 / break L3035。差異源於 probe 模式行數與檔案演進，**確切現行行號待 CODEX 動工前以 grep 重定**。語義一致無歧義。

### 1.3 為何形成「部分 bake + LIVE」亮差（CODEX 已接受之根因）

依 `2026-05-14-r7-3-10-c1-seam-debug-consensus-opus.md` L1167–1182（標題「partial bake vs LIVE 亮差根因（程式碼實證，CODEX 已接受）」）：

- 現象：只開地板烘焙 → 北牆(LIVE)偏亮；地板+北牆都烘 → 北牆正常；LIVE 與烘焙雙開 → 櫃子(LIVE)偏亮。SPP 100 即定型，**非採樣未收斂假象**。
- 根因 = **深度相加**：命中烘焙面時 `accumCol += mask * r7310BakedRadiance; break;`。LIVE 光線用 k 段反彈抵達烘焙面，而烘焙值內已含「自該面再 N 次反彈」的收斂解 → 該條路徑總有效深度變成 k+N，未重新封頂在 N（`uMaxBounces` 預設 4，`js/Home_Studio.js` 約 L6480 快速預覽；烘焙走同 shader、同 uniform，**非無限深**；OPUS 早期「幾乎無限深」陳述已作廢）。
- 判定：這是 **partial bake 過渡狀態的交界假象**；全相關面都烘焙時交界消失、自解。**非缺陷、非拒收 1024 的理由。**
- 正式驗收基準已改為：**全相關靜態漫射面 bake vs 全 LIVE（雙方皆 4 次反彈）**，不再以 partial bake vs full LIVE 作接受/拒收標準。

OPUS 程式追蹤代理之補充實證（與上述一致，並指出機制細節）：

- `r7310C1FullRoomDiffuseShortCircuit`(L548–574) 與呼叫點(L2994–2995)**沒有 `bounces==0` / primary-ray 閘**。亦即 LIVE 面的「間接反彈光線」或 NEE 光線打到烘焙面時也會短路、注入完整收斂烘焙值再 break；這正是 k+N 深度相加在程式碼上的成因。
- 目前 `r7310C1FullRoomDiffuseSample` 只取 `.rgb`、丟棄 alpha；seam-policy 草案規畫的 alpha fall-through / OCCLUDER_TABLE / SURFACE_REGISTRY 尚未實作（見 `2026-05-13-r7-3-10-c1-seam-policy.md` L184–199）。
- **待 CODEX 查證**：(a) 「短路在所有 bounce 觸發、無 primary-ray 閘」是刻意設計或缺口（程式無註解陳述意圖）；(b) bake 積分核確為「完整漫射多反彈」——依嫩芽擴張大綱「目前已知事實 2–5」，R7-3.8 `diffuseOnly` 套件儲存的是關閉地板鏡面分支後照常 path-traced 的**完整漫射 radiance（含直接+間接，非 indirect-only）**，runtime 查表後**不可再加直接光**否則重複計光——此點文件已明定，CODEX 仍宜在實作前以 manifest `diffuseOnly:true` 復核；(c) `uIndirectMultiplier` / `uLegacyGain`(約 L3061) / `uMaxBounces` 在 bake-capture pass 與 live render 是否對稱，任何不對稱都是獨立的全域亮度偏移源。

---

## 2. 下一階段「全相關靜態漫射面烘焙」候選面清單

基礎事實（CODEX 動工前必懂）：

- `addBox` 工廠：`js/Home_Studio.js:69`，簽名 `addBox(min,max,emission,color,type,meta,cullable,fixtureGroup,roughness,metalness,rotateUV90)`。
- `type` 直接對應 shader `hitType`（`shaders/Home_Studio_Fragment.glsl:1586 hitType = boxType;`）；數值常數見 `js/PathTracingCommon.js:38-57`（`LIGHT=0 DIFF=1 SPEC=3 ...`）。
- **結構 objectID 塌縮**：sceneBoxes index 0–31（地板/天花板/四面牆/樑/角柱）全塌成 objectID=1（shader L1597）。**無法用 hitType 或 objectID 區分這些面**，現行程式一律靠「法線 + 世界座標框」判定（`r7310C1RuntimeSurfaceIsTrueFloor/NorthWall/EastWall` L489–516）。
- 反射風險定論：DIFF 分支內僅**地板**有 Fresnel 鏡面子路徑（shader 約 L2950–2984，`uFloorRoughness<0.999` 觸發）；牆/天花板法線非 +Y 不進此閘，且結構盒 metalness=0，**牆與天花板反射/鏡面風險為零**。

### (A) 已完成烘焙

| 面 / box idx | 檔:行 | 角色 | type/hitType | 備註 |
|---|---|---|---|---|
| 地板 0a–0i（sceneBoxes 0–6） | `js/Home_Studio.js:81-87` | 地板 | type=1 DIFF, C_FLOOR | 閘 `uR7310C1FloorDiffuseMode`；偵測 `r7310C1RuntimeSurfaceIsTrueFloor`(L489)；有 Fresnel 鏡面子路徑（R7-3.9 反射套件處理） |
| 北牆 2a/2b/3a/3b/4（sceneBoxes 7–11） | `js/Home_Studio.js:97-102` | 北牆 | type=1 DIFF, C_WALL | 閘 `uR7310C1NorthWallDiffuseMode`；偵測 `r7310C1RuntimeSurfaceIsNorthWall`(L495)；UV 排除門洞 x∈[-1.52,-0.73] y∈[0,2.03]（shader 約 L524）；純 Lambertian |

### (B) 強候選（純靜態漫射、無反射/動態風險）

全為 type=1 DIFF、boxIdx≤31→objectID=1、自動 roughness 0.9 / metalness 0.0：

| 面 / box idx | 檔:行 | 角色 | 適合 bake | 反射風險 | 動態/互動風險 |
|---|---|---|---|---|---|
| 東牆 #5（idx 12） | `js/Home_Studio.js:103` | 東牆 | 是 | 無 | cullable=1 X-ray；**scaffold 已存在** |
| 南牆 6a/6b/7a/7b/#8（idx 13–17） | `js/Home_Studio.js:105-110` | 南牆 | 是 | 無 | cullable=1 X-ray；#8 為窗台下段需 UV 排除 |
| 西牆 #9/#10/#11（idx 18–20） | `js/Home_Studio.js:111-113` | 西牆 | 是 | 無 | cullable=1 X-ray；西牆有鐵門區需排除 |
| 天花板 1a–1i（idx 21–27） | `js/Home_Studio.js:89-95` | 天花板 | 是 | 無（法線 −Y） | cullable=1 頂面 cull |

東牆是**最強單一候選**：scaffold 已存在 — `r7310C1RuntimeSurfaceIsEastWall`(shader L506)、`r7310C1EastWallDiffuseUv`(shader L535)、`loadR7310C1EastWallDiffuseRuntimePackage`(`js/InitCommon.js:1569`)、`captureR7310C1EastWallDiffuseAtlas`(`js/InitCommon.js:2202`)、`reportR7310C1EastWallDiffuseBakeAfterSamples`(`js/InitCommon.js:2466`)，且工作區已有未追蹤套件 `docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json`。西牆/南牆/天花板**無 scaffold**，須照東牆樣板新建偵測器 + UV + capture 函式。

> 群組風險：B 段全部 cullable=1（R2-13 X-ray 雙層 cull）。既有 floor/north 已用 `visibleIsRayExiting==TRUE` 早退（shader L555）+ per-surface 開關處理；新面須沿用同一 pattern。cull 僅是可見性閘、非 CONFIG 變體、非幾何位移，烘焙 radiance 仍有效，只是不可把烘焙值貼到「正穿出（exiting-ray）」的命中。

### (C) 條件候選（可烘焙但有特定風險須先解）

| 面 / box idx | 檔:行 | 角色 | 風險 |
|---|---|---|---|
| 西樑 #12 / 東樑 #13（idx 28,29） | `js/Home_Studio.js:114-115` | 牆面橫樑 C_BEAM | objectID=1 會誤過牆偵測器；需獨立 UV island 或比照門洞排除 |
| SW/SE 角柱 #14/#15（idx 30,31） | `js/Home_Studio.js:116-117` | 角柱 C_BEAM | **cullable=3 單軸 cull**，貼回閘須改用單軸可見性；面積小、報酬低 |
| 東牆櫃 #16（idx 32）、南系統桌 #17、SW 抽屜 #18、SE 書架 #19、工作桌 #20、層架 21–24、冷氣本體 #35 | `js/Home_Studio.js:120-150` | 固定家具/木質 | 靜態、cullable=0、objectID 唯一（非 <1.5），需「依 objectID 比對」的專屬偵測器；木質 r0.7 仍純漫射；桌面上方靜態遮擋陰影須一併烘入（可接受，皆靜態） |

### (D) 禁止烘焙（反射/貼圖/動態/互動/自發光）

| 物件 | 檔:行 | 排除原因 |
|---|---|---|
| 北木門 #25 type=7 WOOD_DOOR | `js/Home_Studio.js:133` | 木紋貼圖取樣（shader L2356），非平漫射 |
| 西鐵門 #26 type=8 IRON_DOOR | `js/Home_Studio.js:134` | metalness 1.0 roughness 0.3，鏡面 reflect()（shader L2419）；亦 R7-3.9 反射目標 |
| 窗外景 #27 type=5 BACKDROP | `js/Home_Studio.js:135` | 貼圖影像（shader L2272），非室內漫射面 |
| KH750 超低音 #28 type=9 | `js/Home_Studio.js:138` | 貼圖 + reflect() 子路徑（shader L2454-2481） |
| 插座 29–34 type=11 OUTLET | `js/Home_Studio.js:141-146` | 次公分細件、獨立貼圖分支、報酬可忽略 |
| 冷氣出風口 #36 C_DARK_VENT(0,0,0) | `js/Home_Studio.js:150` | 純黑 albedo 0，烘焙零值無意義 |
| 軌道座/臂 37–48 type=13 TRACK | `js/Home_Studio.js:155-172` | fixtureGroup 1/2 動態開關、軌距滑桿可移動、BVH 重建、reflect() 子路徑 |
| Cloud 吸音板 49–54 type=10 | `js/Home_Studio.js:178-183` | fixtureGroup=3、`uCloudPanelEnabled` 動態；亦 Cloud-NEE 源 |
| Cloud 燈條 55–58 type=14 CLOUD_LIGHT | `js/Home_Studio.js:195-198` | **自發光源**，非受光面，烘焙無效 |
| Cloud 鋁框/內板（idx 75–82） | `js/Home_Studio.js:201-208` | **metalness 1.0** 全金屬反射；fixtureGroup=4 動態 |
| GIK 面板 panelConfig1/2 | `js/Home_Studio.js:243-260, 449-454` | **CONFIG 切換**，幾何數量與位置 runtime 變動，本質非靜態 |
| 喇叭/喇叭架/隔離墊（uniform 驅動，不在 sceneBoxes） | shader L1668-1691 | 反矩陣 uniform 驅動可移動，transform 動態 |

> 最大正確性陷阱：結構 objectID 塌縮（floor+ceiling+四牆+樑+柱 全 objectID=1）。新面務必各自寫「緊的法線+世界座標 predicate」，且與牆面重疊的樑/角柱要像北牆門洞那樣明確從牆 UV 挖除（shader 約 L524–528）。

---

## 3. 推薦擴張順序

原則：根因是「partial bake↔LIVE 交界深度相加」，**全相關面都烘焙時自解**。故擴張優先讓「對畫面光照貢獻大、且與已烘焙面相鄰」的面先進，最快縮小交界面積；每步單獨驗收、不一次全開（嫩芽擴張大綱「使用者鎖定目標」10 + 任務 3 分批規則）。

建議批次（沿用嫩芽擴張大綱 ROI 投資報酬排序，並依 scaffold 現況微調）：

1. **東牆 #5**：scaffold + 候選 runtime 套件已存在，最低工、最高信心。先把 floor+north+east 變成第一組「三面相鄰已烘焙」樣本，直接縮小最明顯的櫃體交界。
2. **西牆 + 南牆**：照東牆樣板新建偵測器/UV/capture；注意西牆鐵門區、南牆 #8 窗台下段比照北牆門洞做 UV 排除。
3. **天花板 1a–1i**：純 Lambertian、法線 −Y；偵測器可鏡像 `cloudDirectNeeSourceIsCeiling`(shader 約 L328) 的 `normal.y<-0.5 && position.y>2.8`；Cloud 板/軌道屬動態，天花板烘焙須在其關閉狀態下烤、或明定其為被排除受光體。
4. **大型靜態家具（C 段）**：東牆櫃 #16、工作桌 #20、系統桌 #17，各需 objectID 專屬偵測器；報酬次於牆面。
5. **樑 #12/#13、角柱 #14/#15**：僅在有獨立 UV island 或明確從牆 UV 挖除時才做；cullable=3 角柱需單軸 cull-aware 貼回閘。

每批執行後必出覆蓋報告（coverageReport）與舊/新架構對照；每批通過才加下一批；最終 C1 通過時 `missingSurfaceNames` 必須為空（嫩芽擴張大綱驗收門檻 11）。target ID 用 1001–1099 命名空間，不重用 R7-3.9 的 1–4（大綱任務 3 步驟 1a）。

---

## 4. 驗收方法

### 4.1 全 LIVE vs 全相關面 bake 的比較方式

- 正式基準（Debug_Log 開篇 + 1024-plan Task 10 + consensus L1180–1182）：**全相關靜態漫射面 bake（皆 4 次反彈） vs 全 LIVE（皆 4 次反彈）**。不再用 partial bake vs full LIVE 當接受/拒收標準。
- 固定相機、固定 SPP 里程碑 100 / 200 / 500 / 1000 各跑舊架構與新架構（嫩芽擴張大綱任務 5）：
  - 舊：`node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-render-comparison --config=1 --mode=old --target-samples=<N> --angle=metal`
  - 新：同上 `--mode=full-room-diffuse-live-reflection`
- 每報告須含 `config/mode/targetSamples/actualSamples/wallClockMs/samplesPerSecond/floorRoughness/fullRoomDiffuseBakeEnabled/liveReflectionEnabled/nonFinitePixels/screenshotPath/userVisualNote`。
- bake 本身：剛好 1000 SPP；`actualSamples≠1000` 或 `timedOut=true` 一律拒收（大綱任務 4 步驟 2）。
- 短路儀表：`bakedSurfaceHitCount` 與 `bakedSurfaceShortCircuitCount` 兩者均須 >0；hit>0 但 shortCircuit=0 視為短路診斷未過（大綱任務 4 步驟 5）。現行 smoke 基準值 96170 / 190559（H7/H8/C' 無退化基準，consensus L1160）。

### 4.2 哪些 partial-bake 畫面只能當診斷、不能當拒收依據

- **partial bake + LIVE 的局部偏亮（深度相加過渡假象）不可作為拒收依據**（1024-plan Task 8 Step 2 + consensus L1178–1179）。它只能當「擴張未完成」的診斷訊號，不能當最終品質判決。
- 黑線類驗收已於 1024 解決（floor/north 兩條衣櫃黑線使用者肉眼確認消失）；新面驗收沿用「同視角 atlas-on / atlas-off ROI 量測」visual diff harness（seam-policy 必補測試 6）。
- 拒收只在以下成立時（大綱任務 5「只有符合以下條件才判改善不好」）：同 SPP 乾淨度沒變好、噪點沒降、地板 r0.1 反射到 500SPP 仍不可用、全室貼回有可見接縫/映射錯誤/漏面、短路診斷證明位置正確但架構仍無改善。

### 4.3 需要的 runner / console probe / 使用者肉眼視角

- runner：`docs/tools/r7-3-8-c1-bake-capture-runner.mjs`（bake / render-comparison / h5-black-line-probe / runtime-short-circuit-test）；`docs/tools/r7-3-10-h5-nearest-interval.mjs`（解析度感知離線間隔 probe）；`docs/tools/r7-3-10-step-c-d-analyze.mjs`（工作區未追蹤，**待 CODEX 查證**其用途與是否納入流程）。
- console setter：`window.setR7310C1FloorDiffuseEnabled(bool)`、`window.setR7310C1NorthWallDiffuseEnabled(bool)`（新面須比照新增 per-surface setter）。
- 驗收 URL：1024-plan 用 `http://localhost:9002/Home_Studio.html?v=<變更碼>`；專案 CLAUDE.md 標準 server 為 `python3 -m http.server 9001` → `http://localhost:9001/Home_Studio.html`。**port 不一致，CODEX/使用者驗收前先查實際 server port 再貼正確網址**（待 CODEX 查證）。
- seam-policy 必補測試（六項，下一輪設計階段落地）：seam continuity（共邊 texel pair 相對 luma 差 <0.10）、dilation contamination、reprojection gate、alpha fall-through（alpha=0 texel 不得短路）、atlas filter feasibility（記錄 Float/HalfFloat linear 支援）、visual diff harness。

---

## 5. 明確禁區

```
1. 不回 C runtime fallback：已由 CODEX 移除，不回退、不重啟、不改鄰格取樣
   （consensus L1198；它雖證明黑線來自邊界 texel 選取，但會造成 live/bake
    材質品質接縫，不得作為收尾）。
2. 不改鄰格取樣（neighbor-cell sampling）。
3. 不污染現有 1024 floor/north 成果：Option A bake 污染遙測（snapshot）保留為長期遙測；
   Option B `if (uR738C1BakeCaptureMode != 0) return false;` 已在
   r7310C1FullRoomDiffuseShortCircuit() 開頭（CODEX 核准）；勿破壞此二防線。
   half-texel inset 保留；dilation 上限 4px；嚴禁整張 atlas flood-fill。
4. H7' guard 不回退；不得改成單看 firstVisibleIsRayExiting（consensus L6）。
5. R7-3.8 已驗收嫩芽漫射基準不動（docs/data/r7-3-8-c1-bake-accepted-package.json、
   .omc/r7-3-8-c1-1000spp-bake-capture/20260511-154229/）。
6. R7-3.9 反射烘焙 runtime 維持「已推翻、停用」；data/docs/runner hooks/probes/reports
   全保留為已推翻證據，不刪除（清理須待 R7-3.10 完成後另開計畫）。
7. 趨近真實模式材質參數不因本探測變動；地板 roughness 0.1 維持第一候選，
   roughness 1.0 僅作快速預覽模式迭代可用性退路。
8. 不碰 codex/r7-3-10-integration 的 Git 收尾（不 PR、不 history rewrite、
   不追加新任務 commit、保留 CODEX step A + OPUS 通過狀態）。
9. 若要改任何 code / MD / pointer：下一輪先從現狀開
   codex/r7-3-10-static-bake-expansion，不直接改 codex/r7-3-10-integration。
10. Phase 2 修法需先設計共識、不允許直接跳 code 修（consensus L624）；
    GIK ACOUSTIC_PANEL 分支與 gik244_*.jpeg 已成定論，不再納入改動。
```

---

## 6. 交接格式與 CODEX 待辦

本文件即可直接貼給 CODEX。實作前 CODEX 應先處理的「待 CODEX 查證」清單：

```
待 CODEX 查證：
A. shader 短路段確切現行行號（grep r7310C1FullRoomDiffuseShortCircuit /
   "accumCol += mask * r7310BakedRadiance" 重定；本文行號為 OPUS 追蹤+
   consensus 文件雙佐證，shader 仍在演進）。
B. 「短路在所有 bounce 觸發、無 bounces==0 / primary-ray 閘」是刻意設計
   還是缺口（程式無註解；牽涉是否要把短路限制在 primary hit、或改存
   direct-only/單反彈 atlas 供間接受光用）。
C. bake 積分核復核：manifest diffuseOnly:true、儲存為 full diffuse radiance、
   runtime 查表後不可再加直接光（文件已明定，仍宜以 manifest 復核）。
D. uIndirectMultiplier / uLegacyGain(約 L3061) / uMaxBounces 在 bake-capture
   pass 與 live render 是否對稱（任何不對稱 = 獨立全域亮度偏移源）。
E. docs/tools/r7-3-10-step-c-d-analyze.mjs（工作區未追蹤）用途與是否納入流程。
F. 驗收 server port（9001 vs 9002 文件不一致），驗收前查實際 server 再貼網址。
G. 西牆/南牆/天花板無 scaffold，需照東牆樣板（r7310C1RuntimeSurfaceIsEastWall
   L506 / r7310C1EastWallDiffuseUv L535 / loadR7310C1EastWallDiffuseRuntimePackage
   InitCommon L1569 / captureR7310C1EastWallDiffuseAtlas L2202）新建。
```

下一輪建議執行順序（沿用 seam-policy「下一輪執行順序」+ 嫩芽擴張大綱）：

```
1. 開 codex/r7-3-10-static-bake-expansion 工作分支。
2. 審 seam-policy，定 DataTexture + filter + alpha 正式路線。
3. 落地 OCCLUDER_TABLE / SURFACE_REGISTRY 單一資料來源。
4. bake metadata 改由 registry 產生；runtime 改由 alpha 決定是否短路。
5. 補 seam tests（六項）。
6. 依 §3 批次：東牆 → 西/南牆 → 天花板 → 大型家具，逐批烘焙 + 覆蓋報告。
7. 每批請使用者用同一批視角驗收；partial 偏亮僅作診斷不作拒收。
8. 全相關面到齊、missingSurfaceNames 為空 → 全相關 bake vs 全 LIVE 100/200/500/1000SPP 對照定案。
```

— OPUS 調查草案完結。本輪未動 code / MD（本檔為新增草案，非修改既有）/ pointer / Git。實作交 CODEX。
