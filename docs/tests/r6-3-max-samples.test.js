/**
 * R6-3 Capture Limit — Contract Test（2026-05-15 改為 userSppCap UI 契約）
 * Run: node docs/tests/r6-3-max-samples.test.js
 *
 * 舊版契約（已撤回）：
 *   - const MAX_SAMPLES = 1000;
 *   - btn-save-all 按鈕存在
 *   - captureSnapshot 在 SNAPSHOT_CAPTURE_ENABLED=false 時早退
 *   - InitCommon 用 typeof MAX_SAMPLES !== 'undefined' && sampleCounter >= MAX_SAMPLES
 *
 * 新版契約（本檔測試對象）：
 *   - InitCommon.js 用 let userSppCap = 1000;（可由 UI 改）
 *   - HTML 用 <input id="input-spp-cap"> 取代「📦 打包下載全部」按鈕
 *   - captureSnapshot 不再被 SNAPSHOT_CAPTURE_ENABLED 早退（手動存圖獨立於自動快照模式）
 *   - InitCommon 改用 sampleCounter >= userSppCap 作為休眠條件
 *   - 暴露 window.setSppCap / window.reportSppCap 兩個 console / UI 介面
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

// ── 新契約：userSppCap 預設值與相關 API ──────────────────────────────────────
const userSppCapMatch = initCommon.match(/\blet\s+userSppCap\s*=\s*(\d+)\s*;/);
assert(userSppCapMatch, 'userSppCap declaration missing in InitCommon.js');
assert.strictEqual(Number(userSppCapMatch[1]), 1000, 'userSppCap default must stay at 1000 spp to preserve R6-3 baseline');

assert(initCommon.includes('window.setSppCap = function'), 'window.setSppCap must be exposed for console / UI control');
assert(initCommon.includes('window.reportSppCap = function'), 'window.reportSppCap must be exposed for state inspection');
assert(initCommon.includes('sampleCounter >= userSppCap && !cameraIsMoving'),
    'reportSppCap / renderLimit check must use userSppCap instead of MAX_SAMPLES');
assert(initCommon.includes('var renderLimitWasAlreadyReached = sampleCounter >= userSppCap && !cameraIsMoving;'),
    'renderLimitWasAlreadyReached must use the already-rendered sample count vs userSppCap before incrementing');
assert(initCommon.includes('else if (sampleCounter < userSppCap)'),
    'progressive accumulation must gate on userSppCap');

// 舊 MAX_SAMPLES 常數應已從 Home_Studio.js 移除（避免雙來源）
assert(!/\bconst\s+MAX_SAMPLES\s*=/.test(src),
    'Home_Studio.js should no longer declare const MAX_SAMPLES — userSppCap is the single source of truth');

// setSppCap 不可呼叫 wakeRender（會觸發 sceneParamsChanged 導致累積歸零）；
// 須改用 scheduleHomeStudioAnimationFrame 直接喚醒迴圈
const setSppCapMatch = initCommon.match(/window\.setSppCap\s*=\s*function[\s\S]*?\n\};/);
assert(setSppCapMatch, 'setSppCap function body extraction failed');
const setSppCapBody = setSppCapMatch[0];
assert(!/\bwakeRender\s*\(/.test(setSppCapBody),
    'setSppCap must NOT call wakeRender (sceneParamsChanged would reset sampleCounter)');
assert(setSppCapBody.includes('scheduleHomeStudioAnimationFrame()'),
    'setSppCap must wake the render loop via scheduleHomeStudioAnimationFrame');

// ── 新契約：HTML UI 元素 ─────────────────────────────────────────────────────
assert(html.includes('id="input-spp-cap"'),
    'SPP cap input #input-spp-cap must be present');
assert(/value="1000"/.test(html.match(/<input[^>]*id="input-spp-cap"[^>]*>/)[0]),
    'SPP cap input default value attribute should remain 1000');
assert(!html.includes('btn-save-all'),
    'Legacy 打包下載全部 button (btn-save-all) must be removed');

// 既有快照 UI 元素仍應存在
assert(html.includes('snapshot-bar'), 'Snapshot bar markup should stay available');
assert(html.includes('btn-toggle-snapshots'), 'Snapshot toggle button should stay available');
assert(html.includes('btn-manual-capture'), 'Manual snapshot button should stay available');
assert(html.includes('btn-toggle-sampling'), 'Sampling pause/resume button should stay available');
assert(html.includes('btn-step-sampling'), 'Sampling next-sample button should stay available');
assert(html.includes('btn-step-back-sampling'), 'Sampling previous-sample button should stay available');

// ── 新契約：captureSnapshot 與手動存圖解耦自動快照模式 ──────────────────────
assert(!src.includes("if (!SNAPSHOT_CAPTURE_ENABLED) return null;"),
    'captureSnapshot must NOT early-return when SNAPSHOT_CAPTURE_ENABLED is false (manual capture is independent of auto milestone capture)');
// updateSnapshotControls 不應再用 SNAPSHOT_CAPTURE_ENABLED disable 手動存圖按鈕
const updateSnapshotControlsMatch = src.match(/function updateSnapshotControls\(\)\s*\{[\s\S]*?\n\}/);
assert(updateSnapshotControlsMatch, 'updateSnapshotControls function not found');
assert(!/manual\.disabled\s*=\s*!SNAPSHOT_CAPTURE_ENABLED/.test(updateSnapshotControlsMatch[0]),
    'updateSnapshotControls must NOT disable manual capture button via SNAPSHOT_CAPTURE_ENABLED');

// 自動快照路徑仍需保留 SNAPSHOT_CAPTURE_ENABLED 守衛（auto vs manual 分流）
assert(src.includes('function captureDueSnapshotsForCurrentSample()'),
    'Auto snapshot capture must use a reusable per-sample milestone helper');
assert(src.includes("if (!SNAPSHOT_CAPTURE_ENABLED) return;"),
    'Auto snapshot capture (captureDueSnapshotsForCurrentSample) must still respect SNAPSHOT_CAPTURE_ENABLED');

// CSS 端：手動存圖按鈕在 UI 上鎖時仍可點（pointer-events: auto 覆寫）
const cssPath = path.resolve(__dirname, '../../css/default.css');
const css = fs.readFileSync(cssPath, 'utf8');
assert(/#btn-manual-capture\s*\{\s*pointer-events:\s*auto\s*;?\s*\}/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')),
    'Manual capture button must have pointer-events: auto to stay clickable when parent locks pointer events');

// ── 沿用舊契約：採樣暫停 / 步進 / 步退 ──────────────────────────────────────
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

assert(src.includes('function setSnapshotCaptureEnabled(enabled)'), 'Snapshot capture must have a runtime toggle');
assert(src.includes('window.setSnapshotCaptureEnabled = setSnapshotCaptureEnabled;'), 'Snapshot toggle must be exposed for console testing');
assert(src.includes('window.captureDueSnapshotsForCurrentSample = captureDueSnapshotsForCurrentSample;'), 'Auto snapshot helper must be callable from the render loop');
assert(initCommon.includes('window.captureDueSnapshotsForCurrentSample();'), 'Render loop must check snapshots after each rendered sample pass');

const snapshotEnabledMatch = src.match(/\b(?:const|let)\s+SNAPSHOT_CAPTURE_ENABLED\s*=\s*(true|false)\s*;/);
assert(snapshotEnabledMatch, 'SNAPSHOT_CAPTURE_ENABLED declaration missing');
assert.strictEqual(snapshotEnabledMatch[1], 'false', 'SPP snapshot capture must stay disabled for hand-feel testing');

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
assert(initCommon.includes('var renderingStopped = samplingPausedForFrame || renderLimitWasAlreadyReached;'), 'userSppCap must let the current sample finish before hibernating');
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

// 計時器解凍：當 userSppCap 調高、sampleCounter 從休眠重新累加時，frozen 旗標需可逆
assert(src.includes('window._renderTimer.frozen = false;'),
    'Render timer must support unfreezing when userSppCap is raised mid-hibernation');

console.log('PASS  userSppCap = 1000 (UI controlled)');
