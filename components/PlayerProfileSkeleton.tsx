import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Colors from '@/constants/colors';
import ShimmerBlock from '@/components/ShimmerBlock';

type Props = {
  showCompactHeaderPlaceholder?: boolean;
};

export default function PlayerProfileSkeleton({ showCompactHeaderPlaceholder = false }: Props) {
  return (
    <View style={styles.container}>
      {showCompactHeaderPlaceholder ? (
        <View style={styles.compactHeaderWrap}>
          <ShimmerBlock width="46%" height={14} />
          <ShimmerBlock width={68} height={10} />
        </View>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerWrap}>
          <View style={styles.headerContent}>
            <ShimmerBlock width="54%" height={30} borderRadius={8} />
            <View style={styles.badgesRow}>
              <ShimmerBlock width={54} height={18} borderRadius={6} />
              <ShimmerBlock width={64} height={18} borderRadius={6} />
            </View>
            <View style={styles.headerStatsRow}>
              <View style={styles.headerStat}>
                <ShimmerBlock width={42} height={10} />
                <ShimmerBlock width={66} height={13} />
              </View>
              <View style={styles.headerStat}>
                <ShimmerBlock width={46} height={10} />
                <ShimmerBlock width={52} height={13} />
              </View>
              <View style={styles.headerStat}>
                <ShimmerBlock width={44} height={10} />
                <ShimmerBlock width={58} height={13} />
              </View>
            </View>
          </View>
          <View style={styles.characterPlaceholderWrap}>
            <ShimmerBlock width={170} height={236} borderRadius={16} />
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.statCardsRow}>
            <View style={styles.statCard}>
              <ShimmerBlock width="46%" height={10} />
              <ShimmerBlock width="60%" height={22} borderRadius={6} />
            </View>
            <View style={styles.statCard}>
              <ShimmerBlock width="52%" height={10} />
              <ShimmerBlock width="56%" height={22} borderRadius={6} />
            </View>
          </View>

          {Array.from({ length: 4 }).map((_, sectionIndex) => (
            <View key={`profile-skeleton-section-${sectionIndex}`} style={styles.section}>
              <View style={styles.sectionHeader}>
                <ShimmerBlock width={130} height={18} borderRadius={6} />
                <ShimmerBlock width={18} height={18} borderRadius={9} />
              </View>
              <View style={styles.sectionCard}>
                <View style={styles.rowLine}>
                  <ShimmerBlock width="34%" height={12} />
                  <ShimmerBlock width="24%" height={12} />
                </View>
                <View style={styles.rowLine}>
                  <ShimmerBlock width="40%" height={12} />
                  <ShimmerBlock width="28%" height={12} />
                </View>
                <View style={styles.rowLine}>
                  <ShimmerBlock width="38%" height={12} />
                  <ShimmerBlock width="22%" height={12} />
                </View>
              </View>
            </View>
          ))}
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
  compactHeaderWrap: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  headerWrap: {
    height: 280,
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingTop: 38,
  },
  headerContent: {
    zIndex: 2,
    paddingRight: 148,
    gap: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  headerStatsRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 4,
  },
  headerStat: {
    gap: 5,
  },
  characterPlaceholderWrap: {
    position: 'absolute',
    right: 8,
    bottom: 2,
    zIndex: 1,
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
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
