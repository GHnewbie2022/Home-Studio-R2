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
addBox([-1.91, MIN_Y, -1.874], [1.91,  0.0, 3.056],  z3, C_FLOOR, 1);               // 0e 地面 Center（fix21：bmin.z→-1.874；fix23：bmax.z→3.056 對齊南牆內面與書櫃南端；N/S edge 依賴 0a/0c/0g/0i 覆蓋）
addBox([1.91,  MIN_Y, -1.874], [MAX_X, 0.0, 3.056],  z3, C_FLOOR, 1, 0, 1);         // 0f 地面 E edge
addBox([MIN_X, MIN_Y, 3.056],  [-1.91, 0.0, MAX_Z],  z3, C_FLOOR, 1, 0, 1);         // 0g 地面 SW corner
addBox([1.91,  MIN_Y, 3.056],  [MAX_X, 0.0, MAX_Z],  z3, C_FLOOR, 1, 0, 1);         // 0i 地面 SE corner
// 天花板 1 → 7 片 (fix14：Center z 延至 [MIN_Z, MAX_Z]，併入原 N/S edge)
addBox([MIN_X, 2.905, MIN_Z],  [-1.91, MAX_Y, -1.874], z3, C_WALL, 1, 0, 1);        // 1a 天花板 NW corner
addBox([1.91,  2.905, MIN_Z],  [MAX_X, MAX_Y, -1.874], z3, C_WALL, 1, 0, 1);        // 1c 天花板 NE corner
addBox([MIN_X, 2.905, -1.874], [-1.91, MAX_Y, 3.056],  z3, C_WALL, 1, 0, 1);        // 1d 天花板 W edge
addBox([-1.91, 2.905, -1.874], [1.91,  MAX_Y, 3.056],  z3, C_WALL, 1);              // 1e 天花板 Center（fix21：bmin.z→-1.874；fix23：bmax.z→3.056 對齊南牆內面；N/S edge 依賴 1a/1c/1g/1i 覆蓋）
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
addBox([-1.91, 0.0, 2.848], [-1.75, 2.905, 3.056], z3, C_BEAM, 1, 0, 2);            // 14 西南角柱（cullable=2：依相機方位動態透視；fix23：bmax.z 由 MAX_Z 縮至 3.056 對齊南牆內面）
addBox([1.78, 0.0, 2.49], [1.91, 2.905, 3.056], z3, C_BEAM, 1, 0, 2);               // 15 東南角柱（x 縮為純內凸 [1.78,1.91]，cullable=2；fix23：bmax.z 由 MAX_Z 縮至 3.056 對齊南牆內面）

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

// R2-17 Cloud 漫射燈條（4 支矩形長柱，type 14 CLOUD_LIGHT，emission=0 視覺幾何；真光源留 R3）
// 真實可見幾何依舊專案 line 514-515 type 9：1.6cm × 1.6cm × 240cm（非 SOP 誤抄之採樣體積 15×5cm）
// y 中心 2.795（底 2.787 貼死 Cloud 頂、頂 2.803）；fixtureGroup=4 受 uCloudLightEnabled 切換；cullable=1 隨 Cloud 板頂向剝離
addBox([ 0.884, 2.787, -0.702], [ 0.900, 2.803, 1.698], z3, C_CLOUD_LIGHT, 14, 0, 1, 4);  // 55 東燈條（沿 z 2.4m；舊專案 c=[0.892, 2.795, 0.498] s=[0.016, 0.016, 2.4]）
addBox([-0.900, 2.787, -0.702], [-0.884, 2.803, 1.698], z3, C_CLOUD_LIGHT, 14, 0, 1, 4);  // 56 西燈條
addBox([-0.884, 2.787,  1.682], [ 0.884, 2.803, 1.698], z3, C_CLOUD_LIGHT, 14, 0, 1, 4);  // 57 南燈條（沿 x 1.768m；比照東西短軸 1.6cm）
addBox([-0.884, 2.787, -0.702], [ 0.884, 2.803, -0.686], z3, C_CLOUD_LIGHT, 14, 0, 1, 4); // 58 北燈條

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
    // GUI checkbox 同步（若已建構）
    if (typeof trackLightState !== 'undefined' && trackLightState) {
        trackLightState.trackLight = cloudOn;
        if (trackLightCtrl && trackLightCtrl.updateDisplay) trackLightCtrl.updateDisplay();
    }
    if (typeof wideTrackLightState !== 'undefined' && wideTrackLightState) {
        wideTrackLightState.wideTrackLight = cloudOn;
        if (wideTrackLightCtrl && wideTrackLightCtrl.updateDisplay) wideTrackLightCtrl.updateDisplay();
    }
    currentPanelConfig = config;
    buildSceneBVH();
    needClearAccumulation = true;
    cameraIsMoving = true;
    cameraSwitchFrames = 3; // 讓 updateVariablesAndUniforms 持續 3 幀重置累積緩衝區
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
let samplesPerFrameController;

