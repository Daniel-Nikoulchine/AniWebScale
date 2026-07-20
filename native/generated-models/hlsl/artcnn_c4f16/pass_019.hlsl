// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:910
// Pass: 019 - ArtCNN C4F16 (Conv2D-4-ReLU)
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
    float4 result = float4(-0.0056808833, 0.012048282, -0.005611755, -0.0137288915);
    result += mul(conv2d_3_0_texOff(float2(-1, -1)), float4x4(-0.02197907, -0.0730204, 0.06113036, 0.041394677, 0.001082372, -0.044437423, 0.022057764, -0.036039807, -0.04551191, 0.028281001, -0.12146636, -0.229366, -0.0018181449, 0.17487861, 0.015291132, 0.06115423));
    result += mul(conv2d_3_0_texOff(float2(0, -1)), float4x4(0.02983461, 0.14524809, -0.109681584, 0.051262714, -0.035724837, 0.110423036, 0.012800332, -0.04363136, 0.10323772, 0.11021576, 0.0102321105, -0.036543056, 0.0878666, 0.11746435, 0.0744654, 0.03734733));
    result += mul(conv2d_3_0_texOff(float2(1, -1)), float4x4(0.046159673, -0.07842022, 0.01673863, -0.017782092, 0.044131894, 0.012316076, 0.005567889, 0.0030530991, 0.008948841, 0.041483127, -0.12870345, -0.014727591, -0.10680149, 0.0981459, -0.018498411, 0.004486978));
    result += mul(conv2d_3_0_texOff(float2(-1, 0)), float4x4(0.030458761, -0.039647836, 0.16062923, 0.2575752, 0.08096516, -0.13665523, -0.001818946, -0.10607577, 0.010819096, -0.2470391, 0.0060095172, -0.00054697203, -0.12670946, 0.116846085, 0.12898381, -0.103562474));
    result += mul(conv2d_3_0_texOff(float2(0, 0)), float4x4(0.21406847, 0.19733611, 0.112423435, 0.11183747, -0.09941286, 0.102186784, 0.032591145, 0.093449935, 0.21242698, 0.040658448, -0.09398546, -0.043863628, -0.13197222, -0.22075157, 0.40502942, -0.19924882));
    result += mul(conv2d_3_0_texOff(float2(1, 0)), float4x4(-0.03721943, 0.0041839173, 0.015727049, -0.0041140984, -0.0010643707, -0.03894691, -0.06840327, -0.015257871, -0.060777724, 0.008749244, 0.03557323, -0.004838384, 0.14282236, 0.17729865, -0.045534145, 0.028859198));
    result += mul(conv2d_3_0_texOff(float2(-1, 1)), float4x4(0.041982155, -0.04165953, 0.07200896, 0.1163718, -0.007876423, 0.079244345, -0.118197165, -0.15689918, 0.020781554, 0.03147805, -0.0013811024, 0.0018177069, 0.023526685, 0.2752305, -0.034011584, 0.23803547));
    result += mul(conv2d_3_0_texOff(float2(0, 1)), float4x4(-0.08264895, 0.10073222, -0.011917952, -0.010800571, 0.037555836, -0.2430904, -0.047478646, -0.028465338, -0.026456626, -0.008213101, -0.004732031, -0.054107472, -0.004560103, 0.09223625, 0.013823333, 0.019064022));
    result += mul(conv2d_3_0_texOff(float2(1, 1)), float4x4(0.03219394, 0.023424108, 0.007978551, -0.005790484, -0.0030962522, 0.0841648, 0.021374695, -0.005666753, 0.014922804, 0.030269317, -0.022365507, -0.0054284334, -0.038594622, 0.077741735, -0.034776017, 0.011516032));
    result += mul(conv2d_3_1_texOff(float2(-1, -1)), float4x4(0.0017663402, 0.06361975, 0.025853455, 0.0028556336, 0.0492069, -0.102475286, -0.0015403549, -0.115894616, 0.071673825, -0.33291176, 0.30381078, 0.17122293, -0.05672035, 0.1578107, -0.12214353, 0.04449601));
    result += mul(conv2d_3_1_texOff(float2(0, -1)), float4x4(0.049995225, -0.20009609, -0.14471719, -0.011751366, 0.079526275, -0.17444833, -0.14980733, 0.08262118, -0.19644724, 1.036655, -0.34496894, 0.22817047, -0.16291502, -0.13359761, 0.18618259, -0.010306586));
    result += mul(conv2d_3_1_texOff(float2(1, -1)), float4x4(0.017596262, 0.021355722, 0.042025425, 0.038564675, -0.03462341, 0.010849981, -0.049665008, -0.036742024, -0.0002891857, 0.8569993, 0.36457688, 0.043817826, -0.019651368, 0.035478003, 0.05750426, 0.016170558));
    result += mul(conv2d_3_1_texOff(float2(-1, 0)), float4x4(0.036064275, 0.05824281, -0.052460678, -0.42717558, 0.11979657, -0.018621828, 0.10383658, 0.16512819, -0.045238987, -0.07318943, 0.053642068, -0.21683966, -0.03841329, 0.025648637, -0.012133466, -0.059211913));
    result += mul(conv2d_3_1_texOff(float2(0, 0)), float4x4(-0.10787878, -0.23087262, -0.046658896, -0.014740209, -0.22406544, -0.1745159, -0.13263509, -0.093253136, 0.014580761, 0.13457295, 0.23249811, 0.08546832, -0.10259791, 0.02757303, 0.04645754, -0.04259577));
    result += mul(conv2d_3_1_texOff(float2(1, 0)), float4x4(-0.022519916, -0.13789079, 0.057468746, -0.005406457, 0.030663079, 0.020166889, -0.015413978, 0.032845225, 0.123367496, 0.24675392, 0.006019362, 0.008253156, -0.040797878, 0.04180443, -0.14089884, 0.037172977));
    result += mul(conv2d_3_1_texOff(float2(-1, 1)), float4x4(-0.007479569, 0.0040500965, -0.0055267448, -0.10475741, -0.07024716, -0.13866442, 0.015509751, -0.021704236, 0.026488865, -0.050155547, 0.026498694, 0.10803753, 0.03834722, 0.014083306, 0.033266302, -0.08931849));
    result += mul(conv2d_3_1_texOff(float2(0, 1)), float4x4(-0.013222456, 0.008537506, -0.0013008822, 0.03752056, 0.03354649, 0.18220319, 0.0026278056, 0.04864769, 0.0331724, 0.057574503, 0.012354624, 0.07086085, -0.060708188, -0.033790454, 0.024953473, 0.031416606));
    result += mul(conv2d_3_1_texOff(float2(1, 1)), float4x4(0.006414751, -0.011741182, 0.03821488, 0.0203593, -0.026525974, -0.12438281, 0.03523268, 0.0140126655, 0.010693111, 0.22179279, -0.009424687, 0.014727395, -0.05901876, 0.16863306, 0.013297482, 0.010880199));
    result += mul(conv2d_3_2_texOff(float2(-1, -1)), float4x4(-0.0053246757, 0.30698183, -0.06947891, -0.13179196, 0.02300128, 0.11970014, 0.09707829, -0.02529241, -0.033329196, 0.15179911, -0.024787908, 0.06277704, -0.036571592, -0.2624008, 0.01061543, 0.095034525));
    result += mul(conv2d_3_2_texOff(float2(0, -1)), float4x4(-0.08576513, 0.0908795, 0.29666093, -0.024351185, 0.012647993, -0.524495, -0.24577762, -0.043049887, 0.068175256, -0.19777428, 0.048614997, -0.042119022, -0.0361159, 0.16981636, 0.09746712, -0.008025099));
    result += mul(conv2d_3_2_texOff(float2(1, -1)), float4x4(0.02356727, 0.020345114, -0.06810735, 0.0012649292, -0.12164601, -0.337489, -0.0759761, 0.025231002, -0.104714304, 0.07222966, -0.020745128, 0.018536637, 0.009514033, -3.3024702e-05, 0.0021942, 0.009906382));
    result += mul(conv2d_3_2_texOff(float2(-1, 0)), float4x4(-0.020285249, -0.006766886, -0.13643064, -0.09743658, -0.033794966, -0.09006814, 0.012039127, -0.26931947, -0.02036013, 0.052120548, -0.08449211, -0.24000354, 0.027088108, -0.24193507, 0.12341676, 0.17855242));
    result += mul(conv2d_3_2_texOff(float2(0, 0)), float4x4(0.047577545, -0.104099624, 0.11288596, -0.090173446, -0.25930348, -0.44417518, -0.1366215, -0.193125, -0.20867528, -0.11779409, -0.10070403, -0.15855572, -0.016720278, 0.37754843, -0.01112789, -0.009810333));
    result += mul(conv2d_3_2_texOff(float2(1, 0)), float4x4(-0.008312646, -0.04075962, -0.07447221, -0.011347075, 0.14061889, -0.404735, -0.049241852, -0.007292783, 0.15123619, 0.0936851, -0.052345313, -0.022006713, -0.08572719, -0.1308639, -0.022097846, -0.016507126));
    result += mul(conv2d_3_2_texOff(float2(-1, 1)), float4x4(0.036602877, 0.20127988, -0.0838644, 0.0076647117, 0.011910587, 0.046964355, -0.020733304, 0.07557786, -0.012831542, 0.06678074, -0.028419958, 0.036561646, -0.07071084, -0.06860319, -0.0010021605, -0.02876561));
    result += mul(conv2d_3_2_texOff(float2(0, 1)), float4x4(-0.010768345, -0.05174224, 0.050022498, -0.02319787, -0.025749398, -0.025470886, 0.07043637, -0.03711511, 0.10429206, 0.007661538, 0.050383728, -0.012660342, 0.01979642, 0.00938142, -0.015745826, -0.11077673));
    result += mul(conv2d_3_2_texOff(float2(1, 1)), float4x4(0.0073033087, 0.07863004, -0.02549132, 0.012665624, 0.020566138, 0.16099732, -0.011675152, 0.0338162, -0.007961319, 0.15605652, -0.035612583, 0.018916095, -0.01897776, -0.06857568, 0.011483128, -0.011673309));
    result += mul(conv2d_3_3_texOff(float2(-1, -1)), float4x4(-0.06532008, 0.02672442, 0.058100708, -0.014401107, 0.052269816, -0.074371845, 0.04156897, 0.08539853, -0.020398822, 0.08774901, -0.18428199, -0.07143217, -0.038626384, -0.10721765, -0.104026735, -0.122649595));
    result += mul(conv2d_3_3_texOff(float2(0, -1)), float4x4(-0.071476154, -0.0015601891, 0.0074135596, 0.0009596054, 0.029837368, -0.29404405, -0.04851033, 0.050476253, -0.010049829, -0.39606068, 0.2524883, 0.014276672, 0.09506599, 0.20509133, 0.2231245, 0.042187896));
    result += mul(conv2d_3_3_texOff(float2(1, -1)), float4x4(0.08205925, -0.057617247, 0.061922804, -0.025801579, 0.010669897, -0.07568819, -0.04725725, -0.022711733, 0.054012086, -0.14747323, -0.056600936, -0.037474647, -0.078735396, 0.34666348, -0.08620147, 0.057207905));
    result += mul(conv2d_3_3_texOff(float2(-1, 0)), float4x4(-0.07981163, 0.3253931, -0.11816914, -0.113299884, -0.0058959555, -0.2644837, -0.0026539252, -0.029257093, 0.01412403, -0.053878408, 0.021400359, -0.005736242, -0.31420484, 0.20826733, -0.22827208, -0.27173644));
    result += mul(conv2d_3_3_texOff(float2(0, 0)), float4x4(0.06686795, -0.06752481, -0.5438079, 0.16239598, 0.016461326, -0.12971431, 0.02258668, 0.06475428, 0.14740963, -0.14509022, 0.15396568, 0.16094042, 0.19157322, -0.28390884, 0.2979828, -0.110016555));
    result += mul(conv2d_3_3_texOff(float2(1, 0)), float4x4(-0.0850188, -0.28831398, 0.08173923, -0.0188269, 0.0043411897, 0.03679123, -0.0760861, 0.027203284, -0.15933245, -0.13167891, 0.115156114, 0.027408531, 0.073973484, 0.20136672, -0.16904733, 0.021787088));
    result += mul(conv2d_3_3_texOff(float2(-1, 1)), float4x4(-0.09035476, -0.12027801, -0.062225875, -0.17554164, -0.0017133591, 0.05991543, -0.13194841, -0.047357168, 0.054911036, 0.056126744, 0.015779765, -0.025703102, -0.23057269, -0.3666273, -0.15734671, -0.024494488));
    result += mul(conv2d_3_3_texOff(float2(0, 1)), float4x4(-0.015522413, 0.13115236, -0.0067398734, 0.031833984, 0.03683067, -0.2237451, 0.034176663, -0.01011775, -0.08869641, -0.15834151, -0.011819446, -0.013015267, -0.23244461, 0.042234205, 0.015328606, -0.21752214));
    result += mul(conv2d_3_3_texOff(float2(1, 1)), float4x4(0.034928884, -0.15059946, 0.04598998, -0.01167726, -0.02115161, 0.012529946, -0.023648728, 0.017242273, 0.018203966, -0.09311603, -0.007900059, -0.047443874, -0.048747633, 0.20206301, -0.029640034, 0.0013364827));
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
