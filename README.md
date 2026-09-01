# StickyTabView

> 中文文档：[README.zh-CN.md](./README.zh-CN.md)

> **⚠️ Legacy maintenance line (1.x)**: this line targets `react-native-reanimated@3`
> (no Worklets). It is maintained for existing Reanimated 3 apps. **New projects should
> use the current main line `2.x` (Reanimated 4)** — see the
> [Reanimated 4 README](https://github.com/jadezhouu/sticky-tab-view#readme).
>
> Install this line explicitly by dist-tag (`reanimated3-next` for prereleases,
> `reanimated3` for stable) and pin `package.json` to `^1.0.0` or an exact `1.x`.

React Native components for a gesture-responsive collapsible header, horizontal tab paging, synchronized scrolling, and masonry layouts. Built on `react-native-reanimated` and `react-native-gesture-handler`.

Changelog: [CHANGELOG.md](./CHANGELOG.md) · [GitHub Releases](https://github.com/jadezhouu/sticky-tab-view/releases)

<p align="center">
  <a href="https://github.com/jadezhouu/sticky-tab-view/releases/download/v2.0.0/sticky-tab-view-demo.mp4">
    <img
      src="https://raw.githubusercontent.com/jadezhouu/sticky-tab-view/main/.github/assets/demo.PNG"
      width="360"
      alt="StickyTabView demo showing collapsible tabs and scrolling content"
    />
  </a>
</p>

<p align="center">
  <a href="https://github.com/jadezhouu/sticky-tab-view/releases/download/v2.0.0/sticky-tab-view-demo.mp4">
    Watch the HD demo video
  </a>
</p>

## Features

- **StickyTabView** — Gesture-responsive collapsible header + horizontal paging tabs with synchronized scroll positions
- **ElasticScrollView** — Gesture-driven scroll view with bounce, paging, and header linkage
- **ElasticPullRefreshHeader** — Built-in pull-to-refresh indicator (customizable via the `PullRefreshHeaderComponent` contract)
- **MasonryList** — High-performance waterfall/masonry list with cell recycling, pagination, and multi-section support

## Requirements

- **New Architecture (Fabric) and Paper both build** on the `1.x` line. The full 8-combo native matrix (Expo SDK 53 & RN 0.81 × iOS/Android × Paper/Fabric) is CI-verified through the `v3-native-dispatcher` release-candidate run — automatic build coverage is complete. Device/UI runtime smoke (gestures, scrolling, recycling, pull-to-refresh, backgrounding) is still pending and is the remaining gate before this line becomes a release contract.
- **No Worklets**: this line uses `react-native-reanimated@3`, whose worklet runtime is bundled — the separate `react-native-worklets` package must **not** be installed.
- **Node.js `>=20.19.4`** is required for development and tooling.
- This is an **ESM-only** package; no CommonJS build is provided.
- The app must be mounted under [`GestureHandlerRootView`](#gesture-handler-root-view).
- The Reanimated Babel plugin must be active. Expo SDK 53 configures it through `babel-preset-expo`; React Native Community CLI projects configure it explicitly (see [Babel setup](#babel-setup)).

## Installation

```bash
# Reanimated 3 line (1.x) — prerelease / stable
npm install @jadezhou/sticky-tab-view@reanimated3-next   # prerelease
# npm install @jadezhou/sticky-tab-view@reanimated3      # stable (once released)
pnpm add @jadezhou/sticky-tab-view@reanimated3-next
yarn add @jadezhou/sticky-tab-view@reanimated3-next
```

> **Note**: `npm install @jadezhou/sticky-tab-view` (no dist-tag) installs the **2.x**
> Reanimated 4 line — do not use that command for the Reanimated 3 line.

### Peer Dependencies

Your app must already use the compatible React and React Native versions shown below. Do not use this library's installation command to upgrade an existing app's `react` or `react-native` version.

For an Expo SDK 53 project, install compatible native peers with Expo:

```bash
npx expo install react-native-gesture-handler react-native-reanimated
```

For React Native Community CLI, install versions within the listed peer ranges, then rebuild the native app. Your package manager may install missing peer dependencies automatically; verify the resolved versions before running the app.

| Dependency                     | Required range     |
| ------------------------------ | ------------------ |
| `react`                        | `>=19.0.0 <20.0.0` |
| `react-native`                 | `>=0.79.0 <0.82.0` |
| `react-native-gesture-handler` | `>=2.24.0 <2.29.0` |
| `react-native-reanimated`      | `>=3.17.4 <3.20.0` |

### Compatibility Matrix

Peer boundaries (conditional pairing — see "Known invalid" below):

| Dependency                     | Required range     |
| ------------------------------ | ------------------ |
| `react`                        | `>=19.0.0 <20.0.0` |
| `react-native`                 | `>=0.79.0 <0.82.0` |
| `react-native-gesture-handler` | `>=2.24.0 <2.29.0` |
| `react-native-reanimated`      | `>=3.17.4 <3.20.0` |

**Verified anchors** — the full 8-combo native matrix (each anchor × iOS/Android × Paper/Fabric) is CI-verified through the `v3-native-dispatcher` release-candidate run. Device/UI runtime smoke is still pending and is the remaining gate before a release contract.

| Anchor | React | React Native | RNGH     | Reanimated | CI-verified (native) |
| ------ | ----- | ------------ | -------- | ---------- | --------------------- |
| Expo SDK 53 | 19.0.0 | 0.79.x | 2.24.x | 3.17.x | iOS + Android, Paper + Fabric |
| RN Community CLI | 19.1.0 | 0.81.x | 2.28.x | 3.19.x | iOS + Android, Paper + Fabric |

**Upstream-compatible but unverified**: other combinations inside the peer ranges that
Reanimated 3 supports upstream but this repository has not built/tested (e.g. RN 0.80 +
Reanimated 3.18). They are expected to work but are not covered by CI or the release
contract.

**Known invalid**: the peer ranges cannot express the conditional pairing between RN and
Reanimated. In particular, **RN 0.81 must not be combined with Reanimated 3.17.x**
(Reanimated 3.17.x supports RN 0.79 at most; RN 0.81 requires Reanimated 3.19.x). Verify
the resolved versions with `npm ls` / `pnpm why` before building.

Web/H5 is **not** part of the release contract; it is exercised only as an experimental
build smoke (see [Platform Support](#platform-support)).

### Gesture Handler Root View

Wrap the application root once. Keep it as close to the actual app root as possible so all gesture relationships are mounted under the same root view.

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MyScreen />
    </GestureHandlerRootView>
  );
}
```

## Babel Setup

The Reanimated Babel plugin must be active for worklets to run. A missing or stale plugin configuration can produce errors such as `Failed to create a worklet`.

**Expo SDK 53** — `babel-preset-expo` detects `react-native-reanimated` and injects `react-native-reanimated/plugin` automatically. A standard Expo config needs no extra plugin entry:

```js
module.exports = {
  presets: ['babel-preset-expo'],
};
```

Do **not** add `react-native-reanimated/plugin` manually in an Expo project — that would duplicate the plugin. This library also recommends wrapping your Metro config with Reanimated 3's `wrapWithReanimatedMetroConfig` for readable worklet stack traces:

```js
const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = wrapWithReanimatedMetroConfig(config);
```

**React Native Community CLI** — keep your existing preset and add the plugin **as the last plugin**:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};
```

After changing the Babel config, restart Metro with a clean cache (for Expo: `pnpm --dir example start --clear`).

> **Expo Go is not a release gate.** Expo Go is always New Architecture and bundles its
> own JS/native patch, which does not match this repository's frozen lockfile versions.
> Use a **Development Build** (`npx expo run:ios|android`) for real verification; treat
> Expo Go only as an auxiliary Fabric smoke, and only when the exact Reanimated patch is
> confirmed to match.

> **Dependabot / Renovate**: do **not** auto-merge an upgrade to `2.x` (Reanimated 4)
> on this maintenance line — it requires migrating to Reanimated 4 + Worklets. Treat any
> such proposal as a manual migration task.

Do **not** add `babel-preset-expo` if your project doesn't already use Expo — the library itself has no Expo dependency.

After installing or upgrading native dependencies, rebuild the native app. After changing only `babel.config.js`, restart Metro with a clean cache:

- **Expo** — `npx expo start -c`; for a native dependency change, rebuild with `npx expo run:ios` or `npx expo run:android`.
- **React Native CLI** — restart Metro with `npx react-native start --reset-cache`; rebuild the native binary after native dependency changes.
- A plain Fast Refresh / Metro reload is not enough after a Babel configuration change.

## Quick Start

A minimal screen. It assumes that the app root is already wrapped in `GestureHandlerRootView` as shown above.

```tsx
import React, { useCallback } from 'react';
import { View, Text } from 'react-native';
import { StickyTabView, ElasticScrollView } from '@jadezhou/sticky-tab-view';
import type { TOnRefreshParam } from '@jadezhou/sticky-tab-view';

export default function MyScreen() {
  const renderHeader = useCallback(
    () => (
      <View style={{ paddingTop: 60 }}>
        <Text>My Collapsible Header</Text>
      </View>
    ),
    [],
  );

  const renderTab = useCallback((tab: number) => {
    switch (tab) {
      case 0:
        return (
          <ElasticScrollView
            bounces
            onRefresh={(refresh: TOnRefreshParam) => {
              setTimeout(() => refresh.endRefresh(), 1000);
            }}
          >
            <Text>Tab 1 Content</Text>
          </ElasticScrollView>
        );
      case 1:
        return (
          <ElasticScrollView>
            <Text>Tab 2 Content</Text>
          </ElasticScrollView>
        );
      default:
        return null;
    }
  }, []);

  return (
    <StickyTabView
      tabCount={2}
      renderHeader={renderHeader}
      renderTab={renderTab}
      tabBarHeight={50}
    />
  );
}
```

## API

### StickyTabView

A paged container with a shared collapsible header. Vertical drags that begin in the header area drive the active tab's scrolling and header collapse, so scrolling remains continuous above and below the tab bar. The component also exposes an imperative handle via `ref`.

| Prop                  | Type                                    | Default      | Description                                                                |
| --------------------- | --------------------------------------- | ------------ | -------------------------------------------------------------------------- |
| `tabCount`            | `number`                                | _(required)_ | Number of horizontal tabs                                                  |
| `renderHeader`        | `() => ReactElement`                    | _(required)_ | Render the collapsible header                                              |
| `renderTab`           | `(tab: number) => ReactElement \| null` | _(required)_ | Render content for each tab                                                |
| `renderTabBar`        | `(x, ys, current) => ReactNode`         | —            | Custom tab bar; arguments are Reanimated shared values                     |
| `lazy`                | `boolean`                               | `false`      | Lazy-load tabs (only render when visible)                                  |
| `lazyPreloadDistance` | `number`                                | `0`          | Number of adjacent tabs to preload when `lazy`                             |
| `current`             | `number`                                | `0`          | Initial tab index; not a controlled prop after mount                       |
| `tabBarHeight`        | `number`                                | `50`         | Actual height, in points, of the rendered tab bar                          |
| `headerOffset`        | `number`                                | `0`          | Height reserved from the collapsible header (for example, a fixed overlay) |

`tabBarHeight` must match the height of a custom tab bar. To switch tabs after mount, use `ref.current?.setTab(index)`; changing `current` later does not control the active tab.

Handle method:

```tsx
const ref = useRef<StickyTabViewHandle>(null);
ref.current?.setTab(1); // programmatically switch tab
```

### ElasticScrollView

A gesture-driven scroll container. Like React Native's `ScrollView`, it renders the children supplied by the caller and does **not** virtualize arbitrary child elements. Use it for bounded content and for the sticky header, paging, refresh, and load-more interactions. For long, unbounded lists prefer `MasonryList`.

| Prop                     | Type                                    | Default                    | Description                                              |
| ------------------------ | --------------------------------------- | -------------------------- | -------------------------------------------------------- |
| `bounces`                | `boolean \| "vertical" \| "horizontal"` | `"vertical"`               | Bounce direction                                         |
| `pagingEnabled`          | `boolean \| "vertical" \| "horizontal"` | `false`                    | Snap to pages                                            |
| `scrollEnabled`          | `boolean \| "vertical" \| "horizontal"` | `"vertical"`               | Enable/disable scroll                                    |
| `directionalLockEnabled` | `boolean`                               | `true`                     | Lock scroll to one direction                             |
| `decelerationRate`       | `number`                                | `0.998`                    | Deceleration factor                                      |
| `onRefresh`              | `(refresh: TOnRefreshParam) => void`    | —                          | Pull-to-refresh callback                                 |
| `onEndReached`           | `() => Promise<boolean \| undefined>`   | —                          | Load-more callback; resolves whether more content exists |
| `refreshing`             | `boolean`                               | `false`                    | Controlled refresh state                                 |
| `loadingMore`            | `boolean`                               | `false`                    | Loading-more indicator                                   |
| `loadFinished`           | `boolean`                               | `false`                    | All content loaded                                       |
| `endReachedThreshold`    | `number`                                | `2000`                     | Distance from the end at which load-more is considered   |
| `pageSize`               | `{ width: number; height: number }`     | `{ width: 0, height: 0 }`  | Paging step; zero uses the measured container dimension  |
| `pullRefreshHeader`      | component                               | `ElasticPullRefreshHeader` | Custom pull-to-refresh header component                  |
| `loadMoreFooter`         | component                               | built-in footer            | Custom load-more footer component                        |

Handle method (via `ref`):

```tsx
const ref = useRef<ElasticScrollViewHandle>(null);
await ref.current?.scrollTo({ x: 0, y: 0 }, true); // scroll to offset, optionally animated
```

Both `scrollTo` and `scroll` return `Promise<void>`. The component also accepts standard React Native `ViewProps` and advanced props such as `contentInsets`, `contentOffset`, and scroll lifecycle callbacks; see `TElasticScrollViewProps` for the full definition.

### ElasticPullRefreshHeader

Default pull-to-refresh indicator. You can pass a custom forward-ref component through `ElasticScrollView`'s `pullRefreshHeader` prop; it must expose the same ref interface and a numeric static `height`. Derive the accepted component type from `TElasticScrollViewProps['pullRefreshHeader']` when authoring a custom header.

### MasonryList

Waterfall list with the library's own layout cache and cell-reuse layer. It is the long-list component in this package and does not require FlatList, FlashList, or LegendList.

Required props (generic over item type `T`):

| Prop            | Type                                            | Description          |
| --------------- | ----------------------------------------------- | -------------------- |
| `onFetch`       | `(page, ctx, signal?) => Promise<TFetchRes<T>>` | Fetch a page of data |
| `heightForItem` | `(item, index, sectionIndex) => number`         | Height of each item  |
| `renderItem`    | `(item, index, sectionIndex) => ReactNode`      | Render each item     |

`onFetch` receives page `0` for the initial load and an optional `AbortSignal`; honor the signal when your data client supports cancellation. Return either `items` or `sections` (not both), and set `hasMore` to control further pagination. `heightForItem` must return the rendered item's actual height.

`renderError` receives `{ error, phase, retry }`. `phase` is `initial`, `refresh`, or `loadMore`; call `retry()` to repeat the failed request. Existing zero-argument error renderers remain supported. Set an item's optional `reuseType` when heterogeneous item layouts should be recycled separately.

See `TMasonryListProps` for the full prop type.

### Public Types

`ElasticScrollViewHandle`, `StickyTabViewHandle`, `TDirection`, `TElasticScrollViewProps`, `TFetchContext`, `TFetchRes`, `TItemBase`, `TMasonryErrorInfo`, `TMasonryListProps`, `TMasonryRequestPhase`, `TOnRefreshParam`, `TPanHandler`, `TSectionData`, `TStickyTabViewProps`.

Import them with `import type`:

```tsx
import type {
  ElasticScrollViewHandle,
  StickyTabViewHandle,
  TMasonryListProps,
  TStickyTabViewProps,
} from '@jadezhou/sticky-tab-view';
```

## Usage Examples

### Pull-to-refresh

```tsx
<ElasticScrollView
  onRefresh={(refresh: TOnRefreshParam) => {
    loadData().then(() => refresh.endRefresh());
  }}
>
  {/* content */}
</ElasticScrollView>
```

### Pagination (load more)

`onEndReached` resolves a boolean: `true` means more content is available, `false` (or `undefined`) stops further requests. Set `loadFinished` once there is no more data.

```tsx
const [loadFinished, setLoadFinished] = useState(false);

<ElasticScrollView
  loadFinished={loadFinished}
  onEndReached={async () => {
    const hasMore = await loadNextPage();
    if (!hasMore) setLoadFinished(true);
    return hasMore;
  }}
>
  {/* content */}
</ElasticScrollView>;
```

### Lazy tabs

```tsx
<StickyTabView
  lazy
  lazyPreloadDistance={1}
  tabCount={4}
  renderHeader={renderHeader}
  renderTab={renderTab}
/>
```

### Error handling (MasonryList)

```tsx
<MasonryList
  onFetch={fetchPage}
  heightForItem={heightForItem}
  renderItem={renderItem}
  renderError={({ error, phase, retry }) => (
    <View>
      <Text>Failed to load ({phase}).</Text>
      <Button title="Retry" onPress={retry} />
    </View>
  )}
/>
```

## Platform Support

| Feature              | iOS | Android | Web                        |
| -------------------- | --- | ------- | -------------------------- |
| Sticky Header + Tabs | ✅  | ✅      | Experimental (build smoke) |
| Pull-to-Refresh      | ✅  | ✅      | Experimental (build smoke) |
| Paging               | ✅  | ✅      | Experimental (build smoke) |
| Masonry Layout       | ✅  | ✅      | Experimental (build smoke) |

The library's supported targets are iOS and Android. The Expo example retains an experimental `react-native-web` build smoke, but browser interaction, gesture, and performance compatibility are not part of the release contract.

## Troubleshooting

### `Failed to create a worklet` or a Reanimated version mismatch

Confirm that the app uses the peer versions in the compatibility matrix, that the Reanimated Babel plugin is active (see [Babel Setup](#babel-setup)), and restart Metro with a clean cache. Rebuild the native app after installing or upgrading `react-native-reanimated`.

### Gestures do not respond

Confirm that `GestureHandlerRootView` wraps the app root and that all related gestures are mounted beneath the same root view.

### CommonJS or old Jest tooling cannot import the package

The package is ESM-only. Configure the consuming toolchain to resolve ESM, or use an ESM-compatible test and build setup.

## Reanimated 3 Compatibility Line

This document describes the **Reanimated 3 compatibility line (`1.x`)**, published under the `reanimated3` / `reanimated3-next` dist-tags. The **Reanimated 4 main line (`2.x`)** (`latest` / `next`) is the current default. The two lines never cross dist-tags.

## Development

```bash
# Install dependencies
pnpm install

# Run type check
pnpm typecheck

# Run tests
pnpm test

# Build JS + type declarations to dist/
pnpm build

# Start the example app
cd example && pnpm start
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

[MIT](./LICENSE)
