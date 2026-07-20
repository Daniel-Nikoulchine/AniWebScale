Texture2D<float4> Previous : register(t0);
Texture2D<float4> Current : register(t1);
SamplerState LinearSampler : register(s0);

cbuffer InterpolationConstants : register(b0) {
  float InterpolationFactor;
  float3 Padding;
};

float CatmullRomWeight(float distance) {
  const float x = abs(distance);
  if (x < 1.0) return 1.5 * x * x * x - 2.5 * x * x + 1.0;
  if (x < 2.0) return -0.5 * x * x * x + 2.5 * x * x - 4.0 * x + 2.0;
  return 0.0;
}

float4 SampleCurrentCatmullRom(float2 uv, float2 dimensions) {
  const float2 texelPosition = uv * dimensions - 0.5;
  const float2 base = floor(texelPosition);
  const float2 fraction = texelPosition - base;
  float4 accumulated = 0.0;
  float weightSum = 0.0;

  [unroll]
  for (int y = -1; y <= 2; ++y) {
    [unroll]
    for (int x = -1; x <= 2; ++x) {
      const float2 offset = float2(x, y);
      const float weight = CatmullRomWeight(offset.x - fraction.x)
          * CatmullRomWeight(offset.y - fraction.y);
      const float2 sampleUv = (base + offset + 0.5) / dimensions;
      accumulated += Current.SampleLevel(LinearSampler, sampleUv, 0.0) * weight;
      weightSum += weight;
    }
  }
  return accumulated / max(weightSum, 0.00001);
}

float4 SampleCurrentAdaptiveArea(float2 uv, float2 dimensions, float2 footprint) {
  const uint countX = footprint.x > 1.05 ? (uint)clamp(ceil(footprint.x * 2.0), 2.0, 8.0) : 1U;
  const uint countY = footprint.y > 1.05 ? (uint)clamp(ceil(footprint.y * 2.0), 2.0, 8.0) : 1U;
  float4 accumulated = 0.0;
  [loop]
  for (uint y = 0U; y < countY; ++y) {
    const float offsetY = ((float(y) + 0.5) / float(countY) - 0.5) * footprint.y;
    [loop]
    for (uint x = 0U; x < countX; ++x) {
      const float offsetX = ((float(x) + 0.5) / float(countX) - 0.5) * footprint.x;
      accumulated += Current.SampleLevel(
          LinearSampler, uv + float2(offsetX, offsetY) / dimensions, 0.0);
    }
  }
  return accumulated / float(countX * countY);
}

float4 SamplePreviousAdaptiveArea(float2 uv, float2 dimensions, float2 footprint) {
  const uint countX = footprint.x > 1.05 ? (uint)clamp(ceil(footprint.x * 2.0), 2.0, 8.0) : 1U;
  const uint countY = footprint.y > 1.05 ? (uint)clamp(ceil(footprint.y * 2.0), 2.0, 8.0) : 1U;
  float4 accumulated = 0.0;
  [loop]
  for (uint y = 0U; y < countY; ++y) {
    const float offsetY = ((float(y) + 0.5) / float(countY) - 0.5) * footprint.y;
    [loop]
    for (uint x = 0U; x < countX; ++x) {
      const float offsetX = ((float(x) + 0.5) / float(countX) - 0.5) * footprint.x;
      accumulated += Previous.SampleLevel(
          LinearSampler, uv + float2(offsetX, offsetY) / dimensions, 0.0);
    }
  }
  return accumulated / float(countX * countY);
}

float Luma(float3 color) {
  return dot(color, float3(0.299, 0.587, 0.114));
}

float MotionError(float2 uv, float2 offset, float2 texel) {
  static const float2 taps[5] = {
      float2(0.0, 0.0), float2(2.0, 0.0), float2(-2.0, 0.0),
      float2(0.0, 2.0), float2(0.0, -2.0),
  };
  float error = 0.0;
  [unroll]
  for (uint index = 0U; index < 5U; ++index) {
    const float3 previous = Previous.SampleLevel(LinearSampler, uv + taps[index] * texel, 0.0).rgb;
    const float3 current = Current.SampleLevel(
        LinearSampler, uv + (taps[index] + offset) * texel, 0.0).rgb;
    error += abs(Luma(previous) - Luma(current));
  }
  return error / 5.0;
}

float4 SampleMotionIntermediate(float2 uv, float factor, float2 dimensions) {
  const float2 texel = 1.0 / dimensions;
  float2 bestOffset = 0.0;
  float bestError = 1000.0;
  [unroll]
  for (int y = -2; y <= 2; y += 2) {
    [unroll]
    for (int x = -2; x <= 2; x += 2) {
      const float2 candidate = float2(x, y);
      const float error = MotionError(uv, candidate, texel);
      if (error < bestError) {
        bestError = error;
        bestOffset = candidate;
      }
    }
  }
  const float2 motion = bestOffset * texel;
  const float4 previous = Previous.SampleLevel(LinearSampler, uv - motion * factor, 0.0);
  const float4 current = Current.SampleLevel(LinearSampler, uv + motion * (1.0 - factor), 0.0);
  const float confidence = 1.0 - smoothstep(0.035, 0.16, bestError);
  return lerp(current, lerp(previous, current, factor), confidence);
}

float4 PSMain(float4 position : SV_Position, float2 uv : TEXCOORD0) : SV_Target {
  uint width;
  uint height;
  Current.GetDimensions(width, height);
  const float2 dimensions = max(float2(width, height), float2(1.0, 1.0));
  const float2 sourcePixelsPerOutput = max(
      float2(1.0, 1.0), dimensions * float2(abs(ddx(uv.x)), abs(ddy(uv.y))));
  const float factor = saturate(InterpolationFactor);
  if (factor > 0.001 && factor < 0.999) {
    return SampleMotionIntermediate(uv, factor, dimensions);
  }
  if (max(sourcePixelsPerOutput.x, sourcePixelsPerOutput.y) > 1.05) {
    return factor < 0.5
        ? SamplePreviousAdaptiveArea(uv, dimensions, sourcePixelsPerOutput)
        : SampleCurrentAdaptiveArea(uv, dimensions, sourcePixelsPerOutput);
  }
  if (factor < 0.5) return Previous.SampleLevel(LinearSampler, uv, 0.0);
  return SampleCurrentCatmullRom(uv, dimensions);
}
