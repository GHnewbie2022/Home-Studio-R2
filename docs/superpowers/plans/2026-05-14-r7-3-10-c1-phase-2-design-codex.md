# R7-3.10 C1 Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 追完 R7-3.10 C1 接縫線 Phase 2：第一刀修 H8 runtime gate 與 C' bake UV；第二刀修 R7-3.10 floor short-circuit 的 H7 exiting-hit guard；第三刀修 R7-3.8 sprout paste 的 H7' camera-y guard；第二輪 H5 / H3' 以 1024 bake resolution 收斂衣櫃兩條黑線。

**Architecture:** runtime 保留 combined texture，以 per-slot ready / mode 控制分面取樣。bake capture path 已移除多加的半 texel，正常 camera ray 不動。H7 guard 只保護 R7-3.10 full-room diffuse short-circuit；R7-3.8 sprout paste 另列 H7'。H7' 已採 `uCamPos.y >= 0.025` camera-y guard，避免相機進入地板實體時仍套用嫩芽 paste。H5 / H3' 第二輪已改採 1024 atlas resolution；C runtime fallback 已移除，不回退。

**Tech Stack:** JavaScript、GLSL string source in `js/PathTracingCommon.js`、three.js `DataTexture`、Node contract tests、existing CDP smoke runner。

---

## 目前狀態

日期：2026-05-14 起草；2026-05-15 CODEX / OPUS 第 3 輪審查後成立；2026-05-15 CODEX 完成第一刀；2026-05-15 CODEX 完成第二刀 B' / H7；2026-05-15 更新至第三刀前 CODEX / OPUS 共識封口；2026-05-15 OPUS 完成 H7' readback probe 與 follow-up probe，CODEX 審查接受；2026-05-15 OPUS 完成 H7' guard，CODEX 審查接受；2026-05-15 H5 / H3' 第二輪以 1024 bake resolution 收斂，使用者肉眼確認兩條黑線看不出來。
狀態：第一刀 H8 + C' 已完成；第二刀 H7 guard 已完成；第三刀 H7' guard 已完成；第二輪 H5 / H3' 已用 1024 bake resolution 收斂。floor / north runtime pointer 目前皆指 1024 package。C runtime fallback 已移除。
範圍：H8 per-surface gate、C' bake UV 半 texel修正、floor / north 1024 bake、B' shader 數值 probe、H7 exiting-hit guard、H7' sprout paste readback probe、H7' follow-up probe、H7' camera-y guard、H5 / H3' nearest-policy probe、bake 防污染 Option A / Option B。
暫緩：East wall runtime；全相關靜態漫射面烘焙下一階段設計。
協作邊界：OPUS 北牆 GIK 貼圖旋轉與貼圖頂底偽影已於 2026-05-15 完成（gik-north-rotate-uv-r4，使用者四個 Config 全數實機驗收通過）。CODEX 第二刀（B' probe / H7 guard 等）解除 GIK 邊界；惟 ACOUSTIC_PANEL 分支與 textures/gik244_*.jpeg 已成定論，第二刀無須再動。改動清單詳見本檔下方「## 2026-05-15 OPUS GIK 修復完成回報」。

---

## 對位檔案

