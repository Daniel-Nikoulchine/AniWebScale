// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_VL.glsl:794
// Pass: 016 - Anime4K-v4.0-Restore-CNN-(VL)-Conv-3x1x1x112
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
    float4 result = mul(g_0, float4x4(0.09689336, 0.06046458, 0.072598994, 0.0, 0.11994565, 0.104477674, 0.09302802, 0.0, -0.05718302, 0.050438102, 0.08814741, 0.0, 0.0308889, 0.0033925986, -0.01715605, 0.0));
    result += mul(g_1, float4x4(-0.028314235, 0.06597744, 0.0966897, 0.0, 0.035656154, 0.07770106, 0.075551905, 0.0, 0.0001793458, -0.000479495, -0.00297406, 0.0, -0.053916585, -0.016807461, -0.0057141334, 0.0));
    result += mul(g_2, float4x4(-0.047189303, -0.0207, -0.020910334, 0.0, -0.07933196, -0.06961211, -0.086069845, 0.0, 0.0943727, 0.008463375, 0.010755166, 0.0, 0.062410597, 0.022625161, 0.04068433, 0.0));
    result += mul(g_3, float4x4(0.10270994, -0.019080428, 0.0050091282, 0.0, -0.004672948, -0.013966742, -0.0063746064, 0.0, -2.5856789e-05, 0.03151499, -0.0023983798, 0.0, 0.113539025, 0.12381699, 0.100360274, 0.0));
    result += mul(g_4, float4x4(0.07868885, -0.030913834, -0.009213676, 0.0, 0.04870991, 0.021467991, 0.038739506, 0.0, -0.042969644, -0.07122453, -0.08798675, 0.0, -0.09784122, 0.021434791, 0.02510374, 0.0));
    result += mul(g_5, float4x4(0.050420716, 0.0729716, 0.076532185, 0.0, -0.019112485, -0.01037939, -0.026948035, 0.0, -0.02591423, 0.008927897, -0.00042541025, 0.0, 0.1043701, -0.0071186824, -0.041817162, 0.0));
    result += mul(g_6, float4x4(-0.16143242, -0.0009298223, -0.01228508, 0.0, 0.07744052, -0.018313263, -0.0488145, 0.0, 0.09241393, 0.07128674, 0.055164956, 0.0, 0.054884013, -0.04834418, -0.06281626, 0.0));
    result += mul(g_7, float4x4(-0.049036566, -0.05979936, -0.05594288, 0.0, -0.014564307, 0.031926468, 0.037857566, 0.0, 0.015474487, -0.11385003, -0.11527764, 0.0, -0.07076006, 0.057038613, 0.095983796, 0.0));
    result += mul(g_8, float4x4(0.03094887, -0.008734403, 0.00042712069, 0.0, 0.053891554, 0.05837673, 0.06200635, 0.0, 0.09071558, -0.04202184, -0.046172567, 0.0, -0.0425916, 0.04905093, 0.020835675, 0.0));
    result += mul(g_9, float4x4(0.096628904, -0.037792254, -0.043241944, 0.0, -0.011923947, -0.025950424, -0.031381752, 0.0, -0.060941868, -0.07859433, -0.07535451, 0.0, -0.026777223, 0.08604982, 0.07829908, 0.0));
    result += mul(g_10, float4x4(-0.06435972, 0.0036599538, 0.00786578, 0.0, -0.061972067, -0.05681472, -0.06667608, 0.0, -0.106890626, 0.007406496, 0.029977169, 0.0, -0.20519382, -0.044860814, 0.0021225857, 0.0));
    result += mul(g_11, float4x4(-0.16876474, 0.012789643, 0.026692612, 0.0, 0.017817136, 0.026935097, 0.02227043, 0.0, 0.01690181, 0.07716103, 0.086527, 0.0, 0.07923805, -0.10443151, -0.10859543, 0.0));
    result += mul(g_12, float4x4(0.003730466, -0.024648283, -0.022169832, 0.0, -0.0062762927, 0.022062732, 0.032966793, 0.0, 0.016349113, 0.017197203, 0.020952817, 0.0, -0.1763789, 0.035497356, 0.053835396, 0.0));
    result += mul(g_13, float4x4(0.020886675, -0.07054202, -0.079142675, 0.0, 0.06664387, 0.044960167, 0.042230908, 0.0, -0.095019594, 0.012421141, 0.0142890485, 0.0, 0.056814816, -0.012751135, -0.014684506, 0.0));
    result += mul(g_14, float4x4(0.011765893, 0.0008920681, -0.0018258415, 0.0, -0.010473814, -0.023085753, -0.028783914, 0.0, -0.023034256, -0.0024786016, -0.0052162083, 0.0, 0.1643386, -0.06132718, -0.09289065, 0.0));
    result += mul(g_15, float4x4(0.016597198, 0.09389637, 0.10833379, 0.0, -0.043163072, -0.04714812, -0.035274632, 0.0, 0.09634976, -0.009292612, -0.022424143, 0.0, -0.08765172, 0.0051558353, 0.010900356, 0.0));
    result += mul(g_16, float4x4(0.030815786, 0.021069322, 0.01812191, 0.0, 0.084839165, -0.0080813095, -0.029270556, 0.0, -0.10456346, 0.062386703, 0.0665605, 0.0, 0.11926609, -0.1104228, -0.13291118, 0.0));
    result += mul(g_17, float4x4(-0.07159541, -0.007267032, -0.010134558, 0.0, 0.008234213, 0.045609634, 0.040295456, 0.0, 0.018416971, 0.01308482, 0.014649557, 0.0, 0.035107512, -0.02140815, -0.030279048, 0.0));
    result += mul(g_18, float4x4(0.01918586, 0.03875863, 0.03229402, 0.0, -0.07917104, 0.041135103, 0.057182517, 0.0, 0.08609541, 0.0079662455, 0.004327576, 0.0, -0.14332893, 0.03120354, 0.056732506, 0.0));
    result += mul(g_19, float4x4(0.03200192, -0.0035752193, -0.0031064528, 0.0, -0.010902813, 0.014607456, 0.019431474, 0.0, -0.016461229, -0.004938204, -0.004655488, 0.0, -0.033470232, 0.0026075812, 0.005896968, 0.0));
    result += mul(g_20, float4x4(0.037410006, 0.048742272, 0.04348088, 0.0, 0.037719514, 0.030768529, 0.03127472, 0.0, 0.056426726, 0.03066893, 0.016440205, 0.0, -0.010599352, 0.022832409, 0.023211194, 0.0));
    result += mul(g_21, float4x4(-0.005733291, 0.06365659, 0.06663611, 0.0, -0.041917093, -0.016493445, -0.020438088, 0.0, -0.0014357592, -0.0022506563, -0.0045095007, 0.0, 0.029893145, -0.009129354, -0.015173116, 0.0));
    result += mul(g_22, float4x4(0.013052085, 0.005108175, 0.0025906067, 0.0, -0.021950055, -0.036447693, -0.036141638, 0.0, -0.036296472, 0.0068928464, 0.013102313, 0.0, 0.0060471976, -0.024798103, -0.023548538, 0.0));
    result += mul(g_23, float4x4(0.0067743887, -0.06191211, -0.062355213, 0.0, 0.0016080744, -0.020445071, -0.016840393, 0.0, 0.028264903, 0.01852915, 0.015891539, 0.0, -0.023877412, -0.013271666, -0.008158679, 0.0));
    result += mul(g_24, float4x4(-0.04317466, -0.018953001, -0.020452993, 0.0, -0.009322576, -0.03022352, -0.030970376, 0.0, 0.05653658, 0.05430553, 0.046692245, 0.0, 0.05615359, 0.059338935, 0.056018773, 0.0));
    result += mul(g_25, float4x4(0.022878079, 0.03392234, 0.033057988, 0.0, -0.017554542, -0.0141542535, -0.014122613, 0.0, -0.048634093, -0.05316463, -0.047988772, 0.0, -0.058002178, -0.040221967, -0.034025013, 0.0));
    result += mul(g_26, float4x4(-0.018253656, -0.04197674, -0.040467236, 0.0, -0.04358929, -0.028309818, -0.025425073, 0.0, -0.008488672, -0.001727991, 0.00035808363, 0.0, -0.0011709273, 0.0052514165, 0.0059479307, 0.0));
    result += mul(g_27, float4x4(-0.08333935, -0.09818201, -0.09476284, 0.0, -0.033692095, -0.046259012, -0.045797516, 0.0, -0.007577072, 0.0022402718, 0.0016200038, 0.0, 0.0029786075, -0.020728534, -0.018938033, 0.0));
    result += float4(0.047567394, -0.02504617, -0.028163986, 0.0);
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
