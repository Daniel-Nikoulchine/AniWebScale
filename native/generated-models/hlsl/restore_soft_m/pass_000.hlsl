// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_M.glsl:24
// Pass: 000 - Anime4K-v4.0-Restore-CNN-Soft-(M)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.073079124, 0.11507942, 0.028201895, -0.021776304, -0.25251916, -0.08662003, 0.38814726, 0.4146095, 0.06326891, 0.01635252, 0.06423356, 0.13488062, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.059791833, -0.03105604, 0.041643705, 0.35197195, -0.17314838, 0.067622855, -0.032012507, 0.09691628, -0.11094062, 0.007625051, 0.094762206, -0.05824145, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.120281175, 0.027440755, -0.026316144, -0.025291128, -0.41698205, -0.05966847, -0.28400028, -0.06946398, -0.10906026, -0.015854035, -0.028724853, -0.06626416, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.068752654, -0.12652585, 0.38200122, 0.17978846, 0.2749825, 0.015504972, 0.21765926, 0.2246602, -0.062151223, 0.07457783, 0.13588274, -0.037328478, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(0.3718559, 0.025637252, -0.4048626, -0.41484925, 0.24768798, 0.09984098, -0.5663632, -0.6659978, 0.212067, -0.08328392, -0.5277322, -0.016879432, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(-0.11072714, -0.010321538, 0.11265787, 0.0055236337, -0.13345073, 0.004847663, 0.3744461, -0.4038564, -0.09893075, 0.031325124, 0.2883957, -0.04268903, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(0.10444391, -0.60588187, 0.02543334, 0.10911738, -0.10860678, 0.15701362, 0.29235297, 0.045803998, 0.076250754, -0.10799697, 0.08841044, 0.08145623, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(-0.04246739, -0.1225759, 0.11280305, -0.12079673, 0.5289142, -0.011892906, -0.0800465, 0.05915611, -0.126204, 0.08239301, -0.0092391195, -0.07672885, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.11922264, 0.14036109, -0.09491126, 0.05112697, -0.12543046, -0.08662423, -0.041537095, 0.048038274, 0.11672854, -0.006516173, -0.023524825, 0.030505095, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.07697861, 0.41154122, 0.042374082, -0.087270625);
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
