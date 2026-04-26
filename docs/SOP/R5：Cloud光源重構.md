# R5：Cloud 光源重構（4 rod → 1 panel + 遮擋體）SOP v6 【已撤回，封存歸檔】

> ⚠️ **2026-04-26 使用者拍板撤回 R5-0 整面光板（CONFIG 5）實驗**。詳見下方 §R5-Z 結論段。本 SOP 全文（v6 並行對比設計、D1-D5、Class A/B、CDF 採樣等）保留為實驗歷史紀錄供未來研究查閱，不再執行。後續效能優化合併進 `R6：渲染效能優化（BVH 加速 + 後處理降噪）.md`。
>
> v6 取代 v5（2026-04-26 使用者主導路線轉折）。**核心改變**：R5-0 從「拋棄式工作分身（worktree）+ 計數器量數字」改為「並行對比實作 CONFIG 5」。具體做法：保留 4 根燈條完整不動，另開功能分支 `r5-panel-config5` 新增第 5 種設定模式（CONFIG 5 = 整面燈板 + 黑色遮擋體），介面上即時切換 4 燈條模式 vs 燈板模式，靠肉眼比較加上收斂速度數字雙重驗證。原 R5-1「移除 4 燈條」改名為 §R5-X-rod-removal 並挪到 §R5-5 之後（要等燈板模式經過 R5-2/3/4/5 全部通過後才執行）。轉折理由：肉眼即時對比優於黑盒計數器數字、4 燈條主分支零風險、肉眼不滿意瞬間就能回滾整個分支。
>
> v5 歷史保留：v5 取代 v4（ralplan round 4 ITERATE 落實 Architect/Critic 4 必補項）。Architect/Critic 四輪 ralplan 共識（v1~v3 phantom-loop ITERATE、v4 落盤後 round 4 ITERATE）已內化為單份。Round 4 補強：A2 LUT push / A3 reverse-NEE 處置 Y / A1 occluder design-note / S4 grep 清單。Antithesis 1 採**路徑 A**：D2 由「禁面閘門」改寫為「主面漫射 + 面感應 emission 衰減（Class A/B 標註，scope-locked）」。路徑 B（拆 box）由使用者 2026-04-25 明定否決——拆開違反 R5 核心目標（採樣池 4→1）。

---

## §R5-Z 實驗結論：2026-04-26 撤回

R5-0 整面光板（CONFIG 5）實驗在分支 `r5-panel-config5` 實作完整並驗證後，使用者拍板撤回。本段為實驗結論與撤回理由。**未來任何「光源整合 / 減光源加速降噪」相關提案，必先讀完本段再動手**。

### 實驗最終狀態（fix04-cdf）

```
程式碼工作量：6 輪迭代（fix01~fix05-maxch）共 ~25 行新增 / ~10 行取代
驗證量化指標：
  - 光板能量帳對齊 4 燈條：差 0.4%（face area 浮點誤差）
  - 螢火蟲（亮度 ≥ 220 像素數）：fix03 = 27 → fix04-cdf = 0（100% 消除）
  - C5 vs C3 平均亮度差：−1.11%（PRD 5% 容忍門檻內）
  - C5 vs C3 R/B 色比差：−3.55%（per-channel min clamp 修為 max-channel normalize 後）
```

### 為何撤回（從第一性原理）

```
原始動機誤解：
  使用者以為「減少光源數量（4→1）」可大幅提升降噪速度與乾淨度，
  目標對標 C1/C2 吸頂燈的乾淨度。

物理事實（與直覺相反）：
  收斂速度的瓶頸不在「光源數量」而在「下一次事件估計（NEE）採樣效率」。

  C1/C2 吸頂燈是「朝下圓盤」：
    - emission 法向 −Y
    - 房間任何位置的 shadow ray 朝 +Y 射
    - cosLight = dot(+Y, +Y) ≈ 1
    - NEE 採樣 ~100% 有效 → 低變異 → 乾淨

  C3 4 燈條 / C5 整面光板都是「朝外光源」：
    - emission 法向 ±X / ±Z（+ 部分 +Y 但被吸頂吸音板擋）
    - 房間下方位置看光源，cosLight 多半接近 0
    - NEE 採樣 50%+ 浪費（throughput ≈ 0）→ 高變異 → 髒

結論：
  「減光源」不能改善「朝外光源」的物理本質。
  C5 對標的是 C3，不是 C1/C2。
  C5 fix04-cdf 已逼到 C3 同等乾淨度，再無提升空間。
```

### 撤回理由與後續方向

```
1. C5 不能取代 C1/C2 的乾淨度（物理本質限制）。
2. C5 對標 C3 已達成（螢火蟲、亮度、色比都收斂到容忍範圍）。
3. C3 與 C5 並列「朝外光源」對比實驗的價值，相對於開發/維護成本，使用者判斷 ROI 不足。
4. 真正能加速 C3/C4 的方向是「後處理降噪」與「採樣效率優化」，已合併進 R6。
```

### 封存處置

```
worktree：Home_Studio_3D-r5-panel-config5（保留為實驗 archive，不合併、不刪）
   - 完整 fix02 → fix05-maxch 程式碼可供未來查閱
   - 含完整 PRD / progress 紀錄於 .omc/

main 分支：r3-light（R5 完工 merge 前延用，本撤回不影響 main 程式碼）

不執行：
   - R5-1 ~ R5-5（CDF / 5b / Class A/B 全套 panel 設計）
   - §R5-X-rod-removal（移除 4 燈條）
   - 任何 panel/occluder 相關幾何
```

### 警示：未來若再想試「光源整合」類想法

```
1. 必先區分「光源幾何」與「採樣效率」是兩件事
2. 必先確認新光源的 emission 朝向（朝下 vs 朝外決定 cosLight 上限）
3. 必先預估 NEE sample 的有效率，而非單看光源數量
4. C5 fix04-cdf 已驗證「整面光板 + CDF 加權採樣 + max-channel clamp」是當前最佳實作
   再優化空間：path guiding / portal sampling / 雙邊濾波後處理（屬 R6 範疇）
```

---

## ⬇️ 以下為已撤回的原 v6 設計 SOP（保留為實驗歷史，不執行）

---

## 🚨 接手第一步（不得跳過）

依序讀：

```
1. docs/SOP/Debug_Log.md 開頭通用 Debug 紀律三條
2. .omc/HANDOVER-R4.md 全文（R4-3-追加 / R4-4 量綱基準必看）
3. ~/.claude/projects/-Users-eajrockmacmini-Documents-Claude-Code/memory/feedback_r5_cloud_occluder_purpose.md
4. 本檔 v4 + docs/SOP/R4：UI控制層.md（風格模板）
5. 分支驗證：git branch --show-current 應為 r3-light（R4 完工 merge 前延用）
```

---

## 前提定調

```
1. 首要動機：壓低 CONFIG 3（全吸音 + 僅 Cloud 漫射燈）底噪。次要全部退讓。
2. 範圍鎖定：Cloud 光源幾何重構 + 下一次事件估計（NEE）採樣邏輯重寫。
3. 1:1 物理等效：新幾何輸出之等效光通量 Φ 與現況 4 根鋁槽燈條精確等效（偏差 <1%）。
4. UI 介面層完全凍結：R4 接線之 lm/m 滑桿、色溫、A/B、CONFIG 1/2/3/4 不動分毫。
5. 採樣池大小硬約束：1。任何讓採樣池退回 ≥2 的設計即違反 R5 核心，立即 abort。
6. 動手前先 grep r3-light HEAD 取實測索引基準（CLOUD_BOX_IDX_BASE / TRACK_*_IDX / fixtureGroup 對齊）。
```

---

## D1~D5 鎖死決策

| ID | 決策 | 重點 |
|---|---|---|
| D1 | A/B 模式保留現狀 | R5 完工後再評估 B 模式去留（HANDOVER F6 結轉） |
| D2 | panel 單一 sceneBox + 面感應 emission（Class A/B） | v4 路徑 A 改寫，scope-locked（V4-I1） |
| D3 | 表面均勻 jitter 採樣（Class A 面積加權 CDF） | 物理正確面光源標準；uniform emission 下與重要性採樣等價 |
| D4 | 遮擋體 R4-3-追加 1mm 模式（+1mm 上方、X/Y 內縮 16mm、Z=1mm） | 已驗證 commit `0594f00` |
| D5 | Class A 主發光面 / Class B emission=0 面 | v4 新增條文，scope-locked 至 emission 屬性 |

### D2 路徑 A 條文（V4-I1 scope-lock 強制）

panel 為**單一 sceneBox**（`sceneBoxes` 增加 1 entry），shader 命中該 box 時依 `hitNormal` + `hitPoint` 分流：

