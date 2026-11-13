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
import { clientT, hasClientDict, type ClientT, type Sections } from "./client-dict";
import { HTML_LANG, langOfPath, type Lang } from "./lang";

const LangContext = createContext<Lang>("en");

/** The page's language. English outside a page (it never is). */
export function useLang(): Lang {
  return useContext(LangContext);
}

/** `t()` over the given client sections (see ./client-dict.ts), in the page's language. */
export function useT<S extends Sections>(sections: S): ClientT<S> {
  return clientT(useLang(), sections);
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
  if (lang === "de" && !hasClientDict("de")) use((germanText ??= import("./de/client-register")));
  return <>{children}</>;
}

/**
 * Picks the server-rendered version for the page's language. For what the root layout renders outside the page (the
 * header, the footer, the skip link): both versions come from the server, only the page's one is drawn.
 */
export function ByLang({ en, de }: { en: ReactNode; de: ReactNode }) {
  return <>{useLang() === "de" ? de : en}</>;
}
