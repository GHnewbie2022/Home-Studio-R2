# R7-3.10 C1 1024 Bake Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and validate 1024-resolution R7-3.10 C1 floor + north diffuse bake packages, then compare them against the current 512 packages for the northeast wardrobe black-line issue and close-range bake blur.

**Architecture:** Use the existing R7-3.10 bake capture runner with `--atlas-resolution=1024`; remove the C fallback experiment before validation so the project does not keep a tempting wrong turn. Runtime already reads `targetAtlasResolution` dynamically, but floor and north must use the same atlas resolution when both are enabled. North is used as the first probe because its black line is visually stronger and has cleaner row evidence; floor must follow immediately so final validation uses floor+north together at 1024.

**Tech Stack:** WebGL2 / Three.js path tracing, GLSL atlas short-circuit path, Node runner scripts, JSON runtime package pointers, `.omc` bake artifacts.

---

## Current Facts

1.  The current live / screenshot render buffer is decoupled from the browser window.
    `SCREEN_WIDTH = 2560`, `SCREEN_HEIGHT = 1440`, and the actual path tracing buffer is affected by `pixelRatio`.

2.  The current R7-3.10 floor and north bake packages are 512 atlas packages.

3.  The 512 atlas size was an engineering experiment size used to make the bake pipeline cheaper to iterate. It is not the user quality target.

4.  C runtime fallback proved the black line can be removed, but it replaces the baked band with live path tracing. That creates a sharp/live band next to blurrier baked texels. The experiment is now rejected and should be removed, not kept as a diagnostic switch.

5.  1024 validation must not hardcode the old 512 row numbers:
    - 512 floor target row was around `131`.
    - 512 north target row was around `344`.
    - 1024 boundary rows will be different, roughly doubled. Probes must derive boundary rows from resolution and world coordinates.

---

## Files And Responsibilities

1.  `docs/tools/r7-3-10-h5-nearest-interval.mjs`
    - Make the offline H5 / H3' interval probe resolution-aware.
    - It must accept `--atlas-resolution=512`, `1024`, and `2048`.
    - It must compute boundary rows dynamically from wardrobe world boundaries.

2.  `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`
    - Existing runner already accepts `--atlas-resolution=`.
    - Use it to generate north and floor 1024 packages.
    - Remove the abandoned H5 fallback experiment flag and report path.
    - Do not add new flags unless the existing probe cannot report resolution-aware rows clearly.

3.  `docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json`
    - Temporarily point to the new north 1024 package during validation.
    - Keep the previous 512 pointer recoverable.

4.  `docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json`
    - Temporarily point to the new floor 1024 package after the floor bake passes validation.
    - Keep the previous 512 pointer recoverable.

5.  `docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js`
    - Run before and after pointer changes.
    - Only edit if it fails because it incorrectly assumes 512 for R7-3.10 floor/north.

6.  `docs/SOP/Debug_Log.md`
    - Add final result after the 1024 experiment produces evidence.

7.  `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md`
    - Update after evidence is reviewed.

8.  `docs/superpowers/plans/2026-05-14-r7-3-10-c1-seam-debug-consensus-codex.md`
    - Update after evidence is reviewed.

9.  `shaders/Home_Studio_Fragment.glsl`
    - Remove the abandoned H5 fallback uniform, helper, and short-circuit skip branch.

10. `js/InitCommon.js`
    - Remove the abandoned H5 fallback console setter and reporter option handling.

11. `js/Home_Studio.js`
    - Remove the abandoned H5 fallback uniform creation.

---

## Task 1: Preflight And Pointer Backup

**Files:**
- Read: `docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json`
- Read: `docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json`
- Create: `.omc/r7-3-10-1024-pointer-backups/<timestamp>/`

- [ ] **Step 1: Record current branch and dirty state**

Run:

```bash
git branch --show-current
git status --short
```

Expected:

```text
Current branch is visible.
Dirty files are known before OPUS touches pointer JSON.
Do not revert unrelated existing changes.
```

- [ ] **Step 2: Back up current 512 pointers**

Run:

```bash
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p ".omc/r7-3-10-1024-pointer-backups/${STAMP}"
cp docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json ".omc/r7-3-10-1024-pointer-backups/${STAMP}/north-512-pointer.json"
cp docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json ".omc/r7-3-10-1024-pointer-backups/${STAMP}/floor-512-pointer.json"
printf '%s\n' ".omc/r7-3-10-1024-pointer-backups/${STAMP}"
```

Expected:

```text
The printed backup path contains both current 512 pointer files.
```

- [ ] **Step 3: Run contract test before changing pointers**

