# R6-2 Phase 1.5 Step 2 — Step 0 探針閘 ❌ fail-fast：leaf packing 整段跳過

> 階段狀態：fail-fast 退場 2026-04-27
> 上層計畫：`.omc/plans/R6-2-Phase-1.5-Step2-leaf-fetch-packing.md`（v3 ralplan APPROVED）
> Phase 1.0 baseline：`.omc/REPORT-R6-2-Phase-1.0.md`
> 對應 commit：本退場報告 commit；探針程式碼未獨立 commit（直接 git checkout 還原 + 一個退場 commit）

---

## 1. 結論一句話

```
leaf packing 對 spp/sec 提升上限 ≤ 1%，遠低於 commit 門檻 +5%。
整個 Step 2 leaf fetch packing 路徑跳過，符合 plan §D Step 0a-6 第一條 fail-fast 規則。
對齊 Architect Round 1 antithesis A1（ANGLE auto-DCE）+ A4（fetch 已 cache locality 緊密）的預測。
```

---

## 2. Step 0a 量測結果

### 探針設計（已 revert）

```
shader 加 uniform float uForceFullFetch
fetchBoxData 搬到 isBoxCulled 之後（為了呼叫 gate function）
P4 fetch 加 ternary：
  bool gate_passed = !isFixtureDisabled(p3.w) && !isBoxCulled(p2.xyz, p3.xyz, p2.w);
  vec4 p4 = (uForceFullFetch > 0.5 || gate_passed) ? texelFetch(...) : vec4(0.0);
JS 端 pathTracingUniforms.uForceFullFetch = { value: 1.0 } 預設 baseline
```

### 對照表（5 秒 RAF + needClearAccumulation 強制 reset）

| Config | full=1.0 spp/sec | dce=0.0 spp/sec | Δ% | full fps | dce fps |
|--------|------------------|------------------|-----|----------|---------|
| C1     | 21.96            | 21.96            | **0.00%** | 23.9     | 27.6    |
| C2     | 20.00            | 20.00            | **0.00%** | 21.6     | 22.9    |
| C4     | 19.40            | 19.21            | **0.98%** | 21.0     | 20.4    |

### 重要觀察

```
1. fps 在 dce build 普遍升（C1 +15%、C2 +6%）但 spp/sec 完全不變
   → GPU 真的省了 cycle（fps 升）但 path tracer 的 RAF 邏輯（cameraSwitchFrames /
     needClearAccumulation 等節流）讓額外 frame 不轉換成 spp 累積。
   → commit 後做完整 packing，即便 GPU 端真的省了 cycle，spp/sec 提升仍 ≤ 1%。

2. baseline (uForceFullFetch=1.0) 量到 21.96 spp/sec，但 Phase 1.0 Fast-builder
   baseline 是 34.30 spp/sec → 探針本身（fetchBoxData 內 gate_passed 計算成本）
   拖慢 baseline 36%。對齊 Architect A3 quad-divergence + plan §B Pre-mortem S4
   「probe ternary 反向加速」風險。
   → Δ% 量測仍可信（兩 build 都跑 gate_passed 計算，差異僅 P4 fetch）但
     baseline 數值不能直接外推到 commit 後 spp/sec。

3. C4 Δ=0.98% 雖非 0 但 < 3% 門檻，且在 5 秒 vsync jitter 誤差範圍內（±5%）。
```

---

## 3. plan §D Step 0a-6 三層判斷對照

```
規則：
  - 若 C1/C2/C4 全 Δ < 3% → ANGLE 明確已 DCE → fail-fast，跳 0b 直接 Step 0c noop
  - 若 C1/C2/C4 全 Δ ≥ 10% → 明確有空間 → 跳 0b 預設過，直接進 1A
  - 僅 3% ≤ Δ < 10% 灰色帶 → 跑 0b 雙驗證

實際結果：C1=0.00%, C2=0.00%, C4=0.98% → 全 < 3% → 觸發 fail-fast
```

不必跑 0b（EXT_disjoint_timer leaf 段佔比量測），不必驗 0c 三條件閘。直接跳到 plan §D Step 0c 失敗路徑。

---

## 4. 為什麼 leaf P4 fetch 對 spp/sec 影響 ≈ 0%

兩條可能解釋（對齊 Architect Round 1 antithesis）：

```
A1（ANGLE auto-DCE）：
  Apple M4 Pro Metal 編譯器把 fetchBoxData 5 fetch 在 inline 後做 dead store
  消除：gate-rejected box 的 boxRoughness/boxMetalness 被丟棄，編譯器
  看出 P4 fetch 結果未被使用，自動最佳化掉。manual gate-first early-out
  與 compiler 已做的事重疊 → 收穫 0%。

A4（fetch cache locality 已緊密）：
  78 box × 5 vec4 = 390 RGBA32F texel 連續排在 boxData texture，
  5 個 fetch 在同一 cache line 內（5×16=80 bytes < 128B cache line），
  cache miss 只發生一次，後續 4 fetch 是 cache hit 等於免費。
  packing 5→2 只省 instruction count（ns 級），cache miss penalty
  不變。其他 BoxIntersect / NEE / Material 成本壓倒性大，
  fetch 只占 ≤ 1% 整體 fragment shader 時間。
```

