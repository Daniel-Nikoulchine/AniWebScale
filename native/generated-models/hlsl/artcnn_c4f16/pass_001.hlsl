// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:46
// Pass: 001 - ArtCNN C4F16 (Conv2D)
// ArtCNN is Copyright (c) 2024 Joao Chrisostomo, MIT licensed.

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
    float4 result = float4(-0.03129763, -0.0049467376, 0.00037890198, -0.00013635434);
    result += float4(0.09592724, -0.10194435, -0.0900127, 0.03374457) * LUMA_texOff(float2(-1, -1)).x;
    result += float4(-0.08230421, -0.014539967, 0.013489162, -0.21935785) * LUMA_texOff(float2(0, -1)).x;
    result += float4(0.07439707, 0.134547, 0.07296409, 0.17874344) * LUMA_texOff(float2(1, -1)).x;
    result += float4(-0.06252981, 0.101940714, 0.07085207, -0.0379011) * LUMA_texOff(float2(-1, 0)).x;
    result += float4(0.1163111, -0.20070547, 0.119351804, 0.20376374) * LUMA_texOff(float2(0, 0)).x;
    result += float4(-0.13869284, 0.27412337, -0.18156466, -0.15480605) * LUMA_texOff(float2(1, 0)).x;
    result += float4(0.06742909, 0.0010298961, 0.025103793, 0.000714324) * LUMA_texOff(float2(-1, 1)).x;
    result += float4(0.08326273, -0.26306987, -0.13020906, 0.02377169) * LUMA_texOff(float2(0, 1)).x;
    result += float4(-0.09263031, 0.07067653, 0.09775801, -0.028085424) * LUMA_texOff(float2(1, 1)).x;
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
