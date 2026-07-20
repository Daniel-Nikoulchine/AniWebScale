// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:21
// Pass: 001 - ARNet F8B8 head conv 1x8x3x3 part 1
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
    float4 result = float4(-0.13415533, 0.5957967, 0.18573186, -0.22107354);
    result += float4(-0.19706872, 0.13773434, -0.13379705, -0.14510259) * LUMA_texOff(float2(-1.0, -1.0)).x;
    result += float4(0.21416408, 0.12765284, -0.25377017, -0.25750276) * LUMA_texOff(float2(0.0, -1.0)).x;
    result += float4(-0.15520647, -0.27552927, -0.22261587, 0.23089972) * LUMA_texOff(float2(1.0, -1.0)).x;
    result += float4(0.16986519, 0.030886747, 0.0144063085, -1.0926592) * LUMA_texOff(float2(-1.0, 0.0)).x;
    result += float4(1.3433146, -1.2873248, 0.29551548, 1.7660391) * LUMA_texOff(float2(0.0, 0.0)).x;
    result += float4(-0.25528362, 0.65383357, 0.17788033, 1.057005) * LUMA_texOff(float2(1.0, 0.0)).x;
    result += float4(-0.18115292, 0.14145151, 0.18909556, -0.06874397) * LUMA_texOff(float2(-1.0, 1.0)).x;
    result += float4(-0.24306163, -0.035464212, 0.13354263, -0.6081392) * LUMA_texOff(float2(0.0, 1.0)).x;
    result += float4(-0.18827598, -0.5570947, -0.31886894, -0.29289347) * LUMA_texOff(float2(1.0, 1.0)).x;
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
