import { describe, expect, it, vi } from 'vitest';
import { Renderer } from '../src/core/renderer';
import type { EnhancementEffect } from '../src/types';

const oldEffects: EnhancementEffect[] = [{
  id: 'old', name: 'Old', className: 'OldPipeline', alwaysApply: true,
}];
const newEffects: EnhancementEffect[] = [{
  id: 'new', name: 'New', className: 'NewPipeline', alwaysApply: true,
}];

function configurableRenderer(): any {
  const renderer = Object.create(Renderer.prototype) as any;
  renderer.destroyed = false;
  renderer.effects = oldEffects;
  renderer.targetDimensions = { width: 1280, height: 720 };
  renderer.frameGenerationEnabled = false;
  renderer.pipelineEffectKey = 'old-key';
  renderer.video = { videoWidth: 640, videoHeight: 360 };
  renderer.canvas = { width: 1280, height: 720 };
  renderer.device = { queue: { onSubmittedWorkDone: vi.fn(() => Promise.resolve()) } };
  renderer.stopFrameCallbacks = vi.fn();
  renderer.waitForFrameIdle = vi.fn(() => Promise.resolve());
  renderer.startFrameCallbacks = vi.fn();
  renderer.createHistoryResources = vi.fn();
  renderer.createPresentationBindGroup = vi.fn();
  renderer.processFrame = vi.fn(async () => {
    renderer.firstFrameRendered = true;
    return true;
  });
  return renderer;
}

describe('renderer configuration transactions', () => {
  it('restores the previous configuration when pipeline compilation fails', async () => {
    const renderer = configurableRenderer();
    renderer.buildPipelines = vi.fn(() => Promise.reject(new Error('shader compile failed')));

    const update = {
      effects: newEffects,
      targetDimensions: { width: 1920, height: 1080 },
      frameGenerationEnabled: true,
    };
    await expect(renderer.applyConfiguration(update)).rejects.toThrow('shader compile failed');

    expect(renderer.effects).toBe(oldEffects);
    expect(renderer.targetDimensions).toEqual({ width: 1280, height: 720 });
    expect(renderer.frameGenerationEnabled).toBe(false);
    expect(renderer.destroyed).toBe(false);

    await expect(renderer.applyConfiguration(update)).rejects.toThrow('shader compile failed');
    expect(renderer.buildPipelines).toHaveBeenCalledTimes(2);
  });

  it('destroys the renderer if a failure happens after GPU resources were committed', async () => {
    const renderer = configurableRenderer();
    renderer.buildPipelines = vi.fn(() => Promise.resolve());
    renderer.createHistoryResources = vi.fn(() => { throw new Error('history allocation failed'); });
    renderer.destroy = vi.fn(() => { renderer.destroyed = true; });

    await expect(renderer.applyConfiguration({
      effects: newEffects,
      targetDimensions: { width: 1920, height: 1080 },
      frameGenerationEnabled: true,
    })).rejects.toThrow('history allocation failed');

    expect(renderer.destroy).toHaveBeenCalledOnce();
    expect(renderer.destroyed).toBe(true);
  });

  it('renders the committed configuration immediately after the canvas is resized', async () => {
    const renderer = configurableRenderer();
    renderer.firstFrameRendered = true;
    renderer.buildPipelines = vi.fn(() => Promise.resolve());

    await renderer.applyConfiguration({
      effects: newEffects,
      targetDimensions: { width: 1920, height: 1080 },
      frameGenerationEnabled: true,
    });

    expect(renderer.canvas).toEqual({ width: 1920, height: 1080 });
    expect(renderer.processFrame).toHaveBeenCalledOnce();
    expect(renderer.firstFrameRendered).toBe(true);
    expect(renderer.startFrameCallbacks).toHaveBeenCalledOnce();
  });

  it('drains a paused seek callback queued during a recoverable rebuild failure', async () => {
    const renderer = configurableRenderer();
    const metadata = { mediaTime: 14 } as VideoFrameCallbackMetadata;
    Object.assign(renderer.video, { paused: true, ended: false });
    renderer.videoSourceRevision = 6;
    renderer.frameCallbackId = null;
    renderer.lastCallbackMediaTime = null;
    renderer.frameProcessing = false;
    renderer.pendingFrame = false;
    renderer.latestMetadata = null;
    renderer.playbackFlushPending = false;
    renderer.stopGeneratedFrameAnimation = vi.fn();
    renderer.flushStoppedPlayback = vi.fn();
    renderer.drainFrames = vi.fn(() => Promise.resolve());
    renderer.buildPipelines = vi.fn(() => {
      renderer.handleVideoFrame(renderer.video, 6, 0, metadata);
      return Promise.reject(new Error('shader compile failed'));
    });

    await expect(renderer.applyConfiguration({
      effects: newEffects,
      targetDimensions: { width: 1920, height: 1080 },
      frameGenerationEnabled: true,
    })).rejects.toThrow('shader compile failed');

    expect(renderer.drainFrames).toHaveBeenCalledWith(metadata);
    expect(renderer.pendingFrame).toBe(false);
    expect(renderer.latestMetadata).toBeNull();
  });

  it('coalesces a re-armed callback during the immediate committed render', async () => {
    const renderer = configurableRenderer();
    const metadata = { mediaTime: 21 } as VideoFrameCallbackMetadata;
    Object.assign(renderer.video, { paused: false, ended: false });
    renderer.videoSourceRevision = 9;
    renderer.frameCallbackId = null;
    renderer.lastCallbackMediaTime = null;
    renderer.frameProcessing = false;
    renderer.pendingFrame = false;
    renderer.latestMetadata = null;
    renderer.rebuilding = false;
    renderer.drainFrames = vi.fn(() => Promise.resolve());
    renderer.buildPipelines = vi.fn(() => Promise.resolve());
    renderer.processFrame = vi.fn(async () => {
      expect(renderer.frameProcessing).toBe(true);
      renderer.handleVideoFrame(renderer.video, 9, 0, metadata);
      return true;
    });

    await renderer.applyConfiguration({
      effects: newEffects,
      targetDimensions: { width: 1920, height: 1080 },
      frameGenerationEnabled: true,
    });

    expect(renderer.drainFrames).toHaveBeenCalledWith(metadata);
    expect(renderer.frameProcessing).toBe(false);
  });
});
