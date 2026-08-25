# Output Plan

- Source URL: `https://learningseo.io/`
- Normalized origin: `https://learningseo.io`
- Normalized pathname: `/`
- App root: `.`
- Site key: `learningseo-io-071dae18`
- Page key: `root-8a5edab2`
- Destination route: `/` via `src/app/page.tsx`
- Artifact root: `docs/research/learningseo-io-071dae18/root-8a5edab2/`
- Screenshot root: `docs/design-references/learningseo-io-071dae18/root-8a5edab2/`
- Component root: `src/components/sites/learningseo-io-071dae18/root-8a5edab2/`
- Shared component root: `src/components/sites/learningseo-io-071dae18/shared/`
- Asset root: `public/sites/learningseo-io-071dae18/root-8a5edab2/`
- Shared asset root: `public/sites/learningseo-io-071dae18/shared/`
- Asset downloader: `scripts/download-assets-learningseo-io-071dae18-root-8a5edab2.mjs`

## Existing Output

- `src/app/page.tsx` is the untouched clone-template placeholder and is approved for replacement by the single-URL root clone workflow.
- No existing site component namespace, research namespace, screenshot namespace, or public asset namespace collides with this target.
- `package-lock.json` contains pre-existing working-tree changes and remains user-owned.

## Shared Foundation Changes

- `src/app/layout.tsx`: target metadata and extracted fonts.
- `src/app/globals.css`: preserve the template tokens and add route-scoped LearningSEO styles.
- `src/app/favicon.ico`: preserve the existing file; use metadata icon paths from the namespaced public asset directory.

## Verification

- Baseline `npm run build`: passed on 2026-08-25.
- Final checks: TypeScript, lint, production build, exact `/` route, desktop/mobile visual diff, interaction sweep.
