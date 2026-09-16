import { z } from "zod";
const text = z.string().min(1).max(6000),
  list = z.array(text).max(30);
export const InsightSchema = z.object({
  insight: text,
  fato: text,
  interpretacao: text,
  evidencia: text,
  source_ids: z.array(z.string()).min(1).max(80),
  periodo: text,
});
export const ProfileAnalysisSchema = z.object({
  resumo: text,
  nota_geral: z.number().min(0).max(100),
  posicionamento: text,
  pontos_fortes: list,
  pontos_fracos: list,
  oportunidades: list,
  riscos: list,
  formatos_que_funcionam: list,
  formatos_que_nao_funcionam: list,
  padroes_identificados: list,
  recomendacoes: z.array(InsightSchema),
  proximas_acoes: list,
});
const Opportunity = z.object({
  titulo: text,
  gancho: text,
  tema: text,
  formato: text,
  objetivo: text,
  plataforma: z.literal("Instagram"),
  justificativa: text,
  sinal_observado: text,
  concorrente_relacionado: text,
  como_adaptar: text,
  potencial: z.enum(["Baixo", "Médio", "Alto"]),
  source_ids: z.array(z.string()).min(1),
});
export const CompetitorAnalysisSchema = z.object({
  resumo: text,
  posicionamento: text,
  pontos_fortes: list,
  pontos_fracos: list,
  conteudos_vencedores: list,
  padroes: list,
  frequencia: text,
  formatos: list,
  temas: list,
  gaps: list,
  oportunidades: z.array(Opportunity),
  ameacas: list,
  o_que_aprender: list,
  o_que_nao_copiar: list,
  recomendacoes: z.array(InsightSchema),
});
export const IdeaSchema = z.object({
  titulo: text,
  gancho: text,
  formato: text,
  plataforma: z.literal("Instagram"),
  objetivo: text,
  funil: z.enum(["Topo", "Meio", "Fundo"]),
  tema: text,
  justificativa: text,
  dados_utilizados: text,
  potencial: z.enum(["Baixo", "Médio", "Alto"]),
  dificuldade: z.enum(["Baixa", "Média", "Alta"]),
  source_ids: z.array(z.string()).min(1),
});
export const ContentIdeasSchema = z.object({
  ideias: z.array(IdeaSchema).length(10),
});
export const ScriptSchema = z.object({
  titulo: text,
  objetivo: text,
  duracao: text,
  gancho: text,
  blocos: z
    .array(
      z.object({
        inicio: text,
        fim: text,
        fala: text,
        cenas: text,
        texto_na_tela: text,
        b_roll: text,
        edicao: text,
        mudanca_de_camera: text,
      }),
    )
    .min(1),
  cta: text,
  legenda: text,
  titulo_de_capa: text,
});
export const ClassificationSchema = z.object({
  tema: text,
  subtema: text,
  funil: z.enum(["Topo", "Meio", "Fundo"]),
  intencao: text,
  formato_criativo: text,
  gancho: text,
  cta: text,
  tom: text,
  objetivo: text,
});
export const ExecutionSchema = z.object({ prompt: text });
export const SearchSchema = z.object({
  terms: z.array(z.string().max(80)).max(8),
  platform: z.enum(["Instagram", "Todos"]),
  format: z.string().max(30),
  minViews: z.number().min(0).nullable(),
  minScore: z.number().min(0).max(100).nullable(),
  days: z.number().int().min(1).max(3650).nullable(),
});
