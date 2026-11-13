"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * On a phone the store button sits below the first screen, and once a shopper scrolls into the evidence it is gone.
 * This keeps the cheaper product's button in reach: a bar at the foot of the screen that shows once the price list
 * has scrolled away above, and hides again while it's on screen or after the page's end, where the footer is.
 */
export function StickyBuy({ watch, children }: { /** id of the price list */ watch: string; children: ReactNode }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById(watch);
    if (!target) return;
    const footer = document.querySelector("footer");
    let above = false;
    let nearEnd = false;
    const update = () => setShow(above && !nearEnd);
    const io = new IntersectionObserver(([e]) => {
      above = !e.isIntersecting && e.boundingClientRect.top < 0;
      update();
    });
    io.observe(target);
    const end = new IntersectionObserver(([e]) => {
      nearEnd = e.isIntersecting;
      update();
    });
    if (footer) end.observe(footer);
    return () => {
      io.disconnect();
      end.disconnect();
    };
  }, [watch]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line-strong bg-paper/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-200 md:hidden ${show ? "translate-y-0" : "pointer-events-none translate-y-full"}`}
      aria-hidden={!show}
      inert={!show}
    >
      {children}
    </div>
  );
}
