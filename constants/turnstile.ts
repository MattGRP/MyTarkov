export type AndroidTurnstileEngine = 'gecko' | 'webview';

// Keep this switch centralized for quick rollback.
export const ANDROID_TURNSTILE_ENGINE: AndroidTurnstileEngine = 'webview';
