import { Platform } from 'react-native';
import { PlayerProfile, SearchResult } from '@/types/tarkov';

const RAW_BASE_URL = 'https://players.tarkov.dev/profile';

function proxyUrl(url: string): string {
  if (Platform.OS === 'web') {
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
  }
  return url;
}

let cachedIndex: Record<string, string> | null = null;

export async function fetchPlayerProfile(accountId: string): Promise<PlayerProfile> {
  console.log('[TarkovAPI] Fetching profile for:', accountId);
  const url = proxyUrl(`${RAW_BASE_URL}/${accountId}.json`);
  const response = await fetch(url);

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
  const url = proxyUrl(`${RAW_BASE_URL}/index.json`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch index: ${response.status}`);
  }

  const data = await response.json();
  cachedIndex = data as Record<string, string>;
  console.log('[TarkovAPI] Index loaded, entries:', Object.keys(cachedIndex).length);
  return cachedIndex;
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
