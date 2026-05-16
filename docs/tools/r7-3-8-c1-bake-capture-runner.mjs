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
    floorRoughnessTest: false,
    accurateReflectionCapture: false,
    referenceOnly: false,
    surfaceCache: false,
    currentViewValidation: false,
    accurateReflectionPreviewTest: false,
    fullRoomDiffuseBake: false,
    r7310Surface: 'floor',
    runtimeShortCircuitTest: false,
    northWallRuntimeTest: false,
    eastWallRuntimeTest: false,
    r7310RuntimeProbeSampleTest: false,
    r738SproutPasteProbeTest: false,
    h5BlackLineProbeTest: false,
    uiToggleTest: false,
    targetSamples: null
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
    else if (arg === '--accurate-reflection-capture') out.accurateReflectionCapture = true;
    else if (arg === '--reference-only') out.referenceOnly = true;
    else if (arg === '--surface-cache') out.surfaceCache = true;
    else if (arg === '--r739-current-view-validation') out.currentViewValidation = true;
    else if (arg === '--accurate-reflection-preview-test') out.accurateReflectionPreviewTest = true;
    else if (arg === '--r7310-full-room-diffuse-bake') out.fullRoomDiffuseBake = true;
    else if (arg.startsWith('--r7310-surface=')) out.r7310Surface = arg.slice('--r7310-surface='.length);
    else if (arg === '--r7310-runtime-short-circuit-test') out.runtimeShortCircuitTest = true;
    else if (arg === '--r7310-north-wall-runtime-test') out.northWallRuntimeTest = true;
    else if (arg === '--r7310-east-wall-runtime-test') out.eastWallRuntimeTest = true;
    else if (arg === '--r7310-runtime-probe-sample-test') out.r7310RuntimeProbeSampleTest = true;
    else if (arg === '--r738-sprout-paste-probe-test') out.r738SproutPasteProbeTest = true;
    else if (arg === '--r7310-h5-black-line-probe') out.h5BlackLineProbeTest = true;
    else if (arg === '--r7310-ui-toggle-test') out.uiToggleTest = true;
    else if (arg.startsWith('--target-samples=')) out.targetSamples = Number(arg.slice('--target-samples='.length));
  }
  if (!['metal', 'swiftshader', 'opengl'].includes(out.angle)) throw new Error('Invalid angle mode');
  if (!['floor', 'north-wall', 'east-wall'].includes(out.r7310Surface)) throw new Error('Invalid r7310Surface');
  for (const key of ['samples', 'atlasResolution', 'timeoutMs', 'httpPort', 'cdpPort']) {
    if (!Number.isFinite(out[key]) || out[key] <= 0) throw new Error(`Invalid ${key}`);
    out[key] = Math.trunc(out[key]);
  }
  if (out.targetSamples !== null) {
    if (!Number.isFinite(out.targetSamples) || out.targetSamples <= 0) throw new Error('Invalid targetSamples');
    out.targetSamples = Math.trunc(out.targetSamples);
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
    version: report.version || 'r7-3-8-c1-1000spp-bake-capture',
    config: 1,
    batch: report.batch || null,
    targetId: report.targetId || null,
    surfaceName: report.surfaceName || 'floor_center_c1_reference',
    worldBounds: report.worldBounds || null,
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

function summarizeAtlasVisibleLuma(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const texels = Math.floor(buffer.byteLength / 16);
  let nonzeroTexels = 0;
  let sumLuma = 0;
  let maxLuma = 0;
  for (let offset = 0; offset < texels * 16; offset += 16) {
    const r = view.getFloat32(offset, true);
    const g = view.getFloat32(offset + 4, true);
    const b = view.getFloat32(offset + 8, true);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) continue;
    const luma = (r + g + b) / 3;
    sumLuma += luma;
    if (luma > 0) nonzeroTexels += 1;
    if (luma > maxLuma) maxLuma = luma;
  }
  return {
    texels,
    nonzeroTexels,
    meanLuma: texels ? sumLuma / texels : 0,
    maxLuma
  };
}

