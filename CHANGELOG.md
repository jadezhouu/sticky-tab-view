# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Version lines:

- **2.x** — Reanimated 4 main line (`latest` / `next`)
- **1.x** — Reanimated 3 compatibility line (`reanimated3` / `reanimated3-next`)

## [Unreleased]

No unreleased changes yet.

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
