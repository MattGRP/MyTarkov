import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useSegments } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ExternalLink, Star } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { fetchTaskById } from '@/services/tarkovApi';
import type {
  TaskDetail,
  TaskObjectiveItemRef,
  TaskObjectiveLite,
  TaskRewardItem,
  TaskRewardsLite,
  TaskStatusRequirement,
  TaskTraderRequirement,
} from '@/types/tarkov';

function sectionHasRewards(rewards?: TaskRewardsLite | null): boolean {
  if (!rewards) return false;
  return (
    (rewards.items?.length ?? 0) > 0 ||
    (rewards.traderStanding?.length ?? 0) > 0 ||
    (rewards.skillLevelReward?.length ?? 0) > 0
  );
}

function normalizeFactionLabel(factionName: string | null | undefined, anyLabel: string): string {
  const normalized = (factionName ?? '').trim();
  if (!normalized || normalized.toLowerCase() === 'any') return anyLabel;
  return normalized;
}

function normalizeRequirementType(type: string | null | undefined, reputationLabel: string): string {
  const normalized = (type ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'requtation' || normalized === 'reputation') return reputationLabel;
  return type?.trim() || '';
}

function normalizeCompareMethod(compareMethod: string | null | undefined, lessOrEqualLabel: string): string {
  const normalized = (compareMethod ?? '').trim();
  if (!normalized) return '';
  if (normalized === '<=') return lessOrEqualLabel;
  return normalized;
}

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
  ref: { zh: 'Ref', ru: 'Ref' },
};

function localizeTraderName(name: string, normalizedName: string | null | undefined, language: 'en' | 'zh' | 'ru'): string {
  if (!name || language === 'en') return name;
  const normalized = (normalizedName || name).trim().toLowerCase();
  const mapped = TRADER_NAME_TRANSLATIONS[normalized];
  return mapped?.[language] || name;
}

const WEAPON_PART_HINTS = [
  'receiver',
  'upper receiver',
  'lower receiver',
  'barrel',
  'stock',
  'handguard',
  'grip',
  'pistol grip',
  'magazine',
  'muzzle',
  'suppressor',
  'silencer',
  'flash hider',
  'bolt',
  'charging handle',
  'gas block',
  'mount',
  'rail',
  'sight',
  'scope',
  'buffer tube',
  'dust cover',
  'foregrip',
  '枪机',
  '机匣',
  '上机匣',
  '下机匣',
  '枪管',
  '枪托',
  '拉机柄',
  '护木',
  '握把',
  '弹匣',
  '消音',
  '制退',
  '导轨',
  '瞄具',
  'прицел',
  'ствол',
  'цевь',
  'рукоят',
  'приклад',
  'магазин',
  'глуш',
  'затвор',
  'дтк',
  'ресивер',
];

function isLikelyWeaponPart(item: TaskObjectiveItemRef): boolean {
  const text = `${item.name || ''} ${item.shortName || ''}`.toLowerCase();
  return WEAPON_PART_HINTS.some((hint) => text.includes(hint));
}

function collectObjectiveItems(objective: TaskObjectiveLite): TaskObjectiveItemRef[] {
  const map = new Map<string, TaskObjectiveItemRef>();
  const pushItem = (item?: TaskObjectiveItemRef | null) => {
    if (!item?.id) return;
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  };
  const pushItems = (items?: TaskObjectiveItemRef[] | null) => {
    (items ?? []).forEach(pushItem);
  };

  if (objective.__typename === 'TaskObjectiveShoot') {
    // Prefer full weapons for shooter objectives; skip weapon mods/parts when complete options exist.
    const shootWeapons = objective.usingWeapon ?? [];
    const fullWeapons = shootWeapons.filter((item) => !isLikelyWeaponPart(item));
    if (fullWeapons.length > 0) {
      pushItems(fullWeapons);
    } else if (shootWeapons.length > 0) {
      pushItems(shootWeapons);
    } else {
      pushItem(objective.item);
      pushItem(objective.markerItem);
      pushItems(objective.items);
      pushItems(objective.containsAll);
      pushItems(objective.useAny);
      pushItems(objective.wearing);
      pushItems(objective.notWearing);
    }
  } else {
    pushItem(objective.item);
    pushItem(objective.markerItem);
    pushItems(objective.items);
    pushItems(objective.containsAll);
    pushItems(objective.useAny);
    pushItems(objective.usingWeapon);
    pushItems(objective.usingWeaponMods);
    pushItems(objective.wearing);
    pushItems(objective.notWearing);
  }
  pushItems(objective.requiredKeys);

  return Array.from(map.values());
}

