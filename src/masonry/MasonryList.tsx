import forEach from "lodash/forEach";
import React, {
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";

import { MasonryCell } from "./MasonryCell.js";
import { ElasticScrollView } from "../scroll/ElasticScrollView.js";
import { makeMutable, withDelay, withTiming } from "react-native-reanimated";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { StickyTabContext } from "../core/contexts.js";
import { styles } from "../styles.js";
import { TElasticScrollViewProps, TItemBase, TSize, TSectionData, TThumb, TFetchRes, TFetchCtx, TMasonryListProps, TMasonryRequestPhase, TOnRefreshParam } from "../types.js";
import {
  areDependencyListsEqual,
  createRequestGenerationGuard,
  isAbortError,
  makeAbortable,
  findShortestColumnIndex,
  normalizeMasonryLength,
  normalizeMasonryColumn,
  type TAbortablePromise,
} from "./model.js";

// ─────────────────────────────────────────────────────────────────────────────
// 所有原来的 class 实例变量统一放入一个 ref 对象，保证在 async 回调/闭包中始终
// 读写同一份引用，行为完全等价于 class 的 this.xxx。
// ─────────────────────────────────────────────────────────────────────────────
interface MasonryState<T extends TItemBase> {
  _inited: boolean;
  _size: TSize | undefined;
  _cSize: TSize | undefined;
  _data: TSectionData<T>[];
  _sourceData: TSectionData<T>[];
  _sourceHasSections: boolean;
  _thumbId: number;
  _elements: { elementId: number; thumbs: TThumb[] }[];
  _thumbs: TThumb[];
  _sectionHeaders: {
    section: TSectionData<T>;
    sectionIndex: number;
    y: number;
    height: number;
  }[];
  _lastHeights: number[];
  _lastSectionStart: number;
  _loadingMore: TAbortablePromise<TFetchRes<T>> | undefined;
  _canLoadMore: boolean;
  _page: number;
  _loading: boolean;
  _refreshing: boolean;
  _headerHeight: number | undefined;
  _footerHeight: number | undefined;
  _ctx: TFetchCtx;
  _fetching: TAbortablePromise<TFetchRes<T>> | undefined;
  _sumHeight: number | undefined;
  _isEmpty: boolean | undefined;
  _error: { error: unknown; phase: TMasonryRequestPhase } | undefined;
  _requestGuard: ReturnType<typeof createRequestGenerationGuard>;
}

function createInitialState<T extends TItemBase>(): MasonryState<T> {
  return {
    _inited: false,
    _size: undefined,
    _cSize: undefined,
    _data: [],
    _sourceData: [],
    _sourceHasSections: false,
    _thumbId: 0,
    _elements: [],
    _thumbs: [],
    _sectionHeaders: [],
    _lastHeights: [],
    _lastSectionStart: 0,
    _loadingMore: undefined,
    _canLoadMore: true,
    _page: 0,
    _loading: true,
    _refreshing: false,
    _headerHeight: undefined,
    _footerHeight: undefined,
    _ctx: {},
    _fetching: undefined,
    _sumHeight: undefined,
    _isEmpty: undefined,
    _error: undefined,
    _requestGuard: createRequestGenerationGuard(),
  };
}

const masonryDefaultProps = {
  horizontalPadding: 12,
  gap: 8,
  loadMoreDistance: 1000,
  bufferHeight: 500,
  renderLoading: () => null,
  columnForSection: () => 1,
  heightForSectionHeader: () => 0,
  renderSectionHeader: () => null,
  renderLoadingMore: () => null,
  renderHeader: () => null,
  renderFooter: () => null,
  deps: [] as unknown[],
  isEmpty: <T extends TItemBase>(data: readonly TSectionData<T>[]) =>
    data[0]?.items.length === 0,
};

const masonryOnlyPropNames = new Set<string>([
  "bufferHeight",
  "columnForSection",
  "deps",
  "disableRefresh",
  "filters",
  "gap",
  "heightForItem",
  "heightForSectionHeader",
  "horizontalPadding",
  "initData",
  "isEmpty",
  "loadMoreDistance",
  "onDataUpdate",
  "onFetch",
  "prependItems",
  "reloadTriggers",
  "renderBg",
  "renderEmpty",
  "renderError",
  "renderFooter",
  "renderHeader",
  "renderItem",
  "renderLoading",
  "renderLoadingMore",
  "renderSectionHeader",
]);

function getElasticScrollProps<T extends TItemBase>(
  props: Required<TMasonryListProps<T>>,
): TElasticScrollViewProps {
  return Object.fromEntries(
    Object.entries(props).filter(([name]) => !masonryOnlyPropNames.has(name)),
  ) as TElasticScrollViewProps;
}

/**
 * 高性能瀑布流列表组件，基于 ElasticScrollView 实现。
 *
 * 支持多 Section、不等高 Item、下拉刷新、上拉加载更多、
 * 以及基于 reuseType 的 Cell 回收复用机制。
 *
 * @public
 */
function MasonryListInner<T extends TItemBase>(
  userProps: TMasonryListProps<T>,
) {
  const props = { ...masonryDefaultProps, ...userProps } as Required<
    TMasonryListProps<T>
  >;

  const context = useContext(StickyTabContext);

  // SharedValues — 初次渲染时创建，此后保持稳定引用（对齐原 class 字段初始化）
  const yRef = useRef(
    context.contentOffset?.y ||
      props.contentOffset?.y ||
      makeMutable(0),
  );
  const xRef = useRef(
    props.contentOffset?.x,
  );

  // 所有可变实例状态
  const instanceState =
    useRef<MasonryState<T>>(createInitialState<T>()).current;

  // 触发 React re-render（等价于 class 的 forceUpdate）
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // 用于在 async 回调中读取最新 props，避免闭包陷阱
  const propsRef = useRef(props);
  propsRef.current = props;

  const notifyDataUpdate = useCallback(() => {
    propsRef.current.onDataUpdate?.(
      instanceState._data.map((section) => ({
        ...section,
        items: [...section.items],
      })),
    );
  }, [instanceState]);

  // ─── 贪心算法：将 items 分配到各列（瀑布流布局核心）───────────────────────
  const appendItemsToSection = useCallback(
    (
      items: T[],
      section: TSectionData<T>,
      sectionIndex: number,
      baseItemIndex = 0,
    ) => {
      const currentProps = propsRef.current;
      const size = instanceState._size;
      if (!size) return;
      const column = normalizeMasonryColumn(
        section.column ?? currentProps.columnForSection(section, sectionIndex),
      );
      const horizontalPadding = normalizeMasonryLength(currentProps.horizontalPadding);
      const gap = normalizeMasonryLength(currentProps.gap);
      const availableWidth = normalizeMasonryLength(size.width);
      const heights = instanceState._lastHeights;
      forEach(items, (item: T, itemIndex: number) => {
        const height = normalizeMasonryLength(currentProps.heightForItem(
          item,
          itemIndex + baseItemIndex,
          sectionIndex,
        ));
        const minIndex = findShortestColumnIndex(heights);
        const width = Math.max(
          0,
          (availableWidth - 2 * horizontalPadding - (column - 1) * gap) / column,
        );
        const x =
          (width + gap) * minIndex +
          horizontalPadding;
        const y = heights[minIndex];
        const thumbInfo: TThumb = {
          x,
          y,
          width,
          height,
          sectionIndex,
          itemIndex: itemIndex + baseItemIndex,
          thumbId: instanceState._thumbId,
          reuseType: item.reuseType,
        };
        let reuseThumb: TThumb | undefined;
        const viewport = instanceState._thumbs.filter(
          (thumb) =>
            thumb.y >
            y - size.height - 2 * currentProps.bufferHeight,
        );
        for (let i = instanceState._thumbs.length - 1; i >= 0; i--) {
          const thumb = instanceState._thumbs[i];
          if (
            thumb.y +
              thumb.height +
              currentProps.bufferHeight +
              size.height <
              y &&
            !viewport.find((t) => t.elementId === thumb.elementId) &&
            thumb.reuseType === item.reuseType
          ) {
            reuseThumb = thumb;
            break;
          }
        }
        let element = reuseThumb?.elementId === undefined
          ? undefined
          : instanceState._elements[reuseThumb.elementId];
        if (!element) {
          element = {
            elementId: instanceState._elements.length,
            thumbs: [{
              x,
              y,
              width,
              height,
              itemIndex: itemIndex + baseItemIndex,
              sectionIndex,
            }],
          };
          instanceState._elements.push(element);
        } else {
          element.thumbs.push(thumbInfo);
        }
        thumbInfo.elementId = element.elementId;
        instanceState._thumbs.push(thumbInfo);
        instanceState._thumbId++;
        // gap 同时作用于竖向：下一个 item 需在当前 item 底部再偏移 gap 像素
        heights[minIndex] += height + gap;
      });
      instanceState._lastHeights = heights;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ─── 重置数据（等价于 _initData）────────────────────────────────────────────
  const initData = useCallback((clearSource = true) => {
    instanceState._error = undefined;
    instanceState._data = [];
    if (clearSource) {
      instanceState._sourceData = [];
      instanceState._sourceHasSections = false;
    }
    instanceState._thumbs = [];
    instanceState._sectionHeaders = [];
    instanceState._elements = [];
    instanceState._lastHeights = [];
    instanceState._lastSectionStart = 0;
    instanceState._loadingMore = undefined;
    instanceState._page = 0;
    instanceState._canLoadMore = true;
    instanceState._thumbId = 0;
    instanceState._sumHeight = instanceState._headerHeight ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendSections = useCallback((
    sections: readonly TSectionData<T>[],
    renderHeaders = true,
  ) => {
    const currentProps = propsRef.current;
    forEach(sections, (source) => {
      const sectionIndex = instanceState._data.length;
      const section: TSectionData<T> = { ...source, items: [] };
      const requestedColumn = section.column ?? currentProps.columnForSection(section, sectionIndex);
      const column = normalizeMasonryColumn(requestedColumn);
      const headerHeight = renderHeaders
        ? normalizeMasonryLength(currentProps.heightForSectionHeader(section, sectionIndex))
        : 0;
      const headerY = instanceState._sumHeight ?? 0;
      if (renderHeaders) {
        instanceState._sectionHeaders.push({
          section,
          sectionIndex,
          y: headerY,
          height: headerHeight,
        });
      }
      instanceState._sumHeight = (instanceState._sumHeight ?? 0) + headerHeight;
      instanceState._lastHeights = new Array(column).fill(instanceState._sumHeight);
      appendItemsToSection([...source.items], section, sectionIndex);
      section.items.push(...source.items);
      instanceState._data.push(section);
      instanceState._sumHeight = Math.max(...instanceState._lastHeights);
    });
    instanceState._sumHeight = (instanceState._sumHeight ?? 0) + (instanceState._footerHeight ?? 0);
    instanceState._isEmpty = currentProps.isEmpty?.(instanceState._data);
    notifyDataUpdate();
  }, [appendItemsToSection, instanceState, notifyDataUpdate]);

  // ─── 加载第一页（等价于 _load）──────────────────────────────────────────────
  const load = useCallback(
    async (init = false, phase: TMasonryRequestPhase = "initial"): Promise<void> => {
      const currentProps = propsRef.current;
      const generation = instanceState._requestGuard.begin();
      instanceState._inited = true;
      instanceState._loading = true;
      instanceState._error = undefined;
      if (instanceState._fetching) instanceState._fetching.abort();
      if (instanceState._loadingMore) {
        instanceState._loadingMore.abort();
        instanceState._loadingMore = undefined;
      }
      const ctx = {};
      const initialSection = currentProps.initData?.[0];
      if (init && initialSection && Array.isArray(initialSection.items)) {
        let items = [...initialSection.items];
        if (currentProps.prependItems) items.push(...currentProps.prependItems);
        if (currentProps.filters)
          items = items.filter((t) => !currentProps.filters?.includes(t));
        let last = instanceState._data.pop();
        if (!last) {
          last = { items: [] };
          const column = normalizeMasonryColumn(currentProps.columnForSection(last, 0));
          instanceState._lastHeights = new Array(column).fill(
            instanceState._sumHeight,
          );
        }
        appendItemsToSection(
          items,
          last,
          instanceState._data.length,
          last.items.length,
        );
        last.items.push(...items);
        instanceState._data.push(last);
        instanceState._sumHeight = Math.max(...instanceState._lastHeights);
        instanceState._sumHeight += instanceState._footerHeight ?? 0;
        instanceState._canLoadMore = false;
        forceUpdate();
        if (yRef.current) {
          yRef.current.value = withDelay(
            250,
            withTiming(-72, { duration: 250 }),
          );
          try {
            await load();
            forceUpdate();
          } finally {
            yRef.current.value = withTiming(0, { duration: 250 });
          }
        }
        return;
      }
      const controller = new AbortController();
      let response: TFetchRes<T>;
      try {
        instanceState._fetching = makeAbortable(
          currentProps.onFetch(0, ctx, controller.signal),
          controller,
        );
        response = await instanceState._fetching;
      } catch (error) {
        const isCurrent = instanceState._requestGuard.isCurrent(generation);
        if (isCurrent) {
          instanceState._fetching = undefined;
          instanceState._loading = false;
          if (!isAbortError(error)) instanceState._error = { error, phase };
        }
        if (!isCurrent || isAbortError(error)) return;
        throw error;
      }
      if (!instanceState._requestGuard.isCurrent(generation)) return;
      if (response.items && response.sections) throw new Error("Fetch results must contain either items or sections, not both.");
      let items = response.items ? [...response.items] : response.sections?.flatMap((section) => section.items);
      const { hasMore } = response;
      initData();
      instanceState._ctx = ctx;
      if (response.sections) {
        instanceState._sourceHasSections = true;
        instanceState._sourceData = response.sections.map((section) => ({
          ...section,
          items: [...section.items],
        }));
        appendSections(response.sections);
        instanceState._loading = false;
        instanceState._canLoadMore = !!hasMore;
        instanceState._fetching = undefined;
        return;
      }
      if (items) {
        instanceState._sourceData = [{ items: [...items] }];
        instanceState._sourceHasSections = false;
        if (currentProps.prependItems) items.push(...currentProps.prependItems);
        if (currentProps.filters)
          items = items.filter((t) => !currentProps.filters?.includes(t));
        let last = instanceState._data.pop();
        if (!last) {
          last = { items: [] };
          const column = normalizeMasonryColumn(currentProps.columnForSection(last, 0));
          instanceState._lastHeights = new Array(column).fill(
            instanceState._sumHeight,
          );
        }
        appendItemsToSection(
          items,
          last,
          instanceState._data.length,
          last.items.length,
        );
        last.items.push(...items);
        instanceState._data.push(last);
        notifyDataUpdate();
        instanceState._sumHeight = Math.max(...instanceState._lastHeights);
        instanceState._sumHeight += instanceState._footerHeight ?? 0;
        instanceState._isEmpty = currentProps.isEmpty?.(instanceState._data);
      }
      instanceState._loading = false;
      instanceState._canLoadMore = !!hasMore;
      instanceState._fetching = undefined;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ─── 仅重排已有数据（等价于 _reload）────────────────────────────────────────
  const reload = useCallback(() => {
    const currentProps = propsRef.current;
    const sourceData = instanceState._sourceData;
    let items = instanceState._data[0]?.items;
    const more = instanceState._canLoadMore;
    if (sourceData.length > 0) {
      const sections = sourceData.map((section, sectionIndex) => {
        let sectionItems = [...section.items];
        if (sectionIndex === 0 && currentProps.prependItems) {
          sectionItems = [...currentProps.prependItems, ...sectionItems];
        }
        if (currentProps.filters) {
          sectionItems = sectionItems.filter(
            (item) => !currentProps.filters?.includes(item),
          );
        }
        return { ...section, items: sectionItems };
      });
      initData(false);
      appendSections(sections, instanceState._sourceHasSections);
      instanceState._canLoadMore = !!more;
      forceUpdate();
      return;
    }
    if (items) {
      initData();
      if (
        currentProps.prependItems &&
        items[0] !== currentProps.prependItems[0]
      ) {
        items.unshift(...currentProps.prependItems);
      }
      if (currentProps.filters) {
        const filters = currentProps.filters;
        items = items.filter((t) => filters.every((it) => it !== t));
      }
      let last = instanceState._data.pop();
      if (!last) {
        last = { items: [] };
        const column = normalizeMasonryColumn(currentProps.columnForSection(last, 0));
        instanceState._lastHeights = new Array(column).fill(
          instanceState._sumHeight,
        );
      }
      appendItemsToSection(
        items,
        last,
        instanceState._data.length,
        last.items.length,
      );
      last.items.push(...items);
      instanceState._data.push(last);
      notifyDataUpdate();
      instanceState._sumHeight = Math.max(...instanceState._lastHeights);
      instanceState._sumHeight += instanceState._footerHeight ?? 0;
      instanceState._isEmpty = currentProps.isEmpty?.(instanceState._data);
    }
    instanceState._canLoadMore = !!more;
    forceUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 布局尺寸就绪后尝试触发首次加载 ─────────────────────────────────────────
  const tryInitialLoad = useCallback(() => {
    const myTab = context.tab;
    const lazyLoad = myTab !== undefined && myTab !== 0;
    if (lazyLoad) return;
    if (
      instanceState._inited ||
      !instanceState._size ||
      instanceState._headerHeight === undefined ||
      instanceState._footerHeight === undefined
    )
      return;
    load(true)
      .catch(() => undefined)
      .finally(forceUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context]);

  // ─── 布局回调 ────────────────────────────────────────────────────────────────
  const onHeaderLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const headerHeight = e.nativeEvent.layout.height;
      if (instanceState._headerHeight === undefined) {
        instanceState._headerHeight = headerHeight;
        instanceState._sumHeight = headerHeight;
        tryInitialLoad();
        return;
      }
      const d = headerHeight - instanceState._headerHeight;
      if (d !== 0) {
        instanceState._headerHeight = headerHeight;
        instanceState._elements.forEach((el) => {
          el.thumbs.forEach((thumb) => {
            thumb.y += d;
          });
        });
        instanceState._sectionHeaders.forEach((header) => {
          header.y += d;
        });
        if (instanceState._sumHeight !== undefined)
          instanceState._sumHeight += d;
        if (instanceState._lastHeights)
          instanceState._lastHeights = instanceState._lastHeights.map(
            (item) => item + d,
          );
        forceUpdate();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tryInitialLoad],
  );

  const onFooterLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const nextHeight = e.nativeEvent.layout.height;
      const previousHeight = instanceState._footerHeight ?? 0;
      instanceState._footerHeight = nextHeight;
      if (instanceState._inited && instanceState._sumHeight !== undefined) {
        instanceState._sumHeight += nextHeight - previousHeight;
        forceUpdate();
      }
      tryInitialLoad();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tryInitialLoad],
  );

  const onSize = useCallback(
    (size: TSize) => {
      instanceState._size = size;
      tryInitialLoad();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tryInitialLoad],
  );

  // ─── 下拉刷新（等价于 _onRefresh）────────────────────────────────────────────
  const onRefresh = useCallback(async (ref: TOnRefreshParam) => {
    try {
      await load(false, "refresh").catch(() => undefined);
      forceUpdate();
    } finally {
      ref.canLoadMore.value = instanceState._canLoadMore;
      ref.endRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 加载更多（等价于 _onLoadMore）────────────────────────────────────────────
  const onLoadMore = useCallback(async () => {
    if (!instanceState._canLoadMore) return false;
    const currentProps = propsRef.current;
    const generation = instanceState._requestGuard.begin();
    instanceState._error = undefined;
    if (instanceState._loadingMore) instanceState._loadingMore.abort();
    const page = instanceState._page + 1;
    const controller = new AbortController();
    instanceState._loadingMore = makeAbortable(
      currentProps.onFetch(page, instanceState._ctx, controller.signal),
      controller,
    );
    let response: TFetchRes<T>;
    try {
      response = await instanceState._loadingMore;
    } catch (error) {
      const isCurrent = instanceState._requestGuard.isCurrent(generation);
      if (isCurrent) {
        instanceState._loadingMore = undefined;
      }
      if (!isCurrent || isAbortError(error)) return false;
      instanceState._error = { error, phase: "loadMore" };
      forceUpdate();
      return false;
    }
    if (!instanceState._requestGuard.isCurrent(generation)) return false;
    if (response.items && response.sections) throw new Error("Fetch results must contain either items or sections, not both.");
    let items = response.items ? [...response.items] : response.sections?.flatMap((section) => section.items);
    const { hasMore } = response;
    if (items) {
      const sourceItems = [...items];
      const sourceLast =
        instanceState._sourceData[instanceState._sourceData.length - 1];
      if (sourceLast) {
        sourceLast.items.push(...sourceItems);
      } else {
        instanceState._sourceData = [{ items: sourceItems }];
        instanceState._sourceHasSections = false;
      }
      if (currentProps.filters)
        items = items.filter((t) => !currentProps.filters?.includes(t));
      let last = instanceState._data.pop();
      if (!last) {
        last = { items: [] };
        const column = normalizeMasonryColumn(currentProps.columnForSection(last, 0));
        instanceState._lastHeights = new Array(column).fill(
          instanceState._sumHeight,
        );
      }
      appendItemsToSection(
        items,
        last,
        instanceState._data.length,
        last.items.length,
      );
      last.items.push(...items);
      instanceState._data.push(last);
      notifyDataUpdate();
      instanceState._sumHeight = Math.max(...instanceState._lastHeights);
      instanceState._sumHeight += instanceState._footerHeight ?? 0;
      instanceState._canLoadMore = !!hasMore;
      instanceState._page = page;
    }
    if (response.sections) {
      instanceState._sourceHasSections = true;
      instanceState._sourceData.push(
        ...response.sections.map((section) => ({
          ...section,
          items: [...section.items],
        })),
      );
      appendSections(response.sections);
      instanceState._canLoadMore = !!hasMore;
      instanceState._page = page;
    }
    forceUpdate();
    instanceState._loadingMore = undefined;
    return hasMore;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    instanceState._requestGuard.invalidate();
    instanceState._fetching?.abort();
    instanceState._loadingMore?.abort();
  }, [instanceState]);

  // ─── Tab 切换懒加载（等价于 componentDidMount + _onTabChange）────────────────
  useEffect(() => {
    if (context.tab === undefined) return;
    const handleTabChange = (tab: number) => {
      const myTab = context.tab;
      if (tab === myTab && !instanceState._inited) {
        load(true)
          .catch(() => undefined)
          .finally(forceUpdate);
      }
    };
    return context.onTabChange(handleTabChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── deps 变化 → 重新请求数据（等价于 shouldComponentUpdate 中的 deps 比较）─
  const prevDepsRef = useRef(props.deps);
  const prevFiltersRef = useRef(props.filters);
  const prevPrependItemsRef = useRef(props.prependItems);
  const prevReloadTriggersRef = useRef(props.reloadTriggers);

  useEffect(() => {
    const prevDeps = prevDepsRef.current;
    prevDepsRef.current = props.deps;
    if (!instanceState._inited) return;
    const depsEq = areDependencyListsEqual(prevDeps, props.deps);
    if (!depsEq) {
      load(false, "refresh")
        .catch(() => undefined)
        .then(forceUpdate);
    }
  });

  useEffect(() => {
    const prevFilters = prevFiltersRef.current;
    const prevPrependItems = prevPrependItemsRef.current;
    const prevReloadTriggers = prevReloadTriggersRef.current;
    prevFiltersRef.current = props.filters;
    prevPrependItemsRef.current = props.prependItems;
    prevReloadTriggersRef.current = props.reloadTriggers;
    if (!instanceState._inited) return;
    const filtersEqual = areDependencyListsEqual(prevFilters, props.filters);
    const prependsEqual = areDependencyListsEqual(prevPrependItems, props.prependItems);
    const reloadsEqual = areDependencyListsEqual(prevReloadTriggers, props.reloadTriggers);
    if (!filtersEqual || !prependsEqual || !reloadsEqual) {
      requestAnimationFrame(reload);
    }
  });

  // ─── render ───────────────────────────────────────────────────────────────
  const isBlockingError =
    instanceState._error?.phase === "initial" && instanceState._data.length === 0;
  const retry = () => {
    const error = instanceState._error;
    if (!error) return;
    if (error.phase === "loadMore") {
      onLoadMore().catch(() => undefined).finally(forceUpdate);
      return;
    }
    load(false, error.phase).catch(() => undefined).finally(forceUpdate);
  };
  const style =
    instanceState._size?.height && !isBlockingError
      ? { height: instanceState._sumHeight }
      : { minHeight: "100%" as const };
  const footerStyle = [
    styles.footer,
    { opacity: instanceState._loading ? 0 : 1 },
  ];
  const contentOffset = { y: yRef.current, x: xRef.current };
  const elasticProps = getElasticScrollProps(props);

  return (
    <ElasticScrollView
      {...elasticProps}
      contentOffset={contentOffset}
      onSizeChange={onSize}
      contentContainerStyle={style}
      endReachedThreshold={props.loadMoreDistance}
      onEndReached={onLoadMore}
      onRefresh={props.disableRefresh ? undefined : onRefresh}
    >
      {props.renderBg?.()}
      {!isBlockingError &&
        instanceState._elements.map((el, idx) => (
          <MasonryCell
            key={idx}
            data={instanceState._data}
            contentOffset={contentOffset}
            frameHeight={instanceState._size?.height ?? 0}
            thumbs={el.thumbs.map((item) => ({ ...item }))}
            renderItem={props.renderItem}
          />
        ))}
      {!isBlockingError &&
        instanceState._sectionHeaders.map((header) => (
          <View
            key={`section-header-${header.sectionIndex}`}
            style={{
              height: header.height,
              left: 0,
              position: "absolute",
              right: 0,
              top: header.y,
            }}
          >
            {props.renderSectionHeader?.(header.section, header.sectionIndex) ??
              header.section.renderSectionHeader?.()}
          </View>
        ))}
      <View style={styles.header} onLayout={onHeaderLayout}>
        {props.renderHeader?.()}
        {instanceState._isEmpty &&
          !instanceState._error &&
          props.renderEmpty?.()}
        {instanceState._error &&
          props.renderError?.({ ...instanceState._error, retry })}
      </View>
      {!instanceState._inited && !instanceState._error && (
        <View style={StyleSheet.absoluteFill}>{props.renderLoading()}</View>
      )}
      <View style={footerStyle} onLayout={onFooterLayout}>
        {props.renderFooter?.()}
        {instanceState._canLoadMore && props.renderLoadingMore?.()}
      </View>
    </ElasticScrollView>
  );
}

export const MasonryList = Object.assign(MasonryListInner, {
  defaultProps: masonryDefaultProps,
}) as typeof MasonryListInner & { defaultProps: typeof masonryDefaultProps };
