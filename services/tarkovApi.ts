import { Platform } from 'react-native';
import { PlayerProfile, SearchResult } from '@/types/tarkov';

const PROFILE_BASE_URL = 'https://players.tarkov.dev/profile';

const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

async function fetchDirect(
  url: string,
  timeoutMs: number = 15000,
): Promise<Response> {
  console.log('[TarkovAPI] Direct fetch:', url);
  return fetchWithTimeout(
    url,
    {
      headers: {
        Accept: 'application/json',
      },
    },
    timeoutMs,
  );
}

async function fetchViaProxy(
  url: string,
  timeoutMs: number = 30000,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i](url);
    console.log(`[TarkovAPI] Trying proxy ${i + 1}/${CORS_PROXIES.length}`);
    try {
      const res = await fetchWithTimeout(proxyUrl, {}, timeoutMs);
      if (res.ok) {
        console.log(`[TarkovAPI] Proxy ${i + 1} succeeded`);
        return res;
      }
      lastError = new Error(`Proxy returned ${res.status}`);
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error('All proxies failed');
}

async function apiFetch(
  url: string,
  timeoutMs: number = 15000,
): Promise<Response> {
  if (Platform.OS !== 'web') {
    return fetchDirect(url, timeoutMs);
  }

  try {
    const directRes = await fetchDirect(url, timeoutMs);
    if (directRes.ok) return directRes;
  } catch (e) {
    console.log('[TarkovAPI] Direct fetch failed on web, trying proxies:', e);
  }

  return fetchViaProxy(url, timeoutMs);
}

export async function fetchPlayerProfile(
  accountId: string,
): Promise<PlayerProfile> {
  console.log('[TarkovAPI] Fetching profile for:', accountId);
  const url = `${PROFILE_BASE_URL}/${accountId}.json`;
  const response = await apiFetch(url);

  if (response.status === 404) {
    throw new Error('Player not found');
  }
  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[TarkovAPI] Profile loaded:', data?.info?.nickname);
  return data as PlayerProfile;
}

let cachedIndex: Record<string, string> | null = null;
let indexLoadPromise: Promise<Record<string, string>> | null = null;
let indexLoadProgress: string = '';

export function getIndexLoadProgress(): string {
  return indexLoadProgress;
}

async function fetchIndex(): Promise<Record<string, string>> {
  if (cachedIndex) return cachedIndex;

  if (indexLoadPromise) {
    console.log('[TarkovAPI] Index already loading, waiting...');
    return indexLoadPromise;
  }

  const startTime = Date.now();
  indexLoadPromise = (async () => {
    try {
      const url = `${PROFILE_BASE_URL}/index.json`;
      indexLoadProgress = 'Connecting to player database...';
      console.log('[TarkovAPI] Fetching player index...');

      const response = await apiFetch(url, 90000);

      if (!response.ok) {
        throw new Error(`Failed to fetch index: ${response.status}`);
      }

      indexLoadProgress = 'Downloading & parsing player database...';
      console.log('[TarkovAPI] Index response received, parsing JSON directly...');

      const data = await response.json() as Record<string, string>;
      cachedIndex = data;
      indexLoadProgress = '';
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        '[TarkovAPI] Index loaded in',
        elapsed,
        's, entries:',
        Object.keys(cachedIndex).length,
      );
      return cachedIndex;
    } catch (err) {
      indexLoadPromise = null;
      indexLoadProgress = '';
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(
          'Download timed out. Try entering an Account ID directly.',
        );
      }
      throw err;
    }
  })();

  return indexLoadPromise;
}

export function clearIndexCache(): void {
  cachedIndex = null;
  indexLoadPromise = null;
  indexLoadProgress = '';
  console.log('[TarkovAPI] Index cache cleared');
}

export function isIndexCached(): boolean {
  return cachedIndex !== null;
}

export function isIndexLoading(): boolean {
  return indexLoadPromise !== null && cachedIndex === null;
}

export function preloadIndex(): void {
  if (cachedIndex || indexLoadPromise) return;
  console.log('[TarkovAPI] Preloading index in background...');
  fetchIndex().catch((err) => {
    console.log('[TarkovAPI] Background preload failed:', err);
  });
}

export async function searchPlayers(name: string): Promise<SearchResult[]> {
  console.log('[TarkovAPI] Searching players:', name);
  const index = await fetchIndex();
  const query = name.toLowerCase();

  const results = Object.entries(index)
    .filter(([, playerName]) => playerName.toLowerCase().includes(query))
    .map(([id, playerName]) => ({ id, name: playerName }))
    .sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      const aExact = aLower === query;
      const bExact = bLower === query;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      const aStarts = aLower.startsWith(query);
      const bStarts = bLower.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aLower.localeCompare(bLower);
    })
    .slice(0, 50);

  console.log('[TarkovAPI] Search results:', results.length);
  return results;
}
