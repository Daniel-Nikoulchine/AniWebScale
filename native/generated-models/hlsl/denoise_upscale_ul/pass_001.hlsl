// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_UL.glsl:46
// Pass: 001 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(UL)-Conv-4x3x3x3
// Anime4K is Copyright (c) 2019-2021 bloc97, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[1];
};

Texture2D<float4> Anime4KInput0 : register(t0);
SamplerState Anime4KLinearClampSampler : register(s0);
RWTexture2D<float4> Anime4KOutput : register(u0);

float4 Anime4KTransform0(float4 value)
{
    return value;
}

float2 Anime4KClampUv0(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[0].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample0(float2 uv)
{
    return Anime4KTransform0(float4(Anime4KInput0.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv0(uv), 0.0)));
}

float4 Anime4KLoadOffset0(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[0].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform0(float4(Anime4KInput0.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent0(uint2 position)
{
    return Anime4KTransform0(float4(Anime4KInput0.Load(int3(position, 0))));
}

#define MAIN_tex(position) Anime4KSample0(position)
#define MAIN_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define MAIN_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define MAIN_pos anime4k_pos
#define MAIN_size float2(Anime4KInputSizes[0].xy)
#define MAIN_pt rcp(MAIN_size)

#define go_0(x_off, y_off) (MAIN_texOff(float2(x_off, y_off)))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.042849753, -0.11642484, 0.073895186, 0.15186316, -0.024499241, 0.056690346, 0.05013788, -0.10182528, -0.024302427, 0.06578479, -0.028199008, -0.070577, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.040659044, 0.22913207, -0.1847038, -0.11781796, 0.044752445, 0.009552658, -0.11374249, 0.12798874, 0.056919675, -0.20839268, 0.11021251, 0.044297826, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.009999239, 0.1996945, -0.29797587, -0.4280957, -0.008521183, -0.10773894, 0.22186345, 0.254737, -0.003993275, -0.07186837, 0.16690473, 0.19043307, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(-0.16174923, 0.26882383, 0.50559163, 0.38955548, 0.14091976, -0.15637094, -0.11826545, -0.23424837, 0.01674066, -0.08578336, -0.16907434, -0.19845173, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(0.10735882, -0.016069679, 0.42237386, -0.19937111, 0.07271503, 0.07596921, -0.24035113, 0.12406044, 0.059160866, -0.051063746, -0.36897844, 0.061272774, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.015712388, -0.34878746, -0.66418105, -0.35441992, -0.12208571, 0.042238027, 0.30143425, 0.3610614, -0.09538538, 0.25334427, 0.24629802, 0.030739667, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.0035519397, 0.07191882, -0.20775351, -0.15425798, 0.07919461, 0.07578178, 0.12668823, 0.0011835548, 0.03245292, -0.105801836, 0.24585879, 0.13730717, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.2415042, -0.16800308, 0.48690978, 0.75166744, 0.3876131, 0.038878918, -0.3293806, -0.47433355, 0.057803743, 0.09533431, -0.1342232, -0.2982094, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.18697992, -0.60250723, -0.11149202, -0.015566043, -0.57483697, 0.07203411, 0.050863862, -0.078300595, -0.09433572, 0.27099958, -0.03195694, 0.10535165, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.043337345, 0.16099554, -0.030338328, 0.0074565704);
    return result;
}

[numthreads(8, 8, 1)]
void main(uint3 dispatchThreadId : SV_DispatchThreadID)
{
    if (dispatchThreadId.x >= Anime4KOutputSize.x || dispatchThreadId.y >= Anime4KOutputSize.y)
    {
        return;
    }

    float2 anime4k_pos = (float2(dispatchThreadId.xy) + 0.5) / float2(Anime4KOutputSize);
    Anime4KOutput[dispatchThreadId.xy] = Anime4KHook(anime4k_pos, dispatchThreadId.xy);
}
