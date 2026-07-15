// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:1016
// Pass: 021 - ArtCNN C4F16 (Conv2D-5)
// ArtCNN is Copyright (c) 2024 Joao Chrisostomo, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[4];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
Texture2D<float4> Anime4KInput2 : register(t2);
Texture2D<float4> Anime4KInput3 : register(t3);
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

#define conv2d_4_0_tex(position) Anime4KSample0(position)
#define conv2d_4_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_4_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_4_0_pos anime4k_pos
#define conv2d_4_0_size float2(Anime4KInputSizes[0].xy)
#define conv2d_4_0_pt rcp(conv2d_4_0_size)
#define conv2d_4_1_tex(position) Anime4KSample1(position)
#define conv2d_4_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_4_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_4_1_pos anime4k_pos
#define conv2d_4_1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_4_1_pt rcp(conv2d_4_1_size)
#define conv2d_4_2_tex(position) Anime4KSample2(position)
#define conv2d_4_2_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_4_2_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_4_2_pos anime4k_pos
#define conv2d_4_2_size float2(Anime4KInputSizes[2].xy)
#define conv2d_4_2_pt rcp(conv2d_4_2_size)
#define conv2d_4_3_tex(position) Anime4KSample3(position)
#define conv2d_4_3_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_4_3_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_4_3_pos anime4k_pos
#define conv2d_4_3_size float2(Anime4KInputSizes[3].xy)
#define conv2d_4_3_pt rcp(conv2d_4_3_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.0011114611, 0.0038673887, -0.0005224372, 0.00015685732);
    result += mul(conv2d_4_0_texOff(float2(-1, -1)), float4x4(0.39640883, 0.1604166, -0.018548254, 0.47036317, -0.11701649, 0.013824723, -0.037191533, -0.029296013, 0.05422616, 0.08891255, -0.03893731, 0.09320427, -0.0075011286, -0.15867539, 0.19763166, -0.099266075));
    result += mul(conv2d_4_0_texOff(float2(0, -1)), float4x4(-0.043447368, -0.28221342, -0.12871213, 2.0091877, -0.1924093, -0.050228506, -0.15984957, -0.021635447, 0.027441215, 0.012851808, -0.10008898, 0.052069057, 0.035205632, 0.04706964, 0.21787922, 0.052137747));
    result += mul(conv2d_4_0_texOff(float2(1, -1)), float4x4(-0.92293936, -0.45945013, 0.83943176, 0.7315106, -0.19689988, -0.17791079, -0.21653867, 0.14213775, 0.07743269, -0.0067440327, 0.013130342, 0.029113768, -0.044152994, 0.0009757808, -0.010308463, -0.022070546));
    result += mul(conv2d_4_0_texOff(float2(-1, 0)), float4x4(0.12025234, 0.029835457, 0.09764192, 0.04260138, -0.20843725, 0.010845284, -0.089740954, -0.14082502, 0.098485105, -0.099805176, 0.16543896, -0.007438913, -0.094464816, 0.0132062305, -0.13963151, 0.06917212));
    result += mul(conv2d_4_0_texOff(float2(0, 0)), float4x4(0.21759711, 0.004735797, -0.28547624, -0.1247357, -0.3407772, 0.026643613, -0.014733567, 0.18682922, 0.48622054, 0.17722954, 0.025539394, -0.1801849, -0.37519056, -0.2224513, -0.059948396, 0.15389496));
    result += mul(conv2d_4_0_texOff(float2(1, 0)), float4x4(0.114061505, -0.2775719, 0.14903861, 0.16544303, -0.53680956, -0.10283731, -0.06516943, 0.03935461, 0.019689482, -0.093879506, -0.20757464, 0.1053656, -0.010515173, 0.09225828, 0.3293743, 0.19285433));
    result += mul(conv2d_4_0_texOff(float2(-1, 1)), float4x4(-0.032575168, 0.042954963, 0.01543512, -0.0076845842, -0.073060706, -0.025824485, 0.037535258, -0.064655565, 0.025311591, 0.11112295, 0.098137565, 0.006335456, 0.011577739, -0.14999153, -0.10436524, -0.10841019));
    result += mul(conv2d_4_0_texOff(float2(0, 1)), float4x4(0.06850211, -0.01847829, 0.13557819, 0.18784161, -0.19997707, -0.123719655, -0.26020455, -0.1308247, 0.036241066, -0.21547662, 0.031609688, -0.07252322, -0.00915869, 0.011885016, -0.06832468, -0.29763076));
    result += mul(conv2d_4_0_texOff(float2(1, 1)), float4x4(0.0054460294, 0.00016366104, 0.015167535, -0.11660705, -0.13401645, 0.046256945, 0.06987004, -0.083092585, -0.07953003, -0.043129597, 0.025720708, -0.0841534, 0.114404194, -0.015412602, -0.11773556, -0.15229551));
    result += mul(conv2d_4_1_texOff(float2(-1, -1)), float4x4(-0.07682066, 0.031393904, -0.09954423, -0.050310902, 0.19843513, 0.17195483, 0.05594714, -0.0017241768, 0.23414364, 0.07056054, -0.0070830532, -0.03047583, -0.05395951, 0.055159092, -0.1952889, 0.05822435));
    result += mul(conv2d_4_1_texOff(float2(0, -1)), float4x4(-0.08603872, -0.022274034, 0.052691337, -0.2624329, -0.067409046, -0.12071691, -0.2501093, 0.030475749, 0.17834793, 0.25183687, -0.3022957, -0.13442267, -0.034983378, 0.0061911396, 0.13307369, -0.050564278));
    result += mul(conv2d_4_1_texOff(float2(1, -1)), float4x4(-0.14640597, -0.028788423, -0.08671821, -0.17104322, -0.03915151, 0.1661857, 0.30994233, -0.105096735, 0.17779788, 0.12911984, 0.13451669, -0.03788383, 0.02933811, 0.024869606, 0.09819545, -0.037525196));
    result += mul(conv2d_4_1_texOff(float2(-1, 0)), float4x4(-0.23086612, 0.072889715, 0.17193975, 0.12144614, 0.053878516, 0.0808835, -0.038890734, -0.062120676, 0.11873907, -0.04181901, 0.031711385, 0.041059215, -0.07352216, -0.1551154, 0.18779756, 0.0006897825));
    result += mul(conv2d_4_1_texOff(float2(0, 0)), float4x4(-0.45612088, -0.16501062, -0.06694142, 0.22924851, 0.03422126, 0.17393956, -0.32035923, 0.1369217, 0.13044347, 0.38150743, 0.4462501, 0.46364114, 3.2705964e-05, 0.32857245, 0.29168147, -0.26061118));
    result += mul(conv2d_4_1_texOff(float2(1, 0)), float4x4(-0.17222376, -0.2687178, -0.15024178, -0.04756523, 0.033226807, 0.07303003, 0.23962349, 0.22916174, -0.051200937, 0.14334223, 0.117849626, 0.10713901, -0.13583659, -0.31175795, -0.36117485, 0.06586926));
    result += mul(conv2d_4_1_texOff(float2(-1, 1)), float4x4(-0.10960344, -0.016991504, -0.03253585, -0.01803023, -0.04212763, -0.003070873, -0.014774825, -0.062007226, 0.051523257, 0.0019569788, -0.0018109804, -0.015406127, 0.020675704, 0.13250527, 0.13950332, 0.12533231));
    result += mul(conv2d_4_1_texOff(float2(0, 1)), float4x4(-0.09766963, -0.022424206, 0.00036278195, 0.15453264, 0.059719924, 0.107007995, 0.01577213, -0.040380705, -0.0028466822, 0.046925608, -0.058475647, -0.08021065, -0.18278556, -0.33749336, 0.12899032, 0.10542245));
    result += mul(conv2d_4_1_texOff(float2(1, 1)), float4x4(-0.057510205, -0.0680529, 0.03726144, 0.13160646, 0.022184618, 0.017054789, 0.058539525, 0.18420088, 0.0275572, 0.008825085, 0.0023858314, -0.0795888, -0.029388942, -0.027344778, -0.08230741, -0.32087848));
    result += mul(conv2d_4_2_texOff(float2(-1, -1)), float4x4(0.118878886, 0.09011945, 0.07534683, 0.013482446, 0.086338915, 0.10734087, 0.022168318, -0.05633644, -0.107286036, -0.26992935, -0.08521458, -0.67372936, -0.2061095, -0.13471176, -0.26200187, -0.056343216));
    result += mul(conv2d_4_2_texOff(float2(0, -1)), float4x4(0.102794625, 0.058351714, -0.09465631, 0.027053284, -0.084742635, 0.008540059, -0.021141963, -0.055628967, 0.059914164, 0.15191063, -0.071810596, 0.13242096, 0.01824429, -0.017515436, 0.2425463, -0.27798483));
    result += mul(conv2d_4_2_texOff(float2(1, -1)), float4x4(0.046696525, 0.033349395, -0.03866225, -0.05662211, 0.102735415, -0.11587684, -0.037647463, 0.110694155, -0.0016731526, -0.022355525, 0.070109665, 0.15629092, -0.10723987, -0.017699908, 0.093507856, 0.119093604));
    result += mul(conv2d_4_2_texOff(float2(-1, 0)), float4x4(0.09625893, 0.007287908, 0.07406035, -0.036385946, 0.0047473204, 0.111687295, 0.006611469, -0.10992679, 0.13032511, -0.50374734, -0.08328716, -1.0770898, 0.08326173, -0.1021871, -0.030260464, 0.5657856));
    result += mul(conv2d_4_2_texOff(float2(0, 0)), float4x4(0.119658, -0.13478446, 0.06970789, -0.2717258, -0.11052728, -0.07097308, 0.010216505, -0.040050194, 0.013968, 0.3189454, -0.20097564, -0.24413225, 0.16743262, 0.24710712, -0.28075525, 1.1400236));
    result += mul(conv2d_4_2_texOff(float2(1, 0)), float4x4(0.1138164, -0.00021803346, 0.008667409, 0.105987936, -0.06245829, -0.12482996, -0.10859521, 0.103108115, 0.013694051, 0.027792973, -0.06668166, -0.0044359267, -0.051680587, 0.16353033, -0.16088994, -0.15733641));
    result += mul(conv2d_4_2_texOff(float2(-1, 1)), float4x4(-0.009321868, 0.0146649955, 0.027546363, -0.06989611, 0.052979127, -0.01442452, -0.124766484, 0.011988924, -0.11435669, -0.29669708, -0.14183255, -1.5092758, 0.08696634, -0.06808778, 0.00023471624, -0.03544612));
    result += mul(conv2d_4_2_texOff(float2(0, 1)), float4x4(0.13749659, -0.022183452, -0.19872895, -0.24887523, 0.014172516, -0.09102993, 0.060767353, -0.087859735, -0.029894201, 0.15968496, 0.10182183, -0.04711137, -0.1134239, 0.1953176, -0.08229585, 0.5626922));
    result += mul(conv2d_4_2_texOff(float2(1, 1)), float4x4(0.0034460868, -0.029077213, -0.06044691, -0.09942373, -0.06164951, -0.04544194, 0.006366872, -0.053108666, -0.03875131, 0.0063349865, 0.061941914, -0.12147465, -0.32060915, -0.1032727, 0.1740625, 0.3751007));
    result += mul(conv2d_4_3_texOff(float2(-1, -1)), float4x4(0.14109771, 0.3282752, -0.029266445, 0.15986797, 0.11794213, 0.02924194, 0.11607317, 0.16523695, -0.097699836, 0.052040394, -0.076466516, -0.023456309, 0.0465265, 0.010049317, 0.058866765, 0.03404191));
    result += mul(conv2d_4_3_texOff(float2(0, -1)), float4x4(0.041461486, -0.14022873, -0.3182195, -0.08060609, 0.18077353, 0.036311384, -0.392403, 0.031904407, 0.039807398, 0.10089023, 0.07104703, 0.0493624, 0.27432182, -0.043187845, 0.33940113, 0.13156298));
    result += mul(conv2d_4_3_texOff(float2(1, -1)), float4x4(0.0155730285, 0.0056630187, -0.116622314, -0.14926921, 0.1424582, -0.08656676, -0.014005859, 0.14303184, 0.014974255, 0.11120006, -0.017669037, -0.08002915, 0.19712499, 0.12340735, 0.21207686, -0.08691049));
    result += mul(conv2d_4_3_texOff(float2(-1, 0)), float4x4(0.06911327, 0.11540081, 0.0063450723, -0.41313946, 0.44205692, 0.034101177, -0.35487852, -0.057533618, -0.31773725, -0.05869578, 0.364305, -0.11513399, 0.20833145, 0.113567404, 0.22643729, 0.10794549));
    result += mul(conv2d_4_3_texOff(float2(0, 0)), float4x4(-0.16420114, -0.17772049, 0.20299298, -0.96146286, 0.7134006, 0.27049655, 0.21545453, 0.07020976, -0.77649087, -0.16075286, -0.048828594, -0.5984206, 0.56194097, 0.16709545, -0.047654167, -0.6736176));
    result += mul(conv2d_4_3_texOff(float2(1, 0)), float4x4(0.078912936, -0.09781227, -0.14695303, -0.12958658, 0.010782298, 0.057553593, -0.13703667, -0.13617685, -0.1750218, -0.010922046, 0.073276944, 0.055023476, 0.59961796, -0.408717, 0.11374051, 0.09685231));
    result += mul(conv2d_4_3_texOff(float2(-1, 1)), float4x4(-0.07903951, 0.13941607, 0.12942553, -0.10488867, 0.33908233, 0.0017822076, 0.22554594, -0.059773706, -0.21440332, -0.017083632, -0.21858291, 0.26524878, 0.023343144, 0.056390647, 0.047940783, 0.049762025));
    result += mul(conv2d_4_3_texOff(float2(0, 1)), float4x4(0.09448344, -0.073168, -0.024547528, -0.13241516, 0.19315998, -0.040555146, 0.0056549124, -0.057758577, -0.10503566, 0.17156446, 0.11847754, 0.45022973, 0.25674775, 0.040890872, 0.08936839, 0.17803407));
    result += mul(conv2d_4_3_texOff(float2(1, 1)), float4x4(0.16619347, 0.20351814, -0.0142056495, -0.128936, -0.15587173, -0.009002632, 0.1332009, 0.09969636, 0.121941924, 0.105318554, -0.11569331, 0.022160158, 0.17116208, -0.24583699, -0.13386434, 0.0534919));
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
