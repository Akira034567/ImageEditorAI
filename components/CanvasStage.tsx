"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";
import { v4 as uuid } from "uuid";
import { useEditorStore } from "@/lib/editorStore";
import type { EditorLayer, ImageLayer, PathLayer, ShapeLayer, TextLayer } from "@/lib/types";

export type CanvasStageHandle = {
  exportImage: (mimeType?: "image/png" | "image/jpeg") => string | undefined;
  exportMask: () => string | undefined;
};

type Draft =
  | { kind: "path"; points: number[] }
  | { kind: "shape"; shape: "rect" | "circle"; startX: number; startY: number; x: number; y: number; width: number; height: number };

function useHtmlImage(src?: string) {
  const [image, setImage] = useState<HTMLImageElement>();

  useEffect(() => {
    if (!src) {
      setImage(undefined);
      return;
    }
    const next = new Image();
    next.crossOrigin = "anonymous";
    next.onload = () => setImage(next);
    next.src = src;
  }, [src]);

  return image;
}

export const CanvasStage = forwardRef<CanvasStageHandle>(function CanvasStage(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const [viewport, setViewport] = useState({ width: 900, height: 700 });
  const [draft, setDraft] = useState<Draft>();
  const [isDrawing, setIsDrawing] = useState(false);
  const {
    document,
    selectedLayerId,
    tool,
    setSelectedLayer,
    addLayer,
    updateLayer,
    removeLayer,
    setStatus
  } = useEditorStore();
  const baseImage = useHtmlImage(document.baseImage);

  const fit = useMemo(() => {
    const scale = Math.min((viewport.width - 40) / document.width, (viewport.height - 40) / document.height, 1);
    return {
      scale,
      x: Math.max(20, (viewport.width - document.width * scale) / 2),
      y: Math.max(20, (viewport.height - document.height * scale) / 2)
    };
  }, [document.height, document.width, viewport.height, viewport.width]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => {
      setViewport({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(360, entry.contentRect.height)
      });
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, []);

  useEffect(() => {
    const transformer = transformerRef.current;
    const selectedNode = selectedLayerId ? nodeRefs.current.get(selectedLayerId) : undefined;
    if (!transformer) return;
    transformer.nodes(selectedNode ? [selectedNode] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedLayerId, document.layers]);

  useImperativeHandle(ref, () => ({
    exportImage: (mimeType = "image/png") => {
      const group = stageRef.current?.findOne("#document-root");
      return group?.toDataURL({
        mimeType,
        x: 0,
        y: 0,
        width: document.width,
        height: document.height,
        pixelRatio: 1
      });
    },
    exportMask: () => renderAnnotationOverlay(document.layers, document.width, document.height)
  }));

  function getPointer() {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    return {
      x: (pointer.x - fit.x) / fit.scale,
      y: (pointer.y - fit.y) / fit.scale
    };
  }

  function handlePointerDown(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const position = getPointer();
    if (!position) return;

    if (tool === "select") {
      const targetId = event.target.attrs["data-layer-id"];
      setSelectedLayer(targetId);
      return;
    }

    if (tool === "eraser") {
      const targetId = event.target.attrs["data-layer-id"];
      if (targetId) removeLayer(targetId);
      return;
    }

    if (tool === "text") {
      addLayer(createTextLayer(position.x, position.y));
      setStatus("Texto criado");
      return;
    }

    if (tool === "draw") {
      setIsDrawing(true);
      setDraft({ kind: "path", points: [position.x, position.y] });
      return;
    }

    if (tool === "rect" || tool === "circle") {
      setIsDrawing(true);
      setDraft({
        kind: "shape",
        shape: tool,
        startX: position.x,
        startY: position.y,
        x: position.x,
        y: position.y,
        width: 1,
        height: 1
      });
    }
  }

  function handlePointerMove() {
    if (!isDrawing) return;
    const position = getPointer();
    if (!position) return;

    setDraft((current) => {
      if (!current) return current;
      if (current.kind === "path") return { ...current, points: [...current.points, position.x, position.y] };
      return {
        ...current,
        x: Math.min(current.startX, position.x),
        y: Math.min(current.startY, position.y),
        width: Math.abs(position.x - current.startX),
        height: Math.abs(position.y - current.startY)
      };
    });
  }

  function handlePointerUp() {
    if (!draft) {
      setIsDrawing(false);
      return;
    }

    if (draft.kind === "path" && draft.points.length > 3) {
      addLayer({
        id: uuid(),
        kind: "path",
        name: "Anotacao desenhada",
        visible: true,
        locked: false,
        points: draft.points,
        stroke: "#dc2626",
        strokeWidth: 8,
        x: 0,
        y: 0,
        rotation: 0,
        opacity: 0.9,
        annotation: true
      });
    }

    if (draft.kind === "shape" && draft.width > 6 && draft.height > 6) {
      addLayer({
        id: uuid(),
        kind: "shape",
        name: draft.shape === "circle" ? "Circulo de anotacao" : "Retangulo de anotacao",
        visible: true,
        locked: false,
        shape: draft.shape,
        x: draft.x,
        y: draft.y,
        width: draft.width,
        height: draft.height,
        stroke: "#dc2626",
        strokeWidth: 6,
        fill: "rgba(220, 38, 38, 0.08)",
        rotation: 0,
        opacity: 1,
        annotation: true
      });
    }

    setDraft(undefined);
    setIsDrawing(false);
  }

  return (
    <div ref={containerRef} className="canvas-wrap" data-testid="canvas-wrap">
      {!document.baseImage && document.layers.length === 0 ? (
        <div className="empty-canvas">
          <div>
            <strong>Comece importando uma imagem ou gerando com IA</strong>
            <span>Depois desenhe regioes, crie elementos e arraste camadas.</span>
          </div>
        </div>
      ) : null}

      <Stage
        ref={stageRef}
        width={viewport.width}
        height={viewport.height}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <Layer>
          <Group id="document-root" x={fit.x} y={fit.y} scaleX={fit.scale} scaleY={fit.scale}>
            <Rect width={document.width} height={document.height} fill="#ffffff" shadowColor="rgba(0,0,0,0.18)" shadowBlur={20} />
            {baseImage ? <KonvaImage image={baseImage} width={document.width} height={document.height} listening={false} /> : null}
            {document.layers.map((layer) => (
              <LayerNode
                key={layer.id}
                layer={layer}
                selected={selectedLayerId === layer.id}
                nodeRefs={nodeRefs.current}
                onSelect={setSelectedLayer}
                onChange={updateLayer}
              />
            ))}
            {draft ? <DraftNode draft={draft} /> : null}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              borderStroke="#2563eb"
              anchorStroke="#2563eb"
              anchorFill="#ffffff"
              anchorSize={8}
            />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
});

function LayerNode({
  layer,
  nodeRefs,
  onSelect,
  onChange
}: {
  layer: EditorLayer;
  selected: boolean;
  nodeRefs: Map<string, Konva.Node>;
  onSelect: (id?: string) => void;
  onChange: (id: string, patch: Partial<EditorLayer>) => void;
}) {
  const image = useHtmlImage(layer.kind === "image" ? layer.src : undefined);
  const common = {
    ref: (node: Konva.Node | null) => {
      if (node) nodeRefs.set(layer.id, node);
      else nodeRefs.delete(layer.id);
    },
    "data-layer-id": layer.id,
    visible: layer.visible,
    opacity: "opacity" in layer ? layer.opacity : 1,
    draggable: !layer.locked,
    listening: !layer.locked,
    onClick: () => onSelect(layer.id),
    onTap: () => onSelect(layer.id),
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      onChange(layer.id, { x: event.target.x(), y: event.target.y() } as Partial<EditorLayer>);
    },
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      const node = event.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange(layer.id, {
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: Math.max(12, ("width" in layer ? layer.width : node.width()) * scaleX),
        height: Math.max(12, ("height" in layer ? layer.height : node.height()) * scaleY)
      } as Partial<EditorLayer>);
    }
  };

  if (layer.kind === "image") {
    return image ? <KonvaImage {...common} image={image} x={layer.x} y={layer.y} width={layer.width} height={layer.height} rotation={layer.rotation} /> : null;
  }

  if (layer.kind === "text") {
    return (
      <Text
        {...common}
        x={layer.x}
        y={layer.y}
        text={layer.text}
        fontSize={layer.fontSize}
        fill={layer.fill}
        rotation={layer.rotation}
      />
    );
  }

  if (layer.kind === "path") {
    return (
      <Line
        {...common}
        x={layer.x}
        y={layer.y}
        points={layer.points}
        stroke={layer.stroke}
        strokeWidth={layer.strokeWidth}
        rotation={layer.rotation}
        lineCap="round"
        lineJoin="round"
      />
    );
  }

  if (layer.shape === "circle") {
    return (
      <Circle
        {...common}
        x={layer.x + layer.width / 2}
        y={layer.y + layer.height / 2}
        radius={Math.max(layer.width, layer.height) / 2}
        scaleY={layer.height / Math.max(layer.width, layer.height)}
        stroke={layer.stroke}
        strokeWidth={layer.strokeWidth}
        fill={layer.fill}
        rotation={layer.rotation}
      />
    );
  }

  return (
    <Rect
      {...common}
      x={layer.x}
      y={layer.y}
      width={layer.width}
      height={layer.height}
      stroke={layer.stroke}
      strokeWidth={layer.strokeWidth}
      fill={layer.fill}
      rotation={layer.rotation}
    />
  );
}

function DraftNode({ draft }: { draft: Draft }) {
  if (draft.kind === "path") {
    return <Line points={draft.points} stroke="#dc2626" strokeWidth={8} opacity={0.9} lineCap="round" lineJoin="round" />;
  }
  if (draft.shape === "circle") {
    return (
      <Circle
        x={draft.x + draft.width / 2}
        y={draft.y + draft.height / 2}
        radius={Math.max(draft.width, draft.height) / 2}
        scaleY={draft.height / Math.max(draft.width, draft.height)}
        stroke="#dc2626"
        strokeWidth={6}
        fill="rgba(220, 38, 38, 0.08)"
      />
    );
  }
  return <Rect x={draft.x} y={draft.y} width={draft.width} height={draft.height} stroke="#dc2626" strokeWidth={6} fill="rgba(220, 38, 38, 0.08)" />;
}

function createTextLayer(x: number, y: number): TextLayer {
  return {
    id: uuid(),
    kind: "text",
    name: "Texto",
    visible: true,
    locked: false,
    text: "Texto",
    x,
    y,
    fontSize: 48,
    fill: "#172033",
    rotation: 0,
    opacity: 1
  };
}

function renderAnnotationOverlay(layers: EditorLayer[], width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.clearRect(0, 0, width, height);

  layers.filter(isAnnotation).forEach((layer) => {
    context.save();
    context.globalAlpha = layer.opacity;
    context.strokeStyle = layer.kind === "path" ? layer.stroke : layer.stroke;
    context.fillStyle = layer.kind === "shape" ? layer.fill : "transparent";
    context.lineWidth = layer.kind === "path" ? layer.strokeWidth : layer.strokeWidth;
    context.lineCap = "round";
    context.lineJoin = "round";

    if (layer.kind === "path") {
      context.beginPath();
      for (let index = 0; index < layer.points.length; index += 2) {
        const x = layer.points[index] + layer.x;
        const y = layer.points[index + 1] + layer.y;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    } else {
      context.beginPath();
      if (layer.shape === "circle") {
        context.ellipse(layer.x + layer.width / 2, layer.y + layer.height / 2, layer.width / 2, layer.height / 2, 0, 0, Math.PI * 2);
      } else {
        context.rect(layer.x, layer.y, layer.width, layer.height);
      }
      context.fill();
      context.stroke();
    }
    context.restore();
  });

  return canvas.toDataURL("image/png");
}

function isAnnotation(layer: EditorLayer): layer is PathLayer | ShapeLayer {
  return (layer.kind === "path" || layer.kind === "shape") && layer.annotation && layer.visible;
}
