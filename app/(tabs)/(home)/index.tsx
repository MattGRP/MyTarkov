import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors, { alphaWhite, getModeAccentTheme } from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useGameMode } from '@/providers/GameModeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import {
  clearPlayerProfileCache,
  fetchPlayerProfile,
  isTurnstileRequiredError,
  savePlayerSearchToken,
} from '@/services/tarkovApi';
import PlayerProfileView from '@/components/PlayerProfileView';
import AccountBindingPanel from '@/components/AccountBindingPanel';
import PlayerProfileSkeleton from '@/components/PlayerProfileSkeleton';
import TurnstileTokenModal from '@/components/TurnstileTokenModal';

export default function MyProfileScreen() {
  const { playerAccountId } = useAuth();
  const { gameMode } = useGameMode();
  const { t } = useLanguage();
  const accentTheme = React.useMemo(() => getModeAccentTheme(gameMode), [gameMode]);
  const retryTextStyle = React.useMemo(() => ({ color: accentTheme.accentTextOnSolid }), [accentTheme]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [tokenModalVisible, setTokenModalVisible] = useState<boolean>(false);
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isRefreshing) {
      spinValue.setValue(0);
      spinAnimRef.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinAnimRef.current.start();
      return;
    }
    spinAnimRef.current?.stop();
    spinValue.setValue(0);
  }, [isRefreshing, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const profileQuery = useQuery({
    queryKey: ['profile', gameMode, playerAccountId],
    queryFn: ({ signal }) => fetchPlayerProfile(playerAccountId!, { signal, gameMode }),
    enabled: !!playerAccountId,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    gcTime: 10 * 60 * 1000,
  });

  const handleRefresh = useCallback(async () => {
    if (!playerAccountId) return;
    setIsRefreshing(true);
    try {
      clearPlayerProfileCache(playerAccountId);
      const freshProfile = await fetchPlayerProfile(playerAccountId, { force: true, gameMode });
      queryClient.setQueryData(['profile', gameMode, playerAccountId], freshProfile);
      await queryClient.invalidateQueries({ queryKey: ['profile', gameMode, playerAccountId] });
    } catch (error) {
      if (isTurnstileRequiredError(error)) {
        setTokenModalVisible(true);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [gameMode, playerAccountId, queryClient]);

  const handleRetry = useCallback(() => {
    const error = profileQuery.error;
    if (isTurnstileRequiredError(error)) {
      setTokenModalVisible(true);
      return;
    }
    void handleRefresh();
  }, [handleRefresh, profileQuery.error]);

  const handleTokenCaptured = useCallback(async (token: string) => {
    await savePlayerSearchToken(token);
    setTokenModalVisible(false);
    await handleRefresh();
  }, [handleRefresh]);

  const handleTokenError = useCallback(() => {
    setTokenModalVisible(false);
  }, []);

  useEffect(() => {
    if (profileQuery.isError && isTurnstileRequiredError(profileQuery.error)) {
      setTokenModalVisible(true);
    }
  }, [profileQuery.error, profileQuery.isError]);

  if (!playerAccountId) {
    return (
      <KeyboardAvoidingView
        style={[styles.unboundContainer, { backgroundColor: Colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.unboundContent,
            {
              paddingTop: Math.max(insets.top + 16, 24),
              paddingBottom: Math.max(insets.bottom + 24, 36),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="always"
        >
          <AccountBindingPanel />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (profileQuery.isLoading && !profileQuery.data) {
    return (
      <PlayerProfileSkeleton showCompactHeaderPlaceholder />
    );
  }

  if (profileQuery.isError && !profileQuery.data) {
    const turnstileError = isTurnstileRequiredError(profileQuery.error);
    if (turnstileError) {
      return (
        <>
          <PlayerProfileSkeleton showCompactHeaderPlaceholder />
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
          <AlertTriangle size={44} color={Colors.statOrange} />
          <Text style={styles.errorTitle}>{t.failedToLoad}</Text>
          <Text style={styles.errorMessage}>
            {(profileQuery.error as Error).message}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
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
    return <PlayerProfileSkeleton showCompactHeaderPlaceholder />;
  }

  return (
    <PlayerProfileView
      profile={profileQuery.data}
      enableCollapsibleHeader
      itemDetailPathname="/(tabs)/(home)/item/[id]"
      headerRight={
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={handleRefresh}
          testID="refresh-button"
          activeOpacity={0.7}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <RefreshCw size={20} color={Colors.gold} />
          </Animated.View>
        </TouchableOpacity>
      }
    />
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
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: alphaWhite(0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  unboundContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
  },
  unboundContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
    alignItems: 'center',
  },
});
