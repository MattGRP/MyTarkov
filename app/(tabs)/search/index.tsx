import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, Platform, type LayoutChangeEvent } from 'react-native';
import { Search, X, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Filter, Package, User, ClipboardList, Store } from 'lucide-react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import {
  fetchTasks,
  fetchTraders,
  fetchPlayerProfile,
  isTurnstileRequiredError,
  savePlayerSearchToken,
  searchItems,
  searchPlayers,
} from '@/services/tarkovApi';
import { ItemSearchResult, SearchResult, TaskDetail, TraderDetail } from '@/types/tarkov';
import { formatCountdownToTimestamp, formatPrice } from '@/utils/helpers';
import FullScreenImageModal from '@/components/FullScreenImageModal';
import PageHeader, { getPageHeaderEstimatedHeight } from '@/components/PageHeader';
import TurnstileTokenModal from '@/components/TurnstileTokenModal';

const SORT_OPTIONS = [
  { key: 'name', labelKey: 'searchSortName' },
  { key: 'avg24hPrice', labelKey: 'searchSortPrice' },
  { key: 'changeLast48hPercent', labelKey: 'searchSortChange' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['key'];

type SortDirection = 'asc' | 'desc';

type SearchMode = 'item' | 'player' | 'task' | 'trader';

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

const CATEGORY_TRANSLATIONS: Record<string, { zh: string; ru: string }> = {
  'arm band': { zh: '臂章', ru: 'Повязка' },
  'armor plate': { zh: '插板', ru: 'Бронеплита' },
  'auxiliary mod': { zh: '辅助配件', ru: 'Доп. модуль' },
  'cylinder magazine': { zh: '弹鼓', ru: 'Барабанный магазин' },
  'face cover': { zh: '面罩', ru: 'Маска' },
  flyer: { zh: '传单', ru: 'Листовка' },
  headwear: { zh: '头盔', ru: 'Головной убор' },
  keycard: { zh: '钥匙卡', ru: 'Ключ-карта' },
  'mechanical key': { zh: '机械钥匙', ru: 'Механический ключ' },
  'night vision': { zh: '夜视设备', ru: 'Ночное видение' },
  notes: { zh: '笔记', ru: 'Записки' },
  other: { zh: '其他', ru: 'Прочее' },
  'radio transmitter': { zh: '无线电发射器', ru: 'Радиопередатчик' },
  'random loot container': { zh: '随机战利品容器', ru: 'Случайный контейнер' },
  revolver: { zh: '左轮手枪', ru: 'Револьвер' },
  rocket: { zh: '火箭弹', ru: 'Ракета' },
  'rocket launcher': { zh: '火箭筒', ru: 'Ракетомет' },
  'spring driven cylinder': { zh: '发条弹鼓', ru: 'Пружинный барабан' },
  tapes: { zh: '磁带', ru: 'Кассеты' },
};

const TRADER_NAME_TRANSLATIONS: Record<string, { zh: string; ru: string }> = {
  fence: { zh: '黑商', ru: 'Fence' },
  prapor: { zh: '俄商', ru: 'Prapor' },
  therapist: { zh: '大妈', ru: 'Therapist' },
  skier: { zh: '小蓝帽', ru: 'Skier' },
  peacekeeper: { zh: '美商', ru: 'Peacekeeper' },
  mechanic: { zh: '机械师', ru: 'Mechanic' },
  ragman: { zh: '服装商', ru: 'Ragman' },
  jaeger: { zh: '杰哥', ru: 'Jaeger' },
  lightkeeper: { zh: '灯塔商人', ru: 'Lightkeeper' },
  'radio station': { zh: '电台', ru: 'Radio station' },
  'mr. kerman': { zh: 'Kerman 先生', ru: 'Mr. Kerman' },
};

function localizeCategoryName(name: string, language: 'en' | 'zh' | 'ru'): string {
  if (!name || language === 'en') return name;
  const key = name.trim().toLowerCase();
  const mapped = CATEGORY_TRANSLATIONS[key];
  return mapped?.[language] || name;
}

function localizeTraderName(name: string, normalizedName: string | null | undefined, language: 'en' | 'zh' | 'ru'): string {
  if (!name || language === 'en') return name;
  const normalized = (normalizedName || name).trim().toLowerCase();
  const mapped = TRADER_NAME_TRANSLATIONS[normalized];
  return mapped?.[language] || name;
}

function localizeUnknownText(value: string | null | undefined, unknownLabel: string): string {
  const text = String(value || '').trim();
  if (!text) return unknownLabel;
  const normalized = text.toLowerCase();
  if (normalized === 'unknown' || normalized === '<unknown>') return unknownLabel;
  return text;
}

export default function SearchScreen() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const l = useCallback((zh: string, en: string, ru: string) => {
    if (language === 'zh') return zh;
    if (language === 'ru') return ru;
    return en;
  }, [language]);
  const isAndroid = Platform.OS === 'android';
  const [headerHeight, setHeaderHeight] = useState<number>(() => getPageHeaderEstimatedHeight(insets.top, true));
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const [searchMode, setSearchMode] = useState<SearchMode>('item');
  const [searchText, setSearchText] = useState<string>('');
  const [inputError, setInputError] = useState<string>('');

  const [itemResults, setItemResults] = useState<ItemSearchResult[]>([]);
  const [itemHasSearched, setItemHasSearched] = useState<boolean>(false);

  const [playerResults, setPlayerResults] = useState<SearchResult[]>([]);
  const [playerHasSearched, setPlayerHasSearched] = useState<boolean>(false);

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

  const itemSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      return await searchItems(query, language);
    },
    onSuccess: (data) => {
      setItemResults(data);
      setItemHasSearched(true);
    },
    onError: () => {
      setItemHasSearched(true);
    },
  });

  const playerSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      const trimmed = query.trim();
      const isAccountIdQuery = /^\d+$/.test(trimmed);

      if (isAndroid && !isAccountIdQuery) {
        throw new Error(
          l(
            '安卓仅支持输入 AccountID 搜索玩家。',
            'Android supports AccountID-only player search.',
            'На Android поиск игроков поддерживает только ID аккаунта.',
          ),
        );
      }

      if (isAccountIdQuery) {
        const profile = await fetchPlayerProfile(trimmed);
        return [{ id: trimmed, name: profile.info.nickname }];
      }

      return await searchPlayers(trimmed);
    },
    onSuccess: (data) => {
      setPlayerResults(data);
      setPlayerHasSearched(true);
      setHasRetriedWithFreshToken(false);
    },
    onError: (error, query) => {
      if (!isAndroid && isTurnstileRequiredError(error)) {
        if (hasRetriedWithFreshToken) {
          setHasRetriedWithFreshToken(false);
          setIsTokenResolving(false);
          setTokenModalVisible(false);
          setPendingPlayerQuery('');
          setPlayerHasSearched(false);
          setInputError(l('验证失败，请重试。', 'Verification failed. Please try again.', 'Проверка не удалась. Повторите попытку.'));
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
    queryKey: ['tasks', language],
    queryFn: () => fetchTasks(language),
    staleTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: 'always',
  });
  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const tradersQuery = useQuery({
    queryKey: ['traders', language],
    queryFn: () => fetchTraders(language),
    staleTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: 'always',
  });
  const allTraders = useMemo(() => tradersQuery.data ?? [], [tradersQuery.data]);

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
        if (only3x4Required && !task.kappaRequired) return false;
        if (onlyLightkeeperRequired && !task.lightkeeperRequired) return false;
        return true;
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
    if (searchMode !== 'item') return;

    const query = searchText.trim();
    if (!query) {
      setItemResults([]);
      setItemHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      setInputError('');
      resetItemSearch();
      runItemSearch(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [language, searchMode, searchText, resetItemSearch, runItemSearch]);

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
    router.push({ pathname: '/(tabs)/search/item/[id]', params: { id: item.id } });
  }, [router]);

  const handleOpenPlayer = useCallback((accountId: string) => {
    if (!accountId) return;
    Keyboard.dismiss();
    router.push({ pathname: '/(tabs)/search/player', params: { accountId } });
  }, [router]);

  const handleOpenTask = useCallback((task: TaskDetail) => {
    router.push({ pathname: '/(tabs)/search/task/[id]', params: { id: task.id } });
  }, [router]);

  const handleOpenTrader = useCallback((traderId: string) => {
    if (!traderId) return;
    router.push({ pathname: '/(tabs)/search/trader/[id]', params: { id: traderId } });
  }, [router]);

  const handleSearch = useCallback(() => {
    const query = searchText.trim();
    if (!query && searchMode !== 'task' && searchMode !== 'trader') return;
    const isAccountIdQuery = /^\d+$/.test(query);

    Keyboard.dismiss();
    setInputError('');

    if (searchMode === 'item') {
      resetItemSearch();
      runItemSearch(query);
      return;
    }

    if (searchMode === 'task') {
      void tasksQuery.refetch();
      return;
    }

    if (searchMode === 'trader') {
      void tradersQuery.refetch();
      return;
    }

    if (isAndroid && !isAccountIdQuery) {
      setInputError(
        l(
          '安卓仅支持输入 AccountID 搜索玩家。',
          'Android supports AccountID-only player search.',
          'На Android поиск игроков поддерживает только ID аккаунта.',
        ),
      );
      setPlayerResults([]);
      setPlayerHasSearched(false);
      return;
    }

    if (!isAccountIdQuery && query.length < 3) {
      setInputError(l('玩家名称至少输入 3 个字符。', 'Player name should be at least 3 characters.', 'Имя игрока должно содержать минимум 3 символа.'));
      setPlayerResults([]);
      setPlayerHasSearched(false);
      return;
    }

    setHasRetriedWithFreshToken(false);
    resetPlayerSearch();
    runPlayerSearch(query);
  }, [
    isAndroid,
    l,
    resetItemSearch,
    resetPlayerSearch,
    runItemSearch,
    runPlayerSearch,
    searchMode,
    searchText,
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
    }
  }, [searchMode, tasksQuery, tradersQuery]);

  const handleClear = useCallback(() => {
    setSearchText('');
    setInputError('');

    if (searchMode === 'item') {
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

    setPlayerResults([]);
    setPlayerHasSearched(false);
    setHasRetriedWithFreshToken(false);
    resetPlayerSearch();
  }, [resetItemSearch, resetPlayerSearch, searchMode]);

  const handleSearchTextChange = useCallback((value: string) => {
    setSearchText(value);
    if (inputError) setInputError('');
  }, [inputError]);

  const handleModeChange = useCallback((mode: SearchMode) => {
    if (mode === searchMode) return;

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
        setInputError(l('验证失败，请重试。', 'Verification failed. Please try again.', 'Проверка не удалась. Повторите попытку.'));
      }
  }, [l, pendingPlayerQuery, searchText]);

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

  const renderPlayerResult = useCallback(({ item }: { item: SearchResult }) => {
    return (
      <View style={styles.resultRowWrap}>
        <TouchableOpacity
          style={styles.playerRow}
          onPress={() => handleOpenPlayer(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.playerAvatar}>
            <User size={20} color={Colors.gold} />
          </View>
          <View style={styles.playerInfo}>
            <Text style={styles.playerName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.playerMeta} numberOfLines={1}>
              {l('点击查看玩家资料', 'Tap to view player profile', 'Нажмите, чтобы открыть профиль игрока')}
            </Text>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }, [handleOpenPlayer, l]);

  const renderTraderResult = useCallback(({ item }: { item: TraderDetail }) => {
    const traderId = item.id || item.normalizedName || item.name;
    const traderName = localizeTraderName(item.name, item.normalizedName, language);
    const traderDesc = localizeUnknownText(item.description, t.searchUnknown);
    const resetCountdown = formatCountdownToTimestamp(item.resetTime, nowTick);
    return (
      <View style={styles.resultRowWrap}>
        <TouchableOpacity
          style={styles.traderRow}
          onPress={() => handleOpenTrader(traderId)}
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
                <View style={[styles.taskStatChip, styles.taskStatChipGold]}>
                  <Text style={[styles.taskStatText, styles.taskStatChipGoldText]}>{t.taskTag3x4}</Text>
                </View>
              ) : null}
              {item.lightkeeperRequired ? (
                <View style={[styles.taskStatChip, styles.taskStatChipBlue]}>
                  <Text style={[styles.taskStatText, styles.taskStatChipBlueText]}>{t.taskTagLightkeeper}</Text>
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
  }, [handleOpenTask, language, t.level, t.taskAnyMap, t.taskTag3x4, t.taskTagLightkeeper]);

  const isPending = searchMode === 'item'
    ? isItemPending
    : searchMode === 'player'
      ? isPlayerPending
      : searchMode === 'task'
        ? tasksQuery.isLoading
        : tradersQuery.isLoading;
  const activeErrorRaw = searchMode === 'item'
    ? (isItemError ? (itemError as Error)?.message : '')
    : searchMode === 'player'
      ? (isPlayerError && !isTurnstileRequiredError(playerError) ? (playerError as Error)?.message : '')
      : searchMode === 'task'
        ? (tasksQuery.isError ? (tasksQuery.error as Error)?.message : '')
        : (tradersQuery.isError ? (tradersQuery.error as Error)?.message : '');
  const activeError = /abort|timeout/i.test(activeErrorRaw || '')
    ? l('请求超时，请重试。', 'Request timed out. Please retry.', 'Время запроса истекло. Повторите попытку.')
    : activeErrorRaw;

  const playerPlaceholder = isAndroid
    ? l('输入AccountID', 'Enter AccountID', 'Введите ID аккаунта')
    : l('输入玩家名称或AccountID', 'Search player name or AccountID', 'Введите имя игрока или ID аккаунта');

  const playerEmptyTitle = l('未找到玩家', 'No players found', 'Игроки не найдены');
  const playerEmptySub = isAndroid
    ? l('请确认输入的是正确的数字 AccountID', 'Please verify the numeric AccountID', 'Проверьте корректность числового ID аккаунта')
    : l('尝试更精确的玩家名称', 'Try a more precise player name', 'Попробуйте более точное имя');

  const loadingText = searchMode === 'item'
    ? t.searchDownloading
    : searchMode === 'player'
      ? isTokenResolving
        ? l('正在完成验证...', 'Verifying...', 'Проверка...')
        : isAndroid
          ? l('正在查询账号...', 'Looking up account...', 'Получаем данные аккаунта...')
          : l('正在搜索玩家...', 'Searching players...', 'Ищем игроков...')
      : searchMode === 'task'
        ? t.tasksLoading
        : t.searchTraderTitle;
  const headerTitle = searchMode === 'item'
    ? t.searchHeaderTitle
    : searchMode === 'player'
      ? l('玩家搜索', 'Player Search', 'Поиск игроков')
      : searchMode === 'task'
        ? t.tasksHeaderTitle
        : t.searchTraderTitle;
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
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeButton, searchMode === 'item' && styles.modeButtonActive]}
            onPress={() => handleModeChange('item')}
            activeOpacity={0.8}
          >
            <Package size={14} color={searchMode === 'item' ? Colors.text : Colors.textSecondary} />
            <Text style={[styles.modeButtonText, searchMode === 'item' && styles.modeButtonTextActive]}>
              {l('物品', 'Items', 'Предметы')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, searchMode === 'player' && styles.modeButtonActive]}
            onPress={() => handleModeChange('player')}
            activeOpacity={0.8}
          >
            <User size={14} color={searchMode === 'player' ? Colors.text : Colors.textSecondary} />
            <Text style={[styles.modeButtonText, searchMode === 'player' && styles.modeButtonTextActive]}>
              {l('玩家', 'Players', 'Игроки')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, searchMode === 'task' && styles.modeButtonActive]}
            onPress={() => handleModeChange('task')}
            activeOpacity={0.8}
          >
            <ClipboardList size={14} color={searchMode === 'task' ? Colors.text : Colors.textSecondary} />
            <Text style={[styles.modeButtonText, searchMode === 'task' && styles.modeButtonTextActive]}>
              {l('任务', 'Tasks', 'Задания')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, searchMode === 'trader' && styles.modeButtonActive]}
            onPress={() => handleModeChange('trader')}
            activeOpacity={0.8}
          >
            <Store size={14} color={searchMode === 'trader' ? Colors.text : Colors.textSecondary} />
            <Text style={[styles.modeButtonText, searchMode === 'trader' && styles.modeButtonTextActive]}>
              {l('商人', 'Traders', 'Торговцы')}
            </Text>
          </TouchableOpacity>
        </View>

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
                      : t.searchTraderPlaceholder
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
          <TouchableOpacity onPress={handleSearch} style={styles.searchActionButton} activeOpacity={0.7}>
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
        {!inputError && !!activeError && (searchMode === 'task' || searchMode === 'trader') && (
          <TouchableOpacity style={styles.inlineRetryButton} onPress={handleRefetchActiveMode} activeOpacity={0.8}>
            <Text style={styles.inlineRetryText}>{t.retry}</Text>
          </TouchableOpacity>
        )}
        {searchMode === 'player' && isAndroid && !inputError && !activeError && (
          <Text style={styles.searchHint}>
            {l('安卓仅支持 AccountID 搜索。', 'Android supports AccountID-only search.', 'На Android поддерживается только поиск по ID аккаунта.')}
          </Text>
        )}

      </View>

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
                      style={[styles.sortChip, active && styles.sortChipActive]}
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

            <TouchableOpacity style={styles.categoryButton} onPress={openCategoryModal} activeOpacity={0.7}>
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
            <TouchableOpacity style={styles.categoryButton} onPress={openTaskTraderModal} activeOpacity={0.75}>
              <Filter size={14} color={Colors.textSecondary} />
              <Text style={styles.categoryButtonText}>
                {t.taskFilterTrader}{selectedTaskTraders.length > 0 ? ` (${selectedTaskTraders.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryButton} onPress={openTaskLevelModal} activeOpacity={0.75}>
              <Filter size={14} color={Colors.textSecondary} />
              <Text style={styles.categoryButtonText}>
                {t.taskFilterLevel}{selectedTaskLevels.length > 0 ? ` (${selectedTaskLevels.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryButton} onPress={openTaskMapModal} activeOpacity={0.75}>
              <Filter size={14} color={Colors.textSecondary} />
              <Text style={styles.categoryButtonText}>
                {t.taskFilterMap}{selectedTaskMaps.length > 0 ? ` (${selectedTaskMaps.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.categoryButton} onPress={openTaskFactionModal} activeOpacity={0.75}>
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
              style={[styles.sortChip, only3x4Required && styles.sortChipActive]}
              onPress={() => setOnly3x4Required((prev) => !prev)}
              activeOpacity={0.75}
            >
              <Text style={[styles.sortChipText, only3x4Required && styles.sortChipTextActive]}>
                {t.taskFilter3x4Required}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortChip, onlyLightkeeperRequired && styles.sortChipActive]}
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

      {(isPending || (searchMode === 'player' && isTokenResolving)) && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={Colors.gold} />
          <Text style={styles.loadingText}>{loadingText}</Text>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.container}>
      {searchMode === 'item' ? (
        <FlatList
          data={filteredItemResults}
          keyExtractor={(item) => item.id}
          renderItem={renderItemResult}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeaderContent}
          ListEmptyComponent={
            !isItemPending && filteredItemResults.length === 0 && itemHasSearched ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t.searchNoPlayers}</Text>
                <Text style={styles.emptySubtitle}>{t.searchNoPlayersSub}</Text>
              </View>
            ) : null
          }
          contentContainerStyle={[styles.listContent, { paddingTop: listTopInset, paddingBottom: listBottomInset }]}
        />
      ) : searchMode === 'player' ? (
        <FlatList
          data={playerResults}
          keyExtractor={(item) => `${item.id}-${item.name}`}
          renderItem={renderPlayerResult}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeaderContent}
          ListEmptyComponent={
            !isPlayerPending && playerResults.length === 0 && playerHasSearched ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{playerEmptyTitle}</Text>
                <Text style={styles.emptySubtitle}>{playerEmptySub}</Text>
              </View>
            ) : null
          }
          contentContainerStyle={[styles.listContent, { paddingTop: listTopInset, paddingBottom: listBottomInset }]}
        />
      ) : searchMode === 'task' ? (
        <FlatList
          data={filteredTaskResults}
          keyExtractor={(item) => item.id}
          renderItem={renderTaskResult}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeaderContent}
          ListEmptyComponent={
            !tasksQuery.isLoading && filteredTaskResults.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t.tasksNoResults}</Text>
                <Text style={styles.emptySubtitle}>{t.tasksNoResultsSub}</Text>
              </View>
            ) : null
          }
          contentContainerStyle={[styles.listContent, { paddingTop: listTopInset, paddingBottom: listBottomInset }]}
        />
      ) : (
        <FlatList
          data={filteredTraderResults}
          keyExtractor={(item) => item.id}
          renderItem={renderTraderResult}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeaderContent}
          ListEmptyComponent={
            !tradersQuery.isLoading && filteredTraderResults.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t.searchNoTraders}</Text>
                <Text style={styles.emptySubtitle}>{t.searchNoTradersSub}</Text>
              </View>
            ) : null
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
                        style={[styles.filterChip, selected && styles.filterChipActive]}
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
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary]} onPress={applyCategoryFilter}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText]}>{t.apply}</Text>
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
                        style={[styles.filterChip, selected && styles.filterChipActive]}
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
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary]} onPress={applyTaskTraderFilter}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText]}>{t.apply}</Text>
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
                        style={[styles.filterChip, selected && styles.filterChipActive]}
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
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary]} onPress={applyTaskLevelFilter}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText]}>{t.apply}</Text>
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
                        style={[styles.filterChip, selected && styles.filterChipActive]}
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
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary]} onPress={applyTaskMapFilter}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText]}>{t.apply}</Text>
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
                        style={[styles.filterChip, selected && styles.filterChipActive]}
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
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary]} onPress={applyTaskFactionFilter}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText]}>{t.apply}</Text>
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
  modeSwitch: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modeButtonActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(217,191,115,0.15)',
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
    backgroundColor: 'rgba(255,255,255,0.03)',
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
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sortChipActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(217,191,115,0.15)',
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
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  categoryButtonText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingBottom: 24,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(217,191,115,0.12)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  taskStatChipGold: {
    borderColor: Colors.goldDim,
    backgroundColor: 'rgba(217,191,115,0.16)',
  },
  taskStatChipBlue: {
    borderColor: 'rgba(75,157,255,0.45)',
    backgroundColor: 'rgba(75,157,255,0.18)',
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
    color: '#73B5FF',
  },
  taskChevronWrap: {
    alignSelf: 'center',
    paddingLeft: 2,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
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
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  filterChipActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(217,191,115,0.15)',
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
    color: '#1A1A14',
    fontWeight: '600' as const,
  },
});



