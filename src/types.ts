import { LoadMoreFooter } from "./refresh/LoadMoreFooter.js";
import { SharedValue } from "react-native-reanimated";
import { PullRefreshHeader, PullRefreshHeaderHandle } from "./refresh/PullRefreshHeader.js";
import { StyleProp, ViewProps, ViewStyle } from "react-native";
import React from "react";
import type { PanGestureHandlerEventPayload } from "react-native-gesture-handler";

export interface TElasticScrollViewProps extends ViewProps {
  contentContainerStyle?: StyleProp<ViewStyle>;
  inverted?: boolean;
  bounces?: TDirection;
  scrollEnabled?: TDirection;
  directionalLockEnabled?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  pagingEnabled?: TDirection;
  decelerationRate?: number;
  pageSize?: { width: number; height: number };
  pullRefreshHeader?: typeof PullRefreshHeader;
  loadMoreFooter?: typeof LoadMoreFooter;
  refreshing?: boolean;
  loadFinished?: boolean;
  loadingMore?: boolean;
  onScroll?: (contentOffset: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  onContentSizeChange?: (size: { width: number; height: number }) => void;
  onTouchBegin?: () => void;
  onTouchEnd?: () => void;
  onScrollBeginDrag?: () => void;
  onScrollEndDrag?: () => void;
  dragToHideKeyboard?: boolean;
  tapToHideKeyboard?: boolean;
  onRefresh?: (refresh: TOnRefreshParam) => void;
  onEndReached?: () => Promise<boolean | undefined>;
  endReachedThreshold?: number;

  focus?: SharedValue<TDirection>;
  contentOffset?: {
    x?: SharedValue<number>;
    y?: SharedValue<number>;
  };
  size?: {
    width: SharedValue<number>;
    height: SharedValue<number>;
  };
  contentSize?: {
    width: SharedValue<number>;
    height: SharedValue<number>;
  };
  contentInsets?: { top: number; bottom: number; left: number; right: number };
  currentPage?: SharedValue<number>;

  panHandler?: TPanHandler;
}

export interface TOnRefreshParam {
  endRefresh: () => void;
  canLoadMore: SharedValue<boolean>;
}

/** @internal — 内部使用的完整 props，消费者只需关注 TElasticScrollViewProps */
export interface TElasticScrollViewCoreProps extends TElasticScrollViewProps {
  focus: SharedValue<boolean | "vertical" | "horizontal">;
  contentOffset: {
    x: SharedValue<number>;
    y: SharedValue<number>;
  };
  size: {
    width: SharedValue<number>;
    height: SharedValue<number>;
  };
  contentSize: {
    width: SharedValue<number>;
    height: SharedValue<number>;
  };
  contentInsets: { top: number; bottom: number; left: number; right: number };
  currentPage: SharedValue<number>;

  pullRefreshHeader: typeof PullRefreshHeader;
  loadMoreFooter: typeof LoadMoreFooter;
  decelerationRate: number;

