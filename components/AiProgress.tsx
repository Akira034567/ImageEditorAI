"use client";

import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/lib/editorStore";

export function AiProgress() {
  const { aiJob } = useEditorStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!aiJob) {
      setElapsed(0);
      return;
    }

    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - aiJob.startedAt) / 1000)));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [aiJob]);

  const message = useMemo(() => {
    if (!aiJob) return "";
    if (elapsed < 8) return "Preparando...";
    if (elapsed < 25) return "Processando imagem...";
    if (elapsed < 55) return "Ainda trabalhando...";
    return "Quase la...";
  }, [aiJob, elapsed]);

  if (!aiJob) return null;

  return (
    <div className="ai-progress-compact" role="status" aria-live="polite">
      <span className="ai-progress-label">{aiJob.label}</span>
      <div className="ai-progress-track" aria-hidden="true">
        <div className="ai-progress-bar" />
      </div>
      <span className="ai-progress-detail">{message}</span>
      <small>{elapsed}s</small>
    </div>
  );
}
