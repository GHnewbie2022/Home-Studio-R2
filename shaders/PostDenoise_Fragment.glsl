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

// pc_fragColor 由 erichlof framework 自動 inject（對齊 ScreenOutput_Fragment.glsl 範式）
// 嚴禁在此重複宣告 out vec4 pc_fragColor；會與 framework prefix 衝突造成編譯失敗

void main()
{
    ivec2 pix = ivec2(gl_FragCoord.xy);
    vec4  centerPixel = texelFetch(tPathTracedImageTexture, pix, 0);

    // 進入 per-sample 域（HDR-linear）：P1 執行域唯一
    vec3 centerRGB = centerPixel.rgb * uOneOverSampleCounter;

    // R6-1 step3-fix03：移除 pixelSharpness（centerPixel.a）守門
    // 原 ralplan v3 Architect 修訂 #4 假設 a=1.0 為「邊緣 pixel」直通，
    // 實際 erichlof framework 的 pixelSharpness 是 walk denoiser 用來
    // 保留 sharpness 的 pixel 標記（家具/光源/貼圖 fwidge 觸發），
    // 並非 bilateral 該借用的 edge mask。
    // 結果：a=1.0 直通讓家具/光源全跳過 bilateral，只剩牆壁 a=0.0 被降噪。
    // 修：cross-bilateral 自身 sigma_color 已能「顏色不同 weight≈0」保邊，
    // 不需 a 旗標守門。

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

            // step3-fix03：移除鄰域邊緣 edgeMask（pixelSharpness 不是 bilateral edge mask）
            float dS = float(dx * dx + dy * dy);
            vec3  dC = sampleRGB - centerRGB;
            float wS = exp(-dS / twoSigSSq);
            float wC = exp(-dot(dC, dC) / twoSigCSq);
            float w  = wS * wC;

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
