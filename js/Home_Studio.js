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

// R2-5 門 + 窗外景色 (index 25-27)
addBox([-1.52, 0.0, -1.914], [-0.73, 2.03, -1.874], z3, C_WOOD, 7);          // 25 北牆木門（type 7: 木門貼圖）
addBox([-2.00, 0.09, -1.874], [-1.96, 2.04, -0.984], z3, C_METAL, 8);        // 26 西牆鐵門（type 8: 鐵門貼圖）
addBox([-15.0, -5.0, 14.9], [15.0, 10.0, 15.0], z3, C_WHITE, 5);              // 27 窗外景色背板（type 5: 貼圖採樣）

// R2-7 KH750 超低音 (index 28)
addBox([0.79, 0.0, 2.273], [1.12, 0.383, 2.656], z3, C_SPEAKER, 9);          // 28 KH750 超低音（type 9: 正背面貼圖，33×38.3×38.3cm）

// R2-6 旋轉物件定義（center, halfSize, rotY, color）
const rotatedObjects = [
    // 左聲道
    { name: 'uLeftSpeakerInvMatrix',    center: [-0.56825, 1.0965, 0.9842], half: [0.1125, 0.1725, 0.1365], rotY: -Math.PI/6, color: C_SPEAKER },
    { name: 'uLeftStandBaseInvMatrix',  center: [-0.56825, 0.015,  0.9842], half: [0.125,  0.015,  0.15],   rotY: -Math.PI/6, color: C_STAND },
    { name: 'uLeftStandPillarInvMatrix',center: [-0.56825, 0.46,   0.9842], half: [0.02,   0.43,   0.05],   rotY: -Math.PI/6, color: C_STAND_PILLAR },
    { name: 'uLeftStandTopInvMatrix',   center: [-0.56825, 0.89,   0.9842], half: [0.10,   0.01,   0.125],  rotY: -Math.PI/6, color: C_STAND },
    // 右聲道
    { name: 'uRightSpeakerInvMatrix',    center: [0.56825, 1.0965, 0.9842], half: [0.1125, 0.1725, 0.1365], rotY: Math.PI/6, color: C_SPEAKER },
    { name: 'uRightStandBaseInvMatrix',  center: [0.56825, 0.015,  0.9842], half: [0.125,  0.015,  0.15],   rotY: Math.PI/6, color: C_STAND },
    { name: 'uRightStandPillarInvMatrix',center: [0.56825, 0.46,   0.9842], half: [0.02,   0.43,   0.05],   rotY: Math.PI/6, color: C_STAND_PILLAR },
    { name: 'uRightStandTopInvMatrix',   center: [0.56825, 0.89,   0.9842], half: [0.10,   0.01,   0.125],  rotY: Math.PI/6, color: C_STAND },
];
const rotatedMeshes = [];

let samplesPerFrame = 8.0;
let samplesPerFrameController;

const CAMERA_PRESETS = {
    cam1: { position: { x: -1.4, y: 2.3, z: 3.9 }, pitch: -0.18, yaw: -0.40 },
    cam2: { position: { x: -0.9, y: 1.5, z: 3.4 }, pitch: 0.3, yaw: -0.25 },
    cam3: { position: { x: 0.0, y: 1.3, z: -1.0 }, pitch: 0.0, yaw: -Math.PI }
};
let currentCameraPreset = 'cam1';
let camPosXCtrl, camPosYCtrl, camPosZCtrl, camPitchCtrl, camYawCtrl;

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

