/**
 * R6-3 Capture Limit — Contract Test
 * Run: node docs/tests/r6-3-max-samples.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const homeStudioPath = path.resolve(__dirname, '../../js/Home_Studio.js');
const htmlPath = path.resolve(__dirname, '../../Home_Studio.html');
const src = fs.readFileSync(homeStudioPath, 'utf8');
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

assert.deepStrictEqual(milestones, [], 'SNAPSHOT_MILESTONES should be empty while hand-feel testing is active');
assert.deepStrictEqual(overLimit, [], 'SNAPSHOT_MILESTONES should not include unreachable values above MAX_SAMPLES');
assert(src.includes('function setSnapshotCaptureEnabled(enabled)'), 'Snapshot capture must have a runtime toggle');
assert(src.includes('if (!SNAPSHOT_CAPTURE_ENABLED) return null;'), 'Manual snapshot capture must return before PNG encoding when disabled');
assert(src.includes('if (SNAPSHOT_CAPTURE_ENABLED && (SNAPSHOT_MILESTONE_PRESET.includes(sampleCounter)'), 'Auto snapshot path must be gated by the toggle');
assert(src.includes('window.setSnapshotCaptureEnabled = setSnapshotCaptureEnabled;'), 'Snapshot toggle must be exposed for console testing');
assert(html.includes('snapshot-bar'), 'Snapshot bar markup should stay available');
assert(html.includes('btn-toggle-snapshots'), 'Snapshot toggle button should stay available');
assert(html.includes('btn-manual-capture'), 'Manual snapshot button should stay available');
assert(html.includes('btn-save-all'), 'Save-all snapshot button should stay available');

console.log('PASS  MAX_SAMPLES = 1000');
