"use client";

import Dexie, { type Table } from "dexie";
import type { SerializedProject } from "@/lib/types";

export type StoredProject = SerializedProject & {
  id: string;
  name: string;
  updatedAt: number;
};

class EditorDatabase extends Dexie {
  projects!: Table<StoredProject, string>;

  constructor() {
    super("image-editor-ai");
    this.version(1).stores({
      projects: "id, name, updatedAt"
    });
  }
}

export const db = new EditorDatabase();

export async function saveProject(project: SerializedProject) {
  await db.projects.put({
    ...project,
    id: project.document.id,
    name: project.document.name,
    updatedAt: Date.now()
  });
}

export async function loadLatestProject() {
  return db.projects.orderBy("updatedAt").last();
}

export async function listProjects() {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function deleteProject(id: string) {
  await db.projects.delete(id);
}
