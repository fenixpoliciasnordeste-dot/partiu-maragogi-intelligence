"use client";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  Users,
  Lightbulb,
  Settings,
  Search,
  Menu,
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  Plus,
  HelpCircle,
  LogOut,
  Compass,
  ChevronRight,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { api, Modal, Empty, Metric, Badge, num, date, RenderData } from "./ui";
import { Posts } from "./posts";
import { Tour } from "./tour";
import { timing } from "@/lib/timing";
import { Analysis, loadIdeaSources } from "./analysis";
import SettingsPanel from "./settings";
import SearchPanel from "./search";
import FinancePanel from "./finance";
const nav = [
  { id: "overview", name: "Visão geral", icon: LayoutDashboard },
  { id: "competitors", name: "Concorrentes", icon: Users },
  { id: "ideas", name: "Ideias", icon: Lightbulb },
  { id: "finance", name: "Financeiro", icon: WalletCards },
  { id: "settings", name: "Configurações", icon: Settings },
];
const statuses = [
  "Nova",
  "Salva",
  "Roteirizada",
  "Em produção",
  "Produzida",
  "Publicada",
  "Descartada",
];
export default function Dashboard() {
  const [page, setPage] = useState("overview"),
    [collapsed, setCollapsed] = useState(false),
    [data, setData] = useState<any>(null),
    [prefs, setPrefs] = useState<any>({
      filters: [],
      history: [],
      tutorials: [],
    }),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [platform, setPlatform] = useState("Todos"),
    [period, setPeriod] = useState(30),
    [metric, setMetric] = useState("followers"),
    [sort, setSort] = useState("recentes"),
    [modal, setModal] = useState<any>(null),
    [analysis, setAnalysis] = useState<any>(null),
    [tour, setTour] = useState(0),
    [query, setQuery] = useState(""),
    [searchConfig, setSearchConfig] = useState<any>(null),
    [ideaFilters, setIdeaFilters] = useState<any>({
      plataforma: "Todos",
      objetivo: "Alcance",
      formato: "Todos",
      funil: "Todos",
      status: "Todas",
    }),
    [rank, setRank] = useState("growth"),
    [selectedCompetitor, setSelectedCompetitor] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([api("dashboard"), api("preferences")]);
      setData(d);
      setPrefs(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(location.search).get("page");
    if (nav.some((n) => n.id === p)) setPage(p!);
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!data?.jobs.some((j: any) => ["QUEUED", "RUNNING"].includes(j.status)))
      return;
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [data?.jobs, refresh]);
  const act = async (fn: () => Promise<any>, label = "Salvando…") => {
    setBusy(label);
    setError("");
    try {
      const result = await fn();
      await refresh();
      return result;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const sync = (target = "all") =>
    act(async () => {
      await api("sync", { target });
      setNotice(
        "Sincronização iniciada. Você pode continuar usando a plataforma.",
      );
    }, "Iniciando coleta…");
  const prepareAI = async (action: string, id = "all") => {
    const estimate = await act(
      () => api("ai/estimate?id=" + encodeURIComponent(id)),
      "Preparando análise…",
    );
    if (estimate) setModal({ type: "ai", action, id, estimate });
  };
  const runAI = async (force = false) => {
    const m = modal;
    setModal(null);
    const result = await act(
      () =>
        api("ai", { action: m.action, id: m.id, filters: ideaFilters, force }),
      `Analisando até ${m.estimate.posts} publicações…`,
    );
    if (result) setAnalysis(result);
  };
  const go = (id: string) => {
    void refresh();
    setPage(id);
    setTour(0);
    setSearchConfig(null);
    history.replaceState(null, "", "/?page=" + id);
  };
  const profiles = (data?.profiles || []).filter(
    (p: any) =>
      !p.competitorId && (platform === "Todos" || p.platform === platform),
  );
  const allPosts = profiles.flatMap((p: any) =>
    p.posts.map((x: any) => ({ ...x, profile: p })),
  );
  const posts = allPosts
    .filter(
      (p: any) =>
        !period || Date.now() - +new Date(p.publishedAt) <= period * 86400000,
    )
    .sort((a: any, b: any) =>
      sort === "recentes"
        ? +new Date(b.publishedAt) - +new Date(a.publishedAt)
        : ((sort === "score"
            ? b.score
            : sort === "engagement"
              ? b.engagement
              : b.metrics[sort]) ?? -Infinity) -
          ((sort === "score"
            ? a.score
            : sort === "engagement"
              ? a.engagement
              : a.metrics[sort]) ?? -Infinity),
    );
  const total = (key: string) => {
    const values = profiles.map((p: any) => p.snapshots[0]?.[key]);
    return values.length && values.every((v: any) => v != null)
      ? values.reduce((s: number, v: number) => s + v, 0)
      : null;
  };
  const avg = (values: any[]) => {
    const nums = values.filter((v: any) => v != null);
    return nums.length
      ? nums.reduce((s: number, n: number) => s + n, 0) / nums.length
      : null;
  };
  const sumPosts = (key: string) =>
    posts.length && posts.every((p: any) => p.metrics[key] != null)
      ? posts.reduce((s: number, p: any) => s + p.metrics[key], 0)
      : null;
  const growths = profiles.map((p: any) => p.growth[30]);
  const growth30 =
    growths.length && growths.every((g: any) => g)
      ? growths.reduce((s: number, g: any) => s + g.absolute, 0)
      : null;
  const chartMap = new Map<string, any>();
  for (const p of profiles) {
    for (const s of [...p.snapshots].reverse()) {
      if (period && Date.now() - +new Date(s.capturedAt) > period * 86400000)
        continue;
      const day = new Date(s.capturedAt).toISOString().slice(0, 10);
      const row = chartMap.get(day) || { day };
      row[p.platform] = s[metric];
      chartMap.set(day, row);
    }
  }
  const chart = [...chartMap.values()].sort((a, b) =>
    a.day.localeCompare(b.day),
  );
  const metricNames: Record<string, string> = {
    followers: "Seguidores",
    views: "Visualizações",
    reach: "Alcance",
    engagement: "Engajamento",
    likes: "Curtidas",
    comments: "Comentários",
    postsCount: "Publicações",
  };
  if (["likes", "comments", "engagement"].includes(metric)) {
    chartMap.clear();
    for (const row of data?.postHistory || []) {
      if (platform !== "Todos" && row.platform !== platform) continue;
      if (period && Date.now() - +new Date(row.day) > period * 86400000)
        continue;
      const value = chartMap.get(row.day) || { day: row.day };
      value[row.platform] = row[metric];
      chartMap.set(row.day, value);
    }
    chart.splice(
      0,
      chart.length,
      ...[...chartMap.values()].sort((a, b) => a.day.localeCompare(b.day)),
    );
  }
  const bestTiming = timing(posts);
  const bestPost = posts
    .filter((p: any) => p.score != null)
    .slice()
    .sort((a: any, b: any) => b.score - a.score)[0];
  const cp = data?.profiles.find(
    (p: any) => p.competitorId === selectedCompetitor,
  );
  const own = profiles.find((p: any) => p.platform === cp?.platform);
  const ideas = (data?.ideas || []).filter(
    (i: any) =>
      (ideaFilters.plataforma === "Todos" ||
        i.content.plataforma === ideaFilters.plataforma) &&
      (ideaFilters.status === "Todas" || i.status === ideaFilters.status),
  );
  const competitorValue = (c: any) => {
    const p = data.profiles.find((p: any) => p.competitorId === c.id);
    if (!p) return null;
    if (rank === "growth") return p.growth[30]?.percent;
    const recent = p.posts.filter(
      (x: any) => Date.now() - +new Date(x.publishedAt) < 30 * 86400000,
    );
    if (recent.length < 5) return null;
    return rank === "engagement"
      ? avg(recent.map((x: any) => x.engagement))
      : rank === "frequency"
        ? (recent.length / 30) * 7
        : avg(recent.map((x: any) => x.score));
  };
  const copy = async (value: any) => {
    try {
      await navigator.clipboard.writeText(
        typeof value === "string" ? value : JSON.stringify(value, null, 2),
      );
      setNotice("Copiado.");
    } catch {
      setError(
        "Não foi possível copiar. Selecione o texto e copie manualmente.",
      );
    }
  };
  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <a className="wordmark" href="/">
          PARTIU{" "}
          <strong>
            MARAGOGI<span>↗</span>
          </strong>
          <small>INTELLIGENCE</small>
        </a>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={20} />
              <span>{n.name}</span>
              {page === n.id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-mark">
            <Compass />
            <span>
              Partiu Maragogi<small>Turismo · Alagoas</small>
            </span>
          </div>
          <button
            onClick={() =>
              void api("auth/logout", {}, "POST").then(
                () => (location.href = "/login"),
              )
            }
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            aria-label="Recolher menu"
            onClick={() => setCollapsed(!collapsed)}
          >
            <Menu size={20} />
          </button>
          <form
            className="global-search"
            data-tour="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchConfig({ query });
              setTour(0);
            }}
          >
            <Search size={18} />
            <input
              aria-label="Busca global"
              placeholder="Pesquisar conteúdos, concorrentes, temas ou insights..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit">Buscar</button>
          </form>
          <button
            aria-label="Ajuda desta página"
            onClick={() => setTour(tour + 1)}
          >
            <HelpCircle size={21} />
          </button>
          <div className="avatar">PM</div>
        </header>
        <main className="content">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>
              {searchConfig
                ? "Busca inteligente"
                : nav.find((n) => n.id === page)?.name}
            </span>
          </div>
          {error && (
            <div className="banner error" role="alert">
              {error}
              <button onClick={() => setError("")}>Fechar</button>
            </div>
          )}
          {notice && (
            <div className="banner info" role="status">
              {notice}
              <button onClick={() => setNotice("")}>Fechar</button>
            </div>
          )}
          {busy && (
            <div className="banner info" role="status">
              <RefreshCw className="spin" size={16} />
              {busy}
            </div>
          )}
          {!data ? (
            <>
              <h1>Partiu Maragogi Intelligence</h1>
              {error ? (
                <button onClick={() => void refresh()}>Tentar novamente</button>
              ) : (
                <div className="skeleton-grid">
                  {[1, 2, 3, 4].map((i) => (
                    <div className="skeleton" key={i} />
                  ))}
                </div>
              )}
            </>
          ) : searchConfig ? (
            <SearchPanel
              config={searchConfig}
              prefs={prefs}
              profiles={data.profiles}
              onChange={setSearchConfig}
              onError={setError}
              refresh={refresh}
              onAnalysis={setAnalysis}
              onAI={prepareAI}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">PARTIU MARAGOGI INTELLIGENCE</div>
                  <h1>{nav.find((n) => n.id === page)?.name}</h1>
                  <p>
                    {page === "overview"
                      ? "Entenda seu crescimento. Descubra o próximo passo."
                      : page === "competitors"
                        ? "Observe o mercado. Encontre espaço para o seu conteúdo."
                      : page === "ideas"
                          ? "Transforme evidências em conteúdo original."
                          : page === "finance"
                            ? "Acompanhe receitas, gastos e lucro em um só lugar."
                            : "Suas conexões, seu orçamento e seu controle."}
                  </p>
                </div>
                <div className="actions">
                  {page === "overview" ? (
                    <>
                      <button onClick={() => void sync()} disabled={!!busy}>
                        <RefreshCw size={16} />
                        Atualizar agora
                      </button>
                      <button
                        className="primary"
                        data-tour="analyze"
                        disabled={!!busy}
                        onClick={() => void prepareAI("profile")}
                      >
                        <Sparkles size={16} />
                        Analisar perfil com IA
                      </button>
                    </>
                  ) : page === "competitors" ? (
                    <button
                      className="primary"
                      data-tour="add-competitor"
                      onClick={() => setModal({ type: "competitor" })}
                    >
                      <Plus size={18} />
                      Adicionar concorrente
                    </button>
                  ) : page === "ideas" ? (
                    <button
                      className="primary"
                      data-tour="generate-ideas"
                      disabled={!!busy}
                      onClick={() => void prepareAI("ideas")}
                    >
                      <Sparkles size={17} />
                      Gerar novas ideias
                    </button>
                  ) : null}
                </div>
              </div>
              {page === "overview" && (
                <>
                  <div className="toolbar">
                    <div className="segmented">
                      {["Todos", "Instagram"].map((p) => (
                        <button
                          className={platform === p ? "selected" : ""}
                          onClick={() => setPlatform(p)}
                          key={p}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <select
                      aria-label="Período"
                      value={period}
                      onChange={(e) => setPeriod(Number(e.target.value))}
                    >
                      {[
                        [7, "7 dias"],
                        [30, "30 dias"],
                        [90, "90 dias"],
                        [180, "6 meses"],
                        [365, "1 ano"],
                        [0, "Todo período"],
                      ].map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!profiles.length ? (
                    <section className="connect-panel">
                      <div>
                        <Badge tone="info">PRIMEIRO PASSO</Badge>
                        <h2>Conecte seu primeiro perfil.</h2>
                        <p>
                          Sua estratégia começa com dados reais.
                          <br />
                          Conecte uma conta para acompanhar a evolução.
                        </p>
                        <div className="actions">
                          <button className="primary" onClick={() => go("settings")}>
                            Configurar Apify <ArrowUpRight size={17} />
                          </button>
                        </div>
                      </div>
                      <div className="connect-note">
                        <Compass size={38} />
                        <strong>
                          Uma visão clara
                          <br />
                          do seu conteúdo.
                        </strong>
                        <span>Coleta oficial → Histórico → Inteligência</span>
                      </div>
                    </section>
                  ) : (
                    <div className="profile-strip">
                      {profiles.map((p: any) => (
                        <div key={p.id}>
                          {p.avatar ? (
                            <img src={p.avatar} alt={p.name} />
                          ) : (
                            <div className="avatar">PM</div>
                          )}
                          <span>
                            <strong>{p.name}</strong>
                            <small>
                              @{p.username} · {p.platform} ·{" "}
                              {num(p.snapshots[0]?.following)} seguindo
                            </small>
                            <small>Última coleta: {date(p.lastSync)}</small>
                          </span>
                          <Badge tone="info">
                            {data.accounts.find(
                              (a: any) => a.platform === p.platform,
                            )?.status || "Sem conexão"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="metric-grid" data-tour="indicators">
                    <Metric label="Seguidores" value={total("followers")} />
                    <Metric
                      label="Crescimento 30d"
                      value={growth30}
                      detail="DADO CALCULADO · diferença entre snapshots"
                      tone={growth30 < 0 ? "negative" : "positive"}
                    />
                    <Metric
                      label="Visualizações dos posts"
                      value={sumPosts("views")}
                      detail="DADO CALCULADO · soma cumulativa dos posts do período"
                    />
                    <Metric
                      label="Engajamento médio"
                      value={
                        avg(posts.map((p: any) => p.engagement)) == null
                          ? null
                          : num(avg(posts.map((p: any) => p.engagement))) + "%"
                      }
                      detail="DADO CALCULADO · curtidas + comentários / seguidores"
                    />
                  </div>
                  <section className="panel" data-tour="chart">
                    <div className="section-heading">
                      <div>
                        <h2>Evolução do perfil</h2>
                        <p>
                          Um ponto por dia. Views e alcance do perfil: janela de
                          24h; curtidas e comentários: totais cumulativos dos
                          posts coletados.
                        </p>
                      </div>
                      <select
                        value={metric}
                        aria-label="Métrica do gráfico"
                        onChange={(e) => setMetric(e.target.value)}
                      >
                        {Object.entries(metricNames).map(([v, l]) => (
                          <option value={v} key={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </div>
                    {chart.some((row) =>
                      profiles.some((p: any) => row[p.platform] != null),
                    ) ? (
                      <div className="chart">
                        <ResponsiveContainer>
                          <LineChart data={chart}>
                            <CartesianGrid
                              stroke="#e7edef"
                              strokeDasharray="3 3"
                            />
                            <XAxis
                              dataKey="day"
                              tickFormatter={(v) =>
                                v.slice(5).split("-").reverse().join("/")
                              }
                            />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {profiles.map((p: any, i: number) => (
                              <Line
                                key={p.id}
                                dataKey={p.platform}
                                stroke={i ? "#6c5ce7" : "#008b8b"}
                                strokeWidth={2}
                                dot={false}
                                connectNulls={false}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <Empty
                        title="O histórico começa na primeira coleta"
                        text="Sincronize sua conta para visualizar esta métrica. Dado não disponibilizado pela API."
                      />
                    )}
                  </section>
                  <div className="metric-grid compact">
                    <Metric
                      label="Posts no período"
                      value={profiles.length ? posts.length : null}
                      detail="DADO CALCULADO · publicações coletadas"
                    />
                    <Metric
                      label="Média semanal"
                      value={
                        posts.length && period
                          ? (posts.length / period) * 7
                          : null
                      }
                      detail="DADO CALCULADO · período selecionado"
                    />
                    <Metric
                      label="Melhor formato"
                      value={
                        posts.length >= 6
                          ? [...new Set(posts.map((p: any) => p.format))]
                              .map((f) => ({
                                f,
                                score: avg(
                                  posts
                                    .filter((p: any) => p.format === f)
                                    .map((p: any) => p.score),
                                ),
                              }))
                              .filter((x) => x.score != null)
                              .sort((a, b) => b.score! - a.score!)[0]?.f || "—"
                          : "—"
                      }
                      detail="DADO CALCULADO · média dos scores por formato"
                    />
                    <Metric
                      label="Formato mais utilizado"
                      value={
                        posts.length
                          ? [...new Set(posts.map((p: any) => p.format))].sort(
                              (a, b) =>
                                posts.filter((p: any) => p.format === b)
                                  .length -
                                posts.filter((p: any) => p.format === a).length,
                            )[0]
                          : "—"
                      }
                      detail="DADO CALCULADO · publicações do período"
                    />
                  </div>
                  <div className="metric-grid compact">
                    <Metric
                      label="Melhor publicação"
                      value={bestPost?.caption?.slice(0, 70) || "—"}
                      detail="DADO CALCULADO · maior score do período"
                    />
                    <Metric
                      label="Melhor dia"
                      value={bestTiming.day || "—"}
                      detail="DADO CALCULADO · mínimo 20 posts e 3 por grupo"
                    />
                    <Metric
                      label="Melhor horário"
                      value={bestTiming.hour ? bestTiming.hour + "h" : "—"}
                      detail="DADO CALCULADO · mínimo 30 posts e 3 por grupo · Maceió"
                    />
                    <Metric
                      label="Histórico disponível"
                      value={
                        profiles.length
                          ? profiles
                              .map((p: any) => p.snapshots.length)
                              .reduce((a: number, b: number) => a + b, 0)
                          : null
                      }
                      detail="Snapshots reais preservados"
                    />
                  </div>
                  <div className="two-columns">
                    <section className="panel">
                      <h2>Crescimento por período</h2>
                      {[7, 30, 90].map((d) => (
                        <div className="stat-row" key={d}>
                          <span>{d} dias</span>
                          {profiles.length ? (
                            profiles.map((p: any) => (
                              <span key={p.id}>
                                {p.platform}:{" "}
                                <strong>{num(p.growth[d]?.absolute)}</strong> (
                                {num(p.growth[d]?.percent)}%)
                              </span>
                            ))
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      ))}
                      <small>
                        Sem snapshot de referência suficiente, o crescimento
                        fica indisponível.
                      </small>
                    </section>
                    <section className="panel">
                      <h2>Última leitura da IA</h2>
                      {data.analyses.find((a: any) => a.kind === "profile") ? (
                        <>
                          <p>
                            {
                              data.analyses.find(
                                (a: any) => a.kind === "profile",
                              ).result.resumo
                            }
                          </p>
                          <button
                            onClick={() =>
                              setAnalysis(
                                data.analyses.find(
                                  (a: any) => a.kind === "profile",
                                ),
                              )
                            }
                          >
                            Ver análise e fontes →
                          </button>
                        </>
                      ) : (
                        <Empty
                          title="O que os dados estão dizendo?"
                          text="Após a coleta, solicite uma análise com evidências."
                        />
                      )}
                    </section>
                  </div>
                  <section className="panel">
                    <h2>Histórico das análises</h2>
                    <div className="actions">
                      {[0, 7, 30, 90].map((days) => {
                        const a = data.analyses.find(
                          (a: any) =>
                            a.kind === "profile" &&
                            (!days ||
                              +new Date(a.createdAt) <=
                                Date.now() - days * 86400000),
                        );
                        return (
                          <button
                            key={days}
                            disabled={!a}
                            onClick={() => {
                              if (!days) setAnalysis(a);
                              else
                                setModal({
                                  type: "history",
                                  previous: a,
                                  current: data.analyses.find(
                                    (x: any) => x.kind === "profile",
                                  ),
                                });
                            }}
                          >
                            {days ? days + " dias atrás" : "Agora"}
                          </button>
                        );
                      })}
                    </div>
                    <small>
                      Usa a análise salva mais recente anterior à data
                      escolhida. As datas efetivas aparecem na comparação.
                    </small>
                  </section>
                  <section className="panel" data-tour="posts">
                    <div className="section-heading">
                      <div>
                        <h2>Suas publicações</h2>
                        <p>
                          Desempenho relativo, sem promessas de viralização.
                        </p>
                      </div>
                      <div className="actions">
                        <button
                          onClick={() =>
                            setSearchConfig({
                              query: "",
                              origin: "Meu perfil",
                              platform,
                              days: period,
                            })
                          }
                        >
                          <SlidersHorizontal size={15} />
                          Filtros salvos
                        </button>
                        <select
                          value={sort}
                          aria-label="Ordenação"
                          onChange={(e) => setSort(e.target.value)}
                        >
                          {[
                            "recentes",
                            "views",
                            "likes",
                            "comments",
                            "engagement",
                            "score",
                          ].map((s) => (
                            <option key={s} value={s}>
                              {
                                {
                                  recentes: "Mais recentes",
                                  views: "Visualizações",
                                  likes: "Curtidas",
                                  comments: "Comentários",
                                  engagement: "Engajamento",
                                  score: "Score",
                                }[s]
                              }
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Posts posts={posts} onError={setError} />
                  </section>
                </>
              )}
              {page === "competitors" && (
                <>
                  <div className="toolbar">
                    <span>{data.competitors.length} perfis acompanhados</span>
                    <div className="actions">
                      <button
                        onClick={() =>
                          setSearchConfig({ query: "", origin: "Concorrentes" })
                        }
                      >
                        Filtros salvos
                      </button>
                      <select
                        aria-label="Ranking"
                        value={rank}
                        onChange={(e) => setRank(e.target.value)}
                      >
                        <option value="growth">Ranking: crescimento 30d</option>
                        <option value="engagement">Ranking: engajamento</option>
                        <option value="frequency">Ranking: frequência</option>
                        <option value="performance">
                          Ranking: desempenho relativo
                        </option>
                      </select>
                      <button onClick={() => void sync()}>
                        Atualizar agora
                      </button>
                    </div>
                  </div>
                  <div className="competitor-grid" data-tour="competitor-list">
                    {data.competitors.length ? (
                      data.competitors
                        .slice()
                        .sort(
                          (a: any, b: any) =>
                            (competitorValue(b) ?? -Infinity) -
                            (competitorValue(a) ?? -Infinity),
                        )
                        .map((c: any) => {
                          const p = data.profiles.find(
                            (p: any) => p.competitorId === c.id,
                          );
                          return (
                            <article
                              className="panel competitor-card"
                              key={c.id}
                            >
                              <div className="section-heading">
                                <div className="profile-title">
                                  {p?.avatar ? (
                                    <img src={p.avatar} alt={c.name} />
                                  ) : (
                                    <div className="avatar">
                                      {c.name.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <h3>{c.name}</h3>
                                    <small>@{c.username}</small>
                                  </div>
                                </div>
                                <Badge
                                  tone={
                                    c.status === "SUCCESS"
                                      ? "success"
                                      : c.status === "ERROR"
                                        ? "warning"
                                        : "muted"
                                  }
                                >
                                  {c.status === "SUCCESS"
                                    ? "Conectado"
                                    : c.status === "ERROR"
                                      ? "Atenção"
                                      : "Aguardando"}
                                </Badge>
                              </div>
                              <Badge>{c.platform}</Badge>
                              <div className="mini-grid">
                                <div>
                                  <small>Seguidores</small>
                                  <h3>{num(p?.snapshots[0]?.followers)}</h3>
                                </div>
                                <div>
                                  <small>Crescimento 30d</small>
                                  <h3>{num(p?.growth[30]?.percent)}%</h3>
                                </div>
                                <div>
                                  <small>Publicações</small>
                                  <h3>{num(p?.snapshots[0]?.postsCount)}</h3>
                                </div>
                              </div>
                              <small>Atualização: {date(p?.lastSync)}</small>
                              {competitorValue(c) == null ? (
                                <p className="muted">
                                  Dados insuficientes para ranking.
                                </p>
                              ) : (
                                <p>
                                  Indicador do ranking:{" "}
                                  {num(competitorValue(c))}
                                </p>
                              )}
                              {c.lastError && (
                                <p className="warning-text">{c.lastError}</p>
                              )}
                              <div className="actions">
                                <button
                                  className="primary"
                                  onClick={() => {
                                    const a = data.analyses.find(
                                      (a: any) =>
                                        a.kind === "competitor" &&
                                        a.subjectId === c.id,
                                    );
                                    if (a) setAnalysis(a);
                                    else void prepareAI("competitor", c.id);
                                  }}
                                >
                                  Ver análise
                                </button>
                                <button
                                  onClick={() =>
                                    void sync("competitor:" + c.id)
                                  }
                                  aria-label="Atualizar concorrente"
                                >
                                  <RefreshCw size={15} />
                                </button>
                                <button
                                  onClick={() => setSelectedCompetitor(c.id)}
                                >
                                  Comparar
                                </button>
                                <details className="context-menu">
                                  <summary>•••</summary>
                                  <button
                                    onClick={() =>
                                      setModal({
                                        type: "competitor",
                                        competitor: c,
                                      })
                                    }
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() =>
                                      setModal({
                                        type: "delete",
                                        competitor: c,
                                      })
                                    }
                                  >
                                    Excluir
                                  </button>
                                  <button
                                    onClick={() =>
                                      void prepareAI("competitor", c.id)
                                    }
                                  >
                                    Reanalisar
                                  </button>
                                </details>
                              </div>
                            </article>
                          );
                        })
                    ) : (
                      <Empty
                        title="Adicione seu primeiro concorrente."
                        text="Compare dados oficiais e descubra oportunidades para a Partiu Maragogi."
                      />
                    )}
                  </div>
                  {cp && (
                    <section className="panel">
                      <h2>Meu perfil × {cp.name}</h2>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Indicador</th>
                              <th>{own?.name || "Meu perfil não conectado"}</th>
                              <th>{cp.name}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ["Seguidores", "followers"],
                              ["Publicações", "postsCount"],
                            ].map(([l, k]) => (
                              <tr key={k}>
                                <td>{l}</td>
                                <td>{num(own?.snapshots[0]?.[k])}</td>
                                <td>{num(cp.snapshots[0]?.[k])}</td>
                              </tr>
                            ))}
                            <tr>
                              <td>Crescimento 30d</td>
                              <td>{num(own?.growth[30]?.percent)}%</td>
                              <td>{num(cp.growth[30]?.percent)}%</td>
                            </tr>
                            <tr>
                              <td>Engajamento público médio</td>
                              <td>
                                {num(
                                  avg(
                                    own?.posts.map((p: any) => p.engagement) ||
                                      [],
                                  ),
                                )}
                                %
                              </td>
                              <td>
                                {num(
                                  avg(cp.posts.map((p: any) => p.engagement)),
                                )}
                                %
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <button
                        onClick={() =>
                          void prepareAI("competitor", cp.competitorId)
                        }
                      >
                        Comparar temas, formatos e oportunidades com IA
                      </button>
                      <Posts
                        posts={cp.posts.map((p: any) => ({
                          ...p,
                          profile: cp,
                        }))}
                        onError={setError}
                      />
                    </section>
                  )}
                  <section className="panel" data-tour="opportunities">
                    <div className="section-heading">
                      <h2>Oportunidades de conteúdo</h2>
                      <Badge tone="info">INTERPRETAÇÃO DA IA</Badge>
                    </div>
                    {data.analyses.filter((a: any) => a.kind === "competitor")
                      .length ? (
                      data.analyses
                        .filter((a: any) => a.kind === "competitor")
                        .slice(0, 5)
                        .map((a: any) => (
                          <div className="stat-row" key={a.id}>
                            <span>
                              {a.result.resumo}
                              <small>
                                {date(a.createdAt)} · {a.sources.length} fontes
                              </small>
                            </span>
                            <button onClick={() => setAnalysis(a)}>
                              Ver oportunidades e fontes →
                            </button>
                          </div>
                        ))
                    ) : (
                      <Empty
                        title="O próximo assunto pode estar nos dados"
                        text="Analise um concorrente com publicações coletadas para encontrar oportunidades."
                      />
                    )}
                  </section>
                </>
              )}
              {page === "ideas" && (
                <>
                  <div className="toolbar wrap">
                    {Object.entries({
                      plataforma: ["Todos", "Instagram"],
                      objetivo: [
                        "Alcance",
                        "Seguidores",
                        "Engajamento",
                        "Autoridade",
                        "Leads",
                        "Conversão",
                      ],
                      formato: [
                        "Todos",
                        "Reel",
                        "Carrossel",
                        "Story",
                        "Post",
                        "Vídeo curto",
                      ],
                      funil: ["Todos", "Topo", "Meio", "Fundo"],
                      status: ["Todas", ...statuses],
                    }).map(([k, values]) => (
                      <label key={k} className="inline-label">
                        {k}
                        <select
                          value={ideaFilters[k]}
                          onChange={(e) =>
                            setIdeaFilters({
                              ...ideaFilters,
                              [k]: e.target.value,
                            })
                          }
                        >
                          {values.map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="metric-grid" data-tour="idea-performance">
                    <Metric
                      label="Ideias IA publicadas"
                      value={
                        data.ideas.filter(
                          (i: any) => i.status === "Publicada" && i.postId,
                        ).length
                      }
                      detail="DADO CALCULADO · vinculadas a posts reais"
                    />
                    <Metric
                      label="Ideias em produção"
                      value={
                        data.ideas.filter(
                          (i: any) => i.status === "Em produção",
                        ).length
                      }
                      detail="DADO CALCULADO · banco de ideias"
                    />
                    <Metric
                      label="Média de desempenho"
                      value={avg(
                        data.ideas
                          .filter((i: any) => i.postId)
                          .map(
                            (i: any) =>
                              allPosts.find((p: any) => p.id === i.postId)
                                ?.score,
                          ),
                      )}
                      detail="DADO CALCULADO · média dos scores vinculados"
                    />
                    <Metric
                      label="Ideias abaixo da média"
                      value={
                        data.ideas.filter(
                          (i: any) =>
                            i.postId &&
                            allPosts.find((p: any) => p.id === i.postId)
                              ?.score < 50,
                        ).length
                      }
                      detail="DADO CALCULADO · score abaixo de 50"
                    />
                  </div>
                  <div className="ideas-grid" data-tour="idea-list">
                    {ideas.length ? (
                      ideas.map((i: any) => (
                        <article className="panel idea-card" key={i.id}>
                          <div className="actions">
                            <Badge tone="info">{i.content.plataforma}</Badge>
                            <Badge>{i.content.formato}</Badge>
                            <Badge>
                              {i.content.funil || "Funil não definido"}
                            </Badge>
                          </div>
                          <h2>{i.title}</h2>
                          <blockquote>{i.content.gancho}</blockquote>
                          <p>{i.content.justificativa}</p>
                          <div className="idea-meta">
                            <span>
                              Objetivo: <strong>{i.content.objetivo}</strong>
                            </span>
                            <span>
                              Potencial: <strong>{i.content.potencial}</strong>{" "}
                              · IA
                            </span>
                            <span>
                              Dificuldade:{" "}
                              <strong>
                                {i.content.dificuldade || "Não definida"}
                              </strong>
                            </span>
                          </div>
                          <details>
                            <summary>Dados utilizados</summary>
                            <p>
                              {i.content.dados_utilizados ||
                                i.content.sinal_observado}
                            </p>
                          </details>
                          <div className="actions">
                            <button
                              onClick={() =>
                                void act(async () => {
                                  const sources = await loadIdeaSources(i);
                                  setAnalysis({
                                    result: i.content,
                                    sources,
                                    createdAt: i.createdAt,
                                  });
                                })
                              }
                            >
                              Ver fontes
                            </button>
                            <button onClick={() => void copy(i.content)}>
                              Copiar
                            </button>
                            <button
                              onClick={() =>
                                void act(() =>
                                  api(
                                    "ideas/" + i.id,
                                    { status: "Salva" },
                                    "PATCH",
                                  ),
                                )
                              }
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() =>
                                void act(() =>
                                  api(
                                    "ideas/" + i.id,
                                    { status: "Descartada" },
                                    "PATCH",
                                  ),
                                )
                              }
                            >
                              Descartar
                            </button>
                          </div>
                          <div className="actions">
                            <button
                              className="primary"
                              onClick={() => void prepareAI("script", i.id)}
                            >
                              Gerar roteiro
                            </button>
                            <button
                              onClick={() => void prepareAI("execution", i.id)}
                            >
                              Gerar prompt
                            </button>
                          </div>
                          <label>
                            Status
                            <select
                              value={i.status}
                              onChange={(e) =>
                                void act(() =>
                                  api(
                                    "ideas/" + i.id,
                                    { status: e.target.value },
                                    "PATCH",
                                  ),
                                )
                              }
                            >
                              {statuses.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Vincular publicação real
                            <select
                              value={i.postId || ""}
                              onChange={(e) =>
                                void act(() =>
                                  api(
                                    "ideas/" + i.id,
                                    { postId: e.target.value || null },
                                    "PATCH",
                                  ),
                                )
                              }
                            >
                              <option value="">Sem publicação vinculada</option>
                              {allPosts.map((p: any) => (
                                <option key={p.id} value={p.id}>
                                  {p.caption.slice(0, 65) || p.externalId}
                                </option>
                              ))}
                            </select>
                          </label>
                          {i.scripts.length > 0 && (
                            <details>
                              <summary>
                                Roteiros e prompts ({i.scripts.length})
                              </summary>
                              {i.scripts.map((s: any) => (
                                <div key={s.id}>
                                  <button
                                    onClick={() =>
                                      setModal({ type: "script", script: s })
                                    }
                                  >
                                    {s.kind === "script" ? "Roteiro" : "Prompt"}{" "}
                                    · {date(s.createdAt)}
                                  </button>
                                </div>
                              ))}
                            </details>
                          )}
                        </article>
                      ))
                    ) : (
                      <Empty
                        title="Seu próximo conteúdo começa aqui"
                        text="Gere ideias a partir das publicações coletadas e dos padrões dos concorrentes."
                      />
                    )}
                  </div>
                </>
              )}
              {page === "settings" && (
                <SettingsPanel
                  data={data}
                  act={act}
                  onTour={(p: string) => {
                    go(p);
                    setTour(tour + 1);
                  }}
                  onSync={() => void sync()}
                />
              )}
              {page === "finance" && (
                <FinancePanel entries={data.financialEntries || []} act={act} />
              )}
            </>
          )}
          <footer className="footer">
            <span>
              PARTIU MARAGOGI <strong>INTELLIGENCE</strong>
            </span>
            <span>
              <i className="legend-dot" />
              API real <i className="legend-dot blue" />
              Cálculo do sistema <i className="legend-dot purple" />
              Interpretação da IA
            </span>
          </footer>
        </main>
      </div>
      {data && (
        <Tour
          key={(searchConfig ? "search" : page) + tour}
          page={searchConfig ? "search" : page}
          progress={prefs.tutorials.find(
            (t: any) => t.page === (searchConfig ? "search" : page),
          )}
          restart={tour}
          onDone={() => void refresh()}
        />
      )}
      {modal?.type === "ai" && (
        <Modal
          title="Preparar análise com Gemini"
          onClose={() => setModal(null)}
        >
          <p>
            Esta operação pode utilizar até{" "}
            <strong>{modal.estimate.posts} publicações</strong> do contexto
            selecionado.
          </p>
          <p>{modal.estimate.message}</p>
          <p>
            As tarifas e os limites configurados serão conferidos antes de
            qualquer chamada. O resultado será identificado como interpretação
            da IA.
          </p>
          <div className="actions">
            <button className="primary" onClick={() => void runAI(false)}>
              Analisar
            </button>
            <button onClick={() => void runAI(true)}>
              Forçar nova análise
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === "competitor" && (
        <Modal
          title={
            modal.competitor ? "Editar concorrente" : "Adicionar concorrente"
          }
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = Object.fromEntries(new FormData(e.currentTarget));
              void act(async () => {
                await api(
                  "competitors" +
                    (modal.competitor ? "/" + modal.competitor.id : ""),
                  form,
                  modal.competitor ? "PATCH" : "POST",
                );
                setModal(null);
              });
            }}
          >
            <label>
              Nome
              <input
                required
                name="name"
                defaultValue={modal.competitor?.name}
              />
            </label>
            <label>
              Username
              <input
                required
                name="username"
                readOnly={!!modal.competitor}
                defaultValue={modal.competitor?.username}
                placeholder="partiumaragogi"
              />
            </label>
            <label>
              Plataforma
              <select
                name="platform"
                disabled={!!modal.competitor}
                defaultValue={modal.competitor?.platform || "Instagram"}
              >
                <option>Instagram</option>
              </select>
            </label>
            <label>
              URL
              <input
                name="url"
                type="url"
                defaultValue={modal.competitor?.url}
              />
            </label>
            <label>
              Categoria
              <input
                name="category"
                defaultValue={modal.competitor?.category}
                placeholder="Turismo, passeios, hospedagem…"
              />
            </label>
            <label>
              Observações
              <textarea name="notes" defaultValue={modal.competitor?.notes} />
            </label>
            <p className="muted">
              Apenas perfis públicos do Instagram podem ser coletados pela Apify. Limite: 5 concorrentes ativos.
            </p>
            <button className="primary" disabled={!!busy}>
              Salvar {modal.competitor ? "" : "e sincronizar"}
            </button>
          </form>
        </Modal>
      )}
      {modal?.type === "delete" && (
        <Modal title="Excluir concorrente?" onClose={() => setModal(null)}>
          <p>
            {modal.competitor.name} sairá do acompanhamento. Snapshots e
            análises anteriores serão preservados.
          </p>
          <button
            className="danger"
            onClick={() =>
              void act(async () => {
                await api("competitors/" + modal.competitor.id, {}, "DELETE");
                setModal(null);
              })
            }
          >
            Excluir do acompanhamento
          </button>
        </Modal>
      )}
      {modal?.type === "history" && (
        <Modal title="Comparar análises salvas" onClose={() => setModal(null)}>
          <Badge tone="info">INTERPRETAÇÃO DA IA</Badge>
          <div className="two-columns">
            <div>
              <h3>Anterior · {date(modal.previous.createdAt)}</h3>
              <RenderData value={modal.previous.result} />
            </div>
            <div>
              <h3>Atual · {date(modal.current.createdAt)}</h3>
              <RenderData value={modal.current.result} />
            </div>
          </div>
        </Modal>
      )}
      {modal?.type === "script" && (
        <Modal
          title={
            modal.script.kind === "script"
              ? "Roteiro temporal"
              : "Prompt de execução"
          }
          onClose={() => setModal(null)}
        >
          <button
            onClick={() =>
              void copy(modal.script.content.prompt || modal.script.content)
            }
          >
            Copiar {modal.script.kind === "script" ? "roteiro" : "prompt"}
          </button>
          <RenderData value={modal.script.content} />
        </Modal>
      )}
      {analysis && (
        <Analysis
          analysis={analysis}
          onClose={() => setAnalysis(null)}
          onOpportunity={
            analysis.kind === "competitor"
              ? (index) =>
                  void act(async () => {
                    await api("ideas/from-opportunity", {
                      analysisId: analysis.id,
                      index,
                    });
                    setNotice("Oportunidade adicionada ao banco de ideias.");
                  }, "Salvando ideia…")
              : undefined
          }
        />
      )}
    </div>
  );
}
