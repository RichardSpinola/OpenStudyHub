import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { isSetupPending } from "@/lib/v2/auth";
import { loginAction } from "../actions";
import { getUiLanguage } from "@/lib/ui-language";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const state = await withV2DbAsync(async (db) => ({
    pending: isSetupPending(db),
    user: await currentAdminV2(db),
  }));
  if (state.pending) redirect("/control/setup");
  if (state.user) redirect("/control");
  const q = await searchParams;
  const english = getUiLanguage() === "en";
  return (
    <div className="admin-access">
      <div className="admin-access-heading">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-180.png" width="48" height="48" alt="" />
        <span>OpenStudyHub Admin</span>
        <h1>
          {english ? "Instance administration" : "Administração da instância"}
        </h1>
      </div>
      {q.ok ? (
        <p role="status" className="v2-message" data-type="ok">
          {q.ok}
        </p>
      ) : null}
      {q.error ? (
        <p role="alert" className="v2-message" data-type="error">
          {q.error}
        </p>
      ) : null}
      <form action={loginAction} className="admin-access-form">
        <label>
          Login
          <input name="login" autoComplete="username" required />
        </label>
        <label>
          {english ? "Password" : "Senha"}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit">{english ? "Sign in" : "Entrar"}</button>
      </form>
    </div>
  );
}
