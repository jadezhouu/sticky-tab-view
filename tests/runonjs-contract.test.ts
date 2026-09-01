/**
 * V3-3-09：Reanimated 3 Jest mock 的 runOnJS 调用契约。
 *
 * Reanimated 3 中 `runOnJS(callback)(...args)` 在 UI 线程 worklet 里调度 callback
 * 到 JS 线程执行，返回 void。测试环境里 mock 必须同步调用 callback、保留参数位次，
 * 但**不保留返回值**（P1-02：wrapper 返回 undefined），这样 PR-2 的
 * scheduleOnReactNative 适配器测试才能在纯 JS 下运行。
 */

import { runOnJS } from 'react-native-reanimated';

describe('runOnJS mock contract (V3-3-09)', () => {
  test('runOnJS(callback)(...args) invokes the callback with all args', () => {
    const spy = jest.fn();
    runOnJS(spy)(1, 'two', undefined, null);
    expect(spy).toHaveBeenCalledWith(1, 'two', undefined, null);
  });

  test('runOnJS with zero arguments still invokes the callback', () => {
    const spy = jest.fn();
    runOnJS(spy)();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith();
  });

  test('runOnJS wrapper invokes the callback but returns undefined', () => {
    const fn = jest.fn((a: number, b: number) => a + b);
    const result = runOnJS(fn)(40, 2);
    expect(fn).toHaveBeenCalledWith(40, 2);
    expect(result).toBeUndefined();
  });
});
