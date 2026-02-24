import { Platform } from 'react-native';
import { PlayerProfile, SearchResult } from '@/types/tarkov';

const RAW_BASE_URL = 'https://players.tarkov.dev/profile';

const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function fetchWithProxy(url: string, timeoutMs: number = 20000): Promise<Response> {
  if (Platform.OS !== 'web') {
    console.log('[TarkovAPI] Native fetch:', url);
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'TarkovStats/1.0',
        'Accept': 'application/json',
      },
    }, timeoutMs);
    return res;
  }

  let lastError: Error | null = null;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i](url);
    console.log(`[TarkovAPI] Trying proxy ${i + 1}/${CORS_PROXIES.length}:`, proxyUrl);
    try {
      const res = await fetchWithTimeout(proxyUrl, {}, timeoutMs);
      if (res.ok) {
        console.log(`[TarkovAPI] Proxy ${i + 1} succeeded`);
        return res;
      }
      console.log(`[TarkovAPI] Proxy ${i + 1} returned status:`, res.status);
      lastError = new Error(`Proxy returned ${res.status}`);
    } catch (err) {
      console.log(`[TarkovAPI] Proxy ${i + 1} failed:`, err);
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error('All proxies failed');
}

let cachedIndex: Record<string, string> | null = null;
let indexLoadPromise: Promise<Record<string, string>> | null = null;

export async function fetchPlayerProfile(accountId: string): Promise<PlayerProfile> {
  console.log('[TarkovAPI] Fetching profile for:', accountId);
  const url = `${RAW_BASE_URL}/${accountId}.json`;
  const response = await fetchWithProxy(url);

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

async function fetchIndex(): Promise<Record<string, string>> {
  if (cachedIndex) return cachedIndex;

  if (indexLoadPromise) {
    console.log('[TarkovAPI] Index already loading, waiting...');
    return indexLoadPromise;
  }

  indexLoadPromise = (async () => {
    try {
      console.log('[TarkovAPI] Fetching player index (~66MB, this may take a moment)...');
      const url = `${RAW_BASE_URL}/index.json`;
      const response = await fetchWithProxy(url, 60000);

      if (!response.ok) {
        throw new Error(`Failed to fetch index: ${response.status}`);
      }

      const text = await response.text();
      console.log('[TarkovAPI] Index downloaded, size:', (text.length / 1024 / 1024).toFixed(1), 'MB, parsing...');
      const data = JSON.parse(text) as Record<string, string>;
      cachedIndex = data;
      console.log('[TarkovAPI] Index loaded, entries:', Object.keys(cachedIndex).length);
      return cachedIndex;
    } catch (err) {
      indexLoadPromise = null;
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Search index download timed out. The player database is very large (~66MB). Try entering an Account ID directly instead.');
      }
      throw err;
    }
  })();

  return indexLoadPromise;
}

export function clearIndexCache(): void {
  cachedIndex = null;
  indexLoadPromise = null;
  console.log('[TarkovAPI] Index cache cleared');
}

export function isIndexCached(): boolean {
  return cachedIndex !== null;
}

export function isIndexLoading(): boolean {
  return indexLoadPromise !== null && cachedIndex === null;
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
