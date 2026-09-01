import React, { createRef } from 'react';
import { Keyboard, Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { findAll } from '@testing-library/react-native/dist/helpers/find-all';
import { makeMutable, useAnimatedReaction } from 'react-native-reanimated';

import {
  ElasticScrollView,
  type ElasticScrollViewHandle,
} from '../../src/scroll/ElasticScrollView.js';
import { StickyTabContext } from '../../src/core/contexts.js';
import { __panGestures, __tapGestures } from '../mocks/react-native-gesture-handler';

describe('ElasticScrollView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __panGestures.splice(0);
    __tapGestures.splice(0);
  });

  test('renders its children and forwards the root testID', async () => {
    const screen = await render(
      <ElasticScrollView testID="elastic-root">
        <Text>Visible content</Text>
      </ElasticScrollView>,
    );

    expect(screen.getByTestId('elastic-root')).toBeTruthy();
    expect(screen.getByText('Visible content')).toBeTruthy();
  });

  test('writes imperative scroll offsets to the Sticky Context shared value', async () => {
    const ref = createRef<ElasticScrollViewHandle>();
    const y = makeMutable(0);

    await render(
      <StickyTabContext.Provider
        value={{
          contentOffset: { y },
          handlersMutable: makeMutable({}),
          onTabChange: () => () => {},
        }}
      >
        <ElasticScrollView ref={ref} />
      </StickyTabContext.Provider>,
    );

    await act(async () => {
      await ref.current?.scrollTo({ x: 0, y: 72 }, false);
    });

    expect(y.value).toBe(72);
  });

  test('uses replacement external offset shared values after rerender', async () => {
    const firstY = makeMutable(0);
    const secondY = makeMutable(0);
    const renderScroll = (y: ReturnType<typeof makeMutable<number>>) => (
      <ElasticScrollView
        contentOffset={{ y }}
        contentSize={{ width: makeMutable(100), height: makeMutable(300) }}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
        testID="replacement-offset-scroll"
      />
    );
    const screen = await render(renderScroll(firstY));

    await screen.rerender(renderScroll(secondY));
    await act(async () => {
      screen.getByTestId('replacement-offset-scroll').props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      });
    });

    expect(firstY.value).toBe(0);
    expect(secondY.value).toBe(100);
  });

  test('uses the latest dragToHideKeyboard prop on the next gesture', async () => {
    const screen = await render(<ElasticScrollView dragToHideKeyboard={false} />);

    await screen.rerender(<ElasticScrollView dragToHideKeyboard />);
    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: -10, translationX: 0, translationY: -10 });
    });

    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  });

  test('uses the latest onScrollBeginDrag callback on the next gesture', async () => {
    const initialCallback = jest.fn();
    const updatedCallback = jest.fn();
    const screen = await render(<ElasticScrollView onScrollBeginDrag={initialCallback} />);

    await screen.rerender(<ElasticScrollView onScrollBeginDrag={updatedCallback} />);
    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({
        absoluteX: 0,
        absoluteY: 0,
        translationX: 0,
        translationY: 0,
      });
    });

    expect(initialCallback).not.toHaveBeenCalled();
    expect(updatedCallback).toHaveBeenCalledTimes(1);
  });

  test('uses the latest onScrollEndDrag callback on the next gesture', async () => {
    const initialCallback = jest.fn();
    const updatedCallback = jest.fn();
    const screen = await render(<ElasticScrollView onScrollEndDrag={initialCallback} />);

    await screen.rerender(<ElasticScrollView onScrollEndDrag={updatedCallback} />);
    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: -10, translationX: 0, translationY: -10 });
      gesture?.end?.({
        absoluteX: 0,
        absoluteY: -10,
        translationX: 0,
        translationY: -10,
        velocityX: 0,
        velocityY: 0,
      });
    });

    expect(initialCallback).not.toHaveBeenCalled();
    expect(updatedCallback).toHaveBeenCalledTimes(1);
  });

  test('dismisses the keyboard when tapToHideKeyboard receives a tap', async () => {
    await render(<ElasticScrollView tapToHideKeyboard />);

    const gesture = __tapGestures[__tapGestures.length - 1];
    await act(async () => {
      gesture?.end?.({});
    });

    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  });

  test('clamps the final horizontal paging offset to a partial last page', async () => {
    const x = makeMutable(445);
    await render(
      <ElasticScrollView
        bounces={false}
        contentOffset={{ x }}
        contentSize={{ width: makeMutable(750), height: makeMutable(100) }}
        currentPage={makeMutable(1)}
        pagingEnabled="horizontal"
        scrollEnabled="horizontal"
        size={{ width: makeMutable(300), height: makeMutable(100) }}
      />,
    );

    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: -5, absoluteY: 0, translationX: -5, translationY: 0 });
      gesture?.end?.({
        absoluteX: -5,
        absoluteY: 0,
        translationX: -5,
        translationY: 0,
        velocityX: 0,
        velocityY: 0,
      });
    });

    expect(x.value).toBe(450);
  });

  test('clamps the final vertical paging offset to a partial last page', async () => {
    const y = makeMutable(445);
    await render(
      <ElasticScrollView
        bounces={false}
        contentOffset={{ y }}
        contentSize={{ width: makeMutable(100), height: makeMutable(750) }}
        currentPage={makeMutable(1)}
        pagingEnabled="vertical"
        scrollEnabled="vertical"
        size={{ width: makeMutable(100), height: makeMutable(300) }}
      />,
    );

    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: -5, translationX: 0, translationY: -5 });
      gesture?.end?.({
        absoluteX: 0,
        absoluteY: -5,
        translationX: 0,
        translationY: -5,
        velocityX: 0,
        velocityY: 0,
      });
    });

    expect(y.value).toBe(450);
  });

  test('snaps vertical paging back to the current page after a cancelled gesture', async () => {
    const y = makeMutable(150);
    await render(
      <ElasticScrollView
        contentOffset={{ y }}
        contentSize={{ width: makeMutable(100), height: makeMutable(900) }}
        currentPage={makeMutable(1)}
        pagingEnabled="vertical"
        scrollEnabled="vertical"
        size={{ width: makeMutable(100), height: makeMutable(300) }}
      />,
    );

    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: -10, translationX: 0, translationY: -10 });
      gesture?.finalize?.({}, false);
    });

    expect(y.value).toBe(300);
  });

  test('runs failed-gesture completion callbacks before snapping vertical paging', async () => {
    const onScrollEndDrag = jest.fn();
    const y = makeMutable(150);
    await render(
      <ElasticScrollView
        contentOffset={{ y }}
        contentSize={{ width: makeMutable(100), height: makeMutable(900) }}
        currentPage={makeMutable(1)}
        onScrollEndDrag={onScrollEndDrag}
        pagingEnabled="vertical"
        scrollEnabled="vertical"
        size={{ width: makeMutable(100), height: makeMutable(300) }}
      />,
    );

    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: -10, translationX: 0, translationY: -10 });
      gesture?.finalize?.({ state: 1 }, false);
    });

    expect(onScrollEndDrag).toHaveBeenCalledTimes(1);
    expect(y.value).toBe(300);
  });

  test('contains synchronous onEndReached failures instead of throwing through the reaction', async () => {
    const onEndReached = jest.fn(() => {
      throw new Error('fetch setup failed');
    });
    await render(<ElasticScrollView onEndReached={onEndReached} />);

    const endReachedReaction = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[1] as
      ((result: boolean, previous: boolean) => void) | undefined;

    expect(() => endReachedReaction?.(true, false)).not.toThrow();
    expect(onEndReached).toHaveBeenCalledTimes(1);
  });

  test('rearms the end-reached gate when no pagination callback is provided', async () => {
    await render(
      <ElasticScrollView
        contentOffset={{ y: makeMutable(100) }}
        contentSize={{ width: makeMutable(100), height: makeMutable(200) }}
        endReachedThreshold={0}
        focus={makeMutable<boolean | 'vertical' | 'horizontal'>('vertical')}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
      />,
    );
    const selector = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[0] as () => boolean;
    const reaction = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[1] as (
      result: boolean,
      previous: boolean,
    ) => void;

    expect(selector()).toBe(true);
    reaction(true, false);
    expect(selector()).toBe(true);
  });

  test('re-arms end reached after a rejected pagination request', async () => {
    let rejectRequest: ((reason?: unknown) => void) | undefined;
    const onEndReached = jest.fn(
      () =>
        new Promise<boolean>((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    await render(
      <ElasticScrollView
        contentOffset={{ y: makeMutable(100) }}
        contentSize={{ width: makeMutable(100), height: makeMutable(200) }}
        endReachedThreshold={0}
        focus={makeMutable<boolean | 'vertical' | 'horizontal'>('vertical')}
        onEndReached={onEndReached}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
      />,
    );
    const selector = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[0] as () => boolean;
    const reaction = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[1] as (
      result: boolean,
      previous: boolean,
    ) => void;

    reaction(true, false);
    expect(onEndReached).toHaveBeenCalledTimes(1);
    expect(selector()).toBe(false);

    await act(async () => {
      rejectRequest?.(new Error('network failed'));
      await Promise.resolve();
    });
    expect(selector()).toBe(true);
  });

  test('keeps end reached disabled after pagination reports no more data', async () => {
    const onEndReached = jest.fn(() => Promise.resolve(false));
    await render(
      <ElasticScrollView
        contentOffset={{ y: makeMutable(100) }}
        contentSize={{ width: makeMutable(100), height: makeMutable(200) }}
        endReachedThreshold={0}
        focus={makeMutable<boolean | 'vertical' | 'horizontal'>('vertical')}
        onEndReached={onEndReached}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
      />,
    );
    const selector = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[0] as () => boolean;
    const reaction = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[1] as (
      result: boolean,
      previous: boolean,
    ) => void;

    reaction(true, false);
    await act(async () => {
      await Promise.resolve();
    });

    expect(onEndReached).toHaveBeenCalledTimes(1);
    expect(selector()).toBe(false);
  });

  test('contains synchronous onRefresh failures instead of throwing through the gesture', async () => {
    const onRefresh = jest.fn(() => {
      throw new Error('refresh setup failed');
    });
    await render(<ElasticScrollView onRefresh={onRefresh} />);

    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 100, translationX: 0, translationY: 100 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 110, translationX: 0, translationY: 110 });
    });

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      gesture?.end?.({
        absoluteX: 0,
        absoluteY: 110,
        translationX: 0,
        translationY: 110,
        velocityX: 0,
        velocityY: 0,
      });
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test('contains rejected onRefresh promises without logging a gesture error', async () => {
    const onRefresh = jest.fn(() => Promise.reject(new Error('network failed')));
    await render(<ElasticScrollView onRefresh={onRefresh} />);

    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 100, translationX: 0, translationY: 100 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 110, translationX: 0, translationY: 110 });
    });

    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => {
      gesture?.end?.({
        absoluteX: 0,
        absoluteY: 110,
        translationX: 0,
        translationY: 110,
        velocityX: 0,
        velocityY: 0,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test('re-arms pagination when an uncontrolled refresh is ended', async () => {
    let paginationGate: { value: boolean } | undefined;
    const onRefresh = jest.fn(({ canLoadMore, endRefresh }) => {
      paginationGate = canLoadMore;
      canLoadMore.value = false;
      endRefresh();
    });
    await render(<ElasticScrollView onRefresh={onRefresh} />);

    const gesture = __panGestures[__panGestures.length - 1];
    await act(async () => {
      gesture?.start?.({ absoluteX: 0, absoluteY: 0, translationX: 0, translationY: 0 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 100, translationX: 0, translationY: 100 });
      gesture?.update?.({ absoluteX: 0, absoluteY: 110, translationX: 0, translationY: 110 });
      gesture?.end?.({
        absoluteX: 0,
        absoluteY: 110,
        translationX: 0,
        translationY: 110,
        velocityX: 0,
        velocityY: 0,
      });
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(paginationGate?.value).toBe(true);
  });

  test('settles a controlled refresh when refreshing changes to false', async () => {
    const onRefresh = jest.fn();
    const screen = await render(<ElasticScrollView onRefresh={onRefresh} refreshing />);

    const getIndicator = () =>
      findAll(screen.root!, (node) => node.type === 'ActivityIndicator')[0];
    expect(getIndicator().props.animating).toBe(true);

    await screen.rerender(<ElasticScrollView onRefresh={onRefresh} refreshing={false} />);

    expect(getIndicator().props.animating).toBe(false);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test('renders the controlled loading footer state', async () => {
    const screen = await render(<ElasticScrollView loadingMore onEndReached={async () => false} />);

    expect(screen.getByText('loading')).toBeTruthy();

    await screen.rerender(<ElasticScrollView onEndReached={async () => false} />);
    expect(screen.getByText('idle')).toBeTruthy();

    await screen.rerender(<ElasticScrollView loadFinished onEndReached={async () => false} />);
    expect(screen.getByText('finished')).toBeTruthy();
  });

  test('does not request another page while loadingMore is controlled', async () => {
    const onEndReached = jest.fn(() => new Promise<boolean>(() => undefined));
    await render(
      <ElasticScrollView
        contentOffset={{ y: makeMutable(100) }}
        contentSize={{ width: makeMutable(100), height: makeMutable(200) }}
        endReachedThreshold={0}
        focus={makeMutable<boolean | 'vertical' | 'horizontal'>('vertical')}
        loadingMore
        onEndReached={onEndReached}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
      />,
    );

    const endReachedSelector = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[0] as
      (() => boolean) | undefined;

    expect(endReachedSelector?.()).toBe(false);
    expect(onEndReached).not.toHaveBeenCalled();
  });

  test('re-enables end reached after controlled loadingMore clears', async () => {
    (useAnimatedReaction as jest.Mock).mockClear();
    const props = {
      contentOffset: { y: makeMutable(100) },
      contentSize: { width: makeMutable(100), height: makeMutable(200) },
      endReachedThreshold: 0,
      focus: makeMutable<boolean | 'vertical' | 'horizontal'>('vertical'),
      onEndReached: async () => false,
      size: { width: makeMutable(100), height: makeMutable(100) },
    };
    const screen = await render(<ElasticScrollView {...props} loadingMore />);
    let selector = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[0] as () => boolean;
    expect(selector()).toBe(false);

    await screen.rerender(<ElasticScrollView {...props} loadingMore={false} />);
    const selectors = (useAnimatedReaction as jest.Mock).mock.calls
      .map((call) => call[0] as () => unknown)
      .filter((candidate) => typeof candidate() === 'boolean');
    selector = selectors[selectors.length - 1] as () => boolean;
    expect(selector()).toBe(true);
  });

  test('does not request another page after loadFinished is controlled', async () => {
    const onEndReached = jest.fn(() => Promise.resolve(false));
    await render(
      <ElasticScrollView
        contentOffset={{ y: makeMutable(100) }}
        contentSize={{ width: makeMutable(100), height: makeMutable(200) }}
        endReachedThreshold={0}
        focus={makeMutable<boolean | 'vertical' | 'horizontal'>('vertical')}
        loadFinished
        onEndReached={onEndReached}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
      />,
    );

    const endReachedSelector = (useAnimatedReaction as jest.Mock).mock.calls[0]?.[0] as
      (() => boolean) | undefined;

    expect(endReachedSelector?.()).toBe(false);
    expect(onEndReached).not.toHaveBeenCalled();
  });

  test('provides accessibility scroll actions that move within vertical bounds', async () => {
    const y = makeMutable(0);
    const screen = await render(
      <ElasticScrollView
        contentOffset={{ y }}
        contentSize={{ width: makeMutable(100), height: makeMutable(300) }}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
        testID="accessible-scroll"
      />,
    );
    const root = screen.getByTestId('accessible-scroll');

    await act(async () => {
      root.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    });
    expect(y.value).toBe(100);

    await act(async () => {
      root.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
    });
    expect(y.value).toBe(0);
    expect(root.props.accessibilityActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'increment' }),
        expect.objectContaining({ name: 'decrement' }),
      ]),
    );
  });

  test('provides accessibility actions for horizontal paging without changing vertical offset', async () => {
    const x = makeMutable(0);
    const y = makeMutable(0);
    const screen = await render(
      <ElasticScrollView
        contentOffset={{ x, y }}
        contentSize={{ width: makeMutable(900), height: makeMutable(100) }}
        pagingEnabled="horizontal"
        scrollEnabled="horizontal"
        size={{ width: makeMutable(300), height: makeMutable(100) }}
        testID="horizontal-accessible-scroll"
      />,
    );
    const root = screen.getByTestId('horizontal-accessible-scroll');

    await act(async () => {
      root.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    });
    expect(x.value).toBe(300);
    expect(y.value).toBe(0);

    await act(async () => {
      root.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
    });
    expect(x.value).toBe(0);
  });

  test('keeps the trailing bottom inset reachable through accessibility scrolling', async () => {
    const y = makeMutable(0);
    const screen = await render(
      <ElasticScrollView
        contentInsets={{ top: 12, left: 0, right: 0, bottom: 24 }}
        contentOffset={{ y }}
        contentSize={{ width: makeMutable(100), height: makeMutable(300) }}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
        testID="bottom-inset-scroll"
      />,
    );

    await act(async () => {
      screen.getByTestId('bottom-inset-scroll').props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      });
      screen.getByTestId('bottom-inset-scroll').props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      });
      screen.getByTestId('bottom-inset-scroll').props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      });
    });

    expect(y.value).toBe(224);
  });

  test('preserves caller-provided accessibility actions and delegates custom actions', async () => {
    const onAccessibilityAction = jest.fn();
    const y = makeMutable(0);
    const screen = await render(
      <ElasticScrollView
        accessibilityActions={[{ name: 'activate', label: 'Reload content' }]}
        contentOffset={{ y }}
        onAccessibilityAction={onAccessibilityAction}
        testID="custom-accessibility-scroll"
      />,
    );
    const root = screen.getByTestId('custom-accessibility-scroll');

    await act(async () => {
      root.props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } });
    });

    expect(root.props.accessibilityActions).toEqual([
      { name: 'activate', label: 'Reload content' },
    ]);
    expect(onAccessibilityAction).toHaveBeenCalledTimes(1);
    expect(y.value).toBe(0);
  });

  test('clamps an existing vertical offset when the viewport grows', async () => {
    const y = makeMutable(250);
    const screen = await render(
      <ElasticScrollView
        contentOffset={{ y }}
        contentSize={{ width: makeMutable(100), height: makeMutable(300) }}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
        testID="resized-scroll"
      />,
    );

    await act(async () => {
      screen.getByTestId('resized-scroll').props.onLayout({
        nativeEvent: { layout: { width: 100, height: 220 } },
      });
    });

    expect(y.value).toBe(80);
  });
});
