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
  const animated = names.length >= 4;
  return (
    <section ref={ref} aria-label="Marcas disponíveis na RARE" className={`flex items-center border-t border-white/20 bg-neutral-950 text-white ${styles.brands}`}
      data-static={!animated} data-playing={animated && !paused && !reducedMotion && pageVisible && inView}>
      {names.length ? <div className={`${styles.brandViewport} min-w-0 flex-1`} tabIndex={!animated || reducedMotion ? 0 : undefined} role="group" aria-label="Lista de marcas">
        <div className={styles.brandTrack}>
          {[false, ...(animated ? [true] : [])].map((copy) => (
            <ul key={String(copy)} aria-hidden={copy || undefined} className={`${styles.brandGroup} ${copy ? styles.brandCopy : ""}`}>
              {names.map((name) => <li key={name} className={styles.brandName}><span>{name}</span><span aria-hidden="true" className={styles.brandSeparator} /></li>)}
            </ul>
          ))}
        </div>
      </div> : <p className="flex-1 px-4 text-xs uppercase tracking-widest">RARE</p>}
      <HomeMotionControl className="mx-3 my-1" />
    </section>
  );
}
