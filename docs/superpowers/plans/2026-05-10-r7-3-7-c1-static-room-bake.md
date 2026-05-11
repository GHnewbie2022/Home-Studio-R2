# R7-3.7 C1 Static Room Bake / FPS Handoff

## Read Order

1. `docs/AI交接必讀.md`
2. `docs/SOP/Debug_Log.md`
3. `docs/SOP/R7：採樣演算法升級.md`
4. This file.

## Current User Direction

Do not continue chasing an old 60 FPS memory. The user now accepts ~30 FPS as the practical target for this room while continuous path tracing is active.

Stop downgrading to older commits. Return to the latest R7-3 feature baseline:

1. Keep the C3 R7-3 quick-preview fixed curve.
2. Keep the C3/C4 visible-first-1SPP behavior as currently recorded.
3. Keep the optimized snapshot UI/system.
4. Use that R7-3 feature baseline as the target and raise C1/C2 FPS toward ~30.

## Current Result

The C1/C2 FPS target is recovered on the latest R7-3 feature baseline after removing the bottom-left R7-3 checkbox UI and the visible FPS probe overlay.

User validation on 2026-05-11:

```text
URL:
http://127.0.0.1:9002/Home_Studio.html?verify=r7-3-c1c2-fps1&fpsprobe=1

Recovered result after UI cleanup:
version: fps-root-cause-probe-r7-3-c1c2-fps1
spp/sec: 29.995
fps: 33 -> 29
samples: 18 -> 168
buffer: 1280x720
hotPath: r7-3-c1c2-fps1-movement-capture-gate
```

Conclusion: keep the `movementProtectionConfigAllowed()` guard, keep R7-3 C3 curve behavior, and keep the bottom-left R7-3 validation checkbox removed. The observed bottleneck was tied to visible HTML overlay/control composition rather than the C1 shader path alone.

## Do Not Repeat

Do not keep testing older commits for a 60 FPS baseline unless the user explicitly asks. The last useful clean older benchmark was:

```text
bf6f60c no-snapshot auto
fps: 29 -> 28
spp/sec: 25.994
buffer: 1280x720
hotPath: bf6f60c-r6-lgg-r30-baseline-nosnap-auto
```

That is now the practical speed reference.

## Current Version Contents

The recovered version contains:

```text
Changed:
Home_Studio.html
css/default.css
docs/SOP/Debug_Log.md
docs/SOP/R7：採樣演算法升級.md
docs/tests/r6-3-max-samples.test.js
docs/tests/r6-3-v20-movement-protection.test.js
docs/tests/r7-2-light-importance-sampling.test.js
docs/tests/r7-3-quick-preview-fill.test.js
js/Home_Studio.js
js/InitCommon.js
docs/tests/fps-root-cause-probe.test.js

Core fixes:
js/InitCommon.js
captureMovementProtectionStableFrame():
  if (!movementProtectionConfigAllowed())
      return false;

Removed:
  bottom-left R7-3 checkbox UI
  visible FPS probe overlay

Adjusted:
  right-bottom eye button keeps the bottom-left info line visible
  right-bottom eye button hides snapshot bar and snapshot action buttons together

Cache token:
r7-3-quick-preview-fill-v3al-c1c2-fps1
```

Tests passed before backup:

```text
node docs/tests/r6-3-v20-movement-protection.test.js
node docs/tests/r6-3-max-samples.test.js
node docs/tests/r7-3-quick-preview-fill.test.js
node docs/tests/r7-2-light-importance-sampling.test.js
node docs/tests/fps-root-cause-probe.test.js
node --check js/InitCommon.js
node --check js/Home_Studio.js
git diff --check
```

## Next Task

Open a new branch for real C1 1000SPP baked-lighting data capture.

1. Start from the recovered R7-3 baseline.
2. Capture C1 1000SPP lighting data without reintroducing visible diagnostic overlays.
3. Preserve C3 curve, C3/C4 first-visible-SPP behavior, and snapshot UI/system.
4. Always provide the active validation URL.
