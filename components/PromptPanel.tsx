"use client";

import { WandSparkles } from "lucide-react";
import Image from "next/image";
import { IMAGE_MODELS } from "@/lib/imageModels";
import { useEditorStore } from "@/lib/editorStore";
import type { AiResult } from "@/lib/types";

type Props = {
  getCanvasImage: (options?: { includeAnnotations?: boolean }) => string | undefined;
  getMaskImage: () => string | undefined;
};

async function postAi(path: string, body: unknown): Promise<AiResult> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Falha ao chamar a IA.");
  return payload;
}

export function PromptPanel({ getCanvasImage, getMaskImage }: Props) {
  const {
    prompt,
    settings,
    pendingResult,
    setPrompt,
    setSettings,
    setPendingResult,
    applyPendingAsBase,
    applyPendingAsLayer,
    setBaseImage,
    setStatus,
    setError
  } = useEditorStore();

  async function runGenerate() {
    await run("/api/ai/generate", { prompt, ...settings }, (result) => setBaseImage(result.image));
  }

  async function runEdit() {
    const image = getCanvasImage({ includeAnnotations: false });
    const mask = getMaskImage();
    if (!image) {
      setError("Importe ou gere uma imagem antes de editar.");
      return;
    }
    await run("/api/ai/edit", { prompt, image, mask, ...settings }, setPendingResult);
  }

  async function runElement() {
    await run("/api/ai/element", { prompt, ...settings, background: "transparent" }, setPendingResult);
  }

  async function run(path: string, body: unknown, onResult: (result: AiResult) => void) {
    try {
      setError(undefined);
      setStatus("A IA esta trabalhando...");
      const result = await postAi(path, body);
      onResult(result);
      setStatus("Resultado recebido");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erro inesperado");
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Prompt</h2>
        <div className="prompt-box">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder='Ex.: No circulo vermelho desenhado, coloque uma borboleta azul com asas detalhadas.'
          />
          <button className="text-button primary" onClick={runGenerate} disabled={!prompt.trim()}>
            <WandSparkles size={18} /> Gerar nova imagem
          </button>
          <button className="text-button secondary" onClick={runEdit} disabled={!prompt.trim()}>
            Editar area marcada
          </button>
          <button className="text-button secondary" onClick={runElement} disabled={!prompt.trim()}>
            Criar elemento
          </button>
          <button className="text-button" onClick={runEdit} disabled={!prompt.trim()}>
            Ajustar novamente
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Configuracoes da IA</h2>
        <div className="prompt-box">
          <label className="field">
            Modelo
            <select value={settings.model} onChange={(event) => setSettings({ model: event.target.value as never })}>
              {IMAGE_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>
          <div className="status">
            {IMAGE_MODELS.find((model) => model.id === settings.model)?.description}
          </div>
          <div className="field-row">
            <label className="field">
              Tamanho
              <select value={settings.size} onChange={(event) => setSettings({ size: event.target.value as never })}>
                <option value="1024x1024">1024 x 1024</option>
                <option value="1024x1536">1024 x 1536</option>
                <option value="1536x1024">1536 x 1024</option>
                <option value="auto">Auto</option>
              </select>
            </label>
            <label className="field">
              Qualidade
              <select value={settings.quality} onChange={(event) => setSettings({ quality: event.target.value as never })}>
                <option value="auto">Auto</option>
                <option value="low">Baixa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </label>
          </div>
          <label className="field">
            Fundo
            <select value={settings.background} onChange={(event) => setSettings({ background: event.target.value as never })}>
              <option value="auto">Auto</option>
              <option value="transparent">Transparente</option>
              <option value="opaque">Opaco</option>
            </select>
          </label>
        </div>
      </section>

      {pendingResult ? (
        <section className="panel">
          <h2>Resultado pendente</h2>
          <div className="preview">
            <Image alt="Resultado gerado pela IA" src={pendingResult.image} width={320} height={220} unoptimized />
          </div>
          <div className="tool-row" style={{ marginTop: 12 }}>
            <button className="text-button primary" onClick={applyPendingAsBase}>
              Aplicar na base
            </button>
            <button className="text-button secondary" onClick={applyPendingAsLayer}>
              Inserir camada
            </button>
            <button className="text-button" onClick={() => setPendingResult(undefined)}>
              Descartar
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
