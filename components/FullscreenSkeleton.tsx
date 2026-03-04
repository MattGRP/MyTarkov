import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';
import ShimmerBlock from '@/components/ShimmerBlock';

type Props = {
  message?: string;
};

export default function FullscreenSkeleton({ message }: Props) {
  return (
    <View style={styles.wrap}>
      <ShimmerBlock width={72} height={72} borderRadius={20} />
      <View style={styles.lines}>
        <ShimmerBlock width="70%" height={14} />
        <ShimmerBlock width="52%" height={12} />
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  lines: {
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
    gap: 8,
  },
  message: {
    marginTop: 2,
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});

