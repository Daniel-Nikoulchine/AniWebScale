import { DepthToSpace, Overlay } from 'anime4k-webgpu/core';
import type { Anime4KWebgpuModelDefinition, Anime4KWebgpuPassDefinition } from '../../.tmp/anime4k-bench/generated-anime4k-webgpu-models';
import type { Anime4KPipeline, PipelineConstructor } from '../../src/core/pipeline-types';

interface PipelineDescriptor {
  device: GPUDevice;
  inputTexture: GPUTexture;
  params?: { [key: string]: unknown };
}

/**
 * One generated compute dispatch. Tiled 3x3 passes stage their halo in
 * workgroup memory; the 1x1 output projection is a plain per-pixel read. Both
 * write an rgba16float storage texture at the same dimensions as their first
 * input, so no pass-level size bookkeeping is needed.
 */
class GeneratedComputePass implements Anime4KPipeline {
  private readonly outputTexture: GPUTexture;
  private readonly pipeline: GPUComputePipeline;
  private readonly bindGroup: GPUBindGroup;
  private readonly workgroupSize: number;

  constructor(
    device: GPUDevice,
    resources: ReadonlyMap<string, GPUTexture>,
    pass: Anime4KWebgpuPassDefinition,
    modelId: string,
  ) {
    const first = resources.get(pass.bindings[0]);
    if (!first) throw new Error(`${modelId}: missing input ${pass.bindings[0]}`);
    this.workgroupSize = pass.workgroupSize;
    this.outputTexture = device.createTexture({
      label: `${modelId}: ${pass.output}`,
      size: [first.width, first.height, 1],
      format: 'rgba16float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    });
    this.pipeline = device.createComputePipeline({
      label: `${modelId}: ${pass.description}`,
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ label: `${modelId}: ${pass.description}`, code: pass.wgsl }),
        entryPoint: 'computeMain',
      },
    });
    const entries: GPUBindGroupEntry[] = pass.bindings.map((name, index) => {
      const texture = resources.get(name);
      if (!texture) throw new Error(`${modelId}: missing resource ${name}`);
      return { binding: index, resource: texture.createView() };
    });
    entries.push({ binding: pass.bindings.length, resource: this.outputTexture.createView() });
    this.bindGroup = device.createBindGroup({
      label: `${modelId}: ${pass.description} inputs`,
      layout: this.pipeline.getBindGroupLayout(0),
      entries,
    });
  }

  public pass(encoder: GPUCommandEncoder): void {
    const dispatch = encoder.beginComputePass({ label: 'Anime4K generated pass' });
    this.encode(dispatch);
    dispatch.end();
  }

  /** Encode this dispatch into an already-open compute pass. */
  public encode(dispatch: GPUComputePassEncoder): void {
    dispatch.setPipeline(this.pipeline);
    dispatch.setBindGroup(0, this.bindGroup);
    dispatch.dispatchWorkgroups(
      Math.ceil(this.outputTexture.width / this.workgroupSize),
      Math.ceil(this.outputTexture.height / this.workgroupSize),
    );
  }

  public getOutputTexture(): GPUTexture {
    return this.outputTexture;
  }

  public destroy(): void {
    this.outputTexture.destroy();
  }
}

class Anime4kWebgpuPipeline implements Anime4KPipeline {
  private readonly pipelines: Anime4KPipeline[] = [];
  private readonly computePasses: GeneratedComputePass[] = [];

  constructor(device: GPUDevice, inputTexture: GPUTexture, model: Anime4KWebgpuModelDefinition) {
    const resources = new Map<string, GPUTexture>([['MAIN', inputTexture]]);
    for (const pass of model.passes) {
      const generated = new GeneratedComputePass(device, resources, pass, model.id);
      this.pipelines.push(generated);
      this.computePasses.push(generated);
      resources.set(pass.output, generated.getOutputTexture());
    }
    const shuffleSources = model.pixelShuffleSources;
    if (shuffleSources && shuffleSources.length > 0) {
      const features = shuffleSources.map(name => {
        const texture = resources.get(name);
        if (!texture) throw new Error(`${model.id}: missing pixel-shuffle source ${name}`);
        return texture;
      });
      // The M variants run one feature texture through the 3-texture shuffle.
      const shuffleInputs = features.length === 1
        ? [features[0], features[0], features[0]]
        : features;
      const depthToSpace = new DepthToSpace({
        device,
        inputTextures: shuffleInputs,
        name: `${model.id}_depth_to_space`,
      });
      this.pipelines.push(depthToSpace as unknown as Anime4KPipeline);
      const overlay = new Overlay({
        device,
        inputTextures: [inputTexture, depthToSpace.getOutputTexture()],
        outputTextureSize: [inputTexture.width * 2, inputTexture.height * 2],
        name: `${model.id}_overlay`,
      });
      this.pipelines.push(overlay as unknown as Anime4KPipeline);
    }
  }

  public pass(encoder: GPUCommandEncoder): void {
    // One compute pass for the whole convolution chain: WebGPU inserts the
    // required barriers between dispatches automatically, so the per-layer
    // begin/end pass objects are pure overhead. Render tails (pixel shuffle,
    // overlay) keep their own passes.
    if (this.computePasses.length > 0) {
      const dispatch = encoder.beginComputePass({ label: 'Anime4K generated chain' });
      for (const compute of this.computePasses) compute.encode(dispatch);
      dispatch.end();
    }
    const tail = this.pipelines.slice(this.computePasses.length);
    for (const pipeline of tail) pipeline.pass(encoder);
  }

  public getOutputTexture(): GPUTexture {
    return this.pipelines[this.pipelines.length - 1].getOutputTexture();
  }

  public destroy(): void {
    for (const pipeline of this.pipelines) pipeline.destroy?.();
  }
}

export function createAnime4kWebgpuPipelineClass(
  model: Anime4KWebgpuModelDefinition,
): PipelineConstructor {
  return class GeneratedAnime4kPipeline extends Anime4kWebgpuPipeline {
    constructor({ device, inputTexture }: PipelineDescriptor) {
      super(device, inputTexture, model);
    }
  };
}
