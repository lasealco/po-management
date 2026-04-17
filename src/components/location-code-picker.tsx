"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Row = { id: string; type: "UN_LOCODE" | "PORT" | "AIRPORT"; code: string; name: string; countryCode: string | null };

function LocationCodePickerInner({
  onChange,
  name,
  placeholder,
  types,
  emptyLabel,
  className,
  initialSelected,
  initialQuery,
}: {
  onChange?: (code: string) => void;
  name?: string;
  placeholder: string;
  types: Array<"UN_LOCODE" | "PORT" | "AIRPORT">;
  emptyLabel: string;
  className: string;
  initialSelected: string;
  initialQuery: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(initialSelected);
  const [query, setQuery] = useState(initialQuery);
  const [rows, setRows] = useState<Row[]>([]);

  const selectedLabel = useMemo(() => {
    const m = rows.find((r) => r.code === selected);
    return m ? `${m.code} · ${m.name}` : selected;
  }, [rows, selected]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery(selected === "" ? "" : selectedLabel);
  }, [selected, selectedLabel]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const delay = q.length < 2 ? 0 : 220;
    const t = window.setTimeout(() => {
      if (q.length < 2) {
        setRows([]);
        return;
      }
      const params = new URLSearchParams({
        q,
        types: types.join(","),
      });
      void fetch(`/api/location-codes/search?${params.toString()}`)
        .then((r) => r.json())
        .then((j: { rows?: Row[] }) => setRows(Array.isArray(j.rows) ? j.rows : []))
        .catch(() => setRows([]));
    }, delay);
    return () => clearTimeout(t);
  }, [query, types, open]);

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
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value.trim()) {
            setSelected("");
            onChange?.("");
          }
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
              setSelected("");
              onChange?.("");
              setQuery("");
              setRows([]);
              setOpen(false);
            }}
            className={`block w-full px-2 py-1 text-left text-xs hover:bg-zinc-50 ${
              selected === "" ? "bg-sky-50 font-medium text-sky-900" : "text-zinc-600"
            }`}
          >
            {emptyLabel}
          </button>
          {query.trim().length < 2 ? (
            <p className="px-2 py-1.5 text-[11px] text-zinc-500">Type at least 2 characters to search.</p>
          ) : rows.length === 0 ? (
            <p className="px-2 py-1.5 text-[11px] text-zinc-500">No matches.</p>
          ) : (
            rows.map((r) => (
              <button
                key={`${r.type}:${r.code}:${r.id}`}
                type="button"
                onClick={() => {
                  setSelected(r.code);
                  onChange?.(r.code);
                  setQuery(`${r.code} · ${r.name}`);
                  setOpen(false);
                }}
                className={`block w-full px-2 py-1 text-left text-xs hover:bg-zinc-50 ${
                  selected === r.code ? "bg-sky-50 font-medium text-sky-900" : "text-zinc-700"
                }`}
              >
                {r.code} · {r.name}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function LocationCodePicker({
  value,
  defaultValue = "",
  onChange,
  name,
  placeholder,
  types,
  emptyLabel,
  className = "rounded border border-zinc-300 px-2 py-1.5",
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  name?: string;
  placeholder: string;
  types: Array<"UN_LOCODE" | "PORT" | "AIRPORT">;
  emptyLabel: string;
  className?: string;
}) {
  const effective = value !== undefined ? value : defaultValue;
  return (
    <LocationCodePickerInner
      key={`${name ?? "picker"}::${effective}`}
      name={name}
      initialSelected={effective}
      initialQuery={effective}
      onChange={onChange}
      placeholder={placeholder}
      types={types}
      emptyLabel={emptyLabel}
      className={className}
    />
  );
}
