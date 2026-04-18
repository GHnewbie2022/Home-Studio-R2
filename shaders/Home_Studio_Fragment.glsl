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
#define CLOUD_LIGHT 14 // R2-17 Cloud 漫射燈條（emission=0 視覺幾何，behavior 同 DIFF）

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


// R2-13 X-ray 透視剝離：雙層 cullable tier
//   cullable=0：家具（永不透）
//   cullable=1：牆／樑／GIK／插座 —— box 之內向角近牆面（薄板貼牆）
//   cullable=2：柱等大型遮擋 —— box 中心位於相機同側半空間（擋在相機與室心之間即透）
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
	else
	{
		// cullable=2：柱等大型遮擋，以「box 中心位於相機同側半空間」為判
		vec3 roomCenter = (uRoomMin + uRoomMax) * 0.5;
		vec3 boxCenter = (bmin + bmax) * 0.5;
		if (uCamPos.x > uRoomMax.x + eps && boxCenter.x > roomCenter.x) return true;
		if (uCamPos.x < uRoomMin.x - eps && boxCenter.x < roomCenter.x) return true;
		if (uCamPos.z > uRoomMax.z + eps && boxCenter.z > roomCenter.z) return true;
		if (uCamPos.z < uRoomMin.z - eps && boxCenter.z < roomCenter.z) return true;
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
			if (!isFixtureDisabled(boxFixtureGroup) && !isBoxCulled(boxMin, boxMax, boxCullable))
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

	// 6) R2-14 東西投射燈頭（4 盞傾斜圓柱；關閉時 primary/secondary ray 皆跳過 → 自動無陰影）
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
				hitEmission = vec3(0);
				hitColor = vec3(0.85, 0.85, 0.85);
				hitType = DIFF;
				hitRoughness = uFixtureRoughness; hitMetalness = uFixtureMetalness; // R2-18 Phase 2：軌道+燈具束包
				hitObjectID = float(objectCount + 400 + li);
			}
		}
	}

	// 7) R2-15 南北廣角燈頭（2 盞矮胖圓柱；關閉時 primary/secondary ray 皆跳過）
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
				hitEmission = vec3(0);
				hitColor = vec3(0.85, 0.85, 0.85);
				hitType = DIFF;
				hitRoughness = uFixtureRoughness; hitMetalness = uFixtureMetalness; // R2-18 Phase 2：軌道+燈具束包
				hitObjectID = float(objectCount + 500 + li);
			}
		}
	}

	return t;
}


