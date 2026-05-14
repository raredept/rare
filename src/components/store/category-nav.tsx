"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { categoryNavReducer, initialCategoryNavState } from "@/components/store/category-nav-state";

type NavigationCategory = {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
};

const categoryPillClass =
  "store-category-pill flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-white/15 bg-white/[0.03] px-4 text-sm font-bold text-white/85 transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:border-white hover:bg-white hover:text-black active:translate-y-0 active:scale-[0.98] focus-visible:bg-white focus-visible:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

const categoryMenuLinkClass =
  "block rounded-md px-3 py-2 text-sm font-bold text-neutral-900 transition-[background-color,color] duration-150 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none";

const preferredCategoryOrder = new Map([
  ["camisetas", 10],
  ["jaquetas", 20],
  ["conjuntos", 30],
  ["bermudas", 40],
  ["calcas", 50],
  ["acessorios", 90],
]);

function isPointerStillInside(currentTarget: EventTarget & HTMLElement, relatedTarget: EventTarget | null) {
  return relatedTarget instanceof Node && currentTarget.contains(relatedTarget);
}

function normalizeCategoryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getPreferredOrder(category: NavigationCategory) {
  for (const value of [category.slug, category.name]) {
    const order = preferredCategoryOrder.get(normalizeCategoryKey(value));
    if (order) return order;
  }

  return 70;
}

