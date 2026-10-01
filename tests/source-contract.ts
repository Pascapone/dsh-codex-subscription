import { readFile as readRaw } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const authoredRoot = process.env.DSH_CODEX_TEST_SOURCE_ROOT
  ? pathToFileURL(join(process.env.DSH_CODEX_TEST_SOURCE_ROOT, '/')) : new URL('../../', import.meta.url);
import ts from 'typescript';

/** Erase types without reformatting the source inspected by the original contracts. */
export function eraseSourceTypes(source: string, jsx = false): string {
  const tree = ts.createSourceFile(jsx ? 'source.tsx' : 'source.ts', source, ts.ScriptTarget.Latest, true, jsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const spans: [number, number][] = [];
  const drop = (start: number, end: number) => { spans.push([start, end]); };
  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
      || (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword))
      || (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly)) {
      drop(node.getStart(tree), node.end);
      return;
    }
    if (ts.isParenthesizedExpression(node) && ts.isAsExpression(node.expression)) {
      const value = node.expression.expression;
      if (ts.isIdentifier(value) || ts.isCallExpression(value) || ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
        drop(node.getStart(tree), value.getStart(tree));
        drop(value.end, node.end);
        visit(value);
        return;
      }
    }
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) drop(node.expression.end, node.end);
    if (ts.isNonNullExpression(node)) drop(node.expression.end, node.end);
    const declaration = node as ts.Node & { type?: ts.TypeNode; typeParameters?: ts.NodeArray<ts.TypeParameterDeclaration>; typeArguments?: ts.NodeArray<ts.TypeNode>; questionToken?: ts.QuestionToken };
    if (declaration.type && !ts.isTypeNode(node) && !ts.isAsExpression(node) && !ts.isSatisfiesExpression(node) && !ts.isTypeAssertionExpression(node)) {
      drop(source.lastIndexOf(':', declaration.type.pos), declaration.type.end);
    }
    for (const parameters of [declaration.typeParameters, declaration.typeArguments]) {
      if (parameters?.length) drop(parameters.pos - 1, parameters.end + 1);
    }
    if (declaration.questionToken && (ts.isParameter(node) || ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node))) drop(declaration.questionToken.pos, declaration.questionToken.end);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  spans.sort((left, right) => left[0] - right[0] || right[1] - left[1]);
  let result = '', end = 0;
  for (const [start, stop] of spans) {
    if (start < end) continue;
    result += source.slice(end, start);
    end = stop;
  }
  return (result + source.slice(end)).replace(/(["'])([^"'\r\n]*\/[^"'\r\n]*)\.(tsx|ts|mts)\1/g,
    (_match, quote: string, path: string, extension: string) => `${quote}${path}.${extension === 'tsx' ? 'jsx' : extension === 'mts' ? 'mjs' : 'js'}${quote}`);
}

/** Existing JS/JSX source contracts now inspect the corresponding authored TS/TSX. */
function authoredSource(path: URL | string): { authored: URL; jsx: boolean } | undefined {
  const value = path instanceof URL ? fileURLToPath(path) : path;
  const match = /[\\/]src[\\/](.+\.(?:js|jsx|ts|tsx))$/.exec(value);
  if (!match) {
    if (/[\\/]tsdown\.config\.mjs$/.test(value)) return { authored: new URL('tsdown.config.ts', authoredRoot), jsx: false };
    const helper = /[\\/](scripts|tests)[\\/](.+)\.mjs$/.exec(value);
    return helper ? { authored: new URL(`${helper[1]}/${helper[2]!.replaceAll('\\', '/')}.mts`, authoredRoot), jsx: false } : undefined;
  }
  let relative = match[1]!.replace(/\.jsx$/, '.tsx').replace(/\.js$/, '.ts');
  if (relative === 'subscription-image-viewer.tsx') relative = 'subscription-image-viewer-overlay.tsx';
  const authored = new URL(`src/${relative.replaceAll('\\', '/')}`, authoredRoot);
  return { authored, jsx: relative.endsWith('.tsx') };
}

export async function readSource(path: URL | string, encoding: 'utf8' = 'utf8'): Promise<string> {
  const source = authoredSource(path);
  return source ? eraseSourceTypes(await readRaw(source.authored, encoding), source.jsx) : (await readRaw(path, encoding)).replace(/\.mts\b/g, '.mjs');
}

export function readSourceSync(path: URL | string, encoding: 'utf8' = 'utf8'): string {
  const source = authoredSource(path);
  return source ? eraseSourceTypes(readFileSync(source.authored, encoding), source.jsx) : readFileSync(path, encoding).replace(/\.mts\b/g, '.mjs');
}