Run:

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected:

```text
Passes before the 1024 experiment.
If it fails, report the exact assertion before continuing.
```

---

## Task 2: Remove C Fallback Experiment Artifacts

**Files:**
- Modify: `shaders/Home_Studio_Fragment.glsl`
- Modify: `js/Home_Studio.js`
- Modify: `js/InitCommon.js`
- Modify: `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`
- Test: `docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js`

- [ ] **Step 1: Remove fallback shader artifacts**

Remove these concepts from `shaders/Home_Studio_Fragment.glsl`:

```text
uR7310C1H5FallbackMode
r7310C1H5BoundaryFallbackSkip
!r7310C1H5BoundaryFallbackSkip(...)
```

Expected:

```text
R7-3.10 floor and north short-circuit paths no longer contain a fallback skip branch.
The only remaining H5 / H3' work should be probe or 1024-resolution bake validation.
```

- [ ] **Step 2: Remove fallback JS control artifacts**

Remove these concepts from `js/Home_Studio.js` and `js/InitCommon.js`:

```text
pathTracingUniforms.uR7310C1H5FallbackMode
window.setR7310C1H5FallbackMode
options.h5FallbackMode
uR7310C1H5FallbackMode reporter writes
```

Expected:

```text
There is no console setter that can turn fallback back on.
Runtime probe reports do not carry a fallback mode option.
```

- [ ] **Step 3: Remove fallback runner artifacts**

Remove these concepts from `docs/tools/r7-3-8-c1-bake-capture-runner.mjs`:

```text
--r7310-h5-fallback-probe
h5FallbackProbeTest
h5-fallback-experiment-report.json
```

Expected:

```text
Runner still supports bake capture and H5 black-line probe.
Runner no longer supports the abandoned fallback experiment.
```

- [ ] **Step 4: Verify fallback is gone**

Run:

```bash
rg -n "H5Fallback|h5Fallback|setR7310C1H5FallbackMode|uR7310C1H5FallbackMode|r7310C1H5BoundaryFallbackSkip|h5-fallback|--r7310-h5-fallback-probe" shaders/Home_Studio_Fragment.glsl js/InitCommon.js docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node --check js/InitCommon.js
node --check docs/tools/r7-3-8-c1-bake-capture-runner.mjs
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected:

```text
rg returns no matches.
Both node --check commands pass.
Contract test passes or reports a clearly unrelated existing failure.
```

---

## Task 3: Make H5 Interval Probe Resolution-Aware

**Files:**
- Modify: `docs/tools/r7-3-10-h5-nearest-interval.mjs`

- [ ] **Step 1: Add atlas resolution argument parsing**

Implementation requirement:

```js
function parseArgs(argv) {
  const out = { atlasResolution: 512 };
  for (const arg of argv) {
    if (arg.startsWith('--atlas-resolution=')) {
      out.atlasResolution = Number(arg.slice('--atlas-resolution='.length));
    }
  }
  if (!Number.isFinite(out.atlasResolution) || out.atlasResolution < 2) {
    throw new Error('Invalid --atlas-resolution');
  }
  out.atlasResolution = Math.trunc(out.atlasResolution);
  return out;
}

const args = parseArgs(process.argv.slice(2));
const RES = args.atlasResolution;
```

- [ ] **Step 2: Derive target rows dynamically**

Implementation requirement:

```js
function nearestTexelIndexForLocalUv(localUv, res) {
  return Math.floor(localUv * (res - 1) + 0.5);
}

function floorBoundaryRowForResolution(res) {
  const zMin = -2.074;
  const zMax = 3.256;
  const wardrobeZMax = -0.703;
  const localV = (wardrobeZMax - zMin) / (zMax - zMin);
  return nearestTexelIndexForLocalUv(localV, res);
}

function northBoundaryRowForResolution(res) {
  const yMin = 0.0;
  const yMax = 2.905;
  const wardrobeYMax = 1.955;
  const localV = (wardrobeYMax - yMin) / (yMax - yMin);
  return nearestTexelIndexForLocalUv(localV, res);
}
```

- [ ] **Step 3: Report rows around the boundary, not only historic rows**

Implementation requirement:

```js
const floorBoundaryRow = floorBoundaryRowForResolution(RES);
const northBoundaryRow = northBoundaryRowForResolution(RES);

