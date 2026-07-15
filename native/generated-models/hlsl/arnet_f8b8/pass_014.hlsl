// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:426
// Pass: 014 - ARNet F8B8 body block 3 conv 0 8x8x3x3 part 0
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
    float4 result = float4(1.3193064, -0.5433203, -0.7740253, 0.22636575);
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(0.24999027, 0.020511316, 0.02610936, 0.21154067, -0.07818469, 0.6173275, 0.4678964, 0.18787055, 0.92494565, 0.1955902, -0.34700614, 0.11903549, -0.37185177, -0.027475713, -0.88602144, -0.20005932));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.13866197, -0.13682492, 0.50866044, -0.34292987, -0.06351194, -0.072113864, -0.02245871, 0.47979903, 0.51450896, -0.5624507, 0.851457, -0.62294436, -1.6415234, 0.52046824, -0.7260557, 0.6989046));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.09716828, 0.19565406, 0.3440554, 0.3135684, -0.8059127, 0.20067893, -0.9516943, 0.58289826, -0.096133046, 0.14797041, -0.4359028, 0.1436016, 0.29347, -0.7060462, 0.4536429, -0.95979595));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.6471262, 0.8128055, 1.6271784, 0.3511722, -0.9390055, -1.4668617, -1.4626057, 0.20450146, -0.45165786, -1.7628423, -0.14869882, 0.46873757, 0.8973555, -1.1258522, -0.4675343, -0.5814668));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(1.1560147, -0.09064369, 0.5020784, -0.63335145, -0.45693535, -0.34049296, 0.89902174, -0.74249727, 0.78104514, 0.32006973, -0.56995785, 1.841556, 1.5036895, 0.9548673, 2.1972754, 1.4042273));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.14515218, 0.2026958, -0.3814166, 0.3840734, 0.67100203, 0.46231952, 0.22772942, -0.6156039, 0.07580833, 0.13678253, -0.5070821, -0.20218046, -0.7390514, -0.43638563, -0.32857552, 0.55889195));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.49116284, -1.2855127, -0.8239224, -0.047059085, 0.6794008, 1.4300369, 0.74250346, -0.1909049, -0.15138122, 0.3746148, -0.47474208, -0.49358484, 0.16360442, 0.32757005, -0.0931099, 0.32025808));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.26768035, -0.7092651, 0.015982905, -0.006110842, 0.43419945, -0.19636203, -0.21738192, 0.1020774, 0.15867786, -0.098226145, -0.6436159, 0.36707243, 0.6016904, 0.82162136, 0.7308638, -1.5138535));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.4497639, 0.188239, 0.37105724, -0.012775098, -0.27939913, 0.11226287, 0.24012263, 0.0007362432, 0.19753122, 0.43458304, 0.62630755, -0.42553622, -0.06850494, -0.0734291, -0.19685183, 0.208049));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.2813721, -0.34622556, -0.9044116, -0.7123788, 0.11683953, 0.17545891, 0.61609787, 0.3753421, 0.028640358, -0.041585557, -1.2381963, 0.26031578, 0.030559398, -0.47821617, -0.8035729, -0.43270957));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.087957904, 0.16998897, -0.24731578, -0.42123002, 0.39952308, -0.5020761, 0.8251833, -0.14899418, -0.80631363, -0.28637224, 0.35765663, -0.5997802, 0.44557628, -0.27362555, 0.42263934, -0.26202545));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.3745386, -0.24909514, -0.06757117, -0.541576, -0.1947403, -0.2422606, 0.092068896, 0.57435507, 0.49693468, -0.17055462, 0.21551462, -0.52262634, 0.6701855, -0.8792272, 0.46565664, -0.7597929));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.54633415, -0.15054388, -1.1065938, 0.50605816, -0.4887003, 2.5286837, 0.27207395, 0.8328892, 0.17042217, 0.1684445, -1.2873187, 0.54241574, -0.7281474, 0.53896874, -0.82826257, -0.3476274));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.13784371, 1.3186445, 1.1309311, 1.6452725, 0.021261437, -1.1318206, -0.028835464, -0.70084476, 0.18973956, 0.7393955, 0.52938044, 0.8288216, -1.9581474, 1.9224777, 0.19793312, 3.034299));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.066876516, -0.70265704, 0.7209517, -0.44167423, 0.11980674, 0.22075428, -0.1797796, -0.40095112, -0.49826637, -0.38140264, -0.6343131, 0.79506624, -1.5523727, -0.94612384, 0.11045477, 0.49515036));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(-0.37737924, -0.20437938, 0.15958945, -0.25860986, 0.26471123, 0.3028971, -0.26557413, -0.853863, 0.1067369, -0.24121962, -0.13730225, -0.20302057, -0.4129915, 0.54537, -0.2321903, -0.38322333));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.50377834, -0.29624176, 1.7931073, 0.77948064, -0.39842367, -0.21071927, 0.27170345, 0.75523627, 0.9455612, -0.005595474, -0.4460633, -0.7699053, -0.40964165, 0.81863594, 0.08075122, -0.42808014));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 1.0)), float4x4(0.4147183, 0.21250546, -0.21394402, -0.18275324, -0.2652294, -0.0064738435, -0.058504302, 0.062470626, -0.042712305, 0.09028332, -0.06903558, 0.35378227, 0.07287117, -0.2764518, -0.26677144, -0.46808505));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(-0.015063168, 0.2580502, 0.05769788, -0.550343) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
