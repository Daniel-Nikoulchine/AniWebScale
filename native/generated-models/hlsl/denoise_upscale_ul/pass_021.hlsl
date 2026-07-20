// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_UL.glsl:1422
// Pass: 021 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(UL)-Conv-4x1x1x120
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
    float4 result = mul(g_0, float4x4(-0.06761509, 0.0010596798, 0.118115634, 0.14935187, -0.05466623, 0.091785856, -0.03665047, 0.076207176, -0.15206745, -0.074811794, -0.041557387, 0.020541618, -0.037649132, -0.07627772, -0.10156735, -0.07498991));
    result += mul(g_1, float4x4(-0.0541389, 0.007155582, -0.06095953, -0.016313383, -0.13457695, -0.03827954, -0.034835886, 0.04974308, 0.008285558, -0.06611796, -0.067563675, -0.11533022, -0.08719109, 0.042913426, -0.083873115, 0.027492668));
    result += mul(g_2, float4x4(0.17322378, -0.07721062, 0.076297946, -0.1325289, 0.00692486, 0.019282155, 0.038707003, 0.056305885, -0.037604675, -0.17109787, 0.052209407, -0.11086336, 0.0052244705, 0.056766637, -0.017374612, 0.06740667));
    result += mul(g_3, float4x4(0.053550255, 0.07344529, -0.10690144, -0.08243465, 0.028142922, -0.07358604, 0.070248306, 0.0053416835, 0.009705257, 0.09426246, 0.05850371, 0.08341002, 0.06166079, 0.102394834, 0.058707405, 0.19911417));
    result += mul(g_4, float4x4(-0.009806288, 0.061949313, 0.011325549, 0.031676874, 0.113277406, 0.07123387, -0.0022331094, -0.05520811, -0.021068804, 0.0073448666, 0.031778157, 0.06381251, -0.022977686, -0.0044090333, -0.028826792, -0.005600321));
    result += mul(g_5, float4x4(-0.13628425, -0.107186474, 0.010461016, 0.045646533, 0.010563035, 0.0005640543, 0.002957052, -0.01454462, 0.106655054, 0.13992403, -0.01641908, 0.0264948, 0.014378123, 0.024764376, -0.06435794, -0.076860085));
    result += mul(g_6, float4x4(0.031931117, 0.062713124, -0.049225837, -0.02620178, 0.20593183, 0.03311921, -0.02824421, -0.19422682, -0.017965427, 0.05093508, -0.07729694, -0.013976707, -0.054889455, -0.008431357, -0.00865999, 0.05323866));
    result += mul(g_7, float4x4(-0.07898102, 0.13033123, -0.24963257, -0.046712235, -0.017762529, -0.07267942, 0.039491024, -0.034781307, 0.02270499, -0.12520099, -0.02714401, -0.13284011, 0.014340563, -0.007257448, -0.07413879, -0.12837824));
    result += mul(g_8, float4x4(0.09598721, -0.006008832, 0.051995635, -0.07847789, 0.109905876, 0.18126504, -0.086034976, -0.0360382, 0.19074084, 0.054656357, 0.06871617, -0.041497722, 0.064660124, -0.10478427, 0.052080367, -0.1518587));
    result += mul(g_9, float4x4(-0.044614766, -0.08404386, 0.06729217, 0.03758003, -0.23567544, -0.0450765, 0.014905518, 0.19749434, 0.0070031853, -0.068472505, 0.04280405, -0.009026482, 0.03368337, 0.037044305, 0.014582284, -0.015817456));
    result += mul(g_10, float4x4(0.05070276, -0.13125883, 0.24694905, 0.049511425, 0.021699967, 0.080548055, -0.03720478, 0.032441437, -0.01215519, 0.09360713, 0.024676912, 0.11170701, -0.024200387, 0.0021200276, 0.06300166, 0.10979445));
    result += mul(g_11, float4x4(-0.1055991, 0.007073368, -0.07666124, 0.06573558, -0.10762247, -0.16527167, 0.09825201, 0.051373113, -0.1926851, -0.046607103, -0.07601954, 0.05199459, -0.06756806, 0.092222616, -0.026166819, 0.1535803));
    result += mul(g_12, float4x4(0.0067429054, 0.014872415, -0.019792963, 0.0014269215, 0.041500363, 0.018643422, 0.04487991, 0.031431414, -0.0278133, -0.028131608, -0.019798402, -0.041768856, -0.0063227355, 0.007656633, 0.0019235855, 0.00076331315));
    result += mul(g_13, float4x4(0.025489544, 0.023983652, 0.029175067, 0.0075372118, -0.010194142, -0.014977182, 0.011589661, 0.00036903258, -0.012841702, -0.010945794, -0.012143497, -0.0069256728, 0.007313037, 0.007576904, -0.016960602, 0.009170305));
    result += mul(g_14, float4x4(0.004188971, 0.017998729, -0.0046976185, -0.0034182668, 0.021841675, 0.012860078, 0.009202975, -0.0071324864, -0.0037808695, 0.01139587, -0.016267903, 0.007991299, 0.008879691, 0.007677154, 0.016209174, 0.011406443));
    result += mul(g_15, float4x4(-0.008698401, -0.017972758, 0.026514322, -0.0024080887, 0.00012845756, 0.021530064, 0.0014967524, 0.0060274163, 0.017589558, 0.031043446, 0.014386793, 0.051733218, -0.013435874, -0.020567564, 0.011874828, 0.0030195254));
    result += mul(g_16, float4x4(0.008565417, 0.0073839244, -0.012248247, -0.019089373, -0.04383907, 0.01000193, -0.003246391, 0.0502051, 0.012343873, 0.027492827, -0.011591099, 0.010474208, -0.009317595, -0.009244615, -0.00889853, -0.015167559));
    result += mul(g_17, float4x4(-0.0149119655, -0.05737016, 0.027463723, 0.0013402153, 0.0012228708, 4.653676e-05, 5.3374144e-05, 0.010701133, 0.011828213, -0.012499855, -0.009720743, -0.035716657, -0.06976149, -0.05596556, 0.0028440042, 0.013388718));
    result += mul(g_18, float4x4(-0.010236228, 0.08551208, -0.060067203, 0.012999882, -0.0060008806, 0.003534564, 0.009385839, 0.010742909, 0.02672157, -0.17606625, 0.13504161, -0.035290483, -0.014812689, -0.0236554, 0.031493064, 0.01800991));
    result += mul(g_19, float4x4(0.0005283657, -0.032297328, 0.023884023, 0.024165852, 0.0017424148, -0.015371204, 0.0058860597, -0.04624227, 0.04947679, 0.09081732, -0.04592456, -0.03128466, 0.00023743653, -0.032846384, -0.0013158394, 0.0037953698));
    result += mul(g_20, float4x4(0.0034766623, -0.006661828, 0.027227342, 0.033958994, -0.007990619, 0.0025515554, -0.016197672, -0.0010064896, 0.022598108, 0.014734878, 0.021482255, -0.0059315437, -0.038538814, 0.03478085, -0.05926627, 0.012918195));
    result += mul(g_21, float4x4(-0.023291608, -0.013129155, 0.0032865414, 0.026531553, -0.004495095, 0.0043812403, -0.027177097, -0.009125319, -0.006041235, -0.0031154896, -0.030664662, 0.005782464, -0.008880747, 0.015690446, -0.0108247, -0.022403536));
    result += mul(g_22, float4x4(-0.07639219, 0.05440532, 0.016447276, -0.055569574, 0.0014948049, -0.03464865, -0.006925237, 0.024131197, 0.009468209, -0.011771851, 0.013548103, 0.004704814, 0.063868396, 0.04857746, 0.08745972, 0.0690927));
    result += mul(g_23, float4x4(0.021505289, -0.06289818, 0.031038022, -0.047952045, 0.014759762, 0.10819852, -0.044093642, -0.020913709, -0.017672667, 0.007322798, -0.0030338434, -0.015471056, 0.017840479, -0.052742675, 0.044256743, -0.014589662));
    result += mul(g_24, float4x4(0.037849434, 0.04017271, 0.01840757, -0.05590355, 0.041468013, -0.015397055, -0.059170194, 0.08708615, 0.021914955, -0.0045240326, 0.03308673, 0.0141805615, -0.045770008, 0.048188016, -0.08913234, 0.046581928));
    result += mul(g_25, float4x4(-0.09374169, 0.07681035, -0.032266654, 0.066911325, 0.0071584303, 0.06599442, -0.0031403983, -0.062489454, 0.013248783, 0.018261025, -0.00095267413, -0.026741864, -0.0059258267, 0.03542517, -0.033440042, -0.0007421821));
    result += mul(g_26, float4x4(0.06491965, 0.0354909, -0.035559855, -0.07943817, 0.028543673, 0.026842002, -0.0029009457, -0.0022229373, 0.045988, -0.08896797, -0.04740724, 0.002011393, -0.067833476, -0.048432026, 0.025755037, 0.042066928));
    result += mul(g_27, float4x4(-0.0011515832, -0.067060925, 0.02632549, 0.019017957, -0.0021755556, 0.004405696, 0.03028079, -0.043944478, -0.06373467, -0.032911435, -0.07619137, -0.055402283, -0.014293524, -0.009286333, 0.032950103, 0.0020192636));
    result += mul(g_28, float4x4(0.033251163, -0.012636667, -0.019736348, -0.02221555, -0.035174683, -0.0024467881, -0.0020635366, 0.021488743, 0.054788366, -0.085087426, 0.06572526, -0.037050918, -0.06467607, -0.1047945, 0.10937466, 0.058931317));
    result += mul(g_29, float4x4(-0.0015108787, 0.016789518, -0.02054971, 0.014368727, -0.083879344, -0.0024550394, 0.047329154, 0.018185811, -0.008528356, 0.04782707, 0.0019893225, 0.0095295245, -0.0024202724, -0.022640519, 0.0033455987, 0.010862984));
    result += float4(-0.00339168, 0.022745693, -0.021186745, 0.007273877);
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
