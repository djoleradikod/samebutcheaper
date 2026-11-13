/**
 * The German dictionary. Typed as the English one's shape, so a missing namespace, key or argument fails typecheck.
 * Copy rules (docs/country-urls.md, "Languages"): plain, concrete, "du", no marketing tone. Medicines: "wirkstoffgleich",
 * "gleicher Wirkstoff", "Packungsbeilage beachten"; never "identisch" unless the record proves it.
 */
import type { Shape } from "./t";
import type { Dictionary } from "./en";
import * as client from "./de/client";
import * as site from "./de/site";
import * as swap from "./de/swap";

export const de: Shape<Dictionary> = { ...swap, ...client, ...site };
