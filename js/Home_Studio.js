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

function switchCamera(preset) {
    const cam = CAMERA_PRESETS[preset];
    if (!cam) return;
    
    currentCameraPreset = preset;
    cameraControlsObject.position.set(cam.position.x, cam.position.y, cam.position.z);
    cameraControlsPitchObject.rotation.x = cam.pitch;
    cameraControlsYawObject.rotation.y = cam.yaw;
    cameraIsMoving = true;
}

function initSceneData() {
    demoFragmentShaderFileName = 'Home_Studio_Fragment.glsl';
    
    sceneIsDynamic = false;
    cameraFlightSpeed = 10;
    pixelRatio = mouseControl ? 2.0 : 2.0;
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
    cameraFolder.add({ view: 'cam1' }, 'view', ['cam1', 'cam2', 'cam3']).onChange(function (value) {
        switchCamera(value);
    });
    cameraFolder.open();
    
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