// R7-3.10 H5 / H3' 黑線專項 probe — Part 1：nearest hit interval 離線反推（probe-only）
//
// 目的：給定 atlas 解析度，動態反推「衣櫃可見邊界對應的 boundary row」，
//       量化該 row 與相鄰 row 的可見露出帶寬度，比對是否約 1 texel。
//
// 解析度感知（Task 3）：
//   --atlas-resolution=512 / 1024 / 2048（預設 512）
//   boundary row 由 world 邊界 + 解析度動態反推，不再把 row 131 / row 344
//   當成所有解析度的固定真理。512 仍會反推回歷史 row 131(floor)/344(north)。
//
// 取樣鏈（讀自 shaders/Home_Studio_Fragment.glsl + runtime package json）：
//   floor:  localUv.v = (z - zMin) / (zMax - zMin)，zMin=-2.074, zMax=3.256
//   north:  localUv.v = y / 2.905
//   combined: safeUv = (clamp(localUv,0,1) * (res-1) + 0.5) / res
//   NearestFilter: texelIndex = floor(safeUv * res) = floor(localUv*(res-1)+0.5)
//
// 不改任何視覺路徑；純離線數學。
// 可重跑：node docs/tools/r7-3-10-h5-nearest-interval.mjs --atlas-resolution=1024

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

function texelManagedLocalUvRange(texelIndex, res = RES) {
  // safeUv = (localUv*(res-1)+0.5)/res ; texelIndex = floor(safeUv*res) = floor(localUv*(res-1)+0.5)
  // texelIndex == k  <=>  localUv*(res-1)+0.5 ∈ [k, k+1)  <=>  localUv ∈ [(k-0.5)/(res-1), (k+0.5)/(res-1))
  const lo = (texelIndex - 0.5) / (res - 1);
  const hi = (texelIndex + 0.5) / (res - 1);
  return [lo, hi];
}

function texelCenterLocalUv(texelIndex, res = RES) {
  // center: safeUv=(k+0.5)/res -> localUv*(res-1)+0.5=k+0.5 -> localUv=k/(res-1)
  return texelIndex / (res - 1);
}

function nearestTexelIndexForLocalUv(localUv, res = RES) {
  // NearestFilter 實際命中：texelIndex = floor(localUv*(res-1)+0.5)
  return Math.floor(localUv * (res - 1) + 0.5);
}

const FLOOR_Z_MIN = -2.074;
const FLOOR_Z_MAX = 3.256;
const FLOOR_WARDROBE_Z_MAX = -0.703; // 衣櫃南側可見邊界；z > 此值為可見地板（衣櫃外）
const NORTH_Y_MIN = 0.0;
const NORTH_Y_MAX = 2.905;
const NORTH_WARDROBE_Y_MAX = 1.955; // 衣櫃頂面可見邊界；y > 此值為可見北牆（衣櫃外）

function floorBoundaryRowForResolution(res = RES) {
  const localV = (FLOOR_WARDROBE_Z_MAX - FLOOR_Z_MIN) / (FLOOR_Z_MAX - FLOOR_Z_MIN);
  return nearestTexelIndexForLocalUv(localV, res);
}

function northBoundaryRowForResolution(res = RES) {
  const localV = (NORTH_WARDROBE_Y_MAX - NORTH_Y_MIN) / (NORTH_Y_MAX - NORTH_Y_MIN);
  return nearestTexelIndexForLocalUv(localV, res);
}

