CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FinancialEntry_occurredAt_idx" ON "FinancialEntry"("occurredAt");
CREATE INDEX "FinancialEntry_type_occurredAt_idx" ON "FinancialEntry"("type", "occurredAt");
