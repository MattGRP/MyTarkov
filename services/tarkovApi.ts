import { Platform } from 'react-native';
import { PlayerProfile, SearchResult } from '@/types/tarkov';

const PROFILE_BASE_URL = 'https://players.tarkov.dev/profile';
const PLAYER_SEARCH_BASE_URL = 'https://player.tarkov.dev';
const GRAPHQL_URL = 'https://api.tarkov.dev/graphql';
const ITEM_META_BASE_URL = 'https://assets.tarkov.dev';

const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 20000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

async function fetchDirect(
  url: string,
  timeoutMs: number = 20000,
): Promise<Response> {
  console.log('[TarkovAPI] Direct fetch:', url);
  return fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent': 'TarkovStats/1.0',
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
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
    console.log(
      `[TarkovAPI] Trying proxy ${i + 1}/${CORS_PROXIES.length}:`,
      proxyUrl,
    );
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

async function apiFetch(
  url: string,
  timeoutMs: number = 20000,
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

  indexLoadPromise = (async () => {
    try {
      const url = `${PROFILE_BASE_URL}/index.json`;
      indexLoadProgress = 'Connecting to player database...';
      console.log('[TarkovAPI] Fetching player index...');

      const response = await apiFetch(url, 120000);

      if (!response.ok) {
        throw new Error(`Failed to fetch index: ${response.status}`);
      }

      indexLoadProgress = 'Downloading player database (~66MB)...';
      console.log('[TarkovAPI] Index response received, reading body...');

      const text = await response.text();
      console.log(
        '[TarkovAPI] Index downloaded, size:',
        (text.length / 1024 / 1024).toFixed(1),
        'MB, parsing...',
      );

      indexLoadProgress = 'Parsing player database...';
      const data = JSON.parse(text) as Record<string, string>;
      cachedIndex = data;
      indexLoadProgress = '';
      console.log(
        '[TarkovAPI] Index loaded, entries:',
        Object.keys(cachedIndex).length,
      );
      return cachedIndex;
    } catch (err) {
      indexLoadPromise = null;
      indexLoadProgress = '';
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(
          'Download timed out. The player database is very large (~66MB). Try entering an Account ID directly.',
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
  if (!cachedIndex && !indexLoadPromise) {
    console.log('[TarkovAPI] Preloading index on app start...');
    fetchIndex().catch((err) => {
      console.log('[TarkovAPI] Preload failed:', err);
    });
  }
}

function normalizeSearchResults(payload: unknown): SearchResult[] {
  const pick = (item: any): SearchResult | null => {
    const id = item?.accountId ?? item?.id ?? item?.aid;
    const name = item?.nickname ?? item?.name ?? item?.playerName;
    if (!id || !name) return null;
    return { id: String(id), name: String(name) };
  };

  const arrays: any[] = [];
  if (Array.isArray(payload)) arrays.push(payload);
  if ((payload as any)?.players && Array.isArray((payload as any).players)) arrays.push((payload as any).players);
  if ((payload as any)?.results && Array.isArray((payload as any).results)) arrays.push((payload as any).results);
  if ((payload as any)?.data?.players && Array.isArray((payload as any).data.players)) arrays.push((payload as any).data.players);
  if ((payload as any)?.player) arrays.push([(payload as any).player]);

  for (const list of arrays) {
    const mapped = list.map(pick).filter(Boolean) as SearchResult[];
    if (mapped.length > 0) return mapped;
  }

  return [];
}

export async function searchPlayers(name: string): Promise<SearchResult[]> {
  console.log('[TarkovAPI] Searching players:', name);

  if (!isIndexCached()) {
    await fetchIndex();
  }

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

async function graphqlFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetchWithTimeout(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
    body: JSON.stringify({ query, variables }),
  }, 20000);

  if (!response.ok) {
    throw new Error(`GraphQL error: ${response.status}`);
  }
  const json = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(json.errors[0].message);
  }
  if (!json.data) {
    throw new Error('GraphQL response missing data');
  }
  return json.data;
}

export async function fetchPlayerLevels(): Promise<Array<{ level: number; exp: number; levelBadgeImageLink?: string }>> {
  const query = `query PlayerLevels { playerLevels { level exp levelBadgeImageLink } }`;
  const data = await graphqlFetch<{ playerLevels: Array<{ level: number; exp: number; levelBadgeImageLink?: string }> }>(query);
  return data.playerLevels ?? [];
}

const itemNameCache: Record<string, string> = {};
const itemMetaCache: Record<string, { name: string; width?: number; height?: number; baseImageLink?: string }> = {};

function getItemNameCacheKey(tpl: string, language: 'en' | 'zh'): string {
  return `${language}:${tpl}`;
}

function getItemMetaCacheKey(tpl: string, language: 'en' | 'zh'): string {
  return `${language}:${tpl}`;
}

async function fetchItemNameByTpl(tpl: string, language: 'en' | 'zh'): Promise<string | null> {
  const cacheKey = getItemNameCacheKey(tpl, language);
  if (itemNameCache[cacheKey]) return itemNameCache[cacheKey];
  const url = `${ITEM_META_BASE_URL}/${tpl}.json`;
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 20000);
    if (!response.ok) return null;
    const data = await response.json() as { name?: string; shortName?: string };
    const name = data.shortName || data.name;
    if (name) {
      itemNameCache[cacheKey] = name;
      return name;
    }
  } catch (error) {
    console.log('[TarkovAPI] Item meta fetch failed:', error);
  }
  return null;
}

export async function fetchItemNamesByTpls(tpls: string[], language: 'en' | 'zh' = 'en'): Promise<Record<string, string>> {
  const unique = Array.from(new Set(tpls)).filter(Boolean);
  if (unique.length === 0) return {};

  const cached: Record<string, string> = {};
  const missing: string[] = [];
  for (const tpl of unique) {
    const cacheKey = getItemNameCacheKey(tpl, language);
    if (itemNameCache[cacheKey]) {
      cached[tpl] = itemNameCache[cacheKey];
    } else {
      missing.push(tpl);
    }
  }

  if (missing.length > 0) {
    try {
      const query = `query ItemNames($ids: [ID!], $lang: LanguageCode) { items(ids: $ids, lang: $lang) { id name shortName } }`;
      const data = await graphqlFetch<{ items: Array<{ id: string; name: string; shortName?: string }> }>(query, {
        ids: missing,
        lang: language,
      });
      for (const item of data.items ?? []) {
        const name = item.shortName || item.name;
        if (name) {
          const cacheKey = getItemNameCacheKey(item.id, language);
          itemNameCache[cacheKey] = name;
          cached[item.id] = name;
        }
      }
    } catch (error) {
      console.log('[TarkovAPI] GraphQL item name fetch failed:', error);
    }
  }

  const stillMissing = unique.filter((tpl) => !cached[tpl]);
  if (stillMissing.length > 0) {
    const fallbackEntries = await Promise.all(stillMissing.map(async (tpl) => {
      const name = await fetchItemNameByTpl(tpl, language);
      return [tpl, name ?? ''] as const;
    }));
    for (const [tpl, name] of fallbackEntries) {
      if (name) cached[tpl] = name;
    }
  }

  return cached;
}

export async function fetchItemMetaByTpls(
  tpls: string[],
  language: 'en' | 'zh' = 'en',
): Promise<Record<string, { name: string; width?: number; height?: number; baseImageLink?: string }>> {
  const unique = Array.from(new Set(tpls)).filter(Boolean);
  if (unique.length === 0) return {};

  const cached: Record<string, { name: string; width?: number; height?: number; baseImageLink?: string }> = {};
  const missing: string[] = [];
  for (const tpl of unique) {
    const cacheKey = getItemMetaCacheKey(tpl, language);
    if (itemMetaCache[cacheKey]) {
      cached[tpl] = itemMetaCache[cacheKey];
    } else {
      missing.push(tpl);
    }
  }

  if (missing.length > 0) {
    try {
      const query = `query ItemMeta($ids: [ID!], $lang: LanguageCode) { items(ids: $ids, lang: $lang) { id name shortName width height baseImageLink } }`;
      const data = await graphqlFetch<{ items: Array<{ id: string; name: string; shortName?: string; width?: number; height?: number; baseImageLink?: string }> }>(query, {
        ids: missing,
        lang: language,
      });
      for (const item of data.items ?? []) {
        const name = item.shortName || item.name;
        if (name) {
          const meta = { name, width: item.width, height: item.height, baseImageLink: item.baseImageLink };
          const cacheKey = getItemMetaCacheKey(item.id, language);
          itemMetaCache[cacheKey] = meta;
          cached[item.id] = meta;
        }
      }
    } catch (error) {
      console.log('[TarkovAPI] GraphQL item meta fetch failed:', error);
    }
  }

  const stillMissing = unique.filter((tpl) => !cached[tpl]);
  if (stillMissing.length > 0) {
    const fallbackEntries = await Promise.all(stillMissing.map(async (tpl) => {
      const name = await fetchItemNameByTpl(tpl, language);
      return [tpl, name ?? ''] as const;
    }));
    for (const [tpl, name] of fallbackEntries) {
      if (name) {
        const meta = { name };
        const cacheKey = getItemMetaCacheKey(tpl, language);
        itemMetaCache[cacheKey] = meta;
        cached[tpl] = meta;
      }
    }
  }

  return cached;
}

export async function fetchItemNamesByIds(ids: string[], language: 'en' | 'zh'): Promise<Record<string, string>> {
  // Deprecated: keep for compatibility; prefer fetchItemNamesByTpls.
  return {};
}

export async function fetchSkills(language: 'en' | 'zh' = 'en'): Promise<Array<{ id: string; name: string }>> {
  const query = `query Skills($lang: LanguageCode) { skills(lang: $lang) { id name } }`;
  const data = await graphqlFetch<{ skills: Array<{ id: string; name: string }> }>(query, { lang: language });
  return data.skills ?? [];
}
