// R2-1 房間邊界常數
// 座標系統：X=東西向(負=西，正=東), Y=高度向(負=下，正=上), Z=南北向(負=北，正=南)
// (0,0,0) = 聆聽點底下的地板
const MIN_X = -2.11;
const MAX_X = 2.11;
const MIN_Y = -0.20;
const MAX_Y = 3.105;
const MIN_Z = -2.074;
const MAX_Z = 3.256;

// R2-2 顏色常量
const C_WALL         = [1.0, 0.984, 0.949];
const C_WALL_L       = [1.0, 0.984, 0.949];
const C_WALL_R       = [1.0, 0.984, 0.949];
const C_WALL_S       = [1.0, 0.984, 0.949];
const C_BEAM         = [1.0, 0.984, 0.949];
const C_FLOOR        = [0.55, 0.47, 0.41];
const C_WOOD         = [0.55, 0.35, 0.17];
const C_DARK_WOOD    = [0.36, 0.26, 0.18];
const C_METAL        = [0.50, 0.55, 0.55];
const C_WHITE        = [0.85, 0.85, 0.85];
const C_SPEAKER      = [0.12, 0.12, 0.12];
const C_STAND        = [0.08, 0.08, 0.08];
const C_STAND_PILLAR = [0.80, 0.82, 0.85];
const C_SPIKE        = [0.75, 0.60, 0.15];
const C_GIK          = [0.50, 0.50, 0.50];
const C_DARK_VENT    = [0.13, 0.13, 0.13];

// === Scene Box Data (single source of truth) ===
const sceneBoxes = [];
const z3 = [0, 0, 0]; // zero emission shorthand
function addBox(min, max, emission, color, type) {
    sceneBoxes.push({ min, max, emission, color, type });
}

// R2-3 牆面 (index 0-15)
addBox([MIN_X, MIN_Y, MIN_Z], [MAX_X, 0.0, MAX_Z], z3, C_FLOOR, 1);           // 0  地面
addBox([MIN_X, 2.905, MIN_Z], [MAX_X, MAX_Y, MAX_Z], z3, C_WALL, 1);          // 1  天花板
addBox([MIN_X, 0.0, MIN_Z], [-1.52, 2.905, -1.874], z3, C_WALL, 1);           // 2  北牆西段
addBox([-0.73, 0.0, MIN_Z], [MAX_X, 2.905, -1.874], z3, C_WALL, 1);           // 3  北牆東段
addBox([-1.52, 2.03, MIN_Z], [-0.73, 2.905, -1.874], z3, C_WALL, 1);          // 4  北牆門洞上方
addBox([1.91, 0.0, MIN_Z], [MAX_X, 2.905, MAX_Z], z3, C_WALL_R, 1);           // 5  東牆
addBox([MIN_X, 0.0, 3.056], [-1.75, 2.905, MAX_Z], z3, C_WALL_S, 1);          // 6  南牆西段
addBox([0.69, 0.0, 3.056], [MAX_X, 2.905, MAX_Z], z3, C_WALL_S, 1);           // 7  南牆東段
addBox([-1.75, 0.0, 3.056], [0.69, 1.04, MAX_Z], z3, C_WALL_S, 1);            // 8  南牆窗台下方
addBox([MIN_X, 2.04, -1.874], [-1.91, 2.905, -0.984], z3, C_WALL_L, 1);       // 9  西牆鐵門上方
addBox([MIN_X, 0.0, -1.874], [-1.91, 0.09, -0.984], z3, C_WALL_L, 1);         // 10 西牆門坎
addBox([MIN_X, 0.0, -0.984], [-1.91, 2.905, MAX_Z], z3, C_WALL_L, 1);         // 11 西牆南段
addBox([-1.91, 2.525, MIN_Z], [-1.75, 2.905, MAX_Z], z3, C_BEAM, 1);          // 12 西牆橫樑
addBox([1.85, 2.515, MIN_Z], [MAX_X, 2.905, 2.49], z3, C_BEAM, 1);            // 13 東牆橫樑
addBox([-1.91, 0.0, 2.848], [-1.75, 2.905, MAX_Z], z3, C_BEAM, 1);            // 14 西南角柱
addBox([1.78, 0.0, 2.49], [MAX_X, 2.905, MAX_Z], z3, C_BEAM, 1);              // 15 東南角柱

