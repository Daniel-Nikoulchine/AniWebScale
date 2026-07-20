// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:810
// Pass: 026 - ARNet F8B8 body block 6 conv 0 8x8x3x3 part 0
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
    float4 result = float4(-0.078882426, 0.67293566, -1.8725522, -0.35481817);
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.048987232, 0.15745749, 0.25099227, -0.074852206, 0.021303013, -0.14970013, -0.29306346, -0.15654267, 0.08911421, -0.0032929173, 0.21172082, -0.14649306, -0.10383788, -0.009043249, -0.24579711, -0.22501554));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.5379519, -0.18044806, -0.85086685, -0.89000684, -0.022164831, -0.47879487, -0.5778583, -0.68558687, -0.24978879, -0.21391197, -0.4576681, -0.40824777, -0.2481923, -0.06533678, -0.16487193, -0.80717605));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.31600624, 0.19851972, 0.09073826, 0.17587164, -0.18661296, -0.025030667, 0.59166944, -0.14681107, -0.03880862, 0.1235565, 0.34310788, 0.054664407, -0.36798814, 0.15668999, 1.2822167, -0.062311277));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(-0.308775, 0.031747505, 0.46294525, 0.18400754, -0.24034989, 0.51761764, -0.12766917, 0.32443368, -0.22487862, -0.04424502, 0.70857596, 0.08371119, 0.030590981, 0.008456653, 1.3911426, 0.3553807));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(1.1069001, -0.41327822, -2.2775545, -0.36605048, 0.14953217, 2.0054028, -4.5269976, -0.38812023, 0.0050729625, -0.42460036, 0.98488945, 0.77855986, 0.7025796, 0.5927354, -3.0242772, 1.8783767));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.47599703, 0.22429758, 0.21005248, -0.8721516, 0.70637876, 0.11048473, 0.8337147, -1.5313064, -0.22681521, -0.05103301, 0.301267, -3.121116e-05, 1.0269359, 0.28226182, 1.0006084, -1.076919));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.04638692, 0.1267907, -0.7187657, 0.34577376, 0.38205236, -0.14948612, -1.0120579, 0.14901365, 0.1543922, 0.024277361, -0.5135638, 0.29120052, 0.18193202, -0.17146954, -0.2118541, 0.26207557));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.053274952, 0.27122733, -1.2347833, 0.52826, 0.2609727, -0.23484226, -0.7091357, 0.8059645, -0.022438798, 0.06665683, -0.17771405, 0.80595016, -0.061289303, -0.4561282, -0.21346036, 1.2975376));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.08663388, -0.009519002, 0.22907937, -0.2766272, -0.021485208, -0.07036672, 0.26254934, -0.05367535, -0.1529079, -0.051132437, 0.33928087, 0.017621474, -0.46344838, -0.37628916, 0.56027585, 0.049695533));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.050970014, -0.11046002, -0.110522166, -0.24315397, 0.11774171, 0.1131314, -0.10749513, 0.1409204, 0.12764949, -0.007428738, 0.15463307, 0.3263979, 0.06471069, 0.254575, 0.19600934, 0.02365695));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.0955529, -0.40494868, 0.022293082, -0.21756056, -0.011867877, 0.5302262, -0.49153167, 0.37844074, -0.059192687, 0.25846478, -0.42882377, 0.14905328, -0.21581596, 0.1600305, -0.77061236, -0.35790363));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.026543776, -0.23274809, 0.04417913, -0.16912761, 0.15623638, 0.15871996, 0.046919275, 0.019395053, -0.013826784, -0.04819944, 0.08748753, 0.15603156, 0.02038308, 0.13164514, 0.10704472, 0.50112325));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.065972805, -0.24374852, 0.2572506, -0.34741375, 0.11612965, -0.06250733, -2.265568, 0.06853314, 0.011760828, 0.06821788, -1.6935511, 0.21765698, -0.0949019, -0.016500272, -1.7174871, 0.118924536));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.9478749, 0.08787377, -1.8256634, -0.0068533397, 0.6346608, -0.79785633, 0.09653203, 0.2682377, 0.5199457, 0.18709846, -1.1144141, -0.9687904, 0.77534175, 0.2326286, -0.2607076, -0.7949604));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.4907757, -0.25755483, -0.048781015, -0.77141446, 0.113269106, -0.08291928, -0.43598023, 0.31434005, 0.061531793, -0.016613815, 0.06883427, 0.43876606, 0.112988874, 0.060473584, -0.18008097, -0.114247486));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.007698554, 0.040035438, 0.03250089, -0.015869085, 0.06460985, -0.047974568, -0.31484082, 0.12988533, -0.033103626, -0.0073913834, -1.0113897, 0.20290199, 0.038294442, 0.06649487, -0.95250255, 0.3174623));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.26715145, -0.36429155, -1.0183138, 0.75705725, -0.26853016, -0.007983574, 0.26966172, -0.6540278, 0.15016799, -0.06065802, -0.71268433, -0.04800915, -0.074023455, 0.09312783, -0.5345079, 0.624992));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.1469338, -0.056489524, -0.15247604, 0.09453032, -0.065216705, 0.02963482, -0.38552, 0.0013730361, 0.033521548, 0.0044378014, -0.0031767576, 0.16427279, -0.045485005, -0.15002662, -0.21888222, 0.04875365));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(-1.8419428, -1.2471957, -0.2992609, -0.7501567) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
