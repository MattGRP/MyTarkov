import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { alphaBlack } from '@/constants/colors';
import { GameMode, normalizeGameMode } from '@/constants/gameMode';
import { logInfo, logWarn } from '@/utils/debugLog';

interface TurnstileTokenWebViewModalProps {
  visible: boolean;
  onClose?: () => void;
  onTokenCaptured: (token: string) => void;
  onError?: (message: string) => void;
  searchName?: string;
  silent?: boolean;
  timeoutMs?: number;
  gameMode?: GameMode;
}

type TokenEngineMode = 'players' | 'standalone';

interface TokenEngineStep {
  id: string;
  mode: TokenEngineMode;
  timeoutMs: number;
  sourceBase: string;
}

const PLAYER_PAGE_URL_BASE = 'https://tarkov.dev/players';
const HOME_PAGE_URL = 'https://tarkov.dev/';
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_SEARCH_QUERY = 'player';
const TOKEN_WEBVIEW_USER_AGENT = Platform.select({
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  default: undefined,
});

function buildPlayersUrl(gameMode: GameMode): string {
  return `${PLAYER_PAGE_URL_BASE}?gameMode=${encodeURIComponent(normalizeGameMode(gameMode))}`;
}

function buildEnginePlan(timeoutMs: number, playersUrl: string): TokenEngineStep[] {
  if (Platform.OS !== 'android') {
    return [
      {
        id: 'players-ios',
        mode: 'players',
        timeoutMs,
        sourceBase: playersUrl,
      },
    ];
  }
  return [
    {
      id: 'players-offscreen',
      mode: 'players',
      timeoutMs: Math.min(timeoutMs, 24_000),
      sourceBase: playersUrl,
    },
    {
      id: 'home-offscreen',
      mode: 'standalone',
      timeoutMs: Math.min(timeoutMs, 18_000),
      sourceBase: HOME_PAGE_URL,
    },
    {
      id: 'players-retry',
      mode: 'players',
      timeoutMs: Math.min(timeoutMs, 20_000),
      sourceBase: playersUrl,
    },
  ];
}

