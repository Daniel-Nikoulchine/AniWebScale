// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:274
// Pass: 007 - ArtCNN C4F16 (Conv2D-1-ReLU)
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
    float4 result = float4(0.017340308, -0.019687496, -0.0024025994, -0.031134807);
    result += mul(conv2d_0_texOff(float2(-1, -1)), float4x4(0.14488836, 0.15617222, 0.24995932, -0.20602857, 0.07457725, -0.05089757, 0.1919826, 0.05913797, 0.029240673, -0.14323239, -0.12811571, -0.016654877, -0.037849896, -0.044904917, 0.011908693, 0.20476887));
    result += mul(conv2d_0_texOff(float2(0, -1)), float4x4(-0.14481299, -0.06820936, -0.13883872, -0.05500995, -0.016674483, 0.060298495, 0.2047487, 0.049329262, 0.15717609, -0.11201403, -0.43433315, 0.038867023, -0.011876664, 0.06909828, 0.01268808, -0.061022058));
    result += mul(conv2d_0_texOff(float2(1, -1)), float4x4(-0.23890416, 0.06723417, 0.019676834, 0.10210641, -0.09049304, -0.14209805, 0.1413747, 0.046595637, -0.22619314, -0.3812248, 0.15453394, 0.108850084, 0.005480026, 0.070482835, 0.0031755085, -0.12541054));
    result += mul(conv2d_0_texOff(float2(-1, 0)), float4x4(0.31987897, 0.0615686, -0.3975373, 0.11863347, 0.28750372, -0.13401811, 0.0760137, 0.17732449, 0.16414236, -0.17121066, 0.13583848, -0.56622183, -0.18358624, -0.15444285, 0.048461676, 0.12779245));
    result += mul(conv2d_0_texOff(float2(0, 0)), float4x4(-0.06398393, 0.06722182, -0.027211612, -0.07538544, -0.38504684, 0.04372612, -0.2316804, 0.15608099, 0.49591798, 0.1576374, 0.55207884, 0.2779325, -0.029350363, 0.12857172, -0.05641292, 0.025787216));
    result += mul(conv2d_0_texOff(float2(1, 0)), float4x4(-0.028369924, 0.21301828, -0.024104927, 0.055602882, -0.40717828, -0.17891307, -0.295342, 0.0033105956, -0.3710164, -0.38472205, 0.081832826, 0.022325462, 0.17720103, -0.14714798, -0.10774241, -0.042427894));
    result += mul(conv2d_0_texOff(float2(-1, 1)), float4x4(0.07340591, 0.03715935, 0.0052450444, -0.035622485, 0.09179712, 0.5195772, 0.3391883, 0.06311508, -0.17292568, -0.04444075, 0.17278573, -0.06079131, -0.089864954, -0.044937786, -0.03979694, 0.060385704));
    result += mul(conv2d_0_texOff(float2(0, 1)), float4x4(-0.056307472, -0.3707715, 0.075873554, -0.06702324, 0.026160933, -0.06355235, -0.74494296, -0.107552685, -0.018595887, 0.90654457, -0.3571631, 0.1279783, 0.020567235, 0.15675215, 0.018051492, -0.0068191322));
    result += mul(conv2d_0_texOff(float2(1, 1)), float4x4(-0.15263507, 0.22343095, -0.24015929, 0.11979613, 0.09178956, 0.045213476, 0.14159034, -0.13668562, -0.111204915, 0.21071827, -0.3713811, 0.027777663, 0.053988844, 0.008589407, 0.0014281778, -0.012949662));
    result += mul(conv2d_1_texOff(float2(-1, -1)), float4x4(0.018772757, 0.14670497, 0.21131219, 0.14210835, 0.016244236, -0.029278057, -0.18770012, -0.24322161, -0.20966169, 0.22614162, 0.14078443, -0.063990705, 0.031151341, -0.058134153, -0.5093579, 0.16071557));
    result += mul(conv2d_1_texOff(float2(0, -1)), float4x4(0.10765616, 0.15357406, -0.11580444, 0.05300243, 0.12445824, -0.14583331, -0.048617847, 0.1631091, 0.26900324, 0.03895971, 0.61425877, -0.15825124, 0.16624531, 0.091453135, 0.019480286, -0.053835534));
    result += mul(conv2d_1_texOff(float2(1, -1)), float4x4(-0.19276977, 0.014981885, -0.18121888, 0.05310704, -0.21167228, -0.05253529, 0.0108297905, 0.02579475, 0.25998238, -0.21757886, -0.16248564, 0.054890875, -0.08875917, -0.25118804, 0.16169702, 0.012575426));
    result += mul(conv2d_1_texOff(float2(-1, 0)), float4x4(0.116372004, 0.4852574, -0.008204406, 0.30790752, 0.053777285, -0.25007823, 0.320905, -0.82310075, 0.26665443, -0.19714248, -0.699838, 0.53830475, -0.027435746, -0.02037032, -0.8199938, 0.5747324));
    result += mul(conv2d_1_texOff(float2(0, 0)), float4x4(-0.42939714, 0.024702828, -0.33913442, -0.07046914, 0.6451655, 0.084024146, 0.14454111, 0.3492084, -0.4482967, -0.037986673, -0.26934886, -0.18702535, -0.6568262, -0.0388689, -0.54918814, -0.6796734));
    result += mul(conv2d_1_texOff(float2(1, 0)), float4x4(0.10233614, 0.12563628, 0.18052123, 0.051445574, -0.16920927, -0.13647845, -0.030910768, 0.070817135, -0.08123445, -0.09324202, 0.02098911, 0.025577955, 0.2966419, -0.19609657, 0.4466385, -0.22584629));
    result += mul(conv2d_1_texOff(float2(-1, 1)), float4x4(0.05655131, 0.08924367, -0.16577123, -0.12143397, -0.17510849, -0.2212669, 0.09201883, -0.0020949736, -0.15109304, 0.06458211, 0.3167938, -0.23590852, -0.017636402, 0.21972726, 0.0025182427, 0.06209528));
    result += mul(conv2d_1_texOff(float2(0, 1)), float4x4(-0.07672382, -0.32485682, -0.025270592, -0.17038974, 0.20503815, 0.08961216, -0.26528487, 0.11186554, -0.07426315, 0.0034636813, -0.16142152, -0.053405337, 0.24825227, 0.06331157, 0.8194105, 0.08002364));
    result += mul(conv2d_1_texOff(float2(1, 1)), float4x4(0.017499413, -0.13600506, 0.265451, 0.14754125, 0.0003032719, -0.032281186, 0.023638505, -0.010426936, 0.12656476, 0.19192576, 0.037995923, 0.06292904, -0.0524992, 0.41586637, 0.44702226, 0.065715484));
    result += mul(conv2d_2_texOff(float2(-1, -1)), float4x4(0.067742094, -0.16908768, -0.8031413, -0.076241836, 0.007360003, -0.054910816, -0.38493174, -0.37514096, 0.1338376, -0.03982973, -0.010626242, -0.016812824, 0.21424946, -0.21410498, -0.039047398, -0.056662392));
    result += mul(conv2d_2_texOff(float2(0, -1)), float4x4(0.1998654, -0.046438374, -0.28451136, 0.041123092, 0.31707332, -0.017821167, -0.22482176, 0.22823006, 0.15921766, -0.10437334, 0.41970316, -0.24452993, 0.08313144, 0.085339256, -0.20493919, -0.09849804));
    result += mul(conv2d_2_texOff(float2(1, -1)), float4x4(0.029725337, 0.18071659, 0.24822284, 0.0703666, -0.1496339, -0.057549343, 0.023302102, 0.122207895, -0.257646, 0.010110776, -0.46341065, -0.036311325, -0.18490152, -0.116960995, -0.06631443, 0.09669033));
    result += mul(conv2d_2_texOff(float2(-1, 0)), float4x4(0.0025874474, -0.07285587, -0.04476258, -1.0396242, 0.104973555, -0.021069603, -0.13416433, -0.59028816, -0.060436383, -0.18236636, 0.30641955, -0.3616789, -0.16008604, 0.29695737, -0.17380698, 0.22274195));
    result += mul(conv2d_2_texOff(float2(0, 0)), float4x4(0.48286545, 0.08040905, 0.20795262, 0.1745168, 0.5266815, -0.464332, 0.50284415, 0.8960674, 0.4862434, 0.20586133, 0.6901777, 1.2361128, -0.30542162, -0.0018511099, -0.05925373, 0.11725837));
    result += mul(conv2d_2_texOff(float2(1, 0)), float4x4(-0.08358229, -0.1377493, -0.20663069, 0.17510939, -0.8824828, 0.124879405, -0.1665411, -0.11844708, -1.0033555, 0.3007729, 0.15289813, -0.08403701, -0.28882208, 0.3530724, 0.27224553, -0.15799375));
    result += mul(conv2d_2_texOff(float2(-1, 1)), float4x4(-0.0357076, -0.1162146, 0.16077721, -0.27636003, 0.06199247, -0.26808617, 0.07367261, -0.2293384, 0.0017537746, -0.18031701, 0.12834136, -0.035884295, 0.21609366, -0.19682631, 0.32049942, -0.121130854));
    result += mul(conv2d_2_texOff(float2(0, 1)), float4x4(0.16379282, 0.5860354, -0.035985265, 0.19390047, 0.27075967, 0.44814512, -0.31964916, 0.31522858, 0.038512684, 0.4798331, -0.8895328, -0.31818455, 0.3625331, 0.20037077, -0.27835098, -0.16096044));
    result += mul(conv2d_2_texOff(float2(1, 1)), float4x4(0.037498824, 0.18473633, -0.18812637, -0.0926213, -0.24170223, -0.14410575, -0.08570759, 0.112453185, 0.43218568, -0.27724668, -0.416527, 0.0047681397, 0.072435394, -0.4548649, 0.3467402, 0.23570302));
    result += mul(conv2d_3_texOff(float2(-1, -1)), float4x4(0.026878862, -0.0054201228, -0.1530945, 0.07534664, -0.09706483, -0.25690985, 0.1583413, 0.08827554, 0.02138883, -0.052865714, 0.090475276, -0.12788808, -0.01745817, 0.01312461, -0.07861306, -0.11645284));
    result += mul(conv2d_3_texOff(float2(0, -1)), float4x4(0.11005661, -0.098031536, -0.1065923, 0.042511646, -0.13756804, -0.00277639, -0.27081233, 0.11590057, -0.059558306, 0.11672527, 0.21551627, 0.10930238, 0.22339214, -0.042645723, -0.14005935, 0.011071548));
    result += mul(conv2d_3_texOff(float2(1, -1)), float4x4(-0.13300125, 0.07933158, -0.18780716, -0.01586275, -0.20094466, 0.16603746, 0.065837875, 0.072648995, -0.0554006, -0.06250166, -0.13206504, -0.0046675834, 0.09118552, -0.00084430864, -0.16215876, 0.011986883));
    result += mul(conv2d_3_texOff(float2(-1, 0)), float4x4(-0.068216525, 0.361823, 0.16318728, -0.017136134, -0.069930114, 0.33314154, 0.4596103, -0.3786885, 0.17986344, -0.13468313, 0.04366131, -0.2540776, 0.14976558, 0.121361494, 0.0973411, -0.4332304));
    result += mul(conv2d_3_texOff(float2(0, 0)), float4x4(0.18297467, 0.016725121, -0.08919352, 0.20343186, 0.5790889, -0.05645069, -0.055454206, -0.08059607, 0.12603521, 0.14410903, 0.3475668, 0.28740877, 0.13379388, 0.062050924, 0.011434581, -0.7498423));
    result += mul(conv2d_3_texOff(float2(1, 0)), float4x4(-0.09216585, 0.17450513, 0.31224558, 0.03045953, -0.10025679, 0.08870231, 0.06103983, 0.015933393, -0.39584205, -0.028308665, -0.39592546, 0.23424876, 0.1764627, 0.15409099, 0.30314422, 0.011382236));
    result += mul(conv2d_3_texOff(float2(-1, 1)), float4x4(0.025374932, -0.33056146, -0.34729078, -0.12620093, 0.07066081, -0.2535482, 0.067600474, -0.16062936, -0.0076711546, 0.3902233, -0.1655845, -0.10610696, 0.1216936, -0.24520023, -0.19061872, -0.17690943));
    result += mul(conv2d_3_texOff(float2(0, 1)), float4x4(0.095207416, -0.67126465, 0.34942475, -0.24091598, -0.086488366, -0.07973916, -0.762392, 0.12857826, 0.1693955, 0.6731177, -0.48613432, 0.1466791, 0.09741641, 0.0023761077, 0.048234843, -0.012384777));
    result += mul(conv2d_3_texOff(float2(1, 1)), float4x4(-0.17446618, -0.33516207, 0.16242985, 0.05475289, 0.004791159, 0.00043990958, 0.30922234, 0.19559966, -0.27294874, 0.09017745, -0.2887363, -0.048817873, -0.050289027, 0.11582911, -0.13685048, 0.09328516));
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
