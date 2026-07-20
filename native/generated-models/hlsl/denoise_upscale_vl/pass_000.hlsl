// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_VL.glsl:24
// Pass: 000 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(VL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.28296316, -0.020139743, 0.1038232, 0.09352482, -0.16964972, 0.07910997, -0.049914766, -0.10661066, -0.121037185, -0.029087039, -0.02511847, -0.078911744, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.3927183, 0.01805193, -0.031168332, -0.13300525, 0.20814548, 0.118818566, 0.1655351, 0.095023684, 0.17600809, -0.03928444, -0.014350658, 0.08458312, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(0.079089314, -0.0421829, 0.05452305, -0.22055493, 0.013279097, -0.12875281, 0.02452735, -0.101503745, -0.085946664, 0.05539176, 0.022408713, 0.14837204, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(-0.102643915, -0.011254746, 0.1478563, 0.1030208, 0.12396588, 0.0016621432, 0.2551224, -0.10399001, -0.01068436, 0.07155532, -0.104522154, 0.026937222, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.8789423, 0.35707328, -0.29964274, -0.064913996, 0.4962815, 0.26001287, -0.9511284, 0.49574667, 0.39539725, 0.16308042, 0.119878456, -0.30259115, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(-0.08852938, -0.32612664, -0.006712046, 0.28693515, 0.06320871, -0.3322611, 0.04651086, -0.11020996, 0.01821082, -0.22851005, -0.07803438, 0.021527015, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(0.12295851, -0.011285535, 0.015859747, 0.04005441, -0.018136669, 0.03171969, -0.0406123, -0.10731229, -0.12117574, 0.005033036, 0.047838476, 0.026843475, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.4655988, 0.05519082, 0.039515793, 0.28410903, -0.36144528, 0.13039446, 0.11338478, -0.2141387, -0.10026682, -0.07903024, -0.09410254, 0.043833878, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(0.110124744, -0.024725702, 0.028102143, -0.09493807, -0.06455328, -0.15164614, 0.04425987, 0.15483347, -0.045039337, 0.07210396, -0.005390788, -0.03832707, 0.0, 0.0, 0.0, 0.0));
    result += float4(0.007907974, -0.035503313, 0.057224784, -0.19763541);
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
