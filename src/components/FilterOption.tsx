import type { ReactNode } from "react";

/** A titled group of filter options. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <fieldset>
        <legend className="mb-0.5 text-[13px] font-bold [font-stretch:112%]">{title}</legend>
        {children}
      </fieldset>
    </div>
  );
}

/** One filter option with how many results it would leave. */
export function OptionRow({
  type,
  name,
  label,
  count,
  checked,
  title,
  onChange,
}: {
  type: "checkbox" | "radio";
  name?: string;
  label: string;
  count: number;
  checked: boolean;
  title?: string;
  onChange: () => void;
}) {
  // An option that would empty the list can't be picked, so filters don't lead to a dead end.
  const dead = count === 0 && !checked;
  return (
    <label
      title={title}
      className={`flex min-h-11 items-center gap-2 py-1 text-sm leading-snug lg:min-h-8 ${dead ? "text-muted" : "cursor-pointer hover:underline"}`}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={dead}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-ink"
      />
      <span className="min-w-0 flex-1">{label}</span>
      <span className="num text-[13px] font-medium text-muted">{count}</span>
    </label>
  );
}
