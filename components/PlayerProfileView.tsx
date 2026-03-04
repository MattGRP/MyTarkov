import React, {useMemo, useState, useCallback, useEffect, useRef} from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    Animated,
    NativeSyntheticEvent,
    NativeScrollEvent,
    Easing,
    Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Image} from 'expo-image';
import {LinearGradient} from 'expo-linear-gradient';
import {Crosshair, Heart, Flame, Map, BarChart3, PersonStanding, ChevronDown, ChevronRight, Package, Star, Trophy, Home, GripVertical} from 'lucide-react-native';
import {SvgXml} from 'react-native-svg';
import {useQuery} from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DraggableFlatList, {RenderItemParams} from 'react-native-draggable-flatlist';
import Colors, {
    alphaBlack,
    alphaWhite,
    eodCrownBase,
    eodCrownDark,
    eodCrownLight,
    tarkovGold,
    unheardBlue,
    withAlpha,
} from '@/constants/colors';
import {useLanguage} from '@/providers/LanguageProvider';
import StatCard from '@/components/StatCard';
import StatsRow from '@/components/StatsRow';
import LoadoutSection from '@/components/LoadoutSection';
import SkillsSection from '@/components/SkillsSection';
import BearLogo from '../assets/images/bearlogo.svg';
import UsecLogo from '../assets/images/usuclogo.svg';
import {
    PlayerProfile,
    EquipmentItem,
    CounterItem,
    MAIN_SLOTS,
    calculatePlayerStats,
    getLevel,
    getLevelFromPlayerLevels,
    getCharacterImageURL,
} from '@/types/tarkov';
import {fetchAchievements, fetchHideoutStations, fetchItemNamesByTpls, fetchPlayerLevels} from '@/services/tarkovApi';
import {formatNumber, formatPlaytime} from '@/utils/helpers';

type SectionKey = 'overview' | 'pmc' | 'scav' | 'loadout' | 'skills' | 'achievements' | 'favorites' | 'hideout';
type ReorderItem = { key: SectionKey; title: string };

const PROFILE_SECTION_ORDER_KEY = 'tarkov_profile_section_order';
const DEFAULT_SECTION_ORDER: SectionKey[] = ['overview', 'pmc', 'scav', 'loadout', 'skills', 'achievements', 'favorites', 'hideout'];
const REORDER_ROW_HEIGHT = 54;
const DEFAULT_PROFILE_IMAGE_URL = 'https://assets.tarkov.dev/profile-loading.webp';

interface PlayerProfileViewProps {
    profile: PlayerProfile;
    headerRight?: React.ReactNode;
    enableCollapsibleHeader?: boolean;
    itemDetailPathname?: '/(tabs)/search/item/[id]' | '/(tabs)/(home)/item/[id]';
}

function resolveSlotRoot(
    item: EquipmentItem,
    itemsById: Record<string, EquipmentItem>,
    equipmentRootId?: string,
): EquipmentItem {
    if (!equipmentRootId) return item;
    let current = item;
    const visited = new Set<string>([current._id]);
    while (current.parentId && current.parentId !== equipmentRootId) {
        if (visited.has(current.parentId)) break;
        const parent = itemsById[current.parentId];
        if (!parent) break;
        visited.add(parent._id);
        current = parent;
    }
    return current;
}

function CollapsibleSection({
    title,
    icon,
    children,
    defaultExpanded = true,
    onLongPress,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultExpanded?: boolean;
    onLongPress?: () => void;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <View style={styles.section}>
            <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => setExpanded((prev) => !prev)}
                onLongPress={onLongPress}
                delayLongPress={250}
                activeOpacity={0.7}
            >
                <View style={styles.sectionHeaderLeft}>
                    {icon}
                    <Text style={styles.sectionTitle}>{title}</Text>
                </View>
                {expanded ? (
                    <ChevronDown size={18} color={Colors.textSecondary}/>
                ) : (
                    <ChevronRight size={18} color={Colors.textSecondary}/>
                )}
            </TouchableOpacity>
            {expanded && (
                <View style={styles.sectionBody}>
                    {children}
                </View>
            )}
        </View>
    );
}

function normalizeProfileTimestamp(raw?: number): Date | null {
    if (!raw || !Number.isFinite(raw)) return null;
    const millis = raw > 1e12 ? raw : raw * 1000;
    if (!Number.isFinite(millis) || millis <= 0) return null;
    return new Date(millis);
}

function getAchievementRarityLabel(
    rarity: string | undefined,
    t: ReturnType<typeof useLanguage>['t'],
): string {
    const normalized = String(rarity || '').trim().toLowerCase();
    if (normalized === 'common') return t.achievementRarityCommon;
    if (normalized === 'rare') return t.achievementRarityRare;
    if (normalized === 'legendary') return t.achievementRarityLegendary;
    return t.achievementRarityUnknown;
}

function getCounterValue(counters: CounterItem[], path: string[]): number {
    for (const counter of counters) {
        const key = Array.isArray(counter.Key) ? counter.Key : [];
        if (key.length !== path.length) continue;
        let match = true;
        for (let i = 0; i < path.length; i += 1) {
            if (String(key[i]) !== path[i]) {
                match = false;
                break;
            }
        }
        if (match) {
            return Number(counter.Value) || 0;
        }
    }
    return 0;
}

