// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:23
// Pass: 000 - ArtCNN C4F16 (Conv2D)
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
    float4 result = float4(-0.0018689432, -0.012094381, -0.011144273, -0.06938418);
    result += float4(-0.020989329, -0.16709405, 0.015771111, 0.010347125) * LUMA_texOff(float2(-1, -1)).x;
    result += float4(0.033658344, 0.1800454, 0.13569914, 0.1322191) * LUMA_texOff(float2(0, -1)).x;
    result += float4(0.0063243555, 0.0840489, -0.12951206, 0.051960927) * LUMA_texOff(float2(1, -1)).x;
    result += float4(0.015133863, 0.09906266, 0.03766245, 0.17433742) * LUMA_texOff(float2(-1, 0)).x;
    result += float4(-0.033576317, -0.072736226, -0.37578803, 0.3241274) * LUMA_texOff(float2(0, 0)).x;
    result += float4(-0.224204, -0.14103064, 0.14789833, 0.11175794) * LUMA_texOff(float2(1, 0)).x;
    result += float4(0.002351222, 0.16751051, -0.045227956, 0.09500898) * LUMA_texOff(float2(-1, 1)).x;
    result += float4(0.04798399, -0.1497008, 0.24314259, -0.044890083) * LUMA_texOff(float2(0, 1)).x;
    result += float4(0.18212885, 0.013893344, -0.032444946, 0.09600085) * LUMA_texOff(float2(1, 1)).x;
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
