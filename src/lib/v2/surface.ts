export type Surface = "app" | "admin" | "combined";

export function configuredSurface(
  value: string | undefined,
  production: boolean,
): Surface {
  if (value === "app" || value === "admin" || value === "combined")
    return value;
  return production ? "app" : "combined";
}

export function surfaceRoute(
  surface: Surface,
  pathname: string,
): "app" | "admin" | "blocked" | "admin-home" {
  const control = pathname === "/control" || pathname.startsWith("/control/");
  if (surface === "app" && control) return "blocked";
  if (surface === "admin") {
    if (pathname === "/") return "admin-home";
    return control ? "admin" : "blocked";
  }
  return control ? "admin" : "app";
}
