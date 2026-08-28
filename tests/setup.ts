// Runtime implementations are provided by Jest moduleNameMapper. Keeping this
// file makes it the single extension point for timers and global matchers.
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback) => {
    callback(Date.now());
    return 0;
  };
}
