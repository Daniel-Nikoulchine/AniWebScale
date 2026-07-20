// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_UL.glsl:1508
// Pass: 022 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(UL)-Conv-4x1x1x120
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
    float4 result = mul(g_0, float4x4(0.016521078, 0.02344092, -0.04535869, -0.02916889, -0.06936641, -0.1118498, -0.07784149, -0.10769916, 0.042465053, 0.023522044, 0.0057797814, -0.00933453, 0.0013065349, 0.006887965, 0.019049056, 0.00018660461));
    result += mul(g_1, float4x4(0.047062866, 0.030671, 0.018363738, 0.015970303, 0.03619224, 0.0009964193, 0.027005734, -0.010791107, -0.027404316, -0.017589977, 0.0027660786, 0.0064380392, 0.003131181, -0.03881711, 0.017278498, -0.026646316));
    result += mul(g_2, float4x4(-0.09417044, -0.030767195, -0.07023792, -0.015087274, -0.0007041566, -0.007214834, -0.010352469, -0.0208777, -0.006043107, 0.041942447, -0.027989924, 0.02058792, -0.004574836, -0.030063841, 0.0009874715, -0.030957421));
    result += mul(g_3, float4x4(0.008398759, -0.014724292, 0.05661028, 0.03329433, 0.06970151, 0.09905173, 0.045296658, 0.06785315, -0.0044002533, -0.033776686, -0.018678186, -0.029671727, -0.019401457, -0.018823013, -0.015008842, -0.06645454));
    result += mul(g_4, float4x4(-0.012770869, -0.039806906, -0.020173356, -0.033546574, -0.01800492, 0.005292071, -0.0040793624, 0.028466543, -0.0059105135, -0.01909232, -0.008970177, -0.023610232, 0.015667727, 0.021344513, 0.008805983, 0.012206504));
    result += mul(g_5, float4x4(0.09997275, 0.08955608, 0.035512842, 0.028650196, -0.0030424239, -0.0024058563, 0.0016431157, 0.006236751, -0.036105607, -0.04603557, 0.009145427, -0.0048202197, -0.020911733, -0.02017906, 0.016494693, 0.026199821));
    result += mul(g_6, float4x4(-0.038404938, -0.060263526, -6.756075e-05, -0.027351642, -0.088377364, -0.018328555, 0.0054546758, 0.080624446, 0.011837796, -0.020218652, 0.018197412, 0.0060563446, 0.025623528, 0.048627276, 0.023259064, 0.040498782));
    result += mul(g_7, float4x4(0.001184946, -0.010515342, 0.07386562, 0.059235208, 0.05555331, 0.062187005, 0.05260689, 0.053744275, -0.05839836, -0.037090734, -0.039248314, -0.020784492, -0.028018624, -0.019818485, 0.0076861596, 0.02911364));
    result += mul(g_8, float4x4(-0.00855134, 0.026217, 0.008748317, 0.044626243, -0.031007087, -0.040997487, 0.05034173, 0.048289847, -0.055651344, -0.0043054484, -0.022927478, 0.035169583, -0.008501671, 0.04446119, 0.011305084, 0.07596592));
    result += mul(g_9, float4x4(0.02517117, 0.04711998, 0.013574831, 0.035244223, 0.075724855, -0.0018857572, -0.01328286, -0.08398966, -0.018110974, 0.010837328, -0.040522598, -0.018411685, -0.059188075, -0.04547794, -0.029902466, -0.016604925));
    result += mul(g_10, float4x4(-0.035855412, 0.046150643, -0.10446721, -0.026326178, -0.04509233, -0.059326984, -0.035487395, -0.047976315, 0.07541923, 0.014728924, 0.046932008, 0.015592031, 0.017363356, 0.009260565, -0.014755931, -0.04052638));
    result += mul(g_11, float4x4(0.021554522, -0.011627397, -0.01343262, -0.04844844, 0.027149484, 0.05269421, -0.038861327, -0.034239817, 0.045947555, 0.0040015248, 0.007324502, -0.033051178, 0.0059830896, -0.069709964, 0.0073222807, -0.07108966));
    result += mul(g_12, float4x4(-0.009433482, 0.014257062, -0.034876116, -0.006570796, 0.01594308, 0.006663722, 0.025571914, 0.017348047, -0.00696648, 0.0012649806, -0.009151321, -0.016255042, -0.009809473, -0.0066239014, 0.013773972, 0.0009501933));
    result += mul(g_13, float4x4(0.026438858, 0.021545267, 0.028909115, -0.00084199436, -0.011350823, -0.010261177, 0.0064784726, 0.0028340816, 4.6254245e-05, 0.0022755957, 0.008798779, 0.010278017, -0.0011969887, 0.0035411653, -0.018417642, 0.0038709878));
    result += mul(g_14, float4x4(0.013238081, 6.1892446e-05, 0.002711564, -0.009014244, 0.03579594, 0.0009713739, 0.018199503, -0.010510502, -0.0019577555, -0.0035989769, -0.027621416, -0.000649344, 0.012450313, 0.005054388, 0.028295556, 0.016118951));
    result += mul(g_15, float4x4(0.0014749946, -0.023122363, 0.03635473, 0.0058698757, -0.001502294, 0.0056668227, -0.00653508, -0.0045331884, 0.0019510906, -0.0004722523, 0.0015459604, 0.02002365, -0.012883676, -0.02313574, 0.0055781654, 0.00042050896));
    result += mul(g_16, float4x4(0.010353148, 0.0061610388, -0.01620723, -0.025678562, -0.050585296, 0.0015720357, 0.006579174, 0.04645622, 0.0034451822, 0.01640892, -0.019171385, -0.002445667, 0.002142384, -0.00157746, -0.007453497, -0.012107003));
    result += mul(g_17, float4x4(-0.023626367, -0.03362931, 0.02775251, 0.00854008, -0.00731221, 0.0058875666, -0.0042465483, 0.011091973, 0.01608576, 0.008776418, -0.005520655, -0.02189608, -0.07337467, -0.04255072, 0.008632718, 0.024232844));
    result += mul(g_18, float4x4(-0.012279061, 0.09683549, -0.058048066, 0.009577618, -0.007927522, 0.0030408904, 0.0026037316, 0.0097128665, 0.039862663, -0.18592681, 0.15766914, -0.02878756, -0.015735846, -0.025808172, 0.035324212, 0.025404148));
    result += mul(g_19, float4x4(0.006978013, -0.023965824, 0.04186123, 0.035988815, 0.009321329, -0.015712317, 0.0018002216, -0.052822754, 0.05654876, 0.111119345, -0.041984286, -0.029346094, -0.007712756, -0.034608763, -0.0036700158, 0.0038703915));
    result += mul(g_20, float4x4(0.010860362, 0.006824253, 0.03891404, 0.049122907, -0.008826647, -0.0010997625, -0.021827312, -0.007863293, 0.033063967, 0.022403365, 0.032778744, 0.007655028, -0.04496311, 0.041045222, -0.07040422, 0.004163393));
    result += mul(g_21, float4x4(-0.024705354, -0.015902927, 0.0062216455, 0.032576248, -0.0073882695, 0.00312872, -0.034358293, -0.0108961025, -0.013837597, -0.01177598, -0.04495569, -0.0055595962, -0.01059331, 0.012361757, -0.014834784, -0.033682585));
    result += mul(g_22, float4x4(-0.09480182, 0.03846278, -0.0028056598, -0.07323092, -0.005995085, -0.043553468, -0.005056617, 0.024003377, 0.004277762, -0.012972639, 0.012475677, 0.008617157, 0.10223809, 0.07649263, 0.12168736, 0.097682655));
    result += mul(g_23, float4x4(0.015393864, -0.07291429, 0.02954706, -0.05294187, 0.013404429, 0.120944545, -0.042298347, -0.01288604, -0.019713184, 0.0020540208, -0.011201426, -0.02414191, 0.007575817, -0.07666445, 0.0432983, -0.026015261));
    result += mul(g_24, float4x4(0.03819905, 0.04372597, 0.01904637, -0.061578088, 0.040888324, -0.016588384, -0.064523876, 0.09287848, 0.01574791, -0.014614555, 0.02938285, 0.0042374404, -0.046039872, 0.056844704, -0.08844019, 0.052806962));
    result += mul(g_25, float4x4(-0.096315265, 0.07987954, -0.031859763, 0.072237074, 0.015652604, 0.07566605, -0.00032600394, -0.05746408, 0.014229001, 0.017113304, -0.0023968874, -0.03106284, -0.0069599864, 0.03968875, -0.038528994, -0.003121002));
    result += mul(g_26, float4x4(0.07314791, 0.03615158, -0.03678017, -0.0791755, 0.03634212, 0.039138626, 0.0035000257, 0.00436604, 0.044376615, -0.09974018, -0.051570408, -0.002901859, -0.06796205, -0.05585607, 0.02609314, 0.04431718));
    result += mul(g_27, float4x4(0.0026970597, -0.07160132, 0.03102004, 0.022031954, 0.000259048, 0.004125086, 0.033309445, -0.04846637, -0.06566389, -0.029620873, -0.07882971, -0.053104673, -0.013712152, -0.015054757, 0.033180926, 0.00034900242));
    result += mul(g_28, float4x4(0.034628514, -0.01001147, -0.021473913, -0.022840675, -0.045706123, -0.010280426, -0.0069577876, 0.01667532, 0.055181097, -0.087735586, 0.06744914, -0.034818206, -0.066513196, -0.10804274, 0.11681918, 0.06460058));
    result += mul(g_29, float4x4(-0.005054911, 0.01865763, -0.021856284, 0.010207481, -0.090607546, -0.014940299, 0.04399175, 0.013478195, -0.0072319377, 0.057889264, 0.0061306353, 0.021376813, -0.00018109869, -0.022432365, 0.004136804, 0.011778294));
    result += float4(0.015986905, 0.006547183, 0.017682848, 0.0020978956);
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
