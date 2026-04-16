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

// ISO-PUCK
uniform vec3 uPuckPositions[8];
uniform float uPuckRadius;
uniform float uPuckHalfH;

#define BACKDROP 5
#define SPEAKER 6
#define WOOD_DOOR 7
#define IRON_DOOR 8

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

#define N_QUADS 1

vec3 rayOrigin, rayDirection;
vec3 hitNormal, hitEmission, hitColor;
vec3 hitBoxMin, hitBoxMax;
vec3 hitObjNormal;  // 旋轉物件的物件空間法向量
vec3 hitObjPos;     // 旋轉物件的物件空間命中點
vec3 hitObjHalf;    // 旋轉物件的 half-size
vec2 hitUV;
float hitObjectID;
int hitType = -100;

struct Quad { vec3 normal; vec3 v0; vec3 v1; vec3 v2; vec3 v3; vec3 emission; vec3 color; int type; };

Quad quads[N_QUADS];

#include <pathtracing_random_functions>

#include <pathtracing_quad_intersect>

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

// Box data: 4 pixels per box in tBoxDataTexture
// pixel 4i:   [emission.rgb, type]
// pixel 4i+1: [color.rgb, rotY]
// pixel 4i+2: [min.xyz, reserved]
// pixel 4i+3: [max.xyz, reserved]

void fetchBoxData(int idx, out vec3 emission, out int type, out vec3 color, out vec3 bMin, out vec3 bMax) {
	int base = idx * 4;
	vec4 p0 = texelFetch(tBoxDataTexture, ivec2(base, 0), 0);
	vec4 p1 = texelFetch(tBoxDataTexture, ivec2(base + 1, 0), 0);
	vec4 p2 = texelFetch(tBoxDataTexture, ivec2(base + 2, 0), 0);
	vec4 p3 = texelFetch(tBoxDataTexture, ivec2(base + 3, 0), 0);
	emission = p0.xyz;
	type     = int(p0.w);
	color    = p1.xyz;
	bMin     = p2.xyz;
	bMax     = p3.xyz;
}


float SceneIntersect( )
{
	vec3 normal, n;
    float d;
	float t = INFINITY;
	int objectCount = 0;

	hitObjectID = -INFINITY;

	// 1) Quad light (always checked, not in BVH)
	d = QuadIntersect( quads[0].v0, quads[0].v1, quads[0].v2, quads[0].v3, rayOrigin, rayDirection, FALSE );
	if (d < t)
	{
		t = d;
		hitNormal = quads[0].normal;
		hitEmission = quads[0].emission;
		hitColor = quads[0].color;
		hitType = quads[0].type;
		hitObjectID = float(objectCount);
	}
	objectCount++;

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
			fetchBoxData(boxIdx, boxEmission, boxType, boxColor, boxMin, boxMax);

			d = BoxIntersect(boxMin, boxMax, rayOrigin, rayDirection, n, isRayExiting);
			if (d < t && n != vec3(0,0,0))
			{
				t = d;
				hitNormal = n;
				hitEmission = boxEmission;
				hitColor = boxColor;
				hitType = boxType;
				hitBoxMin = boxMin;
				hitBoxMax = boxMax;
				hitObjectID = float(objectCount + boxIdx);
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

	// helper macro: 標準 box 測試（底座、頂板）
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
			hitObjectID = float(objectCount + 100 + IDX); \
		} \
	}

	// helper macro: stadium 支柱測試
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
			hitObjectID = float(objectCount + 200 + pi);
		}
	}

	return t;
}


vec3 CalculateRadiance( out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
{
    Quad light = quads[0];

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


	for (int bounces = 0; bounces < 10; bounces++)
	{
		previousIntersecType = hitType;

		t = SceneIntersect();

		if (t == INFINITY)
		{
			if (bounces == 0 || (bounces == 1 && previousIntersecType == SPEC))
				pixelSharpness = 1.0;

			if (willNeedDiffuseBounceRay == TRUE)
			{
				mask = diffuseBounceMask;
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
			if (hitType == BACKDROP || hitType == SPEAKER || hitType == WOOD_DOOR || hitType == IRON_DOOR)
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
				mask = diffuseBounceMask;
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
				mask = diffuseBounceMask;
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
			mask *= weight * 1.5;
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
			mask *= weight * 1.5;
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
			// metalness=1.0：貼圖色調作為反射色，roughness=0.3 擾動反射方向
			mask *= hitColor;
			vec3 reflDir = reflect(rayDirection, nl);
			vec3 diffDir = randomCosWeightedDirectionInHemisphere(nl);
			rayDirection = normalize(mix(reflDir, diffDir, 0.09)); // 0.3² = 0.09
			rayOrigin = x + nl * uEPS_intersect;
			continue;
		}

    if (hitType == DIFF)
    {
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
			mask *= weight * 1.5;
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
	vec3 L1 = vec3(1.0, 0.95, 0.8) * 8.0;

	quads[0] = Quad( vec3(0.0, -1.0, 0.0),
	                 vec3(-0.5, 2.90, -0.5),
	                 vec3(0.5, 2.90, -0.5),
	                 vec3(0.5, 2.90, 0.5),
	                 vec3(-0.5, 2.90, 0.5),
	                 L1, z, LIGHT);
}


#include <pathtracing_main>
