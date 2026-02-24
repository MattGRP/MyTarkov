import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { Search, X, User, ChevronRight, UserX } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { searchPlayers } from '@/services/tarkovApi';
import { SearchResult } from '@/types/tarkov';

export default function SetupScreen() {
  const { savePlayer, defaultSearchName, saveDefaultSearchName } = useAuth();
  const { t } = useLanguage();
  const [nameInput, setNameInput] = useState<string>(defaultSearchName);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await searchPlayers(query);
      return res;
    },
    onSuccess: (data) => {
      setResults(data);
      setHasSearched(true);
    },
  });

  const handleSearch = useCallback(() => {
    const query = nameInput.trim();
    if (!query) return;
    Keyboard.dismiss();
    saveDefaultSearchName(query);
    searchMutation.mutate(query);
  }, [nameInput, searchMutation, saveDefaultSearchName]);

  const handleSelectPlayer = useCallback(async (result: SearchResult) => {
    console.log('[Setup] Selected player:', result.name, result.id);
    await savePlayer(result.name, result.id);
  }, [savePlayer]);

  const handleClear = useCallback(() => {
    setNameInput('');
    setResults([]);
    setHasSearched(false);
  }, []);

  const renderResult = useCallback(({ item }: { item: SearchResult }) => (
    <TouchableOpacity
      style={styles.resultRow}
      onPress={() => handleSelectPlayer(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultAvatar}>
        <User size={16} color={Colors.gold} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.name}</Text>
        <Text style={styles.resultId}>ID: {item.id}</Text>
      </View>
      <ChevronRight size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  ), [handleSelectPlayer]);

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
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputWrap}>
              <Search size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder={t.setupPlaceholder}
                placeholderTextColor={Colors.textTertiary}
                value={nameInput}
                onChangeText={setNameInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
                testID="setup-search-input"
              />
              {nameInput.length > 0 && (
                <TouchableOpacity onPress={handleClear}>
                  <X size={18} color={Colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.searchButton, (!nameInput.trim() || searchMutation.isPending) && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={!nameInput.trim() || searchMutation.isPending}
            activeOpacity={0.8}
            testID="setup-search-button"
          >
            {searchMutation.isPending ? (
              <ActivityIndicator color="#1A1A14" size="small" />
            ) : (
              <Text style={styles.searchButtonText}>{t.setupSearchButton}</Text>
            )}
          </TouchableOpacity>

          {searchMutation.isError && (
            <Text style={styles.errorText}>{(searchMutation.error as Error).message}</Text>
          )}
        </View>

        {hasSearched && results.length === 0 && !searchMutation.isPending && (
          <View style={styles.emptyState}>
            <UserX size={32} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>{t.setupNoPlayers}</Text>
          </View>
        )}

        {results.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsLabel}>{t.setupSelectPlayer}</Text>
            <View style={styles.resultsCard}>
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={renderResult}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          </View>
        )}
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
  searchSection: {
    paddingHorizontal: 24,
    gap: 12,
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
  errorText: {
    fontSize: 12,
    color: Colors.statRed,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 48,
  },
  emptyTitle: {
    fontSize: 15,
    color: Colors.textTertiary,
  },
  resultsSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
    marginBottom: 10,
  },
  resultsCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },
  resultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#FFFFFF',
  },
  resultId: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 66,
  },
});
