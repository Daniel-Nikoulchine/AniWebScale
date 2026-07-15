// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/acnet/acnet_f8b4.glsl:138
// Pass: 005 - ACNet F8B4 body block 2 conv 8x8x3x3 part 1
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
    float4 result = float4(-0.05020526, -1.1582175, -0.07638106, -0.0006479025);
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(0.16633984, 0.05717223, -0.11836475, 0.046364736, 0.0591829, 0.027307, 0.03956413, 0.12633294, -0.1422863, 0.06493061, -0.11138948, -0.48897573, 0.0022569888, -0.014464572, -0.21473221, -0.5655183));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.15631357, 0.017989432, -0.18314016, 0.21772784, 0.21278927, -0.1587776, -0.15375361, 0.5640433, -0.19274496, -0.011792536, 0.3301244, -0.57337606, -0.1424938, -0.051405434, -0.07557968, 0.96103877));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.08855351, 0.014175974, -0.057514098, 0.28028545, -0.04171451, -0.05405107, 0.03789758, -0.023156835, 0.13039385, 0.017016048, 0.082140796, -0.048221212, -0.34440163, 0.023233222, -0.0768487, 0.113442));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.2515888, -0.08349717, 0.17106842, 0.2801282, 0.0053558787, -0.009413144, -0.17496699, -0.11786408, 0.16500945, -0.017337985, 0.1901908, 0.26928464, 0.6846384, 0.06025313, 0.29637945, -0.045658942));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.037474312, -0.07849439, -0.3288739, 0.30434754, 0.4857669, -0.73441344, 0.43580428, 0.0900474, -0.9086705, 0.85407543, -0.49157286, -0.1256957, -0.1473401, -0.25473374, 0.35865572, -0.5820568));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.091815844, 0.00729978, -0.2244698, 0.08724766, 0.35114422, -0.01938095, 0.27073032, 0.083345614, 0.017449034, -0.13983856, -0.14460956, -0.09546616, -0.32750455, 0.17221135, -0.09996866, -0.11663251));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.07974194, -0.017898949, 0.038250398, 0.16936642, -0.08107825, 0.05104414, 0.098184735, 0.0035968767, -0.14220458, 0.003599278, 0.13270739, -0.1243071, -0.2348488, -0.07393327, 0.028951805, -0.10098629));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.20672877, -0.004780828, -0.37990484, 0.16800323, -0.060315598, -0.07583782, 0.19845875, -0.059591956, -0.06790848, -0.10971944, -0.18520871, -0.008850162, 0.39655823, -0.15088244, -0.5038702, 0.25376308));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.036152873, -0.06284327, -0.4242801, 0.12983988, 0.109030575, -0.076415956, -0.5287884, 0.032637488, 0.03392194, 0.06122783, 0.266541, 0.050991584, 0.10709297, 0.054370753, 0.26389036, 0.090258606));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.10302044, -0.058711316, -0.068967186, 0.17982684, -0.30321693, 0.20181277, 0.036476213, -0.6483456, -0.068471454, -0.2344827, 0.1053741, 0.09869385, -0.15295736, 0.10342213, -0.009062128, -0.1316282));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.07630821, 0.028040463, 0.26844007, -1.0754778, 0.27174637, 0.009804778, 0.026730172, -0.024938947, 0.0648255, -0.23006454, -0.091259815, -0.49854067, -0.23233238, 0.13186723, 0.06796049, -0.5857518));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.21334164, 0.03217046, -0.02748272, 0.4570745, 0.021426227, -0.02254591, 0.08489053, -0.019121453, -0.045403294, -0.035697408, 0.3114813, -0.2621155, 0.01944144, -0.053891383, 0.06189528, -0.14424254));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.011454312, -0.1294755, 0.33337936, 0.1290996, -0.33871987, 0.22948802, -0.34974188, -0.36712456, -0.26550663, -0.1727278, 0.014861059, -0.16316833, -0.28325891, 0.12043365, -0.10108857, 0.10634426));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.08782405, 0.53148127, -0.8702336, 0.17455447, -0.3794792, 0.2136333, -0.8587541, -0.10374235, -0.24136992, 0.6104258, 0.015144289, -0.18442862, -0.34290466, 0.35157865, -0.19879273, 0.13016534));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.38593426, -0.33064866, -0.21722178, -0.08937933, 0.1708132, -0.04426416, 0.20145442, -0.041430775, -0.1287298, 0.0033902705, 0.21482538, -0.23070821, -0.011873429, -0.072560936, -0.07981904, -0.0009895203));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.09031715, -0.06794916, -0.14994386, 0.005086917, -0.28079396, 0.2496197, -0.38671398, -0.17202227, -0.13719088, 0.005350217, 0.10722917, -0.03217125, 0.15877251, 0.06982884, 0.02631654, -0.0020294946));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 1.0)), float4x4(-0.029715251, 0.073638454, -0.1342857, -0.17847867, -0.25127393, 0.15698513, -0.50382334, -0.09740893, -0.24349694, 0.09920273, 0.19779803, -0.18246268, -0.19187136, -0.04152671, 0.3252848, -0.113907404));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.23071428, 0.11165673, 0.5023048, -0.03568506, 0.09909451, -0.010345433, 0.21824588, -0.048701458, 0.028428206, 0.040671796, 0.19194311, -0.09068155, 0.00078571006, 0.008949372, -0.25290912, -0.0075184056));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(-0.112629704, 0.5324241, -0.09347625, 0.11528285) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
