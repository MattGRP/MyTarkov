import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ExternalLink } from 'lucide-react-native';
import Colors, { alphaWhite, getModeAccentTheme } from '@/constants/colors';
import {
  localizeBossBehavior,
  localizeBossNarrative,
  localizeBossName,
  localizeCategoryName,
} from '@/constants/i18n';
import { useGameMode } from '@/providers/GameModeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { fetchBossById } from '@/services/tarkovApi';
import type {
  BossDetail,
  BossContainedItem,
  BossEscort,
  BossLootItem,
  BossMapSpawn,
  TraderOfferItemRef,
} from '@/types/tarkov';
import { getItemImageURL } from '@/types/tarkov';
import FullScreenImageModal from '@/components/FullScreenImageModal';
import ShimmerBlock from '@/components/ShimmerBlock';
import FullscreenSkeleton from '@/components/FullscreenSkeleton';

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '1';
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(1);
}

function getContainedCount(entry: BossContainedItem): number {
  const raw = Number(entry.count ?? entry.quantity ?? 1);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return raw;
}

function getHealthValue(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return numeric;
}

function formatPercent(value: number | null | undefined): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) return '-';
  return `${Math.round(numeric * 100)}%`;
}

function formatSpawnTime(value: number | null | undefined, anyLabel: string): string {
  const numeric = Number(value ?? NaN);
  if (!Number.isFinite(numeric)) return '-';
  if (numeric < 0) return anyLabel;
  const totalSeconds = Math.max(0, Math.floor(numeric));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatFollowerAmounts(follower: BossEscort): string {
  const amounts = follower.amounts ?? [];
  if (amounts.length === 0) return '-';
  return amounts
    .map((amount) => `x${amount.count} (${formatPercent(amount.chance)})`)
    .join(', ');
}

function normalizeIdentity(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function getSpawnOrder(value: number | null | undefined): number {
  const numeric = Number(value ?? NaN);
  if (!Number.isFinite(numeric)) return Number.POSITIVE_INFINITY;
  return numeric;
}

function getSpawnLocationLabel(
  location: { name?: string | null; spawnKey?: string | null },
  mapName?: string | null,
): string {
  const locationName = String(location.name || '').trim();
  const spawnKey = String(location.spawnKey || '').trim();
  if (locationName) {
    const normalizedLocationName = normalizeIdentity(locationName);
    const normalizedMapName = normalizeIdentity(mapName);
    if (spawnKey && normalizedMapName && normalizedLocationName === normalizedMapName) {
      return spawnKey;
    }
    return locationName;
  }
  return spawnKey || '-';
}

function getEquipmentSlot(entry: BossContainedItem): string {
  const slot = (entry.attributes ?? []).find((attribute) => (
    String(attribute?.name || '').trim().toLowerCase() === 'slot'
  ));
  return String(slot?.value || '').trim();
}

const EQUIPMENT_SLOT_ORDER: Record<string, number> = {
  firstprimaryweapon: 1,
  secondprimaryweapon: 2,
  holster: 3,
  headwear: 4,
  facecover: 5,
  eyewear: 6,
  earpiece: 7,
  armorvest: 8,
  tacticalvest: 9,
  backpack: 10,
  scabbard: 11,
  securedcontainer: 12,
  armband: 13,
  unknown: 99,
};

function getEquipmentSlotOrder(slot: string): number {
  const key = String(slot || '').trim().toLowerCase();
  return EQUIPMENT_SLOT_ORDER[key] ?? EQUIPMENT_SLOT_ORDER.unknown;
}

export default function BossDetailScreen() {
  const {
    id,
    name,
    normalizedName,
    imagePortraitLink,
    imagePosterLink,
  } = useLocalSearchParams<{
    id: string | string[];
    name?: string | string[];
    normalizedName?: string | string[];
    imagePortraitLink?: string | string[];
    imagePosterLink?: string | string[];
  }>();
  const bossId = Array.isArray(id) ? id[0] : id;
  const getParam = useCallback((value?: string | string[]) => {
    if (Array.isArray(value)) return String(value[0] || '').trim();
    return String(value || '').trim();
  }, []);
  const { t, language } = useLanguage();
  const { gameMode } = useGameMode();
  const accentTheme = useMemo(() => getModeAccentTheme(gameMode), [gameMode]);
  const wikiButtonTheme = useMemo(() => ({
    borderColor: accentTheme.accentDim,
    backgroundColor: accentTheme.accentSoft16,
  }), [accentTheme]);
  const router = useRouter();
  const equipmentPagerRef = useRef<ScrollView | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [equipmentPagerWidth, setEquipmentPagerWidth] = useState(0);
  const [equipmentPageHeights, setEquipmentPageHeights] = useState<number[]>([]);
  const [activeSetIndex, setActiveSetIndex] = useState(0);
  const bossLookupHints = useMemo(() => (
    Array.from(
      new Set(
        [getParam(normalizedName), getParam(name)]
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      ),
    )
  ), [getParam, name, normalizedName]);

  const bossQuery = useQuery({
    queryKey: ['boss-detail', bossId, language, gameMode, bossLookupHints.join('|')],
    queryFn: ({ signal }) => fetchBossById(bossId!, language, {
      signal,
      hints: bossLookupHints,
      gameMode,
    }),
    enabled: !!bossId,
    staleTime: 30 * 60 * 1000,
  });

  const previewBoss = useMemo<BossDetail | null>(() => {
    const previewId = String(bossId || '').trim();
    if (!previewId) return null;
    const previewName = getParam(name) || previewId;
    return {
      id: previewId,
      name: previewName,
      normalizedName: getParam(normalizedName) || undefined,
      imagePortraitLink: getParam(imagePortraitLink) || undefined,
      imagePosterLink: getParam(imagePosterLink) || undefined,
      description: null,
      behavior: null,
      wikiLink: null,
      health: [],
      equipment: [],
      equipmentSets: [],
      items: [],
      maps: [],
      followers: [],
    };
  }, [bossId, getParam, imagePortraitLink, imagePosterLink, name, normalizedName]);
  const boss: BossDetail | null = bossQuery.data ?? previewBoss;
  const isHydratingDetails = !bossQuery.data && bossQuery.isFetching && !!previewBoss;
  const localizedName = useMemo(
    () => localizeBossName(String(boss?.name || ''), boss?.normalizedName, language),
    [boss?.name, boss?.normalizedName, language],
  );
  const title = localizedName || t.bossDetailsTitle;
  const localizedBehavior = useMemo(
    () => localizeBossBehavior(boss?.normalizedName, boss?.behavior, language),
    [boss?.behavior, boss?.normalizedName, language],
  );
  const bossNarrative = useMemo(
    () => localizeBossNarrative(boss?.normalizedName, language),
    [boss?.normalizedName, language],
  );
  const overviewDescription = bossNarrative.bio || boss?.description || t.bossNoDescription;
  const overviewBehavior = bossNarrative.description || localizedBehavior || '-';

  const healthParts = useMemo(() => {
    const grouped = new Map<string, { id: string; bodyPart: string; values: number[] }>();
    for (const part of boss?.health ?? []) {
      const value = getHealthValue(part?.max);
      if (value <= 0) continue;
      const rawBodyPart = String(part?.bodyPart || '').trim() || 'common';
      const key = normalizeIdentity(rawBodyPart);
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          id: String(part?.id || key),
          bodyPart: rawBodyPart,
          values: [value],
        });
        continue;
      }
      if (!existing.values.includes(value)) {
        existing.values.push(value);
      }
    }

    return Array.from(grouped.values())
      .map((part) => ({
        ...part,
        values: [...part.values].sort((a, b) => a - b),
      }))
      .sort((a, b) => a.bodyPart.localeCompare(b.bodyPart));
  }, [boss?.health]);

  const totalHp = useMemo(() => (
    healthParts.reduce((sum, part) => sum + (part.values[part.values.length - 1] ?? 0), 0)
  ), [healthParts]);

  const maps = useMemo(() => boss?.maps ?? [], [boss?.maps]);
  const normalizedMaps = useMemo(() => (
    (maps ?? [])
      .filter((mapEntry): mapEntry is BossMapSpawn => Boolean(mapEntry))
      .map((mapEntry) => ({
        ...mapEntry,
        spawns: (mapEntry.spawns ?? [])
          .filter(Boolean)
          .map((spawn) => ({
            ...spawn,
            spawnLocations: (spawn.spawnLocations ?? []).filter(Boolean),
            escorts: (spawn.escorts ?? []).filter(Boolean),
          }))
          .sort((a, b) => {
            const timeDiff = getSpawnOrder(a.spawnTime) - getSpawnOrder(b.spawnTime);
            if (timeDiff !== 0) return timeDiff;
            return (b.spawnChance ?? 0) - (a.spawnChance ?? 0);
          }),
      }))
  ), [maps]);
  const followers = useMemo(() => {
    const merged = new Map<string, BossEscort>();
    for (const follower of boss?.followers ?? []) {
      if (!follower) continue;
      const followerName = String(follower.name || '').trim();
      const followerNormalizedName = String(follower.normalizedName || '').trim();
      const followerId = String(follower.id || '').trim();
      const key = normalizeIdentity(followerNormalizedName || followerName || followerId);
      if (!key) continue;

      const normalizedMaps = (follower.maps ?? []).filter(Boolean);
      const normalizedAmounts = (follower.amounts ?? []).filter(Boolean);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, {
          ...follower,
          maps: [...normalizedMaps],
          amounts: [...normalizedAmounts],
        });
        continue;
      }

      const mapKeySet = new Set(
        (existing.maps ?? []).map((map) => `${String(map.id || '').trim()}::${normalizeIdentity(map.normalizedName || map.name)}`),
      );
      for (const map of normalizedMaps) {
        const mapKey = `${String(map.id || '').trim()}::${normalizeIdentity(map.normalizedName || map.name)}`;
        if (mapKeySet.has(mapKey)) continue;
        existing.maps = [...(existing.maps ?? []), map];
        mapKeySet.add(mapKey);
      }

      const amountKeySet = new Set(
        (existing.amounts ?? []).map((amount) => `${Number(amount.count || 0)}:${Number(amount.chance || 0)}`),
      );
      for (const amount of normalizedAmounts) {
        const amountKey = `${Number(amount.count || 0)}:${Number(amount.chance || 0)}`;
        if (amountKeySet.has(amountKey)) continue;
        existing.amounts = [...(existing.amounts ?? []), amount];
        amountKeySet.add(amountKey);
      }

      if (!existing.id && followerId) existing.id = followerId;
      if (!existing.normalizedName && followerNormalizedName) existing.normalizedName = followerNormalizedName;
      if (!existing.name && followerName) existing.name = followerName;
      if (!existing.imagePortraitLink && follower.imagePortraitLink) {
        existing.imagePortraitLink = follower.imagePortraitLink;
      }
      if (!existing.imagePosterLink && follower.imagePosterLink) {
        existing.imagePosterLink = follower.imagePosterLink;
      }
    }

    return Array.from(merged.values())
      .map((follower) => ({
        ...follower,
        maps: [...(follower.maps ?? [])]
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
        amounts: [...(follower.amounts ?? [])]
          .sort((a, b) => {
            if (a.count !== b.count) return a.count - b.count;
            return a.chance - b.chance;
          }),
      }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [boss?.followers]);

  const equipmentSets = useMemo(() => {
    if (boss?.equipmentSets?.length) return boss.equipmentSets;
    if (boss?.equipment?.length) {
      return [{ id: 'set-1', items: boss.equipment }];
    }
    return [];
  }, [boss?.equipment, boss?.equipmentSets]);

  useEffect(() => {
    setActiveSetIndex(0);
    setEquipmentPageHeights([]);
    equipmentPagerRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, [boss?.id, equipmentSets.length]);

  const bossIdentitySet = useMemo(() => {
    return new Set(
      [boss?.id, boss?.normalizedName, boss?.name]
        .map((entry) => normalizeIdentity(entry))
        .filter(Boolean),
    );
  }, [boss?.id, boss?.name, boss?.normalizedName]);

  const openItem = useCallback((item: TraderOfferItemRef | null | undefined) => {
    const itemId = String(item?.id || '').trim();
    if (!itemId) return;
    router.push({ pathname: '/(tabs)/search/item/[id]', params: { id: itemId } });
  }, [router]);

  const openFollowerBoss = useCallback((follower: BossEscort) => {
    const targetId = String(follower.id || follower.normalizedName || follower.name || '').trim();
    if (!targetId) return;
    const targetIdentities = [
      targetId,
      String(follower.id || '').trim(),
      String(follower.normalizedName || '').trim(),
      String(follower.name || '').trim(),
    ]
      .map((entry) => normalizeIdentity(entry))
      .filter(Boolean);
    const isSelf = targetIdentities.some((entry) => bossIdentitySet.has(entry));
    if (isSelf) return;

    router.push({
      pathname: '/(tabs)/search/boss/[id]',
      params: {
        id: targetId,
        name: String(follower.name || '').trim(),
        normalizedName: String(follower.normalizedName || '').trim(),
        imagePortraitLink: String(follower.imagePortraitLink || '').trim(),
        imagePosterLink: String(follower.imagePosterLink || '').trim(),
      },
    });
  }, [bossIdentitySet, router]);

  const openAvatarPreview = useCallback(() => {
    const imageUri = String(boss?.imagePosterLink || boss?.imagePortraitLink || '').trim();
    if (!imageUri) return;
    setPreviewUri(imageUri);
    setPreviewVisible(true);
  }, [boss?.imagePortraitLink, boss?.imagePosterLink]);

  const openWiki = useCallback(async () => {
    const url = String(boss?.wikiLink || '').trim();
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      // ignore open-url failure
    }
  }, [boss?.wikiLink]);

  const getLocalizedBodyPart = useCallback((bodyPart: string): string => {
    const normalized = String(bodyPart || '').trim().toLowerCase();
    if (!normalized) return bodyPart;
    const map: Record<string, string> = {
      head: t.bossBodyPartHead,
      chest: t.bossBodyPartChest,
      stomach: t.bossBodyPartStomach,
      leftarm: t.bossBodyPartLeftArm,
      rightarm: t.bossBodyPartRightArm,
      leftleg: t.bossBodyPartLeftLeg,
      rightleg: t.bossBodyPartRightLeg,
      common: t.bossBodyPartCommon,
    };
    return map[normalized] || bodyPart;
  }, [
    t.bossBodyPartChest,
    t.bossBodyPartCommon,
    t.bossBodyPartHead,
    t.bossBodyPartLeftArm,
    t.bossBodyPartLeftLeg,
    t.bossBodyPartRightArm,
    t.bossBodyPartRightLeg,
    t.bossBodyPartStomach,
  ]);

  const getLocalizedSlot = useCallback((slot: string): string => {
    const normalized = String(slot || '').trim().toLowerCase();
    if (!normalized) return '-';
    const map: Record<string, string> = {
      firstprimaryweapon: t.slotPrimary,
      secondprimaryweapon: t.slotSecondary,
      holster: t.slotSidearm,
      armorvest: t.slotArmor,
      tacticalvest: t.slotRig,
      backpack: t.slotBackpack,
      securedcontainer: t.slotSecure,
      scabbard: t.slotScabbard,
      armband: t.slotArmband,
      headwear: t.slotHeadwear,
      earpiece: t.slotEarpiece,
      facecover: t.slotFaceCover,
      eyewear: t.slotEyewear,
    };
    return map[normalized] || slot;
  }, [
    t.slotArmband,
    t.slotArmor,
    t.slotBackpack,
    t.slotEarpiece,
    t.slotEyewear,
    t.slotFaceCover,
    t.slotHeadwear,
    t.slotPrimary,
    t.slotRig,
    t.slotScabbard,
    t.slotSecondary,
    t.slotSecure,
    t.slotSidearm,
  ]);

  const groupedEquipmentSets = useMemo(() => {
    return equipmentSets.map((set) => {
      const groupMap = new Map<string, { key: string; label: string; order: number; items: BossContainedItem[] }>();
      for (const entry of set.items) {
        const rawSlot = getEquipmentSlot(entry);
        const normalizedSlot = String(rawSlot || '').trim().toLowerCase() || 'unknown';
        const existing = groupMap.get(normalizedSlot);
        if (existing) {
          existing.items.push(entry);
          continue;
        }
        groupMap.set(normalizedSlot, {
          key: normalizedSlot,
          label: getLocalizedSlot(rawSlot || '-'),
          order: getEquipmentSlotOrder(normalizedSlot),
          items: [entry],
        });
      }

      const groups = Array.from(groupMap.values()).sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label);
      });
      return {
        id: set.id,
        groups,
      };
    });
  }, [equipmentSets, getLocalizedSlot]);
  const currentSet = groupedEquipmentSets[activeSetIndex] ?? groupedEquipmentSets[0] ?? null;
  const hasMultipleSets = equipmentSets.length > 1;

  const handleEquipmentPagerEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (equipmentPagerWidth <= 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / equipmentPagerWidth);
    if (index < 0 || index >= equipmentSets.length) return;
    setActiveSetIndex(index);
  }, [equipmentPagerWidth, equipmentSets.length]);

  const activeSetHeight = useMemo(() => {
    const current = equipmentPageHeights[activeSetIndex];
    if (Number.isFinite(current) && current > 0) return current;
    return undefined;
  }, [activeSetIndex, equipmentPageHeights]);

  const renderEquipmentGroups = useCallback((
    setId: string,
    groups: Array<{ key: string; label: string; items: BossContainedItem[] }>,
  ) => (
    <View style={styles.equipmentGroupList}>
      {groups.map((group) => (
        <View key={`${setId}-${group.key}`} style={styles.equipmentGroup}>
          <Text style={styles.equipmentGroupTitle}>{group.label}</Text>
          <View style={styles.itemList}>
            {group.items.map((entry, index) => {
              const item = entry.item;
              const itemId = String(item?.id || '').trim();
              const count = formatCount(getContainedCount(entry));
              const categoryLabel = item?.category?.name
                ? localizeCategoryName(item.category.name, language)
                : t.bossUnknownCategory;
              return (
                <TouchableOpacity
                  key={`${setId}-${group.key}-${itemId || 'equipment'}-${index}`}
                  style={styles.itemRow}
                  onPress={() => openItem(item)}
                  activeOpacity={0.75}
                  disabled={!itemId}
                >
                  <View style={styles.itemIconWrap}>
                    {item?.iconLink ? (
                      <Image source={{ uri: item.iconLink }} style={styles.itemIcon} contentFit="contain" />
                    ) : (
                      <View style={styles.itemIconFallback} />
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item?.name || '-'}</Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {t.bossCount}: {count}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>{categoryLabel}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  ), [language, openItem, t.bossCount, t.bossUnknownCategory]);

  if (bossQuery.isLoading && !boss) {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <FullscreenSkeleton message={t.searchBossLoading} />
      </>
    );
  }

  if (bossQuery.isError || !boss) {
    return (
      <View style={styles.centerWrap}>
        <Stack.Screen options={{ title }} />
        <Text style={styles.errorText}>{t.bossLoadFailed}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            activeOpacity={0.8}
            onPress={openAvatarPreview}
            disabled={!boss.imagePortraitLink && !boss.imagePosterLink}
          >
            {boss.imagePortraitLink ? (
              <Image source={{ uri: boss.imagePortraitLink }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback} />
            )}
          </TouchableOpacity>
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle}>{localizedName || boss.name}</Text>
            <Text style={styles.heroMeta}>{t.bossTotalHp}: {totalHp > 0 ? totalHp : '-'}</Text>
            <Text style={styles.heroMeta}>{t.searchBossItems}: {boss.items?.length ?? 0}</Text>
            {boss.wikiLink ? (
              <TouchableOpacity style={[styles.wikiButton, wikiButtonTheme]} activeOpacity={0.75} onPress={openWiki}>
                <ExternalLink size={14} color={Colors.gold} />
                <Text style={styles.wikiButtonText}>{t.taskOpenWiki}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.bossSectionIntro}</Text>
          {isHydratingDetails ? (
            <View style={styles.skeletonList}>
              <ShimmerBlock height={14} />
              <ShimmerBlock height={14} width="94%" />
              <ShimmerBlock height={14} width="80%" />
            </View>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.bossDescription}</Text>
                <Text style={styles.infoValue}>{overviewDescription}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.bossBehavior}</Text>
                <Text style={styles.infoValue}>{overviewBehavior}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.bossSectionHealthParts}</Text>
          {isHydratingDetails ? (
            <View style={styles.skeletonList}>
              <ShimmerBlock height={34} borderRadius={999} width="58%" />
              <ShimmerBlock height={34} borderRadius={999} width="48%" />
            </View>
          ) : healthParts.length === 0 ? (
            <Text style={styles.emptyText}>-</Text>
          ) : (
            <View style={styles.healthWrap}>
              {healthParts.map((part) => (
                <View key={part.id} style={styles.healthChip}>
                  <Text style={styles.healthName}>{getLocalizedBodyPart(part.bodyPart)}</Text>
                  <Text style={styles.healthValue}>
                    {part.values.map((value) => `${value}`).join('/')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.bossSectionSpawns}</Text>
          {isHydratingDetails ? (
            <View style={styles.skeletonList}>
              <ShimmerBlock height={88} borderRadius={10} />
              <ShimmerBlock height={88} borderRadius={10} />
            </View>
          ) : normalizedMaps.length === 0 ? (
            <Text style={styles.emptyText}>{t.bossNoSpawns}</Text>
          ) : (
            <View style={styles.mapList}>
              {normalizedMaps.map((mapEntry: BossMapSpawn) => (
                <View key={mapEntry.id} style={styles.mapCard}>
                  <Text style={styles.mapTitle}>{mapEntry.name}</Text>
                  <View style={styles.spawnGroupList}>
                    {mapEntry.spawns.map((spawn, spawnIndex) => (
                      <View key={`${mapEntry.id}-spawn-${spawnIndex}`} style={styles.spawnGroup}>
                        <Text style={styles.spawnMeta}>
                          {t.bossSpawnChance}: {formatPercent(spawn.spawnChance)}
                        </Text>
                        <Text style={styles.spawnMeta}>
                          {t.bossSpawnTime}: {formatSpawnTime(spawn.spawnTime, t.bossSpawnTimeAny)}
                          {spawn.spawnTimeRandom ? ` (${t.bossSpawnTimeRandom})` : ''}
                        </Text>
                        {spawn.spawnTrigger ? (
                          <Text style={styles.spawnMeta}>
                            {t.bossSpawnTrigger}: {spawn.spawnTrigger}
                          </Text>
                        ) : null}
                        {spawn.switchId ? (
                          <Text style={styles.spawnMeta}>
                            {t.bossSpawnSwitch}: {spawn.switchId}
                          </Text>
                        ) : null}
                        {(spawn.spawnLocations?.length ?? 0) > 0 ? (
                          <View style={styles.spawnLocationWrap}>
                            {(spawn.spawnLocations ?? []).map((location) => (
                              <View key={`${mapEntry.id}-${location.spawnKey}`} style={styles.spawnLocationChip}>
                                <Text style={styles.spawnLocationText} numberOfLines={1}>
                                  {getSpawnLocationLabel(location, mapEntry.name)}
                                </Text>
                                <Text style={styles.spawnLocationChance}>{formatPercent(location.chance)}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.spawnMeta}>{t.bossSpawnLocations}: -</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.bossSectionFollowers}</Text>
          {isHydratingDetails ? (
            <View style={styles.skeletonList}>
              <ShimmerBlock height={56} borderRadius={10} />
              <ShimmerBlock height={56} borderRadius={10} />
            </View>
          ) : followers.length === 0 ? (
            <Text style={styles.emptyText}>{t.bossNoFollowers}</Text>
          ) : (
            <View style={styles.itemList}>
              {followers.map((follower: BossEscort, index) => {
                const followerKey = `${follower.id || follower.normalizedName || follower.name || 'follower'}-${index}`;
                const followerName = localizeBossName(
                  String(follower.name || ''),
                  follower.normalizedName,
                  language,
                );
                const followerMaps = (follower.maps ?? [])
                  .map((map) => String(map.name || '').trim())
                  .filter(Boolean)
                  .join(', ');
                const followerIdentitySet = new Set(
                  [follower.id, follower.normalizedName, follower.name]
                    .map((entry) => normalizeIdentity(entry))
                    .filter(Boolean),
                );
                const canOpenFollower = followerIdentitySet.size > 0
                  && !Array.from(followerIdentitySet).some((identity) => bossIdentitySet.has(identity));
                return (
                  <TouchableOpacity
                    key={followerKey}
                    style={styles.itemRow}
                    onPress={() => openFollowerBoss(follower)}
                    activeOpacity={0.75}
                    disabled={!canOpenFollower}
                  >
                    <View style={styles.itemIconWrap}>
                      {follower.imagePortraitLink ? (
                        <Image source={{ uri: follower.imagePortraitLink }} style={styles.itemIcon} contentFit="cover" />
                      ) : (
                        <View style={styles.itemIconFallback} />
                      )}
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>{followerName || follower.name || '-'}</Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>
                        {t.bossFollowerCount}: {formatFollowerAmounts(follower)}
                      </Text>
                      {followerMaps ? (
                        <Text style={styles.itemMeta} numberOfLines={1}>{followerMaps}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.bossSectionEquipmentSet}</Text>
          {isHydratingDetails ? (
            <View style={styles.skeletonList}>
              <ShimmerBlock height={18} width="56%" />
              <ShimmerBlock height={58} borderRadius={10} />
              <ShimmerBlock height={58} borderRadius={10} />
              <ShimmerBlock height={58} borderRadius={10} />
            </View>
          ) : equipmentSets.length === 0 || !currentSet ? (
            <Text style={styles.emptyText}>-</Text>
          ) : (
            <>
              {hasMultipleSets ? (
                <View style={styles.setHeaderRow}>
                  <Text style={styles.setHeaderText}>
                    {t.bossEquipmentSetLabel} {activeSetIndex + 1}/{equipmentSets.length}
                  </Text>
                  <View style={styles.setDots}>
                    {groupedEquipmentSets.map((set, index) => (
                      <View
                        key={set.id}
                        style={[styles.setDot, index === activeSetIndex && styles.setDotActive]}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View
                style={[styles.equipmentPager, activeSetHeight ? { height: Math.max(60, Math.ceil(activeSetHeight)) } : null]}
                onLayout={(event) => {
                  const width = Math.max(0, Math.floor(event.nativeEvent.layout.width));
                  if (width === equipmentPagerWidth) return;
                  setEquipmentPagerWidth(width);
                }}
              >
                {hasMultipleSets && equipmentPagerWidth > 0 ? (
                  <ScrollView
                    ref={equipmentPagerRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleEquipmentPagerEnd}
                    contentContainerStyle={styles.setPagerContent}
                  >
                    {groupedEquipmentSets.map((set, setIndex) => (
                      <View
                        key={set.id}
                        style={[styles.setPage, { width: equipmentPagerWidth }]}
                      >
                        <View
                          style={styles.setPageContent}
                          onLayout={(event) => {
                            const nextHeight = Math.max(0, Math.ceil(event.nativeEvent.layout.height));
                            setEquipmentPageHeights((previous) => {
                              const next = [...previous];
                              if (next[setIndex] === nextHeight) return previous;
                              next[setIndex] = nextHeight;
                              return next;
                            });
                          }}
                        >
                          {renderEquipmentGroups(set.id, set.groups)}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : (
                  renderEquipmentGroups(currentSet.id, currentSet.groups)
                )}
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.bossSectionItems}</Text>
          {isHydratingDetails ? (
            <View style={styles.skeletonList}>
              <ShimmerBlock height={56} borderRadius={10} />
              <ShimmerBlock height={56} borderRadius={10} />
              <ShimmerBlock height={56} borderRadius={10} />
            </View>
          ) : (boss.items ?? []).length === 0 ? (
            <Text style={styles.emptyText}>-</Text>
          ) : (
            <View style={styles.itemList}>
              {(boss.items ?? []).filter(Boolean).map((entry: BossLootItem, index) => {
                const itemId = String(entry.id || '').trim();
                const categoryLabel = entry.category?.name
                  ? localizeCategoryName(entry.category.name, language)
                  : t.bossUnknownCategory;
                const displayCount = Number(entry.count ?? 1);
                const iconUri = String(entry.iconLink || '').trim() || getItemImageURL(itemId);
                return (
                  <TouchableOpacity
                    key={`${itemId || 'item'}-${index}`}
                    style={styles.itemRow}
                    onPress={() => openItem(entry)}
                    activeOpacity={0.75}
                    disabled={!itemId}
                  >
                    <View style={styles.itemIconWrap}>
                      {iconUri ? (
                        <Image source={{ uri: iconUri }} style={styles.itemIcon} contentFit="contain" />
                      ) : (
                        <View style={styles.itemIconFallback} />
                      )}
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>{entry.name || '-'}</Text>
                      <Text style={styles.itemMeta} numberOfLines={1}>{categoryLabel}</Text>
                      {displayCount > 1 ? (
                        <Text style={styles.itemMeta} numberOfLines={1}>
                          {t.bossCount}: {displayCount}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

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
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    color: Colors.statRed,
    fontSize: 14,
    textAlign: 'center',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 76,
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  heroMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
  },
  skeletonList: {
    gap: 8,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  infoRow: {
    gap: 4,
  },
  infoLabel: {
    color: Colors.textTertiary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.25,
    fontWeight: '600' as const,
  },
  infoValue: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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
  healthWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  healthChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  healthName: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  healthValue: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums'],
  },
  mapList: {
    gap: 8,
  },
  mapCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: alphaWhite(0.02),
    padding: 10,
    gap: 8,
  },
  mapTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700' as const,
  },
  spawnGroupList: {
    gap: 8,
  },
  spawnGroup: {
    borderWidth: 1,
    borderColor: alphaWhite(0.08),
    borderRadius: 10,
    backgroundColor: alphaWhite(0.02),
    padding: 8,
    gap: 4,
  },
  spawnMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  spawnLocationWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  spawnLocationChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.03),
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  spawnLocationText: {
    color: Colors.textSecondary,
    fontSize: 11,
    maxWidth: 140,
  },
  spawnLocationChance: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  setHeaderText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  setDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  setDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: alphaWhite(0.25),
  },
  setDotActive: {
    backgroundColor: Colors.gold,
  },
  equipmentPager: {
    minHeight: 60,
    overflow: 'hidden',
  },
  setPagerContent: {
    alignItems: 'flex-start',
  },
  setPage: {
    paddingRight: 8,
    alignSelf: 'flex-start',
  },
  setPageContent: {
    width: '100%',
  },
  equipmentGroupList: {
    gap: 12,
  },
  equipmentGroup: {
    gap: 8,
  },
  equipmentGroupTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  itemList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: alphaWhite(0.02),
    padding: 10,
  },
  itemIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  itemIcon: {
    width: '100%',
    height: '100%',
  },
  itemIconFallback: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
  },
  itemInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  itemName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  itemMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
});
