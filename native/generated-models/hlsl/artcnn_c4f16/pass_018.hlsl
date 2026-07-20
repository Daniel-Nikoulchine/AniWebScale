// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:857
// Pass: 018 - ArtCNN C4F16 (Conv2D-4-ReLU)
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

#define conv2d_3_0_tex(position) Anime4KSample0(position)
#define conv2d_3_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_3_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_3_0_pos anime4k_pos
#define conv2d_3_0_size float2(Anime4KInputSizes[0].xy)
#define conv2d_3_0_pt rcp(conv2d_3_0_size)
#define conv2d_3_1_tex(position) Anime4KSample1(position)
#define conv2d_3_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_3_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_3_1_pos anime4k_pos
#define conv2d_3_1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_3_1_pt rcp(conv2d_3_1_size)
#define conv2d_3_2_tex(position) Anime4KSample2(position)
#define conv2d_3_2_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_3_2_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_3_2_pos anime4k_pos
#define conv2d_3_2_size float2(Anime4KInputSizes[2].xy)
#define conv2d_3_2_pt rcp(conv2d_3_2_size)
#define conv2d_3_3_tex(position) Anime4KSample3(position)
#define conv2d_3_3_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_3_3_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_3_3_pos anime4k_pos
#define conv2d_3_3_size float2(Anime4KInputSizes[3].xy)
#define conv2d_3_3_pt rcp(conv2d_3_3_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(0.00085590815, -0.11058401, -0.004185463, -0.0033007439);
    result += mul(conv2d_3_0_texOff(float2(-1, -1)), float4x4(0.03823268, -0.019020189, 0.00018768836, 0.027770892, 0.017778257, 0.06785351, 0.016936855, 0.013549008, 0.024078304, 0.08316261, -0.005495352, 0.066463076, 0.046780355, -0.041758947, -0.017557176, -0.0054221856));
    result += mul(conv2d_3_0_texOff(float2(0, -1)), float4x4(-0.025678746, -0.10280958, 0.024094058, -0.0040769344, 0.016095359, -0.15375787, -0.021476876, 0.022859545, -0.040547997, 0.025901314, 0.020619253, -0.06908779, -0.020138957, 0.026933072, -0.03399025, 0.0028764158));
    result += mul(conv2d_3_0_texOff(float2(1, -1)), float4x4(0.007628262, -0.13878727, -0.10763706, 0.053357467, 0.014702342, 0.09429799, -0.011309879, -0.024363752, 0.01924733, -0.027515104, -0.026817039, 0.009725977, -0.0332836, -0.12684208, -0.045493912, 0.026372673));
    result += mul(conv2d_3_0_texOff(float2(-1, 0)), float4x4(-0.064366944, -0.018640222, 0.011883216, -0.0742675, 0.0038255658, 0.048140004, -0.007838568, -0.092930645, -0.08776454, -0.035311278, -0.010420959, 0.042268436, 0.112246506, 0.08553889, -0.004101589, -0.024978181));
    result += mul(conv2d_3_0_texOff(float2(0, 0)), float4x4(0.033005666, 0.057112344, -0.018707704, 0.12040178, -0.024868574, 0.065879755, 0.032752957, -0.02654638, 0.016687788, -0.059444685, -0.0055422513, -0.012550685, -0.002186373, 0.058615502, 0.13555507, -0.08719716));
    result += mul(conv2d_3_0_texOff(float2(1, 0)), float4x4(0.01071929, -0.022304386, -0.089002155, 0.04483563, -0.011982952, -0.06877027, -0.11784859, 0.038036026, 0.06239937, -0.027241068, -0.09715287, -0.007881415, -0.0877954, -0.102293424, -0.021691427, -0.10489054));
    result += mul(conv2d_3_0_texOff(float2(-1, 1)), float4x4(0.006457746, -0.13768657, -0.006150537, 0.02746698, -0.06314659, -0.14060311, -0.0039404766, 0.046657413, 0.00038164982, 0.06805547, -0.0048443777, 0.02769594, 0.0007903421, -0.023994446, -0.001164403, -0.00492129));
    result += mul(conv2d_3_0_texOff(float2(0, 1)), float4x4(0.04739801, 0.024451032, 0.0074115857, -0.018651037, -0.051858146, -0.1011536, 0.0102512585, -0.073696464, 0.031331535, -0.019273419, -0.01153505, -0.0034610513, -0.026108146, -0.08050173, -0.040775858, -0.018263852));
    result += mul(conv2d_3_0_texOff(float2(1, 1)), float4x4(-0.07336693, -0.054785915, -0.0010816916, -0.0071093775, -0.003674597, 0.09670952, -0.012198478, 0.0007809784, -0.07044101, 0.0152350925, 0.01537399, 0.024172718, 0.083375245, -0.05664275, 0.031770498, 0.05458728));
    result += mul(conv2d_3_1_texOff(float2(-1, -1)), float4x4(-0.0032337923, -0.13865645, -0.014511409, -0.010342687, 0.010041881, -0.14545114, -0.0039418726, 0.047045536, -0.16806088, 0.032554418, -0.01483906, -0.067735314, -0.0037072988, 0.034718335, -0.0011665163, -0.03968599));
    result += mul(conv2d_3_1_texOff(float2(0, -1)), float4x4(0.105183564, -0.036910396, -0.026704492, 0.08240763, -0.18027656, -0.13785379, 0.007948856, -0.22817267, -0.1175495, -0.03729761, -0.04843841, 0.21426615, 0.06505314, -0.0075961724, -0.008818496, -0.03298748));
    result += mul(conv2d_3_1_texOff(float2(1, -1)), float4x4(-0.0025340097, -0.047293518, 0.12153946, 0.0084230015, 0.013953263, -0.06403232, -0.35412008, 0.1169761, 0.27518418, 0.093933634, -0.18054408, 0.18026589, 0.0011440839, 0.0763932, -0.00076926313, 0.012290704));
    result += mul(conv2d_3_1_texOff(float2(-1, 0)), float4x4(0.030042555, -0.0009587555, -0.001202289, 0.029447034, -0.06954318, -0.087543786, -0.007960058, -0.12491024, -0.014970156, -0.109748, -0.015615756, -0.013737572, 0.04586475, -0.0112464, 0.021506175, 0.03597247));
    result += mul(conv2d_3_1_texOff(float2(0, 0)), float4x4(0.065826766, -0.11697414, -0.0022320582, -0.042270895, 0.11588371, -0.111551955, -0.07009092, 0.18297946, 0.19230916, 0.056357726, 0.0048539694, 0.12399604, -0.013110491, -0.07906368, 0.036724664, -0.19380264));
    result += mul(conv2d_3_1_texOff(float2(1, 0)), float4x4(-0.07301905, -0.12396714, 0.026970396, 0.015073662, -0.1007614, -0.14880058, 0.1572256, -0.008956302, -0.19633359, 0.045041624, 0.027694758, -0.17924063, -0.09584804, 0.008314921, 0.0038424637, -0.068474315));
    result += mul(conv2d_3_1_texOff(float2(-1, 1)), float4x4(-0.02770373, -0.05037191, 0.0057348306, 0.010792001, -0.047242325, -0.11885265, -0.00055493787, -0.016961357, -0.0007123378, -0.12080456, -0.007890615, 0.071344964, -0.03839615, 0.07262445, -0.014579452, -0.06667177));
    result += mul(conv2d_3_1_texOff(float2(0, 1)), float4x4(-0.03531029, -0.048666224, 0.019286212, -0.03561909, -0.021833556, -0.0586722, -0.01131484, 0.026468305, -0.05054643, -0.06391145, 0.033776414, -0.10665902, -0.036353648, 0.03833119, -0.025905538, -0.042378392));
    result += mul(conv2d_3_1_texOff(float2(1, 1)), float4x4(0.025932793, -0.135575, -0.016550971, 0.0056329845, 0.064621136, 0.031509116, -0.019101372, 0.0039553186, 0.011645904, -0.023366414, 0.02224235, -0.006213978, 0.044379987, 0.054857265, -0.063743204, -0.047336783));
    result += mul(conv2d_3_2_texOff(float2(-1, -1)), float4x4(-0.0491011, -0.13581134, 0.002052526, 0.005384292, 0.029966263, -0.1530521, 0.0018354566, 0.041927725, 0.00043623787, -0.026352987, -0.01611735, -0.01862278, 0.045986883, -0.019270157, -0.007055283, -0.0024951526));
    result += mul(conv2d_3_2_texOff(float2(0, -1)), float4x4(-0.020129455, -0.05723123, -0.016844293, -0.074482545, -0.10768988, -0.109089434, -0.027481044, -0.19331563, 0.019124715, -0.109836645, -0.03063768, 0.038573273, 0.086899795, -0.08591294, 0.06038487, 0.019893931));
    result += mul(conv2d_3_2_texOff(float2(1, -1)), float4x4(-0.02794547, -0.044114344, 0.10325825, 0.016367923, 0.008472824, -0.11473919, -0.1469642, -0.114164285, -0.08011932, -0.06601632, 0.17313485, -0.020012712, 0.01602537, 0.08628178, -0.010208815, -0.07114934));
    result += mul(conv2d_3_2_texOff(float2(-1, 0)), float4x4(0.07052508, -0.07140108, -0.010133952, -0.04468804, 0.015952097, -0.13745204, -0.005450291, -0.024775647, -0.01606313, -0.09604996, 0.008099145, 0.063507356, -0.007996992, -0.0899111, -0.007945919, -0.04643389));
    result += mul(conv2d_3_2_texOff(float2(0, 0)), float4x4(-0.028486598, -0.018204065, -0.009383807, 0.1618174, -0.31363073, 0.0903481, 0.07492366, -0.3283563, -0.06553668, -0.054666102, 0.059254766, -0.013257135, 0.22222002, -0.1344024, -0.035703246, -0.062626004));
    result += mul(conv2d_3_2_texOff(float2(1, 0)), float4x4(-0.01963202, 0.077575274, -0.07972882, -0.07012752, -0.0867664, -0.02190308, -0.77077407, -0.19539578, -0.04152809, -0.11242265, -0.3265278, -0.08167147, 0.109042324, -0.08005127, 0.33898592, 0.042894647));
    result += mul(conv2d_3_2_texOff(float2(-1, 1)), float4x4(-0.0544959, -0.07390689, 0.0061917333, 0.016077409, 0.003640489, -0.15214707, 0.0036823177, -0.046046864, 0.08307272, -0.13719694, -0.012346083, 0.02942329, 0.02306496, -0.017555742, 0.004264163, 0.0383943));
    result += mul(conv2d_3_2_texOff(float2(0, 1)), float4x4(-0.11323149, -0.1634854, -0.008844112, -0.06628908, 0.009997886, -0.13676918, -0.021775927, 0.020638539, -0.03315887, 0.022439217, 0.011280403, -0.07037501, 0.11955546, 0.013897899, 0.023153976, -0.022664962));
    result += mul(conv2d_3_2_texOff(float2(1, 1)), float4x4(0.0487179, -0.123576716, 0.010465506, 0.0012189838, -0.10830605, -0.117511205, 0.014859435, -0.008250388, 0.09148619, -0.0011717153, 0.0487961, -0.007101483, 0.019734008, -0.0077297343, 0.022433942, -0.06256378));
    result += mul(conv2d_3_3_texOff(float2(-1, -1)), float4x4(-0.012916365, -0.096959665, 0.017911319, 0.09357031, -0.100207545, -0.04991088, -0.0060314247, -0.08587489, -0.0016821597, -0.025308084, 0.008480917, 0.020714363, -0.011535785, -0.13184907, -0.018957302, -0.036849733));
    result += mul(conv2d_3_3_texOff(float2(0, -1)), float4x4(-0.0043509216, -0.103378594, 0.023056947, 0.035153102, -0.15202156, 0.055385437, 0.02374999, 0.09936793, 0.24049987, 0.009000901, 0.005903866, -0.04819115, 0.10391678, 0.059671767, -0.03929507, -0.099223495));
    result += mul(conv2d_3_3_texOff(float2(1, -1)), float4x4(0.037527505, -0.09505539, 0.26789346, 0.011569882, -0.00672054, 0.094594955, -0.025339717, -0.012588863, 0.078318976, -0.022854779, 0.09874017, -4.5481058e-05, -0.119791076, -0.045320753, -0.09679077, -0.012302338));
    result += mul(conv2d_3_3_texOff(float2(-1, 0)), float4x4(0.16760895, -0.02056834, 0.020374045, 0.044549715, -0.09065339, -0.15149747, -0.0025165167, 0.06937566, 0.04562528, -0.017568784, 0.013704653, 0.02587329, -0.117088094, -0.060738385, -0.00409101, -0.07064041));
    result += mul(conv2d_3_3_texOff(float2(0, 0)), float4x4(-0.19336312, -0.06734621, 0.2707436, 0.051509283, -0.20292477, 0.032476235, -0.012986176, -0.1253112, -0.09472151, 0.07167364, 0.016214844, -0.09924515, -0.20648772, 0.032588042, 0.18101993, -0.24171743));
    result += mul(conv2d_3_3_texOff(float2(1, 0)), float4x4(0.030255638, -0.09769542, -0.24885134, 0.0072520077, -0.25686038, 0.012751137, -0.43052223, 0.011520737, 0.088716365, 0.06183538, -0.094725415, 0.026166975, 0.05072213, 0.08114631, -0.15193465, -0.038766105));
    result += mul(conv2d_3_3_texOff(float2(-1, 1)), float4x4(-0.019670768, -0.10830052, 0.0021040784, -0.04961861, 0.06960776, 0.100839205, 0.0031282785, 0.023023887, 0.0009936473, 0.026023826, 0.0014839089, -0.026171047, -0.38550082, -0.11392588, -0.031401917, -0.3377578));
    result += mul(conv2d_3_3_texOff(float2(0, 1)), float4x4(0.3704655, -0.031927153, 0.04482619, 0.035416562, -0.15818079, -0.05521503, 0.0055372827, 0.04568237, -0.14067328, 0.02658703, -0.029710643, 0.04415768, -0.21993653, 0.029578632, 0.044697993, 0.17730482));
    result += mul(conv2d_3_3_texOff(float2(1, 1)), float4x4(-0.08173753, 0.0036346568, 0.008878552, 0.034711678, 0.02893631, -0.15060142, 0.0072369417, -0.01749959, -0.12436625, 0.0010711544, -0.09505899, 0.006413828, 0.13056184, 0.10915371, 0.17208618, -0.047722574));
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
