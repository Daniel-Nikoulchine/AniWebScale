// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:1175
// Pass: 024 - ArtCNN C4F16 (Conv2D-6)
// ArtCNN is Copyright (c) 2024 Joao Chrisostomo, MIT licensed.

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

#define conv2d_0_tex(position) Anime4KSample0(position)
#define conv2d_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_0_pos anime4k_pos
#define conv2d_0_size float2(Anime4KInputSizes[0].xy)
#define conv2d_0_pt rcp(conv2d_0_size)
#define conv2d_1_tex(position) Anime4KSample2(position)
#define conv2d_1_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_1_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_1_pos anime4k_pos
#define conv2d_1_size float2(Anime4KInputSizes[2].xy)
#define conv2d_1_pt rcp(conv2d_1_size)
#define conv2d_2_tex(position) Anime4KSample4(position)
#define conv2d_2_texOff(offset) Anime4KLoadOffset4(anime4k_output_pixel, offset)
#define conv2d_2_texCurrent Anime4KLoadCurrent4(anime4k_output_pixel)
#define conv2d_2_pos anime4k_pos
#define conv2d_2_size float2(Anime4KInputSizes[4].xy)
#define conv2d_2_pt rcp(conv2d_2_size)
#define conv2d_3_tex(position) Anime4KSample6(position)
#define conv2d_3_texOff(offset) Anime4KLoadOffset6(anime4k_output_pixel, offset)
#define conv2d_3_texCurrent Anime4KLoadCurrent6(anime4k_output_pixel)
#define conv2d_3_pos anime4k_pos
#define conv2d_3_size float2(Anime4KInputSizes[6].xy)
#define conv2d_3_pt rcp(conv2d_3_size)
#define conv2d_5_0_tex(position) Anime4KSample1(position)
#define conv2d_5_0_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_5_0_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_5_0_pos anime4k_pos
#define conv2d_5_0_size float2(Anime4KInputSizes[1].xy)
#define conv2d_5_0_pt rcp(conv2d_5_0_size)
#define conv2d_5_1_tex(position) Anime4KSample3(position)
#define conv2d_5_1_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_5_1_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_5_1_pos anime4k_pos
#define conv2d_5_1_size float2(Anime4KInputSizes[3].xy)
#define conv2d_5_1_pt rcp(conv2d_5_1_size)
#define conv2d_5_2_tex(position) Anime4KSample5(position)
#define conv2d_5_2_texOff(offset) Anime4KLoadOffset5(anime4k_output_pixel, offset)
#define conv2d_5_2_texCurrent Anime4KLoadCurrent5(anime4k_output_pixel)
#define conv2d_5_2_pos anime4k_pos
#define conv2d_5_2_size float2(Anime4KInputSizes[5].xy)
#define conv2d_5_2_pt rcp(conv2d_5_2_size)
#define conv2d_5_3_tex(position) Anime4KSample7(position)
#define conv2d_5_3_texOff(offset) Anime4KLoadOffset7(anime4k_output_pixel, offset)
#define conv2d_5_3_texCurrent Anime4KLoadCurrent7(anime4k_output_pixel)
#define conv2d_5_3_pos anime4k_pos
#define conv2d_5_3_size float2(Anime4KInputSizes[7].xy)
#define conv2d_5_3_pt rcp(conv2d_5_3_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(0.10407887, 0.097488195, 0.10222243, 0.093804784);
    result += mul((conv2d_5_0_texOff(float2(-1, -1)) + conv2d_0_texOff(float2(-1, -1))), float4x4(-0.06835281, -0.002063394, -0.022099333, -0.026033442, -0.050314296, -0.016407972, -0.045784205, -0.027180335, 0.01664453, 0.027706053, 0.00037955985, 0.014919642, 0.16804579, 0.10516603, 0.06317556, 0.09553988));
    result += mul((conv2d_5_0_texOff(float2(0, -1)) + conv2d_0_texOff(float2(0, -1))), float4x4(-0.058651123, -0.10322991, 0.033108298, 0.049048815, 0.037896834, -0.030353548, -0.07552219, 0.0008279127, 0.014969072, -0.11944471, 0.08322254, 0.032955587, -0.0011137993, 0.15025517, 0.044875998, -0.0154070575));
    result += mul((conv2d_5_0_texOff(float2(1, -1)) + conv2d_0_texOff(float2(1, -1))), float4x4(0.014740907, -0.03344216, -0.005187303, -0.015973497, -0.022344043, 0.0036320067, -0.024056677, -0.043564856, -0.022558894, 0.0072227363, -0.0053798654, 0.033077013, 0.09951096, 0.032568347, 0.06065021, 0.017621083));
    result += mul((conv2d_5_0_texOff(float2(-1, 0)) + conv2d_0_texOff(float2(-1, 0))), float4x4(0.116533905, -0.04702717, -0.021498246, 0.028888393, -0.015240517, -0.09661296, 0.11334122, -0.06900668, -0.0006149282, 0.019744378, 0.0648034, -0.0045407997, 0.1891915, 0.111665405, 0.18197547, 0.12893237));
    result += mul((conv2d_5_0_texOff(float2(0, 0)) + conv2d_0_texOff(float2(0, 0))), float4x4(0.078334026, 0.19647937, -0.09797047, -0.14151739, -0.15460385, 0.18850033, -0.113417074, 0.28649488, -0.040615097, 0.053106878, -0.030238735, -0.10792565, 0.22462718, 0.22183172, 0.16417204, 0.27850342));
    result += mul((conv2d_5_0_texOff(float2(1, 0)) + conv2d_0_texOff(float2(1, 0))), float4x4(-0.015012697, 0.0653298, 0.023423247, 0.01139948, 0.05776562, -0.054161124, 0.036692493, -0.08657101, -0.02274633, 0.0038382143, -0.037507214, 0.056437906, 0.16947132, 0.21419731, 0.16919203, 0.25299102));
    result += mul((conv2d_5_0_texOff(float2(-1, 1)) + conv2d_0_texOff(float2(-1, 1))), float4x4(-0.017424038, -0.00915165, 0.017914575, 0.0034419717, -0.023223912, 0.0003801507, -0.04178879, 0.008838932, 0.027135517, -0.00094580697, 0.024522636, -0.010182268, 0.11034025, 0.0044447402, 0.22051464, -0.01967377));
    result += mul((conv2d_5_0_texOff(float2(0, 1)) + conv2d_0_texOff(float2(0, 1))), float4x4(-0.036809247, -0.051307622, 0.060724467, 0.049771257, 0.09627344, 0.04272271, 0.0824909, -0.059083477, -0.008901776, 0.017800098, -0.10009962, 0.062438685, 0.017689763, 0.060293496, 0.056304358, 0.20307289));
    result += mul((conv2d_5_0_texOff(float2(1, 1)) + conv2d_0_texOff(float2(1, 1))), float4x4(-0.008794147, -0.01312082, 0.00038502488, 0.041364476, 0.028236333, 0.0012214257, 0.05478907, 0.01779697, 0.0075119073, 0.0043832855, -0.006697812, -0.059315406, 0.0525951, 0.1467837, 0.07268275, 0.11348895));
    result += mul((conv2d_5_1_texOff(float2(-1, -1)) + conv2d_1_texOff(float2(-1, -1))), float4x4(-0.119056694, -0.022543164, -0.07450419, -0.06358397, -0.013935535, -0.08291655, 0.051571853, -0.0011709471, -0.015281836, 0.03828021, -0.0017588611, -0.0043239896, 0.032310136, 0.041175902, -0.01145863, 0.013321721));
    result += mul((conv2d_5_1_texOff(float2(0, -1)) + conv2d_1_texOff(float2(0, -1))), float4x4(0.051123388, -0.11470685, -0.14948519, 0.011535103, 0.016201288, 0.030134168, 0.13189004, -0.008686041, 0.024683451, -0.0671489, 0.002620998, 0.014376221, 0.011347381, -0.08293654, 0.038315274, 0.01895791));
    result += mul((conv2d_5_1_texOff(float2(1, -1)) + conv2d_1_texOff(float2(1, -1))), float4x4(-0.05877883, 0.05146613, -0.008809841, -0.00023467084, -0.057769608, 0.04823752, -0.008489099, 0.079461046, -0.047325697, 0.04071089, -0.0055320053, 0.029224226, 0.027386462, -0.03374859, 0.008449957, -0.008419715));
    result += mul((conv2d_5_1_texOff(float2(-1, 0)) + conv2d_1_texOff(float2(-1, 0))), float4x4(-0.08299477, -0.11658955, 0.016633246, -0.07978632, -0.016218217, -0.040943146, -0.03989717, -0.1088446, 0.05970957, 0.002996039, -0.0683301, 0.024432095, -0.06820922, 0.001980743, 0.028680932, 0.013430178));
    result += mul((conv2d_5_1_texOff(float2(0, 0)) + conv2d_1_texOff(float2(0, 0))), float4x4(0.18101421, 0.08282674, 0.2537264, 0.09734346, 0.07522589, -0.02970063, -0.09767425, 0.025460964, -0.035719384, 0.05559792, -0.0064279013, 0.012116881, 0.08098515, 0.0031306474, -0.062321458, 0.11275372));
    result += mul((conv2d_5_1_texOff(float2(1, 0)) + conv2d_1_texOff(float2(1, 0))), float4x4(0.044320706, 0.08824085, 0.021322772, 0.04545965, 0.01488218, 0.029095644, -0.02583268, -0.062204227, 0.0055758785, -0.04118161, 0.013441426, 0.042478185, 0.0025955855, 0.009216976, 0.023733752, -0.0064839222));
    result += mul((conv2d_5_1_texOff(float2(-1, 1)) + conv2d_1_texOff(float2(-1, 1))), float4x4(-0.057003073, -0.004948335, -0.09097062, 0.028371694, 0.0032006286, -0.010899842, -0.025544282, -0.02191108, -0.002089457, -0.021223156, 0.017774016, 0.0036114382, -0.005586188, 0.00097210985, -0.023755005, -0.0026099575));
    result += mul((conv2d_5_1_texOff(float2(0, 1)) + conv2d_1_texOff(float2(0, 1))), float4x4(0.024738748, 0.08594153, 0.044601705, -0.06618936, -0.023089156, -0.055568747, 0.12039967, 0.024573393, 0.0043138857, -0.007953558, 0.01810615, -0.05492442, -0.01816249, 0.00072908093, -0.0056789815, -0.09458923));
    result += mul((conv2d_5_1_texOff(float2(1, 1)) + conv2d_1_texOff(float2(1, 1))), float4x4(0.021939186, -0.052361235, 0.024886966, 0.033345256, -0.010785021, -0.016734328, -0.005458673, 0.07150075, 0.02636878, -0.01776455, 0.027917301, -0.065227784, -0.0111764595, -0.01318905, -0.012367057, -0.0014842706));
    result += mul((conv2d_5_2_texOff(float2(-1, -1)) + conv2d_2_texOff(float2(-1, -1))), float4x4(0.074804254, 0.06033131, 0.016498791, 0.041731995, -0.106456414, -0.08368142, -0.044149056, -0.07546344, 0.010242925, 0.05938359, -0.01986036, -0.0011787905, 0.026373222, -0.0596952, -1.2733392e-05, 0.0039422764));
    result += mul((conv2d_5_2_texOff(float2(0, -1)) + conv2d_2_texOff(float2(0, -1))), float4x4(-0.08063825, 0.03961155, 0.029571343, 0.006985256, -0.047977608, 0.018148772, 0.061661065, 0.030361924, 0.048335932, -0.06769777, 0.019014768, 0.023159457, -0.05829801, 0.089001045, 0.036387086, -0.05159357));
    result += mul((conv2d_5_2_texOff(float2(1, -1)) + conv2d_2_texOff(float2(1, -1))), float4x4(0.057754766, -0.059210554, -0.0052746534, -0.043959897, 0.029552294, 0.08530348, 0.03688788, 0.032168314, -0.0094469385, 0.010864346, 0.01230645, 0.022310263, -0.028680464, 0.023207344, -0.011531268, 0.027849229));
    result += mul((conv2d_5_2_texOff(float2(-1, 0)) + conv2d_2_texOff(float2(-1, 0))), float4x4(0.07223524, 0.13245484, 0.07575535, 0.14125241, -0.1715663, 0.014789027, -0.19799535, -0.004649109, -0.03699584, 0.018164005, -0.027667418, 0.072988145, 0.05391259, -0.041023277, 0.041897837, -0.08607979));
    result += mul((conv2d_5_2_texOff(float2(0, 0)) + conv2d_2_texOff(float2(0, 0))), float4x4(-0.05315216, -0.25991043, -0.37482148, -0.32810336, -0.29032516, -0.30709293, -0.21782005, -0.20594645, 0.021311514, -0.025801908, -0.043757193, -0.07257415, -0.0010787555, -0.045824338, -0.021387875, 0.046834607));
    result += mul((conv2d_5_2_texOff(float2(1, 0)) + conv2d_2_texOff(float2(1, 0))), float4x4(-0.11915308, 0.009884257, -0.07266224, -0.04405168, 0.41715345, 0.10101372, 0.39315835, 0.14680335, -0.020571468, -0.020652635, 0.003565338, 0.020705333, -0.01608967, -0.0052673128, 0.0129209785, 0.060481094));
    result += mul((conv2d_5_2_texOff(float2(-1, 1)) + conv2d_2_texOff(float2(-1, 1))), float4x4(0.048600942, 0.016006557, 0.14600487, 0.014943065, -0.07351269, 0.026039096, -0.14686914, 0.031768322, -0.021506123, -0.0082435515, -0.0040315725, 0.017048223, -0.011135416, 0.016046643, -0.022291226, -0.005355941));
    result += mul((conv2d_5_2_texOff(float2(0, 1)) + conv2d_2_texOff(float2(0, 1))), float4x4(0.03020737, -0.030928615, 0.15132327, 0.054301504, 0.14437142, 0.048576567, -0.04388744, -0.094516754, 0.0032813493, 0.06886138, 0.05706457, -0.10108691, 0.044117074, -0.011357271, -0.042508494, -0.031500865));
    result += mul((conv2d_5_2_texOff(float2(1, 1)) + conv2d_2_texOff(float2(1, 1))), float4x4(0.0013166928, 0.05283264, 0.014012323, 0.02144442, 0.07815758, 0.09807069, 0.13815966, 0.12761182, -0.008528952, -0.014925581, -0.00018464374, 0.021329591, -0.0041841166, 0.03558159, 0.0067771603, 0.031306233));
    result += mul((conv2d_5_3_texOff(float2(-1, -1)) + conv2d_3_texOff(float2(-1, -1))), float4x4(-0.036467843, 0.010628504, -0.040554672, -0.023031462, -0.011656816, 0.006664601, 0.000715375, -0.010816698, 0.015964195, 0.0095756985, 0.03210252, 0.013730381, -0.1255846, -0.084750146, -0.023893569, -0.0702104));
    result += mul((conv2d_5_3_texOff(float2(0, -1)) + conv2d_3_texOff(float2(0, -1))), float4x4(0.019619642, -0.07239796, 0.035521567, 0.01588479, 0.016895607, 0.008017878, -0.036764413, -0.0042051054, -0.039567553, -0.08192329, -0.06659581, -0.04689488, -0.03690489, -0.09902329, 0.019497482, 0.034434214));
    result += mul((conv2d_5_3_texOff(float2(1, -1)) + conv2d_3_texOff(float2(1, -1))), float4x4(-0.041379284, 0.028434373, -0.0035548816, 0.03592885, -0.058836915, 0.050493628, -0.019974556, 0.024676299, 0.017982803, 0.057563495, 0.031644262, 0.038482025, -0.062204078, -0.086202905, -0.061478227, -0.046549007));
    result += mul((conv2d_5_3_texOff(float2(-1, 0)) + conv2d_3_texOff(float2(-1, 0))), float4x4(-0.04963836, -0.06786509, 0.053083368, -0.016658006, -0.024077818, 0.015105817, -0.022783222, 0.056628447, 0.054782975, -0.005399698, 0.06518826, 0.0675087, -0.074367136, 0.008979149, -0.087080844, 0.030584648));
    result += mul((conv2d_5_3_texOff(float2(0, 0)) + conv2d_3_texOff(float2(0, 0))), float4x4(0.16213058, 0.23299363, -0.17941494, -0.06208164, 0.10239591, -0.1624446, 0.09645079, -0.07228728, -0.6013088, -0.4676209, -0.4437887, -0.40659645, 0.44956166, 0.37416172, 0.43596986, 0.30689433));
    result += mul((conv2d_5_3_texOff(float2(1, 0)) + conv2d_3_texOff(float2(1, 0))), float4x4(0.016807944, -0.012888657, 0.04107212, -0.009010495, -0.042227447, 0.09315279, -0.077015266, 0.032527108, 0.0949948, 0.024671922, 0.04591782, 0.05770263, -0.15444109, -0.1973537, -0.14419502, -0.22791274));
    result += mul((conv2d_5_3_texOff(float2(-1, 1)) + conv2d_3_texOff(float2(-1, 1))), float4x4(-0.011289618, -0.006634459, -0.03459251, -0.0040621534, -0.02159817, 0.01215381, -0.014932253, 0.014672571, 0.07710989, 0.047235463, 0.2077591, 0.05189555, -0.05911496, 0.025979709, -0.08420764, 0.033720285));
    result += mul((conv2d_5_3_texOff(float2(0, 1)) + conv2d_3_texOff(float2(0, 1))), float4x4(-0.016286368, -0.032828875, 0.06081085, 0.013333209, 0.032717485, -0.009975731, 0.06256336, -0.07011423, 0.18836606, 0.19341387, 0.041098244, 0.17084116, 0.1576518, 0.051604636, 0.08421867, -0.038016967));
    result += mul((conv2d_5_3_texOff(float2(1, 1)) + conv2d_3_texOff(float2(1, 1))), float4x4(0.0031298443, -0.019852508, 0.0062795323, 0.0041221846, -0.004355593, -0.0068010245, -0.0009176121, 0.04547178, 0.078382626, 0.16177154, 0.114449784, 0.14651902, -0.028394928, -0.027341096, -0.037729453, -0.05235737));
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
