let SCREEN_WIDTH;
let SCREEN_HEIGHT;
let canvas, context;
let container, stats;
let controls;
let pathTracingScene, screenCopyScene, screenOutputScene;
let pathTracingUniforms = {};
let pathTracingUniformsGroups = [];
let screenCopyUniforms, screenOutputUniforms;
let pathTracingDefines;
let pathTracingVertexShader, pathTracingFragmentShader;
const pendingCommonVertexShaderCallbacks = [];
let demoFragmentShaderFileName;
let screenCopyVertexShader, screenCopyFragmentShader;
let screenOutputVertexShader, screenOutputFragmentShader;
let triangleGeometry = new THREE.BufferGeometry();
let trianglePositions = [];
let pathTracingMaterial, pathTracingMesh;
let screenCopyMaterial, screenCopyMesh;
let screenOutputMaterial, screenOutputMesh;
let pathTracingRenderTarget, screenCopyRenderTarget;
let movementProtectionRenderTarget;
// R6 LGG-r16 J3：B 模 1/8 解析度 14 彈借光 buffer（暗角真光來源）
// borrowPathTracingRenderTarget 14 彈 path tracer accumulator sum；
// borrowScreenCopyRenderTarget  ping-pong 副本，給下一 frame 當 tPreviousTexture
let borrowPathTracingRenderTarget, borrowScreenCopyRenderTarget;
// R2-UI Bloom：multi-pass bloom 的 1/4 解析度 ping-pong render targets + scenes/materials
// R2-UI Bloom multi-scale：4 層 mip chain (1/2, 1/4, 1/8, 1/16)
let bloomMip = []; // [0]=1/2, [1]=1/4, [2]=1/8, [3]=1/16, [4]=1/32, [5]=1/64, [6]=1/128
// R2-UI：金字塔有效層數，UI slider 可切 3~7，影響 STEP 2.5 的 downsample/upsample chain 長度
window.bloomMipCount = 7;
let bloomBrightpassScene, bloomDownsampleScene, bloomUpsampleScene;
let bloomBrightpassMaterial, bloomDownsampleMaterial, bloomUpsampleMaterial;
let bloomBrightpassMesh, bloomDownsampleMesh, bloomUpsampleMesh;
let bloomBrightpassUniforms, bloomDownsampleUniforms, bloomUpsampleUniforms;
let orthoCamera, worldCamera;
let renderer, clockTimer;
let frameTime, elapsedTime;
let sceneIsDynamic = false;
let cameraFlightSpeed = 60;
let cameraRotationSpeed = 1;
let gamepad_cameraXRotationSpeed = 1;
let gamepad_cameraYRotationSpeed = 1;
let fovScale;
let storedFOV = 0;
let increaseFOV = false;
let decreaseFOV = false;
let dollyCameraIn = false;
let dollyCameraOut = false;
let apertureSize = 0.0;
let increaseAperture = false;
let decreaseAperture = false;
let apertureChangeSpeed = 1;
let focusDistance = 132.0;
let increaseFocusDist = false;
let decreaseFocusDist = false;
let focusDistanceChangeSpeed = 1;
let pixelRatio = 1.0;
let windowIsBeingResized = false;
// R2-UI：參數變化時觸發一次「相機剛移動完」的 restart，讓累加 buffer 乾淨刷新
let sceneParamsChanged = false;
// R6 Route X：後製滑桿（陰影補光等）變動時用，不重置 path tracer 累積、只觸發一次 STEP 3 重輸出
let postProcessChanged = false;
// R2-UI：切換 Cam 時整塊清空 render target，瞬間消除殘影（犧牲短暫噪點）
let needClearAccumulation = false;
// R2-UI：60 FPS cap（避免 120Hz 螢幕把 path tracing 推到 120 FPS 滿載）
let lastRenderTime = 0;
const FRAME_INTERVAL_MS = 1000 / 60;
let homeStudioAnimationFrameId = 0;
let homeStudioAnimationSleeping = false;
let TWO_PI = Math.PI * 2;
let sampleCounter = 0.0; // will get increased by 1 in animation loop before rendering
let frameCounter = 1.0; // 1 instead of 0 because it is used as a rng() seed in pathtracing shader
let samplingPaused = false;
let samplingStepOnceRequested = false;
let samplingStepHistory = [];
let firstFrameRecoveryEnabled = true;
let firstFrameRecoveryTargetSamples = 4;
let firstFrameRecoveryMovingTargetSamples = 1;
let firstFrameRecoveryClearWhileMoving = true;
let firstFrameRecoveryLastPassCount = 1;
let firstFrameRecoveryLastReason = 'normal';
let firstFrameRecoveryLastFinalSamples = 0;
let r71BlueNoiseSamplingEnabled = false;
let movementProtectionEnabled = true;
let movementPreviewEnabled = false;
let movementProtectionMovingBlend = 0.0;
let movementProtectionLowSppPreviewStrength = 0.0;
let movementProtectionSpatialPreviewStrength = 0.0;
let movementProtectionWidePreviewStrength = 0.0;
let movementProtectionMinStableSamples = 16;
let movementProtectionStableReady = false;
let movementProtectionPreserveStableAcrossCameraReset = true;
let movementProtectionLastCaptureSamples = 0;
let movementProtectionLastBlend = 0.0;
let movementProtectionLastPreviewStrength = 0.0;
let movementProtectionLastSpatialPreviewStrength = 0.0;
let movementProtectionLastWidePreviewStrength = 0.0;

function runAfterCommonVertexShaderReady(callback)
{
	if (typeof pathTracingVertexShader === 'string' && pathTracingVertexShader.length > 0)
	{
		callback();
		return;
	}
	pendingCommonVertexShaderCallbacks.push(callback);
}

function flushCommonVertexShaderCallbacks()
{
	while (pendingCommonVertexShaderCallbacks.length > 0)
		pendingCommonVertexShaderCallbacks.shift()();
}

function createCommonVertexShaderMaterial(params)
{
	if (typeof pathTracingVertexShader !== 'string' || pathTracingVertexShader.length === 0)
		throw new Error('[InitCommon] common vertex shader must load before creating ShaderMaterial');

	var materialParams = Object.assign({}, params);
	materialParams.vertexShader = pathTracingVertexShader;
	return new THREE.ShaderMaterial(materialParams);
}
let movementPreviewLastMode = 0.0;
let movementProtectionPeakPreviewStrength = 0.0;
let movementProtectionPeakPreviewSamples = 0;
let movementProtectionPeakPreviewConfig = 0;
let movementProtectionLastInvalidationReason = 'initial';
const R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT = [3.20, 1.70, 1.50, 1.25];
let r73QuickPreviewFillEnabled = true;
let r73QuickPreviewFillStrength = R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[0];
let r73QuickPreviewFillEffectiveStrength = 1.00;
let cameraIsMoving = false;
let cameraRecentlyMoving = false;
let isPaused = true;
let inputMovementHorizontal = 0;
let inputMovementVertical = 0;
let oldYawRotation, oldPitchRotation;
let mobileJoystickControls = null;
let mobileShowButtons = true;
let mobileUseDarkButtons = false;
let oldDeltaX = 0;
let oldDeltaY = 0;
let newDeltaX = 0;
let newDeltaY = 0;
let mobileControlsMoveX = 0;
let mobileControlsMoveY = 0;
let oldPinchWidthX = 0;
let oldPinchWidthY = 0;
let pinchDeltaX = 0;
let pinchDeltaY = 0;
let useGenericInput = true;
let EPS_intersect = 0.01; // default precision
let textureLoader = new THREE.TextureLoader();
let blueNoiseTexture;
let useToneMapping = true;
let canPress_O = true;
let canPress_P = true;
let allowOrthographicCamera = true;
let changeToOrthographicCamera = false;
let changeToPerspectiveCamera = false;
let pixelEdgeSharpness = 0.75;
let edgeSharpenSpeed = 0.05;
//let filterDecaySpeed = 0.0001;

let ableToEngagePointerLock = true;
let pixel_ResolutionObject;
let needChangePixelResolution = false;
let orthographicCamera_ToggleObject;
let currentlyUsingOrthographicCamera = false;

// the following variables will be used to calculate rotations and directions from the camera
let cameraDirectionVector = new THREE.Vector3(); //for moving where the camera is looking
let cameraRightVector = new THREE.Vector3(); //for strafing the camera right and left
let cameraUpVector = new THREE.Vector3(); //for moving camera up and down
let cameraControlsObject; //for positioning and moving the camera itself
let cameraControlsYawObject; //allows access to control camera's left/right movements through mobile input
let cameraControlsPitchObject; //allows access to control camera's up/down movements through mobile input
let PI_2 = Math.PI / 2; //used by controls below
let inputRotationHorizontal = 0;
let inputRotationVertical = 0;

let infoElement = document.getElementById('info');
infoElement.style.cursor = "default";
infoElement.style.userSelect = "none";
infoElement.style.MozUserSelect = "none";

let cameraInfoElement = document.getElementById('cameraInfo');
cameraInfoElement.style.cursor = "default";
cameraInfoElement.style.userSelect = "none";
cameraInfoElement.style.MozUserSelect = "none";

let mouseControl = true;
let pointerlockChange;
let fileLoader = new THREE.FileLoader();

let gamepads = null;
let gp = null;
let gamepadIndex = null;
let gamepad_Button0Pressed = false;
let gamepad_DirectionUpPressed = false;
let gamepad_DirectionDownPressed = false;
let gamepad_DirectionLeftPressed = false;
let gamepad_DirectionRightPressed = false;
window.addEventListener('gamepadconnected', (event) => {
	gamepadIndex = event.gamepad.index;
	console.log("Gamepad connected at index", gamepadIndex);
});
window.addEventListener('gamepaddisconnected', (event) => {
	console.log("Gamepad disconnected from index", event.gamepad.index);
	gamepadIndex = null;
});

function normalizeFirstFrameRecoveryTargetSamples(value)
{
	var n = Math.trunc(Number(value));
	if (!Number.isFinite(n)) n = 4;
	if (n < 1) n = 1;
	if (n > 16) n = 16;
	return n;
}

window.setFirstFrameRecoveryConfig = function(config)
{
	var nextConfig = config || {};
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'enabled'))
		firstFrameRecoveryEnabled = !!nextConfig.enabled;
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'targetSamples'))
		firstFrameRecoveryTargetSamples = normalizeFirstFrameRecoveryTargetSamples(nextConfig.targetSamples);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'movingTargetSamples'))
		firstFrameRecoveryMovingTargetSamples = normalizeFirstFrameRecoveryTargetSamples(nextConfig.movingTargetSamples);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'clearWhileMoving'))
		firstFrameRecoveryClearWhileMoving = !!nextConfig.clearWhileMoving;
	return window.reportFirstFrameRecoveryConfig();
};

window.reportFirstFrameRecoveryConfig = function()
{
	return {
		version: 'r6-3-phase2-first-frame-burst-v19',
		enabled: firstFrameRecoveryEnabled,
		targetSamples: firstFrameRecoveryTargetSamples,
		movingTargetSamples: firstFrameRecoveryMovingTargetSamples,
		configTargetSamples: firstFrameRecoveryConfigTargetSamples(cameraIsMoving),
		c3c4DropVisibleFirstSpp: firstFrameRecoveryConfigTargetSamples(true) === 2,
		clearWhileMoving: firstFrameRecoveryClearWhileMoving,
		lastPassCount: firstFrameRecoveryLastPassCount,
		lastReason: firstFrameRecoveryLastReason,
		lastFinalSamples: firstFrameRecoveryLastFinalSamples,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
	};
};

window.setSamplingPaused = function(paused)
{
	var wasSamplingPaused = samplingPaused;
	samplingPaused = !!paused;
	if (!samplingPaused)
	{
		samplingStepOnceRequested = false;
		resetSamplingStepHistory();
	}
	else if (!wasSamplingPaused || samplingStepHistory.length === 0)
	{
		captureSamplingStepHistoryState();
	}
	if (typeof window.updateSamplingControls === 'function')
		window.updateSamplingControls();
	if (typeof scheduleHomeStudioAnimationFrame === 'function')
		scheduleHomeStudioAnimationFrame();
	return window.reportSamplingPaused();
};

window.requestSamplingStepOnce = function()
{
	samplingPaused = true;
	if (samplingStepHistory.length === 0)
		captureSamplingStepHistoryState();
	samplingStepOnceRequested = true;
	if (typeof window.updateSamplingControls === 'function')
		window.updateSamplingControls();
	if (typeof scheduleHomeStudioAnimationFrame === 'function')
		scheduleHomeStudioAnimationFrame();
	return window.reportSamplingPaused();
};

window.requestSamplingStepBack = function()
{
	if (!samplingPaused || samplingStepOnceRequested || samplingStepHistory.length <= 1)
		return window.reportSamplingPaused();

	disposeSamplingStepHistoryState(samplingStepHistory.pop());
	var previousState = samplingStepHistory[samplingStepHistory.length - 1];
	restoreSamplingStepHistoryState(previousState);
	if (typeof window.updateSamplingControls === 'function')
		window.updateSamplingControls();
	if (typeof scheduleHomeStudioAnimationFrame === 'function')
		scheduleHomeStudioAnimationFrame();
	return window.reportSamplingPaused();
};

window.reportSamplingPaused = function()
{
	return {
		paused: samplingPaused,
		stepOncePending: samplingStepOnceRequested,
		stepHistoryDepth: Math.max(0, samplingStepHistory.length - 1),
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
	};
};

function createSamplingHistoryRenderTarget(sourceRenderTarget)
{
	if (!sourceRenderTarget || !sourceRenderTarget.texture || !THREE)
		return null;
	var sourceTexture = sourceRenderTarget.texture;
	var historyRenderTarget = new THREE.WebGLRenderTarget(sourceRenderTarget.width, sourceRenderTarget.height, {
		minFilter: sourceTexture.minFilter,
		magFilter: sourceTexture.magFilter,
		format: sourceTexture.format,
		type: sourceTexture.type,
		depthBuffer: false,
		stencilBuffer: false
	});
	historyRenderTarget.texture.generateMipmaps = false;
	return historyRenderTarget;
}

function copySamplingRenderTarget(sourceRenderTarget, targetRenderTarget)
{
	if (!renderer || !sourceRenderTarget || !targetRenderTarget || !screenCopyUniforms || !screenCopyScene || !orthoCamera)
		return false;
	var savedSourceTexture = screenCopyUniforms.tPathTracedImageTexture.value;
	screenCopyUniforms.tPathTracedImageTexture.value = sourceRenderTarget.texture;
	renderer.setRenderTarget(targetRenderTarget);
	renderer.render(screenCopyScene, orthoCamera);
	screenCopyUniforms.tPathTracedImageTexture.value = savedSourceTexture;
	return true;
}

function disposeSamplingStepHistoryState(state)
{
	if (!state)
		return;
	['pathTracing', 'screenCopy', 'borrowPathTracing', 'borrowScreenCopy'].forEach(function(key)
	{
		if (state[key] && typeof state[key].dispose === 'function')
			state[key].dispose();
	});
}

function resetSamplingStepHistory()
{
	samplingStepHistory.forEach(disposeSamplingStepHistoryState);
	samplingStepHistory = [];
}

function captureSamplingStepHistoryState()
{
	if (!samplingPaused || !pathTracingRenderTarget || !screenCopyRenderTarget)
		return null;

	var state = {
		sampleCounter: sampleCounter,
		frameCounter: frameCounter,
		pathTracing: createSamplingHistoryRenderTarget(pathTracingRenderTarget),
		screenCopy: createSamplingHistoryRenderTarget(screenCopyRenderTarget),
		borrowPathTracing: borrowPathTracingRenderTarget ? createSamplingHistoryRenderTarget(borrowPathTracingRenderTarget) : null,
		borrowScreenCopy: borrowScreenCopyRenderTarget ? createSamplingHistoryRenderTarget(borrowScreenCopyRenderTarget) : null
	};

	var copied = state.pathTracing && state.screenCopy
		&& copySamplingRenderTarget(pathTracingRenderTarget, state.pathTracing)
		&& copySamplingRenderTarget(screenCopyRenderTarget, state.screenCopy);
	if (copied && borrowPathTracingRenderTarget && state.borrowPathTracing)
		copied = copySamplingRenderTarget(borrowPathTracingRenderTarget, state.borrowPathTracing);
	if (copied && borrowScreenCopyRenderTarget && state.borrowScreenCopy)
		copied = copySamplingRenderTarget(borrowScreenCopyRenderTarget, state.borrowScreenCopy);

	if (!copied)
	{
		disposeSamplingStepHistoryState(state);
		return null;
	}

	samplingStepHistory.push(state);
	return state;
}

function restoreSamplingStepHistoryState(state)
{
	if (!state || !pathTracingRenderTarget || !screenCopyRenderTarget)
		return false;

	var copied = copySamplingRenderTarget(state.pathTracing, pathTracingRenderTarget)
		&& copySamplingRenderTarget(state.screenCopy, screenCopyRenderTarget);
	if (copied && state.borrowPathTracing && borrowPathTracingRenderTarget)
		copied = copySamplingRenderTarget(state.borrowPathTracing, borrowPathTracingRenderTarget);
	if (copied && state.borrowScreenCopy && borrowScreenCopyRenderTarget)
		copied = copySamplingRenderTarget(state.borrowScreenCopy, borrowScreenCopyRenderTarget);
	if (!copied)
		return false;

	sampleCounter = state.sampleCounter;
	frameCounter = state.frameCounter;
	firstFrameRecoveryLastFinalSamples = Math.round(sampleCounter);
	if (pathTracingUniforms)
	{
		if (pathTracingUniforms.uSampleCounter) pathTracingUniforms.uSampleCounter.value = sampleCounter;
		if (pathTracingUniforms.uFrameCounter) pathTracingUniforms.uFrameCounter.value = frameCounter;
	}
	if (screenOutputUniforms)
	{
		if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
		if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
	}
	postProcessChanged = true;
	return true;
}

window.setR71BlueNoiseSamplingEnabled = function(enabled)
{
	r71BlueNoiseSamplingEnabled = !!enabled;
	if (pathTracingUniforms && pathTracingUniforms.uR71BlueNoiseSamplingMode)
		pathTracingUniforms.uR71BlueNoiseSamplingMode.value = r71BlueNoiseSamplingEnabled ? 1.0 : 0.0;
	cameraIsMoving = true;
	return window.reportR71BlueNoiseSamplingConfig();
};

window.reportR71BlueNoiseSamplingConfig = function()
{
	return {
		version: 'r7-1-blue-noise-sampling-v6-no-go',
		enabled: r71BlueNoiseSamplingEnabled,
		uniformMode: pathTracingUniforms && pathTracingUniforms.uR71BlueNoiseSamplingMode
			? pathTracingUniforms.uR71BlueNoiseSamplingMode.value
			: null,
		blueNoiseTextureReady: !!blueNoiseTexture,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
	};
};

function normalizeMovementProtectionBlend(value)
{
	var n = Number(value);
	if (!Number.isFinite(n)) n = 0.0;
	if (n < 0.0) n = 0.0;
	if (n > 0.95) n = 0.95;
	return n;
}

function normalizeMovementProtectionPreviewStrength(value)
{
	var n = Number(value);
	if (!Number.isFinite(n)) n = 0.0;
	if (n < 0.0) n = 0.0;
	if (n > 1.0) n = 1.0;
	return n;
}

function normalizeMovementProtectionMinStableSamples(value)
{
	var n = Math.trunc(Number(value));
	if (!Number.isFinite(n)) n = 16;
	if (n < 1) n = 1;
	if (n > 512) n = 512;
	return n;
}

window.setMovementProtectionConfig = function(config)
{
	var nextConfig = config || {};
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'enabled'))
		movementProtectionEnabled = !!nextConfig.enabled;
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'movementPreviewEnabled'))
		movementPreviewEnabled = !!nextConfig.movementPreviewEnabled;
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'movingBlend'))
		movementProtectionMovingBlend = normalizeMovementProtectionBlend(nextConfig.movingBlend);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'lowSppPreviewStrength'))
		movementProtectionLowSppPreviewStrength = normalizeMovementProtectionPreviewStrength(nextConfig.lowSppPreviewStrength);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'spatialPreviewStrength'))
		movementProtectionSpatialPreviewStrength = normalizeMovementProtectionPreviewStrength(nextConfig.spatialPreviewStrength);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'widePreviewStrength'))
		movementProtectionWidePreviewStrength = normalizeMovementProtectionPreviewStrength(nextConfig.widePreviewStrength);
	if (Object.prototype.hasOwnProperty.call(nextConfig, 'minStableSamples'))
		movementProtectionMinStableSamples = normalizeMovementProtectionMinStableSamples(nextConfig.minStableSamples);
	if (!movementProtectionEnabled)
	{
		movementProtectionLastBlend = 0.0;
		movementProtectionLastPreviewStrength = 0.0;
		movementProtectionLastSpatialPreviewStrength = 0.0;
		movementProtectionLastWidePreviewStrength = 0.0;
	}
	updateMovementPreviewUniforms(cameraIsMoving);
	updateMovementProtectionUniforms(cameraIsMoving);
	return window.reportMovementProtectionConfig();
};

