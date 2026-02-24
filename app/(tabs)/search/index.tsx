import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Search, X, User, ChevronRight, UserX, Crosshair, BarChart3, Star } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { searchPlayers, isIndexCached, isIndexLoading, getIndexLoadProgress, preloadIndex } from '@/services/tarkovApi';
import { SearchResult } from '@/types/tarkov';

export default function SearchScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState<string>('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [preloading, setPreloading] = useState<boolean>(!isIndexCached() && !isIndexLoading());

  useEffect(() => {
    preloadIndex();
    const interval = setInterval(() => {
      const progress = getIndexLoadProgress();
      setLoadingMessage(progress);
      if (isIndexCached()) {
        setPreloading(false);
        clearInterval(interval);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      if (!isIndexCached()) {
        const interval = setInterval(() => {
          setLoadingMessage(getIndexLoadProgress());
        }, 500);
        try {
          const res = await searchPlayers(query);
          return res;
        } finally {
          clearInterval(interval);
          setLoadingMessage('');
        }
      }
      return await searchPlayers(query);
    },
    onSuccess: (data) => {
      setResults(data);
      setHasSearched(true);
    },
    onError: (error) => {
      console.log('[Search] Error:', error.message);
      setHasSearched(true);
    },
  });

  const handleSearch = useCallback(() => {
    const query = searchText.trim();
    if (!query) return;
    Keyboard.dismiss();

    if (/^\d+$/.test(query)) {
      router.push({ pathname: '/search/player' as never, params: { accountId: query } });
    } else {
      searchMutation.reset();
      searchMutation.mutate(query);
    }
  }, [searchText, router, searchMutation.mutate, searchMutation.reset]);

  const handleClear = useCallback(() => {
    setSearchText('');
    setResults([]);
    setHasSearched(false);
  }, []);

  const handleSelectPlayer = useCallback((result: SearchResult) => {
    router.push({ pathname: '/search/player' as never, params: { accountId: result.id } });
  }, [router]);

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
      <View style={styles.headerWrap}>
        <LinearGradient
          colors={['#262622', '#141410']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.headerDecor}>
          <Crosshair size={120} color="rgba(255,255,255,0.03)" strokeWidth={1} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerSubtitle}>ESCAPE FROM TARKOV</Text>
          <Text style={styles.headerTitle}>Player Lookup</Text>
        </View>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Search size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Player name or Account ID"
              placeholderTextColor={Colors.textTertiary}
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              testID="search-input"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <X size={18} color={Colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleSearch} style={styles.searchActionButton} activeOpacity={0.7}>
            <ChevronRight size={22} color={Colors.gold} />
          </TouchableOpacity>
        </View>

        {searchMutation.isError && (
          <Text style={styles.errorText}>{(searchMutation.error as Error).message}</Text>
        )}
      </View>

      {searchMutation.isPending && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.gold} />
          {!isIndexCached() && (
            <View style={styles.loadingTextWrap}>
              <Text style={styles.loadingTitle}>{loadingMessage || 'Downloading player database...'}</Text>
              <Text style={styles.loadingSubtitle}>First search may take 10-30s due to database size (~66MB).{"\n"}Subsequent searches will be instant.</Text>
            </View>
          )}
        </View>
      )}

      {hasSearched && results.length === 0 && !searchMutation.isPending && (
        <View style={styles.emptyState}>
          <UserX size={36} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No players found</Text>
          <Text style={styles.emptySubtitle}>Try a different name or enter an Account ID directly</Text>
        </View>
      )}

      {results.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.resultsCount}>{results.length} results</Text>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={renderResult}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            style={styles.resultsList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {!hasSearched && !searchMutation.isPending && results.length === 0 && (
        <View style={styles.placeholderSection}>
          {preloading && !isIndexCached() ? (
            <>
              <ActivityIndicator size="large" color={Colors.gold} />
              <Text style={styles.placeholderTitle}>{loadingMessage || 'Loading player database...'}</Text>
              <Text style={styles.placeholderSubtitle}>
                Downloading ~66MB database in background.{'\n'}You can search once it finishes.
              </Text>
            </>
          ) : (
            <>
              <Search size={44} color={Colors.goldDim} />
              <Text style={styles.placeholderTitle}>Search for a player</Text>
              <Text style={styles.placeholderSubtitle}>
                {isIndexCached()
                  ? 'Database loaded! Enter a player name to search.'
                  : 'Enter a player name to search the database,\nor enter an Account ID to view directly.'}
              </Text>
            </>
          )}
          <View style={styles.hintRow}>
            <View style={styles.hintCard}>
              <Crosshair size={20} color={Colors.goldDim} />
              <Text style={styles.hintLabel}>K/D Ratio</Text>
            </View>
            <View style={styles.hintCard}>
              <BarChart3 size={20} color={Colors.goldDim} />
              <Text style={styles.hintLabel}>Survival Rate</Text>
            </View>
            <View style={styles.hintCard}>
              <Star size={20} color={Colors.goldDim} />
              <Text style={styles.hintLabel}>Skills</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerWrap: {
    height: 200,
    position: 'relative',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  headerDecor: {
    position: 'absolute',
    top: 20,
    right: -20,
    transform: [{ rotate: '-15deg' }],
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.gold,
    letterSpacing: 2,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
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
  searchActionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 12,
    color: Colors.statRed,
  },
  loadingWrap: {
    paddingTop: 48,
    alignItems: 'center',
    gap: 16,
  },
  loadingTextWrap: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 6,
  },
  loadingTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  loadingSubtitle: {
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 48,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  resultsSection: {
    flex: 1,
    paddingTop: 16,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  resultsList: {
    marginHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    marginLeft: 70,
  },
  placeholderSection: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 56,
    paddingHorizontal: 32,
  },
  placeholderTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  placeholderSubtitle: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  hintRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  hintCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  hintLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: Colors.textTertiary,
  },
});
