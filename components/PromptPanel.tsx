"use client";

import { useRef, useState } from "react";
import { WandSparkles } from "lucide-react";
import Image from "next/image";
import { IMAGE_MODELS } from "@/lib/imageModels";
import { useEditorStore } from "@/lib/editorStore";
import { getImageSize } from "@/lib/imageUtils";
import type { AiResult } from "@/lib/types";

type Props = {
  getCanvasImage: (options?: { includeAnnotations?: boolean }) => string | undefined;
  getMaskImage: () => string | undefined;
  hasAnnotations: () => boolean;
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

export function PromptPanel({ getCanvasImage, getMaskImage, hasAnnotations }: Props) {
  const {
    prompt,
    document,
    settings,
    pendingResult,
    setPrompt,
    setSettings,
    setPendingResult,
    rememberPrompt,
    addAiResult,
    restoreAiResult,
    applyPendingAsLayer,
    setBaseImage,
    setStatus,
    setError,
    startAiJob,
    finishAiJob
  } = useEditorStore();

  async function runGenerate() {
    await run("/api/ai/generate", { prompt, ...settings }, applyResultAsBase, "generate");
  }

  async function runEdit() {
    const image = getCanvasImage({ includeAnnotations: false });
    const mask = getMaskImage();
    if (!image) {
      setError("Importe ou gere uma imagem antes de editar.");
      return;
    }
    if (!hasAnnotations()) {
      setError("Desenhe uma area na imagem antes de usar Editar area marcada. Para ajustar a imagem inteira, use Ajustar imagem.");
      return;
    }
    await run("/api/ai/edit", { prompt, image, mask, ...settings }, setPendingResult, "edit");
  }

  async function runAgain() {
    const image = getCanvasImage({ includeAnnotations: true });
    if (!image) {
      setError("Nao ha imagem na tela para ajustar.");
      return;
    }
    await run("/api/ai/edit", { prompt, image, ...settings, size: "auto" }, setPendingResult, "adjust");
  }

  async function runElement() {
    await run("/api/ai/element", { prompt, ...settings, background: "transparent" }, setPendingResult, "element");
  }

  const [promptCursor, setPromptCursor] = useState(-1);
  const draftPromptRef = useRef("");

  async function run(
    path: string,
    body: unknown,
    onResult: (result: AiResult) => void | Promise<void>,
    action: "generate" | "edit" | "element" | "adjust"
  ) {
    try {
      setError(undefined);
      startAiJob({ action, label: aiActionLabel(action) });
      setStatus("Solicitacao enviada para a IA");
      rememberPrompt(prompt);
      const result = await postAi(path, body);
      addAiResult(result, { prompt, action, model: settings.model });
      await onResult(result);
      setStatus("Resultado recebido");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Erro inesperado");
    } finally {
      finishAiJob();
    }
  }

  function handlePromptKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    if (event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) return;

    const history = document.promptHistory;
    if (!history.length) return;
    const atFirstLine = event.currentTarget.selectionStart <= prompt.split("\n", 1)[0].length;
    const atLastLine = event.currentTarget.selectionStart >= prompt.length - prompt.split("\n").at(-1)!.length;

    if (event.key === "ArrowUp" && !atFirstLine) return;
    if (event.key === "ArrowDown" && !atLastLine) return;

    event.preventDefault();
    if (promptCursor === -1) draftPromptRef.current = prompt;

    const nextCursor =
      event.key === "ArrowUp"
        ? Math.min(promptCursor + 1, history.length - 1)
        : Math.max(promptCursor - 1, -1);
    setPromptCursor(nextCursor);
    setPrompt(nextCursor === -1 ? draftPromptRef.current : history[nextCursor]);
  }

  async function applyResultAsBase(result: AiResult) {
    const size = await getImageSize(result.image);
    setBaseImage(result.image, size.width, size.height);
    setPendingResult(undefined);
  }

  return (
    <>
      <section className="panel">
        <h2>Prompt</h2>
        <div className="prompt-box">
          <textarea
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              setPromptCursor(-1);
            }}
            onKeyDown={handlePromptKeyDown}
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
          <button className="text-button" onClick={runAgain} disabled={!prompt.trim()}>
            Ajustar imagem
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
            <button className="text-button primary" onClick={() => applyResultAsBase(pendingResult)}>
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

      <section className="panel">
        <h2>Historico da IA</h2>
        <div className="ai-history-list">
          {document.aiHistory.length === 0 ? (
            <p className="status">As respostas de imagem da IA aparecem aqui para voce recuperar versoes anteriores.</p>
          ) : (
            document.aiHistory.map((item) => (
              <button key={item.id} className="ai-history-item" onClick={() => restoreAiResult(item.id)}>
                <Image alt="Resposta anterior da IA" src={item.image} width={72} height={72} unoptimized />
                <span>
                  <strong>{item.action}</strong>
                  <small>{item.prompt}</small>
                  <small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small>
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function aiActionLabel(action: "generate" | "edit" | "element" | "adjust") {
  if (action === "generate") return "Gerando nova imagem";
  if (action === "edit") return "Editando area marcada";
  if (action === "element") return "Criando elemento";
  return "Ajustando imagem da tela";
}
