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
  const worker: {onmessage?: unknown; postMessage(): void} = { postMessage() {} };
  runInNewContext(readFileSync(join(pkg, 'lib/sketch-psd-worker.js'), 'utf8'), { self: worker });
  assert.equal(typeof worker.onmessage, 'function');
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
  console.log('Packed Host import, classic Client registration, PSD Worker, icon and separate strict declaration consumers passed.');
} finally {
  rmSync(root, { recursive: true, force: true });
}
