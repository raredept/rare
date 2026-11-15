import { forwardRef, type AnchorHTMLAttributes } from "react";
import { navigate } from "./navigation";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname?: string; query?: Record<string, string> }; prefetch?: boolean; replace?: boolean; scroll?: boolean };
const Link = forwardRef<HTMLAnchorElement, Props>(function FixtureLink({ href, prefetch: _prefetch, replace, scroll: _scroll, onClick, ...props }, ref) {
  void _prefetch; void _scroll;
  const target = typeof href === "string" ? href : `${href.pathname ?? "/"}${href.query ? `?${new URLSearchParams(href.query)}` : ""}`;
  return <a {...props} ref={ref} href={target} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || props.target === "_blank") return;
    const destination = new URL(target, window.location.href);
    event.preventDefault();
    if (destination.origin !== window.location.origin) return;
    navigate(target, replace);
  }} />;
});
export default Link;
