# Contributing

Thanks for looking at Life in Receipts.

## Local setup

1. Install Node.js 20+
2. `npm install`
3. `npm run prepare-data` (only if you have the local CSV extracts)
4. `npm run dev`

## Checks before a pull request

```bash
npm run typecheck
npm run lint
npm test
npm run build:static
```

## Scope

- Keep the three data sources separate in every screen.
- Prefer small, focused pull requests.
- Do not commit raw CSVs or personal fields from the customer file.
