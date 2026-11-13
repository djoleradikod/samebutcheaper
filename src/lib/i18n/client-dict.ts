/**
 * `t()` over client sections (en/client/<section>.ts, de/client.ts) for one language. Plain code, so a component that
 * renders on both sides (PairCard on a server list and inside the client PairBrowser) can take a `lang` prop and call it.
 * Client components with no such prop use useT() from ./client, which wraps this.
 *
 * English comes from the sections the caller hands over, and only those are bundled with it: a component imports the
 * sections it uses, keeps them in one module-level object, and passes that object. The keys stay the full dotted paths
 * ("kits.sorts.amount"), and the compiler only accepts keys of the sections passed, so a missing import fails `tsc`.
 *
 *   const TEXT = { kits };                      // import { kits } from "@/lib/i18n/en/client/kits";
 *   const t = useT(TEXT);                       // or clientT(lang, TEXT)
 *   t("kits.sorts.amount");
 *
 * German registers itself whole (./de/client-register.ts) where it is needed: on the server through ./index, and in the
 * browser through `Html` in ./client, which loads it as its own chunk on German pages only. So an English page ships no
 * German, and only its own components' English.
 */
import type { ClientDictionary } from "./en";
import type { Lang } from "./lang";
import { makeT, type Shape, type TFn } from "./t";

/** Some of the client sections, as a component hands them over. */
export type Sections = Partial<ClientDictionary>;

/** `t()` over these sections. */
export type ClientT<S extends Sections = ClientDictionary> = TFn<S>;

const registered: Partial<Record<Lang, Shape<ClientDictionary>>> = {};
const forLang: Partial<Record<Lang, ClientT>> = {};
const forSections = new WeakMap<object, ClientT<Sections>>();

/** Called once by a language's register module. */
export function registerClientDict(lang: Lang, dict: Shape<ClientDictionary>) {
  if (registered[lang]) return;
  registered[lang] = dict;
  forLang[lang] = makeT(dict) as ClientT;
}

/** Whether a language's client text is loaded here. English always is, section by section. */
export function hasClientDict(lang: Lang) {
  return lang === "en" || Boolean(registered[lang]);
}

export function clientT<S extends Sections>(lang: Lang, sections: S): ClientT<S> {
  const other = lang === "en" ? undefined : forLang[lang];
  if (other) return other as unknown as ClientT<S>;
  let t = forSections.get(sections);
  if (!t) {
    t = makeT(sections) as ClientT<Sections>;
    forSections.set(sections, t);
  }
  return t as unknown as ClientT<S>;
}
