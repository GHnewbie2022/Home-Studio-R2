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
const C_WALL = [1.0, 0.984, 0.949];
const C_WALL_L = [1.0, 0.984, 0.949];
const C_WALL_R = [1.0, 0.984, 0.949];
const C_WALL_S = [1.0, 0.984, 0.949];
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
addBox([-15.0, -5.0, 14.9], [15.0, 10.0, 15.0], z3, C_WHITE, 5, 0, 1);              // 27 窗外景色背板（type 5: 貼圖採樣）

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
addBox([ 0.884, 2.787, -0.702], [ 0.900, 2.803, 1.698], z3, C_CLOUD_LIGHT, 14, 0, 1, 4);  // 55 東燈條（沿 z 2.4m；舊專案 c=[0.892, 2.795, 0.498] s=[0.016, 0.016, 2.4]）
addBox([-0.900, 2.787, -0.702], [-0.884, 2.803, 1.698], z3, C_CLOUD_LIGHT, 14, 0, 1, 4);  // 56 西燈條
addBox([-0.884, 2.787,  1.682], [ 0.884, 2.803, 1.698], z3, C_CLOUD_LIGHT, 14, 0, 1, 4);  // 57 南燈條（沿 x 1.768m；比照東西短軸 1.6cm）
addBox([-0.884, 2.787, -0.702], [ 0.884, 2.803, -0.686], z3, C_CLOUD_LIGHT, 14, 0, 1, 4); // 58 北燈條

// R3-3：商品規格 D-35NA12V4DR1 軟條燈 480 lm/m。
// R3-5b (2-face 甲案): Φ_rod = 480 × L；faceArea = 0.016 × L（+Y 頂 + 外長側 2 面；−Y 被 Cloud 板擋、內長面 + 兩短端本階段不發光 ≈ 0.66% 能量損失登錄 ADR）。
// 順序 [0]=E [1]=W [2]=S [3]=N 對齊 uCloudEmission / uCloudFaceArea。
const CLOUD_ROD_LUMENS    = [480 * 2.4, 480 * 2.4, 480 * 1.768, 480 * 1.768];
const CLOUD_ROD_FACE_AREA = [0.016 * 2.4, 0.016 * 2.4, 0.016 * 1.768, 0.016 * 1.768];

// R3-5b: Cloud 2-face stochastic NEE (甲案)
// sceneBoxes 55(E)/56(W)/57(S)/58(N)；中心與半邊由 addBox min/max 推導
// E/W 沿 z 長 2.4m；S/N 沿 x 長 1.768m；四向厚度皆 16mm
const CLOUD_FACE_COUNT = 2;
const CLOUD_ROD_CENTER = [
    new THREE.Vector3( 0.892, 2.795,  0.498),  // rod 0 E
    new THREE.Vector3(-0.892, 2.795,  0.498),  // rod 1 W
    new THREE.Vector3( 0.000, 2.795,  1.690),  // rod 2 S
    new THREE.Vector3( 0.000, 2.795, -0.694),  // rod 3 N
];
const CLOUD_ROD_HALF_EXTENT = [
    new THREE.Vector3(0.008, 0.008, 1.200),    // rod 0 E
    new THREE.Vector3(0.008, 0.008, 1.200),    // rod 1 W
    new THREE.Vector3(0.884, 0.008, 0.008),    // rod 2 S
    new THREE.Vector3(0.884, 0.008, 0.008),    // rod 3 N
];

