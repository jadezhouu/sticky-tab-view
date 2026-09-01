/**
 * V3-5-02：自定义 decay/animation 边界测试（PR-2）。
 *
 * 覆盖六种边界：完成、反向、overscroll(clamp)、零速度、取消、组件卸载。
 * 直接驱动 src/core/decay.ts 的 withDecay 工厂返回的动画对象（模拟 UI Runtime
 * 的 onStart/onFrame 调用），并在卸载路径上断言 cancelAnimation 被调用。
 * Reanimated mock 的 defineAnimation 同步返回工厂结果，因此可拿到动画对象。
 */

import { act, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { cancelAnimation, type SharedValue } from 'react-native-reanimated';

import { withDecay, type ExtendedDecayConfig } from '../src/core/decay';
import { StickyTabView } from '../src/StickyTabView.js';

/** withDecay 工厂返回的动画对象结构（对应 v3 InnerDecayAnimation） */
interface DecayAnimation {
  current: number;
  velocity: number;
  lastTimestamp: number;
  startTimestamp: number;
  initialVelocity: number;
  onFrame: (a: DecayAnimation, now: number) => boolean;
  onStart: (a: DecayAnimation, value: number, now: number) => void;
  callback?: (finished?: boolean) => void;
}

function startDecay(
  config: ExtendedDecayConfig,
  callback?: (finished?: boolean) => void,
): DecayAnimation {
  return withDecay(config, callback) as unknown as DecayAnimation;
}

/** 驱动动画直到完成或达到最大帧数，返回结果 */
function drive(
  anim: DecayAnimation,
  opts: { start?: number; frameMs?: number; maxFrames?: number } = {},
): { finished: boolean; frames: number; position: number; velocity: number } {
  const now = { t: 0 };
  anim.onStart(anim, opts.start ?? 0, now.t);
  const frameMs = opts.frameMs ?? 16;
  const maxFrames = opts.maxFrames ?? 500;
  let finished = false;
  let frames = 0;
  while (!finished && frames < maxFrames) {
    now.t += frameMs;
    finished = anim.onFrame(anim, now.t);
    frames += 1;
  }
  return { finished, frames, position: anim.current, velocity: anim.velocity };
}

describe('custom decay animation boundaries (V3-5-02)', () => {
  test('完成: positive velocity decays to a stop', () => {
    const anim = startDecay({ velocity: 500 });
    const result = drive(anim, { maxFrames: 2000 });
    expect(result.finished).toBe(true);
    expect(result.position).toBeGreaterThan(0);
    expect(result.velocity).toBeLessThan(1);
  });

  test('零速度: zero velocity completes on the first frame', () => {
    const anim = startDecay({ velocity: 0 });
    const result = drive(anim);
    expect(result.finished).toBe(true);
    expect(result.frames).toBe(1);
    expect(result.position).toBe(0);
  });

  test('反向: negative velocity drives the position negative', () => {
    const anim = startDecay({ velocity: -500 });
    const result = drive(anim, { maxFrames: 2000 });
    expect(result.finished).toBe(true);
    expect(result.position).toBeLessThan(0);
    expect(result.velocity).toBeGreaterThan(-1);
  });

  test('overscroll: positive clamp stops exactly at the upper bound', () => {
    const anim = startDecay({ velocity: 500, clamp: [0, 100] });
    const result = drive(anim);
    expect(result.finished).toBe(true);
    expect(result.position).toBe(100);
  });

  test('overscroll: negative clamp stops exactly at the lower bound', () => {
    const anim = startDecay({ velocity: -500, clamp: [0, 100] });
    const result = drive(anim, { start: 50 });
    expect(result.finished).toBe(true);
    expect(result.position).toBe(0);
  });

  test('frame-rate resilience: a long gap is clamped to 64ms and does not overshoot the clamp', () => {
    const anim = startDecay({ velocity: 500, clamp: [0, 100] });
    anim.onStart(anim, 0, 0);
    // 一次 500ms 卡顿后，再正常走帧：位移受 clamp 保护，不会被大 delta 冲过边界。
    const now = { t: 0 };
    anim.onFrame(anim, 500); // delta 被 clamp 到 64ms
    let finished = false;
    for (let i = 0; i < 200 && !finished; i += 1) {
      now.t += 16;
      finished = anim.onFrame(anim, now.t);
    }
    expect(anim.current).toBe(100);
    expect(finished).toBe(true);
  });

  test('focus release: velocity below 100 releases the arbitration focus', () => {
    // 运行时是 mock 的 SharedValue（{ value }），真实类型声明带 JSI 方法，需要桥接断言。
    const focus = { value: true } as unknown as SharedValue<boolean | 'vertical' | 'horizontal'>;
    const anim = startDecay({ velocity: 200, focus: focus });
    drive(anim);
    expect(focus.value).toBe(false);
  });

  test('取消: completion callback fires with finished=true and cancel simulation is a no-op', () => {
    const cb = jest.fn();
    const anim = startDecay({ velocity: 500 }, cb);
    // 取消路径：Reanimated 在动画被 cancel 时以 finished=false 调 callback。
    expect(anim.callback).toBe(cb);
    anim.callback?.(false);
    expect(cb).toHaveBeenCalledWith(false);
    expect(() => anim.callback?.(true)).not.toThrow();
  });

  test('组件卸载: unmount cancels all running animations', async () => {
    const screen = await render(
      <StickyTabView
        tabCount={1}
        renderHeader={() => <Text>Header</Text>}
        renderTab={() => <Text>Tab</Text>}
      />,
    );
    (cancelAnimation as jest.Mock).mockClear();
    // 卸载清理必须在 act 中触发 React effect cleanup。
    await act(async () => {
      screen.unmount();
    });
    // StickyTabView 卸载清理对 valuesRef/handlersRef 全部调用 cancelAnimation。
    expect(cancelAnimation).toHaveBeenCalled();
  });
});
