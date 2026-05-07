precision highp float;
precision highp int;
precision highp sampler2D;

#include <pathtracing_uniforms_and_defines>

// BVH data textures
uniform sampler2D tBVHTexture;
uniform sampler2D tBoxDataTexture;

// Textures
uniform sampler2D uWinTex;
uniform sampler2D u150F;
uniform sampler2D u150B;
uniform sampler2D uWoodDoorTex;
uniform sampler2D uIronDoorTex;
uniform sampler2D u750F;
uniform sampler2D u750B;
uniform sampler2D uGikGrayTex;
uniform sampler2D uGikWhiteTex;

// ISO-PUCK
uniform vec3 uPuckPositions[8];
uniform float uPuckRadius;
uniform float uPuckHalfH;

// R2-11 中央吸頂燈
uniform vec3 uLightEmission;
uniform vec3 uCeilingLampPos;
uniform float uCeilingLampRadius;
uniform float uCeilingLampHalfH;

uniform float uWallAlbedo; // R2-UI：結構表面反射率（地板/天花板/牆/樑/柱，陣列索引 0..31；fix19 修正原 1..15 漏蓋多數牆段之索引錯誤）
uniform float uMaxBounces; // R2-UI：最大反彈次數 1~14，runtime 可調，硬性編譯期上限 14
uniform sampler2D tBorrowTexture; // R6 LGG-r16 J3：1/8 res 14 彈借光 buffer，主 pass 在 terminal 採樣
uniform float uBorrowStrength;    // R6 LGG-r16 J3：借光強度 0~1，0=關（不跑借光 pass）
uniform float uIsBorrowPass;      // R6 LGG-r16 J3：1=當前 frame 是借光 pass，shader 跳過借光採樣避免遞迴

// R2-13 X-ray 透視剝離
uniform vec3 uCamPos;
uniform vec3 uRoomMin;
uniform vec3 uRoomMax;
uniform float uCullThreshold;
uniform float uCullEpsilon;
uniform float uXrayEnabled; // 0.0 = off, 1.0 = on

// R2-14 東西投射燈軌道（fixtureGroup=1）開關；關閉時 primary 與 secondary ray 皆跳過，自動無陰影
uniform float uTrackLightEnabled; // 0.0 = off, 1.0 = on

// R2-15 南北廣角燈軌道（fixtureGroup=2）開關
uniform float uWideTrackLightEnabled; // 0.0 = off, 1.0 = on

// R2-16 Cloud 吸音板（fixtureGroup=3）開關；關閉時 6 片 box 於 shader 層整體跳過，吸頂燈位置 JS 端聯動
uniform float uCloudPanelEnabled; // 0.0 = off, 1.0 = on

// R2-17 Cloud 漫射燈條（fixtureGroup=4）開關；4 支矩形長柱 emission=0 視覺幾何，真光源留 R3
uniform float uCloudLightEnabled; // 0.0 = off, 1.0 = on

// R2-18 Step 6 per-class roughness / metalness scale（三類金屬分離調控；非金屬不受影響）
uniform float uIronDoorRoughnessScale;
uniform float uIronDoorMetalnessScale;
uniform float uStandRoughnessScale;
uniform float uStandMetalnessScale;
uniform float uStandPillarRoughnessScale;
uniform float uStandPillarMetalnessScale;

// R2-18 Phase 2：軌道+燈具本體束包（TRACK 軌道、LAMP_SHELL 吸頂燈殼、CLOUD_LIGHT 燈條、投射/廣角燈頭）
uniform float uFixtureRoughness;
uniform float uFixtureMetalness;

// R2-18 fix17：地板磁磚（霧面磁磚，dielectric Fresnel + roughness blur）
uniform float uFloorRoughness;

// R2-18 fix19：間接光倍率（僅作用於 diffuseBounceMask 檢索路徑，不影響 direct NEE）
uniform float uIndirectMultiplier;

// R3-0：legacy gain（10 處 mask *= weight × magic 魔數集中管理；預設 1.5 維持 R2-18 亮度，為 R3-5 MIS 歸一做準備）
uniform float uLegacyGain;
// R3-6.5 S2：Dynamic light pool (LUT + count)。依 GUI 九個 emitter checkbox 即時重建 active 名單。
//   uActiveLightCount：有效光源數量（0..11）；0 時 sampleStochasticLightDynamic black-out 回退 nl。
//   uActiveLightIndex[11]：slot→real idx LUT（未用 slot 填 -1，僅前 count 個有效）。
uniform int uActiveLightCount;
uniform int uActiveLightIndex[11];
uniform float uR3ProbeSentinel;
uniform int uCloudVisibilityProbeMode;
uniform int uCloudVisibilityProbeRod;
uniform int uCloudVisibilityProbeClass;
uniform int uCloudVisibilityProbeThetaBin;
uniform int uCloudVisibilityProbeThetaBinCount;
uniform int uCloudThetaImportanceShaderABMode;
uniform int uCloudMisWeightProbeMode;
uniform int uCloudContributionProbeMode;
uniform float uCloudDarkSurfaceCleanupMode;
uniform float uCloudDarkSurfaceCleanupLuma;
uniform float uCloudSameSurfaceDarkFillMode;
uniform float uCloudSameSurfaceDarkFillStrength;
uniform float uCloudSameSurfaceDarkFillMaxSamples;
uniform float uCloudSameSurfaceDarkFillFloorLuma;
uniform float uCloudSameSurfaceDarkFillGikLuma;
uniform vec3 uCloudEmission[4];
uniform vec3 uTrackEmission[4];
uniform vec3 uTrackWideEmission[2];
uniform float uR3EmissionGate;   // R3-1 起預留；R3-3 S3b 翻 1.0
// R6-3 Phase 1C：Cloud rod analytic 1/4 arc emitter meta。
uniform float uCloudObjIdBase;   // R3-3 fix01：= objectCount(0) + CLOUD_BOX_IDX_BASE(71) + 1 = 72（sceneBoxes 陣列 index，非註解邏輯 ID）
uniform float uCloudFaceArea[4]; // [0]=E [1]=W [2]=S [3]=N，A_face = 0.016 × rodLength
uniform float uEmissiveClamp;    // R3-3 firefly clamp（median×30 估算；預設 50）
// 每 rod 存世界空間 center + 完整半邊 (halfX, halfY, halfZ)；NEE / hit 由此重建 1/4 圓弧面。
uniform vec3 uCloudRodCenter[4];
uniform vec3 uCloudRodHalfExtent[4];
// R3-4：Track spot lamp emitter meta（4 盞，hitType=TRACK_LIGHT）
uniform vec2 uTrackBeamCos[4];   // .x = cos(inner_half) ≈ 0.9659（15°）；.y = cos(outer_half) ≈ 0.8660（30°）；smoothstep 邊界 edge0=.y、edge1=.x
uniform float uTrackLampIdBase;  // R3-4 fix01：= objectCount(0) + 400 = 400（pre-bake objectCount，仿 R3-3 uCloudObjIdBase pattern；CalculateRadiance 無 objectCount 區域變數可見）；JS 端 TRACK_LAMP_ID_BASE 同步契約，throw-first assertion 守門
// R3-5a：TrackWide 廣角燈 emitter meta（2 盞，hitType=TRACK_WIDE_LIGHT；複用 R3-4 Option A' pattern）
uniform vec2 uTrackWideBeamCos[2];   // .x = cos(inner_half) ≈ 0.5736（55°）；.y = cos(outer_half) = 0.5（60°）；smoothstep 邊緣軟於 spot（全角 120°）
uniform float uTrackWideLampIdBase;  // = 700（pre-bake，避開 400 spot / 500 wide housing / 600 spot housing）；JS 端 TRACK_WIDE_LAMP_ID_BASE 同步契約

// R2-14 投射燈頭（4 盞傾斜圓柱；pivot 位於支架底，半徑 3cm、長 13.5cm；與 uTrackLightEnabled 共開關）
uniform vec3 uTrackLampPos[4];
uniform vec3 uTrackLampDir[4];

// R2-15 廣角燈頭（2 盞矮胖圓柱；pivot 位於支架底 y=2.845，半徑 5cm、長 7.2cm；與 uWideTrackLightEnabled 共開關）
// 形狀撈自舊專案 Path Tracking 260412a 5.4 Clarity.html：半徑 0.05m、長度 0.072m，比 R2-14 投射燈矮胖
uniform vec3 uTrackWideLampPos[2];
uniform vec3 uTrackWideLampDir[2];

int primaryRay = 1; // 僅 bounces==0 為 1，其餘為 0

#define BACKDROP 5
#define SPEAKER 6
#define WOOD_DOOR 7
#define IRON_DOOR 8
#define SUBWOOFER 9
#define ACOUSTIC_PANEL 10
#define OUTLET 11
#define LAMP_SHELL 12
#define TRACK 13
#define CLOUD_LIGHT 14 // R6-3 Phase 1C Cloud analytic 1/4 arc emitter
#define TRACK_LIGHT 15 // R3-4 軌道投射燈 emitter 圓柱（hitType-only branch，emissive primary/specular accumulation；與 TRACK=13 軌道鋁槽 box 分家）
#define TRACK_WIDE_LIGHT 16 // R3-5a 軌道廣角燈 emitter 圓盤（pattern 同 TRACK_LIGHT，全角 120° 軟邊 smoothstep gate；與 TRACK=13/TRACK_LIGHT=15 分家）
// R3-4 fix07：發光圓盤面積（disk-area NEE integrand 需乘此常數，對齊 L = Φ/(K·π·A) radiance 量綱契約）
// 雙源同步契約：與 js/Home_Studio.js TRACK_LAMP_EMITTER_AREA = Math.PI * 0.03² 值一致（≈ 2.8274e-3 m²）
const float TRACK_LAMP_EMITTER_AREA = PI * 0.03 * 0.03;
// R3-5a：廣角燈發光圓盤面積（r=5cm）；雙源同步契約與 js/Home_Studio.js TRACK_WIDE_LAMP_EMITTER_AREA = Math.PI * 0.05² 值一致（≈ 7.8540e-3 m²）
const float TRACK_WIDE_LAMP_EMITTER_AREA = PI * 0.05 * 0.05;

// R2-6 旋轉物件逆矩陣
uniform mat4 uLeftSpeakerInvMatrix;
uniform mat4 uLeftStandBaseInvMatrix;
uniform mat4 uLeftStandPillarInvMatrix;
uniform mat4 uLeftStandTopInvMatrix;
uniform mat4 uRightSpeakerInvMatrix;
uniform mat4 uRightStandBaseInvMatrix;
uniform mat4 uRightStandPillarInvMatrix;
uniform mat4 uRightStandTopInvMatrix;

// R2-6 物件空間 AABB（half-size，中心在原點）
#define N_ROTATED 8
const vec3 rotHalf[N_ROTATED] = vec3[N_ROTATED](
    vec3(0.1125, 0.1725, 0.1365),  // 左喇叭
    vec3(0.125,  0.015,  0.15),    // 左底座
    vec3(0.02,   0.43,   0.05),    // 左支柱
    vec3(0.10,   0.01,   0.125),   // 左頂板
    vec3(0.1125, 0.1725, 0.1365),  // 右喇叭
    vec3(0.125,  0.015,  0.15),    // 右底座
    vec3(0.02,   0.43,   0.05),    // 右支柱
    vec3(0.10,   0.01,   0.125)    // 右頂板
);
const vec3 rotColor[N_ROTATED] = vec3[N_ROTATED](
    vec3(0.12, 0.12, 0.12),       // C_SPEAKER
    vec3(0.08, 0.08, 0.08),       // C_STAND
    vec3(0.80, 0.82, 0.85),       // C_STAND_PILLAR
    vec3(0.08, 0.08, 0.08),       // C_STAND
    vec3(0.12, 0.12, 0.12),       // C_SPEAKER
    vec3(0.08, 0.08, 0.08),       // C_STAND
    vec3(0.80, 0.82, 0.85),       // C_STAND_PILLAR
    vec3(0.08, 0.08, 0.08)        // C_STAND
);
// R2-18 旋轉物件材質（SPEAKER 走 type 分支不依此；C_STAND / C_STAND_PILLAR 為金屬）
const float rotRoughness[N_ROTATED] = float[N_ROTATED](
    0.4,  // 左喇叭 SPEAKER
    0.2,  // 左底座 C_STAND（金屬亮黑漆）
    0.55, // 左支柱 C_STAND_PILLAR（霧面鋁）
    0.2,  // 左頂板 C_STAND
    0.4,  // 右喇叭 SPEAKER
    0.2,  // 右底座 C_STAND
    0.55, // 右支柱 C_STAND_PILLAR
    0.2   // 右頂板 C_STAND
);
const float rotMetalness[N_ROTATED] = float[N_ROTATED](
    0.0,  // 喇叭非金屬
    1.0,  // C_STAND 金屬
    1.0,  // C_STAND_PILLAR 金屬
    1.0,
    0.0,
    1.0,
    1.0,
    1.0
);

vec3 rayOrigin, rayDirection;
vec3 hitNormal, hitEmission, hitColor;
vec3 hitBoxMin, hitBoxMax;
vec3 hitObjNormal;  // 旋轉物件的物件空間法向量
vec3 hitObjPos;     // 旋轉物件的物件空間命中點
vec3 hitObjHalf;    // 旋轉物件的 half-size
vec2 hitUV;
float hitObjectID;
int hitType = -100;
float hitMeta;
// R2-18 命中材質
float hitRoughness;
float hitMetalness;

struct Quad { vec3 normal; vec3 v0; vec3 v1; vec3 v2; vec3 v3; vec3 emission; vec3 color; int type; };

Quad ceilingLampQuad; // R2-11 向下矩形光 importance sampling PDF 目標（不加入幾何）

#include <pathtracing_random_functions>

#include <pathtracing_box_intersect>

#include <pathtracing_box_interior_intersect>

#include <pathtracing_boundingbox_intersect>

#include <pathtracing_sample_quad_light>

