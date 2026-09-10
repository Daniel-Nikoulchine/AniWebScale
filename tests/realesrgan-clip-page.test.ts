/**
 * Clip page driver: the rendered page carries registry data, never logic.
 * A new knob or message type must flow through the embedded E2E JSON;
 * hardcoded protocol strings in the output fail this gate.
 */
import { describe, expect, it } from 'vitest';
import { renderClipPage } from './e2e/realesrgan-clip-page.mjs';
import {
  E2E_BRIDGE_ACTIONS,
  E2E_BRIDGE_MESSAGE,
  E2E_KNOBS,
  e2eKnobQueryKeys,
} from '../src/shared/realesrgan-e2e-knobs.js';

function render(payload: Record<string, unknown> = { backend: 'native' }): string {
  return renderClipPage(JSON.stringify({
    actions: E2E_BRIDGE_ACTIONS,
    messages: E2E_BRIDGE_MESSAGE,
    queryKeys: e2eKnobQueryKeys(),
    payload,
    forceOverload: false,
  }));
}

describe('clip page driver', () => {
  it('embeds actions and message types as data', () => {
    const html = render();
    expect(html).toContain('"COMMAND":"anime4k-e2e-command"');
    expect(html).toContain('"GET_LOGS":"get-logs"');
    expect(html).toContain('E2E.messages.COMMAND');
    expect(html).toContain('E2E.messages.RESPONSE');
    expect(html).toContain('E2E.messages.LOG');
    expect(html).toContain('E2E.actions.GET_LOGS');
  });

  it('contains no hardcoded protocol strings', () => {
    const html = render();
    expect(html).not.toContain("'anime4k-e2e-");
    for (const knob of E2E_KNOBS) {
      if (knob.query === 'backend' || knob.query === 'cap' || knob.query === 'modelFile') continue;
      expect(html).not.toContain(`'${knob.query}'`);
    }
  });

  it('renders a complete document', () => {
    const html = render();
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('id="clip"');
    expect(html.endsWith('</script></body></html>')).toBe(true);
  });
});
