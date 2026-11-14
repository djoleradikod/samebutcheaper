import "server-only";
import catalogJson from "@/generated/catalog.json";
import { termsBuildFacts, type TermsBuild } from "@/lib/readiness-terms";
import type { Catalog } from "@/lib/types";

let memo: TermsBuild | undefined;

/** The programme terms facts of the catalogue this server was built with (src/lib/readiness-terms.ts). */
export function servedTermsBuild(): TermsBuild {
  memo ??= termsBuildFacts(catalogJson as unknown as Catalog, true);
  return memo;
}
