export interface FullscreenExitFrameResponse {
  ok?: boolean;
  fullscreenActive?: boolean;
}

export type FullscreenExitState = 'exited' | 'active' | 'unknown';

/**
 * The top document is authoritative for the Fullscreen API stack. When a
 * cross-origin child owns fullscreen, the top document still exposes the
 * fullscreen iframe as document.fullscreenElement. A source-frame response is
 * therefore only a fallback when the top content script cannot be reached.
 */
export function resolveFullscreenExitState(
  topFrame: FullscreenExitFrameResponse | null,
  sourceFrame: FullscreenExitFrameResponse | null,
): FullscreenExitState {
  const authoritative = topFrame?.ok === true && typeof topFrame.fullscreenActive === 'boolean'
    ? topFrame
    : sourceFrame?.ok === true && typeof sourceFrame.fullscreenActive === 'boolean'
      ? sourceFrame
      : null;
  if (!authoritative) return 'unknown';
  return authoritative.fullscreenActive ? 'active' : 'exited';
}
