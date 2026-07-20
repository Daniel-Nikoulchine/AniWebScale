// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:265
// Pass: 009 - ARNet F8B8 body block 1 conv 1 8x8x3x3 part 1
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
    float4 result = float4(0.15253818, 0.24284467, -0.18576457, 0.047749735);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.18641983, -0.19430996, -0.063612446, 0.06627891, -0.092144385, 0.02054596, 0.023804948, 0.14526352, -0.26174527, 0.034329873, 0.07506096, 0.1436645, 0.091078244, -0.10037898, -0.5573592, -0.073007636));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.17442521, -0.29078364, 0.23300256, 0.050431546, 0.05682466, 0.3809086, 0.042998556, 0.23172633, 0.08900659, 0.17755334, 0.159718, 0.042443592, 0.40711194, -0.13794556, -0.43366385, 0.011830141));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.015326671, 0.18015666, 0.16698405, -0.11025788, 0.100561276, 0.017195152, -0.0055776965, -0.0014456309, -0.1454466, 0.07114568, 0.09036044, 0.012794496, 0.1094855, 0.029146966, -0.06635037, -0.03327731));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.4222749, -0.43122426, 0.66165507, 0.5927874, 0.07859675, -0.014224318, 0.23086841, -0.031166865, 0.09162616, 0.23667662, 0.6176867, 0.013435521, -0.17965122, -0.4837124, -0.0046200454, -0.21643485));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.31790936, -0.08890887, -0.21486758, 0.489482, -0.13267486, 0.0872362, 0.45536622, -0.612992, -0.16422638, -0.21940081, 0.20004389, 0.20160012, -0.0668781, -0.034714267, 0.27310607, 0.013709518));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.19481403, 0.19629848, 0.21000497, 0.043319408, -0.076148935, -0.25748822, -0.38448972, 0.031928934, -0.036018435, 0.16142212, 0.19994041, -0.045916956, 0.12485173, -0.14184055, -0.2059985, -0.02237541));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.2505644, -0.2052385, -0.0012132926, -0.07755673, 0.18242128, -0.04221162, 0.14505953, -0.07168238, -0.18709195, 0.027741864, 0.0667353, 0.31995866, 0.071253814, -0.058650203, -0.26053345, -0.0022726117));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.113538995, -0.4236697, 0.03570613, 0.03189377, -0.52151966, -0.7705857, -0.25777328, -0.20042703, -0.2054525, -0.042563327, 0.13021083, 0.21537519, 0.06836173, -0.022534583, -0.41695535, -0.11821871));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.022503264, 0.1668832, 0.09483512, -0.017726284, 0.06990739, 0.26490632, -0.04870431, -0.15685488, -0.069223784, 0.09537891, 0.24178939, 0.05132989, -0.07874243, -0.08138674, -0.042626377, -0.05597736));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.23957619, 0.077737756, 0.16991378, 0.20978636, -0.011029298, -0.09765244, 0.13435774, 0.140879, 0.22739877, -0.04980661, 0.26467082, -0.2670186, -0.13532391, 0.22586493, 0.18677133, 0.104086824));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.21195799, 0.02518823, 0.023518512, 0.3897102, -0.093482345, -0.20780256, 0.5969437, 0.145951, 0.04280334, -0.20680116, 0.0731039, -0.13323548, -0.5881994, 0.017745517, -0.009713419, 0.20517781));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.21826625, 0.109964035, 0.27282867, 0.0908871, 0.07484174, -0.0728018, -0.094898894, -0.18285932, 0.073249266, -0.064869724, -0.014765224, 0.018187903, 0.272575, 0.16650225, 0.20043422, 0.052988444));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.0076958095, 0.24525368, 0.036544546, 0.14864121, -0.18294904, -0.14633088, -0.064184844, -0.09356546, -0.18631467, 0.37618527, -0.25027248, -0.023804484, 0.1089493, 0.12542047, -0.036459755, -0.02849269));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.27234924, -0.03513115, 0.75627077, -0.039296404, -0.20348518, 0.06116075, -0.06920514, 0.34285215, -0.22554791, -0.2180932, 0.3309299, -0.4202916, -0.109903045, -0.5524882, 0.34847042, 0.09569149));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.16325144, 0.21680611, 0.2761086, 0.21714337, 0.14557368, -0.07222906, 0.08461924, -0.03457472, -0.12170067, 0.0055174744, 0.2666781, 0.11437208, 0.0039874376, -0.38150346, -0.23031263, -0.09376226));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(-0.06944354, -0.036729332, 0.095137805, 0.029371, -0.059183743, 0.006102384, 0.12847836, -0.056834973, 0.049761437, 0.083426565, 0.2520165, -0.002934371, 0.09412298, -0.06724788, -0.03502154, 0.16035374));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.18025592, 0.1700737, 0.16943398, 0.19025867, 0.120299965, 0.14593993, 0.25092554, 0.13524207, 0.18832944, 0.18941003, 0.019728038, 0.03794575, -0.02846275, -0.2431387, -0.111155905, -0.15390766));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.14349066, -0.24796711, 0.12416158, -0.012895591, 0.1489958, -0.12136145, 0.018677833, 0.04126077, -0.069082685, -0.111068144, 0.11579644, -0.07636224, -0.1739954, -0.16916104, 0.13184744, -0.07094822));
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
