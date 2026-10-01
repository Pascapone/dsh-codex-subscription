import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { eraseSourceTypes } from './source-contract.js';

test('source contracts retain JSX, original spacing, data literals and emitted module paths', () => {
  const source = `import type { Foo } from './foo.js';\ntype Point = { x: number };\nconst load = (context.get('input') as Foo)?.load;\nconst image = <img onLoad={() => { measure() }} style={{ '--ratio': 1 } as Style} />;\nconst listeners = new Set<() => void>();\nexport const value: number = input!;\nconst text = 'as Foo: number';`;
  const stripped = eraseSourceTypes(source, true);
  assert.match(stripped, /context\.get\('input'\)\?\.load/);
  assert.match(stripped, /onLoad=\{\(\) => \{ measure\(\) \}\}/);
  assert.match(stripped, /const value = input;/);
  assert.match(stripped, /'as Foo: number'/);
  const emit = (text: string) => ts.transpileModule(text, { fileName: 'check.tsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText.replaceAll('(context.get', 'context.get').replaceAll("('input'))", "('input')");
  assert.equal(emit(stripped), emit(source));
  assert.equal(eraseSourceTypes("const entries = ['src/index.ts', 'src/client.tsx', './scripts/prepare.mts'];"),
    "const entries = ['src/index.js', 'src/client.jsx', './scripts/prepare.mjs'];");
});
