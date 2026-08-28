export const scheduleOnRN = (
  callback: (...args: unknown[]) => void,
  ...args: unknown[]
): void => callback(...args);