  inverted: boolean;
  bounces: TDirection;
  scrollEnabled: TDirection;
  directionalLockEnabled: boolean;
  showsVerticalScrollIndicator: boolean;
  showsHorizontalScrollIndicator: boolean;
  dragToHideKeyboard: boolean;
  pagingEnabled: TDirection;
  pageSize: { width: number; height: number };
  refreshing: boolean;
  loadingMore: boolean;
  loadFinished: boolean;
  pullRefreshHeaderRef: React.RefObject<PullRefreshHeaderHandle | null>;
  endReachedThreshold: number;
}

/** @internal */
export interface TSize {
  width: number;
  height: number;
}

/** @internal */
export interface TScrollSizes {
  size?: TSize;
  contentSize?: TSize;
  header?: TSize;
  footer?: TSize;
}

export interface TStickyTabViewProps extends ViewProps {
  lazy?: boolean;
  lazyPreloadDistance?: number;
  tabCount: number;
  current?: number;
  tabBarHeight?: number;
  headerOffset?: number;
  renderHeader: () => React.ReactElement<unknown>;
  renderTab: (tab: number) => React.ReactElement<unknown> | null;
  renderTabBar?: (
    x: SharedValue<number>,
    ys: SharedValue<number>[],
    current: SharedValue<number>,
  ) => React.ReactNode;
}

export type TDirection = boolean | "vertical" | "horizontal";

export interface TIndicatorProps {
  horizontal?: boolean;
  focus: SharedValue<TDirection>;
  contentOffset: {
    x?: SharedValue<number>;
    y?: SharedValue<number>;
  };
  size: {
    width: SharedValue<number>;
    height: SharedValue<number>;
  };
  contentSize: {
    width: SharedValue<number>;
    height: SharedValue<number>;
  };
}

// 手势事件：取 RNGH Payload 中实际用到的六个字段
// onStart/onEnd 的 GestureStateChangeEvent 与 onUpdate 的 GestureUpdateEvent
// 在 Payload 层面共享这些字段，用 Pick 统一签名，避免各处重复 any
export type TPanEvent = Pick<
  PanGestureHandlerEventPayload,
  | "translationX"
  | "translationY"
  | "absoluteX"
  | "absoluteY"
  | "velocityX"
  | "velocityY"
>;

// 手势生命周期共享的上下文对象
// 所有字段均为可选：ctx 初始为空对象 {}，各字段在不同生命周期阶段逐步填入
export type TGestureContext = {
  started?:     boolean;                   // onStart 初始化，onActive 第一帧后置 true
  priority?:    number;                    // claimGestureFocus 中竞争优先级
  direction?:   TDirection;               // claimGestureFocus 仲裁确定的滚动方向
  last?:        { x: number; y: number }; // onStart/onActive 记录上一帧绝对坐标
  isForwarded?: boolean;                  // 手势由外层代理转发，收到后不再向父层冒泡
  keyboardDismissed?: boolean;
};

type Handler = (event: TPanEvent, context: TGestureContext) => void;

/** Pan gesture callbacks for coordinating a nested ElasticScrollView. */
export type TPanHandler = {
  claimGestureFocus?: Handler;
  onStart?: Handler;
  onActive?: Handler;
  onEnd?: Handler;
  onCancel?: Handler;
  onFail?: Handler;
  hasGestureFocus?: () => boolean;
};

/** @internal */
export type TScrollHandlers = TPanHandler;

export interface TStickyTabContext {
  // lazy 模式下才会设置 tab 值（非第 0 个 Tab），所以改为可选
  tab?: number;
  onTabChange: (listener: (tab: number) => void) => () => void;
  contentOffset?: { y: SharedValue<number> };
  // SharedValue 是 Reanimated 跨 JS/worklet 线程安全读写的唯一机制：
  // - React 19 会深度冻结 context value，但 SharedValue 是 JSI host 对象，冻结对它无效
  // - react-native-worklets 的 "converted to serializable" 限制只针对普通 JS 对象，
  //   SharedValue 始终可以通过 .value = newValue 安全更新
  handlersMutable: SharedValue<TScrollHandlers>;
}

export interface TSectionData<T> {
  items: T[];
  column?: number;
  renderSectionHeader?: () => React.ReactNode;
}

export interface TFetchRes<T> {
  hasMore?: boolean;
  sections?: readonly TSectionData<T>[];
  items?: readonly T[];
}

export type TMasonryRequestPhase = "initial" | "refresh" | "loadMore";

export interface TMasonryErrorInfo {
  error: unknown;
  phase: TMasonryRequestPhase;
  retry: () => void;
}

/** Context persisted across Masonry pagination requests. */
export type TFetchContext = Record<string, unknown>;

/** @internal */
export type TFetchCtx = TFetchContext;

export interface TMasonryListProps<T> extends TElasticScrollViewProps {
  onFetch: (
    page: number,
    ctx: TFetchContext,
    signal?: AbortSignal,
  ) => Promise<TFetchRes<T>>;
  heightForSectionHeader?: (
    sectionData: TSectionData<T>,
    sectionIndex: number,
  ) => number;
  renderSectionHeader?: (
    sectionData: TSectionData<T>,
    sectionIndex: number,
  ) => React.ReactNode;
  heightForItem: (item: T, index: number, sectionIndex: number) => number;
  renderItem: (item: T, index: number, sectionIndex: number) => React.ReactNode;
  renderLoading?: () => React.ReactNode;
  columnForSection?: (
    sectionData: TSectionData<T>,
    sectionIndex: number,
  ) => number;
  renderLoadingMore?: () => React.ReactNode;
  renderError?: (info: TMasonryErrorInfo) => React.ReactNode;
  onDataUpdate?: (data: readonly TSectionData<T>[]) => void;
  horizontalPadding?: number;
  gap?: number;
  bufferHeight?: number;
  loadMoreDistance?: number;
  disableRefresh?: boolean;
  renderBg?: () => React.ReactNode;
  renderHeader?: () => React.ReactNode;
  renderFooter?: () => React.ReactNode;
  renderEmpty?: () => React.ReactNode;
  isEmpty?: (data: TSectionData<T>[]) => boolean;
  deps?: readonly unknown[];
  filters?: readonly T[];
  prependItems?: readonly T[];
  reloadTriggers?: readonly unknown[];
  initData?: readonly TSectionData<T>[];
}

/** 可选的 Cell 复用分组标识。 */
export interface TItemBase {
  reuseType?: string;
}

/** @internal */
export interface TPos {
  x: number;
  y: number;
}

/** @internal */
export type TFrame = TSize & TPos;

/** @internal */
export interface TThumb {
  x: number;
  y: number;
  width: number;
  height: number;
  thumbId?: number;
  itemIndex: number;
  sectionIndex: number;
  reuseType?: string;
  elementId?: number;
}

/** @internal */
export interface TMasonryCellProps<T> {
  data: TSectionData<T>[];
  contentOffset: { y: SharedValue<number> };
  thumbs: TThumb[];
  frameHeight: number;
  renderItem: (item: T, index: number, sectionIndex: number) => React.ReactNode;
}
