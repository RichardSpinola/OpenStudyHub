"use client";

import { useState, type ReactNode } from "react";

export function CanonicalSelect({
  name,
  value,
  children,
}: {
  name: string;
  value: string;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState(value);
  return (
    <select
      name={name}
      value={selected}
      onChange={(event) => setSelected(event.target.value)}
    >
      {children}
    </select>
  );
}

export function CanonicalCheckbox({
  name,
  checked,
}: {
  name: string;
  checked: boolean;
}) {
  const [selected, setSelected] = useState(checked);
  return (
    <input
      name={name}
      type="checkbox"
      value="true"
      checked={selected}
      onChange={(event) => setSelected(event.target.checked)}
    />
  );
}
