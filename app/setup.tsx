import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { ExternalLink, User } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { fetchPlayerProfile } from '@/services/tarkovApi';

export default function SetupScreen() {
  const { savePlayer } = useAuth();
  const { t } = useLanguage();
  const [accountIdInput, setAccountIdInput] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const extractAccountId = useCallback((value: string) => {
    const match = value.match(/\/players\/(?:regular|pve)\/(\d+)/i);
    return match?.[1] ?? '';
  }, []);

  const handleOpenPlayers = useCallback(async () => {
    const url = 'https://tarkov.dev/players?gameMode=regular';
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch (error) {
      console.log('[Setup] Failed to open browser:', error);
      Linking.openURL(url).catch((linkError) => {
        console.log('[Setup] Failed to open URL:', linkError);
      });
    }
  }, []);

  const handleLink = useCallback(async () => {
    const trimmed = accountIdInput.trim();
    if (!trimmed) return;
    Keyboard.dismiss();

    const extracted = extractAccountId(trimmed);
    const accountId = extracted || trimmed;

    if (!/^\d+$/.test(accountId)) {
      setErrorMessage(t.setupInvalidAccountId);
      return;
    }

    try {
      setIsLinking(true);
      setErrorMessage('');
      const profile = await fetchPlayerProfile(accountId);
      await savePlayer(profile.info.nickname, accountId);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsLinking(false);
    }
  }, [accountIdInput, extractAccountId, savePlayer, t]);

  const handleClear = useCallback(() => {
    setAccountIdInput('');
    setErrorMessage('');
  }, []);

  const handleAccountIdChange = useCallback((value: string) => {
    const extracted = extractAccountId(value);
    setAccountIdInput(extracted || value);
    if (errorMessage) {
      setErrorMessage('');
    }
  }, [errorMessage, extractAccountId]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0F0E0A', '#1A1812', '#15140F', '#0F0E0A']}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <User size={36} color={Colors.gold} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>{t.setupTitle}</Text>
          <Text style={styles.subtitle}>{t.setupSubtitle}</Text>
          <TouchableOpacity style={styles.linkButton} onPress={handleOpenPlayers} activeOpacity={0.8}>
            <ExternalLink size={16} color={Colors.textSecondary} />
            <Text style={styles.linkText}>{t.setupOpenPlayers}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchSection}>
          <Text style={styles.label}>{t.setupAccountIdLabel}</Text>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <TextInput
                style={styles.searchInput}
                placeholder={t.setupAccountIdPlaceholder}
                placeholderTextColor={Colors.textTertiary}
                value={accountIdInput}
                onChangeText={handleAccountIdChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLink}
                testID="setup-accountid-input"
              />
              {accountIdInput.length > 0 && (
                <TouchableOpacity onPress={handleClear}>
                  <Text style={styles.clearText}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={styles.hint}>{t.setupAccountIdHint}</Text>

          <TouchableOpacity
            style={[styles.searchButton, (!accountIdInput.trim() || isLinking) && styles.searchButtonDisabled]}
            onPress={handleLink}
            disabled={!accountIdInput.trim() || isLinking}
            activeOpacity={0.8}
            testID="setup-link-button"
          >
            {isLinking ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#1A1A14" size="small" />
                <Text style={styles.searchButtonText}>{t.setupFetchingProfile}</Text>
              </View>
            ) : (
              <Text style={styles.searchButtonText}>{t.setupLinkButton}</Text>
            )}
          </TouchableOpacity>

          {!!errorMessage && (
            <Text style={styles.errorText}>{errorMessage}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0E0A',
  },
  content: {
    flex: 1,
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(217,191,115,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  linkText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  searchSection: {
    paddingHorizontal: 24,
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    gap: 10,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    height: 48,
  },
  clearText: {
    fontSize: 18,
    color: Colors.textTertiary,
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  searchButton: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1A1A14',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 12,
    color: Colors.statRed,
  },
});