```
Class A（主發光面，emission = L_panel）：
  • 頂面外緣 16mm 框：hitNormal.y > 0.5 ∧（|hitPoint.x| > 0.884 ∨ |hitPoint.z - 0.498| > 1.184）
  • 四側面：|hitNormal.x| > 0.5 ∨ |hitNormal.z| > 0.5

Class B（衰減為 0 面，emission = vec3(0)）：
  • 頂面中央：hitNormal.y > 0.5 ∧ 不屬 A（被遮擋體覆蓋區）
  • 底面：hitNormal.y < -0.5（緊鄰 Cloud GIK 吸音板）
```

**scope-lock 條文（V4-I1 嚴格強制，違反即 commit reject）**：

```
1. Class A/B 區分僅作用於 emission 屬性。
2. 嚴禁延伸至 albedo / roughness / metalness / refractiveIndex 等其他材質參數。
3. panel sceneBox 之 albedo / roughness / metalness 為單一值（roughness=1, metalness=0,
   albedo=R5 調校最終值；建議 0.85，與 Cloud GIK 視覺對齊）。
4. shader 端 panel 命中分支必明文標註「// Class A/B emission split, R5-D2 v4 path A」。
5. js sceneBoxes 端必明文加註 fixtureGroup=4 + 指向本檔 D2 條文。
```

**為什麼合法**（Antithesis 1 路徑 A 收斂說明）：

- D2 原條文「嚴禁面閘門」之歷史脈絡：禁聚光燈式 cone falloff（`dot(n, lightDir) > threshold`），目的避免把面光源退化為帶角度依賴的偽聚光（memory `feedback_pathtracing_spotlight_facegate_and_maxch_normalize.md`）。
- v4 Class A/B 條文不是聚光：A 與 B 之分界是「該面光線會否被遮擋體 / GIK 物理攔截」之**純幾何先驗**，不引入入射方向、視角依賴或 cone 角度依賴。
- 結構等價於：先把 panel 拆 5~6 個 sub-box，再做面光源池聚合（pool=1）的工程實作；v4 採單 sceneBox + shader 內判定，省去 sceneBoxes 5 個 entry + BVH 5 個葉節點開銷。
- 維持採樣池 = 1（R5 核心目標不破）。
- scope-locked 至 emission（V4-I1），嚴禁污染其他材質參數。

**禁忌（NEW-1 強化）**：

```
禁止：panel 拆成多個 sceneBox（複合 panel）以滿足 Class A/B 切分。
理由：採樣池 N 條 entry = N 個獨立光源，違反 R5 鐵則「採樣池=1」。
正解：單一 sceneBox + shader 端 hitNormal 判定。
驗證：sceneBoxes.filter(b => b.fixtureGroup === 4 && b.type === CLOUD_LIGHT).length === 1
```

---

## 階段總覽

| 階段 | 主題 | 重要產出 | commit 模式 |
|---|---|---|---|
| R5-0 | **並行對比實作 CONFIG 5（v6 改寫）** | `r5-panel-config5` 分支建立 + 12 組肉眼/數字對比通過（肉眼差異 ≤ 5%、收斂速度 3 倍以上） | 分支內紀錄存檔（通過才合併回 r3-light） |
| R5-2a | Panel emission 切分 + 雜訊清除 | Class A/B + 刪除舊對角面 MIS + 刪除舊 reverse-NEE PDF | 原子 commit（三項耦合） |
| R5-2b | NEE 採樣切換為 Class A 面積加權 CDF | 5 段 CDF；`sampleStochasticLightDynamic` 重寫；雙處 gate 對稱 | 原子 commit |
| R5-2c | LUT 11→8 壓縮 | NEE 池減 3 槽；`lastNeePickedIdx` 從 7-10 改 ==7 單值 | 原子 commit |
| R5-3-pre1 | clamp=50 firefly 基線統計 | `.omc/R5-3-baseline-clamp50.md`（V4-I4） | read-only commit |
| R5-3-pre2 | uEmissiveClamp 50→100 + observability | TRACK / WIDE / panel emission peak log | 原子 commit |
| R5-3 | 光度補償（Synthesis A） | `L_panel = Φ/(K·π·A_class_A)`，k_compensate 移除 | 原子 commit |
| R5-4 | 收斂驗證 | Multi-cam × CONFIG sweep；同 RMSE 收斂 SPP 比 ≥3.0 | 純驗證（不 commit） |
| R5-5 | 主觀亮度同框比對 | 使用者 GO/NO-GO gate | 純驗證（不 commit） |
| **R5-X-rod-removal** | **4 燈條程式碼移除（v6 從 R5-1 改名搬到這裡）** | 移除 4 元素參數陣列（`uCloudFaceArea` / `uCloudRodCenter` / `uCloudRodHalfExtent` 等）、4 燈條的 `sceneBoxes`、燈條模式介面選項；`BASE_BOX_COUNT` 77→73 | 原子紀錄存檔（R5-5 全部通過後才執行） |

**v6 註**：原 R5-1「Cloud 光源幾何重構（4 燈條 → 整面燈板 + 遮擋體）」已拆成兩半——「新增整面燈板 + 遮擋體」併入 R5-0（並存於 4 燈條），「移除 4 燈條」延後到 R5-X-rod-removal。原 §R5-1 段落內容仍然保留在本文件（標題加 v6 警示），改動清單仍然是 R5-X-rod-removal 的執行依據。

---

## R5-0 並行對比實作（CONFIG 5）

### 動機（v6 改寫；v6.1 補正）

原 v5「拋棄式工作分身（worktree）+ 計數器量數字」屬於黑盒驗證（看不到場景，只看數字）。v6 改採「並行對比實作」：在功能分支 `r5-panel-config5` 內新增第 5 種設定模式（CONFIG 5 = 整面光板 + 黑色暗板），4 燈條完整保留不動。介面上切換 CONFIG 1-4（4 燈條模式）vs CONFIG 5（整面光板模式），用肉眼加上收斂速度數字雙重驗證光板模式是否達成「視覺 95% 近似 + 收斂速度 3 倍加速」目標。

**v6.1 補正（2026-04-26）**：v6 把光板 + 暗板設計成「靜態 sceneBox」，但光板的 X 範圍 (-0.9, 0.9) 完全包住 4 燈條的 X 範圍 (±0.884, ±0.900)。在加速結構（BVH）內光板會物理遮擋 4 燈條，CONFIG 1-4 時 4 燈條雖然發光強度算對但光線打不出去，造成全黑。v6.1 改成「動態 BVH 切換」：光板 + 暗板只在 CONFIG 5 才出現於場景，CONFIG 1-4 完全不存在，兩模式互不干擾。

優點：

```
1. 肉眼即時對比，遠勝看不到場景的黑盒數字
2. 4 燈條主分支零風險（光板失敗就砍分支，原始狀態毫髮無傷）
3. 對比工具可以重複用於 R5-2/R5-3/R5-4 後續驗證
4. 不需要 R5-1 從零重做（光板已在 r5-panel-config5 分支實作，合併即可）
5. v6.1 動態切換：兩模式 BVH 互不干擾，避免靜態 sceneBox 物理遮擋衝突
```

### 作法（v6.1 動態 BVH 切換）

