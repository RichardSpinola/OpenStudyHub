import { isAbsolute, relative, resolve } from "node:path";

export const DEVELOPMENT_RESET_CONFIRMATION =
  "--confirm-reset-development-instance";
export const DEVELOPMENT_RESET_ENV_VALUE = "RESET_LOCAL_OPENSTUDYHUB";

type ResetGuardInput = {
  nodeEnvironment: string | undefined;
  confirmationValue: string | undefined;
  arguments: string[];
  databasePath: string;
  projectDirectory: string;
};

export function validateDevelopmentReset(input: ResetGuardInput): string {
  if (
    input.nodeEnvironment !== "development" &&
    input.nodeEnvironment !== "test"
  ) {
    throw new Error("Reset recusado: NODE_ENV deve ser development ou test.");
  }
  if (input.confirmationValue !== DEVELOPMENT_RESET_ENV_VALUE) {
    throw new Error("Reset recusado: confirmação de ambiente ausente.");
  }
  if (!input.arguments.includes(DEVELOPMENT_RESET_CONFIRMATION)) {
    throw new Error("Reset recusado: confirmação de linha de comando ausente.");
  }
  if (input.databasePath === ":memory:") {
    throw new Error(
      "Reset recusado: banco em memória não precisa ser apagado.",
    );
  }

  const projectDirectory = resolve(input.projectDirectory);
  const databasePath = isAbsolute(input.databasePath)
    ? resolve(input.databasePath)
    : resolve(projectDirectory, input.databasePath);
  const pathFromProject = relative(projectDirectory, databasePath);
  if (pathFromProject.startsWith("..") || isAbsolute(pathFromProject)) {
    throw new Error("Reset recusado: o banco deve estar dentro do projeto.");
  }
  if (!pathFromProject.startsWith(`data/`)) {
    throw new Error(
      "Reset recusado: somente bancos no diretório data podem ser resetados.",
    );
  }

  return databasePath;
}
