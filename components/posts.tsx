"use client";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Modal, Empty, Badge, num, date, Help, api, RenderData } from "./ui";
export function Posts({
  posts,
  onError,
}: {
  posts: any[];
  onError: (s: string) => void;
}) {
  const [detail, setDetail] = useState<any>(null),
    [working, setWorking] = useState(false),
    [message, setMessage] = useState("");
  return (
    <>
      {!posts.length ? (
        <Empty
          title="Suas publicações aparecerão aqui"
          text="Conecte uma conta e sincronize para começar a comparar conteúdos."
        />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Publicação</th>
                <th>Plataforma</th>
                <th>Views</th>
                <th>Curtidas</th>
                <th>Comentários</th>
                <th>
                  Engajamento{" "}
                  <Help text="Cálculo: (curtidas + comentários) / seguidores na coleta × 100. Comparações entre plataformas exigem cautela." />
                </th>
                <th>
                  Score{" "}
                  <Help text="Desempenho desta publicação comparado ao histórico do perfil. Pelo menos 5 outras publicações com a mesma métrica." />
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button
                      className="post-button"
                      onClick={async () => {
                        try {
                          setDetail({
                            ...(await api("posts/" + p.id)),
                            score: p.score,
                          });
                        } catch (e) {
                          onError((e as Error).message);
                        }
                      }}
                    >
                      {p.thumbnail ? (
                        <img src={p.thumbnail} alt="Miniatura da publicação" />
                      ) : (
                        <span className="thumb">{p.format?.slice(0, 1)}</span>
                      )}
                      <span>
                        <strong>
                          {p.caption?.slice(0, 80) || "Sem legenda"}
                        </strong>
                        <small>
                          {p.profile?.username
                            ? "@" + p.profile.username + " · "
                            : ""}
                          {p.format} · {date(p.publishedAt)}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <Badge>{p.platform}</Badge>
                  </td>
                  <td>{num(p.metrics?.views)}</td>
                  <td>{num(p.metrics?.likes)}</td>
                  <td>{num(p.metrics?.comments)}</td>
                  <td>
                    {p.engagement == null ? "—" : num(p.engagement) + "%"}
                  </td>
                  <td>
                    <Badge tone={p.score >= 75 ? "success" : "muted"}>
                      {num(p.score)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {detail && (
        <Modal title="Publicação e evolução" onClose={() => setDetail(null)}>
          <Badge tone="info">DADO REAL DA API</Badge>
          <p>{detail.caption}</p>
          <p>
            {date(detail.publishedAt)} · {detail.format}
          </p>
          {detail.url && (
            <a href={detail.url} target="_blank" rel="noopener noreferrer">
              Abrir publicação <ExternalLink size={14} />
            </a>
          )}
          <div className="mini-grid">
            {["views", "likes", "comments", "reach", "shares", "saves"].map(
              (k) => (
                <div key={k}>
                  <small>
                    {
                      {
                        views: "Views",
                        likes: "Curtidas",
                        comments: "Comentários",
                        reach: "Alcance",
                        shares: "Compartilhamentos",
                        saves: "Salvamentos",
                      }[k]
                    }
                  </small>
                  <h3>{num(detail.snapshots.at(-1)?.[k])}</h3>
                </div>
              ),
            )}
          </div>
          <div className="actions">
            <button
              disabled={working}
              onClick={async () => {
                setWorking(true);
                try {
                  await api("ideas/from-post", { postId: detail.id });
                  setMessage("Ideia salva com a publicação como fonte.");
                } catch (e) {
                  onError((e as Error).message);
                } finally {
                  setWorking(false);
                }
              }}
            >
              Transformar em ideia · usa Gemini
            </button>
            <button
              disabled={working}
              onClick={async () => {
                setWorking(true);
                try {
                  const a = await api("ai", {
                    action: detail.profile.competitorId
                      ? "competitor"
                      : "profile",
                    id: detail.profile.competitorId || detail.profileId,
                  });
                  setMessage(a.result.resumo);
                } catch (e) {
                  onError((e as Error).message);
                } finally {
                  setWorking(false);
                }
              }}
            >
              Analisar perfil com IA
            </button>
          </div>
          {message && <p role="status">{message}</p>}
          <p className="muted">
            Campos sem valor: Dado não disponibilizado pela API.
          </p>
          <h3>Views ao longo das coletas</h3>
          {detail.snapshots.some((s: any) => s.views != null) ? (
            <div className="chart">
              <ResponsiveContainer>
                <LineChart
                  data={detail.snapshots.map((s: any) => ({
                    ...s,
                    date: date(s.capturedAt),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="views" stroke="#008b8b" connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
          <details>
            <summary>Classificação — interpretação da IA</summary>
            <RenderData value={detail.classification} />
          </details>
        </Modal>
      )}
    </>
  );
}