```
1. 開功能分支：
   git worktree add ../Home_Studio_3D-r5-panel-config5 -b r5-panel-config5 r3-light

2. BASE_BOX_COUNT correction (v6.1 latent bug fix + dynamic-BVH prerequisite):
   r3-light HEAD: BASE_BOX_COUNT = 75 (does NOT include desk reference cube idx 75)
                  → applyPanelConfig truncates desk cube every config switch
                    (latent bug; PASS-8 anchor intent inconsistent)
   v6.1 fix:      BASE_BOX_COUNT = 76 (includes desk reference cube)
                  → desk cube preserved across config switches
   Static sceneBoxes after L197 unchanged from r3-light.
   NO 光板 / 暗板 in static section (v6.1 dynamic push inside applyPanelConfig only).

3. Top-level constants (no addBox call here; v6.1 Y +1mm to avoid Cloud 吸音板 top-face Z-fighting):
   const C_OCCLUDER = [0.05, 0.05, 0.05];                              // 暗板（吸收體）
   const CLOUD_PANEL_LUMENS_TOTAL = 1600 * (2.4 * 2 + 1.768 * 2);      // 沿用 4 燈條總 Φ 等效
   const CLOUD_PANEL_TOP_EDGE_WIDTH = 0.016;
   const CLOUD_PANEL_MIN = new THREE.Vector3(-0.9, 2.788, -0.702);   // Y +1mm 避開吸音板頂面共面打架
   const CLOUD_PANEL_MAX = new THREE.Vector3( 0.9, 2.804,  1.698);   // Y +1mm 連動，光板厚度 1.6cm 不變
   const CLOUD_PANEL_SIZE = CLOUD_PANEL_MAX.clone().sub(CLOUD_PANEL_MIN);
   const CLOUD_PANEL_TOP_EDGE_AREA = top_face - inner_recess  (per 5b 公式)
   const CLOUD_PANEL_SIDE_AREA     = N + S + E + W faces        (per 5b 公式)
   const CLOUD_PANEL_AREA_LUMINOUS = TOP_EDGE_AREA + SIDE_AREA;       // 0.26778 m²

4. Uniform 宣告（pathTracingUniforms init 之後）：
   pathTracingUniforms.uCloudPanelMin          = { value: CLOUD_PANEL_MIN.clone() };
   pathTracingUniforms.uCloudPanelMax          = { value: CLOUD_PANEL_MAX.clone() };
   pathTracingUniforms.uCloudPanelTopEdgeWidth = { value: CLOUD_PANEL_TOP_EDGE_WIDTH };
   pathTracingUniforms.uCloudPanelSegArea      = { value: new Float32Array(5) };  // R5-2b 預留
   pathTracingUniforms.uCloudPanelCDF          = { value: new Float32Array(5) };  // R5-2b 預留
   pathTracingUniforms.uCloudPanelEmission     = { value: new THREE.Vector3() };
   pathTracingUniforms.uCloudRodEnabled        = { value: 1.0 };  // 1=4 燈條模式 / 0=光板模式
   pathTracingUniforms.uCloudPanelObjId        = { value: 0.0 };  // 0=光板不存在 / 正值=hitObjectID

5. GUI: Add CONFIG 5 button. Description: "Cloud 整面光板模式（R5-0 並行對比 v6.1）".
   GIK config: NO wall-panel push (mirrors CONFIG 3 全吸音 baseline; Cloud 天花板吸音板
   靠 fullAbsorb 機制 auto-on; 排除牆面 GIK 變因影響光板 vs 4 燈條比較公平性).

5b. 光板 emission 發光面 / 暗面切分 (R5-0 v6.1，原 R5-2a 切分提前):

    Reason: SOP §R5-0 原步驟「光板 emission 統一一個值，不切」。但 Φ_total = 13,337 lm
    spread over A_total = 8.77 m² gives L = 1.5 W/(sr·m²)，比 4 燈條外發光面 49.7 W/(sr·m²)
    弱 33 倍。CONFIG 5 全黑無法肉眼對比。發光面切分必須在 R5-0 完成才能達 v6 肉眼對比目標。

    Luminous faces (光板發光面，emit = L_panel):
        Top edge 16mm frame:
            hitNormal.y > 0.5
            ∧ (abs(hitPoint.x) > uCloudPanelMax.x - uCloudPanelTopEdgeWidth
               ∨ hitPoint.z < uCloudPanelMin.z + uCloudPanelTopEdgeWidth
               ∨ hitPoint.z > uCloudPanelMax.z - uCloudPanelTopEdgeWidth)
        4 side faces:
            abs(hitNormal.x) > 0.5 ∨ abs(hitNormal.z) > 0.5

    Dark faces (光板暗面，emit = vec3(0)):
        Top center: hitNormal.y > 0.5 ∧ NOT luminous
        Bottom:     hitNormal.y < -0.5

    L_panel computation:
        A_luminous = top_edge_area + 4_side_area
                   = 0.13338 m² + 0.1344 m² = 0.26778 m²
        L_panel    = computeCloudRadiance(CLOUD_PANEL_LUMENS_TOTAL,
                                          cloudKelvin,
                                          CLOUD_PANEL_AREA_LUMINOUS)

    Scope-lock (V4-I1 strict): luminous/dark split applies to emission ONLY.
    光板 sceneBox albedo / roughness / metalness / refractiveIndex stay
    single-valued. Violation → commit reject.

    §R5-2a impact: face-split block in §R5-2a is now redundant (done at R5-0 5b).
    §R5-2a remaining work shrinks to:
        - Delete old diagonal-face MIS block (shader L1146-1189 4-rod era)
        - Delete old reverse-NEE PDF block (shader L1704-1721)
    Scope rename: §R5-2a "Panel emission split + noise cleanup" → "Noise cleanup".

6. applyPanelConfig modification (function body 內):
   - 牆面 GIK push: existing logic UNCHANGED
       CONFIG 1 → panelConfig1.forEach
       CONFIG 2 → panelConfig2.forEach
       CONFIG 3, 4, 5 → no wall-panel push
   - CONFIG 5 only: dynamic push 光板 + 暗板（牆面 GIK skip 之後）：
       if (config === 5) {
           addBox([-0.9, 2.788, -0.702], [0.9, 2.804, 1.698],
                  z3, C_CLOUD_LIGHT, 14, 0, 1, 4);   // 光板（Y +1mm 避開吸音板頂面）
           addBox([-0.884, 2.805, -0.686], [0.884, 2.806, 1.682],
                  z3, C_OCCLUDER, 1, 0, 0, 4);      // 暗板（Y +1mm 連動光板頂面）
       }
   - fullAbsorb gate (Cloud 天花板吸音板):
       fullAbsorb = (config === 3 || config === 4 || config === 5)
   - 4 燈條 NEE pool gate (CONFIG 3 only, NOT CONFIG 5):
       cloudLampOn = (config === 3)   // CONFIG 5 走光板，不走 4 燈條
   - Update uCloudPanelObjId:
       const panelSceneIdx     = BASE_BOX_COUNT;       // 76（CONFIG 5 沒 push 牆面 GIK）
       const panelHitObjectID  = panelSceneIdx + 1;    // 77（shader 慣例 +1）
       pathTracingUniforms.uCloudPanelObjId.value =
           (config === 5) ? panelHitObjectID : 0.0;
   - 互斥 emission gate:
       const panelMode = (config === 5);
       pathTracingUniforms.uCloudRodEnabled.value = panelMode ? 0.0 : 1.0;
       if (panelMode) {
           const radiance = computeCloudRadiance(
               CLOUD_PANEL_LUMENS_TOTAL, cloudKelvin, CLOUD_PANEL_AREA_LUMINOUS);
           const srgb = kelvinToRGB(cloudKelvin);
           const rLin = Math.pow(srgb.r, 2.2);
           const gLin = Math.pow(srgb.g, 2.2);
           const bLin = Math.pow(srgb.b, 2.2);
           pathTracingUniforms.uCloudPanelEmission.value.set(
               radiance * rLin, radiance * gLin, radiance * bLin);
       } else {
           pathTracingUniforms.uCloudPanelEmission.value.set(0, 0, 0);
       }

7. Shader 光板命中分支（v6.1 動態 uCloudPanelObjId 比對，取代 v6 寫死 rodIdx >= 5）:
   if (hitType == CLOUD_LIGHT) {
       if (uR3EmissionGate > 0.5) {
           // 光板命中: dynamic uCloudPanelObjId match (CONFIG 5 only;
           // CONFIG 1-4 has uCloudPanelObjId=0, condition false, skip 光板 branch)
           if (uCloudPanelObjId > 0.5
               && abs(hitObjectID - uCloudPanelObjId) < 0.5)
           {
               // Apply 5b luminous/dark face split
               bool isTopFace  = hitNormal.y > 0.5;
               bool isBotFace  = hitNormal.y < -0.5;
               bool isSideFace = !isTopFace && !isBotFace;
               bool isTopEdge  = isTopFace && (
                   abs(hitPoint.x) > uCloudPanelMax.x - uCloudPanelTopEdgeWidth
                || hitPoint.z < uCloudPanelMin.z + uCloudPanelTopEdgeWidth
                || hitPoint.z > uCloudPanelMax.z - uCloudPanelTopEdgeWidth
               );
               bool isLuminous = isTopEdge || isSideFace;
               vec3 panelEmit  = isLuminous ? uCloudPanelEmission : vec3(0.0);
               if (diffuseCount == 0) pixelSharpness = 1.0;
               accumCol += min(mask * panelEmit, vec3(uEmissiveClamp));
               break;
           }
           // 4 燈條命中 (rodIdx 0..3, hitObjectID 72..75)
           int rodIdx = int(hitObjectID - uCloudObjIdBase + 0.5);
           rodIdx = clamp(rodIdx, 0, 3);
           // 既有 4 燈條邏輯 + uCloudRodEnabled gate 不變:
           //   isOuterLong / isEmissiveFace / emission = uCloudEmission[rodIdx] * uCloudRodEnabled
       }
   }

8. Throw-first 守門（v6.1，依動態 BVH 結構調整）:
   // Pre-config sanity (after static addBox section, BEFORE first applyPanelConfig)
   if (sceneBoxes.length !== BASE_BOX_COUNT)
       throw '[R5-0] BASE_BOX_COUNT pre-config drift';
   // Post-config sanity (inside applyPanelConfig at end, BEFORE BVH rebuild)
   if (currentPanelConfig === 5) {
       const panelIdx = BASE_BOX_COUNT;  // 76（CONFIG 5 沒 push 牆面 GIK）
       if (sceneBoxes[panelIdx].fixtureGroup !== 4)
           throw '[R5-0] panel fg ≠ 4';
       if (sceneBoxes[panelIdx + 1].fixtureGroup !== 4)
           throw '[R5-0] occluder fg ≠ 4';
       if (sceneBoxes[panelIdx].cullable !== 1)
           throw '[R5-0] panel cullable ≠ 1';
       if (sceneBoxes[panelIdx + 1].cullable !== 0)
           throw '[R5-0] occluder cullable ≠ 0';
       if (Math.abs(pathTracingUniforms.uCloudPanelObjId.value - (panelIdx + 1)) > 0.5)
           throw '[R5-0] uCloudPanelObjId desync with sceneBox idx';
   }

9. cache-buster: ?v=r5-0-v6.1-dynamic
```

