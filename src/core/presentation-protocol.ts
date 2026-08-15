/**
 * The frame-generation presentation protocol shared between the renderer's
 * TypeScript side and its inline WGSL shader.
 *
 * The renderer's adaptive-presentation pass blends the previous frame, the
 * current frame, or an intermediate catmull-rom interpolated frame. The
 * shader reads a single vec4f uniform (`interpolationFactor`); the first
 * component selects which frame to present. Keeping the constant values and
 * the contract in one module means the JS side and the WGSL side agree by
 * construction instead of by coincidence.
 *
 * WGSL contract (renderer.ts `adaptivePresentationWGSL`):
 *   @group(0) @binding(3) var<uniform> interpolationFactor: vec4f;
 *   interpolationFactor.x == 1.0  -> present the current frame
 *   interpolationFactor.x == 0.0  -> present the previous frame
 *   interpolationFactor.x == 0.5  -> present an intermediate interpolated frame
 */
export const PRESENT_CURRENT_FRAME = new Float32Array([1, 0, 0, 0]);
export const PRESENT_PREVIOUS_FRAME = new Float32Array([0, 0, 0, 0]);
export const PRESENT_INTERMEDIATE_FRAME = new Float32Array([0.5, 0, 0, 0]);

/** Human-readable name of a presentation mode for diagnostics. */
export type PresentationMode = 'current' | 'previous' | 'intermediate';

/** Resolve the presentation uniform for a mode (for tests/diagnostics). */
export function presentationUniformFor(mode: PresentationMode): Float32Array {
  switch (mode) {
    case 'current':
      return PRESENT_CURRENT_FRAME;
    case 'previous':
      return PRESENT_PREVIOUS_FRAME;
    case 'intermediate':
      return PRESENT_INTERMEDIATE_FRAME;
  }
}

/** The WGSL binding index of the interpolation uniform (must match the shader). */
export const INTERPOLATION_UNIFORM_BINDING = 3 as const;
