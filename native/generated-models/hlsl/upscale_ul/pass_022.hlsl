// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale/Anime4K_Upscale_CNN_x2_UL.glsl:1508
// Pass: 022 - Anime4K-v3.2-Upscale-CNN-x2-(UL)-Conv-4x1x1x120
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

#define conv2d_2_tf_tex(position) Anime4KSample0(position)
#define conv2d_2_tf_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_2_tf_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_2_tf_pos anime4k_pos
#define conv2d_2_tf_size float2(Anime4KInputSizes[0].xy)
#define conv2d_2_tf_pt rcp(conv2d_2_tf_size)
#define conv2d_2_tf1_tex(position) Anime4KSample1(position)
#define conv2d_2_tf1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_2_tf1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_2_tf1_pos anime4k_pos
#define conv2d_2_tf1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_2_tf1_pt rcp(conv2d_2_tf1_size)
#define conv2d_2_tf2_tex(position) Anime4KSample2(position)
#define conv2d_2_tf2_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_2_tf2_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_2_tf2_pos anime4k_pos
#define conv2d_2_tf2_size float2(Anime4KInputSizes[2].xy)
#define conv2d_2_tf2_pt rcp(conv2d_2_tf2_size)
#define conv2d_3_tf_tex(position) Anime4KSample3(position)
#define conv2d_3_tf_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_3_tf_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_3_tf_pos anime4k_pos
#define conv2d_3_tf_size float2(Anime4KInputSizes[3].xy)
#define conv2d_3_tf_pt rcp(conv2d_3_tf_size)
#define conv2d_3_tf1_tex(position) Anime4KSample4(position)
#define conv2d_3_tf1_texOff(offset) Anime4KLoadOffset4(anime4k_output_pixel, offset)
#define conv2d_3_tf1_texCurrent Anime4KLoadCurrent4(anime4k_output_pixel)
#define conv2d_3_tf1_pos anime4k_pos
#define conv2d_3_tf1_size float2(Anime4KInputSizes[4].xy)
#define conv2d_3_tf1_pt rcp(conv2d_3_tf1_size)
#define conv2d_3_tf2_tex(position) Anime4KSample5(position)
#define conv2d_3_tf2_texOff(offset) Anime4KLoadOffset5(anime4k_output_pixel, offset)
#define conv2d_3_tf2_texCurrent Anime4KLoadCurrent5(anime4k_output_pixel)
#define conv2d_3_tf2_pos anime4k_pos
#define conv2d_3_tf2_size float2(Anime4KInputSizes[5].xy)
#define conv2d_3_tf2_pt rcp(conv2d_3_tf2_size)
#define conv2d_4_tf_tex(position) Anime4KSample6(position)
#define conv2d_4_tf_texOff(offset) Anime4KLoadOffset6(anime4k_output_pixel, offset)
#define conv2d_4_tf_texCurrent Anime4KLoadCurrent6(anime4k_output_pixel)
#define conv2d_4_tf_pos anime4k_pos
#define conv2d_4_tf_size float2(Anime4KInputSizes[6].xy)
#define conv2d_4_tf_pt rcp(conv2d_4_tf_size)
#define conv2d_4_tf1_tex(position) Anime4KSample7(position)
#define conv2d_4_tf1_texOff(offset) Anime4KLoadOffset7(anime4k_output_pixel, offset)
#define conv2d_4_tf1_texCurrent Anime4KLoadCurrent7(anime4k_output_pixel)
#define conv2d_4_tf1_pos anime4k_pos
#define conv2d_4_tf1_size float2(Anime4KInputSizes[7].xy)
#define conv2d_4_tf1_pt rcp(conv2d_4_tf1_size)
#define conv2d_4_tf2_tex(position) Anime4KSample8(position)
#define conv2d_4_tf2_texOff(offset) Anime4KLoadOffset8(anime4k_output_pixel, offset)
#define conv2d_4_tf2_texCurrent Anime4KLoadCurrent8(anime4k_output_pixel)
#define conv2d_4_tf2_pos anime4k_pos
#define conv2d_4_tf2_size float2(Anime4KInputSizes[8].xy)
#define conv2d_4_tf2_pt rcp(conv2d_4_tf2_size)
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
#define conv2d_5_tf2_tex(position) Anime4KSample11(position)
#define conv2d_5_tf2_texOff(offset) Anime4KLoadOffset11(anime4k_output_pixel, offset)
#define conv2d_5_tf2_texCurrent Anime4KLoadCurrent11(anime4k_output_pixel)
#define conv2d_5_tf2_pos anime4k_pos
#define conv2d_5_tf2_size float2(Anime4KInputSizes[11].xy)
#define conv2d_5_tf2_pt rcp(conv2d_5_tf2_size)
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
#define conv2d_6_tf2_tex(position) Anime4KSample14(position)
#define conv2d_6_tf2_texOff(offset) Anime4KLoadOffset14(anime4k_output_pixel, offset)
#define conv2d_6_tf2_texCurrent Anime4KLoadCurrent14(anime4k_output_pixel)
#define conv2d_6_tf2_pos anime4k_pos
#define conv2d_6_tf2_size float2(Anime4KInputSizes[14].xy)
#define conv2d_6_tf2_pt rcp(conv2d_6_tf2_size)

