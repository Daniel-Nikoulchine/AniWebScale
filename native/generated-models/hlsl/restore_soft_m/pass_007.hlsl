// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_M.glsl:231
// Pass: 007 - Anime4K-v4.0-Restore-CNN-Soft-(M)-Conv-3x1x1x56
// Anime4K is Copyright (c) 2019-2021 bloc97, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[8];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
Texture2D<float4> Anime4KInput2 : register(t2);
Texture2D<float4> Anime4KInput3 : register(t3);
Texture2D<float4> Anime4KInput4 : register(t4);
Texture2D<float4> Anime4KInput5 : register(t5);
Texture2D<float4> Anime4KInput6 : register(t6);
Texture2D<float4> Anime4KInput7 : register(t7);
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

#define MAIN_tex(position) Anime4KSample0(position)
#define MAIN_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define MAIN_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define MAIN_pos anime4k_pos
#define MAIN_size float2(Anime4KInputSizes[0].xy)
#define MAIN_pt rcp(MAIN_size)
#define conv2d_1_tf_tex(position) Anime4KSample2(position)
#define conv2d_1_tf_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_1_tf_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_1_tf_pos anime4k_pos
#define conv2d_1_tf_size float2(Anime4KInputSizes[2].xy)
#define conv2d_1_tf_pt rcp(conv2d_1_tf_size)
#define conv2d_2_tf_tex(position) Anime4KSample3(position)
#define conv2d_2_tf_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_2_tf_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_2_tf_pos anime4k_pos
#define conv2d_2_tf_size float2(Anime4KInputSizes[3].xy)
#define conv2d_2_tf_pt rcp(conv2d_2_tf_size)
#define conv2d_3_tf_tex(position) Anime4KSample4(position)
#define conv2d_3_tf_texOff(offset) Anime4KLoadOffset4(anime4k_output_pixel, offset)
#define conv2d_3_tf_texCurrent Anime4KLoadCurrent4(anime4k_output_pixel)
#define conv2d_3_tf_pos anime4k_pos
#define conv2d_3_tf_size float2(Anime4KInputSizes[4].xy)
#define conv2d_3_tf_pt rcp(conv2d_3_tf_size)
#define conv2d_4_tf_tex(position) Anime4KSample5(position)
#define conv2d_4_tf_texOff(offset) Anime4KLoadOffset5(anime4k_output_pixel, offset)
#define conv2d_4_tf_texCurrent Anime4KLoadCurrent5(anime4k_output_pixel)
#define conv2d_4_tf_pos anime4k_pos
#define conv2d_4_tf_size float2(Anime4KInputSizes[5].xy)
#define conv2d_4_tf_pt rcp(conv2d_4_tf_size)
#define conv2d_5_tf_tex(position) Anime4KSample6(position)
#define conv2d_5_tf_texOff(offset) Anime4KLoadOffset6(anime4k_output_pixel, offset)
#define conv2d_5_tf_texCurrent Anime4KLoadCurrent6(anime4k_output_pixel)
#define conv2d_5_tf_pos anime4k_pos
#define conv2d_5_tf_size float2(Anime4KInputSizes[6].xy)
#define conv2d_5_tf_pt rcp(conv2d_5_tf_size)
#define conv2d_6_tf_tex(position) Anime4KSample7(position)
#define conv2d_6_tf_texOff(offset) Anime4KLoadOffset7(anime4k_output_pixel, offset)
#define conv2d_6_tf_texCurrent Anime4KLoadCurrent7(anime4k_output_pixel)
#define conv2d_6_tf_pos anime4k_pos
#define conv2d_6_tf_size float2(Anime4KInputSizes[7].xy)
#define conv2d_6_tf_pt rcp(conv2d_6_tf_size)
#define conv2d_tf_tex(position) Anime4KSample1(position)
#define conv2d_tf_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_tf_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_tf_pos anime4k_pos
#define conv2d_tf_size float2(Anime4KInputSizes[1].xy)
#define conv2d_tf_pt rcp(conv2d_tf_size)

