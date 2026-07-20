// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/Restore/Anime4K_Restore_CNN_Soft_M.glsl:107
// Pass: 003 - Anime4K-v4.0-Restore-CNN-Soft-(M)-Conv-4x3x3x8
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

#define conv2d_2_tf_tex(position) Anime4KSample0(position)
#define conv2d_2_tf_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_2_tf_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_2_tf_pos anime4k_pos
#define conv2d_2_tf_size float2(Anime4KInputSizes[0].xy)
#define conv2d_2_tf_pt rcp(conv2d_2_tf_size)

#define go_0(x_off, y_off) (max((conv2d_2_tf_texOff(float2(x_off, y_off))), 0.0))
#define go_1(x_off, y_off) (max(-(conv2d_2_tf_texOff(float2(x_off, y_off))), 0.0))
float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = mul(go_0(-1.0, -1.0), float4x4(0.07447851, -0.07888509, -0.28236163, 0.2479792, -0.065199964, 0.24733023, 0.099619575, -0.26430824, -0.03523585, -0.03547245, -0.10619345, -0.25326422, -0.116270036, -0.065133184, -0.30401528, 0.01563764));
    result += mul(go_0(-1.0, 0.0), float4x4(-0.19106275, -0.26104823, -0.14457102, -0.17298317, 0.24148639, -0.10950928, 0.062851585, 0.042540826, 0.13287601, 0.06975747, 0.15848075, -0.3854902, -0.13132331, -0.16468687, -0.029844414, 0.27754608));
    result += mul(go_0(-1.0, 1.0), float4x4(0.015378025, -0.14203559, 0.08058816, 0.32896644, -0.074871175, -0.26611313, -0.18830848, 0.091641426, -0.16522385, -0.23424402, -0.12279703, -0.13343342, -0.2509982, -0.0554576, 0.07286022, -0.028823337));
    result += mul(go_0(0.0, -1.0), float4x4(-0.13543738, 0.049395677, -0.015148539, 0.13301241, -0.12827122, -0.012590744, 0.012936948, 0.008271658, 0.12442749, 0.3497426, -0.16126058, -0.2670464, -0.010479037, 0.07037434, -0.15527055, 0.13205245));
    result += mul(go_0(0.0, 0.0), float4x4(-0.09535385, -0.3931354, 0.24716614, -0.21284536, 0.14652656, 0.38149378, -0.09607391, 0.06350967, 0.48615915, 0.32634613, 0.146291, 0.2566475, -0.40927815, -0.05268087, -0.04110691, -0.0068722935));
    result += mul(go_0(0.0, 1.0), float4x4(0.089152284, -0.01860622, 0.016856732, 0.31244752, 0.022529159, -0.0071319416, -0.09786801, -0.13005258, 0.1524636, 0.21627748, -0.07395979, -0.087633945, -0.38435504, -0.08842507, -0.0058702417, -0.32936293));
    result += mul(go_0(1.0, -1.0), float4x4(0.0816838, 0.0012210817, 0.28217188, 0.36141106, 0.0014665248, -0.0636269, 0.042035818, -0.056671552, -0.032501306, -0.22908778, -0.2067977, -0.004497514, -0.23052917, 0.26728114, 0.15353456, -0.17732324));
    result += mul(go_0(1.0, 0.0), float4x4(-0.17229734, 0.0818218, -0.10076918, 0.030027041, -0.14819005, -0.085340135, 0.050100215, 0.05683199, -0.12653661, -0.036583595, -0.32319903, -0.15273796, -0.15346588, 0.20005536, 0.23097478, -0.19834782));
    result += mul(go_0(1.0, 1.0), float4x4(0.055430107, -0.2886931, 0.361814, 0.33160287, -0.084407054, 0.06254009, -0.02332793, -0.018134018, -0.014879812, 0.112346604, -0.20686437, -0.23408228, -0.01091196, -0.062669374, 0.085567676, 0.23738655));
    result += mul(go_1(-1.0, -1.0), float4x4(0.080383554, -0.1172084, 0.19703126, 0.27777427, -0.07559937, -0.25445858, 0.3450109, -0.071967736, 0.2034805, 0.33716002, 0.15314537, -0.22953224, 0.113631405, -0.0058444734, 0.2890972, 0.06557255));
    result += mul(go_1(-1.0, 0.0), float4x4(-0.17646056, -0.025448758, -0.14952567, 0.017148364, -0.15238142, 0.1435677, 0.20273875, 0.22255951, -0.011660059, -0.003515217, -0.17305166, -0.13478355, -0.06558679, -0.032662887, -0.20914736, -0.5397283));
    result += mul(go_1(-1.0, 1.0), float4x4(0.1679393, -0.109410115, -0.117427185, 0.14982319, -0.06457877, -0.06607065, 0.0018200208, -0.0118605625, 0.046539318, -0.020642165, -0.14413542, -0.09530688, 0.22196163, -0.2187166, -0.10759705, 0.013234591));
    result += mul(go_1(0.0, -1.0), float4x4(-0.13220267, -0.12540027, 0.26163217, 0.12791659, 0.16204996, -0.4023048, -0.13485721, -0.10187536, 0.059764992, 0.048170995, -0.25281772, 0.2090587, -0.06542371, -0.10791867, -0.21286209, -0.309109));
    result += mul(go_1(0.0, 0.0), float4x4(0.16233061, 0.120428756, -0.11460241, 0.24531102, -0.2670459, -0.24195078, -0.20964348, -0.12930301, -0.2343609, -0.22543164, -0.28909695, -0.33560297, 0.6009884, 0.39171818, -0.1276308, -0.020736236));
    result += mul(go_1(0.0, 1.0), float4x4(0.40162864, 0.045881115, 0.032667033, 0.31454235, -0.17351128, -0.009387306, 0.17341217, 0.30810982, -0.025815086, -0.10390133, 0.012544771, 0.036918722, 0.34386298, 0.23177734, -0.046727546, 0.20098232));
    result += mul(go_1(1.0, -1.0), float4x4(0.11541034, -0.11647824, -0.12874861, 0.004921287, -0.13921295, -0.25733355, -0.1112383, -0.033295818, 0.0035326157, 0.3782048, 0.055785846, -0.1547331, 0.17358719, -0.2789715, -0.13400431, 0.1583795));
    result += mul(go_1(1.0, 0.0), float4x4(0.4130191, -0.33944547, -0.064674884, 0.39617148, -0.11483455, -0.022601767, 0.1129301, -0.09713594, 0.14681247, 0.34442267, 0.08721343, -0.08309499, 0.088704996, -0.20943391, -0.2891408, 0.1709401));
    result += mul(go_1(1.0, 1.0), float4x4(0.19503653, 0.17490312, -0.23491044, -0.028934423, 0.04479765, -0.0334551, 0.0602648, 0.0019939998, 0.23314747, 0.21557438, 0.07273092, 0.15467109, -0.11194509, 0.0736583, -0.17628083, -0.3851578));
    result += float4(0.022887055, 0.01521631, 0.17967467, -0.0131908795);
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