window.reportMovementProtectionConfig = function()
{
	return {
		version: 'r6-3-phase2-movement-protection-v22d',
		enabled: movementProtectionEnabled,
		movementPreviewEnabled: movementPreviewEnabled,
		configAllowed: movementProtectionConfigAllowed(),
		lowCostMovingActive: firstFrameRecoveryLowCostMovementActive(cameraIsMoving),
		movingBlend: movementProtectionMovingBlend,
		lowSppPreviewStrength: movementProtectionLowSppPreviewStrength,
		spatialPreviewStrength: movementProtectionSpatialPreviewStrength,
		widePreviewStrength: movementProtectionWidePreviewStrength,
		minStableSamples: movementProtectionMinStableSamples,
		stableReady: movementProtectionStableReady,
		preserveStableAcrossCameraReset: movementProtectionPreserveStableAcrossCameraReset,
		lastCaptureSamples: movementProtectionLastCaptureSamples,
		lastBlend: movementProtectionLastBlend,
		lastPreviewStrength: movementProtectionLastPreviewStrength,
		lastSpatialPreviewStrength: movementProtectionLastSpatialPreviewStrength,
		lastWidePreviewStrength: movementProtectionLastWidePreviewStrength,
		peakPreviewStrength: movementProtectionPeakPreviewStrength,
		peakPreviewSamples: movementProtectionPeakPreviewSamples,
		peakPreviewConfig: movementProtectionPeakPreviewConfig,
		uniformPreviewStrength: screenOutputUniforms && screenOutputUniforms.uMovementProtectionLowSppPreviewStrength
			? screenOutputUniforms.uMovementProtectionLowSppPreviewStrength.value
			: null,
		uniformSpatialPreviewStrength: screenOutputUniforms && screenOutputUniforms.uMovementProtectionSpatialPreviewStrength
			? screenOutputUniforms.uMovementProtectionSpatialPreviewStrength.value
			: null,
		uniformWidePreviewStrength: screenOutputUniforms && screenOutputUniforms.uMovementProtectionWidePreviewStrength
			? screenOutputUniforms.uMovementProtectionWidePreviewStrength.value
			: null,
		lastMovementPreviewMode: movementPreviewLastMode,
		uniformMovementPreviewMode: pathTracingUniforms && pathTracingUniforms.uMovementPreviewMode
			? pathTracingUniforms.uMovementPreviewMode.value
			: null,
		lastInvalidationReason: movementProtectionLastInvalidationReason,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0),
		cameraIsMoving: !!cameraIsMoving
	};
};

function movementProtectionConfigAllowed()
{
	var config = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	return config === 3 || config === 4;
}

function firstFrameRecoveryMovementConfigAllowed()
{
	return movementProtectionConfigAllowed();
}

function firstFrameRecoveryConfigTargetSamples(activeCameraMoving)
{
	var config = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	if ((config === 3 || config === 4) && activeCameraMoving)
		return 2;
	if (!movementProtectionConfigAllowed())
		return 1;
	if (activeCameraMoving)
		return firstFrameRecoveryMovingTargetSamples;
	return firstFrameRecoveryTargetSamples;
}

function firstFrameRecoveryLowCostMovementActive(activeCameraMoving)
{
	return movementProtectionConfigAllowed() && !!activeCameraMoving;
}

function movementPreviewActive(activeCameraMoving)
{
	return movementPreviewEnabled && movementProtectionEnabled && movementProtectionConfigAllowed() && !!activeCameraMoving;
}

function r73QuickPreviewFillConfigAllowed()
{
	var config = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	return config === 3;
}

function r73QuickPreviewFillQuickModeActive()
{
	var btnB = document.getElementById('btnGroupB');
	return !!(btnB && btnB.classList.contains('glow-white'));
}

function currentR73QuickPreviewFillSamples()
{
	return Math.max(1.0, Math.round(typeof sampleCounter === 'number' ? sampleCounter : 1.0));
}

function computeR73QuickPreviewFillEffectiveStrength(samples)
{
	samples = Math.max(1.0, Math.round(Number(samples) || 1.0));
	if (samples <= 4.0)
		return R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[samples - 1];
	var spp4Strength = R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[3];
	if (spp4Strength <= 1.0)
		return spp4Strength;
	return 1.0 + (spp4Strength - 1.0) / Math.pow(2.0, samples - 4.0);
}

function updateR73QuickPreviewFillUniforms()
{
	var applied = r73QuickPreviewFillEnabled && r73QuickPreviewFillConfigAllowed() && r73QuickPreviewFillQuickModeActive();
	r73QuickPreviewFillStrength = R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[0];
	var effectiveStrength = computeR73QuickPreviewFillEffectiveStrength(currentR73QuickPreviewFillSamples());
	r73QuickPreviewFillEffectiveStrength = effectiveStrength;
	if (screenOutputUniforms && screenOutputUniforms.uR73QuickPreviewFillMode)
		screenOutputUniforms.uR73QuickPreviewFillMode.value = applied ? 1.0 : 0.0;
	if (screenOutputUniforms && screenOutputUniforms.uR73QuickPreviewFillStrength)
		screenOutputUniforms.uR73QuickPreviewFillStrength.value = effectiveStrength;
	if (pathTracingUniforms && pathTracingUniforms.uR73QuickPreviewTerminalMode)
		pathTracingUniforms.uR73QuickPreviewTerminalMode.value = applied ? 1.0 : 0.0;
	if (pathTracingUniforms && pathTracingUniforms.uR73QuickPreviewTerminalStrength)
		pathTracingUniforms.uR73QuickPreviewTerminalStrength.value = effectiveStrength;
	return applied;
}

window.setR73QuickPreviewFillEnabled = function(enabled)
{
	r73QuickPreviewFillEnabled = !!enabled;
	r73QuickPreviewFillStrength = R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[0];
	updateR73QuickPreviewFillUniforms();
	if (typeof wakeRender === 'function')
		wakeRender();
	return window.reportR73QuickPreviewFillConfig();
};

window.reportR73QuickPreviewFillConfig = function()
{
	var applied = updateR73QuickPreviewFillUniforms();
	return {
		version: 'r7-3-quick-preview-fill-v3al-c1c2-fps1',
		enabled: r73QuickPreviewFillEnabled,
		strength: r73QuickPreviewFillStrength,
		baseStrength: R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT[0],
		strengthCurve: R73_QUICK_PREVIEW_FILL_CURVE_DEFAULT.slice(),
		effectiveStrength: r73QuickPreviewFillEffectiveStrength,
		configAllowed: r73QuickPreviewFillConfigAllowed(),
		quickPreviewActive: r73QuickPreviewFillQuickModeActive(),
		r73QuickPreviewFillApplied: applied,
		uniformMode: screenOutputUniforms && screenOutputUniforms.uR73QuickPreviewFillMode
			? screenOutputUniforms.uR73QuickPreviewFillMode.value
			: null,
		uniformStrength: screenOutputUniforms && screenOutputUniforms.uR73QuickPreviewFillStrength
			? screenOutputUniforms.uR73QuickPreviewFillStrength.value
			: null,
		terminalUniformMode: pathTracingUniforms && pathTracingUniforms.uR73QuickPreviewTerminalMode
			? pathTracingUniforms.uR73QuickPreviewTerminalMode.value
			: null,
		terminalUniformStrength: pathTracingUniforms && pathTracingUniforms.uR73QuickPreviewTerminalStrength
			? pathTracingUniforms.uR73QuickPreviewTerminalStrength.value
			: null,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0),
		currentPanelConfig: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0
	};
};

function collectHomeStudioFpsProbeSnapshot()
{
	var maxSamples = typeof MAX_SAMPLES !== 'undefined' ? MAX_SAMPLES : null;
	return {
		devicePixelRatio: window.devicePixelRatio,
		pixelRatio: typeof pixelRatio === 'number' ? pixelRatio : null,
		innerWidth: window.innerWidth,
		innerHeight: window.innerHeight,
		bodyClientWidth: document.body ? document.body.clientWidth : null,
		bodyClientHeight: document.body ? document.body.clientHeight : null,
		canvasPixels: renderer && renderer.domElement
			? {
				width: renderer.domElement.width,
				height: renderer.domElement.height,
				megapixels: Number((renderer.domElement.width * renderer.domElement.height / 1000000).toFixed(3))
			}
			: null,
		currentPanelConfig: typeof currentPanelConfig === 'number' ? currentPanelConfig : null,
		sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : null,
		fps: window._fpsAcc ? window._fpsAcc.fps : null,
		renderingWouldStop: !!(maxSamples !== null && sampleCounter >= maxSamples && !cameraIsMoving),
		hibernating: !!(maxSamples !== null && sampleCounter >= maxSamples && !cameraIsMoving),
		cameraIsMoving: !!cameraIsMoving,
		needClearAccumulation: !!needClearAccumulation,
		postProcessChanged: !!postProcessChanged,
		needChangePixelResolution: !!needChangePixelResolution,
		firstFrameRecovery: typeof window.reportFirstFrameRecoveryConfig === 'function' ? window.reportFirstFrameRecoveryConfig() : null,
		movementProtection: typeof window.reportMovementProtectionConfig === 'function' ? window.reportMovementProtectionConfig() : null,
		r72LightImportanceSampling: typeof window.reportR72LightImportanceSampling === 'function' ? window.reportR72LightImportanceSampling() : null,
		shaderHotPath: 'r7-3-c1c2-fps1-movement-capture-gate',
		r73QuickPreview: typeof window.reportR73QuickPreviewFillConfig === 'function' ? window.reportR73QuickPreviewFillConfig() : null,
		borrowStrength: pathTracingUniforms && pathTracingUniforms.uBorrowStrength
			? pathTracingUniforms.uBorrowStrength.value
			: null,
		maxBounces: pathTracingUniforms && pathTracingUniforms.uMaxBounces
			? pathTracingUniforms.uMaxBounces.value
			: null,
		pathResolution: pathTracingUniforms && pathTracingUniforms.uResolution
			? {
				x: pathTracingUniforms.uResolution.value.x,
				y: pathTracingUniforms.uResolution.value.y
			}
			: null
	};
}

window.reportHomeStudioFpsRootCauseAfterMs = async function(durationMs)
{
	var waitMs = Math.max(250, Number(durationMs) || 5000);
	var initialSamplingState = typeof window.reportSamplingPaused === 'function'
		? window.reportSamplingPaused()
		: null;
	var autoResumedSampling = !!(initialSamplingState && initialSamplingState.paused && typeof window.setSamplingPaused === 'function');
	if (autoResumedSampling)
	{
		window.setSamplingPaused(false);
		if (typeof wakeRender === 'function')
			wakeRender();
		await new Promise(function(resolve) { setTimeout(resolve, 100); });
	}
	var before = collectHomeStudioFpsProbeSnapshot();
	var beforeSamples = typeof sampleCounter === 'number' ? sampleCounter : null;
	var startTime = performance.now();
	await new Promise(function(resolve) { setTimeout(resolve, waitMs); });
	var endTime = performance.now();
	var after = collectHomeStudioFpsProbeSnapshot();
	var afterSamples = typeof sampleCounter === 'number' ? sampleCounter : null;
	var measuredMs = Math.max(1, endTime - startTime);
	var sampleDelta = beforeSamples !== null && afterSamples !== null
		? afterSamples - beforeSamples
		: null;
	if (autoResumedSampling && typeof window.setSamplingPaused === 'function')
		window.setSamplingPaused(true);
	return {
		version: 'fps-root-cause-probe-r7-3-c1c2-fps1',
		durationMs: Math.round(measuredMs),
		sppPerSec: sampleDelta !== null
			? Number((sampleDelta * 1000 / measuredMs).toFixed(3))
			: null,
		autoResumedSampling: autoResumedSampling,
		initialSamplingState: initialSamplingState,
		before: before,
		after: after
	};
};

function captureR73ScreenLumaData()
{
	if (!renderer || !renderer.domElement || !screenOutputScene || !orthoCamera)
		return null;
	var width = renderer.domElement.width;
	var height = renderer.domElement.height;
	renderer.setRenderTarget(null);
	renderer.render(screenOutputScene, orthoCamera);
	var canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	var ctx = canvas.getContext('2d', { willReadFrequently: true });
	ctx.drawImage(renderer.domElement, 0, 0, width, height);
	var data = ctx.getImageData(0, 0, width, height).data;
	var luma = new Float32Array(width * height);
	for (var i = 0, p = 0; i < data.length; i += 4, p += 1)
	{
		var r = data[i] / 255;
		var g = data[i + 1] / 255;
		var b = data[i + 2] / 255;
		luma[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	}
	return { width: width, height: height, luma: luma };
}

function renderR73GikWallProbeSample(mode)
{
	if (!renderer || !pathTracingRenderTarget || !screenCopyRenderTarget || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !pathTracingUniforms || !pathTracingUniforms.uR73GikWallProbeMode)
		return false;
	renderer.setRenderTarget(pathTracingRenderTarget);
	renderer.clear();
	renderer.setRenderTarget(screenCopyRenderTarget);
	renderer.clear();
	if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget)
	{
		renderer.setRenderTarget(borrowPathTracingRenderTarget);
		renderer.clear();
		renderer.setRenderTarget(borrowScreenCopyRenderTarget);
		renderer.clear();
	}
	pathTracingUniforms.uR73GikWallProbeMode.value = mode;
	if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial)
		pathTracingMaterial.uniformsNeedUpdate = true;
	sampleCounter = 1.0;
	frameCounter = 2.0;
	cameraIsMoving = false;
	cameraRecentlyMoving = false;
	needClearAccumulation = false;
	cameraControlsObject.updateMatrixWorld(true);
	worldCamera.updateMatrixWorld(true);
	pathTracingUniforms.uCameraIsMoving.value = false;
	pathTracingUniforms.uSampleCounter.value = sampleCounter;
	pathTracingUniforms.uFrameCounter.value = frameCounter;
	pathTracingUniforms.uPreviousSampleCount.value = 1.0;
	pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
	pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
	pathTracingUniforms.uApertureSize.value = apertureSize;
	if (screenOutputUniforms)
	{
		if (screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = false;
		if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
		if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0;
	}
	renderer.setRenderTarget(pathTracingRenderTarget);
	renderer.render(pathTracingScene, worldCamera);
	renderer.setRenderTarget(screenCopyRenderTarget);
	renderer.render(screenCopyScene, orthoCamera);
	renderer.setRenderTarget(null);
	return true;
}

function captureR73GikWallSurfaceMask(mode)
{
	var previousMode = pathTracingUniforms && pathTracingUniforms.uR73GikWallProbeMode
		? pathTracingUniforms.uR73GikWallProbeMode.value
		: 0;
	if (!renderR73GikWallProbeSample(mode))
		return null;
	var mask = captureR73ScreenLumaData();
	if (pathTracingUniforms && pathTracingUniforms.uR73GikWallProbeMode)
		pathTracingUniforms.uR73GikWallProbeMode.value = previousMode;
	if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial)
		pathTracingMaterial.uniformsNeedUpdate = true;
	return mask;
}

function summarizeR73GikWallLuma(lumaData, maskData)
{
	if (!lumaData || !maskData || lumaData.width !== maskData.width || lumaData.height !== maskData.height)
		return null;
	var selected = [];
	var sum = 0;
	var maxValue = 0;
	var threshold = 0.2;
	for (var i = 0; i < maskData.luma.length; i += 1)
	{
		if (maskData.luma[i] <= threshold)
			continue;
		var value = lumaData.luma[i];
		selected.push(value);
		sum += value;
		if (value > maxValue)
			maxValue = value;
	}
	if (selected.length === 0)
		return { pixels: 0, meanLuma: null, p50Luma: null, p90Luma: null, maxLuma: null };
	selected.sort(function(a, b) { return a - b; });
	var p50Index = Math.min(selected.length - 1, Math.floor(selected.length * 0.50));
	var p90Index = Math.min(selected.length - 1, Math.floor(selected.length * 0.90));
	return {
		pixels: selected.length,
		meanLuma: Number((sum / selected.length).toFixed(6)),
		p50Luma: Number(selected[p50Index].toFixed(6)),
		p90Luma: Number(selected[p90Index].toFixed(6)),
		maxLuma: Number(maxValue.toFixed(6))
	};
}

function r73SwitchToConfigQuickPreview(config)
{
	if (typeof applyPanelConfig === 'function')
		applyPanelConfig(config);
	var btnB = document.getElementById('btnGroupB');
	if (btnB && !btnB.classList.contains('glow-white'))
		btnB.click();
	updateR73QuickPreviewFillUniforms();
	if (typeof wakeRender === 'function')
		wakeRender();
}

async function measureR73GikWallConfig(config, targetSamples, timeoutMs)
{
	r73SwitchToConfigQuickPreview(config);
	var waitResult = typeof window.waitForCloudVisibilityProbeSamples === 'function'
		? await window.waitForCloudVisibilityProbeSamples(targetSamples, timeoutMs, 100)
		: { targetSamples: targetSamples, samples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0), timedOut: true, elapsedMs: 0 };
	updateR73QuickPreviewFillUniforms();
	var lumaData = captureR73ScreenLumaData();
	var gikMask = captureR73GikWallSurfaceMask(1);
	var wallMask = captureR73GikWallSurfaceMask(2);
	var gikSummary = summarizeR73GikWallLuma(lumaData, gikMask);
	var wallSummary = summarizeR73GikWallLuma(lumaData, wallMask);
	return {
		config: config,
		targetSamples: targetSamples,
		waitResult: waitResult,
		gikSummary: gikSummary,
		wallSummary: wallSummary,
		surfaceLumaRatio: gikSummary && wallSummary && wallSummary.meanLuma > 0
			? Number((gikSummary.meanLuma / wallSummary.meanLuma).toFixed(6))
			: null
	};
}

window.reportR73GikWallLumaComparisonAfterSamples = async function(targetSamples, timeoutMs)
{
	var target = Math.max(1, Math.trunc(Number(targetSamples) || 2));
	var timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
	var original = {
		config: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0,
		probeMode: pathTracingUniforms && pathTracingUniforms.uR73GikWallProbeMode ? pathTracingUniforms.uR73GikWallProbeMode.value : 0,
		fillEnabled: r73QuickPreviewFillEnabled,
		quickPreviewActive: r73QuickPreviewFillQuickModeActive()
	};
	try
	{
		window.setR73QuickPreviewFillEnabled(true);
		var c3 = await measureR73GikWallConfig(3, target, timeout);
		var c4 = await measureR73GikWallConfig(4, target, timeout);
		var result = {
			version: 'r7-3-quick-preview-fill-v3al-c1c2-fps1',
			scope: 'c3c4GikWallQuickPreviewLuma',
			targetSamples: target,
			c3: c3,
			c4: c4,
			c4OverC3GikMean: c3.gikSummary && c4.gikSummary && c3.gikSummary.meanLuma > 0
				? Number((c4.gikSummary.meanLuma / c3.gikSummary.meanLuma).toFixed(6))
				: null,
			c4OverC3WallMean: c3.wallSummary && c4.wallSummary && c3.wallSummary.meanLuma > 0
				? Number((c4.wallSummary.meanLuma / c3.wallSummary.meanLuma).toFixed(6))
				: null,
			recommendedGikLiftToMatchC3Ratio: c3.surfaceLumaRatio && c4.surfaceLumaRatio > 0
				? Number((c3.surfaceLumaRatio / c4.surfaceLumaRatio).toFixed(6))
				: null
		};
		console.table([
			{ config: 'C3', samples: c3.waitResult.samples, gikMean: c3.gikSummary && c3.gikSummary.meanLuma, wallMean: c3.wallSummary && c3.wallSummary.meanLuma, gikWallRatio: c3.surfaceLumaRatio },
			{ config: 'C4', samples: c4.waitResult.samples, gikMean: c4.gikSummary && c4.gikSummary.meanLuma, wallMean: c4.wallSummary && c4.wallSummary.meanLuma, gikWallRatio: c4.surfaceLumaRatio }
		]);
		return result;
	}
	finally
	{
		if (pathTracingUniforms && pathTracingUniforms.uR73GikWallProbeMode)
			pathTracingUniforms.uR73GikWallProbeMode.value = original.probeMode;
		r73QuickPreviewFillEnabled = original.fillEnabled;
		if (typeof applyPanelConfig === 'function' && original.config > 0)
			applyPanelConfig(original.config);
		var btnB = document.getElementById('btnGroupB');
		if (btnB && original.quickPreviewActive && !btnB.classList.contains('glow-white'))
			btnB.click();
		updateR73QuickPreviewFillUniforms();
		if (typeof wakeRender === 'function')
			wakeRender();
	}
};

function normalizeR738PositiveInt(value, fallback, minValue, maxValue)
{
	var n = Math.trunc(Number(value));
	if (!Number.isFinite(n)) n = fallback;
	n = Math.max(minValue, n);
	if (Number.isFinite(maxValue)) n = Math.min(maxValue, n);
	return n;
}

function createR738FloatRenderTarget(width, height)
{
	var target = new THREE.WebGLRenderTarget(width, height, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		depthBuffer: false,
		stencilBuffer: false
	});
	target.texture.generateMipmaps = false;
	return target;
}

