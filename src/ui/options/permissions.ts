import { nativeResetConsentMessage, siteAccessSyncMessage } from '../../shared/runtime-messages';
import {
  getGrantedSitePatterns,
  revokeSiteAccessPatterns,
} from '../../site-access';
import { describeNativeConsents, recordNativeConsent } from '../../shared/native-consent';
import { message } from '../i18n';
import { renderPermissionList, type PermissionListEntry } from '../permission-list';

type UndoState =
  | { type: 'website'; patterns: string[] }
  | { type: 'native'; entries: { origin: string; allowed: boolean }[] };

export interface PermissionController {
  renderWebsitePermissions: () => Promise<void>;
  renderNativePermissions: () => Promise<void>;
}

export function createPermissionController(showStatus: (text: string) => void): PermissionController {
  let undoState: UndoState | null = null;
  let undoTimeout: ReturnType<typeof setTimeout> | undefined;

  function clearUndoToast(): void {
    undoState = null;
    clearTimeout(undoTimeout);
    const toast = document.getElementById('undo-toast') as HTMLDivElement;
    toast.setAttribute('hidden', '');
  }

  function showUndoToast(text: string, state: UndoState): void {
    clearUndoToast();
    undoState = state;
    const toast = document.getElementById('undo-toast') as HTMLDivElement;
    toast.textContent = '';
    toast.removeAttribute('hidden');
    const label = document.createElement('span');
    label.textContent = text;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = message('undo', 'Undo');
    button.addEventListener('click', () => {
      const current = undoState;
      clearUndoToast();
      if (!current) return;
      if (current.type === 'website') {
        // permissions.request must be the first async operation in this gesture.
        void chrome.permissions.request({ origins: current.patterns }).then(async granted => {
          if (granted) await chrome.runtime.sendMessage(siteAccessSyncMessage());
          else showStatus(message('permissionRestoreFailed', 'Permission request declined. The website was not restored.'));
          await renderWebsitePermissions();
        });
      } else {
        void (async () => {
          for (const entry of current.entries) await recordNativeConsent(entry.origin, entry.allowed);
          await renderNativePermissions();
        })();
      }
    });
    toast.append(label, button);
    undoTimeout = setTimeout(clearUndoToast, 8000);
  }

  async function renderWebsitePermissions(): Promise<void> {
    const list = document.getElementById('website-sites') as HTMLDivElement;
    const clear = document.getElementById('clear-website-sites') as HTMLButtonElement;
    const granted = await getGrantedSitePatterns();
    const entries: PermissionListEntry[] = granted.map(id => ({
      id,
      state: message('allowed', 'Allowed'),
      stateClass: 'allowed',
    }));

    renderPermissionList({
      container: list,
      clearButton: clear,
      entries,
      emptyMessage: message('noWebsiteSites', 'No websites can run AniWebScale yet.'),
      removeLabel: message('remove', 'Remove'),
      onRemove: async entry => {
        await revokeSiteAccessPatterns([entry.id]);
        await renderWebsitePermissions();
        showUndoToast(message('removedSite', 'Removed {site}', { site: entry.id }), {
          type: 'website',
          patterns: [entry.id],
        });
      },
      onClear: async entriesToClear => {
        const patterns = entriesToClear.map(entry => entry.id);
        await revokeSiteAccessPatterns(patterns);
        await renderWebsitePermissions();
        if (patterns.length > 0) {
          showUndoToast(message('clearedAllSites', 'All website access removed'), {
            type: 'website',
            patterns,
          });
        }
      },
    });
  }

  async function renderNativePermissions(): Promise<void> {
    const list = document.getElementById('native-sites') as HTMLDivElement;
    const clear = document.getElementById('clear-native-sites') as HTMLButtonElement;
    const nativeEntries = await describeNativeConsents();
    const entries: PermissionListEntry[] = nativeEntries.map(({ origin, allowed }) => ({
      id: origin,
      state: allowed ? message('allowed', 'Allowed') : message('blocked', 'Blocked'),
      stateClass: allowed ? 'allowed' : 'blocked',
    }));

    renderPermissionList({
      container: list,
      clearButton: clear,
      entries,
      emptyMessage: message('noNativeSites', 'No sites have permission to start the native renderer.'),
      removeLabel: message('remove', 'Remove'),
      onRemove: async entry => {
        const nativeEntry = nativeEntries.find(candidate => candidate.origin === entry.id);
        await chrome.runtime.sendMessage(nativeResetConsentMessage(entry.id));
        await renderNativePermissions();
        showUndoToast(message('removedSite', 'Removed {site}', { site: entry.id }), {
          type: 'native',
          entries: nativeEntry ? [{ origin: nativeEntry.origin, allowed: nativeEntry.allowed }] : [],
        });
      },
      onClear: async () => {
        const all = nativeEntries.map(entry => ({ origin: entry.origin, allowed: entry.allowed }));
        await chrome.runtime.sendMessage(nativeResetConsentMessage());
        await renderNativePermissions();
        if (all.length > 0) {
          showUndoToast(message('clearedAllNative', 'All native permissions removed'), {
            type: 'native',
            entries: all,
          });
        }
      },
    });
  }

  return { renderWebsitePermissions, renderNativePermissions };
}
