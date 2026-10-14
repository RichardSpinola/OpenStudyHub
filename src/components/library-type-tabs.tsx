import Link from "next/link";
import { UiCopy } from "./ui-language-provider";
import { isProjectsFeatureEnabled } from "@/lib/feature-flags";
export function LibraryTypeTabs({ kind }: { kind: "documents" | "projects" }) {
  return (
    <nav className="library-type-tabs" aria-label="Biblioteca / Library">
      <Link
        href="/library"
        aria-current={kind === "documents" ? "page" : undefined}
      >
        <UiCopy pt="Documentos" en="Documents" />
      </Link>
      {isProjectsFeatureEnabled() ? (
        <Link
          href="/library?type=projects"
          aria-current={kind === "projects" ? "page" : undefined}
        >
          <UiCopy pt="Projetos" en="Projects" />
        </Link>
      ) : null}
    </nav>
  );
}
