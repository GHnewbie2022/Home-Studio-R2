# 交接入口（跨 AI 通用）

本檔為跨 AI 接棒入口，**不再承載跨階段規則實作**。所有跨階段規則（Git / 本地 server / 必讀順序 / Debug 紀律 / K 神思考 / R? DONE 四步 / SOP 雙標 / 驗收網址 / R 階段 × OMC 工具對照 / 文件邊界）均已搬入專案根 `CLAUDE.md`。

---

## 三種 AI 的入口差異

```
Claude Code（CC）
  根 CLAUDE.md 於 session start 自動注入
  → 直接執行任務；若任務牽涉特定 R 階段，再補讀對應 SOP

OpenCode（OC）／ Gemini CLI（GC）
  無 CLAUDE.md 自動載入機制
  → 人工讀取 /Home_Studio_3D/CLAUDE.md 後，再依該檔「必讀順序」段落讀 SOP
```

CC 不需讀本檔；OC/GC 讀完本檔後立刻跳至 `CLAUDE.md`。

---

## 僅存於本檔的內容：R3-5 拆分緣由（歷史脈絡）

R3-3 時 Cloud 漫射燈條僅做自發光幾何與 radiometric 量綱，area sampling NEE 刻意延後，致「燈管自發光但不照亮場景」之已知缺陷。原 R3-5 併包廣角燈 + Cloud NEE 補漏 + Many-Light + MIS 四件於單階段，風險過度集中。

依工程難度拆為：
- R3-5a（廣角，複用 R3-4 pattern，★★）
- R3-5b（Cloud NEE area sampling，★★★★，R3 最硬）
- R3-6（Many-Light + MIS 整合，★★★）
- R3-7（indirectMul 歸一）
- R3-8（採購驗收）

此段落為歷史決策記錄，不屬跨階段規則，故保留於本檔。

---

## 文件邊界

| 內容 | 位置 |
|------|------|
| 跨階段規則 / 流程 / 必讀順序 | `CLAUDE.md`（專案根，CC 自動注入） |
| R 階段當前進度總表 | `docs/SOP/（先讀大綱.md` |
| 通用 Debug 紀律 + fix 紀錄 | `docs/SOP/Debug_Log.md`（開頭紀律段必讀） |
| 某 R 階段工作手冊 | `docs/SOP/R?：...md` |
| R2 實作細節 / 踩雷 / 規格 | CC auto-memory `project_home_studio_r2_13_handover.md` |
| 燈具產品規格 | `docs/R3_燈具產品規格.md` |
| 房間 2D 俯視圖 | `docs/Home Studio 2D俯視圖 SVG.md` |
| 當下任務交接 | `.omc/plans/<Phase>.handover-next-opus.md` |

本檔**不寫**：R 階段細節、cache-buster 字串、commit hash、技術規格、跨階段規則實作。過期資訊比沒有資訊更危險。
