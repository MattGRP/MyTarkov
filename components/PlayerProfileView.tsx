import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Crosshair, Heart, Flame, Map, BarChart3, PersonStanding } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import StatCard from '@/components/StatCard';
import StatsRow from '@/components/StatsRow';
import LoadoutSection from '@/components/LoadoutSection';
import SkillsSection from '@/components/SkillsSection';
import {
  PlayerProfile,
  EquipmentItem,
  MAIN_SLOTS,
  calculatePlayerStats,
  getLevel,
  getCharacterImageURL,
} from '@/types/tarkov';
import { formatNumber, formatPlaytime } from '@/utils/helpers';

interface PlayerProfileViewProps {
  profile: PlayerProfile;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  headerRight?: React.ReactNode;
}

export default function PlayerProfileView({ profile, isRefreshing, onRefresh, headerRight }: PlayerProfileViewProps) {
  const { t } = useLanguage();
  const pmcStats = useMemo(() => calculatePlayerStats(profile.pmcStats), [profile.pmcStats]);
  const scavStats = useMemo(() => calculatePlayerStats(profile.scavStats), [profile.scavStats]);
  const level = useMemo(() => getLevel(profile.info.experience), [profile.info.experience]);

  const filteredSkills = useMemo(() => {
    const skills = profile.skills?.Common ?? [];
    return skills
      .filter((s) => s.Progress > 0 && !s.Id.startsWith('Bot'))
      .sort((a, b) => b.Progress - a.Progress);
  }, [profile.skills]);

  const equippedItems = useMemo(() => {
    const items = profile.equipment?.Items ?? [];
    const map: Record<string, EquipmentItem> = {};
    for (const item of items) {
      if (item.slotId && (MAIN_SLOTS as readonly string[]).includes(item.slotId)) {
        map[item.slotId] = item;
      }
    }
    return map;
  }, [profile.equipment]);

  const isBear = profile.info.side === 'Bear';
  const characterImageUrl = useMemo(() => getCharacterImageURL(profile), [profile]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing ?? false}
            onRefresh={onRefresh}
            tintColor={Colors.gold}
          />
        ) : undefined
      }
    >
      <View style={styles.headerWrap}>
        <LinearGradient
          colors={isBear ? ['#8C2620', '#141410'] : ['#1F3366', '#141410']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        />
        <View style={styles.characterImageWrap}>
          <Image
            source={{ uri: characterImageUrl }}
            style={styles.characterImage}
            contentFit="contain"
          />
        </View>
        <View style={styles.headerContent}>
          {headerRight && <View style={styles.headerRightWrap}>{headerRight}</View>}
          <Text style={styles.nickname}>{profile.info.nickname}</Text>
          <View style={styles.badgesRow}>
            <View style={[styles.badge, { backgroundColor: isBear ? 'rgba(140,38,32,0.6)' : 'rgba(31,51,102,0.6)' }]}>
              <Text style={styles.badgeText}>{profile.info.side.toUpperCase()}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: 'rgba(217,191,115,0.15)', borderColor: Colors.goldDim, borderWidth: 1 }]}>
              <Text style={[styles.badgeText, { color: Colors.gold }]}>LVL {level}</Text>
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
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.statCardsRow}>
          <StatCard
            value={pmcStats.kd.toFixed(2)}
            label={t.kd}
            color={Colors.statRed}
            icon={<Crosshair size={16} color={Colors.statRed} />}
          />
          <StatCard
            value={`${pmcStats.survivalRate.toFixed(0)}%`}
            label={t.survival}
            color={Colors.statGreen}
            icon={<Heart size={16} color={Colors.statGreen} />}
          />
          <StatCard
            value={`${pmcStats.kills}`}
            label={t.kills}
            color={Colors.statOrange}
            icon={<Flame size={16} color={Colors.statOrange} />}
          />
          <StatCard
            value={`${pmcStats.sessions}`}
            label={t.raids}
            color={Colors.statBlue}
            icon={<Map size={16} color={Colors.statBlue} />}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <BarChart3 size={18} color={Colors.gold} />
            <Text style={styles.sectionTitle}>{t.pmcStats}</Text>
          </View>
          <View style={styles.sectionCard}>
            <StatsRow label={t.totalRaids} value={`${pmcStats.sessions}`} />
            <StatsRow label={t.survived} value={`${pmcStats.survived}`} />
            <StatsRow label={t.kills} value={`${pmcStats.kills}`} />
            <StatsRow label={t.deaths} value={`${pmcStats.deaths}`} />
            <StatsRow label={t.kdRatio} value={pmcStats.kd.toFixed(2)} />
            <StatsRow label={t.survivalRate} value={`${pmcStats.survivalRate.toFixed(1)}%`} />
            <StatsRow label={t.timeInRaids} value={formatPlaytime(pmcStats.totalInGameTime)} isLast />
          </View>
        </View>

        {scavStats.sessions > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <PersonStanding size={18} color={Colors.gold} />
              <Text style={styles.sectionTitle}>{t.scavStats}</Text>
            </View>
            <View style={styles.sectionCard}>
              <StatsRow label={t.totalRaids} value={`${scavStats.sessions}`} />
              <StatsRow label={t.survived} value={`${scavStats.survived}`} />
              <StatsRow label={t.kills} value={`${scavStats.kills}`} />
              <StatsRow label={t.kdRatio} value={scavStats.kd.toFixed(2)} />
              <StatsRow label={t.survivalRate} value={`${scavStats.survivalRate.toFixed(1)}%`} isLast />
            </View>
          </View>
        )}

        <LoadoutSection equippedItems={equippedItems} />
        <SkillsSection skills={filteredSkills} />
      </View>
    </ScrollView>
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
  headerWrap: {
    height: 280,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  characterImageWrap: {
    position: 'absolute',
    right: -40,
    top: 10,
    bottom: 0,
    width: 220,
  },
  characterImage: {
    width: '100%',
    height: '100%',
  },
  headerContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
  },
  headerRightWrap: {
    position: 'absolute',
    top: -200,
    right: 0,
  },
  nickname: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: 'rgba(255,255,255,0.45)',
  },
  headerStatValue: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
    fontVariant: ['tabular-nums'],
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
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
});
