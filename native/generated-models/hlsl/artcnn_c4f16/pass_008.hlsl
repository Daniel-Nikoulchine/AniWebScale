// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:327
// Pass: 008 - ArtCNN C4F16 (Conv2D-2-ReLU)
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
    float4 result = float4(0.0016116564, 0.0140217, -0.014276797, 0.032340433);
    result += mul(conv2d_1_0_texOff(float2(-1, -1)), float4x4(-0.07178392, 0.016315721, 0.0005946311, 0.030577589, 0.04333689, -0.093452394, -0.03004882, -0.050107926, -0.18490277, 0.26364493, -0.072260775, 0.039436042, 0.10363384, -0.028109187, 0.022135373, -0.03164059));
    result += mul(conv2d_1_0_texOff(float2(0, -1)), float4x4(-0.060812775, -0.027507998, 0.08723827, 0.046105627, -0.09353014, -0.10598249, -0.013066516, -0.0071146223, 0.20277588, -0.016686883, -0.1035257, -0.089943685, -0.14820841, 0.55914414, 0.22274832, 0.23501529));
    result += mul(conv2d_1_0_texOff(float2(1, -1)), float4x4(0.090052575, 0.06477594, -0.0070001115, -0.025469808, -0.03425754, -0.07294174, 0.0056329295, 0.0047411043, 0.16222997, 0.12144206, 0.09321884, 0.040264226, -0.04666454, 0.026579954, 0.050071947, 0.0076818587));
    result += mul(conv2d_1_0_texOff(float2(-1, 0)), float4x4(-0.08513167, -0.2875495, 0.041612845, -0.05138494, -0.09915952, 0.058951408, -0.1342867, -0.06935923, 0.037381623, 0.0919032, 0.17679717, 0.047678914, 0.101249166, -0.025736677, -0.024897905, -0.029233104));
    result += mul(conv2d_1_0_texOff(float2(0, 0)), float4x4(-0.068017535, 0.6301482, -0.26178157, 0.019698642, 0.06426559, -0.05189016, -0.14722882, -0.021859683, 0.04635214, 0.13306151, 0.042442184, 0.1065489, -0.8038567, 0.04119868, -0.26764, 0.07693732));
    result += mul(conv2d_1_0_texOff(float2(1, 0)), float4x4(0.075273335, -0.28333327, 0.19145235, 0.09513326, 0.009794974, 0.49292368, -0.044377442, 0.024185028, -0.18392205, -0.38400832, -0.0046880613, -0.011231526, -0.8897519, 0.09199683, 0.12134915, 0.11562762));
    result += mul(conv2d_1_0_texOff(float2(-1, 1)), float4x4(0.16570432, 0.40337393, 0.015051043, -0.060783073, 0.20551817, -0.03533, 0.12241853, -0.05348068, 0.12149841, 0.065062605, -0.11252291, -0.095354445, 0.10423435, -0.21775512, 0.069606744, -0.031629123));
    result += mul(conv2d_1_0_texOff(float2(0, 1)), float4x4(0.6460741, 0.14160515, 0.47721875, 0.34894952, 0.36413196, 0.13436675, 0.1483222, -0.0845658, -0.32323244, -0.48473448, -0.094253786, -0.21110763, 0.23572126, -0.026917353, -0.018204913, 0.010475741));
    result += mul(conv2d_1_0_texOff(float2(1, 1)), float4x4(-0.53249466, 0.24587016, -0.30272746, -0.27224007, 0.30246344, -0.10718816, -0.07307292, -0.13663685, 0.10813337, 0.0865046, 0.0773426, 0.12373443, -0.31325296, 0.11406258, 0.032060362, 0.007786539));
    result += mul(conv2d_1_1_texOff(float2(-1, -1)), float4x4(-0.114592634, -0.1237957, -0.028392505, -0.0451241, -0.016470285, 0.069527104, 0.08691624, 0.050399024, 0.029355677, -0.22757515, -0.03442622, -0.005107544, -0.05239135, -0.004135231, 0.02433436, 0.020816857));
    result += mul(conv2d_1_1_texOff(float2(0, -1)), float4x4(0.11775898, 0.060123272, -0.098467164, 0.036160126, -0.018650878, 0.59256804, 0.13154592, 0.10119831, -0.163676, -1.2136017, -0.20482856, -0.038299114, -0.075876825, 0.33163872, -0.102083705, -0.024919622));
    result += mul(conv2d_1_1_texOff(float2(1, -1)), float4x4(0.31219944, -0.0058680535, -0.007267952, -0.10193347, -0.15070787, 0.14449143, 0.029485961, 0.024213849, 0.283513, -0.23905759, 0.008131418, -0.0019627465, 0.07785088, 0.16787751, 0.1254994, 0.052326743));
    result += mul(conv2d_1_1_texOff(float2(-1, 0)), float4x4(-0.12166575, -0.022989959, 0.16047159, -0.0049578706, -0.18839242, 0.093603864, 0.036626857, 0.04650495, -0.037966672, -0.34665927, -0.020736754, 0.030776102, 0.15200391, -0.05308605, -0.01665302, -0.015148991));
    result += mul(conv2d_1_1_texOff(float2(0, 0)), float4x4(0.18189196, 0.11606551, 0.0501763, -0.087623715, -0.09908626, 0.21889333, -0.02159087, 0.08742199, 0.4474708, -0.015130144, 0.7541795, 0.24680516, 0.1323254, -0.42770717, 0.14092831, 0.05129375));
    result += mul(conv2d_1_1_texOff(float2(1, 0)), float4x4(-0.5243228, -0.030999888, -0.07326469, -0.01073922, -0.8842717, 0.07121405, 0.122859485, 0.06663911, 0.5692027, -0.057710417, -0.1157748, -0.0010078104, 0.45262274, -0.28402534, -0.051606968, -0.0013918148));
    result += mul(conv2d_1_1_texOff(float2(-1, 1)), float4x4(-0.17276578, -0.051045336, 0.07410003, 0.12283039, -0.00547139, -0.00341309, -0.010939392, -0.0016168455, -0.053534437, -0.02280984, 0.036317512, 0.055286255, -0.045057, -0.048533812, 0.025246356, 0.01564801));
    result += mul(conv2d_1_1_texOff(float2(0, 1)), float4x4(-0.075450085, -0.07351188, 0.06430049, 0.16461048, -0.02439493, 0.10749386, -0.009211288, -0.021171553, 0.267843, 0.15343265, -0.007827711, 0.013996766, -0.08798558, -0.028267896, 0.007338673, 0.020663666));
    result += mul(conv2d_1_1_texOff(float2(1, 1)), float4x4(0.3589905, -0.009084765, 0.016114205, 0.036301587, -0.1740047, 0.05202388, -0.015650894, -0.0064869453, 0.036118742, -0.15387653, -0.018667853, -0.01209729, 0.10280624, 0.011172811, 0.032254886, 0.012621561));
    result += mul(conv2d_1_2_texOff(float2(-1, -1)), float4x4(-0.04834014, -0.03526158, 0.05853831, 0.084554285, -0.28603014, -0.045017116, 0.26015744, -0.012468212, -0.06592498, -0.061726715, 0.043690905, 0.027016442, 0.017288918, -0.10919584, -0.043848794, 0.028733881));
    result += mul(conv2d_1_2_texOff(float2(0, -1)), float4x4(0.027486352, -0.349797, -0.027179768, -0.0013235832, -0.27719748, 0.34134665, -0.23344098, -0.0602352, -0.022250434, -0.062771015, 0.02326751, 0.009445905, 0.07089943, 0.021603946, 0.049525265, 0.029747402));
    result += mul(conv2d_1_2_texOff(float2(1, -1)), float4x4(-0.0065616057, -0.0007921599, 0.011979688, -0.012808949, -0.12567553, 0.051304962, 0.08071553, -0.001188184, -0.026608888, 0.032864925, 0.0030524454, 0.021533625, 0.056682047, -0.076001935, 0.020241361, 0.033183243));
    result += mul(conv2d_1_2_texOff(float2(-1, 0)), float4x4(-0.14704564, 0.27562207, 0.019860022, 0.028287191, 0.14170235, 0.18212168, -0.03879993, 0.6179209, -0.029668843, 0.07192611, -0.035148107, 0.030636815, 0.053909782, -0.09575066, -0.032652784, -0.019200137));
    result += mul(conv2d_1_2_texOff(float2(0, 0)), float4x4(0.8140166, -0.33012336, 0.24890704, 0.050513603, 0.2880904, -0.35702807, 0.3235871, 0.0799433, -0.040245235, 0.069440655, -0.0267066, -0.06736572, 0.07852883, -0.5296, 0.03480436, 0.0006398863));
    result += mul(conv2d_1_2_texOff(float2(1, 0)), float4x4(0.8719787, -0.06819611, -0.018990856, -0.0721697, -0.046735037, 0.003399876, -0.030062016, 0.07610814, 0.01898067, 0.035018347, -0.064313665, 0.006702074, 0.26719117, -0.43626022, -0.062359873, -0.045097504));
    result += mul(conv2d_1_2_texOff(float2(-1, 1)), float4x4(-0.108166456, 0.1632682, -0.048928294, 0.0352736, 0.07232684, 0.29997268, 0.2300139, 0.067888275, 0.040322863, 0.030843442, 0.05987516, 0.033828784, 0.14950477, -0.08285096, 0.08011602, 0.056967665));
    result += mul(conv2d_1_2_texOff(float2(0, 1)), float4x4(-0.42694804, -0.10358815, 0.07877955, 0.019714126, -0.21404517, -0.07253548, -0.08699267, -0.13583452, 0.19119735, -0.012615169, 0.08298881, -0.022804292, 0.012007984, -0.39893395, 0.18984659, 0.1259673));
    result += mul(conv2d_1_2_texOff(float2(1, 1)), float4x4(0.4382115, 0.014568933, -0.014228096, 0.015283748, 0.024885207, 0.0040985416, 0.052312836, -0.00840694, -0.08268298, 0.049490377, -0.018271057, -0.020799547, 0.61019176, -0.06575747, 0.15428685, 0.032139625));
    result += mul(conv2d_1_3_texOff(float2(-1, -1)), float4x4(-0.1103638, -0.24382193, -0.0021984496, 0.023088237, 0.003917495, 0.27951375, -0.024743905, 0.043511987, 0.01994665, 0.09042718, 0.08001624, 0.025604095, 0.1424135, -0.063713714, 0.05055283, 0.006594607));
    result += mul(conv2d_1_3_texOff(float2(0, -1)), float4x4(0.089594215, -0.26647395, 0.111056216, 0.11005409, 0.38198596, -0.48019555, -0.13853139, -0.18726984, -0.13978605, 0.36154184, 0.04966506, 0.01841499, 0.20530596, -0.109932445, -0.09282244, 0.033195525));
    result += mul(conv2d_1_3_texOff(float2(1, -1)), float4x4(-0.026680512, -0.035815246, 0.0145682, 0.028691273, -0.31977448, -0.22379017, -0.13368441, -0.0065354207, -0.18989044, 0.23734513, 0.009926452, 0.03997482, 0.11098721, -0.05701889, 0.05198063, 0.0008146918));
    result += mul(conv2d_1_3_texOff(float2(-1, 0)), float4x4(0.046974234, -0.6315373, 0.22552557, -0.5043373, 0.15039201, 0.21299054, 0.013669797, 0.0072580543, -0.2812821, 0.111724705, -0.043064557, -0.0013668948, -0.02739455, -0.0439339, 0.018383132, -0.05493821));
    result += mul(conv2d_1_3_texOff(float2(0, 0)), float4x4(-0.07456543, 0.47421628, 0.051593374, 0.04282623, -0.10432053, -0.12629968, 0.25613713, 0.11983452, -0.2887882, 0.045606792, 0.10627029, 0.12909806, -0.32911238, -0.03163113, 0.09387817, 0.5279224));
    result += mul(conv2d_1_3_texOff(float2(1, 0)), float4x4(0.17722927, 0.06328448, -0.008994296, -0.04602209, 0.05955998, 0.076387055, 0.030967932, 0.055060692, -0.268533, 0.17084622, 0.032699108, 0.037646223, -0.26747283, 0.022585792, -0.0052424474, -0.03718011));
    result += mul(conv2d_1_3_texOff(float2(-1, 1)), float4x4(-0.010180411, 0.35240108, -0.027932547, -0.0787834, 0.05416718, 0.3311954, -0.12372095, -0.087418094, -0.16849296, -0.074643396, 0.03130342, 0.065659545, -0.079385266, 0.0011491027, -0.007578512, 0.03224556));
    result += mul(conv2d_1_3_texOff(float2(0, 1)), float4x4(-0.4952282, 0.28173047, 0.013040495, -0.013693254, -0.06403208, 0.064919874, -0.14142747, -0.10408415, -0.1934128, -0.026647728, 0.11354118, 0.07091706, 0.15526253, 0.009439815, 0.02066057, 0.0020739087));
    result += mul(conv2d_1_3_texOff(float2(1, 1)), float4x4(-0.06444213, -0.050060943, -0.029164882, 0.0034186568, -0.014414396, -0.08906378, -0.03222982, -0.043057702, -0.20625849, 0.16155711, 0.031150155, 0.03191052, 0.34221584, 0.05589677, 0.031364746, 0.094496354));
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
