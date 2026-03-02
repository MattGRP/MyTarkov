import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, ScrollView, Alert, Modal, Platform, type LayoutChangeEvent } from 'react-native';
import { User } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import Colors from '@/constants/colors';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import {
  fetchPlayerProfile,
  isTurnstileRequiredError,
  savePlayerSearchToken,
  searchPlayers,
} from '@/services/tarkovApi';
import { PlayerProfile, SearchResult } from '@/types/tarkov';
import TurnstileTokenModal from '@/components/TurnstileTokenModal';

interface AccountBindingPanelProps {
  onBound?: () => void;
  onSearchInputFocus?: (offsetYInPanel: number) => void;
}

function extractAccountIdFromUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const value = String(rawUrl);
  const routeMatch =
    value.match(/\/players\/[^/?#]+\/(\d{5,16})(?:[/?#]|$)/i) ??
    value.match(/\/players\/(\d{5,16})(?:[/?#]|$)/i) ??
    value.match(/\/account\/(\d{5,16})(?:[/?#]|$)/i);
  if (routeMatch?.[1]) return routeMatch[1];

  const queryMatch = value.match(/[?&](?:accountId|aid|id)=(\d{5,16})(?:[&#]|$)/i);
  if (queryMatch?.[1]) return queryMatch[1];
  return null;
}

export default function AccountBindingPanel({ onBound, onSearchInputFocus }: AccountBindingPanelProps) {
  const { playerName, playerAccountId, savePlayer, clearPlayer } = useAuth();
  const { language } = useLanguage();
  const isAndroid = Platform.OS === 'android';
  const l = useCallback((zh: string, en: string, ru: string) => {
    if (language === 'zh') return zh;
    if (language === 'ru') return ru;
    return en;
  }, [language]);

  const [playerNameInput, setPlayerNameInput] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [isSearchingName, setIsSearchingName] = useState<boolean>(false);
  const [nameResults, setNameResults] = useState<SearchResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [pendingNameQuery, setPendingNameQuery] = useState('');
  const [isTokenResolving, setIsTokenResolving] = useState(false);
  const [hasRetriedWithFreshToken, setHasRetriedWithFreshToken] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewResult, setPreviewResult] = useState<SearchResult | null>(null);
  const [previewProfile, setPreviewProfile] = useState<PlayerProfile | null>(null);
  const [previewErrorMessage, setPreviewErrorMessage] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [androidWebVisible, setAndroidWebVisible] = useState(false);
  const [isAndroidWebBinding, setIsAndroidWebBinding] = useState(false);
  const [searchInputOffsetY, setSearchInputOffsetY] = useState(0);
  const lastDetectedAccountIdRef = useRef('');
  const webBindPromptingRef = useRef(false);

  const trimmedInput = useMemo(() => playerNameInput.trim(), [playerNameInput]);
  const isRebinding = !!playerAccountId;

  const handleBound = useCallback(() => {
    onBound?.();
  }, [onBound]);

  const closePreview = useCallback(() => {
    setPreviewVisible(false);
    setPreviewResult(null);
    setPreviewProfile(null);
    setPreviewErrorMessage('');
    setIsPreviewLoading(false);
  }, []);

  const handleUnbindPlayer = useCallback(() => {
    if (!playerAccountId) return;
    Alert.alert(
      l('解除绑定', 'Unbind Player', 'Отвязать игрока'),
      l(
        '这会移除当前绑定的玩家。',
        'This removes the linked player from this device.',
        'Это удалит привязанного игрока с этого устройства.',
      ),
      [
        { text: l('取消', 'Cancel', 'Отмена'), style: 'cancel' },
        {
          text: l('解绑', 'Unbind', 'Отвязать'),
          style: 'destructive',
          onPress: async () => {
            await clearPlayer();
            setNameResults([]);
            setErrorMessage('');
            closePreview();
          },
        },
      ],
    );
  }, [clearPlayer, closePreview, l, playerAccountId]);

  const openPlayerPreview = useCallback(async (result: SearchResult) => {
    Keyboard.dismiss();
    setPreviewVisible(true);
    setPreviewResult(result);
    setPreviewProfile(null);
    setPreviewErrorMessage('');
    setIsPreviewLoading(true);
    try {
      const profile = await fetchPlayerProfile(result.id);
      setPreviewProfile(profile);
    } catch (error) {
      setPreviewErrorMessage((error as Error).message);
    } finally {
      setIsPreviewLoading(false);
    }
  }, []);

  const handleConfirmBind = useCallback(async () => {
    if (!previewResult || !previewProfile) return;
    setIsLinking(true);
    setPreviewErrorMessage('');
    try {
      await savePlayer(previewProfile.info.nickname, previewResult.id);
      setNameResults([]);
      setPlayerNameInput(previewProfile.info.nickname);
      closePreview();
      handleBound();
    } catch (error) {
      setPreviewErrorMessage((error as Error).message);
    } finally {
      setIsLinking(false);
    }
  }, [closePreview, handleBound, previewProfile, previewResult, savePlayer]);

  const bindFromAccountId = useCallback(async (accountId: string) => {
    setIsAndroidWebBinding(true);
    setErrorMessage('');
    try {
      const profile = await fetchPlayerProfile(accountId);
      await savePlayer(profile.info.nickname, accountId);
      setPlayerNameInput(profile.info.nickname);
      setNameResults([]);
      setAndroidWebVisible(false);
      handleBound();
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsAndroidWebBinding(false);
      webBindPromptingRef.current = false;
    }
  }, [handleBound, savePlayer]);

  const promptBindFromDetectedAccount = useCallback(async (accountId: string) => {
    if (webBindPromptingRef.current) return;
    webBindPromptingRef.current = true;

    let detectedName = '';
    try {
      const profile = await fetchPlayerProfile(accountId);
      detectedName = profile.info.nickname;
    } catch {
      detectedName = '';
    }

    const message = detectedName
      ? l(
        `检测到账号ID：${accountId}\n玩家：${detectedName}\n确认绑定该账号吗？`,
        `Detected AccountID: ${accountId}\nPlayer: ${detectedName}\nBind this account?`,
        `Обнаружен ID аккаунта: ${accountId}\nИгрок: ${detectedName}\nПривязать этот аккаунт?`,
      )
      : l(
        `检测到账号ID：${accountId}\n确认绑定该账号吗？`,
        `Detected AccountID: ${accountId}\nBind this account?`,
        `Обнаружен ID аккаунта: ${accountId}\nПривязать этот аккаунт?`,
      );

    Alert.alert(
      l('检测到玩家主页', 'Player Profile Detected', 'Обнаружен профиль игрока'),
      message,
      [
        {
          text: l('取消', 'Cancel', 'Отмена'),
          style: 'cancel',
          onPress: () => {
            webBindPromptingRef.current = false;
          },
        },
        {
          text: isRebinding ? l('确认换绑', 'Confirm Rebind', 'Подтвердить смену') : l('确认绑定', 'Confirm Bind', 'Подтвердить привязку'),
          onPress: () => {
            void bindFromAccountId(accountId);
          },
        },
      ],
      {
        cancelable: true,
      },
    );
  }, [bindFromAccountId, isRebinding, l]);

  const handleAndroidWebNavigationChange = useCallback((event: { url?: string }) => {
    if (!isAndroid || !androidWebVisible || webBindPromptingRef.current) return;
    const accountId = extractAccountIdFromUrl(event.url);
    if (!accountId) return;
    if (lastDetectedAccountIdRef.current === accountId) return;
    lastDetectedAccountIdRef.current = accountId;
    void promptBindFromDetectedAccount(accountId);
  }, [androidWebVisible, isAndroid, promptBindFromDetectedAccount]);

  const openAndroidWebBinding = useCallback(() => {
    if (!isAndroid) return;
    webBindPromptingRef.current = false;
    lastDetectedAccountIdRef.current = '';
    setAndroidWebVisible(true);
  }, [isAndroid]);

  const closeAndroidWebBinding = useCallback(() => {
    setAndroidWebVisible(false);
    setIsAndroidWebBinding(false);
    webBindPromptingRef.current = false;
    lastDetectedAccountIdRef.current = '';
  }, []);

  const applyNameSearchResults = useCallback(async (results: SearchResult[]) => {
    if (results.length === 0) {
      setNameResults([]);
      setErrorMessage(
        l(
          '未找到玩家，请尝试更精确的名称。',
          'No player found. Try a more precise name.',
          'Игрок не найден. Попробуйте более точное имя.',
        ),
      );
      return;
    }

    setNameResults(results);
    if (results.length === 1) {
      void openPlayerPreview(results[0]);
    }
  }, [l, openPlayerPreview]);

  const performNameSearch = useCallback(async (nameQuery: string) => {
    setIsSearchingName(true);
    setErrorMessage('');
    try {
      const results = await searchPlayers(nameQuery);
      await applyNameSearchResults(results);
      setHasRetriedWithFreshToken(false);
    } catch (error) {
      if (isTurnstileRequiredError(error)) {
        if (hasRetriedWithFreshToken) {
          setHasRetriedWithFreshToken(false);
          setIsTokenResolving(false);
          setTokenModalVisible(false);
          setPendingNameQuery('');
          setErrorMessage(l('验证失败，请重试。', 'Verification failed. Please try again.', 'Проверка не удалась. Повторите попытку.'));
          return;
        }
        setIsTokenResolving(true);
        setPendingNameQuery(nameQuery);
        setTokenModalVisible(true);
        return;
      }
      setHasRetriedWithFreshToken(false);
      setErrorMessage((error as Error).message);
    } finally {
      setIsSearchingName(false);
    }
  }, [applyNameSearchResults, hasRetriedWithFreshToken, l]);

  const handleSearchByName = useCallback(async () => {
    if (!trimmedInput) return;
    Keyboard.dismiss();
    setErrorMessage('');
    if (isAndroid) {
      if (!/^\d+$/.test(trimmedInput)) {
        setErrorMessage(
          l(
            '安卓仅支持输入数字 AccountID 绑定，或使用下方网页方式。',
            'Android supports numeric AccountID only, or use the web binding below.',
            'На Android поддерживается только числовой ID аккаунта, либо используйте привязку через веб-страницу ниже.',
          ),
        );
        return;
      }
      setIsSearchingName(true);
      try {
        await openPlayerPreview({ id: trimmedInput, name: trimmedInput });
      } finally {
        setIsSearchingName(false);
      }
      return;
    }

    if (trimmedInput.length < 3) {
      setErrorMessage(l('玩家名称至少输入 3 个字符。', 'Player name should be at least 3 characters.', 'Имя игрока должно содержать минимум 3 символа.'));
      return;
    }
    setPendingNameQuery(trimmedInput);
    await performNameSearch(trimmedInput);
  }, [isAndroid, l, openPlayerPreview, performNameSearch, trimmedInput]);

  const handleSelectResult = useCallback((result: SearchResult) => {
    setErrorMessage('');
    void openPlayerPreview(result);
  }, [openPlayerPreview]);

  const handleClear = useCallback(() => {
    setPlayerNameInput('');
    setNameResults([]);
    setErrorMessage('');
    setHasRetriedWithFreshToken(false);
    closePreview();
  }, [closePreview]);

  const handleInputChange = useCallback((value: string) => {
    setPlayerNameInput(value);
    setNameResults([]);
    closePreview();
    if (errorMessage) {
      setErrorMessage('');
    }
  }, [closePreview, errorMessage]);

  const handleInputFocus = useCallback(() => {
    onSearchInputFocus?.(searchInputOffsetY);
  }, [onSearchInputFocus, searchInputOffsetY]);

  const handleSearchInputWrapLayout = useCallback((event: LayoutChangeEvent) => {
    setSearchInputOffsetY(event.nativeEvent.layout.y);
  }, []);

  const handleTokenModalClose = useCallback(() => {
    setTokenModalVisible(false);
    setPendingNameQuery('');
    setIsTokenResolving(false);
    setHasRetriedWithFreshToken(false);
  }, []);

  const handleTokenCaptured = useCallback(async (token: string) => {
    await savePlayerSearchToken(token);
    setTokenModalVisible(false);
    setIsTokenResolving(false);
    const retryQuery = pendingNameQuery.trim();
    setPendingNameQuery('');
    setErrorMessage('');
    if (!retryQuery) return;
    setHasRetriedWithFreshToken(true);
    await performNameSearch(retryQuery);
  }, [pendingNameQuery, performNameSearch]);

  const handleTokenCaptureError = useCallback((message?: string) => {
    setTokenModalVisible(false);
    setIsTokenResolving(false);
    setPendingNameQuery('');
    setHasRetriedWithFreshToken(false);
    setErrorMessage(message || l('验证失败，请重试。', 'Verification failed. Please try again.', 'Проверка не удалась. Повторите попытку.'));
  }, [l]);

  const loading = isLinking || isSearchingName || isTokenResolving || isAndroidWebBinding;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <User size={28} color={Colors.gold} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>
          {isRebinding
            ? l('换绑玩家', 'Rebind Player', 'Сменить привязку')
            : l('绑定玩家', 'Bind Player', 'Привязка игрока')}
        </Text>
        <Text style={styles.subtitle}>
          {isRebinding
            ? l(
              `当前已绑定：${playerName ?? '-'}`,
              `Currently linked: ${playerName ?? '-'}`,
              `Сейчас привязан: ${playerName ?? '-'}`,
            )
            : l(
              isAndroid ? '安卓支持输入 AccountID，或打开网页手动选择玩家主页绑定。' : '输入玩家名称进行绑定。',
              isAndroid ? 'On Android, enter AccountID or open the web page to bind from player profile.' : 'Search by player name to bind.',
              isAndroid ? 'На Android: введите ID аккаунта или откройте веб-страницу и привяжите из профиля игрока.' : 'Введите имя игрока для привязки.',
            )}
        </Text>
      </View>

      <View style={styles.searchSection}>
        {isRebinding && (
          <View style={styles.currentPlayerCard}>
            <Text style={styles.currentPlayerTitle}>{l('已绑定玩家', 'Linked Player', 'Привязанный игрок')}</Text>
            <View style={styles.currentPlayerRow}>
              <Text style={styles.currentPlayerName} numberOfLines={1}>{playerName ?? '-'}</Text>
              <TouchableOpacity style={styles.unbindButton} onPress={handleUnbindPlayer} activeOpacity={0.8}>
                <Text style={styles.unbindButtonText}>{l('解绑', 'Unbind', 'Отвязать')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.label}>{isAndroid ? l('账户ID', 'Account ID', 'ID аккаунта') : l('玩家名称', 'Player Name', 'Имя игрока')}</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap} onLayout={handleSearchInputWrapLayout}>
            <TextInput
              style={styles.searchInput}
              placeholder={isAndroid
                ? l('输入AccountID', 'Enter AccountID', 'Введите ID аккаунта')
                : l('输入玩家名称', 'Enter player name', 'Введите имя игрока')}
              placeholderTextColor={Colors.textTertiary}
              value={playerNameInput}
              onChangeText={handleInputChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              keyboardType={isAndroid ? 'number-pad' : 'default'}
              onSubmitEditing={handleSearchByName}
              onFocus={handleInputFocus}
              testID="account-binding-input"
            />
            {playerNameInput.length > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <Text style={styles.clearText}>{l('清除', 'Clear', 'Очистить')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.hint}>
          {isAndroid
            ? l('请输入数字 AccountID', 'Please enter numeric AccountID', 'Введите числовой ID аккаунта')
            : l('至少输入 3 个字符', 'At least 3 characters', 'Минимум 3 символа')}
        </Text>

        <TouchableOpacity
          style={[styles.searchButton, (!trimmedInput || loading) && styles.searchButtonDisabled]}
          onPress={handleSearchByName}
          disabled={!trimmedInput || loading}
          activeOpacity={0.8}
          testID="account-binding-submit"
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#1A1A14" size="small" />
              <Text style={styles.searchButtonText}>
                {isTokenResolving
                  ? l('正在完成验证...', 'Verifying...', 'Проверка...')
                  : isLinking
                    ? (isRebinding
                      ? l('正在换绑玩家...', 'Rebinding player...', 'Меняем привязку...')
                      : l('正在绑定玩家...', 'Binding player...', 'Привязываем игрока...'))
                    : isAndroidWebBinding
                      ? l('正在绑定账号...', 'Binding account...', 'Привязка аккаунта...')
                    : l('正在搜索玩家...', 'Searching players...', 'Ищем игроков...')}
              </Text>
            </View>
          ) : (
            <Text style={styles.searchButtonText}>
              {isAndroid
                ? (isRebinding
                  ? l('使用ID换绑', 'Rebind by ID', 'Сменить по ID')
                  : l('使用ID绑定', 'Bind by ID', 'Привязать по ID'))
                : (isRebinding
                  ? l('搜索并换绑', 'Search and Rebind', 'Найти и сменить')
                  : l('搜索并绑定', 'Search and Bind', 'Найти и привязать'))}
            </Text>
          )}
        </TouchableOpacity>

        {isAndroid && (
          <TouchableOpacity
            style={[styles.webBindButton, loading && styles.searchButtonDisabled]}
            onPress={openAndroidWebBinding}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.webBindButtonText}>
              {l('打开 Tarkov.dev 玩家页绑定', 'Open Tarkov.dev Players Page', 'Открыть страницу игроков Tarkov.dev')}
            </Text>
          </TouchableOpacity>
        )}

        {!!errorMessage && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}

        {!isAndroid && nameResults.length > 0 && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsTitle}>
              {l(`找到 ${nameResults.length} 个结果`, `${nameResults.length} results`, `${nameResults.length} результатов`)}
            </Text>
            <ScrollView style={styles.resultsList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {nameResults.map((result) => (
                <TouchableOpacity
                  key={`${result.id}-${result.name}`}
                  style={styles.resultRow}
                  onPress={() => handleSelectResult(result)}
                  activeOpacity={0.7}
                >
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{result.name}</Text>
                  </View>
                  <Text style={styles.resultAction}>{l('查看', 'Review', 'Проверить')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <Modal
        visible={isAndroid && androidWebVisible}
        animationType="slide"
        onRequestClose={closeAndroidWebBinding}
      >
        <View style={styles.webModalContainer}>
          <View style={styles.webModalHeader}>
            <Text style={styles.webModalTitle}>
              {l('Tarkov.dev 玩家页面', 'Tarkov.dev Players', 'Страница игроков Tarkov.dev')}
            </Text>
            <TouchableOpacity style={styles.webModalClose} onPress={closeAndroidWebBinding} activeOpacity={0.8}>
              <Text style={styles.webModalCloseText}>{l('关闭', 'Close', 'Закрыть')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.webModalHint}>
            {l(
              '请在页面中搜索并进入你的玩家主页，检测到 AccountID 后会弹窗确认绑定。',
              'Search and open your player profile. A bind confirmation pops up after AccountID is detected.',
              'Найдите и откройте профиль игрока. После обнаружения ID аккаунта появится подтверждение привязки.',
            )}
          </Text>
          <WebView
            source={{ uri: 'https://tarkov.dev/players?gameMode=regular' }}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            onNavigationStateChange={handleAndroidWebNavigationChange}
            style={styles.webModalWebView}
          />
          {isAndroidWebBinding && (
            <View style={styles.webModalLoadingOverlay} pointerEvents="none">
              <ActivityIndicator size="small" color={Colors.gold} />
              <Text style={styles.webModalLoadingText}>
                {l('正在绑定账号...', 'Binding account...', 'Привязка аккаунта...')}
              </Text>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={previewVisible}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>
              {l('确认玩家信息', 'Confirm Player Profile', 'Подтвердите профиль игрока')}
            </Text>

            {isPreviewLoading && (
              <View style={styles.previewLoadingWrap}>
                <ActivityIndicator size="small" color={Colors.gold} />
                <Text style={styles.previewLoadingText}>{l('加载玩家详情中...', 'Loading player details...', 'Загружаем данные игрока...')}</Text>
              </View>
            )}

            {!isPreviewLoading && !!previewErrorMessage && (
              <Text style={styles.previewErrorText}>{previewErrorMessage}</Text>
            )}

            {!isPreviewLoading && !previewErrorMessage && !!previewProfile && !!previewResult && (
              <View style={styles.previewInfoCard}>
                <View style={styles.previewInfoRow}>
                  <Text style={styles.previewInfoLabel}>{l('名称', 'Name', 'Имя')}</Text>
                  <Text style={styles.previewInfoValue}>{previewProfile.info.nickname}</Text>
                </View>
                <View style={styles.previewInfoRow}>
                  <Text style={styles.previewInfoLabel}>{l('阵营', 'Faction', 'Фракция')}</Text>
                  <Text style={styles.previewInfoValue}>{previewProfile.info.side}</Text>
                </View>
                <View style={styles.previewInfoRow}>
                  <Text style={styles.previewInfoLabel}>{l('账户ID', 'Account ID', 'ID аккаунта')}</Text>
                  <Text style={styles.previewInfoValue}>{previewResult.id}</Text>
                </View>
              </View>
            )}

            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.previewCancelButton} onPress={closePreview} activeOpacity={0.8}>
                <Text style={styles.previewCancelText}>{l('取消', 'Cancel', 'Отмена')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewConfirmButton, (!previewProfile || isPreviewLoading || isLinking) && styles.previewConfirmButtonDisabled]}
                onPress={handleConfirmBind}
                activeOpacity={0.8}
                disabled={!previewProfile || isPreviewLoading || isLinking}
              >
                {isLinking ? (
                  <ActivityIndicator size="small" color="#1A1A14" />
                ) : (
                  <Text style={styles.previewConfirmText}>
                    {isRebinding ? l('确认换绑', 'Confirm Rebind', 'Подтвердить смену') : l('确认绑定', 'Confirm Bind', 'Подтвердить привязку')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {!isAndroid && (
        <TurnstileTokenModal
          visible={tokenModalVisible}
          onClose={handleTokenModalClose}
          onTokenCaptured={handleTokenCaptured}
          onError={handleTokenCaptureError}
          searchName={(pendingNameQuery || trimmedInput || 'player').trim()}
          silent
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 760,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    padding: 16,
    gap: 12,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(217,191,115,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  searchSection: {
    gap: 10,
  },
  currentPlayerCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    padding: 12,
    gap: 8,
  },
  currentPlayerTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  currentPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  currentPlayerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  unbindButton: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: Colors.statRed,
    backgroundColor: 'rgba(205,30,47,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unbindButtonText: {
    color: Colors.statRed,
    fontSize: 12,
    fontWeight: '600' as const,
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
    backgroundColor: Colors.surface,
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
    color: Colors.text,
  },
  clearText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  searchButton: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1A1A14',
  },
  webBindButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  webBindButtonText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: Colors.statRed,
    fontSize: 12,
  },
  resultsCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    padding: 10,
    gap: 8,
  },
  resultsTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  resultsList: {
    maxHeight: 220,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  resultHint: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  resultAction: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6,6,5,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  previewCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  previewTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700' as const,
  },
  previewSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  previewLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  previewLoadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  previewErrorText: {
    color: Colors.statRed,
    fontSize: 12,
  },
  previewInfoCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  previewInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewInfoLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  previewInfoValue: {
    flex: 1,
    textAlign: 'right',
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  previewCancelButton: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  previewCancelText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  previewConfirmButton: {
    minWidth: 108,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  previewConfirmButtonDisabled: {
    opacity: 0.6,
  },
  previewConfirmText: {
    color: '#1A1A14',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  webModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  webModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  webModalTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  webModalClose: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  webModalCloseText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  webModalHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
  },
  webModalWebView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  webModalLoadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(10,10,10,0.82)',
  },
  webModalLoadingText: {
    color: Colors.text,
    fontSize: 12,
  },
});
