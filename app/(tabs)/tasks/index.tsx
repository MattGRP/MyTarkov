import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  Modal,
  Pressable,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ChevronRight, Search, Filter } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import PageHeader, { getPageHeaderEstimatedHeight } from '@/components/PageHeader';
import { fetchTaskSummaries } from '@/services/tarkovApi';
import type { TaskDetail } from '@/types/tarkov';
import ShimmerBlock from '@/components/ShimmerBlock';

const TASK_LIST_PAGE_SIZE = 40;
const TASK_FETCH_PAGE_SIZE = 80;

function formatTaskMeta(task: TaskDetail, anyMapLabel: string): string {
  const mapName = task.map?.name || anyMapLabel;
  return `${task.trader.name} · ${mapName}`;
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

export default function TasksScreen() {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [headerHeight, setHeaderHeight] = useState<number>(() => getPageHeaderEstimatedHeight(insets.top, true));
  const [searchText, setSearchText] = useState('');
  const [selectedTraders, setSelectedTraders] = useState<string[]>([]);
  const [draftSelectedTraders, setDraftSelectedTraders] = useState<string[]>([]);
  const [traderModalOpen, setTraderModalOpen] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<number[]>([]);
  const [draftSelectedLevels, setDraftSelectedLevels] = useState<number[]>([]);
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const [selectedFactions, setSelectedFactions] = useState<string[]>([]);
  const [draftSelectedFactions, setDraftSelectedFactions] = useState<string[]>([]);
  const [factionModalOpen, setFactionModalOpen] = useState(false);
  const [only3x4Required, setOnly3x4Required] = useState(false);
  const [onlyLightkeeperRequired, setOnlyLightkeeperRequired] = useState(false);
  const [visibleTaskCount, setVisibleTaskCount] = useState<number>(TASK_LIST_PAGE_SIZE);

  const tasksQuery = useInfiniteQuery({
    queryKey: ['tasks-paged', language],
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) => fetchTaskSummaries(language, {
      signal,
      limit: TASK_FETCH_PAGE_SIZE,
      offset: pageParam,
    }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < TASK_FETCH_PAGE_SIZE) return undefined;
      return allPages.reduce((sum, page) => sum + page.length, 0);
    },
    staleTime: 30 * 60 * 1000,
  });

  const allTasks = useMemo(
    () => tasksQuery.data?.pages.flatMap((page) => page ?? []) ?? [],
    [tasksQuery.data],
  );
  const traderOptions = useMemo(() => {
    const map = new Map<string, string>();
    allTasks.forEach((task) => {
      const key = task.trader.normalizedName || task.trader.name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, task.trader.name);
      }
    });
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTasks]);
  const levelOptions = useMemo(() => {
    const values = new Set<number>();
    allTasks.forEach((task) => {
      values.add(task.minPlayerLevel ?? 0);
    });
    return Array.from(values).sort((a, b) => a - b);
  }, [allTasks]);
  const factionOptions = useMemo(() => {
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
  const selectedTraderSet = useMemo(() => new Set(selectedTraders), [selectedTraders]);
  const selectedLevelSet = useMemo(() => new Set(selectedLevels), [selectedLevels]);
  const selectedFactionSet = useMemo(() => new Set(selectedFactions), [selectedFactions]);

  const filteredTasks = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return allTasks
      .filter((task) => {
        if (selectedTraderSet.size === 0) return true;
        const traderKey = task.trader.normalizedName || task.trader.name.toLowerCase();
        return selectedTraderSet.has(traderKey);
      })
      .filter((task) => {
        if (selectedLevelSet.size === 0) return true;
        return selectedLevelSet.has(task.minPlayerLevel ?? 0);
      })
      .filter((task) => {
        if (selectedFactionSet.size === 0) return true;
        return selectedFactionSet.has(getFactionKey(task.factionName));
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
    selectedFactionSet,
    selectedLevelSet,
    selectedTraderSet,
  ]);

  const visibleTasks = useMemo(
    () => filteredTasks.slice(0, visibleTaskCount),
    [filteredTasks, visibleTaskCount],
  );
  const handleLoadMoreTasks = useCallback(() => {
    if (tasksQuery.isLoading || tasksQuery.isFetchingNextPage) return;
    if (visibleTaskCount < filteredTasks.length) {
      setVisibleTaskCount((prev) => Math.min(prev + TASK_LIST_PAGE_SIZE, filteredTasks.length));
      return;
    }
    if (tasksQuery.hasNextPage) {
      void tasksQuery.fetchNextPage();
    }
  }, [filteredTasks.length, tasksQuery, visibleTaskCount]);

  useEffect(() => {
    setVisibleTaskCount(TASK_LIST_PAGE_SIZE);
  }, [filteredTasks]);

  const listTopInset = headerHeight + 8;
  const listBottomInset = Math.max(insets.bottom + 24, 30);
  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0 && Math.abs(next - headerHeight) > 1) {
      setHeaderHeight(next);
    }
  }, [headerHeight]);
  const openTraderModal = useCallback(() => {
    setDraftSelectedTraders(selectedTraders);
    setTraderModalOpen(true);
  }, [selectedTraders]);
  const closeTraderModal = useCallback(() => {
    setTraderModalOpen(false);
  }, []);
  const clearTraderSelection = useCallback(() => {
    setDraftSelectedTraders([]);
  }, []);
  const applyTraderSelection = useCallback(() => {
    setSelectedTraders(draftSelectedTraders);
    setTraderModalOpen(false);
  }, [draftSelectedTraders]);
  const toggleDraftTrader = useCallback((key: string) => {
    setDraftSelectedTraders((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }
      return [...prev, key];
    });
  }, []);
  const draftSelectedTraderSet = useMemo(() => new Set(draftSelectedTraders), [draftSelectedTraders]);
  const openLevelModal = useCallback(() => {
    setDraftSelectedLevels(selectedLevels);
    setLevelModalOpen(true);
  }, [selectedLevels]);
  const closeLevelModal = useCallback(() => {
    setLevelModalOpen(false);
  }, []);
  const clearLevelSelection = useCallback(() => {
    setDraftSelectedLevels([]);
  }, []);
  const applyLevelSelection = useCallback(() => {
    setSelectedLevels(draftSelectedLevels);
    setLevelModalOpen(false);
  }, [draftSelectedLevels]);
  const toggleDraftLevel = useCallback((level: number) => {
    setDraftSelectedLevels((prev) => {
      if (prev.includes(level)) {
        return prev.filter((value) => value !== level);
      }
      return [...prev, level];
    });
  }, []);
  const draftSelectedLevelSet = useMemo(() => new Set(draftSelectedLevels), [draftSelectedLevels]);

  const openFactionModal = useCallback(() => {
    setDraftSelectedFactions(selectedFactions);
    setFactionModalOpen(true);
  }, [selectedFactions]);
  const closeFactionModal = useCallback(() => {
    setFactionModalOpen(false);
  }, []);
  const clearFactionSelection = useCallback(() => {
    setDraftSelectedFactions([]);
  }, []);
  const applyFactionSelection = useCallback(() => {
    setSelectedFactions(draftSelectedFactions);
    setFactionModalOpen(false);
  }, [draftSelectedFactions]);
  const toggleDraftFaction = useCallback((key: string) => {
    setDraftSelectedFactions((prev) => {
      if (prev.includes(key)) {
        return prev.filter((value) => value !== key);
      }
      return [...prev, key];
    });
  }, []);
  const draftSelectedFactionSet = useMemo(() => new Set(draftSelectedFactions), [draftSelectedFactions]);

  const handleOpenTask = useCallback((task: TaskDetail) => {
    router.push({ pathname: '/(tabs)/tasks/[id]', params: { id: task.id } });
  }, [router]);

  const renderTaskRow = useCallback(({ item }: { item: TaskDetail }) => {
    const level = item.minPlayerLevel ?? 0;
    return (
      <TouchableOpacity style={styles.rowCard} activeOpacity={0.75} onPress={() => handleOpenTask(item)}>
        <View style={styles.taskImageWrap}>
          {item.taskImageLink ? (
            <Image source={{ uri: item.taskImageLink }} style={styles.taskImage} contentFit="cover" />
          ) : (
            <View style={styles.imagePlaceholder} />
          )}
        </View>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.rowMeta} numberOfLines={1}>{formatTaskMeta(item, t.taskAnyMap)}</Text>
          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{t.level} {level}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getTaskXp(item)}</Text>
            </View>
            {item.kappaRequired ? (
              <View style={[styles.badge, styles.badgeGold]}>
                <Text style={[styles.badgeText, styles.badgeGoldText]}>{t.taskTag3x4}</Text>
              </View>
            ) : null}
            {item.lightkeeperRequired ? (
              <View style={[styles.badge, styles.badgeBlue]}>
                <Text style={[styles.badgeText, styles.badgeBlueText]}>{t.taskTagLightkeeper}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <ChevronRight size={18} color={Colors.textSecondary} />
      </TouchableOpacity>
    );
  }, [handleOpenTask, t.level, t.taskAnyMap, t.taskTag3x4, t.taskTagLightkeeper]);

  const listHeader = (
    <View style={styles.searchSection}>
      <View style={styles.searchInputWrap}>
        <Search size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={t.tasksSearchPlaceholder}
          placeholderTextColor={Colors.textTertiary}
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      <View style={styles.filterRow}>
        <View style={styles.filterButtonRow}>
          <TouchableOpacity style={styles.filterButton} onPress={openTraderModal} activeOpacity={0.75}>
            <Filter size={14} color={Colors.textSecondary} />
            <Text style={styles.filterButtonText}>
              {t.taskFilterTrader}{selectedTraders.length > 0 ? ` (${selectedTraders.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} onPress={openLevelModal} activeOpacity={0.75}>
            <Filter size={14} color={Colors.textSecondary} />
            <Text style={styles.filterButtonText}>
              {t.taskFilterLevel}{selectedLevels.length > 0 ? ` (${selectedLevels.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} onPress={openFactionModal} activeOpacity={0.75}>
            <Filter size={14} color={Colors.textSecondary} />
            <Text style={styles.filterButtonText}>
              {t.taskFilterFaction}{selectedFactions.length > 0 ? ` (${selectedFactions.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickToggleRow}
        >
          <TouchableOpacity
            style={[styles.quickToggleChip, only3x4Required && styles.quickToggleChipActive]}
            onPress={() => setOnly3x4Required((prev) => !prev)}
            activeOpacity={0.75}
          >
            <Text style={[styles.quickToggleText, only3x4Required && styles.quickToggleTextActive]}>
              {t.taskFilter3x4Required}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickToggleChip, onlyLightkeeperRequired && styles.quickToggleChipActive]}
            onPress={() => setOnlyLightkeeperRequired((prev) => !prev)}
            activeOpacity={0.75}
          >
            <Text style={[styles.quickToggleText, onlyLightkeeperRequired && styles.quickToggleTextActive]}>
              {t.taskFilterLightkeeperRequired}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={visibleTasks}
        keyExtractor={(item) => item.id}
        renderItem={renderTaskRow}
        keyboardShouldPersistTaps="handled"
        onEndReached={handleLoadMoreTasks}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          tasksQuery.isFetchingNextPage ? (
            <View style={styles.listFooterLoading}>
              <ShimmerBlock height={14} width={140} />
              <ShimmerBlock height={12} width={100} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          tasksQuery.isLoading && allTasks.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ShimmerBlock width={180} height={14} />
              <ShimmerBlock width={130} height={12} />
              <Text style={styles.loadingText}>{t.tasksLoading}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{t.tasksNoResults}</Text>
              <Text style={styles.emptySubtitle}>{t.tasksNoResultsSub}</Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingTop: listTopInset, paddingBottom: listBottomInset, gap: 10 }}
        style={styles.list}
        showsVerticalScrollIndicator={false}
      />
      <PageHeader
        title={t.tasksHeaderTitle}
        subtitle={t.tasksHeaderSubtitle}
        fixed
        onLayout={onHeaderLayout}
      />
      <Modal
        visible={traderModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeTraderModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeTraderModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t.taskFilterTrader}</Text>
            <View style={styles.modalContent}>
              {traderOptions.length === 0 ? (
                <Text style={styles.emptyText}>{t.tasksNoResultsSub}</Text>
              ) : (
                <ScrollView contentContainerStyle={styles.modalChips} showsVerticalScrollIndicator={false}>
                  {traderOptions.map((trader) => {
                    const selected = draftSelectedTraderSet.has(trader.key);
                    return (
                      <TouchableOpacity
                        key={trader.key}
                        style={[styles.filterChip, selected && styles.filterChipActive]}
                        onPress={() => toggleDraftTrader(trader.key)}
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
              <TouchableOpacity style={styles.modalAction} onPress={clearTraderSelection}>
                <Text style={styles.modalActionText}>{t.clear}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAction} onPress={closeTraderModal}>
                <Text style={styles.modalActionText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary]} onPress={applyTraderSelection}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText]}>{t.apply}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={levelModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeLevelModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeLevelModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t.taskFilterLevel}</Text>
            <View style={styles.modalContent}>
              {levelOptions.length === 0 ? (
                <Text style={styles.emptyText}>{t.tasksNoResultsSub}</Text>
              ) : (
                <ScrollView contentContainerStyle={styles.modalChips} showsVerticalScrollIndicator={false}>
                  {levelOptions.map((level) => {
                    const selected = draftSelectedLevelSet.has(level);
                    return (
                      <TouchableOpacity
                        key={`level-${level}`}
                        style={[styles.filterChip, selected && styles.filterChipActive]}
                        onPress={() => toggleDraftLevel(level)}
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
              <TouchableOpacity style={styles.modalAction} onPress={clearLevelSelection}>
                <Text style={styles.modalActionText}>{t.clear}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAction} onPress={closeLevelModal}>
                <Text style={styles.modalActionText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary]} onPress={applyLevelSelection}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText]}>{t.apply}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={factionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeFactionModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeFactionModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t.taskFilterFaction}</Text>
            <View style={styles.modalContent}>
              {factionOptions.length === 0 ? (
                <Text style={styles.emptyText}>{t.tasksNoResultsSub}</Text>
              ) : (
                <ScrollView contentContainerStyle={styles.modalChips} showsVerticalScrollIndicator={false}>
                  {factionOptions.map((faction) => {
                    const selected = draftSelectedFactionSet.has(faction.key);
                    return (
                      <TouchableOpacity
                        key={`faction-${faction.key}`}
                        style={[styles.filterChip, selected && styles.filterChipActive]}
                        onPress={() => toggleDraftFaction(faction.key)}
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
              <TouchableOpacity style={styles.modalAction} onPress={clearFactionSelection}>
                <Text style={styles.modalActionText}>{t.clear}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAction} onPress={closeFactionModal}>
                <Text style={styles.modalActionText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalAction, styles.modalActionPrimary]} onPress={applyFactionSelection}>
                <Text style={[styles.modalActionText, styles.modalActionPrimaryText]}>{t.apply}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  searchInputWrap: {
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
    color: Colors.text,
    fontSize: 15,
  },
  filterRow: {
    gap: 8,
  },
  filterButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  filterButtonText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  quickToggleRow: {
    gap: 8,
    paddingRight: 6,
  },
  quickToggleChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  quickToggleChipActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(217,191,115,0.15)',
  },
  quickToggleText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  quickToggleTextActive: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
  rowCard: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taskImageWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
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
  imagePlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowMain: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  rowMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  badgesRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  badgeGold: {
    borderColor: Colors.goldDim,
    backgroundColor: 'rgba(217,191,115,0.16)',
  },
  badgeBlue: {
    borderColor: 'rgba(75,157,255,0.45)',
    backgroundColor: 'rgba(75,157,255,0.18)',
  },
  badgeText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  badgeGoldText: {
    color: Colors.gold,
  },
  badgeBlueText: {
    color: '#73B5FF',
  },
  loadingWrap: {
    marginTop: 40,
    alignItems: 'center',
    gap: 8,
  },
  listFooterLoading: {
    marginTop: 4,
    marginBottom: 12,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  emptyWrap: {
    marginTop: 40,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  emptySubtitle: {
    color: Colors.textTertiary,
    fontSize: 12,
    textAlign: 'center',
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
  emptyText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});

