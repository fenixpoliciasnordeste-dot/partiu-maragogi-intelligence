"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, Empty, Metric, api, date } from "./ui";

const expenseCategories = [
  "Marketing",
  "Equipe",
  "Transporte",
  "Hospedagem",
  "Alimentação",
  "Tecnologia",
  "Impostos",
  "Outros",
];
const revenueCategories = ["Passeios", "Hospedagem", "Parcerias", "Vendas", "Outros"];
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);

export default function FinancePanel({
  entries,
  act,
}: {
  entries: any[];
  act: (fn: () => Promise<any>, label?: string) => Promise<any>;
}) {
  const [type, setType] = useState("EXPENSE");
  const currentMonth = new Date().toISOString().slice(0, 7);
  const summary = useMemo(() => {
    const monthRows = entries.filter((entry) =>
      entry.occurredAt.startsWith(currentMonth),
    );
    const revenue = monthRows
      .filter((entry) => entry.type === "REVENUE")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const expenses = monthRows
      .filter((entry) => entry.type === "EXPENSE")
      .reduce((sum, entry) => sum + entry.amount, 0);
    return { revenue, expenses, profit: revenue - expenses };
  }, [entries, currentMonth]);

  const monthly = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, index) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (11 - index));
      const key = d.toISOString().slice(0, 7);
      return {
        key,
        mês: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        Receitas: 0,
        Gastos: 0,
        Lucro: 0,
      };
    });
    for (const entry of entries) {
      const point = months.find((month) => month.key === entry.occurredAt.slice(0, 7));
      if (!point) continue;
      if (entry.type === "REVENUE") point.Receitas += entry.amount;
      else point.Gastos += entry.amount;
    }
    return months.map((month) => ({
      ...month,
      Lucro: month.Receitas - month.Gastos,
    }));
  }, [entries]);

  const expensesByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    entries
      .filter(
        (entry) =>
          entry.type === "EXPENSE" && entry.occurredAt.startsWith(currentMonth),
      )
      .forEach((entry) =>
        totals.set(entry.category, (totals.get(entry.category) || 0) + entry.amount),
      );
    return [...totals.entries()]
      .map(([categoria, Gastos]) => ({ categoria, Gastos }))
      .sort((a, b) => b.Gastos - a.Gastos);
  }, [entries, currentMonth]);

  return (
    <>
      <div className="metric-grid">
        <Metric label="Receitas no mês" value={money(summary.revenue)} detail="Entradas confirmadas" />
        <Metric label="Gastos no mês" value={money(summary.expenses)} detail="Despesas registradas" />
        <Metric
          label="Lucro no mês"
          value={money(summary.profit)}
          detail={summary.profit >= 0 ? "Resultado positivo" : "Resultado negativo"}
        />
        <Metric
          label="Margem de lucro"
          value={summary.revenue ? `${((summary.profit / summary.revenue) * 100).toFixed(1)}%` : "—"}
          detail="Lucro dividido pela receita"
        />
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Receitas, gastos e lucro</h2>
            <p>Visão mensal dos últimos 12 meses.</p>
          </div>
          <Badge tone="info">VALORES EM R$</Badge>
        </div>
        <div className="chart finance-chart">
          <ResponsiveContainer>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mês" />
              <YAxis tickFormatter={(value) => `R$ ${Number(value) / 1000}k`} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Legend />
              <Bar dataKey="Receitas" fill="#16896f" radius={[5, 5, 0, 0]} />
              <Bar dataKey="Gastos" fill="#d0645b" radius={[5, 5, 0, 0]} />
              <Line dataKey="Lucro" stroke="#3d63c7" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="two-columns finance-columns">
        <section className="panel">
          <h2>Novo lançamento</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const values = Object.fromEntries(new FormData(form));
              void act(async () => {
                await api("finance", {
                  ...values,
                  amount: Number(values.amount),
                  occurredAt: `${values.occurredAt}T12:00:00`,
                });
                form.reset();
              }, "Registrando lançamento…");
            }}
          >
            <div className="segmented finance-type">
              <button type="button" className={type === "REVENUE" ? "selected" : ""} onClick={() => setType("REVENUE")}>
                Receita
              </button>
              <button type="button" className={type === "EXPENSE" ? "selected" : ""} onClick={() => setType("EXPENSE")}>
                Gasto
              </button>
            </div>
            <input type="hidden" name="type" value={type} />
            <label>
              Descrição
              <input name="description" required maxLength={140} placeholder={type === "REVENUE" ? "Ex.: Passeio às piscinas naturais" : "Ex.: Anúncios do mês"} />
            </label>
            <div className="form-grid">
              <label>
                Categoria
                <select name="category" required>
                  {(type === "REVENUE" ? revenueCategories : expenseCategories).map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                Valor (R$)
                <input name="amount" type="number" min="0.01" step="0.01" required />
              </label>
              <label>
                Data
                <input name="occurredAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
            </div>
            <label>
              Observações
              <textarea name="notes" maxLength={1000} placeholder="Opcional" />
            </label>
            <button className="primary">Adicionar lançamento</button>
          </form>
        </section>

        <section className="panel">
          <h2>Gastos por categoria no mês</h2>
          {expensesByCategory.length ? (
            <div className="chart category-chart">
              <ResponsiveContainer>
                <BarChart data={expensesByCategory} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(value) => `R$ ${Number(value) / 1000}k`} />
                  <YAxis type="category" dataKey="categoria" width={95} />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Bar dataKey="Gastos" fill="#d0645b" radius={[0, 5, 5, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="Nenhum gasto neste mês" text="Adicione um lançamento para visualizar a distribuição." />
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Histórico de lançamentos</h2>
        {entries.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Valor</th><th></th></tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{date(entry.occurredAt)}</td>
                    <td><Badge tone={entry.type === "REVENUE" ? "success" : "warning"}>{entry.type === "REVENUE" ? "Receita" : "Gasto"}</Badge></td>
                    <td>{entry.description}<small>{entry.notes}</small></td>
                    <td>{entry.category}</td>
                    <td className={entry.type === "REVENUE" ? "money-positive" : "money-negative"}>{entry.type === "REVENUE" ? "+ " : "− "}{money(entry.amount)}</td>
                    <td><button className="danger-link" onClick={() => void act(() => api(`finance/${entry.id}`, {}, "DELETE"), "Excluindo lançamento…")}>Excluir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Nenhum lançamento ainda" text="Cadastre receitas e gastos para começar o acompanhamento." />
        )}
      </section>
    </>
  );
}