const result = {
  tool: 'r7-3-10-h5-nearest-interval',
  atlasResolution: RES,
  note: 'probe-only offline nearest-hit-interval back-solve; no visual path changed',
  floor: {
    boundaryRow: floorBoundaryRow,
    rowsAroundBoundary: [
      analyzeFloorRow(floorBoundaryRow - 1, 'nearBoundary'),
      analyzeFloorRow(floorBoundaryRow, 'boundary'),
      analyzeFloorRow(floorBoundaryRow + 1, 'nearBoundary')
    ]
  },
  north: {
    boundaryRow: northBoundaryRow,
    rowsAroundBoundary: [
      analyzeNorthRow(northBoundaryRow - 1, 'nearBoundary'),
      analyzeNorthRow(northBoundaryRow, 'boundary'),
      analyzeNorthRow(northBoundaryRow + 1, 'nearBoundary')
    ]
  }
};
```

- [ ] **Step 4: Verify 512 and 1024 outputs**

Run:

```bash
node docs/tools/r7-3-10-h5-nearest-interval.mjs --atlas-resolution=512
node docs/tools/r7-3-10-h5-nearest-interval.mjs --atlas-resolution=1024
```

Expected:

```text
Both commands print JSON.
512 output still identifies rows near the historic floor/north boundaries.
1024 output identifies different boundary rows derived from world coordinates.
1024 texel pitch is about half of 512.
```

---

## Task 4: Generate North 1024 Bake Package

**Files:**
- Create: `.omc/r7-3-10-full-room-diffuse-bake/<timestamp>/`

- [ ] **Step 1: Run north-only 1024 bake**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-full-room-diffuse-bake --r7310-surface=north-wall \
  --samples=1000 --atlas-resolution=1024 --timeout-ms=3600000
```

Expected:

```text
The runner completes.
It prints atlasResolution: 1024.
It prints status: pass.
It prints a package path under .omc/r7-3-10-full-room-diffuse-bake/.
```

- [ ] **Step 2: Validate north package artifacts**

Run this immediately after Step 1. It validates the newest generated package:

```bash
PKG="$(ls -dt .omc/r7-3-10-full-room-diffuse-bake/* | head -n 1)"
node -e "
const fs = require('fs');
const path = require('path');
const pkg = process.argv[1];
const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'manifest.json'), 'utf8'));
const validation = JSON.parse(fs.readFileSync(path.join(pkg, 'validation-report.json'), 'utf8'));
const atlas = fs.statSync(path.join(pkg, 'atlas-patch-000-rgba-f32.bin')).size;
const metadata = fs.statSync(path.join(pkg, 'texel-metadata-patch-000-f32.bin')).size;
console.log(JSON.stringify({
  targetAtlasResolution: manifest.targetAtlasResolution,
  surfaceName: manifest.surfaceName,
  requestedSamples: manifest.requestedSamples,
  atlasBytes: atlas,
  expectedAtlasBytes: 1024 * 1024 * 4 * 4,
  metadataBytes: metadata,
  expectedMetadataBytes: 1024 * 1024 * 12 * 4,
  runnerStatus: validation.runnerStatus,
  status: validation.status
}, null, 2));
" "$PKG"
```

Expected:

```text
targetAtlasResolution = 1024
surfaceName = c1_north_wall
requestedSamples = 1000
atlasBytes = 16777216
metadataBytes = 50331648
runnerStatus = pass
status = pass
```

---

## Task 5: Temporarily Point North Runtime To 1024 And Validate North Alone

**Files:**
- Modify: `docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json`

- [ ] **Step 1: Update north pointer to the generated 1024 package**

Use the generated `manifest.json` values. The pointer must keep:

```json
{
  "version": "r7-3-10-full-room-diffuse-bake-architecture-probe",
  "packageStatus": "architecture_probe",
  "runtimeScope": "c1_north_wall_diffuse_short_circuit",
  "runtimeEnabledDefault": false,
  "batch": "north_wall",
  "targetId": 1002,
  "surfaceName": "c1_north_wall",
  "requestedSamples": 1000,
  "targetAtlasResolution": 1024,
  "diffuseOnly": true,
  "upscaled": false
}
```

Expected:

```text
Only packageDir, targetAtlasResolution, worldBounds, and artifact references should differ from the 512 pointer.
No shader or loader code change is required for this step.
```

