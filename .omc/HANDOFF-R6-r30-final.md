# Handoff — R6 LGG-r30 final state（R6 主線 DONE）

> Date: 2026-05-01
> Status: R6 LGG-r29 完工狀態之後累積延伸全套落地完成。
>          R6 主線 DONE、無 pending question、可提交 GitHub。

---

## Required prior reading（接手必讀順序）

1. 本檔
2. `docs/SOP/Debug_Log.md` 章節「R6-LGG-r30」
3. `docs/SOP/Debug_Log.md` 章節「R6-LGG-J3」（前一輪暗角借光 13 輪 debug）
4. `.omc/LESSONS-R6-shadow-lift-failures.md`（5 條 luma-based shadow lift 失敗紀錄）
5. `.omc/HANDOFF-R6-aces-lgg-pending.md`（r29 完工狀態，已被本檔取代為主檔）

---

## R6 LGG-r30 範圍（接 r29 之後累積）

```
 1. WB（白平衡）滑桿  von Kries chromatic adaptation
                       D65 → 目標 illuminant RGB ratio，B 模專屬
 2. Hue（色相）滑桿    NTSC luma-preserving 色相環旋轉
                       繞 (1,1,1)/√3 軸，B 模專屬
 3. per-config 體系    C1 / C2 / C3 / C4 各自 10 欄甜蜜點預設
 4. stateful 切換      configState 4 entry，離開 snapshot、進入 restore-or-init
 5. cmd+click 重置      9 條 slider 走 installContextReset、重置回該 config 預設
 6. C1 / C2 滑桿全套對齊使用者截圖（17 條 B 模滑桿）
 7. C4 局部細調         Gamma 2.0 / WB -0.2 / Hue 2 / Lift -0.1 / ACES SAT 1.0
 8. 窗外背板 X-ray fix  box 27 cullable 1 → 0
```

---

## 程式現況（r30 final）

### Pipeline（ScreenOutput_Fragment.glsl post-process）

```
HDR input
 → bloom composite
 → if (uACESEnabled) filteredPixelColor *= uExposure
 → saturation block (chroma-mask + R6-sat04 白平衡補償)
 → tonemap: mix(Reinhard, ACESFilmicNarkowicz, uACESStrength)
 → gamma sqrt
 → LGG block when uLGGEnabled
 → 3-band SAT block (luma-band masks × shadow/mid/highlight sat) when uACESEnabled
 → ★ R6 LGG-r30 White Balance block (von Kries scale，always on，0 = 中性)
 → ★ R6 LGG-r30 Hue block (luma-preserving rotation matrix，always on，0° = 中性)
 → output
```

### Shader 數學（r30 新增）

```glsl
// White Balance（R6 LGG-r30）
if (uWBB != 0.0)
{
    vec3 wbScale = uWBB > 0.0
        ? mix(vec3(1.0), vec3(1.25, 1.00, 0.65), uWBB)   // warm（≈3000K target）
        : mix(vec3(1.0), vec3(0.85, 1.00, 1.18), -uWBB); // cool（≈9000K target）
    displayColor *= wbScale;
}

// Hue rotation（R6 LGG-r30，NTSC luma-preserving）
if (uHueB != 0.0)
{
    float h = radians(uHueB);
    float c = cos(h);
    float s = sin(h);
    mat3 hueM = mat3(
        0.299 + 0.701 * c + 0.168 * s,  0.299 - 0.299 * c - 0.328 * s,  0.299 - 0.300 * c + 1.250 * s,
        0.587 - 0.587 * c + 0.330 * s,  0.587 + 0.413 * c + 0.035 * s,  0.587 - 0.588 * c - 1.050 * s,
        0.114 - 0.114 * c - 0.497 * s,  0.114 - 0.114 * c + 0.292 * s,  0.114 + 0.886 * c - 0.203 * s
    );
    displayColor = max(hueM * displayColor, vec3(0.0));
}
```

### Uniforms 新增

```
uWBB    白平衡 -1=藍冷 ~ +1=黃暖，0=中性
uHueB   色相環旋轉角度（degrees），0=中性
```

### per-config 預設組（configPostDefaults，全域）

```
              borrow  sat   ACES%  acesSat  Lift   Gamma  Gain   WB     Hue   wall
 C1 / C2      0       1.5   1.00   0.95     0      1.5    0.80   -0.2   1     0.75
 C3           2.0     1.7   0.30   1.00     -0.1   1.5    0.90   -0.4   5     0.85
 C4           0.5     1.7   0.30   1.00     -0.1   2.0    0.90   -0.2   2     0.85
```

### stateful 切換語意

```
 第一次切進該 config → 套 configPostDefaults[config]
 切離該 config → snapshot 當前 slider 存到 configState[config]
 再切回該 config → 從 configState[config] 恢復（不丟臨時調整）
 cmd+click 任一受 config 影響的滑桿 → 跳回 configPostDefaults[config] 對應欄位
```

### A 模強制紀律（r30 同 r29）

A 模啟動時：uBorrowStrength / uWBB / uHueB / uLGGEnabled / uLGGStrength / uLGGLift / uLGGGamma / uLGGGain 強制中性 0 或 1.0。視覺等同 Reinhard 純路徑追蹤輸出。

