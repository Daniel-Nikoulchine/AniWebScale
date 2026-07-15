export interface IntrinsicCaptureStageInput {
  intrinsicWidth: number;
  intrinsicHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

export interface IntrinsicCaptureStage {
  /** Capture-source geometry in CSS pixels. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Exact physical source and output extents used by the native renderer. */
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}

/**
 * Stage protected playback at its decoded resolution instead of allowing the
 * browser to upscale it before Windows Graphics Capture sees the frame.
 */
export function calculateIntrinsicCaptureStage(
  input: IntrinsicCaptureStageInput,
): IntrinsicCaptureStage {
  const dpr = Math.max(1, Number.isFinite(input.devicePixelRatio) ? input.devicePixelRatio : 1);
  const viewportWidth = Math.max(64, Number.isFinite(input.viewportWidth) ? input.viewportWidth : 64);
  const viewportHeight = Math.max(64, Number.isFinite(input.viewportHeight) ? input.viewportHeight : 64);
  const targetWidth = Math.max(64, Math.round(viewportWidth * dpr));
  const targetHeight = Math.max(64, Math.round(viewportHeight * dpr));
  const intrinsicWidth = Math.max(64, Math.round(
    Number.isFinite(input.intrinsicWidth) && input.intrinsicWidth > 0
      ? input.intrinsicWidth
      : targetWidth,
  ));
  const intrinsicHeight = Math.max(64, Math.round(
    Number.isFinite(input.intrinsicHeight) && input.intrinsicHeight > 0
      ? input.intrinsicHeight
      : targetHeight,
  ));
  const fitScale = Math.min(1, targetWidth / intrinsicWidth, targetHeight / intrinsicHeight);
  const sourceWidth = Math.max(64, Math.min(targetWidth, Math.round(intrinsicWidth * fitScale)));
  const sourceHeight = Math.max(64, Math.min(targetHeight, Math.round(intrinsicHeight * fitScale)));
  const width = sourceWidth / dpr;
  const height = sourceHeight / dpr;

  return {
    left: Math.max(0, (viewportWidth - width) / 2),
    top: Math.max(0, (viewportHeight - height) / 2),
    width,
    height,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
  };
}
