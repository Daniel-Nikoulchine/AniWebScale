// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_UL.glsl:68
// Pass: 002 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(UL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.05112635, -0.09334158, -0.031148188, -0.041258592, -0.04633252, 0.022155467, 0.16979018, 0.06819186, 0.094320215, 0.02111737, -0.15604521, -0.15083192, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(0.10213034, 0.41852444, 0.32454407, -0.058512308, -0.054484565, -0.24399261, -0.26164648, -0.34274867, -0.06912002, 0.02257528, 0.2588075, 0.24375258, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(0.019957408, 0.06354756, 0.10109863, 0.16890836, 0.06791468, 0.1259216, 0.3096521, 0.07912831, -0.08293642, -0.16565439, -0.050881315, -0.0576009, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.19822149, 0.34747612, -0.20176221, 0.042434175, -0.029007072, -0.1637076, -0.09433387, 0.32732537, -0.12577844, -0.049755163, 0.091352955, 0.27023584, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.26348627, 0.52249527, -0.4091685, -0.41065818, 0.050318573, 0.06534145, -0.15470429, 0.52704567, 0.08808197, -0.37854514, -0.22827432, 0.1498618, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(-0.0865881, -0.8053624, 0.088793345, -0.22072543, -0.0141816195, 0.0049849018, 0.21256319, -0.327414, 0.1364984, 0.4927693, 0.1848864, -0.18559869, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.11838837, 0.056446314, 0.08738398, 0.31899074, 0.056432292, -0.0008520313, 0.018734995, -0.33501405, -0.00918473, -0.040785775, 0.04093389, -0.19747448, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.66065794, -0.5208613, -0.018835181, 0.26112127, 0.055486765, 0.113573246, -0.05028873, 0.05364108, 0.040549137, 0.28754827, -0.16565348, -0.37204087, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(0.06361742, 0.00907182, 0.06848412, 0.0057870117, -0.05289465, 0.068106346, -0.15660144, -0.20288356, -0.093512855, -0.17268412, 0.030761726, 0.36189792, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.51499516, 0.026265146, 0.05636954, 0.03170462);
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
