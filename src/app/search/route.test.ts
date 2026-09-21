import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authorization", () => ({
  requireAuthenticatedUser: vi.fn().mockResolvedValue({
    id: 1,
    displayName: "Usuário Teste",
    login: "teste",
    role: "member",
  }),
}));

import { GET } from "./route";

describe("GET /search", () => {
  it("redireciona uma consulta para o Google", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/search?q=redes+de+computadores"),
    );
    const destination = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(destination.origin).toBe("https://www.google.com");
    expect(destination.searchParams.get("q")).toBe("redes de computadores");
  });

  it("retorna à Home quando a consulta está vazia", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3000/search?q="),
    );

    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/?search=empty",
    );
  });
});
