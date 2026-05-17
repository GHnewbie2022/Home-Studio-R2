import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('Home_Studio.html', 'utf8');
const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');

assert.match(html, /id="loading-screen"[^>]*display\s*:\s*flex/);
assert.match(html, /id="loading-ring"/);
assert.match(html, /id="loading-text"/);

assert.match(initCommon, /function updateHomeStudioLoadingUi/);
assert.match(initCommon, /function hideHomeStudioLoadingScreen/);
assert.match(initCommon, /function updateR7310C1RuntimeLoadingProgress/);
assert.match(initCommon, /function markR7310C1RuntimeLoadingStepComplete/);
assert.match(initCommon, /loadingRing\.style\.strokeDashoffset/);
assert.match(initCommon, /loadingText\.innerText\s*=\s*Math\.floor/);
assert.match(initCommon, /loadingScreen\.style\.opacity\s*=\s*'0'/);

const r7310LoaderBlock = initCommon.match(/async function loadR7310C1FullRoomDiffuseRuntimePackage[\s\S]*?function captureR738BakeState/)?.[0] || '';
for (const surface of ['floor', 'northWall', 'eastWall', 'westWall', 'southWall', 'ceiling'])
{
	assert.match(r7310LoaderBlock, new RegExp(`markR7310C1RuntimeLoadingStepComplete\\('${surface}'\\)`));
}
