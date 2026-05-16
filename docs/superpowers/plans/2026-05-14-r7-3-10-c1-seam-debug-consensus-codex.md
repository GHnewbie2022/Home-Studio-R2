# R7-3.10 C1 接縫除錯共識與 TODO

日期：2026-05-14 起草；2026-05-15 更新至 Phase 2 第三刀前 CODEX / OPUS 共識封口；2026-05-15 OPUS 完成 H7' readback probe 與 follow-up probe，CODEX 審查接受；2026-05-15 OPUS 完成 H7' guard，CODEX 審查接受；2026-05-15 H5 / H3' 第二輪以 1024 bake resolution 收斂，使用者肉眼確認兩條黑線看不出來。
狀態：Phase 1 根因調查完成；Phase 2 第一刀 H8 + C' 已完成；第二刀 B' / H7 已完成；第三刀 H7' guard 已完成；H5 / H3' 殘留黑邊已用 floor / north 1024 bake resolution 收斂。C runtime fallback 已移除；下一步往全相關靜態漫射面烘焙推進。
範圍：C1 full-room diffuse bake 的衣櫃接縫黑線、地板內部發光、R7-3.10 / R7-3.8 短路路徑互相影響
協作來源：CODEX 與 OPUS 對同一批使用者截圖與觀察的收斂共識

## 使用方式

本檔用來鎖定 Phase 1 假設編號、證據狀態與 Phase 2 入口。接手代理先讀本檔，再讀 Phase 2 執行檔：`docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md`。
Phase 2 第一刀與第二刀已完成；H7' / sprout-paste-inside-guard readback probe、follow-up probe 與 camera-y guard 已由 OPUS 完成，CODEX 審查接受，使用者確認 inside-floor 已全黑。H5 / H3' 第二輪已用 1024 bake resolution 收斂，使用者確認兩條黑線看不出來。不回到舊 flood-fill / contact invalid 路線，也不回到 C runtime fallback。

## 給 OPUS 的目前讀取狀態

本檔已更新到 CODEX 完成 Phase 1 A / B 靜態 code 檢查、C / D / E raw atlas + metadata 讀檔量化、使用者補充確認 H7 相機位於地板實體內部、Step F 多視角觀察、Phase 2 第一刀 / 第二刀實作結果、OPUS 完成 H7' readback / follow-up probe、H7' camera-y guard，以及使用者肉眼確認 inside-floor 已全黑。Phase 2 執行檔另立於 `2026-05-14-r7-3-10-c1-phase-2-design-codex.md`。
目前可直接依本檔判讀，不需要回頭重組先前對話。
A / B 結論由靜態證據負責。C / D / E 結論由 raw atlas 與 metadata 數值負責。F 結論由使用者實機多視角截圖與觀測負責。

| 狀態 | 項目 | 結論 |
|---|---|---|
| - [x] | A / H8 gate 污染檢查 | 靜態 code 檢查已完成。北牆或地板任一 R7-3.10 runtime 開啟且 ready 時，R7-3.8 嫩芽 paste 會被 `r7310RuntimeApplied` 停用。另有 `NorthWallReady` 耦合：R7-3.10 runtime uniform 的 `applied` 同時要求 full-room 與 north-wall ready。 |
| - [x] | B / H7 short-circuit 範圍檢查 | 靜態 code 檢查已完成。floor short-circuit 原本缺少 inside-geometry / ray-side guard；BoxIntersect 的內部出射資訊未被 R7-3.10 short-circuit 使用。使用者已補充確認相機整個進入地板實體空間內部，且能在內部移動看到多個 baked surface 貼圖發光、家具區呈黑色陰影。B' probe 已於第二刀完成，並導出 H7 exiting-hit guard。 |
| - [x] | C / D raw atlas 與 metadata 量化 | 已完成。fixed-X 邊界的暗帶外溢到邊界外側第一格；fixed-Y / fixed-Z 邊界在接縫第一格出現亮 rim，暗帶退在內側。 |
| - [x] | E 東牆歷史包 | 已完成 raw atlas + metadata 切片。east wall 的 U 軸邊界沒有 fixed-X 類外側黑線，H1b 泛化 U 軸版本正式撤回；fixed-X / wardrobe xMin 特例併入 Phase 2 C'。 |
| - [x] | F 多視角 | 已完成。使用者實機確認：地板烘焙開時，東北衣櫃底部南側接縫乾淨、西側接縫黑線；北牆烘焙開時，東北衣櫃頂部北側接縫乾淨、西側接縫黑線。H4 透視壓縮正式排除。 |

目前最高信心排序維持：

