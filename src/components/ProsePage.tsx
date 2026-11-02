import type { ReactNode } from "react";

export function ProsePage({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <article className="container-page max-w-3xl py-10 md:py-16">
      {eyebrow && <p className="text-sm font-medium text-accent">{eyebrow}</p>}
      <h1 className="display mt-1 text-4xl font-medium sm:text-5xl">{title}</h1>
      {intro && <p className="mt-4 text-lg leading-relaxed text-ink-2">{intro}</p>}
      <div className="prose-sbc mt-8">{children}</div>
    </article>
  );
}
