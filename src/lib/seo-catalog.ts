import "server-only";
import { getAllPairs } from "./catalog";
import { swapTitles } from "./seo";

let titles: Map<string, string> | undefined;

/** The swap's title, unique across the catalogue (see swapTitles). Worked out once per server. */
export function swapTitleFor(slug: string) {
  titles ??= swapTitles(getAllPairs());
  return titles.get(slug);
}
