// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:1069
// Pass: 022 - ArtCNN C4F16 (Conv2D-5)
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
    float4 result = float4(0.005315173, 0.0068329074, 0.007167859, -0.0022182257);
    result += mul(conv2d_4_0_texOff(float2(-1, -1)), float4x4(0.1819321, -0.10069715, -0.56305903, -0.031408414, -0.0010220526, 0.04410775, 0.023534155, -0.076077715, 0.016343221, -0.03915077, 0.060177393, 0.010204896, 0.03090649, 0.013399607, -0.17974426, 0.04952285));
    result += mul(conv2d_4_0_texOff(float2(0, -1)), float4x4(-0.6853877, 0.3509258, -1.889028, -0.7537202, -0.08943437, 0.010928991, 0.13570602, 0.085657045, 0.008678048, -0.0506846, -0.11012289, -0.04290924, 0.036576256, 0.08072861, 0.26064616, 0.07841367));
    result += mul(conv2d_4_0_texOff(float2(1, -1)), float4x4(-0.7983655, -0.07582235, -0.81013745, -0.17003655, -0.178483, 0.0036447877, 0.35942432, 0.21794055, 0.09581998, 0.017877588, -0.07483371, -0.022427883, -0.057632413, -0.015660333, 0.053480994, 0.010001192));
    result += mul(conv2d_4_0_texOff(float2(-1, 0)), float4x4(0.10337186, 0.010249481, 0.017099844, 0.049394086, -0.057619963, -0.0063953227, 0.1928079, 0.12621345, 0.1183518, -0.05359774, -0.05365863, 0.028896667, -0.15354806, 0.016272211, -0.12500714, -0.05392304));
    result += mul(conv2d_4_0_texOff(float2(0, 0)), float4x4(0.011112799, -0.019715535, -0.06859227, -0.2722086, -0.2191223, -0.033132926, 0.16916408, 0.2879418, 0.4805711, -0.15429355, -0.25304192, 0.023876974, -0.6999365, 0.20885533, 0.025221128, 0.37925896));
    result += mul(conv2d_4_0_texOff(float2(1, 0)), float4x4(-0.1818296, -0.014779359, -0.0081722485, 0.08720626, -0.24833989, -0.00966718, -0.37916672, -0.091450945, 0.054201644, 0.10518615, 0.05624916, -0.021449104, -0.11512616, -0.117606595, -0.06639914, 0.15290065));
    result += mul(conv2d_4_0_texOff(float2(-1, 1)), float4x4(-0.030962823, -0.0002851719, 0.04299268, 0.0027301516, -0.023909122, -0.0073004253, -0.023746766, -0.028603237, 0.01975406, 0.0074183145, 0.067388155, 0.09511019, -0.056096673, -0.07942487, -0.06599244, -0.05913857));
    result += mul(conv2d_4_0_texOff(float2(0, 1)), float4x4(0.09368116, 0.13738814, 0.005655028, -0.12111693, -0.18685599, -0.02409882, 0.09168004, -0.22705762, 0.13038078, 0.06706328, 0.12099261, 0.05291525, -0.1732984, -0.16314857, -0.23372824, -0.16478488));
    result += mul(conv2d_4_0_texOff(float2(1, 1)), float4x4(-0.014798146, -0.049854595, -0.043482315, 0.07720533, -0.091951944, -0.0219097, 0.15792601, 0.005950095, -0.13656631, -0.027217032, -0.013535835, -0.027099103, 0.12426327, -0.047558777, 0.0145280305, 0.12486148));
    result += mul(conv2d_4_1_texOff(float2(-1, -1)), float4x4(-0.0397764, 0.013363183, 0.15334536, -0.07414761, 0.21588503, 0.069472805, 0.07559286, -0.00063712173, 0.18039605, -0.121958695, 0.07903284, 0.050454576, -0.08978905, -0.026396312, 0.1420245, -0.05388732));
    result += mul(conv2d_4_1_texOff(float2(0, -1)), float4x4(0.04810902, -0.09963507, 0.13604484, 0.055430148, -0.1667439, 0.252138, -0.12428751, 0.008064209, 0.103029475, -0.068082854, -0.12134497, -0.44988948, 0.034101363, -0.08167177, -0.22961035, -0.093827896));
    result += mul(conv2d_4_1_texOff(float2(1, -1)), float4x4(-0.18063928, -0.03212599, 0.023047665, -0.062487286, -0.055016976, -0.019563297, 0.035497986, -0.09763464, 0.22336556, 0.09770599, 0.075357504, -0.08553967, 0.028924353, -0.009036933, -0.17879684, -0.09780838));
    result += mul(conv2d_4_1_texOff(float2(-1, 0)), float4x4(-0.043598723, 0.074995935, 0.10249763, 0.20742017, 0.13621221, 0.02011832, 0.039163906, 0.10367399, 0.055429846, 0.025251398, -0.00250794, -0.026109425, 0.015317543, 0.0034172588, 0.09105031, 0.10482383));
    result += mul(conv2d_4_1_texOff(float2(0, 0)), float4x4(0.16469331, -0.004312381, 0.12050329, -0.07711246, -0.049835697, 0.20589551, 0.10620115, -0.22307, -0.17793256, 0.12491768, -0.17090927, 0.02584684, 0.33751822, -0.11461893, -0.21403389, -0.39865944));
    result += mul(conv2d_4_1_texOff(float2(1, 0)), float4x4(-0.19102523, -0.071873985, -0.047497097, -0.0110635795, 0.072642006, -0.008701674, -0.03073483, -0.077908516, 0.018743942, 0.0115044, -0.0039941417, 0.047056276, -0.14695308, -0.0011504737, -0.018462537, 0.09516455));
    result += mul(conv2d_4_1_texOff(float2(-1, 1)), float4x4(-0.048107676, -0.026420243, 0.051700465, -0.044607215, -0.03736821, -0.008403403, -0.02541539, -0.042960647, 0.030169304, 0.01761444, -0.024339525, 0.013791705, 0.04155985, 0.02221078, 0.10440732, 0.15130566));
    result += mul(conv2d_4_1_texOff(float2(0, 1)), float4x4(-0.017837455, 0.12144203, 0.11322036, -0.13330273, 0.02803301, 0.05698418, 0.091223046, 0.114012145, -0.019824836, -0.035768367, 0.017741183, -0.022839265, 0.06685652, 0.13666743, 0.10626553, -0.35538685));
    result += mul(conv2d_4_1_texOff(float2(1, 1)), float4x4(-0.04245035, 0.00062688807, -0.101780295, 0.006774724, 0.04187574, 0.021524709, -0.04342309, 0.04481415, 0.01763527, 0.0066013397, 0.06749929, 0.007349219, -0.037265982, -0.01345228, 0.014733188, -0.030517904));
    result += mul(conv2d_4_2_texOff(float2(-1, -1)), float4x4(0.1041095, 0.008809134, 0.06763632, 0.023840217, -0.03500528, 0.002852506, 0.08582598, -0.011235882, -0.026544867, -0.13106325, 0.5031165, 0.31581768, -0.30895495, -0.018712353, 0.018321643, -0.11724277));
    result += mul(conv2d_4_2_texOff(float2(0, -1)), float4x4(0.11825586, -0.042725813, 0.0127466535, 0.01743529, -0.121880725, -0.069204584, 0.094399944, 0.09066489, 0.05982016, 0.09438551, 0.21537295, -0.15648238, -0.014048026, -0.003629559, -0.31901923, -0.17146479));
    result += mul(conv2d_4_2_texOff(float2(1, -1)), float4x4(0.06392357, 0.028090622, 0.06422469, -0.042204898, -0.034293033, -0.10245152, 0.086883776, 0.11984436, 0.00022682724, -0.0068074153, -0.08130857, 0.036693417, -0.13870034, -0.037033178, -0.13801923, -8.907394e-05));
    result += mul(conv2d_4_2_texOff(float2(-1, 0)), float4x4(0.048624326, -0.019816993, -0.025073681, 0.06525542, 0.11130433, -0.041820627, -0.06333492, -0.060643375, 0.08390979, -0.36927992, 0.47846526, -0.11101287, -0.0027453324, -0.048300445, -0.17147173, 0.14212558));
    result += mul(conv2d_4_2_texOff(float2(0, 0)), float4x4(-0.11884089, 0.14253803, 0.13881797, -0.1512116, 0.073131405, 0.0372121, 0.12890346, 0.11168775, -0.11295762, -0.07462291, -0.37557405, 0.4378717, 0.73582184, 0.21705467, -0.07539996, 0.07238097));
    result += mul(conv2d_4_2_texOff(float2(1, 0)), float4x4(-0.02668055, -0.018449884, 0.060646683, 0.20572701, -0.04308622, 0.108674966, -0.12060884, -0.1110968, 0.05428632, 0.021613482, -0.045123346, 0.026549077, 0.024624052, -0.020946233, -0.05628851, 0.07296458));
    result += mul(conv2d_4_2_texOff(float2(-1, 1)), float4x4(0.010177216, -0.025615431, -0.03760639, -0.0046753227, 0.033224136, -0.0791633, 0.0036944617, 0.03709486, -0.15780598, -0.39109758, 0.24438849, 0.2257188, -0.029551236, -0.033879776, -0.105515204, 0.0033823294));
    result += mul(conv2d_4_2_texOff(float2(0, 1)), float4x4(0.06725815, -0.054121602, -0.017513681, 0.20077823, -0.08054081, 0.1167204, -0.05521204, 0.0588108, -0.1992373, -0.035607886, 0.09266664, -0.40364465, 0.0009951696, 0.01597396, 0.042395424, 0.10316355));
    result += mul(conv2d_4_2_texOff(float2(1, 1)), float4x4(0.032572635, -0.023501327, -0.004521173, 0.012799089, 0.11303314, -0.025744988, 0.055695202, -0.0772635, -0.056142066, -0.0045359693, 0.07583708, -0.047903445, -0.21976635, 0.06503833, -0.027291398, -0.34382978));
    result += mul(conv2d_4_3_texOff(float2(-1, -1)), float4x4(0.20864888, 0.023359869, 0.24899648, 0.0093005225, 0.017775621, -0.03836717, -0.12553127, 0.11814874, 0.005999996, 0.034393538, 0.07011576, -0.0813388, 0.005207782, -0.029377893, 0.038768012, 0.07676662));
    result += mul(conv2d_4_3_texOff(float2(0, -1)), float4x4(0.04669245, 0.11919337, -0.052476272, 0.077117585, -0.024063464, 0.067579955, -0.057316836, -0.15264103, 0.17680405, -0.039894905, 0.078640506, 0.18916948, 0.09564513, 0.07334921, -0.1913392, 0.16994382));
    result += mul(conv2d_4_3_texOff(float2(1, -1)), float4x4(-0.0065509817, -0.0147284325, 0.28914604, 0.123860225, 0.14209397, 0.031994127, -0.1479914, 0.102770954, 0.027218182, 0.01326639, 0.20701481, -0.019160658, 0.16616306, -0.008583126, -0.22781608, -0.1521387));
    result += mul(conv2d_4_3_texOff(float2(-1, 0)), float4x4(0.06208931, -0.05245038, 0.26089093, -0.115328506, 0.010231228, -0.16057816, 0.043376707, -0.24909185, 0.05958783, 0.10846497, -0.13864477, -0.015445353, 0.10193929, -0.022797128, -0.18751355, -0.112518035));
    result += mul(conv2d_4_3_texOff(float2(0, 0)), float4x4(-0.39747435, -0.15848057, 0.38939852, -0.60420835, 0.4085152, 0.1947236, 0.75150216, 0.19412702, -0.4620192, -0.20466527, -0.44688827, -0.33231884, -0.10403903, 0.12399351, 0.14525194, -0.34896287));
    result += mul(conv2d_4_3_texOff(float2(1, 0)), float4x4(0.11838359, 0.026589971, 0.048098754, -0.18979469, 0.19110386, 0.15475678, 0.26738, -0.29855773, -0.14984666, -0.09327831, -0.27281287, 0.09201877, 0.08395858, -0.0627008, 0.2027869, 0.18337525));
    result += mul(conv2d_4_3_texOff(float2(-1, 1)), float4x4(-0.015467469, 0.016654927, 0.111788936, 0.06669349, 0.09452079, -0.007115365, -0.121632814, 0.26020503, 0.027290927, 0.06958785, 0.11523617, -0.1523752, 0.039963838, 0.028703734, 0.037412114, 0.061600797));
    result += mul(conv2d_4_3_texOff(float2(0, 1)), float4x4(0.14411928, 0.116167724, 0.15479048, -0.11285714, 0.0660568, -0.13472256, -0.17743146, 0.23337655, -0.009592609, 0.07058539, -0.056988627, -0.15537742, 0.2678336, 0.14936669, -0.17730036, 0.08627947));
    result += mul(conv2d_4_3_texOff(float2(1, 1)), float4x4(0.12774135, -0.0135159455, 0.008701118, 0.1716933, -0.14423874, 0.051691554, 0.09315147, -0.20945667, 0.10792683, -0.010766234, 0.0030609698, 0.10362881, 0.16425985, 0.015018802, -0.2064676, 0.06424018));
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