const MAX_SAMPLES = 1000;
const SNAPSHOT_MILESTONES = [8, 100, 300, 500, 1000];
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

    // hover 預覽容器（只建一次）
    var preview = document.getElementById('snapshot-preview');
    if (!preview) {
        preview = document.createElement('img');
        preview.id = 'snapshot-preview';
        preview.style.cssText = 'position:fixed; bottom:100px; left:10px; z-index:30; display:none; border:2px solid #555; background:#000; max-width:60vw; max-height:60vh; pointer-events:none;';
        document.body.appendChild(preview);
    }

    bar.innerHTML = '';
    snapshots.forEach((snap) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative; display:inline-block; text-align:center;';

        const imgWrap = document.createElement('div');
        imgWrap.style.cssText = 'position:relative; display:inline-block;';

        const img = document.createElement('img');
        img.src = snap.src;
        img.width = 60;
        img.height = Math.round(60 * (window.innerHeight / window.innerWidth));
        img.style.cssText = 'display:block; cursor:pointer;';

        img.onmouseenter = function() {
            preview.src = snap.src;
            preview.style.display = 'block';
        };
        img.onmouseleave = function() {
            preview.style.display = 'none';
        };

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾';
        saveBtn.title = snap.filename;
        saveBtn.style.cssText = 'position:absolute; top:1px; right:1px; font-size:8px; padding:1px 2px; cursor:pointer; background:rgba(0,0,0,0.5); border:none; border-radius:2px; line-height:1;';
        saveBtn.onclick = (e) => {
            e.stopPropagation();
            const a = document.createElement('a');
            a.href = snap.src;
            a.download = snap.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        imgWrap.appendChild(img);
        imgWrap.appendChild(saveBtn);

        const label = document.createElement('div');
        label.style.cssText = 'color:#fff; font-size:8px; text-shadow:0 0 3px #000;';
        label.textContent = snap.samples.toLocaleString() + ' spp';

        wrap.appendChild(imgWrap);
        wrap.appendChild(label);
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

    // 重置 FOV（滾輪縮放）
    worldCamera.fov = 55;
    fovScale = worldCamera.fov * 0.5 * (Math.PI / 180.0);
    pathTracingUniforms.uVLen.value = Math.tan(fovScale);

    isPaused = true;
    cameraIsMoving = true;

    // 同步 GUI 顯示
    if (camPosXCtrl) {
        camPosXCtrl.setValue(cam.position.x);
        camPosYCtrl.setValue(cam.position.y);
        camPosZCtrl.setValue(cam.position.z);
        camPitchCtrl.setValue(cam.pitch);
        camYawCtrl.setValue(cam.yaw);
    }
}

function initSceneData() {
    demoFragmentShaderFileName = 'Home_Studio_Fragment.glsl?v=' + Date.now();
    
    sceneIsDynamic = false;
    cameraFlightSpeed = 5;
    pixelRatio = 1.0;
    EPS_intersect = 0.001;
    
    worldCamera.fov = 55;
    focusDistance = 4.0;
    apertureChangeSpeed = 200;
    
    // 預設載入 Cam 1 位置
    cameraControlsObject.position.set(-1.4, 2.3, 3.9);
    cameraControlsPitchObject.rotation.set(-0.18, 0, 0);
    cameraControlsYawObject.rotation.set(0, -0.40, 0);
    inputRotationHorizontal = -0.40;
    inputRotationVertical = -0.18;
    oldYawRotation = -0.40;
    oldPitchRotation = -0.18;
    
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
    
    // === R2-6 旋轉物件逆矩陣 ===
    var rotBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    var rotBoxMat = new THREE.MeshBasicMaterial();
    for (var ri = 0; ri < rotatedObjects.length; ri++) {
        var ro = rotatedObjects[ri];
        var mesh = new THREE.Mesh(rotBoxGeo, rotBoxMat);
        mesh.position.set(ro.center[0], ro.center[1], ro.center[2]);
        mesh.rotation.set(0, ro.rotY, 0);
        mesh.updateMatrixWorld(true);
        rotatedMeshes.push(mesh);
    }

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

    // 6) 旋轉物件逆矩陣 uniforms
    for (var ri = 0; ri < rotatedObjects.length; ri++) {
        pathTracingUniforms[rotatedObjects[ri].name] = { value: new THREE.Matrix4().copy(rotatedMeshes[ri].matrixWorld).invert() };
    }

    // 7) 載入窗外景色貼圖
    const winTexLoader = new THREE.TextureLoader();
    winTexLoader.crossOrigin = 'anonymous';
    winTexLoader.load('https://duk.tw/WfvcAv.png', function(tex) {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.flipY = true;
        pathTracingUniforms.uWinTex = { value: tex };
        cameraIsMoving = true;
    });
    // 預設 1x1 白色貼圖，貼圖載入前不會黑屏
    pathTracingUniforms.uWinTex = { value: new THREE.DataTexture(new Uint8Array([255,255,255,255]), 1, 1, THREE.RGBAFormat) };

    // 8) KH150 喇叭正面/背面貼圖
    // 黑底 + 從中心放大 4%，裁掉產品照白色角落
    var defaultTex = new THREE.DataTexture(new Uint8Array([128,128,128,255]), 1, 1, THREE.RGBAFormat);
    pathTracingUniforms.u150F = { value: defaultTex };
    pathTracingUniforms.u150B = { value: defaultTex };

    function prepSpeakerTex(img) {
        var c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#1f1f1f';
        ctx.fillRect(0, 0, c.width, c.height);
        var zoom = 1.04;
        var dw = img.width * zoom, dh = img.height * zoom;
        var dx = (img.width - dw) / 2, dy = (img.height - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        var tex = new THREE.CanvasTexture(c);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        return tex;
    }

    var spkF = new Image();
    spkF.onload = function() {
        pathTracingUniforms.u150F.value = prepSpeakerTex(spkF);
        cameraIsMoving = true;
    };
    spkF.src = 'textures/kh150_front.jpg';

    var spkB = new Image();
    spkB.onload = function() {
        pathTracingUniforms.u150B.value = prepSpeakerTex(spkB);
        cameraIsMoving = true;
    };
    spkB.src = 'textures/kh150_back.jpg';

    // 8b) KH750 超低音正面/背面貼圖（已手動裁切白邊，黑底放大 4% 裁白角，比照 KH150）
    pathTracingUniforms.u750F = { value: defaultTex };
    pathTracingUniforms.u750B = { value: defaultTex };

    var sub750F = new Image();
    sub750F.onload = function() {
        pathTracingUniforms.u750F.value = prepSpeakerTex(sub750F);
        cameraIsMoving = true;
    };
    sub750F.src = 'textures/kh750_front.jpg';

    var sub750B = new Image();
    sub750B.onload = function() {
        pathTracingUniforms.u750B.value = prepSpeakerTex(sub750B);
        cameraIsMoving = true;
    };
    sub750B.src = 'textures/kh750_back.jpg';

    // 9) 木門 / 鐵門貼圖（本地檔案，Image + CanvasTexture 載入）
    var defaultDoorTex = new THREE.DataTexture(new Uint8Array([128,128,128,255]), 1, 1, THREE.RGBAFormat);
    pathTracingUniforms.uWoodDoorTex = { value: defaultDoorTex };
    pathTracingUniforms.uIronDoorTex = { value: defaultDoorTex };

    function prepDoorTex(img) {
        var c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        var tex = new THREE.CanvasTexture(c);
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.needsUpdate = true;
        return tex;
    }

    var woodDoorImg = new Image();
    woodDoorImg.onload = function() {
        pathTracingUniforms.uWoodDoorTex.value = prepDoorTex(woodDoorImg);
        cameraIsMoving = true;
    };
    woodDoorImg.src = 'textures/wood_door.jpeg';

    var ironDoorImg = new Image();
    ironDoorImg.onload = function() {
        pathTracingUniforms.uIronDoorTex.value = prepDoorTex(ironDoorImg);
        cameraIsMoving = true;
    };
    ironDoorImg.src = 'textures/iron_door.jpg';

    // 10) ISO-PUCK MINI 世界座標（8 顆，每側 4 顆）
    var puckRadius = 0.022;   // 直徑 4.4cm
    var puckHalfH = 0.012;    // 高度 2.4cm
    var puckXOff = 0.10 - puckRadius;   // 0.078，圓週切齊頂板邊長
    var puckZOff = 0.125 - puckRadius;  // 0.103
    var puckYLocal = 0.01 + puckHalfH;  // 頂板表面上方的 puck 中心 Y
    var puckLocalOffsets = [
        new THREE.Vector3(-puckXOff, puckYLocal, -puckZOff),
        new THREE.Vector3(-puckXOff, puckYLocal,  puckZOff),
        new THREE.Vector3( puckXOff, puckYLocal, -puckZOff),
        new THREE.Vector3( puckXOff, puckYLocal,  puckZOff)
    ];
    var puckPositions = [];
    // index 3 = 左頂板, index 7 = 右頂板
    [3, 7].forEach(function(topIdx) {
        var mat = rotatedMeshes[topIdx].matrixWorld;
        puckLocalOffsets.forEach(function(off) {
            var p = off.clone().applyMatrix4(mat);
            puckPositions.push(p);
        });
    });
    pathTracingUniforms.uPuckPositions = { value: puckPositions };
    pathTracingUniforms.uPuckRadius = { value: puckRadius };
    pathTracingUniforms.uPuckHalfH = { value: puckHalfH };

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

    var camPos = {
        x: cameraControlsObject.position.x,
        y: cameraControlsObject.position.y,
        z: cameraControlsObject.position.z,
        pitch: cameraControlsPitchObject.rotation.x,
        yaw: cameraControlsYawObject.rotation.y
    };

    function applyCamManual() {
        lockedPreset = null;
        cameraControlsObject.position.set(camPos.x, camPos.y, camPos.z);
        cameraControlsPitchObject.rotation.set(camPos.pitch, 0, 0);
        cameraControlsYawObject.rotation.set(0, camPos.yaw, 0);
        inputRotationHorizontal = camPos.yaw;
        inputRotationVertical = camPos.pitch;
        oldYawRotation = camPos.yaw;
        oldPitchRotation = camPos.pitch;
        inputMovementHorizontal = 0;
        inputMovementVertical = 0;
        isPaused = true;
        cameraIsMoving = true;
        cameraSwitchFrames = 3;
    }

    camPosXCtrl = cameraFolder.add(camPos, 'x', -3, 3, 0.01).name('pos X').onChange(applyCamManual);
    camPosYCtrl = cameraFolder.add(camPos, 'y', 0, 4, 0.01).name('pos Y').onChange(applyCamManual);
    camPosZCtrl = cameraFolder.add(camPos, 'z', -3, 5, 0.01).name('pos Z').onChange(applyCamManual);
    camPitchCtrl = cameraFolder.add(camPos, 'pitch', -1.5, 1.5, 0.01).name('pitch').onChange(applyCamManual);
    camYawCtrl = cameraFolder.add(camPos, 'yaw', -Math.PI, Math.PI, 0.01).name('yaw').onChange(applyCamManual);

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
    
    // 每幀同步攝影機實際值到 GUI（updateDisplay 不觸發 onChange）
    if (camPosXCtrl) {
        camPosXCtrl.object.x = cameraControlsObject.position.x;
        camPosYCtrl.object.y = cameraControlsObject.position.y;
        camPosZCtrl.object.z = cameraControlsObject.position.z;
        camPitchCtrl.object.pitch = cameraControlsPitchObject.rotation.x;
        camYawCtrl.object.yaw = cameraControlsYawObject.rotation.y;
        camPosXCtrl.updateDisplay();
        camPosYCtrl.updateDisplay();
        camPosZCtrl.updateDisplay();
        camPitchCtrl.updateDisplay();
        camYawCtrl.updateDisplay();
    }

    cameraInfoElement.innerHTML = "FOV: " + worldCamera.fov + " / Samples: " + sampleCounter + (sampleCounter >= MAX_SAMPLES ? " (休眠)" : "");

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