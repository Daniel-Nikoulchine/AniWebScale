// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_UL.glsl:24
// Pass: 000 - Anime4K-v4.0-Restore-CNN-(UL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.28293434, -0.10095658, -0.013867814, 0.08509398, -0.31489053, -0.26828897, 0.01152665, 0.18905516, -0.23013242, -0.18878274, -0.17923735, -0.32707638, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.3519405, -0.12639853, 0.0981044, -0.23800656, -0.1666394, 0.2548722, -0.09458217, 0.17642984, -0.0016840132, -0.12355663, -0.13711694, 0.25234836, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.14581299, -0.060752276, 0.06813433, 0.32616982, -0.29410994, 0.28217724, -0.2221963, -0.051627193, 0.10754401, 0.31993762, 0.25542948, -0.4268778, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.2716687, -0.13160354, -0.056812827, -0.00881874, 0.3249303, 0.05037425, -0.117648534, -0.26370025, 0.032854702, -0.14214379, 0.10036965, 0.17808898, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(0.004323515, 0.37651265, -0.39865002, -0.18153298, 0.5224921, -0.11810103, 0.56151056, -0.063698344, -0.17272837, -0.053013492, 0.062254835, 0.28695017, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.2776938, 0.22578415, 0.110299006, 0.27424663, 0.012712999, -0.22353122, -0.0010140019, 0.08163494, 0.3611274, 0.014346184, -0.26426178, -0.26777005, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.09010997, 0.19958799, 0.22421049, 0.054506898, -0.11822318, 0.23656984, 0.11197124, -0.4646639, 0.17118955, 0.33748102, 0.20479581, 0.6810799, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.2121316, -0.08664465, 0.2507115, -0.223455, 0.22042283, -0.20352642, 0.42714027, -0.5048447, -0.10270271, 0.11400399, -0.019575266, 0.40490857, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(0.091496244, -0.24679382, -0.3801941, -0.08482344, -0.17183328, -0.09308921, -0.059639163, 0.3321586, -0.19797249, -0.17941834, 0.015049101, -0.13793056, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.02313247, 0.016216148, -0.053347506, -0.023317637);
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
