# HANDOFF - R6-3 Phase2 Step2 emission-normal v4, pending v5

Date: 2026-05-03 Asia/Taipei

## First instruction

Read this file in full first. Then stand by for user instruction.

Do not auto-execute commands, edit code, or continue implementation after reading.

If any visual, Console, browser, review, or user validation is needed, include the active review URL:

http://localhost:9002/Home_Studio.html

This preference was also added to:

/Users/eajrockmacmini/.claude/user_profile.md

## Required reading order

1. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-3-Phase2-Step1-cloud-visibility-probe.md`
2. This file.

## Current branch

`r6-3-phase2-cloud-visibility-probe`

## Current dirty files

Modified:

- `Home_Studio.html`
- `docs/tests/r3-5b-cloud-area-nee.test.js`
- `js/Home_Studio.js`
- `shaders/Home_Studio_Fragment.glsl`

Untracked:

- `.omc/HANDOFF-R6-3-Phase2-Step1-cloud-visibility-probe.md`
- `.omc/HANDOFF-R6-3-Phase2-Step2-emission-normal-v4-pending-v5.md`
- `docs/tests/r6-3-cloud-visibility-probe.test.js`
- `docs/tests/r6-3-max-samples.test.js`

## What changed in v4

Root cause found from user probe:

- Before v4, `zeroCloudFacing selectedClassRatio = 0.7015`.
- Cloud arc geometry normal faced outward/upward.
- Cloud NEE used that geometry normal as the emitter normal.
- Many interior shading points therefore saw the Cloud emitter as back-facing.

Implemented v4:

- Added `cloudArcEmissionNormal(int rodIdx, float theta)`.
- It returns `-cloudArcNormal(rodIdx, theta)`.
- Cloud NEE now uses `emissionNormal` for:
  - `cloudCosLight`
  - `pdfNeeForLight(...)`
- Cloud BSDF reverse NEE PDF uses `-hitNormal`.
- Probe version is now `r6-3-phase2-mode3-emission-normal-v4`.

## Probe classes added

The probe now separates zero-contribution causes:

- `zeroContribution`
- `zeroSourceMask`
- `zeroSourceFacing`
- `zeroCloudFacing`
- `zeroFacingBoth`
- `zeroOther`

`zeroContribution` still matches all zero-contribution subclasses in selected-class mode.

## User validation after v4

User ran:

```js
setCloudVisibilityProbe(3, -1, 'zeroCloudFacing')
reportCloudVisibilityProbe()
```

Reported:

```text
probeVersion = r6-3-phase2-mode3-emission-normal-v4
readbackMode = rawPathTracingTarget
samples = 270
visibleRatio = 0.2105
selectedClass = zeroCloudFacing
selectedClassRatio = 0.2105
```

Interpretation:

- v4 worked: `zeroCloudFacing` dropped from `0.7015` to `0.2105`.
- Remaining issue is still meaningful.
- The likely remaining root cause is that Cloud NEE still samples the full 90 degree arc uniformly, including theta ranges that are back-facing for the current shading point.

## Local automated checks already passed

```text
PASS node docs/tests/r6-3-cloud-visibility-probe.test.js
PASS node docs/tests/r6-3-max-samples.test.js
PASS node docs/tests/r3-3-cloud-radiance.test.js
PASS node docs/tests/r3-5b-cloud-area-nee.test.js
PASS node docs/tests/r3-6-5-dynamic-pool.test.js
PASS node --check js/Home_Studio.js
PASS git diff --check
```

CDP smoke after v4 also confirmed:

```text
probeVersion = r6-3-phase2-mode3-emission-normal-v4
zeroContribution selectedClassRatio ~= 0.2005 at very low samples
zeroCloudFacing selectedClassRatio ~= 0.1464 at very low samples
```

These low-sample numbers are only smoke evidence. The user validation at 270 samples is the stronger current observation.

## Proposed next step, not yet approved

Do not implement this until the user explicitly approves.

Proposed v5:

- Restrict Cloud NEE theta sampling to only the visible/emissive theta interval for the current shading point.
- Use the effective arc interval area for:
  - Cloud NEE throughput
  - Cloud NEE `pdfNeeForLight(...)`
  - Cloud BSDF reverse NEE PDF
- Add/update static tests for the visible-arc PDF contract.
- Bump cache/probe version to v5.

Expected outcome:

- `zeroCloudFacing selectedClassRatio` should drop clearly below v4's `0.2105`.
- `zeroContribution` total should also drop.
- Normal C3 Cloud convergence should improve if the remaining zero-facing samples were a major source of wasted NEE attempts.

## Last user-facing status

The user is going to sleep and asked for a concise English handoff message plus Chinese translation.

The next AI should read this MD and wait.
