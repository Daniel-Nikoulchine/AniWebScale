import { existsSync } from 'node:fs';
import path, { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { firefox } from '@playwright/test';
import { cmd as webExt } from 'web-ext';
import { PRIMARY_ORIGIN, startFixtureServers } from './server.mjs';

const workspace = path.resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDir = path.join(workspace, 'dist-firefox');
const artifactsDir = path.join(workspace, '.tmp', 'web-ext-artifacts');
const firefoxHeadless = process.env.E2E_FIREFOX_HEADLESS === '1';
const firefoxForceNoAdapter = process.env.E2E_FIREFOX_FORCE_NO_ADAPTER === '1';
const execFileAsync = promisify(execFile);

async function findDebuggerOwnerPid(port) {
  if (process.platform !== 'win32' || !Number.isInteger(port)) return undefined;
  const { stdout } = await execFileAsync('netstat.exe', ['-ano', '-p', 'tcp'], { windowsHide: true });
  for (const line of stdout.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 5 || fields[0].toUpperCase() !== 'TCP') continue;
    if (fields[1].endsWith(`:${port}`) && fields[2].endsWith(':0')) {
      const pid = Number(fields.at(-1));
      if (Number.isInteger(pid) && pid > 0) return pid;
    }
  }
  return undefined;
}

function candidateFirefoxBinaries() {
  const candidates = [process.env.FIREFOX_BINARY];
  try { candidates.push(firefox.executablePath()); } catch { /* Playwright browser is optional. */ }
  if (process.platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      'C:\\Program Files (x86)\\Mozilla Firefox\\firefox.exe',
    );
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Firefox.app/Contents/MacOS/firefox');
  } else {
    for (const directory of (process.env.PATH || '').split(path.delimiter)) {
      candidates.push(path.join(directory, 'firefox'));
    }
  }
  return candidates.filter(Boolean);
}

const firefoxBinary = candidateFirefoxBinaries().find(candidate => existsSync(candidate));
if (!firefoxBinary) {
  throw new Error('Firefox E2E requires a Firefox binary. Run npm run test:e2e:install or set FIREFOX_BINARY.');
}
if (!existsSync(path.join(sourceDir, 'manifest.json'))) {
  throw new Error('dist-firefox is missing. Run npm run build:firefox before the E2E runner.');
}

const servers = await startFixtureServers();
const token = randomUUID();
let runner;
try {
  runner = await webExt.run({
    artifactsDir,
    sourceDir,
    target: ['firefox-desktop'],
    firefox: firefoxBinary,
    startUrl: [`${PRIMARY_ORIGIN}/firefox-self-test.html?token=${encodeURIComponent(token)}&forceNoAdapter=${firefoxForceNoAdapter ? '1' : '0'}`],
    // Firefox exposes navigator.gpu in headless mode on Windows but currently
    // returns no adapter. Run headed by default so this suite exercises the
    // live WebGPU renderer instead of only detecting the API surface.
    args: firefoxHeadless ? ['-headless'] : [],
    pref: {
      'media.autoplay.default': 0,
      'media.autoplay.blocking_policy': 0,
      'browser.shell.checkDefaultBrowser': false,
      'dom.webgpu.enabled': true,
      'gfx.webgpu.force-enabled': true,
      'full-screen-api.allow-trusted-requests-only': false,
    },
    noInput: true,
    noReload: true,
    verbose: false,
  });
  const result = await servers.waitForResult(token, Number(process.env.E2E_FIREFOX_TIMEOUT || 180_000));
  for (const check of result.checks || []) {
    console.log(`${check.pass ? 'PASS' : 'FAIL'}  ${check.name}${check.detail ? `: ${check.detail}` : ''}`);
  }
  if (!result.pass) throw new Error('Firefox extension self-test reported one or more failures.');
  console.log(`Firefox E2E passed using ${firefoxBinary}`);
} finally {
  if (runner) {
    const desktopRunner = runner.extensionRunners?.find(candidate => candidate.getName?.() === 'Firefox Desktop');
    const managedPid = desktopRunner?.runningInfo?.firefox?.pid;
    const debuggerPort = desktopRunner?.runningInfo?.debuggerPort;
    let didClose = false;
    const closed = new Promise(resolve => runner.registerCleanup(() => { didClose = true; resolve(); }));
    desktopRunner?.remoteFirefox?.disconnect?.();
    await runner.exit().catch(error => console.warn(`Firefox cleanup warning: ${error.message}`));
    await Promise.race([closed, new Promise(resolve => setTimeout(resolve, 3_000))]);
    if (!didClose && process.platform === 'win32') {
      // Recent Firefox builds can leave their main process alive after the
      // launcher receives SIGTERM and respawn under a different PID. Resolve
      // the owner of this runner's unique debugger port and kill only that
      // process tree; never target user Firefox instances by image name.
      const debuggerOwnerPid = await findDebuggerOwnerPid(debuggerPort).catch(() => undefined);
      const cleanupPid = debuggerOwnerPid ?? managedPid;
      let processExists = Number.isInteger(cleanupPid);
      if (processExists && cleanupPid !== debuggerOwnerPid) {
        try { process.kill(cleanupPid, 0); } catch { processExists = false; }
      }
      if (processExists) {
        await execFileAsync('taskkill.exe', ['/PID', String(cleanupPid), '/T', '/F'], { windowsHide: true })
          .catch(error => console.warn(`Firefox process-tree cleanup warning: ${error.message}`));
      }
      await Promise.race([closed, new Promise(resolve => setTimeout(resolve, 5_000))]);
    }
    // Firefox can release the final profile file handle just after its child
    // process emits close. Give firefox-profile's exit cleanup a clean window.
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  await servers.close();
}
