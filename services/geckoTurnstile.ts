import { NativeModules, Platform } from 'react-native';

interface GeckoTurnstileTokenNativeModule {
  captureToken: (searchName: string, timeoutMs: number) => Promise<string>;
  cancelCapture?: () => void;
}

const nativeModule = NativeModules.GeckoTurnstileToken as GeckoTurnstileTokenNativeModule | undefined;

export async function captureGeckoTurnstileToken(
  searchName: string,
  timeoutMs: number,
): Promise<string> {
  if (Platform.OS !== 'android') {
    throw new Error('Gecko token capture is only available on Android.');
  }
  if (!nativeModule?.captureToken) {
    throw new Error('Gecko token module is not available.');
  }
  return nativeModule.captureToken(searchName, timeoutMs);
}

export function cancelGeckoTurnstileCapture(): void {
  if (Platform.OS !== 'android') return;
  nativeModule?.cancelCapture?.();
}
