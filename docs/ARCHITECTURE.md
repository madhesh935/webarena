# Architecture

Life in Receipts is a **static** React 19 + TypeScript 5.9 + Vite 7 frontend.

- No backend, database, authentication, or remote AI
- Published JSON under `public/data/` is generated locally by `npm run prepare-data`
- Production hosts (for example Vercel) run `npm run build:static` and ship those files as-is

For product overview, scripts, privacy, and deployment, see the root [`README.md`](../README.md).

---

## Folder layers

| Folder | Role |
| --- | --- |
| `src/api` | Thin re-exports of data and storage services |
| `src/pages` | Stories, Chapter, Explore, Connections, Saved — lazy-loaded from `App.tsx` |
| `src/components` | `AppShell`, `ReceiptCard`, `Charts`, `UiElements`, skeleton, error boundary |
| `src/context` | `AppDataContext` and `SavedContext` (`useReducer`) |
| `src/store` | Pure saved-state reducer and selectors |
| `src/services` | JSON loading with an in-memory cache; Local Storage persistence |
| `src/data` | Compact JSON decode and in-source indexes |
| `src/lib` | Parsing, filters, period comparison, relationships, URL state |
| `src/workers` | Search/filter worker when a source pool is large (≥ 4,000 rows) |
| `src/types` | Receipt, explorer, and UI contracts |
| `src/constants` | Product copy, page size, `375px` / `768px` / `1024px` media queries |
| `src/hooks` | Debounce, media (`useMedia`), focus trap, viewport height, document title |
| `src/utils` | Small helpers (for example debounce) |
| `src/styles` | Entry `index.css` plus tokens/layout/responsive/`ReceiptCard.module.css` |

---

## Data flow

1. `prepare-data` reads the three CSVs, strips unpublished customer fields, and writes compact JSON.
2. `AppDataProvider` loads `overview.json` and `stories.json` through `services/data`.
3. Source files (`spotify.json`, `household.json`, `customer.json`) load on demand and stay in an in-memory cache until `clearSourceCache()`.
4. Explore search for large pools runs in `search.worker.ts`. Smaller pools filter on the main thread.
5. Explore and chapter filters live in the hash URL (`URLSearchParams`) so a view can be shared without a server.

```
CSV extracts
    │  npm run prepare-data
    ▼
public/data/*.json
    │  fetch + decode
    ▼
services/data (cache) ──► context/app-context
    │
    ├── pages (Stories / Explore / Connections / Saved)
    ├── workers/search.worker (large pools)
    └── store + services/storage (Saved only, Local Storage)
```

---

## Data rules

| Rule | Implementation |
| --- | --- |
| Separate sources | Never join the three files as one person |
| Stable IDs | Source-prefixed: `spotify:12`, `household:15`, `customer:4` |
| Booleans | Explicit `TRUE` / `FALSE`; empty → `null` |
| Zero vs missing | Zero duration / amount kept; empty → `null` |
| Household dates | Date-only rows stay date-only |
| Currencies | Household = INR; customer = “Amount; currency unspecified” |
| Customer privacy | PII stripped in `prepare-data` |

---

## Routing

Hash routes keep shareable filter and chapter state without server rewrites:

| Route | Page |
| --- | --- |
| `/` | Stories homepage |
| `/stories/:chapterId` | Chapter (`?step=` optional) |
| `/explore` | Explorer (`q`, `sources`, `cats`, `from`, `to`, `customer`, `sort`, `page`, `receipt`) |
| `/connections/:receiptId` | Connections |
| `/saved` | Bookmarks and collections |

Primary navigation: **Stories · Explore · Connections · Saved**.

---

## Saved state

| Concern | Location |
| --- | --- |
| Reducer | `src/store/savedReducer.ts` |
| Selectors | `src/store/selectors.ts` |
| Persistence | `src/services/storage.ts` → Local Storage |
| Provider | `src/context/saved-context.tsx` (`useReducer`) |

Bookmarks, collections, and visitor notes never sync across devices and are not part of the dataset.

---

## Performance

| Technique | Where |
| --- | --- |
| Vendor chunks | Vite `manualChunks` for React and Lucide |
| Code splitting | `React.lazy` pages in `App.tsx` |
| Fonts | `font-display: swap` |
| Off-screen work | `content-visibility: auto` on tiles / cards / connection rows |
| Shell cache | `public/sw.js` registered in production |
| Search off main thread | Worker when pool ≥ 4,000 rows |

---

## Accessibility

- Skip link to `#main`
- Visible `:focus-visible`
- Minimum 44px touch targets
- Dialog focus trap and Escape to close
- Live region for matching counts
- `prefers-reduced-motion`
- Source chips use icon + label, not colour alone

---

## Responsive layout

Mobile-first CSS in `src/styles/responsive.css`:

| Breakpoint | Behaviour |
| --- | --- |
| **375px** | Stacked ticket, full-width CTAs, one-column collage, two-column stats, bottom nav |
| **768px** | Desktop nav, brand note, three-column collage, four-column stats |
| **1024px** | Explore split (`1fr` + `24rem` detail panel), wider ticket, filter toolbar |

Constants live in `src/constants/breakpoints.ts` (`MEDIA_QUERIES`).

---

## Tests and quality gates

```bash
npm run typecheck
npm run lint
npm test
```

Unit tests cover parsing, filters, URL state, period comparison, connections, the saved reducer, selectors, and the in-memory cache. Typecheck and lint gate the production build.
