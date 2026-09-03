/**
 * Mapping between the registered RealESRGAN pipeline classNames and the ONNX
 * model files bundled with the extension. The file names match the artifacts
 * recorded in models/realesrgan/SOURCE_REVISION.json.
 */

export const REALESRGAN_CLASS_TO_MODEL_FILE: Record<string, string> = {
  RealEsrganX4: 'RealESR-AnimeVideo-v3_x4.onnx',
};

/** Optional optimized model. It is used only when the packaged asset exists. */
export const REALESRGAN_CLASS_TO_FP16_MODEL_FILE: Record<string, string> = {
  RealEsrganX4: 'RealESR-AnimeVideo-v3_x4.fp16.onnx',
};

export const REALESRGAN_CLASS_TO_INT8_MODEL_FILE: Record<string, string> = {
  RealEsrganX4: 'RealESR-AnimeVideo-v3_x4.int8.static.onnx',
};

export function realEsrganInt8ModelFileForClass(className: string): string {
  const file = REALESRGAN_CLASS_TO_INT8_MODEL_FILE[className];
  if (!file) throw new Error(`Unknown RealESRGAN INT8 pipeline class: ${className}`);
  return file;
}

export function realEsrganFp16ModelFileForClass(className: string): string {
  const file = REALESRGAN_CLASS_TO_FP16_MODEL_FILE[className];
  if (!file) throw new Error(`Unknown RealESRGAN FP16 pipeline class: ${className}`);
  return file;
}

export function realEsrganModelFileForClass(className: string): string {
  const file = REALESRGAN_CLASS_TO_MODEL_FILE[className];
  if (!file) throw new Error(`Unknown RealESRGAN pipeline class: ${className}`);
  return file;
}