// R2-4 傢俱 (index 16-20)
addBox([1.35, 0.0, -1.874], [1.91, 1.955, -0.703], z3, C_WOOD, 1);            // 16 東牆櫃子
addBox([-1.91, 0.63, 2.385], [1.02, 0.77, 3.056], z3, C_WOOD, 1);             // 17 南方系統木桌
addBox([-1.90, 0.01, 2.395], [-1.045, 0.62, 3.047], z3, C_WOOD, 1);           // 18 西南角抽屜
addBox([1.02, 0.0, 2.73], [1.78, 2.04, 3.056], z3, C_WOOD, 1);                // 19 東南角書櫃
addBox([-0.60, 0.0, 0.157], [0.60, 0.757, 0.697], z3, C_DARK_WOOD, 1);        // 20 工作桌

// R2-4 西南角抽屜層板 (index 21-24)
addBox([-1.91, 0.0025, 2.385], [-1.035, 0.155, 3.056], z3, C_WOOD, 1);        // 21 底層
addBox([-1.91, 0.160, 2.385], [-1.035, 0.3125, 3.056], z3, C_WOOD, 1);        // 22 第2格
addBox([-1.91, 0.3175, 2.385], [-1.035, 0.470, 3.056], z3, C_WOOD, 1);        // 23 第3格
addBox([-1.91, 0.475, 2.385], [-1.035, 0.6275, 3.056], z3, C_WOOD, 1);        // 24 頂格

let samplesPerFrame = 8.0;
let samplesPerFrameController;

const CAMERA_PRESETS = {
    cam1: { position: { x: 0.0, y: 1.5, z: 2.5 }, pitch: -0.15, yaw: 0.0 },
    cam2: { position: { x: -0.9, y: 1.1, z: 3.7 }, pitch: 0.3, yaw: -0.25 },
    cam3: { position: { x: 0.0, y: 1.3, z: -1.0 }, pitch: 0.0, yaw: -Math.PI }
};
let currentCameraPreset = 'cam1';

let basicBrightness = 800.0;
let colorTemperature = 4000;
let wallAlbedo = 0.8;

let acousticPanelVisibility = {
    north: true,
    south: true,
    east: true,
    west: true,
    ceiling: true
};

let bloomIntensity = 0.15;
let bloomRadius = 2.0;

const SNAPSHOT_MILESTONES = [500, 1500, 3000, 6000];
const snapshots = [];
let lastSnapshotCheck = -1;
const capturedMilestones = new Set();

function getDateStr() {
    const d = new Date();
    return d.getFullYear().toString().slice(2) +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0');
}

function getWallLabel() {
    return 'default';
}

function makeFilename(spp) {
    return `${getDateStr()}-${currentCameraPreset}-${getWallLabel()}-${spp}spp.png`;
}

function captureSnapshot() {
    renderer.setRenderTarget(null);
    renderer.render(screenOutputScene, orthoCamera);
    return renderer.domElement.toDataURL('image/png');
}

function buildSnapshotBar() {
    const bar = document.getElementById('snapshot-bar');
    if (!bar) return;
    
    bar.innerHTML = '';
    snapshots.forEach((snap) => {
        const wrap = document.createElement('div');
        wrap.className = 'snapshot-wrap';
        wrap.style.cssText = 'position:relative; display:inline-block;';
        
        const img = document.createElement('img');
        img.src = snap.src;
        img.className = 'snapshot-thumb';
        img.width = 120;
        img.height = Math.round(120 * (window.innerHeight / window.innerWidth));
        
        const label = document.createElement('span');
        label.className = 'snapshot-label';
        label.textContent = snap.samples.toLocaleString() + ' spp';
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'snapshot-save';
        saveBtn.textContent = '💾';
        saveBtn.title = snap.filename;
        saveBtn.onclick = (e) => {
            e.stopPropagation();
            const a = document.createElement('a');
            a.href = snap.src;
            a.download = snap.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
        
        wrap.appendChild(img);
        wrap.appendChild(label);
        wrap.appendChild(saveBtn);
        bar.appendChild(wrap);
    });
}

function downloadAllSnapshots() {
    snapshots.forEach((snap, i) => {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = snap.src;
            a.download = snap.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, i * 300);
    });
}

function kelvinToRGB(kelvin) {
    const temp = kelvin / 100;
    let r, g, b;
    
    if (temp <= 66) {
        r = 255;
    } else {
        r = temp - 60;
        r = 329.698727446 * Math.pow(r, -0.1332047592);
        r = Math.max(0, Math.min(255, r));
    }
    
    if (temp <= 66) {
        g = temp;
        g = 99.4708025861 * Math.log(g) - 161.1195681661;
        g = Math.max(0, Math.min(255, g));
    } else {
        g = temp - 60;
        g = 288.1221695283 * Math.pow(g, -0.0755148492);
        g = Math.max(0, Math.min(255, g));
    }
    
    if (temp >= 66) {
        b = 255;
    } else if (temp <= 19) {
        b = 0;
    } else {
        b = temp - 10;
        b = 138.5177312231 * Math.log(b) - 305.0447927307;
        b = Math.max(0, Math.min(255, b));
    }
    
    return { r: r / 255, g: g / 255, b: b / 255 };
}

