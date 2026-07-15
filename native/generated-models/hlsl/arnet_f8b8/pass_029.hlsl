// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:905
// Pass: 029 - ARNet F8B8 body block 6 conv 1 8x8x3x3 part 1
// ACNetGLSL is Copyright (c) 2020 TianZer, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[3];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
Texture2D<float4> Anime4KInput2 : register(t2);
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

float4 Anime4KTransform2(float4 value)
{
    return value;
}

float2 Anime4KClampUv2(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[2].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample2(float2 uv)
{
    return Anime4KTransform2(float4(Anime4KInput2.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv2(uv), 0.0)));
}

float4 Anime4KLoadOffset2(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[2].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform2(float4(Anime4KInput2.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent2(uint2 position)
{
    return Anime4KTransform2(float4(Anime4KInput2.Load(int3(position, 0))));
}

#define TMP1_TEX_0_tex(position) Anime4KSample0(position)
#define TMP1_TEX_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define TMP1_TEX_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define TMP1_TEX_0_pos anime4k_pos
#define TMP1_TEX_0_size float2(Anime4KInputSizes[0].xy)
#define TMP1_TEX_0_pt rcp(TMP1_TEX_0_size)
#define TMP1_TEX_1_tex(position) Anime4KSample1(position)
#define TMP1_TEX_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define TMP1_TEX_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define TMP1_TEX_1_pos anime4k_pos
#define TMP1_TEX_1_size float2(Anime4KInputSizes[1].xy)
#define TMP1_TEX_1_pt rcp(TMP1_TEX_1_size)
#define TMP2_TEX_1_tex(position) Anime4KSample2(position)
#define TMP2_TEX_1_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define TMP2_TEX_1_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define TMP2_TEX_1_pos anime4k_pos
#define TMP2_TEX_1_size float2(Anime4KInputSizes[2].xy)
#define TMP2_TEX_1_pt rcp(TMP2_TEX_1_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.33987415, -0.083352186, 0.06494322, -0.28443265);
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(0.28190246, 0.07537968, -0.08590864, 0.21206924, -0.13010387, 0.18632501, -0.2720231, -0.0024052027, -0.13289046, -0.018424837, -0.025139278, -0.012033205, -0.008879835, 0.16343926, -0.27065122, 0.01638307));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.09740503, 0.136656, -0.46381566, -0.093320675, 0.39644185, 0.012807492, 0.16250792, 0.024834922, -0.6151103, 0.3602127, -0.6666256, 0.15628284, 0.25544724, 0.2706129, -0.5270588, 0.27043948));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.08584245, 0.012133001, 0.034527466, -0.002464468, 0.08950243, 0.21228147, -0.20588641, 0.0167567, -0.15518722, 0.27525836, -0.38418016, 0.27170834, -0.03811346, -0.06496579, 0.044405464, -0.05612035));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.17467266, -0.20736872, 0.13258697, 0.101673596, 0.0049473215, 0.07875584, -0.00045635895, 0.0077313557, 0.071464255, -0.10523305, 0.105144955, 0.0035544746, -0.55258614, -0.024357187, -0.2805135, -0.17291659));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 0.0)), float4x4(-0.07861318, -0.13017333, 0.012274185, -0.09386703, 0.118028134, 0.04874888, -0.14558667, -0.43639296, -0.7242765, -0.39386585, -0.50450855, -0.12182636, -0.030461216, 0.49291056, -0.080965936, 0.22605455));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 0.0)), float4x4(0.20274316, 0.18339747, -0.10090526, 0.1142318, -0.031196464, 0.050827853, -0.3626977, -0.12793435, -0.4144293, -0.073055916, -0.403875, 0.2532815, 0.06964579, -0.09145512, 0.19793099, 0.07471081));
    result += mul(TMP1_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(-0.07595105, -0.03457095, -0.0041257055, -0.025731348, 0.101050474, -0.059887268, 0.09854263, -0.10982078, 0.15572476, 0.040946085, -0.017726084, 0.004797987, -0.06935334, 0.14463569, -0.039078563, 0.17987695));
    result += mul(TMP1_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.042093482, 0.07977347, 0.033285297, 0.10770632, 0.10620476, -0.17967248, 0.1859064, -0.15687221, -0.051062584, 0.06653922, -0.24425642, -0.035501298, 0.08149979, 0.16101192, -0.10716314, 0.00031937813));
    result += mul(TMP1_TEX_0_texOff(float2(1.0, 1.0)), float4x4(-0.053921547, 0.031738248, -0.030254371, 0.018730083, -0.04446359, -0.09256745, 0.1241079, 0.022765335, 0.020838656, 0.07556265, -0.01853581, 0.023542473, 0.08921594, 0.056839332, -0.12171257, 0.07492845));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(0.13873328, 0.066402204, -0.14114858, 0.10566176, -0.18866007, -0.0626313, 0.08513254, -0.07174962, 0.10252165, 0.1600985, -0.29166928, -0.043546174, 0.13628735, -0.18907955, 0.3687272, -0.20987795));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.40009898, 0.12862517, -0.23739463, 0.1226814, -0.1533635, 0.09977795, -0.027295876, 0.0021543866, 0.0111866165, 0.2993794, -0.3248662, 0.014756162, -0.3572815, -0.16380894, 0.29951423, -0.2833389));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.014624709, -0.02341658, 0.08782905, -0.091319725, -0.10198386, -0.18590526, 0.20783707, -0.13132358, -0.050852656, -0.1092487, 0.06252224, -0.12992899, -0.10612526, 0.046323635, 0.31803635, -0.18994391));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(0.23882136, 0.08459715, 0.019651433, 0.18730704, 0.03171182, -0.21323745, 0.263695, -0.08106912, -0.049162336, -0.075984195, -0.010062449, -0.179939, -0.12678508, 0.014946059, 0.05431699, -0.35488808));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 0.0)), float4x4(-0.091138475, 0.45231903, -0.511502, -0.6758923, 0.37697327, -0.07830497, 0.36831585, 0.38303018, -0.058614213, 0.20715787, -0.60520387, -0.7041287, 0.026295528, 0.31380528, 0.718873, -0.47286245));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 0.0)), float4x4(-0.16113712, -0.09161566, 0.24210936, -0.02079406, -0.24160266, 0.009898186, 0.11578824, -0.086513504, -0.10496777, 0.10095685, -0.23972808, -0.24890588, 0.07668474, -0.03338076, 0.12162612, -0.34144154));
    result += mul(TMP1_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(0.094716184, -0.032352887, 0.122923456, -0.05913741, 0.11221435, -0.050291, -0.08344376, -0.097239114, 0.009982188, -0.10386815, 0.08978413, -0.20907222, -0.10188885, -0.080123544, 0.18823113, -0.17425576));
    result += mul(TMP1_TEX_1_texOff(float2(0.0, 1.0)), float4x4(-0.14025342, -0.23783754, 0.103203386, 0.06664047, 0.08034709, -0.6617139, 0.39778167, 0.29704982, 0.0681288, 0.21015805, 0.012126556, -0.21067978, -0.1303179, -0.00066029164, 0.26508895, -0.36018333));
    result += mul(TMP1_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-0.028637504, -0.0021032651, 0.05981607, 0.035968807, 0.08112629, -0.15754013, 0.13502093, -0.07921566, -0.02272238, -0.12699547, 0.11893582, -0.17567387, -0.11476595, -0.08729239, 0.38514596, -0.28241792));
    result = result * 0.2 + TMP2_TEX_1_texOff(float2(0.0, 0.0));
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
