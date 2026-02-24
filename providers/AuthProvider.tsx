import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';

const PLAYER_NAME_KEY = 'tarkov_player_name';
const PLAYER_ACCOUNT_ID_KEY = 'tarkov_player_account_id';
const IS_SIGNED_IN_KEY = 'tarkov_signed_in';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [playerAccountId, setPlayerAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const storedAuthQuery = useQuery({
    queryKey: ['auth-stored'],
    queryFn: async () => {
      console.log('[Auth] Loading stored auth...');
      const [signedIn, name, accountId] = await Promise.all([
        AsyncStorage.getItem(IS_SIGNED_IN_KEY),
        AsyncStorage.getItem(PLAYER_NAME_KEY),
        AsyncStorage.getItem(PLAYER_ACCOUNT_ID_KEY),
      ]);
      return {
        isSignedIn: signedIn === 'true',
        playerName: name,
        playerAccountId: accountId,
      };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (storedAuthQuery.data) {
      console.log('[Auth] Loaded stored auth:', storedAuthQuery.data);
      setIsSignedIn(storedAuthQuery.data.isSignedIn);
      setPlayerName(storedAuthQuery.data.playerName);
      setPlayerAccountId(storedAuthQuery.data.playerAccountId);
      setIsLoading(false);
    }
  }, [storedAuthQuery.data]);

  const continueAsGuest = useCallback(async () => {
    console.log('[Auth] Continuing as guest');
    await AsyncStorage.setItem(IS_SIGNED_IN_KEY, 'true');
    setIsSignedIn(true);
  }, []);

  const savePlayer = useCallback(async (name: string, accountId: string) => {
    console.log('[Auth] Saving player:', name, accountId);
    await Promise.all([
      AsyncStorage.setItem(PLAYER_NAME_KEY, name),
      AsyncStorage.setItem(PLAYER_ACCOUNT_ID_KEY, accountId),
    ]);
    setPlayerName(name);
    setPlayerAccountId(accountId);
  }, []);

  const signOut = useCallback(async () => {
    console.log('[Auth] Signing out');
    await Promise.all([
      AsyncStorage.removeItem(IS_SIGNED_IN_KEY),
      AsyncStorage.removeItem(PLAYER_NAME_KEY),
      AsyncStorage.removeItem(PLAYER_ACCOUNT_ID_KEY),
    ]);
    setIsSignedIn(false);
    setPlayerName(null);
    setPlayerAccountId(null);
  }, []);

  return {
    isSignedIn,
    playerName,
    playerAccountId,
    isLoading,
    continueAsGuest,
    savePlayer,
    signOut,
  };
});
