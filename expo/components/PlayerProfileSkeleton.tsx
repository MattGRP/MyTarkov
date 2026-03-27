import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import ShimmerBlock from '@/components/ShimmerBlock';

type Props = {
  showCompactHeaderPlaceholder?: boolean;
};

export default function PlayerProfileSkeleton({ showCompactHeaderPlaceholder = false }: Props) {
  const insets = useSafeAreaInsets();
  const compactHeaderTopPadding = Math.max(insets.top + 8, 16);
  const headerTopPadding = Math.max(insets.top + 20, 34);
  const bottomInsetPadding = Math.max(insets.bottom + 112, 132);

  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      {showCompactHeaderPlaceholder ? (
        <View
          style={[
            styles.compactHeaderWrap,
            {
              paddingTop: compactHeaderTopPadding,
              backgroundColor: Colors.surface,
              borderBottomColor: Colors.border,
            },
          ]}
        >
          <ShimmerBlock width="46%" height={14} />
          <ShimmerBlock width={68} height={10} />
        </View>
      ) : null}
      <ScrollView
        style={[styles.scroll, { backgroundColor: Colors.background }]}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInsetPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.headerWrap,
            {
              backgroundColor: Colors.surface,
              borderBottomColor: Colors.border,
            },
          ]}
        >
          <View style={[styles.headerContent, { paddingTop: headerTopPadding }]}>
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
            <View style={styles.headerMetaRow}>
              <ShimmerBlock width="62%" height={10} />
              <ShimmerBlock width="56%" height={10} />
              <ShimmerBlock width="48%" height={10} />
            </View>
          </View>
          <View style={styles.characterPlaceholderWrap}>
            <ShimmerBlock width={140} height={220} />
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
    position: 'relative',
    marginHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  headerContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 10,
    zIndex: 2,
    paddingRight: 168,
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
  headerMetaRow: {
    marginTop: 2,
    gap: 6,
  },
  characterPlaceholderWrap: {
    position: 'absolute',
    right: 16,
    top: 6,
    bottom: 0,
    width: 240,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
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
