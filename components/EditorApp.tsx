"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileJson, FolderOpen, ImagePlus, RotateCcw, RotateCw, Save } from "lucide-react";
import { CanvasStage, type CanvasStageHandle } from "@/components/CanvasStage";
import { LayersPanel } from "@/components/LayersPanel";
import { PromptPanel } from "@/components/PromptPanel";
import { ProjectsPanel } from "@/components/ProjectsPanel";
import { Toolbar } from "@/components/Toolbar";
import { loadLatestProject, saveProject } from "@/lib/db";
import { downloadDataUrl, fileToDataUrl, safeJsonDownload } from "@/lib/imageUtils";
import { useEditorStore } from "@/lib/editorStore";
import type { SerializedProject } from "@/lib/types";

export function EditorApp() {
  const stageRef = useRef<CanvasStageHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const didLoadRef = useRef(false);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const { document, aiJob, undo, redo, history, future, serialize, hydrate, setBaseImage, setStatus, setError, reset, renameDocument } =
    useEditorStore();

  useEffect(() => {
    loadLatestProject()
      .then((project) => {
        if (project) hydrate(project);
        didLoadRef.current = true;
      })
      .catch(() => {
        didLoadRef.current = true;
      });
  }, [hydrate]);

  useEffect(() => {
    if (!didLoadRef.current) return;
    const timer = window.setTimeout(() => {
      saveProject(serialize())
        .then(() => {
          setProjectRefreshKey((key) => key + 1);
          if (!useEditorStore.getState().aiJob) setStatus("Projeto salvo automaticamente");
        })
        .catch((error) => {
          setError(error instanceof Error ? error.message : "Nao foi possivel salvar automaticamente.");
        });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [document, aiJob, serialize, setError, setStatus]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      if (isTyping) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redo, undo]);

  async function importImage(file?: File) {
    if (!file) return;
    try {
      setError(undefined);
      setStatus("Importando imagem...");
      const dataUrl = await fileToDataUrl(file);
      const image = new Image();
      image.onload = () => {
        setBaseImage(dataUrl, image.naturalWidth || 1024, image.naturalHeight || 1024);
        setStatus("Imagem importada");
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      image.onerror = () => {
        setError("Nao foi possivel carregar esta imagem. Tente PNG, JPEG ou WebP.");
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      image.src = dataUrl;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Nao foi possivel importar a imagem.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function importProject(file?: File) {
    if (!file) return;
    try {
      const project = JSON.parse(await file.text()) as SerializedProject;
      if (project.version !== 1 || !project.document) throw new Error("Arquivo de projeto invalido.");
      hydrate(project);
      await saveProject(project);
      setProjectRefreshKey((key) => key + 1);
      if (projectInputRef.current) projectInputRef.current.value = "";
    } catch (error) {
      setError(error instanceof Error ? error.message : "Nao foi possivel importar o projeto.");
      if (projectInputRef.current) projectInputRef.current.value = "";
    }
  }

  async function persistProject() {
    const project = serialize();
    await saveProject(project);
    setProjectRefreshKey((key) => key + 1);
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
            <input
              className="project-title-input"
              value={document.name}
              aria-label="Nome do projeto"
              onChange={(event) => renameDocument(event.target.value)}
            />
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
        <ProjectsPanel refreshKey={projectRefreshKey} onLoaded={() => setProjectRefreshKey((key) => key + 1)} />
        <LayersPanel />
      </aside>

      <section className="workspace">
        <Toolbar />
        <CanvasStage ref={stageRef} />
      </section>

      <aside className="rightbar">
        <PromptPanel
          getCanvasImage={(options) => stageRef.current?.exportImage("image/png", options)}
          getMaskImage={() => stageRef.current?.exportMask()}
          hasAnnotations={() => stageRef.current?.hasAnnotations() ?? false}
        />
      </aside>
    </main>
  );
}
