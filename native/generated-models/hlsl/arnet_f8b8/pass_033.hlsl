// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:1033
// Pass: 033 - ARNet F8B8 body block 7 conv 1 8x8x3x3 part 1
// ACNetGLSL is Copyright (c) 2020 TianZer, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[3];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
Texture2D<float4> Anime4KInput2 : register(t2);
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

#define TMP1_TEX_0_tex(position) Anime4KSample0(position)
#define TMP1_TEX_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define TMP1_TEX_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define TMP1_TEX_0_pos anime4k_pos
#define TMP1_TEX_0_size float2(Anime4KInputSizes[0].xy)
#define TMP1_TEX_0_pt rcp(TMP1_TEX_0_size)
#define TMP1_TEX_1_tex(position) Anime4KSample1(position)
#define TMP1_TEX_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define TMP1_TEX_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define TMP1_TEX_1_pos anime4k_pos
#define TMP1_TEX_1_size float2(Anime4KInputSizes[1].xy)
#define TMP1_TEX_1_pt rcp(TMP1_TEX_1_size)
#define TMP2_TEX_1_tex(position) Anime4KSample2(position)
#define TMP2_TEX_1_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define TMP2_TEX_1_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define TMP2_TEX_1_pos anime4k_pos
#define TMP2_TEX_1_size float2(Anime4KInputSizes[2].xy)
#define TMP2_TEX_1_pt rcp(TMP2_TEX_1_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.5572383, -0.10480477, 0.13446908, -0.27021736);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(0.049673785, 0.06875035, -0.07331412, -0.10512457, -0.015892949, 0.01899517, -0.059461944, -0.032884117, 0.017725594, -0.0071224407, -0.037924275, 0.012155415, 0.031852186, 0.012381152, 0.015455965, 0.05158613));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.26602378, -0.029193576, 0.19617452, 0.037565026, 0.10784182, 0.13469447, -0.2702927, 0.0019474522, -0.0014547625, 0.08714448, -0.091478005, 0.110722266, -0.26283655, 0.020825412, -0.26668078, -0.004833008));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.0056068916, -0.002874118, 0.11970506, 0.013797177, 0.12636712, 0.09267033, 0.113550425, 0.0816348, 0.056914907, -0.014624845, -0.027192237, -0.058770187, 0.11393519, -0.025511744, 0.15608461, 0.011195211));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.19283405, 0.08198978, -0.1540468, -0.105671875, -0.18083753, -0.07461475, 0.24369732, 0.038048066, 0.1935195, -0.052982125, 0.03254073, -0.041183755, 0.05754727, -0.08041072, -0.11964145, 0.007004645));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.2871308, 0.39865398, 0.8546103, 0.23101205, 0.15937212, -0.24191828, 0.019459685, 0.08387731, 0.3840813, -0.18642846, 0.056941845, 0.095157236, -0.5921639, -0.33950776, 0.14934956, 0.1947915));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.115472496, 0.036756355, 0.011543486, -0.031149996, 0.32337314, 0.23651208, 0.16744003, 0.10073366, -0.30210677, 0.014919476, -0.33355793, -0.066712946, -0.2892317, -0.0022710296, 0.33679932, 0.21109718));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.3120666, -0.10715174, 0.093873024, -0.070548534, 0.025706312, 0.038650703, -0.01133868, -0.0068081436, -0.123441316, 0.0048767957, -0.10921592, 0.0524382, -0.8361068, -0.16814795, 0.56365997, 0.19851689));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.32284054, 0.17118849, -0.16794911, 0.003906254, -0.14411409, 0.06579166, -0.014748773, 0.029153619, 0.07908217, -0.5730708, 0.0936183, -0.2831636, -1.1329355, -0.28024274, 1.0987042, 0.047931615));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.1250692, 0.1958615, -0.08734565, 0.00846378, -0.078625984, 0.014831741, 0.026224654, 0.0031503893, -0.08191805, 0.47656447, -0.46847755, -0.26547286, -0.42380503, -0.03942941, 0.6052593, 0.26432604));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.07266265, 0.052821748, -0.18022506, 0.065603994, -0.06710116, -0.18356945, -0.06489012, -0.07583269, -0.059138343, 0.04463405, 0.0025031802, 0.033356197, -0.0026832882, 0.081678055, -0.04468426, 0.033631377));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.10657963, -0.15169469, 0.09349157, -0.09603833, -0.13602717, 0.008095473, -0.0363266, -0.027258629, 0.2176672, -0.19936934, 0.08503335, -0.060249656, 0.24450949, 0.008050259, -0.33073884, 0.055981185));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.22829957, -0.017018327, 0.10627633, -0.03985725, -0.17567563, -0.058839746, 0.11815658, 0.033735275, 0.09389474, -0.051586736, 0.10338475, 0.014596095, 0.16419132, 0.1575383, -0.043850638, -0.08827594));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.17910707, -0.02210116, 0.29639575, -0.05344516, 0.46297118, 0.17713746, 0.47063944, 0.40926963, 0.24827865, 0.1120193, -0.30538458, 0.045413747, -0.08139617, -0.076647095, -0.16507281, -0.1207422));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.51209366, 0.69015384, 0.7361858, 0.30045062, -0.45706502, -0.1280305, 0.19617654, 0.05836123, -0.1470426, 0.057391267, -0.23627512, -0.13546593, -0.22956447, -0.01876571, -0.20516475, 0.17736913));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(0.40078926, 0.031139433, 0.2222247, -0.14357945, -0.27241543, 0.09127246, 0.1525286, 0.13997808, -0.10552371, 0.030433835, 0.012051612, 0.09629871, -0.14571145, 0.0044869604, -0.0044784835, 0.039620604));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.16722699, 0.0690874, -0.20103738, 0.019333955, -0.06610127, 0.047364395, -0.1551452, -0.06855427, -0.09945402, -0.14638335, -0.053607915, -0.0032956707, 0.035105787, 0.0019838745, -0.11861559, 0.0099876905));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(-0.0264467, 0.163197, -0.32206762, -0.0037888105, -0.043560658, 0.009223917, 0.027042057, 0.016246181, -0.478952, -0.08583142, 0.17600545, -0.4891703, 0.05374813, 0.16733351, -0.16010693, 0.009980589));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(0.013348935, 0.117738746, -0.19467694, -0.0033763507, -0.09942671, -0.012213973, 0.013913113, -0.016893014, -0.20919886, 0.033233635, 0.06294314, 0.051921926, -0.20933597, 0.20500748, 0.043373447, 0.10781299));
    result = result * 0.2 + TMP2_TEX_1_texOff(float2(0.0, 0.0));
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
