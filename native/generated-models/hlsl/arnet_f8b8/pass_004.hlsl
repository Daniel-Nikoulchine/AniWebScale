// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:105
// Pass: 004 - ARNet F8B8 body block 0 conv 1 8x8x3x3 part 0
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

#define FEAT_TEX_0_tex(position) Anime4KSample2(position)
#define FEAT_TEX_0_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define FEAT_TEX_0_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define FEAT_TEX_0_pos anime4k_pos
#define FEAT_TEX_0_size float2(Anime4KInputSizes[2].xy)
#define FEAT_TEX_0_pt rcp(FEAT_TEX_0_size)
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
    float4 result = float4(-0.3357085, -0.117609255, -0.30919075, -0.026203688);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(0.08153613, 0.1861714, -0.25500038, -0.5190988, 0.017933896, -0.1777432, 0.31277832, 0.22045173, -0.12718329, 0.026776733, 0.002861816, -0.08533778, -0.04404682, -0.06407838, -0.06481913, -0.031257067));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.1383184, -0.07331644, 0.14001016, 0.23995331, 0.08291096, -0.2527318, 0.2364966, 0.29793346, 0.02042697, -0.003937739, -0.22389743, -0.066787824, -0.13303256, -0.23078735, -0.040901013, 0.014300573));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.009811284, 0.09612057, -0.16139139, 0.08130332, -0.041684307, -0.05122252, -0.18697803, 0.07072637, 0.01883817, -0.2361833, 0.21792361, 0.02397209, -0.014967192, -0.023596333, 0.04945084, 0.043488283));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.010278466, 0.14580388, -0.32193568, 0.033388156, -0.6984458, -0.10279278, 0.5013157, 0.15549377, 0.0039003354, 0.36133248, -0.1691422, -0.044152983, 0.37049538, -0.21977746, -0.362408, -0.014369943));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.5370679, -0.12269145, -0.59856755, 0.31968418, -0.2935156, -0.38176358, 0.04503812, 0.3476054, 0.8305748, 0.37106648, -0.06428572, -0.33821693, -0.697644, -0.28802383, 0.06891653, -0.1232215));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.026034823, 0.25665063, -0.16643572, 0.35817528, -0.07739573, -0.05696662, -0.10227212, 0.0039130566, 0.178269, -0.175871, 0.17976992, 0.04847703, -0.12871501, -0.030244445, -0.04195644, 0.12512575));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.040731654, -0.15061453, 0.28536716, -0.03110417, -0.1784603, 0.103824295, 0.43872687, -0.023115022, -0.049162865, 0.19520925, 0.05125368, -0.060520098, 0.14673123, 0.15204385, -0.5093655, -0.029394517));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.3468633, -0.19365734, 0.2786975, 0.20723566, 0.042853147, 0.058367424, 0.31928933, -0.0058702896, -0.007474062, -0.090988554, 0.26656893, 0.053391397, -0.69619906, -0.36776468, 0.73106277, -0.16122182));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.0023213022, 0.29776767, 0.21362042, -0.022437306, -0.013865663, 0.05186238, 0.10191641, 0.012682519, 0.15718399, 0.107380785, 0.26649314, -0.15893917, -0.16344155, 0.16697067, 0.26059183, -0.004449103));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.12123021, 0.21355288, -0.09383824, -0.01834498, -0.048363827, -0.04568078, -0.3370775, -0.03726145, 0.06127823, -0.036528155, 0.071743816, 0.10722107, -0.10146736, -0.10578065, 0.1799259, 0.2403749));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.1724706, -0.068423696, 0.114377655, -0.028996725, -0.134503, 0.024624605, -0.16421743, 0.038487963, 0.16893964, 0.091941915, 0.11495254, 0.1328144, 0.13849229, 0.07830986, 0.13421305, -0.11566757));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.05173039, -0.0020745164, 0.05051426, -0.0915226, 0.25684664, 0.023947002, -0.011073075, -0.12254833, 0.065339215, 0.091262035, -0.11462032, 0.012205776, -0.058794502, 0.16762556, 0.01310208, -0.1867559));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.5044061, -0.054923825, -0.29648653, 0.11467426, 0.53542906, 0.72992384, -0.67623556, -0.1509643, -0.3230267, -0.00024201119, 0.36434165, 0.02639632, -0.20811598, -0.3085282, 0.3039447, 0.3310355));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.55265206, 0.353824, -0.20923679, -0.04752677, 0.119037405, -0.24245803, -0.42469934, 0.50562334, 0.026775295, -0.5801513, 0.5943054, 0.45780256, 1.1258022, 0.53527987, 0.010398371, -0.036077444));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.09117763, -0.0751635, 0.03871354, 0.071464196, 0.36873388, 0.06534646, 0.19842775, -0.062864676, -0.09579855, -0.0028919287, -0.06786156, -0.039625853, 0.21120481, 0.011038855, 0.31145686, 0.002467374));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.42869115, 0.39558756, -0.3978756, 0.10216874, 0.23388638, -0.09459689, -0.41242695, 0.09512943, -0.010190109, -0.23009796, 0.37708718, 0.019464925, -0.08706662, 0.05559046, -0.13888529, 0.29004022));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.932787, 0.39718944, -0.2043748, -0.31709024, 0.06668092, -0.010567167, -0.07438595, 0.031716038, 0.2491803, -0.052362487, -0.260974, 0.03378624, 0.26042682, 0.15340096, 0.2965458, 0.12784234));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(0.2136929, -0.065304495, -0.09508324, 0.052793384, 0.06585807, 0.10383017, 0.1254804, -0.07170346, -0.09725905, -0.1334467, -0.12547706, -0.016299663, 0.32875282, 0.063425355, 0.06413324, -0.17532061));
    result = result * 0.2 + FEAT_TEX_0_texOff(float2(0.0, 0.0));
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
