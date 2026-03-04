import React from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors, { withAlpha } from '@/constants/colors';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  fixed?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
}

const HEADER_TOP_EXTRA = 6;
const HEADER_TOP_MIN = 16;
const HEADER_BOTTOM = 12;

export function getPageHeaderEstimatedHeight(topInset: number, hasSubtitle: boolean = true): number {
  const topPadding = Math.max(topInset + HEADER_TOP_EXTRA, HEADER_TOP_MIN);
  const subtitleHeight = hasSubtitle ? 20 : 0;
  const subtitleGap = hasSubtitle ? 6 : 0;
  const titleHeight = 38;
  const bottomPadding = HEADER_BOTTOM;
  return topPadding + subtitleHeight + subtitleGap + titleHeight + bottomPadding;
}

export default function PageHeader({
  title,
  subtitle,
  fixed = false,
  left,
  right,
  onLayout,
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top + HEADER_TOP_EXTRA, HEADER_TOP_MIN);
  const gradientColors = [
    withAlpha(Colors.gold, 0.09),
    withAlpha(Colors.surface, 0.96),
    Colors.background,
  ] as const;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.wrap,
        { backgroundColor: Colors.background },
        { paddingTop: topPadding },
        fixed && styles.fixedWrap,
        fixed && { borderBottomColor: Colors.border, backgroundColor: Colors.background },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.86, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.row, !(left || right) && styles.rowNoActions]}>
        <View style={[styles.side, !left && styles.sideEmpty]}>{left}</View>
        <View style={styles.content}>
          {!!subtitle && <Text style={[styles.subtitle, { color: withAlpha(Colors.gold, 0.72) }]}>{subtitle}</Text>}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        <View style={[styles.side, styles.sideRight, !right && styles.sideEmpty]}>{right}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: HEADER_BOTTOM,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  fixedWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    borderBottomWidth: 1,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 44,
    gap: 10,
  },
  rowNoActions: {
    gap: 0,
  },
  side: {
    width: 40,
    minHeight: 40,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  sideEmpty: {
    width: 0,
    minHeight: 0,
  },
  content: {
    gap: 6,
    flex: 1,
  },
  subtitle: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '700' as const,
    color: Colors.text,
  },
});