### 預先排雷（v6.1）

```
1. 共面打架（Z-fighting）：
   光板底面與天花板吸音板頂面共用 Y=2.787 會造成大面積（4.32 m²）共面打架，
   視覺出現黑斑/隨機反射。v6.1 光板底面上抬到 Y=2.788（+1mm 空隙），
   暗板底面連動上抬到 Y=2.805，避免共面打架。
   原 4 燈條 X 邊界（±0.884~±0.900）跨吸音板邊界（±0.9），共面區域微小（0.038 m²），
   視覺不明顯，所以 r3-light HEAD 可保持 Y=2.787 無事。
   v6.1 光板覆蓋整個吸音板範圍，必須採 +1mm 空隙。

2. 光板取代 4 燈條而非並列：
   v6.1 光板 + 4 燈條同時存在於場景的時機只有 CONFIG 5 切換瞬間，
   CONFIG 1-4 光板從 BVH 移除，4 燈條獨佔。
   互斥邏輯靠 uCloudRodEnabled (4 燈條 emission 閘) + uCloudPanelObjId (光板存在閘)
   雙重保證，不可單側 gate。

3. uCloudPanelObjId 動態 idx 同步：
   panel idx 寫死 76 是因 CONFIG 5 沒 push 牆面 GIK。如果未來 CONFIG 5
   改 push 牆面 GIK，panel idx 必須連動 += panelConfigN.length，
   否則 shader uCloudPanelObjId 比對失敗。守門條件 (8) 已 catch 此偏差。
```

### 通過條件

```
肉眼層：
1. CONFIG 5 vs CONFIG 1-4 在相同取樣數（spp）、相同相機位置下，視覺差異不超過 5%（95% 近似）
2. 使用者主觀判定通過（GO）

數字層：
1. CONFIG 5 達到相同雜訊水準（RMSE）所需的取樣數，
   不超過 CONFIG 1-4 的 1/3（也就是收斂速度至少 3 倍加速）
   或 CONFIG 5 在相同取樣數下的雜訊水準（RMSE），
   不超過 CONFIG 1-4 的 1/√3
2. 共 12 組對比：3 個相機位置 × CONFIG 1/2/3/5

兩層都通過才進 R5-2a。
```

### 通過後處置

```
1. 合併分支：r5-panel-config5 → r3-light（保留 4 燈條 + 燈板兩種光源並存）
2. 砍工作分身：git worktree remove ../Home_Studio_3D-r5-panel-config5
3. 進 R5-2a（燈板 emission 切 Class A/B，4 燈條維持原狀不動）
4. 4 燈條程式碼依然存在（CONFIG 1-4 仍可使用）
5. 整個 R5（含 R5-2/3/4/5）全部完工後，才進 §R5-X-rod-removal 移除 4 燈條
```

### 失敗處置

```
1. 砍分支：git worktree remove + git branch -D r5-panel-config5
2. 4 燈條主分支毫髮無傷（CONFIG 1-4 視覺與物理零變化）
3. 回頭重新規劃（ralplan）評估替代方案：
   - 累積機率分布加權（CDF weighting）？
   - 加速結構細分（BVH subdivision）？
   - 分區 emission？
4. 不進 R5-2
```

---

## ⚠️ R5-1 Cloud 幾何重構 → v6 改名 §R5-X-rod-removal（執行時機後移）

> **v6 警示（2026-04-26）**：本階段 v6 改名為 **R5-X-rod-removal**，執行時機從「R5-2 之前」改成「R5-5 全部通過之後」。
>
> 改名理由：v6 R5-0 已經在 `r5-panel-config5` 分支實作整面燈板 + 黑色遮擋體並合併回 r3-light，4 燈條與整面燈板已經並存於主分支；本階段語義從「替換」改成「移除舊的 4 燈條模式」。
>
> 改動清單（下文）仍然適用作為 R5-X-rod-removal 的執行依據，但前提變更如下：
>
> ```
> 改前狀態（R5-X 動工前）：
>   4 燈條（陣列編號 71-74）+ 整面燈板（編號 76）+ 遮擋體（編號 77）
>   BASE_BOX_COUNT = 77
>
> 改後狀態（R5-X 完工）：
>   整面燈板（編號 71）+ 遮擋體（編號 72）
>   BASE_BOX_COUNT = 73
>
> 編號位移審查改寫：
>   原文「75 號之後的 sceneBoxes 全部 -2」改為：
>   1. 移除 4 燈條（陣列編號 71-74）
>   2. 整面燈板從編號 76 移到 71
>   3. 遮擋體從編號 77 移到 72
>   4. 桌面參考塊從編號 75 移到 73
>   5. BASE_BOX_COUNT 從 77 改為 73
>
> 相關介面：
>   1. 移除 CONFIG 1-4 對 4 燈條發光的控制
>   2. CONFIG 5 改名為「整面燈板唯一模式」
> ```
>
> 觸發條件：R5-2/3/4/5 全部通過（整面燈板經過 Class A/B 切分、累積機率分布加權（CDF weighting）、光度補償、收斂驗證、主觀亮度比對全都通過）。
>
> 失敗回滾：若 R5-X 移除後出現異常，`git revert` 即可回到「整面燈板 + 4 燈條並存」狀態。

### 改動清單（仍適用為 R5-X-rod-removal 執行依據）

```
1. js/Home_Studio.js L190-193（4 rod addBox 4 行）→ 替換為：
   addBox([-0.9, 2.787, -0.702], [0.9, 2.803, 1.698], z3, C_CLOUD_LIGHT, 14, 0, 1, 4);
   // sceneBox 71 = Cloud panel（單一光源實體，採樣池=1）
   addBox([-0.884, 2.804, -0.686], [0.884, 2.805, 1.682], z3, C_OCCLUDER, 1, 0, 0, 4);
   // sceneBox 72 = Cloud occluder（type=DIFF, low-albedo, fixtureGroup=4 同 panel 同步開關）

2. CLOUD_BOX_IDX_BASE = 71 不動（panel 仍 71）。
3. 新增常數 CLOUD_OCCLUDER_IDX = 72（throw-first 守門 + recompute 用）。
4. fixtureGroup=4 涵蓋 panel + occluder（GUI uCloudLightEnabled 同步顯隱）。
4a. **設計註記（防 Round 4+ 再起 antithesis）**：occluder fixtureGroup=4 與 panel 同步顯隱
   乃刻意設計——panel emission=0（uCloudLightEnabled=0）時 occluder 之物理意義
   即失效（occluder 唯一作用為攔截 panel 自身發光）。R5 階段不考慮「panel 留 / occluder
   撤」之分流；CONFIG 1/2/3/4 皆共用此同步開關鏈，與 applyPanelConfig（js/Home_Studio.js:368-372）
   既有邏輯一致。
5. 移除 4 元素陣列 uniform：
   - uCloudFaceArea[4] / uCloudRodCenter[4] / uCloudRodHalfExtent[4] / CLOUD_ROD_FACE_AREA / CLOUD_ROD_CENTER / CLOUD_ROD_HALF_EXTENT。
6. 新增單值 uniform：
   - uCloudPanelMin (vec3) / uCloudPanelMax (vec3) / uCloudPanelTopEdgeWidth (float = 0.016)。
   - uCloudPanelSegArea[5] (float[5])：Class A 5 段面積。
   - uCloudPanelCDF[5] (float[5])：Class A 累積機率（R5-2b 用，R5-1 先預留）。
7. 索引位移審查（v5 補正，2026-04-26 r3-light HEAD 實測）：原 75+ 之 sceneBoxes 全部 -2（4 rod → 2 box）。
   實測既有漏項清單（必須同步 -2 處理，缺一即敗）：
   a. js/Home_Studio.js L197「桌面參考塊」idx 75 → idx 73
      （comment 寫「59 桌面參考塊」是邏輯編號；實際陣列 idx 為 75，
       依 memory feedback_sceneboxes_idx_vs_logical_id.md 規則，每次 R5-1 動 idx
       必先實算 sceneBoxes.length）。
   b. BASE_BOX_COUNT 常數同步 -2
      （js/Home_Studio.js L248 / L327 / L349 之 applyPanelConfig 動態切換邏輯依賴
       此常數截斷 sceneBoxes.length；不同步 -2 會導致 CONFIG 1/2/3/4 切換時索引爆炸）。
   c. applyPanelConfig 函式內 hard-coded idx 引用審查
      （grep 'sceneBoxes\[' js/Home_Studio.js 內 applyPanelConfig 範圍，
       任何指向 71-78 之 hard-coded idx 必須同步 -2 或改用具名常數）。
   d. throw-first 守門（行 187）之 CLOUD_BOX_IDX_BASE 比對 = 71 不變
      （panel 仍取代 4 rod 起始位置，BASE 不動）。
8. cache-buster：?v=r5-geom
```

