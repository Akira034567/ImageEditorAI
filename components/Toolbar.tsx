"use client";

import { Circle, Eraser, MousePointer2, Pencil, Square, Type } from "lucide-react";
import { useEditorStore } from "@/lib/editorStore";
import type { Tool } from "@/lib/types";

const tools: Array<{ id: Tool; label: string; icon: React.ReactNode }> = [
  { id: "select", label: "Selecionar", icon: <MousePointer2 size={18} /> },
  { id: "draw", label: "Desenhar anotacao", icon: <Pencil size={18} /> },
  { id: "rect", label: "Retangulo de anotacao", icon: <Square size={18} /> },
  { id: "circle", label: "Circulo de anotacao", icon: <Circle size={18} /> },
  { id: "text", label: "Texto", icon: <Type size={18} /> },
  { id: "eraser", label: "Borracha", icon: <Eraser size={18} /> }
];

export function Toolbar() {
  const { tool, setTool, status, error } = useEditorStore();

  return (
    <div className="toolbar">
      <div className="tool-row" aria-label="Ferramentas">
        {tools.map((item) => (
          <button
            key={item.id}
            className={`icon-button ${tool === item.id ? "active" : ""}`}
            title={item.label}
            aria-label={item.label}
            onClick={() => setTool(item.id)}
          >
            {item.icon}
          </button>
        ))}
      </div>
      <div className={`status ${error ? "error" : ""}`}>{error ?? status}</div>
    </div>
  );
}