- [ ] **Step 2: Run north-only H5 black-line probe**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-h5-black-line-probe --timeout-ms=180000
```

Expected:

```text
The probe completes.
North histogram reports rows around the 1024 boundary row, not row 344.
WorldY stair width is about half of the 512 result.
Floor may remain absent or disabled during this north-only check.
```

- [ ] **Step 3: Run north visual check URL**

Open:

```text
http://localhost:9002/Home_Studio.html?v=r7310-1024-north-probe-v1
```

Console setup:

```js
window.setR7310C1FloorDiffuseEnabled(false);
window.setR7310C1NorthWallDiffuseEnabled(true);
```

Expected:

```text
North bake turns on.
No fallback console setter is required or available.
Northeast wardrobe top north-edge black line is thinner or less visible than the 512 pointer.
Close-range bake blur is reduced compared with 512.
```

---

## Task 6: Generate Floor 1024 Bake Package

**Files:**
- Create: `.omc/r7-3-10-full-room-diffuse-bake/<timestamp>/`

- [ ] **Step 1: Run floor 1024 bake**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-full-room-diffuse-bake --r7310-surface=floor \
  --samples=1000 --atlas-resolution=1024 --timeout-ms=3600000
```

Expected:

```text
The runner completes.
It prints atlasResolution: 1024.
It prints status: pass.
It prints a package path under .omc/r7-3-10-full-room-diffuse-bake/.
```

- [ ] **Step 2: Validate floor package artifacts**

Run this immediately after Step 1. It validates the newest generated package:

```bash
PKG="$(ls -dt .omc/r7-3-10-full-room-diffuse-bake/* | head -n 1)"
node -e "
const fs = require('fs');
const path = require('path');
const pkg = process.argv[1];
const manifest = JSON.parse(fs.readFileSync(path.join(pkg, 'manifest.json'), 'utf8'));
const validation = JSON.parse(fs.readFileSync(path.join(pkg, 'validation-report.json'), 'utf8'));
const atlas = fs.statSync(path.join(pkg, 'atlas-patch-000-rgba-f32.bin')).size;
const metadata = fs.statSync(path.join(pkg, 'texel-metadata-patch-000-f32.bin')).size;
console.log(JSON.stringify({
  targetAtlasResolution: manifest.targetAtlasResolution,
  surfaceName: manifest.surfaceName,
  requestedSamples: manifest.requestedSamples,
  atlasBytes: atlas,
  expectedAtlasBytes: 1024 * 1024 * 4 * 4,
  metadataBytes: metadata,
  expectedMetadataBytes: 1024 * 1024 * 12 * 4,
  runnerStatus: validation.runnerStatus,
  status: validation.status
}, null, 2));
" "$PKG"
```

Expected:

```text
targetAtlasResolution = 1024
surfaceName = c1_floor_full_room
requestedSamples = 1000
atlasBytes = 16777216
metadataBytes = 50331648
runnerStatus = pass
status = pass
```

---

## Task 7: Enable Floor + North 1024 Together

**Files:**
- Modify: `docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json`
- Verify: `docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json`

- [ ] **Step 1: Update floor pointer to the generated 1024 package**

Use the generated floor `manifest.json` values. The pointer must keep:

```json
{
  "version": "r7-3-10-full-room-diffuse-bake-architecture-probe",
  "packageStatus": "architecture_probe",
  "runtimeScope": "c1_floor_full_room_diffuse_short_circuit",
  "runtimeEnabledDefault": false,
  "batch": "floor",
  "targetId": 1001,
  "surfaceName": "c1_floor_full_room",
  "requestedSamples": 1000,
  "targetAtlasResolution": 1024,
  "diffuseOnly": true,
  "upscaled": false
}
```

Expected:

```text
Floor and north pointers both report targetAtlasResolution = 1024.
Combined atlas resolution mismatch must not trigger.
```

- [ ] **Step 2: Run contract test after both pointers are 1024**

Run:

```bash
node docs/tests/r7-3-10-full-room-diffuse-bake-contract.test.js
```

Expected:

```text
Passes.
If it fails because R7-3.10 contract test incorrectly assumes 512, report the exact assertion and patch only that assumption.
```

- [ ] **Step 3: Run short-circuit smoke**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-runtime-short-circuit-test --timeout-ms=180000
```

Expected:

```text
Runs without loader mismatch.
H7 / H8 / C' behavior does not regress.
Record bakedSurfaceHitCount and shortCircuit count in the report.
```

- [ ] **Step 4: Run H5 black-line probe with both 1024 packages**

Run:

```bash
node docs/tools/r7-3-8-c1-bake-capture-runner.mjs \
  --r7310-h5-black-line-probe --timeout-ms=180000
