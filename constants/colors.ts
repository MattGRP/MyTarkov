import { GameMode } from '@/constants/gameMode';

export interface AppColors {
  background: string;
  surface: string;
  surfaceLight: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  gold: string;
  goldDim: string;
  bearRed: string;
  usecBlue: string;
  statRed: string;
  statGreen: string;
  statOrange: string;
  statBlue: string;
  statCyan: string;
  statPurple: string;
  statPink: string;
}

export const tarkovGold = '#D9BF73';
export const tarkovGoldDim = 'rgba(217, 191, 115, 0.6)';
export const pveBlue = '#4B9DFF';
export const pveBlueDim = 'rgba(75, 157, 255, 0.62)';
export const unheardBlue = '#4AA3FF';
export const eodCrownLight = '#FFE48A';
export const eodCrownDark = '#D8A43D';
export const eodCrownBase = '#C8942E';
export const white = '#FFFFFF';
export const black = '#000000';

export function withAlpha(color: string, alpha: number): string {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(alpha, 1)) : 1;
  const normalized = String(color || '').trim();
  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;

  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${safeAlpha})`;
  }

  return normalized;
}

export function alphaWhite(alpha: number): string {
  return withAlpha(white, alpha);
}

export function alphaBlack(alpha: number): string {
  return withAlpha(black, alpha);
}

export type ModeAccentTheme = {
  accent: string;
  accentDim: string;
  accentSoft12: string;
  accentSoft15: string;
  accentSoft16: string;
  accentSoft18: string;
  accentBorder45: string;
  accentTextStrong: string;
  accentTextOnSolid: string;
};

export function getModeAccentTheme(mode: GameMode): ModeAccentTheme {
  const accent = mode === 'pve' ? pveBlue : tarkovGold;
  return {
    accent,
    accentDim: withAlpha(accent, 0.62),
    accentSoft12: withAlpha(accent, 0.12),
    accentSoft15: withAlpha(accent, 0.15),
    accentSoft16: withAlpha(accent, 0.16),
    accentSoft18: withAlpha(accent, 0.18),
    accentBorder45: withAlpha(accent, 0.45),
    accentTextStrong: mode === 'pve' ? '#73B5FF' : accent,
    accentTextOnSolid: mode === 'pve' ? '#09172C' : '#1A1A14',
  };
}

const regularPalette: AppColors = {
  background: '#0F0F0D',
  surface: '#1A1A16',
  surfaceLight: '#242420',
  card: alphaWhite(0.06),
  border: alphaWhite(0.08),
  text: white,
  textSecondary: alphaWhite(0.5),
  textTertiary: alphaWhite(0.3),
  gold: tarkovGold,
  goldDim: tarkovGoldDim,
  bearRed: '#8C2620',
  usecBlue: '#1F3366',
  statRed: '#E85450',
  statGreen: '#4CAF50',
  statOrange: '#FF9800',
  statBlue: '#42A5F5',
  statCyan: '#26C6DA',
  statPurple: '#AB47BC',
  statPink: '#EC407A',
};

const pvePalette: AppColors = {
  ...regularPalette,
  background: '#0E1218',
  surface: '#161C25',
  surfaceLight: '#202835',
  border: alphaWhite(0.09),
  textSecondary: alphaWhite(0.54),
  textTertiary: alphaWhite(0.34),
  gold: pveBlue,
  goldDim: pveBlueDim,
};

function getPalette(mode: GameMode): AppColors {
  return mode === 'pve' ? pvePalette : regularPalette;
}

const Colors: AppColors = { ...regularPalette };

export function applyGameModePalette(mode: GameMode): AppColors {
  const palette = getPalette(mode);
  Object.assign(Colors, palette);
  return Colors;
}

export default Colors;
