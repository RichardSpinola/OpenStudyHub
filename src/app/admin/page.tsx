import Link from "next/link";

import { getAcademicAuthority } from "@/lib/academic-authority";
import { requireAcademicAdministrator } from "@/lib/authorization";
import { getTranslations } from "@/lib/translations";
import { getUiLanguage } from "@/lib/ui-language";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const actor = await requireAcademicAdministrator();
  const authority = getAcademicAuthority(actor.id);
  const { admin } = getTranslations(getUiLanguage());
  const academicModules = [
    { href: "/admin/users", label: admin.users, code: "USR" },
    { href: "/admin/academic", label: admin.academic, code: "ACD" },
  ];
  const globalModules = [
    { href: "/settings", label: admin.institution, code: "CFG" },
    { href: "/settings#shortcuts", label: admin.shortcuts, code: "LNK" },
    { href: "/admin/audit", label: admin.audit, code: "LOG" },
    { href: "/api/health", label: admin.systemStatus, code: "SYS" },
  ];
  const modules =
    authority.role === "admin"
      ? [...academicModules, ...globalModules]
      : academicModules;

  return (
    <div className="admin-shell">
      <header className="admin-heading">
        <span>{admin.system}</span>
        <h1>{admin.title}</h1>
        <Link href="/">[ HOME ]</Link>
      </header>
      <nav className="admin-module-grid" aria-label={admin.navigation}>
        {modules.map((module, index) => (
          <Link key={module.href} href={module.href}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{module.label}</strong>
            <small>{`${module.code} // ${admin.open}`}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}
