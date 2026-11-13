/**
 * What tells one of a brand's products from another on a card titled by brand alone ("Nurofen -> Tesco Health" three
 * times in a search for nurofen): the brand-name product as the record names it, without the brand's own words at the
 * front. Null when the record's product is no more than the brand.
 */
export function productDetail(brand: string, product: string): string | null {
  const b = brand.trim();
  let rest = product.trim();
  if (rest.toLowerCase().startsWith(b.toLowerCase())) rest = rest.slice(b.length);
  rest = rest.replace(/^[\s,:;.\-–—]+/, "").trim();
  if (!rest || rest.toLowerCase() === b.toLowerCase()) return null;
  return rest;
}