#define g_0 (max((conv2d_2_tf_texCurrent), 0.0))
#define g_1 (max((conv2d_2_tf1_texCurrent), 0.0))
#define g_2 (max((conv2d_2_tf2_texCurrent), 0.0))
#define g_3 (max(-(conv2d_2_tf_texCurrent), 0.0))
#define g_4 (max(-(conv2d_2_tf1_texCurrent), 0.0))
#define g_5 (max(-(conv2d_2_tf2_texCurrent), 0.0))
#define g_6 (max((conv2d_3_tf_texCurrent), 0.0))
#define g_7 (max((conv2d_3_tf1_texCurrent), 0.0))
#define g_8 (max((conv2d_3_tf2_texCurrent), 0.0))
#define g_9 (max(-(conv2d_3_tf_texCurrent), 0.0))
#define g_10 (max(-(conv2d_3_tf1_texCurrent), 0.0))
#define g_11 (max(-(conv2d_3_tf2_texCurrent), 0.0))
#define g_12 (max((conv2d_4_tf_texCurrent), 0.0))
#define g_13 (max((conv2d_4_tf1_texCurrent), 0.0))
#define g_14 (max((conv2d_4_tf2_texCurrent), 0.0))
#define g_15 (max(-(conv2d_4_tf_texCurrent), 0.0))
#define g_16 (max(-(conv2d_4_tf1_texCurrent), 0.0))
#define g_17 (max(-(conv2d_4_tf2_texCurrent), 0.0))
#define g_18 (max((conv2d_5_tf_texCurrent), 0.0))
#define g_19 (max((conv2d_5_tf1_texCurrent), 0.0))
#define g_20 (max((conv2d_5_tf2_texCurrent), 0.0))
#define g_21 (max(-(conv2d_5_tf_texCurrent), 0.0))
#define g_22 (max(-(conv2d_5_tf1_texCurrent), 0.0))
#define g_23 (max(-(conv2d_5_tf2_texCurrent), 0.0))
#define g_24 (max((conv2d_6_tf_texCurrent), 0.0))
#define g_25 (max((conv2d_6_tf1_texCurrent), 0.0))
#define g_26 (max((conv2d_6_tf2_texCurrent), 0.0))
#define g_27 (max(-(conv2d_6_tf_texCurrent), 0.0))
#define g_28 (max(-(conv2d_6_tf1_texCurrent), 0.0))
#define g_29 (max(-(conv2d_6_tf2_texCurrent), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(g_0, float4x4(-0.016576298, -0.013039568, -0.07158028, -0.056509558, -0.06965122, -0.1272158, -0.07288651, -0.10423224, 0.048223313, 0.03172697, 0.014178331, 0.002855858, 0.004538786, 0.034928907, 0.03173054, 0.03412037));
    result += mul(g_1, float4x4(0.09168274, 0.056355372, 0.023804985, 0.009515965, 0.024203284, 0.01641063, 0.016683895, -0.012702561, -0.038824845, -0.037673414, -0.010391583, -0.014636746, 0.03192526, -0.02340906, 0.027524544, -0.015568387));
    result += mul(g_2, float4x4(-0.0966996, -0.041418746, -0.055650715, 0.002117608, 0.00031688716, -0.008733063, -0.024573568, -0.03425321, -0.036262326, 0.04404278, -0.014729649, 0.05618371, 0.008530102, -0.015607405, 0.015309457, -0.013621667));
    result += mul(g_3, float4x4(0.0361472, 0.025806008, 0.0583716, 0.06861344, 0.06315231, 0.10136267, 0.050169814, 0.07334672, -0.029601635, -0.06431154, -0.030672554, -0.042512666, -0.051434014, -0.039382752, -0.050772913, -0.08629934));
    result += mul(g_4, float4x4(-0.02201249, -0.03920109, -0.030633967, -0.0530296, -0.016168922, 0.0019067918, -0.014961821, 0.017761061, 0.012465623, 0.01857369, 0.009440995, -0.014336409, 0.0056113736, 0.012547043, 0.019320931, 0.025894852));
    result += mul(g_5, float4x4(0.079413086, 0.055332463, 0.023716403, 0.005429431, 0.0043804864, 0.026764238, 0.011610661, 0.03245363, -0.032408644, -0.056873523, -0.0019144824, -0.026196169, -0.03347332, -0.0174185, -0.00020654689, 0.023554688));
    result += mul(g_6, float4x4(-0.055310458, -0.079070315, 0.0066684894, -0.034588877, -0.07334732, -0.000985991, -0.011984627, 0.08308032, 0.011794159, -0.0144758625, 0.03586815, 0.009038553, -0.0016798767, 0.045218308, 0.016524237, 0.045677744));
    result += mul(g_7, float4x4(0.0083010085, 0.028407311, 0.06600332, 0.07460616, 0.071611166, 0.09643883, 0.034676284, 0.05824412, -0.07973774, -0.030707551, -0.03709346, 0.012161441, -0.02977386, -0.018077906, 0.0017052453, 0.012292145));
    result += mul(g_8, float4x4(0.01893072, 0.032129273, 0.010857875, 0.037224095, -0.01413747, -0.047471486, 0.05192984, 0.03202811, -0.05082615, -0.027038824, -0.008331923, 0.03062506, -0.01725524, 0.039917417, -0.010607958, 0.04724454));
    result += mul(g_9, float4x4(0.03497211, 0.07911703, 0.016746478, 0.057458322, 0.06088827, -0.0053583174, -0.013933355, -0.10673472, -0.005456845, 0.020259444, -0.03139623, -0.008973998, -0.054345034, -0.035464175, -0.025964592, -0.0021018258));
    result += mul(g_10, float4x4(-0.047960743, 0.021779433, -0.11492737, -0.033511925, -0.067273304, -0.07730279, -0.04037016, -0.045080706, 0.09207083, 0.009399112, 0.03178142, -0.011313022, 0.021366931, 0.0051248465, -0.008097426, -0.018301165));
    result += mul(g_11, float4x4(0.014282785, -0.01572224, -0.027472818, -0.050844453, 0.0054380163, 0.052591007, -0.04270195, -0.02309884, 0.05152891, 0.03629938, -0.004667278, -0.024925238, 0.010567401, -0.07481508, 0.037315298, -0.04241005));
    result += mul(g_12, float4x4(-0.0013873621, 0.028364213, -0.031026626, 0.015620681, 0.004142558, -0.004863661, -0.013809934, -0.021330781, -0.0016021075, -0.002762517, -0.024034528, -0.03442779, -0.0013054899, -0.0042632925, 0.020974873, -0.0022553254));
    result += mul(g_13, float4x4(0.018562179, 0.034197688, 0.015277717, -0.01111744, -0.0032272537, -0.013426753, 0.017978273, -0.0015077988, -0.0051653306, 0.012690824, 0.001157489, 0.021362923, -0.01262595, 0.0054670637, -0.03031384, 0.012800636));
    result += mul(g_14, float4x4(0.012069964, -0.016048005, 0.01373877, -0.013298124, 0.03194061, -0.013332437, 0.016943898, -0.0058277305, -0.009428097, -0.023061408, -0.013659186, 0.015731167, -0.001986914, -0.019521309, 0.014714155, -0.00522106));
    result += mul(g_15, float4x4(0.0007342483, -0.026249036, 0.030117435, -0.015873922, -0.008929299, -0.0023522351, 0.0164302, 0.023790896, -0.03889036, -0.024644645, 0.006634364, 0.046513416, -0.013473101, -0.0140229, 0.0019859916, 0.011869367));
    result += mul(g_16, float4x4(0.02573362, 0.02375676, 0.00059617084, -0.016921667, -0.0671785, 0.008825013, -0.0013130646, 0.07261784, 0.010327604, 0.019814448, -0.008936156, 0.013669365, 0.020260049, -0.013921513, 0.018746642, -0.02843792));
    result += mul(g_17, float4x4(-0.023912461, -0.02845122, 0.017157353, -0.0075884, 0.00036027908, 0.012657872, 0.0061078435, 0.014107368, 0.032003447, 0.020891502, -0.0067286897, -0.030822601, -0.06574523, -0.028198881, 0.032242246, 0.061325297));
    result += mul(g_18, float4x4(0.0074854135, 0.085437536, -0.06426021, -0.011461227, -0.023055596, -0.025802588, 0.005154878, 0.0056105317, 0.0058093905, -0.1922738, 0.14643134, -0.035682995, -0.026076004, -0.053763065, 0.04269994, 0.05141156));
    result += mul(g_19, float4x4(-0.011764035, -0.011518187, -0.010223651, 0.015880484, 0.023317069, -0.05618372, 0.0059863995, -0.059199195, 0.04408538, 0.084830545, -0.042056326, -0.057687927, 0.0037303802, -0.082143255, -0.0018375175, -0.071053974));
    result += mul(g_20, float4x4(0.0044008377, 0.03906328, 0.010832349, 0.046560295, -0.011535675, -0.004254791, -0.011572009, -0.008665021, 0.021482797, 0.0338495, 0.019407712, 0.010986841, -0.05098764, 0.009778762, -0.05300968, 0.021800417));
    result += mul(g_21, float4x4(-0.021229895, 0.003305197, 0.0024396733, 0.02508984, 0.012702334, 0.033208802, -0.03008867, 0.0046940153, -0.030033346, -0.03792949, -0.05176272, -0.022788247, -0.012390274, -0.0135713285, -0.021557398, -0.06371822));
    result += mul(g_22, float4x4(-0.08850463, 0.0793453, 0.020550407, -0.05461798, -0.009402199, -0.027972376, -0.005156784, 0.02965216, 0.017268548, 0.04429356, 0.009809255, 0.031682562, 0.031172305, 0.03379402, 0.04395453, 0.062268186));
    result += mul(g_23, float4x4(0.01247631, -0.100407876, 0.042796645, -0.06502109, 0.032900713, 0.13428093, -0.033733122, 0.016222714, -0.0178732, -0.002501202, 0.0035485916, -0.015802957, -0.012150594, -0.0022097295, -0.023347225, -0.038795106));
    result += mul(g_24, float4x4(0.05938152, 0.059704512, 0.030237982, -0.04353414, 0.055702258, -0.0029182534, -0.09416582, 0.08440017, 0.008828504, -0.03065552, 0.0646233, 0.03629834, -0.04788823, 0.071730554, -0.084519096, 0.05947715));
    result += mul(g_25, float4x4(-0.109025195, 0.08866299, -0.047770992, 0.08894294, 0.014965939, 0.059702646, 0.032068793, -0.053778123, 0.019529643, 0.008203253, 0.014628202, -0.017464165, 0.0060448833, 0.027196955, -0.018907491, -0.0026503608));
    result += mul(g_26, float4x4(0.081304245, 0.06199502, -0.045204166, -0.08596196, 0.028582547, 0.011568329, 0.024607504, 0.007910688, 0.035362624, -0.08241612, -0.06848065, -0.026512494, -0.04969066, -0.065509185, 0.050000466, 0.05400427));
    result += mul(g_27, float4x4(-0.015837632, -0.087357126, 0.015269297, 0.00058823347, -0.01621553, -0.020170743, 0.049107697, -0.043301217, -0.025253763, 0.021026319, -0.047297694, -0.06751796, -0.020940255, -0.019703854, 0.020391362, -0.0049682967));
    result += mul(g_28, float4x4(0.042480465, -0.010125742, -0.016281988, -0.023186147, -0.040653005, 0.022371864, -0.028837234, 0.009938319, 0.0576169, -0.09105783, 0.06033278, -0.057518024, -0.08265035, -0.094854854, 0.10116602, 0.06394465));
    result += mul(g_29, float4x4(-0.0027242866, 0.007224464, -0.026375424, 0.0052841473, -0.09330453, 0.010634226, 0.024063759, -0.005130613, 0.0070950384, 0.048039638, 0.029983977, 0.042704105, -0.018214077, -0.020184115, -0.0073092347, 0.01891303));
    result += float4(0.026287671, 0.015689341, 0.021467328, 0.0052872337);
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
