precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D tPathTracedImageTexture;
uniform sampler2D tMovementProtectionStableTexture;
uniform float uSampleCounter;
uniform float uOneOverSampleCounter;
uniform float uPixelEdgeSharpness;
uniform float uEdgeSharpenSpeed;
//uniform float uFilterDecaySpeed;
uniform bool uCameraIsMoving;
uniform bool uSceneIsDynamic;
uniform bool uUseToneMapping;
uniform float uMovementProtectionMode;
uniform float uMovementProtectionBlend;
uniform float uMovementProtectionLowSppPreviewStrength;
uniform float uMovementProtectionSpatialPreviewStrength;
uniform float uMovementProtectionWidePreviewStrength;

// R2-UI Bloom：multi-pass 做好的 1/4 解析度 bloom 貼圖，這裡只負責 composite
uniform sampler2D tBloomTexture;
uniform float uBloomIntensity; // 0.0 = 關閉，1.0 = 強
uniform float uBloomDebug;     // R2-UI: 1.0 = 直接顯示 bloom target（diagnostic）
uniform float uSaturation;     // R6: post-tonemap pre-gamma 飽和度，1.0 = 中性，>1 = 加色，<1 = 退色
uniform float uExposure;       // R6 LGG-r10：pre-tonemap HDR 曝光線性倍率，1.0 = 中性（A/B 各自獨立寫入）

// R6 Route X (LGG pivot)：可調百分比的 ACES Filmic tonemap + DaVinci 風格 LGG 調色
// A 模式強制 enabled=0 + 強度=0/1 中性、等效於原始 Reinhard 輸出
uniform float uACESEnabled;   // 0=純 Reinhard、1=啟用 ACES 混合（依 uACESStrength）
uniform float uACESStrength;  // ACES 混合強度 0~1：mix(Reinhard, ACES, uACESStrength)
uniform float uACESSatShadow;    // ACES 暗部飽和 0~2，1=中性
uniform float uACESSatMid;       // ACES 中段飽和 0~2，1=中性
uniform float uACESSatHighlight; // ACES 亮部飽和 0~2，1=中性
uniform float uLGGEnabled;    // 0=跳過 LGG、1=套 Lift/Gamma/Gain（依 uLGGStrength 混血）
uniform float uLGGStrength;   // LGG 整體強度 0~1：mix(原色, 調色後, uLGGStrength)
uniform float uLGGLift;       // 暗部偏移 -0.30 ~ +0.30，0=中性
uniform float uLGGGamma;      // 中間調曲線 0.50 ~ 2.00，1=中性，>1 提亮中間
uniform float uLGGGain;       // 亮部增益 0.50 ~ 1.50，1=中性

// R6 LGG-r30：B 模 White Balance + Hue 後製（display-space 最末端）
// 不是粗糙色彩濾鏡：WB 走 von Kries chromatic adaptation、Hue 走 luma-preserving 色相環旋轉
uniform float uWBB;           // 白平衡 -1=藍冷（≈9000K target）~ +1=黃暖（≈3000K target）
uniform float uHueB;          // 色相環旋轉角度（degrees），-180 ~ +180

