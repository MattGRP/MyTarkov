import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Keyboard, Modal, Pressable, ScrollView, Platform, type LayoutChangeEvent } from 'react-native';
import { Search, X, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Filter, Package, User, ClipboardList, Store, Skull } from 'lucide-react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors, { alphaBlack, alphaWhite, getModeAccentTheme } from '@/constants/colors';
import { localizeBossName, localizeCategoryName, localizeTraderName } from '@/constants/i18n';
import { useGameMode } from '@/providers/GameModeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import {
  fetchItemCategories,
  fetchTaskSummaries,
  fetchTraders,
  fetchBosses,
  fetchPlayerProfile,
  isTurnstileRequiredError,
  savePlayerSearchToken,
  searchItems,
  searchPlayers,
} from '@/services/tarkovApi';
import { BossDetail, ItemSearchResult, SearchResult, TaskDetail, TraderDetail } from '@/types/tarkov';
import { formatCountdownToTimestamp, formatPrice } from '@/utils/helpers';
import FullScreenImageModal from '@/components/FullScreenImageModal';
import PageHeader, { getPageHeaderEstimatedHeight } from '@/components/PageHeader';
import TurnstileTokenModal from '@/components/TurnstileTokenModal';
import ShimmerBlock from '@/components/ShimmerBlock';

