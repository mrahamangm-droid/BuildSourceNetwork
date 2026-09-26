import { describe, expect, it } from "vitest";
import { checkTransition, scheduleError, statusAfterDriverEdit } from "@/lib/delivery-rules";

describe("delivery rules", () => {
  it("follows PENDING -> ASSIGNED -> OUT_FOR_DELIVERY -> DELIVERED", () => {
    expect(checkTransition({ status: "PENDING", driverName: "Ali" }, "ASSIGNED")).toBeNull();
    expect(checkTransition({ status: "ASSIGNED", driverName: "Ali" }, "OUT_FOR_DELIVERY")).toBeNull();
    expect(checkTransition({ status: "OUT_FOR_DELIVERY", recipientName: "Site foreman" }, "DELIVERED")).toBeNull();
  });
  it("needs a driver before assigning or dispatching", () => {
    expect(checkTransition({ status: "PENDING" }, "ASSIGNED")).toMatch(/driver/i);
    expect(checkTransition({ status: "PENDING", driverName: "  " }, "OUT_FOR_DELIVERY")).toMatch(/driver/i);
  });
  it("needs a recipient name as proof before delivered", () => {
    expect(checkTransition({ status: "OUT_FOR_DELIVERY" }, "DELIVERED")).toMatch(/received/i);
  });
  it("blocks skipping and going backwards", () => {
    expect(checkTransition({ status: "PENDING", driverName: "Ali" }, "DELIVERED")).not.toBeNull();
    expect(checkTransition({ status: "DELIVERED", driverName: "Ali", recipientName: "X" }, "OUT_FOR_DELIVERY")).not.toBeNull();
    expect(checkTransition({ status: "OUT_FOR_DELIVERY", driverName: "Ali" }, "ASSIGNED")).not.toBeNull();
  });
  it("driver edits promote and demote before departure only", () => {
    expect(statusAfterDriverEdit("PENDING", "Ali")).toBe("ASSIGNED");
    expect(statusAfterDriverEdit("ASSIGNED", "")).toBe("PENDING");
    expect(statusAfterDriverEdit("OUT_FOR_DELIVERY", "")).toBe("OUT_FOR_DELIVERY");
    expect(statusAfterDriverEdit("DELIVERED", "Ali")).toBe("DELIVERED");
  });
  it("validates schedule dates", () => {
    const now = new Date("2026-09-26T10:00:00Z");
    expect(scheduleError(new Date("2026-09-27T08:00:00Z"), now)).toBeNull();
    expect(scheduleError(new Date("2026-09-26T06:00:00Z"), now)).toBeNull();
    expect(scheduleError(new Date("2026-09-20T08:00:00Z"), now)).toMatch(/past/);
    expect(scheduleError(new Date("2028-01-01T00:00:00Z"), now)).toMatch(/far/);
    expect(scheduleError(new Date("nope"), now)).toMatch(/valid/);
  });
});
