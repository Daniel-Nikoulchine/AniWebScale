// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale/Anime4K_Upscale_CNN_x2_VL.glsl:704
// Pass: 014 - Anime4K-v3.2-Upscale-CNN-x2-(VL)-Conv-4x1x1x112
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
    float4 result = mul(g_0, float4x4(-0.11498094, -0.053904895, -0.11520678, -0.05479549, 0.028396055, 0.032767884, 0.052479446, 0.05257866, -0.25706592, -0.3454966, -0.24713765, -0.2854201, -0.10287636, 0.0023146886, -0.09190338, -0.011193905));
    result += mul(g_1, float4x4(-0.05461422, 0.008780496, -0.07738697, -0.032230727, -0.047554165, -0.025061952, -0.051897213, -0.009545297, -0.14548294, -0.15184018, -0.01313442, -0.015299784, -0.0007883845, -0.12866738, -0.15260352, -0.27081275));
    result += mul(g_2, float4x4(0.11007706, 0.035344437, 0.11020841, 0.0425353, 0.1613199, 0.18417408, 0.09274313, 0.11943135, 0.106862, 0.079875536, 0.0937752, 0.068030775, 0.029093558, -0.06441164, 0.06467169, -0.021989612));
    result += mul(g_3, float4x4(0.049548414, -0.012455486, 0.07185561, 0.021865537, 0.020969186, -0.03374196, -0.024260623, -0.07739141, 0.07164591, 0.12741035, 0.0379913, 0.076403245, 0.07049977, 0.0744538, 0.0062989634, 0.01818882));
    result += mul(g_4, float4x4(-0.12511204, -0.010836819, 0.13709816, 0.22472954, 0.21280868, -0.006484726, 0.17554289, -0.009977173, 0.078398876, 0.20698707, 0.13432744, 0.29740283, -0.24750128, -0.32757792, -0.19807857, -0.2537023));
    result += mul(g_5, float4x4(-0.27207088, -0.1385644, -0.2166476, -0.07687419, -0.20300622, -0.29678395, -0.13135734, -0.20851587, 0.0361364, 0.011243289, -0.06845459, -0.11796941, 0.11575868, 0.070215136, -0.10295678, -0.12281369));
    result += mul(g_6, float4x4(0.13619795, -0.0019436983, -0.12701888, -0.25933513, -0.20134166, 0.00062823144, -0.076756015, 0.11002947, 0.0059049693, -0.18756741, -0.0718802, -0.2589954, 0.23413423, 0.30107784, 0.14445266, 0.18920745));
    result += mul(g_7, float4x4(0.1494216, 0.0587532, 0.05478662, -0.039123338, 0.23322394, 0.29950607, 0.24384268, 0.27843767, -0.16094431, -0.04705998, -0.016345032, 0.028868208, -0.102872886, -0.04659664, 0.104105346, 0.14305067));
    result += mul(g_8, float4x4(-0.001037014, 0.010001526, -0.0052278573, 0.024779709, 0.06857274, 0.067640975, 0.085439384, 0.09242789, -0.066597246, -0.055928994, 0.0015658981, 0.016131008, -0.03524695, -0.018364554, -0.047754433, -0.014295886));
    result += mul(g_9, float4x4(-0.042207, 0.02835915, -0.1404656, -0.08563323, -0.030979915, -0.0673764, 0.10733943, 0.057902794, 0.00022424995, -0.0023634837, -0.10778953, -0.10202357, -0.020368295, -0.019088887, -0.06875738, -0.08504131));
    result += mul(g_10, float4x4(-0.00043458896, 0.00045652856, -0.02016843, -0.020062413, -0.08740103, -0.042085808, -0.10644177, -0.09226477, 0.11212161, -0.00048174805, 0.021872435, -0.05868698, 0.0333954, 0.058184672, 0.05532576, 0.07621587));
    result += mul(g_11, float4x4(0.054245148, 0.001020329, 0.09106849, 0.05303779, 0.009889632, 0.01309413, -0.09187347, -0.08618193, -0.011621187, 0.016222361, 0.061095525, 0.060885344, 0.078050986, 0.0111776795, 0.08829944, 0.032022282));
    result += mul(g_12, float4x4(0.01643529, 0.02285545, -0.03498564, 0.00769657, -0.0042474116, 0.015836312, -0.025771018, -0.0016368, -0.008897948, -0.012588166, -0.01416411, -0.003578984, 0.025991246, 0.021237152, 0.017450012, 0.025172485));
    result += mul(g_13, float4x4(0.014568868, 0.017796224, -0.036679734, -0.03138748, 0.019457601, -0.027607411, -0.004529679, -0.038048342, -0.054055385, -0.03876025, 0.041948095, 0.005869784, 0.02439633, 0.05177997, 0.016000897, 0.0057169925));
    result += mul(g_14, float4x4(-0.03021866, 0.017678728, -0.01371109, 0.013548159, -0.0038099394, -0.014066414, 0.028093752, 0.0027308422, -0.010615999, 0.012673458, -0.03028171, -0.016818244, -0.06530097, -0.018845048, -0.0072947564, -0.0038243714));
    result += mul(g_15, float4x4(-0.019006258, -0.007847591, 0.03690709, 0.06714211, 0.0073993434, -0.009766907, -0.0021441753, -0.01308625, 0.06658726, 0.06701995, -0.027305668, -0.016032105, -0.028976806, -0.0036668575, -0.0027825525, 0.0105632655));
    result += mul(g_16, float4x4(0.028945107, -0.0014701135, 0.048950657, -0.01923516, -0.0014054152, 0.002650635, -0.005300331, 0.004860559, 0.011158468, 0.005940625, -0.012095051, 0.0041518128, -0.020433836, -0.025870577, -0.0007547932, -0.026509356));
    result += mul(g_17, float4x4(-0.004545374, 0.04264545, 0.021741537, 0.029115127, 0.04225599, -0.0055392785, 0.026570829, -0.031795148, -0.008307126, 0.020176455, 0.010904648, 0.017765503, -0.10806103, -0.01776947, 0.00070428237, -0.06356262));
    result += mul(g_18, float4x4(-0.05663172, 0.05908046, -0.03837452, 0.06636983, -0.007960516, -0.06384041, 0.023125881, -0.030108837, 0.0038054318, -0.023263922, 0.020264054, -0.0062937695, 0.031630237, 0.020909082, 0.03594235, 0.035879835));
    result += mul(g_19, float4x4(-0.0050448794, 0.033650696, -0.002830413, 0.035174295, -0.024521282, 0.013054315, -0.020833842, 0.037953895, 0.08249671, 0.024239466, -0.012758333, -0.027316988, 0.051040914, 0.0005025873, 0.039778862, 0.0024668393));
    result += mul(g_20, float4x4(0.017232442, 0.022482058, 0.020233413, 0.024337437, 0.07986929, 0.06234036, 0.12662584, -0.05271183, -0.009718745, -0.0046989853, -0.0030333172, -0.04034237, -0.0113442, 0.022746231, -0.035293855, -0.009433693));
    result += mul(g_21, float4x4(0.015766997, 0.013647276, -0.029327558, 0.039106004, -0.010398323, -0.032851525, 0.02908329, -0.003789618, 0.12963496, 0.010851003, 0.1126276, -0.049255487, 0.06867432, 0.07970792, 0.017840397, -0.026481882));
    result += mul(g_22, float4x4(-0.058729574, -0.07886952, 0.033267397, 0.02755372, -0.0172006, 0.012404398, -0.0230168, -0.015059758, -0.09239916, -0.029533267, -0.043251917, 0.0035152994, 0.022931995, 0.101714484, -0.044946067, 0.094993));
    result += mul(g_23, float4x4(-0.04708704, -0.032475296, -0.03228093, -0.08810475, 0.013745045, 0.027828002, -0.031922746, 0.022986397, -0.061620213, -0.03694645, -0.055026993, 0.0031291894, -0.028799903, -0.0025357977, -0.03441407, 0.0028600092));
    result += mul(g_24, float4x4(0.058981724, -0.10447273, -0.088705614, 0.16546178, -0.023549391, -0.008831522, -0.018411588, 0.029640056, -0.068086684, -0.05414636, -0.029401174, 0.036180343, -0.031988926, -0.047249753, 0.008162177, 0.00548062));
    result += mul(g_25, float4x4(0.05287462, -0.030657746, 0.02821435, 0.037005343, 0.03534311, -0.15614955, 0.07085459, -0.11997641, -0.009156166, -0.021968868, -0.054147746, -0.07307657, -0.006428544, -0.017528288, 0.012614676, 0.037840024));
    result += mul(g_26, float4x4(-0.021977803, 0.047799855, 0.02660416, -0.07292106, 0.045195807, -0.0056674764, 0.10824326, -0.112114795, 0.1447127, -0.0119616175, 0.0011661504, -0.04553905, 0.13048342, 0.14574122, -0.105522245, -0.102792375));
    result += mul(g_27, float4x4(-0.16397473, 0.15785863, -0.06666504, -0.01682913, 0.06070918, 0.070222184, 0.037701584, 0.026657054, -0.0835267, -0.009457008, 0.13232987, 0.13508691, -0.056414206, -0.06818828, 0.079076104, 0.032249212));
    result += float4(-0.10795144, -0.09953324, -0.055413827, -0.03875493);
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
