# Home_Studio_3D — Project Instructions
<!-- 音響工作室 3D Path Tracing 視覺化專案 -->

Always reply to the user in Traditional Chinese. Never use Simplified Chinese or mainland-Chinese terms.
<!-- 必 100% 繁體中文，嚴禁簡體與中國用語 -->

Never abbreviate when replying to the user. User is a music producer without software/graphics background. All abbreviations (AC, MIS, NEE, BSDF, PDF, GLSL, DCE, ADR, cone-leak, firefly, spp, etc.) must be written as "full English (plain Chinese explanation)". Code / commits / internal technical docs may retain abbreviations.
<!-- 使用者為音樂製作人、無工程背景。對使用者嚴禁簡寫，必須「完整英文（白話中文）」；只有 code / commit / 技術文件可保留縮寫 -->

---

## Git Workflow
<!-- Git 分支工作流程 -->

- `main`: frozen at tag `v2.18-final` (R2 complete stable version)
- `r3-light`: R3 work branch (currently active)
- Before editing: `git checkout r3-light`. Editing main pollutes the stable version.
- After R3 accepted: merge `r3-light → main`, tag `v3.0-final`.

## Local Development Server
<!-- 本地開發伺服器 -->

- Project dir: `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/`
- Start: `python3 -m http.server 9001` (run from project dir)
- URL: `http://localhost:9001/Home_Studio.html` — no `Home_Studio_3D/` prefix; server cwd is already inside the project
- GitHub Pages: `https://ghnewbie2022.github.io/Home_Studio_3D/Home_Studio.html`
- Current cache-buster: inline in `Home_Studio.html` script tag — never copy from memory, always read the file
<!-- 網址勿加資料夾前綴；cache-buster 勿憑記憶複製 -->

Before any work: curl or open browser to confirm 200 OK.

## Required Reading Order (do not skip)
<!-- 必讀順序，不得跳過 -->

1. `docs/SOP/R0：全景地圖.md` — 30-second overview of current R-stage progress
2. `docs/SOP/Debug_Log.md` — read ONLY the opening chapter "通用 Debug 紀律" (L1–L45). Rest is fix-history, use as grep index on demand.
3. `docs/SOP/R?：...md` — current R-stage playbook. Read ONLY the active sub-phase and its immediate predecessor for context. Completed sub-phases are on-demand.
4. Claude Code only: auto-memory `project_home_studio_r2_13_handover.md` (R2 implementation decisions, specs, pitfalls; auto-loaded if present)
5. Active phase task handover (if exists): `.omc/plans/<Phase>.handover-next-opus.md`
<!-- Debug_Log 只讀開頭紀律段；R3 SOP 只讀當前 active 階段 + 前一段；其餘歷史 grep-on-demand -->

None of the above may be skipped before editing code.

## Universal Debug Discipline (R2-14 three-crash lesson)
<!-- 通用 Debug 紀律，R2-14 連續翻車三次血淚規則 -->

### Rule 1: Before reusing a material type, Read the full branch in shader
<!-- 複用既有 material type 前必先 Read 該 type 在 shader 中完整分支 -->

Each `if (hitType == X)` branch in shader may contain size conditions, UV patterns, texture mapping that depend on geometry. Reusing by "looks white diffuse" hits landmines.

- Forbidden: reuse by visual appearance ("looks white", "looks metallic")
- Required: Read the complete `if (hitType == X) { ... }` block, verify every branch line is safe for the new object's halfSize / normal / UV

### Rule 2: Material type names must be object-semantic, not material-characteristic
<!-- 命名必須為物件語義，不可為材質特徵 -->

- Correct: `OUTLET`, `TRACK`, `SPEAKER`, `LAMP_SHELL`
- Wrong: `WHITE_DIFF`, `SHINY`, `DARK_BOX`

Semantic naming gives reviewers a defense line: if a plan says "tag track-box as OUTLET", the semantic mismatch is obvious. Characteristic naming removes this defense and cross-class pollution follows.

### Rule 3: When debugging an artifact, first Read the hitType branch of the affected object
<!-- 診斷 artifact 時第一步讀受影響物件之 hitType 分支 -->

Diagnosis order (enforced):

1. Locate artifact's box index and hitType
2. Read the complete hitType branch in shader
3. Check line-by-line whether branch logic produces the artifact for this box's halfSize / normal / UV
4. Only after branch logic is ruled out, jump to geometry / BVH / shadow / NEE hypotheses

Forbidden: jumping to "geometry conflict", "shadow self-occlusion", "BVH error" hypotheses without reading the material branch first. R2-14 fix03 and fix04 both violated this rule, each wasted hours.

### Verification Discipline
<!-- 驗證紀律 -->

Before declaring a fix successful:
- Cam 1, Cam 2, Cam 3 each at least 500 samples per pixel
- Screenshot per camera
- Below this threshold: no completion claim

R2-14 fix04 was prematurely declared successful at Cam 1 17 samples when it looked clean; Cam 3 876 samples later exposed the real bug, leaving poisoned memory. Counter-example on record.

## Cross-Phase Hard Rules
<!-- 跨階段強制規則 -->

### K-method thinking (Karpathy, ask before coding)
<!-- K 神思考方式，動手前必問 -->

