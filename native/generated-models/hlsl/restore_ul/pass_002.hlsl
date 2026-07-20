// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_UL.glsl:66
// Pass: 002 - Anime4K-v4.0-Restore-CNN-(UL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.18228084, 0.25933146, 0.1764313, 0.23183075, -0.061067093, 0.34710985, -0.1785006, -0.06471029, -0.23235676, -0.43409523, -0.06639704, 0.30396065, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(0.31676784, 0.21897513, 0.06466065, 0.42289257, 0.12306216, -0.3928633, 0.09720577, -0.10426061, -0.030383142, 0.03775265, 0.34221298, 0.3827705, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.13229136, 0.37214845, -0.07046923, -0.17644346, 0.5591967, -0.5409525, 0.08944645, -0.047717415, 0.3754216, 0.2979604, -0.14149979, -0.1743562, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.07603316, 0.10389099, 0.07042061, 0.24759614, 0.05822713, 0.29799607, -0.21219468, 0.3884128, -0.010661014, -0.5209726, 0.20311587, -0.39393, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.17486575, -0.22572622, -0.13514778, 0.12839775, -0.25754005, 0.13090849, -0.16364887, 0.37675568, -0.05928962, 0.049174402, -0.37935108, -0.14333783, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.15858985, -0.47485206, 0.4509964, 0.3877553, -0.04848657, 0.22396515, 0.33325925, -0.20703658, 0.14929648, 0.25580746, 0.2795224, -0.0158565, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(0.030926622, 0.16219522, -0.26666775, -0.27920142, -0.2693319, -0.29130983, -0.2795281, 0.22597994, 0.32512712, 0.16784063, -0.0113234315, -0.10118217, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(-0.32426193, 0.0072339224, 0.08070994, -0.07735796, -0.09247539, 0.23327915, 0.09039661, -0.11836084, -0.2726992, -0.16031814, -0.28027415, -0.029263943, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.20109104, -0.43383566, -0.33850962, -0.13422257, 0.040343326, -0.0819253, 0.26943803, -0.46652415, -0.3474102, 0.41198114, 0.14404535, 0.076806836, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.032911904, -0.0050934837, 0.021853646, -0.17256187);
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
