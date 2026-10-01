import { spawnSync } from 'node:child_process';
import { cpSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
function run(module: string, args: string[]): void {
  const result = spawnSync(process.execPath, [require.resolve(module), ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${module} failed (${result.status})`);
}
run('typescript/bin/tsc', ['-p', 'tsconfig.build.json']);
if (process.argv.includes('--test')) {
  rmSync('.test-build', { recursive: true, force: true });
  const directories = new Set(['tests', 'scripts', '.github', 'lib', 'docs']);
  for (const entry of readdirSync('.', { withFileTypes: true })) {
    if (entry.isFile() || directories.has(entry.name)) cpSync(entry.name, '.test-build/' + entry.name, {
      recursive: true,
      filter: path => entry.name === 'lib' || !/\.(?:js|jsx|mjs|ts|tsx|mts)$/.test(path),
    });
  }
  run('typescript/bin/tsc', ['-p', 'tsconfig.shared.json']);
  run('typescript/bin/tsc', ['-p', 'tsconfig.host.json']);
  run('typescript/bin/tsc', ['-p', 'tsconfig.client.json']);
  run('typescript/bin/tsc', ['-p', 'tsconfig.worker.json']);
  run('typescript/bin/tsc', ['-p', 'tsconfig.tests.json']);
  run('typescript/bin/tsc', ['-p', 'tsconfig.tests.client.json']);
} else {
  run('typescript/bin/tsc', ['-p', 'tsconfig.shared.json', '--noEmit']);
  run('typescript/bin/tsc', ['-p', 'tsconfig.host.json', '--noEmit']);
  run('typescript/bin/tsc', ['-p', 'tsconfig.client.json', '--noEmit']);
  run('typescript/bin/tsc', ['-p', 'tsconfig.worker.json', '--noEmit']);
  run('tsdown/run', ['--config', 'tsdown.config.ts']);
  for (const graph of ['shared', 'host', 'client', 'worker']) {
    run('typescript/bin/tsc', ['-p', `tsconfig.${graph}.json`, '--emitDeclarationOnly', '--outDir', 'lib', '--rootDir', 'src']);
  }
}
