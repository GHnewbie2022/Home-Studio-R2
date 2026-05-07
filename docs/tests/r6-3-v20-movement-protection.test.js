/**
 * R6-3 v20 Movement Protection — Contract Test
 * Run: node docs/tests/r6-3-v20-movement-protection.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const initCommonPath = path.resolve(__dirname, '../../js/InitCommon.js');
const homeStudioPath = path.resolve(__dirname, '../../js/Home_Studio.js');
const pathTracingCommonPath = path.resolve(__dirname, '../../js/PathTracingCommon.js');
const screenOutputPath = path.resolve(__dirname, '../../shaders/ScreenOutput_Fragment.glsl');
const homeShaderPath = path.resolve(__dirname, '../../shaders/Home_Studio_Fragment.glsl');
const htmlPath = path.resolve(__dirname, '../../Home_Studio.html');
const sopPath = path.resolve(__dirname, '../SOP/R6-3-v20：movement protection.md');

const initCommon = fs.readFileSync(initCommonPath, 'utf8');
const homeStudio = fs.readFileSync(homeStudioPath, 'utf8');
const pathTracingCommon = fs.readFileSync(pathTracingCommonPath, 'utf8');
const screenOutput = fs.readFileSync(screenOutputPath, 'utf8');
const homeShader = fs.readFileSync(homeShaderPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const sop = fs.readFileSync(sopPath, 'utf8');

assert(sop.includes('R6-3 v20：Movement Protection SOP'), 'v20 SOP missing title');
assert(sop.includes('本輪實作'), 'v20 SOP must state first implementation scope');
assert(sop.includes('保存上一張穩定畫面'), 'v20 SOP must include stable-frame capture');
assert(sop.includes('移動時混入上一張穩定畫面'), 'v20 SOP must include moving blend');

assert(initCommon.includes("version: 'r6-3-phase2-movement-protection-v22d'"), 'InitCommon must report v22d version');
assert(initCommon.includes('let firstFrameRecoveryMovingTargetSamples = 1'), 'R7-1 C3/C4 moving validation must allow the 1 SPP visible frame');
assert(initCommon.includes('movingTargetSamples: firstFrameRecoveryMovingTargetSamples'), 'First-frame reporter must expose moving target samples');
assert(initCommon.includes('configTargetSamples: firstFrameRecoveryConfigTargetSamples(cameraIsMoving)'), 'First-frame reporter must expose the per-config active target');
assert(initCommon.includes('function firstFrameRecoveryConfigTargetSamples(activeCameraMoving)'), 'First-frame recovery must choose target samples per config');
assert(initCommon.includes('if (!movementProtectionConfigAllowed())\n\t\treturn 1;'), 'C1/C2 first-frame recovery must default to 1 SPP');
assert(initCommon.includes('if (activeCameraMoving)\n\t\treturn firstFrameRecoveryMovingTargetSamples;'), 'C3/C4 active movement must use the moving target sample count');
assert(initCommon.includes('return firstFrameRecoveryTargetSamples;'), 'C3/C4 still or refill recovery must use the stable target sample count');
assert(initCommon.includes('function firstFrameRecoveryLowCostMovementActive(activeCameraMoving)'), 'C3/C4 movement low-cost mode must be explicit');
assert(initCommon.includes('lowCostMovingActive: firstFrameRecoveryLowCostMovementActive(cameraIsMoving)'), 'Movement protection reporter must expose low-cost movement state');
assert(initCommon.includes('firstFrameRecoveryConfigTargetSamples(cameraIsMoving)'), 'Render loop must select target samples from the active movement/config gate');
assert(initCommon.includes('let movementProtectionEnabled = true'), 'Movement protection must be enabled by default for A/B testing');
assert(initCommon.includes('let movementPreviewEnabled = false'), 'Deterministic movement preview must default off after v22a cheap-preview no-go');
assert(initCommon.includes('let movementProtectionMovingBlend = 0.0'), 'Movement protection stable-frame history blend must default off to avoid movement ghosting');
assert(initCommon.includes('if (!Number.isFinite(n)) n = 0.0'), 'Invalid movement blend values must fall back to the ghost-free default');
assert(initCommon.includes('let movementProtectionMinStableSamples = 16'), 'Movement protection must wait for 16 SPP before saving stable frame');
assert(initCommon.includes('let movementProtectionStableReady = false'), 'Movement protection must track stable frame readiness');
assert(initCommon.includes('let movementProtectionPreserveStableAcrossCameraReset = true'), 'Movement protection must preserve stable frame across movement accumulation resets');
assert(initCommon.includes('function invalidateMovementProtectionStableFrame(reason)'), 'Movement protection must expose explicit invalidation for scene/config changes');
assert(initCommon.includes('function movementProtectionConfigAllowed()'), 'Movement protection must gate itself by panel config');
assert(initCommon.includes('return config === 3 || config === 4;'), 'Movement protection must only run on R6-3 movement pain-point configs by default');
assert(initCommon.includes('configAllowed: movementProtectionConfigAllowed()'), 'Movement protection reporter must expose config gate state');
assert(initCommon.includes('let movementProtectionLowSppPreviewStrength = 0.0'), 'Display lift must default off after v20g no-go');
assert(initCommon.includes('let movementProtectionSpatialPreviewStrength = 0.0'), 'Movement protection must default the v20g 13-point spatial preview off after visual no-go');
assert(initCommon.includes('let movementProtectionWidePreviewStrength = 0.0'), 'Wide display blur must default off after v21a no-go');
assert(initCommon.includes('lastPreviewStrength: movementProtectionLastPreviewStrength'), 'Movement protection reporter must expose low-SPP preview strength');
assert(initCommon.includes('spatialPreviewStrength: movementProtectionSpatialPreviewStrength'), 'Movement protection reporter must expose spatial preview strength');
assert(initCommon.includes('widePreviewStrength: movementProtectionWidePreviewStrength'), 'Movement protection reporter must expose wide preview strength');
assert(initCommon.includes('peakPreviewStrength: movementProtectionPeakPreviewStrength'), 'Movement protection reporter must keep a post-move preview evidence value');
assert(initCommon.includes('uniformPreviewStrength:'), 'Movement protection reporter must expose the actual shader uniform value');
assert(initCommon.includes('uniformSpatialPreviewStrength:'), 'Movement protection reporter must expose the actual spatial shader uniform value');
assert(initCommon.includes('uniformWidePreviewStrength:'), 'Movement protection reporter must expose the actual wide shader uniform value');
assert(initCommon.includes('uniformMovementPreviewMode:'), 'Movement protection reporter must expose deterministic movement preview mode');
assert(initCommon.includes('&& !firstFrameRecoveryLowCostMovementActive(cameraIsMoving)'), 'C3/C4 low-cost movement must skip the expensive borrow pass while moving');
assert(initCommon.includes('lastInvalidationReason: movementProtectionLastInvalidationReason'), 'Movement protection reporter must include invalidation reason');
assert(initCommon.includes('movementProtectionRenderTarget'), 'Movement protection must allocate a stable screen render target');
assert(initCommon.includes('window.setMovementProtectionConfig = function'), 'Movement protection must expose a console setter');
assert(initCommon.includes('window.reportMovementProtectionConfig = function'), 'Movement protection must expose a console reporter');
assert(initCommon.includes('captureMovementProtectionStableFrame'), 'Movement protection must capture stable frames');
assert(initCommon.includes('updateMovementProtectionUniforms'), 'Movement protection uniforms must be updated from JS');
assert(initCommon.includes('updateMovementProtectionUniforms(cameraIsMoving);'), 'Movement protection display blend must use actual camera movement, not first-frame burst render mode');
assert(initCommon.includes('if (!cameraIsMoving)\n\t\t\tcaptureMovementProtectionStableFrame();'), 'Movement protection must capture stable frames only when the actual camera is still');
assert(initCommon.includes('ScreenOutput_Fragment.glsl?v=r6-3-movement-protection-v22d'), 'ScreenOutput shader cache token must identify v22d');
assert(html.includes('InitCommon.js?v=r7-1-blue-noise-sampling-v4'), 'HTML must cache-bust InitCommon for R7-1');
assert(html.includes('Home_Studio.js?v=r7-1-blue-noise-sampling-v4'), 'HTML must cache-bust Home_Studio for R7-1');
assert(homeStudio.includes('Home_Studio_Fragment.glsl?v=r7-1-blue-noise-sampling-v4'), 'Home_Studio shader cache token must identify R7-1 blue noise sampling');

assert(homeStudio.includes('invalidateMovementProtectionStableFrame'), 'Home_Studio must invalidate stable frame for non-camera content changes');
assert(homeStudio.includes("invalidateMovementProtectionStableFrame('applyPanelConfig')"), 'Panel config changes must drop stale stable frame');
assert(homeStudio.includes("invalidateMovementProtectionStableFrame('switchCamera')"), 'Camera preset jumps must drop stale stable frame');
assert(homeStudio.includes("invalidateMovementProtectionStableFrame('rebuildActiveLightLUT')"), 'Light pool changes must drop stale stable frame');

assert(screenOutput.includes('uniform sampler2D tMovementProtectionStableTexture;'), 'ScreenOutput must sample stable movement texture');
assert(screenOutput.includes('uniform float uMovementProtectionMode;'), 'ScreenOutput must expose movement protection mode');
assert(screenOutput.includes('uniform float uMovementProtectionBlend;'), 'ScreenOutput must expose movement protection blend');
assert(screenOutput.includes('uniform float uMovementProtectionLowSppPreviewStrength;'), 'ScreenOutput must expose low-SPP preview strength');
assert(screenOutput.includes('uniform float uMovementProtectionSpatialPreviewStrength;'), 'ScreenOutput must expose moving spatial preview strength');
assert(screenOutput.includes('uniform float uMovementProtectionWidePreviewStrength;'), 'ScreenOutput must expose moving wide preview strength');
assert(screenOutput.includes('vec3 HomeStudioReinhardToneMap(vec3 color)'), 'ScreenOutput must use a local vec3 Reinhard helper');
assert(!screenOutput.includes('ReinhardToneMapping(filteredPixelColor)'), 'ScreenOutput must not call Three injected ReinhardToneMapping with vec3');
assert(screenOutput.includes('movementStableColor'), 'ScreenOutput must read stable color');
assert(screenOutput.includes('movementPreviewColor'), 'ScreenOutput must lift C3/C4 moving low-SPP preview');
assert(screenOutput.includes('movementSpatialPreviewHdr'), 'ScreenOutput must build a spatial moving preview in HDR before tone mapping');
assert(screenOutput.includes('movementBrightLimit'), 'ScreenOutput must clamp moving bright speckles against local luma');
assert(screenOutput.includes('movementWidePreviewSum'), 'ScreenOutput must build a 37-tap moving wide preview after v20g no-go');
assert(screenOutput.includes('movementWidePreviewHdr'), 'ScreenOutput must use the 37-tap preview before tone mapping');
assert(screenOutput.includes('displayColor = mix(displayColor, movementStableColor, movementBlend);'), 'ScreenOutput must keep stable color blend available for manual diagnostics');

assert(pathTracingCommon.includes('uniform float uMovementPreviewMode;'), 'Path tracing common chunk must expose deterministic movement preview mode');
assert(pathTracingCommon.includes('pixelOffset = vec2(0.0);'), 'Movement preview must remove stochastic pixel jitter');
assert(pathTracingCommon.includes('previewApertureScale'), 'Movement preview must remove aperture jitter');
assert(pathTracingCommon.includes('? vec4(0.0)'), 'Movement preview must ignore accumulated history');

assert(homeShader.includes('vec3 CalculateMovementPreview'), 'Home shader must provide a deterministic movement preview path');
assert(homeShader.includes('if (uMovementPreviewMode > 0.5'), 'Home shader must route moving frames into deterministic preview');
assert(homeShader.includes('SceneIntersect();'), 'Movement preview must still use the real scene intersection path');
assert(homeShader.includes('return CalculateMovementPreview(objectNormal, objectColor, objectID, pixelSharpness);'), 'Movement preview must bypass stochastic radiance');

console.log('PASS  R6-3 v20 movement protection contract');
