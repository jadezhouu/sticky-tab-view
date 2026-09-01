import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  cancelAnimation,
  makeMutable,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnReactNative } from './scheduleOnReactNative.js';
import { StickyTabContext } from './core/contexts.js';
import { normalizePage } from './core/geometry.js';
import { ElasticScrollView } from './scroll/ElasticScrollView.js';
import type { TGestureContext, TPanEvent, TScrollHandlers, TStickyTabContext, TStickyTabViewProps } from './types.js';

/**
 * Imperative handle for {@link StickyTabView}, exposed via `ref`.
 *
 * @public
 */
export interface StickyTabViewHandle {
  setTab: (page: number) => void;
}

/** A paged container with a shared collapsible header. */
export const StickyTabView = React.forwardRef<StickyTabViewHandle, TStickyTabViewProps>(
  function StickyTabView(props, ref) {
    const {
      current,
      headerOffset = 0,
      lazy = false,
      lazyPreloadDistance = 0,
      renderHeader,
      renderTab,
      renderTabBar,
      tabBarHeight = 50,
      tabCount: requestedTabCount,
      style,
      ...viewProps
    } = props;
    const tabCount = Math.max(0, Math.trunc(requestedTabCount) || 0);
    const tabIndices = useMemo(() => Array.from({ length: tabCount }, (_, index) => index), [tabCount]);
    const initialPageRef = useRef(normalizePage(current, tabCount));
    const currentPage = useSharedValue(initialPageRef.current);
    const headerWidth = useSharedValue(0);
    const headerHeight = useSharedValue(0);
    const pagerWidth = useSharedValue(0);
    const x = useSharedValue(0);
    const focus = useSharedValue<boolean | 'horizontal' | 'vertical'>(false);
    const valuesRef = useRef(new Map<number, ReturnType<typeof makeMutable<number>>>());
    const handlersRef = useRef(new Map<number, ReturnType<typeof makeMutable<TScrollHandlers>>>());
    const listenersRef = useRef(new Set<(tab: number) => void>());
    const [visited, setVisited] = useState<Set<number>>(() => new Set([initialPageRef.current]));

    const ys = tabIndices.map((index) => {
      let value = valuesRef.current.get(index);
      if (!value) {
        value = makeMutable(0);
        valuesRef.current.set(index, value);
      }
      return value;
    });
    const handlers = tabIndices.map((index) => {
      let value = handlersRef.current.get(index);
      if (!value) {
        value = makeMutable<TScrollHandlers>({});
        handlersRef.current.set(index, value);
      }
      return value;
    });

    const markVisited = React.useCallback((page: number) => {
      setVisited((previous) => {
        if (previous.has(page)) return previous;
        const next = new Set(previous);
        next.add(page);
        return next;
      });
    }, []);

    const synchronizeHeader = React.useCallback(() => {
      'worklet';
      const page = normalizePage(currentPage.value, ys.length);
      const source = ys[page]?.value ?? 0;
      const maxOffset = Math.max(0, headerHeight.value - tabBarHeight - headerOffset);
      ys.forEach((offset) => {
        if (source < maxOffset) offset.value = source;
        else if (offset.value < maxOffset) offset.value = maxOffset;
      });
    }, [headerHeight, headerOffset, currentPage, tabBarHeight, ys]);

    const changeTab = React.useCallback((requestedPage: number, animated: boolean) => {
      const page = normalizePage(requestedPage, ys.length);
      if (page === currentPage.value) return;
      markVisited(page);
      synchronizeHeader();
      currentPage.value = page;
      const target = page * pagerWidth.value;
      x.value = animated && pagerWidth.value > 0
        ? withSpring(target, { damping: 50, mass: 1, stiffness: 625 })
        : target;
    }, [currentPage, markVisited, pagerWidth, synchronizeHeader, x, ys.length]);

    const handlePagerSizeChange = React.useCallback((size: { width: number }) => {
      if (size.width <= 0) return;
      pagerWidth.value = size.width;
      cancelAnimation(x);
      x.value = normalizePage(currentPage.value, tabCount) * size.width;
    }, [currentPage, pagerWidth, tabCount, x]);

    React.useImperativeHandle(ref, () => ({ setTab: (page) => changeTab(page, true) }), [changeTab]);

    useEffect(() => {
      const page = normalizePage(currentPage.value, tabCount);
      if (page !== currentPage.value) currentPage.value = page;
      x.value = page * pagerWidth.value;
      for (const [index, value] of Array.from(valuesRef.current.entries())) {
        if (index >= tabCount) {
          cancelAnimation(value);
          valuesRef.current.delete(index);
        }
      }
      for (const [index, value] of Array.from(handlersRef.current.entries())) {
        if (index >= tabCount) {
          cancelAnimation(value);
          handlersRef.current.delete(index);
        }
      }
      setVisited((previous) => {
        const next = new Set(Array.from(previous).filter((index) => index < tabCount));
        return next.size === previous.size ? previous : next;
      });
    }, [currentPage, pagerWidth, tabCount, x]);

    useEffect(() => () => {
      valuesRef.current.forEach(cancelAnimation);
      handlersRef.current.forEach(cancelAnimation);
      listenersRef.current.clear();
    }, []);

    const notifyTabChange = React.useCallback((page: number) => {
      markVisited(page);
      listenersRef.current.forEach((listener) => listener(page));
    }, [markVisited]);

    useAnimatedReaction(
      () => currentPage.value,
      (page, previous) => {
        if (page !== previous) scheduleOnReactNative(notifyTabChange, page);
      },
      [notifyTabChange],
    );
    useAnimatedReaction(
      () => focus.value,
      (next, previous) => {
        if (next && next !== previous) synchronizeHeader();
      },
      [synchronizeHeader],
    );

    const actions = useMemo(() => tabIndices.map((index) => ({
      tab: lazy ? index : undefined,
      contentOffset: { y: ys[index] },
      handlersMutable: handlers[index],
      onTabChange(listener: (tab: number) => void) {
        listenersRef.current.add(listener);
        return () => listenersRef.current.delete(listener);
      },
    }) as TStickyTabContext), [handlers, lazy, tabIndices, ys]);

    const panHandler = useMemo<TScrollHandlers>(() => ({
      hasGestureFocus: () => handlers[normalizePage(currentPage.value, handlers.length)]?.value.hasGestureFocus?.() ?? false,
      claimGestureFocus: () => { 'worklet'; },
      onStart: (event: TPanEvent, context: TGestureContext) => {
        'worklet';
        context.isForwarded = true;
        handlers[normalizePage(currentPage.value, handlers.length)]?.value.onStart?.(event, context);
      },
      onActive: (event: TPanEvent, context: TGestureContext) => {
        'worklet';
        const active = normalizePage(currentPage.value, handlers.length);
        const direction = event.translationX === 0 ? 0 : event.translationX > 0 ? -1 : 1;
        if (lazy && Math.abs(event.translationX) > 2) scheduleOnReactNative(markVisited, normalizePage(active + direction, handlers.length));
        handlers[active]?.value.onActive?.(event, context);
      },
      onEnd: (event, context) => { 'worklet'; handlers[normalizePage(currentPage.value, handlers.length)]?.value.onEnd?.(event, context); },
      onCancel: (event, context) => { 'worklet'; handlers[normalizePage(currentPage.value, handlers.length)]?.value.onCancel?.(event, context); },
      onFail: (event, context) => { 'worklet'; handlers[normalizePage(currentPage.value, handlers.length)]?.value.onFail?.(event, context); },
    }), [currentPage, handlers, lazy, markVisited]);

    const headerTransform = useAnimatedStyle(() => {
      const page = normalizePage(currentPage.value, ys.length);
      const maxOffset = Math.max(0, headerHeight.value - tabBarHeight - headerOffset);
      return { transform: [{ translateY: -Math.min(ys[page]?.value ?? 0, maxOffset) }] };
    }, [headerOffset, tabBarHeight, ys]);
    const tabContainerStyle = useMemo(() => ({ flex: 1, width: `${tabCount * 100}%` as `${number}%`, flexDirection: 'row' as const }), [tabCount]);
    const shouldRender = (index: number) => !lazy || visited.has(index) || Math.abs(index - currentPage.value) <= lazyPreloadDistance;

    return (
      <View {...viewProps} style={[styles.container, style]}>
        <ElasticScrollView bounces={false} contentContainerStyle={tabContainerStyle} contentOffset={{ x }} currentPage={currentPage} focus={focus} onSizeChange={handlePagerSizeChange} pagingEnabled="horizontal" scrollEnabled="horizontal" showsHorizontalScrollIndicator={false}>
          {tabIndices.map((index) => (
            <View key={index} style={styles.tabPage}>
              <StickyTabContext.Provider value={actions[index]}>{shouldRender(index) ? renderTab(index) : null}</StickyTabContext.Provider>
            </View>
          ))}
        </ElasticScrollView>
        <ElasticScrollView panHandler={panHandler} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} size={{ width: headerWidth, height: headerHeight }} style={[styles.header, headerTransform]}>
          {renderHeader()}
          {renderTabBar?.(x, ys, currentPage)}
        </ElasticScrollView>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  header: { left: 0, position: 'absolute', right: 0, top: 0 },
  tabPage: { flex: 1 },
});