1. State your assumption explicitly.
2. Is this "framework missing" or "content empty"?
   - Framework broken (black screen) → fix framework first
   - Framework normal but content empty → fill content
   - Might need in future → wait until needed (validation-driven)
3. Is this the minimum code? If not, simplify.

Do not assume the framework is missing something; verify before acting.

### Skill triggers (Claude Code only)
<!-- Claude Code 限定 skill 觸發 -->

- Planning SOP → load `karpathy-guidelines` skill
- Debug → run `/systematic-debugging` first; do not propose fixes before root cause is identified
- Debug complete → write symptom / root cause / fix into `docs/SOP/Debug_Log.md`

### "R? DONE" four-step sequence
<!-- R 幾 DONE 四步驟，任一步未完不得回報 DONE -->

When user declares "R? DONE", execute in order:

1. Update `docs/SOP/R?：...md` — add ✅ to BOTH the outline table row AND the `### ` section header (dual-checkmark rule, see below)
2. Update `docs/SOP/R0：全景地圖.md` stage status
3. Claude Code only: update handover memory at `~/.claude/projects/-Users-eajrockmacmini-Documents-Claude-Code/memory/project_home_studio_r2_13_handover.md`
4. `git commit + push` to current branch (r3-light for R3). Commit title format: `R3-N DONE：<title>（<key technical point>）`

If interrupted mid-sequence by system signal (UserPromptSubmit hook, skill ARGUMENTS, date-change reminder, new task assignment): report "R?-? DONE 尚差第 N 步未收尾" first, get user direction, do not silently switch tasks.

### SOP dual-checkmark rule
<!-- SOP 打勾雙標規則 -->

- Stage complete: add ✅ to BOTH the outline table row AND the internal `### ` section header
- Stage demoted (e.g. hallucination incident): remove ✅ from both simultaneously
- Modifying only one causes ambiguous state

### Acceptance URL format
<!-- 驗收網址格式 -->

When asking user for visual acceptance:

- URL: `http://localhost:9001/Home_Studio.html?v=<fix-suffix-as-changelog>`
- Query changed vs. previous request: do not mention hard reload (browser refetches automatically)
- Query unchanged: append `Cmd+Shift+R 硬重載` on the next line (separate line, never inline)

### R-stage × OMC tool mapping
<!-- R 階段與 OMC 工具對照 -->

Pick tool by phase characteristics; do not apply one skill throughout.

| Stage | Nature | Recommended tool |
|-------|--------|------------------|
| R3-0 | Magic number extraction, single file, single constant → uniform | Direct edit, no skill |
| R3-1 / R3-2 | Math function with boundary sensitivity (lumens→radiance, CCT→RGB) | `/ralplan` for Planner+Architect+Critic consensus |
| R3-3 / R3-4 | Emissive + radiometric units; spot cone NEE | `/ralplan` then `/ultrawork` |
| R3-5a | Reuse R3-4 pattern, low risk | Direct edit |
| R3-5b | Area sampling NEE original, hardest block of R3 | `/ralplan` then `/ultrawork`; repeated failure → `/ralph` |
| R3-6 | Many-Light + Multiple Importance Sampling integration | `/ralplan` then `/ultrawork`; repeated failure → `/ralph` |
| R3-6.5 (planned) | Dynamic NEE pool size (changes probability density function) | `/ralplan --deliberate` (high risk) |
| R3-7 | indirectMul calibration | Direct edit with side-by-side screenshots |
| R3-8 | Procurement acceptance (4 scenarios, user tests personally) | Direct edit; fix bugs only |
| R4-1 | HTML skeleton + CSS + createS + DOM adapters; drop lil-gui; InitCommon.js rework | `/ultrawork` or `/ralph` (multi-file atomic switch) |
| R4-2 | 12-point shader branch flattening + dead code deletion | `/ultrawork` or `/ralph` (step-by-step compile verification) |
| R4-3 | Wire CONFIG/A-B/color-temp/lumens/GIK controls | `/ultrawork` or `/ralph` |
| R4-4 | Sweet-spot sliders (Track 5 + Wide 5); photometric beam model; BVH debounce | `/ralplan` if model decision changes, otherwise `/ultrawork` or `/ralph` |
| R4-5 | Interaction polish (fold defaults, Cam, Help, Hide, snapshot, loading) | Direct edit |

`/team` does NOT fit R3 or R4: each phase has dependency chain, parallel is unsafe. `/team` fits mass-parallel independent file refactors.

## Document Boundaries
<!-- 文件邊界，避免重複 -->

| Need | Look here |
|------|-----------|
| R-stage current progress | `docs/SOP/R0：全景地圖.md` |
| Universal debug discipline + fix history | `docs/SOP/Debug_Log.md` (opening only, rest grep-on-demand) |
| Specific R-stage playbook | `docs/SOP/R?：...md` |
| R2 implementation / pitfalls / specs | Claude Code auto-memory `project_home_studio_r2_13_handover.md` |
| Lighting product specs | `docs/R3_燈具產品規格.md` |
| Room 2D top-down SVG | `docs/Home Studio 2D俯視圖 SVG.md` |
| Cross-phase rules / process | This CLAUDE.md file |
| Active phase task handover | `.omc/plans/<Phase>.handover-next-opus.md` |

This CLAUDE.md file does NOT contain: R-stage-specific details, cache-buster strings, commit hash lists, technical specs. Those live in the files above and would rot if duplicated here.
