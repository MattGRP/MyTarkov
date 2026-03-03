import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ItemDetail,
  ItemSearchResult,
  PlayerProfile,
  SearchResult,
  TaskDetail,
  TraderDetail,
  getItemImageURL,
} from '@/types/tarkov';
import { Language } from '@/constants/i18n';
import { logInfo, logWarn } from '@/utils/debugLog';

const PROFILE_BASE_URL = 'https://players.tarkov.dev/profile';
const PLAYER_SEARCH_BASE_URL = 'https://player.tarkov.dev';
const GRAPHQL_URL = 'https://api.tarkov.dev/graphql';
const ITEM_META_BASE_URL = 'https://assets.tarkov.dev';
const PLAYER_SEARCH_TOKEN_KEY = 'tarkov_player_search_token';
const PLAYER_SEARCH_TOKEN_UPDATED_AT_KEY = 'tarkov_player_search_token_updated_at';
const TURNSTILE_ERROR_CODE = 'TURNSTILE_REQUIRED';
const PLAYER_SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const PLAYER_SEARCH_CACHE_LIMIT = 120;
const PLAYER_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const PLAYER_PROFILE_CACHE_LIMIT = 60;
const ITEM_SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const ITEM_SEARCH_CACHE_LIMIT = 120;
const PLAYER_SEARCH_WARMUP_QUERY = 'zzzx';
const PLAYER_SEARCH_WARMUP_MIN_GAP_MS = 8 * 60 * 1000;
const TRADER_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;

const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

const GRAPHQL_CHUNK_SIZE = 60;
const GRAPHQL_CHUNK_FETCH_CONCURRENCY = 4;
const GRAPHQL_RESPONSE_CACHE_TTL_MS = 2 * 60 * 1000;
const GRAPHQL_RESPONSE_CACHE_LIMIT = 180;
const GRAPHQL_TIMEOUT_MS = 35000;
const ASSET_FETCH_CONCURRENCY = 6;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) break;
      results[current] = await worker(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableSerialize(nested)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function setGraphqlCacheEntry(key: string, data: unknown): void {
  if (graphqlResponseCache.size >= GRAPHQL_RESPONSE_CACHE_LIMIT) {
    const firstKey = graphqlResponseCache.keys().next().value as string | undefined;
    if (firstKey) graphqlResponseCache.delete(firstKey);
  }
  graphqlResponseCache.set(key, {
    expiresAt: Date.now() + GRAPHQL_RESPONSE_CACHE_TTL_MS,
    data,
  });
}

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

type HeaderEntry = [string, string];
type HeaderLike = Headers | HeaderEntry[] | Record<string, string>;

class PlayerSearchError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'PlayerSearchError';
    this.code = code;
  }
}

function createTurnstileError(): PlayerSearchError {
  return new PlayerSearchError(
    'Turnstile authentication failed',
    TURNSTILE_ERROR_CODE,
  );
}

function isTurnstileFailureMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('turnstile') ||
    lower.includes('challenge not solved') ||
    lower.includes('authentication failed')
  );
}

export function isTurnstileRequiredError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof PlayerSearchError) {
    return error.code === TURNSTILE_ERROR_CODE;
  }
  if (error instanceof Error) {
    return (
      error.message.includes('Turnstile authentication failed') ||
      error.message.includes('TURNSTILE_REQUIRED')
    );
  }
  return false;
}

function mergeHeaders(
  base: Record<string, string>,
  extra?: RequestInit['headers'],
): Headers {
  const headers = new Headers(base);
  if (!extra) return headers;
  const extraHeaders = new Headers(extra as HeaderLike);
  extraHeaders.forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}

async function fetchDirect(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 20000,
): Promise<Response> {
  console.log('[TarkovAPI] Direct fetch:', url);
  const baseHeaders: Record<string, string> = {
    Accept: 'application/json',
  };
  const headers = mergeHeaders(baseHeaders, options.headers);
  return fetchWithTimeout(
    url,
    {
      ...options,
      headers,
    },
    timeoutMs,
  );
}

