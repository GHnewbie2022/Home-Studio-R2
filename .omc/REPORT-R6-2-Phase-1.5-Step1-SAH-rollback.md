# R6-2 Phase 1.5 Step 1：SAH builder 切換實驗 ❌ 失敗回滾

> 階段狀態：失敗回滾 2026-04-27
> 上層 SOP：`docs/SOP/R6：渲染優化.md` 第 86 行 a 項分流規則
> Phase 1.0 baseline：`.omc/REPORT-R6-2-Phase-1.0.md`
> 對應 commit：實驗未 commit（檔案回滾後等同 Phase 1.0 終態）

---

## 1. 結論一句話

```
SAH builder 對 78-box 場景反向變慢 38~39%（四個 config 一致），
立即回滾保留 Fast builder。
```

---

## 2. 對照表

| Config | Fast (baseline) spp/sec | SAH spp/sec | 變化 | Fast 1024-spp 牆鐘 | SAH 1024-spp 牆鐘 | 變化 |
|--------|-------------------------|-------------|------|---------------------|--------------------|------|
| C1 | 34.30 | 21.17 | -38% | 29.9 秒 | 48.4 秒 | +62% |
| C2 | 31.56 | 19.21 | -39% | 32.4 秒 | 53.3 秒 | +65% |
| C3 | 30.78 | 18.63 | -39% | 33.3 秒 | 55.0 秒 | +65% |
| C4 | 30.39 | 18.43 | -39% | 33.7 秒 | 55.6 秒 | +65% |

四個 config 一致變慢 38~39%、1024-spp 牆鐘從 30~34 秒拉到 48~56 秒。

### 量測條件（與 baseline 對齊）

```
GPU: Apple M4 Pro (Metal Renderer via ANGLE)
Browser: MCP Playwright Chromium (Chrome 147)
Server: python3 -m http.server 9001
量測法: click btnConfigN → wait 1500ms（讓 BVH 重建 + reset 完成）
        → spp_t0 = sampleCounter → 跑 5000ms RAF callback 計數
        → spp_t1 = sampleCounter → spp/sec = (spp_t1-spp_t0)/elapsed_sec
sceneBoxes.length: 78（與 baseline 一致）
spp_per_frame_ratio: 0.913~0.947（GPU saturated 確認，非 throttle）
```

---

## 3. 切換改動

```
唯一變動：Home_Studio.html line 266
  - <script defer src="js/BVH_Acc_Structure_Iterative_Fast_Builder.js">
  + <script defer src="js/BVH_Acc_Structure_Iterative_SAH_Builder.js">

兩個 builder 都 export 同名 BVH_Build_Iterative()，
所有場景檔（含 Home_Studio.js:264）的 caller 不必改。
依守門禁忌 4，兩個 builder 檔保留不刪。
```

---

## 4. 為何反向（推測，未實際剖析）

```
1. 78 box 對 SAH 是「小場景」
   SAH 演算法用 surface area heuristic 找最佳切分點，
   對小場景可能過度切分（樹深 → traversal 命中率反降）。

2. erichlof framework 的 fragment shader BVH traversal stack 深 32
   log2(78) ≈ 6.3，Fast 樹本來就在 stack 容量內舒服跑。
   SAH 若產更深樹（極端例 stack 觸頂）會多 fetch 失敗。

3. SAH 用 BVH texture 結構可能 node 數變多
   每 frame fetchBVHNode 讀更多 texel → 慢 38% 對應 ~38% 多的記憶體存取。

4. erichlof framework 對 SAH 與 Fast 的 fragment shader 端 traversal 程式碼可能未對齊
   shaders/Home_Studio_Fragment.glsl L674-734 的 stack-based traversal
   可能對 Fast builder 的樹形特定優化過。
```

實際剖析需要 dump BVH texture 內 node 數 + 樹深度，未做（成本不值）。

---

## 5. 對 Phase 1.5 後續分流規則的影響

依 SOP 第 86 行 a/b/c 分流：

```
原計畫：
  a) 切到 SAH_Builder ← 此次失敗
  b) BVH node packing 優化（記憶體存取模式）
  c) Stack-based vs while-loop traversal 切換評估

修訂後：
  a) ❌ SAH 切換失敗 -39%（已驗證反向）
  b) BVH node packing：仍可嘗試，但要動 builder JS + fragment shader 兩端，風險高
  c) Stack vs while traversal：fragment shader 改動，風險高
  → 建議改試「leaf fetch packing」（SOP 未列、但 Phase 1.0 報告 §1 提到的主嫌）：
    每 leaf 5× texelFetch(boxData) → 改 2~3× texelFetch（合併存取）
    若 GPU 端 texture cache 友善，可能 +20%~+40%
```

---

## 6. 學到什麼

```
1. SOP 經驗法則「SAH 比 Fast 快 10~30%」對小場景不成立
   memory 對未來 R6 / R7 升級：78 box 級小場景跳過 SAH

2. 分流規則「>30% 閾值」雖然這次三段佔比沒拆，但「變化 ≥ 5%」門檻仍能判斷
   這次 -39% 遠超 5%，明確 NO-GO，不需細拆三段佔比即可決策

3. 守門禁忌 4「保留 fallback」生效
   SAH builder 檔保留、不刪除，回滾 = 1 行還原
   實驗成本：1 行 Edit + 4 個 5 秒量測 + 1 行 Edit = 約 1 分鐘工程時間
   對齊 R6-1 教訓「prototype-first」：低成本驗證先行
```

---

## 7. 下一步建議

```
路徑 A：跳過 BVH 結構繼續分流 → leaf fetch packing
  改動量：
    1. js/Home_Studio.js BVH 寫入 boxData texture 時併欄（5 條 vec4 → 2~3 條）
    2. shaders/Home_Studio_Fragment.glsl fetchBoxData() 改寫
  風險：中（fragment shader 動結構，需 1024-spp pixel diff = 0 視覺驗證）
  預期：+20% ~ +40% spp/sec
  工時：1~2 天

路徑 B：放棄結構優化、量化 NEE 端優化空間
  Phase 1.0 推論光源 NEE ≤ 12% 成本，動 NEE 收穫上限 12%
  可做：R3-6 Many-Light Sampling cache 優化
  風險：低，但收穫上限低
  工時：0.5~1 天

路徑 C：R6-2 結案，1024-spp 30~34 秒可接受
  Apple M4 Pro 在 78 box + path tracing 跑 30 秒已是合理水準
  廠商討論若改用 C1 預設（30 秒）可能不需更快
  進度跳到主線 1 階段 2 reproject 評估（R6 SOP 整體順序最後段）
```

---

## 8. follow-up

```
F1: 78 box 場景何以 SAH 反向 38%——剖析需 dump BVH node 數 + 樹深度
    優先序：低（不影響 R6-2 推進）

F2: 若未來場景擴張到 ≥ 200 box（例 R3-8 採購階段加家具）
    可重跑 SAH 對照（屆時 SAH 可能反轉為快）
```

---

## 9. SOP 修訂

```
docs/SOP/R6：渲染優化.md 第 86 行附近 a/b/c 分流規則：
  a) 切到 SAH_Builder ← 加 ❌ 已驗證 -39%（2026-04-27 step 1 失敗回滾）
  → 主動引導下一步走 leaf fetch packing（路徑 A）
```

---

## 修訂歷史

- 2026-04-27 初版（SAH 切換實驗失敗回滾紀錄）
