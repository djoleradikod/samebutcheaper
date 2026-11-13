/**
 * The whole dictionary, for server components, route handlers, emails and pure helpers that run on the server. Client
 * components use useT() from ./client instead, which carries only the client namespaces.
 */
import { de } from "./de";
import { en, type Dictionary } from "./en";
import type { Lang } from "./lang";
import { makeT, type Shape, type TFn } from "./t";
// Server code renders client components too (PairCard on a server list): they need the German client text loaded here.
import "./de/client-register";
import "./de/pages-register";

export type { Lang } from "./lang";
export { langForCountry, langOfPath } from "./lang";

const DICTS: Record<Lang, Shape<Dictionary>> = { en, de };

/** The dictionary itself, for code that hands a whole namespace on. */
export function dict(lang: Lang): Shape<Dictionary> {
  return DICTS[lang];
}

const T: Record<Lang, TFn<Shape<Dictionary>>> = { en: makeT(DICTS.en), de: makeT(DICTS.de) };

/** `t()` for one language. */
export function getT(lang: Lang): TFn<Shape<Dictionary>> {
  return T[lang];
}
