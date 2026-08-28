import {
  AnimationCallback,
  defineAnimation,
  SharedValue,
} from "react-native-reanimated";

type TFocus = SharedValue<boolean | "vertical" | "horizontal">;

// Reanimated v3 中 WithDecayConfig (= DecayConfig) 是联合类型，无法用 interface extends，
// 因此改为 type 交叉形式来附加 focus 字段。
export type ExtendedDecayConfig = {
  velocity?: number;
  deceleration?: number;
  clamp?: [number, number];
  velocityFactor?: number;
  focus?: TFocus;
};

type ResolvedDecayConfig = {
  velocity: number;
  deceleration: number;
  clamp?: [number, number];
  velocityFactor: number;
  focus?: TFocus;
};

// Reanimated v3 中 InnerDecayAnimation 的结构（来自 lib/typescript/animation/decay/utils.d.ts）
// 本地定义避免依赖内部路径
interface InnerDecayAnimation {
  current: number;
  velocity: number;
  lastTimestamp: number;
  startTimestamp: number;
  initialVelocity: number;
  onFrame: (animation: InnerDecayAnimation, now: number) => boolean;
  onStart: (animation: InnerDecayAnimation, value: number, now: number) => void;
  callback?: AnimationCallback;
}

export function withDecay(
  userConfig: ExtendedDecayConfig,
  callback?: AnimationCallback,
): number {
  "worklet";
  // 在 Reanimated v3 中 defineAnimation 返回 T (AnimationObject)，
  // 但 Reanimated 内部会把它当作 number 处理，需要在类型层面强制转换。
  return defineAnimation(0, () => {
    "worklet";
    const config: ResolvedDecayConfig = {
      deceleration: 0.998,
      velocityFactor: 1,
      velocity: 0,
    };
    if (userConfig) {
      Object.assign(config, userConfig);
    }

    const MIN_VELOCITY = 1;

    // 自定义衰减：逐毫秒积分保证跨帧率（60/120Hz）物理一致性
    function decay(animation: InnerDecayAnimation, now: number): boolean {
      const { lastTimestamp, initialVelocity } = animation;
      // 限制最大帧间隔 64ms，防止卡帧后飞速滚动
      const deltaTime = Math.max(0, Math.min(now - lastTimestamp, 64));
      const rate = config.deceleration;
      const factor = Math.pow(rate, deltaTime);
      // Sum the geometric series instead of integrating every millisecond.
      // This preserves the previous discrete physics while making a frame O(1).
      const travelled = rate === 1
        ? animation.velocity * config.velocityFactor * deltaTime / 1000
        : animation.velocity * config.velocityFactor * rate * (1 - factor) / (1 - rate) / 1000;
      animation.current += travelled;
      animation.velocity *= factor;
      animation.lastTimestamp = now;
      if (config.clamp) {
        if (initialVelocity < 0 && animation.current <= config.clamp[0]) {
          animation.current = config.clamp[0];
          return true;
        } else if (
          initialVelocity > 0 &&
          animation.current >= config.clamp[1]
        ) {
          animation.current = config.clamp[1];
          return true;
        }
      }
      // 速度足够小时主动释放手势 focus，通知仲裁层滚动已结束
      if (Math.abs(animation.velocity) < 100 && config.focus?.value) {
        config.focus.value = false;
      }
      return Math.abs(animation.velocity) < MIN_VELOCITY;
    }

    function validateConfig(): void {
      if (config.clamp) {
        if (!Array.isArray(config.clamp)) {
          throw Error(
            `config.clamp must be an array but is ${typeof config.clamp}`,
          );
        }
        if (config.clamp.length !== 2) {
          throw Error(
            `clamp array must contain 2 items but is given ${config.clamp.length}`,
          );
        }
      }
      if (config.velocityFactor <= 0) {
        throw Error(
          `config.velocityFactor must be greater than 0 but is ${config.velocityFactor}`,
        );
      }
    }

    function onStart(
      animation: InnerDecayAnimation,
      value: number,
      now: number,
    ): void {
      animation.current = value;
      animation.lastTimestamp = now;
      animation.startTimestamp = now;
      animation.initialVelocity = config.velocity;
      validateConfig();
    }

    return {
      onFrame: decay,
      onStart,
      callback,
      velocity: config.velocity ?? 0,
      initialVelocity: 0,
      current: 0,
      lastTimestamp: 0,
      startTimestamp: 0,
    };
  }) as unknown as number;
}
