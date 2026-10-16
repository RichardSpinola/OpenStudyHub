import Link from "next/link";
import { IconApps } from "@tabler/icons-react";
import { UiCopy } from "@/components/ui-language-provider";
import type { ReactNode } from "react";

export function ExtraWorkspace({
  title,
  titleEn,
  back = "/extras",
  games = false,
  children,
  kind = "tool",
}: {
  title: string;
  titleEn?: string;
  back?: string;
  games?: boolean;
  children: ReactNode;
  kind?: "tool" | "game";
}) {
  return (
    <section className="extra-workspace" data-kind={kind}>
      <header className="extra-workspace-header">
        <Link href={back} className="extra-workspace-exit">
          <IconApps size={19} aria-hidden="true" />
          <UiCopy
            pt={games ? "Joguinhos" : "Extras"}
            en={games ? "Minigames" : "Extras"}
          />
        </Link>
        <h1>
          <UiCopy pt={title} en={titleEn ?? title} />
        </h1>
        <Link href="/" className="extra-workspace-home">
          <UiCopy pt="Home" en="Home" />
        </Link>
      </header>
      <div className="extra-workspace-body">{children}</div>
    </section>
  );
}
