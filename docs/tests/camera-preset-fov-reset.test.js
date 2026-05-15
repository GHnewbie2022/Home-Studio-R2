/**
 * Camera preset FOV reset — Contract Test
 * Run: node docs/tests/camera-preset-fov-reset.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const homeStudio = fs.readFileSync(path.join(root, 'js/Home_Studio.js'), 'utf8');

function functionBody(source, name) {
	const marker = `function ${name}(`;
	const start = source.indexOf(marker);
	assert(start >= 0, `missing function ${name}`);
	const nextFunction = source.indexOf('\nfunction ', start + marker.length);
	return source.slice(start, nextFunction >= 0 ? nextFunction : source.length);
}

function assertOrder(source, before, after, message) {
	const beforeIndex = source.indexOf(before);
	const afterIndex = source.indexOf(after);
	assert(beforeIndex >= 0, message + ' (missing before marker)');
	assert(afterIndex >= 0, message + ' (missing after marker)');
	assert(beforeIndex < afterIndex, message);
}

const switchCameraBody = functionBody(homeStudio, 'switchCamera');
const fovResetStart = switchCameraBody.indexOf('worldCamera.fov = 55;');
assert(fovResetStart >= 0, 'switchCamera must reset FOV after wheel zoom');
const afterFovReset = switchCameraBody.slice(fovResetStart);

assert(afterFovReset.includes('pathTracingUniforms.uVLen.value = Math.tan(fovScale);'), 'switchCamera must reset vertical ray length');
assert(afterFovReset.includes('pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;'), 'switchCamera must reset horizontal ray length with current aspect');
assertOrder(afterFovReset, 'pathTracingUniforms.uVLen.value = Math.tan(fovScale);', 'pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;', 'switchCamera must recompute uULen after uVLen');
assert(switchCameraBody.includes('scheduleHomeStudioAnimationFrame();'), 'switchCamera must wake the render loop while sampling is paused');
assertOrder(switchCameraBody, 'needClearAccumulation = true;', 'scheduleHomeStudioAnimationFrame();', 'switchCamera must schedule a frame after marking accumulation clear');

console.log('PASS  camera preset FOV reset contract');
