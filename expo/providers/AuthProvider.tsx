import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { GameMode } from '@/constants/gameMode';
import { logInfo, logWarn } from '@/utils/debugLog';

const PLAYER_NAME_KEY = 'tarkov_player_name';
const PLAYER_ACCOUNT_ID_KEY = 'tarkov_player_account_id';
const PLAYER_NAME_KEY_PREFIX = 'tarkov_player_name';
const PLAYER_ACCOUNT_ID_KEY_PREFIX = 'tarkov_player_account_id';
const IS_SIGNED_IN_KEY = 'tarkov_signed_in';
const DEFAULT_SEARCH_NAME_KEY = 'tarkov_default_search_name';
const MODES: GameMode[] = ['regular', 'pve'];

function getPlayerNameKey(mode: GameMode): string {
  return `${PLAYER_NAME_KEY_PREFIX}_${mode}`;
}

function getPlayerAccountIdKey(mode: GameMode): string {
  return `${PLAYER_ACCOUNT_ID_KEY_PREFIX}_${mode}`;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [playerAccountId, setPlayerAccountId] = useState<string | null>(null);
  const [defaultSearchName, setDefaultSearchName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const storedAuthQuery = useQuery({
    queryKey: ['auth-stored'],
    queryFn: async () => {
      logInfo('Auth', 'Loading stored auth');
      const [signedIn, defaultName, storedName, storedAccountId, regularName, regularAccountId, pveName, pveAccountId] = await Promise.all([
        AsyncStorage.getItem(IS_SIGNED_IN_KEY),
        AsyncStorage.getItem(DEFAULT_SEARCH_NAME_KEY),
        AsyncStorage.getItem(PLAYER_NAME_KEY),
        AsyncStorage.getItem(PLAYER_ACCOUNT_ID_KEY),
        AsyncStorage.getItem(getPlayerNameKey('regular')),
        AsyncStorage.getItem(getPlayerAccountIdKey('regular')),
        AsyncStorage.getItem(getPlayerNameKey('pve')),
        AsyncStorage.getItem(getPlayerAccountIdKey('pve')),
      ]);

      const migratedName = storedName ?? regularName ?? pveName ?? null;
      const migratedAccountId = storedAccountId ?? regularAccountId ?? pveAccountId ?? null;

      const persistPromises: Promise<void>[] = [];
      if (migratedName) {
        if (!storedName) {
          persistPromises.push(AsyncStorage.setItem(PLAYER_NAME_KEY, migratedName));
        }
        if (!regularName) {
          persistPromises.push(AsyncStorage.setItem(getPlayerNameKey('regular'), migratedName));
        }
        if (!pveName) {
          persistPromises.push(AsyncStorage.setItem(getPlayerNameKey('pve'), migratedName));
        }
      }
      if (migratedAccountId) {
        if (!storedAccountId) {
          persistPromises.push(AsyncStorage.setItem(PLAYER_ACCOUNT_ID_KEY, migratedAccountId));
        }
        if (!regularAccountId) {
          persistPromises.push(AsyncStorage.setItem(getPlayerAccountIdKey('regular'), migratedAccountId));
        }
        if (!pveAccountId) {
          persistPromises.push(AsyncStorage.setItem(getPlayerAccountIdKey('pve'), migratedAccountId));
        }
      }
      if (persistPromises.length > 0) {
        await Promise.all(persistPromises);
      }

      return {
        isSignedIn: signedIn === 'true',
        playerName: migratedName,
        playerAccountId: migratedAccountId,
        defaultSearchName: defaultName ?? '',
      };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (storedAuthQuery.data) {
      logInfo('Auth', 'Loaded stored auth', storedAuthQuery.data);
      setIsSignedIn(storedAuthQuery.data.isSignedIn);
      setPlayerName(storedAuthQuery.data.playerName);
      setPlayerAccountId(storedAuthQuery.data.playerAccountId);
      setDefaultSearchName(storedAuthQuery.data.defaultSearchName);
      setIsLoading(false);
    }
  }, [storedAuthQuery.data]);

  const continueAsGuest = useCallback(async () => {
    logInfo('Auth', 'Continuing as guest');
    await AsyncStorage.setItem(IS_SIGNED_IN_KEY, 'true');
    setIsSignedIn(true);
  }, []);

  const savePlayer = useCallback(async (name: string, accountId: string) => {
    logInfo('Auth', 'Saving player', { name, accountId });
    const trimmedName = String(name || '').trim();
    const trimmedAccountId = String(accountId || '').trim();
    await Promise.all([
      AsyncStorage.setItem(PLAYER_NAME_KEY, trimmedName),
      AsyncStorage.setItem(PLAYER_ACCOUNT_ID_KEY, trimmedAccountId),
      ...MODES.map((mode) => AsyncStorage.setItem(getPlayerNameKey(mode), trimmedName)),
      ...MODES.map((mode) => AsyncStorage.setItem(getPlayerAccountIdKey(mode), trimmedAccountId)),
    ]);
    setPlayerName(trimmedName || null);
    setPlayerAccountId(trimmedAccountId || null);
  }, []);

  const clearPlayer = useCallback(async () => {
    logInfo('Auth', 'Clearing linked player');
    await Promise.all([
      AsyncStorage.removeItem(PLAYER_NAME_KEY),
      AsyncStorage.removeItem(PLAYER_ACCOUNT_ID_KEY),
      ...MODES.map((mode) => AsyncStorage.removeItem(getPlayerNameKey(mode))),
      ...MODES.map((mode) => AsyncStorage.removeItem(getPlayerAccountIdKey(mode))),
    ]);
    setPlayerName(null);
    setPlayerAccountId(null);
  }, []);

  const saveDefaultSearchName = useCallback(async (name: string) => {
    if (!defaultSearchName && name.trim()) {
      logInfo('Auth', 'Saving default search name', name);
      await AsyncStorage.setItem(DEFAULT_SEARCH_NAME_KEY, name.trim());
      setDefaultSearchName(name.trim());
    }
  }, [defaultSearchName]);

  const signOut = useCallback(async () => {
    logInfo('Auth', 'Signing out');
    await Promise.all([
      AsyncStorage.removeItem(IS_SIGNED_IN_KEY),
      AsyncStorage.removeItem(PLAYER_NAME_KEY),
      AsyncStorage.removeItem(PLAYER_ACCOUNT_ID_KEY),
      ...MODES.map((mode) => AsyncStorage.removeItem(getPlayerNameKey(mode))),
      ...MODES.map((mode) => AsyncStorage.removeItem(getPlayerAccountIdKey(mode))),
    ]);
    setIsSignedIn(false);
    setPlayerName(null);
    setPlayerAccountId(null);
  }, []);

  return {
    isSignedIn,
    playerName,
    playerAccountId,
    defaultSearchName,
    isLoading,
    continueAsGuest,
    savePlayer,
    clearPlayer,
    saveDefaultSearchName,
    signOut,
  };
});
