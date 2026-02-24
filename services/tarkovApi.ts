import { Platform } from 'react-native';
import { PlayerProfile, SearchResult } from '@/types/tarkov';

const RAW_BASE_URL = 'https://players.tarkov.dev/profile';

const CORS_PROXIES = [
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

async function fetchWithProxy(url: string): Promise<Response> {
  if (Platform.OS !== 'web') {
    console.log('[TarkovAPI] Native fetch:', url);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'TarkovStats/1.0',
        'Accept': 'application/json',
      },
    });
    return res;
  }

  let lastError: Error | null = null;
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxyUrl = CORS_PROXIES[i](url);
    console.log(`[TarkovAPI] Trying proxy ${i + 1}/${CORS_PROXIES.length}:`, proxyUrl);
    try {
      const res = await fetch(proxyUrl);
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

  console.log('[TarkovAPI] Fetching player index...');
  const url = `${RAW_BASE_URL}/index.json`;
  const response = await fetchWithProxy(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch index: ${response.status}`);
  }

  const data = await response.json();
  cachedIndex = data as Record<string, string>;
  console.log('[TarkovAPI] Index loaded, entries:', Object.keys(cachedIndex).length);
  return cachedIndex;
}

export function clearIndexCache(): void {
  cachedIndex = null;
  console.log('[TarkovAPI] Index cache cleared');
}

export async function searchPlayers(name: string): Promise<SearchResult[]> {
  console.log('[TarkovAPI] Searching players:', name);
  const index = await fetchIndex();
  const query = name.toLowerCase();

  const results = Object.entries(index)
    .filter(([, playerName]) => playerName.toLowerCase().includes(query))
    .map(([id, playerName]) => ({ id, name: playerName }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
    .slice(0, 50);

  console.log('[TarkovAPI] Search results:', results.length);
  return results;
}
