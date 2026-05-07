# HANDOFF - R7-1 NO-GO to R7-2 small experiment

## Read First

Read these files in full, in this order:

1. `/Users/eajrockmacmini/.codex/AGENTS.md`
2. `/Users/eajrockmacmini/.codex/memories/MEMORY.md`
3. `/Users/eajrockmacmini/.codex/memories/Home_Studio_3D.md`
4. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R7：採樣演算法升級.md`
5. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md`
6. `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R3：燈光系統.md`

After reading, stand by and wait for user instruction. Do not auto-execute R7-2.

## Current Branch

Expected branch for the next AI:

`codex/r7-2-light-importance-sampling-small-experiment`

Parent closeout branch:

`codex/r7-blue-noise-small-experiment`

## R7-1 Closeout

R7-1 tested an added blue-noise seed mix:

`uR71BlueNoiseSamplingMode` adds `r71BlueNoiseSeedJitter()` into the `rng()` seed.

Important clarification:

The project already had legacy blue noise before R7-1. `rand()` already reads:

`textures/BlueNoise_R_128.png`

So:

`setR71BlueNoiseSamplingEnabled(false)`

only disables the new R7-1 seed mix. It does not disable legacy `rand()` blue noise.

User saved C3 Cam1 default 1-16 SPP comparison images. The visible result looked essentially the same with R7-1 seed mix on and off. Therefore:

R7-1 added seed mix = NO-GO.

This is not a full blue-noise on/off conclusion.

## Code State to Inherit

Keep these small improvements:

1. C3 / C4 can validate 1 SPP.
2. Snapshot capture checks after each actual sample pass.
3. Sampling pause / resume button exists.
4. FPS and render timer pause while sampling is paused.
5. Render timer resets on config switch, view switch, movement, and rotation.
6. ShaderMaterial common vertex shader load-order warning is fixed.

R7-1 seed mix is kept as a console-toggle experiment but defaults off:

`let r71BlueNoiseSamplingEnabled = false`

Current cache token:

`r7-1-blue-noise-sampling-v6-no-go`

## R7-2 Next Scope

R7-2 starts from light importance sampling, not display filtering.

First likely target:

R3-6 / R3-6.5 Many-Light Sampling and MIS contracts.

Primary question:

Can the light-picking probability reduce C3 / C4 low-SPP high-variance noise while preserving C1-C4 lighting behavior?

Start with inventory and measurement. Do not rewrite the sampling architecture first.

## Guardrails

1. Do not repackage R6-3 no-go display-side routes as new work.
2. Do not assume R7-1 seed mix helps; user already judged it no-go.
3. Preserve existing WebGL2 / HTML path unless the user explicitly changes direction.
4. New measurements, user numbers, conclusions, landmines, ROI updates, and experiment-path changes must be written to both:
   - `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/R7：採樣演算法升級.md`
   - `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/docs/SOP/Debug_Log.md`

## Useful Verification

Run from repo root:

```bash
rtk zsh -lc 'for f in docs/tests/*.test.js; do printf "RUN %s\n" "$f"; node "$f" || exit 1; done'
rtk node --check js/InitCommon.js
rtk node --check js/Home_Studio.js
rtk node --check js/PathTracingCommon.js
rtk env GIT_PAGER=cat git diff --check
```

Local page, if server is running:

`http://localhost:9002/Home_Studio.html`
