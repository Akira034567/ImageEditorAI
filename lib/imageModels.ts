export type ImageModelId =
  | "gpt-image-2"
  | "gpt-image-1.5"
  | "chatgpt-image-latest"
  | "gpt-image-1"
  | "gpt-image-1-mini"
  | "dall-e-3"
  | "dall-e-2"
  | "gemini-3.1-flash-image-preview"
  | "gemini-3-pro-image-preview"
  | "gemini-2.5-flash-image"
  | "imagen-4.0-generate-001"
  | "imagen-4.0-ultra-generate-001"
  | "imagen-4.0-fast-generate-001";

export type ImageModelOption = {
  id: ImageModelId;
  label: string;
  description: string;
  provider: "openai" | "google";
  supportsEdit: boolean;
  supportsTransparentBackground: boolean;
};

export const DEFAULT_IMAGE_MODEL: ImageModelId = "gpt-image-1.5";

export const IMAGE_MODELS: ImageModelOption[] = [
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    description: "Opcao experimental: use somente se a sua conta/API reconhecer este modelo.",
    provider: "openai",
    supportsEdit: true,
    supportsTransparentBackground: true
  },
  {
    id: "gpt-image-1.5",
    label: "GPT Image 1.5",
    description: "Mais avancado para geracao de imagens.",
    provider: "openai",
    supportsEdit: true,
    supportsTransparentBackground: true
  },
  {
    id: "chatgpt-image-latest",
    label: "ChatGPT Image Latest",
    description: "Snapshot de imagem usado no ChatGPT.",
    provider: "openai",
    supportsEdit: true,
    supportsTransparentBackground: true
  },
  {
    id: "gpt-image-1",
    label: "GPT Image 1",
    description: "Modelo anterior da familia GPT Image.",
    provider: "openai",
    supportsEdit: true,
    supportsTransparentBackground: true
  },
  {
    id: "gpt-image-1-mini",
    label: "GPT Image 1 Mini",
    description: "Opcao mais economica da familia GPT Image.",
    provider: "openai",
    supportsEdit: true,
    supportsTransparentBackground: true
  },
  {
    id: "dall-e-3",
    label: "DALL-E 3",
    description: "Geracao apenas; sem edicao por mascara.",
    provider: "openai",
    supportsEdit: false,
    supportsTransparentBackground: false
  },
  {
    id: "dall-e-2",
    label: "DALL-E 2",
    description: "Legado com geracao, edicao e variacoes.",
    provider: "openai",
    supportsEdit: true,
    supportsTransparentBackground: false
  },
  {
    id: "gemini-3.1-flash-image-preview",
    label: "Google Nano Banana 2",
    description: "Gemini 3.1 Flash Image Preview: melhor equilibrio geral entre desempenho, custo e latencia.",
    provider: "google",
    supportsEdit: true,
    supportsTransparentBackground: false
  },
  {
    id: "gemini-3-pro-image-preview",
    label: "Google Nano Banana Pro",
    description: "Gemini 3 Pro Image Preview: recursos profissionais, instrucoes complexas e maior fidelidade.",
    provider: "google",
    supportsEdit: true,
    supportsTransparentBackground: false
  },
  {
    id: "gemini-2.5-flash-image",
    label: "Google Nano Banana",
    description: "Gemini 2.5 Flash Image: rapido e eficiente para baixa latencia.",
    provider: "google",
    supportsEdit: true,
    supportsTransparentBackground: false
  },
  {
    id: "imagen-4.0-generate-001",
    label: "Google Imagen 4",
    description: "Imagen 4 Standard: geracao texto-imagem de alta qualidade.",
    provider: "google",
    supportsEdit: false,
    supportsTransparentBackground: false
  },
  {
    id: "imagen-4.0-ultra-generate-001",
    label: "Google Imagen 4 Ultra",
    description: "Imagen 4 Ultra: melhor qualidade para geracao, uma imagem por vez.",
    provider: "google",
    supportsEdit: false,
    supportsTransparentBackground: false
  },
  {
    id: "imagen-4.0-fast-generate-001",
    label: "Google Imagen 4 Fast",
    description: "Imagen 4 Fast: geracao texto-imagem otimizada para velocidade.",
    provider: "google",
    supportsEdit: false,
    supportsTransparentBackground: false
  }
];

export function getImageModel(id?: string) {
  return IMAGE_MODELS.find((model) => model.id === id) ?? IMAGE_MODELS[0];
}
