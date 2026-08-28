import {
  clamp,
  getMaxOffset,
  getPageTarget,
  normalizePage,
  shouldTriggerEndReached,
} from '../src/core/geometry.js';
import {
  areDependencyListsEqual,
  createRequestGenerationGuard,
  findShortestColumnIndex,
  findNearestThumbIndex,
  isAbortError,
  makeAbortable,
  mergeFetchResult,
  normalizeMasonryColumn,
} from '../src/masonry/model.js';
import { withDecay } from '../src/core/decay.js';
import type {
  TElasticScrollViewCoreProps,
  TElasticScrollViewProps,
} from '../src/types.js';
import type { TFetchContext, TPanHandler } from '../src/index.js';
import type { StyleProp, ViewStyle } from 'react-native';

describe('scroll geometry', () => {
  test('normalizes invalid and out-of-range pages', () => {
    expect(normalizePage(undefined, 3)).toBe(0);
    expect(normalizePage(2, 3)).toBe(2);
    expect(normalizePage(-1, 3)).toBe(0);
    expect(normalizePage(99, 3)).toBe(2);
    expect(normalizePage(Number.NaN, 3)).toBe(0);
    expect(normalizePage(1.5, 3)).toBe(0);
    expect(normalizePage(1, 0)).toBe(0);
  });

  test('never exposes negative scroll ranges', () => {
    expect(getMaxOffset(100, 300, 12)).toBe(12);
    expect(getMaxOffset(500, 300, 12)).toBe(212);
    expect(clamp(1000, 0, 0)).toBe(0);
  });

  test('chooses a reachable paging target from velocity and distance', () => {
    expect(getPageTarget({ currentPage: 1, offset: 300, pageSize: 300, contentSize: 750, velocity: 0 })).toBe(1);
    expect(getPageTarget({ currentPage: 1, offset: 490, pageSize: 300, contentSize: 750, velocity: 0 })).toBe(2);
    expect(getPageTarget({ currentPage: 1, offset: 320, pageSize: 300, contentSize: 750, velocity: -4 })).toBe(2);
    expect(getPageTarget({ currentPage: 0, offset: 0, pageSize: 300, contentSize: 750, velocity: 4 })).toBe(0);
    expect(getPageTarget({ currentPage: 2, offset: 600, pageSize: 300, contentSize: 750, velocity: -4 })).toBe(2);
  });

  test('uses configured end-reached distance and only triggers once per arm', () => {
    expect(shouldTriggerEndReached({ offset: 650, contentSize: 1000, viewportSize: 300, distance: 100, armed: true })).toBe(true);
    expect(shouldTriggerEndReached({ offset: 599, contentSize: 1000, viewportSize: 300, distance: 100, armed: true })).toBe(false);
    expect(shouldTriggerEndReached({ offset: 650, contentSize: 1000, viewportSize: 300, distance: 100, armed: false })).toBe(false);
  });
});

