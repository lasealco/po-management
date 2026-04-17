"use client";

import { useEffect, useMemo, useState } from "react";

type Row = { id: string; type: "UN_LOCODE" | "PORT" | "AIRPORT"; code: string; name: string; countryCode: string | null };

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
  const [selected, setSelected] = useState(value ?? defaultValue);
  const [query, setQuery] = useState(value ?? defaultValue);
  const [rows, setRows] = useState<Row[]>([]);
  const selectedLabel = useMemo(() => {
    const m = rows.find((r) => r.code === selected);
    return m ? `${m.code} · ${m.name}` : selected;
  }, [rows, selected]);

  useEffect(() => {
    if (value == null) return;
    setSelected(value);
  }, [value]);

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRows([]);
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams({
        q,
        types: types.join(","),
      });
      void fetch(`/api/location-codes/search?${params.toString()}`)
        .then((r) => r.json())
        .then((j: { rows?: Row[] }) => setRows(Array.isArray(j.rows) ? j.rows : []))
        .catch(() => setRows([]));
    }, 220);
    return () => clearTimeout(t);
  }, [query, types]);

  return (
    <div className="space-y-1">
      {name ? <input type="hidden" name={name} value={selected} /> : null}
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value.trim()) {
            setSelected("");
            onChange?.("");
          }
        }}
        placeholder={placeholder}
        className={className}
      />
      <div className="max-h-36 overflow-auto rounded border border-zinc-200 bg-white">
        <button
          type="button"
          onClick={() => {
            setSelected("");
            onChange?.("");
            setQuery("");
          }}
          className={`block w-full px-2 py-1 text-left text-xs hover:bg-zinc-50 ${
            selected === "" ? "bg-sky-50 font-medium text-sky-900" : "text-zinc-600"
          }`}
        >
          {emptyLabel}
        </button>
        {rows.map((r) => (
          <button
            key={`${r.type}:${r.code}:${r.id}`}
            type="button"
            onClick={() => {
              setSelected(r.code);
              onChange?.(r.code);
              setQuery(`${r.code} · ${r.name}`);
            }}
            className={`block w-full px-2 py-1 text-left text-xs hover:bg-zinc-50 ${
              selected === r.code ? "bg-sky-50 font-medium text-sky-900" : "text-zinc-700"
            }`}
          >
            {r.code} · {r.name}
          </button>
        ))}
      </div>
    </div>
  );
}
