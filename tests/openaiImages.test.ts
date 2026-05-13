import { afterEach, describe, expect, it, vi } from "vitest";
import { generateImage, editImage } from "@/lib/openaiImages";

const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l8yYPwAAAABJRU5ErkJggg==";

describe("openai image helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retorna mock quando MOCK_OPENAI_IMAGES esta ativo", async () => {
    vi.stubEnv("MOCK_OPENAI_IMAGES", "true");

    await expect(generateImage({ prompt: "um farol" })).resolves.toMatchObject({
      revisedPrompt: "Mock: um farol"
    });
  });

  it("valida prompt na geracao", async () => {
    await expect(generateImage({ prompt: "  " })).rejects.toThrow("Descreva a imagem");
  });

  it("valida imagem na edicao", async () => {
    await expect(editImage({ prompt: "adicione uma borboleta" })).rejects.toThrow("Envie uma imagem");
  });

  it("edita em modo mock retornando a imagem enviada", async () => {
    vi.stubEnv("MOCK_OPENAI_IMAGES", "true");

    await expect(editImage({ prompt: "adicione uma borboleta", image })).resolves.toMatchObject({
      image,
      revisedPrompt: "Mock edit: adicione uma borboleta"
    });
  });
});
