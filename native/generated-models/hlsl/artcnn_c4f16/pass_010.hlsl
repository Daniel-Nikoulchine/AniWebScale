// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:433
// Pass: 010 - ArtCNN C4F16 (Conv2D-2-ReLU)
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

#define conv2d_1_0_tex(position) Anime4KSample0(position)
#define conv2d_1_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_1_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_1_0_pos anime4k_pos
#define conv2d_1_0_size float2(Anime4KInputSizes[0].xy)
#define conv2d_1_0_pt rcp(conv2d_1_0_size)
#define conv2d_1_1_tex(position) Anime4KSample1(position)
#define conv2d_1_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_1_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_1_1_pos anime4k_pos
#define conv2d_1_1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_1_1_pt rcp(conv2d_1_1_size)
#define conv2d_1_2_tex(position) Anime4KSample2(position)
#define conv2d_1_2_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_1_2_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_1_2_pos anime4k_pos
#define conv2d_1_2_size float2(Anime4KInputSizes[2].xy)
#define conv2d_1_2_pt rcp(conv2d_1_2_size)
#define conv2d_1_3_tex(position) Anime4KSample3(position)
#define conv2d_1_3_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_1_3_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_1_3_pos anime4k_pos
#define conv2d_1_3_size float2(Anime4KInputSizes[3].xy)
#define conv2d_1_3_pt rcp(conv2d_1_3_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(0.04876215, 0.061036646, -0.09217501, -0.0016979452);
    result += mul(conv2d_1_0_texOff(float2(-1, -1)), float4x4(0.034232922, 0.09368829, -0.048885133, -0.06830685, 0.034104645, -0.024913078, -0.0110766515, 0.037528504, -0.016028099, 0.1713179, -0.05660502, 0.0049822535, 0.28902757, 0.13230962, -0.15054381, -0.34557992));
    result += mul(conv2d_1_0_texOff(float2(0, -1)), float4x4(0.13366395, -0.065542206, 0.03908324, -0.018846933, -0.094967365, -0.09036536, 0.1273017, 0.015691964, 0.07796363, -0.057486843, -0.0019508312, -0.0963728, 0.0671257, -0.090859264, -0.448771, -0.12917475));
    result += mul(conv2d_1_0_texOff(float2(1, -1)), float4x4(-0.006555958, -0.08371094, -0.076538436, 0.04886956, 0.042018283, -0.027730241, 0.075281315, 0.016118327, -0.08034531, 0.05609647, -0.0917216, 0.20705086, 0.10803086, -0.1757023, -0.19281952, -0.15512674));
    result += mul(conv2d_1_0_texOff(float2(-1, 0)), float4x4(0.20511635, 0.1725111, 0.076811254, -0.10754896, -0.21394521, -0.04676743, 0.16539054, 0.33154884, -0.4185173, -0.33745226, -0.33949208, 0.007838045, 0.2026763, 0.13039109, -0.33207116, -0.27698684));
    result += mul(conv2d_1_0_texOff(float2(0, 0)), float4x4(0.073000066, -0.43043175, 0.13469006, -0.06535744, -0.13866037, 0.22818325, 0.24920255, 0.11949679, -0.067852534, -0.071333595, -0.7630239, -0.2670297, 0.2767074, -0.5851851, -3.8150272, -0.69585377));
    result += mul(conv2d_1_0_texOff(float2(1, 0)), float4x4(-0.24758838, 0.20573221, -0.045180105, -0.004821115, -0.16202433, 0.10255843, 0.27647582, 0.06700002, 0.026406523, -0.028886715, -0.28528342, 0.0024754342, 0.16817431, -0.020770015, 0.27078566, -0.41335487));
    result += mul(conv2d_1_0_texOff(float2(-1, 1)), float4x4(0.017386166, 0.11667963, 0.07580775, -0.13891499, 0.015413562, -0.057992965, -0.044724956, 0.57578504, 0.3256954, 0.08494341, 0.15984862, 0.20348191, -0.18499333, 0.05065657, 0.005393591, -0.10701197));
    result += mul(conv2d_1_0_texOff(float2(0, 1)), float4x4(0.26381642, 1.5968606, -0.10364957, -0.43997616, -0.07239394, 0.12711233, -0.11792853, 0.864299, -0.15307516, -0.42418727, 1.8427134, -0.2815313, 0.24256219, -0.33713526, -0.50198853, -0.434038));
    result += mul(conv2d_1_0_texOff(float2(1, 1)), float4x4(-0.04840268, -0.15018398, -0.0754169, -0.03208611, 0.04308169, -0.032875415, 0.20428611, 0.41817427, -0.006328515, 0.123779, 0.18261783, 0.09145279, 0.16381551, 0.04455655, -0.060461145, -0.1033668));
    result += mul(conv2d_1_1_texOff(float2(-1, -1)), float4x4(-0.095887825, -0.23944968, 0.30970004, -0.08020435, 0.15372302, 0.021705782, 0.010979488, -0.118602775, -0.112626776, 0.004235629, 0.013230361, 0.11415977, 0.025365815, -0.09801066, -0.030285247, 0.051213317));
    result += mul(conv2d_1_1_texOff(float2(0, -1)), float4x4(-0.10985608, -0.027423508, -0.002124163, -0.18101665, 0.18040909, -0.18693982, -0.03190474, -0.09086754, -0.546998, -0.307916, 0.060047604, 0.06444271, -0.10978825, -0.2096884, -0.15844408, -0.066356994));
    result += mul(conv2d_1_1_texOff(float2(1, -1)), float4x4(0.041053224, -0.16441132, 0.106258996, 0.17246635, 0.17930149, 0.06279533, 0.0958223, -0.10922696, 0.06920592, 0.019988552, -0.030148271, 0.17140487, -0.34680396, -0.13821183, -0.3231273, 0.047748704));
    result += mul(conv2d_1_1_texOff(float2(-1, 0)), float4x4(-0.19281444, -0.33236292, 0.43439496, 0.09186985, 0.21958739, 0.01633886, -0.02779062, -0.27076596, -0.40243503, 0.042226154, 0.2786877, -0.37100714, -0.097063765, -0.13479002, 0.00965896, 0.10896096));
    result += mul(conv2d_1_1_texOff(float2(0, 0)), float4x4(0.20951708, -0.16225503, -0.434804, 0.5500215, 0.7057625, -0.24058343, -0.49586177, -0.8392422, -0.13518055, 0.46028462, 0.29732037, 0.18426716, -0.36518323, 0.09257479, 0.446278, 0.30942357));
    result += mul(conv2d_1_1_texOff(float2(1, 0)), float4x4(-0.024183024, 0.11985217, -0.19980443, -0.08773907, 0.1484866, 0.04607873, 0.45947224, -0.42431936, -0.24513598, 0.13943909, -0.31403053, 0.045505747, 0.35051447, 0.3013526, -5.7480645, 0.29916322));
    result += mul(conv2d_1_1_texOff(float2(-1, 1)), float4x4(0.089447565, -0.22003159, -0.0034516677, -0.24450058, 0.039316136, 0.017585326, 0.014822698, -0.15916418, -0.12752223, -0.036430907, -0.16313298, -0.08881362, 0.008964171, 0.0148620475, 0.04254993, -0.054981638));
    result += mul(conv2d_1_1_texOff(float2(0, 1)), float4x4(-0.011240074, 0.3626221, 0.5068187, -0.2546946, 0.10180264, 0.07854199, 0.30631325, -0.3548947, -0.09269432, 0.122540854, -2.059031, 0.23607422, -0.14151959, -0.11739254, -0.2388074, 0.29413682));
    result += mul(conv2d_1_1_texOff(float2(1, 1)), float4x4(-0.027039906, 0.062432174, -0.01746774, -0.16163918, 0.19034399, -0.04096386, -1.9387709, -0.40959898, -0.15908933, -0.0034144942, 0.18532604, 0.029431539, -0.14820427, -0.14582361, 0.16814838, 0.3885549));
    result += mul(conv2d_1_2_texOff(float2(-1, -1)), float4x4(0.25474247, 0.044379335, 0.07912979, -0.02678401, -0.080179036, -0.022027165, 0.14602707, 0.046489257, 0.02864414, 0.09747502, 0.10800262, -0.08907459, -0.17020956, 0.023502152, 0.006028273, 0.110859826));
    result += mul(conv2d_1_2_texOff(float2(0, -1)), float4x4(-0.015286922, 0.39182553, 0.36834243, 0.06804767, 0.30349514, 0.10593305, 0.26544663, 0.14152467, -0.053552184, 0.15245616, 0.14953937, -0.11476936, -0.068606175, 0.06142619, -0.021863198, 0.08280719));
    result += mul(conv2d_1_2_texOff(float2(1, -1)), float4x4(-0.22338197, 0.31262273, 0.2010443, 0.09133032, 0.044035256, 0.07017055, -0.046419777, 0.021762129, -0.12433717, 0.22251974, 0.06896658, -0.11445592, -0.007925719, 0.06353368, -0.022658901, 0.04700994));
    result += mul(conv2d_1_2_texOff(float2(-1, 0)), float4x4(0.08760221, 0.017489698, -0.07629008, -0.019015845, -0.18772608, -0.21621767, 0.17257439, 0.24097398, -0.023047276, 0.09992211, 0.09791718, -0.15679903, -0.27422526, 0.03177792, 0.061056618, 0.1258129));
    result += mul(conv2d_1_2_texOff(float2(0, 0)), float4x4(-0.34781972, 0.35419288, 0.39117673, -0.3356571, 0.028878221, -0.42210343, 0.22045964, -0.084224515, -0.09980312, 0.24313343, 0.1375639, -0.3992535, -0.5391131, 0.23367883, 0.063405134, 0.03216834));
    result += mul(conv2d_1_2_texOff(float2(1, 0)), float4x4(-0.038036548, 0.03852969, -0.18939641, 0.048077468, -0.009010091, -0.064056456, -0.070182465, -0.10497828, -0.12824, 0.08565596, 0.332342, -0.21744101, -0.17636369, 0.22629291, -0.033142753, -0.15699534));
    result += mul(conv2d_1_2_texOff(float2(-1, 1)), float4x4(0.21844321, 0.041396096, 0.14277557, 0.14932401, -0.12388043, 0.11132213, 0.6418031, 0.27927843, -0.07578104, 0.05894083, 0.14709017, -0.025688194, -0.1793799, 0.0715587, -0.008728562, 0.14704861));
    result += mul(conv2d_1_2_texOff(float2(0, 1)), float4x4(-0.23896594, 0.29463968, 0.479136, -0.108207665, -0.4123829, 0.1424328, -0.48983586, -0.22134592, -0.04109916, 0.14150688, 0.15351206, -0.43141776, -0.5663098, 0.21249285, 0.33233625, 0.19077983));
    result += mul(conv2d_1_2_texOff(float2(1, 1)), float4x4(-0.11829278, -0.06649712, -0.03804227, 0.15217401, 0.0034973705, -0.019493198, 0.26487404, 0.13875817, 0.14380687, 0.16110191, -0.07102462, -0.32924405, -0.4907955, 0.10861249, 0.08719571, 0.15251286));
    result += mul(conv2d_1_3_texOff(float2(-1, -1)), float4x4(-0.06266116, -0.34041858, 0.05044081, 0.11066578, -0.17866176, -0.08240197, 0.01901226, 0.30160436, 0.18857968, 0.026002537, 0.09283131, -0.14198096, -0.10862162, -0.018085554, -0.025328832, -0.0819906));
    result += mul(conv2d_1_3_texOff(float2(0, -1)), float4x4(-0.031736273, -0.16163191, -0.17791007, 0.080185086, 0.3190332, 0.007668056, 0.15619679, 0.08277755, 0.17180185, -0.09543453, 0.10643762, -0.115333304, 0.039321292, 0.06841015, -0.29110217, -0.17849095));
    result += mul(conv2d_1_3_texOff(float2(1, -1)), float4x4(0.0103533715, -0.03713895, 0.03947562, -0.006019256, 0.11297437, -0.36600056, -0.0004695724, 0.15414482, 0.048921894, -0.0577784, 0.012957792, -0.025864545, -0.16864915, -0.19950613, -0.08373039, -0.19903928));
    result += mul(conv2d_1_3_texOff(float2(-1, 0)), float4x4(0.27744386, 0.01034252, 0.030558145, 0.12676676, -0.0048416452, 0.07899187, 0.0078145545, 0.15479963, 0.05073462, -0.059940033, 0.054957006, -0.34947175, 0.050893925, 0.028190201, -0.027418047, 0.08505365));
    result += mul(conv2d_1_3_texOff(float2(0, 0)), float4x4(0.14076309, 0.25534484, 0.01914289, 0.13393933, -0.08229252, -0.045399316, 0.19895938, 0.23962416, 0.5211412, -0.4614649, -0.044750545, -0.235249, 0.060966972, -0.01573592, -0.03672357, 0.19417182));
    result += mul(conv2d_1_3_texOff(float2(1, 0)), float4x4(-0.085647345, 0.010611496, 0.0880624, 0.06944839, -0.13834879, -0.21005148, -0.05631103, 0.29470924, 0.2690182, -0.11698685, 0.13923179, -0.09221928, -0.00828649, -0.12489086, 0.0053855656, 0.26634017));
    result += mul(conv2d_1_3_texOff(float2(-1, 1)), float4x4(0.43167678, -0.33268204, -0.33180162, 0.080081545, 0.055839043, 0.038355794, 0.10954252, -0.07784174, 0.11802536, -0.03885749, 0.082809485, 0.1793183, 0.0877824, 0.03436808, 0.012255782, 0.03914771));
    result += mul(conv2d_1_3_texOff(float2(0, 1)), float4x4(0.10665348, -0.34293398, 0.596724, 0.09078337, -0.006305632, 0.08420252, 0.217411, -0.0800918, -0.025566392, 0.0065758205, 0.37606472, -0.16127555, 0.15408729, 0.089559495, -3.2980263, -0.026309669));
    result += mul(conv2d_1_3_texOff(float2(1, 1)), float4x4(0.0375634, 0.04730243, -0.084146015, -0.059625976, -0.17249274, -0.05074574, 0.26398557, -0.08430875, 0.16551284, -0.093194276, 0.09992684, -0.06365805, 0.26737282, -0.11760361, 0.13424441, -0.040855955));
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
