// R7-3.10 Phase 1 Step C / D 分析腳本
// 目的：量化 atlas 在衣櫃 OOBB 邊界附近的紋素亮度分布，
//      並比對 metadata 紋素中心相對於衣櫃 OOBB 的位置。
// 不動 shader / runtime code，只讀二進位產出統計。
//
// 用法：
//   node docs/tools/r7-3-10-step-c-d-analyze.mjs

import fs from 'node:fs';
import path from 'node:path';

const RESOLUTION = 512;
const META_STRIDE = 12;

const FLOOR_PKG = '.omc/r7-3-10-full-room-diffuse-bake/20260513-165203';
const NORTH_PKG = '.omc/r7-3-10-full-room-diffuse-bake/20260513-210338';

const WARDROBE = {
  xMin: 1.35, xMax: 1.91,
  yMin: 0.00, yMax: 1.955,
  zMin: -1.874, zMax: -0.703
};

const FLOOR_BOUNDS = { xMin: -2.11, xMax: 2.11, zMin: -2.074, zMax: 3.256, y: 0.01 };
const NORTH_BOUNDS = { xMin: -2.11, xMax: 2.11, yMin: 0, yMax: 2.905, z: -1.874 };

function loadF32(file)
{
	const buf = fs.readFileSync(file);
	return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function loadAtlas(dir)
{
	return loadF32(path.join(dir, 'atlas-patch-000-rgba-f32.bin'));
}

function loadMeta(dir)
{
	return loadF32(path.join(dir, 'texel-metadata-patch-000-f32.bin'));
}

function pixelAt(atlas, x, y)
{
	if (x < 0 || x >= RESOLUTION || y < 0 || y >= RESOLUTION) return null;
	const i = (y * RESOLUTION + x) * 4;
	return { r: atlas[i], g: atlas[i + 1], b: atlas[i + 2], a: atlas[i + 3] };
}

function metaAt(meta, x, y)
{
	if (x < 0 || x >= RESOLUTION || y < 0 || y >= RESOLUTION) return null;
	const i = (y * RESOLUTION + x) * META_STRIDE;
	return Array.from(meta.subarray(i, i + META_STRIDE));
}

function luma(p) { return 0.299 * p.r + 0.587 * p.g + 0.114 * p.b; }

function uvToWorld_floor(u, v)
{
	const x = FLOOR_BOUNDS.xMin + u * (FLOOR_BOUNDS.xMax - FLOOR_BOUNDS.xMin);
	const z = FLOOR_BOUNDS.zMin + v * (FLOOR_BOUNDS.zMax - FLOOR_BOUNDS.zMin);
	return { x, z };
}

function uvToWorld_north(u, v)
{
	const x = NORTH_BOUNDS.xMin + u * (NORTH_BOUNDS.xMax - NORTH_BOUNDS.xMin);
	const y = NORTH_BOUNDS.yMin + v * (NORTH_BOUNDS.yMax - NORTH_BOUNDS.yMin);
	return { x, y };
}

function pixelCenterUv(px)
{
	return (px + 0.5) / RESOLUTION;
}

function isInsideWardrobeXZ(x, z)
{
	return x >= WARDROBE.xMin && x <= WARDROBE.xMax && z >= WARDROBE.zMin && z <= WARDROBE.zMax;
}

function isInsideWardrobeXY(x, y)
{
	return x >= WARDROBE.xMin && x <= WARDROBE.xMax && y >= WARDROBE.yMin && y <= WARDROBE.yMax;
}

function stats(values)
{
	if (values.length === 0) return { count: 0, mean: 0, min: 0, max: 0 };
	let sum = 0, mn = Infinity, mx = -Infinity;
	for (const v of values) { sum += v; mn = Math.min(mn, v); mx = Math.max(mx, v); }
	return { count: values.length, mean: sum / values.length, min: mn, max: mx };
}

// ---------- Floor analysis ----------

function analyzeFloor()
{
	const atlas = loadAtlas(FLOOR_PKG);
	const meta = loadMeta(FLOOR_PKG);

	console.log('\n=== FLOOR (20260513-165203) ===');
	console.log('worldBounds:', FLOOR_BOUNDS);

	// Find pixel index for X=1.35 (wardrobe xMin)
	const uX135 = (WARDROBE.xMin - FLOOR_BOUNDS.xMin) / (FLOOR_BOUNDS.xMax - FLOOR_BOUNDS.xMin);
	const xPx = Math.round(uX135 * RESOLUTION - 0.5);
	console.log(`X=1.35 → u=${uX135.toFixed(4)} → pixel col ≈ ${xPx}`);

	// Find pixel index for Z=-0.703 (wardrobe zMax / south face)
	const vZ703 = (WARDROBE.zMax - FLOOR_BOUNDS.zMin) / (FLOOR_BOUNDS.zMax - FLOOR_BOUNDS.zMin);
	const zPx = Math.round(vZ703 * RESOLUTION - 0.5);
	console.log(`Z=-0.703 → v=${vZ703.toFixed(4)} → pixel row ≈ ${zPx}`);

	// Wardrobe Z range in pixel space
	const vZmin = (WARDROBE.zMin - FLOOR_BOUNDS.zMin) / (FLOOR_BOUNDS.zMax - FLOOR_BOUNDS.zMin);
	const vZmax = vZ703;
	const zPxMin = Math.round(vZmin * RESOLUTION - 0.5);
	const zPxMax = Math.round(vZmax * RESOLUTION - 0.5);
	console.log(`Wardrobe Z range pixel rows: ${zPxMin} .. ${zPxMax}`);

	// Wardrobe X range
	const vXmax = (WARDROBE.xMax - FLOOR_BOUNDS.xMin) / (FLOOR_BOUNDS.xMax - FLOOR_BOUNDS.xMin);
	const xPxMax = Math.round(vXmax * RESOLUTION - 0.5);
	console.log(`Wardrobe X range pixel cols: ${xPx} .. ${xPxMax}`);

	// === Boundary 1: X=1.35 column (wardrobe west, "黑線" 邊界) ===
	console.log('\n--- Boundary X=1.35 (wardrobe west, 黑線 邊界) ---');
	for (let dx = -5; dx <= 5; dx++)
	{
		const col = xPx + dx;
		const lumaVals = [];
		const alphas = [];
		for (let y = zPxMin; y <= zPxMax; y++)
		{
			const p = pixelAt(atlas, col, y);
			if (!p) continue;
			lumaVals.push(luma(p));
			alphas.push(p.a);
		}
		const ls = stats(lumaVals);
		const aMean = alphas.reduce((s, v) => s + v, 0) / alphas.length;
		const side = dx < 0 ? '外側 (west)' : dx > 0 ? '內側 (east)' : '邊界';
		console.log(`  col ${col} (dx=${dx >= 0 ? '+' + dx : dx}, ${side}): mean luma = ${ls.mean.toFixed(4)}, min=${ls.min.toFixed(4)}, max=${ls.max.toFixed(4)}, alpha mean=${aMean.toFixed(3)}, n=${ls.count}`);
	}

	// === Boundary 2: Z=-0.703 row (wardrobe south, 乾淨邊界) ===
	console.log('\n--- Boundary Z=-0.703 (wardrobe south, 乾淨邊界) ---');
	for (let dy = -5; dy <= 5; dy++)
	{
		const row = zPx + dy;
		const lumaVals = [];
		const alphas = [];
		for (let x = xPx; x <= xPxMax; x++)
		{
			const p = pixelAt(atlas, x, row);
			if (!p) continue;
			lumaVals.push(luma(p));
			alphas.push(p.a);
		}
		const ls = stats(lumaVals);
		const aMean = alphas.reduce((s, v) => s + v, 0) / alphas.length;
		const side = dy < 0 ? '內側 (north)' : dy > 0 ? '外側 (south)' : '邊界';
		console.log(`  row ${row} (dy=${dy >= 0 ? '+' + dy : dy}, ${side}): mean luma = ${ls.mean.toFixed(4)}, min=${ls.min.toFixed(4)}, max=${ls.max.toFixed(4)}, alpha mean=${aMean.toFixed(3)}, n=${ls.count}`);
	}

	// === Metadata 比對：X=1.35 列邊界紋素中心 worldPos ===
	console.log('\n--- Metadata @ X=1.35 column (sample 3 texels around boundary, mid Z) ---');
	const zMidPx = Math.round((zPxMin + zPxMax) / 2);
	for (let dx = -2; dx <= 2; dx++)
	{
		const col = xPx + dx;
		const m = metaAt(meta, col, zMidPx);
		if (!m) continue;
		console.log(`  col ${col} (dx=${dx >= 0 ? '+' + dx : dx}), row ${zMidPx}: meta[0..11] = [${m.map(v => v.toFixed(3)).join(', ')}]`);
	}

	// === Metadata 比對：Z=-0.703 row 邊界紋素中心 worldPos ===
	console.log('\n--- Metadata @ Z=-0.703 row (sample 3 texels around boundary, mid X) ---');
	const xMidPx = Math.round((xPx + xPxMax) / 2);
	for (let dy = -2; dy <= 2; dy++)
	{
		const row = zPx + dy;
		const m = metaAt(meta, xMidPx, row);
		if (!m) continue;
		console.log(`  row ${row} (dy=${dy >= 0 ? '+' + dy : dy}), col ${xMidPx}: meta[0..11] = [${m.map(v => v.toFixed(3)).join(', ')}]`);
	}
}

// ---------- North wall analysis ----------

function analyzeNorthWall()
{
	const atlas = loadAtlas(NORTH_PKG);
	const meta = loadMeta(NORTH_PKG);

	console.log('\n\n=== NORTH WALL (20260513-210338) ===');
	console.log('worldBounds:', NORTH_BOUNDS);

	const uX135 = (WARDROBE.xMin - NORTH_BOUNDS.xMin) / (NORTH_BOUNDS.xMax - NORTH_BOUNDS.xMin);
	const xPx = Math.round(uX135 * RESOLUTION - 0.5);
	console.log(`X=1.35 → u=${uX135.toFixed(4)} → pixel col ≈ ${xPx}`);

	const vY1955 = (WARDROBE.yMax - NORTH_BOUNDS.yMin) / (NORTH_BOUNDS.yMax - NORTH_BOUNDS.yMin);
	const yPx = Math.round(vY1955 * RESOLUTION - 0.5);
	console.log(`Y=1.955 → v=${vY1955.toFixed(4)} → pixel row ≈ ${yPx}`);

	const vYmin = WARDROBE.yMin / NORTH_BOUNDS.yMax;
	const yPxMin = Math.round(vYmin * RESOLUTION - 0.5);
	const yPxMax = yPx;
	console.log(`Wardrobe Y range pixel rows: ${yPxMin} .. ${yPxMax}`);

	const vXmax = (WARDROBE.xMax - NORTH_BOUNDS.xMin) / (NORTH_BOUNDS.xMax - NORTH_BOUNDS.xMin);
	const xPxMax = Math.round(vXmax * RESOLUTION - 0.5);
	console.log(`Wardrobe X range pixel cols: ${xPx} .. ${xPxMax}`);

	// === Boundary 1: X=1.35 column (wardrobe west, 黑線 邊界) ===
	console.log('\n--- Boundary X=1.35 (wardrobe west, 黑線 邊界) ---');
	for (let dx = -5; dx <= 5; dx++)
	{
		const col = xPx + dx;
		const lumaVals = [];
		const alphas = [];
		for (let y = yPxMin; y <= yPxMax; y++)
		{
			const p = pixelAt(atlas, col, y);
			if (!p) continue;
			lumaVals.push(luma(p));
			alphas.push(p.a);
		}
		const ls = stats(lumaVals);
		const aMean = alphas.reduce((s, v) => s + v, 0) / alphas.length;
		const side = dx < 0 ? '外側 (west)' : dx > 0 ? '內側 (east)' : '邊界';
		console.log(`  col ${col} (dx=${dx >= 0 ? '+' + dx : dx}, ${side}): mean luma = ${ls.mean.toFixed(4)}, min=${ls.min.toFixed(4)}, max=${ls.max.toFixed(4)}, alpha mean=${aMean.toFixed(3)}, n=${ls.count}`);
	}

	// === Boundary 2: Y=1.955 row (wardrobe top, 乾淨邊界) ===
	console.log('\n--- Boundary Y=1.955 (wardrobe top, 乾淨邊界) ---');
	for (let dy = -5; dy <= 5; dy++)
	{
		const row = yPx + dy;
		const lumaVals = [];
		const alphas = [];
		for (let x = xPx; x <= xPxMax; x++)
		{
			const p = pixelAt(atlas, x, row);
			if (!p) continue;
			lumaVals.push(luma(p));
			alphas.push(p.a);
		}
		const ls = stats(lumaVals);
		const aMean = alphas.reduce((s, v) => s + v, 0) / alphas.length;
		const side = dy < 0 ? '內側 (down)' : dy > 0 ? '外側 (up)' : '邊界';
		console.log(`  row ${row} (dy=${dy >= 0 ? '+' + dy : dy}, ${side}): mean luma = ${ls.mean.toFixed(4)}, min=${ls.min.toFixed(4)}, max=${ls.max.toFixed(4)}, alpha mean=${aMean.toFixed(3)}, n=${ls.count}`);
	}

	// === Metadata @ X=1.35 column ===
	console.log('\n--- Metadata @ X=1.35 column (sample 3 texels around boundary, mid Y) ---');
	const yMidPx = Math.round((yPxMin + yPxMax) / 2);
	for (let dx = -2; dx <= 2; dx++)
	{
		const col = xPx + dx;
		const m = metaAt(meta, col, yMidPx);
		if (!m) continue;
		console.log(`  col ${col} (dx=${dx >= 0 ? '+' + dx : dx}), row ${yMidPx}: meta[0..11] = [${m.map(v => v.toFixed(3)).join(', ')}]`);
	}

	// === Metadata @ Y=1.955 row ===
	console.log('\n--- Metadata @ Y=1.955 row (sample 3 texels around boundary, mid X) ---');
	const xMidPx = Math.round((xPx + xPxMax) / 2);
	for (let dy = -2; dy <= 2; dy++)
	{
		const row = yPx + dy;
		const m = metaAt(meta, xMidPx, row);
		if (!m) continue;
		console.log(`  row ${row} (dy=${dy >= 0 ? '+' + dy : dy}), col ${xMidPx}: meta[0..11] = [${m.map(v => v.toFixed(3)).join(', ')}]`);
	}
}

analyzeFloor();
analyzeNorthWall();