vec3 CalculateRadiance( out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
{
    // R2-11 用 ceilingLampQuad 做向下單向光的 importance sampling（PDF 目標，非場景幾何）
    Quad light = ceilingLampQuad;

	vec3 accumCol = vec3(0);
    vec3 mask = vec3(1);
    vec3 n, nl, x;
	vec3 diffuseBounceMask = vec3(1);
	vec3 diffuseBounceRayOrigin = vec3(0);
	vec3 diffuseBounceRayDirection = vec3(0);

	float t = INFINITY;
	float weight, p;

	int diffuseCount = 0;
	int previousIntersecType = -100;
	hitType = -100;

	int bounceIsSpecular = TRUE;
	int sampleLight = FALSE;
	int willNeedDiffuseBounceRay = FALSE;


	for (int bounces = 0; bounces < 14; bounces++)
	{
		if (bounces >= int(uMaxBounces)) break; // R2-UI：runtime 動態上限
		primaryRay = (bounces == 0) ? 1 : 0; // R2-13 僅首次 primary ray 套用 X-ray 剔除
		previousIntersecType = hitType;

		t = SceneIntersect();

		if (t == INFINITY)
		{
			if (bounces == 0 || (bounces == 1 && previousIntersecType == SPEC))
				pixelSharpness = 1.0;

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * uIndirectMultiplier;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				sampleLight = FALSE;
				diffuseCount = 1;
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
			// 有貼圖的表面：標記為 edge pixel，跳過降噪模糊核心
			if (hitType == BACKDROP || hitType == SPEAKER || hitType == WOOD_DOOR || hitType == IRON_DOOR || hitType == SUBWOOFER || hitType == ACOUSTIC_PANEL || hitType == OUTLET)
				pixelSharpness = 1.0;
		}

		if (diffuseCount == 0)
		{
			objectNormal += n;
			objectColor += hitColor;
		}


		if (hitType == LIGHT)
		{
			if (diffuseCount == 0)
				pixelSharpness = 1.0;

			if (bounceIsSpecular == TRUE || sampleLight == TRUE)
				accumCol = mask * hitEmission;

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * uIndirectMultiplier;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				sampleLight = FALSE;
				diffuseCount = 1;
				continue;
			}

			break;
		}

		if (sampleLight == TRUE)
		{
			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask * uIndirectMultiplier;
				rayOrigin = diffuseBounceRayOrigin;
				rayDirection = diffuseBounceRayDirection;

				willNeedDiffuseBounceRay = FALSE;
				bounceIsSpecular = FALSE;
				sampleLight = FALSE;
				diffuseCount = 1;
				continue;
			}

			break;
		}

		if (hitType == BACKDROP)
		{
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
			rayOrigin = x + nl * uEPS_intersect;
			if (diffuseCount == 1)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				willNeedDiffuseBounceRay = TRUE;
			}
			rayDirection = sampleQuadLight(x, nl, light, weight);
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
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
			rayOrigin = x + nl * uEPS_intersect;
			if (diffuseCount == 1)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				willNeedDiffuseBounceRay = TRUE;
			}
			rayDirection = sampleQuadLight(x, nl, light, weight);
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
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
			rayOrigin = x + nl * uEPS_intersect;
			if (diffuseCount == 1) {
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				willNeedDiffuseBounceRay = TRUE;
			}
			rayDirection = sampleQuadLight(x, nl, light, weight);
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
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
			rayOrigin = x + nl * uEPS_intersect;
			if (diffuseCount == 1)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				willNeedDiffuseBounceRay = TRUE;
			}
			rayDirection = sampleQuadLight(x, nl, light, weight);
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
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
			rayOrigin = x + nl * uEPS_intersect;
			if (diffuseCount == 1)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				willNeedDiffuseBounceRay = TRUE;
			}
			rayDirection = sampleQuadLight(x, nl, light, weight);
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
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
			rayOrigin = x + nl * uEPS_intersect;
			if (diffuseCount == 1)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				willNeedDiffuseBounceRay = TRUE;
			}
			rayDirection = sampleQuadLight(x, nl, light, weight);
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			continue;
		}

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
			rayOrigin = x + nl * uEPS_intersect;
			if (diffuseCount == 1)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				willNeedDiffuseBounceRay = TRUE;
			}
			rayDirection = sampleQuadLight(x, nl, light, weight);
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			continue;
		}

    if (hitType == LAMP_SHELL)
    {
			// R2-11 燈具外殼：相機直視 / 鏡面反射看見 → 視為發光（殼整顆亮）
			// 間接 diffuse bounce 打到 → 按 DIFF 處理（維持天花板漸層、不產生陰影）
			if (bounceIsSpecular == TRUE)
			{
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
			rayOrigin = x + nl * uEPS_intersect;
			if (diffuseCount == 1)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				willNeedDiffuseBounceRay = TRUE;
			}
			rayDirection = sampleQuadLight(x, nl, light, weight);
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			continue;
    }

    if (hitType == CLOUD_LIGHT)
    {
			// R2-17 Cloud 漫射燈條：emission=0 視覺幾何，行為同純 DIFF；真光源（lumens / lightNormal / MIS）留 R3
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
			diffuseCount++;
			mask *= hitColor;
			bounceIsSpecular = FALSE;
			rayOrigin = x + nl * uEPS_intersect;
			if (diffuseCount == 1)
			{
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				willNeedDiffuseBounceRay = TRUE;
			}
			rayDirection = sampleQuadLight(x, nl, light, weight);
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
			continue;
    }

    if (hitType == DIFF)
    {
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

			rayOrigin = x + nl * uEPS_intersect;

        if (diffuseCount == 1)
        {
				diffuseBounceMask = mask;
				diffuseBounceRayOrigin = rayOrigin;
				diffuseBounceRayDirection = randomCosWeightedDirectionInHemisphere(nl);
				willNeedDiffuseBounceRay = TRUE;
			}

			rayDirection = sampleQuadLight(x, nl, light, weight);
			mask *= weight * uLegacyGain;
			sampleLight = TRUE;
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
