// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:1001
// Pass: 032 - ARNet F8B8 body block 7 conv 1 8x8x3x3 part 0
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
#define TMP2_TEX_0_tex(position) Anime4KSample2(position)
#define TMP2_TEX_0_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define TMP2_TEX_0_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define TMP2_TEX_0_pos anime4k_pos
#define TMP2_TEX_0_size float2(Anime4KInputSizes[2].xy)
#define TMP2_TEX_0_pt rcp(TMP2_TEX_0_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.047070026, 1.195001, 0.07387606, -0.7828713);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.038693223, 0.21985376, 0.02913513, 0.1555042, 0.0021557573, 0.030480856, 0.090688534, -0.15524027, -0.0056368946, -0.091415346, -0.032069, 0.0035087136, 0.024450593, -0.04252897, 0.043064445, -0.097747356));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.026539167, 0.22152738, -0.010931147, -0.07416453, -0.12239344, 0.6110942, 0.30141714, -0.28894857, -0.006634308, -0.111417286, 0.07795535, -0.10530723, -0.13713972, 0.08794643, 0.0041791354, 0.20494293));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.077271596, -0.09995992, -0.06418836, -0.0019287291, 0.011806807, 0.20325828, 0.08301918, -0.017283902, 0.005275964, -0.080887474, -0.024201375, 0.11833581, 0.049872696, 0.04077933, -0.0355666, -0.036595937));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.18876822, 0.09925072, -0.21488969, 0.7558808, 0.06508291, -0.01759295, 0.09720833, -0.19307941, 0.04533092, -0.029046794, 0.006427155, -0.076267675, -0.061632168, -0.14321032, 0.15913913, -0.21030621));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.17392196, 0.10548056, 0.05413704, 0.44587874, 0.045728866, 0.36171573, 0.73960346, -0.058104962, -0.054573324, -0.14604907, 0.06858662, -0.11428874, -0.45069227, 0.3831972, -0.32628053, 0.5374824));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.06107323, -0.107961014, 0.06258701, 0.025275588, 0.051019747, 0.4373209, 0.29457092, -0.14565094, 0.0046962355, -0.20439047, -0.037100766, -0.13954975, 0.087588295, -0.121541746, -0.18504706, -0.04803068));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.01816938, 0.09579099, -0.0087386025, 0.08981112, -0.029045124, 0.15492752, 0.10366436, 0.07108681, 0.022725731, -0.3644878, -0.04954392, -0.20480417, 0.27507102, -0.180055, -0.47909597, -0.22187628));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.02593311, 0.00344362, -0.11543688, -0.0014957098, -0.004881429, -0.1422296, -0.13061951, 0.04969833, 0.34130293, 0.07292374, -0.3412711, -0.95301235, 0.188841, 0.05420798, -0.27254778, 0.2881596));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.05771587, 0.004306378, 0.038402915, 0.045360062, 0.01748327, -0.058658678, -0.07643522, 0.06863852, -0.49433744, 0.5425999, 0.07313538, 0.3119444, 0.17854075, -0.08416802, -0.26492038, -0.08476122));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.08696078, 0.0548185, -0.014013148, -0.012970064, -0.08692779, 0.06578701, -0.08191811, 0.050719045, 0.017666752, -0.08657221, 0.0041807466, 0.0043145306, 0.044976838, -0.13649283, 0.00051737035, -0.12710154));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.029152516, -0.028695613, -0.24599251, 0.12715699, -0.05224291, 0.11914063, -0.017196186, 0.11345078, 0.023879543, -0.04643665, -0.113571614, 0.07923887, -0.17858657, -0.17595762, 0.08952453, -0.29237792));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.09183968, -0.022085944, -0.035745323, -0.12619533, 0.022079598, -0.06258953, -0.11038084, 0.0410516, 0.044408392, 0.02505678, -0.03142864, -0.04180281, 0.019962987, 0.14202246, 0.13591653, -0.038355608));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.0006581642, 0.46659365, -0.12972976, 0.49501348, -0.26645744, 0.43158492, 0.46293172, -0.28970322, -0.04409256, -0.1168898, 0.20096412, -0.24738707, 0.021745194, -0.34456968, -0.09745817, -0.012993204));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.020990826, 0.29607937, -0.07930345, 0.64932936, -0.04788038, 0.11356329, -0.27861783, 0.017411597, -0.04579226, -0.007032639, 0.08710322, 0.15953955, -0.04856825, 1.3541816, -0.09648034, 0.6161122));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(0.12772992, -0.31268668, -0.055771776, 0.06581244, -0.0025546947, -0.023126716, -0.028417472, -0.064521, 0.024457397, -0.017065177, -0.04763924, -0.07316073, -0.0020161716, -0.1997028, -0.16404608, -0.0878938));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(-0.107444935, -0.03924517, 0.13641126, -0.018856158, -0.097503036, -0.08547922, 0.20254539, 0.16192381, 0.06824662, -0.15847917, -0.11508538, -0.038607027, -0.030726044, -0.057238903, 0.088835746, -0.16048494));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(-0.09749135, -0.22153652, -0.062212244, 0.08194851, -0.08134922, -0.10779647, -0.08064135, -0.089851096, -0.11247216, -0.25401288, -0.007913719, 0.1594704, -0.14726539, -0.034841023, 0.13205332, -0.011736729));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.049271002, 0.066454336, 0.055026084, -0.07032379, -0.004685281, -0.011475832, -0.023246765, 0.032690603, -0.010499677, -0.033619806, -0.16327965, 0.021631554, -0.057421636, 0.0004117528, 0.0066794087, -0.07700015));
    result = result * 0.2 + TMP2_TEX_0_texOff(float2(0.0, 0.0));
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
