// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_M.glsl:45
// Pass: 001 - Anime4K-v4.0-Restore-CNN-(M)-Conv-4x3x3x8
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

#define conv2d_tf_tex(position) Anime4KSample0(position)
#define conv2d_tf_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_tf_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_tf_pos anime4k_pos
#define conv2d_tf_size float2(Anime4KInputSizes[0].xy)
#define conv2d_tf_pt rcp(conv2d_tf_size)

#define go_0(x_off, y_off) (max((conv2d_tf_texOff(float2(x_off, y_off))), 0.0))
#define go_1(x_off, y_off) (max(-(conv2d_tf_texOff(float2(x_off, y_off))), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.16410656, -0.40521824, 0.13121907, -0.02314597, 0.105412476, -0.060401272, -0.043063477, -0.13933973, 0.12558138, -0.020861467, 0.030370515, 0.13178016, -0.14220351, 0.20736893, 0.003321564, -0.29241714));
    result += mul(go_0(-1.0, 0.0), float4x4(0.18517321, 0.29162985, -0.26783395, 0.039760686, 0.025527012, -0.067319244, 0.055004176, 0.048916563, 0.12750523, -0.091435954, 0.13818842, 0.36704224, 0.0839921, 0.10186618, -0.17237376, 0.13282418));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.1657887, 0.0131325135, -0.17222486, 0.091398895, -0.12756164, -0.08437298, -0.29052997, 0.3269337, 0.15870757, -0.013529402, -0.0581753, 0.11802371, 0.07099966, -0.024063632, 0.31834844, -0.11183859));
    result += mul(go_0(0.0, -1.0), float4x4(0.46036887, -0.07654623, 0.22923063, 0.17463821, 0.10555414, -0.117430426, 0.12406777, -0.011399492, 0.028316498, 0.13684341, 0.009664087, 0.2022659, 0.04953974, -0.31342217, -0.6103131, -0.13605757));
    result += mul(go_0(0.0, 0.0), float4x4(0.03406955, -0.39819366, 0.61176, -0.46809456, -0.029321073, 0.46619493, 0.36700186, 0.02288561, 0.11464085, -0.10931452, -0.09154022, 0.07334147, -0.5609916, 0.31826234, -0.011012659, -0.46719545));
    result += mul(go_0(0.0, 1.0), float4x4(-0.056855045, 0.27037027, -0.09269696, -0.563572, -0.06816116, -0.22986612, 0.08693167, -0.16246101, 0.09954046, -0.05374176, 0.0071916827, -0.1788692, 0.3825241, -0.1609887, 0.055204768, 0.10213068));
    result += mul(go_0(1.0, -1.0), float4x4(0.0646626, 0.102358796, -0.45055822, 0.20557903, -0.23337309, 0.12633002, -0.19299199, -0.15085731, -0.13473304, 0.053790465, -0.10061193, -0.13393497, -0.04264752, -0.029740738, -0.07865285, 0.20883279));
    result += mul(go_0(1.0, 0.0), float4x4(0.010471527, -0.033218473, -0.46157447, 0.004866583, 0.23226471, -0.059343327, -0.1439596, 0.13619648, 0.013839963, 0.15930325, 0.043742355, 0.17467323, 0.33772305, 0.40261495, -0.08351293, 0.18129359));
    result += mul(go_0(1.0, 1.0), float4x4(-0.12493434, -0.1875134, -0.074943796, -0.0031701606, -0.037142616, 0.1667002, 0.16665547, -0.011248127, 0.0071619414, 0.0034872112, 0.120318964, -0.09625579, 0.14917047, -0.16310586, 0.07231737, 0.30447328));
    result += mul(go_1(-1.0, -1.0), float4x4(0.093798615, 0.17074613, -0.08780678, -0.012520207, 0.118534856, 0.027508778, -0.2778478, -0.19509242, -0.34137097, 0.32000312, -0.22027159, 0.337515, 0.16220862, 0.108993016, 0.14070526, 0.12784284));
    result += mul(go_1(-1.0, 0.0), float4x4(-0.14325632, -0.1467453, -0.27502358, 0.09370837, 0.11821083, -0.012266484, -0.2100548, 0.4707502, -0.06766648, 0.58165014, -0.2512279, -0.33783755, 0.1318925, -0.04346277, 0.15454485, 0.044500057));
    result += mul(go_1(-1.0, 1.0), float4x4(-0.05683207, 0.0051946463, -0.108000524, 0.10133204, -0.50763863, 0.007308442, 0.8542404, 0.28387356, 0.022709515, 0.294523, -0.3822472, 0.66166407, 0.01404485, 0.031282708, -0.26756814, -0.123147786));
    result += mul(go_1(0.0, -1.0), float4x4(-0.36455178, 0.3470555, -0.045303088, -0.03170764, -0.15802494, -0.0019141496, -0.25939587, -0.23875342, 0.130428, 0.03954273, -0.17985536, 0.105145946, 0.15804817, 0.12551713, 0.28371975, -0.085748516));
    result += mul(go_1(0.0, 0.0), float4x4(0.0060625463, 0.2443924, -0.017692259, -0.20214005, -0.09584515, -0.012805372, -0.13942227, 0.16143198, 0.12942013, 0.41785547, 0.046071563, 0.7030026, 0.10499644, -0.20566013, -0.031321276, 0.27830327));
    result += mul(go_1(0.0, 1.0), float4x4(-0.081274964, -0.14562319, 0.27200526, -0.20491314, 0.012910989, 0.024201397, 0.04816258, 0.21297328, -0.22015952, -0.44160756, -0.056035373, 0.33824417, -0.31645304, 0.15469243, 0.053187452, -0.20989445));
    result += mul(go_1(1.0, -1.0), float4x4(-0.046550367, 0.033185404, 0.33337244, 0.12853645, 0.23520172, -0.05909214, 0.0861368, 0.10706329, -0.07058717, -0.11759937, -0.18594047, 0.080006264, -0.055425353, -0.12506317, 0.15729053, -0.0915004));
    result += mul(go_1(1.0, 0.0), float4x4(0.042516407, 0.14844789, 0.16533111, 0.13502933, -0.0655417, -0.057256397, 0.076713726, -0.23448966, 0.12855926, 0.014219275, 0.051761385, 0.053433083, -0.2446715, -0.4008074, 0.19603717, -0.1796951));
    result += mul(go_1(1.0, 1.0), float4x4(0.14777803, 0.15524907, 0.043158617, -0.06996876, 0.19210646, -0.2144364, -0.47020787, -0.4207906, -0.18074386, -0.2163903, 0.0030754965, 0.36799973, -0.3837698, -0.0022661497, -0.37276733, -0.28934997));
    result += float4(-0.018297346, -0.080951825, -0.062163066, -0.08050014);
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