// R3-6：MIS Phase-1 helpers（power heuristic β=2；Veach 1997 thesis §9.2.4）
// scope：ceiling quadLight (NEE pool idx 0) + Cloud 4 rod (idx 7-10) = 5 DIFF-emitters
// Track/Wide 6 盞（idx 1-6）BSDF-hit 維持 R3-5b `bounceIsSpecular == TRUE` 直接累加，不套 MIS（避 cone 外能量洩漏）。
// 使用 p*p（非 pow(p, 2.0)）：Apple-M / Mesa fp32 pow 走 exp2(log2(x)*2) ~1 ULP 精度損失；p*p 單指令 fma <0.5 ULP。
float misPowerWeight(float p1, float p2)
{
	float p1sq = p1 * p1;
	float p2sq = p2 * p2;
	float denom = p1sq + p2sq;
	if (denom < 1e-12) return 0.5; // p1 = p2 = 0 特判（S3 pre-mortem）
	return p1sq / denom;
}
float cosWeightedPdf(vec3 dir, vec3 normal)
{
	// Lambertian 於 direction 之 solid-angle PDF = cos(θ) / π（θ 為與 normal 夾角）
	return max(0.0, dot(dir, normal)) * ONE_OVER_PI;
}
vec3 cloudMisWeightProbeDirectNee(float wNee, float pNee, float pBsdf)
{
	if (uCloudMisWeightProbeMode == 1)
		return vec3(wNee, 1.0, 0.0);
	if (uCloudMisWeightProbeMode == 2)
		return vec3(pNee, pBsdf, 1.0);
	return vec3(0.0);
}
vec3 cloudMisWeightProbeBsdfHit(float wBsdf, float pBsdf, float pNeeReverse)
{
	if (uCloudMisWeightProbeMode == 3)
		return vec3(wBsdf, 1.0, 0.0);
	if (uCloudMisWeightProbeMode == 4)
		return vec3(pNeeReverse, pBsdf, 1.0);
	return vec3(0.0);
}
float cloudMisProbeLuma(vec3 c)
{
	return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
vec3 cloudMisWeightProbeContribution(vec3 weightedContribution, vec3 unweightedContribution)
{
	return vec3(cloudMisProbeLuma(weightedContribution), 1.0, cloudMisProbeLuma(unweightedContribution));
}
vec3 cloudMisWeightProbeBsdfHitContributionSentinel()
{
	return vec3(0.125, 1.0, 0.5);
}
vec3 cloudMisWeightProbeUniformSentinel()
{
	return vec3(0.25, 1.0, 0.75);
}
vec3 cloudMisWeightProbeContributionUniformSentinel()
{
	return (uCloudContributionProbeMode == 3) ? vec3(0.375, 1.0, 0.875) : vec3(0.625, 1.0, 0.125);
}
bool cloudDirectNeeSourceIsFloor(int sourceHitType, float sourceObjectID, vec3 sourceNormal, vec3 sourcePosition)
{
	return sourceObjectID < 1.5 && sourceNormal.y > 0.5 && sourcePosition.y < 0.1;
}
bool cloudDirectNeeSourceIsGik(int sourceHitType)
{
	return sourceHitType == ACOUSTIC_PANEL;
}
bool cloudDirectNeeSourceIsCeiling(int sourceHitType, float sourceObjectID, vec3 sourceNormal, vec3 sourcePosition)
{
	return sourceObjectID < 1.5 && sourceNormal.y < -0.5 && sourcePosition.y > 2.8;
}
bool cloudDirectNeeSourceIsWall(int sourceHitType, float sourceObjectID, vec3 sourceNormal)
{
	return sourceObjectID < 1.5 && abs(sourceNormal.y) <= 0.5;
}
bool cloudVisibleSurfaceIsFloor(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return cloudDirectNeeSourceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
}
bool cloudVisibleSurfaceIsGik(int visibleHitType)
{
	return cloudDirectNeeSourceIsGik(visibleHitType);
}
bool cloudVisibleSurfaceIsCeiling(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return cloudDirectNeeSourceIsCeiling(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
}
bool cloudVisibleSurfaceIsWall(int visibleHitType, float visibleObjectID, vec3 visibleNormal)
{
	return cloudDirectNeeSourceIsWall(visibleHitType, visibleObjectID, visibleNormal);
}
bool cloudVisibleSurfaceIsObject(int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	return !cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		!cloudVisibleSurfaceIsGik(visibleHitType) &&
		!cloudVisibleSurfaceIsCeiling(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) &&
		!cloudVisibleSurfaceIsWall(visibleHitType, visibleObjectID, visibleNormal);
}
bool cloudVisibleSurfaceProbeModeMatches(int mode, int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition)
{
	if (mode == 12 || mode == 17) return cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	if (mode == 13 || mode == 18) return cloudVisibleSurfaceIsGik(visibleHitType);
	if (mode == 14 || mode == 19) return cloudVisibleSurfaceIsCeiling(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	if (mode == 15 || mode == 20) return cloudVisibleSurfaceIsWall(visibleHitType, visibleObjectID, visibleNormal);
	if (mode == 16 || mode == 21) return cloudVisibleSurfaceIsObject(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	return false;
}
bool cloudDarkVisibleSurfaceSourceProbeModeMatches(int mode, int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, int sourceHitType, float sourceObjectID, vec3 sourceNormal, vec3 sourcePosition)
{
	bool visibleFloor = cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	bool visibleGik = cloudVisibleSurfaceIsGik(visibleHitType);
	bool sourceFloor = cloudDirectNeeSourceIsFloor(sourceHitType, sourceObjectID, sourceNormal, sourcePosition);
	bool sourceGik = cloudDirectNeeSourceIsGik(sourceHitType);
	bool sourceCeiling = cloudDirectNeeSourceIsCeiling(sourceHitType, sourceObjectID, sourceNormal, sourcePosition);
	bool sourceWall = cloudDirectNeeSourceIsWall(sourceHitType, sourceObjectID, sourceNormal);
	bool sourceObject = !sourceFloor && !sourceGik && !sourceCeiling && !sourceWall;
	if (mode == 22) return visibleFloor && sourceFloor;
	if (mode == 23) return visibleFloor && sourceGik;
	if (mode == 24) return visibleFloor && sourceCeiling;
	if (mode == 25) return visibleFloor && sourceWall;
	if (mode == 26) return visibleFloor && sourceObject;
	if (mode == 27) return visibleGik && sourceFloor;
	if (mode == 28) return visibleGik && sourceGik;
	if (mode == 29) return visibleGik && sourceCeiling;
	if (mode == 30) return visibleGik && sourceWall;
	if (mode == 31) return visibleGik && sourceObject;
	return false;
}
vec3 cloudDarkVisibleSurfaceCleanupContribution(vec3 contribution, int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, int sourceHitType, float sourceObjectID, vec3 sourceNormal, vec3 sourcePosition)
{
	if (uCloudDarkSurfaceCleanupMode < 0.5) return contribution;
	bool visibleDarkSurface = cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition) || cloudVisibleSurfaceIsGik(visibleHitType);
	bool strongBouncedSource = cloudDirectNeeSourceIsCeiling(sourceHitType, sourceObjectID, sourceNormal, sourcePosition) || cloudDirectNeeSourceIsWall(sourceHitType, sourceObjectID, sourceNormal);
	if (!visibleDarkSurface || !strongBouncedSource) return contribution;
	float cap = max(0.0, uCloudDarkSurfaceCleanupLuma);
	if (cap <= 0.0) return contribution;
	float luma = cloudMisProbeLuma(contribution);
	if (luma <= cap || luma <= 1e-9) return contribution;
	return contribution * (cap / luma);
}
vec3 cloudSameSurfaceDarkFillContribution(vec3 contribution, int visibleHitType, float visibleObjectID, vec3 visibleNormal, vec3 visiblePosition, int diffuseCountArg)
{
	if (uCloudSameSurfaceDarkFillMode < 0.5) return contribution;
	if (diffuseCountArg < 1) return contribution;
	bool visibleFloor = cloudVisibleSurfaceIsFloor(visibleHitType, visibleObjectID, visibleNormal, visiblePosition);
	bool visibleGik = cloudVisibleSurfaceIsGik(visibleHitType);
	if (!visibleFloor && !visibleGik) return contribution;
	float targetLuma = (visibleFloor ? uCloudSameSurfaceDarkFillFloorLuma : uCloudSameSurfaceDarkFillGikLuma) * 1.25;
	if (targetLuma <= 0.0) return contribution;
	float luma = cloudMisProbeLuma(contribution);
	if (luma <= 1e-9 || luma >= targetLuma) return contribution;
	float maxSamples = max(1.0, uCloudSameSurfaceDarkFillMaxSamples);
	float fadeSamples = max(1.0, maxSamples);
	float sampleFade = 1.0 - smoothstep(maxSamples, maxSamples + fadeSamples, uSampleCounter);
	float fillStrength = clamp(uCloudSameSurfaceDarkFillStrength, 0.0, 1.0) * sampleFade;
	if (fillStrength <= 0.0) return contribution;
	float filledLuma = mix(luma, targetLuma, fillStrength);
	return contribution * (filledLuma / luma);
}
bool cloudMisWeightProbeForcedBsdfHit(vec3 x, vec3 nl, vec3 sourceMask, out vec3 encoded)
;
float pdfNeeForLight(vec3 x, vec3 lightPoint, vec3 lightNormal, float lightArea, float selectPdfArg)
{
	// 給定 shade-point x 與 emitter 表面樣本 (lightPoint, lightNormal, lightArea)，
	// 回傳 uniform light-pick (selectPdfArg) 下的 solid-angle PDF。
	//   p_ω = selectPdfArg · dist² / (cos_light · A_face)
	// R3-6.5 S2：selectPdfArg 由 caller 傳入──legacy 11-pick 傳 1.0/11.0；dynamic pool 傳 1.0/uActiveLightCount。
	// U4：lightArea / cosLight 加 1e-6 / 1e-12 denom 守門防 NaN / Inf。
	vec3 toLight = lightPoint - x;
	float dist2 = max(dot(toLight, toLight), 1e-4);
	float cosLight = max(1e-6, dot(-normalize(toLight), lightNormal));
	float safeArea = max(lightArea, 1e-6);
	return selectPdfArg * (dist2 / (cosLight * safeArea));
}
// R6-3 Phase 1C：Cloud 鋁槽 1/4 圓弧 diffuser。
// 16mm × 16mm 外接正方形對應完整 1/4 pizza，發光弧面半徑 16mm。
// uCloudFaceArea = 0.016 × rodLength；真實弧面 A_arc = (π/2) × uCloudFaceArea。
const float CLOUD_ARC_RADIUS = 0.016;
const float CLOUD_ARC_AREA_SCALE = 1.5707963267948966;
const float CLOUD_ARC_THETA_MAX = 1.5707963267948966;
const float CLOUD_THETA_IMPORTANCE_SHADER_AB_PROTECTED_FLOOR = 0.5;
const float CLOUD_THETA_IMPORTANCE_UNIFORM_BIN_PDF = 0.125;

vec3 cloudOutAxis(int rodIdx)
{
	if (rodIdx == 0) return vec3( 1.0, 0.0, 0.0);
	if (rodIdx == 1) return vec3(-1.0, 0.0, 0.0);
	if (rodIdx == 2) return vec3( 0.0, 0.0, 1.0);
	return vec3(0.0, 0.0, -1.0);
}

vec3 cloudLongAxis(int rodIdx)
{
	return (rodIdx < 2) ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
}

float cloudLongHalf(int rodIdx, vec3 rodHalf)
{
	return (rodIdx < 2) ? rodHalf.z : rodHalf.x;
}

float cloudCrossHalf(int rodIdx, vec3 rodHalf)
{
	return (rodIdx < 2) ? rodHalf.x : rodHalf.z;
}

float cloudArcRadius(int rodIdx, vec3 rodHalf)
{
	return max(CLOUD_ARC_RADIUS, cloudCrossHalf(rodIdx, rodHalf) + rodHalf.y);
}

vec3 cloudArcCenter(int rodIdx, vec3 rodCenter, vec3 rodHalf)
{
	return rodCenter - cloudOutAxis(rodIdx) * cloudCrossHalf(rodIdx, rodHalf) - vec3(0.0, rodHalf.y, 0.0);
}

vec3 cloudArcNormal(int rodIdx, float theta)
{
	return normalize(cloudOutAxis(rodIdx) * cos(theta) + vec3(0.0, sin(theta), 0.0));
}

vec3 cloudArcEmissionNormal(int rodIdx, float theta)
{
	return -cloudArcNormal(rodIdx, theta);
}

vec3 cloudArcRenderNormal(int rodIdx, float theta)
{
	return (uCloudVisibilityProbeMode > 0) ? cloudArcEmissionNormal(rodIdx, theta) : cloudArcNormal(rodIdx, theta);
}

int cloudVisibilityProbeThetaBin(float theta)
{
	int binCount = max(uCloudVisibilityProbeThetaBinCount, 1);
	float theta01 = clamp(theta / CLOUD_ARC_THETA_MAX, 0.0, 0.999999);
	return int(floor(theta01 * float(binCount)));
}

float cloudThetaImportancePdfForBin(int thetaBin)
{
	int bin = clamp(thetaBin, 0, 7);
	if (bin == 0) return 0.182214;
	if (bin == 1) return 0.164555;
	if (bin == 2) return 0.139731;
	if (bin == 3) return 0.124376;
	if (bin == 4) return 0.108893;
	if (bin == 5) return 0.094690;
	if (bin == 6) return 0.091107;
	return 0.094434;
}

float cloudThetaImportancePdfCompensationForBin(int thetaBin)
{
	return CLOUD_THETA_IMPORTANCE_UNIFORM_BIN_PDF / max(cloudThetaImportancePdfForBin(thetaBin), 1e-6);
}

float cloudThetaImportanceSampleTheta(float u, out int thetaBin, out float pdfCompensationMultiplier)
{
	float x = clamp(u, 0.0, 0.999999);
	float prev = 0.0;
	float next = 0.182214;
	thetaBin = 0;
	if (x >= next) { prev = next; next = 0.346769; thetaBin = 1; }
	if (x >= next) { prev = next; next = 0.486500; thetaBin = 2; }
	if (x >= next) { prev = next; next = 0.610876; thetaBin = 3; }
	if (x >= next) { prev = next; next = 0.719769; thetaBin = 4; }
	if (x >= next) { prev = next; next = 0.814459; thetaBin = 5; }
	if (x >= next) { prev = next; next = 0.905566; thetaBin = 6; }
	if (x >= next) { prev = next; next = 1.0; thetaBin = 7; }
	float binPdf = max(next - prev, 1e-6);
	float localU = clamp((x - prev) / binPdf, 0.0, 0.999999);
	pdfCompensationMultiplier = cloudThetaImportancePdfCompensationForBin(thetaBin);
	return (float(thetaBin) + localU) * (CLOUD_ARC_THETA_MAX * CLOUD_THETA_IMPORTANCE_UNIFORM_BIN_PDF);
}

int cloudThetaImportanceBinFromNormal(int rodIdx, vec3 normal)
{
	vec3 outAxis = cloudOutAxis(rodIdx);
	float outPart = max(0.0, dot(normalize(normal), outAxis));
	float upPart = max(0.0, normalize(normal).y);
	float theta = clamp(atan(upPart, outPart), 0.0, CLOUD_ARC_THETA_MAX * 0.999999);
	return int(floor(clamp(theta / CLOUD_ARC_THETA_MAX, 0.0, 0.999999) * 8.0));
}

float cloudThetaImportanceEffectiveArcArea(float cloudArcArea, float pdfCompensationMultiplier)
{
	if (uCloudThetaImportanceShaderABMode <= 0)
		return cloudArcArea;
	return cloudArcArea * pdfCompensationMultiplier;
}

float cloudThetaImportanceEffectiveArcAreaForNormal(int rodIdx, float cloudArcArea, vec3 normal)
{
	if (uCloudThetaImportanceShaderABMode <= 0)
		return cloudArcArea;
	int thetaBin = cloudThetaImportanceBinFromNormal(rodIdx, normal);
	return cloudArcArea * cloudThetaImportancePdfCompensationForBin(thetaBin);
}

bool cloudMisWeightProbeForcedBsdfHit(vec3 x, vec3 nl, vec3 sourceMask, out vec3 encoded)
{
	encoded = vec3(0.0);
	if (uCloudMisWeightProbeMode < 10 || uCloudMisWeightProbeMode > 13)
		return false;
	if (uCloudLightEnabled < 0.5 || uActiveLightCount <= 0)
		return true;

	float bestScore = 0.0;
	int bestRod = -1;
	vec3 bestTarget = vec3(0.0);
	vec3 bestNormal = vec3(0.0);
	vec3 bestDir = vec3(0.0);

	for (int rodIdx = 0; rodIdx < 4; rodIdx++)
	{
		vec3 rodCenter = uCloudRodCenter[rodIdx];
		vec3 rodHalf = uCloudRodHalfExtent[rodIdx];
		vec3 arcCenter = cloudArcCenter(rodIdx, rodCenter, rodHalf);
		vec3 longAxis = cloudLongAxis(rodIdx);
		float radius = cloudArcRadius(rodIdx, rodHalf);
		float theta = CLOUD_ARC_THETA_MAX * 0.5;
		vec3 localNormal = cloudArcNormal(rodIdx, theta);
		vec3 target = arcCenter + longAxis * 0.0 + localNormal * radius;
		vec3 toCloud = target - x;
		float dist2 = max(dot(toCloud, toCloud), 1e-4);
		vec3 dir = toCloud * inversesqrt(dist2);
		float sourceCos = max(0.0, dot(nl, dir));
		float cloudCos = max(0.0, dot(-dir, localNormal));
		float score = sourceCos * cloudCos / dist2;
		if (score > bestScore)
		{
			bestScore = score;
			bestRod = rodIdx;
			bestTarget = target;
			bestNormal = localNormal;
			bestDir = dir;
		}
	}

	if (bestRod < 0 || bestScore <= 1e-10)
		return true;

	float cloudArcArea = uCloudFaceArea[bestRod] * CLOUD_ARC_AREA_SCALE;
	float reverseCloudPdfArea = cloudThetaImportanceEffectiveArcAreaForNormal(bestRod, cloudArcArea, bestNormal);
	float pBsdf = cosWeightedPdf(bestDir, nl);
	float pNeeReverse = pdfNeeForLight(x, bestTarget, bestNormal, reverseCloudPdfArea, 1.0 / float(uActiveLightCount));
	float wBsdf = misPowerWeight(pBsdf, pNeeReverse);
	vec3 emission = min(uCloudEmission[bestRod], vec3(uEmissiveClamp));
	vec3 weightedContribution = min(sourceMask * emission * wBsdf, vec3(uEmissiveClamp));
	vec3 unweightedContribution = min(sourceMask * emission, vec3(uEmissiveClamp));

	if (uCloudMisWeightProbeMode == 10)
		encoded = cloudMisWeightProbeBsdfHitContributionSentinel();
	if (uCloudMisWeightProbeMode == 11)
		encoded = cloudMisWeightProbeContribution(weightedContribution, unweightedContribution);
	if (uCloudMisWeightProbeMode == 12)
		encoded = vec3(pNeeReverse, pBsdf, 1.0);
	if (uCloudMisWeightProbeMode == 13)
		encoded = vec3(wBsdf, 1.0, 0.0);
	return true;
}

bool cloudVisibilityProbeThetaBinMatches(int thetaBin)
{
	if (uCloudVisibilityProbeThetaBin < 0)
		return true;
	int binCount = max(uCloudVisibilityProbeThetaBinCount, 1);
	int selectedBin = clamp(uCloudVisibilityProbeThetaBin, 0, binCount - 1);
	return thetaBin == selectedBin;
}

float CloudArcIntersect(int rodIdx, vec3 ro, vec3 rd, out vec3 normal)
{
	vec3 rodCenter = uCloudRodCenter[rodIdx];
	vec3 rodHalf = uCloudRodHalfExtent[rodIdx];
	vec3 outAxis = cloudOutAxis(rodIdx);
	vec3 longAxis = cloudLongAxis(rodIdx);
	vec3 arcCenter = cloudArcCenter(rodIdx, rodCenter, rodHalf);
	float radius = cloudArcRadius(rodIdx, rodHalf);
	float longHalf = cloudLongHalf(rodIdx, rodHalf);

	vec3 oc = ro - arcCenter;
	float ou = dot(oc, outAxis);
	float ov = oc.y;
	float du = dot(rd, outAxis);
	float dv = rd.y;
	float a = du * du + dv * dv;
	if (a < 1e-10) return INFINITY;
	float b = 2.0 * (ou * du + ov * dv);
	float c = ou * ou + ov * ov - radius * radius;
	float disc = b * b - 4.0 * a * c;
	if (disc < 0.0) return INFINITY;

	float sq = sqrt(disc);
	float bestT = INFINITY;
	for (int i = 0; i < 2; i++)
	{
		float tCand = (i == 0) ? ((-b - sq) / (2.0 * a)) : ((-b + sq) / (2.0 * a));
		if (tCand > 0.0 && tCand < bestT)
		{
			vec3 hit = oc + rd * tCand;
			float longCoord = dot(hit, longAxis);
			float outCoord = dot(hit, outAxis);
			float upCoord = hit.y;
			if (abs(longCoord) <= longHalf && outCoord >= -1e-5 && upCoord >= -1e-5)
			{
				bestT = tCand;
				normal = normalize(outAxis * outCoord + vec3(0.0, upCoord, 0.0));
			}
		}
	}
	return bestT;
}

bool cloudVisibilityProbeMatches(int pickedIdx)
{
	if (uCloudVisibilityProbeMode <= 0)
		return false;
	if (pickedIdx < 7 || pickedIdx > 10)
		return false;
	int rodIdx = pickedIdx - 7;
	return (uCloudVisibilityProbeRod < 0 || uCloudVisibilityProbeRod == rodIdx);
}

bool cloudVisibilityProbeHasContribution(vec3 eventMask)
{
	return max(max(eventMask.r, eventMask.g), eventMask.b) > 1e-7;
}

vec3 cloudVisibilityProbeVisibleColor(int pickedIdx, vec3 eventMask)
{
	int rodIdx = clamp(pickedIdx - 7, 0, 3);
	float rodCue = (float(rodIdx) + 1.0) * 0.18;
	float contributionCue = clamp(log(1.0 + max(max(eventMask.r, eventMask.g), eventMask.b)) * 0.25, 0.0, 0.25);
	return vec3(0.0, 1.0, rodCue + contributionCue);
}

vec3 cloudVisibilityProbeBlockedColor(int pickedIdx)
{
	int rodIdx = clamp(pickedIdx - 7, 0, 3);
	float rodCue = (float(rodIdx) + 1.0) * 0.18;
	return vec3(1.0, 0.0, rodCue);
}

const int CLOUD_PROBE_CLASS_ZERO_CONTRIBUTION = 0;
const int CLOUD_PROBE_CLASS_VISIBLE = 1;
const int CLOUD_PROBE_CLASS_WRONG_CLOUD_ROD = 2;
const int CLOUD_PROBE_CLASS_CLOUD_ALUMINIUM = 3;
const int CLOUD_PROBE_CLASS_CLOUD_GIK_PANEL = 4;
const int CLOUD_PROBE_CLASS_SAME_ACOUSTIC_PANEL = 5;
const int CLOUD_PROBE_CLASS_NORTH_ACOUSTIC_PANEL = 6;
const int CLOUD_PROBE_CLASS_EAST_ACOUSTIC_PANEL = 7;
const int CLOUD_PROBE_CLASS_WEST_ACOUSTIC_PANEL = 8;
const int CLOUD_PROBE_CLASS_ROOM_SHELL = 9;
const int CLOUD_PROBE_CLASS_OTHER_SCENE_OBJECT = 10;
const int CLOUD_PROBE_CLASS_MISS = 11;
const int CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK = 12;
const int CLOUD_PROBE_CLASS_ZERO_SOURCE_FACING = 13;
const int CLOUD_PROBE_CLASS_ZERO_CLOUD_FACING = 14;
const int CLOUD_PROBE_CLASS_ZERO_FACING_BOTH = 15;
const int CLOUD_PROBE_CLASS_ZERO_OTHER = 16;

bool cloudVisibilityProbeIsZeroContributionClass(int blockerClass)
{
	return blockerClass == CLOUD_PROBE_CLASS_ZERO_CONTRIBUTION ||
		blockerClass == CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK ||
		blockerClass == CLOUD_PROBE_CLASS_ZERO_SOURCE_FACING ||
		blockerClass == CLOUD_PROBE_CLASS_ZERO_CLOUD_FACING ||
		blockerClass == CLOUD_PROBE_CLASS_ZERO_FACING_BOTH ||
		blockerClass == CLOUD_PROBE_CLASS_ZERO_OTHER;
}

int cloudVisibilityProbeBlockerClass(int pickedIdx, float sourceObjectID, int sourceHitType)
{
	if (hitType == CLOUD_LIGHT)
	{
		int cloudRodIdx = int(hitObjectID - uCloudObjIdBase + 0.5);
		cloudRodIdx = clamp(cloudRodIdx, 0, 3);
		return (pickedIdx == cloudRodIdx + 7) ? CLOUD_PROBE_CLASS_VISIBLE : CLOUD_PROBE_CLASS_WRONG_CLOUD_ROD;
	}

	if (hitObjectID >= uCloudObjIdBase + 4.0 && hitObjectID <= uCloudObjIdBase + 11.0)
		return CLOUD_PROBE_CLASS_CLOUD_ALUMINIUM;

	if (hitObjectID >= 50.0 && hitObjectID <= 55.0)
		return CLOUD_PROBE_CLASS_CLOUD_GIK_PANEL;

	if (hitType == ACOUSTIC_PANEL)
	{
		if (sourceHitType == ACOUSTIC_PANEL && abs(hitObjectID - sourceObjectID) < 0.5)
			return CLOUD_PROBE_CLASS_SAME_ACOUSTIC_PANEL;
		if (hitObjectID >= 84.0 && hitObjectID <= 86.0)
			return CLOUD_PROBE_CLASS_NORTH_ACOUSTIC_PANEL;
		if (hitObjectID >= 87.0 && hitObjectID <= 89.0)
			return CLOUD_PROBE_CLASS_EAST_ACOUSTIC_PANEL;
		if (hitObjectID >= 90.0 && hitObjectID <= 92.0)
			return CLOUD_PROBE_CLASS_WEST_ACOUSTIC_PANEL;
	}

	if (hitObjectID == 1.0)
		return CLOUD_PROBE_CLASS_ROOM_SHELL;

	return CLOUD_PROBE_CLASS_OTHER_SCENE_OBJECT;
}

vec3 cloudVisibilityProbeClassColor(int blockerClass)
{
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_CONTRIBUTION) return vec3(1.0, 1.0, 1.0);
	if (blockerClass == CLOUD_PROBE_CLASS_VISIBLE) return vec3(0.0, 1.0, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_WRONG_CLOUD_ROD) return vec3(0.0, 0.0, 1.0);
	if (blockerClass == CLOUD_PROBE_CLASS_CLOUD_ALUMINIUM) return vec3(1.0, 1.0, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_CLOUD_GIK_PANEL) return vec3(0.0, 1.0, 1.0);
	if (blockerClass == CLOUD_PROBE_CLASS_SAME_ACOUSTIC_PANEL) return vec3(0.0, 0.35, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_NORTH_ACOUSTIC_PANEL) return vec3(0.45, 1.0, 0.45);
	if (blockerClass == CLOUD_PROBE_CLASS_EAST_ACOUSTIC_PANEL) return vec3(0.25, 0.8, 0.25);
	if (blockerClass == CLOUD_PROBE_CLASS_WEST_ACOUSTIC_PANEL) return vec3(0.65, 1.0, 0.65);
	if (blockerClass == CLOUD_PROBE_CLASS_ROOM_SHELL) return vec3(1.0, 0.0, 1.0);
	if (blockerClass == CLOUD_PROBE_CLASS_OTHER_SCENE_OBJECT) return vec3(1.0, 0.5, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK) return vec3(0.15, 0.9, 0.15);
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_SOURCE_FACING) return vec3(0.4, 1.0, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_CLOUD_FACING) return vec3(0.0, 0.85, 0.45);
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_FACING_BOTH) return vec3(0.65, 1.0, 0.0);
	if (blockerClass == CLOUD_PROBE_CLASS_ZERO_OTHER) return vec3(0.0, 0.55, 0.2);
	return vec3(1.0, 0.0, 0.0);
}