function validatePayload({ report, validationReport, atlasBuffer, metadataBuffer, smokeTest }) {
  const resolution = report.targetAtlasResolution;
  const expectedAtlasBytes = resolution * resolution * 4 * 4;
  const expectedMetadataBytes = resolution * resolution * 12 * 4;
  const validTexelRatioMinimum = report.surfaceName === 'c1_north_wall'
    ? 0.80
    : 0.99;
  const atlasVisibleLuma = summarizeAtlasVisibleLuma(atlasBuffer);
  const checks = {
    version: report.version === 'r7-3-8-c1-1000spp-bake-capture' || report.version === 'r7-3-10-full-room-diffuse-bake-architecture-probe',
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
    atlasVisibleLuma: atlasVisibleLuma.nonzeroTexels > 0 && atlasVisibleLuma.meanLuma > 0.001 && atlasVisibleLuma.maxLuma > 0.01,
    validTexelRatio: report.atlasSummary.validTexelRatio >= validTexelRatioMinimum,
    browserValidation: smokeTest ? validationReport.status === 'pass' || validationReport.status === 'fail' : validationReport.status === 'pass'
  };
  const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
  return { status: failed.length === 0 ? 'pass' : 'fail', checks, failed };
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function buildR739Manifest({ report, packageDir }) {
  const branch = getGitValue(['branch', '--show-current'], 'UNKNOWN_BRANCH');
  const dirty = getGitValue(['status', '--porcelain'], '');
  const commit = dirty ? 'WORKTREE_DIRTY' : getGitValue(['rev-parse', 'HEAD'], 'UNKNOWN_COMMIT');
  return {
    version: 'r7-3-9-c1-accurate-reflection-bake',
    config: 1,
    createdAt: new Date().toISOString(),
    branch,
    commit,
    policy: 'accuracy_over_speed',
    diffuseCheckpointTag: 'r7-3-8-c1-diffuse-bake-success-20260511',
    cameraReferenceSamples: report.actualSamples,
    floorRoughnessForReflection: report.floorRoughnessForReflection,
    referenceWidth: report.buffer.width,
    referenceHeight: report.buffer.height,
    surfaceTargets: ['sprout_reflection_c1'],
    deferredSurfaceTargets: ['iron_door_west', 'speaker_stands_rotated_boxes', 'speaker_cabinets_rotated_boxes'],
    sproutBounds: { xMin: -1.0, xMax: 1.0, zMin: -1.0, zMax: 1.0, y: 0.01 },
    cubemapRuntimeEnabled: false,
    packageDir: path.relative(repoRoot, packageDir),
    artifacts: {
      reference: 'c1-camera-reflection-reference-rgba-f32.bin',
      mask: 'c1-camera-reflection-mask-u8.bin',
      objectIds: 'c1-camera-reflection-object-id-u16.bin',
      surfaceCache: 'surface-reflection-cache-rgba-f32.bin',
      directionMetadata: 'surface-reflection-direction-metadata-f32.bin',
      texelMetadata: 'surface-reflection-texel-metadata-f32.bin',
      summary: 'reflection-target-summary.json',
      validationReport: 'validation-report.json'
    }
  };
}

function validateR739Payload({ report, validationReport, referenceBuffer, maskBuffer, objectIdBuffer, surfaceCacheBuffer, directionBuffer, texelBuffer }) {
  const width = report.buffer.width;
  const height = report.buffer.height;
  const pixels = width * height;
  const checks = {
    version: report.version === 'r7-3-9-c1-accurate-reflection-bake',
    config: report.config === 1,
    policy: report.policy === 'accuracy_over_speed',
    cubemapRuntimeDisabled: report.cubemapRuntimeEnabled === false,
    floorRoughnessForReflection: report.floorRoughnessForReflection === 0.1,
    actualSamples: report.actualSamples === 1000 && report.requestedSamples === 1000,
    validationPass: validationReport.status === 'pass',
    referenceBytes: referenceBuffer.length === pixels * 4 * 4,
    maskBytes: maskBuffer.length === pixels,
    objectIdBytes: objectIdBuffer.length === pixels * 2,
    surfaceCacheBytes: surfaceCacheBuffer.length === pixels * 4 * 4,
    directionBytes: directionBuffer.length === pixels * 8 * 4,
    texelBytes: texelBuffer.length === pixels * 8 * 4,
    targetMaskIncludesSprout: validationReport.checks.targetMaskIncludesSprout === true,
    targetMaskExcludesFloorPrimary: validationReport.checks.targetMaskExcludesFloorPrimary === true,
    outsideSproutPixels: validationReport.checks.outsideSproutPixels === true,
    insideSproutPixels: validationReport.checks.insideSproutPixels === true,
    reflectionMaxLuma: validationReport.checks.reflectionMaxLuma === true,
    reflectionNotOverbright: validationReport.checks.reflectionNotOverbright === true,
    targetMaskExcludesIronDoorRuntimeReplacement: validationReport.checks.targetMaskExcludesIronDoorRuntimeReplacement === true,
    targetMaskExcludesSpeakerStandsRuntimeReplacement: validationReport.checks.targetMaskExcludesSpeakerStandsRuntimeReplacement === true,
    targetMaskExcludesSpeakerCabinetsRuntimeReplacement: validationReport.checks.targetMaskExcludesSpeakerCabinetsRuntimeReplacement === true
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
    const helperExpression = args.hibernationTest || args.keyboardIdleTest || args.snapshotUiTest
      ? 'typeof window.reportHomeStudioHibernationLoopState === "function"'
      : args.floorRoughnessTest
        ? 'typeof window.reportFloorRoughness === "function"'
        : args.currentViewValidation
          ? 'typeof window.runR739C1CurrentViewReflectionValidation === "function"'
          : args.accurateReflectionPreviewTest
            ? 'typeof window.reportR739C1AccurateReflectionConfig === "function"'
            : args.previewTest
              ? 'typeof window.reportR738C1BakePastePreviewConfig === "function"'
              : args.accurateReflectionCapture
                ? 'typeof window.reportR739C1AccurateReflectionAfterSamples === "function"'
                : args.runtimeShortCircuitTest || args.northWallRuntimeTest || args.eastWallRuntimeTest || args.r7310RuntimeProbeSampleTest || args.h5BlackLineProbeTest || args.uiToggleTest
                  ? 'typeof window.reportR7310C1FullRoomDiffuseRuntimeProbe === "function"'
                  : args.r738SproutPasteProbeTest
                    ? 'typeof window.reportR738C1SproutPasteRuntimeProbe === "function"'
                    : args.fullRoomDiffuseBake
                    ? 'typeof window.reportR7310C1FloorDiffuseBakeAfterSamples === "function"'
                    : 'typeof window.reportR738C1BakeCaptureAfterSamples === "function"';
    await waitForExpression(cdp, helperExpression, 60000);
    if (args.uiToggleTest) {
      console.error('[r738-runner] running R7-3.10 UI toggle helper');
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const floorButton = document.getElementById('btn-r7310-floor-diffuse');
          const northButton = document.getElementById('btn-r7310-north-wall-diffuse');
          const eastButton = document.getElementById('btn-r7310-east-wall-diffuse');
          if (!floorButton) throw new Error('btn-r7310-floor-diffuse missing');
          if (!northButton) throw new Error('btn-r7310-north-wall-diffuse missing');
          if (!eastButton) throw new Error('btn-r7310-east-wall-diffuse missing');
          await window.waitForR7310C1FullRoomDiffuseRuntimeReady(${args.timeoutMs});
          if (window.reportR7310C1FullRoomDiffuseRuntimeConfig().enabled) {
            window.setR7310C1FullRoomDiffuseRuntimeEnabled(false);
          }
          const before = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          floorButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterFloorOn = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            floorClassName: floorButton.className,
            floorTitle: floorButton.title,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          northButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterNorthOn = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            northClassName: northButton.className,
            northTitle: northButton.title,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          eastButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterEastOn = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            eastClassName: eastButton.className,
            eastTitle: eastButton.title,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          floorButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterFloorOff = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          northButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          eastButton.click();
          await new Promise((resolve) => setTimeout(resolve, 100));
          const afterAllOff = {
            floorText: floorButton.textContent,
            northText: northButton.textContent,
            eastText: eastButton.textContent,
            report: window.reportR7310C1FullRoomDiffuseRuntimeConfig()
          };
          return {
            version: 'r7-3-10-c1-full-room-diffuse-ui-toggle',
            before,
            afterFloorOn,
            afterNorthOn,
            afterEastOn,
            afterFloorOff,
            afterAllOff,
            status: before.floorText === '地板烘焙：關' &&
              before.northText === '北牆烘焙：關' &&
              before.eastText === '東牆烘焙：關' &&
              before.report.uiMeaningOff === 'sprout_patch_plus_live_floor' &&
              afterFloorOn.floorText === '地板烘焙：開' &&
              afterFloorOn.northText === '北牆烘焙：關' &&
              afterFloorOn.eastText === '東牆烘焙：關' &&
              afterFloorOn.report.enabled === true &&
              afterFloorOn.report.floorEnabled === true &&
              afterFloorOn.report.northWallEnabled === false &&
              afterFloorOn.report.eastWallEnabled === false &&
              afterNorthOn.floorText === '地板烘焙：開' &&
              afterNorthOn.northText === '北牆烘焙：開' &&
              afterNorthOn.eastText === '東牆烘焙：關' &&
              afterNorthOn.report.floorEnabled === true &&
              afterNorthOn.report.northWallEnabled === true &&
              afterNorthOn.report.eastWallEnabled === false &&
              afterNorthOn.report.uiMeaningOn === 'selected_floor_north_or_east_wall_baked_diffuse_plus_live_reflection' &&
              afterEastOn.floorText === '地板烘焙：開' &&
              afterEastOn.northText === '北牆烘焙：開' &&
              afterEastOn.eastText === '東牆烘焙：開' &&
              afterEastOn.report.floorEnabled === true &&
              afterEastOn.report.northWallEnabled === true &&
              afterEastOn.report.eastWallEnabled === true &&
              afterFloorOff.floorText === '地板烘焙：關' &&
              afterFloorOff.northText === '北牆烘焙：開' &&
              afterFloorOff.eastText === '東牆烘焙：開' &&
              afterFloorOff.report.floorEnabled === false &&
              afterFloorOff.report.northWallEnabled === true &&
              afterFloorOff.report.eastWallEnabled === true &&
              afterAllOff.floorText === '地板烘焙：關' &&
              afterAllOff.northText === '北牆烘焙：關' &&
              afterAllOff.eastText === '東牆烘焙：關' &&
              afterAllOff.report.enabled === false
                ? 'pass'
                : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-ui-toggle', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'ui-toggle-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 full-room diffuse UI toggle test completed');
      console.log(`status: ${report.status}`);
      console.log(`before: ${report.before.floorText} / ${report.before.northText}`);
      console.log(`afterFloorOn: ${report.afterFloorOn.floorText} / ${report.afterFloorOn.northText}`);
      console.log(`afterNorthOn: ${report.afterNorthOn.floorText} / ${report.afterNorthOn.northText}`);
      console.log(`afterEastOn: ${report.afterEastOn.floorText} / ${report.afterEastOn.northText} / ${report.afterEastOn.eastText}`);
      console.log(`afterAllOff: ${report.afterAllOff.floorText} / ${report.afterAllOff.northText}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.r7310RuntimeProbeSampleTest) {
      console.error('[r738-runner] running R7-3.10 runtime probe sample helper');
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const samplePoints = [
            { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.50) },
            { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.64) },
            { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.78) }
          ];
          const cameraCases = [
            {
              name: 'normal_floor_view',
              cameraState: {
                name: 'r7310_runtime_probe_normal_floor',
                position: { x: 0.0, y: 1.45, z: 0.8 },
                yaw: 0.0,
                pitch: -0.18,
                fov: 55
              }
            },
            {
              name: 'inside_floor_level_view',
              cameraState: {
                name: 'r7310_runtime_probe_inside_floor_level',
                position: { x: 0.0, y: -0.08, z: 0.8 },
                yaw: 0.0,
                pitch: 0.0,
                fov: 55
              }
            },
            {
              name: 'inside_floor_up_view',
              cameraState: {
                name: 'r7310_runtime_probe_inside_floor_up',
                position: { x: 0.0, y: -0.08, z: 0.8 },
                yaw: 0.0,
                pitch: -0.70,
                fov: 55
              }
            }
          ];
          const reports = [];
          for (const cameraCase of cameraCases) {
            for (const level of [1, 2, 3, 4, 5, 6]) {
              reports.push({
                cameraCase: cameraCase.name,
                probeLevel: level,
                report: await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
                  timeoutMs: ${args.timeoutMs},
                  cameraState: cameraCase.cameraState,
                  probeLevel: level,
                  samplePoints,
                  samplePointSpace: 'canvasCssPixel'
                })
              });
            }
          }
          const finiteSamples = reports.every((entry) => {
            return entry.report.samplePoints.every((sample) => {
              return Number.isFinite(sample.r) && Number.isFinite(sample.g) && Number.isFinite(sample.b);
            });
          });
          return {
            version: 'r7-3-10-c1-runtime-probe-sample',
            samplePointSpace: 'canvasCssPixel',
            samplePoints,
            reports,
            status: finiteSamples ? 'pass' : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 120000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-probe-sample-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 runtime probe sample test completed');
      console.log(`status: ${report.status}`);
      console.log(`cases: ${report.reports.length}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.r738SproutPasteProbeTest) {
      console.error('[r738-runner] running R7-3.8 sprout-paste readback probe (H7-prime / sprout-paste-inside-guard)');
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const samplePoints = [
            { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.50) },  // center
            { x: Math.floor(window.innerWidth * 0.45), y: Math.floor(window.innerHeight * 0.50) },  // center-left
            { x: Math.floor(window.innerWidth * 0.55), y: Math.floor(window.innerHeight * 0.50) },  // center-right
            { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.55) },  // center-down
            { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.45) },  // center-up
            { x: Math.floor(window.innerWidth * 0.42), y: Math.floor(window.innerHeight * 0.55) },  // bottom-left
            { x: Math.floor(window.innerWidth * 0.58), y: Math.floor(window.innerHeight * 0.55) }   // bottom-right
          ];
          const cameraCases = [
            {
              name: 'normal_floor_view',
              cameraState: {
                name: 'r738_sprout_paste_probe_normal_floor',
                position: { x: 0.0, y: 1.45, z: 0.8 },
                yaw: 0.0,
                pitch: -0.18,
                fov: 55
              }
            },
            {
              name: 'inside_floor_level_view',
              cameraState: {
                name: 'r738_sprout_paste_probe_inside_floor_level',
                position: { x: 0.0, y: -0.08, z: 0.8 },
                yaw: 0.0,
                pitch: 0.0,
                fov: 55
              }
            },
            {
              name: 'inside_floor_up_view',
              cameraState: {
                name: 'r738_sprout_paste_probe_inside_floor_up',
                position: { x: 0.0, y: -0.08, z: 0.8 },
                yaw: 0.0,
                pitch: -0.70,
                fov: 55
              }
            }
          ];
          const reports = [];
          for (const cameraCase of cameraCases) {
            for (const level of [1, 2, 3, 4, 5, 6]) {
              reports.push({
                cameraCase: cameraCase.name,
                probeLevel: level,
                report: await window.reportR738C1SproutPasteRuntimeProbe({
                  timeoutMs: ${args.timeoutMs},
                  cameraState: cameraCase.cameraState,
                  probeLevel: level,
                  samplePoints,
                  samplePointSpace: 'canvasCssPixel'
                })
              });
            }
          }
          const finiteSamples = reports.every((entry) => {
            return entry.report.samplePoints.every((sample) => {
              return Number.isFinite(sample.r) && Number.isFinite(sample.g) && Number.isFinite(sample.b);
            });
          });
          return {
            version: 'r7-3-8-c1-sprout-paste-probe-sample',
            samplePointSpace: 'canvasCssPixel',
            samplePoints,
            reports,
            status: finiteSamples ? 'pass' : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 120000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-8-sprout-paste-probe', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'sprout-paste-probe-sample-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.8 C1 sprout-paste readback probe test completed');
      console.log(`status: ${report.status}`);
      console.log(`cases: ${report.reports.length}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.h5BlackLineProbeTest) {
      console.error('[r738-runner] running R7-3.10 H5 / H3 black-line probe (Part 2 nearest atlas row/col)');
      const report = await evaluate(cdp, `(() => {
        return (async () => {
          const reports = [];
          // floor 黑線：東北衣櫃底部南側 z≈-0.703；相機放衣櫃南側上方俯視該地板邊
          reports.push({
            surface: 'floor',
            report: await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
              timeoutMs: ${args.timeoutMs},
              probeLevel: 7,
              cameraState: {
                name: 'r7310_h5_floor_ne_wardrobe_south',
                position: { x: 1.6, y: 1.4, z: 0.5 },
                yaw: 0.0,
                pitch: -0.86,
                fov: 60
              },
              samplePoints: [
                { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.55) }
              ],
              samplePointSpace: 'canvasCssPixel'
            })
          });
          // north 黑線：東北衣櫃頂部北側 y≈1.955；northWallCamera 固定相機 + level-7 全圖帶統計
          reports.push({
            surface: 'north',
            report: await window.reportR7310C1FullRoomDiffuseRuntimeProbe({
              timeoutMs: ${args.timeoutMs},
              probeLevel: 7,
              northWallCamera: true,
              samplePoints: [
                { x: Math.floor(window.innerWidth * 0.50), y: Math.floor(window.innerHeight * 0.50) }
              ],
              samplePointSpace: 'canvasCssPixel'
            })
          });
          const ok = reports.every((e) => e.report && e.report.h5BlackLineProbe);
          return {
            version: 'r7-3-10-c1-h5-black-line-probe',
            reports,
            status: ok ? 'pass' : 'fail'
          };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 120000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-h5-black-line-probe', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'h5-black-line-probe-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 H5 black-line probe test completed');
      console.log(`status: ${report.status}`);
      for (const e of report.reports) {
        const h = e.report && e.report.h5BlackLineProbe;
        if (h) {
          console.log(`${e.surface}: dominantRow=${h.dominantRow} totalInBand=${h.totalFragmentsInBand} worldRange=${JSON.stringify(h.worldRangeInBand)}`);
        }
      }
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.runtimeShortCircuitTest) {
      console.error('[r738-runner] running R7-3.10 runtime short-circuit helper');
      const report = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({ timeoutMs: ${args.timeoutMs} });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 full-room diffuse runtime short-circuit test completed');
      console.log(`status: ${report.status}`);
      console.log(`bakedSurfaceHitCount: ${report.bakedSurfaceHitCount}`);
      console.log(`bakedSurfaceShortCircuitCount: ${report.bakedSurfaceShortCircuitCount}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.northWallRuntimeTest) {
      console.error('[r738-runner] running R7-3.10 north wall runtime helper');
      const report = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({ timeoutMs: ${args.timeoutMs}, northWallCamera: true });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 north wall diffuse runtime short-circuit test completed');
      console.log(`status: ${report.status}`);
      console.log(`northWallSurfaceHitCount: ${report.northWallSurfaceHitCount}`);
      console.log(`northWallShortCircuitCount: ${report.northWallShortCircuitCount}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.eastWallRuntimeTest) {
      console.error('[r738-runner] running R7-3.10 east wall runtime helper');
      const report = await evaluate(cdp, `(() => {
        return window.reportR7310C1FullRoomDiffuseRuntimeProbe({ timeoutMs: ${args.timeoutMs}, eastWallCamera: true });
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs + 60000
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-10-full-room-diffuse-runtime', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
      console.log('R7-3.10 C1 east wall diffuse runtime short-circuit test completed');
      console.log(`status: ${report.status}`);
      console.log(`eastWallSurfaceHitCount: ${report.eastWallSurfaceHitCount}`);
      console.log(`eastWallShortCircuitCount: ${report.eastWallShortCircuitCount}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (report.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
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
          window.setFloorRoughness(0.65);
          await new Promise((resolve) => setTimeout(resolve, 50));
          const controls = document.getElementById('snapshot-controls');
          const roughnessBox = document.getElementById('floor-roughness-actions');
          const manualButton = document.getElementById('btn-manual-capture');
          const roughRect = roughnessBox ? roughnessBox.getBoundingClientRect() : null;
          const manualRect = manualButton ? manualButton.getBoundingClientRect() : null;
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          const numberStyle = number ? window.getComputedStyle(number) : null;
          if (context && numberStyle) context.font = numberStyle.fontSize + ' ' + numberStyle.fontFamily;
          const numberTextWidth = context && number ? context.measureText(number.value).width : null;
          const layout = {
            rightEdgeDelta: roughRect && manualRect ? Math.abs(roughRect.right - manualRect.right) : null,
            roughnessWidth: roughRect ? roughRect.width : null,
            manualRight: manualRect ? manualRect.right : null,
            roughnessRight: roughRect ? roughRect.right : null,
            rangeClientWidth: range ? range.clientWidth : null,
            numberClientWidth: number ? number.clientWidth : null,
            numberTextWidth,
            numberValue: number ? number.value : null,
            numberFits: number && numberTextWidth !== null ? number.clientWidth >= Math.ceil(numberTextWidth) + 10 : false,
            controlsColumn: controls ? window.getComputedStyle(controls).flexDirection : null
          };
          window.setFloorRoughness(1.0);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            initialReport,
            initialRangeValue,
            initialNumberValue,
            changedReport,
            changedRangeValue,
            changedNumberValue,
            layout,
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
          floorRoughnessReport.layout.rightEdgeDelta <= 2 &&
          floorRoughnessReport.layout.numberFits === true &&
          floorRoughnessReport.layout.rangeClientWidth >= 120 &&
          floorRoughnessReport.layout.controlsColumn === 'column' &&
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
      console.log(`rightEdgeDelta: ${floorRoughnessReport.layout.rightEdgeDelta}`);
      console.log(`numberFits: ${floorRoughnessReport.layout.numberFits}`);
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
          const __sppCap = (typeof window.reportSppCap === 'function') ? window.reportSppCap().cap : 1000;
          sampleCounter = Math.max(0, __sppCap - 1);
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
          const __sppCap = (typeof window.reportSppCap === 'function') ? window.reportSppCap().cap : 1000;
          sampleCounter = Math.max(0, __sppCap - 2);
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
    if (args.accurateReflectionPreviewTest) {
      console.error('[r739-runner] running accurate reflection preview helper');
      const reflectionPreviewReport = await evaluate(cdp, `(() => {
        return (async () => {
          await window.loadR739C1AccurateReflectionPackage();
          await new Promise((resolve) => setTimeout(resolve, 500));
          const initial = window.reportR739C1AccurateReflectionConfig();
          window.setFloorRoughness(0.1);
          const roughnessMatched = window.reportR739C1AccurateReflectionConfig();
          window.setFloorRoughness(0.0);
          const mirrorRoughness = window.reportR739C1AccurateReflectionConfig();
          window.setFloorRoughness(1.0);
          const roughnessOne = window.reportR739C1AccurateReflectionConfig();
          return { initial, roughnessMatched, mirrorRoughness, roughnessOne };
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: Math.min(args.timeoutMs, 60000) + 30000
      });
      const initialReport = reflectionPreviewReport.initial;
      const roughnessMatchedReport = reflectionPreviewReport.roughnessMatched;
      const mirrorRoughnessReport = reflectionPreviewReport.mirrorRoughness;
      const roughnessOneReport = reflectionPreviewReport.roughnessOne;
      const previewDir = path.join(repoRoot, '.omc', 'r7-3-9-c1-accurate-reflection-preview', timestampForPath());
      fs.mkdirSync(previewDir, { recursive: true });
	      const previewValidation = {
	        status: initialReport.ready &&
	          initialReport.applied &&
	          initialReport.currentPanelConfig === 1 &&
	          initialReport.policy === 'accuracy_over_speed' &&
	          initialReport.cubemapRuntimeEnabled === false &&
	          roughnessMatchedReport.sproutReplacementActive === true &&
	          mirrorRoughnessReport.sproutReplacementActive === true &&
	          roughnessOneReport.sproutReplacementActive === true &&
	          roughnessMatchedReport.surroundingLiveFloorReplacementActive === false &&
	          mirrorRoughnessReport.surroundingLiveFloorReplacementActive === false &&
	          roughnessOneReport.surroundingLiveFloorReplacementActive === false
	          ? 'pass'
	          : 'fail',
	        report: reflectionPreviewReport
	      };
      fs.writeFileSync(path.join(previewDir, 'preview-report.json'), `${JSON.stringify(previewValidation, null, 2)}\n`);
      console.log('R7-3.9 C1 accurate reflection preview completed');
	      console.log(`ready: ${initialReport.ready}`);
	      console.log(`applied: ${initialReport.applied}`);
	      console.log(`package: ${initialReport.packageDir}`);
	      console.log(`roughnessMatchedSproutReplacement: ${roughnessMatchedReport.sproutReplacementActive}`);
	      console.log(`mirrorRoughnessSproutReplacement: ${mirrorRoughnessReport.sproutReplacementActive}`);
	      console.log(`roughnessOneSproutReplacement: ${roughnessOneReport.sproutReplacementActive}`);
	      console.log(`roughnessMatchedSurroundingLiveFloorReplacement: ${roughnessMatchedReport.surroundingLiveFloorReplacementActive}`);
	      console.log(`mirrorRoughnessSurroundingLiveFloorReplacement: ${mirrorRoughnessReport.surroundingLiveFloorReplacementActive}`);
	      console.log(`roughnessOneSurroundingLiveFloorReplacement: ${roughnessOneReport.surroundingLiveFloorReplacementActive}`);
	      console.log(`status: ${previewValidation.status}`);
      console.log(`report: ${path.relative(repoRoot, previewDir)}`);
      if (previewValidation.status !== 'pass') process.exitCode = 1;
      completed = true;
      return;
    }
    if (args.currentViewValidation) {
      if (args.samples !== 1000) throw new Error('--r739-current-view-validation requires --samples=1000');
      console.error('[r739-runner] running Config 1 current-view reflection validation helper');
      const validationReport = await evaluate(cdp, `(() => {
        return (async () => {
          return await window.runR739C1CurrentViewReflectionValidation({
            samples: 1000,
            timeoutMs: ${args.timeoutMs},
            sweep: true
          });
        })();
      })()`, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs * 24 + 180000
      });
      if (validationReport.actualSamples !== 1000) {
        throw new Error('R7-3.9 Config 1 current-view validation must end at exactly 1000 spp');
      }
      const currentViewDir = path.join(repoRoot, '.omc', 'r7-3-9-config1-current-view-reflection', timestampForPath());
      fs.mkdirSync(currentViewDir, { recursive: true });
      const validation = {
        status: validationReport.status,
        report: validationReport,
        checks: validationReport.checks,
        cameraStateVariation: validationReport.cameraStateVariation,
        sproutVisiblePixels: validationReport.results.map((result) => result.summary.sproutVisiblePixels),
        sproutDeltaMeanLuma: validationReport.results.map((result) => result.summary.sproutDeltaMeanLuma)
      };
      fs.writeFileSync(path.join(currentViewDir, 'validation-report.json'), `${JSON.stringify(validation, null, 2)}\n`);
      console.log('R7-3.9 Config 1 current-view reflection validation completed');
      console.log(`samples: ${validationReport.actualSamples}`);
      console.log(`states: ${validationReport.results.length}`);
      console.log(`sproutVisiblePixels: ${validation.sproutVisiblePixels.join(',')}`);
      console.log(`sproutDeltaMeanLuma: ${validation.sproutDeltaMeanLuma.map((value) => value.toFixed(8)).join(',')}`);
      console.log(`cameraStateVariation: ${validationReport.cameraStateVariation.changedAcrossCameraStates}`);
      console.log(`status: ${validation.status}`);
      console.log(`report: ${path.relative(repoRoot, currentViewDir)}`);
      if (validation.status !== 'pass') process.exitCode = 1;
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
    if (args.accurateReflectionCapture) {
      console.error('[r739-runner] running accurate reflection capture helper');
      const expression = `(() => {
        function typedToBase64(value) {
          if (!value) return null;
          const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
          }
          return btoa(binary);
        }
        return (async () => {
          const report = await window.reportR739C1AccurateReflectionAfterSamples(${args.samples}, ${args.timeoutMs}, {
            floorRoughness: 0.1,
            referenceOnly: ${args.referenceOnly ? 'true' : 'false'},
            surfaceCache: ${args.surfaceCache ? 'true' : 'false'}
          });
          const artifacts = window.getR739C1AccurateReflectionArtifacts();
          return {
            report,
            validationReport: artifacts.validationReport,
            targetSummary: artifacts.targetSummary,
            referenceBase64: typedToBase64(artifacts.referencePixels),
            maskBase64: typedToBase64(artifacts.targetMask),
            objectIdsBase64: typedToBase64(artifacts.objectIds),
            surfaceCacheBase64: typedToBase64(artifacts.surfaceCachePixels),
            directionMetadataBase64: typedToBase64(artifacts.directionMetadata),
            texelMetadataBase64: typedToBase64(artifacts.texelMetadata)
          };
        })();
      })()`;
      const payload = await evaluate(cdp, expression, {
        awaitPromise: true,
        timeoutMs: args.timeoutMs * 3 + 180000
      });
      console.error('[r739-runner] accurate reflection helper returned');
      if (payload.report.actualSamples !== 1000 || payload.report.requestedSamples !== 1000) {
        throw new Error('R7-3.9 Config 1 reference-only package must be exactly 1000 spp');
      }
      const referenceBuffer = base64ToBuffer(payload.referenceBase64);
      const maskBuffer = base64ToBuffer(payload.maskBase64);
      const objectIdBuffer = base64ToBuffer(payload.objectIdsBase64);
      const surfaceCacheBuffer = base64ToBuffer(payload.surfaceCacheBase64);
      const directionBuffer = base64ToBuffer(payload.directionMetadataBase64);
      const texelBuffer = base64ToBuffer(payload.texelMetadataBase64);
      const validation = validateR739Payload({
        report: payload.report,
        validationReport: payload.validationReport,
        referenceBuffer,
        maskBuffer,
        objectIdBuffer,
        surfaceCacheBuffer,
        directionBuffer,
        texelBuffer
      });
      const packageDir = path.join(repoRoot, '.omc', 'r7-3-9-c1-accurate-reflection-bake', timestampForPath());
      fs.mkdirSync(packageDir, { recursive: true });
      const manifest = buildR739Manifest({ report: payload.report, packageDir });
      const validationReport = {
        ...payload.validationReport,
        runnerStatus: validation.status,
        runnerChecks: validation.checks,
        runnerFailedChecks: validation.failed,
        status: validation.status
      };
      const artifactHashes = {
        referenceSha256: sha256(referenceBuffer),
        maskSha256: sha256(maskBuffer),
        objectIdsSha256: sha256(objectIdBuffer),
        surfaceCacheSha256: sha256(surfaceCacheBuffer),
        directionMetadataSha256: sha256(directionBuffer),
        texelMetadataSha256: sha256(texelBuffer)
      };
      const acceptedPointer = {
        version: manifest.version,
        packageStatus: validation.status === 'pass' ? 'reference_only' : 'rejected',
        packageDir: manifest.packageDir,
        diffuseCheckpointTag: manifest.diffuseCheckpointTag,
        policy: manifest.policy,
        config: manifest.config,
        cameraReferenceSamples: manifest.cameraReferenceSamples,
        floorRoughnessForReflection: manifest.floorRoughnessForReflection,
        referenceWidth: manifest.referenceWidth,
        referenceHeight: manifest.referenceHeight,
        cubemapRuntimeEnabled: manifest.cubemapRuntimeEnabled,
        surfaceTargets: manifest.surfaceTargets,
        deferredSurfaceTargets: manifest.deferredSurfaceTargets,
        sproutBounds: manifest.sproutBounds,
        artifacts: manifest.artifacts,
        artifactHashes,
        validation: {
          status: validationReport.status,
          actualSamples: validationReport.actualSamples,
          nonFiniteReflectionSamples: validationReport.nonFiniteReflectionSamples,
          insideSproutPixels: validationReport.insideSproutPixels,
          outsideSproutPixels: validationReport.outsideSproutPixels,
          reflectionMaxLuma: validationReport.reflectionMaxLuma,
          reflectionMeanLuma: validationReport.reflectionMeanLuma,
          targetCounts: validationReport.targetCounts
        },
        runtimeEnabled: false,
        runtimeBlockReason: 'R7-3.9 reflection capture currently stores a camera-reference layer only. Do not promote it to runtime until the SOP-approved reflection format exists.'
      };
      fs.writeFileSync(path.join(packageDir, 'manifest.json'), `${JSON.stringify({ ...manifest, artifactHashes }, null, 2)}\n`);
      fs.writeFileSync(path.join(packageDir, 'c1-camera-reflection-reference-rgba-f32.bin'), referenceBuffer);
      fs.writeFileSync(path.join(packageDir, 'c1-camera-reflection-mask-u8.bin'), maskBuffer);
      fs.writeFileSync(path.join(packageDir, 'c1-camera-reflection-object-id-u16.bin'), objectIdBuffer);
      fs.writeFileSync(path.join(packageDir, 'surface-reflection-cache-rgba-f32.bin'), surfaceCacheBuffer);
      fs.writeFileSync(path.join(packageDir, 'surface-reflection-direction-metadata-f32.bin'), directionBuffer);
      fs.writeFileSync(path.join(packageDir, 'surface-reflection-texel-metadata-f32.bin'), texelBuffer);
      fs.writeFileSync(path.join(packageDir, 'reflection-target-summary.json'), `${JSON.stringify(payload.targetSummary, null, 2)}\n`);
      fs.writeFileSync(path.join(packageDir, 'validation-report.json'), `${JSON.stringify(validationReport, null, 2)}\n`);
      fs.writeFileSync(path.join(packageDir, 'reference-pointer.json'), `${JSON.stringify(acceptedPointer, null, 2)}\n`);
      console.log('R7-3.9 C1 accurate reflection capture completed');
      console.log(`samples: ${payload.report.actualSamples}`);
      console.log(`buffer: ${payload.report.buffer.width}x${payload.report.buffer.height}`);
      console.log(`status: ${validationReport.status}`);
      console.log(`package: ${path.relative(repoRoot, packageDir)}`);
      if (validationReport.status !== 'pass') {
        console.error(`failedChecks: ${validation.failed.join(', ')}`);
        process.exitCode = 1;
      }
      completed = true;
      return;
    }
    console.error('[r738-runner] running capture helper');
    const r7310CaptureHelper = args.r7310Surface === 'north-wall'
      ? 'reportR7310C1NorthWallDiffuseBakeAfterSamples'
      : (args.r7310Surface === 'east-wall'
        ? 'reportR7310C1EastWallDiffuseBakeAfterSamples'
        : 'reportR7310C1FloorDiffuseBakeAfterSamples');
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
	        const report = await window.${args.fullRoomDiffuseBake ? r7310CaptureHelper : 'reportR738C1BakeCaptureAfterSamples'}(${args.targetSamples || args.samples}, ${args.timeoutMs}, {
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
	    const packageRoot = args.fullRoomDiffuseBake ? 'r7-3-10-full-room-diffuse-bake' : 'r7-3-8-c1-1000spp-bake-capture';
	    const packageDir = path.join(repoRoot, '.omc', packageRoot, timestampForPath());
    fs.mkdirSync(packageDir, { recursive: true });
    const manifest = buildManifest({ report: payload.report, packageDir, smokeTest: args.smokeTest });
    const validationReport = {
      ...payload.validationReport,
      browserValidationStatus: payload.validationReport.status,
      runnerStatus: validation.status,
      runnerChecks: validation.checks,
      runnerFailedChecks: validation.failed,
      bakeContaminationGuardSnapshot: (payload.report && payload.report.atlasSummary && payload.report.atlasSummary.bakeContaminationGuardSnapshot) || null
    };
    if (args.smokeTest && validation.status === 'pass') validationReport.status = 'pass';
    if (validation.status !== 'pass') validationReport.status = 'fail';
    fs.writeFileSync(path.join(packageDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
	    fs.writeFileSync(path.join(packageDir, 'raw-hdr-summary.json'), `${JSON.stringify(payload.rawHdrSummary, null, 2)}\n`);
	    fs.writeFileSync(path.join(packageDir, 'surface-class-summary.json'), `${JSON.stringify(payload.surfaceClassSummary, null, 2)}\n`);
	    if (payload.report.coverageReport) fs.writeFileSync(path.join(packageDir, 'coverage-report.json'), `${JSON.stringify(payload.report.coverageReport, null, 2)}\n`);
    fs.writeFileSync(path.join(packageDir, 'atlas-patch-000-rgba-f32.bin'), atlasBuffer);
    fs.writeFileSync(path.join(packageDir, 'texel-metadata-patch-000-f32.bin'), metadataBuffer);
    fs.writeFileSync(path.join(packageDir, 'validation-report.json'), `${JSON.stringify(validationReport, null, 2)}\n`);
    console.log('R7-3.8 C1 bake capture completed');
    console.log(`samples: ${payload.report.atlasSummary.actualSamples}`);
    console.log(`bakeContaminationGuardSnapshot: ${JSON.stringify((payload.report && payload.report.atlasSummary && payload.report.atlasSummary.bakeContaminationGuardSnapshot) || null)}`);
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
