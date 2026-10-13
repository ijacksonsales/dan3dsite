import { describe, expect, it } from "vitest";

import { orderUpdates } from "./reorder";

describe("orderUpdates", () => {
  const order = (item: { order: number | null }) => item.order;

  it("only updates rows whose position changed", () => {
    const items = [
      { id: "a", order: 0 },
      { id: "c", order: 2 },
      { id: "b", order: 1 },
      { id: "d", order: 3 },
    ];
    expect(orderUpdates(items, order)).toEqual([
      { id: "c", order: 1 },
      { id: "b", order: 2 },
    ]);
  });

  it("renumbers gaps and missing orders", () => {
    const items = [
      { id: "a", order: 5 },
      { id: "b", order: null },
    ];
    expect(orderUpdates(items, order)).toEqual([
      { id: "a", order: 0 },
      { id: "b", order: 1 },
    ]);
  });
});