function formatStanding(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  const fixed = Math.abs(value) >= 1 ? value.toFixed(2) : value.toFixed(3);
  return `${value > 0 ? '+' : ''}${fixed}`;
}

function EntityRewardRow({
  id,
  name,
  imageLink,
  onPress,
  secondaryText,
  secondaryColor,
}: {
  id?: string;
  name: string;
  imageLink?: string;
  onPress: (entityId: string) => void;
  secondaryText?: string;
  secondaryColor?: string;
}) {
  return (
    <TouchableOpacity
      style={styles.rewardItemRow}
      activeOpacity={0.75}
      onPress={() => id && onPress(id)}
      disabled={!id}
    >
      <View style={styles.rewardIconWrap}>
        {imageLink ? (
          <Image source={{ uri: imageLink }} style={styles.rewardIcon} contentFit="cover" />
        ) : (
          <View style={styles.rewardIconPlaceholder} />
        )}
      </View>
      <View style={styles.rewardMain}>
        <Text style={styles.rewardName} numberOfLines={2}>{name}</Text>
        {secondaryText ? (
          <Text style={[styles.rewardCount, secondaryColor ? { color: secondaryColor } : null]}>{secondaryText}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function EntityInlineValue({
  id,
  name,
  subtitle,
  imageLink,
  onPress,
}: {
  id?: string;
  name: string;
  subtitle?: string;
  imageLink?: string;
  onPress: (entityId: string) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.entityInlineValue}
      activeOpacity={0.75}
      onPress={() => id && onPress(id)}
      disabled={!id}
    >
      <View style={styles.entityInlineIconWrap}>
        {imageLink ? (
          <Image source={{ uri: imageLink }} style={styles.entityInlineIcon} contentFit="cover" />
        ) : (
          <View style={styles.entityInlineIconPlaceholder} />
        )}
      </View>
      <View style={styles.entityInlineMain}>
        <Text style={styles.entityInlineName} numberOfLines={1}>{name}</Text>
        {subtitle ? <Text style={styles.entityInlineSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function InfoRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={styles.infoRowWrap}>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {!isLast && <View style={styles.rowDivider} />}
    </View>
  );
}

function ObjectiveRow({
  objective,
  onOpenItem,
  isLast,
  showMoreLabel,
  showLessLabel,
}: {
  objective: TaskObjectiveLite;
  onOpenItem: (itemId: string) => void;
  isLast: boolean;
  showMoreLabel: string;
  showLessLabel: string;
}) {
  const objectiveItems = collectObjectiveItems(objective);
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = objectiveItems.length > 3;
  const visibleItems = hasOverflow && !expanded ? objectiveItems.slice(0, 3) : objectiveItems;
  return (
    <View style={styles.infoRowWrap}>
      <View style={styles.objectiveRow}>
        <Text style={styles.objectiveText}>{objective.description}</Text>
        {objective.optional ? <Text style={styles.objectiveMeta}>({objective.type})</Text> : null}
        {objectiveItems.length > 0 ? (
          <View style={styles.objectiveItemsWrap}>
            {visibleItems.map((item) => (
              <EntityRewardRow
                key={`${objective.id}-${item.id}`}
                id={item.id}
                name={item.name}
                imageLink={item.iconLink}
                onPress={onOpenItem}
                secondaryText={objective.count && objective.count > 0 ? `x${objective.count}` : undefined}
                secondaryColor={objective.count && objective.count > 0 ? Colors.gold : undefined}
              />
            ))}
            {hasOverflow ? (
              <TouchableOpacity
                style={styles.objectiveExpandButton}
                activeOpacity={0.75}
                onPress={() => setExpanded((prev) => !prev)}
              >
                <Text style={styles.objectiveExpandText}>
                  {expanded ? showLessLabel : `${showMoreLabel} +${objectiveItems.length - 3}`}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
      {!isLast && <View style={styles.rowDivider} />}
    </View>
  );
}

function RequirementTaskRow({
  item,
  onOpenTask,
  statusLabel,
  isLast,
}: {
  item: TaskStatusRequirement;
  onOpenTask: (taskId: string) => void;
  statusLabel: string;
  isLast: boolean;
}) {
  const status = item.status?.join(', ') || '-';
  return (
    <View style={styles.infoRowWrap}>
      <TouchableOpacity style={styles.requirementTaskRow} onPress={() => onOpenTask(item.task.id)} activeOpacity={0.75}>
        <Text style={styles.requirementTaskName}>{item.task.name}</Text>
        <Text style={styles.requirementTaskStatus}>{statusLabel}: {status}</Text>
      </TouchableOpacity>
      {!isLast && <View style={styles.rowDivider} />}
    </View>
  );
}

function TraderRequirementRow({
  item,
  reputationLabel,
  lessOrEqualLabel,
  onOpenTrader,
  language,
  isLast,
}: {
  item: TaskTraderRequirement;
  reputationLabel: string;
  lessOrEqualLabel: string;
  onOpenTrader: (traderId: string) => void;
  language: 'en' | 'zh' | 'ru';
  isLast: boolean;
}) {
  const requirementType = normalizeRequirementType(item.requirementType, reputationLabel);
  const compareMethod = normalizeCompareMethod(item.compareMethod, lessOrEqualLabel);
  const value = item.value ?? '-';
  const requirementValue = [requirementType, compareMethod, String(value)].filter(Boolean).join(' ');
  const traderName = localizeTraderName(item.trader.name, item.trader.normalizedName, language);
  return (
    <View style={styles.infoRowWrap}>
      <EntityRewardRow
        id={item.trader.id || item.trader.normalizedName || item.trader.name}
        name={traderName}
        imageLink={item.trader.imageLink}
        onPress={onOpenTrader}
        secondaryText={requirementValue}
      />
      {!isLast && <View style={styles.rowDivider} />}
    </View>
  );
}

function RewardItemRow({
  item,
  onOpenItem,
  isLast,
}: {
  item: TaskRewardItem;
  onOpenItem: (itemId: string) => void;
  isLast: boolean;
}) {
  const itemId = item.item?.id;
  const count = item.count ?? 0;
  return (
    <View style={styles.infoRowWrap}>
      <TouchableOpacity
        style={styles.rewardItemRow}
        onPress={() => itemId && onOpenItem(itemId)}
        activeOpacity={itemId ? 0.75 : 1}
        disabled={!itemId}
      >
        <View style={styles.rewardIconWrap}>
          {item.item?.iconLink ? (
            <Image source={{ uri: item.item.iconLink }} style={styles.rewardIcon} contentFit="contain" />
          ) : (
            <View style={styles.rewardIconPlaceholder} />
          )}
        </View>
        <View style={styles.rewardMain}>
          <Text style={styles.rewardName} numberOfLines={2}>{item.item?.name || '-'}</Text>
          <Text style={styles.rewardCount}>x{count}</Text>
        </View>
      </TouchableOpacity>
      {!isLast && <View style={styles.rowDivider} />}
    </View>
  );
}

function RewardXpRow({
  value,
  label,
  isLast,
}: {
  value: number;
  label: string;
  isLast: boolean;
}) {
  return (
    <View style={styles.infoRowWrap}>
      <View style={styles.rewardItemRow}>
        <View style={styles.rewardIconWrap}>
          <Star size={16} color={Colors.gold} />
        </View>
        <View style={styles.rewardMain}>
          <Text style={styles.rewardName} numberOfLines={1}>{label}</Text>
          <Text style={styles.rewardCount}>+{value} XP</Text>
        </View>
      </View>
      {!isLast && <View style={styles.rowDivider} />}
    </View>
  );
}

function RewardTraderStandingRow({
  traderId,
  traderName,
  imageLink,
  standing,
  onOpenTrader,
  isLast,
}: {
  traderId?: string;
  traderName: string;
  imageLink?: string;
  standing?: number | null;
  onOpenTrader: (traderId: string) => void;
  isLast: boolean;
}) {
  const value = standing ?? 0;
  const valueColor = value > 0 ? Colors.statGreen : value < 0 ? Colors.statRed : Colors.text;
  return (
    <View style={styles.infoRowWrap}>
      <TouchableOpacity
        style={styles.rewardItemRow}
        onPress={() => traderId && onOpenTrader(traderId)}
        activeOpacity={traderId ? 0.75 : 1}
        disabled={!traderId}
      >
        <View style={styles.rewardIconWrap}>
          {imageLink ? (
            <Image source={{ uri: imageLink }} style={styles.rewardIcon} contentFit="cover" />
          ) : (
            <View style={styles.rewardIconPlaceholder} />
          )}
        </View>
        <View style={styles.rewardMain}>
          <Text style={styles.rewardName} numberOfLines={1}>{traderName}</Text>
          <Text style={[styles.rewardCount, { color: valueColor, fontWeight: '700' }]}>{formatStanding(value)}</Text>
        </View>
      </TouchableOpacity>
      {!isLast && <View style={styles.rowDivider} />}
    </View>
  );
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  const { t, language } = useLanguage();
  const router = useRouter();
  const segments = useSegments();
  const isSearchContext = useMemo(() => {
    const segmentNames = segments as unknown as string[];
    return segmentNames.includes('search');
  }, [segments]);

  const taskQuery = useQuery({
    queryKey: ['task-detail', taskId, language],
    queryFn: () => fetchTaskById(taskId!, language),
    enabled: !!taskId,
    staleTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnReconnect: 'always',
  });

  const task = taskQuery.data;
  const title = task?.name || t.taskDetailsTitle;

  const openWiki = useCallback(async (taskData: TaskDetail) => {
    if (!taskData.wikiLink) return;
    try {
      await Linking.openURL(taskData.wikiLink);
    } catch {
      // ignore open failures
    }
  }, []);

  const openTask = useCallback((nextTaskId: string) => {
    if (!nextTaskId) return;
    router.push({
      pathname: isSearchContext ? '/(tabs)/search/task/[id]' : '/(tabs)/tasks/[id]',
      params: { id: nextTaskId },
    });
  }, [isSearchContext, router]);

  const openItem = useCallback((itemId: string) => {
    if (!itemId) return;
    router.push({
      pathname: isSearchContext ? '/(tabs)/search/item/[id]' : '/(tabs)/tasks/item/[id]',
      params: { id: itemId },
    });
  }, [isSearchContext, router]);

  const openTrader = useCallback((traderId: string) => {
    if (!traderId) return;
    router.push({
      pathname: isSearchContext ? '/(tabs)/search/trader/[id]' : '/(tabs)/tasks/trader/[id]',
      params: { id: traderId },
    });
  }, [isSearchContext, router]);

  const infoRows = useMemo(() => {
    if (!task) return [];
    return [
      { label: t.taskInfoMap, value: task.map?.name || t.taskAnyMap },
      { label: t.taskInfoLevel, value: String(task.minPlayerLevel ?? 0) },
      { label: t.taskInfoFaction, value: normalizeFactionLabel(task.factionName, t.taskAnyFaction) },
      { label: t.taskInfoKappa, value: task.kappaRequired ? t.yes : t.no },
      { label: t.taskInfoLightkeeper, value: task.lightkeeperRequired ? t.yes : t.no },
      { label: t.taskInfoRestartable, value: task.restartable ? t.yes : t.no },
    ];
  }, [
    task,
    t.no,
    t.taskAnyFaction,
    t.taskAnyMap,
    t.taskInfoFaction,
    t.taskInfoKappa,
    t.taskInfoLevel,
    t.taskInfoLightkeeper,
    t.taskInfoMap,
    t.taskInfoRestartable,
    t.yes,
  ]);

  if (taskQuery.isLoading && !task) {
    return (
      <View style={styles.centerWrap}>
        <Stack.Screen options={{ title: t.taskDetailsTitle }} />
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.centerText}>{t.tasksLoading}</Text>
      </View>
    );
  }

  if (taskQuery.isError || !task) {
    const rawError = taskQuery.isError ? (taskQuery.error as Error)?.message || '' : '';
    const timeoutMessage = language === 'zh'
      ? '请求超时，请重试。'
      : language === 'ru'
        ? 'Время запроса истекло. Повторите попытку.'
        : 'Request timed out. Please retry.';
    const errorMessage = /abort|timeout/i.test(rawError)
      ? timeoutMessage
      : rawError || t.tasksNoResults;
    return (
      <View style={styles.centerWrap}>
        <Stack.Screen options={{ title: t.taskDetailsTitle }} />
        <Text style={styles.centerText}>{errorMessage}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          activeOpacity={0.8}
          onPress={() => {
            void taskQuery.refetch();
          }}
        >
          <Text style={styles.retryButtonText}>{t.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rewards = [
    { title: t.taskRewardStart, data: task.startRewards, includeExperience: false },
    { title: t.taskRewardFinish, data: task.finishRewards, includeExperience: true },
    { title: t.taskRewardFailure, data: task.failureOutcome, includeExperience: false },
  ].filter((section) => sectionHasRewards(section.data) || (section.includeExperience && (task.experience ?? 0) > 0));
  const traderName = localizeTraderName(task.trader.name, task.trader.normalizedName, language);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroImageWrap}>
            {task.taskImageLink ? (
              <Image source={{ uri: task.taskImageLink }} style={styles.heroImage} contentFit="cover" />
            ) : (
              <View style={styles.heroPlaceholder} />
            )}
          </View>
          <View style={styles.heroMain}>
            <Text style={styles.heroTitle}>{task.name}</Text>
            <Text style={styles.heroSub}>{task.map?.name || t.taskAnyMap}</Text>
            {!!task.wikiLink && (
              <TouchableOpacity style={styles.wikiButton} onPress={() => openWiki(task)} activeOpacity={0.75}>
                <ExternalLink size={14} color={Colors.gold} />
                <Text style={styles.wikiButtonText}>{t.taskOpenWiki}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.taskSectionObjectives}</Text>
          <View style={[styles.sectionCard, styles.objectiveSectionCard]}>
            {(task.objectives?.length ?? 0) === 0 ? (
              <InfoRow label={t.taskNoObjectives} value="" isLast />
            ) : (
              (task.objectives ?? []).map((objective, idx) => (
                <ObjectiveRow
                  key={objective.id}
                  objective={objective}
                  onOpenItem={openItem}
                  showMoreLabel={t.taskObjectiveShowMore}
                  showLessLabel={t.taskObjectiveShowLess}
                  isLast={idx === (task.objectives?.length ?? 1) - 1}
                />
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.taskSectionInfo}</Text>
          <View style={styles.sectionCard}>
            <View style={styles.infoRowWrap}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.taskInfoTrader}</Text>
                <EntityInlineValue
                  id={task.trader.id || task.trader.normalizedName || task.trader.name}
                  name={traderName}
                  imageLink={task.trader.imageLink}
                  onPress={openTrader}
                />
              </View>
              {infoRows.length > 0 ? <View style={styles.rowDivider} /> : null}
            </View>
            {infoRows.map((row, idx) => (
              <InfoRow key={row.label} label={row.label} value={row.value} isLast={idx === infoRows.length - 1} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.taskSectionFailConditions}</Text>
          <View style={styles.sectionCard}>
            {(task.failConditions?.length ?? 0) === 0 ? (
              <InfoRow label={t.taskNoFailConditions} value="" isLast />
            ) : (
              (task.failConditions ?? []).map((objective, idx) => (
                <ObjectiveRow
                  key={objective.id}
                  objective={objective}
                  onOpenItem={openItem}
                  showMoreLabel={t.taskObjectiveShowMore}
                  showLessLabel={t.taskObjectiveShowLess}
                  isLast={idx === (task.failConditions?.length ?? 1) - 1}
                />
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.taskSectionRequirements}</Text>
          {(task.taskRequirements?.length ?? 0) === 0 && (task.traderRequirements?.length ?? 0) === 0 ? (
            <View style={styles.sectionCard}>
              <InfoRow label={t.taskNoRequirements} value="" isLast />
            </View>
          ) : (
            <>
              {(task.taskRequirements?.length ?? 0) > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.subHeader}>
                    <Text style={styles.subHeaderText}>{t.taskRequiredTasks}</Text>
                  </View>
                  {(task.taskRequirements ?? []).map((item, idx) => (
                    <RequirementTaskRow
                      key={`${item.task.id}-${idx}`}
                      item={item}
                      onOpenTask={openTask}
                      statusLabel={t.taskRequiredStatus}
                      isLast={idx === (task.taskRequirements?.length ?? 1) - 1}
                    />
                  ))}
                </View>
              )}
              {(task.traderRequirements?.length ?? 0) > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.subHeader}>
                    <Text style={styles.subHeaderText}>{t.taskTraderRequirements}</Text>
                  </View>
                  {(task.traderRequirements ?? []).map((item, idx) => (
                    <TraderRequirementRow
                      key={`${item.trader.id || item.trader.name}-${idx}`}
                      item={item}
                      reputationLabel={t.taskTraderRequirementReputation}
                      lessOrEqualLabel={t.taskCompareLessOrEqual}
                      onOpenTrader={openTrader}
                      language={language}
                      isLast={idx === (task.traderRequirements?.length ?? 1) - 1}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.taskSectionRewards}</Text>
          {rewards.length === 0 ? (
            <View style={styles.sectionCard}>
              <InfoRow label={t.taskNoRewards} value="" isLast />
            </View>
          ) : (
            rewards.map((rewardSection) => (
              <View key={rewardSection.title} style={styles.sectionCard}>
                <View style={styles.subHeader}>
                  <Text style={styles.subHeaderText}>{rewardSection.title}</Text>
                </View>
                {(rewardSection.data?.items?.length ?? 0) > 0 ? (
                  <>
                    <View style={styles.subHeaderMinor}>
                      <Text style={styles.subHeaderMinorText}>{t.taskRewardItems}</Text>
                    </View>
                    {(rewardSection.data?.items ?? []).map((item, idx) => (
                      <RewardItemRow
                        key={`${rewardSection.title}-item-${item.item?.id || idx}`}
                        item={item}
                        onOpenItem={openItem}
                        isLast={
                          idx === (rewardSection.data?.items?.length ?? 1) - 1 &&
                          !(
                            (rewardSection.includeExperience && (task.experience ?? 0) > 0) ||
                            (rewardSection.data?.traderStanding?.length ?? 0) > 0 ||
                            (rewardSection.data?.skillLevelReward?.length ?? 0) > 0
                          )
                        }
                      />
                    ))}
                  </>
                ) : null}
                {rewardSection.includeExperience && (task.experience ?? 0) > 0 ? (
                  <>
                    <View style={styles.subHeaderMinor}>
                      <Text style={styles.subHeaderMinorText}>{t.taskRewardExperience}</Text>
                    </View>
                    <RewardXpRow
                      value={task.experience ?? 0}
                      label={t.taskRewardExperience}
                      isLast={(rewardSection.data?.traderStanding?.length ?? 0) === 0 && (rewardSection.data?.skillLevelReward?.length ?? 0) === 0}
                    />
                  </>
                ) : null}
                {(rewardSection.data?.traderStanding?.length ?? 0) > 0 ? (
                  <>
                    <View style={styles.subHeaderMinor}>
                      <Text style={styles.subHeaderMinorText}>{t.taskRewardStanding}</Text>
                    </View>
                    {(rewardSection.data?.traderStanding ?? []).map((item, idx) => (
                      <RewardTraderStandingRow
                        key={`${rewardSection.title}-standing-${item.trader?.id || idx}`}
                        traderId={item.trader?.id || item.trader?.normalizedName || item.trader?.name}
                        traderName={localizeTraderName(item.trader?.name || '-', item.trader?.normalizedName, language)}
                        imageLink={item.trader?.imageLink}
                        standing={item.standing}
                        onOpenTrader={openTrader}
                        isLast={
                          idx === (rewardSection.data?.traderStanding?.length ?? 1) - 1 &&
                          (rewardSection.data?.skillLevelReward?.length ?? 0) === 0
                        }
                      />
                    ))}
                  </>
                ) : null}
                {(rewardSection.data?.skillLevelReward?.length ?? 0) > 0 ? (
                  <>
                    <View style={styles.subHeaderMinor}>
                      <Text style={styles.subHeaderMinorText}>{t.taskRewardSkills}</Text>
                    </View>
                    {(rewardSection.data?.skillLevelReward ?? []).map((item, idx) => (
                      <InfoRow
                        key={`${rewardSection.title}-skill-${item.name || idx}`}
                        label={item.name || '-'}
                        value={`${item.level ?? 0}`}
                        isLast={idx === (rewardSection.data?.skillLevelReward?.length ?? 1) - 1}
                      />
                    ))}
                  </>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
    padding: 24,
  },
  centerText: {
    marginTop: 8,
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  retryButtonText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 12,
  },
  heroImageWrap: {
    width: 70,
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
  },
  heroMain: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  heroSub: {
    color: Colors.textSecondary,
    fontSize: 12,
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
    backgroundColor: 'rgba(217,191,115,0.16)',
  },
  wikiButtonText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  objectiveSectionCard: {
    borderColor: Colors.goldDim,
  },
  subHeader: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  subHeaderText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  subHeaderMinor: {
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 6,
  },
  subHeaderMinorText: {
    color: Colors.textTertiary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  infoRowWrap: {
    paddingHorizontal: 14,
  },
  infoRow: {
    minHeight: 38,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  infoLabelWrap: {
    flex: 1,
  },
  infoValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'right',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },
  objectiveRow: {
    paddingVertical: 10,
    gap: 8,
  },
  objectiveText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  objectiveMeta: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  objectiveItemsWrap: {
    flexDirection: 'column',
    gap: 8,
  },
  objectiveExpandButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  objectiveExpandText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  requirementTaskRow: {
    paddingVertical: 10,
    gap: 4,
  },
  requirementTaskName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  requirementTaskStatus: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  rewardItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rewardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rewardIcon: {
    width: '100%',
    height: '100%',
  },
  rewardIconPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: Colors.surfaceLight,
  },
  rewardMain: {
    flex: 1,
    gap: 2,
  },
  rewardName: {
    color: Colors.text,
    fontSize: 13,
  },
  rewardCount: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  entityInlineValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '62%',
    marginLeft: 'auto',
  },
  entityInlineIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityInlineIcon: {
    width: '100%',
    height: '100%',
  },
  entityInlineIconPlaceholder: {
    width: 10,
    height: 10,
    borderRadius: 4,
    backgroundColor: Colors.surfaceLight,
  },
  entityInlineMain: {
    minWidth: 0,
    alignItems: 'flex-end',
  },
  entityInlineName: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600' as const,
    flexShrink: 1,
    textAlign: 'right',
  },
  entityInlineSub: {
    color: Colors.textTertiary,
    fontSize: 11,
    textAlign: 'right',
  },
});
