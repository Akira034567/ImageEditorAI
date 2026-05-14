import OpenAI from "openai";
import { DEFAULT_IMAGE_MODEL, getImageModel, type ImageModelId } from "@/lib/imageModels";

export type ImageRequest = {
  prompt: string;
  model?: ImageModelId;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality?: "auto" | "low" | "medium" | "high";
  background?: "auto" | "transparent" | "opaque";
  image?: string;
  mask?: string;
};

const transparentPixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l8yYPwAAAABJRU5ErkJggg==";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada. Crie um .env.local a partir de .env.example.");
  }
  return new OpenAI({ apiKey });
}

function readBase64(dataUrl: string) {
  return dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
}

export async function generateImage({ prompt, model, size, quality, background }: ImageRequest) {
  if (!prompt.trim()) throw new Error("Descreva a imagem antes de chamar a IA.");
  if (process.env.MOCK_OPENAI_IMAGES === "true") {
    return { image: transparentPixel, revisedPrompt: `Mock: ${prompt}` };
  }

  const client = getClient();
  const options = normalizeImageOptions({ model, size, quality, background }, "generate");
  const response = await client.images.generate({
    model: options.model,
    prompt,
    ...options.parameters
  });
  const first = response.data?.[0];
  if (!first?.b64_json) throw new Error("A OpenAI nao retornou uma imagem.");

  return {
    image: `data:image/png;base64,${first.b64_json}`,
    revisedPrompt: first.revised_prompt
  };
}

export async function editImage({ prompt, model, size, quality, background, image, mask }: ImageRequest) {
  if (!prompt.trim()) throw new Error("Descreva a edicao antes de chamar a IA.");
  if (!image) throw new Error("Envie uma imagem para editar.");
  const options = normalizeImageOptions({ model, size, quality, background }, "edit");
  if (process.env.MOCK_OPENAI_IMAGES === "true") {
    return { image, revisedPrompt: `Mock edit: ${prompt}` };
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: createEditForm({
      prompt,
      model: options.model,
      parameters: options.parameters,
      image,
      mask
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha na edicao da OpenAI: ${detail}`);
  }

  const payload = (await response.json()) as { data?: Array<{ b64_json?: string; revised_prompt?: string }> };
  const first = payload.data?.[0];
  if (!first?.b64_json) throw new Error("A OpenAI nao retornou uma imagem editada.");

  return {
    image: `data:image/png;base64,${first.b64_json}`,
    revisedPrompt: first.revised_prompt
  };
}

function normalizeImageOptions(
  request: Pick<ImageRequest, "model" | "size" | "quality" | "background">,
  action: "generate" | "edit"
) {
  const requestedModel = request.model ?? process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
  const modelInfo = getImageModel(requestedModel);
  if (action === "edit" && !modelInfo.supportsEdit) {
    throw new Error(`${modelInfo.label} nao oferece edicao de imagem. Selecione GPT Image 1.5, GPT Image 1, GPT Image 1 Mini ou DALL-E 2.`);
  }

  const parameters: Record<string, string> = {};
  if (request.size && request.size !== "auto") parameters.size = request.size;

  if (modelInfo.id.startsWith("gpt-image") || modelInfo.id === "chatgpt-image-latest") {
    parameters.quality = request.quality ?? "auto";
    parameters.background = modelInfo.supportsTransparentBackground ? request.background ?? "auto" : "auto";
  } else if (modelInfo.id === "dall-e-3") {
    parameters.quality = request.quality === "high" ? "hd" : "standard";
  }

  return {
    model: modelInfo.id,
    parameters
  };
}

function createEditForm(request: { prompt: string; model: ImageModelId; parameters: Record<string, string>; image: string; mask?: string }) {
  const form = new FormData();
  form.append("model", request.model);
  form.append("prompt", request.prompt);
  Object.entries(request.parameters).forEach(([key, value]) => form.append(key, value));
  form.append("image", base64ToFile(request.image, "image.png"));
  if (request.mask) form.append("mask", base64ToFile(request.mask, "mask.png"));
  return form;
}

function base64ToFile(dataUrl: string, filename: string) {
  const mime = dataUrl.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const bytes = Buffer.from(readBase64(dataUrl), "base64");
  return new File([bytes], filename, { type: mime });
}
