#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');

function parseArgs(argv) {
  const out = {
    samples: 1000,
    atlasResolution: 512,
    timeoutMs: 180000,
    httpPort: 9002,
    cdpPort: 9223,
    angle: 'metal',
    smokeTest: false,
    previewTest: false,
    hibernationTest: false,
    keyboardIdleTest: false,
    snapshotUiTest: false,
    floorRoughnessTest: false
  };
  for (const arg of argv) {
    if (arg.startsWith('--samples=')) out.samples = Number(arg.slice('--samples='.length));
    else if (arg.startsWith('--atlas-resolution=')) out.atlasResolution = Number(arg.slice('--atlas-resolution='.length));
    else if (arg.startsWith('--timeout-ms=')) out.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    else if (arg.startsWith('--http-port=')) out.httpPort = Number(arg.slice('--http-port='.length));
    else if (arg.startsWith('--cdp-port=')) out.cdpPort = Number(arg.slice('--cdp-port='.length));
    else if (arg.startsWith('--angle=')) out.angle = arg.slice('--angle='.length);
    else if (arg === '--smoke-test') out.smokeTest = true;
    else if (arg === '--preview-test') out.previewTest = true;
    else if (arg === '--hibernation-test') out.hibernationTest = true;
    else if (arg === '--keyboard-idle-test') out.keyboardIdleTest = true;
    else if (arg === '--snapshot-ui-test') out.snapshotUiTest = true;
    else if (arg === '--floor-roughness-test') out.floorRoughnessTest = true;
  }
  if (!['metal', 'swiftshader', 'opengl'].includes(out.angle)) throw new Error('Invalid angle mode');
  for (const key of ['samples', 'atlasResolution', 'timeoutMs', 'httpPort', 'cdpPort']) {
    if (!Number.isFinite(out[key]) || out[key] <= 0) throw new Error(`Invalid ${key}`);
    out[key] = Math.trunc(out[key]);
  }
  return out;
}

function timestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

function mimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.glsl')) return 'text/plain; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function checkHttpServer(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/Home_Studio.html`, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function startStaticServer(port) {
  if (await checkHttpServer(port)) return null;
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      const decodedPath = decodeURIComponent(url.pathname === '/' ? '/Home_Studio.html' : url.pathname);
      const filePath = path.resolve(repoRoot, `.${decodedPath}`);
      if (!filePath.startsWith(repoRoot)) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeType(filePath), 'Cache-Control': 'no-store' });
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.writeHead(500);
      res.end(String(error && error.message ? error.message : error));
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

function findBrowser() {
  const candidates = [
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('No supported browser found');
  return found;
}

async function waitForCdp(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return await response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`CDP did not open on port ${port}`);
}

async function openCdpTarget(port, url) {
  const newUrl = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  let response = await fetch(newUrl, { method: 'PUT' });
  if (!response.ok) response = await fetch(newUrl);
  if (response.ok) {
    const target = await response.json();
    if (target.webSocketDebuggerUrl) return target;
  }
  const listResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await listResponse.json();
  const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
  if (!page) throw new Error('No CDP page target found');
  return page;
}

class CdpWebSocket {
  constructor(wsUrl) {
    const parsed = new URL(wsUrl);
    this.host = parsed.hostname;
    this.port = Number(parsed.port || 80);
    this.path = `${parsed.pathname}${parsed.search}`;
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = new Map();
    this.fragmentedText = [];
  }

  async connect() {
    this.socket = net.connect(this.port, this.host);
    await new Promise((resolve, reject) => {
      this.socket.once('connect', resolve);
      this.socket.once('error', reject);
    });
    const key = crypto.randomBytes(16).toString('base64');
    const request = [
      `GET ${this.path} HTTP/1.1`,
      `Host: ${this.host}:${this.port}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      '\r\n'
    ].join('\r\n');
    this.socket.write(request);
    await this.readHandshake();
    this.socket.on('data', (chunk) => this.handleData(chunk));
    this.socket.on('error', (error) => this.rejectAll(error));
    this.socket.on('close', () => this.rejectAll(new Error('CDP socket closed')));
    if (this.buffer.length > 0) this.handleData(Buffer.alloc(0));
  }

  readHandshake() {
    return new Promise((resolve, reject) => {
      let handshake = Buffer.alloc(0);
      const onData = (chunk) => {
        handshake = Buffer.concat([handshake, chunk]);
        const marker = handshake.indexOf('\r\n\r\n');
        if (marker < 0) return;
        this.socket.off('data', onData);
        const header = handshake.slice(0, marker).toString('utf8');
        if (!header.includes('101')) {
          reject(new Error(`WebSocket handshake failed: ${header}`));
          return;
        }
        const rest = handshake.slice(marker + 4);
        if (rest.length) this.buffer = Buffer.concat([this.buffer, rest]);
        resolve();
      };
      this.socket.on('data', onData);
      this.socket.once('error', reject);
    });
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const frame = this.readFrame();
      if (!frame) break;
      if (frame.opcode === 0x8) {
        this.close();
        break;
      }
      if (frame.opcode === 0x9) {
        this.writeFrame(frame.payload, 0xA);
        continue;
      }
      if (frame.opcode === 0x1 && !frame.fin) {
        this.fragmentedText = [frame.payload];
        continue;
      }
      let payload = frame.payload;
      if (frame.opcode === 0x0) {
        if (this.fragmentedText.length === 0) continue;
        this.fragmentedText.push(frame.payload);
        if (!frame.fin) continue;
        payload = Buffer.concat(this.fragmentedText);
        this.fragmentedText = [];
      } else if (frame.opcode !== 0x1) {
        continue;
      }
      const message = JSON.parse(payload.toString('utf8'));
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      } else if (message.method && this.eventWaiters.has(message.method)) {
        const waiters = this.eventWaiters.get(message.method);
        this.eventWaiters.delete(message.method);
        for (const waiter of waiters) waiter.resolve(message.params || {});
      }
    }
  }

  readFrame() {
    if (this.buffer.length < 2) return null;
    const first = this.buffer[0];
    const second = this.buffer[1];
    const fin = (first & 0x80) !== 0;
    const opcode = first & 0x0f;
    let length = second & 0x7f;
    let offset = 2;
    if (length === 126) {
      if (this.buffer.length < offset + 2) return null;
      length = this.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (this.buffer.length < offset + 8) return null;
      const high = this.buffer.readUInt32BE(offset);
      const low = this.buffer.readUInt32BE(offset + 4);
      length = high * 2 ** 32 + low;
      offset += 8;
    }
    const masked = (second & 0x80) !== 0;
    let mask;
    if (masked) {
      if (this.buffer.length < offset + 4) return null;
      mask = this.buffer.slice(offset, offset + 4);
      offset += 4;
    }
    if (this.buffer.length < offset + length) return null;
    let payload = this.buffer.slice(offset, offset + length);
    this.buffer = this.buffer.slice(offset + length);
    if (masked) {
      const unmasked = Buffer.alloc(payload.length);
      for (let i = 0; i < payload.length; i += 1) unmasked[i] = payload[i] ^ mask[i % 4];
      payload = unmasked;
    }
    return { fin, opcode, payload };
  }

  writeFrame(payload, opcode = 0x1) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
    let headerLength = 2;
    if (data.length >= 126 && data.length < 65536) headerLength += 2;
    else if (data.length >= 65536) headerLength += 8;
    const header = Buffer.alloc(headerLength + 4);
    header[0] = 0x80 | opcode;
    let offset = 2;
    if (data.length < 126) {
      header[1] = 0x80 | data.length;
    } else if (data.length < 65536) {
      header[1] = 0x80 | 126;
      header.writeUInt16BE(data.length, offset);
      offset += 2;
    } else {
      header[1] = 0x80 | 127;
      header.writeUInt32BE(0, offset);
      header.writeUInt32BE(data.length, offset + 4);
      offset += 8;
    }
    const mask = crypto.randomBytes(4);
    mask.copy(header, offset);
    const masked = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i += 1) masked[i] = data[i] ^ mask[i % 4];
    this.socket.write(Buffer.concat([header, masked]));
  }

  send(method, params = {}, timeoutMs = 30000) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    this.writeFrame(payload);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
    for (const waiters of this.eventWaiters.values()) {
      for (const waiter of waiters) waiter.reject(error);
    }
    this.eventWaiters.clear();
  }

  waitForEvent(method, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = this.eventWaiters.get(method) || [];
        this.eventWaiters.set(method, waiters.filter((waiter) => waiter.resolve !== wrappedResolve));
        reject(new Error(`CDP event timeout: ${method}`));
      }, timeoutMs);
      const wrappedResolve = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
      const wrappedReject = (error) => {
        clearTimeout(timer);
        reject(error);
      };
      const waiters = this.eventWaiters.get(method) || [];
      waiters.push({ resolve: wrappedResolve, reject: wrappedReject });
      this.eventWaiters.set(method, waiters);
    });
  }

  close() {
    if (this.socket && !this.socket.destroyed) this.socket.destroy();
  }
}

