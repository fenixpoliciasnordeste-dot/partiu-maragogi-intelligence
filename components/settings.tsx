"use client";
import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { api, Badge, date, num, Metric } from "./ui";
export default function SettingsPanel({
  data,
  act,
  onTour,
  onSync,
}: {
  data: any;
  act: (fn: () => Promise<any>, label?: string) => Promise<any>;
  onTour: (p: string) => void;
  onSync: () => void;
}) {
  const [tab, setTab] = useState("Integrações");
  const now = new Date(),
    day = now.toISOString().slice(0, 10),
    month = day.slice(0, 7);
  const logs = data.logs;
  const monthly = logs.filter(
    (l: any) => l.provider === "Gemini" && l.timestamp.startsWith(month),
  );
  const spend = monthly.reduce(
    (s: number, l: any) => s + (l.estimatedCost ?? l.reservedCost),
    0,
  );
  const percentage = data.limits.monthlyUSD
    ? (spend / data.limits.monthlyUSD) * 100
    : 0;
  const daily = monthly.filter((l: any) => l.timestamp.startsWith(day));
  const spentDaily = daily.reduce(
    (s: number, l: any) => s + (l.estimatedCost ?? l.reservedCost),
    0,
  );
  const threshold = [...new Set([100, 90, 75, 50, data.limits.alertPercent])]
    .sort((a, b) => b - a)
    .find((v) => percentage >= v);
  const chart = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000)
      .toISOString()
      .slice(0, 10);
    return {
      day: d.slice(5),
      ...Object.fromEntries(
        ["Gemini", "Apify"].map((p) => [
          p,
          logs.filter((l: any) => l.provider === p && l.timestamp.startsWith(d))
            .length,
        ]),
      ),
    };
  });
  return (
    <>
      <section className="panel" data-tour="system-status">
        <h2>Status do sistema</h2>
        <div className="system-grid">
          {["Apify", "Gemini"].map((p) => {
            const s = data.integrations.find((x: any) => x.provider === p);
            return (
              <div key={p}>
                <strong>{p}</strong>
                <Badge
                  tone={
                    s?.status === "SUCCESS"
                      ? "success"
                      : s?.status === "ERROR"
                        ? "warning"
                        : "muted"
                  }
                >
                  {s?.status === "SUCCESS"
                    ? "Última chamada bem-sucedida"
                    : s?.status === "ERROR"
                      ? "Atenção"
                      : "Não validado"}
                </Badge>
              </div>
            );
          })}
          <div>
            <strong>Banco</strong>
            <Badge tone="success">Operacional</Badge>
          </div>
          <div>
            <strong>Sincronização</strong>
            <small>
              {data.jobs[0]
                ? date(data.jobs[0].finishedAt || data.jobs[0].createdAt)
                : "Ainda não executada"}
            </small>
          </div>
          <div>
            <strong>Orçamento Gemini</strong>
            <Badge tone={percentage >= 90 ? "warning" : "info"}>
              {num(percentage)}% utilizado
            </Badge>
          </div>
        </div>
      </section>
      {threshold && (
        <div className={`banner ${threshold >= 90 ? "warning" : "info"}`}>
          Você já utilizou {num(percentage)}% do limite mensal configurado para
          o Gemini.{threshold >= 100 ? " Chamadas bloqueadas." : ""}
        </div>
      )}
      <div className="segmented settings-tabs">
        {[
          "Integrações",
          "Custos",
          "Limites",
          "Sincronizações",
          "Tutoriais",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <section
        className={`panel ${tab !== "Integrações" ? "section-hidden" : ""}`}
        data-tour="integrations"
      >
        <h2>Integrações oficiais</h2>
        <p>
          Configure as credenciais no ambiente do servidor. Nenhuma chave
          completa é enviada para esta tela.
        </p>
        <div className="integration-grid">
          {["Apify", "Gemini"].map((p) => {
            const a = data.accounts.find((a: any) => a.platform === "Instagram"),
              s = data.integrations.find((a: any) => a.provider === p);
            return (
              <article className="integration" key={p}>
                <h3>{p === "Apify" ? "Apify · Instagram" : p}</h3>
                <Badge tone={s?.status === "SUCCESS" ? "success" : "muted"}>
                  {s?.status || a?.status || "Não configurado"}
                </Badge>
                <dl>
                  <dt>{p === "Gemini" ? "API Key" : "Credencial"}</dt>
                  <dd>
                    {data.configuration[p]
                      ? "•••••••• (configurada)"
                      : "Não configurada"}
                  </dd>
                  {p === "Gemini" ? (
                    <>
                      <dt>Modelo</dt>
                      <dd>{data.configuration.model || "Não configurado"}</dd>
                      <dt>Última chamada bem-sucedida</dt>
                      <dd>{date(s?.lastSuccess)}</dd>
                    </>
                  ) : (
                    <>
                      <dt>Perfil principal</dt>
                      <dd>@{data.configuration.instagramUsername || a?.username || "não configurado"}</dd>
                      <dt>Limite diário</dt>
                      <dd>{data.configuration.apifyRunsToday} / {data.configuration.apifyDailyLimit} perfis coletados</dd>
                      <dt>Última validação</dt>
                      <dd>{date(a?.lastValidation)}</dd>
                      <dt>Última sincronização</dt>
                      <dd>{date(a?.lastSync)}</dd>
                    </>
                  )}
                  <dt>Última chamada</dt>
                  <dd>{date(s?.lastCall)}</dd>
                </dl>
                {(s?.lastError || a?.lastError) && (
                  <details>
                    <summary>Ver detalhes do último erro</summary>
                    <p>{s?.lastError || a?.lastError}</p>
                  </details>
                )}
                <div className="actions">
                  <button
                    onClick={() =>
                      void act(
                        () => api("integrations/test", { platform: p }),
                        `Testando ${p}…`,
                      )
                    }
                  >
                    Testar {p === "Gemini" ? "Gemini" : "conexão"}
                  </button>
                </div>
                {p === "Gemini" && (
                  <small>
                    Teste consome uma chamada e respeita os limites.
                  </small>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section
        className={`panel ${tab !== "Limites" ? "section-hidden" : ""}`}
        data-tour="budget"
      >
        <h2>Limites de uso do Gemini</h2>
        <p>
          Valores em dólares (USD). Limite zero bloqueia chamadas. Confirme as
          tarifas do modelo escolhido antes de liberar uso.
        </p>
        <form
          key={JSON.stringify(data.limits)}
          onSubmit={(e) => {
            e.preventDefault();
            const fields = Object.fromEntries(
              [...new FormData(e.currentTarget)].map(([k, v]) => [
                k,
                Number(v),
              ]),
            );
            void act(() => api("limits", fields, "PUT"));
          }}
        >
          <div className="form-grid">
            {Object.entries({
              dailyUSD: "Limite diário (USD)",
              monthlyUSD: "Limite mensal (USD)",
              dailyRequests: "Requisições por dia",
              monthlyRequests: "Requisições por mês",
              inputRate: "USD por milhão de tokens de entrada",
              outputRate: "USD por milhão de tokens de saída",
              alertPercent: "Alerta de orçamento (%)",
            }).map(([k, l]) => (
              <label key={k}>
                {l}
                <input
                  name={k}
                  type="number"
                  min="0"
                  max={k === "alertPercent" ? 100 : undefined}
                  step={
                    k.includes("Requests") || k === "alertPercent"
                      ? "1"
                      : "0.0001"
                  }
                  required
                  defaultValue={data.limits[k]}
                />
              </label>
            ))}
          </div>
          <button className="primary">Salvar limites e tarifas</button>
        </form>
        <p>
          Os limites são aplicados também às chamadas manuais. Para liberar uso
          adicional, altere explicitamente os limites acima. Reservas de
          chamadas interrompidas continuam contabilizadas por precaução.
        </p>
      </section>
      <section
        className={`panel ${tab !== "Custos" ? "section-hidden" : ""}`}
        data-tour="costs"
      >
        <h2>Uso e custos</h2>
        <div className="metric-grid">
          <Metric
            label="Gemini hoje"
            value={"US$ " + num(spentDaily)}
            detail={`${daily.length} chamadas · limite US$ ${num(data.limits.dailyUSD)}`}
          />
          <Metric
            label="Gemini no mês"
            value={"US$ " + num(spend)}
            detail={`${monthly.length} chamadas · limite US$ ${num(data.limits.monthlyUSD)}`}
          />
          <Metric
            label="Saldo mensal estimado"
            value={"US$ " + num(Math.max(0, data.limits.monthlyUSD - spend))}
            detail="Inclui reservas conservadoras de chamadas"
          />
          <Metric
            label="Tokens no mês"
            value={
              monthly.some((l: any) => l.tokensInput != null)
                ? monthly.reduce(
                    (s: number, l: any) =>
                      s + (l.tokensInput || 0) + (l.tokensOutput || 0),
                    0,
                  )
                : null
            }
            detail="Informados pelo Gemini quando disponíveis"
          />
        </div>
        <progress
          max="100"
          value={Math.min(100, percentage)}
          aria-label="Uso do orçamento mensal"
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Hoje</th>
                <th>Mês</th>
                <th>Sucesso / Erro</th>
                <th>Tempo médio</th>
                <th>Custo estimado</th>
              </tr>
            </thead>
            <tbody>
              {["Gemini", "Apify"].map((p) => {
                const rows = logs.filter(
                  (l: any) => l.provider === p && l.timestamp.startsWith(month),
                );
                return (
                  <tr key={p}>
                    <td>{p}</td>
                    <td>
                      {
                        rows.filter((l: any) => l.timestamp.startsWith(day))
                          .length
                      }
                    </td>
                    <td>{rows.length}</td>
                    <td>
                      {rows.filter((l: any) => l.status === "SUCCESS").length} /{" "}
                      {rows.filter((l: any) => l.status === "ERROR").length}
                    </td>
                    <td>
                      {rows.length
                        ? num(
                            rows.reduce(
                              (s: number, l: any) => s + (l.responseTime || 0),
                              0,
                            ) / rows.length,
                          ) + " ms"
                        : "—"}
                    </td>
                    <td>
                      {p === "Gemini"
                        ? "US$ " + num(spend)
                        : "Não informado pelo provedor"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mini-grid">
          {["profile", "competitor", "ideas", "script", "classify"].map(
            (kind) => (
              <div key={kind}>
                <small>
                  {
                    {
                      profile: "Análises de perfil",
                      competitor: "Análises de concorrentes",
                      ideas: "Gerações de ideias",
                      script: "Roteiros",
                      classify: "Classificações",
                    }[kind]
                  }
                </small>
                <strong>
                  {
                    monthly.filter(
                      (l: any) =>
                        l.operation === kind && l.status === "SUCCESS",
                    ).length
                  }
                </strong>
              </div>
            ),
          )}
        </div>
        <h3>Chamadas por dia · últimos 30 dias</h3>
        <div className="chart">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Apify" stackId="a" fill="#008b8b" />
              <Bar dataKey="Gemini" stackId="a" fill="#8171d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {["Gemini", "Apify"].map((p) => {
          const today = logs.filter(
            (l: any) => l.provider === p && l.timestamp.startsWith(day),
          );
          const previous = logs.filter(
            (l: any) =>
              l.provider === p &&
              l.timestamp < day &&
              +new Date(l.timestamp) >= Date.now() - 7 * 86400000,
          );
          const avg = previous.length / 7;
          return (
            <div key={p}>
              {today.filter((l: any) => l.status === "ERROR").length >= 5 && (
                <p className="warning-text">
                  {p}: pelo menos 5 erros hoje. Verifique a integração.
                </p>
              )}
              {avg >= 1 && today.length > avg * 2 && (
                <p className="warning-text">
                  {p}: chamadas de hoje {num((today.length / avg - 1) * 100)}%
                  acima da média dos 7 dias anteriores.
                </p>
              )}
            </div>
          );
        })}
        <details>
          <summary>Registro de chamadas (mais recentes)</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Serviço</th>
                  <th>Operação</th>
                  <th>Status</th>
                  <th>Duração</th>
                  <th>Código do erro</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 100).map((l: any) => (
                  <tr key={l.id}>
                    <td>{date(l.timestamp)}</td>
                    <td>{l.provider}</td>
                    <td>{l.operation}</td>
                    <td>{l.status}</td>
                    <td>{num(l.responseTime)} ms</td>
                    <td>{l.errorCode || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <section
        className={`panel ${tab !== "Sincronizações" ? "section-hidden" : ""}`}
        data-tour="syncs"
      >
        <div className="section-heading">
          <h2>Histórico de sincronizações</h2>
          <button onClick={onSync}>Atualizar agora</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Destino</th>
                <th>Itens</th>
                <th>Status</th>
                <th>Duração</th>
                <th>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((j: any) => (
                <tr key={j.id}>
                  <td>{date(j.createdAt)}</td>
                  <td>{j.target}</td>
                  <td>{j.items}</td>
                  <td>
                    <Badge
                      tone={
                        j.status === "SUCCESS"
                          ? "success"
                          : j.status === "ERROR"
                            ? "warning"
                            : "info"
                      }
                    >
                      {j.status}
                    </Badge>
                  </td>
                  <td>
                    {j.finishedAt && j.startedAt
                      ? num(
                          (+new Date(j.finishedAt) - +new Date(j.startedAt)) /
                            1000,
                        ) + " s"
                      : "—"}
                  </td>
                  <td>{j.error || j.progress || "Na fila"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section
        className={`panel ${tab !== "Tutoriais" ? "section-hidden" : ""}`}
      >
        <h2>Central de ajuda</h2>
        <p>Reinicie o tutorial de qualquer área.</p>
        <div className="actions">
          {[
            ["overview", "Visão geral"],
            ["competitors", "Concorrentes"],
            ["ideas", "Ideias"],
            ["settings", "APIs, Gemini, custos e sincronizações"],
          ].map(([p, l]) => (
            <button
              key={p}
              onClick={() => {
                if (p === "settings") setTab("Integrações");
                onTour(p);
              }}
            >
              {l} →
            </button>
          ))}
        </div>
        <p>Busca e filtros: abra a barra de busca e clique no botão ?.</p>
      </section>
    </>
  );
}
