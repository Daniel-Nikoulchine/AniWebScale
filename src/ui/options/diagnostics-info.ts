/**
 * Plain-text bug-report header assembled by the options page. Kept free of
 * DOM and chrome APIs so it can be unit tested and reused from any surface.
 */
export interface DiagnosticsSnapshot {
  version: string;
  platform: string;
  userAgent: string;
  webgpu: 'available' | 'unavailable';
  native: 'available' | 'unavailable' | 'windows-only';
  theme: string;
}

export function buildDiagnosticsText(info: DiagnosticsSnapshot): string {
  return [
    `AniWebScale ${info.version}`,
    `Platform: ${info.platform}`,
    `User agent: ${info.userAgent}`,
    `WebGPU: ${info.webgpu}`,
    `Native renderer: ${info.native}`,
    `Theme: ${info.theme}`,
  ].join('\n');
}