#define g_0 (max((conv2d_tf_texCurrent), 0.0))
#define g_1 (max(-(conv2d_tf_texCurrent), 0.0))
#define g_2 (max((conv2d_1_tf_texCurrent), 0.0))
#define g_3 (max(-(conv2d_1_tf_texCurrent), 0.0))
#define g_4 (max((conv2d_2_tf_texCurrent), 0.0))
#define g_5 (max(-(conv2d_2_tf_texCurrent), 0.0))
#define g_6 (max((conv2d_3_tf_texCurrent), 0.0))
#define g_7 (max(-(conv2d_3_tf_texCurrent), 0.0))
#define g_8 (max((conv2d_4_tf_texCurrent), 0.0))
#define g_9 (max(-(conv2d_4_tf_texCurrent), 0.0))
#define g_10 (max((conv2d_5_tf_texCurrent), 0.0))
#define g_11 (max(-(conv2d_5_tf_texCurrent), 0.0))
#define g_12 (max((conv2d_6_tf_texCurrent), 0.0))
#define g_13 (max(-(conv2d_6_tf_texCurrent), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(g_0, float4x4(-0.030150581, -0.002168429, 0.014918388, 0.0, 0.020940892, 0.04591048, 0.049137186, 0.0, 0.111167125, 0.05311203, 0.0625381, 0.0, 0.020043287, 0.04785493, 0.040921766, 0.0));
    result += mul(g_1, float4x4(0.04158565, -0.008488135, 0.0020472286, 0.0, 0.049123142, -0.055042226, -0.06489915, 0.0, 0.09238876, 0.10387972, 0.09576964, 0.0, -0.054776173, -0.098954335, -0.09018853, 0.0));
    result += mul(g_2, float4x4(0.2081418, 0.08273068, 0.040325668, 0.0, -0.09937802, -0.13162258, -0.13989717, 0.0, -0.13983749, 0.01309777, 0.0023888077, 0.0, -0.18937743, -0.07021057, -0.047152344, 0.0));
    result += mul(g_3, float4x4(-0.09646629, 0.080605574, 0.10463501, 0.0, 0.22579835, 0.24077554, 0.22600271, 0.0, 0.049726978, 0.015292378, -0.0047161994, 0.0, 0.16281025, 0.048491795, 0.038338162, 0.0));
    result += mul(g_4, float4x4(-0.09772107, -0.043998875, -0.054745924, 0.0, -0.1257736, -0.13175423, -0.10889618, 0.0, -0.015900036, 0.07074481, 0.08210496, 0.0, -0.11321135, -0.12526917, -0.105605066, 0.0));
    result += mul(g_5, float4x4(0.14187162, 0.14032297, 0.13016908, 0.0, 0.018954534, 0.016011704, 0.010169183, 0.0, 0.04762765, -0.044460997, -0.06499567, 0.0, 0.11133751, 0.09464176, 0.08865274, 0.0));
    result += mul(g_6, float4x4(-0.16567162, -0.1744712, -0.1637222, 0.0, -0.02412003, 0.0074480795, 0.007903436, 0.0, -0.06161098, -0.046788957, -0.03971239, 0.0, 0.030736001, 0.036460854, 0.03660504, 0.0));
    result += mul(g_7, float4x4(0.084027, 0.10024112, 0.08152756, 0.0, 0.005087354, -0.026047802, -0.027264625, 0.0, 0.10519243, 0.08977278, 0.077558964, 0.0, -0.052826345, -0.06602686, -0.055083472, 0.0));
    result += mul(g_8, float4x4(0.007862721, 0.009936555, 0.012004831, 0.0, -0.042322706, -0.061728776, -0.05359773, 0.0, 0.030532641, 0.045623366, 0.04214089, 0.0, 0.030569768, 0.011892851, 0.0074041556, 0.0));
    result += mul(g_9, float4x4(0.03948997, 0.043119986, 0.039943404, 0.0, 0.0526772, 0.06820589, 0.058139592, 0.0, -0.062081397, -0.06755701, -0.054816127, 0.0, -0.004076369, 0.0061744447, 0.016273081, 0.0));
    result += mul(g_10, float4x4(0.0071622543, 0.004829105, -0.002032197, 0.0, -0.048541367, -0.059043564, -0.05662218, 0.0, 0.0015553127, 0.009178359, 0.009577062, 0.0, 0.114169896, 0.1349016, 0.11432262, 0.0));
    result += mul(g_11, float4x4(0.019324556, 0.028323999, 0.027396113, 0.0, 0.016746879, 0.01608199, 0.026891617, 0.0, 0.12068619, 0.13617857, 0.113496214, 0.0, -0.013930715, -0.014250072, -0.00824306, 0.0));
    result += mul(g_12, float4x4(-0.0024534757, -0.0064973077, -0.007905654, 0.0, -0.019158727, -0.024820521, -0.020509848, 0.0, -0.09608131, -0.11177871, -0.10503465, 0.0, -0.011210447, -0.010875943, -0.015295865, 0.0));
    result += mul(g_13, float4x4(0.09681486, 0.113604136, 0.10416855, 0.0, -0.08199983, -0.09013433, -0.08562243, 0.0, 0.041304465, 0.048315883, 0.042945288, 0.0, -0.09863276, -0.117853515, -0.09870226, 0.0));
    result += float4(-0.0039074384, -0.0085585555, -0.0132283475, 0.0);
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
