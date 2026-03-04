import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import TurnstileTokenModal from '@/components/TurnstileTokenModal';
import { useGameMode } from '@/providers/GameModeProvider';
import {
  getPlayerSearchToken,
  getPlayerSearchTokenUpdatedAt,
  savePlayerSearchToken,
  warmupPlayerSearch,
} from '@/services/tarkovApi';
import { logInfo, logWarn } from '@/utils/debugLog';

const TOKEN_MISSING_CHECK_INTERVAL_MS = 6 * 60 * 1000;
const TOKEN_REFRESH_RETRY_BASE_DELAY_MS = 45 * 1000;
const TOKEN_REFRESH_RETRY_MAX_DELAY_MS = 8 * 60 * 1000;
const MIN_REFRESH_GAP_MS = 2 * 60 * 1000;

type RefreshReason = 'startup' | 'resume' | 'retry' | 'missing-check';

export default function PlayerSearchTokenBootstrap() {
  const isIos = Platform.OS === 'ios';
  const { gameMode } = useGameMode();
  const [visible, setVisible] = useState(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isRefreshingRef = useRef(false);
  const lastRefreshStartAtRef = useRef(0);
  const lastRefreshSuccessAtRef = useRef(0);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetryTimer = useCallback(() => {
    if (!retryTimerRef.current) return;
    clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }, []);

  const scheduleRetry = useCallback(() => {
    if (!isIos) return;
    clearRetryTimer();
    const attempt = retryAttemptRef.current + 1;
    retryAttemptRef.current = attempt;
    const delay = Math.min(
      TOKEN_REFRESH_RETRY_MAX_DELAY_MS,
      TOKEN_REFRESH_RETRY_BASE_DELAY_MS * Math.max(1, 2 ** (attempt - 1)),
    );
    logWarn('TokenBootstrap', 'Scheduling retry refresh', { attempt, delayMs: delay });
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      if (appStateRef.current !== 'active') return;
      if (isRefreshingRef.current) return;
      logInfo('TokenBootstrap', 'Retry refresh triggered', { attempt });
      setVisible(true);
      isRefreshingRef.current = true;
      lastRefreshStartAtRef.current = Date.now();
    }, delay);
  }, [clearRetryTimer, isIos]);

  const startRefresh = useCallback((reason: RefreshReason, force = false) => {
    if (!isIos) return;
    if (gameMode !== 'pve') return;
    if (appStateRef.current !== 'active') return;
    if (isRefreshingRef.current) return;
    const now = Date.now();
    if (!force && now - lastRefreshStartAtRef.current < MIN_REFRESH_GAP_MS) return;
    clearRetryTimer();
    logInfo('TokenBootstrap', 'Starting token refresh', { reason, force });
    setVisible(true);
    isRefreshingRef.current = true;
    lastRefreshStartAtRef.current = now;
  }, [clearRetryTimer, gameMode, isIos]);

  const finishRefresh = useCallback(() => {
    logInfo('TokenBootstrap', 'Token refresh finished');
    isRefreshingRef.current = false;
    setVisible(false);
  }, []);

  const handleTokenCaptured = useCallback(async (token: string) => {
    await savePlayerSearchToken(token);
    logInfo('TokenBootstrap', 'Token captured and saved', { length: token.length });
    retryAttemptRef.current = 0;
    void warmupPlayerSearch(true, { gameMode });
    lastRefreshSuccessAtRef.current = Date.now();
    finishRefresh();
  }, [finishRefresh, gameMode]);

  const handleTokenError = useCallback(async () => {
    logWarn('TokenBootstrap', 'Token refresh error');
    finishRefresh();
    const token = await getPlayerSearchToken();
    if (!token) {
      scheduleRetry();
      return;
    }
    retryAttemptRef.current = 0;
  }, [finishRefresh, scheduleRetry]);

  const startRefreshIfMissingToken = useCallback(async (reason: RefreshReason, force = false) => {
    if (!isIos) return;
    if (gameMode !== 'pve') return;
    const token = await getPlayerSearchToken();
    if (token) {
      retryAttemptRef.current = 0;
      if (reason === 'startup') {
        logInfo('TokenBootstrap', 'Token exists, skip refresh');
      }
      return;
    }
    startRefresh(reason, force);
  }, [gameMode, isIos, startRefresh]);

  useEffect(() => {
    if (!isIos) return;
    if (gameMode !== 'pve') {
      clearRetryTimer();
      retryAttemptRef.current = 0;
      isRefreshingRef.current = false;
      setVisible(false);
      return;
    }

    let mounted = true;

    (async () => {
      const [token, updatedAt] = await Promise.all([
        getPlayerSearchToken(),
        getPlayerSearchTokenUpdatedAt(),
      ]);
      if (!mounted) return;

      if (updatedAt) {
        lastRefreshSuccessAtRef.current = updatedAt;
      }

      if (!token) {
        await startRefreshIfMissingToken('startup', true);
      } else {
        retryAttemptRef.current = 0;
        logInfo('TokenBootstrap', 'Token already available on startup', {
          updatedAt: updatedAt ?? null,
        });
        void warmupPlayerSearch(true, { gameMode });
      }
    })();

    const interval = setInterval(() => {
      if (appStateRef.current !== 'active' || isRefreshingRef.current) return;
      void startRefreshIfMissingToken('missing-check');
    }, TOKEN_MISSING_CHECK_INTERVAL_MS);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      if (prevState.match(/inactive|background/) && nextState === 'active') {
        void startRefreshIfMissingToken('resume');
      }
    });

    return () => {
      mounted = false;
      clearRetryTimer();
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [clearRetryTimer, gameMode, isIos, startRefreshIfMissingToken]);

  if (!isIos) {
    return null;
  }

  if (gameMode !== 'pve') {
    return null;
  }

  return (
    <TurnstileTokenModal
      visible={visible}
      onClose={finishRefresh}
      onTokenCaptured={handleTokenCaptured}
      onError={handleTokenError}
      searchName="player"
      gameMode={gameMode}
      silent
      timeoutMs={60_000}
    />
  );
}
