// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/arnet/arnet_f8b8.glsl:42
// Pass: 002 - ARNet F8B8 body block 0 conv 0 8x8x3x3 part 0
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

#define FEAT_TEX_0_tex(position) Anime4KSample0(position)
#define FEAT_TEX_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define FEAT_TEX_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define FEAT_TEX_0_pos anime4k_pos
#define FEAT_TEX_0_size float2(Anime4KInputSizes[0].xy)
#define FEAT_TEX_0_pt rcp(FEAT_TEX_0_size)
#define FEAT_TEX_1_tex(position) Anime4KSample1(position)
#define FEAT_TEX_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define FEAT_TEX_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define FEAT_TEX_1_pos anime4k_pos
#define FEAT_TEX_1_size float2(Anime4KInputSizes[1].xy)
#define FEAT_TEX_1_pt rcp(FEAT_TEX_1_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.20833233, -0.046377487, -0.53266525, -0.023150444);
    result += mul(FEAT_TEX_0_texOff(float2(-1.0, -1.0)), float4x4(-0.5598026, 0.10043531, -0.82914895, 0.5883989, 0.08442055, 0.05804021, 0.49049386, 1.1710296, -0.62240714, 0.19194111, -1.4343638, 0.2294062, 0.37612528, -0.07924314, -0.11483107, -1.6210003));
    result += mul(FEAT_TEX_0_texOff(float2(0.0, -1.0)), float4x4(-0.52739215, 0.23936333, -0.04813647, 0.36522436, 0.8127641, -0.31612095, 0.59339005, -0.04110847, -1.0366431, 0.3347496, -1.0416756, 1.2248251, -0.5262167, 0.3154232, -0.27127954, 0.742836));
    result += mul(FEAT_TEX_0_texOff(float2(1.0, -1.0)), float4x4(0.0959913, 0.032899246, 1.1928614, -0.48779845, 0.03709374, 0.24064027, -0.63130623, 0.63734233, -0.3282726, -0.21412182, -0.86332124, 1.6430343, -0.30884627, -0.19492824, 0.3343128, -0.35691854));
    result += mul(FEAT_TEX_0_texOff(float2(-1.0, 0.0)), float4x4(0.03452596, -0.30031443, -1.3641002, 0.3183118, 0.49525222, 0.14006022, 0.44979995, -1.229135, -0.5164825, -0.26783863, 0.49706855, 0.48708844, -0.33148754, -0.16858369, -0.7468656, 1.6628296));
    result += mul(FEAT_TEX_0_texOff(float2(0.0, 0.0)), float4x4(0.63456976, 0.13621913, 0.94241005, -1.3572081, -0.14441727, 0.94876, -0.011923899, 1.1604738, 1.5971512, -0.7216134, 3.1918077, -2.2112243, 0.25730702, 0.80639607, 0.6941229, -2.1108963));
    result += mul(FEAT_TEX_0_texOff(float2(1.0, 0.0)), float4x4(-0.669309, 0.014790681, -2.169005, 0.18195948, 0.28642762, -0.1331056, 0.4989995, -0.7852308, 0.3432682, 0.13214886, -1.4146367, 0.18332328, 0.5070949, -0.9101437, -0.0756788, 1.0036608));
    result += mul(FEAT_TEX_0_texOff(float2(-1.0, 1.0)), float4x4(0.34326476, -0.04466913, 0.77514786, -0.9100058, -0.7696986, 0.037707172, -0.34018365, 0.48928496, -0.47848752, 0.5055299, 0.07091924, -1.2212007, 0.55785215, -0.08412955, 0.07895773, -0.5533587));
    result += mul(FEAT_TEX_0_texOff(float2(0.0, 1.0)), float4x4(-0.68921524, -0.33512625, -1.0218805, 1.3435986, -0.02868588, 0.118946485, 0.35793635, -0.9754153, -0.5817166, 0.55364746, -0.9734035, 0.45182484, 0.3892281, -0.1532973, -0.32700682, 1.8626672));
    result += mul(FEAT_TEX_0_texOff(float2(1.0, 1.0)), float4x4(0.10425155, -0.12189813, 1.083967, -0.49346972, -0.58172995, -0.038408462, -1.4077044, -0.070986934, 1.3937846, -0.17716724, 1.4121706, -1.0312161, 1.0817461, 0.09150338, 2.6459322, -0.18647109));
    result += mul(FEAT_TEX_1_texOff(float2(-1.0, -1.0)), float4x4(-0.005678914, 0.028743923, 0.6967546, -0.7581174, 1.164405, -0.32406268, 0.339376, -2.612836, 0.30471334, -0.21701838, 0.62110627, 0.11579983, -0.17464526, -0.012083791, 0.24448657, 1.0550127));
    result += mul(FEAT_TEX_1_texOff(float2(0.0, -1.0)), float4x4(0.14087275, 0.0015884747, -0.6847769, 1.7962242, 0.5440337, 0.119845994, 0.7460691, -1.544973, 0.45467624, -0.011213184, 0.28689733, -0.939848, 0.08833631, 0.24173965, -0.78414273, 1.3669055));
    result += mul(FEAT_TEX_1_texOff(float2(1.0, -1.0)), float4x4(0.71340686, -0.91430175, -0.6908261, -1.088435, 0.46084788, 0.5061731, 0.6569094, -0.8290194, 0.20064656, 0.010850091, -0.2909668, 0.016932493, -0.2950932, 0.1462619, 0.30582735, -0.014183732));
    result += mul(FEAT_TEX_1_texOff(float2(-1.0, 0.0)), float4x4(-0.59942764, 1.0882525, 1.2688403, -0.74679965, -0.638324, -0.3059622, -0.34672827, 1.8537142, 0.25598207, 0.31059092, 0.73041445, -0.9596954, 0.12480362, -0.084599786, 0.44693968, -1.6088649));
    result += mul(FEAT_TEX_1_texOff(float2(0.0, 0.0)), float4x4(0.33158436, -0.20328635, -2.3149989, 2.4455366, 0.7542028, -0.8052176, 0.469714, -0.021871258, -0.2947818, -0.26040238, -1.3799586, 2.3325315, 0.3178189, 0.19898833, 0.24562621, -0.6341922));
    result += mul(FEAT_TEX_1_texOff(float2(1.0, 0.0)), float4x4(1.061596, -0.3353617, 4.7038836, -0.5281582, -0.84147465, 0.8394799, -2.1838424, 1.1300842, 0.0066142958, 0.22967106, 1.2367541, -0.54874283, 0.58870083, -1.0708435, 0.7825816, -0.5670331));
    result += mul(FEAT_TEX_1_texOff(float2(-1.0, 1.0)), float4x4(1.3157196, -0.27150226, 0.0070705716, 1.7336078, 0.6656675, -0.43512538, 0.6883792, 0.43508694, -0.32103452, 0.12633684, -0.2655455, 1.0487458, -0.33411795, 0.06927532, -0.20294131, 0.77698827));
    result += mul(FEAT_TEX_1_texOff(float2(0.0, 1.0)), float4x4(1.3978779, 0.38709667, 2.6842518, -4.930525, -0.692833, 0.19986112, -0.3807425, 2.1381423, 0.4182289, 0.046161477, 0.8989256, -1.4588506, -0.14952675, 0.3779269, -0.1940108, -1.0567259));
    result += mul(FEAT_TEX_1_texOff(float2(1.0, 1.0)), float4x4(-1.9799114, -0.04289252, -4.328598, 2.1354406, 0.8485782, 0.27983257, 1.9653602, -0.36628926, -0.5293831, 0.026172072, -1.3155107, 0.6156747, -0.51158845, -0.72135645, -1.3001592, 0.33169764));
    result = max(result, float4(0.0, 0.0, 0.0, 0.0)) + float4(0.46461663, -0.8345893, -0.515425, -0.57263845) * min(result, float4(0.0, 0.0, 0.0, 0.0));
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
