// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_VL.glsl:45
// Pass: 001 - Anime4K-v4.0-Restore-CNN-(VL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.15485518, -0.29363206, -0.22610365, -0.14291525, -0.45240572, -0.18319772, -0.12209436, 0.15031648, 0.09878383, 0.06711082, 0.25763842, -0.084633484, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.10204406, 0.16167697, 0.22371867, -0.37947702, -0.24476196, -0.038824454, 0.060157117, 0.15764871, -0.08072927, -0.2210841, -0.31835055, 0.009979876, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(0.20506924, 0.21132155, -0.0922578, -0.07430473, 0.14529926, 0.20549752, 0.0077948375, 0.13246094, -0.32353187, 0.21074104, 0.092629515, 0.17590871, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.04125819, -0.44050243, 0.23729716, 0.3218237, 0.12943116, -0.011674174, 0.10390632, 0.027775545, -0.20308031, -0.16904089, -0.2121676, -0.022515794, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(0.09664124, 0.20127031, 0.60345304, 0.16697013, 0.23093723, -0.38116834, 0.109695725, 0.0007595324, 0.4092646, 0.009624758, 0.11229678, 0.25326383, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.014879592, 0.19204311, 0.07102085, -0.7312604, 0.34860876, 0.3429918, -0.027331594, 0.27636307, 0.1342437, 0.107820466, -0.12645108, 0.21081445, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.12687613, -0.09247973, -0.25973785, 0.4350873, -0.18987224, 0.028678741, -0.0903819, -0.63974863, 0.205591, 0.11308998, 0.18458389, -0.4149041, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.34691808, -0.025498383, 0.3428986, 0.21663484, 0.23404741, -0.1725327, -0.0036315925, -0.13299675, -0.1873967, 0.031331502, -0.08785591, -0.0013278709, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.35846514, 0.048703704, -0.104165934, 0.16529736, -0.15378916, 0.26030356, -0.07134151, 0.03692383, -0.15807101, -0.18885155, 0.044707954, -0.11444462, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.0022791293, -0.024132347, -0.57621074, 0.028573977);
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
