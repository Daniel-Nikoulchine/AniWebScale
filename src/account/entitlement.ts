import type { EnhancementMode } from '../types';

// The extension is fully free: every enhancement mode, renderer backend and
// frame generation are available without an account or license. The helpers
// below only classify modes for the UI; there is no longer any Pro gating.

const AI_MODES = new Set<EnhancementMode>(['CNNX2', 'ARTCNN', 'ACNET', 'ARNET']);

export function isProMode(mode: EnhancementMode): boolean {
  return AI_MODES.has(mode);
}
