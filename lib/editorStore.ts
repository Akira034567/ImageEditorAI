"use client";

import { create } from "zustand";
import { v4 as uuid } from "uuid";
import { DEFAULT_IMAGE_MODEL } from "@/lib/imageModels";
import type { AiHistoryItem, AiResult, AiSettings, EditorDocument, EditorLayer, SerializedProject, Tool } from "@/lib/types";

type Snapshot = Pick<EditorDocument, "baseImage" | "layers" | "width" | "height" | "name">;
type AiAction = AiHistoryItem["action"];
export const BASE_LAYER_ID = "__base__";

type EditorState = {
  document: EditorDocument;
  selectedLayerId?: string;
  tool: Tool;
  zoom: number;
  pan: { x: number; y: number };
  prompt: string;
  settings: AiSettings;
  pendingResult?: AiResult;
  aiJob?: {
    action: AiAction;
    label: string;
    startedAt: number;
  };
  status: string;
  error?: string;
  history: Snapshot[];
  future: Snapshot[];
  setTool: (tool: Tool) => void;
  setPrompt: (prompt: string) => void;
  rememberPrompt: (prompt: string) => void;
  setStatus: (status: string) => void;
  setError: (error?: string) => void;
  setSettings: (settings: Partial<AiSettings>) => void;
  setSelectedLayer: (id?: string) => void;
  renameDocument: (name: string) => void;
  resizeDocument: (width: number, height: number) => void;
  setBaseImage: (src: string, width?: number, height?: number) => void;
  addLayer: (layer: EditorLayer) => void;
  updateLayer: (id: string, patch: Partial<EditorLayer>) => void;
  removeLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  moveLayer: (id: string, direction: "up" | "down") => void;
  toggleLayerVisible: (id: string) => void;
  toggleLayerLocked: (id: string) => void;
  undo: () => void;
  redo: () => void;
  setPendingResult: (result?: AiResult) => void;
  startAiJob: (job: { action: AiAction; label: string }) => void;
  finishAiJob: () => void;
  addAiResult: (result: AiResult, meta: { prompt: string; action: AiAction; model: string }) => void;
  restoreAiResult: (id: string) => void;
  applyPendingAsBase: () => void;
  applyPendingAsLayer: () => void;
  serialize: () => SerializedProject;
  hydrate: (project: SerializedProject) => void;
  reset: () => void;
};

const now = Date.now();

function createDocument(): EditorDocument {
  return {
    id: uuid(),
    name: "Projeto sem titulo",
    width: 1024,
    height: 1024,
    layers: [],
    aiHistory: [],
    promptHistory: [],
    createdAt: now,
    updatedAt: now
  };
}

const defaultSettings: AiSettings = {
  model: DEFAULT_IMAGE_MODEL,
  size: "1024x1024",
  quality: "auto",
  background: "auto"
};

function snapshot(document: EditorDocument): Snapshot {
  return {
    baseImage: document.baseImage,
    layers: structuredClone(document.layers),
    width: document.width,
    height: document.height,
    name: document.name
  };
}

function restore(document: EditorDocument, snap: Snapshot): EditorDocument {
  return {
    ...document,
    ...snap,
    layers: structuredClone(snap.layers),
    updatedAt: Date.now()
  };
}

function withHistory(state: EditorState, document: EditorDocument) {
  return {
    document: { ...document, updatedAt: Date.now() },
    history: [...state.history, snapshot(state.document)].slice(-80),
    future: [],
    error: undefined
  };
}

function createBaseLayer(src: string, width: number, height: number): EditorLayer {
  return {
    id: BASE_LAYER_ID,
    kind: "image",
    name: "Base",
    visible: true,
    locked: false,
    src,
    x: 0,
    y: 0,
    width,
    height,
    rotation: 0,
    opacity: 1
  };
}

