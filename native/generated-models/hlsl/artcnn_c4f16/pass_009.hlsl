// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:380
// Pass: 009 - ArtCNN C4F16 (Conv2D-2-ReLU)
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

#define conv2d_1_0_tex(position) Anime4KSample0(position)
#define conv2d_1_0_texOff(offset) Anime4KLoadOffset0(anime4k_output_pixel, offset)
#define conv2d_1_0_texCurrent Anime4KLoadCurrent0(anime4k_output_pixel)
#define conv2d_1_0_pos anime4k_pos
#define conv2d_1_0_size float2(Anime4KInputSizes[0].xy)
#define conv2d_1_0_pt rcp(conv2d_1_0_size)
#define conv2d_1_1_tex(position) Anime4KSample1(position)
#define conv2d_1_1_texOff(offset) Anime4KLoadOffset1(anime4k_output_pixel, offset)
#define conv2d_1_1_texCurrent Anime4KLoadCurrent1(anime4k_output_pixel)
#define conv2d_1_1_pos anime4k_pos
#define conv2d_1_1_size float2(Anime4KInputSizes[1].xy)
#define conv2d_1_1_pt rcp(conv2d_1_1_size)
#define conv2d_1_2_tex(position) Anime4KSample2(position)
#define conv2d_1_2_texOff(offset) Anime4KLoadOffset2(anime4k_output_pixel, offset)
#define conv2d_1_2_texCurrent Anime4KLoadCurrent2(anime4k_output_pixel)
#define conv2d_1_2_pos anime4k_pos
#define conv2d_1_2_size float2(Anime4KInputSizes[2].xy)
#define conv2d_1_2_pt rcp(conv2d_1_2_size)
#define conv2d_1_3_tex(position) Anime4KSample3(position)
#define conv2d_1_3_texOff(offset) Anime4KLoadOffset3(anime4k_output_pixel, offset)
#define conv2d_1_3_texCurrent Anime4KLoadCurrent3(anime4k_output_pixel)
#define conv2d_1_3_pos anime4k_pos
#define conv2d_1_3_size float2(Anime4KInputSizes[3].xy)
#define conv2d_1_3_pt rcp(conv2d_1_3_size)

