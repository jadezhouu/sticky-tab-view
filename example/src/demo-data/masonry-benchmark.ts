export type MasonryBenchmarkItem = {
  id: string;
  height: number;
  reuseType: string;
};

type MasonryBenchmarkOptions = {
  count: number;
  reuseTypeCount: number;
  seed: number;
};

function normalizeNonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function nextRandom(seed: number) {
  return (seed * 1664525 + 1013904223) >>> 0;
}

export function createMasonryBenchmarkItems({
  count,
  reuseTypeCount,
  seed,
}: MasonryBenchmarkOptions): MasonryBenchmarkItem[] {
  const itemCount = normalizeNonNegativeInteger(count);
  const typeCount = Math.max(1, normalizeNonNegativeInteger(reuseTypeCount));
  let state = normalizeNonNegativeInteger(seed) || 1;

  return Array.from({ length: itemCount }, (_, index) => {
    state = nextRandom(state);
    return {
      id: `benchmark-${index}`,
      height: 140 + (state % 161),
      reuseType: `type-${index % typeCount}`,
    };
  });
}
