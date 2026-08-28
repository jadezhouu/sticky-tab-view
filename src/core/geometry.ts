export function clamp(value: number, min: number, max: number): number {
  'worklet';
  if (!Number.isFinite(value)) return min;
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function normalizePage(page: number | undefined, tabCount: number): number {
  'worklet';
  if (page === undefined || !Number.isInteger(page) || tabCount <= 0) return 0;
  return clamp(page, 0, tabCount - 1);
}

export function getMaxOffset(
  contentSize: number,
  viewportSize: number,
  trailingInset = 0,
): number {
  'worklet';
  return Math.max(0, contentSize - viewportSize) + Math.max(0, trailingInset);
}

type TPageTargetInput = {
  currentPage: number;
  offset: number;
  pageSize: number;
  contentSize: number;
  velocity: number;
};

export function getPageTarget({
  currentPage,
  offset,
  pageSize,
  contentSize,
  velocity,
}: TPageTargetInput): number {
  'worklet';
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 0;
  const pageCount = Math.max(1, Math.ceil(contentSize / pageSize));
  const current = clamp(currentPage, 0, pageCount - 1);
  const progress = offset / pageSize - current;
  const velocityThreshold = 3;
  let target = current;

  if (velocity < -velocityThreshold || progress >= 0.5) target += 1;
  if (velocity > velocityThreshold || progress <= -0.5) target -= 1;

  return clamp(target, 0, pageCount - 1);
}

type TEndReachedInput = {
  offset: number;
  contentSize: number;
  viewportSize: number;
  distance: number;
  armed: boolean;
};

export function shouldTriggerEndReached({
  offset,
  contentSize,
  viewportSize,
  distance,
  armed,
}: TEndReachedInput): boolean {
  'worklet';
  if (!armed) return false;
  const threshold = Math.max(0, contentSize - viewportSize - Math.max(0, distance));
  return offset >= threshold;
}
