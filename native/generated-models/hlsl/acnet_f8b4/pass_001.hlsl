// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/acnet/acnet_f8b4.glsl:22
// Pass: 001 - ACNet F8B4 head conv 1x8x3x3 part 1
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
    float4 result = float4(-0.0010380931, -1.1788054, 0.024233848, -0.00079728756);
    result += float4(0.033546112, 0.10980652, 0.097957306, 0.21237579) * LUMA_texOff(float2(-1.0, -1.0)).x;
    result += float4(-0.21189734, -0.12089546, 0.68326527, -4.2253747) * LUMA_texOff(float2(0.0, -1.0)).x;
    result += float4(0.19883607, 1.0329657, -0.09688856, 0.25435346) * LUMA_texOff(float2(1.0, -1.0)).x;
    result += float4(-0.15327626, -0.18092306, 0.74079853, -0.17313564) * LUMA_texOff(float2(-1.0, 0.0)).x;
    result += float4(5.7319126, -1.1648409, -5.8184586, 4.171934) * LUMA_texOff(float2(0.0, 0.0)).x;
    result += float4(-5.6207337, 0.9392109, 0.99913746, -0.19774051) * LUMA_texOff(float2(1.0, 0.0)).x;
    result += float4(-0.024911148, 0.10242643, 0.35410124, -0.060014643) * LUMA_texOff(float2(-1.0, 1.0)).x;
    result += float4(-0.14164221, 0.13694477, 1.27163, 0.06270146) * LUMA_texOff(float2(0.0, 1.0)).x;
    result += float4(0.18961844, -0.19659716, 0.44041228, -0.043810427) * LUMA_texOff(float2(1.0, 1.0)).x;
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(-0.91579723, 0.5282313, 0.3303117, -0.9281135) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
