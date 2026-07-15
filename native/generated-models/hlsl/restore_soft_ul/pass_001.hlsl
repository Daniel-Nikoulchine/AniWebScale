// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_UL.glsl:45
// Pass: 001 - Anime4K-v4.0-Restore-CNN-Soft-(UL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.34123975, 0.06927292, 0.12252625, 0.1038146, 0.15979475, 0.24436772, -0.016088272, -0.22664197, 0.16932374, 0.10719134, -0.16895153, 0.100098394, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(0.11094869, -0.1379463, -0.53625333, -0.42690855, 0.12101115, -0.004709155, 0.6293494, 0.4763549, 0.030926082, -0.20099613, 0.39174548, 0.31219363, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(0.08731028, -0.010540878, 0.0757335, -0.1466203, -0.23115048, -0.17813745, 0.17698573, 0.18787299, 0.16219892, 0.10475756, -0.23984352, 0.025724094, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.27665043, 0.4118298, -0.08762915, -0.07885308, 0.05053698, 0.28148478, -0.005842398, 0.15139125, -0.3791668, 0.24871133, 0.18160823, -0.10384939, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.3206045, -0.22038852, -0.3038138, -0.0482595, -0.26852164, -0.23278148, 0.30639926, 0.2578657, -0.3874695, 0.06441954, 0.00026220892, 0.04361178, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(-0.17908047, -0.0900835, 0.00652168, -0.038639892, 0.1520494, -0.13204975, -0.020355739, 0.26766944, 0.021308672, -0.31918222, 0.050667368, 0.10367864, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.112388864, 0.053321466, 0.2691917, 0.26902813, 0.010105532, 0.24898581, -0.13757521, -0.10214595, 0.23615286, -0.09560994, -0.15046176, -0.08853913, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(-0.36796987, -0.2124952, -0.07535088, 0.13065732, -0.21852261, 0.06934692, -0.013749303, -0.44900006, 0.3352218, 0.090437174, 0.08993535, -0.3050165, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(0.11873657, 0.13483031, 0.22352207, 0.23666611, 0.18977334, -0.32066482, -0.31396368, -0.5615055, -0.14588253, 0.0121516865, 0.0614425, -0.079611346, 0.0, 0.0, 0.0, 0.0));
    result += float4(0.6537504, 0.07195351, -0.38729003, -0.0374416);
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