async function fetchViaProxy(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000,
): Promise<Response> {
  const method = (options.method ?? 'GET').toString().toUpperCase();
  const proxies = method === 'GET' ? CORS_PROXIES : CORS_PROXIES.slice(0, 1);
  let lastError: Error | null = null;
  for (let i = 0; i < proxies.length; i++) {
    const proxyUrl = proxies[i](url);
    console.log(
      `[TarkovAPI] Trying proxy ${i + 1}/${proxies.length}:`,
      proxyUrl,
    );
    try {
      const res = await fetchWithTimeout(proxyUrl, options, timeoutMs);
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
  optionsOrTimeout?: RequestInit | number,
  timeoutMs: number = 20000,
): Promise<Response> {
  let options: RequestInit | undefined;
  let resolvedTimeout = timeoutMs;
  if (typeof optionsOrTimeout === 'number') {
    resolvedTimeout = optionsOrTimeout;
  } else if (optionsOrTimeout) {
    options = optionsOrTimeout;
  }
  if (Platform.OS !== 'web') {
    return fetchDirect(url, options, resolvedTimeout);
  }

  try {
    const directRes = await fetchDirect(url, options, resolvedTimeout);
    if (directRes.ok) return directRes;
  } catch (e) {
    console.log('[TarkovAPI] Direct fetch failed on web, trying proxies:', e);
  }

  return fetchViaProxy(url, options, resolvedTimeout);
}

let cachedPlayerSearchToken: string | null | undefined;
let cachedPlayerSearchTokenUpdatedAt: number | null | undefined;
let playerSearchTokenLoadPromise: Promise<string | null> | null = null;
const playerProfileCache = new Map<string, { expiresAt: number; profile: PlayerProfile }>();
const playerProfileInFlight = new Map<string, Promise<PlayerProfile>>();
const playerSearchResultCache = new Map<string, { expiresAt: number; results: SearchResult[] }>();
const playerSearchInFlight = new Map<string, Promise<SearchResult[]>>();
const itemSearchResultCache = new Map<string, { expiresAt: number; results: ItemSearchResult[] }>();
const itemSearchInFlight = new Map<string, Promise<ItemSearchResult[]>>();
const graphqlResponseCache = new Map<string, { expiresAt: number; data: unknown }>();
const graphqlInFlight = new Map<string, Promise<unknown>>();
let playerSearchWarmupAt = 0;
let playerSearchWarmupPromise: Promise<void> | null = null;
const traderDetailCache = new Map<string, { expiresAt: number; data: TraderDetail }>();

async function loadPlayerSearchToken(): Promise<string | null> {
  if (cachedPlayerSearchToken !== undefined) {
    return cachedPlayerSearchToken;
  }
  if (playerSearchTokenLoadPromise) {
    return playerSearchTokenLoadPromise;
  }
  playerSearchTokenLoadPromise = (async () => {
    try {
      const [token, updatedAtRaw] = await Promise.all([
        AsyncStorage.getItem(PLAYER_SEARCH_TOKEN_KEY),
        AsyncStorage.getItem(PLAYER_SEARCH_TOKEN_UPDATED_AT_KEY),
      ]);
      cachedPlayerSearchToken = token?.trim() || null;
      const parsedUpdatedAt = Number(updatedAtRaw || 0);
      cachedPlayerSearchTokenUpdatedAt = Number.isFinite(parsedUpdatedAt) && parsedUpdatedAt > 0
        ? parsedUpdatedAt
        : null;
      return cachedPlayerSearchToken;
    } finally {
      playerSearchTokenLoadPromise = null;
    }
  })();
  return playerSearchTokenLoadPromise;
}

export async function getPlayerSearchToken(): Promise<string | null> {
  return loadPlayerSearchToken();
}

export async function getPlayerSearchTokenUpdatedAt(): Promise<number | null> {
  await loadPlayerSearchToken();
  return cachedPlayerSearchTokenUpdatedAt ?? null;
}

export async function savePlayerSearchToken(token: string): Promise<void> {
  const sanitized = token.trim();
  if (!sanitized) return;
  const now = Date.now();
  await Promise.all([
    AsyncStorage.setItem(PLAYER_SEARCH_TOKEN_KEY, sanitized),
    AsyncStorage.setItem(PLAYER_SEARCH_TOKEN_UPDATED_AT_KEY, String(now)),
  ]);
  cachedPlayerSearchToken = sanitized;
  cachedPlayerSearchTokenUpdatedAt = now;
  logInfo('PlayerSearch', 'Token saved', { length: sanitized.length });
}

export async function clearPlayerSearchToken(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(PLAYER_SEARCH_TOKEN_KEY),
    AsyncStorage.removeItem(PLAYER_SEARCH_TOKEN_UPDATED_AT_KEY),
  ]);
  cachedPlayerSearchToken = null;
  cachedPlayerSearchTokenUpdatedAt = null;
  logWarn('PlayerSearch', 'Token cleared');
}

export function clearPlayerProfileCache(accountId?: string): void {
  const trimmed = String(accountId || '').trim();
  if (trimmed) {
    playerProfileCache.delete(trimmed);
    playerProfileInFlight.delete(trimmed);
    return;
  }
  playerProfileCache.clear();
  playerProfileInFlight.clear();
}

