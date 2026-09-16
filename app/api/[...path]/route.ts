import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, safeError } from "@/lib/errors";
import {
  checkOrigin,
  equal,
  login,
  rateLimit,
  requireUser,
} from "@/lib/security";
import { dashboard } from "@/lib/dashboard";
import { enqueue, drain, processNext } from "@/lib/sync";
import { provider } from "@/lib/providers";
import { aiService, context, hash } from "@/lib/ai/service";
import { FilterSchema, interpret, search } from "@/lib/search";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const CompetitorSchema = z.object({
  name: z.string().min(1).max(100),
  username: z
    .string()
    .transform((s) => s.replace(/^@/, "").toLowerCase())
    .pipe(z.string().regex(/^[a-z0-9._]{1,30}$/)),
  platform: z.literal("Instagram"),
  url: z.string().url().or(z.literal("")).optional(),
  category: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});
const statuses = [
  "Nova",
  "Salva",
  "Roteirizada",
  "Em produção",
  "Produzida",
  "Publicada",
  "Descartada",
] as const;
async function handle(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  let path: string[] = [];
  try {
    path = (await params).path;
    const route = path.join("/"),
      url = new URL(req.url),
      method = req.method;
    const json = (data: unknown, status = 200) =>
      NextResponse.json(data, {
        status,
        headers: { "Cache-Control": "no-store" },
      });
    if (route === "health") {
      await db.$queryRaw`SELECT 1`;
      return json({ status: "ok" });
    }
    if (route === "sync/cron" && method === "POST") {
      const secret = process.env.SYNC_SECRET;
      if (
        !secret ||
        secret.length < 32 ||
        !equal(req.headers.get("authorization") || "", `Bearer ${secret}`)
      )
        throw new AppError("Não autorizado.", 401);
      await rateLimit("cron", 600, 3600);
      if (url.searchParams.get("drain") === "1")
        return json({ processed: await processNext() });
      return json(await enqueue());
    }
    if (route === "auth/login" && method === "POST") {
      checkOrigin(req);
      await rateLimit("login:global", 30, 60);
      const body = z
        .object({ email: z.string().email(), password: z.string().max(500) })
        .parse(await req.json());
      await rateLimit("login:" + hash(body.email), 5, 60);
      return json(await login(body.email, body.password));
    }
    const user = await requireUser();
    checkOrigin(req);
    await rateLimit("api:" + user.id, 180);
    if (route === "auth/logout") {
      (await cookies()).delete("session");
      return json({ ok: true });
    }
    if (route === "dashboard") return json(await dashboard());
    if (route === "preferences" && method === "GET")
      return json({
        filters: await db.savedFilter.findMany({ where: { userId: user.id } }),
        history: await db.searchHistory.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        tutorials: await db.tutorialProgress.findMany({
          where: { userId: user.id },
        }),
      });
    if (route === "sync" && method === "POST") {
      const b = z
        .object({
          target: z
            .string()
            .regex(/^(all|main:Instagram|competitor:[a-z0-9]+)$/),
        })
        .parse(await req.json());
      const jobs = await enqueue(b.target);
      after(drain);
      return json(jobs, 202);
    }
    if (path[0] === "competitors") {
      if (method === "POST") {
        const b = CompetitorSchema.parse(await req.json());
        const existing = await db.competitor.findUnique({
          where: {
            platform_username: { platform: b.platform, username: b.username },
          },
        });
        if (!existing || existing.archivedAt) {
          const active = await db.competitor.count({
            where: { archivedAt: null },
          });
          if (active >= 5)
            throw new AppError(
              "O limite máximo é de 5 concorrentes ativos.",
              409,
              "COMPETITOR_LIMIT",
            );
        }
        const own = await db.socialProfile.findFirst({
          where: {
            platform: b.platform,
            username: b.username,
            competitorId: null,
          },
        });
        if (own) throw new AppError("Este é o seu perfil principal.");
        const competitor = await db.competitor.upsert({
          where: {
            platform_username: { platform: b.platform, username: b.username },
          },
          create: b,
          update: { ...b, archivedAt: null },
        });
        await enqueue("competitor:" + competitor.id);
        after(drain);
        return json(competitor);
      }
      if (method === "PATCH") {
        const b = CompetitorSchema.pick({
          name: true,
          url: true,
          category: true,
          notes: true,
        }).parse(await req.json());
        return json(
          await db.competitor.update({ where: { id: path[1] }, data: b }),
        );
      }
      if (method === "DELETE")
        return json(
          await db.competitor.update({
            where: { id: path[1] },
            data: { archivedAt: new Date() },
          }),
        );
    }
    if (route === "integrations/test" && method === "POST") {
      const { platform } = z
        .object({ platform: z.enum(["Apify", "Gemini"]) })
        .parse(await req.json());
      if (platform === "Gemini")
        return json(
          await aiService.run(
            "test",
            "connection",
            z.object({ ok: z.boolean() }),
            { instruction: "Retorne ok true", posts: [] },
            true,
          ),
        );
      const p = await provider("Instagram").validateConnection();
      await db.socialAccount.upsert({
        where: { platform: "Instagram" },
        create: {
          platform: "Instagram",
          externalId: p.externalId,
          username: p.username,
          status: "SUCCESS",
          lastValidation: new Date(),
        },
        update: {
          status: "SUCCESS",
          lastError: null,
          lastValidation: new Date(),
        },
      });
      return json({ status: "SUCCESS", profile: p });
    }
    if (route === "ai/estimate")
      return json({
        posts: (await context(url.searchParams.get("id") || "all")).posts
          .length,
        maxOutputTokens: 8192,
        message:
          "Usa cache quando os dados não mudaram. Reserva estimada verificada antes da chamada.",
      });
    if (route === "ai" && method === "POST") {
      await rateLimit("ai:" + user.id, 15);
      const b = z
        .object({
          action: z.enum([
            "profile",
            "competitor",
            "ideas",
            "script",
            "execution",
            "patterns",
          ]),
          id: z.string().max(200).default("all"),
          filters: z.record(z.string(), z.unknown()).default({}),
          force: z.boolean().default(false),
        })
        .parse(await req.json());
      const result =
        b.action === "profile"
          ? await aiService.analyzeProfile(b.id, b.force)
          : b.action === "competitor"
            ? await aiService.analyzeCompetitor(b.id, b.force)
            : b.action === "ideas"
              ? await aiService.generateIdeas(b.filters, b.force)
              : b.action === "script"
                ? await aiService.generateScript(b.id, b.force)
                : b.action === "execution"
                  ? await aiService.generateExecutionPrompt(b.id, b.force)
                  : await aiService.detectContentPatterns();
      return json(result);
    }
    if (route === "ideas/from-post" && method === "POST") {
      const b = z.object({ postId: z.string() }).parse(await req.json());
      return json(await aiService.generateIdeaFromPost(b.postId));
    }
    if (path[0] === "ideas" && method === "PATCH") {
      const b = z
        .object({
          status: z.enum(statuses).optional(),
          postId: z.string().nullable().optional(),
        })
        .parse(await req.json());
      if (b.postId) {
        const post = await db.socialPost.findUnique({
          where: { id: b.postId },
          include: { profile: true },
        });
        if (!post || post.profile.competitorId)
          throw new AppError("Vincule uma publicação do seu próprio perfil.");
      }
      return json(
        await db.contentIdea.update({ where: { id: path[1] }, data: b }),
      );
    }
    if (route === "ideas/from-opportunity" && method === "POST") {
      const b = z
        .object({
          analysisId: z.string(),
          index: z.number().int().min(0).max(100),
        })
        .parse(await req.json());
      const a = await db.aIAnalysis.findUniqueOrThrow({
        where: { id: b.analysisId },
      });
      const opportunity = (a.result as any).oportunidades?.[b.index];
      if (!opportunity || typeof opportunity !== "object")
        throw new AppError("Oportunidade não encontrada.");
      const titleKey = hash(
        opportunity.titulo
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, ""),
      );
      return json(
        await db.contentIdea.upsert({
          where: { titleKey },
          create: {
            title: opportunity.titulo,
            titleKey,
            content: opportunity,
            source: "Oportunidade",
            aiAnalysisId: a.id,
            competitorId: a.subjectId,
          },
          update: {},
        }),
      );
    }
    if (route === "search" && method === "POST") {
      const b = FilterSchema.extend({
        semantic: z.boolean().default(false),
      }).parse(await req.json());
      await db.searchHistory.create({
        data: { userId: user.id, query: b.query },
      });
      let f = { ...b, ...interpret(b.query) };
      if (b.semantic) {
        const a = await aiService.semanticSearch(b.query);
        const s = a.result as any;
        f = {
          ...f,
          query: s.terms.join(" "),
          platform: s.platform,
          format: s.format || undefined,
          ...(s.days ? { days: s.days } : {}),
          ...(s.minViews != null ? { minViews: s.minViews } : {}),
          ...(s.minScore != null ? { minScore: s.minScore } : {}),
        };
      }
      return json(await search(f));
    }
    if (path[0] === "history" && method === "DELETE") {
      await db.searchHistory.deleteMany({
        where: { id: path[1], userId: user.id },
      });
      return json({ ok: true });
    }
    if (path[0] === "filters") {
      if (method === "DELETE") {
        await db.savedFilter.deleteMany({
          where: { id: path[1], userId: user.id },
        });
        return json({ ok: true });
      }
      const b = z
        .object({
          name: z.string().min(1).max(100),
          description: z.string().max(500).optional(),
          config: FilterSchema,
        })
        .parse(await req.json());
      if (method === "POST")
        return json(
          await db.savedFilter.create({ data: { ...b, userId: user.id } }),
        );
      if (method === "PATCH")
        return json(
          await db.savedFilter.updateMany({
            where: { id: path[1], userId: user.id },
            data: b,
          }),
        );
    }
    if (route === "limits" && method === "PUT") {
      const b = z
        .object({
          dailyUSD: z.number().min(0).max(100000),
          monthlyUSD: z.number().min(0).max(1000000),
          dailyRequests: z.number().int().min(0).max(100000),
          monthlyRequests: z.number().int().min(0).max(1000000),
          inputRate: z.number().min(0).max(10000),
          outputRate: z.number().min(0).max(10000),
          alertPercent: z.number().int().min(1).max(100),
        })
        .parse(await req.json());
      return json(
        await db.aIUsageLimit.upsert({
          where: { id: "global" },
          create: b,
          update: b,
        }),
      );
    }
    if (path[0] === "finance") {
      if (method === "POST") {
        const b = z
          .object({
            type: z.enum(["REVENUE", "EXPENSE"]),
            description: z.string().trim().min(1).max(140),
            category: z.string().trim().min(1).max(80),
            amount: z.number().positive().max(100000000),
            occurredAt: z.coerce.date(),
            notes: z.string().trim().max(1000).optional(),
          })
          .parse(await req.json());
        return json(await db.financialEntry.create({ data: b }), 201);
      }
      if (method === "DELETE") {
        await db.financialEntry.delete({ where: { id: path[1] } });
        return json({ ok: true });
      }
    }
    if (route === "tutorial" && method === "PUT") {
      const b = z
        .object({
          page: z.string().max(30),
          status: z.enum(["ACTIVE", "SKIPPED", "DISMISSED", "COMPLETED"]),
          step: z.number().int().min(0).max(30),
        })
        .parse(await req.json());
      return json(
        await db.tutorialProgress.upsert({
          where: { userId_page: { userId: user.id, page: b.page } },
          create: { userId: user.id, ...b },
          update: b,
        }),
      );
    }
    if (path[0] === "posts" && method === "GET")
      return json(
        await db.socialPost.findUnique({
          where: { id: path[1] },
          include: {
            profile: true,
            snapshots: { orderBy: { capturedAt: "asc" } },
          },
        }),
      );
    if (path[0] === "sources")
      return json(await aiService.generateInsightSources(path[1]));
    throw new AppError("Operação não encontrada.", 404);
  } catch (e) {
    const message =
      e instanceof z.ZodError ? "Confira os campos informados." : safeError(e);
    return NextResponse.json(
      {
        error: message,
        code: e instanceof AppError ? e.code : "REQUEST_FAILED",
      },
      {
        status:
          e instanceof AppError
            ? e.status
            : e instanceof z.ZodError
              ? 400
              : 500,
      },
    );
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
