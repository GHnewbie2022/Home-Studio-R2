# Handoff — R6 ACES + LGG + EXP + J3 暗角借光 final state

> ⚠ 已被 `.omc/HANDOFF-R6-r30-final.md` 取代（2026-05-01 R6 LGG-r30 完工後）
> 本檔保留作 r29 階段歷史快照，主接手請改讀 r30-final。

> Date: 2026-05-01 (LGG-r29 暗角借光 13 輪 debug 後收尾)
> Status: A/B 雙模 ACES + 統一 SAT + 獨立 EXP + B 模 LGG + B 模 J3 暗角借光 全套落地完成。
>          全部甜蜜點寫入預設、6 個檔案備份 r6lgg29-bak、無 pending question。
>          Q2（C4 暖光偏黃綠）使用者明確說「甜蜜點抓好之後不重要了」、可移出 pending。

---

## Required prior reading (in order)

1. This file
2. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md`
   特別讀「R6-LGG-J3」章節（暗角借光 13 輪 debug 紀錄、根因、永久教訓）
3. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/LESSONS-R6-shadow-lift-failures.md`
   （5 條 luma-based shadow lift 失敗紀錄 + Update 1/2/3 + Hard Rules）

---

## User profile (load-bearing)

- 音樂製作人（混音／母帶），無工程背景。**對使用者所有技術縮寫必白話展開**（NEE / MIS / BSDF / PDF / DCE / GLSL / RRT / ODT 等），用全英文 + 繁體中文白話。
- 繁體中文 only。禁簡體、禁中國用語。
- 嚴禁 AB 否定句型：不是A而是B / 不是A只是B / 是A而非B / 是A而不是B。
- 瀏覽器：Brave。
- **動工前先給選項，不替使用者決定。**
- 動 debug 前必先 isolation test 鎖根因，禁瞎猜瞎改（Debug_Log R6-LGG-J3 教訓）。

---

## Current state (LGG-r29 final)

### Pipeline (Home_Studio_Fragment.glsl, B 模 4 彈)

```
camera primary ray
 → 4 彈 path tracing（NEE 每彈、BSDF bounce、MIS、emit clamp）
 → reachedMaxBounces 時：
     if uBorrowStrength > 0.0 && uIsBorrowPass < 0.5：
         讀 1/8 res 14 彈借光 buffer：borrowedAvg = tBorrowTexture(uv) / sampleCounter
         borrowedAvg = min(borrowedAvg, 1.0)
         positionGate = 1 - smoothstep(0.0, 0.3, borrowLuma)
         accumCol += mask × borrowedAvg × uBorrowStrength × positionGate
 → return accumCol
```

### Pipeline (借光 pass, 1/8 res 14 彈)

```
animate STEP 1A（uBorrowStrength > 0 時才跑）
  暫切 uniforms：uMaxBounces=14、uIsBorrowPass=1、tPreviousTexture→borrowScreenCopy、
                 uResolution→1/8、tBorrowTexture→borrowScreenCopy（防 feedback loop）
  render pathTracingScene → borrowPathTracingRenderTarget（1/8 res）
  PathTracingCommon.js pathtracing_main chunk 在進入 accumulator 前對借光樣本 clamp 1.0（source-side firefly suppression）
  ping-pong copy borrowPathTracingRenderTarget → borrowScreenCopyRenderTarget（給下一 frame 當 tPreviousTexture）
  恢復主 pass uniforms
```

### Pipeline (ScreenOutput_Fragment.glsl post-process)

```
HDR input
 → bloom composite
 → if (uACESEnabled > 0.5) filteredPixelColor *= uExposure   ← EXP gate
 → saturation block (chroma-mask + R6-sat04 白平衡補償)
 → tonemap: mix(Reinhard, ACESFilmicNarkowicz, uACESStrength)
 → gamma sqrt
 → LGG block when uLGGEnabled
 → 3-band SAT block (luma-band masks × shadow/mid/highlight sat) when uACESEnabled
 → output
```

### Uniforms（pathTracingUniforms 新增）

```
uTerminalAmbient  ← 已移除（r22 拆掉）
uBorrowStrength   0~2.0，B 模借光強度
uIsBorrowPass     0=主 pass、1=借光 pass（gate 借光採樣與 source clamp）
tBorrowTexture    sampler2D，主 pass 在 reachedMaxBounces 採樣
```

### 甜蜜點（locked as defaults at LGG-r29 final）

#### 趨近真實 A 模式（group-a-controls）
```
chkAces-a               default CHECKED
slider-aces-strength-a  default 0.20
slider-aces-sat-a       default 0.90   單一條同步寫 3 個 ACES Sat uniform
slider-exp-a            default 0.90
（A 模式強制 uLGGEnabled = 0、uBorrowStrength = 0、LGG 全 uniform 中性）
```

#### 快速預覽 B 模式（group-b-controls）
```
chkAces-b                  default CHECKED
slider-aces-strength-b     default 0.30
slider-aces-sat-b          default 0.90   單一條同步寫 3 個 ACES Sat uniform
slider-exp-b               default 0.80
slider-borrow-strength-b   default 0.50   J3 暗角借光，範圍 0.0~2.0 step 0.05
chkLgg                     default CHECKED
slider-lgg-strength        default 0.50
slider-lgg-lift            default -0.10
slider-lgg-gamma           default 1.00
slider-lgg-gain            default 1.00
```

