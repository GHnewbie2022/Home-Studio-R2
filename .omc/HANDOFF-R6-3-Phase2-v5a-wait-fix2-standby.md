# HANDOFF - R6-3 Phase2 v5a wait-fix2, standby

Date: 2026-05-03 Asia/Taipei

## First instruction

Read this file in full first. Then stand by for user instruction.

Do not auto-execute commands, edit code, or continue implementation after reading.

If any visual, Console, browser, review, or user validation is needed, include the active review URL:

http://localhost:9002/Home_Studio.html

Explain any user-facing technical instructions in very plain language, around middle-school level. The user has a music production background and may not know Console, sample, probe, shader, or WebGL details. For Console snippets, say exactly what to paste, when to press Enter, what to wait for, and which fields to inspect.

## Required reading order

1. This file.
2. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-3-Phase2-Step1-cloud-visibility-probe.md`
3. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-3-Phase2-Step2-emission-normal-v4-pending-v5.md`
4. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md`, section `R6-3 Phase2｜Cloud visibility probe v4/v5 亮度回歸教訓（2026-05-03）`

## Current branch

`r6-3-phase2-cloud-visibility-probe`

## Current dirty files

Modified:

- `Home_Studio.html`
- `docs/SOP/Debug_Log.md`
- `docs/tests/r3-5b-cloud-area-nee.test.js`
- `js/Home_Studio.js`
- `shaders/Home_Studio_Fragment.glsl`

Untracked:

- `.omc/HANDOFF-R6-3-Phase2-Step1-cloud-visibility-probe.md`
- `.omc/HANDOFF-R6-3-Phase2-Step2-emission-normal-v4-pending-v5.md`
- `.omc/HANDOFF-R6-3-Phase2-v5a-wait-fix2-standby.md`
- `docs/tests/r6-3-cloud-visibility-probe.test.js`
- `docs/tests/r6-3-max-samples.test.js`

## Current status in one paragraph

The v4 emission-normal probe reduced `zeroCloudFacing`, but the first v5 attempt broke normal C3 brightness. Root cause: probe-only emission-normal / reverse-normal logic leaked into normal rendering. That has been fixed; normal C3 brightness is restored. Current v5a is a probe-only theta scan and auto-wait tool, not a C3 visual improvement. The probe tooling is now safe enough to measure: it waits for target samples, avoids resetting accumulation while waiting, and no longer floods the Console with per-bin summary tables.

## Latest active version

HTML cache token:

`Home_Studio.js?v=r6-3-cloud-visibility-probe-v5a-wait-fix2-probe-only`

JS probe version:

`r6-3-phase2-mode3-theta-scan-v5a-wait-fix2-probe-only`

Shader cache token:

`Home_Studio_Fragment.glsl?v=r6-3-cloud-visibility-probe-theta-scan-v5a-probe-only`

## Bugs fixed during v5a tool cleanup

1. C3 became too dark.
   - Cause: probe emission-normal logic affected normal render.
   - Fix: normal render uses the original normal path; probe mode uses the diagnostic normal path.

2. Auto-wait looked like a sample loop seizure.
   - Cause: `waitForCloudVisibilityProbeSamples()` called `wakeRender()` while waiting, which reset accumulation repeatedly.
   - Fix: waiting now polls samples without waking/resetting accumulation.

3. Console printed too many tables.
   - Cause: `cloudVisibilityProbeSummary()` always called `console.table(summary)`, and theta scan called it per bin.
   - Fix: `cloudVisibilityProbeSummary(options)` supports `{ logTable: false }`. Auto-wait and theta scan read summaries silently. Manual `reportCloudVisibilityProbe()` still prints one table.

## Latest user validation

The user ran the final v5a wait-fix2 snippet at 200 target samples:

```js
const all = await reportCloudVisibilityProbeAfterSamples(3, -1, 'zeroCloudFacing', -1, 8, 200, 120000);
const scan = await reportCloudVisibilityProbeThetaScanAfterSamples('zeroCloudFacing', -1, 8, 200, 120000);
console.table([
  {
    thetaLabel: 'all',
    samples: all.samples,
    selectedClassRatio: all.selectedClassRatio,
    waitTimedOut: all.waitTimedOut,
    thetaStartDeg: all.thetaStartDeg,
    thetaEndDeg: all.thetaEndDeg
  },
  ...scan.bins.map((bin) => ({
    thetaLabel: bin.thetaLabel,
    samples: bin.samples,
    selectedClassRatio: bin.selectedClassRatio,
    waitTimedOut: bin.waitTimedOut,
    thetaStartDeg: bin.thetaStartDeg,
    thetaEndDeg: bin.thetaEndDeg
  }))
]);
({ all, scan });
```

Observed table:

```text
thetaLabel  samples  selectedClassRatio  waitTimedOut  thetaStartDeg  thetaEndDeg
all         202      0.2105              false         0              90
0/8         202      0.4097              false         0              11.25
1/8         202      0.3957              false         11.25          22.5
2/8         202      0.3768              false         22.5           33.75
3/8         202      0.3594              false         33.75          45
4/8         202      0.3456              false         45             56.25
5/8         202      0.3341              false         56.25          67.5
6/8         202      0.3270              false         67.5           78.75
7/8         202      0.3311              false         78.75          90
```

Interpretation:

- Probe wait succeeded: all rows reached about 200 samples.
- `waitTimedOut` is false for all rows.
- `zeroCloudFacing` remains meaningful.
- The issue appears across all 8 theta bins; it is stronger in lower theta bins and lower in higher theta bins, but it does not vanish in any bin.
- The next implementation step should be planned from these measurements. Do not assume v5 visible-arc is already approved or safe.

## Verification already run after wait-fix2

```text
PASS  rtk node docs/tests/r6-3-cloud-visibility-probe.test.js
PASS  rtk node --check js/Home_Studio.js
PASS  rtk git diff --check
PASS  rtk node docs/tests/r3-5b-cloud-area-nee.test.js
```

## User-facing status to preserve

Plain-language summary for the user:

- Today mainly fixed the measuring tool, not the C3 convergence itself.
- Normal C3 brightness is restored.
- v5a can now measure `zeroCloudFacing` by theta bin without breaking C3, without manual waiting, and without Console spam.
- The remaining measured problem is `zeroCloudFacing all = 0.2105`, with all 8 theta bins still showing non-zero values.

## Standby instruction

After reading, wait for the user. Do not run commands or edit files until the user explicitly says to continue.
