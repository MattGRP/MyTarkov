import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { captureGeckoTurnstileToken, cancelGeckoTurnstileCapture } from '@/services/geckoTurnstile';
import { logInfo, logWarn } from '@/utils/debugLog';
import { TurnstileTokenModalProps } from '@/components/TurnstileTokenModal.types';

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_SEARCH_QUERY = 'player';

export default function TurnstileTokenGeckoModal({
  visible,
  onClose,
  onTokenCaptured,
  onError,
  searchName,
  silent = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: TurnstileTokenModalProps) {
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) {
      return;
    }

    const query = (searchName ?? '').trim() || DEFAULT_SEARCH_QUERY;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const effectiveTimeout = Math.max(12_000, Math.min(timeoutMs, 25_000));

    logInfo('TurnstileGecko', 'Token capture started', {
      query,
      timeoutMs: effectiveTimeout,
    });

    let cancelled = false;

    captureGeckoTurnstileToken(query, effectiveTimeout)
      .then((token) => {
        if (cancelled || requestIdRef.current !== requestId) return;
        if (!token || token.length < 50) {
          logWarn('TurnstileGecko', 'Token capture returned invalid token length', {
            length: token?.length ?? 0,
          });
          onError?.('Verification token fetch failed');
          onClose?.();
          return;
        }
        logInfo('TurnstileGecko', 'Token captured', {
          length: token.length,
        });
        onTokenCaptured(token);
      })
      .catch((error: unknown) => {
        if (cancelled || requestIdRef.current !== requestId) return;
        const message =
          typeof error === 'string'
            ? error
            : error instanceof Error
              ? error.message
              : 'Verification token fetch failed';
        logWarn('TurnstileGecko', 'Token capture failed', { message });
        onError?.(message);
        onClose?.();
      });

    return () => {
      cancelled = true;
      cancelGeckoTurnstileCapture();
    };
  }, [onClose, onError, onTokenCaptured, searchName, timeoutMs, visible]);

  if (!visible || Platform.OS !== 'android' || silent) {
    return null;
  }

  return <View pointerEvents="none" style={styles.debugPlaceholder} />;
}

const styles = StyleSheet.create({
  debugPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});
