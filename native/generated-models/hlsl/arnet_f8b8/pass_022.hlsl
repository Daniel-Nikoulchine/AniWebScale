// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:682
// Pass: 022 - ARNet F8B8 body block 5 conv 0 8x8x3x3 part 0
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
    float4 result = float4(0.3003047, 1.2149348, 2.1330109, 0.650234);
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.6504209, 0.21959358, 0.33144096, 0.0007876073, 0.6744014, 0.19262253, 0.21760157, 0.10900841, 0.35144132, -0.23957808, 0.17531364, -0.053638194, -0.75731075, -0.015422798, 0.3761242, 0.17248693));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.024629252, -0.67511886, 0.7375245, -0.10241917, 1.0451926, -0.43732005, 1.737262, 0.3688665, 1.3264652, -0.52658963, 2.425491, -0.14533964, -0.5173716, -0.9537683, 1.3603363, 0.34533927));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.0048794434, 0.20017867, 0.07479699, -0.03945914, 0.11122023, 0.5365183, 1.0936624, 0.10497835, -0.20786048, 0.003894534, 0.8386719, 0.052218586, -1.9494079, 0.24611126, 0.016861279, 0.005979933));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.078692794, 0.8397448, 0.16719641, -0.6388416, -0.2930159, 0.4295858, -2.0860298, -1.1938078, 0.13927062, 1.2374425, -1.5475991, -0.6495977, 0.23591286, 0.8239687, -2.5448008, -0.9997149));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(1.4533956, 1.4132571, -1.0252517, 0.86183393, -1.0521919, 2.4850464, -1.1908768, 0.6323978, -0.915058, 2.6813903, 4.3254924, 2.1342337, 0.5627941, 4.2229624, 4.013137, 2.9100611));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 0.0)), float4x4(-0.39155403, -0.06790528, -0.69554317, -0.006158968, 0.17130081, 0.07925331, 1.8902389, 0.52878493, 0.39606464, 0.82269776, 0.75501543, 0.10022816, 0.96482337, 0.75758, 2.1174295, -0.114814684));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.4818834, -0.29402885, -0.22761391, -0.2670365, 1.0361975, -0.82270545, 0.092300706, -1.1219316, 0.24687955, -0.2126321, -0.2640898, -0.6169071, -0.6711708, -0.7871989, -0.7630374, -1.2573526));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.668454, -0.6806062, -0.29112068, -0.35090935, 1.5659667, -4.158391, -3.087243, -0.80937433, 1.2032171, -0.9238056, -1.7783984, 0.2600142, 0.5799701, -2.8852782, -3.2734113, 0.38502717));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.33901578, -0.21724616, -0.6469161, 0.12646027, 0.48798242, -0.6862837, -0.13620105, 0.39523253, 0.22647385, -0.36997092, 0.15187208, 0.3274326, -1.2308252, -0.92674994, 0.29510847, -0.0031329067));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.3157064, -0.25788748, -0.54112244, -0.20568763, 0.8595366, 0.082141384, 0.095521286, 0.38791156, -1.1054889, -0.11231441, 0.072697744, 0.03388429, -0.35879493, 0.21295959, 0.11608134, 0.13581812));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.16834551, -0.030081544, -0.22464679, -0.33015564, 0.22134371, 0.17475425, -1.3617679, -0.068389274, -0.42979816, 0.07671764, 0.1764837, 0.0387593, 0.28774008, 0.69624823, -0.59874684, -0.024482107));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.27981806, 0.080950096, 0.2220941, 0.16048254, 1.1930861, -0.12580878, -0.5881406, -0.069512896, -0.7038548, -0.086286075, 0.15952958, -0.21329924, 0.44961348, -0.050952386, -0.8099738, 0.03416968));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.1916137, 0.4895661, 0.5747351, 0.21729009, -0.46594617, -0.16432008, 1.1343844, 0.09283182, 0.048095793, -0.2222763, 0.47930622, -0.0074936766, -1.334995, -0.40219447, -0.5759289, -0.782165));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.77060014, 1.3138825, 1.5764701, 0.078517616, -1.6458701, -2.4526174, -0.6678774, -0.6836711, 1.2960256, -0.15864502, -0.62444794, 0.15509559, 1.1489275, -0.39646634, 1.7202374, 1.3175043));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 0.0)), float4x4(0.35442168, 0.43594247, 0.89692116, 0.33670527, -0.0050855624, -0.4245696, -0.36787403, -0.36490065, -0.1362521, -0.16798729, 0.33684343, -0.15758033, -0.42178002, -0.203662, -0.62128603, -0.20626883));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.09054313, 0.4039167, -0.73968637, -0.12359745, 0.79915583, 0.19018045, 0.26556307, 0.4089975, -0.8792946, -0.36993086, -0.08856557, -0.23491934, 0.43970856, -0.3242256, 0.21937835, -0.024264053));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 1.0)), float4x4(-0.2565005, 0.6255889, -1.1943111, -1.0678533, 0.57915235, 1.6906465, 1.1278228, 0.48769957, -0.597096, -0.76620686, 0.3020023, -0.12345492, -0.6109053, -0.7379007, -0.6871667, -0.39041224));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.39258847, 0.055504996, -0.6591748, 0.07375341, 0.85527813, 0.33633626, 0.154304, -0.13445146, -1.0370651, -0.13380796, 0.004561991, 0.16683802, -0.16511704, -0.2416219, 0.6673402, -0.032510035));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(0.37255687, -0.12340255, -0.12307705, -0.39734614) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