```

Expected:

```text
North histogram uses the 1024 boundary row range.
Floor may still be hard to capture, but the offline interval probe must show the 1024 floor black-line width is about half of the 512 estimate.
```

---

## Task 8: User-Facing Visual Validation

**Files:**
- No code changes unless validation exposes a loader bug.

- [ ] **Step 1: Open the 1024 validation URL**

Open:

```text
http://localhost:9002/Home_Studio.html?v=r7310-1024-floor-north-v1
```

Console setup:

```js
window.setR7310C1FloorDiffuseEnabled(true);
window.setR7310C1NorthWallDiffuseEnabled(true);
```

Expected:

```text
Floor bake and north bake are both enabled.
No fallback console setter is required or available.
No loader mismatch appears in console.
```

- [x] **Step 2: Ask user for same-view visual pass**

User checks:

```text
1. Northeast wardrobe top north-edge black line with north bake ON.
2. Northeast wardrobe bottom south-edge black line with floor bake ON.
3. Close-range bake blur compared with the 512 package.
4. FPS while walking in the room.
```

Expected:

```text
使用者已確認 1024 下兩條黑線看不出來。
partial bake + LIVE 的局部偏亮另列為深度相加的過渡假象，不作為 1024 黑線驗收失敗。
```

---

## Task 9: Compare 512 / 1024 And Decide 2048

**Files:**
- Read: `.omc/r7-3-10-h5-black-line-probe/<timestamp>/h5-black-line-probe-report.json`
- Read: `.omc/r7-3-10-full-room-diffuse-bake/<timestamp>/validation-report.json`

- [x] **Step 1: Produce numeric comparison**

Run:

```bash
node docs/tools/r7-3-10-h5-nearest-interval.mjs --atlas-resolution=512
node docs/tools/r7-3-10-h5-nearest-interval.mjs --atlas-resolution=1024
node docs/tools/r7-3-10-h5-nearest-interval.mjs --atlas-resolution=2048
```

Expected:

```text
512 / 1024 / 2048 texel pitch and estimated visible black-line widths are printed.
North 可見黑帶：512=3.46mm，1024=0.125mm，2048=1.30mm。
1024 是本輪 north 黑線甜蜜點；2048 在 north 相位上退化。
```

- [x] **Step 2: Decide next resolution**

Decision rule:

```text
Decision: keep 1024 as the current accepted floor / north package target.
Do not run 2048 in this round because north interval prediction regresses.
Future higher-resolution work should reopen only with new evidence or a local high-resolution/tiled design.
```

---

## Task 10: Documentation Update After Evidence

**Files:**
- Modify: `docs/SOP/Debug_Log.md`
- Modify: `docs/SOP/Debug_Log_Index.md`
- Modify: `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-codex.md`
- Modify: `docs/superpowers/plans/2026-05-14-r7-3-10-c1-seam-debug-consensus-codex.md`
- OPUS mirrors updates in:
  - `docs/superpowers/plans/2026-05-14-r7-3-10-c1-phase-2-design-opus.md`
  - `docs/superpowers/plans/2026-05-14-r7-3-10-c1-seam-debug-consensus-opus.md`

- [x] **Step 1: Record the experiment outcome**

Required content:

```text
R7-3.10 H5 / H3' 1024 bake resolution experiment:
  - north package path: .omc/r7-3-10-full-room-diffuse-bake/20260515-212509
  - floor package path: .omc/r7-3-10-full-room-diffuse-bake/20260515-215727
  - targetAtlasResolution: 1024
  - atlasBytes: 16777216 (=1024^2*16)
  - metadataBytes: 50331648 (=1024^2*48)
  - contract test result: pass
  - runtime smoke result: 96170 / 190559
  - H5 black-line probe result: north dominantRow=682, totalInBand=1494
  - user visual result: two wardrobe boundary black lines are no longer visible
  - decision: keep 1024; do not try 2048 in this round
```

- [x] **Step 2: Mark C fallback status**

Required wording:

```text
C runtime fallback was an abandoned experiment and has been removed.
It proved that the black line comes from the boundary texel selection path, but it created a live/bake texture-quality seam and must not be reintroduced as a finish.
```

Additional closeout:

```text
Option A bakeContaminationGuardSnapshot is retained as telemetry.
Option B captureMode guard is installed in r7310C1FullRoomDiffuseShortCircuit().
Official comparison baseline is now all relevant static diffuse surfaces baked vs all LIVE.
```

---

## Review Checklist

Before OPUS reports completion to CODEX:

```text
1. 1024 north package exists and passes validation.
2. 1024 floor package exists and passes validation.
3. Both pointers can be restored to 512 from backup.
4. Both pointers can be set to 1024 together without combined atlas mismatch.
5. H5 interval probe no longer hardcodes 512 rows as the only truth.
6. H5 black-line probe output is interpreted with 1024 boundary rows.
7. C fallback artifacts are removed before visual validation.
8. User sees the validation URL and exact console setup.
9. No unrelated GIK / ACOUSTIC_PANEL / texture files are touched.
10. CODEX reviews all code or pointer changes before commit.
```
