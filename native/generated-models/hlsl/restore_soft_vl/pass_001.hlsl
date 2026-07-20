// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_VL.glsl:45
// Pass: 001 - Anime4K-v4.0-Restore-CNN-Soft-(VL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.16406488, -0.2506693, -0.15592022, -0.05529256, -0.3997277, -0.229681, -0.07762124, 0.1843808, 0.07895815, 0.14437248, 0.219114, -0.048090722, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.2150676, 0.09080163, 0.19598733, -0.40578827, -0.33846557, -0.02518622, 0.037079208, 0.20188439, -0.013777575, -0.2369007, -0.30985412, 0.0411912, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(0.119948365, 0.23014452, -0.14962277, -0.096262485, 0.09625151, 0.2025487, 0.03933539, 0.12268028, -0.24373281, 0.19730613, 0.11634144, 0.12293635, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.08030697, -0.40114692, 0.21532272, 0.20222071, 0.073098, -0.004463858, 0.02820587, -0.18861918, -0.20994501, -0.12444653, -0.23178193, -0.13965288, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(0.14150894, 0.14563078, 0.697704, 0.20918849, 0.26776335, -0.34291518, 0.06394055, 0.17925078, 0.4165139, -0.042595536, 0.105312675, 0.231854, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.024318576, 0.16668217, 0.0729521, -0.7071404, 0.3121693, 0.37295797, -0.015632952, 0.33763757, 0.00706697, 0.10836652, -0.11132417, 0.292844, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.14489831, 0.0027769986, -0.24509215, 0.5557927, -0.1104541, 0.005070684, -0.020032275, -0.5642205, 0.16048644, 0.07248175, 0.20387374, -0.38145426, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.33140838, -0.007438425, 0.26074782, 0.15947102, 0.219755, -0.14690271, -0.07412696, -0.24176367, -0.2230114, 0.027256912, -0.11255796, -0.05882673, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.19712369, 0.003842208, -0.10893768, 0.09047115, -0.10260409, 0.18662766, 0.009733428, 0.0039940844, -0.006444674, -0.15196493, 0.06641555, -0.06169452, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.029148052, -0.03215124, -0.6175828, 0.057135154);
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
