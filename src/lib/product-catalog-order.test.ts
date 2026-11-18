import { describe, expect, it } from "vitest";
import { parseCatalogPosition, placeAtPosition, placeNextTo, positionOf } from "@/lib/product-catalog-order";

const list = ["a", "b", "c", "d", "e"];

describe("placeAtPosition", () => {
  it("puts the piece exactly at the typed place and shifts the others by one", () => {
    expect(placeAtPosition(list, "e", 2)).toEqual(["a", "e", "b", "c", "d"]);
    expect(placeAtPosition(list, "a", 3)).toEqual(["b", "c", "a", "d", "e"]);
  });

  it("regression: position 2 means second place, not 'after every piece with weight 0'", () => {
    expect(positionOf(placeAtPosition(list, "d", 2), "d")).toBe(2);
  });

  it("clamps past the end to last and keeps the list size", () => {
    expect(placeAtPosition(list, "b", 99)).toEqual(["a", "c", "d", "e", "b"]);
  });

  it("inserts a product that is not in the list yet (creation)", () => {
    expect(placeAtPosition(list, "new", 1)).toEqual(["new", ...list]);
  });

  it("is a no-op for the current place", () => {
    expect(placeAtPosition(list, "c", 3)).toEqual(list);
  });
});

describe("placeNextTo", () => {
  it("up goes right before the neighbour, down right after it", () => {
    expect(placeNextTo(list, "d", "c", "up")).toEqual(["a", "b", "d", "c", "e"]);
    expect(placeNextTo(list, "b", "c", "down")).toEqual(["a", "c", "b", "d", "e"]);
  });

  it("works with a filtered list: the neighbour can be several places away", () => {
    expect(placeNextTo(list, "e", "b", "up")).toEqual(["a", "e", "b", "c", "d"]);
  });

  it("returns null for an unknown product or neighbour, or itself", () => {
    expect(placeNextTo(list, "x", "a", "up")).toBeNull();
    expect(placeNextTo(list, "a", "x", "down")).toBeNull();
    expect(placeNextTo(list, "a", "a", "down")).toBeNull();
  });
});

describe("parseCatalogPosition", () => {
  it("accepts whole numbers from 1", () => {
    expect(parseCatalogPosition("1")).toBe(1);
    expect(parseCatalogPosition(" 42 ")).toBe(42);
  });

  it.each(["", "0", "-3", "2.5", "1e2", "abc", "1234567"])("rejects %j", (value) => {
    expect(parseCatalogPosition(value)).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(parseCatalogPosition(null)).toBeNull();
  });
});