export async function fetchPlayerProfile(
  accountId: string,
  options?: { force?: boolean },
): Promise<PlayerProfile> {
  const trimmed = String(accountId || '').trim();
  if (!trimmed) {
    throw new Error('Invalid account id');
  }

  const force = options?.force === true;

  if (force) {
    clearPlayerProfileCache(trimmed);
  }

  if (!force) {
    const cached = playerProfileCache.get(trimmed);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }
    if (cached) {
      playerProfileCache.delete(trimmed);
    }
  }

  if (!force) {
    const inFlight = playerProfileInFlight.get(trimmed);
    if (inFlight) {
      return inFlight;
    }
  }

  const task = (async () => {
    console.log('[TarkovAPI] Fetching profile for:', trimmed);
    const profileUrl = `${PROFILE_BASE_URL}/${trimmed}.json`;
    const requestUrl = force ? `${profileUrl}?_=${Date.now()}` : profileUrl;
    const response = await apiFetch(requestUrl, {
      headers: {
        'Cache-Control': force ? 'no-cache, no-store, max-age=0' : 'no-cache',
        Pragma: 'no-cache',
      },
    });

    if (response.status === 404) {
      throw new Error('Player not found');
    }
    if (!response.ok) {
      throw new Error(`Network error: ${response.status}`);
    }

    const data = await response.json();
    const profile = data as PlayerProfile;
    console.log('[TarkovAPI] Profile loaded:', profile?.info?.nickname);
    if (playerProfileCache.size >= PLAYER_PROFILE_CACHE_LIMIT) {
      const firstKey = playerProfileCache.keys().next().value as string | undefined;
      if (firstKey) playerProfileCache.delete(firstKey);
    }
    playerProfileCache.set(trimmed, {
      expiresAt: Date.now() + PLAYER_PROFILE_CACHE_TTL_MS,
      profile,
    });
    return profile;
  })();

  playerProfileInFlight.set(trimmed, task);
  try {
    return await task;
  } finally {
    if (playerProfileInFlight.get(trimmed) === task) {
      playerProfileInFlight.delete(trimmed);
    }
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

async function readPlayerSearchErrorMessage(response: Response): Promise<string> {
  let message = `Player search failed: ${response.status}`;
  try {
    const text = await response.text();
    if (!text) return message;
    try {
      const json = JSON.parse(text) as { errmsg?: string; message?: string };
      return json.errmsg || json.message || text;
    } catch {
      return text;
    }
  } catch {
    return message;
  }
}

async function requestPlayerSearch(
  name: string,
  token?: string,
): Promise<Response> {
  const query = new URLSearchParams();
  query.set('gameMode', 'regular');
  if (token?.trim()) {
    query.set('token', token.trim());
  }

  const path = `/name/${encodeURIComponent(name)}`;
  const getUrl = `${PLAYER_SEARCH_BASE_URL}${path}?${query.toString()}`;
  return apiFetch(
    getUrl,
    {
      method: 'GET',
    },
    30000,
  );
}

async function searchPlayersRemote(trimmed: string): Promise<SearchResult[]> {
  const token = await getPlayerSearchToken();
  if (!token) {
    logWarn('PlayerSearch', 'Search blocked: token missing', { query: trimmed });
    throw createTurnstileError();
  }

  const response = await requestPlayerSearch(trimmed, token);

  if (response.status === 401) {
    await clearPlayerSearchToken();
    logWarn('PlayerSearch', 'Search returned 401 (Turnstile required)', { query: trimmed });
    throw createTurnstileError();
  }

  if (response.status === 429) {
    throw new PlayerSearchError(
      'Rate limited exceeded. Wait a minute to send another request.',
    );
  }

  if (!response.ok) {
    const message = await readPlayerSearchErrorMessage(response);
    if (
      (response.status === 400 || response.status === 403 || response.status === 422) &&
      isTurnstileFailureMessage(message)
    ) {
      await clearPlayerSearchToken();
      logWarn('PlayerSearch', 'Search rejected by Turnstile', {
        status: response.status,
        query: trimmed,
        message,
      });
      throw createTurnstileError();
    }
    logWarn('PlayerSearch', 'Search failed', {
      status: response.status,
      query: trimmed,
      message,
    });
    throw new PlayerSearchError(message);
  }

  const payload = await response.json();
  if ((payload as any)?.err) {
    const message = (payload as any).errmsg || 'Player search failed';
    if (isTurnstileFailureMessage(message)) {
      await clearPlayerSearchToken();
      logWarn('PlayerSearch', 'Search payload indicates Turnstile failure', {
        query: trimmed,
        message,
      });
      throw createTurnstileError();
    }
    logWarn('PlayerSearch', 'Search payload error', {
      query: trimmed,
      message,
    });
    throw new PlayerSearchError(message);
  }

  logInfo('PlayerSearch', 'Search succeeded', {
    query: trimmed,
    resultCount: Array.isArray(payload) ? payload.length : undefined,
  });
  return normalizeSearchResults(payload);
}

export async function warmupPlayerSearch(force: boolean = false): Promise<void> {
  const now = Date.now();
  if (!force && now - playerSearchWarmupAt < PLAYER_SEARCH_WARMUP_MIN_GAP_MS) {
    return;
  }
  if (playerSearchWarmupPromise) {
    return playerSearchWarmupPromise;
  }

  playerSearchWarmupPromise = (async () => {
    try {
      const token = await getPlayerSearchToken();
      if (!token) {
        logWarn('PlayerSearch', 'Warmup skipped: token missing');
        return;
      }

      const response = await requestPlayerSearch(PLAYER_SEARCH_WARMUP_QUERY, token);
      if (response.status === 401) {
        await clearPlayerSearchToken();
        logWarn('PlayerSearch', 'Warmup invalidated stale token (401)');
        return;
      }

      if (!response.ok) {
        const message = await readPlayerSearchErrorMessage(response);
        logWarn('PlayerSearch', 'Warmup skipped: upstream rejected request', {
          status: response.status,
          message,
        });
        return;
      }

      playerSearchWarmupAt = Date.now();
      console.log('[TarkovAPI] Player search warmup completed');
      logInfo('PlayerSearch', 'Warmup completed');
    } catch (error) {
      console.log('[TarkovAPI] Player search warmup skipped:', error);
      logWarn('PlayerSearch', 'Warmup skipped', error);
    } finally {
      playerSearchWarmupPromise = null;
    }
  })();

  return playerSearchWarmupPromise;
}

function getCachedPlayerSearchResults(cacheKey: string): SearchResult[] | null {
  const hit = playerSearchResultCache.get(cacheKey);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    playerSearchResultCache.delete(cacheKey);
    return null;
  }
  return hit.results;
}

function setCachedPlayerSearchResults(cacheKey: string, results: SearchResult[]): void {
  if (playerSearchResultCache.size >= PLAYER_SEARCH_CACHE_LIMIT) {
    const firstKey = playerSearchResultCache.keys().next().value as string | undefined;
    if (firstKey) playerSearchResultCache.delete(firstKey);
  }
  playerSearchResultCache.set(cacheKey, {
    expiresAt: Date.now() + PLAYER_SEARCH_CACHE_TTL_MS,
    results,
  });
}

function getItemSearchCacheKey(query: string, language: Language): string {
  return `${language}:${query.toLowerCase()}`;
}

function getCachedItemSearchResults(cacheKey: string): ItemSearchResult[] | null {
  const hit = itemSearchResultCache.get(cacheKey);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    itemSearchResultCache.delete(cacheKey);
    return null;
  }
  return hit.results;
}

function setCachedItemSearchResults(cacheKey: string, results: ItemSearchResult[]): void {
  if (itemSearchResultCache.size >= ITEM_SEARCH_CACHE_LIMIT) {
    const firstKey = itemSearchResultCache.keys().next().value as string | undefined;
    if (firstKey) itemSearchResultCache.delete(firstKey);
  }
  itemSearchResultCache.set(cacheKey, {
    expiresAt: Date.now() + ITEM_SEARCH_CACHE_TTL_MS,
    results,
  });
}

