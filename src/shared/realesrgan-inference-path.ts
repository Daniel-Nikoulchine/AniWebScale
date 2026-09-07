/**
 * Inference-path selection for the RealESRGAN drain: which form the frame
 * takes into inference, and which runner serves it. Pure functions, zero
 * imports: the "which input does this path accept" knowledge lives here,
 * not scattered across drain conditionals. The drain consumes the tag and
 * gets narrowed inputs back, so it cannot mismatch path and buffer.
 */

/** Input-buffer plan: tight RGBA8 (native fast path) or planar float. */
export type InferenceInputPlan = 'tight-rgba' | 'planar';

export interface InferenceInputCaps {
  hasRunner: boolean;
  hasModelUrl: boolean;
  /** Runner offers the tight-RGBA entry point (native client only). */
  rgbaCapable: boolean;
  readbackRgba8: boolean;
  /** First result landed (CPU prime fallback still owns the canvas before). */
  primed: boolean;
}

/**
 * Buffer acquisition plan. The fast path needs every condition: a live
 * RGBA-capable runner, 8-bit readback, and the warmup milestone behind us
 * (the first frame always takes the planar path, which is what the one-shot
 * color diagnostic samples).
 */
export function planInferenceInput(caps: InferenceInputCaps): InferenceInputPlan {
  return caps.hasRunner && caps.hasModelUrl && caps.rgbaCapable
    && caps.readbackRgba8 && caps.primed
    ? 'tight-rgba'
    : 'planar';
}

export type RunnerPath =
  | { kind: 'runner-rgba'; modelUrl: string; rgba: Uint8Array }
  | { kind: 'runner-planar'; modelUrl: string; planar: Float32Array }
  | { kind: 'session'; planar: Float32Array }
  | { kind: 'none'; hasRunnerBinding: boolean };

export interface RunnerPathState {
  runner: unknown;
  modelUrl: string | null;
  rgba: Uint8Array | null;
  planar: Float32Array | null;
}

/**
 * Dispatch tag for the unpacked inputs. A binding is a live runner plus its
 * model URL; it serves tight RGBA when present, planar otherwise. Without
 * a binding only planar input can reach the main-thread session. `none`
 * keeps the drain's two distinct diagnostics (caller picks the message by
 * hasRunnerBinding).
 */
export function selectRunnerPath(state: RunnerPathState): RunnerPath {
  if (state.runner !== null && state.modelUrl !== null) {
    const modelUrl = state.modelUrl;
    if (state.rgba) return { kind: 'runner-rgba', modelUrl, rgba: state.rgba };
    if (state.planar) return { kind: 'runner-planar', modelUrl, planar: state.planar };
    return { kind: 'none', hasRunnerBinding: true };
  }
  if (state.planar) return { kind: 'session', planar: state.planar };
  return { kind: 'none', hasRunnerBinding: false };
}
