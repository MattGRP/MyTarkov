import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  type LayoutChangeEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useIsFocused, useNavigation } from '@react-navigation/native';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from 'lucide-react-native';
import Colors, { alphaWhite, getModeAccentTheme } from '@/constants/colors';
import { getDockReservedInset } from '@/constants/layout';
import { localizeCategoryName } from '@/constants/i18n';
import { useGameMode } from '@/providers/GameModeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { fetchItemCategories, searchItemsByCategories } from '@/services/tarkovApi';
import { ItemSearchResult } from '@/types/tarkov';
import { formatPrice } from '@/utils/helpers';
import FullScreenImageModal from '@/components/FullScreenImageModal';
import PageHeader, { getPageHeaderEstimatedHeight } from '@/components/PageHeader';
import ShimmerBlock from '@/components/ShimmerBlock';

const ITEM_TYPES_PATH = '/(tabs)/search/item-types' as const;
const SEARCH_ITEM_ROOT_PATH = '/(tabs)/search' as const;
const ITEM_LIST_PAGE_SIZE = 100;

const SORT_OPTIONS = [
  { key: 'name', labelKey: 'searchSortName' },
  { key: 'avg24hPrice', labelKey: 'searchSortPrice' },
  { key: 'changeLast48hPercent', labelKey: 'searchSortChange' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['key'];
type SortDirection = 'asc' | 'desc';

const EMPTY_ITEMS: ItemSearchResult[] = [];

function normalizeName(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

function getLocale(language: 'en' | 'zh' | 'ru'): string {
  if (language === 'zh') return 'zh-Hans-CN';
  if (language === 'ru') return 'ru-RU';
  return 'en';
}

function getItemPrimaryPrice(item: ItemSearchResult): number {
  return item.avg24hPrice ?? item.lastLowPrice ?? item.basePrice ?? 0;
}

function getParamValue(value?: string | string[]): string {
  if (Array.isArray(value)) return String(value[0] || '');
  return String(value || '');
}

function parseCategoryParam(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  let decoded = raw;
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded.trim();
}

function serializeCategoryParam(value?: string): string | undefined {
  const trimmed = String(value || '').trim();
  if (!trimmed) return undefined;
  return trimmed;
}

export default function ItemTypesScreen() {
  const { t, language } = useLanguage();
  const { gameMode } = useGameMode();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ category?: string | string[] }>();

  const [headerHeight, setHeaderHeight] = useState<number>(() => getPageHeaderEstimatedHeight(insets.top, true));
  const [sortKey, setSortKey] = useState<SortKey>('avg24hPrice');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const accentTheme = useMemo(() => getModeAccentTheme(gameMode), [gameMode]);
  const themeStyles = useMemo(() => ({
    sortChipActive: {
      borderColor: accentTheme.accent,
      backgroundColor: accentTheme.accentSoft15,
    },
  }), [accentTheme]);

  const currentCategory = useMemo(
    () => parseCategoryParam(getParamValue(params.category)),
    [params.category],
  );

  const categoriesQueryEn = useQuery({
    queryKey: ['item-categories', 'en'],
    queryFn: ({ signal }) => fetchItemCategories('en', { signal }),
    enabled: isFocused,
    staleTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: 'always',
  });

  const categoriesQueryLocalized = useQuery({
    queryKey: ['item-categories', language],
    queryFn: ({ signal }) => fetchItemCategories(language, { signal }),
    enabled: isFocused && language !== 'en',
    staleTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: 'always',
  });

  const allCategories = useMemo(() => categoriesQueryEn.data ?? [], [categoriesQueryEn.data]);

  const categoryLocalizedByNormalized = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQueryLocalized.data ?? []) {
      const normalized = normalizeName(category.normalizedName);
      const localizedName = String(category.name || '').trim();
      if (normalized && localizedName) {
        map.set(normalized, localizedName);
      }
    }
    return map;
  }, [categoriesQueryLocalized.data]);

  const categoryNormalizedByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of allCategories) {
      const name = String(category.name || '').trim();
      const normalized = normalizeName(category.normalizedName);
      if (name && normalized) {
        map.set(name, normalized);
      }
    }
    return map;
  }, [allCategories]);

  const displayCategoryName = useCallback((name: string): string => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return '';

    // Prefer app-level terminology to keep wording consistent across pages.
    if (language !== 'en') {
      const customized = localizeCategoryName(trimmed, language);
      if (normalizeName(customized) !== normalizeName(trimmed)) {
        return customized;
      }
    }

    if (language !== 'en') {
      const normalized = categoryNormalizedByName.get(trimmed);
      if (normalized) {
        const localized = categoryLocalizedByNormalized.get(normalized);
        if (localized) {
          const isUntranslated = normalizeName(localized) === normalizeName(trimmed);
          if (!isUntranslated) return localized;
        }
      }
    }

    return localizeCategoryName(trimmed, language);
  }, [categoryLocalizedByNormalized, categoryNormalizedByName, language]);

  const categoryNameSet = useMemo(() => {
    const set = new Set<string>();
    for (const category of allCategories) {
      const name = String(category.name || '').trim();
      if (name) set.add(name);
    }
    return set;
  }, [allCategories]);

  const validCurrentCategory = useMemo(() => {
    if (!currentCategory) return undefined;
    if (!categoryNameSet.has(currentCategory)) return undefined;
    if (normalizeName(currentCategory) === 'item') return undefined;
    return currentCategory;
  }, [categoryNameSet, currentCategory]);

  const tree = useMemo(() => {
    const locale = getLocale(language);
    const roots = new Set<string>();
    const parentMap = new Map<string, string>();
    const childSetMap = new Map<string, Set<string>>();
    const normalizedByName = new Map<string, string>();

    const sortNames = (names: string[]): string[] => (
      names.sort((a, b) => displayCategoryName(a).localeCompare(displayCategoryName(b), locale))
    );

    const addEdge = (parentName: string, childName: string): void => {
      const parent = parentName.trim();
      const child = childName.trim();
      if (!parent || !child || parent === child) return;
      if (!childSetMap.has(parent)) {
        childSetMap.set(parent, new Set<string>());
      }
      childSetMap.get(parent)?.add(child);
      if (!parentMap.has(child)) {
        parentMap.set(child, parent);
      }
    };

    for (const category of allCategories) {
      const name = String(category.name || '').trim();
      if (!name) continue;

      normalizedByName.set(name, normalizeName(category.normalizedName));

      const parentName = String(category.parent?.name || '').trim();
      if (!parentName) {
        roots.add(name);
      } else {
        addEdge(parentName, name);
      }

      for (const child of category.children ?? []) {
        const childName = String(child.name || '').trim();
        if (!childName) continue;
        addEdge(name, childName);
      }
    }

    const childrenMap = new Map<string, string[]>();
    for (const [parent, children] of childSetMap.entries()) {
      childrenMap.set(parent, sortNames(Array.from(children)));
    }

    const virtualRoot = Array.from(normalizedByName.entries()).find(([, normalized]) => normalized === 'item')?.[0]
      || (roots.size === 1 ? Array.from(roots)[0] : undefined);

    let topLevelCategories: string[];
    if (virtualRoot) {
      topLevelCategories = childrenMap.get(virtualRoot) ?? [];
      if (topLevelCategories.length === 0) {
        topLevelCategories = Array.from(parentMap.entries())
          .filter(([, parent]) => parent === virtualRoot)
          .map(([child]) => child);
      }
    } else {
      topLevelCategories = Array.from(roots);
    }

    topLevelCategories = sortNames(
      Array.from(new Set(topLevelCategories))
        .filter((name) => name !== virtualRoot)
        .filter((name) => normalizeName(name) !== 'item'),
    );

    if (topLevelCategories.length === 0 && virtualRoot) {
      topLevelCategories = sortNames(
        Array.from(parentMap.entries())
          .filter(([, parent]) => parent === virtualRoot)
          .map(([child]) => child)
          .filter((name) => normalizeName(name) !== 'item'),
      );
    }

    return {
      childrenMap,
      parentMap,
      virtualRoot,
      topLevelCategories,
    };
  }, [allCategories, displayCategoryName, language]);

  const visibleCategories = useMemo(() => {
    if (!validCurrentCategory) return tree.topLevelCategories;
    return tree.childrenMap.get(validCurrentCategory) ?? [];
  }, [tree.childrenMap, tree.topLevelCategories, validCurrentCategory]);

  const breadcrumbCategories = useMemo(() => {
    if (!validCurrentCategory) return [] as string[];
    const path: string[] = [];
    let cursor: string | undefined = validCurrentCategory;
    const guard = new Set<string>();

    while (cursor && !guard.has(cursor)) {
      guard.add(cursor);
      path.unshift(cursor);
      const parent = tree.parentMap.get(cursor);
      if (!parent || (tree.virtualRoot && parent === tree.virtualRoot)) break;
      cursor = parent;
    }

    return path;
  }, [tree.parentMap, tree.virtualRoot, validCurrentCategory]);

  const itemsQuery = useInfiniteQuery({
    queryKey: ['item-types-items', language, gameMode, validCurrentCategory],
    queryFn: async ({ pageParam, signal }) => {
      if (!validCurrentCategory) return EMPTY_ITEMS;
      const offset = Math.max(0, Number(pageParam) || 0);
      return searchItemsByCategories({
        categoryNames: [validCurrentCategory],
        language,
        gameMode,
        limit: ITEM_LIST_PAGE_SIZE,
        offset,
        signal,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length === 0) return undefined;
      return allPages.reduce((count, page) => count + page.length, 0);
    },
    enabled: isFocused && !!validCurrentCategory,
    staleTime: 60 * 1000,
    retry: 1,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: 'always',
  });

  const loadedItems = useMemo(() => {
    const pages = itemsQuery.data?.pages ?? [];
    if (pages.length === 0) return EMPTY_ITEMS;
    const map = new Map<string, ItemSearchResult>();
    for (const page of pages) {
      for (const item of page) {
        if (!item?.id) continue;
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }, [itemsQuery.data?.pages]);

  const sortedItems = useMemo(() => {
    const sorted = [...loadedItems].sort((a, b) => {
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name, getLocale(language));
      }
      if (sortKey === 'changeLast48hPercent') {
        const aValue = a.changeLast48hPercent ?? -Infinity;
        const bValue = b.changeLast48hPercent ?? -Infinity;
        return aValue - bValue;
      }
      return getItemPrimaryPrice(a) - getItemPrimaryPrice(b);
    });
    if (sortDir === 'desc') sorted.reverse();
    return sorted;
  }, [language, loadedItems, sortDir, sortKey]);

  const handleSortSelect = useCallback((key: SortKey) => {
    setSortKey((previousKey) => {
      if (previousKey === key) {
        setSortDir((direction) => (direction === 'asc' ? 'desc' : 'asc'));
        return previousKey;
      }
      setSortDir(key === 'name' ? 'asc' : 'desc');
      return key;
    });
  }, []);

  const handleLoadMoreItems = useCallback(() => {
    if (!validCurrentCategory) return;
    if (!itemsQuery.hasNextPage || itemsQuery.isFetchingNextPage) return;
    void itemsQuery.fetchNextPage();
  }, [itemsQuery, validCurrentCategory]);

  const navigateToCategory = useCallback((categoryName?: string, mode: 'push' | 'replace' = 'push') => {
    const serializedCategory = serializeCategoryParam(categoryName);
    if (!serializedCategory) {
      if (mode === 'replace') {
        router.replace(SEARCH_ITEM_ROOT_PATH);
      } else {
        router.push(SEARCH_ITEM_ROOT_PATH);
      }
      return;
    }

    const route = {
      pathname: ITEM_TYPES_PATH,
      params: { category: serializedCategory },
    } as const;

    if (mode === 'replace') {
      router.replace(route);
      return;
    }
    router.push(route);
  }, [router]);

  const navigateToItemSearchRoot = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.dispatch(StackActions.popToTop());
      return;
    }
    router.replace(SEARCH_ITEM_ROOT_PATH);
  }, [navigation, router]);

  const navigateToBreadcrumbCategory = useCallback((categoryName: string, index: number) => {
    const total = breadcrumbCategories.length;
    const parentIndex = total - 2;
    const isParentCrumb = parentIndex >= 0 && index === parentIndex;
    if (isParentCrumb && navigation.canGoBack()) {
      router.back();
      return;
    }
    navigateToCategory(categoryName, 'replace');
  }, [breadcrumbCategories.length, navigateToCategory, navigation, router]);

  const openItem = useCallback((itemId: string) => {
    if (!itemId) return;
    router.push({ pathname: '/(tabs)/search/item/[id]', params: { id: itemId } });
  }, [router]);

  const renderItemResult = useCallback(({ item }: { item: ItemSearchResult }) => {
    const change = item.changeLast48hPercent ?? 0;
    const changeColor = change > 0 ? Colors.statGreen : change < 0 ? Colors.statRed : Colors.textSecondary;
    const imageUri = item.gridImageLink || item.baseImageLink || item.iconLink;

    return (
      <View style={styles.resultRowWrap}>
        <TouchableOpacity style={styles.resultRow} onPress={() => openItem(item.id)} activeOpacity={0.75}>
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
              {item.category?.name ? displayCategoryName(item.category.name) : t.searchUnknown}
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
  }, [displayCategoryName, openItem, t.searchSortPrice, t.searchUnknown]);

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

  useEffect(() => {
    if (!currentCategory) {
      router.replace(SEARCH_ITEM_ROOT_PATH);
      return;
    }
    const isLoading = categoriesQueryEn.isLoading || (language !== 'en' && categoriesQueryLocalized.isLoading);
    if (isLoading) return;
    if (validCurrentCategory) return;
    router.replace(SEARCH_ITEM_ROOT_PATH);
  }, [
    categoriesQueryEn.isLoading,
    categoriesQueryLocalized.isLoading,
    currentCategory,
    language,
    router,
    validCurrentCategory,
  ]);

  const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0 && Math.abs(next - headerHeight) > 1) {
      setHeaderHeight(next);
    }
  }, [headerHeight]);

  const pageTitle = validCurrentCategory
    ? displayCategoryName(validCurrentCategory)
    : `${t.searchFilterAll}${t.searchFilterType}`;
  const isCategoryLoading = categoriesQueryEn.isLoading || (language !== 'en' && categoriesQueryLocalized.isLoading);
  const categoryError = categoriesQueryEn.isError
    ? ((categoriesQueryEn.error as Error)?.message || '')
    : '';
  const itemError = itemsQuery.isError
    ? `${validCurrentCategory || t.searchUnknown}: ${((itemsQuery.error as Error)?.message || t.searchUnknown)}`
    : '';
  const activeError = categoryError || itemError;

  const listTopInset = headerHeight + 10;
  const listBottomInset = Math.max(getDockReservedInset(insets.bottom) + 12, 96);

  const rootCrumbLabel = `${t.searchFilterAll}${t.searchFilterType}`;

  const listHeader = (
    <>
      <View style={styles.breadcrumbSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.breadcrumbRow}
        >
          <TouchableOpacity
            onPress={navigateToItemSearchRoot}
            activeOpacity={0.75}
          >
            <Text style={[styles.breadcrumbText, !validCurrentCategory && styles.breadcrumbTextActive]}>
              {rootCrumbLabel}
            </Text>
          </TouchableOpacity>

          {breadcrumbCategories.map((categoryName, index) => {
            const isCurrent = index === breadcrumbCategories.length - 1;
            return (
              <React.Fragment key={`crumb-${categoryName}`}>
                <ChevronRight size={12} color={Colors.textTertiary} />
                <TouchableOpacity
                  onPress={() => navigateToBreadcrumbCategory(categoryName, index)}
                  disabled={isCurrent}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.breadcrumbText, isCurrent && styles.breadcrumbTextActive]}>
                    {displayCategoryName(categoryName)}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </ScrollView>

      </View>

      {isCategoryLoading ? (
        <View style={styles.categoryLoadingWrap}>
          <ShimmerBlock width={190} height={14} />
        </View>
      ) : visibleCategories.length > 0 ? (
        <>
          <View style={styles.categorySectionLabelRow}>
            <Text style={styles.categorySectionLabel}>{t.searchFilterType}</Text>
          </View>
          <View style={styles.categoryCardGrid}>
            {visibleCategories.map((categoryName) => (
              <TouchableOpacity
                key={categoryName}
                style={styles.categoryCard}
                onPress={() => navigateToCategory(categoryName, 'push')}
                activeOpacity={0.8}
              >
                <Text style={styles.categoryCardTitle} numberOfLines={2}>
                  {displayCategoryName(categoryName)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}

      {validCurrentCategory ? (
        <View style={styles.filtersSection}>
          <View style={styles.sortGroup}>
            <ArrowUpDown size={14} color={Colors.textSecondary} />
            <View style={styles.sortOptions}>
              {SORT_OPTIONS.map((option) => {
                const active = sortKey === option.key;
                const label = t[option.labelKey as keyof typeof t] as string;
                const arrowColor = active ? Colors.text : Colors.textSecondary;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.sortChip, active && styles.sortChipActive, active && themeStyles.sortChipActive]}
                    onPress={() => handleSortSelect(option.key)}
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
        </View>
      ) : null}

      {activeError ? <Text style={styles.errorText}>{activeError}</Text> : null}
    </>
  );

  const showCategoryEmpty = !validCurrentCategory && !isCategoryLoading && visibleCategories.length === 0;
  const showItemEmpty = !!validCurrentCategory && !itemsQuery.isLoading && sortedItems.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <FlatList
        data={validCurrentCategory ? sortedItems : EMPTY_ITEMS}
        keyExtractor={(item) => item.id}
        renderItem={renderItemResult}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMoreItems}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          validCurrentCategory && itemsQuery.isFetchingNextPage ? (
            renderItemSkeletonRows(2)
          ) : null
        }
        ListEmptyComponent={
          validCurrentCategory && itemsQuery.isLoading ? renderItemSkeletonRows() : (
            showCategoryEmpty ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t.searchItemTypesNoSubcategories}</Text>
              </View>
            ) : showItemEmpty ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t.searchItemTypesNoItems}</Text>
                <Text style={styles.emptySubtitle}>
                  {t.searchItemTypesNoItemsSub}
                </Text>
              </View>
            ) : null
          )
        }
        contentContainerStyle={[styles.listContent, { paddingTop: listTopInset, paddingBottom: listBottomInset }]}
      />

      <PageHeader
        title={pageTitle}
        subtitle={t.searchHeaderSubtitle}
        fixed
        onLayout={handleHeaderLayout}
      />

      <FullScreenImageModal
        visible={previewVisible}
        uri={previewUri}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewUri(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  breadcrumbSection: {
    marginHorizontal: 16,
    marginBottom: 6,
    gap: 8,
    alignItems: 'flex-start',
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
  },
  breadcrumbText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  breadcrumbTextActive: {
    color: Colors.text,
    fontWeight: '700' as const,
  },
  categoryLoadingWrap: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardGrid: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categorySectionLabelRow: {
    marginHorizontal: 20,
    marginBottom: 6,
  },
  categorySectionLabel: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  categoryCard: {
    width: '48%',
    minHeight: 60,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    gap: 4,
  },
  categoryCardTitle: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
  filtersSection: {
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 8,
    gap: 8,
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
  errorText: {
    color: Colors.statRed,
    fontSize: 12,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  listContent: {
    paddingBottom: 24,
  },
  skeletonListWrap: {
    paddingTop: 2,
    paddingBottom: 8,
    gap: 0,
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
    width: 34,
    height: 34,
  },
  resultIconPlaceholder: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: Colors.border,
  },
  resultInfo: {
    flex: 1,
    marginHorizontal: 10,
    gap: 2,
  },
  skeletonResultInfo: {
    flex: 1,
    marginHorizontal: 10,
    gap: 6,
    justifyContent: 'center',
  },
  resultName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  resultMeta: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  resultPriceBlock: {
    minWidth: 84,
    alignItems: 'flex-end',
    gap: 2,
  },
  skeletonPriceInfo: {
    minWidth: 84,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  priceLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
  },
  priceValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  changeValue: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  emptyWrap: {
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});

