import fs from 'node:fs';
import assert from 'node:assert/strict';

const initCommon = fs.readFileSync('js/InitCommon.js', 'utf8');
const homeStudio = fs.readFileSync('js/Home_Studio.js', 'utf8');

assert.match(
	initCommon,
	/const HOME_STUDIO_KEYBOARD_MOVE_FRAME_TIME_LIMIT = 1 \/ 30;/,
	'Keyboard movement must cap a delayed frame to 1/30s so a stalled render frame cannot move the camera by a large step'
);

assert.match(
	initCommon,
	/function homeStudioKeyboardMoveFrameTime\(value\)[\s\S]*Number\.isFinite\(safeFrameTime\)[\s\S]*Math\.min\(safeFrameTime, HOME_STUDIO_KEYBOARD_MOVE_FRAME_TIME_LIMIT\)/,
	'Keyboard movement must sanitize and clamp the frame time before applying position changes'
);

assert.match(
	initCommon,
	/const keyboardMoveFrameTime = homeStudioKeyboardMoveFrameTime\(frameTime\);/,
	'Keyboard movement must use a dedicated clamped frame time'
);

const keyboardMoveUses = Array.from(initCommon.matchAll(/cameraFlightSpeed \* keyboardMoveFrameTime/g));
assert.equal(
	keyboardMoveUses.length,
	6,
	'W, S, A, D, E, and C movement must all use the clamped keyboard move frame time'
);

assert.doesNotMatch(
	initCommon,
	/cameraControlsObject\.position\.(?:add|sub)\([^)]*cameraFlightSpeed \* frameTime/,
	'Camera keyboard movement must not use raw frameTime directly'
);

assert.match(
	homeStudio,
	/cameraFlightSpeed = 2;/,
	'Keyboard camera movement should use the slower verified walking speed'
);

console.log('Home Studio keyboard movement smoothing contract passed');
