import { createAsyncSerializer } from './async-serializer';
import { parseNativeConsentResponse } from './native-session-messages';
import { nativeConsentRequestMessage } from './runtime-messages';

const CONSENT_STORAGE_KEY = 'anime4kNativeConsentByOrigin';

/** The question the user answers when a site first wants the native renderer. */
export function nativeConsentPrompt(origin: string): string {
  return `Allow AniWebScale to capture this browser tab with the local Windows renderer for ${origin}?\n\n`
    + 'DRM playback requires browser hardware acceleration to be disabled and the browser restarted. '
    + 'Otherwise protected video may appear black. The renderer only receives composited pixels and does not bypass DRM.';
}

/** All recorded consents, ordered by origin for stable display. */
export async function describeNativeConsents(): Promise<Array<{ origin: string; allowed: boolean }>> {
  const consentByOrigin = await loadConsents();
  return Object.entries(consentByOrigin)
    .map(([origin, allowed]) => ({ origin, allowed }))
    .sort((left, right) => left.origin.localeCompare(right.origin));
}

export async function recordNativeConsent(origin: string, allowed: boolean): Promise<void> {
  await serializeConsentWrite(async () => {
    const consentByOrigin = await loadConsents();
    consentByOrigin[origin] = allowed;
    await chrome.storage.local.set({ [CONSENT_STORAGE_KEY]: consentByOrigin });
  });
}

/** Drop one origin's consent, or every consent when no origin is given. */
export async function resetNativeConsent(origin?: string): Promise<void> {
  await serializeConsentWrite(async () => {
    if (origin === undefined) {
      await chrome.storage.local.remove(CONSENT_STORAGE_KEY);
      return;
    }
    const consentByOrigin = await loadConsents();
    if (!(origin in consentByOrigin)) return;
    delete consentByOrigin[origin];
    await chrome.storage.local.set({ [CONSENT_STORAGE_KEY]: consentByOrigin });
  });
}

/**
 * Resolve the native-capture consent for an origin: a recorded answer wins;
 * otherwise ask through the page frame (the ask callback sends the frame
 * message and resolves with its response) and record the answer.
 */
export async function requestNativeConsent(
  origin: string,
  ask: (message: unknown) => Promise<unknown>,
): Promise<boolean> {
  const consentByOrigin = await loadConsents();
  if (typeof consentByOrigin[origin] === 'boolean') {
    return consentByOrigin[origin];
  }

  let response: unknown;
  try {
    response = await ask(nativeConsentRequestMessage(origin));
  } catch (error) {
    console.warn('[NativeConsent] Could not show the native fallback consent.', error);
    return false;
  }

  const allowed = parseNativeConsentResponse(response);
  if (allowed === null) return false;
  await recordNativeConsent(origin, allowed);
  return allowed;
}

async function loadConsents(): Promise<Record<string, boolean>> {
  const stored = await chrome.storage.local.get(CONSENT_STORAGE_KEY);
  const value = stored[CONSENT_STORAGE_KEY];
  if (!value || typeof value !== 'object') return {};
  // Corrupt entries (non-boolean values) are dropped instead of flowing
  // into describeNativeConsents() mistyped; requestNativeConsent re-asks
  // for origins without a valid recorded answer.
  const clean: Record<string, boolean> = {};
  for (const [origin, allowed] of Object.entries(value)) {
    if (typeof allowed === 'boolean') clean[origin] = allowed;
  }
  return clean;
}

/**
 * Serialize consent writes: record/reset are load → mutate → set, so two
 * concurrent writes would both read the pre-write state and the second
 * would clobber the first. The shared serializer preserves call order and
 * lets each caller see its own write's error.
 */
const serializeConsentWrite = createAsyncSerializer();
