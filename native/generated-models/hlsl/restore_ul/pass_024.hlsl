// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_UL.glsl:1620
// Pass: 024 - Anime4K-v4.0-Restore-CNN-(UL)-Conv-3x1x1x120
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
    float4 result = mul(g_0, float4x4(0.068483055, 0.036389243, 0.04961808, 0.0, 0.05059915, 0.033048775, 0.029426659, 0.0, 0.07465462, -0.012659731, -0.024048671, 0.0, 0.02224484, 0.012289658, 0.008910066, 0.0));
    result += mul(g_1, float4x4(-0.10449372, 0.019832065, 0.035194747, 0.0, 0.039656557, -0.028246421, -0.032626413, 0.0, 0.10093569, 0.021039873, -0.0120673925, 0.0, -0.047074273, -0.041248, -0.019464392, 0.0));
    result += mul(g_2, float4x4(-0.05256942, 0.0127243735, 0.012813261, 0.0, -0.03551604, 0.040801138, 0.04893271, 0.0, -0.0016839011, -0.018044796, -0.027161835, 0.0, -0.060873054, 0.012360936, 0.020700796, 0.0));
    result += mul(g_3, float4x4(-0.116182, -0.04271438, -0.046686683, 0.0, -0.09575506, -0.030078743, -0.024359861, 0.0, -0.04794246, 0.0044337297, 0.013972317, 0.0, -0.023228236, 0.015726948, 0.0070847897, 0.0));
    result += mul(g_4, float4x4(0.13986528, -0.016787121, -0.015848925, 0.0, -0.04900687, -0.027417973, -0.027077334, 0.0, -0.047319725, -0.021533312, -0.018427303, 0.0, -0.06136185, -0.0051562944, -0.032072, 0.0));
    result += mul(g_5, float4x4(0.070715815, 0.012814227, -0.0003389576, 0.0, 0.012182037, -0.014952754, -0.019349998, 0.0, -0.03254603, 0.012881403, 0.016392775, 0.0, 0.059158217, 0.0055793705, -0.003696545, 0.0));
    result += mul(g_6, float4x4(0.022627862, -0.020713277, -0.009454221, 0.0, -0.04352193, 0.058409747, 0.07186154, 0.0, -0.009326966, 0.034919802, 0.04204233, 0.0, 0.025182368, -0.039986387, -0.04990386, 0.0));
    result += mul(g_7, float4x4(0.0116241425, -0.039915055, -0.050241623, 0.0, -0.0076204035, 0.050215762, 0.059038218, 0.0, -0.006659752, -0.0054298495, -0.003807067, 0.0, 0.011085346, -0.009443587, -0.009128077, 0.0));
    result += mul(g_8, float4x4(0.0453952, 0.004603456, 0.006256434, 0.0, -0.104142666, 0.05726496, 0.069169044, 0.0, -0.10102446, -0.034291938, -0.013720296, 0.0, -0.035107866, -0.008388971, -0.0068969135, 0.0));
    result += mul(g_9, float4x4(-0.038070124, -0.015017457, -0.015852718, 0.0, 0.0607464, -0.052079927, -0.07268223, 0.0, 0.008773512, -0.026051786, -0.027285712, 0.0, -0.022916751, 0.048140153, 0.064897746, 0.0));
    result += mul(g_10, float4x4(-0.01670857, 0.012646949, 0.03353705, 0.0, 0.038032394, -0.044542246, -0.06310885, 0.0, 0.002600519, -0.00824961, -0.008912322, 0.0, 0.023435717, 0.021788329, 0.008603494, 0.0));
    result += mul(g_11, float4x4(-0.02889454, -0.0058613745, -0.010699256, 0.0, 0.12959917, -0.046572708, -0.06832117, 0.0, 0.028117642, 0.020422146, 0.00869695, 0.0, 0.035915125, 0.009355984, 0.005175107, 0.0));
    result += mul(g_12, float4x4(0.037913825, -0.0099191405, -0.018130798, 0.0, -0.0065440857, 0.004536478, -0.0019739012, 0.0, -0.014918686, -0.00011652434, 0.0007071924, 0.0, -0.0033633227, -0.018028691, -0.014883887, 0.0));
    result += mul(g_13, float4x4(-0.021300001, -0.039009467, -0.043097164, 0.0, -0.008222791, 0.057612088, 0.063239105, 0.0, 0.023676023, -0.0119777955, -0.020785704, 0.0, 0.03422571, -0.009187399, -0.016286165, 0.0));
    result += mul(g_14, float4x4(0.031610258, -0.022373654, -0.04004249, 0.0, 0.015456217, -0.014708875, -0.017118618, 0.0, -0.0235428, 0.0103508085, 0.020143243, 0.0, 0.0044788374, -0.017377898, -0.023227183, 0.0));
    result += mul(g_15, float4x4(-0.036366682, 0.007874863, 0.016618004, 0.0, 0.0022973057, -0.010600425, -0.012978575, 0.0, 0.0070587453, 0.005480104, 0.0052379463, 0.0, -0.02330911, -0.002091681, -0.0004570695, 0.0));
    result += mul(g_16, float4x4(0.0011265673, 0.017461559, 0.01678395, 0.0, 0.019458788, -0.032603145, -0.042017594, 0.0, -0.026735391, 0.007520235, 0.01661426, 0.0, -0.023014631, 0.027602635, 0.040214695, 0.0));
    result += mul(g_17, float4x4(-0.05236764, 0.007274719, 0.023289332, 0.0, -0.033428065, 0.0054935357, 0.014490033, 0.0, 0.016193395, -0.012767524, -0.022695007, 0.0, -0.01161452, 0.015592775, 0.017280621, 0.0));
    result += mul(g_18, float4x4(0.0075503755, 0.014264192, 0.014350495, 0.0, 0.013990636, -0.0011566521, -0.005510977, 0.0, -0.021975616, -0.013216436, -0.012400287, 0.0, 0.018202957, 0.010433842, 0.007529786, 0.0));
    result += mul(g_19, float4x4(0.012649671, 0.016378459, 0.009756208, 0.0, 0.0023225206, -0.0038671023, -0.005242471, 0.0, 0.023699954, 0.015248626, 0.011651197, 0.0, 0.014677953, 0.014319745, 0.012088228, 0.0));
    result += mul(g_20, float4x4(-0.0030005479, 0.0052323043, 0.007744717, 0.0, -0.0077438625, -0.00072459516, -0.001971826, 0.0, -0.01263717, -0.009226968, -0.005661945, 0.0, 0.0046659256, 0.0014185858, 0.0038442858, 0.0));
    result += mul(g_21, float4x4(-0.0053241113, -0.010728358, -0.013345879, 0.0, -0.000893072, 0.015531841, 0.015812417, 0.0, 0.021348871, 0.015751695, 0.016067913, 0.0, 0.014817982, 0.03233685, 0.031598262, 0.0));
    result += mul(g_22, float4x4(0.0038391522, 0.0027406036, 0.0063517806, 0.0, 0.0021543978, 0.0065204683, 0.009420363, 0.0, -0.022383714, -0.012619449, -0.008763167, 0.0, -0.009436604, -0.012201518, -0.0103548, 0.0));
    result += mul(g_23, float4x4(-0.005432008, -0.013701671, -0.021388102, 0.0, -0.001045599, -0.0032160715, -0.0036216215, 0.0, 0.031028647, 0.022415614, 0.01880324, 0.0, -0.004328173, -0.004780637, -0.005459752, 0.0));
    result += mul(g_24, float4x4(-0.007300146, -0.0076159053, -0.0080059795, 0.0, 0.005996225, 0.0057377047, 0.0059788194, 0.0, -0.021563234, -0.020394823, -0.020401813, 0.0, -0.030919729, -0.03150251, -0.029059272, 0.0));
    result += mul(g_25, float4x4(-0.002826552, -0.0042917025, -0.0025527687, 0.0, -0.0074001094, -0.006878869, -0.0062073106, 0.0, 0.010867636, 0.010852139, 0.008577537, 0.0, -0.01606024, -0.0143771265, -0.013291837, 0.0));
    result += mul(g_26, float4x4(0.012113326, 0.014259359, 0.011284172, 0.0, -3.851684e-05, -0.003696042, -0.0020337042, 0.0, 0.003427011, 0.006911378, 0.008471347, 0.0, 0.0063997298, 0.004651406, 0.0075980425, 0.0));
    result += mul(g_27, float4x4(-0.026621016, -0.027831081, -0.025364956, 0.0, 0.022336917, 0.023742557, 0.023516335, 0.0, -0.01619396, -0.01820708, -0.015288538, 0.0, 0.0045815264, 0.0022230193, 0.0017512285, 0.0));
    result += mul(g_28, float4x4(0.043799683, 0.046862658, 0.041910093, 0.0, -0.027854608, -0.02948632, -0.02927831, 0.0, -0.051899213, -0.04971418, -0.04712937, 0.0, -0.017539004, -0.0245854, -0.023040624, 0.0));
    result += mul(g_29, float4x4(0.022317344, 0.021462968, 0.02187171, 0.0, 0.0530127, 0.054741293, 0.052202478, 0.0, 0.029963326, 0.0298772, 0.025601966, 0.0, 0.027699472, 0.031187871, 0.02950236, 0.0));
    result += float4(-0.0071146404, 0.005606682, 0.010180816, 0.0);
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
