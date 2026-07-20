// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/acnet/acnet_f8b4.glsl:75
// Pass: 003 - ACNet F8B4 body block 1 conv 8x8x3x3 part 1
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

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-2.3568091, 0.43381542, 0.49548137, 0.5353628);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(0.02880606, -0.33266336, -0.15593272, -0.021990707, 0.133672, 0.16154183, 0.009382372, -0.067700304, 1.6200647, 1.2165145, -0.64885324, 0.96285224, -0.10905823, 0.1327156, 0.13431858, 0.040175695));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.44318345, 0.054354925, -0.32325003, 0.08809195, 0.062490925, 0.24906553, 0.002449654, -0.101885915, 1.9597172, 3.8334837, 1.561424, 0.43678355, -0.15202327, -0.045643147, 0.19950682, -0.28957513));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.13988888, 0.07113791, -0.077144064, -0.023358485, 0.008248317, 0.45007586, 0.020097475, -0.13832355, -0.82969886, -2.4495318, -0.100378126, -0.18392184, -0.1460935, 0.42956552, 0.11723229, 0.1913966));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.25403124, -0.1460852, -0.05090258, -0.1855181, 0.083035186, 0.1667262, 0.03925975, -0.10169448, -1.1282359, -0.24911757, 2.1076384, 0.29264674, -0.44855097, 0.04568492, 0.16905037, 0.013240478));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(-0.14287215, -0.015416484, 0.26624313, -0.28838944, 0.039238043, 0.31547913, 0.051033553, 0.065362014, 0.47532624, -1.3176105, 0.63812405, -0.45624343, 0.5320605, 0.020465126, -1.0272348, 0.11076402));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(-0.20960627, 1.2705208, -0.073293135, 0.10180206, -0.07279409, 1.0146424, 0.00039183826, -0.07551779, -3.051622, -1.2971576, -0.2157642, 1.0592185, -0.5570998, 0.7591725, 0.24133979, 0.10405595));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.016475188, -0.10389128, -0.045102805, -0.21283667, 0.086769834, 0.14633611, 0.029902598, -0.026535464, 1.3359039, 0.6794338, -1.1065117, -1.1857682, -0.0262453, 0.14773387, -0.07362297, 0.08253219));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.19703136, -0.08129555, 0.00612883, -0.13155839, -0.09762403, 0.19777657, 0.023724616, -0.0060285022, -1.9044738, -2.0711207, -1.8569505, -0.7044529, 0.04191373, 0.0025775111, -0.06847528, -0.15090713));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.1513109, -0.42793462, 0.056488574, -0.19668925, -0.09060343, 0.4508355, -0.09960839, -0.13389449, -0.28726113, 1.3418032, -0.44182643, 0.4286944, -0.20000015, 0.3222547, -0.023677457, -0.0068828575));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.026506888, -0.02047571, 0.08823691, 0.03388047, 0.032046985, -0.7300579, -0.49753186, -0.6453377, -0.09071477, 0.09845949, -0.0034623938, 0.09971792, -0.0651284, 0.07118523, 0.009864328, -0.045413777));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.09134515, -0.27455437, 0.012592044, 0.025086528, -1.5540599, -4.55786, 0.43407673, -0.22804025, 0.4471208, -0.33082542, -0.29546905, 0.35995618, -0.13199882, 0.19123936, 0.050322168, -0.01212867));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.015630748, -0.41512403, -0.038072415, 0.015423556, 0.49196872, 1.8726923, 0.033235487, 0.14401653, -0.14677219, 0.8298471, 0.018148355, 0.37465996, -0.07211964, -0.22107123, 0.019199027, -0.016349657));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.5480665, -0.075538486, 0.017643614, 0.3187712, -1.8206801, 0.8075778, 0.12408098, 1.1314732, -0.46709034, 0.09503434, 0.06104053, -0.15366137, 0.18321005, 0.10398222, 0.08351689, 0.06384923));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.07845056, -1.1639163, 0.14884362, 0.37566113, 1.8420838, 4.4936533, -1.6131977, -2.0116246, -0.44022283, -0.57758605, 0.224944, -0.9266605, -0.18905362, -0.07532815, 0.075325295, 0.5469685));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.005742835, -1.282058, 0.01601524, -0.028699407, -1.1339638, -1.8955053, 0.80373603, 0.9396256, 0.14545488, 1.8757904, 0.12805878, -0.11824196, -0.08275617, -2.0075154, -0.019883433, 0.03202007));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(-0.013767798, 0.013271147, -0.033852004, 0.089542, -1.2163583, -0.75468177, 2.0323606, 2.3466346, -0.09262058, 0.07655918, -0.10502673, -0.019869165, 0.13637547, 0.0520504, 0.046893116, 0.16840647));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.013572647, -0.032237057, -0.16061053, 0.17574984, -0.013780138, 1.4594834, -0.058878686, -0.03573398, 0.13578424, 0.11996734, 0.30786142, -0.13662794, -0.09892039, 0.08360084, 0.07998592, 0.44835111));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.061134864, 0.08785971, -0.010665554, -0.0022353858, -0.2782641, 0.34670687, -0.38483208, -0.5934164, -0.16826874, -0.017518172, 0.04902709, -0.04717521, -0.045536608, -0.84451336, -0.15751818, 0.044853784));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(0.59943956, 0.019894166, -0.4225936, -1.4542307) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