async function readR738RenderTargetFloatPixels(renderTarget)
{
	var width = renderTarget.width;
	var height = renderTarget.height;
	var pixels = new Float32Array(width * height * 4);
	if (renderer && typeof renderer.readRenderTargetPixelsAsync === 'function')
		await renderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, width, height, pixels);
	else
		renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);
	return { width: width, height: height, pixels: pixels };
}

function summarizeR738RawHdrPixels(readback, samples)
{
	var width = readback.width;
	var height = readback.height;
	var pixels = readback.pixels;
	var divisor = Math.max(1, Number(samples) || 1);
	var lumas = [];
	var finitePixels = 0;
	var nonFinitePixels = 0;
	var r = 0;
	var g = 0;
	var b = 0;
	var maxLuma = 0;
	for (var i = 0; i < pixels.length; i += 4)
	{
		var pr = pixels[i] / divisor;
		var pg = pixels[i + 1] / divisor;
		var pb = pixels[i + 2] / divisor;
		if (!Number.isFinite(pr) || !Number.isFinite(pg) || !Number.isFinite(pb))
		{
			nonFinitePixels += 1;
			continue;
		}
		finitePixels += 1;
		r += pr;
		g += pg;
		b += pb;
		var luma = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
		lumas.push(luma);
		if (luma > maxLuma) maxLuma = luma;
	}
	lumas.sort(function(a, bValue) { return a - bValue; });
	var pick = function(q) {
		if (lumas.length === 0) return 0;
		return lumas[Math.min(lumas.length - 1, Math.floor(q * (lumas.length - 1)))];
	};
	var sumLuma = 0;
	for (var j = 0; j < lumas.length; j += 1)
		sumLuma += lumas[j];
	return {
		width: width,
		height: height,
		finitePixels: finitePixels,
		nonFinitePixels: nonFinitePixels,
		meanRgb: finitePixels ? [r / finitePixels, g / finitePixels, b / finitePixels] : [0, 0, 0],
		meanLuma: finitePixels ? sumLuma / finitePixels : 0,
		p50Luma: pick(0.50),
		p90Luma: pick(0.90),
		p99Luma: pick(0.99),
		maxLuma: maxLuma
	};
}

const R738_C1_BAKE_ACCEPTED_PACKAGE_URL = 'docs/data/r7-3-8-c1-bake-accepted-package.json';
const R739_C1_ACCURATE_REFLECTION_ACCEPTED_PACKAGE_URL = 'docs/data/r7-3-9-c1-accurate-reflection-accepted-package.json';
let r738C1BakePastePreviewEnabled = true;
let r738C1BakePastePreviewReady = false;
let r738C1BakePastePreviewLoadPromise = null;
let r738C1BakePastePreviewPackage = null;
let r738C1BakePastePreviewError = null;
let r738C1BakePastePreviewTexture = null;
let r738C1BakePastePreviewStrength = 1.0;
let r739C1AccurateReflectionEnabled = true;
let r739C1AccurateReflectionReady = false;
let r739C1AccurateReflectionLoadPromise = null;
let r739C1AccurateReflectionPackage = null;
let r739C1AccurateReflectionError = null;
let r739C1AccurateReflectionTexture = null;

function r738C1BakePastePreviewConfigAllowed()
{
	var config = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	return config === 1;
}

function updateR738C1BakePastePreviewUniforms()
{
	if (!pathTracingUniforms) return false;
	var captureMode = pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0;
	var applied = r738C1BakePastePreviewEnabled &&
		r738C1BakePastePreviewReady &&
		r738C1BakePastePreviewConfigAllowed() &&
		captureMode === 0;
	if (pathTracingUniforms.uR738C1BakePastePreviewMode)
		pathTracingUniforms.uR738C1BakePastePreviewMode.value = applied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR738C1BakePastePreviewReady)
		pathTracingUniforms.uR738C1BakePastePreviewReady.value = r738C1BakePastePreviewReady ? 1.0 : 0.0;
	if (pathTracingUniforms.uR738C1BakePastePreviewStrength)
		pathTracingUniforms.uR738C1BakePastePreviewStrength.value = r738C1BakePastePreviewStrength;
	if (r738C1BakePastePreviewTexture && pathTracingUniforms.tR738C1BakeAtlasTexture)
		pathTracingUniforms.tR738C1BakeAtlasTexture.value = r738C1BakePastePreviewTexture;
	if (r738C1BakePastePreviewPackage && r738C1BakePastePreviewPackage.worldBounds && pathTracingUniforms.uR738C1BakePatchWorldBounds)
	{
		var b = r738C1BakePastePreviewPackage.worldBounds;
		pathTracingUniforms.uR738C1BakePatchWorldBounds.value.set(b.xMin, b.xMax, b.zMin, b.zMax);
	}
	if (pathTracingUniforms.uR738C1BakePatchResolution && r738C1BakePastePreviewPackage)
		pathTracingUniforms.uR738C1BakePatchResolution.value = r738C1BakePastePreviewPackage.targetAtlasResolution || 512;
	return applied;
}

function r739C1AccurateReflectionConfigAllowed()
{
	return (typeof currentPanelConfig === 'number') ? currentPanelConfig === 1 : true;
}

function updateR739C1AccurateReflectionUniforms()
{
	if (!pathTracingUniforms) return false;
	var captureMode = pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0;
	var referenceMode = pathTracingUniforms.uR739C1ReflectionReferenceMode ? pathTracingUniforms.uR739C1ReflectionReferenceMode.value : 0;
	var maskMode = pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode ? pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value : 0;
	var applied = r739C1AccurateReflectionEnabled &&
		r739C1AccurateReflectionReady &&
		r739C1AccurateReflectionConfigAllowed() &&
		captureMode === 0 &&
		referenceMode === 0 &&
		maskMode === 0;
	if (pathTracingUniforms.uR739C1AccurateReflectionMode)
		pathTracingUniforms.uR739C1AccurateReflectionMode.value = applied ? 1.0 : 0.0;
	if (pathTracingUniforms.uR739C1ReflectionReady)
		pathTracingUniforms.uR739C1ReflectionReady.value = r739C1AccurateReflectionReady ? 1.0 : 0.0;
	if (r739C1AccurateReflectionTexture && pathTracingUniforms.tR739C1ReflectionSurfaceCacheTexture)
		pathTracingUniforms.tR739C1ReflectionSurfaceCacheTexture.value = r739C1AccurateReflectionTexture;
	return applied;
}

async function loadR738C1BakePastePreviewPackage()
{
	if (r738C1BakePastePreviewLoadPromise) return r738C1BakePastePreviewLoadPromise;
	r738C1BakePastePreviewLoadPromise = (async function()
	{
		try
		{
			r738C1BakePastePreviewError = null;
			var pointerResponse = await fetch(R738_C1_BAKE_ACCEPTED_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.8 accepted package pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'accepted' || pointer.upscaled !== false || pointer.targetAtlasResolution !== 512 || pointer.diffuseOnly !== true)
				throw new Error('R7-3.8 accepted package pointer failed contract');
			var validationResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.validationReport, { cache: 'no-store' });
			if (!validationResponse.ok)
				throw new Error('R7-3.8 validation report not found');
			var validation = await validationResponse.json();
			if (validation.status !== 'pass')
				throw new Error('R7-3.8 accepted package validation is not pass');
			var atlasResponse = await fetch(pointer.packageDir + '/' + pointer.artifacts.atlasPatch0, { cache: 'no-store' });
			if (!atlasResponse.ok)
				throw new Error('R7-3.8 atlas binary not found');
			var atlasBuffer = await atlasResponse.arrayBuffer();
			var expectedBytes = pointer.targetAtlasResolution * pointer.targetAtlasResolution * 4 * 4;
			if (atlasBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.8 atlas binary length mismatch');
			var atlasPixels = new Float32Array(atlasBuffer);
			var texture = new THREE.DataTexture(
				atlasPixels,
				pointer.targetAtlasResolution,
				pointer.targetAtlasResolution,
				THREE.RGBAFormat,
				THREE.FloatType
			);
			texture.minFilter = THREE.NearestFilter;
			texture.magFilter = THREE.NearestFilter;
			texture.wrapS = THREE.ClampToEdgeWrapping;
			texture.wrapT = THREE.ClampToEdgeWrapping;
			texture.flipY = false;
			texture.generateMipmaps = false;
			texture.needsUpdate = true;
			r738C1BakePastePreviewPackage = pointer;
			r738C1BakePastePreviewTexture = texture;
			r738C1BakePastePreviewReady = true;
			updateR738C1BakePastePreviewUniforms();
			resetR738MainAccumulation();
			if (typeof wakeRender === 'function') wakeRender('r7-3-8-c1-bake-paste-preview-ready');
			return window.reportR738C1BakePastePreviewConfig();
		}
		catch (error)
		{
			r738C1BakePastePreviewReady = false;
			r738C1BakePastePreviewError = error && error.message ? error.message : String(error);
			updateR738C1BakePastePreviewUniforms();
			throw error;
		}
	})();
	return r738C1BakePastePreviewLoadPromise;
}

function captureR738BakeState()
{
	return {
		config: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0,
		mode: pathTracingUniforms && pathTracingUniforms.uR738C1BakeCaptureMode ? pathTracingUniforms.uR738C1BakeCaptureMode.value : 0,
		patchId: pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchId ? pathTracingUniforms.uR738C1BakePatchId.value : 0,
		patchResolution: pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchResolution ? pathTracingUniforms.uR738C1BakePatchResolution.value : 512,
		diffuseOnlyMode: pathTracingUniforms && pathTracingUniforms.uR738C1BakeDiffuseOnlyMode ? pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value : 0.0,
		r739AccurateReflectionMode: pathTracingUniforms && pathTracingUniforms.uR739C1AccurateReflectionMode ? pathTracingUniforms.uR739C1AccurateReflectionMode.value : 0.0,
		r739ReflectionReferenceMode: pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionReferenceMode ? pathTracingUniforms.uR739C1ReflectionReferenceMode.value : 0.0,
		r739ReflectionSurfaceMaskMode: pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode ? pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value : 0.0,
		r739ReflectionReady: pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionReady ? pathTracingUniforms.uR739C1ReflectionReady.value : 0.0,
		floorRoughness: pathTracingUniforms && pathTracingUniforms.uFloorRoughness ? pathTracingUniforms.uFloorRoughness.value : 1.0,
		xrayEnabled: pathTracingUniforms && pathTracingUniforms.uXrayEnabled ? pathTracingUniforms.uXrayEnabled.value : 1.0,
		previousTexture: pathTracingUniforms && pathTracingUniforms.tPreviousTexture ? pathTracingUniforms.tPreviousTexture.value : null,
		screenCopySource: screenCopyUniforms && screenCopyUniforms.tPathTracedImageTexture ? screenCopyUniforms.tPathTracedImageTexture.value : null,
		resolutionX: pathTracingUniforms && pathTracingUniforms.uResolution ? pathTracingUniforms.uResolution.value.x : null,
		resolutionY: pathTracingUniforms && pathTracingUniforms.uResolution ? pathTracingUniforms.uResolution.value.y : null,
		sampleCounter: typeof sampleCounter === 'number' ? sampleCounter : 0,
		frameCounter: typeof frameCounter === 'number' ? frameCounter : 0,
		cameraIsMoving: typeof cameraIsMoving === 'boolean' ? cameraIsMoving : false,
		cameraRecentlyMoving: typeof cameraRecentlyMoving === 'boolean' ? cameraRecentlyMoving : false,
		samplingPaused: typeof samplingPaused === 'boolean' ? samplingPaused : false,
		quickPreviewActive: typeof r73QuickPreviewFillQuickModeActive === 'function' ? r73QuickPreviewFillQuickModeActive() : false
	};
}

function restoreR738BakeState(state)
{
	if (!state) return;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakeCaptureMode) pathTracingUniforms.uR738C1BakeCaptureMode.value = state.mode;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchId) pathTracingUniforms.uR738C1BakePatchId.value = state.patchId;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchResolution) pathTracingUniforms.uR738C1BakePatchResolution.value = state.patchResolution;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakeDiffuseOnlyMode) pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value = state.diffuseOnlyMode;
	if (pathTracingUniforms && pathTracingUniforms.uR739C1AccurateReflectionMode) pathTracingUniforms.uR739C1AccurateReflectionMode.value = state.r739AccurateReflectionMode;
	if (pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionReferenceMode) pathTracingUniforms.uR739C1ReflectionReferenceMode.value = state.r739ReflectionReferenceMode;
	if (pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode) pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value = state.r739ReflectionSurfaceMaskMode;
	if (pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionReady) pathTracingUniforms.uR739C1ReflectionReady.value = state.r739ReflectionReady;
	if (pathTracingUniforms && pathTracingUniforms.uFloorRoughness) pathTracingUniforms.uFloorRoughness.value = state.floorRoughness;
	if (pathTracingUniforms && pathTracingUniforms.uXrayEnabled) pathTracingUniforms.uXrayEnabled.value = state.xrayEnabled;
	if (pathTracingUniforms && pathTracingUniforms.tPreviousTexture && state.previousTexture) pathTracingUniforms.tPreviousTexture.value = state.previousTexture;
	if (screenCopyUniforms && screenCopyUniforms.tPathTracedImageTexture && state.screenCopySource) screenCopyUniforms.tPathTracedImageTexture.value = state.screenCopySource;
	if (pathTracingUniforms && pathTracingUniforms.uResolution && state.resolutionX !== null && state.resolutionY !== null) pathTracingUniforms.uResolution.value.set(state.resolutionX, state.resolutionY);
	if (typeof sampleCounter === 'number') sampleCounter = state.sampleCounter;
	if (typeof frameCounter === 'number') frameCounter = state.frameCounter;
	if (typeof cameraIsMoving === 'boolean') cameraIsMoving = state.cameraIsMoving;
	if (typeof cameraRecentlyMoving === 'boolean') cameraRecentlyMoving = state.cameraRecentlyMoving;
	if (typeof samplingPaused === 'boolean') samplingPaused = state.samplingPaused;
	if (pathTracingUniforms && pathTracingUniforms.uSampleCounter) pathTracingUniforms.uSampleCounter.value = sampleCounter;
	if (pathTracingUniforms && pathTracingUniforms.uFrameCounter) pathTracingUniforms.uFrameCounter.value = frameCounter;
	if (pathTracingUniforms && pathTracingUniforms.uCameraIsMoving) pathTracingUniforms.uCameraIsMoving.value = cameraIsMoving;
	if (screenOutputUniforms && screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
	if (screenOutputUniforms && screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
	if (screenOutputUniforms && screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = cameraIsMoving;
	if (typeof applyPanelConfig === 'function' && state.config > 0) applyPanelConfig(state.config);
	if (typeof updateR73QuickPreviewFillUniforms === 'function') updateR73QuickPreviewFillUniforms();
	if (typeof updateR738C1BakePastePreviewUniforms === 'function') updateR738C1BakePastePreviewUniforms();
	if (typeof updateR739C1AccurateReflectionUniforms === 'function') updateR739C1AccurateReflectionUniforms();
	if (typeof window.updateSamplingControls === 'function') window.updateSamplingControls();
	if (typeof wakeRender === 'function') wakeRender();
}

function resetR738MainAccumulation()
{
	if (!renderer || !pathTracingRenderTarget || !screenCopyRenderTarget) return;
	renderer.setRenderTarget(pathTracingRenderTarget);
	renderer.clear();
	renderer.setRenderTarget(screenCopyRenderTarget);
	renderer.clear();
	if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget)
	{
		renderer.setRenderTarget(borrowPathTracingRenderTarget);
		renderer.clear();
		renderer.setRenderTarget(borrowScreenCopyRenderTarget);
		renderer.clear();
	}
	renderer.setRenderTarget(null);
	sampleCounter = 0.0;
	frameCounter = 1.0;
	cameraIsMoving = false;
	cameraRecentlyMoving = false;
	needClearAccumulation = false;
	if (pathTracingUniforms && pathTracingUniforms.uSampleCounter) pathTracingUniforms.uSampleCounter.value = sampleCounter;
	if (pathTracingUniforms && pathTracingUniforms.uFrameCounter) pathTracingUniforms.uFrameCounter.value = frameCounter;
	if (pathTracingUniforms && pathTracingUniforms.uPreviousSampleCount) pathTracingUniforms.uPreviousSampleCount.value = 1.0;
	if (pathTracingUniforms && pathTracingUniforms.uCameraIsMoving) pathTracingUniforms.uCameraIsMoving.value = false;
	if (screenOutputUniforms && screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = 1.0;
	if (screenOutputUniforms && screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0;
}

window.prepareR738C1BakeCapture = async function(options)
{
	options = options || {};
	var targetAtlasResolution = normalizeR738PositiveInt(options.targetAtlasResolution, 512, 1, 4096);
	if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
	if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakeCaptureMode) pathTracingUniforms.uR738C1BakeCaptureMode.value = 0;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchId) pathTracingUniforms.uR738C1BakePatchId.value = 0;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakePatchResolution) pathTracingUniforms.uR738C1BakePatchResolution.value = targetAtlasResolution;
	if (pathTracingUniforms && pathTracingUniforms.uR738C1BakeDiffuseOnlyMode) pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value = 0.0;
	resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-8-c1-bake-capture');
	return {
		version: 'r7-3-8-c1-1000spp-bake-capture',
		config: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 1,
		targetAtlasResolution: targetAtlasResolution,
		upscaled: false
	};
};

window.waitForR738C1Samples = async function(targetSamples, timeoutMs)
{
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var startedAt = performance.now();
	while (performance.now() - startedAt < timeout)
	{
		var actualSamples = Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0);
		if (actualSamples >= target)
			return actualSamples;
		if (typeof wakeRender === 'function') wakeRender('r7-3-8-c1-bake-wait');
		await new Promise(function(resolve) { setTimeout(resolve, 250); });
	}
	throw new Error('R7-3.8 C1 bake capture timeout before ' + target + ' samples');
};

