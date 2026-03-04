import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLanguage } from '@/providers/LanguageProvider';
import { clearPlayerProfileCache, fetchPlayerProfile } from '@/services/tarkovApi';
import PlayerProfileView from '@/components/PlayerProfileView';
import PlayerProfileSkeleton from '@/components/PlayerProfileSkeleton';

export default function PlayerDetailScreen() {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile', accountId],
    queryFn: ({ signal }) => fetchPlayerProfile(accountId!, { signal }),
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    gcTime: 10 * 60 * 1000,
  });

  const handleRefresh = React.useCallback(async () => {
    if (!accountId) return;
    clearPlayerProfileCache(accountId);
    const freshProfile = await fetchPlayerProfile(accountId, { force: true });
    queryClient.setQueryData(['profile', accountId], freshProfile);
    await queryClient.invalidateQueries({ queryKey: ['profile', accountId] });
  }, [accountId, queryClient]);

  if (profileQuery.isLoading && !profileQuery.data) {
    return (
      <>
        <Stack.Screen options={{ title: t.playerProfile }} />
        <PlayerProfileSkeleton />
      </>
    );
  }

  if (profileQuery.isError && !profileQuery.data) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: t.playerProfile }} />
        <AlertTriangle size={44} color={Colors.statOrange} />
        <Text style={styles.errorTitle}>{t.failedToLoad}</Text>
        <Text style={styles.errorMessage}>{(profileQuery.error as Error).message}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRefresh}
        >
          <Text style={styles.retryText}>{t.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profileQuery.data) {
    return (
      <>
        <Stack.Screen options={{ title: t.playerProfile }} />
        <PlayerProfileSkeleton />
      </>
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
