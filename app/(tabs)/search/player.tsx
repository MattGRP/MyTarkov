import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { fetchPlayerProfile } from '@/services/tarkovApi';
import PlayerProfileView from '@/components/PlayerProfileView';

export default function PlayerDetailScreen() {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();

  const profileQuery = useQuery({
    queryKey: ['profile', accountId],
    queryFn: () => fetchPlayerProfile(accountId!),
    enabled: !!accountId,
    staleTime: 60000,
  });

  if (profileQuery.isLoading && !profileQuery.data) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Player Profile' }} />
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (profileQuery.isError && !profileQuery.data) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Player Profile' }} />
        <AlertTriangle size={44} color={Colors.statOrange} />
        <Text style={styles.errorTitle}>Failed to load profile</Text>
        <Text style={styles.errorMessage}>{(profileQuery.error as Error).message}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => profileQuery.refetch()}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profileQuery.data) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Player Profile' }} />
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: profileQuery.data.info.nickname }} />
      <PlayerProfileView profile={profileQuery.data} />
    </>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  errorMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1A1A14',
  },
});
