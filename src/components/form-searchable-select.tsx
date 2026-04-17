"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Option = { value: string; label: string };

function FormSearchableSelectInner({
  name,
  options,
  selectedLabel,
  placeholder,
  emptyLabel,
  className = "rounded border px-2 py-1",
  initialValue,
}: {
  name: string;
  options: Option[];
  selectedLabel: string;
  placeholder: string;
  emptyLabel: string;
  className?: string;
  initialValue: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [query, setQuery] = useState(selectedLabel);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const displayQueryForValue = useCallback(
    (v: string) => options.find((o) => o.value === v)?.label ?? "",
    [options],
  );

  const close = useCallback(() => {
    setOpen(false);
    setQuery(displayQueryForValue(value));
  }, [displayQueryForValue, value]);

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
      <input type="hidden" name={name} value={value} />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value.trim()) setValue("");
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
        className={className}
      />
      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-0.5 max-h-36 overflow-auto rounded border border-zinc-200 bg-white shadow-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => {
              setValue("");
              setQuery("");
              setOpen(false);
            }}
            className={`block w-full px-2 py-1 text-left text-xs hover:bg-zinc-50 ${
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
                setValue(o.value);
                setQuery(o.label);
                setOpen(false);
              }}
              className={`block w-full px-2 py-1 text-left text-xs hover:bg-zinc-50 ${
                value === o.value ? "bg-sky-50 font-medium text-sky-900" : "text-zinc-700"
              }`}
            >
              {o.label}
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-zinc-500">No matches.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function FormSearchableSelect({
  name,
  defaultValue = "",
  options,
  placeholder,
  emptyLabel,
  className = "rounded border px-2 py-1",
}: {
  name: string;
  defaultValue?: string;
  options: Option[];
  placeholder: string;
  emptyLabel: string;
  className?: string;
}) {
  const selectedLabel = useMemo(
    () => options.find((o) => o.value === defaultValue)?.label ?? "",
    [options, defaultValue],
  );

  return (
    <FormSearchableSelectInner
      key={`${defaultValue}::${selectedLabel}`}
      name={name}
      initialValue={defaultValue}
      options={options}
      selectedLabel={selectedLabel}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      className={className}
    />
  );
}