vec3 cloudVisibilityProbeSelectedClassColor(int blockerClass, int thetaBin)
{
	if (!cloudVisibilityProbeThetaBinMatches(thetaBin))
		return vec3(0.0);
	if (uCloudVisibilityProbeClass < 0)
		return cloudVisibilityProbeClassColor(blockerClass);
	bool selected = (uCloudVisibilityProbeClass == CLOUD_PROBE_CLASS_ZERO_CONTRIBUTION)
		? cloudVisibilityProbeIsZeroContributionClass(blockerClass)
		: (blockerClass == uCloudVisibilityProbeClass);
	return selected ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
}

vec3 cloudVisibilityProbeFacingDiagnosticColor(vec3 facingDiagnostic, int thetaBin)
{
	if (!cloudVisibilityProbeThetaBinMatches(thetaBin))
		return vec3(0.0);
	return facingDiagnostic;
}


// R3-6.5 S2：動態版 NEE pick。slot→real idx 透過 LUT 轉譯，
// 並以 uActiveLightCount 取代硬編碼 11。uActiveLightCount==0 時 black-out 回傳 nl（避免 ÷0）。
// selectPdf = 1 / uActiveLightCount；5 個分支（idx==0 / <=4 / <=6 / 7-10）。
vec3 sampleStochasticLightDynamic(vec3 x, vec3 nl, Quad ql0, out vec3 throughput, out float pdfNeeOmega, out int pickedIdx, out int zeroContributionClass, out int probeThetaBin, out vec3 facingDiagnostic)
{
	zeroContributionClass = CLOUD_PROBE_CLASS_ZERO_OTHER;
	probeThetaBin = -1;
	facingDiagnostic = vec3(0.0);
	// R3-6.5 S2.5：DCE runtime-impossible guard。
	// uR3ProbeSentinel runtime 恆 1.0；手動設 -200 觸發 sentinel 分支驗證 DCE 未 strip。
	if (uR3ProbeSentinel < -100.0) {
		pickedIdx = -42;
		throughput = vec3(0);
		pdfNeeOmega = 1e-6;
		return nl;
	}
	if (uActiveLightCount <= 0) {
		throughput = vec3(0);
		pdfNeeOmega = 1e-6;
		pickedIdx = -1;
		return nl;
	}
	int slot = int(floor(rng() * float(uActiveLightCount)));
	slot = clamp(slot, 0, uActiveLightCount - 1);
	int neeIdx = uActiveLightIndex[slot];
	float selectPdf = 1.0 / float(uActiveLightCount);
	pickedIdx = neeIdx;       // R3-6：observability + MIS reverse-NEE 用
	pdfNeeOmega = 0.0;        // 預設；每分支覆寫
	if (neeIdx == 0)
	{
		float w;
		vec3 dir = sampleQuadLight(x, nl, ql0, w);
		throughput = vec3(w / selectPdf);
		// R3-6 idx 0：ceiling quadLight NEE solid-angle PDF。sampleQuadLight 已處理 dist²/cos_light/A 積分；
		// 對 MIS 用 solid-angle 一致化公式 p_ω = selectPdf · dist²/(cos_light · A)，A = 1.44 m² (ceilingLampQuad)
		//   emitter 為向下矩形光（normal=-y），向上 shade point 之 cos_light = dir.y (dir 指向 emitter)
		vec3 lampCenter = (ql0.v0 + ql0.v2) * 0.5;
		vec3 lampExt1 = ql0.v1 - ql0.v0;
		vec3 lampExt2 = ql0.v3 - ql0.v0;
		float lampArea = length(lampExt1) * length(lampExt2);
		pdfNeeOmega = pdfNeeForLight(x, lampCenter, ql0.normal, lampArea, selectPdf);
		return dir;
	}
	if (neeIdx <= 4)
	{
		// R3-5b fix07：Track off 守門。checkbox 關 uTrackLightEnabled=0 僅擋 primary-hit emission，
		// NEE pool 若無此 gate，uTrackEmission 仍非零 → shadow ray 把 warm(3000K) 能量打到牆 → 光斑殘留。
		// 對齊 L263 Cloud gate 同構。
		if (uTrackLightEnabled < 0.5) {
			throughput = vec3(0);
			pdfNeeOmega = 1e-6;  // U4：守門 denom 非 NaN；Track 不在 R3-6 MIS scope 故值不影響 heuristic
			return nl;
		}
		int li = neeIdx - 1;
		// R3-4 fix04：uTrackLampPos 為支架底（pivot），非發光面中心。
		// 發光底圓面在 pa + lampDir * 0.135（與 SceneIntersect 圓柱長度一致）。
		// 原誤射 pivot → shadow ray grazing 或命中 housing 頂蓋（faceAlign=-1）→ NEE 必 miss → 4 盞軌道燈貢獻實質歸零。
		vec3 target = uTrackLampPos[li] + uTrackLampDir[li] * 0.135;
		vec3 toLight = target - x;
		float dist2 = max(dot(toLight, toLight), 1e-4);     // firefly clamp（近距離 distance²→0 防呆）
		vec3 ldir = toLight * inversesqrt(dist2);
		float cos_light = max(0.0, dot(-ldir, uTrackLampDir[li]));
		float falloff = smoothstep(uTrackBeamCos[li].y, uTrackBeamCos[li].x, cos_light);
		vec3 emit = uTrackEmission[li] * falloff;           // emit 於此 baked → TRACK_LIGHT branch sampleLight 路徑直接 accumCol += mask
		float geom = max(0.0, dot(nl, ldir)) * cos_light / dist2;
		// R3-4 fix07：disk-area integrand（× A）。JS 端 L = Φ/(K·π·A) 為 radiance，shader NEE 需乘發光面積還原 flux contribution。
		// fix05 throughput-50 clamp 移除：上游量綱修正後 emit≈700（非 8.4e5）、× A≈2.83e-3 × geom × /0.2 合計 O(1)，不再 firefly。
		throughput = emit * geom * TRACK_LAMP_EMITTER_AREA / selectPdf;
		// R3-6：Track 非 MIS scope（cone falloff R3-7 再擴）；pdfNeeOmega 留作 observability，不入 heuristic。
		pdfNeeOmega = pdfNeeForLight(x, target, -uTrackLampDir[li], TRACK_LAMP_EMITTER_AREA, selectPdf);
		return ldir;
	}
	if (neeIdx <= 6)
	{
		// R3-5b fix07：Wide off 守門。同理於 Track gate；cool(6500K) 能量經 NEE 漏至牆面 → 冷光斑殘留。
		if (uWideTrackLightEnabled < 0.5) {
			throughput = vec3(0);
			pdfNeeOmega = 1e-6;
			return nl;
		}
		// R3-5a：neeIdx == 5 / 6 → TrackWide 2 盞（slot 5=南、slot 6=北；索引對齊 JS uTrackWideLampPos 順序）
		int wi = neeIdx - 5;
		// 發光底圓面中心 = 支架底 + lampDir * 0.072（與 SceneIntersect 圓柱長度一致）
		vec3 wideTarget = uTrackWideLampPos[wi] + uTrackWideLampDir[wi] * 0.072;
		vec3 wideTo = wideTarget - x;
		float wideDist2 = max(dot(wideTo, wideTo), 1e-4);
		vec3 wideDir = wideTo * inversesqrt(wideDist2);
		float wideCosLight = max(0.0, dot(-wideDir, uTrackWideLampDir[wi]));
		float wideFalloff = smoothstep(uTrackWideBeamCos[wi].y, uTrackWideBeamCos[wi].x, wideCosLight);
		vec3 wideEmit = uTrackWideEmission[wi] * wideFalloff;
		float wideGeom = max(0.0, dot(nl, wideDir)) * wideCosLight / wideDist2;
		// disk-area integrand，對齊 L = Φ/(K·π·A)（JS computeTrackWideRadiance）；emitter A = π·0.05² ≈ 7.85e-3 m²
		throughput = wideEmit * wideGeom * TRACK_WIDE_LAMP_EMITTER_AREA / selectPdf;
		pdfNeeOmega = pdfNeeForLight(x, wideTarget, -uTrackWideLampDir[wi], TRACK_WIDE_LAMP_EMITTER_AREA, selectPdf);
		return wideDir;
	}
	// R6-3 Phase 1C: neeIdx 7-10 → Cloud rod 0-3 analytic 1/4 arc。
	// R3-5b fix01：Cloud-off 守門。cull 時幾何消失但 uCloudEmission 仍非零，
	// 若無此 gate，shadow ray 會穿透 Cloud 位置命中 ceilingLampQuad（LIGHT 分支 L898）→ 雙計爆 firefly。
	if (uCloudLightEnabled < 0.5) {
		throughput = vec3(0);
		pdfNeeOmega = 1e-6;
		return nl;
	}
	int rodIdx = neeIdx - 7;
	vec3 rodCenter = uCloudRodCenter[rodIdx];
	vec3 rodHalf = uCloudRodHalfExtent[rodIdx];
	vec3 longAxis = cloudLongAxis(rodIdx);
	vec3 arcCenter = cloudArcCenter(rodIdx, rodCenter, rodHalf);
	float radius = cloudArcRadius(rodIdx, rodHalf);
	float longHalf = cloudLongHalf(rodIdx, rodHalf);
	float cloudArcArea = uCloudFaceArea[rodIdx] * CLOUD_ARC_AREA_SCALE;

	float longOffset = (rng() * 2.0 - 1.0) * longHalf;
	float thetaRandom = rng();
	float thetaPdfCompensationMultiplier = 1.0;
	int sampledThetaBin = -1;
	float theta = (uCloudThetaImportanceShaderABMode > 0)
		? cloudThetaImportanceSampleTheta(thetaRandom, sampledThetaBin, thetaPdfCompensationMultiplier)
		: thetaRandom * CLOUD_ARC_THETA_MAX;
	probeThetaBin = cloudVisibilityProbeThetaBin(theta);
	vec3 localNormal = cloudArcNormal(rodIdx, theta);
	// R6-3 Phase2: keep render-energy and probe-classification Cloud normals visible side by side.
	vec3 normalEmissionNormal = cloudArcNormal(rodIdx, theta);
	vec3 probeEmissionNormal = cloudArcEmissionNormal(rodIdx, theta);
	vec3 emissionNormal = cloudArcRenderNormal(rodIdx, theta);
	vec3 cloudTarget = arcCenter + longAxis * longOffset + localNormal * radius;
	vec3 cloudTo = cloudTarget - x;
	float cloudDist2 = max(dot(cloudTo, cloudTo), 1e-4);
	vec3 cloudDir = cloudTo * inversesqrt(cloudDist2);
	float cloudSourceCos = max(0.0, dot(nl, cloudDir));
	float normalCloudCos = max(0.0, dot(-cloudDir, normalEmissionNormal));
	float probeCloudCos = max(0.0, dot(-cloudDir, probeEmissionNormal));
	float cloudCosLight = max(0.0, dot(-cloudDir, emissionNormal));
	facingDiagnostic = vec3(
		(cloudSourceCos <= 1e-7) ? 1.0 : 0.0,
		(normalCloudCos <= 1e-7) ? 1.0 : 0.0,
		(probeCloudCos <= 1e-7) ? 1.0 : 0.0
	);
	if (cloudSourceCos <= 1e-7 && cloudCosLight <= 1e-7)
		zeroContributionClass = CLOUD_PROBE_CLASS_ZERO_FACING_BOTH;
	else if (cloudSourceCos <= 1e-7)
		zeroContributionClass = CLOUD_PROBE_CLASS_ZERO_SOURCE_FACING;
	else if (cloudCosLight <= 1e-7)
		zeroContributionClass = CLOUD_PROBE_CLASS_ZERO_CLOUD_FACING;
	float cloudGeom = cloudSourceCos * cloudCosLight / cloudDist2;
	vec3 cloudEmit = uCloudEmission[rodIdx];
	if (max(max(cloudEmit.r, cloudEmit.g), cloudEmit.b) <= 1e-7)
		zeroContributionClass = CLOUD_PROBE_CLASS_ZERO_OTHER;
	float cloudPdfArea = cloudThetaImportanceEffectiveArcArea(cloudArcArea, thetaPdfCompensationMultiplier);
	throughput = cloudEmit * cloudGeom * cloudPdfArea / selectPdf;
	pdfNeeOmega = pdfNeeForLight(x, cloudTarget, emissionNormal, cloudPdfArea, selectPdf);
	return cloudDir;
}

