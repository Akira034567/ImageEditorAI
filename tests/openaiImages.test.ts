import { afterEach, describe, expect, it, vi } from "vitest";
import { generateImage, editImage } from "@/lib/openaiImages";

const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l8yYPwAAAABJRU5ErkJggg==";

describe("openai image helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

  it("gera imagem com Google Gemini usando generateContent", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: "image/png", data: "abc" } }]
              }
            }
          ]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateImage({ prompt: "um farol", model: "gemini-3.1-flash-image-preview" })).resolves.toMatchObject({
      image: "data:image/png;base64,abc"
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("gemini-3.1-flash-image-preview:generateContent"), expect.any(Object));
  });

  it("gera imagem com Google Imagen usando predict", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          predictions: [{ bytesBase64Encoded: "abc" }]
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateImage({ prompt: "um farol", model: "imagen-4.0-generate-001" })).resolves.toMatchObject({
      image: "data:image/png;base64,abc"
    });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("imagen-4.0-generate-001:predict"), expect.any(Object));
  });
});
