// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:539
// Pass: 012 - ArtCNN C4F16 (Conv2D-3-ReLU)
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

#define conv2d_2_0_tex(position) Anime4KSample0(position)
#define conv2d_2_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_2_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_2_0_pos anime4k_pos
#define conv2d_2_0_size float2(Anime4KInputSizes[0].xy)
#define conv2d_2_0_pt rcp(conv2d_2_0_size)
#define conv2d_2_1_tex(position) Anime4KSample1(position)
#define conv2d_2_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_2_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_2_1_pos anime4k_pos
#define conv2d_2_1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_2_1_pt rcp(conv2d_2_1_size)
#define conv2d_2_2_tex(position) Anime4KSample2(position)
#define conv2d_2_2_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_2_2_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_2_2_pos anime4k_pos
#define conv2d_2_2_size float2(Anime4KInputSizes[2].xy)
#define conv2d_2_2_pt rcp(conv2d_2_2_size)
#define conv2d_2_3_tex(position) Anime4KSample3(position)
#define conv2d_2_3_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_2_3_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_2_3_pos anime4k_pos
#define conv2d_2_3_size float2(Anime4KInputSizes[3].xy)
#define conv2d_2_3_pt rcp(conv2d_2_3_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(0.009093954, -0.046106618, -0.029771404, -0.011352834);
    result += mul(conv2d_2_0_texOff(float2(-1, -1)), float4x4(-0.03139504, -0.37591898, 0.43405393, 0.13575876, 0.18949498, -0.023054915, 0.13963564, -0.04934544, 0.014923857, -0.1478349, -0.13283792, 0.020978948, 0.12617624, 0.122843705, 0.120498925, -0.039761595));
    result += mul(conv2d_2_0_texOff(float2(0, -1)), float4x4(-0.5632661, -0.53623587, 0.10180392, -0.16750282, -0.025627239, -0.15858869, -0.20231608, -0.047740806, -0.12390835, 0.09642403, -0.46697125, 0.18929575, -0.10565239, -0.36551267, 0.14202842, -0.26281643));
    result += mul(conv2d_2_0_texOff(float2(1, -1)), float4x4(-0.37953472, -0.07359053, -0.038356077, 0.02856401, -0.055343695, -0.05569917, 0.03686956, -0.016379163, -0.15416673, -0.04698956, -0.09077844, -0.06397243, 0.04275305, -0.019328149, -0.060078025, -0.006735979));
    result += mul(conv2d_2_0_texOff(float2(-1, 0)), float4x4(-0.16446732, 0.08741287, -0.2830653, -0.046232875, 0.05919743, 0.075659625, -0.2707217, 0.26323503, 0.025266139, -0.15200922, -0.065656886, -0.04896738, -0.1334076, -0.1357827, -0.07787897, 0.22665939));
    result += mul(conv2d_2_0_texOff(float2(0, 0)), float4x4(-0.163388, 0.23606823, -0.4776987, -0.12101474, 0.018600307, 0.03433725, 0.21568292, -0.11361549, -0.18332775, 0.04471268, 0.42824623, -0.19352448, 0.07711884, 0.3597946, 0.3832484, -0.36390552));
    result += mul(conv2d_2_0_texOff(float2(1, 0)), float4x4(0.020032534, 0.015862774, -0.13262424, 0.122706376, -0.22682999, -0.12152992, 0.2417263, -0.10752049, -0.11854908, -0.15984139, -0.03138054, -0.052549034, 0.019715536, 0.14383116, -0.052756935, 0.26863855));
    result += mul(conv2d_2_0_texOff(float2(-1, 1)), float4x4(0.014197971, -0.041475795, -0.27382287, 0.05071768, -0.09315317, -0.17296712, 0.3146068, 0.117063135, -0.09412329, -0.05910955, 0.06315499, -0.07533495, -0.15436152, 0.12675034, -0.023088124, 0.09295473));
    result += mul(conv2d_2_0_texOff(float2(0, 1)), float4x4(-0.13203485, -0.005234461, -0.19983862, -0.011995585, 0.13423443, 0.123476826, 0.01478262, -0.0024858774, 0.13374211, 0.017441293, 0.16603749, 0.037025448, -0.0029206795, 0.07814614, -0.36566874, 0.015376856));
    result += mul(conv2d_2_0_texOff(float2(1, 1)), float4x4(-0.08066659, -0.044155236, -0.09586787, -0.05225543, 0.10154988, 0.19851063, 0.004509855, 0.010505531, 0.12985183, 0.071587354, -0.0072382772, 0.03145392, -0.19811058, -0.22562617, -0.22260386, -0.0886009));
    result += mul(conv2d_2_1_texOff(float2(-1, -1)), float4x4(-0.036992863, 0.005064238, 0.05573088, 0.049713355, 0.11112718, -0.016891243, 0.11834005, 0.05606208, -0.13711175, 0.0293474, -0.09804728, -0.038928088, -0.10303746, 0.22802731, -0.0013709404, -0.045628004));
    result += mul(conv2d_2_1_texOff(float2(0, -1)), float4x4(0.0461423, -0.111275785, 0.29284874, -0.03080121, -0.18483166, -0.24654534, 0.20625763, -0.14220123, 0.080272324, 0.365453, -0.22789133, 0.07482855, -0.032167256, 0.24576199, 0.5533319, -0.1771542));
    result += mul(conv2d_2_1_texOff(float2(1, -1)), float4x4(0.040682886, -0.029892346, 0.033107746, 0.0074931616, 0.034801383, -0.019737035, -0.05302436, 0.049442973, 0.16285545, 0.22309889, 0.024612354, 0.08938908, -0.017235318, -0.23297587, 0.0014005913, -0.24685223));
    result += mul(conv2d_2_1_texOff(float2(-1, 0)), float4x4(0.12315223, -0.0155184325, 0.18853615, -0.033486865, -0.39537913, -0.15705338, 0.02918964, -0.022653721, 0.05297589, 0.064280145, 0.05204548, -0.19975647, 0.00040459665, 0.40414715, -0.21109147, -0.07613295));
    result += mul(conv2d_2_1_texOff(float2(0, 0)), float4x4(-0.18426616, -0.567598, -0.43349823, -0.08117534, -0.28182057, -0.04353162, -0.11591508, 0.055636313, 0.5941714, -0.11628653, -0.09274605, 0.05804102, -0.32078943, 0.3906408, -0.11527999, -0.24331));
    result += mul(conv2d_2_1_texOff(float2(1, 0)), float4x4(0.16905127, -0.29871175, -0.14295626, 0.23055254, -0.091986425, -0.13884646, 0.04452111, -0.23876938, 0.13270846, 0.120989285, 0.041528802, 0.20027058, 0.24388282, 0.026744246, 0.15274341, 0.0840293));
    result += mul(conv2d_2_1_texOff(float2(-1, 1)), float4x4(0.12059756, 0.090242304, -0.08310769, -0.012722158, -0.260873, 0.045339096, -0.26235983, 0.064878225, 0.23190102, -0.050568465, 0.12674092, -0.019680206, 0.10233896, -0.19229718, 0.23911592, 0.14640202));
    result += mul(conv2d_2_1_texOff(float2(0, 1)), float4x4(-0.1588415, 0.5865907, -0.14438461, 0.047422085, -0.49207804, -0.02663791, -0.061397232, -0.14736487, -0.104081705, 0.0167303, 0.3841152, -0.02016499, 0.16472062, -0.19687694, -0.20743595, -0.13998377));
    result += mul(conv2d_2_1_texOff(float2(1, 1)), float4x4(0.0723279, 0.18523635, 0.049303334, -0.016373513, 0.12272233, 0.061572004, -0.16944462, -0.15050516, 0.041492976, -0.14307284, 0.20441912, 0.10286354, -0.22479913, 0.09723909, 0.035278626, -0.10060937));
    result += mul(conv2d_2_2_texOff(float2(-1, -1)), float4x4(0.03969813, -0.08729173, 0.0084641995, -0.0031075603, -0.031285863, 0.23439902, -0.11018457, 0.09715723, -0.025381716, 0.2066982, 0.35813257, -0.058451284, -0.18476444, -0.18626216, 0.08801294, 0.27980557));
    result += mul(conv2d_2_2_texOff(float2(0, -1)), float4x4(0.08203006, -0.13873701, 0.12168716, -0.004459612, -0.0071851867, -0.18034592, 0.06161344, -0.014242642, -0.44995755, -0.34649035, -2.3022544, 0.04805136, 0.08500437, -0.18580656, 0.15868954, -0.5548782));
    result += mul(conv2d_2_2_texOff(float2(1, -1)), float4x4(-0.07149486, -0.324451, 0.18458685, -0.06320863, -0.09327728, 0.034327447, 0.076386735, -0.07611398, -0.40669975, -0.024748065, -0.25321633, -0.5415524, -0.20751992, -0.13159831, 0.1080071, -0.17989965));
    result += mul(conv2d_2_2_texOff(float2(-1, 0)), float4x4(0.0019801091, 0.047891997, -0.006443167, -0.017722903, -0.21038678, 0.023343608, -0.087213986, 0.13225438, 0.19445656, 0.04297401, -0.13932799, -0.02958112, -0.05944142, 0.151063, 0.011572225, -0.010344348));
    result += mul(conv2d_2_2_texOff(float2(0, 0)), float4x4(-0.019643027, -0.0144028505, -0.22105129, 0.18617687, -0.39780256, 0.14003836, 0.0010809557, 0.14022565, -0.5407326, 0.041437577, -0.040766083, 0.09899558, -0.08571664, -0.020964747, -0.238794, 0.021449825));
    result += mul(conv2d_2_2_texOff(float2(1, 0)), float4x4(0.034403425, -0.09352241, -0.24261291, -0.2660237, 0.1057827, 0.15276311, 0.024972416, -0.13749065, 0.06420959, 0.052182708, 0.071724616, 0.071477085, 0.098490454, -0.102253124, -0.3029897, -0.00448815));
    result += mul(conv2d_2_2_texOff(float2(-1, 1)), float4x4(0.10386644, 0.05016951, -0.075563915, 0.012272805, 0.045978643, -0.023767354, 0.16502881, 0.035445444, 0.23239508, -0.08139325, 0.14074081, 0.0395307, -0.012333446, -0.036453523, 0.011038833, 0.017250406));
    result += mul(conv2d_2_2_texOff(float2(0, 1)), float4x4(-0.07519559, -0.025236817, -0.12992309, -0.06488421, -0.14902125, 0.13172576, -0.00943197, -0.15763652, 0.19784911, -0.015081102, -0.12532103, 0.022510828, -0.1171489, 0.1761139, 0.027180698, 0.056955468));
    result += mul(conv2d_2_2_texOff(float2(1, 1)), float4x4(-0.042117614, 0.010440881, 0.060444765, -0.063393496, 0.022742165, 0.024269963, -0.08270393, -0.08851121, 0.0058683488, -0.0876978, -0.015949411, -0.011186763, 0.033277657, 0.20082761, -0.050847676, -0.053953595));
    result += mul(conv2d_2_3_texOff(float2(-1, -1)), float4x4(-0.21232341, -0.8512117, 0.28511116, 0.124301836, -0.14394872, -0.89430636, 0.31695837, -0.88681895, 0.04658703, 0.09920635, 0.050403878, 0.013742579, -0.13912998, -0.26947063, -0.047857087, 0.040771708));
    result += mul(conv2d_2_3_texOff(float2(0, -1)), float4x4(0.14909953, -0.11244831, 0.12871851, -0.063442454, 0.8709309, 0.02320304, -0.4892738, -0.1559887, 0.07382341, 0.16965774, 0.24687065, -0.10361559, 0.14060971, -0.36530885, 0.020560449, 0.1991003));
    result += mul(conv2d_2_3_texOff(float2(1, -1)), float4x4(0.095596604, -0.2323125, 0.06981746, 0.05534776, 1.2347633, -0.14804572, 0.081568964, -0.48416072, 0.12931208, 0.03390161, 0.0024525402, -0.04777092, 0.19054417, -0.23519683, -0.075954325, 0.10324893));
    result += mul(conv2d_2_3_texOff(float2(-1, 0)), float4x4(-0.48033154, 0.3336462, 0.057772283, -0.45017916, 0.0570117, 0.045627464, 0.14253992, -0.08261601, -0.025415896, 0.03116416, -0.14783284, 0.12425637, 0.11336388, 0.19623981, 0.26803765, -0.15741996));
    result += mul(conv2d_2_3_texOff(float2(0, 0)), float4x4(-0.31752434, 0.1786475, 0.1685205, 0.22519186, -0.09395428, -0.18483354, -0.11014555, 0.058792915, 0.031003501, -0.20373538, -0.16117375, 0.12755945, -0.5854539, -0.012876169, -0.09988858, 0.096702866));
    result += mul(conv2d_2_3_texOff(float2(1, 0)), float4x4(-0.24249321, 0.14781179, 0.0012106239, -0.16162542, -0.032977916, 0.053014092, 0.28463274, -0.02218281, -0.019464843, 0.09607626, 0.074282214, -0.15227607, 0.13291718, -0.04887593, 0.07384317, 0.09813214));
    result += mul(conv2d_2_3_texOff(float2(-1, 1)), float4x4(0.13571821, -0.44730356, -1.4882036, 0.5214405, 0.06152359, -0.03502732, 0.1193646, -0.015765598, -0.06346018, 0.04121828, 0.023924753, 0.028127313, 0.15010735, -0.10139304, -0.30495396, -0.111048736));
    result += mul(conv2d_2_3_texOff(float2(0, 1)), float4x4(0.0058939946, -0.18045497, -0.30321455, 0.19564119, -0.016512072, -0.021385068, -0.083695054, -0.020833207, -0.052514873, 0.04538915, -0.10580721, -0.035858177, 0.13583419, -0.2883147, -0.42187527, 0.13108757));
    result += mul(conv2d_2_3_texOff(float2(1, 1)), float4x4(0.047445584, 0.011768822, -0.17025253, -0.0031202831, 0.1340654, -0.0046162773, 0.0681209, 0.064717226, -0.05193246, 0.0013096129, 0.111623876, 0.008852086, -0.020796137, 0.041441616, -0.027958136, 0.04868799));
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
