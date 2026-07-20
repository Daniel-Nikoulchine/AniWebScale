// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale/Anime4K_Upscale_CNN_x2_UL.glsl:46
// Pass: 001 - Anime4K-v3.2-Upscale-CNN-x2-(UL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.058698863, -0.07291426, 0.04927266, 0.09258057, -0.048297565, 0.05610951, 0.07047442, -0.07120319, -0.03516866, 0.0076037147, 0.07701455, -0.059423756, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.0055849426, 0.26572028, -0.21616961, -0.042883366, 0.04323887, 0.04128688, -0.1975783, 0.15745145, 0.017314252, -0.26768935, 0.080519766, 0.021246549, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.045365453, 0.16887768, -0.21514243, -0.49443442, 0.016238604, -0.12318089, 0.21210986, 0.29339197, 0.008509125, -0.0120522, 0.14660002, 0.16444208, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(-0.18049234, 0.27750164, 0.48953623, 0.32381085, 0.13180427, -0.19170003, -0.042992454, -0.24161138, 0.02187773, -0.052547548, -0.23762631, -0.17446616, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(0.10295366, -0.06758289, 0.3209139, -0.089126036, 0.045649666, 0.061549887, -0.22704688, 0.08373262, 0.062346827, -0.012463345, -0.2679532, -0.033193, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.028882261, -0.41653237, -0.55437064, -0.23836315, -0.10729088, 0.056782994, 0.2587744, 0.3095401, -0.057483524, 0.2876223, 0.21580297, 0.07463114, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(0.014345448, 0.05962805, -0.2022189, -0.08993287, 0.070023656, 0.08089038, 0.114226155, 0.0025734142, -0.010230871, -0.0990795, 0.17906278, 0.048965868, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.26569575, -0.20329566, 0.40301713, 0.5406432, 0.4320893, 0.09291447, -0.24186778, -0.40646008, 0.08337033, 0.114029825, -0.17575161, -0.21976136, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.23839538, -0.5789523, -0.0655242, -0.0007585647, -0.58420926, -0.0028022572, 0.040551513, -0.14223239, -0.08617295, 0.22481681, -0.015953997, 0.18862534, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.041260406, 0.20480168, -0.016556341, 0.021896001);
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