async function evaluate(cdp, expression, options = {}) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: !!options.awaitPromise,
    returnByValue: options.returnByValue !== false,
    userGesture: true
  }, options.timeoutMs || 30000);
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails, null, 2));
  }
  return result.result ? result.result.value : undefined;
}

async function waitForExpression(cdp, expression, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await evaluate(cdp, expression, { timeoutMs: 30000 });
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

function base64ToBuffer(value) {
  if (!value) return Buffer.alloc(0);
  return Buffer.from(value, 'base64');
}

function getGitValue(args, fallback) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function buildManifest({ report, packageDir, smokeTest }) {
  const branch = getGitValue(['branch', '--show-current'], 'UNKNOWN_BRANCH');
  const dirty = getGitValue(['status', '--porcelain'], '');
  const commit = dirty ? 'WORKTREE_DIRTY' : getGitValue(['rev-parse', 'HEAD'], 'UNKNOWN_COMMIT');
  return {
    version: 'r7-3-8-c1-1000spp-bake-capture',
    config: 1,
    createdAt: new Date().toISOString(),
    branch,
    commit,
    smokeTest,
    targetAtlasResolution: report.targetAtlasResolution,
    requestedSamples: report.requestedSamples,
    diffuseOnly: report.diffuseOnly === true,
    upscaled: false,
    packageDir: path.relative(repoRoot, packageDir),
    artifacts: {
      rawHdrSummary: 'raw-hdr-summary.json',
      surfaceClassSummary: 'surface-class-summary.json',
      atlasPatch0: 'atlas-patch-000-rgba-f32.bin',
      texelMetadataPatch0: 'texel-metadata-patch-000-f32.bin',
      validationReport: 'validation-report.json'
    }
  };
}

function validatePayload({ report, validationReport, atlasBuffer, metadataBuffer, smokeTest }) {
  const resolution = report.targetAtlasResolution;
  const expectedAtlasBytes = resolution * resolution * 4 * 4;
  const expectedMetadataBytes = resolution * resolution * 12 * 4;
  const checks = {
    version: report.version === 'r7-3-8-c1-1000spp-bake-capture',
    config: report.config === 1,
    rawSamples: smokeTest ? report.rawHdr.actualSamples >= report.requestedSamples : report.rawHdr.actualSamples >= 1000,
    atlasSamples: smokeTest ? report.atlasSummary.actualSamples >= report.requestedSamples : report.atlasSummary.actualSamples >= 1000,
    patchSamples: Array.isArray(report.atlasSummary.actualSamplesByPatch) && report.atlasSummary.actualSamplesByPatch.every((entry) => smokeTest ? entry.actualSamples >= report.requestedSamples : entry.actualSamples >= 1000),
    diffuseOnly: report.diffuseOnly === true && report.atlasSummary.diffuseOnly === true,
    upscaled: report.upscaled === false && report.atlasSummary.upscaled === false,
    atlasResolution: report.atlasSummary.patchSize === resolution,
    atlasBytes: atlasBuffer.length === expectedAtlasBytes,
    metadataBytes: metadataBuffer.length === expectedMetadataBytes,
    finiteRaw: report.rawHdrSummary.nonFinitePixels === 0,
    finiteAtlas: report.atlasSummary.nonFiniteTexels === 0,
    validTexelRatio: report.atlasSummary.validTexelRatio >= 0.99,
    browserValidation: smokeTest ? validationReport.status === 'pass' || validationReport.status === 'fail' : validationReport.status === 'pass'
  };
  const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  return { status: failed.length === 0 ? 'pass' : 'fail', checks, failed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.error('[r738-runner] starting static server');
  const server = await startStaticServer(args.httpPort);
  const browserPath = findBrowser();
  const userDataDir = path.join('/private/tmp', `home-studio-r738-cdp-${Date.now()}`);
  const browserArgs = [
    '--headless=new',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    `--use-angle=${args.angle}`,
    `--remote-debugging-port=${args.cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ];
  if (args.angle === 'swiftshader') browserArgs.splice(5, 0, '--enable-unsafe-swiftshader');
  const browser = spawn(browserPath, browserArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  let completed = false;
  browser.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
    if (stderr.length > 12000) stderr = stderr.slice(-12000);
  });
  let cdp;
  try {
    console.error('[r738-runner] waiting for CDP');
    await waitForCdp(args.cdpPort, 20000);
    const url = `http://127.0.0.1:${args.httpPort}/Home_Studio.html?verify=r7-3-8-c1-1000spp-bake-capture&runner=${Date.now()}`;
    console.error('[r738-runner] opening target');
    const target = await openCdpTarget(args.cdpPort, 'about:blank');
    cdp = new CdpWebSocket(target.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    console.error('[r738-runner] navigating page');
    await cdp.send('Page.navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.error('[r738-runner] page navigation issued');
    console.error('[r738-runner] waiting for capture helper');
    await waitForExpression(cdp, args.hibernationTest || args.keyboardIdleTest || args.snapshotUiTest
      ? 'typeof window.reportHomeStudioHibernationLoopState === "function"'
      : args.floorRoughnessTest
        ? 'typeof window.reportFloorRoughness === "function"'
        : args.previewTest
        ? 'typeof window.reportR738C1BakePastePreviewConfig === "function"'
        : 'typeof window.reportR738C1BakeCaptureAfterSamples === "function"', 60000);
    if (args.floorRoughnessTest) {
      console.error('[r738-runner] running floor roughness helper');
      const floorRoughnessReport = await evaluate(cdp, `(() => {
        return (async () => {
          const slider = document.getElementById('slider-floor-roughness');
          if (!slider) throw new Error('slider-floor-roughness missing');
          const range = slider.querySelector('input[type=range]');
          const number = slider.querySelector('input[type=number]');
          const initialReport = window.reportFloorRoughness();
          const initialRangeValue = range ? Number(range.value) : null;
          const initialNumberValue = number ? Number(number.value) : null;
          window.setFloorRoughness(0.25);
          await new Promise((resolve) => setTimeout(resolve, 50));
          const changedReport = window.reportFloorRoughness();
          const changedRangeValue = range ? Number(range.value) : null;
          const changedNumberValue = number ? Number(number.value) : null;
          window.setFloorRoughness(1.0);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            initialReport,
            initialRangeValue,
            initialNumberValue,
            changedReport,
            changedRangeValue,
            changedNumberValue,
            finalReport: window.reportFloorRoughness()
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000)
      });
      const floorRoughnessDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-floor-roughness', timestampForPath());
      fs.mkdirSync(floorRoughnessDir, { recursive: true });
      const floorRoughnessValidation = {
        status: floorRoughnessReport.initialReport.value === 1.0 &&
          floorRoughnessReport.initialRangeValue === 1.0 &&
          floorRoughnessReport.initialNumberValue === 1.0 &&
          floorRoughnessReport.changedReport.value === 0.25 &&
          floorRoughnessReport.changedRangeValue === 0.25 &&
          floorRoughnessReport.changedNumberValue === 0.25 &&
          floorRoughnessReport.finalReport.value === 1.0 &&
          floorRoughnessReport.finalReport.pureDiffuseAtOne === true
          ? 'pass'
          : 'fail',
        report: floorRoughnessReport
      };
      fs.writeFileSync(path.join(floorRoughnessDir, 'floor-roughness-report.json'), `${JSON.stringify(floorRoughnessValidation, null, 2)}\n`);
      console.log('R7-3.8 C1 floor roughness UI completed');
      console.log(`initial: ${floorRoughnessReport.initialReport.value}`);
      console.log(`changed: ${floorRoughnessReport.changedReport.value}`);
      console.log(`restored: ${floorRoughnessReport.finalReport.value}`);
      console.log(`status: ${floorRoughnessValidation.status}`);
      console.log(`report: ${path.relative(repoRoot, floorRoughnessDir)}`);
      if (floorRoughnessValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.snapshotUiTest) {
      console.error('[r738-runner] running snapshot UI helper');
      const snapshotUiReport = await evaluate(cdp, `(() => {
        return (async () => {
          function click(id) {
            const el = document.getElementById(id);
            if (!el) throw new Error(id + ' missing');
            el.click();
            return el;
          }
          async function waitFor(predicate, label) {
            const start = performance.now();
            while (performance.now() - start < ${Math.min(args.timeoutMs, 60000)}) {
              const value = predicate();
              if (value) return value;
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
            throw new Error(label + ' timeout');
          }
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          if (typeof window.setSnapshotCaptureEnabled === 'function') window.setSnapshotCaptureEnabled(false);
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          await new Promise((resolve) => setTimeout(resolve, 250));
          sampleCounter = 20;
          frameCounter = 21;
          if (pathTracingUniforms && pathTracingUniforms.uSampleCounter)
            pathTracingUniforms.uSampleCounter.value = sampleCounter;
          if (pathTracingUniforms && pathTracingUniforms.uFrameCounter)
            pathTracingUniforms.uFrameCounter.value = frameCounter;
          if (screenOutputUniforms && screenOutputUniforms.uSampleCounter)
            screenOutputUniforms.uSampleCounter.value = sampleCounter;
          if (screenOutputUniforms && screenOutputUniforms.uOneOverSampleCounter)
            screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);

          const toggle = click('btn-toggle-snapshots');
          const snapshotToggleText = toggle.textContent;
          const manualEnabled = document.getElementById('btn-manual-capture').disabled === false;

          click('btn-toggle-sampling');
          const beforeStepReport = await waitFor(() => {
            const report = window.reportSamplingPaused();
            const loop = window.reportHomeStudioHibernationLoopState();
            return report.paused && loop.sleeping && loop.framePending === false ? report : null;
          }, 'pause');

          click('btn-step-sampling');
          const afterStepReport = await waitFor(() => {
            const report = window.reportSamplingPaused();
            return report.paused &&
              report.stepOncePending === false &&
              report.currentSamples === beforeStepReport.currentSamples + 1
              ? report
              : null;
          }, 'step');

          click('btn-step-back-sampling');
          const afterBackReport = await waitFor(() => {
            const report = window.reportSamplingPaused();
            const loop = window.reportHomeStudioHibernationLoopState();
            return report.paused &&
              report.currentSamples === beforeStepReport.currentSamples &&
              loop.framePending === false
              ? report
              : null;
          }, 'stepBack');

          click('btn-toggle-sampling');
          const afterResumeReport = await waitFor(() => {
            const report = window.reportSamplingPaused();
            return !report.paused && report.currentSamples > afterBackReport.currentSamples ? report : null;
          }, 'resume');

          return {
            snapshotToggleText,
            manualEnabled,
            beforeStepReport,
            afterStepReport,
            afterBackReport,
            afterResumeReport,
            stepButtonText: document.getElementById('btn-step-sampling').textContent,
            samplingToggleText: document.getElementById('btn-toggle-sampling').textContent
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000) + 30000
      });
      const snapshotUiDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-snapshot-ui', timestampForPath());
      fs.mkdirSync(snapshotUiDir, { recursive: true });
      const {
        beforeStepReport,
        afterStepReport,
        afterBackReport,
        afterResumeReport
      } = snapshotUiReport;
      const snapshotUiValidation = {
        status: snapshotUiReport.snapshotToggleText === '快照：開' &&
          snapshotUiReport.manualEnabled === true &&
          beforeStepReport.paused === true &&
          afterStepReport.currentSamples === beforeStepReport.currentSamples + 1 &&
          afterBackReport.currentSamples === beforeStepReport.currentSamples &&
          afterResumeReport.paused === false &&
          afterResumeReport.currentSamples > afterBackReport.currentSamples
          ? 'pass'
          : 'fail',
        report: snapshotUiReport
      };
      fs.writeFileSync(path.join(snapshotUiDir, 'snapshot-ui-report.json'), `${JSON.stringify(snapshotUiValidation, null, 2)}\n`);
      console.log('R7-3.8 C1 snapshot UI completed');
      console.log(`snapshotToggle: ${snapshotUiReport.snapshotToggleText}`);
      console.log(`manualEnabled: ${snapshotUiReport.manualEnabled}`);
      console.log(`stepSamples: ${beforeStepReport.currentSamples}->${afterStepReport.currentSamples}`);
      console.log(`backSamples: ${afterBackReport.currentSamples}`);
      console.log(`resumeSamples: ${afterResumeReport.currentSamples}`);
      console.log(`status: ${snapshotUiValidation.status}`);
      console.log(`report: ${path.relative(repoRoot, snapshotUiDir)}`);
      if (snapshotUiValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.keyboardIdleTest) {
      console.error('[r738-runner] running keyboard idle helper');
      const keyboardIdleReport = await evaluate(cdp, `(() => {
        return (async () => {
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          sampleCounter = Math.max(0, MAX_SAMPLES - 1);
          if (pathTracingUniforms && pathTracingUniforms.uSampleCounter)
            pathTracingUniforms.uSampleCounter.value = sampleCounter;
          if (screenOutputUniforms && screenOutputUniforms.uSampleCounter)
            screenOutputUniforms.uSampleCounter.value = sampleCounter;
          if (screenOutputUniforms && screenOutputUniforms.uOneOverSampleCounter)
            screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
          if (typeof scheduleHomeStudioAnimationFrame === 'function') scheduleHomeStudioAnimationFrame();
          const start = performance.now();
          let beforeReport = null;
          while (performance.now() - start < ${Math.min(args.timeoutMs, 60000)}) {
            const report = window.reportHomeStudioHibernationLoopState();
            if (report.sleeping && report.framePending === false && report.renderLimitReached) {
              beforeReport = report;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          if (!beforeReport) beforeReport = window.reportHomeStudioHibernationLoopState();
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true }));
          await new Promise((resolve) => setTimeout(resolve, 500));
          const idleKeyReport = window.reportHomeStudioHibernationLoopState();
          return { beforeReport, idleKeyReport };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000) + 30000
      });
      const keyboardIdleDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-keyboard-idle', timestampForPath());
      fs.mkdirSync(keyboardIdleDir, { recursive: true });
      const { beforeReport, idleKeyReport } = keyboardIdleReport;
      const keyboardIdleValidation = {
        status: beforeReport.sleeping &&
          beforeReport.framePending === false &&
          idleKeyReport.currentSamples === beforeReport.currentSamples &&
          idleKeyReport.sleeping === true &&
          idleKeyReport.framePending === false &&
          idleKeyReport.sceneParamsChanged === false
          ? 'pass'
          : 'fail',
        report: keyboardIdleReport
      };
      fs.writeFileSync(path.join(keyboardIdleDir, 'keyboard-idle-report.json'), `${JSON.stringify(keyboardIdleValidation, null, 2)}\n`);
      console.log('R7-3.8 C1 keyboard idle completed');
      console.log(`beforeSamples: ${beforeReport.currentSamples}/${beforeReport.maxSamples}`);
      console.log(`afterSamples: ${idleKeyReport.currentSamples}/${idleKeyReport.maxSamples}`);
      console.log(`sleeping: ${idleKeyReport.sleeping}`);
      console.log(`framePending: ${idleKeyReport.framePending}`);
      console.log(`status: ${keyboardIdleValidation.status}`);
      console.log(`report: ${path.relative(repoRoot, keyboardIdleDir)}`);
      if (keyboardIdleValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.hibernationTest) {
      console.error('[r738-runner] running hibernation helper');
      const hibernationReport = await evaluate(cdp, `(() => {
        return (async () => {
          if (typeof applyPanelConfig === 'function') applyPanelConfig(1);
          if (typeof window.setSamplingPaused === 'function') window.setSamplingPaused(false);
          sampleCounter = Math.max(0, MAX_SAMPLES - 2);
          if (pathTracingUniforms && pathTracingUniforms.uSampleCounter)
            pathTracingUniforms.uSampleCounter.value = sampleCounter;
          if (screenOutputUniforms && screenOutputUniforms.uSampleCounter)
            screenOutputUniforms.uSampleCounter.value = sampleCounter;
          if (screenOutputUniforms && screenOutputUniforms.uOneOverSampleCounter)
            screenOutputUniforms.uOneOverSampleCounter.value = 1.0 / Math.max(1.0, sampleCounter);
          if (typeof wakeRender === 'function') wakeRender('r7-3-8-c1-hibernation-test');
          const start = performance.now();
          while (performance.now() - start < ${Math.min(args.timeoutMs, 60000)}) {
            const report = window.reportHomeStudioHibernationLoopState();
            report.cameraInfoText = document.getElementById('cameraInfo')?.textContent || '';
            if (report.sleeping && report.framePending === false && report.renderLimitReached)
              return report;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          const finalReport = window.reportHomeStudioHibernationLoopState();
          finalReport.cameraInfoText = document.getElementById('cameraInfo')?.textContent || '';
          return finalReport;
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000) + 30000
      });
      const hibernationDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-hibernation', timestampForPath());
      fs.mkdirSync(hibernationDir, { recursive: true });
      const hibernationValidation = {
        status: hibernationReport.sleeping &&
          hibernationReport.framePending === false &&
          hibernationReport.renderLimitReached &&
          hibernationReport.cameraIsMoving === false &&
          hibernationReport.postProcessChanged === false &&
          /Samples: 1000/.test(hibernationReport.cameraInfoText)
          ? 'pass'
          : 'fail',
        report: hibernationReport
      };
      fs.writeFileSync(path.join(hibernationDir, 'hibernation-report.json'), `${JSON.stringify(hibernationValidation, null, 2)}\n`);
      console.log('R7-3.8 C1 hibernation loop completed');
      console.log(`sleeping: ${hibernationReport.sleeping}`);
      console.log(`framePending: ${hibernationReport.framePending}`);
      console.log(`samples: ${hibernationReport.currentSamples}/${hibernationReport.maxSamples}`);
      console.log(`cameraInfo: ${hibernationReport.cameraInfoText}`);
      console.log(`status: ${hibernationValidation.status}`);
      console.log(`report: ${path.relative(repoRoot, hibernationDir)}`);
      if (hibernationValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.previewTest) {
      console.error('[r738-runner] running paste-preview helper');
      const previewReport = await evaluate(cdp, `(() => {
        return (async () => {
          await window.waitForR738C1BakePastePreviewReady(${Math.min(args.timeoutMs, 60000)});
          window.setR738C1BakePastePreviewEnabled(true);
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return window.reportR738C1BakePastePreviewConfig();
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000) + 30000
      });
      const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, 30000);
      const previewDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-bake-paste-preview', timestampForPath());
      fs.mkdirSync(previewDir, { recursive: true });
      const previewValidation = {
        status: previewReport.ready &&
          previewReport.applied &&
          previewReport.packageDir === '.omc/r7-3-8-c1-1000spp-bake-capture/20260511-154229' &&
          previewReport.targetAtlasResolution === 512 &&
          previewReport.samplesPerTexel === 1000 &&
          previewReport.upscaled === false &&
          previewReport.diffuseOnly === true
          ? 'pass'
          : 'fail',
        report: previewReport,
        artifacts: {
          screenshot: 'preview-screenshot.png'
        }
      };
      fs.writeFileSync(path.join(previewDir, 'preview-report.json'), `${JSON.stringify(previewValidation, null, 2)}\n`);
      fs.writeFileSync(path.join(previewDir, 'preview-screenshot.png'), base64ToBuffer(screenshot.data));
      console.log('R7-3.8 C1 bake paste preview completed');
      console.log(`ready: ${previewReport.ready}`);
      console.log(`applied: ${previewReport.applied}`);
      console.log(`package: ${previewReport.packageDir}`);
      console.log(`status: ${previewValidation.status}`);
      console.log(`preview: ${path.relative(repoRoot, previewDir)}`);
      if (previewValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    console.error('[r738-runner] running capture helper');
    const expression = `(() => {
      function f32ToBase64(arr) {
        if (!arr) return null;
        const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, chunk);
        }
        return btoa(binary);
      }
      return (async () => {
        const report = await window.reportR738C1BakeCaptureAfterSamples(${args.samples}, ${args.timeoutMs}, {
          targetAtlasResolution: ${args.atlasResolution},
          smokeTest: ${args.smokeTest ? 'true' : 'false'}
        });
        const artifacts = window.getR738C1BakeCaptureArtifacts();
        return {
          report,
          rawHdrSummary: artifacts.rawHdrSummary,
          surfaceClassSummary: artifacts.surfaceClassSummary,
          validationReport: artifacts.validationReport,
          atlasBase64: f32ToBase64(artifacts.atlasPixels),
          metadataBase64: f32ToBase64(artifacts.texelMetadata)
        };
      })();
    })()`;
    const payload = await evaluate(cdp, expression, {
      awaitPromise: true,
      timeoutMs: args.timeoutMs + 180000
    });
    console.error('[r738-runner] capture helper returned');
    const atlasBuffer = base64ToBuffer(payload.atlasBase64);
    const metadataBuffer = base64ToBuffer(payload.metadataBase64);
    const validation = validatePayload({
      report: payload.report,
      validationReport: payload.validationReport,
      atlasBuffer,
      metadataBuffer,
      smokeTest: args.smokeTest
    });
    const packageDir = path.join(repoRoot, '.omc', 'r7-3-8-c1-1000spp-bake-capture', timestampForPath());
    fs.mkdirSync(packageDir, { recursive: true });
    const manifest = buildManifest({ report: payload.report, packageDir, smokeTest: args.smokeTest });
    const validationReport = {
      ...payload.validationReport,
      browserValidationStatus: payload.validationReport.status,
      runnerStatus: validation.status,
      runnerChecks: validation.checks,
      runnerFailedChecks: validation.failed
    };
    if (args.smokeTest && validation.status === 'pass') validationReport.status = 'pass';
    if (validation.status !== 'pass') validationReport.status = 'fail';
    fs.writeFileSync(path.join(packageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(packageDir, 'raw-hdr-summary.json'), `${JSON.stringify(payload.rawHdrSummary, null, 2)}\n`);
    fs.writeFileSync(path.join(packageDir, 'surface-class-summary.json'), `${JSON.stringify(payload.surfaceClassSummary, null, 2)}\n`);
    fs.writeFileSync(path.join(packageDir, 'atlas-patch-000-rgba-f32.bin'), atlasBuffer);
    fs.writeFileSync(path.join(packageDir, 'texel-metadata-patch-000-f32.bin'), metadataBuffer);
    fs.writeFileSync(path.join(packageDir, 'validation-report.json'), `${JSON.stringify(validationReport, null, 2)}\n`);
    console.log('R7-3.8 C1 bake capture completed');
    console.log(`samples: ${payload.report.atlasSummary.actualSamples}`);
    console.log(`atlasResolution: ${payload.report.targetAtlasResolution}`);
    console.log(`upscaled: ${payload.report.upscaled}`);
    console.log(`status: ${validationReport.status}`);
    console.log(`package: ${path.relative(repoRoot, packageDir)}`);
    if (validationReport.status !== 'pass') {
      console.error(`failedChecks: ${validation.failed.join(', ')}`);
      process.exitCode = 1;
    }
    completed = true;
  } finally {
    if (cdp) cdp.close();
    browser.kill('SIGTERM');
    if (server) await new Promise((resolve) => server.close(resolve));
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failure
    }
    if (!completed && stderr) {
      process.stderr.write(stderr);
    }
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
