# Third-party notices

The application uses third-party packages under their respective licenses. The CI license gate reads the complete pnpm dependency graph and fails when an unreviewed license identifier appears.

Principal runtime dependencies:

| Package                     | License    |
| --------------------------- | ---------- |
| React / React DOM           | MIT        |
| React Hook Form / resolvers | MIT        |
| Zod                         | MIT        |
| Zustand                     | MIT        |
| Dexie                       | Apache-2.0 |
| Recharts                    | MIT        |

Principal quality and build tools include Vite, TypeScript, ESLint, Vitest, Testing Library, Playwright, axe-core, Prettier, and vite-plugin-pwa. Their licenses are MIT, Apache-2.0, BSD, ISC, or MPL-2.0 as reported by their package metadata.

`axe-core` and `@axe-core/playwright` are distributed under MPL-2.0. They are development-only quality tools and are not bundled into the production application.

Run `pnpm licenses list` for the exact transitive package, version, path, and license list in the installed lockfile.
