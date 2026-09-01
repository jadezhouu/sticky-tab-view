import type { TFetchRes, TSectionData, TThumb } from '../types.js';

type TMergeOptions = {
  replace: boolean;
};

function cloneSection<T extends object>(section: TSectionData<T>): TSectionData<T> {
  return {
    ...section,
    items: [...section.items],
  };
}

export function mergeFetchResult<T extends object>(
  previous: readonly TSectionData<T>[],
  result: TFetchRes<T>,
  { replace }: TMergeOptions,
): TSectionData<T>[] {
  if (result.items && result.sections) {
    throw new Error('Fetch results must contain either items or sections, not both.');
  }

  const base = replace ? [] : previous.map(cloneSection);
  if (result.sections) return [...base, ...result.sections.map(cloneSection)];
  if (!result.items) return base;

  if (base.length === 0) return [{ items: [...result.items] }];
  const lastIndex = base.length - 1;
  const last = base[lastIndex];
  base[lastIndex] = { ...last, items: [...last.items, ...result.items] };
  return base;
}

export function areDependencyListsEqual(
  previous: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
  if (previous === next) return true;
  if (!previous || !next || previous.length !== next.length) return false;
  return previous.every((value, index) => Object.is(value, next[index]));
}

export function normalizeMasonryColumn(column: unknown): number {
  return typeof column === 'number' && Number.isInteger(column) && column > 0 ? column : 1;
}

export function normalizeMasonryLength(length: unknown): number {
  return typeof length === 'number' && Number.isFinite(length) && length >= 0 ? length : 0;
}

export function findShortestColumnIndex(heights: readonly number[]): number {
  let shortestIndex = 0;
  let shortestHeight = Number.POSITIVE_INFINITY;
  for (let index = 0; index < heights.length; index += 1) {
    if (heights[index] < shortestHeight) {
      shortestHeight = heights[index];
      shortestIndex = index;
    }
  }
  return shortestIndex;
}

export function findNearestThumbIndex(
  thumbs: readonly Pick<TThumb, 'y' | 'height'>[],
  offset: number,
  frameHeight: number,
): number {
  'worklet';
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < thumbs.length; index += 1) {
    const thumb = thumbs[index];
    const nextDistance = Math.abs(thumb.y + thumb.height / 2 - offset - frameHeight / 2);
    if (nextDistance < distance) {
      distance = nextDistance;
      nearest = index;
    }
  }
  return nearest;
}

export function createRequestGenerationGuard() {
  let current = 0;

  return {
    begin() {
      current += 1;
      return current;
    },
    invalidate() {
      current += 1;
    },
    isCurrent(generation: number) {
      return generation === current;
    },
  };
}

export interface TAbortablePromise<T> extends Promise<T> {
  abort: () => void;
}

export function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError';
}

export function makeAbortable<T>(
  promise: Promise<T>,
  controller: AbortController,
): TAbortablePromise<T> {
  let settled = false;
  let rejectResult: (reason?: unknown) => void = () => undefined;
  const result = new Promise<T>((resolve, reject) => {
    rejectResult = reject;
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      },
    );
  }) as TAbortablePromise<T>;

  result.abort = () => {
    if (settled) return;
    settled = true;
    controller.abort();
    const error = new Error('Request aborted');
    error.name = 'AbortError';
    rejectResult(error);
  };

  return result;
}
