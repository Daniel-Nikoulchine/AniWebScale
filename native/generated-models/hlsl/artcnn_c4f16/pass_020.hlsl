// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:963
// Pass: 020 - ArtCNN C4F16 (Conv2D-5)
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
    float4 result = float4(-0.0046058428, 0.005212825, 0.012921961, -0.021657614);
    result += mul(conv2d_4_0_texOff(float2(-1, -1)), float4x4(0.19389677, -0.27225208, -0.2882981, 0.051169064, -0.0066490714, 0.11661897, 0.09581431, -0.067389786, 0.04324981, -0.009343044, -0.1244613, 0.049292274, -0.14612213, -0.07448483, 0.16295147, -0.033708435));
    result += mul(conv2d_4_0_texOff(float2(0, -1)), float4x4(-0.5046244, -1.1395669, -0.22023806, -0.3187139, 0.22301668, 0.17515856, -0.004108559, 0.0025478054, 0.014157969, -0.08523709, -0.09110908, -0.011753981, -0.092901215, 0.06941843, 0.08041688, 0.040902436));
    result += mul(conv2d_4_0_texOff(float2(1, -1)), float4x4(0.7319547, -0.34011197, -0.8205684, -0.28251597, 0.21645252, 0.092770964, -0.08088839, -0.091692425, -0.07401221, -0.099718235, -0.042494584, 0.01762102, 0.055501044, 0.05928257, 0.016098335, 0.00022300667));
    result += mul(conv2d_4_0_texOff(float2(-1, 0)), float4x4(0.0016161703, 0.09953873, 0.08970216, 0.1327271, -0.016401, 0.13582356, 0.03703193, -0.02019584, -0.10886389, -0.09340892, -0.08233981, -0.059727557, 0.01139906, 0.06710453, -0.1329292, 0.06650684));
    result += mul(conv2d_4_0_texOff(float2(0, 0)), float4x4(0.1558217, 0.14569177, 0.22807567, 0.3020685, 0.12979834, 0.13110432, 0.7708671, 0.17314744, 0.3219217, -0.796913, -0.051907737, -0.17559808, -0.5800078, 0.7855478, -0.16054949, 0.054042686));
    result += mul(conv2d_4_0_texOff(float2(1, 0)), float4x4(0.16729072, -0.0033539594, -0.11221695, 0.061587077, 0.10267084, 0.42151323, -0.11985879, 0.0051882192, -0.22496945, -0.16471589, 0.060481522, 0.1298748, 0.27089906, 0.21022657, -0.036798015, -0.12839426));
    result += mul(conv2d_4_0_texOff(float2(-1, 1)), float4x4(-0.008069083, -0.018361261, 0.0058130627, -0.019507505, -0.004968405, 0.10468032, 0.070409805, -0.025619831, -0.018653382, -0.07758147, 0.157201, 0.003641471, -0.06347895, 0.014764349, -0.21847312, -0.018000789));
    result += mul(conv2d_4_0_texOff(float2(0, 1)), float4x4(0.12193894, -0.1508844, 0.21069832, 0.056517374, 0.1745019, 0.016116083, -0.17549814, -0.00992217, -0.024773803, -0.08727088, 0.0026184153, 0.024559254, -0.3847933, 0.1625314, -0.4773209, -0.010552129));
    result += mul(conv2d_4_0_texOff(float2(1, 1)), float4x4(-0.05026804, 0.0108059235, -0.08473639, -0.024395963, -0.073317036, 0.10680924, 0.028244872, 0.012412284, 0.1307238, 0.0037085572, -0.087195, 0.02160026, -0.28075743, 0.09972282, -0.050476495, -0.010333448));
    result += mul(conv2d_4_1_texOff(float2(-1, -1)), float4x4(-0.0121236, 0.06673866, 0.034106728, -0.05502671, -0.03263476, 0.05077971, -0.09175334, 0.0865722, -0.065320686, -0.10994492, -0.19257952, -0.008085057, 0.088351995, 0.05000395, -0.08804564, 0.002297372));
    result += mul(conv2d_4_1_texOff(float2(0, -1)), float4x4(0.18148836, 0.08157221, -0.21563083, -0.03854613, -0.20382254, 0.44528115, 0.6632362, 0.10012859, -0.15784386, -0.20279016, 0.30607724, 0.010845128, 0.11480156, -0.017181754, -0.2520427, -0.013962291));
    result += mul(conv2d_4_1_texOff(float2(1, -1)), float4x4(0.07617448, 0.12374886, 0.09877941, 0.05179499, 0.22586305, 0.13381207, 0.01547748, -0.07890073, -0.19837798, -0.17193808, -0.08492975, 0.06100193, -0.03853939, -0.047186095, 0.007225524, 0.0064335666));
    result += mul(conv2d_4_1_texOff(float2(-1, 0)), float4x4(0.00050251366, 0.05349968, 0.19070026, 0.009101704, -0.00823973, 0.05938012, -0.12813334, -0.009267065, 0.00886042, -0.010747575, -0.120411426, -0.0020400167, -0.07735248, -0.048074313, 0.045966174, -0.10188805));
    result += mul(conv2d_4_1_texOff(float2(0, 0)), float4x4(0.47637275, 0.30827975, 0.14313719, 0.07290924, 0.3918802, 0.14753833, 0.4506131, 0.04035203, 0.5078675, -0.2089705, 0.46678248, -0.08628992, 0.69803417, -0.32316223, 0.0062144995, 0.24215809));
    result += mul(conv2d_4_1_texOff(float2(1, 0)), float4x4(0.012016319, 0.061414074, -0.049625512, -0.06147865, -0.09082405, 0.0009342906, 0.029740458, -0.12808788, 0.02906642, 0.032953132, 0.08009774, 0.023292352, -0.079993665, -0.1158889, 0.03731151, 0.006291906));
    result += mul(conv2d_4_1_texOff(float2(-1, 1)), float4x4(0.011069854, 0.052224573, 0.017319899, -0.046655577, 0.012141326, 0.0985947, -0.014344675, -0.01632606, 0.0060027456, 0.0080376, 0.028505161, 0.012246881, 0.039454617, -0.11356179, 0.30669174, -0.0327598));
    result += mul(conv2d_4_1_texOff(float2(0, 1)), float4x4(0.17390352, -0.04630631, 0.21522047, 0.092027485, 0.22104979, -0.003536516, 0.15659404, 0.046261743, 0.093689404, 0.15981363, 0.20411302, -0.018281814, -0.091964126, -0.31209698, -0.029673379, -0.04541488));
    result += mul(conv2d_4_1_texOff(float2(1, 1)), float4x4(0.06697285, -0.0119530745, -0.05018244, -0.027919305, 0.033769708, -0.03651726, 0.0972312, -0.014531796, -0.070508555, -0.03142768, -0.032039266, 0.0053280042, 0.02754257, -0.0016127621, -0.11080957, -0.040205475));
    result += mul(conv2d_4_2_texOff(float2(-1, -1)), float4x4(-0.04459316, -0.020145401, -0.070191145, 0.05478726, 0.013271327, 0.120192125, -0.11946146, -0.048723545, -0.019995572, 0.049702097, 0.4341854, 0.016926156, 0.06543606, 0.0044756634, 0.02038207, -0.005961019));
    result += mul(conv2d_4_2_texOff(float2(0, -1)), float4x4(-0.010252045, -0.022353375, 0.008297757, -0.005176174, -0.03806909, -0.01120082, -0.052997075, -0.08485304, -0.24879071, 0.009661233, -0.08115842, 0.20606172, 0.09437411, -0.015051135, -0.09731951, 0.073190585));
    result += mul(conv2d_4_2_texOff(float2(1, -1)), float4x4(-0.0950823, -0.0056368955, 0.04274139, 0.060248025, -0.062246792, 0.05463412, 0.068878524, 0.10778997, 0.0053441743, -0.045129903, -0.096994266, -0.030491488, 0.17240083, 0.059293024, -0.11109345, -0.051375125));
    result += mul(conv2d_4_2_texOff(float2(-1, 0)), float4x4(-0.062367186, -0.10251947, 0.035803735, -0.023216473, -0.03482453, -0.014733565, -0.022189397, 0.01718841, -0.6877828, 0.30470863, 0.14904284, -0.55432695, 0.23189475, -0.27477595, 0.12857756, -0.07082673));
    result += mul(conv2d_4_2_texOff(float2(0, 0)), float4x4(0.020106582, -0.22201188, 0.10985804, -0.030566327, -0.043806694, -0.010263682, 0.029081948, 0.01480458, -0.005761393, 0.11860039, -0.110451706, 0.24077345, 0.03869298, 0.26465046, -0.14790255, 0.043383174));
    result += mul(conv2d_4_2_texOff(float2(1, 0)), float4x4(0.060761817, -0.017527325, 0.01143561, -0.03381863, 0.05698004, 0.027646573, -0.10107021, 0.011310894, -0.04749434, 0.009203107, 0.078599855, 0.022043923, 0.12643756, 0.26718026, 0.23576681, -0.049430773));
    result += mul(conv2d_4_2_texOff(float2(-1, 1)), float4x4(-0.06894599, 0.030372735, -0.095058136, 0.010405493, 0.00412649, -0.020780176, 0.10398297, 0.0959327, -0.8437872, 0.054067798, -0.56447184, -0.19882686, -0.045887846, -0.068280265, -0.054478545, 0.06178138));
    result += mul(conv2d_4_2_texOff(float2(0, 1)), float4x4(-0.18645425, -0.006724791, -0.2708013, -0.036270343, -0.07991544, 0.054539707, 0.054901365, -0.06866429, 0.05965903, -0.095842175, 0.014839498, 0.20018297, 0.23209353, 0.079986736, 0.19874366, 0.015036369));
    result += mul(conv2d_4_2_texOff(float2(1, 1)), float4x4(-0.13901149, 0.10902376, -0.10668649, 0.0006584793, 0.100749545, 0.04151468, -0.023726981, -0.03544007, 0.06667295, -0.020391293, -0.051224902, 0.04423867, 0.40735385, -0.08745141, 0.1207007, 0.0074353246));
    result += mul(conv2d_4_3_texOff(float2(-1, -1)), float4x4(0.14925653, 0.10942493, -0.18713869, 0.020121653, 0.07544863, -0.10641829, -0.19798315, 0.11287987, 0.03200719, 0.12528892, -0.01733709, -0.038658936, 0.038368344, -0.041417774, -0.106817834, 0.05586089));
    result += mul(conv2d_4_3_texOff(float2(0, -1)), float4x4(-0.24815804, 0.050469387, 0.27696633, -0.009440993, -0.2557776, -0.19892988, 0.2756454, 0.058421057, 0.13255183, 0.24231423, -0.030450813, -0.034188997, -0.2272282, -0.17671272, 0.1626445, -0.029350769));
    result += mul(conv2d_4_3_texOff(float2(1, -1)), float4x4(0.09582922, 0.10541782, 0.11326632, -0.012945515, -0.07312869, -0.23303384, -0.11569598, -0.063622475, -0.005206319, 0.14460406, 0.09438645, 0.03014926, -0.16861854, -0.08220482, 0.18029231, 0.023086865));
    result += mul(conv2d_4_3_texOff(float2(-1, 0)), float4x4(-0.11264253, 0.14729688, 0.21660301, -0.004237415, 0.23325214, -0.24381638, 0.11018029, -0.05075595, -0.23623419, 0.25395072, -0.06165826, -0.0061221244, -0.031547062, -0.0810339, 0.10768932, 0.03178501));
    result += mul(conv2d_4_3_texOff(float2(0, 0)), float4x4(0.4603194, -0.7932959, 0.15675978, -0.037893485, -0.3004102, -0.68054926, -0.4536296, -0.3313133, 0.43278825, 0.584298, 0.36294737, 0.2552247, -0.31576243, -0.30143702, -0.472689, 0.18369812));
    result += mul(conv2d_4_3_texOff(float2(1, 0)), float4x4(-0.3314296, -0.0771972, -0.20025831, 0.07449619, -0.11189193, -0.050764713, 0.15880072, 0.07918999, 0.23864625, 0.11535901, -0.059230275, -0.037623476, -0.26347345, -0.77499944, -0.41018212, -0.20302838));
    result += mul(conv2d_4_3_texOff(float2(-1, 1)), float4x4(-0.08411099, -0.031019026, 0.15782383, -0.040728603, -0.11886809, -0.30250293, 0.23659365, 0.12095257, 0.17126809, 0.14316653, -0.2635601, -0.06740826, -0.027033098, -0.09652441, -0.046544086, 0.0032770399));
    result += mul(conv2d_4_3_texOff(float2(0, 1)), float4x4(0.124800056, -0.2669741, 0.17318267, 0.027937155, -0.31934997, -0.15632407, -0.31001234, -0.0040938607, 0.23215924, 0.108112164, 0.36297593, -0.050378047, 0.011474003, 0.019642692, 0.17266637, 0.028871005));
    result += mul(conv2d_4_3_texOff(float2(1, 1)), float4x4(-0.15403704, 0.024767928, 0.030709596, -0.0033760846, 0.29057547, -0.08089044, 0.10644629, 0.08037557, -0.10780421, 0.07285366, 0.13657749, -0.021018857, -0.02233285, -0.063164905, -0.18219627, -0.08395923));
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
