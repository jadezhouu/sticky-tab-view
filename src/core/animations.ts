import { SharedValue, withSpring, withTiming } from "react-native-reanimated";
import { withDecay } from "./decay.js";

type TValue = SharedValue<number>;
type TFocus = SharedValue<boolean | "vertical" | "horizontal">;

export function rebound(
  value: TValue,
  to: number,
  velocity: number,
  focus: TFocus,
  animTracker: TValue,
) {
  "worklet";
  // animTracker 仅作计时器（动画结束后清除 focus），无需同步到 value 的当前值
  animTracker.value = withTiming(to, { duration: 500 }, (finish) => {
    if (finish) focus.value = false;
  });
  value.value = withSpring(to, {
    velocity,
    damping: 30,
    mass: 1,
    stiffness: 225,
  });
}

export function pageScroll(
  value: TValue,
  to: number,
  velocity: number,
  focus: TFocus,
  animTracker: TValue,
) {
  "worklet";
  animTracker.value = withTiming(to, { duration: 350 }, (isFinish) => {
    if (isFinish) focus.value = false;
  });
  value.value = withSpring(to, {
    velocity,
    damping: 50,
    mass: 1,
    stiffness: 625,
  });
}

export function decay(
  value: TValue,
  deceleration: number,
  velocity: number,
  clamp: [number, number],
  bounces: boolean,
  focus: TFocus,
  animTracker: TValue,
) {
  "worklet";
  value.value = withDecay(
    { velocity, deceleration, clamp, focus },
    (isFinish) => {
      if (!isFinish) return;
      if (!bounces) {
        focus.value = false;
        return;
      }
      const duration = Math.abs(velocity) / 6;
      if (value.value === clamp[0] || value.value === clamp[1]) {
        animTracker.value = value.value;
        animTracker.value = withTiming(value.value + 0.01, { duration }, (finish) => {
          if (finish) focus.value = false;
        });
        value.value = withSpring(value.value + 0.01, {
          damping: 48,
          mass: 2.56,
          stiffness: 225,
        });
      }
    },
  );
}
