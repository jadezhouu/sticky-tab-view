import React from 'react';
import { render } from '@testing-library/react-native';
import { MasonryBenchmarkControls } from '../example/src/screens/MasonryBenchmarkScreen';

describe('Masonry benchmark controls', () => {
  test('shows the selected fixture dimensions and all supported choices', async () => {
    const screen = await render(
      <MasonryBenchmarkControls
        config={{ itemCount: 100, columnCount: 2, reuseTypeCount: 3 }}
        onChange={() => undefined}
      />,
    );

    expect(screen.getByText('Masonry performance benchmark')).toBeTruthy();
    expect(screen.getByText('100 items')).toBeTruthy();
    expect(screen.getByText('500 items')).toBeTruthy();
    expect(screen.getByText('1000 items')).toBeTruthy();
    expect(screen.getByText('1 column')).toBeTruthy();
    expect(screen.getByText('2 columns')).toBeTruthy();
    expect(screen.getByText('3 columns')).toBeTruthy();
    expect(screen.getByText('1 reuse type')).toBeTruthy();
    expect(screen.getByText('3 reuse types')).toBeTruthy();
  });
});
