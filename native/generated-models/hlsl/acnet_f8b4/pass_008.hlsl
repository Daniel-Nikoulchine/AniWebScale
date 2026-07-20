// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/acnet/acnet_f8b4.glsl:233
// Pass: 008 - ACNet F8B4 body block 4 conv 8x8x3x3 part 0
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
    float4 result = float4(-0.019490406, -1.6743133, -0.93567777, -1.2281146);
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.24782348, -0.08980136, 0.0018097524, -0.13141377, -0.012512337, 0.021311313, 0.112449706, 0.042859934, -0.063476406, 0.085147575, -0.23415025, -0.081214726, 0.0121166585, -0.09691721, 0.0033425398, 0.10797327));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.023887398, -0.017366953, -0.61107284, -0.44222757, 0.035325285, 0.18108203, -0.13357785, -0.038865633, -0.051288605, 0.030647164, -0.48711532, -0.06505241, -0.007763238, -0.05734227, 0.086753696, 0.13238049));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.019650584, -0.03789171, 0.025629915, -0.15634407, -0.027555874, 0.2244368, -0.013645936, 0.009576348, -0.012208033, -0.014009667, -0.11220604, -0.11477793, -0.02596127, 0.043400194, 0.073810436, 0.08026474));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.14146642, -0.07732169, 0.13021186, -0.23522885, -0.08199934, 0.08785389, -0.31814787, -0.017707039, -0.0070902645, 0.032928664, 0.03319977, -0.199459, 0.029538555, 0.019134568, 0.018578185, 0.09279536));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.4323895, -0.8258716, 1.3794013, -0.081178494, 0.27229223, 0.10026109, -0.17623687, -0.086668454, 0.22827616, 0.14764892, 0.024284422, -0.873994, -0.15777498, 0.24188122, 0.23461087, 0.6606238));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 0.0)), float4x4(-0.10511006, -0.15836114, 0.23639409, -0.055818688, -0.031791285, 0.07023537, -0.10440714, -0.07102799, 0.14913122, -0.095523186, -0.021141594, -0.27826294, -0.110699706, 0.019357864, 0.0015836249, 0.104444355));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.059740383, -0.10029774, 0.049508598, -0.026147569, -0.0035918672, 0.03684152, -0.022104638, 0.015340844, 0.026494505, -0.2678387, 0.3562214, -0.06945174, 0.011683991, 0.16305883, -0.10063249, 0.029397745));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.03860311, 0.23661718, -0.4691339, 0.21297826, -0.01842658, -0.032319773, -0.17688784, -0.039254006, -0.060019728, -0.86455333, 0.6656915, -0.29877442, 0.008708571, 0.34715346, -0.37146175, 0.15104792));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.014335585, 0.15172549, -0.10011923, 0.30925724, -0.014818751, -0.022050645, -0.027316075, 0.011499395, 0.040939715, -0.3414735, 0.05819778, -0.27786472, -0.04794211, 0.2666123, -0.103623405, 0.18143085));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.13186692, 0.06254903, -0.07746219, -0.18627138, -0.13078299, -0.018085798, -0.058870897, -0.1243098, 0.0843583, 0.049050365, -0.0070938114, -0.008991616, 0.05167723, -0.35787305, 0.86696905, -0.0929479));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.063394934, -0.083576456, 0.11647725, -0.21304731, 0.1523025, -0.07811621, 0.17729749, -0.19591023, 0.08845197, -0.1140758, 0.42653602, 0.16119374, 0.28347027, -1.2619284, 1.4372804, 0.42612097));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.011580718, -0.09484802, 0.15659209, -0.0253167, -0.029820768, -0.018512722, -0.017120779, -0.044583462, 0.027828902, 0.04569409, 0.044310108, 0.19272043, -0.026036184, -0.10627771, 0.687719, 0.13961898));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.01614682, 0.08804442, -0.13223612, -0.20699112, 0.19617794, 0.12163249, -0.24243152, -0.19484112, 0.14354938, -0.08147911, 0.0728143, -0.24154888, 0.31689802, 0.099283665, -0.96576864, -0.10187959));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.10721744, -0.25945505, -0.06371828, -0.11456746, -0.029011667, -0.013282517, -0.3264059, 0.4226834, 0.09800465, 0.12844312, -0.4547371, 0.488753, -1.937533, 1.8239374, -1.8656417, 0.22996137));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.078474954, -0.096864685, -0.0061462577, 0.051756274, -0.005532976, 0.14606367, 0.0417086, 0.18902011, -0.07504314, -0.021685172, -0.17500354, 0.2176458, 0.29421404, 0.2142051, -0.5942183, 0.059781097));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.027003568, -0.09522786, 0.025255388, -0.06957711, -0.020345952, -0.20852017, 0.23736343, -0.014580751, -0.13405661, -0.41066873, -0.45405096, -0.13360445, -0.020559402, 0.14396591, -0.23395982, -0.063573055));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.026639432, 0.22466315, -0.17636809, -0.013987894, 0.07354517, 0.12996125, -0.3133774, 0.19254716, -0.71698356, -0.96191573, -0.9064342, -0.12722583, 0.04551022, 0.20995703, -0.96772784, -0.21457885));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.026137505, 0.282344, -0.05316991, 0.17066807, -0.03365953, 0.22066733, -0.111462384, 0.19878498, -0.08377312, -0.088418454, -0.16189583, -0.106822975, -0.13830593, 0.27798, -0.31346092, -0.2766098));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(0.17883871, 0.23811656, 0.018245962, 0.6879279) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
