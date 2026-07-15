// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:233
// Pass: 008 - ARNet F8B8 body block 1 conv 1 8x8x3x3 part 0
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
    float4 result = float4(-0.11743038, -0.16231002, 0.09467287, 0.22727534);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.51548827, 0.15808548, -0.13571733, -0.14273223, -0.15057826, 0.030074593, 0.068493836, -0.12844294, 0.18713784, -0.016000101, -0.09715594, 0.0055838507, -0.16399951, 0.16539454, -0.13824981, -0.10167678));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.13697715, 0.26219594, -0.21650817, -0.2165934, -0.015406543, 0.13315487, -0.0058171605, -0.12718087, 0.27039266, 0.1725975, -0.06647851, -0.08497834, 0.014193257, -0.25275543, -0.13867815, 0.11157574));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.17512031, -0.031932354, 0.09907872, 0.012270169, -0.08726568, -0.023330402, -0.06266416, 0.057744034, 0.06678231, -0.0047940016, -0.043570846, 0.07146166, -0.0736774, 0.037179712, 0.016628314, 0.0010944232));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.009598625, -0.5314439, 0.44985726, 0.0022008943, 0.06517828, -0.10094927, 0.32011816, 0.23916851, 0.14076614, 0.21300304, -0.010937648, -0.080391854, -0.16850063, 0.10303366, -0.045720827, -0.040261723));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.5002904, -0.21563224, 0.02404452, -0.20911911, -0.19017076, -0.1477176, -0.46054003, 0.46265918, 0.43199173, 0.5974608, -0.34539118, -0.3312841, -0.5938919, -0.15260786, -0.108566456, 0.20635751));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.11939628, -0.15311272, 0.09272302, 0.06710506, -0.228897, -0.00641993, -0.03652953, -0.042495403, 0.080015264, -0.09927188, -0.09529955, 0.10129391, -0.009078054, -0.020145357, -0.07288933, 0.0039098705));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.23070931, 0.018655553, -0.39131016, 0.030764543, 0.2004993, -0.12783334, -0.050624203, -0.041625377, 0.55393255, 0.4023199, -0.30161053, -0.12797196, -0.039660085, -0.098703876, -0.13656409, 0.112380184));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.07816313, 0.10847156, -0.007891233, -0.24849588, 0.08360888, 0.019200271, -0.36332434, -0.099814415, 0.43942454, 0.3943624, -0.21466185, -0.18517245, 0.09900762, -0.037406493, -0.18656285, 0.14789587));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.065378375, 0.07550733, -0.04080613, -0.079689436, -0.19499788, -0.24939217, 0.01950661, 0.11034688, 0.06214707, 0.031414058, -0.13365307, 0.032257605, 0.0112530645, 0.00730777, -0.08202546, 0.017572647));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.14070207, -0.01666193, 0.034629535, 0.047863863, -0.1215331, 0.1534163, 0.10311375, -0.11320891, 0.41778356, -0.08176557, 0.07304786, -0.053896323, 0.23764133, -0.0688709, -0.029590486, 0.076902606));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.068145, 0.42785034, -0.09306724, -0.275845, -0.18359652, 0.47085622, -0.11451097, -0.24949631, 0.17780478, 0.14360733, -0.0016823296, -0.08480175, -0.40213397, 0.10999707, 0.025154676, -0.1435435));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.24552824, 0.2330777, 0.009393284, -0.13848, -0.06737535, 0.027632507, -0.12971726, -0.06911854, 0.35154542, -0.13226014, 0.07761524, -0.054549973, 0.27885428, 0.08148365, -0.095757246, -0.021533212));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.09454266, 0.2140318, -0.016976485, -0.057624552, -0.09839205, 0.15363936, 0.043497685, -0.064059295, 0.2378484, 0.17965513, -0.49250692, 0.06263317, 0.18567434, 0.029376287, -0.047457956, 0.06774827));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.6005944, 0.7316118, -0.27836758, -0.19813935, 0.81357217, 0.27930802, -0.23901676, -0.24747422, -0.8693642, 0.37762254, 0.016820326, -0.04367687, -0.14583929, 0.94253695, 0.5433254, 0.5274216));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(0.34054813, 0.25838697, 0.118261084, -0.251229, 0.028324736, 0.19048929, -0.16192491, -0.12896627, -0.100976825, 0.22019616, 0.039321687, -0.21112084, 0.10459288, -0.11201688, 0.12801947, -0.24373414));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.1336266, 0.211002, 0.03210656, -0.09421905, -0.15140519, -0.07119925, 0.21009757, -0.08140687, -0.050216563, -0.012460943, 0.18304639, -0.07330297, -0.0098418, -0.1551483, 0.19184987, 0.026986087));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(-0.022919213, 0.19337773, -0.45702758, 0.031346735, -0.15381978, 0.04094078, -0.1875338, -0.04040901, -0.05630891, 0.09842354, 0.15147696, 0.100789934, 0.06923394, 0.11349254, 0.106697135, -0.09372512));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(0.018661436, -0.10977688, -0.20715022, -0.0022962943, -0.054421525, -0.13888687, -0.0332814, 0.00016125318, 0.01978585, -0.090099916, 0.039801233, 0.010582678, 0.043903127, 0.14129712, 0.01645732, -0.06156448));
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
