"use client";
import { useEffect, useState } from "react";
import { api } from "./ui";
export const tours: Record<
  string,
  { target: string; title: string; text: string }[]
> = {
  overview: [
    {
      target: "indicators",
      title: "Seu perfil em números",
      text: "Indicadores usam dados oficiais e cálculos identificados. Ausência de dado nunca vira zero.",
    },
    {
      target: "chart",
      title: "Histórico real",
      text: "Selecione métrica e período. Snapshots começam na primeira sincronização; não existe histórico retroativo inventado.",
    },
    {
      target: "posts",
      title: "Publicações e score",
      text: "Compare posts, ordene e abra o histórico. O score compara o desempenho com publicações do mesmo perfil.",
    },
    {
      target: "analyze",
      title: "Análise com evidências",
      text: "Solicite uma análise. O Gemini utiliza os dados coletados e mostra as fontes. Resultados atualizados usam cache.",
    },
  ],
  competitors: [
    {
      target: "add-competitor",
      title: "Adicione um concorrente",
      text: "Cadastre nome, username e plataforma. A primeira sincronização inicia automaticamente.",
    },
    {
      target: "competitor-list",
      title: "Atualize e compare",
      text: "Cada card permite atualizar, analisar, editar ou excluir. A comparação depende de dados disponíveis.",
    },
    {
      target: "opportunities",
      title: "Encontre oportunidades",
      text: "Veja os padrões e suas fontes. Transforme uma oportunidade em ideia sem copiar o concorrente.",
    },
  ],
  ideas: [
    {
      target: "generate-ideas",
      title: "Gere 10 ideias",
      text: "Escolha plataforma, objetivo, formato e funil. A IA considera o seu histórico e os concorrentes.",
    },
    {
      target: "idea-list",
      title: "Da ideia à publicação",
      text: "Veja fontes, gere roteiro e prompt, copie e altere o status. Potencial é interpretação da IA, não garantia.",
    },
    {
      target: "idea-performance",
      title: "Aprenda com resultados",
      text: "Vincule ideias publicadas aos posts reais. O desempenho volta ao contexto das próximas recomendações.",
    },
  ],
  settings: [
    {
      target: "system-status",
      title: "Status do sistema",
      text: "Verifique banco, integrações, última sincronização e orçamento.",
    },
    {
      target: "integrations",
      title: "Conecte e teste as APIs",
      text: "Conecte suas contas e valide as permissões. Credenciais permanecem no servidor.",
    },
    {
      target: "budget",
      title: "Limites do Gemini",
      text: "Defina tarifas do modelo e limites em dólares e requisições. As chamadas são bloqueadas quando não há orçamento disponível.",
    },
    {
      target: "costs",
      title: "Custos e erros",
      text: "Consulte chamadas, tokens, estimativas de custo e erros. Estimativas não substituem a cobrança do provedor.",
    },
    {
      target: "syncs",
      title: "Acompanhe a coleta",
      text: "Veja o progresso, a duração e os erros de cada sincronização.",
    },
  ],
  search: [
    {
      target: "global-search",
      title: "Busca global",
      text: "Pesquise temas, posts, ideias, roteiros e análises. A busca padrão usa PostgreSQL sem custo de IA.",
    },
    {
      target: "search-filters",
      title: "Filtros reutilizáveis",
      text: "Combine critérios e salve a visualização. A interpretação semântica por Gemini exige uma ação explícita.",
    },
  ],
};
export function Tour({
  page,
  progress,
  restart,
  onDone,
}: {
  page: string;
  progress: any;
  restart: number;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false),
    [step, setStep] = useState(-1);
  const steps = tours[page] || [];
  useEffect(() => {
    setOpen(restart > 0 || !progress || progress.status === "ACTIVE");
    setStep(progress?.status === "ACTIVE" ? progress.step : -1);
  }, [page, restart, progress?.status]);
  useEffect(() => {
    if (!open || step < 0) return;
    const el = document.querySelector(`[data-tour="${steps[step]?.target}"]`);
    el?.classList.add("tour-highlight");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => el?.classList.remove("tour-highlight");
  }, [open, step, page]);
  const save = async (status: string, s: number) => {
    await api("tutorial", { page, status, step: Math.max(0, s) }, "PUT");
    if (status !== "ACTIVE") {
      setOpen(false);
      onDone();
    }
  };
  if (!open || !steps.length) return null;
  return (
    <aside className="tour-box" role="region" aria-label="Tutorial interativo">
      <small>
        {step < 0
          ? "CONHEÇA ESTA ÁREA"
          : `PASSO ${step + 1} DE ${steps.length}`}
      </small>
      <h3>{step < 0 ? "Uma orientação rápida?" : steps[step].title}</h3>
      <p>
        {step < 0
          ? "Veja como usar os recursos desta página. Você pode abrir este tutorial novamente pelo botão ?."
          : steps[step].text}
      </p>
      <div className="actions">
        {step < 0 ? (
          <>
            <button
              className="primary"
              onClick={() => {
                setStep(0);
                void save("ACTIVE", 0);
              }}
            >
              Começar tutorial
            </button>
            <button onClick={() => void save("SKIPPED", 0)}>Pular</button>
            <button onClick={() => void save("DISMISSED", 0)}>
              Não mostrar novamente
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                const s = Math.max(0, step - 1);
                setStep(s);
                void save("ACTIVE", s);
              }}
            >
              Voltar
            </button>
            <button
              className="primary"
              onClick={() => {
                if (step === steps.length - 1) void save("COMPLETED", step);
                else {
                  setStep(step + 1);
                  void save("ACTIVE", step + 1);
                }
              }}
            >
              {step === steps.length - 1 ? "Concluir" : "Próximo"}
            </button>
            <button onClick={() => void save("DISMISSED", step)}>Fechar</button>
          </>
        )}
      </div>
    </aside>
  );
}
