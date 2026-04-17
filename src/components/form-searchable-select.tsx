"use client";

import { useMemo, useState } from "react";

type Option = { value: string; label: string };

function FormSearchableSelectInner({
  name,
  defaultValue = "",
  options,
  selectedLabel,
  placeholder,
  emptyLabel,
  className = "rounded border px-2 py-1",
}: {
  name: string;
  defaultValue?: string;
  options: Option[];
  selectedLabel: string;
  placeholder: string;
  emptyLabel: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState(selectedLabel);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div className="space-y-1">
      <input type="hidden" name={name} value={value} />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value.trim()) setValue("");
        }}
        placeholder={placeholder}
        className={className}
      />
      <div className="max-h-36 overflow-auto rounded border border-zinc-200 bg-white">
        <button
          type="button"
          onClick={() => {
            setValue("");
            setQuery("");
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
            }}
            className={`block w-full px-2 py-1 text-left text-xs hover:bg-zinc-50 ${
              value === o.value ? "bg-sky-50 font-medium text-sky-900" : "text-zinc-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
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
      defaultValue={defaultValue}
      options={options}
      selectedLabel={selectedLabel}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      className={className}
    />
  );
}
