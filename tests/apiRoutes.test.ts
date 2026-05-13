import { describe, expect, it, vi, afterEach } from "vitest";
import { POST as generatePost } from "@/app/api/ai/generate/route";
import { POST as editPost } from "@/app/api/ai/edit/route";

const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l8yYPwAAAABJRU5ErkJggg==";

describe("rotas de IA", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gera imagem em modo mock", async () => {
    vi.stubEnv("MOCK_OPENAI_IMAGES", "true");
    const response = await generatePost(new Request("http://localhost/api/ai/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "uma casa no lago" })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ revisedPrompt: "Mock: uma casa no lago" });
  });

  it("retorna erro para payload invalido", async () => {
    const response = await generatePost(new Request("http://localhost/api/ai/generate", {
      method: "POST",
      body: JSON.stringify({ prompt: "" })
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("Descreva") });
  });

  it("edita imagem em modo mock", async () => {
    vi.stubEnv("MOCK_OPENAI_IMAGES", "true");
    const response = await editPost(new Request("http://localhost/api/ai/edit", {
      method: "POST",
      body: JSON.stringify({ prompt: "adicione luz", image })
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ image });
  });
});