| 排序 | 假設 | 狀態 |
|---|---|---|
| 1 | H8：per-surface 開關沒有真正隔離，R7-3.10 全域狀態污染 R7-3.8 嫩芽路徑。 | 已修。north baked 不再關掉 R7-3.8 嫩芽 paste。 |
| 2 | H7：R7-3.10 floor short-circuit 套用範圍太寬，包含地板實體內部 exiting hit。 | 已修。B' probe 顯示 inside-floor 視角 L5 sample 為 `isRayExiting true`，guard 後 L1 short 歸零；使用者確認 floor bake ON 時地板內部全黑。 |
| 3 | H7'：R7-3.8 sprout paste path 缺能區分 normal view 與 inside-floor view 的 ray-side / camera-side guard。 | 已修。OPUS 完成 readback / follow-up probe 與 `uCamPos.y >= 0.025` camera-y guard，CODEX 審查接受，使用者確認 inside-floor 已全黑。 |
| 4 | C'：bake UV 半 texel 偏移。 | 已修。fixed-X / wardrobe xMin 黑線已退掉；C' 物理方向正確，不回退。 |
| 5 | H5 / H3'：邊界格 nearest-policy 與家具 footprint / occluder 資料歸屬衝突。 | 已用 1024 bake resolution 收斂；使用者肉眼確認兩條黑線看不出來。 |
| 6 | H6 / H1b：runtime hit / UV / epsilon 或 NearestFilter texel-center 選取。 | H1b 泛化 U 軸版本正式撤回；H6 只保留為後備檢查，目前症狀不支持 bake surface point epsilon 是主因。 |
| 7 | H4：透視壓縮。 | 已由 Step F 排除。 |

## 2026-05-15 Phase 2 第一刀執行結果

| 狀態 | 項目 | 結論 |
|---|---|---|
| - [x] | H8 gate 修正 | `updateR7310C1FullRoomDiffuseRuntimeUniforms()` 已拆成 `floorApplied` / `northWallApplied`。floor 與 north 可各自決定 mode flag。 |
| - [x] | H8 loader 隔離 | floor loader 與 north loader 已分開載入。combined atlas 保留兩格，缺資料 slot 使用 black placeholder，shader 只依 per-surface mode flag 取樣。 |
| - [x] | H8 嫩芽共存 | north runtime 開啟時不再關掉 R7-3.8 嫩芽 paste；floor runtime 開啟時仍依 floor 互斥規則停用嫩芽 paste。 |
| - [x] | C' bake UV 修正 | bake capture path 已改成 `gl_FragCoord.xy / uResolution`；正常 camera ray 未改。 |
| - [x] | 1000SPP 重烘 | floor package `.omc/r7-3-10-full-room-diffuse-bake/20260515-112620/`；north package `.omc/r7-3-10-full-room-diffuse-bake/20260515-112717/`。 |
| - [x] | runtime pointer | floor / north pointer 已更新到新 package。 |
| - [x] | 自動驗證 | contract、syntax、runtime short-circuit、north-wall runtime、UI toggle 均通過。 |
| - [x] | 實機驗收 | 使用者確認 floor / north fixed-X 西側黑線已退掉；north 開啟時嫩芽仍存在。另回報 fixed-Z / fixed-Y 新黑邊與 inside-floor 發光。 |
| - [x] | B' / H7 | 第二刀已完成。H7 guard 後使用者確認 floor bake ON 時地板內部全黑。 |

## 2026-05-15 Phase 2 第一刀實機 Debug 補記

| 狀態 | 項目 | 結論 |
|---|---|---|
| - [x] | floor fixed-X 西側黑線 | 使用者確認已不見。atlas col 419 舊包 mean 0.003628 / p50 0；新包 mean 0.316591 / p50 0.315657。 |
| - [x] | north fixed-X 西側黑線 | 使用者確認已不見。atlas col 419 舊包 mean 0.000969 / p50 0；新包 mean 0.409004 / p50 0.416011。 |
| - [x] | floor fixed-Z 南側邊界 | 使用者回報稍深。atlas row 131 舊包 mean 0.367539 / p50 0.369889；新包 mean 0.005740 / p50 0。 |
| - [x] | north fixed-Y 頂部北側邊界 | 使用者回報新黑線。atlas row 344 舊包 mean 0.252991 / p50 0.254330；新包 mean 0.005483 / p50 0。 |
| - [x] | metadata 對照 | floor row 131 col 453 新舊 world z 皆為 -0.705064；north row 344 col 453 新舊 world y 皆為 1.954634。metadata 沒漂移。 |
| - [x] | H8 | north 開啟已不影響嫩芽區域，H8 第一刀成立。 |
| - [x] | H7 | 地板烘焙開啟時地板內部仍發光，H7 仍成立，尚未處理。 |

判讀：

```text
1.  第一刀已把 fixed-X 的半 texel 問題打掉。
2.  C' 修正後，fixed-Z / fixed-Y 的 contact 邊界格由亮 rim 變成暗格。
3.  這是 atlas 資料端的邊界政策問題，應併入 H5 / H3' 第二輪候選。
4.  地板內部發光是 H7 runtime guard 缺口，照原計畫先做 B' shader probe。
```

