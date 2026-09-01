/**
 * RN CLI 0.81 anchor consumer fixture（Reanimated 3 维护线）。
 *
 * 目的：以真实消费者身份覆盖库的关键路径 typecheck——StickyTabView、
 * ElasticScrollView（pull-to-refresh + infinite load）、MasonryList 分页，
 * 以及两个 handle 与 SharedValue 驱动的手势协调 props。
 *
 * 本文件仅用于依赖解析与类型检查（V3-3-05）；native 真机构建在 Phase 6 原生矩阵
 * CI（PR-3）中验证。
 */

import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, { SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import {
  ElasticScrollView,
  ElasticScrollViewHandle,
  ElasticPullRefreshHeader,
  MasonryList,
  StickyTabView,
  StickyTabViewHandle,
  TItemBase,
  TOnRefreshParam,
  TSectionData,
  TFetchContext,
  TFetchRes,
} from '@jadezhou/sticky-tab-view';

type Card = TItemBase & {
  id: string;
  title: string;
  height: number;
};

const CARD_SOURCE: Card[] = Array.from({ length: 80 }, (_, i) => ({
  id: String(i),
  title: `card-${i}`,
  height: 80 + ((i * 37) % 140),
}));

async function fetchCards(
  page: number,
  _ctx: TFetchContext,
  _signal?: AbortSignal,
): Promise<TFetchRes<Card>> {
  const start = page * 20;
  return {
    hasMore: start + 20 < CARD_SOURCE.length,
    items: CARD_SOURCE.slice(start, start + 20),
  };
}

function Header(): React.ReactElement<unknown> {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>RN CLI 0.81 fixture</Text>
    </View>
  );
}

function TabArticles(): React.ReactElement<unknown> {
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadFinished, setLoadFinished] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const offsetY = useSharedValue(0);

  const onRefresh = ({ endRefresh }: TOnRefreshParam) => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      endRefresh();
    }, 400);
  };

  const onEndReached = async (): Promise<boolean | undefined> => {
    if (loadFinished) return undefined;
    setLoadingMore(true);
    await new Promise((r) => setTimeout(r, 300));
    setLoadingMore(false);
    setLoadFinished(true);
    return undefined;
  };

  return (
    <ElasticScrollView
      bounces
      pullRefreshHeader={ElasticPullRefreshHeader}
      refreshing={refreshing}
      loadingMore={loadingMore}
      loadFinished={loadFinished}
      onRefresh={onRefresh}
      onEndReached={onEndReached}
      onScroll={(p) => {
        offsetY.value = p.y;
      }}
      contentInsets={{ top: 8, bottom: 24, left: 0, right: 0 }}
    >
      {CARD_SOURCE.slice(0, 40).map((c) => (
        <View key={c.id} style={[styles.card, { height: c.height }]}>
          <Text>{c.title}</Text>
        </View>
      ))}
    </ElasticScrollView>
  );
}

function TabMasonry(): React.ReactElement<unknown> {
  const [, setData] = React.useState<readonly TSectionData<Card>[]>([]);

  const onDataUpdate = (next: readonly TSectionData<Card>[]) => setData(next);

  const renderItem = (item: Card) => (
    <View style={[styles.card, { height: item.height }]}>
      <Text>{item.title}</Text>
    </View>
  );

  const heightForItem = (item: Card) => item.height;

  return (
    <MasonryList
      onFetch={fetchCards}
      heightForItem={heightForItem}
      renderItem={renderItem}
      onDataUpdate={onDataUpdate}
      renderError={({ retry }) => (
        <Text style={styles.card} onPress={retry}>
          retry
        </Text>
      )}
      gap={8}
    />
  );
}

export default function App(): React.ReactElement<unknown> {
  const stickyRef = useRef<StickyTabViewHandle>(null);
  const elasticRef = useRef<ElasticScrollViewHandle>(null);
  const focus = useSharedValue<boolean | 'vertical' | 'horizontal'>(false);

  const headerStyle = useAnimatedStyle(() => ({ opacity: 1 }));

  const renderTab = (tab: number): React.ReactElement<unknown> | null => {
    switch (tab) {
      case 0:
        return <TabArticles />;
      case 1:
        return <TabMasonry />;
      default:
        return null;
    }
  };

  const renderTabBar = useMemo(
    () =>
      (x: SharedValue<number>, ys: SharedValue<number>[], current: SharedValue<number>) => (
        <View style={styles.tabBar}>
          <Text style={styles.tabBarLabel}>page-{current.value}</Text>
          <Text style={styles.tabBarLabel}>x={x.value.toFixed(0)}</Text>
          <Text style={styles.tabBarLabel}>tabs={ys.length}</Text>
        </View>
      ),
    [],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <Reanimated.View style={[styles.stage, headerStyle]}>
        <StickyTabView
          ref={stickyRef}
          tabCount={2}
          lazy
          lazyPreloadDistance={1}
          tabBarHeight={44}
          headerOffset={8}
          renderHeader={Header}
          renderTab={renderTab}
          renderTabBar={renderTabBar}
        />
        <View style={styles.controls}>
          <Text
            style={styles.control}
            onPress={() => elasticRef.current?.scrollTo?.({ x: 0, y: 0 })}
          >
            scroll-top
          </Text>
          <Text style={styles.control} onPress={() => focus.value = false}>
            focus-reset
          </Text>
        </View>
      </Reanimated.View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F3F7' },
  stage: { flex: 1 },
  header: { height: 120, backgroundColor: '#6C5CE7', justifyContent: 'center', padding: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tabBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
  },
  tabBarLabel: { color: '#333', fontSize: 12 },
  card: { backgroundColor: '#fff', marginVertical: 4, borderRadius: 8, padding: 12 },
  controls: { position: 'absolute', bottom: 24, left: 16, flexDirection: 'row', gap: 12 },
  control: { color: '#0984E3', fontSize: 14, fontWeight: '600' },
});