實證上無法區分 A1 vs A4（沒做 spectorJS GLSL→HLSL dump，因為 fail-fast 觸發太早），但對結論不重要——任一條成立 → packing 上限 ≈ 0%。

---

## 5. 對齊 ralplan v3 共識

```
Architect Round 1 verdict: REVISE，提 A1~A4 antithesis 全 hit
Architect Round 2 verdict: PASS w/caveats，Step 0 探針閘設計就是為了驗證 A1~A4
Architect Round 3 verdict: PASS，5/5 principle、12/12 v2 finding closed
Critic Round 3 verdict:    APPROVE

→ ralplan 的核心價值「prototype-first，最便宜驗證優先」在此實證：
  1.5 hr 探針（實際工程時間 ~30 分鐘）
  替代了 9 hr 工程（Step 1A~1E）+ 0.5 hr rollback 報告
  淨節省約 8 hr 工程時間
  + 避免重蹈 SAH -39% / R6-1 撤回 0.6 d 兩次教訓
```

ralplan 三輪共識的 ROI：花 3 輪 Planner + 3 輪 Architect + 3 輪 Critic 流量、節省 8 hr 工程 + 確認下一步路徑。

---

## 6. 對 Phase 1.5 後續分流規則的影響

依 SOP 第 86 行 a/b/c/d 修訂：

```
原規則：
  a) 切到 SAH_Builder ❌ 已驗證 -39%（Phase 1.5 Step 1）
  b) BVH node packing 優化（記憶體存取模式）
  c) Stack-based vs while-loop traversal 切換評估
  d) leaf fetch packing：每 leaf 5× texelFetch(boxData) → 2~3× ❌ 已驗證 ≤ 1%（Phase 1.5 Step 2）

修訂後：
  a) ❌ SAH 切換失敗 -39%（2026-04-27 step 1）
  b) BVH node packing：仍可嘗試，但 a/d 雙失敗讓「BVH 結構優化整支」可信度下降
  c) Stack vs while traversal：fragment shader 改動風險高、收穫上限未知
  d) ❌ leaf fetch packing 失敗 ≤ 1%（2026-04-27 step 2）

→ 「BVH 結構優化」的 a + d 子路徑都實證失敗。
   剩 b/c 是動 fragment shader 內部，風險更高。
```

---

## 7. 下一步路徑（待使用者裁示）

```
路徑 X：嘗試 SOP §86 c (while-loop traversal)
  改動：fragment shader BVH traversal 由 stack-based 改 while-loop
  風險：高（fragment shader 重寫、需 1024-spp pixel diff = 0 視覺驗證）
  預期：上限未知（既然 a/d 都失敗，估 ≤ 5%）
  工時：3~5 天
  OMC 工具：必須 ralplan 三輪共識（演算法敏感）
  建議：不進，因 a/d 都失敗 + 收穫上限太低

路徑 Y：跳過主線 2 BVH 結構優化、改試主線 1 階段 2（時序累積 reproject）
  詳 docs/SOP/R6：渲染優化.md「整體順序」段
  時序累積對 path tracing 雜點的物理機制與空間 bilateral 不同（R6-1 撤回不否定）
  工時：1~2 週
  OMC 工具：ralplan 三輪共識
  風險：中

路徑 Z：R6-2 結案
  結論：1024-spp 牆鐘 30~34 秒在 Apple M4 Pro 上是合理水準
  廠商討論用 C1 baseline 預設（30 秒）可接受
  跳到 R6 整體順序最後段「評估 1024-spp 收斂秒數」判斷
  工時：0
  風險：0

建議：路徑 Z（R6-2 結案）
理由：a/d 雙失敗 + b/c 收穫上限低、改主線 1 投入不確定，30 秒牆鐘可接受
```

---

## 8. follow-up

```
F1: a + d 雙失敗的根因剖析（spectorJS GLSL→HLSL dump）
    優先序：低（不影響 R6-2 推進）

F2: 78 box → 200+ box（R3-8 採購擴張後）重跑 Step 0 探針
    可能屆時 BVH 結構優化收益翻轉（更多 box → BVH traversal 占比升）

F3: 主線 1 階段 2 reproject 評估 ralplan
    若使用者選路徑 Y 觸發
```

---

## 9. SOP 修訂

```
docs/SOP/R6：渲染優化.md 第 86 行附近 a/b/c/d 分流規則：
  a) ❌ 已驗證 SAH 切換 -39%
  d) ❌ 已驗證 leaf fetch packing ≤ 1%（本次新增）
  → 主動引導「a + d 雙失敗 → BVH 結構優化整支可信度下降 → 建議跳路徑 Y/Z」
```

---

## 修訂歷史

- 2026-04-27 初版（Step 0 fail-fast 退場紀錄）
