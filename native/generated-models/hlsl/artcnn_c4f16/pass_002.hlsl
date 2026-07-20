// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:69
// Pass: 002 - ArtCNN C4F16 (Conv2D)
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
    float4 result = float4(0.029776718, -0.0011096202, -0.007366339, 0.0018483452);
    result += float4(-0.070672095, 0.118226334, -0.16407724, -0.052765083) * LUMA_texOff(float2(-1, -1)).x;
    result += float4(0.12421098, -0.02475437, 0.16593158, 0.0076461905) * LUMA_texOff(float2(0, -1)).x;
    result += float4(0.08242352, -0.014138544, 0.0057303896, 0.020100795) * LUMA_texOff(float2(1, -1)).x;
    result += float4(-0.20809816, 0.3488407, 0.36273316, 0.1306535) * LUMA_texOff(float2(-1, 0)).x;
    result += float4(-0.34617552, -0.8206443, -0.32715708, -0.102082044) * LUMA_texOff(float2(0, 0)).x;
    result += float4(0.19362049, 0.1689205, -0.05972561, -0.0019502251) * LUMA_texOff(float2(1, 0)).x;
    result += float4(0.057871062, 0.10961987, -0.15784252, -0.059899677) * LUMA_texOff(float2(-1, 1)).x;
    result += float4(0.27436438, 0.11876813, 0.14584053, 0.1195842) * LUMA_texOff(float2(0, 1)).x;
    result += float4(-0.18614744, -0.014668433, 0.029564941, -0.05947655) * LUMA_texOff(float2(1, 1)).x;
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
