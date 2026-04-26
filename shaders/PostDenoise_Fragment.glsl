//!! WARNING: 寫回域為 N × per-frame-denoised，不是純 path tracer 累積值
//!! 下游 ScreenOutput * uOneOverSampleCounter 才能還原顯示空間
//!! R6-2/R6-3 SVGF 接此 RT 必須先 / uSampleCounter 還原 per-sample 域
//!! Bloom brightpass 仍讀 pathTracingRT 原值（C-1 案 a），不讀本 RT

precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D tPathTracedImageTexture;  // 累積 RT input（pathTracingRenderTarget）
uniform float uSampleCounter;               // 當前 sample 數（用於 sigma normalize）
uniform float uOneOverSampleCounter;        // 1.0 / sample count（per-sample 域切換）
uniform float uSigmaColor;                  // color weight σ base（由 GUI / config 注入，預設 0）
uniform float uSigmaSpatial;                // spatial weight σ（預設 2.0，全 config 統一）
uniform vec2  uResolution;                  // 渲染解析度（width, height）

out vec4 pc_fragColor;

void main()
{
    ivec2 pix = ivec2(gl_FragCoord.xy);
    vec4  centerPixel = texelFetch(tPathTracedImageTexture, pix, 0);

    // 進入 per-sample 域（HDR-linear）：P1 執行域唯一
    vec3 centerRGB = centerPixel.rgb * uOneOverSampleCounter;

    // 邊緣 pixel 直通（Architect 修訂 #4：centerPixel.a == 1.0 為 walk denoiser 邊緣訊號）
    // 寫回域對稱：先 / uOneOverSampleCounter 還原累積域，供下游 ScreenOutput * uOneOverSampleCounter
    if (centerPixel.a >= 0.999)
    {
        pc_fragColor = vec4(centerRGB / max(uOneOverSampleCounter, 1e-8), centerPixel.a);
        return;
    }

    // sigma normalize（Architect 修訂 #3：高 variance 初期放大 sigma，累積後收斂）
    // sigmaC = uSigmaColor * max(1.0, 4.0 / sqrt(sampleCount))
    float sigmaC = uSigmaColor * max(1.0, 4.0 / sqrt(max(uSampleCounter, 1.0)));
    float sigmaS = uSigmaSpatial;

    // sigmaColor = 0 或 sigmaSpatial = 0 退化（C1/C2 預設值）：純 passthrough
    if (sigmaC < 1e-6 || sigmaS < 1e-6)
    {
        pc_fragColor = vec4(centerRGB / max(uOneOverSampleCounter, 1e-8), centerPixel.a);
        return;
    }

    // 5×5 cross-bilateral kernel
    vec3  sumRGB = vec3(0.0);
    float sumW   = 0.0;

    float twoSigCSq = 2.0 * sigmaC * sigmaC + 1e-8;
    float twoSigSSq = 2.0 * sigmaS * sigmaS + 1e-8;

    for (int dy = -2; dy <= 2; dy++)
    {
        for (int dx = -2; dx <= 2; dx++)
        {
            ivec2 samplePix = pix + ivec2(dx, dy);

            // 邊界守門：截斷超出 RT 的 pixel
            if (samplePix.x < 0 || samplePix.x >= int(uResolution.x) ||
                samplePix.y < 0 || samplePix.y >= int(uResolution.y))
                continue;

            vec4 sampleP   = texelFetch(tPathTracedImageTexture, samplePix, 0);
            vec3 sampleRGB = sampleP.rgb * uOneOverSampleCounter;

            // 鄰域邊緣 pixel spatial weight × 0（Architect 修訂 #4）
            float edgeMask = (sampleP.a >= 0.999) ? 0.0 : 1.0;

            float dS = float(dx * dx + dy * dy);
            vec3  dC = sampleRGB - centerRGB;
            float wS = exp(-dS / twoSigSSq);
            float wC = exp(-dot(dC, dC) / twoSigCSq);
            float w  = wS * wC * edgeMask;

            sumRGB += sampleRGB * w;
            sumW   += w;
        }
    }

    // sumW < 1e-6 fallback：退回中央值
    vec3 outRGB = (sumW > 1e-6) ? (sumRGB / sumW) : centerRGB;

    //!! WARNING: 寫回域為 N × per-frame-denoised，不是純 path tracer 累積值
    //!! 下游 ScreenOutput * uOneOverSampleCounter 才能還原顯示空間
    //!! R6-2/R6-3 SVGF 接此 RT 必須先 / uSampleCounter 還原 per-sample 域
    //!! Bloom brightpass 仍讀 pathTracingRT 原值（C-1 案 a），不讀本 RT
    pc_fragColor = vec4(outRGB / max(uOneOverSampleCounter, 1e-8), centerPixel.a);
}
