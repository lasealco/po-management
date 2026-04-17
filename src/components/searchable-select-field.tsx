"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SearchableSelectOption = { value: string; label: string };

function SearchableSelectInner({
  value,
  selectedLabel,
  onChange,
  options,
  placeholder = "Type to filter...",
  emptyLabel = "Select...",
  className = "rounded-md border border-zinc-300 px-3 py-2",
  inputClassName = "rounded-md border border-zinc-300 px-3 py-2",
  listClassName = "max-h-40 overflow-auto rounded border border-zinc-200 bg-white shadow-md",
}: {
  value: string;
  selectedLabel: string;
  onChange: (next: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  inputClassName?: string;
  listClassName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedLabel);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open, close]);

  return (
    <div ref={rootRef} className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value.trim()) onChange("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            close();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder}
        className={inputClassName}
      />
      {open ? (
        <div
          className={`absolute left-0 right-0 top-full z-30 mt-0.5 ${listClassName}`}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(false);
            }}
            className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50 ${
              value === "" ? "bg-sky-50 font-medium text-sky-900" : "text-zinc-600"
            }`}
          >
            {emptyLabel}
          </button>
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setQuery(o.label);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50 ${
                value === o.value ? "bg-sky-50 font-medium text-sky-900" : "text-zinc-700"
              } ${className.includes("font-mono") ? "font-mono" : ""}`}
            >
              {o.label}
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-500">No matches.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SearchableSelectField({
  value,
  onChange,
  options,
  placeholder = "Type to filter...",
  emptyLabel = "Select...",
  className = "rounded-md border border-zinc-300 px-3 py-2",
  inputClassName = "rounded-md border border-zinc-300 px-3 py-2",
  listClassName = "max-h-40 overflow-auto rounded border border-zinc-200 bg-white shadow-md",
}: {
  value: string;
  onChange: (next: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  inputClassName?: string;
  listClassName?: string;
}) {
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  return (
    <SearchableSelectInner
      key={`${value}::${selectedLabel}`}
      value={value}
      selectedLabel={selectedLabel}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      className={className}
      inputClassName={inputClassName}
      listClassName={listClassName}
    />
  );
}
