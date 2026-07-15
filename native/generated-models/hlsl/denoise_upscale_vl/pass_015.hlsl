// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_VL.glsl:785
// Pass: 015 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(VL)-Conv-4x1x1x112
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
    float4 result = mul(g_0, float4x4(-0.009000901, -0.018048609, 0.013095594, 0.002321373, 0.0004716619, 0.00504148, -0.016826658, -0.014922383, 0.15059204, 0.16593806, 0.115392484, 0.12520894, 0.05049829, 0.060210057, 0.086421266, 0.07242362));
    result += mul(g_1, float4x4(0.06268658, 0.030466434, 0.07876877, 0.04129863, 0.04142328, 0.009963961, 0.051785357, 0.012811113, 0.1295883, 0.139931, 0.07733839, 0.08014211, 0.07156476, 0.0342396, 0.051614303, 0.043559864));
    result += mul(g_2, float4x4(0.00041542648, 0.016051646, -0.011512418, 0.013076814, 0.03734479, 0.02791584, 0.012426691, 0.022044811, -0.034128398, -0.027107332, -0.021998279, -0.012139807, -0.033177473, -0.016310865, -0.078221664, -0.041203145));
    result += mul(g_3, float4x4(-0.008398536, -0.010332053, -0.050231732, -0.039691273, -0.042082537, -0.030281143, -0.014039778, -0.0020190612, -0.11956351, -0.13638765, -0.09794402, -0.10228069, -0.08344795, -0.07944541, -0.004189214, -0.028206991));
    result += mul(g_4, float4x4(0.0002908945, -0.00831185, -0.06870294, -0.083311856, -0.024992501, 0.0038247898, -0.049389005, -0.020098582, -0.0135326125, -0.040408995, -0.012083491, -0.042174604, 0.16112538, 0.13720983, 0.13937058, 0.10870099));
    result += mul(g_5, float4x4(0.078961425, 0.082619205, 0.06910667, 0.06579004, -0.0077012256, -0.00038692637, 0.00015553503, -0.012561662, 0.00053048285, -0.01461681, 0.02600344, 0.024862211, -0.06958201, -0.048246548, 0.058762506, 0.036662634));
    result += mul(g_6, float4x4(-0.023527982, -0.0028001352, 0.047800142, 0.09616409, 0.049143843, 0.030836122, 0.057244994, 0.025672587, 0.027565151, 0.039868724, 0.045296676, 0.04623187, -0.124759234, -0.14106254, -0.06337279, -0.076839216));
    result += mul(g_7, float4x4(-0.0911771, -0.064436875, -0.05308137, -0.022082496, -0.0040269364, 0.0014464161, -0.0029555515, 0.016098293, -0.026650434, -0.014081368, -0.06747348, -0.05481826, 0.097423114, 0.08620988, -0.01607732, -0.015440677));
    result += mul(g_8, float4x4(-0.014001735, -0.015001655, -0.013250577, -0.009930805, 0.04885879, 0.07092224, 0.025783395, 0.03792237, -0.04332465, -0.06244993, -0.046748653, -0.07132349, -0.0053951666, -0.016514057, 0.023807624, 0.044013456));
    result += mul(g_9, float4x4(-0.009097996, -0.016898679, -0.05043909, -0.063178614, -0.016210863, -0.02157998, -0.02654472, -0.042961173, 0.012103852, 0.019015301, 0.02492281, 0.03389976, 0.015276502, 0.009577683, 0.04132527, -0.00070621347));
    result += mul(g_10, float4x4(-0.0057500796, 0.00728164, -0.003422421, 0.0038979584, -0.03127353, -0.019125199, -0.012988815, -0.031890683, 0.09352588, 0.019210607, 0.09824038, 0.016637104, 0.010692808, 0.022393884, 0.008312123, 0.014120716));
    result += mul(g_11, float4x4(0.013895599, 0.023097904, 0.009370535, 0.014099512, 0.0124661345, -0.015076684, 0.03287286, 0.005912471, -0.03944815, -0.020340785, -0.06822037, -0.059383288, 0.03634978, 0.007832939, -0.007142306, -0.0061968984));
    result += mul(g_12, float4x4(0.033002097, 0.0516016, -0.021056438, 0.005715988, -0.02223013, -0.007962324, -0.024417123, -0.0014790733, 0.002167189, 0.00043749413, -0.007284963, -0.0027283782, 0.026238248, 0.01756047, 0.008969755, 0.014201024));
    result += mul(g_13, float4x4(0.011576685, 0.02087598, 0.0026766327, -0.0041780816, -0.05277701, -0.05412841, -0.05958835, -0.050426245, -0.00662945, -0.021645393, 0.03423904, -0.0064581474, -0.030403355, 0.018391011, -0.026089542, -0.0051510665));
    result += mul(g_14, float4x4(-0.046202097, -0.0066081425, -0.03698851, 0.0034165455, -0.011859245, -0.020945566, -0.0028196946, -0.010053285, -0.011400397, 0.030595876, -0.018915813, 0.006780077, -0.060040582, -0.009586898, -0.004477886, 0.011279908));
    result += mul(g_15, float4x4(-0.028692413, -0.032535568, 0.0017473884, 0.02207169, 0.0192618, 0.008956797, -0.0033381556, 0.006326402, 0.0169569, 0.041449737, -0.02611751, 0.0006410355, 0.006233776, 0.0008467914, 0.011884985, 0.009222136));
    result += mul(g_16, float4x4(0.017076496, -0.0045380928, 0.03444613, -0.009804047, -0.004829834, -0.004889702, 0.0057807956, 0.0015014127, 0.03458368, -0.0035773432, -0.007769679, -0.032449644, -0.021396799, -0.017612215, -0.012764735, -0.025224172));
    result += mul(g_17, float4x4(-0.011824532, 0.02335273, 0.00764845, 0.019215155, 0.022186808, 0.0066053392, 0.0071694753, -0.0036117272, 0.032144524, 0.05025988, 0.03982363, 0.052400436, -0.10555114, -0.03809396, -0.05334183, -0.05524487));
    result += mul(g_18, float4x4(-0.024599254, 0.058805298, 0.00069874676, 0.06263439, -0.018460508, -0.053566024, -0.0022889362, -0.035818785, -0.0135854995, -0.015712813, 0.0012080368, 0.005957637, 0.009450094, 0.03186346, 0.059969924, 0.057706963));
    result += mul(g_19, float4x4(0.026783831, 0.05475865, 0.027565574, 0.06032707, -0.0015639095, 0.024381682, -0.010199071, 0.037544634, 0.039889377, 0.03318851, -0.016529158, -0.0343188, 0.045666486, 0.021665907, 0.042189375, 0.02444145));
    result += mul(g_20, float4x4(0.03791853, 0.043746054, 0.056224477, 0.05098111, 0.075256795, 0.074653305, 0.116220035, 0.01853866, -0.04133627, -0.009134169, -0.0420953, -0.05210053, -0.021748418, 0.004422131, -0.05422814, -0.035721727));
    result += mul(g_21, float4x4(0.013814317, 0.03149986, -0.004971173, 0.04782029, -0.01693027, -0.017984565, 0.019328078, 0.008521426, 0.0845641, -0.027555496, 0.08150416, -0.04623306, 0.16494128, 0.09300831, 0.074097835, 0.0627848));
    result += mul(g_22, float4x4(-0.10307174, -0.112654425, -0.005589254, -0.0062108496, -0.012491583, 0.011512013, -0.03142282, -0.023683488, -0.099848576, -0.031290524, -0.07236223, -0.037460987, 0.008760208, 0.1473594, -0.009216949, 0.07251379));
    result += mul(g_23, float4x4(-0.04915367, -0.07121096, -0.06572174, -0.10967046, 0.019548079, 0.023992533, -0.019842865, 0.012366459, -0.07207817, -0.04237792, -0.054463565, -0.015374731, -0.092071235, -0.020860313, -0.054475963, -0.02303954));
    result += mul(g_24, float4x4(0.04160816, -0.118427366, -0.08661791, 0.12787233, -0.01990174, 0.0012960634, -0.016121056, 0.031429946, -0.06830865, -0.057132352, -0.0022302791, 0.03845933, -0.026981276, -0.063532256, 0.011805961, -0.009616678));
    result += mul(g_25, float4x4(0.07094465, -0.022284096, 0.060676746, 0.042626668, 0.011207256, -0.14960343, 0.05866539, -0.12742221, -0.021092903, -0.039463162, -0.07879986, -0.10232898, -0.026127055, -0.038111385, 0.019167708, 0.032637425));
    result += mul(g_26, float4x4(-0.014270794, 0.07157703, 0.013714203, -0.047801998, 0.0060221693, 0.022788104, 0.10630103, -0.09606649, 0.12690987, -0.017079826, -0.0077072172, -0.082584485, 0.13256006, 0.16012523, -0.10966099, -0.07927409));
    result += mul(g_27, float4x4(-0.17171615, 0.12114435, -0.10746857, -0.0074188868, 0.07854815, 0.07759372, 0.04310874, 0.051465522, -0.05963588, -0.014506484, 0.15522978, 0.18746643, -0.03845241, -0.0489534, 0.05837339, 0.032978524));
    result += float4(0.05825913, 0.051491056, 0.038389463, 0.03321517);
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
