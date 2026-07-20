// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/acnet/acnet_f8b4.glsl:1
// Pass: 000 - ACNet F8B4 head conv 1x8x3x3 part 0
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
    float4 result = float4(-0.9520906, 0.013774246, -0.4940886, 0.13375327);
    result += float4(-0.0014878281, -0.7632004, 0.19272894, 0.46537745) * LUMA_texOff(float2(-1.0, -1.0)).x;
    result += float4(-1.3460438, 0.18894365, -0.0490235, -0.9890594) * LUMA_texOff(float2(0.0, -1.0)).x;
    result += float4(0.32281575, 1.4070463, 0.37536892, -0.37987557) * LUMA_texOff(float2(1.0, -1.0)).x;
    result += float4(-0.65934813, 3.253703, -0.10119856, -1.7713721) * LUMA_texOff(float2(-1.0, 0.0)).x;
    result += float4(5.563184, -5.9529715, -2.4931717, 7.4821305) * LUMA_texOff(float2(0.0, 0.0)).x;
    result += float4(-2.1096349, 0.7543952, -0.3000822, -2.676932) * LUMA_texOff(float2(1.0, 0.0)).x;
    result += float4(-0.11039619, -0.27639085, 0.14380127, -0.094028816) * LUMA_texOff(float2(-1.0, 1.0)).x;
    result += float4(-1.2408149, 1.8090338, 0.122120835, -1.6043427) * LUMA_texOff(float2(0.0, 1.0)).x;
    result += float4(0.53610414, -0.3941251, 0.46432167, -0.23128629) * LUMA_texOff(float2(1.0, 1.0)).x;
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(0.25083545, -0.85913664, 0.38589597, 0.73232096) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