export function CategoryNav({ categories }: { categories: NavigationCategory[] }) {
  const pathname = usePathname();
  const [navState, dispatchNav] = useReducer(categoryNavReducer, initialCategoryNavState);
  const [menuTop, setMenuTop] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const hoverCloseTimeoutRef = useRef<number | null>(null);
  const openCategoryId = navState.openCategoryId;
  const pinnedCategoryId = navState.pinnedCategoryId;

  const clearHoverCloseTimer = useCallback(() => {
    if (hoverCloseTimeoutRef.current === null) return;
    window.clearTimeout(hoverCloseTimeoutRef.current);
    hoverCloseTimeoutRef.current = null;
  }, []);

  const closeMenu = useCallback(() => {
    clearHoverCloseTimer();
    dispatchNav({ type: "close" });
  }, [clearHoverCloseTimer]);

  const selectMenuItem = useCallback(() => {
    clearHoverCloseTimer();
    dispatchNav({ type: "select" });
  }, [clearHoverCloseTimer]);

  const orderedCategories = useMemo(
    () =>
      categories
        .map((category, index) => ({ category, index }))
        .sort((first, second) => {
          const orderDiff = getPreferredOrder(first.category) - getPreferredOrder(second.category);
          return orderDiff || first.index - second.index;
        })
        .map(({ category }) => category),
    [categories],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      closeMenu();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, closeMenu]);

  useEffect(() => () => clearHoverCloseTimer(), [clearHoverCloseTimer]);

  useEffect(() => {
    if (!openCategoryId) return;
    const activeCategoryId: string = openCategoryId;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      closeMenu();
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        buttonRefs.current.get(activeCategoryId)?.focus();
      }
    }

    function onViewportChange() {
      const button = buttonRefs.current.get(activeCategoryId);
      if (!button) return;
      setMenuTop(Math.round(button.getBoundingClientRect().bottom + 8));
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [openCategoryId, closeMenu]);

  function updateMenuPosition(categoryId: string) {
    const button = buttonRefs.current.get(categoryId);
    if (button) {
      setMenuTop(Math.round(button.getBoundingClientRect().bottom + 8));
    }
  }

  function openMenuByHover(categoryId: string) {
    clearHoverCloseTimer();
    updateMenuPosition(categoryId);
    dispatchNav({ type: "hover-open", categoryId });
  }

  function toggleMenuByClick(categoryId: string) {
    clearHoverCloseTimer();
    updateMenuPosition(categoryId);
    dispatchNav({ type: "click-toggle", categoryId });
  }

  function openMenuByKeyboard(categoryId: string, menuId: string, placement: "first" | "last") {
    clearHoverCloseTimer();
    updateMenuPosition(categoryId);
    dispatchNav({ type: "keyboard-open", categoryId });
    window.requestAnimationFrame(() => focusMenuItem(menuId, placement));
  }

  function scheduleHoverClose(categoryId: string) {
    if (pinnedCategoryId === categoryId) return;
    clearHoverCloseTimer();
    dispatchNav({ type: "schedule-hover-close", categoryId });
    hoverCloseTimeoutRef.current = window.setTimeout(() => {
      dispatchNav({ type: "close" });
      hoverCloseTimeoutRef.current = null;
    }, 320);
  }

  function focusMenuItem(menuId: string, placement: "first" | "last") {
    const menu = document.getElementById(menuId);
    const links = menu ? Array.from(menu.querySelectorAll<HTMLAnchorElement>("a[href]")) : [];
    const target = placement === "last" ? links.at(-1) : links[0];
    target?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      buttonRefs.current.get(openCategoryId ?? "")?.focus();
      return;
    }

    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }

    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[href]"));
    if (!links.length) return;

    event.preventDefault();
    const activeIndex = links.findIndex((link) => link === document.activeElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? links.length - 1
          : event.key === "ArrowUp"
            ? activeIndex <= 0
              ? links.length - 1
              : activeIndex - 1
            : activeIndex >= links.length - 1
              ? 0
              : activeIndex + 1;

    links[nextIndex]?.focus();
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>, categoryId: string, menuId: string, isOpen: boolean) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenuByKeyboard(categoryId, menuId, event.key === "ArrowUp" ? "last" : "first");
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      closeMenu();
    }
  }

  const menuStyle = {
    "--accessory-menu-top": `${menuTop}px`,
    maxHeight: menuTop ? `calc(100vh - ${menuTop}px - 16px)` : undefined,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className="scrollbar-none mx-auto flex max-w-[1440px] gap-2 overflow-x-auto py-3 pl-4 pr-8 sm:pl-6 sm:pr-10 lg:overflow-visible lg:px-8 xl:px-10"
    >
      <Link href="/" className={categoryPillClass}>
        Tudo
      </Link>

      {orderedCategories.map((category) => {
        const isOpen = openCategoryId === category.id;
        const hasChildren = category.children.length > 0;
        const menuId = `category-menu-${category.id}`;

        if (!hasChildren) {
          return (
            <Link key={category.id} href={`/categoria/${category.slug}`} className={categoryPillClass}>
              {category.name}
            </Link>
          );
        }

        return (
          <div
            key={category.id}
            className="relative shrink-0"
            onPointerEnter={(event) => {
              if (event.pointerType === "mouse" && !pinnedCategoryId) openMenuByHover(category.id);
            }}
            onPointerLeave={(event) => {
              if (
                event.pointerType === "mouse" &&
                pinnedCategoryId !== category.id &&
                !isPointerStillInside(event.currentTarget, event.relatedTarget)
              ) {
                scheduleHoverClose(category.id);
              }
            }}
            onBlur={(event) => {
              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                closeMenu();
              }
            }}
          >
            <button
              ref={(node) => {
                if (node) {
                  buttonRefs.current.set(category.id, node);
                } else {
                  buttonRefs.current.delete(category.id);
                }
              }}
              type="button"
              className={`${categoryPillClass} cursor-pointer`}
              aria-expanded={isOpen}
              aria-controls={menuId}
              aria-haspopup="true"
              onClick={() => {
                toggleMenuByClick(category.id);
              }}
              onKeyDown={(event) => onButtonKeyDown(event, category.id, menuId, isOpen)}
            >
              {category.name}
              <ChevronDown
                className={`ml-2 h-4 w-4 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            <div
              id={menuId}
              data-category-menu
              className={`top-[var(--accessory-menu-top)] fixed left-4 right-4 z-50 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-2 text-neutral-900 shadow-2xl transition-[opacity,transform,visibility] duration-150 ease-out lg:absolute lg:left-0 lg:right-auto lg:top-full lg:mt-2 lg:min-w-56 ${
                isOpen ? "visible translate-y-0 opacity-100" : "invisible pointer-events-none -translate-y-1 opacity-0"
              }`}
              style={menuStyle}
              aria-hidden={!isOpen}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") {
                  clearHoverCloseTimer();
                  dispatchNav({ type: "cancel-hover-close" });
                }
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse" && !isPointerStillInside(event.currentTarget, event.relatedTarget)) {
                  scheduleHoverClose(category.id);
                }
              }}
              onKeyDown={onMenuKeyDown}
            >
              <Link href={`/categoria/${category.slug}`} className={categoryMenuLinkClass} onClick={selectMenuItem}>
                Ver todos
              </Link>
              {category.children.map((child) => (
                <Link key={child.id} href={`/categoria/${child.slug}`} className={categoryMenuLinkClass} onClick={selectMenuItem}>
                  {child.name}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