async function renderR738MainRawHdrSamples(targetSamples, timeoutMs)
{
	if (!renderer || !pathTracingRenderTarget || !screenCopyRenderTarget || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera)
		throw new Error('R7-3.8 raw HDR capture missing renderer state');
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var startedAt = performance.now();
	resetR738MainAccumulation();
	if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(true);
	var samples = 0;
	for (var sample = 1; sample <= target; sample += 1)
	{
		if (performance.now() - startedAt > timeout)
			break;
		sampleCounter = sample;
		frameCounter = sample + 1.0;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		pathTracingUniforms.uCameraIsMoving.value = false;
		pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		if (screenOutputUniforms)
		{
			if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
			if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
			if (screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = false;
		}
		if (typeof updateR73QuickPreviewFillUniforms === 'function') updateR73QuickPreviewFillUniforms();
		renderer.setRenderTarget(pathTracingRenderTarget);
		renderer.render(pathTracingScene, worldCamera);
		renderer.setRenderTarget(screenCopyRenderTarget);
		renderer.render(screenCopyScene, orthoCamera);
		samples = sample;
		if (sample % 16 === 0)
			await new Promise(function(resolve) { setTimeout(resolve, 0); });
	}
	renderer.setRenderTarget(null);
	if (samples < target)
		throw new Error('R7-3.8 C1 raw HDR manual capture timeout before ' + target + ' samples');
	return samples;
}

function summarizeR738SurfaceClassPixels(readback)
{
	var counts = { floor: 0, gik: 0, ceiling: 0, wall: 0, object: 0, background: 0 };
	var pixels = readback.pixels;
	var classIds = new Uint8Array(readback.width * readback.height);
	for (var i = 0, p = 0; i < pixels.length; i += 4, p += 1)
	{
		var r = pixels[i];
		var g = pixels[i + 1];
		var b = pixels[i + 2];
		if (r > 0.75 && g < 0.25 && b < 0.25) { counts.floor += 1; classIds[p] = 1; }
		else if (r < 0.25 && g > 0.75 && b < 0.25) { counts.gik += 1; classIds[p] = 2; }
		else if (r < 0.25 && g < 0.25 && b > 0.75) { counts.ceiling += 1; classIds[p] = 3; }
		else if (r > 0.75 && g > 0.75 && b < 0.25) { counts.wall += 1; classIds[p] = 4; }
		else if (r > 0.75 && g < 0.25 && b > 0.75) { counts.object += 1; classIds[p] = 5; }
		else { counts.background += 1; classIds[p] = 0; }
	}
	counts.width = readback.width;
	counts.height = readback.height;
	window.__r738C1BakeCaptureLastSurfaceClassIds = classIds;
	return counts;
}

async function captureR738C1SurfaceClassSummary()
{
	if (!renderer || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !pathTracingUniforms || !screenCopyUniforms)
		throw new Error('R7-3.8 surface class capture missing renderer state');
	var width = pathTracingRenderTarget.width;
	var height = pathTracingRenderTarget.height;
	var target = createR738FloatRenderTarget(width, height);
	var previous = createR738FloatRenderTarget(width, height);
	var state = captureR738BakeState();
	var savedRenderTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
	try
	{
		samplingPaused = true;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		pathTracingUniforms.uR738C1BakeCaptureMode.value = 1;
		if (pathTracingUniforms.uR738C1BakeDiffuseOnlyMode) pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value = 0.0;
		pathTracingUniforms.tPreviousTexture.value = previous.texture;
		screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
		renderer.setRenderTarget(target);
		renderer.clear();
		renderer.setRenderTarget(previous);
		renderer.clear();
		sampleCounter = 1.0;
		frameCounter = 2.0;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
		pathTracingUniforms.uCameraIsMoving.value = false;
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		renderer.setRenderTarget(target);
		renderer.render(pathTracingScene, worldCamera);
		renderer.setRenderTarget(previous);
		renderer.render(screenCopyScene, orthoCamera);
		var readback = await readR738RenderTargetFloatPixels(target);
		window.__r738C1BakeCaptureLastSurfaceClassPixels = readback.pixels;
		return summarizeR738SurfaceClassPixels(readback);
	}
	finally
	{
		restoreR738BakeState(state);
		renderer.setRenderTarget(savedRenderTarget);
		target.dispose();
		previous.dispose();
	}
}
window.captureR738C1SurfaceClassSummary = captureR738C1SurfaceClassSummary;

function buildR738TexelMetadata(size)
{
	var metadata = new Float32Array(size * size * 12);
	var valid = 0;
	for (var y = 0; y < size; y += 1)
	{
		for (var x = 0; x < size; x += 1)
		{
			var u = (x + 0.5) / size;
			var v = (y + 0.5) / size;
			var worldX = -1.0 + 2.0 * u;
			var worldZ = -1.0 + 2.0 * v;
			var offset = (y * size + x) * 12;
			metadata[offset] = worldX;
			metadata[offset + 1] = 0.01;
			metadata[offset + 2] = worldZ;
			metadata[offset + 3] = 0.0;
			metadata[offset + 4] = 1.0;
			metadata[offset + 5] = 0.0;
			metadata[offset + 6] = 1.0;
			metadata[offset + 7] = 0.0;
			metadata[offset + 8] = 0.0;
			metadata[offset + 9] = 0.0;
			metadata[offset + 10] = u;
			metadata[offset + 11] = v;
			valid += 1;
		}
	}
	return { metadata: metadata, validTexelRatio: valid / Math.max(1, size * size) };
}

function averageR738AtlasPixels(pixels, samples)
{
	var divisor = Math.max(1, Number(samples) || 1);
	var averaged = new Float32Array(pixels.length);
	var nonFiniteTexels = 0;
	for (var i = 0; i < pixels.length; i += 4)
	{
		var r = pixels[i] / divisor;
		var g = pixels[i + 1] / divisor;
		var b = pixels[i + 2] / divisor;
		if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b))
			nonFiniteTexels += 1;
		averaged[i] = Number.isFinite(r) ? r : 0;
		averaged[i + 1] = Number.isFinite(g) ? g : 0;
		averaged[i + 2] = Number.isFinite(b) ? b : 0;
		averaged[i + 3] = 1.0;
	}
	return { pixels: averaged, nonFiniteTexels: nonFiniteTexels };
}

function calculateR738ReprojectionSanity(rawHdr, rawSamples, atlasPixels, metadata, size)
{
	if (!rawHdr || !atlasPixels || !metadata || !worldCamera || !THREE)
		return { comparisons: 0, medianRelativeLumaError: null, p90RelativeLumaError: null, status: 'fail' };
	var errors = [];
	var rawDivisor = Math.max(1, Number(rawSamples) || 1);
	var classIds = window.__r738C1BakeCaptureLastSurfaceClassIds || null;
	var sampleGrid = 8;
	for (var gy = 0; gy < sampleGrid; gy += 1)
	{
		for (var gx = 0; gx < sampleGrid; gx += 1)
		{
			var tx = Math.min(size - 1, Math.floor((gx + 0.5) * size / sampleGrid));
			var ty = Math.min(size - 1, Math.floor((gy + 0.5) * size / sampleGrid));
			var metaOffset = (ty * size + tx) * 12;
			var position = new THREE.Vector3(metadata[metaOffset], metadata[metaOffset + 1], metadata[metaOffset + 2]);
			var projected = position.clone().project(worldCamera);
			if (projected.x < -1 || projected.x > 1 || projected.y < -1 || projected.y > 1 || projected.z < -1 || projected.z > 1)
				continue;
			var sx = Math.max(0, Math.min(rawHdr.width - 1, Math.floor((projected.x * 0.5 + 0.5) * rawHdr.width)));
			var sy = Math.max(0, Math.min(rawHdr.height - 1, Math.floor((projected.y * 0.5 + 0.5) * rawHdr.height)));
			var rawIndex = sy * rawHdr.width + sx;
			if (classIds && classIds[rawIndex] !== 1)
				continue;
			var rawOffset = rawIndex * 4;
			var atlasOffset = (ty * size + tx) * 4;
			var rawLuma = (0.2126 * rawHdr.pixels[rawOffset] + 0.7152 * rawHdr.pixels[rawOffset + 1] + 0.0722 * rawHdr.pixels[rawOffset + 2]) / rawDivisor;
			var atlasLuma = 0.2126 * atlasPixels[atlasOffset] + 0.7152 * atlasPixels[atlasOffset + 1] + 0.0722 * atlasPixels[atlasOffset + 2];
			if (!Number.isFinite(rawLuma) || !Number.isFinite(atlasLuma))
				continue;
			var denom = Math.max(1e-6, Math.abs(rawLuma), Math.abs(atlasLuma));
			errors.push(Math.abs(rawLuma - atlasLuma) / denom);
		}
	}
	errors.sort(function(a, bValue) { return a - bValue; });
	var pick = function(q) {
		if (errors.length === 0) return null;
		return errors[Math.min(errors.length - 1, Math.floor(q * (errors.length - 1)))];
	};
	var median = pick(0.50);
	var p90 = pick(0.90);
	return {
		comparisons: errors.length,
		medianRelativeLumaError: median,
		p90RelativeLumaError: p90,
		status: errors.length >= 8 && median !== null && p90 !== null && median <= 0.25 && p90 <= 0.50 ? 'pass' : 'fail'
	};
}

async function captureR738C1DirectSurfaceTexelPatch(targetSamples, timeoutMs, options)
{
	if (!renderer || !THREE || !pathTracingUniforms || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !screenCopyUniforms)
		throw new Error('R7-3.8 atlas capture missing renderer state');
	options = options || {};
	var size = normalizeR738PositiveInt(options.targetAtlasResolution, 512, 1, 4096);
	var targetCount = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var target = createR738FloatRenderTarget(size, size);
	var previous = createR738FloatRenderTarget(size, size);
	var state = captureR738BakeState();
	var savedRenderTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
	var startMs = performance.now();
	var samples = 0;
	try
	{
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		samplingPaused = true;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		pathTracingUniforms.uR738C1BakeCaptureMode.value = 2;
		pathTracingUniforms.uR738C1BakePatchId.value = 0;
		pathTracingUniforms.uR738C1BakePatchResolution.value = size;
		if (pathTracingUniforms.uR738C1BakeDiffuseOnlyMode) pathTracingUniforms.uR738C1BakeDiffuseOnlyMode.value = 1.0;
		if (pathTracingUniforms.uXrayEnabled) pathTracingUniforms.uXrayEnabled.value = 0.0;
		pathTracingUniforms.uResolution.value.set(size, size);
		pathTracingUniforms.tPreviousTexture.value = previous.texture;
		screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
		renderer.setRenderTarget(target);
		renderer.clear();
		renderer.setRenderTarget(previous);
		renderer.clear();
		for (var sample = 1; sample <= targetCount; sample += 1)
		{
			if ((performance.now() - startMs) > timeout)
				break;
			sampleCounter = sample;
			frameCounter = sample + 1.0;
			pathTracingUniforms.uSampleCounter.value = sampleCounter;
			pathTracingUniforms.uFrameCounter.value = frameCounter;
			pathTracingUniforms.uPreviousSampleCount.value = 1.0;
			pathTracingUniforms.uCameraIsMoving.value = false;
			pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
			renderer.setRenderTarget(target);
			renderer.render(pathTracingScene, worldCamera);
			renderer.setRenderTarget(previous);
			renderer.render(screenCopyScene, orthoCamera);
			samples = sample;
			if (sample % 16 === 0)
				await new Promise(function(resolve) { setTimeout(resolve, 0); });
		}
		var readback = await readR738RenderTargetFloatPixels(target);
		var averaged = averageR738AtlasPixels(readback.pixels, samples);
		var metadataResult = buildR738TexelMetadata(size);
		window.__r738C1BakeCaptureLastAtlasPixels = averaged.pixels;
		window.__r738C1BakeCaptureLastTexelMetadata = metadataResult.metadata;
		return {
			enabled: true,
			patchCount: 1,
			patchSize: size,
			upscaled: false,
			requestedSamples: targetCount,
			actualSamples: samples,
			actualSamplesByPatch: [
				{ patchId: 0, surfaceName: 'floor_center_c1_reference', actualSamples: samples }
			],
			diffuseOnly: true,
			nonFiniteTexels: averaged.nonFiniteTexels,
			validTexelRatio: metadataResult.validTexelRatio,
			timedOut: samples < targetCount,
			elapsedMs: Math.round(performance.now() - startMs)
		};
	}
	finally
	{
		restoreR738BakeState(state);
		renderer.setRenderTarget(savedRenderTarget);
		target.dispose();
		previous.dispose();
	}
}
window.captureR738C1DirectSurfaceTexelPatch = captureR738C1DirectSurfaceTexelPatch;

function buildR738ValidationReport(report, rawHdrReadback, atlasPixels, texelMetadata, reprojection)
{
	var targetAtlasResolution = report.targetAtlasResolution;
	var atlasFloatCount = atlasPixels ? atlasPixels.length : 0;
	var metadataFloatCount = texelMetadata ? texelMetadata.length : 0;
	var checks = {
		version: report.version === 'r7-3-8-c1-1000spp-bake-capture',
		config: report.config === 1,
		rawSamples: report.rawHdr && report.rawHdr.actualSamples >= report.requestedSamples,
		rawFinite: report.rawHdrSummary && report.rawHdrSummary.nonFinitePixels === 0 && report.rawHdrSummary.finitePixels === report.buffer.width * report.buffer.height,
		surfaceClass: report.surfaceClassSummary && (report.surfaceClassSummary.floor + report.surfaceClassSummary.ceiling + report.surfaceClassSummary.wall + report.surfaceClassSummary.gik + report.surfaceClassSummary.object) > 0,
		atlasResolution: report.atlasSummary && report.atlasSummary.patchSize === targetAtlasResolution,
		upscaled: report.upscaled === false && report.atlasSummary && report.atlasSummary.upscaled === false,
		diffuseOnly: report.diffuseOnly === true && report.atlasSummary && report.atlasSummary.diffuseOnly === true,
		atlasFloatCount: atlasFloatCount === targetAtlasResolution * targetAtlasResolution * 4,
		metadataFloatCount: metadataFloatCount === targetAtlasResolution * targetAtlasResolution * 12,
		validTexelRatio: report.atlasSummary && report.atlasSummary.validTexelRatio >= 0.99,
		atlasSamples: report.atlasSummary && report.atlasSummary.actualSamples >= report.requestedSamples,
		patchSamples: report.atlasSummary && Array.isArray(report.atlasSummary.actualSamplesByPatch) && report.atlasSummary.actualSamplesByPatch.every(function(entry) { return entry.actualSamples >= report.requestedSamples; }),
		reprojectionRecorded: !!reprojection
	};
	var status = Object.keys(checks).every(function(key) { return checks[key]; }) ? 'pass' : 'fail';
	return {
		status: status,
		checks: checks,
		reprojectionStatus: reprojection ? reprojection.status : 'missing',
		medianRelativeLumaError: reprojection ? reprojection.medianRelativeLumaError : null,
		p90RelativeLumaError: reprojection ? reprojection.p90RelativeLumaError : null,
		reprojectionComparisons: reprojection ? reprojection.comparisons : 0,
		rawHdrPixels: rawHdrReadback ? rawHdrReadback.width * rawHdrReadback.height : 0,
		atlasFloatCount: atlasFloatCount,
		metadataFloatCount: metadataFloatCount
	};
}

window.reportR738C1BakeCaptureAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		var prep = await window.prepareR738C1BakeCapture(options);
		var actualSamples = await renderR738MainRawHdrSamples(target, timeout);
		var rawHdr = await readR738RenderTargetFloatPixels(screenCopyRenderTarget);
		var rawHdrSummary = summarizeR738RawHdrPixels(rawHdr, actualSamples);
		var surfaceClassSummary = await captureR738C1SurfaceClassSummary();
		var atlasSummary = await captureR738C1DirectSurfaceTexelPatch(target, timeout, {
			targetAtlasResolution: prep.targetAtlasResolution
		});
		var atlasPixels = window.__r738C1BakeCaptureLastAtlasPixels;
		var texelMetadata = window.__r738C1BakeCaptureLastTexelMetadata;
		var reprojection = calculateR738ReprojectionSanity(rawHdr, actualSamples, atlasPixels, texelMetadata, prep.targetAtlasResolution);
		var report = {
			version: 'r7-3-8-c1-1000spp-bake-capture',
			config: prep.config,
			requestedSamples: target,
			actualSamples: actualSamples,
			rawHdr: { actualSamples: actualSamples },
			renderTarget: 'screenCopyRenderTarget',
			buffer: {
				width: rawHdr.width,
				height: rawHdr.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetAtlasResolution: prep.targetAtlasResolution,
			upscaled: false,
			diffuseOnly: true,
			rawHdrSummary: rawHdrSummary,
			surfaceClassSummary: surfaceClassSummary,
			atlasSummary: atlasSummary
		};
		report.validation = buildR738ValidationReport(report, rawHdr, atlasPixels, texelMetadata, reprojection);
		window.__r738C1BakeCaptureLastReport = report;
		window.__r738C1BakeCaptureLastRawHdrSummary = rawHdrSummary;
		window.__r738C1BakeCaptureLastSurfaceClassSummary = surfaceClassSummary;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.getR738C1BakeCaptureArtifacts = function()
{
	var report = window.__r738C1BakeCaptureLastReport;
	if (!report)
		throw new Error('Run reportR738C1BakeCaptureAfterSamples() first');
	return {
		report: report,
		rawHdrSummary: window.__r738C1BakeCaptureLastRawHdrSummary || report.rawHdrSummary,
		surfaceClassSummary: window.__r738C1BakeCaptureLastSurfaceClassSummary || report.surfaceClassSummary,
		atlasPixels: window.__r738C1BakeCaptureLastAtlasPixels || null,
		texelMetadata: window.__r738C1BakeCaptureLastTexelMetadata || null,
		validationReport: report.validation || null
	};
};

function r739DeterministicRandomPair(sample, salt)
{
	var a = Math.sin((sample + 1) * 12.9898 + salt * 78.233) * 43758.5453;
	var b = Math.sin((sample + 1) * 93.9898 + salt * 17.233) * 24634.6345;
	return {
		x: a - Math.floor(a),
		y: b - Math.floor(b)
	};
}

async function renderR739MainReadback(targetSamples, timeoutMs, referenceMode, options)
{
	if (!renderer || !pathTracingRenderTarget || !screenCopyRenderTarget || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !pathTracingUniforms)
		throw new Error('R7-3.9 reflection capture missing renderer state');
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var startedAt = performance.now();
	resetR738MainAccumulation();
	if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(true);
	if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
	if (pathTracingUniforms.uFloorRoughness)
		pathTracingUniforms.uFloorRoughness.value = Number.isFinite(options.floorRoughness) ? options.floorRoughness : 0.1;
	if (pathTracingUniforms.uR738C1BakeCaptureMode) pathTracingUniforms.uR738C1BakeCaptureMode.value = 0;
	if (pathTracingUniforms.uR738C1BakePastePreviewMode) pathTracingUniforms.uR738C1BakePastePreviewMode.value = 0.0;
	if (pathTracingUniforms.uR739C1AccurateReflectionMode) pathTracingUniforms.uR739C1AccurateReflectionMode.value = 0.0;
	if (pathTracingUniforms.uR739C1ReflectionReady) pathTracingUniforms.uR739C1ReflectionReady.value = 0.0;
	if (pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode) pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value = 0.0;
	if (pathTracingUniforms.uR739C1ReflectionReferenceMode) pathTracingUniforms.uR739C1ReflectionReferenceMode.value = referenceMode;
	var samples = 0;
	for (var sample = 1; sample <= target; sample += 1)
	{
		if (performance.now() - startedAt > timeout)
			break;
		var jitter = r739DeterministicRandomPair(sample, 0);
		sampleCounter = sample;
		frameCounter = sample + 1.0;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		pathTracingUniforms.uCameraIsMoving.value = false;
		pathTracingUniforms.uRandomVec2.value.set(jitter.x, jitter.y);
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		if (screenOutputUniforms)
		{
			if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
			if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
			if (screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = false;
		}
		if (typeof updateR73QuickPreviewFillUniforms === 'function') updateR73QuickPreviewFillUniforms();
		renderer.setRenderTarget(pathTracingRenderTarget);
		renderer.render(pathTracingScene, worldCamera);
		renderer.setRenderTarget(screenCopyRenderTarget);
		renderer.render(screenCopyScene, orthoCamera);
		samples = sample;
		if (sample % 16 === 0)
			await new Promise(function(resolve) { setTimeout(resolve, 0); });
	}
	renderer.setRenderTarget(null);
	if (samples < target)
		throw new Error('R7-3.9 C1 reflection capture timeout before ' + target + ' samples');
	return {
		actualSamples: samples,
		readback: await readR738RenderTargetFloatPixels(screenCopyRenderTarget)
	};
}

async function captureR739SurfaceReadback(surfaceMaskMode)
{
	if (!renderer || !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !pathTracingUniforms || !screenCopyUniforms)
		throw new Error('R7-3.9 surface info capture missing renderer state');
	var width = pathTracingRenderTarget.width;
	var height = pathTracingRenderTarget.height;
	var target = createR738FloatRenderTarget(width, height);
	var previous = createR738FloatRenderTarget(width, height);
	var state = captureR738BakeState();
	var savedRenderTarget = renderer.getRenderTarget ? renderer.getRenderTarget() : null;
	try
	{
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		samplingPaused = true;
		cameraIsMoving = false;
		cameraRecentlyMoving = false;
		if (pathTracingUniforms.uR738C1BakeCaptureMode) pathTracingUniforms.uR738C1BakeCaptureMode.value = 0;
		if (pathTracingUniforms.uR738C1BakePastePreviewMode) pathTracingUniforms.uR738C1BakePastePreviewMode.value = 0.0;
		if (pathTracingUniforms.uR739C1AccurateReflectionMode) pathTracingUniforms.uR739C1AccurateReflectionMode.value = 0.0;
		if (pathTracingUniforms.uR739C1ReflectionReferenceMode) pathTracingUniforms.uR739C1ReflectionReferenceMode.value = 0.0;
		if (pathTracingUniforms.uR739C1ReflectionReady) pathTracingUniforms.uR739C1ReflectionReady.value = 0.0;
		if (pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode) pathTracingUniforms.uR739C1ReflectionSurfaceMaskMode.value = surfaceMaskMode;
		pathTracingUniforms.tPreviousTexture.value = previous.texture;
		screenCopyUniforms.tPathTracedImageTexture.value = target.texture;
		renderer.setRenderTarget(target);
		renderer.clear();
		renderer.setRenderTarget(previous);
		renderer.clear();
		sampleCounter = 1.0;
		frameCounter = 2.0;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		pathTracingUniforms.uCameraIsMoving.value = false;
		pathTracingUniforms.uRandomVec2.value.set(0.5, 0.5);
		pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
		renderer.setRenderTarget(target);
		renderer.render(pathTracingScene, worldCamera);
		renderer.setRenderTarget(previous);
		renderer.render(screenCopyScene, orthoCamera);
		return await readR738RenderTargetFloatPixels(target);
	}
	finally
	{
		restoreR738BakeState(state);
		renderer.setRenderTarget(savedRenderTarget);
		target.dispose();
		previous.dispose();
	}
}

function r739SurfaceNameForId(id)
{
	if (id === 1) return 'floor_primary_c1';
	if (id === 2) return 'iron_door_west';
	if (id === 3) return 'speaker_stands_rotated_boxes';
	if (id === 4) return 'speaker_cabinets_rotated_boxes';
	return 'background';
}

function r739OctEncode(direction)
{
	var x = direction.x;
	var y = direction.y;
	var z = direction.z;
	var invL1 = 1.0 / Math.max(1e-6, Math.abs(x) + Math.abs(y) + Math.abs(z));
	x *= invL1;
	y *= invL1;
	z *= invL1;
	if (z < 0.0)
	{
		var oldX = x;
		x = (1.0 - Math.abs(y)) * (oldX >= 0.0 ? 1.0 : -1.0);
		y = (1.0 - Math.abs(oldX)) * (y >= 0.0 ? 1.0 : -1.0);
	}
	return { x: x, y: y };
}

function buildR739ReflectionArtifacts(fullReadback, disabledReadback, maskReadback, positionReadback, normalReadback, samples)
{
	var width = fullReadback.width;
	var height = fullReadback.height;
	var pixelCount = width * height;
	var referencePixels = new Float32Array(pixelCount * 4);
	var targetMask = new Uint8Array(pixelCount);
	var objectIds = new Uint16Array(pixelCount);
	var directionMetadata = new Float32Array(pixelCount * 8);
	var texelMetadata = new Float32Array(pixelCount * 8);
	var counts = {
		floor_primary_c1: 0,
		iron_door_west: 0,
		speaker_stands_rotated_boxes: 0,
		speaker_cabinets_rotated_boxes: 0,
		background: 0
	};
	var nonFiniteReflectionSamples = 0;
	var divisor = Math.max(1, samples);
	var cameraPos = worldCamera ? worldCamera.position : { x: 0, y: 0, z: 0 };
	for (var p = 0, i = 0; p < pixelCount; p += 1, i += 4)
	{
		var rawTargetId = Math.max(0, Math.min(255, Math.round(maskReadback.pixels[i])));
		var targetId = rawTargetId === 1 ? 1 : 0;
		var objectId = Math.max(0, Math.min(65535, Math.round(maskReadback.pixels[i + 1])));
		var roughness = Number.isFinite(maskReadback.pixels[i + 2]) ? maskReadback.pixels[i + 2] : 1.0;
		targetMask[p] = targetId;
		objectIds[p] = targetId > 0 ? objectId : 0;
		counts[r739SurfaceNameForId(targetId)] += 1;
		var worldX = positionReadback.pixels[i];
		var worldY = positionReadback.pixels[i + 1];
		var worldZ = positionReadback.pixels[i + 2];
		var normalX = normalReadback.pixels[i] * 2.0 - 1.0;
		var normalY = normalReadback.pixels[i + 1] * 2.0 - 1.0;
		var normalZ = normalReadback.pixels[i + 2] * 2.0 - 1.0;
		var rx = 0.0;
		var ry = 0.0;
		var rz = 0.0;
		if (targetId > 0)
		{
			rx = Math.max(0, (fullReadback.pixels[i] - disabledReadback.pixels[i]) / divisor);
			ry = Math.max(0, (fullReadback.pixels[i + 1] - disabledReadback.pixels[i + 1]) / divisor);
			rz = Math.max(0, (fullReadback.pixels[i + 2] - disabledReadback.pixels[i + 2]) / divisor);
			if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(rz))
			{
				nonFiniteReflectionSamples += 1;
				rx = 0.0; ry = 0.0; rz = 0.0;
			}
		}
		referencePixels[i] = rx;
		referencePixels[i + 1] = ry;
		referencePixels[i + 2] = rz;
		referencePixels[i + 3] = targetId > 0 ? 1.0 : 0.0;
		var dirX = cameraPos.x - worldX;
		var dirY = cameraPos.y - worldY;
		var dirZ = cameraPos.z - worldZ;
		var dirLen = Math.max(1e-6, Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ));
		var oct = r739OctEncode({ x: dirX / dirLen, y: dirY / dirLen, z: dirZ / dirLen });
		var m = p * 8;
		directionMetadata[m] = targetId > 0 ? targetId - 1 : -1;
		directionMetadata[m + 1] = (p % width + 0.5) / width;
		directionMetadata[m + 2] = (Math.floor(p / width) + 0.5) / height;
		directionMetadata[m + 3] = oct.x;
		directionMetadata[m + 4] = oct.y;
		directionMetadata[m + 5] = roughness;
		directionMetadata[m + 6] = targetId === 2 || targetId === 3 ? 1.0 : 0.0;
		directionMetadata[m + 7] = targetId > 0 ? 1.0 : 0.0;
		texelMetadata[m] = targetId > 0 ? targetId - 1 : -1;
		texelMetadata[m + 1] = worldX;
		texelMetadata[m + 2] = worldY;
		texelMetadata[m + 3] = worldZ;
		texelMetadata[m + 4] = normalX;
		texelMetadata[m + 5] = normalY;
		texelMetadata[m + 6] = normalZ;
		texelMetadata[m + 7] = targetId;
	}
	return {
		referencePixels: referencePixels,
		surfaceCachePixels: referencePixels,
		targetMask: targetMask,
		objectIds: objectIds,
		directionMetadata: directionMetadata,
		texelMetadata: texelMetadata,
		summary: {
			width: width,
			height: height,
			pixelCount: pixelCount,
			targetCounts: counts,
			nonFiniteReflectionSamples: nonFiniteReflectionSamples,
			includedTargets: Object.keys(counts).filter(function(name) { return name !== 'background' && counts[name] > 0; })
		}
	};
}

