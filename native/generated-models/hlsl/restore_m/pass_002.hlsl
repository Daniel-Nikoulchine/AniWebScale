// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_M.glsl:76
// Pass: 002 - Anime4K-v4.0-Restore-CNN-(M)-Conv-4x3x3x8
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

#define conv2d_1_tf_tex(position) Anime4KSample0(position)
#define conv2d_1_tf_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_1_tf_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_1_tf_pos anime4k_pos
#define conv2d_1_tf_size float2(Anime4KInputSizes[0].xy)
#define conv2d_1_tf_pt rcp(conv2d_1_tf_size)

#define go_0(x_off, y_off) (max((conv2d_1_tf_texOff(float2(x_off, y_off))), 0.0))
#define go_1(x_off, y_off) (max(-(conv2d_1_tf_texOff(float2(x_off, y_off))), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.31543177, 0.23095237, -0.06692611, -0.5867763, 0.003622504, 0.17948842, -0.14627707, 0.1745016, -0.052964583, -0.15551159, 0.05644786, -0.012665164, 0.13107763, 0.11369179, -0.09452995, -0.11973403));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.2694661, -0.115382135, 0.3073268, -0.067228466, -0.25511482, -0.13922207, 0.36758214, -0.18821828, -0.022617863, 0.20333402, -0.11125889, 0.3552245, -0.013346653, -0.099095374, -0.25100616, 0.35521755));
    result += mul(go_0(-1.0, 1.0), float4x4(0.011012409, -0.13675085, 0.25642, -0.34851208, -0.23184675, 0.18012202, 0.57654136, 0.103173524, -0.16461405, 0.038177088, 0.1234096, 0.013202029, -0.19033363, 0.07469178, -0.017948546, 0.15287702));
    result += mul(go_0(0.0, -1.0), float4x4(-0.05340533, 0.23797482, 0.20351392, -0.05333351, -0.12181174, -0.23363493, -0.20696607, 0.109941036, -0.11519453, 0.13842066, -0.10687832, 0.29040006, 0.022218632, 0.031238724, 0.2685182, 0.15300068));
    result += mul(go_0(0.0, 0.0), float4x4(0.22985318, -0.3103802, -0.22916415, 0.25238806, -0.11690287, -0.1947488, 0.118020535, 0.07814263, -0.06335474, -0.007870727, 0.076106325, 0.094677486, -0.16776285, -0.006570437, -0.29589584, 0.41413507));
    result += mul(go_0(0.0, 1.0), float4x4(0.43607962, -0.36456433, -0.123776875, -0.16634953, -0.091190875, 0.13035081, 0.28627968, 0.27249968, 0.12356344, -0.008616177, 0.09599816, -0.006144557, -0.23490307, 0.3013123, 0.14153156, 0.21837278));
    result += mul(go_0(1.0, -1.0), float4x4(0.060364585, 0.37860224, 0.039182413, -0.22805426, -0.089910224, -0.06817697, -0.2684275, -0.12528503, 0.036934495, -0.07826616, 0.06559976, -0.08253646, 0.13489649, 0.06237663, 0.126376, 0.21194184));
    result += mul(go_0(1.0, 0.0), float4x4(-0.12534817, 0.21225189, -0.27818045, -0.3070443, -0.006957577, -0.025105853, 0.12100924, -0.06916452, 0.23081483, 0.1802756, -0.18995638, 0.16603014, -0.2904096, -0.25292823, -0.21834068, 0.13719653));
    result += mul(go_0(1.0, 1.0), float4x4(0.017209655, 0.10757137, 0.21414296, -0.30885983, 0.10467716, -0.2184891, 0.100061476, -0.1527528, 0.2100472, -0.25768545, -0.22329919, -0.29153427, -0.06983842, -0.103854865, -0.051384352, 0.14629121));
    result += mul(go_1(-1.0, -1.0), float4x4(0.0059623295, -0.26060802, 0.32115817, 0.021025505, 0.09783085, -0.15865178, 0.1473021, -0.24977303, -0.033508282, 0.17480391, -0.091310136, 0.09870876, 0.10504043, -0.06105686, 0.013493489, -0.11278855));
    result += mul(go_1(-1.0, 0.0), float4x4(0.14875248, -0.14859414, 0.19377062, -0.17456068, 0.101288855, -0.1113682, -0.48944646, 0.1018565, -0.037392337, 0.08539691, 0.1751306, -0.15428723, -0.059375558, 0.027663672, 0.051804014, -0.049813222));
    result += mul(go_1(-1.0, 1.0), float4x4(0.118846565, -0.19869871, -0.037388258, 0.08456728, -0.11662527, -0.43818352, -0.093285345, 0.038507205, -0.051991668, 0.21008292, 0.10792365, 0.2020924, 0.057021596, 0.09460527, 0.0016551288, -0.0015957063));
    result += mul(go_1(0.0, -1.0), float4x4(0.11062174, -0.2639232, -0.060295466, -0.3217331, -0.050545212, 0.30989558, 0.30906132, 0.030323273, 0.028986752, 0.037429404, 0.20855664, -0.19848943, 0.034687653, -0.09599135, -0.06250494, -0.13215867));
    result += mul(go_1(0.0, 0.0), float4x4(-0.010391146, 0.07657845, 0.44491258, 0.0435906, 0.0075931503, 0.42632654, 0.47022533, 0.34737435, -0.15452717, -0.14613411, -0.45231065, 0.12094409, 0.0067911847, 0.057501152, 0.09876979, 0.044946447));
    result += mul(go_1(0.0, 1.0), float4x4(-0.15607435, 0.2293058, -0.09520331, 0.012836732, -0.15282455, 0.26437718, -0.1685477, -0.13211122, -0.055801593, -0.016778728, -0.34478986, -0.23228309, 0.12300962, -0.13235827, -0.13987203, -0.16550972));
    result += mul(go_1(1.0, -1.0), float4x4(0.13161735, -0.09039346, -0.033475474, -0.23686698, 0.1514885, 0.20977421, 0.031431954, -0.0049226107, 0.090661936, 0.15288061, -0.03316583, 0.09646573, -0.32651708, 0.18825398, -0.15777239, 0.17572704));
    result += mul(go_1(1.0, 0.0), float4x4(0.112157226, -0.08712878, 0.23453182, 0.1043877, -0.14686783, 0.28682423, -0.086443506, 0.059457052, -0.31530112, -0.2700583, -0.06028952, -0.070416875, 0.18053482, 0.16653341, 0.25215197, 0.061915852));
    result += mul(go_1(1.0, 1.0), float4x4(-0.20122242, 0.076313145, -0.0988483, 0.094337784, -0.35436687, 0.3762327, -0.07809558, 0.3055848, 0.10425242, -0.17087407, 0.030301496, -0.13911743, 0.01630275, 0.24247427, -0.006474477, 0.03842641));
    result += float4(-0.008952847, -0.0058945753, -0.08097229, 0.020968592);
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
