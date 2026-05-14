import OpenAI from "openai";
import { deflateSync } from "node:zlib";
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
  return new OpenAI({ apiKey: getApiKey() });
}

function readBase64(dataUrl: string) {
  return dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
}

export async function generateImage({ prompt, model, size, quality, background }: ImageRequest) {
  if (!prompt.trim()) throw new Error("Descreva a imagem antes de chamar a IA.");
  if (process.env.MOCK_OPENAI_IMAGES === "true") {
    return { image: transparentPixel, revisedPrompt: `Mock: ${prompt}` };
  }

  const modelInfo = getImageModel(model ?? process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL);
  if (modelInfo.provider === "google") {
    return generateGoogleImage({ prompt, model: modelInfo.id, size });
  }

  const client = getClient();
  const options = normalizeImageOptions({ model, size, quality, background }, "generate");
  const response = await client.images
    .generate({
      model: options.model,
      prompt,
      ...options.parameters
    })
    .catch((error) => {
      throw formatOpenAIError(error, "geracao");
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
  const modelInfo = getImageModel(model ?? process.env.OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL);
  if (modelInfo.provider === "google") {
    if (!modelInfo.supportsEdit) throw new Error(`${modelInfo.label} oferece apenas geracao texto-imagem. Use um modelo Nano Banana para editar.`);
    return generateGoogleImage({ prompt: buildEditPrompt(prompt, Boolean(mask)), model: modelInfo.id, size, image });
  }

  const options = normalizeImageOptions({ model, size, quality, background }, "edit");
  if (process.env.MOCK_OPENAI_IMAGES === "true") {
    return { image, revisedPrompt: `Mock edit: ${prompt}` };
  }

  const apiKey = getApiKey();
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: createEditForm({
      prompt: buildEditPrompt(prompt, Boolean(mask)),
      model: options.model,
      parameters: options.parameters,
      image,
      mask: mask ?? createFullEditMask(image)
    })
  });

  if (!response.ok) {
    throw await formatOpenAIFetchError(response, "edicao");
  }

  const payload = (await response.json()) as { data?: Array<{ b64_json?: string; revised_prompt?: string }> };
  const first = payload.data?.[0];
  if (!first?.b64_json) throw new Error("A OpenAI nao retornou uma imagem editada.");

  return {
    image: `data:image/png;base64,${first.b64_json}`,
    revisedPrompt: first.revised_prompt
  };
}

type OpenAIErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
    param?: string | null;
  };
};

async function formatOpenAIFetchError(response: Response, action: "geracao" | "edicao") {
  const detail = await response.text();
  const requestId = response.headers.get("x-request-id");

  try {
    const payload = JSON.parse(detail) as OpenAIErrorPayload;
    return formatOpenAIErrorPayload(payload, action, requestId);
  } catch {
    return new Error(`Falha na ${action} da OpenAI: ${detail}`);
  }
}

function formatOpenAIError(error: unknown, action: "geracao" | "edicao") {
  if (typeof error === "object" && error) {
    const payload = {
      error: {
        message: "message" in error ? String(error.message) : undefined,
        type: "type" in error ? String(error.type) : undefined,
        code: "code" in error ? String(error.code) : undefined,
        param: "param" in error && typeof error.param === "string" ? error.param : null
      }
    };
    const requestId = "request_id" in error && typeof error.request_id === "string" ? error.request_id : undefined;
    return formatOpenAIErrorPayload(payload, action, requestId);
  }

  return new Error(`Falha na ${action} da OpenAI.`);
}

function formatOpenAIErrorPayload(payload: OpenAIErrorPayload, action: "geracao" | "edicao", requestId?: string | null) {
  const code = payload.error?.code;
  const message = payload.error?.message ?? "Erro desconhecido da OpenAI.";
  const suffix = requestId ? ` ID da requisicao: ${requestId}.` : "";

  if (code === "moderation_blocked") {
    return new Error(
      `A OpenAI processou a imagem, mas bloqueou esta ${action} pelo sistema de seguranca. Isso pode acontecer por conteudo protegido, personagens/marcas reconheciveis, rostos, partes sensiveis ou pedidos ambiguos. Tente ocultar/remover camadas problematicas, marcar uma area menor ou usar um prompt mais neutro e especifico.${suffix}`
    );
  }

  if (code === "invalid_api_key") {
    return new Error("A chave da OpenAI foi recusada. Verifique OPENAI_API_KEY no .env.local e reinicie o servidor.");
  }

  return new Error(`Falha na ${action} da OpenAI: ${message}${suffix}`);
}

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY nao configurada. Crie um .env.local a partir de .env.example e reinicie o servidor.");
  }
  return apiKey;
}

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nao configurada. Crie uma chave no Google AI Studio, coloque no .env.local e reinicie o servidor.");
  }
  return apiKey;
}

async function generateGoogleImage(request: { prompt: string; model: ImageModelId; size?: ImageRequest["size"]; image?: string }) {
  const modelInfo = getImageModel(request.model);
  if (modelInfo.id.startsWith("imagen-")) {
    if (request.image) throw new Error(`${modelInfo.label} oferece apenas geracao texto-imagem. Use Nano Banana para editar imagens.`);
    return generateImagenImage(request);
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelInfo.id}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": getGeminiApiKey(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: createGeminiParts(request.prompt, request.image)
        }
      ],
      generationConfig: createGeminiGenerationConfig(modelInfo.id, request.size)
    })
  });

  if (!response.ok) throw await formatGoogleFetchError(response, "Google Gemini");

  const payload = (await response.json()) as GoogleGenerateContentResponse;
  const inline = findGeminiInlineImage(payload);
  if (!inline?.data) throw new Error("O Google Gemini nao retornou uma imagem.");
  return {
    image: `data:${inline.mimeType ?? "image/png"};base64,${inline.data}`,
    revisedPrompt: findGeminiText(payload)
  };
}

