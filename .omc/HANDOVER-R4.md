# Handover: R3-7 DONE → R4 entry

**Branch**: `r3-light`
**Status**: R3-0 ~ R3-7 ✅. R3-8 and R5 are slated for deletion.
**Next goal**: Expand R4 (UI control layer — 1:1 old-project UI replication).

---

## Pending steps (approved plan, not yet executed)

### Step 1 — House-cleaning

1. Delete `docs/SOP/R5：完整功能.md` (all items done, moved, or dropped).
2. Remove R3-8 chapter from `docs/SOP/R3：燈光系統.md` (chapter body + outline L77).
3. Update `docs/SOP/（先讀大綱.md`: drop R3-8 and R5 rows; rename R4 to "UI控制層（舊專案 1:1 復刻）".
4. Rewrite `docs/SOP/R4：UI控制層.md` from its 8-line outline into R4-0 ~ R4-5 skeleton (phase name + one-line goal, no full detail).
5. `git commit + push` on `r3-light`.

### Step 2 — Old-project UI inventory

1. Read the old project's GUI: `Home_Studio_3D_OLD/THREE.js-PathTracing-Renderer-gh-pages/.../Path Tracking*.html` and its paired JS files.
2. Produce a table for R4-0: every old folder / control / label / CSS trait, plus an integration-strategy column for the new R3 controls that must coexist.
3. Write the result into the R4-0 section of `docs/SOP/R4：UI控制層.md`.
4. `git commit + push`.

### Step 3 — Full R4 sub-phase SOP expansion (DEFER)

Defer until user's weekly token budget resets (user at ~10% this week, resets Friday). When ready, use `/ralplan` for consensus — integration strategy has risk surface.

---

## R4 sub-phase skeleton

| Phase | Goal |
|---|---|
| R4-0 | Old-UI inventory + integration strategy for new R3 controls |
| R4-1 | UI skeleton replication (lil-gui folder / CSS / naming matching old project) |
| R4-2 | Scaffold removal — strip R3-6 MIS checkbox + R3-6.5 dynamic-pool checkbox / N-display; hardcode `uR3MisEnabled = 1.0` and `uR3DynamicPoolEnabled = 1.0`; delete dead else-branches |
| R4-3 | Merge retained R3 controls into old layout: CONFIG 1/2/3 switch, color-temp **radio** buttons (match old look), lumens sliders (Cloud / Track / Wide), acoustic-panel color control |
| R4-4 | R3-5a sweet-spot UI replication — 4 sliders (lamp tilt / beam angle / track-to-GIK distance / same-side lamp spacing) spanning shader geometry + JS uniforms + GUI |
| R4-5 | Interaction polish (reset, listen-bound values, hotkeys if needed) |

No R4-6. User verifies UX directly; no A/B screenshot stage.

---

## Critical context not documented elsewhere

- **"Wabi-sabi" is not the design goal.** That label came from a prior Gemini conversation and is to be ignored. The real directive: replicate the old project's UI and UX 1:1. New R3 features absent from the old project must be integrated in a style consistent with the old layout.
- Acoustic-panel color control is kept purely as an aesthetic preview tool. Dimi Music only sells white GIK, so it is no longer a procurement decision aid.
- R4 does **not** handle CONFIG 3 path-tracing noise. That belongs to a later denoising stage.
- No cache-buster bump needed for doc-only commits.
