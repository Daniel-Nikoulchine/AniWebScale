// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_UL.glsl:1620
// Pass: 024 - Anime4K-v4.0-Restore-CNN-Soft-(UL)-Conv-3x1x1x120
// Anime4K is Copyright (c) 2019-2021 bloc97, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[16];
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
Texture2D<float4> Anime4KInput15 : register(t15);
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

float4 Anime4KTransform15(float4 value)
{
    return value;
}

float2 Anime4KClampUv15(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[15].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample15(float2 uv)
{
    return Anime4KTransform15(float4(Anime4KInput15.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv15(uv), 0.0)));
}

float4 Anime4KLoadOffset15(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[15].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform15(float4(Anime4KInput15.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent15(uint2 position)
{
    return Anime4KTransform15(float4(Anime4KInput15.Load(int3(position, 0))));
}

#define MAIN_tex(position) Anime4KSample0(position)
#define MAIN_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define MAIN_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define MAIN_pos anime4k_pos
#define MAIN_size float2(Anime4KInputSizes[0].xy)
#define MAIN_pt rcp(MAIN_size)
#define conv2d_3_tf_tex(position) Anime4KSample1(position)
#define conv2d_3_tf_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_3_tf_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_3_tf_pos anime4k_pos
#define conv2d_3_tf_size float2(Anime4KInputSizes[1].xy)
#define conv2d_3_tf_pt rcp(conv2d_3_tf_size)
#define conv2d_3_tf1_tex(position) Anime4KSample2(position)
#define conv2d_3_tf1_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_3_tf1_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_3_tf1_pos anime4k_pos
#define conv2d_3_tf1_size float2(Anime4KInputSizes[2].xy)
#define conv2d_3_tf1_pt rcp(conv2d_3_tf1_size)
#define conv2d_3_tf2_tex(position) Anime4KSample3(position)
#define conv2d_3_tf2_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_3_tf2_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_3_tf2_pos anime4k_pos
#define conv2d_3_tf2_size float2(Anime4KInputSizes[3].xy)
#define conv2d_3_tf2_pt rcp(conv2d_3_tf2_size)
#define conv2d_4_tf_tex(position) Anime4KSample4(position)
#define conv2d_4_tf_texOff(offset) Anime4KLoadOffset4(anime4k_output_pixel, offset)
#define conv2d_4_tf_texCurrent Anime4KLoadCurrent4(anime4k_output_pixel)
#define conv2d_4_tf_pos anime4k_pos
#define conv2d_4_tf_size float2(Anime4KInputSizes[4].xy)
#define conv2d_4_tf_pt rcp(conv2d_4_tf_size)
#define conv2d_4_tf1_tex(position) Anime4KSample5(position)
#define conv2d_4_tf1_texOff(offset) Anime4KLoadOffset5(anime4k_output_pixel, offset)
#define conv2d_4_tf1_texCurrent Anime4KLoadCurrent5(anime4k_output_pixel)
#define conv2d_4_tf1_pos anime4k_pos
#define conv2d_4_tf1_size float2(Anime4KInputSizes[5].xy)
#define conv2d_4_tf1_pt rcp(conv2d_4_tf1_size)
#define conv2d_4_tf2_tex(position) Anime4KSample6(position)
#define conv2d_4_tf2_texOff(offset) Anime4KLoadOffset6(anime4k_output_pixel, offset)
#define conv2d_4_tf2_texCurrent Anime4KLoadCurrent6(anime4k_output_pixel)
#define conv2d_4_tf2_pos anime4k_pos
#define conv2d_4_tf2_size float2(Anime4KInputSizes[6].xy)
#define conv2d_4_tf2_pt rcp(conv2d_4_tf2_size)
#define conv2d_5_tf_tex(position) Anime4KSample7(position)
#define conv2d_5_tf_texOff(offset) Anime4KLoadOffset7(anime4k_output_pixel, offset)
#define conv2d_5_tf_texCurrent Anime4KLoadCurrent7(anime4k_output_pixel)
#define conv2d_5_tf_pos anime4k_pos
#define conv2d_5_tf_size float2(Anime4KInputSizes[7].xy)
#define conv2d_5_tf_pt rcp(conv2d_5_tf_size)
#define conv2d_5_tf1_tex(position) Anime4KSample8(position)
#define conv2d_5_tf1_texOff(offset) Anime4KLoadOffset8(anime4k_output_pixel, offset)
#define conv2d_5_tf1_texCurrent Anime4KLoadCurrent8(anime4k_output_pixel)
#define conv2d_5_tf1_pos anime4k_pos
#define conv2d_5_tf1_size float2(Anime4KInputSizes[8].xy)
#define conv2d_5_tf1_pt rcp(conv2d_5_tf1_size)
#define conv2d_5_tf2_tex(position) Anime4KSample9(position)
#define conv2d_5_tf2_texOff(offset) Anime4KLoadOffset9(anime4k_output_pixel, offset)
#define conv2d_5_tf2_texCurrent Anime4KLoadCurrent9(anime4k_output_pixel)
#define conv2d_5_tf2_pos anime4k_pos
#define conv2d_5_tf2_size float2(Anime4KInputSizes[9].xy)
#define conv2d_5_tf2_pt rcp(conv2d_5_tf2_size)
#define conv2d_6_tf_tex(position) Anime4KSample10(position)
#define conv2d_6_tf_texOff(offset) Anime4KLoadOffset10(anime4k_output_pixel, offset)
#define conv2d_6_tf_texCurrent Anime4KLoadCurrent10(anime4k_output_pixel)
#define conv2d_6_tf_pos anime4k_pos
#define conv2d_6_tf_size float2(Anime4KInputSizes[10].xy)
#define conv2d_6_tf_pt rcp(conv2d_6_tf_size)
#define conv2d_6_tf1_tex(position) Anime4KSample11(position)
#define conv2d_6_tf1_texOff(offset) Anime4KLoadOffset11(anime4k_output_pixel, offset)
#define conv2d_6_tf1_texCurrent Anime4KLoadCurrent11(anime4k_output_pixel)
#define conv2d_6_tf1_pos anime4k_pos
#define conv2d_6_tf1_size float2(Anime4KInputSizes[11].xy)
#define conv2d_6_tf1_pt rcp(conv2d_6_tf1_size)
#define conv2d_6_tf2_tex(position) Anime4KSample12(position)
#define conv2d_6_tf2_texOff(offset) Anime4KLoadOffset12(anime4k_output_pixel, offset)
#define conv2d_6_tf2_texCurrent Anime4KLoadCurrent12(anime4k_output_pixel)
#define conv2d_6_tf2_pos anime4k_pos
#define conv2d_6_tf2_size float2(Anime4KInputSizes[12].xy)
#define conv2d_6_tf2_pt rcp(conv2d_6_tf2_size)
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
#define conv2d_7_tf2_tex(position) Anime4KSample15(position)
#define conv2d_7_tf2_texOff(offset) Anime4KLoadOffset15(anime4k_output_pixel, offset)
#define conv2d_7_tf2_texCurrent Anime4KLoadCurrent15(anime4k_output_pixel)
#define conv2d_7_tf2_pos anime4k_pos
#define conv2d_7_tf2_size float2(Anime4KInputSizes[15].xy)
#define conv2d_7_tf2_pt rcp(conv2d_7_tf2_size)

#define g_0 (max((conv2d_3_tf_texCurrent), 0.0))
#define g_1 (max((conv2d_3_tf1_texCurrent), 0.0))
#define g_2 (max((conv2d_3_tf2_texCurrent), 0.0))
#define g_3 (max(-(conv2d_3_tf_texCurrent), 0.0))
#define g_4 (max(-(conv2d_3_tf1_texCurrent), 0.0))
#define g_5 (max(-(conv2d_3_tf2_texCurrent), 0.0))
#define g_6 (max((conv2d_4_tf_texCurrent), 0.0))
#define g_7 (max((conv2d_4_tf1_texCurrent), 0.0))
#define g_8 (max((conv2d_4_tf2_texCurrent), 0.0))
#define g_9 (max(-(conv2d_4_tf_texCurrent), 0.0))
#define g_10 (max(-(conv2d_4_tf1_texCurrent), 0.0))
#define g_11 (max(-(conv2d_4_tf2_texCurrent), 0.0))
#define g_12 (max((conv2d_5_tf_texCurrent), 0.0))
#define g_13 (max((conv2d_5_tf1_texCurrent), 0.0))
#define g_14 (max((conv2d_5_tf2_texCurrent), 0.0))
#define g_15 (max(-(conv2d_5_tf_texCurrent), 0.0))
#define g_16 (max(-(conv2d_5_tf1_texCurrent), 0.0))
#define g_17 (max(-(conv2d_5_tf2_texCurrent), 0.0))
#define g_18 (max((conv2d_6_tf_texCurrent), 0.0))
#define g_19 (max((conv2d_6_tf1_texCurrent), 0.0))
#define g_20 (max((conv2d_6_tf2_texCurrent), 0.0))
#define g_21 (max(-(conv2d_6_tf_texCurrent), 0.0))
#define g_22 (max(-(conv2d_6_tf1_texCurrent), 0.0))
#define g_23 (max(-(conv2d_6_tf2_texCurrent), 0.0))
#define g_24 (max((conv2d_7_tf_texCurrent), 0.0))
#define g_25 (max((conv2d_7_tf1_texCurrent), 0.0))
#define g_26 (max((conv2d_7_tf2_texCurrent), 0.0))
#define g_27 (max(-(conv2d_7_tf_texCurrent), 0.0))
#define g_28 (max(-(conv2d_7_tf1_texCurrent), 0.0))
#define g_29 (max(-(conv2d_7_tf2_texCurrent), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(g_0, float4x4(0.053345524, 0.066197485, 0.07259881, 0.0, 0.05303127, 0.06742834, 0.07375377, 0.0, 0.094053976, -7.700613e-05, -0.02473139, 0.0, 0.005308593, 0.03030767, 0.039729137, 0.0));
    result += mul(g_1, float4x4(-0.108758785, 0.037586506, 0.065435104, 0.0, 0.027483977, -0.05654698, -0.076396726, 0.0, 0.105040714, 0.05024414, 0.021126145, 0.0, -0.0674868, -0.0055504893, 0.02190656, 0.0));
    result += mul(g_2, float4x4(-0.053890713, 0.0071396744, 0.016984116, 0.0, -0.045092918, 0.025137635, 0.041979324, 0.0, -0.03408237, 0.0019260172, 0.005701325, 0.0, -0.02040999, -0.01315308, -0.00639404, 0.0));
    result += mul(g_3, float4x4(-0.073155664, -0.06887698, -0.072435565, 0.0, -0.08694837, -0.05531286, -0.055365037, 0.0, -0.06690585, -0.00129934, 0.013128711, 0.0, -0.045931015, 0.017999481, 0.021670034, 0.0));
    result += mul(g_4, float4x4(0.14758188, -0.052864034, -0.06617946, 0.0, -0.025215192, 0.005785653, 0.02022865, 0.0, -0.07359226, -0.034944568, -0.01911832, 0.0, -0.059109453, 0.0018033485, -0.022261323, 0.0));
    result += mul(g_5, float4x4(0.079963796, 0.018210623, -0.0025736517, 0.0, 0.06693135, -0.038985185, -0.04726813, 0.0, -0.03559407, -0.0083629545, -0.005753532, 0.0, 0.043954816, -0.022223696, -0.039470144, 0.0));
    result += mul(g_6, float4x4(0.060458526, -0.0033674864, -0.006985535, 0.0, -0.013925546, 0.051077038, 0.053856038, 0.0, -0.033647064, 0.043235198, 0.05311577, 0.0, 0.0391791, -0.044376004, -0.054064214, 0.0));
    result += mul(g_7, float4x4(0.0069859014, -0.0050665336, -0.010343517, 0.0, -0.027551029, 0.049856182, 0.058316905, 0.0, 0.0121670095, -0.013107907, -0.0151846, 0.0, 0.007648614, -0.0051277154, -0.0053846613, 0.0));
    result += mul(g_8, float4x4(0.06848036, 0.026777437, 0.024801696, 0.0, -0.08711668, 0.049429595, 0.067019165, 0.0, -0.09006778, -0.042166695, -0.02230536, 0.0, -0.048024856, -0.020088708, -0.009932858, 0.0));
    result += mul(g_9, float4x4(-0.05171447, 0.0029948682, 0.014913949, 0.0, 0.02287364, -0.042476606, -0.052956346, 0.0, 0.02762833, -0.044026252, -0.056759696, 0.0, -0.0519502, 0.047626793, 0.06422155, 0.0));
    result += mul(g_10, float4x4(-0.0031128856, 0.013134638, 0.021534251, 0.0, 0.049189907, -0.039677586, -0.057255603, 0.0, -0.009908353, -0.0013683038, 0.0028079485, 0.0, 0.0002268831, 0.012356764, 0.009817244, 0.0));
    result += mul(g_11, float4x4(-0.04058634, -0.01822148, -0.014306331, 0.0, 0.107378654, -0.04138371, -0.058573496, 0.0, 0.03701269, -0.009420217, -0.02310707, 0.0, 0.039931968, 0.001769326, -0.007929419, 0.0));
    result += mul(g_12, float4x4(0.027129134, 0.01044246, 0.008198051, 0.0, -0.019978391, 0.014817045, 0.014294805, 0.0, -0.009071333, -0.018233696, -0.020756468, 0.0, -0.016967475, -0.010472854, -0.0066578956, 0.0));
    result += mul(g_13, float4x4(0.012473992, -0.019771596, -0.02515739, 0.0, -0.008238026, 0.026189122, 0.034326296, 0.0, 0.01735337, -0.021417223, -0.027291182, 0.0, 0.01815212, -0.012736875, -0.021111157, 0.0));
    result += mul(g_14, float4x4(0.022218483, -0.023485998, -0.03540812, 0.0, 0.016531168, -0.0033816632, -0.010179393, 0.0, -0.03181473, -0.0072774286, 0.0014077872, 0.0, -0.0025735856, -0.015998563, -0.016743565, 0.0));
    result += mul(g_15, float4x4(-0.01740865, 2.3718083e-05, 0.0032518203, 0.0, 0.009272118, -0.01676428, -0.019791994, 0.0, 0.013665012, 0.02245221, 0.022923533, 0.0, 0.020898446, 0.012111701, 0.009756352, 0.0));
    result += mul(g_16, float4x4(-0.0043926076, 0.019400991, 0.022581568, 0.0, 0.003538965, -0.031301565, -0.0345112, 0.0, -0.02405352, 0.006159623, 0.016130725, 0.0, -0.0097925, 0.01677507, 0.027652735, 0.0));
    result += mul(g_17, float4x4(-0.03267886, 0.014923966, 0.027258545, 0.0, -0.033668566, -0.010421195, -0.0026646685, 0.0, 0.015094835, -0.0023233194, -0.015871005, 0.0, -0.01258443, 0.00507582, 0.0053544766, 0.0));
    result += mul(g_18, float4x4(0.012708346, 0.014336439, 0.012533707, 0.0, -0.0019346073, -0.0070978077, -0.009478742, 0.0, -0.011659758, -0.009855903, -0.008657096, 0.0, 0.0098037105, 0.010785594, 0.008409619, 0.0));
    result += mul(g_19, float4x4(0.0056228717, 0.013483413, 0.008108323, 0.0, -0.0013697809, 0.0026797573, 0.0037666177, 0.0, 0.0130932415, 0.019868238, 0.01968549, 0.0, 0.011160769, 0.012374028, 0.012855804, 0.0));
    result += mul(g_20, float4x4(0.0011662204, 0.00025071716, 0.0022244148, 0.0, -0.017808594, -0.013589306, -0.01396329, 0.0, -0.008117086, -0.0068251803, -0.004963602, 0.0, -0.0069141523, -0.009125296, -0.008327947, 0.0));
    result += mul(g_21, float4x4(-0.027597412, -0.02631107, -0.022816146, 0.0, 0.009350171, 0.013661565, 0.015324706, 0.0, 0.032538984, 0.02918167, 0.026186563, 0.0, 0.018760988, 0.024502547, 0.023201061, 0.0));
    result += mul(g_22, float4x4(0.013216693, 0.00991115, 0.01178417, 0.0, 0.0076343333, 0.004714098, 0.0074490295, 0.0, -0.0064893183, -0.014818341, -0.01199717, 0.0, -0.008334491, -0.009955103, -0.011240684, 0.0));
    result += mul(g_23, float4x4(-0.013846397, -0.012687341, -0.015767701, 0.0, -0.0019117722, -0.0072347773, -0.0074835457, 0.0, 0.013531867, 0.014263165, 0.012797156, 0.0, 0.008260445, 0.0070536416, 0.0065693366, 0.0));
    result += mul(g_24, float4x4(0.0017003485, 0.0021871394, 0.0003407296, 0.0, 0.0054420815, 0.00801073, 0.008788295, 0.0, -0.012685104, -0.0150940735, -0.017530257, 0.0, -0.030698642, -0.030817484, -0.028548386, 0.0));
    result += mul(g_25, float4x4(-0.008882145, -0.008943836, -0.007986094, 0.0, -0.010494911, -0.011511255, -0.00892924, 0.0, 0.014072905, 0.014985031, 0.011853883, 0.0, -0.015823284, -0.017817877, -0.01684662, 0.0));
    result += mul(g_26, float4x4(0.012270136, 0.011127063, 0.010729208, 0.0, 0.00027298275, 0.001011805, 0.001318525, 0.0, 0.0029811305, 0.0029161042, 0.0060088155, 0.0, 0.00021241597, -0.0013439909, 0.0013205905, 0.0));
    result += mul(g_27, float4x4(-0.03467924, -0.035764243, -0.03348244, 0.0, 0.023858175, 0.02580526, 0.026217844, 0.0, -0.016814101, -0.016412167, -0.012021982, 0.0, -0.0007905926, -0.0019904284, -0.0015143935, 0.0));
    result += mul(g_28, float4x4(0.046779703, 0.04961137, 0.046104047, 0.0, -0.023665644, -0.022809561, -0.02236428, 0.0, -0.054706786, -0.056090504, -0.052543454, 0.0, -0.015520943, -0.01587306, -0.0142722875, 0.0));
    result += mul(g_29, float4x4(0.020273875, 0.020399818, 0.021745082, 0.0, 0.037485637, 0.039574977, 0.03556703, 0.0, 0.036673885, 0.04102765, 0.033708427, 0.0, 0.024422405, 0.027724478, 0.0252598, 0.0));
    result += float4(-0.0036656514, 0.006677459, 0.007698717, 0.0);
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
