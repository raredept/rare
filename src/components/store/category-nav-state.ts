export type CategoryNavState = {
  openCategoryId: string | null;
  pinnedCategoryId: string | null;
  hoverClosePending: boolean;
};

export type CategoryNavAction =
  | { type: "hover-open"; categoryId: string }
  | { type: "keyboard-open"; categoryId: string }
  | { type: "click-toggle"; categoryId: string }
  | { type: "schedule-hover-close"; categoryId: string }
  | { type: "cancel-hover-close" }
  | { type: "escape" }
  | { type: "select" }
  | { type: "close" };

export const initialCategoryNavState: CategoryNavState = {
  openCategoryId: null,
  pinnedCategoryId: null,
  hoverClosePending: false,
};

export function categoryNavReducer(state: CategoryNavState, action: CategoryNavAction): CategoryNavState {
  switch (action.type) {
    case "hover-open":
      return {
        openCategoryId: action.categoryId,
        pinnedCategoryId: null,
        hoverClosePending: false,
      };
    case "keyboard-open":
      return {
        openCategoryId: action.categoryId,
        pinnedCategoryId: action.categoryId,
        hoverClosePending: false,
      };
    case "click-toggle":
      if (state.openCategoryId === action.categoryId && state.pinnedCategoryId === action.categoryId) {
        return initialCategoryNavState;
      }

      return {
        openCategoryId: action.categoryId,
        pinnedCategoryId: action.categoryId,
        hoverClosePending: false,
      };
    case "schedule-hover-close":
      if (state.pinnedCategoryId === action.categoryId) {
        return { ...state, hoverClosePending: false };
      }

      return { ...state, hoverClosePending: true };
    case "cancel-hover-close":
      return { ...state, hoverClosePending: false };
    case "escape":
    case "select":
    case "close":
      return initialCategoryNavState;
  }
}
