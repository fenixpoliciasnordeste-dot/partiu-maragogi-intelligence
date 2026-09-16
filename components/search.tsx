"use client";
import { useEffect, useState } from "react";
import { api, Modal, Empty, RenderData } from "./ui";
import { Posts } from "./posts";
export default function SearchPanel({
  config,
  prefs,
  profiles,
  onChange,
  onError,
  refresh,
  onAnalysis,
  onAI,
}: {
  config: any;
  prefs: any;
  profiles: any[];
  onChange: (v: any) => void;
  onError: (s: string) => void;
  refresh: () => Promise<void>;
  onAnalysis: (a: any) => void;
  onAI: (action: string, id?: string) => Promise<void>;
}) {
  const [filters, setFilters] = useState(config),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [save, setSave] = useState<any>(null);
  const run = async (f: any, semantic = false) => {
    setBusy(true);
    try {
      setResult(await api("search", { ...f, semantic }));
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    setFilters(config);
    void run(config);
  }, [config]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TODO O SEU CONTEÚDO</div>
          <h1>Busca inteligente</h1>
          <p>Encontre os dados que sustentam sua próxima decisão.</p>
        </div>
      </div>
      <section className="panel" data-tour="search-filters">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(filters);
          }}
        >
          <label>
            Consulta
            <input
              value={filters.query || ""}
              onChange={(e) =>
                setFilters({ ...filters, query: e.target.value })
              }
              placeholder="Conteúdos sobre preço"
            />
          </label>
          <div className="form-grid">
            {Object.entries({
              platform: ["Todos", "Instagram"],
              origin: ["Todos", "Meu perfil", "Concorrentes"],
              format: [
                "",
                "Reel",
                "Carrossel",
                "Story",
                "Post",
                "Vídeo curto",
              ],
              funnel: ["", "Topo", "Meio", "Fundo"],
              sort: [
                "recentes",
                "views",
                "likes",
                "comments",
                "engagement",
                "score",
              ],
            }).map(([k, v]) => (
              <label key={k}>
                {
                  {
                    platform: "Plataforma",
                    origin: "Origem",
                    format: "Formato",
                    funnel: "Funil",
                    sort: "Ordenação",
                  }[k]
                }
                <select
                  value={filters[k] || v[0]}
                  onChange={(e) =>
                    setFilters({ ...filters, [k]: e.target.value || undefined })
                  }
                >
                  {v.map((x) => (
                    <option key={x} value={x}>
                      {x || "Todos"}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              Perfil
              <select
                value={filters.profileId || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    profileId: e.target.value || undefined,
                  })
                }
              >
                <option value="">Todos</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    @{p.username}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tema
              <input
                value={filters.theme || ""}
                onChange={(e) =>
                  setFilters({ ...filters, theme: e.target.value || undefined })
                }
              />
            </label>
            {Object.entries({
              days: "Últimos dias (0 = todo período)",
              minViews: "Views mínimas",
              minScore: "Score mínimo",
              minLikes: "Curtidas mínimas",
              minComments: "Comentários mínimos",
              minEngagement: "Engajamento mínimo (%)",
            }).map(([k, l]) => (
              <label key={k}>
                {l}
                <input
                  type="number"
                  min="0"
                  max={k === "minScore" ? 100 : undefined}
                  step={k === "minEngagement" ? ".1" : "1"}
                  value={filters[k] ?? ""}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      [k]:
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="actions">
            <button className="primary" disabled={busy}>
              {busy ? "Pesquisando…" : "Pesquisar no banco"}
            </button>
            <button
              type="button"
              onClick={() => setSave({ name: "", config: filters })}
            >
              Salvar filtro
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(filters, true)}
            >
              Interpretar com Gemini · consome API
            </button>
          </div>
        </form>
      </section>
      <section className="panel">
        <h2>Filtros salvos</h2>
        <div className="saved-filters">
          {prefs.filters.map((f: any) => (
            <div key={f.id}>
              <button onClick={() => onChange(f.config)}>☆ {f.name}</button>
              <details className="context-menu">
                <summary>•••</summary>
                <button onClick={() => setSave(f)}>Editar / renomear</button>
                <button
                  onClick={() =>
                    setSave({ ...f, id: undefined, name: f.name + " (cópia)" })
                  }
                >
                  Duplicar
                </button>
                <button
                  onClick={async () => {
                    try {
                      await api("filters/" + f.id, {}, "DELETE");
                      await refresh();
                    } catch (e) {
                      onError((e as Error).message);
                    }
                  }}
                >
                  Excluir
                </button>
              </details>
            </div>
          ))}
        </div>
        <details>
          <summary>Pesquisas recentes</summary>
          {prefs.history.map((h: any) => (
            <div className="stat-row" key={h.id}>
              <button onClick={() => onChange({ query: h.query })}>
                {h.query || "Todos os conteúdos"}
              </button>
              <button
                onClick={async () => {
                  try {
                    await api("history/" + h.id, {}, "DELETE");
                    await refresh();
                  } catch (e) {
                    onError((e as Error).message);
                  }
                }}
              >
                Apagar
              </button>
            </div>
          ))}
        </details>
        <p>
          Sugestões:{" "}
          {[
            "conteúdos sobre preço",
            "melhores Reels dos concorrentes",
            "posts sobre passeios",
          ].map((q) => (
            <button key={q} onClick={() => onChange({ query: q })}>
              {q}
            </button>
          ))}
        </p>
      </section>
      {result && (
        <>
          <section className="panel">
            <h2>Meus posts</h2>
            <Posts
              posts={result.posts.filter((p: any) => !p.profile.competitorId)}
              onError={onError}
            />
          </section>
          <section className="panel">
            <h2>Concorrentes</h2>
            <Posts
              posts={result.posts.filter((p: any) => p.profile.competitorId)}
              onError={onError}
            />
          </section>
          <section className="panel">
            <h2>Ideias e roteiros</h2>
            {result.ideas.length ? (
              result.ideas.map((i: any) => (
                <details key={i.id}>
                  <summary>
                    {i.title} · {i.status}
                  </summary>
                  <RenderData value={i.content} />
                  {i.scripts.map((s: any) => (
                    <RenderData key={s.id} value={s.content} />
                  ))}
                </details>
              ))
            ) : (
              <Empty
                title="Nenhuma ideia encontrada"
                text="Tente outro tema ou gere ideias após sincronizar."
              />
            )}
          </section>
          <section className="panel">
            <h2>Análises e insights</h2>
            {result.analyses.length ? (
              result.analyses.map((a: any) => (
                <div className="stat-row" key={a.id}>
                  <span>{a.result.resumo || a.kind}</span>
                  <button
                    onClick={async () => {
                      try {
                        onAnalysis({
                          ...a,
                          sources: await api("sources/" + a.id),
                        });
                      } catch (e) {
                        onError((e as Error).message);
                      }
                    }}
                  >
                    Abrir e ver fontes
                  </button>
                </div>
              ))
            ) : (
              <Empty
                title="Nenhuma análise encontrada"
                text="Análises salvas serão pesquisadas aqui."
              />
            )}
          </section>
          <small>
            {result.total} posts compatíveis · até 200 exibidos.
            {result.limited
              ? " Consulta limitada aos 1.000 posts mais recentes; refine os filtros."
              : ""}
          </small>
        </>
      )}
      {save && (
        <Modal title="Salvar visualização" onClose={() => setSave(null)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const fd = Object.fromEntries(new FormData(e.currentTarget));
                await api(
                  "filters" + (save.id ? "/" + save.id : ""),
                  { ...fd, config: save.config },
                  save.id ? "PATCH" : "POST",
                );
                setSave(null);
                await refresh();
              } catch (e) {
                onError((e as Error).message);
              }
            }}
          >
            <label>
              Nome
              <input name="name" required defaultValue={save.name} />
            </label>
            <label>
              Descrição
              <textarea name="description" defaultValue={save.description} />
            </label>
            <details>
              <summary>Critérios salvos</summary>
              <RenderData value={save.config} />
            </details>
            {save.id && (
              <button
                type="button"
                onClick={() => setSave({ ...save, config: filters })}
              >
                Usar critérios atuais da busca
              </button>
            )}
            <button className="primary">Salvar filtro</button>
          </form>
        </Modal>
      )}
    </>
  );
}
