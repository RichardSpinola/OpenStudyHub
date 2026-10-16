// Per-socket fixed window, deliberately above normal typing and board updates.
export function realtimeBudget(limit: number, windowMs = 10_000) {
  let start = 0,
    count = 0;
  return (now = Date.now()) => {
    if (now < start || now - start >= windowMs) {
      start = now;
      count = 0;
    }
    return ++count <= limit;
  };
}