## 2026-05-15 Phase 2 第二刀後共識封口

使用者第二刀後回報：

```text
1.  floor bake ON：
      東北衣櫃底部南側邊緣仍有輕微黑邊。
2.  north bake ON：
      東北衣櫃頂部北側邊緣仍有更明顯黑邊。
3.  floor bake OFF：
      地板內部仍有嫩芽區發光。
4.  floor bake ON：
      地板內部全黑，H7 第二刀已通過肉眼驗收。
```

CODEX / OPUS 封口共識：

```text
1.  H8 第一刀成立，不回退。
2.  C' bake UV 修正成立，不回退、不重烘 atlas。
3.  H7 exiting-hit guard 成立，不回退。
4.  floor fixed-Z 與 north fixed-Y 殘留黑邊同屬 H5 / H3' 邊界格 nearest-policy。
5.  floor bake OFF 的 inside-floor sprout glow 屬 H7' / sprout-paste-inside-guard。
6.  H6 / bake surface point epsilon 只保留為後備檢查，目前症狀不支持它是主因。
```

H5 / H3' 已有證據：

```text
floor:
  row 131 world z = -0.705064
  wardrobe zMax = -0.703
  row 131 位於 footprint 內側約 2 mm
  row 131 wardrobe X span zero = 68 / 69
  row 132 world z = -0.694654
  row 132 wardrobe X span zero = 0 / 69

north:
  row index ↑ → world y ↑
  row 343 y = 1.948960
  row 344 y = 1.954634
  row 345 y = 1.960308
  row 346 y = 1.965981
  wardrobe yMax = 1.955
  row 344 位於 footprint 內側約 0.36 mm
  row 344 wardrobe X span zero = 68 / 69
  row 345 wardrobe X span zero = 0 / 69
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

3.  CODEX 審查結論：
      H7' 根因成立。
      `firstVisibleIsRayExiting` 可作為證據，但不能單獨作為 guard 條件。
```

H7' follow-up probe + guard 完成結果：

```text
1.  OPUS 已完成 follow-up probe，CODEX 審查接受。
      結論：guard 條件採 `uCamPos.y >= 0.025`。
      此條件可區分 normal view 與 inside-floor view，且不依賴 firstVisibleIsRayExiting。

2.  OPUS 已完成 H7' guard 實作，CODEX 審查接受。
      post-guard probe:
        normal_floor_view         pastePassCount = 7,295
        inside_floor_level_view   pastePassCount = 0
        inside_floor_up_view      pastePassCount = 0

3.  使用者肉眼驗收：
      地板內部已經成功全黑，烘焙開關不影響。

4.  當輪白話：
      這輪把「相機鑽進地板裡還看到嫩芽光」修好了；衣櫃邊緣兩條黑線當時仍是下一刀問題。
```

⚠️ 歷史紀錄：下列「下一步」是 H7' guard 完成後、1024 bake resolution 前的狀態快照。H5 / H3' probe 已完成，修法已收斂到 1024 bake resolution。

當時下一步只做 H5 / H3' probe：

```text
1.  H5 / H3' nearest hit interval
      - floor row 131 的 visible world z 命中區間。
      - north row 344 的 visible world y 命中區間。
      - 換算成 mm，對照使用者看到的黑邊寬度。

2.  H5 / H3' visible-hit runtime probe
      - 直接在黑線 sample point 回讀 runtime atlas row / col。
      - 確認畫面黑線命中 row 131 / row 344。
```

當時暫停項：

```text
1.  H5 / H3' 第二輪修法設計當時暫停，probe 封口後再展開。
2.  alpha mask / push-pull dilation / runtime fallback 當時暫不選邊；現況已移除 C runtime fallback 並採 1024 resolution。
3.  East wall runtime 暫停。
4.  OPUS GIK 改動已驗收，CODEX 後續不碰 ACOUSTIC_PANEL 與 textures/gik244_*.jpeg。
```

## 使用者觀察

