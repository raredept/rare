import { describe, expect, it } from "vitest";
import { categoryNavReducer, initialCategoryNavState } from "@/components/store/category-nav-state";

describe("category nav dropdown state", () => {
  it("keeps a hover-open dropdown open when moving from the button into the menu", () => {
    const opened = categoryNavReducer(initialCategoryNavState, { type: "hover-open", categoryId: "accessories" });
    const pendingClose = categoryNavReducer(opened, { type: "schedule-hover-close", categoryId: "accessories" });
    const enteredMenu = categoryNavReducer(pendingClose, { type: "cancel-hover-close" });

    expect(enteredMenu.openCategoryId).toBe("accessories");
    expect(enteredMenu.hoverClosePending).toBe(false);
  });

  it("closes the dropdown with ESC or after selecting an item", () => {
    const opened = categoryNavReducer(initialCategoryNavState, { type: "keyboard-open", categoryId: "accessories" });

    expect(categoryNavReducer(opened, { type: "escape" })).toEqual(initialCategoryNavState);
    expect(categoryNavReducer(opened, { type: "select" })).toEqual(initialCategoryNavState);
  });

  it("toggles click-open state without leaving the menu stuck open", () => {
    const opened = categoryNavReducer(initialCategoryNavState, { type: "click-toggle", categoryId: "accessories" });
    const closed = categoryNavReducer(opened, { type: "click-toggle", categoryId: "accessories" });

    expect(opened).toMatchObject({ openCategoryId: "accessories", pinnedCategoryId: "accessories" });
    expect(closed).toEqual(initialCategoryNavState);
  });
});
