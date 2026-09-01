import React from 'react';
import { render } from '@testing-library/react-native';
import { makeMutable } from 'react-native-reanimated';

import { Indicator } from '../../src/scroll/Indicators.js';

describe('Indicator', () => {
  test('uses a non-negative viewport-relative vertical thumb height', async () => {
    const screen = await render(
      <Indicator
        contentOffset={{ y: makeMutable(50) }}
        contentSize={{ width: makeMutable(0), height: makeMutable(200) }}
        focus={makeMutable<boolean | 'vertical' | 'horizontal'>(false)}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
      />,
    );

    const indicator = screen.root!;
    expect(indicator.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ top: 3, right: 3, width: 3 }),
        expect.objectContaining({ height: 44 }),
        expect.objectContaining({ transform: [{ translateY: 25 }] }),
      ]),
    );
  });

  test('hides the thumb until its scrollable content dimension is known', async () => {
    const screen = await render(
      <Indicator
        horizontal
        contentOffset={{ x: makeMutable(10) }}
        contentSize={{ width: makeMutable(0), height: makeMutable(0) }}
        focus={makeMutable<boolean | 'vertical' | 'horizontal'>(false)}
        size={{ width: makeMutable(100), height: makeMutable(100) }}
      />,
    );

    const indicator = screen.root!;
    expect(indicator.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ left: 3, bottom: 4, height: 3 }),
        expect.objectContaining({ opacity: 0 }),
      ]),
    );
  });
});
