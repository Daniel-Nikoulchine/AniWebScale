/**
 * Owns the durable native-session and active-enhancement state for the
 * background service worker. All chrome.storage reads/writes for these two
 * records go through this class so the rest of the background code never
 * touches storage keys directly.
 */
import type { ActiveEnhancementRecord, NativeSessionRecord } from '../background-types';
import {
  isNativeConfiguration,
  isNativeEnhancementMode,
  isNativeQuality,
  type NativeConfiguration,
} from '../native/protocol';
import { migrateNativeSessionMetadata } from '../shared/session-recovery';

const SESSION_STORAGE_KEY = 'anime4kNativeSessionV1';
const ACTIVE_ENHANCEMENT_KEY = 'anime4kActiveEnhancementV1';

export class NativeSessionStore {
  private session: NativeSessionRecord | null = null;
  private enhancement: ActiveEnhancementRecord | null = null;

  /** The in-memory active session (null when no capture is running). */
  get activeSession(): NativeSessionRecord | null {
    return this.session;
  }

  /** Persist (or clear) the active session in chrome.storage.local. */
  async persistSession(session: NativeSessionRecord | null): Promise<void> {
    this.session = session;
    if (session) {
      await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: session });
    } else {
      await chrome.storage.local.remove(SESSION_STORAGE_KEY);
    }
  }

  /**
   * Load and validate a previously persisted session from storage.
   * Returns null when no valid session exists or migration fails.
   */
  async loadPersistedSession(): Promise<NativeSessionRecord | null> {
    const stored = await chrome.storage.local.get(SESSION_STORAGE_KEY);
    const candidate = stored[SESSION_STORAGE_KEY] as (
      Partial<NativeSessionRecord> & { preset?: unknown }
    ) | undefined;
    const metadata = candidate ? migrateNativeSessionMetadata(candidate) : null;
    if (!candidate || !metadata || typeof candidate.tabId !== 'number') {
      return null;
    }
    const rawConfiguration = candidate.configuration ?? candidate.preset;
    const configuration = isNativeConfiguration(rawConfiguration)
      ? rawConfiguration
      : rawConfiguration && typeof rawConfiguration === 'object'
        && isNativeEnhancementMode((rawConfiguration as Record<string, unknown>).mode)
        && isNativeQuality((rawConfiguration as Record<string, unknown>).quality)
        ? {
            mode: (rawConfiguration as { mode: NativeConfiguration['mode'] }).mode,
            quality: (rawConfiguration as { quality: NativeConfiguration['quality'] }).quality,
            frameGenerationEnabled: false,
          }
        : null;
    if (!configuration) return null;
    const normalized = { ...candidate };
    delete normalized.preset;
    return { ...normalized, ...metadata, configuration } as NativeSessionRecord;
  }

  /** Load the active enhancement claim, using the in-memory cache first. */
  async loadActiveEnhancement(): Promise<ActiveEnhancementRecord | null> {
    if (this.enhancement) return this.enhancement;
    const stored = await chrome.storage.local.get(ACTIVE_ENHANCEMENT_KEY);
    const candidate = stored[ACTIVE_ENHANCEMENT_KEY] as Partial<ActiveEnhancementRecord> | undefined;
    if (!candidate || !Number.isInteger(candidate.tabId) || !Number.isInteger(candidate.frameId)
        || typeof candidate.videoId !== 'string' || candidate.videoId.length === 0) return null;
    this.enhancement = {
      tabId: candidate.tabId as number,
      frameId: candidate.frameId as number,
      videoId: candidate.videoId,
    };
    return this.enhancement;
  }

  /** Persist (or clear) the active enhancement claim. */
  async persistActiveEnhancement(record: ActiveEnhancementRecord | null): Promise<void> {
    this.enhancement = record;
    if (record) await chrome.storage.local.set({ [ACTIVE_ENHANCEMENT_KEY]: record });
    else await chrome.storage.local.remove(ACTIVE_ENHANCEMENT_KEY);
  }
}
