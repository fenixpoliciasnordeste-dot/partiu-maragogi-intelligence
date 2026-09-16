"use client";
import { useState } from "react";
import { Modal, RenderData, Badge, date, num, api } from "./ui";
import { confidence } from "@/lib/metrics";
export function Analysis({
  analysis,
  onClose,
  onOpportunity,
}: {
  analysis: any;
  onClose: () => void;
  onOpportunity?: (index: number) => void;
}) {
  const [sources, setSources] = useState(false),
    [copyStatus, setCopyStatus] = useState("");
  const list = analysis.sources || [];
  return (
    <Modal
      title={sources ? "Fontes utilizadas" : "Análise de conteúdo"}
      onClose={onClose}
    >
      <div className="actions">
        <Badge tone="info">INTERPRETAÇÃO DA IA</Badge>
        <span>{date(analysis.createdAt)}</span>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                analysis.result.prompt ||
                  JSON.stringify(analysis.result, null, 2),
              );
              setCopyStatus("Copiado.");
            } catch {
              setCopyStatus("Selecione o texto e copie manualmente.");
            }
          }}
        >
          Copiar{analysis.result.prompt ? " prompt" : ""}
        </button>
        <span role="status">{copyStatus}</span>
        <button onClick={() => setSources(!sources)}>
          {sources ? "Voltar à análise" : `Ver fontes (${list.length} posts)`}
        </button>
      </div>
      {sources ? (
        <>
          <p>
            Confiança da amostra:{" "}
            <strong>
              {confidence(
                list.map((s: any) => ({
                  metrics: s.metrics,
                  publishedAt: s.post.publishedAt,
                })),
              )}
            </strong>
          </p>
          <p className="muted">
            Regra: alta com ≥30 posts, ≥80% de completude e ≥30 dias; média com
            ≥10 posts, ≥60% e ≥7 dias. Consistência do padrão exige revisão da
            evidência específica.
          </p>
          {list.map((s: any) => (
            <div className="source" key={s.id}>
              {s.post.thumbnail && <img src={s.post.thumbnail} alt="Fonte" />}
              <div>
                <strong>@{s.post.profile?.username || "perfil"}</strong>
                <p>{s.post.caption?.slice(0, 150)}</p>
                <small>
                  Coleta {date(s.capturedAt)} · {num(s.metrics.views)} views ·{" "}
                  {num(s.metrics.likes)} curtidas
                </small>
                {s.post.url && (
                  <a href={s.post.url} target="_blank" rel="noreferrer">
                    Abrir fonte ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </>
      ) : (
        <>
          <RenderData value={analysis.result} />
          {onOpportunity &&
            Array.isArray(analysis.result?.oportunidades) &&
            analysis.result.oportunidades
              .filter((o: any) => typeof o === "object")
              .map((o: any, i: number) => (
                <div className="opportunity" key={i}>
                  <h3>{o.titulo}</h3>
                  <button onClick={() => onOpportunity(i)}>
                    Transformar em ideia →
                  </button>
                </div>
              ))}
        </>
      )}
    </Modal>
  );
}
export async function loadIdeaSources(idea: any) {
  return idea.aiAnalysisId ? api("sources/" + idea.aiAnalysisId) : [];
}
