# Contributing

Thanks for looking at Life in Receipts.

## Local setup

1. Install Node.js 20+
2. `npm install`
3. `npm run prepare-data` only if you have the local CSV extracts
4. `npm run dev`

## Checks before a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run build:static
```

## Product rules

- Keep the framing **Separate sources, shared themes**
- Never treat the three files as one person
- Do not commit raw CSVs or personal customer fields

See `README.md` and `docs/ARCHITECTURE.md`.