### 6 條 Throw-first 守門（必含 V4-I2 兩條新增）

```
(a) JS sceneBoxes 索引（panel + occluder + cullable + fg）：
  if (sceneBoxes.length !== CLOUD_BOX_IDX_BASE)
    throw '[R5-1] CLOUD_BOX_IDX_BASE drift';
  if (sceneBoxes[CLOUD_BOX_IDX_BASE].fixtureGroup !== 4)
    throw '[R5-1] panel fg ≠ 4';
  if (sceneBoxes[CLOUD_OCCLUDER_IDX].fixtureGroup !== 4)
    throw '[R5-1] occluder fg ≠ 4';
  if (sceneBoxes[CLOUD_BOX_IDX_BASE].cullable !== 1)
    throw '[R5-V4-I2] panel cullable ≠ 1';
  if (sceneBoxes[CLOUD_OCCLUDER_IDX].cullable !== 0)
    throw '[R5-V4-I2] occluder cullable ≠ 0';

(b) shader NEE_SLOT_COUNT 範圍（R5-2c 後啟用）：
  console.assert(NEE_SLOT_COUNT === 8, '[R5-2c] LUT must shrink 11→8');
  // panel 對應 slot idx === 7（單值 hard-coded）

(c) fixtureGroup table（V4-I6：R5 階段嚴禁開 fg=5+，違反即 throw）：
  fg=1 → TRACK            fg=2 → WIDE
  fg=3 → GIK              fg=4 → Cloud panel + occluder
  fg=5+ 保留（R5 階段嚴禁啟用）

(d) BSDF-indirect leftover grep（R5-1 commit 前必執行，0 hit 才能 commit）：
  grep -nrE 'uCloudRod|uCloudFaceArea|cloudIsEmissiveFace|cloudIsOuterLong|k_compensate' shaders/ js/

(e) face-id 雙源契約（throw-first 兩端對照）：
  CLOUD_BOX_IDX_BASE     (js/Home_Studio.js:186)
  uCloudObjIdBase        (js/Home_Studio.js:1220 = CLOUD_BOX_IDX_BASE + 1)
  if (uniforms.uCloudObjIdBase.value !== CLOUD_BOX_IDX_BASE + 1)
    throw '[R5-1] face-id pair drift';

(f) lastNeePickedIdx Cloud 範圍修正（R5-2c 階段執行；NEW-4 單值守門）：
  shaders/Home_Studio_Fragment.glsl:1165 / :1690
  原  if (lastNeePickedIdx >= 7 && lastNeePickedIdx <= 10)
  改  if (lastNeePickedIdx == 7)  // panel 唯一 NEE slot
```

### Pre-mortem 提醒

R2-14 Z-fighting 教訓：遮擋體與 panel 頂面相距 +1mm 為已驗證下限（commit `0594f00` 桌面 patch 同模式，memory `feedback_home_studio_r2_14_zfighting_failure.md`）。任何「縮至 0.5mm 省空間」「下沉法 max.y 微降」之嘗試**直接退回**，不重新評估。

---

## R5-2a 雜訊清除（v6 範圍縮小：原「Panel emission 切分 + 雜訊清除」）

> **v6 警示（2026-04-26）**：本階段原本含「Panel emission 發光面/暗面切分」工作，
> v6 因 R5-0 視覺對比需求已提前到 §R5-0 步驟 5b 完成。本階段剩餘工作縮減為「雜訊清除」：
> - 刪除 shader L1146-1189 舊對角面 MIS 區塊（4 燈條時代殘留）
> - 刪除 shader L1704-1721 舊 reverse-NEE PDF 區塊（依 4 燈條對角面，量綱失配）
> - 下文「改動清單」第 1 項（panel 命中分支重寫）已於 R5-0 5b 完成，**本階段不再執行**
> - 下文「BSDF-indirect MIS reverse-PDF 處置」、「三項耦合性」、「對稱性守則」仍適用為紀律參考

### 改動清單

```
1. shader panel 命中分支重寫（替代 L1146-1189 + L1664+ 區塊）：
   if (hitType == CLOUD_LIGHT) {
       // R5 D2 path A: Class A/B emission split (NOT face-gate / NOT spotlight cone falloff).
       // Justification: A vs B is geometry-prior occlusion (occluder/GIK), not direction-dependent.
       // Forbidden extension: this split MUST NOT propagate to albedo/roughness/metalness.
       // See docs/SOP/R5：Cloud光源重構.md §D2 path A.
       bool isTopFace = hitNormal.y >  0.5;
       bool isBotFace = hitNormal.y < -0.5;
       bool isSideFace = !isTopFace && !isBotFace;
       bool isTopEdge = isTopFace && (abs(hitPoint.x) > 0.884
                                      || abs(hitPoint.z - 0.498) > 1.184);
       bool classA = isTopEdge || isSideFace;
       vec3 panelEmit = classA ? hitEmission : vec3(0.0);
       // accumCol += panelEmit * mask（走既有 += 慣例，禁退回 =；R4-3-追加 ceiling NEE 教訓）
   }

2. 刪除 shaders/Home_Studio_Fragment.glsl L1146-1189
   （cloudIsEmissiveFace / cloudIsOuterLong 對角面 MIS 區塊，4-rod 時代殘留）。

3. 刪除 shaders/Home_Studio_Fragment.glsl L1704-1721 區塊
   （hitType == CLOUD_LIGHT 之 reverse-NEE PDF 計算，依 4-rod 對角面，量綱失配）。
```

### BSDF-indirect MIS reverse-PDF 處置（採處置 Y：放棄 MIS）

```
panel 為 0.268 m² 大面光源，BSDF-indirect bounce ray 命中 Class A 面時，採處置 Y——
**放棄 MIS power-heuristic**，於 shader L1704 區塊刪除後落入上層 `accumCol += mask;` 路徑
（unweighted emission 累積）。

理由：
  1. BSDF-indirect 命中 panel 機率本就低（Class B emission=0 之區占 panel 大表面積）。
  2. MIS 加權收益有限。
  3. 避免量綱重審（新 panel reverse-PDF 公式需與 5 段 CDF forward 邊際對齊，
     雖數學可導但增加 commit 複雜度）。

升級條件（處置 Y → 處置 X）：
若 R5-4 收斂驗證之同 RMSE SPP 比 ratio < 3.0（未達 R5 核心目標），
才升級至**處置 X（補 reverse-NEE PDF 計算）**：
  reverse-NEE PDF = dist² / (cosThetaLight × A_class_A)
  源 = misBsdfBounceOrigin × 命中 Class A 段面積 × cosTheta / dist²
  套既有 R3-6 power-heuristic β=2 公式
此升級於 R5-4 fail 時另起 commit，不入 R5-2a 主體。
```

### 三項耦合性（缺一即破）

```
缺 1：shader 命中 panel 不分流，整個 panel 6 面齊發 emission，等效面積由 0.268 m² 暴增至
      8.77 m²（4.32 + 4.32 + 0.13）→ 過曝倍率 ~30×。
缺 2：舊 cloudIsEmissiveFace 殘留分支與新 Class A/B 衝突，shader 命中 panel 走兩套邏輯
      → undefined 行為（emission 殘餘累加或抵消）。
缺 3：舊 reverse-NEE PDF 仍依 4-rod 對角面（A_face × √2）計算，與新 1-panel CDF 量綱完全
      失配 → MIS 權重失衡 → 變異數爆炸（CONFIG 3 噪點反向上升）。
```

### 對稱性守則（V4-I3，memory `feedback_pathtracing_nee_pool_gate_symmetry.md`）

```
primary-hit panel 分支與 sampleStochasticLightDynamic 的 panel slot=7 分支必雙處同帶
uCloudLightEnabled gate；單側 gate 即 NEE pdf 不對稱，半截開關 bug。
v4 D2 路徑 A 不破壞此對稱：emission scope-lock 條文不引入方向依賴。
```

---

## R5-2b NEE 採樣切換為 Class A 面積加權 CDF（原子 commit）

