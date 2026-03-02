import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import TurnstileTokenWebViewModal from '@/components/TurnstileTokenWebViewModal';
import TurnstileTokenGeckoModal from '@/components/TurnstileTokenGeckoModal';
import { ANDROID_TURNSTILE_ENGINE } from '@/constants/turnstile';
import { TurnstileTokenModalProps } from '@/components/TurnstileTokenModal.types';
import { logWarn } from '@/utils/debugLog';

export type { TurnstileTokenModalProps } from '@/components/TurnstileTokenModal.types';

export default function TurnstileTokenModal(props: TurnstileTokenModalProps) {
  const preferredEngine = useMemo(
    () => (Platform.OS === 'android' && ANDROID_TURNSTILE_ENGINE === 'gecko' ? 'gecko' : 'webview'),
    [],
  );
  const [activeEngine, setActiveEngine] = useState<'gecko' | 'webview'>(preferredEngine);

  useEffect(() => {
    if (!props.visible) {
      setActiveEngine(preferredEngine);
    }
  }, [preferredEngine, props.visible]);

  const handleGeckoError = useCallback(
    (message: string) => {
      logWarn('TurnstileGecko', 'Switching to WebView fallback', { message });
      setActiveEngine('webview');
    },
    [],
  );

  if (activeEngine === 'gecko') {
    return <TurnstileTokenGeckoModal {...props} onClose={undefined} onError={handleGeckoError} />;
  }

  return <TurnstileTokenWebViewModal {...props} />;
}
