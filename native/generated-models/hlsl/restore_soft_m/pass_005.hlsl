// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_M.glsl:169
// Pass: 005 - Anime4K-v4.0-Restore-CNN-Soft-(M)-Conv-4x3x3x8
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

#define conv2d_4_tf_tex(position) Anime4KSample0(position)
#define conv2d_4_tf_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_4_tf_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_4_tf_pos anime4k_pos
#define conv2d_4_tf_size float2(Anime4KInputSizes[0].xy)
#define conv2d_4_tf_pt rcp(conv2d_4_tf_size)

#define go_0(x_off, y_off) (max((conv2d_4_tf_texOff(float2(x_off, y_off))), 0.0))
#define go_1(x_off, y_off) (max(-(conv2d_4_tf_texOff(float2(x_off, y_off))), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.034357008, 0.00082413113, -0.13382089, -0.05066409, 0.26684088, -0.31363875, 0.073608615, 0.20824149, 0.21509308, -0.07118628, 0.11287014, -0.09817389, 0.16107765, 0.17146803, -0.13836654, -0.05962866));
    result += mul(go_0(-1.0, 0.0), float4x4(0.029981667, 0.08738892, 0.17735903, 0.15817277, 0.041752994, -0.20031185, 0.064203605, 0.48786053, -0.0033609737, -0.42522693, 0.058846988, 0.22180536, 0.17181319, 0.13097888, -0.059532285, 0.062227458));
    result += mul(go_0(-1.0, 1.0), float4x4(0.13188283, 0.07971828, 0.28278515, 0.038570832, -0.12815465, 0.29860008, -0.2785862, -0.07612298, -0.14369671, 0.12457525, 0.11982623, -0.018675303, 0.14936846, 0.1284789, -0.0042489986, 0.042810377));
    result += mul(go_0(0.0, -1.0), float4x4(0.2892425, -0.20834558, 0.07358541, -0.11190968, -0.16300741, 0.15674856, -0.04297203, -0.29218298, -0.036296643, -0.052267153, -0.22889943, -0.21203549, -0.03553075, -0.20343691, -0.07413655, -0.092966415));
    result += mul(go_0(0.0, 0.0), float4x4(0.2484468, -0.23412868, -0.070199326, 0.2061922, 0.5047224, -0.48216155, -0.5792768, 0.610787, 0.023935676, -0.040435325, -0.1238493, -0.09576053, -0.26183444, 0.14510648, 0.5365255, 0.5499143));
    result += mul(go_0(0.0, 1.0), float4x4(-0.058255754, 0.08133753, -0.18663554, 0.26190025, 0.26006857, -0.007619795, 0.14585225, 0.073580734, -0.0396066, 0.2821596, 0.31778112, -0.029853562, -0.19703479, 0.17809318, 0.21089044, -0.106730856));
    result += mul(go_0(1.0, -1.0), float4x4(0.20549655, -0.05962688, 0.1432124, 0.013446325, -0.19064854, 0.061387196, 0.1792527, 0.0010619498, -0.1456842, 0.18950678, -0.13990986, -0.37644413, -0.083257, -0.2937246, 0.032096215, 0.14719158));
    result += mul(go_0(1.0, 0.0), float4x4(-0.26601696, 0.4242341, -0.073702715, -0.3221337, 0.026037043, -0.0117916465, -0.024286825, 0.23183465, -0.030869482, -0.045915652, -0.040611852, 0.11372697, -0.25404635, 0.21859063, 0.13869432, 0.19651218));
    result += mul(go_0(1.0, 1.0), float4x4(-0.028276298, -0.11217159, 0.27144867, -0.010531775, 0.11032058, -0.09957206, 0.12570262, 0.14724332, 0.08758557, -0.11042305, 0.025948172, -0.010910802, -0.029466914, -0.041135952, -0.017091949, 0.05501236));
    result += mul(go_1(-1.0, -1.0), float4x4(-0.12688768, -0.19051413, 0.052141912, -0.13618521, -0.16320245, -0.1601866, 0.16207355, -0.023218745, 0.2103894, -0.06212745, -0.07042835, 0.0996637, -0.1763831, 0.13890013, -0.12125462, -0.105104685));
    result += mul(go_1(-1.0, 0.0), float4x4(0.10485512, -0.49283037, -0.504295, 0.009089699, -0.17389494, -0.12835866, 0.14188384, -0.22946316, 0.006298799, -0.0348454, -0.0852419, 0.17956656, -0.08088888, 0.35675287, 0.16014415, -0.055372503));
    result += mul(go_1(-1.0, 1.0), float4x4(-0.17157564, 0.1557075, -0.17681694, 0.14834762, -0.13708206, 0.101721555, 0.17070566, -0.22522852, 0.08100986, -0.23204406, -0.38926315, -0.13165781, 0.1040296, -0.045591615, 0.15745829, -0.10410621));
    result += mul(go_1(0.0, -1.0), float4x4(-0.20517144, 0.35896194, -0.0010962893, -0.18043008, -0.016253468, 0.035292216, 0.06781499, 0.015984116, -0.20261237, -0.28905126, 0.007414641, 0.008870292, 0.52166605, -0.0996688, -0.23151648, 0.2811893));
    result += mul(go_1(0.0, 0.0), float4x4(0.013482173, -0.04891998, -0.06094191, -0.14416319, -0.00087873987, 0.11979091, 0.06457245, -0.2305623, -0.1476981, 0.2634587, -0.058895197, -0.07394766, -0.27173743, 0.7530214, 0.037599873, 0.22086331));
    result += mul(go_1(0.0, 1.0), float4x4(-0.10357755, 0.23899554, 0.034912035, -0.14336212, -0.019786308, -0.085470654, -0.03096524, 0.108783185, 0.28971127, 0.24527478, -0.19110362, -0.49510127, -0.15574701, 0.10968643, -0.13727877, 0.04502924));
    result += mul(go_1(1.0, -1.0), float4x4(-0.10808282, -0.079148844, -0.3244773, -0.2210664, -0.0062175165, 0.1303082, 0.012592612, -0.38039228, 0.26899642, -0.16624425, -0.04438198, 0.42067865, -0.13381268, 0.03408099, -0.2999706, -0.3817641));
    result += mul(go_1(1.0, 0.0), float4x4(0.030872926, -0.26852018, -0.14650428, 0.16869825, -0.19185568, -0.06341456, 0.12261606, -0.26597574, 0.44865233, 0.21416639, 0.40359476, 0.12814924, 0.2542566, -0.23348318, -0.43142912, -0.35113996));
    result += mul(go_1(1.0, 1.0), float4x4(-0.03364283, 0.11002299, 0.3311268, -0.14580412, -0.10348537, 0.13331696, -0.0793144, -0.04116661, 0.040704627, -0.14875266, -0.09259674, -0.062087066, 0.063962296, 0.18420577, -0.085616685, -0.16555141));
    result += float4(-0.037546165, -0.015675364, 0.13989694, 0.027605768);
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
