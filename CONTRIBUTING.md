# Contributing

Thanks for helping! This is an independent, unofficial project (see [DISCLAIMER.md](DISCLAIMER.md)).

## Workflow

- `main` is protected: changes go through pull requests with green checks (typecheck, unit tests, build, HACS).
- Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/); squash-merge.
- [release-please](https://github.com/googleapis/release-please) keeps a release PR (version in `package.json`,
  `CHANGELOG.md`). Merging it tags `vX.Y.Z`; the release workflow builds the card and attaches
  `dist/wallbox-web-card.js` to the GitHub release, which is what HACS installs.
- Pre-releases (marked on GitHub) reach only users who enable beta versions in HACS.

## Local setup

Node 24+:

```sh
npm ci
npm run typecheck
npm test          # unit tests of the pure helpers (node --test)
npm run build     # dist/wallbox-web-card.js
npm run watch     # rebuild on change
npm run demo      # build + serve; open http://localhost:5050/demo/ (mocked hass, no Home Assistant needed)
```

To try it in a real Home Assistant: copy `dist/wallbox-web-card.js` to `/config/www/` and add the resource
`/local/wallbox-web-card.js?v=<n>` (JavaScript module).

## Guidelines

- Lit 3, TypeScript strict, one bundled ES module (esbuild). No runtime dependencies besides Lit.
- Use `hass.formatEntityState` for entity states (the integration translates them); card texts in `src/localize.ts`.
- Keep the look of the Wallbox WEB app (tokens in `src/styles.ts`) and respect *Reduce motion* / *Reduce
  transparency*.
