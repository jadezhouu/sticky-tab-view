type BenchmarkModule = {
  createMasonryBenchmarkItems?: (options: {
    count: number;
    reuseTypeCount: number;
    seed: number;
  }) => Array<{ id: string; height: number; reuseType: string }>;
};

function loadBenchmarkModule(): BenchmarkModule {
  try {
    return jest.requireActual('../example/src/demo-data/masonry-benchmark') as BenchmarkModule;
  } catch {
    return {};
  }
}

describe('Masonry benchmark data', () => {
  test('creates a deterministic, finite item set for a configured seed', () => {
    const { createMasonryBenchmarkItems } = loadBenchmarkModule();

    expect(createMasonryBenchmarkItems).toEqual(expect.any(Function));
    const first = createMasonryBenchmarkItems!({
      count: 100,
      reuseTypeCount: 3,
      seed: 20260827,
    });
    const second = createMasonryBenchmarkItems!({
      count: 100,
      reuseTypeCount: 3,
      seed: 20260827,
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(100);
    expect(first.every((item) => Number.isFinite(item.height) && item.height > 0)).toBe(true);
    expect(new Set(first.map((item) => item.reuseType))).toEqual(new Set(['type-0', 'type-1', 'type-2']));
  });

  test('normalizes unsupported benchmark dimensions to safe minimums', () => {
    const { createMasonryBenchmarkItems } = loadBenchmarkModule();

    expect(createMasonryBenchmarkItems).toEqual(expect.any(Function));
    const items = createMasonryBenchmarkItems!({
      count: -1,
      reuseTypeCount: 0,
      seed: Number.NaN,
    });

    expect(items).toEqual([]);
  });
});
