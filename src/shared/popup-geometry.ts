export interface VideoCaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoCaptureRegionInput {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}

/** Converts a visible CSS-pixel video rectangle into physical client pixels
 * for the native capture. Tiny regions are omitted so capture safely falls
 * back to the complete browser client area. */
export function calculateVideoCaptureRegion(input: VideoCaptureRegionInput): VideoCaptureRegion | undefined {
  const dpr = Number.isFinite(input.devicePixelRatio) && input.devicePixelRatio > 0
    ? input.devicePixelRatio
    : 1;
  const viewportWidth = Math.max(0, Number.isFinite(input.viewportWidth) ? input.viewportWidth : 0);
  const viewportHeight = Math.max(0, Number.isFinite(input.viewportHeight) ? input.viewportHeight : 0);
  const rawLeft = Number.isFinite(input.left) ? input.left : 0;
  const rawTop = Number.isFinite(input.top) ? input.top : 0;
  const rawWidth = Number.isFinite(input.width) ? input.width : 0;
  const rawHeight = Number.isFinite(input.height) ? input.height : 0;
  const left = Math.max(0, Math.min(viewportWidth, rawLeft));
  const top = Math.max(0, Math.min(viewportHeight, rawTop));
  const right = Math.max(left, Math.min(viewportWidth, rawLeft + rawWidth));
  const bottom = Math.max(top, Math.min(viewportHeight, rawTop + rawHeight));
  const region = {
    x: Math.max(0, Math.round(left * dpr)),
    y: Math.max(0, Math.round(top * dpr)),
    width: Math.max(0, Math.round((right - left) * dpr)),
    height: Math.max(0, Math.round((bottom - top) * dpr)),
  };
  return region.width >= 64 && region.height >= 64 ? region : undefined;
}
