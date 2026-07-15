// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_UL.glsl:45
// Pass: 001 - Anime4K-v4.0-Restore-CNN-(UL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.44157687, 0.1715858, -0.11000502, 0.062367063, 0.21790773, 0.15507151, 0.14760862, -0.2598815, 0.14098467, 0.14019097, -0.26298222, 0.10975315, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(0.15774319, -0.16769339, -0.49734345, -0.3935963, 0.115124024, -0.08045373, 0.55867237, 0.48593813, 0.058544844, -0.2705686, 0.3303555, 0.4181385, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(0.16588609, -0.013389144, 0.06600297, -0.09309111, -0.36321074, -0.13877828, 0.4099233, 0.20805255, 0.31892648, 0.16856939, -0.23898357, 0.11751563, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.39999864, 0.46407622, -0.12249342, -0.09798957, 0.122675434, 0.18265116, 0.030651823, 0.14682484, -0.42969155, 0.2486042, 0.13566706, -0.13458017, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.12757893, -0.19025628, -0.16728874, -0.10162156, -0.1577721, -0.174548, 0.29329458, 0.17963637, -0.43279588, 0.088979766, 0.06334896, -0.047701746, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(-0.14359929, -0.12800618, -0.15429202, 0.034745168, 0.15794043, -0.086441815, -0.06520017, 0.26176664, -0.022253495, -0.34480432, -0.009120493, 0.08706416, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.1994137, 0.070990525, 0.3388379, 0.37502727, -0.116911314, 0.2160554, -0.1831974, -0.04184975, 0.2545874, -0.083908126, -0.19057468, -0.13382773, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(-0.46475947, -0.23414738, -0.036689937, 0.018558737, -0.32609373, 0.15265512, -0.055894423, -0.3676328, 0.24501368, 0.12390915, 0.13458043, -0.30162823, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(0.12621075, 0.046852987, 0.17333286, 0.18997045, 0.3245911, -0.28809196, -0.3660882, -0.5916272, -0.11456223, -0.030912774, 0.17037971, -0.12640971, 0.0, 0.0, 0.0, 0.0));
    result += float4(0.42778614, 0.054881692, -0.23388587, -0.031204376);
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
