// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale/Anime4K_Upscale_CNN_x2_UL.glsl:24
// Pass: 000 - Anime4K-v3.2-Upscale-CNN-x2-(UL)-Conv-4x3x3x3
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
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.27576035, -0.07072761, -0.1630093, -0.11306897, 0.14765891, -0.039999995, 0.04671886, -0.06138944, 0.11445724, 0.10989976, 0.12772457, 0.19654717, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.076798744, -0.026944768, -0.24994318, 0.2515569, -0.16839856, 0.17563075, 0.30983326, -0.26057217, -0.07267306, -0.16690817, -0.028771983, -0.32779765, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(-1.0, 1.0), float4x4(-0.22670166, -0.08031973, 0.1576897, -0.09411961, 0.10889907, 0.09876773, -0.12708376, 0.20890583, 0.13792023, 0.046159253, 0.008415701, 0.028718324, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, -1.0), float4x4(0.123937644, -0.0040695923, 0.1577942, -0.25086892, -0.11906424, 0.024612824, 0.04019426, -0.20309904, -0.001790695, -0.022292957, -0.24705121, -0.020513516, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 0.0), float4x4(-0.12275696, 0.087533146, 0.22975677, 0.3249744, -0.46705425, 0.049937986, -0.3746097, 0.6908184, -0.02694045, 0.10467642, 0.24765752, 0.29053956, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(0.0, 1.0), float4x4(-0.085650265, 0.06399875, 0.16803174, -0.000924935, -0.012419805, 0.3505107, -0.013437306, -0.37681264, -0.06174721, 0.3525594, -0.7133205, 0.16013019, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, -1.0), float4x4(0.2400495, 0.08462758, 0.025238732, -0.019882765, -0.09665332, -0.030001955, -0.10374011, -0.2661804, -0.1017717, -0.04910443, 0.102630705, -0.01290848, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 0.0), float4x4(0.13510828, -0.09396734, -0.30896646, 0.13402982, 0.7047196, -0.09083812, 0.29420912, -0.30652946, 0.089854665, -0.04834406, 0.017005004, -0.22518355, 0.0, 0.0, 0.0, 0.0));
    result += mul(go_0(1.0, 1.0), float4x4(0.28510967, 0.04660653, 0.24457681, -0.21047631, -0.12409636, -0.5526988, -0.1340479, 0.2336875, -0.048938934, -0.31569406, -0.021553513, -0.084858574, 0.0, 0.0, 0.0, 0.0));
    result += float4(0.0357343, 0.024812812, 0.040654864, -0.002103711);
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
