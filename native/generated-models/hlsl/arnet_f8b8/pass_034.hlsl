// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:1066
// Pass: 034 - ARNet F8B8 body fusion conv 8x8x1x1 part 0
// ACNetGLSL is Copyright (c) 2020 TianZer, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[3];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
Texture2D<float4> Anime4KInput2 : register(t2);
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

float4 Anime4KTransform1(float4 value)
{
    return value;
}

float2 Anime4KClampUv1(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[1].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample1(float2 uv)
{
    return Anime4KTransform1(float4(Anime4KInput1.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv1(uv), 0.0)));
}

float4 Anime4KLoadOffset1(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[1].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform1(float4(Anime4KInput1.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent1(uint2 position)
{
    return Anime4KTransform1(float4(Anime4KInput1.Load(int3(position, 0))));
}

float4 Anime4KTransform2(float4 value)
{
    return value;
}

float2 Anime4KClampUv2(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[2].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample2(float2 uv)
{
    return Anime4KTransform2(float4(Anime4KInput2.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv2(uv), 0.0)));
}

float4 Anime4KLoadOffset2(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[2].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform2(float4(Anime4KInput2.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent2(uint2 position)
{
    return Anime4KTransform2(float4(Anime4KInput2.Load(int3(position, 0))));
}

#define FEAT_TEX_0_tex(position) Anime4KSample2(position)
#define FEAT_TEX_0_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define FEAT_TEX_0_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define FEAT_TEX_0_pos anime4k_pos
#define FEAT_TEX_0_size float2(Anime4KInputSizes[2].xy)
#define FEAT_TEX_0_pt rcp(FEAT_TEX_0_size)
#define TMP2_TEX_0_tex(position) Anime4KSample0(position)
#define TMP2_TEX_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define TMP2_TEX_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define TMP2_TEX_0_pos anime4k_pos
#define TMP2_TEX_0_size float2(Anime4KInputSizes[0].xy)
#define TMP2_TEX_0_pt rcp(TMP2_TEX_0_size)
#define TMP2_TEX_1_tex(position) Anime4KSample1(position)
#define TMP2_TEX_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define TMP2_TEX_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define TMP2_TEX_1_pos anime4k_pos
#define TMP2_TEX_1_size float2(Anime4KInputSizes[1].xy)
#define TMP2_TEX_1_pt rcp(TMP2_TEX_1_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.554303, -0.3873233, -1.3469036, -0.15482226);
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.22971562, -0.2060669, 0.050264083, 0.18785368, -0.1063935, -0.18621413, -0.06724117, -0.16177608, 0.046300713, -0.05690519, -0.095758714, -0.04799289, 0.008780916, -0.02633995, 0.02251866, 0.2163649));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.015758038, -0.028020842, 0.0020087794, 0.06770311, 0.024911374, -0.008930269, -0.08416431, -0.27613336, -0.10650896, -0.031546064, -0.15324023, -0.32638708, -0.06811191, -0.048675306, -0.038312107, 0.56858325));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(0.5528978, 0.39999893, 0.06933904, 0.59340173) * min(result, float4(0.0, 0.0, 0.0, 0.0));
    result = result + FEAT_TEX_0_texOff(float2(0.0, 0.0));
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