function normalizeItemSearchText(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/[_\-./\\|]+/g, '')
    .replace(/\s+/g, '');
}

function splitItemSearchTokens(value: string): string[] {
  const tokens = value
    .toLowerCase()
    .trim()
    .split(/[\s\u3000]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
  return Array.from(new Set(tokens));
}

function scoreItemSearchField(field: string | undefined, queryNormalized: string): number {
  if (!field || !queryNormalized) return 0;
  const normalized = normalizeItemSearchText(field);
  if (!normalized) return 0;
  if (normalized === queryNormalized) return 120;
  if (normalized.startsWith(queryNormalized)) return 95;
  if (normalized.includes(queryNormalized)) return 65;
  return 0;
}

function itemContainsToken(item: ItemSearchResult, token: string): boolean {
  if (!token) return false;
  const normalizedToken = normalizeItemSearchText(token);
  if (!normalizedToken) return false;
  const candidates = [item.name, item.shortName, item.normalizedName, item.id];
  return candidates.some((field) => {
    if (!field) return false;
    return normalizeItemSearchText(field).includes(normalizedToken);
  });
}

function filterAndRankItemSearchResults(
  results: ItemSearchResult[],
  query: string,
): ItemSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed || results.length === 0) return results;

  const normalizedQuery = normalizeItemSearchText(trimmed);
  const tokens = splitItemSearchTokens(trimmed);
  const isIdQuery = /^[a-f0-9]{8,}$/i.test(trimmed);
  const ranked = results
    .map((item) => {
      const idScore = isIdQuery && item.id?.toLowerCase().includes(trimmed.toLowerCase())
        ? 130
        : 0;
      const fieldScore = Math.max(
        scoreItemSearchField(item.name, normalizedQuery),
        scoreItemSearchField(item.shortName, normalizedQuery),
        scoreItemSearchField(item.normalizedName, normalizedQuery),
        scoreItemSearchField(item.id, normalizedQuery),
      );
      const matchedTokenCount = tokens.reduce(
        (count, token) => count + (itemContainsToken(item, token) ? 1 : 0),
        0,
      );
      const tokenCoverageScore = tokens.length > 0
        ? Math.round((matchedTokenCount / tokens.length) * 40)
        : 0;
      const score = Math.max(idScore, fieldScore) + tokenCoverageScore;
      const tokenPass = tokens.length <= 1
        ? matchedTokenCount > 0 || scoreItemSearchField(item.id, normalizedQuery) > 0
        : matchedTokenCount === tokens.length;
      return { item, score, tokenPass };
    })
    .filter((entry) => entry.score > 0 && entry.tokenPass)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);

  if (ranked.length > 0) {
    return ranked;
  }

  // Fallback for edge transliteration cases: keep only direct id/name includes.
  const lower = trimmed.toLowerCase();
  return results.filter((item) => {
    const id = item.id?.toLowerCase() ?? '';
    const name = item.name?.toLowerCase() ?? '';
    const shortName = item.shortName?.toLowerCase() ?? '';
    return id.includes(lower) || name.includes(lower) || shortName.includes(lower);
  });
}

export async function searchPlayers(name: string): Promise<SearchResult[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const cacheKey = trimmed.toLowerCase();
  const cached = getCachedPlayerSearchResults(cacheKey);
  if (cached) {
    console.log('[TarkovAPI] Search cache hit:', cacheKey, cached.length);
    return cached;
  }

  const inFlight = playerSearchInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  console.log('[TarkovAPI] Searching players:', trimmed);
  const task = (async () => {
    const results = await searchPlayersRemote(trimmed);
    setCachedPlayerSearchResults(cacheKey, results);
    console.log('[TarkovAPI] Search results:', results.length);
    return results;
  })();

  playerSearchInFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    if (playerSearchInFlight.get(cacheKey) === task) {
      playerSearchInFlight.delete(cacheKey);
    }
  }
}

async function graphqlFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const cacheKey = `${query}::${stableSerialize(variables ?? null)}`;
  const cached = graphqlResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }
  if (cached) {
    graphqlResponseCache.delete(cacheKey);
  }

  const inFlight = graphqlInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const task = (async () => {
    const baseHeaders = {
      Accept: 'application/json',
    };

    let response: Response | null = null;
    if (Platform.OS === 'web') {
      const params = new URLSearchParams();
      params.set('query', query);
      if (variables && Object.keys(variables).length > 0) {
        params.set('variables', JSON.stringify(variables));
      }
      const getUrl = `${GRAPHQL_URL}?${params.toString()}`;

      try {
        const getResponse = await apiFetch(
          getUrl,
          {
            method: 'GET',
            headers: baseHeaders,
          },
          GRAPHQL_TIMEOUT_MS,
        );
        if ([400, 405, 413, 414, 431].includes(getResponse.status)) {
          response = null;
        } else {
          response = getResponse;
        }
      } catch {
        response = null;
      }
    }

    if (!response) {
      response = await apiFetch(
        GRAPHQL_URL,
        {
          method: 'POST',
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        },
        GRAPHQL_TIMEOUT_MS,
      );
    }

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

    setGraphqlCacheEntry(cacheKey, json.data);
    return json.data;
  })();

  graphqlInFlight.set(cacheKey, task as Promise<unknown>);
  try {
    return await task;
  } finally {
    if (graphqlInFlight.get(cacheKey) === task) {
      graphqlInFlight.delete(cacheKey);
    }
  }
}

export async function fetchPlayerLevels(): Promise<Array<{ level: number; exp: number; levelBadgeImageLink?: string }>> {
  const query = `query PlayerLevels { playerLevels { level exp levelBadgeImageLink } }`;
  const data = await graphqlFetch<{ playerLevels: Array<{ level: number; exp: number; levelBadgeImageLink?: string }> }>(query);
  return data.playerLevels ?? [];
}