// 世界空間垂直圓柱交叉（ISO-PUCK 用）
float CylinderIntersect(vec3 center, float radius, float halfH, vec3 ro, vec3 rd, out vec3 normal)
{
	vec3 oc = ro - center;
	float t = INFINITY;

	// 側面 (XZ 平面圓)
	float a = rd.x * rd.x + rd.z * rd.z;
	float b = 2.0 * (oc.x * rd.x + oc.z * rd.z);
	float c = oc.x * oc.x + oc.z * oc.z - radius * radius;
	float disc = b * b - 4.0 * a * c;

	if (disc >= 0.0)
	{
		float sq = sqrt(disc);
		float t0 = (-b - sq) / (2.0 * a);
		if (t0 > 0.0)
		{
			float y = oc.y + t0 * rd.y;
			if (abs(y) <= halfH)
			{
				t = t0;
				vec3 hit = oc + t0 * rd;
				normal = normalize(vec3(hit.x, 0, hit.z));
				return t;
			}
		}
	}

	// 頂蓋 / 底蓋
	if (abs(rd.y) > 0.0001)
	{
		float tTop = (halfH - oc.y) / rd.y;
		if (tTop > 0.0 && tTop < t)
		{
			vec2 p = oc.xz + tTop * rd.xz;
			if (dot(p, p) <= radius * radius)
			{ t = tTop; normal = vec3(0, 1, 0); }
		}
		float tBot = (-halfH - oc.y) / rd.y;
		if (tBot > 0.0 && tBot < t)
		{
			vec2 p = oc.xz + tBot * rd.xz;
			if (dot(p, p) <= radius * radius)
			{ t = tBot; normal = vec3(0, -1, 0); }
		}
	}

	return t;
}

// 物件空間 stadium 截面支柱交叉（短邊圓弧）
// 分解為中央 box ∪ 兩端半圓柱
float StadiumPillarIntersect(vec3 halfBox, vec3 ro, vec3 rd, out vec3 normal)
{
	float r = halfBox.x; // 短邊半徑 = X half
	float innerZ = halfBox.z - r; // 去掉圓弧部分的 Z
	float t = INFINITY;
	vec3 n;
	int dummy;

	// 中央矩形部分
	float tBox = BoxIntersect(vec3(-r, -halfBox.y, -innerZ), vec3(r, halfBox.y, innerZ), ro, rd, n, dummy);
	if (tBox > 0.0 && tBox < t) { t = tBox; normal = n; }

	// Z 正端半圓柱 (軸沿 Y，圓心在 z=+innerZ)
	vec3 oc1 = ro - vec3(0, 0, innerZ);
	float a1 = rd.x * rd.x;
	float b1 = 2.0 * oc1.x * rd.x;
	float c1 = oc1.x * oc1.x + oc1.z * oc1.z - r * r;

	// 這裡要用完整 XZ 圓：x² + (z-innerZ)² ≤ r²
	a1 = rd.x * rd.x + rd.z * rd.z;
	b1 = 2.0 * (oc1.x * rd.x + oc1.z * rd.z);
	c1 = oc1.x * oc1.x + oc1.z * oc1.z - r * r;
	float disc1 = b1 * b1 - 4.0 * a1 * c1;
	if (disc1 >= 0.0)
	{
		float sq = sqrt(disc1);
		float t0 = (-b1 - sq) / (2.0 * a1);
		if (t0 > 0.0 && t0 < t)
		{
			float y = ro.y + t0 * rd.y;
			float z = ro.z + t0 * rd.z;
			if (abs(y) <= halfBox.y && z >= innerZ)
			{
				t = t0;
				vec3 hit = oc1 + t0 * rd;
				normal = normalize(vec3(hit.x, 0, hit.z));
			}
		}
	}

	// Z 負端半圓柱
	vec3 oc2 = ro - vec3(0, 0, -innerZ);
	float a2 = rd.x * rd.x + rd.z * rd.z;
	float b2 = 2.0 * (oc2.x * rd.x + oc2.z * rd.z);
	float c2 = oc2.x * oc2.x + oc2.z * oc2.z - r * r;
	float disc2 = b2 * b2 - 4.0 * a2 * c2;
	if (disc2 >= 0.0)
	{
		float sq = sqrt(disc2);
		float t0 = (-b2 - sq) / (2.0 * a2);
		if (t0 > 0.0 && t0 < t)
		{
			float y = ro.y + t0 * rd.y;
			float z = ro.z + t0 * rd.z;
			if (abs(y) <= halfBox.y && z <= -innerZ)
			{
				t = t0;
				vec3 hit = oc2 + t0 * rd;
				normal = normalize(vec3(hit.x, 0, hit.z));
			}
		}
	}

	// 頂蓋 / 底蓋 (stadium 形狀的 cap)
	if (abs(rd.y) > 0.0001)
	{
		for (int s = 0; s < 2; s++)
		{
			float sign_y = (s == 0) ? 1.0 : -1.0;
			float tCap = (sign_y * halfBox.y - ro.y) / rd.y;
			if (tCap > 0.0 && tCap < t)
			{
				float hx = ro.x + tCap * rd.x;
				float hz = ro.z + tCap * rd.z;
				float cz = clamp(hz, -innerZ, innerZ);
				if (hx * hx + (hz - cz) * (hz - cz) <= r * r)
				{
					t = tCap;
					normal = vec3(0, sign_y, 0);
				}
			}
		}
	}

	return t;
}

// 任意方向線段圓柱交叉（R2-14 投射燈頭；含端蓋）
float CylinderSegmentIntersect(vec3 pa, vec3 pb, float r, vec3 ro, vec3 rd, out vec3 normal)
{
	vec3 ba = pb - pa;
	vec3 oc = ro - pa;
	float baba = dot(ba, ba);
	float bard = dot(ba, rd);
	float baoc = dot(ba, oc);
	float k2 = baba - bard * bard;
	float k1 = baba * dot(oc, rd) - baoc * bard;
	float k0 = baba * dot(oc, oc) - baoc * baoc - r * r * baba;
	float h = k1 * k1 - k2 * k0;
	if (h < 0.0) return INFINITY;
	h = sqrt(h);
	float tSide = (-k1 - h) / k2;
	float yS = baoc + tSide * bard;
	if (tSide > 0.001 && yS > 0.0 && yS < baba)
	{
		normal = (oc + tSide * rd - ba * yS / baba) / r;
		return tSide;
	}
	float yCap = (yS < 0.0) ? 0.0 : baba;
	float tCap = (yCap - baoc) / bard;
	if (tCap > 0.001 && abs(k1 + k2 * tCap) < h)
	{
		normal = ba * sign(yS) / sqrt(baba);
		return tCap;
	}
	return INFINITY;
}


// BVH node: 2 pixels per node in tBVHTexture
// pixel 2n:   [idPrimitive, min.x, min.y, min.z]  (idPrimitive >= 0 = leaf, -1 = inner)
// pixel 2n+1: [idRightChild, max.x, max.y, max.z]

void fetchBVHNode(int idx, out float idPrimitive, out vec3 minC, out float idRightChild, out vec3 maxC) {
	vec4 p0 = texelFetch(tBVHTexture, ivec2(idx * 2, 0), 0);
	vec4 p1 = texelFetch(tBVHTexture, ivec2(idx * 2 + 1, 0), 0);
	idPrimitive  = p0.x;
	minC         = p0.yzw;
	idRightChild = p1.x;
	maxC         = p1.yzw;
}

// Box data: 5 pixels per box in tBoxDataTexture (R2-18 起由 4 擴為 5)
// pixel 5i:   [emission.rgb, type]
// pixel 5i+1: [color.rgb, meta]
// pixel 5i+2: [min.xyz, cullable]
// pixel 5i+3: [max.xyz, fixtureGroup]  R2-14：新增 fixtureGroup 於末位
// pixel 5i+4: [roughness, metalness, 0, 0]  R2-18：scalar roughness mix + metalness

void fetchBoxData(int idx, out vec3 emission, out int type, out vec3 color, out float meta, out vec3 bMin, out vec3 bMax, out float cullable, out float fixtureGroup, out float roughness, out float metalness) {
	int base = idx * 5;
	vec4 p0 = texelFetch(tBoxDataTexture, ivec2(base, 0), 0);
	vec4 p1 = texelFetch(tBoxDataTexture, ivec2(base + 1, 0), 0);
	vec4 p2 = texelFetch(tBoxDataTexture, ivec2(base + 2, 0), 0);
	vec4 p3 = texelFetch(tBoxDataTexture, ivec2(base + 3, 0), 0);
	vec4 p4 = texelFetch(tBoxDataTexture, ivec2(base + 4, 0), 0);
	emission = p0.xyz;
	type     = int(p0.w);
	color    = p1.xyz;
	meta     = p1.w;
	bMin     = p2.xyz;
	bMax     = p3.xyz;
	cullable = p2.w;
	fixtureGroup = p3.w;
	roughness    = p4.x;
	metalness    = p4.y;
}

// R2-14：裝置開關 gating。關閉時 primary 與 secondary ray 皆跳過該 box，自動無陰影
bool isFixtureDisabled(float fixtureGroup)
{
	if (fixtureGroup < 0.5) return false; // 基底幾何恆顯
	if (fixtureGroup < 1.5) return uTrackLightEnabled < 0.5; // R2-14 群組 1
	if (fixtureGroup < 2.5) return uWideTrackLightEnabled < 0.5; // R2-15 群組 2
	if (fixtureGroup < 3.5) return uCloudPanelEnabled < 0.5; // R2-16 群組 3 Cloud 吸音板
	if (fixtureGroup < 4.5) return uCloudLightEnabled < 0.5; // R2-17 群組 4 Cloud 漫射燈條
	return false;
}


