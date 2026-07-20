// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_M.glsl:138
// Pass: 004 - Anime4K-v4.0-Restore-CNN-Soft-(M)-Conv-4x3x3x8
// Anime4K is Copyright (c) 2019-2021 bloc97, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[1];
};

Texture2D<float4> Anime4KInput0 : register(t0);
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

#define conv2d_3_tf_tex(position) Anime4KSample0(position)
#define conv2d_3_tf_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_3_tf_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_3_tf_pos anime4k_pos
#define conv2d_3_tf_size float2(Anime4KInputSizes[0].xy)
#define conv2d_3_tf_pt rcp(conv2d_3_tf_size)

#define go_0(x_off, y_off) (max((conv2d_3_tf_texOff(float2(x_off, y_off))), 0.0))
#define go_1(x_off, y_off) (max(-(conv2d_3_tf_texOff(float2(x_off, y_off))), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.10233342, -0.30233157, 0.24238978, -0.007108631, 0.14248851, 0.08486557, 0.0028373515, 0.122387215, 0.10996857, -0.17286511, 0.19819227, 0.07023527, 0.07579955, -0.16861476, -0.210025, 0.12760942));
    result += mul(go_0(-1.0, 0.0), float4x4(0.091181986, -0.41497424, -0.27567792, -0.09938067, -0.12210428, 0.20617811, -0.017644284, -0.22552875, 0.049019493, -0.18990634, 0.11057753, -0.043193225, -0.15278774, -0.18331046, -0.1837594, 0.029758787));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.1757096, -0.199691, -0.034743477, -0.15369363, -0.1701244, -0.0459655, 0.10508695, -0.09795581, 0.13464944, 0.37202564, 0.14706515, 0.23416734, 0.08302458, 0.20696343, -0.13935481, 0.03092827));
    result += mul(go_0(0.0, -1.0), float4x4(-0.49887478, 0.24046332, -0.029459715, 0.17374687, -0.15019977, 0.31086043, -0.28297687, -0.22239804, 0.12314376, 0.11594825, 0.17682782, 0.09753434, -0.26263535, -0.12739435, -0.57744014, 0.087381124));
    result += mul(go_0(0.0, 0.0), float4x4(0.08101439, -0.16185337, 0.112901986, 0.24439482, -0.44051018, -0.70680356, -0.23015513, 0.63106006, -0.08817581, -0.057614524, 0.15352182, -0.049620207, 0.17742544, -0.49583626, -0.3844133, 0.18385352));
    result += mul(go_0(0.0, 1.0), float4x4(0.17149475, 0.31255633, 0.19286609, 0.21052869, -0.11856372, -0.032373343, 0.06503625, -0.31664965, 0.040755365, -0.027614031, -0.33330554, 0.40148625, 0.056921627, -0.27068445, 0.047014963, 0.103712596));
    result += mul(go_0(1.0, -1.0), float4x4(-0.09326643, 0.13677256, 0.06390537, 0.08080093, -0.10685094, 0.124757454, 0.14696303, 0.10871933, -0.10971212, 0.01655797, -0.11052674, -0.17361104, 0.015513338, -0.1917502, -0.26384255, -0.022672707));
    result += mul(go_0(1.0, 0.0), float4x4(0.032367155, -0.087523445, -0.06951093, -0.08128242, 0.2627859, 0.14933161, 0.3114999, -0.007791172, -0.4146471, -0.2530298, -0.43175155, -0.06878434, 0.5724947, 0.25498095, 0.4838959, 0.15076154));
    result += mul(go_0(1.0, 1.0), float4x4(-0.13427481, -0.10134261, 0.087439895, 0.015921364, 0.15421022, 0.20205952, 0.22928835, -0.07339068, -0.33318612, -0.17467582, -0.04758165, 0.11858059, 0.17408857, -0.099393494, -0.06389948, -0.06494366));
    result += mul(go_1(-1.0, -1.0), float4x4(0.15349221, 0.08508258, -0.09294437, -0.03204993, -0.22561033, -0.15088828, -0.020105945, 0.10041996, -0.024723593, 0.06610271, -0.24423431, -0.050512858, -0.100530736, 0.16394953, 0.16365045, -0.012055956));
    result += mul(go_1(-1.0, 0.0), float4x4(0.16342951, 0.23113559, 0.21289586, 0.28391558, 0.052211206, -0.17983536, -0.008415342, 0.08977486, -0.054481823, 0.17506577, -0.14162593, -0.070448756, 0.093877845, 0.05161232, -0.25006327, 0.007014646));
    result += mul(go_1(-1.0, 1.0), float4x4(0.104965575, 0.20048036, 0.024134496, 0.5442797, 0.19958296, -0.05165447, 0.076928124, 0.030868227, -0.0563495, -0.19757621, 0.10801544, -0.24202053, 0.0067657093, -0.17784451, -0.03134409, -0.06741009));
    result += mul(go_1(0.0, -1.0), float4x4(0.33347723, -0.12338564, 0.23495969, -0.23091966, 0.059872203, 0.028045453, -0.06781438, 0.111325614, -0.21861015, -0.030451605, -0.04267672, -0.0039260075, 0.0911101, 0.054191053, -0.08498816, 0.04810343));
    result += mul(go_1(0.0, 0.0), float4x4(-0.05028896, 0.21515386, 0.16005337, -0.32279232, 0.19178568, 0.779363, -0.12682606, -0.4378189, 0.37980273, 0.063021325, 0.19370794, -0.05618088, -0.00088428083, 0.29736623, 0.24649377, -0.0021625878));
    result += mul(go_1(0.0, 1.0), float4x4(-0.45007992, -0.16040307, -0.1714593, -0.16251564, 0.070867635, 0.21317895, -0.070962, 0.17147541, -0.27786884, -0.33259448, -0.022767346, -0.17967366, 0.21208113, 0.19740848, 0.16877973, 0.09630738));
    result += mul(go_1(1.0, -1.0), float4x4(0.09235827, -0.35231477, -0.093315996, -0.035850406, -0.08311695, 0.054329164, 0.17788444, -0.020736141, -0.03739786, -0.1678283, 0.12676615, 0.17182353, 0.17408027, 0.07699043, 0.095501214, 0.0069830767));
    result += mul(go_1(1.0, 0.0), float4x4(-0.16631392, -0.16925642, -0.17081848, 0.017719474, -0.20530944, 0.19215193, -0.039511178, -0.08296625, 0.2240653, 0.100644305, 0.2901835, 0.32166973, -0.10026419, -0.14864013, -0.19926691, -0.11607018));
    result += mul(go_1(1.0, 1.0), float4x4(-0.13750182, 0.07445518, -0.033964884, -0.085812084, -0.03903257, -0.054933593, 0.06765632, 0.064338475, 0.27182797, 0.07721309, -0.0334218, -0.19344835, -0.14405386, 0.046106674, 0.16596143, 0.0879945));
    result += float4(0.049844168, 0.02670437, 0.050967637, -0.10779561);
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
