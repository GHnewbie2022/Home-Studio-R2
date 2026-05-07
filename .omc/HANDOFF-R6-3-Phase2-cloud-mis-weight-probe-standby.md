# Home_Studio_3D R6-3 Phase2 Cloud MIS Weight Probe Standby

Read this file in full first. Follow the required reading order below. After reading, stand by for user instruction. Do not auto-execute commands or edit code.

## Required Reading Order

```text
1. /Users/eajrockmacmini/.codex/AGENTS.md
2. /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-3-Phase2-v5a-wait-fix2-standby.md
3. /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md
```

For `Debug_Log.md`, prioritize the latest R6-3 Phase2 sections:

```text
1. theta importance shader A/B visual no-go
2. Cloud sampling budget diagnostic
3. Cloud MIS weight probe
```

## Current State

```text
Project:
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D

Known local URL:
  http://localhost:9004/Home_Studio.html

Latest user-verified Console command:
  await reportCloudMisWeightProbeAfterSamples(4, 120000)

Latest user-verified values:
  directNeeAverageWeight = 1
  directNeeAveragePdfRatio = 45015006.83772
  directNeeEventMass = 8224994.048768
  bsdfHitAverageWeight = 0.262549
  bsdfHitAveragePdfRatio = 1.675952
  bsdfHitEventMass = 32506.048768
```

## Conclusions

```text
1. B0.50 theta-importance shader A/B is no-go.
   User reported 48 spp A and B0.50 looked almost identical.

2. C3 Cloud sampling budget is healthy.
   activeLightIndex = [7, 8, 9, 10]
   cloudPickRatio = 1
   otherLightPickRatio = 0

3. Cloud direct NEE is not the current priority.
   directNeeAverageWeight = 1
   This path is not being meaningfully diluted by MIS.

4. The current suspect is indirect / BSDF-hit.
   bsdfHitAverageWeight is around 0.26.
   bsdfHitEventMass is much smaller than directNeeEventMass.
```

## Next Recommended SOP

```text
1. Do not start with denoising.

2. Do not prioritize direct NEE changes.

3. Plan a small BSDF-hit / indirect-isolation probe or patch.

4. Keep probe-only and normal render behavior separate.

5. For each candidate:
   A. measure with probe first
   B. then run 48 spp visual comparison
   C. ask user for visual verification only when needed
```

## Current Modified / Added Files

```text
Modified:
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/Home_Studio.html
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/tests/r3-5b-cloud-area-nee.test.js
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/js/Home_Studio.js
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/shaders/Home_Studio_Fragment.glsl

Added / untracked:
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/tests/r6-3-cloud-facing-diagnostic.test.js
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/tests/r6-3-cloud-mis-weight-probe.test.js
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/tests/r6-3-cloud-sampling-budget-diagnostic.test.js
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/tests/r6-3-cloud-visibility-probe.test.js
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/tests/r6-3-cloud-visible-theta-v5b.test.js
  /Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/tests/r6-3-max-samples.test.js
```

## Last Verification Commands

All commands below passed in the latest run:

```text
rtk node docs/tests/r6-3-cloud-mis-weight-probe.test.js
rtk node docs/tests/r6-3-cloud-sampling-budget-diagnostic.test.js
rtk node docs/tests/r6-3-cloud-facing-diagnostic.test.js
rtk node docs/tests/r6-3-cloud-visibility-probe.test.js
rtk node docs/tests/r6-3-cloud-visible-theta-v5b.test.js
rtk node docs/tests/r6-3-max-samples.test.js
rtk node docs/tests/r3-3-cloud-radiance.test.js
rtk node docs/tests/r3-5b-cloud-area-nee.test.js
rtk node docs/tests/r3-6-5-dynamic-pool.test.js
rtk node --check js/Home_Studio.js
rtk git diff --check
```

## User Communication Preference

```text
Use Traditional Chinese for user-facing replies.
Use junior-high-level plain language for technical explanations.
If asking user to verify visually or in Console, include the current local URL and step-by-step instructions.
```