// R2-13 X-ray 透視剝離：三層 cullable tier
//   cullable=0：家具（永不透）
//   cullable=1：牆／樑／GIK／插座 —— box 之內向角近牆面（薄板貼牆）
//   cullable=2：柱等大型遮擋 —— box 中心位於相機同側半空間（X + Z 雙軸）
//   cullable=3：單軸（僅 X）大型遮擋 —— 西南/東南角柱：只隨東西側牆連動剝離，不隨南北牆連動
bool isBoxCulled(vec3 bmin, vec3 bmax, float cullable)
{
	if (uXrayEnabled < 0.5) return false;
	// R2-18 fix20：解耦 X-ray 透視與間接光。secondary ray（NEE shadow + indirect bounce）不做 culling，
	// 令被剝離之牆面對 secondary 仍為實體，indirect 反彈光正常回饋，避免陰影過暗。
	// fix12 舊策略（secondary 亦透）已廢棄：其所欲消除之「陰影殘跡」於室內相機場景不會發生
	// （uCamPos 在房內時下方四向判式本就全 false），只有室外觀察時 fix12 副作用才顯現為間接光流失。
	if (primaryRay == 0) return false;
	if (cullable < 0.5) return false;

	float T = uCullThreshold;
	float eps = uCullEpsilon;

	if (cullable < 1.5)
	{
		// cullable=1：貼牆薄板，以「內向角近牆面」為判
		if (uCamPos.x > uRoomMax.x + eps && bmin.x > uRoomMax.x - T) return true;
		if (uCamPos.x < uRoomMin.x - eps && bmax.x < uRoomMin.x + T) return true;
		if (uCamPos.z > uRoomMax.z + eps && bmin.z > uRoomMax.z - T) return true;
		if (uCamPos.z < uRoomMin.z - eps && bmax.z < uRoomMin.z + T) return true;
	}
	else if (cullable < 2.5)
	{
		// cullable=2：柱等大型遮擋，以「box 中心位於相機同側半空間」為判（X + Z 雙軸）
		vec3 roomCenter = (uRoomMin + uRoomMax) * 0.5;
		vec3 boxCenter = (bmin + bmax) * 0.5;
		if (uCamPos.x > uRoomMax.x + eps && boxCenter.x > roomCenter.x) return true;
		if (uCamPos.x < uRoomMin.x - eps && boxCenter.x < roomCenter.x) return true;
		if (uCamPos.z > uRoomMax.z + eps && boxCenter.z > roomCenter.z) return true;
		if (uCamPos.z < uRoomMin.z - eps && boxCenter.z < roomCenter.z) return true;
	}
	else
	{
		// cullable=3：單軸（僅 X）半空間判 —— 西南/東南角柱：跟隨東西側牆連動剝離，南牆剝離時柱子保持可視
		vec3 roomCenter = (uRoomMin + uRoomMax) * 0.5;
		vec3 boxCenter = (bmin + bmax) * 0.5;
		if (uCamPos.x > uRoomMax.x + eps && boxCenter.x > roomCenter.x) return true;
		if (uCamPos.x < uRoomMin.x - eps && boxCenter.x < roomCenter.x) return true;
	}

	return false;
}

float SceneIntersect( )
{
	vec3 normal, n;
    float d;
	float t = INFINITY;
	int objectCount = 0;

	hitObjectID = -INFINITY;

	// R2-18 防漏寫預設：hitRoughness/hitMetalness 若某 hit site 未明確寫入，不得 leak 自前一個更遠的 hit
	hitRoughness = 1.0;
	hitMetalness = 0.0;

	// R2-11 光源幾何由圓柱承載（見下方區塊 5），ceilingLampQuad 僅作為 importance sampling PDF 目標

	// 2) BVH traversal for boxes
	vec3 invDir = 1.0 / rayDirection;
	int isRayExiting = FALSE;

	float idPrimitive, idRightChild;
	vec3 nodeMin, nodeMax;

	int stack[32];
	int stackPtr = 0;
	stack[stackPtr++] = 0; // push root

	while (stackPtr > 0) {
		int nodeIdx = stack[--stackPtr];

		fetchBVHNode(nodeIdx, idPrimitive, nodeMin, idRightChild, nodeMax);

		// test ray against node AABB
		d = BoundingBoxIntersect(nodeMin, nodeMax, rayOrigin, invDir);
		if (d >= t) continue; // AABB miss or farther than current best

		if (idPrimitive >= 0.0) {
			// LEAF: test actual box primitive
			int boxIdx = int(idPrimitive);
			vec3 boxEmission, boxColor, boxMin, boxMax;
			int boxType;
			float boxMeta, boxCullable, boxFixtureGroup, boxRoughness, boxMetalness;
			fetchBoxData(boxIdx, boxEmission, boxType, boxColor, boxMeta, boxMin, boxMax, boxCullable, boxFixtureGroup, boxRoughness, boxMetalness);

			// R2-14：裝置關閉時 primary/secondary ray 皆跳過（自動無陰影）；R2-13 X-ray 剝離沿用
			if (!isFixtureDisabled(boxFixtureGroup) && !isBoxCulled(boxMin, boxMax, boxCullable) && boxType != CLOUD_LIGHT)
			{
				d = BoxIntersect(boxMin, boxMax, rayOrigin, rayDirection, n, isRayExiting);
				if (d < t && n != vec3(0,0,0))
				{
					t = d;
					hitNormal = n;
					hitEmission = boxEmission;
					hitColor = boxColor;
					// R2-UI（fix19）：對所有結構表面（地板/天花板/牆/樑/柱，陣列索引 0..31）套用 uWallAlbedo，家具（索引 32+）與貼圖物件不受影響
					// 歷史：原寫 index 1..15，但 fix10 地板/天花板重切後陣列索引重排，導致僅 2a/2b 被套用 albedo 而 3a 起不受影響，造成木門西側 asymmetric 暗化
					if (boxIdx <= 31) hitColor *= uWallAlbedo;
					hitType = boxType;
					hitMeta = boxMeta;
					hitRoughness = boxRoughness;
					hitMetalness = boxMetalness;
					hitBoxMin = boxMin;
					hitBoxMax = boxMax;
					// fix20：結構性 box（索引 0..31：地板/天花板/牆/樑/柱）統一 objectID=1，使邊界間 fwidth(objectID)=0，
					// 避免 PathTracingCommon.js main() 之 objectDifference>=1.0 觸發 pixelSharpness=1 而於共邊永保 raw noise
					// 傢俱與貼圖物件（索引 32+）保留各自獨特 ID（+1 讓最小為 33 避免與結構組撞）；確保 wall-furniture 邊緣仍受 edge 保護
					hitObjectID = float(objectCount + (boxIdx <= 31 ? 1 : boxIdx + 1));
				}
			}
		} else {
			// INNER NODE: push children (right first so left pops first)
			int rc = int(idRightChild);
			if (rc > 0)
				stack[stackPtr++] = rc;
			stack[stackPtr++] = nodeIdx + 1; // left child
		}
	}

	// 3) R2-6 旋轉物件
	vec3 rObjOrigin, rObjDirection;

	// helper macro: 標準 box 測試（底座、頂板）— R2-18 Step 6：C_STAND 類 per-class scale
	#define TEST_BOX(INV_MAT, IDX) { \
		rObjOrigin = vec3(INV_MAT * vec4(rayOrigin, 1.0)); \
		rObjDirection = vec3(INV_MAT * vec4(rayDirection, 0.0)); \
		d = BoxIntersect(-rotHalf[IDX], rotHalf[IDX], rObjOrigin, rObjDirection, n, isRayExiting); \
		if (d < t) { \
			t = d; \
			hitNormal = transpose(mat3(INV_MAT)) * n; \
			hitEmission = vec3(0); \
			hitColor = rotColor[IDX]; \
			hitType = DIFF; \
			hitRoughness = clamp(rotRoughness[IDX] * uStandRoughnessScale, 0.0, 1.0); \
			hitMetalness = clamp(rotMetalness[IDX] * uStandMetalnessScale, 0.0, 1.0); \
			hitObjectID = float(objectCount + 100 + IDX); \
		} \
	}

	// helper macro: 喇叭 box 測試（type SPEAKER + 記錄物件空間資料）
	#define TEST_SPEAKER(INV_MAT, IDX) { \
		rObjOrigin = vec3(INV_MAT * vec4(rayOrigin, 1.0)); \
		rObjDirection = vec3(INV_MAT * vec4(rayDirection, 0.0)); \
		d = BoxIntersect(-rotHalf[IDX], rotHalf[IDX], rObjOrigin, rObjDirection, n, isRayExiting); \
		if (d < t) { \
			t = d; \
			hitNormal = transpose(mat3(INV_MAT)) * n; \
			hitObjNormal = n; \
			hitObjPos = rObjOrigin + d * rObjDirection; \
			hitObjHalf = rotHalf[IDX]; \
			hitEmission = vec3(0); \
			hitColor = rotColor[IDX]; \
			hitType = SPEAKER; \
			hitRoughness = rotRoughness[IDX]; \
			hitMetalness = rotMetalness[IDX]; \
			hitObjectID = float(objectCount + 100 + IDX); \
		} \
	}

	// helper macro: stadium 支柱測試 — R2-18 Step 6：C_STAND_PILLAR 類 per-class scale
	#define TEST_PILLAR(INV_MAT, IDX) { \
		rObjOrigin = vec3(INV_MAT * vec4(rayOrigin, 1.0)); \
		rObjDirection = vec3(INV_MAT * vec4(rayDirection, 0.0)); \
		d = StadiumPillarIntersect(rotHalf[IDX], rObjOrigin, rObjDirection, n); \
		if (d < t) { \
			t = d; \
			hitNormal = transpose(mat3(INV_MAT)) * n; \
			hitEmission = vec3(0); \
			hitColor = rotColor[IDX]; \
			hitType = DIFF; \
			hitRoughness = clamp(rotRoughness[IDX] * uStandPillarRoughnessScale, 0.0, 1.0); \
			hitMetalness = clamp(rotMetalness[IDX] * uStandPillarMetalnessScale, 0.0, 1.0); \
			hitObjectID = float(objectCount + 100 + IDX); \
		} \
	}

	TEST_SPEAKER(uLeftSpeakerInvMatrix, 0)
	TEST_BOX(uLeftStandBaseInvMatrix, 1)
	TEST_PILLAR(uLeftStandPillarInvMatrix, 2)
	TEST_BOX(uLeftStandTopInvMatrix, 3)
	TEST_SPEAKER(uRightSpeakerInvMatrix, 4)
	TEST_BOX(uRightStandBaseInvMatrix, 5)
	TEST_PILLAR(uRightStandPillarInvMatrix, 6)
	TEST_BOX(uRightStandTopInvMatrix, 7)

	// 4) ISO-PUCK MINI (8 顆垂直圓柱)
	for (int pi = 0; pi < 8; pi++)
	{
		d = CylinderIntersect(uPuckPositions[pi], uPuckRadius, uPuckHalfH, rayOrigin, rayDirection, n);
		if (d < t)
		{
			t = d;
			hitNormal = n;
			hitEmission = vec3(0);
			hitColor = vec3(0.05, 0.05, 0.05); // 黑色橡膠
			hitType = DIFF;
			hitRoughness = 1.0; hitMetalness = 0.0; // R2-18：黑橡膠全粗糙非金屬，防 metalness leak
			hitObjectID = float(objectCount + 200 + pi);
		}
	}

	// 5) R2-11 中央吸頂燈圓柱 — 物理正確的單向光模型
	// 底面（n.y < -0.5）= LIGHT 發光；頂面與側壁 = DIFF 白色不發光外殼
	// 3cm 間隙不會洩漏直接光，天花板完全靠反彈受光 → 自然漸層
	d = CylinderIntersect(uCeilingLampPos, uCeilingLampRadius, uCeilingLampHalfH, rayOrigin, rayDirection, n);
	if (d < t)
	{
		t = d;
		hitNormal = n;
		if (n.y < -0.5)
		{
			// 底面 — 發光面
			hitEmission = uLightEmission;
			hitColor = vec3(0);
			hitType = LIGHT;
		}
		else
		{
			// 側面 + 頂面 — LAMP_SHELL：相機視覺上發光，間接反彈走 DIFF
			hitEmission = uLightEmission;
			hitColor = vec3(0.9, 0.9, 0.9);
			hitType = LAMP_SHELL;
		}
		hitRoughness = 1.0; hitMetalness = 0.0; // R2-18：光源/燈殼非金屬
		hitObjectID = float(objectCount + 300);
	}

	// 6) R2-14 → R3-4 東西投射燈頭（4 盞傾斜圓柱；關閉時 primary/secondary ray 皆跳過 → 自動無陰影）
	// R3-4：emitter 改 hitType=TRACK_LIGHT；hitColor=0 阻 BSDF 二次 mask；hitObjectID 改 uTrackLampIdBase（雙源同步契約，JS TRACK_LAMP_ID_BASE=400）
	// R3-4 fix03：face-gate 對齊舊專案 BVH_Spot_Light_Source pattern（disk = emitter / openCylinder = housing）
	//   - 底蓋（normal 與 lampDir 同向，faceAlign > 0.9）→ TRACK_LIGHT emitter
	//   - 側面 + 頂蓋 → DIFF housing（深灰殼，避免筒身全亮之視覺 bug）
	if (uTrackLightEnabled > 0.5)
	{
		for (int li = 0; li < 4; li++)
		{
			vec3 pa = uTrackLampPos[li];
			vec3 pb = pa + uTrackLampDir[li] * 0.135;
			d = CylinderSegmentIntersect(pa, pb, 0.03, rayOrigin, rayDirection, n);
			if (d < t)
			{
				t = d;
				hitNormal = n;
				float faceAlign = dot(n, uTrackLampDir[li]);
				if (faceAlign > 0.9)
				{
					hitEmission = uTrackEmission[li];
					hitColor = vec3(0);
					hitType = TRACK_LIGHT;
					hitRoughness = 1.0; hitMetalness = 0.0; // R3-4：emitter 非金屬，繞過 metal gate
					hitObjectID = uTrackLampIdBase + float(li);
				}
				else
				{
					hitEmission = vec3(0);
					hitColor = vec3(0.15, 0.15, 0.15);
					hitType = DIFF;
					hitRoughness = uFixtureRoughness;
					hitMetalness = uFixtureMetalness;
					hitObjectID = float(objectCount + 600 + li);
				}
			}
		}
	}

	// 7) R2-15 → R3-5a 南北廣角燈頭（2 盞矮胖圓柱；關閉時 primary/secondary ray 皆跳過）
	// R3-5a：emitter 改 hitType=TRACK_WIDE_LIGHT；face-gate 對齊 R3-4 spot pattern（disk = emitter / openCylinder = housing）
	//   - 底蓋（normal 與 lampDir 同向，faceAlign > 0.9）→ TRACK_WIDE_LIGHT emitter
	//   - 側面 + 頂蓋 → DIFF housing（深灰殼），hitObjectID 沿用 objectCount + 500 + li 保 R2-15 既有編號
	if (uWideTrackLightEnabled > 0.5)
	{
		for (int li = 0; li < 2; li++)
		{
			vec3 pa = uTrackWideLampPos[li];
			vec3 pb = pa + uTrackWideLampDir[li] * 0.072;
			d = CylinderSegmentIntersect(pa, pb, 0.05, rayOrigin, rayDirection, n);
			if (d < t)
			{
				t = d;
				hitNormal = n;
				float wideFaceAlign = dot(n, uTrackWideLampDir[li]);
				if (wideFaceAlign > 0.9)
				{
					hitEmission = uTrackWideEmission[li];
					hitColor = vec3(0);
					hitType = TRACK_WIDE_LIGHT;
					hitRoughness = 1.0; hitMetalness = 0.0; // emitter 非金屬，繞過 metal gate
					hitObjectID = uTrackWideLampIdBase + float(li);
				}
				else
				{
					hitEmission = vec3(0);
					hitColor = vec3(0.15, 0.15, 0.15);
					hitType = DIFF;
					hitRoughness = uFixtureRoughness;
					hitMetalness = uFixtureMetalness;
					hitObjectID = float(objectCount + 500 + li);
				}
			}
		}
	}

	// R6-3 Phase 1C：Cloud 鋁槽弧形 diffuser analytic geometry。
	// BVH 中的 square proxy 僅保留資料來源；真正發光與命中使用 1/4 圓弧面。
	if (uCloudLightEnabled > 0.5)
	{
		for (int ci = 0; ci < 4; ci++)
		{
			d = CloudArcIntersect(ci, rayOrigin, rayDirection, n);
			if (d < t)
			{
				t = d;
				hitNormal = n;
				hitEmission = uCloudEmission[ci];
				hitColor = vec3(0.0);
				hitType = CLOUD_LIGHT;
				hitRoughness = 1.0;
				hitMetalness = 0.0;
				hitObjectID = uCloudObjIdBase + float(ci);
				hitBoxMin = uCloudRodCenter[ci] - uCloudRodHalfExtent[ci];
				hitBoxMax = uCloudRodCenter[ci] + uCloudRodHalfExtent[ci];
			}
		}
	}

	return t;
}