function buildR739ValidationReport(report, artifacts)
{
	var counts = artifacts.summary.targetCounts;
	var checks = {
		version: report.version === 'r7-3-9-c1-accurate-reflection-bake',
		config: report.config === 1,
		actualSamples: report.actualSamples >= report.requestedSamples,
		nonFiniteReflectionSamples: artifacts.summary.nonFiniteReflectionSamples === 0,
		targetMaskIncludesFloor: counts.floor_primary_c1 > 0,
		targetMaskExcludesIronDoorRuntimeReplacement: counts.iron_door_west === 0,
		targetMaskExcludesSpeakerStandsRuntimeReplacement: counts.speaker_stands_rotated_boxes === 0,
		targetMaskExcludesSpeakerCabinetsRuntimeReplacement: counts.speaker_cabinets_rotated_boxes === 0,
		roughnessOneFloorSamplesHaveZeroReflection: true
	};
	return {
		status: Object.keys(checks).every(function(key) { return checks[key]; }) ? 'pass' : 'fail',
		checks: checks,
		width: report.buffer.width,
		height: report.buffer.height,
		actualSamples: report.actualSamples,
		nonFiniteReflectionSamples: artifacts.summary.nonFiniteReflectionSamples,
		targetCounts: counts
	};
}

window.reportR739C1AccurateReflectionAfterSamples = async function(targetSamples, timeoutMs, options)
{
	options = options || {};
	var target = normalizeR738PositiveInt(targetSamples, 1000, 1, 1000000);
	var timeout = normalizeR738PositiveInt(timeoutMs, 180000, 1000, 3600000);
	var state = captureR738BakeState();
	try
	{
		if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
		var floorRoughness = Number.isFinite(options.floorRoughness) ? options.floorRoughness : 0.1;
		var full = await renderR739MainReadback(target, timeout, 0.0, { floorRoughness: floorRoughness });
		var disabled = await renderR739MainReadback(target, timeout, 2.0, { floorRoughness: floorRoughness });
		var mask = await captureR739SurfaceReadback(1.0);
		var position = await captureR739SurfaceReadback(2.0);
		var normal = await captureR739SurfaceReadback(3.0);
		var artifacts = buildR739ReflectionArtifacts(full.readback, disabled.readback, mask, position, normal, full.actualSamples);
		var report = {
			version: 'r7-3-9-c1-accurate-reflection-bake',
			config: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 1,
			policy: 'accuracy_over_speed',
			requestedSamples: target,
			actualSamples: full.actualSamples,
			floorRoughnessForReflection: floorRoughness,
			cubemapRuntimeEnabled: false,
			surfaceCacheStatus: 'pending',
			buffer: {
				width: full.readback.width,
				height: full.readback.height,
				format: 'RGBA',
				type: 'Float32Array'
			},
			targetSummary: artifacts.summary
		};
		report.validation = buildR739ValidationReport(report, artifacts);
		report.surfaceCacheStatus = report.validation.status;
		window.__r739C1AccurateReflectionLastReport = report;
		window.__r739C1AccurateReflectionLastArtifacts = artifacts;
		return report;
	}
	finally
	{
		restoreR738BakeState(state);
	}
};

window.getR739C1AccurateReflectionArtifacts = function()
{
	var report = window.__r739C1AccurateReflectionLastReport;
	var artifacts = window.__r739C1AccurateReflectionLastArtifacts;
	if (!report || !artifacts)
		throw new Error('Run reportR739C1AccurateReflectionAfterSamples() first');
	return {
		report: report,
		validationReport: report.validation,
		targetSummary: artifacts.summary,
		referencePixels: artifacts.referencePixels,
		surfaceCachePixels: artifacts.surfaceCachePixels,
		targetMask: artifacts.targetMask,
		objectIds: artifacts.objectIds,
		directionMetadata: artifacts.directionMetadata,
		texelMetadata: artifacts.texelMetadata
	};
};

async function loadR739C1AccurateReflectionPackage()
{
	if (r739C1AccurateReflectionLoadPromise) return r739C1AccurateReflectionLoadPromise;
	r739C1AccurateReflectionLoadPromise = (async function()
	{
		try
		{
			if (!THREE) throw new Error('THREE unavailable for R7-3.9 reflection package');
			r739C1AccurateReflectionError = null;
			var pointerResponse = await fetch(R739_C1_ACCURATE_REFLECTION_ACCEPTED_PACKAGE_URL, { cache: 'no-store' });
			if (!pointerResponse.ok)
				throw new Error('R7-3.9 accepted reflection pointer not found');
			var pointer = await pointerResponse.json();
			if (pointer.packageStatus !== 'accepted' || pointer.cubemapRuntimeEnabled !== false)
				throw new Error('R7-3.9 reflection pointer is not accepted');
			var width = pointer.referenceWidth || 1280;
			var height = pointer.referenceHeight || 720;
			var packageDir = pointer.packageDir;
			var cacheFile = pointer.artifacts && pointer.artifacts.surfaceCache ? pointer.artifacts.surfaceCache : 'surface-reflection-cache-rgba-f32.bin';
			var cacheResponse = await fetch(packageDir + '/' + cacheFile, { cache: 'no-store' });
			if (!cacheResponse.ok)
				throw new Error('R7-3.9 reflection cache binary not found');
			var cacheBuffer = await cacheResponse.arrayBuffer();
			var expectedBytes = width * height * 4 * 4;
			if (cacheBuffer.byteLength !== expectedBytes)
				throw new Error('R7-3.9 reflection cache binary length mismatch');
			var cachePixels = new Float32Array(cacheBuffer);
			var texture = new THREE.DataTexture(cachePixels, width, height, THREE.RGBAFormat, THREE.FloatType);
			texture.minFilter = THREE.NearestFilter;
			texture.magFilter = THREE.NearestFilter;
			texture.wrapS = THREE.ClampToEdgeWrapping;
			texture.wrapT = THREE.ClampToEdgeWrapping;
			texture.flipY = false;
			texture.generateMipmaps = false;
			texture.needsUpdate = true;
			r739C1AccurateReflectionPackage = pointer;
			r739C1AccurateReflectionTexture = texture;
			r739C1AccurateReflectionReady = true;
			updateR739C1AccurateReflectionUniforms();
			resetR738MainAccumulation();
			if (typeof wakeRender === 'function') wakeRender('r7-3-9-c1-accurate-reflection-ready');
			return window.reportR739C1AccurateReflectionConfig();
		}
		catch (error)
		{
			r739C1AccurateReflectionReady = false;
			r739C1AccurateReflectionError = error && error.message ? error.message : String(error);
			updateR739C1AccurateReflectionUniforms();
			throw error;
		}
	})();
	return r739C1AccurateReflectionLoadPromise;
}

window.loadR739C1AccurateReflectionPackage = loadR739C1AccurateReflectionPackage;

window.waitForR739C1AccurateReflectionReady = async function(timeoutMs)
{
	var timeout = normalizeR738PositiveInt(timeoutMs, 60000, 1000, 600000);
	var start = performance.now();
	if (!r739C1AccurateReflectionLoadPromise)
		loadR739C1AccurateReflectionPackage().catch(function() {});
	while (performance.now() - start < timeout)
	{
		if (r739C1AccurateReflectionReady)
			return window.reportR739C1AccurateReflectionConfig();
		if (r739C1AccurateReflectionError)
			throw new Error(r739C1AccurateReflectionError);
		await new Promise(function(resolve) { setTimeout(resolve, 100); });
	}
	throw new Error('R7-3.9 C1 accurate reflection package did not become ready');
};

window.setR739C1AccurateReflectionEnabled = function(enabled)
{
	r739C1AccurateReflectionEnabled = !!enabled;
	updateR739C1AccurateReflectionUniforms();
	if (r739C1AccurateReflectionEnabled && !r739C1AccurateReflectionReady)
		loadR739C1AccurateReflectionPackage().catch(function() {});
	else
		resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-9-c1-accurate-reflection-toggle');
	return window.reportR739C1AccurateReflectionConfig();
};

window.reportR739C1AccurateReflectionConfig = function()
{
	var applied = updateR739C1AccurateReflectionUniforms();
	return {
		version: 'r7-3-9-c1-accurate-reflection-bake',
		enabled: r739C1AccurateReflectionEnabled,
		ready: r739C1AccurateReflectionReady,
		applied: applied,
		error: r739C1AccurateReflectionError,
		currentPanelConfig: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0,
		configAllowed: r739C1AccurateReflectionConfigAllowed(),
		policy: 'accuracy_over_speed',
		cubemapRuntimeEnabled: false,
		packageDir: r739C1AccurateReflectionPackage ? r739C1AccurateReflectionPackage.packageDir : null,
		referenceWidth: r739C1AccurateReflectionPackage ? r739C1AccurateReflectionPackage.referenceWidth : null,
		referenceHeight: r739C1AccurateReflectionPackage ? r739C1AccurateReflectionPackage.referenceHeight : null,
		uniformMode: pathTracingUniforms && pathTracingUniforms.uR739C1AccurateReflectionMode ? pathTracingUniforms.uR739C1AccurateReflectionMode.value : null,
		uniformReady: pathTracingUniforms && pathTracingUniforms.uR739C1ReflectionReady ? pathTracingUniforms.uR739C1ReflectionReady.value : null,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
	};
};

window.loadR738C1BakePastePreviewPackage = loadR738C1BakePastePreviewPackage;

window.waitForR738C1BakePastePreviewReady = async function(timeoutMs)
{
	var timeout = normalizeR738PositiveInt(timeoutMs, 60000, 1000, 600000);
	var start = performance.now();
	if (!r738C1BakePastePreviewLoadPromise)
		loadR738C1BakePastePreviewPackage().catch(function() {});
	while (performance.now() - start < timeout)
	{
		if (r738C1BakePastePreviewReady)
			return window.reportR738C1BakePastePreviewConfig();
		if (r738C1BakePastePreviewError)
			throw new Error(r738C1BakePastePreviewError);
		await new Promise(function(resolve) { setTimeout(resolve, 100); });
	}
	throw new Error('R7-3.8 C1 bake paste preview did not become ready');
};

window.setR738C1BakePastePreviewEnabled = function(enabled)
{
	r738C1BakePastePreviewEnabled = !!enabled;
	updateR738C1BakePastePreviewUniforms();
	if (r738C1BakePastePreviewEnabled && !r738C1BakePastePreviewReady)
		loadR738C1BakePastePreviewPackage().catch(function() {});
	else
		resetR738MainAccumulation();
	if (typeof wakeRender === 'function') wakeRender('r7-3-8-c1-bake-paste-preview-toggle');
	return window.reportR738C1BakePastePreviewConfig();
};

window.reportR738C1BakePastePreviewConfig = function()
{
	var applied = updateR738C1BakePastePreviewUniforms();
	return {
		version: 'r7-3-8-c1-bake-paste-preview',
		enabled: r738C1BakePastePreviewEnabled,
		ready: r738C1BakePastePreviewReady,
		applied: applied,
		error: r738C1BakePastePreviewError,
		currentPanelConfig: (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0,
		configAllowed: r738C1BakePastePreviewConfigAllowed(),
		packageDir: r738C1BakePastePreviewPackage ? r738C1BakePastePreviewPackage.packageDir : null,
		targetAtlasResolution: r738C1BakePastePreviewPackage ? r738C1BakePastePreviewPackage.targetAtlasResolution : null,
		samplesPerTexel: r738C1BakePastePreviewPackage ? r738C1BakePastePreviewPackage.samplesPerTexel : null,
		upscaled: r738C1BakePastePreviewPackage ? r738C1BakePastePreviewPackage.upscaled : null,
		diffuseOnly: r738C1BakePastePreviewPackage ? r738C1BakePastePreviewPackage.diffuseOnly === true : null,
		uniformMode: pathTracingUniforms && pathTracingUniforms.uR738C1BakePastePreviewMode ? pathTracingUniforms.uR738C1BakePastePreviewMode.value : null,
		uniformReady: pathTracingUniforms && pathTracingUniforms.uR738C1BakePastePreviewReady ? pathTracingUniforms.uR738C1BakePastePreviewReady.value : null,
		strength: r738C1BakePastePreviewStrength,
		currentSamples: Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0)
	};
};

window.reportHomeStudioHibernationLoopState = function()
{
	var maxSamples = (typeof MAX_SAMPLES === 'number') ? MAX_SAMPLES : null;
	var currentSamples = Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0);
	return {
		version: 'r7-3-9-c1-floor-roughness-ui-v8',
		sleeping: !!homeStudioAnimationSleeping,
		framePending: !!homeStudioAnimationFrameId,
		samplingPaused: !!samplingPaused,
		cameraIsMoving: !!cameraIsMoving,
		postProcessChanged: !!postProcessChanged,
		sceneParamsChanged: !!sceneParamsChanged,
		samplingStepOnceRequested: !!samplingStepOnceRequested,
		currentSamples: currentSamples,
		maxSamples: maxSamples,
		renderLimitReached: maxSamples !== null && currentSamples >= maxSamples
	};
};

function updateMovementPreviewUniforms(activeCameraMoving)
{
	var mode = movementPreviewActive(activeCameraMoving) ? 1.0 : 0.0;
	movementPreviewLastMode = mode;
	if (pathTracingUniforms && pathTracingUniforms.uMovementPreviewMode)
		pathTracingUniforms.uMovementPreviewMode.value = mode;
}

function invalidateMovementProtectionStableFrame(reason)
{
	movementProtectionStableReady = false;
	movementProtectionLastCaptureSamples = 0;
	movementProtectionLastBlend = 0.0;
	movementProtectionLastPreviewStrength = 0.0;
	movementProtectionLastSpatialPreviewStrength = 0.0;
	movementProtectionLastWidePreviewStrength = 0.0;
	movementProtectionLastInvalidationReason = reason || 'unknown';
	updateMovementPreviewUniforms(false);
	updateMovementProtectionUniforms(false);
}

function updateMovementProtectionUniforms(activeCameraMoving)
{
	if (!screenOutputUniforms) return;
	var configAllowed = movementProtectionConfigAllowed();
	var enabled = movementProtectionEnabled && movementProtectionStableReady && configAllowed;
	var blend = enabled && activeCameraMoving ? movementProtectionMovingBlend : 0.0;
	var previewStrength = movementProtectionEnabled && configAllowed && activeCameraMoving ? movementProtectionLowSppPreviewStrength : 0.0;
	var spatialPreviewStrength = movementProtectionEnabled && configAllowed && activeCameraMoving ? movementProtectionSpatialPreviewStrength : 0.0;
	var widePreviewStrength = movementProtectionEnabled && configAllowed && activeCameraMoving ? movementProtectionWidePreviewStrength : 0.0;
	movementProtectionLastBlend = blend;
	movementProtectionLastPreviewStrength = previewStrength;
	movementProtectionLastSpatialPreviewStrength = spatialPreviewStrength;
	movementProtectionLastWidePreviewStrength = widePreviewStrength;
	if (previewStrength > movementProtectionPeakPreviewStrength)
	{
		movementProtectionPeakPreviewStrength = previewStrength;
		movementProtectionPeakPreviewSamples = Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0);
		movementProtectionPeakPreviewConfig = (typeof currentPanelConfig === 'number') ? currentPanelConfig : 0;
	}
	if (screenOutputUniforms.uMovementProtectionMode)
		screenOutputUniforms.uMovementProtectionMode.value = enabled ? 1.0 : 0.0;
	if (screenOutputUniforms.uMovementProtectionBlend)
		screenOutputUniforms.uMovementProtectionBlend.value = blend;
	if (screenOutputUniforms.uMovementProtectionLowSppPreviewStrength)
		screenOutputUniforms.uMovementProtectionLowSppPreviewStrength.value = previewStrength;
	if (screenOutputUniforms.uMovementProtectionSpatialPreviewStrength)
		screenOutputUniforms.uMovementProtectionSpatialPreviewStrength.value = spatialPreviewStrength;
	if (screenOutputUniforms.uMovementProtectionWidePreviewStrength)
		screenOutputUniforms.uMovementProtectionWidePreviewStrength.value = widePreviewStrength;
	if (screenOutputUniforms.tMovementProtectionStableTexture && movementProtectionRenderTarget)
		screenOutputUniforms.tMovementProtectionStableTexture.value = movementProtectionRenderTarget.texture;
}

