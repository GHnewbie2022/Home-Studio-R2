# R3-3 Cloud 漫射燈條真光源接入（3-face NEE）

## Meta
- **分支**：`r3-light`（R3 全階段同分支，不開子分支）
- **前置 commit**：`0b38c3d R3-2 DONE`（PCHIP kelvinToRGB + preset UI 已上線）
- **cache-buster**：`r3-3-cloud-real-light`
- **SOP 依據**：`docs/SOP/R3：燈光系統.md` L271-327
- **共識紀錄**：Planner×3 / Architect×3 / Critic×3，iter3 雙 APPROVE

## Principles（P1–P4）
- **P1 物理正解優先**：Lambertian 漫射發光面 radiance = Φ/(π·A)，單位 W/(sr·m²)，嚴禁為了好看砍能量
- **P2 最小介面變動**：R3-3 只加 uniform 不改 MIS / BVH / SDF；MIS/Many-Light 留給 R3-5
- **P3 MIS 介面前置**：先把 `uCloudObjIdBase` + `uCloudFaceArea[4]` 埋好，R3-5 直接接管不重寫 wiring
- **P4 K(T) LUT 全程**：亮度轉換用 `kelvinToLuminousEfficacy(T)` LUT（4000K→320 lm/W），禁止硬寫 320 / 683 / 555nm 峰值常數

## Decision Drivers（D1–D3）
- **D1 能量守恆可驗證**：總輸出光通量 = 4000 lm ± 5%，由 unit test 覆蓋
- **D2 firefly 可量化**：curtain-center ROI median×30 為 clamp，AC 閾值 median×50（gap 40%）
- **D3 objectId 雙層一致**：JS boxIdx (55-58) / shader id (objectCount+56..+59) 雙向 assert，編譯期/runtime 各一

## Viable Options

### Fork A'（採納）— Per-face Lambertian emitter + JS helper + LUT 全程
- 4 rod × 3 face = 12 個 emissive 面；每面獨立 radiance；shader 用 `hitObjectID - uCloudObjIdBase` 查 face 索引
- JS 新增 `computeCloudRadiance(lm_total, T_K, faceArea)` 純函式，回傳 RGB radiance
- `uCloudFaceArea[4]` 傳 E/W/N/S rod 的單面面積（3 面同面積假設：頂面≈側面）
- **Why chosen**：物理正確（Φ/(π·A) 標準式）、能量守恆可單元測試、objectId 映射簡潔

### Fork A（fallback，不自動降級）— Per-rod 整體發光
- 整條 rod 視為單一 emitter，任一面打到都回傳 rod radiance
- 不採納原因：會 3× 過曝（3 面各自回傳整條通量 → 總能量 3×），違反 SOP L298

### Fork B（延後到 R3-5）— Area-light explicit sampling
- 直接接 MIS，跳過 emissive material path
- 延後原因：R3-5 要做 MIS 重寫，現在做會改兩次

### Option C（不採納）— 砍掉 3-face 只做 +Y 頂面
- 違反 SOP L285-323 明示 3-face 規格，會導致側牆與地面暗

## Stories

### S1：JS helper + uniforms wiring + boxIdx assertion
**檔案**：`js/Home_Studio.js`
- 新增 `computeCloudRadiance(lm_total, T_K, faceArea)` 純函式，公式 `(lm_total/3) / (K(T) × π × faceArea)`
- 新增 `const CLOUD_BOX_IDX_BASE = 55`
- 新增 assertion：第一條 Cloud box 的實際 boxIdx === 55（若 R3-3 前有人插別的 box，立即失敗）
- `pathTracingUniforms.uCloudObjIdBase = { value: <objectCount + 56 at init> }`
- `pathTracingUniforms.uCloudFaceArea = { value: [E面積, W面積, N面積, S面積] }`（E/W = 0.0384, N/S = 0.02829）
- `computeLightEmissions()` 改為填 4 個 Cloud rod 的 RGB radiance 到 `uCloudEmission[0..3]`，用 `cloudColorMode` → K(T) → computeCloudRadiance
- **Acceptance**：
  - JS console 無 assertion 失敗
  - `uCloudEmission` 值在 cloudColorMode 切換時即時更新
  - `uCloudObjIdBase.value` 等於 shader 端預期的 `objectCount+56`

### S2：Unit test（5 斷言）
**檔案**：`docs/tests/r3-3-cloud-radiance.test.js`（新建）
- [A] `kelvinToLuminousEfficacy(4000)` 回傳 320 ± 2（LUT 不漂移）
- [B] `computeCloudRadiance(1152, 4000, 0.0384)` 計算值符合 `1152/3/(320×π×0.0384)` ≈ 9.95 W/(sr·m²)
- [C] 能量守恆：4 rod × 3 face × A × π × radiance 總和 ≈ 4000 lm × K(4000) （±5%）
- [D] 5600K 內插合理：介於 4000K 與 6500K 值之間且單調
- [E] `uCloudObjIdBase` 計算式 `objectCount + 56` 在 N=60 情境下等於 116
- **Acceptance**：`node docs/tests/r3-3-cloud-radiance.test.js` 退出碼 0，印 `=== 結果：PASS ===`