| 檔案 | 角色 |
|---|---|
| `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-opus.md` | OPUS 工作副本，含完整三輪修正紀錄。 |
| `docs/superpowers/plans/2026-05-14-r7-3-10-c1-seam-debug-consensus-opus.md` | OPUS 接縫共識副本，保留 Phase 1 推演與第三刀前雙向共識。 |
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
| - [x] | B' probe | 第二刀已補 runtime probe level 2~6 與 sample readback，取得正常視角與地板內部視角數值。 |
| - [x] | H7 guard | 第二刀採 `hitIsRayExiting` guard。B' 證據顯示地板內部視角 sample 全為 exiting hit，guard 後內部視角短路數歸零。 |
| - [x] | H7' sprout paste | H7' readback probe、follow-up probe 與 camera-y guard 已由 OPUS 完成，CODEX 審查接受。最終 guard 採 `uCamPos.y >= 0.025`，不依賴 `firstVisibleIsRayExiting` / firstVisibleHitType / firstVisibleObjectID。使用者肉眼確認 inside-floor 已全黑，正常地板視角嫩芽保留。 |
| - [x] | H5 / H3' | fixed-Z / fixed-Y 新黑邊已歸入邊界格 nearest-policy；第二輪採 1024 bake resolution，使用者肉眼確認兩條黑線看不出來。 |
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
| - [x] | 同視角實機驗收 | 使用者已確認 floor / north fixed-X 黑線退掉；另回報 fixed-Z / fixed-Y 新接縫與地板內部發光。 |
| - [x] | 下一刀判斷 | 依使用者回報進入第二刀：B' probe 與 H7 guard。 |

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
1.  保留 H8，因為 north 與嫩芽已分開。
2.  第二刀先補 B' probe，抓地板內部發光的 shader 當下數值。
3.  B' 數字若指向 exiting hit，H7 只加 exiting guard。
4.  fixed-Z / fixed-Y 新黑線登記為 H5 / H3' 邊界資料政策問題，留待下一輪。
```

---

## 2026-05-15 第二刀 B' / H7 執行結果

新增 probe：

```text
1.  shader probe level 2：visible normal。
2.  shader probe level 3：visible position Y。
3.  shader probe level 4：ray direction Y。
4.  shader probe level 5：hitIsRayExiting。
5.  shader probe level 6：camera position Y。
6.  JS readback：`reportR7310C1FullRoomDiffuseRuntimeProbe({ probeLevel, samplePoints, samplePointSpace })`。
7.  runner：`--r7310-runtime-probe-sample-test`，同次跑正常地板視角與兩個地板內部視角。
```

B' 量測包：

```text
pre-guard:
  .omc/r7-3-10-full-room-diffuse-runtime/20260515-124123/runtime-probe-sample-report.json

post-guard:
  .omc/r7-3-10-full-room-diffuse-runtime/20260515-124246/runtime-probe-sample-report.json

normal runtime smoke:
  .omc/r7-3-10-full-room-diffuse-runtime/20260515-124309/runtime-report.json
```

關鍵數字：

```text
pre-guard normal_floor_view:
  L1 short = 234982
  L5 sample 2 / 3 = isRayExiting false

pre-guard inside_floor_level_view:
  L1 short = 879262
  L5 sample 1 / 2 / 3 = isRayExiting true

pre-guard inside_floor_up_view:
  L1 short = 921600
  L5 sample 1 / 2 / 3 = isRayExiting true

post-guard inside_floor_level_view:
  L1 short = 0

post-guard inside_floor_up_view:
  L1 short = 0

post-guard normal runtime smoke:
  status = pass
  bakedSurfaceHitCount = 96170
  bakedSurfaceShortCircuitCount = 190559
```

H7 判斷：

```text
1.  地板內部發光不是 H8，也不是 north / sprout gate。
2.  觸發條件是地板內部相機看到 floor top face 時，`hitIsRayExiting == TRUE` 仍通過 R7-3.10 floor 短路。
3.  最小 guard 是在 `r7310C1FullRoomDiffuseShortCircuit()` 入口排除 `visibleIsRayExiting == TRUE`。
4.  guard 後，地板內部視角短路數歸零；正常地板 runtime smoke 仍通過。
5.  fixed-Z / fixed-Y 新黑線仍屬 H5 / H3'，未納入 H7。
```

---

## 2026-05-15 第三刀前 CODEX / OPUS 共識封口

使用者第二刀後實機回報：

```text
1.  地板烘焙 ON：
      東北衣櫃底部南側邊緣仍有輕微黑邊。

2.  北牆烘焙 ON：
      東北衣櫃頂部北側邊緣仍有更明顯黑邊。

3.  地板烘焙 OFF：
      地板內部仍有嫩芽區發光。

4.  地板烘焙 ON：
      地板內部全黑。此項已修好。
```

CODEX / OPUS 對齊後的根因分流：

```text
1.  件 1：floor fixed-Z 南側黑邊
      根因類別 = H5 / H3' 邊界格 nearest-policy。
      C' 物理方向正確，不回退、不重烘。
      floor row 131 world z = -0.705064，在 wardrobe zMax = -0.703 內側約 2 mm。
      row 131 的 wardrobe X span 統計為 zero = 68 / 69；row 132 zero = 0 / 69。
      row 132 world z 正確值 = -0.694654。

