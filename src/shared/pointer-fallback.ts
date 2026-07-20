export type DirectMediaCommand =
  | 'playPause'
  | 'seekBy'
  | 'volumeBy'
  | 'toggleMute'
  | 'toggleFullscreen'
  | 'exitFullscreen';

export interface PointerFallbackInput {
  event: 'move' | 'down' | 'up' | 'wheel';
  button: number;
  descriptor: string;
  targetIsVideo: boolean;
  targetRatioX: number;
  deltaY: number;
  duration: number;
  currentTime: number;
  volume: number;
}

export interface PointerFallbackCommand {
  command: DirectMediaCommand;
  value?: number;
}

/** Maps common player surfaces to a direct media operation used only when the
 * corresponding synthetic pointer event did not change media state. */
export function selectPointerMediaFallback(input: PointerFallbackInput): PointerFallbackCommand | null {
  if (input.event === 'wheel') {
    if (!Number.isFinite(input.deltaY) || input.deltaY === 0) return null;
    return {
      command: 'volumeBy',
      value: Math.max(-0.2, Math.min(0.2, -input.deltaY / 120 * 0.05)),
    };
  }
  if (input.event !== 'up' || input.button !== 0) return null;

  const descriptor = input.descriptor.toLowerCase();
  const ratio = Math.max(0, Math.min(1, input.targetRatioX));
  const volume = /volume|audio-level|sound-level/.test(descriptor);
  const slider = /slider|range|progress|scrub|timeline|seek/.test(descriptor);
  if (/exit-full|leave-full/.test(descriptor)) return { command: 'exitFullscreen' };
  if (/fullscreen|full-screen|enter-full/.test(descriptor)) return { command: 'toggleFullscreen' };
  if (volume && slider) return { command: 'volumeBy', value: ratio - input.volume };
  if (!volume && slider && Number.isFinite(input.duration) && input.duration > 0) {
    return { command: 'seekBy', value: ratio * input.duration - input.currentTime };
  }
  if (/mute|unmute|volume|speaker/.test(descriptor)) return { command: 'toggleMute' };
  if (input.targetIsVideo || /play|pause|playback-surface|click-overlay/.test(descriptor)) {
    return { command: 'playPause' };
  }
  return null;
}
