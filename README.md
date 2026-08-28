# StickyTabView

A high-performance React Native component library providing a collapsible header, horizontal tab paging, and gesture-driven scroll synchronization. Built on `react-native-reanimated` and `react-native-gesture-handler`.

## Features

- **StickyTabView** — Collapsible header + horizontal paging tabs with synchronized scroll positions
- **ElasticScrollView** — Gesture-driven scroll view with bounce, paging, and header linkage
- **ElasticPullRefreshHeader** — Built-in pull-to-refresh indicator (customizable via the `PullRefreshHeaderComponent` contract)
- **MasonryList** — High-performance waterfall/masonry list with cell recycling, pagination, and multi-section support

## Requirements

- **New Architecture (Fabric) is required.** This library is built for React Native's New Architecture only; the Paper / Legacy Architecture is not supported.
- **`react-native-worklets/plugin` must be configured** (see [Babel setup](#babel-setup)). Without it, worklet functions crash at runtime.

## Installation

```bash
npm install @jadezhou/sticky-tab-view
# or
pnpm add @jadezhou/sticky-tab-view
# or
yarn add @jadezhou/sticky-tab-view
```

### Peer Dependencies

Install these alongside the library:

```bash
npm install react react-native react-native-gesture-handler react-native-reanimated react-native-worklets
```

| Dependency | Required range |
|------------|----------------|
| `react` | `>=19.1.0 <20.0.0` |
| `react-native` | `>=0.81.0 <0.82.0` |
| `react-native-gesture-handler` | `>=2.28.0 <2.29.0` |
| `react-native-reanimated` | `>=4.1.0 <4.2.0` |
| `react-native-worklets` | `>=0.5.0 <0.6.0` |

### Compatibility Matrix

This release supports and is verified against the following combination:

| Dependency | Version |
|------------|---------|
| React | 19.1.0 |
| React Native | 0.81.x |
| react-native-gesture-handler | 2.28.x |
| react-native-reanimated | 4.1.x |
| react-native-worklets | 0.5.x |
| Architecture | New Architecture (Fabric) only |

Web/H5 is **not** part of the release contract; it is exercised only as an experimental build smoke (see [Platform Support](#platform-support)).

## Babel Setup

**This is a mandatory step.** Add `react-native-worklets/plugin` to your `babel.config.js`.

**If using Expo** (the host project already has `babel-preset-expo`):

```js
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-worklets/plugin'],
};
```

**If using React Native CLI** (keep your existing preset, only add the plugin):

```js
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-worklets/plugin'],
};
```

Do **not** add `babel-preset-expo` if your project doesn't already use Expo — the library itself has no Expo dependency.

After changing `babel.config.js` you must rebuild your app so the new plugin takes effect:

- **Expo Dev Client / native build** — restart the dev server and rebuild the native app (`npx expo run:ios` / `npx expo run:android`).
- **React Native CLI** — restart Metro with `--reset-cache` and rebuild the native binary.
- A plain Metro reload is **not** enough: the Worklets Babel plugin rewrites worklet functions at transform time.

## Quick Start

A minimal, copy-paste screen. It uses no safe-area or external hooks beyond the library's own peer dependencies.

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

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tabCount` | `number` | _(required)_ | Number of horizontal tabs |
| `renderHeader` | `() => ReactElement` | _(required)_ | Render the collapsible header |
| `renderTab` | `(tab: number) => ReactElement \| null` | _(required)_ | Render content for each tab |
| `renderTabBar` | `(x, ys, current) => ReactNode` | — | Custom tab bar component |
| `lazy` | `boolean` | `false` | Lazy-load tabs (only render when visible) |
| `lazyPreloadDistance` | `number` | — | Preload distance (in tabs) when `lazy` |
| `current` | `number` | `0` | Initial tab index |
| `tabBarHeight` | `number` | `50` | Height of the tab bar |
| `headerOffset` | `number` | `0` | Extra offset for the header |

Handle method:

```tsx
const ref = useRef<StickyTabViewHandle>(null);
ref.current?.setTab(1); // programmatically switch tab
```

### ElasticScrollView

A gesture-driven scroll container. Like React Native's `ScrollView`, it renders the children supplied by the caller and does **not** virtualize arbitrary child elements. Use it for bounded content and for the sticky header, paging, refresh, and load-more interactions. For long, unbounded lists prefer `MasonryList`.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bounces` | `boolean \| "vertical" \| "horizontal"` | `true` | Bounce direction |
| `pagingEnabled` | `boolean \| "vertical" \| "horizontal"` | `false` | Snap to pages |
| `scrollEnabled` | `boolean \| "vertical" \| "horizontal"` | `true` | Enable/disable scroll |
| `directionalLockEnabled` | `boolean` | `false` | Lock scroll to one direction |
| `decelerationRate` | `number` | `0.998` | Deceleration factor |
| `onRefresh` | `(refresh: TOnRefreshParam) => void` | — | Pull-to-refresh callback |
| `onEndReached` | `() => Promise<boolean \| undefined>` | — | Load-more callback; resolves whether more content exists |
| `refreshing` | `boolean` | `false` | Controlled refresh state |
| `loadingMore` | `boolean` | `false` | Loading-more indicator |
| `loadFinished` | `boolean` | `false` | All content loaded |

Handle method (via `ref`):

```tsx
const ref = useRef<ElasticScrollViewHandle>(null);
ref.current?.scrollTo({ x: 0, y: 0 }, true); // scroll to offset, optionally animated
```

### ElasticPullRefreshHeader

Default pull-to-refresh indicator. It implements the `PullRefreshHeaderComponent` contract (a forward-ref component with a static `height`), so you can pass a custom header via `ElasticScrollView`'s `pullRefreshHeader` prop.

### MasonryList

High-performance waterfall list with the library's own layout and cell-reuse layer. It is the long-list component in this package and does not require FlatList, FlashList, or LegendList.

Required props (generic over item type `T`):

| Prop | Type | Description |
|------|------|-------------|
| `onFetch` | `(page, ctx, signal?) => Promise<TFetchRes<T>>` | Fetch a page of data |
| `heightForItem` | `(item, index, sectionIndex) => number` | Height of each item |
| `renderItem` | `(item, index, sectionIndex) => ReactNode` | Render each item |

`renderError` receives `{ error, phase, retry }`. `phase` is `initial`, `refresh`, or `loadMore`; call `retry()` to repeat the failed request. Existing zero-argument error renderers remain supported.

See `TMasonryListProps` for the full prop type.

### Public Types

`TDirection`, `TElasticScrollViewProps`, `TFetchContext`, `TFetchRes`, `TItemBase`, `TMasonryErrorInfo`, `TMasonryListProps`, `TMasonryRequestPhase`, `TOnRefreshParam`, `TPanHandler`, `TSectionData`, `TStickyTabViewProps`.

Import them with `import type`:

```tsx
import type { TStickyTabViewProps, TMasonryListProps } from '@jadezhou/sticky-tab-view';
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
</ElasticScrollView>
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

| Feature | iOS | Android | Web |
|---------|-----|---------|-----|
| Sticky Header + Tabs | ✅ | ✅ | Experimental (build smoke) |
| Pull-to-Refresh | ✅ | ✅ | Experimental (build smoke) |
| Paging | ✅ | ✅ | Experimental (build smoke) |
| Masonry Layout | ✅ | ✅ | Experimental (build smoke) |

The library's supported targets are iOS and Android. The Expo example retains an experimental `react-native-web` build smoke, but browser interaction, gesture, and performance compatibility are not part of the release contract.

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
