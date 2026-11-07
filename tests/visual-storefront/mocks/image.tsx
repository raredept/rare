import { forwardRef, type ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | { src: string }; fill?: boolean; priority?: boolean; preload?: boolean; quality?: number; unoptimized?: boolean; loader?: unknown };
const Image = forwardRef<HTMLImageElement, Props>(function FixtureImage({ src, alt = "", fill, priority, preload, quality: _quality, unoptimized: _unoptimized, loader: _loader, style, loading, ...props }, ref) {
  void _quality; void _unoptimized; void _loader;
  const source = typeof src === "string" ? src : src.src;
  const url = new URL(source, window.location.href);
  if (url.origin !== window.location.origin) throw new Error("Fixture QA: nonlocal image refused.");
  return <img {...props} ref={ref} alt={alt} src={source} loading={loading ?? (priority || preload ? "eager" : "lazy")} style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style} />;
});
export default Image;
