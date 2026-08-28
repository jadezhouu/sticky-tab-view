# StickyTabView

React Native components for a collapsible header, horizontal tab paging, gesture-driven scroll synchronization, and masonry layouts. Built on `react-native-reanimated` and `react-native-gesture-handler`.

> **Beta release.** The current Reanimated 4 release line is published under the `next` dist-tag. Use it in development first and pin a tested version for production applications.

<!-- Screenshot placeholder: replace this block with a real screenshot or GIF before the stable release. Suggested path: ./docs/assets/sticky-tab-view-demo.png -->
<p align="center"><em>Demo screenshot placeholder — add a real iOS or Android screenshot here.</em></p>

## Features

- **StickyTabView** — Collapsible header + horizontal paging tabs with synchronized scroll positions
- **ElasticScrollView** — Gesture-driven scroll view with bounce, paging, and header linkage
- **ElasticPullRefreshHeader** — Built-in pull-to-refresh indicator (customizable via the `PullRefreshHeaderComponent` contract)
- **MasonryList** — High-performance waterfall/masonry list with cell recycling, pagination, and multi-section support

## Requirements

- **New Architecture (Fabric) is required.** This library is built for React Native's New Architecture only; the Paper / Legacy Architecture is not supported.
- **Node.js `>=20.19.4`** is required for development and tooling.
- This is an **ESM-only** package; no CommonJS build is provided.
- The app must be mounted under [`GestureHandlerRootView`](#gesture-handler-root-view).
- The Worklets Babel plugin must be active. Expo SDK 54 configures it through `babel-preset-expo`; React Native Community CLI projects configure it explicitly (see [Babel setup](#babel-setup)).

## Installation

```bash
npm install @jadezhou/sticky-tab-view@next
# or
pnpm add @jadezhou/sticky-tab-view@next
# or
yarn add @jadezhou/sticky-tab-view@next
```

When `2.0.0` is released to `latest`, the `@next` suffix can be omitted.

### Peer Dependencies

Your app must already use the compatible React and React Native versions shown below. Do not use this library's installation command to upgrade an existing app's `react` or `react-native` version.

For an Expo SDK 54 project, install compatible native peers with Expo:

```bash
npx expo install react-native-gesture-handler react-native-reanimated react-native-worklets
```

For React Native Community CLI, install versions within the listed peer ranges, then rebuild the native app. Your package manager may install missing peer dependencies automatically; verify the resolved versions before running the app.

| Dependency                     | Required range     |
| ------------------------------ | ------------------ |
| `react`                        | `>=19.1.0 <20.0.0` |
| `react-native`                 | `>=0.81.0 <0.82.0` |
| `react-native-gesture-handler` | `>=2.28.0 <2.29.0` |
| `react-native-reanimated`      | `>=4.1.0 <4.2.0`   |
| `react-native-worklets`        | `>=0.5.0 <0.6.0`   |

### Compatibility Matrix

This release supports and is verified against the following combination:

| Dependency                   | Version                        |
| ---------------------------- | ------------------------------ |
| React                        | 19.1.0                         |
| React Native                 | 0.81.x                         |
| react-native-gesture-handler | 2.28.x                         |
| react-native-reanimated      | 4.1.x                          |
| react-native-worklets        | 0.5.x                          |
| Architecture                 | New Architecture (Fabric) only |

Web/H5 is **not** part of the release contract; it is exercised only as an experimental build smoke (see [Platform Support](#platform-support)).

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

The Worklets Babel plugin must be active for worklets to run. A missing or stale plugin configuration can produce errors such as `Failed to create a worklet`.

**Expo SDK 54** — `babel-preset-expo` includes the Worklets plugin by default. A standard Expo config needs no extra plugin entry:

```js
module.exports = {
  presets: ['babel-preset-expo'],
};
```

If your Expo project has a custom Babel configuration, verify that the plugin remains active and add it only when it is not already provided by the preset.

**React Native Community CLI** — keep your existing preset and add the plugin:

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets/plugin'],
};
```

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

A paged container with a shared collapsible header. Exposes an imperative handle via `ref`.

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

### `Failed to create a worklet` or a Worklets version mismatch

Confirm that the app uses the peer versions in the compatibility matrix, that the Worklets Babel plugin is active, and restart Metro with a clean cache. Rebuild the native app after installing or upgrading `react-native-reanimated` or `react-native-worklets`.

### Gestures do not respond

Confirm that `GestureHandlerRootView` wraps the app root and that all related gestures are mounted beneath the same root view.

### CommonJS or old Jest tooling cannot import the package

The package is ESM-only. Configure the consuming toolchain to resolve ESM, or use an ESM-compatible test and build setup.

## Reanimated 3 Compatibility Line

This repository currently ships the **Reanimated 4** line (`2.x`). A future **Reanimated 3** compatibility line (`1.x`) is planned, published under the `reanimated3` / `reanimated3-next` dist-tags. It is **not yet available** — do not assume Reanimated 3 support from this release.

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
