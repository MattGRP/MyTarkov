import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useSegments } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Filter } from 'lucide-react-native';
import Colors, { alphaBlack, alphaWhite, getModeAccentTheme } from '@/constants/colors';
import { localizeCategoryName, localizeTraderName } from '@/constants/i18n';
import { useGameMode } from '@/providers/GameModeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { fetchTraderById } from '@/services/tarkovApi';
import type {
  TraderBarterOffer,
  TraderCashOffer,
  TraderContainedItem,
  TraderOfferItemRef,
} from '@/types/tarkov';
import { formatCountdownToTimestamp, formatPrice } from '@/utils/helpers';
import ShimmerBlock from '@/components/ShimmerBlock';
import FullscreenSkeleton from '@/components/FullscreenSkeleton';

const OFFER_SORT_OPTIONS = [
  { key: 'name', labelKey: 'searchSortName' },
  { key: 'price', labelKey: 'searchSortPrice' },
] as const;

type OfferSortKey = typeof OFFER_SORT_OPTIONS[number]['key'];
type SortDirection = 'asc' | 'desc';
type OfferTypeFilter = 'all' | 'cash' | 'barter';

function resolveTraderDescriptionText(value: string | null | undefined): string | null {
  const text = String(value || '').trim();
  if (!text) return null;
  const normalized = text.toLowerCase();
  if (normalized === '<unknown>' || normalized === 'unknown') return null;
  return text;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatOfferPrice(offer: TraderCashOffer): string {
  if (typeof offer.priceRUB === 'number' && Number.isFinite(offer.priceRUB) && offer.priceRUB > 0) {
    return `${formatPrice(offer.priceRUB)} RUB`;
  }
  if (typeof offer.price === 'number' && Number.isFinite(offer.price) && offer.price > 0) {
    const currency = (offer.currency || offer.currencyItem?.shortName || offer.currencyItem?.name || '').trim();
    return currency ? `${formatPrice(offer.price)} ${currency}` : formatPrice(offer.price);
  }
  return '-';
}

function getOfferPriceValue(offer: TraderCashOffer): number {
  if (typeof offer.priceRUB === 'number' && Number.isFinite(offer.priceRUB) && offer.priceRUB > 0) {
    return offer.priceRUB;
  }
  if (typeof offer.price === 'number' && Number.isFinite(offer.price) && offer.price > 0) {
    return offer.price;
  }
  return Number.POSITIVE_INFINITY;
}

function resolveOfferCategoryName(item: TraderOfferItemRef | null | undefined): string | null {
  const categoryName = item?.category?.name?.trim();
  if (categoryName) return categoryName;
  const firstType = item?.types?.find((type) => typeof type === 'string' && type.trim());
  return firstType?.trim() || null;
}

function getContainedCount(entry: TraderContainedItem): number {
  const raw = entry.count ?? entry.quantity ?? 0;
  return Number.isFinite(raw) ? Number(raw) : 0;
}

function formatContainedLabel(entry: TraderContainedItem): string {
  const count = getContainedCount(entry);
  const itemName = entry.item?.shortName || entry.item?.name || '-';
  return `${formatNumber(count)}x ${itemName}`;
}

const TRADER_WIKI_OVERRIDES: Record<string, string> = {
  fence: 'https://escapefromtarkov.fandom.com/wiki/Fence',
  prapor: 'https://escapefromtarkov.fandom.com/wiki/Prapor',
  therapist: 'https://escapefromtarkov.fandom.com/wiki/Therapist',
  skier: 'https://escapefromtarkov.fandom.com/wiki/Skier',
  peacekeeper: 'https://escapefromtarkov.fandom.com/wiki/Peacekeeper',
  mechanic: 'https://escapefromtarkov.fandom.com/wiki/Mechanic',
  ragman: 'https://escapefromtarkov.fandom.com/wiki/Ragman',
  jaeger: 'https://escapefromtarkov.fandom.com/wiki/Jaeger',
  lightkeeper: 'https://escapefromtarkov.fandom.com/wiki/Lightkeeper',
  'radio-station': 'https://escapefromtarkov.fandom.com/wiki/Radio_station',
  ref: 'https://escapefromtarkov.fandom.com/wiki/Ref',
  taran: 'https://escapefromtarkov.fandom.com/wiki/Taran',
  voevoda: 'https://escapefromtarkov.fandom.com/wiki/Voevoda',
  voecoda: 'https://escapefromtarkov.fandom.com/wiki/Voevoda',
  'mr-kerman': 'https://escapefromtarkov.fandom.com/wiki/Mr._Kerman',
  'btr-driver': 'https://escapefromtarkov.fandom.com/wiki/BTR_Driver',
};

function resolveTraderWikiLink(name?: string, normalizedName?: string): string {
  const normalized = String(normalizedName || '').trim().toLowerCase();
  if (normalized && TRADER_WIKI_OVERRIDES[normalized]) {
    return TRADER_WIKI_OVERRIDES[normalized];
  }
  const rawName = String(name || '').trim();
  if (!rawName) return '';
  return `https://escapefromtarkov.fandom.com/wiki/${encodeURIComponent(rawName.replace(/\s+/g, '_'))}`;
}

export default function TraderDetailScreen() {
  const {
    id,
    name,
    normalizedName,
    imageLink,
    description,
    resetTime,
  } = useLocalSearchParams<{
    id: string | string[];
    name?: string | string[];
    normalizedName?: string | string[];
    imageLink?: string | string[];
    description?: string | string[];
    resetTime?: string | string[];
  }>();
  const traderId = Array.isArray(id) ? id[0] : id;
  const getParam = useCallback((value?: string | string[]) => {
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
  }, []);
  const { t, language } = useLanguage();
  const { gameMode } = useGameMode();
  const accentTheme = useMemo(() => getModeAccentTheme(gameMode), [gameMode]);
  const themeStyles = useMemo(() => ({
    chipActive: {
      borderColor: accentTheme.accentDim,
      backgroundColor: accentTheme.accentSoft18,
    },
    filterChipActive: {
      borderColor: accentTheme.accentDim,
      backgroundColor: accentTheme.accentSoft15,
    },
    wikiButton: {
      borderColor: accentTheme.accentDim,
      backgroundColor: accentTheme.accentSoft16,
    },
    primaryAction: {
      backgroundColor: accentTheme.accent,
      borderColor: accentTheme.accent,
    },
    primaryActionText: {
      color: accentTheme.accentTextOnSolid,
    },
  }), [accentTheme]);
  const router = useRouter();
  const segments = useSegments();
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [offerSortKey, setOfferSortKey] = useState<OfferSortKey>('price');
  const [offerSortDir, setOfferSortDir] = useState<SortDirection>('desc');
  const [offerTypeFilter, setOfferTypeFilter] = useState<OfferTypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [draftCategories, setDraftCategories] = useState<string[]>([]);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const traderQuery = useQuery({
    queryKey: ['trader-detail', traderId, language, gameMode],
    queryFn: ({ signal }) => fetchTraderById(traderId!, language, { signal, gameMode }),
    enabled: !!traderId,
    staleTime: 30 * 60 * 1000,
  });

  const previewTrader = useMemo(() => {
    const previewId = String(traderId || '').trim();
    if (!previewId) return null;
    const previewName = getParam(name) || previewId;
    return {
      id: previewId,
      name: previewName,
      normalizedName: getParam(normalizedName) || undefined,
      imageLink: getParam(imageLink) || undefined,
      description: getParam(description) || undefined,
      resetTime: getParam(resetTime) || undefined,
      levels: [],
      cashOffers: [],
      barters: [],
    };
  }, [description, getParam, imageLink, name, normalizedName, resetTime, traderId]);

  const trader = traderQuery.data ?? previewTrader;
  const isHydratingDetails = !traderQuery.data && traderQuery.isFetching && !!previewTrader;
  const title = trader
    ? localizeTraderName(trader.name, trader.normalizedName, language)
    : t.traderDetailsTitle;
  const traderDescriptionText = resolveTraderDescriptionText(trader?.description) || t.searchUnknown;
  const traderWikiLink = useMemo(
    () => resolveTraderWikiLink(trader?.name, trader?.normalizedName),
    [trader?.name, trader?.normalizedName],
  );

  const sortedLevels = useMemo(() => {
    const levels = trader?.levels ?? [];
    return [...levels].sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  }, [trader?.levels]);

  useEffect(() => {
    if (sortedLevels.length === 0) {
      setSelectedLevelId('');
      return;
    }
    setSelectedLevelId((prev) => (
      sortedLevels.some((level) => level.id === prev) ? prev : sortedLevels[0].id
    ));
  }, [sortedLevels]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedLevel = useMemo(() => {
    if (sortedLevels.length === 0) return null;
    return sortedLevels.find((level) => level.id === selectedLevelId) ?? sortedLevels[0];
  }, [selectedLevelId, sortedLevels]);

  const levelCashOffers = useMemo(() => {
    return selectedLevel?.cashOffers ?? [];
  }, [selectedLevel?.cashOffers]);

  const levelBarterRows = useMemo(() => {
    const levelValue = selectedLevel?.level ?? 0;
    const levelBarters = (trader?.barters ?? []).filter((offer) => (offer.level ?? 0) === levelValue);
    const rows: Array<{ key: string; offer: TraderBarterOffer; reward: TraderContainedItem }> = [];
    levelBarters.forEach((offer, offerIndex) => {
      (offer.rewardItems ?? []).forEach((reward, rewardIndex) => {
        const rewardId = reward.item?.id || `reward-${rewardIndex}`;
        rows.push({
          key: `${offer.id || offerIndex}-${rewardId}-${rewardIndex}`,
          offer,
          reward,
        });
      });
    });
    return rows;
  }, [selectedLevel?.level, trader?.barters]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    levelCashOffers.forEach((offer) => {
      const name = resolveOfferCategoryName(offer.item);
      if (name) set.add(name);
    });
    levelBarterRows.forEach((row) => {
      const name = resolveOfferCategoryName(row.reward.item);
      if (name) set.add(name);
    });
    const locale = language === 'zh' ? 'zh-Hans-CN' : language === 'ru' ? 'ru-RU' : 'en';
    return Array.from(set).sort((a, b) => (
      localizeCategoryName(a, language).localeCompare(localizeCategoryName(b, language), locale)
    ));
  }, [language, levelBarterRows, levelCashOffers]);

  const effectiveCategories = useMemo(() => {
    if (categoryFilter.length === 0) return [];
    const availableSet = new Set(availableCategories);
    return categoryFilter.filter((category) => availableSet.has(category));
  }, [availableCategories, categoryFilter]);

  const selectedCategorySet = useMemo(() => new Set(effectiveCategories), [effectiveCategories]);
  const draftCategorySet = useMemo(() => new Set(draftCategories), [draftCategories]);

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

  const cashPriceByItemId = useMemo(() => {
    const map = new Map<string, number>();
    levelCashOffers.forEach((offer) => {
      const itemId = offer.item?.id;
      if (!itemId) return;
      map.set(itemId, getOfferPriceValue(offer));
    });
    return map;
  }, [levelCashOffers]);

  const cashOffers = useMemo(() => {
    let offers = levelCashOffers;
    if (selectedCategorySet.size > 0) {
      offers = offers.filter((offer) => {
        const categoryName = resolveOfferCategoryName(offer.item);
        return !!categoryName && selectedCategorySet.has(categoryName);
      });
    }

    const sorted = [...offers].sort((a, b) => {
      if (offerSortKey === 'price') {
        const diff = getOfferPriceValue(a) - getOfferPriceValue(b);
        if (diff !== 0) return diff;
      }
      return (a.item?.name || '').localeCompare(b.item?.name || '');
    });
    if (offerSortDir === 'desc') sorted.reverse();
    return sorted;
  }, [levelCashOffers, offerSortDir, offerSortKey, selectedCategorySet]);

  const barterRows = useMemo(() => {
    let rows = levelBarterRows;
    if (selectedCategorySet.size > 0) {
      rows = rows.filter((row) => {
        const categoryName = resolveOfferCategoryName(row.reward.item);
        return !!categoryName && selectedCategorySet.has(categoryName);
      });
    }

    const sorted = [...rows].sort((a, b) => {
      if (offerSortKey === 'price') {
        const aPrice = cashPriceByItemId.get(a.reward.item?.id || '') ?? Number.POSITIVE_INFINITY;
        const bPrice = cashPriceByItemId.get(b.reward.item?.id || '') ?? Number.POSITIVE_INFINITY;
        const diff = aPrice - bPrice;
        if (diff !== 0) return diff;
      }
      return (a.reward.item?.name || '').localeCompare(b.reward.item?.name || '');
    });
    if (offerSortDir === 'desc') sorted.reverse();
    return sorted;
  }, [cashPriceByItemId, levelBarterRows, offerSortDir, offerSortKey, selectedCategorySet]);
  const showCashOffers = offerTypeFilter !== 'barter';
  const showBarterOffers = offerTypeFilter !== 'cash';

  const isTasksContext = useMemo(() => (segments as string[]).includes('tasks'), [segments]);

  const openItem = useCallback((itemId: string | undefined) => {
    if (!itemId) return;
    router.push({
      pathname: isTasksContext ? '/(tabs)/tasks/item/[id]' : '/(tabs)/search/item/[id]',
      params: { id: itemId },
    });
  }, [isTasksContext, router]);

  const handleSortSelect = useCallback((nextKey: OfferSortKey) => {
    setOfferSortKey((prev) => {
      if (prev === nextKey) {
        setOfferSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setOfferSortDir(nextKey === 'price' ? 'desc' : 'asc');
      return nextKey;
    });
  }, []);

  const openCategoryModal = useCallback(() => {
    setDraftCategories(effectiveCategories);
    setCategoryModalOpen(true);
  }, [effectiveCategories]);

  const closeCategoryModal = useCallback(() => {
    setCategoryModalOpen(false);
  }, []);

  const clearCategoryFilter = useCallback(() => {
    setCategoryFilter([]);
    setDraftCategories([]);
    setCategoryModalOpen(false);
  }, []);

  const toggleDraftCategory = useCallback((category: string) => {
    setDraftCategories((prev) => (
      prev.includes(category) ? prev.filter((entry) => entry !== category) : [...prev, category]
    ));
  }, []);

  const applyCategoryFilter = useCallback(() => {
    setCategoryFilter(draftCategories);
    setCategoryModalOpen(false);
  }, [draftCategories]);

  const openWiki = useCallback(async () => {
    if (!traderWikiLink) return;
    try {
      await Linking.openURL(traderWikiLink);
    } catch {
      // ignore open-url failure
    }
  }, [traderWikiLink]);

  if (traderQuery.isLoading && !trader) {
    return (
      <>
        <Stack.Screen options={{ title: t.traderDetailsTitle }} />
        <FullscreenSkeleton message={t.searchTraderTitle} />
      </>
    );
  }

  if (traderQuery.isError || !trader) {
    return (
      <View style={styles.centerWrap}>
        <Stack.Screen options={{ title: t.traderDetailsTitle }} />
        <Text style={styles.errorText}>{t.searchNoTraders}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            {trader.imageLink ? (
              <Image source={{ uri: trader.imageLink }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}
          </View>
          <View style={styles.heroMain}>
            <Text style={styles.heroTitle}>
              {localizeTraderName(trader.name, trader.normalizedName, language)}
            </Text>
            <Text style={styles.heroSub}>
              {t.traderResetTime}: {formatCountdownToTimestamp(trader.resetTime, nowTick)}
            </Text>
            {traderWikiLink ? (
              <TouchableOpacity style={[styles.wikiButton, themeStyles.wikiButton]} activeOpacity={0.75} onPress={openWiki}>
                <ExternalLink size={14} color={Colors.gold} />
                <Text style={styles.wikiButtonText}>{t.taskOpenWiki}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.traderDescription}</Text>
          {isHydratingDetails ? (
            <View style={styles.skeletonList}>
              <ShimmerBlock height={14} />
              <ShimmerBlock height={14} width="92%" />
              <ShimmerBlock height={14} width="78%" />
            </View>
          ) : (
            <Text style={styles.sectionText}>{traderDescriptionText}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.traderLevels}</Text>
          {isHydratingDetails ? (
            <View style={styles.skeletonList}>
              <ShimmerBlock height={30} borderRadius={999} width="42%" />
              <ShimmerBlock height={92} borderRadius={10} />
            </View>
          ) : sortedLevels.length === 0 ? (
            <Text style={styles.sectionText}>-</Text>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.levelTabsRow}
              >
                {sortedLevels.map((level) => {
                  const selected = level.id === selectedLevel?.id;
                  return (
                    <TouchableOpacity
                      key={level.id}
                      style={[styles.levelTab, selected && styles.levelTabActive, selected && themeStyles.chipActive]}
                      activeOpacity={0.75}
                      onPress={() => setSelectedLevelId(level.id)}
                    >
                      <Text style={[styles.levelTabText, selected && styles.levelTabTextActive]}>
                        {t.level} {level.level}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {selectedLevel ? (
                <View style={styles.levelInfoCard}>
                  <Text style={styles.levelInfoTitle}>{t.traderUnlockConditions}</Text>
                  <View style={styles.levelRow}>
                    <Text style={styles.levelLabel}>{t.traderRequiredPlayerLevel}</Text>
                    <Text style={styles.levelValue}>{formatNumber(selectedLevel.requiredPlayerLevel)}</Text>
                  </View>
                  <View style={styles.levelRow}>
                    <Text style={styles.levelLabel}>{t.traderRequiredReputation}</Text>
                    <Text style={styles.levelValue}>{formatNumber(selectedLevel.requiredReputation)}</Text>
                  </View>
                  <View style={styles.levelRow}>
                    <Text style={styles.levelLabel}>{t.traderRequiredCommerce}</Text>
                    <Text style={styles.levelValue}>{formatNumber(selectedLevel.requiredCommerce)}</Text>
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.traderSellItems}</Text>
          {isHydratingDetails ? (
            <View style={styles.skeletonList}>
              <ShimmerBlock height={34} borderRadius={10} />
              <ShimmerBlock height={64} borderRadius={12} />
              <ShimmerBlock height={64} borderRadius={12} />
              <ShimmerBlock height={64} borderRadius={12} />
            </View>
          ) : (
            <>
              <View style={styles.offerToolsRow}>
            <View style={styles.sortGroup}>
              <ArrowUpDown size={14} color={Colors.textSecondary} />
              <View style={styles.sortOptions}>
                {OFFER_SORT_OPTIONS.map((opt) => {
                  const active = offerSortKey === opt.key;
                  const label = t[opt.labelKey as keyof typeof t] as string;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.sortChip, active && styles.sortChipActive, active && themeStyles.chipActive]}
                      onPress={() => handleSortSelect(opt.key)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.sortChipContent}>
                        <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{label}</Text>
                        {active && (offerSortDir === 'asc'
                          ? <ArrowUp size={12} color={Colors.text} />
                          : <ArrowDown size={12} color={Colors.text} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <View style={styles.offerTypeGroup}>
              <TouchableOpacity
                style={[styles.sortChip, offerTypeFilter === 'all' && styles.sortChipActive, offerTypeFilter === 'all' && themeStyles.chipActive]}
                activeOpacity={0.75}
                onPress={() => setOfferTypeFilter('all')}
              >
                <Text style={[styles.sortChipText, offerTypeFilter === 'all' && styles.sortChipTextActive]}>
                  {t.searchFilterAll}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortChip, offerTypeFilter === 'cash' && styles.sortChipActive, offerTypeFilter === 'cash' && themeStyles.chipActive]}
                activeOpacity={0.75}
                onPress={() => setOfferTypeFilter('cash')}
              >
                <Text style={[styles.sortChipText, offerTypeFilter === 'cash' && styles.sortChipTextActive]}>
                  {t.traderCashOffers}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortChip, offerTypeFilter === 'barter' && styles.sortChipActive, offerTypeFilter === 'barter' && themeStyles.chipActive]}
                activeOpacity={0.75}
                onPress={() => setOfferTypeFilter('barter')}
              >
                <Text style={[styles.sortChipText, offerTypeFilter === 'barter' && styles.sortChipTextActive]}>
                  {t.traderBarterOffers}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.categoryButton} onPress={openCategoryModal} activeOpacity={0.75}>
              <Filter size={14} color={Colors.textSecondary} />
              <Text style={styles.categoryButtonText}>
                {t.searchFilterCategory}{effectiveCategories.length > 0 ? ` (${effectiveCategories.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

              {showCashOffers ? (
            <View style={styles.offerGroup}>
              <Text style={styles.offerGroupTitle}>{t.traderCashOffers}</Text>
              {cashOffers.length === 0 ? (
                <Text style={styles.sectionText}>{t.traderNoOffers}</Text>
              ) : (
                cashOffers.map((offer, index) => (
                  <View key={offer.id || `${offer.item?.id || 'cash'}-${index}`} style={styles.offerRowWrap}>
                    <TouchableOpacity
                      style={styles.offerRow}
                      activeOpacity={offer.item?.id ? 0.75 : 1}
                      onPress={() => openItem(offer.item?.id)}
                      disabled={!offer.item?.id}
                    >
                      <View style={styles.offerIconWrap}>
                        {offer.item?.iconLink ? (
                          <Image source={{ uri: offer.item.iconLink }} style={styles.offerIcon} contentFit="cover" />
                        ) : (
                          <View style={styles.offerIconPlaceholder} />
                        )}
                      </View>
                      <View style={styles.offerMain}>
                        <Text style={styles.offerName} numberOfLines={2}>{offer.item?.name || '-'}</Text>
                        {resolveOfferCategoryName(offer.item) ? (
                          <Text style={styles.offerCategory} numberOfLines={1}>
                            {localizeCategoryName(resolveOfferCategoryName(offer.item) || '', language)}
                          </Text>
                        ) : null}
                        {offer.taskUnlock?.name ? (
                          <Text style={styles.offerMeta} numberOfLines={1}>
                            {t.traderTaskUnlock}: {offer.taskUnlock.name}
                          </Text>
                        ) : null}
                        {offer.buyLimit ? (
                          <Text style={styles.offerMeta} numberOfLines={1}>
                            {t.traderBuyLimit}: {offer.buyLimit}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.offerValue}>{formatOfferPrice(offer)}</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
              ) : null}

              {showBarterOffers ? (
            <View style={styles.offerGroup}>
              <Text style={styles.offerGroupTitle}>{t.traderBarterOffers}</Text>
              {barterRows.length === 0 ? (
                <Text style={styles.sectionText}>{t.traderNoOffers}</Text>
              ) : (
                barterRows.map((row) => (
                  <View key={row.key} style={styles.offerRowWrap}>
                    <TouchableOpacity
                      style={styles.offerRow}
                      activeOpacity={row.reward.item?.id ? 0.75 : 1}
                      onPress={() => openItem(row.reward.item?.id)}
                      disabled={!row.reward.item?.id}
                    >
                      <View style={styles.offerIconWrap}>
                        {row.reward.item?.iconLink ? (
                          <Image source={{ uri: row.reward.item.iconLink }} style={styles.offerIcon} contentFit="cover" />
                        ) : (
                          <View style={styles.offerIconPlaceholder} />
                        )}
                      </View>
                      <View style={styles.offerMain}>
                        <Text style={styles.offerName} numberOfLines={2}>{row.reward.item?.name || '-'}</Text>
                        {resolveOfferCategoryName(row.reward.item) ? (
                          <Text style={styles.offerCategory} numberOfLines={1}>
                            {localizeCategoryName(resolveOfferCategoryName(row.reward.item) || '', language)}
                          </Text>
                        ) : null}
                        {row.offer.taskUnlock?.name ? (
                          <Text style={styles.offerMeta} numberOfLines={1}>
                            {t.traderTaskUnlock}: {row.offer.taskUnlock.name}
                          </Text>
                        ) : null}
                        {row.offer.buyLimit ? (
                          <Text style={styles.offerMeta} numberOfLines={1}>
                            {t.traderBuyLimit}: {row.offer.buyLimit}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.offerValue}>{t.traderBarterOffers}</Text>
                    </TouchableOpacity>
                    <View style={styles.barterNeedsBlock}>
                      <Text style={styles.barterNeedsTitle}>{t.traderBarterNeeds}</Text>
                      {(row.offer.requiredItems?.length ?? 0) === 0 ? (
                        <Text style={styles.barterNeedsEmpty}>-</Text>
                      ) : (
                        <View style={styles.barterNeedList}>
                          {(row.offer.requiredItems ?? []).map((entry, idx) => (
                            <TouchableOpacity
                              key={`${row.key}-need-${entry.item?.id || idx}`}
                              style={styles.barterNeedItem}
                              activeOpacity={entry.item?.id ? 0.75 : 1}
                              onPress={() => openItem(entry.item?.id)}
                              disabled={!entry.item?.id}
                            >
                              <View style={styles.barterNeedIconWrap}>
                                {entry.item?.iconLink ? (
                                  <Image source={{ uri: entry.item.iconLink }} style={styles.barterNeedIcon} contentFit="cover" />
                                ) : (
                                  <View style={styles.barterNeedIconPlaceholder} />
                                )}
                              </View>
                              <Text style={styles.barterNeedText} numberOfLines={1}>
                                {formatContainedLabel(entry)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={categoryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeCategoryModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeCategoryModal}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <Text style={styles.modalTitle}>{t.searchFilterCategory}</Text>
            <View style={styles.modalContent}>
              {availableCategories.length === 0 ? (
                <Text style={styles.sectionText}>-</Text>
              ) : (
                <ScrollView contentContainerStyle={styles.modalChips} showsVerticalScrollIndicator={false}>
                  {availableCategories.map((category) => {
                    const selected = draftCategorySet.has(category);
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[styles.filterChip, selected && styles.filterChipActive, selected && themeStyles.filterChipActive]}
                        onPress={() => toggleDraftCategory(category)}
                        activeOpacity={0.75}
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
                <Text style={[styles.modalActionText, styles.modalActionTextPrimary, themeStyles.primaryActionText]}>{t.apply}</Text>
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  centerWrap: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 12,
  },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
  },
  heroMain: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  heroSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 12,
    gap: 8,
  },
  skeletonList: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  wikiButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.goldDim,
    backgroundColor: alphaWhite(0.03),
  },
  wikiButtonText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  levelTabsRow: {
    gap: 8,
    paddingBottom: 2,
  },
  levelTab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelTabActive: {
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
  },
  levelTabText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  levelTabTextActive: {
    color: Colors.gold,
  },
  levelInfoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  levelInfoTitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  levelRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  levelLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  levelValue: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600' as const,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  offerToolsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  sortGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 180,
  },
  sortOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  sortChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sortChipActive: {
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
  },
  sortChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortChipText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  sortChipTextActive: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
  categoryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryButtonText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  offerTypeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  offerGroup: {
    gap: 6,
  },
  offerGroupTitle: {
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  offerRowWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  offerRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  offerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  offerIcon: {
    width: '100%',
    height: '100%',
  },
  offerIconPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
  },
  offerMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  offerName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  offerCategory: {
    color: alphaWhite(0.78),
    fontSize: 11,
    fontWeight: '600' as const,
  },
  offerMeta: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  offerValue: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700' as const,
    textAlign: 'right',
    maxWidth: 112,
  },
  barterNeedsBlock: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: alphaWhite(0.02),
  },
  barterNeedsTitle: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  barterNeedsEmpty: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  barterNeedList: {
    gap: 6,
  },
  barterNeedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 24,
  },
  barterNeedIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  barterNeedIcon: {
    width: '100%',
    height: '100%',
  },
  barterNeedIconPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
  },
  barterNeedText: {
    color: Colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: alphaBlack(0.78),
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: alphaWhite(0.16),
    padding: 14,
    maxHeight: '70%',
    gap: 10,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  modalContent: {
    minHeight: 100,
  },
  modalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  filterChipActive: {
    borderColor: Colors.border,
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
    gap: 8,
  },
  modalAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modalActionPrimary: {
    borderColor: Colors.goldDim,
    backgroundColor: Colors.gold,
  },
  modalActionText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  modalActionTextPrimary: {
    color: Colors.text,
  },
});
