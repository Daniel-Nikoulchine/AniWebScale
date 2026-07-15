// Generated file. Do not edit.
// Generator: native/tools/generate_anime4k_models.py v1
// Upstream source: glsl/ArtCNN_C4F16.glsl:221
// Pass: 006 - ArtCNN C4F16 (Conv2D-1-ReLU)
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
    float4 result = float4(0.012058452, 0.035459418, 0.0020235123, 0.02138105);
    result += mul(conv2d_0_texOff(float2(-1, -1)), float4x4(-0.27048945, -0.15216513, -0.56439227, -0.72569335, 0.06902982, -0.124421865, -0.0028085725, -0.46687803, -0.27972996, -0.30724597, 0.36219263, -0.32720062, 0.01755325, -0.11166817, 0.041267466, 0.050279096));
    result += mul(conv2d_0_texOff(float2(0, -1)), float4x4(0.123987, 0.0635712, 0.1900054, 0.1515304, 0.010567942, -0.016811093, 0.06286553, -0.17851111, 0.1753958, 0.21771027, 0.08844965, -0.56422937, 0.0749339, 0.1462589, -0.07169983, -0.12169353));
    result += mul(conv2d_0_texOff(float2(1, -1)), float4x4(0.13043118, 0.38533115, -0.08687753, -0.098886535, 0.020644201, 0.14750102, 0.12408261, -0.41414288, -0.039991155, 0.24843374, -0.33877984, -0.21652898, -0.06514563, -0.20232098, -0.13754359, -0.029486215));
    result += mul(conv2d_0_texOff(float2(-1, 0)), float4x4(-0.10021081, -0.1358276, 0.6510585, -0.1789248, 0.0530571, -0.21948235, 0.4442679, -0.21620616, -0.09634525, -0.1523073, -0.61563313, 0.50299287, 0.09090999, 0.10945205, -0.04221829, 0.11210599));
    result += mul(conv2d_0_texOff(float2(0, 0)), float4x4(-0.13971923, 0.036167882, 0.16633019, 0.13758305, -0.14243245, 0.13257267, 0.22588421, 0.077722326, -0.496797, -0.06929072, 0.14952676, 0.16488895, 0.29225838, 0.11251328, 0.161039, 0.09794535));
    result += mul(conv2d_0_texOff(float2(1, 0)), float4x4(-0.2226956, -0.0019855483, 0.25955975, -0.02854396, -0.09928865, 0.42465854, -0.049392145, 0.16713408, -0.07152766, 0.2951388, -0.07461576, 0.20836486, 0.1249179, -0.03861313, 0.11316237, 0.19167934));
    result += mul(conv2d_0_texOff(float2(-1, 1)), float4x4(-0.17385809, 0.008925299, -0.387115, 0.19814822, 0.1263724, -0.05977668, -0.54597026, 0.49932623, -0.022810824, 0.03269762, 0.59250075, -0.007137566, -0.08911065, -0.03264151, -0.0033877613, -0.11269822));
    result += mul(conv2d_0_texOff(float2(0, 1)), float4x4(0.13175856, -0.0764686, 0.08803108, 0.1433389, 0.45028248, 0.09578076, -0.11786847, 0.16706738, 0.60061747, 0.027031219, 0.026740124, 0.035115507, -0.24601386, 0.14495645, -0.03162993, -0.17910877));
    result += mul(conv2d_0_texOff(float2(1, 1)), float4x4(-0.006928952, 0.1629482, -0.114114836, -0.068467826, -0.042800624, 0.10178578, -0.19198069, 0.081305355, -0.010695266, -0.13109359, -0.18033825, -0.076629326, -0.08399564, -0.10613263, -0.04830894, -0.07337152));
    result += mul(conv2d_1_texOff(float2(-1, -1)), float4x4(-0.0892244, 0.047263846, 0.73766726, -0.5480812, 0.28793567, 0.15710412, -0.32357463, 0.6721122, -0.1833216, -0.08243846, -1.0102098, -0.23818539, 0.051962975, -0.11682391, 0.42990884, -0.80880654));
    result += mul(conv2d_1_texOff(float2(0, -1)), float4x4(-0.055735633, 0.10928957, 0.16485757, -0.041874524, -0.12380668, -0.27412575, 0.062253665, -0.24108793, -0.26011714, 0.1858366, 0.34453288, 0.16818003, -0.1146422, -0.08572841, -0.110089466, -0.0513213));
    result += mul(conv2d_1_texOff(float2(1, -1)), float4x4(0.009881801, -0.05057188, 0.3933309, -0.11649382, 0.0070847427, 0.052101552, 0.1456722, -0.023981981, 0.20509958, -0.10847739, -0.19705199, 0.26608458, 0.10968863, 0.029413933, -0.1456579, 0.4807913));
    result += mul(conv2d_1_texOff(float2(-1, 0)), float4x4(-0.38067463, -0.04243029, -0.3925418, -0.42448673, 0.26709786, 0.059117507, 0.026020754, 0.5621717, 0.2119238, -0.11214634, 1.4102949, -0.12251065, -0.5040687, -0.09616722, 0.76216185, 0.25918564));
    result += mul(conv2d_1_texOff(float2(0, 0)), float4x4(-0.04778037, 0.25219002, -0.4696615, -0.22104095, -0.05839358, -0.2547952, 0.015254039, 0.06160808, 0.4099829, -0.092901774, 0.40927598, -0.02063658, 0.21946512, -0.0024611873, -0.30187133, -0.49522907));
    result += mul(conv2d_1_texOff(float2(1, 0)), float4x4(-0.033961415, -0.17669849, -0.2705705, -0.037797462, 0.11113812, 0.25503772, 0.11605272, -0.12802775, 0.00088775234, 0.26074794, 0.15172206, 0.08769989, -0.11901896, 0.07713709, -0.039179455, 0.43932754));
    result += mul(conv2d_1_texOff(float2(-1, 1)), float4x4(-0.14061785, -0.19862945, 0.100173995, -0.13494575, 0.3124522, -0.10799204, -0.030452548, 0.5401654, -0.05634719, -0.015557984, -1.4267026, -0.044390813, 0.8323417, -0.37981972, -0.86465156, -0.5436853));
    result += mul(conv2d_1_texOff(float2(0, 1)), float4x4(0.2967579, 0.029478623, 0.019859063, 0.31079462, 0.21380939, -0.22567141, -0.18742774, 0.20253386, -0.12506099, 0.0070204637, 0.21994108, -0.053757507, -0.29969767, 0.3646486, 0.32239926, -0.015044463));
    result += mul(conv2d_1_texOff(float2(1, 1)), float4x4(-0.029350266, 0.0402756, -0.061346106, 0.20011136, -0.07884663, -0.10585681, -0.10629222, 0.018422162, -0.14510909, 0.1292288, 0.099847905, 0.0203754, -0.113875575, 0.13771832, 0.0040402007, 0.4012859));
    result += mul(conv2d_2_texOff(float2(-1, -1)), float4x4(-0.099291615, -0.057911653, 0.41263682, -0.19909443, 0.0036022263, 0.100471996, 0.18956554, -0.28363618, 0.043008607, 0.0035231092, 0.52729076, -0.09314525, -0.06949709, 0.02968905, 1.0775689, -0.77997947));
    result += mul(conv2d_2_texOff(float2(0, -1)), float4x4(0.24712528, -0.10583815, 0.37779632, -1.077764, 0.16624779, -0.022670645, 0.06552302, -0.2871312, 0.10898993, -0.187577, -0.533865, 0.7048716, 0.0812303, 0.049407665, -0.54117566, 0.42726758));
    result += mul(conv2d_2_texOff(float2(1, -1)), float4x4(0.09352304, -0.06986354, -0.25987706, -0.048131682, -0.04950373, 0.009200149, -0.1436869, 0.049079474, -0.0481729, 0.097965464, -0.4278237, -0.8274962, -0.01191229, -0.14893481, -0.11789976, -0.19409682));
    result += mul(conv2d_2_texOff(float2(-1, 0)), float4x4(0.011703021, -0.09205684, -0.27635732, 0.69008315, -0.18548134, 0.059267413, -0.22924715, 0.68566036, -0.16586253, 0.07831387, 0.37324068, 0.19373812, -0.07427127, 0.01235896, -0.2959704, -0.17499664));
    result += mul(conv2d_2_texOff(float2(0, 0)), float4x4(-0.35970524, -0.19255517, 0.04412487, 0.0052177566, -0.53174955, -0.61505544, -0.18177322, -0.11955076, -0.23533337, -0.69158685, 0.24462491, -0.08451503, -0.07140216, -0.028848095, 0.4301919, -0.2763707));
    result += mul(conv2d_2_texOff(float2(1, 0)), float4x4(-0.2057636, -0.11039615, 0.043038752, -0.06468883, 0.038858563, 0.81524706, 0.25682005, 0.04588688, 0.08548999, 1.3636647, 0.5434624, -0.10513345, 0.09528403, 0.08614796, -0.10576254, 0.10042762));
    result += mul(conv2d_2_texOff(float2(-1, 1)), float4x4(0.27273422, -0.1191354, 0.43636876, 0.13831557, 0.27879697, 0.027796188, 0.22091848, 0.39287913, 0.01633617, -0.1941439, 0.066316046, 0.34854794, 0.2038614, -0.008311466, -0.25652653, 0.6412611));
    result += mul(conv2d_2_texOff(float2(0, 1)), float4x4(0.29463226, -0.0009987323, -0.2013805, -0.02519769, 0.3210097, -0.26492965, -0.07431939, 0.16753961, 0.49159908, 0.1136095, -0.7062503, 0.042610943, -0.025232885, -0.19175045, -0.0707381, 0.1349151));
    result += mul(conv2d_2_texOff(float2(1, 1)), float4x4(0.0056497073, -0.15268354, -0.16845344, -0.22153054, 0.004310382, -0.0057750405, -0.15224794, 0.114378236, -0.17400911, -0.15607373, -0.15479787, -0.17152087, -0.23364085, 0.22582379, -0.098124325, 0.11095499));
    result += mul(conv2d_3_texOff(float2(-1, -1)), float4x4(0.09927786, 0.11992528, 0.4470019, 0.15784584, 0.16774814, 0.023916934, 0.6016653, 0.2514428, 0.07814069, 0.019986678, -0.22482115, 0.36261928, -0.027704092, 0.034857333, -0.030249538, 0.45752984));
    result += mul(conv2d_3_texOff(float2(0, -1)), float4x4(0.26234362, -0.14162499, 0.024117418, -0.11694994, -0.22016199, 0.02056312, -0.0062089683, -0.646424, -0.1219842, -0.086772054, 0.09396628, 0.11092015, -0.03297434, -0.11729525, -0.02628596, 0.0041183275));
    result += mul(conv2d_3_texOff(float2(1, -1)), float4x4(0.19978689, 0.35821435, 0.2069716, 0.02233376, -0.08985767, -0.15527199, 0.32737797, -0.05527474, 0.06361696, 0.15971066, -0.030555587, -0.06871243, 0.10211239, 0.14210403, 0.07950669, -0.16530086));
    result += mul(conv2d_3_texOff(float2(-1, 0)), float4x4(-0.052045558, 0.03557603, -0.4090573, -0.03590507, 0.036470745, 0.29859757, -0.75994164, 0.029404676, 0.11688835, -0.16666003, 0.03414285, 0.00035598327, -0.007650666, 0.11415025, -0.011377247, -0.07922599));
    result += mul(conv2d_3_texOff(float2(0, 0)), float4x4(-0.008035429, -0.15122312, -0.32955846, -0.4162706, 0.21801671, -0.2775352, 0.09475202, 0.053313497, -0.17902707, 0.114835344, -0.03138573, 0.04988764, 0.08832104, -0.35015774, 0.0010382214, 0.12586756));
    result += mul(conv2d_3_texOff(float2(1, 0)), float4x4(-0.08303971, 0.054687563, 0.04399768, -0.12401692, -0.1373685, 0.036890626, -0.39018935, 0.18237384, 0.1728456, 0.27233353, 0.16889283, -0.29278636, -0.19187987, -0.23390493, -0.13853998, 0.0646253));
    result += mul(conv2d_3_texOff(float2(-1, 1)), float4x4(-0.02163818, 0.00910984, 0.07445484, 0.3016377, 0.0017149409, 0.0248837, 0.5699882, 0.4462191, 0.12150789, -0.08298095, 0.1884362, 0.015103644, 0.12861355, -0.037176445, 0.15049104, 0.12742098));
    result += mul(conv2d_3_texOff(float2(0, 1)), float4x4(-0.3739506, -0.16414681, -0.038746264, 0.22043437, 0.18799178, -0.08257279, -0.6567427, -0.17414452, 0.74977505, 0.20972586, 0.0073756315, 0.14346273, 0.22649907, -0.14069432, 0.1924944, 0.025278006));
    result += mul(conv2d_3_texOff(float2(1, 1)), float4x4(-0.5594325, -0.010090559, 0.1471611, 0.17096616, 0.13121603, 0.015675036, 0.2369946, -0.061505888, 0.24923263, -0.15643363, -0.18878439, -0.06637364, 0.18180172, 0.15890859, -0.054897558, 0.009285086));
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
