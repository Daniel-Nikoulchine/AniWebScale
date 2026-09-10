import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealEsrganBufferPool } from '../src/shared/realesrgan-buffer-pool';
import { planReadback } from '../src/shared/realesrgan-readback';
import { LetterboxTracker } from '../src/shared/realesrgan-letterbox';
import { StillframeTracker } from '../src/shared/realesrgan-stillframe';
import { RealEsrganDrainProcessor, type RealEsrganDrainHost } from '../src/core/realesrgan-drain-processor';
import { RealEsrganInferenceCoordinator } from '../src/core/realesrgan-inference-coordinator';
import type { RealEsrganOutputWriter } from '../src/core/realesrgan-output-writer';
import type { RealEsrganStagingClaim } from '../src/core/realesrgan-staging-slots';
import type { RealEsrganFrameResult, RealEsrganInferenceRunner } from '../src/core/realesrgan-runner';
import type { RealEsrganModelAssets } from '../src/core/realesrgan-model-assets';

const WIDTH = 32;
const HEIGHT = 32;
const RESULT_W = WIDTH * 4;
const RESULT_H = HEIGHT * 4;

function makeModelAssets(): RealEsrganModelAssets {
  return {
    dynamicUrl: 'models/dynamic.onnx',
    fp16Url: null,
    urlForShape: () => 'models/static.onnx',
  };
}

function makeRunner(runFrame: RealEsrganInferenceRunner['runFrame']): RealEsrganInferenceRunner {
  return { runFrame };
}

/** A claim whose readback buffer maps synchronously to a fresh backing array. */
function makeClaim(byteLength: number): RealEsrganStagingClaim {
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 7) % 251;
  return {
    index: 0,
    buffer: {
      mapAsync: vi.fn(() => Promise.resolve()),
      getMappedRange: vi.fn(() => bytes.buffer),
      unmap: vi.fn(),
    } as unknown as GPUBuffer,
  };
}

interface Harness {
  processor: RealEsrganDrainProcessor;
  host: RealEsrganDrainHost;
  outputWriter: {
    writeRgbaResult: ReturnType<typeof vi.fn>;
    presentCroppedResult: ReturnType<typeof vi.fn>;
    writeComposedResult: ReturnType<typeof vi.fn>;
    writeCroppedComposedResult: ReturnType<typeof vi.fn>;
    writePrimeFrame: ReturnType<typeof vi.fn>;
  };
  recordPhaseSample: ReturnType<typeof vi.fn>;
  state: {
    firstResultLanded: boolean;
    destroyed: boolean;
    runner: RealEsrganInferenceRunner | null;
  };
}

function makeHarness(runner: RealEsrganInferenceRunner | null): Harness {
  const readbackByteLength = planReadback(WIDTH, HEIGHT, 'rgba8unorm').byteLength;
  const outputWriter = {
    writeRgbaResult: vi.fn(),
    presentCroppedResult: vi.fn(),
    writeComposedResult: vi.fn(),
    writeCroppedComposedResult: vi.fn(),
    writePrimeFrame: vi.fn(),
  };
  const recordPhaseSample = vi.fn();
  const state = {
    firstResultLanded: false,
    destroyed: false,
    runner,
  };
  const host: RealEsrganDrainHost = {
    readbackFormat: 'rgba8unorm',
    readbackByteLength,
    inferenceWidth: WIDTH,
    inferenceHeight: HEIGHT,
    transportTargetWidth: 0,
    transportTargetHeight: 0,
    pool: new RealEsrganBufferPool(2),
    cropTracker: new LetterboxTracker(),
    stillTracker: new StillframeTracker(),
    outputWriter: outputWriter as unknown as RealEsrganOutputWriter,
    modelAssets: makeModelAssets(),
    execution: null,
    tiling: { maxTileSize: 512, overlap: 24, singleTileMaxHeight: 512 },
    getRunner: () => state.runner,
    isDestroyed: () => state.destroyed,
    isFirstResultLanded: () => state.firstResultLanded,
    markFirstResultLanded: () => { state.firstResultLanded = true; },
    shouldStaleSkip: vi.fn(() => false),
    claimPresentation: vi.fn(() => true),
    notePresentedDropped: vi.fn(),
    noteStaleSkipped: vi.fn(),
    releaseStagingClaim: vi.fn(),
    recordPhaseSample,
    logInputColorDiag: vi.fn(),
    logOutputColorDiag: vi.fn(),
    handleInferenceError: vi.fn(),
  };
  const inference = new RealEsrganInferenceCoordinator({
    getRunner: () => state.runner,
    guardInference: task => task(),
    inferenceWidth: WIDTH,
    inferenceHeight: HEIGHT,
  }, null);
  return {
    processor: new RealEsrganDrainProcessor(host, inference),
    host,
    outputWriter,
    recordPhaseSample,
    state,
  };
}

