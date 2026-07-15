// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale/Anime4K_Upscale_CNN_x2_UL.glsl:1594
// Pass: 023 - Anime4K-v3.2-Upscale-CNN-x2-(UL)-Conv-4x1x1x120
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
    float4 result = mul(g_0, float4x4(0.20584391, 0.22176251, 0.12817344, 0.16349226, 0.24339934, 0.17479841, 0.23518398, 0.19196586, 0.10900553, 0.080384456, 0.049235467, 0.027794728, -0.05141681, 0.0007015638, -0.010815038, 0.0042753317));
    result += mul(g_1, float4x4(0.0714463, 0.026722606, -0.01580307, -0.036710627, 0.13722661, 0.1325067, 0.12155393, 0.092651665, -0.21974826, -0.22233371, -0.16056158, -0.16607761, -0.10291634, -0.19475317, -0.117747545, -0.18824245));
    result += mul(g_2, float4x4(0.0385657, 0.12090414, 0.09484494, 0.18811698, 0.015320313, 0.0051719607, -0.016927784, -0.03450855, -0.06506198, 0.05625437, -0.02982918, 0.06270707, -0.13614634, -0.16412087, -0.1319045, -0.1733402));
    result += mul(g_3, float4x4(-0.2033194, -0.2067332, -0.16234529, -0.13661149, -0.22975448, -0.1841141, -0.26185742, -0.23617432, -0.058616254, -0.11470092, -0.064833924, -0.082624085, 0.0018012474, 0.010971402, -0.0015926235, -0.056720145));
    result += mul(g_4, float4x4(0.012773226, -0.013976976, 0.007706423, -0.022663448, -0.13764867, -0.121803656, -0.12158649, -0.090470046, 0.22548035, 0.22929274, 0.19819829, 0.16713546, 0.15709636, 0.16574621, 0.17671035, 0.18283793));
    result += mul(g_5, float4x4(-0.042175665, -0.07863977, -0.1209475, -0.14067635, 0.0041970555, 0.03598768, 0.009632853, 0.040009186, -0.014479617, -0.060088724, 0.041292075, -0.004627034, 0.09958161, 0.120460846, 0.15672928, 0.18279101));
    result += mul(g_6, float4x4(-0.03370265, -0.07010845, 0.04648067, -0.007877368, -0.11963536, -0.014810524, -0.01556151, 0.11850641, -0.0021221144, -0.050126694, 0.03193186, -0.012815193, -0.019450104, 0.017504638, -0.007544723, 0.0028710878));
    result += mul(g_7, float4x4(-0.018643383, -0.04445287, 0.07541755, 0.043240048, 0.027209729, 0.06499946, -0.018240616, 0.014570308, -0.058010563, 0.019799259, 0.0030194358, 0.06929909, -0.0056114118, 0.009093819, 0.03223382, 0.053046633));
    result += mul(g_8, float4x4(-0.0133113945, 0.019222038, -0.019711712, 0.03676041, -0.040668692, -0.09569124, 0.053240422, 0.02388429, -0.12218938, -0.08086858, -0.043406986, 0.009516919, -0.04289723, 0.056066234, -0.035658766, 0.061961327));
    result += mul(g_9, float4x4(0.023964832, 0.07624368, -0.020873679, 0.0256053, 0.12444348, 0.017517762, 0.0049669463, -0.13534403, 0.0061981925, 0.052108612, -0.02908856, 0.0135363275, -0.030678025, -0.015180554, -0.003328521, 0.021289025));
    result += mul(g_10, float4x4(-0.02231607, 0.09188703, -0.13311718, -0.009214322, -0.021628553, -0.047853045, 0.014602204, 0.00086198986, 0.06729613, -0.04228859, -0.0030271288, -0.066696614, -0.0071333526, -0.019973027, -0.036203787, -0.056756962));
    result += mul(g_11, float4x4(0.05850421, -0.0047896104, -0.0036014696, -0.05261781, 0.020924669, 0.093680315, -0.061118666, -0.020405825, 0.100053616, 0.061513033, 0.018219335, -0.02082051, 0.039510462, -0.08404035, 0.050883695, -0.052642383));
    result += mul(g_12, float4x4(0.0018722751, 0.020684525, -0.02356179, 0.009360695, 0.0036660347, -0.006931955, -0.015446396, -0.02027952, 0.006836204, 0.00341897, -0.020235445, -0.029695021, -0.0053638928, -0.003108307, 0.016338514, -0.0058539147));
    result += mul(g_13, float4x4(0.021255454, 0.036906153, 0.019704418, -0.009486708, -0.009084271, -0.012694315, 0.012314602, -0.002121502, -0.0047310013, 0.0051953527, 0.005284111, 0.019026738, -0.0082058, 0.0032704875, -0.02295881, 0.009902225));
    result += mul(g_14, float4x4(0.01866446, -0.012482591, 0.011301323, -0.011294572, 0.035305023, -0.002237504, 0.010679519, -0.000508338, 8.54808e-05, -0.02033275, -0.008063064, 0.013109392, 0.0002144853, -0.007573196, 0.015446864, 0.0023629267));
    result += mul(g_15, float4x4(-0.00978586, -0.025148384, 0.024103062, -0.009535831, -0.002879648, 0.0012579657, 0.018271701, 0.02113783, -0.03735869, -0.02581921, 0.005823926, 0.04087479, -0.0077521144, -0.012728182, 0.0067631016, 0.012669306));
    result += mul(g_16, float4x4(0.018013993, 0.026847519, 0.0021338093, -0.010125906, -0.07225123, -0.0025745684, -0.012799456, 0.056836564, 0.011377961, 0.017062144, -0.007494936, 0.010489539, 0.012431433, -0.019703059, 0.007082196, -0.031403106));
    result += mul(g_17, float4x4(-0.027560756, -0.030534893, 0.019047359, -0.0068690516, -0.0069791237, 0.0081298705, 0.0028945836, 0.009644792, 0.023117492, 0.020431874, -0.0056545194, -0.02480413, -0.07047867, -0.037890248, 0.025276575, 0.049277883));
    result += mul(g_18, float4x4(0.015748044, 0.086017504, -0.051286206, -0.003599236, -0.023193073, -0.023733998, 0.002799065, 0.005258185, 0.010922322, -0.17615142, 0.14165695, -0.029909663, -0.017889502, -0.046552524, 0.03964598, 0.049426638));
    result += mul(g_19, float4x4(-0.0073433192, -0.011656557, -0.0068763834, 0.014078096, 0.018000547, -0.053453963, 0.00786442, -0.050999343, 0.04133596, 0.079854034, -0.038685665, -0.053702615, -0.0019746814, -0.07859513, -0.0076702842, -0.067455895));
    result += mul(g_20, float4x4(0.009444058, 0.043747634, 0.018948376, 0.05009854, -0.011580162, -0.0065071583, -0.013997229, -0.011439345, 0.023656886, 0.030394329, 0.02134696, 0.009440647, -0.048070773, 0.007841886, -0.05323206, 0.013742174));
    result += mul(g_21, float4x4(-0.019898156, 0.000818382, 0.0010332671, 0.01928002, 0.013191405, 0.029638033, -0.02320344, 0.007421591, -0.02833562, -0.033782348, -0.04978492, -0.020176657, -0.0138621945, -0.013926801, -0.021230116, -0.058447562));
    result += mul(g_22, float4x4(-0.08644919, 0.073316105, 0.017838318, -0.049475558, -0.007295481, -0.025924034, -0.0068463665, 0.024905838, 0.016891189, 0.041490942, 0.011466327, 0.029829478, 0.034047317, 0.036229853, 0.04733451, 0.062059373));
    result += mul(g_23, float4x4(0.008540078, -0.09782984, 0.037032314, -0.063398704, 0.028395759, 0.12369336, -0.03458798, 0.012534729, -0.02110072, -0.007954169, -0.002136603, -0.019739889, -0.01087704, -0.004243762, -0.019832188, -0.03347458));
    result += mul(g_24, float4x4(0.054272063, 0.053247515, 0.025393743, -0.043571323, 0.05035569, -0.0042993715, -0.08645438, 0.07723826, 0.009475109, -0.026420964, 0.06111581, 0.03551816, -0.040812302, 0.07295332, -0.07636345, 0.059867676));
    result += mul(g_25, float4x4(-0.103165455, 0.07943813, -0.04935193, 0.0776962, 0.0149123045, 0.056066703, 0.028792242, -0.051936194, 0.015754307, 0.004817783, 0.011213326, -0.018288456, 0.004715879, 0.02536934, -0.015915168, -0.0008426239));
    result += mul(g_26, float4x4(0.0723322, 0.054040924, -0.0476729, -0.08399067, 0.024805048, 0.0118207345, 0.022066418, 0.006886721, 0.031156952, -0.07442044, -0.06636254, -0.023382878, -0.051537152, -0.06360144, 0.045075376, 0.050795015));
    result += mul(g_27, float4x4(-0.013090917, -0.0783513, 0.014832963, 0.0033018794, -0.014636453, -0.020164138, 0.043610837, -0.04028102, -0.024922965, 0.017962486, -0.045353472, -0.065985985, -0.020156763, -0.019561546, 0.01627726, -0.0065625296));
    result += mul(g_28, float4x4(0.038890418, -0.007016582, -0.01374995, -0.01861392, -0.03940205, 0.019309007, -0.026372327, 0.0079260105, 0.05348645, -0.087648585, 0.057326347, -0.055338904, -0.07803935, -0.09048593, 0.09173596, 0.05747143));
    result += mul(g_29, float4x4(0.001742558, 0.010703091, -0.021057613, 0.006859906, -0.086059436, 0.008977797, 0.021366948, -0.0043655075, 0.005885378, 0.042646274, 0.028150525, 0.037941158, -0.014817959, -0.016695084, -0.0056764153, 0.019049013));
    result += float4(0.0113136405, -0.0063769994, 0.010973808, -0.011560247);
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
