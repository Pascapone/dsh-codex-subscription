import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const root = mkdtempSync(resolve('.artifacts/package-smoke-'));
try {
  const {name, version}: {name: unknown; version: unknown} = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(typeof name === 'string');
  assert.equal(typeof version, 'string');
  const archive = `${name.replace(/^@/, '').replaceAll('/', '-')}-${version}.tgz`;
  const unpack = spawnSync('tar', ['-xzf', resolve(process.argv[2] ?? `.artifacts/${archive}`), '-C', root], { stdio: 'inherit' });
  if (unpack.error) throw unpack.error;
  assert.equal(unpack.status, 0);
  const pkg = join(root, 'package');
  const consumer = join(root, 'node_modules', name);
  mkdirSync(dirname(consumer), {recursive: true});
  symlinkSync(pkg, consumer, process.platform === 'win32' ? 'junction' : 'dir');
  const host = await import(pathToFileURL(join(pkg, 'lib/index.js')).href) as typeof import('../src/index.js');
  assert.equal(host.name, 'codex-subscription');
  assert.equal(host.CODEX_IMAGE_TOOL_NAME, 'codex_image_generate');
  assert.equal(typeof host.apply, 'function');
  const client: {id?: string; factory?: unknown} = {};
  runInNewContext(readFileSync(join(pkg, 'lib/client.js'), 'utf8'), {
    window: { __ModuleLoader__: { load(value: typeof client) { Object.assign(client, value); } } },
  });
  assert.equal(client.id, name);
  assert.equal(typeof client.factory, 'function');
  class CodecImageData {
    data: Uint8ClampedArray; width: number; height: number;
    constructor(width: number, height: number) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); }
  }
  let reply: {ok?: boolean; value?: unknown; error?: string} = {};
  const worker: {onmessage?: (event: {data: {action: string; payload: unknown}}) => void; postMessage(value: typeof reply): void} = {
    postMessage(value) { reply = value; },
  };
  runInNewContext(readFileSync(join(pkg, 'lib/sketch-psd-worker.js'), 'utf8'), { self: worker, ImageData: CodecImageData,
    OffscreenCanvas: class { getContext() { return {createImageData: (width: number, height: number) => new CodecImageData(width, height)}; } },
  });
  assert.equal(typeof worker.onmessage, 'function');
  const sample = Buffer.alloc(43);
  sample.write('8BPS'); sample.writeUInt16BE(1, 4); sample.writeUInt16BE(3, 12);
  sample.writeUInt32BE(1, 14); sample.writeUInt32BE(1, 18); sample.writeUInt16BE(8, 22); sample.writeUInt16BE(3, 24); sample[40] = 255;
  worker.onmessage!({data: {action: 'read', payload: sample.buffer.slice(sample.byteOffset, sample.byteOffset + sample.byteLength)}});
  assert.equal(reply.ok, true, reply.error);
  const raster = reply.value as {width: number; height: number; layers: {name: string; imageData: CodecImageData}[]};
  assert.equal(raster.width, 1);
  assert.deepEqual(Array.from(raster.layers[0].imageData.data), [255, 0, 0, 255]);
  worker.onmessage!({data: {action: 'write', payload: {width: 1, height: 1, imageData: raster.layers[0].imageData,
    children: raster.layers.map(layer => ({name: layer.name, imageData: layer.imageData}))}}});
  assert.equal(reply.ok, true, reply.error);
  const encoded = reply.value;
  worker.onmessage!({data: {action: 'read', payload: encoded}});
  assert.equal(reply.ok, true, reply.error);
  assert.deepEqual(Array.from((reply.value as typeof raster).layers[0].imageData.data), [255, 0, 0, 255]);
  assert.ok(readFileSync(join(pkg, 'icon-subscription.webp')).length > 0);
  for (const [graph, entry] of [['host', name], ['client', `${name}/client`]] as const) {
    const source = join(root, `${graph}.mts`);
    writeFileSync(source, `import {apply, inject} from '${entry}';\ndeclare const ctx: Parameters<typeof apply>[0];\napply(ctx);\nconst services: string[] = inject;\n`);
    const program = ts.createProgram([source], { strict: true, verbatimModuleSyntax: true, noEmit: true,
      skipLibCheck: true, target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n',
    }));
  }
  const hostTests = spawnSync(process.execPath, ['--test', '.test-build/tests/plugin-integration.test.mjs'], {
    stdio: 'inherit', env: {...process.env, CODEX_PACKAGE_ENTRY: join(pkg, 'lib/index.js')},
  });
  if (hostTests.error) throw hostTests.error;
  assert.equal(hostTests.status, 0, 'Packed Host apply/RPC/disposal integration failed');
  console.log('Packed Host apply/RPC/disposal, classic Client registration, PSD read/write roundtrip, icon and strict declaration consumers passed (dependency declarations skipped).');
} finally {
  rmSync(root, { recursive: true, force: true });
}
