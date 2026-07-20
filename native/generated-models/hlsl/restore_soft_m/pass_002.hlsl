// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_M.glsl:76
// Pass: 002 - Anime4K-v4.0-Restore-CNN-Soft-(M)-Conv-4x3x3x8
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

#define conv2d_1_tf_tex(position) Anime4KSample0(position)
#define conv2d_1_tf_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_1_tf_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_1_tf_pos anime4k_pos
#define conv2d_1_tf_size float2(Anime4KInputSizes[0].xy)
#define conv2d_1_tf_pt rcp(conv2d_1_tf_size)

#define go_0(x_off, y_off) (max((conv2d_1_tf_texOff(float2(x_off, y_off))), 0.0))
#define go_1(x_off, y_off) (max(-(conv2d_1_tf_texOff(float2(x_off, y_off))), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.27743992, 0.04277345, 0.019331178, -0.7335445, 0.006292013, 0.19800001, -0.0025032016, 0.16098699, -0.03186617, -0.060173523, 0.08878855, -0.10669283, 0.130609, -0.068515256, -0.03571823, -0.13751523));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.2430821, -0.08233978, 0.082374334, 0.04843392, -0.18989052, -0.041925047, 0.40021122, -0.317836, -0.13517766, 0.032255337, -0.0746507, 0.22114721, -0.045706213, -0.12841983, -0.27830583, 0.05763077));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.08436965, -0.04967552, -0.16798134, -0.1539139, -0.17429228, -0.10166739, 0.35864773, 0.12873615, -0.07667423, 0.04985163, 0.13391761, -0.054322604, 0.085659124, -0.078792974, 0.06481059, 0.058667548));
    result += mul(go_0(0.0, -1.0), float4x4(-0.17568155, 0.56705236, 0.056562193, -0.020951264, 0.005879628, -0.2502103, -0.19619654, 0.019490348, -0.14527243, 0.16983634, 0.049245857, 0.18316677, 0.055053137, 0.10699275, 0.0016993808, 0.20105995));
    result += mul(go_0(0.0, 0.0), float4x4(0.36284775, -0.05856962, -0.42545465, 0.31931567, -0.15698905, -0.28837132, -0.028697362, -0.024917847, 0.04317283, 0.024557106, -0.052158598, 0.38654143, -0.1782944, 0.43094924, -0.11738149, 0.21554618));
    result += mul(go_0(0.0, 1.0), float4x4(0.22645079, -0.20319854, 0.20733371, -0.18697177, -0.05167819, -0.12845007, 0.5543688, 0.2453291, 0.08027872, -0.0628224, -0.06593836, -0.05795855, -0.24527508, 0.23632833, -0.043366548, 0.14135826));
    result += mul(go_0(1.0, -1.0), float4x4(0.08384414, 0.20807321, 0.030559694, -0.13640808, -0.07641805, -0.10919174, -0.19799095, -0.12955745, 0.093737304, -0.17856954, 0.035103753, -0.044699315, -0.07255943, -0.02331535, 0.2059249, 0.3058302));
    result += mul(go_0(1.0, 0.0), float4x4(0.022345139, 0.16286038, -0.27228013, -0.41105714, -0.0014384583, 0.089546144, -0.08296848, -0.0050463285, 0.07038578, -0.030679917, 0.031246305, 0.36761853, -0.34799108, -0.0405689, -0.19182852, 0.015853593));
    result += mul(go_0(1.0, 1.0), float4x4(0.1021783, -0.11396049, -0.08733628, -0.017449526, 0.042015605, -0.14808236, 0.10072531, -0.07403295, 0.15276712, -0.07807765, -0.10013386, -0.26110634, -0.04858846, 0.066066965, 0.13598624, 0.21687816));
    result += mul(go_1(-1.0, -1.0), float4x4(0.07041569, -0.17775945, 0.15697548, -0.15425202, -0.06569677, -0.033233996, 0.22596005, -0.026170855, -0.20729817, 0.1316505, -0.058410037, 0.22166035, 0.09107114, -0.13078825, -0.05639485, -0.02716142));
    result += mul(go_1(-1.0, 0.0), float4x4(0.057966787, -0.15311252, 0.095924966, -0.055951685, 0.082777694, -0.08471956, -0.39918202, 0.10599212, 0.102710955, 0.21808124, 0.12083635, -0.38835892, 0.031709857, 0.13955092, 0.12647778, 0.011549966));
    result += mul(go_1(-1.0, 1.0), float4x4(0.09810508, -0.119743295, 0.06166254, 0.13595435, 0.036198203, -0.028710455, -0.40789905, -0.034894038, -0.12622337, 0.14379597, 0.039958883, 0.19636424, 0.047094557, -0.07987105, -0.04905092, -0.07875785));
    result += mul(go_1(0.0, -1.0), float4x4(0.34118712, -0.2833933, -0.045028314, -0.40670308, -0.01961924, 0.37131935, 0.29099533, -0.19843055, 0.18604252, -0.0037280058, 0.1091072, -0.40579233, 0.11422739, -0.16490164, -0.0022396361, -0.21486944));
    result += mul(go_1(0.0, 0.0), float4x4(0.0010853866, 0.2223109, 0.2416471, -0.33326814, 0.2549397, 0.6442047, 0.18411863, -0.19081281, -0.43552014, -0.1793875, -0.58699155, -0.01900168, -0.26955804, -0.071371995, 0.07599079, 0.27434483));
    result += mul(go_1(0.0, 1.0), float4x4(-0.19644544, 0.14383379, -0.2599538, 0.001666124, -0.16369823, 0.009537702, -0.3690974, -0.048157427, -0.2040159, 0.01522431, -0.11007749, -0.07012568, 0.17536888, -0.012183123, -0.17366478, -0.15090804));
    result += mul(go_1(1.0, -1.0), float4x4(0.0855136, 0.06863859, -0.17249937, -0.12850079, 0.15325847, 0.22742507, 0.22535504, 0.24032994, -0.109522276, 0.24135293, -0.17784368, 0.08172238, -0.16143093, 0.1358853, -0.09399085, 0.012180792));
    result += mul(go_1(1.0, 0.0), float4x4(-0.04346881, 0.13367178, 0.10387612, 0.04705543, -0.10315795, 0.5816371, -0.090529, -0.017955385, -0.09032907, -0.52505773, 0.10958755, -0.26151448, 0.17246644, 0.011886279, 0.3566306, 0.32170597));
    result += mul(go_1(1.0, 1.0), float4x4(-0.27853554, 0.1558035, 0.070289604, 0.17052644, -0.31982365, 0.29085326, -0.09494764, 0.2270542, 0.10514691, -0.24606484, -0.02049181, 0.126686, 0.16719124, 0.013080999, -0.08577963, -0.07057233));
    result += float4(0.0061747693, -0.029145364, -0.026801255, 0.027419873);
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
