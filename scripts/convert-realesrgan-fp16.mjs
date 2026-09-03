import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const input = 'models/realesrgan/RealESR-AnimeVideo-v3_x4.onnx';
const output = 'models/realesrgan/RealESR-AnimeVideo-v3_x4.fp16.onnx';

if (!existsSync(input)) throw new Error(`Missing input model: ${input}`);
// onnxconverter_common ships no CLI: call the library function directly.
// (A previous revision ran `python -m onnxconverter_common.float16 ...`,
// which exits 0 without writing anything.)
const convert = `from onnx import load as onnx_load, save as onnx_save
from onnxconverter_common.float16 import convert_float_to_float16
fp16 = convert_float_to_float16(onnx_load('${input}'))
onnx_save(fp16, '${output}')
`;
try {
  execFileSync('python3', ['-c', convert], { stdio: 'inherit' });
} catch {
  console.error('FP16 conversion requires: python3 -m pip install onnx onnxconverter-common');
  process.exitCode = 1;
}