const itemNameCache: Record<string, string> = {};
const itemMetaCache: Record<string, { name: string; width?: number; height?: number; baseImageLink?: string; gridImageLink?: string }> = {};

function getItemNameCacheKey(tpl: string, language: Language): string {
  return `${language}:${tpl}`;
}

function getItemMetaCacheKey(tpl: string, language: Language): string {
  return `${language}:${tpl}`;
}

export async function searchItems(name: string, language: Language = 'en'): Promise<ItemSearchResult[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const cacheKey = getItemSearchCacheKey(trimmed, language);
  const cached = getCachedItemSearchResults(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = itemSearchInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const query = `query ItemSearch($name: String, $lang: LanguageCode) {
    items(name: $name, lang: $lang) {
      id
      name
      shortName
      basePrice
      avg24hPrice
      lastLowPrice
      changeLast48hPercent
      iconLink
      gridImageLink
      baseImageLink
      category { name }
    }
  }`;
  const task = (async () => {
    const data = await graphqlFetch<{ items: ItemSearchResult[] }>(query, { name: trimmed, lang: language });
    const rawResults = data.items ?? [];
    const results = filterAndRankItemSearchResults(rawResults, trimmed);
    setCachedItemSearchResults(cacheKey, results);
    return results;
  })();

  itemSearchInFlight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    if (itemSearchInFlight.get(cacheKey) === task) {
      itemSearchInFlight.delete(cacheKey);
    }
  }
}

export async function fetchItemDetail(id: string, language: Language = 'en'): Promise<ItemDetail | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const query = `query ItemDetailByIds($ids: [ID!], $lang: LanguageCode) {
    items(ids: $ids, lang: $lang) {
      id
      name
      normalizedName
      shortName
      description
      basePrice
      avg24hPrice
      lastLowPrice
      changeLast48hPercent
      iconLink
      gridImageLink
      baseImageLink
      inspectImageLink
      image512pxLink
      image8xLink
      types
      width
      height
      weight
      accuracyModifier
      recoilModifier
      ergonomicsModifier
      loudness
      velocity
      blocksHeadphones
      fleaMarketFee
      minLevelForFlea
      lastOfferCount
      low24hPrice
      high24hPrice
      changeLast48h
      properties {
        __typename
        ... on ItemPropertiesAmmo {
          caliber
          stackMaxSize
          tracer
          ammoType
          projectileCount
          damage
          armorDamage
          fragmentationChance
          ricochetChance
          penetrationChance
          penetrationPower
          penetrationPowerDeviation
          initialSpeed
          lightBleedModifier
          heavyBleedModifier
          durabilityBurnFactor
          heatFactor
          staminaBurnPerDamage
          misfireChance
          failureToFeedChance
        }
        ... on ItemPropertiesArmor {
          class
          durability
          repairCost
          speedPenalty
          turnPenalty
          ergoPenalty
          zones
          armorType
          bluntThroughput
        }
        ... on ItemPropertiesArmorAttachment {
          class
          durability
          repairCost
          speedPenalty
          turnPenalty
          ergoPenalty
          zones
          armorType
          blindnessProtection
          bluntThroughput
        }
        ... on ItemPropertiesBackpack {
          capacity
          speedPenalty
          turnPenalty
          ergoPenalty
        }
        ... on ItemPropertiesChestRig {
          class
          durability
          repairCost
          speedPenalty
          turnPenalty
          ergoPenalty
          capacity
          armorType
          bluntThroughput
          zones
        }
        ... on ItemPropertiesContainer {
          capacity
        }
        ... on ItemPropertiesFoodDrink {
          energy
          hydration
          units
        }
        ... on ItemPropertiesGrenade {
          type
          fuse
          minExplosionDistance
          maxExplosionDistance
          fragments
          contusionRadius
        }
        ... on ItemPropertiesHelmet {
          class
          durability
          repairCost
          speedPenalty
          turnPenalty
          ergoPenalty
          headZones
          deafening
          blocksHeadset
          blindnessProtection
          armorType
          bluntThroughput
        }
        ... on ItemPropertiesKey {
          uses
        }
        ... on ItemPropertiesMagazine {
          capacity
          loadModifier
          ammoCheckModifier
          malfunctionChance
        }
        ... on ItemPropertiesMedicalItem {
          uses
          useTime
          cures
        }
        ... on ItemPropertiesMedKit {
          hitpoints
          useTime
          maxHealPerUse
          cures
          hpCostLightBleeding
          hpCostHeavyBleeding
        }
        ... on ItemPropertiesPainkiller {
          uses
          useTime
          cures
          painkillerDuration
          energyImpact
          hydrationImpact
        }
        ... on ItemPropertiesResource {
          units
        }
        ... on ItemPropertiesSurgicalKit {
          uses
          useTime
          cures
          minLimbHealth
          maxLimbHealth
        }
        ... on ItemPropertiesStim {
          useTime
          cures
        }
        ... on ItemPropertiesWeapon {
          caliber
          effectiveDistance
          fireModes
          fireRate
          maxDurability
          recoilVertical
          recoilHorizontal
          repairCost
          sightingRange
        }
      }
      category { name }
      sellFor {
        price
        priceRUB
        currency
        source
        vendor { name normalizedName }
      }
      buyFor {
        price
        priceRUB
        currency
        source
        vendor { name normalizedName }
      }
      historicalPrices {
        price
        priceMin
        offerCount
        offerCountMin
        timestamp
      }
    }
  }`;
  const fetchByLanguage = async (lang: Language): Promise<ItemDetail | null> => {
    const data = await graphqlFetch<{ items?: ItemDetail[] }>(query, { ids: [trimmed], lang });
    return data.items?.[0] ?? null;
  };

  try {
    const exact = await fetchByLanguage(language);
    if (exact) return exact;
  } catch (error) {
    console.log('[TarkovAPI] Item detail fetch failed (language):', error);
  }

  if (language !== 'en') {
    try {
      const fallbackEn = await fetchByLanguage('en');
      if (fallbackEn) return fallbackEn;
    } catch (error) {
      console.log('[TarkovAPI] Item detail fetch failed (english fallback):', error);
    }
  }

  let meta = (await fetchItemMetaByTpls([trimmed], language))[trimmed];
  if (!meta && language !== 'en') {
    meta = (await fetchItemMetaByTpls([trimmed], 'en'))[trimmed];
  }

  if (meta) {
    return {
      id: trimmed,
      name: meta.name,
      normalizedName: meta.name.toLowerCase(),
      shortName: meta.name,
      iconLink: getItemImageURL(trimmed),
      gridImageLink: meta.gridImageLink,
      baseImageLink: meta.baseImageLink,
      buyFor: [],
      sellFor: [],
      historicalPrices: [],
    };
  }

  return {
    id: trimmed,
    name: trimmed,
    normalizedName: trimmed.toLowerCase(),
    shortName: trimmed.slice(-8),
    iconLink: getItemImageURL(trimmed),
    buyFor: [],
    sellFor: [],
    historicalPrices: [],
  };
}

