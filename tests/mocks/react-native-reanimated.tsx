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
export const runOnJS = <T extends (...args: never[]) => unknown>(callback: T): T => callback;
export const defineAnimation = <T,>(_initial: T, factory: () => T): T => factory();

const Reanimated = { View: 'AnimatedView' };

export default Reanimated;