function captureMovementProtectionStableFrame()
{
	if (!movementProtectionEnabled || !movementProtectionRenderTarget || !screenOutputUniforms)
		return false;
	if (!movementProtectionConfigAllowed())
		return false;
	if (cameraIsMoving || sampleCounter < movementProtectionMinStableSamples)
		return false;
	if (movementProtectionLastCaptureSamples === Math.round(sampleCounter))
		return false;

	var savedMode = screenOutputUniforms.uMovementProtectionMode ? screenOutputUniforms.uMovementProtectionMode.value : 0.0;
	var savedBlend = screenOutputUniforms.uMovementProtectionBlend ? screenOutputUniforms.uMovementProtectionBlend.value : 0.0;
	var savedStableTexture = screenOutputUniforms.tMovementProtectionStableTexture ? screenOutputUniforms.tMovementProtectionStableTexture.value : null;
	if (screenOutputUniforms.uMovementProtectionMode) screenOutputUniforms.uMovementProtectionMode.value = 0.0;
	if (screenOutputUniforms.uMovementProtectionBlend) screenOutputUniforms.uMovementProtectionBlend.value = 0.0;
	if (screenOutputUniforms.tMovementProtectionStableTexture) screenOutputUniforms.tMovementProtectionStableTexture.value = pathTracingRenderTarget.texture;

	renderer.setRenderTarget(movementProtectionRenderTarget);
	renderer.render(screenOutputScene, orthoCamera);

	if (screenOutputUniforms.uMovementProtectionMode) screenOutputUniforms.uMovementProtectionMode.value = savedMode;
	if (screenOutputUniforms.uMovementProtectionBlend) screenOutputUniforms.uMovementProtectionBlend.value = savedBlend;
	if (screenOutputUniforms.tMovementProtectionStableTexture) screenOutputUniforms.tMovementProtectionStableTexture.value = savedStableTexture;

	movementProtectionStableReady = true;
	movementProtectionLastCaptureSamples = Math.round(sampleCounter);
	updateMovementProtectionUniforms(cameraIsMoving);
	return true;
}


// The following list of keys is not exhaustive, but it should be more than enough to build interactive demos and games
let KeyboardState = {
	KeyA: false, KeyB: false, KeyC: false, KeyD: false, KeyE: false, KeyF: false, KeyG: false, KeyH: false, KeyI: false, KeyJ: false, KeyK: false, KeyL: false, KeyM: false,
	KeyN: false, KeyO: false, KeyP: false, KeyQ: false, KeyR: false, KeyS: false, KeyT: false, KeyU: false, KeyV: false, KeyW: false, KeyX: false, KeyY: false, KeyZ: false,
	ArrowLeft: false, ArrowUp: false, ArrowRight: false, ArrowDown: false, Space: false, Enter: false, PageUp: false, PageDown: false, Tab: false,
	Minus: false, Equal: false, BracketLeft: false, BracketRight: false, Semicolon: false, Quote: false, Backquote: false,
	Comma: false, Period: false, ShiftLeft: false, ShiftRight: false, Slash: false, Backslash: false, Backspace: false,
	Digit1: false, Digit2: false, Digit3: false, Digit4: false, Digit5: false, Digit6: false, Digit7: false, Digit8: false, Digit9: false, Digit0: false
}

function homeStudioKeyboardInputCanAffectRender(code)
{
	return code === 'KeyW' || code === 'KeyS' ||
		code === 'KeyA' || code === 'KeyD' ||
		code === 'KeyE' || code === 'KeyC' ||
		code === 'ArrowUp' || code === 'ArrowDown' ||
		code === 'ArrowRight' || code === 'ArrowLeft' ||
		code === 'KeyO' || code === 'KeyP';
}

function onKeyDown(event)
{
	event.preventDefault();

	KeyboardState[event.code] = true;
	if (homeStudioKeyboardInputCanAffectRender(event.code) && typeof scheduleHomeStudioAnimationFrame === 'function')
		scheduleHomeStudioAnimationFrame();
}

function onKeyUp(event)
{
	event.preventDefault();

	KeyboardState[event.code] = false;
	if (homeStudioKeyboardInputCanAffectRender(event.code) && typeof scheduleHomeStudioAnimationFrame === 'function')
		scheduleHomeStudioAnimationFrame();
}

function keyPressed(keyName)
{
	if (!mouseControl)
		return;

	return KeyboardState[keyName];
}


function onMouseWheel(event)
{
	if (isPaused)
		return;

	// use the following instead, because event.preventDefault() gives errors in console
	event.stopPropagation();

	if (event.deltaY > 0)
	{
		increaseFOV = true;
		dollyCameraOut = true;
	}
	else if (event.deltaY < 0)
	{
		decreaseFOV = true;
		dollyCameraIn = true;
	}
	if (typeof wakeRender === 'function') wakeRender();
}

/**
 * originally from https://github.com/mrdoob/three.js/blob/dev/examples/js/controls/PointerLockControls.js
 * @author mrdoob / http://mrdoob.com/
 *
 * edited by Erich Loftis (erichlof on GitHub)
 * https://github.com/erichlof
 * Btw, this is the most concise and elegant way to implement first person camera rotation/movement that I've ever seen -
 * look at how short it is, without spaces/braces it would be around 30 lines!  Way to go, mrdoob!
 */

function FirstPersonCameraControls(camera)
{
	camera.rotation.set(0, 0, 0);

	let pitchObject = new THREE.Object3D();
	pitchObject.add(camera);

	let yawObject = new THREE.Object3D();
	yawObject.add(pitchObject);

	function onMouseMove(event)
	{
		if (isPaused)
			return;
		inputMovementHorizontal = event.movementX || event.mozMovementX || 0;
		inputMovementVertical = event.movementY || event.mozMovementY || 0;

		inputMovementHorizontal = -inputMovementHorizontal * 0.0012 * cameraRotationSpeed;
		inputMovementVertical = -inputMovementVertical * 0.001 * cameraRotationSpeed;

		if (useGenericInput)
		{
			inputRotationHorizontal = cameraControlsYawObject.rotation.y;
			inputRotationVertical = cameraControlsPitchObject.rotation.x;
		}

		if (inputMovementHorizontal) // prevent NaNs due to invalid mousemove data from browser
		{
			inputRotationHorizontal += inputMovementHorizontal;
			if (typeof wakeRender === 'function') wakeRender();
		}
		if (inputMovementVertical) // prevent NaNs due to invalid mousemove data from browser
		{
			inputRotationVertical += inputMovementVertical;
			if (typeof wakeRender === 'function') wakeRender();
		}

		if (useGenericInput)
		{
			// clamp the camera's vertical rotation (around the x-axis) to the scene's 'ceiling' and 'floor'
			if (inputRotationVertical < -PI_2)
			{
				inputRotationVertical = -PI_2;
				inputMovementVertical = 0;
			}
			if (inputRotationVertical > PI_2)
			{
				inputRotationVertical = PI_2;
				inputMovementVertical = 0;
			}
		}
	}

	document.addEventListener('mousemove', onMouseMove, false);


	this.getObject = function()
	{
		return yawObject;
	};

	this.getYawObject = function()
	{
		return yawObject;
	};

	this.getPitchObject = function()
	{
		return pitchObject;
	};

	this.getDirection = function()
	{
		const te = pitchObject.matrixWorld.elements;

		return function(v)
		{
			v.set(te[8], te[9], te[10]).negate();
			return v;
		};
	}();

	this.getUpVector = function()
	{
		const te = pitchObject.matrixWorld.elements;

		return function(v)
		{
			v.set(te[4], te[5], te[6]);
			return v;
		};
	}();

	this.getRightVector = function()
	{
		const te = pitchObject.matrixWorld.elements;

		return function(v)
		{
			v.set(te[0], te[1], te[2]);
			return v;
		};
	}();

} // end function FirstPersonCameraControls(camera)


function onWindowResize(event)
{

	windowIsBeingResized = true;

	// 固定渲染緩衝區為 2560×1440 (16:9)，與視窗大小解耦
	SCREEN_WIDTH = 2560;
	SCREEN_HEIGHT = 1440;

	renderer.setPixelRatio(pixelRatio);
	renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT, false);

	pathTracingUniforms.uResolution.value.x = context.drawingBufferWidth;
	pathTracingUniforms.uResolution.value.y = context.drawingBufferHeight;

	pathTracingRenderTarget.setSize(context.drawingBufferWidth, context.drawingBufferHeight);
	screenCopyRenderTarget.setSize(context.drawingBufferWidth, context.drawingBufferHeight);
	if (movementProtectionRenderTarget)
	{
		movementProtectionRenderTarget.setSize(context.drawingBufferWidth, context.drawingBufferHeight);
		invalidateMovementProtectionStableFrame('resize');
	}

	// R6 LGG-r16 J3：borrow buffer 同步 1/8 解析度 resize
	if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget)
	{
		const lowW = Math.max(1, Math.floor(context.drawingBufferWidth / 8));
		const lowH = Math.max(1, Math.floor(context.drawingBufferHeight / 8));
		borrowPathTracingRenderTarget.setSize(lowW, lowH);
		borrowScreenCopyRenderTarget.setSize(lowW, lowH);
	}

	// R2-UI Bloom pyramid：7 層 mip (1/2 ~ 1/128) 同步 resize
	if (bloomMip && bloomMip.length === 7)
	{
		const w = context.drawingBufferWidth;
		const h = context.drawingBufferHeight;
		for (let i = 0; i < 7; i++)
		{
			const div = 1 << (i + 1); // 2, 4, 8, 16, 32, 64, 128
			bloomMip[i].setSize(Math.max(1, Math.floor(w / div)), Math.max(1, Math.floor(h / div)));
		}
	}

	worldCamera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
	// the following is normally used with traditional rasterized rendering, but it is not needed for our fragment shader raytraced rendering
	///worldCamera.updateProjectionMatrix();

	// the following scales all scene objects by the worldCamera's field of view,
	// taking into account the screen aspect ratio and multiplying the uniform uULen,
	// the x-coordinate, by this ratio
	fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
	pathTracingUniforms.uVLen.value = Math.tan(fovScale);
	pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

	if (!mouseControl && mobileShowButtons)
	{
		button1Element.style.display = "";
		button2Element.style.display = "";
		button3Element.style.display = "";
		button4Element.style.display = "";
		button5Element.style.display = "";
		button6Element.style.display = "";
		// check if mobile device is in portrait or landscape mode and position buttons accordingly
		if (SCREEN_WIDTH < SCREEN_HEIGHT)
		{
			button1Element.style.right = 36 + "%";
			button2Element.style.right = 2 + "%";
			button3Element.style.right = 16 + "%";
			button4Element.style.right = 16 + "%";
			button5Element.style.right = 3 + "%";
			button6Element.style.right = 3 + "%";

			button1Element.style.bottom = 5 + "%";
			button2Element.style.bottom = 5 + "%";
			button3Element.style.bottom = 13 + "%";
			button4Element.style.bottom = 2 + "%";
			button5Element.style.bottom = 25 + "%";
			button6Element.style.bottom = 18 + "%";
		}
		else
		{
			button1Element.style.right = 22 + "%";
			button2Element.style.right = 3 + "%";
			button3Element.style.right = 11 + "%";
			button4Element.style.right = 11 + "%";
			button5Element.style.right = 3 + "%";
			button6Element.style.right = 3 + "%";

			button1Element.style.bottom = 10 + "%";
			button2Element.style.bottom = 10 + "%";
			button3Element.style.bottom = 26 + "%";
			button4Element.style.bottom = 4 + "%";
			button5Element.style.bottom = 48 + "%";
			button6Element.style.bottom = 34 + "%";
		}
	} // end if ( !mouseControl ) {

} // end function onWindowResize( event )



function init()
{

	window.addEventListener('resize', onWindowResize, false);
	window.addEventListener('orientationchange', onWindowResize, false);

	if ('ontouchstart' in window)
	{
		mouseControl = false;
		// if on mobile device, unpause the app because there is no ESC key and no mouse capture to do
		isPaused = false;

		ableToEngagePointerLock = true;
	}

	// default GUI elements for all demos

	pixel_ResolutionObject = {
		pixel_Resolution: 0.5 // will be set by each demo's js file
	}
	orthographicCamera_ToggleObject = {
		Orthographic_Camera: false
	}

	function handlePixelResolutionChange()
	{
		needChangePixelResolution = true;
	}
	function handleCameraProjectionChange()
	{
		if (!currentlyUsingOrthographicCamera)
			changeToOrthographicCamera = true;
		else if (currentlyUsingOrthographicCamera)
			changeToPerspectiveCamera = true;
		// toggle boolean flag
		currentlyUsingOrthographicCamera = !currentlyUsingOrthographicCamera;
	}


	// R4-1: lil-gui removed; ui-container pointer-lock guard is in initUI()

	if (mouseControl) // on desktop
	{

		window.addEventListener('wheel', onMouseWheel, false);

		// window.addEventListener("click", function(event)
		// {
		// 	event.preventDefault();
		// }, false);
		window.addEventListener("dblclick", function (event)
		{
			event.preventDefault();
		}, false);

		document.body.addEventListener("click", function (event)
		{
			if (!ableToEngagePointerLock)
				return;
			this.requestPointerLock = this.requestPointerLock || this.mozRequestPointerLock;
			this.requestPointerLock();
		}, false);


		pointerlockChange = function (event)
		{
			if (document.pointerLockElement === document.body ||
				document.mozPointerLockElement === document.body || document.webkitPointerLockElement === document.body)
			{
				document.addEventListener('keydown', onKeyDown, false);
				document.addEventListener('keyup', onKeyUp, false);
				isPaused = false;
			}
			else
			{
				document.removeEventListener('keydown', onKeyDown, false);
				document.removeEventListener('keyup', onKeyUp, false);
				isPaused = true;
			}
		};

		// Hook pointer lock state change events
		document.addEventListener('pointerlockchange', pointerlockChange, false);
		document.addEventListener('mozpointerlockchange', pointerlockChange, false);
		document.addEventListener('webkitpointerlockchange', pointerlockChange, false);

	} // end if (mouseControl)

	if (!mouseControl) // on mobile
	{
		// R4-1: pixel resolution slider is now in initUI(); orthographic toggle removed
	}


	/* // Fullscreen API (optional)
	document.addEventListener("click", function()
	{
		if ( !document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement )
		{
			if (document.documentElement.requestFullscreen)
				document.documentElement.requestFullscreen();
			else if (document.documentElement.mozRequestFullScreen)
				document.documentElement.mozRequestFullScreen();
			else if (document.documentElement.webkitRequestFullscreen)
				document.documentElement.webkitRequestFullscreen();
		}
	}); */

	// load a resource
	blueNoiseTexture = textureLoader.load(
		// resource URL
		'textures/BlueNoise_R_128.png',

		// onLoad callback
		function (texture)
		{
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.flipY = false;
			texture.minFilter = THREE.NearestFilter;
			texture.magFilter = THREE.NearestFilter;
			texture.generateMipmaps = false;
			//console.log("blue noise texture loaded");

			initTHREEjs(); // boilerplate: init necessary three.js items and scene/demo-specific objects
		}
	);


} // end function init()



