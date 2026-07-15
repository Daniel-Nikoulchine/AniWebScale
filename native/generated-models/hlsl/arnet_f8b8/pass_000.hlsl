// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:1
// Pass: 000 - ARNet F8B8 head conv 1x8x3x3 part 0
// ACNetGLSL is Copyright (c) 2020 TianZer, MIT licensed.

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
    float luma = dot(value.rgb, float3(0.2126, 0.7152, 0.0722));
    return float4(luma, 0.0, 0.0, 1.0);
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

#define LUMA_tex(position) Anime4KSample0(position)
#define LUMA_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define LUMA_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define LUMA_pos anime4k_pos
#define LUMA_size float2(Anime4KInputSizes[0].xy)
#define LUMA_pt rcp(LUMA_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.08493366, -0.2786129, -0.58670616, -0.51802194);
    result += float4(0.077919364, -0.04769914, -0.010180572, -0.274473) * LUMA_texOff(float2(-1.0, -1.0)).x;
    result += float4(-0.25197005, -0.47258818, -0.124250084, -1.3711518) * LUMA_texOff(float2(0.0, -1.0)).x;
    result += float4(0.058012925, -0.30048227, -0.12747297, -0.021991564) * LUMA_texOff(float2(1.0, -1.0)).x;
    result += float4(0.0790147, -0.047865253, -0.0006321799, -0.77488947) * LUMA_texOff(float2(-1.0, 0.0)).x;
    result += float4(2.102238, 5.6661806, 1.481504, 6.1054325) * LUMA_texOff(float2(0.0, 0.0)).x;
    result += float4(-1.1490909, -1.564071, 0.269017, -0.95578444) * LUMA_texOff(float2(1.0, 0.0)).x;
    result += float4(-0.1553921, -0.09371717, -0.016118424, -0.07445497) * LUMA_texOff(float2(-1.0, 1.0)).x;
    result += float4(-0.5012672, -1.4881132, -0.050368603, -0.8994223) * LUMA_texOff(float2(0.0, 1.0)).x;
    result += float4(0.078897454, -0.7724702, -0.29424444, -0.48471436) * LUMA_texOff(float2(1.0, 1.0)).x;
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
