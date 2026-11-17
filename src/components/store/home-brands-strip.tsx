"use client";

import Link from "next/link";
import { useHomeMotion, useHomeVisibility } from "@/components/store/home-motion";
import { buildCatalogHref } from "@/lib/catalog-refinements";
import styles from "./home-motion.module.css";

/**
 * UIUX-BRANDS-001: the strip runs on its own — it stops only for reduced motion, a hidden tab, the
 * explicit "Pausar animações" control, or hover/focus on the strip itself (CSS). Clicking the hero no
 * longer freezes it. Each brand opens the catalog filtered by that brand (a real route).
 */
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
    <section ref={ref} aria-label="Marcas disponíveis na RARE" className={`bg-neutral-950 text-white ${styles.brands}`}
      data-static={!animated} data-playing={animated && !paused && !reducedMotion && pageVisible && inView}>
      <div className={styles.brandViewport} role="group" aria-label="Lista de marcas">
        <div className={styles.brandTrack}>
          {[false, ...(animated ? [true] : [])].map((copy) => (
            <ul key={String(copy)} aria-hidden={copy || undefined} className={`${styles.brandGroup} ${copy ? styles.brandCopy : ""}`}>
              {names.map((name) => (
                <li key={name} className={styles.brandName}>
                  <Link
                    href={buildCatalogHref("tudo", { brand: name })}
                    tabIndex={copy ? -1 : undefined}
                    className={styles.brandLink}
                    aria-label={copy ? undefined : `Ver peças ${name}`}
                  >
                    {name}
                  </Link>
                  <span aria-hidden="true" className={styles.brandSeparator} />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}
