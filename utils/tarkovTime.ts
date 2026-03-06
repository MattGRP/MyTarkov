const TARKOV_TIME_RATIO = 7;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const RUSSIA_UTC_OFFSET_MS = 3 * MS_PER_HOUR;

function normalizeMapKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatMsToUtcHhMmSs(ms: number): string {
  const date = new Date(ms);
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

function realTimeToTarkovTimeMs(nowMs: number, leftClock: boolean): number {
  const offset = RUSSIA_UTC_OFFSET_MS + (leftClock ? 0 : 12 * MS_PER_HOUR);
  return (offset + nowMs * TARKOV_TIME_RATIO) % MS_PER_DAY;
}

// Mirrors tarkov.dev source:
// src/components/Time.jsx and src/modules/leaflet-control-raid-info.js
export function getMapRaidTimePair(
  normalizedName?: string | null,
  nowMs: number = Date.now(),
): [string, string] | null {
  const mapKey = normalizeMapKey(normalizedName);

  if (mapKey === 'the-lab') {
    return null;
  }

  if (mapKey === 'factory' || mapKey === 'night-factory') {
    return ['15:28:00', '03:28:00'];
  }

  return [
    formatMsToUtcHhMmSs(realTimeToTarkovTimeMs(nowMs, true)),
    formatMsToUtcHhMmSs(realTimeToTarkovTimeMs(nowMs, false)),
  ];
}

