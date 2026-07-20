// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:361
// Pass: 012 - ARNet F8B8 body block 2 conv 1 8x8x3x3 part 0
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
    float4 result = float4(0.017884418, -0.29865953, 0.17804375, 0.1387471);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.015101957, 0.12829666, -0.028881906, -0.10521953, -0.0534982, -0.12659784, 0.07257463, 0.13365334, 0.076784834, -0.06673389, 0.36542284, 0.07814611, -0.08141693, -0.053293154, 0.059382197, 0.054647572));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.13640437, 0.01690318, 0.07670034, -0.04332516, -0.020514762, 0.0139271645, -0.07894773, 0.041833892, 0.1476598, 0.38791338, -0.24108802, -0.38031834, -0.102981314, -0.043672927, 0.2311386, 0.027180575));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.074566655, 0.042266905, 0.03396616, 0.046788834, -0.062482357, -0.08219475, 0.027660992, 0.04123222, 0.009570988, 0.099253915, -0.073815234, -0.1857935, 0.09972533, 0.024933234, -0.043176062, -0.07213356));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.08967565, -0.12253378, 0.15177259, 0.0017803862, -0.2661756, -0.054743383, -0.106047705, -0.04544776, 0.29849553, -0.019052217, 0.23569757, -0.067050315, 0.0024509863, 0.02262616, 0.25934726, 0.010745535));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(-0.14997578, -0.44091016, 0.23392603, 0.19995892, 0.4880391, 1.0113251, -0.9937072, -0.8436105, 0.034974724, 0.60393316, -0.25358185, -0.16086993, -0.043592274, 0.12140776, 0.6359511, -0.08966939));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(-0.14822859, 0.059737314, 0.083845176, -0.116032526, -0.031195663, -0.08206553, 0.1201052, -0.033617638, 0.12798664, 0.48338154, -0.40265822, -0.109884106, 0.07963478, -0.062398028, 0.23944645, 0.01148521));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.09467958, 0.14645195, 0.09025016, -0.12250942, -0.03834968, -0.056336667, -0.05190644, 0.06394522, 0.08083059, 0.09624429, 0.070653774, -0.039248195, 0.061639242, -0.03726082, 0.3051748, -0.0209609));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.43193993, -0.017094454, 0.16513836, 0.0050838566, -0.30049786, -0.06503255, 0.019879967, 0.004156202, 0.07159797, 0.051923003, -0.061807625, -0.18353282, 0.06200324, -0.047140755, 0.3952102, -0.09043715));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.2935689, -0.14938903, 0.61016524, -0.20097886, -0.18463963, -0.27237672, -0.2224313, 0.16097146, -0.066685624, 0.019976623, -0.026270505, 0.012173218, -0.06638039, 0.04148764, -0.0992501, 0.081065804));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.016499925, 0.05161416, -0.29550898, 0.100969836, -0.16817413, 0.1746131, -0.19398102, -0.09938062, -0.28321162, -0.15832649, 0.21918936, 0.11404262, -0.04296853, -0.17781836, 0.15467548, 0.05088066));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.64363176, 0.5629237, -0.5844953, -0.49221212, -0.27021554, 0.21442921, 0.24972557, -0.23247926, 0.043004, 0.15985382, -0.07401796, -0.2951739, 0.0075255376, 0.40173534, -0.18116806, -0.23186052));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.105595365, 0.20662196, 0.03573369, 0.04757723, 0.05970978, -0.038666025, 0.0037163058, 0.0099473875, 0.1721186, 0.15420766, 0.17405976, -0.3178233, -0.13297509, -0.15693927, 0.32435822, 0.04618536));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.0651415, -0.07811472, -0.021843228, 0.075978026, -0.012688828, -0.21010345, 0.13093281, -0.043419268, -0.32906592, -0.092696555, -0.07750749, 0.1052789, -0.031102927, -0.025654627, 0.233475, -0.055838533));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.15804525, -0.22604428, 0.02778913, 0.4114819, 0.49065962, 0.8842758, -0.41494554, -0.69981176, 0.34000492, 0.42193463, -1.2716815, 0.28237316, -0.31202126, 0.20770527, 0.44611797, 0.23936306));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.21576998, -0.22399957, 0.06630081, 0.0642155, -0.4221119, 0.30226624, -0.12553774, -0.040097542, 0.60759723, 0.14742716, -0.012060107, -0.40173885, 0.4546816, -0.13415124, -0.54602927, 0.17488053));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(-0.07697807, -0.014088572, 0.07434141, -0.061830696, -0.12698904, -0.10457307, 0.015925888, 0.018053124, -0.30721694, -0.02392493, 0.07369255, -0.011833083, -0.032490693, -0.0848233, 0.0035685524, -0.008947351));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.31752002, -0.1228933, 0.09477111, -0.038536392, -0.06902, 0.043036375, 0.20074369, -0.07155098, -0.24948153, -0.15039364, -0.087244086, 0.12802128, 0.4354954, 0.11768047, -0.015730536, -0.0011955136));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(0.0018089173, -0.07825657, 0.08763735, -0.11645953, -0.21040155, -0.05146961, -0.044540938, 0.049424842, -0.141446, -0.14539622, -0.016136749, 0.22237624, 0.0845475, -0.14570649, -0.3252187, 0.029580412));
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
