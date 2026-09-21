import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  revalidatePath: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  updateOwnProfile: vi.fn(),
  updateOwnHomePreferences: vi.fn(),
  updateUserShortcut: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/authorization", () => ({
  requireAdminUser: vi.fn(),
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));
vi.mock("@/lib/audit", () => ({ recordAuditEvent: mocks.audit }));
vi.mock("@/lib/profile", () => ({
  updateOwnProfile: mocks.updateOwnProfile,
  updateOwnHomePreferences: mocks.updateOwnHomePreferences,
}));
vi.mock("@/lib/user-shortcuts", () => ({
  createUserShortcut: vi.fn(),
  deleteUserShortcut: vi.fn(),
  moveUserShortcut: vi.fn(),
  reorderEnabledUserShortcuts: vi.fn(),
  setUserShortcutEnabled: vi.fn(),
  updateUserShortcut: mocks.updateUserShortcut,
}));

import { updatePersonalShortcutAction, updateProfileAction } from "./actions";

describe("ações de preferências pessoais", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue({
      id: 7,
      displayName: "Pessoa Teste",
      login: "pessoa.teste",
      role: "member",
    });
  });

  it("deriva o proprietário do perfil da sessão e ignora userId enviado", async () => {
    const formData = new FormData();
    formData.set("userId", "999");
    formData.set("displayName", "Nome Atualizado");
    formData.set("locale", "en");

    await updateProfileAction(formData);

    expect(mocks.updateOwnProfile).toHaveBeenCalledWith(7, {
      displayName: "Nome Atualizado",
      locale: "en",
    });
  });

  it("deriva o proprietário do atalho da sessão", async () => {
    const formData = new FormData();
    formData.set("userId", "999");
    formData.set("id", "42");
    formData.set("name", "Atalho pessoal");
    formData.set("url", "https://example.test");

    await updatePersonalShortcutAction(formData);

    expect(mocks.updateUserShortcut).toHaveBeenCalledWith(7, 42, {
      name: "Atalho pessoal",
      url: "https://example.test",
      icon: null,
    });
  });
});
