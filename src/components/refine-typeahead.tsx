"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Option = { id: string; label: string };

/** Combobox / typeahead: type to filter options, pick from a list (not a native select). */
export function RefineTypeahead({
  label,
  placeholder,
  anyLabel,
  options,
  valueId,
  onChange,
  maxVisible = 100,
}: {
  label: string;
  placeholder: string;
  /** First row that clears the filter (e.g. "Any supplier"). */
  anyLabel: string;
  options: Option[];
  valueId: string | null;
  onChange: (id: string | null) => void;
  /** Cap rendered rows for very large lists. */
  maxVisible?: number;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => (valueId ? options.find((o) => o.id === valueId) : undefined),
    [valueId, options],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const visible = useMemo(() => filtered.slice(0, maxVisible), [filtered, maxVisible]);
  const truncated = filtered.length > visible.length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const inputDisplay = open ? query : (selected?.label ?? "");

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="relative min-w-[10rem] max-w-[14rem]">
      <span className="sr-only">{label}</span>
      <div className="flex items-stretch gap-0.5">
        <input
          ref={inputRef}
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={inputDisplay}
          onFocus={() => {
            setOpen(true);
            setQuery(selected?.label ?? "");
            requestAnimationFrame(() => inputRef.current?.select());
          }}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setQuery("");
              return;
            }
            if (e.key === "Enter" && open && visible.length === 1) {
              e.preventDefault();
              pick(visible[0]!.id);
            }
          }}
          className="w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-800 outline-none focus:border-[var(--arscmp-primary)] focus:ring-1 focus:ring-[var(--arscmp-primary)]"
        />
        {valueId ? (
          <button
            type="button"
            title="Clear"
            aria-label={`Clear ${label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(null)}
            className="shrink-0 rounded-md border border-zinc-300 bg-zinc-50 px-1.5 text-sm leading-none text-zinc-600 hover:bg-zinc-100"
          >
            ×
          </button>
        ) : null}
      </div>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-md border border-zinc-200 bg-white py-1 text-xs shadow-lg"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={valueId === null}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(null)}
              className="flex w-full px-2 py-1.5 text-left hover:bg-zinc-100"
            >
              {anyLabel}
            </button>
          </li>
          {visible.map((o) => (
            <li key={o.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={valueId === o.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.id)}
                className="flex w-full px-2 py-1.5 text-left hover:bg-zinc-100"
              >
                {o.label}
              </button>
            </li>
          ))}
          {truncated ? (
            <li className="px-2 py-1 text-[10px] text-zinc-500">
              {query.trim()
                ? `Type to narrow… (${filtered.length} matches)`
                : `Showing first ${maxVisible} of ${filtered.length} · type to narrow`}
            </li>
          ) : null}
          {visible.length === 0 ? (
            <li className="px-2 py-2 text-zinc-500">No matches.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
