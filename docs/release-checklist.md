# Release checklist

## Automated gate

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm license:check`
- `pnpm build`
- `pnpm test:e2e` on Chromium, Firefox, WebKit, iPhone Safari equivalent, and Android Chrome equivalent
- `dist/manifest.webmanifest` and `dist/sw.js` exist

## Manual release checks

- GitHub Pages environment is enabled with GitHub Actions as the source.
- The Pages subpath loads without asset 404s.
- Install and offline launch work on one desktop and one mobile device.
- Light and dark themes remain readable at 200% zoom.
- Keyboard focus is visible and every dialog can be completed or cancelled.
- Backup privacy warning and unofficial rights notice are visible.
- The official source link resolves to the intended announcement.

## Post-release rule verification

Record game results for 1 minute, 10 minutes, 1 hour, 23:59, 1 day, 6 days 23:59, exactly 7 days, both nature modifiers, Relax Set, level-cap boundary, and the one-year boundary. Export anonymous verification JSON/CSV and compare predicted and actual values before changing a rule set.