// rowKind:
//   'boundary'     = 衣櫃可見邊界暗格；texel center 落 wardrobe footprint 內被烘黑，
//                     nearest 命中可見區的露出帶即「畫面黑線」
//   'nearBoundary' = boundary 上下相鄰格，作對照（正常亮值，非黑線來源）
function analyzeFloorRow(row, rowKind) {
  const zMin = FLOOR_Z_MIN, zMax = FLOOR_Z_MAX;
  const span = zMax - zMin; // 5.33
  const [loV, hiV] = texelManagedLocalUvRange(row);
  const zLo = loV * span + zMin;
  const zHi = hiV * span + zMin;
  // runtimeNearestCenter：由 runtime UV bounds + nearest remap 反推的「此 texel 中心對應的 world z」
  // ── 這是 NearestFilter 會 round 到的點，與「bake metadata 寫入時記的 texel center」是兩件事
  const runtimeNearestCenterZ = texelCenterLocalUv(row) * span + zMin;
  const texelWidthM = span / (RES - 1); // 1 texel pitch in world z
  const wardrobeZMax = FLOOR_WARDROBE_Z_MAX;
  const visibleLo = Math.max(zLo, wardrobeZMax);
  const visibleHi = zHi;
  const visibleManagedWidth = Math.max(0, visibleHi - visibleLo);
  const out = {
    surface: 'floor', row, rowKind,
    runtimeManagedWorldZ: [zLo, zHi],
    runtimeManagedWidthMM: (zHi - zLo) * 1000,
    runtimeNearestCenterZ,
    wardrobeZMax,
    visibleManagedZRange: [visibleLo, visibleHi],
    visibleManagedWidthMM: visibleManagedWidth * 1000,
    texelPitchMM: texelWidthM * 1000,
    visibleManagedWidthInTexels: visibleManagedWidth / texelWidthM
  };
  if (rowKind === 'boundary') {
    // 僅 boundary 暗格的可見露出帶才是「畫面黑線」
    out.darkLineVisibleWidthMM = visibleManagedWidth * 1000;
    out.darkLineWidthInTexels = visibleManagedWidth / texelWidthM;
  }
  return out;
}

function analyzeNorthRow(row, rowKind) {
  const yMin = NORTH_Y_MIN, yMax = NORTH_Y_MAX;
  const span = yMax - yMin; // 2.905 (north uv = y/2.905)
  const [loV, hiV] = texelManagedLocalUvRange(row);
  const yLo = loV * span + yMin;
  const yHi = hiV * span + yMin;
  const runtimeNearestCenterY = texelCenterLocalUv(row) * span + yMin;
  const texelWidthM = span / (RES - 1);
  const wardrobeYMax = NORTH_WARDROBE_Y_MAX;
  const visibleLo = Math.max(yLo, wardrobeYMax);
  const visibleHi = yHi;
  const visibleManagedWidth = Math.max(0, visibleHi - visibleLo);
  const out = {
    surface: 'north', row, rowKind,
    runtimeManagedWorldY: [yLo, yHi],
    runtimeManagedWidthMM: (yHi - yLo) * 1000,
    runtimeNearestCenterY,
    wardrobeYMax,
    visibleManagedYRange: [visibleLo, visibleHi],
    visibleManagedWidthMM: visibleManagedWidth * 1000,
    texelPitchMM: texelWidthM * 1000,
    visibleManagedWidthInTexels: visibleManagedWidth / texelWidthM
  };
  if (rowKind === 'boundary') {
    out.darkLineVisibleWidthMM = visibleManagedWidth * 1000;
    out.darkLineWidthInTexels = visibleManagedWidth / texelWidthM;
  }
  return out;
}

const floorBoundaryRow = floorBoundaryRowForResolution(RES);
const northBoundaryRow = northBoundaryRowForResolution(RES);

const result = {
  tool: 'r7-3-10-h5-nearest-interval',
  atlasResolution: RES,
  note: 'probe-only offline nearest-hit-interval back-solve; no visual path changed',
  centerSemantics: {
    runtimeNearestCenter: 'runtime UV bounds + nearest remap 反推；NearestFilter 實際 round 到的點',
    bakeMetadataCenter: 'bake metadata 寫入時記錄的 texel center（consensusMetadata 欄位）',
    note: '兩者不是同一件事；boundary row 的 runtimeNearestCenter 與 consensusMetadata 數值不同屬正常，' +
          '因 metadata builder 與 runtime UV 取用的 bounds / 半 texel 約定不同。' +
          '黑線判讀以 runtimeManagedWorldZ/Y 區間（NearestFilter 實際命中）為準。'
  },
  historicReference: {
    note: '512 解析度下 boundary row 歷史值：floor row 131 / north row 344。' +
          '本工具在 --atlas-resolution=512 時應反推回此兩值（回歸檢查）。',
    floorRow512: 131,
    northRow512: 344
  },
  bakeMetadataCenter512Reference: {
    note: 'consensus 封口記錄，僅對 512 有效；非 runtime nearest center，非各解析度通用。',
    floor: { row131_z: -0.705064, row132_z: -0.694654 },
    north: { row344_y: 1.954634, row345_y: 1.960308 }
  },
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

console.log(JSON.stringify(result, null, 2));
