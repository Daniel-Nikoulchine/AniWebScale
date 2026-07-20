// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_VL.glsl:24
// Pass: 000 - Anime4K-v4.0-Restore-CNN-(VL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.1690102, -0.2560719, 0.39658326, -0.3679659, -0.27616683, -0.35619372, -0.3748396, 0.08430813, -0.29574734, -0.31511316, -0.09773105, 0.13616018, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.1326393, -0.259433, 0.025070239, 0.58914864, -0.036478516, 0.30723435, 0.007458902, 0.012962684, 0.2493056, 0.13007334, -0.08448256, -0.38414413, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.11539356, 0.35253766, 0.26143202, 0.2760807, -0.09371543, -0.028165473, -0.028452158, -0.27050856, 0.06718067, -0.0056619495, -0.17654495, 0.17288211, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(-0.16145481, -0.3204927, -0.54317135, 0.11830119, 0.49315026, 0.12008072, 0.50857407, -0.30382085, 0.25807253, 0.020755528, 0.29388228, 0.106109895, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.22728722, 0.50484747, -0.07904469, 0.33114597, 0.50306976, -0.22760947, 0.14773269, 0.17628263, 0.14788547, -0.08223464, -0.10880935, -0.3151985, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(0.3414351, 0.057279214, -0.14419858, 0.09761111, -0.11794496, 0.021717256, -0.22750235, 0.13986664, -0.38932344, 0.28996095, 0.3773904, 0.13175532, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(0.1376552, -0.19587159, -0.35147396, -0.097646296, 0.1686707, -0.14385861, 0.031198, 0.12383533, -0.23089902, 0.08707301, 0.3362293, -0.100579016, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(-0.056774966, 0.047585852, -0.36395878, -0.20211312, 0.4077735, 0.12631284, 0.39813092, -0.033365678, 0.2307249, -0.09131807, 0.20823865, 0.31084216, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(-0.12456089, 0.09755632, 0.31490886, -0.06579996, -0.13386595, 0.07564795, -0.26605195, -0.075180635, -0.11182657, 0.06757017, -0.14351276, -0.16828312, 0.0, 0.0, 0.0, 0.0));
    result += float4(-0.046043985, 0.055581126, -0.08791638, -0.13022089);
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