### S3a：Shader 改動 gate=0 ULP byte-identical
**檔案**：`shaders/Home_Studio_Fragment.glsl`
- 新增 `uniform float uCloudFaceArea[4];`
- 新增 `uniform float uCloudObjIdBase;`
- 改寫 `if (hitType == CLOUD_LIGHT)` 分支為 emissive return（乘以 `uR3EmissionGate`）
- r3Sink 保留 `uCloudEmission` 加總確保 DCE-proof
- **gate=0 測試**：`uR3EmissionGate = 0`，同 seed 同相機下 PNG diff 與 R3-2 byte-identical（ULP == 0）
- **Acceptance**：
  - shader 編譯成功（console 無 `WebGL: INVALID_VALUE`）
  - gate=0 時與 R3-2 b05e534 cam0/cam1 PNG SHA256 一致

### S3b：Flip uR3EmissionGate=1 + luminance ratio AC
**檔案**：`js/Home_Studio.js` L928 gate 初值改 1.0
- **Acceptance**：
  - 啟動後 console 印 `[R3-3] uCloudEmission = [...]` 4 組 RGB 值非零
  - curtain-center 32×32 ROI 平均 luminance，cloudColorMode=自然 開啟後 / R3-2 關閉時的比值 ∈ [2.8, 3.5]（若 <2.8 能量太低，>3.5 過曝）

### S4：uEmissiveClamp 校準
**檔案**：`js/Home_Studio.js`
- `uEmissiveClamp.value = <curtain-center median luminance> × 30`
- median 量測方式：gate=1、自然、Cam 0、500 spp、32×32 ROI
- **Acceptance**：
  - clamp 值寫死在 js 內（有 `// R3-3 clamp: median×30` 註記）
  - ROI max/median < 50（AC 閾值；clamp 比它嚴 40%）

### S5：Observability console log
- `computeLightEmissions()` 結尾 `console.log('[R3-3]', { mode, T_K, rodRadiance, faceArea, objIdBase })`
- 便於肉眼調試與未來 R3-5 MIS 接手
- **Acceptance**：切換 dropdown 時 console 有對應輸出

## Pre-mortem（9 情境）
1. **objectId off-by-one** → S1 assertion + S2 [E] 雙重守
2. **3-face 過曝 3×** → S2 [C] 能量守恆 test
3. **K(T) LUT 錯用 683** → S2 [A] 鎖死 320 常數
4. **clamp 太嚴壓扁高光** → median×30（比 AC×50 寬 40%，有緩衝）
5. **gate=0 regression 破 R3-2** → S3a ULP byte-identical gate
6. **uCloudEmission 陣列 DCE** → r3Sink 保留
7. **shader uniform 未宣告** → S3a 編譯驗證
8. **5600K 未知點** → S2 [D] 內插單調 test
9. **R3-5 MIS 重寫** → P3 介面前置（uCloudObjIdBase/uCloudFaceArea 已備好）

## 4-tier Test Plan
- **Unit**：`docs/tests/r3-3-cloud-radiance.test.js`（5 斷言）
- **Integration**：gate=0 ULP byte-identical + gate=1 luminance ratio
- **E2E**：cam0/cam1 各 cloudColorMode={暖,自然,冷} 截圖歸檔至 `docs/verification/R3-3/`
- **Observability**：S5 console log

## ADR

### Decision
採 Fork A'：per-face Lambertian emitter + JS helper + K(T) LUT 全程。

### Drivers
D1 能量守恆可驗證、D2 firefly 可量化、D3 objectId 雙層一致。

### Alternatives considered
- Fork A per-rod：3× 過曝，違反 SOP L298
- Fork B area-light MIS：與 R3-5 重疊重寫
- Option C 單面：違反 SOP 3-face 規格

### Why chosen
Fork A' 以最小 shader 介面變動達成物理正解，且 uniform 設計對 R3-5 MIS 友善（uCloudObjIdBase + uCloudFaceArea 可直接重用）。

### Consequences
- 正面：能量守恆、單元測試覆蓋、R3-5 可直接接管
- 負面：多出 1 個 JS helper 函式、2 個 shader uniform
- 中性：shader 邏輯從 DIFF-like 改為 emissive-with-gate

### Follow-ups
- R3-4：Track spot cone 參照此模式
- R3-5：接 MIS 時用 uCloudObjIdBase + uCloudFaceArea 做 area sampling

### Open Questions
- **Q1（未校準）**：curtain-center luminance 絕對值需等 R3-3 S4 肉眼驗證後才能鎖 clamp 常數
- **Q2（內插）**：5600K 在 LUT 上用線性或 PCHIP？S2 [D] 先驗單調，R3-6 再決定是否升級

## DONE-gated（不在 ralph 範圍）
- SOP R3 雙處打勾（outline + ### 小標）
- SOP 備註補 R3-3 歷程
- memory handover 更新
- git push origin r3-light
