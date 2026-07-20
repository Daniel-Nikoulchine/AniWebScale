// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/acnet/acnet_f8b4.glsl:201
// Pass: 007 - ACNet F8B4 body block 3 conv 8x8x3x3 part 1
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

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(0.59952796, -1.332462, 0.41457593, -1.6842588);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.02599031, 0.11397474, -0.0911664, -0.01167286, -0.0036644426, -0.018692713, 0.15938945, -0.16122153, -0.012750446, -0.09042838, 0.11477806, 0.02129849, 0.119132176, -0.094767496, -0.019555489, 0.10296438));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.075731166, 0.16514349, 0.011046047, -0.02227161, 0.02482744, -0.052128017, 0.27191204, -0.19601719, 0.059816092, -0.23367599, 0.22755021, 0.055511486, -0.29724222, 0.24978714, -0.17433569, -0.24515773));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.031358883, 0.060264055, -0.15064982, 0.029957652, 0.010593553, -0.016625015, 0.041589867, -0.024499627, 0.0007811688, -0.06294979, 0.13854133, -0.1467292, 0.04875214, -0.02879229, -0.1125328, 0.09174388));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.004707365, 0.060747832, -0.004238711, 0.06810967, 0.06574489, -0.02197832, 0.03866628, -0.46303895, -0.05857398, -0.17492771, 0.14608337, -0.08400064, -0.019356212, 0.2547515, -0.028353786, -0.20715272));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(-0.22376226, 0.09209538, -0.08907081, 0.76712304, -0.02831321, -0.12171658, -0.16587923, -0.23358676, 0.0014283106, 0.02920373, 0.42138734, -0.93988985, 0.4686656, 0.12557228, 0.3139715, -0.28777897));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.024229074, 0.071428664, -0.04280703, -0.014356928, -0.08551193, 0.033536397, -0.018220497, -0.04883166, -0.0131406905, -0.13030331, 0.25262868, -0.20413445, -0.29182473, 0.09187002, 0.09670171, 0.13499115));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.01017856, 0.12921087, 0.021015612, -0.08343678, 0.08444745, -0.017564012, -0.13593334, -0.052664038, -0.007485556, -0.25228363, -0.033417333, -0.008400632, -0.022814307, -0.061608333, -0.035869576, 0.0555486));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.029356273, -0.034417294, -0.08020153, -0.01682129, 0.035101935, 0.03653076, -0.10076349, 0.07875832, -0.1827561, -0.29881117, -0.10212521, -0.11972271, -0.012628133, 0.0119647, 0.04157079, -0.10206362));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.05987312, 0.13572101, -0.05162944, -0.13265811, 0.009954476, 0.042441126, -0.108831346, 0.11149274, 0.025409276, -0.17671798, -0.044314146, -0.24985059, 0.13445614, -0.069892794, 0.0012333727, 0.1879037));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.03441497, 0.006152541, 0.037667032, -0.119329594, 0.09475383, -0.17006452, -0.08898779, 0.1469576, -0.1439049, 0.11420989, 0.013124849, -0.11725137, 0.011430186, 0.010156032, -0.021265378, -0.024144052));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.061515715, 0.17053343, 0.06678555, -0.3419312, -0.08026428, -0.39686, -0.21622784, 0.24146296, -0.018667502, -0.0039543607, 0.040460024, -0.10787442, -0.044258125, 0.06659542, -0.04691291, 0.002244747));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.20518494, 0.018661184, -0.14863887, 0.17540899, 0.20488891, -0.19261509, 0.1252979, -0.0085537955, -0.03574861, 0.04135265, -0.06362474, -0.073660254, 0.03503325, 0.003304293, -0.0943097, 0.065633595));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.2230036, -0.07287397, -0.01627073, -0.095243916, -0.05021121, -0.019723898, 0.013842747, -0.16361026, -0.08912069, 0.09061948, 0.018698294, -0.044821434, 0.033196468, -0.062144883, 0.0011960022, 0.0495531));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.10186994, -0.17740336, -0.31164697, 0.002453116, 0.5770425, -0.85333276, 0.3455174, -0.4084528, -0.10607126, -0.090429425, 0.068843305, -0.39207038, 0.19238988, -0.26042327, 0.012700916, 0.26043946));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.10795559, 0.20856035, 0.06260871, 0.15726665, 0.03700463, -0.40013382, 0.33148572, 0.058492754, -0.2486084, 0.09142087, 0.04861159, -0.07845479, 0.11370855, -0.05933613, 0.06327714, 0.0049282075));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.07631093, 0.03446747, -0.061127234, -0.03173424, -0.06328771, -0.15022877, -0.029710256, -0.027528882, -0.049285866, 0.070123166, -0.077641845, 0.008700285, -0.013692134, -0.03682978, 0.0010649372, -0.00843551));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.14176877, 0.09281144, 0.090035625, 0.097501196, 0.016678369, -0.056643814, 0.13301311, -0.4939209, -0.07750668, 0.073391065, -0.15078288, 0.08537754, 0.26832387, 0.044219498, 0.079322174, -0.51499516));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.009433097, 0.032734275, -0.021258276, 0.011741819, 0.1910253, -0.21163319, 0.0953697, -0.18071541, 0.04723409, -0.010119149, -0.036632303, 0.042671878, 0.2127712, -0.16136082, 0.2357739, -0.07581483));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(-1.7692254, 0.9895219, 0.068637624, 0.2559022) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
