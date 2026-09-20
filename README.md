# Life in Receipts

A static frontend that turns three separate digital-life extracts into searchable receipts, guided stories and bounded connections.

**Separate sources, shared themes.** The listening history, household ledger and customer-purchase file are not treated as one person. Every screen keeps their provenance visible.

## What you can do

- Open three evidence-backed chapters from the homepage.
- Search and filter all three sources, then inspect a receipt.
- Follow a small set of within-source connections, or compare a similar pattern in another file.
- Compare two periods inside the same source with editable A/B dates (and, for purchases, the same recorded customer group).
- Bookmark receipts and keep short visitor notes in this browser.

## Requirements

- Node.js 20 or newer (developed on Node 24)
- The three source extracts, already unzipped

Default input paths (override with environment variables):

| Source | Default path | Variable |
| --- | --- | --- |
| Listening | `C:\Users\madhe\Downloads\archive\spotify_history.csv` | `DATA_SPOTIFY` |
| Household | `C:\Users\madhe\Downloads\archive (1)\Daily Household Transactions.csv` | `DATA_HOUSEHOLD` |
| Customer | `C:\Users\madhe\Downloads\archive (2)\Augmented_IndiaTransactMultiFacet2024.csv` | `DATA_CUSTOMER` |

Only the CSV in the customer archive is imported. JSON, TSV and XML copies are ignored.

## Scripts

```bash
npm install
npm run prepare-data   # compact, privacy-stripped public/data files
npm run dev            # http://localhost:5173
npm run typecheck
npm run lint
npm test
npm run build          # prepare-data + typecheck + static dist/
npm run preview        # serve dist/ with hash routes
```

`prepare-data` must be able to read the three CSVs. It writes only published fields to `public/data/`. Raw archives stay outside `public/`.

## Parsing assumptions

- **Listening:** `ts` is the UTC stop time. `TRUE`/`FALSE` are parsed explicitly. Empty is null, not false. Zero `ms_played` is a recorded play with no listening time. A track URI identifies a track, not a play. Row IDs are `spotify:{sourceRow}`.
- **Household:** Dates are `DD/MM/YYYY` or `DD/MM/YYYY HH:mm[:ss]`. Date-only rows stay date-only and are excluded from hour-of-day analysis. Amounts are INR. Expenses, income and transfer-out are never mixed in one total.
- **Customer:** Dates are `M/D/YYYY H:mm` where present. Invalid and missing timestamps stay null. `customer_id` is kept as a string, including scientific notation. Usable IDs receive anonymous labels (`Recorded group 001`, …). Missing IDs stay unassigned. Amounts are labelled “Amount; currency unspecified” and are never added to household INR. Names, card numbers, addresses, dates of birth, jobs, coordinates and fraud flags are discarded. A `fraud_` merchant prefix is stripped for reading only; it is not treated as a fraud finding. Coordinates are not mapped.

Imperfect rows stay in the explorer. Possible exact duplicates are counted in `public/data/processing.json` and kept.

## Insights and connections

Each story claim is an insight object with source, scope, periods, metric definition and supporting receipt IDs.

Within-source relations, strongest first:

- Listening: same track, same artist, same album, then a 30-minute UTC stop-time session.
- Household: matching route text, repeated note, subcategory, category, then same calendar date (labelled weaker).
- Customer: same recorded group plus merchant, then category, then 24-hour proximity. Different groups are not joined because they share a merchant.

Cross-source actions use a distinct “Compare a similar pattern” control. They are thematic analogies, not identity links.

## Data limitations

- About 163,000 source rows. Early listening years are sparse; that is limited coverage, not proof of inactivity.
- Customer IDs in scientific notation may already have lost precision.
- Household notes are transaction descriptions, not a journal.
- No photos, messages or inferred emotions are added.

## Static deployment

`npm run build` produces `dist/`. Vercel uses `npm run build:static` so it ships the already-prepared `public/data` files instead of reading the local CSVs. Hash routing (`#/explore`, `#/stories/return-to`) works on any static host without rewrite rules.

See `docs/ARCHITECTURE.md` for folders, caching, hash routing, and data rules.

## Testing

```bash
npm run typecheck
npm run lint
npm test
```

Tests cover date/boolean/ID parsing, search filters, shareable explore URLs, period A/B comparison, within-source connections, the saved `useReducer` store, and the in-memory source cache.

## Performance

The production build vendor-chunks React and Lucide (`manualChunks`), lazy-loads every page, registers `public/sw.js` in production, sets `font-display: swap`, and uses `content-visibility` on receipt tiles. Explore search for large sources runs in a Web Worker.

## Architecture

Layered folders: `src/pages`, `src/components`, `src/context`, `src/store`, `src/services`, `src/types`, `src/constants`, `src/hooks`, `src/workers`, and split CSS (`global.css`, `layout.css`, `responsive.css` at 375px / 768px / 1024px).

1. Upload the contents of `dist/`.
2. Confirm `/data/overview.json`, `/data/stories.json`, `/data/spotify.json`, `/data/household.json` and `/data/customer.json` are reachable next to `index.html`.
3. Do not upload the raw CSVs, source maps of the raw customer file, or `data-raw/`.

If the site lives in a subdirectory, this project already uses a relative Vite `base` (`./`).

## Privacy check

Published customer fields are: anonymized group label, recorded ID string, merchant, category, amount, timestamp, transaction id and source row. They do not include names, streets, card numbers or dates of birth.
