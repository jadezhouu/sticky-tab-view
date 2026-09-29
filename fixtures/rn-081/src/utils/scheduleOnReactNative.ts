import { runOnJS } from "react-native-reanimated";

/**
 * 本地线程调度适配层（fixture 侧副本，与 example/src/utils 同源）。
 *
 * 与库内 `src/scheduleOnReactNative.ts` 同源：Reanimated 3 从 UI/worklet 线程回 JS 的
 * 唯一官方方式是 `runOnJS(callback)(...args)`。fixture 不从包的子路径导入适配层
 * （发布面的 exports 只冻结为 `.` 与 `./package.json`），而是保留一份本地副本，
 * 让 fixture 的 worklet→JS 回调也走同一个适配 API——与 example 的处理方式一致。
 *
 * - `'worklet'` 指令让本函数被 Reanimated Babel plugin 编译为 worklet，
 *   因此可从任意 worklet（手势回调、useAnimatedReaction 等）中调用。
 * - 参数经 `...args` 原样透传给 `runOnJS`，保持位次（含单个/中间/尾部
 *   `undefined` 与 `null`）。
 *
 * 该文件是源码扫描测试中 `runOnJS` 允许出现的位置之一（V3-4-01）。
 */
export function scheduleOnReactNative<Args extends unknown[]>(
  callback: (...args: Args) => void,
  ...args: Args
): void {
  "worklet";
  runOnJS(callback)(...args);
}