### 動機

舊 `sampleStochasticLightDynamic` 對 4 個 rod 各自做立體角 jitter；R5 panel 為單一光源，需在 Class A 表面（top edge frame + 4 sides）採均勻 jitter 點，依面積加權選段。D3 已定 panel uniform emission，重要性採樣與表面均勻 jitter 完全等價。

### 5 段 CDF 預設

```
段 0：頂面外緣 16mm 框（4 條框併入 1 段，內含 4-邊均勻分配）→ A0 = 0.13338 m²
段 1：東側面（16mm × 2.4m）                                  → A1 = 0.0384 m²
段 2：西側面（16mm × 2.4m）                                  → A2 = 0.0384 m²
段 3：南側面（16mm × 1.8m）                                  → A3 = 0.0288 m²
段 4：北側面（16mm × 1.8m）                                  → A4 = 0.0288 m²
ΣA   = 0.26778 m²

CDF[i] = ΣA[0..i] / ΣA
JS 端 buildCloudPanelCDF() 計算後傳 uniform float uCloudPanelCDF[5]。
panel 尺寸或遮擋體內縮值改變時必觸發 buildCloudPanelCDF()（panel sceneBox.min/max 變動的 hook）。
```

### `sampleStochasticLightDynamic` 重寫骨架

```glsl
// R5-2b：panel CDF sampling（panel 為唯一 Cloud 光源，slot idx === 7）
float r = rand();
int seg;
for (seg = 0; seg < 5; seg++) {
    if (r < uCloudPanelCDF[seg]) break;
}

vec3 surfacePoint;
vec3 surfaceNormal;
if (seg == 0) {
    // 頂面外緣 16mm 框：4 邊各 1/4 機率（已併入段 0 ΣA）
    surfacePoint = sampleTopEdgeFrame(rand(), rand(), uCloudPanelMin, uCloudPanelMax);
    surfaceNormal = vec3(0.0, 1.0, 0.0);
} else if (seg == 1) { /* 東側 */ surfaceNormal = vec3( 1.0, 0.0, 0.0); ... }
  else if (seg == 2) { /* 西側 */ surfaceNormal = vec3(-1.0, 0.0, 0.0); ... }
  else if (seg == 3) { /* 南側 */ surfaceNormal = vec3( 0.0, 0.0, 1.0); ... }
  else                { /* 北側 */ surfaceNormal = vec3( 0.0, 0.0,-1.0); ... }

vec3 lightDir = normalize(surfacePoint - x);
float cosThetaLight = dot(surfaceNormal, -lightDir);
float dist2 = dot(surfacePoint - x, surfacePoint - x);
pdfNeeOmega = (cosThetaLight > 0.0)
    ? (dist2 / (cosThetaLight * 0.26778))
    : 0.0;  // back-face 反向取點視為 invalid sample
```

### LUT push 改寫（同 commit 強耦合）

```
**強耦合鎖定**：R5-2b commit 必同步改 js/Home_Studio.js:1470 之 LUT push 邏輯：

舊（4-rod LUT push）：
  if (cloudOn) {
      lut[count++] = 7; lut[count++] = 8; lut[count++] = 9; lut[count++] = 10;
  }

新（panel 唯一 slot push）：
  if (cloudOn) {
      lut[count++] = 7;
  }

**為何鎖在 R5-2b 而非 R5-2c**：R5-2b commit 後若 shader 端 sampleStochasticLightDynamic
已重寫但 JS 端仍 push 4 槽，shader 抽到 slot 8/9/10 會 fall-through 至「已移除 rod
死 idx」，bisect 中間態崩。R5-2c 之 NEE_SLOT_COUNT 11→8 為 macro 收尾動作，
LUT push 改寫之核心屬 R5-2b 主體。

**新增 throw-first 守門 (g)**（補入 R5-1 守門清單）：
  if (cloudOn) {
      console.assert(uActiveLightCount === 8,
          '[R5-2b] cloudOn=1 之 uActiveLightCount 必 === 8（panel 唯一 Cloud slot）');
  }
```

### V4-I3 對稱性 + Enabled gate

```
1. uCloudLightEnabled = 0：panel slot 不入 CDF（該幀 active pool size 從 8 退至 7，
   pickPdf 重算）；shader 端 sampleStochasticLightDynamic 進入前必檢查，
   否則 fall-through 到下一個 enabled slot。
2. uCloudLightEnabled = 1：panel slot=7 入 pool，CDF 依 5 段預設展開。
3. 雙處 gate 必鏡像：primary-hit 分支與 sampleStochasticLightDynamic panel slot 兩處
   同帶 uCloudLightEnabled，不可單側。
```

---

## R5-2c LUT 11→8 壓縮（原子 commit）

### 改動清單

```
1. NEE_SLOT_COUNT：11 → 8（shader macro + JS uniform 對齊）
   slot 0~6：保留現有對應（依 R3 既有 LUT mapping，不動）
   slot 7：Cloud panel（替換原 4 rod 之 slot 7~10）
   slots 8~10：移除（idx 範圍上限縮至 7）
2. lastNeePickedIdx 範圍守門（throw-first 守門 (f) 對應實作）：
   shaders/Home_Studio_Fragment.glsl:1165 / :1690
   原  if (lastNeePickedIdx >= 7 && lastNeePickedIdx <= 10)
   改  if (lastNeePickedIdx == 7)
3. uActiveLightCount 上限 11 → 8（JS 端 uniform 初值 + shader 端 0..7 範圍守門）。
4. cache-buster：?v=r5-lut
```

---

## R5-3 光度補償（Synthesis A）

### 兩個前置 commit（V4-I4 / 前置之前置）

```
R5-3-pre1（V4-I4 baseline）：clamp=50 firefly 基線統計
  - r3-light HEAD（不動 shader）僅加 firefly 計數器（luminance > 100 像素比）。
  - 跑 cam1~3 × CONFIG 1/2/3 = 9 組合 × spp 2048。
  - 寫實測數據至 .omc/R5-3-baseline-clamp50.md。
  - 用途：R5-3 完工後對照新基準是否退化（V4-I5 ±3% 規則之 baseline）。
  - read-only commit（只加觀察 code，不動視覺輸出）。

R5-3-pre2：clamp 50 → 100 commit
  - js/Home_Studio.js:1228 uEmissiveClamp 50.0 → 100.0。
  - 加 observability：TRACK / WIDE / Cloud panel 三組 emission 峰值 console.log。
  - 跑 cam2 × CONFIG 1 spp 2048 確認 firefly 比是否異常上升（與 pre1 baseline 對照）。
  - 通過後才進 R5-3 主 commit。
  - 失敗：clamp 100 反而讓 firefly 暴增 → 退回 50，質疑上游量綱（不調 clamp 蓋過根因）。
```

### Synthesis A 公式（k_compensate 移除）

```
Φ_UI_density   = UI 滑桿值（lm/m）            # 預設 1600（R4-4 fix03 校準值）
L_rod_avg      = (2.4 + 2.4 + 1.768 + 1.768) / 4 = 2.084 m
N_rod          = 4

Φ_UI_equiv     = Φ_UI_density × L_rod_avg × N_rod
               # ≈ 1600 × 2.084 × 4 ≈ 13,338 lm（HANDOVER L182 對齊）
               # 此值不顯示於 UI，純背後變數

A_class_A      = A_top_edge + A_side_total
A_top_edge     = 1.8 × 2.4 - 1.768 × 2.368 = 4.32 - 4.18662 = 0.13338 m²
A_side_total   = 2 × (0.016 × 2.4) + 2 × (0.016 × 1.8) = 0.0768 + 0.0576 = 0.1344 m²
A_class_A      = 0.13338 + 0.1344 = 0.26778 m²

L_panel        = Φ_UI_equiv / (K(T) × π × A_class_A)
               # K = kelvinToLuminousEfficacy()（R4-4 fix02 量綱基準）
               # /π 為 Φ→L Lambertian 分攤
               # cd 路徑禁加 /π（memory feedback_pathtracing_cd_path_no_pi.md，R4-4 fix02 校正過）

# 4000K 數值範例：K(4000) ≈ 320 lm/W
L_panel(4000K) ≈ 13338 / (320 × π × 0.26778) ≈ 49.6 W/(sr·m²)
# 與 HANDOVER 56.6 W/(sr·m²) 之差為 K(T) 取值差，R5-3 commit 前以 R4-4 fix02 函式實算定值。

k_compensate REMOVED（=1.0 identity）
```

### 為什麼移除 k_compensate

- v0 大綱有 `k_compensate = A_total / A_eff > 1` 之補償係數，補償「panel 6 面總面積但部分被吸收」之差距。
- v4 路徑 A 把 Class B 直接設 emission=0，**Class A 才算入分母 A_class_A**。Φ 直接由 Class A 射出，無需再外加補償。
- 此設計避免 v0 雙重補償邏輯滑移風險（Critic round 1 NEW-2：emission 實際值與 UI 標稱不對齊，debug 時難偵測補償係數源頭）。

