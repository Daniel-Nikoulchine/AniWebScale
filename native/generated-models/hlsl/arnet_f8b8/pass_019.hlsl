// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:585
// Pass: 019 - ARNet F8B8 body block 4 conv 0 8x8x3x3 part 1
// ACNetGLSL is Copyright (c) 2020 TianZer, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[2];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
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

#define TMP2_TEX_0_tex(position) Anime4KSample0(position)
#define TMP2_TEX_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define TMP2_TEX_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define TMP2_TEX_0_pos anime4k_pos
#define TMP2_TEX_0_size float2(Anime4KInputSizes[0].xy)
#define TMP2_TEX_0_pt rcp(TMP2_TEX_0_size)
#define TMP2_TEX_1_tex(position) Anime4KSample1(position)
#define TMP2_TEX_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define TMP2_TEX_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define TMP2_TEX_1_pos anime4k_pos
#define TMP2_TEX_1_size float2(Anime4KInputSizes[1].xy)
#define TMP2_TEX_1_pt rcp(TMP2_TEX_1_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-1.7227485, 1.308866, 0.046827376, -0.62688637);
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.49514994, -0.016724922, 0.20806465, -0.22687553, -0.8188593, -0.056437537, 0.84664947, 0.021180362, -0.7231453, -0.099173315, 0.69269156, -0.16482836, -0.7275412, 0.066029005, 0.16465507, 0.070765205));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.9856656, 0.33987308, -0.8462334, 0.08593061, -1.2092804, 0.21844782, -1.3262385, 0.8499209, -1.6892749, 0.08631562, -1.3840272, 0.8307477, -0.38677847, 0.11647972, -0.7433213, 0.23191829));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.7764532, -0.21439743, 0.09282412, 0.61277914, 1.0054616, 0.23388848, -0.051005445, -0.13818617, 0.47164202, -0.10190629, 0.7790633, -0.35350484, -0.35247022, -0.09193034, 0.9922878, 0.12813272));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.32109478, -0.011991363, -0.18764085, 0.42928755, 0.8140293, -0.103186294, -2.5471172, -0.34138054, -0.6074414, 0.049937975, -1.7937083, -0.27748993, -1.6948411, 0.20458765, -1.6807266, -0.41243583));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(-0.0024300532, -0.95213115, -0.11587783, -0.4944695, 2.8161583, -0.9027602, 1.3298562, 0.89431065, 1.1170177, -0.3772181, 2.6761167, 1.2464354, 4.2856607, -0.42357767, 3.0833457, 0.49405116));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 0.0)), float4x4(1.3775243, -0.68547446, 1.2256656, -0.032617874, -1.439116, -0.11093871, 0.11039478, -0.39239055, -0.13344264, 0.8241325, 0.20109162, -0.20404424, 1.5303952, -0.08964352, 0.53362346, 0.9662748));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.3994487, 0.040780235, 0.21263246, 0.019376006, -0.06470558, 0.17041704, -0.20740438, 0.023573535, -0.17722748, -0.06517646, 0.4772345, 0.2475534, -1.0947971, -0.04845009, 1.3486072, 0.11651401));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.67505866, 0.1807937, 0.4552026, 0.039264698, 0.19045725, -0.9178668, 0.3116859, 0.2961344, -0.78602874, -0.17356826, -1.5032674, -0.15658417, -1.2791686, -0.08273534, -1.9664185, -0.45129263));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.32721752, -0.3868042, -0.17631887, -0.2405315, -0.18972531, 0.12755224, 0.62266964, 0.41736028, 0.10998941, 0.46064728, -0.2528864, -0.47662023, -1.1078695, -0.24957563, -0.6260772, -0.78889656));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.39212337, 0.07939941, -0.17650826, -0.19477655, 1.4521992, -0.22319864, 0.43312177, 0.9331794, 0.12389329, 0.035953604, -0.18394701, -0.008334236, 1.0821514, 0.13840553, -0.5491411, -0.10647242));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.815979, -0.045439955, -1.276241, 0.006938683, 0.64476633, -0.0727728, -1.08996, 0.09516541, -0.27113685, -0.043741282, 0.97910523, -0.20326914, -0.07372359, 0.03871976, 0.38350338, 0.27590796));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.34693143, 0.105463766, 0.63535374, -0.029996088, -0.3553194, -0.17929427, 1.2144432, 0.8151054, -0.028691856, -0.13921164, 0.14378095, 0.24233338, 0.6933569, -0.1621716, 0.50248307, -0.91135657));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.58180547, 0.009849507, -0.024130132, 0.009279006, 1.3148531, -0.52787673, 2.1115959, 0.3318982, -1.7825406, 0.1277524, 0.6708522, -0.06202314, 3.5314827, 0.21910283, -0.5804615, -0.4215106));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.18818092, 0.2070929, 1.9019171, 0.28148076, -1.2723023, -0.3141024, -0.8578068, -0.30495152, 4.588941, -0.40868846, 0.47295064, 0.2432477, -5.8132653, -0.42055956, 0.2544641, 1.2218305));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-1.3040853, 0.23129398, -0.5614524, 0.6020893, -0.13707411, -0.8722554, -0.97577703, 0.5785315, -0.27197877, 0.020996029, -0.15133917, 0.33295712, 2.061739, 0.49682555, -0.21694955, 0.07150975));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.002080322, 0.015071774, -0.5924941, -0.5777128, -0.0041777543, -0.38808268, -0.18624489, 0.11553577, -0.10971532, 0.12373906, 0.58028895, 0.064580716, 0.8934691, 0.10114295, 1.0162618, -0.4444369));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.7687418, -0.74336064, -0.056719333, -0.060556527, 0.40434855, 0.055857707, -0.6865873, -0.28476322, -2.1839015, -0.28306764, 1.4458725, -0.33928835, 2.7540615, -0.61374986, 0.7337671, -0.0020792936));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 1.0)), float4x4(0.17179541, -0.3413513, 0.4216811, 0.17532718, -0.8787417, -0.3500741, 0.24778494, 0.36028925, 1.0013047, -0.08386845, -0.11287405, -0.58022195, -1.318199, 0.37721786, 0.22098032, -0.23364711));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(-0.14197208, -0.61836195, -0.25982052, -0.31227913) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