const SORT_OPTIONS = [
  { key: 'name', labelKey: 'searchSortName' },
  { key: 'avg24hPrice', labelKey: 'searchSortPrice' },
  { key: 'changeLast48hPercent', labelKey: 'searchSortChange' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['key'];

type SortDirection = 'asc' | 'desc';

type SearchMode = 'item' | 'player' | 'task' | 'trader' | 'boss';
const SEARCH_LIST_PAGE_SIZE = 40;
const RECENT_PLAYERS_STORAGE_KEY = 'search_recent_players';
const RECENT_PLAYERS_MAX = 10;
const SEARCH_MODE_ORDER: SearchMode[] = ['task', 'boss', 'trader', 'item', 'player'];

function getItemPrimaryPrice(item: ItemSearchResult): number {
  return item.avg24hPrice ?? item.lastLowPrice ?? item.basePrice ?? 0;
}

function getTaskXp(task: TaskDetail): string {
  return `${task.experience || 0} XP`;
}

function getFactionKey(factionName?: string | null): string {
  const normalized = (factionName ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'any') return 'any';
  return normalized;
}

function getFactionLabel(factionName: string | null | undefined, anyLabel: string): string {
  if (!factionName) return anyLabel;
  const trimmed = factionName.trim();
  if (!trimmed || trimmed.toLowerCase() === 'any') return anyLabel;
  return trimmed;
}

function getTaskMapKey(task: TaskDetail): string {
  return (
    task.map?.id ||
    task.map?.normalizedName ||
    task.map?.name?.toLowerCase() ||
    'any'
  );
}

function getTaskMapLabel(task: TaskDetail, anyLabel: string): string {
  const name = task.map?.name?.trim();
  if (!name) return anyLabel;
  return name;
}

function localizeUnknownText(value: string | null | undefined, unknownLabel: string): string {
  const text = String(value || '').trim();
  if (!text) return unknownLabel;
  const normalized = text.toLowerCase();
  if (normalized === 'unknown' || normalized === '<unknown>') return unknownLabel;
  return text;
}

function isAbortRequestError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = String(error.name || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();
  return name.includes('abort') || message.includes('abort');
}

export default function SearchScreen() {
  const { t, language } = useLanguage();
  const { gameMode } = useGameMode();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const isFocused = useIsFocused();
  const [headerHeight, setHeaderHeight] = useState<number>(() => getPageHeaderEstimatedHeight(insets.top, true));
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const [searchMode, setSearchMode] = useState<SearchMode>(SEARCH_MODE_ORDER[0]);
  const [searchText, setSearchText] = useState<string>('');
  const [inputError, setInputError] = useState<string>('');

  const [itemResults, setItemResults] = useState<ItemSearchResult[]>([]);
  const [itemHasSearched, setItemHasSearched] = useState<boolean>(false);
  const [itemVisibleCount, setItemVisibleCount] = useState<number>(SEARCH_LIST_PAGE_SIZE);

  const [playerResults, setPlayerResults] = useState<SearchResult[]>([]);
  const [playerHasSearched, setPlayerHasSearched] = useState<boolean>(false);
  const [playerVisibleCount, setPlayerVisibleCount] = useState<number>(SEARCH_LIST_PAGE_SIZE);
  const [recentPlayers, setRecentPlayers] = useState<SearchResult[]>([]);

  const [selectedTaskTraders, setSelectedTaskTraders] = useState<string[]>([]);
  const [draftTaskTraders, setDraftTaskTraders] = useState<string[]>([]);
  const [taskTraderModalOpen, setTaskTraderModalOpen] = useState(false);
  const [selectedTaskLevels, setSelectedTaskLevels] = useState<number[]>([]);
  const [draftTaskLevels, setDraftTaskLevels] = useState<number[]>([]);
  const [taskLevelModalOpen, setTaskLevelModalOpen] = useState(false);
  const [selectedTaskMaps, setSelectedTaskMaps] = useState<string[]>([]);
  const [draftTaskMaps, setDraftTaskMaps] = useState<string[]>([]);
  const [taskMapModalOpen, setTaskMapModalOpen] = useState(false);
  const [selectedTaskFactions, setSelectedTaskFactions] = useState<string[]>([]);
  const [draftTaskFactions, setDraftTaskFactions] = useState<string[]>([]);
  const [taskFactionModalOpen, setTaskFactionModalOpen] = useState(false);
  const [only3x4Required, setOnly3x4Required] = useState(false);
  const [onlyLightkeeperRequired, setOnlyLightkeeperRequired] = useState(false);
  const [taskVisibleCount, setTaskVisibleCount] = useState<number>(SEARCH_LIST_PAGE_SIZE);
  const [traderVisibleCount, setTraderVisibleCount] = useState<number>(SEARCH_LIST_PAGE_SIZE);
  const [bossVisibleCount, setBossVisibleCount] = useState<number>(SEARCH_LIST_PAGE_SIZE);

  const [sortKey, setSortKey] = useState<SortKey>('avg24hPrice');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [draftCategories, setDraftCategories] = useState<string[]>([]);

  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [pendingPlayerQuery, setPendingPlayerQuery] = useState<string>('');
  const [isTokenResolving, setIsTokenResolving] = useState(false);
  const [hasRetriedWithFreshToken, setHasRetriedWithFreshToken] = useState(false);
  const itemSearchAbortRef = useRef<AbortController | null>(null);
  const playerSearchAbortRef = useRef<AbortController | null>(null);
  const accentTheme = useMemo(() => getModeAccentTheme(gameMode), [gameMode]);

  const itemSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      itemSearchAbortRef.current?.abort();
      const controller = new AbortController();
      itemSearchAbortRef.current = controller;
      try {
        return await searchItems(query, language, { signal: controller.signal, gameMode });
      } finally {
        if (itemSearchAbortRef.current === controller) {
          itemSearchAbortRef.current = null;
        }
      }
    },
    onSuccess: (data) => {
      setItemResults(data);
      setItemHasSearched(true);
    },
    onError: (error) => {
      if (isAbortRequestError(error)) return;
      setItemHasSearched(true);
    },
  });

  const playerSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      playerSearchAbortRef.current?.abort();
      const controller = new AbortController();
      playerSearchAbortRef.current = controller;
      const trimmed = query.trim();
      const isAccountIdQuery = /^\d+$/.test(trimmed);

      if (isAndroid && !isAccountIdQuery) {
        throw new Error(
          t.searchAndroidAccountOnlyError,
        );
      }

      if (isAccountIdQuery) {
        try {
          const profile = await fetchPlayerProfile(trimmed, { signal: controller.signal, gameMode });
          return [{ id: trimmed, name: profile.info.nickname }];
        } finally {
          if (playerSearchAbortRef.current === controller) {
            playerSearchAbortRef.current = null;
          }
        }
      }

      try {
        return await searchPlayers(trimmed, { signal: controller.signal, gameMode });
      } finally {
        if (playerSearchAbortRef.current === controller) {
          playerSearchAbortRef.current = null;
        }
      }
    },
    onSuccess: (data) => {
      setPlayerResults(data);
      setPlayerHasSearched(true);
      setHasRetriedWithFreshToken(false);
    },
    onError: (error, query) => {
      if (isAbortRequestError(error)) {
        return;
      }
      if (!isAndroid && isTurnstileRequiredError(error)) {
        if (hasRetriedWithFreshToken) {
          setHasRetriedWithFreshToken(false);
          setIsTokenResolving(false);
          setTokenModalVisible(false);
          setPendingPlayerQuery('');
          setPlayerHasSearched(false);
          setInputError(t.searchVerifyFailed);
          return;
        }
        setIsTokenResolving(true);
        setPendingPlayerQuery(query);
        setTokenModalVisible(true);
        setPlayerResults([]);
        setPlayerHasSearched(false);
        return;
      }
      setHasRetriedWithFreshToken(false);
      setPlayerHasSearched(true);
    },
  });

  const tasksQuery = useQuery({
    queryKey: ['tasks', language, gameMode],
    queryFn: ({ signal }) => fetchTaskSummaries(language, { signal, gameMode }),
    enabled: isFocused && searchMode === 'task',
    staleTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: 'always',
  });
  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const tradersQuery = useQuery({
    queryKey: ['traders', language, gameMode],
    queryFn: ({ signal }) => fetchTraders(language, { signal, gameMode }),
    enabled: isFocused && searchMode === 'trader',
    staleTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: 'always',
  });
  const allTraders = useMemo(() => tradersQuery.data ?? [], [tradersQuery.data]);

  const bossesQuery = useQuery({
    queryKey: ['bosses', language, gameMode],
    queryFn: ({ signal }) => fetchBosses(language, { signal, gameMode }),
    enabled: isFocused && searchMode === 'boss',
    staleTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: 'always',
  });
  const allBosses = useMemo(() => bossesQuery.data ?? [], [bossesQuery.data]);

  const itemTypeCategoriesQuery = useQuery({
    queryKey: ['item-categories', 'en'],
    queryFn: ({ signal }) => fetchItemCategories('en', { signal }),
    enabled: isFocused && searchMode === 'item',
    staleTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: 'always',
  });

  const topLevelItemTypes = useMemo(() => {
    const categories = itemTypeCategoriesQuery.data ?? [];
    if (categories.length === 0) return [] as string[];

    const roots = new Set<string>();
    const childSetMap = new Map<string, Set<string>>();
    const normalizedByName = new Map<string, string>();

    const addChild = (parentName: string, childName: string) => {
      const parent = parentName.trim();
      const child = childName.trim();
      if (!parent || !child || parent === child) return;
      if (!childSetMap.has(parent)) {
        childSetMap.set(parent, new Set<string>());
      }
      childSetMap.get(parent)?.add(child);
    };

    for (const category of categories) {
      const name = String(category.name || '').trim();
      if (!name) continue;

      normalizedByName.set(name, String(category.normalizedName || '').trim().toLowerCase());
      const parentName = String(category.parent?.name || '').trim();
      if (!parentName) {
        roots.add(name);
      } else {
        addChild(parentName, name);
      }

      for (const child of category.children ?? []) {
        const childName = String(child.name || '').trim();
        if (!childName) continue;
        addChild(name, childName);
      }
    }

    const virtualRoot = Array.from(normalizedByName.entries()).find(([, normalized]) => normalized === 'item')?.[0]
      || (roots.size === 1 ? Array.from(roots)[0] : undefined);

    let top = virtualRoot ? Array.from(childSetMap.get(virtualRoot) ?? []) : Array.from(roots);
    top = top.filter((name) => {
      const normalized = name.trim().toLowerCase();
      if (!normalized) return false;
      if (virtualRoot && name === virtualRoot) return false;
      return normalized !== 'item';
    });

    const locale = language === 'zh' ? 'zh-Hans-CN' : language === 'ru' ? 'ru-RU' : 'en';
    return Array.from(new Set(top)).sort((a, b) => (
      localizeCategoryName(a, language).localeCompare(localizeCategoryName(b, language), locale)
    ));
  }, [itemTypeCategoriesQuery.data, language]);

  const taskTraderOptions = useMemo(() => {
    const map = new Map<string, string>();
    allTasks.forEach((task) => {
      const key = task.trader.normalizedName || task.trader.name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, localizeTraderName(task.trader.name, task.trader.normalizedName, language));
      }
    });
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTasks, language]);

  const taskLevelOptions = useMemo(() => {
    const values = new Set<number>();
    allTasks.forEach((task) => {
      values.add(task.minPlayerLevel ?? 0);
    });
    return Array.from(values).sort((a, b) => a - b);
  }, [allTasks]);

  const taskFactionOptions = useMemo(() => {
    const map = new Map<string, string>();
    allTasks.forEach((task) => {
      const key = getFactionKey(task.factionName);
      if (!map.has(key)) {
        map.set(key, getFactionLabel(task.factionName, t.taskAnyFaction));
      }
    });
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => {
        if (a.key === 'any') return -1;
        if (b.key === 'any') return 1;
        return a.name.localeCompare(b.name);
      });
  }, [allTasks, t.taskAnyFaction]);

  const taskMapOptions = useMemo(() => {
    const map = new Map<string, string>();
    allTasks.forEach((task) => {
      const key = getTaskMapKey(task);
      if (!map.has(key)) {
        map.set(key, getTaskMapLabel(task, t.taskAnyMap));
      }
    });
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => {
        if (a.key === 'any') return -1;
        if (b.key === 'any') return 1;
        return a.name.localeCompare(b.name);
      });
  }, [allTasks, t.taskAnyMap]);

  const selectedTaskTraderSet = useMemo(() => new Set(selectedTaskTraders), [selectedTaskTraders]);
  const selectedTaskLevelSet = useMemo(() => new Set(selectedTaskLevels), [selectedTaskLevels]);
  const selectedTaskMapSet = useMemo(() => new Set(selectedTaskMaps), [selectedTaskMaps]);
  const selectedTaskFactionSet = useMemo(() => new Set(selectedTaskFactions), [selectedTaskFactions]);

  const filteredTaskResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return allTasks
      .filter((task) => {
        if (selectedTaskTraderSet.size === 0) return true;
        const traderKey = task.trader.normalizedName || task.trader.name.toLowerCase();
        return selectedTaskTraderSet.has(traderKey);
      })
      .filter((task) => {
        if (selectedTaskLevelSet.size === 0) return true;
        return selectedTaskLevelSet.has(task.minPlayerLevel ?? 0);
      })
      .filter((task) => {
        if (selectedTaskMapSet.size === 0) return true;
        return selectedTaskMapSet.has(getTaskMapKey(task));
      })
      .filter((task) => {
        if (selectedTaskFactionSet.size === 0) return true;
        return selectedTaskFactionSet.has(getFactionKey(task.factionName));
      })
      .filter((task) => {
        return (!only3x4Required || !!task.kappaRequired)
          && (!onlyLightkeeperRequired || !!task.lightkeeperRequired);
      })
      .filter((task) => {
        if (!query) return true;
        const mapName = task.map?.name?.toLowerCase() ?? '';
        return (
          task.name.toLowerCase().includes(query) ||
          task.trader.name.toLowerCase().includes(query) ||
          mapName.includes(query)
        );
      })
      .sort((a, b) => {
        const aLevel = a.minPlayerLevel ?? 0;
        const bLevel = b.minPlayerLevel ?? 0;
        if (aLevel !== bLevel) return aLevel - bLevel;
        const traderCompare = a.trader.name.localeCompare(b.trader.name);
        if (traderCompare !== 0) return traderCompare;
        return a.name.localeCompare(b.name);
      });
  }, [
    allTasks,
    only3x4Required,
    onlyLightkeeperRequired,
    searchText,
    selectedTaskFactionSet,
    selectedTaskLevelSet,
    selectedTaskMapSet,
    selectedTaskTraderSet,
  ]);

  const filteredTraderResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const list = [...allTraders];
    if (!query) {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list
      .filter((trader) => (
        trader.name.toLowerCase().includes(query) ||
        (trader.normalizedName ?? '').toLowerCase().includes(query)
      ))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTraders, searchText]);

  const filteredBossResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const list = [...allBosses];
    const sortByName = (a: BossDetail, b: BossDetail) => String(a.name || '').localeCompare(String(b.name || ''));
    if (!query) {
      return list.sort(sortByName);
    }
    return list
      .filter((boss) => {
        const name = String(boss.name || '').toLowerCase();
        const normalizedName = String(boss.normalizedName || '').toLowerCase();
        const localizedName = localizeBossName(String(boss.name || ''), boss.normalizedName, language).toLowerCase();
        return name.includes(query) || normalizedName.includes(query) || localizedName.includes(query);
      })
      .sort(sortByName);
  }, [allBosses, language, searchText]);

  const {
    mutate: runItemSearch,
    reset: resetItemSearch,
    isPending: isItemPending,
    isError: isItemError,
    error: itemError,
  } = itemSearchMutation;

  const {
    mutate: runPlayerSearch,
    reset: resetPlayerSearch,
    isPending: isPlayerPending,
    isError: isPlayerError,
    error: playerError,
  } = playerSearchMutation;

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      itemSearchAbortRef.current?.abort();
      playerSearchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isFocused) return;
    itemSearchAbortRef.current?.abort();
    playerSearchAbortRef.current?.abort();
    setTokenModalVisible(false);
    setIsTokenResolving(false);
  }, [isFocused]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    itemResults.forEach((item) => {
      if (item.category?.name) set.add(item.category.name);
    });
    const locale = language === 'zh' ? 'zh-Hans-CN' : language === 'ru' ? 'ru-RU' : 'en';
    return Array.from(set).sort((a, b) => (
      localizeCategoryName(a, language).localeCompare(localizeCategoryName(b, language), locale)
    ));
  }, [itemResults, language]);

  const effectiveCategories = useMemo(() => {
    if (categoryFilter.length === 0) return [];
    const availableSet = new Set(availableCategories);
    return categoryFilter.filter((category) => availableSet.has(category));
  }, [availableCategories, categoryFilter]);

  const selectedCategorySet = useMemo(() => new Set(effectiveCategories), [effectiveCategories]);

  useEffect(() => {
    if (categoryFilter.length === 0) return;
    if (effectiveCategories.length === categoryFilter.length) return;
    setCategoryFilter(effectiveCategories);
  }, [categoryFilter, effectiveCategories]);

  useEffect(() => {
    if (draftCategories.length === 0) return;
    const availableSet = new Set(availableCategories);
    const nextDraft = draftCategories.filter((category) => availableSet.has(category));
    if (nextDraft.length === draftCategories.length) return;
    setDraftCategories(nextDraft);
  }, [availableCategories, draftCategories]);

  const filteredItemResults = useMemo(() => {
    let next = itemResults;
    if (effectiveCategories.length > 0) {
      next = next.filter((item) => item.category?.name && selectedCategorySet.has(item.category.name));
    }

    const sorted = [...next].sort((a, b) => {
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortKey === 'changeLast48hPercent') {
        const aVal = a.changeLast48hPercent ?? -Infinity;
        const bVal = b.changeLast48hPercent ?? -Infinity;
        return aVal - bVal;
      }
      return getItemPrimaryPrice(a) - getItemPrimaryPrice(b);
    });

    if (sortDir === 'desc') sorted.reverse();
    return sorted;
  }, [effectiveCategories, itemResults, selectedCategorySet, sortDir, sortKey]);

  const visibleItemResults = useMemo(
    () => filteredItemResults.slice(0, itemVisibleCount),
    [filteredItemResults, itemVisibleCount],
  );
  const visiblePlayerResults = useMemo(
    () => playerResults.slice(0, playerVisibleCount),
    [playerResults, playerVisibleCount],
  );
  const visibleTaskResults = useMemo(
    () => filteredTaskResults.slice(0, taskVisibleCount),
    [filteredTaskResults, taskVisibleCount],
  );
  const visibleTraderResults = useMemo(
    () => filteredTraderResults.slice(0, traderVisibleCount),
    [filteredTraderResults, traderVisibleCount],
  );
  const visibleBossResults = useMemo(
    () => filteredBossResults.slice(0, bossVisibleCount),
    [bossVisibleCount, filteredBossResults],
  );

  const handleLoadMoreItems = useCallback(() => {
    if (isItemPending) return;
    if (itemVisibleCount >= filteredItemResults.length) return;
    setItemVisibleCount((prev) => Math.min(prev + SEARCH_LIST_PAGE_SIZE, filteredItemResults.length));
  }, [filteredItemResults.length, isItemPending, itemVisibleCount]);
  const handleLoadMorePlayers = useCallback(() => {
    if (isPlayerPending) return;
    if (playerVisibleCount >= playerResults.length) return;
    setPlayerVisibleCount((prev) => Math.min(prev + SEARCH_LIST_PAGE_SIZE, playerResults.length));
  }, [isPlayerPending, playerResults.length, playerVisibleCount]);
  const handleLoadMoreTasks = useCallback(() => {
    if (tasksQuery.isLoading) return;
    if (taskVisibleCount >= filteredTaskResults.length) return;
    setTaskVisibleCount((prev) => Math.min(prev + SEARCH_LIST_PAGE_SIZE, filteredTaskResults.length));
  }, [filteredTaskResults.length, taskVisibleCount, tasksQuery.isLoading]);
  const handleLoadMoreTraders = useCallback(() => {
    if (tradersQuery.isLoading) return;
    if (traderVisibleCount >= filteredTraderResults.length) return;
    setTraderVisibleCount((prev) => Math.min(prev + SEARCH_LIST_PAGE_SIZE, filteredTraderResults.length));
  }, [filteredTraderResults.length, traderVisibleCount, tradersQuery.isLoading]);
  const handleLoadMoreBosses = useCallback(() => {
    if (bossesQuery.isLoading) return;
    if (bossVisibleCount >= filteredBossResults.length) return;
    setBossVisibleCount((prev) => Math.min(prev + SEARCH_LIST_PAGE_SIZE, filteredBossResults.length));
  }, [bossVisibleCount, bossesQuery.isLoading, filteredBossResults.length]);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(RECENT_PLAYERS_STORAGE_KEY)
      .then((raw) => {
        if (!isMounted || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          const normalized: SearchResult[] = parsed
            .map((entry) => ({
              id: String((entry as { id?: unknown })?.id || '').trim(),
              name: String((entry as { name?: unknown })?.name || '').trim(),
            }))
            .filter((entry) => entry.id)
            .map((entry) => ({
              id: entry.id,
              name: entry.name || entry.id,
            }))
            .slice(0, RECENT_PLAYERS_MAX);
          setRecentPlayers(normalized);
        } catch {
          // ignore invalid cache
        }
      })
      .catch(() => {
        // ignore storage errors
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setItemVisibleCount(SEARCH_LIST_PAGE_SIZE);
  }, [filteredItemResults]);
  useEffect(() => {
    setPlayerVisibleCount(SEARCH_LIST_PAGE_SIZE);
  }, [playerResults]);
  useEffect(() => {
    setTaskVisibleCount(SEARCH_LIST_PAGE_SIZE);
  }, [filteredTaskResults]);
  useEffect(() => {
    setTraderVisibleCount(SEARCH_LIST_PAGE_SIZE);
  }, [filteredTraderResults]);
  useEffect(() => {
    setBossVisibleCount(SEARCH_LIST_PAGE_SIZE);
  }, [filteredBossResults]);

  const handleSortSelect = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(key === 'name' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  const handleOpenItem = useCallback((item: ItemSearchResult) => {
    if (!item.id) return;
    router.push({
      pathname: '/(tabs)/search/item/[id]',
      params: {
        id: item.id,
        name: item.name || '',
        shortName: item.shortName || '',
        normalizedName: item.normalizedName || '',
        categoryName: item.category?.name || '',
        iconLink: item.iconLink || '',
        gridImageLink: item.gridImageLink || '',
        baseImageLink: item.baseImageLink || '',
        wikiLink: item.wikiLink || '',
      },
    });
  }, [router]);

  const saveRecentPlayer = useCallback((entry: SearchResult) => {
    const accountId = String(entry.id || '').trim();
    if (!accountId) return;
    const name = String(entry.name || '').trim() || accountId;
    setRecentPlayers((previous) => {
      const next = [{ id: accountId, name }, ...previous.filter((item) => item.id !== accountId)]
        .slice(0, RECENT_PLAYERS_MAX);
      void AsyncStorage.setItem(RECENT_PLAYERS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleOpenPlayer = useCallback((player: SearchResult) => {
    const accountId = String(player.id || '').trim();
    if (!accountId) return;
    saveRecentPlayer({ id: accountId, name: String(player.name || '').trim() || accountId });
    Keyboard.dismiss();
    router.push({ pathname: '/(tabs)/search/player', params: { accountId } });
  }, [router, saveRecentPlayer]);

  const handleOpenTask = useCallback((task: TaskDetail) => {
    router.push({
      pathname: '/(tabs)/search/task/[id]',
      params: {
        id: task.id,
        name: task.name || '',
        normalizedName: task.normalizedName || '',
        mapName: task.map?.name || '',
        taskImageLink: task.taskImageLink || '',
        traderId: task.trader.id || task.trader.normalizedName || task.trader.name || '',
        traderName: task.trader.name || '',
        traderNormalizedName: task.trader.normalizedName || '',
        traderImageLink: task.trader.imageLink || '',
        minPlayerLevel: String(task.minPlayerLevel ?? 0),
        experience: String(task.experience ?? 0),
        kappaRequired: task.kappaRequired ? '1' : '0',
        lightkeeperRequired: task.lightkeeperRequired ? '1' : '0',
      },
    });
  }, [router]);

  const handleOpenTrader = useCallback((trader: TraderDetail) => {
    const traderId = String(trader.id || trader.normalizedName || trader.name || '').trim();
    if (!traderId) return;
    router.push({
      pathname: '/(tabs)/search/trader/[id]',
      params: {
        id: traderId,
        name: trader.name || '',
        normalizedName: trader.normalizedName || '',
        imageLink: trader.imageLink || '',
        description: trader.description || '',
        resetTime: trader.resetTime || '',
      },
    });
  }, [router]);

  const handleOpenBoss = useCallback((boss: BossDetail) => {
    const bossId = String(boss.id || boss.normalizedName || boss.name || '').trim();
    if (!bossId) return;
    router.push({
      pathname: '/(tabs)/search/boss/[id]',
      params: {
        id: bossId,
        name: boss.name || '',
        normalizedName: boss.normalizedName || '',
        imagePortraitLink: boss.imagePortraitLink || '',
        imagePosterLink: boss.imagePosterLink || '',
      },
    });
  }, [router]);

  const handleOpenItemTypeCategory = useCallback((categoryName: string) => {
    const category = String(categoryName || '').trim();
    if (!category) return;
    router.push({
      pathname: '/(tabs)/search/item-types',
      params: { category },
    });
  }, [router]);

  const handleSearch = useCallback(() => {
    const query = searchText.trim();
    if (!query && searchMode !== 'task' && searchMode !== 'trader' && searchMode !== 'boss') return;
    const isAccountIdQuery = /^\d+$/.test(query);

    Keyboard.dismiss();
    setInputError('');

    if (searchMode === 'item') {
      playerSearchAbortRef.current?.abort();
      resetItemSearch();
      runItemSearch(query);
      return;
    }

    if (searchMode === 'task') {
      itemSearchAbortRef.current?.abort();
      playerSearchAbortRef.current?.abort();
      void tasksQuery.refetch();
      return;
    }

    if (searchMode === 'trader') {
      itemSearchAbortRef.current?.abort();
      playerSearchAbortRef.current?.abort();
      void tradersQuery.refetch();
      return;
    }
    if (searchMode === 'boss') {
      itemSearchAbortRef.current?.abort();
      playerSearchAbortRef.current?.abort();
      void bossesQuery.refetch();
      return;
    }

    if (isAndroid && !isAccountIdQuery) {
      setInputError(t.searchAndroidAccountOnlyError);
      setPlayerResults([]);
      setPlayerHasSearched(false);
      return;
    }

    if (!isAccountIdQuery && query.length < 3) {
      setInputError(t.searchPlayerNameTooShort);
      setPlayerResults([]);
      setPlayerHasSearched(false);
      return;
    }

    setHasRetriedWithFreshToken(false);
    itemSearchAbortRef.current?.abort();
    resetPlayerSearch();
    runPlayerSearch(query);
  }, [
    isAndroid,
    resetItemSearch,
    resetPlayerSearch,
    runItemSearch,
    runPlayerSearch,
    searchMode,
    searchText,
    t.searchAndroidAccountOnlyError,
    t.searchPlayerNameTooShort,
    bossesQuery,
    tasksQuery,
    tradersQuery,
  ]);

  const handleRefetchActiveMode = useCallback(() => {
    if (searchMode === 'task') {
      void tasksQuery.refetch();
      return;
    }
    if (searchMode === 'trader') {
      void tradersQuery.refetch();
      return;
    }
    if (searchMode === 'boss') {
      void bossesQuery.refetch();
    }
  }, [bossesQuery, searchMode, tasksQuery, tradersQuery]);

  const handleClear = useCallback(() => {
    setSearchText('');
    setInputError('');

    if (searchMode === 'item') {
      itemSearchAbortRef.current?.abort();
      setItemResults([]);
      setItemHasSearched(false);
      resetItemSearch();
      return;
    }

    if (searchMode === 'task') {
      return;
    }

    if (searchMode === 'trader') {
      return;
    }
    if (searchMode === 'boss') {
      return;
    }

    playerSearchAbortRef.current?.abort();
    setPlayerResults([]);
    setPlayerHasSearched(false);
    setHasRetriedWithFreshToken(false);
    resetPlayerSearch();
  }, [resetItemSearch, resetPlayerSearch, searchMode]);

  const handleSearchTextChange = useCallback((value: string) => {
    setSearchText(value);
    if (inputError) setInputError('');
    if (searchMode === 'item') {
      itemSearchAbortRef.current?.abort();
      setItemResults([]);
      setItemHasSearched(false);
      resetItemSearch();
      return;
    }
    if (searchMode === 'player') {
      playerSearchAbortRef.current?.abort();
    }
  }, [inputError, resetItemSearch, searchMode]);

  const handleModeChange = useCallback((mode: SearchMode) => {
    if (mode === searchMode) return;

    itemSearchAbortRef.current?.abort();
    playerSearchAbortRef.current?.abort();
    setSearchMode(mode);
    setSearchText('');
    setInputError('');

    setItemResults([]);
    setItemHasSearched(false);
    resetItemSearch();

    setPlayerResults([]);
    setPlayerHasSearched(false);
    resetPlayerSearch();
    setTokenModalVisible(false);
    setPendingPlayerQuery('');
    setIsTokenResolving(false);
    setHasRetriedWithFreshToken(false);

    setCategoryModalOpen(false);
    setTaskTraderModalOpen(false);
    setTaskLevelModalOpen(false);
    setTaskMapModalOpen(false);
    setTaskFactionModalOpen(false);
  }, [resetItemSearch, resetPlayerSearch, searchMode]);
  const handleTokenModalClose = useCallback(() => {
    setTokenModalVisible(false);
    setPendingPlayerQuery('');
    setIsTokenResolving(false);
    setHasRetriedWithFreshToken(false);
  }, []);
  const handleTokenCaptured = useCallback(async (token: string) => {
    await savePlayerSearchToken(token);
    setTokenModalVisible(false);
    setPendingPlayerQuery('');
    setIsTokenResolving(false);
    setInputError('');
    const retryQuery = pendingPlayerQuery || searchText.trim();
    if (!retryQuery || retryQuery.length < 3 || /^\d+$/.test(retryQuery)) {
      return;
    }
    setHasRetriedWithFreshToken(true);
    resetPlayerSearch();
    runPlayerSearch(retryQuery);
  }, [pendingPlayerQuery, resetPlayerSearch, runPlayerSearch, searchText]);
  const handleTokenCaptureError = useCallback(() => {
    const retryQuery = pendingPlayerQuery || searchText.trim();
      setTokenModalVisible(false);
      setPendingPlayerQuery('');
      setIsTokenResolving(false);
      setHasRetriedWithFreshToken(false);
      if (retryQuery) {
        setInputError(t.searchVerifyFailed);
      }
  }, [pendingPlayerQuery, searchText, t.searchVerifyFailed]);

  const openCategoryModal = useCallback(() => {
    setDraftCategories(effectiveCategories);
    setCategoryModalOpen(true);
  }, [effectiveCategories]);

  const closeCategoryModal = useCallback(() => {
    setCategoryModalOpen(false);
  }, []);

  const toggleDraftCategory = useCallback((category: string) => {
    setDraftCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((item) => item !== category);
      }
      return [...prev, category];
    });
  }, []);

  const applyCategoryFilter = useCallback(() => {
    setCategoryFilter(draftCategories);
    setCategoryModalOpen(false);
  }, [draftCategories]);

  const clearCategoryFilter = useCallback(() => {
    setDraftCategories([]);
  }, []);

  const draftCategorySet = useMemo(() => new Set(draftCategories), [draftCategories]);

  const openTaskTraderModal = useCallback(() => {
    setDraftTaskTraders(selectedTaskTraders);
    setTaskTraderModalOpen(true);
  }, [selectedTaskTraders]);
  const closeTaskTraderModal = useCallback(() => {
    setTaskTraderModalOpen(false);
  }, []);
  const toggleDraftTaskTrader = useCallback((key: string) => {
    setDraftTaskTraders((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      return [...prev, key];
    });
  }, []);
  const clearTaskTraderFilter = useCallback(() => {
    setDraftTaskTraders([]);
  }, []);
  const applyTaskTraderFilter = useCallback(() => {
    setSelectedTaskTraders(draftTaskTraders);
    setTaskTraderModalOpen(false);
  }, [draftTaskTraders]);
  const draftTaskTraderSet = useMemo(() => new Set(draftTaskTraders), [draftTaskTraders]);

  const openTaskLevelModal = useCallback(() => {
    setDraftTaskLevels(selectedTaskLevels);
    setTaskLevelModalOpen(true);
  }, [selectedTaskLevels]);
  const closeTaskLevelModal = useCallback(() => {
    setTaskLevelModalOpen(false);
  }, []);
  const toggleDraftTaskLevel = useCallback((level: number) => {
    setDraftTaskLevels((prev) => {
      if (prev.includes(level)) return prev.filter((item) => item !== level);
      return [...prev, level];
    });
  }, []);
  const clearTaskLevelFilter = useCallback(() => {
    setDraftTaskLevels([]);
  }, []);
  const applyTaskLevelFilter = useCallback(() => {
    setSelectedTaskLevels(draftTaskLevels);
    setTaskLevelModalOpen(false);
  }, [draftTaskLevels]);
  const draftTaskLevelSet = useMemo(() => new Set(draftTaskLevels), [draftTaskLevels]);

  const openTaskMapModal = useCallback(() => {
    setDraftTaskMaps(selectedTaskMaps);
    setTaskMapModalOpen(true);
  }, [selectedTaskMaps]);
  const closeTaskMapModal = useCallback(() => {
    setTaskMapModalOpen(false);
  }, []);
  const toggleDraftTaskMap = useCallback((key: string) => {
    setDraftTaskMaps((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      return [...prev, key];
    });
  }, []);
  const clearTaskMapFilter = useCallback(() => {
    setDraftTaskMaps([]);
  }, []);
  const applyTaskMapFilter = useCallback(() => {
    setSelectedTaskMaps(draftTaskMaps);
    setTaskMapModalOpen(false);
  }, [draftTaskMaps]);
  const draftTaskMapSet = useMemo(() => new Set(draftTaskMaps), [draftTaskMaps]);

  const openTaskFactionModal = useCallback(() => {
    setDraftTaskFactions(selectedTaskFactions);
    setTaskFactionModalOpen(true);
  }, [selectedTaskFactions]);
  const closeTaskFactionModal = useCallback(() => {
    setTaskFactionModalOpen(false);
  }, []);
  const toggleDraftTaskFaction = useCallback((key: string) => {
    setDraftTaskFactions((prev) => {
      if (prev.includes(key)) return prev.filter((item) => item !== key);
      return [...prev, key];
    });
  }, []);
  const clearTaskFactionFilter = useCallback(() => {
    setDraftTaskFactions([]);
  }, []);
  const applyTaskFactionFilter = useCallback(() => {
    setSelectedTaskFactions(draftTaskFactions);
    setTaskFactionModalOpen(false);
  }, [draftTaskFactions]);
  const draftTaskFactionSet = useMemo(() => new Set(draftTaskFactions), [draftTaskFactions]);
  const themeStyles = useMemo(() => ({
    modeChipActive: {
      borderColor: accentTheme.accent,
      backgroundColor: accentTheme.accentSoft15,
    },
    sortFilterActive: {
      borderColor: accentTheme.accent,
      backgroundColor: accentTheme.accentSoft15,
    },
    actionButton: {
      borderColor: accentTheme.accentDim,
      backgroundColor: accentTheme.accentSoft12,
    },
    playerAvatar: {
      backgroundColor: accentTheme.accentSoft12,
    },
    taskGoldChip: {
      borderColor: accentTheme.accentDim,
      backgroundColor: accentTheme.accentSoft16,
    },
    taskGoldText: {
      color: accentTheme.accent,
    },
    taskBlueChip: {
      borderColor: accentTheme.accentBorder45,
      backgroundColor: accentTheme.accentSoft18,
    },
    taskBlueText: {
      color: accentTheme.accentTextStrong,
    },
    primaryAction: {
      backgroundColor: accentTheme.accent,
      borderColor: accentTheme.accent,
    },
    primaryActionText: {
      color: accentTheme.accentTextOnSolid,
    },
  }), [accentTheme]);

  const renderItemResult = useCallback(({ item }: { item: ItemSearchResult }) => {
    const change = item.changeLast48hPercent ?? 0;
    const changeColor = change > 0 ? Colors.statGreen : change < 0 ? Colors.statRed : Colors.textSecondary;
    const imageUri = item.gridImageLink || item.baseImageLink || item.iconLink;

    return (
      <View style={styles.resultRowWrap}>
        <TouchableOpacity style={styles.resultRow} onPress={() => handleOpenItem(item)} activeOpacity={0.7}>
          <TouchableOpacity
            style={styles.resultAvatar}
            onPress={() => {
              if (!imageUri) return;
              setPreviewUri(imageUri);
              setPreviewVisible(true);
            }}
            activeOpacity={0.8}
            disabled={!imageUri}
          >
            {item.iconLink ? (
              <Image source={{ uri: item.iconLink }} style={styles.resultIcon} contentFit="contain" />
            ) : (
              <View style={styles.resultIconPlaceholder} />
            )}
          </TouchableOpacity>
          <View style={styles.resultInfo}>
            <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.resultMeta} numberOfLines={1}>
              {item.shortName ? `${item.shortName} - ` : ''}
              {item.category?.name ? localizeCategoryName(item.category.name, language) : t.searchUnknown}
            </Text>
          </View>
          <View style={styles.resultPriceBlock}>
            <Text style={styles.priceLabel}>{t.searchSortPrice}</Text>
            <Text style={styles.priceValue}>{formatPrice(item.avg24hPrice)}</Text>
            <Text style={[styles.changeValue, { color: changeColor }]}>
              {item.changeLast48hPercent !== undefined ? `${change.toFixed(1)}%` : '-'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [handleOpenItem, language, t.searchSortPrice, t.searchUnknown]);

  const renderPlayerRow = useCallback((item: SearchResult, metaText: string) => (
    <TouchableOpacity
      style={styles.playerRow}
      onPress={() => handleOpenPlayer(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.playerAvatar, themeStyles.playerAvatar]}>
        <User size={20} color={Colors.gold} />
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.playerMeta} numberOfLines={1}>
          {metaText}
        </Text>
      </View>
      <ChevronRight size={18} color={Colors.textSecondary} />
    </TouchableOpacity>
  ), [handleOpenPlayer, themeStyles.playerAvatar]);

  const renderPlayerResult = useCallback(({ item }: { item: SearchResult }) => {
    return (
      <View style={styles.resultRowWrap}>
        {renderPlayerRow(item, t.searchPlayerTapHint)}
      </View>
    );
  }, [renderPlayerRow, t.searchPlayerTapHint]);

  const renderTraderResult = useCallback(({ item }: { item: TraderDetail }) => {
    const traderName = localizeTraderName(item.name, item.normalizedName, language);
    const traderDesc = localizeUnknownText(item.description, t.searchUnknown);
    const resetCountdown = formatCountdownToTimestamp(item.resetTime, nowTick);
    return (
      <View style={styles.resultRowWrap}>
        <TouchableOpacity
          style={styles.traderRow}
          onPress={() => handleOpenTrader(item)}
          activeOpacity={0.75}
        >
          <View style={styles.traderAvatarWrap}>
            {item.imageLink ? (
              <Image source={{ uri: item.imageLink }} style={styles.traderAvatar} contentFit="cover" />
            ) : (
              <View style={styles.traderAvatarFallback} />
            )}
          </View>
          <View style={styles.traderInfo}>
            <Text style={styles.traderName} numberOfLines={1}>{traderName}</Text>
            <Text style={styles.traderMeta} numberOfLines={1}>
              {t.traderResetTime}: {resetCountdown}
            </Text>
            <Text style={styles.traderMeta} numberOfLines={1}>
              {traderDesc || t.traderDescription}
            </Text>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }, [handleOpenTrader, language, nowTick, t.searchUnknown, t.traderDescription, t.traderResetTime]);

  const renderBossResult = useCallback(({ item }: { item: BossDetail }) => {
    const bossId = String(item.id || item.normalizedName || item.name || '').trim();
    const imageUri = item.imagePortraitLink || item.imagePosterLink || '';
    const bossName = localizeBossName(String(item.name || '-'), item.normalizedName, language);
    const totalHp = (item.health ?? []).reduce((sum, part) => {
      const hp = Number(part?.max ?? 0);
      return sum + (Number.isFinite(hp) ? hp : 0);
    }, 0);
    const mapText = Array.from(
      new Set(
        (item.maps ?? [])
          .map((mapRow) => String(mapRow?.name || '').trim())
          .filter(Boolean),
      ),
    ).join(' / ');
    return (
      <View style={styles.resultRowWrap}>
        <TouchableOpacity
          style={styles.traderRow}
          onPress={() => handleOpenBoss(item)}
          activeOpacity={0.75}
          disabled={!bossId}
        >
          <View style={styles.traderAvatarWrap}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.traderAvatar} contentFit="cover" />
            ) : (
              <View style={styles.traderAvatarFallback} />
            )}
          </View>
          <View style={styles.traderInfo}>
            <Text style={styles.traderName} numberOfLines={1}>{bossName}</Text>
            <Text style={styles.traderMeta} numberOfLines={1}>
              {t.searchBossHp}: {totalHp > 0 ? totalHp : '-'}
            </Text>
            <Text style={styles.traderMeta} numberOfLines={1}>
              {mapText || t.bossNoSpawns}
            </Text>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }, [handleOpenBoss, language, t.bossNoSpawns, t.searchBossHp]);

  const renderTaskResult = useCallback(({ item }: { item: TaskDetail }) => {
    const level = item.minPlayerLevel ?? 0;
    const traderName = localizeTraderName(item.trader.name, item.trader.normalizedName, language);
    return (
      <View style={styles.resultRowWrap}>
        <TouchableOpacity style={styles.taskRow} activeOpacity={0.75} onPress={() => handleOpenTask(item)}>
          <View style={styles.taskImageWrap}>
            {item.taskImageLink ? (
              <Image source={{ uri: item.taskImageLink }} style={styles.taskImage} contentFit="cover" />
            ) : (
              <View style={styles.taskImagePlaceholder} />
            )}
          </View>
          <View style={styles.taskMain}>
            <Text style={styles.taskTitle} numberOfLines={2}>{item.name}</Text>
            <View style={styles.taskMetaRow}>
              <View style={styles.taskTraderInline}>
                <View style={styles.taskTraderAvatarWrap}>
                  {item.trader.imageLink ? (
                    <Image source={{ uri: item.trader.imageLink }} style={styles.taskTraderAvatar} contentFit="cover" />
                  ) : (
                    <View style={styles.taskTraderAvatarFallback} />
                  )}
                </View>
                <Text style={styles.taskTraderName} numberOfLines={1}>{traderName}</Text>
              </View>
              <Text style={styles.taskMapMeta} numberOfLines={1}>{item.map?.name || t.taskAnyMap}</Text>
            </View>
            <View style={styles.taskStatsRow}>
              <View style={styles.taskStatChip}>
                <Text style={styles.taskStatText}>{t.level} {level}</Text>
              </View>
              <View style={styles.taskStatChip}>
                <Text style={styles.taskStatText}>{getTaskXp(item)}</Text>
              </View>
              {item.kappaRequired ? (
                <View style={[styles.taskStatChip, styles.taskStatChipGold, themeStyles.taskGoldChip]}>
                  <Text style={[styles.taskStatText, styles.taskStatChipGoldText, themeStyles.taskGoldText]}>{t.taskTag3x4}</Text>
                </View>
              ) : null}
              {item.lightkeeperRequired ? (
                <View style={[styles.taskStatChip, styles.taskStatChipBlue, themeStyles.taskBlueChip]}>
                  <Text style={[styles.taskStatText, styles.taskStatChipBlueText, themeStyles.taskBlueText]}>{t.taskTagLightkeeper}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.taskChevronWrap}>
            <ChevronRight size={18} color={Colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [
    handleOpenTask,
    language,
    t.level,
    t.taskAnyMap,
    t.taskTag3x4,
    t.taskTagLightkeeper,
    themeStyles.taskBlueChip,
    themeStyles.taskBlueText,
    themeStyles.taskGoldChip,
    themeStyles.taskGoldText,
  ]);

  const renderItemSkeletonRows = useCallback((count = 6) => (
    <View style={styles.skeletonListWrap}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={`item-skeleton-${index}`} style={styles.resultRowWrap}>
          <View style={styles.resultRow}>
            <View style={styles.resultAvatar}>
              <ShimmerBlock width={26} height={26} borderRadius={6} />
            </View>
            <View style={styles.skeletonResultInfo}>
              <ShimmerBlock width="72%" height={14} />
              <ShimmerBlock width="52%" height={11} />
            </View>
            <View style={styles.skeletonPriceInfo}>
              <ShimmerBlock width={40} height={10} />
              <ShimmerBlock width={58} height={14} />
              <ShimmerBlock width={36} height={11} />
            </View>
          </View>
        </View>
      ))}
    </View>
  ), []);

  const renderPlayerSkeletonRows = useCallback((count = 6) => (
    <View style={styles.skeletonListWrap}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={`player-skeleton-${index}`} style={styles.resultRowWrap}>
          <View style={styles.playerRow}>
            <View style={[styles.playerAvatar, themeStyles.playerAvatar]}>
              <ShimmerBlock width={20} height={20} borderRadius={10} />
            </View>
            <View style={styles.playerInfo}>
              <ShimmerBlock width="56%" height={15} />
              <ShimmerBlock width="44%" height={12} />
            </View>
            <ShimmerBlock width={16} height={16} borderRadius={8} />
          </View>
        </View>
      ))}
    </View>
  ), [themeStyles.playerAvatar]);

  const renderTraderSkeletonRows = useCallback((count = 6) => (
    <View style={styles.skeletonListWrap}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={`trader-skeleton-${index}`} style={styles.resultRowWrap}>
          <View style={styles.traderRow}>
            <View style={styles.traderAvatarWrap}>
              <ShimmerBlock width={44} height={44} borderRadius={10} />
            </View>
            <View style={styles.traderInfo}>
              <ShimmerBlock width="52%" height={15} />
              <ShimmerBlock width="64%" height={12} />
              <ShimmerBlock width="80%" height={12} />
            </View>
            <ShimmerBlock width={16} height={16} borderRadius={8} />
          </View>
        </View>
      ))}
    </View>
  ), []);

  const renderTaskSkeletonRows = useCallback((count = 4) => (
    <View style={styles.skeletonListWrap}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={`task-skeleton-${index}`} style={styles.resultRowWrap}>
          <View style={styles.taskRow}>
            <View style={styles.taskImageWrap}>
              <ShimmerBlock width={30} height={30} borderRadius={8} />
            </View>
            <View style={styles.taskMain}>
              <ShimmerBlock width="82%" height={15} />
              <ShimmerBlock width="70%" height={15} />
              <View style={styles.taskMetaRow}>
                <View style={styles.taskTraderInline}>
                  <ShimmerBlock width={20} height={20} borderRadius={6} />
                  <ShimmerBlock width={74} height={12} />
                </View>
                <ShimmerBlock width={76} height={12} />
              </View>
              <View style={styles.taskStatsRow}>
                <ShimmerBlock width={62} height={20} borderRadius={999} />
                <ShimmerBlock width={58} height={20} borderRadius={999} />
                <ShimmerBlock width={84} height={20} borderRadius={999} />
              </View>
            </View>
            <View style={styles.taskChevronWrap}>
              <ShimmerBlock width={16} height={16} borderRadius={8} />
            </View>
          </View>
        </View>
      ))}
    </View>
  ), []);

  const activeErrorRaw = searchMode === 'item'
    ? (isItemError && !isAbortRequestError(itemError) ? (itemError as Error)?.message : '')
    : searchMode === 'player'
      ? (
        isPlayerError
        && !isTurnstileRequiredError(playerError)
        && !isAbortRequestError(playerError)
          ? (playerError as Error)?.message
          : ''
      )
      : searchMode === 'task'
        ? (tasksQuery.isError ? (tasksQuery.error as Error)?.message : '')
        : searchMode === 'trader'
          ? (tradersQuery.isError ? (tradersQuery.error as Error)?.message : '')
          : (bossesQuery.isError ? (bossesQuery.error as Error)?.message : '');
  const activeError = /abort|timeout/i.test(activeErrorRaw || '')
    ? t.searchRequestTimeout
    : activeErrorRaw;
  const showItemTypeGrid = searchMode === 'item'
    && searchText.trim().length === 0
    && !itemHasSearched
    && !isItemPending;
  const showRecentPlayers = searchMode === 'player'
    && recentPlayers.length > 0
    && !isPlayerPending
    && searchText.trim().length === 0
    && playerResults.length === 0
    && !playerHasSearched;

  const modeConfig = useMemo(() => ({
    task: { label: t.searchModeTask, Icon: ClipboardList },
    boss: { label: t.searchModeBoss, Icon: Skull },
    trader: { label: t.searchModeTrader, Icon: Store },
    item: { label: t.searchModeItem, Icon: Package },
    player: { label: t.searchModePlayer, Icon: User },
  }), [
    t.searchModeBoss,
    t.searchModeItem,
    t.searchModePlayer,
    t.searchModeTask,
    t.searchModeTrader,
  ]);

  const playerPlaceholder = isAndroid
    ? t.searchPlayerPlaceholderAccountId
    : t.searchPlayerPlaceholderNameOrId;

  const playerEmptyTitle = t.searchPlayerEmptyTitle;
  const playerEmptySub = isAndroid
    ? t.searchPlayerEmptySubAccountId
    : t.searchPlayerEmptySubName;

  const headerTitle = searchMode === 'item'
    ? t.searchHeaderTitle
    : searchMode === 'player'
      ? t.searchPlayerTitle
      : searchMode === 'task'
        ? t.tasksHeaderTitle
        : searchMode === 'trader'
          ? t.searchTraderTitle
          : t.searchBossTitle;
  const listTopInset = headerHeight + 10;
  const listBottomInset = Math.max(insets.bottom + 24, 30);
  const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0 && Math.abs(next - headerHeight) > 1) {
      setHeaderHeight(next);
    }
  }, [headerHeight]);

  const listHeaderContent = (
    <>
      <View style={styles.searchSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.modeSwitchScroll}
          contentContainerStyle={styles.modeSwitch}
        >
          {SEARCH_MODE_ORDER.map((mode) => {
            const config = modeConfig[mode];
            const active = searchMode === mode;
            const Icon = config.Icon;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.modeButton, active && styles.modeButtonActive, active && themeStyles.modeChipActive]}
                onPress={() => handleModeChange(mode)}
                activeOpacity={0.8}
              >
                <Icon size={14} color={active ? Colors.text : Colors.textSecondary} />
                <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>
                  {config.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Search size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={
                searchMode === 'item'
                  ? t.searchPlaceholder
                  : searchMode === 'player'
                    ? playerPlaceholder
                    : searchMode === 'task'
                      ? t.tasksSearchPlaceholder
                      : searchMode === 'trader'
                        ? t.searchTraderPlaceholder
                        : t.searchBossPlaceholder
              }
              placeholderTextColor={Colors.textTertiary}
              value={searchText}
              onChangeText={handleSearchTextChange}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={searchMode === 'player' && isAndroid ? 'number-pad' : 'default'}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              testID="search-input"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <X size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleSearch} style={[styles.searchActionButton, themeStyles.actionButton]} activeOpacity={0.7}>
            <ChevronRight size={22} color={Colors.gold} />
          </TouchableOpacity>
        </View>

        {!!inputError && (
          <Text style={searchMode === 'player' ? styles.searchHint : styles.errorText}>
            {inputError}
          </Text>
        )}
        {!inputError && !!activeError && (
          <Text style={searchMode === 'player' ? styles.searchHint : styles.errorText}>
            {activeError}
          </Text>
        )}
        {!inputError && !!activeError && (searchMode === 'task' || searchMode === 'trader' || searchMode === 'boss') && (
          <TouchableOpacity style={styles.inlineRetryButton} onPress={handleRefetchActiveMode} activeOpacity={0.8}>
            <Text style={styles.inlineRetryText}>{t.retry}</Text>
          </TouchableOpacity>
        )}
        {searchMode === 'player' && isAndroid && !inputError && !activeError && (
          <Text style={styles.searchHint}>
            {t.searchPlayerAndroidHint}
          </Text>
        )}

      </View>

      {showRecentPlayers && (
        <View style={styles.playerRecentSection}>
          <Text style={styles.playerRecentTitle}>{t.searchPlayerRecentTitle}</Text>
          {recentPlayers.map((player) => (
            <View key={`recent-player-${player.id}`} style={styles.resultRowWrap}>
              {renderPlayerRow(player, `${t.accountId}: ${player.id}`)}
            </View>
          ))}
        </View>
      )}

      {showItemTypeGrid && (
        <View style={styles.itemTypeGridSection}>
          {itemTypeCategoriesQuery.isLoading ? (
            <View style={styles.itemTypeLoadingWrap}>
              <ShimmerBlock width={190} height={14} />
            </View>
          ) : itemTypeCategoriesQuery.isError ? (
            <Text style={styles.errorText}>
              {(itemTypeCategoriesQuery.error as Error)?.message || ''}
            </Text>
          ) : (
            <View style={styles.itemTypeGrid}>
              {topLevelItemTypes.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={styles.itemTypeCard}
                  onPress={() => handleOpenItemTypeCategory(category)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.itemTypeCardText} numberOfLines={2}>
                    {localizeCategoryName(category, language)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {searchMode === 'item' && itemResults.length > 0 && (
        <View style={styles.filtersSection}>
          <View style={styles.sortRow}>
            <View style={styles.sortGroup}>
              <ArrowUpDown size={14} color={Colors.textSecondary} />
              <View style={styles.sortOptions}>
                {SORT_OPTIONS.map((opt) => {
                  const active = sortKey === opt.key;
                  const label = t[opt.labelKey as keyof typeof t] as string;
                  const arrowColor = active ? Colors.text : Colors.textSecondary;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.sortChip, active && styles.sortChipActive, active && themeStyles.sortFilterActive]}
                      onPress={() => handleSortSelect(opt.key)}
                    >
                      <View style={styles.sortChipContent}>
                        <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{label}</Text>
                        {active && (sortDir === 'asc'
                          ? <ArrowUp size={12} color={arrowColor} />
                          : <ArrowDown size={12} color={arrowColor} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.categoryButton, effectiveCategories.length > 0 && themeStyles.sortFilterActive]}
              onPress={openCategoryModal}
              activeOpacity={0.7}
            >
              <Filter size={14} color={Colors.textSecondary} />
              <Text style={styles.categoryButtonText}>
                {t.searchFilterCategory}{effectiveCategories.length > 0 ? ` (${effectiveCategories.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {searchMode === 'task' && (
        <View style={styles.taskFiltersSection}>
          <View style={styles.taskFilterButtonRow}>
            <TouchableOpacity
              style={[styles.categoryButton, selectedTaskTraders.length > 0 && themeStyles.sortFilterActive]}
              onPress={openTaskTraderModal}
              activeOpacity={0.75}
            >
              <Filter size={14} color={Colors.textSecondary} />
              <Text style={styles.categoryButtonText}>
                {t.taskFilterTrader}{selectedTaskTraders.length > 0 ? ` (${selectedTaskTraders.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoryButton, selectedTaskLevels.length > 0 && themeStyles.sortFilterActive]}
              onPress={openTaskLevelModal}
              activeOpacity={0.75}
            >
              <Filter size={14} color={Colors.textSecondary} />
              <Text style={styles.categoryButtonText}>
                {t.taskFilterLevel}{selectedTaskLevels.length > 0 ? ` (${selectedTaskLevels.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoryButton, selectedTaskMaps.length > 0 && themeStyles.sortFilterActive]}
              onPress={openTaskMapModal}
              activeOpacity={0.75}
            >
              <Filter size={14} color={Colors.textSecondary} />
              <Text style={styles.categoryButtonText}>
                {t.taskFilterMap}{selectedTaskMaps.length > 0 ? ` (${selectedTaskMaps.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.categoryButton, selectedTaskFactions.length > 0 && themeStyles.sortFilterActive]}
              onPress={openTaskFactionModal}
              activeOpacity={0.75}
            >
              <Filter size={14} color={Colors.textSecondary} />
              <Text style={styles.categoryButtonText}>
                {t.taskFilterFaction}{selectedTaskFactions.length > 0 ? ` (${selectedTaskFactions.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.taskQuickToggleRow}
          >
            <TouchableOpacity
              style={[styles.sortChip, only3x4Required && styles.sortChipActive, only3x4Required && themeStyles.sortFilterActive]}
              onPress={() => setOnly3x4Required((prev) => !prev)}
              activeOpacity={0.75}
            >
              <Text style={[styles.sortChipText, only3x4Required && styles.sortChipTextActive]}>
                {t.taskFilter3x4Required}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sortChip,
                onlyLightkeeperRequired && styles.sortChipActive,
                onlyLightkeeperRequired && themeStyles.sortFilterActive,
              ]}
              onPress={() => setOnlyLightkeeperRequired((prev) => !prev)}
              activeOpacity={0.75}
            >
              <Text style={[styles.sortChipText, onlyLightkeeperRequired && styles.sortChipTextActive]}>
                {t.taskFilterLightkeeperRequired}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

    </>
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      {searchMode === 'item' ? (
        <FlatList
          data={visibleItemResults}
          keyExtractor={(item) => item.id}
          renderItem={renderItemResult}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMoreItems}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={listHeaderContent}
          ListEmptyComponent={
            isItemPending ? renderItemSkeletonRows() : (
              filteredItemResults.length === 0 && itemHasSearched ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>{t.searchNoPlayers}</Text>
                  <Text style={styles.emptySubtitle}>{t.searchNoPlayersSub}</Text>
                </View>
              ) : null
            )
          }
          contentContainerStyle={[styles.listContent, { paddingTop: listTopInset, paddingBottom: listBottomInset }]}
        />
      ) : searchMode === 'player' ? (
        <FlatList
          data={visiblePlayerResults}
          keyExtractor={(item) => `${item.id}-${item.name}`}
          renderItem={renderPlayerResult}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMorePlayers}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={listHeaderContent}
          ListEmptyComponent={
            isPlayerPending || isTokenResolving ? renderPlayerSkeletonRows() : (
              playerResults.length === 0 && playerHasSearched ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>{playerEmptyTitle}</Text>
                  <Text style={styles.emptySubtitle}>{playerEmptySub}</Text>
                </View>
              ) : null
            )
          }
          contentContainerStyle={[styles.listContent, { paddingTop: listTopInset, paddingBottom: listBottomInset }]}
        />
      ) : searchMode === 'task' ? (
        <FlatList
          data={visibleTaskResults}
          keyExtractor={(item) => item.id}
          renderItem={renderTaskResult}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMoreTasks}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={listHeaderContent}
          ListEmptyComponent={
            tasksQuery.isLoading ? renderTaskSkeletonRows() : (
              filteredTaskResults.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>{t.tasksNoResults}</Text>
                  <Text style={styles.emptySubtitle}>{t.tasksNoResultsSub}</Text>
                </View>
              ) : null
            )
          }
          contentContainerStyle={[styles.listContent, { paddingTop: listTopInset, paddingBottom: listBottomInset }]}
        />
      ) : searchMode === 'trader' ? (
        <FlatList
          data={visibleTraderResults}
          keyExtractor={(item) => item.id}
          renderItem={renderTraderResult}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMoreTraders}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={listHeaderContent}
          ListEmptyComponent={
            tradersQuery.isLoading ? renderTraderSkeletonRows() : (
              filteredTraderResults.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>{t.searchNoTraders}</Text>
                  <Text style={styles.emptySubtitle}>{t.searchNoTradersSub}</Text>
                </View>
              ) : null
            )
          }
          contentContainerStyle={[styles.listContent, { paddingTop: listTopInset, paddingBottom: listBottomInset }]}
        />
      ) : (
        <FlatList
          data={visibleBossResults}
          keyExtractor={(item) => item.id}
          renderItem={renderBossResult}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMoreBosses}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={listHeaderContent}
          ListEmptyComponent={
            bossesQuery.isLoading ? renderTraderSkeletonRows() : (
              filteredBossResults.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>{t.searchNoBosses}</Text>
                  <Text style={styles.emptySubtitle}>{t.searchNoBossesSub}</Text>
                </View>
              ) : null
            )
          }
          contentContainerStyle={[styles.listContent, { paddingTop: listTopInset, paddingBottom: listBottomInset }]}
        />
      )}
      <PageHeader
        title={headerTitle}
        subtitle={t.searchHeaderSubtitle}
        fixed
        onLayout={handleHeaderLayout}
      />

      <Modal
        visible={searchMode === 'item' && categoryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeCategoryModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeCategoryModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t.searchFilterCategory}</Text>
            <View style={styles.modalContent}>
              {availableCategories.length === 0 ? (
                <Text style={styles.emptyText}>{t.searchNoPlayersSub}</Text>
              ) : (
                <ScrollView contentContainerStyle={styles.modalChips} showsVerticalScrollIndicator={false}>
                  {availableCategories.map((category) => {
                    const selected = draftCategorySet.has(category);
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[styles.filterChip, selected && styles.filterChipActive, selected && themeStyles.sortFilterActive]}
                        onPress={() => toggleDraftCategory(category)}
                      >
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                          {localizeCategoryName(category, language)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalAction} onPress={clearCategoryFilter}>
                <Text style={styles.modalActionText}>{t.clear}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAction} onPress={closeCategoryModal}>
                <Text style={styles.modalActionText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary, themeStyles.primaryAction]} onPress={applyCategoryFilter}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText, themeStyles.primaryActionText]}>{t.apply}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={searchMode === 'task' && taskTraderModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeTaskTraderModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeTaskTraderModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t.taskFilterTrader}</Text>
            <View style={styles.modalContent}>
              {taskTraderOptions.length === 0 ? (
                <Text style={styles.emptyText}>{t.tasksNoResultsSub}</Text>
              ) : (
                <ScrollView contentContainerStyle={styles.modalChips} showsVerticalScrollIndicator={false}>
                  {taskTraderOptions.map((trader) => {
                    const selected = draftTaskTraderSet.has(trader.key);
                    return (
                      <TouchableOpacity
                        key={trader.key}
                        style={[styles.filterChip, selected && styles.filterChipActive, selected && themeStyles.sortFilterActive]}
                        onPress={() => toggleDraftTaskTrader(trader.key)}
                      >
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                          {trader.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalAction} onPress={clearTaskTraderFilter}>
                <Text style={styles.modalActionText}>{t.clear}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAction} onPress={closeTaskTraderModal}>
                <Text style={styles.modalActionText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary, themeStyles.primaryAction]} onPress={applyTaskTraderFilter}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText, themeStyles.primaryActionText]}>{t.apply}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={searchMode === 'task' && taskLevelModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeTaskLevelModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeTaskLevelModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t.taskFilterLevel}</Text>
            <View style={styles.modalContent}>
              {taskLevelOptions.length === 0 ? (
                <Text style={styles.emptyText}>{t.tasksNoResultsSub}</Text>
              ) : (
                <ScrollView contentContainerStyle={styles.modalChips} showsVerticalScrollIndicator={false}>
                  {taskLevelOptions.map((level) => {
                    const selected = draftTaskLevelSet.has(level);
                    return (
                      <TouchableOpacity
                        key={`task-level-${level}`}
                        style={[styles.filterChip, selected && styles.filterChipActive, selected && themeStyles.sortFilterActive]}
                        onPress={() => toggleDraftTaskLevel(level)}
                      >
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                          {t.level} {level}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalAction} onPress={clearTaskLevelFilter}>
                <Text style={styles.modalActionText}>{t.clear}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAction} onPress={closeTaskLevelModal}>
                <Text style={styles.modalActionText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary, themeStyles.primaryAction]} onPress={applyTaskLevelFilter}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText, themeStyles.primaryActionText]}>{t.apply}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={searchMode === 'task' && taskMapModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeTaskMapModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeTaskMapModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t.taskFilterMap}</Text>
            <View style={styles.modalContent}>
              {taskMapOptions.length === 0 ? (
                <Text style={styles.emptyText}>{t.tasksNoResultsSub}</Text>
              ) : (
                <ScrollView contentContainerStyle={styles.modalChips} showsVerticalScrollIndicator={false}>
                  {taskMapOptions.map((map) => {
                    const selected = draftTaskMapSet.has(map.key);
                    return (
                      <TouchableOpacity
                        key={`task-map-${map.key}`}
                        style={[styles.filterChip, selected && styles.filterChipActive, selected && themeStyles.sortFilterActive]}
                        onPress={() => toggleDraftTaskMap(map.key)}
                      >
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                          {map.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalAction} onPress={clearTaskMapFilter}>
                <Text style={styles.modalActionText}>{t.clear}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAction} onPress={closeTaskMapModal}>
                <Text style={styles.modalActionText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary, themeStyles.primaryAction]} onPress={applyTaskMapFilter}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText, themeStyles.primaryActionText]}>{t.apply}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={searchMode === 'task' && taskFactionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeTaskFactionModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeTaskFactionModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t.taskFilterFaction}</Text>
            <View style={styles.modalContent}>
              {taskFactionOptions.length === 0 ? (
                <Text style={styles.emptyText}>{t.tasksNoResultsSub}</Text>
              ) : (
                <ScrollView contentContainerStyle={styles.modalChips} showsVerticalScrollIndicator={false}>
                  {taskFactionOptions.map((faction) => {
                    const selected = draftTaskFactionSet.has(faction.key);
                    return (
                      <TouchableOpacity
                        key={`task-faction-${faction.key}`}
                        style={[styles.filterChip, selected && styles.filterChipActive, selected && themeStyles.sortFilterActive]}
                        onPress={() => toggleDraftTaskFaction(faction.key)}
                      >
                        <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                          {faction.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalAction} onPress={clearTaskFactionFilter}>
                <Text style={styles.modalActionText}>{t.clear}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAction} onPress={closeTaskFactionModal}>
                <Text style={styles.modalActionText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary, themeStyles.primaryAction]} onPress={applyTaskFactionFilter}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText, themeStyles.primaryActionText]}>{t.apply}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <FullScreenImageModal
        visible={previewVisible}
        uri={previewUri}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewUri(null);
        }}
      />
      {!isAndroid && (
        <TurnstileTokenModal
          visible={tokenModalVisible}
          onClose={handleTokenModalClose}
          onTokenCaptured={handleTokenCaptured}
          onError={handleTokenCaptureError}
          searchName={(pendingPlayerQuery || searchText || 'player').trim()}
          gameMode={gameMode}
          silent
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  modeSwitchScroll: {
    marginHorizontal: -2,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modeButtonActive: {
    borderColor: Colors.gold,
    backgroundColor: alphaWhite(0.03),
  },
  modeButtonText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modeButtonTextActive: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  searchActionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: Colors.statRed,
    fontSize: 12,
  },
  inlineRetryButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inlineRetryText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  searchHint: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  playerRecentSection: {
    paddingBottom: 4,
    gap: 2,
  },
  playerRecentTitle: {
    paddingHorizontal: 20,
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  filtersSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  taskFiltersSection: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 10,
  },
  taskFilterButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  taskQuickToggleRow: {
    gap: 10,
    paddingRight: 10,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sortGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sortOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
  },
  sortChipActive: {
    borderColor: Colors.gold,
    backgroundColor: alphaWhite(0.03),
  },
  sortChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sortChipTextActive: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
  },
  categoryButtonText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  itemTypeGridSection: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 10,
  },
  itemTypeLoadingWrap: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemTypeCard: {
    width: '48%',
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  itemTypeCardText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  listContent: {
    paddingBottom: 24,
  },
  skeletonListWrap: {
    paddingTop: 2,
    paddingBottom: 8,
    gap: 0,
  },
  skeletonResultInfo: {
    flex: 1,
    marginHorizontal: 10,
    gap: 6,
    justifyContent: 'center',
  },
  skeletonPriceInfo: {
    minWidth: 84,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  resultRowWrap: {
    paddingHorizontal: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  resultAvatar: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIcon: {
    width: 36,
    height: 36,
  },
  resultIconPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: alphaWhite(0.08),
  },
  resultInfo: {
    flex: 1,
    paddingHorizontal: 12,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  resultMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  resultPriceBlock: {
    alignItems: 'flex-end',
    minWidth: 72,
  },
  priceLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  changeValue: {
    fontSize: 11,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    gap: 12,
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: alphaWhite(0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerInfo: {
    flex: 1,
    gap: 3,
  },
  playerName: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  playerMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  traderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    gap: 10,
  },
  traderAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  traderAvatar: {
    width: '100%',
    height: '100%',
  },
  traderAvatarFallback: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
  },
  traderInfo: {
    flex: 1,
    gap: 3,
  },
  traderName: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  traderMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    gap: 12,
  },
  taskImageWrap: {
    width: 58,
    height: 58,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskImage: {
    width: '100%',
    height: '100%',
  },
  taskImagePlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: alphaWhite(0.08),
  },
  taskMain: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  taskTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
    lineHeight: 20,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taskTraderInline: {
    maxWidth: '65%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  taskTraderAvatarWrap: {
    width: 20,
    height: 20,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  taskTraderAvatar: {
    width: '100%',
    height: '100%',
  },
  taskTraderAvatarFallback: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
  },
  taskTraderName: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
    maxWidth: 124,
  },
  taskMapMeta: {
    flex: 1,
    minWidth: 0,
    color: Colors.textTertiary,
    fontSize: 12,
    textAlign: 'right',
  },
  taskStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  taskStatChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
  },
  taskStatChipGold: {
    borderColor: Colors.goldDim,
    backgroundColor: alphaWhite(0.03),
  },
  taskStatChipBlue: {
    borderColor: alphaWhite(0.45),
    backgroundColor: alphaWhite(0.18),
  },
  taskStatText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  taskStatChipGoldText: {
    color: Colors.gold,
  },
  taskStatChipBlueText: {
    color: Colors.text,
  },
  taskChevronWrap: {
    alignSelf: 'center',
    paddingLeft: 2,
  },
  emptyWrap: {
    padding: 32,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: alphaBlack(0.6),
    padding: 20,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalContent: {
    maxHeight: 320,
  },
  modalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
  },
  filterChipActive: {
    borderColor: Colors.gold,
    backgroundColor: alphaWhite(0.03),
  },
  filterChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActionText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  modalActionPrimary: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  modalActionPrimaryText: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
});




