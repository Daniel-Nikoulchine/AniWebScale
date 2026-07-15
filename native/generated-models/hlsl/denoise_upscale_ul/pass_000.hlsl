// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_UL.glsl:24
// Pass: 000 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(UL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.21481565, -0.0914136, -0.067639425, -0.13521406, 0.14386347, -0.007917821, -0.0018606511, -0.07272963, 0.09651574, 0.09874618, 0.06434639, 0.1787858, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.06402414, -0.014693245, -0.25395226, 0.2960157, -0.12494867, 0.17711689, 0.31812787, -0.22346497, -0.1172598, -0.17087954, -0.031076867, -0.26865217, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.19254248, -0.049369957, 0.08171505, -0.12660322, 0.11544268, 0.15840095, -0.11473022, 0.144489, 0.07068809, 0.041438796, 0.10749463, -0.057156503, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.040826935, 0.0030781324, 0.094986334, -0.2573781, -0.11649985, 0.018165307, 0.039985053, -0.15652324, -0.014886749, -0.00988401, -0.15025067, -0.0031970344, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.15658751, 0.08227927, 0.23491348, 0.29900867, -0.45667845, 0.0438649, -0.39066258, 0.6590342, 0.009331404, 0.097770594, 0.21618316, 0.25005254, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(-0.16455166, 0.013149855, 0.21515559, 0.03110101, -0.008973558, 0.33310282, -0.03276024, -0.3356557, 0.007899698, 0.295166, -0.73289853, 0.16696596, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(0.2691608, 0.09478436, 0.006536417, -0.04095308, -0.10942356, -0.0481289, -0.039660163, -0.20591366, -0.08013109, -0.052268907, 0.046878606, -0.024840442, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.17120434, -0.06828329, -0.23515487, 0.11830264, 0.67815524, -0.10693793, 0.2392081, -0.3192851, 0.06719006, -0.03441811, 0.020009553, -0.21328516, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(0.30072933, 0.0348702, 0.15155697, -0.15580897, -0.12755825, -0.57249874, -0.10091004, 0.22914392, -0.017671, -0.26088336, -0.00079997425, -0.022365946, 0.0, 0.0, 0.0, 0.0));
    result += float4(0.0366252, 0.028346894, 0.033923555, 0.00025824012);
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
