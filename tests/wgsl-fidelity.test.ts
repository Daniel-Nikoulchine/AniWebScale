import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampTextureLoadCoordinates,
  createAnime4KShaderDevice,
  preserveAnime4KIntermediateRange,
} from '../src/shared/wgsl-fidelity';

describe('WGSL texture-load fidelity patch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('clamps signed and unsigned two-dimensional coordinates', () => {
    const source = `
fn first(tex: texture_2d<f32>, pos: vec2u) -> vec4f {
  return textureLoad(tex, vec2i(i32(pos.x) - 1, i32(pos.y) + 1), 0);
}
fn second(tex: texture_2d<f32>, pos: vec2u) -> vec4f {
  return textureLoad(tex, pos - vec2u(1, 2), 0u);
}`;

    const patched = clampTextureLoadCoordinates(source);

    expect(patched).toContain(
      'textureLoad(tex, clamp(vec2i(vec2i(i32(pos.x) - 1, i32(pos.y) + 1)), vec2i(0), vec2i(textureDimensions(tex)) - vec2i(1)), 0)',
    );
    expect(patched).toContain(
      'textureLoad(tex, clamp(vec2i(pos - vec2u(1, 2)), vec2i(0), vec2i(textureDimensions(tex)) - vec2i(1)), 0u)',
    );
  });

  it('handles balanced comments and nested calls', () => {
    const source = `
fn sample(inputTexture: texture_2d<f32>, enabled: bool) -> vec4f {
  return textureLoad(
    inputTexture /* comma, ) and /* nested */ text */,
    select(vec2i(-1), helper(vec2i(1, 2)), enabled), // comma, )
    0i
  );
}`;

    const patched = clampTextureLoadCoordinates(source);

    expect(patched).toContain('vec2i(select(vec2i(-1), helper(vec2i(1, 2)), enabled))');
    expect(patched).toContain('textureDimensions(inputTexture /* comma, ) and /* nested */ text */)');
  });

  it('does not change storage, array or nonzero-mip loads', () => {
    const source = `
@group(0) @binding(0) var storageTexture: texture_storage_2d<rgba16float, read>;
@group(0) @binding(1) var arrayTexture: texture_2d_array<f32>;
@group(0) @binding(2) var sampledTexture: texture_2d<f32>;
let storageValue = textureLoad(storageTexture, position);
let arrayValue = textureLoad(arrayTexture, position, layer, 0);
let mipValue = textureLoad(sampledTexture, position, 1);
`;

    expect(clampTextureLoadCoordinates(source)).toBe(source);
  });

  it('does not rewrite other three-argument textureLoad overloads', () => {
    const source = `
fn oneDimensional(tex: texture_1d<f32>, pos: u32) -> vec4f {
  return textureLoad(tex, pos, 0);
}
fn threeDimensional(tex: texture_3d<f32>, pos: vec3u) -> vec4f {
  return textureLoad(tex, pos, 0u);
}
fn multisampled(tex: texture_multisampled_2d<f32>, pos: vec2u) -> vec4f {
  return textureLoad(tex, pos, 0);
}
fn depth(tex: texture_depth_2d, pos: vec2u) -> f32 {
  return textureLoad(tex, pos, 0);
}`;

    expect(clampTextureLoadCoordinates(source)).toBe(source);
  });

  it('ignores texture declarations inside comments', () => {
    const source = `
/* fn fake(tex: texture_2d<f32>) -> vec4f { */
fn loadUnresolved(pos: vec2u) -> vec4f {
  return textureLoad(tex, pos, 0);
}
`;

    expect(clampTextureLoadCoordinates(source)).toBe(source);
  });

  it('is idempotent', () => {
    const once = clampTextureLoadCoordinates(`
fn load(tex: texture_2d<f32>, pos: vec2u) -> vec4f {
  return textureLoad(tex, pos, 0);
}`);
    expect(clampTextureLoadCoordinates(once)).toBe(once);
  });

  it('patches shader modules while preserving GPUDevice receivers and descriptors', () => {
    vi.stubGlobal('GPUTextureUsage', { COPY_SRC: 1 });
    let shaderDescriptor: GPUShaderModuleDescriptor | undefined;
    let textureDescriptor: GPUTextureDescriptor | undefined;
    let textureReceiver: unknown;
    let trackedTexture: GPUTexture | undefined;
    const shaderModule = {} as GPUShaderModule;
    const texture = {} as GPUTexture;
    const device = {
      createShaderModule(descriptor: GPUShaderModuleDescriptor) {
        shaderDescriptor = descriptor;
        return shaderModule;
      },
      createTexture(descriptor: GPUTextureDescriptor) {
        textureDescriptor = descriptor;
        textureReceiver = this;
        return texture;
      },
    } as unknown as GPUDevice;
    const proxy = createAnime4KShaderDevice(device, textureCreated => {
      trackedTexture = textureCreated;
    });
    const original = {
      label: 'Anime4K test shader',
      code: `
fn load(tex: texture_2d<f32>, pos: vec2u) -> vec4f {
  return textureLoad(tex, pos - vec2u(1), 0);
}`,
    } satisfies GPUShaderModuleDescriptor;

    expect(proxy.createShaderModule(original)).toBe(shaderModule);
    expect(shaderDescriptor).not.toBe(original);
    expect(shaderDescriptor?.label).toBe(original.label);
    expect(shaderDescriptor?.code).toContain('anime4k-texture-load-clamp:v1');
    expect(original.code).not.toContain('anime4k-texture-load-clamp:v1');
    expect(proxy.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: 0x04,
    })).toBe(texture);
    // COPY_SRC is injected so the final pipeline output can feed the frame
    // generation history copy; GPUTextureUsage.COPY_SRC === 0x01.
    expect(textureDescriptor?.usage).toBe(0x04 | 0x01);
    expect(textureReceiver).toBe(device);
    expect(trackedTexture).toBe(texture);
  });
});

describe('Anime4K intermediate-range fidelity patch', () => {
  const upstreamOverlay = `
@group(0) @binding(0) var mySampler: sampler;
@group(0) @binding(1) var tex_diff: texture_2d<f32>;
@group(0) @binding(2) var tex_origin: texture_2d<f32>;
@fragment
fn main(@location(0) fragUV: vec2<f32>) -> @location(0) vec4<f32> {
  let color_bilinear = textureSample(tex_origin, mySampler, fragUV);
  let color_addon = textureSample(tex_diff, mySampler, fragUV);
  return clamp(color_bilinear + color_addon,
    vec4<f32>(0., 0., 0., 0.), vec4<f32>(1., 1., 1., 1.));
}`;

  it('preserves over-range values in the exact upstream residual overlay', () => {
    const patched = preserveAnime4KIntermediateRange(upstreamOverlay);
    expect(patched).toContain('return color_bilinear + color_addon;');
    expect(patched).not.toContain('return clamp(color_bilinear + color_addon');
    expect(preserveAnime4KIntermediateRange(patched)).toBe(patched);
  });

  it('does not remove clamps from unrelated model shaders', () => {
    const modelShader = `
@group(0) @binding(0) var tex_diff: texture_2d<f32>;
fn main(value: vec4f) -> vec4f {
  return clamp(value, vec4f(0), vec4f(1));
}`;
    expect(preserveAnime4KIntermediateRange(modelShader)).toBe(modelShader);
  });
});
