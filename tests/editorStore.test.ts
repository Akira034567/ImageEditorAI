import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/lib/editorStore";
import type { TextLayer } from "@/lib/types";

function makeTextLayer(id = "layer-1"): TextLayer {
  return {
    id,
    kind: "text",
    name: "Texto",
    visible: true,
    locked: false,
    text: "Ola",
    x: 10,
    y: 20,
    fontSize: 32,
    fill: "#000000",
    rotation: 0,
    opacity: 1
  };
}

describe("editor store", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it("adiciona, seleciona e remove camadas", () => {
    const layer = makeTextLayer();
    useEditorStore.getState().addLayer(layer);
    useEditorStore.getState().setSelectedLayer(layer.id);

    expect(useEditorStore.getState().document.layers).toHaveLength(1);
    expect(useEditorStore.getState().selectedLayerId).toBe(layer.id);

    useEditorStore.getState().removeLayer(layer.id);
    expect(useEditorStore.getState().document.layers).toHaveLength(0);
  });

  it("ordena camadas para cima e para baixo", () => {
    useEditorStore.getState().addLayer(makeTextLayer("a"));
    useEditorStore.getState().addLayer(makeTextLayer("b"));

    useEditorStore.getState().moveLayer("a", "up");
    expect(useEditorStore.getState().document.layers.map((layer) => layer.id)).toEqual(["b", "a"]);

    useEditorStore.getState().moveLayer("a", "down");
    expect(useEditorStore.getState().document.layers.map((layer) => layer.id)).toEqual(["a", "b"]);
  });

  it("desfaz e refaz alteracoes", () => {
    useEditorStore.getState().addLayer(makeTextLayer("a"));
    useEditorStore.getState().updateLayer("a", { text: "Depois" });
    expect(useEditorStore.getState().document.layers[0]).toMatchObject({ text: "Depois" });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.layers[0]).toMatchObject({ text: "Ola" });

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().document.layers[0]).toMatchObject({ text: "Depois" });
  });

  it("serializa e hidrata projetos", () => {
    useEditorStore.getState().addLayer(makeTextLayer("a"));
    const project = useEditorStore.getState().serialize();

    useEditorStore.getState().reset();
    useEditorStore.getState().hydrate(project);

    expect(useEditorStore.getState().document.layers[0].id).toBe("a");
    expect(useEditorStore.getState().settings.model).toBe("gpt-image-1.5");
  });

  it("guarda historico de prompts e respostas da IA", () => {
    useEditorStore.getState().rememberPrompt("adicione uma borboleta");
    useEditorStore.getState().rememberPrompt("adicione uma borboleta");
    useEditorStore.getState().addAiResult(
      { image: "data:image/png;base64,abc", revisedPrompt: "borboleta" },
      { prompt: "adicione uma borboleta", action: "edit", model: "gpt-image-1.5" }
    );

    expect(useEditorStore.getState().document.promptHistory).toEqual(["adicione uma borboleta"]);
    expect(useEditorStore.getState().document.aiHistory).toHaveLength(1);

    const id = useEditorStore.getState().document.aiHistory[0].id;
    useEditorStore.getState().restoreAiResult(id);
    expect(useEditorStore.getState().pendingResult?.image).toBe("data:image/png;base64,abc");
    expect(useEditorStore.getState().prompt).toBe("adicione uma borboleta");
  });

  it("mostra imagem base de projetos antigos como camada editavel", () => {
    const project = useEditorStore.getState().serialize();
    useEditorStore.getState().hydrate({
      ...project,
      document: {
        ...project.document,
        baseImage: "data:image/png;base64,base",
        layers: [],
        width: 640,
        height: 480
      }
    });

    expect(useEditorStore.getState().document.layers[0]).toMatchObject({
      id: "__base__",
      kind: "image",
      name: "Base",
      locked: false,
      width: 640,
      height: 480
    });
  });

  it("redimensiona o documento com limites seguros", () => {
    useEditorStore.getState().resizeDocument(1920, 1080);
    expect(useEditorStore.getState().document).toMatchObject({ width: 1920, height: 1080 });

    useEditorStore.getState().resizeDocument(8, 99999);
    expect(useEditorStore.getState().document).toMatchObject({ width: 64, height: 8192 });
  });
});
