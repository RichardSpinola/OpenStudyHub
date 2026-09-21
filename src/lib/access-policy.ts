import type { AuthenticatedUser } from "@/lib/session";

export function canAccessAdministration(
  user: AuthenticatedUser | null,
): boolean {
  return user?.role === "admin";
}
