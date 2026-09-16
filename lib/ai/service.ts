import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "../db";
import { AppError } from "../errors";
import { score, engagement, confidence, growth } from "../metrics";
import { reserve } from "./budget";
import { SYSTEM, tasks } from "./prompts";
import * as S from "./schemas";
export const hash = (x: unknown) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
export async function context(subjectId = "all", ownOnly = false) {
  const profiles = await db.socialProfile.findMany({
    where: {
      OR: [{ competitorId: null }, { competitor: { archivedAt: null } }],
    },
    include: {
      snapshots: { orderBy: { capturedAt: "desc" }, take: 400 },
      posts: {
        orderBy: { publishedAt: "desc" },
        take: 160,
        include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } },
      },
    },
  });
  const selected =
    subjectId === "all"
      ? profiles
      : profiles.filter(
          (p) =>
            p.id === subjectId ||
            p.competitorId === subjectId ||
            !p.competitorId,
        );
  const relevant = ownOnly ? selected.filter((p) => !p.competitorId) : selected;
  const posts = relevant
    .flatMap((p) =>
      p.posts
        .slice(0, Math.max(5, Math.floor(160 / Math.max(1, relevant.length))))
        .map((post) => ({
          id: post.id,
          profileId: p.id,
          competitorId: p.competitorId,
          username: p.username,
          platform: p.platform,
          caption: post.caption.slice(0, 1800),
          format: post.format,
          duration: post.duration,
          publishedAt: post.publishedAt,
          classification: post.classification,
          metrics: post.snapshots[0]
            ? {
                likes: post.snapshots[0].likes,
                comments: post.snapshots[0].comments,
                views: post.snapshots[0].views,
                reach: post.snapshots[0].reach,
                shares: post.snapshots[0].shares,
                saves: post.snapshots[0].saves,
                audience: post.snapshots[0].audience,
                capturedAt: post.snapshots[0].capturedAt
                  .toISOString()
                  .slice(0, 10),
              }
            : {},
          score: score(
            post.snapshots[0] || {},
            p.posts.map((x) => x.snapshots[0] || {}),
          ),
          engagement: engagement(post.snapshots[0] || {}),
        })),
    )
    .slice(0, 160);
  return {
    profiles: relevant.map((p) => ({
      id: p.id,
      name: p.name,
      username: p.username,
      platform: p.platform,
      competitorId: p.competitorId,
      growth30: growth(p.snapshots, 30),
      history: [
        ...new Map(
          p.snapshots
            .slice()
            .reverse()
            .map((s) => [
              s.capturedAt.toISOString().slice(0, 10),
              {
                capturedAt: s.capturedAt.toISOString().slice(0, 10),
                followers: s.followers,
                following: s.following,
                postsCount: s.postsCount,
                views: s.views,
                reach: s.reach,
              },
            ]),
        ).values(),
      ].slice(-90),
    })),
    posts,
    confidence: confidence(posts),
    sampleLimit: 160,
    scope:
      "Amostra das publicações recentes; métricas cumulativas. Engajamento público = (curtidas + comentários) / seguidores na coleta.",
  };
}
function collectSourceIds(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectSourceIds);
  return Object.entries(value).flatMap(([k, v]) =>
    k === "source_ids" && Array.isArray(v)
      ? (v as string[])
      : collectSourceIds(v),
  );
}
export class AIService {
  async run<T extends z.ZodType>(
    kind: string,
    subjectId: string,
    schema: T,
    data: any,
    force = false,
  ) {
    const model = process.env.GEMINI_MODEL,
      key = process.env.GEMINI_API_KEY;
    if (!model || !key)
      throw new AppError(
        "Configure a chave e o modelo Gemini no servidor.",
        409,
      );
    const fingerprint = JSON.parse(
      JSON.stringify(data, (key, value) =>
        ["capturedAt", "from", "to"].includes(key) && typeof value === "string"
          ? value.slice(0, 10)
          : value,
      ),
    );
    const inputHash = hash({
      kind,
      data: fingerprint,
      model,
      promptVersion: 1,
    });
    if (!force) {
      const cached = await db.aIAnalysis.findFirst({
        where: { kind, subjectId, inputHash },
        orderBy: { createdAt: "desc" },
        include: { sources: { include: { post: true } } },
      });
      if (cached) return cached;
    }
    const contents = JSON.stringify({ objetivo: tasks[kind], dados: data });
    if (Buffer.byteLength(contents) > 220000)
      throw new AppError("Amostra muito grande. Reduza o período da análise.");
    const maxOutput = 8192,
      started = Date.now();
    const reservation = await reserve(
      kind,
      Buffer.byteLength(contents + SYSTEM) + 12000,
      maxOutput,
    );
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(schema),
          maxOutputTokens: maxOutput,
          httpOptions: { timeout: 90000 },
        },
      });
      const usage = response.usageMetadata;
      const cost = usage
        ? ((usage.promptTokenCount || 0) * reservation.limit.inputRate +
            ((usage.candidatesTokenCount || 0) +
              (usage.thoughtsTokenCount || 0)) *
              reservation.limit.outputRate) /
          1e6
        : null;
      await db.aPIRequestLog.update({
        where: { id: reservation.log.id },
        data: {
          status: "SUCCESS",
          responseTime: Date.now() - started,
          tokensInput: usage?.promptTokenCount,
          tokensOutput: usage
            ? (usage.candidatesTokenCount || 0) +
              (usage.thoughtsTokenCount || 0)
            : undefined,
          estimatedCost: cost,
        },
      });
      const result = schema.parse(JSON.parse(response.text || ""));
      const ids = [...new Set(collectSourceIds(result))];
      const posts = data.posts || [];
      if (ids.some((id) => !posts.some((p: any) => p.id === id)))
        throw new AppError(
          "A IA citou uma fonte ausente. Resposta rejeitada; tente novamente.",
          502,
          "INVALID_SOURCES",
        );
      const saved = await db.aIAnalysis.create({
        data: {
          kind,
          subjectId,
          inputHash,
          result: JSON.parse(JSON.stringify(result)),
          model,
          sources: {
            create: ids.map((id) => {
              const p = posts.find((p: any) => p.id === id);
              return {
                postId: id,
                metrics: JSON.parse(JSON.stringify(p.metrics)),
                capturedAt: new Date(p.metrics.capturedAt || p.publishedAt),
              };
            }),
          },
        },
        include: { sources: { include: { post: true } } },
      });
      await db.integration.upsert({
        where: { provider: "Gemini" },
        create: {
          provider: "Gemini",
          status: "SUCCESS",
          lastCall: new Date(),
          lastSuccess: new Date(),
        },
        update: {
          status: "SUCCESS",
          lastCall: new Date(),
          lastSuccess: new Date(),
          lastError: null,
        },
      });
      return saved;
    } catch (e) {
      await db.aPIRequestLog.update({
        where: { id: reservation.log.id },
        data: {
          status: "ERROR",
          errorCode:
            e instanceof AppError ? e.code : "AI_REQUEST_OR_SCHEMA_ERROR",
          responseTime: Date.now() - started,
        },
      });
      await db.integration.upsert({
        where: { provider: "Gemini" },
        create: {
          provider: "Gemini",
          status: "ERROR",
          lastError: "AI_REQUEST_OR_SCHEMA_ERROR",
          lastCall: new Date(),
        },
        update: {
          status: "ERROR",
          lastError: "AI_REQUEST_OR_SCHEMA_ERROR",
          lastCall: new Date(),
        },
      });
      if (e instanceof AppError) throw e;
      throw new AppError(
        "Gemini não retornou uma resposta válida. Verifique modelo, chave e limites.",
        502,
      );
    }
  }
  async analyzeProfile(id = "all", force = false) {
    const c = await context(id, true);
    if (c.posts.length < 5)
      throw new AppError(
        "São necessárias pelo menos 5 publicações coletadas para analisar o perfil.",
        409,
      );
    return this.run("profile", id, S.ProfileAnalysisSchema, c, force);
  }
  async analyzeCompetitor(id: string, force = false) {
    const c = await context(id);
    if (c.posts.filter((p) => p.competitorId === id).length < 5)
      throw new AppError(
        "São necessárias pelo menos 5 publicações do concorrente.",
        409,
      );
    return this.run("competitor", id, S.CompetitorAnalysisSchema, c, force);
  }
  async compareProfiles(id: string, force = false) {
    return this.analyzeCompetitor(id, force);
  }
  async generateIdeas(filters: unknown, force = false) {
    const c = await context();
    if (c.posts.length < 5)
      throw new AppError(
        "Sincronize pelo menos 5 publicações antes de gerar ideias com evidências.",
        409,
      );
    const existing = await db.contentIdea.findMany({
      select: {
        title: true,
        status: true,
        post: {
          select: {
            caption: true,
            snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
          },
        },
      },
      take: 150,
      orderBy: { createdAt: "desc" },
    });
    const a = await this.run(
      "ideas",
      "all",
      S.ContentIdeasSchema,
      { ...c, filters, existing },
      force,
    );
    const result = S.ContentIdeasSchema.parse(a.result);
    for (const idea of result.ideias) {
      const titleKey = hash(
        idea.titulo
          .toLocaleLowerCase("pt-BR")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, ""),
      );
      await db.contentIdea.upsert({
        where: { titleKey },
        create: {
          title: idea.titulo,
          titleKey,
          content: idea,
          aiAnalysisId: a.id,
        },
        update: {},
      });
    }
    return a;
  }
  async generateIdeaFromPost(id: string) {
    const post = await db.socialPost.findUniqueOrThrow({
      where: { id },
      include: {
        profile: true,
        snapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
      },
    });
    const data = {
      posts: [
        {
          id: post.id,
          caption: post.caption,
          format: post.format,
          platform: post.platform,
          publishedAt: post.publishedAt,
          metrics: post.snapshots[0] || {},
        },
      ],
      restriction:
        "Uma ideia original para Partiu Maragogi inspirada no padrão, nunca cópia do texto. Use somente o ID desta publicação.",
    };
    const a = await this.run("idea_from_post", id, S.IdeaSchema, data);
    const idea = S.IdeaSchema.parse(a.result);
    return db.contentIdea.upsert({
      where: {
        titleKey: hash(
          idea.titulo
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, ""),
        ),
      },
      create: {
        title: idea.titulo,
        titleKey: hash(
          idea.titulo
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]/g, ""),
        ),
        content: idea,
        aiAnalysisId: a.id,
        source: "Publicação",
        competitorId: post.profile.competitorId,
      },
      update: {},
    });
  }
  async generateScript(id: string, force = false) {
    const idea = await db.contentIdea.findUniqueOrThrow({
      where: { id },
      include: {
        analysis: { include: { sources: { include: { post: true } } } },
      },
    });
    const a = await this.run(
      "script",
      id,
      S.ScriptSchema,
      { idea: idea.content, posts: [] },
      force,
    );
    await db.contentScript.create({
      data: {
        ideaId: id,
        kind: "script",
        content: JSON.parse(JSON.stringify(a.result)),
      },
    });
    await db.contentIdea.update({
      where: { id },
      data: { status: "Roteirizada" },
    });
    return a;
  }
  async generateExecutionPrompt(id: string, force = false) {
    const idea = await db.contentIdea.findUniqueOrThrow({
      where: { id },
      include: { scripts: { take: 1, orderBy: { createdAt: "desc" } } },
    });
    const a = await this.run(
      "execution",
      id,
      S.ExecutionSchema,
      { idea: idea.content, script: idea.scripts[0]?.content, posts: [] },
      force,
    );
    await db.contentScript.create({
      data: {
        ideaId: id,
        kind: "execution",
        content: JSON.parse(JSON.stringify(a.result)),
      },
    });
    return a;
  }
  async classifyPost(id: string) {
    const post = await db.socialPost.findUniqueOrThrow({ where: { id } });
    const input = {
      caption: post.caption,
      format: post.format,
      duration: post.duration,
    };
    if (post.classificationHash === hash(input)) return post.classification;
    const a = await this.run("classify", id, S.ClassificationSchema, {
      ...input,
      posts: [],
    });
    await db.socialPost.update({
      where: { id },
      data: {
        classification: JSON.parse(JSON.stringify(a.result)),
        classificationHash: hash(input),
      },
    });
    return a.result;
  }
  async detectContentPatterns() {
    const c = await context();
    if (c.posts.length < 5) throw new AppError("Dados insuficientes.");
    return this.run(
      "patterns",
      "all",
      z.object({ insights: z.array(S.InsightSchema) }),
      c,
    );
  }
  async semanticSearch(query: string) {
    return this.run("search", hash(query), S.SearchSchema, {
      query,
      posts: [],
    });
  }
  async generateInsightSources(id: string) {
    return db.insightSource.findMany({
      where: { analysisId: id },
      include: { post: { include: { profile: true } } },
    });
  }
}
export const aiService = new AIService();
