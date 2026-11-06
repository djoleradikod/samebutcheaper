/**
 * Published evidence that buying the generic is a safe, high-yield habit.
 * Only facts quoted from primary sources (checked 2026-11-03).
 */
const PROOF = [
  {
    stat: "9%",
    label: "of the time pharmacists pay extra for a brand-name headache remedy",
    detail: "The average shopper does it 26% of the time. The people who know the ingredients buy the store brand.",
    source: "Bronnenberg, Dubé, Gentzkow & Shapiro, Quarterly Journal of Economics (2015)",
    href: "https://econpapers.repec.org/RePEc:oup:qjecon:v:130:y:2015:i:4:p:1669-1726",
  },
  {
    stat: "12 pts",
    label: "less spent on brand-name salt, sugar and pantry staples by professional chefs",
    detail: "Compared with similar non-chefs, in the same study's case study of pantry staples.",
    source: "Same study, QJE (2015)",
    href: "https://econpapers.repec.org/RePEc:oup:qjecon:v:130:y:2015:i:4:p:1669-1726",
  },
  {
    stat: "Same",
    label: "active ingredient and strength as the brand-name drug, for every FDA-approved generic",
    detail: "The FDA requires a generic to be the same as its brand-name medicine in dosage, safety, effectiveness, strength, stability and quality. Each swap page shows the label data for the two products we compare.",
    source: "U.S. Food and Drug Administration, Generic Drug Facts",
    href: "https://www.fda.gov/drugs/generic-drugs/generic-drug-facts",
  },
];

export function ProofStrip({ title = "The experts already buy the generic" }: { title?: string }) {
  return (
    <section className="container-page py-10">
      <h2 className="display text-xl md:text-2xl">{title}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {PROOF.map((p) => (
          <figure key={p.label} className="card flex flex-col p-4">
            <p className="price text-[2.5rem] text-ink">{p.stat}</p>
            <p className="mt-2 leading-snug font-semibold">{p.label}</p>
            <p className="mt-1.5 text-sm text-ink-2">{p.detail}</p>
            <figcaption className="mt-auto pt-3 text-[13px] font-medium">
              <a href={p.href} target="_blank" rel="noopener" className="text-cobalt underline underline-offset-2">
                {p.source}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
