import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import {
  DEFAULT_GAME_MODE,
  GameMode,
  normalizeGameMode,
  SUPPORTED_GAME_MODES,
} from '@/constants/gameMode';
import { applyGameModePalette } from '@/constants/colors';
import { setApiGameMode } from '@/services/tarkovApi';

const GAME_MODE_KEY = 'tarkov_game_mode';

export const [GameModeProvider, useGameMode] = createContextHook(() => {
  const [gameMode, setGameModeState] = useState<GameMode>(DEFAULT_GAME_MODE);
  const [isLoadingGameMode, setIsLoadingGameMode] = useState<boolean>(true);

  useEffect(() => {
    let isActive = true;
    setApiGameMode(DEFAULT_GAME_MODE);
    applyGameModePalette(DEFAULT_GAME_MODE);
    AsyncStorage.getItem(GAME_MODE_KEY)
      .then((stored) => {
        if (!isActive) return;
        const normalized = normalizeGameMode(stored);
        setGameModeState(normalized);
        setApiGameMode(normalized);
        applyGameModePalette(normalized);
      })
      .catch((error) => {
        console.log('[GameMode] Failed to load game mode:', error);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingGameMode(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, []);

  const updateGameMode = useCallback(async (next: GameMode) => {
    const normalized = normalizeGameMode(next);
    setGameModeState(normalized);
    setApiGameMode(normalized);
    applyGameModePalette(normalized);
    await AsyncStorage.setItem(GAME_MODE_KEY, normalized);
  }, []);

  const toggleGameMode = useCallback(async () => {
    const index = SUPPORTED_GAME_MODES.indexOf(gameMode);
    const next = SUPPORTED_GAME_MODES[(index + 1) % SUPPORTED_GAME_MODES.length];
    await updateGameMode(next);
  }, [gameMode, updateGameMode]);

  const nextGameMode = SUPPORTED_GAME_MODES[
    (SUPPORTED_GAME_MODES.indexOf(gameMode) + 1) % SUPPORTED_GAME_MODES.length
  ];

  return {
    gameMode,
    isLoadingGameMode,
    nextGameMode,
    setGameMode: updateGameMode,
    toggleGameMode,
  };
});