### 量綱守則（Architect inline 條件）

```
1. Φ 路徑：Φ → L 必 /π（Lambertian 分攤；本階段 R5-3 panel 採用）。
2. cd 路徑：cd → L 不可 /π（cd 已含立體角強度，memory cd_no_pi）。
3. R4-4 fix02 商品規格 cd 路徑為 trackLampCandela()，本階段不動。
4. R5-3 panel 走 Φ 路徑，與 R4-4 cd 路徑同檔分立函式（computeCloudPanelRadiance vs trackLampCandela）。
5. K(T) 走 kelvinToLuminousEfficacy() 統一函式，R5 不另立。
```

---

## R5-4 收斂驗證

### Multi-cam × CONFIG sweep（9 組合）

```
cam1 / cam2 / cam3 × CONFIG 1 / 2 / 3 共 9 組合。
每組執行：
  1. r3-light HEAD（baseline）跑至 RMSE = 1.0% → 紀錄 SPP_R3。
  2. R5-2c HEAD（target）跑至 RMSE = 1.0% → 紀錄 SPP_R5。
  3. ratio = SPP_R3 / SPP_R5。
  4. PASS 條件：ratio ≥ 3.0
     - CONFIG 3 預期 ≥ 4×（pool 4→1，MC variance ∝ pool size）。
     - CONFIG 1/2 預期 ≥ 3.0（Cloud 開啟時 pool 縮減仍見效益）。
```

### V4-I5 ±3% 平均規則（強制）

收斂驗證之亮度差判定使用以下任一：

```
A 模式：同 seed × ≥3 frame average，frame 之間 RGB 各通道平均後比對。
B 模式：double-SPP 對照（spp_test = 2 × spp_baseline，雜訊比例 √2 縮）。
單 frame 點對點比對因雜訊放大而禁用。
```

### Firefly 計數器（R5-3-pre1 baseline 對照）

```
luminance > 100（uEmissiveClamp 上限）之像素比例：
  PASS：R5-2c HEAD 比 R5-3-pre1 baseline 不上升 +0.5% 以上。
  FAIL：上升 >1% → 回退 R5-3 重審 L_panel 公式（不調 clamp 蓋過）。
```

---

## R5-5 主觀亮度同框比對（GO/NO-GO Gate）

```
1. 使用者並排 r3-light HEAD vs R5-2c HEAD 截圖
   （cam2 / CONFIG 1 / 4000K / 1600 lm/m / spp 2048）。
2. 使用者主觀判定：肉眼一致 / 偏暗 / 偏亮 / 色比偏移。
3. GO：合回 r3-light（branch merge），R5 全結。
4. NO-GO：依差異方向分類處置：
   - 偏暗 ≤10%：R5-3 L_panel 微調（10% 內 emission 修正，新 commit 不退階段）。
   - 偏亮 >10%：fallback Option D（R5-X 觸發，見下段）。
   - 色比偏移 >5%：回退至 R5-2a 重審 K(T) 取值（kelvinToLuminousEfficacy 數值）。
```

---

## Pre-mortem 6 情境

### S1 Class A 覆蓋率異常（R5-0 PASS 後仍出問題）

```
觸發：R5-0 量測 PASS（≥95%），但 R5-4 仍見 Class B 命中亮塊或 panel 命中黑像素。
症狀：panel 中央區（Class B）出現未預期 emission spot；或 Class A 區出現黑點。
根因候選：hitPoint vs uCloudPanelMin/Max 邊界判定精度（vec 規範化）；occluder 與 panel
        頂面 +1mm 間隙之 t 排序歧義。
緩解：先試 CDF 8 段（top-edge 拆 4 + 4 sides）壓變異數；若仍 fail 進 R5-X。
```

### S2 PDF 對稱性破裂

```
觸發：sampleStochasticLightDynamic 與 primary hit pdfNeeOmega 計算不對稱。
症狀：uCloudLightEnabled 開關呈半截行為（勾選後變更微弱 / 反向）。
緩解：memory feedback_pathtracing_nee_pool_gate_symmetry.md 對照修，雙處 gate 必鏡像。
```

### S3 索引位移污染

```
觸發：sceneBoxes 75+ 區間有未發現 box，4 rod 移除後位移破 throw-first 守門。
症狀：browser console throw '[R5-1] CLOUD_BOX_IDX_BASE drift' 或 '[R5-1] panel fg ≠ 4'。
緩解：grep js/Home_Studio.js sceneBoxes.length 對應，發現後補 throw-first；
     恢復前不繼續任何 R5-1 後續改動。
```

### S4 量綱失配（PREREQUISITE，非 Open Question）

```
觸發：L_panel 走 cd 路徑（誤加 /π），或 K(T) 走 R4-4 之外的函式。
症狀：亮度與 lumens 解耦、色溫漂移、A/B 模式視覺差異崩潰。
緩解（具體 grep 清單，commit 前必逐條過）：
  1. memory feedback_pathtracing_radiance_unit_mismatch.md 對照量綱規則。
  2. grep '/π' shaders/Home_Studio_Fragment.glsl | grep -v 'Lambertian\|computeCloudPanelRadiance'
     → 應 0 hit（cd 路徑禁加 /π，僅 Lambertian Φ→L 路徑與 panel 路徑可有 /π）。
  3. grep -n trackLampCandela shaders/ → 不得出現於 panel emission 計算路徑
     （trackLampCandela 為 cd 路徑專屬；panel 走 Φ 路徑分立）。
  4. computeCloudPanelRadiance 與 trackLampCandela 必為獨立函式（同檔分立位置；
     R5-3 commit 之 grep 結果同檔不同 function block）。
本情境屬 PREREQUISITE：commit 前必 grep + 函式分立，否則 commit reject。
```

### S5 firefly 高峰

```
觸發：clamp=100 仍不足壓住 panel emission peak。
症狀：CONFIG 3 高 spp（>2000）仍見白點亮斑。
緩解（V4 統一 mitigation）：先試 CDF 8 段壓變異數；仍 fail 才考慮 clamp 上調至 200（最後手段）。
嚴禁：直接調 clamp 數值蓋過量綱問題（memory feedback_pathtracing_clamp_bandaid_masks_root_cause.md）。
```

### S6 Class B 前置驗證假陽（V4 統一）

```
觸發：R5-0 PASS 後 R5-4 仍見 Class B 命中亮塊。
症狀：panel 中央區（Class B）出現 emission spot，違反 emission=0 條文。
緩解（V4 統一 mitigation）：先試 CDF 8 段；再驗 hitNormal 計算精度；仍 fail 進 R5-X。
```

---

## 測試計畫 4 層

### Unit 測試（tests/r5/cloudFlux.test.js）

```
1. L_panel = Φ/(K·π·A_class_A) 數值對齊（4000K / 1600 lm/m / 0.26778 m²）。
2. CDF 累積至 1.0（浮點誤差 <1e-6）。
3. face-id 雙源契約：CLOUD_BOX_IDX_BASE+1 === uCloudObjIdBase。
4. Class A/B 邊界判定（測試點：頂面中央 / 頂面外緣 / 4 側面 / 底面）。
5. A_class_A = A_top_edge + A_side_total 等式（手算對照 ≈ 0.26778）。
```

### Integration 測試（tests/r5/integration.test.js）

```
1. r3-light HEAD 與 R5-2c HEAD 同 cam2 × CONFIG 1 SPP=512 RGB diff <3%（V4-I5 規則）。
2. panel + occluder 組合 sceneBoxes.length 對齊（CLOUD_OCCLUDER_IDX = CLOUD_BOX_IDX_BASE + 1）。
3. uCloudLightEnabled = 0 時 panel + occluder 同步隱藏（fixtureGroup=4 守門）。
```

### Observability 層

```
1. console.log 標籤：
   [R5-3-emit]    panel L=??? W/(sr·m²)，每次 K(T) / Φ 變動時觸發。
   [R5-3-firefly] count=???，每幀統計 luminance>100 像素數。
   [R5-2b-cdf]    seg-hit distribution，dev mode（uDevAssert=1）每 100 幀印 1 次。
2. PDF 對稱 assert（dev mode，依處置選擇切換）：
   - 處置 Y（v5 預設）：negative assert——`grep -nE 'reverseNeePdf|pNeeReverse|misPBsdfBounce' shaders/Home_Studio_Fragment.glsl` 應 0 hit（reverse-PDF 計算路徑已於 R5-2a 物理刪除，dev mode 啟動時驗證殘餘）。
   - 處置 X（R5-4 ratio<3.0 升級才啟用）：sampleStochasticLightDynamic forward PDF 與升級 commit 新增之 reverse-PDF 計算 cross-check（forward = `dist²/(cosThetaLight × A_class_A)` 對齊 reverse 同公式邊際等價）。
3. CDF 段命中分布（dev mode）：5 段命中比例應接近 A_seg / ΣA。
```

