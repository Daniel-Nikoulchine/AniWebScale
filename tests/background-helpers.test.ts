import { describe, expect, it } from 'vitest';
import {
  generateNonce,
  nativeRequestBase,
  sourceOrigin,
  topLevelOrigin,
} from '../src/background-helpers';
import { NATIVE_PROTOCOL_VERSION } from '../src/native/protocol';

function sender(partial: Partial<chrome.runtime.MessageSender>): chrome.runtime.MessageSender {
  return partial as chrome.runtime.MessageSender;
}

describe('generateNonce', () => {
  it('produces a 32-character lowercase hex string', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produces unique values across calls', () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });
});

describe('nativeRequestBase', () => {
  it('carries the protocol version and a request id', () => {
    const base = nativeRequestBase();
    expect(base.protocolVersion).toBe(NATIVE_PROTOCOL_VERSION);
    expect(typeof base.requestId).toBe('string');
    expect(base.requestId.length).toBeGreaterThan(0);
  });

  it('issues a fresh request id per call', () => {
    expect(nativeRequestBase().requestId).not.toBe(nativeRequestBase().requestId);
  });
});

describe('sourceOrigin', () => {
  it('prefers the authoritative sender origin', () => {
    const result = sourceOrigin(sender({
      origin: 'https://www.crunchyroll.com',
      url: 'https://static.crunchyroll.com/player.html',
      tab: { url: 'https://www.crunchyroll.com/watch/xyz' } as chrome.tabs.Tab,
    }));
    expect(result).toBe('https://www.crunchyroll.com');
  });

  it('falls back to the sender url when origin is absent', () => {
    const result = sourceOrigin(sender({ url: 'https://example.com/page' }));
    expect(result).toBe('https://example.com');
  });

  it('returns null for non-HTTP senders', () => {
    const result = sourceOrigin(sender({ origin: 'null', url: 'about:blank' }));
    expect(result).toBeNull();
  });
});

describe('topLevelOrigin', () => {
  it('returns the tab top-level origin when present', () => {
    const result = topLevelOrigin(sender({
      tab: { url: 'https://www.crunchyroll.com/watch/xyz' } as chrome.tabs.Tab,
    }));
    expect(result).toBe('https://www.crunchyroll.com');
  });

  it('returns null when there is no tab url', () => {
    expect(topLevelOrigin(sender({}))).toBeNull();
  });
});
