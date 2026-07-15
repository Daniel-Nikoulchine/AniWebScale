// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_VL.glsl:866
// Pass: 016 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(VL)-Conv-4x1x1x112
// Anime4K is Copyright (c) 2019-2021 bloc97, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[14];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
Texture2D<float4> Anime4KInput2 : register(t2);
Texture2D<float4> Anime4KInput3 : register(t3);
Texture2D<float4> Anime4KInput4 : register(t4);
Texture2D<float4> Anime4KInput5 : register(t5);
Texture2D<float4> Anime4KInput6 : register(t6);
Texture2D<float4> Anime4KInput7 : register(t7);
Texture2D<float4> Anime4KInput8 : register(t8);
Texture2D<float4> Anime4KInput9 : register(t9);
Texture2D<float4> Anime4KInput10 : register(t10);
Texture2D<float4> Anime4KInput11 : register(t11);
Texture2D<float4> Anime4KInput12 : register(t12);
Texture2D<float4> Anime4KInput13 : register(t13);
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

float4 Anime4KTransform4(float4 value)
{
    return value;
}

float2 Anime4KClampUv4(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[4].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample4(float2 uv)
{
    return Anime4KTransform4(float4(Anime4KInput4.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv4(uv), 0.0)));
}

float4 Anime4KLoadOffset4(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[4].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform4(float4(Anime4KInput4.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent4(uint2 position)
{
    return Anime4KTransform4(float4(Anime4KInput4.Load(int3(position, 0))));
}

float4 Anime4KTransform5(float4 value)
{
    return value;
}

float2 Anime4KClampUv5(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[5].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample5(float2 uv)
{
    return Anime4KTransform5(float4(Anime4KInput5.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv5(uv), 0.0)));
}

float4 Anime4KLoadOffset5(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[5].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform5(float4(Anime4KInput5.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent5(uint2 position)
{
    return Anime4KTransform5(float4(Anime4KInput5.Load(int3(position, 0))));
}

float4 Anime4KTransform6(float4 value)
{
    return value;
}

float2 Anime4KClampUv6(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[6].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample6(float2 uv)
{
    return Anime4KTransform6(float4(Anime4KInput6.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv6(uv), 0.0)));
}

float4 Anime4KLoadOffset6(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[6].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform6(float4(Anime4KInput6.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent6(uint2 position)
{
    return Anime4KTransform6(float4(Anime4KInput6.Load(int3(position, 0))));
}

float4 Anime4KTransform7(float4 value)
{
    return value;
}

float2 Anime4KClampUv7(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[7].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample7(float2 uv)
{
    return Anime4KTransform7(float4(Anime4KInput7.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv7(uv), 0.0)));
}

float4 Anime4KLoadOffset7(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[7].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform7(float4(Anime4KInput7.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent7(uint2 position)
{
    return Anime4KTransform7(float4(Anime4KInput7.Load(int3(position, 0))));
}

float4 Anime4KTransform8(float4 value)
{
    return value;
}

float2 Anime4KClampUv8(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[8].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample8(float2 uv)
{
    return Anime4KTransform8(float4(Anime4KInput8.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv8(uv), 0.0)));
}

float4 Anime4KLoadOffset8(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[8].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform8(float4(Anime4KInput8.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent8(uint2 position)
{
    return Anime4KTransform8(float4(Anime4KInput8.Load(int3(position, 0))));
}

float4 Anime4KTransform9(float4 value)
{
    return value;
}

float2 Anime4KClampUv9(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[9].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample9(float2 uv)
{
    return Anime4KTransform9(float4(Anime4KInput9.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv9(uv), 0.0)));
}

float4 Anime4KLoadOffset9(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[9].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform9(float4(Anime4KInput9.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent9(uint2 position)
{
    return Anime4KTransform9(float4(Anime4KInput9.Load(int3(position, 0))));
}

float4 Anime4KTransform10(float4 value)
{
    return value;
}

float2 Anime4KClampUv10(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[10].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample10(float2 uv)
{
    return Anime4KTransform10(float4(Anime4KInput10.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv10(uv), 0.0)));
}

float4 Anime4KLoadOffset10(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[10].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform10(float4(Anime4KInput10.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent10(uint2 position)
{
    return Anime4KTransform10(float4(Anime4KInput10.Load(int3(position, 0))));
}

float4 Anime4KTransform11(float4 value)
{
    return value;
}

float2 Anime4KClampUv11(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[11].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample11(float2 uv)
{
    return Anime4KTransform11(float4(Anime4KInput11.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv11(uv), 0.0)));
}

float4 Anime4KLoadOffset11(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[11].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform11(float4(Anime4KInput11.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent11(uint2 position)
{
    return Anime4KTransform11(float4(Anime4KInput11.Load(int3(position, 0))));
}

float4 Anime4KTransform12(float4 value)
{
    return value;
}

float2 Anime4KClampUv12(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[12].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample12(float2 uv)
{
    return Anime4KTransform12(float4(Anime4KInput12.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv12(uv), 0.0)));
}

float4 Anime4KLoadOffset12(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[12].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform12(float4(Anime4KInput12.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent12(uint2 position)
{
    return Anime4KTransform12(float4(Anime4KInput12.Load(int3(position, 0))));
}

float4 Anime4KTransform13(float4 value)
{
    return value;
}

float2 Anime4KClampUv13(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[13].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample13(float2 uv)
{
    return Anime4KTransform13(float4(Anime4KInput13.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv13(uv), 0.0)));
}

float4 Anime4KLoadOffset13(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[13].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform13(float4(Anime4KInput13.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent13(uint2 position)
{
    return Anime4KTransform13(float4(Anime4KInput13.Load(int3(position, 0))));
}

#define conv2d_1_tf_tex(position) Anime4KSample2(position)
#define conv2d_1_tf_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_1_tf_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_1_tf_pos anime4k_pos
#define conv2d_1_tf_size float2(Anime4KInputSizes[2].xy)
#define conv2d_1_tf_pt rcp(conv2d_1_tf_size)
#define conv2d_1_tf1_tex(position) Anime4KSample3(position)
#define conv2d_1_tf1_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_1_tf1_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_1_tf1_pos anime4k_pos
#define conv2d_1_tf1_size float2(Anime4KInputSizes[3].xy)
#define conv2d_1_tf1_pt rcp(conv2d_1_tf1_size)
#define conv2d_2_tf_tex(position) Anime4KSample4(position)
#define conv2d_2_tf_texOff(offset) Anime4KLoadOffset4(anime4k_output_pixel, offset)
#define conv2d_2_tf_texCurrent Anime4KLoadCurrent4(anime4k_output_pixel)
#define conv2d_2_tf_pos anime4k_pos
#define conv2d_2_tf_size float2(Anime4KInputSizes[4].xy)
#define conv2d_2_tf_pt rcp(conv2d_2_tf_size)
#define conv2d_2_tf1_tex(position) Anime4KSample5(position)
#define conv2d_2_tf1_texOff(offset) Anime4KLoadOffset5(anime4k_output_pixel, offset)
#define conv2d_2_tf1_texCurrent Anime4KLoadCurrent5(anime4k_output_pixel)
#define conv2d_2_tf1_pos anime4k_pos
#define conv2d_2_tf1_size float2(Anime4KInputSizes[5].xy)
#define conv2d_2_tf1_pt rcp(conv2d_2_tf1_size)
#define conv2d_3_tf_tex(position) Anime4KSample6(position)
#define conv2d_3_tf_texOff(offset) Anime4KLoadOffset6(anime4k_output_pixel, offset)
#define conv2d_3_tf_texCurrent Anime4KLoadCurrent6(anime4k_output_pixel)
#define conv2d_3_tf_pos anime4k_pos
#define conv2d_3_tf_size float2(Anime4KInputSizes[6].xy)
#define conv2d_3_tf_pt rcp(conv2d_3_tf_size)
#define conv2d_3_tf1_tex(position) Anime4KSample7(position)
#define conv2d_3_tf1_texOff(offset) Anime4KLoadOffset7(anime4k_output_pixel, offset)
#define conv2d_3_tf1_texCurrent Anime4KLoadCurrent7(anime4k_output_pixel)
#define conv2d_3_tf1_pos anime4k_pos
#define conv2d_3_tf1_size float2(Anime4KInputSizes[7].xy)
#define conv2d_3_tf1_pt rcp(conv2d_3_tf1_size)
#define conv2d_4_tf_tex(position) Anime4KSample8(position)
#define conv2d_4_tf_texOff(offset) Anime4KLoadOffset8(anime4k_output_pixel, offset)
#define conv2d_4_tf_texCurrent Anime4KLoadCurrent8(anime4k_output_pixel)
#define conv2d_4_tf_pos anime4k_pos
#define conv2d_4_tf_size float2(Anime4KInputSizes[8].xy)
#define conv2d_4_tf_pt rcp(conv2d_4_tf_size)
#define conv2d_4_tf1_tex(position) Anime4KSample9(position)
#define conv2d_4_tf1_texOff(offset) Anime4KLoadOffset9(anime4k_output_pixel, offset)
#define conv2d_4_tf1_texCurrent Anime4KLoadCurrent9(anime4k_output_pixel)
#define conv2d_4_tf1_pos anime4k_pos
#define conv2d_4_tf1_size float2(Anime4KInputSizes[9].xy)
#define conv2d_4_tf1_pt rcp(conv2d_4_tf1_size)
#define conv2d_5_tf_tex(position) Anime4KSample10(position)
#define conv2d_5_tf_texOff(offset) Anime4KLoadOffset10(anime4k_output_pixel, offset)
#define conv2d_5_tf_texCurrent Anime4KLoadCurrent10(anime4k_output_pixel)
#define conv2d_5_tf_pos anime4k_pos
#define conv2d_5_tf_size float2(Anime4KInputSizes[10].xy)
#define conv2d_5_tf_pt rcp(conv2d_5_tf_size)
#define conv2d_5_tf1_tex(position) Anime4KSample11(position)
#define conv2d_5_tf1_texOff(offset) Anime4KLoadOffset11(anime4k_output_pixel, offset)
#define conv2d_5_tf1_texCurrent Anime4KLoadCurrent11(anime4k_output_pixel)
#define conv2d_5_tf1_pos anime4k_pos
#define conv2d_5_tf1_size float2(Anime4KInputSizes[11].xy)
#define conv2d_5_tf1_pt rcp(conv2d_5_tf1_size)
#define conv2d_6_tf_tex(position) Anime4KSample12(position)
#define conv2d_6_tf_texOff(offset) Anime4KLoadOffset12(anime4k_output_pixel, offset)
#define conv2d_6_tf_texCurrent Anime4KLoadCurrent12(anime4k_output_pixel)
#define conv2d_6_tf_pos anime4k_pos
#define conv2d_6_tf_size float2(Anime4KInputSizes[12].xy)
#define conv2d_6_tf_pt rcp(conv2d_6_tf_size)
#define conv2d_6_tf1_tex(position) Anime4KSample13(position)
#define conv2d_6_tf1_texOff(offset) Anime4KLoadOffset13(anime4k_output_pixel, offset)
#define conv2d_6_tf1_texCurrent Anime4KLoadCurrent13(anime4k_output_pixel)
#define conv2d_6_tf1_pos anime4k_pos
#define conv2d_6_tf1_size float2(Anime4KInputSizes[13].xy)
#define conv2d_6_tf1_pt rcp(conv2d_6_tf1_size)
#define conv2d_tf_tex(position) Anime4KSample0(position)
#define conv2d_tf_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_tf_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_tf_pos anime4k_pos
#define conv2d_tf_size float2(Anime4KInputSizes[0].xy)
#define conv2d_tf_pt rcp(conv2d_tf_size)
#define conv2d_tf1_tex(position) Anime4KSample1(position)
#define conv2d_tf1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_tf1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_tf1_pos anime4k_pos
#define conv2d_tf1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_tf1_pt rcp(conv2d_tf1_size)

#define g_0 (max((conv2d_tf_texCurrent), 0.0))
#define g_1 (max((conv2d_tf1_texCurrent), 0.0))
#define g_2 (max(-(conv2d_tf_texCurrent), 0.0))
#define g_3 (max(-(conv2d_tf1_texCurrent), 0.0))
#define g_4 (max((conv2d_1_tf_texCurrent), 0.0))
#define g_5 (max((conv2d_1_tf1_texCurrent), 0.0))
#define g_6 (max(-(conv2d_1_tf_texCurrent), 0.0))
#define g_7 (max(-(conv2d_1_tf1_texCurrent), 0.0))
#define g_8 (max((conv2d_2_tf_texCurrent), 0.0))
#define g_9 (max((conv2d_2_tf1_texCurrent), 0.0))
#define g_10 (max(-(conv2d_2_tf_texCurrent), 0.0))
#define g_11 (max(-(conv2d_2_tf1_texCurrent), 0.0))
#define g_12 (max((conv2d_3_tf_texCurrent), 0.0))
#define g_13 (max((conv2d_3_tf1_texCurrent), 0.0))
#define g_14 (max(-(conv2d_3_tf_texCurrent), 0.0))
#define g_15 (max(-(conv2d_3_tf1_texCurrent), 0.0))
#define g_16 (max((conv2d_4_tf_texCurrent), 0.0))
#define g_17 (max((conv2d_4_tf1_texCurrent), 0.0))
#define g_18 (max(-(conv2d_4_tf_texCurrent), 0.0))
#define g_19 (max(-(conv2d_4_tf1_texCurrent), 0.0))
#define g_20 (max((conv2d_5_tf_texCurrent), 0.0))
#define g_21 (max((conv2d_5_tf1_texCurrent), 0.0))
#define g_22 (max(-(conv2d_5_tf_texCurrent), 0.0))
#define g_23 (max(-(conv2d_5_tf1_texCurrent), 0.0))
#define g_24 (max((conv2d_6_tf_texCurrent), 0.0))
#define g_25 (max((conv2d_6_tf1_texCurrent), 0.0))
#define g_26 (max(-(conv2d_6_tf_texCurrent), 0.0))
#define g_27 (max(-(conv2d_6_tf1_texCurrent), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(g_0, float4x4(0.2006987, 0.17832398, 0.26342955, 0.23500517, -0.012297829, -0.009008417, -0.039950736, -0.039973143, 0.34800097, 0.32196492, 0.30505183, 0.29214156, -0.21410535, -0.21166423, -0.16437815, -0.19172792));
    result += mul(g_1, float4x4(-0.008804151, -0.07085123, 0.013577994, -0.05192605, -0.08981402, -0.14702585, -0.09145975, -0.14835288, -0.15882517, -0.14785844, -0.2381482, -0.22867912, 0.010898514, 0.031957507, 0.040597558, 0.078252345));
    result += mul(g_2, float4x4(-0.21658613, -0.1803885, -0.25954962, -0.20839214, -0.09597461, -0.09222647, -0.03909875, -0.03456191, -0.19723509, -0.16976605, -0.2041716, -0.1751425, 0.22901416, 0.24922715, 0.1800083, 0.23346905));
    result += mul(g_3, float4x4(0.110020064, 0.103858806, 0.052446555, 0.061105963, 0.032901537, 0.07140097, 0.11518793, 0.13860466, 0.13930707, 0.12712196, 0.19071707, 0.18399614, -0.08036458, -0.07349171, 0.021504594, 0.0024937368));
    result += mul(g_4, float4x4(0.059065036, 0.00698257, -0.099622436, -0.15676253, -0.10942482, -0.04869624, -0.13654554, -0.07341863, -0.014169851, -0.06390744, 0.016093008, -0.04540248, 0.29041344, 0.24451919, 0.26292154, 0.22136512));
    result += mul(g_5, float4x4(0.107946776, 0.097849295, 0.10266876, 0.09360328, 0.08931344, 0.08896482, 0.046495322, 0.044040844, -0.020361643, -0.030911373, 0.026598722, 0.019815676, -0.072677925, -0.042410247, 0.14127749, 0.13434973));
    result += mul(g_6, float4x4(-0.08809133, -0.03476601, 0.06420393, 0.14691353, 0.09296839, 0.06162562, 0.10992992, 0.0615685, 0.0168736, 0.06520281, 0.020010693, 0.046929173, -0.2219495, -0.21249783, -0.14622301, -0.14599061));
    result += mul(g_7, float4x4(-0.13251069, -0.08977477, -0.08930347, -0.045490693, -0.10980218, -0.09510885, -0.07299872, -0.064053826, 0.011365247, 0.014091111, -0.054976214, -0.056936122, 0.10148144, 0.07451642, -0.08138598, -0.10161657));
    result += mul(g_8, float4x4(-0.0075518745, -0.005738622, -0.007577811, -0.00032088626, 0.032614008, 0.04858922, 0.00054855715, 0.011565026, -0.022675224, -0.034442738, -0.03580643, -0.05069376, -0.0020376542, -0.01505518, 0.019388825, 0.03746554));
    result += mul(g_9, float4x4(-0.011413172, -0.016877454, -0.048923567, -0.055012885, -0.007709447, -0.016109072, -0.047132388, -0.07146396, 0.002604099, 0.00014681708, 0.03429465, 0.043265607, 0.029014807, 0.03337814, 0.07582056, 0.041660666));
    result += mul(g_10, float4x4(-0.020768544, -0.014378527, -0.01999972, -0.01385916, -0.012264676, -0.009959511, 0.0119015165, -0.016787319, 0.07266734, -0.0029914333, 0.08549183, 0.004367342, 0.008236065, 0.020370748, 0.0043428927, 0.007301017));
    result += mul(g_11, float4x4(0.011654731, 0.025318999, -0.0029306612, 0.007426217, -0.00010868774, -0.020845588, 0.041991003, 0.024147986, -0.030741083, -0.012328637, -0.06617428, -0.06103115, 0.010491518, -0.013338451, -0.04666634, -0.046481613));
    result += mul(g_12, float4x4(0.0268538, 0.043785956, -0.01799385, 0.008743307, -0.013197458, -0.015049436, -0.017189734, -0.0047999253, -0.00059730676, -0.0008936153, -0.016006093, -0.0073406673, 0.014875853, 0.011491735, 9.819833e-05, 0.0073417514));
    result += mul(g_13, float4x4(0.019930955, 0.027112626, 0.01307941, 0.005268897, -0.060213763, -0.050415818, -0.069006495, -0.051405095, 0.0036414433, -0.008606397, 0.037427194, -0.0018103109, -0.037434716, 0.010187546, -0.026227329, -0.0033639795));
    result += mul(g_14, float4x4(-0.03634798, 0.0007093891, -0.026819145, 0.009025687, -0.01750318, -0.020098133, -0.0063864207, -0.006606755, 0.0008565766, 0.028647956, -0.0024974607, 0.015250743, -0.048884176, -0.004310685, -0.0010757383, 0.00974984));
    result += mul(g_15, float4x4(-0.031253602, -0.031743724, -0.009083253, 0.0145388115, 0.02048611, 0.0058071036, -0.0038228377, 0.00049654936, 0.0059105973, 0.03437731, -0.025785418, 0.004187733, 0.009980489, -4.08268e-05, 0.009384428, 0.0019492983));
    result += mul(g_16, float4x4(0.012587245, -0.0032654977, 0.029739188, -0.009440694, -0.0018237908, -0.0080032, 0.010499013, 0.0012466761, 0.03461923, -0.0060207327, -0.008771263, -0.034545746, -0.015023473, -0.008901684, -0.011490296, -0.01976464));
    result += mul(g_17, float4x4(-0.009444331, 0.020809013, 0.009985801, 0.020350901, 0.013234775, 0.004382635, -0.0007761826, -0.005247294, 0.034115106, 0.05190378, 0.039124765, 0.050993033, -0.0898732, -0.030428126, -0.044204578, -0.052484997));
    result += mul(g_18, float4x4(-0.020434443, 0.053520404, 0.0007571144, 0.05895061, -0.018991265, -0.043982152, -0.004035192, -0.025452444, -0.012197152, -0.013770753, 0.0012919102, 0.003996682, 0.0056104586, 0.025686186, 0.05128293, 0.05105745));
    result += mul(g_19, float4x4(0.030201769, 0.052521482, 0.029641917, 0.05559941, 0.0018870027, 0.020112835, -0.0043867202, 0.035877172, 0.02961142, 0.02163634, -0.027972858, -0.040669747, 0.03393723, 0.013455979, 0.03313782, 0.01968004));
    result += mul(g_20, float4x4(0.034817442, 0.04045217, 0.054816365, 0.05092461, 0.06600807, 0.062576495, 0.09923777, 0.006663677, -0.039958935, -0.010009866, -0.041522443, -0.04959681, -0.020962957, 0.003845031, -0.04910384, -0.03233655));
    result += mul(g_21, float4x4(0.015433112, 0.028965838, -0.0055138534, 0.042267464, -0.012690953, -0.009424165, 0.017896382, 0.01186686, 0.07231686, -0.038834292, 0.07033086, -0.052548733, 0.15721905, 0.09334892, 0.07676042, 0.06701375));
    result += mul(g_22, float4x4(-0.09797534, -0.11201098, -0.0037222446, -0.008105951, -0.01152357, 0.012165641, -0.029051905, -0.021293389, -0.09600697, -0.028819272, -0.069084235, -0.035421908, 0.0054322914, 0.14168966, -0.0200274, 0.06505187));
    result += mul(g_23, float4x4(-0.05034882, -0.06622497, -0.062471002, -0.100628324, 0.018115615, 0.019867867, -0.018836644, 0.007562053, -0.06317378, -0.034458403, -0.047243826, -0.009989589, -0.08270121, -0.018645251, -0.05160367, -0.023690399));
    result += mul(g_24, float4x4(0.03897899, -0.10862529, -0.081805214, 0.1202324, -0.021866674, -0.00041882638, -0.018235246, 0.027227063, -0.0656312, -0.053432237, -0.0029235696, 0.03549672, -0.022848906, -0.057047505, 0.013400545, -0.0072439364));
    result += mul(g_25, float4x4(0.06879516, -0.018637763, 0.058062725, 0.041045032, 0.011702424, -0.13693465, 0.05674195, -0.11679955, -0.022940686, -0.03856922, -0.07531371, -0.09692582, -0.019870926, -0.032572743, 0.026138868, 0.037639033));
    result += mul(g_26, float4x4(-0.015270301, 0.06478719, 0.011016518, -0.04533957, 0.00688319, 0.024815995, 0.10159924, -0.08467507, 0.11939162, -0.01939453, -0.0058689644, -0.077881604, 0.118726775, 0.14489114, -0.10831982, -0.07972515));
    result += mul(g_27, float4x4(-0.16734359, 0.10685446, -0.102714166, -0.010225307, 0.07306756, 0.07014447, 0.040464073, 0.04688462, -0.05489714, -0.01525318, 0.14690581, 0.17514132, -0.03250648, -0.03688211, 0.05047889, 0.03078089));
    result += float4(0.06614842, 0.045779686, 0.032838725, 0.017085627);
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
