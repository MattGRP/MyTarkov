export const DOCK_SHELL_VISUAL_HEIGHT = 8 + 44 + 8;

export function getDockBottomOffset(bottomInset: number): number {
  return Math.max(8, Math.round(bottomInset * 0.42));
}

export function getDockReservedInset(bottomInset: number): number {
  return getDockBottomOffset(bottomInset) + DOCK_SHELL_VISUAL_HEIGHT + 10;
}
