"use client";

import { HomeMotionControl, useHomeMotion, useHomeVisibility } from "@/components/store/home-motion";
import styles from "./home-motion.module.css";

export function HomeBrandsStrip({ brands }: { brands: string[] }) {
  const { ref, inView } = useHomeVisibility();
  const { paused, reducedMotion, pageVisible } = useHomeMotion();
  const unique = new Map<string, string>();
  for (const brand of brands) {
    const name = brand.trim();
    const key = name.toLocaleLowerCase("pt-BR");
    if (name && !unique.has(key)) unique.set(key, name);
  }
  const names = [...unique.values()];
  if (!names.length) return null;
  const animated = names.length >= 4;
  return (
    <section ref={ref} aria-label="Marcas disponíveis na RARE" className={`mt-3 rounded-lg bg-neutral-950 text-white ${styles.brands}`}
      data-static={!animated} data-playing={animated && !paused && !reducedMotion && pageVisible && inView}>
      <div className={styles.brandViewport}>
        <div className={styles.brandTrack}>
          {[false, ...(animated ? [true] : [])].map((copy) => (
            <ul key={String(copy)} aria-hidden={copy || undefined} className={`${styles.brandGroup} ${copy ? styles.brandCopy : ""}`}>
              {names.map((name) => <li key={name} className={styles.brandName}><span>{name}</span><span aria-hidden="true" className={styles.brandSeparator} /></li>)}
            </ul>
          ))}
        </div>
      </div>
      {animated ? <div className="border-t border-white/15 px-4 py-1.5 sm:border-l sm:border-t-0"><HomeMotionControl /></div> : null}
    </section>
  );
}
