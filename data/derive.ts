import type { BloggerData, SignalSource, StockPoolItem } from "./types";
import { TICKER_ROLE } from "./supplychain";

/** 没有显式 stockPool 的博主：用 priorityQueue 推导一个轻量股票池。 */
export function resolveStockPool(b: BloggerData): StockPoolItem[] {
  if (b.stockPool) return b.stockPool;
  const updatedAt = `${b.snapshotDate} ${b.snapshotTime}`;
  return b.priorityQueue.map((p) => ({
    ticker: p.ticker,
    queue: p.riskLabel,
    stance: p.sentiment,
    updatedAt,
    mentions24h: p.mentions24h,
    mentions7d: p.mentions7d,
    mentions30d: 0,
    news: p.source === "新闻" ? p.sourceCount : 0,
    disclosures: 0,
    revenue: "–",
    score: p.priority,
    industry: TICKER_ROLE[p.ticker]?.toLowerCase(),
    riskLevel: p.riskLabel,
    confidence: "—",
    valuationRisk: "未知",
    sentimentRisk: "未知",
    fundamentals: "未知",
  }));
}

/** 没有显式 sources 的博主：默认只有自己一个主源。 */
export function resolveSources(b: BloggerData): SignalSource[] {
  return b.sources ?? [{ name: b.name, handle: b.handle, status: "primary" }];
}

export function resolveCoverage(b: BloggerData): number {
  return b.coverage ?? resolveStockPool(b).length;
}

/** look up a stock-pool entry by ticker (for 推文 company quick-read). */
export function findStock(
  pool: StockPoolItem[],
  ticker: string
): StockPoolItem | undefined {
  return pool.find((s) => s.ticker === ticker);
}