let lockedPreset = null;
let cameraSwitchFrames = 0;

function switchCamera(preset) {
    const cam = CAMERA_PRESETS[preset];
    if (!cam) return;

    currentCameraPreset = preset;
    lockedPreset = cam;
    cameraSwitchFrames = 3;

    // Set camera directly (rotation.set clears all 3 Euler components
    // to prevent quaternion↔Euler decomposition ambiguity at ±π)
    cameraControlsObject.position.set(cam.position.x, cam.position.y, cam.position.z);
    cameraControlsPitchObject.rotation.set(cam.pitch, 0, 0);
    cameraControlsYawObject.rotation.set(0, cam.yaw, 0);

    // Sync framework tracking variables
    inputRotationHorizontal = cam.yaw;
    inputRotationVertical = cam.pitch;
    oldYawRotation = cam.yaw;
    oldPitchRotation = cam.pitch;
    inputMovementHorizontal = 0;
    inputMovementVertical = 0;

    isPaused = true;
    cameraIsMoving = true;
}

function initSceneData() {
    demoFragmentShaderFileName = 'Home_Studio_Fragment.glsl?v=' + Date.now();
    
    sceneIsDynamic = false;
    cameraFlightSpeed = 10;
    pixelRatio = mouseControl ? 1.0 : 1.0;
    EPS_intersect = 0.001;
    
    worldCamera.fov = 55;
    focusDistance = 4.0;
    apertureChangeSpeed = 200;
    
    cameraControlsObject.position.set(0.0, 1.5, 2.5);
    cameraControlsPitchObject.rotation.x = -0.15;
    
    var keys = {};
    window.addEventListener('keydown', function(e) { keys[e.code] = true; });
    window.addEventListener('keyup', function(e) { keys[e.code] = false; });
    
    document.addEventListener('mousedown', function(e) {
        if(e.button === 0 && e.target.tagName !== 'IFRAME') {
            if(document.pointerLockElement) {
                document.exitPointerLock();
                e.preventDefault();
            }
        }
    });
    
    // === BVH Build ===
    var N = sceneBoxes.length;

    // 1) Prepare aabb_array for BVH builder (9 floats per box: min, max, centroid)
    var aabb_array = new Float32Array(Math.max(9 * N, 8 * (2 * N)));
    var totalWork = new Uint32Array(N);
    for (var i = 0; i < N; i++) {
        var b = sceneBoxes[i];
        aabb_array[9*i+0] = b.min[0]; aabb_array[9*i+1] = b.min[1]; aabb_array[9*i+2] = b.min[2];
        aabb_array[9*i+3] = b.max[0]; aabb_array[9*i+4] = b.max[1]; aabb_array[9*i+5] = b.max[2];
        aabb_array[9*i+6] = (b.min[0] + b.max[0]) * 0.5;
        aabb_array[9*i+7] = (b.min[1] + b.max[1]) * 0.5;
        aabb_array[9*i+8] = (b.min[2] + b.max[2]) * 0.5;
        totalWork[i] = i;
    }

    // 2) Build BVH (overwrites aabb_array with 8 floats/node)
    BVH_Build_Iterative(totalWork, aabb_array);
    var nodeCount = buildnodes.length;
    console.log("BVH nodes:", nodeCount, "for", N, "boxes");

    // 3) BVH Texture (512x1, RGBA32F, 2 pixels per node)
    var BVH_TEX_W = 512;
    var bvhArr = new Float32Array(BVH_TEX_W * 1 * 4);
    for (var n = 0; n < nodeCount; n++) {
        // pixel 2n: [idPrimitive, min.x, min.y, min.z]
        bvhArr[(2*n)*4+0] = aabb_array[8*n+0];
        bvhArr[(2*n)*4+1] = aabb_array[8*n+1];
        bvhArr[(2*n)*4+2] = aabb_array[8*n+2];
        bvhArr[(2*n)*4+3] = aabb_array[8*n+3];
        // pixel 2n+1: [idRightChild, max.x, max.y, max.z]
        bvhArr[(2*n+1)*4+0] = aabb_array[8*n+4];
        bvhArr[(2*n+1)*4+1] = aabb_array[8*n+5];
        bvhArr[(2*n+1)*4+2] = aabb_array[8*n+6];
        bvhArr[(2*n+1)*4+3] = aabb_array[8*n+7];
    }
    var bvhDataTexture = new THREE.DataTexture(bvhArr, BVH_TEX_W, 1, THREE.RGBAFormat, THREE.FloatType);
    bvhDataTexture.wrapS = THREE.ClampToEdgeWrapping;
    bvhDataTexture.wrapT = THREE.ClampToEdgeWrapping;
    bvhDataTexture.minFilter = THREE.NearestFilter;
    bvhDataTexture.magFilter = THREE.NearestFilter;
    bvhDataTexture.flipY = false;
    bvhDataTexture.generateMipmaps = false;
    bvhDataTexture.needsUpdate = true;

    // 4) Box Data Texture (512x1, RGBA32F, 4 pixels per box)
    var boxArr = new Float32Array(BVH_TEX_W * 1 * 4);
    for (var i = 0; i < N; i++) {
        var b = sceneBoxes[i];
        var p = i * 4;
        // pixel 0: [emission.rgb, type]
        boxArr[(p)*4+0] = b.emission[0]; boxArr[(p)*4+1] = b.emission[1];
        boxArr[(p)*4+2] = b.emission[2]; boxArr[(p)*4+3] = b.type;
        // pixel 1: [color.rgb, rotY(reserved)]
        boxArr[(p+1)*4+0] = b.color[0]; boxArr[(p+1)*4+1] = b.color[1];
        boxArr[(p+1)*4+2] = b.color[2]; boxArr[(p+1)*4+3] = 0.0;
        // pixel 2: [min.xyz, reserved]
        boxArr[(p+2)*4+0] = b.min[0]; boxArr[(p+2)*4+1] = b.min[1];
        boxArr[(p+2)*4+2] = b.min[2]; boxArr[(p+2)*4+3] = 0.0;
        // pixel 3: [max.xyz, reserved]
        boxArr[(p+3)*4+0] = b.max[0]; boxArr[(p+3)*4+1] = b.max[1];
        boxArr[(p+3)*4+2] = b.max[2]; boxArr[(p+3)*4+3] = 0.0;
    }
    var boxDataTexture = new THREE.DataTexture(boxArr, BVH_TEX_W, 1, THREE.RGBAFormat, THREE.FloatType);
    boxDataTexture.wrapS = THREE.ClampToEdgeWrapping;
    boxDataTexture.wrapT = THREE.ClampToEdgeWrapping;
    boxDataTexture.minFilter = THREE.NearestFilter;
    boxDataTexture.magFilter = THREE.NearestFilter;
    boxDataTexture.flipY = false;
    boxDataTexture.generateMipmaps = false;
    boxDataTexture.needsUpdate = true;

    // 5) Bind uniforms
    pathTracingUniforms.tBVHTexture = { value: bvhDataTexture };
    pathTracingUniforms.tBoxDataTexture = { value: boxDataTexture };

    if (mouseControl) {
        setupGUI();
    }
}

