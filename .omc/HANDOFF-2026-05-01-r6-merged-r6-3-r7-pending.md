# Handoff — 2026-05-01 R6 合併 main、R6-3 + R7 SOP 大綱落地

> Date: 2026-05-01
> Status: R6 LGG-r30 完工進度已合併 main 並推到 GitHub；r3-light 工作分支本機 + 遠端均刪除；R6-3 視覺收斂優化 SOP 大綱寫好待啟動；R7 採樣演算法升級 SOP 大綱寫好作未來展望。
> 接手第一棒：本檔即入口、其餘必讀清單見 §Required Reading。

---

## TL;DR — 一句話現況

```
R6 主線 1 LGG ✅ 完工、main 已同步
R6 主線 2 BVH ⏸ 留候補
R6 主線 3 視覺收斂優化 ⏳ 規劃中（針對 C3/C4 移動初期底噪過大、目標 30~60 秒收乾淨）
R7 採樣演算法升級 ⏳ 未來展望（觸發條件：R6-3 達不到目標時啟動）
燈具採購使用者自理、不在 AI 介入範圍
```

---

## 真痛點（使用者重新定義、2026-05-01）

```
痛點    C3 / C4 切換後初期底噪過大、收斂太慢
        C1 / C2 切換後尚可、屬可接受
目標    C3 / C4 從 0 spp 開始、30~60 秒內收到「肉眼可接受」程度

常見誤解（請避免重蹈）
  ❌ 誤解：使用者偏好固定機位 C1~C4、所以時序累積技術用不上
  ✅ 實情：使用者「被迫」固定機位、原因正是「移動 / 切換時雜點過大、看不下去」
          → 時序累積 / 重投影類技術正好打中痛點、不是用不上

C3 / C4 與 C1 / C2 場景差異
  C3    4 條 Cloud 燈條啟動（4-rod 多光源）
  C4    C3 + 軌道 6 燈全開（總共 10 個光源）
  C1/C2 光源數較少
  → 多光源變異是 C3/C4 主嫌之一、Phase 0 盤點要先確認瓶頸
```

---

## Git 部署狀態

```
分支結構（2026-05-01 整理後）
  main                 = bf6f60c（R6 LGG-r30 final + 主線 2 留候補）
  origin/main          已同步、與 main 一致
  r3-light             已刪除（本機 + GitHub 遠端）
  r5-panel-config5     R5 撤回時保留的實驗 archive worktree、不動
  claude/* 分支        oh-my-claudecode 自動分支、不動

下一階段分支策略
  從 main 開新工作分支、依「R 主線 DONE 才合 main + push」紀律執行
  R6-3 啟動時建議從 main 開 r6-3-profile 分支（先做 Phase 0 盤點）
```

---

## R6 三主線最新總表

```
主線 1（後製調色）
  階段 1     5×5 雙邊濾波      ❌ WITHDRAWN 2026-04-26（物理上限、blur 不是 denoise）
  階段 1.5   LGG / ACES / WB / Hue 後製調色   ✅ 完工 2026-05-01（r6lgg14 / r6lgg29 / r6lgg30）
  階段 2     reproject + path guiding   ⏸ 暫緩、可被 R6-3 階段 3 吸收
  階段 3     OIDN AI 降噪              ⏸ 暫緩、可被 R6-3 階段 4 吸收

主線 2（BVH 加速）
  Phase 1.0  現況盤點          ✅ 完工 2026-04-27
  Phase 1.5  SAH builder      ❌ -39% 回滾
  Phase 1.5  leaf packing     ❌ ≤ 1% 收益 fail-fast
  桶 4 F1    C3 frame-skip     ✅ 結案 2026-04-27（暫態 RAF cadence、不修）
  桶 4 F2    三段 timer        ❌ probe overhead ≥ 1.24% fail-fast
  桶 2 #2    Russian Roulette  ⏳ ralplan v2 APPROVE、待啟動但優先序低
                                   廠商現場若 1024 spp 30~34 秒嫌慢才考慮啟動
                                   不解 R6-3 痛點（會增加 variance）
  整體       ⏸ 留候補、不結案

主線 3（視覺收斂優化、新加 2026-05-01）
  Phase 0    收斂瓶頸盤點      ⏳ 待啟動（接手第一刀）
  階段 1     依 Phase 0 路由   ⏳
  階段 2     SVGF（時空變異引導濾波）       ⏳
  階段 3     reproject + path guiding      ⏳
  階段 4     OIDN 重評（社群 web port）     ⏳
```

---

## 接手第一刀建議

