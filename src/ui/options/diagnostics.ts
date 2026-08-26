import { NATIVE_HOST_NAME } from '../../native/protocol';
import { message } from '../i18n';

export type CapabilityStatus = 'available' | 'unavailable' | 'windows-only';

export function setBadge(el: HTMLElement, text: string, ok: boolean | null): void {
  el.textContent = text;
  el.className = 'status-badge';
  if (ok === true) el.classList.add('available');
  else if (ok === false) el.classList.add('unavailable');
  else el.classList.add('checking');
}

function probeNativeHost(): Promise<boolean> {
  return new Promise(resolve => {
    try {
      const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      port.onDisconnect.addListener(() => resolve(!chrome.runtime.lastError));
      setTimeout(() => {
        try { port.disconnect(); } catch { /* already disconnected */ }
        resolve(true);
      }, 300);
    } catch {
      resolve(false);
    }
  });
}

export interface SystemStatus {
  webgpu: Exclude<CapabilityStatus, 'windows-only'>;
  native: CapabilityStatus;
}

export async function renderSystemStatus(): Promise<SystemStatus> {
  const webgpuEl = document.getElementById('webgpu-status') as HTMLSpanElement;
  const nativeEl = document.getElementById('native-host-status') as HTMLSpanElement;

  let webgpuOk = false;
  if (navigator.gpu) {
    try {
      webgpuOk = Boolean(await navigator.gpu.requestAdapter());
    } catch {
      // WebGPU exists but no adapter; stays unavailable.
    }
  }
  setBadge(
    webgpuEl,
    webgpuOk ? message('statusAvailable', 'Available') : message('statusUnavailable', 'Unavailable'),
    webgpuOk,
  );

  const isWindows = /win/i.test(navigator.platform) || navigator.userAgent.includes('Windows');
  if (!isWindows) {
    setBadge(nativeEl, message('statusWindowsOnly', 'Windows only'), null);
    return { webgpu: webgpuOk ? 'available' : 'unavailable', native: 'windows-only' };
  }

  const installed = await probeNativeHost();
  setBadge(
    nativeEl,
    installed ? message('statusAvailable', 'Available') : message('statusUnavailable', 'Unavailable'),
    installed,
  );
  return {
    webgpu: webgpuOk ? 'available' : 'unavailable',
    native: installed ? 'available' : 'unavailable',
  };
}

/** Boot a real WebGPU device and draw one triangle. */
export async function runWebGpuTestRender(): Promise<boolean> {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      const context = canvas.getContext('webgpu');
      if (!context) return false;
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format });
      const shader = device.createShaderModule({
        code: `
@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[i], 0.0, 1.0);
}
@fragment
fn fs() -> @location(0) vec4f {
  return vec4f(0.4, 0.72, 0.62, 1.0);
}
`,
      });
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shader, entryPoint: 'vs' },
        fragment: { module: shader, entryPoint: 'fs', targets: [{ format }] },
      });
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
      await device.queue.onSubmittedWorkDone();
      return true;
    } finally {
      device.destroy();
    }
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea fallback.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  textarea.remove();
  return ok;
}