function setupGUI() {
    const qualityObject = { samples_per_frame: 8.0 };
    samplesPerFrameController = gui.add(qualityObject, 'samples_per_frame', 1.0, 8.0, 1.0).onChange(function (value) {
        samplesPerFrame = value;
        pathTracingUniforms.uSamplesPerFrame.value = value;
    });
    
    const cameraFolder = gui.addFolder('Camera View');
    var camActions = {
        cam1: function() { switchCamera('cam1'); },
        cam2: function() { switchCamera('cam2'); },
        cam3: function() { switchCamera('cam3'); }
    };
    cameraFolder.add(camActions, 'cam1').name('Cam 1');
    cameraFolder.add(camActions, 'cam2').name('Cam 2');
    cameraFolder.add(camActions, 'cam3').name('Cam 3');
    cameraFolder.open();

    // Prevent GUI clicks from bubbling to body's pointer lock handler
    gui.domElement.addEventListener('click', function(e) { e.stopPropagation(); }, false);
    
    const lightFolder = gui.addFolder('Light Settings');
    
    lightFolder.add({ brightness: 800 }, 'brightness', 0, 4000, 1).onChange(function (value) {
        basicBrightness = value;
        cameraIsMoving = true;
    });
    
    lightFolder.add({ colorTemp: 4000 }, 'colorTemp', 2700, 6500, 100).onChange(function (value) {
        colorTemperature = value;
        cameraIsMoving = true;
    });
    
    lightFolder.open();
    
    const matFolder = gui.addFolder('Material Settings');
    
    matFolder.add({ wallAlbedo: 0.8 }, 'wallAlbedo', 0.1, 1.0, 0.05).onChange(function (value) {
        wallAlbedo = value;
        cameraIsMoving = true;
    });
    
    const panelFolder = matFolder.addFolder('Acoustic Panels');
    panelFolder.add(acousticPanelVisibility, 'north').onChange(function () { cameraIsMoving = true; });
    panelFolder.add(acousticPanelVisibility, 'south').onChange(function () { cameraIsMoving = true; });
    panelFolder.add(acousticPanelVisibility, 'east').onChange(function () { cameraIsMoving = true; });
    panelFolder.add(acousticPanelVisibility, 'west').onChange(function () { cameraIsMoving = true; });
    panelFolder.add(acousticPanelVisibility, 'ceiling').onChange(function () { cameraIsMoving = true; });
    panelFolder.open();
    
    matFolder.open();
    
    const bloomFolder = gui.addFolder('Bloom');
    
    bloomFolder.add({ intensity: 0.15 }, 'intensity', 0.0, 2.0, 0.01).onChange(function (value) {
        bloomIntensity = value;
        if (sampleCounter >= 1500 && screenOutputUniforms) {
            screenOutputUniforms.uBloomIntensity.value = bloomIntensity;
        }
    });
    
    bloomFolder.add({ radius: 2.0 }, 'radius', 1.0, 20.0, 0.5).onChange(function (value) {
        bloomRadius = value;
        if (sampleCounter >= 1500 && screenOutputUniforms) {
            screenOutputUniforms.uBloomRadius = { value: bloomRadius };
        }
    });
    
    const snapshotFolder = gui.addFolder('Snapshot');
    
    snapshotFolder.add({ capture: 'Capture' }, 'capture').onChange(function () {
        const dataURL = captureSnapshot();
        snapshots.push({
            samples: sampleCounter,
            src: dataURL,
            filename: makeFilename(sampleCounter)
        });
        capturedMilestones.add(sampleCounter);
        buildSnapshotBar();
    });
    
    snapshotFolder.add({ downloadAll: 'Download All' }, 'downloadAll').onChange(function () {
        downloadAllSnapshots();
    });
    
    snapshotFolder.open();
}