2.  件 2：north fixed-Y 頂部北側黑邊
      根因類別同件 1。
      正確 V 軸方向：row index ↑ → world y ↑。
      row 343 y = 1.948960
      row 344 y = 1.954634，在 wardrobe yMax = 1.955 內側約 0.36 mm。
      row 345 y = 1.960308，在 wardrobe 外。
      row 346 y = 1.965981，在 wardrobe 外更高。
      row 344 的 wardrobe X span 統計為 zero = 68 / 69；row 345 zero = 0 / 69。

3.  件 3：floor bake OFF 時地板內部嫩芽區發光
      命名 = H7' / sprout-paste-inside-guard。
      R7-3.8 paste 在正常視角可見是預期；在相機進入地板實體內部後仍可見是非預期。
      根因 = R7-3.8 paste path 缺能區分 normal view 與 inside-floor view 的 ray-side / camera-side guard。
      firstVisibleIsRayExiting 是 probe 證據之一，但不能單獨作 guard。
      H7 第二刀只保護 R7-3.10 short-circuit，沒有保護 R7-3.8 paste path。
```

OPUS Q3 措辭修正紀錄：

```text
OPUS 原句「bake surface point epsilon 已無殘留偏差」太滿。
CODEX 修正為：
  目前症狀不支持 bake surface point epsilon 是主因。
  根因優先級降至 H6 / 後備檢查層級。
  若件 1 / 件 2 修法後仍有殘留，再重新翻查。

OPUS 已接受此修正。
```

H7' readback probe 完成結果：

```text
1.  OPUS 已完成 probe-only 實作（4 檔案 diff）與 12 cases readback。
      結果 package:
      .omc/r7-3-8-sprout-paste-probe/20260515-143914/sprout-paste-probe-sample-report.json

2.  量化結果：
      normal_floor_view:
        pastePassCount = 7,295 / 921,600
        rayExitingTrueCount = 7,295 / 921,600

      inside_floor_level_view:
        pastePassCount = 393,289 / 921,600
        rayExitingTrueCount = 393,289 / 921,600

      inside_floor_up_view:
        pastePassCount = 921,600 / 921,600
        rayExitingTrueCount = 921,600 / 921,600

3.  CODEX 審查：
      H7' 根因成立。
      但 normal view 與 inside-floor view 的 paste-pass fragment 都 100% firstVisibleIsRayExiting=TRUE。
      所以 firstVisibleIsRayExiting 可作為證據，不能單獨作為 guard 條件。
```

⚠️ 歷史紀錄：下列「剩餘 probe / 鎖定禁區 / 行動規則」是 H7' guard 完成後、1024 bake resolution 前的狀態快照。H5 / H3' probe 已完成，修法已收斂到 1024 bake resolution；C runtime fallback 已移除。

當時剩餘 probe：

```text
1.  H5 / H3' nearest hit interval
      - 反推 floor row 131 可見 world z 命中區間。
      - 反推 north row 344 可見 world y 命中區間。
      - 換算成 mm，比對使用者肉眼看到的黑邊寬度。

2.  H5 / H3' visible-hit runtime probe
      - 在畫面黑線 sample point 直接回讀 runtime atlas row / col。
      - 確認黑線 pixel 真的命中 floor row 131 / north row 344。
      - 排除 postprocess 或相鄰 surface 混入。
