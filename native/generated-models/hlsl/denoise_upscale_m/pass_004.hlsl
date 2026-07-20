// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Upscale+Denoise/Anime4K_Upscale_Denoise_CNN_x2_M.glsl:142
// Pass: 004 - Anime4K-v3.2-Upscale-Denoise-CNN-x2-(M)-Conv-4x3x3x8
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

#define conv2d_3_tf_tex(position) Anime4KSample0(position)
#define conv2d_3_tf_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_3_tf_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_3_tf_pos anime4k_pos
#define conv2d_3_tf_size float2(Anime4KInputSizes[0].xy)
#define conv2d_3_tf_pt rcp(conv2d_3_tf_size)

#define go_0(x_off, y_off) (max((conv2d_3_tf_texOff(float2(x_off, y_off))), 0.0))
#define go_1(x_off, y_off) (max(-(conv2d_3_tf_texOff(float2(x_off, y_off))), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(go_0(-1.0, -1.0), float4x4(-0.17903937, -0.0014294779, 0.1824805, -0.19555633, -0.0052551827, -0.013796094, 0.06358042, 0.13301018, 0.008874768, 0.06605332, 0.06117636, 0.012946474, 0.048656575, 0.0060409275, -0.0671362, -0.06897735));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.16098012, 0.10772552, -0.13175552, -0.5299018, 0.068713695, -0.048258893, -0.49698257, 0.36581638, 0.21755004, -0.12125899, -0.27382872, -0.12268086, 0.014334542, 0.20573758, 0.45879167, -0.29648975));
    result += mul(go_0(-1.0, 1.0), float4x4(0.06860283, -0.18047708, 0.024707617, 0.11900479, 0.09474589, -0.16559775, -0.054095846, -0.011377782, -0.008733984, 0.105020404, -0.040116277, -0.0022003972, 0.1453799, -0.032110006, -0.018741792, -0.12511599));
    result += mul(go_0(0.0, -1.0), float4x4(0.20024729, -0.01969923, -0.026999667, -0.39064395, -0.14559332, -0.11634086, -0.13226044, 0.11779975, -0.08838282, -0.0882447, -0.23166943, -0.15760234, 0.030928904, -0.032423917, 0.20324136, -0.19692755));
    result += mul(go_0(0.0, 0.0), float4x4(0.49499384, 0.7327846, -0.6173799, -0.53821295, -0.15000962, 0.11169762, 0.6942423, 0.07956513, 0.06913002, -0.19037646, -0.19826908, 0.68080276, -0.2747096, -0.15832238, 0.47366706, 0.090432756));
    result += mul(go_0(0.0, 1.0), float4x4(-0.18274948, 0.09204629, 0.16644076, 0.05641037, 0.03328184, -0.6218293, 0.26432592, -0.093742386, 0.33038342, -0.24853565, -0.23683667, -0.37430722, -0.20684583, -0.32283148, -0.07633969, -0.08765815));
    result += mul(go_0(1.0, -1.0), float4x4(0.06821987, 0.06395764, -0.14685121, -0.15894371, -0.093540885, 0.057568345, -0.048376244, -0.009256543, -0.26325077, -0.03193119, -0.16857445, -0.02404981, 0.110593356, 0.042911418, 0.06626762, -0.0312436));
    result += mul(go_0(1.0, 0.0), float4x4(0.3108626, 0.37123847, -0.082249805, -0.21339422, -0.3756041, -0.08518717, -0.16853802, 0.011641729, -0.30096757, 0.26942274, -0.08990497, -0.19451031, 0.21974437, -0.04231723, 0.26160353, -0.040834647));
    result += mul(go_0(1.0, 1.0), float4x4(0.11795158, 0.24436565, 0.043223023, -0.0159957, -0.19689156, 0.13223267, -0.013983249, 0.09437164, -0.47648698, -0.00082660443, -0.085406005, 0.10885898, 0.104696035, -0.053257108, 0.024389362, 0.0282572));
    result += mul(go_1(-1.0, -1.0), float4x4(0.032890156, 0.0115719065, -0.01898909, -0.03034875, -0.041037276, -0.1026382, 0.03337663, 0.20108728, -0.00023235095, -0.018033072, -0.028535927, 0.07359915, 0.075182244, 0.02959868, 0.15107772, -0.09815672));
    result += mul(go_1(-1.0, 0.0), float4x4(-0.004040557, 0.06707476, 0.039022792, 0.52437925, -0.08027356, 0.040488366, 0.035332825, 0.07683081, -0.03521227, -0.081861034, 0.090804815, 0.10580108, 0.20452882, -0.58755285, 0.04303056, 0.41562977));
    result += mul(go_1(-1.0, 1.0), float4x4(0.09290062, 0.03495193, 0.02347216, -0.012873525, -0.076936446, 0.1453216, -0.03742271, -0.14174925, -0.058219753, 0.19095406, 0.055627216, 0.09437343, -0.010424211, -0.314692, 0.3314579, -0.053285643));
    result += mul(go_1(0.0, -1.0), float4x4(-0.053961687, 0.1483992, 0.042458896, -0.1966439, 0.13864957, 0.07587672, -0.06519269, 0.09530391, 0.04215073, 0.039545458, 0.21056756, 0.09972659, 0.02987125, -0.08102741, 0.07075036, 0.21867757));
    result += mul(go_1(0.0, 0.0), float4x4(-0.5512795, 0.03104814, 0.27901977, 0.122875504, -0.2656715, 0.007895486, -0.6735937, 0.20810314, -0.31432617, 0.07420857, 0.2573659, -0.35361463, 0.19826569, -0.47774056, 0.15816487, -0.29203883));
    result += mul(go_1(0.0, 1.0), float4x4(0.35078493, -0.07371588, -0.026663188, -0.20976657, -0.009644347, 0.037428845, -0.33933878, -0.010807704, 0.088060796, 0.16753472, -0.12296045, 0.17563403, 0.1501952, 0.07353703, 0.32531765, 0.11667607));
    result += mul(go_1(1.0, -1.0), float4x4(0.096126616, -0.058021486, -0.03439203, 0.06868024, 0.047914367, 0.026945053, 0.04207778, 0.046023168, 0.16024022, 0.07846185, 0.004195093, 0.07272046, -0.10458233, -0.0904536, 0.16049337, 0.015941419));
    result += mul(go_1(1.0, 0.0), float4x4(0.032256138, -0.055398785, 0.079738356, 0.113359064, 0.11975066, -0.074372105, 0.102006756, -0.011490042, 0.15155345, 0.0025528704, 0.23328577, -0.059241068, -0.067783386, -0.18220833, 0.0057692174, 0.039900843));
    result += mul(go_1(1.0, 1.0), float4x4(-0.06173998, -0.07121991, -0.01118306, -0.063749574, -0.032665797, 0.0014987896, 0.03113169, 0.06916617, 0.0066490914, -0.052818965, -0.050131317, 0.10337558, -0.030870482, -0.14671221, 0.12152145, -0.05003445));
    result += float4(-0.010524109, -0.008519857, -0.08958723, -0.07917139);
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
