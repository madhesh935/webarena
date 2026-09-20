# Architecture

Life in Receipts is a static React 19 + TypeScript 5.9 + Vite 7 frontend. There is no backend, database, authentication, or remote AI. Published JSON under `public/data/` is generated locally by `npm run prepare-data` and fetched at runtime.

## Layers

| Folder | Role |
| --- | --- |
| `src/pages` | Stories, Chapter, Explore, Connections, Saved. Lazy-loaded from `App.tsx`. |
| `src/components` | Layout shell, receipt cards, charts, shared UI, error boundary. |
| `src/context` | App data provider and saved-items provider (`useReducer`). |
| `src/store` | Pure saved-state reducer and selectors. |
| `src/services` | JSON loading with an in-memory cache, and Local Storage persistence. |
| `src/data` | Compact JSON decode and in-source indexes. |
| `src/lib` | Parsing, filters, period comparison, relationships, URL state. |
| `src/workers` | Search/filter worker used when a source pool is large (≥ 4,000 rows). |
| `src/types` | Receipt, explorer, and UI contracts re-exported for pages. |
| `src/constants` | Product copy, page size, and `375px` / `768px` / `1024px` media queries. |
| `src/hooks` | Debounce, media, focus trap, viewport height, intersection observer. |
| `src/utils` | Small helpers such as debounce. |
| `src/styles` | Tokens in `global.css`, shell in `layout.css`, breakpoints in `responsive.css`, receipt tiles in a CSS module. |

## Data flow

1. `prepare-data` reads the three CSVs, strips unpublished customer fields, and writes compact JSON.
2. `AppDataProvider` loads `overview.json` and `stories.json` through `services/data`.
3. Source files (`spotify.json`, `household.json`, `customer.json`) load on demand and stay in an in-memory cache until `clearSourceCache()`.
4. Explore search for large pools runs in `search.worker.ts`. Smaller pools filter on the main thread.
5. Explore and chapter filters live in the hash URL (`URLSearchParams`) so a view can be shared without a server.

## Data rules

Each receipt ID is source-prefixed (`spotify:12`). The three files are never joined as one person. Customer PII is stripped during `prepare-data`. Amounts from the household file stay INR; customer amounts stay “Amount; currency unspecified”. Household date-only rows stay date-only. Explicit `TRUE`/`FALSE` never collapse empty to false. Zero duration is kept as a recorded play with no listening time.

## Routing

Hash routes (`#/explore`, `#/stories/return-to?step=2`) keep shareable filter and chapter state without a server rewrite. Primary navigation is Stories, Explore, Connections, Saved.

## Saved state

Bookmarks, collections, and visitor notes use `useReducer` in `src/store/savedReducer.ts` and persist through `src/services/storage.ts` to Local Storage only. Selectors in `src/store/selectors.ts` read that state without mutating it.

## Performance

- React and Lucide are split with Vite `manualChunks`.
- Route pages load with `React.lazy`.
- Fonts use `font-display: swap`.
- Receipt tiles, chapter cards, and connection rows use `content-visibility: auto`.
- A production service worker (`public/sw.js`) caches the shell.
- Search work for pools ≥ 4,000 rows moves off the main thread.

## Accessibility

Skip link, visible `:focus-visible`, 44px touch targets, dialog focus trap, live region for matching counts, `prefers-reduced-motion`, and source chips that are not color-only.

## Responsive layout

Mobile-first CSS in `src/styles/responsive.css`:

- **375px:** stacked ticket, full-width CTAs, one-column collage, two-column stats, bottom nav.
- **768px:** desktop nav, brand note, two-column ticket with a dashed stub, three-column collage, four-column stats.
- **1024px:** explore split (`1fr` + `24rem` detail panel), wider ticket, filter toolbar.

## Tests

`npm test` covers parsing, filters, URL state, period comparison, connections, the saved reducer, selectors, and the in-memory cache. `npm run typecheck` and `npm run lint` gate the production build.
