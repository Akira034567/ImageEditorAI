export type ImageModelId =
  | "gpt-image-2"
  | "gpt-image-1.5"
  | "chatgpt-image-latest"
  | "gpt-image-1"
  | "gpt-image-1-mini"
  | "dall-e-3"
  | "dall-e-2";

export type ImageModelOption = {
  id: ImageModelId;
  label: string;
  description: string;
  supportsEdit: boolean;
  supportsTransparentBackground: boolean;
};

export const DEFAULT_IMAGE_MODEL: ImageModelId = "gpt-image-1.5";

export const IMAGE_MODELS: ImageModelOption[] = [
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    description: "Opcao experimental: use somente se a sua conta/API reconhecer este modelo.",
    supportsEdit: true,
    supportsTransparentBackground: true
  },
  {
    id: "gpt-image-1.5",
    label: "GPT Image 1.5",
    description: "Mais avancado para geracao de imagens.",
    supportsEdit: true,
    supportsTransparentBackground: true
  },
  {
    id: "chatgpt-image-latest",
    label: "ChatGPT Image Latest",
    description: "Snapshot de imagem usado no ChatGPT.",
    supportsEdit: true,
    supportsTransparentBackground: true
  },
  {
    id: "gpt-image-1",
    label: "GPT Image 1",
    description: "Modelo anterior da familia GPT Image.",
    supportsEdit: true,
    supportsTransparentBackground: true
  },
  {
    id: "gpt-image-1-mini",
    label: "GPT Image 1 Mini",
    description: "Opcao mais economica da familia GPT Image.",
    supportsEdit: true,
    supportsTransparentBackground: true
  },
  {
    id: "dall-e-3",
    label: "DALL-E 3",
    description: "Geracao apenas; sem edicao por mascara.",
    supportsEdit: false,
    supportsTransparentBackground: false
  },
  {
    id: "dall-e-2",
    label: "DALL-E 2",
    description: "Legado com geracao, edicao e variacoes.",
    supportsEdit: true,
    supportsTransparentBackground: false
  }
];

export function getImageModel(id?: string) {
  return IMAGE_MODELS.find((model) => model.id === id) ?? IMAGE_MODELS[0];
}
