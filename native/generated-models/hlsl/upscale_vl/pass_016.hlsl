// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale/Anime4K_Upscale_CNN_x2_VL.glsl:866
// Pass: 016 - Anime4K-v3.2-Upscale-CNN-x2-(VL)-Conv-4x1x1x112
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
    float4 result = mul(g_0, float4x4(0.1765669, 0.14268716, 0.19186598, 0.15799578, 0.016374417, 0.018578433, 0.0039475, 0.0046772263, 0.39840183, 0.36909792, 0.35409746, 0.37422222, -0.108508386, -0.1331279, -0.10336035, -0.14776541));
    result += mul(g_1, float4x4(-0.057757027, -0.14071062, -0.025283009, -0.09397916, -0.09031894, -0.14219165, -0.08299535, -0.13970287, -0.12259208, -0.14382727, -0.22002274, -0.25016093, -0.048906635, 0.06620249, 0.016965045, 0.1295978));
    result += mul(g_2, float4x4(-0.16748372, -0.13718611, -0.18565705, -0.15029612, -0.080749065, -0.09955825, 0.032431383, 0.023855643, -0.2748885, -0.23232168, -0.29121292, -0.26405892, 0.16556135, 0.18657646, 0.1424068, 0.18855052));
    result += mul(g_3, float4x4(0.10960496, 0.10851629, 0.095003806, 0.11053746, 0.09885307, 0.14437789, 0.13191165, 0.17365928, 0.16558935, 0.15473324, 0.21136154, 0.19976667, -0.07267957, -0.11469687, -0.029134216, -0.06817615));
    result += mul(g_4, float4x4(0.10202856, 0.04216857, -0.03959349, -0.09849683, -0.1576996, -0.049997438, -0.1579918, -0.058789205, 0.029792828, -0.07311781, -0.045432188, -0.11312683, 0.24257647, 0.16204113, 0.17869382, 0.16024388));
    result += mul(g_5, float4x4(0.17193612, 0.12692013, 0.13177487, 0.0796725, 0.0797928, 0.08952722, -0.012468046, 0.011071511, -0.068559825, -0.024852324, 0.0526428, 0.07917346, -0.085534215, -0.09591339, 0.04615827, 0.024577664));
    result += mul(g_6, float4x4(-0.14653449, -0.067267366, -0.002524394, 0.086243175, 0.13660401, 0.08039592, 0.09179008, 0.022573143, -0.024744196, 0.09120211, 0.017654825, 0.14114714, -0.16093308, -0.14538004, -0.09950235, -0.111152865));
    result += mul(g_7, float4x4(-0.188637, -0.12968326, -0.1200479, -0.06537649, -0.12589337, -0.106242515, -0.02788782, -0.025949068, 0.04948153, 0.02222735, -0.025291357, -0.12379292, 0.11074645, 0.11902375, -0.00056989543, -0.0024386419));
    result += mul(g_8, float4x4(0.018286629, 0.0072215167, 0.00037828335, 0.0047001047, 0.011478272, 0.041745186, -0.015742473, -0.002282524, -0.03440817, -0.02196847, -0.07838253, -0.07993771, -0.010155526, -0.017590692, 0.027141469, 0.029741213));
    result += mul(g_9, float4x4(0.016512005, 0.004950637, -0.0238836, -0.05587327, -0.03164328, -0.009499985, -0.059880238, -0.061794154, 0.023154303, -0.013266373, 0.04701534, 0.0415862, 0.06357814, 0.033057794, 0.08389772, 0.00035060212));
    result += mul(g_10, float4x4(-0.016403968, -0.012538788, -0.0015746636, -0.004771009, -0.021361275, -0.009695242, 0.020548422, -0.0024130535, 0.07796766, -0.01516671, 0.09961382, 0.042754963, 0.017363647, 0.03729065, -0.004795824, 0.01550197));
    result += mul(g_11, float4x4(-0.0028093113, 0.011869523, -0.02216933, 0.011177349, 0.033342455, -0.021146454, 0.07830085, 0.032490104, -0.03281833, 0.0060484232, -0.04081057, -0.04945058, -0.0056189033, -0.010636801, -0.041949317, -0.025739705));
    result += mul(g_12, float4x4(0.012979897, 0.016758928, -0.049062215, -0.0035748442, 0.0085972, 0.0036381132, -0.0055621094, 0.0041307937, -0.0008907763, -0.0034079372, -0.025680453, -0.015531803, 0.012816766, 0.009977763, -0.016416566, 0.0034859509));
    result += mul(g_13, float4x4(0.021753248, 0.016452711, 0.009833835, 0.0065052663, 0.0014061348, -0.046160888, -0.0132271005, -0.05051269, -0.05746351, -0.0012690664, 0.017191738, 0.018192926, -0.008879476, 0.026354216, -0.012801991, -0.029587373));
    result += mul(g_14, float4x4(-0.04220692, -0.0015560482, -0.0019648245, 0.013402305, -0.018259782, -0.0036008905, 0.0035650074, -0.0019178417, 0.00051580026, 0.027355857, -0.017914988, 0.004937948, -0.046335887, 0.00013612259, 0.030293299, 0.030688645));
    result += mul(g_15, float4x4(-0.036683388, -0.0031274238, -0.026074665, 0.021684237, 0.022639066, 0.0022493738, 0.011508554, -0.0006385944, 0.04890418, 0.020119468, 0.004167364, -0.008356099, -0.008598796, 0.0089028, -0.0029575853, 0.016687104));
    result += mul(g_16, float4x4(0.027207986, 0.0011099194, 0.042383645, -0.015179333, 0.014744431, 0.006148344, 0.005165422, 0.0070196544, 0.030286826, 0.016620956, -0.01611366, -0.00667594, -0.029524863, -0.024751091, -0.013321004, -0.025199674));
    result += mul(g_17, float4x4(0.0027477827, 0.054622147, 0.010154094, 0.025437292, 0.031773083, -0.01055473, 0.022864206, -0.029010754, -0.0029999653, 0.025018329, 0.015316208, 0.027188798, -0.10096525, -0.017268656, 0.0012529213, -0.062078856));
    result += mul(g_18, float4x4(-0.053670805, 0.057336535, -0.037418038, 0.06443577, -0.016027879, -0.058168363, 0.007034215, -0.03390141, -0.0019346164, -0.027947908, 0.021723913, -0.0018286633, 0.030507812, 0.018293543, 0.042917266, 0.033528328));
    result += mul(g_19, float4x4(-0.004559579, 0.029667616, -0.001870353, 0.0378995, -0.017147437, 0.020192018, -0.021574946, 0.031568103, 0.07487145, 0.0032376775, -0.018893708, -0.041981626, 0.054478757, 0.0061423797, 0.041280247, 0.000878061));
    result += mul(g_20, float4x4(0.017076394, 0.023647636, 0.029403262, 0.029923365, 0.08866472, 0.060613394, 0.1314274, -0.04490231, -0.016304834, -0.0062647443, -0.0031828512, -0.03989252, -0.024330825, 0.00741213, -0.04075287, -0.01615817));
    result += mul(g_21, float4x4(0.017866978, 0.017720113, -0.02846163, 0.040761847, -0.0063438355, -0.02347501, 0.029564403, -0.0029562064, 0.12505588, -0.0073986333, 0.11250363, -0.06179967, 0.07854423, 0.08546533, 0.034743227, -0.010757377));
    result += mul(g_22, float4x4(-0.06416677, -0.08344284, 0.030138884, 0.017635904, -0.012087523, 0.014205202, -0.03221233, -0.023834767, -0.091186255, -0.028958676, -0.04724334, 0.00013161585, 0.027391518, 0.1249978, -0.045047652, 0.10737729));
    result += mul(g_23, float4x4(-0.04326348, -0.03543181, -0.029558217, -0.08582413, 0.007812453, 0.014296562, -0.028779754, 0.018517692, -0.063755795, -0.036619596, -0.050809663, 0.005431336, -0.029205568, -0.011827915, -0.031110523, -0.005648626));
    result += mul(g_24, float4x4(0.05499293, -0.10000709, -0.0943537, 0.16143042, -0.019952895, -0.0039807972, -0.014841254, 0.0320363, -0.065173544, -0.049425576, -0.023904482, 0.03759679, -0.03207411, -0.047782745, 0.01352581, 0.008140566));
    result += mul(g_25, float4x4(0.055923894, -0.025134467, 0.029583648, 0.04096879, 0.027551858, -0.14995384, 0.06467113, -0.11633077, -0.01563784, -0.026909819, -0.06292879, -0.078409635, -0.009081105, -0.015533088, 0.019585673, 0.04334208));
    result += mul(g_26, float4x4(-0.021717606, 0.042464726, 0.02743202, -0.07388838, 0.03460472, 0.0038285658, 0.099842004, -0.098247, 0.13276267, -0.020793032, -0.008603039, -0.051913783, 0.12959045, 0.14735717, -0.10888226, -0.10263746));
    result += mul(g_27, float4x4(-0.16819532, 0.141579, -0.062480718, -0.021918943, 0.06348125, 0.06849444, 0.03888676, 0.027375204, -0.08194279, -0.012574497, 0.13523251, 0.13739482, -0.047547445, -0.058767617, 0.07009549, 0.028136581));
    result += float4(0.069033325, 0.040207114, 0.027286075, 0.0065334598);
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
