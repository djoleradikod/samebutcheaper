"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * A bottom sheet on a native modal dialog, which brings the focus trap, Esc to close and an
 * inert page behind it. Rises a little on opening, so it's clear where it came from.
 */
export function FilterSheet({
  open,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // A click on the dialog itself, outside its contents, is a click on the backdrop.
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-x-0 top-auto bottom-0 mx-auto my-0 w-full max-w-lg rounded-t-card bg-paper p-0 text-ink transition-transform duration-150 backdrop:bg-ink/50 motion-reduce:transition-none starting:open:translate-y-6"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between border-b border-line pl-4">
          <h2 id={titleId} className="text-lg">
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex h-11 w-11 items-center justify-center text-ink-2 hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
        <div className="flex gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>
      </div>
    </dialog>
  );
}
