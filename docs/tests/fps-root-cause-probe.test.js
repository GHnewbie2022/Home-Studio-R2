/**
 * FPS root-cause probe contract.
 *
 * The helper is diagnostic-only and should not create a visible overlay.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..', '..');
const initCommon = fs.readFileSync(path.join(root, 'js', 'InitCommon.js'), 'utf8');

assert(
  initCommon.includes('window.reportHomeStudioFpsRootCauseAfterMs = async function'),
  'missing FPS root-cause runtime probe helper'
);

assert(
  !initCommon.includes('fps-probe-overlay') &&
    !initCommon.includes('showHomeStudioFpsProbeOverlay') &&
    !initCommon.includes("params.get('fpsprobe') === '1'"),
  'FPS probe must not create a visible URL-triggered overlay'
);

assert(
  initCommon.includes('canvasPixels') &&
    initCommon.includes('devicePixelRatio') &&
    initCommon.includes('sppPerSec'),
  'FPS probe must report canvas size, DPR, and sample throughput'
);

assert(
  initCommon.includes('firstFrameRecovery') &&
    initCommon.includes('movementProtection') &&
    initCommon.includes('shaderHotPath') &&
    initCommon.includes('renderingWouldStop') &&
    initCommon.includes('hibernating') &&
    initCommon.includes('autoResumedSampling') &&
    initCommon.includes('initialSamplingState') &&
    initCommon.includes('r73QuickPreview') &&
    initCommon.includes('borrowStrength'),
  'FPS probe must report active pass and feature toggle state'
);

console.log('PASS  FPS root-cause probe contract');
