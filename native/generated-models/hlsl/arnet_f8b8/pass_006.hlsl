// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:170
// Pass: 006 - ARNet F8B8 body block 1 conv 0 8x8x3x3 part 0
// ACNetGLSL is Copyright (c) 2020 TianZer, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[2];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
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

#define TMP2_TEX_0_tex(position) Anime4KSample0(position)
#define TMP2_TEX_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define TMP2_TEX_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define TMP2_TEX_0_pos anime4k_pos
#define TMP2_TEX_0_size float2(Anime4KInputSizes[0].xy)
#define TMP2_TEX_0_pt rcp(TMP2_TEX_0_size)
#define TMP2_TEX_1_tex(position) Anime4KSample1(position)
#define TMP2_TEX_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define TMP2_TEX_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define TMP2_TEX_1_pos anime4k_pos
#define TMP2_TEX_1_size float2(Anime4KInputSizes[1].xy)
#define TMP2_TEX_1_pt rcp(TMP2_TEX_1_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.00038487464, 0.22289917, -0.24205458, -0.7393991);
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(0.079595, -0.072221816, -0.35647908, -0.2301703, 0.06176246, -0.14455058, -0.08948057, 0.56931967, 0.198432, -0.10898535, 0.8626691, 0.52023363, -0.12665005, 0.40795404, -0.050346937, -0.09072231));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.10506086, 0.7636231, -0.22834866, 0.49472347, 0.17960273, -0.32881877, -0.9062304, -0.020833962, 0.14564328, -0.70809287, 0.11959976, 0.44316298, 0.100006916, -0.160334, 0.062292762, 0.09580864));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.21114813, 0.063998915, -0.92518413, 0.26029027, 0.475189, -0.6984959, -1.3103569, -0.22886541, -0.15098882, 0.05465921, -0.67516613, 0.34351072, -0.1044165, -0.0064997473, 1.4302009, -0.077394105));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.29856583, -0.5856132, -0.38689885, -1.5811694, 0.25498778, -0.17752798, 0.27298516, -0.3070751, -0.0012963361, 0.04947867, 0.10178945, -0.5257957, -0.23744375, -0.18801929, -0.2133248, 0.92215854));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.16815418, -0.55170053, -0.43439835, -1.0541005, 0.5115375, 1.8765259, -1.1616529, -0.85240924, 0.4045305, -0.28206152, 2.2580512, 1.0200067, 1.255712, -0.32355347, -0.12318544, 2.5331693));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 0.0)), float4x4(-0.04644488, -0.048580106, 2.9278488, -0.7597395, -0.19183113, 1.06264, 1.6380677, 1.1502597, 0.07953322, -0.119801864, -0.64133, 0.07482089, -0.5890907, 0.120104976, 0.7331321, 0.32018724));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.12185736, 0.05216147, -0.01949169, -0.07030008, 0.03083988, 0.04068892, 0.04654343, 0.13414082, -0.042440183, 0.21486619, 0.17105371, 0.107877806, -0.18805818, 0.01438958, -0.23291768, 0.010626702));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.14458561, 0.19486032, -0.37794787, -0.18569823, 0.025553938, -0.3462355, 0.37009057, 1.2681297, 0.056309734, 0.2603048, 0.061158307, 0.2555877, 0.01909699, -0.10338126, -0.6605213, -1.2820153));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.23639685, 0.21033947, -1.1744219, 2.5378675, 0.19754757, -0.2805583, 1.5099549, -0.15814507, -0.2349047, 0.20147975, -1.2724568, -0.88208973, 0.05563206, 0.19731772, -0.86400473, -1.4671204));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.12767181, 0.054644585, 0.7837455, 1.052061, -0.03973315, 0.032588683, 0.50537544, 0.5040112, 0.18358651, 0.028247213, -0.2659854, -0.49623677, -0.13420582, -0.28997326, -0.27921495, -0.5233815));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.35030684, -1.3212582, -0.36011735, 0.6666522, 0.22163393, 0.21354157, 0.92921007, 0.2058778, -0.34252134, 0.13899507, 0.67753553, 0.2034365, -0.38438943, -0.6745047, 0.35356548, -0.14309976));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.3071377, -0.1751041, 0.30333388, 0.49432516, 0.10485242, -0.15085612, -0.5767535, -0.04496254, 0.076031506, 0.37884068, 0.9066801, -0.2206321, 0.14266364, 0.4538568, -0.44765207, 0.16232458));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.12616123, -0.13890168, 0.48120567, 1.0032076, -0.0119340075, -0.24187675, 0.3131692, 0.67657006, 0.34713614, 0.21538304, -0.32859647, -0.14978793, -0.18002398, 0.13194269, 0.09995041, -0.18110177));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.26602498, -1.0846565, -0.16352858, 1.2645875, -0.13010885, -1.4845848, 1.2378219, 1.5322431, -0.4513593, 1.283005, 0.6483647, 0.3252648, -0.9810522, -0.35182154, 1.4047176, 0.025162406));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.087344274, -0.938755, -0.17996533, -0.41808113, 0.54645944, 0.50191987, 0.66761845, 1.3524542, 0.036185835, -0.60971296, 0.37338006, -0.048290726, -1.0398685, 0.32543254, -0.44080034, -1.0164006));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(-0.11354234, 0.032057423, -0.24027163, -1.2380258, -0.2646276, -0.17069, -0.56319255, -1.1471152, 0.047471073, -0.055439286, -0.6111167, 0.27032897, 0.31875116, 0.1631278, 0.502383, 0.44017565));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.0628885, -0.29599458, -0.57189155, -0.91751283, 0.10449983, -0.050438773, -0.26163867, 1.4092892, 0.18175443, 0.28675595, 1.4069109, 0.76971143, -0.444638, 0.69597614, -0.30769047, 1.9857801));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.17940557, 0.0687519, -0.6679298, 0.7158229, -0.2330659, 0.11822837, -1.3577425, 0.63315314, 0.2938261, -0.13105659, 0.5617285, -0.45224702, 0.06454056, 0.44390756, 0.5851278, 0.42677906));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(-0.5464316, -0.51805747, -0.005175609, -0.04312664) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
