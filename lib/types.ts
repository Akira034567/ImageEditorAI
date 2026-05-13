export type Tool = "select" | "draw" | "rect" | "circle" | "text" | "eraser";

export type LayerKind = "image" | "text" | "path" | "shape";

export type ImageLayer = {
  id: string;
  kind: "image";
  name: string;
  visible: boolean;
  locked: boolean;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};

export type TextLayer = {
  id: string;
  kind: "text";
  name: string;
  visible: boolean;
  locked: boolean;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  rotation: number;
  opacity: number;
};

export type PathLayer = {
  id: string;
  kind: "path";
  name: string;
  visible: boolean;
  locked: boolean;
  points: number[];
  stroke: string;
  strokeWidth: number;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  annotation: boolean;
};

export type ShapeLayer = {
  id: string;
  kind: "shape";
  name: string;
  visible: boolean;
  locked: boolean;
  shape: "rect" | "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  fill: string;
  rotation: number;
  opacity: number;
  annotation: boolean;
};

export type EditorLayer = ImageLayer | TextLayer | PathLayer | ShapeLayer;

export type AiSettings = {
  model: string;
  size: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality: "auto" | "low" | "medium" | "high";
  background: "auto" | "transparent" | "opaque";
};

export type EditorDocument = {
  id: string;
  name: string;
  width: number;
  height: number;
  baseImage?: string;
  layers: EditorLayer[];
  createdAt: number;
  updatedAt: number;
};

export type SerializedProject = {
  version: 1;
  document: EditorDocument;
  settings: AiSettings;
};

export type AiResult = {
  image: string;
  revisedPrompt?: string;
};
