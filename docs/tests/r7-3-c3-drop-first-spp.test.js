/**
 * R7-3 C3/C4 drop visible 1SPP — Contract Test
 * Run: node docs/tests/r7-3-c3-drop-first-spp.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const initCommon = fs.readFileSync(path.join(root, 'js/InitCommon.js'), 'utf8');
const debugLog = fs.readFileSync(path.join(root, 'docs/SOP/Debug_Log.md'), 'utf8');

function functionBody(source, name) {
	const marker = `function ${name}(`;
	const start = source.indexOf(marker);
	assert(start >= 0, `missing function ${name}`);
	const nextFunction = source.indexOf('\nfunction ', start + marker.length);
	return source.slice(start, nextFunction >= 0 ? nextFunction : source.length);
}

const targetBody = functionBody(initCommon, 'firstFrameRecoveryConfigTargetSamples');
assert(targetBody.includes('return 2;'), 'C3/C4 moving/cleared quick preview must skip visible 1SPP and target 2SPP');
assert(targetBody.includes('config === 3 || config === 4'), '2SPP visible start must be scoped to C3/C4');
assert(initCommon.includes('c3c4DropVisibleFirstSpp'), 'First-frame reporter keeps the historical experiment flag');
assert(debugLog.includes('R7-3｜C4 快速預覽保留丟 1SPP'), 'Debug log must record the C4 visible-1SPP state');

console.log('PASS  R7-3 C3/C4 drop visible 1SPP contract');
