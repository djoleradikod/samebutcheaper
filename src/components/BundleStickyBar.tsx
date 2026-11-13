"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * On a phone, once the kit's hero has scrolled away, a bar at the foot of the screen keeps the way to the buying
 * list in reach. It hides while the list itself is on screen and near the page's end, where the footer is.
 * The same pattern as StickyBuy on swap pages, with the list as a second thing to watch.
 */
export function BundleStickyBar({ hero, list, children }: { /** id of the hero */ hero: string; /** id of the buying list */ list: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const top = document.getElementById(hero);
    const target = document.getElementById(list);
    if (!top) return;
    const footer = document.querySelector("footer");
    let past = false;
    let listOn = false;
    let nearEnd = false;
    const update = () => setShow(past && !listOn && !nearEnd);
    const watch = (el: Element | null, fn: (e: IntersectionObserverEntry) => void) => {
      if (!el) return null;
      const io = new IntersectionObserver(([e]) => {
        fn(e);
        update();
      });
      io.observe(el);
      return io;
    };
    const observers = [
      watch(top, (e) => (past = !e.isIntersecting && e.boundingClientRect.top < 0)),
      watch(target, (e) => (listOn = e.isIntersecting)),
      watch(footer, (e) => (nearEnd = e.isIntersecting)),
    ];
    return () => observers.forEach((o) => o?.disconnect());
  }, [hero, list]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-paper/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-200 lg:hidden ${show ? "translate-y-0" : "pointer-events-none translate-y-full"}`}
      aria-hidden={!show}
      inert={!show}
    >
      {children}
    </div>
  );
}
