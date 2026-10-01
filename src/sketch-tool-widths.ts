const defaults: Readonly<Record<string, number>> = {pen:12, pencil:6, marker:28, eraser:24, text:32, line:12, arrow:12, rectangle:12, circle:12}
const keyFor = ({tool, brush}: { tool: string; brush?: string }) => tool === 'pen' ? brush : tool

// Selection edits belong to the object, never to a drawing tool's settings.
export function switchSketchToolWidth(memory: Record<string, number | undefined>, current: { tool: string; brush?: string; width: number }, next: { tool: string; brush?: string }) {
  if (current.tool !== 'select') memory[keyFor(current) as string] = current.width
  if (next.tool === 'select') return current.width
  const key = keyFor(next)
  return memory[key as string] ?? defaults[key as string] ?? 12
}

export function stepSketchWidth(width: number, direction: number) {
  return Math.max(1, Math.min(256, width + direction * 2))
}
