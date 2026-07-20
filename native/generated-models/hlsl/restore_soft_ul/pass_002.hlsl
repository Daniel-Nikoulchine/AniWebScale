// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_UL.glsl:66
// Pass: 002 - Anime4K-v4.0-Restore-CNN-Soft-(UL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.16112354, 0.3756035, 0.09619928, 0.17283864, 0.054338567, -0.061197184, -0.10173672, -0.032733057, -0.111913994, -0.28940153, -0.062114924, 0.20520677, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(0.3500745, 0.467141, -0.101748556, 0.43384346, 0.06712478, -0.43235737, 0.014446082, -0.12634972, -0.07507498, 0.025314584, 0.22664048, 0.22121347, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.089320965, 0.319314, -0.06869195, -0.2465581, 0.449762, -0.38919032, 0.1562217, 0.05368933, 0.20758076, 0.0659555, -0.109858744, -0.114917934, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(-0.07451217, 0.2239877, -0.009071173, 0.21869898, 0.042301223, 0.13635477, -0.20052543, 0.26130545, -0.051627826, -0.3429969, 0.093028575, -0.35710186, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.16129561, -0.31247056, -0.123016216, 0.2122524, -0.2972285, 0.2718142, -0.17284301, 0.44368207, -0.032497104, 0.18240568, -0.28283152, -0.10045272, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.15945031, -0.6797371, 0.3974546, 0.24741851, -0.1340806, 0.41666976, 0.27850744, -0.21406768, 0.096567124, 0.23366652, 0.15648519, -0.07626781, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.053246673, 0.14282355, -0.114118166, -0.3172004, -0.18055372, -0.3400759, -0.19622837, 0.076828666, 0.29225305, 0.14866155, 0.07959014, -0.041400358, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(-0.25331625, -0.14193451, 0.04879846, -0.077393495, 0.0104558095, 0.37905747, -0.07880302, -0.09453499, -0.1426901, -0.19738746, -0.28036812, 0.03675319, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.08954212, -0.47161737, -0.12388452, -0.08005436, 0.04682568, 0.048485547, 0.31411946, -0.31375095, -0.22892538, 0.16906887, 0.16802602, 0.18711087, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.04453386, 0.06632044, 0.061607827, -0.19856223);
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
