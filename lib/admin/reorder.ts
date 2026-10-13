/**
 * Updates needed to store a new order: position i gets order i, and rows
 * already in place are skipped so a small move sends few requests.
 */
export function orderUpdates<T extends { id: string }>(
  items: T[],
  currentOrder: (item: T) => number | null,
): { id: string; order: number }[] {
  return items.flatMap((item, order) =>
    currentOrder(item) === order ? [] : [{ id: item.id, order }],
  );
}
