/**
 * Render stats fan-out for one enhancer: the stats window has many
 * consumers (overlay, auto-cap, E2E retention) but a single producer
 * cadence. New consumers subscribe instead of touching the producer.
 */

/** Listener slot; unsubscribe by calling the returned function. */
import type { RenderStats } from '../types';

export function createRenderStatsTap(): {
  subscribe(listener: (stats: RenderStats) => void): () => void;
  emit(stats: RenderStats): void;
} {
  const listeners = new Set<(stats: RenderStats) => void>();
  return {
    subscribe(listener: (stats: RenderStats) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(stats: RenderStats): void {
      // One throwing consumer (overlay, auto-cap, E2E retention) must
      // neither starve the later subscribers nor unwind into the producer:
      // emit runs on the inference accounting path.
      for (const listener of [...listeners]) {
        try {
          listener(stats);
        } catch (error) {
          console.warn('[AniWebScale] stats listener threw; continuing fan-out.', error);
        }
      }
    },
  };
}
