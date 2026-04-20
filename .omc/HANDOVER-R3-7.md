# Handover to Next Opus — R3-7 Entry Point

**Project**: Home_Studio_3D (Path Tracing audio studio 3D viz)
**Root**: `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/`
**Branch**: `r3-light` (pushed to origin, HEAD = `47512b2`)
**Verify URL**: `http://localhost:9001/Home_Studio.html` (server cwd is already project root — never prepend `Home_Studio_3D/`)
**Current cache-buster**: `r3-6-5-wide-dir-legacy-restore`
**Status**: R2-1~R2-18 + R3-0~R3-6.5 all ✅ → next stage = **R3-7 indirectMul normalization**

---

## Required reads before touching code

1. `docs/SOP/Debug_Log.md` — opening "General Debug Discipline" section (R2-14 burned three prior Claudes who skipped this)
2. `docs/SOP/R3：燈光系統.md` — R3-7 chapter
3. CC auto memory `project_home_studio_r2_13_handover.md` — implementation details, quirks, C3 warning

---

## R3-7 critical fragility (architect-flagged, deferred from R3-6.5)

In `shaders/Home_Studio_Fragment.glsl`, `sampleStochasticLightDynamic` computes
`1.0 / float(uActiveLightCount)` — this becomes `inf` when `N == 0`.
Currently protected by **three external gates**:
  - routing gate `uR3DynamicPoolEnabled`
  - JS-side checkbox `.disable()`
  - `applyPanelConfig` forces `N ≥ 1`

If R3-7 modifies `pdfNeeForLight` or introduces new sampling paths, **verify these
gates still hold**. Otherwise add an internal guard inside the helper:

```glsl
if (uActiveLightCount < 1) return vec3(0);
```

---

## User preferences (strict)

- **100% Traditional Chinese** in replies. No Simplified Chinese, no mainland-China terminology.
- **No abbreviations when addressing the user** — user is a music producer without software/graphics background. Write full English + plain Chinese gloss for all technical terms (MIS, NEE, BSDF, GLSL, etc.). Code / commits / internal tech docs may retain abbreviations.
- **caveman / normal auto-split**: use caveman register for tool-call narration (token saving), switch to normal plain Chinese for progress reports / error explanations / Q&A / user-visible acceptance guidance.
- **"R? DONE" trigger**: when user says `R3-7 DONE`, auto-execute 4 steps without re-confirming: update SOP dual checkmark → update Debug_Log → update handover memory → `git push`.
- **Per-stage OMC tool proposal**: before starting any R3-N sub-stage, proactively list suggested OMC tool (`/ralplan --deliberate`, `/ultrawork`, `/ralph`, etc.) with one-line reasoning, wait for user approval.

---

## Standing by

Read the three files above, then await user instruction.