function frameResult(): RealEsrganFrameResult {
  return {
    data: new Uint8Array(RESULT_W * RESULT_H * 4).fill(9),
    width: RESULT_W,
    height: RESULT_H,
  };
}

describe('RealEsrganDrainProcessor', () => {
  beforeEach(() => {
    vi.stubGlobal('GPUMapMode', { READ: 1 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('early stale-skip releases the slot without touching the pool or host work', async () => {
    const h = makeHarness(null);
    h.state.firstResultLanded = true;
    (h.host.shouldStaleSkip as ReturnType<typeof vi.fn>).mockReturnValue(true);
    const claim = makeClaim(h.host.readbackByteLength);

    await h.processor.drain(claim, 1);

    expect(h.host.noteStaleSkipped).toHaveBeenCalledOnce();
    expect(h.host.releaseStagingClaim).toHaveBeenCalledWith(claim);
    expect(claim.buffer.mapAsync).not.toHaveBeenCalled();
    expect(h.outputWriter.writeRgbaResult).not.toHaveBeenCalled();
    expect(h.host.recordPhaseSample).not.toHaveBeenCalled();
  });

  it('runs the worker-planar path, presents, and skips phase samples for held stills', async () => {
    const result = frameResult();
    const runFrame = vi.fn(async () => result);
    const h = makeHarness(makeRunner(runFrame));
    const claim = makeClaim(h.host.readbackByteLength);

    await h.processor.drain(claim, 1);
    expect(runFrame).toHaveBeenCalledOnce();
    expect(h.outputWriter.writeRgbaResult).toHaveBeenCalledWith(result.data, RESULT_W, RESULT_H);
    expect(h.host.claimPresentation).toHaveBeenCalledWith(1);
    expect(h.state.firstResultLanded).toBe(true);
    expect(h.host.recordPhaseSample).toHaveBeenCalledTimes(1);
    expect(h.recordPhaseSample.mock.calls[0][7]).toBe(false); // servedNative
    expect(h.recordPhaseSample.mock.calls[0][6]).toBe(true);  // inferUsedRunner

    // A different frame number makes claimPresentation accept; the identical
    // bytes build the still-run. The 3rd identical arrival holds.
    await h.processor.drain(makeClaim(h.host.readbackByteLength), 2);
    await h.processor.drain(makeClaim(h.host.readbackByteLength), 3);

    expect(runFrame).toHaveBeenCalledTimes(2);
    expect(h.outputWriter.writeRgbaResult).toHaveBeenCalledTimes(2);
    // Held frame records no phase sample: only frames 1 and 2 did.
    expect(h.host.recordPhaseSample).toHaveBeenCalledTimes(2);
  });

  it('counts a superseded completion instead of presenting it', async () => {
    const h = makeHarness(makeRunner(vi.fn(async () => frameResult())));
    (h.host.claimPresentation as ReturnType<typeof vi.fn>).mockReturnValue(false);

    await h.processor.drain(makeClaim(h.host.readbackByteLength), 1);

    expect(h.host.notePresentedDropped).toHaveBeenCalledOnce();
    expect(h.outputWriter.writeRgbaResult).not.toHaveBeenCalled();
    expect(h.state.firstResultLanded).toBe(false);
    // Timings still record for the completed frame.
    expect(h.host.recordPhaseSample).toHaveBeenCalledTimes(1);
  });

  it('routes an infer failure to the host error hook and still releases the slot', async () => {
    const failure = new Error('boom');
    const h = makeHarness(makeRunner(vi.fn(async () => { throw failure; })));
    const claim = makeClaim(h.host.readbackByteLength);

    await h.processor.drain(claim, 1);

    expect(h.host.handleInferenceError).toHaveBeenCalledWith(failure, 'infer');
    expect(h.host.releaseStagingClaim).toHaveBeenCalledWith(claim);
    // A failed frame still records a (partial) phase sample, like before.
    expect(h.host.recordPhaseSample).toHaveBeenCalledTimes(1);
  });
});