function updateVariablesAndUniforms() {
    // Enforce preset every frame until user takes manual control
    if (lockedPreset) {
        if (!isPaused || inputMovementHorizontal !== 0 || inputMovementVertical !== 0) {
            // User entered pointer lock or moved mouse — release lock
            lockedPreset = null;
        } else {
            // Override any framework drift (rotateY runs before this)
            cameraControlsObject.position.set(
                lockedPreset.position.x,
                lockedPreset.position.y,
                lockedPreset.position.z
            );
            cameraControlsPitchObject.rotation.set(lockedPreset.pitch, 0, 0);
            cameraControlsYawObject.rotation.set(0, lockedPreset.yaw, 0);
        }
    }

    if (cameraSwitchFrames > 0) {
        cameraIsMoving = true;
        cameraSwitchFrames--;
    }

    pathTracingUniforms.uSamplesPerFrame.value = samplesPerFrame;
    
    if (pathTracingUniforms.uBasicBrightness) {
        pathTracingUniforms.uBasicBrightness.value = basicBrightness;
    }
    if (pathTracingUniforms.uWallAlbedo) {
        pathTracingUniforms.uWallAlbedo.value = wallAlbedo;
    }
    
    cameraInfoElement.innerHTML = "FOV: " + worldCamera.fov + " / Aperture: " + apertureSize.toFixed(2) + " / FocusDistance: " + focusDistance + "<br>" + "Samples: " + sampleCounter + " / SPF: " + samplesPerFrame;
    
    if (sampleCounter < lastSnapshotCheck) {
        snapshots.length = 0;
        capturedMilestones.clear();
        const bar = document.getElementById('snapshot-bar');
        if (bar) bar.innerHTML = '';
    }
    lastSnapshotCheck = sampleCounter;
    
    if (SNAPSHOT_MILESTONES.includes(sampleCounter) && !capturedMilestones.has(sampleCounter)) {
        capturedMilestones.add(sampleCounter);
        const dataURL = captureSnapshot();
        snapshots.push({
            samples: sampleCounter,
            src: dataURL,
            filename: makeFilename(sampleCounter)
        });
        buildSnapshotBar();
    }
}

init();