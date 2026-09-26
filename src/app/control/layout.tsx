import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { configuredSurface } from "@/lib/v2/surface";
import "./console.css";

export default function ControlLayout({ children }: { children: ReactNode }) {
  if (
    configuredSurface(
      process.env.OPENSTUDYHUB_SURFACE,
      process.env.NODE_ENV === "production",
    ) === "app"
  )
    notFound();
  return children;
}
