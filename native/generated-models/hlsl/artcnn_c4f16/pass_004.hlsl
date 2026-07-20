// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:115
// Pass: 004 - ArtCNN C4F16 (Conv2D-1-ReLU)
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

#define conv2d_0_tex(position) Anime4KSample0(position)
#define conv2d_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_0_pos anime4k_pos
#define conv2d_0_size float2(Anime4KInputSizes[0].xy)
#define conv2d_0_pt rcp(conv2d_0_size)
#define conv2d_1_tex(position) Anime4KSample1(position)
#define conv2d_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_1_pos anime4k_pos
#define conv2d_1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_1_pt rcp(conv2d_1_size)
#define conv2d_2_tex(position) Anime4KSample2(position)
#define conv2d_2_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_2_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_2_pos anime4k_pos
#define conv2d_2_size float2(Anime4KInputSizes[2].xy)
#define conv2d_2_pt rcp(conv2d_2_size)
#define conv2d_3_tex(position) Anime4KSample3(position)
#define conv2d_3_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_3_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_3_pos anime4k_pos
#define conv2d_3_size float2(Anime4KInputSizes[3].xy)
#define conv2d_3_pt rcp(conv2d_3_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(0.0057315477, 0.01220551, 0.11268519, 0.010119512);
    result += mul(conv2d_0_texOff(float2(-1, -1)), float4x4(-0.024125284, 0.36053768, -0.030539824, 0.035363108, 0.12882878, 0.08826568, 0.060933016, -0.048655245, -0.3886084, 0.2297383, -0.064356364, -0.10607676, 0.0015154631, -0.074405886, -0.1735875, 0.028058795));
    result += mul(conv2d_0_texOff(float2(0, -1)), float4x4(-0.3591389, -0.02228957, 0.019103048, 0.030545495, 0.7363539, 0.19943573, -0.027262723, 0.045700975, -0.7715932, -0.71260315, -0.07698792, -0.109657556, -0.468773, 0.14117427, 0.045736052, 0.12886085));
    result += mul(conv2d_0_texOff(float2(1, -1)), float4x4(0.46435255, -0.06340062, 0.13351502, -0.022015005, 0.15575479, -0.19134845, 0.15665053, -0.08261642, -0.40047666, -0.03649157, -0.050916918, 0.07168185, -0.112634145, -0.009801637, -0.11435762, -0.08838922));
    result += mul(conv2d_0_texOff(float2(-1, 0)), float4x4(-0.21300979, -0.069170155, -0.02524457, -0.1792958, -0.22457322, 0.01006355, 0.26727438, -0.20305517, 0.28302082, 0.22752848, 0.025560293, 0.05104237, 0.031250015, 0.108551264, -0.01904287, 0.02984452));
    result += mul(conv2d_0_texOff(float2(0, 0)), float4x4(-0.17580287, -0.14883621, -0.030504456, -0.110506296, -0.5622948, 0.4384959, 0.05334467, -0.06946785, -0.4926711, 0.8758044, -0.024123, -0.44123098, 0.04350575, 0.047474507, 0.14530358, 0.15756041));
    result += mul(conv2d_0_texOff(float2(1, 0)), float4x4(-0.508724, 0.060124543, -0.04563769, -0.08443593, -0.48120773, -0.08363192, -0.08252335, -0.006836714, 0.14194596, 0.22977303, 0.112781405, -0.1589584, -0.06930605, 0.090879895, 0.07769318, 0.043749176));
    result += mul(conv2d_0_texOff(float2(-1, 1)), float4x4(0.10299622, 0.065383464, -0.0010502158, 0.31116176, -0.11323491, -0.20453365, -0.027721914, 0.36969325, 0.37734175, -0.28494865, 0.057950113, -0.15477203, -0.06443423, -0.08688062, -0.14106219, -0.026969748));
    result += mul(conv2d_0_texOff(float2(0, 1)), float4x4(0.0014009404, 0.014462154, 0.012889582, 0.095769934, 0.10253242, 0.038002186, -0.040959027, 0.4664637, 0.3797086, -0.20613511, -0.22395512, 1.0037909, -0.0013836621, -0.061494213, -0.06638549, 0.02878929));
    result += mul(conv2d_0_texOff(float2(1, 1)), float4x4(-0.2756583, -0.021280238, -0.04133801, -0.02203378, 0.21983331, -0.29612616, -0.13481463, -0.15271369, 0.060368173, -0.15818107, 0.11625302, -0.13463797, 0.05316618, -0.09786038, 0.06327927, -0.10335609));
    result += mul(conv2d_1_texOff(float2(-1, -1)), float4x4(1.1077415, -0.065767325, -0.01755528, 0.060675096, -0.36396834, 0.071841866, 0.28213823, -0.024151051, -0.9988663, 0.59361684, -0.0705869, -0.03505334, -0.50420004, 0.5739408, -0.05193463, -0.02202797));
    result += mul(conv2d_1_texOff(float2(0, -1)), float4x4(-0.37710333, 0.19944099, 0.13706273, -0.0294321, 0.6862174, -0.43811744, -0.007293717, -0.30079582, 0.9999391, -0.20132875, -0.010582445, -0.04023016, -0.33132914, -0.092500106, -0.14949891, 0.012947441));
    result += mul(conv2d_1_texOff(float2(1, -1)), float4x4(0.4051968, 0.2762725, -0.0135955345, 0.063499406, 0.18378362, 0.022674192, 0.0566514, 0.03361189, -0.57209355, -0.18554153, 0.08746101, 0.24102001, -0.06631122, -0.10200225, -0.2513701, -0.040302496));
    result += mul(conv2d_1_texOff(float2(-1, 0)), float4x4(-0.41693354, -0.14076684, 0.11589063, -0.08162623, -0.16735734, 0.06367048, -0.16926739, 0.016047915, -0.012660883, -0.34816912, -0.06116311, 0.19753619, -0.42275375, 0.44595027, 0.09055507, 0.21647257));
    result += mul(conv2d_1_texOff(float2(0, 0)), float4x4(0.1959109, -0.40126458, 0.19069786, 0.098184645, -0.120232716, 0.35108244, 0.003952669, 0.08890963, -0.09739605, 0.22175273, 0.27652043, -0.2016377, 0.9154882, -0.9393635, -0.10989167, 0.26551166));
    result += mul(conv2d_1_texOff(float2(1, 0)), float4x4(-0.22338384, 0.1258025, -0.10516795, -0.143951, -0.30218482, -0.084651746, -0.20122004, 0.113071755, -0.017162202, 0.08726622, -0.074338585, -0.26985937, 0.5384228, 0.48544407, -0.019839466, 0.1563062));
    result += mul(conv2d_1_texOff(float2(-1, 1)), float4x4(0.07144698, 0.1489373, 0.020278584, 0.15969415, 0.15143564, -0.20653132, -0.016936544, 0.0485964, 0.41017503, 0.052133057, -0.31803653, -0.05361299, -0.036990035, 0.054179795, -0.18697025, 0.33939344));
    result += mul(conv2d_1_texOff(float2(0, 1)), float4x4(0.14244588, -0.036040064, 0.21871537, -0.24817806, 0.056411527, 0.021156125, -0.062362, 0.22841144, -0.07274309, -0.0068549607, 0.12304488, 0.29829216, -0.12225985, 0.06359026, 0.4262198, -0.93852407));
    result += mul(conv2d_1_texOff(float2(1, 1)), float4x4(-0.17561492, 0.1675631, -0.19665031, 0.01962083, 0.22865003, 0.039168496, -0.06645757, -0.20563303, 0.2972279, -0.34498563, 0.07087315, -0.026137834, -0.09257305, -0.38137805, 0.2249325, -0.19514605));
    result += mul(conv2d_2_texOff(float2(-1, -1)), float4x4(0.07291842, -0.16297379, -0.09821364, 0.00984802, -0.19477488, 0.2346158, 0.041234028, -0.12936807, 0.43639454, 0.2169685, 0.08141137, -0.033651084, 1.1044608, 0.09923805, 0.038863584, -0.021070214));
    result += mul(conv2d_2_texOff(float2(0, -1)), float4x4(-0.70921695, -0.2968588, -0.11130795, 0.085045874, -0.07077363, -0.5917506, 0.009046129, -0.04996687, 0.0062803496, -0.4849014, 0.05720417, 0.057956517, -1.3103348, -0.09619535, 0.06294816, 0.11963625));
    result += mul(conv2d_2_texOff(float2(1, -1)), float4x4(-0.35520667, 0.07030486, 0.08129326, -0.00017009811, -0.27802485, 0.18322131, 0.056435984, -0.035469774, -1.016923, -0.19861908, -0.14549735, -0.03570727, 0.42990553, 0.15874285, 0.07398051, -0.032362957));
    result += mul(conv2d_2_texOff(float2(-1, 0)), float4x4(0.103218086, 0.30208942, -0.091227196, -0.07436102, 0.24447371, 0.06551555, -0.14528611, -0.016993651, 0.08139388, -0.19716902, 0.15390721, -0.15553702, -0.29847378, 0.039158564, 0.16514164, -0.05630444));
    result += mul(conv2d_2_texOff(float2(0, 0)), float4x4(-0.10350748, 0.59938335, 0.08224635, -0.39390093, -0.048800346, 0.25220042, 0.27965719, -0.7149586, -0.117753714, 0.89318556, 0.10694615, -0.40107867, 0.3126249, 0.20058535, -0.26210746, -0.21957305));
    result += mul(conv2d_2_texOff(float2(1, 0)), float4x4(-0.15874729, 0.2735882, 0.1038441, -0.028996622, 0.18262653, -0.11277957, -0.09065718, -0.12505332, 0.014910041, -0.30493712, -0.06908394, 0.15140194, -0.053679354, -0.04235772, -0.066772215, -0.0788772));
    result += mul(conv2d_2_texOff(float2(-1, 1)), float4x4(0.18722679, 0.022233652, -0.28068626, 0.1564011, 0.052735806, -0.024578447, 0.055972375, 0.023434438, -0.015232564, -0.11003659, -0.02958382, 0.07606593, -0.16451985, 0.05277438, -0.15513985, 0.20419632));
    result += mul(conv2d_2_texOff(float2(0, 1)), float4x4(-0.44324756, 0.06180463, -0.19807127, 0.8873653, -0.28618175, 0.22352956, 0.11273026, 0.4716805, 0.0895035, -0.056281384, -0.17583643, 0.48653698, 0.23335673, -0.33337352, 0.18437086, -0.07844706));
    result += mul(conv2d_2_texOff(float2(1, 1)), float4x4(0.10640872, -0.21415141, 0.058799107, -0.08614742, -0.08880996, 0.11127377, 0.06347164, 0.2256829, 0.22119509, -0.01713325, 0.061465573, -0.08665336, -0.1289203, -0.16052137, -0.038039066, 0.082929656));
    result += mul(conv2d_3_texOff(float2(-1, -1)), float4x4(0.48343894, -0.070697255, 0.16088535, -0.049593706, 0.7289105, -0.37932575, 0.17126024, -0.0018209993, 0.13588835, 0.000733389, 0.09432972, 0.008547268, 0.022721222, 0.20453632, 0.0046762694, -0.0052664373));
    result += mul(conv2d_3_texOff(float2(0, -1)), float4x4(-0.35105914, -0.059789762, 0.0025750978, 0.09753049, -0.48997068, 0.28137153, 0.037127644, 0.024901079, 0.24922512, -0.14859363, -0.05524299, -0.037807938, 0.066167325, -0.14446808, 0.025121788, -0.026967036));
    result += mul(conv2d_3_texOff(float2(1, -1)), float4x4(0.31942683, 0.067160465, 0.049225427, -0.10680461, 0.46816394, -0.22563934, 0.19540606, -0.10584391, -0.09178188, 0.05149975, -0.0010295778, 0.026105061, 0.4168506, -0.056370676, 0.10088538, -0.0026953747));
    result += mul(conv2d_3_texOff(float2(-1, 0)), float4x4(-0.116989516, -0.053696584, 0.04436822, 0.026163863, 0.29693225, -0.019489178, -0.053970225, -0.05598454, -0.27940547, 0.17396632, 0.0052333605, -0.04871796, 0.023473052, -0.07443703, 0.010630465, -0.09411582));
    result += mul(conv2d_3_texOff(float2(0, 0)), float4x4(0.1903902, -0.225679, 0.107205056, 0.048262734, -0.4323833, 0.5121899, -0.0021411914, 0.089033075, -0.53095746, 0.6508796, 0.05552415, 0.01372532, -0.22403194, 0.11387373, 0.09417494, 0.085450724));
    result += mul(conv2d_3_texOff(float2(1, 0)), float4x4(0.109713174, -0.12878585, -0.15289974, 0.06266312, -0.5393066, -0.09059529, -0.21852681, -0.10893665, 0.008127227, 0.23362394, 0.01760005, 0.16698825, -0.2058406, 0.16153622, 0.09917509, 0.0061361874));
    result += mul(conv2d_3_texOff(float2(-1, 1)), float4x4(-0.0812119, 0.015507757, -0.04380506, 0.040541146, -0.20703554, 0.19549869, 0.16456963, -0.10641857, -0.14982757, -0.19207758, -0.07521612, 0.36622483, -0.08804933, 0.07587366, 0.048089113, 0.12791353));
    result += mul(conv2d_3_texOff(float2(0, 1)), float4x4(0.10483639, 0.07315888, 0.052412137, -0.6182126, 0.11304849, -0.17139891, -0.065931834, 0.3703708, 0.3798335, -0.007348117, -0.1534934, 1.8182076, -0.015534727, 0.090940274, -0.019033115, 0.44617748));
    result += mul(conv2d_3_texOff(float2(1, 1)), float4x4(-0.026784025, 0.04566704, -0.07920087, -0.16164441, 0.08522715, -0.084198974, -0.16052303, 0.04330756, -0.30104852, -0.028167121, 0.073713526, 0.2923644, -0.08894674, 0.020327676, -0.08958633, 0.22356156));
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
