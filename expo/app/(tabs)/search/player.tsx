import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react-native';
import Colors, { getModeAccentTheme } from '@/constants/colors';
import { useGameMode } from '@/providers/GameModeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import {
  clearPlayerProfileCache,
  fetchPlayerProfile,
  isTurnstileRequiredError,
  savePlayerSearchToken,
} from '@/services/tarkovApi';
import PlayerProfileView from '@/components/PlayerProfileView';
import PlayerProfileSkeleton from '@/components/PlayerProfileSkeleton';
import TurnstileTokenModal from '@/components/TurnstileTokenModal';

export default function PlayerDetailScreen() {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const { t } = useLanguage();
  const { gameMode } = useGameMode();
  const accentTheme = React.useMemo(() => getModeAccentTheme(gameMode), [gameMode]);
  const retryTextStyle = React.useMemo(() => ({ color: accentTheme.accentTextOnSolid }), [accentTheme]);
  const queryClient = useQueryClient();
  const [tokenModalVisible, setTokenModalVisible] = React.useState(false);

  const profileQuery = useQuery({
    queryKey: ['profile', gameMode, accountId],
    queryFn: ({ signal }) => fetchPlayerProfile(accountId!, { signal, gameMode }),
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    gcTime: 10 * 60 * 1000,
  });

  const handleRefresh = React.useCallback(async () => {
    if (!accountId) return;
    try {
      clearPlayerProfileCache(accountId);
      const freshProfile = await fetchPlayerProfile(accountId, { force: true, gameMode });
      queryClient.setQueryData(['profile', gameMode, accountId], freshProfile);
      await queryClient.invalidateQueries({ queryKey: ['profile', gameMode, accountId] });
    } catch (error) {
      if (isTurnstileRequiredError(error)) {
        setTokenModalVisible(true);
      }
    }
  }, [accountId, gameMode, queryClient]);

  const handleRetry = React.useCallback(() => {
    const error = profileQuery.error;
    if (isTurnstileRequiredError(error)) {
      setTokenModalVisible(true);
      return;
    }
    void handleRefresh();
  }, [handleRefresh, profileQuery.error]);

  const handleTokenCaptured = React.useCallback(async (token: string) => {
    await savePlayerSearchToken(token);
    setTokenModalVisible(false);
    await handleRefresh();
  }, [handleRefresh]);

  const handleTokenError = React.useCallback(() => {
    setTokenModalVisible(false);
  }, []);

  React.useEffect(() => {
    if (profileQuery.isError && isTurnstileRequiredError(profileQuery.error)) {
      setTokenModalVisible(true);
    }
  }, [profileQuery.error, profileQuery.isError]);

  if (profileQuery.isLoading && !profileQuery.data) {
    return (
      <>
        <Stack.Screen options={{ title: t.playerProfile }} />
        <PlayerProfileSkeleton />
      </>
    );
  }

  if (profileQuery.isError && !profileQuery.data) {
    const turnstileError = isTurnstileRequiredError(profileQuery.error);
    if (turnstileError) {
      return (
        <>
          <Stack.Screen options={{ title: t.playerProfile }} />
          <PlayerProfileSkeleton />
          <TurnstileTokenModal
            visible={tokenModalVisible}
            onClose={() => setTokenModalVisible(false)}
            onTokenCaptured={handleTokenCaptured}
            onError={handleTokenError}
            searchName="player"
            gameMode={gameMode}
            silent
          />
        </>
      );
    }
    return (
      <>
        <View style={[styles.centerContainer, { backgroundColor: Colors.background }]}>
          <Stack.Screen options={{ title: t.playerProfile }} />
          <AlertTriangle size={44} color={Colors.statOrange} />
          <Text style={styles.errorTitle}>{t.failedToLoad}</Text>
          <Text style={styles.errorMessage}>
            {(profileQuery.error as Error).message}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
          >
            <Text style={[styles.retryText, retryTextStyle]}>{t.retry}</Text>
          </TouchableOpacity>
        </View>
        <TurnstileTokenModal
          visible={tokenModalVisible}
          onClose={() => setTokenModalVisible(false)}
          onTokenCaptured={handleTokenCaptured}
          onError={handleTokenError}
          searchName="player"
          gameMode={gameMode}
          silent
        />
      </>
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
    color: Colors.text,
  },
});
