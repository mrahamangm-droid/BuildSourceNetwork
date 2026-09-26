import { describe, expect, it } from "vitest";
import { transferBlocker, warehouseDeleteBlocker, warehouseLabel } from "../src/lib/branches";

const empty = { movements: 0, onHandMilli: 0, reservedMilli: 0, orderLines: 0 };

describe("warehouseDeleteBlocker", () => {
  it("allows deleting a never-used warehouse", () => {
    expect(warehouseDeleteBlocker(empty)).toBeNull();
  });
  it("blocks when stock is reserved, held, referenced by orders or has history", () => {
    expect(warehouseDeleteBlocker({ ...empty, reservedMilli: 1 })).toMatch(/reserved/);
    expect(warehouseDeleteBlocker({ ...empty, onHandMilli: 5000 })).toMatch(/holds stock/);
    expect(warehouseDeleteBlocker({ ...empty, orderLines: 1 })).toMatch(/Orders/);
    expect(warehouseDeleteBlocker({ ...empty, movements: 3 })).toMatch(/history/);
  });
  it("reports reservations before plain stock", () => {
    expect(warehouseDeleteBlocker({ ...empty, onHandMilli: 9, reservedMilli: 1 })).toMatch(
      /reserved/,
    );
  });
});

describe("transferBlocker", () => {
  it("accepts a valid transfer", () => {
    expect(transferBlocker({ fromWarehouseId: "a", toWarehouseId: "b", quantity: 2.5 })).toBeNull();
  });
  it("rejects same, missing and non-positive input", () => {
    expect(transferBlocker({ fromWarehouseId: "a", toWarehouseId: "a", quantity: 1 })).toMatch(
      /different/,
    );
    expect(transferBlocker({ fromWarehouseId: "", toWarehouseId: "b", quantity: 1 })).toMatch(
      /both/,
    );
    expect(transferBlocker({ fromWarehouseId: "a", toWarehouseId: "b", quantity: 0 })).toMatch(
      /greater/,
    );
    expect(transferBlocker({ fromWarehouseId: "a", toWarehouseId: "b", quantity: NaN })).toMatch(
      /greater/,
    );
  });
});

describe("warehouseLabel", () => {
  it("joins branch and warehouse, without repeating identical names", () => {
    expect(warehouseLabel("Sharjah", "Yard 2")).toBe("Sharjah · Yard 2");
    expect(warehouseLabel("Main", "main")).toBe("main");
  });
});
