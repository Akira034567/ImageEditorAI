"use client";

import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";
import { useEditorStore } from "@/lib/editorStore";

export function LayersPanel() {
  const {
    document,
    selectedLayerId,
    setSelectedLayer,
    resizeDocument,
    updateLayer,
    removeLayer,
    duplicateLayer,
    moveLayer,
    toggleLayerLocked,
    toggleLayerVisible
  } = useEditorStore();

  const layers = [...document.layers].reverse();

  function commitDocumentSize(axis: "width" | "height", value: string) {
    const numeric = Number(value);
    resizeDocument(axis === "width" ? numeric : document.width, axis === "height" ? numeric : document.height);
  }

  return (
    <>
      <section className="panel">
        <h2>Camadas</h2>
        <div className="layer-list">
          {layers.length === 0 ? (
            <p className="status">Importe uma imagem, desenhe anotacoes ou crie elementos com IA.</p>
          ) : (
            layers.map((layer) => (
              <div key={layer.id} className={`layer-item ${selectedLayerId === layer.id ? "selected" : ""}`}>
                <button className="icon-button" title="Selecionar camada" onClick={() => setSelectedLayer(layer.id)}>
                  {layer.kind[0].toUpperCase()}
                </button>
                <input
                  className="layer-name"
                  value={layer.name}
                  aria-label={`Nome da camada ${layer.name}`}
                  onFocus={() => setSelectedLayer(layer.id)}
                  onChange={(event) => updateLayer(layer.id, { name: event.target.value } as never)}
                />
                <div className="small-actions">
                  <button title="Mostrar/ocultar" onClick={() => toggleLayerVisible(layer.id)}>
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button title="Bloquear/desbloquear" onClick={() => toggleLayerLocked(layer.id)}>
                    {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button title="Subir" onClick={() => moveLayer(layer.id, "up")}>
                    <ArrowUp size={14} />
                  </button>
                  <button title="Descer" onClick={() => moveLayer(layer.id, "down")}>
                    <ArrowDown size={14} />
                  </button>
                  <button title="Duplicar" onClick={() => duplicateLayer(layer.id)}>
                    <Copy size={14} />
                  </button>
                  <button title="Excluir" onClick={() => removeLayer(layer.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <section className="panel">
        <h2>Documento</h2>
        <div className="field-row">
          <label className="field">
            Largura
            <input
              type="number"
              min={64}
              max={8192}
              step={1}
              value={document.width}
              onChange={(event) => commitDocumentSize("width", event.target.value)}
            />
          </label>
          <label className="field">
            Altura
            <input
              type="number"
              min={64}
              max={8192}
              step={1}
              value={document.height}
              onChange={(event) => commitDocumentSize("height", event.target.value)}
            />
          </label>
        </div>
      </section>
    </>
  );
}