```

當時第三刀前鎖定禁區：

```text
1.  不回退 H7 guard。
2.  不回退 H8 runtime gate。
3.  不回退 C' bake UV 修正。
4.  當時不重烘 floor / north atlas；現況已由使用者裁定採 1024 重烘並驗收通過。
5.  不直接複製鄰格修補邊界格。
6.  H7' guard 已落地，不回退；guard 採 camera-y 條件，不得改成單看 firstVisibleIsRayExiting。
7.  H5 / H3' 第二輪設計當時待 probe 後再展開；現況採 1024 bake resolution，fallback 已移除。
```

當時行動規則：

```text
1.  使用者已要求先討論時，不直接改 code。
2.  H7' readback probe、follow-up probe 與 guard 已完成；使用者肉眼確認 inside-floor 已全黑。
3.  OPUS / CODEX 任一方可同步做 H5 / H3' nearest interval 與 visible-hit runtime probe；現況已完成。
```

---

## 2026-05-15 第三刀 H7' guard 實作審查與使用者驗收

執行者：OPUS。
審查者：CODEX。
使用者肉眼驗收：已回報。

現況白話：

```text
這輪把「相機鑽進地板裡還看到嫩芽光」修好了；衣櫃邊緣兩條黑線當時仍是下一刀問題。
```

CODEX 審查結論：

```text
1.  接受 H7' guard 實作，無 P0 / P1 阻擋問題。
2.  guard 位於 R7-3.8 paste path 最外層 if 條件鏈。
3.  guard 條件採 `uCamPos.y >= 0.025`。
4.  probe 不 bypass guard，因此 post-guard L1 paste-pass count 可直接證明 guard 是否生效。
5.  OPUS 修正 reporter harness 的 `uCamPos` 同步缺口；single-frame probe render 前主動同步 worldCamera 世界位置。
```

驗證數據：

```text
H7' post-guard probe:
  normal_floor_view         pastePassCount = 7,295
  inside_floor_level_view   pastePassCount = 0
  inside_floor_up_view      pastePassCount = 0

R7-3.10 H7 / H8 / C' smoke:
  bakedSurfaceHitCount = 96,170
  bakedSurfaceShortCircuitCount = 190,559

使用者肉眼驗收:
  1. 地板內部已經成功全黑，烘焙開關不影響。
  2. 地板烘焙 ON，東北衣櫃底部南側頂邊仍有黑線。
  3. 北牆烘焙 ON，東北衣櫃頂部北側頂邊仍有黑線。
```

判讀：

```text
1.  第 1 點代表 H7' / sprout-paste-inside-guard 已修好。
2.  第 2 / 3 點不屬 H7'，仍歸入 H5 / H3' nearest-policy / 邊界格取樣問題。
3.  後續已完成 H5 / H3' probe，並以 1024 bake resolution 收斂，使用者確認黑線看不出來。
```

CODEX review 殘留建議：

```text
1.  runner 的 `status: pass` 目前只檢查 sample 是否為有限數值。
    commit 前建議補成語意檢查：normal = 7,295 保留、inside = 0。

2.  相關註解需從「第三刀前 / 不加 guard / probe 1~4」更新為目前狀態：
    - H7' guard 已落地。
    - probe levels 已擴到 1~6。
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

**Git 狀態（截至 2026-05-15 更新）**：OPUS GIK 修復已獨立落在 commit `518d3aa fix(gik): rotate north horizontal panel UV and repair texture padding`。本段保留為 GIK handoff 歷史紀錄；後續 Phase 2 probe 不再修改 ACOUSTIC_PANEL 與 `textures/gik244_*.jpeg`。

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

- [x] **Step 7.1: 同視角 A/B 驗 floor**

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

- [x] **Step 7.2: 同視角 A/B 驗 north**

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

- [x] **Step 7.3: Report 檢查（已由 smoke / probe 取代）**

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

狀態：

