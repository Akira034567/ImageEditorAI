"use client";

import { useEffect, useState } from "react";
import { FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import { deleteProject, listProjects, type StoredProject } from "@/lib/db";
import { useEditorStore } from "@/lib/editorStore";

type Props = {
  refreshKey: number;
  onLoaded?: () => void;
};

export function ProjectsPanel({ refreshKey, onLoaded }: Props) {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const { document, hydrate, setStatus, setError } = useEditorStore();

  useEffect(() => {
    refresh();
  }, [refreshKey]);

  async function refresh() {
    try {
      setProjects(await listProjects());
    } catch {
      setProjects([]);
    }
  }

  async function load(project: StoredProject) {
    hydrate(project);
    setStatus("Projeto carregado");
    onLoaded?.();
  }

  async function remove(id: string) {
    try {
      await deleteProject(id);
      await refresh();
      setStatus("Projeto removido");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Nao foi possivel remover o projeto.");
    }
  }

  return (
    <section className="panel">
      <div className="panel-title-row">
        <h2>Projetos salvos</h2>
        <button className="icon-button compact" title="Atualizar lista" onClick={refresh}>
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="project-list">
        {projects.length === 0 ? (
          <p className="status">Os projetos ficam salvos neste navegador. O autosave entra depois da primeira mudanca.</p>
        ) : (
          projects.map((project) => (
            <div key={project.id} className={`project-item ${project.id === document.id ? "selected" : ""}`}>
              <button className="project-open" onClick={() => load(project)} title="Abrir projeto">
                <FolderOpen size={16} />
                <span>
                  <strong>{project.name}</strong>
                  <small>{new Date(project.updatedAt).toLocaleString("pt-BR")}</small>
                </span>
              </button>
              <button className="icon-button compact" title="Excluir projeto" onClick={() => remove(project.id)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
