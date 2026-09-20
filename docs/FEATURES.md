# Brief → product map

This file maps the challenge brief to the shipped UI so reviewers can verify coverage quickly.

| Brief requirement | Where it lives |
| --- | --- |
| Separate sources, shared themes | Every page; source chips; ink stamp; framing note in header |
| Hero copy + Discover / Explore CTAs | `#/` Stories hero |
| Three chapters / storytelling | `#/stories/:id` with step buttons |
| Search, filter, sort, inspect | `#/explore` + hash query params |
| Shareable URL state | `src/lib/url-state.ts` |
| Within-source connections (~4–8) | `#/connections/:receiptId` |
| Cross-source analogy (not identity) | “Compare a similar pattern” control |
| Time change / period A vs B | Journey chart + PeriodCompare on Stories and Explore |
| Saved bookmarks / notes (device only) | `#/saved` + Local Storage |
| Desktop / tablet / mobile | `375px` / `768px` / `1024px` in `src/styles/responsive.css` |
| Client-only app | Vite `dist/`, no server routes |
| Privacy (no raw customer PII) | `scripts/prepare-data.ts` → `public/data/` |
| ~163k-row performance | Lazy pages, worker search, source cache, content-visibility |

## Navigation

Stories · Explore · Connections · Saved

## Responsive checklist

| Width | Expected layout |
| --- | --- |
| **375px** | Bottom nav, stacked hero, one-column cards, full-width CTAs |
| **768px** | Top nav, three chapter cards, four stats, two-column path cards |
| **1024px** | Explore split view with sticky detail panel, four path cards, side-by-side story tools |
