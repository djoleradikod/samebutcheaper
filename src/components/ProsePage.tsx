import type { ReactNode } from "react";

/**
 * A page of plain writing, lined up with the header's left edge. `eyebrow` is still accepted
 * from older pages but no longer shown: the design has no labels above headings.
 */
export function ProsePage({ title, intro, children }: { eyebrow?: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="container-page pt-4 md:pt-6">
      <article className="max-w-[46rem]">
        <h1 className="display text-[1.75rem] md:text-[2.5rem]">{title}</h1>
        {intro && <p className="mt-2 text-base text-ink-2 md:text-lg">{intro}</p>}
        <div className="prose-sbc mt-4 text-[15px] md:text-base">{children}</div>
      </article>
    </div>
  );
}
