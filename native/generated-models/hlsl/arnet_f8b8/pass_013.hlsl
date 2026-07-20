// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:393
// Pass: 013 - ARNet F8B8 body block 2 conv 1 8x8x3x3 part 1
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
    float4 result = float4(0.20783459, -0.11637417, -0.42860132, 0.23856468);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.039963912, -0.10492156, 0.13325556, 0.074689314, 0.07775506, 0.17275122, -0.049396493, -0.18005645, -0.14998208, 0.39144892, -0.1194804, 0.08324126, -0.05531112, 0.026529655, 0.05126041, -0.08260234));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.18445268, 0.010855256, 0.010552376, -0.035706066, 0.15259804, 0.04058016, -0.106000215, -0.22601128, 0.071212776, -0.1958051, -0.3152253, 0.5047313, -0.15021123, -0.06672418, 0.03416012, -0.12985456));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.04634266, 0.045636944, 0.04367364, 0.11420146, 0.016555024, -0.0740656, -0.11185144, -0.11690179, 0.063593835, -0.101061426, -0.14296098, -0.10800056, 0.020329112, -0.06526108, -0.004985493, 0.06484176));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.11137525, -0.22149825, -0.029915813, 0.20695198, -0.13445677, -0.06410403, 0.02965008, -0.045565233, -0.040860012, 0.5678113, -0.03917705, 0.0034602256, -0.018852744, 0.18969408, 0.22105962, -0.22566192));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(-0.33179328, 0.19168143, -0.0063561304, 0.64171535, 0.2846876, -0.6588571, 0.5303061, 0.433727, 0.42242834, -0.5481174, 0.045524076, 0.09680382, -0.21608858, 0.34468356, 0.3639583, -0.7249048));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(-0.48442736, -0.27150866, -0.019530756, 0.30327874, -0.1215648, 0.09105064, 0.24128944, -0.058038715, 0.1083254, 0.121197656, 0.45409465, 0.36384097, -0.06806775, 0.14768194, 0.20213123, -0.23284203));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.06732489, -0.2210595, 0.20208931, 0.16231348, -0.15730922, 0.069968924, 0.03287659, -0.020541573, 0.0257778, -0.012569131, 0.08320939, 0.15656681, 0.14862719, 0.39584693, 0.063491575, -0.24715151));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.054196645, -0.22071661, 0.59086126, 0.5126693, 0.023105029, 0.018388188, 0.16478245, -0.046417996, -0.022826664, -0.2691204, -0.044437632, -0.010119219, -0.21193771, 0.16720608, -0.12444355, -0.49860018));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.043117825, -0.2485781, -0.016118752, 0.03257714, 0.16138542, -0.021974169, -0.2665019, -0.29600194, 0.2416373, -0.15301491, -0.17162862, 0.029785134, 0.03954519, 0.2418697, 0.13240038, -0.085027784));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.13009249, -0.04728622, -0.065290846, -0.04906168, 0.11921001, -0.03505835, 0.030650944, -0.055766948, 0.07792281, 0.13764638, -0.2457385, -0.015729532, -0.060959183, -0.10292635, -0.14647454, 0.12711081));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.7932648, -0.45680058, 0.1684277, 0.4307882, 0.30183467, 0.09751592, 0.24163571, -0.21308191, -0.039838158, 0.043839086, -0.257425, 0.2238606, 0.28693116, 0.2699124, 0.25432736, 0.102705926));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.06457335, -0.0045844656, 0.34405512, -0.007534402, 0.035163946, 0.3156419, 0.23752393, -0.08981944, -0.30822778, -0.058114577, 0.011283189, 0.038177684, -0.1345392, 0.1992905, -0.023700709, -0.08717069));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.16373467, -0.03572585, -0.08208338, -0.09661442, 0.0019573031, -0.39356744, -0.14508848, 0.08600929, -0.3018403, 0.23221259, -0.40321615, 0.07428633, -0.06868001, -0.0513564, 0.1381493, -0.23453364));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.47770494, 0.12760144, 0.43003967, 0.23312886, 0.5608419, 0.54175764, 0.20069763, 0.22373539, 0.23577179, 0.12063915, 0.14104904, -0.028711705, -0.07424369, 0.21638109, -0.29441342, -0.22298405));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.27439055, -0.20527384, -0.2480487, -0.112441994, -0.12517232, -0.0077676666, 0.30261728, 0.08863923, 0.121860825, 0.06259575, 0.19653647, 0.09206021, -0.2775469, 0.3065553, -0.055569224, 0.13004263));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.004089452, 0.012668198, -0.04200076, -0.01957316, -0.107710324, -0.022502378, 0.06689264, -0.10053737, -0.35415298, -0.031085158, -0.1814821, -0.13397466, -0.040919803, -0.20513439, -0.103511944, 0.1941593));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.04291262, 0.19913773, 0.035814323, -0.24391474, -0.07399389, 0.02622312, 0.02821124, -0.024345877, 0.085896425, 0.24802797, -0.23419245, -0.081066266, 0.17404075, 0.46016842, 0.021716012, -0.24375175));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.079950124, -0.17221853, -0.045150373, 0.019801311, 0.0022819368, 0.022379646, -0.17578496, -0.018738128, 0.2445819, 0.28473115, 0.06292684, 0.08935783, -0.33824548, -0.42055428, -0.08283155, 0.0801888));
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