const CAMERA_PRESETS = {
    cam1: { position: { x: -1.115, y: 1.992, z: 3.310 }, pitch: -0.156, yaw: -0.290 },
    cam2: { position: { x: -0.9, y: 1.5, z: 3.4 }, pitch: 0.3, yaw: -0.25 },
    cam3: { position: { x: 0.0, y: 1.3, z: -1.0 }, pitch: 0.0, yaw: -Math.PI }
};
let currentCameraPreset = 'cam1';
let camPosXCtrl, camPosYCtrl, camPosZCtrl, camPitchCtrl, camYawCtrl;

let basicBrightness = 900.0;
// R2-18 fix24：軌道燈 checkbox 狀態與 controller 引用（供 applyPanelConfig 聯動更新）
let trackLightState = null, trackLightCtrl = null;
let wideTrackLightState = null, wideTrackLightCtrl = null;
let colorTemperature = 4000;
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
    // R2-UI：瞬間清空累加 buffer，消除前視角殘影
    needClearAccumulation = true;

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

    // R2-18 fix19：間接光倍率（1.0=原值，>1 提亮陰影區）；fix21 預設 1.7
    pathTracingUniforms.uIndirectMultiplier = { value: 1.7 };

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
    // pivot = 支架底 y=2.845；tilt 20° 朝房間中心方向傾
    // 形狀撈自舊專案 Path Tracking 260412a 5.4 Clarity.html
    var _wideSin = Math.sin(20 * Math.PI / 180);
    var _wideCos = Math.cos(20 * Math.PI / 180);
    pathTracingUniforms.uTrackWideLampPos = { value: [
        new THREE.Vector3(0.0, 2.845,  2.100), // 南 (z=2.1)
        new THREE.Vector3(0.0, 2.845, -1.100)  // 北 (z=-1.1)
    ] };
    pathTracingUniforms.uTrackWideLampDir = { value: [
        new THREE.Vector3(0, -_wideCos, -_wideSin), // 南燈向北（房中）傾
        new THREE.Vector3(0, -_wideCos,  _wideSin)  // 北燈向南（房中）傾
    ] };

    if (mouseControl) {
        setupGUI();
    }
}

// CMD (或 Ctrl) + 左鍵點擊滑桿即重設為預設值
function attachMetaClickReset(ctrl, defaultValue) {
    if (!ctrl || !ctrl.domElement) return ctrl;
    ctrl.domElement.addEventListener('mousedown', function (e) {
        if (!(e.metaKey || e.ctrlKey)) return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        ctrl.setValue(defaultValue);
    }, true);
    return ctrl;
}

// 強制重啟累加（即使已進入 1000 SPP 休眠也能即時刷新）
// 使用 sceneParamsChanged 讓 animate() 開頭清除 cameraIsMoving 後仍能重新觸發 restart
function wakeRender() {
    sceneParamsChanged = true;
}

