export function usd(n: number) {
  if (n >= 100) return `$${Math.round(n).toLocaleString("en-US")}`;
  return `$${n.toFixed(2)}`;
}

/** Price-per-unit formatting: cents for tiny values, dollars otherwise. */
export function ppu(n: number) {
  if (n < 0.01) return `${(n * 100).toFixed(2)}¢`;
  if (n < 1) return `${(n * 100).toFixed(1)}¢`;
  return `$${n.toFixed(2)}`;
}

export function pct(n: number) {
  return `${Math.round(n)}%`;
}

export function unitLabel(unit: string, size = 1) {
  if (size === 1) return unit;
  if (/(oz|ml|g|mg|lb|kg|mah)$/i.test(unit)) return unit;
  if (/s$|x$|ch$|sh$/.test(unit)) return unit + "es";
  return unit + "s";
}

export function formatSize(size: number, unit: string) {
  const n = Number.isInteger(size) ? size.toString() : size.toFixed(1);
  return `${n} ${unitLabel(unit, size)}`;
}

export function monthYear(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
