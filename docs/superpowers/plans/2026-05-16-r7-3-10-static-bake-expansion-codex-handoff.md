# R7-3.10 Static Bake Expansion CODEX Handoff

日期：2026-05-16
狀態：給下一棒 CODEX 的入口文件
前一棒來源：OPUS read-only 調查草案

完整詳版請讀：

`/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/superpowers/plans/2026-05-16-r7-3-10-static-diffuse-bake-expansion-investigation-opus.md`

---

## 目前狀態

```text
0.  2026-05-16 CODEX 已完成 east wall 第一批 runtime 接入。
    目前 floor / north / east runtime pointer 都是 1024。
    east 1024 package:
    .omc/r7-3-10-full-room-diffuse-bake/20260516-123227/

1.  codex/r7-3-10-integration 目前暫停作為本機整合保存分支。
    不開 PR。
    不做 history rewrite。
    不直接追加新任務 commit。

2.  CODEX step A 已完成。
    commit: c05092a chore(R7-3.10): stop tracking generated bake artifacts
    OPUS 已審查通過。

3.  R7-3.10 floor / north 1024 bake 已驗收。
    東北衣櫃頂部北側黑線消失。
    東北衣櫃底部南側黑線消失。

4.  C runtime fallback 已移除。
    後續不可回頭使用 fallback 或鄰格取樣作為修法。

5.  bake capture 防污染已由 Option A / Option B 封住。
    Option A: capture 時紀錄 runtime short-circuit uniform snapshot。
    Option B: bake capture mode 時 r7310C1FullRoomDiffuseShortCircuit 直接 return false。

6.  2026-05-16 hotfix 已處理：
    - 舊 east package .omc/r7-3-10-full-room-diffuse-bake/20260516-092150/ 全黑。
    - east pointer 已改指 .omc/r7-3-10-full-room-diffuse-bake/20260516-123227/。
    - runtime baked diffuse short-circuit 已限制為 bounces == 0。
    - LIVE 反彈維持 LIVE path tracing，不再把 baked diffuse 當成二次反彈光源。
    - cache buster 已更新為 r7310-static-east-hotfix-v2。
```

## 2026-05-16 CODEX 實作結果

```text
1.  分支：
    codex/r7-3-10-static-bake-expansion

2.  實作：
    - east wall 新增 uR7310C1EastWallDiffuseMode。
    - runtime 合併 atlas 改為三格：
      slot 0 floor
      slot 1 north wall
      slot 2 east wall
    - UI 改為三顆獨立開關：
      地板烘焙
      北牆烘焙
      東牆烘焙
    - east wall pointer 指到 1024 package。
    - floor / north 1024 pointer 保持原本位置。

3.  套件：
    - floor:
      .omc/r7-3-10-full-room-diffuse-bake/20260515-215727/
    - north:
      .omc/r7-3-10-full-room-diffuse-bake/20260515-212509/
    - east:
      .omc/r7-3-10-full-room-diffuse-bake/20260516-123227/

4.  驗證：
    - contract pass:
      node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
    - syntax pass:
      node --check js/InitCommon.js
      node --check js/Home_Studio.js
      node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
    - UI toggle pass:
      .omc/r7-3-10-full-room-diffuse-ui-toggle/20260516-092254/
    - east runtime pass:
      eastWallSurfaceHitCount=699773
      eastWallShortCircuitCount=699773
      .omc/r7-3-10-full-room-diffuse-runtime/20260516-123701/
    - floor runtime regression pass:
      bakedSurfaceHitCount=96170
      bakedSurfaceShortCircuitCount=95909
      .omc/r7-3-10-full-room-diffuse-runtime/20260516-123351/
    - north runtime regression pass:
      northWallSurfaceHitCount=528987
      northWallShortCircuitCount=480847
      .omc/r7-3-10-full-room-diffuse-runtime/20260516-123353/
    - UI toggle pass:
      .omc/r7-3-10-full-room-diffuse-ui-toggle/20260516-123411/

5.  下一步：
    先請使用者同視角看 floor / north / east hybrid room。
    east 接受後再擴到 west / south / ceiling。
```

---

## 亮差根因共識

目前共識來自 OPUS read-only 調查與既有 consensus 文件。

```text
1.  R7-3.10 runtime 在 shader 內命中已烘焙面時，會執行：
    accumCol += mask * r7310BakedRadiance;
    break;

2.  原先 LIVE 光線先走 k 段抵達烘焙面。
    烘焙值本身已包含從該面繼續算出的漫射結果。
    兩段接起來後，partial bake 狀態會出現有效反彈深度相加。

3.  使用者觀察吻合：
    只開 floor bake 時，north LIVE 會偏亮。
    floor / north 都 bake 時，north 自身會回到正常。
    floor / north bake 開啟時，仍是 LIVE 的櫃子可能偏亮。

4.  2026-05-16 CODEX hotfix：
    r7310C1FullRoomDiffuseShortCircuit 只在 bounces == 0 執行。
    primary camera hit 仍顯示 bake。
    secondary / LIVE 反彈維持 LIVE path tracing。

5.  partial bake 過渡狀態仍可用來診斷，但正式驗收基準應改成：
    全相關靜態漫射面 bake vs 全 LIVE。
```

