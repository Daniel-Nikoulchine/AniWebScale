// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale/Anime4K_Upscale_CNN_x2_UL.glsl:1422
// Pass: 021 - Anime4K-v3.2-Upscale-CNN-x2-(UL)-Conv-4x1x1x120
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
    float4 result = mul(g_0, float4x4(-0.01801902, 0.016983684, 0.14704974, 0.13775583, -0.06568407, 0.031903602, -0.057818945, 0.03639395, -0.16158727, -0.11652214, -0.0512031, -0.017740106, 0.0073386175, -0.12396601, -0.08410588, -0.13822778));
    result += mul(g_1, float4x4(-0.14072196, 0.013641312, -0.110022426, 0.022624938, -0.053968057, -0.07968724, 0.036026128, 0.034548678, -0.006345876, -0.04177406, -0.10516601, -0.14248538, -0.10635475, 0.032888547, -0.07574279, 0.037366178));
    result += mul(g_2, float4x4(0.20902354, -0.03131852, 0.053658944, -0.13953559, -0.0022027926, 0.022661211, 0.02766268, 0.051950134, 0.022593375, -0.16854303, -0.00068382383, -0.15171093, -0.0011307014, 0.03237067, 0.0022356252, 0.05513321));
    result += mul(g_3, float4x4(0.057087313, 0.030007327, -0.04517254, -0.10142689, 0.049131192, -0.009568129, 0.07815266, 0.07463051, 0.061763447, 0.15247895, 0.06213266, 0.08260832, 0.08928647, 0.08173359, 0.078985415, 0.20306781));
    result += mul(g_4, float4x4(0.024888368, 0.050323978, 0.019135669, 0.042805452, 0.021970041, 0.06761805, -0.021047724, -0.029622229, -0.024018591, -0.013619991, 0.050196014, 0.094873905, 6.3763815e-05, 0.022800315, -0.038917273, -0.023665745));
    result += mul(g_5, float4x4(-0.10751045, -0.08052679, 0.0021425171, 0.018060567, 0.0002820803, -0.042460952, -0.0037310636, -0.048854582, 0.07688915, 0.1803434, -0.021755088, 0.076342724, 0.006899015, 0.010482747, -0.04608032, -0.07149793));
    result += mul(g_6, float4x4(0.017074876, 0.080092184, -0.096824504, -0.030697478, 0.19260724, 0.031606834, -0.001376051, -0.19222017, -0.029233975, 0.07513273, -0.061539974, 0.004413319, -0.011706104, 0.037078228, 0.0053027975, 0.079575956));
    result += mul(g_7, float4x4(-0.08378676, 0.1326312, -0.2575891, -0.055032767, -0.0205247, -0.11107971, 0.048341025, -0.048915315, 0.059188437, -0.111718066, -0.039619286, -0.165657, 0.018990505, 0.0017499351, -0.038804792, -0.086953335));
    result += mul(g_8, float4x4(0.08722738, -0.005039459, 0.07542034, -0.061049137, 0.025591044, 0.16946335, -0.114563115, -0.034830607, 0.17842476, 0.11199776, 0.008686021, -0.04142143, 0.09293036, -0.08505899, 0.087229416, -0.102381825));
    result += mul(g_9, float4x4(-0.05071452, -0.11384357, 0.11169348, 0.05153077, -0.24056591, -0.056497227, -0.022856226, 0.19383447, 0.02966522, -0.08128601, 0.07467419, -0.019276833, 0.0020969608, 0.029036064, -0.018299947, -0.043434255));
    result += mul(g_10, float4x4(0.043311678, -0.102582484, 0.24798667, 0.06873956, 0.0067927428, 0.098214865, -0.04124763, 0.04490437, -0.06492586, 0.07359665, 0.033324532, 0.120802104, -0.02277019, 0.0021284765, 0.028036185, 0.0687184));
    result += mul(g_11, float4x4(-0.090083234, -0.0073258677, -0.089089446, 0.04679012, -0.025320487, -0.14760749, 0.13109742, 0.039976012, -0.19494978, -0.10603485, -0.02347976, 0.050328556, -0.098470725, 0.05546942, -0.0589479, 0.09333735));
    result += mul(g_12, float4x4(0.011967837, 0.043009043, -0.031999476, 0.022178393, -0.0044910796, -0.023010693, -0.0062060836, -0.031039031, -0.06364646, -0.06365887, -0.029040523, -0.06675782, 0.042098384, 0.032490075, 0.014491912, -0.0011224645));
    result += mul(g_13, float4x4(0.018761864, 0.040258046, 0.015349441, 0.018706307, 0.00089981244, -0.02443291, 0.015173669, -0.008663882, -0.028121095, -0.026123954, -0.011663427, 0.007668493, 0.014926302, 0.03380763, -0.031567805, 0.018132508));
    result += mul(g_14, float4x4(0.011394552, 0.0090883775, 0.011154194, -0.0044680317, 0.0067254594, -0.013079778, 0.019036228, -0.0028701108, -0.014439092, 0.009564524, -0.0135836145, 0.038879603, 0.009461635, -0.014671546, 0.019386383, -0.007752184));
    result += mul(g_15, float4x4(-0.025151528, -0.044746082, 0.030572962, -0.02323665, 0.00077518023, 0.01415367, 0.0053574373, 0.022526693, 0.013129106, 0.03534322, 0.004773132, 0.077551566, -0.04895647, -0.03762353, -5.172888e-05, 0.012251733));
    result += mul(g_16, float4x4(0.03152615, 0.018333036, -1.679869e-05, -0.021737477, -0.076627344, 0.014928358, -0.010456622, 0.07781939, 0.027225398, 0.04659384, -0.0070413146, 0.026454208, -0.017691148, -0.045554973, 0.006093557, -0.03178835));
    result += mul(g_17, float4x4(-0.018481147, -0.05547381, 0.013941934, -0.024416983, 0.027262108, 0.024724096, 0.0063773487, 0.017461762, 0.027166976, -0.02301659, -0.0051281936, -0.0556913, -0.08051738, -0.04638631, 0.015620527, 0.05266176));
    result += mul(g_18, float4x4(0.009157959, 0.08455516, -0.0602788, -0.002439282, -0.02327793, -0.021213762, 0.005698031, 0.002378188, 0.005837403, -0.17286417, 0.13316536, -0.03154805, -0.022410449, -0.047884528, 0.043882124, 0.047745265));
    result += mul(g_19, float4x4(-0.008956661, -0.010137066, -0.007736993, 0.012567491, 0.017111477, -0.050893363, 0.001874233, -0.059543177, 0.043244537, 0.07476611, -0.045336626, -0.05902348, 0.006996905, -0.0718768, -0.004126288, -0.0642003));
    result += mul(g_20, float4x4(0.015879916, 0.040725194, 0.013168297, 0.045075603, -0.01297648, -0.0059797773, -0.015060089, -0.010935342, 0.02049647, 0.034105264, 0.014809084, 0.008366516, -0.051084228, 0.008029285, -0.04545378, 0.023945345));
    result += mul(g_21, float4x4(-0.019541753, 0.0043494124, -0.0001693803, 0.025214057, 0.018182391, 0.027842158, -0.024553766, 0.006766178, -0.029599829, -0.040605135, -0.048153292, -0.018185124, -0.011694039, -0.01453888, -0.022709226, -0.057430573));
    result += mul(g_22, float4x4(-0.08764812, 0.075131916, 0.020414736, -0.050893847, -0.004293497, -0.021197274, -0.0018027405, 0.038802553, 0.021213993, 0.04283625, 0.016089795, 0.03304562, 0.028084677, 0.029016564, 0.03612216, 0.057901673));
    result += mul(g_23, float4x4(0.0057912855, -0.098451905, 0.036739763, -0.06572119, 0.033765186, 0.12279821, -0.025154155, 0.013806011, -0.024162477, -0.009859432, -0.0021075422, -0.02089062, -0.0021298097, 0.0015791449, -0.020502191, -0.033028405));
    result += mul(g_24, float4x4(0.056495182, 0.054205123, 0.032467738, -0.038979713, 0.051377665, -0.0017128112, -0.08553907, 0.08154442, 0.005708859, -0.030467357, 0.056872, 0.033040885, -0.044282306, 0.06320046, -0.077476226, 0.057799205));
    result += mul(g_25, float4x4(-0.10876674, 0.08259616, -0.051354583, 0.08138756, 0.012491528, 0.05439006, 0.030529, -0.058732726, 0.018389955, 0.008327744, 0.013216314, -0.017489955, 0.004981595, 0.023339638, -0.019406691, -0.0027005207));
    result += mul(g_26, float4x4(0.070612185, 0.053251043, -0.045872025, -0.08984753, 0.02582859, 0.011240578, 0.019407703, 0.006788904, 0.036534656, -0.07338343, -0.06434088, -0.023382546, -0.052568957, -0.065474, 0.047638886, 0.050624263));
    result += mul(g_27, float4x4(-0.018035047, -0.078713804, 0.01140521, 0.00012953136, -0.014339465, -0.018948816, 0.04643105, -0.04246953, -0.026791897, 0.02513823, -0.045333434, -0.06504635, -0.024868866, -0.017653162, 0.01686154, -0.007936053));
    result += mul(g_28, float4x4(0.042380203, -0.007992952, -0.012940898, -0.018271092, -0.036340363, 0.02297692, -0.0260716, 0.011647489, 0.055189207, -0.089658745, 0.05829902, -0.05787894, -0.08049513, -0.091856234, 0.09487785, 0.060702115));
    result += mul(g_29, float4x4(0.0022311446, 0.0078554, -0.021208685, 0.009572731, -0.09023339, 0.016889412, 0.029632647, -0.0034283176, 0.00453538, 0.040616557, 0.023657676, 0.03687379, -0.021128353, -0.020249786, -0.006316465, 0.017151888));
    result += float4(0.00032424182, 0.027523492, -0.021710647, 0.0054222327);
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
