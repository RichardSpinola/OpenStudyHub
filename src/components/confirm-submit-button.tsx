"use client";

import type { ButtonHTMLAttributes } from "react";

export function ConfirmSubmitButton({
  confirmation,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { confirmation: string }) {
  return (
    <button
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented && !window.confirm(confirmation)) {
          event.preventDefault();
        }
      }}
    />
  );
}
