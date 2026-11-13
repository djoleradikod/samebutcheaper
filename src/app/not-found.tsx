import Link from "@/components/CountryLink";

export default function NotFound() {
  return (
    <section className="container-page py-24 text-center">
      <p className="num text-sm font-medium text-accent">404</p>
      <h1 className="display mt-2 text-4xl font-medium">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-ink-2">The swap may have moved, or we haven&apos;t checked it yet.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/search" className="btn btn-primary">Search swaps</Link>
        <Link href="/suggest" className="btn btn-ghost">Suggest one</Link>
      </div>
    </section>
  );
}
