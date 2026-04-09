# CLAUDE.md — MyTarkov Codebase Guide

This file is the primary reference for AI assistants working in this repository. Read it before touching any code.

---

## Project Overview

**MyTarkov** is an unofficial Escape From Tarkov mobile companion app built with Expo / React Native. It supports iOS, Android, and Web.

Key capabilities: player profile lookup, item/task/trader/boss/map search, PvP/PvE mode switching, multi-language support (zh/en/ru), and Cloudflare Turnstile-based authentication for player search.

All game data is fetched from external APIs — there is no local database.

---

## Repository Layout

```
MyTarkov/
├── expo/                    # All application code lives here
│   ├── app/                 # Expo Router file-based routes
│   │   ├── _layout.tsx      # Root layout (QueryClient + all Providers)
│   │   ├── (tabs)/          # Bottom tab group
│   │   │   ├── _layout.tsx  # Tab bar definition
│   │   │   ├── (home)/      # Player profile tab
│   │   │   ├── search/      # Search tab (items, players, tasks, traders, bosses, maps)
│   │   │   ├── settings/    # Settings tab
│   │   │   └── tasks/       # Task detail routes
│   │   ├── +not-found.tsx
│   │   └── +native-intent.tsx
│   ├── components/          # Reusable UI components
│   ├── services/
│   │   ├── tarkovApi.ts     # ALL GraphQL queries and caching (~5200 lines)
│   │   └── geckoTurnstile.ts # Turnstile token acquisition via 2captcha
│   ├── types/
│   │   ├── tarkov.ts        # TypeScript interfaces for all game entities (~800 lines)
│   │   └── declarations.d.ts
│   ├── providers/
│   │   ├── AuthProvider.tsx     # Player auth state + AsyncStorage persistence
│   │   ├── GameModeProvider.tsx # PvP/PvE context + storage sync
│   │   └── LanguageProvider.tsx # i18n language context
│   ├── constants/
│   │   ├── colors.ts        # Unified color palette — the only place for color values
│   │   ├── gameMode.ts      # GameMode type enum
│   │   ├── layout.ts        # Shared layout sizing constants
│   │   ├── turnstile.ts     # Turnstile configuration
│   │   └── i18n/            # Internationalization
│   │       ├── index.ts          # Barrel export
│   │       ├── types.ts          # i18n TypeScript types
│   │       ├── translations.ts   # All string translations (zh/en/ru)
│   │       ├── localizers.ts     # Entity name localizers (traders, bosses, categories…)
│   │       └── i18nBossNarratives.ts
│   ├── utils/
│   │   ├── debugLog.ts      # Structured logging (info / warn / error)
│   │   ├── helpers.ts       # Formatting and calculation utilities
│   │   └── tarkovTime.ts    # In-game time calculations
│   ├── docs/
│   │   ├── ENGINEERING_GUIDELINES.md  # Hard rules for loading, fetching, i18n, theme
│   │   └── SESSION_HANDOFF.md         # Architectural decisions and handoff notes
│   ├── assets/images/       # App icons and splash screens
│   ├── .github/workflows/main.yml  # CI: Android APK + iOS IPA builds
│   ├── package.json
│   ├── tsconfig.json
│   ├── app.json             # Expo project config
│   ├── eas.json             # EAS Build profiles
│   ├── babel.config.js
│   ├── metro.config.js
│   └── eslint.config.js
└── rork.json                # Monorepo root config (points to expo/ as the app)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `expo/services/tarkovApi.ts` | Core API layer — ALL queries go here. Handles GraphQL chunking, LRU caching, CORS proxies, Turnstile token injection. Read this before adding any API calls. |
| `expo/types/tarkov.ts` | Source of truth for all TypeScript types. Update types here before updating mapping logic. |
| `expo/constants/colors.ts` | Only place to define colors. Never use hex literals or `rgba()` elsewhere. |
| `expo/constants/i18n/` | All user-facing strings. Never hardcode copy in components. |
| `expo/docs/ENGINEERING_GUIDELINES.md` | Non-negotiable coding standards. Read before implementing any feature. |
| `expo/docs/SESSION_HANDOFF.md` | Context on architectural decisions and open issues. |

---

## Development Setup

**Package manager:** Bun (not npm or yarn)

```bash
# Install dependencies
cd expo && bun install

# Start dev server (tunnel mode via Rork)
bun run start

# Web preview
bun run start-web

# Type check
bunx tsc --noEmit

# Lint
bun run lint

# Build Android APK
eas build -p android --profile preview

# Build Android production AAB
eas build -p android --profile production

# Run on device/emulator
bun run android
bun run ios

# Clear Metro cache (use when UI changes aren't reflecting)
bunx expo start --clear
```

---

## Architecture

### State Management

- **React Query (`@tanstack/react-query`)** — all server/async state
- **React Context** — `AuthProvider`, `GameModeProvider`, `LanguageProvider` via `@nkzw/create-context-hook`
- **Zustand** — lightweight client state where needed
- **AsyncStorage** — persistence for player name, account ID, game mode, Turnstile token

### Routing

File-based routing via Expo Router. Groups in parentheses `(tabs)` organize layout without affecting the URL. Dynamic params use `[id]` brackets.

### Data Flow Pattern

Every page follows the **summary → detail** split:

1. Fetch and render summary (name, image, key tags) immediately.
2. Show skeleton placeholders for detail sections.
3. Fetch detail data asynchronously per section.
4. Replace each placeholder independently as data arrives.

Never block full-page render on non-critical fields.

### Providers Hierarchy (in `app/_layout.tsx`)

```
QueryClientProvider
  └── LanguageProvider
        └── GameModeProvider
              └── AuthProvider
                    └── (screens)
