# R6 Noise Cleanup — Handover: G Diagnosis

> Date: 2026-04-28
> Status: Diagnosis decided, awaiting execution

---

## Project snapshot

Home_Studio_3D — WebGL path tracer on the erichlof Three.js framework.
Server: `python3 -m http.server 9001` (cwd = `Home_Studio_3D/`)
Browser: Brave → `http://localhost:9001/Home_Studio.html`

---

## This session's finding

Infinity-SPP experiment confirmed: **the quality ceiling is correct — the problem is slow convergence, not a flawed estimator.**

| Config | Usable at |
|--------|-----------|
| C1, C2 | ~500 spp  |
| C3     | ~20,000 spp (slowest) |
| C4     | ~20,000 spp          |

Root cause hypothesis: the NEE (Next Event Estimation — direct-light sampling step) uses a PDF (the formula deciding how likely each lamp gets sampled) that under-favors small high-intensity lights (22W COB + 25W track spots). Low sample probability → rare high-energy spikes → slow statistical averaging.

C1/C2 converge fast with identical scene geometry → geometry is NOT the root cause → H diagnosis deprioritized.

Full evidence: `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/REPORT-R6-convergence-diagnosis.md`

---

## Decided next action

**G diagnosis** — add a shader probe to print per-lamp NEE PDF values. Identify lamps whose sample probability is disproportionately low relative to their energy output. Estimated cost: 1–2 days. If the root cause is confirmed, the fix is a formula change (~30 min).

Prior context (already decided roadmap + last failed attempt):
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/ROADMAP-R6-noise-cleanup-priority.md`
- `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/REPORT-R6-2-bucket2-rr-step0-noop.md`

---

## User profile

Music producer, no engineering background.
- Plain language only; always write full English terms, never abbreviations
- Always offer options; never decide for the user
- No code or concrete implementation until the user explicitly confirms

---

## Hard rules

```
DO NOT  retry RR Option 1 (NEE-after placement) — confirmed failed
DO NOT  use post-process blur for noise — confirmed wrong direction
DO NOT  clamp values to mask noise — hides root cause, not a fix
DO NOT  deprioritize G in favor of H — geometry ruled out this session
```
