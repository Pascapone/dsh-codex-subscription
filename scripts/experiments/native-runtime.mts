export type NativeModules = {
  '@deepseek-ai/cordis': typeof import('@deepseek-ai/cordis');
  '@deepseek-ai/dsh-session': typeof import('@deepseek-ai/dsh-session');
  '@deepseek-ai/dsh-session-persistence-jsonl': typeof import('@deepseek-ai/dsh-session-persistence-jsonl');
  '@deepseek-ai/dsh-llm': typeof import('@deepseek-ai/dsh-llm');
  '@deepseek-ai/dsh-llm-pi-ai': typeof import('@deepseek-ai/dsh-llm-pi-ai');
  '@deepseek-ai/dsh-compaction-image-offload': typeof import('@deepseek-ai/dsh-compaction-image-offload');
};
// Explicit installed runtime; never installs packages or changes a user profile.
import fs from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
const argument = process.env.DSH_TEST_RUNTIME
if (!argument) throw Error('Set DSH_TEST_RUNTIME to the installed DSH node_modules/.pnpm directory')
const runtime = path.resolve(argument), cache = new Map<string, string>()
export async function packagePath(name: string): Promise<string> {
  if (cache.has(name)) return cache.get(name)!
  for (const entry of await fs.readdir(runtime)) {
    const root = path.join(runtime,entry,'node_modules',name)
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')) as { name?: string; main?: string } as { name?: string; main?: string }
      if (pkg.name === name) { cache.set(name,root); return root }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  throw Error('Missing installed runtime package: '+name)
}
export async function load<const Name extends keyof NativeModules>(name: Name): Promise<NativeModules[Name]> {
  const root = await packagePath(name), pkg = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'))
  return import(pathToFileURL(path.join(root,pkg.main??'lib/index.js')).href) as Promise<NativeModules[Name]>
}
