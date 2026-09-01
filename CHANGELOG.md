# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version lines:

- **2.x** — Reanimated 4 main line (`latest` / `next`)
- **1.x** — Reanimated 3 compatibility line (`reanimated3` / `reanimated3-next`)

## [Unreleased]

No unreleased changes yet.

## [1.0.0-beta.0] — 2026-09-01

First public prerelease of the Reanimated 3 compatibility line (`1.x`), published under
the `reanimated3-next` dist-tag.

### Added

- Reanimated 3 compatibility line (no Worklets — worklet runtime bundled in Reanimated 3).
- Thread-scheduling adapter for the Reanimated 3 internal `scheduleOnReactNative` API.

### Compatibility

- **Paper and Fabric both build**, but only two representative Android combos are CI-verified:
  Expo SDK 53 Paper (React 19.0.0 / RN 0.79.6 / RNGH 2.24.0 / Reanimated 3.17.5) and
  RN Community CLI 0.81 Fabric (React 19.1.0 / RN 0.81.5 / RNGH 2.28.0 / Reanimated 3.19.5).
  The full 8-combo matrix (× iOS/Android × Paper/Fabric) and device smoke are pending —
  **not yet a release contract**.
- Peer ranges: React `>=19.0.0 <20.0.0`, RN `>=0.79.0 <0.82.0`,
  `react-native-gesture-handler` `>=2.24.0 <2.29.0`,
  `react-native-reanimated` `>=3.17.4 <3.20.0`. Conditional pairing: RN 0.81 requires
  Reanimated 3.19.x (not 3.17.x).
- Legacy maintenance line; the current main line is `2.x` (Reanimated 4). The `1.x` line
  must not be combined with the `react-native-worklets` package.

### Compatibility note

- Release notes / GitHub prerelease will mark: Paper + Fabric, exact RN/Reanimated
  versions, and the legacy-maintenance risk.

## [2.0.0] — 2026-08-31

First stable release of the Reanimated 4 main line (`2.x`).

### Changed

- Promoted from `2.0.0-beta.1` to stable. No functional changes from the prerelease — identical code and API surface, now published under the `latest` dist-tag.

## [2.0.0-beta.1] — 2026-08-28

First full public prerelease with provenance and release media.

### Added

- npm provenance attestation via GitHub Actions OIDC (Trusted Publishing).
- Demo video linked from the README (hosted on the GitHub Release asset).

### Changed

- No functional changes from `2.0.0-beta.0` (identical code and API surface).

## [2.0.0-beta.0] — 2026-08-28

First public prerelease candidate for the Reanimated 4 main line (`2.x`).

### Added

- Initial public release of `@jadezhou/sticky-tab-view`.
- `StickyTabView` — collapsible header with horizontal paging tabs and synchronized scroll positions.
- `ElasticScrollView` — gesture-driven scroll container with bounce, paging, pull-to-refresh, and load-more.
- `ElasticPullRefreshHeader` — default pull-to-refresh indicator.
- `MasonryList` — waterfall/masonry list with cell recycling, pagination, and multi-section support.
- Public types: `TDirection`, `TElasticScrollViewProps`, `TFetchContext`, `TFetchRes`, `TItemBase`, `TMasonryErrorInfo`, `TMasonryListProps`, `TMasonryRequestPhase`, `TOnRefreshParam`, `TPanHandler`, `TSectionData`, `TStickyTabViewProps`.

### Changed

- Renamed package from an internal `v4`-suffixed name to `@jadezhou/sticky-tab-view`.

### Compatibility

- React Native New Architecture (Fabric) only; requires the `react-native-worklets/plugin` Babel plugin.
- ESM-only package (`"type": "module"`); no CommonJS build.
- Supported host ranges: React `>=19.1.0 <20.0.0`, React Native `>=0.81.0 <0.82.0`,
  `react-native-gesture-handler` `>=2.28.0 <2.29.0`, `react-native-reanimated` `>=4.1.0 <4.2.0`,
  `react-native-worklets` `>=0.5.0 <0.6.0`.
- iOS and Android supported; Web is experimental.
