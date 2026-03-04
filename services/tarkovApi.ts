import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BossContainedItem,
  BossDetail,
  BossEquipmentSet,
  BossEscort,
  BossLootItem,
  BossMapSpawn,
  BossSpawnEntry,
  BossSpawnLocation,
  ItemDetail,
  ItemCategoryNode,
  ItemSearchResult,
  PlayerProfile,
  SearchResult,
  TaskDetail,
  TraderDetail,
  getItemImageURL,
} from '@/types/tarkov';
import { DEFAULT_GAME_MODE, GameMode, normalizeGameMode } from '@/constants/gameMode';
import { Language } from '@/constants/i18n';
import { logInfo, logWarn } from '@/utils/debugLog';

const PLAYER_SEARCH_BASE_URL = 'https://player.tarkov.dev';
const PLAYER_PROFILE_STATIC_BASE_URL = 'https://players.tarkov.dev/profile';
const GRAPHQL_URL = 'https://api.tarkov.dev/graphql';
const ITEM_META_BASE_URL = 'https://assets.tarkov.dev';
const PLAYER_SEARCH_TOKEN_KEY = 'tarkov_player_search_token';
const PLAYER_SEARCH_TOKEN_UPDATED_AT_KEY = 'tarkov_player_search_token_updated_at';
const PLAYER_PROFILE_PERSIST_KEY_PREFIX = 'tarkov_profile_cache';
const TURNSTILE_ERROR_CODE = 'TURNSTILE_REQUIRED';
const PLAYER_SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;
const PLAYER_SEARCH_CACHE_LIMIT = 120;
const PLAYER_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const PLAYER_PROFILE_CACHE_LIMIT = 60;
const PLAYER_PROFILE_PERSIST_TTL_MS = 24 * 60 * 60 * 1000;
const ITEM_SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const ITEM_SEARCH_CACHE_LIMIT = 120;
const PLAYER_SEARCH_WARMUP_QUERY = 'zzzx';
const PLAYER_SEARCH_WARMUP_MIN_GAP_MS = 8 * 60 * 1000;
const TRADER_DETAIL_CACHE_TTL_MS = 5 * 60 * 1000;
const BOSS_MAP_CONTEXT_CACHE_TTL_MS = 10 * 60 * 1000;
const BOSS_HYDRATED_ITEM_CACHE_TTL_MS = 30 * 60 * 1000;
const PROFILE_CACHE_MODES: GameMode[] = ['regular', 'pve'];

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
let activeGameMode: GameMode = DEFAULT_GAME_MODE;

function resolveGameMode(gameMode?: GameMode): GameMode {
  return normalizeGameMode(gameMode ?? activeGameMode);
}

export function setApiGameMode(gameMode: GameMode): void {
  activeGameMode = normalizeGameMode(gameMode);
}

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
  const timeoutController = new AbortController();
  const requestController = new AbortController();
  const externalSignal = options.signal;

  const forwardAbort = () => {
    if (!requestController.signal.aborted) {
      requestController.abort();
    }
  };

  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  timeoutController.signal.addEventListener('abort', forwardAbort);

  if (externalSignal) {
    if (externalSignal.aborted) {
      forwardAbort();
    } else {
      externalSignal.addEventListener('abort', forwardAbort);
    }
  }

  return fetch(url, { ...options, signal: requestController.signal }).finally(() => {
    clearTimeout(timer);
    timeoutController.signal.removeEventListener('abort', forwardAbort);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', forwardAbort);
    }
  });
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
const playerSearchWarmupAt = new Map<GameMode, number>();
const playerSearchWarmupPromise = new Map<GameMode, Promise<void>>();
const playerSearchWarmupController = new Map<GameMode, AbortController>();
const traderDetailCache = new Map<string, { expiresAt: number; data: TraderDetail }>();
const bossMapSpawnContextCache = new Map<string, { expiresAt: number; data: BossMapSpawnContext }>();
const bossHydratedItemCache = new Map<string, { expiresAt: number; data: RawHydratedBossItem }>();

type RequestPriority = 'foreground' | 'background';

function createAbortError(): Error {
  const error = new Error('Request aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function withAbortSignal<T>(task: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return task;
  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
    };
    signal.addEventListener('abort', onAbort);
    task
      .then((value) => {
        cleanup();
        resolve(value);
      })
      .catch((error) => {
        cleanup();
        reject(error);
      });
  });
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof Error) {
    const name = String(error.name || '').toLowerCase();
    const message = String(error.message || '').toLowerCase();
    return name.includes('abort') || message.includes('abort');
  }
  return false;
}

function cancelPlayerSearchWarmup(): void {
  for (const controller of playerSearchWarmupController.values()) {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  }
  playerSearchWarmupController.clear();
}

function markRequestPriority(priority: RequestPriority = 'foreground'): void {
  if (priority === 'foreground') {
    cancelPlayerSearchWarmup();
  }
}

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

function getPlayerProfileCacheKey(accountId: string, gameMode: GameMode): string {
  return `${gameMode}:${accountId}`;
}

function getPersistedPlayerProfileKey(accountId: string, gameMode: GameMode): string {
  return `${PLAYER_PROFILE_PERSIST_KEY_PREFIX}_${gameMode}_${accountId}`;
}

async function loadPersistedPlayerProfile(
  accountId: string,
  gameMode: GameMode,
): Promise<PlayerProfile | null> {
  const storageKey = getPersistedPlayerProfileKey(accountId, gameMode);
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { updatedAt?: number; profile?: PlayerProfile };
    const updatedAt = Number(parsed?.updatedAt || 0);
    const profile = parsed?.profile;
    if (!profile || !profile.info?.nickname) {
      void AsyncStorage.removeItem(storageKey);
      return null;
    }
    if (!Number.isFinite(updatedAt) || updatedAt <= 0 || updatedAt + PLAYER_PROFILE_PERSIST_TTL_MS < Date.now()) {
      void AsyncStorage.removeItem(storageKey);
      return null;
    }
    return profile;
  } catch {
    return null;
  }
}

async function savePersistedPlayerProfile(
  accountId: string,
  gameMode: GameMode,
  profile: PlayerProfile,
): Promise<void> {
  const storageKey = getPersistedPlayerProfileKey(accountId, gameMode);
  try {
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        updatedAt: Date.now(),
        profile,
      }),
    );
  } catch {
    // Ignore persistence failures and keep runtime flow unaffected.
  }
}

async function fetchPlayerProfileWithModeApi(
  accountId: string,
  gameMode: GameMode,
  token: string,
  signal?: AbortSignal,
): Promise<PlayerProfile> {
  const query = new URLSearchParams();
  query.set('gameMode', gameMode);
  query.set('token', token.trim());
  const requestUrl = `${PLAYER_SEARCH_BASE_URL}/account/${encodeURIComponent(accountId)}?${query.toString()}`;
  const response = await apiFetch(
    requestUrl,
    {
      method: 'GET',
      signal,
    },
    30000,
  );

  if (response.status === 401) {
    await clearPlayerSearchToken();
    throw createTurnstileError();
  }
  if (response.status === 404) {
    throw new Error('Player not found');
  }
  if (response.status === 429) {
    throw new PlayerSearchError(
      'Rate limited exceeded. Wait a minute to send another request.',
    );
  }
  if (!response.ok) {
    const message = await readPlayerSearchErrorMessage(response);
    if (isTurnstileFailureMessage(message)) {
      await clearPlayerSearchToken();
      throw createTurnstileError();
    }
    throw new Error(message || `Player profile failed: ${response.status}`);
  }

  const payload = await response.json();
  if ((payload as any)?.err) {
    const message = String((payload as any)?.errmsg || (payload as any)?.message || 'Unexpected error');
    if (isTurnstileFailureMessage(message)) {
      await clearPlayerSearchToken();
      throw createTurnstileError();
    }
    throw new Error(message);
  }

  return payload as PlayerProfile;
}

