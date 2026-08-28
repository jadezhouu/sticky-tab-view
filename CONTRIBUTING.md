# Contributing

## Development Setup

This project uses **pnpm exclusively** as its package manager. Do not use
`npm install` or `yarn install`; the repository only tracks `pnpm-lock.yaml`.

```bash
# Clone the repository
git clone https://github.com/jadezhouu/sticky-tab-view.git
cd sticky-tab-view

# Install dependencies
pnpm install

# Verify setup
pnpm typecheck
pnpm test
```

## Project Structure

- `src/` — Library source code (the publishable core)
- `example/` — Expo demo app (consumes the library via workspace)
- `tests/` — Unit tests
- `scripts/` — Release and consumer verification scripts

## Common Commands

| Command | Description |
|---------|-------------|
| `pnpm typecheck` | Run TypeScript type checking on the library |
| `pnpm test` | Run unit tests |
| `pnpm build` | Build JS + `.d.ts` to `dist/` |
| `pnpm build:watch` | Rebuild on every source change |
| `cd example && pnpm start` | Start the Expo demo app |
| `cd example && pnpm exec tsc --noEmit` | Type-check the demo app |

### Development Workflow

The library's `main`/`exports` point to `dist/` (compiled JS). During development:

1. Run `pnpm build:watch` in one terminal (rebuilds `dist/` on source changes).
2. Run `cd example && pnpm start` in another terminal (starts Expo with Metro).
3. Edit files in `src/` — TypeScript recompiles to `dist/`, Metro picks up changes.

This two-terminal setup mirrors the developer experience of most React Native component libraries.

## Code Guidelines

1. **Library code goes in `src/`.** Only the built `dist/` directory is published to npm. Source files in `src/` are compiled to JS + declarations during `pnpm build`, and only the output lands in the tarball.
2. **Public API lives in `src/index.ts`.** All consumer-facing exports must be re-exported from this file. Internal implementation files in `core/`, `scroll/`, etc. are not importable by consumers.
3. **No Expo dependencies in the library.** The library must not import from `expo`, `expo-router`, or other Expo modules. Those belong in `example/` only.
4. **Peer dependencies must be kept in sync.** If you add a new native dependency to `src/`, add it to `peerDependencies` in `package.json`.
5. **Mark internal types with `@internal`.** Types in `types.ts` that are not part of the stable public API should be annotated with `/** @internal */`.

## Pull Request Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm --dir example exec tsc --noEmit` passes
- [ ] New public exports are re-exported from `src/index.ts`
- [ ] No Expo imports in `src/`

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code restructuring
- `docs:` — Documentation
- `chore:` — Build, CI, dependencies

## Versioning & Release Policy

- This project follows [Semantic Versioning](https://semver.org/). Breaking changes bump the major version; features bump the minor; fixes bump the patch.
- Git tags use the format `vX.Y.Z` (for example `v2.0.0`).
- The Reanimated 4 main line is **2.x**:
  - `latest` dist-tag — Reanimated 4 stable only.
  - `next` dist-tag — Reanimated 4 prereleases only.
- The future Reanimated 3 compatibility line is **1.x**:
  - `reanimated3` dist-tag — Reanimated 3 stable.
  - `reanimated3-next` dist-tag — Reanimated 3 prereleases.
- The `latest` and `next` tags are never used for the Reanimated 3 line; the `reanimated3*` tags are never used for the Reanimated 4 line.
- Changes are documented in `CHANGELOG.md` before each release.
