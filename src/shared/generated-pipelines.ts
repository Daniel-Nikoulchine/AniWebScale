import { Conv2d, DepthToSpace, Overlay } from 'anime4k-webgpu/core';
import { CNN_SOFT_UL_OUTPUT } from './generated-soft-output';
import type {
  Anime4KPipeline,
  GeneratedKernelSet,
  PipelineConstructor,
} from '../core/pipeline-types';

interface PipelineDescriptor {
  device: GPUDevice;
  inputTexture: GPUTexture;
}

abstract class GeneratedPipeline implements Anime4KPipeline {
  protected pipelines: Anime4KPipeline[] = [];

  public updateParam(): void {
    throw new Error('Generated Anime4K kernels have no runtime parameters.');
  }

  public pass(encoder: GPUCommandEncoder): void {
    this.pipelines.forEach(pipeline => pipeline.pass(encoder));
  }

  public getOutputTexture(): GPUTexture {
    return this.pipelines[this.pipelines.length - 1].getOutputTexture();
  }

  protected conv(
    device: GPUDevice,
    inputTextures: GPUTexture[],
    shaderWGSL: string,
    name: string,
  ): Anime4KPipeline {
    const pipeline = new Conv2d({ device, inputTextures, shaderWGSL, name });
    this.pipelines.push(pipeline);
    return pipeline;
  }
}

function createCnnSoftUl(kernels: GeneratedKernelSet): PipelineConstructor {
  return class CNNSoftUL extends GeneratedPipeline {
    constructor({ device, inputTexture }: PipelineDescriptor) {
      super();
      const groups: GPUTexture[][] = [];

      groups.push([
        this.conv(device, [inputTexture], kernels.conv2dtf, 'soft_ul_conv_0_0').getOutputTexture(),
        this.conv(device, [inputTexture], kernels.conv2dtf1, 'soft_ul_conv_0_1').getOutputTexture(),
        this.conv(device, [inputTexture], kernels.conv2dtf2, 'soft_ul_conv_0_2').getOutputTexture(),
      ]);

      for (let layer = 1; layer <= 7; layer += 1) {
        const previous = groups[layer - 1];
        groups.push([
          this.conv(device, previous, kernels[`conv2d${layer}tf`], `soft_ul_conv_${layer}_0`).getOutputTexture(),
          this.conv(device, previous, kernels[`conv2d${layer}tf1`], `soft_ul_conv_${layer}_1`).getOutputTexture(),
          this.conv(device, previous, kernels[`conv2d${layer}tf2`], `soft_ul_conv_${layer}_2`).getOutputTexture(),
        ]);
      }

      const outputInputs = [inputTexture, ...groups.slice(3).flat()];
      const correction = this.conv(device, outputInputs, CNN_SOFT_UL_OUTPUT, 'soft_ul_output');
      this.pipelines.push(new Overlay({
        device,
        inputTextures: [inputTexture, correction.getOutputTexture()],
        outputTextureSize: [inputTexture.width, inputTexture.height],
        name: 'soft_ul_overlay',
      }));
    }
  };
}

function createDenoiseCnnX2M(kernels: GeneratedKernelSet): PipelineConstructor {
  return class DenoiseCNNx2M extends GeneratedPipeline {
    constructor({ device, inputTexture }: PipelineDescriptor) {
      super();
      const featureTextures: GPUTexture[] = [];
      let currentInputs = [inputTexture];

      for (let layer = 0; layer <= 6; layer += 1) {
        const key = layer === 0 ? 'conv2dtf' : `conv2d${layer}tf`;
        const pipeline = this.conv(device, currentInputs, kernels[key], `denoise_m_conv_${layer}`);
        const output = pipeline.getOutputTexture();
        featureTextures.push(output);
        currentInputs = [output];
      }

      const finalFeatures = this.conv(
        device,
        featureTextures,
        kernels.conv2dlasttf,
        'denoise_m_last',
      ).getOutputTexture();
      this.pipelines.push(new DepthToSpace({
        device,
        inputTextures: [finalFeatures, finalFeatures, finalFeatures],
        name: 'denoise_m_depth_to_space',
      }));
      this.pipelines.push(new Overlay({
        device,
        inputTextures: [inputTexture, this.getOutputTexture()],
        outputTextureSize: [inputTexture.width * 2, inputTexture.height * 2],
        name: 'denoise_m_overlay',
      }));
    }
  };
}

function createDenoiseCnnX2Ul(kernels: GeneratedKernelSet): PipelineConstructor {
  return class DenoiseCNNx2UL extends GeneratedPipeline {
    constructor({ device, inputTexture }: PipelineDescriptor) {
      super();
      const groups: GPUTexture[][] = [];

      groups.push([
        this.conv(device, [inputTexture], kernels.conv2dtf, 'denoise_ul_conv_0_0').getOutputTexture(),
        this.conv(device, [inputTexture], kernels.conv2dtf1, 'denoise_ul_conv_0_1').getOutputTexture(),
        this.conv(device, [inputTexture], kernels.conv2dtf2, 'denoise_ul_conv_0_2').getOutputTexture(),
      ]);

      for (let layer = 1; layer <= 6; layer += 1) {
        const previous = groups[layer - 1];
        groups.push([
          this.conv(device, previous, kernels[`conv2d${layer}tf`], `denoise_ul_conv_${layer}_0`).getOutputTexture(),
          this.conv(device, previous, kernels[`conv2d${layer}tf1`], `denoise_ul_conv_${layer}_1`).getOutputTexture(),
          this.conv(device, previous, kernels[`conv2d${layer}tf2`], `denoise_ul_conv_${layer}_2`).getOutputTexture(),
        ]);
      }

      const finalInputs = groups.slice(2).flat();
      const finalOutputs = [
        this.conv(device, finalInputs, kernels.conv2dlasttf, 'denoise_ul_last_0').getOutputTexture(),
        this.conv(device, finalInputs, kernels.conv2dlasttf1, 'denoise_ul_last_1').getOutputTexture(),
        this.conv(device, finalInputs, kernels.conv2dlasttf2, 'denoise_ul_last_2').getOutputTexture(),
      ];
      this.pipelines.push(new DepthToSpace({
        device,
        inputTextures: finalOutputs,
        name: 'denoise_ul_depth_to_space',
      }));
      this.pipelines.push(new Overlay({
        device,
        inputTextures: [inputTexture, this.getOutputTexture()],
        outputTextureSize: [inputTexture.width * 2, inputTexture.height * 2],
        name: 'denoise_ul_overlay',
      }));
    }
  };
}

export function createGeneratedPipelineClass(
  className: 'CNNSoftUL' | 'DenoiseCNNx2M' | 'DenoiseCNNx2UL',
  kernels: GeneratedKernelSet,
): PipelineConstructor {
  switch (className) {
    case 'CNNSoftUL': return createCnnSoftUl(kernels);
    case 'DenoiseCNNx2M': return createDenoiseCnnX2M(kernels);
    case 'DenoiseCNNx2UL': return createDenoiseCnnX2Ul(kernels);
  }
}
