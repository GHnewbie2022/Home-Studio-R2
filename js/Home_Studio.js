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
// R6 LGG-r30：C1/C2 開頁預設牆面反射率 0.75（截圖配色）；C3/C4 切過去時由 applyPanelConfig 套 0.85
const C_WALL = [0.75, 0.738, 0.71175];
const C_WALL_L = [0.75, 0.738, 0.71175];
const C_WALL_R = [0.75, 0.738, 0.71175];
const C_WALL_S = [0.75, 0.738, 0.71175];
const C_BEAM = [1.0, 0.984, 0.949];
const C_FLOOR = [0.55, 0.47, 0.41];
const C_WOOD = [0.55, 0.35, 0.17];
const C_DARK_WOOD = [0.36, 0.26, 0.18];
const C_METAL = [0.50, 0.55, 0.55];
const C_WHITE = [0.85, 0.85, 0.85];
const C_SPEAKER = [0.12, 0.12, 0.12];
const C_STAND = [0.08, 0.08, 0.08];
const C_STAND_PILLAR = [0.80, 0.82, 0.85];
const C_SPIKE = [0.75, 0.60, 0.15];
const C_GIK = [0.50, 0.50, 0.50];
const C_CLOUD_LIGHT = [0.9, 0.9, 0.9]; // R2-17 Cloud 漫射燈條；emission=0 視覺幾何，真光源留 R3
const C_DARK_VENT = [0.0, 0.0, 0.0];

// R3-6.5: Dynamic light pool 常數
const ACTIVE_LIGHT_POOL_MAX = 11;
const ACTIVE_LIGHT_LUT_SENTINEL = -1;
const R7_2_LIGHT_IMPORTANCE_VERSION = 'r7-2-light-importance-sampling-v1-r7-2d-step-history';
const R7_3_QUICK_PREVIEW_FILL_VERSION = 'r7-3-quick-preview-fill-v3al-c1c2-fps1';
let r72LightImportanceSamplingEnabled = false;

// === Scene Box Data (single source of truth) ===
const sceneBoxes = [];
const z3 = [0, 0, 0]; // zero emission shorthand
// R2-14：第八參數 fixtureGroup 為「可切換裝置」分群標識
// 0 = 恆顯、1 = R2-14 東西投射燈軌道、2 = R2-15 南北廣角燈軌道、3 = R2-16 Cloud 吸音板、4 = R2-17 Cloud 漫射燈條
// 預留為 R2-16/17 各階段之開關鎖鍊；值對應 shader 中 uTrackLightEnabled / uWideTrackLightEnabled 等 uniform 的 gating
// R2-18：第 9、10 參數 roughness / metalness；未傳則依 type + color + fixtureGroup auto-assign（規則見下方 autoAssignMaterial）
function _colorEq(c1, c2) {
    return Math.abs(c1[0] - c2[0]) < 0.01 &&
           Math.abs(c1[1] - c2[1]) < 0.01 &&
           Math.abs(c1[2] - c2[2]) < 0.01;
}
function autoAssignMaterial(color, type, fixtureGroup, boxIdx) {
    // R2-18 Y 方案（scalar roughness mix + metalness）：依 type/color/fixtureGroup 推預設
    // 結構（地板/天花板/牆/樑/柱，index 0..31）= 0.9；木系傢俱 = 0.7；其他白色傢俱 = 0.8；貼圖金屬 = 依 type
    if (type === 8) return { roughness: 0.3, metalness: 1.0 };                    // IRON_DOOR
    if (type === 7) return { roughness: 0.9, metalness: 0.0 };                    // WOOD_DOOR（plan 表 0.9，類 Lambertian）
    if (type === 6) return { roughness: 0.4, metalness: 0.0 };                    // SPEAKER（KH150）
    if (type === 9) return { roughness: 0.4, metalness: 0.0 };                    // SUBWOOFER（KH750）
    if (type === 10 && (fixtureGroup || 0) === 3) return { roughness: 0.5, metalness: 0.0 }; // ACOUSTIC_PANEL Cloud
    if (type === 10) return { roughness: 0.85, metalness: 0.0 };                  // ACOUSTIC_PANEL 牆掛
    if (type === 5) return { roughness: 0.8, metalness: 0.0 };                    // BACKDROP 窗外背板
    if (type === 11 || type === 12 || type === 13 || type === 14) return { roughness: 0.85, metalness: 0.0 }; // OUTLET / LAMP_SHELL / TRACK / CLOUD_LIGHT
    if (type === 1) {
        if (_colorEq(color, C_WOOD) || _colorEq(color, C_DARK_WOOD)) return { roughness: 0.7, metalness: 0.0 };
        if (boxIdx <= 31) return { roughness: 0.9, metalness: 0.0 };               // 結構組（floor/ceiling/wall/beam/pillar）
        return { roughness: 0.8, metalness: 0.0 };                                  // 其他家具白色系（櫃體、冷氣、通風口）
    }
    return { roughness: 0.8, metalness: 0.0 }; // 保底
}
function addBox(min, max, emission, color, type, meta, cullable, fixtureGroup, roughness, metalness) {
    var fg = fixtureGroup || 0;
    if (roughness === undefined || metalness === undefined) {
        var autoMat = autoAssignMaterial(color, type, fg, sceneBoxes.length);
        if (roughness === undefined) roughness = autoMat.roughness;
        if (metalness === undefined) metalness = autoMat.metalness;
    }
    sceneBoxes.push({ min, max, emission, color, type, meta: meta || 0, cullable: cullable || 0, fixtureGroup: fg, roughness: roughness, metalness: metalness });
}

// R2-3 牆面 (fix10：地面/天花板 9 片化、四角牆裂)
// 地面 0 → 7 片 (fix14：Center z 延至 [MIN_Z, MAX_Z]，併入原 N/S edge)
addBox([MIN_X, MIN_Y, MIN_Z],  [-1.91, 0.0, -1.874], z3, C_FLOOR, 1, 0, 1);         // 0a 地面 NW corner
addBox([1.91,  MIN_Y, MIN_Z],  [MAX_X, 0.0, -1.874], z3, C_FLOOR, 1, 0, 1);         // 0c 地面 NE corner
addBox([MIN_X, MIN_Y, -1.874], [-1.91, 0.0, 3.056],  z3, C_FLOOR, 1, 0, 1);         // 0d 地面 W edge
addBox([-1.91, MIN_Y, -1.874], [1.91,  0.0, MAX_Z],  z3, C_FLOOR, 1);               // 0e 地面 Center（fix21：bmin.z→-1.874；r3-6-fix06：bmax.z→MAX_Z 對稱天花板 1e，補中央 x=[-1.91,1.91] z=[3.056,MAX_Z] 缺口；0g/0i 仍覆蓋兩側角柱區）
addBox([1.91,  MIN_Y, -1.874], [MAX_X, 0.0, 3.056],  z3, C_FLOOR, 1, 0, 1);         // 0f 地面 E edge
addBox([MIN_X, MIN_Y, 3.056],  [-1.91, 0.0, MAX_Z],  z3, C_FLOOR, 1, 0, 1);         // 0g 地面 SW corner
addBox([1.91,  MIN_Y, 3.056],  [MAX_X, 0.0, MAX_Z],  z3, C_FLOOR, 1, 0, 1);         // 0i 地面 SE corner
// 天花板 1 → 7 片 (fix14：Center z 延至 [MIN_Z, MAX_Z]，併入原 N/S edge)
addBox([MIN_X, 2.905, MIN_Z],  [-1.91, MAX_Y, -1.874], z3, C_WALL, 1, 0, 1);        // 1a 天花板 NW corner
addBox([1.91,  2.905, MIN_Z],  [MAX_X, MAX_Y, -1.874], z3, C_WALL, 1, 0, 1);        // 1c 天花板 NE corner
addBox([MIN_X, 2.905, -1.874], [-1.91, MAX_Y, 3.056],  z3, C_WALL, 1, 0, 1);        // 1d 天花板 W edge
addBox([-1.91, 2.905, -1.874], [1.91,  MAX_Y, MAX_Z],  z3, C_WALL, 1);              // 1e 天花板 Center（fix21：bmin.z→-1.874；r3-6-fix05：bmax.z→MAX_Z 延伸至南牆外邊界，補 fix23 留下的中央 x=[-1.91,1.91] z=[3.056,MAX_Z] 缺口；1g/1i 仍覆蓋兩側角柱區）
addBox([1.91,  2.905, -1.874], [MAX_X, MAX_Y, 3.056],  z3, C_WALL, 1, 0, 1);        // 1f 天花板 E edge
addBox([MIN_X, 2.905, 3.056],  [-1.91, MAX_Y, MAX_Z],  z3, C_WALL, 1, 0, 1);        // 1g 天花板 SW corner
addBox([1.91,  2.905, 3.056],  [MAX_X, MAX_Y, MAX_Z],  z3, C_WALL, 1, 0, 1);        // 1i 天花板 SE corner
// 北牆西段 2 裂於 x=-1.91
addBox([MIN_X, 0.0, MIN_Z], [-1.91, 2.905, -1.874], z3, C_WALL, 1, 0, 1);           // 2a 北牆西段 NW overlap
addBox([-1.91, 0.0, MIN_Z], [-1.52, 2.905, -1.874], z3, C_WALL, 1, 0, 1);           // 2b 北牆西段 interior
// 北牆東段 3 裂於 x=1.91
addBox([-0.73, 0.0, MIN_Z], [1.91,  2.905, -1.874], z3, C_WALL, 1, 0, 1);           // 3a 北牆東段 interior
addBox([1.91,  0.0, MIN_Z], [MAX_X, 2.905, -1.874], z3, C_WALL, 1, 0, 1);           // 3b 北牆東段 NE overlap
addBox([-1.52, 2.03, MIN_Z], [-0.73, 2.905, -1.874], z3, C_WALL, 1, 0, 1);          // 4  北牆門洞上方
addBox([1.91, 0.0, -1.874], [MAX_X, 2.905, 3.056], z3, C_WALL_R, 1, 0, 1);          // 5  東牆（fix22：bmin.z→-1.874；fix23：bmax.z→3.056 對齊南牆內面，含效 revert 隱含的南延）
// 南牆西段 6 裂於 x=-1.91
addBox([MIN_X, 0.0, 3.056], [-1.91, 2.905, MAX_Z], z3, C_WALL_S, 1, 0, 1);          // 6a 南牆西段 SW overlap
addBox([-1.91, 0.0, 3.056], [-1.75, 2.905, MAX_Z], z3, C_WALL_S, 1, 0, 1);          // 6b 南牆西段 interior
// 南牆東段 7 裂於 x=1.91
addBox([0.69, 0.0, 3.056], [1.91,  2.905, MAX_Z], z3, C_WALL_S, 1, 0, 1);           // 7a 南牆東段 interior
addBox([1.91, 0.0, 3.056], [MAX_X, 2.905, MAX_Z], z3, C_WALL_S, 1, 0, 1);           // 7b 南牆東段 SE overlap
addBox([-1.91, 0.0, 3.056], [0.69, 1.04, MAX_Z], z3, C_WALL_S, 1, 0, 1);            // 8  南牆窗台下方（fix13：西端延至 -1.91 匹配桌與內牆）
addBox([MIN_X, 2.04, -1.874], [-1.91, 2.905, -0.984], z3, C_WALL_L, 1, 0, 1);       // 9  西牆鐵門上方（fix22：bmin.z 縮至 -1.874 對齊北牆內面；20cm 懸空樑問題已由 fix21 beam Z 縮短解決，fix15 不再需要）
addBox([MIN_X, 0.0, -1.874], [-1.91, 0.09, -0.984], z3, C_WALL_L, 1, 0, 1);         // 10 西牆門坎（fix22：bmin.z 縮至 -1.874 同上）
addBox([MIN_X, 0.0, -0.984], [-1.91, 2.905, 3.056], z3, C_WALL_L, 1, 0, 1);         // 11 西牆南段（fix23：bmax.z 由 MAX_Z 縮至 3.056 對齊南牆內面）
addBox([-1.91, 2.525, -1.874], [-1.75, 2.905, 3.056], z3, C_BEAM, 1, 0, 1);         // 12 西牆橫樑（fix21：bmin.z→-1.874；fix23：bmax.z 由 MAX_Z 縮至 3.056，含效 revert fix13 南延）
addBox([1.85, 2.515, -1.874], [MAX_X, 2.905, 3.056], z3, C_BEAM, 1, 0, 1);          // 13 東牆橫樑（fix21：bmin.z→-1.874；fix23：bmax.z 由 MAX_Z 縮至 3.056，含效 revert fix13 南延）
addBox([-1.91, 0.0, 2.848], [-1.75, 2.905, 3.056], z3, C_BEAM, 1, 0, 3);            // 14 西南角柱（r3-6-fix06：cullable=3 單軸 X-only，只跟西牆連動剝離，南牆剝離時柱子保持可視；fix23：bmax.z 由 MAX_Z 縮至 3.056 對齊南牆內面）
addBox([1.78, 0.0, 2.49], [1.91, 2.905, 3.056], z3, C_BEAM, 1, 0, 3);               // 15 東南角柱（x 縮為純內凸 [1.78,1.91]；r3-6-fix06：cullable=3 單軸 X-only，只跟東牆連動剝離；fix23：bmax.z 由 MAX_Z 縮至 3.056 對齊南牆內面）

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
addBox([-1.52, 0.0, -1.914], [-0.73, 2.03, -1.874], z3, C_WOOD, 7, 0, 1);          // 25 北牆木門（type 7: 木門貼圖）
addBox([-2.00, 0.09, -1.874], [-1.96, 2.04, -0.984], z3, C_METAL, 8, 0, 1);        // 26 西牆鐵門（type 8: 鐵門貼圖）
addBox([-15.0, -5.0, 14.9], [15.0, 10.0, 15.0], z3, C_WHITE, 5, 0, 0);              // 27 窗外景色背板（type 5: 貼圖採樣；R6 LGG-r30：cullable 1→0，窗外景色不屬於 X-ray 牆系剝離範疇、永遠可見）

// R2-7 KH750 超低音 (index 28)
addBox([0.79, 0.0, 2.273], [1.12, 0.383, 2.656], z3, C_SPEAKER, 9);          // 28 KH750 超低音（type 9: 正背面貼圖，33×38.3×38.3cm）

// R2-15 插座面板 (index 29-34, type 11 = OUTLET)
addBox([-0.39, 1.185, -1.874], [-0.27, 1.255, -1.864], z3, C_WHITE, 11, 0, 1);  // 29 北牆插座，距地約 120cm
addBox([-1.91, 0.325, -0.024], [-1.90, 0.395, 0.096], z3, C_WHITE, 11, 0, 1);   // 30 西牆插座 1，距地約 33cm
addBox([-1.91, 0.585, 0.656], [-1.90, 0.655, 0.776], z3, C_WHITE, 11, 0, 1);    // 31 西牆插座 2，距地約 59cm
addBox([1.90, 0.725, -0.354], [1.91, 0.795, -0.234], z3, C_WHITE, 11, 0, 1);    // 32 東牆插座 1，距地約 73cm
addBox([1.90, 0.740, 1.930], [1.91, 0.810, 2.050], z3, C_WHITE, 11, 0, 1);      // 33 東牆插座 2，距地約 74cm
addBox([1.01, 0.355, 2.906], [1.02, 0.475, 3.026], z3, C_WHITE, 11, 0, 1);      // 34 南牆附近插座，距地約 36cm

// R2-13 冷氣與通風口 (index 35-36)
addBox([0.83, 2.425, 2.681], [1.7, 2.725, 3.056], z3, C_WHITE, 1, 0, 1);      // 35 冷氣主體（fix23：bmax.z 由 3.181 縮至 3.056 消除卡進南牆 12.5cm，機身深度由 50cm 縮為 37.5cm）
addBox([0.91, 2.425, 2.681], [1.62, 2.455, 2.9], z3, C_DARK_VENT, 1, 0, 1);  // 36 冷氣出風口

// R2-14 東西側投射燈軌道（type 13 = TRACK，R2-14 真修後與插座 OUTLET=11 分家；fixtureGroup=1 受 uTrackLightEnabled 切換顯隱；陣列索引 37..44）
// 規格（fix02 對位舊專案甜蜜點）：x=±0.95（trackBaseX）、軌道頂 y=2.895、s 為 FULL size
// 底座：s=(0.035, 0.02, 1.0) → half=(0.0175, 0.01, 0.5)；z 非對稱 (0.998, -0.002) 組成 -0.502..1.498 之 2m 軌道
addBox([-0.9675, 2.885,  0.498], [-0.9325, 2.905, 1.498], z3, C_WHITE, 13, 0, 0, 1);  // 37 西軌底座北半
addBox([-0.9675, 2.885, -0.502], [-0.9325, 2.905, 0.498], z3, C_WHITE, 13, 0, 0, 1);  // 38 西軌底座南半
addBox([ 0.9325, 2.885,  0.498], [ 0.9675, 2.905, 1.498], z3, C_WHITE, 13, 0, 0, 1);  // 39 東軌底座北半
addBox([ 0.9325, 2.885, -0.502], [ 0.9675, 2.905, 0.498], z3, C_WHITE, 13, 0, 0, 1);  // 40 東軌底座南半
// 支架：s=(0.02, 0.065, 0.02) → half=(0.01, 0.0325, 0.01)；standY=trackBaseY-0.0435=2.8515
// 預設 trackSpacing=150cm → z=z_mid±d/2=0.498±0.75；z_N=-0.252（對正側牆北片 E1/W1），z_S=1.248（對正南片 E3/W3）
addBox([-0.96, 2.819, -0.262], [-0.94, 2.884, -0.242], z3, C_WHITE, 13, 0, 0, 1);  // 41 NW 支架
addBox([ 0.94, 2.819, -0.262], [ 0.96, 2.884, -0.242], z3, C_WHITE, 13, 0, 0, 1);  // 42 NE 支架
addBox([-0.96, 2.819,  1.238], [-0.94, 2.884,  1.258], z3, C_WHITE, 13, 0, 0, 1);  // 43 SW 支架
addBox([ 0.94, 2.819,  1.238], [ 0.96, 2.884,  1.258], z3, C_WHITE, 13, 0, 0, 1);  // 44 SE 支架

// R2-15 南北側廣角燈軌道（type 13 = TRACK；fixtureGroup=2 受 uWideTrackLightEnabled 切換顯隱；陣列索引 45..48）
// 規格來源：SOP/R2：所有幾何物件.md R2-15 節；s 為 FULL size
// 軌道：c=(0, 2.895, ±|Z|), s=(2.0, 0.02, 0.035)；支架：c=(0, 2.865, ±|Z|), s=(0.02, 0.04, 0.02)
addBox([-1.000, 2.885,  2.0825], [1.000, 2.905,  2.1175], z3, C_WHITE, 13, 0, 0, 2);  // 45 南軌（東西向 2m）
addBox([-1.000, 2.885, -1.1175], [1.000, 2.905, -1.0825], z3, C_WHITE, 13, 0, 0, 2);  // 46 北軌
addBox([-0.010, 2.845,  2.0900], [0.010, 2.885,  2.1100], z3, C_WHITE, 13, 0, 0, 2);  // 47 南支架
addBox([-0.010, 2.845, -1.1100], [0.010, 2.885, -1.0900], z3, C_WHITE, 13, 0, 0, 2);  // 48 北支架

// R2-16 Cloud 吸音板（6 片白色 GIK，3×2 矩陣 180×240cm，頂面 y=2.787 距天花板 11.8cm 空腔拉電線用）
// 規格來源：SOP/R2：所有幾何物件.md R2-16 節；舊專案座標 L506-511；type=10 ACOUSTIC_PANEL；meta=1 白貼圖；cullable=1 頂向剝離
// 單板 s=(0.6, 0.118, 1.2)：60cm(E-W) × 11.8cm(厚) × 120cm(N-S)
// fixtureGroup=3 受 uCloudPanelEnabled 切換顯隱；關閉時吸頂燈回房間中央，開啟時北移至 z=-1.5 避開 Cloud 與 R2-15 北軌道
addBox([-0.9, 2.669, -0.702], [-0.3, 2.787, 0.498], z3, C_GIK, 10, 1, 1, 3);  // 49 Cloud C1 北西
addBox([-0.3, 2.669, -0.702], [ 0.3, 2.787, 0.498], z3, C_GIK, 10, 1, 1, 3);  // 50 Cloud C2 北中
addBox([ 0.3, 2.669, -0.702], [ 0.9, 2.787, 0.498], z3, C_GIK, 10, 1, 1, 3);  // 51 Cloud C3 北東
addBox([-0.9, 2.669,  0.498], [-0.3, 2.787, 1.698], z3, C_GIK, 10, 1, 1, 3);  // 52 Cloud C4 南西
addBox([-0.3, 2.669,  0.498], [ 0.3, 2.787, 1.698], z3, C_GIK, 10, 1, 1, 3);  // 53 Cloud C5 南中
addBox([ 0.3, 2.669,  0.498], [ 0.9, 2.787, 1.698], z3, C_GIK, 10, 1, 1, 3);  // 54 Cloud C6 南東

// R2-17 Cloud 漫射燈條（4 支矩形長柱，type 14 CLOUD_LIGHT；R3-3 接為真光源）
// 真實可見幾何依舊專案 line 514-515 type 9：1.6cm × 1.6cm × 240cm（非 SOP 誤抄之採樣體積 15×5cm）
// y 中心 2.795（底 2.787 貼死 Cloud 頂、頂 2.803）；fixtureGroup=4 受 uCloudLightEnabled 切換；cullable=1 隨 Cloud 板頂向剝離
// R3-3 fix01：sceneBoxes 陣列 index 71-74 連續 = E/W/S/N，順序對應 uCloudEmission[0..3] + uCloudFaceArea[0..3]。
// shader 端 hitObjectID = objectCount(0) + boxIdx + 1（見 Home_Studio_Fragment.glsl L516），boxIdx 即 sceneBoxes index；故 uCloudObjIdBase = 71+1 = 72。
// 註：原 R3-3 plan 誤把註解「55 東燈條」邏輯編號當成 sceneBoxes.length，忽略複合 ID（0a/0c/2a/2b 等）每個子塊各 push 一次。
const CLOUD_BOX_IDX_BASE = 71;
if (sceneBoxes.length !== CLOUD_BOX_IDX_BASE) {
    throw new Error('[R3-3] Cloud boxIdx base mismatch: expected ' + CLOUD_BOX_IDX_BASE + ', got ' + sceneBoxes.length);
}
addBox([ 0.884, 2.787, -0.686], [ 0.900, 2.803, 1.682], z3, C_CLOUD_LIGHT, 14, 0, 1, 4);  // 55 東燈條（沿 z 2.368m；R6-3 Phase 1C corner relief：頭尾各退 16mm）
addBox([-0.900, 2.787, -0.686], [-0.884, 2.803, 1.682], z3, C_CLOUD_LIGHT, 14, 0, 1, 4);  // 56 西燈條
addBox([-0.884, 2.787,  1.682], [ 0.884, 2.803, 1.698], z3, C_CLOUD_LIGHT, 14, 0, 1, 4);  // 57 南燈條（沿 x 1.768m；比照東西短軸 1.6cm）
addBox([-0.884, 2.787, -0.702], [ 0.884, 2.803, -0.686], z3, C_CLOUD_LIGHT, 14, 0, 1, 4); // 58 北燈條
// R6-3 Phase 1C：Cloud 鋁槽不發光鋁板。16mm pizza 為發光弧面外接輪廓；底板在 GIK 頂面上方，內側 17mm 補齊 L 型鋁槽。
// 材質沿用喇叭架霧面鋁 C_STAND_PILLAR。
addBox([ 0.884, 2.787, -0.686], [ 0.900, 2.788, 1.682], z3, C_STAND_PILLAR, 1, 0, 1, 4, 0.55, 1.0); // E 底板 1mm，寬 16mm
addBox([-0.900, 2.787, -0.686], [-0.884, 2.788, 1.682], z3, C_STAND_PILLAR, 1, 0, 1, 4, 0.55, 1.0); // W 底板 1mm，寬 16mm
addBox([-0.884, 2.787,  1.682], [ 0.884, 2.788, 1.698], z3, C_STAND_PILLAR, 1, 0, 1, 4, 0.55, 1.0); // S 底板 1mm，寬 16mm
addBox([-0.884, 2.787, -0.702], [ 0.884, 2.788,-0.686], z3, C_STAND_PILLAR, 1, 0, 1, 4, 0.55, 1.0); // N 底板 1mm，寬 16mm
addBox([ 0.883, 2.786, -0.686], [ 0.884, 2.803, 1.682], z3, C_STAND_PILLAR, 1, 0, 1, 4, 0.55, 1.0); // E 內側板 17mm
addBox([-0.884, 2.786, -0.686], [-0.883, 2.803, 1.682], z3, C_STAND_PILLAR, 1, 0, 1, 4, 0.55, 1.0); // W 內側板 17mm
addBox([-0.884, 2.786,  1.681], [ 0.884, 2.803, 1.682], z3, C_STAND_PILLAR, 1, 0, 1, 4, 0.55, 1.0); // S 內側板 17mm
addBox([-0.884, 2.786, -0.686], [ 0.884, 2.803,-0.685], z3, C_STAND_PILLAR, 1, 0, 1, 4, 0.55, 1.0); // N 內側板 17mm

// R3-3：商品規格 D-35NA12V4DR1 軟條燈 480 lm/m。
// R6-3 Phase 1C：使用者決策預設 1600 lm/m（C3 Cloud-only 亮度）；480 lm/m 保留為低檔產品參考。
// Cloud 鋁槽以 1/4 圓弧 diffuser 近似；16mm × 16mm 外接正方形對應半徑 16mm pizza。
// A_face = 0.016 × L，A_arc = (π/2) × A_face。
// 順序 [0]=E [1]=W [2]=S [3]=N 對齊 uCloudEmission / uCloudFaceArea。
const CLOUD_ARC_RADIUS = 0.016;
const CLOUD_ROD_LENGTH    = [2.368, 2.368, 1.768, 1.768];
const CLOUD_ROD_LUMENS    = CLOUD_ROD_LENGTH.map(length => 1600 * length);
const CLOUD_ROD_FACE_AREA = CLOUD_ROD_LENGTH.map(length => CLOUD_ARC_RADIUS * length);
const CLOUD_ARC_AREA_SCALE = Math.PI * 0.5;
const CLOUD_ARC_THETA_MAX = Math.PI * 0.5;

// R6-3 Phase 1C: Cloud 1/4 arc stochastic NEE
// sceneBoxes 71(E)/72(W)/73(S)/74(N)；中心與半邊由 addBox min/max 推導
// E/W 沿 z 長 2.368m；S/N 沿 x 長 1.768m；外框厚度 16mm，發光弧面半徑 16mm。
// E/W 頭尾各退 16mm，讓四角形成非發光 corner relief，避免與 S/N arc 端點重疊。
const CLOUD_ROD_CENTER = [
    new THREE.Vector3( 0.892, 2.795,  0.498),  // rod 0 E
    new THREE.Vector3(-0.892, 2.795,  0.498),  // rod 1 W
    new THREE.Vector3( 0.000, 2.795,  1.690),  // rod 2 S
    new THREE.Vector3( 0.000, 2.795, -0.694),  // rod 3 N
];
const CLOUD_ROD_HALF_EXTENT = [
    new THREE.Vector3(0.008, 0.008, 1.184),    // rod 0 E
    new THREE.Vector3(0.008, 0.008, 1.184),    // rod 1 W
    new THREE.Vector3(0.884, 0.008, 0.008),    // rod 2 S
    new THREE.Vector3(0.884, 0.008, 0.008),    // rod 3 N
];

// R2-8 吸音板
const BASE_BOX_COUNT = 83; // base 53 + R2-14 八 + R2-15 四 + R2-16 六 + R2-17 四 + Cloud 鋁槽鋁板八 = 83

// Config 1：3 片灰色（第一反射點）
const panelConfig1 = [
    { min: [1.792, 0.655, 0.198], max: [1.91, 1.855, 0.798], color: C_GIK, meta: 0, cullable: 1 },     // E2 東牆
    { min: [-1.91, 0.655, 0.198], max: [-1.792, 1.855, 0.798], color: C_GIK, meta: 0, cullable: 1 },    // W2 西牆
    { min: [-0.27, 0.655, -1.874], max: [0.33, 1.855, -1.756], color: C_GIK, meta: 0, cullable: 1 },      // N_v 北牆垂直（Y 統一與側牆齊高，X 東移避開插座）
];

// Config 2：9 片（北 3 灰水平 + 東 3 白 + 西 3 白）
const panelConfig2 = [
    { min: [-0.6, 0.585, -1.874], max: [0.6, 1.185, -1.756], color: C_GIK, meta: 0, cullable: 1 },      // N1 下層
    { min: [-0.6, 1.255, -1.874], max: [0.6, 1.855, -1.756], color: C_GIK, meta: 0, cullable: 1 },      // N2 中層
    { min: [-0.6, 1.925, -1.874], max: [0.6, 2.525, -1.756], color: C_GIK, meta: 0, cullable: 1 },      // N3 上層
    { min: [1.792, 0.795, -0.5525], max: [1.91, 1.995, 0.0475], color: C_WHITE, meta: 1, cullable: 1 },  // E1 東牆
    { min: [1.792, 0.655, 0.198], max: [1.91, 1.855, 0.798], color: C_WHITE, meta: 1, cullable: 1 },     // E2 東牆
    { min: [1.792, 0.795, 0.9485], max: [1.91, 1.995, 1.5485], color: C_WHITE, meta: 1, cullable: 1 },   // E3 東牆
    { min: [-1.91, 0.795, -0.5525], max: [-1.792, 1.995, 0.0475], color: C_WHITE, meta: 1, cullable: 1 },// W1 西牆
    { min: [-1.91, 0.655, 0.198], max: [-1.792, 1.855, 0.798], color: C_WHITE, meta: 1, cullable: 1 },   // W2 西牆
    { min: [-1.91, 0.795, 0.9485], max: [-1.792, 1.995, 1.5485], color: C_WHITE, meta: 1, cullable: 1 }, // W3 西牆
];

let currentPanelConfig = 1;

// R6 LGG-r30：per-config stateful 切換
//   configPostDefaults  每個 config 第一次進入時的初值，亦是 cmd+click 重置目標
//   configState         每個 config 離開時的 slider 值快照；切回時恢復、避免臨時調整丟失
const configState = { 1: null, 2: null, 3: null, 4: null };
const configPostDefaults = {
    1: { borrow: 0.0, sat: 1.5, acesStrength: 1.00, acesSat: 0.95, lggLift:  0.0, lggGamma: 1.5, lggGain: 0.80, wb: -0.2, hue: 1, wall: 0.75 },
    2: { borrow: 0.0, sat: 1.5, acesStrength: 1.00, acesSat: 0.95, lggLift:  0.0, lggGamma: 1.5, lggGain: 0.80, wb: -0.2, hue: 1, wall: 0.75 },
    3: { borrow: 2.0, sat: 1.7, acesStrength: 0.30, acesSat: 1.00, lggLift: -0.1, lggGamma: 1.5, lggGain: 0.90, wb: -0.4, hue: 5, wall: 0.85 },
    4: { borrow: 0.5, sat: 1.7, acesStrength: 0.30, acesSat: 1.00, lggLift: -0.1, lggGamma: 2.0, lggGain: 0.90, wb: -0.2, hue: 2, wall: 0.85 }
};

// R6 LGG-r30：snapshot 當前 9 條 slider 值（給 stateful 切換用，slider 未就緒時返回 null）
function snapshotCurrentConfigPost() {
    var pairs = [
        ['borrow',       'slider-borrow-strength-b'],
        ['sat',          'slider-sat-b'],
        ['acesStrength', 'slider-aces-strength-b'],
        ['acesSat',      'slider-aces-sat-b'],
        ['lggLift',      'slider-lgg-lift'],
        ['lggGamma',     'slider-lgg-gamma'],
        ['lggGain',      'slider-lgg-gain'],
        ['wb',           'slider-wb-b'],
        ['hue',          'slider-hue-b'],
        ['wall',         'slider-wall-albedo']
    ];
    var snap = {};
    var ok = false;
    for (var i = 0; i < pairs.length; i++) {
        var v = getSliderValue(pairs[i][1]);
        if (typeof v === 'number' && !isNaN(v)) {
            snap[pairs[i][0]] = v;
            ok = true;
        }
    }
    return ok ? snap : null;
}

// R6 LGG-r30：套 9 條 slider 值 + 對應 uniform（B 模 active 才寫 uniform；A 模 uniform 由 btnA 強制中性）
function applyConfigPost(post) {
    if (!post) return;
    setSliderValue('slider-borrow-strength-b', post.borrow);
    setSliderValue('slider-sat-b', post.sat);
    setSliderValue('slider-aces-strength-b', post.acesStrength);
    setSliderValue('slider-aces-sat-b', post.acesSat);
    setSliderValue('slider-lgg-lift', post.lggLift);
    setSliderValue('slider-lgg-gamma', post.lggGamma);
    setSliderValue('slider-lgg-gain', post.lggGain);
    setSliderValue('slider-wb-b', post.wb);
    setSliderValue('slider-hue-b', post.hue);
    if (typeof window.applyWallAlbedo === 'function') {
        window.applyWallAlbedo(post.wall);
    } else {
        setSliderValue('slider-wall-albedo', post.wall);
    }
    var btnBEl = document.getElementById('btnGroupB');
    if (btnBEl && btnBEl.classList.contains('glow-white')) {
        if (pathTracingUniforms && pathTracingUniforms.uBorrowStrength) pathTracingUniforms.uBorrowStrength.value = post.borrow;
        if (screenOutputUniforms) {
            if (screenOutputUniforms.uSaturation) screenOutputUniforms.uSaturation.value = post.sat;
            if (screenOutputUniforms.uACESStrength) screenOutputUniforms.uACESStrength.value = post.acesStrength;
            if (screenOutputUniforms.uACESSatShadow) screenOutputUniforms.uACESSatShadow.value = post.acesSat;
            if (screenOutputUniforms.uACESSatMid) screenOutputUniforms.uACESSatMid.value = post.acesSat;
            if (screenOutputUniforms.uACESSatHighlight) screenOutputUniforms.uACESSatHighlight.value = post.acesSat;
            if (screenOutputUniforms.uLGGLift) screenOutputUniforms.uLGGLift.value = post.lggLift;
            if (screenOutputUniforms.uLGGGamma) screenOutputUniforms.uLGGGamma.value = post.lggGamma;
            if (screenOutputUniforms.uLGGGain) screenOutputUniforms.uLGGGain.value = post.lggGain;
            if (screenOutputUniforms.uWBB) screenOutputUniforms.uWBB.value = post.wb;
            if (screenOutputUniforms.uHueB) screenOutputUniforms.uHueB.value = post.hue;
        }
    }
}

function buildSceneBVH() {
    var N = sceneBoxes.length;

    // 1) Prepare aabb_array for BVH builder
    var aabb_array = new Float32Array(Math.max(9 * N, 8 * (2 * N)));
    var totalWork = new Uint32Array(N);
    for (var i = 0; i < N; i++) {
        var b = sceneBoxes[i];
        aabb_array[9 * i + 0] = b.min[0]; aabb_array[9 * i + 1] = b.min[1]; aabb_array[9 * i + 2] = b.min[2];
        aabb_array[9 * i + 3] = b.max[0]; aabb_array[9 * i + 4] = b.max[1]; aabb_array[9 * i + 5] = b.max[2];
        aabb_array[9 * i + 6] = (b.min[0] + b.max[0]) * 0.5;
        aabb_array[9 * i + 7] = (b.min[1] + b.max[1]) * 0.5;
        aabb_array[9 * i + 8] = (b.min[2] + b.max[2]) * 0.5;
        totalWork[i] = i;
    }

    // 2) Build BVH
    BVH_Build_Iterative(totalWork, aabb_array);
    var nodeCount = buildnodes.length;
    console.log("BVH nodes:", nodeCount, "for", N, "boxes");

    // 3) BVH Texture (512x1, RGBA32F, 2 pixels per node)
    var BVH_TEX_W = 512;
    var bvhArr = new Float32Array(BVH_TEX_W * 1 * 4);
    for (var n = 0; n < nodeCount; n++) {
        bvhArr[(2 * n) * 4 + 0] = aabb_array[8 * n + 0];
        bvhArr[(2 * n) * 4 + 1] = aabb_array[8 * n + 1];
        bvhArr[(2 * n) * 4 + 2] = aabb_array[8 * n + 2];
        bvhArr[(2 * n) * 4 + 3] = aabb_array[8 * n + 3];
        bvhArr[(2 * n + 1) * 4 + 0] = aabb_array[8 * n + 4];
        bvhArr[(2 * n + 1) * 4 + 1] = aabb_array[8 * n + 5];
        bvhArr[(2 * n + 1) * 4 + 2] = aabb_array[8 * n + 6];
        bvhArr[(2 * n + 1) * 4 + 3] = aabb_array[8 * n + 7];
    }
    var bvhDataTexture = new THREE.DataTexture(bvhArr, BVH_TEX_W, 1, THREE.RGBAFormat, THREE.FloatType);
    bvhDataTexture.wrapS = THREE.ClampToEdgeWrapping;
    bvhDataTexture.wrapT = THREE.ClampToEdgeWrapping;
    bvhDataTexture.minFilter = THREE.NearestFilter;
    bvhDataTexture.magFilter = THREE.NearestFilter;
    bvhDataTexture.flipY = false;
    bvhDataTexture.generateMipmaps = false;
    bvhDataTexture.needsUpdate = true;

    // 4) Box Data Texture (512x1, RGBA32F, 5 pixels per box)
    // R2-18：pixel 4 新增 [roughness, metalness, 0, 0]；目前 base 83 box，config 追加後仍 ≤ BVH_TEX_W=512
    var boxArr = new Float32Array(BVH_TEX_W * 1 * 4);
    for (var i = 0; i < N; i++) {
        var b = sceneBoxes[i];
        var p = i * 5;
        boxArr[(p) * 4 + 0] = b.emission[0]; boxArr[(p) * 4 + 1] = b.emission[1];
        boxArr[(p) * 4 + 2] = b.emission[2]; boxArr[(p) * 4 + 3] = b.type;
        boxArr[(p + 1) * 4 + 0] = b.color[0]; boxArr[(p + 1) * 4 + 1] = b.color[1];
        boxArr[(p + 1) * 4 + 2] = b.color[2]; boxArr[(p + 1) * 4 + 3] = b.meta || 0;
        boxArr[(p + 2) * 4 + 0] = b.min[0]; boxArr[(p + 2) * 4 + 1] = b.min[1];
        boxArr[(p + 2) * 4 + 2] = b.min[2]; boxArr[(p + 2) * 4 + 3] = b.cullable || 0;
        boxArr[(p + 3) * 4 + 0] = b.max[0]; boxArr[(p + 3) * 4 + 1] = b.max[1];
        boxArr[(p + 3) * 4 + 2] = b.max[2]; boxArr[(p + 3) * 4 + 3] = b.fixtureGroup || 0; // R2-14：裝置開關分群
        boxArr[(p + 4) * 4 + 0] = b.roughness; boxArr[(p + 4) * 4 + 1] = b.metalness;
        boxArr[(p + 4) * 4 + 2] = 0; boxArr[(p + 4) * 4 + 3] = 0; // R2-18 保留槽位
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
    if (pathTracingUniforms.tBVHTexture) {
        pathTracingUniforms.tBVHTexture.value = bvhDataTexture;
        pathTracingUniforms.tBoxDataTexture.value = boxDataTexture;
    } else {
        pathTracingUniforms.tBVHTexture = { value: bvhDataTexture };
        pathTracingUniforms.tBoxDataTexture = { value: boxDataTexture };
    }
}

function updateBoxDataTexture() {
    var N = sceneBoxes.length;
    var BVH_TEX_W = 512;
    if (pathTracingUniforms.tBoxDataTexture && pathTracingUniforms.tBoxDataTexture.value) {
        var boxArr = pathTracingUniforms.tBoxDataTexture.value.image.data;
        for (var i = 0; i < N; i++) {
            var b = sceneBoxes[i];
            var p = i * 5;
            boxArr[(p) * 4 + 0] = b.emission[0]; boxArr[(p) * 4 + 1] = b.emission[1];
            boxArr[(p) * 4 + 2] = b.emission[2]; boxArr[(p) * 4 + 3] = b.type;
            boxArr[(p + 1) * 4 + 0] = b.color[0]; boxArr[(p + 1) * 4 + 1] = b.color[1];
            boxArr[(p + 1) * 4 + 2] = b.color[2]; boxArr[(p + 1) * 4 + 3] = b.meta || 0;
            boxArr[(p + 2) * 4 + 0] = b.min[0]; boxArr[(p + 2) * 4 + 1] = b.min[1];
            boxArr[(p + 2) * 4 + 2] = b.min[2]; boxArr[(p + 2) * 4 + 3] = b.cullable || 0;
            boxArr[(p + 3) * 4 + 0] = b.max[0]; boxArr[(p + 3) * 4 + 1] = b.max[1];
            boxArr[(p + 3) * 4 + 2] = b.max[2]; boxArr[(p + 3) * 4 + 3] = b.fixtureGroup || 0;
            boxArr[(p + 4) * 4 + 0] = b.roughness; boxArr[(p + 4) * 4 + 1] = b.metalness;
        }
        pathTracingUniforms.tBoxDataTexture.value.needsUpdate = true;
    }
}

function applyPanelConfig(config) {
    if (typeof invalidateMovementProtectionStableFrame === 'function') {
        invalidateMovementProtectionStableFrame('applyPanelConfig');
    }
    sceneBoxes.length = BASE_BOX_COUNT;
    // R4-4-fix05：CONFIG 3 拆成「3=只 Cloud 漫射燈」+「4=只 軌道+廣角燈」；兩者吸音環境相同（全吸音）
    // 1: 吸頂燈 + 牆面吸音板（3 片）
    // 2: 吸頂燈 + 牆面吸音板（9 片配色 2）
    // 3: 全吸音 + Cloud 燈條（全亮好工作）
    // 4: 全吸音 + 軌道+廣角燈（冷暖有氣氛）
    if (config === 1) {
        panelConfig1.forEach(function (p) {
            addBox(p.min, p.max, z3, p.color, 10, p.meta, p.cullable);
        });
    } else if (config === 2 || config === 3 || config === 4) {
        panelConfig2.forEach(function (p) {
            addBox(p.min, p.max, z3, p.color, 10, p.meta, p.cullable);
        });
    }
    // Cloud 吊頂板 + 吸頂燈撤場：config 3/4 同樣處理（全吸音環境）
    var fullAbsorb = (config === 3 || config === 4);
    var cloudLampOn = (config === 3);  // 只 CONFIG 3 開 Cloud 燈條
    var trackLampOn = (config === 4);  // 只 CONFIG 4 開軌道+廣角燈
    if (pathTracingUniforms && pathTracingUniforms.uCloudPanelEnabled) {
        pathTracingUniforms.uCloudPanelEnabled.value = fullAbsorb ? 1.0 : 0.0;
    }
    if (pathTracingUniforms && pathTracingUniforms.uCloudLightEnabled) {
        pathTracingUniforms.uCloudLightEnabled.value = cloudLampOn ? 1.0 : 0.0;
    }
    if (pathTracingUniforms && pathTracingUniforms.uTrackLightEnabled) {
        pathTracingUniforms.uTrackLightEnabled.value = trackLampOn ? 1.0 : 0.0;
    }
    if (pathTracingUniforms && pathTracingUniforms.uWideTrackLightEnabled) {
        pathTracingUniforms.uWideTrackLightEnabled.value = trackLampOn ? 1.0 : 0.0;
    }
    if (pathTracingUniforms && pathTracingUniforms.uCeilingLampPos) {
        pathTracingUniforms.uCeilingLampPos.value.z = fullAbsorb ? 100.0 : 0.591; // CONFIG 3/4: push outside room
    }
    // 吸頂燈：config 1/2 開（900 lm），config 3/4 拆除（0 lm 且整段 DOM 隱藏）
    basicBrightness = fullAbsorb ? 0 : 900;
    var brightnessDiv = document.getElementById('slider-brightness');
    if (brightnessDiv) {
        brightnessDiv.style.display = fullAbsorb ? 'none' : '';
    }
    if (fullAbsorb) {
        setSliderValue('slider-brightness', 0);
    } else {
        setSliderEnabled('slider-brightness', true);
        setSliderLabel('slider-brightness', '吸頂主燈');
        setSliderValue('slider-brightness', 900);
    }
    // GUI checkbox 同步：config 3 只勾 Cloud；config 4 只勾 track/wide；config 1/2 全不勾
    setCheckboxChecked('chkCloud', cloudLampOn);
    setCheckboxChecked('chkTrack', trackLampOn);
    setCheckboxChecked('chkTrackWideSouth', trackLampOn);
    setCheckboxChecked('chkTrackWideNorth', trackLampOn);
    syncWideEmissions();
    // R6 LGG-r30：stateful per-config 切換
    //   離開舊 config 時 snapshot 當前 slider 狀態
    //   進入新 config：若有 snapshot 則恢復，否則套 configPostDefaults 初值
    var oldConfig = currentPanelConfig;
    if (oldConfig !== config) {
        var leavingSnap = snapshotCurrentConfigPost();
        if (leavingSnap) configState[oldConfig] = leavingSnap;
    }
    currentPanelConfig = config;
    var targetPost = configState[config] || configPostDefaults[config];
    applyConfigPost(targetPost);
    buildSceneBVH();
    needClearAccumulation = true;
    cameraIsMoving = true;
    cameraSwitchFrames = 3; // 讓 updateVariablesAndUniforms 持續 3 幀重置累積緩衝區
    // R3-1 fix01：computeLightEmissions() 原本掛於此（供 R3-3 dirty-flag 鉤點），
    // 但 applyPanelConfig(1) 在 initSceneData 中段（L655）即被呼叫，
    // 此時 uCloudEmission 等 uniform 尚未宣告（L856~859），
    // 呼叫會拋 TypeError 中斷初始化 → GUI 消失、canvas 全黑。
    // 故 R3-1 只保留 initSceneData L894 uniform 宣告後的單次呼叫，
    // R3-3 接手時再於此處重建 Config 切換 dirty-flag 鉤點。

    // R3-2-fix01：Config 切換 → 吸頂燈滑桿 + R3 4 dropdown 的 enable/disable 同步。
    syncR3ColorUIEnable();
    rebuildActiveLightLUT('applyPanelConfig');

    // R6 LGG-r30：per-config stateful 切換已在 currentPanelConfig 切換處（line ~402）處理
    // 第一次進該 config 用 configPostDefaults；切回已訪問過的 config 恢復離開前 slider 狀態

    // R4-2 CONFIG radio: 同步 DOM radio 狀態 + 描述文字
    var configRadio = document.getElementById('btnConfig' + config);
    if (configRadio) configRadio.checked = true;
    var descEl = document.getElementById('config-desc');
    if (descEl) {
        var descs = {
            1: '吸頂燈 + 牆面吸音板',
            2: '吸頂燈 + 牆面吸音板（配色 2）',
            3: '全吸音 + 僅 Cloud 漫射燈（全亮好工作）',
            4: '全吸音 + 軌道+廣角燈（冷暖有氣氛）'
        };
        descEl.textContent = descs[config] || '';
    }

    // UI decoupling logic for GIK map based on config
    if (config === 1) {
        var elCeil = document.getElementById('row-ceil'); if (elCeil) elCeil.style.display = 'none';
        ['blk-n1', 'blk-n3', 'blk-e1', 'blk-e3', 'blk-w1', 'blk-w3'].forEach(function(id) {
            var e = document.getElementById(id);
            if (e) e.style.display = 'none';
        });
    } else if (config === 2) {
        var elCeil = document.getElementById('row-ceil'); if (elCeil) elCeil.style.display = 'none';
        ['blk-n1', 'blk-n3', 'blk-e1', 'blk-e3', 'blk-w1', 'blk-w3'].forEach(function(id) {
            var e = document.getElementById(id);
            if (e) e.style.display = '';
        });
    } else if (config === 3 || config === 4) {
        var elCeil = document.getElementById('row-ceil'); if (elCeil) elCeil.style.display = 'flex';
        ['blk-n1', 'blk-n3', 'blk-e1', 'blk-e3', 'blk-w1', 'blk-w3'].forEach(function(id) {
            var e = document.getElementById(id);
            if (e) e.style.display = '';
        });
    }
    
    if (window.reapplyGikColors) {
        window.reapplyGikColors();
    }
}

// R4-1 / R4-4-fix05 / R4-4-fix08：依 currentPanelConfig 同步燈光面板顯隱。
// Config 1/2: 吸頂燈 → 燈光 section 全隱藏
// Config 3: 只 Cloud 顯示（軌道/廣角隱藏）
// Config 4: 三段全顯示（Cloud 預設 chkCloud=0 可手動補光）
function setSectionVisible(sectionId, visible) {
    var sec = document.getElementById(sectionId);
    if (!sec) return;
    sec.style.display = visible ? '' : 'none';
}
function syncR3ColorUIEnable() {
    var cfg = currentPanelConfig;
    var cloudSectionVisible = (cfg === 3 || cfg === 4);
    var trackSectionVisible = (cfg === 4);
    setSectionVisible('cloud-section', cloudSectionVisible);
    setSectionVisible('track-section', trackSectionVisible);
    setSectionVisible('wide-section',  trackSectionVisible);
    syncSectionInactiveState();
}

// R4-4-fix10：未勾 checkbox 時 section 子內容套 inactive class（CSS 灰階 + pointer-events disable）
function syncSectionInactiveState() {
    var cl = document.getElementById('chkCloud');
    var tr = document.getElementById('chkTrack');
    var ws = document.getElementById('chkTrackWideSouth');
    var wn = document.getElementById('chkTrackWideNorth');
    var cloudSec = document.getElementById('cloud-section');
    var trackSec = document.getElementById('track-section');
    var wideSec  = document.getElementById('wide-section');
    if (cloudSec) cloudSec.classList.toggle('inactive', !(cl && cl.checked));
    if (trackSec) trackSec.classList.toggle('inactive', !(tr && tr.checked));
    var anyWide = (ws && ws.checked) || (wn && wn.checked);
    if (wideSec) wideSec.classList.toggle('inactive', !anyWide);
}

// R2-6 旋轉物件定義（center, halfSize, rotY, color）
const rotatedObjects = [
    // 左聲道
    { name: 'uLeftSpeakerInvMatrix', center: [-0.56825, 1.0965, 0.9842], half: [0.1125, 0.1725, 0.1365], rotY: -Math.PI / 6, color: C_SPEAKER },
    { name: 'uLeftStandBaseInvMatrix', center: [-0.56825, 0.015, 0.9842], half: [0.125, 0.015, 0.15], rotY: -Math.PI / 6, color: C_STAND },
    { name: 'uLeftStandPillarInvMatrix', center: [-0.56825, 0.46, 0.9842], half: [0.02, 0.43, 0.05], rotY: -Math.PI / 6, color: C_STAND_PILLAR },
    { name: 'uLeftStandTopInvMatrix', center: [-0.56825, 0.89, 0.9842], half: [0.10, 0.01, 0.125], rotY: -Math.PI / 6, color: C_STAND },
    // 右聲道
    { name: 'uRightSpeakerInvMatrix', center: [0.56825, 1.0965, 0.9842], half: [0.1125, 0.1725, 0.1365], rotY: Math.PI / 6, color: C_SPEAKER },
    { name: 'uRightStandBaseInvMatrix', center: [0.56825, 0.015, 0.9842], half: [0.125, 0.015, 0.15], rotY: Math.PI / 6, color: C_STAND },
    { name: 'uRightStandPillarInvMatrix', center: [0.56825, 0.46, 0.9842], half: [0.02, 0.43, 0.05], rotY: Math.PI / 6, color: C_STAND_PILLAR },
    { name: 'uRightStandTopInvMatrix', center: [0.56825, 0.89, 0.9842], half: [0.10, 0.01, 0.125], rotY: Math.PI / 6, color: C_STAND },
];
const rotatedMeshes = [];

let samplesPerFrame = 1.0;

const CAMERA_PRESETS = {
    cam1: { position: { x: -1.4, y: 2.3, z: 3.9 }, pitch: -0.18, yaw: -0.40 },
    cam2: { position: { x: -0.9, y: 1.1, z: 3.7 }, pitch: 0.3, yaw: -0.25 },
    cam3: { position: { x: 0.0, y: 1.3, z: -1.0 }, pitch: 0.0, yaw: -Math.PI }
};
let currentCameraPreset = 'cam1';
let basicBrightness = 900.0;
let colorTemperature = 4000;

// ---------------- R3-2-fix01 色溫 mode state（三檔 preset + 商品規格映射）----------------
// mode 值依商品規格離散化（docs/R3_燈具產品規格.md）；三方對照（舊專案 HTML / 商品規格 / 本專案）一致。
// trackKelvin[0..3] 對應 NW / NE / SW / SE（見 L909-914 uTrackLampPos 順序）。
// trackWideKelvin[0]=南（z=2.1）、[1]=北（z=-1.1）（見 L927-930 uTrackWideLampPos 順序）。
const CLOUD_MODE_K = { WARM: 3000, NEUTRAL: 4000, COLD: 6500 };  // LED 軟條燈（4 款取 3）
const TRACK_MODE_K = { WARM: 3000, NEUTRAL: 4000, COLD: 6000 };  // 22W COB 軌道燈
const WIDE_MODE_K  = { WARM: 3000, NEUTRAL: 4000, COLD: 6000 };  // 25W 廣角燈
let cloudColorMode      = 'NEUTRAL';
let trackColorMode      = 'WARM_COLD';  // 預設北暖南冷
let trackWideColorSouth = 'NEUTRAL';
let trackWideColorNorth = 'NEUTRAL';
let cloudKelvin     = CLOUD_MODE_K.NEUTRAL;
// trackKelvin[0..3] 對應 NW/NE/SW/SE；北=0,1、南=2,3；初值與 trackColorMode='WARM_COLD' 對齊
let trackKelvin     = [TRACK_MODE_K.WARM, TRACK_MODE_K.WARM, TRACK_MODE_K.COLD, TRACK_MODE_K.COLD];
let trackWideKelvin = [WIDE_MODE_K.NEUTRAL, WIDE_MODE_K.NEUTRAL];
// R4-1: color ctrl refs（R4-3 will assign; currently null）
let cloudColorCtrl           = null;
let trackColorCtrl           = null;
let trackLumensCtrl          = null;
let trackWideColorSouthCtrl  = null;
let trackWideColorNorthCtrl  = null;
let trackWideLumensCtrl      = null;

// ---------------- R3-1 Photometry Pipeline ----------------
/**
 * Luminous flux (lm) + FULL beam angle (deg, 邊到邊全錐角) → peak axial candela.
 *
 * 警示：第二參數為「全錐角」，非半角。
 * 內部自除 2：sr = 2π(1 - cos(fullBeamAngleDeg/2 · π/180))。
 * 若改為半角語義，§6.a 斷言三組期望值（2375.90 / 37206.86 / 636.62）必須整組重算。
 * 舊專案 Path Tracking 260412a 5.4 Clarity.html:1752 原型（同全錐角語義）。
 */
function lumenToCandela(lm, fullBeamAngleDeg) {
    const halfDeg = Math.max(0.01, fullBeamAngleDeg / 2);
    const halfRad = halfDeg * Math.PI / 180;
    return lm / (2 * Math.PI * (1 - Math.cos(halfRad)));
}

/**
 * Candela + emitter surface area (m²) → radiance proxy (cd/m²).
 * 注意：此為中繼量，R3-3/4 時須再乘以 (1/π) 補 Lambertian 因子，否則過亮 3.14×。
 * 本階段 R3-1 不直接使用，留予 R3-3/4 承接。
 */
function candelaToRadiance(cd, emitterAreaM2) {
    if (!Number.isFinite(cd)) return 0;
    const A = Math.max(emitterAreaM2, 1e-8);
    return cd / A;
}

/**
 * Luminous flux (lm) + color temperature (K) → electrical watts proxy.
 * 採查表 K(T) lm/W；R3-5 MIS 歸一時若需 radiant flux 可再乘 683 轉 W。
 */
function lumensToWatts(lm, kelvin) {
    return lm / kelvinToLuminousEfficacy(kelvin);
}

/**
 * Luminous efficacy K(T) lm/W，階梯式 LUT。
 * 資料來源：CIE 15:2004 Table T.3 / Philips LED 商品 spec 平均值。
 */
function kelvinToLuminousEfficacy(kelvin) {
    if (kelvin <= 2700) return 280;
    if (kelvin <= 3000) return 300;
    if (kelvin <= 4000) return 320;
    if (kelvin <= 5000) return 330;
    if (kelvin <= 6500) return 340;
    return 350;
}

/**
 * R6-3 Phase 1C：Cloud rod 1/4 圓弧 diffuser radiance W/(sr·m²)。
 * 實物為 16mm 角落鋁槽，發光面近似半徑 16mm 的 1/4 圓弧：
 * A_arc = (π/2) · A_face，其中 A_face = 0.016 · rodLength。
 * Lambertian 面光源：Φ = K(T) · π · A_arc · L。
 * → L = Φ_rod / (K(T) · π · A_arc)。
 */
function computeCloudRadiance(lm_total, kelvin, faceArea) {
    if (!Number.isFinite(lm_total) || lm_total <= 0) return 0;
    const K = kelvinToLuminousEfficacy(kelvin);
    const arcArea = Math.max(faceArea * CLOUD_ARC_AREA_SCALE, 1e-8);
    return lm_total / (K * Math.PI * arcArea);
}

// ---------------- R3-4 Track spot lamp constants & radiance ----------------
// 產品規格 docs/R3_燈具產品規格.md §3 22W COB 軌道燈：2000 lm 單盞、Varilumi zoom 15°~60° 全角範圍。
// Beam 語義單一定案（plan §4.6）：inner 半角 15°、outer 半角 30°、全角 = outer × 2 = 60°。
const TRACK_LAMP_EMITTER_AREA = Math.PI * 0.03 * 0.03;     // ≈ 2.827e-3 m²（半徑 3cm 圓盤）
const TRACK_LAMP_LUMENS_MAX = 2000;                          // 單盞最大流明（商品規格上限，GUI slider 上界）
let   trackLumens           = TRACK_LAMP_LUMENS_MAX;         // R3-4 fix06：GUI 可變（4 盞同值），預設等於規格最大
const TRACK_BEAM_INNER_HALF_DEG = 15;                        // smoothstep 邊緣平滑起點 cos_inner
const TRACK_BEAM_OUTER_HALF_DEG = 30;                        // smoothstep 邊緣衰減終點 cos_outer
const TRACK_BEAM_FULL_DEG = TRACK_BEAM_OUTER_HALF_DEG * 2;   // 全角 60°（lumenToCandela beamFullDeg 輸入）
const TRACK_LAMP_ID_BASE = 400;                              // shader uTrackLampIdBase 雙源同步契約
const TRACK_BEAM_COS_INNER = Math.cos(TRACK_BEAM_INNER_HALF_DEG * Math.PI / 180); // ≈ 0.9659
const TRACK_BEAM_COS_OUTER = Math.cos(TRACK_BEAM_OUTER_HALF_DEG * Math.PI / 180); // ≈ 0.8660

/**
 * R4-4 Plan v5：投射燈中心 candela 反冪律擬合（飛利明Varilumi 22W COB 軌道燈）。
 * 規格來源 docs/R3_燈具產品規格.md L79：15° → 4800 cd / 60° → 1600 cd @ 2000 lm（比例精確 3x）。
 * 擬合公式 cd(θ) = a × θ^b：b = log(1/3) / log(4) = -0.7925；a = 4800 × 15^0.7925 ≈ 41696。
 * 線性比例推廣到任意光通量：cd(θ, 光通量) = a × θ^b × (光通量 / 2000)。
 * 量綱說明：輸出僅含 candela（lm/sr），不含面積 / π 因子；由 computeTrackRadiance 轉換成 radiance。
 * 驗算：trackLampCandela(2000, 15) / trackLampCandela(2000, 60) ≈ 3.00 ✓（I5 斷言）。
 */
function trackLampCandela(lumens, beamFullDeg) {
    const a = 41696, b = -0.7925;
    const theta = Math.max(1e-3, beamFullDeg);
    return a * Math.pow(theta, b) * (lumens / 2000);
}

/**
 * R3-4 fix07 / R4-4-fix02：軌道投射燈 emitter radiance W/(sr·m²)。
 *
 * 兩條路徑，**量綱各自嚴格對齊**，勿混：
 *
 *   [cd 路徑，主]   L = cd / (K · A)
 *     cd = trackLampCandela(lm, beamFullDeg)  單位 [lm/sr]（已是方向性強度）
 *     /K    ：[lm/sr] · [W/lm] = [W/sr]      （光視效率 photometric→radiometric）
 *     /A    ：[W/sr] / [m²]    = [W/(sr·m²)] （除發光面積得 radiance）
 *     **不除 π**：cd 已是 per-steradian 的方向強度，不是 Lambertian 面光源總 Φ。
 *
 *   [Φ 路徑，fallback]  L = Φ / (K · π · A)
 *     用於 beamFullDeg 無效時（採 Lambertian 面光源模型：Φ_total 均分到半球各方向）。
 *     /π：Lambertian 積分常數（Φ = π · A · L 的反算）。
 *
 * 歷史教訓（R4-4-fix01）：cd 路徑誤寫 `cd/(K·π·A)` 多除 π，投射燈暗 12.9%（整體刷白、
 * 冷暖對比淡化、桌子偏暗）。cd 路徑不得加 /π，否則量綱錯（多做一次 Lambertian 分攤）。
 *
 * beam 形狀 smoothstep 由 shader 承擔；本函式僅輸出中心軸 radiance。
 */
function computeTrackRadiance(lm, T_K, A_m2, beamFullDeg) {
    if (!Number.isFinite(lm) || lm <= 0) return 0;
    const K = kelvinToLuminousEfficacy(T_K);
    const A = Math.max(A_m2, 1e-8);
    if (Number.isFinite(beamFullDeg) && beamFullDeg > 0) {
        const cd = trackLampCandela(lm, beamFullDeg);
        return cd / (K * A);  // cd 路徑：不除 π
    }
    // Φ 路徑 fallback：Lambertian 面光源模型（舊 R3-4 基準）
    return lm / (K * Math.PI * A);
}
// ---------------- /R3-4 Track spot lamp constants & radiance ----------------

// ---------------- R3-5a Track wide lamp constants & radiance ----------------
// 產品規格 docs/R3_燈具產品規格.md §4 25W 廣角散光軌道燈：2500 lm 單盞、全角 120°（半角 60°）固定、r=5cm 圓盤。
// Beam 語義（plan §R3-5a）：inner 半角 55°、outer 半角 60°、全角 = outer × 2 = 120°。
const TRACK_WIDE_LAMP_EMITTER_AREA = Math.PI * 0.05 * 0.05;         // ≈ 7.854e-3 m²（半徑 5cm 圓盤）
const TRACK_WIDE_LAMP_LUMENS_MAX   = 2500;                          // 單盞最大流明（商品規格上限）
let   trackWideLumens              = TRACK_WIDE_LAMP_LUMENS_MAX;    // GUI 可變（2 盞同值）
const TRACK_WIDE_BEAM_INNER_HALF_DEG = 55;                          // smoothstep 邊緣平滑起點 cos_inner
const TRACK_WIDE_BEAM_OUTER_HALF_DEG = 60;                          // smoothstep 邊緣衰減終點 cos_outer
const TRACK_WIDE_BEAM_FULL_DEG       = TRACK_WIDE_BEAM_OUTER_HALF_DEG * 2; // 全角 120°
const TRACK_WIDE_LAMP_ID_BASE        = 700;                         // shader uTrackWideLampIdBase 雙源同步契約（避開 400 spot emitter / 500 wide housing / 600 spot housing）
const TRACK_WIDE_BEAM_COS_INNER = Math.cos(TRACK_WIDE_BEAM_INNER_HALF_DEG * Math.PI / 180); // ≈ 0.5736
const TRACK_WIDE_BEAM_COS_OUTER = Math.cos(TRACK_WIDE_BEAM_OUTER_HALF_DEG * Math.PI / 180); // = 0.5

/**
 * R3-5a：軌道廣角燈 emitter radiance W/(sr·m²)。
 * 公式 L = Φ / (K · π · A)（對齊 R3-4 computeTrackRadiance / R3-3 computeCloudRadiance 量綱契約）。
 * beam 形狀由 shader smoothstep(cos_outer, cos_inner, cos_ax) 承擔，不影響 radiance 量綱。
 * beamFullDeg 保留簽名以相容測試與未來 MIS 升級（R3-6 可於 disk area 採樣契約時消費）。
 */
function computeTrackWideRadiance(lm, T_K, A_m2, beamFullDeg) {
    if (!Number.isFinite(lm) || lm <= 0) return 0;
    const K = kelvinToLuminousEfficacy(T_K);
    const A = Math.max(A_m2, 1e-8);
    return lm / (K * Math.PI * A);
}
// ---------------- /R3-5a Track wide lamp constants & radiance ----------------
// ---------------- /R3-1 Photometry Pipeline ----------------

// ---------------- R4-4 甜蜜點 UI 狀態變數 + sceneBoxes 具名索引 ----------------
// Plan v5 定案：守則 1 介面 1:1 對齊舊專案；這 10 個狀態變數由 initUI 滑桿即時寫入，
// recomputeTrack*/Wide* 函式搬運至 uniform / sceneBoxes。光束角為全角 deg（shader cos 由 JS 算）。
//
// 公式備註（SOP L690/L700）：
//   trackBaseX  = 0.90 + v（v=0.05~0.90，預設 0.05 → 0.95）
//   trackWideZ  = v（v=0.05~1.15，預設 0.40）「距 Cloud 邊距」語義（選項 C 定案）：
//                 使用者原話「讓設計師或師傅現場施工時比較好抓距離」。
//                 南軌 z = z_cloud_south + v = 1.698 + v
//                 北軌 z = z_cloud_north - v = -0.702 - v
//                 v=0.40 預設 → 南軌 z=2.098 / 北軌 z=-1.102（保 R2-15 採購視覺基準）
//                 v=1.15 上界 → 北軌 z=-1.852（距北牆內面 z=-1.874 安全邊界 22mm）
let trackBeamInner       = 40;     // 投射燈光束角（內）全角 deg — R4-4-fix06：30→40（COB 硬邊照明典型內緣）
let trackBeamOuter       = 60;     // 投射燈光束角（外）全角 deg — R4-4-fix06：55→60（貼齊商規 1600 cd 基準 + cd(2000,60)=1625）
let trackTilt            = 45;     // 投射燈傾斜角 deg（由軌道中心往外側傾斜）
let trackSpacing         = 150;    // 投射燈 N-S 間距 cm（中心 z_mid=0.498 半距 d=spacing/200 m）
let trackBaseX           = 0.95;   // 投射燈軌道 x 絕對位置（滑桿值 v=0.05 對應 0.90 + 0.05）
let trackWideBeamInner   = 90;     // 廣角燈光束角（內）全角 deg — R4-4-fix06：95→90（散光柔和內緣）
let trackWideBeamOuter   = 120;    // 廣角燈光束角（外）全角 deg — 廠商規格書固定 120°，不進反冪律
let trackWideTiltSouth   = 30;     // 廣角燈南側傾斜角 deg（R4-4-fix04：避 Cam3 視野高光點）
let trackWideTiltNorth   = -30;    // 廣角燈北側傾斜角 deg（R4-4-fix03 甜蜜點：-25→-30）
let trackWideZ           = 0.20;   // 廣角燈距 Cloud 邊距 m（R4-4-fix03 甜蜜點：0.40→0.20，貼近 Cloud 邊緣）

// sceneBoxes 具名索引：避免硬編碰撞既有 base 幾何與未來新增幾何
// R4-4 fix：原誤寫 37/41/45/47（邏輯 ID，對應舊 plan 註解）→ 實際 sceneBoxes index 為 53/57/61/63
// 錯因：plan 註解「37 西軌底座北半」屬邏輯編號，但 addBox 實押 sceneBoxes index 受複合物件影響
//       （0a/0c/0d.. 地面 7 片、1a/1c/1d.. 天花板 7 片、2a/2b 北牆裂塊、6a/6b 南牆裂塊等每子塊各 push 一次）
// 實證計數（見本檔 L76-197 addBox 序列）：
//   idx [0..6]   地面 7 片        idx [7..13]  天花板 7 片
//   idx [14..18] 北牆 5 片         idx [19]     東牆
//   idx [20..24] 南牆 5 片         idx [25..27] 西牆 3 片
//   idx [28..31] 樑 / 角柱 4 片    idx [32..36] 傢俱 5 片
//   idx [37..40] 西南抽屜 4 格     idx [41..43] 門 + 窗景 3 片
//   idx [44]     KH750 超低音      idx [45..50] 插座 6 片
//   idx [51..52] 冷氣 2 片
//   idx [53..56] 投射燈軌道底座（fixtureGroup=1）→ TRACK_BASE_IDX = 53
//   idx [57..60] 投射燈支架（fixtureGroup=1）    → TRACK_STAND_IDX = 57
//   idx [61..62] 廣角燈軌道（fixtureGroup=2）    → TRACK_WIDE_BASE_IDX = 61
//   idx [63..64] 廣角燈支架（fixtureGroup=2）    → TRACK_WIDE_STAND_IDX = 63
//   idx [65..70] Cloud 吸音板 6 片
//   idx [71..74] Cloud 燈條 4 支 ← CLOUD_BOX_IDX_BASE = 71 之基準
//   idx [75..82] Cloud 鋁槽不發光鋁板 8 片
const TRACK_BASE_IDX       = 53;
const TRACK_STAND_IDX      = 57;
const TRACK_WIDE_BASE_IDX  = 61;
const TRACK_WIDE_STAND_IDX = 63;
// throw-first assertion：任何未來新增幾何插入中段時索引錯位立即爆炸（對齊 L187 CLOUD_BOX_IDX_BASE 守護模式）
if (sceneBoxes[TRACK_BASE_IDX].fixtureGroup !== 1) {
    throw new Error('[R4-4] TRACK_BASE_IDX 錯位；sceneBoxes[' + TRACK_BASE_IDX + '] 期望 Track 底座 fixtureGroup=1，實得 ' + sceneBoxes[TRACK_BASE_IDX].fixtureGroup);
}
if (sceneBoxes[TRACK_STAND_IDX].fixtureGroup !== 1) {
    throw new Error('[R4-4] TRACK_STAND_IDX 錯位；sceneBoxes[' + TRACK_STAND_IDX + '] 期望 Track 支架 fixtureGroup=1，實得 ' + sceneBoxes[TRACK_STAND_IDX].fixtureGroup);
}
if (sceneBoxes[TRACK_WIDE_BASE_IDX].fixtureGroup !== 2) {
    throw new Error('[R4-4] TRACK_WIDE_BASE_IDX 錯位；sceneBoxes[' + TRACK_WIDE_BASE_IDX + '] 期望 Wide 軌道 fixtureGroup=2，實得 ' + sceneBoxes[TRACK_WIDE_BASE_IDX].fixtureGroup);
}
if (sceneBoxes[TRACK_WIDE_STAND_IDX].fixtureGroup !== 2) {
    throw new Error('[R4-4] TRACK_WIDE_STAND_IDX 錯位；sceneBoxes[' + TRACK_WIDE_STAND_IDX + '] 期望 Wide 支架 fixtureGroup=2，實得 ' + sceneBoxes[TRACK_WIDE_STAND_IDX].fixtureGroup);
}
// ---------------- /R4-4 ----------------

let wallAlbedo = 0.75;

// acousticPanelVisibility 已被 R2-8 Config 1/Config 2 切換取代

let bloomIntensity = 0.025;
// R2-UI：bloom pyramid 層數（Jimenez / Unreal / Blender Eevee），取代舊 radius slider
//   層數多 → halo 廣、柔；少 → halo 集中、窄
let bloomMipCount = 7;

const MAX_SAMPLES = 1000;
let uiLocked = false;
let SNAPSHOT_CAPTURE_ENABLED = false;
const SNAPSHOT_MILESTONES = [];
const SNAPSHOT_MILESTONE_PRESET = [1, 2, 3, 4, 5, 6, 7, 8, 16, 24, 32, 48, 64, 80, 100, 150, 200, 300, 500, 750, 1000];
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
    if (!SNAPSHOT_CAPTURE_ENABLED) return null;
    renderer.setRenderTarget(null);
    renderer.render(screenOutputScene, orthoCamera);
    const offscreen = document.createElement('canvas');
    offscreen.width = 2560;
    offscreen.height = 1440;
    offscreen.getContext('2d').drawImage(renderer.domElement, 0, 0, 2560, 1440);
    return offscreen.toDataURL('image/png');
}

const CLOUD_VISIBILITY_PROBE_ROD_LABELS = ['E', 'W', 'S', 'N'];
const CLOUD_VISIBILITY_PROBE_VERSION = 'r6-3-phase2-sampling-budget-diagnostic';
const CLOUD_THETA_IMPORTANCE_CANDIDATE_VERSION = 'r6-3-phase2-theta-importance-candidate-v1';
const CLOUD_THETA_IMPORTANCE_AB_VERSION = 'r6-3-phase2-theta-importance-probe-ab-v1';
const CLOUD_THETA_IMPORTANCE_STRENGTH_SWEEP_VERSION = 'r6-3-phase2-theta-importance-strength-sweep-v1';
const CLOUD_THETA_IMPORTANCE_SHADER_AB_VERSION = 'r6-3-phase2-theta-importance-shader-ab-v1';
const CLOUD_SAMPLING_BUDGET_DIAGNOSTIC_VERSION = 'r6-3-phase2-sampling-budget-diagnostic-v1';
const CLOUD_MIS_WEIGHT_PROBE_VERSION = 'r6-3-phase2-first-frame-burst-v19';
const CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_STRENGTH = 1.0;
const CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_MAX_SAMPLES = 64;
const CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_FLOOR_LUMA = 0.06116075;
const CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_GIK_LUMA = 0.01231235;
const CLOUD_MIS_WEIGHT_PROBE_MODE_LABELS = ['off', 'directNeeWeight', 'directNeePdf', 'bsdfHitWeight', 'bsdfHitPdf', 'directNeeContribution', 'bsdfHitContribution', 'bsdfHitContributionSentinel', 'probeUniformSentinel', 'contributionUniformSentinel', 'forcedBsdfHitSentinel', 'forcedBsdfHitContribution', 'forcedBsdfHitPdf', 'forcedBsdfHitWeight'];
let cloudMisWeightProbeDisplayMode = 0;
const CLOUD_DIRECT_NEE_SCREEN_BANDS = [
    { label: 'top', start: 0.0, end: 0.25 },
    { label: 'upperMid', start: 0.25, end: 0.5 },
    { label: 'lowerMid', start: 0.5, end: 0.75 },
    { label: 'bottom', start: 0.75, end: 1.0 }
];
const CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_HISTOGRAM_BINS = 512;
const CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_LOG_MIN = -20;
const CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_LOG_MAX = 12;
const CLOUD_VISIBLE_SURFACE_HOTSPOT_CLASSES = [
    { label: 'floor', contributionMode: 12, visiblePixelMode: 17 },
    { label: 'gikPanel', contributionMode: 13, visiblePixelMode: 18 },
    { label: 'ceiling', contributionMode: 14, visiblePixelMode: 19 },
    { label: 'wall', contributionMode: 15, visiblePixelMode: 20 },
    { label: 'object', contributionMode: 16, visiblePixelMode: 21 }
];
const CLOUD_DARK_VISIBLE_SURFACE_HOTSPOT_SOURCE_CLASSES = [
    { visibleSurface: 'floor', sourceSurface: 'floor', contributionMode: 22, visiblePixelMode: 17 },
    { visibleSurface: 'floor', sourceSurface: 'gikPanel', contributionMode: 23, visiblePixelMode: 17 },
    { visibleSurface: 'floor', sourceSurface: 'ceiling', contributionMode: 24, visiblePixelMode: 17 },
    { visibleSurface: 'floor', sourceSurface: 'wall', contributionMode: 25, visiblePixelMode: 17 },
    { visibleSurface: 'floor', sourceSurface: 'object', contributionMode: 26, visiblePixelMode: 17 },
    { visibleSurface: 'gikPanel', sourceSurface: 'floor', contributionMode: 27, visiblePixelMode: 18 },
    { visibleSurface: 'gikPanel', sourceSurface: 'gikPanel', contributionMode: 28, visiblePixelMode: 18 },
    { visibleSurface: 'gikPanel', sourceSurface: 'ceiling', contributionMode: 29, visiblePixelMode: 18 },
    { visibleSurface: 'gikPanel', sourceSurface: 'wall', contributionMode: 30, visiblePixelMode: 18 },
    { visibleSurface: 'gikPanel', sourceSurface: 'object', contributionMode: 31, visiblePixelMode: 18 }
];
const CLOUD_THETA_IMPORTANCE_SHADER_AB_PROTECTED_FLOOR = 0.5;
const CLOUD_VISIBILITY_PROBE_THETA_BIN_COUNT_DEFAULT = 8;
const CLOUD_VISIBILITY_PROBE_CLASS_LABELS = [
    'zeroContribution',
    'correctCloudRod',
    'wrongCloudRod',
    'cloudAluminium',
    'cloudGikPanel',
    'sameAcousticPanel',
    'northAcousticPanel',
    'eastAcousticPanel',
    'westAcousticPanel',
    'roomShell',
    'otherSceneObject',
    'miss',
    'zeroSourceMask',
    'zeroSourceFacing',
    'zeroCloudFacing',
    'zeroFacingBoth',
    'zeroOther'
];
const CLOUD_VISIBILITY_PROBE_CLASS_COLORS = [
    [1, 1, 1],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 0],
    [0, 1, 1],
    [0, 0.35, 0],
    [0.45, 1, 0.45],
    [0.25, 0.8, 0.25],
    [0.65, 1, 0.65],
    [1, 0, 1],
    [1, 0.5, 0],
    [1, 0, 0],
    [0.15, 0.9, 0.15],
    [0.4, 1, 0],
    [0, 0.85, 0.45],
    [0.65, 1, 0],
    [0, 0.55, 0.2]
];
const CLOUD_FACING_DIAGNOSTIC_LABELS = [
    'sourceFacingZero',
    'normalCloudFacingZero',
    'probeCloudFacingZero'
];
const CLOUD_FACING_DIAGNOSTIC_DEFINITIONS = {
    sourceFacingZero: 'shadePointNormal',
    normalCloudFacingZero: 'cloudArcNormal',
    probeCloudFacingZero: 'cloudArcEmissionNormal',
    legacyZeroCloudFacingAlias: 'probeCloudFacingZero',
    renderEnergyNormal: 'cloudArcNormal',
    probeClassificationNormal: 'cloudArcEmissionNormal'
};

function normalizeCloudVisibilityProbeMode(mode) {
    const n = Number(mode);
    if (!Number.isFinite(n)) return mode ? 1 : 0;
    return Math.max(0, Math.min(4, Math.trunc(n)));
}

function normalizeCloudMisWeightProbeMode(mode) {
    const n = Number(mode);
    if (!Number.isFinite(n)) return mode ? 1 : 0;
    return Math.max(0, Math.min(CLOUD_MIS_WEIGHT_PROBE_MODE_LABELS.length - 1, Math.trunc(n)));
}

function normalizeCloudVisibilityProbeRod(rod) {
    if (typeof rod === 'string') {
        const idx = CLOUD_VISIBILITY_PROBE_ROD_LABELS.indexOf(rod.trim().toUpperCase());
        if (idx >= 0) return idx;
    }
    const n = Number(rod);
    if (!Number.isFinite(n)) return -1;
    return Math.max(-1, Math.min(3, Math.trunc(n)));
}

function normalizeCloudVisibilityProbeClass(blockerClass) {
    if (typeof blockerClass === 'string') {
        const idx = CLOUD_VISIBILITY_PROBE_CLASS_LABELS.indexOf(blockerClass.trim());
        if (idx >= 0) return idx;
    }
    const n = Number(blockerClass);
    if (!Number.isFinite(n)) return -1;
    return Math.max(-1, Math.min(CLOUD_VISIBILITY_PROBE_CLASS_LABELS.length - 1, Math.trunc(n)));
}

function normalizeCloudVisibilityProbeThetaBinCount(thetaBinCount) {
    const n = Number(thetaBinCount);
    if (!Number.isFinite(n)) return CLOUD_VISIBILITY_PROBE_THETA_BIN_COUNT_DEFAULT;
    return Math.max(1, Math.min(32, Math.trunc(n)));
}

function normalizeCloudThetaImportanceProtectedFloor(protectedFloor) {
    const n = Number(protectedFloor);
    if (!Number.isFinite(n)) return 0.65;
    return Number(Math.max(0.05, Math.min(1, n)).toFixed(4));
}

function normalizeCloudVisibilityProbeThetaBin(thetaBin, thetaBinCount) {
    const n = Number(thetaBin);
    if (!Number.isFinite(n)) return -1;
    const count = normalizeCloudVisibilityProbeThetaBinCount(thetaBinCount);
    return Math.max(-1, Math.min(count - 1, Math.trunc(n)));
}

function cloudVisibilityProbeThetaBinInfo(thetaBin, thetaBinCount) {
    const count = normalizeCloudVisibilityProbeThetaBinCount(thetaBinCount);
    const bin = normalizeCloudVisibilityProbeThetaBin(thetaBin, count);
    if (bin < 0) {
        return {
            thetaBin: -1,
            thetaBinCount: count,
            thetaLabel: 'all',
            thetaStartDeg: 0,
            thetaEndDeg: 90
        };
    }
    const stepDeg = 90 / count;
    return {
        thetaBin: bin,
        thetaBinCount: count,
        thetaLabel: bin + '/' + count,
        thetaStartDeg: Number((bin * stepDeg).toFixed(3)),
        thetaEndDeg: Number(((bin + 1) * stepDeg).toFixed(3))
    };
}

function getCloudVisibilityProbeLabel() {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudVisibilityProbeMode ||
        pathTracingUniforms.uCloudVisibilityProbeMode.value < 1) {
        return '';
    }
    const rod = pathTracingUniforms.uCloudVisibilityProbeRod ? pathTracingUniforms.uCloudVisibilityProbeRod.value : -1;
    const rodLabel = rod < 0 ? 'all' : (CLOUD_VISIBILITY_PROBE_ROD_LABELS[rod] || String(rod));
    const mode = pathTracingUniforms.uCloudVisibilityProbeMode.value;
    const selectedClass = pathTracingUniforms.uCloudVisibilityProbeClass ? pathTracingUniforms.uCloudVisibilityProbeClass.value : -1;
    const selectedLabel = selectedClass >= 0 ? '/' + (CLOUD_VISIBILITY_PROBE_CLASS_LABELS[selectedClass] || selectedClass) : '';
    const thetaInfo = cloudVisibilityProbeThetaBinInfo(
        pathTracingUniforms.uCloudVisibilityProbeThetaBin ? pathTracingUniforms.uCloudVisibilityProbeThetaBin.value : -1,
        pathTracingUniforms.uCloudVisibilityProbeThetaBinCount ? pathTracingUniforms.uCloudVisibilityProbeThetaBinCount.value : CLOUD_VISIBILITY_PROBE_THETA_BIN_COUNT_DEFAULT
    );
    const thetaLabel = thetaInfo.thetaBin >= 0 ? '/theta' + thetaInfo.thetaLabel : '';
    const modeLabel = mode >= 4 ? 'facingDiagnostic' : (mode >= 3 ? 'class' + selectedLabel : (mode >= 2 ? 'blockers' : 'visibility'));
    return ' / CloudProbe: ' + modeLabel + '/' + rodLabel + thetaLabel;
}

function getCloudThetaImportanceShaderABLabel() {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudThetaImportanceShaderABMode ||
        pathTracingUniforms.uCloudThetaImportanceShaderABMode.value < 1) {
        return '';
    }
    return ' / CloudTheta: B0.50';
}

function getCloudMisWeightProbeLabel() {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode ||
        (pathTracingUniforms.uCloudMisWeightProbeMode.value < 1 && cloudMisWeightProbeDisplayMode < 1)) {
        return '';
    }
    const mode = normalizeCloudMisWeightProbeMode(cloudMisWeightProbeDisplayMode || pathTracingUniforms.uCloudMisWeightProbeMode.value);
    return ' / CloudMIS: ' + (CLOUD_MIS_WEIGHT_PROBE_MODE_LABELS[mode] || String(mode));
}

function classifyCloudVisibilityProbePixel(r, g, b) {
    let bestIdx = 0;
    let bestDist = Infinity;
    CLOUD_VISIBILITY_PROBE_CLASS_COLORS.forEach((color, idx) => {
        const dr = r - color[0];
        const dg = g - color[1];
        const db = b - color[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
            bestDist = dist;
            bestIdx = idx;
        }
    });
    return bestIdx;
}

function renderCloudVisibilityProbeReadbackSampleIfNeeded(mode) {
    if (mode < 3 || !needClearAccumulation || !renderer || !pathTracingRenderTarget || !screenCopyRenderTarget ||
        !pathTracingScene || !worldCamera || !screenCopyScene || !orthoCamera || !pathTracingUniforms) {
        return false;
    }

    renderer.setRenderTarget(pathTracingRenderTarget);
    renderer.clear();
    renderer.setRenderTarget(screenCopyRenderTarget);
    renderer.clear();
    if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget) {
        renderer.setRenderTarget(borrowPathTracingRenderTarget);
        renderer.clear();
        renderer.setRenderTarget(borrowScreenCopyRenderTarget);
        renderer.clear();
    }

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

    renderer.setRenderTarget(pathTracingRenderTarget);
    renderer.render(pathTracingScene, worldCamera);
    renderer.setRenderTarget(screenCopyRenderTarget);
    renderer.render(screenCopyScene, orthoCamera);
    renderer.setRenderTarget(null);

    if (screenOutputUniforms) {
        if (screenOutputUniforms.uCameraIsMoving) screenOutputUniforms.uCameraIsMoving.value = false;
        if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
        if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0;
    }

    return true;
}

function cloudVisibilityProbeSummary(options) {
    if (!renderer || !renderer.domElement) return null;
    const logTable = !(options && options.logTable === false);
    const mode = pathTracingUniforms && pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : 0;
    const forcedReadbackSample = renderCloudVisibilityProbeReadbackSampleIfNeeded(mode);
    let width = renderer.domElement.width;
    let height = renderer.domElement.height;
    let data;
    let rawFloatReadback = false;

    if (mode >= 3 && pathTracingRenderTarget) {
        width = pathTracingRenderTarget.width;
        height = pathTracingRenderTarget.height;
        data = new Float32Array(width * height * 4);
        renderer.readRenderTargetPixels(pathTracingRenderTarget, 0, 0, width, height, data);
        rawFloatReadback = true;
    } else {
        renderer.setRenderTarget(null);
        renderer.render(screenOutputScene, orthoCamera);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(renderer.domElement, 0, 0, width, height);
        data = ctx.getImageData(0, 0, width, height).data;
    }
    let visibleMass = 0;
    let blockedMass = 0;
    let visiblePixels = 0;
    let blockedPixels = 0;
    let inactivePixels = 0;
    let selectedClassMass = 0;
    let otherClassMass = 0;
    let selectedClassPixels = 0;
    let otherClassPixels = 0;
    const facingDiagnosticMasses = new Array(CLOUD_FACING_DIAGNOSTIC_LABELS.length).fill(0);
    const facingDiagnosticPixels = new Array(CLOUD_FACING_DIAGNOSTIC_LABELS.length).fill(0);
    const classPixels = new Array(CLOUD_VISIBILITY_PROBE_CLASS_LABELS.length).fill(0);
    const classMasses = new Array(CLOUD_VISIBILITY_PROBE_CLASS_LABELS.length).fill(0);
    const signalThreshold = rawFloatReadback ? 1e-6 : 10 / 255;
    const selectedClass = pathTracingUniforms && pathTracingUniforms.uCloudVisibilityProbeClass ? pathTracingUniforms.uCloudVisibilityProbeClass.value : -1;
    const thetaInfo = cloudVisibilityProbeThetaBinInfo(
        pathTracingUniforms && pathTracingUniforms.uCloudVisibilityProbeThetaBin ? pathTracingUniforms.uCloudVisibilityProbeThetaBin.value : -1,
        pathTracingUniforms && pathTracingUniforms.uCloudVisibilityProbeThetaBinCount ? pathTracingUniforms.uCloudVisibilityProbeThetaBinCount.value : CLOUD_VISIBILITY_PROBE_THETA_BIN_COUNT_DEFAULT
    );

    for (let i = 0; i < data.length; i += 4) {
        const r = rawFloatReadback ? data[i] : data[i] / 255;
        const g = rawFloatReadback ? data[i + 1] : data[i + 1] / 255;
        const b = rawFloatReadback ? data[i + 2] : data[i + 2] / 255;
        const signal = mode >= 2 ? (r + g + b) : (r + g);
        if (signal <= signalThreshold) {
            inactivePixels++;
            continue;
        }
        visibleMass += g;
        blockedMass += r;
        if (g >= r) visiblePixels++;
        else blockedPixels++;

        if (mode >= 3 && mode < 4) {
            selectedClassMass += g;
            otherClassMass += r;
            if (g > signalThreshold) selectedClassPixels++;
            if (r > signalThreshold) otherClassPixels++;
        }
        if (mode >= 4) {
            const channels = [r, g, b];
            for (let channel = 0; channel < channels.length; channel++) {
                facingDiagnosticMasses[channel] += channels[channel];
                if (channels[channel] > signalThreshold) facingDiagnosticPixels[channel]++;
            }
        }

        if (mode >= 2 && mode < 3) {
            const classIdx = classifyCloudVisibilityProbePixel(r, g, b);
            classPixels[classIdx]++;
            classMasses[classIdx] += Math.max(r, g, b);
        }
    }

    const totalMass = visibleMass + blockedMass;
    const summary = {
        probeVersion: CLOUD_VISIBILITY_PROBE_VERSION,
        readbackMode: rawFloatReadback ? 'rawPathTracingTarget' : 'screenCanvas',
        forcedReadbackSample,
        mode,
        rod: pathTracingUniforms && pathTracingUniforms.uCloudVisibilityProbeRod ? pathTracingUniforms.uCloudVisibilityProbeRod.value : -1,
        samples: Math.round(sampleCounter),
        width,
        height,
        visiblePixels,
        blockedPixels,
        inactivePixels,
        visibleMass: Number(visibleMass.toFixed(2)),
        blockedMass: Number(blockedMass.toFixed(2)),
        visibleRatio: totalMass > 0 ? Number((visibleMass / totalMass).toFixed(4)) : 0,
        thetaBin: thetaInfo.thetaBin,
        thetaBinCount: thetaInfo.thetaBinCount,
        thetaLabel: thetaInfo.thetaLabel,
        thetaStartDeg: thetaInfo.thetaStartDeg,
        thetaEndDeg: thetaInfo.thetaEndDeg
    };
    if (mode >= 3 && mode < 4) {
        const selectedTotalMass = selectedClassMass + otherClassMass;
        summary.selectedClass = selectedClass >= 0 ? CLOUD_VISIBILITY_PROBE_CLASS_LABELS[selectedClass] : 'all';
        summary.selectedClassPixels = selectedClassPixels;
        summary.otherClassPixels = otherClassPixels;
        summary.selectedClassMass = Number(selectedClassMass.toFixed(2));
        summary.otherClassMass = Number(otherClassMass.toFixed(2));
        summary.selectedClassRatio = selectedTotalMass > 0 ? Number((selectedClassMass / selectedTotalMass).toFixed(4)) : 0;
        summary.thetaBinRatio = summary.selectedClassRatio;
    }
    if (mode >= 4) {
        const facingTotalMass = facingDiagnosticMasses.reduce((sum, value) => sum + value, 0);
        summary.legacyZeroCloudFacingAlias = CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.legacyZeroCloudFacingAlias;
        summary.renderEnergyNormal = CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.renderEnergyNormal;
        summary.probeClassificationNormal = CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.probeClassificationNormal;
        CLOUD_FACING_DIAGNOSTIC_LABELS.forEach((label, idx) => {
            summary[label + 'Pixels'] = facingDiagnosticPixels[idx];
            summary[label + 'Mass'] = Number(facingDiagnosticMasses[idx].toFixed(2));
            summary[label + 'Ratio'] = facingTotalMass > 0 ? Number((facingDiagnosticMasses[idx] / facingTotalMass).toFixed(4)) : 0;
        });
        summary.facingDiagnosticMass = Number(facingTotalMass.toFixed(2));
        summary.normalMinusProbeFacingZeroRatio = Number((summary.normalCloudFacingZeroRatio - summary.probeCloudFacingZeroRatio).toFixed(4));
        summary.normalMinusProbeFacingZeroMass = Number((facingDiagnosticMasses[1] - facingDiagnosticMasses[2]).toFixed(2));
    }
    if (mode < 3) {
        const totalClassMass = classMasses.reduce((sum, value) => sum + value, 0);
        CLOUD_VISIBILITY_PROBE_CLASS_LABELS.forEach((label, idx) => {
            summary[label + 'Pixels'] = classPixels[idx];
            summary[label + 'Mass'] = Number(classMasses[idx].toFixed(2));
            summary[label + 'Ratio'] = totalClassMass > 0 ? Number((classMasses[idx] / totalClassMass).toFixed(4)) : 0;
        });
    }
    if (logTable) console.table(summary);
    return summary;
}

function resetCloudVisibilityProbeAccumulation() {
    needClearAccumulation = true;
    cameraIsMoving = true;
    if (!renderer || !pathTracingRenderTarget || !screenCopyRenderTarget) return;
    renderer.setRenderTarget(pathTracingRenderTarget);
    renderer.clear();
    renderer.setRenderTarget(screenCopyRenderTarget);
    renderer.clear();
    if (borrowPathTracingRenderTarget && borrowScreenCopyRenderTarget) {
        renderer.setRenderTarget(borrowPathTracingRenderTarget);
        renderer.clear();
        renderer.setRenderTarget(borrowScreenCopyRenderTarget);
        renderer.clear();
    }
    renderer.setRenderTarget(null);
    sampleCounter = 1.0;
    frameCounter = 1.0;
    if (pathTracingUniforms) {
        if (pathTracingUniforms.uSampleCounter) pathTracingUniforms.uSampleCounter.value = sampleCounter;
        if (pathTracingUniforms.uFrameCounter) pathTracingUniforms.uFrameCounter.value = frameCounter;
        if (pathTracingUniforms.uPreviousSampleCount) pathTracingUniforms.uPreviousSampleCount.value = 1.0;
    }
    if (screenOutputUniforms) {
        if (screenOutputUniforms.uSampleCounter) screenOutputUniforms.uSampleCounter.value = sampleCounter;
        if (screenOutputUniforms.uOneOverSampleCounter) screenOutputUniforms.uOneOverSampleCounter.value = 1.0;
    }
}

window.setCloudVisibilityProbe = function (mode, rod, blockerClass, thetaBin, thetaBinCount) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudVisibilityProbeMode || !pathTracingUniforms.uCloudVisibilityProbeRod ||
        !pathTracingUniforms.uCloudVisibilityProbeClass || !pathTracingUniforms.uCloudVisibilityProbeThetaBin ||
        !pathTracingUniforms.uCloudVisibilityProbeThetaBinCount) {
        return null;
    }
    const enabled = normalizeCloudVisibilityProbeMode(mode);
    const rodValue = normalizeCloudVisibilityProbeRod(rod);
    const classValue = normalizeCloudVisibilityProbeClass(blockerClass);
    const thetaCountValue = normalizeCloudVisibilityProbeThetaBinCount(thetaBinCount);
    const thetaBinValue = normalizeCloudVisibilityProbeThetaBin(thetaBin, thetaCountValue);
    const thetaInfo = cloudVisibilityProbeThetaBinInfo(thetaBinValue, thetaCountValue);
    pathTracingUniforms.uCloudVisibilityProbeMode.value = enabled;
    pathTracingUniforms.uCloudVisibilityProbeRod.value = rodValue;
    pathTracingUniforms.uCloudVisibilityProbeClass.value = classValue;
    pathTracingUniforms.uCloudVisibilityProbeThetaBinCount.value = thetaCountValue;
    pathTracingUniforms.uCloudVisibilityProbeThetaBin.value = thetaBinValue;
    resetCloudVisibilityProbeAccumulation();
    wakeRender();
    return {
        mode: enabled,
        rod: rodValue,
        rodLabel: rodValue < 0 ? 'all' : CLOUD_VISIBILITY_PROBE_ROD_LABELS[rodValue],
        blockerClass: classValue,
        blockerClassLabel: classValue < 0 ? 'all' : CLOUD_VISIBILITY_PROBE_CLASS_LABELS[classValue],
        thetaBin: thetaInfo.thetaBin,
        thetaBinCount: thetaInfo.thetaBinCount,
        thetaLabel: thetaInfo.thetaLabel,
        thetaStartDeg: thetaInfo.thetaStartDeg,
        thetaEndDeg: thetaInfo.thetaEndDeg
    };
};

window.setCloudVisibilityProbeClass = function (blockerClass) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudVisibilityProbeClass) {
        return null;
    }
    const classValue = normalizeCloudVisibilityProbeClass(blockerClass);
    pathTracingUniforms.uCloudVisibilityProbeClass.value = classValue;
    resetCloudVisibilityProbeAccumulation();
    wakeRender();
    return {
        blockerClass: classValue,
        blockerClassLabel: classValue < 0 ? 'all' : CLOUD_VISIBILITY_PROBE_CLASS_LABELS[classValue]
    };
};

window.setCloudVisibilityProbeThetaBin = function (thetaBin, thetaBinCount) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudVisibilityProbeThetaBin || !pathTracingUniforms.uCloudVisibilityProbeThetaBinCount) {
        return null;
    }
    const thetaCountValue = normalizeCloudVisibilityProbeThetaBinCount(thetaBinCount);
    const thetaBinValue = normalizeCloudVisibilityProbeThetaBin(thetaBin, thetaCountValue);
    const thetaInfo = cloudVisibilityProbeThetaBinInfo(thetaBinValue, thetaCountValue);
    pathTracingUniforms.uCloudVisibilityProbeThetaBinCount.value = thetaCountValue;
    pathTracingUniforms.uCloudVisibilityProbeThetaBin.value = thetaBinValue;
    resetCloudVisibilityProbeAccumulation();
    wakeRender();
    return thetaInfo;
};

window.reportCloudThetaImportanceShaderAB = function () {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudThetaImportanceShaderABMode) {
        return null;
    }
    return {
        shaderABVersion: CLOUD_THETA_IMPORTANCE_SHADER_AB_VERSION,
        sourceProbeVersion: CLOUD_VISIBILITY_PROBE_VERSION,
        shaderABMode: pathTracingUniforms.uCloudThetaImportanceShaderABMode.value,
        modeLabel: pathTracingUniforms.uCloudThetaImportanceShaderABMode.value > 0 ? 'thetaImportanceCandidateProtectedFloor050' : 'uniformThetaBaseline',
        baselineStrategy: 'uniformTheta',
        candidateStrategy: 'thetaImportanceCandidate',
        protectedFloor: CLOUD_THETA_IMPORTANCE_SHADER_AB_PROTECTED_FLOOR,
        thetaBinCount: CLOUD_VISIBILITY_PROBE_THETA_BIN_COUNT_DEFAULT,
        candidatePdfByThetaBin: [0.182214, 0.164555, 0.139731, 0.124376, 0.108893, 0.094690, 0.091107, 0.094434],
        pdfCompensationByThetaBin: [0.6860, 0.7596, 0.8946, 1.0050, 1.1479, 1.3201, 1.3720, 1.3237],
        debugFlag: 'uCloudThetaImportanceShaderABMode',
        defaultMode: 0
    };
};

window.setCloudThetaImportanceShaderAB = function (enabled) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudThetaImportanceShaderABMode) {
        return null;
    }
    const mode = (enabled === true || Number(enabled) > 0) ? 1 : 0;
    pathTracingUniforms.uCloudThetaImportanceShaderABMode.value = mode;
    resetCloudVisibilityProbeAccumulation();
    wakeRender();
    return window.reportCloudThetaImportanceShaderAB();
};

function classifyActiveLightIndex(lightIndex) {
    if (lightIndex === 0) return 'ceiling';
    if (lightIndex >= 1 && lightIndex <= 4) return 'track';
    if (lightIndex >= 5 && lightIndex <= 6) return 'wide';
    if (lightIndex >= 7 && lightIndex <= 10) return 'cloud';
    return 'empty';
}

function lightImportanceWeightForIndex(lightIndex) {
    if (!r72LightImportanceSamplingEnabled) return 1;
    if (lightIndex === 0) return 1;
    if (lightIndex >= 1 && lightIndex <= 4) return Math.max(1e-6, trackLumens);
    if (lightIndex >= 5 && lightIndex <= 6) return Math.max(1e-6, trackWideLumens);
    if (lightIndex >= 7 && lightIndex <= 10) return Math.max(1e-6, CLOUD_ROD_LUMENS[lightIndex - 7]);
    return 1;
}

function writeActiveLightSamplingPdfAndCdf(activeCount, activeLightIndex) {
    if (!pathTracingUniforms || !pathTracingUniforms.uActiveLightPickPdf || !pathTracingUniforms.uActiveLightPickCdf) return;
    const pdf = pathTracingUniforms.uActiveLightPickPdf.value;
    const cdf = pathTracingUniforms.uActiveLightPickCdf.value;
    pdf.fill(0);
    cdf.fill(0);
    if (activeCount <= 0) return;

    const weights = [];
    let weightSum = 0;
    for (let i = 0; i < activeCount; i++) {
        const weight = lightImportanceWeightForIndex(activeLightIndex[i]);
        weights.push(weight);
        weightSum += weight;
    }
    if (!Number.isFinite(weightSum) || weightSum <= 0) {
        weightSum = activeCount;
        for (let i = 0; i < activeCount; i++) weights[i] = 1;
    }

    let running = 0;
    for (let i = 0; i < activeCount; i++) {
        const p = weights[i] / weightSum;
        pdf[i] = p;
        running += p;
        cdf[i] = (i === activeCount - 1) ? 1 : running;
    }
}

window.setR72LightImportanceSamplingEnabled = function(enabled) {
    r72LightImportanceSamplingEnabled = !!enabled;
    if (pathTracingUniforms && pathTracingUniforms.uR72LightImportanceSamplingMode) {
        pathTracingUniforms.uR72LightImportanceSamplingMode.value = r72LightImportanceSamplingEnabled ? 1.0 : 0.0;
    }
    rebuildActiveLightLUT('r7-2-toggle');
    wakeRender();
    return window.reportR72LightImportanceSamplingConfig();
};

window.reportR72LightImportanceSamplingConfig = function() {
    const activeCount = pathTracingUniforms && pathTracingUniforms.uActiveLightCount
        ? pathTracingUniforms.uActiveLightCount.value
        : 0;
    const activeIndices = pathTracingUniforms && pathTracingUniforms.uActiveLightIndex
        ? Array.from(pathTracingUniforms.uActiveLightIndex.value).slice(0, activeCount)
        : [];
    const pickPdf = pathTracingUniforms && pathTracingUniforms.uActiveLightPickPdf
        ? Array.from(pathTracingUniforms.uActiveLightPickPdf.value).slice(0, activeCount)
        : [];
    const pickCdf = pathTracingUniforms && pathTracingUniforms.uActiveLightPickCdf
        ? Array.from(pathTracingUniforms.uActiveLightPickCdf.value).slice(0, activeCount)
        : [];
    return {
        version: R7_2_LIGHT_IMPORTANCE_VERSION,
        enabled: r72LightImportanceSamplingEnabled,
        uniformMode: pathTracingUniforms && pathTracingUniforms.uR72LightImportanceSamplingMode
            ? pathTracingUniforms.uR72LightImportanceSamplingMode.value
            : null,
        strategy: r72LightImportanceSamplingEnabled ? 'nominalFluxWeightedActiveLights' : 'uniformActiveLights',
        currentPanelConfig,
        activeLightCount: activeCount,
        activeLightIndex: activeIndices,
        activeLightPickPdf: pickPdf,
        activeLightPickCdf: pickCdf,
        lightClassBreakdown: activeIndices.reduce((acc, idx) => {
            const key = classifyActiveLightIndex(idx);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, { ceiling: 0, track: 0, wide: 0, cloud: 0, empty: 0 }),
        c3CloudRodPdf: activeIndices.map((idx, slot) => idx >= 7 && idx <= 10 ? { lightIndex: idx, pdf: pickPdf[slot] } : null).filter(Boolean),
        c4TrackWidePdf: activeIndices.map((idx, slot) => idx >= 1 && idx <= 6 ? { lightIndex: idx, pdf: pickPdf[slot] } : null).filter(Boolean),
        renderPathMutation: r72LightImportanceSamplingEnabled,
        expectedValidation: ['C3 low SPP A/B', 'C4 low SPP A/B', 'C1/C2 regression', '1024 spp brightness guard']
    };
};

window.reportR72QuickPreviewIsolationConfig = function() {
    const btnB = document.getElementById('btnGroupB');
    return {
        version: R7_2_LIGHT_IMPORTANCE_VERSION,
        isolation: 'r7-2b-c3-quick-preview-borrow-zero',
        currentPanelConfig,
        quickPreviewActive: !!(btnB && btnB.classList.contains('glow-white')),
        r72QuickPreviewIsolationBorrowStrength: getSliderValue('slider-borrow-strength-b'),
        uniformBorrowStrength: pathTracingUniforms && pathTracingUniforms.uBorrowStrength
            ? pathTracingUniforms.uBorrowStrength.value
            : null,
        lightImportance: window.reportR72LightImportanceSamplingConfig()
    };
};

window.setR72QuickPreviewIsolation = function(enabled) {
    const btnConfig3 = document.getElementById('btnConfig3');
    const btnGroupB = document.getElementById('btnGroupB');
    if (btnConfig3 && !btnConfig3.checked) btnConfig3.click();
    else if (currentPanelConfig !== 3) applyPanelConfig(3);
    if (btnGroupB) btnGroupB.click();
    setSliderValue('slider-borrow-strength-b', 0.0);
    if (pathTracingUniforms && pathTracingUniforms.uBorrowStrength) {
        pathTracingUniforms.uBorrowStrength.value = 0.0;
    }
    window.setR72LightImportanceSamplingEnabled(enabled !== false);
    wakeRender();
    return window.reportR72QuickPreviewIsolationConfig();
};

function ratio(numerator, denominator) {
    return denominator > 0 ? Number((numerator / denominator).toFixed(6)) : 0;
}

function misWeightFromNeeOverBsdfRatio(neeOverBsdfRatio, favoredPdf) {
    if (neeOverBsdfRatio == null) return null;
    const ratioValue = Number(neeOverBsdfRatio);
    if (!Number.isFinite(ratioValue) || ratioValue < 0) return null;
    const ratioSquared = ratioValue * ratioValue;
    const denom = ratioSquared + 1;
    if (denom <= 0) return null;
    const weight = favoredPdf === 'nee'
        ? ratioSquared / denom
        : 1 / denom;
    return Number(weight.toFixed(6));
}

function nearlyEqualProbeNumber(a, b, relTol) {
    const x = Number(a);
    const y = Number(b);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const scale = Math.max(1, Math.abs(x), Math.abs(y));
    return Math.abs(x - y) <= scale * (relTol == null ? 1e-6 : relTol);
}

function normalizeCloudBsdfHitFrequencyPlan(samplePlan) {
    const fallback = [1, 4, 16, 64];
    const raw = Array.isArray(samplePlan)
        ? samplePlan
        : (samplePlan == null ? fallback : [samplePlan]);
    const values = raw
        .map((value) => Math.trunc(Number(value)))
        .filter((value) => Number.isFinite(value) && value > 0);
    const unique = Array.from(new Set(values.length > 0 ? values : fallback));
    unique.sort((a, b) => a - b);
    return unique;
}

window.reportCloudSamplingBudgetDiagnostic = function () {
    if (!pathTracingUniforms || !pathTracingUniforms.uActiveLightCount || !pathTracingUniforms.uActiveLightIndex) {
        return null;
    }
    const activeCount = pathTracingUniforms.uActiveLightCount.value;
    const activeIndices = Array.from(pathTracingUniforms.uActiveLightIndex.value).slice(0, activeCount);
    const counts = { ceiling: 0, track: 0, wide: 0, cloud: 0, empty: 0 };
    activeIndices.forEach((idx) => {
        counts[classifyActiveLightIndex(idx)] += 1;
    });
    const otherPickRatio = ratio(counts.ceiling + counts.track + counts.wide, activeCount);
    const cloudRatio = ratio(counts.cloud, activeCount);
    return {
        version: CLOUD_SAMPLING_BUDGET_DIAGNOSTIC_VERSION,
        CLOUD_SAMPLING_BUDGET_DIAGNOSTIC_VERSION,
        probeVersion: CLOUD_VISIBILITY_PROBE_VERSION,
        analysisScope: 'cloudSamplingBudgetDiagnostic',
        renderPathMutation: false,
        shaderMutation: false,
        questions: ['cloudPickRatio', 'otherLightCompetition', 'misDilution', 'directVsIndirect'],
        currentPanelConfig,
        activeLightCount: activeCount,
        activeLightIndex: activeIndices,
        activeLightPickPdf: pathTracingUniforms.uActiveLightPickPdf ? Array.from(pathTracingUniforms.uActiveLightPickPdf.value).slice(0, activeCount) : [],
        activeLightPickCdf: pathTracingUniforms.uActiveLightPickCdf ? Array.from(pathTracingUniforms.uActiveLightPickCdf.value).slice(0, activeCount) : [],
        r72LightImportanceSampling: window.reportR72LightImportanceSamplingConfig ? window.reportR72LightImportanceSamplingConfig() : null,
        activeLightBreakdown: counts,
        cloudLightCount: counts.cloud,
        cloudPickRatio: ratio(counts.cloud, activeCount),
        perCloudRodPickRatio: ratio(1, activeCount),
        otherLightPickRatio: ratio(counts.ceiling + counts.track + counts.wide, activeCount),
        selectPdf: activeCount > 0 ? 1 / activeCount : 0,
        otherLightsCompeteWithCloud: (counts.ceiling + counts.track + counts.wide) > 0,
        c3CloudSampleBudgetVerdict: (currentPanelConfig === 3 && counts.cloud === activeCount && counts.cloud === 4)
            ? 'cloudOwnsActivePool'
            : 'mixedActivePool',
        cloudDirectNeeMis: 'wNee = powerHeuristic(pNee, pBsdf)',
        cloudBsdfReverseMis: 'wBsdf = powerHeuristic(pBsdf, pNeeReverse)',
        misAppliesToCloudDirectNee: true,
        misAppliesToCloudBsdfHit: true,
        directIsolationControl: 'uIndirectMultiplier = 0',
        baselineIndirectControl: 'uIndirectMultiplier = 1',
        currentIndirectMultiplier: pathTracingUniforms.uIndirectMultiplier ? pathTracingUniforms.uIndirectMultiplier.value : null,
        currentMaxBounces: pathTracingUniforms.uMaxBounces ? pathTracingUniforms.uMaxBounces.value : null,
        nextProbe: {
            directOnly: {
                uIndirectMultiplier: 0,
                expectedMeaning: 'firstDiffuseNeeOnly'
            },
            baseline: {
                uIndirectMultiplier: 1,
                expectedMeaning: 'directNeePlusIndirectBounces'
            }
        },
        preliminaryAnswers: {
            cloudPickRatio: cloudRatio,
            otherLightCompetition: otherPickRatio,
            selectionBudgetLikelyRootCause: !(currentPanelConfig === 3 && counts.cloud === activeCount && counts.cloud === 4),
            needsDirectVsIndirectScreenshotProbe: true
        },
        recommendedNextStep: 'directVsIndirectScreenshotProbe'
    };
};

window.setCloudMisWeightProbe = function (mode) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const modeValue = normalizeCloudMisWeightProbeMode(mode);
    const contributionMode = modeValue === 5 ? 1 : (modeValue === 6 ? 2 : ((modeValue === 7 || modeValue === 9 || modeValue === 10) ? 3 : 0));
    cloudMisWeightProbeDisplayMode = modeValue;
    pathTracingUniforms.uCloudMisWeightProbeMode.value = modeValue;
    if (pathTracingUniforms.uCloudContributionProbeMode) {
        pathTracingUniforms.uCloudContributionProbeMode.value = contributionMode;
    }
    if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial) {
        pathTracingMaterial.uniformsNeedUpdate = true;
    }
    if (modeValue > 0 && pathTracingUniforms.uCloudVisibilityProbeMode) {
        pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
    }
    resetCloudVisibilityProbeAccumulation();
    wakeRender();
    return {
        version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
        mode: modeValue,
        modeLabel: CLOUD_MIS_WEIGHT_PROBE_MODE_LABELS[modeValue],
        normalRenderProbeMode: 0
    };
};

window.reportCloudVisibilityProbeThetaScan = function (blockerClass, rod, thetaBinCount) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudVisibilityProbeMode || !pathTracingUniforms.uCloudVisibilityProbeRod ||
        !pathTracingUniforms.uCloudVisibilityProbeClass || !pathTracingUniforms.uCloudVisibilityProbeThetaBin ||
        !pathTracingUniforms.uCloudVisibilityProbeThetaBinCount) {
        return null;
    }

    const original = {
        mode: pathTracingUniforms.uCloudVisibilityProbeMode.value,
        rod: pathTracingUniforms.uCloudVisibilityProbeRod.value,
        blockerClass: pathTracingUniforms.uCloudVisibilityProbeClass.value,
        thetaBin: pathTracingUniforms.uCloudVisibilityProbeThetaBin.value,
        thetaBinCount: pathTracingUniforms.uCloudVisibilityProbeThetaBinCount.value
    };
    const rodValue = normalizeCloudVisibilityProbeRod(rod);
    const classValue = normalizeCloudVisibilityProbeClass(blockerClass == null ? 'zeroCloudFacing' : blockerClass);
    const countValue = normalizeCloudVisibilityProbeThetaBinCount(thetaBinCount);
    const bins = [];

    for (let bin = 0; bin < countValue; bin++) {
        window.setCloudVisibilityProbe(3, rodValue, classValue, bin, countValue);
        const summary = cloudVisibilityProbeSummary({ logTable: false });
        bins.push({
            thetaBin: summary.thetaBin,
            thetaLabel: summary.thetaLabel,
            thetaStartDeg: summary.thetaStartDeg,
            thetaEndDeg: summary.thetaEndDeg,
            samples: summary.samples,
            selectedClass: summary.selectedClass,
            selectedClassRatio: summary.selectedClassRatio,
            selectedClassMass: summary.selectedClassMass,
            otherClassMass: summary.otherClassMass,
            selectedClassPixels: summary.selectedClassPixels,
            otherClassPixels: summary.otherClassPixels
        });
    }

    window.setCloudVisibilityProbe(original.mode, original.rod, original.blockerClass, original.thetaBin, original.thetaBinCount);
    const result = {
        probeVersion: CLOUD_VISIBILITY_PROBE_VERSION,
        rod: rodValue,
        rodLabel: rodValue < 0 ? 'all' : CLOUD_VISIBILITY_PROBE_ROD_LABELS[rodValue],
        selectedClass: classValue >= 0 ? CLOUD_VISIBILITY_PROBE_CLASS_LABELS[classValue] : 'all',
        thetaBinCount: countValue,
        bins
    };
    console.table(bins);
    return result;
};

function waitForCloudVisibilityProbeSamples(targetSamples, timeoutMs, pollMs) {
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 1));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const poll = Math.max(50, Math.trunc(Number(pollMs) || 250));
    const startedAt = performance.now();

    return new Promise((resolve) => {
        function tick() {
            const currentSamples = Math.round(typeof sampleCounter === 'number' ? sampleCounter : 0);
            if (sampleCounter >= targetSamples || currentSamples >= target) {
                resolve({
                    targetSamples: target,
                    samples: currentSamples,
                    timedOut: false,
                    elapsedMs: Math.round(performance.now() - startedAt)
                });
                return;
            }
            if (performance.now() - startedAt >= timeout) {
                resolve({
                    targetSamples: target,
                    samples: currentSamples,
                    timedOut: true,
                    elapsedMs: Math.round(performance.now() - startedAt)
                });
                return;
            }
            setTimeout(tick, poll);
        }
        tick();
    });
}

window.waitForCloudVisibilityProbeSamples = waitForCloudVisibilityProbeSamples;

function cloudMisWeightProbeReadbackSummary(mode, waitResult) {
    if (!renderer || !pathTracingRenderTarget || !pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const modeValue = normalizeCloudMisWeightProbeMode(mode);
    renderCloudVisibilityProbeReadbackSampleIfNeeded(3);

    const width = pathTracingRenderTarget.width;
    const height = pathTracingRenderTarget.height;
    const data = new Float32Array(width * height * 4);
    renderer.readRenderTargetPixels(pathTracingRenderTarget, 0, 0, width, height, data);

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let activePixels = 0;
    const signalThreshold = 1e-7;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        rSum += r;
        gSum += g;
        bSum += b;
        if (r + g + b > signalThreshold) activePixels++;
    }

    const isWeightMode = modeValue === 1 || modeValue === 3 || modeValue === 13;
    const isContributionMode = modeValue === 5 || modeValue === 6 || modeValue === 7 || modeValue === 8 || modeValue === 9 || modeValue === 10 || modeValue === 11;
    const eventMass = (isWeightMode || isContributionMode) ? gSum : bSum;
    const averageWeight = isWeightMode && eventMass > 0 ? rSum / eventMass : null;
    const averagePdfA = !isWeightMode && eventMass > 0 ? rSum / eventMass : null;
    const averagePdfB = !isWeightMode && eventMass > 0 ? gSum / eventMass : null;
    const averagePdfRatio = Number.isFinite(averagePdfA) && Number.isFinite(averagePdfB) && averagePdfB > 1e-12
        ? averagePdfA / averagePdfB
        : null;
    const contributionMass = isContributionMode ? rSum : null;
    const averageContributionLuma = isContributionMode && eventMass > 0 ? rSum / eventMass : null;
    const averageUnweightedContributionLuma = isContributionMode && eventMass > 0 ? bSum / eventMass : null;

    return {
        mode: modeValue,
        modeLabel: CLOUD_MIS_WEIGHT_PROBE_MODE_LABELS[modeValue],
        actualMisUniformMode: pathTracingUniforms.uCloudMisWeightProbeMode ? pathTracingUniforms.uCloudMisWeightProbeMode.value : null,
        actualContributionUniformMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        samples: Math.round(sampleCounter),
        targetSamples: waitResult ? waitResult.targetSamples : null,
        waitTimedOut: waitResult ? waitResult.timedOut : null,
        waitElapsedMs: waitResult ? waitResult.elapsedMs : null,
        width,
        height,
        activePixels,
        eventMass: Number(eventMass.toFixed(6)),
        channelMass: {
            r: Number(rSum.toFixed(6)),
            g: Number(gSum.toFixed(6)),
            b: Number(bSum.toFixed(6))
        },
        averageWeight: Number.isFinite(averageWeight) ? Number(averageWeight.toFixed(6)) : null,
        averagePdfA: !isContributionMode && Number.isFinite(averagePdfA) ? Number(averagePdfA.toExponential(6)) : null,
        averagePdfB: !isContributionMode && Number.isFinite(averagePdfB) ? Number(averagePdfB.toExponential(6)) : null,
        averagePdfRatio: !isContributionMode && Number.isFinite(averagePdfRatio) ? Number(averagePdfRatio.toFixed(6)) : null,
        contributionMass: Number.isFinite(contributionMass) ? Number(contributionMass.toFixed(6)) : null,
        averageContributionLuma: Number.isFinite(averageContributionLuma) ? Number(averageContributionLuma.toExponential(6)) : null,
        averageUnweightedContributionLuma: Number.isFinite(averageUnweightedContributionLuma) ? Number(averageUnweightedContributionLuma.toExponential(6)) : null
    };
}

function cloudMisWeightProbeSummaryFromChannelMass(mode, channelMass, activePixels, width, height, samples, elapsedMs, actualMisUniformMode, actualContributionUniformMode) {
    const modeValue = normalizeCloudMisWeightProbeMode(mode);
    const rSum = channelMass.r;
    const gSum = channelMass.g;
    const bSum = channelMass.b;
    const isWeightMode = modeValue === 1 || modeValue === 3 || modeValue === 13;
    const isContributionMode = modeValue === 5 || modeValue === 6 || modeValue === 7 || modeValue === 8 || modeValue === 9 || modeValue === 10 || modeValue === 11;
    const eventMass = (isWeightMode || isContributionMode) ? gSum : bSum;
    const averageWeight = isWeightMode && eventMass > 0 ? rSum / eventMass : null;
    const averagePdfA = !isWeightMode && eventMass > 0 ? rSum / eventMass : null;
    const averagePdfB = !isWeightMode && eventMass > 0 ? gSum / eventMass : null;
    const averagePdfRatio = Number.isFinite(averagePdfA) && Number.isFinite(averagePdfB) && averagePdfB > 1e-12
        ? averagePdfA / averagePdfB
        : null;
    const contributionMass = isContributionMode ? rSum : null;
    const averageContributionLuma = isContributionMode && eventMass > 0 ? rSum / eventMass : null;
    const averageUnweightedContributionLuma = isContributionMode && eventMass > 0 ? bSum / eventMass : null;

    return {
        mode: modeValue,
        modeLabel: CLOUD_MIS_WEIGHT_PROBE_MODE_LABELS[modeValue],
        actualMisUniformMode: actualMisUniformMode == null ? null : actualMisUniformMode,
        actualContributionUniformMode: actualContributionUniformMode == null ? null : actualContributionUniformMode,
        samples,
        targetSamples: samples,
        isolatedSamples: samples,
        waitTimedOut: false,
        waitElapsedMs: Math.round(elapsedMs),
        width,
        height,
        activePixels,
        eventMass: Number(eventMass.toFixed(6)),
        channelMass: {
            r: Number(rSum.toFixed(6)),
            g: Number(gSum.toFixed(6)),
            b: Number(bSum.toFixed(6))
        },
        averageWeight: Number.isFinite(averageWeight) ? Number(averageWeight.toFixed(6)) : null,
        averagePdfA: !isContributionMode && Number.isFinite(averagePdfA) ? Number(averagePdfA.toExponential(6)) : null,
        averagePdfB: !isContributionMode && Number.isFinite(averagePdfB) ? Number(averagePdfB.toExponential(6)) : null,
        averagePdfRatio: !isContributionMode && Number.isFinite(averagePdfRatio) ? Number(averagePdfRatio.toFixed(6)) : null,
        contributionMass: Number.isFinite(contributionMass) ? Number(contributionMass.toFixed(6)) : null,
        averageContributionLuma: Number.isFinite(averageContributionLuma) ? Number(averageContributionLuma.toExponential(6)) : null,
        averageUnweightedContributionLuma: Number.isFinite(averageUnweightedContributionLuma) ? Number(averageUnweightedContributionLuma.toExponential(6)) : null
    };
}

async function measureCloudMisWeightProbeMode(mode, targetSamples, timeoutMs) {
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 1));
    const startedAt = performance.now();
    const channelMass = { r: 0, g: 0, b: 0 };
    let activePixels = 0;
    let width = 0;
    let height = 0;

    for (let i = 0; i < target; i++) {
        window.setCloudMisWeightProbe(mode);
        renderCloudVisibilityProbeReadbackSampleIfNeeded(3);
        const summary = cloudMisWeightProbeReadbackSummary(mode, {
            targetSamples: 1,
            timedOut: false,
            elapsedMs: 0
        });
        if (!summary) continue;
        channelMass.r += summary.channelMass.r;
        channelMass.g += summary.channelMass.g;
        channelMass.b += summary.channelMass.b;
        activePixels += summary.activePixels;
        width = summary.width;
        height = summary.height;
    }

    return cloudMisWeightProbeSummaryFromChannelMass(
        mode,
        channelMass,
        activePixels,
        width,
        height,
        target,
        performance.now() - startedAt,
        pathTracingUniforms.uCloudMisWeightProbeMode ? pathTracingUniforms.uCloudMisWeightProbeMode.value : null,
        pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null
    );
}

function createCloudDirectNeeScreenBandAccumulators(height) {
    return CLOUD_DIRECT_NEE_SCREEN_BANDS.map((band, idx) => {
        const startRowFromTop = idx === 0 ? 0 : Math.floor(band.start * height);
        const endRowFromTop = idx === CLOUD_DIRECT_NEE_SCREEN_BANDS.length - 1
            ? height
            : Math.floor(band.end * height);
        return {
            label: band.label,
            screenYStart: band.start,
            screenYEnd: band.end,
            startRowFromTop,
            endRowFromTop,
            activePixels: 0,
            channelMass: { r: 0, g: 0, b: 0 }
        };
    });
}

function cloudDirectNeeScreenBandIndexForRow(bands, rowFromTop) {
    for (let i = 0; i < bands.length; i++) {
        if (rowFromTop >= bands[i].startRowFromTop && rowFromTop < bands[i].endRowFromTop) {
            return i;
        }
    }
    return bands.length - 1;
}

function readCloudMisWeightProbeScreenBandSample(mode) {
    if (!renderer || !pathTracingRenderTarget || !pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    renderCloudVisibilityProbeReadbackSampleIfNeeded(3);

    const width = pathTracingRenderTarget.width;
    const height = pathTracingRenderTarget.height;
    const data = new Float32Array(width * height * 4);
    const bands = createCloudDirectNeeScreenBandAccumulators(height);
    const totalChannelMass = { r: 0, g: 0, b: 0 };
    let totalActivePixels = 0;
    const signalThreshold = 1e-7;

    renderer.readRenderTargetPixels(pathTracingRenderTarget, 0, 0, width, height, data);

    for (let y = 0; y < height; y++) {
        const rowFromTop = height - 1 - y;
        const band = bands[cloudDirectNeeScreenBandIndexForRow(bands, rowFromTop)];
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            totalChannelMass.r += r;
            totalChannelMass.g += g;
            totalChannelMass.b += b;
            band.channelMass.r += r;
            band.channelMass.g += g;
            band.channelMass.b += b;
            if (r + g + b > signalThreshold) {
                totalActivePixels++;
                band.activePixels++;
            }
        }
    }

    return {
        mode: normalizeCloudMisWeightProbeMode(mode),
        width,
        height,
        activePixels: totalActivePixels,
        channelMass: totalChannelMass,
        bands
    };
}

function mergeCloudDirectNeeScreenBandSample(accumulator, sample) {
    if (!sample) return accumulator;
    if (!accumulator) {
        return {
            mode: sample.mode,
            width: sample.width,
            height: sample.height,
            activePixels: sample.activePixels,
            channelMass: { ...sample.channelMass },
            bands: sample.bands.map((band) => ({
                label: band.label,
                screenYStart: band.screenYStart,
                screenYEnd: band.screenYEnd,
                startRowFromTop: band.startRowFromTop,
                endRowFromTop: band.endRowFromTop,
                activePixels: band.activePixels,
                channelMass: { ...band.channelMass }
            }))
        };
    }
    accumulator.activePixels += sample.activePixels;
    accumulator.channelMass.r += sample.channelMass.r;
    accumulator.channelMass.g += sample.channelMass.g;
    accumulator.channelMass.b += sample.channelMass.b;
    sample.bands.forEach((sampleBand, idx) => {
        const band = accumulator.bands[idx];
        band.activePixels += sampleBand.activePixels;
        band.channelMass.r += sampleBand.channelMass.r;
        band.channelMass.g += sampleBand.channelMass.g;
        band.channelMass.b += sampleBand.channelMass.b;
    });
    return accumulator;
}

function cloudProbeRatioOrNull(numerator, denominator) {
    return Number.isFinite(numerator) && Number.isFinite(denominator) && Math.abs(denominator) > 1e-12
        ? numerator / denominator
        : null;
}

function roundCloudProbeRatio(value) {
    return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
}

function cloudDirectNeeScreenBandResultFromAccumulator(mode, accumulator, samples, elapsedMs) {
    if (!accumulator) return null;
    const total = cloudMisWeightProbeSummaryFromChannelMass(
        mode,
        accumulator.channelMass,
        accumulator.activePixels,
        accumulator.width,
        accumulator.height,
        samples,
        elapsedMs,
        pathTracingUniforms.uCloudMisWeightProbeMode ? pathTracingUniforms.uCloudMisWeightProbeMode.value : null,
        pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null
    );
    const totalContributionMass = total && Number.isFinite(total.contributionMass) ? total.contributionMass : 0;
    const totalEventMass = total && Number.isFinite(total.eventMass) ? total.eventMass : 0;
    const totalAverageContribution = total && Number.isFinite(total.averageContributionLuma) ? total.averageContributionLuma : 0;
    const bands = accumulator.bands.map((band) => {
        const summary = cloudMisWeightProbeSummaryFromChannelMass(
            mode,
            band.channelMass,
            band.activePixels,
            accumulator.width,
            accumulator.height,
            samples,
            elapsedMs,
            pathTracingUniforms.uCloudMisWeightProbeMode ? pathTracingUniforms.uCloudMisWeightProbeMode.value : null,
            pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null
        );
        const contributionShare = cloudProbeRatioOrNull(summary.contributionMass, totalContributionMass);
        const eventShare = cloudProbeRatioOrNull(summary.eventMass, totalEventMass);
        const averageContributionLift = cloudProbeRatioOrNull(summary.averageContributionLuma, totalAverageContribution);
        const weightedToUnweightedRatio = cloudProbeRatioOrNull(summary.averageContributionLuma, summary.averageUnweightedContributionLuma);
        return {
            label: band.label,
            screenYStart: band.screenYStart,
            screenYEnd: band.screenYEnd,
            pixelRowsFromTop: {
                start: band.startRowFromTop,
                endExclusive: band.endRowFromTop
            },
            activePixels: summary.activePixels,
            eventMass: summary.eventMass,
            contributionMass: summary.contributionMass,
            averageContributionLuma: summary.averageContributionLuma,
            averageUnweightedContributionLuma: summary.averageUnweightedContributionLuma,
            contributionShare: roundCloudProbeRatio(contributionShare),
            eventShare: roundCloudProbeRatio(eventShare),
            averageContributionLift: roundCloudProbeRatio(averageContributionLift),
            weightedToUnweightedRatio: roundCloudProbeRatio(weightedToUnweightedRatio),
            channelMass: summary.channelMass
        };
    });
    return {
        mode: total.mode,
        modeLabel: total.modeLabel,
        width: total.width,
        height: total.height,
        samples: total.samples,
        activePixels: total.activePixels,
        eventMass: total.eventMass,
        contributionMass: total.contributionMass,
        averageContributionLuma: total.averageContributionLuma,
        averageUnweightedContributionLuma: total.averageUnweightedContributionLuma,
        channelMass: total.channelMass,
        bands
    };
}

function cloudDirectNeeTopBandHistogramIndex(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return 0;
    }
    const minLog = CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_LOG_MIN;
    const maxLog = CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_LOG_MAX;
    const logValue = Math.log2(value);
    const normalized = (Math.min(maxLog, Math.max(minLog, logValue)) - minLog) / (maxLog - minLog);
    return Math.max(0, Math.min(
        CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_HISTOGRAM_BINS - 1,
        Math.floor(normalized * CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_HISTOGRAM_BINS)
    ));
}

function cloudDirectNeeTopBandHistogramValue(index) {
    const minLog = CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_LOG_MIN;
    const maxLog = CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_LOG_MAX;
    const t = (Math.max(0, Math.min(CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_HISTOGRAM_BINS - 1, index)) + 0.5) /
        CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_HISTOGRAM_BINS;
    return Math.pow(2, minLog + t * (maxLog - minLog));
}

function createCloudDirectNeeTopBandPercentileAccumulator(height) {
    const topBand = CLOUD_DIRECT_NEE_SCREEN_BANDS[0];
    return {
        label: topBand.label,
        screenYStart: topBand.start,
        screenYEnd: topBand.end,
        startRowFromTop: 0,
        endRowFromTop: Math.floor(topBand.end * height),
        activePixels: 0,
        eventMass: 0,
        contributionMass: 0,
        unweightedContributionMass: 0,
        minContributionLuma: Infinity,
        maxContributionLuma: 0,
        histogram: new Array(CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_HISTOGRAM_BINS).fill(0)
    };
}

function readCloudDirectNeeTopBandPercentileSample(mode) {
    if (!renderer || !pathTracingRenderTarget || !pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    renderCloudVisibilityProbeReadbackSampleIfNeeded(3);

    const width = pathTracingRenderTarget.width;
    const height = pathTracingRenderTarget.height;
    const data = new Float32Array(width * height * 4);
    const topBand = createCloudDirectNeeTopBandPercentileAccumulator(height);
    const signalThreshold = 1e-7;

    renderer.readRenderTargetPixels(pathTracingRenderTarget, 0, 0, width, height, data);

    for (let y = 0; y < height; y++) {
        const rowFromTop = height - 1 - y;
        if (rowFromTop < topBand.startRowFromTop || rowFromTop >= topBand.endRowFromTop) {
            continue;
        }
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (g <= signalThreshold || r + g + b <= signalThreshold) {
                continue;
            }
            const contributionLuma = r / g;
            if (!Number.isFinite(contributionLuma)) {
                continue;
            }
            topBand.activePixels++;
            topBand.eventMass += g;
            topBand.contributionMass += r;
            topBand.unweightedContributionMass += b;
            topBand.minContributionLuma = Math.min(topBand.minContributionLuma, contributionLuma);
            topBand.maxContributionLuma = Math.max(topBand.maxContributionLuma, contributionLuma);
            topBand.histogram[cloudDirectNeeTopBandHistogramIndex(contributionLuma)]++;
        }
    }

    return {
        mode: normalizeCloudMisWeightProbeMode(mode),
        width,
        height,
        topBand
    };
}

function mergeCloudDirectNeeTopBandPercentileSample(accumulator, sample) {
    if (!sample) return accumulator;
    if (!accumulator) {
        return {
            mode: sample.mode,
            width: sample.width,
            height: sample.height,
            topBand: {
                ...sample.topBand,
                histogram: sample.topBand.histogram.slice()
            }
        };
    }
    const band = accumulator.topBand;
    const sampleBand = sample.topBand;
    band.activePixels += sampleBand.activePixels;
    band.eventMass += sampleBand.eventMass;
    band.contributionMass += sampleBand.contributionMass;
    band.unweightedContributionMass += sampleBand.unweightedContributionMass;
    band.minContributionLuma = Math.min(band.minContributionLuma, sampleBand.minContributionLuma);
    band.maxContributionLuma = Math.max(band.maxContributionLuma, sampleBand.maxContributionLuma);
    for (let i = 0; i < band.histogram.length; i++) {
        band.histogram[i] += sampleBand.histogram[i];
    }
    return accumulator;
}

function cloudDirectNeeTopBandPercentileFromHistogram(histogram, activePixels, percentile) {
    if (!Array.isArray(histogram) || activePixels <= 0) {
        return null;
    }
    const targetRank = Math.max(1, Math.ceil(activePixels * percentile));
    let cumulative = 0;
    for (let i = 0; i < histogram.length; i++) {
        cumulative += histogram[i];
        if (cumulative >= targetRank) {
            return Number(cloudDirectNeeTopBandHistogramValue(i).toExponential(6));
        }
    }
    return Number(cloudDirectNeeTopBandHistogramValue(histogram.length - 1).toExponential(6));
}

function cloudDirectNeeTopBandPercentileResultFromAccumulator(mode, accumulator, samples, elapsedMs) {
    if (!accumulator) return null;
    const band = accumulator.topBand;
    const p50 = cloudDirectNeeTopBandPercentileFromHistogram(band.histogram, band.activePixels, 0.50);
    const p90 = cloudDirectNeeTopBandPercentileFromHistogram(band.histogram, band.activePixels, 0.90);
    const p99 = cloudDirectNeeTopBandPercentileFromHistogram(band.histogram, band.activePixels, 0.99);
    const maxContribution = Number.isFinite(band.maxContributionLuma) ? Number(band.maxContributionLuma.toExponential(6)) : null;
    const p99ToP50 = roundCloudProbeRatio(cloudProbeRatioOrNull(p99, p50));
    const maxToP50 = roundCloudProbeRatio(cloudProbeRatioOrNull(maxContribution, p50));
    const p90ToP50 = roundCloudProbeRatio(cloudProbeRatioOrNull(p90, p50));
    const averageContributionLuma = band.eventMass > 0 ? band.contributionMass / band.eventMass : null;
    const averageUnweightedContributionLuma = band.eventMass > 0 ? band.unweightedContributionMass / band.eventMass : null;
    return {
        mode: normalizeCloudMisWeightProbeMode(mode),
        modeLabel: CLOUD_MIS_WEIGHT_PROBE_MODE_LABELS[normalizeCloudMisWeightProbeMode(mode)],
        width: accumulator.width,
        height: accumulator.height,
        samples,
        waitElapsedMs: Math.round(elapsedMs),
        topBand: {
            label: band.label,
            screenYStart: band.screenYStart,
            screenYEnd: band.screenYEnd,
            pixelRowsFromTop: {
                start: band.startRowFromTop,
                endExclusive: band.endRowFromTop
            },
            activePixels: band.activePixels,
            eventMass: Number(band.eventMass.toFixed(6)),
            contributionMass: Number(band.contributionMass.toFixed(6)),
            averageContributionLuma: Number.isFinite(averageContributionLuma) ? Number(averageContributionLuma.toExponential(6)) : null,
            averageUnweightedContributionLuma: Number.isFinite(averageUnweightedContributionLuma) ? Number(averageUnweightedContributionLuma.toExponential(6)) : null
        },
        topBandContributionPercentiles: {
            method: 'log2Histogram',
            histogramBins: CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_HISTOGRAM_BINS,
            p50,
            p90,
            p99,
            max: maxContribution,
            min: Number.isFinite(band.minContributionLuma) ? Number(band.minContributionLuma.toExponential(6)) : null
        },
        topBandP90ToP50Ratio: p90ToP50,
        topBandP99ToP50Ratio: p99ToP50,
        topBandHotspotDominanceRatio: maxToP50,
        topBandHotspotDominatesMedian: Boolean(Number.isFinite(maxToP50) && maxToP50 >= 10),
        topBandP99DominatesMedian: Boolean(Number.isFinite(p99ToP50) && p99ToP50 >= 4)
    };
}

async function measureCloudDirectNeeTopBandPercentiles(mode, targetSamples, timeoutMs) {
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 1));
    const startedAt = performance.now();
    let accumulator = null;

    for (let i = 0; i < target; i++) {
        window.setCloudMisWeightProbe(mode);
        const sample = readCloudDirectNeeTopBandPercentileSample(mode);
        accumulator = mergeCloudDirectNeeTopBandPercentileSample(accumulator, sample);
    }

    return cloudDirectNeeTopBandPercentileResultFromAccumulator(
        mode,
        accumulator,
        target,
        performance.now() - startedAt
    );
}

function setCloudDirectNeeContributionSplitProbe(contributionMode) {
    window.setCloudMisWeightProbe(5);
    if (pathTracingUniforms && pathTracingUniforms.uCloudContributionProbeMode) {
        pathTracingUniforms.uCloudContributionProbeMode.value = contributionMode;
    }
    if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial) {
        pathTracingMaterial.uniformsNeedUpdate = true;
    }
}

async function measureCloudDirectNeeDiffuseCountContributionMode(contributionMode, targetSamples, timeoutMs) {
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 1));
    const startedAt = performance.now();
    const channelMass = { r: 0, g: 0, b: 0 };
    let activePixels = 0;
    let width = 0;
    let height = 0;

    for (let i = 0; i < target; i++) {
        setCloudDirectNeeContributionSplitProbe(contributionMode);
        renderCloudVisibilityProbeReadbackSampleIfNeeded(3);
        const summary = cloudMisWeightProbeReadbackSummary(5, {
            targetSamples: 1,
            timedOut: false,
            elapsedMs: 0
        });
        if (!summary) continue;
        channelMass.r += summary.channelMass.r;
        channelMass.g += summary.channelMass.g;
        channelMass.b += summary.channelMass.b;
        activePixels += summary.activePixels;
        width = summary.width;
        height = summary.height;
    }

    return cloudMisWeightProbeSummaryFromChannelMass(
        5,
        channelMass,
        activePixels,
        width,
        height,
        target,
        performance.now() - startedAt,
        pathTracingUniforms.uCloudMisWeightProbeMode ? pathTracingUniforms.uCloudMisWeightProbeMode.value : null,
        pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null
    );
}

function createCloudVisibleSurfaceHotspotAccumulator(label) {
    return {
        label,
        activePixels: 0,
        eventMass: 0,
        contributionMass: 0,
        unweightedContributionMass: 0,
        minContributionLuma: Infinity,
        maxContributionLuma: 0,
        histogram: new Array(CLOUD_DIRECT_NEE_TOP_BAND_PERCENTILE_HISTOGRAM_BINS).fill(0)
    };
}

function readCloudVisibleSurfaceHotspotSample(contributionMode, label) {
    if (!renderer || !pathTracingRenderTarget || !pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    setCloudDirectNeeContributionSplitProbe(contributionMode);
    renderCloudVisibilityProbeReadbackSampleIfNeeded(3);

    const width = pathTracingRenderTarget.width;
    const height = pathTracingRenderTarget.height;
    const data = new Float32Array(width * height * 4);
    const surface = createCloudVisibleSurfaceHotspotAccumulator(label);
    const signalThreshold = 1e-7;

    renderer.readRenderTargetPixels(pathTracingRenderTarget, 0, 0, width, height, data);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (g <= signalThreshold || r + g + b <= signalThreshold) {
                continue;
            }
            const contributionLuma = r / g;
            if (!Number.isFinite(contributionLuma)) {
                continue;
            }
            surface.activePixels++;
            surface.eventMass += g;
            surface.contributionMass += r;
            surface.unweightedContributionMass += b;
            surface.minContributionLuma = Math.min(surface.minContributionLuma, contributionLuma);
            surface.maxContributionLuma = Math.max(surface.maxContributionLuma, contributionLuma);
            surface.histogram[cloudDirectNeeTopBandHistogramIndex(contributionLuma)]++;
        }
    }

    return {
        contributionMode,
        label,
        width,
        height,
        surface
    };
}

function mergeCloudVisibleSurfaceHotspotSample(accumulator, sample) {
    if (!sample) return accumulator;
    if (!accumulator) {
        return {
            contributionMode: sample.contributionMode,
            label: sample.label,
            width: sample.width,
            height: sample.height,
            surface: {
                ...sample.surface,
                histogram: sample.surface.histogram.slice()
            }
        };
    }
    const surface = accumulator.surface;
    const sampleSurface = sample.surface;
    surface.activePixels += sampleSurface.activePixels;
    surface.eventMass += sampleSurface.eventMass;
    surface.contributionMass += sampleSurface.contributionMass;
    surface.unweightedContributionMass += sampleSurface.unweightedContributionMass;
    surface.minContributionLuma = Math.min(surface.minContributionLuma, sampleSurface.minContributionLuma);
    surface.maxContributionLuma = Math.max(surface.maxContributionLuma, sampleSurface.maxContributionLuma);
    for (let i = 0; i < surface.histogram.length; i++) {
        surface.histogram[i] += sampleSurface.histogram[i];
    }
    return accumulator;
}

function cloudVisibleSurfaceHotspotHistogramCountAtOrAbove(histogram, threshold) {
    if (!Array.isArray(histogram) || !Number.isFinite(threshold)) {
        return 0;
    }
    let count = 0;
    for (let i = 0; i < histogram.length; i++) {
        if (cloudDirectNeeTopBandHistogramValue(i) >= threshold) {
            count += histogram[i];
        }
    }
    return count;
}

async function measureCloudVisibleSurfaceHotspotContributionMode(surfaceClass, targetSamples, timeoutMs) {
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 1));
    const startedAt = performance.now();
    let accumulator = null;

    for (let i = 0; i < target; i++) {
        const sample = readCloudVisibleSurfaceHotspotSample(surfaceClass.contributionMode, surfaceClass.label);
        accumulator = mergeCloudVisibleSurfaceHotspotSample(accumulator, sample);
    }

    if (!accumulator) return null;
    const surface = accumulator.surface;
    const p50 = cloudDirectNeeTopBandPercentileFromHistogram(surface.histogram, surface.activePixels, 0.50);
    const p90 = cloudDirectNeeTopBandPercentileFromHistogram(surface.histogram, surface.activePixels, 0.90);
    const p99 = cloudDirectNeeTopBandPercentileFromHistogram(surface.histogram, surface.activePixels, 0.99);
    const maxContribution = Number.isFinite(surface.maxContributionLuma) ? Number(surface.maxContributionLuma.toExponential(6)) : null;
    const averageContributionLuma = surface.eventMass > 0 ? surface.contributionMass / surface.eventMass : null;
    const averageUnweightedContributionLuma = surface.eventMass > 0 ? surface.unweightedContributionMass / surface.eventMass : null;
    const hotspotThreshold = Number.isFinite(p50) ? Number(Math.max(p50 * 10, 1e-6).toExponential(6)) : null;
    const hotspotPixelCount = cloudVisibleSurfaceHotspotHistogramCountAtOrAbove(surface.histogram, hotspotThreshold);

    return {
        label: surfaceClass.label,
        contributionMode: surfaceClass.contributionMode,
        width: accumulator.width,
        height: accumulator.height,
        samples: target,
        waitElapsedMs: Math.round(performance.now() - startedAt),
        contributionEventSamples: surface.activePixels,
        eventMass: Number(surface.eventMass.toFixed(6)),
        contributionMass: Number(surface.contributionMass.toFixed(6)),
        averageContributionLuma: Number.isFinite(averageContributionLuma) ? Number(averageContributionLuma.toExponential(6)) : null,
        averageUnweightedContributionLuma: Number.isFinite(averageUnweightedContributionLuma) ? Number(averageUnweightedContributionLuma.toExponential(6)) : null,
        contributionPercentiles: {
            method: 'log2Histogram',
            p50,
            p90,
            p99,
            max: maxContribution,
            min: Number.isFinite(surface.minContributionLuma) ? Number(surface.minContributionLuma.toExponential(6)) : null
        },
        p90ToP50Ratio: roundCloudProbeRatio(cloudProbeRatioOrNull(p90, p50)),
        p99ToP50Ratio: roundCloudProbeRatio(cloudProbeRatioOrNull(p99, p50)),
        maxToP50Ratio: roundCloudProbeRatio(cloudProbeRatioOrNull(maxContribution, p50)),
        hotspotThreshold,
        hotspotPixelCount,
        histogram: surface.histogram
    };
}

async function measureCloudMisWeightProbeScreenBands(mode, targetSamples, timeoutMs) {
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 1));
    const startedAt = performance.now();
    let accumulator = null;

    for (let i = 0; i < target; i++) {
        window.setCloudMisWeightProbe(mode);
        const sample = readCloudMisWeightProbeScreenBandSample(mode);
        accumulator = mergeCloudDirectNeeScreenBandSample(accumulator, sample);
    }

    return cloudDirectNeeScreenBandResultFromAccumulator(
        mode,
        accumulator,
        target,
        performance.now() - startedAt
    );
}

window.reportCloudDirectNeeScreenBandProbeAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 16));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const expectedUniformWeightedLuma = 0.25;
    const expectedUniformUnweightedLuma = 0.75;

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const uniformBandSentinel = await measureCloudMisWeightProbeScreenBands(8, 1, timeout);
        const uniformBandSentinelPass = Boolean(uniformBandSentinel && uniformBandSentinel.bands.every((band) =>
            band.eventMass > 0 &&
            nearlyEqualProbeNumber(band.averageContributionLuma, expectedUniformWeightedLuma, 1e-3) &&
            nearlyEqualProbeNumber(band.averageUnweightedContributionLuma, expectedUniformUnweightedLuma, 1e-3)
        ));
        const directNeeBandProbe = await measureCloudMisWeightProbeScreenBands(5, target, timeout);
        const directNeeScreenBands = directNeeBandProbe ? directNeeBandProbe.bands : [];
        const topBand = directNeeScreenBands.find((band) => band.label === 'top') || null;
        const bottomBand = directNeeScreenBands.find((band) => band.label === 'bottom') || null;
        const topVsBottomAverageContributionRatio = roundCloudProbeRatio(cloudProbeRatioOrNull(
            topBand ? topBand.averageContributionLuma : null,
            bottomBand ? bottomBand.averageContributionLuma : null
        ));
        const topContributionLiftVsEvents = roundCloudProbeRatio(cloudProbeRatioOrNull(
            topBand ? topBand.contributionShare : null,
            topBand ? topBand.eventShare : null
        ));
        const topBandContributionDominatesEvents = Boolean(Number.isFinite(topContributionLiftVsEvents) && topContributionLiftVsEvents > 1.25);
        const topAverageContributionDominatesBottom = Boolean(Number.isFinite(topVsBottomAverageContributionRatio) && topVsBottomAverageContributionRatio > 1.25);
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudDirectNeeScreenBandProbe',
            renderPathMutation: false,
            probeShaderMutation: false,
            normalRenderProbeMode: 0,
            directNeeProbeMode: 5,
            screenBandOrigin: 'topToBottom',
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            uniformBandSentinelPass,
            uniformBandSentinel,
            directNeeTotal: directNeeBandProbe ? {
                eventMass: directNeeBandProbe.eventMass,
                contributionMass: directNeeBandProbe.contributionMass,
                averageContributionLuma: directNeeBandProbe.averageContributionLuma,
                averageUnweightedContributionLuma: directNeeBandProbe.averageUnweightedContributionLuma
            } : null,
            directNeeScreenBands,
            topContributionShare: topBand ? topBand.contributionShare : null,
            topEventShare: topBand ? topBand.eventShare : null,
            bottomContributionShare: bottomBand ? bottomBand.contributionShare : null,
            bottomEventShare: bottomBand ? bottomBand.eventShare : null,
            topVsBottomAverageContributionRatio,
            topContributionLiftVsEvents,
            topBandContributionDominatesEvents,
            topAverageContributionDominatesBottom,
            interpretation: {
                sentinelMeaning: 'screenBandReadbackIsAlignedWithProbeBuffer',
                contributionShareMeaning: 'bandShareOfTotalWeightedDirectNeeLuma',
                eventShareMeaning: 'bandShareOfDirectNeeEvents',
                liftMeaning: 'contributionShareDividedByEventShare',
                topBandMeaning: 'topQuarterOfDisplayedFrame'
            },
            recommendedNextStep: !uniformBandSentinelPass
                ? 'fixScreenBandReadbackBeforeDecision'
                : ((topBandContributionDominatesEvents || topAverageContributionDominatesBottom)
                    ? 'inspectCloudDirectNeeTopBandHotspots'
                    : 'lookAtIndirectDiffuseTailOrSnapshotHotspotStability')
        };
        console.table(directNeeScreenBands.map((band) => ({
            label: band.label,
            eventMass: band.eventMass,
            contributionMass: band.contributionMass,
            averageContributionLuma: band.averageContributionLuma,
            contributionShare: band.contributionShare,
            eventShare: band.eventShare,
            averageContributionLift: band.averageContributionLift
        })));
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportCloudDirectNeeTopBandPercentileProbeAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 64));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const expectedUniformWeightedLuma = 0.25;

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const uniformTopBandSentinel = await measureCloudDirectNeeTopBandPercentiles(8, 1, timeout);
        const uniformTopBandSentinelPass = Boolean(
            uniformTopBandSentinel &&
            uniformTopBandSentinel.topBand &&
            uniformTopBandSentinel.topBand.eventMass > 0 &&
            nearlyEqualProbeNumber(uniformTopBandSentinel.topBandContributionPercentiles.p50, expectedUniformWeightedLuma, 0.02) &&
            nearlyEqualProbeNumber(uniformTopBandSentinel.topBandContributionPercentiles.p90, expectedUniformWeightedLuma, 0.02) &&
            nearlyEqualProbeNumber(uniformTopBandSentinel.topBandContributionPercentiles.p99, expectedUniformWeightedLuma, 0.02)
        );
        const directNeeTopBand = await measureCloudDirectNeeTopBandPercentiles(5, target, timeout);
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudDirectNeeTopBandPercentileProbe',
            renderPathMutation: false,
            probeShaderMutation: false,
            normalRenderProbeMode: 0,
            directNeeProbeMode: 5,
            screenBandOrigin: 'topToBottom',
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            uniformTopBandSentinelPass,
            uniformTopBandSentinel,
            topBand: directNeeTopBand ? directNeeTopBand.topBand : null,
            topBandContributionPercentiles: directNeeTopBand ? directNeeTopBand.topBandContributionPercentiles : null,
            topBandP90ToP50Ratio: directNeeTopBand ? directNeeTopBand.topBandP90ToP50Ratio : null,
            topBandP99ToP50Ratio: directNeeTopBand ? directNeeTopBand.topBandP99ToP50Ratio : null,
            topBandHotspotDominanceRatio: directNeeTopBand ? directNeeTopBand.topBandHotspotDominanceRatio : null,
            topBandHotspotDominatesMedian: directNeeTopBand ? directNeeTopBand.topBandHotspotDominatesMedian : null,
            topBandP99DominatesMedian: directNeeTopBand ? directNeeTopBand.topBandP99DominatesMedian : null,
            interpretation: {
                percentileMeaning: 'per-event weightedCloudDirectNeeLumaInsideTopQuarter',
                p50Meaning: 'typicalTopBandDirectNeeEvent',
                p99Meaning: 'brightTailDirectNeeEvent',
                maxMeaning: 'largestObservedTopBandDirectNeeEvent',
                hotspotDominanceMeaning: 'maxDividedByP50',
                p99DominanceMeaning: 'p99DividedByP50',
                nextQuestion: 'primarySurfaceVsBouncedSurfaceCloudNee'
            },
            recommendedNextStep: 'directNeeDiffuseCountSplitProbe'
        };
        if (result.topBandContributionPercentiles) {
            console.table([{
                p50: result.topBandContributionPercentiles.p50,
                p90: result.topBandContributionPercentiles.p90,
                p99: result.topBandContributionPercentiles.p99,
                max: result.topBandContributionPercentiles.max,
                p90ToP50: result.topBandP90ToP50Ratio,
                p99ToP50: result.topBandP99ToP50Ratio,
                maxToP50: result.topBandHotspotDominanceRatio
            }]);
        }
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportCloudDirectNeeDiffuseCountSplitProbeAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 64));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const allDirectNeeContribution = await measureCloudMisWeightProbeMode(5, target, timeout);
        const primaryDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(4, target, timeout);
        const bouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(5, target, timeout);
        const primaryContributionMass = primaryDirectNeeContribution ? primaryDirectNeeContribution.contributionMass : null;
        const bouncedContributionMass = bouncedDirectNeeContribution ? bouncedDirectNeeContribution.contributionMass : null;
        const allContributionMass = allDirectNeeContribution ? allDirectNeeContribution.contributionMass : null;
        const splitContributionMass = Number.isFinite(primaryContributionMass) && Number.isFinite(bouncedContributionMass)
            ? Number((primaryContributionMass + bouncedContributionMass).toFixed(6))
            : null;
        const primaryContributionShare = roundCloudProbeRatio(cloudProbeRatioOrNull(primaryContributionMass, splitContributionMass));
        const bouncedContributionShare = roundCloudProbeRatio(cloudProbeRatioOrNull(bouncedContributionMass, splitContributionMass));
        const primaryVsBouncedContributionRatio = roundCloudProbeRatio(cloudProbeRatioOrNull(primaryContributionMass, bouncedContributionMass));
        const splitVsAllContributionRatio = roundCloudProbeRatio(cloudProbeRatioOrNull(splitContributionMass, allContributionMass));
        const primaryDirectNeeDominates = Boolean(Number.isFinite(primaryContributionShare) && primaryContributionShare >= 0.65);
        const bouncedDirectNeeDominates = Boolean(Number.isFinite(bouncedContributionShare) && bouncedContributionShare >= 0.65);
        const dominantDirectNeeSurfaceClass = primaryDirectNeeDominates
            ? 'primarySurface'
            : (bouncedDirectNeeDominates ? 'bouncedSurface' : (splitContributionMass > 0 ? 'mixed' : 'noEvents'));
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudDirectNeeDiffuseCountSplitProbe',
            renderPathMutation: false,
            probeShaderMutation: true,
            normalRenderProbeMode: 0,
            directNeeProbeMode: 5,
            contributionSplitModes: {
                primarySurface: 4,
                bouncedSurface: 5
            },
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            allDirectNeeContribution,
            primaryDirectNeeContribution,
            bouncedDirectNeeContribution,
            splitContributionMass,
            primaryContributionShare,
            bouncedContributionShare,
            primaryVsBouncedContributionRatio,
            splitVsAllContributionRatio,
            splitMassMatchesAllContribution: Boolean(Number.isFinite(splitVsAllContributionRatio) &&
                splitVsAllContributionRatio >= 0.9 &&
                splitVsAllContributionRatio <= 1.1),
            primaryDirectNeeDominates,
            bouncedDirectNeeDominates,
            dominantDirectNeeSurfaceClass,
            interpretation: {
                primaryMeaning: 'diffuseCountZeroCameraVisibleSurfaceDirectNee',
                bouncedMeaning: 'diffuseCountAtLeastOneIndirectSurfaceDirectNee',
                splitVsAllMeaning: 'primaryPlusBouncedContributionDividedByAllDirectNeeContribution',
                nextQuestion: 'chooseSamplingFixByDominantSurfaceClass'
            },
            recommendedNextStep: primaryDirectNeeDominates
                ? 'testPrimarySurfaceCloudDirectNeeSamplingStrategy'
                : (bouncedDirectNeeDominates ? 'inspectIndirectDiffuseCloudNeeTail' : 'comparePrimaryAndBouncedHotspotPercentiles')
        };
        console.table({
            allContributionMass,
            primaryContributionMass,
            bouncedContributionMass,
            splitContributionMass: result.splitContributionMass,
            primaryContributionShare: result.primaryContributionShare,
            bouncedContributionShare: result.bouncedContributionShare,
            primaryVsBouncedContributionRatio: result.primaryVsBouncedContributionRatio,
            splitVsAllContributionRatio: result.splitVsAllContributionRatio,
            dominantDirectNeeSurfaceClass: result.dominantDirectNeeSurfaceClass
        });
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportCloudBouncedDirectNeeFloorGikProbeAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 8));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const bouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(5, target, timeout);
        const floorBouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(6, target, timeout);
        const gikBouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(7, target, timeout);
        const otherBouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(8, target, timeout);
        const bouncedContributionMass = bouncedDirectNeeContribution ? bouncedDirectNeeContribution.contributionMass : null;
        const floorContributionMass = floorBouncedDirectNeeContribution ? floorBouncedDirectNeeContribution.contributionMass : null;
        const gikContributionMass = gikBouncedDirectNeeContribution ? gikBouncedDirectNeeContribution.contributionMass : null;
        const otherContributionMass = otherBouncedDirectNeeContribution ? otherBouncedDirectNeeContribution.contributionMass : null;
        const floorPlusGikContributionMass = Number.isFinite(floorContributionMass) && Number.isFinite(gikContributionMass)
            ? Number((floorContributionMass + gikContributionMass).toFixed(6))
            : null;
        const classifiedContributionMass = Number.isFinite(floorPlusGikContributionMass) && Number.isFinite(otherContributionMass)
            ? Number((floorPlusGikContributionMass + otherContributionMass).toFixed(6))
            : null;
        const floorContributionShare = roundCloudProbeRatio(cloudProbeRatioOrNull(floorContributionMass, classifiedContributionMass));
        const gikContributionShare = roundCloudProbeRatio(cloudProbeRatioOrNull(gikContributionMass, classifiedContributionMass));
        const otherContributionShare = roundCloudProbeRatio(cloudProbeRatioOrNull(otherContributionMass, classifiedContributionMass));
        const floorPlusGikContributionShare = roundCloudProbeRatio(cloudProbeRatioOrNull(floorPlusGikContributionMass, classifiedContributionMass));
        const classifiedVsBouncedContributionRatio = roundCloudProbeRatio(cloudProbeRatioOrNull(classifiedContributionMass, bouncedContributionMass));
        const floorPlusGikDominates = Boolean(Number.isFinite(floorPlusGikContributionShare) && floorPlusGikContributionShare >= 0.65);
        const dominantBouncedDirectNeeReceiverClass = [
            { label: 'floor', mass: floorContributionMass },
            { label: 'gikPanel', mass: gikContributionMass },
            { label: 'otherSurface', mass: otherContributionMass }
        ].reduce((best, item) => (Number.isFinite(item.mass) && item.mass > best.mass ? item : best), { label: 'noEvents', mass: -1 }).label;
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudBouncedDirectNeeFloorGikProbe',
            renderPathMutation: false,
            probeShaderMutation: true,
            normalRenderProbeMode: 0,
            directNeeProbeMode: 5,
            contributionSplitModes: {
                bouncedSurface: 5,
                floorBouncedSurface: 6,
                gikBouncedSurface: 7,
                otherBouncedSurface: 8
            },
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            bouncedDirectNeeContribution,
            floorBouncedDirectNeeContribution,
            gikBouncedDirectNeeContribution,
            otherBouncedDirectNeeContribution,
            floorPlusGikContributionMass,
            classifiedContributionMass,
            floorContributionShare,
            gikContributionShare,
            otherContributionShare,
            floorPlusGikContributionShare,
            classifiedVsBouncedContributionRatio,
            classifiedMassMatchesBouncedContribution: Boolean(Number.isFinite(classifiedVsBouncedContributionRatio) &&
                classifiedVsBouncedContributionRatio >= 0.9 &&
                classifiedVsBouncedContributionRatio <= 1.1),
            floorPlusGikDominates,
            dominantBouncedDirectNeeReceiverClass,
            interpretation: {
                floorMeaning: 'bouncedDirectNeeFromStructuralFloorReceiver',
                gikMeaning: 'bouncedDirectNeeFromAcousticPanelReceiver',
                otherMeaning: 'bouncedDirectNeeFromOtherReceivers',
                nextQuestion: 'floorGikCandidateOrSplitOtherReceivers'
            },
            recommendedNextStep: floorPlusGikDominates
                ? 'testFloorGikBouncedNeeCandidate'
                : 'inspectOtherBouncedDirectNeeReceiverClasses'
        };
        console.table({
            bouncedContributionMass,
            floorContributionMass,
            gikContributionMass,
            otherContributionMass,
            floorPlusGikContributionMass: result.floorPlusGikContributionMass,
            classifiedContributionMass: result.classifiedContributionMass,
            floorContributionShare: result.floorContributionShare,
            gikContributionShare: result.gikContributionShare,
            otherContributionShare: result.otherContributionShare,
            floorPlusGikContributionShare: result.floorPlusGikContributionShare,
            classifiedVsBouncedContributionRatio: result.classifiedVsBouncedContributionRatio,
            dominantBouncedDirectNeeReceiverClass: result.dominantBouncedDirectNeeReceiverClass
        });
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportCloudBouncedDirectNeeReceiverClassProbeAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 1));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const bouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(5, target, timeout);
        const floorBouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(6, target, timeout);
        const gikBouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(7, target, timeout);
        const ceilingBouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(9, target, timeout);
        const wallBouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(10, target, timeout);
        const objectBouncedDirectNeeContribution = await measureCloudDirectNeeDiffuseCountContributionMode(11, target, timeout);
        const classMasses = {
            floor: floorBouncedDirectNeeContribution ? floorBouncedDirectNeeContribution.contributionMass : null,
            gikPanel: gikBouncedDirectNeeContribution ? gikBouncedDirectNeeContribution.contributionMass : null,
            ceiling: ceilingBouncedDirectNeeContribution ? ceilingBouncedDirectNeeContribution.contributionMass : null,
            wall: wallBouncedDirectNeeContribution ? wallBouncedDirectNeeContribution.contributionMass : null,
            object: objectBouncedDirectNeeContribution ? objectBouncedDirectNeeContribution.contributionMass : null
        };
        const classifiedContributionMass = Object.values(classMasses).every(Number.isFinite)
            ? Number(Object.values(classMasses).reduce((sum, mass) => sum + mass, 0).toFixed(6))
            : null;
        const bouncedContributionMass = bouncedDirectNeeContribution ? bouncedDirectNeeContribution.contributionMass : null;
        const receiverClassShares = Object.fromEntries(Object.entries(classMasses).map(([label, mass]) => [
            label,
            roundCloudProbeRatio(cloudProbeRatioOrNull(mass, classifiedContributionMass))
        ]));
        const dominant = Object.entries(classMasses).reduce(
            (best, [label, mass]) => (Number.isFinite(mass) && mass > best.mass ? { label, mass } : best),
            { label: 'noEvents', mass: -1 }
        );
        const dominantReceiverClassContributionShare = roundCloudProbeRatio(
            cloudProbeRatioOrNull(dominant.mass, classifiedContributionMass)
        );
        const classifiedVsBouncedContributionRatio = roundCloudProbeRatio(
            cloudProbeRatioOrNull(classifiedContributionMass, bouncedContributionMass)
        );
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudBouncedDirectNeeReceiverClassProbe',
            renderPathMutation: false,
            probeShaderMutation: true,
            normalRenderProbeMode: 0,
            directNeeProbeMode: 5,
            contributionSplitModes: {
                bouncedSurface: 5,
                floor: 6,
                gikPanel: 7,
                ceiling: 9,
                wall: 10,
                object: 11
            },
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            bouncedDirectNeeContribution,
            floorBouncedDirectNeeContribution,
            gikBouncedDirectNeeContribution,
            ceilingBouncedDirectNeeContribution,
            wallBouncedDirectNeeContribution,
            objectBouncedDirectNeeContribution,
            classMasses,
            classifiedContributionMass,
            receiverClassShares,
            classifiedVsBouncedContributionRatio,
            classifiedMassMatchesBouncedContribution: Boolean(Number.isFinite(classifiedVsBouncedContributionRatio) &&
                classifiedVsBouncedContributionRatio >= 0.9 &&
                classifiedVsBouncedContributionRatio <= 1.1),
            dominantBouncedDirectNeeReceiverClass: dominant.label,
            dominantReceiverClassContributionMass: Number.isFinite(dominant.mass) ? Number(dominant.mass.toFixed(6)) : null,
            dominantReceiverClassContributionShare,
            interpretation: {
                floorMeaning: 'structuralFloorReceiver',
                gikMeaning: 'acousticPanelReceiver',
                ceilingMeaning: 'structuralCeilingReceiver',
                wallMeaning: 'structuralWallOrBeamReceiver',
                objectMeaning: 'furnitureDoorSpeakerOutletOrTrackReceiver',
                nextQuestion: 'candidatePatchForDominantReceiverClass'
            },
            recommendedNextStep: dominant.label === 'ceiling'
                ? 'testCeilingBouncedNeeCleanupCandidate'
                : (dominant.label === 'wall' ? 'testWallBouncedNeeCleanupCandidate' : 'splitDominantObjectReceiverClass')
        };
        console.table({
            bouncedContributionMass,
            classifiedContributionMass: result.classifiedContributionMass,
            floorContributionMass: classMasses.floor,
            gikContributionMass: classMasses.gikPanel,
            ceilingContributionMass: classMasses.ceiling,
            wallContributionMass: classMasses.wall,
            objectContributionMass: classMasses.object,
            floorShare: result.receiverClassShares.floor,
            gikShare: result.receiverClassShares.gikPanel,
            ceilingShare: result.receiverClassShares.ceiling,
            wallShare: result.receiverClassShares.wall,
            objectShare: result.receiverClassShares.object,
            classifiedVsBouncedContributionRatio: result.classifiedVsBouncedContributionRatio,
            dominantBouncedDirectNeeReceiverClass: result.dominantBouncedDirectNeeReceiverClass,
            dominantReceiverClassContributionShare: result.dominantReceiverClassContributionShare
        });
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportCloudVisibleSurfaceHotspotProbeAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 8));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const visibleSurfaceHotspotRows = [];
        for (const surfaceClass of CLOUD_VISIBLE_SURFACE_HOTSPOT_CLASSES) {
            const visiblePixelProbe = await measureCloudDirectNeeDiffuseCountContributionMode(surfaceClass.visiblePixelMode, target, timeout);
            const hotspotProbe = await measureCloudVisibleSurfaceHotspotContributionMode(surfaceClass, target, timeout);
            const visiblePixelSamples = visiblePixelProbe ? visiblePixelProbe.eventMass : null;
            const hotspotPixelDensity = roundCloudProbeRatio(cloudProbeRatioOrNull(
                hotspotProbe ? hotspotProbe.hotspotPixelCount : null,
                visiblePixelSamples
            ));
            const contributionEventDensity = roundCloudProbeRatio(cloudProbeRatioOrNull(
                hotspotProbe ? hotspotProbe.contributionEventSamples : null,
                visiblePixelSamples
            ));
            visibleSurfaceHotspotRows.push({
                label: surfaceClass.label,
                contributionMode: surfaceClass.contributionMode,
                visiblePixelMode: surfaceClass.visiblePixelMode,
                visiblePixelSamples,
                contributionEventSamples: hotspotProbe ? hotspotProbe.contributionEventSamples : null,
                contributionEventDensity,
                contributionMass: hotspotProbe ? hotspotProbe.contributionMass : null,
                averageContributionLuma: hotspotProbe ? hotspotProbe.averageContributionLuma : null,
                p50: hotspotProbe ? hotspotProbe.contributionPercentiles.p50 : null,
                p90: hotspotProbe ? hotspotProbe.contributionPercentiles.p90 : null,
                p99: hotspotProbe ? hotspotProbe.contributionPercentiles.p99 : null,
                max: hotspotProbe ? hotspotProbe.contributionPercentiles.max : null,
                p90ToP50Ratio: hotspotProbe ? hotspotProbe.p90ToP50Ratio : null,
                p99ToP50Ratio: hotspotProbe ? hotspotProbe.p99ToP50Ratio : null,
                maxToP50Ratio: hotspotProbe ? hotspotProbe.maxToP50Ratio : null,
                hotspotThreshold: hotspotProbe ? hotspotProbe.hotspotThreshold : null,
                hotspotPixelCount: hotspotProbe ? hotspotProbe.hotspotPixelCount : null,
                hotspotPixelDensity,
                visiblePixelProbe,
                hotspotProbe
            });
        }
        const dominantHotspot = visibleSurfaceHotspotRows.reduce((best, row) => (
            Number.isFinite(row.hotspotPixelDensity) && row.hotspotPixelDensity > best.hotspotPixelDensity
                ? row
                : best
        ), { label: 'noEvents', hotspotPixelDensity: -1 });
        const floorRow = visibleSurfaceHotspotRows.find((row) => row.label === 'floor') || null;
        const gikRow = visibleSurfaceHotspotRows.find((row) => row.label === 'gikPanel') || null;
        const floorGikHotspotPixelCount = Number((Number(floorRow ? floorRow.hotspotPixelCount : 0) + Number(gikRow ? gikRow.hotspotPixelCount : 0)).toFixed(6));
        const floorGikVisiblePixelSamples = Number((Number(floorRow ? floorRow.visiblePixelSamples : 0) + Number(gikRow ? gikRow.visiblePixelSamples : 0)).toFixed(6));
        const floorGikHotspotPixelDensity = roundCloudProbeRatio(cloudProbeRatioOrNull(floorGikHotspotPixelCount, floorGikVisiblePixelSamples));
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudVisibleSurfaceHotspotProbe',
            renderPathMutation: false,
            probeShaderMutation: true,
            normalRenderProbeMode: 0,
            directNeeProbeMode: 5,
            visibleSurfaceClasses: CLOUD_VISIBLE_SURFACE_HOTSPOT_CLASSES.map((surfaceClass) => ({
                label: surfaceClass.label,
                contributionMode: surfaceClass.contributionMode,
                visiblePixelMode: surfaceClass.visiblePixelMode
            })),
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            visibleSurfaceHotspotRows,
            dominantVisibleSurfaceHotspotClass: dominantHotspot.label,
            dominantVisibleSurfaceHotspotDensity: Number.isFinite(dominantHotspot.hotspotPixelDensity)
                ? dominantHotspot.hotspotPixelDensity
                : null,
            floorGikHotspotPixelCount,
            floorGikVisiblePixelSamples,
            floorGikHotspotPixelDensity,
            interpretation: {
                visibleSurfaceMeaning: 'firstCameraVisibleSurfaceClass',
                contributionMeaning: 'bouncedCloudDirectNeeContributionLandingOnThatVisibleSurface',
                hotspotThresholdMeaning: 'atLeastTenTimesThatSurfaceMedianContribution',
                densityMeaning: 'hotspotPixelCountDividedByVisiblePixelSamples',
                decisionMeaning: 'higherDensityMeansTheSurfaceReallyHasMoreBrightSpecksPerVisibleSample',
                sampleIndependenceWarning: 'targetSamplesCurrentlyScalesReadbackCountsAndDoesNotProveIndependentRandomStability'
            },
            recommendedNextStep: 'testDominantVisibleSurfaceCleanupCandidate'
        };
        console.table(visibleSurfaceHotspotRows.map((row) => ({
            label: row.label,
            visiblePixelSamples: row.visiblePixelSamples,
            contributionEventSamples: row.contributionEventSamples,
            contributionEventDensity: row.contributionEventDensity,
            p50: row.p50,
            p90: row.p90,
            p99: row.p99,
            max: row.max,
            maxToP50Ratio: row.maxToP50Ratio,
            hotspotThreshold: row.hotspotThreshold,
            hotspotPixelCount: row.hotspotPixelCount,
            hotspotPixelDensity: row.hotspotPixelDensity
        })));
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportCloudDarkVisibleSurfaceHotspotSourceProbeAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 4));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const visiblePixelProbeByMode = new Map();
        for (const visiblePixelMode of [17, 18]) {
            visiblePixelProbeByMode.set(
                visiblePixelMode,
                await measureCloudDirectNeeDiffuseCountContributionMode(visiblePixelMode, target, timeout)
            );
        }
        const visibleSurfaceHotspotThresholdBySurface = {};
        for (const surfaceClass of CLOUD_VISIBLE_SURFACE_HOTSPOT_CLASSES.filter((surfaceClass) =>
            surfaceClass.label === 'floor' || surfaceClass.label === 'gikPanel'
        )) {
            const surfaceProbe = await measureCloudVisibleSurfaceHotspotContributionMode(surfaceClass, target, timeout);
            visibleSurfaceHotspotThresholdBySurface[surfaceClass.label] = surfaceProbe ? surfaceProbe.hotspotThreshold : null;
        }
        const darkVisibleSurfaceHotspotSourceRows = [];
        for (const sourceClass of CLOUD_DARK_VISIBLE_SURFACE_HOTSPOT_SOURCE_CLASSES) {
            const sourceProbe = await measureCloudVisibleSurfaceHotspotContributionMode({
                label: `${sourceClass.visibleSurface}From${sourceClass.sourceSurface}`,
                contributionMode: sourceClass.contributionMode
            }, target, timeout);
            const visiblePixelProbe = visiblePixelProbeByMode.get(sourceClass.visiblePixelMode) || null;
            const visiblePixelSamples = visiblePixelProbe ? visiblePixelProbe.eventMass : null;
            const visibleSurfaceHotspotThreshold = visibleSurfaceHotspotThresholdBySurface[sourceClass.visibleSurface];
            const absoluteHotspotPixelCount = sourceProbe
                ? cloudVisibleSurfaceHotspotHistogramCountAtOrAbove(sourceProbe.histogram, visibleSurfaceHotspotThreshold)
                : null;
            const absoluteHotspotPixelDensity = roundCloudProbeRatio(cloudProbeRatioOrNull(
                absoluteHotspotPixelCount,
                visiblePixelSamples
            ));
            const hotspotPixelDensity = roundCloudProbeRatio(cloudProbeRatioOrNull(
                sourceProbe ? sourceProbe.hotspotPixelCount : null,
                visiblePixelSamples
            ));
            const contributionEventDensity = roundCloudProbeRatio(cloudProbeRatioOrNull(
                sourceProbe ? sourceProbe.contributionEventSamples : null,
                visiblePixelSamples
            ));
            darkVisibleSurfaceHotspotSourceRows.push({
                visibleSurface: sourceClass.visibleSurface,
                sourceSurface: sourceClass.sourceSurface,
                contributionMode: sourceClass.contributionMode,
                visiblePixelMode: sourceClass.visiblePixelMode,
                visiblePixelSamples,
                contributionEventSamples: sourceProbe ? sourceProbe.contributionEventSamples : null,
                contributionEventDensity,
                contributionMass: sourceProbe ? sourceProbe.contributionMass : null,
                averageContributionLuma: sourceProbe ? sourceProbe.averageContributionLuma : null,
                p50: sourceProbe ? sourceProbe.contributionPercentiles.p50 : null,
                p90: sourceProbe ? sourceProbe.contributionPercentiles.p90 : null,
                p99: sourceProbe ? sourceProbe.contributionPercentiles.p99 : null,
                max: sourceProbe ? sourceProbe.contributionPercentiles.max : null,
                maxToP50Ratio: sourceProbe ? sourceProbe.maxToP50Ratio : null,
                hotspotThreshold: sourceProbe ? sourceProbe.hotspotThreshold : null,
                hotspotPixelCount: sourceProbe ? sourceProbe.hotspotPixelCount : null,
                hotspotPixelDensity,
                visibleSurfaceHotspotThreshold,
                absoluteHotspotPixelCount,
                absoluteHotspotPixelDensity,
                sourceProbe
            });
        }
        const dominant = darkVisibleSurfaceHotspotSourceRows.reduce((best, row) => (
            Number.isFinite(row.absoluteHotspotPixelDensity) && row.absoluteHotspotPixelDensity > best.absoluteHotspotPixelDensity
                ? row
                : best
        ), { visibleSurface: 'none', sourceSurface: 'none', absoluteHotspotPixelDensity: -1 });
        const groupedByVisibleSurface = {};
        for (const visibleSurface of ['floor', 'gikPanel']) {
            const rows = darkVisibleSurfaceHotspotSourceRows.filter((row) => row.visibleSurface === visibleSurface);
            const dominantSource = rows.reduce((best, row) => (
                Number.isFinite(row.absoluteHotspotPixelDensity) && row.absoluteHotspotPixelDensity > best.absoluteHotspotPixelDensity
                    ? row
                    : best
            ), { sourceSurface: 'none', absoluteHotspotPixelDensity: -1 });
            groupedByVisibleSurface[visibleSurface] = {
                rows,
                dominantSourceSurface: dominantSource.sourceSurface,
                dominantSourceAbsoluteHotspotPixelDensity: Number.isFinite(dominantSource.absoluteHotspotPixelDensity)
                    ? dominantSource.absoluteHotspotPixelDensity
                    : null
            };
        }
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudDarkVisibleSurfaceHotspotSourceProbe',
            renderPathMutation: false,
            probeShaderMutation: true,
            normalRenderProbeMode: 0,
            directNeeProbeMode: 5,
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            visibleSurfaceHotspotThresholdBySurface,
            darkVisibleSurfaceHotspotSourceRows,
            groupedByVisibleSurface,
            dominantDarkVisibleSurfaceHotspotSource: {
                visibleSurface: dominant.visibleSurface,
                sourceSurface: dominant.sourceSurface,
                hotspotPixelDensity: Number.isFinite(dominant.hotspotPixelDensity) ? dominant.hotspotPixelDensity : null,
                absoluteHotspotPixelDensity: Number.isFinite(dominant.absoluteHotspotPixelDensity)
                    ? dominant.absoluteHotspotPixelDensity
                    : null
            },
            interpretation: {
                visibleSurfaceMeaning: 'firstCameraVisibleDarkSurface',
                sourceSurfaceMeaning: 'laterBouncedSurfaceThatSampledCloudDirectNee',
                densityMeaning: 'sourceClassHotspotPixelCountDividedByVisibleDarkSurfacePixelSamples',
                absoluteDensityMeaning: 'sourceClassPixelsAboveTheSharedVisibleSurfaceThresholdDividedByVisibleDarkSurfacePixelSamples',
                decisionMeaning: 'dominantSourceSurfaceUsesSharedVisibleSurfaceThresholdForCleanupRouting',
                sampleIndependenceWarning: 'targetSamplesCurrentlyScalesReadbackCountsAndDoesNotProveIndependentRandomStability'
            },
            recommendedNextStep: 'testDarkVisibleSurfaceSourceCleanupCandidate'
        };
        console.table(darkVisibleSurfaceHotspotSourceRows.map((row) => ({
            visibleSurface: row.visibleSurface,
            sourceSurface: row.sourceSurface,
            visiblePixelSamples: row.visiblePixelSamples,
            contributionEventDensity: row.contributionEventDensity,
            p50: row.p50,
            p99: row.p99,
            max: row.max,
            maxToP50Ratio: row.maxToP50Ratio,
            hotspotPixelCount: row.hotspotPixelCount,
            hotspotPixelDensity: row.hotspotPixelDensity,
            visibleSurfaceHotspotThreshold: row.visibleSurfaceHotspotThreshold,
            absoluteHotspotPixelCount: row.absoluteHotspotPixelCount,
            absoluteHotspotPixelDensity: row.absoluteHotspotPixelDensity
        })));
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.setCloudDarkSurfaceCleanupCandidate = function (mode, clampLuma) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudDarkSurfaceCleanupMode || !pathTracingUniforms.uCloudDarkSurfaceCleanupLuma) {
        return null;
    }
    const modeValue = Number(mode) > 0 ? 1 : 0;
    const clampValue = Math.max(0, Number.isFinite(Number(clampLuma)) ? Number(clampLuma) : 1.0);
    pathTracingUniforms.uCloudDarkSurfaceCleanupMode.value = modeValue;
    pathTracingUniforms.uCloudDarkSurfaceCleanupLuma.value = clampValue;
    if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial) {
        pathTracingMaterial.uniformsNeedUpdate = true;
    }
    resetCloudVisibilityProbeAccumulation();
    wakeRender();
    return {
        version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
        cleanupMode: modeValue,
        cleanupClampLuma: clampValue,
        scope: 'visibleFloorOrGikFromCeilingOrWallCloudDirectNee',
        defaultRenderMode: 0
    };
};

window.reportCloudDarkSurfaceCleanupCandidateAfterSamples = async function (targetSamples, timeoutMs, clampLuma) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudDarkSurfaceCleanupMode || !pathTracingUniforms.uCloudDarkSurfaceCleanupLuma) {
        return null;
    }
    const originalCleanupMode = pathTracingUniforms.uCloudDarkSurfaceCleanupMode.value;
    const originalCleanupLuma = pathTracingUniforms.uCloudDarkSurfaceCleanupLuma.value;
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 4));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const clampValue = Math.max(0, Number.isFinite(Number(clampLuma)) ? Number(clampLuma) : 1.0);

    try {
        window.setCloudDarkSurfaceCleanupCandidate(0, clampValue);
        const baseline = await window.reportCloudVisibleSurfaceHotspotProbeAfterSamples(target, timeout);
        window.setCloudDarkSurfaceCleanupCandidate(1, clampValue);
        const candidate = await window.reportCloudVisibleSurfaceHotspotProbeAfterSamples(target, timeout);
        const cleanupCandidateRows = ['floor', 'gikPanel', 'ceiling', 'wall', 'object'].map((label) => {
            const before = baseline && baseline.visibleSurfaceHotspotRows
                ? baseline.visibleSurfaceHotspotRows.find((row) => row.label === label)
                : null;
            const after = candidate && candidate.visibleSurfaceHotspotRows
                ? candidate.visibleSurfaceHotspotRows.find((row) => row.label === label)
                : null;
            const hotspotDensityReductionRatio = roundCloudProbeRatio(cloudProbeRatioOrNull(
                before && after ? before.hotspotPixelDensity - after.hotspotPixelDensity : null,
                before ? before.hotspotPixelDensity : null
            ));
            const maxReductionRatio = roundCloudProbeRatio(cloudProbeRatioOrNull(
                before && after ? before.max - after.max : null,
                before ? before.max : null
            ));
            const p99ReductionRatio = roundCloudProbeRatio(cloudProbeRatioOrNull(
                before && after ? before.p99 - after.p99 : null,
                before ? before.p99 : null
            ));
            return {
                label,
                baselineHotspotPixelDensity: before ? before.hotspotPixelDensity : null,
                candidateHotspotPixelDensity: after ? after.hotspotPixelDensity : null,
                hotspotDensityReductionRatio,
                baselineP99: before ? before.p99 : null,
                candidateP99: after ? after.p99 : null,
                p99ReductionRatio,
                baselineMax: before ? before.max : null,
                candidateMax: after ? after.max : null,
                maxReductionRatio
            };
        });
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudDarkSurfaceCleanupCandidateProbe',
            renderPathMutation: false,
            candidateRenderMutationAvailable: true,
            candidateDefaultEnabled: false,
            cleanupScope: 'visibleFloorOrGikFromCeilingOrWallCloudDirectNee',
            cleanupClampLuma: clampValue,
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            baseline,
            candidate,
            cleanupCandidateRows,
            interpretation: {
                candidateMeaning: 'temporaryUniformToggleThatClampsOnlyDarkVisibleSurfaceCeilingWallCloudNeeSpikes',
                successMeaning: 'floorAndGikHotspotDensityOrMaxDropsWhileCeilingAndWallVisibleRowsStayNearBaseline',
                nextValidation: 'visualCompareAtLowSppThenCheckHighSppBrightness'
            },
            recommendedNextStep: 'visualABLowSppThenHighSppGuard'
        };
        console.table(cleanupCandidateRows);
        return result;
    } finally {
        pathTracingUniforms.uCloudDarkSurfaceCleanupMode.value = originalCleanupMode;
        pathTracingUniforms.uCloudDarkSurfaceCleanupLuma.value = originalCleanupLuma;
        if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial) {
            pathTracingMaterial.uniformsNeedUpdate = true;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportCloudBrightSampleCoverageProbeAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null,
        cleanupMode: pathTracingUniforms.uCloudDarkSurfaceCleanupMode ? pathTracingUniforms.uCloudDarkSurfaceCleanupMode.value : null,
        cleanupLuma: pathTracingUniforms.uCloudDarkSurfaceCleanupLuma ? pathTracingUniforms.uCloudDarkSurfaceCleanupLuma.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 4));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const coverageSurfaces = CLOUD_VISIBLE_SURFACE_HOTSPOT_CLASSES.filter((surfaceClass) =>
        surfaceClass.label === 'floor' || surfaceClass.label === 'gikPanel'
    );

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        window.setCloudDarkSurfaceCleanupCandidate(0, 1.0);
        const brightSampleCoverageRows = [];
        for (const surfaceClass of coverageSurfaces) {
            const visiblePixelProbe = await measureCloudDirectNeeDiffuseCountContributionMode(surfaceClass.visiblePixelMode, target, timeout);
            const hotspotProbe = await measureCloudVisibleSurfaceHotspotContributionMode(surfaceClass, target, timeout);
            const visiblePixelSamples = visiblePixelProbe ? visiblePixelProbe.eventMass : null;
            const normalBrightThreshold = hotspotProbe ? hotspotProbe.contributionPercentiles.p50 : null;
            const strongBrightThreshold = hotspotProbe ? hotspotProbe.contributionPercentiles.p90 : null;
            const medianBrightPixelCount = hotspotProbe
                ? cloudVisibleSurfaceHotspotHistogramCountAtOrAbove(hotspotProbe.histogram, normalBrightThreshold)
                : null;
            const strongBrightPixelCount = hotspotProbe
                ? cloudVisibleSurfaceHotspotHistogramCountAtOrAbove(hotspotProbe.histogram, strongBrightThreshold)
                : null;
            const contributionEventDensity = roundCloudProbeRatio(cloudProbeRatioOrNull(
                hotspotProbe ? hotspotProbe.contributionEventSamples : null,
                visiblePixelSamples
            ));
            const medianBrightCoverage = roundCloudProbeRatio(cloudProbeRatioOrNull(
                medianBrightPixelCount,
                visiblePixelSamples
            ));
            const strongBrightCoverage = roundCloudProbeRatio(cloudProbeRatioOrNull(
                strongBrightPixelCount,
                visiblePixelSamples
            ));
            const darkWaitingShareAtMedian = roundCloudProbeRatio(
                Number.isFinite(medianBrightCoverage) ? 1 - medianBrightCoverage : null
            );
            const darkWaitingShareAtStrong = roundCloudProbeRatio(
                Number.isFinite(strongBrightCoverage) ? 1 - strongBrightCoverage : null
            );
            let coverageVerdict = 'noVisiblePixelsMeasured';
            if (Number.isFinite(visiblePixelSamples) && visiblePixelSamples > 0) {
                if (!Number.isFinite(contributionEventDensity) || contributionEventDensity <= 0) {
                    coverageVerdict = 'noCloudNeeEventsOnVisibleSurface';
                } else if (Number.isFinite(medianBrightCoverage) && medianBrightCoverage < 0.15) {
                    coverageVerdict = 'coverageInsufficient';
                } else if (Number.isFinite(darkWaitingShareAtMedian) && darkWaitingShareAtMedian > 0.65) {
                    coverageVerdict = 'coverageSparse';
                } else if (hotspotProbe && Number.isFinite(hotspotProbe.maxToP50Ratio) && hotspotProbe.maxToP50Ratio >= 10 &&
                    Number.isFinite(strongBrightCoverage) && strongBrightCoverage < 0.05) {
                    coverageVerdict = 'brightTailConcentrated';
                } else {
                    coverageVerdict = 'coverageModerate';
                }
            }
            brightSampleCoverageRows.push({
                label: surfaceClass.label,
                contributionMode: surfaceClass.contributionMode,
                visiblePixelMode: surfaceClass.visiblePixelMode,
                visiblePixelSamples,
                contributionEventSamples: hotspotProbe ? hotspotProbe.contributionEventSamples : null,
                contributionEventDensity,
                contributionMass: hotspotProbe ? hotspotProbe.contributionMass : null,
                averageContributionLuma: hotspotProbe ? hotspotProbe.averageContributionLuma : null,
                normalBrightThreshold,
                strongBrightThreshold,
                medianBrightPixelCount,
                strongBrightPixelCount,
                medianBrightCoverage,
                normalBrightCoverage: medianBrightCoverage,
                strongBrightCoverage,
                darkWaitingShareAtMedian,
                darkWaitingShareAtStrong,
                p50: hotspotProbe ? hotspotProbe.contributionPercentiles.p50 : null,
                p90: hotspotProbe ? hotspotProbe.contributionPercentiles.p90 : null,
                p99: hotspotProbe ? hotspotProbe.contributionPercentiles.p99 : null,
                max: hotspotProbe ? hotspotProbe.contributionPercentiles.max : null,
                p90ToP50Ratio: hotspotProbe ? hotspotProbe.p90ToP50Ratio : null,
                p99ToP50Ratio: hotspotProbe ? hotspotProbe.p99ToP50Ratio : null,
                maxToP50Ratio: hotspotProbe ? hotspotProbe.maxToP50Ratio : null,
                coverageVerdict,
                visiblePixelProbe,
                hotspotProbe
            });
        }
        const measuredRows = brightSampleCoverageRows.filter((row) => Number.isFinite(row.medianBrightCoverage));
        const lowestCoverage = measuredRows.reduce((best, row) => (
            row.medianBrightCoverage < best.medianBrightCoverage ? row : best
        ), { label: 'noMeasuredRows', medianBrightCoverage: Infinity });
        const highestWaitingShare = measuredRows.reduce((best, row) => (
            Number.isFinite(row.darkWaitingShareAtMedian) && row.darkWaitingShareAtMedian > best.darkWaitingShareAtMedian ? row : best
        ), { label: 'noMeasuredRows', darkWaitingShareAtMedian: -1 });
        const floorGikVisiblePixelSamples = Number(brightSampleCoverageRows.reduce((sum, row) =>
            sum + (Number.isFinite(row.visiblePixelSamples) ? row.visiblePixelSamples : 0), 0).toFixed(6));
        const floorGikMedianBrightPixelCount = Number(brightSampleCoverageRows.reduce((sum, row) =>
            sum + (Number.isFinite(row.medianBrightPixelCount) ? row.medianBrightPixelCount : 0), 0).toFixed(6));
        const floorGikStrongBrightPixelCount = Number(brightSampleCoverageRows.reduce((sum, row) =>
            sum + (Number.isFinite(row.strongBrightPixelCount) ? row.strongBrightPixelCount : 0), 0).toFixed(6));
        const floorGikMedianBrightCoverage = roundCloudProbeRatio(cloudProbeRatioOrNull(
            floorGikMedianBrightPixelCount,
            floorGikVisiblePixelSamples
        ));
        const floorGikStrongBrightCoverage = roundCloudProbeRatio(cloudProbeRatioOrNull(
            floorGikStrongBrightPixelCount,
            floorGikVisiblePixelSamples
        ));
        const floorGikDarkWaitingShareAtMedian = roundCloudProbeRatio(
            Number.isFinite(floorGikMedianBrightCoverage) ? 1 - floorGikMedianBrightCoverage : null
        );
        const floorGikDarkWaitingShareAtStrong = roundCloudProbeRatio(
            Number.isFinite(floorGikStrongBrightCoverage) ? 1 - floorGikStrongBrightCoverage : null
        );
        const coverageInsufficientSurfaces = brightSampleCoverageRows
            .filter((row) => row.coverageVerdict === 'coverageInsufficient' || row.coverageVerdict === 'coverageSparse' || row.coverageVerdict === 'noCloudNeeEventsOnVisibleSurface')
            .map((row) => row.label);
        const brightTailConcentratedSurfaces = brightSampleCoverageRows
            .filter((row) => row.coverageVerdict === 'brightTailConcentrated')
            .map((row) => row.label);
        const coverageSupportsCandidate = coverageInsufficientSurfaces.length > 0 ||
            (Number.isFinite(floorGikDarkWaitingShareAtMedian) && floorGikDarkWaitingShareAtMedian > 0.65);
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudBrightSampleCoverageProbe',
            renderPathMutation: false,
            probeShaderMutation: false,
            normalRenderProbeMode: 0,
            directNeeProbeMode: 5,
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            brightSampleCoverageRows,
            floorGikVisiblePixelSamples,
            floorGikMedianBrightPixelCount,
            floorGikStrongBrightPixelCount,
            floorGikMedianBrightCoverage,
            floorGikStrongBrightCoverage,
            floorGikDarkWaitingShareAtMedian,
            floorGikDarkWaitingShareAtStrong,
            lowestMedianBrightCoverageSurface: lowestCoverage.label,
            lowestMedianBrightCoverage: Number.isFinite(lowestCoverage.medianBrightCoverage)
                ? lowestCoverage.medianBrightCoverage
                : null,
            highestDarkWaitingShareSurface: highestWaitingShare.label,
            highestDarkWaitingShareAtMedian: Number.isFinite(highestWaitingShare.darkWaitingShareAtMedian)
                ? highestWaitingShare.darkWaitingShareAtMedian
                : null,
            coverageInsufficientSurfaces,
            brightTailConcentratedSurfaces,
            coverageSupportsCandidate,
            interpretation: {
                visiblePixelMeaning: 'cameraVisibleFloorOrGikSamples',
                normalBrightThresholdMeaning: 'thatSurfaceMedianNonzeroCloudNeeContribution',
                medianBrightCoverageMeaning: 'visibleSamplesThatAlreadyGotAtLeastTheSurfaceMedianCloudNeeContribution',
                darkWaitingShareMeaning: 'visibleSamplesStillMissingThatNormalBrightnessSample',
                decisionMeaning: 'highDarkWaitingShareSupportsAConservativeSameSurfaceFillCandidate',
                sampleIndependenceWarning: 'targetSamplesCurrentlyScalesReadbackCountsAndDoesNotProveIndependentRandomStability'
            },
            recommendedNextStep: 'designGuardedSameSurfaceDarkFillCandidate'
        };
        console.table(brightSampleCoverageRows.map((row) => ({
            label: row.label,
            visiblePixelSamples: row.visiblePixelSamples,
            contributionEventSamples: row.contributionEventSamples,
            contributionEventDensity: row.contributionEventDensity,
            normalBrightThreshold: row.normalBrightThreshold,
            medianBrightPixelCount: row.medianBrightPixelCount,
            medianBrightCoverage: row.medianBrightCoverage,
            darkWaitingShareAtMedian: row.darkWaitingShareAtMedian,
            maxToP50Ratio: row.maxToP50Ratio,
            coverageVerdict: row.coverageVerdict
        })));
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        if (pathTracingUniforms.uCloudDarkSurfaceCleanupMode && original.cleanupMode !== null) {
            pathTracingUniforms.uCloudDarkSurfaceCleanupMode.value = original.cleanupMode;
        }
        if (pathTracingUniforms.uCloudDarkSurfaceCleanupLuma && original.cleanupLuma !== null) {
            pathTracingUniforms.uCloudDarkSurfaceCleanupLuma.value = original.cleanupLuma;
        }
        if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial) {
            pathTracingMaterial.uniformsNeedUpdate = true;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.setCloudSameSurfaceDarkFillCandidate = function (mode, strength, maxSamples, floorLuma, gikLuma) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudSameSurfaceDarkFillMode ||
        !pathTracingUniforms.uCloudSameSurfaceDarkFillStrength ||
        !pathTracingUniforms.uCloudSameSurfaceDarkFillMaxSamples ||
        !pathTracingUniforms.uCloudSameSurfaceDarkFillFloorLuma ||
        !pathTracingUniforms.uCloudSameSurfaceDarkFillGikLuma) {
        return null;
    }
    const modeValue = Number(mode) > 0 ? 1 : 0;
    const strengthValue = Math.max(0, Math.min(1, Number.isFinite(Number(strength))
        ? Number(strength)
        : CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_STRENGTH));
    const maxSamplesValue = Math.max(1, Number.isFinite(Number(maxSamples))
        ? Number(maxSamples)
        : CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_MAX_SAMPLES);
    const floorLumaValue = Math.max(0, Number.isFinite(Number(floorLuma))
        ? Number(floorLuma)
        : CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_FLOOR_LUMA);
    const gikLumaValue = Math.max(0, Number.isFinite(Number(gikLuma))
        ? Number(gikLuma)
        : CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_GIK_LUMA);
    pathTracingUniforms.uCloudSameSurfaceDarkFillMode.value = modeValue;
    pathTracingUniforms.uCloudSameSurfaceDarkFillStrength.value = strengthValue;
    pathTracingUniforms.uCloudSameSurfaceDarkFillMaxSamples.value = maxSamplesValue;
    pathTracingUniforms.uCloudSameSurfaceDarkFillFloorLuma.value = floorLumaValue;
    pathTracingUniforms.uCloudSameSurfaceDarkFillGikLuma.value = gikLumaValue;
    if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial) {
        pathTracingMaterial.uniformsNeedUpdate = true;
    }
    resetCloudVisibilityProbeAccumulation();
    wakeRender();
    return {
        version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
        sameSurfaceDarkFillMode: modeValue,
        sameSurfaceDarkFillStrength: strengthValue,
        sameSurfaceDarkFillMaxSamples: maxSamplesValue,
        sameSurfaceDarkFillFloorLuma: floorLumaValue,
        sameSurfaceDarkFillGikLuma: gikLumaValue,
        scope: 'visibleFloorOrGikWeakCloudNeeContribution',
        candidateDefaultEnabled: false
    };
};

function cloudCoverageRowByLabel(report, label) {
    return report && Array.isArray(report.brightSampleCoverageRows)
        ? report.brightSampleCoverageRows.find((row) => row.label === label) || null
        : null;
}

function cloudCoverageAtThreshold(row, threshold) {
    if (!row || !row.hotspotProbe || !Array.isArray(row.hotspotProbe.histogram) || !Number.isFinite(threshold)) {
        return {
            brightPixelCount: null,
            brightCoverage: null,
            darkWaitingShare: null
        };
    }
    const brightPixelCount = cloudVisibleSurfaceHotspotHistogramCountAtOrAbove(row.hotspotProbe.histogram, threshold);
    const brightCoverage = roundCloudProbeRatio(cloudProbeRatioOrNull(brightPixelCount, row.visiblePixelSamples));
    return {
        brightPixelCount,
        brightCoverage,
        darkWaitingShare: roundCloudProbeRatio(Number.isFinite(brightCoverage) ? 1 - brightCoverage : null)
    };
}

window.reportCloudSameSurfaceDarkFillCandidateAfterSamples = async function (targetSamples, timeoutMs, strength, maxSamples) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudSameSurfaceDarkFillMode) {
        return null;
    }
    const original = {
        mode: pathTracingUniforms.uCloudSameSurfaceDarkFillMode.value,
        strength: pathTracingUniforms.uCloudSameSurfaceDarkFillStrength ? pathTracingUniforms.uCloudSameSurfaceDarkFillStrength.value : null,
        maxSamples: pathTracingUniforms.uCloudSameSurfaceDarkFillMaxSamples ? pathTracingUniforms.uCloudSameSurfaceDarkFillMaxSamples.value : null,
        floorLuma: pathTracingUniforms.uCloudSameSurfaceDarkFillFloorLuma ? pathTracingUniforms.uCloudSameSurfaceDarkFillFloorLuma.value : null,
        gikLuma: pathTracingUniforms.uCloudSameSurfaceDarkFillGikLuma ? pathTracingUniforms.uCloudSameSurfaceDarkFillGikLuma.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 4));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const strengthValue = Math.max(0, Math.min(1, Number.isFinite(Number(strength))
        ? Number(strength)
        : CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_STRENGTH));
    const maxSamplesValue = Math.max(1, Number.isFinite(Number(maxSamples))
        ? Number(maxSamples)
        : CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_MAX_SAMPLES);

    try {
        window.setCloudSameSurfaceDarkFillCandidate(0, strengthValue, maxSamplesValue);
        const baseline = await window.reportCloudBrightSampleCoverageProbeAfterSamples(target, timeout);
        const baselineFloor = cloudCoverageRowByLabel(baseline, 'floor');
        const baselineGik = cloudCoverageRowByLabel(baseline, 'gikPanel');
        const floorLumaValue = baselineFloor && Number.isFinite(baselineFloor.normalBrightThreshold)
            ? baselineFloor.normalBrightThreshold
            : CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_FLOOR_LUMA;
        const gikLumaValue = baselineGik && Number.isFinite(baselineGik.normalBrightThreshold)
            ? baselineGik.normalBrightThreshold
            : CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_GIK_LUMA;
        window.setCloudSameSurfaceDarkFillCandidate(1, strengthValue, maxSamplesValue, floorLumaValue, gikLumaValue);
        const candidate = await window.reportCloudBrightSampleCoverageProbeAfterSamples(target, timeout);
        const sameSurfaceDarkFillCandidateRows = ['floor', 'gikPanel'].map((label) => {
            const before = cloudCoverageRowByLabel(baseline, label);
            const after = cloudCoverageRowByLabel(candidate, label);
            const baselineThreshold = before ? before.normalBrightThreshold : null;
            const candidateAtBaseline = cloudCoverageAtThreshold(after, baselineThreshold);
            const candidateCoverage = Number.isFinite(candidateAtBaseline.brightCoverage)
                ? candidateAtBaseline.brightCoverage
                : (after ? after.medianBrightCoverage : null);
            const candidateDarkWaitingShare = Number.isFinite(candidateAtBaseline.darkWaitingShare)
                ? candidateAtBaseline.darkWaitingShare
                : (after ? after.darkWaitingShareAtMedian : null);
            const baselineCoverage = before ? before.medianBrightCoverage : null;
            const baselineDarkWaitingShare = before ? before.darkWaitingShareAtMedian : null;
            const medianBrightCoverageLift = Number.isFinite(candidateCoverage) && Number.isFinite(baselineCoverage)
                ? Number((candidateCoverage - baselineCoverage).toFixed(6))
                : null;
            const darkWaitingShareReductionRatio = roundCloudProbeRatio(cloudProbeRatioOrNull(
                Number.isFinite(baselineDarkWaitingShare) && Number.isFinite(candidateDarkWaitingShare)
                    ? baselineDarkWaitingShare - candidateDarkWaitingShare
                    : null,
                baselineDarkWaitingShare
            ));
            const maxToP50RatioChange = Number.isFinite(after ? after.maxToP50Ratio : null) && Number.isFinite(before ? before.maxToP50Ratio : null)
                ? Number((after.maxToP50Ratio - before.maxToP50Ratio).toFixed(6))
                : null;
            return {
                label,
                baselineNormalBrightThreshold: baselineThreshold,
                candidateBrightPixelCountAtBaselineThreshold: candidateAtBaseline.brightPixelCount,
                baselineMedianBrightCoverage: baselineCoverage,
                candidateMedianBrightCoverageAtBaselineThreshold: candidateCoverage,
                medianBrightCoverageLift,
                baselineDarkWaitingShareAtMedian: baselineDarkWaitingShare,
                candidateDarkWaitingShareAtBaselineThreshold: candidateDarkWaitingShare,
                darkWaitingShareReductionRatio,
                baselineContributionEventDensity: before ? before.contributionEventDensity : null,
                candidateContributionEventDensity: after ? after.contributionEventDensity : null,
                baselineMaxToP50Ratio: before ? before.maxToP50Ratio : null,
                candidateMaxToP50Ratio: after ? after.maxToP50Ratio : null,
                maxToP50RatioChange
            };
        });
        const floorRow = sameSurfaceDarkFillCandidateRows.find((row) => row.label === 'floor') || null;
        const gikRow = sameSurfaceDarkFillCandidateRows.find((row) => row.label === 'gikPanel') || null;
        const medianBrightCoverageLiftAverage = Number(((Number(floorRow && Number.isFinite(floorRow.medianBrightCoverageLift) ? floorRow.medianBrightCoverageLift : 0) +
            Number(gikRow && Number.isFinite(gikRow.medianBrightCoverageLift) ? gikRow.medianBrightCoverageLift : 0)) / 2).toFixed(6));
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudSameSurfaceDarkFillCandidateProbe',
            renderPathMutation: false,
            candidateRenderMutationAvailable: true,
            candidateDefaultEnabled: false,
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            sameSurfaceDarkFillStrength: strengthValue,
            sameSurfaceDarkFillMaxSamples: maxSamplesValue,
            sameSurfaceDarkFillFloorLuma: floorLumaValue,
            sameSurfaceDarkFillGikLuma: gikLumaValue,
            baseline,
            candidate,
            sameSurfaceDarkFillCandidateRows,
            medianBrightCoverageLiftAverage,
            candidatePassesFirstMetric: sameSurfaceDarkFillCandidateRows.every((row) =>
                Number.isFinite(row.medianBrightCoverageLift) && row.medianBrightCoverageLift > 0
            ),
            interpretation: {
                candidateMeaning: 'raisesWeakFloorOrGikCloudNeeEventsTowardThatSurfaceMeasuredMedian',
                guardMeaning: 'visibleSurfaceClassAndDiffuseBounceAndSampleFade',
                sampleFadeMeaning: 'fullUntilMaxSamplesThenSmoothFadeForSameLength',
                nextValidation: 'visualCompareLowSppThenHighSppMaterialCheck'
            },
            recommendedNextStep: 'visualABLowSppThenHighSppGuard'
        };
        console.table(sameSurfaceDarkFillCandidateRows);
        return result;
    } finally {
        if (pathTracingUniforms.uCloudSameSurfaceDarkFillMode) pathTracingUniforms.uCloudSameSurfaceDarkFillMode.value = original.mode;
        if (pathTracingUniforms.uCloudSameSurfaceDarkFillStrength && original.strength !== null) pathTracingUniforms.uCloudSameSurfaceDarkFillStrength.value = original.strength;
        if (pathTracingUniforms.uCloudSameSurfaceDarkFillMaxSamples && original.maxSamples !== null) pathTracingUniforms.uCloudSameSurfaceDarkFillMaxSamples.value = original.maxSamples;
        if (pathTracingUniforms.uCloudSameSurfaceDarkFillFloorLuma && original.floorLuma !== null) pathTracingUniforms.uCloudSameSurfaceDarkFillFloorLuma.value = original.floorLuma;
        if (pathTracingUniforms.uCloudSameSurfaceDarkFillGikLuma && original.gikLuma !== null) pathTracingUniforms.uCloudSameSurfaceDarkFillGikLuma.value = original.gikLuma;
        if (typeof pathTracingMaterial !== 'undefined' && pathTracingMaterial) {
            pathTracingMaterial.uniformsNeedUpdate = true;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportCloudMisWeightProbeAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 32));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const directNeeWeight = await measureCloudMisWeightProbeMode(1, target, timeout);
        const directNeePdf = await measureCloudMisWeightProbeMode(2, target, timeout);
        const bsdfHitWeight = await measureCloudMisWeightProbeMode(3, target, timeout);
        const bsdfHitPdf = await measureCloudMisWeightProbeMode(4, target, timeout);
        const directNeeContribution = await measureCloudMisWeightProbeMode(5, target, timeout);
        const bsdfHitContribution = await measureCloudMisWeightProbeMode(6, target, timeout);
        const directNeeDerivedAverageWeight = misWeightFromNeeOverBsdfRatio(
            directNeePdf ? directNeePdf.averagePdfRatio : null,
            'nee'
        );
        const bsdfHitDerivedAverageWeight = misWeightFromNeeOverBsdfRatio(
            bsdfHitPdf ? bsdfHitPdf.averagePdfRatio : null,
            'bsdf'
        );
        const bsdfHitContributionHasEvents = Boolean(bsdfHitContribution && bsdfHitContribution.eventMass > 0);
        const bsdfHitPdfHasEvents = Boolean(bsdfHitPdf && bsdfHitPdf.eventMass > 0);
        const bsdfHitContributionAliasedToPdf = Boolean(bsdfHitContributionHasEvents && bsdfHitPdfHasEvents &&
            nearlyEqualProbeNumber(bsdfHitContribution.channelMass.r, bsdfHitPdf.channelMass.r) &&
            nearlyEqualProbeNumber(bsdfHitContribution.channelMass.g, bsdfHitPdf.channelMass.g) &&
            nearlyEqualProbeNumber(bsdfHitContribution.channelMass.b, bsdfHitPdf.channelMass.b));
        const bsdfHitContributionPhysicallyPlausible = Boolean(bsdfHitContribution &&
            Number.isFinite(bsdfHitContribution.averageContributionLuma) &&
            Number.isFinite(bsdfHitContribution.averageUnweightedContributionLuma) &&
            bsdfHitContribution.averageContributionLuma <= bsdfHitContribution.averageUnweightedContributionLuma + 1e-6);
        const bsdfHitContributionReadbackReliable = bsdfHitContributionPhysicallyPlausible && !bsdfHitContributionAliasedToPdf;

        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudMisWeightProbe',
            renderPathMutation: false,
            probeShaderMutation: true,
            normalRenderProbeMode: 0,
            questions: ['misDilution', 'directVsIndirect'],
            modes: CLOUD_MIS_WEIGHT_PROBE_MODE_LABELS.slice(),
            currentPanelConfig,
            currentCameraPreset,
            targetSamples: target,
            currentIndirectMultiplier: pathTracingUniforms.uIndirectMultiplier ? pathTracingUniforms.uIndirectMultiplier.value : null,
            currentMaxBounces: pathTracingUniforms.uMaxBounces ? pathTracingUniforms.uMaxBounces.value : null,
            weightSource: 'derivedFromPdfRatio',
            contributionSource: 'weightedLumaPerEvent',
            directNeeAverageWeight: directNeeDerivedAverageWeight,
            directNeeWeightChannelAverage: directNeeWeight ? directNeeWeight.averageWeight : null,
            directNeeEventMass: directNeeWeight ? directNeeWeight.eventMass : null,
            directNeeAveragePnee: directNeePdf ? directNeePdf.averagePdfA : null,
            directNeeAveragePbsdf: directNeePdf ? directNeePdf.averagePdfB : null,
            directNeeAveragePdfRatio: directNeePdf ? directNeePdf.averagePdfRatio : null,
            directNeeContributionMass: directNeeContribution ? directNeeContribution.contributionMass : null,
            directNeeAverageContributionLuma: directNeeContribution ? directNeeContribution.averageContributionLuma : null,
            directNeeAverageUnweightedContributionLuma: directNeeContribution ? directNeeContribution.averageUnweightedContributionLuma : null,
            bsdfHitAverageWeight: bsdfHitDerivedAverageWeight,
            bsdfHitWeightChannelAverage: bsdfHitWeight ? bsdfHitWeight.averageWeight : null,
            bsdfHitEventMass: bsdfHitWeight ? bsdfHitWeight.eventMass : null,
            bsdfHitAveragePneeReverse: bsdfHitPdf ? bsdfHitPdf.averagePdfA : null,
            bsdfHitAveragePbsdf: bsdfHitPdf ? bsdfHitPdf.averagePdfB : null,
            bsdfHitAveragePdfRatio: bsdfHitPdf ? bsdfHitPdf.averagePdfRatio : null,
            bsdfHitContributionMass: bsdfHitContribution ? bsdfHitContribution.contributionMass : null,
            bsdfHitAverageContributionLuma: bsdfHitContribution ? bsdfHitContribution.averageContributionLuma : null,
            bsdfHitAverageUnweightedContributionLuma: bsdfHitContribution ? bsdfHitContribution.averageUnweightedContributionLuma : null,
            bsdfHitContributionObserved: bsdfHitContributionHasEvents,
            bsdfHitPdfObserved: bsdfHitPdfHasEvents,
            bsdfHitContributionAliasedToPdf,
            bsdfHitContributionPhysicallyPlausible,
            bsdfHitContributionReadbackReliable,
            directNeeWeight,
            directNeePdf,
            bsdfHitWeight,
            bsdfHitPdf,
            directNeeContribution,
            bsdfHitContribution,
            interpretation: {
                lowAverageWeightThreshold: 0.25,
                highPdfRatioMeaning: 'neePdfDominatesBsdfPdf',
                lowEventMassMeaning: 'fewValidEventsInCapturedSamples',
                contributionMassMeaning: 'totalWeightedLumaCapturedByProbe',
                unreliableBsdfContributionMeaning: 'doNotUseBsdfContributionFieldsForDecision',
                zeroBsdfEventMeaning: 'increaseSamplesOrUseForcedBsdfHitProbeBeforeContributionDecision'
            },
            recommendedNextStep: bsdfHitContributionReadbackReliable
                ? 'compareBsdfHitContributionBeforePatchTarget'
                : (!bsdfHitContributionHasEvents && !bsdfHitPdfHasEvents
                    ? 'increaseBsdfHitSamplesOrAddForcedBsdfHitProbe'
                    : 'fixBsdfContributionReadbackBeforePatchTarget')
        };
        console.table({
            directNeeAverageWeight: result.directNeeAverageWeight,
            directNeeAveragePdfRatio: result.directNeeAveragePdfRatio,
            directNeeEventMass: result.directNeeEventMass,
            directNeeContributionMass: result.directNeeContributionMass,
            directNeeAverageContributionLuma: result.directNeeAverageContributionLuma,
            bsdfHitAverageWeight: result.bsdfHitAverageWeight,
            bsdfHitAveragePdfRatio: result.bsdfHitAveragePdfRatio,
            bsdfHitEventMass: result.bsdfHitEventMass,
            bsdfHitContributionMass: result.bsdfHitContributionMass,
            bsdfHitAverageContributionLuma: result.bsdfHitAverageContributionLuma,
            bsdfHitContributionReadbackReliable: result.bsdfHitContributionReadbackReliable
        });
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportCloudBsdfContributionSentinelAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 1));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const expectedWeightedLuma = 0.125;
    const expectedUnweightedLuma = 0.5;
    const expectedUniformWeightedLuma = 0.25;
    const expectedUniformUnweightedLuma = 0.75;
    const expectedContributionUniformWeightedLuma = 0.375;
    const expectedContributionUniformUnweightedLuma = 0.875;

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const uniformSentinel = await measureCloudMisWeightProbeMode(8, target, timeout);
        const contributionUniformSentinel = await measureCloudMisWeightProbeMode(9, target, timeout);
        const sentinel = await measureCloudMisWeightProbeMode(7, target, timeout);
        const probeUniformSentinelPass = Boolean(uniformSentinel &&
            uniformSentinel.eventMass > 0 &&
            nearlyEqualProbeNumber(uniformSentinel.averageContributionLuma, expectedUniformWeightedLuma, 1e-3) &&
            nearlyEqualProbeNumber(uniformSentinel.averageUnweightedContributionLuma, expectedUniformUnweightedLuma, 1e-3));
        const contributionUniformSentinelPass = Boolean(contributionUniformSentinel &&
            contributionUniformSentinel.eventMass > 0 &&
            nearlyEqualProbeNumber(contributionUniformSentinel.averageContributionLuma, expectedContributionUniformWeightedLuma, 1e-3) &&
            nearlyEqualProbeNumber(contributionUniformSentinel.averageUnweightedContributionLuma, expectedContributionUniformUnweightedLuma, 1e-3));
        const bsdfHitContributionSentinelPass = Boolean(sentinel &&
            sentinel.eventMass > 0 &&
            nearlyEqualProbeNumber(sentinel.averageContributionLuma, expectedWeightedLuma, 1e-3) &&
            nearlyEqualProbeNumber(sentinel.averageUnweightedContributionLuma, expectedUnweightedLuma, 1e-3));
        const bsdfHitContributionSentinelNoEvent = Boolean(sentinel &&
            sentinel.eventMass === 0 &&
            sentinel.channelMass &&
            nearlyEqualProbeNumber(sentinel.channelMass.r, 0, 1e-6) &&
            nearlyEqualProbeNumber(sentinel.channelMass.g, 0, 1e-6) &&
            nearlyEqualProbeNumber(sentinel.channelMass.b, 0, 1e-6));
        const bsdfHitContributionSentinelContaminated = Boolean(sentinel &&
            sentinel.eventMass > 0 &&
            !bsdfHitContributionSentinelPass);
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'cloudBsdfContributionSentinel',
            renderPathMutation: false,
            probeShaderMutation: true,
            normalRenderProbeMode: 0,
            targetSamples: target,
            expectedWeightedLuma,
            expectedUnweightedLuma,
            expectedUniformWeightedLuma,
            expectedUniformUnweightedLuma,
            expectedContributionUniformWeightedLuma,
            expectedContributionUniformUnweightedLuma,
            probeUniformSentinelPass,
            contributionUniformSentinelPass,
            bsdfHitContributionSentinelPass,
            bsdfHitContributionSentinelNoEvent,
            bsdfHitContributionSentinelContaminated,
            probeUniformSentinel: uniformSentinel,
            contributionUniformSentinel,
            bsdfHitContributionSentinel: sentinel,
            interpretation: {
                uniformPassMeaning: 'misProbeModeUniformAndReadbackAreLive',
                contributionUniformPassMeaning: 'contributionProbeModeUniformAndReadbackAreLive',
                bsdfPassMeaning: 'bsdfContributionBranchAndReadbackAreIsolated',
                failMeaning: 'failedSentinelMarksTheNextRoutingLayerToFix',
                noEventMeaning: 'routingIsIsolatedButNoBsdfHitWasObservedInCapturedSamples'
            },
            recommendedNextStep: probeUniformSentinelPass && contributionUniformSentinelPass && bsdfHitContributionSentinelPass
                ? 'inspectBsdfContributionFormula'
                : (probeUniformSentinelPass && contributionUniformSentinelPass && bsdfHitContributionSentinelNoEvent
                    ? 'increaseBsdfHitSamplesOrAddForcedBsdfHitProbe'
                    : (probeUniformSentinelPass && contributionUniformSentinelPass ? 'fixBsdfContributionProbeRouting' : 'fixProbeUniformRouting'))
        };
        console.table({
            probeUniformSentinelPass: result.probeUniformSentinelPass,
            contributionUniformSentinelPass: result.contributionUniformSentinelPass,
            bsdfHitContributionSentinelPass: result.bsdfHitContributionSentinelPass,
            bsdfHitContributionSentinelNoEvent: result.bsdfHitContributionSentinelNoEvent,
            bsdfHitContributionSentinelContaminated: result.bsdfHitContributionSentinelContaminated,
            uniformEventMass: uniformSentinel ? uniformSentinel.eventMass : null,
            uniformAverageContributionLuma: uniformSentinel ? uniformSentinel.averageContributionLuma : null,
            uniformAverageUnweightedContributionLuma: uniformSentinel ? uniformSentinel.averageUnweightedContributionLuma : null,
            contributionUniformEventMass: contributionUniformSentinel ? contributionUniformSentinel.eventMass : null,
            contributionUniformAverageContributionLuma: contributionUniformSentinel ? contributionUniformSentinel.averageContributionLuma : null,
            contributionUniformAverageUnweightedContributionLuma: contributionUniformSentinel ? contributionUniformSentinel.averageUnweightedContributionLuma : null,
            eventMass: sentinel ? sentinel.eventMass : null,
            averageContributionLuma: sentinel ? sentinel.averageContributionLuma : null,
            averageUnweightedContributionLuma: sentinel ? sentinel.averageUnweightedContributionLuma : null
        });
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportForcedCloudBsdfHitProbeAfterSamples = async function (targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 1));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const expectedSentinelWeightedLuma = 0.125;
    const expectedSentinelUnweightedLuma = 0.5;

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const forcedSentinel = await measureCloudMisWeightProbeMode(10, target, timeout);
        const forcedContribution = await measureCloudMisWeightProbeMode(11, target, timeout);
        const forcedPdf = await measureCloudMisWeightProbeMode(12, target, timeout);
        const forcedWeight = await measureCloudMisWeightProbeMode(13, target, timeout);
        const forcedBsdfHitEventObserved = Boolean(forcedSentinel && forcedSentinel.eventMass > 0);
        const forcedSentinelPass = Boolean(forcedSentinel &&
            forcedSentinel.eventMass > 0 &&
            nearlyEqualProbeNumber(forcedSentinel.averageContributionLuma, expectedSentinelWeightedLuma, 1e-3) &&
            nearlyEqualProbeNumber(forcedSentinel.averageUnweightedContributionLuma, expectedSentinelUnweightedLuma, 1e-3));
        const forcedContributionObserved = Boolean(forcedContribution && forcedContribution.eventMass > 0);
        const forcedPdfObserved = Boolean(forcedPdf && forcedPdf.eventMass > 0);
        const forcedWeightObserved = Boolean(forcedWeight && forcedWeight.eventMass > 0);
        const forcedDerivedAverageWeight = misWeightFromNeeOverBsdfRatio(
            forcedPdf ? forcedPdf.averagePdfRatio : null,
            'bsdf'
        );
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'forcedCloudBsdfHitProbe',
            renderPathMutation: false,
            probeShaderMutation: true,
            normalRenderProbeMode: 0,
            targetSamples: target,
            forcedProbeScope: 'forcedAnalyticBsdfHitIgnoresOcclusion',
            forcedAnalyticBsdfHitIgnoresOcclusion: true,
            forcedBsdfHitEventObserved,
            forcedSentinelPass,
            forcedContributionObserved,
            forcedPdfObserved,
            forcedWeightObserved,
            forcedBsdfHitAverageWeight: forcedWeight ? forcedWeight.averageWeight : null,
            forcedBsdfHitDerivedWeightFromAveragePdfRatio: forcedDerivedAverageWeight,
            forcedBsdfHitWeightChannelAverage: forcedWeight ? forcedWeight.averageWeight : null,
            forcedBsdfHitAveragePdfRatio: forcedPdf ? forcedPdf.averagePdfRatio : null,
            forcedBsdfHitAveragePneeReverse: forcedPdf ? forcedPdf.averagePdfA : null,
            forcedBsdfHitAveragePbsdf: forcedPdf ? forcedPdf.averagePdfB : null,
            forcedBsdfHitContributionMass: forcedContribution ? forcedContribution.contributionMass : null,
            forcedBsdfHitAverageContributionLuma: forcedContribution ? forcedContribution.averageContributionLuma : null,
            forcedBsdfHitAverageUnweightedContributionLuma: forcedContribution ? forcedContribution.averageUnweightedContributionLuma : null,
            forcedSentinel,
            forcedContribution,
            forcedPdf,
            forcedWeight,
            interpretation: {
                eventMeaning: 'forcedProbeCanReachCloudBsdfHitBranch',
                contributionMeaning: 'analyticWeightedLumaForAForcedCloudHit',
                pdfMeaning: 'reverseNeePdfAndBsdfPdfAtForcedHitPoint',
                scopeLimit: 'forcedAnalyticBsdfHitIgnoresOcclusionAndDoesNotMeasureNaturalHitFrequency'
            },
            recommendedNextStep: forcedSentinelPass && forcedContributionObserved && forcedPdfObserved && forcedWeightObserved
                ? 'compareForcedBsdfPdfAndContributionAgainstNaturalProbe'
                : 'fixForcedBsdfHitProbeRouting'
        };
        console.table({
            forcedBsdfHitEventObserved: result.forcedBsdfHitEventObserved,
            forcedSentinelPass: result.forcedSentinelPass,
            forcedBsdfHitAverageWeight: result.forcedBsdfHitAverageWeight,
            forcedBsdfHitDerivedWeightFromAveragePdfRatio: result.forcedBsdfHitDerivedWeightFromAveragePdfRatio,
            forcedBsdfHitWeightChannelAverage: result.forcedBsdfHitWeightChannelAverage,
            forcedBsdfHitAveragePdfRatio: result.forcedBsdfHitAveragePdfRatio,
            forcedBsdfHitContributionMass: result.forcedBsdfHitContributionMass,
            forcedBsdfHitAverageContributionLuma: result.forcedBsdfHitAverageContributionLuma,
            forcedBsdfHitAverageUnweightedContributionLuma: result.forcedBsdfHitAverageUnweightedContributionLuma
        });
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportNaturalCloudBsdfHitFrequencyAfterSamples = async function (samplePlan, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudMisWeightProbeMode) {
        return null;
    }
    const original = {
        misMode: pathTracingUniforms.uCloudMisWeightProbeMode.value,
        contributionMode: pathTracingUniforms.uCloudContributionProbeMode ? pathTracingUniforms.uCloudContributionProbeMode.value : null,
        displayMode: cloudMisWeightProbeDisplayMode,
        visibilityMode: pathTracingUniforms.uCloudVisibilityProbeMode ? pathTracingUniforms.uCloudVisibilityProbeMode.value : null
    };
    const naturalBsdfHitFrequencyPlan = normalizeCloudBsdfHitFrequencyPlan(samplePlan);
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const expectedWeightedLuma = 0.125;
    const expectedUnweightedLuma = 0.5;

    try {
        if (pathTracingUniforms.uCloudVisibilityProbeMode) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = 0;
        }
        const forcedReference = await measureCloudMisWeightProbeMode(10, 1, timeout);
        const forcedReferencePass = Boolean(forcedReference &&
            forcedReference.eventMass > 0 &&
            nearlyEqualProbeNumber(forcedReference.averageContributionLuma, expectedWeightedLuma, 1e-3) &&
            nearlyEqualProbeNumber(forcedReference.averageUnweightedContributionLuma, expectedUnweightedLuma, 1e-3));
        const rows = [];
        for (const target of naturalBsdfHitFrequencyPlan) {
            const sentinel = await measureCloudMisWeightProbeMode(7, target, timeout);
            const totalPixelSamples = sentinel ? sentinel.width * sentinel.height * target : 0;
            const naturalBsdfHitObserved = Boolean(sentinel &&
                sentinel.eventMass > 0 &&
                nearlyEqualProbeNumber(sentinel.averageContributionLuma, expectedWeightedLuma, 1e-3) &&
                nearlyEqualProbeNumber(sentinel.averageUnweightedContributionLuma, expectedUnweightedLuma, 1e-3));
            const naturalBsdfHitNoEvent = Boolean(sentinel &&
                sentinel.eventMass === 0 &&
                sentinel.channelMass &&
                nearlyEqualProbeNumber(sentinel.channelMass.r, 0, 1e-6) &&
                nearlyEqualProbeNumber(sentinel.channelMass.g, 0, 1e-6) &&
                nearlyEqualProbeNumber(sentinel.channelMass.b, 0, 1e-6));
            const naturalBsdfHitContaminated = Boolean(sentinel &&
                sentinel.eventMass > 0 &&
                !naturalBsdfHitObserved);
            const eventRate = totalPixelSamples > 0 ? sentinel.eventMass / totalPixelSamples : null;
            rows.push({
                targetSamples: target,
                eventMass: sentinel ? sentinel.eventMass : null,
                naturalBsdfHitObserved,
                naturalBsdfHitNoEvent,
                naturalBsdfHitContaminated,
                eventsPerIsolatedSample: sentinel ? Number((sentinel.eventMass / target).toExponential(6)) : null,
                naturalBsdfHitEventRatePerPixelSample: Number.isFinite(eventRate) ? Number(eventRate.toExponential(6)) : null,
                averageContributionLuma: sentinel ? sentinel.averageContributionLuma : null,
                averageUnweightedContributionLuma: sentinel ? sentinel.averageUnweightedContributionLuma : null,
                sentinel
            });
        }
        const firstObserved = rows.find((row) => row.naturalBsdfHitObserved);
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : null;
        const noEventRows = rows.filter((row) => row.naturalBsdfHitNoEvent);
        const naturalBsdfHitNoEventUpToSamples = firstObserved
            ? null
            : (noEventRows.length > 0 ? noEventRows[noEventRows.length - 1].targetSamples : null);
        const result = {
            version: CLOUD_MIS_WEIGHT_PROBE_VERSION,
            analysisScope: 'naturalCloudBsdfHitFrequencyProbe',
            renderPathMutation: false,
            probeShaderMutation: true,
            normalRenderProbeMode: 0,
            naturalProbeMode: 7,
            naturalBsdfHitFrequencyPlan,
            currentPanelConfig,
            currentCameraPreset,
            forcedReferencePass,
            forcedReference,
            naturalBsdfHitObserved: Boolean(firstObserved),
            naturalBsdfHitFirstObservedAtSamples: firstObserved ? firstObserved.targetSamples : null,
            naturalBsdfHitNoEventUpToSamples,
            naturalBsdfHitEventMass: lastRow ? lastRow.eventMass : null,
            naturalBsdfHitEventsPerIsolatedSample: lastRow ? lastRow.eventsPerIsolatedSample : null,
            naturalBsdfHitEventRatePerPixelSample: lastRow ? lastRow.naturalBsdfHitEventRatePerPixelSample : null,
            rows,
            interpretation: {
                forcedReferenceMeaning: 'probeRoutingStillWorks',
                noEventMeaning: 'naturalCloudBsdfHitWasNotObservedWithinThisIsolatedSamplePlan',
                observedMeaning: 'naturalCloudBsdfHitCanBeMeasuredAndShouldGetHistogramNext',
                contaminatedMeaning: 'naturalSentinelReadbackNeedsRepairBeforeFrequencyDecision'
            },
            recommendedNextStep: !forcedReferencePass
                ? 'fixForcedReferenceBeforeNaturalFrequencyDecision'
                : (firstObserved
                    ? 'buildNaturalBsdfHitHistogram'
                    : 'deprioritizeNaturalBsdfHitAsPrimarySuspectOrRunLargerPlan')
        };
        console.table(rows.map((row) => ({
            targetSamples: row.targetSamples,
            eventMass: row.eventMass,
            naturalBsdfHitObserved: row.naturalBsdfHitObserved,
            naturalBsdfHitNoEvent: row.naturalBsdfHitNoEvent,
            naturalBsdfHitContaminated: row.naturalBsdfHitContaminated,
            eventsPerIsolatedSample: row.eventsPerIsolatedSample,
            naturalBsdfHitEventRatePerPixelSample: row.naturalBsdfHitEventRatePerPixelSample
        })));
        return result;
    } finally {
        pathTracingUniforms.uCloudMisWeightProbeMode.value = original.misMode;
        if (pathTracingUniforms.uCloudContributionProbeMode && original.contributionMode !== null) {
            pathTracingUniforms.uCloudContributionProbeMode.value = original.contributionMode;
        }
        cloudMisWeightProbeDisplayMode = original.displayMode;
        if (pathTracingUniforms.uCloudVisibilityProbeMode && original.visibilityMode !== null) {
            pathTracingUniforms.uCloudVisibilityProbeMode.value = original.visibilityMode;
        }
        resetCloudVisibilityProbeAccumulation();
        wakeRender();
    }
};

window.reportCloudVisibilityProbeAfterSamples = async function (mode, rod, blockerClass, thetaBin, thetaBinCount, targetSamples, timeoutMs) {
    const setResult = window.setCloudVisibilityProbe(
        mode == null ? 3 : mode,
        rod == null ? -1 : rod,
        blockerClass == null ? 'zeroCloudFacing' : blockerClass,
        thetaBin == null ? -1 : thetaBin,
        thetaBinCount == null ? CLOUD_VISIBILITY_PROBE_THETA_BIN_COUNT_DEFAULT : thetaBinCount
    );
    renderCloudVisibilityProbeReadbackSampleIfNeeded(3);
    const waitResult = await waitForCloudVisibilityProbeSamples(targetSamples == null ? 200 : targetSamples, timeoutMs == null ? 120000 : timeoutMs, 250);
    const summary = cloudVisibilityProbeSummary({ logTable: false });
    summary.setResult = setResult;
    summary.targetSamples = waitResult.targetSamples;
    summary.waitTimedOut = waitResult.timedOut;
    summary.waitElapsedMs = waitResult.elapsedMs;
    return summary;
};

window.reportCloudVisibilityProbeThetaScanAfterSamples = async function (blockerClass, rod, thetaBinCount, targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudVisibilityProbeMode || !pathTracingUniforms.uCloudVisibilityProbeRod ||
        !pathTracingUniforms.uCloudVisibilityProbeClass || !pathTracingUniforms.uCloudVisibilityProbeThetaBin ||
        !pathTracingUniforms.uCloudVisibilityProbeThetaBinCount) {
        return null;
    }

    const original = {
        mode: pathTracingUniforms.uCloudVisibilityProbeMode.value,
        rod: pathTracingUniforms.uCloudVisibilityProbeRod.value,
        blockerClass: pathTracingUniforms.uCloudVisibilityProbeClass.value,
        thetaBin: pathTracingUniforms.uCloudVisibilityProbeThetaBin.value,
        thetaBinCount: pathTracingUniforms.uCloudVisibilityProbeThetaBinCount.value
    };
    const rodValue = normalizeCloudVisibilityProbeRod(rod);
    const classValue = normalizeCloudVisibilityProbeClass(blockerClass == null ? 'zeroCloudFacing' : blockerClass);
    const countValue = normalizeCloudVisibilityProbeThetaBinCount(thetaBinCount);
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 200));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const bins = [];

    for (let bin = 0; bin < countValue; bin++) {
        window.setCloudVisibilityProbe(3, rodValue, classValue, bin, countValue);
        renderCloudVisibilityProbeReadbackSampleIfNeeded(3);
        const waitResult = await waitForCloudVisibilityProbeSamples(target, timeout, 250);
        const summary = cloudVisibilityProbeSummary({ logTable: false });
        bins.push({
            thetaBin: summary.thetaBin,
            thetaLabel: summary.thetaLabel,
            thetaStartDeg: summary.thetaStartDeg,
            thetaEndDeg: summary.thetaEndDeg,
            samples: summary.samples,
            targetSamples: waitResult.targetSamples,
            waitTimedOut: waitResult.timedOut,
            waitElapsedMs: waitResult.elapsedMs,
            selectedClass: summary.selectedClass,
            selectedClassRatio: summary.selectedClassRatio,
            selectedClassMass: summary.selectedClassMass,
            otherClassMass: summary.otherClassMass,
            selectedClassPixels: summary.selectedClassPixels,
            otherClassPixels: summary.otherClassPixels
        });
    }

    window.setCloudVisibilityProbe(original.mode, original.rod, original.blockerClass, original.thetaBin, original.thetaBinCount);
    const result = {
        probeVersion: CLOUD_VISIBILITY_PROBE_VERSION,
        rod: rodValue,
        rodLabel: rodValue < 0 ? 'all' : CLOUD_VISIBILITY_PROBE_ROD_LABELS[rodValue],
        selectedClass: classValue >= 0 ? CLOUD_VISIBILITY_PROBE_CLASS_LABELS[classValue] : 'all',
        thetaBinCount: countValue,
        targetSamples: target,
        bins
    };
    return result;
};

window.reportCloudFacingDiagnosticAfterSamples = async function (rod, thetaBin, thetaBinCount, targetSamples, timeoutMs) {
    const setResult = window.setCloudVisibilityProbe(
        4,
        rod == null ? -1 : rod,
        -1,
        thetaBin == null ? -1 : thetaBin,
        thetaBinCount == null ? CLOUD_VISIBILITY_PROBE_THETA_BIN_COUNT_DEFAULT : thetaBinCount
    );
    renderCloudVisibilityProbeReadbackSampleIfNeeded(4);
    const waitResult = await waitForCloudVisibilityProbeSamples(targetSamples == null ? 200 : targetSamples, timeoutMs == null ? 120000 : timeoutMs, 250);
    const summary = cloudVisibilityProbeSummary({ logTable: false });
    summary.setResult = setResult;
    summary.targetSamples = waitResult.targetSamples;
    summary.waitTimedOut = waitResult.timedOut;
    summary.waitElapsedMs = waitResult.elapsedMs;
    return summary;
};

function summarizeCloudFacingThetaScanRatioRange(bins, key) {
    let minValue = Infinity;
    let maxValue = -Infinity;
    let minBin = null;
    let maxBin = null;
    let total = 0;
    let count = 0;

    bins.forEach((bin) => {
        const value = Number(bin[key]);
        if (!Number.isFinite(value)) return;
        count++;
        total += value;
        if (value < minValue) {
            minValue = value;
            minBin = bin;
        }
        if (value > maxValue) {
            maxValue = value;
            maxBin = bin;
        }
    });

    if (!count) {
        return {
            min: null,
            max: null,
            spread: null,
            average: null,
            minBin: null,
            maxBin: null,
            count: 0
        };
    }

    return {
        min: minValue,
        max: maxValue,
        spread: maxValue - minValue,
        average: total / count,
        minBin: minBin ? minBin.thetaBin : null,
        maxBin: maxBin ? maxBin.thetaBin : null,
        count
    };
}

function summarizeCloudFacingThetaScanBin(bin, key) {
    if (!bin) return null;
    return {
        thetaBin: bin.thetaBin,
        thetaLabel: bin.thetaLabel,
        thetaStartDeg: bin.thetaStartDeg,
        thetaEndDeg: bin.thetaEndDeg,
        value: Number.isFinite(Number(bin[key])) ? Number(bin[key]) : null
    };
}

function summarizeCloudFacingThetaScanTrend(bins) {
    const values = bins
        .map((bin) => Number(bin.normalMinusProbeFacingZeroRatio))
        .filter((value) => Number.isFinite(value));
    if (values.length < 2) return 'insufficient';

    const first = values[0];
    const last = values[values.length - 1];
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const spread = maxValue - minValue;
    const threshold = Math.max(0.005, spread * 0.05);
    if (spread <= threshold) return 'flat';

    const maxIndex = values.indexOf(maxValue);
    const peakNearEnd = maxIndex >= Math.max(0, values.length - 2);
    const lastStillHigh = last >= minValue + spread * 0.75;
    if (last > first + threshold && peakNearEnd && lastStillHigh) return 'risesAndStaysHigh';
    if (last > first + threshold) return 'rising';
    if (last < first - threshold) return 'falling';
    return 'mixed';
}

function summarizeCloudFacingThetaGeometry(thetaBinCount, maxDiffBin) {
    const count = normalizeCloudVisibilityProbeThetaBinCount(thetaBinCount);
    const bins = [];
    let maxNormalUpwardBin = null;
    let maxNormalUpward = -Infinity;

    for (let bin = 0; bin < count; bin++) {
        const thetaStart = (bin / count) * CLOUD_ARC_THETA_MAX;
        const thetaEnd = ((bin + 1) / count) * CLOUD_ARC_THETA_MAX;
        const thetaMid = (thetaStart + thetaEnd) * 0.5;
        const normalOutward = Math.cos(thetaMid);
        const normalUpward = Math.sin(thetaMid);
        const item = {
            thetaBin: bin,
            thetaLabel: bin + '/' + count,
            thetaStartDeg: Number((thetaStart * 180 / Math.PI).toFixed(2)),
            thetaEndDeg: Number((thetaEnd * 180 / Math.PI).toFixed(2)),
            normalOutward: Number(normalOutward.toFixed(4)),
            normalUpward: Number(normalUpward.toFixed(4)),
            probeInward: Number(normalOutward.toFixed(4)),
            probeDownward: Number(normalUpward.toFixed(4))
        };
        bins.push(item);
        if (normalUpward > maxNormalUpward) {
            maxNormalUpward = normalUpward;
            maxNormalUpwardBin = item;
        }
    }

    const maxDiffBinNumber = Number(maxDiffBin);
    const highUpwardBinStart = Math.max(0, count - 2);
    return {
        cloudArcNormalFormula: 'outAxis * cos(theta) + up * sin(theta)',
        cloudArcEmissionNormalRelation: '-cloudArcNormal',
        normalUpwardTrend: 'increasesWithTheta',
        highUpwardBinStart,
        maxNormalUpwardBin,
        maxDiffNearHighUpwardEnd: Number.isFinite(maxDiffBinNumber) ? maxDiffBinNumber >= highUpwardBinStart : null,
        bins
    };
}

function summarizeCloudFacingThetaScan(bins) {
    const safeBins = Array.isArray(bins) ? bins : [];
    const diffRange = summarizeCloudFacingThetaScanRatioRange(safeBins, 'normalMinusProbeFacingZeroRatio');
    const minDiffSource = safeBins.find((bin) => bin.thetaBin === diffRange.minBin) || null;
    const maxDiffSource = safeBins.find((bin) => bin.thetaBin === diffRange.maxBin) || null;
    const geometryHint = summarizeCloudFacingThetaGeometry(safeBins.length || CLOUD_VISIBILITY_PROBE_THETA_BIN_COUNT_DEFAULT, diffRange.maxBin);

    return {
        binCount: safeBins.length,
        validDiffBinCount: diffRange.count,
        waitTimedOutCount: safeBins.filter((bin) => bin.waitTimedOut).length,
        diffTrend: summarizeCloudFacingThetaScanTrend(safeBins),
        geometryHint,
        maxDiffNearHighUpwardEnd: geometryHint.maxDiffNearHighUpwardEnd,
        minDiffBin: summarizeCloudFacingThetaScanBin(minDiffSource, 'normalMinusProbeFacingZeroRatio'),
        maxDiffBin: summarizeCloudFacingThetaScanBin(maxDiffSource, 'normalMinusProbeFacingZeroRatio'),
        normalCloudFacingZeroRatioRange: summarizeCloudFacingThetaScanRatioRange(safeBins, 'normalCloudFacingZeroRatio'),
        probeCloudFacingZeroRatioRange: summarizeCloudFacingThetaScanRatioRange(safeBins, 'probeCloudFacingZeroRatio'),
        normalMinusProbeFacingZeroRatioRange: diffRange
    };
}

function summarizeCloudFacingRodThetaScans(rods) {
    const safeRods = Array.isArray(rods) ? rods : [];
    const maxDiffByRod = safeRods.map((scan) => {
        const maxDiff = scan && scan.summary ? scan.summary.maxDiffBin : null;
        const range = scan && scan.summary ? scan.summary.normalMinusProbeFacingZeroRatioRange : null;
        return {
            rod: scan ? scan.rod : null,
            rodLabel: scan ? scan.rodLabel : null,
            maxDiffBin: maxDiff ? maxDiff.thetaBin : null,
            maxDiffThetaLabel: maxDiff ? maxDiff.thetaLabel : null,
            maxDiffValue: maxDiff ? maxDiff.value : null,
            diffTrend: scan && scan.summary ? scan.summary.diffTrend : null,
            maxDiffNearHighUpwardEnd: scan && scan.summary ? scan.summary.maxDiffNearHighUpwardEnd : null,
            diffSpread: range ? range.spread : null,
            waitTimedOutCount: scan && scan.summary ? scan.summary.waitTimedOutCount : null
        };
    });
    const validMaxDiffs = maxDiffByRod.filter((item) =>
        Number.isFinite(Number(item.maxDiffBin)) && Number.isFinite(Number(item.maxDiffValue))
    );
    const uniqueMaxDiffBins = Array.from(new Set(validMaxDiffs.map((item) => item.maxDiffBin))).sort((a, b) => a - b);
    let dominantRod = null;
    validMaxDiffs.forEach((item) => {
        if (!dominantRod || item.maxDiffValue > dominantRod.maxDiffValue) dominantRod = item;
    });
    const maxDiffValues = validMaxDiffs.map((item) => item.maxDiffValue);
    const minMaxDiff = maxDiffValues.length ? Math.min(...maxDiffValues) : null;
    const maxMaxDiff = maxDiffValues.length ? Math.max(...maxDiffValues) : null;

    return {
        rodCount: safeRods.length,
        rodLabels: safeRods.map((scan) => scan.rodLabel),
        maxDiffByRod,
        uniqueMaxDiffBins,
        sharedMaxDiffBin: uniqueMaxDiffBins.length === 1 ? uniqueMaxDiffBins[0] : null,
        maxDiffBinPattern: !validMaxDiffs.length ? 'insufficient' : (uniqueMaxDiffBins.length === 1 ? 'same' : 'mixed'),
        allRodsMaxDiffNearHighUpwardEnd: validMaxDiffs.length === safeRods.length && validMaxDiffs.every((item) => item.maxDiffNearHighUpwardEnd === true),
        dominantRod,
        maxDiffValueRange: {
            min: minMaxDiff,
            max: maxMaxDiff,
            spread: maxDiffValues.length ? maxMaxDiff - minMaxDiff : null,
            count: maxDiffValues.length
        }
    };
}

function summarizeCloudThetaImportanceSamplingCandidate(rodThetaScan, options = { protectedFloor: 0.65 }) {
    const source = rodThetaScan || {};
    const sourceRods = Array.isArray(source.rods) ? source.rods : [];
    const inferredBinCount = sourceRods.reduce((maxCount, scan) => {
        const bins = scan && Array.isArray(scan.bins) ? scan.bins : [];
        return Math.max(maxCount, bins.length);
    }, 0);
    const thetaBinCount = normalizeCloudVisibilityProbeThetaBinCount(source.thetaBinCount || inferredBinCount);
    const uniformThetaBinPdf = Number((1 / thetaBinCount).toFixed(6));
    const protectedFloor = normalizeCloudThetaImportanceProtectedFloor(options && options.protectedFloor);
    const maxReduction = 1 - protectedFloor;
    const metric = 'normalMinusProbeFacingZeroRatio';

    const averageDiffByBin = [];
    for (let bin = 0; bin < thetaBinCount; bin++) {
        const values = sourceRods.map((scan) => {
            const bins = scan && Array.isArray(scan.bins) ? scan.bins : [];
            const item = bins.find((entry) => entry && entry.thetaBin === bin) || bins[bin];
            return item ? Number(item[metric]) : NaN;
        }).filter((value) => Number.isFinite(value));
        const averageDiff = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        averageDiffByBin.push({
            thetaBin: bin,
            thetaLabel: bin + '/' + thetaBinCount,
            valueCount: values.length,
            averageDiff
        });
    }

    const validDiffs = averageDiffByBin
        .map((item) => item.averageDiff)
        .filter((value) => Number.isFinite(value));
    const minDiff = validDiffs.length ? Math.min(...validDiffs) : null;
    const maxDiff = validDiffs.length ? Math.max(...validDiffs) : null;
    const diffSpread = Number.isFinite(minDiff) && Number.isFinite(maxDiff) ? maxDiff - minDiff : 0;
    const rawWeights = averageDiffByBin.map((item) => {
        if (!Number.isFinite(item.averageDiff) || diffSpread <= 0) return 1;
        const diff01 = (item.averageDiff - minDiff) / diffSpread;
        return Math.max(protectedFloor, 1 - diff01 * maxReduction);
    });
    const rawWeightSum = rawWeights.reduce((sum, value) => sum + value, 0) || thetaBinCount;
    const geometryHint = summarizeCloudFacingThetaGeometry(thetaBinCount, source.summary ? source.summary.sharedMaxDiffBin : null);
    const bins = averageDiffByBin.map((item, index) => {
        const candidateThetaBinPdf = rawWeights[index] / rawWeightSum;
        const relativeToUniform = candidateThetaBinPdf / uniformThetaBinPdf;
        const pdfCompensationMultiplier = uniformThetaBinPdf / candidateThetaBinPdf;
        const geometry = geometryHint.bins[index] || cloudVisibilityProbeThetaBinInfo(index, thetaBinCount);
        return {
            thetaBin: item.thetaBin,
            thetaLabel: item.thetaLabel,
            thetaStartDeg: geometry.thetaStartDeg,
            thetaEndDeg: geometry.thetaEndDeg,
            normalUpward: geometry.normalUpward,
            metric,
            averageNormalMinusProbeFacingZeroRatio: Number.isFinite(item.averageDiff) ? Number(item.averageDiff.toFixed(4)) : null,
            valueCount: item.valueCount,
            rawWeight: Number(rawWeights[index].toFixed(4)),
            uniformThetaBinPdf,
            candidateThetaBinPdf: Number(candidateThetaBinPdf.toFixed(6)),
            relativeToUniform: Number(relativeToUniform.toFixed(4)),
            pdfCompensationMultiplier: Number(pdfCompensationMultiplier.toFixed(4)),
            candidateAction: relativeToUniform < 0.98 ? 'sampleLess' : (relativeToUniform > 1.02 ? 'sampleMore' : 'keepNearUniform')
        };
    });
    const reducedBins = bins.filter((item) => item.candidateAction === 'sampleLess');
    const boostedBins = bins.filter((item) => item.candidateAction === 'sampleMore');
    const maxPdfCompensationMultiplier = bins.length ? Math.max(...bins.map((item) => item.pdfCompensationMultiplier)) : null;
    const maxReductionBin = reducedBins.reduce((best, item) => {
        if (!best || item.relativeToUniform < best.relativeToUniform) return item;
        return best;
    }, null);

    return {
        candidateVersion: CLOUD_THETA_IMPORTANCE_CANDIDATE_VERSION,
        sourceProbeVersion: source.probeVersion || null,
        analysisScope: 'probeOnlyThetaImportanceCandidate',
        renderPathMutation: false,
        shaderMutation: false,
        thetaBinCount,
        metric: 'normalMinusProbeFacingZeroRatio',
        protectedFloor,
        renderEnergyNormal: CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.renderEnergyNormal,
        probeClassificationNormal: CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.probeClassificationNormal,
        pdfContract: {
            requiresThetaPdfCompensation: true,
            uniformThetaBinPdf,
            candidatePdfField: 'candidateThetaBinPdf',
            compensationField: 'pdfCompensationMultiplier'
        },
        evidence: {
            sharedMaxDiffBin: source.summary ? source.summary.sharedMaxDiffBin : null,
            maxDiffBinPattern: source.summary ? source.summary.maxDiffBinPattern : null,
            allRodsMaxDiffNearHighUpwardEnd: source.summary ? source.summary.allRodsMaxDiffNearHighUpwardEnd : null,
            dominantRod: source.summary ? source.summary.dominantRod : null
        },
        diffRange: {
            min: Number.isFinite(minDiff) ? Number(minDiff.toFixed(4)) : null,
            max: Number.isFinite(maxDiff) ? Number(maxDiff.toFixed(4)) : null,
            spread: Number.isFinite(diffSpread) ? Number(diffSpread.toFixed(4)) : null,
            count: validDiffs.length
        },
        maxPdfCompensationMultiplier: Number.isFinite(maxPdfCompensationMultiplier) ? Number(maxPdfCompensationMultiplier.toFixed(4)) : null,
        maxReductionBin,
        reducedBins,
        boostedBins,
        bins,
        recommendedNextStep: 'probeOnlyAB'
    };
}

window.summarizeCloudThetaImportanceSamplingCandidate = summarizeCloudThetaImportanceSamplingCandidate;

function summarizeCloudThetaImportanceProbeAB(rodThetaScan, options) {
    const candidate = summarizeCloudThetaImportanceSamplingCandidate(rodThetaScan, options);
    const bins = Array.isArray(candidate.bins) ? candidate.bins : [];
    const metric = 'normalMinusProbeFacingZeroRatio';
    let estimatedUniformWasteProxy = 0;
    let estimatedCandidateWasteProxy = 0;
    const comparisonBins = bins.map((bin) => {
        const averageDiff = Number(bin.averageNormalMinusProbeFacingZeroRatio);
        const uniformThetaBinPdf = Number(bin.uniformThetaBinPdf);
        const candidateThetaBinPdf = Number(bin.candidateThetaBinPdf);
        const uniformWasteProxy = Number.isFinite(averageDiff) ? uniformThetaBinPdf * averageDiff : 0;
        const candidateWasteProxy = Number.isFinite(averageDiff) ? candidateThetaBinPdf * averageDiff : 0;
        estimatedUniformWasteProxy += uniformWasteProxy;
        estimatedCandidateWasteProxy += candidateWasteProxy;
        return {
            thetaBin: bin.thetaBin,
            thetaLabel: bin.thetaLabel,
            metric,
            averageNormalMinusProbeFacingZeroRatio: bin.averageNormalMinusProbeFacingZeroRatio,
            uniformThetaBinPdf,
            candidateThetaBinPdf,
            candidateToUniformSampleRatio: Number(bin.relativeToUniform),
            pdfCompensationMultiplier: bin.pdfCompensationMultiplier,
            uniformWasteProxy: Number(uniformWasteProxy.toFixed(6)),
            candidateWasteProxy: Number(candidateWasteProxy.toFixed(6)),
            wasteProxyDelta: Number((uniformWasteProxy - candidateWasteProxy).toFixed(6)),
            candidateAction: bin.candidateAction
        };
    });
    const estimatedWasteProxyDelta = estimatedUniformWasteProxy - estimatedCandidateWasteProxy;
    const estimatedWasteProxyReductionRatio = estimatedUniformWasteProxy > 0 ? estimatedWasteProxyDelta / estimatedUniformWasteProxy : 0;

    return {
        abVersion: CLOUD_THETA_IMPORTANCE_AB_VERSION,
        candidateVersion: candidate.candidateVersion,
        sourceProbeVersion: candidate.sourceProbeVersion,
        analysisScope: 'probeOnlyThetaImportanceAB',
        renderPathMutation: false,
        shaderMutation: false,
        baselineStrategy: 'uniformTheta',
        candidateStrategy: 'thetaImportanceCandidate',
        estimateBasis: 'rodThetaScanBinAverages',
        thetaBinCount: candidate.thetaBinCount,
        metric: 'normalMinusProbeFacingZeroRatio',
        protectedFloor: candidate.protectedFloor,
        renderEnergyNormal: candidate.renderEnergyNormal,
        probeClassificationNormal: candidate.probeClassificationNormal,
        pdfContract: candidate.pdfContract,
        evidence: candidate.evidence,
        estimatedUniformWasteProxy: Number(estimatedUniformWasteProxy.toFixed(6)),
        estimatedCandidateWasteProxy: Number(estimatedCandidateWasteProxy.toFixed(6)),
        estimatedWasteProxyDelta: Number(estimatedWasteProxyDelta.toFixed(6)),
        estimatedWasteProxyReductionRatio: Number(estimatedWasteProxyReductionRatio.toFixed(4)),
        maxPdfCompensationMultiplier: candidate.maxPdfCompensationMultiplier,
        maxReductionBin: candidate.maxReductionBin,
        reducedBins: candidate.reducedBins,
        boostedBins: candidate.boostedBins,
        bins: comparisonBins,
        recommendedNextStep: 'shaderAB'
    };
}

window.summarizeCloudThetaImportanceProbeAB = summarizeCloudThetaImportanceProbeAB;

function summarizeCloudThetaImportanceStrengthSweep(rodThetaScan, protectedFloors) {
    const agreedSweep = { protectedFloors: [0.5, 0.65, 0.8] };
    const requestedFloors = Array.isArray(protectedFloors) && protectedFloors.length ? protectedFloors : agreedSweep.protectedFloors;
    const sweepFloors = requestedFloors
        .map((value) => normalizeCloudThetaImportanceProtectedFloor(value))
        .filter((value, index, values) => values.indexOf(value) === index);
    const activeFloors = sweepFloors.length ? sweepFloors : agreedSweep.protectedFloors;
    const candidates = activeFloors.map((protectedFloor) => {
        const ab = summarizeCloudThetaImportanceProbeAB(rodThetaScan, { protectedFloor });
        const maxReductionBin = ab.maxReductionBin ? {
            thetaBin: ab.maxReductionBin.thetaBin,
            thetaLabel: ab.maxReductionBin.thetaLabel,
            averageNormalMinusProbeFacingZeroRatio: ab.maxReductionBin.averageNormalMinusProbeFacingZeroRatio,
            candidateToUniformSampleRatio: ab.maxReductionBin.relativeToUniform,
            pdfCompensationMultiplier: ab.maxReductionBin.pdfCompensationMultiplier
        } : null;
        return {
            protectedFloor,
            estimatedUniformWasteProxy: ab.estimatedUniformWasteProxy,
            estimatedCandidateWasteProxy: ab.estimatedCandidateWasteProxy,
            estimatedWasteProxyDelta: ab.estimatedWasteProxyDelta,
            estimatedWasteProxyReductionRatio: ab.estimatedWasteProxyReductionRatio,
            maxPdfCompensationMultiplier: ab.maxPdfCompensationMultiplier,
            maxReductionBin,
            reducedBinCount: Array.isArray(ab.reducedBins) ? ab.reducedBins.length : 0,
            boostedBinCount: Array.isArray(ab.boostedBins) ? ab.boostedBins.length : 0,
            recommendedNextStep: ab.recommendedNextStep
        };
    });
    const validCandidates = candidates.filter((candidate) =>
        Number.isFinite(candidate.estimatedWasteProxyReductionRatio) &&
        Number.isFinite(candidate.maxPdfCompensationMultiplier)
    );
    const bestByReduction = validCandidates.reduce((best, candidate) => {
        if (!best) return candidate;
        if (candidate.estimatedWasteProxyReductionRatio > best.estimatedWasteProxyReductionRatio) return candidate;
        if (candidate.estimatedWasteProxyReductionRatio === best.estimatedWasteProxyReductionRatio &&
            candidate.maxPdfCompensationMultiplier < best.maxPdfCompensationMultiplier) return candidate;
        return best;
    }, null);
    const safestByPdf = validCandidates.reduce((best, candidate) => {
        if (!best) return candidate;
        if (candidate.maxPdfCompensationMultiplier < best.maxPdfCompensationMultiplier) return candidate;
        if (candidate.maxPdfCompensationMultiplier === best.maxPdfCompensationMultiplier &&
            candidate.estimatedWasteProxyReductionRatio > best.estimatedWasteProxyReductionRatio) return candidate;
        return best;
    }, null);

    return {
        sweepVersion: CLOUD_THETA_IMPORTANCE_STRENGTH_SWEEP_VERSION,
        abVersion: CLOUD_THETA_IMPORTANCE_AB_VERSION,
        sourceProbeVersion: rodThetaScan && rodThetaScan.probeVersion ? rodThetaScan.probeVersion : null,
        analysisScope: 'probeOnlyThetaImportanceStrengthSweep',
        renderPathMutation: false,
        shaderMutation: false,
        baselineStrategy: 'uniformTheta',
        candidateStrategy: 'thetaImportanceCandidate',
        estimateBasis: 'rodThetaScanBinAverages',
        defaultProtectedFloors: agreedSweep.protectedFloors,
        protectedFloors: activeFloors,
        candidateCount: candidates.length,
        candidates,
        bestByReduction,
        safestByPdf,
        recommendedProtectedFloor: bestByReduction ? bestByReduction.protectedFloor : null,
        recommendedNextStep: 'reviewStrengthSweepBeforeShaderAB'
    };
}

window.summarizeCloudThetaImportanceStrengthSweep = summarizeCloudThetaImportanceStrengthSweep;

window.reportCloudFacingDiagnosticRodThetaScanAfterSamples = async function (thetaBinCount, targetSamples, timeoutMs) {
    const rods = [];
    for (let rod = 0; rod < CLOUD_VISIBILITY_PROBE_ROD_LABELS.length; rod++) {
        const scan = await window.reportCloudFacingDiagnosticThetaScanAfterSamples(rod, thetaBinCount, targetSamples, timeoutMs);
        rods.push(scan);
    }

    return {
        probeVersion: CLOUD_VISIBILITY_PROBE_VERSION,
        thetaBinCount: normalizeCloudVisibilityProbeThetaBinCount(thetaBinCount),
        targetSamples: Math.max(1, Math.trunc(Number(targetSamples) || 200)),
        legacyZeroCloudFacingAlias: CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.legacyZeroCloudFacingAlias,
        renderEnergyNormal: CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.renderEnergyNormal,
        probeClassificationNormal: CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.probeClassificationNormal,
        summary: summarizeCloudFacingRodThetaScans(rods),
        rods
    };
};

window.reportCloudFacingDiagnosticThetaScanAfterSamples = async function (rod, thetaBinCount, targetSamples, timeoutMs) {
    if (!pathTracingUniforms || !pathTracingUniforms.uCloudVisibilityProbeMode || !pathTracingUniforms.uCloudVisibilityProbeRod ||
        !pathTracingUniforms.uCloudVisibilityProbeClass || !pathTracingUniforms.uCloudVisibilityProbeThetaBin ||
        !pathTracingUniforms.uCloudVisibilityProbeThetaBinCount) {
        return null;
    }

    const original = {
        mode: pathTracingUniforms.uCloudVisibilityProbeMode.value,
        rod: pathTracingUniforms.uCloudVisibilityProbeRod.value,
        blockerClass: pathTracingUniforms.uCloudVisibilityProbeClass.value,
        thetaBin: pathTracingUniforms.uCloudVisibilityProbeThetaBin.value,
        thetaBinCount: pathTracingUniforms.uCloudVisibilityProbeThetaBinCount.value
    };
    const rodValue = normalizeCloudVisibilityProbeRod(rod);
    const countValue = normalizeCloudVisibilityProbeThetaBinCount(thetaBinCount);
    const target = Math.max(1, Math.trunc(Number(targetSamples) || 200));
    const timeout = Math.max(1000, Math.trunc(Number(timeoutMs) || 120000));
    const bins = [];

    for (let bin = 0; bin < countValue; bin++) {
        window.setCloudVisibilityProbe(4, rodValue, -1, bin, countValue);
        renderCloudVisibilityProbeReadbackSampleIfNeeded(4);
        const waitResult = await waitForCloudVisibilityProbeSamples(target, timeout, 250);
        const summary = cloudVisibilityProbeSummary({ logTable: false });
        bins.push({
            thetaBin: summary.thetaBin,
            thetaLabel: summary.thetaLabel,
            thetaStartDeg: summary.thetaStartDeg,
            thetaEndDeg: summary.thetaEndDeg,
            samples: summary.samples,
            targetSamples: waitResult.targetSamples,
            waitTimedOut: waitResult.timedOut,
            waitElapsedMs: waitResult.elapsedMs,
            sourceFacingZeroRatio: summary.sourceFacingZeroRatio,
            normalCloudFacingZeroRatio: summary.normalCloudFacingZeroRatio,
            probeCloudFacingZeroRatio: summary.probeCloudFacingZeroRatio,
            normalMinusProbeFacingZeroRatio: summary.normalMinusProbeFacingZeroRatio,
            sourceFacingZeroMass: summary.sourceFacingZeroMass,
            normalCloudFacingZeroMass: summary.normalCloudFacingZeroMass,
            probeCloudFacingZeroMass: summary.probeCloudFacingZeroMass,
            normalMinusProbeFacingZeroMass: summary.normalMinusProbeFacingZeroMass,
            facingDiagnosticMass: summary.facingDiagnosticMass
        });
    }

    window.setCloudVisibilityProbe(original.mode, original.rod, original.blockerClass, original.thetaBin, original.thetaBinCount);
    return {
        probeVersion: CLOUD_VISIBILITY_PROBE_VERSION,
        rod: rodValue,
        rodLabel: rodValue < 0 ? 'all' : CLOUD_VISIBILITY_PROBE_ROD_LABELS[rodValue],
        thetaBinCount: countValue,
        targetSamples: target,
        legacyZeroCloudFacingAlias: CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.legacyZeroCloudFacingAlias,
        renderEnergyNormal: CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.renderEnergyNormal,
        probeClassificationNormal: CLOUD_FACING_DIAGNOSTIC_DEFINITIONS.probeClassificationNormal,
        summary: summarizeCloudFacingThetaScan(bins),
        bins
    };
};

window.reportCloudVisibilityProbe = function () {
    return cloudVisibilityProbeSummary({ logTable: true });
};

function buildSnapshotBar() {
    const bar = document.getElementById('snapshot-bar');
    if (!bar) return;

    bar.innerHTML = '';
    snapshots.forEach((snap) => {
        const chip = document.createElement('button');
        chip.className = 'snapshot-chip';
        chip.textContent = snap.samples.toLocaleString() + ' spp 💾';
        chip.title = snap.filename;
        chip.onclick = () => {
            const a = document.createElement('a');
            a.href = snap.src;
            a.download = snap.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
        bar.appendChild(chip);
    });
    updateSnapshotControls();
}

function updateSamplingControls() {
    const samplingToggle = document.getElementById('btn-toggle-sampling');
    if (!samplingToggle || typeof window.reportSamplingPaused !== 'function') return;
    const stepButton = document.getElementById('btn-step-sampling');
    const stepBackButton = document.getElementById('btn-step-back-sampling');
    const report = window.reportSamplingPaused();
    samplingToggle.textContent = report.paused ? '繼續採樣' : '暫停採樣';
    if (stepButton) stepButton.disabled = !report.paused || report.stepOncePending;
    if (stepBackButton) stepBackButton.disabled = !report.paused || report.stepOncePending || report.stepHistoryDepth <= 0;
}

window.updateSamplingControls = updateSamplingControls;

function updateSnapshotControls() {
    const toggle = document.getElementById('btn-toggle-snapshots');
    const manual = document.getElementById('btn-manual-capture');
    const saveAll = document.getElementById('btn-save-all');
    if (toggle) toggle.textContent = SNAPSHOT_CAPTURE_ENABLED ? '快照：開' : '快照：關';
    if (manual) manual.disabled = !SNAPSHOT_CAPTURE_ENABLED;
    if (saveAll) saveAll.disabled = !SNAPSHOT_CAPTURE_ENABLED || snapshots.length === 0;
    updateSamplingControls();
}

function setSnapshotCaptureEnabled(enabled) {
    SNAPSHOT_CAPTURE_ENABLED = !!enabled;
    if (!SNAPSHOT_CAPTURE_ENABLED) {
        snapshots.length = 0;
        capturedMilestones.clear();
        lastSnapshotCheck = -1;
        const bar = document.getElementById('snapshot-bar');
        if (bar) bar.innerHTML = '';
    }
    updateSnapshotControls();
    return {
        enabled: SNAPSHOT_CAPTURE_ENABLED,
        milestoneCount: SNAPSHOT_CAPTURE_ENABLED ? SNAPSHOT_MILESTONE_PRESET.length : 0,
        snapshots: snapshots.length
    };
}

window.setSnapshotCaptureEnabled = setSnapshotCaptureEnabled;

function captureDueSnapshotsForCurrentSample() {
    if (sampleCounter < lastSnapshotCheck) {
        snapshots.length = 0;
        capturedMilestones.clear();
        const bar = document.getElementById('snapshot-bar');
        if (bar) bar.innerHTML = '';
    }
    lastSnapshotCheck = sampleCounter;
    if (!SNAPSHOT_CAPTURE_ENABLED) return;
    const currentSamples = Math.round(sampleCounter);
    if ((SNAPSHOT_MILESTONE_PRESET.includes(currentSamples) || (currentSamples % 10000 === 0 && currentSamples >= 10000)) && !capturedMilestones.has(currentSamples)) {
        capturedMilestones.add(currentSamples);
        const dataURL = captureSnapshot();
        if (!dataURL) return;
        snapshots.push({
            samples: currentSamples,
            src: dataURL,
            filename: makeFilename(currentSamples)
        });
        buildSnapshotBar();
    }
}

window.captureDueSnapshotsForCurrentSample = captureDueSnapshotsForCurrentSample;

function resetRenderTimerForAccumulationRestart(nowMs) {
    if (typeof window._renderTimer === 'undefined') return;
    window._renderTimer.startMs = nowMs;
    window._renderTimer.finalMs = 0;
    window._renderTimer.frozen = false;
    window._renderTimer.paused = false;
    window._renderTimer.pauseStartMs = 0;
    window._renderTimer.pausedMs = 0;
}

function downloadAllSnapshots() {
    if (!SNAPSHOT_CAPTURE_ENABLED) return;
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

(function wireSnapshotButtons() {
    const toggle = document.getElementById('btn-toggle-snapshots');
    if (toggle) toggle.onclick = function () {
        setSnapshotCaptureEnabled(!SNAPSHOT_CAPTURE_ENABLED);
    };
    const saveAll = document.getElementById('btn-save-all');
    if (saveAll) saveAll.onclick = downloadAllSnapshots;
    const manual = document.getElementById('btn-manual-capture');
    if (manual) manual.onclick = function () {
        const dataURL = captureSnapshot();
        if (!dataURL) return;
        const a = document.createElement('a');
        a.href = dataURL;
        a.download = makeFilename(Math.round(sampleCounter));
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    const samplingToggle = document.getElementById('btn-toggle-sampling');
    if (samplingToggle) samplingToggle.onclick = function () {
        if (typeof window.setSamplingPaused !== 'function' || typeof window.reportSamplingPaused !== 'function') return;
        window.setSamplingPaused(!window.reportSamplingPaused().paused);
        updateSamplingControls();
    };
    const stepButton = document.getElementById('btn-step-sampling');
    if (stepButton) stepButton.onclick = function () {
        if (typeof window.requestSamplingStepOnce !== 'function') return;
        window.requestSamplingStepOnce();
        updateSamplingControls();
    };
    const stepBackButton = document.getElementById('btn-step-back-sampling');
    if (stepBackButton) stepBackButton.onclick = function () {
        if (typeof window.requestSamplingStepBack !== 'function') return;
        window.requestSamplingStepBack();
        updateSamplingControls();
    };
    updateSnapshotControls();
})();

// ==================== R3-2: 色溫→RGB 換算 ====================
// PCHIP (Fritsch-Carlson 1980) monotonic cubic Hermite 插值。
// 錨點：Mitchell Charity blackbody sRGB table
//   來源 URL：http://www.vendian.org/mncharity/dir3/blackbody/UnstableURLs/bbr_color.html
// 回傳 sRGB 域 [0,1] 的 {r, g, b} 物件（保 L1154 R2-11 吸頂燈 ABI 相容）。
// 消費端若進 path tracer radiance 需自行 pow(x, 2.2) 轉 linear（延後到 R3-3 接入時處理）。
// R3-2 unit test：docs/tests/r3-2-kelvin.test.js；改動本函式須同步更新該 test 檔函式本體副本。
const KELVIN_ANCHORS = [2000, 3000, 4000, 6500, 10000];
const KELVIN_RGB_TABLE = [
    { r: 1.00, g: 0.54, b: 0.17 },  // 2000K
    { r: 1.00, g: 0.75, b: 0.42 },  // 3000K
    { r: 1.00, g: 0.89, b: 0.76 },  // 4000K
    { r: 1.00, g: 0.99, b: 1.00 },  // 6500K (D65)
    { r: 0.79, g: 0.87, b: 1.00 },  // 10000K
];

function _pchipTangents(xs, ys) {
    const n = xs.length;
    const dk = new Array(n - 1);
    for (let k = 0; k < n - 1; k++) {
        dk[k] = (ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]);
    }
    const m = new Array(n);
    m[0] = dk[0];
    m[n - 1] = dk[n - 2];
    for (let k = 1; k < n - 1; k++) {
        if (dk[k - 1] * dk[k] <= 0) m[k] = 0;
        else m[k] = (dk[k - 1] + dk[k]) / 2;
    }
    return m;
}

const _KELVIN_TAN_R = _pchipTangents(KELVIN_ANCHORS, KELVIN_RGB_TABLE.map(c => c.r));
const _KELVIN_TAN_G = _pchipTangents(KELVIN_ANCHORS, KELVIN_RGB_TABLE.map(c => c.g));
const _KELVIN_TAN_B = _pchipTangents(KELVIN_ANCHORS, KELVIN_RGB_TABLE.map(c => c.b));

function _pchipEval(K, channel, tangents) {
    if (K <= KELVIN_ANCHORS[0]) return KELVIN_RGB_TABLE[0][channel];
    if (K >= KELVIN_ANCHORS[KELVIN_ANCHORS.length - 1]) {
        return KELVIN_RGB_TABLE[KELVIN_ANCHORS.length - 1][channel];
    }
    let k = 0;
    while (k < KELVIN_ANCHORS.length - 1 && K > KELVIN_ANCHORS[k + 1]) k++;
    const x0 = KELVIN_ANCHORS[k], x1 = KELVIN_ANCHORS[k + 1];
    const y0 = KELVIN_RGB_TABLE[k][channel], y1 = KELVIN_RGB_TABLE[k + 1][channel];
    const m0 = tangents[k], m1 = tangents[k + 1];
    const h = x1 - x0;
    const t = (K - x0) / h;
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * y0 + h10 * h * m0 + h01 * y1 + h11 * h * m1;
}

function kelvinToRGB(K) {
    return {
        r: _pchipEval(K, 'r', _KELVIN_TAN_R),
        g: _pchipEval(K, 'g', _KELVIN_TAN_G),
        b: _pchipEval(K, 'b', _KELVIN_TAN_B),
    };
}

let lockedPreset = null;
let cameraSwitchFrames = 0;

function switchCamera(preset) {
    const cam = CAMERA_PRESETS[preset];
    if (!cam) return;

    if (typeof invalidateMovementProtectionStableFrame === 'function') {
        invalidateMovementProtectionStableFrame('switchCamera');
    }
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
    pathTracingUniforms.uULen.value = pathTracingUniforms.uVLen.value * worldCamera.aspect;

    isPaused = true;
    cameraIsMoving = true;
    // R2-UI：瞬間清空累加 buffer，消除前視角殘影
    needClearAccumulation = true;

}

function initSceneData() {
    demoFragmentShaderFileName = 'Home_Studio_Fragment.glsl?v=r7-3-quick-preview-fill-v3al-c1c2-fps1';

    sceneIsDynamic = false;
    cameraFlightSpeed = 3;
    pixelRatio = 1.0;
    EPS_intersect = 0.001;

    worldCamera.fov = 55;
    focusDistance = 4.0;
    apertureChangeSpeed = 200;

    // 預設載入 Cam 1 位置（從 CAMERA_PRESETS 讀取）
    var initCam = CAMERA_PRESETS.cam1;
    cameraControlsObject.position.set(initCam.position.x, initCam.position.y, initCam.position.z);
    cameraControlsPitchObject.rotation.set(initCam.pitch, 0, 0);
    cameraControlsYawObject.rotation.set(0, initCam.yaw, 0);
    inputRotationHorizontal = initCam.yaw;
    inputRotationVertical = initCam.pitch;
    oldYawRotation = initCam.yaw;
    oldPitchRotation = initCam.pitch;

    var keys = {};
    window.addEventListener('keydown', function (e) { keys[e.code] = true; });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });

    document.addEventListener('mousedown', function (e) {
        if (e.button === 0 && e.target.tagName !== 'IFRAME') {
            if (document.pointerLockElement) {
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

    // === BVH Build（R2-8：含吸音板，預設 Config 1）===
    applyPanelConfig(1);

    // 6) 旋轉物件逆矩陣 uniforms
    for (var ri = 0; ri < rotatedObjects.length; ri++) {
        pathTracingUniforms[rotatedObjects[ri].name] = { value: new THREE.Matrix4().copy(rotatedMeshes[ri].matrixWorld).invert() };
    }

    // 7) 載入窗外景色貼圖（本地 1323×690，使用者手工裁切）
    const winTexLoader = new THREE.TextureLoader();
    winTexLoader.load('textures/window_scene.png', function (tex) {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.flipY = true;
        pathTracingUniforms.uWinTex = { value: tex };
        cameraIsMoving = true;
    });
    // 預設 1x1 白色貼圖，貼圖載入前不會黑屏
    pathTracingUniforms.uWinTex = { value: new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat) };

    // 8) KH150 喇叭正面/背面貼圖
    // 黑底 + 從中心放大 4%，裁掉產品照白色角落
    var defaultTex = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);
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
    spkF.onload = function () {
        pathTracingUniforms.u150F.value = prepSpeakerTex(spkF);
        cameraIsMoving = true;
    };
    spkF.src = 'textures/kh150_front.jpg';

    var spkB = new Image();
    spkB.onload = function () {
        pathTracingUniforms.u150B.value = prepSpeakerTex(spkB);
        cameraIsMoving = true;
    };
    spkB.src = 'textures/kh150_back.jpg';

    // 8b) KH750 超低音正面/背面貼圖（已手動裁切白邊，黑底放大 4% 裁白角，比照 KH150）
    pathTracingUniforms.u750F = { value: defaultTex };
    pathTracingUniforms.u750B = { value: defaultTex };

    var sub750F = new Image();
    sub750F.onload = function () {
        pathTracingUniforms.u750F.value = prepSpeakerTex(sub750F);
        cameraIsMoving = true;
    };
    sub750F.src = 'textures/kh750_front.jpg';

    var sub750B = new Image();
    sub750B.onload = function () {
        pathTracingUniforms.u750B.value = prepSpeakerTex(sub750B);
        cameraIsMoving = true;
    };
    sub750B.src = 'textures/kh750_back.jpg';

    // 9) 木門 / 鐵門貼圖（本地檔案，Image + CanvasTexture 載入）
    var defaultDoorTex = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, THREE.RGBAFormat);
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
    woodDoorImg.onload = function () {
        pathTracingUniforms.uWoodDoorTex.value = prepDoorTex(woodDoorImg);
        cameraIsMoving = true;
    };
    woodDoorImg.src = 'textures/wood_door.jpeg';

    var ironDoorImg = new Image();
    ironDoorImg.onload = function () {
        pathTracingUniforms.uIronDoorTex.value = prepDoorTex(ironDoorImg);
        cameraIsMoving = true;
    };
    ironDoorImg.src = 'textures/iron_door.jpg';

    // 10) GIK 吸音板貼圖
    pathTracingUniforms.uGikGrayTex = { value: defaultDoorTex };
    pathTracingUniforms.uGikWhiteTex = { value: defaultDoorTex };

    var gikGrayImg = new Image();
    gikGrayImg.onload = function () {
        pathTracingUniforms.uGikGrayTex.value = prepDoorTex(gikGrayImg);
        cameraIsMoving = true;
    };
    gikGrayImg.src = 'textures/gik244_grey.jpeg';

    var gikWhiteImg = new Image();
    gikWhiteImg.onload = function () {
        pathTracingUniforms.uGikWhiteTex.value = prepDoorTex(gikWhiteImg);
        cameraIsMoving = true;
    };
    gikWhiteImg.src = 'textures/gik244_white.jpeg';

    // 11) ISO-PUCK MINI 世界座標（8 顆，每側 4 顆）
    var puckRadius = 0.022;   // 直徑 4.4cm
    var puckHalfH = 0.012;    // 高度 2.4cm
    var puckXOff = 0.10 - puckRadius;   // 0.078，圓週切齊頂板邊長
    var puckZOff = 0.125 - puckRadius;  // 0.103
    var puckYLocal = 0.01 + puckHalfH;  // 頂板表面上方的 puck 中心 Y
    var puckLocalOffsets = [
        new THREE.Vector3(-puckXOff, puckYLocal, -puckZOff),
        new THREE.Vector3(-puckXOff, puckYLocal, puckZOff),
        new THREE.Vector3(puckXOff, puckYLocal, -puckZOff),
        new THREE.Vector3(puckXOff, puckYLocal, puckZOff)
    ];
    var puckPositions = [];
    // index 3 = 左頂板, index 7 = 右頂板
    [3, 7].forEach(function (topIdx) {
        var mat = rotatedMeshes[topIdx].matrixWorld;
        puckLocalOffsets.forEach(function (off) {
            var p = off.clone().applyMatrix4(mat);
            puckPositions.push(p);
        });
    });
    pathTracingUniforms.uPuckPositions = { value: puckPositions };
    pathTracingUniforms.uPuckRadius = { value: puckRadius };
    pathTracingUniforms.uPuckHalfH = { value: puckHalfH };

    // R2-11 中央吸頂燈（圓柱燈體 + 底面發光 quad）；R2-16 起位置隨 uCloudPanelEnabled 聯動
    // Cloud ON → z=-1.5（跨過 R2-15 北軌道 z≈-1.1 之更北側，距北軌道 14.8cm、距北牆 13.9cm；非真實安裝位置，純示意有燈亮）
    // Cloud OFF → z=0.591（原房間中央）
    pathTracingUniforms.uCeilingLampPos = { value: new THREE.Vector3(0, 2.855, 0.591) };
    pathTracingUniforms.uCeilingLampRadius = { value: 0.235 };
    pathTracingUniforms.uCeilingLampHalfH = { value: 0.02 };
    // uLightEmission 初始值（4000K × 800 × 0.05764），每幀由 updateVariablesAndUniforms 更新
    pathTracingUniforms.uLightEmission = { value: new THREE.Vector3(8.0, 7.6, 6.4) };

    // R2-13 X-ray 透視剝離：primary ray 自動隱藏相機同側牆系物件
    pathTracingUniforms.uCamPos = { value: new THREE.Vector3(0, 0, 0) };
    pathTracingUniforms.uRoomMin = { value: new THREE.Vector3(-1.91, 0.0, -1.874) };
    pathTracingUniforms.uRoomMax = { value: new THREE.Vector3(1.91, 2.905, 3.056) };
    pathTracingUniforms.uCullThreshold = { value: 0.30 };
    pathTracingUniforms.uCullEpsilon = { value: 0.01 };
    pathTracingUniforms.uXrayEnabled = { value: 1.0 };

    // R2-14 東西投射燈軌道（fixtureGroup=1）開關；fix24：預設關，僅 Config 3（Cloud）時開
    pathTracingUniforms.uTrackLightEnabled = { value: 0.0 };

    // R2-15 南北廣角燈軌道（fixtureGroup=2）開關；fix24：預設關，僅 Config 3 時開
    pathTracingUniforms.uWideTrackLightEnabled = { value: 0.0 };

    // R2-16 Cloud 吸音板（fixtureGroup=3）開關；fix21：預設關，吸頂燈留房間中央 z=0.591
    pathTracingUniforms.uCloudPanelEnabled = { value: 0.0 };

    // R2-17 Cloud 漫射燈條（fixtureGroup=4）開關；fix21：預設關且與 Cloud 吸音板綁定（燈條不能懸空於無板狀態）
    pathTracingUniforms.uCloudLightEnabled = { value: 0.0 };

    // R2-18 全域 roughness / metalness multiplier；GUI 於 Step 6 接入，Step 1 僅宣告 uniform 保留默認 1.0
    // R2-18 Step 6 per-class scale：金屬三類分離（C_STAND_PILLAR 預設霧面化 1.2 / 0.65）
    pathTracingUniforms.uIronDoorRoughnessScale = { value: 0.25 };
    pathTracingUniforms.uIronDoorMetalnessScale = { value: 0.85 };
    pathTracingUniforms.uStandRoughnessScale = { value: 1.3 };
    pathTracingUniforms.uStandMetalnessScale = { value: 0.5 };
    pathTracingUniforms.uStandPillarRoughnessScale = { value: 1.2 };
    pathTracingUniforms.uStandPillarMetalnessScale = { value: 0.65 };

    // R2-18 Phase 2：軌道+燈具本體束包（TRACK 軌道 + LAMP_SHELL 吸頂燈殼 + CLOUD_LIGHT 燈條 + 投射/廣角燈頭）
    pathTracingUniforms.uFixtureRoughness = { value: 0.5 };
    pathTracingUniforms.uFixtureMetalness = { value: 0.2 };

    // R2-18 fix17：地板霧面磁磚（dielectric Fresnel F0=0.04 + roughness blur）；fix18 預設 0.1 肉眼校準
    pathTracingUniforms.uFloorRoughness = { value: 0.1 };

    // R2-18 fix19 / R3-7：間接光補償（erichlof 框架 diffuseCount==1 單掛旗 → 2-diffuse-bounce 截斷）
    // 本係數補償第 3 次以後永遠不再累加的間接反彈能量；非臨時值。提 max_bounces 4→8 肉眼無差（R3-7 驗）。
    // 詳見 docs/SOP/Debug_Log.md「Phase 2 漫射能量 2-bounce truncation 說明」章節。
    pathTracingUniforms.uIndirectMultiplier = { value: 1.0 };

    // R6 LGG-r16 J3：B 模借光強度——主 pass 在 terminal 從 1/8 res 14 彈 buffer 取色
    // 0 = 關（不跑借光 pass，零成本）；A 模強制 0；走 path tracer 重啟
    pathTracingUniforms.uBorrowStrength = { value: 0.0 };
    // R6 LGG-r16 J3：1=當前 frame 是借光 pass、shader 跳過借光採樣避免遞迴；主 pass 為 0
    pathTracingUniforms.uIsBorrowPass = { value: 0.0 };
    pathTracingUniforms.uR73QuickPreviewTerminalMode = { value: 0.0 };
    pathTracingUniforms.uR73QuickPreviewTerminalStrength = { value: 0.0 };
    pathTracingUniforms.uR73GikWallProbeMode = { value: 0 };

    // R3-0 / R3-7：NEE 直接光補償（shader 10 處 `mask *= weight * uLegacyGain`）。
    // 同屬 erichlof 框架能量校準係數，R2-18 肉眼定案 1.5；與 uIndirectMultiplier 同為框架補償性質非物理值。
    pathTracingUniforms.uLegacyGain = { value: 1.0 };


    // ---- R3-1 emission pipeline（R3-3 起 Cloud 接通 emissive Lambertian）----
    pathTracingUniforms.uCloudEmission      = { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
    pathTracingUniforms.uTrackEmission      = { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
    pathTracingUniforms.uTrackWideEmission  = { value: [new THREE.Vector3(), new THREE.Vector3()] };
    pathTracingUniforms.uR3EmissionGate     = { value: 1.0 };   // R3-3 S3b：Cloud emissive 開，Track / TrackWide 仍為 0 向量故不發光
    // R3-3 fix01：Cloud hitObjectID 基準 = objectCount(0) + CLOUD_BOX_IDX_BASE(71) + 1 = 72（見 shader L516）
    pathTracingUniforms.uCloudObjIdBase     = { value: CLOUD_BOX_IDX_BASE + 1 };
    // R6-3 Phase 1C：4 rod A_face [0]=E [1]=W [2]=S [3]=N；shader 端乘 π/2 得 A_arc。
    pathTracingUniforms.uCloudFaceArea      = { value: CLOUD_ROD_FACE_AREA.slice() };
    // R6-3 Phase 1C: Cloud analytic 1/4 arc geometry source
    pathTracingUniforms.uCloudRodCenter     = { value: CLOUD_ROD_CENTER.map(v => v.clone()) };
    pathTracingUniforms.uCloudRodHalfExtent = { value: CLOUD_ROD_HALF_EXTENT.map(v => v.clone()) };
    // R3-3 clamp: 預設 50（median×30 的保守估算；curtain-center 量測值落地後請重校）
    pathTracingUniforms.uEmissiveClamp      = { value: 50.0 };
    // R3-4：軌道投射燈 emitter meta（4 盞 hitType=TRACK_LIGHT 共用 uniform 索引）
    pathTracingUniforms.uTrackBeamCos       = { value: [
        new THREE.Vector2(TRACK_BEAM_COS_INNER, TRACK_BEAM_COS_OUTER),
        new THREE.Vector2(TRACK_BEAM_COS_INNER, TRACK_BEAM_COS_OUTER),
        new THREE.Vector2(TRACK_BEAM_COS_INNER, TRACK_BEAM_COS_OUTER),
        new THREE.Vector2(TRACK_BEAM_COS_INNER, TRACK_BEAM_COS_OUTER)
    ] };
    pathTracingUniforms.uTrackLampIdBase    = { value: TRACK_LAMP_ID_BASE };
    // R3-5a：軌道廣角燈 emitter meta（2 盞 hitType=TRACK_WIDE_LIGHT）
    pathTracingUniforms.uTrackWideBeamCos   = { value: [
        new THREE.Vector2(TRACK_WIDE_BEAM_COS_INNER, TRACK_WIDE_BEAM_COS_OUTER),
        new THREE.Vector2(TRACK_WIDE_BEAM_COS_INNER, TRACK_WIDE_BEAM_COS_OUTER)
    ] };
    pathTracingUniforms.uTrackWideLampIdBase = { value: TRACK_WIDE_LAMP_ID_BASE };

    // R2-14 fix02：4 盞圓柱燈頭靜態 uniforms（R3/R4 階段改為 UI 動態更新）
    // pivot = 支架底（y_pivot = trackBaseY - 0.076 = 2.819）；tilt=45° 由軌道中心朝外傾
    // 順序 NW, NE, SW, SE；NW/NE 對正北側牆吸音板 E1/W1，SW/SE 對正南側 E3/W3
    // 傾斜向量 dir = (signX * sin(45°), -cos(45°), 0)，signX=-1 為 W 軌、+1 為 E 軌
    var _lampSin = Math.sin(Math.PI / 4);
    var _lampCos = Math.cos(Math.PI / 4);
    pathTracingUniforms.uTrackLampPos = { value: [
        new THREE.Vector3(-0.95, 2.819, -0.252), // NW
        new THREE.Vector3( 0.95, 2.819, -0.252), // NE
        new THREE.Vector3(-0.95, 2.819,  1.248), // SW
        new THREE.Vector3( 0.95, 2.819,  1.248)  // SE
    ] };
    pathTracingUniforms.uTrackLampDir = { value: [
        new THREE.Vector3(-_lampSin, -_lampCos, 0), // NW: 向西外傾
        new THREE.Vector3( _lampSin, -_lampCos, 0), // NE: 向東外傾
        new THREE.Vector3(-_lampSin, -_lampCos, 0), // SW
        new THREE.Vector3( _lampSin, -_lampCos, 0)  // SE
    ] };

    // R2-15 廣角燈頭（2 盞矮胖圓柱，半徑 5cm、長 7.2cm）
    // pivot = 支架底 y=2.845；形狀撈自舊專案 Path Tracking 260412a 5.4 Clarity.html
    // R4-4-fix04 甜蜜點：tilt 南 +30°（朝南外傾避 Cam3 高光點）、北 -30°（朝北外傾對稱）
    // 距 Cloud 邊距 0.20 m → 南軌 z=1.898、北軌 z=-0.902
    var _wideSinS = Math.sin( 30 * Math.PI / 180);
    var _wideCosS = Math.cos( 30 * Math.PI / 180);
    var _wideSinN = Math.sin(-30 * Math.PI / 180);
    var _wideCosN = Math.cos(-30 * Math.PI / 180);
    pathTracingUniforms.uTrackWideLampPos = { value: [
        new THREE.Vector3(0.0, 2.845,  1.898), // 南 (1.698 + 0.20)
        new THREE.Vector3(0.0, 2.845, -0.902)  // 北 (-0.702 - 0.20)
    ] };
    pathTracingUniforms.uTrackWideLampDir = { value: [
        new THREE.Vector3(0, -_wideCosS,  _wideSinS), // 南燈 0° 垂直朝下
        new THREE.Vector3(0, -_wideCosN,  _wideSinN)  // 北燈 -30° 朝北打
    ] };

    // R3-6.5 Dynamic Light Pool uniforms
    pathTracingUniforms.uActiveLightCount = { value: 1 };
    pathTracingUniforms.uActiveLightIndex = { value: new Int32Array(ACTIVE_LIGHT_POOL_MAX).fill(ACTIVE_LIGHT_LUT_SENTINEL), type: 'iv' };
    pathTracingUniforms.uActiveLightIndex.value[0] = 0; // CONFIG 1 ceiling 獨佔
    pathTracingUniforms.uActiveLightPickPdf = { value: new Float32Array(ACTIVE_LIGHT_POOL_MAX) };
    pathTracingUniforms.uActiveLightPickCdf = { value: new Float32Array(ACTIVE_LIGHT_POOL_MAX) };
    pathTracingUniforms.uActiveLightPickPdf.value[0] = 1.0;
    pathTracingUniforms.uActiveLightPickCdf.value[0] = 1.0;
    pathTracingUniforms.uR72LightImportanceSamplingMode = { value: r72LightImportanceSamplingEnabled ? 1.0 : 0.0 };

    pathTracingUniforms.uR3ProbeSentinel = { value: 1.0 }; // R3-6.5 S2.5 DCE debug-only sentinel（正常恆為 1.0；手動改 -200 觸發 DCE guard 活體驗證）
    pathTracingUniforms.uCloudVisibilityProbeMode = { value: 0 };
    pathTracingUniforms.uCloudVisibilityProbeRod = { value: -1 };
    pathTracingUniforms.uCloudVisibilityProbeClass = { value: -1 };
    pathTracingUniforms.uCloudVisibilityProbeThetaBin = { value: -1 };
    pathTracingUniforms.uCloudVisibilityProbeThetaBinCount = { value: CLOUD_VISIBILITY_PROBE_THETA_BIN_COUNT_DEFAULT };
    pathTracingUniforms.uCloudThetaImportanceShaderABMode = { value: 0 };
    pathTracingUniforms.uCloudMisWeightProbeMode = { value: 0 };
    pathTracingUniforms.uCloudContributionProbeMode = { value: 0 };
    pathTracingUniforms.uCloudDarkSurfaceCleanupMode = { value: 0 };
    pathTracingUniforms.uCloudDarkSurfaceCleanupLuma = { value: 1.0 };
    pathTracingUniforms.uCloudSameSurfaceDarkFillMode = { value: 0 };
    pathTracingUniforms.uCloudSameSurfaceDarkFillStrength = { value: CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_STRENGTH };
    pathTracingUniforms.uCloudSameSurfaceDarkFillMaxSamples = { value: CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_MAX_SAMPLES };
    pathTracingUniforms.uCloudSameSurfaceDarkFillFloorLuma = { value: CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_FLOOR_LUMA };
    pathTracingUniforms.uCloudSameSurfaceDarkFillGikLuma = { value: CLOUD_SAME_SURFACE_DARK_FILL_DEFAULT_GIK_LUMA };

    // R3-6.5 throw-first assertion：LUT 型別 / 長度
    if (!(pathTracingUniforms.uActiveLightIndex.value instanceof Int32Array) ||
        pathTracingUniforms.uActiveLightIndex.value.length !== ACTIVE_LIGHT_POOL_MAX) {
        throw new Error('[R3-6.5] uActiveLightIndex 型別 / 長度錯誤');
    }

    computeLightEmissions();
    rebuildActiveLightLUT('init');



    // R4-1：initUI replaces setupGUI (lil-gui removed; HTML panel system)
    initUI();
}


function computeLightEmissions() {
    // R3-4：throw-first assertion 兩層守門（uniform 存在 + 值比對），避免 short-circuit 靜默通過 R3-3 CLOUD_BOX_IDX_BASE 同型陷阱
    if (!pathTracingUniforms.uTrackLampIdBase) {
        throw new Error('[R3-4] uTrackLampIdBase uniform missing — computeLightEmissions called before initSceneData uniform setup');
    }
    if (pathTracingUniforms.uTrackLampIdBase.value !== TRACK_LAMP_ID_BASE) {
        throw new Error(
            '[R3-4] shader/JS TRACK_LAMP_ID_BASE mismatch: ' +
            pathTracingUniforms.uTrackLampIdBase.value + ' vs ' + TRACK_LAMP_ID_BASE
        );
    }
    // R3-5a：同型守門
    if (!pathTracingUniforms.uTrackWideLampIdBase) {
        throw new Error('[R3-5a] uTrackWideLampIdBase uniform missing — computeLightEmissions called before initSceneData uniform setup');
    }
    if (pathTracingUniforms.uTrackWideLampIdBase.value !== TRACK_WIDE_LAMP_ID_BASE) {
        throw new Error(
            '[R3-5a] shader/JS TRACK_WIDE_LAMP_ID_BASE mismatch: ' +
            pathTracingUniforms.uTrackWideLampIdBase.value + ' vs ' + TRACK_WIDE_LAMP_ID_BASE
        );
    }
    if (!Array.isArray(pathTracingUniforms.uCloudRodCenter.value) || pathTracingUniforms.uCloudRodCenter.value.length !== 4) {
        throw new Error('[R6-3 Phase 1C] uCloudRodCenter must be 4-element Vector3 array');
    }
    if (!Array.isArray(pathTracingUniforms.uCloudRodHalfExtent.value) || pathTracingUniforms.uCloudRodHalfExtent.value.length !== 4) {
        throw new Error('[R6-3 Phase 1C] uCloudRodHalfExtent must be 4-element Vector3 array');
    }

    // R6-3 Phase 1C：Cloud rod Lambertian 1/4 arc emitter。kelvinToRGB 回傳 sRGB，pow(,2.2) 轉 linear 給 path tracer。
    const cloudSrgb = kelvinToRGB(cloudKelvin);
    const cloudRLin = Math.pow(cloudSrgb.r, 2.2);
    const cloudGLin = Math.pow(cloudSrgb.g, 2.2);
    const cloudBLin = Math.pow(cloudSrgb.b, 2.2);
    for (let i = 0; i < 4; i++) {
        const radiance = computeCloudRadiance(CLOUD_ROD_LUMENS[i], cloudKelvin, CLOUD_ROD_FACE_AREA[i]);
        pathTracingUniforms.uCloudEmission.value[i].set(radiance * cloudRLin, radiance * cloudGLin, radiance * cloudBLin);
    }

    // R3-4：軌道投射燈 emitter radiance（per-lamp 色溫 + 共用 lumens / area / beam）
    const trackRadianceDebug = [];
    for (let i = 0; i < 4; i++) {
        const trackSrgb = kelvinToRGB(trackKelvin[i]);
        const trackRLin = Math.pow(trackSrgb.r, 2.2);
        const trackGLin = Math.pow(trackSrgb.g, 2.2);
        const trackBLin = Math.pow(trackSrgb.b, 2.2);
        // R4-4：beamFullDeg 從硬編 TRACK_BEAM_FULL_DEG 改為動態 trackBeamOuter（滑桿可變）
        const radiance = computeTrackRadiance(
            trackLumens,
            trackKelvin[i],
            TRACK_LAMP_EMITTER_AREA,
            trackBeamOuter
        );
        pathTracingUniforms.uTrackEmission.value[i].set(
            radiance * trackRLin,
            radiance * trackGLin,
            radiance * trackBLin
        );
        // R4-4：beam cos 由 trackBeamInner / trackBeamOuter（全角 deg）即時算，取代 R3-4 靜態 const
        const trackCosInner = Math.cos((trackBeamInner * 0.5) * Math.PI / 180);
        const trackCosOuter = Math.cos((trackBeamOuter * 0.5) * Math.PI / 180);
        pathTracingUniforms.uTrackBeamCos.value[i].set(trackCosInner, trackCosOuter);
        trackRadianceDebug.push({ r: +(radiance * trackRLin).toFixed(4), g: +(radiance * trackGLin).toFixed(4), b: +(radiance * trackBLin).toFixed(4) });
    }

    // R3-5a：TrackWide 廣角燈 emitter radiance（per-lamp 色溫 + 共用 lumens / area）
    // trackWideKelvin[0]=南、[1]=北；與 uTrackWideLampPos 順序一致
    const trackWideRadianceDebug = [];
    for (let i = 0; i < 2; i++) {
        const wideSrgb = kelvinToRGB(trackWideKelvin[i]);
        const wideRLin = Math.pow(wideSrgb.r, 2.2);
        const wideGLin = Math.pow(wideSrgb.g, 2.2);
        const wideBLin = Math.pow(wideSrgb.b, 2.2);
        // R4-4：廣角燈無變焦（廠商規格書僅 120° 固定），computeTrackWideRadiance 保留 L=Φ/(K·π·A) 量綱；
        // beamFullDeg 仍傳靜態 TRACK_WIDE_BEAM_FULL_DEG（120°）維持簽名相容。
        const radiance = computeTrackWideRadiance(
            trackWideLumens,
            trackWideKelvin[i],
            TRACK_WIDE_LAMP_EMITTER_AREA,
            TRACK_WIDE_BEAM_FULL_DEG
        );
        pathTracingUniforms.uTrackWideEmission.value[i].set(
            radiance * wideRLin,
            radiance * wideGLin,
            radiance * wideBLin
        );
        // R4-4：廣角 cos 由 trackWideBeamInner / trackWideBeamOuter 即時算（僅影響邊緣 smoothstep 柔和度，不改中心亮度）
        const wideCosInner = Math.cos((trackWideBeamInner * 0.5) * Math.PI / 180);
        const wideCosOuter = Math.cos((trackWideBeamOuter * 0.5) * Math.PI / 180);
        pathTracingUniforms.uTrackWideBeamCos.value[i].set(wideCosInner, wideCosOuter);
        trackWideRadianceDebug.push({ r: +(radiance * wideRLin).toFixed(4), g: +(radiance * wideGLin).toFixed(4), b: +(radiance * wideBLin).toFixed(4) });
    }

    // 末段 NaN/Inf 守門（uTrackEmission 四盞 + uTrackWideEmission 兩盞）
    for (let i = 0; i < 4; i++) {
        const v = pathTracingUniforms.uTrackEmission.value[i];
        if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
            throw new Error('[R3-4] uTrackEmission[' + i + '] NaN/Inf: ' + v.x + ',' + v.y + ',' + v.z);
        }
    }
    for (let i = 0; i < 2; i++) {
        const v = pathTracingUniforms.uTrackWideEmission.value[i];
        if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
            throw new Error('[R3-5a] uTrackWideEmission[' + i + '] NaN/Inf: ' + v.x + ',' + v.y + ',' + v.z);
        }
    }

    console.log('[R3-5b]', {
        cloudMode: cloudColorMode,
        cloudKelvin: cloudKelvin,
        cloudRadiance: pathTracingUniforms.uCloudEmission.value.map(v => ({ r: +v.x.toFixed(4), g: +v.y.toFixed(4), b: +v.z.toFixed(4) })),
        cloudObjIdBase: pathTracingUniforms.uCloudObjIdBase.value,
        cloudArcAreaScale: +CLOUD_ARC_AREA_SCALE.toFixed(6),
        neePoolSize: 11,
        selectPdf: (1/11).toFixed(4),
        cloudRodCenter: CLOUD_ROD_CENTER.map(v => ({ x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) })),
        cloudRodHalfExtent: CLOUD_ROD_HALF_EXTENT.map(v => ({ x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) })),
        trackMode: trackColorMode,
        trackKelvin: trackKelvin.slice(),
        trackLumens: trackLumens,
        trackBeamInner: trackBeamInner,      // R4-4：動態全角（內）
        trackBeamOuter: trackBeamOuter,      // R4-4：動態全角（外，入 trackLampCandela）
        trackCandelaCenter: +trackLampCandela(trackLumens, trackBeamOuter).toFixed(1),  // R4-4 I5 監控
        trackRadiance: trackRadianceDebug,
        trackLampIdBase: pathTracingUniforms.uTrackLampIdBase.value,
        trackWideKelvin: trackWideKelvin.slice(),
        trackWideLumens: trackWideLumens,
        trackWideBeamInner: trackWideBeamInner,   // R4-4：動態全角（內）
        trackWideBeamOuter: trackWideBeamOuter,   // R4-4：動態全角（外，廠商 120° 固定）
        trackWideRadiance: trackWideRadianceDebug,
        trackWideLampIdBase: pathTracingUniforms.uTrackWideLampIdBase.value,
    });
}

// R3-6.5 S3：Dynamic light pool LUT 重建（full logic）。config 1/2 → ceiling-only；config 3 → track/wide/cloud checkbox-gated slots。
// LUT-first write order：先 fill LUT[0..10]，最後才單次寫 uActiveLightCount.value。
// computeLightEmissions 不觸發 rebuild（只改 emission 量級不改 pool 成員）；若未來加入 0-emission=off 邏輯，此註解需更新並補呼叫。
function rebuildActiveLightLUT(source) {
    // uniforms 尚未宣告（applyPanelConfig 在 initSceneData 中段被提前呼叫）→ 靜默略過，init 路徑會補呼叫
    if (!pathTracingUniforms || !pathTracingUniforms.uActiveLightIndex) return;

    const lut = pathTracingUniforms.uActiveLightIndex.value;
    lut.fill(ACTIVE_LIGHT_LUT_SENTINEL);
    let count = 0;

    const config = (typeof currentPanelConfig !== 'undefined') ? currentPanelConfig : 1;
    const trackOn = !!(pathTracingUniforms.uTrackLightEnabled && pathTracingUniforms.uTrackLightEnabled.value > 0.5);
    const wideOn = !!(pathTracingUniforms.uWideTrackLightEnabled && pathTracingUniforms.uWideTrackLightEnabled.value > 0.5);
    const cloudOn = !!(pathTracingUniforms.uCloudLightEnabled && pathTracingUniforms.uCloudLightEnabled.value > 0.5);

    if (config === 1 || config === 2) {
        // ceiling-only panel setups；track/wide/cloud checkbox 於 CONFIG 1/2 不納入 pool（由 CONFIG 3 統一接管）
        lut[count++] = 0;
    } else if (config === 3 || config === 4) {
        // CONFIG 3（只 Cloud）/ 4（只 軌道+廣角）：ceiling 撤場，依 checkbox gate 動態加入 slots
        // applyPanelConfig 會依 config 預設 checkbox（3→只 Cloud 勾；4→只 軌道+廣角 勾）
        if (trackOn) { lut[count++] = 1; lut[count++] = 2; lut[count++] = 3; lut[count++] = 4; }
        var wideSouthChk = document.getElementById('chkTrackWideSouth');
        var wideNorthChk = document.getElementById('chkTrackWideNorth');
        if (wideSouthChk && wideSouthChk.checked) { lut[count++] = 5; }
        if (wideNorthChk && wideNorthChk.checked) { lut[count++] = 6; }
        if (cloudOn) { lut[count++] = 7; lut[count++] = 8; lut[count++] = 9; lut[count++] = 10; }
    }

    writeActiveLightSamplingPdfAndCdf(count, lut);
    pathTracingUniforms.uActiveLightCount.value = count;
    if (pathTracingUniforms.uR72LightImportanceSamplingMode) {
        pathTracingUniforms.uR72LightImportanceSamplingMode.value = r72LightImportanceSamplingEnabled ? 1.0 : 0.0;
    }

    if (typeof invalidateMovementProtectionStableFrame === 'function') {
        invalidateMovementProtectionStableFrame('rebuildActiveLightLUT');
    }
    needClearAccumulation = true;
    cameraIsMoving = true;
    cameraSwitchFrames = 3;

    console.log('[R3-6.5] active pool rebuild', {
        count,
        LUT: Array.from(lut),
        pickPdf: pathTracingUniforms.uActiveLightPickPdf ? Array.from(pathTracingUniforms.uActiveLightPickPdf.value).slice(0, count) : [],
        r72LightImportanceSamplingEnabled,
        source
    });
}

function syncWideEmissions() {
    if (!pathTracingUniforms || !pathTracingUniforms.uTrackWideEmission) return;
    computeLightEmissions();
    var s = document.getElementById('chkTrackWideSouth');
    var n = document.getElementById('chkTrackWideNorth');
    if (s && !s.checked) pathTracingUniforms.uTrackWideEmission.value[0].set(0, 0, 0);
    if (n && !n.checked) pathTracingUniforms.uTrackWideEmission.value[1].set(0, 0, 0);
}

// R4-1: createS slider factory (replaces lil-gui)
function createS(id, label, min, max, step, init, cb, reset) {
    if (reset === undefined) reset = true;
    var c = document.getElementById(id);
    if (!c) return;
    c.innerHTML = '<div class="control-row"><div class="label-group"><span class="label-text">' + label + '</span></div><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + init + '"><input type="number" step="' + step + '" value="' + init + '"></div>';
    var r = c.querySelector('input[type=range]'), n = c.querySelector('input[type=number]');
    var upd = function(v) { var pv = parseFloat(v); var res = cb(pv); if (res !== undefined) pv = res; r.value = pv; n.value = pv; if (reset) { cameraIsMoving = true; } };
    r.oninput = function(e) { upd(e.target.value); };
    n.onchange = function(e) { upd(e.target.value); };
    cb(init);
    c.addEventListener('mousedown', function(e) { if (e.button === 0 && (e.metaKey || e.ctrlKey)) { e.preventDefault(); upd(init); } });
}

// R4-1: DOM adapters (replace lil-gui .setValue/.getValue/.disable/.enable/.name/.updateDisplay)
function setSliderValue(sliderId, value) {
    var c = document.getElementById(sliderId);
    if (!c) return;
    var r = c.querySelector('input[type=range]'), n = c.querySelector('input[type=number]');
    if (r) r.value = value;
    if (n) n.value = value;
}
function getSliderValue(sliderId) {
    var c = document.getElementById(sliderId);
    if (!c) return 0;
    var r = c.querySelector('input[type=range]');
    return r ? parseFloat(r.value) : 0;
}
function setSliderEnabled(sliderId, enabled) {
    var c = document.getElementById(sliderId);
    if (!c) return;
    c.style.pointerEvents = enabled ? '' : 'none';
    c.style.opacity = enabled ? '' : '0.4';
}
function setSliderLabel(sliderId, label) {
    var c = document.getElementById(sliderId);
    if (!c) return;
    var t = c.querySelector('.label-text');
    if (t) t.textContent = label;
}
function setCheckboxChecked(checkboxId, checked) {
    var el = document.getElementById(checkboxId);
    if (el) el.checked = checked;
}

// 強制重啟累加（即使已進入 1000 SPP 休眠也能即時刷新）
// 使用 sceneParamsChanged 讓 animate() 開頭清除 cameraIsMoving 後仍能重新觸發 restart
function wakeRender() {
    sceneParamsChanged = true;
}

// R6 Route X：後製專用喚醒——不重置 path tracer 累積，只觸發一次 STEP 3 讓滑桿生效
// 用途：陰影補光三條滑桿（強度/軟膝/純白比例）等純後製操作
function wakePostProcess() {
    postProcessChanged = true;
}

// ---------------- R4-4 甜蜜點 UI recompute 輔助 ----------------
// 幾何常數（對齊 L150-167 addBox 初值，半寬 = FULL size / 2）
const R4_4_TRACK_BASE_HALF_X       = 0.0175;   // 軌道底座半寬 x（FULL=0.035）
const R4_4_TRACK_BASE_Y_MIN        = 2.885;    // 軌道底座 y 下緣（固定）
const R4_4_TRACK_BASE_Y_MAX        = 2.905;    // 軌道底座 y 上緣（固定）
const R4_4_TRACK_BASE_Z_MIN_OFFSET = -0.502;   // 軌道底座 z 範圍（相對 z=0）— 2m 軌道長度
const R4_4_TRACK_BASE_Z_MAX_OFFSET =  1.498;
const R4_4_TRACK_STAND_HALF_X      = 0.01;     // 支架半寬 x（FULL=0.02）
const R4_4_TRACK_STAND_HALF_Z      = 0.01;     // 支架半寬 z（FULL=0.02）
const R4_4_TRACK_STAND_Y_MIN       = 2.819;    // 支架 y 下緣（pivot）
const R4_4_TRACK_STAND_Y_MAX       = 2.884;    // 支架 y 上緣
const R4_4_TRACK_Z_MID             = 0.498;    // 軌道中心 z_mid（見 L150-153 底座 z 範圍 [-0.502, 1.498]）
const R4_4_WIDE_BASE_HALF_X        = 1.000;    // 廣角軌道半寬 x（FULL=2.0）
const R4_4_WIDE_BASE_HALF_Z        = 0.0175;   // 廣角軌道半寬 z（FULL=0.035）
const R4_4_WIDE_BASE_Y_MIN         = 2.885;
const R4_4_WIDE_BASE_Y_MAX         = 2.905;
const R4_4_WIDE_STAND_HALF_X       = 0.010;
const R4_4_WIDE_STAND_HALF_Z       = 0.010;
const R4_4_WIDE_STAND_Y_MIN        = 2.845;
const R4_4_WIDE_STAND_Y_MAX        = 2.885;
const R4_4_WIDE_Z_MID              = 0.500;    // 廣角軌道中心對稱軸 z_mid（南 +trackWideZ、北 -trackWideZ 時此為基準）

/**
 * R4-4：投射燈光束角 / 傾斜角 → uTrackLampDir + uTrackBeamCos（由 computeLightEmissions 承擔 cos）。
 * 僅更新 uniform，零 BVH / sceneBoxes 改動。tilt 以軌道中心為 pivot，signX= -1(W) / +1(E)。
 */
function recomputeTrackGeometry() {
    const s = Math.sin(trackTilt * Math.PI / 180);
    const c = Math.cos(trackTilt * Math.PI / 180);
    pathTracingUniforms.uTrackLampDir.value[0].set(-s, -c, 0); // NW 向西外傾
    pathTracingUniforms.uTrackLampDir.value[1].set( s, -c, 0); // NE 向東外傾
    pathTracingUniforms.uTrackLampDir.value[2].set(-s, -c, 0); // SW
    pathTracingUniforms.uTrackLampDir.value[3].set( s, -c, 0); // SE
    computeLightEmissions(); // 同步 uTrackBeamCos + uTrackEmission（反冪律變數含 beamOuter）
    console.log('[R4-4] uniform-only update trackGeometry', {
        trackTilt: trackTilt,
        trackBeamInner: trackBeamInner,
        trackBeamOuter: trackBeamOuter
    });
}

/**
 * R4-4：投射燈 N-S 間距 / 軌道 x 位置 → sceneBoxes 37..44 + uTrackLampPos。
 * 更新 sceneBoxes 後呼叫 updateBoxDataTexture()；BVH 重建由呼叫端依指針策略決定（拖動期不重建）。
 */
function recomputeTrackPositions() {
    // 護欄：防止未來新增幾何把索引推飄時誤改 Cloud 幾何（65-82）
    if (sceneBoxes[TRACK_BASE_IDX].fixtureGroup !== 1) {
        throw new Error('[R4-4] recomputeTrackPositions: TRACK_BASE_IDX drift, expected fg=1');
    }
    if (sceneBoxes[TRACK_STAND_IDX].fixtureGroup !== 1) {
        throw new Error('[R4-4] recomputeTrackPositions: TRACK_STAND_IDX drift, expected fg=1');
    }
    const d = trackSpacing / 200;           // cm → m 半距（spacing=150 → d=0.75）
    const z_mid = R4_4_TRACK_Z_MID;
    const z_N = z_mid - d;
    const z_S = z_mid + d;
    const x_W = -trackBaseX;
    const x_E =  trackBaseX;

    // 軌道底座 37..40：z 範圍固定（非對稱 -0.502..1.498），僅 x 隨 trackBaseX
    // 對位 L150-153：37 西北半 / 38 西南半 / 39 東北半 / 40 東南半
    const baseHX = R4_4_TRACK_BASE_HALF_X;
    const bases = [
        { x: x_W, zMin: z_mid, zMax: R4_4_TRACK_BASE_Z_MAX_OFFSET }, // 37 西軌底座北半
        { x: x_W, zMin: R4_4_TRACK_BASE_Z_MIN_OFFSET, zMax: z_mid }, // 38 西軌底座南半
        { x: x_E, zMin: z_mid, zMax: R4_4_TRACK_BASE_Z_MAX_OFFSET }, // 39 東軌底座北半
        { x: x_E, zMin: R4_4_TRACK_BASE_Z_MIN_OFFSET, zMax: z_mid }, // 40 東軌底座南半
    ];
    for (let i = 0; i < 4; i++) {
        const box = sceneBoxes[TRACK_BASE_IDX + i];
        box.min[0] = bases[i].x - baseHX; box.max[0] = bases[i].x + baseHX;
        box.min[1] = R4_4_TRACK_BASE_Y_MIN; box.max[1] = R4_4_TRACK_BASE_Y_MAX;
        box.min[2] = bases[i].zMin; box.max[2] = bases[i].zMax;
    }

    // 支架 41..44：NW / NE / SW / SE
    // 對位 L156-159：41 NW / 42 NE / 43 SW / 44 SE
    const standHX = R4_4_TRACK_STAND_HALF_X, standHZ = R4_4_TRACK_STAND_HALF_Z;
    const stands = [
        { x: x_W, z: z_N }, // 41 NW
        { x: x_E, z: z_N }, // 42 NE
        { x: x_W, z: z_S }, // 43 SW
        { x: x_E, z: z_S }, // 44 SE
    ];
    for (let i = 0; i < 4; i++) {
        const box = sceneBoxes[TRACK_STAND_IDX + i];
        box.min[0] = stands[i].x - standHX; box.max[0] = stands[i].x + standHX;
        box.min[1] = R4_4_TRACK_STAND_Y_MIN; box.max[1] = R4_4_TRACK_STAND_Y_MAX;
        box.min[2] = stands[i].z - standHZ; box.max[2] = stands[i].z + standHZ;
        // uTrackLampPos 四盞順序 NW / NE / SW / SE 對齊 L1123-1128
        pathTracingUniforms.uTrackLampPos.value[i].set(stands[i].x, R4_4_TRACK_STAND_Y_MIN, stands[i].z);
    }
    updateBoxDataTexture();
    console.log('[R4-4] uniform+sceneBoxes update trackPositions', {
        trackSpacing: trackSpacing,
        trackBaseX: trackBaseX
    });
}

/**
 * R4-4：廣角燈南北傾斜角 → uTrackWideLampDir + uTrackWideBeamCos（由 computeLightEmissions 承擔 cos）。
 * 廣角 beam 全角 120° 固定，反冪律不適用；僅更新 uniform。
 */
function recomputeWideGeometry() {
    const sS = Math.sin(trackWideTiltSouth * Math.PI / 180);
    const cS = Math.cos(trackWideTiltSouth * Math.PI / 180);
    const sN = Math.sin(trackWideTiltNorth * Math.PI / 180);
    const cN = Math.cos(trackWideTiltNorth * Math.PI / 180);
    pathTracingUniforms.uTrackWideLampDir.value[0].set(0, -cS,  sS); // 南燈 +朝南（Z 正向）
    pathTracingUniforms.uTrackWideLampDir.value[1].set(0, -cN,  sN); // 北燈 -朝北（Z 負向）
    computeLightEmissions(); // 同步 uTrackWideBeamCos + uTrackWideEmission
    console.log('[R4-4] uniform-only update wideGeometry', {
        trackWideTiltSouth: trackWideTiltSouth,
        trackWideTiltNorth: trackWideTiltNorth,
        trackWideBeamInner: trackWideBeamInner,
        trackWideBeamOuter: trackWideBeamOuter
    });
}

/**
 * R4-4：廣角燈「距 Cloud 邊距」→ sceneBoxes 45..48（= TRACK_WIDE_*_IDX + 0..1）+ uTrackWideLampPos。
 * 選項 C 語義（使用者原話「讓設計師或師傅現場施工時比較好抓距離」）：
 *   南軌 z = z_cloud_south + trackWideZ（Cloud 南邊緣 1.698 + v）
 *   北軌 z = z_cloud_north - trackWideZ（Cloud 北邊緣 -0.702 - v）
 * 範圍 v=0.05~1.15：v=0.40 預設對應 +2.098/-1.102；v=1.15 上界 → 北軌 z=-1.852 距北牆 22mm。
 */
function recomputeWidePositions() {
    // 護欄：防止未來新增幾何把索引推飄時誤改 Cloud 幾何（71-82）
    if (sceneBoxes[TRACK_WIDE_BASE_IDX].fixtureGroup !== 2) {
        throw new Error('[R4-4] recomputeWidePositions: TRACK_WIDE_BASE_IDX drift, expected fg=2');
    }
    if (sceneBoxes[TRACK_WIDE_STAND_IDX].fixtureGroup !== 2) {
        throw new Error('[R4-4] recomputeWidePositions: TRACK_WIDE_STAND_IDX drift, expected fg=2');
    }
    const z_cloud_south =  1.698;  // Cloud 南邊緣（sceneBoxes 52/53/54 bmax.z，見 L176-178）
    const z_cloud_north = -0.702;  // Cloud 北邊緣（sceneBoxes 49/50/51 bmin.z，見 L173-175）
    const z_S = z_cloud_south + trackWideZ;
    const z_N = z_cloud_north - trackWideZ;
    const baseHX = R4_4_WIDE_BASE_HALF_X, baseHZ = R4_4_WIDE_BASE_HALF_Z;
    const standHX = R4_4_WIDE_STAND_HALF_X, standHZ = R4_4_WIDE_STAND_HALF_Z;
    // 45 南軌、46 北軌、47 南支架、48 北支架（見 L164-167）
    const south = sceneBoxes[TRACK_WIDE_BASE_IDX + 0];
    south.min[0] = -baseHX; south.max[0] =  baseHX;
    south.min[1] = R4_4_WIDE_BASE_Y_MIN; south.max[1] = R4_4_WIDE_BASE_Y_MAX;
    south.min[2] = z_S - baseHZ; south.max[2] = z_S + baseHZ;
    const north = sceneBoxes[TRACK_WIDE_BASE_IDX + 1];
    north.min[0] = -baseHX; north.max[0] =  baseHX;
    north.min[1] = R4_4_WIDE_BASE_Y_MIN; north.max[1] = R4_4_WIDE_BASE_Y_MAX;
    north.min[2] = z_N - baseHZ; north.max[2] = z_N + baseHZ;
    const standS = sceneBoxes[TRACK_WIDE_STAND_IDX + 0];
    standS.min[0] = -standHX; standS.max[0] =  standHX;
    standS.min[1] = R4_4_WIDE_STAND_Y_MIN; standS.max[1] = R4_4_WIDE_STAND_Y_MAX;
    standS.min[2] = z_S - standHZ; standS.max[2] = z_S + standHZ;
    const standN = sceneBoxes[TRACK_WIDE_STAND_IDX + 1];
    standN.min[0] = -standHX; standN.max[0] =  standHX;
    standN.min[1] = R4_4_WIDE_STAND_Y_MIN; standN.max[1] = R4_4_WIDE_STAND_Y_MAX;
    standN.min[2] = z_N - standHZ; standN.max[2] = z_N + standHZ;
    // uTrackWideLampPos 順序 [0]=南 / [1]=北（對齊 L1204 uniform 定義；此處 Y=2.845 支架底 = stand min.y）
    pathTracingUniforms.uTrackWideLampPos.value[0].set(0.0, R4_4_WIDE_STAND_Y_MIN, z_S);
    pathTracingUniforms.uTrackWideLampPos.value[1].set(0.0, R4_4_WIDE_STAND_Y_MIN, z_N);
    updateBoxDataTexture();
    console.log('[R4-4] uniform+sceneBoxes update widePositions', {
        trackWideZ: trackWideZ,
        z_S: z_S,
        z_N: z_N
    });
}

// R4-4：BVH 指針按下鎖 + 指針放開 + 50 ms 尾端防抖策略
// 拖動期間：sceneBoxes 位置即時更新但 BVH 不重建（陰影暫時滯留 1 幀級）
// 放開瞬間：50 ms 防抖觸發 buildSceneBVH()，陰影對齊回正確位置
let r4_4_rebuildLock = false;
let r4_4_rebuildTimer = null;
function attachBVHPointerStrategy(sliderId) {
    const c = document.getElementById(sliderId);
    if (!c) return;
    const r = c.querySelector('input[type=range]');
    if (!r) return;
    r.addEventListener('pointerdown', function() {
        r4_4_rebuildLock = true;
    });
    const release = function() {
        r4_4_rebuildLock = false;
        if (r4_4_rebuildTimer) clearTimeout(r4_4_rebuildTimer);
        r4_4_rebuildTimer = setTimeout(function() {
            const t0 = performance.now();
            buildSceneBVH();
            const dt = performance.now() - t0;
            console.log('[R4-4] BVH rebuild ' + dt.toFixed(1) + 'ms (sliderId=' + sliderId + ')');
            wakeRender();
        }, 50);
    };
    r.addEventListener('pointerup', release);
    r.addEventListener('pointerleave', release); // 後備：指針被其他介面吞的保險
}
// ---------------- /R4-4 甜蜜點 UI recompute 輔助 ----------------

function initUI() {
    // Panel header toggle
    document.querySelectorAll('.panel-header').forEach(function(header) {
        header.addEventListener('click', function() {
            var content = header.nextElementSibling;
            if (content && content.classList.contains('panel-content')) {
                content.classList.toggle('collapsed');
            }
        });
    });

    // Click stopPropagation on ui-container (prevent pointer lock)
    var uiContainer = document.getElementById('ui-container');
    if (uiContainer) {
        uiContainer.addEventListener('click', function(e) { e.stopPropagation(); }, false);
        uiContainer.addEventListener('mouseenter', function() { ableToEngagePointerLock = false; }, false);
        uiContainer.addEventListener('mouseleave', function() { ableToEngagePointerLock = true; }, false);
    }

    // ⚙️ 光追設定
    createS('slider-pixel-res', '渲染解析度', 0.5, 2.0, 0.1, 0.5, function(v) {
        needChangePixelResolution = true;
        return v;
    }, false);

    createS('slider-bounces', '彈跳次數', 1, 14, 1, 14, function(v) {
        if (pathTracingUniforms && pathTracingUniforms.uMaxBounces) {
            pathTracingUniforms.uMaxBounces.value = v;
        }
        wakeRender();
        return v;
    });

    createS('slider-mult-a', '間接光補償', 0.1, 5.0, 0.1, 1.0, function(v) {
        if (btnA && btnA.classList.contains('glow-white') && pathTracingUniforms.uIndirectMultiplier) pathTracingUniforms.uIndirectMultiplier.value = v;
        wakeRender(); return v;
    });
    createS('slider-sat-a', '間接光飽和', 0.5, 2.0, 0.05, 1.0, function(v) {
        if (btnA && btnA.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uSaturation) screenOutputUniforms.uSaturation.value = v;
        wakePostProcess(); return v;
    }, false);
    createS('slider-mult-b', '間接光補償', 0.1, 5.0, 0.1, 2.5, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && pathTracingUniforms.uIndirectMultiplier) pathTracingUniforms.uIndirectMultiplier.value = v;
        wakeRender(); return v;
    });
    // R6 LGG-r16 J3：暗角借光——主 pass 在 terminal 從 1/8 res 14 彈 buffer 取「該像素的真實反彈光」
    // r21 雙重 gate 上線後上限提到 2.0：gate 會把亮面/AO 帶過濾掉，深暗角才需更高 strength 才達甜蜜點
    createS('slider-borrow-strength-b', '暗角借光', 0.0, 2.0, 0.05, 0.0, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && pathTracingUniforms.uBorrowStrength) pathTracingUniforms.uBorrowStrength.value = v;
        wakeRender(); return v;
    });
    createS('slider-sat-b', '間接光飽和', 0.5, 2.0, 0.05, 1.5, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uSaturation) screenOutputUniforms.uSaturation.value = v;
        wakePostProcess(); return v;
    }, false);
    // R6 Route X (LGG)：ACES（A/B 各一組）+ LGG 強度 + DaVinci 三段調色（B 專用）
    // reset=false：純後製、不該觸發 cameraIsMoving 重啟累積
    // ── A 模式 ACES 組 ──
    createS('slider-aces-strength-a', 'ACES%', 0.0, 1.0, 0.05, 0.20, function(v) {
        if (btnA && btnA.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uACESStrength) screenOutputUniforms.uACESStrength.value = v;
        wakePostProcess(); return v;
    }, false);
    // A 模式單一 SAT：同步寫入 uACESSatShadow / uACESSatMid / uACESSatHighlight 三個 uniform
    createS('slider-aces-sat-a', 'SAT', 0.0, 2.0, 0.05, 0.90, function(v) {
        if (btnA && btnA.classList.contains('glow-white') && screenOutputUniforms) {
            if (screenOutputUniforms.uACESSatShadow) screenOutputUniforms.uACESSatShadow.value = v;
            if (screenOutputUniforms.uACESSatMid) screenOutputUniforms.uACESSatMid.value = v;
            if (screenOutputUniforms.uACESSatHighlight) screenOutputUniforms.uACESSatHighlight.value = v;
        }
        wakePostProcess(); return v;
    }, false);
    // A 模式 EXP（pre-tonemap HDR 曝光，補償 ACES 帶來的亮度偏移）
    createS('slider-exp-a', 'EXP', 0.50, 1.50, 0.05, 0.90, function(v) {
        if (btnA && btnA.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uExposure) screenOutputUniforms.uExposure.value = v;
        wakePostProcess(); return v;
    }, false);
    // ── B 模式 ACES 組 ──
    createS('slider-aces-strength-b', 'ACES%', 0.0, 1.0, 0.05, 1.00, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uACESStrength) screenOutputUniforms.uACESStrength.value = v;
        wakePostProcess(); return v;
    }, false);
    // B 模式單一 SAT：同步寫入 uACESSatShadow / uACESSatMid / uACESSatHighlight 三個 uniform
    createS('slider-aces-sat-b', 'SAT', 0.0, 2.0, 0.05, 0.95, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms) {
            if (screenOutputUniforms.uACESSatShadow) screenOutputUniforms.uACESSatShadow.value = v;
            if (screenOutputUniforms.uACESSatMid) screenOutputUniforms.uACESSatMid.value = v;
            if (screenOutputUniforms.uACESSatHighlight) screenOutputUniforms.uACESSatHighlight.value = v;
        }
        wakePostProcess(); return v;
    }, false);
    // B 模式 EXP（pre-tonemap HDR 曝光，補償 ACES 帶來的亮度偏移）
    createS('slider-exp-b', 'EXP', 0.50, 1.50, 0.05, 0.50, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uExposure) screenOutputUniforms.uExposure.value = v;
        wakePostProcess(); return v;
    }, false);
    createS('slider-lgg-strength', 'LGG%', 0.0, 1.0, 0.05, 0.50, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uLGGStrength) screenOutputUniforms.uLGGStrength.value = v;
        wakePostProcess(); return v;
    }, false);
    createS('slider-lgg-lift', 'Lift', -0.30, 0.30, 0.01, 0.00, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uLGGLift) screenOutputUniforms.uLGGLift.value = v;
        wakePostProcess(); return v;
    }, false);
    createS('slider-lgg-gamma', 'Gamma', 0.50, 2.00, 0.05, 1.50, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uLGGGamma) screenOutputUniforms.uLGGGamma.value = v;
        wakePostProcess(); return v;
    }, false);
    createS('slider-lgg-gain', 'Gain', 0.50, 1.50, 0.01, 0.80, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uLGGGain) screenOutputUniforms.uLGGGain.value = v;
        wakePostProcess(); return v;
    }, false);
    // R6 LGG-r30：B 模 White Balance + Hue 後製（display-space 最末端、純後製、不重啟採樣）
    // WB = von Kries chromatic adaptation（D65 → 目標 illuminant ratio）
    // Hue = NTSC luma-preserving 色相環旋轉（紅→橘→黃→綠→青→藍→紫→紅）
    createS('slider-wb-b', 'WB 白平衡', -1.0, 1.0, 0.05, -0.2, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uWBB) screenOutputUniforms.uWBB.value = v;
        wakePostProcess(); return v;
    }, false);
    createS('slider-hue-b', 'Hue 色相°', -10, 10, 0.5, 1, function(v) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uHueB) screenOutputUniforms.uHueB.value = v;
        wakePostProcess(); return v;
    }, false);

    // ACES checkbox（A / B 各一個，互不影響、各自只在對應模式下寫入 uniform）
    var chkAcesA = document.getElementById('chkAces-a');
    if (chkAcesA) chkAcesA.onchange = function(e) {
        if (btnA && btnA.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uACESEnabled) {
            screenOutputUniforms.uACESEnabled.value = e.target.checked ? 1.0 : 0.0;
        }
        wakePostProcess();
    };
    var chkAcesB = document.getElementById('chkAces-b');
    if (chkAcesB) chkAcesB.onchange = function(e) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uACESEnabled) {
            screenOutputUniforms.uACESEnabled.value = e.target.checked ? 1.0 : 0.0;
        }
        wakePostProcess();
    };
    // LGG checkbox（B 模式專用，A 模式時 btnA 會強制 enabled = 0）
    var chkLgg = document.getElementById('chkLgg');
    if (chkLgg) chkLgg.onchange = function(e) {
        if (btnB && btnB.classList.contains('glow-white') && screenOutputUniforms && screenOutputUniforms.uLGGEnabled) {
            screenOutputUniforms.uLGGEnabled.value = e.target.checked ? 1.0 : 0.0;
        }
        wakePostProcess();
    };

    // A/B radio
    var btnA = document.getElementById('btnGroupA'), btnB = document.getElementById('btnGroupB');
    var ctrlA = document.getElementById('group-a-controls'), ctrlB = document.getElementById('group-b-controls');
    function applyWallAlbedo(v) {
        setSliderValue('slider-wall-albedo', v);
        wallAlbedo = v;
        var r = 1.0 * v, g = 0.984 * v, b = 0.949 * v;
        C_WALL[0] = r; C_WALL[1] = g; C_WALL[2] = b;
        C_WALL_L[0] = r; C_WALL_L[1] = g; C_WALL_L[2] = b;
        C_WALL_R[0] = r; C_WALL_R[1] = g; C_WALL_R[2] = b;
        C_WALL_S[0] = r; C_WALL_S[1] = g; C_WALL_S[2] = b;
        updateBoxDataTexture();
    }
    // R6 LGG-r30：暴露給 applyPanelConfig 跨閉包呼叫，用來 per-config 套用 wall-albedo
    window.applyWallAlbedo = applyWallAlbedo;
    if (btnA) btnA.onclick = function() {
        btnA.className = 'action-btn glow-white'; btnB.className = 'action-btn';
        if (ctrlA) ctrlA.style.display = 'block';
        if (ctrlB) ctrlB.style.display = 'none';
        setSliderValue('slider-bounces', 14);
        if (pathTracingUniforms && pathTracingUniforms.uMaxBounces) pathTracingUniforms.uMaxBounces.value = 14;
        if (pathTracingUniforms && pathTracingUniforms.uIndirectMultiplier) pathTracingUniforms.uIndirectMultiplier.value = getSliderValue('slider-mult-a');
        if (pathTracingUniforms && pathTracingUniforms.uBorrowStrength) pathTracingUniforms.uBorrowStrength.value = 0.0; // A 模 14 彈不需借光，強制 0（順便省下借光 pass 成本）
        if (screenOutputUniforms && screenOutputUniforms.uSaturation) screenOutputUniforms.uSaturation.value = getSliderValue('slider-sat-a');
        // A 模式（趨近真實）：ACES 由 chkAces-a + 4 條 -a 滑桿控制，LGG 仍強制關閉
        var chkAcesAEl = document.getElementById('chkAces-a');
        if (screenOutputUniforms && screenOutputUniforms.uACESEnabled) screenOutputUniforms.uACESEnabled.value = (chkAcesAEl && chkAcesAEl.checked) ? 1.0 : 0.0;
        if (screenOutputUniforms && screenOutputUniforms.uACESStrength) screenOutputUniforms.uACESStrength.value = getSliderValue('slider-aces-strength-a');
        // A 模式單一 SAT 同步寫 3 個 uniform；EXP 由 -a 滑桿讀
        var satAVal = getSliderValue('slider-aces-sat-a');
        if (screenOutputUniforms && screenOutputUniforms.uACESSatShadow) screenOutputUniforms.uACESSatShadow.value = satAVal;
        if (screenOutputUniforms && screenOutputUniforms.uACESSatMid) screenOutputUniforms.uACESSatMid.value = satAVal;
        if (screenOutputUniforms && screenOutputUniforms.uACESSatHighlight) screenOutputUniforms.uACESSatHighlight.value = satAVal;
        if (screenOutputUniforms && screenOutputUniforms.uExposure) screenOutputUniforms.uExposure.value = getSliderValue('slider-exp-a');
        if (screenOutputUniforms && screenOutputUniforms.uLGGEnabled) screenOutputUniforms.uLGGEnabled.value = 0.0;
        if (screenOutputUniforms && screenOutputUniforms.uLGGStrength) screenOutputUniforms.uLGGStrength.value = 0.0;
        if (screenOutputUniforms && screenOutputUniforms.uLGGLift) screenOutputUniforms.uLGGLift.value = 0.0;
        if (screenOutputUniforms && screenOutputUniforms.uLGGGamma) screenOutputUniforms.uLGGGamma.value = 1.0;
        if (screenOutputUniforms && screenOutputUniforms.uLGGGain) screenOutputUniforms.uLGGGain.value = 1.0;
        // A 模式（趨近真實）：WB / Hue 強制中性，跟 LGG / 借光同邏輯
        if (screenOutputUniforms && screenOutputUniforms.uWBB) screenOutputUniforms.uWBB.value = 0.0;
        if (screenOutputUniforms && screenOutputUniforms.uHueB) screenOutputUniforms.uHueB.value = 0.0;
        setSliderValue('slider-pixel-res', 1.0);
        needChangePixelResolution = true;
        applyWallAlbedo(getSliderValue('slider-wall-albedo'));
        wakeRender();
    };
    if (btnB) btnB.onclick = function() {
        btnB.className = 'action-btn glow-white'; btnA.className = 'action-btn';
        if (ctrlB) ctrlB.style.display = 'block';
        if (ctrlA) ctrlA.style.display = 'none';
        setSliderValue('slider-bounces', 4);
        if (pathTracingUniforms && pathTracingUniforms.uMaxBounces) pathTracingUniforms.uMaxBounces.value = 4;
        if (pathTracingUniforms && pathTracingUniforms.uIndirectMultiplier) pathTracingUniforms.uIndirectMultiplier.value = getSliderValue('slider-mult-b');
        if (pathTracingUniforms && pathTracingUniforms.uBorrowStrength) pathTracingUniforms.uBorrowStrength.value = getSliderValue('slider-borrow-strength-b');
        if (screenOutputUniforms && screenOutputUniforms.uSaturation) screenOutputUniforms.uSaturation.value = getSliderValue('slider-sat-b');
        // B 模式（快速預覽）：兩個 toggle 從 checkbox 讀、三條 LGG 從滑桿讀
        var chkAcesEl = document.getElementById('chkAces-b');
        var chkLggEl = document.getElementById('chkLgg');
        if (screenOutputUniforms && screenOutputUniforms.uACESEnabled) screenOutputUniforms.uACESEnabled.value = (chkAcesEl && chkAcesEl.checked) ? 1.0 : 0.0;
        if (screenOutputUniforms && screenOutputUniforms.uACESStrength) screenOutputUniforms.uACESStrength.value = getSliderValue('slider-aces-strength-b');
        // B 模式單一 SAT 同步寫 3 個 uniform；EXP 由 -b 滑桿讀
        var satBVal = getSliderValue('slider-aces-sat-b');
        if (screenOutputUniforms && screenOutputUniforms.uACESSatShadow) screenOutputUniforms.uACESSatShadow.value = satBVal;
        if (screenOutputUniforms && screenOutputUniforms.uACESSatMid) screenOutputUniforms.uACESSatMid.value = satBVal;
        if (screenOutputUniforms && screenOutputUniforms.uACESSatHighlight) screenOutputUniforms.uACESSatHighlight.value = satBVal;
        if (screenOutputUniforms && screenOutputUniforms.uExposure) screenOutputUniforms.uExposure.value = getSliderValue('slider-exp-b');
        if (screenOutputUniforms && screenOutputUniforms.uLGGEnabled) screenOutputUniforms.uLGGEnabled.value = (chkLggEl && chkLggEl.checked) ? 1.0 : 0.0;
        if (screenOutputUniforms && screenOutputUniforms.uLGGStrength) screenOutputUniforms.uLGGStrength.value = getSliderValue('slider-lgg-strength');
        if (screenOutputUniforms && screenOutputUniforms.uLGGLift) screenOutputUniforms.uLGGLift.value = getSliderValue('slider-lgg-lift');
        if (screenOutputUniforms && screenOutputUniforms.uLGGGamma) screenOutputUniforms.uLGGGamma.value = getSliderValue('slider-lgg-gamma');
        if (screenOutputUniforms && screenOutputUniforms.uLGGGain) screenOutputUniforms.uLGGGain.value = getSliderValue('slider-lgg-gain');
        // B 模式 White Balance + Hue（純後製、display-space 最末端）
        if (screenOutputUniforms && screenOutputUniforms.uWBB) screenOutputUniforms.uWBB.value = getSliderValue('slider-wb-b');
        if (screenOutputUniforms && screenOutputUniforms.uHueB) screenOutputUniforms.uHueB.value = getSliderValue('slider-hue-b');
        setSliderValue('slider-pixel-res', 0.5);
        needChangePixelResolution = true;
        applyWallAlbedo(getSliderValue('slider-wall-albedo'));
        wakeRender();
    };

    // R6: cmd+click 重置邏輯需依目前 A/B 模式取對應預設值（slider-bounces / slider-pixel-res）
    // createS 工廠的 init 值寫死在 closure，不能依模式切換；用 capture-phase listener 攔截
    function installContextReset(sliderId, getDefaultByMode, applyDefault)
    {
        var c = document.getElementById(sliderId);
        if (!c) return;
        c.addEventListener('mousedown', function(e) {
            if (e.button === 0 && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                e.stopImmediatePropagation();
                var aActive = btnA && btnA.classList.contains('glow-white');
                var v = getDefaultByMode(aActive);
                applyDefault(v);
            }
        }, true);
    }
    installContextReset('slider-bounces',
        function(aActive) { return aActive ? 14 : 4; },
        function(v) {
            setSliderValue('slider-bounces', v);
            if (pathTracingUniforms && pathTracingUniforms.uMaxBounces) pathTracingUniforms.uMaxBounces.value = v;
            wakeRender();
        });
    installContextReset('slider-pixel-res',
        function(aActive) { return aActive ? 1.0 : 0.5; },
        function(v) {
            setSliderValue('slider-pixel-res', v);
            needChangePixelResolution = true;
        });

    // R6 LGG-r30：per-config cmd+click 重置（8 條受 config 影響的滑桿，依 currentPanelConfig 取 configPostDefaults）
    // A 模時 uniform 寫入仍由 btnA.onclick 強制（borrow/wb/hue 走 0），cmd+click 只動 slider 顯示值
    function postOf() { return configPostDefaults[currentPanelConfig] || configPostDefaults[1]; }
    function bModeActive() { var b = document.getElementById('btnGroupB'); return b && b.classList.contains('glow-white'); }
    installContextReset('slider-borrow-strength-b',
        function() { return postOf().borrow; },
        function(v) {
            setSliderValue('slider-borrow-strength-b', v);
            if (bModeActive() && pathTracingUniforms && pathTracingUniforms.uBorrowStrength) pathTracingUniforms.uBorrowStrength.value = v;
            wakeRender();
        });
    installContextReset('slider-sat-b',
        function() { return postOf().sat; },
        function(v) {
            setSliderValue('slider-sat-b', v);
            if (bModeActive() && screenOutputUniforms && screenOutputUniforms.uSaturation) screenOutputUniforms.uSaturation.value = v;
            wakePostProcess();
        });
    installContextReset('slider-aces-strength-b',
        function() { return postOf().acesStrength; },
        function(v) {
            setSliderValue('slider-aces-strength-b', v);
            if (bModeActive() && screenOutputUniforms && screenOutputUniforms.uACESStrength) screenOutputUniforms.uACESStrength.value = v;
            wakePostProcess();
        });
    installContextReset('slider-aces-sat-b',
        function() { return postOf().acesSat; },
        function(v) {
            setSliderValue('slider-aces-sat-b', v);
            if (bModeActive() && screenOutputUniforms) {
                if (screenOutputUniforms.uACESSatShadow) screenOutputUniforms.uACESSatShadow.value = v;
                if (screenOutputUniforms.uACESSatMid) screenOutputUniforms.uACESSatMid.value = v;
                if (screenOutputUniforms.uACESSatHighlight) screenOutputUniforms.uACESSatHighlight.value = v;
            }
            wakePostProcess();
        });
    installContextReset('slider-lgg-lift',
        function() { return postOf().lggLift; },
        function(v) {
            setSliderValue('slider-lgg-lift', v);
            if (bModeActive() && screenOutputUniforms && screenOutputUniforms.uLGGLift) screenOutputUniforms.uLGGLift.value = v;
            wakePostProcess();
        });
    installContextReset('slider-lgg-gamma',
        function() { return postOf().lggGamma; },
        function(v) {
            setSliderValue('slider-lgg-gamma', v);
            if (bModeActive() && screenOutputUniforms && screenOutputUniforms.uLGGGamma) screenOutputUniforms.uLGGGamma.value = v;
            wakePostProcess();
        });
    installContextReset('slider-lgg-gain',
        function() { return postOf().lggGain; },
        function(v) {
            setSliderValue('slider-lgg-gain', v);
            if (bModeActive() && screenOutputUniforms && screenOutputUniforms.uLGGGain) screenOutputUniforms.uLGGGain.value = v;
            wakePostProcess();
        });
    installContextReset('slider-wb-b',
        function() { return postOf().wb; },
        function(v) {
            setSliderValue('slider-wb-b', v);
            if (bModeActive() && screenOutputUniforms && screenOutputUniforms.uWBB) screenOutputUniforms.uWBB.value = v;
            wakePostProcess();
        });
    installContextReset('slider-hue-b',
        function() { return postOf().hue; },
        function(v) {
            setSliderValue('slider-hue-b', v);
            if (bModeActive() && screenOutputUniforms && screenOutputUniforms.uHueB) screenOutputUniforms.uHueB.value = v;
            wakePostProcess();
        });
    installContextReset('slider-wall-albedo',
        function() { return postOf().wall; },
        function(v) {
            // applyWallAlbedo 會處理 setSliderValue + wallAlbedo + C_WALL + BVH texture，必觸發 wakeRender
            if (typeof window.applyWallAlbedo === 'function') {
                window.applyWallAlbedo(v);
                wakeRender();
            } else {
                setSliderValue('slider-wall-albedo', v);
            }
        });



    createS('slider-wall-albedo', '牆面反射率', 0.1, 1.0, 0.05, 0.75, function(v) {
        wallAlbedo = v;
        var r = 1.0 * v, g = 0.984 * v, b = 0.949 * v;
        C_WALL[0] = r; C_WALL[1] = g; C_WALL[2] = b;
        C_WALL_L[0] = r; C_WALL_L[1] = g; C_WALL_L[2] = b;
        C_WALL_R[0] = r; C_WALL_R[1] = g; C_WALL_R[2] = b;
        C_WALL_S[0] = r; C_WALL_S[1] = g; C_WALL_S[2] = b;
        updateBoxDataTexture();
        wakeRender();
        return v;
    });

    // R6: 預設啟動「快速預覽」（btnB），套用 bounces=4 / mult=2.5 / wallAlbedo=1.0 / sat=1.2
    // 必須延後到 initTHREEjs 完整跑完：uMaxBounces (line 690)、screenOutputUniforms (line 755)、
    // 以及 line 649 的 setSliderValue('slider-pixel-res', 1.0) 都是 initUI 之後才執行
    setTimeout(function() { if (btnB) btnB.onclick(); }, 0);

    // 💡 燈光設定
    createS('slider-emissive-clamp', '發光面上限', 10, 500, 1, 250, function(v) { 
        if (pathTracingUniforms && pathTracingUniforms.uEmissiveClamp) pathTracingUniforms.uEmissiveClamp.value = v;
        wakeRender(); return v; 
    });

    // Brightness (吸頂主燈) — inject slider div into light panel
    var lightPanel = document.getElementById('light-panel');
    if (lightPanel) {
        var bDiv = document.createElement('div');
        bDiv.id = 'slider-brightness';
        lightPanel.insertBefore(bDiv, lightPanel.firstChild);
    }
    createS('slider-brightness', '吸頂主燈', 0, 4000, 1, 900, function(v) {
        basicBrightness = v;
        wakeRender();
        return v;
    });

    // Cloud checkbox
    var chkCloud = document.getElementById('chkCloud');
    if (chkCloud) chkCloud.onchange = function(e) {
        if (pathTracingUniforms && pathTracingUniforms.uCloudLightEnabled) {
            pathTracingUniforms.uCloudLightEnabled.value = e.target.checked ? 1.0 : 0.0;
        }
        rebuildActiveLightLUT('cloudCheckbox');
        syncSectionInactiveState();
        wakeRender();
    };

    // Track checkbox
    var chkTrack = document.getElementById('chkTrack');
    if (chkTrack) chkTrack.onchange = function(e) {
        if (pathTracingUniforms && pathTracingUniforms.uTrackLightEnabled) {
            pathTracingUniforms.uTrackLightEnabled.value = e.target.checked ? 1.0 : 0.0;
        }
        rebuildActiveLightLUT('trackCheckbox');
        syncSectionInactiveState();
        wakeRender();
    };

    // Wide South checkbox
    var chkWideSouth = document.getElementById('chkTrackWideSouth');
    if (chkWideSouth) chkWideSouth.onchange = function(e) {
        if (pathTracingUniforms && pathTracingUniforms.uWideTrackLightEnabled) {
            var northChk = document.getElementById('chkTrackWideNorth');
            var anyOn = e.target.checked || (northChk && northChk.checked);
            pathTracingUniforms.uWideTrackLightEnabled.value = anyOn ? 1.0 : 0.0;
        }
        syncWideEmissions();
        rebuildActiveLightLUT('wideCheckbox');
        syncSectionInactiveState();
        wakeRender();
    };

    // Wide North checkbox
    var chkWideNorth = document.getElementById('chkTrackWideNorth');
    if (chkWideNorth) chkWideNorth.onchange = function(e) {
        if (pathTracingUniforms && pathTracingUniforms.uWideTrackLightEnabled) {
            var southChk = document.getElementById('chkTrackWideSouth');
            var anyOn = e.target.checked || (southChk && southChk.checked);
            pathTracingUniforms.uWideTrackLightEnabled.value = anyOn ? 1.0 : 0.0;
        }
        syncWideEmissions();
        rebuildActiveLightLUT('wideCheckbox');
        syncSectionInactiveState();
        wakeRender();
    };

    // Cloud lumens
    createS('slider-lumens', '光通量 (lm/m)', 0, 4000, 1, 1600, function(v) {
        for (let i = 0; i < CLOUD_ROD_LENGTH.length; i++) {
            CLOUD_ROD_LUMENS[i] = v * CLOUD_ROD_LENGTH[i];
        }
        computeLightEmissions();
        wakeRender();
        return v;
    });

    // Track lumens
    createS('slider-track-lumens', '光通量 (單盞)', 0, 3000, 50, 2000, function(v) {
        trackLumens = v;
        computeLightEmissions();
        wakeRender();
        return v;
    });

    // R4-4 投射燈甜蜜點滑桿（5 條）— 接線至反冪律 radiance + 動態 cos + sceneBoxes 位置
    // 光束角互鎖：卡自己（v5 規格 L704-707），非推對側
    createS('slider-track-beam-inner', '光束角(內)', 1, 90, 1, 40, function(v) {
        v = Math.min(v, trackBeamOuter); // 卡自己：內緣最高 = 當時外緣值
        trackBeamInner = v;
        recomputeTrackGeometry();
        wakeRender();
        return v;
    });
    createS('slider-track-beam-outer', '光束角(外)', 15, 90, 1, 60, function(v) {
        v = Math.max(v, trackBeamInner); // 卡自己：外緣最低 = 當時內緣值
        trackBeamOuter = v;
        recomputeTrackGeometry();
        wakeRender();
        return v;
    });
    createS('slider-track-tilt', '傾斜角', 0, 90, 1, 45, function(v) {
        trackTilt = v;
        recomputeTrackGeometry();
        wakeRender();
        return v;
    });
    createS('slider-track-space', '間距 (cm)', 0, 180, 1, 150, function(v) {
        trackSpacing = v;
        recomputeTrackPositions();
        // BVH 重建：拖動期 r4_4_rebuildLock=true 時跳過；鍵盤 / number input 類無指針事件即時重建
        if (!r4_4_rebuildLock) {
            const t0 = performance.now();
            buildSceneBVH();
            console.log('[R4-4] BVH rebuild ' + (performance.now() - t0).toFixed(1) + 'ms (no-pointer, slider-track-space)');
        }
        wakeRender();
        return v;
    });
    createS('slider-track-x', '距Cloud邊距', 0.05, 0.90, 0.01, 0.05, function(v) {
        trackBaseX = 0.90 + v;
        recomputeTrackPositions();
        if (!r4_4_rebuildLock) {
            const t0 = performance.now();
            buildSceneBVH();
            console.log('[R4-4] BVH rebuild ' + (performance.now() - t0).toFixed(1) + 'ms (no-pointer, slider-track-x)');
        }
        wakeRender();
        return v;
    });

    // Wide lumens
    createS('slider-track-wide-lumens', '光通量 (單盞)', 0, 4000, 50, 2500, function(v) {
        trackWideLumens = v;
        computeLightEmissions();
        wakeRender();
        return v;
    });

    // R4-4 廣角燈甜蜜點滑桿（4 條接線 + 1 條停手）
    // 光束角互鎖：卡自己（v5 規格 L704-707）；廣角 120° 固定無變焦，不進反冪律
    createS('slider-track-wide-beam-inner', '廣角束角(內)', 10, 160, 1, 90, function(v) {
        v = Math.min(v, trackWideBeamOuter);
        trackWideBeamInner = v;
        recomputeWideGeometry();
        wakeRender();
        return v;
    });
    createS('slider-track-wide-beam-outer', '廣角束角(外)', 60, 160, 1, 120, function(v) {
        v = Math.max(v, trackWideBeamInner);
        trackWideBeamOuter = v;
        recomputeWideGeometry();
        wakeRender();
        return v;
    });
    createS('slider-track-wide-tilt-south', '南側傾斜角', -70, 70, 1, 30, function(v) {
        trackWideTiltSouth = v;
        recomputeWideGeometry();
        wakeRender();
        return v;
    });
    createS('slider-track-wide-tilt-north', '北側傾斜角', -70, 70, 1, -30, function(v) {
        trackWideTiltNorth = v;
        recomputeWideGeometry();
        wakeRender();
        return v;
    });
    // R4-4 第 10 條滑桿「距 Cloud 邊距」（選項 C 語義）：
    //   v = 軌道外緣到 Cloud 最近邊緣的直線距離（使用者原話：現場施工好抓距離）
    //   南軌 z = z_cloud_south(1.698) + v；北軌 z = z_cloud_north(-0.702) - v
    //   範圍 0.05 ~ 1.15：v=0.40 預設 → ±2.098/-1.102（保 R2-15 視覺基準）；v=1.15 → 北軌 z=-1.852 距北牆 22mm
    createS('slider-track-wide-z', '距Cloud邊距', 0.05, 1.15, 0.01, 0.20, function(v) {
        trackWideZ = v;
        recomputeWidePositions();
        if (!r4_4_rebuildLock) {
            const t0 = performance.now();
            buildSceneBVH();
            console.log('[R4-4] BVH rebuild ' + (performance.now() - t0).toFixed(1) + 'ms (no-pointer, slider-track-wide-z)');
        }
        wakeRender();
        return v;
    });

    // GIK Minimap state & logic
    var gikColors = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 9 wall panels (W1, W2, W3, E1, E2, E3, N1, N2, N3 mapping to index 0-8)
    var gikCeilColor = 0;

    // Helper to update the "All" button appearance
    window.updateAllButtonState = function() {
        var allBtn = document.querySelector('.gik-block[data-idx="all"]');
        if (!allBtn) return;
        
        var activeColors = [];
        if (currentPanelConfig === 1) {
            activeColors.push(gikColors[4], gikColors[1], gikColors[7]);
        } else {
            for (var i=0; i<9; i++) activeColors.push(gikColors[i]);
            if (currentPanelConfig === 3) activeColors.push(gikCeilColor);
        }
        
        var firstColor = activeColors[0];
        var isMixed = false;
        for (var i = 1; i < activeColors.length; i++) {
            if (activeColors[i] !== firstColor) {
                isMixed = true;
                break;
            }
        }
        
        allBtn.dataset.color = isMixed ? 'mixed' : firstColor;
    };

    // CONFIG radio group
    document.querySelectorAll('input[name="panelConfig"]').forEach(function(radio) {
        radio.addEventListener('change', function() {
            var conf = parseInt(this.value);
            if (conf === 1) {
                for(var i=0; i<9; i++) gikColors[i] = 0;
                gikCeilColor = 0;
            } else {
                for(var i=0; i<6; i++) gikColors[i] = 1; // EW white
                for(var i=6; i<9; i++) gikColors[i] = 0; // N gray
                gikCeilColor = 1;
            }
            document.querySelectorAll('.gik-block').forEach(function(b) {
                var idx = b.dataset.idx;
                if (idx === 'all') {} // Handled by updateAllButtonState
                else if (idx === 'ceil') b.dataset.color = gikCeilColor;
                else b.dataset.color = gikColors[parseInt(idx)];
            });
            applyPanelConfig(conf);
        });
    });

    function applyGikColorToAbsBox(boxIdx, colorIdx) {
        var box = sceneBoxes[boxIdx];
        if (!box) return;
        box.meta = (colorIdx === 0) ? 0 : 1;
        var c = C_WHITE;
        if (colorIdx === 0) c = C_GIK;
        else if (colorIdx === 1) c = C_WHITE;
        else if (colorIdx === 2) c = [0.8, 0.2, 0.2];
        else if (colorIdx === 3) c = [0.2, 0.2, 0.2];
        box.color = c;
    }

    function applyGikColorToBox(boxIdxOffset, colorIdx) {
        applyGikColorToAbsBox(BASE_BOX_COUNT + boxIdxOffset, colorIdx);
    }

    function syncGikPanels() {
        if (currentPanelConfig === 1) {
            // Config 1 has only 3 panels. Hardcode them to first 3 elements for now or ignore advanced picking.
            // E2=0, W2=1, N_v=2
            applyGikColorToBox(0, gikColors[4]); // E2
            applyGikColorToBox(1, gikColors[1]); // W2
            applyGikColorToBox(2, gikColors[7]); // N_v (closest to N2)
        } else {
            // Config 2 or 3 has 9 panels
            for (var i = 0; i < 9; i++) {
                // map index to panelConfig2 indices (which align with how they are pushed to sceneBoxes)
                // 0,1,2 = N1,N2,N3
                // 3,4,5 = E1,E2,E3
                // 6,7,8 = W1,W2,W3
                var pIdx = i;
                if (i >= 0 && i <= 2) pIdx = i + 6; // W1,W2,W3 from gikColors to W1,W2,W3 in panelConfig2
                else if (i >= 3 && i <= 5) pIdx = i; // E1,E2,E3
                else if (i >= 6 && i <= 8) pIdx = i - 6; // N1,N2,N3 mapping fixed! i=6->0(N1 bottom), i=8->2(N3 top)
                
                applyGikColorToBox(pIdx, gikColors[i]);
            }
            // Cloud
            if (currentPanelConfig === 3) {
                // Cloud panels are permanently at absolute indices 65 to 70 in sceneBoxes
                for (var c = 65; c <= 70; c++) applyGikColorToAbsBox(c, gikCeilColor);
            }
        }
        updateBoxDataTexture();
        if (window.updateAllButtonState) window.updateAllButtonState();
        wakeRender();
    }
    window.reapplyGikColors = syncGikPanels;



    var gikPalette = document.createElement('div');
    gikPalette.className = 'gik-palette';
    gikPalette.innerHTML = '<div class="gik-color-btn" data-val="0"></div><div class="gik-color-btn" data-val="1"></div>';
    document.body.appendChild(gikPalette);
    var activeGikBlock = null;
    function attachPaletteEvents() {
        gikPalette.querySelectorAll('.gik-color-btn').forEach(function(btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                var valStr = btn.dataset.val;
                var idxStr = activeGikBlock.dataset.idx;
                
                if (valStr === 'mixed') {
                    for(var i=0; i<6; i++) gikColors[i] = 1;
                    for(var i=6; i<9; i++) gikColors[i] = 0;
                    gikCeilColor = 1;
                    document.querySelectorAll('.gik-block').forEach(function(b) {
                        var bIdx = b.dataset.idx;
                        if (bIdx !== 'all' && bIdx !== 'ceil') b.dataset.color = gikColors[parseInt(bIdx)];
                        else if (bIdx === 'ceil') b.dataset.color = gikCeilColor;
                    });
                } else {
                    var val = parseInt(valStr);
                    if (idxStr === 'all') {
                        for(var i=0; i<9; i++) gikColors[i] = val;
                        gikCeilColor = val;
                        document.querySelectorAll('.gik-block').forEach(function(b) { if(b.dataset.idx !== 'all') b.dataset.color = val; });
                    } else if (idxStr === 'ceil') {
                        gikCeilColor = val;
                        activeGikBlock.dataset.color = val;
                    } else {
                        var idx = parseInt(idxStr);
                        gikColors[idx] = val;
                        activeGikBlock.dataset.color = val;
                    }
                }
                
                gikPalette.style.display = 'none';
                activeGikBlock = null;
                syncGikPanels();
            };
        });
    }

    document.querySelectorAll('.gik-block').forEach(function(blk) {
        blk.onclick = function(e) {
            e.stopPropagation();
            if (activeGikBlock === blk) { gikPalette.style.display = 'none'; activeGikBlock = null; return; }
            activeGikBlock = blk;
            
            var html = '<div class="gik-color-btn" data-val="0"></div><div class="gik-color-btn" data-val="1"></div>';
            if (blk.dataset.idx === 'all' && currentPanelConfig !== 1) {
                html += '<div class="gik-color-btn" data-val="mixed" title="恢復預設配置"></div>';
            }
            gikPalette.innerHTML = html;
            attachPaletteEvents();
            
            var rect = blk.getBoundingClientRect();
            gikPalette.style.display = 'flex';
            gikPalette.style.top = (rect.top - 28) + 'px';
            gikPalette.style.left = (rect.left + rect.width / 2 - gikPalette.offsetWidth / 2) + 'px';
        };
    });
    document.addEventListener('click', function() { if (activeGikBlock) { gikPalette.style.display = 'none'; activeGikBlock = null; } });
    window.addEventListener('resize', function() { if (activeGikBlock) { gikPalette.style.display = 'none'; activeGikBlock = null; } });

    // Button group visual toggle — glow-white only groups
    ['groupTrackMeshColor', 'groupTrackWideMeshColor'].forEach(function(gid) {
        var group = document.getElementById(gid);
        if (!group) return;
        group.addEventListener('click', function(e) {
            var btn = e.target.closest('.action-btn');
            if (!btn) return;
            group.querySelectorAll('.action-btn').forEach(function(b) { b.classList.remove('glow-white'); });
            btn.classList.add('glow-white');
            
            if (gid === 'groupTrackMeshColor') {
                var c = (btn.dataset.val === 'WHITE') ? C_WHITE : [0.05, 0.05, 0.05];
                sceneBoxes.forEach(b => { if(b.fixtureGroup === 1 && b.type === 13) b.color = c; });
                updateBoxDataTexture();
            } else if (gid === 'groupTrackWideMeshColor') {
                var c = (btn.dataset.val === 'WHITE') ? C_WHITE : [0.05, 0.05, 0.05];
                sceneBoxes.forEach(b => { if(b.fixtureGroup === 2 && b.type === 13) b.color = c; });
                updateBoxDataTexture();
            }
            wakeRender();
        });
    });

    // Cloud color — warm/neutral/cold glow
    var gcCloud = document.getElementById('groupCloudColor');
    if (gcCloud) gcCloud.addEventListener('click', function(e) {
        var btn = e.target.closest('.action-btn');
        if (!btn) return;
        gcCloud.querySelectorAll('.action-btn').forEach(function(b) { b.classList.remove('glow-white', 'glow-orange', 'glow-blue'); });
        var val = btn.dataset.val;
        if (val === 'WARM') { btn.classList.add('glow-orange'); cloudKelvin = CLOUD_MODE_K.WARM; }
        else if (val === 'NEUTRAL') { btn.classList.add('glow-white'); cloudKelvin = CLOUD_MODE_K.NEUTRAL; }
        else if (val === 'COLD') { btn.classList.add('glow-blue'); cloudKelvin = CLOUD_MODE_K.COLD; }
        cloudColorMode = val;
        computeLightEmissions();
        wakeRender();
    });

    // Track color — 4-way gradient glow
    var gcTrack = document.getElementById('groupTrackColor');
    if (gcTrack) gcTrack.addEventListener('click', function(e) {
        var btn = e.target.closest('.action-btn');
        if (!btn) return;
        gcTrack.querySelectorAll('.action-btn').forEach(function(b) { b.classList.remove('glow-orange', 'glow-blue', 'glow-gradient-ob', 'glow-gradient-bo'); });
        var val = btn.dataset.val;
        if (val === 'ALL_WARM') { btn.classList.add('glow-orange'); trackKelvin = [TRACK_MODE_K.WARM, TRACK_MODE_K.WARM, TRACK_MODE_K.WARM, TRACK_MODE_K.WARM]; }
        else if (val === 'ALL_COLD') { btn.classList.add('glow-blue'); trackKelvin = [TRACK_MODE_K.COLD, TRACK_MODE_K.COLD, TRACK_MODE_K.COLD, TRACK_MODE_K.COLD]; }
        else if (val === 'WARM_COLD') { btn.classList.add('glow-gradient-ob'); trackKelvin = [TRACK_MODE_K.WARM, TRACK_MODE_K.WARM, TRACK_MODE_K.COLD, TRACK_MODE_K.COLD]; }
        else if (val === 'COLD_WARM') { btn.classList.add('glow-gradient-bo'); trackKelvin = [TRACK_MODE_K.COLD, TRACK_MODE_K.COLD, TRACK_MODE_K.WARM, TRACK_MODE_K.WARM]; }
        trackColorMode = val;
        computeLightEmissions();
        wakeRender();
    });

    // Wide South/North color — warm/neutral/cold glow
    ['groupTrackWideColorSouth', 'groupTrackWideColorNorth'].forEach(function(gid) {
        var group = document.getElementById(gid);
        if (!group) return;
        group.addEventListener('click', function(e) {
            var btn = e.target.closest('.action-btn');
            if (!btn) return;
            group.querySelectorAll('.action-btn').forEach(function(b) { b.classList.remove('glow-orange', 'glow-white', 'glow-blue'); });
            var val = btn.dataset.val;
            var k = WIDE_MODE_K.NEUTRAL;
            if (val === 'WARM') { btn.classList.add('glow-orange'); k = WIDE_MODE_K.WARM; }
            else if (val === 'NEUTRAL') { btn.classList.add('glow-white'); k = WIDE_MODE_K.NEUTRAL; }
            else if (val === 'COLD') { btn.classList.add('glow-blue'); k = WIDE_MODE_K.COLD; }
            
            if (gid === 'groupTrackWideColorSouth') { trackWideKelvin[0] = k; trackWideColorSouth = val; }
            else { trackWideKelvin[1] = k; trackWideColorNorth = val; }
            
            computeLightEmissions();
            wakeRender();
        });
    });

    // Hide UI toggle — eye stays visible so user can click to restore
    var hideBtn = document.getElementById('hide-btn');
    var helpWrapper = document.getElementById('help-wrapper');
    var topRightGroup = document.getElementById('top-right-group');
    if (hideBtn) {
        var uiHidden = false;
        hideBtn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
        hideBtn.onclick = function(e) {
            e.stopPropagation();
            uiHidden = !uiHidden;
            var d = uiHidden ? 'none' : '';
            if (uiContainer) uiContainer.style.display = d;
            if (topRightGroup) topRightGroup.style.display = d;
            if (helpWrapper) helpWrapper.style.display = d;
            // R4-5：隱藏 UI 時保留左下資訊，收起快照列與快照按鈕
            var cameraInfoEl = document.getElementById('cameraInfo');
            var snapshotBarEl = document.getElementById('snapshot-bar');
            var snapshotActionsEl = document.getElementById('snapshot-actions');
            if (cameraInfoEl) cameraInfoEl.style.display = "";
            if (snapshotBarEl) snapshotBarEl.style.display = d;
            if (snapshotActionsEl) snapshotActionsEl.style.display = d;
        };
    }

    // Pointer-lock guard for fixed control groups
    var brg = document.getElementById('bottom-right-group');
    if (brg) {
        brg.addEventListener('mouseenter', function() { ableToEngagePointerLock = false; }, false);
        brg.addEventListener('mouseleave', function() { ableToEngagePointerLock = true; }, false);
        brg.addEventListener('click', function(e) { e.stopPropagation(); }, false);
    }
    if (topRightGroup) {
        topRightGroup.addEventListener('mouseenter', function() { ableToEngagePointerLock = false; }, false);
        topRightGroup.addEventListener('mouseleave', function() { ableToEngagePointerLock = true; }, false);
        topRightGroup.addEventListener('click', function(e) { e.stopPropagation(); }, false);
    }

    // Pointer-lock guard for snapshot bar and actions（bug fix：chip 點選會觸發 pointer lock）
    ['snapshot-bar', 'snapshot-actions'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('mouseenter', function() { ableToEngagePointerLock = false; }, false);
            el.addEventListener('mouseleave', function() { ableToEngagePointerLock = true; }, false);
            el.addEventListener('click', function(e) { e.stopPropagation(); }, false);
        }
    });

    // Capture-phase override：lock 模式下 mousedown 永遠阻止 pointer lock 觸發
    document.addEventListener('mousedown', function() {
        if (uiLocked) ableToEngagePointerLock = false;
    }, true);

    // Lock button
    var lockBtn = document.getElementById('lock-btn');
    if (lockBtn) {
        lockBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            uiLocked = !uiLocked;
            lockBtn.classList.toggle('locked', uiLocked);
            var uiEl = document.getElementById('ui-container');
            var trg = document.getElementById('top-right-group');
            var hw = document.getElementById('help-wrapper');
            var pe = uiLocked ? 'none' : '';
            if (uiEl) uiEl.style.pointerEvents = pe;
            if (trg) trg.style.pointerEvents = pe;
            if (hw) hw.style.pointerEvents = pe;
            if (uiLocked && document.pointerLockElement) document.exitPointerLock();
        }, false);
    }

    // R4-4：BVH 指針策略綁定（拖動期鎖 + 指針放開 50 ms 防抖）
    // 投射燈間距 / 投射燈軌道 x / 廣角燈距 Cloud 邊距 3 條接 BVH
    attachBVHPointerStrategy('slider-track-space');
    attachBVHPointerStrategy('slider-track-x');
    attachBVHPointerStrategy('slider-track-wide-z');

    // Sync initial state
    syncR3ColorUIEnable();

    // Camera preset buttons
    ['btnCam1', 'btnCam2', 'btnCam3'].forEach(function(id, idx) {
        var btn = document.getElementById(id);
        if (btn) {
            btn.onclick = function(e) {
                e.stopPropagation();
                // Remove glow from all, add to clicked
                ['btnCam1', 'btnCam2', 'btnCam3'].forEach(function(bid) {
                    var b = document.getElementById(bid);
                    if (b) b.classList.remove('glow-white');
                });
                btn.classList.add('glow-white');
                switchCamera('cam' + (idx + 1));
            };
        }
    });
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

    // R2-11 中央吸頂燈：色溫 × 亮度 × 圓面積補償（0.01 / (π × 0.235²) ≈ 0.05764）
    var rgb = kelvinToRGB(colorTemperature);
    var s = basicBrightness * 0.05764;
    pathTracingUniforms.uLightEmission.value.set(rgb.r * s, rgb.g * s, rgb.b * s);

    // R2-13 X-ray 透視剝離：每幀同步相機世界座標供 shader 判定剝離方向
    pathTracingUniforms.uCamPos.value.set(
        cameraControlsObject.position.x,
        cameraControlsObject.position.y,
        cameraControlsObject.position.z
    );

    var _samplingReport = (typeof window.reportSamplingPaused === 'function') ? window.reportSamplingPaused() : null;
    var _samplingPausedForMetrics = !!(_samplingReport && _samplingReport.paused && !cameraIsMoving);

    // R4-5：FPS 累積器（每秒重算）
    if (typeof window._fpsAcc === 'undefined') { window._fpsAcc = { frames: 0, lastT: performance.now(), fps: 0 }; }
    if (!_samplingPausedForMetrics) window._fpsAcc.frames++;
    var _nowT = performance.now();
    if (_nowT - window._fpsAcc.lastT >= 500) {
        window._fpsAcc.fps = Math.round(window._fpsAcc.frames * 1000 / (_nowT - window._fpsAcc.lastT));
        window._fpsAcc.frames = 0;
        window._fpsAcc.lastT = _nowT;
    }
    if (_samplingPausedForMetrics) window._fpsAcc.fps = 0;
    if (typeof window._renderTimer === 'undefined') {
        window._renderTimer = { startMs: performance.now(), finalMs: 0, frozen: false, paused: false, pauseStartMs: 0, pausedMs: 0 };
    }
    if (cameraIsMoving || needClearAccumulation || sampleCounter < lastSnapshotCheck)
        resetRenderTimerForAccumulationRestart(_nowT);
    if (_samplingPausedForMetrics) {
        if (!window._renderTimer.paused) {
            window._renderTimer.paused = true;
            window._renderTimer.pauseStartMs = _nowT;
        }
    } else if (window._renderTimer.paused) {
        window._renderTimer.pausedMs += _nowT - window._renderTimer.pauseStartMs;
        window._renderTimer.paused = false;
        window._renderTimer.pauseStartMs = 0;
    }
    let _elapsedMs;
    if (_samplingPausedForMetrics) {
        _elapsedMs = window._renderTimer.pauseStartMs - window._renderTimer.startMs - window._renderTimer.pausedMs;
    } else if (sampleCounter >= MAX_SAMPLES) {
        if (!window._renderTimer.frozen) {
            window._renderTimer.finalMs = _nowT - window._renderTimer.startMs - window._renderTimer.pausedMs;
            window._renderTimer.frozen = true;
        }
        _elapsedMs = window._renderTimer.finalMs;
    } else {
        _elapsedMs = _nowT - window._renderTimer.startMs - window._renderTimer.pausedMs;
    }
    const _totalSec = Math.floor(_elapsedMs / 1000);
    const _h = Math.floor(_totalSec / 3600);
    const _m = Math.floor((_totalSec % 3600) / 60);
    const _s = _totalSec % 60;
    const _timeStr = (_h > 0 ? _h + "h" : "") + String(_m).padStart(2, '0') + "m" + String(_s).padStart(2, '0') + "s";
    var _hibernating = (sampleCounter >= MAX_SAMPLES && !cameraIsMoving);
    if (_hibernating) window._fpsAcc.fps = 0;
    var _displaySamples = _hibernating ? MAX_SAMPLES : sampleCounter;
    cameraInfoElement.innerHTML = "FPS: " + window._fpsAcc.fps + " / FOV: " + worldCamera.fov + " / Samples: " + _displaySamples + " / 耗時: " + _timeStr + (_samplingPausedForMetrics ? " (暫停)" : "") + (_hibernating ? " (休眠)" : "") + getCloudVisibilityProbeLabel() + getCloudThetaImportanceShaderABLabel() + getCloudMisWeightProbeLabel();

}

init();
