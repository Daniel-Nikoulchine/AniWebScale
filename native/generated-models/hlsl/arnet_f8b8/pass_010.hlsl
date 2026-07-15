// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:298
// Pass: 010 - ARNet F8B8 body block 2 conv 0 8x8x3x3 part 0
// ACNetGLSL is Copyright (c) 2020 TianZer, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[2];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
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

float4 Anime4KTransform1(float4 value)
{
    return value;
}

float2 Anime4KClampUv1(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[1].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample1(float2 uv)
{
    return Anime4KTransform1(float4(Anime4KInput1.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv1(uv), 0.0)));
}

float4 Anime4KLoadOffset1(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[1].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform1(float4(Anime4KInput1.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent1(uint2 position)
{
    return Anime4KTransform1(float4(Anime4KInput1.Load(int3(position, 0))));
}

#define TMP2_TEX_0_tex(position) Anime4KSample0(position)
#define TMP2_TEX_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define TMP2_TEX_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define TMP2_TEX_0_pos anime4k_pos
#define TMP2_TEX_0_size float2(Anime4KInputSizes[0].xy)
#define TMP2_TEX_0_pt rcp(TMP2_TEX_0_size)
#define TMP2_TEX_1_tex(position) Anime4KSample1(position)
#define TMP2_TEX_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define TMP2_TEX_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define TMP2_TEX_1_pos anime4k_pos
#define TMP2_TEX_1_size float2(Anime4KInputSizes[1].xy)
#define TMP2_TEX_1_pt rcp(TMP2_TEX_1_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.46646845, 0.97355616, -0.55983055, -0.12976967);
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.7367023, -0.0463657, 0.3712508, 0.030421548, 0.48994526, -0.0959584, -0.16730113, 0.09710812, -0.26278076, 0.015055723, 0.042308982, -0.21703483, 0.7526063, 0.110869884, -0.06566725, 0.2544073));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.8400595, 0.044124205, -0.074726164, 0.027934564, 0.623532, -0.0353776, -0.033448417, 0.2774552, 0.31086057, -0.24456014, 0.24825323, 0.67199403, -0.37340325, 0.058183357, -0.061542843, -0.9791875));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.57732874, -0.18556492, 0.13309783, 0.008797748, -0.21181649, 0.1705329, -0.10296721, -0.3452593, 0.032488532, -0.038809747, -0.11082633, -0.12677065, -0.016306408, -0.019048033, -0.19305997, -0.039125316));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.9269103, -0.120403096, 0.18863453, -0.9250998, 0.25382212, 0.027983023, 0.35752723, 0.29715297, -0.458997, -0.2986553, 0.3264585, -0.95267165, 1.0201997, 0.08825902, -0.3321281, 0.6119424));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.02571702, -0.08997339, 0.48208466, 0.20033887, 0.25960356, 0.24048251, 1.6067103, 0.17135334, -0.28309953, 0.44677335, 0.62282777, -1.068375, 1.1478186, 0.63742083, 0.20242298, 1.1664248));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.06003281, -0.14763549, -0.1169614, 0.3259517, 0.3836251, 0.028961517, -0.13205324, -0.19200575, 0.30481985, -0.07837049, -0.036176186, 0.37168688, -0.5171472, 0.08006802, 0.015153778, -0.33646306));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.19627964, 0.035683997, -0.5594919, 0.27532423, -0.09600432, -0.049346834, 0.21348776, 0.10181537, 0.028174482, 0.052848116, -0.2701093, 0.13477363, 0.2780633, 0.10425783, -0.23350944, 0.024459012));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.035635244, 0.053214546, 0.19221519, 0.120176524, -0.35612968, -0.1370126, 0.32151186, -0.11495161, 0.25811863, 0.019400219, -0.22360395, 0.22827525, 0.48820052, 0.12171234, -0.6605277, 0.15545179));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.27963313, 0.039881434, 0.12728354, -0.073426284, -0.09550596, -0.021781938, 0.05718906, 0.10353429, 0.12887755, 0.046910536, -0.16101839, 0.1433897, 0.024263104, 0.09857231, -0.20125592, -0.06632509));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.3527793, 0.22696893, -0.084509164, -0.019886723, 0.35502696, 0.05228053, -0.28323904, -0.261654, 0.22557385, -0.0008443565, -0.14248216, 0.15918344, -0.98262405, 0.35501793, 0.33713964, -0.16523924));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.0295753, 0.06299248, 0.2234606, -0.9310212, 0.79533565, -0.21379663, -0.01110918, 0.24727345, 0.64753556, 0.053189028, 0.199706, 0.07788683, -1.5795625, 0.196331, 0.42861047, -0.8086766));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.42243758, 0.1612142, -0.22335619, -0.30473945, 0.024958266, 0.0051071607, 0.037662134, 0.044808697, 0.24547897, -0.038474485, 0.053495347, -0.08101317, 0.55128485, -0.098739915, 0.034247164, 0.41762954));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.16088714, 0.17181532, -0.027117128, 0.12468269, -0.7551359, -0.11289816, 0.7621218, -0.45898536, 0.32765436, 0.14046793, 0.0029729228, 0.13689026, -0.2142734, 0.24165483, 0.3508278, 0.15805133));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.48122108, -0.06960407, 0.9163242, 0.6328089, 0.24074471, -0.13271089, 0.9906094, -0.21244356, 0.7241053, -0.15978149, 0.03547601, 1.4098711, -1.8392842, 0.07182083, -1.3913368, -1.562537));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 0.0)), float4x4(0.24096385, 0.044483237, 0.010492972, 0.4249818, 0.014091857, 9.126131e-05, -0.21156311, -0.2172863, 0.15813316, 0.1393038, 0.29918894, -0.008773615, -0.63915354, 0.36460984, -0.27257502, -0.22577995));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.06346478, -0.024175962, 0.18334538, -0.050167583, 0.16874394, 0.061971545, 0.017591724, 0.23290916, 0.0058739237, 0.06505117, 0.2814242, -0.3315884, -0.063474506, -0.0004970983, 0.24419938, -0.049210235));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 1.0)), float4x4(-0.12200604, 0.048304677, 0.7198927, -0.11241074, -0.031755295, -0.05003695, -0.16588554, 0.0006020012, -0.06685611, -0.13646534, 0.982343, -0.3902696, 0.5400116, 0.1813519, -0.28513414, 0.11905986));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 1.0)), float4x4(0.19741847, -0.02745333, 0.12061868, -0.06952727, -0.10174588, 0.08527539, -0.026039505, 0.044485062, -0.009222367, -0.045700036, 0.42558137, -0.14432879, 0.2232808, 0.053486846, -0.16740642, 0.39389703));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(-0.35182685, -2.8442848, -0.3319994, -1.2164755) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
