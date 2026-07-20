// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:92
// Pass: 003 - ArtCNN C4F16 (Conv2D)
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
    float4 result = float4(-0.0003382082, -0.00601378, 0.012577824, -0.05622743);
    result += float4(0.07923513, -0.124057494, 0.24102478, -0.114168674) * LUMA_texOff(float2(-1, -1)).x;
    result += float4(-0.19048533, 0.19942974, 0.42362782, 0.21932925) * LUMA_texOff(float2(0, -1)).x;
    result += float4(0.0148091, -0.051743113, 0.0558839, 0.043352813) * LUMA_texOff(float2(1, -1)).x;
    result += float4(0.042809583, 0.009303409, 0.047089607, -0.2489604) * LUMA_texOff(float2(-1, 0)).x;
    result += float4(0.014582089, -0.14984143, -0.4934937, -0.0067877816) * LUMA_texOff(float2(0, 0)).x;
    result += float4(0.037161533, 0.14714734, -0.17489892, 0.23928997) * LUMA_texOff(float2(1, 0)).x;
    result += float4(-0.08136748, 0.126604, -0.05542742, -0.10161853) * LUMA_texOff(float2(-1, 1)).x;
    result += float4(0.11775075, -0.06662411, -0.16556169, -0.014515711) * LUMA_texOff(float2(0, 1)).x;
    result += float4(-0.026951507, -0.088610075, 0.019072657, 0.14854541) * LUMA_texOff(float2(1, 1)).x;
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
