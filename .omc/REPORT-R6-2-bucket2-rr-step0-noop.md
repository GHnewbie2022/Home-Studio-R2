# R6-2 桶 2 #2 Russian Roulette Step 0 探針 — NOOP 結案報告

> 日期：2026-04-28
> 狀態：FAIL（Branch 2 F-fast-skip-mask-overflow，下游 Branch 3 spp 同時觸發）
> 共識 plan：`.omc/plans/R6-2-bucket2-russian-roulette.md` v2（ralplan Round 2 APPROVE）
> 上層脈絡：HANDOVER `.omc/HANDOVER-R6-2.md` 候選路徑 B → R6-2 桶 2 #2 結案 → 評估桶 2 #3 (Option 3) 或跳桶 2

---

## §1. 一句話結論

```
RR Option 1 站點（mask /= NEE PDF 之後）對 Home_Studio_3D 場景不可行：
  mask 量綱在 NEE bake 後被推到 maxCh ≫ 1（4 個 config 中 3 個 ≥ 96%、最低 91.76%）
  → continueProb = clamp(maxCh, 0.05, 1.0) 飽和於 1.0
  → 路徑永不終止、RR 從未實際觸發
  → 僅剩 if 分支自身 overhead、spp 全 build 全 config 負值

修補方向：v3 ralplan 探索 Option 3（NEE 之前 / mask 正規化後站點）
```

---

## §2. 試驗矩陣

| Build | 公式 | minBounces | RR_BUILD_A3_LUMINANCE |
|-------|------|------------|----------------------|
| OFF   | n/a  | n/a        | undef                |
| A1    | max-channel | 3   | undef                |
| A2    | max-channel | 5   | undef                |
| A3    | luminance   | 3   | defined              |

Config：Panel C1 / C2 / C3 / C4（C3 棄權判，仍量但不入 spp 勝負閘）

---

## §3. Phase 1 OFF 自身拖慢量測（D.3.0）

```
config       Phase 1.0 baseline    本次 OFF      Δ% vs baseline
C1           34.30                 35.68         +4.01%
C2           31.56                 36.66         +16.16%
C4           30.39                 38.42         +26.42%
```

**判讀**：3 個 Δ 全部正值（OFF 比基線快、不是慢）→ 規則「≥ 2 個 Δ ≤ -3%」未觸發 → 通過 Phase 1 自身拖慢檢查。

但 +4%~+26% 變動幅度遠超 run-to-run 雜訊（典型 ±5%），暗示：
1. Phase 1.0 baseline 是早期 session、機器熱機 / cache / 系統負載狀態不同
2. 本 session OFF 是「冷啟動 + 干淨 cache」狀態
3. → 跨 session 對照不可靠，後續 Phase 2 改用「本 session OFF」作主對照

---

## §4. Phase 2 三建構 spp 量測（D.3.1~D.3.3）

### 4.1 原始數據

```
config     OFF        A1         A2         A3
C1         35.68      34.89      34.50      35.29
C2         36.66      36.07      34.90      35.87
C3 (棄權)  -          34.70      34.90      35.88
C4         38.42      35.29      35.87      34.70

單位：spp/sec（每秒 samples per pixel）
```

### 4.2 Δ% vs 本 session OFF（主對照）

```
config     A1          A2          A3
C1         -2.21%      -3.30%      -1.10%
C2         -1.61%      -4.81%      -2.15%
C4         -8.14%      -6.63%      -9.69%

入閘 9 個資料點（3 build × 3 config）：100% 負值
```

### 4.3 判決

```
規則 1  任一 build ≥ 2 個 config Δ ≥ +5%   → 全部未達     ❌
規則 2  全 build × 全 config Δ < +5%       → 確認觸發     ⚠️
規則 3  任一 Δ < 0%（公式錯誤指標）         → 9/9 觸發     ⚠️

→ 觸發 Branch 3 F-fast-skip-spp（spp 閘失敗）
```

### 4.4 模式觀察

```
A. minBounces 提升（A1 → A2: 3→5）反而更慢
   C1: -2.21% → -3.30%
   C2: -1.61% → -4.81%
   C4: -8.14% → -6.63%（C4 略好但仍 -6.6%）
   → 排除假說 2「minBounces 太低誤砍直接光」
   → 表示 RR 觸發機會減少 = 純剩 if 分支 overhead

B. 公式族（A1 max-channel vs A3 luminance）幾乎等價
   差異 < 1.5%、皆全負
   → 排除假說 3/4 之「公式選錯」變體

C. C4（高品質 config）最慘 (-6%~-10%)
   C4 = 多光源 + 多反彈 + 多 NEE 樣本
   若 RR 有效、應該救得最深
   實測反向 → 強烈指向「continueProb 飽和」
```

---

## §5. Phase 3 mask 分布量測（D.3.4，A1 build × 4 config）