### E2E 層

```
1. 9 組合 multi-cam × CONFIG sweep（R5-4 全套）。
2. 主觀截圖比對（R5-5 GO/NO-GO gate）。
3. 全 R5 chain commit 後跑 npm test 全套（既有 + 新增 r5/）。
```

---

## 驗證腳本（commit 前 / 後執行命令）

```bash
# (a) BSDF-indirect leftover grep（R5-1 commit 前必過，0 hit 才能 commit）
grep -rnE 'uCloudRod|uCloudFaceArea|cloudIsEmissiveFace|cloudIsOuterLong|k_compensate' \
  shaders/ js/

# (b) 索引守門驗證（R5-1 後）
open "http://localhost:9001/Home_Studio.html?v=r5-geom"
# console 應無 throw 訊息；若見 [R5-1] 開頭 throw 即停手，回頭 grep 對照位移範圍。

# (c) firefly 統計對照（R5-3-pre1 baseline 與 R5-2c HEAD）
node tests/r5/firefly-stats.js \
  --baseline .omc/R5-3-baseline-clamp50.md \
  --target   .omc/R5-2c-firefly.md

# (d) face-id 雙源契約檢查（commit 前）
node tests/r5/face-id-contract.js js/Home_Studio.js

# (e) BSDF-indirect leftover 二次檢查（R5-2c 完工後）
grep -rnE 'cloudIsEmissiveFace|cloudIsOuterLong' shaders/ js/

# (f) panel CDF 累積值檢查（R5-2b 完工後）
node tests/r5/cloud-panel-cdf.js
```

---

## ADR（決策紀錄）

```
Decision：採 Synthesis A（panel 單一 sceneBox + Class A/B emission split + 1mm 遮擋體）

Drivers：
  D1 採樣池 4→1 為 R5 核心目標（CONFIG 3 收斂加速 ≥3×）
  D2 物理等效 Φ 對齊舊 4-rod（13,338 lm，HANDOVER 對齊）
  D3 UI 介面層完全凍結（R4-3 之 lm/m 滑桿 / 色溫 / A/B / CONFIG 不動）
  D4 路徑 A scope-locked split 規避 v0 k_compensate 雙重補償邏輯滑移風險

Alternatives Considered：
  Option A 採用：Synthesis A panel + occluder + Class A/B（v4 路徑 A）
  Option B 否決：v0 k_compensate 補償公式（雙重作用導致 emission 偏差難偵測，Critic NEW-2）
  Option C 否決：Antithesis 1 路徑 B 拆 box + NEE 採樣聚合（違反採樣池=1 鐵則，
                sceneBoxes 多 5 entry、BVH 葉節點增加；使用者 2026-04-25 明定否決）
  Option D 列入 R5-X fallback：stratified jitter 4-rod（R5 全失敗時回到 R3-5b 4-rod 機制）

Why Chosen：
  Synthesis A 同時滿足採樣池=1 + Φ 等效 + UI 凍結 + 量綱乾淨；Class A/B emission split
  為 D2 路徑 A 之 scope-locked 實作（V4-I1）。

Consequences：
  + Cloud 採樣池 4→1，CONFIG 3 SPP 收斂預期加速 ≥3×。
  + sceneBoxes 4 rod → 2 box（panel + occluder）。
  + 4 元素陣列 uniform（uCloudFaceArea / uCloudRodCenter / uCloudRodHalfExtent）整組移除。
  + LUT 11→8 壓縮，shader pool 採樣 if-else 分支減 3。
  - D2 條文由「禁面閘門」放寬至「Class A/B emission scope-locked split」（v4 新狀態）。
  - 後續 R6+ 若新增更多光源，Class A/B 機制可參照但嚴禁擴張至 albedo/roughness/metalness。

Follow-ups：
  F1 R5-X stratified jitter 4-rod fallback（觸發條件見下段）。
  F2 uEmissiveClamp 50→100 之長期影響評估（追蹤 firefly 比 R5 完工後 1 週）。
  F3 R5 完工合回 r3-light 後評估 F6 A/B 模式去留（HANDOVER L225 結轉項）。
```

---

## R5-X 緊急 fallback（Option D 觸發條件）

### 觸發條件

```
任一觸發 → R5-X：
  1. R5-0 Class A 覆蓋率 <95%（結構性無效，Synthesis A 不可達）
  2. R5-2b NEE PDF 對稱性反覆 fail（半日內無解）
  3. R5-3 firefly 比上升 >1% 且 clamp 200 仍無解
  4. R5-5 使用者主觀判定偏亮 >10%
  5. CDF 5 段 → 8 段升級後仍見 S1/S5/S6 症狀
```

### 啟動流程（V4-I3 / NEW-3 條件式回退決策樹）

```
分支策略決策樹（NEW-3 sub-branch vs git revert）：

  partial-pass corner case（部分 cam/CONFIG 通過，部分 fail）：
    → sub-branch experiment/r5-x-partial 於 R5-2c HEAD 開
    → R5-X stratified jitter 4-rod 機制在分支內試
    → 通過則 cherry-pick 修補 patch 至 r3-light（不全 revert R5）

  total failure（全 cam × CONFIG 皆 fail）：
    → git revert R5-1 ~ R5-3 commit 序列（順序倒序）
    → r3-light 回到 R4-5 終點（commit d407353）
    → HANDOVER-R5 補完工紀錄為「已驗證不採用 Synthesis A，回退 4-rod」
    → R5-X 立 SOP 重新 ralplan（Option D stratified 4-rod 為主軸）

啟動執行紀律：
  - sub-branch 路徑：禁直接動 r3-light，所有試驗於 experiment/r5-x-partial 內進行
  - revert 路徑：必使用者授權後執行（自動 revert 嚴禁）
  - 任一路徑：先執行 git stash + git status 確認工作樹乾淨，再動 commit 序列
```

---

## 完工紀錄佔位（R5 全結後填入）

```
R5-0 ⬜ / R5-1 ⬜ / R5-2a ⬜ / R5-2b ⬜ / R5-2c ⬜ / R5-3-pre1 ⬜ / R5-3-pre2 ⬜ /
R5-3 ⬜ / R5-4 ⬜ / R5-5 ⬜
合回 r3-light commit hash：____
F2 uEmissiveClamp 100 firefly 追蹤（1 週後）：____
F3 A/B 模式去留評估狀態：____
```

---

## OMC 工具路徑

```
1. 計畫階段：/oh-my-claudecode:ralplan（v4 進場後執行；Architect 與 Critic 將以本檔
   file:line 為證據迭代，預期 1~2 輪 APPROVE）
2. 執行階段：/oh-my-claudecode:ultrawork（APPROVE 後使用者啟動）
3. 失敗回退：R5-X 啟動分支策略決策樹（partial sub-branch vs total revert）
```

## ultrawork 執行紀律（R5 階段專用）

```
嚴禁（任何情況，違者即停手回報使用者）：
  - 拆 panel 為複合 sceneBox（NEW-1 違反採樣池=1 鐵則）
  - Class A/B 切分擴張至 albedo / roughness / metalness（V4-I1 scope-lock 違反）
  - 啟用 fixtureGroup=5+（V4-I6 R5 階段嚴禁）
  - 直接調 uEmissiveClamp 數值蓋過量綱問題（memory clamp_bandaid 違反）
  - 自動執行 git revert 系列（R5-X total failure 路徑必使用者授權）
  - 動 R3 / R4 git 歷史與 R3 文件
  - 動 Obsidian LLM Wiki 任何檔案
  - 拆 R5-2a 三項耦合改動為多 commit（同一 commit 鎖死）

失敗停手觸發點（停手、回報、由使用者決定下一步）：
  - shader compile error >3 次
  - grep 發現實際行號與 SOP 不一致（shader 檔案偏移）→ 先 re-grep 確認、不盲改
  - 任何 throw-first 守門 (a)~(f) 觸發
  - face-id 雙源契約 grep 抓到 drift
  - R5-3-pre2 firefly 反向上升 → 不繼續、回報

正常回報節點：
  - R5-0 統計完成 → 9 組合 Class A 比例回報
  - R5-1 commit 完成 → commit hash + sceneBoxes.length 變化
  - R5-2a/b/c 各 commit 完成 → commit hash + grep leftover 結果
  - R5-3-pre1/pre2 完成 → firefly baseline 數據回報
  - R5-3 完成 → L_panel 實算值（4000K / 1600 lm/m）回報
  - R5-4 sweep 完成 → 9 組合 SPP 比 ratio 表回報
  - R5-5 截圖準備好 → 通知使用者進主觀比對
```
