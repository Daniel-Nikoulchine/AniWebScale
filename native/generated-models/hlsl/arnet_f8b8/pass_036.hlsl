// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:1101
// Pass: 036 - ARNet F8B8 upscale conv 8x4x3x3 part 0
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
    float4 result = float4(-0.0006897712, -0.0018070455, 0.003351875, 0.0022118888);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(0.006055811, -0.0034455648, 0.0027926385, 0.0020053068, 0.00020647165, -0.0012042555, 0.0043767425, 0.005852311, 0.051309578, 0.00097389176, -0.010579665, -0.049913835, -0.0009979714, -0.00081646687, -0.0013344521, 0.00026184626));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.0056625395, 0.026595788, -0.00933348, -0.003203842, 0.0038511402, 0.007942461, -0.0036211757, 0.009367644, 0.031499673, 0.0032136086, -0.014081678, -0.040611062, 0.0018414534, 0.0026685752, -0.0010536611, -0.0009878428));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.0013875791, -0.0031768966, 0.0015071898, 4.928345e-05, -0.0001631576, 0.0062178536, 0.0002483617, 0.0002673925, -0.00012613292, 0.042973112, -0.027108151, -0.000615998, -0.00017030716, -0.00083775196, 0.00070417306, -9.9478006e-05));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.0010297825, 0.002884589, 0.011196949, -0.001200625, 0.019806368, 0.0006056932, 0.011556853, 0.0022994527, 0.004692583, -0.029212572, 0.004625587, -0.021334292, 0.0032457819, -0.0025340237, 0.003106848, -0.0017851163));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(-0.047209747, -0.034134466, 0.011575794, 0.03027787, 0.0003609109, -0.023971003, -0.03558695, -0.06388531, -0.047077764, 0.036879234, -0.009320786, 0.045941267, 0.015450581, 0.020148166, 0.012749893, 0.014156164));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.00707837, -0.0077584875, 0.0016918597, 0.0012515753, -0.0029076207, 0.0011319091, -0.0028622749, 0.0033099712, -0.029329974, 0.012119113, -0.028981568, 0.0155550605, -8.931688e-05, 0.0030491664, -0.00091298146, 0.0018214871));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.0014239539, 0.0032520173, -0.0011908994, 0.0032081383, 0.0025891413, 0.0019768844, -2.2482733e-05, -0.0025570325, 0.0020297882, -0.024223039, 0.058799084, 0.00063697575, -0.0005293582, -0.0005274841, -0.0010712694, -0.0013190154));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.005231636, 0.0044924864, -0.019384932, -0.0070362757, -0.010399723, -0.00577747, 0.017259182, 0.008979459, -0.008820794, -0.042213127, 0.015335869, 0.022052955, -0.0020836547, -0.0019850533, 0.003232851, 0.0038128619));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.0022573173, 0.00306954, 0.0038297547, -0.006025754, -0.0032473064, 0.0034350788, -0.0033544102, 0.0056917686, -0.024587862, -0.007768114, -0.009730098, 0.02058711, -0.00019250107, -0.00042111045, -0.00019249516, 0.0003537509));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.0039224196, -0.0010026589, 0.00048942247, 0.0013069795, -0.004474108, 0.0062523168, 0.0012332181, -0.0043890886, -0.0009643572, 0.0012649556, -0.00072392635, 0.00050752086, 0.001785765, -8.372706e-05, -0.00033695588, -0.0005113323));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.012308371, 0.0016555436, -0.005530331, 0.0022744404, -0.01942655, -0.03240503, 0.018987607, 0.010967475, -0.0027156586, -0.004046325, -0.0011175153, -0.00082622084, -0.0020875349, 0.0021688081, 0.0007486364, 3.0039671e-05));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.0001276024, 0.002958646, 0.0012813678, -0.00040406012, 0.0031994141, -0.024262946, 0.012311202, 0.0021437085, 0.0009158487, -0.00014883782, -4.3010605e-05, -0.0018080295, -0.00012166114, -0.0016663583, 0.0010381689, 0.00016240591));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.00078046956, 0.00087784324, -0.005713524, 0.0051137484, -0.023398891, 0.0021875144, -0.031116582, 0.0073740557, -0.0011223912, -0.0014617691, 0.0016195896, -0.0012160753, 0.010112481, -0.0052313525, 0.007598307, -0.0035425844));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.013199894, -0.0061527784, 0.039222717, -0.016651034, -0.029397326, 0.055745643, -0.013764504, 0.0270617, -0.018816845, -0.008067501, 0.021895373, 0.016185313, -0.018521804, 0.02416026, -0.017097097, 0.013300717));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.00011470595, 0.008361698, -0.004095895, 0.013828518, 0.026651135, -0.018079981, 0.02409443, -0.01841833, 0.00083352026, -0.007934315, -0.0006724769, 0.008301941, 0.0033867036, -0.0077408887, 0.0026125251, -0.0042362306));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.000313777, 0.0014193488, 0.0009379888, -7.2800525e-05, 0.00077195256, 0.004129642, -0.0067273723, 0.0063784816, 0.00048026253, 0.00052681897, -0.0021638696, 9.871455e-05, -0.00086763006, -0.00050849386, 0.0029601231, -0.00090142526));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(9.597559e-06, -0.00087133737, -0.0010907884, 0.00312978, 0.031066902, 0.01717012, -0.029244455, -0.015543364, 0.001422237, 0.0010769112, -0.00093839964, -0.0042526564, -0.00026641053, -0.00140373, -0.003058397, 0.008226675));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.00055348675, -0.00043529714, 8.692698e-05, 0.0011975681, 0.016239053, 0.00073639327, 0.009820543, -0.020544583, 0.00016669853, 0.00050371833, -0.0012661726, 0.0014444855, 0.001172967, 0.001456005, 0.00086764107, -0.0014197646));
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