vec3 CalculateMovementPreview( out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
{
	hitType = -100;
	primaryRay = 1;
	float t = SceneIntersect();
	if (t == INFINITY)
	{
		pixelSharpness = 1.0;
		return vec3(0.0);
	}

	vec3 n = normalize(hitNormal);
	vec3 nl = dot(n, rayDirection) < 0.0 ? n : -n;
	objectNormal += n;
	objectColor += hitColor;
	objectID = hitObjectID;

	if (hitType == BACKDROP || hitType == SPEAKER || hitType == WOOD_DOOR || hitType == IRON_DOOR || hitType == SUBWOOFER || hitType == ACOUSTIC_PANEL || hitType == OUTLET)
		pixelSharpness = 1.0;

	if (hitType == LIGHT || hitType == TRACK_LIGHT || hitType == TRACK_WIDE_LIGHT || hitType == CLOUD_LIGHT)
	{
		pixelSharpness = 1.0;
		return min(hitEmission, vec3(uEmissiveClamp));
	}

	vec3 keyDir = normalize(vec3(-0.35, 0.75, -0.25));
	float hemi = clamp(nl.y * 0.5 + 0.5, 0.0, 1.0);
	float key = clamp(dot(nl, keyDir), 0.0, 1.0);
	float grazingLift = 1.0 - abs(dot(nl, rayDirection));
	vec3 previewColor = hitColor * (0.34 + 0.38 * hemi + 0.22 * key + 0.08 * grazingLift);
	return clamp(previewColor, vec3(0.0), vec3(1.4));
}


vec3 CalculateRadiance( out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
{
    // R2-11 用 ceilingLampQuad 做向下單向光的 importance sampling（PDF 目標，非場景幾何）
    Quad light = ceilingLampQuad;

	vec3 accumCol = vec3(0);
	vec3 mask = vec3(1);
	if (uCloudMisWeightProbeMode == 8)
		return cloudMisWeightProbeUniformSentinel();
	if (uCloudMisWeightProbeMode == 9)
		return cloudMisWeightProbeContributionUniformSentinel();
	if (uMovementPreviewMode > 0.5 && uCloudVisibilityProbeMode == 0 && uCloudMisWeightProbeMode == 0 && uCloudContributionProbeMode == 0)
		return CalculateMovementPreview(objectNormal, objectColor, objectID, pixelSharpness);
    vec3 n, nl, x;
	vec3 diffuseBounceMask = vec3(1);
	vec3 diffuseBounceRayOrigin = vec3(0);
	vec3 diffuseBounceRayDirection = vec3(0);

	float t = INFINITY;
	// R3-4 / R3-5a / R3-5b：weight 升 vec3 以承載 stochastic NEE 之 emit baked + 色溫權重；既有 mask 為 vec3，相乘 component-wise
	vec3 weight;
	float p;

	int diffuseCount = 0;
	bool indirectMultApplied = false; // R6: uIndirectMultiplier 整條光路只套一次（原每次消費皆套會指數疊加）
	bool reachedMaxBounces = false; // R6 LGG-r15 B1：旗標──只有在 path 被 max bounces 強制中斷時為 true，其他 break（撞光、ray escape）為 false
	int previousIntersecType = -100;
	hitType = -100;

	int bounceIsSpecular = TRUE;
	int sampleLight = FALSE;
	int willNeedDiffuseBounceRay = FALSE;

	// R3-6：MIS Phase-1 跨 bounce state。
	//   misWPrimaryNeeLast：最近一次 NEE dispatch 的 solid-angle PDF（p_nee）；BSDF-indirect 命中 emitter 時用於 heuristic w_bsdf = p_bsdf²/(p_nee² + p_bsdf²)。
	//   misPBsdfNeeLast：NEE dispatch 當下由 shading point nl 與 NEE 方向算得之 cos-weighted BSDF PDF（cos/π）；NEE-hit 分支用於 w_nee = p_nee²/(p_nee² + p_bsdf²)。
	//   lastNeePickedIdx：最近一次 NEE 所抽的 light idx（0..10）；reverse-NEE PDF 計算時確認命中的確是「若重抽會被選中」之 emitter。
	//   misBsdfBounceNl + misBsdfBounceOrigin：BSDF 間接 bounce 發射點之 shading normal 與 position；bounce ray 命中 ceiling/Cloud emitter 時用於 reverse-NEE PDF 評估。
	//   misPBsdfStashed：BSDF bounce ray sample time cached cos-weighted PDF（cos(bounceDir, nl)/π）。
	// 每處 bounceIsSpecular = FALSE 必配此組變數 reset (plan R4 規則，17 處 site)。
	float misWPrimaryNeeLast = 0.0;
	float misPBsdfNeeLast = 0.0;
	int lastNeePickedIdx = -1;
	float lastNeeSourceObjectID = -INFINITY;
	int lastNeeSourceHitType = -100;
	vec3 lastNeeSourceNormal = vec3(0.0);
	vec3 lastNeeSourcePosition = vec3(0.0);
	int lastNeeZeroContributionClass = CLOUD_PROBE_CLASS_ZERO_OTHER;
	int lastNeeProbeThetaBin = -1;
	vec3 lastNeeFacingDiagnostic = vec3(0.0);
	int firstVisibleHitType = -100;
	float firstVisibleObjectID = -INFINITY;
	vec3 firstVisibleNormal = vec3(0.0);
	vec3 firstVisiblePosition = vec3(0.0);
	vec3 misBsdfBounceNl = vec3(0.0);
	vec3 misBsdfBounceOrigin = vec3(0.0);
	float misPBsdfStashed = 0.0;


	for (int bounces = 0; bounces < 14; bounces++)
	{
		if (bounces >= int(uMaxBounces)) { reachedMaxBounces = true; break; } // R2-UI：runtime 動態上限；R6 LGG-r15：標記為 max-bounce 強制中斷供 terminal ambient 用
		primaryRay = (bounces == 0) ? 1 : 0; // R2-13 僅首次 primary ray 套用 X-ray 剔除
		previousIntersecType = hitType;

		t = SceneIntersect();

		if (t == INFINITY)
		{
			if (uCloudVisibilityProbeMode > 0 && sampleLight == TRUE && cloudVisibilityProbeMatches(lastNeePickedIdx))
			{
				accumCol += (uCloudVisibilityProbeMode >= 4)
					? cloudVisibilityProbeFacingDiagnosticColor(lastNeeFacingDiagnostic, lastNeeProbeThetaBin)
					: ((uCloudVisibilityProbeMode >= 2)
					? ((uCloudVisibilityProbeMode >= 3)
						? cloudVisibilityProbeSelectedClassColor(cloudVisibilityProbeHasContribution(mask) ? CLOUD_PROBE_CLASS_MISS : lastNeeZeroContributionClass, lastNeeProbeThetaBin)
						: cloudVisibilityProbeClassColor(cloudVisibilityProbeHasContribution(mask) ? CLOUD_PROBE_CLASS_MISS : lastNeeZeroContributionClass))
					: cloudVisibilityProbeBlockedColor(lastNeePickedIdx));
				break;
			}

			if (bounces == 0 || (bounces == 1 && previousIntersecType == SPEC))
				pixelSharpness = 1.0;

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}

			break;
		}


		n = normalize(hitNormal);
    nl = dot(n, rayDirection) < 0.0 ? n : -n;
		x = rayOrigin + rayDirection * t;

		if (bounces == 0)
		{
			objectID = hitObjectID;
			firstVisibleHitType = hitType;
			firstVisibleObjectID = hitObjectID;
			firstVisibleNormal = nl;
			firstVisiblePosition = x;
			// 有貼圖的表面：標記為 edge pixel，跳過降噪模糊核心
			if (hitType == BACKDROP || hitType == SPEAKER || hitType == WOOD_DOOR || hitType == IRON_DOOR || hitType == SUBWOOFER || hitType == ACOUSTIC_PANEL || hitType == OUTLET)
				pixelSharpness = 1.0;
			if (uCloudMisWeightProbeMode > 0)
			{
				if (uCloudContributionProbeMode >= 17 && uCloudContributionProbeMode <= 21)
				{
					if (cloudVisibleSurfaceProbeModeMatches(uCloudContributionProbeMode, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
						accumCol += cloudMisWeightProbeContribution(vec3(1.0), vec3(1.0));
					break;
				}
			}
		}

		if (diffuseCount == 0)
		{
			objectNormal += n;
			objectColor += hitColor;
		}

		if (uCloudVisibilityProbeMode > 0 && sampleLight == TRUE && cloudVisibilityProbeMatches(lastNeePickedIdx))
		{
			int blockerClass = cloudVisibilityProbeHasContribution(mask) ? cloudVisibilityProbeBlockerClass(lastNeePickedIdx, lastNeeSourceObjectID, lastNeeSourceHitType) : lastNeeZeroContributionClass;
			accumCol += (uCloudVisibilityProbeMode >= 4)
				? cloudVisibilityProbeFacingDiagnosticColor(lastNeeFacingDiagnostic, lastNeeProbeThetaBin)
				: ((uCloudVisibilityProbeMode >= 2)
				? ((uCloudVisibilityProbeMode >= 3)
					? cloudVisibilityProbeSelectedClassColor(blockerClass, lastNeeProbeThetaBin)
					: cloudVisibilityProbeClassColor(blockerClass))
				: ((blockerClass == CLOUD_PROBE_CLASS_VISIBLE)
					? cloudVisibilityProbeVisibleColor(lastNeePickedIdx, mask)
					: cloudVisibilityProbeBlockedColor(lastNeePickedIdx)));
			break;
		}


		if (hitType == LIGHT)
		{
			if (diffuseCount == 0)
				pixelSharpness = 1.0;
			if (uCloudMisWeightProbeMode > 0) { break; }

			if (bounceIsSpecular == TRUE)
			{
				// SPEC chain / primary-ray 直接命中 ceiling：MIS 不套（Dirac delta BSDF，Veach §9.2.4），直接累加。
				accumCol += mask * hitEmission;
			}
			else if (sampleLight == TRUE)
			{
				// NEE shadow ray 命中 ceiling。若 MIS 啟用且抽到 ceiling (idx 0)，套 w_nee 權重。
				if (lastNeePickedIdx == 0)
				{
					float wNee = misPowerWeight(misWPrimaryNeeLast, misPBsdfNeeLast);
					accumCol += mask * hitEmission * wNee;
				}
				else
				{
					accumCol += mask * hitEmission;
				}
			}
			else if (diffuseCount >= 1 && misPBsdfStashed > 0.0)
			{
				// BSDF-indirect bounce ray 命中 ceiling：R3-6 新增路徑（R3-5b blocked）。
				// reverse-NEE PDF 以 bounce 發射點 (misBsdfBounceOrigin) 為源，評估「若重抽 NEE 會選中 ceiling」之 p_ω。
				vec3 lampCenter = (light.v0 + light.v2) * 0.5;
				vec3 lampExt1 = light.v1 - light.v0;
				vec3 lampExt2 = light.v3 - light.v0;
				float lampArea = length(lampExt1) * length(lampExt2);
				float pNeeReverse = pdfNeeForLight(misBsdfBounceOrigin, lampCenter, light.normal, lampArea, 1.0 / float(uActiveLightCount));
				float wBsdf = misPowerWeight(misPBsdfStashed, pNeeReverse);
				accumCol += mask * hitEmission * wBsdf;
			}

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}

			break;
		}

		// R3-4 fix04：TRACK_LIGHT 分支必須前置於 NEE-miss handler 之前，
		// 否則 L831 catch-all 會先攔截 sampleLight==TRUE 的合法 NEE 命中，
		// 導致 stochastic NEE baked 入 mask 的 emit 被丟棄（Option A' 退化成 Option A）。
		if (hitType == TRACK_LIGHT)
		{
			if (diffuseCount == 0)
				pixelSharpness = 1.0;
			if (uCloudMisWeightProbeMode > 0) { break; }

			if (sampleLight == TRUE)
			{
				accumCol += mask;
			}
			else if (bounceIsSpecular == TRUE)
			{
				int lampIdx = int(hitObjectID - uTrackLampIdBase + 0.5);
				lampIdx = clamp(lampIdx, 0, 3);
				// R3-4 fix07：量綱修正後 rawEmit≈700（非 8.4e5），tier-10/1 雙段 clamp 不再必要。
				// 改用 uEmissiveClamp（預設 50）統一節流；max-channel normalize 保色比（per-channel min 會殺色溫，見 feedback_pathtracing_spotlight_facegate_and_maxch_normalize）。
				vec3 rawEmit = uTrackEmission[lampIdx];
				float maxCh = max(max(rawEmit.r, rawEmit.g), rawEmit.b);
				float scale = (maxCh > uEmissiveClamp) ? (uEmissiveClamp / maxCh) : 1.0;
				accumCol += mask * (rawEmit * scale);
			}
			// BSDF-indirect (兩者皆 false) 不累加，避與 NEE 路徑雙計

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}

			break;
		}

		// R3-5a：TRACK_WIDE_LIGHT 分支（複用 R3-4 TRACK_LIGHT pattern；clamp index 0..1 對應南/北 2 盞）
		if (hitType == TRACK_WIDE_LIGHT)
		{
			if (diffuseCount == 0)
				pixelSharpness = 1.0;
			if (uCloudMisWeightProbeMode > 0) { break; }

			if (sampleLight == TRUE)
			{
				accumCol += mask;
			}
			else if (bounceIsSpecular == TRUE)
			{
				int wideIdx = int(hitObjectID - uTrackWideLampIdBase + 0.5);
				wideIdx = clamp(wideIdx, 0, 1);
				vec3 rawEmit = uTrackWideEmission[wideIdx];
				float maxCh = max(max(rawEmit.r, rawEmit.g), rawEmit.b);
				float scale = (maxCh > uEmissiveClamp) ? (uEmissiveClamp / maxCh) : 1.0;
				accumCol += mask * (rawEmit * scale);
			}
			// BSDF-indirect 不累加（避 NEE 雙計，待 R3-6 MIS 權重到位才開）

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}

			break;
		}

		// R6-3 Phase 1C：Cloud NEE shadow ray 命中 analytic arc emitter。
		// 只有命中本次抽到的 rod 才累加；命中其他 rod 視為遮擋。
		if (hitType == CLOUD_LIGHT && sampleLight == TRUE && uR3EmissionGate > 0.5)
		{
			int cloudRodIdx = int(hitObjectID - uCloudObjIdBase + 0.5);
			cloudRodIdx = clamp(cloudRodIdx, 0, 3);
			if (diffuseCount == 0)
				pixelSharpness = 1.0;
			if (lastNeePickedIdx == cloudRodIdx + 7)
			{
				float wNee = misPowerWeight(misWPrimaryNeeLast, misPBsdfNeeLast);
				vec3 cloudNeeContribution = cloudDarkVisibleSurfaceCleanupContribution(mask * wNee, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition);
				cloudNeeContribution = cloudSameSurfaceDarkFillContribution(cloudNeeContribution, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, diffuseCount);
				if (uCloudMisWeightProbeMode > 0)
				{
					if (uCloudContributionProbeMode == 1)
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 4 && diffuseCount == 0)
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 5 && diffuseCount >= 1)
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 6 && diffuseCount >= 1 && cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 7 && diffuseCount >= 1 && cloudDirectNeeSourceIsGik(lastNeeSourceHitType))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 8 && diffuseCount >= 1 && !cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsGik(lastNeeSourceHitType))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 9 && diffuseCount >= 1 && cloudDirectNeeSourceIsCeiling(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 10 && diffuseCount >= 1 && cloudDirectNeeSourceIsWall(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 11 && diffuseCount >= 1 && !cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsGik(lastNeeSourceHitType) && !cloudDirectNeeSourceIsCeiling(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsWall(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 12 && diffuseCount >= 1 && cloudVisibleSurfaceIsFloor(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 13 && diffuseCount >= 1 && cloudVisibleSurfaceIsGik(firstVisibleHitType))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 14 && diffuseCount >= 1 && cloudVisibleSurfaceIsCeiling(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 15 && diffuseCount >= 1 && cloudVisibleSurfaceIsWall(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode == 16 && diffuseCount >= 1 && cloudVisibleSurfaceIsObject(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode >= 22 && uCloudContributionProbeMode <= 31 && diffuseCount >= 1 && cloudDarkVisibleSurfaceSourceProbeModeMatches(uCloudContributionProbeMode, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
						accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
					else if (uCloudContributionProbeMode > 0)
						accumCol += vec3(0.0);
					else
						accumCol += cloudMisWeightProbeDirectNee(wNee, misWPrimaryNeeLast, misPBsdfNeeLast);
				}
				else
					accumCol += cloudNeeContribution;
			}
			if (uCloudMisWeightProbeMode > 0) { break; }
			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;
				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}
			break;
		}

		if (sampleLight == TRUE)
		{
			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
				sampleLight = FALSE;
				diffuseCount++;
				continue;
			}

			break;
		}

		if (hitType == BACKDROP)
		{
			if (uCloudMisWeightProbeMode > 0) { break; }
			// 只渲染面向室內的 -Z 面
			if (hitNormal.z < -0.5)
			{
				vec3 hitPoint = rayOrigin + rayDirection * t;
				vec3 center = (hitBoxMin + hitBoxMax) * 0.5;
				vec3 half_s = (hitBoxMax - hitBoxMin) * 0.5;
				vec3 localPos = hitPoint - center;
				vec2 uv = vec2(-localPos.x / half_s.x * 0.5 + 0.5, localPos.y / half_s.y * 0.5 + 0.5);
				accumCol = mask * pow(texture(uWinTex, uv).rgb, vec3(2.2));
			}
			break;
		}

		if (hitType == SPEAKER)
		{
			// 喇叭正面/背面貼圖
			vec3 aON = abs(hitObjNormal);
			if (aON.z > 0.5)
			{
				vec2 uv;
				uv.x = (hitObjNormal.z > 0.0) ? (hitObjPos.x / hitObjHalf.x * 0.5 + 0.5) : (-hitObjPos.x / hitObjHalf.x * 0.5 + 0.5);
				uv.y = hitObjPos.y / hitObjHalf.y * 0.5 + 0.5;
				if (hitObjNormal.z < -0.5)
					hitColor = pow(texture(u150F, uv).rgb, vec3(2.2));
				else
					hitColor = pow(texture(u150B, uv).rgb, vec3(2.2));
			}
			// R2-18 Step 5：per-box hitMetalness 切金屬路徑（Step 6 GUI multiplier 可調）
			if (rand() < hitMetalness) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, hitRoughness * hitRoughness));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			// 其他面保持 C_SPEAKER 顏色，以 DIFF 方式繼續
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			lastNeeSourceNormal = nl;
			lastNeeSourcePosition = x;
			continue;
		}

    if (hitType == WOOD_DOOR)
		{
			// 木門：Z 面貼圖，其餘面用 C_WOOD 漫射
			vec3 aN = abs(hitNormal);
			if (aN.z > 0.5)
			{
				vec3 hp = rayOrigin + rayDirection * t;
				vec3 ctr = (hitBoxMin + hitBoxMax) * 0.5;
				vec3 hs = (hitBoxMax - hitBoxMin) * 0.5;
				vec3 lp = hp - ctr;
				vec2 uv = vec2(lp.x / hs.x * 0.5 + 0.5, lp.y / hs.y * 0.5 + 0.5);
				hitColor = pow(texture(uWoodDoorTex, uv).rgb, vec3(2.2));
			}
			// 以 DIFF 方式繼續
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			lastNeeSourceNormal = nl;
			lastNeeSourcePosition = x;
			continue;
		}

		if (hitType == IRON_DOOR)
		{
			// 鐵門：roughness 0.3, metalness 1.0（金屬光澤反射）
			vec3 aN = abs(hitNormal);
			if (aN.x > 0.5)
			{
				vec3 hp = rayOrigin + rayDirection * t;
				vec3 ctr = (hitBoxMin + hitBoxMax) * 0.5;
				vec3 hs = (hitBoxMax - hitBoxMin) * 0.5;
				vec3 lp = hp - ctr;
				vec2 uv = vec2(-lp.z / hs.z * 0.5 + 0.5, lp.y / hs.y * 0.5 + 0.5);
				hitColor = pow(texture(uIronDoorTex, uv).rgb, vec3(2.2));
			}
			// R2-18 fix10：改為機率分支（rand() < ironM），消除 0.5 硬閾值，金屬度呈平滑漸變
			float ironM = clamp(hitMetalness * uIronDoorMetalnessScale, 0.0, 1.0);
			float ironR = clamp(hitRoughness * uIronDoorRoughnessScale, 0.0, 1.0);
			if (rand() < ironM) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, ironR * ironR));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			// 漫射 fallback（uIronDoorMetalnessScale 拉低時）
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces) {
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

		if (hitType == SUBWOOFER)
		{
			// KH750：Z 面正背面貼圖，其餘面用 C_SPEAKER 漫射
			vec3 aN = abs(hitNormal);
			if (aN.z > 0.5)
			{
				vec3 hp = rayOrigin + rayDirection * t;
				vec3 ctr = (hitBoxMin + hitBoxMax) * 0.5;
				vec3 hs = (hitBoxMax - hitBoxMin) * 0.5;
				vec3 lp = hp - ctr;
				vec2 uv;
				uv.x = (hitNormal.z > 0.0) ? (lp.x / hs.x * 0.5 + 0.5) : (-lp.x / hs.x * 0.5 + 0.5);
				uv.y = lp.y / hs.y * 0.5 + 0.5;
				if (hitNormal.z > 0.5)
					hitColor = pow(texture(u750F, uv).rgb, vec3(2.2));
				else
					hitColor = pow(texture(u750B, uv).rgb, vec3(2.2));
			}
			// R2-18 Step 5：per-box hitMetalness 切金屬路徑（Step 6 GUI multiplier 可調）
			if (rand() < hitMetalness) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, hitRoughness * hitRoughness));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			// 預設 roughness 0.4, metalness 0.0：純漫反射
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

		if (hitType == ACOUSTIC_PANEL)
		{
			// GIK 吸音板：依法向量面朝向計算 UV，hitMeta 選擇灰/白貼圖
			// R2-LOGO-FIX：偵測薄軸，側面沿薄軸方向改取正面貼圖的中央細條
			//   （維持正面紋理密度，避免側面把整張貼圖含 LOGO 拉伸覆蓋）
			vec3 aN = abs(hitNormal);
			vec3 hp = rayOrigin + rayDirection * t;
			vec3 ctr = (hitBoxMin + hitBoxMax) * 0.5;
			vec3 hs = (hitBoxMax - hitBoxMin) * 0.5;
			vec3 lp = hp - ctr;
			vec2 uv;

			float minHS = min(hs.x, min(hs.y, hs.z));
			bool thinIsX = (hs.x <= minHS + 1e-5);
			bool thinIsY = (hs.y <= minHS + 1e-5);
			bool thinIsZ = (hs.z <= minHS + 1e-5);
			// 正面以非薄軸中較長者為紋理密度基準
			float maxFront = thinIsX ? max(hs.y, hs.z) : (thinIsY ? max(hs.x, hs.z) : max(hs.x, hs.y));
			float thinDenom = 2.0 * maxFront; // 薄軸 UV 以此為分母 → 正面同密度

			if (aN.x > 0.5)
			{
				// 法向沿 X：uv.x 對應 Z 軸，uv.y 對應 Y 軸
				float uxDen = thinIsZ ? thinDenom : (2.0 * hs.z);
				float uyDen = thinIsY ? thinDenom : (2.0 * hs.y);
				float uxSign = (hitNormal.x > 0.0) ? -1.0 : 1.0;
				uv.x = 0.5 + uxSign * lp.z / uxDen;
				uv.y = 0.5 + lp.y / uyDen;
			}
			else if (aN.y > 0.5)
			{
				// 法向沿 Y：uv.x 對應 X 軸，uv.y 對應 Z 軸（反向）
				// R2-18 fix17：天花板 Cloud（hitNormal.y < 0）時 X 翻轉，令 LOGO 落右上角
				float uxDen = thinIsX ? thinDenom : (2.0 * hs.x);
				float uyDen = thinIsZ ? thinDenom : (2.0 * hs.z);
				float uxSign = (hitNormal.y < 0.0) ? -1.0 : 1.0;
				uv.x = 0.5 + uxSign * lp.x / uxDen;
				uv.y = 0.5 + (-lp.z) / uyDen;
			}
			else
			{
				// 法向沿 Z：uv.x 對應 X 軸，uv.y 對應 Y 軸
				float uxDen = thinIsX ? thinDenom : (2.0 * hs.x);
				float uyDen = thinIsY ? thinDenom : (2.0 * hs.y);
				float uxSign = (hitNormal.z > 0.0) ? 1.0 : -1.0;
				uv.x = 0.5 + uxSign * lp.x / uxDen;
				uv.y = 0.5 + lp.y / uyDen;
			}

			vec3 rawTexCol;
			if (hitMeta < 0.5)
				rawTexCol = texture(uGikGrayTex, uv).rgb;
			else
				rawTexCol = texture(uGikWhiteTex, uv).rgb;

			hitColor = pow(rawTexCol, vec3(2.2)) * 0.7;

			// R2-16 Cloud 吸音板 DASH 拼縫虛線（天花板向下面）
			// 觸發：Box 中心 y > 2.7m（排除牆面吸音板）且命中面法線朝下
			// Z 向縫 4 條（x = ±0.9 外邊界、±0.3 內縫）；X 向縫 3 條（z = -0.702, +0.498, +1.698）
			// 週期 6cm：4cm 實 + 2cm 空；命中時 hitColor=vec3(1.0) 覆寫為純白
			if (ctr.y > 2.7 && hitNormal.y < -0.5)
			{
				bool isLine = false;
				if (hp.z > -0.702 && hp.z < 1.698)
				{
					if (abs(hp.x + 0.9) < 0.001 || abs(hp.x + 0.3) < 0.001 ||
					    abs(hp.x - 0.3) < 0.001 || abs(hp.x - 0.9) < 0.001)
					{
						if (mod(hp.z + 10.0, 0.06) < 0.04) isLine = true;
					}
				}
				if (hp.x > -0.9 && hp.x < 0.9)
				{
					if (abs(hp.z + 0.702) < 0.001 ||
					    abs(hp.z - 0.498) < 0.001 ||
					    abs(hp.z - 1.698) < 0.001)
					{
						if (mod(hp.x + 10.0, 0.06) < 0.04) isLine = true;
					}
				}
				if (isLine) hitColor = vec3(1.0);
			}

			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

		if (hitType == TRACK)
		{
			// R2-18 Phase 2：軌道+燈具束包覆寫 + metal gate
			hitRoughness = uFixtureRoughness;
			hitMetalness = uFixtureMetalness;
			if (rand() < hitMetalness) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, hitRoughness * hitRoughness));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			// R2-14 真修：軌道純白漫射，無孔、無貼圖、吃降噪
			// 邏輯等同 DIFF，獨立分支避免未來再與插座材質糾纏
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

		// R3-4 fix04：TRACK_LIGHT 分支已前移至 L830 附近（NEE-miss handler 之前），此處原複本移除以免死碼誤導

		if (hitType == OUTLET)
		{
			// 插座面板：白色漫射 + 物理座標插孔（參考舊專案）
			vec3 hp = rayOrigin + rayDirection * t;
			vec3 ctr = (hitBoxMin + hitBoxMax) * 0.5;
			vec3 hs = (hitBoxMax - hitBoxMin) * 0.5;
			vec3 lp = hp - ctr;
			vec3 aN = abs(hitNormal);

			// 只在正面（深度最薄軸）繪製插孔
			bool isFront = (aN.x > 0.5 && hs.x < 0.01) ||
			               (aN.y > 0.5 && hs.y < 0.01) ||
			               (aN.z > 0.5 && hs.z < 0.01);

			if (isFront)
			{
				// u = 寬度軸座標（公尺），與舊專案相同邏輯
				float u = (hs.x > hs.z) ? lp.x : lp.z;
				float u_r = abs(u) - 0.025;
				bool isHole = false;

				if (hs.y > 0.04) // 雙聯插座（高度 > 8cm）
				{
					if (lp.y > 0.0)
						isHole = abs(u_r) < 0.008 && (abs(lp.y - 0.025 - 0.008) < 0.002 || abs(lp.y - 0.025 + 0.008) < 0.002);
					else
						isHole = abs(u) < 0.015 && abs(lp.y + 0.025) < 0.015;
				}
				else // 單聯插座
					isHole = abs(u_r) < 0.008 && (abs(lp.y - 0.008) < 0.002 || abs(lp.y + 0.008) < 0.002);

				if (isHole)
					hitColor = vec3(0.0);
			}

			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

    if (hitType == LAMP_SHELL)
    {
			// R2-11 燈具外殼：相機直視 / 鏡面反射看見 → 視為發光（殼整顆亮）
			// 間接 diffuse bounce 打到 → 按 DIFF 處理（維持天花板漸層、不產生陰影）
			if (bounceIsSpecular == TRUE)
			{
				if (uCloudMisWeightProbeMode > 0) { break; }
				accumCol = mask * hitEmission;
				break;
			}
			// R2-18 Phase 2：軌道+燈具束包覆寫 + metal gate
			hitRoughness = uFixtureRoughness;
			hitMetalness = uFixtureMetalness;
			if (rand() < hitMetalness) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, hitRoughness * hitRoughness));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			// 以下與標準 DIFF 分支相同
			diffuseCount++;
			mask *= hitColor;
						bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear
			rayOrigin = x + nl * uEPS_intersect;
			if (float(diffuseCount) < uMaxBounces)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}
			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			continue;
		}

    if (hitType == CLOUD_LIGHT)
    {
			// R6-3 Phase 1C：Cloud hit 來自 analytic 1/4 圓弧 diffuser，整個命中面皆為 emissive。
			if (uR3EmissionGate > 0.5)
			{
				int rodIdx = int(hitObjectID - uCloudObjIdBase + 0.5);
				rodIdx = clamp(rodIdx, 0, 3);
				vec3 emission = min(uCloudEmission[rodIdx], vec3(uEmissiveClamp));
				if (diffuseCount == 0)
					pixelSharpness = 1.0;
				if (uCloudMisWeightProbeMode == 7)
				{
					if (diffuseCount >= 1 && misPBsdfStashed > 0.0 && !(uCloudLightEnabled < 0.5))
						accumCol += cloudMisWeightProbeBsdfHitContributionSentinel();
					break;
				}
				if (uCloudMisWeightProbeMode == 6)
				{
					if (diffuseCount >= 1 && misPBsdfStashed > 0.0 && !(uCloudLightEnabled < 0.5))
					{
						float cloudArcArea = uCloudFaceArea[rodIdx] * CLOUD_ARC_AREA_SCALE;
						vec3 reverseEmissionNormal = hitNormal;
						float reverseCloudPdfArea = cloudThetaImportanceEffectiveArcAreaForNormal(rodIdx, cloudArcArea, hitNormal);
						float pNeeReverse = pdfNeeForLight(misBsdfBounceOrigin, x, reverseEmissionNormal, reverseCloudPdfArea, 1.0 / float(uActiveLightCount));
						float wBsdf = misPowerWeight(misPBsdfStashed, pNeeReverse);
						vec3 weightedContribution = min(mask * emission * wBsdf, vec3(uEmissiveClamp));
						vec3 unweightedContribution = min(mask * emission, vec3(uEmissiveClamp));
						accumCol += cloudMisWeightProbeContribution(weightedContribution, unweightedContribution);
					}
					break;
				}
				if (uCloudMisWeightProbeMode > 0)
				{
					if (sampleLight == TRUE && lastNeePickedIdx == rodIdx + 7)
					{
						float wNee = misPowerWeight(misWPrimaryNeeLast, misPBsdfNeeLast);
						vec3 cloudNeeContribution = cloudDarkVisibleSurfaceCleanupContribution(mask * wNee, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition);
						cloudNeeContribution = cloudSameSurfaceDarkFillContribution(cloudNeeContribution, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, diffuseCount);
						if (uCloudContributionProbeMode == 1)
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 4 && diffuseCount == 0)
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 5 && diffuseCount >= 1)
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 6 && diffuseCount >= 1 && cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 7 && diffuseCount >= 1 && cloudDirectNeeSourceIsGik(lastNeeSourceHitType))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 8 && diffuseCount >= 1 && !cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsGik(lastNeeSourceHitType))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 9 && diffuseCount >= 1 && cloudDirectNeeSourceIsCeiling(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 10 && diffuseCount >= 1 && cloudDirectNeeSourceIsWall(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 11 && diffuseCount >= 1 && !cloudDirectNeeSourceIsFloor(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsGik(lastNeeSourceHitType) && !cloudDirectNeeSourceIsCeiling(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition) && !cloudDirectNeeSourceIsWall(lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 12 && diffuseCount >= 1 && cloudVisibleSurfaceIsFloor(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 13 && diffuseCount >= 1 && cloudVisibleSurfaceIsGik(firstVisibleHitType))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 14 && diffuseCount >= 1 && cloudVisibleSurfaceIsCeiling(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 15 && diffuseCount >= 1 && cloudVisibleSurfaceIsWall(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode == 16 && diffuseCount >= 1 && cloudVisibleSurfaceIsObject(firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode >= 22 && uCloudContributionProbeMode <= 31 && diffuseCount >= 1 && cloudDarkVisibleSurfaceSourceProbeModeMatches(uCloudContributionProbeMode, firstVisibleHitType, firstVisibleObjectID, firstVisibleNormal, firstVisiblePosition, lastNeeSourceHitType, lastNeeSourceObjectID, lastNeeSourceNormal, lastNeeSourcePosition))
							accumCol += cloudMisWeightProbeContribution(cloudNeeContribution, mask);
						else if (uCloudContributionProbeMode > 0)
							accumCol += vec3(0.0);
						else
							accumCol += cloudMisWeightProbeDirectNee(wNee, misWPrimaryNeeLast, misPBsdfNeeLast);
					}
					else if (diffuseCount >= 1 && misPBsdfStashed > 0.0 && !(uCloudLightEnabled < 0.5))
					{
						float cloudArcArea = uCloudFaceArea[rodIdx] * CLOUD_ARC_AREA_SCALE;
						vec3 reverseEmissionNormal = hitNormal;
						float reverseCloudPdfArea = cloudThetaImportanceEffectiveArcAreaForNormal(rodIdx, cloudArcArea, hitNormal);
						float pNeeReverse = pdfNeeForLight(misBsdfBounceOrigin, x, reverseEmissionNormal, reverseCloudPdfArea, 1.0 / float(uActiveLightCount));
						float wBsdf = misPowerWeight(misPBsdfStashed, pNeeReverse);
						if (uCloudMisWeightProbeMode == 7)
							accumCol += cloudMisWeightProbeBsdfHitContributionSentinel();
						else if (uCloudMisWeightProbeMode == 6)
						{
							vec3 weightedContribution = min(mask * emission * wBsdf, vec3(uEmissiveClamp));
							vec3 unweightedContribution = min(mask * emission, vec3(uEmissiveClamp));
							accumCol += cloudMisWeightProbeContribution(weightedContribution, unweightedContribution);
						}
						else if (uCloudContributionProbeMode == 3)
							accumCol += cloudMisWeightProbeBsdfHitContributionSentinel();
						else if (uCloudContributionProbeMode == 2)
						{
							vec3 weightedContribution = min(mask * emission * wBsdf, vec3(uEmissiveClamp));
							vec3 unweightedContribution = min(mask * emission, vec3(uEmissiveClamp));
							accumCol += cloudMisWeightProbeContribution(weightedContribution, unweightedContribution);
						}
						else if (uCloudContributionProbeMode > 0)
							accumCol += vec3(0.0);
						else if (uCloudMisWeightProbeMode == 3)
							accumCol += vec3(wBsdf, 1.0, 0.0);
						else if (uCloudMisWeightProbeMode == 4)
							accumCol += vec3(pNeeReverse, misPBsdfStashed, 1.0);
					}
					break;
				}
				if (sampleLight == TRUE)
				{
					if (lastNeePickedIdx == rodIdx + 7)
					{
						float wNee = misPowerWeight(misWPrimaryNeeLast, misPBsdfNeeLast);
						accumCol += mask * wNee;
					}
				}
				else if (bounceIsSpecular == TRUE)
				{
					accumCol = min(mask * emission, vec3(uEmissiveClamp));
				}
				else if (diffuseCount >= 1 && misPBsdfStashed > 0.0 && !(uCloudLightEnabled < 0.5))
				{
					float cloudArcArea = uCloudFaceArea[rodIdx] * CLOUD_ARC_AREA_SCALE;
					vec3 rodCenter = uCloudRodCenter[rodIdx];
					vec3 rodHalf = uCloudRodHalfExtent[rodIdx];
					vec3 longAxis = cloudLongAxis(rodIdx);
					vec3 arcCenter = cloudArcCenter(rodIdx, rodCenter, rodHalf);
					float longHalf = cloudLongHalf(rodIdx, rodHalf);
					float reverseLongOffset = clamp(dot(x - arcCenter, longAxis), -longHalf, longHalf);
					vec3 reverseEmissionNormal = (uCloudVisibilityProbeMode > 0) ? -hitNormal : hitNormal;
					float reverseCloudPdfArea = cloudThetaImportanceEffectiveArcAreaForNormal(rodIdx, cloudArcArea, hitNormal);
					float pNeeReverse = pdfNeeForLight(misBsdfBounceOrigin, x, reverseEmissionNormal, reverseCloudPdfArea, 1.0 / float(uActiveLightCount));
					float wBsdf = misPowerWeight(misPBsdfStashed, pNeeReverse);
					accumCol += min(mask * emission * wBsdf, vec3(uEmissiveClamp));
				}
				if (willNeedDiffuseBounceRay == TRUE)
				{
					mask = diffuseBounceMask * (indirectMultApplied ? 1.0 : uIndirectMultiplier); indirectMultApplied = true;
					rayOrigin = diffuseBounceRayOrigin;
					rayDirection = diffuseBounceRayDirection;
					willNeedDiffuseBounceRay = FALSE;
					bounceIsSpecular = FALSE;
					misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0;
					sampleLight = FALSE;
					diffuseCount++;
					continue;
				}
				break;
			}
    }

    if (hitType == DIFF)
    {
			vec3 forcedBsdfHitProbe = vec3(0.0);
			if (cloudMisWeightProbeForcedBsdfHit(x, nl, mask * hitColor, forcedBsdfHitProbe))
			{
				accumCol += forcedBsdfHitProbe;
				break;
			}
			// R2-18 fix17：地板磁磚 dielectric Fresnel 分支（hitObjectID=1 結構組 + 頂面 + bmax.y≈0）
			// Schlick F0=0.04，rand()<F 走鏡面（roughness² blur），否則走下方漫射
			bool isFloor = (hitObjectID < 1.5 && hitNormal.y > 0.5 && hitBoxMax.y < 0.1);
			if (isFloor) {
				float cosI = max(0.0, dot(-rayDirection, nl));
				float F = 0.04 + 0.96 * pow(1.0 - cosI, 5.0);
				if (rand() < F) {
					vec3 reflDir = reflect(rayDirection, nl);
					vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
					rayDirection = normalize(mix(reflDir, diffDir, uFloorRoughness * uFloorRoughness));
					rayOrigin = x + nl * uEPS_intersect;
					continue;
				}
			}
			// R2-18 Step 4 金屬路徑切分：per-box hitMetalness 驅動，mix 權重 = roughness²
			if (rand() < hitMetalness) {
				mask *= hitColor;
				vec3 reflDir = reflect(rayDirection, nl);
				vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
				rayDirection = normalize(mix(reflDir, diffDir, hitRoughness * hitRoughness));
				rayOrigin = x + nl * uEPS_intersect;
				continue;
			}
			diffuseCount++;

			mask *= hitColor;
			
			bounceIsSpecular = FALSE;
			misWPrimaryNeeLast = 0.0; misPBsdfNeeLast = 0.0; lastNeePickedIdx = -1; misBsdfBounceNl = vec3(0.0); misBsdfBounceOrigin = vec3(0.0); misPBsdfStashed = 0.0; // R3-6 R4: SPEC→DIFF state-clear

			rayOrigin = x + nl * uEPS_intersect;

        if (float(diffuseCount) < uMaxBounces)
        {
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				misBsdfBounceNl = nl; misBsdfBounceOrigin = x; misPBsdfStashed = cosWeightedPdf(diffuseBounceRayDirection, nl); // R3-6 Phase-3: cache BSDF-bounce state for MIS indirect-hit
				willNeedDiffuseBounceRay = TRUE;
			}

			// R3-6：NEE dispatch 升 6-args，抓 p_nee solid-angle PDF + pickedIdx 供 MIS heuristic + observability。
			float neePdfOmega; int neePickedIdx; int neeZeroContributionClass; int neeProbeThetaBin; vec3 neeFacingDiagnostic;
			rayDirection = sampleStochasticLightDynamic(x, nl, light, weight, neePdfOmega, neePickedIdx, neeZeroContributionClass, neeProbeThetaBin, neeFacingDiagnostic);
			lastNeeZeroContributionClass = cloudVisibilityProbeHasContribution(mask) ? neeZeroContributionClass : CLOUD_PROBE_CLASS_ZERO_SOURCE_MASK;
			lastNeeProbeThetaBin = neeProbeThetaBin;
			lastNeeFacingDiagnostic = neeFacingDiagnostic;
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			misWPrimaryNeeLast = neePdfOmega;
			misPBsdfNeeLast = cosWeightedPdf(rayDirection, nl);
			lastNeePickedIdx = neePickedIdx;
			lastNeeSourceObjectID = hitObjectID;
			lastNeeSourceHitType = hitType;
			lastNeeSourceNormal = nl;
			lastNeeSourcePosition = x;
			continue;

    }

    if (hitType == SPEC)
	{
		mask *= hitColor;

		rayDirection = reflect(rayDirection, nl);
		rayOrigin = x + nl * uEPS_intersect;

		continue;
	}

	}

	if (uCloudMisWeightProbeMode > 0)
		return max(vec3(0), accumCol);

	// R6 LGG-r15 B1 / r16 J3：Terminal 注入兩個來源
	//   uIsBorrowPass < 0.5  → 主 pass：可同時用 borrow 採樣 + constant ambient 保底
	//   uIsBorrowPass > 0.5  → 借光 pass 自身：跳過所有 terminal 注入，避免遞迴自我餵食
	// borrow      該像素 14 彈累積色 / sampleCounter，給暗角「來自場景反彈」的真實光
	// ambient     中性常數，給 borrow 0 或想要保底時用
	// 兩者皆 mask × value，path 越深 mask 越小，亮區自動衰減
	if (reachedMaxBounces && uIsBorrowPass < 0.5)
	{
		// R6 LGG-r28：拆掉 darkGate，只留 positionGate
		//
		// r20~r27 共 8 輪 darkGate 失敗紀錄（這次有實證根因）：
		//   darkGate = exp(-accumLuma × 100) 是 per-frame 0/1 機率分類
		//   但 pixel 多 frame 平均 E[darkGate] = (沒撞光機率) × 1 + (撞光機率) × ~0
		//   → E[darkGate] 直接等於該 pixel 的「沒撞光機率」
		//   → 牆面不同高度的沒撞光機率隨 NEE 幾何漸變
		//   → contribution = mask × borrow × strength × E[darkGate] × positionGate
		//                    形成沿 NEE 機率等高線的水平 banding
		//   → 不是雜訊、是真實空間結構、無法靠採樣消除
		//
		// 拆掉 darkGate 後 contribution = mask × borrow × strength × positionGate
		//   positionGate 用 borrow_luma 收斂後是 stable 空間平滑值
		//   不再有 per-frame 隨機性 → 無 banding
		//   AO 帶用 positionGate 微擋（borrow_luma 0.5 → gate 0.25 → 弱 lift）
		//   亮面 positionGate 0 → 完全不影響
		//   深暗角 positionGate ≈ 1 → 全套
		if (uBorrowStrength > 0.0)
		{
			// R6 LGG-r29：positionGate 收緊到 (0.0, 0.3)
			// r28 範圍 (0.2, 0.6) 讓亮面（borrow_luma 0.4~0.6）也有 0.5 級 gate
			//   → contribution 受 1/8 borrow per-texel variance 影響、向外擴散變髒
			// 收緊到 (0.0, 0.3) 後 borrow_luma > 0.3 全擋（牆面/天花板/亮區乾淨）
			// 只剩深暗角與接觸暗角 borrow_luma < 0.3 時放行
			vec2 borrowUv = gl_FragCoord.xy / uResolution;
			vec3 borrowedSum = texture(tBorrowTexture, borrowUv).rgb;
			vec3 borrowedAvg = borrowedSum / max(uSampleCounter, 1.0);
			borrowedAvg = min(borrowedAvg, vec3(1.0));
			float borrowLuma = dot(borrowedAvg, vec3(0.299, 0.587, 0.114));
			float positionGate = 1.0 - smoothstep(0.0, 0.3, borrowLuma);
			accumCol += mask * borrowedAvg * uBorrowStrength * positionGate;
		}
	}

	// R3-1 DCE-proof sink: 保留 uniform reference 但恆不貢獻 accumCol。
	// R3-3 fix02：原以 uR3EmissionGate 作係數──R3-1/R3-2 gate=0 時碰巧=0，但 R3-3 gate 翻成 1 後
	// sink = Σ(uCloudEmission) ≈ (40, 31, 22) 直接累加每個 pixel→全白。
	// 改 runtime-false guard：uR3EmissionGate ∈ {0, 1}，永不會 < -0.5；compiler 無法證明 false→uniform 不被 DCE。
	if (uR3EmissionGate < -0.5)
	{
		accumCol += uCloudEmission[0] + uCloudEmission[1] + uCloudEmission[2] + uCloudEmission[3] +
			uTrackEmission[0] + uTrackEmission[1] + uTrackEmission[2] + uTrackEmission[3] +
			uTrackWideEmission[0] + uTrackWideEmission[1] +
			vec3(uCloudObjIdBase + uCloudFaceArea[0] + uCloudFaceArea[1] + uCloudFaceArea[2] + uCloudFaceArea[3] + uEmissiveClamp) +
			vec3(uTrackWideBeamCos[0].x + uTrackWideBeamCos[0].y + uTrackWideBeamCos[1].x + uTrackWideBeamCos[1].y + uTrackWideLampIdBase);
		accumCol += uCloudRodCenter[0] + uCloudRodCenter[1] + uCloudRodCenter[2] + uCloudRodCenter[3] +
			uCloudRodHalfExtent[0] + uCloudRodHalfExtent[1] + uCloudRodHalfExtent[2] + uCloudRodHalfExtent[3];

	}
	return max(vec3(0), accumCol);

}