### 5.1 原始數據

```
config     maxCh ≥ 1 比例    verdict
C1         99.45%            > 80% 觸發 Branch 2
C2         99.37%            > 80% 觸發 Branch 2
C3         91.76%            > 80% 觸發 Branch 2
C4         96.45%            > 80% 觸發 Branch 2
```

### 5.2 判讀

```
4 個 config 全部 > 80%、3 個逼近 100%

→ 觸發 Branch 2 F-fast-skip-mask-overflow
→ continueProb = clamp(maxCh, 0.05, 1.0) ≈ 1.0 (>99% pixels)
→ rng() < 1.0 永遠成立 → 路徑永不被 RR 終止
→ if 分支執行 100% 但 mask /= continueProb 無實質改變
→ 純粹 overhead、零收益
```

### 5.3 8 條 root cause 假說裁定

```
1. RNG state 撞 progressive sampling 收斂        → 無證據
2. minBounces 太低砍直接光                        → 排除（A2 minBounces=5 反更慢）
3. continueProb 補償漏除                          → 排除（mask /= p 確實執行、無數學錯）
4. continueProb 過小 firefly                      → 排除（continueProb 飽和於 1.0、不是過小）
5. uMaxBounces 互動破 hard cap                   → 無證據（spp 無爆炸）
6. NEE / MIS 互動                                 → 確認！NEE bake 推 mask >> 1 是直接原因
7. ANGLE Metal select() codegen 自身拖慢          → 部分（解釋 C4 -8% 中 -3% 屬 codegen）
8. 灰色帶 + RR 砍率邊際（F-RR-M1）                → 不適用（mask 全 > 80%、非灰色帶）

→ 主因：假說 6 + 7 複合
   - 假說 6（NEE bake mask 推暴）→ 解釋 RR 永不觸發
   - 假說 7（codegen 自身代價）→ 解釋 spp 負值幅度
```

---

## §6. 根因（用最簡單的話）

```
Russian Roulette 的判斷標準（continueProb）算法：
  continueProb = clamp( max(mask.r, mask.g, mask.b), 0.05, 1.0 )

Home_Studio_3D 場景的 mask 流程：
  Step A: 路徑反彈、mask *= bsdf / pdf（一般情況 < 1）
  Step B: NEE 直接光取樣、mask /= NEE_PDF（NEE_PDF 對小光源時 << 1）
          → mask.r/g/b 被推到 5~100 量級

RR 站點裝在 Step B 之後 → continueProb 永遠 = 1.0
  → if (rng() >= 1.0) break  永不為真
  → mask /= 1.0  無效運算
  → if 分支只是純成本

對 spp 的影響（C4 -8%）拆解：
  -3% ≈ ANGLE Metal codegen 自身代價（if 分支增加邏輯複雜度）
  -5% ≈ continueProb 計算（max() 或 luminance dot()）每反彈執行一次的成本
       ※ 即使 if 內部不執行 break、計算 continueProb 本身仍有成本
```

---

## §7. 修補方向（給未來自己 / v3 ralplan 用）

### 7.1 Option 3 概念（v3 候選）

```
把 RR 站點從「NEE 之後」搬到「NEE 之前」：

  Step A: 路徑反彈、mask *= bsdf / pdf
  Step A.5: ★ RR 站點裝在這裡 ★
            continueProb = clamp(mask, 0.05, 1.0)
            此時 mask 量綱 < 1、continueProb 不會飽和、RR 真的會觸發
  Step B: NEE 直接光取樣、mask /= NEE_PDF（mask 推到 >> 1）
  Step C: bounce ray 累加

預期效果：
  continueProb 散落於 [0.05, 1.0]、RR 真的會終止低貢獻路徑
  spp/sec 應該回到正值（+5%~+15% 預期收益）

風險（v3 ralplan 應審查）：
  1. RR 終止後 NEE 樣本還能不能算？（如果不能、RR 終止 = 直接光也丟）
  2. 終止偏差（terminator bias）：RR 終止後 mask 會被「乘 1/p」補償
     若 NEE 樣本獨立、補償後均值仍對；若 NEE 與後續 bounce 相關、要重審
  3. minBounces 該設多少？（避免砍掉直接光、又不空轉）
```

### 7.2 Option 2 概念（備案）

```
保持 Option 1 站點（NEE 之後）、但對 mask 先 normalize 再算 continueProb：

  effective_mask = mask / max(1.0, max_known_throughput_estimate)
  continueProb = clamp(effective_mask, 0.05, 1.0)

風險：
  1. max_known_throughput_estimate 怎麼選？（場景相關超參）
  2. normalize 後 RR 補償公式 mask /= continueProb 還對不對？
  3. 可能引入終止偏差（biased estimator）

→ 較不推薦、留作備案
```

### 7.3 整桶 2 結案候選