| 狀態 | 觀察 | 初步意義 |
|---|---|---|
| - [x] | 北牆烘焙開啟時，衣櫃西側面與北牆的垂直接縫出現黑線。 | 問題落在固定 X 邊界。 |
| - [x] | 北牆烘焙開啟時，衣櫃頂面與北牆的水平接縫乾淨。 | 固定 Y 邊界暫未重現同型黑線。 |
| - [x] | 地板烘焙開啟時，衣櫃西側與地板的南北向接縫出現黑線。 | 同樣落在固定 X 邊界。 |
| - [x] | 地板烘焙開啟時，衣櫃南側與地板的東西向接縫乾淨。 | 固定 Z 邊界暫未重現同型黑線。 |
| - [x] | Step F 使用者多視角複查：地板烘焙開啟時，東北衣櫃底部南側接縫乾淨，西側接縫黑線。 | 斜視角度下 fixed-Z 控制邊界仍乾淨，fixed-X 邊界仍黑線；H4 透視壓縮排除。 |
| - [x] | Step F 使用者多視角複查：北牆烘焙開啟時，東北衣櫃頂部北側接縫乾淨，西側接縫黑線。 | 斜視角度下 fixed-Y 控制邊界仍乾淨，fixed-X 邊界仍黑線；H4 透視壓縮排除。 |
| - [x] | 相機整個進入地板實體空間內部、地板烘焙開啟時，可在內部移動看到多個 baked surface 貼圖發光，且家具區呈黑色陰影。 | H7 的相機位置觸發面已由使用者確認；baked radiance 被直接貼回，且 atlas 內已有家具暗區。 |
| - [x] | 地板烘焙關閉、北牆烘焙關閉時，只看到 R7-3.8 嫩芽區發光。 | R7-3.8 嫩芽路徑仍可顯示。 |
| - [x] | 地板烘焙關閉、北牆烘焙開啟時，R7-3.8 嫩芽區發光消失。 | R7-3.10 北牆開關影響了非北牆區域。 |

## 已鎖定假設表

| 狀態 | 編號 | 假設 | 目前排序 | 判定 |
|---|---|---|---|---|
| - [x] | H1a | 雙線性混合造成黑線。 | 無 | 撤回。runtime 目前使用 `NearestFilter`。 |
| - [x] | H1b | `NearestFilter` 的 texel-center 邊界選取對 X 邊界敏感。 | 撤回 | 泛化 U 軸版本正式撤回：east wall 的 U 軸 Z=-0.703 邊界接縫第一格是亮 rim，axis-level 假設不成立。fixed-X / wardrobe xMin texel-center 特例併入 Phase 2 C'，不再以 atlas U / V 軸角度追查。 |
| - [x] | H3' | shared occluder / alpha policy 缺口，衣櫃 footprint 或 contact 區仍被當有效烘焙資料。 | 第二輪候選 | raw atlas 支持資料端暗帶存在；衣櫃相關範圍 atlas alpha 全為 1.0，沒有 alpha mask / dilation 排除 contact 區。Phase 2 第一輪先不做 alpha mask，驗收後再決定是否啟動第二輪。 |
| - [x] | H4 | 透視壓縮造成其他邊界黑線不可見。 | 排除 | Step F 使用者多視角實機複查已排除：fixed-Y / fixed-Z 控制邊界在斜視角度下仍乾淨，fixed-X 同角度仍黑線。 |
| - [x] | H5 | bake 端 atlas 已含家具 footprint 暗區。 | 第三組 | raw atlas 已確認並量化：floor / north fixed-X 邊界暗帶外溢到外側第一格。 |
| - [ ] | H6 | runtime hit / UV / epsilon 一般情況造成衣櫃西側附近選錯 texel 或判錯 hit。 | 後備檢查 | H1b 泛化 U 軸版本撤回；目前症狀不支持 bake surface point epsilon 是主因。若件 1 / 件 2 後續修法後仍有殘留，再重新升權。 |
| - [x] | H7 | floor short-circuit 套用範圍太寬，包含穿模、背面或內面視角。 | 已修 | B' probe 已確認 inside-floor 視角為 exiting hit；H7 guard 已排除 R7-3.10 short-circuit 的 exiting hit，使用者確認 floor bake ON 時地板內部全黑。 |
| - [x] | H7' | R7-3.8 sprout paste path 缺能區分 normal view 與 inside-floor view 的 ray-side / camera-side guard。 | 已修 | H7' readback / follow-up probe 與 `uCamPos.y >= 0.025` guard 已由 OPUS 完成，CODEX 審查接受；使用者確認 inside-floor 已全黑。 |
| - [x] | H8 | per-surface 開關沒有真正隔離，R7-3.10 全域狀態污染 R7-3.8 嫩芽路徑。 | 第一 | 高信心成立：任一 R7-3.10 surface runtime 開啟會停用 R7-3.8 嫩芽 paste。 |

## 優先順序

| 狀態 | 排序 | 假設 | 理由 |
|---|---|---|---|
| - [x] | 1 | H8 | 已確認：R7-3.10 floor 或 north 任一 runtime enabled 且 ready 時，R7-3.8 paste preview 的 applied 會被 `!r7310RuntimeApplied` 關掉。 |
| - [x] | 2 | H7 | 已完成。B' probe 指向 exiting hit，H7 guard 後 floor bake ON 的 inside-floor 全黑。 |
| - [x] | 3 | H7' | 已修。H7' camera-y guard 後 normal_floor_view 保留 pastePassCount 7,295，inside_floor_level / inside_floor_up 歸零。 |
| - [x] | 4 | H5 / H3' | raw atlas 已確認暗帶存在；fixed-Z / fixed-Y 殘留黑邊歸入邊界格 nearest-policy，需做 nearest interval 與 visible-hit runtime probe。 |
| - [x] | 5 | H6 / H1b | east wall U 軸邊界沒有 fixed-X 類外側黑線，H1b 泛化 U 軸版本正式撤回；H6 降為後備檢查。 |
| - [x] | 6 | H4 | Step F 已正式排除。 |

