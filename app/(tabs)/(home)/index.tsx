import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, AlertTriangle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { fetchPlayerProfile } from '@/services/tarkovApi';
import PlayerProfileView from '@/components/PlayerProfileView';

export default function MyProfileScreen() {
  const { playerAccountId, signOut } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const profileQuery = useQuery({
    queryKey: ['profile', playerAccountId],
    queryFn: () => fetchPlayerProfile(playerAccountId!),
    enabled: !!playerAccountId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    gcTime: 0,
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['profile', playerAccountId] });
    setIsRefreshing(false);
  }, [queryClient, playerAccountId]);

  const handleSignOut = useCallback(() => {
    Alert.alert(t.signOutConfirm, t.signOutConfirmMessage, [
      { text: t.cancel, style: 'cancel' },
      { text: t.signOut, style: 'destructive', onPress: signOut },
    ]);
  }, [signOut, t]);

  if (profileQuery.isLoading && !profileQuery.data) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingText}>{t.loadingProfile}</Text>
      </View>
    );
  }

  if (profileQuery.isError && !profileQuery.data) {
    return (
      <View style={styles.centerContainer}>
        <AlertTriangle size={44} color={Colors.statOrange} />
        <Text style={styles.errorTitle}>{t.failedToLoad}</Text>
        <Text style={styles.errorMessage}>{(profileQuery.error as Error).message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryText}>{t.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profileQuery.data) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  return (
    <PlayerProfileView
      profile={profileQuery.data}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      headerRight={
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={handleSignOut}
          testID="sign-out-button"
        >
          <LogOut size={20} color={Colors.gold} />
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
    color: '#1A1A14',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