---

## 下一棒第一步

下一棒如果要改檔，先開新分支：

`codex/r7-3-10-static-bake-expansion`

```text
1.  從目前 repo 狀態開新工作分支。
    不直接改 codex/r7-3-10-integration。

2.  先讀本檔。

3.  再讀 OPUS 詳版：
    docs/superpowers/plans/2026-05-16-r7-3-10-static-diffuse-bake-expansion-investigation-opus.md

4.  接著查證 OPUS 詳版第 6 節列出的 7 項待確認事項。

5.  查證完成後，先寫下一階段實作計畫。
    實作計畫才開始動 code / MD / pointer。
```

---

## 候選烘焙面

下一階段目標是把「會影響室內漫射光、又是靜態漫射」的面逐步納入 bake。

```text
已完成：
1.  floor
2.  north wall
3.  east wall

第二批候選：
1.  west wall
2.  south wall
3.  ceiling

後續條件候選：
1.  大型靜態家具
2.  梁
3.  角柱

排除：
1.  門
2.  窗外景
3.  喇叭
4.  插座
5.  軌道
6.  Cloud 板與燈條
7.  金屬鋁框
8.  GIK CONFIG 切換面板
```

---

## 建議擴張順序

```text
1.  East wall
    先利用既有 east wall scaffold 驗證新一輪流程。

2.  West wall / South wall
    照 east wall 樣板建立 surface predicate、UV、capture、runtime loader。

3.  Ceiling
    純漫射面，但需留意 Cloud / track / ceiling fixture 的互動與排除規則。

4.  大型靜態家具
    需依 objectID 或專屬 predicate 逐一處理。

5.  梁與角柱
    面積較小，且與牆面 UV / cull 規則交錯，放後面。
```

---

## 驗收原則

```text
1.  partial bake 畫面只作診斷。
    它可以暴露哪些 LIVE / bake 交界還沒收完。

2.  正式驗收要比較：
    全相關靜態漫射面 bake
    vs
    全 LIVE

3.  每批新增 bake 面都要單獨驗收。
    不一次全開，避免 debug 困難。

4.  每批至少驗：
    - bake package 是否 1000 SPP
    - pointer 是否指到正確 package
    - short-circuit hit / short-circuit count 是否 > 0
    - 使用者同視角肉眼驗收
    - 既有 floor / north 1024 黑線修復不能退化

5.  驗收網址要先查實際 server port。
    目前常用網址是：
    http://localhost:9002/Home_Studio.html
```

---

## 明確禁區

```text
1.  不回 C runtime fallback。
2.  不改鄰格取樣。
3.  不破壞 floor / north 1024 bake 成果。
4.  不回退 Option A / Option B 防污染保護。
5.  不回退 H7 / H7' guard。
6.  不碰 codex/r7-3-10-integration 的 Git 收尾。
7.  不直接改 R7-3.8 accepted 嫩芽基準包。
8.  不把 partial bake 偏亮當成最終拒收理由。
```

---

## 下一棒必讀路徑

```text
1.  本入口文件：
    /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/superpowers/plans/2026-05-16-r7-3-10-static-bake-expansion-codex-handoff.md

2.  OPUS 詳版調查：
    /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/superpowers/plans/2026-05-16-r7-3-10-static-diffuse-bake-expansion-investigation-opus.md

3.  1024 bake resolution 計畫：
    /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/superpowers/plans/2026-05-15-r7-3-10-c1-1024-bake-resolution-plan.md

4.  R7-3.10 phase 2 CODEX 主檔：
    /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md

5.  最新 Debug Log：
    /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md
```

---

## 給下一棒的直接指令

```text
你是下一棒 CODEX。

請先讀：
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/superpowers/plans/2026-05-16-r7-3-10-static-bake-expansion-codex-handoff.md

再讀 OPUS 詳版：
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/superpowers/plans/2026-05-16-r7-3-10-static-diffuse-bake-expansion-investigation-opus.md

目前 codex/r7-3-10-integration 只作本機整合保存。
不要在該分支直接追加新任務 commit。

若要改 code / MD / pointer，先從目前狀態開：
codex/r7-3-10-static-bake-expansion

任務目標：
規劃並實作 R7-3.10 下一階段全相關靜態漫射面烘焙。
先從 east wall 開始，逐批擴張到 west / south / ceiling。

禁止：
不回 fallback。
不改鄰格取樣。
不破壞 floor / north 1024 bake。
不把 partial bake 偏亮當成最終拒收理由。
```
