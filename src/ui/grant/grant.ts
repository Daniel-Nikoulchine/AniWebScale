import './grant.css';
import '../common-vars.css';
import { themeManager } from '../theme-manager';
import { sitePatternForUrl, injectSiteScripts } from '../../site-access';
import { parseStatusResponse, siteAccessSyncMessage } from '../../shared/runtime-messages';

/**
 * The manual grant page. Opened as a fallback when the browser refuses a
 * permission prompt from the background (no user gesture), or when the
 * prompt cannot be shown. One button; the click supplies the user gesture
 * the permission request needs.
 */

const params = new URLSearchParams(location.search);
const origin = params.get('origin');
const tabIdRaw = params.get('tabId');
const tabId = tabIdRaw !== null && /^\d+$/.test(tabIdRaw) ? Number(tabIdRaw) : undefined;

document.addEventListener('DOMContentLoaded', () => {
  themeManager.getTheme();

  const grant = document.getElementById('grant') as HTMLButtonElement;
  const host = document.getElementById('host') as HTMLElement;
  const status = document.getElementById('status') as HTMLDivElement;

  const pattern = origin ? sitePatternForUrl(origin) : null;
  if (!origin || !pattern) {
    status.textContent = 'This request is invalid. Close this tab and try again.';
    status.dataset.tone = 'error';
    return;
  }
  host.textContent = origin ? hostnameOf(origin) : origin;
  void document.body.setAttribute('data-grant', 'ready');

  async function syncAndInject(): Promise<void> {
    try {
      const response = await chrome.runtime.sendMessage(siteAccessSyncMessage());
      const parsed = parseStatusResponse(response);
      if (!parsed.ok) throw new Error(parsed.message ?? 'Site access could not be applied.');
    } catch {
      // The persistent registration still covers future navigations.
    }
    if (tabId !== undefined) {
      try {
        await injectSiteScripts(tabId);
      } catch {
        // Registration covers the next load of the player frame.
      }
    }
  }

  function finish(success: boolean, text: string): void {
    status.textContent = text;
    status.dataset.tone = success ? 'success' : 'error';
    if (success) {
      // The tab was opened by the background, so window.close is permitted.
      setTimeout(() => window.close(), 1500);
    } else {
      grant.disabled = false;
    }
  }

  void chrome.permissions.contains({ origins: [pattern] }).then(async alreadyGranted => {
    if (alreadyGranted) {
      grant.disabled = true;
      status.textContent = 'Access already granted. Applying it to the open tab...';
      await syncAndInject();
      finish(true, 'Done. Switch back to your video and play it.');
      return;
    }
    grant.disabled = false;
  }).catch(() => {
    grant.disabled = false;
  });

  grant.addEventListener('click', async () => {
    grant.disabled = true;
    status.textContent = '';
    let granted: boolean;
    try {
      // Must be called synchronously in the click handler: Firefox requires
      // a live user gesture for permissions.request. Do NOT await anything
      // before this call.
      granted = await chrome.permissions.request({ origins: [pattern] });
    } catch (error) {
      console.error('[AniWebScale] Grant page permission request failed.', error);
      finish(false, 'The browser refused the request. Grant access from the extension popup instead.');
      return;
    }
    if (!granted) {
      finish(false, 'Access was denied. You can grant it later from the extension popup.');
      return;
    }
    status.textContent = 'Access granted. Applying it to the open tab...';
    await syncAndInject();
    finish(true, 'Done. Switch back to your video and enter fullscreen.');
  });
});

function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}
