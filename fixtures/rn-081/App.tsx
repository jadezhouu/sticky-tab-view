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

import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Reanimated, {
  SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { scheduleOnReactNative } from './src/utils/scheduleOnReactNative';

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

// 布局常量：每个 Tab 必须在内容顶部预留「头部高度 + Tab 栏高度」的空位，
// 否则第一项会被画到可折叠头部之下（README「两个容易漏掉的要求」第 1 条）。
const HEADER_H = 120;
const TAB_BAR_H = 44;
const TOTAL_H = HEADER_H + TAB_BAR_H;

// 与 Articles Tab 使用**不同的可见数据**：两个 Tab 若共用同一份数据和同一种卡片，
// 冒烟时肉眼无法判断是否真的切换了页面（这是夹具此前的缺陷之一）。
const gridCards = (items: Card[]): Card[] =>
  items.map((c) => ({ ...c, title: c.title.replace('card-', 'grid-') }));

async function fetchCards(
  page: number,
  _ctx: TFetchContext,
  _signal?: AbortSignal,
): Promise<TFetchRes<Card>> {
  const start = page * 20;
  return {
    hasMore: start + 20 < CARD_SOURCE.length,
    items: gridCards(CARD_SOURCE.slice(start, start + 20)),
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
      {/* 必须预留头部高度，否则首项会被画到头部/Tab 栏之下 */}
      <View style={{ height: TOTAL_H }} />
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
      // 库的默认值是 () => 1（单列）；不显式传 2 列的话这个 Tab 会长得和
      // Articles 几乎一样，夹具就失去了判别力。
      columnForSection={() => 2}
      heightForItem={heightForItem}
      renderItem={renderItem}
      onDataUpdate={onDataUpdate}
      // MasonryList 通过 renderHeader 接收同一个头部高度占位
      renderHeader={() => <View style={{ height: TOTAL_H }} />}
      renderError={({ retry }) => (
        <Text style={styles.card} onPress={retry}>
          retry
        </Text>
      )}
      gap={8}
    />
  );
}

/**
 * 诊断用 Tab 栏。
 *
 * 库把 x / ys / current 作为 **SharedValue** 传入，必须在 UI 线程消费：在 render 里直接读
 * `.value` 只会取到一次性快照，标签会冻结（这是夹具此前的缺陷之一）。这里用
 * `useAnimatedReaction` 观测页号、经本地适配层 `scheduleOnReactNative` 送回 JS state，
 * 并用 `useAnimatedStyle` 让指示条与分页进度完全跑在 UI 线程。
 */
function FixtureTabBar({
  current,
  onSelect,
  x,
  ys,
}: {
  current: SharedValue<number>;
  onSelect: (index: number) => void;
  x: SharedValue<number>;
  ys: SharedValue<number>[];
}): React.ReactElement<unknown> {
  const [page, setPage] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useSharedValue(0);
  const tabCount = Math.max(1, ys.length);

  useAnimatedReaction(
    () => current.value,
    (next, prev) => {
      if (next !== prev) scheduleOnReactNative(setPage, next);
    },
  );

  const tabWidth = barWidth / tabCount;

  React.useEffect(() => {
    indicatorX.value = withSpring(page * tabWidth, { damping: 22, stiffness: 320 });
  }, [indicatorX, page, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  // 分页偏移的实时读数：在 UI 线程算，不触发 JS 重渲染。
  const progressStyle = useAnimatedStyle(() => {
    const span = Math.max(1, barWidth * (tabCount - 1));
    return { width: `${Math.min(100, (Math.abs(x.value) / span) * 100)}%` };
  });

  return (
    <View style={styles.tabBar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
      {Array.from({ length: tabCount }, (_, i) => (
        <Pressable key={i} onPress={() => onSelect(i)} style={styles.tabBarHit}>
          <Text style={[styles.tabBarLabel, i === page && styles.tabBarLabelActive]}>
            {i === page ? `page-${i}` : `tab-${i}`}
          </Text>
        </Pressable>
      ))}
      <Reanimated.View style={[styles.tabIndicator, { width: tabWidth }, indicatorStyle]} />
      <Reanimated.View style={[styles.tabProgress, progressStyle]} />
    </View>
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

  const renderTabBar = useCallback(
    (x: SharedValue<number>, ys: SharedValue<number>[], current: SharedValue<number>) => (
      <FixtureTabBar
        x={x}
        ys={ys}
        current={current}
        onSelect={(index) => stickyRef.current?.setTab(index)}
      />
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
          tabBarHeight={TAB_BAR_H}
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
  header: { height: HEADER_H, backgroundColor: '#6C5CE7', justifyContent: 'center', padding: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tabBar: {
    height: TAB_BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
  },
  tabBarHit: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  tabBarLabel: { color: '#333', fontSize: 12 },
  tabBarLabelActive: { color: '#6C5CE7', fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, height: 3, backgroundColor: '#6C5CE7' },
  tabProgress: { position: 'absolute', top: 0, left: 0, height: 2, backgroundColor: '#00B894' },
  card: { backgroundColor: '#fff', marginVertical: 4, borderRadius: 8, padding: 12 },
  controls: { position: 'absolute', bottom: 24, left: 16, flexDirection: 'row', gap: 12 },
  control: { color: '#0984E3', fontSize: 14, fontWeight: '600' },
});
