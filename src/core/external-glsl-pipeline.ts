import { Conv2d } from 'anime4k-webgpu/core';
import type { ExternalGlslModelDefinition } from '../shared/generated-external-glsl-models';
import type { Anime4KPipeline, PipelineConstructor } from './pipeline-types';

interface PipelineDescriptor {
  device: GPUDevice;
  inputTexture: GPUTexture;
}

const lumaWGSL = `
@group(0) @binding(0) var source_texture: texture_2d<f32>;
@group(0) @binding(1) var luma_texture: texture_storage_2d<rgba16float, write>;

@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {
  let dimensions = textureDimensions(luma_texture);
  if (pixel.x >= dimensions.x || pixel.y >= dimensions.y) { return; }
  let source = textureLoad(source_texture, vec2i(pixel.xy), 0);
  let luma = dot(source.rgb, vec3f(0.2126, 0.7152, 0.0722));
  textureStore(luma_texture, pixel.xy, vec4f(luma, 0.0, 0.0, 1.0));
}
`;

const pixelShuffleMergeWGSL = `
@group(0) @binding(0) var source_texture: texture_2d<f32>;
@group(0) @binding(1) var feature_texture: texture_2d<f32>;
@group(0) @binding(2) var source_sampler: sampler;
@group(0) @binding(3) var output_texture: texture_storage_2d<rgba16float, write>;

@compute
@workgroup_size(8, 8)
fn computeMain(@builtin(global_invocation_id) pixel: vec3u) {
  let output_dimensions = textureDimensions(output_texture);
  if (pixel.x >= output_dimensions.x || pixel.y >= output_dimensions.y) { return; }

  let uv = (vec2f(pixel.xy) + vec2f(0.5)) / vec2f(output_dimensions);
  let source = textureSampleLevel(source_texture, source_sampler, uv, 0.0);
  let feature_dimensions = textureDimensions(feature_texture);
  let feature_pixel = min(pixel.xy / vec2u(2), feature_dimensions - vec2u(1));
  let channel = (pixel.y % 2u) * 2u + (pixel.x % 2u);
  let enhanced_luma = clamp(textureLoad(feature_texture, vec2i(feature_pixel), 0)[channel], 0.0, 1.0);
  let source_luma = dot(source.rgb, vec3f(0.2126, 0.7152, 0.0722));
  let delta = enhanced_luma - source_luma;
  let color = clamp(source.rgb + vec3f(delta), vec3f(0.0), vec3f(1.0));
  textureStore(output_texture, pixel.xy, vec4f(color, source.a));
}
`;

class PixelShuffleColorMerge implements Anime4KPipeline {
  private readonly outputTexture: GPUTexture;
  private readonly pipeline: GPUComputePipeline;
  private readonly bindGroup: GPUBindGroup;

  constructor(device: GPUDevice, sourceTexture: GPUTexture, featureTexture: GPUTexture, name: string) {
    this.outputTexture = device.createTexture({
      label: `${name} output`,
      size: [featureTexture.width * 2, featureTexture.height * 2, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.pipeline = device.createComputePipeline({
      label: `${name} pixel shuffle`,
      layout: 'auto',
      compute: {
        module: device.createShaderModule({
          label: `${name} color reconstruction`,
          code: pixelShuffleMergeWGSL,
        }),
        entryPoint: 'computeMain',
      },
    });
    this.bindGroup = device.createBindGroup({
      label: `${name} color reconstruction inputs`,
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sourceTexture.createView() },
        { binding: 1, resource: featureTexture.createView() },
        {
          binding: 2,
          resource: device.createSampler({
            label: `${name} bilinear source sampler`,
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
          }),
        },
        { binding: 3, resource: this.outputTexture.createView() },
      ],
    });
  }

  public updateParam(): void {
    throw new Error('External GLSL models have no runtime parameters.');
  }

  public pass(encoder: GPUCommandEncoder): void {
    const pass = encoder.beginComputePass({ label: 'External GLSL pixel shuffle' });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(this.outputTexture.width / 8),
      Math.ceil(this.outputTexture.height / 8),
    );
    pass.end();
  }

  public getOutputTexture(): GPUTexture {
    return this.outputTexture;
  }
}

class ExternalGlslPipeline implements Anime4KPipeline {
  private readonly pipelines: Anime4KPipeline[] = [];

  constructor(
    device: GPUDevice,
    inputTexture: GPUTexture,
    model: ExternalGlslModelDefinition,
  ) {
    const resources = new Map<string, GPUTexture>();
    const luma = new Conv2d({
      device,
      inputTextures: [inputTexture],
      shaderWGSL: lumaWGSL,
      name: `${model.id}-luma`,
    });
    this.pipelines.push(luma);
    resources.set('LUMA', luma.getOutputTexture());

    model.passes.forEach((definition, index) => {
      const inputs = definition.bindings.map(binding => {
        const texture = resources.get(binding);
        if (!texture) throw new Error(`${model.displayName}: missing GLSL resource ${binding}.`);
        return texture;
      });
      const pipeline = new Conv2d({
        device,
        inputTextures: inputs,
        shaderWGSL: definition.wgsl,
        name: `${model.id}-${index}`,
      });
      this.pipelines.push(pipeline);
      resources.set(definition.output, pipeline.getOutputTexture());
    });

    const features = resources.get(model.pixelShuffleSource);
    if (!features) {
      throw new Error(`${model.displayName}: missing pixel-shuffle resource ${model.pixelShuffleSource}.`);
    }
    this.pipelines.push(new PixelShuffleColorMerge(device, inputTexture, features, model.id));
  }

  public updateParam(): void {
    throw new Error('External GLSL models have no runtime parameters.');
  }

  public pass(encoder: GPUCommandEncoder): void {
    this.pipelines.forEach(pipeline => pipeline.pass(encoder));
  }

  public getOutputTexture(): GPUTexture {
    return this.pipelines[this.pipelines.length - 1].getOutputTexture();
  }
}

export function createExternalGlslPipelineClass(
  model: ExternalGlslModelDefinition,
): PipelineConstructor {
  return class ExternalModelPipeline extends ExternalGlslPipeline {
    constructor({ device, inputTexture }: PipelineDescriptor) {
      super(device, inputTexture, model);
    }
  };
}