```

---

## Non-Negotiable Rules

These are hard constraints — do not bypass them.

### 1. Loading UI

- **No spinners** (`ActivityIndicator`) for page or section loading.
- Use `ShimmerBlock`-based skeleton placeholders.
- Show structure first; swap in real content section by section.

### 2. API Contract

- **Never guess** upstream API field names or response shapes.
- Before coding any field mapping: validate with a real request to `https://api.tarkov.dev/graphql` and cross-check against `https://github.com/the-hideout/tarkov-dev`.
- When a runtime error occurs: reproduce with a real query, capture the exact payload shape, then patch code.
- Never use `any` as a fallback to suppress mapping errors.

### 3. i18n

- All user-facing strings go through `constants/i18n` — no hardcoded copy in pages or components.
- Import i18n only from `constants/i18n.ts` (the barrel export).
- New translation keys must be added in **all three languages** (`zh`, `en`, `ru`) in the same change.
- Entity localization (trader names, boss names, item categories) goes in `constants/i18n/localizers.ts`.

### 4. Colors and Theme

- All color values come from `constants/colors.ts` — no `#hex` or `rgba()` literals in components.
- PvP/PvE visual differences are expressed via mode theme tokens in `colors.ts`, not per-component forks.

### 5. Request Lifecycle

- Every fetch must support `AbortSignal`.
- Cancel in-flight requests on: screen leave, search condition change, context switch (language/game mode).
- Foreground screen requests take priority over background warmups.

### 6. Query Strategy

- Prefer paginated / chunked requests; never one-shot full-dataset fetches.
- Large datasets: `limit + offset` loops, stop as soon as the target is found.
- List views stay on summary endpoints; detail views use single-item detail endpoints.

### 7. Error Handling

- Do not silently swallow API errors.
- For partial GraphQL data: allow partial render only when explicitly configured; always log GraphQL `errors` for diagnosis.

### 8. Pre-Commit Checklist

Before submitting any change:

- [ ] No spinner-based loading in modified screens
- [ ] Summary-first render path implemented for new pages
- [ ] Detail blocks load independently
- [ ] Request cancellation (`AbortSignal`) wired up
- [ ] Pagination/chunk logic verified for any large-list queries
- [ ] `bunx tsc --noEmit` passes with zero errors
- [ ] `bun run lint` passes
- [ ] New translation keys present in zh/en/ru
- [ ] New colors sourced from `constants/colors.ts`

---

## External Services

| Service | URL | Purpose |
|---------|-----|---------|
| Tarkov GraphQL API | `https://api.tarkov.dev/graphql` | Primary data source (items, tasks, traders, bosses, maps) |
| Player Profile API | `https://player.tarkov.dev` / `https://players.tarkov.dev/profile` | Player lookup by AccountID or username |
| Asset CDN | `https://assets.tarkov.dev` | Item images |
| Cloudflare Turnstile | — | Bot detection for player search (iOS path) |
| 2Captcha API | — | Automated Turnstile token solving (via `geckoTurnstile.ts`) |

**CORS proxies** (fallback chain in `tarkovApi.ts`): `corsproxy.io` → `allorigins.win` → `codetabs.com`

---

## Platform Differences

| | iOS | Android |
|---|-----|---------|
| Player search auth | Browser-based Turnstile token | WebView fallback + AccountID extraction from tarkov.dev URL |
| Token storage | AsyncStorage with TTL | AsyncStorage with TTL |

---

## Game Mode

Two modes: **PvP** (`regular`) and **PvE**.

- Mode is stored in AsyncStorage with mode-specific storage keys.
- Mode affects: API query parameters, theme accent colors, UI labels.
- Mode context comes from `GameModeProvider` — read it via `useGameMode()`.
- Never branch mode logic in components by reading raw strings; always use the context hook.

---

## CI/CD

GitHub Actions (`.github/workflows/main.yml`):

- **Triggers**: push to `main`, manual `workflow_dispatch`
- **Android job**: `expo prebuild` → Gradle release APK → uploads artifact
- **iOS job**: `expo prebuild` → unsigned Xcode IPA → uploads artifact
- Concurrency: cancels stale runs for the same branch

---

## TypeScript

- Strict mode enabled (`tsconfig.json`)
- Path alias: `@/*` → `./` (relative to `expo/`)
- Run `bunx tsc --noEmit` to type-check without emitting files
- Never use `any` to suppress errors — fix the underlying type

---

## Debugging Tips

- **UI changes not reflecting**: `bunx expo start --clear` to wipe Metro cache
- **API shape confusion**: query `api.tarkov.dev/graphql` directly using GraphQL playground or curl, compare with `the-hideout/tarkov-dev` source
- **Turnstile failures**: check if an `accountId`-only endpoint exists first — prefer it over the token path
- **Logging**: use `debugLog` from `utils/debugLog.ts` (`debugLog.info`, `.warn`, `.error`) — not `console.log`
