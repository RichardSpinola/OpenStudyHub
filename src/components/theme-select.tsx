"use client";

import { useState } from "react";

export function ThemeSelect({
  name = "theme",
  defaultValue,
  form,
}: {
  name?: string;
  defaultValue: "dark" | "light";
  form?: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <select
      name={name}
      form={form}
      value={value}
      onChange={(event) => {
        const next = event.target.value === "light" ? "light" : "dark";
        setValue(next);
        document.documentElement.dataset.theme = next;
      }}
    >
      <option value="dark">Escuro</option>
      <option value="light">Claro</option>
    </select>
  );
}