float4 Anime4KHook(float2 anime4k_pos, uint2 anime4k_output_pixel) {
    float4 result = float4(-0.020907562, 0.051519904, 0.004025018, 0.012838635);
    result += mul(conv2d_1_0_texOff(float2(-1, -1)), float4x4(0.0031744768, -0.11728889, -0.0047050696, 0.06373327, 0.036726005, 0.06609036, 0.049950615, 0.17614485, -0.32997555, 0.014641409, 0.081182264, -0.07919155, -0.19536918, -0.46960676, 0.016764, 0.47363475));
    result += mul(conv2d_1_0_texOff(float2(0, -1)), float4x4(-0.17114286, -0.09082788, -0.019113917, -0.06096694, -0.044028904, 0.004388121, 0.017435232, 0.11718931, 0.4229845, -0.039230697, 0.24911089, -0.22115454, -0.8559903, -1.0016639, 0.056378588, -0.21188162));
    result += mul(conv2d_1_0_texOff(float2(1, -1)), float4x4(0.22287893, 0.08208969, -0.05347362, 0.17382339, 0.077205196, -0.063387565, 0.0133471945, 0.1278937, 0.02451678, 0.29897645, -0.20019333, 0.035748534, -0.22976047, -0.62586397, -0.32414898, 0.10808306));
    result += mul(conv2d_1_0_texOff(float2(-1, 0)), float4x4(0.08604741, 0.067420244, -0.120265596, 0.04651316, 0.08795654, 0.28762528, 0.28650737, -0.12001891, 0.07282678, -0.39539564, 0.19386075, -0.12519884, -0.29190686, -0.025415573, -0.048851524, 0.056699894));
    result += mul(conv2d_1_0_texOff(float2(0, 0)), float4x4(0.0029094212, -0.0056027942, 0.4622342, 0.07185407, -0.6783579, 0.23182988, 0.35710406, 0.21463121, 0.005757732, -0.0974986, -0.7756018, -0.52199864, -0.062789515, -0.37965363, 0.22294925, 0.5948862));
    result += mul(conv2d_1_0_texOff(float2(1, 0)), float4x4(-0.09940342, -0.046650127, -0.2681366, -0.0681941, 0.14202707, 0.038633112, 0.2782476, 0.18217503, -0.053161237, 0.30853584, 0.24053691, 0.6429152, -0.014886472, -0.23501647, -0.048990157, 0.1406616));
    result += mul(conv2d_1_0_texOff(float2(-1, 1)), float4x4(-0.117957525, 0.6456593, 0.4443233, 0.40475813, 0.032213457, 0.14895347, 0.11499221, 0.21742125, 0.07235454, -0.20731468, -0.14050148, -0.13629226, -0.10762253, -0.037572715, 0.025096059, 0.13854228));
    result += mul(conv2d_1_0_texOff(float2(0, 1)), float4x4(-0.0057440316, -1.0421077, -1.2486165, -1.2702764, -0.0064959745, 0.10872661, 0.2396473, -0.03633486, 0.17960645, -0.26594314, -0.11910224, -0.30076158, -0.18298545, -0.0035316695, 0.062204015, -0.36974114));
    result += mul(conv2d_1_0_texOff(float2(1, 1)), float4x4(-0.056661, 1.1751522, 0.3941314, 0.7767375, 0.014559706, -0.06263625, 0.19227074, -0.20788455, 0.09501717, 0.034079492, 0.06669195, 0.22303842, 0.025841638, -0.11585611, 0.016951745, 0.29505157));
    result += mul(conv2d_1_1_texOff(float2(-1, -1)), float4x4(0.39236626, 0.20790094, -0.35882658, -0.32753286, 0.024261013, 0.028498108, -0.030219533, 0.08684579, -0.0075397226, -0.065764576, -0.078874715, -0.2489706, 0.10573096, -0.05824668, -0.050766822, -0.0051559606));
    result += mul(conv2d_1_1_texOff(float2(0, -1)), float4x4(-0.12361742, 0.21435739, 0.10601367, -0.3074418, 0.29480368, 0.25744852, 0.020637518, 0.12709369, -0.23088132, -1.3187712, 0.23015307, 0.27084053, 0.035128582, -0.11053937, 0.060682125, -0.3746682));
    result += mul(conv2d_1_1_texOff(float2(1, -1)), float4x4(0.03769216, -0.050791573, 0.013949821, -0.053851034, 0.23206025, 1.5472457, -0.20905508, 0.24124593, -0.083613455, -1.2183553, 0.16187707, -0.47220066, -0.16389607, -1.4915924, -0.093669765, 0.12735969));
    result += mul(conv2d_1_1_texOff(float2(-1, 0)), float4x4(0.11359122, 0.21317953, -0.2854131, -0.05212575, -0.034172487, -0.041620836, 0.012191899, 0.08086835, -0.13628858, 0.09478358, -0.054523725, 0.0640467, 0.03960268, -0.041670598, -0.06735924, -0.12027836));
    result += mul(conv2d_1_1_texOff(float2(0, 0)), float4x4(0.3910543, -0.40020314, -0.032621518, -0.5630948, 0.18626158, -0.075502895, -0.23416606, 0.14312814, -0.73079926, -0.295574, 0.561242, -0.065812126, 0.024016157, 0.022435995, -0.1349801, 0.27300057));
    result += mul(conv2d_1_1_texOff(float2(1, 0)), float4x4(-0.16706812, -0.066321254, -0.057062898, 0.4443227, 0.058483806, 0.53187317, -0.0674255, 0.9356748, -0.008629555, -0.21394575, -0.16509426, -0.91222733, -0.029347135, -0.48837376, -0.4969213, -0.53777254));
    result += mul(conv2d_1_1_texOff(float2(-1, 1)), float4x4(0.04553135, -0.013839943, -0.09338917, 0.27556664, 0.081337914, 0.12279045, 0.019205736, 0.04967726, -0.015074711, 0.05812557, 0.038298994, -0.09074704, 0.010639862, -0.015736815, 0.0030932985, -0.0016413351));
    result += mul(conv2d_1_1_texOff(float2(0, 1)), float4x4(-0.04137299, -0.22907248, 0.13398276, 0.37713107, 0.067183696, -0.085011356, -0.011665301, 0.45076397, -0.034449093, -0.043588433, 0.00947799, -0.36405218, 0.16628245, 0.054975566, 0.03167458, -0.09813912));
    result += mul(conv2d_1_1_texOff(float2(1, 1)), float4x4(-0.06517379, 0.20642205, 0.11157918, -0.27304575, 0.0031954395, -0.1927721, -0.0019003913, 0.6138191, -0.11941135, 0.032949332, -0.0521811, -0.29868892, -0.002705818, -0.16481473, -0.040983956, -0.3468507));
    result += mul(conv2d_1_2_texOff(float2(-1, -1)), float4x4(-0.06538467, 0.09044791, -0.07703634, -0.09411588, 0.34142882, 0.12353218, -0.111447565, 0.8391204, -0.08035813, 0.10337552, 0.020741524, 0.027382735, -0.005969964, 0.021634694, 0.04043049, -0.056705765));
    result += mul(conv2d_1_2_texOff(float2(0, -1)), float4x4(-0.28164127, -0.45223945, 0.15462564, -0.12460015, -0.39189178, 0.35276568, 0.033688474, 0.9718588, -0.24079955, 0.31509155, 0.04708655, -0.07599852, -0.03512791, -0.18583517, -0.030928228, -0.14774935));
    result += mul(conv2d_1_2_texOff(float2(1, -1)), float4x4(0.1842524, 0.0030433086, 0.075150765, 0.19679375, 0.19247046, -0.030250177, -0.06994248, 0.27319065, -0.09918321, 0.21605903, 0.14399482, 0.061411664, 0.0317043, 0.23024723, -0.022572026, -0.27585843));
    result += mul(conv2d_1_2_texOff(float2(-1, 0)), float4x4(0.17867683, -0.21442306, 0.07002352, -0.11982447, 0.17456487, 0.70163083, 0.35833198, -0.4218817, -0.08642471, 0.18753386, 0.08246379, 0.103460915, -0.16495793, 0.04260013, 0.10095175, -0.09631633));
    result += mul(conv2d_1_2_texOff(float2(0, 0)), float4x4(0.20721564, 0.8622436, -0.27429, -0.7699969, 0.022362148, -0.70620453, 0.17909047, -1.3758086, 0.042303294, 0.17319015, 0.13412514, 0.25918168, -0.011338483, 0.36102182, 0.023044119, -0.194089));
    result += mul(conv2d_1_2_texOff(float2(1, 0)), float4x4(-0.05761861, 0.046321046, 0.10465949, 0.3133327, 0.030601311, 0.13649099, -0.016309083, -0.17556442, -0.11032381, 0.16765402, 0.25261846, 0.2029326, -0.19749878, 0.3098951, -0.041747943, -0.70022374));
    result += mul(conv2d_1_2_texOff(float2(-1, 1)), float4x4(0.11304138, -0.07230113, -0.03682564, -0.20679037, -0.10251529, 0.020741094, 0.16167079, 0.72618103, -0.023794848, 0.14600363, 0.049633823, 0.1761247, -0.069169916, 0.09782369, 0.070077375, 0.02089318));
    result += mul(conv2d_1_2_texOff(float2(0, 1)), float4x4(0.068394646, 0.089684464, -0.08461792, 0.69136304, 0.23900558, 0.72533345, 0.1382827, 0.54307395, -0.09134387, 0.15045057, -0.021550333, 0.019955346, 0.00096793013, 0.10959666, 0.18671048, -0.32979673));
    result += mul(conv2d_1_2_texOff(float2(1, 1)), float4x4(0.052417297, 0.09578193, 0.011406501, -0.48269963, 0.033308566, -0.14252158, -0.0056949253, -0.19196507, -0.022448128, 0.21927366, 0.09810581, 0.19338322, 0.026622828, 0.13936909, -0.06823349, -0.7605943));
    result += mul(conv2d_1_3_texOff(float2(-1, -1)), float4x4(-0.017573133, 0.13327186, 0.13617179, 0.042600993, -0.14403732, 0.25242755, 0.21254182, -0.09322919, -0.041762277, 0.10206624, -0.06097341, 0.083670296, 0.06172249, 0.02419519, 0.0010144901, 0.01927539));
    result += mul(conv2d_1_3_texOff(float2(0, -1)), float4x4(-0.039383788, -0.7178877, -0.06755693, -0.41525593, -0.11896611, 0.14200294, -0.37369728, -0.26055324, -0.09846504, -0.052315433, -0.014807762, -0.065948725, 0.041153066, -0.04715303, -0.22019948, -0.5388037));
    result += mul(conv2d_1_3_texOff(float2(1, -1)), float4x4(0.06641112, 0.09193711, 0.03774413, -0.24717455, 0.044628434, 0.29915488, 0.22905914, 0.15836492, -0.05236084, 0.07180532, 0.040351544, 0.2659413, 0.4629498, -0.77128196, -0.1738166, -0.24848436));
    result += mul(conv2d_1_3_texOff(float2(-1, 0)), float4x4(0.061137434, -0.014927852, -0.021920886, 0.3966293, 0.11061045, -0.040991914, 0.0035905573, 0.015106213, 0.10882679, -0.026795339, -0.022624342, -0.027262887, 0.067980446, 0.021795027, -0.0066688014, -0.04517336));
    result += mul(conv2d_1_3_texOff(float2(0, 0)), float4x4(0.19848305, -1.4593208, 0.6035147, 0.35423073, -0.0068916585, -0.001216771, 0.062235147, -0.096354604, 0.21444967, 0.25416553, -0.07393456, -0.060246654, -0.43960467, -0.49079996, 0.6814027, 0.14962484));
    result += mul(conv2d_1_3_texOff(float2(1, 0)), float4x4(0.07885259, -0.22042286, -0.013019417, -0.39285147, 0.041827675, 0.50102544, -0.11008076, 0.0861614, 0.020343844, 0.10926595, 0.16890776, 0.6490841, 0.10094334, -2.015963, -0.13425902, -1.4022644));
    result += mul(conv2d_1_3_texOff(float2(-1, 1)), float4x4(-0.13805336, -0.24635603, -0.08396985, -0.61145496, 0.15020561, 0.02556904, 0.022434305, -0.025977092, 0.022491982, 0.012352028, 0.08526008, -0.03644116, -0.07410636, -0.017045846, 0.016095793, 0.033953343));
    result += mul(conv2d_1_3_texOff(float2(0, 1)), float4x4(-0.09484077, 0.3043744, 0.4865856, -0.002300076, 0.15410735, 0.1313057, -0.011836678, -0.19705223, 0.10768164, 0.22546051, 0.0032063725, 0.0942055, 0.14003275, 0.12351202, 0.11833861, -0.44578964));
    result += mul(conv2d_1_3_texOff(float2(1, 1)), float4x4(-0.025251418, -0.062778525, -0.013419117, 0.0046717, 0.11577662, 0.3379935, 0.03158058, 0.10205679, 0.15625815, 0.22746506, 0.027108178, 0.14533278, 0.017807763, -0.28041193, -0.06621321, -0.7751486));
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