## Phase 1 TODO

| 狀態 | 步驟 | 目標假設 | 要讀或檢查的範圍 | 產出 |
|---|---|---|---|---|
| - [x] | A | H8 | `r7310C1FullRoomDiffuseShortCircuit()`、所有 R7-3.10 uniform / mode flag / ready flag、R7-3.8 與 R7-3.10 短路呼叫順序與互斥條件。 | 靜態 code 已判定：北牆開關會透過 `r7310RuntimeApplied` 停用 R7-3.8 嫩芽 paste；R7-3.10 runtime uniform 的 `applied` 也存在 `NorthWallReady` 耦合。 |
| - [x] | B | H7 | hit normal 用法、相機 / ray origin 與地板 box 的相對位置、背面 / 內面條件、BoxIntersect 法線輸出方向。 | 靜態 code 已判定：floor short-circuit 條件缺少 inside-geometry / ray-side guard。使用者已確認截圖條件是相機整個進入地板實體空間內部；後續 probe 只需量化 shader 當下 camera / ray / normal / isRayExiting / surface short-circuit 狀態。 |
| - [x] | C | H5 / H3' | raw atlas column / row：floor `20260513-165203`、north `20260513-210338`。 | 已量化：floor / north fixed-X 暗帶外溢到 X=1.35 外側第一格；fixed-Z / fixed-Y 接縫第一格是亮 rim。 |
| - [x] | D | H5 / H3' | `texel-metadata-patch-000-f32.bin`。 | 已比對：fixed-X 外側第一格 texel center 落在衣櫃 OOBB 外，但 luma 已接近 0；fixed-Y / fixed-Z 接縫第一格落在 OOBB 內側或邊界附近，但 luma 維持亮值。 |
| - [x] | E | H1b / H6 | east wall 歷史包 `20260513-214539`。 | 已量化：east wall U 軸 Z=-0.703 邊界接縫第一格是亮 rim，H1b 泛化 U 軸版本正式撤回；fixed-X / wardrobe xMin 特例併入 Phase 2 C'。 |
| - [x] | F | H4 | 使用者多視角複查。 | 已排除 H4。地板烘焙：東北衣櫃底部南側接縫乾淨、西側接縫黑線；北牆烘焙：東北衣櫃頂部北側接縫乾淨、西側接縫黑線。 |

## Raw Atlas 量化 TODO

