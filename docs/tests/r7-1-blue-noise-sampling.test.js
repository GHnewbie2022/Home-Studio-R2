/**
 * R7-1 Blue Noise Sampling — Contract Test
 * Run: node docs/tests/r7-1-blue-noise-sampling.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const initCommonPath = path.join(root, 'js/InitCommon.js');
const homeStudioPath = path.join(root, 'js/Home_Studio.js');
const pathTracingCommonPath = path.join(root, 'js/PathTracingCommon.js');
const htmlPath = path.join(root, 'Home_Studio.html');
const blueNoisePath = path.join(root, 'textures/BlueNoise_R_128.png');

const initCommon = fs.readFileSync(initCommonPath, 'utf8');
const homeStudio = fs.readFileSync(homeStudioPath, 'utf8');
const pathTracingCommon = fs.readFileSync(pathTracingCommonPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

assert(fs.existsSync(blueNoisePath), 'R7-1 must keep using textures/BlueNoise_R_128.png');
assert(initCommon.includes("'textures/BlueNoise_R_128.png'"), 'InitCommon must load the existing blue-noise texture');
assert(initCommon.includes('pathTracingUniforms.tBlueNoiseTexture'), 'Path tracing uniforms must pass the blue-noise texture');

assert(pathTracingCommon.includes('uniform float uR71BlueNoiseSamplingMode;'), 'Path tracing common must expose the R7-1 sampling mode uniform');
assert(initCommon.includes('let r71BlueNoiseSamplingEnabled = true'), 'R7-1 blue-noise sampling must default on in the R7 experiment branch');
assert(initCommon.includes('pathTracingUniforms.uR71BlueNoiseSamplingMode'), 'InitCommon must create the R7-1 sampling mode uniform');
assert(initCommon.includes('window.setR71BlueNoiseSamplingEnabled = function'), 'R7-1 must expose a console setter');
assert(initCommon.includes('window.reportR71BlueNoiseSamplingConfig = function'), 'R7-1 must expose a console reporter');
assert(initCommon.includes("version: 'r7-1-blue-noise-sampling-v4'"), 'R7-1 reporter must expose a version token');
assert(initCommon.includes('blueNoiseTextureReady'), 'R7-1 reporter must expose blue-noise texture readiness');
assert(initCommon.includes('let firstFrameRecoveryMovingTargetSamples = 1'), 'R7-1 C3/C4 visual validation must allow the 1 SPP moving frame');

assert(pathTracingCommon.includes('uR71BlueNoiseSamplingMode > 0.5'), 'RNG path must gate the R7-1 seed mix by the mode uniform');
assert(pathTracingCommon.includes('r71BlueNoiseSeedJitter'), 'RNG path must isolate the R7-1 blue-noise seed jitter helper');
assert(pathTracingCommon.includes('seed += r71BlueNoiseSeedJitter();'), 'R7-1 must mix blue noise into the rng() seed');
assert(pathTracingCommon.includes('uSampleCounter + uFrameCounter'), 'R7-1 seed mix must vary across samples and frames');
assert(!pathTracingCommon.includes('uR71BlueNoiseSamplingMode > 0.5 &&'), 'R7-1 blue-noise seed mix must apply globally without a config gate');

assert(homeStudio.includes('Home_Studio_Fragment.glsl?v=r7-1-blue-noise-sampling-v4'), 'Home_Studio shader cache token must identify R7-1');
assert(html.includes('InitCommon.js?v=r7-1-blue-noise-sampling-v4'), 'HTML must cache-bust InitCommon.js for R7-1');
assert(html.includes('Home_Studio.js?v=r7-1-blue-noise-sampling-v4'), 'HTML must cache-bust Home_Studio.js for R7-1');

console.log('PASS  R7-1 blue noise sampling contract');
