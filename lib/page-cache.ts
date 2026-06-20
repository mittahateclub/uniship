// Tiny in-memory stale-while-revalidate cache for client page data.
//
// Page controllers are client components that fetch in `useEffect` on mount and
// start with `loading = true`, so every navigation back to a page refetches and
// flashes a skeleton. This module-scoped cache persists across client-side
// navigation (it only resets on a full reload), so a revisited page can seed its
// state from the last result and render instantly, then revalidate in the
// background. Keys should include the user id so data never leaks between
// accounts.
const store = new Map<string, unknown>();

export function getCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCache<T>(key: string, value: T): void {
  store.set(key, value);
}
