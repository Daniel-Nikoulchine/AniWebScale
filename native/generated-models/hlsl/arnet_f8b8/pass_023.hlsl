// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:713
// Pass: 023 - ARNet F8B8 body block 5 conv 0 8x8x3x3 part 1
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
    float4 result = float4(1.2006547, -0.76820517, -2.0597777, 0.95814586);
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.023835193, 0.02868863, -0.4159934, 0.023311906, 0.09059788, -0.13395892, -0.41526058, -0.49424654, 0.23982197, -0.15573102, -0.40900466, 0.08666509, 0.21935421, -0.18455563, -0.17212828, -0.16867422));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.83510256, 0.047612153, -0.5498838, 0.6235987, 1.2127863, 0.4425549, -0.3835388, -0.2888839, 0.6356662, -0.0509376, -1.1574352, 1.0563087, 1.2494093, 0.55574054, 0.12285917, -0.53150266));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, -1.0)), float4x4(-0.26079363, 0.06689983, -0.119846895, 0.26423252, -0.18404655, 0.086668484, 0.2722664, -0.35897648, -0.105960354, -0.5829636, -0.70718426, 0.24724922, 0.18658821, -0.0969717, 0.16938284, -0.3434021));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.29709825, -0.19676633, -0.6406741, 0.35146573, 1.243116, 0.57329303, 0.41294158, 0.48059252, 0.8580821, 0.75516254, -0.12608159, 0.91177917, 1.0978297, 0.6842077, 0.18831506, 0.6367605));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(-0.98063266, -0.7489745, 0.96674293, 0.46362934, -4.1772156, -1.0290676, 3.0705726, 0.18449116, -3.0628552, -0.425118, 0.41649273, 1.0381409, -6.370245, -2.1644013, 3.4084568, 3.06074));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.19809496, 0.16867584, -0.2995225, 0.2958847, 1.3439282, 0.86064744, 0.53773326, -0.11597638, -0.21482988, -0.89389366, -0.43609017, -0.22125085, 1.64553, 0.58753735, 0.1659468, -0.69211334));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.06360847, -0.03917148, 0.5017174, 0.34238574, 0.2702507, 0.10583678, -0.7258614, -0.26900405, 0.19424221, 0.15496589, -0.16718695, -0.14096792, 0.29186767, -0.07390132, -0.7346488, -0.12712829));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.068655156, -0.12874061, 0.0913393, 0.30379537, 1.7621982, 0.058302116, -3.031778, -0.48805258, 0.7255528, 0.40272018, -0.7350988, -0.9333667, 1.173162, 0.73253566, -1.470374, -1.8503289));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.006594521, -0.21098159, 0.084682755, -0.008686722, 0.5137178, 0.13777664, 0.30352908, -0.219293, 0.11600745, -0.085922204, 0.45351556, -0.18694398, 1.2181557, 0.012092962, -0.13723779, 0.04361504));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.12602764, -0.20481916, 0.33920175, 0.24072777, -0.02863777, 0.052338127, 0.29273346, -0.46707985, -0.022906976, 0.026299462, 0.18201785, -0.30661848, 0.041543823, -0.1584705, 0.08508168, -0.81906545));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.024434417, 0.061784863, 0.052340094, 0.43865696, 0.110340394, 0.16806906, 0.5042281, -0.8710482, 0.11542953, -0.08342036, -0.11005213, -0.49494845, -0.07593905, 0.194124, 0.37646657, -0.3262979));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, -1.0)), float4x4(-0.22806363, 0.019043187, -0.18875842, 0.15921485, 0.18509483, 0.17250629, 0.29044634, -0.27414843, -0.041633267, -0.11713727, -0.14473298, 0.01254031, -0.04207783, 0.17033952, -0.08242725, 0.1446008));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.005597999, -0.46521336, -0.38566017, 0.37738693, -0.8700005, -0.49009287, 0.48134613, 0.3093738, -0.13038984, -0.16632962, 0.08929966, -0.12169679, -0.048244763, -0.8866835, 0.9241081, 0.030777989));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.21365774, 0.41449386, -1.1417267, 0.07642092, 1.5311366, 0.8169457, -0.80470663, 0.71717376, -0.07555424, 0.63815016, -0.41808832, 0.6034165, 0.6609413, 0.4827314, -0.3885176, -0.04645717));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 0.0)), float4x4(0.51741904, 0.06558463, -0.61781096, 0.16105425, 0.13628171, -0.06541878, -0.37788498, 0.363023, 0.07602596, 0.1616807, -0.23769565, -0.11367621, -0.062612556, 0.08790764, -0.09159898, 0.058623064));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(-0.1653634, -0.3673317, 0.09483161, 0.15531836, 0.13220912, 0.13533735, -0.08962283, -0.071986675, -0.04719903, 0.18866725, 0.5737308, -0.16545181, -0.37324467, -0.28905943, 0.5862764, 0.091752894));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.347256, -0.18466562, -0.074820265, 0.47538248, -0.4519587, -0.028231848, 1.3886279, 0.1945927, 0.35695443, 0.26455438, -0.5974403, -0.018772539, 0.57782996, 0.24760665, -0.78987503, 0.13440683));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 1.0)), float4x4(0.06313024, 0.050962944, 0.19640225, 0.18274099, -0.14383908, 0.06318269, -0.39767545, 0.08390649, -0.29790193, -0.08737098, 0.19714376, -0.0059051714, 0.014293125, 0.09729602, 0.07021776, 0.30328184));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(0.2905794, -0.6173026, 0.4186367, -0.28825378) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
