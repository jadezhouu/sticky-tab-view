import React, {
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { PullRefreshHeaderHandle } from "../refresh/PullRefreshHeader.js";
import { LoadMoreFooter } from "../refresh/LoadMoreFooter.js";
import {
  cancelAnimation,
  makeMutable,
  SharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { ElasticPullRefreshHeader } from "../refresh/ElasticPullRefreshHeader.js";
import { StickyTabContext } from "../core/contexts.js";
import { TElasticScrollViewProps, TElasticScrollViewCoreProps, TDirection } from "../types.js";
import { ScrollGestureView } from "./ScrollGestureView.js";

/**
 * Imperative handle for {@link ElasticScrollView}, exposed via `ref`.
 *
 * @public
 */
export interface ElasticScrollViewHandle {
  scrollTo: (
    offset: { x: number; y: number },
    animated?: boolean,
  ) => Promise<void>;
  scroll: (
    offset: { x: number; y: number },
    animated?: boolean,
  ) => Promise<void>;
}

// React 19 已废弃 function component 的 defaultProps，改用默认参数对象
const defaultProps: Required<
  Pick<
    TElasticScrollViewProps,
    | "inverted"
    | "bounces"
    | "scrollEnabled"
    | "directionalLockEnabled"
    | "showsVerticalScrollIndicator"
    | "showsHorizontalScrollIndicator"
    | "dragToHideKeyboard"
    | "pagingEnabled"
    | "decelerationRate"
    | "contentInsets"
    | "pageSize"
    | "pullRefreshHeader"
    | "loadMoreFooter"
    | "refreshing"
    | "loadingMore"
    | "loadFinished"
    | "endReachedThreshold"
  >
> = {
  inverted: false,
  bounces: "vertical",
  scrollEnabled: "vertical",
  directionalLockEnabled: true,
  showsVerticalScrollIndicator: true,
  showsHorizontalScrollIndicator: true,
  dragToHideKeyboard: true,
  pagingEnabled: false,
  decelerationRate: 0.998,
  contentInsets: { top: 0, left: 0, right: 0, bottom: 0 },
  pageSize: { width: 0, height: 0 },
  pullRefreshHeader: ElasticPullRefreshHeader,
  loadMoreFooter: LoadMoreFooter,
  refreshing: false,
  loadingMore: false,
  loadFinished: false,
  endReachedThreshold: 2000,
};

/**
 * 弹性滚动容器组件，支持 Header 驱动的手势联动、下拉刷新和上拉加载。
 *
 * 手势优先级由外层 StickyTabView 统一仲裁；
 * 单独使用时，可通过 props 直接控制滚动方向、paging、回弹等行为。
 *
 * @public
 */
const _ElasticScrollView = React.forwardRef<
  ElasticScrollViewHandle,
  TElasticScrollViewProps
>(function ElasticScrollView(userProps, ref) {
  const props = {
    ...defaultProps,
    ...userProps,
  } as TElasticScrollViewCoreProps;
  const context = useContext(StickyTabContext);

  // 所有 SharedValue 只在首次渲染时创建，此后保持稳定引用
  const xOffsetRef = useRef<SharedValue<number>>(
    props.contentOffset?.x ?? makeMutable(0),
  );
  const yOffsetRef = useRef<SharedValue<number>>(
    props.contentOffset?.y ?? makeMutable(0),
  );
  const viewportWidthRef = useRef<SharedValue<number>>(
    props.size?.width ?? makeMutable(0),
  );
  const viewportHeightRef = useRef<SharedValue<number>>(
    props.size?.height ?? makeMutable(0),
  );
  const contentWidthRef = useRef<SharedValue<number>>(
    props.contentSize?.width ?? makeMutable(0),
  );
  const contentHeightRef = useRef<SharedValue<number>>(
    props.contentSize?.height ?? makeMutable(0),
  );
  const focusRef = useRef<SharedValue<TDirection>>(
    props.focus ?? makeMutable<TDirection>(false),
  );
  const currentPageRef = useRef<SharedValue<number>>(
    props.currentPage ?? makeMutable(0),
  );

  if (props.contentOffset?.x) xOffsetRef.current = props.contentOffset.x;
  if (props.contentOffset?.y) yOffsetRef.current = props.contentOffset.y;
  if (props.size?.width) viewportWidthRef.current = props.size.width;
  if (props.size?.height) viewportHeightRef.current = props.size.height;
  if (props.contentSize?.width) contentWidthRef.current = props.contentSize.width;
  if (props.contentSize?.height) contentHeightRef.current = props.contentSize.height;
  if (props.focus) focusRef.current = props.focus;
  if (props.currentPage) currentPageRef.current = props.currentPage;

  // 对齐原类的 render 逻辑：在 StickyTabContext 内使用 context 提供的 y
  const y: SharedValue<number> =
    context.contentOffset?.y ?? yOffsetRef.current;

  const pullRefreshHeaderRef = useRef<PullRefreshHeaderHandle | null>(null);

  // --- imperative handle（对齐原 scrollTo / scroll 方法）---
  useImperativeHandle(ref, () => {
    const _x = xOffsetRef.current;
    const _y = y;

    const scrollTo = (
      offset: { x: number; y: number },
      animated: boolean = true,
    ): Promise<void> => {
      if (!animated) {
        _x.value = offset.x;
        _y.value = offset.y;
        return Promise.resolve();
      }
      cancelAnimation(_x);
      cancelAnimation(_y);
      const springConfig = {
        velocity: 10,
        damping: 30,
        mass: 1,
        stiffness: 225,
      };
      const xPromise = new Promise<void>((resolve, reject) => {
        _x.value = withSpring(offset.x, springConfig, (isFinish) => {
          if (isFinish) scheduleOnRN(resolve);
          else scheduleOnRN(reject);
        });
      });
      const yPromise = new Promise<void>((resolve, reject) => {
        _y.value = withSpring(offset.y, springConfig, (isFinish) => {
          if (isFinish) scheduleOnRN(resolve);
          else scheduleOnRN(reject);
        });
      });
      return Promise.all([xPromise, yPromise]).then(() => undefined);
    };

    return {
      scrollTo,
      scroll: (offset, animated = true) =>
        scrollTo({ x: offset.x + _x.value, y: offset.y + _y.value }, animated),
    };
  }, [y]);

  // 卸载时取消所有进行中的动画（对齐 componentWillUnmount）
  useEffect(() => {
    const allVals = [
      xOffsetRef.current,
      y,
      viewportWidthRef.current,
      viewportHeightRef.current,
      contentWidthRef.current,
      contentHeightRef.current,
      currentPageRef.current,
      focusRef.current as unknown as SharedValue<number>,
    ] as SharedValue<number>[];
    return () => {
      allVals.forEach((v) => cancelAnimation(v));
    };
  }, [y]);

  return (
    <ScrollGestureView
      {...props}
      pullRefreshHeaderRef={pullRefreshHeaderRef}
      focus={focusRef.current}
      currentPage={currentPageRef.current}
      size={{
        width: viewportWidthRef.current,
        height: viewportHeightRef.current,
      }}
      contentSize={{
        width: contentWidthRef.current,
        height: contentHeightRef.current,
      }}
      contentOffset={{ x: xOffsetRef.current, y }}
    />
  );
});

/**
 * Gesture-driven scroll container with bounce, paging, pull-to-refresh, and
 * load-more. Renders caller-supplied children without virtualizing them — use
 * it for bounded content, and prefer {@link MasonryList} for long lists.
 *
 * @public
 */
export const ElasticScrollView = _ElasticScrollView;
