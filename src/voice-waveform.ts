export const WAVE_FRAME_MS = 50
export const WAVE_POINTS = 3000 / WAVE_FRAME_MS

export function appendWave(history: readonly number[], amplitude: number) {
  return [...history.slice(1), Math.max(0, Math.min(1, amplitude))]
}