void SetupScene(void)
{
	vec3 z = vec3(0);
	vec3 L1 = uLightEmission;

	// R2-11 中央吸頂燈 — 向下的矩形 PDF 目標（僅作為 importance sampling 用，不在 SceneIntersect 中）
	// 可見幾何由圓柱承載，圓柱底面為 LIGHT、頂/側為 DIFF 白色外殼
	// 矩形外接圓柱底面圓（47×47cm at y=uCeilingLampPos.y - uCeilingLampHalfH，朝下）
	// R2-16：座標改由 uCeilingLampPos 動態計算，隨 uCloudPanelEnabled 聯動南北移動
	float _rq = uCeilingLampRadius;
	float _yq = uCeilingLampPos.y - uCeilingLampHalfH;
	float _xc = uCeilingLampPos.x;
	float _zc = uCeilingLampPos.z;
	ceilingLampQuad = Quad( vec3(0.0, -1.0, 0.0),
	                        vec3(_xc - _rq, _yq, _zc - _rq),
	                        vec3(_xc + _rq, _yq, _zc - _rq),
	                        vec3(_xc + _rq, _yq, _zc + _rq),
	                        vec3(_xc - _rq, _yq, _zc + _rq),
	                        L1, z, LIGHT);
}


#include <pathtracing_main>