```
第一刀    R6-3 Phase 0 收斂瓶頸盤點（1~3 hr、零風險）
          動作：Brave DevTools GPU profile + 量 C3/C4 vs C1/C2 各段時間
          產出：盤點報告、決定走 SVGF / reproject / OIDN 哪條

第二刀    依 Phase 0 結果決定 R6-3 階段 1 路由
          A. 多光源變異   → 階段 2 SVGF
          B. 反射端變異   → 階段 3 reproject + path guiding
          C. 後處理可救   → 階段 4 OIDN 重評
          複合           → 多條同跑

第三刀    若 R6-3 全段達不到 30~60 秒目標、跳 R7 採樣演算法升級
          詳見 docs/SOP/R7：採樣演算法升級.md

候補      R6-2 桶 2 #2 Russian Roulette
          ralplan v2 已 APPROVE、可直接 executor
          但對 R6-3 痛點是反方向（會增加 variance）、不推薦先做
          僅在「廠商現場真的嫌 30~34 秒太慢」時啟動
```

---

## Required Reading（接手必讀清單、依序讀）

```
1. 本檔（你正在讀的這份）

2. R6-3 + R7 兩份 SOP（最新規劃文件）
   /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R6：渲染優化.md
   /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R7：採樣演算法升級.md

3. R6 主線 1 LGG-r30 完工狀態（程式碼現況基準）
   /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-r30-final.md
   裡面有 Required prior reading 清單、依其指示繼續往下讀（含 Debug_Log 章節「R6-LGG-r30」/「R6-LGG-J3」+ LESSONS-R6-shadow-lift-failures.md）

4. R6 主線 2 BVH 加速四連敗 + 桶 2 #2 Russian Roulette 候補
   /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOVER-R6-2.md
   /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-next-russian-roulette.md
   裡面有完整的「啟動前必讀」清單

5. Debug 通用紀律（任何 R 階段動工前必讀）
   /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md
   開頭三條規則
```

---

## Hard Rules（給接手 AI）

```
DO    Phase 0 盤點之前嚴禁動 shader（避免 R6-1 / R6-2 不盤點直接做的覆轍）
DO    任何 R6-3 / R7 子階段啟動前先確認使用者裁示
DO    對使用者一律白話 + 全英文展開技術縮寫（NEE / MIS / BSDF / PDF / SVGF 等）
DO    對使用者一律繁體中文、禁簡體 / 中國用語 / AB 否定句型
DO    R 主線 DONE 才合 main + push、子階段完工僅本地 commit
DO    引用 plan 內任何具體函式 / 檔案行數前先驗證仍存在（程式碼可能已改）

DON'T 把 R6-1 撤回的「物理上限」結論套到 R6-3 上
      R6-1 撤回是因為「純空間雙邊濾波是 blur 不是 denoise」
      R6-3 的 SVGF / reproject / OIDN 機制完全不同、教訓不適用
DON'T 把 R6-2 桶 2 #2 Russian Roulette 當 R6-3 痛點的解
      RR 會增加 variance（教科書結論）、痛點是「初期雜點過大」、方向相反
DON'T 自動跳到 R7 採樣演算法升級
      R7 屬論文級工程、必先窮盡 R6-3 全段、確認達不到目標才啟動
DON'T 推使用者做飛利明Varilumi 燈具採購
      型號已選定、屬硬體決策、不需 AI 介入
DON'T 對 r5-panel-config5 worktree 動任何修改
      R5 撤回保留的歷史 archive、不動

DON'T 動工前不報 OMC 工具建議
      接 R6-3 Phase 0 性質 = 盤點性質、屬「依賴鏈循序、需肉眼驗收」、建議走
      /oh-my-claudecode:plan 或直接 executor、不必 ralplan
      R7 採樣演算法升級任一子階段啟動 = 必走 /oh-my-claudecode:ralplan 共識
```

---

## 檔案位置快取（避免重複 grep）

```
專案根目錄    /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/
shader      shaders/Home_Studio_Fragment.glsl
            shaders/ScreenOutput_Fragment.glsl
JS          js/Home_Studio.js
            js/InitCommon.js
            js/PathTracingCommon.js
HTML        Home_Studio.html
SOP 主目錄    docs/SOP/
            ├ R6：渲染優化.md（主線 1/2/3 + 整體順序）
            ├ R7：採樣演算法升級.md（未來展望）
            ├ Debug_Log.md（通用紀律 + 各 R 階段詳細紀錄）
            └ R5：Cloud光源重構.md（撤回紀錄）
.omc 目錄    .omc/HANDOFF-*.md / HANDOVER-*.md / REPORT-*.md / plans/

server      python3 -m http.server 9001（cwd=Home_Studio_3D/）
URL         http://localhost:9001/Home_Studio.html
            （注意：URL 不含資料夾前綴、加前綴會 404）
browser     使用者日常用 Brave、Playwright 若能指 executablePath 優先 Brave
```

---

## Pending User Questions

無。R6 階段已合併、R6-3 + R7 SOP 大綱落地、等使用者裁示是否啟動 R6-3 Phase 0。

---

R6 主線完工合併。Stand by R6-3 Phase 0 啟動指令。
