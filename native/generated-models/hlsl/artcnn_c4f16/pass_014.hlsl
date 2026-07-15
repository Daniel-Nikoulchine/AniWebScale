// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:645
// Pass: 014 - ArtCNN C4F16 (Conv2D-3-ReLU)
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
    float4 result = float4(0.002013495, 0.017951693, -0.033837277, 0.0067746737);
    result += mul(conv2d_2_0_texOff(float2(-1, -1)), float4x4(-0.19244328, -0.032445733, 0.0384929, -0.0010473132, -0.018531958, 0.09678128, -0.0048232726, 0.0942715, 0.032843415, 0.17320022, -0.10760454, 0.044555347, -0.02255001, -0.007061429, 0.032806575, -0.08771166));
    result += mul(conv2d_2_0_texOff(float2(0, -1)), float4x4(-0.07906122, -0.31947276, 0.029273713, -0.0667113, 0.066709384, 0.051541906, 0.010659969, 0.08550476, 0.022534713, 0.097241506, -0.13187172, 0.06076088, 0.14226279, -0.11246526, 0.14377011, -0.04610357));
    result += mul(conv2d_2_0_texOff(float2(1, -1)), float4x4(-0.056424726, -0.012585067, 0.0077799708, 0.098485336, 0.037150968, 0.07689292, -0.040272582, 0.0152799, -0.09361864, 0.040604472, -0.03538387, -0.103867516, 0.050438877, -0.105522364, 0.036817048, -0.03142214));
    result += mul(conv2d_2_0_texOff(float2(-1, 0)), float4x4(-0.2636894, 0.5668854, -0.11931384, 0.036896404, 0.2220039, -0.12625705, -0.0012065987, -0.23907807, 0.03012159, -0.2475896, -0.06361573, -0.03686182, 0.15516458, -0.10575294, 0.043885488, -0.09594016));
    result += mul(conv2d_2_0_texOff(float2(0, 0)), float4x4(-0.1600004, -0.1692221, 0.16330482, -0.12133015, -0.24822308, 0.31427085, 0.047580626, -0.21857522, 0.46376118, -0.28014138, -0.047653265, -0.02585211, -0.29482922, -0.30760977, 0.65106463, 0.11640053));
    result += mul(conv2d_2_0_texOff(float2(1, 0)), float4x4(-0.07149673, 0.03217042, -0.019210324, 0.086977474, 0.012352594, -0.15849459, 0.085542515, -0.08540329, 0.0028209207, -0.094848424, 0.053305205, 0.048215255, -0.111065395, 0.23031811, -0.14982879, 0.21885426));
    result += mul(conv2d_2_0_texOff(float2(-1, 1)), float4x4(-0.10545956, -0.10977405, -0.050232846, -0.06122222, 0.2539012, -0.1371526, 0.12088696, -0.096310265, -0.034822296, 0.109474115, 0.028194325, 0.02140806, -0.017013589, 0.048585963, -0.04915936, 0.17598474));
    result += mul(conv2d_2_0_texOff(float2(0, 1)), float4x4(-0.0043166913, -0.144477, 0.020302644, -0.09180306, 0.02832013, 0.3408872, 0.0051920526, -0.123616524, 0.08825121, 0.012863541, 0.003505181, 0.044100355, -0.12167099, -0.08794477, -0.03150544, -0.35386425));
    result += mul(conv2d_2_0_texOff(float2(1, 1)), float4x4(0.0033708739, 0.011373062, 0.013439134, 0.00057548226, 0.042888053, 0.003533616, 0.09715636, -0.012319796, -0.019974139, 0.08799158, -0.06042456, 0.051348276, -0.10471078, -0.0024519826, 0.09349889, -0.06178982));
    result += mul(conv2d_2_1_texOff(float2(-1, -1)), float4x4(0.032517802, 0.0026621267, 0.038824122, -0.013348115, 0.09866215, 0.009881601, -0.02758739, -0.05274342, -0.058060784, -0.013624714, 0.030156465, -0.026986165, 0.054266397, -0.06810068, 0.026735803, -0.0965735));
    result += mul(conv2d_2_1_texOff(float2(0, -1)), float4x4(-0.11128844, 0.03184735, 0.04344447, -0.06814112, 0.04323502, 0.043412607, -0.032416917, -0.033644903, -0.1284383, 0.08504895, -0.024995323, 0.048360597, -0.009727119, -0.04727075, 0.026943866, -0.21939467));
    result += mul(conv2d_2_1_texOff(float2(1, -1)), float4x4(-0.06287497, -0.024509167, -0.030477948, 0.0013769533, 0.04600945, 0.021387553, -0.054080397, 0.0151178315, -0.0483962, 0.0134980595, -0.005960856, 0.008157216, -0.012752727, 0.08711487, 0.05183089, -0.09103491));
    result += mul(conv2d_2_1_texOff(float2(-1, 0)), float4x4(0.014431399, -0.036772367, 0.13168308, 0.09967675, -0.25900555, 0.2703185, -0.0063312063, -0.11760361, -0.06957414, -0.12251451, 0.08652267, 0.05251238, 0.022356404, 0.62096053, 0.04348302, -0.23994325));
    result += mul(conv2d_2_1_texOff(float2(0, 0)), float4x4(0.15057287, 0.057973642, 0.091188, -0.08505121, -0.23321387, 0.24330465, 0.07079573, -0.45803636, 0.48080817, 0.04713761, -0.061762825, 0.44705275, 0.41713083, -0.094086185, 0.06796389, -0.36111745));
    result += mul(conv2d_2_1_texOff(float2(1, 0)), float4x4(-0.0072143893, 0.082643226, -0.05239135, 0.062070966, -0.080273174, -0.006983277, -0.012073794, 0.0659655, 0.09316985, 0.11766399, -0.07481751, -0.071968384, 0.020979865, 0.031110862, 0.041505918, 0.18391557));
    result += mul(conv2d_2_1_texOff(float2(-1, 1)), float4x4(0.015800325, 0.03823791, 0.03924558, -0.078693114, -0.19943179, 0.17100905, -0.055579145, -0.053898048, 0.03966025, -0.06948847, 0.013742269, -0.1590633, 0.10510633, -0.3052228, -0.00895283, -0.133082));
    result += mul(conv2d_2_1_texOff(float2(0, 1)), float4x4(0.08441153, -0.06336806, 0.012379368, 0.0748601, -0.23291184, 0.12931238, 0.031974133, -0.14639105, 0.038389504, -0.010806086, 0.050610192, 0.08915213, -0.15197195, -0.111687966, -0.094980314, -0.41887787));
    result += mul(conv2d_2_1_texOff(float2(1, 1)), float4x4(0.00038966723, 0.0023344564, 0.021530146, 0.0039533796, 0.058594193, 0.060165666, -0.007261481, 0.026254956, -0.07949878, 0.04736933, 0.0063146246, 0.15080452, 0.09165024, -0.0127395885, 0.061509617, -0.112146504));
    result += mul(conv2d_2_2_texOff(float2(-1, -1)), float4x4(0.0036831356, -0.106113285, 0.076906994, -0.06860609, 0.06863676, -0.036501423, 0.007863887, 0.05062298, -0.17322776, 0.310778, -0.1553338, 0.0873652, 0.10006397, -0.20127726, 0.036839128, 0.057538074));
    result += mul(conv2d_2_2_texOff(float2(0, -1)), float4x4(-0.064594775, -0.041125167, -0.0747717, -0.1767427, -0.045648757, 0.098110154, -0.07719644, 0.097599685, -0.56378084, 0.42646244, 0.12997921, -0.33762038, -0.12381468, 0.14679554, -0.08494098, 0.1405014));
    result += mul(conv2d_2_2_texOff(float2(1, -1)), float4x4(0.023055667, -0.10348572, -0.013355914, 0.03800566, 0.10291341, 0.007403384, -0.008179721, -0.09873972, 0.009692934, 0.06847363, -0.033846196, -0.019459283, 0.08218869, -0.15122491, -0.010759968, -0.30213642));
    result += mul(conv2d_2_2_texOff(float2(-1, 0)), float4x4(-0.014648218, 0.010898572, 0.0310637, 0.21531512, 0.19265974, -0.045331158, 0.1798333, 0.07952563, 0.15418203, 0.11114002, 0.038907807, 0.0016045767, -0.0929759, 0.105738565, -0.03518507, 0.13619304));
    result += mul(conv2d_2_2_texOff(float2(0, 0)), float4x4(-0.25597882, 0.15448335, -0.1498883, -0.038152296, -0.3439685, 0.21562847, -0.2043657, -0.1455353, 0.09867395, 0.30487615, -0.122212864, 0.23258609, -0.020059476, -0.05289685, -0.020271178, -0.1925249));
    result += mul(conv2d_2_2_texOff(float2(1, 0)), float4x4(-0.051781766, -0.12935151, 0.03715201, -0.3163169, 0.013879485, -0.027116481, 0.0068625407, 0.028243765, 0.018747408, 0.16512078, -0.07036779, 0.19666748, -0.2085465, -0.03016694, 0.03798086, -0.03378288));
    result += mul(conv2d_2_2_texOff(float2(-1, 1)), float4x4(-0.057851586, -0.030173728, -0.012449377, -0.15930407, 0.05714581, -0.052414212, -0.022051891, 0.044490874, -0.014140392, -0.0058592865, -0.085904814, -0.007310541, -0.0010531337, 0.033507448, -0.058864698, -0.021770317));
    result += mul(conv2d_2_2_texOff(float2(0, 1)), float4x4(-0.07796512, -0.08710503, 0.032889977, 0.03986305, 0.059483074, 0.009883993, -0.03376454, 0.086851, -0.106581435, -0.008685688, 0.016481083, 0.0127896285, 0.14181958, -0.034685653, 0.07180188, 0.14215942));
    result += mul(conv2d_2_2_texOff(float2(1, 1)), float4x4(0.0897717, -0.11353723, -0.06751338, -0.09324831, -0.05255828, -0.045082834, -0.040510584, 0.024068307, 0.011639822, -0.03593605, 0.006494175, -0.010621925, 0.091854595, 0.027440771, -0.09465107, -0.064326204));
    result += mul(conv2d_2_3_texOff(float2(-1, -1)), float4x4(-0.09019981, 0.1238555, 0.028100148, 0.1607948, 0.58874655, 1.2473346, -0.14736241, 0.25600767, -0.015588784, -0.046664316, 0.081607334, 0.012406652, 0.0730226, 0.07755276, -0.07190064, 0.13347498));
    result += mul(conv2d_2_3_texOff(float2(0, -1)), float4x4(0.32993415, -0.19276516, 0.03674621, -0.063807525, 1.2488561, 0.24476793, 0.04880616, 0.6073971, 0.0048482246, -0.1416201, 0.3030357, -0.16945733, 0.077242844, 0.116778664, -0.116321884, 0.24363312));
    result += mul(conv2d_2_3_texOff(float2(1, -1)), float4x4(0.02594935, 0.023782952, 0.028307274, 0.11963194, 0.4840628, 1.0102857, 0.38884804, 0.27936038, 0.09980509, 0.0056739426, 0.08783079, 0.06358447, 0.09008691, 0.08843665, -0.10601781, 0.03812305));
    result += mul(conv2d_2_3_texOff(float2(-1, 0)), float4x4(-0.6697451, 1.2100993, 0.27757406, -1.1198212, 0.059656795, -0.17533368, -0.059514873, -0.03257793, -0.034348175, 0.06768327, 0.0503886, -0.038453545, -0.1304302, 0.2527529, -0.052665185, 0.030487323));
    result += mul(conv2d_2_3_texOff(float2(0, 0)), float4x4(-0.27683696, 0.26943603, 0.039424516, -0.075977616, -0.0003320017, 0.15642948, 0.10330125, 0.22979422, -0.30314568, -0.3469081, 0.30163544, -0.031355433, -0.15714958, -0.121189065, 0.05068709, -0.3771409));
    result += mul(conv2d_2_3_texOff(float2(1, 0)), float4x4(-0.122261584, -0.035094433, 0.08292668, 0.018874828, 0.14489129, 0.039954312, -0.12521411, -0.16093162, 0.14624164, 0.05556001, -0.04525103, -0.095507815, -0.029749911, 0.04424881, 0.03472817, 0.17055504));
    result += mul(conv2d_2_3_texOff(float2(-1, 1)), float4x4(-0.45446426, 0.6177883, -0.09305868, 0.02913999, 0.0030000985, -0.07949083, 0.0257773, 0.011817507, -0.019860765, 0.008087447, 0.02306534, 0.007796729, -0.0088950405, -0.009308649, -0.025112703, -0.06734964));
    result += mul(conv2d_2_3_texOff(float2(0, 1)), float4x4(-0.17803042, -0.06253541, -0.12226033, -0.02511907, -0.029828176, 0.131226, -0.037633233, -0.029562583, 0.052031927, -0.008945971, 0.051976632, 0.04962588, -0.14011759, 0.08021034, 0.04145528, 0.0894469));
    result += mul(conv2d_2_3_texOff(float2(1, 1)), float4x4(0.0741707, -0.03927973, -0.07536183, -0.16477391, -0.0004491242, 0.026855236, 0.008416536, 0.05495654, 0.05229332, -0.022330288, -0.015339377, 0.0005636166, 0.019633975, 0.020482581, -0.014309795, 0.004396874));
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
