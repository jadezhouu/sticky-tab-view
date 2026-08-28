import React from "react";
import { View } from "react-native";
import Reanimated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
// Reanimated v3 移除了 useAnimatedGestureHandler，改用 Gesture API
import { Gesture, GestureDetector, State } from "react-native-gesture-handler";
import { PullHeaderState } from "../refresh/PullRefreshHeader.js";
import { Keyboard, LayoutChangeEvent } from "react-native";
import { TElasticScrollViewCoreProps, TGestureContext, TPanEvent } from "../types.js";
import { ElasticScrollContext, StickyTabContext } from "../core/contexts.js";
import { decay, pageScroll, rebound } from "../core/animations.js";
import { getMaxOffset, getPageTarget, shouldTriggerEndReached } from "../core/geometry.js";
import { Indicator } from "./Indicators.js";

const dismissKeyboard = () => {
  Keyboard.dismiss();
};

export const ScrollGestureView = (props: TElasticScrollViewCoreProps) => {
  const x = props.contentOffset!.x!;
  const y = props.contentOffset!.y!;
  const refreshStatus = useSharedValue<PullHeaderState>("idle");
  // xAnimTracker/yAnimTracker 用作滚动条指示器的辅助追踪值
  const xAnimTracker = useSharedValue(0);
  const yAnimTracker = useSharedValue(0);
  const canLoadMore = useSharedValue(true);
  const { size, contentSize, focus, currentPage } = props;
  const { top, left, bottom, right } = props.contentInsets;
  const parent = React.useContext(ElasticScrollContext);
  const stickyTabContext = React.useContext(StickyTabContext);
  const vBounces = props.bounces === true || props.bounces === "vertical";
  const hBounces = props.bounces === true || props.bounces === "horizontal";
  const vScroll =
    props.scrollEnabled === true || props.scrollEnabled === "vertical";
  const hScroll =
    props.scrollEnabled === true || props.scrollEnabled === "horizontal";
  const accessibilityActions = props.accessibilityActions ?? [
    { name: "increment" as const, label: "Scroll forward" },
    { name: "decrement" as const, label: "Scroll backward" },
  ];
  const onAccessibilityAction = (
    event: Parameters<NonNullable<typeof props.onAccessibilityAction>>[0],
  ) => {
    const actionName = event.nativeEvent.actionName;
    const isHorizontalOnly = hScroll && !vScroll;
    const maxX = getMaxOffset(contentSize.width.value, size.width.value, right);
    const maxY = getMaxOffset(contentSize.height.value, size.height.value, bottom);
    if (actionName === "increment") {
      if (isHorizontalOnly) {
        x.value = Math.min(maxX, x.value + size.width.value);
      } else {
        y.value = Math.min(maxY, y.value + size.height.value);
      }
    } else if (actionName === "decrement") {
      if (isHorizontalOnly) {
        x.value = Math.max(-left, x.value - size.width.value);
      } else {
        y.value = Math.max(-top, y.value - size.height.value);
      }
    }
    props.onAccessibilityAction?.(event);
  };
  const nativeViewProps = {
    accessible: props.accessible,
    accessibilityActions,
    accessibilityHint: props.accessibilityHint,
    accessibilityLabel: props.accessibilityLabel,
    accessibilityRole: props.accessibilityRole,
    accessibilityState: props.accessibilityState,
    nativeID: props.nativeID,
    onAccessibilityAction,
    pointerEvents: props.pointerEvents,
    testID: props.testID,
  };

  // ── worklet 闭包专用局部变量 ─────────────────────────────────────────────
  // worklet 若直接捕获整个 props 对象，在 props 含有 panHandler 时会形成
  // 循环引用（outer worklet → props.panHandler → actions[i] → inner worklet
  // → parent → outer worklet），触发 Reanimated "cyclic object" 错误。
  // 将 worklet 需要的字段提前解构为局部变量，断开循环。
  const scrollEnabled = props.scrollEnabled;
  const directionalLockEnabled = props.directionalLockEnabled;
  const inverted = props.inverted;
  const pagingEnabled = props.pagingEnabled;
  const pageSize = props.pageSize;
  const decelerationRate = props.decelerationRate;
  const dragToHideKeyboard = props.dragToHideKeyboard;
  const tapToHideKeyboard = props.tapToHideKeyboard;
  const endReachedThreshold = props.endReachedThreshold;
  const loadFinished = props.loadFinished;
  const loadingMore = props.loadingMore;
  const onRefresh = props.onRefresh;
  const onTouchBegin = props.onTouchBegin;
  const onTouchEnd = props.onTouchEnd;
  const onScrollBeginDrag = props.onScrollBeginDrag;
  const onScrollEndDrag = props.onScrollEndDrag;
  const onScroll = props.onScroll;

  // 用 SharedValue 存储每次手势的上下文，保证 worklet 间可以共享状态
  // 在新 Gesture API 中没有自动 ctx 机制，需要手动管理
  const gestureCtx = useSharedValue<TGestureContext>({});

  //#region 边界检测（在 UI 线程工作）
  const isOutOfTop = () => {
    "worklet";
    return y.value <= -top - 0.1;
  };
  const isOutOfBottom = () => {
    "worklet";
    return y.value >= getMaxOffset(contentSize.height.value, size.height.value, bottom) + 0.1;
  };
  const isOutOfLeft = () => {
    "worklet";
    return x.value <= -left - 0.1;
  };
  const isOutOfRight = () => {
    "worklet";
    return x.value >= getMaxOffset(contentSize.width.value, size.width.value, right) + 0.1;
  };
  const isOutOfHorizontal = () => {
    "worklet";
    return isOutOfLeft() || isOutOfRight();
  };
  const isOutOfVertical = () => {
    "worklet";
    return isOutOfTop() || isOutOfBottom();
  };
  //#endregion

  const onSize = (e: LayoutChangeEvent) => {
    const { layout } = e.nativeEvent;
    size.width.value = layout.width;
    size.height.value = layout.height;
    x.value = Math.max(
      -left,
      Math.min(
        x.value,
        getMaxOffset(contentSize.width.value, layout.width, right),
      ),
    );
    y.value = Math.max(
      -top,
      Math.min(
        y.value,
        getMaxOffset(contentSize.height.value, layout.height, bottom),
      ),
    );
    props.onSizeChange?.(layout);
  };
  const onContentSize = (e: LayoutChangeEvent) => {
    const { layout } = e.nativeEvent;
    contentSize.width.value = layout.width;
    contentSize.height.value =
      layout.height < size.height.value ? size.height.value : layout.height;
    props.onContentSizeChange?.(layout);
  };

  // 拖动：带越界阻力的橡皮筋效果
  const drag = (offset: { x: number; y: number }) => {
    "worklet";
    if (!hBounces) {
      const estX = x.value + offset.x;
      if (estX < -left) {
        offset.x = -left - x.value;
      } else if (estX > getMaxOffset(contentSize.width.value, size.width.value, right)) {
        offset.x = getMaxOffset(contentSize.width.value, size.width.value, right) - x.value;
      }
    }
    if (!vBounces) {
      const estY = y.value + offset.y;
      if (estY < -top) {
        offset.y = -top - y.value;
      } else if (estY > getMaxOffset(contentSize.height.value, size.height.value, bottom)) {
        offset.y = getMaxOffset(contentSize.height.value, size.height.value, bottom) - y.value;
      }
    }
    if (focus.value === "horizontal") offset.y = 0;
    if (focus.value === "vertical") offset.x = 0;
    // 越界后施加非线性阻力：偏移越大，阻力越大
    if ((offset.x < 0 && isOutOfLeft()) || (offset.x > 0 && isOutOfRight())) {
      offset.x = offset.x * (0.5 / (1 + Math.abs(offset.x) / 500));
    }
    if ((offset.y < 0 && isOutOfTop()) || (offset.y > 0 && isOutOfBottom())) {
      offset.y = offset.y * (0.5 / (1 + Math.abs(offset.y) / 500));
    }
    x.value += offset.x;
    y.value += offset.y;
  };

  // 判断手势方向是否与当前 ScrollView 支持的方向匹配
  const isPanFitScroll = (evt: TPanEvent) => {
    "worklet";
    if (scrollEnabled === true) return true;
    if (Math.abs(evt.translationX) > Math.abs(evt.translationY)) {
      return scrollEnabled === "horizontal";
    } else {
      return scrollEnabled === "vertical";
    }
  };

  // 手势焦点竞争：多层嵌套 ScrollView 通过优先级决定谁响应本次手势
  const claimGestureFocus = (evt: TPanEvent, ctx: TGestureContext) => {
    "worklet";
    let myPriority = 0;
    if (isPanFitScroll(evt)) {
      myPriority = focus?.value ? 3 : 1;
    }
    if (myPriority > (ctx.priority ?? 0)) {
      ctx.priority = myPriority;
      const d =
        Math.abs(evt.translationX) > Math.abs(evt.translationY)
          ? "horizontal"
          : "vertical";
      ctx.direction = directionalLockEnabled ? d : scrollEnabled;
    } else if (focus.value) {
      focus.value = false;
    }
    parent.claimGestureFocus?.(evt, ctx);
    // 竞争结束后直接激活本层 focus，避免将 SharedValue 存入 ctx 普通对象
    // （ctx 会经过 Reanimated makeShareable 序列化，SharedValue 是 JSI 宿主对象，无法序列化）
    if (myPriority > 0 && myPriority === ctx.priority) {
      // ctx.direction 在上方 if 块中由本层设置，此处 myPriority === ctx.priority 成立
      // 说明本层胜出，direction 一定已被赋值，非空断言安全
      focus.value = ctx.direction ?? false;
    } else if (myPriority > 0 && focus.value) {
      focus.value = false;
    }
  };

  let panHandler = props.panHandler;
  const pullRefreshHeaderHeight = props.pullRefreshHeader.height;

  const notifyRefreshState = React.useCallback((state: PullHeaderState) => {
    props.pullRefreshHeaderRef.current?.updateState?.(state);
  }, [props.pullRefreshHeaderRef]);
  const settleRefresh = () => {
    if (refreshStatus.value !== "refreshing") return;
    canLoadMore.value = true;
    notifyRefreshState((refreshStatus.value = "settling"));
    rebound(y, -top, 0, focus, yAnimTracker);
  };
  const handleRefresh = () => {
    // refreshStatus.value 可能已由 onEnd worklet 提前置为 'refreshing'，
    // 此处直接同步 UI 状态并触发回调，不做 early-return。
    // onEnd 里已有 'armed' 前置守卫，不会重复调度本函数。
    notifyRefreshState((refreshStatus.value = "refreshing"));
    try {
      const result = props.onRefresh?.({
        canLoadMore,
        endRefresh: settleRefresh,
      });
      Promise.resolve(result).catch(settleRefresh);
    } catch {
      settleRefresh();
    }
  };
  const handleLoadMore = () => {
    try {
      const res = props.onEndReached?.();
      if (!res) {
        canLoadMore.value = true;
        return;
      }
      Promise.resolve(res).then(
        (more) => {
          canLoadMore.value = !!more;
        },
        () => {
          canLoadMore.value = true;
        },
      );
    } catch {
      canLoadMore.value = true;
    }
  };

  useAnimatedReaction(
    () => {
      return !loadFinished && !loadingMore && focus.value === "vertical" && shouldTriggerEndReached({
        offset: y.value,
        contentSize: contentSize.height.value,
        viewportSize: size.height.value,
        distance: endReachedThreshold,
        armed: canLoadMore.value,
      });
    },
    (res, pre) => {
      if (res === true && res !== pre) {
        canLoadMore.value = false;
        scheduleOnRN(handleLoadMore);
      }
    },
  );

  React.useEffect(() => {
    if (props.refreshing && refreshStatus.value !== "refreshing") {
      refreshStatus.value = "refreshing";
      notifyRefreshState("refreshing");
    } else if (!props.refreshing && refreshStatus.value === "refreshing") {
      refreshStatus.value = "settling";
      notifyRefreshState("settling");
      rebound(y, -top, 0, focus, yAnimTracker);
    }
  }, [focus, notifyRefreshState, props.refreshing, refreshStatus, top, y, yAnimTracker]);

  useAnimatedReaction(
    () => ({ x: x.value, y: y.value }),
    (offset, previous) => {
      if (!previous || offset.x !== previous.x || offset.y !== previous.y) {
        if (onScroll) scheduleOnRN(onScroll, offset);
      }
    },
    [onScroll],
  );

  const gestureHandler = {
      hasGestureFocus: () => {
        return !!focus.value || parent.hasGestureFocus?.() || false;
      },
      claimGestureFocus,
      onStart: (evt: TPanEvent, ctx: TGestureContext) => {
        "worklet";
        if (hScroll) {
          cancelAnimation(x);
          cancelAnimation(xAnimTracker);
        }
        if (vScroll) {
          cancelAnimation(y);
          cancelAnimation(yAnimTracker);
        }
        ctx.started = false;
        ctx.priority = 0;
        if (refreshStatus.value === "settling") refreshStatus.value = "idle";
        ctx.last = { x: evt.absoluteX, y: evt.absoluteY };
        if (onTouchBegin) scheduleOnRN(onTouchBegin);
        if (onScrollBeginDrag) scheduleOnRN(onScrollBeginDrag);
      },
      onActive: (evt: TPanEvent, ctx: TGestureContext) => {
        "worklet";
        if (!ctx.started) {
          if (!evt.translationX && !evt.translationY) return;
          claimGestureFocus(evt, ctx);
          ctx.started = true;
        }
        if (dragToHideKeyboard && !ctx.keyboardDismissed) {
          ctx.keyboardDismissed = true;
          scheduleOnRN(dismissKeyboard);
        }
        if (!ctx.isForwarded) parent.onActive?.(evt, ctx);

        if (focus.value) {
          const factor = inverted ? -1 : 1;
          drag({
            // ctx.last は onStart で必ず初期化されるため非空断言安全
            x: ctx.last!.x - evt.absoluteX,
            y: factor * (ctx.last!.y - evt.absoluteY),
          });
          ctx.last = { x: evt.absoluteX, y: evt.absoluteY };
          if (refreshStatus.value) {
            let shouldChange = false;
            if (refreshStatus.value === "idle" && isOutOfTop()) {
              refreshStatus.value = "dragging";
              shouldChange = true;
            } else if (
              (refreshStatus.value === "dragging" ||
                refreshStatus.value === "canceling") &&
              y.value < -top - pullRefreshHeaderHeight
            ) {
              refreshStatus.value = "armed";
              shouldChange = true;
            } else if (
              refreshStatus.value === "armed" &&
              y.value > -top - pullRefreshHeaderHeight
            ) {
              refreshStatus.value = "canceling";
              shouldChange = true;
            }
            if (shouldChange) {
              scheduleOnRN(notifyRefreshState, refreshStatus.value);
            }
          }
        }
        return focus.value;
      },
      onEnd: (evt: TPanEvent, ctx: TGestureContext) => {
        "worklet";
        if (!focus.value && !ctx.isForwarded) return parent.onEnd?.(evt, ctx);
        if (onTouchEnd) scheduleOnRN(onTouchEnd);
        if (onScrollEndDrag) scheduleOnRN(onScrollEndDrag);
        const maxX = getMaxOffset(contentSize.width.value, size.width.value, right);
        const maxY = getMaxOffset(contentSize.height.value, size.height.value, bottom);
        const vx = -evt.velocityX;
        const vy = evt.velocityY * (inverted ? 1 : -1);
        if (hScroll) {
          if (isOutOfHorizontal()) {
            rebound(x, isOutOfLeft() ? -left : maxX, vx, focus, xAnimTracker);
          } else {
            if (pagingEnabled === "horizontal") {
              const pageWidth =
                pageSize.width === 0 ? size.width.value : pageSize.width;
              const page = getPageTarget({ currentPage: currentPage.value, offset: x.value, pageSize: pageWidth, contentSize: contentSize.width.value, velocity: evt.velocityX });
              currentPage.value = page;
              pageScroll(
                x,
                Math.min(page * pageWidth, maxX),
                -evt.velocityX,
                focus,
                xAnimTracker,
              );
            } else {
              decay(
                x,
                decelerationRate,
                vx,
                [0, maxX],
                hBounces,
                focus,
                xAnimTracker,
              );
            }
          }
        }
        if (vScroll) {
          if (isOutOfVertical()) {
            let to = maxY;
            if (isOutOfTop()) {
              to = -top;
              if (
                onRefresh &&
                refreshStatus.value === "armed" &&
                y.value < -top - pullRefreshHeaderHeight
              ) {
                refreshStatus.value = "refreshing";
                scheduleOnRN(handleRefresh);
              }
              if (refreshStatus.value === "refreshing") {
                to -= pullRefreshHeaderHeight;
              }
            }
            rebound(y, to, vy, focus, yAnimTracker);
          } else {
            if (pagingEnabled === "vertical") {
              const pageHeight =
                pageSize.height === 0 ? size.height.value : pageSize.height;
              const page = getPageTarget({ currentPage: currentPage.value, offset: y.value, pageSize: pageHeight, contentSize: contentSize.height.value, velocity: evt.velocityY });
              currentPage.value = page;
              pageScroll(
                y,
                Math.min(page * pageHeight, maxY),
                -evt.velocityY,
                focus,
                yAnimTracker,
              );
            } else {
              decay(
                y,
                decelerationRate,
                vy,
                [-top, maxY],
                vBounces,
                focus,
                yAnimTracker,
              );
            }
          }
        }
      },
      onCancel: () => {
        "worklet";
        const maxX = getMaxOffset(contentSize.width.value, size.width.value, right);
        const maxY = getMaxOffset(contentSize.height.value, size.height.value, bottom);
        if (!focus.value) return;

        if (pagingEnabled === "horizontal") {
          const pageWidth =
            pageSize.width === 0 ? size.width.value : pageSize.width;
          const target = Math.min(currentPage.value * pageWidth, maxX);
          if (target !== x.value) {
            return pageScroll(
              x,
              target,
              50,
              focus,
              xAnimTracker,
            );
          }
        }

        if (pagingEnabled === "vertical") {
          const pageHeight =
            pageSize.height === 0 ? size.height.value : pageSize.height;
          const target = Math.min(currentPage.value * pageHeight, maxY);
          if (target !== y.value) {
            return pageScroll(
              y,
              target,
              50,
              focus,
              yAnimTracker,
            );
          }
        }
        if (vBounces) {
          if (isOutOfVertical()) {
            rebound(y, isOutOfTop() ? -top : maxY, 50, focus, yAnimTracker);
          }
        }
        if (hBounces) {
          if (isOutOfHorizontal()) {
            rebound(x, isOutOfLeft() ? -left : maxX, 50, focus, xAnimTracker);
          }
        }
      },
      onFail: (_evt: TPanEvent, _ctx: TGestureContext) => {
        "worklet";
        const maxX = getMaxOffset(contentSize.width.value, size.width.value, right);
        const maxY = getMaxOffset(contentSize.height.value, size.height.value, bottom);
        if (onTouchEnd) scheduleOnRN(onTouchEnd);
        if (onScrollEndDrag) scheduleOnRN(onScrollEndDrag);
        if (!focus.value) return;
        if (pagingEnabled === "horizontal") {
          const pageWidth =
            pageSize.width === 0 ? size.width.value : pageSize.width;
          const target = Math.min(currentPage.value * pageWidth, maxX);
          if (target !== x.value) {
            return pageScroll(
              x,
              target,
              50,
              focus,
              xAnimTracker,
            );
          }
        }

        if (pagingEnabled === "vertical") {
          const pageHeight =
            pageSize.height === 0 ? size.height.value : pageSize.height;
          const target = Math.min(currentPage.value * pageHeight, maxY);
          if (target !== y.value) {
            return pageScroll(
              y,
              target,
              50,
              focus,
              yAnimTracker,
            );
          }
        }
        if (vBounces) {
          if (isOutOfVertical()) {
            rebound(y, isOutOfTop() ? -top : maxY, 50, focus, yAnimTracker);
          }
        }
        if (hBounces) {
          if (isOutOfHorizontal()) {
            rebound(x, isOutOfLeft() ? -left : maxX, 50, focus, xAnimTracker);
          }
        }
        if (!pagingEnabled && !isOutOfHorizontal() && !isOutOfVertical()) {
          const to = xAnimTracker.value ? xAnimTracker : yAnimTracker;
          const toValue = focus.value === "horizontal" ? x.value : y.value;
          to.value = withTiming(toValue, { duration: 100 }, () => {
            focus.value = false;
            to.value = 0;
          });
        }
      },
  };

  if (!panHandler) panHandler = gestureHandler;

  // 将 panHandler 写入 StickyTabContext 的 SharedValue。
  // SharedValue.value = newValue 是 Reanimated 的正式 API：
  //   - 不受 React 19 深度冻结限制（SharedValue 是 JSI host 对象）
  //   - 不受 react-native-worklets "converted to serializable" 限制
  //   - worklet 线程通过 .value 读取时始终获得最新值
  React.useEffect(() => {
    stickyTabContext.handlersMutable.value = {
      claimGestureFocus: panHandler.claimGestureFocus,
      onStart: panHandler.onStart,
      onActive: panHandler.onActive,
      onEnd: panHandler.onEnd,
      onCancel: panHandler.onCancel,
      onFail: panHandler.onFail,
      hasGestureFocus: panHandler.hasGestureFocus,
    };
    return () => {
      if (
        stickyTabContext.handlersMutable.value?.onStart === panHandler.onStart
      ) {
        stickyTabContext.handlersMutable.value = {};
      }
    };
  }, [stickyTabContext, panHandler]);

  // ★ 迁移重点：Reanimated v3 移除了 useAnimatedGestureHandler。
  // 改为使用 react-native-gesture-handler v2 的 Gesture.Pan() 新 API：
  //   - onStart → Gesture.Pan().onStart
  //   - onActive → Gesture.Pan().onUpdate（新 API 叫 onUpdate）
  //   - onEnd → Gesture.Pan().onEnd
  //   - onCancel/onFail → Gesture.Pan().onFinalize(e, success=false)
  // 手势回调中出现 JS 异常时，通过 runOnJS 输出到 Metro，避免 C++ 异常穿透到 UIKit 手势系统
  const logWorkletError = (location: string, msg: string) => {
    console.error(`[ElasticScrollView][${location}]`, msg);
  };

  const panGesture = React.useMemo(() => {
    // 只用方向性 activeOffset，不使用 failOffset：
    //   failOffset 会在手势已进入 BEGAN 状态后尝试触发 FAILED，
    //   与 UIKit 状态机规定冲突（Began → Failed 非法），会抛 NSException 导致 Expo Go 崩溃。
    // 改为：各方向只在匹配轴超过阈值时激活，RNGH 的内置冲突解决机制负责嵌套手势仲裁。
    const gesture = Gesture.Pan().maxPointers(1).enabled(!!scrollEnabled);
    if (scrollEnabled === "vertical") {
      gesture.activeOffsetY([-8, 8]);
    } else if (scrollEnabled === "horizontal") {
      gesture.activeOffsetX([-10, 10]);
    } else {
      gesture.activeOffsetX([-10, 10]).activeOffsetY([-8, 8]);
    }
    return gesture
      .onStart((e) => {
        "worklet";
        try {
          // 先让 onStart 填充 ctx（ctx.last / ctx.priority 等），
          // 再赋给 gestureCtx.value，确保 onUpdate 读到完整快照
          const ctx: TGestureContext = {};
          panHandler!.onStart?.(e, ctx);
          gestureCtx.value = ctx;
        } catch (err) {
          scheduleOnRN(logWorkletError, "onStart", String(err));
        }
      })
      .onUpdate((e) => {
        "worklet";
        try {
          // 读 → 修改 → 写回，保证 ctx.last 等字段在 New Architecture 下跨调用可见
          const ctx = gestureCtx.value;
          panHandler!.onActive?.(e, ctx);
          gestureCtx.value = ctx;
        } catch (err) {
          scheduleOnRN(logWorkletError, "onUpdate", String(err));
        }
      })
      .onEnd((e) => {
        "worklet";
        try {
          const ctx = gestureCtx.value;
          panHandler!.onEnd?.(e, ctx);
          gestureCtx.value = ctx;
        } catch (err) {
          scheduleOnRN(logWorkletError, "onEnd", String(err));
        }
      })
      .onFinalize((_e, success) => {
        "worklet";
        try {
          // success=false 对应手势被取消或失败，执行 snap/rebound 恢复逻辑
          if (!success) {
            const ctx = gestureCtx.value;
            if (_e.state === State.FAILED) {
              panHandler!.onFail?.(_e, ctx);
            } else {
              panHandler!.onCancel?.(_e, ctx);
            }
            gestureCtx.value = ctx;
          }
        } catch (err) {
          scheduleOnRN(logWorkletError, "onFinalize", String(err));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panHandler, scrollEnabled]);

  const tapGesture = React.useMemo(
    () =>
      Gesture.Tap()
        .enabled(!!tapToHideKeyboard)
        .onEnd(() => {
          "worklet";
          scheduleOnRN(dismissKeyboard);
        }),
    [tapToHideKeyboard],
  );

  const contentContainerStyle = useAnimatedStyle(() => {
    return { transform: [{ translateX: -x.value }, { translateY: -y.value }] };
  });

  return (
    <GestureDetector gesture={Gesture.Simultaneous(panGesture, tapGesture)}>
      <Reanimated.View
        {...nativeViewProps}
        onLayout={onSize}
        style={[{ flex: 1, overflow: "hidden" }, props.style]}
      >
        <Reanimated.View
          onLayout={onContentSize}
          style={[contentContainerStyle, props.contentContainerStyle]}
        >
          {props.onRefresh && (
            <View
              style={{
                marginTop: -pullRefreshHeaderHeight,
                height: pullRefreshHeaderHeight,
              }}
            >
              <props.pullRefreshHeader offset={y} ref={props.pullRefreshHeaderRef} />
            </View>
          )}
          <ElasticScrollContext.Provider value={panHandler}>
            {props.children}
          </ElasticScrollContext.Provider>
          {props.onEndReached && (
            <View style={{ height: props.loadMoreFooter.height }}>
              <props.loadMoreFooter
                loadFinished={props.loadFinished}
                loadingMore={props.loadingMore}
              />
            </View>
          )}
        </Reanimated.View>
        {hScroll && props.showsHorizontalScrollIndicator && (
          <Indicator {...props} horizontal focus={focus} />
        )}
        {vScroll && props.showsVerticalScrollIndicator && (
          <Indicator {...props} focus={focus} />
        )}
      </Reanimated.View>
    </GestureDetector>
  );
};
