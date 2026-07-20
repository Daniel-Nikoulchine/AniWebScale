// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_UL.glsl:24
// Pass: 000 - Anime4K-v4.0-Restore-CNN-Soft-(UL)-Conv-4x3x3x3
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

#define MAIN_tex(position) Anime4KSample0(position)
#define MAIN_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define MAIN_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define MAIN_pos anime4k_pos
#define MAIN_size float2(Anime4KInputSizes[0].xy)
#define MAIN_pt rcp(MAIN_size)

#define go_0(x_off, y_off) (MAIN_texOff(float2(x_off, y_off)))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.23234928, -0.070085905, 0.0040122913, 0.21575761, -0.25936925, -0.20185155, 0.022299573, 0.2812235, -0.11045535, -0.11106335, -0.12113332, -0.49919847, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.48585954, -0.058959674, 0.11114158, -0.1971666, -0.24872562, 0.2667282, -0.107163996, 0.12475151, -0.027792914, -0.06700173, -0.10966316, 0.09399147, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.16666615, -0.15644506, 0.048309084, 0.19122206, -0.1522582, 0.15417537, -0.23017146, 0.09460856, 0.074704535, 0.2168164, 0.2077189, -0.29264635, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.3167284, -0.20522436, -0.050071932, -0.036290437, 0.20206359, 0.012589764, -0.1251284, -0.2911492, -0.0006390347, -0.09853893, 0.14406726, 0.33612582, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(0.13786903, 0.51342535, -0.44004235, -0.23918492, 0.5614157, 0.011565876, 0.5419984, -0.15937872, -0.075360805, 0.018496322, 0.12582661, 0.40117717, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.19644158, 0.12697817, 0.15092115, 0.1963961, -0.03395398, -0.17465135, -0.04086773, 0.09187623, 0.18238129, -0.0063141263, -0.26402372, -0.28761682, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.010849395, 0.15082607, 0.095264904, -0.038952388, -0.1121466, 0.21590506, 0.029462064, -0.65400773, 0.18295552, 0.2425088, 0.121624336, 0.7189011, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.17197245, -0.04397748, 0.18232836, -0.04471754, 0.071163684, -0.20590816, 0.39706057, -0.5452873, -0.11754515, 0.006909551, 0.018450081, 0.5686299, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(0.077441245, -0.25645187, -0.19979256, -0.010363122, -0.04312338, -0.08810754, -0.059999906, 0.38630447, -0.11017497, -0.16309647, 0.026156282, -0.35432625, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.03509807, 0.029998481, -0.08691994, -0.017055636);
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
