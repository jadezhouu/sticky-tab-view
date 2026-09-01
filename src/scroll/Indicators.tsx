import React, { useMemo } from 'react';
import Reanimated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { TIndicatorProps } from '../types.js';
import { styles } from '../styles.js';

export function Indicator(props: TIndicatorProps) {
  const {
    size,
    focus,
    contentSize,
    horizontal,
    contentOffset: { x, y },
  } = props;
  const opacity = useSharedValue(0);
  useAnimatedReaction(
    () => focus.value,
    (res, pre) => {
      if (res != pre) {
        cancelAnimation(opacity);
        opacity.value = res ? 1 : withDelay(2000, withTiming(0));
      }
    },
  );
  const trackSize = useAnimatedStyle(() => {
    if (horizontal) {
      if (!contentSize.width.value) return {};
      const width = (size.width.value * size.width.value) / contentSize.width.value - 6;
      return { width: Math.max(0, width) };
    }
    if (!contentSize.height.value) return {};
    const height = (size.height.value * size.height.value) / contentSize.height.value - 6;
    return { height: Math.max(0, height) };
  });
  const transform = useAnimatedStyle(() => {
    if (horizontal) {
      if (!contentSize.width.value) return { opacity: 0 };
      const translateX = (x!.value * size.width.value) / contentSize.width.value;
      return { opacity: opacity.value, transform: [{ translateX }] };
    }
    if (!contentSize.height.value) return { opacity: 0 };
    const translateY = (y!.value * size.height.value) / contentSize.height.value;
    return { opacity: opacity.value, transform: [{ translateY }] };
  });
  const style = useMemo(
    () => (horizontal ? { left: 3, bottom: 4, height: 3 } : { top: 3, right: 3, width: 3 }),
    [horizontal],
  );
  return <Reanimated.View style={[styles.indicator, style, trackSize, transform]} />;
}
