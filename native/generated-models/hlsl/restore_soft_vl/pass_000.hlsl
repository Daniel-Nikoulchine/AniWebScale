// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_VL.glsl:24
// Pass: 000 - Anime4K-v4.0-Restore-CNN-Soft-(VL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.14361712, -0.16690509, 0.37253398, -0.45202538, -0.21331833, -0.32675815, -0.33971128, 0.20261937, -0.20606318, -0.215143, -0.079716705, 0.15640882, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.17360486, -0.3435545, 0.08199117, 0.56259036, -0.120246716, 0.24312893, -0.021436244, -0.11864853, 0.19452724, 0.106943935, -0.077393375, -0.3503661, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.072465785, 0.2772823, 0.25493625, 0.3098145, -0.115831695, 0.072458096, -0.014782132, -0.15310249, 0.12178311, -0.015555423, -0.2229811, 0.16469522, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(-0.18652022, -0.30702665, -0.59921896, 0.079824045, 0.4426619, 0.049343713, 0.44902903, -0.2711445, 0.20470268, -0.029203767, 0.29092675, 0.15562426, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.21041247, 0.48450592, -0.110547826, 0.3842122, 0.5303875, -0.26512837, 0.19846216, 0.045673862, 0.12773214, -0.05117536, -0.03510946, -0.30123934, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.3186735, 0.052702922, -0.12499774, 0.055628903, -0.16476867, 0.12642322, -0.18314636, 0.018323101, -0.3609603, 0.25649396, 0.3185421, -0.0057759956, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(0.16603558, -0.09259665, -0.28760567, -0.14319661, 0.12511417, -0.12551902, -0.00070228375, 0.20914114, -0.22466865, 0.1064727, 0.32598525, -0.08596318, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(-0.03163653, 0.026722813, -0.4361858, -0.21164834, 0.4176763, 0.08203146, 0.35289326, -0.06128859, 0.20506798, -0.07098943, 0.1807802, 0.2658414, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.09821681, 0.058886815, 0.39192092, -0.06791861, -0.15682612, 0.09503328, -0.23400265, 0.026475023, -0.08800713, -0.043749645, -0.18024494, -0.08045564, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.040999945, 0.075765304, -0.0911532, -0.10705836);
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
