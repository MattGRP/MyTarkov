// noinspection JSUnusedGlobalSymbols
import AsyncStorage from '@react-native-async-storage/async-storage';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface DebugLogEntry {
  ts: number;
  level: LogLevel;
  tag: string;
  message: string;
  meta?: string;
}

const STORAGE_KEY = 'mytarkov_debug_logs_v1';
const MAX_LOG_ENTRIES = 400;

let cachedLogs: DebugLogEntry[] | null = null;
let loadPromise: Promise<DebugLogEntry[]> | null = null;
let persistQueue: Promise<void> = Promise.resolve();

function stringifyMeta(meta?: unknown): string | undefined {
  if (meta === undefined || meta === null) return undefined;
  if (typeof meta === 'string') return meta;
  if (meta instanceof Error) return `${meta.name}: ${meta.message}`;
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

async function ensureLoaded(): Promise<DebugLogEntry[]> {
  if (cachedLogs) return cachedLogs;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        cachedLogs = [];
        return cachedLogs;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        cachedLogs = [];
        return cachedLogs;
      }
      cachedLogs = parsed
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => entry as DebugLogEntry)
        .slice(-MAX_LOG_ENTRIES);
      return cachedLogs;
    } catch {
      cachedLogs = [];
      return cachedLogs;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

function queuePersist(logs: DebugLogEntry[]): void {
  const snapshot = logs.slice(-MAX_LOG_ENTRIES);
  persistQueue = persistQueue
    .then(async () => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    })
    .catch(() => undefined);
}

async function appendLog(
  level: LogLevel,
  tag: string,
  message: string,
  meta?: unknown,
): Promise<void> {
  const logs = await ensureLoaded();
  logs.push({
    ts: Date.now(),
    level,
    tag,
    message,
    meta: stringifyMeta(meta),
  });
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.splice(0, logs.length - MAX_LOG_ENTRIES);
  }
  queuePersist(logs);
}

function writeConsole(level: LogLevel, tag: string, message: string, meta?: unknown): void {
  const prefix = `[${tag}] ${message}`;
  if (level === 'ERROR') {
    console.error(prefix, meta ?? '');
    return;
  }
  if (level === 'WARN') {
    console.warn(prefix, meta ?? '');
    return;
  }
  console.log(prefix, meta ?? '');
}

export function logInfo(tag: string, message: string, meta?: unknown): void {
  writeConsole('INFO', tag, message, meta);
  void appendLog('INFO', tag, message, meta);
}

export function logWarn(tag: string, message: string, meta?: unknown): void {
  writeConsole('WARN', tag, message, meta);
  void appendLog('WARN', tag, message, meta);
}

export function logError(tag: string, message: string, meta?: unknown): void {
  writeConsole('ERROR', tag, message, meta);
  void appendLog('ERROR', tag, message, meta);
}

export async function getDebugLogsText(): Promise<string> {
  const logs = await ensureLoaded();
  if (logs.length === 0) {
    return 'No logs yet.';
  }
  return logs
    .map((entry) => {
      const date = new Date(entry.ts).toISOString();
      if (entry.meta) {
        return `${date} [${entry.level}] [${entry.tag}] ${entry.message} | ${entry.meta}`;
      }
      return `${date} [${entry.level}] [${entry.tag}] ${entry.message}`;
    })
    .join('\n');
}

export async function clearDebugLogs(): Promise<void> {
  cachedLogs = [];
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage cleanup failure
  }
}
