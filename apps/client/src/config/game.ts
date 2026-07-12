export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export function isSupportedViewport(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width >= 320 && height >= 320;
}
