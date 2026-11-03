import { BadgeCheck, ChefHat, Stethoscope } from "lucide-react";

/**
 * Published evidence that buying the generic is a safe, high-yield habit.
 * Only facts quoted from primary sources (checked 2026-11-03).
 */
const PROOF = [
  {
    icon: Stethoscope,
    stat: "9%",
    label: "of the time pharmacists pay extra for a brand-name headache remedy",
    detail: "The average shopper does it 26% of the time. The people who know the ingredients buy the store brand.",
    source: "Bronnenberg, Dubé, Gentzkow & Shapiro, Quarterly Journal of Economics (2015)",
    href: "https://econpapers.repec.org/RePEc:oup:qjecon:v:130:y:2015:i:4:p:1669-1726",
  },
  {
    icon: ChefHat,
    stat: "12 pts",
    label: "less spent on brand-name salt, sugar and pantry staples by professional chefs",
    detail: "Compared with similar non-chefs, in the same study's case study of pantry staples.",
    source: "Same study, QJE (2015)",
    href: "https://econpapers.repec.org/RePEc:oup:qjecon:v:130:y:2015:i:4:p:1669-1726",
  },
  {
    icon: BadgeCheck,
    stat: "Same",
    label: "active ingredient and strength as the brand-name drug, for every FDA-approved generic",
    detail: "The FDA requires a generic to be the same as its brand-name medicine in dosage, safety, effectiveness, strength, stability and quality. Each swap page shows the label data for the two products we compare.",
    source: "U.S. Food and Drug Administration, Generic Drug Facts",
    href: "https://www.fda.gov/drugs/generic-drugs/generic-drug-facts",
  },
];

export function ProofStrip({ title = "The experts already buy the generic" }: { title?: string }) {
  return (
    <section className="container-page py-14">
      <p className="text-sm font-medium text-accent">Confirmed by research</p>
      <h2 className="display mt-1 text-3xl font-medium sm:text-4xl">{title}</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PROOF.map((p) => (
          <figure key={p.label} className="card flex flex-col p-6">
            <p.icon className="h-6 w-6 text-accent" aria-hidden="true" />
            <p className="num display mt-4 text-5xl font-medium text-ink">{p.stat}</p>
            <p className="mt-2 font-semibold leading-snug">{p.label}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{p.detail}</p>
            <figcaption className="mt-auto pt-4 text-xs text-muted">
              <a href={p.href} target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-accent">
                {p.source}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
