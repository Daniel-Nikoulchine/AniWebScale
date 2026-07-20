// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:698
// Pass: 015 - ArtCNN C4F16 (Conv2D-3-ReLU)
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
    float4 result = float4(-0.012237041, 0.016840631, 0.013321678, 0.007706652);
    result += mul(conv2d_2_0_texOff(float2(-1, -1)), float4x4(-0.09253268, -0.31037372, 0.059195682, 0.035239045, 0.022469053, -0.06815368, -0.0069074132, -0.057629734, -0.010841238, -0.09389067, -0.03814839, 0.035245486, 0.014257425, 0.03851035, 0.024492145, 0.01494798));
    result += mul(conv2d_2_0_texOff(float2(0, -1)), float4x4(0.1433067, -0.30404577, -0.02661987, -0.062046237, -0.05921778, 0.15055239, 0.010894747, -0.027623756, 0.059921768, -0.0011853547, 0.09911544, -0.07290927, -0.03205436, -0.034147024, -0.051488545, 0.08135736));
    result += mul(conv2d_2_0_texOff(float2(1, -1)), float4x4(0.032781627, -0.54118246, -0.003075039, 0.07164099, 0.07144015, -0.0006478866, -0.009499374, -0.51897645, -0.071310475, 0.0032334607, 0.015669119, -0.6009979, 0.015458561, -0.24313785, 0.019831872, -0.0339539));
    result += mul(conv2d_2_0_texOff(float2(-1, 0)), float4x4(-0.03394234, -0.713019, -0.038286902, -0.07923022, 0.04935009, 0.4898222, 0.030060124, -0.0837064, 0.016229559, -0.019386552, 0.13709599, 0.011276776, 0.028320003, -0.065775275, 0.028961128, -0.047259808));
    result += mul(conv2d_2_0_texOff(float2(0, 0)), float4x4(0.13810556, -0.49482358, 0.10965908, 0.0071960427, -0.021066029, -0.30214432, -0.049666196, -0.06876718, -0.21122167, -0.19679774, 0.096000545, 0.050556973, 0.026920106, -0.40690586, -0.16335258, -0.012386836));
    result += mul(conv2d_2_0_texOff(float2(1, 0)), float4x4(0.051534373, -0.18193987, 0.005662878, -0.033747725, -0.10516578, 0.046241246, -0.0069642724, 0.17586455, -0.06287305, -0.16597241, 0.06303388, 0.12156573, 0.16277847, 0.12386714, -0.015697567, -0.27386746));
    result += mul(conv2d_2_0_texOff(float2(-1, 1)), float4x4(-0.010443169, -0.3075228, -0.05277244, -0.015552717, 0.027389022, 0.059743144, 0.04283912, 0.045986757, 0.0027940075, -0.042870894, 0.076944, 0.053725477, -0.027887765, -0.21710625, 0.00850186, -0.025661882));
    result += mul(conv2d_2_0_texOff(float2(0, 1)), float4x4(0.027504561, -0.43355823, 0.026347948, -0.03898752, -0.05685967, 0.18610705, 0.017202167, 0.14471565, 0.011641464, 0.09087736, 0.08877668, 0.10608464, 0.030982213, -0.05164567, -0.22469404, -0.019994719));
    result += mul(conv2d_2_0_texOff(float2(1, 1)), float4x4(-0.0018243957, -0.23000051, -0.011605892, -0.05621964, 0.002728994, 0.045968, 0.06108526, 0.051917158, -0.05300302, -0.17184967, -0.03028342, -0.0047246553, 0.007847357, -0.1011958, 0.067006096, -0.0977127));
    result += mul(conv2d_2_1_texOff(float2(-1, -1)), float4x4(0.0064074057, -0.0073300246, 0.007951715, 0.051623534, -0.008967649, 0.11102349, 0.02588364, 0.1084567, 0.0118131265, -0.119380094, -0.0015791799, 0.037055656, -0.025625084, 0.29928297, 0.05152511, -0.015602721));
    result += mul(conv2d_2_1_texOff(float2(0, -1)), float4x4(0.008596643, 0.22169738, 0.012002129, 0.05114267, 0.074006714, 0.08953417, -0.053505633, 0.07517279, 0.052556504, 0.047497913, 0.02625809, -0.04683355, 0.15322371, -0.13140002, -0.043095604, 0.024350531));
    result += mul(conv2d_2_1_texOff(float2(1, -1)), float4x4(0.046479385, -0.011660055, -0.011108348, -0.0332869, 0.045186874, -0.013450514, -0.02076097, 0.06384375, -0.010667719, 0.06404749, -0.006476996, -0.19582424, 0.029816896, 0.05833459, 0.021392114, -0.09977608));
    result += mul(conv2d_2_1_texOff(float2(-1, 0)), float4x4(0.024390876, -0.087076485, 0.0755498, -0.03492841, -0.045170166, 0.11870893, 0.007762089, -0.032235738, 0.032115474, -0.13722795, 0.043888688, 0.065312214, -0.033059813, 0.26011148, -0.028666379, 0.06542417));
    result += mul(conv2d_2_1_texOff(float2(0, 0)), float4x4(-0.014031898, 0.14095983, 0.09456383, -0.03441948, 0.026775718, -0.09788429, 0.108909965, -0.19124126, 0.025687918, 0.015235274, 0.053457525, 0.06871636, 0.046217237, -0.05085751, 0.28038317, 0.11137212));
    result += mul(conv2d_2_1_texOff(float2(1, 0)), float4x4(0.112499624, -0.085310414, -0.021976942, -0.20636147, 0.030476598, -0.23223189, -0.018269857, 0.150226, 0.066493355, 0.082590766, -0.041937288, -0.0780113, 0.082534745, 0.29378417, -0.006645655, -0.034103177));
    result += mul(conv2d_2_1_texOff(float2(-1, 1)), float4x4(3.858224e-05, 0.061431114, 0.035964582, 0.060766947, -0.005997719, -1.0006844, -0.034428336, -0.06754782, 0.023257814, 0.27557495, -0.030940956, 0.027155727, 0.042578537, 0.092041604, 0.04873805, 0.07373815));
    result += mul(conv2d_2_1_texOff(float2(0, 1)), float4x4(0.02294465, -0.07904211, -0.016750032, 0.036815777, -0.0040773014, 0.19476639, -0.0036368908, 0.06607566, 0.02166648, 0.2633427, 0.017362233, 0.01970516, -0.039279886, 0.28867796, -0.1878874, -0.0752016));
    result += mul(conv2d_2_1_texOff(float2(1, 1)), float4x4(-0.017432515, 0.17636788, 0.024408398, 0.04998082, 0.024812814, 0.04777254, -0.025221048, -0.0044214516, 0.028928258, 0.0040764473, 0.008961572, 0.10508208, -0.058410153, -0.023513285, 0.0858864, -0.058042344));
    result += mul(conv2d_2_2_texOff(float2(-1, -1)), float4x4(-0.009255835, 0.10798716, -0.015638942, 0.0010140006, 0.022128426, 0.13251023, 0.025268473, -0.08104042, -0.08962332, 0.10989683, -0.12783396, 0.03900268, 0.05055069, 0.050963845, 0.05555001, -0.03707802));
    result += mul(conv2d_2_2_texOff(float2(0, -1)), float4x4(-0.074677594, 0.021939943, 0.003915388, -0.010557592, -0.048010476, -0.19399077, 0.0043105655, -0.23440619, 0.028404579, 0.07293613, 0.053142667, -0.38918325, -0.14477526, 0.06051216, -0.021963445, 0.01099414));
    result += mul(conv2d_2_2_texOff(float2(1, -1)), float4x4(0.102739744, 0.18273662, -0.014584407, 0.29244196, 0.0009947264, 0.06830259, -0.011213027, 0.13422163, 0.014784342, 0.095893115, 0.0040425044, 0.39984626, 0.027278638, -0.071930245, -0.03798468, -0.21047692));
    result += mul(conv2d_2_2_texOff(float2(-1, 0)), float4x4(-0.009389412, -0.05035106, -0.005752481, 0.023756046, -0.008399489, -0.10825584, 0.049120236, 0.058206197, -0.017800191, 0.31880328, -0.00741045, 0.020177545, -0.05699409, -0.06947856, -0.037836004, -0.023923064));
    result += mul(conv2d_2_2_texOff(float2(0, 0)), float4x4(0.03422605, 0.101679295, 0.043176416, -0.21236414, -0.057062116, -0.06435432, -0.08102767, -0.055158157, 0.1196593, -0.037806198, 0.13058482, 0.035425194, -0.009000395, 0.29069963, 0.013341352, -0.10388763));
    result += mul(conv2d_2_2_texOff(float2(1, 0)), float4x4(0.030201403, -0.20320587, -0.01624097, -0.041135613, 0.095249906, -0.041634843, -0.01685811, -0.0874171, 0.12534268, -0.23456942, -0.07581533, 0.013098546, 0.01633888, -0.123583056, -0.017788962, -0.14522892));
    result += mul(conv2d_2_2_texOff(float2(-1, 1)), float4x4(-0.031664327, 0.10901494, -0.040779732, -0.02451184, 0.0016069983, -0.07226916, -0.0005892511, 0.013458359, -0.030760799, 0.24618976, -0.08532963, -0.019430473, 0.03777155, 0.047796868, 0.01050731, -0.031724997));
    result += mul(conv2d_2_2_texOff(float2(0, 1)), float4x4(0.046219096, -0.1126453, 0.06875356, -0.028035253, -0.050528582, 0.104437724, -0.03329869, -0.06706529, 0.0327562, 0.073152654, 0.02665182, -0.028910043, 0.016412769, -0.07703881, -0.03791009, -0.0373658));
    result += mul(conv2d_2_2_texOff(float2(1, 1)), float4x4(0.010490066, 0.26143438, -0.053881157, 0.014772205, 0.034764443, 0.1334239, -0.009522307, 0.025299106, 0.059368677, 0.12474343, -0.023199277, 0.08451734, -0.0016884726, -0.029531183, 0.004045037, -0.18041083));
    result += mul(conv2d_2_3_texOff(float2(-1, -1)), float4x4(0.018167721, 0.6702042, -0.023856303, -0.06893953, 0.4138134, -0.033846468, -0.0236712, 0.7230157, 0.02913327, 0.21273452, 0.07464989, -0.024515504, -0.027250918, 0.009574753, -0.04760163, 0.02669663));
    result += mul(conv2d_2_3_texOff(float2(0, -1)), float4x4(0.18673357, 0.029966868, -0.010607815, 0.11731494, 0.46217972, -0.31385133, 0.386755, 0.3028572, -0.029753197, -0.27162954, -0.020683598, 0.05995404, 0.024596438, -0.02682391, -0.07204157, 0.063921005));
    result += mul(conv2d_2_3_texOff(float2(1, -1)), float4x4(-0.037384845, -0.12453684, 0.00040231488, 0.1761165, 0.1285152, 0.15333654, 0.29901025, 0.30785927, -0.09124239, -0.03023584, 0.050723854, 0.329607, -0.037456717, 0.023151182, -0.03552642, 0.18845241));
    result += mul(conv2d_2_3_texOff(float2(-1, 0)), float4x4(-0.029636558, 0.1258242, 0.30014133, -0.9215776, 0.10654319, 0.13389178, 0.23353738, -0.010439836, -0.039217856, 0.01481335, -0.10866966, 0.009400311, -0.021369195, 0.084326945, -0.09138006, -0.019960351));
    result += mul(conv2d_2_3_texOff(float2(0, 0)), float4x4(0.37107202, -0.35153943, 0.002348929, 0.34303176, 0.42710748, -0.18407167, 0.4733705, 0.012169977, 0.2583424, 0.23943152, 0.39308542, -0.003211128, -0.026115078, -0.6084694, 0.034646954, 0.022119539));
    result += mul(conv2d_2_3_texOff(float2(1, 0)), float4x4(0.0062516537, -0.24750778, 0.07262093, -0.17606023, 0.27813318, -0.18875381, -0.06680547, 0.08232854, -0.18284129, -0.11699034, -0.08349394, -0.008786976, -0.069882706, 0.2977789, -0.0276464, -0.27154484));
    result += mul(conv2d_2_3_texOff(float2(-1, 1)), float4x4(0.027129712, -0.89029205, -0.015106628, -0.5365512, 0.015661892, -0.0152935535, -0.046196945, 0.020683672, -0.011685081, -0.12178665, -0.04783443, -0.04207959, 0.002435341, 0.2063279, -0.026680242, -0.0010856502));
    result += mul(conv2d_2_3_texOff(float2(0, 1)), float4x4(0.1882203, 0.2266746, -0.019684797, -0.09571448, 0.01796102, 0.008326705, 0.0069343443, 0.0012043348, 0.03428547, -0.0674506, 0.16007005, 0.010333827, -0.05389978, -0.025850201, -0.0023371994, -0.13165724));
    result += mul(conv2d_2_3_texOff(float2(1, 1)), float4x4(0.02116264, 0.34308338, -0.06602457, 0.037091967, -0.021536779, 0.21056192, 0.00848063, 0.029063003, -0.025745057, 0.10759355, -0.0394953, 0.015808199, -0.014111393, -0.02217847, 0.021839578, 0.0028474883));
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
