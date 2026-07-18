declare module 'anime4k-webgpu/core' {
  interface Pipeline {
    updateParam(param?: string, value?: unknown): void;
    pass(encoder: GPUCommandEncoder): void;
    getOutputTexture(): GPUTexture;
  }

  export class Conv2d implements Pipeline {
    constructor(options: {
      device: GPUDevice;
      inputTextures: GPUTexture[];
      shaderWGSL: string;
      name?: string;
    });
    updateParam(param?: string, value?: unknown): void;
    pass(encoder: GPUCommandEncoder): void;
    getOutputTexture(): GPUTexture;
  }

  export class DepthToSpace implements Pipeline {
    constructor(options: { device: GPUDevice; inputTextures: GPUTexture[]; name?: string });
    updateParam(param?: string, value?: unknown): void;
    pass(encoder: GPUCommandEncoder): void;
    getOutputTexture(): GPUTexture;
  }

  export class Overlay implements Pipeline {
    constructor(options: {
      device: GPUDevice;
      inputTextures: GPUTexture[];
      outputTextureSize: number[];
      fragmentWGSL?: string;
      name?: string;
    });
    updateParam(param?: string, value?: unknown): void;
    pass(encoder: GPUCommandEncoder): void;
    getOutputTexture(): GPUTexture;
  }
}

declare module 'anime4k-webgpu/common' {
  export const ClampHighlights: unknown;
}

declare module 'anime4k-webgpu/quality-m' {
  export const CNNM: unknown;
  export const CNNSoftM: unknown;
  export const CNNx2M: unknown;
}

declare module 'anime4k-webgpu/quality-vl' {
  export const CNNVL: unknown;
  export const CNNSoftVL: unknown;
  export const CNNx2VL: unknown;
  export const DenoiseCNNx2VL: unknown;
}

declare module 'anime4k-webgpu/quality-ul' {
  export const CNNUL: unknown;
  export const CNNx2UL: unknown;
}

declare module 'anime4k-model/cnn-soft-ul' {
  const model: Readonly<Record<string, string>>;
  export default model;
}

declare module 'anime4k-model/denoise-cnn-x2-m' {
  const model: Readonly<Record<string, string>>;
  export default model;
}

declare module 'anime4k-model/denoise-cnn-x2-ul' {
  const model: Readonly<Record<string, string>>;
  export default model;
}

declare module 'anime4k-model/artcnn-x2' {
  const model: unknown;
  export default model;
}

declare module 'anime4k-model/acnet-x2' {
  const model: unknown;
  export default model;
}

declare module 'anime4k-model/arnet-x2' {
  const model: unknown;
  export default model;
}
