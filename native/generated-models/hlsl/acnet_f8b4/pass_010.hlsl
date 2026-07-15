// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/acnet/acnet_f8b4.glsl:296
// Pass: 010 - ACNet F8B4 upscale conv 8x4x3x3 part 0
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
    float luma = dot(value.rgb, float3(0.2126, 0.7152, 0.0722));
    return float4(luma, 0.0, 0.0, 1.0);
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

#define LUMA_tex(position) Anime4KSample2(position)
#define LUMA_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define LUMA_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define LUMA_pos anime4k_pos
#define LUMA_size float2(Anime4KInputSizes[2].xy)
#define LUMA_pt rcp(LUMA_size)
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
    float4 result = float4(0.011928495, 0.0031195497, -0.0050380905, -0.014174397);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.0016114438, -0.0028345857, -0.0009042394, -0.0008550692, -0.020195292, 0.0066837417, 0.0034315859, -0.00023945497, 0.0004760853, 0.0014346538, -0.0027810594, -0.0029806695, -0.007724656, 0.0035525335, 0.0026644252, 0.0054850467));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.005876448, 0.00043673717, -0.006358392, -0.006257198, 0.045857668, -0.008216994, 0.0239862, 0.020026121, -0.00800452, -0.003148947, 0.0010238945, 0.00059958594, 0.0026072126, -0.013510349, 0.0061329016, 0.0036934256));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.002965288, 0.0041134376, -0.0029410867, -0.0024210406, -0.008472412, 0.018395102, -0.006210143, -0.00021966576, 0.003814999, -0.0032519728, -0.0024810974, -0.0023012538, 0.0018051197, 0.0041341945, -0.00305649, -0.0046534217));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.0035671042, -0.0027723862, -0.00085519144, -0.005193217, 0.04194899, -0.011425361, -0.028831242, -0.005607351, -0.0022079034, 0.0021355276, -0.0024136063, 0.0006240144, -0.0002485178, 0.0026101908, -0.017396102, 0.0015915066));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.023027811, 0.024085918, 0.021093126, 0.018440118, -0.0039363736, 0.05543079, -0.0155828055, -0.07122683, -0.025142606, -0.023369884, 0.034261633, 0.013262796, 0.05623484, 0.0027809246, -0.015603839, -0.061501417));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(-0.008025872, 0.0023335745, -0.003487262, 0.007403613, -0.0090523185, -0.0076470054, -0.0058037145, 0.026083564, -0.0018855775, -0.008248479, -0.004357456, 0.012333942, -0.017717598, 0.027153173, -0.015532628, 0.008613675));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.003836462, -0.00089054473, -0.001228136, -0.0007933407, -0.012022515, -0.004747796, 0.0020819511, 0.003193084, 0.0011438592, 0.0009954909, 0.00081685104, 0.0012145771, 0.0089103645, -0.007466425, 0.019663135, -0.010357138));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.005056202, -0.008601156, 0.010710134, 0.002910528, -0.0033720734, -0.0002887245, -0.02770009, -0.0028663941, 0.009116788, 0.007135817, -0.009105983, -0.005416438, -0.027422082, -0.031459514, 0.045426846, 0.02705656));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.0041862503, -0.0016155908, -0.0057113227, 0.00426521, 0.0058008563, -0.0029963546, 0.00882462, -0.007952753, 0.0011868902, 0.0036738657, 0.0018665363, -0.0017534923, -0.016232735, 0.0007560091, -0.014193878, 0.02670287));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.002403039, 0.00067782035, -0.003594252, -0.00046695632, -0.00012219221, 0.0033037236, -0.0031111594, -0.0009133049, -0.054556683, -0.0056008254, 0.029727837, 0.019831419, -0.00058951566, 0.0020085238, 0.0009961828, 0.00029879189));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.0009198057, 0.0030681728, -0.0026248482, -0.0052759447, -0.0012977857, -0.0018783525, -0.0010594168, -0.00055127684, -0.07725605, -0.070521414, 0.04559174, 0.069426775, 0.005065117, -0.0051340577, -0.0017036599, 0.00063041074));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.00034254027, 0.00038311956, -0.0011186338, -0.000912879, 0.00015524472, -0.001480109, 0.0009910521, 0.00022637697, 0.017061146, -0.0477397, 0.030866053, 0.012079, -0.0015749073, -7.922365e-05, -0.0012723427, 0.00016086035));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.012284231, -0.00050923624, 0.010347281, 0.0025945124, 0.028554903, -0.037128948, 0.017031481, -0.012987191, -0.11229986, 0.09618573, -0.10723464, 0.092157, -0.002474963, 0.003088021, -0.005138211, 0.0038035421));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.006497977, -0.019323463, 0.009651334, 0.017022857, -0.0143942805, 0.01070585, -0.008023974, 0.003283149, 0.025747072, -0.05583777, 0.081565976, -0.0011376739, 0.011668826, -0.012959705, 0.017649645, -0.015318149));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.00030784437, 0.0003191495, -0.0004682685, -3.2954496e-05, 0.0017883879, 0.00037507145, 0.00027414178, -0.0010834761, 0.057894763, -0.06280008, 0.056613833, -0.062044468, -0.0008490305, 0.00068974006, -0.00048553586, 0.00020199295));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.003179439, 0.0011612942, 0.00023894095, -0.00020884803, 0.004296025, 0.000780976, 0.018889137, -0.019970952, 0.017112063, 0.044229977, -0.06453701, 0.019028487, 0.00073187216, -0.00018566952, 0.0015635147, 0.0005032161));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.0023727189, 0.003184493, -0.00080466724, -0.0011521396, -0.0034299209, -6.3366664e-05, -0.010475661, 0.005372005, 0.08403592, 0.09275328, -0.07353235, -0.070051365, -0.00035391017, 0.0017486376, 3.6917347e-05, -0.0018704167));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.00019868294, 0.0010097573, 0.00010825976, 0.00024980056, 0.0010377236, -0.0008441468, 0.0014077757, -0.001044919, 0.032681152, 0.00021071549, 0.020528518, -0.058853485, -0.00069228484, 0.0004466352, -0.0014093901, 0.00023118929));
    result = result + LUMA_texOff(float2(0.0, 0.0)).x;
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