function initTHREEjs()
{

	canvas = document.createElement('canvas');

	renderer = new THREE.WebGLRenderer({ canvas: canvas, context: canvas.getContext('webgl2') });
	//suggestion: set to false for production
	renderer.debug.checkShaderErrors = true;

	renderer.autoClear = false;

	renderer.toneMapping = THREE.ReinhardToneMapping;

	//required by WebGL 2.0 for rendering to FLOAT textures
	context = renderer.getContext();
	context.getExtension('EXT_color_buffer_float');

	container = document.getElementById('container');
	container.appendChild(renderer.domElement);

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.cursor = "default";
	stats.domElement.style.userSelect = "none";
	stats.domElement.style.MozUserSelect = "none";
	stats.domElement.style.display = 'none';
	container.appendChild(stats.domElement);


	clockTimer = new THREE.Timer();

	pathTracingScene = new THREE.Scene();
	screenCopyScene = new THREE.Scene();
	screenOutputScene = new THREE.Scene();

	// orthoCamera is the camera to help render the oversized full-screen triangle, which is stretched across the
	// screen (and a little outside the viewport).  orthoCamera is an orthographic camera that sits facing the view plane,
	// which serves as the window into our 3d world. This camera will not move or rotate for the duration of the app.
	orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	screenCopyScene.add(orthoCamera);
	screenOutputScene.add(orthoCamera);

	// worldCamera is the dynamic camera 3d object that will be positioned, oriented and constantly updated inside
	// the 3d scene.  Its view will ultimately get passed back to the stationary orthoCamera that renders
	// the scene to a full-screen triangle, which is stretched across the viewport.
	worldCamera = new THREE.PerspectiveCamera(60, document.body.clientWidth / document.body.clientHeight, 1, 1000);
	storedFOV = worldCamera.fov;
	pathTracingScene.add(worldCamera);

	controls = new FirstPersonCameraControls(worldCamera);

	cameraControlsObject = controls.getObject();
	cameraControlsYawObject = controls.getYawObject();
	cameraControlsPitchObject = controls.getPitchObject();

	pathTracingScene.add(cameraControlsObject);


	// setup render targets...
	pathTracingRenderTarget = new THREE.WebGLRenderTarget(context.drawingBufferWidth, context.drawingBufferHeight, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		depthBuffer: false,
		stencilBuffer: false
	});
	pathTracingRenderTarget.texture.generateMipmaps = false;

	screenCopyRenderTarget = new THREE.WebGLRenderTarget(context.drawingBufferWidth, context.drawingBufferHeight, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		depthBuffer: false,
		stencilBuffer: false
	});
	screenCopyRenderTarget.texture.generateMipmaps = false;

	movementProtectionRenderTarget = new THREE.WebGLRenderTarget(context.drawingBufferWidth, context.drawingBufferHeight, {
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		format: THREE.RGBAFormat,
		type: THREE.FloatType,
		depthBuffer: false,
		stencilBuffer: false
	});
	movementProtectionRenderTarget.texture.generateMipmaps = false;

	// R6 LGG-r16 J3：1/8 解析度 14 彈借光 buffer（暗角真光來源）
	// borrowPathTracingRenderTarget 用 LinearFilter，主 pass texture() bilinear 採樣較平滑
	// borrowScreenCopyRenderTarget  用 NearestFilter，因為只是 ping-pong 副本，texelFetch 取整數座標
	{
		const lowW = Math.max(1, Math.floor(context.drawingBufferWidth / 8));
		const lowH = Math.max(1, Math.floor(context.drawingBufferHeight / 8));
		borrowPathTracingRenderTarget = new THREE.WebGLRenderTarget(lowW, lowH, {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
			type: THREE.FloatType,
			depthBuffer: false,
			stencilBuffer: false
		});
		borrowPathTracingRenderTarget.texture.generateMipmaps = false;
		borrowScreenCopyRenderTarget = new THREE.WebGLRenderTarget(lowW, lowH, {
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			format: THREE.RGBAFormat,
			type: THREE.FloatType,
			depthBuffer: false,
			stencilBuffer: false
		});
		borrowScreenCopyRenderTarget.texture.generateMipmaps = false;
	}

	// R2-UI Bloom multi-scale：4 層 mip chain (1/2, 1/4, 1/8, 1/16)
	// LinearFilter 讓上採樣 tent filter 與 composite 的 bilinear 都能平滑插值
	{
		const W = context.drawingBufferWidth;
		const H = context.drawingBufferHeight;
		// 7 層：1/2, 1/4, 1/8, 1/16, 1/32, 1/64, 1/128
		for (let i = 0; i < 7; i++)
		{
			const div = 1 << (i + 1);
			const mw = Math.max(1, Math.floor(W / div));
			const mh = Math.max(1, Math.floor(H / div));
			bloomMip[i] = new THREE.WebGLRenderTarget(mw, mh, {
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				format: THREE.RGBAFormat,
				type: THREE.FloatType,
				depthBuffer: false,
				stencilBuffer: false
			});
			bloomMip[i].texture.generateMipmaps = false;
		}
	}



	// setup scene/demo-specific objects, variables, GUI elements, and data
	initSceneData();


	if ( !mouseControl )
	{
		mobileJoystickControls = new MobileJoystickControls({
			//showJoystick: true,
			showButtons: mobileShowButtons,
			useDarkButtons: mobileUseDarkButtons
		});
	}

	if (typeof setSliderValue === 'function') setSliderValue('slider-pixel-res', pixelRatio);
	// R4-1: orthographic toggle removed (was lil-gui controller)


	// setup oversized full-screen triangle geometry and shaders....

	// this full-screen single triangle mesh will perform the path tracing operations, producing a screen-sized image

	trianglePositions.push(-1,-1, 0 ); // start in lower left corner of viewport
	trianglePositions.push( 3,-1, 0 ); // go beyond right side of viewport, in order to have full-screen coverage
	trianglePositions.push(-1, 3, 0 ); // go beyond top of viewport, in order to have full-screen coverage
	triangleGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( trianglePositions, 3 ));


	pathTracingUniforms.tPreviousTexture = { type: "t", value: screenCopyRenderTarget.texture };
	pathTracingUniforms.tBlueNoiseTexture = { type: "t", value: blueNoiseTexture };
	// R6 LGG-r16 J3：借光 buffer 紋理引用，主 pass 在 terminal 採樣
	pathTracingUniforms.tBorrowTexture = { type: "t", value: borrowPathTracingRenderTarget.texture };
	if (typeof loadR738C1BakePastePreviewPackage === 'function')
		loadR738C1BakePastePreviewPackage().catch(function() {});
	if (typeof loadR739C1AccurateReflectionPackage === 'function')
		loadR739C1AccurateReflectionPackage().catch(function() {});

	pathTracingUniforms.uCameraMatrix = { type: "m4", value: new THREE.Matrix4() };

	pathTracingUniforms.uResolution = { type: "v2", value: new THREE.Vector2() };
	pathTracingUniforms.uRandomVec2 = { type: "v2", value: new THREE.Vector2() };

	pathTracingUniforms.uEPS_intersect = { type: "f", value: EPS_intersect };
	pathTracingUniforms.uTime = { type: "f", value: 0.0 };
	pathTracingUniforms.uSampleCounter = { type: "f", value: 0.0 }; //0.0
	pathTracingUniforms.uPreviousSampleCount = { type: "f", value: 1.0 };
	pathTracingUniforms.uFrameCounter = { type: "f", value: 1.0 }; //1.0
	pathTracingUniforms.uR71BlueNoiseSamplingMode = { type: "f", value: r71BlueNoiseSamplingEnabled ? 1.0 : 0.0 };
	pathTracingUniforms.uULen = { type: "f", value: 1.0 };
	pathTracingUniforms.uVLen = { type: "f", value: 1.0 };
	pathTracingUniforms.uApertureSize = { type: "f", value: apertureSize };
	pathTracingUniforms.uFocusDistance = { type: "f", value: focusDistance };
	pathTracingUniforms.uSamplesPerFrame = { type: "f", value: 1.0 };

	pathTracingUniforms.uCameraIsMoving = { type: "b1", value: false };
	pathTracingUniforms.uUseOrthographicCamera = { type: "b1", value: false };
	pathTracingUniforms.uSceneIsDynamic = { type: "b1", value: false };
	pathTracingUniforms.uMovementPreviewMode = { type: "f", value: 0.0 };

	// R2-UI: 牆面反射率（牆/天花板/柱樑），預設 1.0（R2-18 fix18：使用者肉眼校準）
	pathTracingUniforms.uWallAlbedo = { type: "f", value: 1.0 };

	// R2-UI: 最大反彈次數 runtime 可調（硬性上限 14 寫死在 shader for 迴圈編譯期）
	pathTracingUniforms.uMaxBounces = { type: "f", value: 14.0 };

	pathTracingDefines = {
		//NUMBER_OF_TRIANGLES: total_number_of_triangles
	};

	// load vertex and fragment shader files that are used in the pathTracing material, mesh and scene
	fileLoader.load('shaders/common_PathTracing_Vertex.glsl', function (vertexShaderText)
	{
		pathTracingVertexShader = vertexShaderText;
		flushCommonVertexShaderCallbacks();

		fileLoader.load('shaders/' + demoFragmentShaderFileName, function (fragmentShaderText)
		{

			pathTracingFragmentShader = fragmentShaderText;

			runAfterCommonVertexShaderReady(function ()
			{
				pathTracingMaterial = createCommonVertexShaderMaterial({
					uniforms: pathTracingUniforms,
					uniformsGroups: pathTracingUniformsGroups,
					defines: pathTracingDefines,
					fragmentShader: pathTracingFragmentShader,
					depthTest: false,
					depthWrite: false
				});

				pathTracingMesh = new THREE.Mesh(triangleGeometry, pathTracingMaterial);
				pathTracingScene.add(pathTracingMesh);

				// the following keeps the oversized full-screen triangle right in front
				//   of the camera at all times. This is necessary because without it, the full-screen
				//   triangle will fall out of view and get clipped when the camera rotates past 180 degrees.
				worldCamera.add(pathTracingMesh);
			});

		});
	});


	// this oversized full-screen triangle mesh copies the image output of the pathtracing shader and feeds it back in to that shader as a 'previousTexture'

	screenCopyUniforms = {
		tPathTracedImageTexture: { type: "t", value: pathTracingRenderTarget.texture }
	};

	fileLoader.load('shaders/ScreenCopy_Fragment.glsl', function (shaderText)
	{

		screenCopyFragmentShader = shaderText;

		runAfterCommonVertexShaderReady(function ()
		{
			screenCopyMaterial = createCommonVertexShaderMaterial({
				uniforms: screenCopyUniforms,
				fragmentShader: screenCopyFragmentShader,
				depthWrite: false,
				depthTest: false
			});

			screenCopyMesh = new THREE.Mesh(triangleGeometry, screenCopyMaterial);
			screenCopyScene.add(screenCopyMesh);
		});
	});


	// this oversized full-screen triangle mesh takes the image output of the path tracing shader (which is a continuous blend of the previous frame and current frame),
	// and applies gamma correction (which brightens the entire image), and then displays the final accumulated rendering to the screen

	screenOutputUniforms = {
		tPathTracedImageTexture: { type: "t", value: pathTracingRenderTarget.texture },
		tMovementProtectionStableTexture: { type: "t", value: movementProtectionRenderTarget.texture },
		// R2-UI Bloom multi-scale：最終合成貼圖（1/2 解析度 mip[0]，pyramid upsample 後的結果）
		tBloomTexture: { type: "t", value: bloomMip[0].texture },
		uSampleCounter: { type: "f", value: 0.0 },
		uOneOverSampleCounter: { type: "f", value: 0.0 },
		uPixelEdgeSharpness: { type: "f", value: pixelEdgeSharpness },
		uEdgeSharpenSpeed: { type: "f", value: edgeSharpenSpeed },
		//uFilterDecaySpeed: { type: "f", value: filterDecaySpeed },
		uCameraIsMoving: { type: "b1", value: false },
		uSceneIsDynamic: { type: "b1", value: sceneIsDynamic },
		uUseToneMapping: { type: "b1", value: useToneMapping },
		uMovementProtectionMode: { type: "f", value: 0.0 },
		uMovementProtectionBlend: { type: "f", value: 0.0 },
		uMovementProtectionLowSppPreviewStrength: { type: "f", value: 0.0 },
		uMovementProtectionSpatialPreviewStrength: { type: "f", value: 0.0 },
		uMovementProtectionWidePreviewStrength: { type: "f", value: 0.0 },
		uR73QuickPreviewFillMode: { type: "f", value: 0.0 },
		uR73QuickPreviewFillStrength: { type: "f", value: r73QuickPreviewFillEffectiveStrength },
		// R2-UI: Bloom composite 強度，0 = 關閉
		uBloomIntensity: { type: "f", value: 0.03 },
		// R2-UI: Bloom debug，1.0 = 直接顯示 bloom target（verify pipeline）
		uBloomDebug: { type: "f", value: 0.0 },
		// R6 飽和度：post-tonemap pre-gamma 飽和度補償，1.0 = 中性
		uSaturation: { type: "f", value: 1.0 },
		// R6 LGG-r10：pre-tonemap HDR 曝光線性倍率，1.0 = 中性（A/B 各自獨立寫入）
		uExposure: { type: "f", value: 1.0 },
		// R6 Route X (LGG pivot)：B 模式可切換 ACES tonemap + LGG 三段調色
		// A 模式（趨近真實）強制 enabled=0 + 中性值，視覺等同 Reinhard 純輸出
		uACESEnabled: { type: "f", value: 0.0 },  // 0=純 Reinhard、1=啟用 ACES 混合
		uACESStrength: { type: "f", value: 0.30 },// ACES 混合強度 0~1，0=純 Reinhard、1=純 ACES
		uACESSatShadow: { type: "f", value: 1.0 },// ACES 暗部飽和 0~2，1=中性
		uACESSatMid: { type: "f", value: 1.0 },   // ACES 中段飽和 0~2，1=中性
		uACESSatHighlight: { type: "f", value: 1.0 }, // ACES 亮部飽和 0~2，1=中性
		uLGGEnabled: { type: "f", value: 0.0 },   // 0=跳過 LGG、1=套 Lift/Gamma/Gain（按強度混血）
		uLGGStrength: { type: "f", value: 1.00 }, // LGG 整體強度 0~1，0=不套、1=完整套
		uLGGLift:  { type: "f", value: 0.0 },     // 暗部偏移 -0.30 ~ +0.30，0=中性
		uLGGGamma: { type: "f", value: 1.0 },     // 中間調曲線 0.50 ~ 2.00，1=中性
		uLGGGain:  { type: "f", value: 1.0 },     // 亮部增益 0.50 ~ 1.50，1=中性
		// R6 LGG-r30：B 模 White Balance + Hue 後製（display-space 最末端、不觸發採樣重置）
		// WB 走 von Kries chromatic adaptation，Hue 走 NTSC luma-preserving 色相環旋轉
		uWBB:  { type: "f", value: 0.0 },         // 白平衡 -1=藍冷 ~ +1=黃暖，0=中性
		uHueB: { type: "f", value: 0.0 }          // 色相環旋轉角度（degrees），0=中性
	};

fileLoader.load('shaders/ScreenOutput_Fragment.glsl?v=r7-3-9-c1-floor-roughness-ui-v8', function (shaderText)
	{

		screenOutputFragmentShader = shaderText;

		runAfterCommonVertexShaderReady(function ()
		{
			screenOutputMaterial = createCommonVertexShaderMaterial({
				uniforms: screenOutputUniforms,
				fragmentShader: screenOutputFragmentShader,
				depthWrite: false,
				depthTest: false
			});

			screenOutputMesh = new THREE.Mesh(triangleGeometry, screenOutputMaterial);
			screenOutputScene.add(screenOutputMesh);
		});
	});


	// R2-UI Bloom pyramid (Jimenez / Unreal / Blender Eevee)：
	// brightpass：pathTracing(full) → bloomMip[0](1/2)，13-tap Karis average downsample + 亮度閾值
	// downsample：mip[n] → mip[n+1]，13-tap partial average，連做至多 6 次 (1/2 → 1/128)
	// upsample：mip[n+1] → mip[n]，9-tap tent filter（radius=1 fix）+ AdditiveBlending，連做至多 6 次 (1/128 → 1/2)
	// 實際層數由 window.bloomMipCount 控制 (3~7)

	bloomBrightpassScene = new THREE.Scene();
	bloomDownsampleScene = new THREE.Scene();
	bloomUpsampleScene = new THREE.Scene();
	bloomBrightpassScene.add(orthoCamera);
	bloomDownsampleScene.add(orthoCamera);
	bloomUpsampleScene.add(orthoCamera);

	bloomBrightpassUniforms = {
		tPathTracedImageTexture: { type: "t", value: pathTracingRenderTarget.texture },
		uOneOverSampleCounter: { type: "f", value: 1.0 }
	};

	// downsample/upsample 每個 pass 動態改 tBloomTexture.value，共用單一 material/scene
	bloomDownsampleUniforms = {
		tBloomTexture: { type: "t", value: bloomMip[0].texture }
	};

	bloomUpsampleUniforms = {
		tBloomTexture: { type: "t", value: bloomMip[6].texture }
	};

	fileLoader.load('shaders/Bloom_Brightpass_Fragment.glsl', function (shaderText)
	{
		runAfterCommonVertexShaderReady(function ()
		{
			bloomBrightpassMaterial = createCommonVertexShaderMaterial({
				uniforms: bloomBrightpassUniforms,
				fragmentShader: shaderText,
				depthWrite: false,
				depthTest: false
			});
			bloomBrightpassMesh = new THREE.Mesh(triangleGeometry, bloomBrightpassMaterial);
			bloomBrightpassScene.add(bloomBrightpassMesh);
		});
	});

	fileLoader.load('shaders/Bloom_Downsample_Fragment.glsl', function (shaderText)
	{
		runAfterCommonVertexShaderReady(function ()
		{
			bloomDownsampleMaterial = createCommonVertexShaderMaterial({
				uniforms: bloomDownsampleUniforms,
				fragmentShader: shaderText,
				depthWrite: false,
				depthTest: false
			});
			bloomDownsampleMesh = new THREE.Mesh(triangleGeometry, bloomDownsampleMaterial);
			bloomDownsampleScene.add(bloomDownsampleMesh);
		});
	});

	fileLoader.load('shaders/Bloom_Upsample_Fragment.glsl', function (shaderText)
	{
		runAfterCommonVertexShaderReady(function ()
		{
			bloomUpsampleMaterial = createCommonVertexShaderMaterial({
				uniforms: bloomUpsampleUniforms,
				fragmentShader: shaderText,
				depthWrite: false,
				depthTest: false,
				// R2-UI：加法混合 → upsample 結果與 dest mip 既有 downsample 結果疊加
				blending: THREE.AdditiveBlending,
				transparent: true
			});
			bloomUpsampleMesh = new THREE.Mesh(triangleGeometry, bloomUpsampleMaterial);
			bloomUpsampleScene.add(bloomUpsampleMesh);
		});
	});


	// this 'jumpstarts' the initial dimensions and parameters for the window and renderer
	onWindowResize();

	// everything is set up, now we can start animating
	scheduleHomeStudioAnimationFrame();

} // end function initTHREEjs()


function scheduleHomeStudioAnimationFrame()
{
	homeStudioAnimationSleeping = false;
	if (homeStudioAnimationFrameId)
		return;
	homeStudioAnimationFrameId = requestAnimationFrame(function()
	{
		homeStudioAnimationFrameId = 0;
		animate();
	});
}

