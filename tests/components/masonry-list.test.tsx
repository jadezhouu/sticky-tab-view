import React from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { findAll } from '@testing-library/react-native/dist/helpers/find-all';
import { makeMutable, useAnimatedReaction } from 'react-native-reanimated';
import { __panGestures } from '../mocks/react-native-gesture-handler';

import { MasonryList } from '../../src/masonry/MasonryList.js';

type Item = { id: string; reuseType?: string };

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function layoutMasonry(screen: Awaited<ReturnType<typeof render>>) {
  const root = screen.getByTestId('masonry-root');
  await act(async () => {
    root.props.onLayout({ nativeEvent: { layout: { width: 320, height: 640 } } });
    const layoutNodes = findAll(
      screen.root!,
      (node) => node.type === 'View' && node.props.onLayout && node !== root,
    );
    layoutNodes.forEach((node) => {
      node.props.onLayout({ nativeEvent: { layout: { width: 320, height: 0 } } });
    });
  });
}

describe('MasonryList', () => {
  test('renders section headers returned by the first request', async () => {
    const response = createDeferred<{ sections: { items: Item[] }[]; hasMore: boolean }>();
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={() => response.promise}
        renderItem={(item) => <Text>{item.id}</Text>}
        renderSectionHeader={(_section, index) => <Text>Section {index}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      response.resolve({ sections: [{ items: [{ id: 'a' }] }], hasMore: false });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Section 0')).toBeTruthy();
  });

  test('aborts an in-flight request on unmount without publishing its response', async () => {
    const response = createDeferred<{ items: Item[]; hasMore: boolean }>();
    const onDataUpdate = jest.fn();
    let signal: AbortSignal | undefined;
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onDataUpdate={onDataUpdate}
        onFetch={(_page, _ctx, requestSignal) => {
          signal = requestSignal;
          return response.promise;
        }}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    expect(signal?.aborted).toBe(false);

    await act(async () => {
      screen.unmount();
    });
    expect(signal?.aborted).toBe(true);

    await act(async () => {
      response.resolve({ items: [{ id: 'late' }], hasMore: false });
      await Promise.resolve();
    });
    expect(onDataUpdate).not.toHaveBeenCalled();
  });

  test('publishes only the latest response after a dependency-triggered reload', async () => {
    const first = createDeferred<{ items: Item[]; hasMore: boolean }>();
    const second = createDeferred<{ items: Item[]; hasMore: boolean }>();
    const onDataUpdate = jest.fn();
    const onFetch = jest.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const renderList = (deps: readonly unknown[]) => (
      <MasonryList<Item>
        deps={deps}
        heightForItem={() => 80}
        onDataUpdate={onDataUpdate}
        onFetch={onFetch}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />
    );
    const screen = await render(renderList([0]));

    await layoutMasonry(screen);
    await screen.rerender(renderList([1]));
    expect(onFetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      first.resolve({ items: [{ id: 'stale' }], hasMore: false });
      await Promise.resolve();
    });
    expect(onDataUpdate).not.toHaveBeenCalled();

    await act(async () => {
      second.resolve({ items: [{ id: 'fresh' }], hasMore: false });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onDataUpdate).toHaveBeenLastCalledWith([
      expect.objectContaining({ items: [{ id: 'fresh' }] }),
    ]);
  });

  test('exposes an initial error phase and retries the failed first page', async () => {
    const onFetch = jest.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [{ id: 'recovered' }], hasMore: false });
    let retry: (() => void) | undefined;
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={onFetch}
        renderError={({ phase, retry: retryRequest }) => {
          retry = retryRequest;
          return <Text>Error: {phase}</Text>;
        }}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('Error: initial')).toBeTruthy();

    await act(async () => {
      retry?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onFetch).toHaveBeenCalledTimes(2);
    expect(onFetch).toHaveBeenLastCalledWith(0, expect.any(Object), expect.any(AbortSignal));
    expect(screen.getByText('recovered')).toBeTruthy();
  });

  test('keeps loaded items when load-more fails and retries the same page', async () => {
    const onFetch = jest.fn()
      .mockResolvedValueOnce({ items: [{ id: 'first' }], hasMore: true })
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ items: [{ id: 'second' }], hasMore: false });
    let retry: (() => void) | undefined;
    (useAnimatedReaction as jest.Mock).mockClear();
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={onFetch}
        renderError={({ phase, retry: retryRequest }) => {
          retry = retryRequest;
          return <Text>Error: {phase}</Text>;
        }}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const endReachedReaction = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[1] as
      | ((result: boolean, previous: boolean) => void)
      | undefined;

    await act(async () => {
      endReachedReaction?.(true, false);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onFetch).toHaveBeenLastCalledWith(1, expect.any(Object), expect.any(AbortSignal));
    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getByText('Error: loadMore')).toBeTruthy();

    await act(async () => {
      retry?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onFetch).toHaveBeenCalledTimes(3);
    expect(onFetch).toHaveBeenLastCalledWith(1, expect.any(Object), expect.any(AbortSignal));
    expect(screen.getByText('second')).toBeTruthy();
  });

  test('exposes refresh failures and retries the first page', async () => {
    const onFetch = jest.fn()
      .mockResolvedValueOnce({ items: [{ id: 'before-refresh' }], hasMore: false })
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce({ items: [{ id: 'after-refresh' }], hasMore: false });
    let retry: (() => void) | undefined;
    __panGestures.splice(0);
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={onFetch}
        renderError={({ phase, retry: retryRequest }) => {
          retry = retryRequest;
          return <Text>Error: {phase}</Text>;
        }}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 100, translationX: 0, translationY: 100 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 300, translationX: 0, translationY: 300 });
      gesture?.end?.({
        absoluteX: 0,
        absoluteY: 300,
        translationX: 0,
        translationY: 300,
        velocityX: 0,
        velocityY: 0,
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onFetch).toHaveBeenLastCalledWith(0, expect.any(Object), expect.any(AbortSignal));
    expect(screen.getByText('Error: refresh')).toBeTruthy();

    await act(async () => {
      retry?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onFetch).toHaveBeenCalledTimes(3);
    expect(screen.getByText('after-refresh')).toBeTruthy();
  });

  test('publishes refresh data instead of an older load-more response', async () => {
    const loadMore = createDeferred<{ items: Item[]; hasMore: boolean }>();
    const refresh = createDeferred<{ items: Item[]; hasMore: boolean }>();
    const onFetch = jest.fn()
      .mockResolvedValueOnce({ items: [{ id: 'first' }], hasMore: true })
      .mockReturnValueOnce(loadMore.promise)
      .mockReturnValueOnce(refresh.promise);
    __panGestures.splice(0);
    (useAnimatedReaction as jest.Mock).mockClear();
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={onFetch}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const endReachedReaction = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[1] as
      | ((result: boolean, previous: boolean) => void)
      | undefined;
    await act(async () => {
      endReachedReaction?.(true, false);
      await Promise.resolve();
    });
    expect(onFetch).toHaveBeenCalledTimes(2);

    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 100, translationX: 0, translationY: 100 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 300, translationX: 0, translationY: 300 });
      gesture?.end?.({
        absoluteX: 0,
        absoluteY: 300,
        translationX: 0,
        translationY: 300,
        velocityX: 0,
        velocityY: 0,
      });
      await Promise.resolve();
    });
    expect(onFetch).toHaveBeenCalledTimes(3);

    await act(async () => {
      loadMore.resolve({ items: [{ id: 'stale-load-more' }], hasMore: false });
      refresh.resolve({ items: [{ id: 'refreshed' }], hasMore: false });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('refreshed')).toBeTruthy();
    expect(screen.queryByText('stale-load-more')).toBeNull();
  });

  test('appends a later page of sections with its own header', async () => {
    const onFetch = jest.fn()
      .mockResolvedValueOnce({
        sections: [{ items: [{ id: 'first-section-item' }] }],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        sections: [{ items: [{ id: 'second-section-item' }] }],
        hasMore: false,
      });
    (useAnimatedReaction as jest.Mock).mockClear();
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={onFetch}
        renderItem={(item) => <Text>{item.id}</Text>}
        renderSectionHeader={(section) => <Text>Header: {section.items[0]?.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const endReachedReaction = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[1] as
      | ((result: boolean, previous: boolean) => void)
      | undefined;
    await act(async () => {
      endReachedReaction?.(true, false);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onFetch).toHaveBeenLastCalledWith(1, expect.any(Object), expect.any(AbortSignal));
    expect(screen.getByText('Header: first-section-item')).toBeTruthy();
    expect(screen.getByText('Header: second-section-item')).toBeTruthy();
    expect(screen.getAllByText('second-section-item', { exact: true }).length).toBeGreaterThan(0);

    await screen.rerender(
      <MasonryList<Item>
        filters={[]}
        heightForItem={() => 80}
        onFetch={onFetch}
        renderItem={(item) => <Text>{item.id}</Text>}
        renderSectionHeader={(section) => <Text>Header: {section.items[0]?.id}</Text>}
        testID="masonry-root"
      />,
    );
    expect(screen.getByText('Header: second-section-item')).toBeTruthy();
  });

  test('keeps an empty section header and renders all columns in a section', async () => {
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        heightForSectionHeader={() => 24}
        onFetch={() => Promise.resolve({
          sections: [
            { items: [] },
            { column: 2, items: [{ id: 'left' }, { id: 'right' }] },
          ],
          hasMore: false,
        })}
        renderItem={(item) => <Text>{item.id}</Text>}
        renderSectionHeader={(_section, index) => <Text>Section {index}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Section 0')).toBeTruthy();
    expect(screen.getByText('Section 1')).toBeTruthy();
    expect(screen.getByText('left')).toBeTruthy();
    expect(screen.getByText('right')).toBeTruthy();
  });

  test('maps loadMoreDistance to the Elastic end-reached threshold', async () => {
    const y = makeMutable(400);
    (useAnimatedReaction as jest.Mock).mockClear();
    await render(
      <MasonryList<Item>
        contentOffset={{ y }}
        contentSize={{ width: makeMutable(320), height: makeMutable(1000) }}
        focus={makeMutable<boolean | 'vertical' | 'horizontal'>('vertical')}
        heightForItem={() => 80}
        loadMoreDistance={123}
        onFetch={() => new Promise(() => undefined)}
        renderItem={(item) => <Text>{item.id}</Text>}
        size={{ width: makeMutable(320), height: makeMutable(100) }}
        testID="masonry-root"
      />,
    );

    const shouldTriggerEndReached = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[0] as
      | (() => boolean)
      | undefined;
    expect(shouldTriggerEndReached?.()).toBe(false);
  });

  test('rebuilds every section when filters change', async () => {
    const filtered = { id: 'hide' };
    const onFetch = jest.fn(() => Promise.resolve({
      sections: [
        { items: [filtered, { id: 'keep-first' }] },
        { items: [{ id: 'keep-second' }] },
      ],
      hasMore: false,
    }));
    const renderList = (filters?: readonly Item[]) => (
      <MasonryList<Item>
        filters={filters}
        heightForItem={() => 80}
        onFetch={onFetch}
        renderItem={(item) => <Text>{item.id}</Text>}
        renderSectionHeader={(_section, index) => <Text>Section {index}</Text>}
        testID="masonry-root"
      />
    );
    const screen = await render(renderList());

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await screen.rerender(renderList([filtered]));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText('hide')).toBeNull();
    expect(screen.getByText('keep-first')).toBeTruthy();
    expect(screen.getByText('keep-second')).toBeTruthy();
    expect(screen.getByText('Section 1')).toBeTruthy();

    await act(async () => {
      await screen.rerender(renderList());
      await Promise.resolve();
    });
    expect(screen.getByText('hide')).toBeTruthy();
  });

  test('rebuilds the first section when prependItems changes', async () => {
    const prepended = { id: 'prepended' };
    const onFetch = jest.fn(() => Promise.resolve({
      sections: [
        { items: [{ id: 'first' }] },
        { items: [{ id: 'second' }] },
      ],
      hasMore: false,
    }));
    const renderList = (prependItems?: readonly Item[]) => (
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={onFetch}
        prependItems={prependItems}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />
    );
    const screen = await render(renderList());

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await screen.rerender(renderList([prepended]));
    expect(screen.getByText('prepended')).toBeTruthy();
    expect(screen.getByText('second')).toBeTruthy();

    await screen.rerender(renderList());
    expect(screen.queryByText('prepended')).toBeNull();
    expect(screen.getByText('first')).toBeTruthy();
  });

  test('restores filtered item responses without rendering an implicit section header', async () => {
    const hidden = { id: 'hidden' };
    const onFetch = jest.fn(() => Promise.resolve({
      items: [hidden, { id: 'visible' }],
      hasMore: false,
    }));
    const renderList = (filters?: readonly Item[]) => (
      <MasonryList<Item>
        filters={filters}
        heightForItem={() => 80}
        onFetch={onFetch}
        renderItem={(item) => <Text>{item.id}</Text>}
        renderSectionHeader={() => <Text>Unexpected section header</Text>}
        testID="masonry-root"
      />
    );
    const screen = await render(renderList());

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText('Unexpected section header')).toBeNull();

    await screen.rerender(renderList([hidden]));
    expect(screen.queryByText('hidden')).toBeNull();
    expect(screen.getByText('visible')).toBeTruthy();

    await screen.rerender(renderList());
    expect(screen.getByText('hidden')).toBeTruthy();
    expect(screen.queryByText('Unexpected section header')).toBeNull();
  });

  test('replaces section headers when refresh returns new sections', async () => {
    const onFetch = jest.fn()
      .mockResolvedValueOnce({
        sections: [{ items: [{ id: 'before-refresh' }] }],
        hasMore: false,
      })
      .mockResolvedValueOnce({
        sections: [{ items: [{ id: 'after-refresh' }] }],
        hasMore: false,
      });
    __panGestures.splice(0);
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={onFetch}
        renderItem={(item) => <Text>{item.id}</Text>}
        renderSectionHeader={(section) => <Text>Header: {section.items[0]?.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 100, translationX: 0, translationY: 100 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 300, translationX: 0, translationY: 300 });
      gesture?.end?.({
        absoluteX: 0,
        absoluteY: 300,
        translationX: 0,
        translationY: 300,
        velocityX: 0,
        velocityY: 0,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText('Header: before-refresh')).toBeNull();
    expect(screen.getByText('Header: after-refresh')).toBeTruthy();
    expect(screen.getByText('after-refresh')).toBeTruthy();
  });

  test('publishes an immutable data snapshot for each page', async () => {
    const onDataUpdate = jest.fn();
    const onFetch = jest.fn()
      .mockResolvedValueOnce({ items: [{ id: 'first' }], hasMore: true })
      .mockResolvedValueOnce({ items: [{ id: 'second' }], hasMore: false });
    (useAnimatedReaction as jest.Mock).mockClear();
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onDataUpdate={onDataUpdate}
        onFetch={onFetch}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const firstSnapshot = onDataUpdate.mock.calls[0]?.[0] as { items: Item[] }[];
    const endReachedReaction = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[1] as
      | ((result: boolean, previous: boolean) => void)
      | undefined;
    await act(async () => {
      endReachedReaction?.(true, false);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(firstSnapshot).toEqual([{ items: [{ id: 'first' }] }]);
    expect(onDataUpdate.mock.calls[1]?.[0]).toEqual([
      { items: [{ id: 'first' }, { id: 'second' }] },
    ]);
  });

  test('does not mutate frozen section responses', async () => {
    const items = Object.freeze([{ id: 'frozen-item' }]) as unknown as Item[];
    const sections = Object.freeze([{ items }]) as unknown as { items: Item[] }[];
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={() => Promise.resolve({ sections, hasMore: false })}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('frozen-item')).toBeTruthy();
    expect(sections).toEqual([{ items: [{ id: 'frozen-item' }] }]);
  });

  test('updates content height when a rendered footer changes height', async () => {
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={() => Promise.resolve({ items: [{ id: 'item' }], hasMore: false })}
        renderFooter={() => <Text>Footer</Text>}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const footer = findAll(
      screen.root!,
      (node) => node.type === 'View' && node.props.onLayout && Array.isArray(node.props.style) && node.props.style.some((style: unknown) => typeof style === 'object' && style !== null && 'bottom' in style),
    )[0];
    const getHeight = () => findAll(
      screen.root!,
      (node) => node.type === 'AnimatedView' && Array.isArray(node.props.style) && node.props.style.some((style: unknown) => typeof style === 'object' && style !== null && 'height' in style),
    )[0]?.props.style.find((style: { height?: number }) => style.height !== undefined)?.height;

    await act(async () => {
      footer.props.onLayout({ nativeEvent: { layout: { width: 320, height: 20 } } });
    });
    const firstHeight = getHeight();
    await act(async () => {
      footer.props.onLayout({ nativeEvent: { layout: { width: 320, height: 40 } } });
    });
    expect(getHeight()).toBe((firstHeight ?? 0) + 20);
  });

  test('keeps the fixed footer height after the last pagination page', async () => {
    const onFetch = jest.fn()
      .mockResolvedValueOnce({ items: [{ id: 'first' }], hasMore: true })
      .mockResolvedValueOnce({ items: [{ id: 'last' }], hasMore: false });
    (useAnimatedReaction as jest.Mock).mockClear();
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={onFetch}
        renderFooter={() => <Text>Fixed footer</Text>}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const footer = findAll(
      screen.root!,
      (node) => node.type === 'View' && node.props.onLayout && Array.isArray(node.props.style) && node.props.style.some((style: unknown) => typeof style === 'object' && style !== null && 'bottom' in style),
    )[0];
    const getHeight = () => findAll(
      screen.root!,
      (node) => node.type === 'AnimatedView' && Array.isArray(node.props.style) && node.props.style.some((style: unknown) => typeof style === 'object' && style !== null && 'height' in style),
    )[0]?.props.style.find((style: { height?: number }) => style.height !== undefined)?.height;
    await act(async () => {
      footer.props.onLayout({ nativeEvent: { layout: { width: 320, height: 20 } } });
    });

    const endReachedReaction = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[1] as
      | ((result: boolean, previous: boolean) => void)
      | undefined;
    await act(async () => {
      endReachedReaction?.(true, false);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('last')).toBeTruthy();
    expect(screen.getByText('Fixed footer')).toBeTruthy();
    expect(getHeight()).toBe(196);
  });

  test('renders empty content and a fixed footer after an empty last page', async () => {
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        onFetch={() => Promise.resolve({ items: [], hasMore: false })}
        renderEmpty={() => <Text>Empty state</Text>}
        renderFooter={() => <Text>Fixed footer</Text>}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Empty state')).toBeTruthy();
    expect(screen.getByText('Fixed footer')).toBeTruthy();
  });

  test('falls back to the first fetch when initData is empty', async () => {
    const onFetch = jest.fn(() => Promise.resolve({ items: [{ id: 'fetched' }], hasMore: false }));
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        initData={[]}
        onFetch={onFetch}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onFetch).toHaveBeenCalledWith(0, expect.any(Object), expect.any(AbortSignal));
    expect(screen.getByText('fetched')).toBeTruthy();
  });

  test('falls back to the first fetch when initData has no items array', async () => {
    const onFetch = jest.fn(() => Promise.resolve({ items: [{ id: 'recovered' }], hasMore: false }));
    const invalidInitData = [{}] as unknown as readonly { items: Item[] }[];
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => 80}
        initData={invalidInitData}
        onFetch={onFetch}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('recovered')).toBeTruthy();
  });

  test('uses a finite non-negative layout height when an item height is invalid', async () => {
    const screen = await render(
      <MasonryList<Item>
        heightForItem={() => Number.NaN}
        onFetch={() => Promise.resolve({ items: [{ id: 'invalid-height' }], hasMore: false })}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const contentHeight = findAll(
      screen.root!,
      (node) => node.type === 'AnimatedView' && Array.isArray(node.props.style) && node.props.style.some((style: unknown) => typeof style === 'object' && style !== null && 'height' in style),
    )[0]?.props.style.find((style: { height?: number }) => style.height !== undefined)?.height;

    expect(screen.getByText('invalid-height')).toBeTruthy();
    expect(Number.isFinite(contentHeight)).toBe(true);
    expect(contentHeight).toBeGreaterThanOrEqual(0);
  });

  test('does not forward Masonry-only props to the native scroll root', async () => {
    const screen = await render(
      <MasonryList<Item>
        bufferHeight={777}
        heightForItem={() => 80}
        onFetch={() => Promise.resolve({ items: [], hasMore: false })}
        renderItem={(item) => <Text>{item.id}</Text>}
        testID="masonry-root"
      />,
    );

    const root = screen.getByTestId('masonry-root');
    expect(root.props.bufferHeight).toBeUndefined();
    expect(root.props.heightForItem).toBeUndefined();
    expect(root.props.onFetch).toBeUndefined();
  });

  test('supports frozen filters and prepends under Strict Mode without mutating inputs', async () => {
    const hidden = Object.freeze({ id: 'hidden' });
    const prepended = Object.freeze({ id: 'prepended' });
    const responseItems = Object.freeze([hidden, { id: 'visible' }]) as unknown as Item[];
    const filters = Object.freeze([hidden]) as unknown as Item[];
    const prependItems = Object.freeze([prepended]) as unknown as Item[];
    const screen = await render(
      <React.StrictMode>
        <MasonryList<Item>
          filters={filters}
          heightForItem={() => 80}
          onFetch={() => Promise.resolve({ items: responseItems, hasMore: false })}
          prependItems={prependItems}
          renderItem={(item) => <Text>{item.id}</Text>}
          testID="masonry-root"
        />
      </React.StrictMode>,
    );

    await layoutMasonry(screen);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('prepended')).toBeTruthy();
    expect(screen.getByText('visible')).toBeTruthy();
    expect(screen.queryByText('hidden')).toBeNull();
    expect(filters).toEqual([{ id: 'hidden' }]);
    expect(prependItems).toEqual([{ id: 'prepended' }]);
    expect(responseItems).toEqual([{ id: 'hidden' }, { id: 'visible' }]);
  });
});
