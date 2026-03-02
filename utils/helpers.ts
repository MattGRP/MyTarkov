export function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  } else if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return `${n}`;
}

export function formatPrice(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  const rounded = Math.round(value);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatCountdownToTimestamp(
  value: string | number | Date | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (value === null || value === undefined) return '-';
  const targetMs = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(targetMs)) return '-';
  const diffMs = Math.max(0, Math.floor(targetMs - nowMs));
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatSkillName(id: string): string {
  let result = '';
  for (const char of id) {
    if (char >= 'A' && char <= 'Z' && result.length > 0) {
      result += ' ';
    }
    result += char;
  }
  return result;
}

export function getSkillColor(id: string): string {
  switch (id) {
    case 'Endurance':
    case 'Strength':
    case 'CovertMovement':
      return '#42A5F5';
    case 'Vitality':
    case 'Health':
    case 'Immunity':
    case 'Surgery':
      return '#E85450';
    case 'StressResistance':
      return '#AB47BC';
    case 'Metabolism':
      return '#4CAF50';
    case 'Perception':
    case 'Attention':
    case 'Search':
      return '#26C6DA';
    case 'Charisma':
      return '#EC407A';
    case 'AimDrills':
    case 'TroubleShooting':
      return '#FF9800';
    default:
      return '#D9BF73';
  }
}

export type PlayerNameValidationError = 'chars' | 'length' | null;

export function getPlayerNameValidationError(name: string): PlayerNameValidationError {
  const charactersValid = /^[a-zA-Z0-9-_]*$/.test(name);
  if (!charactersValid) return 'chars';
  const lengthValid = /^[a-zA-Z0-9-_]{3,15}$|^TarkovCitizen\d{1,10}$/i.test(name);
  if (!lengthValid) return 'length';
  return null;
}
