"use client";

/**
 * The page's language in the browser, and `t()` for client components.
 *
 * The root layout can't know the page's language on the server: it renders outside the page and has no params. The
 * route segments can, from inside the page tree, so `Html` reads them and renders `<html lang>` itself. For every
 * prerendered page that is in the static HTML. On a page rendered on demand (a noindex country view) the segments are
 * only known at request time, so that page renders whole at request time instead of streaming into a shell.
 *
 * No dictionary is bundled here: each client component brings the English sections it uses (./client-dict.ts). The
 * German ones (de/client.ts) are a chunk of their own that `Html` loads on German pages only, before anything under it
 * renders.
 */
import { useSelectedLayoutSegments } from "next/navigation";
import { createContext, use, useContext, type ReactNode } from "react";
import { clientT, hasClientDict, hasPageSection, registerPageSections, type ClientT, type Sections } from "./client-dict";
import type { PageClientDictionary } from "./en";
import { HTML_LANG, langOfPath, type Lang } from "./lang";

const LangContext = createContext<Lang>("en");

/** The page's language. English outside a page (it never is). */
export function useLang(): Lang {
  return useContext(LangContext);
}

/** A German page section's module, as `() => import("@/lib/i18n/de/pages/basket")` gives it. */
export type PageLoader = () => Promise<Partial<Record<keyof PageClientDictionary, unknown>>>;

const loading = new Map<string, Promise<void>>();

/** Page sections are named with a "page" prefix ("pageBasket"); shared ones aren't. */
function isPageSection(name: string): name is keyof PageClientDictionary {
  return name.startsWith("page");
}

/**
 * `t()` over the given client sections (see ./client-dict.ts), in the page's language. A component that reads a page
 * section passes that section's German loader too: on a German page the section loads once, before the component
 * renders, and an English page never fetches it.
 */
export function useT<S extends Sections>(sections: S, german?: PageLoader): ClientT<S> {
  const lang = useLang();
  if (german && lang === "de") {
    // Once a section has started loading, every render waits on the same promise, loaded or not. React replays a
    // component that suspended with the hooks it saw first, so `use` must not drop out between the two renders.
    const section = Object.keys(sections).find((k) => isPageSection(k) && (loading.has(k) || !hasPageSection(lang, k)));
    if (section) {
      let pending = loading.get(section);
      if (!pending) {
        pending = german().then((m) => registerPageSections("de", m as never));
        loading.set(section, pending);
      }
      use(pending);
    }
  }
  return clientT(lang, sections);
}

/** The language from the root layout's view of the route: "country/de/compare/x" is German. */
function useRouteLang(): Lang {
  // The segments are the internal path (src/proxy.ts rewrites /de/x to /country/de/x), which langOfPath reads too.
  return langOfPath(`/${useSelectedLayoutSegments().join("/")}`);
}

/** `<html>` with the page's `lang`, and the language for every client component under it. For the root layout only. */
export function Html({ className, children }: { className?: string; children: ReactNode }) {
  const lang = useRouteLang();
  return (
    <html lang={HTML_LANG[lang]} className={className} suppressHydrationWarning>
      <LangContext.Provider value={lang}>
        <LoadText lang={lang}>{children}</LoadText>
      </LangContext.Provider>
    </html>
  );
}

let germanText: Promise<unknown> | null = null;

/** Waits for the German client text on a German page (once per page load), so nothing under it renders in English first. */
function LoadText({ lang, children }: { lang: Lang; children: ReactNode }) {
  // Waits on the same promise once it exists, for the reason in useT.
  if (lang === "de" && (germanText || !hasClientDict("de"))) use((germanText ??= import("./de/client-register")));
  return <>{children}</>;
}

/**
 * Picks the server-rendered version for the page's language. For what the root layout renders outside the page (the
 * header, the footer, the skip link): both versions come from the server, only the page's one is drawn.
 */
export function ByLang({ en, de }: { en: ReactNode; de: ReactNode }) {
  return <>{useLang() === "de" ? de : en}</>;
}
