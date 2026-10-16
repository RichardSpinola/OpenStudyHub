"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useUiText } from "./ui-language-provider";
import { IconX } from "@tabler/icons-react";
export function PlanningDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    tr = useUiText();
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="planning-dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={tr("Fechar", "Close")}
        >
          <IconX size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