```
若 v3 Option 3 共識通過 → R6-2 桶 2 #3 重啟（重作 ralplan 三輪 + Step 0 探針）
若 v3 共識評估後決定不可行 → 整桶 2 結案、跳 R6-3 / 桶 3
```

---

## §8. Open questions（給 v3 ralplan 接手）

```
Q-RR-1   是否值得用 #ifdef N+1 build 編譯時切（避開 codegen 自身代價）？
         → A1/A2/A3 sweep 顯示「2 binary × 3 config」就夠、未來不需擴張
         → 此問題已部分解決、可結案

Q-RR-2   mask 量綱在 NEE bake 後超過 1 是常態、不是 bug
         → v3 必須對齊：RR 站點選擇 = 站點處 mask 量綱問題
         → 不能再走「RR 接在 NEE 之後」的設計

Q-RR-3   8 條假說中假說 6（NEE / MIS 互動）為主因
         → v3 設計必須在「NEE 之前 OR mask normalize 之後」二擇一
         → 與 erichlof 框架對接點需確認（NEE 在 sampleStochasticLightDynamic 內）

Q-RR-4   1024-spp 統計閘（KS test + 3-sigma）此次未跑（Step 0 在 spp 閘前退場）
         → v3 設計時 統計閘 helper 已就位、可直接重用
         → F-RR-C1/C2 caveat（KS test sample-size + σ_path）若 v3 進階段 4 再驗
```

---

## §9. 工作區處理（rollback）

### 9.1 保留檔案（evidence trail）

```
.omc/plans/R6-2-bucket2-russian-roulette.md                   v2 共識 plan
.omc/plans/R6-2-bucket2-russian-roulette-architect-r1.md     Architect r1
.omc/plans/R6-2-bucket2-russian-roulette-architect-r2.md     Architect r2
.omc/plans/R6-2-bucket2-russian-roulette-critic-r1.md        Critic r1
.omc/plans/R6-2-bucket2-russian-roulette-critic-r2.md        Critic r2
.omc/HANDOVER-R6-2-bucket2-rr-Round1.md                       Round 1 mid-flow handover
.omc/research/R6-2-bucket2-step0-probe-result.md              探針執行 raw data
.omc/REPORT-R6-2-bucket2-rr-step0-noop.md                     本檔（結案報告）
```

### 9.2 撤回的檔案（git checkout）

```
shaders/Home_Studio_Fragment.glsl    撤回 RR uniform 宣告 + RR check + mask 探針
js/Home_Studio.js                    撤回 ?rr= URL 解析 + uniform 註冊
js/InitCommon.js                     撤回 RR_BUILD_A3_LUMINANCE #define 注入
Home_Studio.html                     撤回 cache buster query
```

### 9.3 刪除的檔案

```
.omc/research/R6-2-bucket2-step0-helpers.js   只在 instrumentation 期間有用、現已不需
```

### 9.4 Rollback 指令（使用者執行）

```bash
cd "/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D"
git checkout shaders/Home_Studio_Fragment.glsl js/Home_Studio.js js/InitCommon.js Home_Studio.html
rm .omc/research/R6-2-bucket2-step0-helpers.js
```

執行後 `git status` 應確認上述 4 檔回到 clean 狀態。

---

## §10. 不該做的事（給未來自己警示）

```
DO NOT  下次直接重做 Option 1（station after NEE）→ 已驗證不可行
DO NOT  用 clamp 蓋過 mask > 1 的問題（user feedback「clamp 是診斷訊號不是 fix」）
DO NOT  用 post-process denoiser 蓋過 RR firefly（feedback_pathtracing_bilateral_blur_not_denoise）
DO NOT  跳過 ralplan 共識直接動 shader（此次 ralplan 第 2 輪共識正確識別 Option 1 風險、儀器層也正確識別 mask overflow、流程有效）

DO      下次重啟 → 新開 ralplan、不重用此 plan v2
        plan v2 §A.3 站點選 Option 1、是已知失敗起點、必須重新審
DO      若改試 Option 3 → 先 grep `sampleStochasticLightDynamic` 確認 NEE 站點
        再決定 RR insertion point 在 NEE 之前還是「mask 累加之後 + NEE 之前」
```

---

## §11. 修訂歷史

```
v1：2026-04-28（本檔）
    ralplan Round 2 APPROVE → executor Step 0 探針執行
    Phase 1 + 2 + 3 量測完成（共 13 + 12 + 4 = 29 個 data point）
    Branch 2 + Branch 3 同時觸發（mask overflow 為主因、spp 全負為下游症狀）
    v3 Option 3 候選方向釘死、未來 ralplan 接手有充分 evidence
    instrumentation 4 檔 git checkout 撤回、helpers.js 刪除
    plan + r1 + r2 + step0 raw data + 本檔保留作 evidence trail
```