async function fetchPlayerProfileStaticApi(
  accountId: string,
  signal?: AbortSignal,
): Promise<PlayerProfile> {
  const requestUrl = `${PLAYER_PROFILE_STATIC_BASE_URL}/${encodeURIComponent(accountId)}.json`;
  const response = await apiFetch(
    requestUrl,
    {
      method: 'GET',
      signal,
    },
    30000,
  );

  if (response.status === 404) {
    throw new Error('Player not found');
  }
  if (!response.ok) {
    throw new Error(`Player profile failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== 'object' || !(payload as any)?.info?.nickname) {
    throw new Error('Invalid player profile payload');
  }
  return payload as PlayerProfile;
}

async function fetchPlayerProfileWithoutTokenApi(
  accountId: string,
  gameMode: GameMode,
  signal?: AbortSignal,
): Promise<PlayerProfile> {
  const query = new URLSearchParams();
  if (gameMode !== 'regular') {
    query.set('gameMode', gameMode);
  }
  const requestUrl = `${PLAYER_SEARCH_BASE_URL}/account/${encodeURIComponent(accountId)}${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await apiFetch(
    requestUrl,
    {
      method: 'GET',
      signal,
    },
    30000,
  );

  if (response.status === 401) {
    throw createTurnstileError();
  }
  if (response.status === 404) {
    throw new Error('Player not found');
  }
  if (response.status === 429) {
    throw new PlayerSearchError(
      'Rate limited exceeded. Wait a minute to send another request.',
    );
  }
  if (!response.ok) {
    const message = await readPlayerSearchErrorMessage(response);
    if (isTurnstileFailureMessage(message)) {
      throw createTurnstileError();
    }
    throw new Error(message || `Player profile failed: ${response.status}`);
  }

  const payload = await response.json();
  if ((payload as any)?.err) {
    const message = String((payload as any)?.errmsg || (payload as any)?.message || 'Unexpected error');
    if (isTurnstileFailureMessage(message)) {
      throw createTurnstileError();
    }
    throw new Error(message);
  }

  return payload as PlayerProfile;
}

export function clearPlayerProfileCache(
  accountId?: string,
  options?: { gameMode?: GameMode },
): void {
  const trimmed = String(accountId || '').trim();
  if (trimmed) {
    const mode = options?.gameMode ? resolveGameMode(options.gameMode) : null;
    if (mode) {
      const cacheKey = getPlayerProfileCacheKey(trimmed, mode);
      playerProfileCache.delete(cacheKey);
      playerProfileInFlight.delete(cacheKey);
      void AsyncStorage.removeItem(getPersistedPlayerProfileKey(trimmed, mode));
      return;
    }
    for (const cacheMode of PROFILE_CACHE_MODES) {
      const cacheKey = getPlayerProfileCacheKey(trimmed, cacheMode);
      playerProfileCache.delete(cacheKey);
      playerProfileInFlight.delete(cacheKey);
      void AsyncStorage.removeItem(getPersistedPlayerProfileKey(trimmed, cacheMode));
    }
    // Backward compatibility with legacy cache keys without game mode prefix.
    playerProfileCache.delete(trimmed);
    playerProfileInFlight.delete(trimmed);
    return;
  }
  playerProfileCache.clear();
  playerProfileInFlight.clear();
}

export async function fetchPlayerProfile(
  accountId: string,
  options?: { force?: boolean; signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<PlayerProfile> {
  const trimmed = String(accountId || '').trim();
  if (!trimmed) {
    throw new Error('Invalid account id');
  }

  const force = options?.force === true;
  const signal = options?.signal;
  const gameMode = resolveGameMode(options?.gameMode);
  const cacheKey = getPlayerProfileCacheKey(trimmed, gameMode);
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);

  if (force) {
    clearPlayerProfileCache(trimmed, { gameMode });
  }

  if (!force) {
    const cached = playerProfileCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }
    if (cached) {
      playerProfileCache.delete(cacheKey);
    }
  }

  if (!force && !signal) {
    const inFlight = playerProfileInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const task = (async () => {
    console.log('[TarkovAPI] Fetching profile for:', trimmed, gameMode);
    throwIfAborted(signal);

    if (!force) {
      const persisted = await loadPersistedPlayerProfile(trimmed, gameMode);
      if (persisted) {
        if (playerProfileCache.size >= PLAYER_PROFILE_CACHE_LIMIT) {
          const firstKey = playerProfileCache.keys().next().value as string | undefined;
          if (firstKey) playerProfileCache.delete(firstKey);
        }
        playerProfileCache.set(cacheKey, {
          expiresAt: Date.now() + PLAYER_PROFILE_CACHE_TTL_MS,
          profile: persisted,
        });
        return persisted;
      }
    }

    let profile: PlayerProfile;
    if (gameMode === 'regular') {
      // PvP: use legacy static profile endpoint to avoid Turnstile/token gating.
      profile = await fetchPlayerProfileStaticApi(trimmed, signal);
    } else {
      // PvE: first try tokenless endpoint; only fall back to strict mode when required.
      try {
        profile = await fetchPlayerProfileWithoutTokenApi(trimmed, gameMode, signal);
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        const token = await getPlayerSearchToken();
        const normalizedToken = token?.trim();
        if (!normalizedToken) {
          if (isTurnstileRequiredError(error)) {
            throw error;
          }
          throw error;
        }
        profile = await fetchPlayerProfileWithModeApi(trimmed, gameMode, normalizedToken, signal);
      }
    }

    console.log('[TarkovAPI] Profile loaded:', profile?.info?.nickname);
    if (playerProfileCache.size >= PLAYER_PROFILE_CACHE_LIMIT) {
      const firstKey = playerProfileCache.keys().next().value as string | undefined;
      if (firstKey) playerProfileCache.delete(firstKey);
    }
    playerProfileCache.set(cacheKey, {
      expiresAt: Date.now() + PLAYER_PROFILE_CACHE_TTL_MS,
      profile,
    });
    void savePersistedPlayerProfile(trimmed, gameMode, profile);
    return profile;
  })();

  if (!signal) {
    playerProfileInFlight.set(cacheKey, task);
  }
  try {
    return await task;
  } finally {
    if (!signal && playerProfileInFlight.get(cacheKey) === task) {
      playerProfileInFlight.delete(cacheKey);
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
  options?: { signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<Response> {
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(options?.signal);
  const gameMode = resolveGameMode(options?.gameMode);
  const query = new URLSearchParams();
  query.set('gameMode', gameMode);
  if (token?.trim()) {
    query.set('token', token.trim());
  }

  const path = `/name/${encodeURIComponent(name)}`;
  const getUrl = `${PLAYER_SEARCH_BASE_URL}${path}?${query.toString()}`;
  return apiFetch(
    getUrl,
    {
      method: 'GET',
      signal: options?.signal,
    },
    30000,
  );
}

async function searchPlayersRemote(
  trimmed: string,
  options?: { signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<SearchResult[]> {
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(options?.signal);
  const token = await getPlayerSearchToken();
  if (!token) {
    logWarn('PlayerSearch', 'Search blocked: token missing', { query: trimmed });
    throw createTurnstileError();
  }

  const response = await requestPlayerSearch(trimmed, token, options);

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

export async function warmupPlayerSearch(
  force: boolean = false,
  options?: { signal?: AbortSignal; gameMode?: GameMode },
): Promise<void> {
  const gameMode = resolveGameMode(options?.gameMode);
  const now = Date.now();
  const lastWarmupAt = playerSearchWarmupAt.get(gameMode) ?? 0;
  if (!force && now - lastWarmupAt < PLAYER_SEARCH_WARMUP_MIN_GAP_MS) {
    return;
  }
  const existingWarmup = playerSearchWarmupPromise.get(gameMode);
  if (existingWarmup) {
    return existingWarmup;
  }

  const warmupTask = (async () => {
    const warmupController = new AbortController();
    playerSearchWarmupController.set(gameMode, warmupController);
    const externalSignal = options?.signal;
    const forwardAbort = () => {
      if (!warmupController.signal.aborted) {
        warmupController.abort();
      }
    };
    if (externalSignal) {
      if (externalSignal.aborted) {
        forwardAbort();
      } else {
        externalSignal.addEventListener('abort', forwardAbort);
      }
    }
    try {
      throwIfAborted(warmupController.signal);
      const token = await getPlayerSearchToken();
      if (!token) {
        logWarn('PlayerSearch', 'Warmup skipped: token missing');
        return;
      }

      const response = await requestPlayerSearch(PLAYER_SEARCH_WARMUP_QUERY, token, {
        signal: warmupController.signal,
        priority: 'background',
        gameMode,
      });
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

      playerSearchWarmupAt.set(gameMode, Date.now());
      console.log('[TarkovAPI] Player search warmup completed');
      logInfo('PlayerSearch', 'Warmup completed');
    } catch (error) {
      if (isAbortError(error)) {
        logInfo('PlayerSearch', 'Warmup canceled');
        return;
      }
      console.log('[TarkovAPI] Player search warmup skipped:', error);
      logWarn('PlayerSearch', 'Warmup skipped', error);
    } finally {
      if (externalSignal) {
        externalSignal.removeEventListener('abort', forwardAbort);
      }
      playerSearchWarmupController.delete(gameMode);
      playerSearchWarmupPromise.delete(gameMode);
    }
  })();

  playerSearchWarmupPromise.set(gameMode, warmupTask);
  return warmupTask;
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

function getItemSearchCacheKey(
  query: string,
  language: Language,
  gameMode: GameMode,
  options?: { limit?: number; offset?: number },
): string {
  const normalizedQuery = query.toLowerCase();
  const rawLimit = options?.limit;
  const rawOffset = options?.offset;
  const hasLimit = Number.isFinite(rawLimit);
  const hasOffset = Number.isFinite(rawOffset) && Number(rawOffset) > 0;
  if (!hasLimit && !hasOffset) {
    return `${gameMode}:${language}:${normalizedQuery}`;
  }
  const limit = hasLimit ? Math.max(1, Math.floor(Number(rawLimit))) : 'all';
  const offset = hasOffset ? Math.max(0, Math.floor(Number(rawOffset))) : 0;
  return `${gameMode}:${language}:${normalizedQuery}:limit:${limit}:offset:${offset}`;
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

export async function searchPlayers(
  name: string,
  options?: { signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<SearchResult[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const signal = options?.signal;
  const gameMode = resolveGameMode(options?.gameMode);
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);

  const cacheKey = `${gameMode}:${trimmed.toLowerCase()}`;
  const cached = getCachedPlayerSearchResults(cacheKey);
  if (cached) {
    console.log('[TarkovAPI] Search cache hit:', cacheKey, cached.length);
    return cached;
  }

  if (!signal) {
    const inFlight = playerSearchInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  console.log('[TarkovAPI] Searching players:', trimmed);
  const task = (async () => {
    const results = await searchPlayersRemote(trimmed, {
      ...options,
      gameMode,
    });
    setCachedPlayerSearchResults(cacheKey, results);
    console.log('[TarkovAPI] Search results:', results.length);
    return results;
  })();

  if (!signal) {
    playerSearchInFlight.set(cacheKey, task);
  }
  try {
    return await task;
  } finally {
    if (!signal && playerSearchInFlight.get(cacheKey) === task) {
      playerSearchInFlight.delete(cacheKey);
    }
  }
}

async function graphqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: { signal?: AbortSignal; priority?: RequestPriority; allowPartialData?: boolean },
): Promise<T> {
  const signal = options?.signal;
  const allowPartialData = options?.allowPartialData === true;
  throwIfAborted(signal);
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
    return withAbortSignal(inFlight as Promise<T>, signal);
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
            signal: undefined,
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
          signal: undefined,
        },
        GRAPHQL_TIMEOUT_MS,
      );
    }

    if (!response.ok) {
      throw new Error(`GraphQL error: ${response.status}`);
    }
    const json = await response.json() as { data?: T; errors?: { message: string }[] };
    if (json.errors?.length) {
      if (allowPartialData && json.data) {
        console.log('[TarkovAPI] GraphQL partial data with errors:', json.errors[0]?.message || 'Unknown GraphQL error');
      } else {
        throw new Error(json.errors[0].message);
      }
    }
    if (!json.data) {
      throw new Error('GraphQL response missing data');
    }

    setGraphqlCacheEntry(cacheKey, json.data);
    return json.data;
  })();

  graphqlInFlight.set(cacheKey, task as Promise<unknown>);
  try {
    return await withAbortSignal(task, signal);
  } finally {
    if (graphqlInFlight.get(cacheKey) === task) {
      graphqlInFlight.delete(cacheKey);
    }
  }
}

export async function fetchPlayerLevels(): Promise<{ level: number; exp: number; levelBadgeImageLink?: string }[]> {
  const query = `query PlayerLevels { playerLevels { level exp levelBadgeImageLink } }`;
  const data = await graphqlFetch<{ playerLevels: { level: number; exp: number; levelBadgeImageLink?: string }[] }>(query);
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

export async function searchItems(
  name: string,
  language: Language = 'en',
  options?: { limit?: number; offset?: number; signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<ItemSearchResult[]> {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const signal = options?.signal;
  const gameMode = resolveGameMode(options?.gameMode);
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);
  const hasLimit = Number.isFinite(options?.limit);
  const hasOffset = Number.isFinite(options?.offset) && Number(options?.offset) > 0;
  const requestLimit = hasLimit ? Math.max(1, Math.floor(Number(options?.limit))) : undefined;
  const requestOffset = hasOffset ? Math.max(0, Math.floor(Number(options?.offset))) : 0;

  const cacheKey = getItemSearchCacheKey(trimmed, language, gameMode, {
    limit: requestLimit,
    offset: requestOffset,
  });
  const cached = getCachedItemSearchResults(cacheKey);
  if (cached) {
    return cached;
  }

  if (!signal) {
    const inFlight = itemSearchInFlight.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const query = `query ItemSearch($name: String, $lang: LanguageCode, $gameMode: GameMode, $limit: Int, $offset: Int) {
    items(name: $name, lang: $lang, gameMode: $gameMode, limit: $limit, offset: $offset) {
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
    const data = await graphqlFetch<{ items: ItemSearchResult[] }>(
      query,
      {
        name: trimmed,
        lang: language,
        gameMode,
        limit: requestLimit ?? null,
        offset: requestOffset > 0 ? requestOffset : null,
      },
      { signal },
    );
    const rawResults = data.items ?? [];
    const results = filterAndRankItemSearchResults(rawResults, trimmed);
    setCachedItemSearchResults(cacheKey, results);
    return results;
  })();

  if (!signal) {
    itemSearchInFlight.set(cacheKey, task);
  }
  try {
    return await task;
  } finally {
    if (!signal && itemSearchInFlight.get(cacheKey) === task) {
      itemSearchInFlight.delete(cacheKey);
    }
  }
}

export async function fetchItemCategories(
  language: Language = 'en',
  options?: { signal?: AbortSignal; priority?: RequestPriority },
): Promise<ItemCategoryNode[]> {
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(options?.signal);
  const query = `query ItemCategories($lang: LanguageCode, $limit: Int) {
    itemCategories(lang: $lang, limit: $limit) {
      name
      normalizedName
      parent {
        name
        normalizedName
      }
      children {
        name
        normalizedName
      }
    }
  }`;
  const data = await graphqlFetch<{ itemCategories?: ItemCategoryNode[] }>(
    query,
    { lang: language, limit: 1000 },
    { signal: options?.signal },
  );
  return data.itemCategories ?? [];
}

export async function searchItemsByCategories(
  options: {
    query?: string;
    categoryNames?: string[];
    language?: Language;
    limit?: number;
    offset?: number;
    signal?: AbortSignal;
    priority?: RequestPriority;
    gameMode?: GameMode;
  },
): Promise<ItemSearchResult[]> {
  const language = options.language ?? 'en';
  const gameMode = resolveGameMode(options.gameMode);
  const signal = options.signal;
  markRequestPriority(options.priority ?? 'foreground');
  throwIfAborted(signal);
  const trimmed = String(options.query || '').trim();
  const normalizeCategoryName = (value: string): string => String(value || '').trim().toLowerCase();
  const categoryNames = Array.from(
    new Set(
      (options.categoryNames ?? [])
        .map((name) => String(name || '').trim())
        .filter(Boolean),
    ),
  );

  if (!trimmed && categoryNames.length === 0) return [];

  const hasExplicitOffset = Number.isFinite(options.offset);
  const requestOffset = hasExplicitOffset
    ? Math.max(0, Math.floor(Number(options.offset)))
    : 0;
  const hasExplicitLimit = Number.isFinite(options.limit);
  const requestLimit = hasExplicitLimit
    ? Math.max(1, Math.floor(Number(options.limit)))
    : 4000;

  if (trimmed && categoryNames.length === 0) {
    return searchItems(trimmed, language, {
      limit: hasExplicitLimit ? requestLimit : undefined,
      offset: hasExplicitOffset ? requestOffset : undefined,
      signal,
      priority: options.priority,
      gameMode,
    });
  }

  const resolveCategoryNamesForLanguage = async (
    names: string[],
    lang: Language,
  ): Promise<string[]> => {
    if (names.length === 0 || lang === 'en') return names;
    try {
      const [enCategories, localizedCategories] = await Promise.all([
        fetchItemCategories('en', { signal }),
        fetchItemCategories(lang, { signal }),
      ]);

      const normalizedByEnglishName = new Map<string, string>();
      for (const category of enCategories) {
        const englishName = String(category.name || '').trim();
        const normalized = normalizeCategoryName(category.normalizedName || englishName);
        if (englishName && normalized) {
          normalizedByEnglishName.set(normalizeCategoryName(englishName), normalized);
        }
      }

      const localizedNameByNormalized = new Map<string, string>();
      for (const category of localizedCategories) {
        const localizedName = String(category.name || '').trim();
        const normalized = normalizeCategoryName(category.normalizedName || localizedName);
        if (localizedName && normalized) {
          localizedNameByNormalized.set(normalized, localizedName);
        }
      }

      const resolvedNames = names.map((name) => {
        const normalizedInput = normalizeCategoryName(name);
        const normalizedCategory = normalizedByEnglishName.get(normalizedInput) || normalizedInput;
        return localizedNameByNormalized.get(normalizedCategory) || name;
      });

      return Array.from(
        new Set(
          resolvedNames
            .map((name) => String(name || '').trim())
            .filter(Boolean),
        ),
      );
    } catch {
      return names;
    }
  };

  const localizedCategoryNames = await resolveCategoryNamesForLanguage(categoryNames, language);
  const getCategoryNamesForLanguage = (lang: Language): string[] => {
    if (categoryNames.length === 0) return categoryNames;
    if (lang === 'en') return categoryNames;
    if (lang === language) return localizedCategoryNames.length > 0 ? localizedCategoryNames : categoryNames;
    return categoryNames;
  };

  const queryByCategoryOnly = `query ItemSearchByCategory(
    $categoryNames: [String!]
    $lang: LanguageCode
    $gameMode: GameMode
    $limit: Int
    $offset: Int
  ) {
    items(categoryNames: $categoryNames, lang: $lang, gameMode: $gameMode, limit: $limit, offset: $offset) {
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

  const queryByCategoryAndName = `query ItemSearchByCategoryAndName(
    $name: String!
    $categoryNames: [String!]
    $lang: LanguageCode
    $gameMode: GameMode
    $limit: Int
    $offset: Int
  ) {
    items(name: $name, categoryNames: $categoryNames, lang: $lang, gameMode: $gameMode, limit: $limit, offset: $offset) {
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

  const requestQuery = trimmed ? queryByCategoryAndName : queryByCategoryOnly;
  const getQueryVariables = (lang: Language, limit: number, offset: number): Record<string, unknown> => {
    const resolvedCategoryNames = getCategoryNamesForLanguage(lang);
    const variables: Record<string, unknown> = {
      categoryNames: resolvedCategoryNames,
      lang,
      gameMode,
      limit,
      offset,
    };
    if (trimmed) {
      variables.name = trimmed;
    }
    return variables;
  };

  const fetchSinglePage = async (
    lang: Language,
    limit: number,
    offset: number,
  ): Promise<ItemSearchResult[]> => {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const data = await graphqlFetch<{ items?: ItemSearchResult[] }>(
          requestQuery,
          getQueryVariables(lang, limit, offset),
          { signal },
        );
        return data.items ?? [];
      } catch (error) {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        lastError = normalizedError;
        const message = normalizedError.message || '';
        const shouldRetry = /unexpected error|timeout|network|fetch failed|503|502|504|500/i.test(message);
        if (!shouldRetry || attempt >= 2) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 160 * (attempt + 1)));
      }
    }
    throw lastError ?? new Error('Category page request failed');
  };

  const fetchCategoryPages = async (
    lang: Language,
    pageSize: number,
  ): Promise<ItemSearchResult[]> => {
    const rows: ItemSearchResult[] = [];
    for (let offset = 0; offset < requestLimit; offset += pageSize) {
      throwIfAborted(signal);
      const currentLimit = Math.min(pageSize, requestLimit - offset);
      let chunk: ItemSearchResult[];
      try {
        chunk = await fetchSinglePage(lang, currentLimit, offset);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const langCategoryNames = getCategoryNamesForLanguage(lang);
        throw new Error(
          `Category request failed at offset ${offset}, limit ${currentLimit}, lang ${lang}, category ${langCategoryNames[0] || '<none>'}: ${message}`,
        );
      }
      rows.push(...chunk);
      if (chunk.length < currentLimit) break;
    }
    return rows;
  };

  const fetchByLanguage = async (lang: Language): Promise<ItemSearchResult[]> => {
    throwIfAborted(signal);
    if (categoryNames.length > 0 && !trimmed) {
      if (hasExplicitOffset) {
        const explicitPageLimits = Array.from(
          new Set(
            [requestLimit, Math.min(requestLimit, 90), Math.min(requestLimit, 60), Math.min(requestLimit, 40)]
              .filter((size) => Number.isFinite(size) && size > 0),
          ),
        );
        let lastError: Error | null = null;
        for (const size of explicitPageLimits) {
          throwIfAborted(signal);
          try {
            return await fetchSinglePage(lang, size, requestOffset);
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
          }
        }
        throw lastError ?? new Error('Category request failed');
      }
      const pageSizes = Array.from(new Set([300, 180, 100].map((size) => Math.min(size, requestLimit))))
        .filter((size) => size > 0);
      let lastError: Error | null = null;
      for (const pageSize of pageSizes) {
        throwIfAborted(signal);
        try {
          return await fetchCategoryPages(lang, pageSize);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      throw lastError ?? new Error('Category request failed');
    }
    return fetchSinglePage(lang, requestLimit, requestOffset);
  };

  let rawResults: ItemSearchResult[] = [];
  try {
    rawResults = await fetchByLanguage(language);
  } catch (error) {
    if (language !== 'en' && categoryNames.length > 0) {
      rawResults = await fetchByLanguage('en');
    } else {
      throw error;
    }
  }

  // Upstream has inconsistent behavior for categoryNames with non-English lang.
  // Fallback to English payload to avoid empty category pages.
  if (rawResults.length === 0 && language !== 'en' && categoryNames.length > 0) {
    rawResults = await fetchByLanguage('en');
  }

  if (trimmed) {
    return filterAndRankItemSearchResults(rawResults, trimmed);
  }

  return [...rawResults].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function fetchItemDetail(
  id: string,
  language: Language = 'en',
  options?: { signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<ItemDetail | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  const signal = options?.signal;
  const gameMode = resolveGameMode(options?.gameMode);
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);
  const query = `query ItemDetailByIds($ids: [ID!], $lang: LanguageCode, $gameMode: GameMode) {
    items(ids: $ids, lang: $lang, gameMode: $gameMode) {
      id
      name
      normalizedName
      shortName
      description
      wikiLink
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
    const data = await graphqlFetch<{ items?: ItemDetail[] }>(
      query,
      { ids: [trimmed], lang, gameMode },
      { signal },
    );
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
      throwIfAborted(signal);
      const fallbackEn = await fetchByLanguage('en');
      if (fallbackEn) return fallbackEn;
    } catch (error) {
      console.log('[TarkovAPI] Item detail fetch failed (english fallback):', error);
    }
  }

  throwIfAborted(signal);
  let meta = (await fetchItemMetaByTpls([trimmed], language))[trimmed];
  if (!meta && language !== 'en') {
    throwIfAborted(signal);
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
          const data = await graphqlFetch<{ items: { id: string; name: string; shortName?: string }[] }>(query, {
            ids: chunk,
            lang: language,
          });
          return data.items ?? [];
        } catch (error) {
          console.log('[TarkovAPI] GraphQL item name fetch failed:', error);
          return [] as { id: string; name: string; shortName?: string }[];
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
            items: {
              id: string;
              name: string;
              shortName?: string;
              width?: number;
              height?: number;
              baseImageLink?: string;
              gridImageLink?: string;
            }[];
          }>(query, {
            ids: chunk,
            lang: language,
          });
          return data.items ?? [];
        } catch (error) {
          console.log('[TarkovAPI] GraphQL item meta fetch failed:', error);
          return [] as {
            id: string;
            name: string;
            shortName?: string;
            width?: number;
            height?: number;
            baseImageLink?: string;
            gridImageLink?: string;
          }[];
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

export async function fetchTaskSummaries(
  language: Language = 'en',
  options?: { limit?: number; offset?: number; signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<TaskDetail[]> {
  const signal = options?.signal;
  const gameMode = resolveGameMode(options?.gameMode);
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);
  const query = `query TaskSummaries($lang: LanguageCode, $gameMode: GameMode, $limit: Int, $offset: Int) {
    tasks(lang: $lang, gameMode: $gameMode, limit: $limit, offset: $offset) {
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
      restartable
      factionName
      kappaRequired
      lightkeeperRequired
    }
  }`;

  const fetchPage = async (limit: number, offset: number): Promise<TaskDetail[]> => {
    const data = await graphqlFetch<{ tasks: TaskDetail[] }>(
      query,
      {
        lang: language,
        gameMode,
        limit,
        offset,
      },
      { signal },
    );
    return data.tasks ?? [];
  };

  const hasExplicitLimit = Number.isFinite(options?.limit);
  const hasExplicitOffset = Number.isFinite(options?.offset);
  if (hasExplicitLimit || hasExplicitOffset) {
    const limit = hasExplicitLimit ? Math.max(1, Math.floor(Number(options?.limit))) : 120;
    const offset = hasExplicitOffset ? Math.max(0, Math.floor(Number(options?.offset))) : 0;
    return fetchPage(limit, offset);
  }

  const pageSize = 120;
  const rows: TaskDetail[] = [];
  for (let offset = 0; ; offset += pageSize) {
    throwIfAborted(signal);
    const chunk = await fetchPage(pageSize, offset);
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

export async function fetchTasks(
  language: Language = 'en',
  options?: { limit?: number; offset?: number; signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<TaskDetail[]> {
  const signal = options?.signal;
  const gameMode = resolveGameMode(options?.gameMode);
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);
  const query = `query Tasks($lang: LanguageCode, $gameMode: GameMode, $limit: Int, $offset: Int) {
    tasks(lang: $lang, gameMode: $gameMode, limit: $limit, offset: $offset) {
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
  const fetchPage = async (limit: number, offset: number): Promise<TaskDetail[]> => {
    const data = await graphqlFetch<{ tasks: TaskDetail[] }>(
      query,
      {
        lang: language,
        gameMode,
        limit,
        offset,
      },
      { signal },
    );
    return data.tasks ?? [];
  };

  const hasExplicitLimit = Number.isFinite(options?.limit);
  const hasExplicitOffset = Number.isFinite(options?.offset);
  if (hasExplicitLimit || hasExplicitOffset) {
    const limit = hasExplicitLimit ? Math.max(1, Math.floor(Number(options?.limit))) : 120;
    const offset = hasExplicitOffset ? Math.max(0, Math.floor(Number(options?.offset))) : 0;
    return fetchPage(limit, offset);
  }

  const pageSize = 120;
  const rows: TaskDetail[] = [];
  for (let offset = 0; ; offset += pageSize) {
    throwIfAborted(signal);
    const chunk = await fetchPage(pageSize, offset);
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

export async function fetchTaskById(
  taskId: string,
  language: Language = 'en',
  options?: { signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<TaskDetail | null> {
  const trimmed = String(taskId || '').trim();
  if (!trimmed) return null;
  const signal = options?.signal;
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);
  const normalized = trimmed.toLowerCase();
  const isMatch = (task: TaskDetail): boolean => (
    task.id === trimmed ||
    task.normalizedName === trimmed ||
    task.normalizedName?.toLowerCase() === normalized
  );

  const pageSize = 120;
  for (let offset = 0; ; offset += pageSize) {
    throwIfAborted(signal);
    const summaryChunk = await fetchTaskSummaries(language, {
      limit: pageSize,
      offset,
      signal,
      priority: options?.priority,
      gameMode: options?.gameMode,
    });
    const localIndex = summaryChunk.findIndex(isMatch);
    if (localIndex >= 0) {
      const absoluteOffset = offset + localIndex;
      const detailRows = await fetchTasks(language, {
        limit: 1,
        offset: absoluteOffset,
        signal,
        priority: options?.priority,
        gameMode: options?.gameMode,
      });
      const matchedDetail = detailRows.find(isMatch) ?? detailRows[0];
      return matchedDetail ?? summaryChunk[localIndex];
    }
    if (summaryChunk.length < pageSize) break;
  }

  return null;
}

export async function fetchTraderById(
  traderIdOrName: string,
  language: Language = 'en',
  options?: { signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<TraderDetail | null> {
  const trimmed = String(traderIdOrName || '').trim();
  if (!trimmed) return null;
  const signal = options?.signal;
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);
  const normalized = trimmed.toLowerCase();
  const isMatch = (trader: TraderDetail): boolean => (
    trader.id === trimmed ||
    trader.normalizedName === trimmed ||
    trader.normalizedName?.toLowerCase() === normalized ||
    trader.name.toLowerCase() === normalized
  );

  const pageSize = 50;
  let matchedSummary: TraderDetail | null = null;
  let matchedOffset = -1;
  for (let offset = 0; ; offset += pageSize) {
    throwIfAborted(signal);
    const chunk = await fetchTraders(language, {
      limit: pageSize,
      offset,
      signal,
      priority: options?.priority,
      gameMode: options?.gameMode,
    });
    const localIndex = chunk.findIndex(isMatch);
    if (localIndex >= 0) {
      matchedSummary = chunk[localIndex];
      matchedOffset = offset + localIndex;
      break;
    }
    if (chunk.length < pageSize) break;
  }

  if (!matchedSummary || matchedOffset < 0) return null;
  const detail = await fetchTraderWithOffersByOffset(language, matchedOffset, {
    signal,
    gameMode: options?.gameMode,
  });
  if (detail && isMatch(detail)) return detail;
  return detail ?? matchedSummary;
}

export async function fetchTraders(
  language: Language = 'en',
  options?: { limit?: number; offset?: number; signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<TraderDetail[]> {
  const signal = options?.signal;
  const gameMode = resolveGameMode(options?.gameMode);
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);
  const query = `query Traders($lang: LanguageCode, $gameMode: GameMode, $limit: Int, $offset: Int) {
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
      }
    }
  }`;
  const fetchPage = async (limit: number, offset: number): Promise<TraderDetail[]> => {
    const data = await graphqlFetch<{ traders: TraderDetail[] }>(
      query,
      {
        lang: language,
        gameMode,
        limit,
        offset,
      },
      { signal },
    );
    return data.traders ?? [];
  };

  const hasExplicitLimit = Number.isFinite(options?.limit);
  const hasExplicitOffset = Number.isFinite(options?.offset);
  if (hasExplicitLimit || hasExplicitOffset) {
    const limit = hasExplicitLimit ? Math.max(1, Math.floor(Number(options?.limit))) : 50;
    const offset = hasExplicitOffset ? Math.max(0, Math.floor(Number(options?.offset))) : 0;
    return fetchPage(limit, offset);
  }

  const pageSize = 50;
  const rows: TraderDetail[] = [];
  for (let offset = 0; ; offset += pageSize) {
    throwIfAborted(signal);
    const chunk = await fetchPage(pageSize, offset);
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

async function fetchTraderWithOffersByOffset(
  language: Language,
  offset: number,
  options?: { signal?: AbortSignal; gameMode?: GameMode },
): Promise<TraderDetail | null> {
  if (!Number.isFinite(offset) || offset < 0) return null;
  throwIfAborted(options?.signal);
  const gameMode = resolveGameMode(options?.gameMode);
  const cacheKey = `${gameMode}:${language}:${offset}`;
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

  const data = await graphqlFetch<{ traders: TraderDetail[] }>(
    query,
    {
      lang: language,
      gameMode,
      limit: 1,
      offset,
    },
    { signal: options?.signal },
  );
  const trader = data.traders?.[0] ?? null;
  if (!trader) return null;
  traderDetailCache.set(cacheKey, {
    expiresAt: Date.now() + TRADER_DETAIL_CACHE_TTL_MS,
    data: trader,
  });
  return trader;
}


interface BossMetadataEntry {
  wikiLink?: string;
  behavior?: string;
}

const BOSS_METADATA_BY_NORMALIZED_NAME: Record<string, BossMetadataEntry> = {
  rogue: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/Rogues',
    behavior: 'Patrol',
  },
  raider: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/raiders',
    behavior: 'Rush',
  },
  kaban: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/kaban',
    behavior: 'Tank',
  },
  'cultist-priest': {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/cultists',
    behavior: 'Stalker',
  },
  knight: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/knight',
    behavior: 'Rush',
  },
  glukhar: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/glukhar',
    behavior: 'Hostile and accurate',
  },
  killa: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/killa',
    behavior: 'Patrol and highly armored',
  },
  reshala: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/reshala',
    behavior: 'Group patrol',
  },
  sanitar: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/sanitar',
    behavior: 'Frequent healing and stim injections',
  },
  shturman: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/shturman',
    behavior: 'Sniper',
  },
  tagilla: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/tagilla',
    behavior: 'Batshit insane',
  },
  zryachiy: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/Zryachiy',
    behavior: 'Sniper',
  },
  kollontay: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/Kollontay',
  },
  partisan: {
    wikiLink: 'https://escapefromtarkov.fandom.com/wiki/Partisan',
  },
};

interface RawBossListRow {
  id: string;
  name: string;
  normalizedName?: string;
  imagePortraitLink?: string | null;
  imagePosterLink?: string | null;
  health?: { id: string; bodyPart: string; max: number }[] | null;
  equipment?: {
    count?: number | null;
    quantity?: number | null;
    item?: { id?: string | null } | null;
  }[] | null;
  items?: { id?: string | null }[] | null;
}

interface RawBossDetailRow {
  id: string;
  name: string;
  normalizedName?: string;
  imagePortraitLink?: string | null;
  imagePosterLink?: string | null;
  health?: { id: string; bodyPart: string; max: number }[] | null;
  equipment?: {
    count?: number | null;
    quantity?: number | null;
    attributes?: { name?: string | null; value?: string | null }[] | null;
    item?: {
      id?: string | null;
      name?: string | null;
      shortName?: string | null;
      iconLink?: string | null;
      wikiLink?: string | null;
      types?: string[] | null;
      category?: { name: string } | null;
    } | null;
  }[] | null;
  items?: { id?: string | null }[] | null;
}

interface BossMapSpawnContext {
  bossMapsByName: Map<string, BossMapSpawn[]>;
  followersByBossName: Map<string, BossEscort[]>;
  followerOnlyNames: Set<string>;
}

interface RawHydratedBossItem {
  id: string;
  name: string;
  shortName?: string | null;
  iconLink?: string | null;
  wikiLink?: string | null;
  types?: string[] | null;
  category?: { name: string } | null;
}

function getBossHydratedItemCacheKey(itemId: string, language: Language): string {
  return `${language}:${String(itemId || '').trim()}`;
}

function getBossMapContextCacheKey(language: Language, gameMode: GameMode): string {
  return `${gameMode}:${language}`;
}

function getBossMapContextFromCache(language: Language, gameMode: GameMode): BossMapSpawnContext | null {
  const cacheKey = getBossMapContextCacheKey(language, gameMode);
  const cached = bossMapSpawnContextCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    bossMapSpawnContextCache.delete(cacheKey);
    return null;
  }
  return cached.data;
}

function setBossMapContextToCache(language: Language, gameMode: GameMode, data: BossMapSpawnContext): void {
  const cacheKey = getBossMapContextCacheKey(language, gameMode);
  bossMapSpawnContextCache.set(cacheKey, {
    expiresAt: Date.now() + BOSS_MAP_CONTEXT_CACHE_TTL_MS,
    data,
  });
}

function getBossHydratedItemFromCache(itemId: string, language: Language): RawHydratedBossItem | null {
  const key = getBossHydratedItemCacheKey(itemId, language);
  const cached = bossHydratedItemCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    bossHydratedItemCache.delete(key);
    return null;
  }
  return cached.data;
}

function setBossHydratedItemToCache(itemId: string, language: Language, data: RawHydratedBossItem): void {
  const key = getBossHydratedItemCacheKey(itemId, language);
  bossHydratedItemCache.set(key, {
    expiresAt: Date.now() + BOSS_HYDRATED_ITEM_CACHE_TTL_MS,
    data,
  });
}

function normalizeBossKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function isMissingTranslationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /missing translation/i.test(message);
}

async function graphqlFetchWithLanguageFallback<T>(
  query: string,
  variables: Record<string, unknown>,
  language: Language,
  options?: { signal?: AbortSignal; priority?: RequestPriority; allowPartialData?: boolean },
): Promise<T> {
  try {
    return await graphqlFetch<T>(query, variables, options);
  } catch (error) {
    if (language !== 'en' && isMissingTranslationError(error)) {
      return graphqlFetch<T>(
        query,
        { ...variables, lang: 'en' },
        options,
      );
    }
    throw error;
  }
}

function isBossMatch(boss: BossDetail, input: string): boolean {
  const trimmed = String(input || '').trim();
  if (!trimmed) return false;
  const normalized = trimmed.toLowerCase();
  const bossName = String(boss.name || '').trim().toLowerCase();
  const bossNormalizedName = normalizeBossKey(boss.normalizedName);
  const bossId = String(boss.id || '').trim();
  return (
    bossId === trimmed ||
    bossId.toLowerCase() === normalized ||
    bossNormalizedName === normalized ||
    bossName === normalized
  );
}

function toBossContainedItems(
  rows: RawBossDetailRow['equipment'],
  options?: { includeAttributes?: boolean; includeFallbackName?: boolean },
): BossContainedItem[] {
  const includeAttributes = options?.includeAttributes === true;
  const includeFallbackName = options?.includeFallbackName === true;
  return (rows ?? [])
    .map((entry) => {
      if (!entry) return null;
      const itemId = String(entry.item?.id || '').trim();
      if (!itemId) return null;
      const itemName = String(entry.item?.name || '').trim();
      const fallbackName = includeFallbackName ? itemName || itemId : itemName;
      if (!fallbackName) return null;
      const attributes = includeAttributes
        ? (entry.attributes ?? [])
          .map((attribute) => {
            const name = String(attribute?.name || '').trim();
            const value = String(attribute?.value || '').trim();
            if (!name || !value) return null;
            return { name, value };
          })
          .filter(Boolean) as { name: string; value: string }[]
        : [];

      return {
        count: entry.count ?? null,
        quantity: entry.quantity ?? null,
        attributes,
        item: {
          id: itemId,
          name: fallbackName,
          shortName: entry.item?.shortName || undefined,
          iconLink: entry.item?.iconLink || undefined,
          wikiLink: entry.item?.wikiLink || undefined,
          types: entry.item?.types ?? undefined,
          category: entry.item?.category ?? undefined,
        },
      } as BossContainedItem;
    })
    .filter(Boolean) as BossContainedItem[];
}

function getBossEquipmentSlot(entry: BossContainedItem): string {
  const attributes = entry.attributes ?? [];
  const slotAttribute = attributes.find((attribute) => {
    const key = String(attribute?.name || '').trim().toLowerCase();
    return key === 'slot';
  });
  return String(slotAttribute?.value || '').trim();
}

function buildBossEquipmentSets(equipment: BossContainedItem[]): BossEquipmentSet[] {
  if (equipment.length === 0) return [];

  const sets: BossEquipmentSet[] = [];
  let current: BossContainedItem[] = [];
  let currentHasPrimary = false;

  for (const entry of equipment) {
    const slot = getBossEquipmentSlot(entry).toLowerCase();
    const isPrimarySlot = slot === 'firstprimaryweapon';
    const shouldSplit = current.length > 0 && currentHasPrimary && isPrimarySlot;
    if (shouldSplit) {
      sets.push({
        id: `set-${sets.length + 1}`,
        items: current,
      });
      current = [];
      currentHasPrimary = false;
    }
    current.push(entry);
    if (isPrimarySlot) currentHasPrimary = true;
  }

  if (current.length > 0) {
    sets.push({
      id: `set-${sets.length + 1}`,
      items: current,
    });
  }

  return sets;
}

function getBossMergeKey(row: Pick<BossDetail, 'id' | 'name' | 'normalizedName'>): string {
  return (
    normalizeBossKey(row.name)
    || normalizeBossKey(row.normalizedName)
    || normalizeBossKey(row.id)
  );
}

function mergeBossHealthParts(
  first: BossDetail['health'] | undefined | null,
  second: BossDetail['health'] | undefined | null,
): BossDetail['health'] {
  const merged = new Map<string, { id: string; bodyPart: string; max: number }>();
  for (const part of [...(first ?? []), ...(second ?? [])]) {
    if (!part) continue;
    const max = Number(part.max ?? NaN);
    if (!Number.isFinite(max) || max <= 0) continue;
    const bodyPart = String(part.bodyPart || '').trim() || 'common';
    const key = `${bodyPart.toLowerCase()}:${max}`;
    if (merged.has(key)) continue;
    merged.set(key, {
      id: String(part.id || `${bodyPart}-${max}`),
      bodyPart,
      max,
    });
  }
  return Array.from(merged.values());
}

function mergeBossEquipment(
  first: BossContainedItem[] | undefined | null,
  second: BossContainedItem[] | undefined | null,
): BossContainedItem[] {
  const merged = new Map<string, BossContainedItem>();
  const rows = [...(first ?? []), ...(second ?? [])];
  for (const entry of rows) {
    if (!entry) continue;
    const itemId = String(entry.item?.id || '').trim();
    if (!itemId) continue;
    const slot = getBossEquipmentSlot(entry).toLowerCase();
    const count = Number(entry.count ?? entry.quantity ?? 1);
    const key = `${slot}:${itemId}:${count}`;
    if (merged.has(key)) continue;
    merged.set(key, entry);
  }
  return Array.from(merged.values());
}

function mergeBossLoot(
  first: BossLootItem[] | undefined | null,
  second: BossLootItem[] | undefined | null,
): BossLootItem[] {
  const merged = new Map<string, BossLootItem>();
  for (const entry of [...(first ?? []), ...(second ?? [])]) {
    if (!entry) continue;
    const key = normalizeBossKey(entry.id || entry.name);
    if (!key) continue;
    const existing = merged.get(key);
    const count = Number(entry.count ?? 1);
    if (!existing) {
      merged.set(key, {
        ...entry,
        count: Number.isFinite(count) ? count : 1,
      });
      continue;
    }
    existing.count = (existing.count ?? 1) + (Number.isFinite(count) ? count : 1);
    if (!existing.id && entry.id) existing.id = entry.id;
    if (!existing.name && entry.name) existing.name = entry.name;
    if (!existing.shortName && entry.shortName) existing.shortName = entry.shortName;
    if (!existing.iconLink && entry.iconLink) existing.iconLink = entry.iconLink;
    if (!existing.category && entry.category) existing.category = entry.category;
    if (!existing.types && entry.types) existing.types = entry.types;
    if (!existing.wikiLink && entry.wikiLink) existing.wikiLink = entry.wikiLink;
  }
  return Array.from(merged.values()).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function mergeSpawnLocations(
  first: BossSpawnLocation[] | undefined | null,
  second: BossSpawnLocation[] | undefined | null,
): BossSpawnLocation[] {
  const merged = new Map<string, BossSpawnLocation>();
  for (const location of [...(first ?? []), ...(second ?? [])]) {
    if (!location) continue;
    const spawnKey = String(location.spawnKey || '').trim();
    const name = String(location.name || '').trim();
    const key = normalizeBossKey(spawnKey || name);
    if (!key) continue;
    const chance = Number(location.chance ?? 0);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        spawnKey: spawnKey || name,
        name: name || spawnKey,
        chance: Number.isFinite(chance) ? chance : 0,
      });
      continue;
    }
    if (!existing.spawnKey && spawnKey) existing.spawnKey = spawnKey;
    if (!existing.name && name) existing.name = name;
    if (Number.isFinite(chance) && chance > existing.chance) {
      existing.chance = chance;
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => {
      if (b.chance !== a.chance) return b.chance - a.chance;
      return a.name.localeCompare(b.name);
    });
}

function mergeBossEscorts(
  first: BossEscort[] | undefined | null,
  second: BossEscort[] | undefined | null,
): BossEscort[] {
  const merged = new Map<string, BossEscort>();
  for (const escort of [...(first ?? []), ...(second ?? [])]) {
    if (!escort) continue;
    const key = normalizeBossKey(escort.name || escort.normalizedName || escort.id);
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...escort,
        maps: [...(escort.maps ?? [])],
        amounts: [...(escort.amounts ?? [])],
      });
      continue;
    }

    if (!existing.id && escort.id) existing.id = escort.id;
    if (!existing.name && escort.name) existing.name = escort.name;
    if (!existing.normalizedName && escort.normalizedName) existing.normalizedName = escort.normalizedName;
    if (!existing.imagePortraitLink && escort.imagePortraitLink) existing.imagePortraitLink = escort.imagePortraitLink;
    if (!existing.imagePosterLink && escort.imagePosterLink) existing.imagePosterLink = escort.imagePosterLink;

    const mapKeySet = new Set(
      (existing.maps ?? []).map((map) => `${String(map.id || '').trim()}:${normalizeBossKey(map.normalizedName || map.name)}`),
    );
    for (const map of escort.maps ?? []) {
      const mapKey = `${String(map.id || '').trim()}:${normalizeBossKey(map.normalizedName || map.name)}`;
      if (mapKeySet.has(mapKey)) continue;
      existing.maps = [...(existing.maps ?? []), map];
      mapKeySet.add(mapKey);
    }

    const amountKeySet = new Set(
      (existing.amounts ?? []).map((amount) => `${Number(amount.count || 0)}:${Number(amount.chance || 0)}`),
    );
    for (const amount of escort.amounts ?? []) {
      const amountKey = `${Number(amount.count || 0)}:${Number(amount.chance || 0)}`;
      if (amountKeySet.has(amountKey)) continue;
      existing.amounts = [...(existing.amounts ?? []), amount];
      amountKeySet.add(amountKey);
    }
  }
  return Array.from(merged.values())
    .map((escort) => ({
      ...escort,
      maps: [...(escort.maps ?? [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
      amounts: [...(escort.amounts ?? [])].sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        return a.chance - b.chance;
      }),
    }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function getSpawnEntryMergeKey(entry: BossSpawnEntry): string {
  const spawnTimeRaw = Number(entry.spawnTime ?? NaN);
  const spawnTime = Number.isFinite(spawnTimeRaw) ? spawnTimeRaw : Number.POSITIVE_INFINITY;
  const spawnChanceRaw = Number(entry.spawnChance ?? NaN);
  const spawnChance = Number.isFinite(spawnChanceRaw) ? spawnChanceRaw : -1;
  const randomFlag = entry.spawnTimeRandom ? '1' : '0';
  const trigger = normalizeBossKey(entry.spawnTrigger);
  const switchId = normalizeBossKey(entry.switchId);
  const locationKey = (entry.spawnLocations ?? [])
    .map((location) => normalizeBossKey(location.spawnKey || location.name))
    .filter(Boolean)
    .sort()
    .join('|');
  return `${spawnTime}|${spawnChance}|${randomFlag}|${trigger}|${switchId}|${locationKey}`;
}

function mergeSpawnEntries(
  first: BossSpawnEntry[] | undefined | null,
  second: BossSpawnEntry[] | undefined | null,
): BossSpawnEntry[] {
  const merged = new Map<string, BossSpawnEntry>();
  for (const entry of [...(first ?? []), ...(second ?? [])]) {
    if (!entry) continue;
    const key = getSpawnEntryMergeKey(entry);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...entry,
        spawnLocations: mergeSpawnLocations(entry.spawnLocations, []),
        escorts: mergeBossEscorts(entry.escorts, []),
      });
      continue;
    }
    existing.spawnLocations = mergeSpawnLocations(existing.spawnLocations, entry.spawnLocations);
    existing.escorts = mergeBossEscorts(existing.escorts, entry.escorts);
  }

  return Array.from(merged.values())
    .sort((a, b) => {
      const aTimeRaw = Number(a.spawnTime ?? NaN);
      const bTimeRaw = Number(b.spawnTime ?? NaN);
      const aTime = Number.isFinite(aTimeRaw) ? aTimeRaw : Number.POSITIVE_INFINITY;
      const bTime = Number.isFinite(bTimeRaw) ? bTimeRaw : Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;
      return Number(b.spawnChance ?? 0) - Number(a.spawnChance ?? 0);
    });
}

function mergeBossMaps(
  first: BossMapSpawn[] | undefined | null,
  second: BossMapSpawn[] | undefined | null,
): BossMapSpawn[] {
  const merged = new Map<string, BossMapSpawn>();
  for (const map of [...(first ?? []), ...(second ?? [])]) {
    if (!map) continue;
    const key = normalizeBossKey(map.id || map.normalizedName || map.name);
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        ...map,
        spawns: mergeSpawnEntries(map.spawns, []),
      });
      continue;
    }
    if (!existing.id && map.id) existing.id = map.id;
    if (!existing.name && map.name) existing.name = map.name;
    if (!existing.normalizedName && map.normalizedName) existing.normalizedName = map.normalizedName;
    existing.spawns = mergeSpawnEntries(existing.spawns, map.spawns);
  }
  return Array.from(merged.values())
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function mergeBossRows(first: BossDetail, second: BossDetail): BossDetail {
  const mergedEquipment = mergeBossEquipment(
    [
      ...(first.equipment ?? []),
      ...((first.equipmentSets ?? []).flatMap((set) => set.items ?? [])),
    ],
    [
      ...(second.equipment ?? []),
      ...((second.equipmentSets ?? []).flatMap((set) => set.items ?? [])),
    ],
  );

  return {
    ...first,
    id: first.id || second.id,
    name: first.name || second.name,
    normalizedName: first.normalizedName || second.normalizedName,
    imagePortraitLink: first.imagePortraitLink || second.imagePortraitLink,
    imagePosterLink: first.imagePosterLink || second.imagePosterLink,
    description: first.description || second.description || null,
    behavior: first.behavior || second.behavior || null,
    wikiLink: first.wikiLink || second.wikiLink || null,
    health: mergeBossHealthParts(first.health, second.health),
    equipment: mergedEquipment,
    equipmentSets: buildBossEquipmentSets(mergedEquipment),
    items: mergeBossLoot(first.items, second.items),
    maps: mergeBossMaps(first.maps, second.maps),
    followers: mergeBossEscorts(first.followers, second.followers),
  };
}

function mergeBossDetails(rows: BossDetail[]): BossDetail[] {
  const merged = new Map<string, BossDetail>();
  for (const row of rows) {
    if (!row) continue;
    const key = getBossMergeKey(row);
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      const normalizedEquipment = mergeBossEquipment(
        [
          ...(row.equipment ?? []),
          ...((row.equipmentSets ?? []).flatMap((set) => set.items ?? [])),
        ],
        [],
      );
      merged.set(key, {
        ...row,
        health: mergeBossHealthParts(row.health, []),
        equipment: normalizedEquipment,
        equipmentSets: buildBossEquipmentSets(normalizedEquipment),
        items: mergeBossLoot(row.items, []),
        maps: mergeBossMaps(row.maps, []),
        followers: mergeBossEscorts(row.followers, []),
      });
      continue;
    }
    merged.set(key, mergeBossRows(existing, row));
  }
  return Array.from(merged.values())
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

async function fetchBossMapSpawnContext(
  language: Language,
  options?: { signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<BossMapSpawnContext> {
  const gameMode = resolveGameMode(options?.gameMode);
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(options?.signal);
  const cachedContext = getBossMapContextFromCache(language, gameMode);
  if (cachedContext) {
    return cachedContext;
  }
  const query = `query BossSpawnMaps($lang: LanguageCode, $gameMode: GameMode) {
    maps(lang: $lang, gameMode: $gameMode) {
      id
      name
      normalizedName
      bosses {
        name
        normalizedName
        boss {
          id
          name
          normalizedName
          imagePortraitLink
          imagePosterLink
        }
        spawnChance
        spawnLocations {
          spawnKey
          name
          chance
        }
        escorts {
          name
          normalizedName
          boss {
            id
            name
            normalizedName
            imagePortraitLink
            imagePosterLink
          }
          amount {
            count
            chance
          }
        }
        spawnTime
        spawnTimeRandom
        spawnTrigger
        switch {
          id
        }
      }
    }
  }`;

  const loadMapData = async (requestLanguage: Language) => graphqlFetchWithLanguageFallback<{
    maps?: {
      id?: string | null;
      name?: string | null;
      normalizedName?: string | null;
      bosses?: {
        name?: string | null;
        normalizedName?: string | null;
        boss?: {
          id?: string | null;
          name?: string | null;
          normalizedName?: string | null;
          imagePortraitLink?: string | null;
          imagePosterLink?: string | null;
        } | null;
        spawnChance?: number | null;
        spawnLocations?: {
          spawnKey?: string | null;
          name?: string | null;
          chance?: number | null;
        }[] | null;
        escorts?: {
          name?: string | null;
          normalizedName?: string | null;
          boss?: {
            id?: string | null;
            name?: string | null;
            normalizedName?: string | null;
            imagePortraitLink?: string | null;
            imagePosterLink?: string | null;
          } | null;
          amount?: {
            count?: number | null;
            chance?: number | null;
          }[] | null;
        }[] | null;
        spawnTime?: number | null;
        spawnTimeRandom?: boolean | null;
        spawnTrigger?: string | null;
        switch?: { id?: string | null } | null;
      }[] | null;
    }[] | null;
  }>(
    query,
    { lang: requestLanguage, gameMode },
    requestLanguage,
    {
      signal: options?.signal,
      priority: options?.priority,
      allowPartialData: true,
    },
  );

  let data = await loadMapData(language);
  const primaryMaps = data.maps ?? [];
  if (primaryMaps.length === 0 && language !== 'en') {
    try {
      data = await loadMapData('en');
    } catch (fallbackError) {
      console.log('[TarkovAPI] Boss map context english fallback failed:', fallbackError);
    }
  }

  const bossMapsByName = new Map<string, BossMapSpawn[]>();
  const followersByBossMap = new Map<string, Map<string, BossEscort>>();
  const mapBossNames = new Set<string>();
  const escortNames = new Set<string>();

  for (const map of data.maps ?? []) {
    if (!map) continue;
    const mapId = String(map.id || '').trim();
    const mapName = String(map.name || '').trim();
    if (!mapId || !mapName) continue;
    const mapNormalizedName = String(map.normalizedName || '').trim();

    for (const spawn of map.bosses ?? []) {
      if (!spawn) continue;
      const spawnBossName = String(spawn.name || spawn.boss?.name || '').trim();
      const spawnBossNormalizedName = String(spawn.normalizedName || spawn.boss?.normalizedName || '').trim();
      const bossNormalizedName = normalizeBossKey(spawnBossNormalizedName || spawnBossName);
      if (!bossNormalizedName) continue;
      mapBossNames.add(bossNormalizedName);

      if (!bossMapsByName.has(bossNormalizedName)) {
        bossMapsByName.set(bossNormalizedName, []);
      }
      const mapsForBoss = bossMapsByName.get(bossNormalizedName) ?? [];
      let mapEntry = mapsForBoss.find((entry) => entry.id === mapId);
      if (!mapEntry) {
        mapEntry = {
          id: mapId,
          name: mapName,
          normalizedName: mapNormalizedName || undefined,
          spawns: [],
        };
        mapsForBoss.push(mapEntry);
      }

      const escorts: BossEscort[] = (spawn.escorts ?? [])
        .map((escort) => {
          if (!escort) return null;
          const escortName = String(escort.name || escort.boss?.name || '').trim();
          const escortNormalizedName = String(escort.normalizedName || escort.boss?.normalizedName || '').trim();
          if (!escortName && !escortNormalizedName) return null;
          const normalizedEscortKey = normalizeBossKey(escortNormalizedName || escortName);
          if (normalizedEscortKey) {
            escortNames.add(normalizedEscortKey);
          }
          return {
            id: String(escort.boss?.id || '').trim() || undefined,
            name: escortName || escortNormalizedName,
            normalizedName: escortNormalizedName || undefined,
            imagePortraitLink: escort.boss?.imagePortraitLink || undefined,
            imagePosterLink: escort.boss?.imagePosterLink || undefined,
            amounts: (escort.amount ?? []).map((amount) => ({
              count: Number(amount?.count ?? 0),
              chance: Number(amount?.chance ?? 0),
            })),
          } as BossEscort;
        })
        .filter(Boolean) as BossEscort[];

      const spawnLocations = (spawn.spawnLocations ?? [])
        .map((location) => {
          if (!location) return null;
          const spawnKey = String(location.spawnKey || location.name || '').trim();
          const locationName = String(location.name || '').trim();
          if (!spawnKey && !locationName) return null;
          const chance = Number(location.chance ?? 0);
          return {
            spawnKey: spawnKey || locationName,
            name: locationName || spawnKey,
            chance: Number.isFinite(chance) ? chance : 0,
          };
        })
        .filter(Boolean) as { spawnKey: string; name: string; chance: number }[];
      const spawnChance = Number(spawn.spawnChance ?? NaN);
      const spawnTime = Number(spawn.spawnTime ?? NaN);

      mapEntry.spawns.push({
        spawnChance: Number.isFinite(spawnChance) ? spawnChance : null,
        spawnLocations,
        escorts,
        spawnTime: Number.isFinite(spawnTime) ? spawnTime : null,
        spawnTimeRandom: typeof spawn.spawnTimeRandom === 'boolean' ? spawn.spawnTimeRandom : null,
        spawnTrigger: String(spawn.spawnTrigger || '').trim() || null,
        switchId: String(spawn.switch?.id || '').trim() || null,
      });

      if (!followersByBossMap.has(bossNormalizedName)) {
        followersByBossMap.set(bossNormalizedName, new Map<string, BossEscort>());
      }
      const followersForBoss = followersByBossMap.get(bossNormalizedName)!;
      for (const escort of escorts) {
        const escortKey = normalizeBossKey(escort.normalizedName || escort.name);
        if (!escortKey) continue;
        const existing = followersForBoss.get(escortKey);
        if (!existing) {
          followersForBoss.set(escortKey, {
            ...escort,
            maps: [
              {
                id: mapId,
                name: mapName,
                normalizedName: mapNormalizedName || undefined,
              },
            ],
          });
          continue;
        }

        const existingMapSet = new Set(
          (existing.maps ?? []).map((entry) => `${entry.id || ''}:${entry.normalizedName || entry.name}`),
        );
        const nextMapKey = `${mapId}:${mapNormalizedName || mapName}`;
        if (!existingMapSet.has(nextMapKey)) {
          existing.maps = [
            ...(existing.maps ?? []),
            {
              id: mapId,
              name: mapName,
              normalizedName: mapNormalizedName || undefined,
            },
          ];
        }

        const amountSet = new Set(
          (existing.amounts ?? []).map((amount) => `${amount.count}:${amount.chance}`),
        );
        for (const amount of escort.amounts ?? []) {
          const amountKey = `${amount.count}:${amount.chance}`;
          if (amountSet.has(amountKey)) continue;
          existing.amounts = [...(existing.amounts ?? []), amount];
          amountSet.add(amountKey);
        }
      }
    }
  }

  const followersByBossName = new Map<string, BossEscort[]>();
  for (const [bossName, followerMap] of followersByBossMap.entries()) {
    const rows = Array.from(followerMap.values())
      .map((follower) => ({
        ...follower,
        maps: [...(follower.maps ?? [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
        amounts: [...(follower.amounts ?? [])]
          .sort((a, b) => {
            if (a.count !== b.count) return a.count - b.count;
            return a.chance - b.chance;
          }),
      }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    followersByBossName.set(bossName, rows);
  }

  for (const maps of bossMapsByName.values()) {
    maps.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  const followerOnlyNames = new Set<string>();
  for (const escortName of escortNames) {
    if (!mapBossNames.has(escortName)) {
      followerOnlyNames.add(escortName);
    }
  }

  const result = {
    bossMapsByName,
    followersByBossName,
    followerOnlyNames,
  };
  setBossMapContextToCache(language, gameMode, result);
  return result;
}

async function fetchHydratedBossItemsByIds(
  ids: string[],
  language: Language,
  options?: { signal?: AbortSignal; priority?: RequestPriority },
): Promise<Map<string, RawHydratedBossItem>> {
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(options?.signal);
  const uniqueIds = Array.from(
    new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)),
  );
  if (uniqueIds.length === 0) return new Map<string, RawHydratedBossItem>();
  const map = new Map<string, RawHydratedBossItem>();
  const unresolvedIds: string[] = [];
  for (const id of uniqueIds) {
    const cached = getBossHydratedItemFromCache(id, language);
    if (cached) {
      map.set(id, cached);
      continue;
    }
    unresolvedIds.push(id);
  }

  if (unresolvedIds.length > 0) {
    const query = `query BossItemsByIds($ids: [ID!], $lang: LanguageCode) {
      items(ids: $ids, lang: $lang) {
        id
        name
        shortName
        iconLink
        wikiLink
        category {
          name
        }
      }
    }`;

    const chunks = chunkArray(unresolvedIds, GRAPHQL_CHUNK_SIZE);
    const rows = await mapWithConcurrency(
      chunks,
      GRAPHQL_CHUNK_FETCH_CONCURRENCY,
      async (chunk) => {
        try {
          const data = await graphqlFetchWithLanguageFallback<{
            items?: RawHydratedBossItem[];
          }>(
            query,
            { ids: chunk, lang: language },
            language,
            { ...options, allowPartialData: true },
          );
          return data.items ?? [];
        } catch (error) {
          console.log('[TarkovAPI] Boss item hydration failed:', error);
          return [] as RawHydratedBossItem[];
        }
      },
    );

    for (const chunk of rows) {
      for (const item of chunk) {
        const itemId = String(item.id || '').trim();
        if (!itemId) continue;
        map.set(itemId, item);
        setBossHydratedItemToCache(itemId, language, item);
      }
    }

    const unresolvedAfterApi = unresolvedIds.filter((id) => !map.has(id));
    try {
      const fallbackMeta = await fetchItemMetaByTpls(unresolvedAfterApi, language);
      for (const id of unresolvedAfterApi) {
        const meta = fallbackMeta[id];
        const name = String(meta?.name || '').trim();
        if (!name) continue;
        const fallbackItem: RawHydratedBossItem = {
          id,
          name,
          shortName: undefined,
          iconLink: String(meta?.gridImageLink || meta?.baseImageLink || '').trim() || getItemImageURL(id),
          wikiLink: undefined,
          category: undefined,
        };
        map.set(id, fallbackItem);
        setBossHydratedItemToCache(id, language, fallbackItem);
      }
    } catch (error) {
      console.log('[TarkovAPI] Boss item meta fallback failed:', error);
    }
  }
  return map;
}

function toBossLootItems(
  itemIds: string[],
  hydrationMap: Map<string, RawHydratedBossItem>,
): BossLootItem[] {
  const aggregated = new Map<string, BossLootItem>();
  for (const itemIdRaw of itemIds) {
    const itemId = String(itemIdRaw || '').trim();
    if (!itemId) continue;
    const hydrated = hydrationMap.get(itemId);
    const existing = aggregated.get(itemId);
    if (existing) {
      existing.count = (existing.count ?? 1) + 1;
      continue;
    }
    aggregated.set(itemId, {
      id: itemId,
      name: String(hydrated?.name || itemId).trim(),
      shortName: String(hydrated?.shortName || '').trim() || undefined,
      iconLink: String(hydrated?.iconLink || '').trim() || getItemImageURL(itemId),
      wikiLink: String(hydrated?.wikiLink || '').trim() || undefined,
      types: hydrated?.types ?? undefined,
      category: hydrated?.category ?? undefined,
      count: 1,
    });
  }

  return Array.from(aggregated.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function enrichBossEquipmentItems(
  equipment: BossContainedItem[],
  hydrationMap: Map<string, RawHydratedBossItem>,
): BossContainedItem[] {
  return equipment.map((entry) => {
    const itemId = String(entry.item?.id || '').trim();
    if (!itemId) return entry;
    const hydrated = hydrationMap.get(itemId);
    const existingName = String(entry.item?.name || '').trim();
    const hydratedName = String(hydrated?.name || '').trim();
    const resolvedName = hydratedName || (existingName && existingName !== itemId ? existingName : '') || itemId;
    const existingShortName = String(entry.item?.shortName || '').trim();
    const hydratedShortName = String(hydrated?.shortName || '').trim();
    return {
      ...entry,
      item: {
        ...entry.item,
        id: itemId,
        name: resolvedName,
        shortName: hydratedShortName || existingShortName || undefined,
        iconLink: String(entry.item?.iconLink || hydrated?.iconLink || '').trim() || getItemImageURL(itemId),
        wikiLink: String(entry.item?.wikiLink || hydrated?.wikiLink || '').trim() || undefined,
        types: hydrated?.types ?? entry.item?.types ?? undefined,
        category: hydrated?.category ?? entry.item?.category ?? undefined,
      },
    };
  });
}

function applyBossMetadata(
  row: BossDetail,
  bossMapsByName: Map<string, BossMapSpawn[]>,
  followersByBossName: Map<string, BossEscort[]>,
): BossDetail {
  const normalizedName = normalizeBossKey(row.normalizedName || row.name);
  const metadata = BOSS_METADATA_BY_NORMALIZED_NAME[normalizedName];
  const mapRows = bossMapsByName.get(normalizedName) ?? [];
  const maps = mapRows
    .filter((mapRow): mapRow is BossMapSpawn => Boolean(mapRow));

  return {
    ...row,
    behavior: metadata?.behavior || row.behavior,
    wikiLink: metadata?.wikiLink || row.wikiLink,
    maps,
    followers: followersByBossName.get(normalizedName) ?? [],
  };
}

export async function fetchBosses(
  language: Language = 'en',
  options?: {
    limit?: number;
    offset?: number;
    names?: string[];
    includeFollowers?: boolean;
    signal?: AbortSignal;
    priority?: RequestPriority;
    gameMode?: GameMode;
  },
): Promise<BossDetail[]> {
  const signal = options?.signal;
  const gameMode = resolveGameMode(options?.gameMode);
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);
  const query = `query BossesList(
    $lang: LanguageCode
    $gameMode: GameMode
    $name: [String!]
    $limit: Int
    $offset: Int
  ) {
    bosses(lang: $lang, gameMode: $gameMode, name: $name, limit: $limit, offset: $offset) {
      id
      name
      normalizedName
      imagePortraitLink
      imagePosterLink
      health {
        id
        bodyPart
        max
      }
    }
  }`;

  const names = (options?.names ?? [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  const includeFollowers = options?.includeFollowers === true || names.length > 0;

  const fetchPageWithLanguage = async (
    requestLanguage: Language,
    limit: number,
    offset: number,
  ): Promise<RawBossListRow[]> => {
    const data = await graphqlFetchWithLanguageFallback<{ bosses?: RawBossListRow[] }>(
      query,
      {
        lang: requestLanguage,
        gameMode,
        // Upstream bosses(name: null) can return "Unexpected error."
        // Omit the variable when empty to request full boss list.
        name: names.length > 0 ? names : undefined,
        limit,
        offset,
      },
      requestLanguage,
      { signal, allowPartialData: true },
    );
    return data.bosses ?? [];
  };
  const fetchPage = (limit: number, offset: number): Promise<RawBossListRow[]> => (
    fetchPageWithLanguage(language, limit, offset)
  );

  const hasExplicitLimit = Number.isFinite(options?.limit);
  const hasExplicitOffset = Number.isFinite(options?.offset);

  const rows: RawBossListRow[] = [];
  if (hasExplicitLimit || hasExplicitOffset) {
    const limit = hasExplicitLimit ? Math.max(1, Math.floor(Number(options?.limit))) : 50;
    const offset = hasExplicitOffset ? Math.max(0, Math.floor(Number(options?.offset))) : 0;
    rows.push(...await fetchPage(limit, offset));
    if (rows.length === 0 && language !== 'en') {
      rows.push(...await fetchPageWithLanguage('en', limit, offset));
    }
  } else {
    const pageSize = 50;
    for (let offset = 0; ; offset += pageSize) {
      throwIfAborted(signal);
      const chunk = await fetchPage(pageSize, offset);
      rows.push(...chunk);
      if (chunk.length < pageSize) break;
    }
    if (rows.length === 0 && language !== 'en') {
      for (let offset = 0; ; offset += pageSize) {
        throwIfAborted(signal);
        const chunk = await fetchPageWithLanguage('en', pageSize, offset);
        rows.push(...chunk);
        if (chunk.length < pageSize) break;
      }
    }
  }

  let spawnContext: BossMapSpawnContext;
  try {
    spawnContext = await fetchBossMapSpawnContext(language, { signal, gameMode });
  } catch (error) {
    console.log('[TarkovAPI] Boss map context fetch failed:', error);
    spawnContext = {
      bossMapsByName: new Map<string, BossMapSpawn[]>(),
      followersByBossName: new Map<string, BossEscort[]>(),
      followerOnlyNames: new Set<string>(),
    };
  }
  const mappedRows = rows
    .map((row) => {
      const bossId = String(row?.id || '').trim();
      const bossName = String(row?.name || '').trim();
      if (!bossId || !bossName) return null;

      const boss: BossDetail = {
        id: bossId,
        name: bossName,
        normalizedName: row.normalizedName || undefined,
        imagePortraitLink: row.imagePortraitLink ?? undefined,
        imagePosterLink: row.imagePosterLink ?? undefined,
        health: row.health ?? [],
        equipment: [],
        equipmentSets: [],
        items: [],
      };
      return applyBossMetadata(
        boss,
        spawnContext.bossMapsByName,
        spawnContext.followersByBossName,
      );
    })
    .filter((boss): boss is BossDetail => Boolean(boss))
    .filter((boss) => {
      if (includeFollowers) return true;
      const key = normalizeBossKey(boss.normalizedName || boss.name);
      return !spawnContext.followerOnlyNames.has(key);
    });

  return mergeBossDetails(mappedRows);
}

async function fetchBossDetailCandidates(
  names: string[],
  language: Language,
  options?: { signal?: AbortSignal; priority?: RequestPriority; gameMode?: GameMode },
): Promise<BossDetail[]> {
  const normalizedNames = names
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  if (normalizedNames.length === 0) return [];

  const signal = options?.signal;
  const gameMode = resolveGameMode(options?.gameMode);
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);
  const query = `query BossesDetail(
    $lang: LanguageCode
    $gameMode: GameMode
    $name: [String!]
    $limit: Int
    $offset: Int
  ) {
    bosses(lang: $lang, gameMode: $gameMode, name: $name, limit: $limit, offset: $offset) {
      id
      name
      normalizedName
      imagePortraitLink
      imagePosterLink
      health {
        id
        bodyPart
        max
      }
      equipment {
        count
        quantity
        attributes {
          name
          value
        }
        item {
          id
        }
      }
      items {
        id
      }
    }
  }`;

  const fetchRows = async (requestLanguage: Language): Promise<RawBossDetailRow[]> => {
    const data = await graphqlFetchWithLanguageFallback<{ bosses?: RawBossDetailRow[] }>(
      query,
      {
        lang: requestLanguage,
        gameMode,
        name: normalizedNames,
        limit: 20,
        offset: 0,
      },
      requestLanguage,
      { signal, allowPartialData: true },
    );
    return data.bosses ?? [];
  };

  let rows = await fetchRows(language);
  if (rows.length === 0 && language !== 'en') {
    rows = await fetchRows('en');
  }
  if (rows.length === 0) return [];

  let spawnContext: BossMapSpawnContext;
  try {
    spawnContext = await fetchBossMapSpawnContext(language, { signal, gameMode });
  } catch (error) {
    console.log('[TarkovAPI] Boss detail map context fetch failed:', error);
    spawnContext = {
      bossMapsByName: new Map<string, BossMapSpawn[]>(),
      followersByBossName: new Map<string, BossEscort[]>(),
      followerOnlyNames: new Set<string>(),
    };
  }
  const hydrationIds: string[] = [];
  for (const row of rows) {
    for (const entry of row.equipment ?? []) {
      const id = String(entry?.item?.id || '').trim();
      if (id) hydrationIds.push(id);
    }
    for (const entry of row.items ?? []) {
      const id = String(entry?.id || '').trim();
      if (id) hydrationIds.push(id);
    }
  }
  const hydrationMap = await fetchHydratedBossItemsByIds(hydrationIds, language, { signal });

  const detailedRows = rows
    .map((row) => {
      const bossId = String(row?.id || '').trim();
      const bossName = String(row?.name || '').trim();
      if (!bossId || !bossName) return null;

      const rawEquipment = toBossContainedItems(row.equipment, { includeAttributes: true, includeFallbackName: true });
      const equipment = enrichBossEquipmentItems(rawEquipment, hydrationMap);
      const itemIds = (row.items ?? []).map((entry) => String(entry?.id || '').trim()).filter(Boolean);
      const items = toBossLootItems(itemIds, hydrationMap);

      const boss: BossDetail = {
        id: bossId,
        name: bossName,
        normalizedName: row.normalizedName || undefined,
        imagePortraitLink: row.imagePortraitLink ?? undefined,
        imagePosterLink: row.imagePosterLink ?? undefined,
        health: row.health ?? [],
        equipment,
        equipmentSets: buildBossEquipmentSets(equipment),
        items,
      };

      return applyBossMetadata(
        boss,
        spawnContext.bossMapsByName,
        spawnContext.followersByBossName,
      );
    })
    .filter(Boolean) as BossDetail[];

  return mergeBossDetails(detailedRows);
}

export async function fetchBossById(
  bossIdOrName: string,
  language: Language = 'en',
  options?: { signal?: AbortSignal; priority?: RequestPriority; hints?: string[]; gameMode?: GameMode },
): Promise<BossDetail | null> {
  const trimmed = String(bossIdOrName || '').trim();
  if (!trimmed) return null;
  const signal = options?.signal;
  markRequestPriority(options?.priority ?? 'foreground');
  throwIfAborted(signal);

  const initialProbes = Array.from(
    new Set(
      [trimmed, ...(options?.hints ?? [])]
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ),
  );

  const directCandidates = await fetchBossDetailCandidates(initialProbes, language, {
    signal,
    gameMode: options?.gameMode,
  });
  const directHit = directCandidates.find((boss) => (
    initialProbes.some((probe) => isBossMatch(boss, probe))
  ));
  if (directHit) return directHit;

  let matched = null as BossDetail | null;

  const scopedBosses = await fetchBosses(language, {
    names: initialProbes,
    includeFollowers: true,
    signal,
    gameMode: options?.gameMode,
  });
  matched = scopedBosses.find((boss) => initialProbes.some((probe) => isBossMatch(boss, probe))) ?? null;

  if (!matched) {
    const allBosses = await fetchBosses(language, {
      includeFollowers: true,
      signal,
      gameMode: options?.gameMode,
    });
    matched = allBosses.find((boss) => initialProbes.some((probe) => isBossMatch(boss, probe))) ?? null;
  }
  if (!matched) return null;

  const probeNames = Array.from(
    new Set(
      [matched.id, matched.normalizedName, matched.name]
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ),
  );
  const fallbackCandidates = await fetchBossDetailCandidates(probeNames, language, {
    signal,
    gameMode: options?.gameMode,
  });
  return fallbackCandidates.find((boss) => isBossMatch(boss, matched.id) || isBossMatch(boss, matched.name))
    ?? fallbackCandidates[0]
    ?? null;
}

export async function fetchSkills(language: Language = 'en'): Promise<{ id: string; name: string }[]> {
  const query = `query Skills($lang: LanguageCode) { skills(lang: $lang) { id name } }`;
  const data = await graphqlFetch<{ skills: { id: string; name: string }[] }>(query, { lang: language });
  return data.skills ?? [];
}

export async function fetchAchievements(
  language: Language = 'en',
): Promise<{ id: string; name: string; rarity?: string; normalizedRarity?: string }[]> {
  const query = `query Achievements($lang: LanguageCode) {
    achievements(lang: $lang) {
      id
      name
      rarity
      normalizedRarity
    }
  }`;
  const data = await graphqlFetch<{
    achievements: { id: string; name: string; rarity?: string; normalizedRarity?: string }[];
  }>(query, { lang: language });
  return data.achievements ?? [];
}

export async function fetchHideoutStations(): Promise<{ id: string; name: string }[]> {
  const query = `query HideoutStations { hideoutStations { id name } }`;
  const data = await graphqlFetch<{ hideoutStations: { id: string; name: string }[] }>(query);
  return data.hideoutStations ?? [];
}
