/**
 * R6-3 Capture Limit — Contract Test
 * Run: node docs/tests/r6-3-max-samples.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const homeStudioPath = path.resolve(__dirname, '../../js/Home_Studio.js');
const initCommonPath = path.resolve(__dirname, '../../js/InitCommon.js');
const htmlPath = path.resolve(__dirname, '../../Home_Studio.html');
const src = fs.readFileSync(homeStudioPath, 'utf8');
const initCommon = fs.readFileSync(initCommonPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const match = src.match(/\bconst\s+MAX_SAMPLES\s*=\s*(\d+)\s*;/);
const snapshotEnabledMatch = src.match(/\b(?:const|let)\s+SNAPSHOT_CAPTURE_ENABLED\s*=\s*(true|false)\s*;/);
const milestonesMatch = src.match(/\b(?:const|let)\s+SNAPSHOT_MILESTONES\s*=\s*\[([^\]]*)\]\s*;/);

assert(match, 'MAX_SAMPLES declaration missing');
assert.strictEqual(Number(match[1]), 1000, 'MAX_SAMPLES should stop long-tail capture at 1000 spp');
assert(snapshotEnabledMatch, 'SNAPSHOT_CAPTURE_ENABLED declaration missing');
assert.strictEqual(snapshotEnabledMatch[1], 'false', 'SPP snapshot capture must stay disabled for hand-feel testing');
assert(milestonesMatch, 'SNAPSHOT_MILESTONES declaration missing');

const maxSamples = Number(match[1]);
const milestones = milestonesMatch[1].trim()
    ? milestonesMatch[1].split(',').map((value) => Number(value.trim()))
    : [];
const overLimit = milestones.filter((value) => value > maxSamples);

function extractFunctionBody(source, signature) {
    const start = source.indexOf(signature);
    assert(start >= 0, `${signature} missing`);
    const open = source.indexOf('{', start);
    assert(open >= 0, `${signature} body missing`);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(open + 1, i);
        }
    }
    assert.fail(`${signature} body not closed`);
}

const setSamplingPausedBody = extractFunctionBody(initCommon, 'window.setSamplingPaused = function(paused)');
const requestSamplingStepOnceBody = extractFunctionBody(initCommon, 'window.requestSamplingStepOnce = function()');
const requestSamplingStepBackBody = extractFunctionBody(initCommon, 'window.requestSamplingStepBack = function()');

assert.deepStrictEqual(milestones, [], 'SNAPSHOT_MILESTONES should be empty while hand-feel testing is active');
assert.deepStrictEqual(overLimit, [], 'SNAPSHOT_MILESTONES should not include unreachable values above MAX_SAMPLES');
assert(src.includes('function setSnapshotCaptureEnabled(enabled)'), 'Snapshot capture must have a runtime toggle');
assert(src.includes('if (!SNAPSHOT_CAPTURE_ENABLED) return null;'), 'Manual snapshot capture must return before PNG encoding when disabled');
assert(src.includes('window.setSnapshotCaptureEnabled = setSnapshotCaptureEnabled;'), 'Snapshot toggle must be exposed for console testing');
assert(src.includes('function captureDueSnapshotsForCurrentSample()'), 'Auto snapshot capture must use a reusable per-sample milestone helper');
assert(src.includes('const currentSamples = Math.round(sampleCounter);'), 'Auto snapshot capture must normalize the current sample number');
assert(src.includes('SNAPSHOT_MILESTONE_PRESET.includes(currentSamples)'), 'Auto snapshot capture must test milestones against the normalized current sample');
assert(src.includes('capturedMilestones.add(currentSamples)'), 'Auto snapshot capture must mark the exact captured milestone');
assert(src.includes('samples: currentSamples'), 'Snapshot chips must record the exact captured milestone sample');
assert(src.includes('window.captureDueSnapshotsForCurrentSample = captureDueSnapshotsForCurrentSample;'), 'Auto snapshot helper must be callable from the render loop');
assert(initCommon.includes('window.captureDueSnapshotsForCurrentSample();'), 'Render loop must check snapshots after each rendered sample pass');
assert(html.includes('snapshot-bar'), 'Snapshot bar markup should stay available');
assert(html.includes('btn-toggle-snapshots'), 'Snapshot toggle button should stay available');
assert(html.includes('btn-manual-capture'), 'Manual snapshot button should stay available');
assert(html.includes('btn-save-all'), 'Save-all snapshot button should stay available');
assert(html.includes('btn-toggle-sampling'), 'Sampling pause/resume button should stay available');
assert(html.includes('btn-step-sampling'), 'Sampling next-sample button should stay available');
assert(html.includes('btn-step-back-sampling'), 'Sampling previous-sample button should stay available');
assert(src.includes("var snapshotActionsEl = document.getElementById('snapshot-actions');"), 'Hide UI must locate snapshot actions');
assert(src.includes('if (cameraInfoEl) cameraInfoEl.style.display = "";'), 'Hide UI must keep the bottom-left info line visible');
assert(src.includes('if (snapshotBarEl) snapshotBarEl.style.display = d;'), 'Hide UI must hide/show the snapshot bar');
assert(src.includes('if (snapshotActionsEl) snapshotActionsEl.style.display = d;'), 'Hide UI must hide/show snapshot action buttons');
assert(!src.includes('if (cameraInfoEl) cameraInfoEl.style.display = d;'), 'Hide UI must not hide the bottom-left info line');
assert(initCommon.includes('let samplingPaused = false'), 'Sampling pause must default to running');
assert(initCommon.includes('let samplingStepOnceRequested = false'), 'Sampling step-once must default to inactive');
assert(initCommon.includes('let samplingStepHistory = []'), 'Sampling step history must default to empty');
assert(initCommon.includes('window.setSamplingPaused = function'), 'Sampling pause must expose a console setter');
assert(initCommon.includes('window.requestSamplingStepOnce = function'), 'Sampling step-once must expose a console helper');
assert(initCommon.includes('window.requestSamplingStepBack = function'), 'Sampling step-back must expose a console helper');
assert(initCommon.includes('resetSamplingStepHistory();'), 'Sampling resume must clear the pause-scoped step history');
assert(initCommon.includes('captureSamplingStepHistoryState();'), 'Sampling pause and step-once must capture restorable history states');
assert(initCommon.includes('restoreSamplingStepHistoryState(previousState);'), 'Sampling step-back must restore the prior sample state');
assert(initCommon.includes('stepHistoryDepth: Math.max(0, samplingStepHistory.length - 1)'), 'Sampling report must expose how many previous samples are available');
assert(initCommon.includes('var samplingStepOnceActive = samplingStepOnceRequested && samplingPaused && !cameraIsMoving'), 'Sampling step-once must only unlock one still-frame sample while paused');
assert(initCommon.includes('var samplingPausedForFrame = samplingPaused && !samplingStepOnceActive && !cameraIsMoving'), 'Sampling pause must freeze still-frame accumulation except the requested next sample');
assert(initCommon.includes('if (firstFrameRecoveryEnabled && !samplingStepOnceActive)'), 'Sampling step-once must suppress first-frame burst so the button advances only one SPP');
assert(initCommon.includes('samplingStepOnceRequested = false;'), 'Sampling step-once request must clear itself after the render loop observes it');
assert(initCommon.includes('var renderingStopped = samplingPausedForFrame ||'), 'Sampling pause must reuse the stopped-render path');
assert(initCommon.includes('var renderLimitWasAlreadyReached = typeof MAX_SAMPLES !== \'undefined\' && sampleCounter >= MAX_SAMPLES && !cameraIsMoving;'), 'MAX_SAMPLES stop condition must use the already-rendered sample count before incrementing');
assert(initCommon.includes('var renderingStopped = samplingPausedForFrame || renderLimitWasAlreadyReached;'), 'MAX_SAMPLES must render the 1000th sample before hibernating');
assert(setSamplingPausedBody.includes('scheduleHomeStudioAnimationFrame();'), 'Sampling pause/resume must wake the stopped animation loop');
assert(requestSamplingStepOnceBody.includes('scheduleHomeStudioAnimationFrame();'), 'Sampling next-sample must wake the stopped animation loop');
assert(requestSamplingStepBackBody.includes('scheduleHomeStudioAnimationFrame();'), 'Sampling previous-sample must wake the stopped animation loop');
assert(src.includes('function updateSamplingControls()'), 'Sampling pause button must keep its label in sync');
assert(src.includes('window.setSamplingPaused(!window.reportSamplingPaused().paused)'), 'Sampling pause button must toggle the runtime state');
assert(src.includes('btn-step-sampling'), 'Sampling next-sample button must be wired by Home_Studio');
assert(src.includes('stepButton.disabled = !report.paused || report.stepOncePending'), 'Sampling next-sample button must only be active while paused and idle');
assert(src.includes('window.requestSamplingStepOnce();'), 'Sampling next-sample button must request exactly one sample');
assert(src.includes('btn-step-back-sampling'), 'Sampling previous-sample button must be wired by Home_Studio');
assert(src.includes('stepBackButton.disabled = !report.paused || report.stepOncePending || report.stepHistoryDepth <= 0'), 'Sampling previous-sample button must only be active when paused with stored history');
assert(src.includes('window.requestSamplingStepBack();'), 'Sampling previous-sample button must restore the previous stored sample');
assert(src.includes('var _samplingPausedForMetrics = !!(_samplingReport && _samplingReport.paused && !cameraIsMoving);'), 'Sampling pause must drive the FPS and timer display');
assert(src.includes('if (!_samplingPausedForMetrics) window._fpsAcc.frames++;'), 'Sampling pause must stop counting animation frames as render FPS');
assert(src.includes('if (_samplingPausedForMetrics) window._fpsAcc.fps = 0;'), 'Sampling pause must show render FPS as 0');
assert(src.includes('pauseStartMs: 0'), 'Render timer must track pause start time');
assert(src.includes('pausedMs: 0'), 'Render timer must track total paused time');
assert(src.includes('window._renderTimer.pausedMs += _nowT - window._renderTimer.pauseStartMs;'), 'Render timer must subtract paused duration after resume');
assert(src.includes('_elapsedMs = window._renderTimer.pauseStartMs - window._renderTimer.startMs - window._renderTimer.pausedMs;'), 'Render timer must freeze elapsed time while sampling is paused');
assert(src.includes('(_samplingPausedForMetrics ? " (暫停)" : "")'), 'Info line must label paused sampling state');
assert(src.includes('function resetRenderTimerForAccumulationRestart(nowMs)'), 'Render timer must expose a reset helper for accumulation restarts');
assert(src.includes('if (cameraIsMoving || needClearAccumulation || sampleCounter < lastSnapshotCheck)'), 'Camera/config accumulation restarts must reset the render timer');
assert(src.includes('resetRenderTimerForAccumulationRestart(_nowT);'), 'Render timer reset must use the current frame timestamp');

console.log('PASS  MAX_SAMPLES = 1000');
