import { budgetAllows } from "./budget-rules";
import { db } from "../db";
import { AppError } from "../errors";
export async function getLimits() {
  return db.aIUsageLimit.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      inputRate: Number(process.env.GEMINI_INPUT_USD_PER_MILLION) || 0,
      outputRate: Number(process.env.GEMINI_OUTPUT_USD_PER_MILLION) || 0,
    },
    update: {},
  });
}
export async function reserve(
  operation: string,
  inputBytes: number,
  maxOutput: number,
) {
  await getLimits();
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(908711)`;
      const limit = await tx.aIUsageLimit.findUniqueOrThrow({
        where: { id: "global" },
      });
      if (limit.inputRate <= 0 || limit.outputRate <= 0)
        throw new AppError(
          "Configure as tarifas do modelo Gemini antes de analisar.",
          409,
        );
      const reserve =
        (inputBytes * limit.inputRate + maxOutput * limit.outputRate) / 1e6;
      const now = new Date(),
        month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
        day = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );
      const logs = await tx.aPIRequestLog.findMany({
        where: { provider: "Gemini", timestamp: { gte: month } },
      });
      if (!budgetAllows(limit, logs, reserve, now))
        throw new AppError(
          "Limite do Gemini atingido ou insuficiente para esta operação. Ajuste os limites em Configurações.",
          429,
          "BUDGET_LIMIT",
        );
      const log = await tx.aPIRequestLog.create({
        data: {
          provider: "Gemini",
          endpoint: "models.generateContent",
          operation,
          status: "RESERVED",
          reservedCost: reserve,
        },
      });
      return { log, limit, reserve };
    },
    { timeout: 15000 },
  );
}
