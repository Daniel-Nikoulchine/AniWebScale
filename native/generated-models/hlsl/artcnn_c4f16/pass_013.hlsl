// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:592
// Pass: 013 - ArtCNN C4F16 (Conv2D-3-ReLU)
// ArtCNN is Copyright (c) 2024 Joao Chrisostomo, MIT licensed.

cbuffer Anime4KPassConstants : register(b0)
{
    uint2 Anime4KOutputSize;
    uint2 Anime4KReserved;
    uint4 Anime4KInputSizes[4];
};

Texture2D<float4> Anime4KInput0 : register(t0);
Texture2D<float4> Anime4KInput1 : register(t1);
Texture2D<float4> Anime4KInput2 : register(t2);
Texture2D<float4> Anime4KInput3 : register(t3);
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

float4 Anime4KTransform3(float4 value)
{
    return value;
}

float2 Anime4KClampUv3(float2 uv)
{
    float2 size = max(float2(Anime4KInputSizes[3].xy), float2(1.0, 1.0));
    return clamp(uv, 0.5 / size, (size - 0.5) / size);
}

float4 Anime4KSample3(float2 uv)
{
    return Anime4KTransform3(float4(Anime4KInput3.SampleLevel(
        Anime4KLinearClampSampler, Anime4KClampUv3(uv), 0.0)));
}

float4 Anime4KLoadOffset3(uint2 position, float2 offset)
{
    int2 maximum_position = int2(Anime4KInputSizes[3].xy) - 1;
    int2 source_position = clamp(int2(position) + int2(offset), int2(0, 0), maximum_position);
    return Anime4KTransform3(float4(Anime4KInput3.Load(int3(source_position, 0))));
}

float4 Anime4KLoadCurrent3(uint2 position)
{
    return Anime4KTransform3(float4(Anime4KInput3.Load(int3(position, 0))));
}