export default function PlayerProfileView({
    profile,
    headerRight,
    enableCollapsibleHeader = false,
    itemDetailPathname = '/(tabs)/search/item/[id]',
}: PlayerProfileViewProps) {
    const {t, language} = useLanguage();
    const insets = useSafeAreaInsets();
    const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(DEFAULT_SECTION_ORDER);
    const [reorderVisible, setReorderVisible] = useState(false);
    const levelsQuery = useQuery({
        queryKey: ['player-levels'],
        queryFn: fetchPlayerLevels,
        staleTime: 6 * 60 * 60 * 1000,
    });
    const playerLevels = useMemo(() => levelsQuery.data ?? [], [levelsQuery.data]);
    const pmcStats = useMemo(() => calculatePlayerStats(profile.pmcStats), [profile.pmcStats]);
    const scavStats = useMemo(() => calculatePlayerStats(profile.scavStats), [profile.scavStats]);
    const level = useMemo(() => {
        const experience = profile.info.experience ?? 0;
        if (!experience) return 1;
        return playerLevels.length > 0
            ? getLevelFromPlayerLevels(experience, playerLevels)
            : getLevel(experience);
    }, [playerLevels, profile.info.experience]);

    const filteredSkills = useMemo(() => {
        const skills = profile.skills?.Common ?? [];
        return skills
            .filter((s) => s.Progress > 0 && !s.Id.startsWith('Bot'))
            .sort((a, b) => b.Progress - a.Progress);
    }, [profile.skills]);

    const equipmentItems = useMemo(() => profile.equipment?.Items ?? [], [profile.equipment]);
    const itemsById = useMemo(() => {
        const map: Record<string, EquipmentItem> = {};
        for (const item of equipmentItems) {
            map[item._id] = item;
        }
        return map;
    }, [equipmentItems]);

    const equippedItems = useMemo(() => {
        const items = equipmentItems;
        const map: Record<string, EquipmentItem> = {};
        const equipmentRootId = profile.equipment?.Id;
        for (const item of items) {
            if (item.slotId && (MAIN_SLOTS as readonly string[]).includes(item.slotId) && item.parentId === equipmentRootId) {
                map[item.slotId] = item;
            }
        }
        for (const item of items) {
            if (!item.slotId || !(MAIN_SLOTS as readonly string[]).includes(item.slotId)) {
                continue;
            }
            if (map[item.slotId]) {
                continue;
            }
            map[item.slotId] = resolveSlotRoot(item, itemsById, equipmentRootId);
        }
        return map;
    }, [equipmentItems, itemsById, profile.equipment?.Id]);

    const isBear = profile.info.side === 'Bear';
    const characterImageUrl = useMemo(
        () => getCharacterImageURL(profile, Platform.OS === 'android' ? { compact: true } : undefined),
        [profile],
    );
    const [characterImageUri, setCharacterImageUri] = useState(characterImageUrl);
    const lastActive = useMemo(() => {
        let latest = 0;
        for (const skill of profile.skills?.Common ?? []) {
            if (skill.LastAccess && skill.LastAccess > latest) {
                latest = skill.LastAccess;
            }
        }
        for (const timestamp of Object.values(profile.achievements ?? {})) {
            if (timestamp && timestamp > latest) {
                latest = timestamp;
            }
        }
        return latest ? new Date(latest * 1000) : null;
    }, [profile.achievements, profile.skills]);
    const profileUpdatedAt = useMemo(
        () => normalizeProfileTimestamp(profile.updated),
        [profile.updated],
    );

    const accountTime = useMemo(() => formatPlaytime(pmcStats.totalInGameTime), [pmcStats.totalInGameTime]);
    const memberCategory = profile.info.selectedMemberCategory ?? profile.info.memberCategory ?? 0;
    const isUnheard = (memberCategory & 1024) === 1024;
    const isEod = !isUnheard && (memberCategory & 2) === 2;
    const nicknameColor = isUnheard ? unheardBlue : isEod ? tarkovGold : Colors.text;
    const headerGradientColors: [string, string] = isBear
        ? [Colors.bearRed, withAlpha(Colors.background, 0.92)]
        : [Colors.usecBlue, withAlpha(Colors.background, 0.92)];
    const compactHeaderGradientColors: [string, string] = isBear
        ? [withAlpha(Colors.bearRed, 0.72), withAlpha(Colors.background, 0.92)]
        : [withAlpha(Colors.usecBlue, 0.72), withAlpha(Colors.background, 0.92)];
    const sideBadgeBackground = isBear ? withAlpha(Colors.bearRed, 0.6) : withAlpha(Colors.usecBlue, 0.6);
    const headerTopPadding = Math.max(44, insets.top + 24);
    const [compactHeaderVisible, setCompactHeaderVisible] = useState(false);
    const compactHeaderVisibleRef = useRef(false);
    const compactHeaderOpacity = useRef(new Animated.Value(0)).current;
    const compactHeaderTranslateY = useRef(new Animated.Value(-12)).current;
    const compactHeaderTopPadding = Math.max(insets.top + 8, 16);
    const compactHeaderThreshold = 150;
    const membershipBadge = isUnheard
        ? (
            <Image
                source={UNHEARD_BADGE_SOURCE}
                style={styles.membershipBadge}
                contentFit="contain"
            />
        )
        : isEod
            ? <SvgXml xml={EOD_CROWN_XML} width={18} height={18}/>
            : null;


    const Logo = isBear ? BearLogo : UsecLogo;

    useEffect(() => {
        setCharacterImageUri(characterImageUrl);
    }, [characterImageUrl]);


    useEffect(() => {
        if (!enableCollapsibleHeader) {
            compactHeaderVisibleRef.current = false;
            setCompactHeaderVisible(false);
            compactHeaderOpacity.setValue(0);
            compactHeaderTranslateY.setValue(-12);
            return;
        }
        Animated.parallel([
            Animated.timing(compactHeaderOpacity, {
                toValue: compactHeaderVisible ? 1 : 0,
                duration: 220,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(compactHeaderTranslateY, {
                toValue: compactHeaderVisible ? 0 : -12,
                duration: 220,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [compactHeaderOpacity, compactHeaderTranslateY, compactHeaderVisible, enableCollapsibleHeader]);

    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!enableCollapsibleHeader) return;
        const nextVisible = event.nativeEvent.contentOffset.y > compactHeaderThreshold;
        if (nextVisible === compactHeaderVisibleRef.current) return;
        compactHeaderVisibleRef.current = nextVisible;
        setCompactHeaderVisible(nextVisible);
    }, [compactHeaderThreshold, enableCollapsibleHeader]);

    const hasSkills = filteredSkills.length > 0;
    const achievementsMap = useMemo(() => profile.achievements ?? {}, [profile.achievements]);
    const achievementEntries = useMemo(() => {
        return Object.entries(achievementsMap)
            .map(([id, timestamp]) => ({id, timestamp}))
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [achievementsMap]);
    const favoriteItems = Array.isArray(profile.favoriteItems) ? profile.favoriteItems : [];
    const hideoutAreas = useMemo(() => {
        const raw = profile.hideout?.areas ?? profile.hideout?.Areas ?? [];
        return Array.isArray(raw) ? raw : [];
    }, [profile.hideout]);
    const hideoutAreaStashes = useMemo(() => {
        const raw = Array.isArray(profile.hideoutAreaStashes) ? profile.hideoutAreaStashes : [];
        return raw
            .map((stash, idx) => {
                const idRaw = stash.id ?? stash.Id ?? '';
                const id = String(idRaw || idx + 1);
                const level = stash.level ?? stash.Level ?? 0;
                return { id, level };
            })
            .filter((stash) => stash.id.trim().length > 0);
    }, [profile.hideoutAreaStashes]);

    const achievementsQuery = useQuery({
        queryKey: ['achievements', language],
        queryFn: () => fetchAchievements(language),
        staleTime: 6 * 60 * 60 * 1000,
    });
    const achievementMetaMap = useMemo(() => {
        const map: Record<string, { name: string; rarity?: string; normalizedRarity?: string }> = {};
        for (const item of achievementsQuery.data ?? []) {
            map[item.id] = {
                name: item.name,
                rarity: item.rarity,
                normalizedRarity: item.normalizedRarity,
            };
        }
        return map;
    }, [achievementsQuery.data]);
    const achievementRaritySummary = useMemo(() => {
        let common = 0;
        let rare = 0;
        let legendary = 0;
        let unknown = 0;
        for (const entry of achievementEntries) {
            const meta = achievementMetaMap[entry.id];
            const rarity = String(meta?.normalizedRarity ?? meta?.rarity ?? '').trim().toLowerCase();
            if (rarity === 'common') {
                common += 1;
            } else if (rarity === 'rare') {
                rare += 1;
            } else if (rarity === 'legendary') {
                legendary += 1;
            } else {
                unknown += 1;
            }
        }
        return {
            total: achievementEntries.length,
            common,
            rare,
            legendary,
            unknown,
        };
    }, [achievementEntries, achievementMetaMap]);

    const favoriteNamesQuery = useQuery({
        queryKey: ['favorite-items', language, favoriteItems.join(',')],
        queryFn: () => fetchItemNamesByTpls(favoriteItems, language),
        enabled: favoriteItems.length > 0,
        staleTime: 6 * 60 * 60 * 1000,
    });
    const favoriteNameMap = favoriteNamesQuery.data ?? {};

    const hideoutStationsQuery = useQuery({
        queryKey: ['hideout-stations'],
        queryFn: fetchHideoutStations,
        staleTime: 6 * 60 * 60 * 1000,
    });
    const hideoutStationNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const item of hideoutStationsQuery.data ?? []) {
            map[item.id] = item.name;
        }
        return map;
    }, [hideoutStationsQuery.data]);
    const pmcCounters = useMemo(
        () => (profile.pmcStats?.eft?.overAllCounters?.Items ?? []) as CounterItem[],
        [profile.pmcStats],
    );
    const scavCounters = useMemo(
        () => (profile.scavStats?.eft?.overAllCounters?.Items ?? []) as CounterItem[],
        [profile.scavStats],
    );
    const pmcExitBreakdown = useMemo(() => ({
        survived: getCounterValue(pmcCounters, ['ExitStatus', 'Survived', 'Pmc']),
        killed: getCounterValue(pmcCounters, ['ExitStatus', 'Killed', 'Pmc']),
        left: getCounterValue(pmcCounters, ['ExitStatus', 'Left', 'Pmc']),
        missing: getCounterValue(pmcCounters, ['ExitStatus', 'MissingInAction', 'Pmc']),
        runThrough: getCounterValue(pmcCounters, ['ExitStatus', 'Runner', 'Pmc']),
        transit: getCounterValue(pmcCounters, ['ExitStatus', 'Transit', 'Pmc']),
        longestWinStreak: getCounterValue(pmcCounters, ['LongestWinStreak', 'Pmc']),
    }), [pmcCounters]);
    const scavExitBreakdown = useMemo(() => ({
        survived: getCounterValue(scavCounters, ['ExitStatus', 'Survived', 'Scav']),
        killed: getCounterValue(scavCounters, ['ExitStatus', 'Killed', 'Scav']),
        left: getCounterValue(scavCounters, ['ExitStatus', 'Left', 'Scav']),
        missing: getCounterValue(scavCounters, ['ExitStatus', 'MissingInAction', 'Scav']),
        runThrough: getCounterValue(scavCounters, ['ExitStatus', 'Runner', 'Scav']),
        transit: getCounterValue(scavCounters, ['ExitStatus', 'Transit', 'Scav']),
        longestWinStreak: getCounterValue(scavCounters, ['LongestWinStreak', 'Scav']),
    }), [scavCounters]);

    const normalizeSectionOrder = useCallback((order: SectionKey[]) => {
        const unique = order.filter((key) => DEFAULT_SECTION_ORDER.includes(key));
        const next = [...unique];
        for (const key of DEFAULT_SECTION_ORDER) {
            if (!next.includes(key)) next.push(key);
        }
        return next;
    }, []);

    useEffect(() => {
        let isActive = true;
        AsyncStorage.getItem(PROFILE_SECTION_ORDER_KEY)
            .then((stored) => {
                if (!isActive || !stored) return;
                try {
                    const parsed = JSON.parse(stored) as SectionKey[];
                    if (Array.isArray(parsed)) {
                        setSectionOrder(normalizeSectionOrder(parsed));
                    }
                } catch {
                    // ignore invalid stored value
                }
            })
            .catch(() => undefined);
        return () => {
            isActive = false;
        };
    }, [normalizeSectionOrder]);

    useEffect(() => {
        AsyncStorage.setItem(PROFILE_SECTION_ORDER_KEY, JSON.stringify(sectionOrder)).catch(() => undefined);
    }, [sectionOrder]);

    const handleSectionLongPress = useCallback((_key?: SectionKey) => {
        setReorderVisible(true);
    }, []);

    const orderedSectionKeys = useMemo(() => {
        const normalized = normalizeSectionOrder(sectionOrder);
        return normalized.filter((key) => {
            if (key === 'scav') return scavStats.sessions > 0;
            if (key === 'skills') return hasSkills;
            return true;
        });
    }, [hasSkills, normalizeSectionOrder, scavStats.sessions, sectionOrder]);

    const reorderList = useMemo(() => normalizeSectionOrder(sectionOrder), [normalizeSectionOrder, sectionOrder]);

    const sectionTitleMap = useMemo(() => ({
        overview: t.overview,
        pmc: t.pmcStats,
        scav: t.scavStats,
        loadout: t.loadout,
        skills: t.skillsTitle,
        achievements: t.achievements,
        favorites: t.favoriteItems,
        hideout: t.hideout,
    }), [t]);

    const getSectionTitle = useCallback((key: SectionKey) => {
        return sectionTitleMap[key] ?? key;
    }, [sectionTitleMap]);

    const reorderData = useMemo<ReorderItem[]>(() => (
        reorderList.map((key) => ({ key, title: getSectionTitle(key) }))
    ), [getSectionTitle, reorderList]);

    const closeReorderModal = useCallback(() => {
        setReorderVisible(false);
    }, []);

    const handleReorderDragEnd = useCallback(({ data }: { data: ReorderItem[] }) => {
        const next = normalizeSectionOrder(data.map((item) => item.key));
        setSectionOrder(next);
    }, [normalizeSectionOrder]);

    const renderReorderItem = useCallback(({ item, drag, isActive }: RenderItemParams<ReorderItem>) => (
        <TouchableOpacity
            style={[styles.reorderRow, isActive && styles.reorderRowActive]}
            onLongPress={drag}
            delayLongPress={130}
            activeOpacity={0.85}
        >
            <View style={styles.reorderRowContent}>
                <View style={styles.reorderHandle}>
                    <GripVertical size={18} color={Colors.textTertiary} />
                </View>
                <Text style={styles.reorderLabel}>{item.title}</Text>
            </View>
        </TouchableOpacity>
    ), []);

    return (
        <>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
            <View style={styles.headerWrap}>
                <LinearGradient
                    colors={headerGradientColors}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 1}}
                    style={styles.headerGradient}
                />
                <View style={styles.factionWatermark} pointerEvents="none">
                    <Logo
                        style={styles.watermarkSvg}
                    />
                </View>
                {headerRight && (
                    <View style={[styles.headerRightWrap, {top: insets.top + 12, left: 12}]}>
                        {headerRight}
                    </View>
                )}
                <View style={styles.characterImageWrap}>
                    <Image
                        source={{uri: characterImageUri || DEFAULT_PROFILE_IMAGE_URL}}
                        style={styles.characterImage}
                        contentFit="contain"
                        contentPosition="bottom right"
                        onError={() => {
                            if (characterImageUri !== DEFAULT_PROFILE_IMAGE_URL) {
                                setCharacterImageUri(DEFAULT_PROFILE_IMAGE_URL);
                            }
                        }}
                    />
                </View>
                <View style={[styles.headerContent, {paddingTop: headerTopPadding}]}>
                    <View style={styles.nicknameRow}>
                        {membershipBadge}
                        <Text style={[styles.nickname, {color: nicknameColor}]}>{profile.info.nickname}</Text>
                    </View>
                    <View style={styles.badgesRow}>
                        <View
                            style={[styles.badge, {backgroundColor: sideBadgeBackground}]}>
                            <Text style={styles.badgeText}>{profile.info.side.toUpperCase()}</Text>
                        </View>
                        <View style={[styles.badge, {
                            backgroundColor: withAlpha(Colors.gold, 0.15),
                            borderColor: Colors.goldDim,
                            borderWidth: 1
                        }]}>
                            <Text style={[styles.badgeText, {color: Colors.gold}]}>{t.level} {level}</Text>
                        </View>
                    </View>
                    <View style={styles.headerStatsRow}>
                        <View style={styles.headerStat}>
                            <Text style={styles.headerStatLabel}>{t.xp}</Text>
                            <Text style={styles.headerStatValue}>{formatNumber(profile.info.experience)}</Text>
                        </View>
                        <View style={styles.headerStat}>
                            <Text style={styles.headerStatLabel}>{t.accountId}</Text>
                            <Text style={styles.headerStatValue}>{profile.aid}</Text>
                        </View>
                        {(profile.info.prestigeLevel ?? 0) > 0 && (
                            <View style={styles.headerStat}>
                                <Text style={styles.headerStatLabel}>{t.prestige}</Text>
                                <Text style={styles.headerStatValue}>{profile.info.prestigeLevel}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.headerMetaRow}>
                        <Text style={styles.headerMetaText}>{t.accountTime} {accountTime}</Text>
                        {lastActive && (
                            <Text style={styles.headerMetaText}>{t.lastActive} {lastActive.toLocaleString()}</Text>
                        )}
                        {profileUpdatedAt && (
                            <Text style={styles.headerMetaText}>{t.profileUpdated} {profileUpdatedAt.toLocaleString()}</Text>
                        )}
                    </View>
                </View>
            </View>

            <View style={styles.body}>
                {orderedSectionKeys.map((key) => {
                    if (key === 'overview') {
                        return (
                            <CollapsibleSection
                                key={key}
                                title={t.overview}
                                icon={<BarChart3 size={18} color={Colors.gold}/>}
                                onLongPress={() => handleSectionLongPress(key)}
                            >
                                <View style={styles.statCardsRow}>
                                    <StatCard
                                        value={pmcStats.kd.toFixed(2)}
                                        label={t.kd}
                                        color={Colors.statRed}
                                        icon={<Crosshair size={16} color={Colors.statRed}/>}
                                    />
                                    <StatCard
                                        value={`${pmcStats.survivalRate.toFixed(0)}%`}
                                        label={t.survival}
                                        color={Colors.statGreen}
                                        icon={<Heart size={16} color={Colors.statGreen}/>}
                                    />
                                    <StatCard
                                        value={`${pmcStats.kills}`}
                                        label={t.kills}
                                        color={Colors.statOrange}
                                        icon={<Flame size={16} color={Colors.statOrange}/>}
                                    />
                                    <StatCard
                                        value={`${pmcStats.sessions}`}
                                        label={t.raids}
                                        color={Colors.statBlue}
                                        icon={<Map size={16} color={Colors.statBlue}/>}
                                    />
                                </View>
                            </CollapsibleSection>
                        );
                    }

                    if (key === 'pmc') {
                        return (
                            <CollapsibleSection
                                key={key}
                                title={t.pmcStats}
                                icon={<BarChart3 size={18} color={Colors.gold}/>}
                                onLongPress={() => handleSectionLongPress(key)}
                            >
                                <View style={styles.sectionCard}>
                                    <StatsRow label={t.totalRaids} value={`${pmcStats.sessions}`}/>
                                    <StatsRow label={t.survived} value={`${pmcStats.survived}`}/>
                                    <StatsRow label={t.kills} value={`${pmcStats.kills}`}/>
                                    <StatsRow label={t.deaths} value={`${pmcStats.deaths}`}/>
                                    <StatsRow label={t.kdRatio} value={pmcStats.kd.toFixed(2)}/>
                                    <StatsRow label={t.survivalRate} value={`${pmcStats.survivalRate.toFixed(1)}%`}/>
                                    <StatsRow label={t.exitKilled} value={`${pmcExitBreakdown.killed}`}/>
                                    <StatsRow label={t.exitLeft} value={`${pmcExitBreakdown.left}`}/>
                                    <StatsRow label={t.exitMissing} value={`${pmcExitBreakdown.missing}`}/>
                                    <StatsRow label={t.exitRunThrough} value={`${pmcExitBreakdown.runThrough}`}/>
                                    <StatsRow label={t.exitTransit} value={`${pmcExitBreakdown.transit}`}/>
                                    <StatsRow label={t.longestWinStreak} value={`${pmcExitBreakdown.longestWinStreak}`}/>
                                    <StatsRow label={t.timeInRaids} value={formatPlaytime(pmcStats.totalInGameTime)} isLast/>
                                </View>
                            </CollapsibleSection>
                        );
                    }

                    if (key === 'scav') {
                        return (
                            <CollapsibleSection
                                key={key}
                                title={t.scavStats}
                                icon={<PersonStanding size={18} color={Colors.gold}/>}
                                onLongPress={() => handleSectionLongPress(key)}
                            >
                                <View style={styles.sectionCard}>
                                    <StatsRow label={t.totalRaids} value={`${scavStats.sessions}`}/>
                                    <StatsRow label={t.survived} value={`${scavStats.survived}`}/>
                                    <StatsRow label={t.kills} value={`${scavStats.kills}`}/>
                                    <StatsRow label={t.kdRatio} value={scavStats.kd.toFixed(2)}/>
                                    <StatsRow label={t.survivalRate} value={`${scavStats.survivalRate.toFixed(1)}%`}/>
                                    <StatsRow label={t.exitKilled} value={`${scavExitBreakdown.killed}`}/>
                                    <StatsRow label={t.exitLeft} value={`${scavExitBreakdown.left}`}/>
                                    <StatsRow label={t.exitMissing} value={`${scavExitBreakdown.missing}`}/>
                                    <StatsRow label={t.exitRunThrough} value={`${scavExitBreakdown.runThrough}`}/>
                                    <StatsRow label={t.exitTransit} value={`${scavExitBreakdown.transit}`}/>
                                    <StatsRow label={t.longestWinStreak} value={`${scavExitBreakdown.longestWinStreak}`} isLast/>
                                </View>
                            </CollapsibleSection>
                        );
                    }

                    if (key === 'loadout') {
                        return (
                            <CollapsibleSection
                                key={key}
                                title={t.loadout}
                                icon={<Package size={18} color={Colors.gold}/>}
                                onLongPress={() => handleSectionLongPress(key)}
                            >
                                <LoadoutSection
                                    equippedItems={equippedItems}
                                    equipmentItems={equipmentItems}
                                    showHeader={false}
                                    itemDetailPathname={itemDetailPathname}
                                />
                            </CollapsibleSection>
                        );
                    }

                    if (key === 'skills') {
                        return (
                            <CollapsibleSection
                                key={key}
                                title={t.skillsTitle}
                                icon={<Star size={18} color={Colors.gold}/>}
                                onLongPress={() => handleSectionLongPress(key)}
                            >
                                <SkillsSection skills={filteredSkills} showHeader={false}/>
                            </CollapsibleSection>
                        );
                    }

                    if (key === 'achievements') {
                        return (
                            <CollapsibleSection
                                key={key}
                                title={t.achievements}
                                icon={<Trophy size={18} color={Colors.gold}/>}
                                onLongPress={() => handleSectionLongPress(key)}
                            >
                                {achievementEntries.length === 0 ? (
                                    <View style={styles.emptyCard}>
                                        <Text style={styles.emptyText}>{t.noAchievements}</Text>
                                    </View>
                                ) : (
                                    <>
                                        <View style={styles.sectionCard}>
                                            <StatsRow label={t.achievementTotal} value={`${achievementRaritySummary.total}`}/>
                                            <StatsRow label={t.achievementRarityLegendary} value={`${achievementRaritySummary.legendary}`}/>
                                            <StatsRow label={t.achievementRarityRare} value={`${achievementRaritySummary.rare}`}/>
                                            <StatsRow label={t.achievementRarityCommon} value={`${achievementRaritySummary.common}`}/>
                                            <StatsRow label={t.achievementRarityUnknown} value={`${achievementRaritySummary.unknown}`} isLast/>
                                        </View>
                                        <View style={styles.sectionCard}>
                                            {achievementEntries.map((entry, idx) => {
                                                const meta = achievementMetaMap[entry.id];
                                                const dateLabel = entry.timestamp
                                                    ? new Date(entry.timestamp * 1000).toLocaleDateString()
                                                    : '';
                                                const rarityLabel = getAchievementRarityLabel(
                                                    meta?.normalizedRarity ?? meta?.rarity,
                                                    t,
                                                );
                                                const value = dateLabel
                                                    ? `${dateLabel} • ${rarityLabel}`
                                                    : rarityLabel;
                                                return (
                                                    <StatsRow
                                                        key={entry.id}
                                                        label={meta?.name ?? `Achievement ${entry.id.slice(-6)}`}
                                                        value={value}
                                                        isLast={idx === achievementEntries.length - 1}
                                                    />
                                                );
                                            })}
                                        </View>
                                    </>
                                )}
                            </CollapsibleSection>
                        );
                    }

                    if (key === 'favorites') {
                        return (
                            <CollapsibleSection
                                key={key}
                                title={t.favoriteItems}
                                icon={<Heart size={18} color={Colors.gold}/>}
                                onLongPress={() => handleSectionLongPress(key)}
                            >
                                {favoriteItems.length === 0 ? (
                                    <View style={styles.emptyCard}>
                                        <Text style={styles.emptyText}>{t.noFavoriteItems}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.sectionCard}>
                                        {favoriteItems.map((id, idx) => (
                                            <StatsRow
                                                key={id}
                                                label={favoriteNameMap[id] ?? `Item ${id.slice(-6)}`}
                                                value=""
                                                isLast={idx === favoriteItems.length - 1}
                                            />
                                        ))}
                                    </View>
                                )}
                            </CollapsibleSection>
                        );
                    }

                    if (key === 'hideout') {
                        const hasHideoutRows = hideoutAreaStashes.length > 0 || hideoutAreas.length > 0;
                        return (
                            <CollapsibleSection
                                key={key}
                                title={t.hideout}
                                icon={<Home size={18} color={Colors.gold}/>}
                                onLongPress={() => handleSectionLongPress(key)}
                            >
                                {!hasHideoutRows ? (
                                    <View style={styles.emptyCard}>
                                        <Text style={styles.emptyText}>{t.noHideout}</Text>
                                    </View>
                                ) : (
                                    <View style={styles.sectionCard}>
                                        {hideoutAreaStashes.map((stash, idx) => {
                                            const stationName = hideoutStationNameMap[stash.id];
                                            const label = stationName
                                                ? `${stationName} (${t.hideoutStash})`
                                                : `${t.hideoutStash} ${stash.id}`;
                                            const value = `${t.level} ${stash.level}`;
                                            const isLast = idx === hideoutAreaStashes.length - 1 && hideoutAreas.length === 0;
                                            return (
                                                <StatsRow
                                                    key={`stash-${stash.id}-${idx}`}
                                                    label={label}
                                                    value={value}
                                                    isLast={isLast}
                                                />
                                            );
                                        })}
                                        {hideoutAreas.map((area, idx) => {
                                            const id = (area.type ?? area.areaType ?? '').toString();
                                            const level = area.level ?? area.Level ?? 0;
                                            const name = hideoutStationNameMap[id] ?? `Area ${id || idx + 1}`;
                                            const value = `${t.level} ${level}`;
                                            return (
                                                <StatsRow
                                                    key={`${id}-${idx}`}
                                                    label={name}
                                                    value={value}
                                                    isLast={idx === hideoutAreas.length - 1}
                                                />
                                            );
                                        })}
                                    </View>
                                )}
                            </CollapsibleSection>
                        );
                    }

                    return null;
                })}
            </View>
            </ScrollView>
            {enableCollapsibleHeader && (
                <Animated.View
                    pointerEvents={compactHeaderVisible ? 'auto' : 'none'}
                    style={[
                        styles.compactHeaderWrap,
                        {
                            paddingTop: compactHeaderTopPadding,
                            opacity: compactHeaderOpacity,
                            transform: [{translateY: compactHeaderTranslateY}],
                        },
                    ]}
                >
                    <LinearGradient
                        colors={compactHeaderGradientColors}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.compactHeaderRow}>
                        <View style={styles.compactHeaderMain}>
                            <View style={styles.compactNameRow}>
                                {membershipBadge}
                                <Text style={[styles.compactNickname, {color: nicknameColor}]} numberOfLines={1}>{profile.info.nickname}</Text>
                            </View>
                            <View style={styles.compactBadgesRow}>
                                <View style={[styles.compactBadge, {backgroundColor: sideBadgeBackground}]}>
                                    <Text style={styles.compactBadgeText}>{profile.info.side.toUpperCase()}</Text>
                                </View>
                                <View style={[styles.compactBadge, styles.compactLevelBadge]}>
                                    <Text style={[styles.compactBadgeText, {color: Colors.gold}]}>{t.level} {level}</Text>
                                </View>
                            </View>
                        </View>
                        {headerRight && (
                            <View style={styles.compactHeaderRight}>
                                {headerRight}
                            </View>
                        )}
                    </View>
                </Animated.View>
            )}
            <Modal
                visible={reorderVisible}
                transparent
                animationType="fade"
                onRequestClose={closeReorderModal}
            >
                <View style={styles.reorderOverlay}>
                    <View style={styles.reorderCard}>
                        <View style={styles.reorderHeader}>
                            <Text style={styles.reorderTitle}>{t.reorderSection}</Text>
                            <TouchableOpacity onPress={closeReorderModal} activeOpacity={0.7}>
                                <Text style={styles.reorderCloseText}>{t.cancel}</Text>
                            </TouchableOpacity>
                        </View>
                        <DraggableFlatList
                            data={reorderData}
                            keyExtractor={(item) => item.key}
                            renderItem={renderReorderItem}
                            onDragEnd={handleReorderDragEnd}
                            activationDistance={6}
                            autoscrollThreshold={24}
                            autoscrollSpeed={200}
                            containerStyle={styles.reorderList}
                            contentContainerStyle={styles.reorderListContent}
                            ItemSeparatorComponent={() => <View style={styles.reorderSeparator} />}
                            scrollEnabled={false}
                        />
                        <Text style={styles.reorderHint}>{t.reorderHint}</Text>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    compactHeaderWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        paddingHorizontal: 12,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        zIndex: 60,
    },
    compactHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    compactHeaderMain: {
        flex: 1,
        minWidth: 0,
    },
    compactNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    compactNickname: {
        fontSize: 16,
        fontWeight: '700' as const,
    },
    compactBadgesRow: {
        marginTop: 6,
        flexDirection: 'row',
        gap: 8,
    },
    compactBadge: {
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    compactLevelBadge: {
        backgroundColor: withAlpha(Colors.gold, 0.15),
        borderColor: Colors.goldDim,
        borderWidth: 1,
    },
    compactBadgeText: {
        fontSize: 10,
        fontWeight: '700' as const,
        color: Colors.text,
        letterSpacing: 0.3,
    },
    compactHeaderRight: {
        alignItems: 'flex-end',
    },
    headerWrap: {
        height: 280,
        position: 'relative',
        overflow: 'hidden',
    },
    headerGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    factionWatermark: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 0,
        opacity: 0.1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    watermarkSvg: {
        position: 'absolute',
        left: '-70%',
        top: '-30%',
        width: '120%',
        height: '120%',
    },
    characterImageWrap: {
        position: 'absolute',
        right: 0,
        top: 6,
        bottom: 0,
        width: 240,
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        zIndex: 2,
    },
    characterImage: {
        width: '100%',
        height: '100%',
    },
    headerContent: {
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: 10,
        paddingRight: 160,
        zIndex: 3,
    },
    headerRightWrap: {
        position: 'absolute',
        zIndex: 4,
    },
    nicknameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    membershipBadge: {
        width: 18,
        height: 18,
    },
    nickname: {
        fontSize: 28,
        fontWeight: '700' as const,
        color: Colors.text,
        marginBottom: 8,
    },
    badgesRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700' as const,
        color: Colors.text,
        letterSpacing: 0.5,
    },
    headerStatsRow: {
        flexDirection: 'row',
        gap: 20,
    },
    headerStat: {
        gap: 2,
    },
    headerStatLabel: {
        fontSize: 10,
        color: alphaWhite(0.45),
    },
    headerStatValue: {
        fontSize: 12,
        fontWeight: '600' as const,
        color: alphaWhite(0.8),
        fontVariant: ['tabular-nums'],
    },
    headerMetaRow: {
        marginTop: 10,
        gap: 4,
    },
    headerMetaText: {
        fontSize: 11,
        color: alphaWhite(0.6),
    },
    body: {
        paddingHorizontal: 16,
        paddingTop: 20,
        gap: 24,
    },
    statCardsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    section: {
        gap: 14,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600' as const,
        color: Colors.text,
    },
    sectionBody: {
        gap: 10,
    },
    sectionCard: {
        backgroundColor: Colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    emptyCard: {
        backgroundColor: Colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingVertical: 18,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    reorderOverlay: {
        flex: 1,
        backgroundColor: alphaBlack(0.55),
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    reorderCard: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 16,
        gap: 14,
    },
    reorderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    reorderTitle: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: Colors.text,
    },
    reorderCloseText: {
        fontSize: 14,
        color: Colors.gold,
        fontWeight: '600' as const,
    },
    reorderList: {
        width: '100%',
    },
    reorderListContent: {
        paddingVertical: 2,
    },
    reorderSeparator: {
        height: 8,
    },
    reorderRow: {
        height: REORDER_ROW_HEIGHT,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.card,
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    reorderRowActive: {
        borderColor: Colors.goldDim,
        backgroundColor: withAlpha(Colors.gold, 0.12),
    },
    reorderRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    reorderHandle: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    reorderLabel: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500' as const,
    },
    reorderHint: {
        fontSize: 12,
        color: Colors.textTertiary,
        textAlign: 'center',
    },
});

const EOD_CROWN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${eodCrownLight}" />
      <stop offset="1" stop-color="${eodCrownDark}" />
    </linearGradient>
  </defs>
  <path d="M10 70 L18 28 L38 58 L50 20 L62 58 L82 28 L90 70 Z" fill="url(#g)"/>
  <rect x="14" y="70" width="72" height="12" rx="3" fill="${eodCrownBase}"/>
</svg>`;

const UNHEARD_BADGE_SOURCE = require('../assets/images/The_Unheard_Icon.webp');
