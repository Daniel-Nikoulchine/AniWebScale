// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:938
// Pass: 030 - ARNet F8B8 body block 7 conv 0 8x8x3x3 part 0
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
    float4 result = float4(2.0462847, -0.11219312, -1.6490123, -1.9170899);
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(0.15607865, 0.35267335, -1.3737147, 0.32218546, 0.11755553, 0.003691563, -1.4922762, -1.2631297, 0.08787166, 0.12372408, -0.7342867, 0.28860277, 0.2760142, -0.116696954, -0.32609242, -1.326374));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, -1.0)), float4x4(0.6511391, 0.095825374, -0.15921989, -2.8853803, 0.11771083, -0.07010077, -0.9249247, -5.378057, 0.37890106, 0.20785524, 0.8931742, 0.5004331, -0.5358744, -0.18710028, 0.49356616, -4.0662613));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.07315643, -0.03882542, -0.14743559, -1.3347683, 0.23623951, -0.11013279, 0.27068904, -1.3073405, -0.24901079, 0.03920325, 0.30956146, 1.1079919, -0.22557108, -0.07443831, 0.44510287, 0.22800167));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.126861, 0.19422108, -0.7879277, -0.25876293, -0.56880945, 0.2105336, -1.6851811, -0.26354983, -0.121982984, 0.91283315, -0.27912614, 0.7486533, -0.21718523, 1.1795537, -0.7109484, 2.027691));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 0.0)), float4x4(1.2172973, -0.37437215, 0.31787908, -0.06740857, 2.1240592, -0.06941831, 0.31800023, 4.955131, 0.68205196, -1.2142785, 0.33341545, 1.6111822, 0.5833697, -2.3475726, 1.0190853, 5.5795803));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.20708214, 0.65108466, -0.078989886, 0.7982509, -0.09171008, 0.50312483, 0.17936742, 1.8149515, -0.512222, -0.17843723, 0.14793509, 0.59602207, -1.339343, -0.32929862, -0.14999168, 1.1079564));
    result += mul(TMP2_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.06879609, -0.05721643, -0.03891659, -0.4023711, 0.089908175, 0.24820426, -0.16934407, -0.24213219, -0.11310552, 0.2087966, -0.12053623, -0.78251266, -0.24591826, 0.8602068, -0.13679679, -0.80236465));
    result += mul(TMP2_TEX_0_texOff(float2(0.0, 1.0)), float4x4(0.44172314, 0.39952478, -0.22154222, -0.09700893, 0.47743398, -0.13618703, -0.28161496, -1.9709138, 0.40586784, -0.17647928, -0.0882408, -1.0030979, 0.22465938, -0.774978, -0.2915923, -1.9338871));
    result += mul(TMP2_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.15783711, -0.04935261, 0.06430404, -0.53719836, 0.18528137, -0.029198658, 0.13966013, -1.1365119, -0.099208824, -0.22169802, -0.015248189, -0.53681475, -0.11529773, -0.7462468, 0.08082599, -0.85225725));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.027436903, 0.14631188, 1.1058605, 1.0638692, -0.15087396, -0.3071218, -0.34183934, 0.39348298, -0.1934475, -0.06411496, -1.1069056, 0.1164807, 0.092689306, -0.015499394, -1.4902277, -0.06795321));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, -1.0)), float4x4(-0.36748806, 0.11028987, -2.3969402, 2.020117, 0.4504527, -0.39015007, 0.32381, 1.1560608, 1.0650486, -0.019698175, -0.36302748, -0.15668292, 0.74848616, -0.049065065, 0.12697218, -1.8943124));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.47808665, 0.0049874093, 0.5474891, 0.009583937, -0.14097133, -0.03293571, -0.47313496, 0.23947519, -0.043680847, -0.031438734, 0.06521791, -0.04881507, -0.065110035, -0.2534525, -0.068148516, -0.456197));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.2008805, -0.0728396, -0.25652453, -0.21836653, 0.31070578, -0.93721604, 0.5261313, -0.11475825, 0.006167654, -0.46799326, -0.48652115, -0.82207495, -0.0022950845, -0.07513531, -0.653415, -0.4589432));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.29965052, 0.537413, 0.16983996, 1.0412931, -0.40131727, 1.1035032, -0.5835695, -2.323563, 0.7929367, 1.1954131, 0.23677117, -0.39085746, 0.97820926, -0.080946594, 0.50531137, 1.7228105));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 0.0)), float4x4(0.49206054, 0.36706758, 0.2936022, 1.7349542, -0.060394973, -0.1279301, -0.32614252, -0.66824406, 0.19163208, -0.082251534, -0.0064288895, 0.40870062, -0.12377748, 0.040894452, 0.038819343, 0.73899317));
    result += mul(TMP2_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(-0.044306, -0.062695846, 0.039909396, -0.22670346, 0.13098416, -0.42855734, 0.09184677, 0.38078657, 0.0640689, -0.2527821, 0.13553435, 0.284348, 0.06388198, -0.2772798, 0.102035075, 0.57936686));
    result += mul(TMP2_TEX_1_texOff(float2(0.0, 1.0)), float4x4(0.15687542, 0.031288132, -0.36979502, -0.55329597, 0.080002934, 0.33145523, 0.1639076, 1.1676154, 0.21886808, 0.6708341, -0.080738455, 0.24509303, 0.08882907, 0.08260267, 0.11186156, 0.122697815));
    result += mul(TMP2_TEX_1_texOff(float2(1.0, 1.0)), float4x4(0.17760587, 0.26807213, 0.19118945, -0.793851, -0.12514982, -0.093280815, -0.16982462, 0.64567155, 0.08103222, 0.10585265, -0.067149885, -0.22529025, 0.17142996, -0.009839994, 0.0018546148, -0.35490608));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(-2.5093217, -0.4825146, -0.3387328, -0.066156216) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
