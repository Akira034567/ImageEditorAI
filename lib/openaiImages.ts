import OpenAI from "openai";

export type ImageRequest = {
  prompt: string;
  model?: string;
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
  const response = await client.images.generate({
    model: model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5",
    prompt,
    size: size ?? "1024x1024",
    quality: quality ?? "auto",
    background: background ?? "auto"
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
      model: model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5",
      size: size ?? "1024x1024",
      quality: quality ?? "auto",
      background: background ?? "auto",
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

function createEditForm(request: Required<Pick<ImageRequest, "prompt" | "model" | "size" | "quality" | "background" | "image">> & Pick<ImageRequest, "mask">) {
  const form = new FormData();
  form.append("model", request.model);
  form.append("prompt", request.prompt);
  form.append("size", request.size);
  form.append("quality", request.quality);
  form.append("background", request.background);
  form.append("image", base64ToFile(request.image, "image.png"));
  if (request.mask) form.append("mask", base64ToFile(request.mask, "mask.png"));
  return form;
}

function base64ToFile(dataUrl: string, filename: string) {
  const mime = dataUrl.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const bytes = Buffer.from(readBase64(dataUrl), "base64");
  return new File([bytes], filename, { type: mime });
}