async function fetchItemMetaFromAssets(
  tpl: string,
  language: Language,
): Promise<{ name: string; width?: number; height?: number; baseImageLink?: string; gridImageLink?: string } | null> {
  const cacheKey = getItemMetaCacheKey(tpl, language);
  if (itemMetaCache[cacheKey]) return itemMetaCache[cacheKey];
  const url = `${ITEM_META_BASE_URL}/${tpl}.json`;
  try {
    const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 20000);
    if (!response.ok) return null;
    const data = await response.json() as {
      name?: string;
      shortName?: string;
      width?: number;
      height?: number;
      baseImageLink?: string;
      gridImageLink?: string;
    };
    const name = data.shortName || data.name;
    if (name) {
      const meta = {
        name,
        width: data.width,
        height: data.height,
        baseImageLink: data.baseImageLink,
        gridImageLink: data.gridImageLink,
      };
      itemMetaCache[cacheKey] = meta;
      itemNameCache[getItemNameCacheKey(tpl, language)] = name;
      return meta;
    }
  } catch (error) {
    console.log('[TarkovAPI] Item meta fetch failed:', error);
  }
  return null;
}

async function fetchItemNameByTpl(tpl: string, language: Language): Promise<string | null> {
  const cacheKey = getItemNameCacheKey(tpl, language);
  if (itemNameCache[cacheKey]) return itemNameCache[cacheKey];
  const meta = await fetchItemMetaFromAssets(tpl, language);
  return meta?.name ?? null;
}

export async function fetchItemNamesByTpls(tpls: string[], language: Language = 'en'): Promise<Record<string, string>> {
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
    const query = `query ItemNames($ids: [ID!], $lang: LanguageCode) { items(ids: $ids, lang: $lang) { id name shortName } }`;
    const chunks = chunkArray(missing, GRAPHQL_CHUNK_SIZE);
    const chunkResults = await mapWithConcurrency(
      chunks,
      GRAPHQL_CHUNK_FETCH_CONCURRENCY,
      async (chunk) => {
        try {
          const data = await graphqlFetch<{ items: Array<{ id: string; name: string; shortName?: string }> }>(query, {
            ids: chunk,
            lang: language,
          });
          return data.items ?? [];
        } catch (error) {
          console.log('[TarkovAPI] GraphQL item name fetch failed:', error);
          return [] as Array<{ id: string; name: string; shortName?: string }>;
        }
      },
    );
    for (const chunkItems of chunkResults) {
      for (const item of chunkItems) {
        const name = item.shortName || item.name;
        if (name) {
          const cacheKey = getItemNameCacheKey(item.id, language);
          itemNameCache[cacheKey] = name;
          cached[item.id] = name;
        }
      }
    }
  }

  const stillMissing = unique.filter((tpl) => !cached[tpl]);
  if (stillMissing.length > 0) {
    const fallbackEntries = await mapWithConcurrency(
      stillMissing,
      ASSET_FETCH_CONCURRENCY,
      async (tpl) => {
        const name = await fetchItemNameByTpl(tpl, language);
        return [tpl, name ?? ''] as const;
      },
    );
    for (const [tpl, name] of fallbackEntries) {
      if (name) cached[tpl] = name;
    }
  }

  if (language !== 'en') {
    const unresolved = unique.filter((tpl) => !cached[tpl]);
    if (unresolved.length > 0) {
      const englishFallback = await fetchItemNamesByTpls(unresolved, 'en');
      for (const tpl of unresolved) {
        const name = englishFallback[tpl];
        if (!name) continue;
        cached[tpl] = name;
        itemNameCache[getItemNameCacheKey(tpl, language)] = name;
      }
    }
  }

  return cached;
}

