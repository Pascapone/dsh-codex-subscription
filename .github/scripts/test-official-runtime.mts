import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { testFiles } from '../../scripts/test-groups.mts'

const source = fileURLToPath(new URL('../../', import.meta.url))
const authored = fileURLToPath(new URL('../../../', import.meta.url))
if (!existsSync(join(source, 'src', 'index.js'))) throw new Error('Stage compiled fixtures with node --experimental-strip-types build.ts --test before official acceptance')
const runner = resolve(process.argv[2]!)
const dependencies = join(runner, 'node_modules', '.pnpm', 'node_modules')
if (!existsSync(dependencies)) throw new Error('Official pnpm runtime dependencies are missing')
// Keep resolution beside pnpm's real hoisted directory. Aliasing that directory
// through a junction can break its relative package links on Windows runners.
const probe = mkdtempSync(join(runner, 'node_modules', '.pnpm', 'subscription-tests-'))
try {
  for (const name of ['src', 'tests', 'scripts', 'package.json', 'cordis.patch.yml']) {
    cpSync(join(source, name), join(probe, name), { recursive: true })
  }
  // Supply test-owned IndexedDB and source-inspection parsing only. DSH packages
  // resolve from the official runner, never the source checkout's versions.
  const emulator = existsSync(join(runner, 'node_modules', 'fake-indexeddb')) ? runner : authored
  cpSync(realpathSync(join(emulator, 'node_modules', 'fake-indexeddb')), join(probe, 'node_modules', 'fake-indexeddb'), { recursive: true })
  cpSync(realpathSync(join(authored, 'node_modules', 'typescript')), join(probe, 'node_modules', 'typescript'), { recursive: true })
  const result = spawnSync(process.execPath, ['--test', ...testFiles('behavior')], {
    cwd: probe, stdio: 'inherit', env: { ...process.env, DSH_CODEX_TEST_SOURCE_ROOT: authored },
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  rmSync(probe, { recursive: true, force: true })
}
