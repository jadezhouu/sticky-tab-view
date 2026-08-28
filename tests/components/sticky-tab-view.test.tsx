import React, { createRef } from 'react';
import { Text } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { findAll } from '@testing-library/react-native/dist/helpers/find-all';
import { cancelAnimation, type SharedValue } from 'react-native-reanimated';

import {
  StickyTabView,
  type StickyTabViewHandle,
} from '../../src/StickyTabView.js';

describe('StickyTabView', () => {
  test('forwards root ViewProps to the container', async () => {
    const screen = await render(
      <StickyTabView
        accessibilityLabel="Sticky tabs"
        tabCount={1}
        testID="sticky-root"
        renderHeader={() => <Text>Header</Text>}
        renderTab={() => <Text>Tab</Text>}
      />,
    );

    expect(screen.getByTestId('sticky-root').props.accessibilityLabel).toBe('Sticky tabs');
  });

  test('clamps the active page when tabCount shrinks', async () => {
    let currentPage: SharedValue<number> | undefined;
    const screen = await render(
      <StickyTabView
        current={2}
        tabCount={3}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
        renderTabBar={(_x, _ys, current) => {
          currentPage = current;
          return null;
        }}
      />,
    );

    expect(currentPage?.value).toBe(2);
    await screen.rerender(
      <StickyTabView
        current={2}
        tabCount={1}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
        renderTabBar={(_x, _ys, current) => {
          currentPage = current;
          return null;
        }}
      />,
    );

    expect(currentPage?.value).toBe(0);
  });

  test('cancels removed tab values and handlers when tabCount shrinks', async () => {
    jest.clearAllMocks();
    const renderTabs = (tabCount: number) => (
      <StickyTabView
        tabCount={tabCount}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
      />
    );
    const screen = await render(renderTabs(3));
    (cancelAnimation as jest.Mock).mockClear();

    await screen.rerender(renderTabs(1));

    expect(cancelAnimation).toHaveBeenCalledTimes(4);
  });

  test('creates selectable pages when tabCount grows', async () => {
    const ref = createRef<StickyTabViewHandle>();
    let currentPage: SharedValue<number> | undefined;
    const renderTabBar = (_x: SharedValue<number>, _ys: SharedValue<number>[], current: SharedValue<number>) => {
      currentPage = current;
      return null;
    };
    const screen = await render(
      <StickyTabView
        ref={ref}
        tabCount={1}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
        renderTabBar={renderTabBar}
      />,
    );

    await screen.rerender(
      <StickyTabView
        ref={ref}
        tabCount={3}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
        renderTabBar={renderTabBar}
      />,
    );
    await act(async () => {
      ref.current?.setTab(2);
    });

    expect(currentPage?.value).toBe(2);
    expect(screen.getByText('Tab 2')).toBeTruthy();
  });

  test('only mounts the initial tab when lazy loading is enabled', async () => {
    const screen = await render(
      <StickyTabView
        current={1}
        lazy
        tabCount={3}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
      />,
    );

    expect(screen.getByText('Tab 1')).toBeTruthy();
    expect(screen.queryByText('Tab 0')).toBeNull();
    expect(screen.queryByText('Tab 2')).toBeNull();
  });

  test('clamps an oversized initial page to the last tab', async () => {
    let currentPage: SharedValue<number> | undefined;
    const screen = await render(
      <StickyTabView
        current={99}
        tabCount={3}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
        renderTabBar={(_x, _ys, current) => {
          currentPage = current;
          return null;
        }}
      />,
    );

    expect(currentPage?.value).toBe(2);
    expect(screen.getByText('Tab 2')).toBeTruthy();
  });

  test('falls back to the first tab for a non-numeric initial page', async () => {
    let currentPage: SharedValue<number> | undefined;
    await render(
      <StickyTabView
        current={Number.NaN}
        tabCount={3}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
        renderTabBar={(_x, _ys, current) => {
          currentPage = current;
          return null;
        }}
      />,
    );

    expect(currentPage?.value).toBe(0);
  });

  test('preloads neighboring tabs within lazyPreloadDistance', async () => {
    const screen = await render(
      <StickyTabView
        current={1}
        lazy
        lazyPreloadDistance={1}
        tabCount={4}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
      />,
    );

    expect(screen.getByText('Tab 0')).toBeTruthy();
    expect(screen.getByText('Tab 1')).toBeTruthy();
    expect(screen.getByText('Tab 2')).toBeTruthy();
    expect(screen.queryByText('Tab 3')).toBeNull();
  });

  test('aligns the requested tab after its first layout', async () => {
    const ref = createRef<StickyTabViewHandle>();
    let horizontalOffset: SharedValue<number> | undefined;
    let currentPage: SharedValue<number> | undefined;
    const screen = await render(
      <StickyTabView
        ref={ref}
        tabCount={3}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
        renderTabBar={(x, _ys, current) => {
          horizontalOffset = x;
          currentPage = current;
          return null;
        }}
      />,
    );

    await act(async () => {
      ref.current?.setTab(1);
    });
    expect(currentPage?.value).toBe(1);
    expect(horizontalOffset?.value).toBe(0);

    const tabPager = screen.root && findAll(screen.root, (node) => node.type === 'AnimatedView')
      .find((node) => node.props.onLayout && node.props.style?.[0]?.overflow === 'hidden');
    await act(async () => {
      tabPager?.props.onLayout({
        nativeEvent: { layout: { width: 320, height: 640 } },
      });
    });

    expect(horizontalOffset?.value).toBe(320);
  });

  test('realigns the active tab when the pager width changes', async () => {
    const ref = createRef<StickyTabViewHandle>();
    let horizontalOffset: SharedValue<number> | undefined;
    const screen = await render(
      <StickyTabView
        ref={ref}
        tabCount={3}
        renderHeader={() => <Text>Header</Text>}
        renderTab={(index) => <Text>Tab {index}</Text>}
        renderTabBar={(x) => {
          horizontalOffset = x;
          return null;
        }}
      />,
    );
    const tabPager = screen.root && findAll(screen.root, (node) => node.type === 'AnimatedView')
      .find((node) => node.props.onLayout && node.props.style?.[0]?.overflow === 'hidden');

    await act(async () => {
      tabPager?.props.onLayout({
        nativeEvent: { layout: { width: 320, height: 640 } },
      });
    });
    await act(async () => {
      ref.current?.setTab(1);
    });
    expect(horizontalOffset?.value).toBe(320);

    await act(async () => {
      tabPager?.props.onLayout({
        nativeEvent: { layout: { width: 500, height: 640 } },
      });
    });

    expect(horizontalOffset?.value).toBe(500);
  });
});
