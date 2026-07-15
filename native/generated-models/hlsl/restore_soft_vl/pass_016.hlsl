// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_VL.glsl:794
// Pass: 016 - Anime4K-v4.0-Restore-CNN-Soft-(VL)-Conv-3x1x1x112
// Anime4K is Copyright (c) 2019-2021 bloc97, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[15];
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
Texture2D<float4> Anime4KInput14 : register(t14);
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

float4 Anime4KTransform14(float4 value)
{
    return value;
}

float2 Anime4KClampUv14(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[14].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample14(float2 uv)
{
    return Anime4KTransform14(float4(Anime4KInput14.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv14(uv), 0.0)));
}

float4 Anime4KLoadOffset14(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[14].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform14(float4(Anime4KInput14.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent14(uint2 position)
{
    return Anime4KTransform14(float4(Anime4KInput14.Load(int3(position, 0))));
}

#define MAIN_tex(position) Anime4KSample0(position)
#define MAIN_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define MAIN_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define MAIN_pos anime4k_pos
#define MAIN_size float2(Anime4KInputSizes[0].xy)
#define MAIN_pt rcp(MAIN_size)
#define conv2d_1_tf_tex(position) Anime4KSample1(position)
#define conv2d_1_tf_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_1_tf_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_1_tf_pos anime4k_pos
#define conv2d_1_tf_size float2(Anime4KInputSizes[1].xy)
#define conv2d_1_tf_pt rcp(conv2d_1_tf_size)
#define conv2d_1_tf1_tex(position) Anime4KSample2(position)
#define conv2d_1_tf1_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_1_tf1_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_1_tf1_pos anime4k_pos
#define conv2d_1_tf1_size float2(Anime4KInputSizes[2].xy)
#define conv2d_1_tf1_pt rcp(conv2d_1_tf1_size)
#define conv2d_2_tf_tex(position) Anime4KSample3(position)
#define conv2d_2_tf_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_2_tf_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_2_tf_pos anime4k_pos
#define conv2d_2_tf_size float2(Anime4KInputSizes[3].xy)
#define conv2d_2_tf_pt rcp(conv2d_2_tf_size)
#define conv2d_2_tf1_tex(position) Anime4KSample4(position)
#define conv2d_2_tf1_texOff(offset) Anime4KLoadOffset4(anime4k_output_pixel, offset)
#define conv2d_2_tf1_texCurrent Anime4KLoadCurrent4(anime4k_output_pixel)
#define conv2d_2_tf1_pos anime4k_pos
#define conv2d_2_tf1_size float2(Anime4KInputSizes[4].xy)
#define conv2d_2_tf1_pt rcp(conv2d_2_tf1_size)
#define conv2d_3_tf_tex(position) Anime4KSample5(position)
#define conv2d_3_tf_texOff(offset) Anime4KLoadOffset5(anime4k_output_pixel, offset)
#define conv2d_3_tf_texCurrent Anime4KLoadCurrent5(anime4k_output_pixel)
#define conv2d_3_tf_pos anime4k_pos
#define conv2d_3_tf_size float2(Anime4KInputSizes[5].xy)
#define conv2d_3_tf_pt rcp(conv2d_3_tf_size)
#define conv2d_3_tf1_tex(position) Anime4KSample6(position)
#define conv2d_3_tf1_texOff(offset) Anime4KLoadOffset6(anime4k_output_pixel, offset)
#define conv2d_3_tf1_texCurrent Anime4KLoadCurrent6(anime4k_output_pixel)
#define conv2d_3_tf1_pos anime4k_pos
#define conv2d_3_tf1_size float2(Anime4KInputSizes[6].xy)
#define conv2d_3_tf1_pt rcp(conv2d_3_tf1_size)
#define conv2d_4_tf_tex(position) Anime4KSample7(position)
#define conv2d_4_tf_texOff(offset) Anime4KLoadOffset7(anime4k_output_pixel, offset)
#define conv2d_4_tf_texCurrent Anime4KLoadCurrent7(anime4k_output_pixel)
#define conv2d_4_tf_pos anime4k_pos
#define conv2d_4_tf_size float2(Anime4KInputSizes[7].xy)
#define conv2d_4_tf_pt rcp(conv2d_4_tf_size)
#define conv2d_4_tf1_tex(position) Anime4KSample8(position)
#define conv2d_4_tf1_texOff(offset) Anime4KLoadOffset8(anime4k_output_pixel, offset)
#define conv2d_4_tf1_texCurrent Anime4KLoadCurrent8(anime4k_output_pixel)
#define conv2d_4_tf1_pos anime4k_pos
#define conv2d_4_tf1_size float2(Anime4KInputSizes[8].xy)
#define conv2d_4_tf1_pt rcp(conv2d_4_tf1_size)
#define conv2d_5_tf_tex(position) Anime4KSample9(position)
#define conv2d_5_tf_texOff(offset) Anime4KLoadOffset9(anime4k_output_pixel, offset)
#define conv2d_5_tf_texCurrent Anime4KLoadCurrent9(anime4k_output_pixel)
#define conv2d_5_tf_pos anime4k_pos
#define conv2d_5_tf_size float2(Anime4KInputSizes[9].xy)
#define conv2d_5_tf_pt rcp(conv2d_5_tf_size)
#define conv2d_5_tf1_tex(position) Anime4KSample10(position)
#define conv2d_5_tf1_texOff(offset) Anime4KLoadOffset10(anime4k_output_pixel, offset)
#define conv2d_5_tf1_texCurrent Anime4KLoadCurrent10(anime4k_output_pixel)
#define conv2d_5_tf1_pos anime4k_pos
#define conv2d_5_tf1_size float2(Anime4KInputSizes[10].xy)
#define conv2d_5_tf1_pt rcp(conv2d_5_tf1_size)
#define conv2d_6_tf_tex(position) Anime4KSample11(position)
#define conv2d_6_tf_texOff(offset) Anime4KLoadOffset11(anime4k_output_pixel, offset)
#define conv2d_6_tf_texCurrent Anime4KLoadCurrent11(anime4k_output_pixel)
#define conv2d_6_tf_pos anime4k_pos
#define conv2d_6_tf_size float2(Anime4KInputSizes[11].xy)
#define conv2d_6_tf_pt rcp(conv2d_6_tf_size)
#define conv2d_6_tf1_tex(position) Anime4KSample12(position)
#define conv2d_6_tf1_texOff(offset) Anime4KLoadOffset12(anime4k_output_pixel, offset)
#define conv2d_6_tf1_texCurrent Anime4KLoadCurrent12(anime4k_output_pixel)
#define conv2d_6_tf1_pos anime4k_pos
#define conv2d_6_tf1_size float2(Anime4KInputSizes[12].xy)
#define conv2d_6_tf1_pt rcp(conv2d_6_tf1_size)
#define conv2d_7_tf_tex(position) Anime4KSample13(position)
#define conv2d_7_tf_texOff(offset) Anime4KLoadOffset13(anime4k_output_pixel, offset)
#define conv2d_7_tf_texCurrent Anime4KLoadCurrent13(anime4k_output_pixel)
#define conv2d_7_tf_pos anime4k_pos
#define conv2d_7_tf_size float2(Anime4KInputSizes[13].xy)
#define conv2d_7_tf_pt rcp(conv2d_7_tf_size)
#define conv2d_7_tf1_tex(position) Anime4KSample14(position)
#define conv2d_7_tf1_texOff(offset) Anime4KLoadOffset14(anime4k_output_pixel, offset)
#define conv2d_7_tf1_texCurrent Anime4KLoadCurrent14(anime4k_output_pixel)
#define conv2d_7_tf1_pos anime4k_pos
#define conv2d_7_tf1_size float2(Anime4KInputSizes[14].xy)
#define conv2d_7_tf1_pt rcp(conv2d_7_tf1_size)

#define g_0 (max((conv2d_1_tf_texCurrent), 0.0))
#define g_1 (max((conv2d_1_tf1_texCurrent), 0.0))
#define g_2 (max(-(conv2d_1_tf_texCurrent), 0.0))
#define g_3 (max(-(conv2d_1_tf1_texCurrent), 0.0))
#define g_4 (max((conv2d_2_tf_texCurrent), 0.0))
#define g_5 (max((conv2d_2_tf1_texCurrent), 0.0))
#define g_6 (max(-(conv2d_2_tf_texCurrent), 0.0))
#define g_7 (max(-(conv2d_2_tf1_texCurrent), 0.0))
#define g_8 (max((conv2d_3_tf_texCurrent), 0.0))
#define g_9 (max((conv2d_3_tf1_texCurrent), 0.0))
#define g_10 (max(-(conv2d_3_tf_texCurrent), 0.0))
#define g_11 (max(-(conv2d_3_tf1_texCurrent), 0.0))
#define g_12 (max((conv2d_4_tf_texCurrent), 0.0))
#define g_13 (max((conv2d_4_tf1_texCurrent), 0.0))
#define g_14 (max(-(conv2d_4_tf_texCurrent), 0.0))
#define g_15 (max(-(conv2d_4_tf1_texCurrent), 0.0))
#define g_16 (max((conv2d_5_tf_texCurrent), 0.0))
#define g_17 (max((conv2d_5_tf1_texCurrent), 0.0))
#define g_18 (max(-(conv2d_5_tf_texCurrent), 0.0))
#define g_19 (max(-(conv2d_5_tf1_texCurrent), 0.0))
#define g_20 (max((conv2d_6_tf_texCurrent), 0.0))
#define g_21 (max((conv2d_6_tf1_texCurrent), 0.0))
#define g_22 (max(-(conv2d_6_tf_texCurrent), 0.0))
#define g_23 (max(-(conv2d_6_tf1_texCurrent), 0.0))
#define g_24 (max((conv2d_7_tf_texCurrent), 0.0))
#define g_25 (max((conv2d_7_tf1_texCurrent), 0.0))
#define g_26 (max(-(conv2d_7_tf_texCurrent), 0.0))
#define g_27 (max(-(conv2d_7_tf1_texCurrent), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(g_0, float4x4(0.121882804, 0.055417646, 0.037575886, 0.0, 0.040015355, 0.10440659, 0.120197006, 0.0, 0.008896276, 0.07269119, 0.09253319, 0.0, 0.009000448, -0.033739295, -0.059260685, 0.0));
    result += mul(g_1, float4x4(-0.048027042, 0.09210703, 0.123745404, 0.0, -0.007914943, 0.05483587, 0.054822505, 0.0, -0.005998682, 0.005822986, 0.009868176, 0.0, -0.05866792, -0.04236153, -0.022935968, 0.0));
    result += mul(g_2, float4x4(-0.091270015, -0.033997003, -0.012321896, 0.0, -0.037983265, -0.078790314, -0.085029654, 0.0, 0.10656225, 0.0008334142, -0.0041227583, 0.0, 0.077364065, 0.033960085, 0.029391684, 0.0));
    result += mul(g_3, float4x4(0.15057671, -0.037442014, -0.037083894, 0.0, 0.015493511, -0.016119987, -0.027061606, 0.0, -0.012329675, 0.0060544596, -0.019787522, 0.0, 0.12182345, 0.11346318, 0.08640806, 0.0));
    result += mul(g_4, float4x4(0.19254518, 0.009179287, 0.023821035, 0.0, 0.020269603, 0.025629226, 0.040180814, 0.0, -0.025135614, -0.07785793, -0.099851295, 0.0, -0.122886, 0.03322616, 0.0509256, 0.0));
    result += mul(g_5, float4x4(0.060054794, 0.053996198, 0.047226787, 0.0, 0.038959846, -0.025839888, -0.030583512, 0.0, -0.034999896, 0.011966571, -0.011057454, 0.0, 0.05765179, -0.041760337, -0.0694113, 0.0));
    result += mul(g_6, float4x4(-0.20393562, -0.0055942894, -0.02089636, 0.0, 0.14781304, -0.01954523, -0.0746086, 0.0, 0.071556985, 0.07512172, 0.067927115, 0.0, 0.084076844, -0.0561336, -0.06856403, 0.0));
    result += mul(g_7, float4x4(-0.039552618, -0.04448951, -0.04170605, 0.0, -0.00886809, 0.06708884, 0.07120977, 0.0, 0.04834384, -0.10599933, -0.11024835, 0.0, -0.015948117, 0.084044695, 0.10778199, 0.0));
    result += mul(g_8, float4x4(0.050153337, 0.012563414, 0.014994658, 0.0, 0.10498867, 0.07151875, 0.06761489, 0.0, 0.061650798, -0.035183728, -0.050987806, 0.0, 0.0017240314, 0.041055307, 0.020366805, 0.0));
    result += mul(g_9, float4x4(0.110105395, -0.044468552, -0.072567016, 0.0, -0.049364448, -0.015713394, -0.021540897, 0.0, -0.01636263, -0.084110685, -0.08281401, 0.0, -0.08940374, 0.047863875, 0.051104594, 0.0));
    result += mul(g_10, float4x4(-0.081597924, 0.002422661, 0.01143175, 0.0, -0.07504751, -0.09938017, -0.1063178, 0.0, -0.10390281, 0.0262197, 0.060155805, 0.0, -0.24289346, -0.0054961476, 0.045964316, 0.0));
    result += mul(g_11, float4x4(-0.1829316, 0.047622137, 0.07963877, 0.0, 0.048703995, -0.0026299425, -0.003712008, 0.0, 0.029338706, 0.096882835, 0.102083966, 0.0, 0.078538164, -0.07247937, -0.06820231, 0.0));
    result += mul(g_12, float4x4(-0.02302231, -0.035528302, -0.030674051, 0.0, 0.029780716, 0.031591274, 0.045867007, 0.0, 0.01335752, 0.037001595, 0.04351411, 0.0, -0.11126892, 0.038589563, 0.06444906, 0.0));
    result += mul(g_13, float4x4(0.0047764573, -0.063372664, -0.065609895, 0.0, 0.0478139, 0.025694113, 0.025097322, 0.0, -0.1019169, 0.029989049, 0.050038517, 0.0, 0.07504127, -0.017047737, -0.026222635, 0.0));
    result += mul(g_14, float4x4(0.0024485083, 0.00640911, 0.008171829, 0.0, -0.014622121, -0.06078096, -0.0800138, 0.0, -0.0062360805, -0.014344496, -0.021332184, 0.0, 0.117842786, -0.103745885, -0.13756834, 0.0));
    result += mul(g_15, float4x4(-0.01942775, 0.08720701, 0.104858086, 0.0, -0.05545872, -0.041375194, -0.035368554, 0.0, 0.080331706, -0.021207837, -0.043905254, 0.0, -0.12515299, 3.445463e-05, 0.018742712, 0.0));
    result += mul(g_16, float4x4(0.013106969, 0.010379314, 0.012753471, 0.0, 0.07086715, -0.020893, -0.03968904, 0.0, -0.06114372, 0.029510446, 0.035070244, 0.0, 0.11180839, -0.087067656, -0.124039896, 0.0));
    result += mul(g_17, float4x4(-0.056521703, -0.001166792, -2.3704073e-05, 0.0, 0.011961608, 0.01848977, 0.019861937, 0.0, 0.012167056, 0.018613879, 0.020505793, 0.0, 0.009734187, -0.0308419, -0.035206888, 0.0));
    result += mul(g_18, float4x4(0.0048758825, 0.018046578, 0.014597015, 0.0, -0.061724614, 0.040989272, 0.05644141, 0.0, 0.070315465, 0.008318584, 0.0028647361, 0.0, -0.11316492, 0.043919202, 0.07653594, 0.0));
    result += mul(g_19, float4x4(0.031487904, -0.010548384, -0.009984509, 0.0, -0.0022647562, 0.0043304027, 0.0029451603, 0.0, -0.0063251094, -0.013420807, -0.011919729, 0.0, -0.022760967, 0.019141173, 0.01782793, 0.0));
    result += mul(g_20, float4x4(0.023055293, 0.028219413, 0.024810018, 0.0, 0.031653803, 0.050207954, 0.04504577, 0.0, 0.03877294, 0.0280465, 0.025589157, 0.0, 0.0019387804, 0.023891818, 0.016049948, 0.0));
    result += mul(g_21, float4x4(0.006562233, 0.03880659, 0.037682824, 0.0, -0.021441424, -0.011277022, -0.012471097, 0.0, -0.030526241, -0.013880651, -0.014213582, 0.0, 0.0075785257, -0.0017350517, -0.0024610942, 0.0));
    result += mul(g_22, float4x4(0.015097556, 0.020325955, 0.015611413, 0.0, -0.014755199, -0.034323387, -0.032325987, 0.0, -0.008603291, 0.010346807, 0.011044969, 0.0, -0.004739154, -0.026397636, -0.01995132, 0.0));
    result += mul(g_23, float4x4(0.0097906375, -0.015094543, -0.016887931, 0.0, -0.0007786067, -0.0069163437, -0.008449091, 0.0, 0.025534432, 0.018064791, 0.017047096, 0.0, 0.00055667467, 0.001493328, 0.003636564, 0.0));
    result += mul(g_24, float4x4(-0.042251963, -0.042396102, -0.040224236, 0.0, -0.004492444, -0.0069470624, -0.0065821502, 0.0, 0.062203273, 0.06213223, 0.053592753, 0.0, 0.06424337, 0.07964681, 0.07316769, 0.0));
    result += mul(g_25, float4x4(0.026366957, 0.02789826, 0.027239393, 0.0, -0.006712127, -0.0035723334, -0.0032348586, 0.0, -0.04960562, -0.062758155, -0.058574595, 0.0, -0.02896146, -0.020999067, -0.021301663, 0.0));
    result += mul(g_26, float4x4(-0.013106142, -0.017057793, -0.014653614, 0.0, -0.04254173, -0.043040022, -0.041918345, 0.0, -0.011146975, -0.0043820064, -0.003768677, 0.0, -0.0027743059, -0.0114479, -0.0082087545, 0.0));
    result += mul(g_27, float4x4(-0.10087762, -0.10447133, -0.1005168, 0.0, -0.04165659, -0.04558967, -0.040086865, 0.0, 0.0016493691, 0.0055392827, 0.0070476984, 0.0, -0.018665023, -0.035552308, -0.03375731, 0.0));
    result += float4(0.018580848, -0.022256816, -0.0266178, 0.0);
    return result + MAIN_texCurrent;
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
