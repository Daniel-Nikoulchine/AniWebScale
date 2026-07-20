// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:486
// Pass: 011 - ArtCNN C4F16 (Conv2D-2-ReLU)
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
    float4 result = float4(-0.026644066, 0.0034359621, 0.01291977, -0.00559978);
    result += mul(conv2d_1_0_texOff(float2(-1, -1)), float4x4(0.0026636901, 0.045504823, 0.062066205, -0.008880998, -0.00411176, 0.015292099, 0.0073646954, -0.0475728, -0.013349281, -0.07506882, -0.1006681, 0.1028369, -0.04201462, -0.005790319, -0.0012919891, -0.059550937));
    result += mul(conv2d_1_0_texOff(float2(0, -1)), float4x4(0.026240079, 0.019473184, -0.0048894878, -0.010719278, -0.0050918935, 0.044043902, 0.02527041, 0.05020401, 0.10100809, -0.05209071, -0.034114793, 0.0139190685, -0.023241777, -0.12299086, 0.0133303385, -0.2400381));
    result += mul(conv2d_1_0_texOff(float2(1, -1)), float4x4(0.04303676, 0.012787927, -0.011564702, -0.07557861, 0.05384297, 0.027572934, 0.027256727, 0.06650736, -0.22361235, -0.10519426, 0.06985452, -0.19050193, 0.2372576, 0.124692455, 0.056593288, -0.0023709657));
    result += mul(conv2d_1_0_texOff(float2(-1, 0)), float4x4(0.103685535, 0.20243387, -0.038518876, 0.048770748, -0.0075933714, -0.014240977, -0.061634418, 0.21386868, 0.042488556, 0.14918818, -0.00626454, -0.2720592, -0.083754204, 0.12543438, -0.032062016, 0.0028670772));
    result += mul(conv2d_1_0_texOff(float2(0, 0)), float4x4(0.4056511, -0.12901996, -0.014229969, 0.21804598, -0.0061029783, -0.13510644, -0.033577446, 0.43510506, 0.13216454, 0.05053597, 0.042552736, 0.12705435, -0.19926366, 0.39183295, 0.39098197, -0.3384084));
    result += mul(conv2d_1_0_texOff(float2(1, 0)), float4x4(-0.5607021, 0.21313053, 0.042494744, -0.28097078, 0.026736109, 0.094672784, -0.018075425, 0.2264976, 0.19156823, -0.00396934, -0.07054004, 0.25335956, -0.31334838, 0.29566953, 0.15411568, -0.1149641));
    result += mul(conv2d_1_0_texOff(float2(-1, 1)), float4x4(-0.12773708, -1.155441, 0.005953651, -0.46491727, -0.0725161, -0.38175568, 0.02182076, -0.055183038, -0.01066495, -3.3641841, -0.09494905, 0.04667828, 0.03735797, 0.2798904, 0.050247617, 0.116932176));
    result += mul(conv2d_1_0_texOff(float2(0, 1)), float4x4(0.25060686, -0.7826498, 0.34533167, 1.4211726, -0.07280008, -0.78571653, 0.20044187, 0.2107139, -0.006713672, -3.4742649, -0.0010381539, -0.13255438, 0.007665934, 0.17634872, -0.065820284, -0.043773055));
    result += mul(conv2d_1_0_texOff(float2(1, 1)), float4x4(0.06913697, 0.14532623, -0.23764633, 0.28106403, 0.010054932, -0.24475773, -0.046645857, 0.3343575, 0.05471596, -2.9104364, 0.114206165, -0.1566298, -0.1021547, 0.35150668, -0.09331033, 0.060763422));
    result += mul(conv2d_1_1_texOff(float2(-1, -1)), float4x4(-0.046245288, 0.029256359, -0.13024329, -0.13976024, 0.011761939, 0.055544447, 0.031039072, -0.024434982, 0.0075748144, -0.03453773, 0.015543969, -0.110793106, -0.075824946, -0.10970241, -0.030847168, 0.052159682));
    result += mul(conv2d_1_1_texOff(float2(0, -1)), float4x4(0.21084526, 0.06378808, -0.018820241, 0.025104824, 0.03404747, 0.026205014, 0.0494023, -0.09009528, -0.038554292, 0.08049235, -0.05491061, -0.016991828, -0.1362305, 0.12823999, 0.07810687, -0.020814443));
    result += mul(conv2d_1_1_texOff(float2(1, -1)), float4x4(-0.73463315, 0.12632523, 0.03801314, -0.09843435, -0.15514512, -0.033812158, 0.06364495, -0.056822013, -0.7767236, -0.07318993, 0.017147215, -0.19203907, -0.62349766, -0.18745376, -0.0067848074, -0.03280263));
    result += mul(conv2d_1_1_texOff(float2(-1, 0)), float4x4(0.06757004, -0.58466154, 0.14347088, -0.022155365, 0.016935596, 0.04744075, 0.03353328, 0.035492588, 0.03470451, -0.7376644, 0.012366158, -0.052975643, 0.053526968, 0.15369552, -0.002713561, -0.11655027));
    result += mul(conv2d_1_1_texOff(float2(0, 0)), float4x4(0.56108445, 0.3905447, 0.08111457, -0.4148812, 0.048636373, -0.17283234, -0.028881175, 0.03666859, -0.12149955, -0.85328853, -0.19529189, 0.10505763, 0.26630455, 0.5003858, -0.0034972574, 0.00937355));
    result += mul(conv2d_1_1_texOff(float2(1, 0)), float4x4(-0.09813623, -0.05804578, -0.08176221, 0.062319092, 0.2119758, -0.025760964, 0.07862289, 0.014452689, -0.1451977, -1.0066966, -0.06949981, -0.19944759, -0.053472802, -0.6881062, 0.023246605, -0.25115952));
    result += mul(conv2d_1_1_texOff(float2(-1, 1)), float4x4(-0.052293744, 0.88846356, -0.0075129415, 0.023553167, 0.011247162, -0.8044807, -0.026706582, 0.03028943, 0.009484867, 0.53414387, 0.053328972, -0.0228974, 0.016700894, -0.28613526, 0.028733253, 0.05941993));
    result += mul(conv2d_1_1_texOff(float2(0, 1)), float4x4(0.25722855, -1.5320756, -0.038126837, 0.21694666, -0.10533633, -0.9596058, 0.054616816, 0.019129865, 0.047445476, 0.7329473, -0.020078428, -0.05993159, -0.006629987, -2.0195227, -0.011439797, 0.052457303));
    result += mul(conv2d_1_1_texOff(float2(1, 1)), float4x4(0.0605041, -0.1373972, 0.030174594, -0.021199614, -0.026551504, 0.5097795, -0.04979116, -0.040497746, 0.027496623, -2.2920604, 0.06209354, 0.02138253, -0.029272867, -1.7961358, 0.023084324, 0.10620968));
    result += mul(conv2d_1_2_texOff(float2(-1, -1)), float4x4(-0.010065091, -0.00763891, 0.04808219, 0.05179343, 0.012155014, -0.038952358, 0.07034075, 0.13265167, 0.044032726, 0.0024625487, 0.046196517, -0.008314385, 0.021671169, 0.0001617993, -0.016322648, -0.0742184));
    result += mul(conv2d_1_2_texOff(float2(0, -1)), float4x4(-0.13426131, 0.058050595, -0.030945837, -0.11666721, 0.11769839, 0.14049192, -0.089623, 0.14701013, 0.07089815, 0.006214743, 0.030165045, -0.11527725, -0.0031362965, 0.0007559506, 0.014298046, -0.032130167));
    result += mul(conv2d_1_2_texOff(float2(1, -1)), float4x4(-0.01964119, -0.051813636, -0.025481919, -0.21550722, 0.080593675, 0.0061072246, 0.028356658, -0.035433017, 0.024395157, 0.029074943, -0.0073012067, -0.027594093, -0.037448563, -0.03487514, 0.0069612027, -0.058939934));
    result += mul(conv2d_1_2_texOff(float2(-1, 0)), float4x4(0.03421438, 0.25754726, 0.060284212, 0.04956383, 0.14222786, 0.073052995, 0.16582096, 0.4070295, -0.031461127, 0.06034744, -0.026304293, 0.07782227, -0.051377684, -0.011057006, -0.014289552, -0.018421682));
    result += mul(conv2d_1_2_texOff(float2(0, 0)), float4x4(0.3243416, 0.26511225, 0.34489635, 0.27077156, 0.27181748, 0.20193245, 0.1837199, -0.08034095, -0.12687859, -0.05776684, -0.053054083, -0.042805247, 0.05514121, -0.026326768, -0.018168362, -0.06437127));
    result += mul(conv2d_1_2_texOff(float2(1, 0)), float4x4(0.2017732, 0.23192774, -0.018353475, -0.0014091467, 0.017860584, -0.0010579189, -0.041463755, 0.10039678, 0.00438727, -0.14251593, 0.08442485, 0.045846704, 0.02502844, 0.01713686, -0.042104274, 0.110902555));
    result += mul(conv2d_1_2_texOff(float2(-1, 1)), float4x4(-0.006788884, 0.060291946, -0.05935449, -0.051870726, -0.16477232, -0.73363674, -0.027909707, 0.14584514, -0.018679593, 0.27152926, 0.045760516, -0.026055297, -0.048353188, 0.049990315, 0.04247048, -0.006715155));
    result += mul(conv2d_1_2_texOff(float2(0, 1)), float4x4(-0.039304394, -0.65931624, 0.08826594, 0.048369218, 0.14499986, -1.0777208, -0.0062141987, 0.14950015, 0.029411776, 0.285203, 0.002805003, -0.13353534, 0.04172097, -0.3217432, 0.24635492, -0.108494334));
    result += mul(conv2d_1_2_texOff(float2(1, 1)), float4x4(0.10871781, -0.4917801, 0.09421995, -0.057461236, 0.048649635, -1.2288821, 0.052425202, -0.017569825, 0.056759246, 0.11927216, -0.07061702, -0.21411107, 0.012818788, -0.7443022, 0.085984096, -0.09379416));
    result += mul(conv2d_1_3_texOff(float2(-1, -1)), float4x4(0.0451776, -0.0443184, 0.031168815, 0.061718326, -0.043752845, -0.02800522, -0.042447012, -0.11359071, 0.030218843, 0.05372262, 0.04102787, 0.03208186, -0.020059878, 0.038900677, 0.033137336, 0.0027926));
    result += mul(conv2d_1_3_texOff(float2(0, -1)), float4x4(-0.056141444, 0.0142154265, -0.00701089, 0.027392669, 0.13507651, 0.16109197, 0.113903396, 0.12660083, 0.08368416, -0.039584666, 0.04737135, 0.038148176, -0.030945074, 0.013725103, -0.03794523, -0.014694913));
    result += mul(conv2d_1_3_texOff(float2(1, -1)), float4x4(0.03931668, -0.014098366, 0.0092319725, 0.02633128, 0.04325641, -0.04011396, -0.10966308, 0.3448921, 0.08270008, 0.011265193, 0.033872787, -0.062207818, 0.008272695, -0.021250652, 0.050191477, 0.078740686));
    result += mul(conv2d_1_3_texOff(float2(-1, 0)), float4x4(-0.29917732, -0.057704862, 0.2971307, -0.030169884, 0.014525799, -0.20604001, -0.06759038, -0.08469938, 0.020411849, -0.046972223, 0.01661068, 0.058228936, 0.06695921, 0.01662957, 0.066620156, 0.042245623));
    result += mul(conv2d_1_3_texOff(float2(0, 0)), float4x4(0.11022856, 0.07680184, -0.06671146, 0.53029007, -0.049003147, 0.3436512, 0.046681415, -0.29876107, 0.022896491, 0.21284649, -0.013418779, 0.14527372, -0.11284193, -0.24935538, -0.08567846, 0.2764048));
    result += mul(conv2d_1_3_texOff(float2(1, 0)), float4x4(-0.08449688, -0.011147097, 0.06517317, -0.049577795, -0.19069603, -0.1467909, -0.055285268, -0.26289472, 0.066939145, -0.025858382, 0.064462245, 0.01746375, -0.6977837, 0.10943567, 0.09017466, -0.3464121));
    result += mul(conv2d_1_3_texOff(float2(-1, 1)), float4x4(-0.0065774093, 0.3137664, -0.011781333, -0.015299364, -0.032876994, 0.34641656, -0.05540366, -0.10143875, 0.023715094, 0.10377569, 0.036199667, -0.04733205, -0.031916007, 0.22285572, -0.005122019, 0.08382498));
    result += mul(conv2d_1_3_texOff(float2(0, 1)), float4x4(0.0053891754, 1.0340964, -0.041194625, 0.18276784, -0.024517432, -1.2967606, -0.104881935, -0.049355622, 0.03194576, -0.13825355, 0.02477424, 0.12344183, -0.02319696, -1.5114988, 0.064019665, 0.1008395));
    result += mul(conv2d_1_3_texOff(float2(1, 1)), float4x4(0.08167346, 0.4271778, -0.017185524, -0.015311368, 0.07620911, 0.4324744, 0.043526713, -0.15210772, -0.007699967, -0.5187902, 0.008254404, 0.09220155, -0.12686765, -2.0151863, 0.066918045, 0.0061397557));
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