| 狀態 | Package | Surface | 切片 | 目的 | 結果 |
|---|---|---|---|---|---|
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-165203/` | floor | X=1.35 column | 檢查衣櫃西側 fixed-X 暗區。 | 外側第一格 x=1.347598，mean luma 0.003556、p50 0；內側第一格 x=1.355840，mean 0.003650、p50 0。暗帶範圍 x=1.347598..1.998730，共 80 texels。 |
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-165203/` | floor | Z=-0.703 row | 對照衣櫃南側固定 Z 邊界。 | 接縫第一格 z=-0.705064，mean 0.359141；外側第一格 z=-0.694654，mean 0.362528。暗帶停在 z=-0.715475，共 119 texels，接縫保留亮 rim。 |
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-210338/` | north wall | X=1.35 column | 檢查衣櫃西側 fixed-X 暗區。 | 外側第一格 x=1.347598，mean 0.000960、p50 0；內側第一格 x=1.355840，mean 0.000825、p50 0。暗帶範圍 x=1.347598..1.998730，共 80 texels。 |
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-210338/` | north wall | Y=1.955 row | 對照衣櫃頂面固定 Y 邊界。 | 接縫第一格 y=1.954634，mean 0.249575；外側第一格 y=1.960308，mean 0.252177。暗帶停在 y=1.948960，共 36 texels，接縫保留亮 rim。 |
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-214539/` | east wall | Z=-0.703 對應邊界 | 鑑別 axis-level 與 instance-level。 | U 軸邊界接縫第一格 z=-0.704088，mean 0.539942；外側第一格 z=-0.694459，mean 0.545812。暗帶停在 z=-0.713717，共 20 texels。 |
| - [x] | `.omc/r7-3-10-full-room-diffuse-bake/20260513-214539/` | east wall | Y=1.955 對應邊界 | 鑑別 axis-level 與 instance-level。 | 接縫第一格 y=1.954634，mean 0.294735；外側第一格 y=1.960308，mean 0.296591。暗帶停在 y=1.948960，共 36 texels。 |

## Metadata TODO

| 狀態 | Package | Surface | 邊界 | 要確認的 texel center | 結果 |
|---|---|---|---|---|---|
| - [x] | `20260513-165203` | floor | X=1.35 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | 外側 x=1.347598 落在 OOBB 外但 luma 0.003556；內側 x=1.355840 落在 OOBB 內且 luma 0.003650。fixed-X 黑線來自外側第一格已暗。 |
| - [x] | `20260513-165203` | floor | Z=-0.703 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | 內側 z=-0.705064 落在 OOBB 內但 luma 0.359141；外側 z=-0.694654 落在 OOBB 外且 luma 0.362528。接縫第一格是亮 rim。 |
| - [x] | `20260513-210338` | north wall | X=1.35 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | 外側 x=1.347598 落在 OOBB 外但 luma 0.000960；內側 x=1.355840 落在 OOBB 內且 luma 0.000825。fixed-X 黑線來自外側第一格已暗。 |
| - [x] | `20260513-210338` | north wall | Y=1.955 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | 內側 y=1.954634 落在 OOBB 內但 luma 0.249575；外側 y=1.960308 落在 OOBB 外且 luma 0.252177。接縫第一格是亮 rim。 |
| - [x] | `20260513-214539` | east wall | Z=-0.703 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | 內側 z=-0.704088 落在 OOBB 內但 luma 0.539942；外側 z=-0.694459 落在 OOBB 外且 luma 0.545812。U 軸邊界接縫第一格沒有變暗。 |
| - [x] | `20260513-214539` | east wall | Y=1.955 | 邊界內外側 texel 是否落在衣櫃 OOBB 內、外、或壓邊。 | 內側 y=1.954634 落在 OOBB 內但 luma 0.294735；外側 y=1.960308 落在 OOBB 外且 luma 0.296591。接縫第一格是亮 rim。 |

## Phase 1 觀察紀錄

| 狀態 | 步驟 | 觀察 | 目前結論 | 證據位置 |
|---|---|---|---|---|
| - [x] | A / H8 | `updateR738C1BakePastePreviewUniforms()` 內的 `r7310RuntimeApplied` 使用 `(r7310C1FloorDiffuseRuntimeEnabled || r7310C1NorthWallDiffuseRuntimeEnabled)`。只要地板或北牆任一 R7-3.10 runtime 開啟且 ready，R7-3.8 paste preview 的 `applied` 就要求 `!r7310RuntimeApplied`。 | 使用者看到「地板關、北牆開，嫩芽消失」與現有 gate 完全對上。H8 高信心成立。 | `js/InitCommon.js:1174-1188` |
| - [x] | A / H8 | `updateR7310C1FullRoomDiffuseRuntimeUniforms()` 內的 `applied` 同時要求 `r7310C1FullRoomDiffuseRuntimeReady` 與 `r7310C1NorthWallDiffuseRuntimeReady`。 | 這是另一層 ready flag 耦合：即使只做 floor runtime isolation，north wall ready 狀態也會影響 R7-3.10 runtime uniform 是否整體套用。 | `js/InitCommon.js:1211-1228` |
| - [x] | A / H8 | `setR7310C1FloorDiffuseRuntimeEnabled()` 與 `setR7310C1NorthWallDiffuseRuntimeEnabled()` 都會把 `r7310C1FullRoomDiffuseRuntimeEnabled` 設成 floor 或 north 的 OR。 | UI 雖然拆成 per-surface，內部仍有 full-room 全域 runtime 狀態。 | `js/InitCommon.js:3423-3438` |
| - [x] | B / H7 | `r7310C1RuntimeSurfaceIsTrueFloor()` 只檢查 `visibleObjectID < 1.5`、`visibleNormal.y > 0.5`、`visiblePosition.y <= 0.025`。 | floor short-circuit 沒看到相機 / ray origin 是否在地板實體外，也沒看到內面 / 穿模 guard。 | `shaders/Home_Studio_Fragment.glsl:484-489` |
| - [x] | B / H7 | `r7310C1FullRoomDiffuseShortCircuit()` 在 floor mode 開啟時，只要 floor surface 判定與 UV 判定通過，就讀 atlas 並 return true。 | baked radiance 可被直接加進 `accumCol`，符合「相機在地板實體內部仍看見 baked surface 發光」的使用者補充；第二刀 B' probe 已確認 inside-floor 視角為 exiting hit，H7 guard 已落地。 | `shaders/Home_Studio_Fragment.glsl:543-555` |
| - [x] | B / H7 | `BoxIntersect()` 在 ray 位於 box 內部時會走 t1 分支，設定 `isRayExiting = TRUE`；但目前 SceneIntersect 只把 normal / hit data 帶到後續流程，R7-3.10 short-circuit 沒有使用 `isRayExiting`。 | 內部出射資訊存在於 intersect 函式，但未成為 floor short-circuit 的 guard。 | `js/PathTracingCommon.js:2748-2772` |
| - [x] | C / H5 | floor 與 north 的 fixed-X 邊界，外側第一格 texel center 均落在 OOBB 外，但 luma 已接近 0。floor 外側 x=1.347598 mean 0.003556；north 外側 x=1.347598 mean 0.000960。 | 使用者看到 fixed-X 黑線的資料端來源已量化：atlas 暗帶跨出衣櫃 xMin 邊界一格。 | `.omc/.../20260513-165203/atlas-patch-000-rgba-f32.bin`; `.omc/.../20260513-210338/atlas-patch-000-rgba-f32.bin` |
| - [x] | C / H5 | floor fixed-Z、north fixed-Y、east fixed-Z、east fixed-Y 的接縫第一格均為亮值，暗帶停在邊界內側一格或數格。 | 使用者看到 fixed-Y / fixed-Z 接縫乾淨的資料端來源已量化：NearestFilter 命中的接縫格是亮 rim。 | `.omc/.../20260513-165203/`; `.omc/.../20260513-210338/`; `.omc/.../20260513-214539/` |
| - [x] | D / Metadata | fixed-X 外側第一格落在 OOBB 外但已暗；fixed-Y / fixed-Z 的內側接縫格落在 OOBB 內但仍亮。 | 問題關鍵在 atlas 暗帶與 texel-center 對齊不對稱：X 邊界暗帶外溢，Y / Z 邊界保留亮 rim。 | `texel-metadata-patch-000-f32.bin` + `atlas-patch-000-rgba-f32.bin` |
| - [x] | D / H3' | 衣櫃相關範圍 atlas alpha 全為 1.0。floor metadata valid 欄位全 0 是目前 floor metadata 寫入慣例；north / east 衣櫃相關範圍 metadata valid 全為 1.0。 | atlas 沒有用 alpha mask 排除衣櫃 footprint / contact 區，H3' 升為強證據。 | `atlas-patch-000-rgba-f32.bin`; `texel-metadata-patch-000-f32.bin` |
| - [x] | E / H1b | east wall 的 U 軸 Z=-0.703 邊界接縫第一格 luma 0.539942，外側第一格 0.545812。 | 泛化「U 軸都壞」的 H1b 正式撤回；fixed-X / wardrobe xMin 特例併入 Phase 2 C'。 | `.omc/r7-3-10-full-room-diffuse-bake/20260513-214539/` |
| - [x] | F / H4 | 使用者提供兩張實機截圖與觀測：地板烘焙開時，東北衣櫃底部南側接縫乾淨、西側接縫黑線；北牆烘焙開時，東北衣櫃頂部北側接縫乾淨、西側接縫黑線。 | 這與 C / D 的 atlas 量化方向一致：fixed-X 外溢暗帶可見，fixed-Y / fixed-Z 保留亮 rim。H4 透視壓縮正式排除。 | 使用者 2026-05-14 對話內截圖與文字觀測。 |

## Phase 2 第一輪設計共識

完整設計入口：`docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md`。

| 狀態 | 子任務 | 共識 |
|---|---|---|
| - [x] | C' 根因 | fixed-X 暗帶外溢根因已鎖定為 bake capture path 的半 texel 偏移：`gl_FragCoord.xy` 已是 fragment center，`+ vec2(0.5)` 讓 bake 取樣比 metadata 多偏半 texel。 |
| - [x] | C' 修法設計 | 第一輪只改 bake capture path：`r738BakeUv = gl_FragCoord.xy / uResolution;`，不改正常 camera ray。修後重烘 floor / north atlas。 |
| - [x] | H8 修法設計 | 採方案 a'：保留 combined texture，加入 per-slot ready 與 mode flag 防取樣。第一輪不讀 alpha、不做 valid fallback。嫩芽 paste 只與 floor runtime 互斥。 |
| - [x] | B' probe 設計 | 擴充 `uR7310C1RuntimeProbeMode` levels 0~6 與 `reportR7310C1FullRoomDiffuseRuntimeProbe(options)`；新增 `samplePointSpace`、`rtPixel`、`decoded`，既有 6 個 hit-count 欄位原名保留。 |
| - [x] | H7 修法設計 | 先跑 B' probe，依 `isRayExiting` / ray-side 數值決定 guard 形狀。實作時需新增 `hitIsRayExiting` hit-state，並在所有 BoxIntersect 命中點寫入。 |
| - [x] | H5 / H3' | 第一輪延後，不做 alpha mask。第一輪驗收後仍見家具 footprint 暗區異常貼回，才啟動第二輪。 |
| - [x] | East wall runtime | 第一輪延後。若後續需要 east runtime，另設計第三 slot、UI 與 package ready。 |

## 鎖定禁區

| 狀態 | 禁區 | 理由 |
|---|---|---|
| - [x] | 不回到整張 atlas flood-fill。 | 已造成白線與亮值污染。 |
| - [x] | 不直接恢復舊 contact invalid region 修法。 | 先前路線已被使用者視覺回報與 OPUS 審查推翻。 |
| - [x] | Phase 2 修法需先設計共識、不允許直接跳 code 修。 | Phase 2 第一輪設計共識已成立；仍需使用者裁定後才進實作。 |
| - [x] | 不在第一輪引入 alpha / valid fallback。 | 這屬於 H5 / H3' 第二輪；第一輪 H8 只用 mode flag 防取樣。 |
| - [x] | 不在第一輪實作 H5 / H3' alpha mask。 | 第一輪 H7 guard 後再看症狀是否仍存在。 |
| - [x] | 不在第一輪納入 East wall runtime。 | 現況 east wall 只作 bake / evidence 對照；runtime 沒有第三 slot。 |
| - [x] | 不把 C' bake UV 修法套到 R7-3.8 既有 sprout atlas 而不評估視覺差異。 | R7-3.8 sprout C1 包共用同一 bake UV 計算。 |
| - [x] | 不回退 H7 guard。 | 使用者已確認 floor bake ON 時 inside-floor 全黑，H7 第二刀成立。 |
| - [x] | 不重烘 floor / north atlas。 | fixed-Z / fixed-Y 黑邊目前指向邊界格 nearest-policy；新包暗值是正確取樣結果，不以重烘處理。 |
| - [x] | 不直接複製鄰格修補邊界格。 | 這會打掉 atlas 物理意義，且會掩蓋 H5 / H3' 真正設計問題。 |
| - [x] | H7' guard 已落地，不回退。 | H7' guard 採 `uCamPos.y >= 0.025`；使用者確認 inside-floor 已全黑。後續不得改成單看 `firstVisibleIsRayExiting`。 |

## 2026-05-15 R7-3.10 H5 / H3' 第二輪收尾：1024 bake resolution（CODEX mirror）

本段鏡像 OPUS 同日收尾段，記錄 CODEX 裁定後的現況。

```text
黑線結論：
  - 使用者肉眼確認，東北衣櫃底部南側與頂部北側黑線在 1024 看不出來。
  - floor 1024 package：.omc/r7-3-10-full-room-diffuse-bake/20260515-215727
  - north 1024 package：.omc/r7-3-10-full-room-diffuse-bake/20260515-212509
  - 512 pointer 備份：.omc/r7-3-10-1024-pointer-backups/20260515-212327
  - 1024 鎖為 floor / north 目前正式候選；2048 本輪不推進。

