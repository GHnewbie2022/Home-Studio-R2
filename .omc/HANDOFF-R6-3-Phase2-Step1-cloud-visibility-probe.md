# HANDOFF - R6-3 Phase2 Step1 Cloud Visibility Probe

## Required Reading

Read these files in full, in this order:

1. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/REPORT-R6-3-Phase1C-Step2-cloud-arc-implementation.md`
2. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/FINDING-R6-supersampling-discovery.md`
3. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/ROADMAP-R6-noise-cleanup-priority.md`
4. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOFF-R6-3-Phase2-Step1-cloud-visibility-probe.md`

## Current Branch

`r6-3-phase2-cloud-visibility-probe`

This is a diagnostic branch. It should add probes only. Do not change normal render behavior unless the user explicitly asks.

## Current Dirty Files

Expected dirty files:

- `Home_Studio.html`
- `js/Home_Studio.js`
- `shaders/Home_Studio_Fragment.glsl`
- `docs/tests/r6-3-cloud-visibility-probe.test.js`
- `docs/tests/r6-3-max-samples.test.js`

## Completed Before This Handoff

- `MAX_SAMPLES` was changed from `3000` to `1000`.
- Snapshot milestones now stop at `1000`.
- A Cloud visibility probe was added.
- Probe mode defaults off, so normal rendering should remain unchanged.
- The local server was opened at `http://localhost:9002/Home_Studio.html`.

## Probe Usage

Console commands:

```js
window.setCloudVisibilityProbe(1, -1); // all Cloud rods
window.setCloudVisibilityProbe(1, 0);  // E rod
window.setCloudVisibilityProbe(1, 1);  // W rod
window.setCloudVisibilityProbe(1, 2);  // S rod
window.setCloudVisibilityProbe(1, 3);  // N rod
window.reportCloudVisibilityProbe();
window.setCloudVisibilityProbe(0);     // off
```

Probe colors:

- Green means the Cloud next event estimation shadow ray hit the selected Cloud rod.
- Red means the Cloud next event estimation shadow ray was blocked, missed, or hit the wrong object.
- Blue carries a rod/contribution cue, so heavy red plus blue can appear magenta.

## User Observation

The user ran:

```js
window.setCloudVisibilityProbe(1, -1);
window.reportCloudVisibilityProbe();
```

Observed at `1000` samples per pixel:

```txt
mode: 1
rod: -1
samples: 1000
width: 2560
height: 1440
visiblePixels: 7872
blockedPixels: 3678528
inactivePixels: 0
visibleMass: 1409798.18
blockedMass: 2571075.27
visibleRatio: 0.3541
```

Visual result: mostly magenta, with no obvious green visible by eye.

## Current Interpretation

C3 Cloud-only is not just slowly converging in a generic way. The current probe points to a high Cloud direct-light visibility failure rate.

Plain meaning: many Cloud next event estimation samples are selected, but a large share do not reach the selected Cloud emitter cleanly.

The next diagnosis should identify what blocks or redirects the Cloud shadow rays:

- wall / room geometry
- Cloud panel geometry
- another Cloud rod
- analytic arc hit tolerance or target mismatch
- expected self-occlusion from current Cloud geometry

## Verification Already Run

Passing:

```sh
node docs/tests/r6-3-cloud-visibility-probe.test.js
node docs/tests/r6-3-max-samples.test.js
node docs/tests/r3-3-cloud-radiance.test.js
node docs/tests/r3-5b-cloud-area-nee.test.js
node docs/tests/r3-6-5-dynamic-pool.test.js
node --check js/Home_Studio.js
git diff --check
```

Headless Brave loaded the new JavaScript and showed BVH initialization logs, but `--dump-dom` did not exit by itself. A `--disable-gpu` test failed to create WebGL context and should not be used as shader evidence.

## Next Step

Do not auto-execute or edit code after reading. Stand by for user instruction.

Likely next useful step, if user asks: add a second diagnostic probe that classifies the blocker object/type for Cloud next event estimation shadow rays.
