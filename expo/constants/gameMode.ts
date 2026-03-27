export type GameMode = 'regular' | 'pve';

export const SUPPORTED_GAME_MODES: GameMode[] = ['regular', 'pve'];
export const DEFAULT_GAME_MODE: GameMode = 'regular';

export function normalizeGameMode(value: unknown): GameMode {
  return String(value || '').trim().toLowerCase() === 'pve' ? 'pve' : 'regular';
}