// ACES Filmic 近似（Krzysztof Narkowicz 2015）：HDR 輸入、display-linear 輸出
// 跟 Reinhard 比：shoulder 軟過渡（亮區不死白）、foot 優雅滾降（暗區更開層次）
//
// 命名注意：函式名故意避開「ACESFilmicToneMapping」，因 Three.js 在 ShaderMaterial
// toneMapped=true 時自動注入同名函式，重複定義會導致 GLSL compile fail / 黑畫面
vec3 ACESFilmicNarkowicz(vec3 x)
{
	return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 HomeStudioReinhardToneMap(vec3 color)
{
	return color / (color + vec3(1.0));
}

#define TRUE 1
#define FALSE 0

void main()
{
	// First, start with a large blur kernel, which will be used on all diffuse
	// surfaces.  It will blur out the noise, giving a smoother, more uniform color.
	// Starting at the current pixel (centerPixel), the algorithm performs an outward search/walk
	// moving to the immediate neighbor pixels around the center pixel, and then out farther to 
	// more distant neighbors.  If the outward walk doesn't encounter any 'edge' pixels, it will continue
	// until it reaches the maximum extents of the large kernel (a little less than 7x7 pixels, minus the 4
	// corners to give a more rounded kernel filter shape). However, while walking/searching outward from
	// the center pixel, if the walk encounters an 'edge' boundary pixel, it will not blend (average in) with 
	// that pixel, and will stop the search/walk from going any further in that direction. This keeps the edge 
	// boundary pixels non-blurred, and these edges remain sharp in the final image.

	vec4 m37[37];

	vec2 glFragCoord_xy = gl_FragCoord.xy;

	
	m37[ 0] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-1, 3)), 0);
	m37[ 1] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 0, 3)), 0);
	m37[ 2] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 1, 3)), 0);
	m37[ 3] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-2, 2)), 0);
	m37[ 4] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-1, 2)), 0);
	m37[ 5] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 0, 2)), 0);
	m37[ 6] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 1, 2)), 0);
	m37[ 7] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 2, 2)), 0);
	m37[ 8] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-3, 1)), 0);
	m37[ 9] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-2, 1)), 0);
	m37[10] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-1, 1)), 0);
	m37[11] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 0, 1)), 0);
	m37[12] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 1, 1)), 0);
	m37[13] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 2, 1)), 0);
	m37[14] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 3, 1)), 0);
	m37[15] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-3, 0)), 0);
	m37[16] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-2, 0)), 0);
	m37[17] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-1, 0)), 0);
	m37[18] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 0, 0)), 0); // center pixel
	m37[19] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 1, 0)), 0);
	m37[20] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 2, 0)), 0);
	m37[21] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 3, 0)), 0);
	m37[22] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-3,-1)), 0);
	m37[23] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-2,-1)), 0);
	m37[24] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-1,-1)), 0);
	m37[25] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 0,-1)), 0);
	m37[26] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 1,-1)), 0);
	m37[27] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 2,-1)), 0);
	m37[28] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 3,-1)), 0);
	m37[29] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-2,-2)), 0);
	m37[30] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-1,-2)), 0);
	m37[31] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 0,-2)), 0);
	m37[32] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 1,-2)), 0);
	m37[33] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 2,-2)), 0);
	m37[34] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2(-1,-3)), 0);
	m37[35] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 0,-3)), 0);
	m37[36] = texelFetch(tPathTracedImageTexture, ivec2(glFragCoord_xy + vec2( 1,-3)), 0);

	
	vec4 centerPixel = m37[18];
	vec3 filteredPixelColor, edgePixelColor;
	float threshold = 1.0;
	int count = 1;
	int nextToAnEdgePixel = FALSE;

	// start with center pixel rgb color
	filteredPixelColor = centerPixel.rgb;

	// search above
	if (m37[11].a < threshold)
	{
		filteredPixelColor += m37[11].rgb;
		count++; 
		if (m37[5].a < threshold)
		{
			filteredPixelColor += m37[5].rgb;
			count++;
			if (m37[1].a < threshold)
			{
				filteredPixelColor += m37[1].rgb;
				count++;
				if (m37[0].a < threshold)
				{
					filteredPixelColor += m37[0].rgb;
					count++; 
				}
				if (m37[2].a < threshold)
				{
					filteredPixelColor += m37[2].rgb;
					count++; 
				}
			}
		}		
	}
	else
	{
		nextToAnEdgePixel = TRUE;
	}

	

	// search left
	if (m37[17].a < threshold)
	{
		filteredPixelColor += m37[17].rgb;
		count++; 
		if (m37[16].a < threshold)
		{
			filteredPixelColor += m37[16].rgb;
			count++;
			if (m37[15].a < threshold)
			{
				filteredPixelColor += m37[15].rgb;
				count++;
				if (m37[8].a < threshold)
				{
					filteredPixelColor += m37[8].rgb;
					count++; 
				}
				if (m37[22].a < threshold)
				{
					filteredPixelColor += m37[22].rgb;
					count++; 
				}
			}
		}	
	}
	else
	{
		nextToAnEdgePixel = TRUE;
	}

	// search right
	if (m37[19].a < threshold)
	{
		filteredPixelColor += m37[19].rgb;
		count++; 
		if (m37[20].a < threshold)
		{
			filteredPixelColor += m37[20].rgb;
			count++;
			if (m37[21].a < threshold)
			{
				filteredPixelColor += m37[21].rgb;
				count++;
				if (m37[14].a < threshold)
				{
					filteredPixelColor += m37[14].rgb;
					count++; 
				}
				if (m37[28].a < threshold)
				{
					filteredPixelColor += m37[28].rgb;
					count++; 
				}
			}
		}		
	}
	else
	{
		nextToAnEdgePixel = TRUE;
	}

	// search below
	if (m37[25].a < threshold)
	{
		filteredPixelColor += m37[25].rgb;
		count++; 
		if (m37[31].a < threshold)
		{
			filteredPixelColor += m37[31].rgb;
			count++;
			if (m37[35].a < threshold)
			{
				filteredPixelColor += m37[35].rgb;
				count++;
				if (m37[34].a < threshold)
				{
					filteredPixelColor += m37[34].rgb;
					count++; 
				}
				if (m37[36].a < threshold)
				{
					filteredPixelColor += m37[36].rgb;
					count++; 
				}
			}
		}		
	}
	else
	{
		nextToAnEdgePixel = TRUE;
	}

	// search upper-left diagonal
	if (m37[10].a < threshold)
	{
		filteredPixelColor += m37[10].rgb;
		count++; 
		if (m37[3].a < threshold)
		{
			filteredPixelColor += m37[3].rgb;
			count++;
		}		
		if (m37[4].a < threshold)
		{
			filteredPixelColor += m37[4].rgb;
			count++; 
		}
		if (m37[9].a < threshold)
		{
			filteredPixelColor += m37[9].rgb;
			count++; 
		}		
	}

	// search upper-right diagonal
	if (m37[12].a < threshold)
	{
		filteredPixelColor += m37[12].rgb;
		count++; 
		if (m37[6].a < threshold)
		{
			filteredPixelColor += m37[6].rgb;
			count++;
		}		
		if (m37[7].a < threshold)
		{
			filteredPixelColor += m37[7].rgb;
			count++; 
		}
		if (m37[13].a < threshold)
		{
			filteredPixelColor += m37[13].rgb;
			count++; 
		}		
	}

	// search lower-left diagonal
	if (m37[24].a < threshold)
	{
		filteredPixelColor += m37[24].rgb;
		count++; 
		if (m37[23].a < threshold)
		{
			filteredPixelColor += m37[23].rgb;
			count++;
		}		
		if (m37[29].a < threshold)
		{
			filteredPixelColor += m37[29].rgb;
			count++; 
		}
		if (m37[30].a < threshold)
		{
			filteredPixelColor += m37[30].rgb;
			count++; 
		}		
	}

	// search lower-right diagonal
	if (m37[26].a < threshold)
	{
		filteredPixelColor += m37[26].rgb;
		count++; 
		if (m37[27].a < threshold)
		{
			filteredPixelColor += m37[27].rgb;
			count++;
		}		
		if (m37[32].a < threshold)
		{
			filteredPixelColor += m37[32].rgb;
			count++; 
		}
		if (m37[33].a < threshold)
		{
			filteredPixelColor += m37[33].rgb;
			count++; 
		}		
	}
	

	// divide by total count to get the average
	filteredPixelColor *= (1.0 / float(count));
	
	

	// next, use a smaller blur kernel (13 pixels in roughly circular shape), to help blend the noisy, sharp edge pixels

				    // m37[18] is the center pixel
	edgePixelColor = 	       m37[ 5].rgb +
			 m37[10].rgb + m37[11].rgb + m37[12].rgb + 
	   m37[16].rgb + m37[17].rgb + m37[18].rgb + m37[19].rgb + m37[20].rgb +
			 m37[24].rgb + m37[25].rgb + m37[26].rgb +
				       m37[31].rgb;

	// if not averaged, the above additions produce white outlines along edges
	edgePixelColor *= 0.0769230769; // same as dividing by 13 pixels (1 / 13), to get the average

	if (uSceneIsDynamic) // dynamic scene with moving objects and camera (i.e. a game)
	{
		if (uCameraIsMoving)
		{
			if (nextToAnEdgePixel == TRUE)
				filteredPixelColor = mix(edgePixelColor, centerPixel.rgb, 0.25);
		}
		else if (centerPixel.a == 1.0 || nextToAnEdgePixel == TRUE)
			filteredPixelColor = mix(edgePixelColor, centerPixel.rgb, 0.5);
		
	}
	if (!uSceneIsDynamic) // static scene (only camera can move)
	{
		if (uCameraIsMoving)
		{
			if (nextToAnEdgePixel == TRUE)
				filteredPixelColor = mix(edgePixelColor, centerPixel.rgb, 0.25);
		}
		else if (centerPixel.a == 1.0)
			filteredPixelColor = mix(filteredPixelColor, centerPixel.rgb, clamp(uSampleCounter * uEdgeSharpenSpeed, 0.0, 1.0));
		// the following statement helps smooth out jagged stairstepping where the blurred filteredPixelColor pixels meet the sharp edges
		else if (uSampleCounter > 250.0 && nextToAnEdgePixel == TRUE)
		 	filteredPixelColor = centerPixel.rgb;
		
	}

	// if the .a value comes into this shader as 1.01, this is an outdoor raymarching demo, and no denoising/blended is needed 
	if (centerPixel.a == 1.01) 
		filteredPixelColor = centerPixel.rgb; // no blending, maximum sharpness
	
	
	// final filteredPixelColor processing ////////////////////////////////////

	// average accumulation buffer
	filteredPixelColor *= uOneOverSampleCounter;

	if (uMovementProtectionWidePreviewStrength > 0.0)
	{
		float wideStrength = clamp(uMovementProtectionWidePreviewStrength, 0.0, 1.0);
		vec3 movementWidePreviewSum =
			m37[ 0].rgb + m37[ 1].rgb + m37[ 2].rgb + m37[ 3].rgb + m37[ 4].rgb +
			m37[ 5].rgb + m37[ 6].rgb + m37[ 7].rgb + m37[ 8].rgb + m37[ 9].rgb +
			m37[10].rgb + m37[11].rgb + m37[12].rgb + m37[13].rgb + m37[14].rgb +
			m37[15].rgb + m37[16].rgb + m37[17].rgb + m37[18].rgb + m37[19].rgb +
			m37[20].rgb + m37[21].rgb + m37[22].rgb + m37[23].rgb + m37[24].rgb +
			m37[25].rgb + m37[26].rgb + m37[27].rgb + m37[28].rgb + m37[29].rgb +
			m37[30].rgb + m37[31].rgb + m37[32].rgb + m37[33].rgb + m37[34].rgb +
			m37[35].rgb + m37[36].rgb;
		vec3 movementWidePreviewHdr = movementWidePreviewSum * (uOneOverSampleCounter / 37.0);
		float movementCenterLumaWide = dot(filteredPixelColor, vec3(0.299, 0.587, 0.114));
		float movementWideLuma = dot(movementWidePreviewHdr, vec3(0.299, 0.587, 0.114));
		float movementWideBrightLimit = movementWideLuma * 1.08 + 0.018;
		vec3 movementWideClampedHdr = filteredPixelColor;

		if (movementCenterLumaWide > movementWideBrightLimit && movementCenterLumaWide > 0.0001)
			movementWideClampedHdr *= movementWideBrightLimit / movementCenterLumaWide;
		movementWideClampedHdr = mix(movementWideClampedHdr, movementWidePreviewHdr, 0.82);
		filteredPixelColor = mix(filteredPixelColor, movementWideClampedHdr, wideStrength);
	}

	if (uMovementProtectionSpatialPreviewStrength > 0.0)
	{
		float spatialStrength = clamp(uMovementProtectionSpatialPreviewStrength, 0.0, 1.0);
		vec3 movementSpatialPreviewHdr = edgePixelColor * uOneOverSampleCounter;
		float movementCenterLuma = dot(filteredPixelColor, vec3(0.299, 0.587, 0.114));
		float movementSpatialLuma = dot(movementSpatialPreviewHdr, vec3(0.299, 0.587, 0.114));
		float movementBrightLimit = movementSpatialLuma * 1.18 + 0.025;
		float movementDarkLift = movementSpatialLuma * 0.70;
		vec3 movementClampedHdr = filteredPixelColor;

		if (movementCenterLuma > movementBrightLimit && movementCenterLuma > 0.0001)
			movementClampedHdr *= movementBrightLimit / movementCenterLuma;
		if (movementCenterLuma < movementDarkLift)
			movementClampedHdr = mix(movementClampedHdr, movementSpatialPreviewHdr, 0.55);

		vec3 movementSpatialMixHdr = mix(movementClampedHdr, movementSpatialPreviewHdr, 0.55);
		filteredPixelColor = mix(filteredPixelColor, movementSpatialMixHdr, spatialStrength);
	}

	// R2-UI Bloom：multi-pass composite（1 次 bilinear fetch，上採樣 1/4 res bloom 貼圖）
	// debug on 時直接顯示 bloom target（verify pipeline，全黑 = brightpass 砍光或 STEP 2.5 未跑）
	if (uBloomDebug > 0.5)
	{
		vec2 fullResSize = vec2(textureSize(tPathTracedImageTexture, 0));
		filteredPixelColor = texture(tBloomTexture, glFragCoord_xy / fullResSize).rgb;
	}
	else if (uBloomIntensity > 0.0)
	{
		vec2 fullResSize = vec2(textureSize(tPathTracedImageTexture, 0));
		vec3 bloom = texture(tBloomTexture, glFragCoord_xy / fullResSize).rgb;
		filteredPixelColor += bloom * uBloomIntensity;
	}

	// R6 LGG-r11：pre-tonemap HDR 曝光（P1：tonemap 前線性倍率，給 A/B 抓 ACES 甜蜜點）
	// gate 在 uACESEnabled — ACES 關閉時自動退回原始 Reinhard 純畫面，方便比對
	if (uACESEnabled > 0.5)
	{
		filteredPixelColor *= uExposure;
	}

	// R6: pre-tonemap 飽和度補償 + chroma-mask（低彩度全力推、高彩度幾乎不動，
	// 解「白牆要色溢、軌道燈/家具不要被多染」需求；HSV-style saturation 度量）
	// + 自動白平衡補償（補紅/補藍消除 chroma-mask 在低彩度暖色傾向區造成的黃綠色偏）
	if (uSaturation != 1.0)
	{
		float maxC = max(filteredPixelColor.r, max(filteredPixelColor.g, filteredPixelColor.b));
		float minC = min(filteredPixelColor.r, min(filteredPixelColor.g, filteredPixelColor.b));
		float chromaNorm = maxC > 0.0001 ? (maxC - minC) / maxC : 0.0;
		float satMask = 1.0 - smoothstep(0.15, 0.85, chromaNorm);
		float effectiveSat = mix(1.0, uSaturation, satMask);
		float luma = dot(filteredPixelColor, vec3(0.299, 0.587, 0.114));
		filteredPixelColor = mix(vec3(luma), filteredPixelColor, effectiveSat);

		if (uSaturation > 1.0)
		{
			float comp = (uSaturation - 1.0) * satMask;
			filteredPixelColor.r *= 1.0 + comp * 0.12; // 補紅（抗綠）
			filteredPixelColor.b *= 1.0 + comp * 0.12; // 補藍（抗黃）
		}
	}

	// 色調映射：HDR 壓回 0~1 顯示範圍
	// 啟用時 → mix(Reinhard, ACES, strength) 線性混合兩條 tonemap，平滑控電影感比例
	if (uUseToneMapping)
	{
		vec3 reinhard = HomeStudioReinhardToneMap(filteredPixelColor);
		if (uACESEnabled > 0.5)
		{
			vec3 aces = ACESFilmicNarkowicz(filteredPixelColor);
			filteredPixelColor = mix(reinhard, aces, clamp(uACESStrength, 0.0, 1.0));
		}
		else
		{
			filteredPixelColor = reinhard;
		}
	}

	// gamma 校正：linear → display sRGB
	vec3 displayColor = sqrt(filteredPixelColor);

	// LGG 調色（DaVinci Lift/Gamma/Gain）：display 空間作用、滑桿刻度跟眼睛一致
	//   Lift  ：暗部偏移
	//   Gain  ：亮部增益
	//   Gamma ：中間調曲線
	// uLGGStrength = 整體強度，0=不套、1=完整套；0~1 之間在原色與調色後線性混合
	if (uLGGEnabled > 0.5)
	{
		vec3 graded = displayColor;
		graded += uLGGLift * (1.0 - graded);
		graded *= uLGGGain;
		graded = pow(max(graded, vec3(0.0)), vec3(1.0 / max(uLGGGamma, 0.01)));
		displayColor = mix(displayColor, graded, clamp(uLGGStrength, 0.0, 1.0));
	}

	// ACES 三段飽和補償（gate 在 uACESEnabled、display 空間作用）
	// 用 luma-band mask 讓三條 SAT 各自負責暗 / 中 / 亮 區
	//   暗 SAT: 0~0.5 luma 區漸增權重
	//   中 SAT: 0.25~0.75 luma 區峰值
	//   亮 SAT: 0.5~1.0 luma 區漸增權重
	// 三個 mask 加總 = 1.0（保證單調過渡、無斷層）
	if (uACESEnabled > 0.5)
	{
		float lumaSat = dot(displayColor, vec3(0.299, 0.587, 0.114));
		float shadowMask    = 1.0 - smoothstep(0.0, 0.5, lumaSat);
		float highlightMask = smoothstep(0.5, 1.0, lumaSat);
		float midMask       = 1.0 - shadowMask - highlightMask;

		float effectiveSat = uACESSatShadow * shadowMask
		                   + uACESSatMid * midMask
		                   + uACESSatHighlight * highlightMask;

		displayColor = mix(vec3(lumaSat), displayColor, effectiveSat);
	}

	// R6 LGG-r30：White Balance（display-space 最末端、純後製、不觸發採樣重置）
	// 數學：D65 → 目標 illuminant 的 von Kries-style RGB ratio
	//   端點 +1 ≈ 3000K Tungsten（warm）目標：R 升 25%、B 降 35%
	//   端點 -1 ≈ 9000K cool target           ：R 降 15%、B 升 18%
	//   G channel 在 D illuminant 上幾乎不變（Y 為支點），微調保比例
	if (uWBB != 0.0)
	{
		vec3 wbScale = uWBB > 0.0
			? mix(vec3(1.0), vec3(1.25, 1.00, 0.65), uWBB)   // warm
			: mix(vec3(1.0), vec3(0.85, 1.00, 1.18), -uWBB); // cool
		displayColor *= wbScale;
	}

	// R6 LGG-r30：Hue 色相環旋轉（NTSC luma-preserving，繞 (1,1,1)/√3 軸）
	// 紅 → 橘 → 黃 → 綠 → 青 → 藍 → 紫 → 紅，整環平移、不偏色不染色
	if (uHueB != 0.0)
	{
		float h = radians(uHueB);
		float c = cos(h);
		float s = sin(h);
		mat3 hueM = mat3(
			0.299 + 0.701 * c + 0.168 * s,
			0.299 - 0.299 * c - 0.328 * s,
			0.299 - 0.300 * c + 1.250 * s,
			0.587 - 0.587 * c + 0.330 * s,
			0.587 + 0.413 * c + 0.035 * s,
			0.587 - 0.588 * c - 1.050 * s,
			0.114 - 0.114 * c - 0.497 * s,
			0.114 - 0.114 * c + 0.292 * s,
			0.114 + 0.886 * c - 0.203 * s
		);
		displayColor = max(hueM * displayColor, vec3(0.0));
	}

	if (uMovementProtectionMode > 0.5 && uMovementProtectionBlend > 0.0)
	{
		vec3 movementStableColor = texelFetch(tMovementProtectionStableTexture, ivec2(glFragCoord_xy), 0).rgb;
		float movementBlend = clamp(uMovementProtectionBlend, 0.0, 0.95);
		displayColor = mix(displayColor, movementStableColor, movementBlend);
	}
	if (uMovementProtectionLowSppPreviewStrength > 0.0)
	{
		float previewStrength = clamp(uMovementProtectionLowSppPreviewStrength, 0.0, 1.0);
		vec3 movementPreviewColor = pow(max(displayColor, vec3(0.0)), vec3(0.62));
		movementPreviewColor = min(movementPreviewColor, vec3(0.86));
		displayColor = mix(displayColor, movementPreviewColor, previewStrength);
	}

	pc_fragColor = vec4(displayColor, 1.0);
}
