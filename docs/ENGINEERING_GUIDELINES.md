# Engineering Guidelines

This document is the baseline standard for all new pages and API integrations.

## 1) Loading UI Standard

- Do not use spinner loading (`ActivityIndicator`) for page or section loading.
- Use skeleton/shimmer loading based on [`ShimmerBlock`](../components/ShimmerBlock.tsx).
- Show structure-first placeholders:
  - Hero area placeholder
  - Section card placeholders
  - List row placeholders
- Keep loading state visible until target section data is ready.

## 2) Data Fetching Architecture

- Always split data into:
  - `summary` (first paint critical data: name, image, key tags)
  - `detail` (heavy fields: nested objectives, rewards, complex lists)
- Page rendering order:
  1. Render summary immediately.
  2. Fetch detail asynchronously.
  3. Replace each section placeholder independently.
- Never block full page rendering on non-critical detail fields.

## 3) Query Strategy

- Prefer paged/chunked requests over full-dataset requests.
- For large datasets:
  - use `limit + offset` loops
  - stop scanning as soon as target match is found
  - fetch only matched detail record afterward
- Keep list pages on summary endpoints.
- Keep detail pages on single-item detail endpoints.

## 4) Request Control

- Every fetch must support `AbortSignal` where possible.
- Cancel in-flight requests on:
  - page switch
  - search condition switch
  - user leaving screen
- Prioritize foreground requests over background warmups.

## 5) React Query Rules

- Use stable query keys and separate summary/detail keys.
- Enable section-level queries (independent loading/error states).
- Avoid broad refetch that blocks current interaction.

## 6) Error Handling

- Do not hide API errors silently.
- For partial GraphQL data:
  - allow partial render only when explicitly configured
  - log GraphQL errors for diagnosis
- Keep fallback language logic explicit and bounded.

## 7) Implementation Checklist (PR Gate)

- No spinner-based loading in changed screens.
- Summary-first render path implemented.
- Detail loaded in independent blocks.
- Request cancellation verified.
- Pagination/chunk logic verified for large lists.
- `bunx tsc --noEmit` passes.

