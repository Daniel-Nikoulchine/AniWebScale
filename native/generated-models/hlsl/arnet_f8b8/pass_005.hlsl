// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:137
// Pass: 005 - ARNet F8B8 body block 0 conv 1 8x8x3x3 part 1
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

#define FEAT_TEX_1_tex(position) Anime4KSample2(position)
#define FEAT_TEX_1_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define FEAT_TEX_1_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define FEAT_TEX_1_pos anime4k_pos
#define FEAT_TEX_1_size float2(Anime4KInputSizes[2].xy)
#define FEAT_TEX_1_pt rcp(FEAT_TEX_1_size)
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
    float4 result = float4(-0.08931672, 0.22575049, 0.0051183947, 0.28896293);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(0.10185755, 0.24807052, 0.065721035, -0.026797568, -0.15464148, -0.007015784, -0.18752995, 0.009571608, 0.054945193, 0.047767036, -0.058687415, 0.08320677, -0.12546523, -0.10108681, -0.08648488, -0.25120017));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.07591412, -0.20513165, 0.069094576, 0.033816405, -0.17915082, 0.41630125, -0.26864848, 0.013237798, 0.15343283, 0.0022800192, 0.42780614, -0.047881912, 0.21454868, -0.08436161, -0.1287823, 0.017590854));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.024733476, 0.12000088, -0.22385849, -0.11095045, -0.021015067, -0.090306364, -0.2952868, 0.06477519, -0.06071173, 0.226287, 0.15120523, -0.025530288, -0.18956819, -0.099464245, 0.1330384, -0.13805307));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.57353735, -0.43420705, -0.09249231, -0.2235458, -0.73890734, 0.17744945, -0.60491264, -0.48298943, -0.38756937, 0.39503813, -0.0252254, 0.17850757, -0.088084765, 0.004456687, 0.00050363893, -0.0931735));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(-0.44952926, -0.4658468, 0.28143725, 0.3280564, -0.35080144, -0.20888205, -0.6948061, -0.6130035, 0.14913596, 0.5504274, 0.25125593, 0.5392006, 0.05764514, -0.25022104, -0.6583217, 0.77842355));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(-0.14989689, 0.064912304, -0.30492222, 0.09405884, -0.08738862, -0.24624896, -0.3802153, -0.11511217, -0.0575125, 0.280405, 0.2688013, -0.14430489, 0.31904647, 0.42357987, 0.33525667, -0.06968107));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.24335086, -0.0015272269, 0.10439853, -0.14621256, -0.40841222, 0.07411601, -0.112820365, -0.15209217, 0.0809377, -0.06411126, -0.235095, 0.02645864, -0.32827476, 0.08765302, -0.09532655, -0.06519787));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.28267398, -0.48268092, -0.17654486, 0.19095364, -0.17421761, 0.23173851, 0.21476644, 0.009004623, 0.5755242, -0.3551836, 0.026006458, -0.15287562, 0.5617483, -0.21712328, -0.20965333, -0.04277469));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.17149061, 0.1910285, -0.16427065, -0.053907927, 0.06296509, -0.021785965, -0.090369225, 0.0060734055, -0.2759108, -0.4683895, -0.14460647, -0.08593211, 0.18408313, 0.22811468, 0.11844406, -0.114786774));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.088014, -0.43572795, -0.3863866, 0.099316314, 0.3619867, -0.012971364, 0.12524518, 0.06526965, 0.11632177, 0.10739797, 0.08551232, 0.13873008, 0.006905387, -0.0122432755, -0.07204069, -0.11750125));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.011820178, -0.012975997, -0.21931037, -0.08505612, -0.09668125, 0.12736353, -0.15514007, -0.10805813, -0.22946861, 0.01455842, 0.043234352, -0.09474065, 0.27002, -0.25220707, -0.11986873, -0.0006563303));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.044067472, -0.12982665, 0.018937051, -0.026762411, 0.07959379, 0.052868087, 0.10676096, 0.057355426, 0.18784484, 0.034146108, -0.33599296, 0.10427495, -0.011541566, -0.39428794, 0.12827033, -0.034911927));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.08189783, 0.26036492, 0.16922349, 0.5283124, -0.1139925, 0.1317463, 0.54333967, 0.7154522, 0.25179008, -0.18164718, -0.043511253, -0.027689986, 0.06713292, -0.14633894, 0.12019159, -0.32376254));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.1118508, -0.41398904, -0.16789977, -0.22477499, -0.6810608, 0.4322015, -0.010989834, 0.15245932, -0.40723255, -0.111532226, 0.16530588, -1.109575, -0.04648401, 0.24770923, 0.40235043, 0.56589735));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.020935645, 0.06804413, -0.061140746, -0.0072311093, -0.052284837, 0.25800472, 0.3569465, 0.17873086, -0.10081808, -0.5787689, -0.677006, 0.055639137, 0.094446935, -0.0005102739, -0.23289134, 0.100152425));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(-0.020828689, 0.20052364, -0.14533748, -0.018028596, -0.03439744, -0.09828905, -0.34545124, 0.28422695, 0.45354718, -0.15793717, 0.06354997, 0.050330296, -0.48255628, 0.07709523, 0.008257209, -0.08877546));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.011623785, -0.2051305, -0.37092367, 0.21454921, 0.095906116, -0.33784884, -0.24860294, -0.03643384, -0.3164772, -0.20393962, -0.040769674, -0.13209665, -0.142397, 0.51000005, -0.16895504, -0.08374636));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.15493466, -0.0611667, -0.04799047, -0.006273694, -0.013575412, 0.011595063, 0.04970371, 0.048067514, 0.00024144488, -0.43198353, -0.18912381, 0.013773455, 0.1076807, -0.07401525, -0.13707003, 0.0035946418));
    result = result * 0.2 + FEAT_TEX_1_texOff(float2(0.0, 0.0));
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
