import { describe, expect, it } from 'vitest';
import { buildDiagnosticsText } from '../src/ui/options/diagnostics-info';

describe('buildDiagnosticsText', () => {
  it('renders one line per capability, starting with the extension identity', () => {
    const text = buildDiagnosticsText({
      version: '1.0.5',
      platform: 'Win32',
      userAgent: 'Mozilla/5.0 (test)',
      webgpu: 'available',
      native: 'windows-only',
      theme: 'dark',
    });
    expect(text).toBe(
      'AniWebScale 1.0.5\n'
      + 'Platform: Win32\n'
      + 'User agent: Mozilla/5.0 (test)\n'
      + 'WebGPU: available\n'
      + 'Native renderer: windows-only\n'
      + 'Theme: dark',
    );
  });

  it('labels unavailable capabilities as such', () => {
    const text = buildDiagnosticsText({
      version: '1.0.5',
      platform: 'Linux x86_64',
      userAgent: 'Mozilla/5.0 (test)',
      webgpu: 'unavailable',
      native: 'unavailable',
      theme: 'auto',
    });
    expect(text).toContain('WebGPU: unavailable');
    expect(text).toContain('Native renderer: unavailable');
    expect(text).toContain('Theme: auto');
  });
});
