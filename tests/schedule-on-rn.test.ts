/**
 * V3-4-01：scheduleOnReactNative 适配层单元测试（PR-2）。
 *
 * 覆盖指南 R3-003 要求的线程调度适配矩阵：
 *   - 无参数 callback
 *   - 单参数和多参数 callback
 *   - 单个 / 中间 / 尾部 `undefined` 的位次保持
 *   - `null` 与 `undefined` 的区分
 *   - optional 参数：省略（0 位）与显式 undefined（1 位）的区分
 *   - Promise resolve / reject
 *   - React state setter
 *   - 错误日志回传
 *
 * 红态：`../src/scheduleOnReactNative` 尚不存在，导入即失败；
 * 实现（V3-4-03）后转绿。Reanimated mock 的 runOnJS 同步调用 callback 并返回 void
 * （P1-02），因此断言为同步行为，与 runonjs-contract 测试一致。
 */

import { scheduleOnReactNative } from '../src/scheduleOnReactNative';

describe('scheduleOnReactNative adapter (V3-4-01)', () => {
  test('no-arg callback is scheduled exactly once', () => {
    const fn = jest.fn();
    scheduleOnReactNative(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith();
    expect(fn.mock.calls[0]).toHaveLength(0);
  });

  test('single-arg callback receives the value', () => {
    const fn = jest.fn();
    scheduleOnReactNative(fn, 42);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(42);
  });

  test('multi-arg callback receives all values in order', () => {
    const fn = jest.fn();
    const payload = { four: 4 };
    scheduleOnReactNative(fn, 1, 'two', true, payload);
    expect(fn).toHaveBeenCalledWith(1, 'two', true, payload);
  });

  test('single undefined is preserved as a positional argument', () => {
    const fn = jest.fn();
    scheduleOnReactNative(fn, undefined);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(undefined);
    expect(fn.mock.calls[0]).toHaveLength(1);
  });

  test('middle undefined is preserved', () => {
    const fn = jest.fn();
    scheduleOnReactNative(fn, 'a', undefined, 'c');
    expect(fn).toHaveBeenCalledWith('a', undefined, 'c');
    expect(fn.mock.calls[0]).toHaveLength(3);
  });

  test('trailing undefined is preserved', () => {
    const fn = jest.fn();
    scheduleOnReactNative(fn, 'a', undefined);
    expect(fn).toHaveBeenCalledWith('a', undefined);
    expect(fn.mock.calls[0]).toHaveLength(2);
  });

  test('null is distinct from undefined', () => {
    const fn = jest.fn();
    scheduleOnReactNative(fn, null);
    expect(fn.mock.calls[0]).toEqual([null]);
  });

  test('optional param: omitted vs explicit undefined keep arity distinct', () => {
    const fn = jest.fn((_v?: number) => undefined);
    scheduleOnReactNative(fn);
    expect(fn.mock.calls[0]).toHaveLength(0);
    scheduleOnReactNative(fn, undefined);
    expect(fn.mock.calls[1]).toHaveLength(1);
  });

  test('Promise resolve is scheduled with its value', async () => {
    let resolve!: (value: string) => void;
    const p = new Promise<string>((res) => {
      resolve = res;
    });
    scheduleOnReactNative(resolve, 'done');
    await expect(p).resolves.toBe('done');
  });

  test('Promise reject is scheduled with the error', async () => {
    let reject!: (err: Error) => void;
    const p = new Promise<never>((_, rej) => {
      reject = rej;
    });
    const err = new Error('boom');
    scheduleOnReactNative(reject, err);
    await expect(p).rejects.toBe(err);
  });

  test('React state setter (functional update) is invoked', () => {
    const setState = jest.fn();
    scheduleOnReactNative(setState, (prev: number) => prev + 1);
    expect(setState).toHaveBeenCalledTimes(1);
    const updater = setState.mock.calls[0][0] as (prev: number) => number;
    expect(updater(1)).toBe(2);
  });

  test('error logging path receives phase and message', () => {
    const log = jest.fn();
    scheduleOnReactNative(log, 'onStart', new Error('boom').message);
    expect(log).toHaveBeenCalledWith('onStart', 'boom');
  });
});
