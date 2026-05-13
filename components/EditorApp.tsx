"use client";

import { useEffect, useRef } from "react";
import { Download, FileJson, FolderOpen, ImagePlus, RotateCcw, RotateCw, Save } from "lucide-react";
import { CanvasStage, type CanvasStageHandle } from "@/components/CanvasStage";
import { LayersPanel } from "@/components/LayersPanel";
import { PromptPanel } from "@/components/PromptPanel";
import { Toolbar } from "@/components/Toolbar";
import { loadLatestProject, saveProject } from "@/lib/db";
import { downloadDataUrl, fileToDataUrl, safeJsonDownload } from "@/lib/imageUtils";
import { useEditorStore } from "@/lib/editorStore";
import type { SerializedProject } from "@/lib/types";

export function EditorApp() {
  const stageRef = useRef<CanvasStageHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const { document, undo, redo, history, future, serialize, hydrate, setBaseImage, setStatus, setError, reset } =
    useEditorStore();

  useEffect(() => {
    loadLatestProject()
      .then((project) => {
        if (project) hydrate(project);
      })
      .catch(() => undefined);
  }, [hydrate]);

  async function importImage(file?: File) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const image = new Image();
    image.onload = () => {
      setBaseImage(dataUrl, image.naturalWidth || 1024, image.naturalHeight || 1024);
      setStatus("Imagem importada");
    };
    image.src = dataUrl;
  }

  async function importProject(file?: File) {
    if (!file) return;
    try {
      const project = JSON.parse(await file.text()) as SerializedProject;
      if (project.version !== 1 || !project.document) throw new Error("Arquivo de projeto invalido.");
      hydrate(project);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Nao foi possivel importar o projeto.");
    }
  }

  async function persistProject() {
    const project = serialize();
    await saveProject(project);
    setStatus("Projeto salvo no navegador");
  }

  function exportImage(type: "image/png" | "image/jpeg") {
    const dataUrl = stageRef.current?.exportImage(type);
    if (!dataUrl) {
      setError("Nada para exportar ainda.");
      return;
    }
    downloadDataUrl(dataUrl, `${document.name}.${type === "image/png" ? "png" : "jpg"}`);
    setStatus("Imagem exportada");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">IA</div>
          <div>
            <h1>Editor IA</h1>
            <p>{document.name}</p>
          </div>
        </div>

        <div className="top-actions">
          <button className="icon-button" title="Desfazer" onClick={undo} disabled={!history.length}>
            <RotateCcw size={18} />
          </button>
          <button className="icon-button" title="Refazer" onClick={redo} disabled={!future.length}>
            <RotateCw size={18} />
          </button>
          <button className="text-button secondary" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={18} /> Importar imagem
          </button>
          <button className="text-button secondary" onClick={() => projectInputRef.current?.click()}>
            <FolderOpen size={18} /> Importar projeto
          </button>
          <button className="text-button secondary" onClick={persistProject}>
            <Save size={18} /> Salvar
          </button>
          <button className="text-button secondary" onClick={() => safeJsonDownload(serialize(), `${document.name}.json`)}>
            <FileJson size={18} /> JSON
          </button>
          <button className="text-button primary" onClick={() => exportImage("image/png")}>
            <Download size={18} /> PNG
          </button>
          <button className="text-button" onClick={() => exportImage("image/jpeg")}>
            JPG
          </button>
          <button className="text-button danger" onClick={reset}>
            Novo
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(event) => importImage(event.target.files?.[0])} />
        <input
          ref={projectInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(event) => importProject(event.target.files?.[0])}
        />
      </header>

      <aside className="sidebar">
        <LayersPanel />
      </aside>

      <section className="workspace">
        <Toolbar />
        <CanvasStage ref={stageRef} />
      </section>

      <aside className="rightbar">
        <PromptPanel getCanvasImage={() => stageRef.current?.exportImage("image/png")} getMaskImage={() => stageRef.current?.exportMask()} />
      </aside>
    </main>
  );
}