export async function fetchItemMetaByTpls(
  tpls: string[],
  language: Language = 'en',
): Promise<Record<string, { name: string; width?: number; height?: number; baseImageLink?: string; gridImageLink?: string }>> {
  const unique = Array.from(new Set(tpls)).filter(Boolean);
  if (unique.length === 0) return {};

  const cached: Record<string, { name: string; width?: number; height?: number; baseImageLink?: string; gridImageLink?: string }> = {};
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
    const query = `query ItemMeta($ids: [ID!], $lang: LanguageCode) {
      items(ids: $ids, lang: $lang) {
        id
        name
        shortName
        width
        height
        baseImageLink
        gridImageLink
      }
    }`;
    const chunks = chunkArray(missing, GRAPHQL_CHUNK_SIZE);
    const chunkResults = await mapWithConcurrency(
      chunks,
      GRAPHQL_CHUNK_FETCH_CONCURRENCY,
      async (chunk) => {
        try {
          const data = await graphqlFetch<{
            items: Array<{
              id: string;
              name: string;
              shortName?: string;
              width?: number;
              height?: number;
              baseImageLink?: string;
              gridImageLink?: string;
            }>;
          }>(query, {
            ids: chunk,
            lang: language,
          });
          return data.items ?? [];
        } catch (error) {
          console.log('[TarkovAPI] GraphQL item meta fetch failed:', error);
          return [] as Array<{
            id: string;
            name: string;
            shortName?: string;
            width?: number;
            height?: number;
            baseImageLink?: string;
            gridImageLink?: string;
          }>;
        }
      },
    );
    for (const chunkItems of chunkResults) {
      for (const item of chunkItems) {
        const name = item.shortName || item.name;
        if (name) {
          const meta = {
            name,
            width: item.width,
            height: item.height,
            baseImageLink: item.baseImageLink,
            gridImageLink: item.gridImageLink,
          };
          const cacheKey = getItemMetaCacheKey(item.id, language);
          itemMetaCache[cacheKey] = meta;
          itemNameCache[getItemNameCacheKey(item.id, language)] = name;
          cached[item.id] = meta;
        }
      }
    }
  }

  const stillMissing = unique.filter((tpl) => !cached[tpl]);
  if (stillMissing.length > 0) {
    const fallbackEntries = await mapWithConcurrency(
      stillMissing,
      ASSET_FETCH_CONCURRENCY,
      async (tpl) => {
        const meta = await fetchItemMetaFromAssets(tpl, language);
        return [tpl, meta ?? null] as const;
      },
    );
    for (const [tpl, meta] of fallbackEntries) {
      if (meta?.name) {
        const cacheKey = getItemMetaCacheKey(tpl, language);
        itemMetaCache[cacheKey] = meta;
        cached[tpl] = meta;
      }
    }
  }

  if (language !== 'en') {
    const unresolved = unique.filter((tpl) => !cached[tpl]);
    if (unresolved.length > 0) {
      const englishFallback = await fetchItemMetaByTpls(unresolved, 'en');
      for (const tpl of unresolved) {
        const meta = englishFallback[tpl];
        if (!meta?.name) continue;
        const cacheKey = getItemMetaCacheKey(tpl, language);
        itemMetaCache[cacheKey] = meta;
        itemNameCache[getItemNameCacheKey(tpl, language)] = meta.name;
        cached[tpl] = meta;
      }
    }
  }

  return cached;
}

export async function fetchItemNamesByIds(ids: string[], language: Language): Promise<Record<string, string>> {
  // Deprecated: keep for compatibility; prefer fetchItemNamesByTpls.
  void ids;
  void language;
  return {};
}

export async function fetchTasks(language: Language = 'en'): Promise<TaskDetail[]> {
  const query = `query Tasks($lang: LanguageCode, $gameMode: GameMode) {
    tasks(lang: $lang, gameMode: $gameMode) {
      id
      name
      normalizedName
      trader {
        id
        name
        normalizedName
        imageLink
      }
      map {
        id
        name
        normalizedName
      }
      experience
      wikiLink
      taskImageLink
      minPlayerLevel
      taskRequirements {
        task {
          id
          name
          normalizedName
        }
        status
      }
      traderRequirements {
        trader {
          id
          name
          normalizedName
          imageLink
        }
        requirementType
        compareMethod
        value
      }
      restartable
      objectives {
        id
        __typename
        type
        description
        optional
        maps {
          id
          name
          normalizedName
        }
        ... on TaskObjectiveItem {
          count
          items {
            id
            name
            shortName
            iconLink
          }
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveBuildItem {
          item {
            id
            name
            shortName
            iconLink
          }
          containsAll {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveMark {
          markerItem {
            id
            name
            shortName
            iconLink
          }
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveUseItem {
          count
          useAny {
            id
            name
            shortName
            iconLink
          }
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveShoot {
          usingWeapon {
            id
            name
            shortName
            iconLink
          }
          usingWeaponMods {
            id
            name
            shortName
            iconLink
          }
          wearing {
            id
            name
            shortName
            iconLink
          }
          notWearing {
            id
            name
            shortName
            iconLink
          }
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveBasic {
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveExtract {
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveQuestItem {
          count
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
      }
      failConditions {
        id
        __typename
        type
        description
        optional
        maps {
          id
          name
          normalizedName
        }
        ... on TaskObjectiveItem {
          count
          items {
            id
            name
            shortName
            iconLink
          }
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveBuildItem {
          item {
            id
            name
            shortName
            iconLink
          }
          containsAll {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveMark {
          markerItem {
            id
            name
            shortName
            iconLink
          }
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveUseItem {
          count
          useAny {
            id
            name
            shortName
            iconLink
          }
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveShoot {
          usingWeapon {
            id
            name
            shortName
            iconLink
          }
          usingWeaponMods {
            id
            name
            shortName
            iconLink
          }
          wearing {
            id
            name
            shortName
            iconLink
          }
          notWearing {
            id
            name
            shortName
            iconLink
          }
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveBasic {
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveExtract {
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
        ... on TaskObjectiveQuestItem {
          count
          requiredKeys {
            id
            name
            shortName
            iconLink
          }
        }
      }
      startRewards {
        traderStanding {
          trader {
            id
            name
            normalizedName
            imageLink
          }
          standing
        }
        items {
          item {
            id
            name
            shortName
            iconLink
          }
          count
        }
        skillLevelReward {
          name
          level
        }
      }
      finishRewards {
        traderStanding {
          trader {
            id
            name
            normalizedName
            imageLink
          }
          standing
        }
        items {
          item {
            id
            name
            shortName
            iconLink
          }
          count
        }
        skillLevelReward {
          name
          level
        }
      }
      failureOutcome {
        traderStanding {
          trader {
            id
            name
            normalizedName
            imageLink
          }
          standing
        }
        items {
          item {
            id
            name
            shortName
            iconLink
          }
          count
        }
        skillLevelReward {
          name
          level
        }
      }
      factionName
      kappaRequired
      lightkeeperRequired
    }
  }`;
  const data = await graphqlFetch<{ tasks: TaskDetail[] }>(query, { lang: language, gameMode: 'regular' });
  return data.tasks ?? [];
}

