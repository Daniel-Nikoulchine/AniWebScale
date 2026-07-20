// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale/Anime4K_Upscale_CNN_x2_VL.glsl:46
// Pass: 001 - Anime4K-v3.2-Upscale-CNN-x2-(VL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.112743355, 0.0422517, 0.21350034, -0.0967133, 0.16265953, 0.0022497, 0.015078242, 0.08204187, 0.035236806, -0.0468228, -0.09464228, -0.001864949, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(0.25631642, -0.41485596, -0.16662048, 0.13201024, 0.057921384, 0.2240005, -0.30038536, -0.08305622, 0.2228756, 0.32263795, 0.10608189, -0.18616734, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(0.08997524, 0.11516871, 0.19212262, -0.035154644, 0.11612274, -0.04056247, 0.14974374, 0.029173585, -0.07629641, -0.14353512, 0.041081246, 0.20230265, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.2262286, 0.055954933, -0.14499907, 0.17314723, 0.16590612, -0.06688698, -0.11118816, -0.012938116, -0.043101817, 0.026133137, 0.2958395, 0.06543993, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.07311521, -0.3041244, -0.47978505, -0.6350967, -0.17432262, 0.34965977, 0.25399777, -0.16590433, -0.49957857, 0.0549526, -0.40869385, -0.08780993, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(-0.3014447, -0.00021343959, -0.14953177, 0.028001398, -0.14931908, -0.14910097, -0.13287953, -0.45026535, 0.17378895, 0.024704922, -0.027308129, -0.10292025, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(-0.06732655, -0.13119644, 0.066014715, 0.081011154, -0.15154321, 0.2407805, 0.07733481, 0.12312706, 0.1741804, 0.008495716, -0.14125362, -0.043644864, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.11465958, 0.42001364, 0.011069392, 0.3203028, -0.058801666, -0.37830314, -0.030540617, 0.2245139, -0.11310525, -0.14845212, 0.19957744, 0.25789997, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.16037206, 0.21326372, 0.020099448, 0.018666709, 0.122083254, -0.16033986, -0.10725163, 0.2556128, 0.1650688, -0.10475823, 0.048623525, -0.103755645, 0.0, 0.0, 0.0, 0.0));
    result += float4(0.007717166, -0.027800834, 0.0795002, 0.0053199283);
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
