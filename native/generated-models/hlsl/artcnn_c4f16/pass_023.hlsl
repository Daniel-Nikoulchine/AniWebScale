// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:1122
// Pass: 023 - ArtCNN C4F16 (Conv2D-5)
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
    float4 result = float4(-0.0065392265, 0.005505473, 0.038484864, -0.023193495);
    result += mul(conv2d_4_0_texOff(float2(-1, -1)), float4x4(-0.004498335, 0.7382404, -0.23442575, -0.16252717, -0.026009846, 0.030434566, -0.019475065, -0.06431268, 0.03640449, -0.0040360987, -0.019910527, 0.034736615, -0.0031087424, -0.059120674, 0.013791684, 0.07218719));
    result += mul(conv2d_4_0_texOff(float2(0, -1)), float4x4(-0.14135005, 0.9959563, -0.07486524, -0.28778628, 0.22581334, 0.18538788, 0.015065921, -0.053519074, 0.22171287, -0.055427834, -0.033601474, -0.01870319, -0.4460602, 0.011371301, -0.030472377, 0.073513664));
    result += mul(conv2d_4_0_texOff(float2(1, -1)), float4x4(-0.06576149, 0.8906462, 0.25279918, -0.17556128, -0.047801867, 0.2259101, -0.01251869, -0.092829406, 0.11101776, 0.016275465, -0.055292428, 0.01025174, -0.0492993, -0.00035494883, 0.028828753, -0.0046440396));
    result += mul(conv2d_4_0_texOff(float2(-1, 0)), float4x4(-0.06606361, -0.01837148, -0.061049685, 0.08262097, 0.0716313, 0.22714345, -0.015877271, -0.041385885, 0.041346684, -0.23551546, -0.00023523516, 0.032250866, -0.044792954, 0.15078856, 0.03858805, 0.08497739));
    result += mul(conv2d_4_0_texOff(float2(0, 0)), float4x4(0.14461994, -0.1292499, -0.29278296, -0.101024054, -0.13546948, 0.6519248, 0.0064214906, -0.022855721, 0.55985254, 0.1017415, -0.05776304, 0.19156395, -0.67645437, -0.08790101, 0.13466574, -0.09291871));
    result += mul(conv2d_4_0_texOff(float2(1, 0)), float4x4(-0.14176573, 0.04247601, 0.03601427, 0.05184529, 0.08912003, 0.39625162, 0.021573871, -0.08251388, 0.11452551, 0.17396334, -0.09813042, 0.22368798, -0.33811107, -0.18624362, 0.16351652, -0.18633647));
    result += mul(conv2d_4_0_texOff(float2(-1, 1)), float4x4(-0.023228921, 0.015240777, 0.025224067, -0.0013570306, 0.0024748559, 0.1474697, 0.0020307095, -0.029064147, 0.043071818, 0.06558123, 0.010087709, 0.037556857, 0.0050289035, 0.019036705, -0.0029892956, -0.046553254));
    result += mul(conv2d_4_0_texOff(float2(0, 1)), float4x4(0.01785854, -0.0823758, -0.042477038, 0.058690716, -0.12990497, 0.23681645, 0.0335883, 0.034112733, 0.31397334, -0.23970205, -0.06736681, 0.055550084, -0.098263465, 0.19022475, 0.07386713, -0.14189075));
    result += mul(conv2d_4_0_texOff(float2(1, 1)), float4x4(-0.037102748, -0.015309524, 0.013480297, -0.080538, 0.062314484, 0.11511907, 0.005406217, 0.010978191, 0.054147407, -0.04782157, 0.0350167, 0.028420083, 0.0006020371, -0.01542334, -0.061944753, -0.12089187));
    result += mul(conv2d_4_1_texOff(float2(-1, -1)), float4x4(-0.02389505, -0.09774415, 0.01865464, -0.0404036, -0.12988602, 0.0041870335, -0.07635182, -0.014002439, -0.050262745, -0.08412568, -0.0012902165, 0.058651965, 0.040363505, -0.010439004, 0.046584167, -0.030844558));
    result += mul(conv2d_4_1_texOff(float2(0, -1)), float4x4(0.27201438, -0.051534697, 0.0044010533, -0.06268029, -0.5597928, 0.40176544, 0.06774989, 0.071904086, -0.46742377, 0.19395615, -0.05584675, 0.13491926, 0.3680567, -0.08017979, 0.00958034, -0.085048616));
    result += mul(conv2d_4_1_texOff(float2(1, -1)), float4x4(-1.9126996e-05, 0.0032694484, 0.027378296, 0.02423276, -0.3841696, -0.2068046, 0.055755295, -0.07783296, -0.12706462, -0.0627655, -0.106189005, 0.12976898, 0.060044404, -0.075718306, -0.008698159, -0.0037293625));
    result += mul(conv2d_4_1_texOff(float2(-1, 0)), float4x4(0.20093523, 0.102455445, 0.03862854, 0.0015625904, -0.14757894, -0.0007734277, -0.015811099, 0.03214036, -0.16129225, -0.30809388, -0.01148391, 0.031855796, 0.14568266, -0.2930857, 0.059234947, -0.047282416));
    result += mul(conv2d_4_1_texOff(float2(0, 0)), float4x4(0.85413104, -0.43009627, -0.09496212, -0.09936201, -0.78981036, 0.08809805, -0.11402425, -0.05807362, -0.39567554, -0.1358343, 0.19961269, 0.23090747, 0.7852341, -0.21848042, 0.10988736, 0.11791884));
    result += mul(conv2d_4_1_texOff(float2(1, 0)), float4x4(0.46641496, 0.2176781, 0.053700782, -0.09768442, -0.024710014, 0.10322807, 0.032842994, -0.15724933, -0.18454032, -0.02390276, -0.021784574, 0.015929505, 0.44618633, 0.3092629, 0.11343408, 0.06997572));
    result += mul(conv2d_4_1_texOff(float2(-1, 1)), float4x4(0.021179881, 0.03247151, 0.026292978, 0.0051735314, -0.08635175, 0.046521984, 0.008453887, -0.023512052, -0.05742048, -0.010242954, -0.019971563, -0.019001395, 0.058213618, 0.0894563, 0.028324258, 0.017036825));
    result += mul(conv2d_4_1_texOff(float2(0, 1)), float4x4(0.16187875, 0.059428733, -0.011575559, 0.079413526, -0.31291133, 0.03721217, -0.061725166, -0.0004606492, -0.2154462, 0.23912174, -0.026152378, -0.07183964, 0.72291225, -0.08578942, 0.07202447, 0.11918941));
    result += mul(conv2d_4_1_texOff(float2(1, 1)), float4x4(0.037263725, 0.08655617, 0.025633156, -0.037392396, -0.036254805, 0.097237885, 0.000736203, -0.0074897436, -0.02281841, -0.02823047, -0.013682937, 0.0042696786, 0.063893884, -0.16560422, 0.018981777, -0.03075242));
    result += mul(conv2d_4_2_texOff(float2(-1, -1)), float4x4(-0.030512515, -0.14062811, -0.00028358566, 0.05434178, 0.10487504, -0.10655921, -0.022454755, -0.11245248, -0.22988679, -0.013957052, 0.033242017, 0.30757704, 0.15296516, -0.004991719, 0.07405563, -0.041401833));
    result += mul(conv2d_4_2_texOff(float2(0, -1)), float4x4(0.006912667, 0.046435703, -0.024738714, 0.02576836, 0.11660831, -0.112938136, -0.0823693, 0.056789715, 0.012508529, 0.054217007, -0.09756882, 0.1846172, 0.30575746, -0.24835579, 0.028845549, -0.10909295));
    result += mul(conv2d_4_2_texOff(float2(1, -1)), float4x4(0.0065615964, -0.01006514, -0.031088598, 0.06975595, -0.031854518, -0.0678821, 0.13133197, 0.0659807, 0.025306372, 0.04854298, 0.018680708, -0.022799045, -0.0056311805, 0.023007361, 0.110254556, -0.05062043));
    result += mul(conv2d_4_2_texOff(float2(-1, 0)), float4x4(-0.0586441, 0.004390161, -0.00094305887, 0.043951567, -0.105222724, -0.0069213253, -0.046724018, 0.09720702, -0.7986804, -0.6915094, 0.15964006, 0.41028076, 0.045694288, 0.13104492, 0.0019013828, -0.080436245));
    result += mul(conv2d_4_2_texOff(float2(0, 0)), float4x4(-0.22457233, -0.06028292, 0.015360867, 0.10783317, -0.11009472, 0.02309999, 0.06519778, 0.05550515, 0.16984332, -0.00753768, -0.25339532, 0.16639428, 0.32667893, 0.52505296, -0.29542357, -0.029623816));
    result += mul(conv2d_4_2_texOff(float2(1, 0)), float4x4(-0.14976867, -0.103489116, 0.11772881, 0.029823834, 0.124481365, 0.032951467, -0.0140607115, 0.052572567, -0.008575431, -0.019206066, -0.034908418, 0.016314821, 0.044483814, -0.032880496, -0.10741484, -0.14184819));
    result += mul(conv2d_4_2_texOff(float2(-1, 1)), float4x4(0.036616057, 0.031012429, -0.007736401, 0.025544597, 0.030781105, -0.05044406, -0.074159086, -0.022869738, 0.11088957, 0.4671611, -0.0433918, -0.17891024, 0.059569646, 0.13219304, -0.027213413, 0.004930265));
    result += mul(conv2d_4_2_texOff(float2(0, 1)), float4x4(0.0110268835, -0.16787328, -0.0367127, -0.032555077, -0.044285633, -0.11459858, -0.0996694, -0.07973965, -0.087829545, -0.087584995, 0.047419924, 0.37592712, -0.22941533, -0.23604631, 0.030034043, 0.11473111));
    result += mul(conv2d_4_2_texOff(float2(1, 1)), float4x4(-0.013475902, 0.011221588, -0.032619096, -0.023867419, -0.05961677, -0.100874946, -0.08419209, 0.13437943, -0.04917975, -0.016557503, -0.005626538, 0.05099933, 0.119277515, 0.40966216, 0.12232688, 0.15552276));
    result += mul(conv2d_4_3_texOff(float2(-1, -1)), float4x4(-0.17383687, 0.056015685, -0.13457276, -0.094173595, 0.08541814, 0.0802234, -6.863306e-05, 0.06377264, 0.00837476, 0.006046353, -0.0007712417, -0.0714822, -0.0060935486, -0.048998035, -0.012608388, 0.06324709));
    result += mul(conv2d_4_3_texOff(float2(0, -1)), float4x4(0.2681609, -0.045353588, 0.0019435219, 0.049735688, -0.0086974, -0.16535933, 0.027251042, 0.031339735, -0.0873862, 0.11553186, -0.033854503, -0.024738472, -0.35593885, -0.1095627, -0.09063419, -0.01407064));
    result += mul(conv2d_4_3_texOff(float2(1, -1)), float4x4(-0.16411924, -0.058848083, 0.008341498, -0.027252585, 0.16069295, 0.052778646, 0.014279131, -0.004711519, -0.14813447, -0.085974984, -0.074782446, -0.012456033, -0.17258914, -0.19018906, 0.010064231, 0.030049432));
    result += mul(conv2d_4_3_texOff(float2(-1, 0)), float4x4(-0.26517156, -0.0023467026, -0.017345991, -0.015541716, -0.36826465, 0.12569544, -0.09943614, -0.099922866, 0.36723468, -0.15493457, 0.032652047, 0.01431749, -0.058520526, -0.05622772, 0.020992534, 0.09949147));
    result += mul(conv2d_4_3_texOff(float2(0, 0)), float4x4(-0.011474144, -0.39699376, 0.08601021, 0.030674784, -0.49576348, 0.86384445, -0.24836868, 0.1845064, 0.4399953, -0.6143563, 0.24876258, -0.09418015, 0.2689243, -0.17353937, 0.09236233, 0.0019230074));
    result += mul(conv2d_4_3_texOff(float2(1, 0)), float4x4(0.20494951, 0.042979673, 0.05320085, 0.103428, -0.11671929, 0.043464035, -0.21789098, 0.12439032, 0.14611116, 0.09671864, 0.077389866, -0.107675254, 0.03900112, -0.2192547, 0.14579615, -0.102687955));
    result += mul(conv2d_4_3_texOff(float2(-1, 1)), float4x4(0.054881938, 0.15462708, 0.033736564, 0.007717613, 0.12884334, 0.2593043, -0.0820078, 0.015391515, -0.081882976, -0.5672288, 0.04597541, 0.037898924, 0.06655861, -0.13261534, 0.014377042, 0.027393572));
    result += mul(conv2d_4_3_texOff(float2(0, 1)), float4x4(-0.011002876, 0.017118147, -0.09743599, 0.13069719, -0.00014427115, -0.037537202, 0.024229925, -0.005541604, 0.11016941, -0.01222874, 0.058772508, 0.022410862, 0.008864335, -0.10432079, -0.07631634, -0.11032984));
    result += mul(conv2d_4_3_texOff(float2(1, 1)), float4x4(-0.1325417, -0.26567414, -0.04465557, 0.007787243, 0.0036025965, 0.16317958, 0.02426103, 0.15862551, -0.0657389, -0.18749335, -0.030442923, -0.06585903, -0.02071046, -0.075505026, -0.031514905, -0.16328533));
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
