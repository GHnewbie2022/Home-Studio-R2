# R7-3.10 C1 Static Diffuse Bake Assets

These folders are the runtime bake packages used by R7-3.10 C1 static diffuse rendering.

```text
floor-full-room-1024px-1000spp
  C1 full floor diffuse bake.

north-wall-door-hole-1024px-1000spp
  C1 north wall diffuse bake.
  Includes the door-hole invalid texel region from the runtime pointer.

east-wall-1024px-1000spp
  C1 east wall diffuse bake.
```

Each package keeps:

```text
atlas-patch-000-rgba-f32.bin
  Float32 RGBA radiance atlas.

texel-metadata-patch-000-f32.bin
  Surface texel metadata for validation and reprojection checks.

manifest.json
  Package identity, target surface, bounds, sample count, and artifact names.

coverage-report.json
  Surface coverage summary.

validation-report.json
  Bake validation summary.

raw-hdr-summary.json / surface-class-summary.json
  Capture summaries from the bake runner.
```

Runtime pointers live in:

```text
docs/data/r7-3-10-c1-floor-full-room-diffuse-runtime-package.json
docs/data/r7-3-10-c1-north-wall-full-room-diffuse-runtime-package.json
docs/data/r7-3-10-c1-east-wall-full-room-diffuse-runtime-package.json
```
