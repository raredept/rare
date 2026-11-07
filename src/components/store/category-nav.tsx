"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { categoryNavReducer, initialCategoryNavState } from "@/components/store/category-nav-state";
import { virtualCatalogCategories } from "@/lib/catalog-categories";
import { sortByPreferredCategoryOrder } from "@/lib/catalog-shortcuts";

type NavigationCategory = {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
};

const categoryLinkBaseClass =
  "store-category-link flex min-h-11 min-w-11 max-w-full items-center justify-center border-b px-1 py-2 text-center text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-150 hover:border-white/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

const activeCategoryLinkClass = "border-white text-white";
const inactiveCategoryLinkClass = "border-transparent text-white/70";

const categoryMenuLinkBaseClass =
  "flex min-h-11 items-center px-4 py-3 text-sm font-normal transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-950";

const activeCategoryMenuLinkClass = "bg-neutral-950 text-white hover:bg-neutral-900 focus-visible:bg-neutral-900";
const inactiveCategoryMenuLinkClass = "text-neutral-900 hover:bg-neutral-100 focus-visible:bg-neutral-100";

function isPointerStillInside(currentTarget: EventTarget & HTMLElement, relatedTarget: EventTarget | null) {
  return relatedTarget instanceof Node && currentTarget.contains(relatedTarget);
}

function getActiveCategorySlug(pathname: string) {
  const match = /^\/categoria\/([^/?#]+)/.exec(pathname);
  return match?.[1] ?? null;
}

function getCategoryLinkClass(isActive: boolean) {
  return `${categoryLinkBaseClass} ${isActive ? activeCategoryLinkClass : inactiveCategoryLinkClass}`;
}

function getCategoryMenuLinkClass(isActive: boolean) {
  return `${categoryMenuLinkBaseClass} ${isActive ? activeCategoryMenuLinkClass : inactiveCategoryMenuLinkClass}`;
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
  const activeCategorySlug = getActiveCategorySlug(pathname);

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

  const orderedCategories = useMemo(() => sortByPreferredCategoryOrder(categories), [categories]);

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
      className="store-shell flex flex-wrap items-center justify-center gap-x-6 gap-y-0 pb-1 xl:gap-x-8"
    >
      {virtualCatalogCategories.map((category) => {
        const isActive = activeCategorySlug === category.slug;

        return (
          <Link
            key={category.slug}
            href={`/categoria/${category.slug}`}
            className={getCategoryLinkClass(isActive)}
            aria-current={isActive ? "page" : undefined}
          >
            {category.name}
          </Link>
        );
      })}

      {orderedCategories.map((category) => {
        const isOpen = openCategoryId === category.id;
        const hasChildren = category.children.length > 0;
        const menuId = `category-menu-${category.id}`;
        const isDirectlyActive = activeCategorySlug === category.slug;
        const activeChildSlug = category.children.find((child) => child.slug === activeCategorySlug)?.slug;
        const isCategoryActive = isDirectlyActive || Boolean(activeChildSlug);

        if (!hasChildren) {
          return (
            <Link
              key={category.id}
              href={`/categoria/${category.slug}`}
              className={getCategoryLinkClass(isCategoryActive)}
              aria-current={isCategoryActive ? "page" : undefined}
            >
              {category.name}
            </Link>
          );
        }

        return (
          <div
            key={category.id}
            className="relative max-w-full"
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
              className={`${getCategoryLinkClass(isCategoryActive)} cursor-pointer`}
              aria-expanded={isOpen}
              aria-controls={menuId}
              aria-haspopup="true"
              aria-current={isCategoryActive ? "page" : undefined}
              onClick={() => {
                toggleMenuByClick(category.id);
              }}
              onKeyDown={(event) => onButtonKeyDown(event, category.id, menuId, isOpen)}
            >
              {category.name}
              <ChevronDown
                className={`ml-1.5 h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>

            <div
              id={menuId}
              data-category-menu
              className={`top-[var(--accessory-menu-top)] fixed left-4 right-4 z-50 max-w-[calc(100vw-2rem)] overflow-y-auto border border-neutral-200 bg-neutral-50 p-1 text-neutral-900 transition-[opacity,visibility] duration-150 lg:absolute lg:left-auto lg:right-0 lg:top-full lg:min-w-64 ${
                isOpen ? "visible opacity-100" : "invisible pointer-events-none opacity-0"
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
              <Link
                href={`/categoria/${category.slug}`}
                className={getCategoryMenuLinkClass(isDirectlyActive)}
                aria-current={isDirectlyActive ? "page" : undefined}
                onClick={selectMenuItem}
              >
                Ver todos
              </Link>
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/categoria/${child.slug}`}
                  className={getCategoryMenuLinkClass(activeChildSlug === child.slug)}
                  aria-current={activeChildSlug === child.slug ? "page" : undefined}
                  onClick={selectMenuItem}
                >
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