export async function fetchTaskById(taskId: string, language: Language = 'en'): Promise<TaskDetail | null> {
  const trimmed = String(taskId || '').trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  const tasks = await fetchTasks(language);
  return tasks.find((task) => {
    return (
      task.id === trimmed ||
      task.normalizedName === trimmed ||
      task.normalizedName?.toLowerCase() === normalized
    );
  }) ?? null;
}

export async function fetchTraders(language: Language = 'en'): Promise<TraderDetail[]> {
  const query = `query Traders($lang: LanguageCode, $gameMode: GameMode) {
    traders(lang: $lang, gameMode: $gameMode) {
      id
      name
      normalizedName
      description
      resetTime
      imageLink
      image4xLink
      levels {
        id
        level
        requiredPlayerLevel
        requiredReputation
        requiredCommerce
      }
    }
  }`;
  const data = await graphqlFetch<{ traders: TraderDetail[] }>(query, { lang: language, gameMode: 'regular' });
  return data.traders ?? [];
}

async function fetchTraderWithOffersByOffset(
  language: Language,
  offset: number,
): Promise<TraderDetail | null> {
  if (!Number.isFinite(offset) || offset < 0) return null;
  const cacheKey = `${language}:${offset}`;
  const cached = traderDetailCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const query = `query TraderWithOffers($lang: LanguageCode, $gameMode: GameMode, $limit: Int, $offset: Int) {
    traders(lang: $lang, gameMode: $gameMode, limit: $limit, offset: $offset) {
      id
      name
      normalizedName
      description
      resetTime
      imageLink
      image4xLink
      levels {
        id
        level
        requiredPlayerLevel
        requiredReputation
        requiredCommerce
        cashOffers {
          id
          minTraderLevel
          price
          currency
          priceRUB
          buyLimit
          item {
            id
            name
            shortName
            iconLink
            wikiLink
            types
            category {
              name
            }
          }
          currencyItem {
            id
            name
            shortName
            iconLink
            wikiLink
            types
            category {
              name
            }
          }
          taskUnlock {
            id
            name
            normalizedName
          }
        }
      }
      barters {
        id
        level
        buyLimit
        taskUnlock {
          id
          name
          normalizedName
        }
        requiredItems {
          count
          quantity
          item {
            id
            name
            shortName
            iconLink
            wikiLink
            types
            category {
              name
            }
          }
        }
        rewardItems {
          count
          quantity
          item {
            id
            name
            shortName
            iconLink
            wikiLink
            types
            category {
              name
            }
          }
        }
      }
    }
  }`;

  const data = await graphqlFetch<{ traders: TraderDetail[] }>(query, {
    lang: language,
    gameMode: 'regular',
    limit: 1,
    offset,
  });
  const trader = data.traders?.[0] ?? null;
  if (!trader) return null;
  traderDetailCache.set(cacheKey, {
    expiresAt: Date.now() + TRADER_DETAIL_CACHE_TTL_MS,
    data: trader,
  });
  return trader;
}

export async function fetchTraderById(
  traderIdOrName: string,
  language: Language = 'en',
): Promise<TraderDetail | null> {
  const trimmed = String(traderIdOrName || '').trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  const isMatch = (trader: TraderDetail): boolean => (
    trader.id === trimmed ||
    trader.normalizedName === trimmed ||
    trader.normalizedName?.toLowerCase() === normalized ||
    trader.name.toLowerCase() === normalized
  );

  const traders = await fetchTraders(language);
  const summaryIndex = traders.findIndex(isMatch);
  if (summaryIndex < 0) return null;

  const summaryTrader = traders[summaryIndex];
  const directHit = await fetchTraderWithOffersByOffset(language, summaryIndex);
  if (directHit && isMatch(directHit)) return directHit;

  for (let i = 0; i < traders.length; i += 1) {
    if (i === summaryIndex) continue;
    const probe = await fetchTraderWithOffersByOffset(language, i);
    if (probe && isMatch(probe)) return probe;
  }

  return summaryTrader ?? null;
}

export async function fetchSkills(language: Language = 'en'): Promise<Array<{ id: string; name: string }>> {
  const query = `query Skills($lang: LanguageCode) { skills(lang: $lang) { id name } }`;
  const data = await graphqlFetch<{ skills: Array<{ id: string; name: string }> }>(query, { lang: language });
  return data.skills ?? [];
}

export async function fetchAchievements(
  language: Language = 'en',
): Promise<Array<{ id: string; name: string; rarity?: string; normalizedRarity?: string }>> {
  const query = `query Achievements($lang: LanguageCode) {
    achievements(lang: $lang) {
      id
      name
      rarity
      normalizedRarity
    }
  }`;
  const data = await graphqlFetch<{
    achievements: Array<{ id: string; name: string; rarity?: string; normalizedRarity?: string }>;
  }>(query, { lang: language });
  return data.achievements ?? [];
}

export async function fetchHideoutStations(): Promise<Array<{ id: string; name: string }>> {
  const query = `query HideoutStations { hideoutStations { id name } }`;
  const data = await graphqlFetch<{ hideoutStations: Array<{ id: string; name: string }> }>(query);
  return data.hideoutStations ?? [];
}
