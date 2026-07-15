// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:168
// Pass: 005 - ArtCNN C4F16 (Conv2D-1-ReLU)
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

#define conv2d_0_tex(position) Anime4KSample0(position)
#define conv2d_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_0_pos anime4k_pos
#define conv2d_0_size float2(Anime4KInputSizes[0].xy)
#define conv2d_0_pt rcp(conv2d_0_size)
#define conv2d_1_tex(position) Anime4KSample1(position)
#define conv2d_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_1_pos anime4k_pos
#define conv2d_1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_1_pt rcp(conv2d_1_size)
#define conv2d_2_tex(position) Anime4KSample2(position)
#define conv2d_2_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_2_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_2_pos anime4k_pos
#define conv2d_2_size float2(Anime4KInputSizes[2].xy)
#define conv2d_2_pt rcp(conv2d_2_size)
#define conv2d_3_tex(position) Anime4KSample3(position)
#define conv2d_3_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_3_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_3_pos anime4k_pos
#define conv2d_3_size float2(Anime4KInputSizes[3].xy)
#define conv2d_3_pt rcp(conv2d_3_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(0.042684413, -0.011012326, -0.00878685, 0.010643135);
    result += mul(conv2d_0_texOff(float2(-1, -1)), float4x4(-0.18877415, -0.09089855, 0.0072896937, 0.23530912, -0.0934211, -0.069338076, -0.00844786, 0.05497638, 0.059132297, -0.07186099, -0.005284089, 0.009240251, 0.07578471, -0.0729261, -0.07486577, -0.16516358));
    result += mul(conv2d_0_texOff(float2(0, -1)), float4x4(0.086664684, -0.060442384, 0.14914125, -0.07955809, -0.23829828, 0.21308875, 0.23503913, 0.090339616, -0.081017, -0.06103283, -0.016862804, 0.0008293084, 0.15803167, -0.06516947, -0.13736767, -0.052404165));
    result += mul(conv2d_0_texOff(float2(1, -1)), float4x4(0.054891616, 0.08749097, 0.050384633, -0.119466245, -0.090476185, 0.30954581, -0.029950086, -0.016718058, -0.027244521, 0.15839703, -0.08564877, 0.15285009, -0.15158606, -0.046746027, -0.07667917, 0.19473897));
    result += mul(conv2d_0_texOff(float2(-1, 0)), float4x4(-0.012178883, 0.17008278, -0.07437466, 0.53128177, -0.0515155, -0.07002471, 0.2232988, 0.24204443, -0.05825628, 0.27219185, -0.020577984, 0.08120503, 0.06512096, -0.064028285, -0.043698058, -0.14570558));
    result += mul(conv2d_0_texOff(float2(0, 0)), float4x4(0.18037078, -0.20733012, 0.2710155, -0.058456894, 0.181085, -0.30579567, -0.03612736, -0.04797417, -0.15321401, 0.25708416, 1.059432, -0.085225135, 0.21254273, 0.099770375, -0.13315867, -0.10311383));
    result += mul(conv2d_0_texOff(float2(1, 0)), float4x4(0.25094235, -0.1702486, -0.057454593, -0.13899079, -0.048523817, -0.20154843, 0.30220234, -0.068558194, 0.5210809, -0.16537571, 0.14300114, 0.074582025, -0.23821272, 0.12164076, -0.04001619, 0.032253567));
    result += mul(conv2d_0_texOff(float2(-1, 1)), float4x4(0.080706015, 0.006069105, -0.043602843, -0.24529675, 0.19590034, -0.5448352, -0.2049945, -0.09720787, 0.15580839, 0.009218637, -0.09142852, 0.23706423, -0.04794372, -0.06749567, 0.1628039, -0.05698579));
    result += mul(conv2d_0_texOff(float2(0, 1)), float4x4(0.056656748, -0.08213934, -0.112287894, -0.0531863, 0.057146437, -0.0058343536, -0.5406026, -0.33009425, -0.0053697345, -0.4517388, -0.748217, -0.20385133, 0.09021538, 0.07225, 0.11318475, 0.096350536));
    result += mul(conv2d_0_texOff(float2(1, 1)), float4x4(0.1585303, -0.040510405, -0.020871915, -0.00038907313, -0.021032648, 0.089684114, -0.036921874, -0.053368293, 0.019662771, -0.12807742, -0.122671105, -0.103924304, -0.13174331, -0.13978162, 0.08677558, 0.12760891));
    result += mul(conv2d_1_texOff(float2(-1, -1)), float4x4(-0.34248176, -0.21929976, 0.030525431, -7.675433e-05, 0.4265894, 0.5602678, 0.11240546, 0.1059129, 0.17999111, 0.025918394, 0.107080884, -0.20786646, 0.073234364, 0.02878518, -0.31199798, -0.18550326));
    result += mul(conv2d_1_texOff(float2(0, -1)), float4x4(0.103012756, 0.074931584, -0.039766394, -0.030197302, -0.25416622, 0.18078984, 0.21822192, -0.116703406, 0.06921031, 0.079845265, 0.24874577, 0.31231636, 0.10445854, -0.20399132, -0.011794116, 0.0140210185));
    result += mul(conv2d_1_texOff(float2(1, -1)), float4x4(0.049203794, 0.07172215, 0.1506995, -0.09819289, -0.012719105, -0.056659713, 0.14108194, 0.0167015, -0.13591777, 0.3502316, -0.33868587, 0.057392195, 0.13970143, -0.08607497, -0.07254006, 0.006505547));
    result += mul(conv2d_1_texOff(float2(-1, 0)), float4x4(0.06500739, -0.74012697, 0.03630281, -0.36312285, 0.14175233, 0.55949175, 0.065657765, 0.41448808, -0.027200164, -0.19148263, -0.072313, 0.16467366, -0.26292518, -0.51554716, -0.036916472, -0.44660598));
    result += mul(conv2d_1_texOff(float2(0, 0)), float4x4(0.36956754, 0.087223426, -0.17320322, 0.21999256, -0.31813338, 0.033125285, -0.18078679, -0.37580523, 0.0821921, -0.22686213, -0.3172341, -0.318797, 0.15096942, 0.014306216, -0.19709918, 0.116944216));
    result += mul(conv2d_1_texOff(float2(1, 0)), float4x4(0.22070698, 0.07090989, 0.17592424, -0.002525239, -0.1320958, 0.07624054, 0.029854959, -0.1979614, -0.04178435, -0.2413084, 0.20388415, 0.15332823, 0.12596431, 0.10260472, -0.17990524, -0.05434134));
    result += mul(conv2d_1_texOff(float2(-1, 1)), float4x4(-0.15684433, -0.4854914, -0.09233601, -0.30180347, 0.39937276, 0.4657899, -0.16956586, 1.030501, -0.24533887, -0.08811991, -0.079179004, 0.014807613, 0.26631412, 0.13310678, -0.116129935, 0.46574318));
    result += mul(conv2d_1_texOff(float2(0, 1)), float4x4(0.07484563, 0.09698919, 0.17581323, 0.27939773, -0.13028108, -0.10737197, -0.44417876, -0.15595461, 0.257421, 0.116753645, 0.07980903, -0.33705282, 0.038941532, 0.6485781, 0.7868257, 0.1995149));
    result += mul(conv2d_1_texOff(float2(1, 1)), float4x4(0.21839814, -0.03372764, -0.24461545, -0.18122116, -0.24002214, 0.13982645, -0.044762775, 0.019324707, -0.04589858, 0.13805042, 0.1778199, 0.05064652, -0.46937785, -0.10375061, 0.26871073, 0.0696916));
    result += mul(conv2d_2_texOff(float2(-1, -1)), float4x4(-0.13568732, -0.106092565, -0.21927467, -0.15822773, 0.28233737, 0.45551702, 0.10693086, 0.119410165, -0.11696885, 0.10171857, 0.11723151, 0.11159596, -0.25990444, -0.0062499074, -0.17780681, 0.2567076));
    result += mul(conv2d_2_texOff(float2(0, -1)), float4x4(-0.120573916, 0.15209089, 0.055111933, 0.06389469, 0.10824278, 0.21931078, 0.28788117, -0.13949794, 0.09850267, -0.15773058, -0.15258087, -0.083398834, 0.094938815, 0.12931266, -0.17891638, -0.12831962));
    result += mul(conv2d_2_texOff(float2(1, -1)), float4x4(-0.012593621, 0.03300292, -0.10723861, 0.04638058, -0.111301094, 0.22043815, -0.08769318, -0.03394287, -0.20468459, -0.3699484, 0.2761041, 0.10903282, -0.05533663, -0.32657585, 0.2694521, -0.10749484));
    result += mul(conv2d_2_texOff(float2(-1, 0)), float4x4(0.08490274, 0.23498255, 0.025883486, -0.25052404, 0.2577379, 0.32781178, -0.050873265, -0.22516817, -0.10767229, 0.21484302, 0.06051844, 0.42270836, 0.09445311, 0.26408613, 0.08932983, -0.41040573));
    result += mul(conv2d_2_texOff(float2(0, 0)), float4x4(-0.11888232, 0.51565516, 0.98010385, -0.070471026, -0.10833566, -0.030997436, 1.0866784, -0.10508088, 0.16110322, 0.26380956, 0.29791, -0.4409, 0.101448074, 0.05394716, 0.43578124, 0.426638));
    result += mul(conv2d_2_texOff(float2(1, 0)), float4x4(0.42438215, -0.03568884, 0.028488673, 0.14208244, -0.3318944, -0.06086438, 0.19113962, -0.104261704, -0.34867382, 0.37454316, 0.334689, 0.3159271, -0.104952864, -0.120030195, -0.18673395, 0.06282467));
    result += mul(conv2d_2_texOff(float2(-1, 1)), float4x4(0.24995266, -0.13024196, -0.16221951, 0.64011955, 0.14663237, 0.58979195, -0.20226134, 0.81777024, -0.21020728, -0.11317864, -0.17783621, 0.06665261, 0.09197215, -0.5106811, -0.06720402, 0.047960356));
    result += mul(conv2d_2_texOff(float2(0, 1)), float4x4(-0.14750536, -0.31305456, -0.5481949, -0.02960463, 0.17321745, -0.11975349, -0.65630126, -0.22410828, 0.5968887, 0.027587451, -0.49452603, -0.68383557, 0.06896839, 0.45890525, -0.22186859, -0.40536952));
    result += mul(conv2d_2_texOff(float2(1, 1)), float4x4(0.20609516, -0.32626727, 0.06516236, 0.13309792, -0.26393035, -0.11567936, -0.17126624, 0.053105533, -0.20889923, -0.50112075, -0.21295664, 0.036774855, -0.043113127, -0.03371433, 0.07375633, 0.19406794));
    result += mul(conv2d_3_texOff(float2(-1, -1)), float4x4(0.061121877, 0.037276052, 0.1130368, 0.05436823, -0.18429157, -0.012286745, 0.13081616, 0.15044783, -0.10166003, 0.20361146, 0.13389264, 0.10735191, 0.06705255, 0.07630251, 0.08154733, -0.051773977));
    result += mul(conv2d_3_texOff(float2(0, -1)), float4x4(-0.14064261, -0.05052008, -0.21792558, -0.04410059, 0.094330266, 0.15968044, 0.05657469, 0.2243525, 0.07220332, -0.23886485, -0.10146681, -0.059583884, -0.30985904, -0.13847038, 0.0109924665, 0.09774365));
    result += mul(conv2d_3_texOff(float2(1, -1)), float4x4(-0.2406376, -0.08432054, 0.14264664, -0.021276113, -0.14803958, 0.046054825, 0.052287586, -0.16277425, 0.084093966, -0.09600658, -0.0129503645, -0.019426676, 0.22165707, -0.00573521, -0.051088274, -0.11208299));
    result += mul(conv2d_3_texOff(float2(-1, 0)), float4x4(-0.014409513, 0.113497645, -0.08352071, -0.08350037, 0.29228833, 0.053919405, 0.1734141, -0.43326563, -0.3636163, 0.18959105, 0.0023319167, 0.38501248, 0.22685541, 0.52842164, 0.005780101, 0.5240569));
    result += mul(conv2d_3_texOff(float2(0, 0)), float4x4(0.008386494, 0.09792959, -0.010207071, 0.07135685, -0.04762849, -0.09443096, 0.012653251, 0.28703403, -0.014785405, -0.013921215, -0.15590096, -0.24354817, -0.37500665, -0.032967243, -0.023880795, 0.079548284));
    result += mul(conv2d_3_texOff(float2(1, 0)), float4x4(0.047161955, -0.05536646, 0.00035768983, -0.07580358, -0.06745932, -0.35445455, 0.05479217, -0.072217174, -0.05909403, -0.061273668, 0.06486499, -0.08487081, 0.53124475, -0.014735263, 0.0786832, -0.036877662));
    result += mul(conv2d_3_texOff(float2(-1, 1)), float4x4(0.3745718, 0.25916216, 0.04465985, 0.073294535, -0.09536068, 0.2898998, -0.10304361, 0.24102606, -0.027329333, -0.9500066, -0.2993579, 0.34180617, 0.18839954, 0.1711666, -0.15225923, 0.4754349));
    result += mul(conv2d_3_texOff(float2(0, 1)), float4x4(0.05950132, 0.30065987, 0.4143196, 0.078852095, -0.18605408, -0.15637799, -0.28726384, -0.349723, 0.64332765, -0.70423985, -1.2837317, -0.29586196, -0.3326011, -0.19303136, -0.15985888, -0.019432714));
    result += mul(conv2d_3_texOff(float2(1, 1)), float4x4(-0.25563973, -0.031667903, 0.1498073, 0.01776562, 0.030108826, 0.06960039, -0.07138435, -0.005732488, 0.098876484, -0.32655704, -0.2969346, -0.08772628, 0.28227258, -0.19020355, -0.123977184, -0.05686878));
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
