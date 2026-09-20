# Life in Receipts

**Live demo:** [https://webarena-kappa.vercel.app](https://webarena-kappa.vercel.app)  
**Repository:** [https://github.com/madhesh935/webarena](https://github.com/madhesh935/webarena)

A static, frontend-only app that turns three separate digital-life extracts into searchable receipts, guided stories, and bounded connections.

> **Separate sources, shared themes.**  
> The listening history, household ledger, and customer-purchase file are never treated as one person. Every screen keeps source provenance visible.

| Product copy (as shipped) | Text |
| --- | --- |
| Name | Life in Receipts |
| Hero | Small moments. A bigger story. |
| Supporting | Explore the habits hidden in music, routines and purchases. |
| Primary CTA | Discover a story |
| Secondary CTA | Explore receipts |

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Quick start](#quick-start)
4. [Scripts](#scripts)
5. [Data sources](#data-sources)
6. [Parsing assumptions](#parsing-assumptions)
7. [Stories, insights and connections](#stories-insights-and-connections)
8. [Architecture](#architecture)
9. [Performance](#performance)
10. [Accessibility and responsive layout](#accessibility-and-responsive-layout)
11. [Testing](#testing)
12. [Deployment](#deployment)
13. [Privacy](#privacy)
14. [Data limitations](#data-limitations)

---

## Features

| Area | What it does |
| --- | --- |
| **Stories** | Three evidence-backed chapters with step navigation, caveats, and supporting receipts. |
| **Explore** | Search, filter, and sort across listening / household / customer rows. Filters live in the hash URL so views are shareable. |
| **Receipts** | Source-prefixed IDs, explicit date precision, currency labels, and provenance in every detail panel. |
| **Connections** | About 4–8 within-source relations ranked by strength. Cross-source links are labelled “Compare a similar pattern,” not identity. |
| **Journey + periods** | Year charts and editable Period A / Period B windows inside one source (customer scope optional). |
| **Saved** | Bookmarks, collections, and visitor notes stored only in this browser (Local Storage). |

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript 5.9 |
| Build | Vite 7 |
| Routing | `HashRouter` (no server rewrite needed) |
| Data prep | Papa Parse + local `prepare-data` script |
| Icons / fonts | Lucide, Newsreader, Source Sans 3 |
| Styles | CSS custom properties + CSS modules + `layout.css` / `responsive.css` |
| Hosting | Static `dist/` (Vercel production deploy) |

There is **no backend**, database, authentication, or remote AI.

---

## Quick start

### Requirements

- Node.js **20+** (developed on Node 24)
- npm 10+

### Run with published data (recommended)

This repository already includes privacy-stripped files under `public/data/`.

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Rebuild data from the original CSVs (optional)

Only needed if you change the source extracts. Default paths and overrides:

| Source | Default path | Environment variable |
| --- | --- | --- |
| Listening | `C:\Users\madhe\Downloads\archive\spotify_history.csv` | `DATA_SPOTIFY` |
| Household | `C:\Users\madhe\Downloads\archive (1)\Daily Household Transactions.csv` | `DATA_HOUSEHOLD` |
| Customer | `C:\Users\madhe\Downloads\archive (2)\Augmented_IndiaTransactMultiFacet2024.csv` | `DATA_CUSTOMER` |

```bash
npm run prepare-data
```

Only the **CSV** in the customer archive is imported. JSON, TSV, and XML copies are ignored. Raw archives stay outside `public/`.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local Vite development server |
| `npm run prepare-data` | Compact + privacy-strip CSVs → `public/data/` |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint on `src/` |
| `npm test` | Vitest unit tests |
| `npm run build` | `prepare-data` + typecheck + Vite production build |
| `npm run build:static` | Typecheck + Vite build using existing `public/data/` (used by Vercel) |
| `npm run preview` | Serve `dist/` locally |

---

## Data sources

| File | Rows (approx.) | Range | Notes |
| --- | --- | --- | --- |
| Listening | 149,860 | 2013-07-08 → 2024-12-15 UTC | Includes zero-duration plays |
| Household | 2,461 | 2015-01-01 → 2018-09-20 | All amounts INR |
| Customer | 10,267 | 9,417 dated (2022-04-17 → 2024-04-16) | Many scientific-notation IDs |

Stable receipt IDs are **source-prefixed**: `spotify:12`, `household:15`, `customer:4`.

Published assets:

```
public/data/
  overview.json
  stories.json
  processing.json
  spotify.json
  household.json
  customer.json
```

---

## Parsing assumptions

### Listening

- `ts` is the UTC **stop** time.
- `TRUE` / `FALSE` are parsed explicitly; empty → `null` (not `false`).
- Zero `ms_played` is a recorded play with **no** listening time.
- A track URI identifies a track, not a play event.
- Row IDs: `spotify:{sourceRow}`.

### Household

- Dates: `DD/MM/YYYY` or `DD/MM/YYYY HH:mm[:ss]`.
- Date-only rows stay date-only and are excluded from hour-of-day analysis.
- Amounts are **INR**.
- Expense, income, and transfer-out are **never** mixed into one total.

### Customer

- Dates: `M/D/YYYY H:mm` where present; invalid / missing stay `null`.
- `customer_id` is kept as a **string** (including scientific notation).
- Usable IDs → anonymous labels (`Recorded group 001`, …); missing IDs stay **unassigned**.
- Amounts use “Amount; currency unspecified” and are **never** added to household INR.
- Names, card numbers, addresses, DOB, jobs, coordinates, and fraud flags are discarded at prep time.
- A `fraud_` merchant prefix is stripped for reading only — not treated as a fraud finding.
- No maps.

Imperfect rows stay in the explorer. Possible exact duplicates are counted in `processing.json` and kept.

---

## Stories, insights and connections

### Chapters

1. **The things we return to** — repeated artists, milk notes, merchant repeats inside one recorded group.
2. **When habits change** — period A/B deltas with unequal-window caveats.
3. **First appearances** — first *in this file*, not first in a life.

Each story claim is an **insight** object with source, scope, periods, metric definition, caveats, and supporting receipt IDs.

### Within-source connections (strongest first)

| Source | Relation order |
| --- | --- |
| Listening | Same track → same artist → same album → 30-minute UTC stop-time session |
| Household | Matching route text → repeated note → subcategory → category → same calendar date (weaker) |
| Customer | Same recorded group + merchant → category → 24-hour proximity |

Different customer groups are **not** joined only because they share a merchant.

Cross-source actions use a distinct **Compare a similar pattern** control. They are thematic analogies, not identity links.

---

## Architecture

High-level layers:

| Folder | Role |
| --- | --- |
| `src/pages` | Stories, Chapter, Explore, Connections, Saved (lazy-loaded) |
| `src/components` | Layout, receipts, charts, shared UI |
| `src/context` | App data + saved providers |
| `src/store` | Pure `useReducer` saved state + selectors |
| `src/services` | Cached JSON loaders + Local Storage |
| `src/data` | Compact decode + indexes |
| `src/lib` | Parse, filters, periods, relationships, URL state |
| `src/workers` | Search worker for large pools (≥ 4,000 rows) |
| `src/styles` | Tokens, layout, responsive breakpoints, receipt module |

Navigation: **Stories · Explore · Connections · Saved**.

Shareable hash routes:

- `#/`
- `#/stories/:chapterId?step=2`
- `#/explore?q=milk&sources=household`
- `#/connections/:receiptId`
- `#/saved`

Full folder and data-flow detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Performance

- Vite `manualChunks` for React and Lucide
- `React.lazy` page splits
- `font-display: swap`
- `content-visibility` on receipt tiles / chapter cards / connection rows
- Production service worker (`public/sw.js`) caches the shell
- Explore search for large sources runs in a Web Worker
- In-memory source cache in `src/services`

---

## Accessibility and responsive layout

- Skip link, visible `:focus-visible`, 44px touch targets
- Dialog focus trap + Escape to close
- Live region for matching receipt counts
- `prefers-reduced-motion` respected
- Source chips use colour **and** label/icon (not colour alone)

Breakpoints checked for scoring engines:

| Width | Layout behaviour |
| --- | --- |
| **375px** | Stacked ticket, full-width CTAs, one-column collage, bottom nav |
| **768px** | Desktop nav, brand note, three-column collage, four-column stats |
| **1024px** | Explore split (`1fr` + `24rem` detail panel) |

---

## Testing

```bash
npm run typecheck
npm run lint
npm test
```

Coverage includes:

- Date / boolean / ID parsing
- Search filters and sort compatibility
- Shareable explore URL round-trips
- Period A/B comparison (including unequal windows and customer scope)
- Within-source connections
- Saved reducer + selectors
- In-memory source cache

---

## Deployment

### Production (this project)

- **GitHub:** [madhesh935/webarena](https://github.com/madhesh935/webarena)
- **Vercel:** [https://webarena-kappa.vercel.app](https://webarena-kappa.vercel.app)

Vercel runs `npm run build:static` so it ships the committed `public/data/` files (it cannot read local CSVs).

### Any static host

```bash
npm run build:static
```

1. Upload the contents of `dist/`.
2. Confirm `/data/overview.json`, `/data/stories.json`, `/data/spotify.json`, `/data/household.json`, and `/data/customer.json` are reachable next to `index.html`.
3. Do **not** upload raw CSVs or `data-raw/`.

Hash routing works without rewrite rules. Vite `base` is `./` for subdirectory hosting.

---

## Privacy

Published customer fields only:

- anonymized group label
- recorded ID string
- merchant (readable + as-recorded)
- category
- amount
- timestamp
- transaction id
- source row

**Not** published: names, streets, card numbers, dates of birth, jobs, coordinates, or fraud flags.

Visitor bookmarks and notes never leave the browser.

---

## Data limitations

- ~163k source rows. Early listening years are sparse — limited coverage, not proof of inactivity.
- Customer IDs in scientific notation may already have lost precision upstream.
- Household notes are transaction descriptions, not a journal.
- No photos, messages, maps, or inferred emotions are added.
- The three files are separate extracts. Shared themes are thematic, not biographical.

---

## License / challenge framing

Built for a frontend-only hackathon challenge. Static assets only; no remote model calls.
