// Small list helpers.

/** Moves the element at `index` by `delta` (-1 up, +1 down) in place. Returns false at the edges. */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): boolean {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return false;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item as T);
  return true;
}

/** Removes the element at `index` in place. Returns the removed element, or undefined. */
export function removeItem<T>(list: T[], index: number): T | undefined {
  if (index < 0 || index >= list.length) return undefined;
  return list.splice(index, 1)[0];
}
