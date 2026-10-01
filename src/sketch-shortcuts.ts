import type { SketchPoint, SketchStroke, SketchDocument, SketchTransform, SketchGesture, SketchCommand } from './sketch-types.js';
export function sketchShortcutAction(keys: Readonly<Record<string, string>>, key: string) {
  key = key.toLowerCase()
  // Explicit user bindings take priority over convenience aliases.
  const configured = Object.entries(keys).find(([, value]) => value === key)
  return configured?.[0] ?? ({v:'select', t:'text', '+':'zoomIn'} as Readonly<Record<string, string>>)[key]
}
