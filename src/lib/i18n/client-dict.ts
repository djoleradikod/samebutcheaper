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
import type { ClientDictionary, PageClientDictionary } from "./en";
import type { Lang } from "./lang";
import { makeT, type Shape, type TFn } from "./t";

/** Some of the client sections, as a component hands them over: shared ones and page ones (see registerPageSections). */
export type Sections = Partial<ClientDictionary & PageClientDictionary>;

/** `t()` over these sections. */
export type ClientT<S extends Sections = ClientDictionary> = TFn<S>;

const registered: Partial<Record<Lang, Shape<ClientDictionary>>> = {};
const pages: Partial<Record<Lang, Partial<Shape<PageClientDictionary>>>> = {};
const forLang: Partial<Record<Lang, ClientT>> = {};
const forSections = new WeakMap<object, ClientT<Sections>>();

function rebuild(lang: Lang) {
  forLang[lang] = makeT({ ...registered[lang], ...pages[lang] }) as ClientT;
}

/** Called once by a language's register module. */
export function registerClientDict(lang: Lang, dict: Shape<ClientDictionary>) {
  if (registered[lang]) return;
  registered[lang] = dict;
  rebuild(lang);
}

/**
 * Page sections (en/pages/<section>.ts, de/pages/<section>.ts): the words of one page's client components, such as the
 * basket's stepper or the shopping-list check. Each German page section is a chunk of its own, loaded by the component
 * that reads it (useT with a loader, in ./client), so a German swap page doesn't carry the basket's German.
 */
export function registerPageSections(lang: Lang, sections: Partial<Shape<PageClientDictionary>>) {
  pages[lang] = { ...pages[lang], ...sections };
  rebuild(lang);
}

/** Whether a page section is loaded for a language. English always is: the component imports it. */
export function hasPageSection(lang: Lang, name: keyof PageClientDictionary) {
  return lang === "en" || Boolean(pages[lang]?.[name]);
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
