# Handoff — 下一步：R6-2 桶 2 #2 Russian Roulette（俄羅斯輪盤機制）

> Date: 2026-05-01
> 來源：R6 後製子線（LGG-r30）完工後、使用者選「留候補」路徑
> 狀態：等啟動
> 上一階段：`.omc/HANDOFF-R6-r30-final.md`（R6 後製子線收尾）

---

## 為什麼下一步選 RR

```
 使用者裁示  R6-2 BVH 加速整體不結案、留候補
              桶 2 #2 Russian Roulette 標下一步啟動目標
 動機         未來廠商現場若 1024 spp 30~34 秒仍嫌慢、要有快速可上的優化
              RR 屬「風險低、收穫保守 ≤ 10%」、是剩下幾條優化中性價比最高
```

---

## RR 是什麼

```
 全名      Russian Roulette（俄羅斯輪盤、業界傳統名稱）
 做法      原本 path 在 4 ~ 14 次彈跳到頂才 terminate
            改成：彈到中段隨機提早 terminate、用機率權重補償
            數學期望值不偏差，畫面結果不變
 好處      每條 path 平均彈跳次數降低 → 整幅畫面渲染時間縮短
 風險      低
 預期收穫  ≤ 10% spp/sec
 工時      1 ~ 2 天
```

---

## 啟動前必讀（不得跳過）

```
1. .omc/HANDOFF-R6-r30-final.md            R6 後製子線最終狀態（這次 push 的內容）
2. .omc/HANDOVER-R6-2.md                    R6-2 主線 2 上一階段現況
3. .omc/plans/R6-2-bucket2-russian-roulette.md          ralplan 主計畫
4. .omc/plans/R6-2-bucket2-russian-roulette-architect-r1.md
5. .omc/plans/R6-2-bucket2-russian-roulette-architect-r2.md
6. .omc/plans/R6-2-bucket2-russian-roulette-critic-r1.md
7. .omc/plans/R6-2-bucket2-russian-roulette-critic-r2.md
8. .omc/HANDOVER-R6-2-bucket2-rr-Round1.md  桶 2 #2 RR 第一輪交接
9. docs/SOP/R6：渲染優化.md 主線 2 章節
10. docs/SOP/Debug_Log.md 開頭通用 Debug 紀律三條
```

---

## 啟動觸發條件

```
 觸發 A  廠商現場真的等不了 30~34 秒 → 立即啟動
 觸發 B  R7 採購評估告一段落、有閒置時間 → 順手啟動
 觸發 C  之後其他效能議題（譬如場景擴大到 200+ box）連帶啟動
```

任一觸發都先讀「啟動前必讀」全套、再走 ralplan v3 共識（已完成）後直接 executor。

---

## 啟動流程概要（細節見 .omc/plans/R6-2-bucket2-russian-roulette.md）

```
 Step 0  探針閘（先量基準值，量不出 ≥ 5% 收穫差距時 fail-fast）
 Step 1  RR 機制套進 path tracer terminator
         （隨機 terminate 提案 + 機率權重補償）
 Step 2  視覺驗證：1024 spp 對 main 分支 pixel diff = 0
         （絕不容忍視覺偏差）
 Step 3  spp/sec 量測：C1/C2/C3/C4 各 config baseline 對比
         達 ≥ 5% commit 門檻才 ship、< 5% 撤回回滾
```

---

## Hard Rules（繼承 R6-2 主線 2）

```
 DO NOT 跳過 1024 spp pixel diff = 0 視覺驗證（任何效能優化的鐵則）
 DO NOT 跳過 Step 0 探針閘（leaf packing / F2 兩次教訓：探針省了 17 ~ 21 hr）
 DO NOT 自動進入 Step 1（使用者明確觸發才動）
 DO NOT 重啟 ralplan 共識（v3 已落地、Step 0 直接動）
 DO NOT 改動 R6 後製子線 LGG 任何 uniform / slider / 預設值（屬視覺凍結）
```

---

## R7 互動

```
 R7 採購評估啟動後此 RR 工作優先序  低（採購評估自身有時程）
 採購完工後若觀察到場景擴張（新燈具、新家具入場景）需要更快渲染才考慮啟動
```

---

R6 後製子線到 r30 完工。此檔等啟動 RR 那刻被執行者取走。
