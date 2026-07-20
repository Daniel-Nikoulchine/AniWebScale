import { describe, expect, it } from 'vitest';
import {
  isHttpOrigin,
  isNativePlaybackStateAuthorized,
  isNativeSessionControlAuthorized,
  parseNativeConsentResponse,
  resolveNativeMessageOrigin,
} from '../src/shared/native-session-messages';

const session = {
  sessionId: 'session-current',
  tabId: 7,
  frameId: 3,
  videoId: 'video-current',
};

describe('native message origin resolution', () => {
  it('uses the effective sender origin for inherited about:blank frames', () => {
    expect(resolveNativeMessageOrigin({
      origin: 'https://player.example',
      url: 'about:blank',
      tabUrl: 'https://site.example/watch',
    })).toBe('https://player.example');
  });

  it('does not grant an opaque sender the top-level tab origin', () => {
    expect(resolveNativeMessageOrigin({
      origin: 'null',
      url: 'https://player.example/embed',
      tabUrl: 'https://site.example/watch',
    })).toBeNull();
  });

  it('normalizes ordinary frame URLs and recognizes exact HTTP origins', () => {
    expect(resolveNativeMessageOrigin({ url: 'https://player.example:8443/embed?id=1' }))
      .toBe('https://player.example:8443');
    expect(isHttpOrigin('https://player.example:8443')).toBe(true);
    expect(isHttpOrigin('https://player.example:8443/embed')).toBe(false);
  });
});

describe('native consent responses', () => {
  it('distinguishes an explicit denial from a missing or broken response', () => {
    expect(parseNativeConsentResponse({ allowed: true })).toBe(true);
    expect(parseNativeConsentResponse({ allowed: false })).toBe(false);
    expect(parseNativeConsentResponse(undefined)).toBeNull();
    expect(parseNativeConsentResponse({})).toBeNull();
  });
});

describe('native session control authorization', () => {
  it('accepts source-video and current-session controls from their owning frames', () => {
    expect(isNativeSessionControlAuthorized(session, { videoId: session.videoId }, {
      tabId: session.tabId,
      frameId: session.frameId,
    })).toBe(true);
    expect(isNativeSessionControlAuthorized(session, { sessionId: session.sessionId }, {
      tabId: session.tabId,
      frameId: 0,
    })).toBe(true);
  });

  it('rejects stale, cross-tab, wrong-frame, and unidentified controls', () => {
    expect(isNativeSessionControlAuthorized(session, { sessionId: 'session-old' }, {
      tabId: session.tabId,
      frameId: 0,
    })).toBe(false);
    expect(isNativeSessionControlAuthorized(session, { videoId: session.videoId }, {
      tabId: 9,
      frameId: session.frameId,
    })).toBe(false);
    expect(isNativeSessionControlAuthorized(session, { videoId: session.videoId }, {
      tabId: session.tabId,
      frameId: 0,
    })).toBe(false);
    expect(isNativeSessionControlAuthorized(session, {}, {
      tabId: session.tabId,
      frameId: session.frameId,
    })).toBe(false);
  });

  it('requires the exact session ID for periodic playback heartbeats', () => {
    const sender = { tabId: session.tabId, frameId: session.frameId };
    expect(isNativePlaybackStateAuthorized(session, {
      sessionId: session.sessionId,
      videoId: session.videoId,
    }, sender)).toBe(true);
    expect(isNativePlaybackStateAuthorized(session, {
      sessionId: 'session-old',
      videoId: session.videoId,
    }, sender)).toBe(false);
    expect(isNativePlaybackStateAuthorized(session, {
      videoId: session.videoId,
    }, sender)).toBe(false);
  });
});
