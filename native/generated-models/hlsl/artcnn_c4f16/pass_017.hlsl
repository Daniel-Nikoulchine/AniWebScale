// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:804
// Pass: 017 - ArtCNN C4F16 (Conv2D-4-ReLU)
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

#define conv2d_3_0_tex(position) Anime4KSample0(position)
#define conv2d_3_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_3_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_3_0_pos anime4k_pos
#define conv2d_3_0_size float2(Anime4KInputSizes[0].xy)
#define conv2d_3_0_pt rcp(conv2d_3_0_size)
#define conv2d_3_1_tex(position) Anime4KSample1(position)
#define conv2d_3_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_3_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_3_1_pos anime4k_pos
#define conv2d_3_1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_3_1_pt rcp(conv2d_3_1_size)
#define conv2d_3_2_tex(position) Anime4KSample2(position)
#define conv2d_3_2_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_3_2_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_3_2_pos anime4k_pos
#define conv2d_3_2_size float2(Anime4KInputSizes[2].xy)
#define conv2d_3_2_pt rcp(conv2d_3_2_size)
#define conv2d_3_3_tex(position) Anime4KSample3(position)
#define conv2d_3_3_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_3_3_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_3_3_pos anime4k_pos
#define conv2d_3_3_size float2(Anime4KInputSizes[3].xy)
#define conv2d_3_3_pt rcp(conv2d_3_3_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(0.004486471, 0.011436195, -0.008108224, 0.006421022);
    result += mul(conv2d_3_0_texOff(float2(-1, -1)), float4x4(0.008054595, -0.05760597, -0.0127046285, -0.11422434, 0.0008386947, 0.036718354, 0.005965094, 0.10837695, -0.00937201, 0.074647225, 0.0011837771, 0.037176672, 0.007607297, -0.03235294, 0.019302443, -0.009491848));
    result += mul(conv2d_3_0_texOff(float2(0, -1)), float4x4(-0.065169245, -0.043351065, -0.013854184, -0.17888048, 0.044127338, 0.016512074, 0.010384147, 0.118624106, -0.021044498, -0.016420754, 0.0018297437, 0.059034582, -0.0077071516, 0.06374544, -0.018837309, 0.0516269));
    result += mul(conv2d_3_0_texOff(float2(1, -1)), float4x4(0.013812953, -0.004885587, -0.016729655, 0.024848316, 0.01629816, 0.04331894, -0.0014174759, 0.0042137275, -0.02862538, -0.04942006, -0.013629967, -0.1519132, -0.041781895, 0.029191656, -0.00080827076, 0.048217196));
    result += mul(conv2d_3_0_texOff(float2(-1, 0)), float4x4(0.05465828, 0.10653112, -0.019188011, 0.06230822, 0.024923636, -0.038846556, -0.011035869, 0.037752934, 0.0032114885, 0.09823095, -0.013083519, 0.132179, -0.07089785, -0.028200394, 0.020072596, -0.14945073));
    result += mul(conv2d_3_0_texOff(float2(0, 0)), float4x4(0.056565166, 0.07150479, 0.061420508, 0.15852778, -0.22644347, 0.019766634, -0.055689443, -0.22929029, 0.038485568, 0.16723952, -0.0026333993, 0.19457282, 0.2527069, -0.009755536, 0.009056009, -0.0021000034));
    result += mul(conv2d_3_0_texOff(float2(1, 0)), float4x4(0.021916041, -0.0074661323, -0.022776717, 0.0141780535, -0.011938058, -0.043118402, -0.013667855, 0.009841705, 0.03684278, 0.07692882, 0.012796983, 0.07920897, -0.09877573, 0.06130059, 0.054240294, 0.0059870803));
    result += mul(conv2d_3_0_texOff(float2(-1, 1)), float4x4(-0.017752912, -0.08185486, -0.06503527, -0.10561472, 0.005220385, 0.086687386, 0.017722901, 0.13457482, -0.025621187, 0.010063906, -0.03961333, -0.025233302, 0.03464027, -0.14897169, 0.039800137, -0.12192466));
    result += mul(conv2d_3_0_texOff(float2(0, 1)), float4x4(-0.012029554, -0.17210114, 0.089772224, -0.09705903, 0.079741985, 0.17035545, 0.10887278, 0.2767207, -0.03952406, -0.2343406, -0.12611477, 0.026258694, -0.0063543976, -0.23039515, -0.21764119, -0.18514743));
    result += mul(conv2d_3_0_texOff(float2(1, 1)), float4x4(-0.014609126, -0.036849946, -0.032717455, 0.014928927, 0.007859108, 0.14651228, 0.010292354, 0.25726226, -0.021417568, 0.05120976, -0.028983872, -0.04987429, -0.021223959, -0.1524279, 0.098942496, -0.2350176));
    result += mul(conv2d_3_1_texOff(float2(-1, -1)), float4x4(-0.0062645283, -0.030917196, -0.009799985, 0.20031944, -0.054479584, 0.044720024, 0.005927477, 0.0137507515, 0.05466501, 0.1996982, -0.015592255, 0.07342262, -0.03377825, -0.028459884, 0.0048896964, 0.05182459));
    result += mul(conv2d_3_1_texOff(float2(0, -1)), float4x4(0.16513644, -0.03919094, 0.01478009, 0.111529045, -0.22198735, -0.0521673, -0.02856099, -0.2332644, -0.24125879, -0.23031686, 0.04163698, 0.22651784, 0.008939289, -0.0724111, 0.0019911162, -0.260784));
    result += mul(conv2d_3_1_texOff(float2(1, -1)), float4x4(0.0028162987, 0.06675018, 0.001858511, 0.15357703, -0.049635924, -0.07289674, 0.0038710115, -0.07519456, 0.10703799, -0.051651128, 0.038070437, -0.37072566, 0.034323666, 0.04636791, -0.0066196164, 0.07630469));
    result += mul(conv2d_3_1_texOff(float2(-1, 0)), float4x4(-0.0033726227, 0.0057019996, -0.011636609, -0.012265043, -0.02008305, 0.04908172, 0.072547056, -0.012953669, 0.077041335, -0.21447659, -0.07399844, -0.0011508965, -0.037110474, -0.06422502, 0.04197548, 0.028162384));
    result += mul(conv2d_3_1_texOff(float2(0, 0)), float4x4(-0.15936874, 0.03933437, -0.030369194, -0.3639581, -0.28613383, -0.1029412, 0.23673673, -0.066955544, -0.1714181, -0.6526972, 0.12077048, -0.54001194, 0.13864024, 0.04506747, 0.017605193, -0.027056118));
    result += mul(conv2d_3_1_texOff(float2(1, 0)), float4x4(-0.018889615, 0.17727773, 0.006928867, 0.052768722, -0.049539715, -0.08631019, 0.010981628, 0.05511366, -0.014498841, 0.08343889, -0.03594863, 0.3059114, -0.110368945, -0.07183568, -0.023269612, -0.079552315));
    result += mul(conv2d_3_1_texOff(float2(-1, 1)), float4x4(0.014428974, 0.07407337, -0.014518448, -0.025769478, -0.011257196, -0.077601016, 0.016131414, -0.080387644, -0.0030629593, -0.012811047, -0.06223334, 0.07493222, 0.0017077796, 0.019088095, 0.040250346, -0.02602515));
    result += mul(conv2d_3_1_texOff(float2(0, 1)), float4x4(0.03324969, 0.18104063, 0.08509577, 0.10975837, 0.033106938, -0.08362102, 0.24036364, -0.0047041127, 0.047722034, 0.38819358, 0.072768666, 0.22138174, -0.020482242, -0.33697242, -0.09412067, -0.13116597));
    result += mul(conv2d_3_1_texOff(float2(1, 1)), float4x4(0.0076461947, 0.09298127, 0.006322427, 0.041081697, 0.025534563, -0.05985541, 0.037449714, 0.030225305, -0.024794793, 0.006843591, 0.046343803, 0.028408147, 0.0020282702, -0.01825519, 0.06752767, 0.054206014));
    result += mul(conv2d_3_2_texOff(float2(-1, -1)), float4x4(-0.026819605, 0.12695056, 0.022697084, 0.14668164, -0.0076775034, 0.04610961, 0.00015309932, 0.011815789, 0.0018914867, -0.013156144, -0.0023772726, 0.0038656443, 0.018821925, 0.08035632, 0.0040185326, 0.119376846));
    result += mul(conv2d_3_2_texOff(float2(0, -1)), float4x4(0.058967035, -0.011067325, 0.015737988, 0.29124355, -0.08567674, 0.05446212, 0.0032559843, -0.5638896, 0.06940115, 0.12312707, 0.00992105, 0.13641328, 0.089293666, -0.004784682, 0.012770268, 0.13229255));
    result += mul(conv2d_3_2_texOff(float2(1, -1)), float4x4(-0.01707323, 0.0032111604, 0.01582106, 0.095011346, -0.0047699446, 0.006258691, -0.00073478953, 0.032200415, -0.07938284, -0.0031229325, 0.009823461, 0.05094397, 0.017497282, 0.012788686, 0.008119644, 0.04832641));
    result += mul(conv2d_3_2_texOff(float2(-1, 0)), float4x4(-0.04340275, -0.099092826, -0.033520028, 0.08049154, 0.00045631378, -0.08482037, 0.0069966326, -0.20060629, 0.0427687, -0.057565536, -0.0033986813, -0.07941228, 0.03134527, -0.029875835, -0.016098397, -0.05959223));
    result += mul(conv2d_3_2_texOff(float2(0, 0)), float4x4(0.15705279, -0.013417311, -0.102037944, 0.0059741293, -0.14612843, -0.5528511, -0.019903222, -0.54130507, 0.107802466, 0.02371327, -0.0563654, -0.17378539, -0.03872913, -0.113435596, -0.06930459, -0.012294629));
    result += mul(conv2d_3_2_texOff(float2(1, 0)), float4x4(-0.087645076, -0.041685034, -0.000993629, -0.003203951, 0.0006721713, -0.3960591, -0.0002549441, -0.37039977, -0.07180762, 0.13643444, 0.09949598, 0.068006165, 0.027353656, -0.0044281245, -0.021017168, -0.02398797));
    result += mul(conv2d_3_2_texOff(float2(-1, 1)), float4x4(-0.006280645, 0.301106, 0.060393758, -0.030311706, 0.001803276, 0.040270753, 0.019412782, 0.039913196, -0.0016202527, 0.04930703, -0.042920016, 0.0835051, -0.00586453, 0.0937267, -0.079186, 0.084869094));
    result += mul(conv2d_3_2_texOff(float2(0, 1)), float4x4(0.0187981, 0.2786141, 0.1522357, -0.0799436, -0.025531836, -0.62698424, -0.1529165, 0.043772984, 0.009668471, -0.25136542, -0.16795889, -0.005765583, 0.02071583, 0.3706712, 0.20171186, 0.19190311));
    result += mul(conv2d_3_2_texOff(float2(1, 1)), float4x4(-0.004864479, 0.112152316, 0.036165934, -0.025513867, -0.016947377, -0.3466565, -0.055057608, -0.0567016, -0.022349637, -0.17342809, 0.11000891, -0.18153484, -0.015971169, 0.15947045, -0.04385294, 0.06383435));
    result += mul(conv2d_3_3_texOff(float2(-1, -1)), float4x4(-0.008708798, 0.12245846, 0.008020415, -0.04512215, -0.004263119, 0.028144894, 0.0024383338, -0.20528056, -0.0031629193, -0.14397767, -0.013350222, -0.080553494, -0.049023658, -0.13017124, -0.020881396, -0.31586245));
    result += mul(conv2d_3_3_texOff(float2(0, -1)), float4x4(0.042203885, 0.10250278, -0.009374864, 0.1209694, -0.10631868, -0.09386463, -0.0075154235, -0.20230906, 0.30753413, -0.19458602, -0.023099605, -0.34287104, 0.023103023, -0.021053528, -0.014821938, -0.12937401));
    result += mul(conv2d_3_3_texOff(float2(1, -1)), float4x4(0.0002844027, -0.084831074, -0.008763425, -0.13201767, 0.06884424, -0.041098893, -0.01119997, 0.12361056, 0.10966187, -0.02023798, -0.01675072, -0.16216677, -0.04793764, -0.0035411196, 0.015837632, -0.011866899));
    result += mul(conv2d_3_3_texOff(float2(-1, 0)), float4x4(0.02930859, -0.3499387, -0.025103021, 0.10541333, 0.06383553, -0.01158549, -0.0061088274, -0.08285697, -0.06435018, 0.15550692, 0.011422762, 0.060749665, 0.018713983, 0.35533422, 0.043027695, 0.35362625));
    result += mul(conv2d_3_3_texOff(float2(0, 0)), float4x4(-0.3227368, -0.06627837, -0.009231986, -0.25869715, -0.108600296, 0.045489397, 0.080093466, -0.051062305, 0.2070024, 0.34477922, -0.22870046, 0.35104373, 0.16473976, 0.060710084, 0.07223087, 0.30477777));
    result += mul(conv2d_3_3_texOff(float2(1, 0)), float4x4(0.0938999, 0.06439779, -0.015912212, 0.095875815, -0.024997806, -0.12138904, -0.087043434, -0.24098864, 0.23672655, -0.21462908, -0.15518942, -0.047061205, -0.0073770215, 0.13218926, 0.021189312, 0.2352984));
    result += mul(conv2d_3_3_texOff(float2(-1, 1)), float4x4(-0.043939073, -0.012248698, 0.1040979, -0.21977492, -0.06642388, -0.5411432, -0.075221084, -0.093294404, 0.023390017, -0.017332949, 0.042311374, -0.0051259976, -0.042727746, -1.1595134, -0.0056059365, -0.024737274));
    result += mul(conv2d_3_3_texOff(float2(0, 1)), float4x4(0.037859954, 0.022804383, 0.15475157, 0.13635658, 0.033001766, 0.11888834, -0.08811682, 0.20263621, -0.039998997, -0.3698207, -0.16719098, -0.2395014, 0.02952542, -0.09047316, -0.083860874, -0.039438125));
    result += mul(conv2d_3_3_texOff(float2(1, 1)), float4x4(-0.0070548784, 0.010067567, -0.06063097, 0.09757376, -0.009449339, 0.14482175, 0.024308404, -0.14095286, 0.0038282184, -0.03698258, -0.17879993, -0.14432411, -0.024530875, 0.026591733, 0.04790655, -0.105404444));
    return max(result, float4(0.0, 0.0, 0.0, 0.0));
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