### 命名 / 結構紀律（同 r29）

- ACES tonemap 函式名 `ACESFilmicNarkowicz`（避開 Three.js 內建 `ACESFilmicToneMapping` auto-inject）
- ACES SAT 三段 uniform 共用，A / B 各自單一 slider 同步寫入
- EXP / WB / Hue 純 display-space 後製、不觸發採樣重置（走 wakePostProcess()）
- 借光（borrow）走 wakeRender()（path tracer uniform，需重啟採樣）
- 窗外景色背板 cullable=0（不屬 X-ray 牆系剝離範疇）

---

## Backups（r30 stable，4 檔）

```
Home_Studio.html.r6lgg30-bak
js/Home_Studio.js.r6lgg30-bak
js/InitCommon.js.r6lgg30-bak
shaders/ScreenOutput_Fragment.glsl.r6lgg30-bak
```

更早備份保留：
```
*.r6lgg29-bak    暗角借光 J3 完工
*.r6lgg14-bak    ACES + EXP 甜蜜點落地時點
*.routeXa-bak    Route X v1 HDR-space exp lift（已棄）
```

---

## Verification URL history（r30）

```
?v=r6lgg30-tempTint              第一版（粗糙色彩濾鏡，已棄）
?v=r6lgg30-wbHue                  改 von Kries + NTSC hue rotation
?v=r6lgg30-wbHue-defaults         WB / Hue 預設值
?v=r6lgg30-perConfig              per-config 預設體系第一版
?v=r6lgg30-c1c2-screenshot        C1 / C2 截圖數值對齊
?v=r6lgg30-c1c2c34-decoupled      C1/C2 與 C3/C4 解耦
?v=r6lgg30-noResetOnTab           切標籤不重置使用者調整
?v=r6lgg30-stateful               stateful per-config 切換 + cmd+click 重置
?v=r6lgg30-cmdclick-perConfig     8 條 cmd+click reset 同步
?v=r6lgg30-c3c4-liftSat           C3 / C4 加 Lift -0.1、SAT 1.0
?v=r6lgg30-c4-gamma2              C4 Gamma 2、WB -0.2
?v=r6lgg30-c4-hue2                C4 Hue 5 → 2
?v=r6lgg30-window-noxray          窗外背板 cullable 1 → 0（FINAL）
```

---

## Pending user questions

無。R6 主線 DONE。

---

## Hard Rules（r30 新增、加上 r29 全表）

新增（r30）：

```
 DO NOT 把使用者要的「白平衡 / 色相」做成粗糙 R / G / B 通道乘加
   必走 von Kries chromatic adaptation（白平衡）+ NTSC luma-preserving rotation（色相）
   粗糙偏移叫「色彩濾鏡」、視覺感不同；使用者明確糾正過

 DO NOT 設「切標籤就套 per-config 預設」單向邏輯
   會丟使用者臨時調整、體感不對；必用 stateful 架構（configState snapshot / restore）

 DO NOT 把「永遠該被看見的背景物件」設 cullable >= 1
   X-ray 透視剝離只給「會擋視線的牆系幾何」，背景 / 天空貼圖 cullable=0
```

繼承 r29：

```
 DO NOT 重啟 luma-based 陰影偵測（5 條失敗）
 DO NOT 重啟 path-tracer-side ambient injection（geometric series → 牆面刷白）
 DO NOT 用 Three.js 內建名給自寫 tonemap 函式命名
 DO NOT 對 post-process slider 用 wakeRender()，必用 wakePostProcess() + reset=false
 DO NOT 對使用者用技術縮寫
 DO NOT 用 AB 否定句型
 DO NOT 在功能未驗證收斂前先做速度優化
 DO NOT 用 per-frame stochastic gate 做 spatially-variant 條件
 DO debug 前必先 isolation test 鎖根因
```

---

## Key files

```
Home_Studio.html
js/Home_Studio.js
js/InitCommon.js
js/PathTracingCommon.js              （r30 未動，r29 留下的 source-side firefly clamp）
shaders/Home_Studio_Fragment.glsl    （r30 未動，r29 留下的借光採樣邏輯）
shaders/ScreenOutput_Fragment.glsl
```

---

## Next directions

```
 [下一步] R7  採購評估（per memory「R3-8 採購評估」是下一階段）
              Home_Studio_3D 燈具採購（飛利明Varilumi 22W COB + 25W 廣角軌道燈）
              工作流程：confirm 規格 → 比價 → 訂購

 [候補]   R6-2 桶 2 #2 Russian Roulette
              使用者於本輪完工後選「留候補」路徑、不結案
              啟動條件 / 流程 / Hard Rules：.omc/HANDOFF-next-russian-roulette.md
              廠商現場若 1024 spp 30~34 秒嫌慢則啟動

 [後製其他] cmd+click 重置 範圍可擴充（slider-mult-b / slider-exp-b 也加 per-config？）
              or 加 preset 快速切換（「電影感 / 自然光 / 工作室」三種快捷）

 [視覺降噪] 主線 1 階段 2 reproject ⏸ 暫緩
              主線 1 階段 3 OIDN ⏸ 暫緩
```

---

R6 LGG 主線完工。Stand by R7。