function setupGUI() {
    const qualityObject = { samples_per_frame: 1.0 };
    samplesPerFrameController = gui.add(qualityObject, 'samples_per_frame', 1.0, 8.0, 1.0).onChange(function (value) {
        samplesPerFrame = value;
        pathTracingUniforms.uSamplesPerFrame.value = value;
    });
    attachMetaClickReset(samplesPerFrameController, 1.0);

    // R2-18 fix23：Scene Setup 收納 Acoustic Panels + Camera View，預設展開（max_bounces 移至 Light Settings）
    const setupFolder = gui.addFolder('Scene Setup');

    // R2-18 fix22：Config 3 = Cloud 6 片+燈條（天花板），與 Config 1/2 三者互斥
    const panelFolder = setupFolder.addFolder('Panels & Lights');
    var panelActions = {
        config1: function () { applyPanelConfig(1); },
        config2: function () { applyPanelConfig(2); },
        config3: function () { applyPanelConfig(3); }
    };
    panelFolder.add(panelActions, 'config1').name('Config 1 (牆3+吸頂燈)');
    panelFolder.add(panelActions, 'config2').name('Config 2 (牆9+吸頂燈)');
    panelFolder.add(panelActions, 'config3').name('Config 3 (牆9+雲6+漫射燈+軌道燈)');
    panelFolder.open();

    const cameraFolder = setupFolder.addFolder('Camera View');
    var camActions = {
        cam1: function () { switchCamera('cam1'); },
        cam2: function () { switchCamera('cam2'); },
        cam3: function () { switchCamera('cam3'); }
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

    // CMD+click reset（以 cam1 為預設基準）
    attachMetaClickReset(camPosXCtrl, CAMERA_PRESETS.cam1.position.x);
    attachMetaClickReset(camPosYCtrl, CAMERA_PRESETS.cam1.position.y);
    attachMetaClickReset(camPosZCtrl, CAMERA_PRESETS.cam1.position.z);
    attachMetaClickReset(camPitchCtrl, CAMERA_PRESETS.cam1.pitch);
    attachMetaClickReset(camYawCtrl, CAMERA_PRESETS.cam1.yaw);

    // R2-13 X-ray 透視剝離 toggle（預設開 = 自動透視：相機位於房外時同側牆面自動消隱）
    // checkbox 實為 debug override —— 取消勾選可強制顯示完整牆面（用於檢查牆體細節）
    // 沿用 wallAlbedo 同式：uniform 更新 + wakeRender() 即足。
    cameraFolder.add({ xray: true }, 'xray').name('X-ray 透視 (自動)').onChange(function (value) {
        if (pathTracingUniforms && pathTracingUniforms.uXrayEnabled) {
            pathTracingUniforms.uXrayEnabled.value = value ? 1.0 : 0.0;
        }
        console.log('[X-ray] onChange fired, value =', value, '→ uXrayEnabled =', value ? 1.0 : 0.0);
        wakeRender();
    });

    // R2-14 東西投射燈軌道 toggle（fixtureGroup=1）；fix24：預設 OFF，由 Config 3 聯動開
    trackLightState = { trackLight: false };
    trackLightCtrl = cameraFolder.add(trackLightState, 'trackLight').name('投射燈軌道 (東西)').onChange(function (value) {
        if (pathTracingUniforms && pathTracingUniforms.uTrackLightEnabled) {
            pathTracingUniforms.uTrackLightEnabled.value = value ? 1.0 : 0.0;
        }
        wakeRender();
    });

    // R2-15 南北廣角燈軌道 toggle（fixtureGroup=2）；fix24：預設 OFF，由 Config 3 聯動開
    wideTrackLightState = { wideTrackLight: false };
    wideTrackLightCtrl = cameraFolder.add(wideTrackLightState, 'wideTrackLight').name('廣角燈軌道 (南北)').onChange(function (value) {
        if (pathTracingUniforms && pathTracingUniforms.uWideTrackLightEnabled) {
            pathTracingUniforms.uWideTrackLightEnabled.value = value ? 1.0 : 0.0;
        }
        wakeRender();
    });

    // R2-18 fix22：Cloud 吸音板+燈條已整合為 Acoustic Panels Config 3，camera folder 不再重複出現

    cameraFolder.open();

    // Prevent GUI clicks from bubbling to body's pointer lock handler
    gui.domElement.addEventListener('click', function (e) { e.stopPropagation(); }, false);

    const lightFolder = gui.addFolder('Light Settings');
    lightFolder.close();

    const brightnessCtrl = lightFolder.add({ brightness: 900 }, 'brightness', 0, 4000, 1).onChange(function (value) {
        basicBrightness = value;
        wakeRender();
    });
    attachMetaClickReset(brightnessCtrl, 900);

    const colorTempCtrl = lightFolder.add({ colorTemp: 4000 }, 'colorTemp', 2700, 6500, 100).onChange(function (value) {
        colorTemperature = value;
        wakeRender();
    });
    attachMetaClickReset(colorTempCtrl, 4000);

    // R2-UI：最大反彈次數（1~14，預設 4），shader 內動態 break 控制實際 bounce 數
    const bouncesObject = { max_bounces: 4 };
    const bouncesCtrl = lightFolder.add(bouncesObject, 'max_bounces', 1, 14, 1).onChange(function (value) {
        if (pathTracingUniforms && pathTracingUniforms.uMaxBounces) {
            pathTracingUniforms.uMaxBounces.value = value;
        }
        wakeRender();
    });
    attachMetaClickReset(bouncesCtrl, 4);

    // R2-18 fix19：間接光倍率（>1 提亮陰影區，僅影響 indirect bounce）；fix21 預設 1.7 肉眼校準
    const indirectCtrl = lightFolder.add({ indirect: 1.7 }, 'indirect', 0.5, 3.0, 0.05).name('indirectMul').onChange(function (v) {
        pathTracingUniforms.uIndirectMultiplier.value = v; wakeRender();
    });
    attachMetaClickReset(indirectCtrl, 1.7);

    // R2-18 fix23：Material Settings UI 移除，所有 roughness/metalness/albedo 預設值已定案寫死於 uniform 初值

    const bloomFolder = gui.addFolder('Bloom');
    bloomFolder.close();

    const bloomIntensityCtrl = bloomFolder.add({ intensity: 0.025 }, 'intensity', 0.0, 1.0, 0.001).onChange(function (value) {
        bloomIntensity = value;
        if (screenOutputUniforms && screenOutputUniforms.uBloomIntensity) {
            screenOutputUniforms.uBloomIntensity.value = bloomIntensity;
        }
    });
    attachMetaClickReset(bloomIntensityCtrl, 0.025);

    // R2-UI: Bloom pyramid 層數（3~7）
    //   3 層：halo 集中，約 full-res ±32 px；7 層：halo 廣域，約 full-res ±512 px
    //   層數由 JS 端 truncate downsample/upsample chain 實現，無 shader 切換成本
    const bloomLayersCtrl = bloomFolder.add({ layers: 7 }, 'layers', 3, 7, 1).onChange(function (value) {
        bloomMipCount = value;
        window.bloomMipCount = value;
    });
    attachMetaClickReset(bloomLayersCtrl, 7);

    // R2-UI: Bloom debug checkbox — 勾選時直接顯示 bloom target（verify pipeline，全黑 = brightpass 砍光或 STEP 2.5 未跑）
    bloomFolder.add({ debug: false }, 'debug').onChange(function (value) {
        if (screenOutputUniforms && screenOutputUniforms.uBloomDebug) {
            screenOutputUniforms.uBloomDebug.value = value ? 1.0 : 0.0;
        }
    });

    // R2-18 fix23：Light / Bloom / Snapshot 三者預設折疊

    const snapshotFolder = gui.addFolder('Snapshot');
    snapshotFolder.close();

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