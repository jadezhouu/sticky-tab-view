import { runOnJS } from 'react-native-reanimated';

/**
 * 内部线程调度适配层（R3-003）。
 *
 * Reanimated 3 从 UI/worklet 线程回 JS 的唯一官方方式是 `runOnJS(callback)(...args)`。
 * 本适配层把这一调用收敛到单一内部 API，业务代码不再散布 `runOnJS`：
 *
 *   scheduleOnReactNative(callback, ...args)
 *
 * - `'worklet'` 指令让本函数被 Reanimated Babel plugin 编译为 worklet，
 *   因此可从任意 worklet（手势回调、useAnimatedReaction 等）中调用。
 * - 参数经 `...args` 原样透传给 `runOnJS`，保持位次（含单个/中间/尾部
 *   `undefined` 与 `null`），用于 optional 参数与 Promise resolve/reject。
 * - 本函数保持内部 API，不从公共入口 `src/index.ts` 导出。
 *
 * 该函数是源码扫描测试中 `runOnJS` 唯一允许出现的位置（V3-4-01）。
 */
export function scheduleOnReactNative<Args extends unknown[]>(
  callback: (...args: Args) => void,
  ...args: Args
): void {
  'worklet';
  runOnJS(callback)(...args);
}
