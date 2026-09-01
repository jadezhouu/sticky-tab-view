import React from 'react';

export type SharedValue<T> = { value: T };

export const makeMutable = <T,>(value: T): SharedValue<T> => ({ value });
export const useSharedValue = <T,>(value: T): SharedValue<T> => {
  const sharedValue = React.useRef<SharedValue<T> | undefined>(undefined);
  if (!sharedValue.current) sharedValue.current = makeMutable(value);
  return sharedValue.current;
};
export const cancelAnimation = jest.fn();
export const withSpring = <T,>(
  value: T,
  _config?: unknown,
  callback?: (finished: boolean) => void,
): T => {
  callback?.(true);
  return value;
};
export const withTiming = withSpring;
export const withDelay = <T,>(_delay: number, value: T): T => value;
export const useAnimatedStyle = <T,>(updater: () => T): T => updater();
export const useDerivedValue = <T,>(updater: () => T): SharedValue<T> => ({ value: updater() });
export const useAnimatedReaction = jest.fn();
// runOnJS(callback)(...args)：Reanimated 3 中它在 UI 线程 worklet 里把 callback 调度到
// JS 线程执行，返回 void。mock 必须同步调用 callback 并返回 undefined（P1-02）——
// 不能直接返回 callback 本身，否则会把 UI→JS 调度语义偷换成同步调用且保留返回值。
export const runOnJS =
  <T extends (...args: never[]) => unknown>(callback: T) =>
  (...args: Parameters<T>): void => {
    callback(...args);
  };
export const defineAnimation = <T,>(_initial: T, factory: () => T): T => factory();

const Reanimated = { View: 'AnimatedView' };

export default Reanimated;