#define conv2d_2_0_tex(position) Anime4KSample0(position)
#define conv2d_2_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_2_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_2_0_pos anime4k_pos
#define conv2d_2_0_size float2(Anime4KInputSizes[0].xy)
#define conv2d_2_0_pt rcp(conv2d_2_0_size)
#define conv2d_2_1_tex(position) Anime4KSample1(position)
#define conv2d_2_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_2_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_2_1_pos anime4k_pos
#define conv2d_2_1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_2_1_pt rcp(conv2d_2_1_size)
#define conv2d_2_2_tex(position) Anime4KSample2(position)
#define conv2d_2_2_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_2_2_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_2_2_pos anime4k_pos
#define conv2d_2_2_size float2(Anime4KInputSizes[2].xy)
#define conv2d_2_2_pt rcp(conv2d_2_2_size)
#define conv2d_2_3_tex(position) Anime4KSample3(position)
#define conv2d_2_3_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_2_3_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_2_3_pos anime4k_pos
#define conv2d_2_3_size float2(Anime4KInputSizes[3].xy)
#define conv2d_2_3_pt rcp(conv2d_2_3_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.03197685, 0.009466869, 0.009720253, 0.039991707);
    result += mul(conv2d_2_0_texOff(float2(-1, -1)), float4x4(0.37893903, 0.029461196, -0.07913403, -0.17677213, -0.13564703, 0.0061546164, -0.014508667, -0.07446174, 0.1286484, -0.014526213, 0.023690516, -0.026472604, 0.034104735, -0.011661503, -0.02349436, -0.15787004));
    result += mul(conv2d_2_0_texOff(float2(0, -1)), float4x4(0.17973754, -0.025870606, -0.04362594, 0.13789046, 0.21330658, -0.0062301573, -0.038159616, 0.023180036, -0.11684705, 0.009604447, -0.010649863, -0.10914116, -0.06552211, 0.03518744, 0.012694888, -0.11660528));
    result += mul(conv2d_2_0_texOff(float2(1, -1)), float4x4(0.06452859, -0.0018188148, -0.0074033635, -0.0051766946, 0.10563202, -0.0060778167, 0.0144405505, -0.25975505, -0.033107426, 0.01369438, 0.032051113, -0.20464087, 0.056185428, -0.005931526, -0.040381536, 0.19963878));
    result += mul(conv2d_2_0_texOff(float2(-1, 0)), float4x4(-0.3103058, -0.0014426091, -0.19712692, 0.06665031, 0.14681278, 0.011923919, 0.07417436, 0.25585368, -0.099381074, 0.11781022, 0.072132275, -0.0798054, 0.053646874, 0.03300083, -0.046118744, -0.01421105));
    result += mul(conv2d_2_0_texOff(float2(0, 0)), float4x4(-0.31073308, 0.12140132, 0.07259658, -0.09613751, -0.1170934, -0.034619007, 0.004716991, 0.2237734, -0.017459607, 0.30396596, 0.04244998, -0.08023382, 0.13175777, 0.3817638, -0.119583055, -0.22009438));
    result += mul(conv2d_2_0_texOff(float2(1, 0)), float4x4(-0.038602423, -0.009261041, 0.04130815, -0.028456325, -0.0069257133, 0.03644131, 0.0002282628, 0.035437483, -0.17509446, 0.020995421, -0.03400703, 0.24009852, 0.2419408, 0.01399761, 0.026791897, -0.45194805));
    result += mul(conv2d_2_0_texOff(float2(-1, 1)), float4x4(-0.10147737, -0.08687581, -0.106373206, 0.18008259, -0.033435907, 0.048170384, 0.10435757, -0.4733361, -0.07510881, 0.055513356, 0.08802642, 0.026395272, 0.024282448, -0.03983503, -0.108089015, -0.30702028));
    result += mul(conv2d_2_0_texOff(float2(0, 1)), float4x4(-0.04572913, 0.038807407, -0.0427059, -0.00894672, 0.15958552, 0.10744134, 0.020510249, 0.09948813, 0.08110379, 0.04224443, 0.08228267, 0.105734825, -0.1222076, 0.016081369, -0.16655725, 0.34774745));
    result += mul(conv2d_2_0_texOff(float2(1, 1)), float4x4(-0.10145903, 0.021042647, -0.0082651535, 0.048754748, 0.10899471, 0.07187288, -0.047488198, 0.116483375, -0.016801804, -0.041228686, -0.051476948, -0.035630748, -0.18621068, 0.047729004, 0.095745504, -0.23297389));
    result += mul(conv2d_2_1_texOff(float2(-1, -1)), float4x4(0.005734367, 0.03685439, 0.02499601, 0.2719659, -0.012392193, 0.00064525096, 0.0038660108, -0.21096927, -0.06908588, 0.052110057, 0.028235726, 0.2433543, 0.04362542, 0.041879404, -0.07352681, -0.4487334));
    result += mul(conv2d_2_1_texOff(float2(0, -1)), float4x4(-0.12360228, 0.016729414, -0.04290733, -0.21198723, 0.019725986, 0.009074661, -0.018515982, 0.23687911, -0.18923388, 0.021555645, -0.008871802, 0.12984817, -0.16015153, 0.07093554, 0.06394781, -0.8010943));
    result += mul(conv2d_2_1_texOff(float2(1, -1)), float4x4(0.0221012, -0.0023415368, -0.005647753, -0.0091246, 0.04746056, -0.046625823, 0.008915393, 0.02414209, -0.079910785, 0.032733984, 0.0064547895, -0.098206885, -0.11611039, -0.011963244, 0.026545417, -1.2430792));
    result += mul(conv2d_2_1_texOff(float2(-1, 0)), float4x4(0.018286062, 0.07787173, 0.04053361, 0.3198714, 0.08884302, -0.029055543, -0.09440727, -0.07690468, -0.07908165, 0.07405705, 0.05970915, 0.20745757, 0.19865292, -0.06229548, -0.2030823, -0.53383));
    result += mul(conv2d_2_1_texOff(float2(0, 0)), float4x4(-0.007921443, 0.075805284, -0.030105418, 0.18413953, 0.22062647, 0.03251561, 0.022013897, -0.28956917, -0.07948229, -0.00369928, 0.038778625, 0.06671214, 0.5591264, 0.20492686, 0.09616514, 0.0163817));
    result += mul(conv2d_2_1_texOff(float2(1, 0)), float4x4(0.13207968, -0.04410131, -0.0005425774, 0.16599797, 0.10816751, -0.016959824, 0.0075476263, -0.019818287, -0.002914562, -0.0044033327, -0.048578326, 0.09626158, 0.053525448, 0.11977648, 0.013745466, -2.315545));
    result += mul(conv2d_2_1_texOff(float2(-1, 1)), float4x4(-0.12052032, 0.0519926, 0.022980101, 0.20643046, -0.10373932, -0.03582757, -0.04091566, -0.14564225, 0.08576637, -0.027791372, 0.0879579, 0.172523, 0.120239116, 0.006110247, 0.07548316, -0.41816127));
    result += mul(conv2d_2_1_texOff(float2(0, 1)), float4x4(-0.049161553, 0.032522038, -0.029410522, -0.26320434, -0.19940381, 0.04008777, -0.008045143, -0.23896164, 0.44206932, -0.031835098, -0.02621084, -0.023675324, -0.05011334, -0.19800723, -0.23836961, 0.0535939));
    result += mul(conv2d_2_1_texOff(float2(1, 1)), float4x4(-0.05496718, 0.0101593, 0.041979924, 0.044925284, -0.044922456, -0.012198926, 0.021584783, 0.21126793, 0.15055561, -0.009572472, -0.018008208, 0.4090995, 0.049061194, 0.06250413, 0.13745123, -0.022868399));
    result += mul(conv2d_2_2_texOff(float2(-1, -1)), float4x4(-0.0939945, 0.021408113, -0.040988505, -0.4418341, 0.08988295, 0.040019028, -0.019014282, -0.044736486, 0.19743088, -0.1080404, -0.1686452, -0.51512396, -0.060349002, 0.05956909, 0.023571232, 0.1039599));
    result += mul(conv2d_2_2_texOff(float2(0, -1)), float4x4(0.12085725, -0.019170385, -0.048719358, -0.3464677, 0.084851585, -0.03802808, 0.01708072, -0.2230396, 0.4396354, -0.012365446, 0.11286693, -0.51991636, 0.02369014, -0.06417212, -0.054144878, -0.5593772));
    result += mul(conv2d_2_2_texOff(float2(1, -1)), float4x4(0.19084796, -0.00918441, 0.020554962, -0.2946312, -0.07484234, 0.0072653014, -0.013959481, 0.17476802, 0.1548115, -0.00068255607, 0.006365023, -0.034286655, -0.15683083, -0.03244829, -0.06638063, 0.7390953));
    result += mul(conv2d_2_2_texOff(float2(-1, 0)), float4x4(0.028709609, 0.01652505, -0.056770623, -0.18193471, 0.009310439, 0.03729884, -0.021764277, -0.18761191, -0.21660407, -0.03974824, -0.17621416, 0.0827566, -0.041147914, -0.040964626, -0.03406308, -0.319752));
    result += mul(conv2d_2_2_texOff(float2(0, 0)), float4x4(-0.31386158, -0.04102667, -0.10513362, -1.036077, -0.1422989, -0.123584285, -0.017489254, -0.36400154, -0.56399155, 0.21876346, 0.13502249, -0.6025036, -0.29705185, 0.012172212, -0.069099315, 0.60837084));
    result += mul(conv2d_2_2_texOff(float2(1, 0)), float4x4(-0.3554675, -0.011191665, 0.0051719043, -0.60856956, 0.2437946, 0.00028163605, -0.015517917, -0.22459862, -0.12787163, -0.043747246, -0.017964432, 0.25179666, -0.03177197, 0.04002045, -0.026100859, -0.20909217));
    result += mul(conv2d_2_2_texOff(float2(-1, 1)), float4x4(-0.11029903, -0.002407244, -0.082475685, -0.4840578, 0.17298996, 0.06120491, -0.03881493, -0.17745546, 0.092759, -0.05453083, -0.0962216, -0.047635056, -0.06585347, -0.028480329, -0.0069189845, 0.015593754));
    result += mul(conv2d_2_2_texOff(float2(0, 1)), float4x4(-0.20604818, -0.050251845, -0.10691628, -0.5601715, -0.0887056, -0.07379078, -0.15468492, -0.0159541, 0.06203925, -0.106010154, 0.012874496, 0.1455384, 0.034383323, -0.008992264, -0.009715732, 0.24092267));
    result += mul(conv2d_2_2_texOff(float2(1, 1)), float4x4(-0.0915811, -0.032262098, 0.008914765, -0.17160316, 0.048902486, -0.084567524, 0.040422224, -0.36013052, 0.11999774, -0.021290582, 0.047865834, 0.18009092, -0.04564632, -0.03301961, 0.030279774, -0.17927381));
    result += mul(conv2d_2_3_texOff(float2(-1, -1)), float4x4(-0.11416233, 0.039816156, -0.18124492, -0.06610455, 0.087441996, -0.046884093, 0.05726735, -3.765711, -0.064054765, 0.028807098, -0.00031757646, -0.12875982, 0.016545147, -0.061678987, 0.032253474, 0.2397545));
    result += mul(conv2d_2_3_texOff(float2(0, -1)), float4x4(0.17590956, 0.027081784, 0.0027072034, -0.04297356, -0.21598643, 0.49206418, -0.45759508, -1.9272473, -0.25017938, 0.077664606, -0.000397508, 0.20174164, 0.2726898, -0.06675011, 0.025685104, -0.12042066));
    result += mul(conv2d_2_3_texOff(float2(1, -1)), float4x4(0.047420952, -0.017641606, -0.0029313304, 0.058260296, 0.27110732, 0.13242292, -0.18235794, -1.8893739, -0.030195795, -0.016581358, -0.001447501, 0.08176395, 0.046655018, -0.08347213, 0.012317623, -0.04790402));
    result += mul(conv2d_2_3_texOff(float2(-1, 0)), float4x4(-0.6091348, 0.20123994, -0.28800824, -0.81151146, 0.038319476, 0.024404824, 0.30499846, -0.19334753, 0.053648766, -0.16307841, -0.021395247, -0.032647878, -0.065300524, -0.055020493, 0.049905103, -0.11085886));
    result += mul(conv2d_2_3_texOff(float2(0, 0)), float4x4(0.21887879, 0.13360706, -0.06467966, -0.28524056, -0.12001086, 0.12892407, 0.56911814, -0.1621812, 0.47479445, -0.28701475, 0.09711453, -0.045114405, -0.22296593, 0.041357882, 0.091506965, -0.23854895));
    result += mul(conv2d_2_3_texOff(float2(1, 0)), float4x4(0.09556192, 0.09798181, -0.00044131352, -0.16591777, -0.045971982, 0.0869465, 0.13185643, 0.5340369, -0.007127164, -0.00655284, -0.03419772, 0.027136208, -0.02467685, -0.04082877, 0.012524493, 0.20262086));
    result += mul(conv2d_2_3_texOff(float2(-1, 1)), float4x4(-1.4300147, -0.34250337, -0.21723461, 0.27289546, -0.0037726637, -0.064412974, 0.0047339955, 0.1978106, 0.08262324, -0.016738327, -0.059941836, -0.11812271, -0.043182828, -0.004949407, -0.0154561205, 0.22197235));
    result += mul(conv2d_2_3_texOff(float2(0, 1)), float4x4(-0.47153488, -0.14200768, 0.019477723, 0.2677832, 0.04378184, -0.0060784053, 0.022313016, 0.015855001, -0.18932775, 0.13978744, 0.10805037, 0.014322482, -0.4323616, -0.013261398, 0.15860967, -0.19852833));
    result += mul(conv2d_2_3_texOff(float2(1, 1)), float4x4(-0.18400237, -0.08250004, 0.021548035, -0.019654367, 0.072155505, 0.016899591, 0.011339357, 0.10484389, 0.14368536, 0.0075784833, -0.04134971, -0.13728352, 0.060934767, 0.03404921, 0.04667244, -0.039446313));
    return max(result, float4(0.0, 0.0, 0.0, 0.0));
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
