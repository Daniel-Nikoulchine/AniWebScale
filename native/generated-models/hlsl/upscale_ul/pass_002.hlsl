// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale/Anime4K_Upscale_CNN_x2_UL.glsl:68
// Pass: 002 - Anime4K-v3.2-Upscale-CNN-x2-(UL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.07228457, 0.007666297, 0.0023270524, -0.13672906, -0.06545506, -0.049757745, 0.16956232, 0.048654493, 0.05838961, 0.02529347, -0.21557869, -0.12801598, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(0.14399123, 0.33404213, 0.30544546, -0.024566652, -0.07515048, -0.18194102, -0.3067775, -0.3386222, -0.06924871, 0.08277239, 0.30782035, 0.1812733, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.0034141026, 0.03465326, 0.13170029, 0.19363083, 0.07877697, 0.12887354, 0.31288412, 0.039260264, -0.14135145, -0.21657607, -0.08192631, -0.016260598, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.2796338, 0.3380564, -0.2591034, 0.053368755, 0.017104708, -0.18027966, -0.083344355, 0.29481766, -0.088741906, -0.03886714, 0.15531075, 0.34214082, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.35849893, 0.39669302, -0.4743166, -0.30070198, -0.04679741, 0.029014967, -0.11585943, 0.547813, 0.037943944, -0.3137137, -0.16505164, 0.1461349, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(-0.19912307, -0.69915354, 0.12588218, -0.25780293, 0.06785873, -0.06666295, 0.21257555, -0.30608517, 0.22777, 0.47556394, 0.12453673, -0.23966943, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.066451795, 0.036735266, 0.0883064, 0.2535588, 0.111621, 0.026139118, 0.02632312, -0.37550557, -0.026438652, -0.042137396, 0.026273955, -0.24945815, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.550942, -0.4508381, 0.0018671635, 0.21252398, -0.10602345, 0.13596801, -0.0023862422, 0.029529708, -0.06045382, 0.22975087, -0.1594863, -0.33607775, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.0114465775, 0.011813566, 0.09969644, 0.055403743, 0.02460606, 0.13673273, -0.22494976, -0.24256726, 0.024602994, -0.1862818, 0.015388349, 0.39983493, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.32573584, 0.02118458, 0.06321103, 0.01701115);
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