function buildInjectedScript(searchName?: string, mode: TokenEngineMode = 'players'): string {
  const requested = (searchName ?? '').trim();
  const targetSearch = JSON.stringify(requested || DEFAULT_SEARCH_QUERY);
  const engineMode = JSON.stringify(mode);
  return `
  (function () {
    if (window.__MY_TARKOV_TOKEN_CAPTURE__) {
      return true;
    }
    window.__MY_TARKOV_TOKEN_CAPTURE__ = true;

    var targetQuery = ${targetSearch};
    var engineMode = ${engineMode};
    var siteKey = '0x4AAAAAAAVVIHGZCr2PPwrR';
    var resolved = false;
    var widgetId = null;
    var fallbackWidgetId = null;
    var candidateToken = '';
    var candidateEmitTimer = null;
    var searchTriggered = false;
    var lastSearchAttemptAt = 0;
    var fallbackRendered = false;

    function post(type, payload) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, payload: payload || {} }));
      } catch (error) {}
    }

    function normalizeToken(value) {
      if (!value || typeof value !== 'string') return '';
      return value.trim();
    }

    function isLikelyToken(value) {
      var token = normalizeToken(value);
      return token.length >= 50;
    }

    function emitToken(value, source) {
      var token = normalizeToken(value);
      if (!token || resolved || !isLikelyToken(token)) return;
      resolved = true;
      post('token', {
        token: token,
        source: source || 'unknown',
        length: token.length,
      });
    }

    function rememberToken(value, source) {
      var token = normalizeToken(value);
      if (!token || resolved || !isLikelyToken(token)) return;
      candidateToken = token;
      post('token_candidate', {
        source: source || 'unknown',
        length: token.length,
      });
      if (candidateEmitTimer) {
        clearTimeout(candidateEmitTimer);
      }
      candidateEmitTimer = setTimeout(function () {
        emitCandidateToken(true);
      }, 700);
    }

    function emitCandidateToken(force) {
      if (resolved || !candidateToken) return;
      if (candidateEmitTimer) {
        clearTimeout(candidateEmitTimer);
        candidateEmitTimer = null;
      }
      emitToken(candidateToken, force ? 'candidate-force' : 'candidate');
    }

    function wrapTurnstileOptions(options) {
      if (!options || typeof options !== 'object') return options;
      if (options.__myTokenWrapped) return options;
      var wrapped = Object.assign({}, options);
      wrapped.__myTokenWrapped = true;
      wrapped.appearance = wrapped.appearance || 'interaction-only';
      wrapped.retry = 'auto';
      wrapped['refresh-expired'] = 'auto';
      wrapped['refresh-timeout'] = 'auto';

      var originalCallback = typeof options.callback === 'function' ? options.callback : null;
      wrapped.callback = function () {
        try {
          rememberToken(arguments[0], 'turnstile-callback');
        } catch (error) {}
        if (originalCallback) {
          return originalCallback.apply(this, arguments);
        }
        return undefined;
      };

      var originalError = typeof options['error-callback'] === 'function' ? options['error-callback'] : null;
      wrapped['error-callback'] = function () {
        try {
          post('turnstile_error', { code: String(arguments[0] || '') });
        } catch (error) {}
        if (originalError) {
          return originalError.apply(this, arguments);
        }
        return undefined;
      };

      var originalExpired = typeof options['expired-callback'] === 'function' ? options['expired-callback'] : null;
      wrapped['expired-callback'] = function () {
        try {
          post('turnstile_expired', {});
        } catch (error) {}
        if (originalExpired) {
          return originalExpired.apply(this, arguments);
        }
        return undefined;
      };

      var originalTimeout = typeof options['timeout-callback'] === 'function' ? options['timeout-callback'] : null;
      wrapped['timeout-callback'] = function () {
        try {
          post('turnstile_timeout', {});
        } catch (error) {}
        if (originalTimeout) {
          return originalTimeout.apply(this, arguments);
        }
        return undefined;
      };

      return wrapped;
    }

    function captureTokenFromUrl(rawUrl, source) {
      if (!rawUrl || resolved) return;
      try {
        var parsed = new URL(String(rawUrl), window.location.href);
        if ((parsed.hostname || '').toLowerCase() !== 'player.tarkov.dev') return;
        var path = String(parsed.pathname || '');
        if (path.indexOf('/name/') !== 0 && path.indexOf('/account/') !== 0) return;
        var token = parsed.searchParams.get('token');
        if (token) {
          rememberToken(token, source || 'network-url');
        }
      } catch (error) {}
    }

    function hookFetch() {
      if (typeof window.fetch !== 'function' || window.fetch.__myTokenPatched) return;
      var originalFetch = window.fetch;
      var wrappedFetch = function () {
        var requestUrl = '';
        try {
          var input = arguments[0];
          requestUrl = typeof input === 'string' ? input : (input && input.url ? String(input.url) : '');
          captureTokenFromUrl(requestUrl, 'fetch-request');
        } catch (error) {}

        var result = originalFetch.apply(this, arguments);
        try {
          result.then(function (response) {
            if (!response) return;
            captureTokenFromUrl(response.url || requestUrl, 'fetch-response');
          });
        } catch (error) {}
        return result;
      };
      wrappedFetch.__myTokenPatched = true;
      window.fetch = wrappedFetch;
    }

    function hookXHR() {
      if (!window.XMLHttpRequest || !window.XMLHttpRequest.prototype) return;
      var proto = window.XMLHttpRequest.prototype;
      if (proto.__myTokenPatched) return;
      proto.__myTokenPatched = true;

      var originalOpen = proto.open;
      proto.open = function (method, url) {
        try {
          this.__myTokenUrl = url;
          captureTokenFromUrl(url, 'xhr-open');
        } catch (error) {}
        return originalOpen.apply(this, arguments);
      };

      var originalSend = proto.send;
      proto.send = function () {
        try {
          captureTokenFromUrl(this.__myTokenUrl, 'xhr-send');
        } catch (error) {}
        return originalSend.apply(this, arguments);
      };
    }

    function readTokenFromDom() {
      if (resolved) return;
      try {
        var inputs = document.querySelectorAll('input[name="cf-turnstile-response"]');
        for (var i = 0; i < inputs.length; i += 1) {
          var input = inputs[i];
          var token = input && typeof input.value === 'string' ? input.value.trim() : '';
          if (token) {
            rememberToken(token, 'dom');
            return;
          }
        }
      } catch (error) {}
    }

    function hookDomTokenListeners() {
      if (window.__MY_TARKOV_TOKEN_DOM_HOOKED__) return;
      window.__MY_TARKOV_TOKEN_DOM_HOOKED__ = true;
      try {
        document.addEventListener('input', function (event) {
          var target = event && event.target;
          if (!target || target.name !== 'cf-turnstile-response') return;
          rememberToken(target.value, 'dom-input-event');
        }, true);
        document.addEventListener('change', function (event) {
          var target = event && event.target;
          if (!target || target.name !== 'cf-turnstile-response') return;
          rememberToken(target.value, 'dom-change-event');
        }, true);
      } catch (error) {}

      try {
        var observer = new MutationObserver(function () {
          readTokenFromDom();
        });
        observer.observe(document.documentElement || document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['value'],
        });
      } catch (error) {}
    }

    function ensureTurnstileScript() {
      if (window.turnstile) return;
      if (document.getElementById('__MY_TARKOV_TURNSTILE_SCRIPT__')) return;
      var script = document.createElement('script');
      script.id = '__MY_TARKOV_TURNSTILE_SCRIPT__';
      script.async = true;
      script.defer = true;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.onload = function () {
        post('turnstile_script_loaded', {});
      };
      script.onerror = function () {
        post('error', { message: 'Turnstile script load failed' });
      };
      (document.head || document.documentElement || document.body).appendChild(script);
    }

    function hookTurnstileRender() {
      if (!window.turnstile || window.turnstile.__myRenderPatched) return;
      var originalRender = window.turnstile.render;
      if (typeof originalRender === 'function') {
        window.turnstile.render = function () {
          var args = Array.prototype.slice.call(arguments);
          if (args.length > 1) {
            args[1] = wrapTurnstileOptions(args[1]);
          }
          post('widget_render_call', {
            appearance: args[1] && args[1].appearance ? String(args[1].appearance) : '',
            execution: args[1] && args[1].execution ? String(args[1].execution) : '',
            hasCallback: !!(args[1] && typeof args[1].callback === 'function'),
          });
          var id = originalRender.apply(this, args);
          widgetId = id;
          post('widget_rendered', { widgetId: String(id || '') });
          try {
            if (typeof window.turnstile.getResponse === 'function') {
              rememberToken(window.turnstile.getResponse(id), 'turnstile-getResponse-render');
            }
          } catch (error) {}
          return id;
        };
      }
      window.turnstile.__myRenderPatched = true;
      post('turnstile_ready', {});
    }

    function renderFallbackWidget() {
      if (fallbackRendered || !window.turnstile || typeof window.turnstile.render !== 'function') return;
      fallbackRendered = true;
      try {
        var container = document.getElementById('__MY_TARKOV_FALLBACK_WIDGET__');
        if (!container) {
          container = document.createElement('div');
          container.id = '__MY_TARKOV_FALLBACK_WIDGET__';
          container.style.position = 'fixed';
          container.style.left = '-10000px';
          container.style.top = '0';
          container.style.width = '320px';
          container.style.height = '80px';
          container.style.opacity = '0.02';
          container.style.pointerEvents = 'none';
          container.style.overflow = 'hidden';
          container.style.zIndex = '2147483647';
          (document.body || document.documentElement).appendChild(container);
        }
        fallbackWidgetId = window.turnstile.render(
          container,
          wrapTurnstileOptions({
            sitekey: siteKey,
            appearance: 'interaction-only',
          }),
        );
        post('widget_fallback_rendered', {
          widgetId: fallbackWidgetId === null || fallbackWidgetId === undefined ? '' : String(fallbackWidgetId),
        });
      } catch (error) {
        post('error', { message: 'Fallback widget render failed' });
      }
    }

    function readTokenFromTurnstile() {
      if (resolved || !window.turnstile || typeof window.turnstile.getResponse !== 'function') return;
      try {
        var value = '';
        if (widgetId !== null && widgetId !== undefined && String(widgetId)) {
          value = window.turnstile.getResponse(widgetId);
        } else {
          value = window.turnstile.getResponse();
        }
        if (!value && fallbackWidgetId !== null && fallbackWidgetId !== undefined && String(fallbackWidgetId)) {
          value = window.turnstile.getResponse(fallbackWidgetId);
        }
        if (value) {
          rememberToken(value, 'turnstile-getResponse');
        }
      } catch (error) {}
    }

    function setInputValue(input, value) {
      try {
        var proto = window.HTMLInputElement && window.HTMLInputElement.prototype
          ? window.HTMLInputElement.prototype
          : Object.getPrototypeOf(input);
        var descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor && typeof descriptor.set === 'function') {
          descriptor.set.call(input, value);
        } else {
          input.value = value;
        }
      } catch (error) {
        input.value = value;
      }
    }

    function dispatchInputEvents(input) {
      try {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (error) {}
    }

    function tryTriggerSearch(now) {
      if (resolved || !targetQuery) return;
      if (now - lastSearchAttemptAt < 3500) return;
      lastSearchAttemptAt = now;
      try {
        var input = document.querySelector('input.player-name-search, .player-name-search input, input[type="text"]');
        var button = document.querySelector('button.search-button, .search-button');
        if (!input) return;
        if (typeof input.value === 'string' && input.value !== targetQuery) {
          setInputValue(input, targetQuery);
          dispatchInputEvents(input);
        }
        if (button && !button.disabled) {
          button.click();
          searchTriggered = true;
          post('search_triggered', { query: targetQuery });
          return;
        }
        if (!button) {
          try {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
            post('search_triggered', { query: targetQuery, fallback: 'enter' });
          } catch (error) {}
        } else {
          post('search_waiting', {
            query: targetQuery,
            buttonDisabled: !!button.disabled,
            inputValue: typeof input.value === 'string' ? input.value : '',
          });
        }
      } catch (error) {}
    }

    hookFetch();
    hookXHR();
    hookDomTokenListeners();
    ensureTurnstileScript();
    hookTurnstileRender();
    post('ready', { href: window.location.href, query: targetQuery, engine: engineMode });

    var attempts = 0;
    var timer = setInterval(function () {
      attempts += 1;
      var now = Date.now();
      ensureTurnstileScript();
      hookTurnstileRender();
      if (!resolved && window.turnstile && attempts > (engineMode === 'standalone' ? 2 : 8)) {
        renderFallbackWidget();
      }
      if (engineMode === 'players') {
        tryTriggerSearch(now);
      }
      readTokenFromTurnstile();
      readTokenFromDom();
      emitCandidateToken(false);

      if (resolved || attempts > 260) {
        clearInterval(timer);
        if (!resolved) {
          emitCandidateToken(true);
        }
        if (!resolved) {
          post('timeout', {
            attempts: attempts,
            query: targetQuery,
            stage: widgetId || fallbackWidgetId ? 'no_token_after_widget' : 'widget_unavailable',
            fallbackRendered: fallbackRendered,
            engine: engineMode,
          });
        }
      }
    }, 500);

    return true;
  })();
  true;
  `;
}

