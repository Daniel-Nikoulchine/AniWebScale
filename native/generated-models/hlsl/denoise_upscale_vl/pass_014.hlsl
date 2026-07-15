// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_VL.glsl:704
// Pass: 014 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(VL)-Conv-4x1x1x112
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
    float4 result = mul(g_0, float4x4(-0.105475314, -0.07022547, -0.16326137, -0.12503424, -0.004623021, -0.0143323885, 0.042996034, 0.03422294, -0.38310882, -0.4431925, -0.28772846, -0.3213578, -0.018014904, 0.02429277, -0.07177951, -0.04458822));
    result += mul(g_1, float4x4(-0.0973233, -0.032439478, -0.08420249, -0.054693196, 0.012960555, 0.06929602, 0.004247494, 0.061315402, -0.09607745, -0.16862066, 0.01537482, -0.038459156, 0.019662246, 0.059920583, -0.1071646, -0.06478967));
    result += mul(g_2, float4x4(0.15711947, 0.0754732, 0.17891979, 0.098270796, 0.14122486, 0.14893766, 0.12408279, 0.14845194, 0.16199848, 0.14090912, 0.13496809, 0.1119815, 0.03974558, -0.057513904, 0.09213575, -0.0012252429));
    result += mul(g_3, float4x4(-0.011343602, -0.02488338, 0.07799659, 0.06503721, 0.06380687, 0.048929837, -0.05555838, -0.050519127, 0.14673206, 0.18085165, 0.07261422, 0.09738158, 0.07395791, 0.005573146, -0.05454926, -0.13565786));
    result += mul(g_4, float4x4(-0.08591514, -0.05664865, 0.23980616, 0.24876402, 0.19052829, 0.011938714, 0.21487322, 0.058656186, 0.036630988, 0.14918756, 0.013127693, 0.13092093, -0.37889576, -0.4068804, -0.27258882, -0.30605716));
    result += mul(g_5, float4x4(-0.25149816, -0.21979512, -0.24949454, -0.20483162, -0.10972783, -0.17315808, -0.08562763, -0.16086778, 0.044681527, 0.050807394, -0.019424994, -0.022418005, 0.10039492, -0.013666552, -0.22373566, -0.34493732));
    result += mul(g_6, float4x4(0.1419155, 0.081392206, -0.18103191, -0.2122926, -0.1445937, -0.015969204, -0.12368782, -0.0044421684, -0.09534078, -0.14815839, -0.1052107, -0.16341865, 0.3050403, 0.34488317, 0.16171226, 0.18700944));
    result += mul(g_7, float4x4(0.12444696, 0.08712589, 0.06266247, 0.031022022, 0.17707655, 0.24904409, 0.20961654, 0.2610619, -0.099262595, -0.06900819, -0.034567446, -0.020191457, -0.1468561, -0.04683958, 0.14910224, 0.244686));
    result += mul(g_8, float4x4(-0.002428158, -0.012889509, 0.0006541127, -0.0058380975, 0.096147396, 0.07791617, 0.119144954, 0.11699654, -0.024602454, -0.07894611, -0.00021709128, -0.03979557, 0.0028512406, -0.015790012, 0.0082511455, 0.029357092));
    result += mul(g_9, float4x4(-0.01410329, -0.004162405, -0.09005045, -0.07753674, 0.004509965, -0.024188736, 0.13799691, 0.10589621, -0.023018798, 0.0064198375, -0.103344224, -0.07463909, -0.060048997, -0.071094714, -0.13042289, -0.14482167));
    result += mul(g_10, float4x4(-0.009015246, 0.01581748, -0.035448726, -0.012348933, -0.101627484, -0.05530413, -0.14063041, -0.121775225, 0.074719116, 0.033839386, 0.045573987, -0.006698053, 0.0015141299, 0.003634417, 0.017102007, 0.0074890694));
    result += mul(g_11, float4x4(0.0042357175, 0.018735386, 0.058959343, 0.057424515, -0.021633089, -0.037194982, -0.14109972, -0.1506368, 0.004357002, -0.006871023, 0.05337361, 0.039684236, 0.087463334, 0.07772685, 0.12278512, 0.1224218));
    result += mul(g_12, float4x4(0.018359886, 0.046934873, -0.008225237, 0.020650858, -0.03961538, -0.014779162, -0.04161338, -0.00953579, 0.0017313146, 0.0068857935, -0.0024282748, 0.0047545764, 0.02635904, 0.027336216, 0.02701322, 0.029939381));
    result += mul(g_13, float4x4(-0.00067966996, 0.024480496, -0.015218739, -0.010472019, -0.03994461, -0.052318517, -0.04450191, -0.043226667, -0.03166469, -0.03799331, 0.015428865, -0.018422252, 0.00040845043, 0.03558268, -0.0099401595, -0.00054432114));
    result += mul(g_14, float4x4(-0.0032104475, 0.019604867, -0.02486679, 0.002134673, 0.014368818, -0.0013395248, 0.017318068, 0.0021403218, -0.02198377, 0.010297547, -0.041619625, -0.02740482, -0.067249276, -0.03040953, -0.021304253, -0.009557115));
    result += mul(g_15, float4x4(-0.019099236, -0.037010793, 0.013720462, 0.023708181, 0.016356282, -0.00028589502, -0.010570909, -0.009186907, 0.03493662, 0.055599142, -0.017043956, 0.004204044, -0.013573257, -0.013537684, 0.008151195, 0.0074913655));
    result += mul(g_16, float4x4(0.009309031, -0.0014795153, 0.025114728, -0.0066442797, -0.012085473, -0.0030560147, 0.002144206, 0.0009732741, 0.022301642, -0.0091133695, 0.0011837826, -0.020275833, -0.021349607, -0.011693419, -0.018912962, -0.022418445));
    result += mul(g_17, float4x4(-0.0045772395, 0.031085191, 0.01215795, 0.023887333, 0.023408212, 0.0005998807, 0.011254428, -0.004634461, 0.016601006, 0.046663348, 0.031117432, 0.04910873, -0.113230005, -0.035702843, -0.058746565, -0.053893737));
    result += mul(g_18, float4x4(-0.020218112, 0.056803435, -0.0037077996, 0.05123925, -0.016713811, -0.05551032, -0.005916611, -0.037839632, -0.007671626, -0.009099201, -0.0010055836, 0.003332688, 0.020744357, 0.01957675, 0.057906736, 0.041446246));
    result += mul(g_19, float4x4(0.022438819, 0.04616756, 0.035925094, 0.0639705, 0.0009332198, 0.020964272, -0.010805394, 0.031757344, 0.051255573, 0.032838948, 0.00055445684, -0.03195623, 0.04753827, 0.016436901, 0.04788274, 0.022093765));
    result += mul(g_20, float4x4(0.03479086, 0.035946105, 0.04343359, 0.04015664, 0.06081792, 0.061758887, 0.10128842, 0.007471392, -0.027261607, -0.01290544, -0.029938918, -0.050834358, -0.015550162, 0.0072828676, -0.04580556, -0.029642029));
    result += mul(g_21, float4x4(0.011150116, 0.029789668, -0.00354488, 0.045047592, -0.018265083, -0.020843878, 0.015457328, 0.0053232997, 0.0791804, -0.028661052, 0.079342775, -0.039631505, 0.14613943, 0.08323415, 0.049641483, 0.047863442));
    result += mul(g_22, float4x4(-0.103034586, -0.107580125, 0.00044325445, 0.007830247, -0.017059505, 0.010152936, -0.02845979, -0.01841766, -0.10722863, -0.025262646, -0.07402096, -0.025055556, 0.0013303137, 0.12574737, -0.0161103, 0.06077798));
    result += mul(g_23, float4x4(-0.0420636, -0.062703885, -0.06476972, -0.10516001, 0.018120673, 0.024305122, -0.013997766, 0.015815413, -0.06317691, -0.03968166, -0.054052643, -0.016300509, -0.08255892, -0.01612941, -0.04194852, -0.012637189));
    result += mul(g_24, float4x4(0.042659573, -0.10762496, -0.077143244, 0.12583935, -0.022020226, -0.0042312425, -0.016734738, 0.027007964, -0.06609771, -0.056038737, -0.0058528963, 0.035508137, -0.019722374, -0.055094264, 0.010977759, -0.009833099));
    result += mul(g_25, float4x4(0.063830875, -0.019885639, 0.055574782, 0.039456647, 0.01576898, -0.1389799, 0.063411795, -0.11600623, -0.013968303, -0.03318867, -0.06806915, -0.09373464, -0.022723546, -0.03329239, 0.014282872, 0.027576538));
    result += mul(g_26, float4x4(-0.018100513, 0.06204485, 0.010761461, -0.045085587, 0.009286288, 0.02310671, 0.10633246, -0.090849996, 0.13112675, -0.01639808, 0.0022725316, -0.076779045, 0.11831251, 0.1460306, -0.10849466, -0.07749171));
    result += mul(g_27, float4x4(-0.15850247, 0.118011266, -0.10121594, -0.007109052, 0.071873754, 0.06954878, 0.0377852, 0.044174008, -0.062925555, -0.01758927, 0.1416964, 0.17206357, -0.035632525, -0.04652215, 0.061932907, 0.034339));
    result += float4(-0.11952045, -0.10779418, -0.0626279, -0.042614873);
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