// R2-8 吸音板
const BASE_BOX_COUNT = 75; // base 53 + R2-14 八 + R2-15 四 + R2-16 六 + R2-17 四 = 75

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
    // R2-18：pixel 4 新增 [roughness, metalness, 0, 0]；75 box × 5 = 375 ≤ BVH_TEX_W=512
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
    sceneBoxes.length = BASE_BOX_COUNT;
    // R2-18 fix22：Config 1/2/3 三者互斥
    // fix25：Config 3 = 全 GIK（9 片牆 + 6 片天花 Cloud + 燈條 + 軌道燈），表示「完整吸音處理」
    if (config === 1) {
        panelConfig1.forEach(function (p) {
            addBox(p.min, p.max, z3, p.color, 10, p.meta, p.cullable);
        });
    } else if (config === 2 || config === 3) {
        panelConfig2.forEach(function (p) {
            addBox(p.min, p.max, z3, p.color, 10, p.meta, p.cullable);
        });
    }
    // Cloud 聯動：config 3 時開 Cloud 板+燈條+吸頂燈北移；否則關
    // fix24：軌道燈（投射/廣角）亦隨 Config 3 連動（Config 1/2 關、Config 3 開）
    var cloudOn = (config === 3);
    if (pathTracingUniforms && pathTracingUniforms.uCloudPanelEnabled) {
        pathTracingUniforms.uCloudPanelEnabled.value = cloudOn ? 1.0 : 0.0;
    }
    if (pathTracingUniforms && pathTracingUniforms.uCloudLightEnabled) {
        pathTracingUniforms.uCloudLightEnabled.value = cloudOn ? 1.0 : 0.0;
    }
    if (pathTracingUniforms && pathTracingUniforms.uTrackLightEnabled) {
        pathTracingUniforms.uTrackLightEnabled.value = cloudOn ? 1.0 : 0.0;
    }
    if (pathTracingUniforms && pathTracingUniforms.uWideTrackLightEnabled) {
        pathTracingUniforms.uWideTrackLightEnabled.value = cloudOn ? 1.0 : 0.0;
    }
    if (pathTracingUniforms && pathTracingUniforms.uCeilingLampPos) {
        pathTracingUniforms.uCeilingLampPos.value.z = cloudOn ? -1.5 : 0.591;
    }
    // R3-4 fix06：Config 3 吸頂燈預設壓 0（軌道燈+Cloud 燈撐場景），Config 1/2 回 900
    // R4-1：DOM adapter 取代 lil-gui API
    basicBrightness = cloudOn ? 0 : 900;
    if (config === 3) {
        setSliderValue('slider-brightness', 0);
        setSliderEnabled('slider-brightness', false);
        setSliderLabel('slider-brightness', '吸頂主燈（CONFIG 3 已拆除）');
    } else {
        setSliderEnabled('slider-brightness', true);
        setSliderLabel('slider-brightness', '吸頂主燈');
        setSliderValue('slider-brightness', 900);
    }
    // GUI checkbox 同步
    setCheckboxChecked('chkTrack', cloudOn);
    setCheckboxChecked('chkTrackWideSouth', cloudOn);
    setCheckboxChecked('chkTrackWideNorth', cloudOn);
    setCheckboxChecked('chkCloud', cloudOn);
    syncWideEmissions();
    currentPanelConfig = config;
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
    // R4-2 CONFIG radio: 同步 DOM radio 狀態 + 描述文字
    var configRadio = document.getElementById('btnConfig' + config);
    if (configRadio) configRadio.checked = true;
    var descEl = document.getElementById('config-desc');
    if (descEl) {
        var descs = { 1: '吸頂燈 + 牆面吸音板', 2: '吸頂燈 + 牆面吸音板（配色 2）', 3: '全吸音處理（Cloud + 軌道燈 + 廣角燈）' };
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
    } else if (config === 3) {
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

// R4-1：依 currentPanelConfig 同步燈光 slider enable/disable。
// Config 1/2 = 吸頂燈撐場景 → 燈光 slider disable。Config 3 = enable。
function syncR3ColorUIEnable() {
    var isConfig3 = (currentPanelConfig === 3);
    ['slider-lumens', 'slider-track-lumens', 'slider-track-wide-lumens'].forEach(function(id) {
        setSliderEnabled(id, isConfig3);
    });
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
 * R3-5b：Cloud rod Lambertian 2-face emitter 單面 radiance W/(sr·m²)。
 * Φ_rod 均分 2 個等面積發光面（+Y 頂 + 外長側），各面 Lambertian Φ = π·A·L。
 * → L = (Φ_rod / 2) / (K(T) · π · A)。
 * 單位推導：Φ_rod [lm] → /K(T) [W]，再/(π·A) 得 W/(sr·m²)。
 */
function computeCloudRadiance(lm_total, kelvin, faceArea) {
    if (!Number.isFinite(lm_total) || lm_total <= 0) return 0;
    const K = kelvinToLuminousEfficacy(kelvin);
    const A = Math.max(faceArea, 1e-8);
    // R3-5b (2-face 甲案): Φ 平分 2 面（+Y top + outer long），同 Φ/(K·π·A) radiometric
    return (lm_total / 2) / (K * Math.PI * A);
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
 * R3-4 fix07：軌道投射燈 emitter radiance W/(sr·m²)。
 * 公式 L = Φ / (K · π · A)：lm→W 除 K(T)、Lambertian 等效除 π、除發光面積 A。
 * 量綱對齊 computeCloudRadiance（radiometric，直接餵 Reinhard tonemap）；
 * 舊版 Φ/(Ω · A) 實為 photometric cd/m²，誤餵 radiometric tonemap → ~1200× overshoot。
 * beam 形狀由 shader smoothstep(cos_outer, cos_inner, cos_ax) 承擔，不影響 radiance 量綱。
 * beamFullDeg 保留簽名避免 call-site churn；R3-5 MIS 升級時可併入 disk area 採樣契約。
 */
function computeTrackRadiance(lm, T_K, A_m2, beamFullDeg) {
    if (!Number.isFinite(lm) || lm <= 0) return 0;
    const K = kelvinToLuminousEfficacy(T_K);
    const A = Math.max(A_m2, 1e-8);
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

let wallAlbedo = 1.0;

// acousticPanelVisibility 已被 R2-8 Config 1/Config 2 切換取代

let bloomIntensity = 0.025;
// R2-UI：bloom pyramid 層數（Jimenez / Unreal / Blender Eevee），取代舊 radius slider
//   層數多 → halo 廣、柔；少 → halo 集中、窄
let bloomMipCount = 7;

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

        img.onmouseenter = function () {
            preview.src = snap.src;
            preview.style.display = 'block';
        };
        img.onmouseleave = function () {
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
    // R2-UI：瞬間清空累加 buffer，消除前視角殘影
    needClearAccumulation = true;

}

function initSceneData() {
    demoFragmentShaderFileName = 'Home_Studio_Fragment.glsl?v=' + Date.now();

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
    pathTracingUniforms.uIndirectMultiplier = { value: 1.7 };

    // R3-0 / R3-7：NEE 直接光補償（shader 10 處 `mask *= weight * uLegacyGain`）。
    // 同屬 erichlof 框架能量校準係數，R2-18 肉眼定案 1.5；與 uIndirectMultiplier 同為框架補償性質非物理值。
    pathTracingUniforms.uLegacyGain = { value: 1.5 };


    // ---- R3-1 emission pipeline（R3-3 起 Cloud 接通 emissive Lambertian）----
    pathTracingUniforms.uCloudEmission      = { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
    pathTracingUniforms.uTrackEmission      = { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
    pathTracingUniforms.uTrackWideEmission  = { value: [new THREE.Vector3(), new THREE.Vector3()] };
    pathTracingUniforms.uR3EmissionGate     = { value: 1.0 };   // R3-3 S3b：Cloud emissive 開，Track / TrackWide 仍為 0 向量故不發光
    // R3-3 fix01：Cloud hitObjectID 基準 = objectCount(0) + CLOUD_BOX_IDX_BASE(71) + 1 = 72（見 shader L516）
    pathTracingUniforms.uCloudObjIdBase     = { value: CLOUD_BOX_IDX_BASE + 1 };
    // R3-3：4 rod 單面面積 [0]=E [1]=W [2]=S [3]=N，供 R3-5 MIS area sampling 承接
    pathTracingUniforms.uCloudFaceArea      = { value: CLOUD_ROD_FACE_AREA.slice() };
    // R3-5b: Cloud NEE 2-face (甲案)
    pathTracingUniforms.uCloudRodCenter     = { value: CLOUD_ROD_CENTER.map(v => v.clone()) };
    pathTracingUniforms.uCloudRodHalfExtent = { value: CLOUD_ROD_HALF_EXTENT.map(v => v.clone()) };
    pathTracingUniforms.uCloudFaceCount     = { value: CLOUD_FACE_COUNT };
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
    // R3-6.5 post-verify：還原舊專案最後配置（tilt 南 +15°、北 -25°，雙燈朝外打，非對稱非對打）
    // 舊專案 L422-423：trackWideTiltSouth=15, trackWideTiltNorth=-25
    // 修正 R2-15 重建時誤設為對打（南朝北、北朝南），導致光線被 GIK 吸音板遮擋造成北牆陰影
    var _wideSinS = Math.sin( 15 * Math.PI / 180);
    var _wideCosS = Math.cos( 15 * Math.PI / 180);
    var _wideSinN = Math.sin(-25 * Math.PI / 180);
    var _wideCosN = Math.cos(-25 * Math.PI / 180);
    pathTracingUniforms.uTrackWideLampPos = { value: [
        new THREE.Vector3(0.0, 2.845,  2.100), // 南 (z=2.1)
        new THREE.Vector3(0.0, 2.845, -1.100)  // 北 (z=-1.1)
    ] };
    pathTracingUniforms.uTrackWideLampDir = { value: [
        new THREE.Vector3(0, -_wideCosS,  _wideSinS), // 南燈 +15° 朝南打（Z 正向）
        new THREE.Vector3(0, -_wideCosN,  _wideSinN)  // 北燈 -25° 朝北打（Z 負向）
    ] };

    // R3-6.5 Dynamic Light Pool uniforms
    pathTracingUniforms.uActiveLightCount = { value: 1 };
    pathTracingUniforms.uActiveLightIndex = { value: new Int32Array(ACTIVE_LIGHT_POOL_MAX).fill(ACTIVE_LIGHT_LUT_SENTINEL), type: 'iv' };
    pathTracingUniforms.uActiveLightIndex.value[0] = 0; // CONFIG 1 ceiling 獨佔

    pathTracingUniforms.uR3ProbeSentinel = { value: 1.0 }; // R3-6.5 S2.5 DCE debug-only sentinel（正常恆為 1.0；手動改 -200 觸發 DCE guard 活體驗證）

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
    // R3-5b throw-first: CLOUD_FACE_COUNT 三源契約（shader L1387 / NEE / JS 分母同值=2）
    if (!pathTracingUniforms.uCloudFaceCount) {
        throw new Error('[R3-5b] uCloudFaceCount uniform missing');
    }
    if (pathTracingUniforms.uCloudFaceCount.value !== CLOUD_FACE_COUNT) {
        throw new Error('[R3-5b] uCloudFaceCount mismatch: expected ' + CLOUD_FACE_COUNT + ', got ' + pathTracingUniforms.uCloudFaceCount.value);
    }
    if (!Array.isArray(pathTracingUniforms.uCloudRodCenter.value) || pathTracingUniforms.uCloudRodCenter.value.length !== 4) {
        throw new Error('[R3-5b] uCloudRodCenter must be 4-element Vector3 array');
    }
    if (!Array.isArray(pathTracingUniforms.uCloudRodHalfExtent.value) || pathTracingUniforms.uCloudRodHalfExtent.value.length !== 4) {
        throw new Error('[R3-5b] uCloudRodHalfExtent must be 4-element Vector3 array');
    }

    // R3-5b：Cloud rod Lambertian 2-face emitter。kelvinToRGB 回傳 sRGB，pow(,2.2) 轉 linear 給 path tracer。
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
        const radiance = computeTrackRadiance(
            trackLumens,
            trackKelvin[i],
            TRACK_LAMP_EMITTER_AREA,
            TRACK_BEAM_FULL_DEG
        );
        pathTracingUniforms.uTrackEmission.value[i].set(
            radiance * trackRLin,
            radiance * trackGLin,
            radiance * trackBLin
        );
        // beam 四盞共值（per-lamp 升級空間留 R3-5），重寫保 onChange 後 GPU 端同步
        pathTracingUniforms.uTrackBeamCos.value[i].set(TRACK_BEAM_COS_INNER, TRACK_BEAM_COS_OUTER);
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
        pathTracingUniforms.uTrackWideBeamCos.value[i].set(TRACK_WIDE_BEAM_COS_INNER, TRACK_WIDE_BEAM_COS_OUTER);
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
        cloudFaceCount: CLOUD_FACE_COUNT,
        neePoolSize: 11,
        selectPdf: (1/11).toFixed(4),
        cloudRodCenter: CLOUD_ROD_CENTER.map(v => ({ x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) })),
        cloudRodHalfExtent: CLOUD_ROD_HALF_EXTENT.map(v => ({ x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) })),
        trackMode: trackColorMode,
        trackKelvin: trackKelvin.slice(),
        trackLumens: trackLumens,
        trackBeamFullDeg: TRACK_BEAM_FULL_DEG,
        trackRadiance: trackRadianceDebug,
        trackLampIdBase: pathTracingUniforms.uTrackLampIdBase.value,
        trackWideKelvin: trackWideKelvin.slice(),
        trackWideLumens: trackWideLumens,
        trackWideBeamFullDeg: TRACK_WIDE_BEAM_FULL_DEG,
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
    } else if (config === 3) {
        // CONFIG 3：ceiling 撤場，依 checkbox gate 加入 track / wide / cloud slots
        if (trackOn) { lut[count++] = 1; lut[count++] = 2; lut[count++] = 3; lut[count++] = 4; }
        var wideSouthChk = document.getElementById('chkTrackWideSouth');
        var wideNorthChk = document.getElementById('chkTrackWideNorth');
        if (wideSouthChk && wideSouthChk.checked) { lut[count++] = 5; }
        if (wideNorthChk && wideNorthChk.checked) { lut[count++] = 6; }
        if (cloudOn) { lut[count++] = 7; lut[count++] = 8; lut[count++] = 9; lut[count++] = 10; }
    }

    pathTracingUniforms.uActiveLightCount.value = count;

    needClearAccumulation = true;
    cameraIsMoving = true;
    cameraSwitchFrames = 3;


    console.log('[R3-6.5] active pool rebuild', { count, LUT: Array.from(lut), source });
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
    createS('slider-pixel-res', '渲染解析度', 0.5, 2.0, 0.1, 1.0, function(v) {
        needChangePixelResolution = true;
        return v;
    }, false);

    createS('slider-bounces', '彈跳次數', 1, 14, 1, 4, function(v) {
        if (pathTracingUniforms && pathTracingUniforms.uMaxBounces) {
            pathTracingUniforms.uMaxBounces.value = v;
        }
        wakeRender();
        return v;
    });

    createS('slider-mult-a', '間接光補償', 0.1, 5.0, 0.1, 1.7, function(v) { 
        if (btnA && btnA.classList.contains('glow-white') && pathTracingUniforms.uIndirectMultiplier) pathTracingUniforms.uIndirectMultiplier.value = v;
        wakeRender(); return v; 
    });
    createS('slider-mult-b', '間接光補償', 0.1, 5.0, 0.1, 1.7, function(v) { 
        if (btnB && btnB.classList.contains('glow-white') && pathTracingUniforms.uIndirectMultiplier) pathTracingUniforms.uIndirectMultiplier.value = v;
        wakeRender(); return v; 
    });

    // A/B radio
    var btnA = document.getElementById('btnGroupA'), btnB = document.getElementById('btnGroupB');
    var ctrlA = document.getElementById('group-a-controls'), ctrlB = document.getElementById('group-b-controls');
    if (btnA) btnA.onclick = function() {
        btnA.className = 'action-btn glow-white'; btnB.className = 'action-btn';
        if (ctrlA) ctrlA.style.display = 'block';
        if (ctrlB) ctrlB.style.display = 'none';
        setSliderValue('slider-bounces', 8);
        if (pathTracingUniforms && pathTracingUniforms.uMaxBounces) pathTracingUniforms.uMaxBounces.value = 8;
        if (pathTracingUniforms && pathTracingUniforms.uIndirectMultiplier) pathTracingUniforms.uIndirectMultiplier.value = getSliderValue('slider-mult-a');
        wakeRender();
    };
    if (btnB) btnB.onclick = function() {
        btnB.className = 'action-btn glow-white'; btnA.className = 'action-btn';
        if (ctrlB) ctrlB.style.display = 'block';
        if (ctrlA) ctrlA.style.display = 'none';
        setSliderValue('slider-bounces', 4);
        if (pathTracingUniforms && pathTracingUniforms.uMaxBounces) pathTracingUniforms.uMaxBounces.value = 4;
        if (pathTracingUniforms && pathTracingUniforms.uIndirectMultiplier) pathTracingUniforms.uIndirectMultiplier.value = getSliderValue('slider-mult-b');
        wakeRender();
    };


    createS('slider-wall-albedo', '牆面反射率', 0.1, 1.0, 0.05, 1.0, function(v) { 
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
        wakeRender();
    };

    // Track checkbox
    var chkTrack = document.getElementById('chkTrack');
    if (chkTrack) chkTrack.onchange = function(e) {
        if (pathTracingUniforms && pathTracingUniforms.uTrackLightEnabled) {
            pathTracingUniforms.uTrackLightEnabled.value = e.target.checked ? 1.0 : 0.0;
        }
        rebuildActiveLightLUT('trackCheckbox');
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
        wakeRender();
    };

    // Cloud lumens
    createS('slider-lumens', '光通量 (lm/m)', 0, 4000, 1, 800, function(v) {
        CLOUD_ROD_LUMENS[0] = v * 2.4;
        CLOUD_ROD_LUMENS[1] = v * 2.4;
        CLOUD_ROD_LUMENS[2] = v * 1.768;
        CLOUD_ROD_LUMENS[3] = v * 1.768;
        computeLightEmissions();
        wakeRender();
        return v;
    });

    // Track lumens
    createS('slider-track-lumens', '光通量 (單盞)', 0, 3000, 50, 500, function(v) {
        trackLumens = v;
        computeLightEmissions();
        wakeRender();
        return v;
    });

    // Track sweet-spot sliders (R4-4 will wire real logic; R4-1 = wakeRender shell)
    createS('slider-track-beam-inner', '光束角(內)', 1, 90, 1, 30, function(v) { wakeRender(); return v; });
    createS('slider-track-beam-outer', '光束角(外)', 15, 90, 1, 55, function(v) { wakeRender(); return v; });
    createS('slider-track-tilt', '傾斜角', 0, 90, 1, 45, function(v) { wakeRender(); return v; });
    createS('slider-track-space', '間距 (cm)', 0, 180, 1, 150, function(v) { wakeRender(); return v; });
    createS('slider-track-x', '距Cloud邊距', 0.05, 0.90, 0.01, 0.05, function(v) { wakeRender(); return v; });

    // Wide lumens
    createS('slider-track-wide-lumens', '光通量 (單盞)', 0, 4000, 50, 2500, function(v) {
        trackWideLumens = v;
        computeLightEmissions();
        wakeRender();
        return v;
    });

    // Wide sweet-spot sliders
    createS('slider-track-wide-beam-inner', '廣角束角(內)', 10, 160, 1, 95, function(v) { wakeRender(); return v; });
    createS('slider-track-wide-beam-outer', '廣角束角(外)', 60, 160, 1, 120, function(v) { wakeRender(); return v; });
    createS('slider-track-wide-tilt-south', '南側傾斜角', -70, 70, 1, 15, function(v) { wakeRender(); return v; });
    createS('slider-track-wide-tilt-north', '北側傾斜角', -70, 70, 1, -25, function(v) { wakeRender(); return v; });
    createS('slider-track-wide-z', '距Cloud邊距', 0.10, 1.30, 0.01, 0.10, function(v) { wakeRender(); return v; });

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