### 命名 / 結構紀律
- ACES tonemap 函式名 `ACESFilmicNarkowicz`（避開 Three.js 內建 `ACESFilmicToneMapping` auto-inject 撞名）
- ACES SAT 三段 uniform 共用，A/B 各自單一 slider 同步寫入
- EXP/A 與 EXP/B 各自獨立 slider（E2 路線），切模式時 btnA/btnB.onclick 重讀對應值
- ACES SAT、EXP 都被 uACESEnabled gate 包住——ACES 關閉 = 純 Reinhard 比對基準
- J3 借光只在 B 模啟用，A 模 14 彈不需借光、btnA.onclick 強制 uBorrowStrength=0 省下借光 pass 成本

### Post-process / Render-pass 機制

```
postProcessChanged       後製 slider 不重啟 path tracer 累積（wakePostProcess）
borrowPathTracingRenderTarget   1/8 res RGBA float LinearFilter（主 pass 採樣需 bilinear）
borrowScreenCopyRenderTarget    1/8 res RGBA float NearestFilter（ping-pong 給 tPreviousTexture）
needClearAccumulation     相機切換 / 場景變動時同步清空 4 個 buffer（main 2 + borrow 2）
window resize             borrow 兩 buffer 跟主 buffer 同步 1/8 res 縮放
```

---

## Backups（LGG-r29 stable，6 檔）

```
shaders/Home_Studio_Fragment.glsl.r6lgg29-bak       借光採樣邏輯 + reachedMaxBounces 旗標
shaders/ScreenOutput_Fragment.glsl.r6lgg29-bak      ACES + EXP + LGG 後製
js/Home_Studio.js.r6lgg29-bak                       UI sliders、btnA/btnB 切模式、uniforms 設定
js/InitCommon.js.r6lgg29-bak                        借光 render targets + animate STEP 1A
js/PathTracingCommon.js.r6lgg29-bak                 pathtracing_main chunk source-side firefly clamp
Home_Studio.html.r6lgg29-bak                        UI 結構（A/B 雙模 panel、slider divs）
```

更早的備份保留：
```
*.r6lgg14-bak     ACES + EXP 甜蜜點落地時點
*.routeXa-bak     Route X v1 HDR-space exp lift（已棄）
```

---

## Verification URL history（this branch）
```
?v=r6lift01 ~ r6lift06       失敗的陰影補光路線（已棄，見 LESSONS）
?v=r6lgg01 ~ r6lgg08          初版 LGG 落地 + 5 條 Bandpass 拆除
?v=r6lgg09 ~ r6lgg14          Q1 + ACES + EXP + LGG 甜蜜點
?v=r6lgg15 ~ r6lgg16          B1 Terminal Ambient → J3 1/8 res borrow 切換
?v=r6lgg17 ~ r6lgg18          5×5 blur 失敗
?v=r6lgg19                    source-side firefly clamp（pathtracing_main chunk）
?v=r6lgg20 ~ r6lgg21          accumCol gate / dual gate（後來發現是 banding 元兇）
?v=r6lgg22                    cleanup（拆暗角補光、預設 0.5）
?v=r6lgg23 ~ r6lgg25          速度優化嘗試（RR + tighter gate + blur）— 全敗
?v=r6lgg26 ~ r6lgg28          rollback / pure positionGate 試錯
?v=r6lgg29-tight-gate         FINAL：拆 darkGate、positionGate 收緊 (0.0, 0.3)
```

---

## Pending user questions

無。

Q1（A 模 ACES 預設）✅ done @ r9
Q2（C4 暖光偏黃綠）— 使用者明確說「抓好甜蜜點之後 Q2 還好了」，移出 pending
J3 暗角借光 ✅ done @ r29

---

## Hard rules（精選，全表見 LESSONS file）

- DO NOT 重啟 luma-based 陰影偵測（5 條失敗，見 LESSONS）
- DO NOT 重啟 path-tracer-side ambient injection（geometric series → 牆面刷白）
- DO NOT 用 Three.js 內建名給自寫 tonemap 函式命名（ACESFilmic / Reinhard 等）
- DO NOT 對 post-process slider 用 wakeRender()，必用 wakePostProcess() + reset=false
- DO NOT 對使用者用技術縮寫
- DO NOT 用 AB 否定句型
- DO NOT 在功能未驗證收斂前先做速度優化（J3 r23~r25 教訓）
- DO NOT 用 per-frame stochastic gate 做 spatially-variant 條件（J3 darkGate banding 教訓）
- DO debug 前必先 isolation test 鎖根因（J3 r17~r28 13 輪瞎改教訓）

---

## Key files

- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/Home_Studio.html`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/js/Home_Studio.js`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/js/InitCommon.js`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/js/PathTracingCommon.js`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/shaders/Home_Studio_Fragment.glsl`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/shaders/ScreenOutput_Fragment.glsl`

---

## Suggested next directions（接棒 AI 可考慮，但等使用者開題）

```
 SOP 收尾
   git commit + tag v6.0-final（R6 LGG 主線完工標記）
   merge r6-lgg-final → main、清掉 r6lift / routeXa 系列舊備份
 採購評估（per memory 「R3-8 採購評估」是下一階段）
   Home_Studio_3D 燈具採購（飛利明Varilumi 22W COB + 25W 廣角軌道燈）
   工作流程：confirm 規格 → 比價 → 訂購
 速度優化（如使用者再開題、需先 isolation 確認 baseline）
   Option F：主 path tracer source clamp（per memory 「PT 黑白畫面 debug 先掃 accumCol」原則）
   Option E：pre-blur pass on borrow（單獨 render pass、避開 in-shader blur 副作用）
   Option G：SVGF / OIDN denoiser（高工時、另開 R 階段）
 Q2 重新評估
   使用者目前說「不重要了」、若回頭關心：HANDOFF 內保留診斷選項與三個可能修法
```

---

Stand by。下一步等使用者指示。
