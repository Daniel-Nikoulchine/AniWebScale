// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_UL.glsl:1680
// Pass: 024 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(UL)-Depth-to-Space
// Anime4K is Copyright (c) 2019-2021 bloc97, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[4];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
Texture2D<float4> Anime4KInput2 : register(t2);
Texture2D<float4> Anime4KInput3 : register(t3);
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

float4 Anime4KTransform3(float4 value)
{
    return value;
}

float2 Anime4KClampUv3(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[3].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample3(float2 uv)
{
    return Anime4KTransform3(float4(Anime4KInput3.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv3(uv), 0.0)));
}

float4 Anime4KLoadOffset3(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[3].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform3(float4(Anime4KInput3.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent3(uint2 position)
{
    return Anime4KTransform3(float4(Anime4KInput3.Load(int3(position, 0))));
}

#define MAIN_tex(position) Anime4KSample0(position)
#define MAIN_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define MAIN_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define MAIN_pos anime4k_pos
#define MAIN_size float2(Anime4KInputSizes[0].xy)
#define MAIN_pt rcp(MAIN_size)
#define conv2d_last_tf_tex(position) Anime4KSample1(position)
#define conv2d_last_tf_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_last_tf_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_last_tf_pos anime4k_pos
#define conv2d_last_tf_size float2(Anime4KInputSizes[1].xy)
#define conv2d_last_tf_pt rcp(conv2d_last_tf_size)
#define conv2d_last_tf1_tex(position) Anime4KSample2(position)
#define conv2d_last_tf1_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_last_tf1_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_last_tf1_pos anime4k_pos
#define conv2d_last_tf1_size float2(Anime4KInputSizes[2].xy)
#define conv2d_last_tf1_pt rcp(conv2d_last_tf1_size)
#define conv2d_last_tf2_tex(position) Anime4KSample3(position)
#define conv2d_last_tf2_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_last_tf2_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_last_tf2_pos anime4k_pos
#define conv2d_last_tf2_size float2(Anime4KInputSizes[3].xy)
#define conv2d_last_tf2_pt rcp(conv2d_last_tf2_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float2 f0 = frac(conv2d_last_tf_pos * conv2d_last_tf_size);
    int2 i0 = int2(f0 * float2(2.0, 2.0));
    float c0 = conv2d_last_tf_tex((float2(0.5, 0.5) - f0) * conv2d_last_tf_pt + conv2d_last_tf_pos)[i0.y * 2 + i0.x];
    float2 f1 = frac(conv2d_last_tf1_pos * conv2d_last_tf1_size);
    int2 i1 = int2(f1 * float2(2.0, 2.0));
    float c1 = conv2d_last_tf1_tex((float2(0.5, 0.5) - f1) * conv2d_last_tf1_pt + conv2d_last_tf1_pos)[i1.y * 2 + i1.x];
    float2 f2 = frac(conv2d_last_tf2_pos * conv2d_last_tf2_size);
    int2 i2 = int2(f2 * float2(2.0, 2.0));
    float c2 = conv2d_last_tf2_tex((float2(0.5, 0.5) - f2) * conv2d_last_tf2_pt + conv2d_last_tf2_pos)[i2.y * 2 + i2.x];
    float c3 = c2;
    return float4(c0, c1, c2, c3) + MAIN_tex(MAIN_pos);
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
