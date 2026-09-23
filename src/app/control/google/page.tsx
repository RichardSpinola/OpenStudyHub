import Link from "next/link";
import { redirect } from "next/navigation";
import { withV2DbAsync, currentAdminV2 } from "@/lib/v2/runtime";
import { storageOwnerCandidates } from "@/lib/v2/drive-storage";
import { googleOperationalStatus } from "@/lib/v2/google-diagnostics";
import { ConsoleShell } from "../ui";
import { setStorageOwnerAction, repairDriveRootAction } from "./actions";

export default async function GoogleOperations({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const q = await searchParams;
  const data = await withV2DbAsync(async (db) => {
    const admin = await currentAdminV2(db);
    if (!admin) return null;
    return {
      status: googleOperationalStatus(db),
      candidates: storageOwnerCandidates(db),
    };
  });
  if (!data) redirect("/control/login");
  const { status, candidates } = data;
  return (
    <ConsoleShell
      title="Google e storage"
      kicker="Operação da instância"
      message={q.ok}
      error={q.error}
    >
      <p>
        <Link href="/control">Voltar ao Admin</Link>
      </p>
      <h2>Configuração</h2>
      <p>
        APP_URL: {status.config.appOrigin ?? "inválida"} · callback:{" "}
        {status.config.expectedRedirectUri ?? "indisponível"}
      </p>
      <p>
        Cliente Google:{" "}
        {status.config.clientConfigured ? "configurado" : "pendente"} · chave de
        criptografia:{" "}
        {status.config.encryptionKeyConfigured ? "configurada" : "pendente"}
      </p>
      {status.config.errors.length > 0 && (
        <ul>
          {status.config.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <h2>Central Drive</h2>
      <p>
        Owner: {status.storage?.ownerName ?? "nenhum"} · conexão:{" "}
        {status.storage?.connected ? "pronta" : "indisponível"} · diretório:{" "}
        {status.storage?.rootReady ? "criado" : "pendente"}
      </p>
      <form action={setStorageOwnerAction} className="v2-fields">
        <label>
          Usuário normal autorizado para Drive
          <select
            name="ownerId"
            defaultValue={String(status.storage?.ownerId ?? "")}
          >
            <option value="">Sem Drive central</option>
            {candidates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Salvar storage owner</button>
      </form>
      <p>
        Se houver objetos no Drive atual, a troca de owner exige migração antes
        de salvar.
      </p>
      {status.storage?.connected && (
        <form action={repairDriveRootAction}>
          <button type="submit">
            Reparar diretório Drive após verificar a referência
          </button>
        </form>
      )}
      <h2>Classroom por usuário</h2>
      <table>
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Google</th>
            <th>Mappings</th>
            <th>Sync</th>
          </tr>
        </thead>
        <tbody>
          {status.users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>
                {user.needsReconnect
                  ? "Reconectar"
                  : user.connected
                    ? "Conectado"
                    : "Não conectado"}
              </td>
              <td>
                {user.mapped}/{user.eligible}
              </td>
              <td>{user.syncProblems ? "Precisa de ação" : "Sem erro"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ConsoleShell>
  );
}
