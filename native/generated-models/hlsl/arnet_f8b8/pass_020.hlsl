// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:617
// Pass: 020 - ARNet F8B8 body block 4 conv 1 8x8x3x3 part 0
// ACNetGLSL is Copyright (c) 2020 TianZer, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[3];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
Texture2D<float4> Anime4KInput2 : register(t2);
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

#define TMP1_TEX_0_tex(position) Anime4KSample0(position)
#define TMP1_TEX_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define TMP1_TEX_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define TMP1_TEX_0_pos anime4k_pos
#define TMP1_TEX_0_size float2(Anime4KInputSizes[0].xy)
#define TMP1_TEX_0_pt rcp(TMP1_TEX_0_size)
#define TMP1_TEX_1_tex(position) Anime4KSample1(position)
#define TMP1_TEX_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define TMP1_TEX_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define TMP1_TEX_1_pos anime4k_pos
#define TMP1_TEX_1_size float2(Anime4KInputSizes[1].xy)
#define TMP1_TEX_1_pt rcp(TMP1_TEX_1_size)
#define TMP2_TEX_0_tex(position) Anime4KSample2(position)
#define TMP2_TEX_0_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define TMP2_TEX_0_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define TMP2_TEX_0_pos anime4k_pos
#define TMP2_TEX_0_size float2(Anime4KInputSizes[2].xy)
#define TMP2_TEX_0_pt rcp(TMP2_TEX_0_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.22588535, 0.2106261, 0.107398205, -0.01651731);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.026616834, 0.112033404, -0.10442405, -0.0023195962, 0.057753704, -0.04788018, 0.096623614, 0.023642898, -0.117363356, -0.050215416, -0.4132518, 0.043530762, 0.2966669, -0.4559587, 0.170962, 0.22340502));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.11644219, 0.17614616, -0.12997885, -0.16325638, 0.16058327, 0.16297805, -0.039824236, -0.220129, -0.102991775, -0.0003881514, 0.03746242, -0.01434009, -0.7941146, 0.24159563, 0.026141692, -0.18691897));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.052842952, -0.020740967, -0.1239301, 0.02945336, -0.091157265, 0.1758473, 0.16126478, -0.098804325, 0.20392853, -0.09355968, 0.11974967, 0.03145618, 0.13420767, -0.015600017, -0.078410886, 0.09148394));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.0346368, 0.093074754, -0.43774572, 0.05714876, -0.21123874, 0.16303736, -0.5248522, 0.14942692, 0.4519324, -0.086801246, 0.45659178, -0.2883424, -0.26606593, -0.15483233, -0.41695175, 0.4349879));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.4735342, -0.08438174, 0.15577279, -0.3001733, 0.24621914, 0.7316966, -0.007578362, -0.43175906, -0.22133729, 0.064591475, 0.025695466, 0.19649024, 0.6431615, -0.40568247, 0.5226402, -0.21258865));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.17001872, -0.12337007, 0.013480832, 0.115311876, -0.12155968, 0.09056224, 0.088815756, -0.12612578, -0.35984516, 0.30255875, -0.09774521, -0.113401726, -0.14985313, 0.22418244, 0.045455087, 0.013816767));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.09223296, -0.068718396, -0.13141951, -0.013841327, 0.16931812, 0.009568606, 0.014277201, -0.06342365, -0.12076457, 0.08648582, 0.2416845, -0.059856266, 0.10592157, -0.21222997, -0.113651834, 0.08533222));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.11953067, -0.02398847, 0.10305074, 0.06366774, 0.3058273, 0.009317377, 0.12993795, -0.0397205, -0.30339855, 0.30155206, -0.4163824, 0.11640258, -0.02669077, -0.15575571, -0.023342084, 0.12760434));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.18103161, 0.25277737, -0.020213649, -0.045894243, 0.09468953, -0.21692051, 0.10471962, 0.10570503, 0.33629653, -0.21759859, -0.03278656, 0.010188825, 0.09684174, -0.010518816, 0.084564745, -0.028149607));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.056083485, -0.2428174, -0.2164204, 0.16811201, 0.20456654, 0.31551626, -0.12877855, -0.1563259, 0.027080456, 0.18019116, 0.29381743, -0.14091267, 0.18310873, -0.17325407, 0.06556508, 0.14828));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.018852813, -0.21252698, -0.2878518, 0.19746917, 0.4418184, 0.00394026, -0.07694481, 0.1390723, 0.12138032, 0.07529076, 0.18464689, -0.059977, 0.33650807, -0.15986748, 0.11997153, 0.028402863));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.0632579, -0.25212008, -0.20762818, 0.15350752, 0.08579721, 0.00060945883, -0.003958609, 0.029055078, -0.06649143, 0.18520649, 0.08906204, -0.090294026, 0.03867604, -0.16307335, -0.08248888, 0.14928591));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.1229781, -0.34509143, -0.3096344, 0.22913292, 0.10501678, 0.10533458, 0.061769135, -0.009929219, -0.04237179, 0.3416895, 0.22671439, -0.20944521, 0.07259468, -0.10545342, -0.4331647, 0.097758316));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.07187659, -0.39013845, -0.17285593, 0.17764373, -0.07146137, 0.6305249, -0.24816155, -0.09387229, -0.2844018, 0.43615958, 0.18402319, -0.17090674, 0.015981732, 0.17036024, 0.05870805, -0.17915192));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(0.11891476, -0.3989516, -0.30853528, 0.26721904, 0.0054172594, -0.04958407, -0.011111242, -0.03866317, -0.0018654185, 0.22356969, 0.028425384, -0.11543896, -0.20366247, -0.16380844, -0.11176576, 0.25335783));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.066441536, -0.23065607, -0.20668043, 0.16343959, -0.03352906, 0.013421082, 0.12002797, -0.03736594, -0.08028133, 0.17825381, 0.1626494, -0.08801711, 0.13968028, -0.09512857, -0.38870072, 0.07852274));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.056400213, -0.319552, -0.27285287, 0.2521859, -0.18266907, 0.036817957, 0.07968262, 0.020176345, -0.024786621, 0.17070419, 0.16887428, -0.13783292, 0.6571534, -0.33819076, 0.051601674, -0.05810142));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(0.01374822, -0.16175212, -0.24945115, 0.14187998, 0.060687955, 0.05905528, -0.045109566, -0.06894228, -0.122729085, 0.123786815, 0.14074925, -0.09113857, -0.20944078, -0.1393582, -0.26946786, 0.22944163));
    result = result * 0.2 + TMP2_TEX_0_texOff(float2(0.0, 0.0));
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
