export interface CapturePopupGeometryInput {
  sourceWidth: number;
  sourceHeight: number;
  /** Physical pixels per browser-window DIP (OS scale, excluding page zoom). */
  displayScaleFactor: number;
  screenAvailLeft: number;
  screenAvailTop: number;
  screenAvailWidth: number;
  screenAvailHeight: number;
  frameWidth: number;
  frameHeight: number;
}

export interface CapturePopupGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  scale: number;
}

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

export function displayScaleFactorForZoom(devicePixelRatio: number, pageZoom: number): number {
  const zoom = Number.isFinite(pageZoom) && pageZoom > 0 ? pageZoom : 1;
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return ratio / zoom;
}

export function nonClientExtent(outerDips: number, innerCssPixels: number, pageZoom: number): number {
  const zoom = Number.isFinite(pageZoom) && pageZoom > 0 ? pageZoom : 1;
  return Math.max(0, outerDips - innerCssPixels * zoom);
}

/**
 * Sizes the popup's client area in CSS pixels so its physical client pixels
 * match the source video whenever the monitor has enough usable space.
 */
export function calculateCapturePopupGeometry(input: CapturePopupGeometryInput): CapturePopupGeometry {
  const dpr = Number.isFinite(input.displayScaleFactor) && input.displayScaleFactor > 0
    ? input.displayScaleFactor
    : 1;
  const sourceWidth = Math.max(1, Math.round(input.sourceWidth));
  const sourceHeight = Math.max(1, Math.round(input.sourceHeight));
  const frameWidth = Math.max(0, Math.round(input.frameWidth));
  const frameHeight = Math.max(0, Math.round(input.frameHeight));
  const availableWidth = Math.max(1, Math.round(input.screenAvailWidth));
  const availableHeight = Math.max(1, Math.round(input.screenAvailHeight));
  const desiredClientWidth = sourceWidth / dpr;
  const desiredClientHeight = sourceHeight / dpr;
  const maximumClientWidth = Math.max(1, availableWidth - frameWidth);
  const maximumClientHeight = Math.max(1, availableHeight - frameHeight);
  const scale = Math.min(
    1,
    maximumClientWidth / desiredClientWidth,
    maximumClientHeight / desiredClientHeight,
  );
  const clientWidth = Math.max(1, Math.round(desiredClientWidth * scale));
  const clientHeight = Math.max(1, Math.round(desiredClientHeight * scale));
  const width = Math.min(availableWidth, clientWidth + frameWidth);
  const height = Math.min(availableHeight, clientHeight + frameHeight);
  return {
    left: Math.round(input.screenAvailLeft + (availableWidth - width) / 2),
    top: Math.round(input.screenAvailTop + (availableHeight - height) / 2),
    width,
    height,
    clientWidth,
    clientHeight,
    scale,
  };
}