async function generateImagenImage(request: { prompt: string; model: ImageModelId; size?: ImageRequest["size"] }) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${request.model}:predict`, {
    method: "POST",
    headers: {
      "x-goog-api-key": getGeminiApiKey(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      instances: [{ prompt: request.prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: googleAspectRatio(request.size),
        imageSize: "1K"
      }
    })
  });

  if (!response.ok) throw await formatGoogleFetchError(response, "Google Imagen");

  const payload = (await response.json()) as GoogleImagenResponse;
  const base64 = payload.predictions?.[0]?.bytesBase64Encoded ?? payload.predictions?.[0]?.image?.bytesBase64Encoded;
  if (!base64) throw new Error("O Google Imagen nao retornou uma imagem.");
  return {
    image: `data:image/png;base64,${base64}`
  };
}

function createGeminiParts(prompt: string, image?: string) {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }];
  if (image) {
    parts.push({
      inlineData: {
        mimeType: image.match(/data:(.*?);base64/)?.[1] ?? "image/png",
        data: readBase64(image)
      }
    });
  }
  return parts;
}

function createGeminiGenerationConfig(model: ImageModelId, size?: ImageRequest["size"]) {
  const aspectRatio = googleAspectRatio(size);
  if (!aspectRatio) return undefined;
  const imageConfig: Record<string, string> = { aspectRatio };
  if (model === "gemini-3.1-flash-image-preview" || model === "gemini-3-pro-image-preview") {
    imageConfig.imageSize = "1K";
  }
  return {
    responseFormat: {
      image: imageConfig
    }
  };
}

function googleAspectRatio(size?: ImageRequest["size"]) {
  if (size === "1024x1536") return "2:3";
  if (size === "1536x1024") return "3:2";
  if (size === "1024x1024") return "1:1";
  return undefined;
}

async function formatGoogleFetchError(response: Response, provider: string) {
  const detail = await response.text();
  try {
    const payload = JSON.parse(detail) as { error?: { message?: string; status?: string } };
    return new Error(`${provider} retornou erro: ${payload.error?.message ?? detail}`);
  } catch {
    return new Error(`${provider} retornou erro: ${detail}`);
  }
}

type GoogleGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
};

type GoogleImagenResponse = {
  predictions?: Array<{
    bytesBase64Encoded?: string;
    image?: {
      bytesBase64Encoded?: string;
    };
  }>;
};

function findGeminiInlineImage(payload: GoogleGenerateContentResponse) {
  return payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).find((part) => part.inlineData)?.inlineData;
}

function findGeminiText(payload: GoogleGenerateContentResponse) {
  return payload.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).find((part) => part.text)?.text;
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

function buildEditPrompt(prompt: string, hasMask: boolean) {
  if (!hasMask) {
    return `Edit the provided image according to this instruction. Preserve the existing composition, style, aspect ratio, and all unchanged details. Do not create a new standalone graphic unless explicitly asked. Instruction: ${prompt}`;
  }

  return `Return the full edited image, not a crop and not a standalone symbol. Edit only the transparent area of the mask in the provided image. The transparent masked area is the target selected by the user. Preserve every unmasked pixel and the original composition, calendar layout, paper texture, borders, background, typography style, and all other numbers/text. If the instruction says circled, marked, selected, or highlighted, interpret that as the transparent masked area, not as something to draw. Instruction: ${prompt}`;
}

function createEditForm(request: {
  prompt: string;
  model: ImageModelId;
  parameters: Record<string, string>;
  image: string;
  mask?: string;
}) {
  const form = new FormData();
  form.append("model", request.model);
  form.append("prompt", request.prompt);
  Object.entries(request.parameters).forEach(([key, value]) => form.append(key, value));
  form.append("image", base64ToBlob(request.image), "image.png");
  if (request.mask) form.append("mask", base64ToBlob(request.mask), "mask.png");
  return form;
}

function base64ToBlob(dataUrl: string) {
  const mime = dataUrl.match(/data:(.*?);base64/)?.[1] ?? "image/png";
  const bytes = Buffer.from(readBase64(dataUrl), "base64");
  return new Blob([bytes], { type: mime });
}

function createFullEditMask(imageDataUrl: string) {
  const imageBytes = Buffer.from(readBase64(imageDataUrl), "base64");
  const size = readPngSize(imageBytes);
  if (!size) return undefined;
  return createTransparentPngDataUrl(size.width, size.height);
}

function readPngSize(bytes: Buffer) {
  const pngSignature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== pngSignature || bytes.length < 24) return undefined;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20)
  };
}

function createTransparentPngDataUrl(width: number, height: number) {
  const png = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", createIhdr(width, height)),
    pngChunk("IDAT", zlibSyncTransparentRows(width, height)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function createIhdr(width: number, height: number) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = 8;
  data[9] = 6;
  data[10] = 0;
  data[11] = 0;
  data[12] = 0;
  return data;
}

function zlibSyncTransparentRows(width: number, height: number) {
  const rowLength = width * 4 + 1;
  return deflateSync(Buffer.alloc(rowLength * height));
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
