// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_VL.glsl:46
// Pass: 001 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(VL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.012326053, 0.050769784, 0.1278702, -0.100782245, 0.14329414, -0.054558773, 0.023473471, 0.056829426, 0.048292916, 0.0046510273, -0.11478287, 0.0011030561, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(0.29542983, -0.55061895, -0.068554066, 0.1433222, -0.072878316, 0.30201668, -0.2223378, -0.06704077, 0.16955832, 0.3279914, 0.17619601, -0.1276919, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(0.09623417, 0.30559412, 0.094622105, -0.076706685, 0.07943858, -0.084815115, 0.12472551, 0.079850115, -0.13044213, -0.21300878, -0.095747225, 0.13412355, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.21291664, 0.17195296, -0.20080926, 0.1064855, 0.10228669, -0.09580175, -0.11217631, -0.09740562, -0.0033135475, -0.053094357, 0.2983595, 0.035281878, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.08955812, -0.45707774, -0.4606922, -0.5754473, -0.11395895, 0.33530128, 0.29705846, -0.18877256, -0.43502945, 0.114171304, -0.3750776, -0.081597246, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(-0.26109028, 0.02662961, -0.10441071, 0.11199392, -0.12038989, -0.09642296, -0.061320662, -0.33058178, 0.20212512, 0.00840794, 0.14357455, -0.038080238, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.09533881, -0.13644339, 0.068756215, 0.079305276, -0.053370547, 0.19572955, 0.0682981, 0.14469264, 0.15582883, -0.057183057, -0.13919263, -0.016394936, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(-0.041189935, 0.39878023, 0.028704925, 0.30194348, -0.04486593, -0.33899093, -0.103968106, 0.21802065, -0.077099144, -0.07389541, 0.18069103, 0.18894517, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.12399862, 0.19246885, 0.034825478, -0.0044787163, 0.13121822, -0.13573012, -0.030162754, 0.1899518, 0.102326415, -0.061512686, -0.005647928, -0.0937634, 0.0, 0.0, 0.0, 0.0));
    result += float4(0.019286277, -0.033644073, 0.08196311, 0.0054393094);
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
