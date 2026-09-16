export type UsageLog = {
  timestamp: Date;
  estimatedCost: number | null;
  reservedCost: number;
};
export function budgetAllows(
  limits: {
    dailyUSD: number;
    monthlyUSD: number;
    dailyRequests: number;
    monthlyRequests: number;
  },
  logs: UsageLog[],
  reservation: number,
  now = new Date(),
) {
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const day = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const monthly = logs.filter((l) => l.timestamp >= month),
    daily = monthly.filter((l) => l.timestamp >= day);
  const sum = (rows: UsageLog[]) =>
    rows.reduce((s, l) => s + (l.estimatedCost ?? l.reservedCost), 0);
  return (
    sum(daily) + reservation <= limits.dailyUSD &&
    sum(monthly) + reservation <= limits.monthlyUSD &&
    daily.length < limits.dailyRequests &&
    monthly.length < limits.monthlyRequests
  );
}