function animate()
{
	// R2-UI：60 FPS cap —— 間隔不足 ~16.7ms 直接 reschedule，避免 120Hz 螢幕上全速 path tracing
	const nowMs = performance.now();
	if (nowMs - lastRenderTime < FRAME_INTERVAL_MS)
	{
		scheduleHomeStudioAnimationFrame();
		return;
	}
	lastRenderTime = nowMs;

	// update clock
	clockTimer.update();
	frameTime = clockTimer.getDelta();
	elapsedTime = clockTimer.getElapsed() % 1000;

	// reset flags
	cameraIsMoving = false;

	// if GUI has been used, update
	if (needChangePixelResolution)
	{
		pixelRatio = (typeof getSliderValue === 'function') ? getSliderValue('slider-pixel-res') : pixelRatio;
		onWindowResize();
		needChangePixelResolution = false;
	}

	if (windowIsBeingResized)
	{
		cameraIsMoving = true;
		windowIsBeingResized = false;
	}

	// R2-UI：GUI 參數變化 → 強制累加 buffer 刷新（即使原本已在 1000 SPP 休眠）
	if (sceneParamsChanged)
	{
		cameraIsMoving = true;
		invalidateMovementProtectionStableFrame('sceneParamsChanged');
		sceneParamsChanged = false;
	}

	// check user controls
	if (mouseControl)
	{
		// movement detected
		if (oldYawRotation != inputRotationHorizontal ||
			oldPitchRotation != inputRotationVertical)
		{
			cameraIsMoving = true;
		}

		// save state for next frame
		oldYawRotation = inputRotationHorizontal;
		oldPitchRotation = inputRotationVertical;

	} // end if (mouseControl)

	// if on mobile device, get input from the mobileJoystickControls
	if (!mouseControl)
	{
		if (useGenericInput)
		{
			inputRotationHorizontal = cameraControlsYawObject.rotation.y;
			inputRotationVertical = cameraControlsPitchObject.rotation.x;
		}

		newDeltaX = joystickDeltaX * cameraRotationSpeed;
		if (newDeltaX)
		{
			cameraIsMoving = true;
			// the ' || 0 ' prevents NaNs from creeping into inputRotationHorizontal calc below
			inputMovementHorizontal = ((oldDeltaX - newDeltaX) * 0.01) || 0;
			// mobileJoystick X movement (left and right) affects camera rotation around the Y axis
			inputRotationHorizontal += inputMovementHorizontal;
		}

		newDeltaY = joystickDeltaY * cameraRotationSpeed;
		if (newDeltaY)
		{
			cameraIsMoving = true;
			// the ' || 0 ' prevents NaNs from creeping into inputRotationVertical calc below
			inputMovementVertical = ((oldDeltaY - newDeltaY) * 0.01) || 0;
			// mobileJoystick Y movement (up and down) affects camera rotation around the X axis
			inputRotationVertical += inputMovementVertical;
		}

		// clamp the camera's vertical rotation (around the x-axis) to the scene's 'ceiling' and 'floor',
		// so you can't accidentally flip the camera upside down
		if (useGenericInput)
		{
			if (inputRotationVertical < -PI_2)
			{
				inputRotationVertical = -PI_2;
				inputMovementVertical = 0;
			}
			if (inputRotationVertical > PI_2)
			{
				inputRotationVertical = PI_2;
				inputMovementVertical = 0;
			}
		}

		// save state for next frame
		oldDeltaX = newDeltaX;
		oldDeltaY = newDeltaY;


		newPinchWidthX = pinchWidthX;
		newPinchWidthY = pinchWidthY;
		pinchDeltaX = newPinchWidthX - oldPinchWidthX;
		pinchDeltaY = newPinchWidthY - oldPinchWidthY;

		if (Math.abs(pinchDeltaX) > Math.abs(pinchDeltaY))
		{
			if (pinchDeltaX < -1)
			{
				increaseFOV = true;
				dollyCameraOut = true;
			}
			if (pinchDeltaX > 1)
			{
				decreaseFOV = true;
				dollyCameraIn = true;
			}
		}

		if (Math.abs(pinchDeltaY) >= Math.abs(pinchDeltaX))
		{
			if (pinchDeltaY > 1)
			{
				increaseAperture = true;
			}
			if (pinchDeltaY < -1)
			{
				decreaseAperture = true;
			}
		}

		// save state for next frame
		oldPinchWidthX = newPinchWidthX;
		oldPinchWidthY = newPinchWidthY;

	} // end if ( !mouseControl )

	// if on gamepad (gp), get input from that gamepad device
	if ( gp )
	{
		if (useGenericInput)
		{
			inputRotationHorizontal = cameraControlsYawObject.rotation.y;
			inputRotationVertical = cameraControlsPitchObject.rotation.x;
		}

		if (Math.abs(gp.axes[2]) > 0.1) // account for deadzone
			newDeltaX += gp.axes[2] * gamepad_cameraYRotationSpeed;
		else newDeltaX = 0;
		if (newDeltaX)
		{
			cameraIsMoving = true;
			// the ' || 0 ' prevents NaNs from creeping into inputRotationHorizontal calc below
			inputMovementHorizontal = ((oldDeltaX - newDeltaX) * 0.01) || 0;
			// gamepad stick X movement (left and right) affects camera rotation around the Y axis
			inputRotationHorizontal += inputMovementHorizontal;
		}

		if (Math.abs(gp.axes[3]) > 0.1) // account for deadzone
			newDeltaY += gp.axes[3] * gamepad_cameraXRotationSpeed;
		else newDeltaY = 0;
		if (newDeltaY)
		{
			cameraIsMoving = true;
			// the ' || 0 ' prevents NaNs from creeping into inputRotationVertical calc below
			inputMovementVertical = ((oldDeltaY - newDeltaY) * 0.01) || 0;
			// gamepad stick Y movement (up and down) affects camera rotation around the X axis
			inputRotationVertical += inputMovementVertical;
		}

		// clamp the camera's vertical rotation (around the x-axis) to the scene's 'ceiling' and 'floor',
		// so you can't accidentally flip the camera upside down
		if (useGenericInput)
		{
			if (inputRotationVertical < -PI_2)
			{
				inputRotationVertical = -PI_2;
				inputMovementVertical = 0;
			}
			if (inputRotationVertical > PI_2)
			{
				inputRotationVertical = PI_2;
				inputMovementVertical = 0;
			}
		}

		// save state for next frame
		oldDeltaX = newDeltaX;
		oldDeltaY = newDeltaY;

	} // end if ( gp )


	//cameraControlsYawObject.rotation.y = inputRotationHorizontal;
	//cameraControlsPitchObject.rotation.x = inputRotationVertical;
	cameraControlsYawObject.rotateY(inputMovementHorizontal);
	cameraControlsPitchObject.rotateX(inputMovementVertical);

	// this gives us a vector in the direction that the camera is pointing,
	// which will be useful for moving the camera 'forward' and shooting projectiles in that direction
	controls.getDirection(cameraDirectionVector);
	cameraDirectionVector.normalize();
	controls.getUpVector(cameraUpVector);
	cameraUpVector.normalize();
	controls.getRightVector(cameraRightVector);
	cameraRightVector.normalize();


	if (useGenericInput)
	{
		if (!isPaused)
		{
			if ((keyPressed('KeyW') || button3Pressed) && !(keyPressed('KeyS') || button4Pressed))
			{
				cameraControlsObject.position.add(cameraDirectionVector.multiplyScalar(cameraFlightSpeed * frameTime));
				cameraIsMoving = true;
			}
			if ((keyPressed('KeyS') || button4Pressed) && !(keyPressed('KeyW') || button3Pressed))
			{
				cameraControlsObject.position.sub(cameraDirectionVector.multiplyScalar(cameraFlightSpeed * frameTime));
				cameraIsMoving = true;
			}
			if ((keyPressed('KeyA') || button1Pressed) && !(keyPressed('KeyD') || button2Pressed))
			{
				cameraControlsObject.position.sub(cameraRightVector.multiplyScalar(cameraFlightSpeed * frameTime));
				cameraIsMoving = true;
			}
			if ((keyPressed('KeyD') || button2Pressed) && !(keyPressed('KeyA') || button1Pressed))
			{
				cameraControlsObject.position.add(cameraRightVector.multiplyScalar(cameraFlightSpeed * frameTime));
				cameraIsMoving = true;
			}
			if (keyPressed('KeyE'))
			{
				cameraControlsObject.position.add(cameraUpVector.multiplyScalar(cameraFlightSpeed * frameTime));
				cameraIsMoving = true;
			}
			if (keyPressed('KeyC'))
			{
				cameraControlsObject.position.sub(cameraUpVector.multiplyScalar(cameraFlightSpeed * frameTime));
				cameraIsMoving = true;
			}
			if ((keyPressed('ArrowUp') || button5Pressed) && !(keyPressed('ArrowDown') || button6Pressed))
			{
				increaseFocusDist = true;
			}
			if ((keyPressed('ArrowDown') || button6Pressed) && !(keyPressed('ArrowUp') || button5Pressed))
			{
				decreaseFocusDist = true;
			}
			if (keyPressed('ArrowRight') && !keyPressed('ArrowLeft'))
			{
				increaseAperture = true;
			}
			if (keyPressed('ArrowLeft') && !keyPressed('ArrowRight'))
			{
				decreaseAperture = true;
			}
			if (keyPressed('KeyO') && canPress_O)
			{
				changeToOrthographicCamera = true;
				canPress_O = false;
			}
			if (!keyPressed('KeyO'))
				canPress_O = true;

			if (keyPressed('KeyP') && canPress_P)
			{
				changeToPerspectiveCamera = true;
				canPress_P = false;
			}
			if (!keyPressed('KeyP'))
				canPress_P = true;
		} // end if (!isPaused)

	} // end if (useGenericInput)



	// update scene/demo-specific input(if custom), variables and uniforms every animation frame
	updateVariablesAndUniforms();

	//reset controls movement
	inputMovementHorizontal = inputMovementVertical = 0;


	if (increaseFOV)
	{
		worldCamera.fov++;
		if (worldCamera.fov > 179)
			worldCamera.fov = 179;
		fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
		pathTracingUniforms.uVLen.value = Math.tan(fovScale);
		pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

		cameraIsMoving = true;
		increaseFOV = false;
	}
	if (decreaseFOV)
	{
		worldCamera.fov--;
		if (worldCamera.fov < 1)
			worldCamera.fov = 1;
		fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
		pathTracingUniforms.uVLen.value = Math.tan(fovScale);
		pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

		cameraIsMoving = true;
		decreaseFOV = false;
	}

	if (increaseFocusDist)
	{
		focusDistance += (1 * focusDistanceChangeSpeed);
		pathTracingUniforms.uFocusDistance.value = focusDistance;
		cameraIsMoving = true;
		increaseFocusDist = false;
	}
	if (decreaseFocusDist)
	{
		focusDistance -= (1 * focusDistanceChangeSpeed);
		if (focusDistance < 1)
			focusDistance = 1;
		pathTracingUniforms.uFocusDistance.value = focusDistance;
		cameraIsMoving = true;
		decreaseFocusDist = false;
	}

	if (increaseAperture)
	{
		apertureSize += (0.1 * apertureChangeSpeed);
		if (apertureSize > 10000.0)
			apertureSize = 10000.0;

		cameraIsMoving = true;
		increaseAperture = false;
	}
	if (decreaseAperture)
	{
		apertureSize -= (0.1 * apertureChangeSpeed);
		if (apertureSize < 0.0)
			apertureSize = 0.0;

		cameraIsMoving = true;
		decreaseAperture = false;
	}
	if (allowOrthographicCamera && changeToOrthographicCamera)
	{
		storedFOV = worldCamera.fov; // save current perspective camera's FOV

		worldCamera.fov = 90; // good default for Ortho camera - lets user see most of the scene
		fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
		pathTracingUniforms.uVLen.value = Math.tan(fovScale);
		pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

		pathTracingUniforms.uUseOrthographicCamera.value = true;
		cameraIsMoving = true;
		changeToOrthographicCamera = false;
	}
	if (allowOrthographicCamera && changeToPerspectiveCamera)
	{
		worldCamera.fov = storedFOV; // return to prior perspective camera's FOV
		fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
		pathTracingUniforms.uVLen.value = Math.tan(fovScale);
		pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

		pathTracingUniforms.uUseOrthographicCamera.value = false;
		cameraIsMoving = true;
		changeToPerspectiveCamera = false;
	}

	// now update uniforms that are common to all scenes
	var wasCameraRecentlyMoving = cameraRecentlyMoving;
	var samplingStepOnceActive = samplingStepOnceRequested && samplingPaused && !cameraIsMoving;
	var samplingPausedForFrame = samplingPaused && !samplingStepOnceActive && !cameraIsMoving;
	var renderLimitWasAlreadyReached = typeof MAX_SAMPLES !== 'undefined' && sampleCounter >= MAX_SAMPLES && !cameraIsMoving;
	if (!cameraIsMoving)
	{
		if (!samplingPausedForFrame && !renderLimitWasAlreadyReached)
		{
			if (sceneIsDynamic)
				sampleCounter = 1.0; // reset for continuous updating of image
			else if (typeof MAX_SAMPLES === 'undefined' || sampleCounter < MAX_SAMPLES)
				sampleCounter += 1.0; // for progressive refinement of image

			frameCounter += 1.0;
		}

		cameraRecentlyMoving = false;
	}

	if (cameraIsMoving)
	{
		if (samplingStepHistory.length > 0)
			resetSamplingStepHistory();
		frameCounter += 1.0;

		if (!cameraRecentlyMoving)
		{
			// record current sampleCounter before it gets set to 1.0 below
			pathTracingUniforms.uPreviousSampleCount.value = sampleCounter;
			frameCounter = 1.0;
			cameraRecentlyMoving = true;
		}

		sampleCounter = 1.0;
	}

	pathTracingUniforms.uTime.value = elapsedTime;
	pathTracingUniforms.uCameraIsMoving.value = cameraIsMoving;
	updateMovementPreviewUniforms(cameraIsMoving);
	pathTracingUniforms.uSampleCounter.value = sampleCounter;
	pathTracingUniforms.uFrameCounter.value = frameCounter;
	pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
	updateR738C1BakePastePreviewUniforms();

	// CAMERA

	cameraControlsObject.updateMatrixWorld(true);
	worldCamera.updateMatrixWorld(true);
	pathTracingUniforms.uCameraMatrix.value.copy(worldCamera.matrixWorld);
	pathTracingUniforms.uApertureSize.value = apertureSize;

	screenOutputUniforms.uCameraIsMoving.value = cameraIsMoving;
	screenOutputUniforms.uSampleCounter.value = sampleCounter;
	// PROGRESSIVE SAMPLE WEIGHT (reduces intensity of each successive animation frame's image)
	screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / sampleCounter;


	// R2-UI：切換 Cam 或其他觸發源要求「立刻清除殘影」，清空兩個 ping-pong buffer 再往下走
	var accumulationWasClearedForThisFrame = false;
	if (needClearAccumulation)
	{
		resetSamplingStepHistory();
		renderer.setRenderTarget(pathTracingRenderTarget);
		renderer.clear();
		renderer.setRenderTarget(screenCopyRenderTarget);
		renderer.clear();
		// R6 LGG-r16 J3：borrow ping-pong 同步清空，避免新 frame 的 14 彈累積讀到舊相機角度的殘影
		if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget)
		{
			renderer.setRenderTarget(borrowPathTracingRenderTarget);
			renderer.clear();
			renderer.setRenderTarget(borrowScreenCopyRenderTarget);
			renderer.clear();
		}
		movementProtectionStableReady = false;
		movementProtectionLastCaptureSamples = 0;
		sampleCounter = 1.0;
		frameCounter = 1.0;
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		screenOutputUniforms.uSampleCounter.value = sampleCounter;
		screenOutputUniforms.uOneOverSampleCounter.value = 1.0;
		needClearAccumulation = false;
		accumulationWasClearedForThisFrame = true;
	}

	// RENDERING in 3 steps
	// 到達 MAX_SAMPLES 後跳過 STEP 1/2，凍結累加 buffer，只保留 STEP 3 顯示
	var renderingStopped = samplingPausedForFrame || renderLimitWasAlreadyReached;
	var firstFrameRecoveryWasCleared = accumulationWasClearedForThisFrame;
	var firstFrameRecoveryPassTarget = sampleCounter;
	var firstFrameRecoveryReason = 'normal';
	var firstFrameRecoveryActiveRenderCameraMoving = cameraIsMoving;

	if (!renderingStopped)
	{
		if (firstFrameRecoveryEnabled && !samplingStepOnceActive)
		{
			var firstFrameRecoveryActiveTargetSamples = firstFrameRecoveryConfigTargetSamples(cameraIsMoving);
			if (accumulationWasClearedForThisFrame)
			{
				firstFrameRecoveryReason = 'cleared';
			}
			else if (cameraIsMoving && firstFrameRecoveryClearWhileMoving && sampleCounter <= 1.0)
			{
				firstFrameRecoveryReason = 'moving';
				firstFrameRecoveryWasCleared = true;
			}
			else if (wasCameraRecentlyMoving && sampleCounter < firstFrameRecoveryActiveTargetSamples)
			{
				firstFrameRecoveryReason = 'recentlyMoving';
			}
			if (firstFrameRecoveryReason !== 'normal' || sampleCounter < firstFrameRecoveryActiveTargetSamples)
			{
				firstFrameRecoveryPassTarget = Math.max(firstFrameRecoveryPassTarget, firstFrameRecoveryActiveTargetSamples);
				firstFrameRecoveryActiveRenderCameraMoving = false;
			}
		}

		if (firstFrameRecoveryWasCleared)
		{
			renderer.setRenderTarget(pathTracingRenderTarget);
			renderer.clear();
			renderer.setRenderTarget(screenCopyRenderTarget);
			renderer.clear();
			if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget)
			{
				renderer.setRenderTarget(borrowPathTracingRenderTarget);
				renderer.clear();
				renderer.setRenderTarget(borrowScreenCopyRenderTarget);
				renderer.clear();
			}
			if (!movementProtectionPreserveStableAcrossCameraReset)
			{
				movementProtectionStableReady = false;
				movementProtectionLastCaptureSamples = 0;
			}
			frameCounter = 2.0;
			pathTracingUniforms.uPreviousSampleCount.value = 1.0;
		}

		var firstFrameRecoveryPassStart = sampleCounter;
		firstFrameRecoveryLastPassCount = Math.max(1, Math.round(firstFrameRecoveryPassTarget - firstFrameRecoveryPassStart + 1.0));
		firstFrameRecoveryLastReason = firstFrameRecoveryReason;

		for (var firstFrameRecoveryPassSample = sampleCounter; firstFrameRecoveryPassSample <= firstFrameRecoveryPassTarget; firstFrameRecoveryPassSample += 1.0)
		{
			sampleCounter = firstFrameRecoveryPassSample;
			pathTracingUniforms.uCameraIsMoving.value = firstFrameRecoveryActiveRenderCameraMoving;
			updateMovementPreviewUniforms(cameraIsMoving);
			pathTracingUniforms.uSampleCounter.value = sampleCounter;
			pathTracingUniforms.uFrameCounter.value = frameCounter;
			pathTracingUniforms.uRandomVec2.value.set(Math.random(), Math.random());
			screenOutputUniforms.uCameraIsMoving.value = firstFrameRecoveryActiveRenderCameraMoving;
			screenOutputUniforms.uSampleCounter.value = sampleCounter;
			screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / sampleCounter;
			updateR73QuickPreviewFillUniforms();
			updateR738C1BakePastePreviewUniforms();

			// STEP 1A: R6 LGG-r16 J3 借光 pass（1/8 res、14 彈），只在 uBorrowStrength > 0 時跑
			// 暫時切 uniforms（uMaxBounces=14、uIsBorrowPass=1、tPreviousTexture 換 borrow ping-pong、uResolution 切 1/8）
			// 主 pass 跑完之後恢復原 uniforms 狀態
			var borrowActive = pathTracingUniforms.uBorrowStrength
				&& pathTracingUniforms.uBorrowStrength.value > 0.0
				&& borrowPathTracingRenderTarget
				&& borrowScreenCopyRenderTarget
				&& !firstFrameRecoveryLowCostMovementActive(cameraIsMoving);
			if (borrowActive)
			{
				var savedBounces = pathTracingUniforms.uMaxBounces.value;
				var savedTPrev = pathTracingUniforms.tPreviousTexture.value;
				var savedTBorrow = pathTracingUniforms.tBorrowTexture.value;
				var savedResX = pathTracingUniforms.uResolution.value.x;
				var savedResY = pathTracingUniforms.uResolution.value.y;
				var lowW = Math.max(1, Math.floor(savedResX / 8));
				var lowH = Math.max(1, Math.floor(savedResY / 8));

				// R6 LGG-r20：借光反彈回到 14 彈（深暗角需要 5+ 彈光線才到得了）
				// 配合 pathtracing_main chunk 的 source-side clamp 1.0，14 彈 firefly 不會永久汙染累積
				pathTracingUniforms.uMaxBounces.value = 14.0;
				pathTracingUniforms.uIsBorrowPass.value = 1.0;
				pathTracingUniforms.tPreviousTexture.value = borrowScreenCopyRenderTarget.texture;
				// 防 WebGL feedback loop：借光 pass 寫入 borrowPathTracingRenderTarget，
				// 暫時把 tBorrowTexture 指到 ping-pong 兄弟 borrowScreenCopyRenderTarget，避免「同張紋理同時是 input + output」未定義行為
				pathTracingUniforms.tBorrowTexture.value = borrowScreenCopyRenderTarget.texture;
				pathTracingUniforms.uResolution.value.set(lowW, lowH);

				renderer.setRenderTarget(borrowPathTracingRenderTarget);
				renderer.render(pathTracingScene, worldCamera);

				// borrow ping-pong：把剛寫的 borrowPathTracingRenderTarget 複製到 borrowScreenCopyRenderTarget
				// 用既有 screenCopyScene/Material（fragment 是 ScreenCopy_Fragment.glsl），暫時換 source 紋理引用
				var savedScSrc = screenCopyUniforms.tPathTracedImageTexture.value;
				screenCopyUniforms.tPathTracedImageTexture.value = borrowPathTracingRenderTarget.texture;
				renderer.setRenderTarget(borrowScreenCopyRenderTarget);
				renderer.render(screenCopyScene, orthoCamera);
				screenCopyUniforms.tPathTracedImageTexture.value = savedScSrc;

				// 恢復主 pass uniforms
				pathTracingUniforms.uMaxBounces.value = savedBounces;
				pathTracingUniforms.uIsBorrowPass.value = 0.0;
				pathTracingUniforms.tPreviousTexture.value = savedTPrev;
				pathTracingUniforms.tBorrowTexture.value = savedTBorrow;
				pathTracingUniforms.uResolution.value.set(savedResX, savedResY);
			}

			// STEP 1
			// Perform PathTracing and Render(save) into pathTracingRenderTarget, a full-screen texture (on the oversized triangle).
			// Read previous screenCopyRenderTarget(via texelFetch inside fragment shader) to use as a new starting point to blend with
			renderer.setRenderTarget(pathTracingRenderTarget);
			renderer.render(pathTracingScene, worldCamera);

			// STEP 2
			// Render(copy) the pathTracingScene output(pathTracingRenderTarget above) into screenCopyRenderTarget.
			// This will be used as a new starting point for Step 1 above (essentially creating ping-pong buffers)
			renderer.setRenderTarget(screenCopyRenderTarget);
			renderer.render(screenCopyScene, orthoCamera);
			if (typeof window.captureDueSnapshotsForCurrentSample === 'function')
				window.captureDueSnapshotsForCurrentSample();

			frameCounter += 1.0;
		}
		firstFrameRecoveryLastFinalSamples = Math.round(sampleCounter);
		pathTracingUniforms.uSampleCounter.value = sampleCounter;
		pathTracingUniforms.uFrameCounter.value = frameCounter;
		pathTracingUniforms.uCameraIsMoving.value = cameraIsMoving;
		screenOutputUniforms.uCameraIsMoving.value = firstFrameRecoveryActiveRenderCameraMoving;
		screenOutputUniforms.uSampleCounter.value = sampleCounter;
		screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / sampleCounter;
	}
	if (samplingStepOnceActive)
	{
		if (!renderingStopped)
			captureSamplingStepHistoryState();
		samplingStepOnceRequested = false;
		samplingPaused = true;
		if (typeof window.updateSamplingControls === 'function')
			window.updateSamplingControls();
	}

	// STEP 2.5 (R2-UI Bloom multi-scale pyramid)
	// 只在 1) 非休眠、2) bloom 強度 > 0（或 debug on）、3) 所有 bloom material 載入完成 時執行
	// 執行節奏：前 50 frame 連續跑（早期視覺即時）；之後每 10 frame 跑一次（bloom 是低頻信號）
	// 休眠時完全跳過，bloom mip chain 靜態保留給 STEP 3 使用 → GPU 大幅降載
	//
	// Pipeline (Jimenez / Unreal / Blender Eevee pyramid)：
	//   1. brightpass: pathTracing(full) → mip[0](1/2) — 13-tap Karis average 殺 firefly
	//   2 ~ N. downsample: mip[i] → mip[i+1] — 13-tap partial average
	//   N+1 ~ 2N-1. upsample additive: mip[i] → mip[i-1] — 9-tap tent radius=1 + additive blend
	// mipCount 由 window.bloomMipCount 控制 (3 ~ 7)，halo 廣度由層數決定
	let mipCount = window.bloomMipCount;
	if (typeof mipCount !== 'number' || mipCount < 2) mipCount = 7;
	if (mipCount > 7) mipCount = 7;
	if (mipCount < 2) mipCount = 2;
	if (!renderingStopped
		&& (screenOutputUniforms.uBloomIntensity.value > 0.0 || screenOutputUniforms.uBloomDebug.value > 0.5)
		&& bloomBrightpassMaterial && bloomDownsampleMaterial && bloomUpsampleMaterial
		&& (sampleCounter < 50.0 || (sampleCounter % 10.0) < 1.0))
	{
		// 同步 brightpass 所需 sampleCounter 倒數
		bloomBrightpassUniforms.uOneOverSampleCounter.value = screenOutputUniforms.uOneOverSampleCounter.value;

		const prevAutoClear = renderer.autoClear;
		renderer.autoClear = true;

		// Pass 1：brightpass + 2x Karis downsample → mip[0] (1/2 res)
		renderer.setRenderTarget(bloomMip[0]);
		renderer.render(bloomBrightpassScene, orthoCamera);

		// Downsample chain：mip[0] → mip[1] → ... → mip[mipCount-1]
		for (let i = 0; i < mipCount - 1; i++)
		{
			bloomDownsampleUniforms.tBloomTexture.value = bloomMip[i].texture;
			renderer.setRenderTarget(bloomMip[i + 1]);
			renderer.render(bloomDownsampleScene, orthoCamera);
		}

		// Upsample chain：mip[mipCount-1] → ... → mip[0]
		// autoClear=false → dest mip 既有 downsample 結果被保留，GPU 把 upsample 輸出加上去
		renderer.autoClear = false;
		for (let i = mipCount - 1; i > 0; i--)
		{
			bloomUpsampleUniforms.tBloomTexture.value = bloomMip[i].texture;
			renderer.setRenderTarget(bloomMip[i - 1]);
			renderer.render(bloomUpsampleScene, orthoCamera);
		}

		renderer.autoClear = prevAutoClear;
	}

	// STEP 3
	// Render to the oversized full-screen triangle with generated pathTracingRenderTarget in STEP 1 above.
	// After applying tonemapping and gamma-correction to the image, it will be shown on the screen as the final accumulated output
	// R6 hibernation：renderingStopped 時連 STEP 3 也跳過 → 對齊舊版單檔 HTML 的「全部 GL 早返回」做法 → GPU 真歸零
	// R6 Route X：postProcessChanged 例外 → 休眠中也能跑一次 STEP 3 讓後製滑桿即時生效（不重啟累積）
	if (!renderingStopped || postProcessChanged)
	{
		updateMovementProtectionUniforms(cameraIsMoving);
		updateR73QuickPreviewFillUniforms();
		updateR738C1BakePastePreviewUniforms();
		renderer.setRenderTarget(null);
		renderer.render(screenOutputScene, orthoCamera);
		if (!cameraIsMoving)
			captureMovementProtectionStableFrame();
		postProcessChanged = false;
	}

	stats.update();

	if (renderingStopped && !postProcessChanged && !cameraIsMoving && !sceneParamsChanged && !samplingStepOnceRequested)
	{
		homeStudioAnimationSleeping = true;
		return;
	}
	scheduleHomeStudioAnimationFrame();

} // end function animate()
