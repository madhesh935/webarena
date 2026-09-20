# Brief → product map

This file maps the hackathon brief to the shipped UI so reviewers can verify coverage quickly.

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
| Saved bookmarks / notes (local only) | `#/saved` + Local Storage |
| Desktop / tablet / mobile | `375px` / `768px` / `1024px` in `responsive.css` |
| Static frontend only | Vite `dist/`, no backend |
| Privacy (no raw customer PII) | `scripts/prepare-data.ts` → `public/data/` |
| ~163k-row performance | Lazy pages, worker search, source cache, content-visibility |

## Navigation

Stories · Explore · Connections · Saved
