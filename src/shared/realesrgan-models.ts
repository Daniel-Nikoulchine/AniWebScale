/**
 * Mapping between the registered RealESRGAN pipeline classNames and the ONNX
 * model files bundled with the extension. The file names match the artifacts
 * produced by scripts/convert-realesrgan-onnx.py and recorded in
 * models/realesrgan/SOURCE_REVISION.json.
 */

export const REALESRGAN_CLASS_TO_MODEL_FILE: Record<string, string> = {
  RealEsrganX4: 'RealESR-AnimeVideo-v3_x4.onnx',
};

export function realEsrganModelFileForClass(className: string): string {
  const file = REALESRGAN_CLASS_TO_MODEL_FILE[className];
  if (!file) throw new Error(`Unknown RealESRGAN pipeline class: ${className}`);
  return file;
}