function migrateDocument(document: EditorDocument): EditorDocument {
  if (!document.baseImage || document.layers.some((layer) => layer.id === BASE_LAYER_ID)) {
    return {
      ...document,
      aiHistory: document.aiHistory ?? [],
      promptHistory: document.promptHistory ?? []
    };
  }

  return {
    ...document,
    layers: [createBaseLayer(document.baseImage, document.width, document.height), ...document.layers],
    aiHistory: document.aiHistory ?? [],
    promptHistory: document.promptHistory ?? []
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: createDocument(),
  tool: "select",
  zoom: 1,
  pan: { x: 0, y: 0 },
  prompt: "",
  settings: defaultSettings,
  status: "Pronto",
  history: [],
  future: [],
  setTool: (tool) => set({ tool }),
  setPrompt: (prompt) => set({ prompt }),
  rememberPrompt: (prompt) =>
    set((state) => {
      const trimmed = prompt.trim();
      if (!trimmed) return state;
      const promptHistory = [trimmed, ...state.document.promptHistory.filter((item) => item !== trimmed)].slice(0, 80);
      return {
        document: {
          ...state.document,
          promptHistory,
          updatedAt: Date.now()
        }
      };
    }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error, status: error ? "Algo deu errado" : get().status }),
  setSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
  setSelectedLayer: (selectedLayerId) => set({ selectedLayerId }),
  renameDocument: (name) =>
    set((state) =>
      withHistory(state, {
        ...state.document,
        name: name.trim() || "Projeto sem titulo"
      })
    ),
  resizeDocument: (width, height) =>
    set((state) => {
      const nextWidth = clampDocumentSize(width);
      const nextHeight = clampDocumentSize(height);
      return withHistory(state, {
        ...state.document,
        width: nextWidth,
        height: nextHeight
      });
    }),
  setBaseImage: (src, width, height) =>
    set((state) => {
      const nextWidth = width ?? state.document.width;
      const nextHeight = height ?? state.document.height;
      const baseLayer = createBaseLayer(src, nextWidth, nextHeight);
      const layers = state.document.layers.some((layer) => layer.id === BASE_LAYER_ID)
        ? state.document.layers.map((layer) => (layer.id === BASE_LAYER_ID ? baseLayer : layer))
        : [baseLayer, ...state.document.layers];

      return withHistory(state, {
        ...state.document,
        baseImage: src,
        width: nextWidth,
        height: nextHeight,
        layers
      });
    }),
  addLayer: (layer) =>
    set((state) =>
      withHistory(state, {
        ...state.document,
        layers: [...state.document.layers, layer]
      })
    ),
  updateLayer: (id, patch) =>
    set((state) => {
      const nextLayers = state.document.layers.map((layer) =>
        layer.id === id ? ({ ...layer, ...patch } as EditorLayer) : layer
      );
      return withHistory(state, { ...state.document, layers: nextLayers });
    }),
  removeLayer: (id) =>
    set((state) =>
      withHistory(state, {
        ...state.document,
        layers: state.document.layers.filter((layer) => layer.id !== id)
      })
    ),
  duplicateLayer: (id) =>
    set((state) => {
      const layer = state.document.layers.find((item) => item.id === id);
      if (!layer) return state;
      const copy = {
        ...structuredClone(layer),
        id: uuid(),
        name: `${layer.name} copia`,
        x: "x" in layer ? layer.x + 24 : 24,
        y: "y" in layer ? layer.y + 24 : 24
      } as EditorLayer;
      return withHistory(state, { ...state.document, layers: [...state.document.layers, copy] });
    }),
  moveLayer: (id, direction) =>
    set((state) => {
      const layers = [...state.document.layers];
      const index = layers.findIndex((layer) => layer.id === id);
      const nextIndex = direction === "up" ? index + 1 : index - 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= layers.length) return state;
      [layers[index], layers[nextIndex]] = [layers[nextIndex], layers[index]];
      return withHistory(state, { ...state.document, layers });
    }),
  toggleLayerVisible: (id) =>
    set((state) => {
      const layer = state.document.layers.find((item) => item.id === id);
      if (!layer) return state;
      const layers = state.document.layers.map((item) => (item.id === id ? ({ ...item, visible: !item.visible } as EditorLayer) : item));
      return withHistory(state, { ...state.document, layers });
    }),
  toggleLayerLocked: (id) =>
    set((state) => {
      const layer = state.document.layers.find((item) => item.id === id);
      if (!layer) return state;
      const layers = state.document.layers.map((item) => (item.id === id ? ({ ...item, locked: !item.locked } as EditorLayer) : item));
      return withHistory(state, { ...state.document, layers });
    }),
  undo: () =>
    set((state) => {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return {
        document: restore(state.document, previous),
        history: state.history.slice(0, -1),
        future: [snapshot(state.document), ...state.future]
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        document: restore(state.document, next),
        history: [...state.history, snapshot(state.document)],
        future: state.future.slice(1)
      };
    }),
  setPendingResult: (pendingResult) => set({ pendingResult }),
  startAiJob: (job) =>
    set({
      aiJob: {
        ...job,
        startedAt: Date.now()
      },
      error: undefined
    }),
  finishAiJob: () => set({ aiJob: undefined }),
  addAiResult: (result, meta) =>
    set((state) => {
      const item: AiHistoryItem = {
        ...result,
        id: uuid(),
        prompt: meta.prompt.trim(),
        action: meta.action,
        model: meta.model,
        createdAt: Date.now()
      };
      return {
        pendingResult: result,
        document: {
          ...state.document,
          aiHistory: [item, ...state.document.aiHistory].slice(0, 60),
          updatedAt: Date.now()
        }
      };
    }),
  restoreAiResult: (id) =>
    set((state) => {
      const item = state.document.aiHistory.find((result) => result.id === id);
      return item
        ? {
            pendingResult: item,
            prompt: item.prompt,
            status: "Resposta da IA recuperada do historico",
            error: undefined
          }
        : state;
    }),
  applyPendingAsBase: () => {
    const result = get().pendingResult;
    if (!result) return;
    get().setBaseImage(result.image);
    set({ pendingResult: undefined, status: "Resultado aplicado na imagem base" });
  },
  applyPendingAsLayer: () => {
    const result = get().pendingResult;
    if (!result) return;
    get().addLayer({
      id: uuid(),
      kind: "image",
      name: "Elemento IA",
      visible: true,
      locked: false,
      src: result.image,
      x: 120,
      y: 120,
      width: 360,
      height: 360,
      rotation: 0,
      opacity: 1
    });
    set({ pendingResult: undefined, status: "Resultado inserido como camada" });
  },
  serialize: () => ({
    version: 1,
    document: get().document,
    settings: get().settings
  }),
  hydrate: (project) =>
    set({
      document: migrateDocument(project.document),
      settings: project.settings,
      selectedLayerId: undefined,
      pendingResult: undefined,
      aiJob: undefined,
      status: "Projeto carregado",
      history: [],
      future: []
    }),
  reset: () =>
    set({
      document: createDocument(),
      selectedLayerId: undefined,
      tool: "select",
      prompt: "",
      pendingResult: undefined,
      aiJob: undefined,
      status: "Novo projeto",
      error: undefined,
      history: [],
      future: []
    })
}));

function clampDocumentSize(value: number) {
  if (!Number.isFinite(value)) return 1024;
  return Math.round(Math.min(8192, Math.max(64, value)));
}