describe('Masonry immutable data model', () => {
  const first = [{ items: [{ id: 'a' }], column: 2 }];

  test('replaces on first page and appends item results without mutating inputs', () => {
    const result = mergeFetchResult(first, { items: [{ id: 'b' }] }, { replace: false });
    expect(result).toEqual([{ items: [{ id: 'a' }, { id: 'b' }], column: 2 }]);
    expect(first).toEqual([{ items: [{ id: 'a' }], column: 2 }]);
  });

  test('appends sections and rejects ambiguous fetch responses', () => {
    const sections = [{ items: [{ id: 'b' }], column: 1 }];
    expect(mergeFetchResult(first, { sections }, { replace: false })).toEqual([...first, ...sections]);
    expect(() => mergeFetchResult(first, { items: [], sections }, { replace: false })).toThrow('either items or sections');
  });

  test('compares dependency lists in both directions', () => {
    expect(areDependencyListsEqual([1, 2], [1, 2])).toBe(true);
    expect(areDependencyListsEqual([1], [1, 2])).toBe(false);
    expect(areDependencyListsEqual([1, 2], [1])).toBe(false);
  });

  test('rejects stale request generations after a newer request or invalidation', () => {
    const guard = createRequestGenerationGuard();
    const first = guard.begin();
    const second = guard.begin();

    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);

    guard.invalidate();
    expect(guard.isCurrent(second)).toBe(false);
  });

  test('settles an aborted request with an AbortError', async () => {
    const controller = new AbortController();
    const request = makeAbortable(new Promise<never>(() => undefined), controller);

    request.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(isAbortError(await request.catch((error: unknown) => error))).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });

  test('normalizes invalid masonry column counts to one column', () => {
    expect(normalizeMasonryColumn(3)).toBe(3);
    expect(normalizeMasonryColumn(0)).toBe(1);
    expect(normalizeMasonryColumn(-1)).toBe(1);
    expect(normalizeMasonryColumn(1.5)).toBe(1);
    expect(normalizeMasonryColumn(Number.NaN)).toBe(1);
  });

  test('selects the nearest masonry thumb deterministically', () => {
    const thumbs = [
      { y: 0, height: 100 },
      { y: 150, height: 50 },
      { y: 300, height: 100 },
    ];

    expect(findNearestThumbIndex(thumbs, 0, 100)).toBe(0);
    expect(findNearestThumbIndex(thumbs, 125, 100)).toBe(1);
    expect(findNearestThumbIndex(thumbs, 310, 100)).toBe(2);
    expect(findNearestThumbIndex([], 0, 100)).toBe(0);
  });

  test('selects the first shortest column without allocating a sorted copy', () => {
    expect(findShortestColumnIndex([240, 120, 120, 300])).toBe(1);
    expect(findShortestColumnIndex([0])).toBe(0);
    expect(findShortestColumnIndex([])).toBe(0);
  });
});

describe('public and internal scroll prop contracts', () => {
  test('accepts composed content styles and non-zero internal page sizes', () => {
    const contentContainerStyle: StyleProp<ViewStyle> = [
      { paddingTop: 12 },
      false,
    ];
    const publicProps: TElasticScrollViewProps = { contentContainerStyle };
    const coreProps: Pick<TElasticScrollViewCoreProps, 'pageSize'> = {
      pageSize: { width: 320, height: 640 },
    };

    expect(publicProps.contentContainerStyle).toBe(contentContainerStyle);
    expect(coreProps.pageSize).toEqual({ width: 320, height: 640 });
  });

  test('exposes the pan handler contract used by public scroll props', () => {
    const panHandler: TPanHandler = {
      onStart: () => undefined,
    };
    const props: TElasticScrollViewProps = { panHandler };

    expect(props.panHandler).toBe(panHandler);
  });

  test('exposes the fetch context used by public Masonry callbacks', () => {
    const context: TFetchContext = { source: 'external-consumer' };

    expect(context.source).toBe('external-consumer');
  });
});

describe('decay animation', () => {
  test('does not accelerate when a frame timestamp moves backwards', () => {
    type Animation = {
      current: number;
      velocity: number;
      lastTimestamp: number;
      startTimestamp: number;
      initialVelocity: number;
      onStart: (animation: Animation, value: number, now: number) => void;
      onFrame: (animation: Animation, now: number) => boolean;
    };
    const animation = withDecay({ velocity: 100, deceleration: 0.998 }) as unknown as Animation;

    animation.onStart(animation, 0, 100);
    animation.onFrame(animation, 90);

    expect(animation.current).toBe(0);
    expect(animation.velocity).toBe(100);
  });

  test('applies velocityFactor to travelled distance', () => {
    type Animation = {
      current: number;
      velocity: number;
      lastTimestamp: number;
      startTimestamp: number;
      initialVelocity: number;
      onStart: (animation: Animation, value: number, now: number) => void;
      onFrame: (animation: Animation, now: number) => boolean;
    };
    const animation = withDecay({
      velocity: 100,
      deceleration: 1,
      velocityFactor: 2,
    }) as unknown as Animation;

    animation.onStart(animation, 0, 0);
    animation.onFrame(animation, 64);

    expect(animation.current).toBeCloseTo(12.8);
    expect(animation.velocity).toBe(100);
  });
});
