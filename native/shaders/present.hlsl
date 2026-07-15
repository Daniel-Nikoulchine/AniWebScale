Texture2D<float4> Source : register(t0);
SamplerState LinearSampler : register(s0);

float CatmullRomWeight(float distance) {
  const float x = abs(distance);
  if (x <= 1.0) return 1.5 * x * x * x - 2.5 * x * x + 1.0;
  if (x < 2.0) return -0.5 * x * x * x + 2.5 * x * x - 4.0 * x + 2.0;
  return 0.0;
}

float4 SampleCatmullRom(float2 uv, float2 sourceSize) {
  const float2 pixel = uv * sourceSize - 0.5;
  const float2 base = floor(pixel);
  const float2 fraction = pixel - base;
  float4 result = 0.0;
  float totalWeight = 0.0;
  [unroll]
  for (int y = -1; y <= 2; ++y) {
    const float wy = CatmullRomWeight(float(y) - fraction.y);
    [unroll]
    for (int x = -1; x <= 2; ++x) {
      const float wx = CatmullRomWeight(float(x) - fraction.x);
      const float weight = wx * wy;
      const float2 sampleUv = (base + float2(x, y) + 0.5) / sourceSize;
      result += Source.SampleLevel(LinearSampler, sampleUv, 0.0) * weight;
      totalWeight += weight;
    }
  }
  return saturate(result / max(totalWeight, 0.00001));
}

float4 SampleAdaptiveArea(float2 uv, float2 sourceSize, float2 footprint) {
  const int countX = footprint.x > 1.05 ? clamp((int)ceil(footprint.x * 2.0), 2, 8) : 1;
  const int countY = footprint.y > 1.05 ? clamp((int)ceil(footprint.y * 2.0), 2, 8) : 1;
  float4 result = 0.0;
  [loop]
  for (int y = 0; y < countY; ++y) {
    const float offsetY = ((float(y) + 0.5) / float(countY) - 0.5) * footprint.y;
    [loop]
    for (int x = 0; x < countX; ++x) {
      const float offsetX = ((float(x) + 0.5) / float(countX) - 0.5) * footprint.x;
      result += Source.SampleLevel(LinearSampler, uv + float2(offsetX, offsetY) / sourceSize, 0.0);
    }
  }
  return saturate(result / float(countX * countY));
}

float4 PSMain(float4 position : SV_Position, float2 uv : TEXCOORD0) : SV_Target {
  uint width;
  uint height;
  Source.GetDimensions(width, height);
  const float2 sourceSize = max(float2(width, height), float2(1.0, 1.0));
  const float2 sourcePixelsPerOutput = max(
      float2(1.0, 1.0), sourceSize * float2(abs(ddx(uv.x)), abs(ddy(uv.y))));
  if (max(sourcePixelsPerOutput.x, sourcePixelsPerOutput.y) > 1.05) {
    return SampleAdaptiveArea(uv, sourceSize, sourcePixelsPerOutput);
  }
  return SampleCatmullRom(uv, sourceSize);
}