```text
本項原本是第一刀後的 console spot-check。
後續已由 UI toggle smoke、north-wall runtime smoke、B' runtime probe 與使用者同視角驗收覆蓋。
第三刀起改看 H7' / H5 / H3' 專用 probe，不再把此項當 gate。
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
| 第三刀前不引入 alpha / valid fallback。 | 這屬於 H5 / H3' 第二輪；需等 nearest interval 與 visible-hit runtime probe 封口。 |
| 第三刀前不實作 H5 / H3' 修法。 | fixed-Z / fixed-Y 黑邊已歸因於邊界格 nearest-policy，下一步先量化命中區間與 runtime row / col。 |
| 第一刀不納入 East wall runtime。 | 現況 east wall 只作 bake / evidence 對照；runtime 沒有第三 slot。 |
| 第二刀不再修改 ACOUSTIC_PANEL 分支與 textures/gik244_*.jpeg。 | OPUS 已於 2026-05-15 完成 gik-north-rotate-uv-r4，使用者全 Config 驗收通過；改動清單見「2026-05-15 OPUS GIK 修復完成回報」。 |
| 不把 C' 修法套到 R7-3.8 既有 sprout atlas 結論。 | R7-3.8 sprout C1 包共用同一 bake UV 計算，需另行視覺判斷。 |
| H7' guard 已落地後不回退。 | R7-3.8 paste readback / follow-up probe 已完成；最終 guard 採 `uCamPos.y >= 0.025`，使用者確認 inside-floor 已全黑。後續不得改成單看 firstVisibleIsRayExiting。 |

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
| - [x] | Task 7：第一階段實機驗收。 | 使用者已回報第一刀與第二刀視覺結果；後續改走第三刀 probe |
| - [x] | Task 8：收尾與文件同步。 | CODEX |
| - [x] | 下一刀：B' probe。 | 2026-05-15 完成 |
| - [x] | 下一刀：H7 inside-geometry / ray-side guard。 | 2026-05-15 完成 |
| - [x] | 第三刀前：CODEX / OPUS 根因共識封口。 | 2026-05-15 完成 |
| - [x] | 第三刀：H7' sprout paste readback probe。 | OPUS 已完成 2026-05-15；CODEX 審查接受根因並指出 P1：guard 不得單看 firstVisibleIsRayExiting。 |
| - [x] | 第三刀：H7' follow-up probe。 | OPUS 已完成 2026-05-15；CODEX 審查接受，guard 候選收斂到 camera-y。 |
| - [x] | 第三刀：H7' guard 設計輪。 | OPUS 已完成 2026-05-15；CODEX 審查接受，使用者確認 inside-floor 已全黑。 |
| - [x] | H5 / H3' probe：nearest hit interval。 | OPUS 已完成；1024 north 可見黑帶收斂到 0.125mm。 |
| - [x] | H5 / H3' probe：visible-hit runtime row / col。 | OPUS 已完成；H5 probe 1024 north dominantRow=682、totalInBand=1494。 |
| - [x] | 第二輪：H5 / H3' 修法設計。 | CODEX 裁定改採 1024 bake resolution；使用者肉眼確認兩條黑線看不出來。 |
| - [ ] | 第二輪：East wall runtime。 | 待使用者裁定 |

## 2026-05-15 R7-3.10 H5 / H3' 第二輪收尾鏡像：1024 bake resolution

> 完整總帳見 `docs/SOP/Debug_Log.md` 的 `R7-3.10-c1-phase2-h5-h3-1024-bake-resolution-closeout`，OPUS 詳細鏡像見 `2026-05-14-r7-3-10-c1-seam-debug-consensus-opus.md` 同日「1024 bake resolution」段。

```text
件 1 / 件 2 黑線：
  - 修法改為提高 bake atlas 解析度 512→1024。
  - floor 1024 package：.omc/r7-3-10-full-room-diffuse-bake/20260515-215727
  - north 1024 package：.omc/r7-3-10-full-room-diffuse-bake/20260515-212509
  - 512 pointer 備份：.omc/r7-3-10-1024-pointer-backups/20260515-212327
  - 使用者肉眼確認：東北衣櫃底部南側、頂部北側黑線在 1024 看不出來。
  - 1024 鎖為目前正式候選；2048 本輪不推進。

驗證：
  - contract test pass。
  - short-circuit smoke 96170 / 190559，H7 / H8 / C' 無退化。
  - H5 black-line probe 1024 north dominantRow=682、totalInBand=1494。

partial bake 亮差：
  - LIVE 與 partial bake 並存時，LIVE path 先走 k 段再接 baked radiance。
  - 有效深度成為 k + baked solution depth，會讓相鄰 LIVE 面偏亮。
  - 正式驗收基準改為全相關靜態漫射面 bake vs 全 LIVE。

防污染：
  - Option A bakeContaminationGuardSnapshot 保留為長期遙測。
  - Option B captureMode guard 已加：uR738C1BakeCaptureMode != 0 時不走 R7-3.10 short-circuit。
  - C runtime fallback 已移除，不回退。
```

### 第二輪後續方向

```text
1.  CODEX 收刀：Debug_Log / Index / cache-buster / commit。
2.  下一階段往全相關靜態漫射面烘焙推進，降低 partial bake 與 LIVE 的交界。
3.  East wall runtime 與其他靜態漫射面納入後續使用者裁定。
```
