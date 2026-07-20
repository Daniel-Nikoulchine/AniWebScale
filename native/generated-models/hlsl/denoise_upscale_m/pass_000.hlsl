// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_M.glsl:24
// Pass: 000 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(M)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.029052526, 0.059789784, -0.024398074, 0.06907132, 0.18920785, -0.12923062, 0.0766382, -0.12048348, -0.017786544, 0.06251133, -0.068393864, 0.056690093, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(0.14032267, -0.077691495, -0.009036259, -0.13049065, 0.20954624, 0.023231741, -0.2759354, 0.49927905, 0.039609738, -0.092625424, 0.09426452, -0.2246486, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.023119625, 0.046549924, 0.073033765, 0.03727065, 0.04498207, 0.024455868, 0.17602317, -0.3150503, 0.019985953, 0.03670126, 0.0071220254, 0.107966185, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.111121014, -0.084099665, 0.12595509, -0.048271902, -0.007799661, 0.04831373, 0.11868961, 0.11607051, 0.05169621, -0.050569464, 0.120362274, 0.034607537, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.41167754, -0.44940078, 0.35485214, 0.58048695, -1.0151424, -0.70137614, 0.38405335, 0.37337455, -0.096364655, -0.14538667, 0.17917591, 0.32259464, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.06378494, -0.040756933, -0.4773648, -0.47702238, 0.1803328, -0.21388084, -0.5509359, -0.6491179, -0.048081584, -0.0025129975, -0.28561604, -0.22229671, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.037024107, 0.016497454, -0.05315267, -0.023392007, 0.1840294, 0.12675077, 0.037417043, -0.022394283, -0.028192522, -0.016344562, -0.07269005, -0.04747136, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.039480202, 0.5577544, -0.117326505, 0.06622856, -0.038784727, 0.65673745, -0.109742545, 0.22294083, 0.00038519394, 0.24552485, -0.07008514, 0.00029412706, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.009279719, -0.031882852, 0.14124188, -0.0759899, -0.024016602, 0.15252088, 0.13614258, -0.09961189, 0.05446014, -0.03827061, 0.11210173, -0.028823104, 0.0, 0.0, 0.0, 0.0));
    result += float4(0.012836382, -0.0062823873, -0.03165346, -0.0017501811);
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
