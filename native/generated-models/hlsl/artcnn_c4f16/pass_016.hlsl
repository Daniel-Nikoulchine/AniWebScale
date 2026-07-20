// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:751
// Pass: 016 - ArtCNN C4F16 (Conv2D-4-ReLU)
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
    float4 result = float4(-0.0034821015, -0.000690439, 0.008925155, -0.013007978);
    result += mul(conv2d_3_0_texOff(float2(-1, -1)), float4x4(0.009489293, -0.027773317, -0.014100081, -0.0126850465, -0.0053614713, 0.03179907, 0.02577175, -0.017267575, -0.011041946, 0.1497359, 0.055702817, -0.060869783, 0.016495494, 0.16727485, 0.047385555, -0.025566734));
    result += mul(conv2d_3_0_texOff(float2(0, -1)), float4x4(-0.027389802, 0.04692717, -0.035886377, 0.07004645, 0.0115202125, 0.058479022, 0.031674292, -0.04622172, 0.0069535277, 0.019570721, -0.061939415, 0.08360954, -0.005579002, -0.05380906, -0.032921195, 0.056105953));
    result += mul(conv2d_3_0_texOff(float2(1, -1)), float4x4(0.012766654, 0.0030924517, -0.0074246316, 0.03018321, -0.009639229, 0.015524892, 0.0049369796, -0.003775368, -0.006556514, 0.029725665, -0.0034088618, 0.032248717, -0.0018223485, 0.01905979, 0.03277189, -0.025154939));
    result += mul(conv2d_3_0_texOff(float2(-1, 0)), float4x4(0.005557546, -0.018686004, -0.09169593, 0.08821935, 0.0054540387, -0.23842111, -0.0963912, 0.06449907, -0.013959792, -0.34355408, -0.016480863, 0.044005126, 0.004798581, 0.5989806, -0.06755217, 0.021509381));
    result += mul(conv2d_3_0_texOff(float2(0, 0)), float4x4(-0.0062304134, 0.05550364, 0.2328005, -0.078091145, -0.01581146, -0.015043687, -0.10616477, 0.08553141, 0.036131278, -0.07028686, 0.17200229, -0.20486078, -0.02181417, 0.015339027, -0.23746647, 0.12554795));
    result += mul(conv2d_3_0_texOff(float2(1, 0)), float4x4(-0.002568639, -0.02902897, -0.06638004, 0.05381153, 0.0013385561, -0.004142995, -0.01903433, 0.016666306, -0.00076882035, 0.006894832, -0.029691868, -0.015705813, -0.003351211, 0.056602966, 0.10427731, -0.10154227));
    result += mul(conv2d_3_0_texOff(float2(-1, 1)), float4x4(-0.0053988607, -0.07528912, -0.018199582, 0.02546507, -0.07499131, 0.053858556, 0.042581256, -0.04401339, -0.011783253, -0.12840985, -0.011040819, 0.03668004, 0.020338934, 0.31463072, 0.050997127, -0.03933453));
    result += mul(conv2d_3_0_texOff(float2(0, 1)), float4x4(-0.037229113, 0.046850827, -0.054990176, 0.09173147, 0.102799185, -0.008709043, 0.0497397, -0.034603536, -0.08241012, -0.016373875, -0.056412634, 0.04287955, 0.0072518424, -0.10289912, -0.012051862, 0.02321894));
    result += mul(conv2d_3_0_texOff(float2(1, 1)), float4x4(-0.0034903553, -0.061010063, -0.010641682, -0.017825712, -0.056043472, 0.034915842, -0.009602229, -0.0074876687, 0.017426403, 0.04295081, -0.006961116, 0.015925393, 0.005949645, 0.06463417, 0.014883644, -0.022481823));
    result += mul(conv2d_3_1_texOff(float2(-1, -1)), float4x4(0.0062589184, -0.028697722, -0.007106424, 0.002549266, 0.022500722, 0.021881158, -0.007532569, -0.0026564521, -0.043900404, 0.53011286, -0.16600353, 0.15316701, 0.009367551, 0.1309907, 0.025344178, -0.04583213));
    result += mul(conv2d_3_1_texOff(float2(0, -1)), float4x4(-0.005101047, -0.20025915, 0.08428169, -0.023557305, -0.06440607, -0.08143261, -0.16557145, 0.14638437, -0.039785266, -0.013874403, 0.27482605, -0.23133145, -0.014051121, 0.0008587737, -0.013790557, 0.009419344));
    result += mul(conv2d_3_1_texOff(float2(1, -1)), float4x4(0.0043191924, 0.058091737, 0.03086602, -0.018680986, 0.030847292, 0.05797709, -0.028118845, 0.051166896, -0.03901806, -0.008239104, -0.050262667, 0.211843, 0.007861072, 0.018654166, -0.023346018, 0.0014553053));
    result += mul(conv2d_3_1_texOff(float2(-1, 0)), float4x4(0.034651157, -0.2688541, -0.009569381, 0.010925925, -0.05265457, -0.055054903, -0.083431065, 0.07626786, 0.024525769, -0.12558085, -0.029551178, -0.013412053, -0.024284635, -0.01997142, 0.023136947, -0.025673766));
    result += mul(conv2d_3_1_texOff(float2(0, 0)), float4x4(-0.035200316, -0.010271944, -0.15404962, 0.07194293, -0.08966891, -0.06634798, -0.23954014, 0.23415506, 0.110809125, 0.15001369, -0.0141171655, 0.0038580203, 0.078697376, -0.096526735, -0.057955496, 0.13842916));
    result += mul(conv2d_3_1_texOff(float2(1, 0)), float4x4(0.037104562, 0.01475004, -0.02956469, -0.0019092229, -0.0021801202, -0.017556215, -0.059649177, 0.08549521, 0.07199469, 0.34994742, 0.07979711, -0.06335568, -0.027583556, -0.0019324925, 0.046762954, -0.06552829));
    result += mul(conv2d_3_1_texOff(float2(-1, 1)), float4x4(-0.032927025, -0.13204017, 0.01579133, -0.015660632, -0.046880264, -0.22581932, -0.037584748, 0.0053320336, 0.019703668, 0.4713143, -0.011595099, 0.018438136, -0.0036803554, 0.18951389, -0.0069658514, -0.019258676));
    result += mul(conv2d_3_1_texOff(float2(0, 1)), float4x4(0.0967197, 0.11172207, 0.047131993, -0.051256374, 0.13357691, 0.1340492, 0.05945561, 0.0018901234, 0.08094624, 0.012112562, 0.07346025, -0.08337845, -0.086047955, -0.15081005, -0.021505196, -0.01248423));
    result += mul(conv2d_3_1_texOff(float2(1, 1)), float4x4(-0.07810362, -0.029700708, 0.005523986, -0.0036782813, -0.094941065, -0.10057476, -0.014556552, 0.003194686, -0.036551017, 0.008469397, 0.041208055, -0.05115848, 0.0032043024, 0.15333371, 0.0370977, -0.05209685));
    result += mul(conv2d_3_2_texOff(float2(-1, -1)), float4x4(-0.010918603, 0.32807934, 0.031084497, -0.06475584, 0.006005882, -0.6764937, 0.020357002, 0.007832051, -0.012824005, 0.025470994, 0.0027873325, 0.00044248183, -0.0022485459, -0.05159993, 0.006822434, -0.0016975685));
    result += mul(conv2d_3_2_texOff(float2(0, -1)), float4x4(0.024380643, -0.0445326, 0.08629985, -0.09649129, -0.0155199785, 0.018555496, -0.06582268, -0.09273389, 0.01960788, -0.05868754, 0.011186596, -0.025239225, 0.00514572, -0.026071422, 0.054509092, -0.08205089));
    result += mul(conv2d_3_2_texOff(float2(1, -1)), float4x4(-0.015805993, -0.014314249, 0.034870304, -0.032171097, 0.018741297, 0.08974034, -0.016262129, -0.010281618, -0.0028829013, -0.007579302, 0.06547186, -0.061522257, -0.005513846, -0.03055464, 0.0064933817, -0.012673623));
    result += mul(conv2d_3_2_texOff(float2(-1, 0)), float4x4(0.018236624, 0.22132899, 0.027888896, -0.037653398, 0.00030045374, -0.5382957, 0.00611927, 0.0030319493, -0.012489928, 0.020783663, 0.089795336, -0.057341903, 0.034937166, 0.0234592, -0.10303218, 0.04296549));
    result += mul(conv2d_3_2_texOff(float2(0, 0)), float4x4(-0.034774616, -0.069523156, 0.05401104, 0.27075192, 0.012291605, -0.24131449, -0.08820372, -0.16973248, 0.03195172, 0.16910622, 0.2447775, -0.34762564, 0.038120914, 0.058178794, 0.08588183, 0.08577127));
    result += mul(conv2d_3_2_texOff(float2(1, 0)), float4x4(0.016878748, -0.042581152, 0.051630758, -0.111545876, -0.061538693, -0.15755557, -0.059272718, -0.04685311, -0.0051978845, 0.071915716, 0.2546651, -0.2327447, 0.010664944, -0.039893407, -0.028971467, 0.028974162));
    result += mul(conv2d_3_2_texOff(float2(-1, 1)), float4x4(-0.0323396, 0.29052898, 0.009829094, -0.014655708, 0.037010092, -0.711668, -0.015814317, 0.0021145318, 0.06027267, 0.20533325, 0.02891254, -0.027703043, 0.0063109333, 0.13999546, -0.027657583, -0.00851114));
    result += mul(conv2d_3_2_texOff(float2(0, 1)), float4x4(-0.114042066, -0.061341304, 0.006587868, -0.027738176, -0.19293752, 0.057491545, -0.025312055, 0.0051443824, -0.20059898, -0.083573654, 0.07532941, -0.047037005, 0.29397318, -0.010920877, 0.051180024, -0.0685157));
    result += mul(conv2d_3_2_texOff(float2(1, 1)), float4x4(0.0058009364, 0.03351931, 0.025047017, -0.016875368, -0.102492094, 0.11970267, -0.004642828, 0.02572323, -0.0006414133, 0.0059532137, 0.045738004, -0.03164843, 0.031896506, -0.04464703, -0.019317202, -0.0076391096));
    result += mul(conv2d_3_3_texOff(float2(-1, -1)), float4x4(0.014942608, 0.21788742, 0.05063443, -0.071593404, -0.02106682, -0.15746316, -0.06168267, 0.010473292, 0.0067374753, -0.23488697, 0.07172335, -0.041831918, 0.031535685, 0.33468458, -0.025831794, -0.008861543));
    result += mul(conv2d_3_3_texOff(float2(0, -1)), float4x4(0.020274853, 0.14836878, -0.0186724, 0.002123136, 0.016699221, -0.1338437, 0.022252262, -0.012078228, -0.036593102, -0.1800366, -0.058087017, 0.08275453, -0.05357176, -0.21002622, -0.11268638, 0.07303505));
    result += mul(conv2d_3_3_texOff(float2(1, -1)), float4x4(-0.020612756, -0.08831165, -0.018962627, 0.004814289, -0.0077978047, 0.09438517, -0.0056109806, 0.029935155, 0.014534384, -5.4235494e-05, -0.10581292, 0.09077774, 0.04653936, 0.26227048, 0.0067760632, -0.004334402));
    result += mul(conv2d_3_3_texOff(float2(-1, 0)), float4x4(0.06661602, -1.17312, 0.09915509, 0.04633734, -0.06611919, -0.048983134, -0.0028495106, 0.053475697, -0.0007105348, -0.19527934, 0.005366361, -0.009545893, -0.13679561, 0.08339481, 0.036458407, -0.08758511));
    result += mul(conv2d_3_3_texOff(float2(0, 0)), float4x4(0.035683535, 0.11342541, 0.19930673, -0.27409554, 0.00059875695, -0.17787722, -0.08766668, -0.014497668, 0.22570029, -0.05276283, -0.23060998, 0.25548047, 0.19439141, -0.22159435, 0.09976562, 0.11139441));
    result += mul(conv2d_3_3_texOff(float2(1, 0)), float4x4(0.010035014, -0.02940204, -0.030722585, 0.0148081705, 0.011199003, 0.046917155, 0.030812113, -0.008051814, -0.011545123, -0.08292705, -0.17297673, 0.14853278, -0.14099179, 0.036059856, 0.08154065, -0.07305646));
    result += mul(conv2d_3_3_texOff(float2(-1, 1)), float4x4(0.07854409, -0.5124896, -0.03403076, 0.0366933, 0.066927336, 0.104794964, 0.009555107, -0.01550003, -0.0064562107, -0.15387407, -0.002945813, 0.016042665, -0.3624994, 0.06313415, -0.015088418, -0.13468237));
    result += mul(conv2d_3_3_texOff(float2(0, 1)), float4x4(0.01801173, 0.07030763, 0.033099283, -0.02002024, -0.12443124, -0.059167705, 0.011728259, 0.004048073, -0.21491264, 0.108641826, -0.111090936, 0.0761683, -0.29638848, -0.052618425, -0.06385739, 0.1031675));
    result += mul(conv2d_3_3_texOff(float2(1, 1)), float4x4(0.0026226372, -0.1116339, -0.036091506, 0.07141465, -0.10731534, 0.032683715, 0.0046686996, -0.014677367, 0.036539152, 0.004361113, -0.016831411, -0.009956042, 0.10920262, 0.054595318, 0.003000685, -0.024082249));
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
