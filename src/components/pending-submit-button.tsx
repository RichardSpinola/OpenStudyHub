"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function PendingSubmitButton({
  children,
  pendingLabel = "Processando…",
  disabled = false,
  className,
}: {
  children: ReactNode;
  pendingLabel?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
