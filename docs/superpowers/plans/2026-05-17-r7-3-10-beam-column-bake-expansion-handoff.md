# R7-3.10 Beam / Column Bake Expansion Handoff

日期：2026-05-17
狀態：下一階段樑柱烘焙入口文件
目前分支：`codex/r7-3-10-beam-column-bake-expansion`
基準 main：`2d79953 fix(R7-3.10): clean south reveal and floor side seams`

---

## 目前基準

```text
1.  `main` 已合併並推送到 GitHub：
    2d79953 fix(R7-3.10): clean south reveal and floor side seams

2.  已完成並驗收：
    - floor 1024 bake
    - north wall 1024 bake
    - east wall 1024 bake
    - west wall 1024 bake
    - south wall + window reveal 1024 bake
    - ceiling 1024 bake

3.  UI 現況：
    - 地板烘焙：預設開
    - 北牆烘焙：預設開
    - 東牆烘焙：預設開
    - 西牆烘焙：預設開
    - 南牆烘焙：預設開
    - 天花板烘焙：預設開

4.  已修正並由使用者肉眼確認：
    - 南牆窗洞上緣與右側 reveal 黑線已消失。
    - 東西牆與地板近距離接縫黑線已消失。
```

## 重要護欄

```text
1.  不回 fallback。
2.  不改鄰格取樣。
3.  不破壞已驗收的 floor / north / east / west / south / ceiling 1024 bake。
4.  bake capture 時不得吃 runtime bake：
    - Option A uniform snapshot 保留。
    - Option B captureMode guard 保留。
5.  反射維持 LIVE path tracing。
6.  目前任務只準備樑柱烘焙；家具、吸音板、插座、門片等細項不要一起塞進來。
```

## 下一步任務

```text
1.  先 inventory 場景裡所有樑柱相關 static geometry：
    - 天花板樑
    - 角柱
    - 牆邊柱
    - 其他屬於房間結構的 box

2.  規劃樑柱 bake target：
    - 建議先做單一 structural-beams-columns package。
    - runtime atlas 新增 slot 6。
    - UI 新增「樑柱烘焙」按鈕，預設開。

3.  先寫 contract / runner 檢查：
    - 六面全開仍通過。
    - 樑柱開關不影響既有六面。
    - 樑柱關閉時回 LIVE。
    - bake capture uniform snapshot 仍為 0。

4.  再實作 shader bake target 與 runtime short-circuit。

5.  最後烘 1024 / 1000spp，正式 package 放：
    assets/bakes/r7-3-10/c1-static-diffuse/
```

## 必讀

```text
1.  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log_Index.md
2.  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md
3.  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/superpowers/plans/2026-05-16-r7-3-10-static-diffuse-bake-expansion-investigation-opus.md
```

## 最新驗證

```text
1.  node --check js/InitCommon.js
2.  node --check js/Home_Studio.js
3.  node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
4.  node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
5.  git diff --check
6.  node docs/tools/r7-3-8-c1-bake-capture-runner.mjs --r7310-runtime-short-circuit-test --samples=1 --target-samples=1 --atlas-resolution=1024 --timeout-ms=180000 --http-port=9002 --cdp-port=9223 --angle=metal
```
