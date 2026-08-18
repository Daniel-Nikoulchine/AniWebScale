import { describe, expect, it, vi } from 'vitest';
import { createNativeSessionClient } from '../src/core/native-session-client';

/** A fake transport: the second adapter at the native-session seam. */
function fakeTransport() {
  const sent: unknown[] = [];
  const respond = vi.fn(async (_message: unknown): Promise<unknown> => ({ ok: true }));
  const client = createNativeSessionClient(async message => {
    sent.push(message);
    return respond(message);
  });
  return { client, sent, respond };
}

describe('native session client', () => {
  it('claims through the protocol constructor and parses the response', async () => {
    const { client, sent, respond } = fakeTransport();
    respond.mockResolvedValue({ ok: false, message: 'busy' });

    await expect(client.claim('video-1')).resolves.toEqual({ ok: false, message: 'busy' });
    expect(sent).toEqual([{ type: 'ENHANCEMENT_CLAIM', videoId: 'video-1' }]);
  });

  it('treats an absent response envelope as success for status responses', async () => {
    const { client } = fakeTransport();
    vi.stubGlobal('chrome', { runtime: { sendMessage: async () => undefined } });
    try {
      const defaultClient = createNativeSessionClient();
      await expect(defaultClient.claim('v')).resolves.toEqual({ ok: true });
    } finally {
      vi.unstubAllGlobals();
    }

    await expect(client.updateConfiguration({ videoId: 'v', configuration: {
      mode: 'A', quality: 'M', frameGenerationEnabled: false,
    } })).resolves.toEqual({ ok: true });
  });

  it('builds the fallback request exactly once and surfaces its session', async () => {
    const { client, sent, respond } = fakeTransport();
    respond.mockResolvedValue({ ok: true, sessionId: 'session-9', status: 'started' });

    const outcome = await client.requestFallback({
      videoId: 'video-1',
      reason: 'eme',
      configuration: { mode: 'A', quality: 'M', frameGenerationEnabled: false },
      rect: { x: 0, y: 0, width: 320, height: 180, devicePixelRatio: 1 },
    });

    expect(outcome).toEqual({ ok: true, sessionId: 'session-9' });
    expect(sent[0]).toEqual({
      type: 'NATIVE_FALLBACK_REQUEST',
      videoId: 'video-1',
      reason: 'eme',
      configuration: { mode: 'A', quality: 'M', frameGenerationEnabled: false },
      output: 'auto',
      videoRect: { x: 0, y: 0, width: 320, height: 180, devicePixelRatio: 1 },
    });
  });

  it('marks a refused fallback request without a session as not ok', async () => {
    const { client, respond } = fakeTransport();
    respond.mockResolvedValue(undefined);

    await expect(client.requestFallback({
      videoId: 'video-1',
      reason: 'eme',
      configuration: { mode: 'A', quality: 'M', frameGenerationEnabled: false },
      rect: { x: 0, y: 0, width: 320, height: 180, devicePixelRatio: 1 },
    })).resolves.toEqual({ ok: false });
  });

  it('stops and heartbeats through the shared wire form', async () => {
    const { client, sent } = fakeTransport();

    await client.stop({ sessionId: 'session-9', videoId: 'video-1' });
    await client.sendPlaybackState({
      sessionId: 'session-9',
      videoId: 'video-1',
      playbackActive: true,
      mediaTime: 12.5,
    });

    expect(sent).toEqual([
      { type: 'NATIVE_STOP', sessionId: 'session-9', videoId: 'video-1' },
      {
        type: 'NATIVE_PLAYBACK_STATE',
        sessionId: 'session-9',
        videoId: 'video-1',
        playbackActive: true,
        mediaTime: 12.5,
      },
    ]);
  });

  it('releases fire-and-forget: transport failures do not reject', async () => {
    const client = createNativeSessionClient(async () => {
      throw new Error('background gone');
    });
    await expect(client.release('video-1')).resolves.toBeUndefined();
    await expect(client.sendPlaybackState({
      sessionId: 's', videoId: 'video-1', playbackActive: false, mediaTime: 0,
    })).resolves.toBeUndefined();
    await expect(client.stop({ videoId: 'video-1' })).rejects.toThrow('background gone');
  });

  it('absorbs a late fallback response after stop with a compensating stop', async () => {
    const fallback = new Promise<unknown>(resolve => {
      setTimeout(() => resolve({ ok: true, sessionId: 'session-late', status: 'started' }), 10);
    });
    const sent: Array<Record<string, unknown>> = [];
    const client = createNativeSessionClient(async message => {
      const record = message as Record<string, unknown>;
      sent.push(record);
      return record.type === 'NATIVE_FALLBACK_REQUEST' ? fallback : { ok: true };
    });

    const starting = client.requestFallback({
      videoId: 'video-1',
      reason: 'eme',
      configuration: { mode: 'A', quality: 'M', frameGenerationEnabled: false },
      rect: { x: 0, y: 0, width: 320, height: 180, devicePixelRatio: 1 },
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(client.hasPendingFallback('video-1')).toBe(true);

    await client.stop({ videoId: 'video-1' });
    await expect(starting).resolves.toEqual({
      ok: false,
      message: 'The native renderer start was stopped before it completed.',
    });
    expect(client.hasPendingFallback('video-1')).toBe(false);

    const stops = sent.filter((message): message is { type: string; sessionId?: string; videoId?: string } =>
      typeof message === 'object' && message !== null
      && (message as { type?: string }).type === 'NATIVE_STOP');
    expect(stops).toEqual([
      { type: 'NATIVE_STOP', videoId: 'video-1' },
      { type: 'NATIVE_STOP', sessionId: 'session-late', videoId: 'video-1' },
    ]);
  });
});