export default function TurnstileTokenWebViewModal({
  visible,
  onClose,
  onTokenCaptured,
  onError,
  searchName,
  silent = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  gameMode = 'regular',
}: TurnstileTokenWebViewModalProps) {
  const capturedRef = useRef(false);
  const webViewRef = useRef<WebView | null>(null);
  const [engineIndex, setEngineIndex] = useState(0);
  const [engineEpoch, setEngineEpoch] = useState(0);
  const engineIndexRef = useRef(0);
  const playersUrl = useMemo(
    () => buildPlayersUrl(gameMode),
    [gameMode],
  );
  const enginePlan = useMemo(
    () => buildEnginePlan(timeoutMs, playersUrl),
    [playersUrl, timeoutMs],
  );
  const currentEngine = enginePlan[Math.min(engineIndex, enginePlan.length - 1)];
  const injectedScript = useMemo(
    () => buildInjectedScript(searchName, currentEngine.mode),
    [currentEngine.mode, searchName],
  );
  const sourceUri = useMemo(() => {
    const base = currentEngine.sourceBase;
    if (!visible) return base;
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}mytarkov_bootstrap=${Date.now()}&mytarkov_engine=${encodeURIComponent(
      currentEngine.id,
    )}&mytarkov_epoch=${engineEpoch}`;
  }, [currentEngine.id, currentEngine.sourceBase, engineEpoch, visible]);

  const switchToNextEngine = useCallback(
    (reason: string, payload?: unknown) => {
      if (capturedRef.current) return;
      const currentIdx = engineIndexRef.current;
      const nextIdx = currentIdx + 1;
      const from = enginePlan[currentIdx]?.id ?? currentEngine.id;
      const next = enginePlan[nextIdx];
      if (next) {
        logWarn('Turnstile', 'Switching token engine', {
          reason,
          from,
          to: next.id,
          payload,
        });
        engineIndexRef.current = nextIdx;
        setEngineIndex(nextIdx);
        setEngineEpoch((value) => value + 1);
        return;
      }
      logWarn('Turnstile', 'All token engines failed', {
        reason,
        lastEngine: from,
        payload,
      });
      onError?.('Verification token fetch timed out');
      if (!onError) {
        onClose?.();
      }
    },
    [currentEngine.id, enginePlan, onClose, onError],
  );

  useEffect(() => {
    engineIndexRef.current = engineIndex;
  }, [engineIndex]);

  useEffect(() => {
    if (!visible) {
      capturedRef.current = false;
      engineIndexRef.current = 0;
      setEngineIndex(0);
      return;
    }
    capturedRef.current = false;
    engineIndexRef.current = 0;
    setEngineIndex(0);
    setEngineEpoch((value) => value + 1);
    logInfo('Turnstile', 'Token capture started', {
      searchName: (searchName ?? '').trim() || DEFAULT_SEARCH_QUERY,
      plan: enginePlan.map((item) => item.id),
    });
  }, [enginePlan, searchName, visible]);

  useEffect(() => {
    if (!visible) return;
    logInfo('Turnstile', 'Engine started', {
      engine: currentEngine.id,
      mode: currentEngine.mode,
      timeoutMs: currentEngine.timeoutMs,
    });
    const timer = setTimeout(() => {
      if (capturedRef.current) return;
      switchToNextEngine('engine-timeout', {
        engine: currentEngine.id,
        timeoutMs: currentEngine.timeoutMs,
      });
    }, currentEngine.timeoutMs);
    return () => clearTimeout(timer);
  }, [currentEngine.id, currentEngine.mode, currentEngine.timeoutMs, switchToNextEngine, visible]);

  const handleMessage = useCallback((event: { nativeEvent: { data?: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data ?? '{}') as {
        type?: string;
        payload?: { token?: string; code?: string; message?: string; source?: string; length?: number; query?: string; attempts?: number; stage?: string; fallbackRendered?: boolean; inputValue?: string; buttonDisabled?: boolean };
      };

      if (data.type === 'token' && data.payload?.token) {
        if (capturedRef.current) return;
        capturedRef.current = true;
        logInfo('Turnstile', 'Token captured', {
          source: data.payload?.source || 'unknown',
          length: data.payload?.length || data.payload?.token.length,
        });
        onTokenCaptured(data.payload.token);
        return;
      }

      if (data.type === 'token_candidate') {
        logInfo('Turnstile', 'Token candidate observed', {
          source: data.payload?.source || 'unknown',
          length: data.payload?.length || 0,
        });
        return;
      }

      if (data.type === 'ready') {
        logInfo('Turnstile', 'WebView ready', data.payload);
        return;
      }

      if (
        data.type === 'widget_rendered' ||
        data.type === 'widget_render_call' ||
        data.type === 'turnstile_ready' ||
        data.type === 'turnstile_script_loaded' ||
        data.type === 'widget_execute' ||
        data.type === 'widget_reset' ||
        data.type === 'widget_execute_unavailable' ||
        data.type === 'widget_fallback_rendered' ||
        data.type === 'search_waiting'
      ) {
        logInfo('Turnstile', data.type, data.payload);
        return;
      }

      if (data.type === 'search_triggered') {
        logInfo('Turnstile', 'Auto search triggered', data.payload);
        return;
      }

      if (data.type === 'turnstile_error') {
        logWarn('Turnstile', 'Turnstile runtime error', data.payload);
        return;
      }

      if (data.type === 'turnstile_expired' || data.type === 'turnstile_timeout') {
        logWarn('Turnstile', data.type, data.payload);
        return;
      }

      if (data.type === 'error') {
        logWarn('Turnstile', 'WebView script error', data.payload);
        if (capturedRef.current) return;
        switchToNextEngine('script-error', data.payload || data.type);
        return;
      }

      if (data.type === 'timeout') {
        logWarn('Turnstile', 'WebView timeout', data.payload);
        switchToNextEngine('script-timeout', data.payload || data.type);
      }
    } catch {
      // ignore malformed events
    }
  }, [onTokenCaptured, switchToNextEngine]);

  const handleLoadEnd = useCallback(() => {
    if (!visible) return;
    logInfo('Turnstile', 'WebView load end', {
      engine: currentEngine.id,
      mode: currentEngine.mode,
    });
    webViewRef.current?.injectJavaScript(injectedScript);
  }, [currentEngine.id, currentEngine.mode, injectedScript, visible]);

  const handleWebViewLoadError = useCallback(() => {
    if (capturedRef.current) return;
    logWarn('Turnstile', 'Verification page load failed', {
      engine: currentEngine.id,
    });
    switchToNextEngine('webview-load-error', currentEngine.id);
  }, [currentEngine.id, switchToNextEngine]);

  if (Platform.OS === 'web' || !visible) {
    return null;
  }

  const webViewKey = `${currentEngine.id}:${engineEpoch}`;

  if (!silent) {
    return (
      <View style={styles.debugWrap}>
        <WebView
          key={webViewKey}
          ref={(instance) => {
            webViewRef.current = instance;
          }}
          source={{ uri: sourceUri }}
          onMessage={handleMessage}
          onLoadEnd={handleLoadEnd}
          onError={handleWebViewLoadError}
          onHttpError={handleWebViewLoadError}
          injectedJavaScriptBeforeContentLoaded={injectedScript}
          injectedJavaScript={injectedScript}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          cacheEnabled={false}
          javaScriptCanOpenWindowsAutomatically
          allowsInlineMediaPlayback
          mixedContentMode="always"
          androidLayerType="hardware"
          userAgent={TOKEN_WEBVIEW_USER_AGENT}
          style={styles.debugWebView}
        />
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={styles.offscreenWrap} collapsable={false}>
      <WebView
        key={webViewKey}
        ref={(instance) => {
          webViewRef.current = instance;
        }}
        source={{ uri: sourceUri }}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        onError={handleWebViewLoadError}
        onHttpError={handleWebViewLoadError}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        injectedJavaScript={injectedScript}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled={false}
        javaScriptCanOpenWindowsAutomatically
        allowsInlineMediaPlayback
        mixedContentMode="always"
        androidLayerType="hardware"
        userAgent={TOKEN_WEBVIEW_USER_AGENT}
        style={styles.offscreenWebView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  offscreenWrap: {
    position: 'absolute',
    left: -10000,
    top: -10000,
    width: 420,
    height: 880,
    opacity: 0.01,
    overflow: 'hidden',
  },
  offscreenWebView: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  debugWrap: {
    flex: 1,
    backgroundColor: alphaBlack(1),
  },
  debugWebView: {
    flex: 1,
  },
});
