import * as demo from '../example/src/screens/StickyTabViewDemoScreen';

describe('StickyTabView demo header navigation', () => {
  test('maps the active header offset to a clamped navigation opacity', () => {
    const getHeaderNavOpacity = (
      demo as unknown as {
        getHeaderNavOpacity?: (offset: number, headerDistance: number) => number;
      }
    ).getHeaderNavOpacity;

    if (typeof getHeaderNavOpacity !== 'function') {
      expect(typeof getHeaderNavOpacity).toBe('function');
      return;
    }

    expect(getHeaderNavOpacity(0, 200)).toBe(0);
    expect(getHeaderNavOpacity(170, 200)).toBe(0.5);
    expect(getHeaderNavOpacity(200, 200)).toBe(1);
    expect(getHeaderNavOpacity(240, 200)).toBe(1);
    expect(getHeaderNavOpacity(0, 40)).toBe(0);
    expect(getHeaderNavOpacity(20, 40)).toBe(0.5);
    expect(getHeaderNavOpacity(40, 40)).toBe(1);
  });
});