驗證：
  - contract test pass。
  - short-circuit smoke：96170 / 190559，H7 / H8 / C' 無退化。
  - H5 black-line probe：north dominantRow=682，totalInBand=1494。
  - floor / north pointer targetAtlasResolution 皆為 1024，combined 解析度防呆已滿足。

partial bake vs LIVE 亮差：
  - 現象：部分 surface 開 bake 時，相鄰 LIVE 面可能偏亮。
  - 根因：LIVE path 先走 k 段，再接 baked radiance；有效深度成為 k + baked solution depth。
  - 判定：這是 partial bake 過渡假象，不作為 1024 拒收理由。
  - 驗收基準：全相關靜態漫射面 bake vs 全 LIVE，且 bounce 設定一致。

防污染：
  - Option A snapshot 已保留，bake capture 中 runtime short-circuit uniform 全 0，captureMode=2。
  - Option B 已加：r7310C1FullRoomDiffuseShortCircuit() 在 uR738C1BakeCaptureMode != 0 時直接 return false。
  - C runtime fallback 已移除，不回退、不重啟、不改鄰格取樣。
```

更新後鎖定項：

```text
1.  H7 / H7' inside-floor 發光已修，不回退。
2.  H5 / H3' 衣櫃兩條黑線以 1024 bake resolution 收斂，不再走 fallback。
3.  1024 為目前正式候選；2048 需另有新證據才重開。
4.  下一階段往全相關靜態漫射面烘焙推進。
```

## 下一步

Phase 1 A / B / C / D / E / F 已完成。
Phase 2 第一刀與第二刀已完成，詳見 `2026-05-14-r7-3-10-c1-phase-2-design-codex.md`。
H7' / sprout-paste-inside-guard readback probe、follow-up probe 與 camera-y guard 已由 OPUS 完成，CODEX 審查接受，使用者確認 inside-floor 已全黑。
H5 / H3' 第二輪已用 1024 bake resolution 收斂，使用者肉眼確認兩條黑線看不出來；C runtime fallback 已移除。
下一步是往全相關靜態漫射面烘焙推進，讓正式驗收避開 partial bake / LIVE 的深度相加交界。
East wall runtime 仍待使用者裁定。
