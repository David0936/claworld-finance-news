import type { SupplyChainData, SupplyChainRole } from "./types";

/**
 * 共享供应链参考图谱。
 * Serenity 自带真实 supplyChain 数据；其他博主用这里的 ticker->角色 映射和有向边，
 * 根据他们"提及的标的"自动推导出一个轻量供应链视图。
 *
 * 角色来源：Serenity 真实"角色分层"。后续可继续补充。
 */
export const TICKER_ROLE: Record<string, string> = {
  // EQUIPMENT
  ASML: "EQUIPMENT",
  LRCX: "EQUIPMENT",
  AMAT: "EQUIPMENT",
  KLAC: "EQUIPMENT",
  ADVANTEST: "EQUIPMENT",
  BESI: "EQUIPMENT",
  TER: "EQUIPMENT",
  CAMT: "EQUIPMENT",
  ACLS: "EQUIPMENT",
  AEHR: "EQUIPMENT",
  // ETF
  SOXX: "ETF",
  SMH: "ETF",
  QQQ: "ETF",
  // FABLESS
  NVDA: "FABLESS",
  AMD: "FABLESS",
  AVGO: "FABLESS",
  MRVL: "FABLESS",
  QCOM: "FABLESS",
  // FOUNDRY
  TSM: "FOUNDRY",
  GFS: "FOUNDRY",
  UMC: "FOUNDRY",
  TSEM: "FOUNDRY",
  // HYPERSCALER
  MSFT: "HYPERSCALER",
  GOOGL: "HYPERSCALER",
  AMZN: "HYPERSCALER",
  META: "HYPERSCALER",
  // HYPERSCALER_CUSTOMER
  AAPL: "HYPERSCALER_CUSTOMER",
  // IDM
  TXN: "IDM",
  ADI: "IDM",
  NXPI: "IDM",
  ON: "IDM",
  MCHP: "IDM",
  STM: "IDM",
  IFX: "IDM",
  // IDM_FOUNDRY
  INTC: "IDM_FOUNDRY",
  // IP
  ARM: "IP",
  // MEMORY
  MU: "MEMORY",
  SNDK: "MEMORY",
  // NEOCLOUD
  NBIS: "NEOCLOUD",
  CRWV: "NEOCLOUD",
  IREN: "NEOCLOUD",
  // NETWORKING
  ANET: "NETWORKING",
  // PHOTONICS (Serenity feed names)
  LITE: "PHOTONICS",
  AAOI: "PHOTONICS",
  SIVE: "PHOTONICS",
  // 其他博主提及的标的
  PLTR: "SOFTWARE",
  SMCI: "SERVER",
  TSLA: "AUTO",
  COIN: "CRYPTO",
  HOOD: "FINTECH",
  CPSH: "MATERIALS",
};

/**
 * 有向边：[source, target] 表示"source 上的信号沿供应链传导到 target"。
 * 与 Serenity 的"NVDA -> TSM"含义一致（下游公司 -> 其上游供应商）。
 */
export const SUPPLY_EDGES: [string, string][] = [
  // fabless -> foundry
  ["NVDA", "TSM"],
  ["AMD", "TSM"],
  ["AVGO", "TSM"],
  ["MRVL", "TSM"],
  ["QCOM", "TSM"],
  ["AAPL", "TSM"],
  ["TSLA", "TSM"],
  // foundry / idm -> equipment
  ["TSM", "ASML"],
  ["TSM", "LRCX"],
  ["TSM", "AMAT"],
  ["INTC", "ASML"],
  // server / app -> chips & cloud
  ["SMCI", "NVDA"],
  ["PLTR", "MSFT"],
  ["PLTR", "AMZN"],
  // photonics chain (Serenity)
  ["AAOI", "LITE"],
];

const ROLE_ORDER = [
  "EQUIPMENT",
  "ETF",
  "FABLESS",
  "FOUNDRY",
  "HYPERSCALER",
  "HYPERSCALER_CUSTOMER",
  "IDM",
  "IDM_FOUNDRY",
  "IP",
  "MEMORY",
  "NEOCLOUD",
  "NETWORKING",
  "PHOTONICS",
  "SERVER",
  "SOFTWARE",
  "AUTO",
  "CRYPTO",
  "FINTECH",
  "MATERIALS",
];

function roleOf(ticker: string): string {
  return TICKER_ROLE[ticker] ?? "OTHER";
}

/**
 * 从一组"提及标的"推导出供应链视图：
 * - 纳入这些标的及其一跳邻居（让传导关系可见）
 * - 按角色分层
 * - 由 source ∈ 提及标的 的边生成传导提示
 */
export function deriveSupplyChain(mentioned: string[]): SupplyChainData {
  const seed = new Set(mentioned.filter((t) => TICKER_ROLE[t]));
  const included = new Set(seed);

  for (const [a, b] of SUPPLY_EDGES) {
    if (seed.has(a)) included.add(b);
    if (seed.has(b)) included.add(a);
  }

  // 角色分层
  const byRole = new Map<string, string[]>();
  for (const t of included) {
    const r = roleOf(t);
    if (!byRole.has(r)) byRole.set(r, []);
    byRole.get(r)!.push(t);
  }
  const roles: SupplyChainRole[] = ROLE_ORDER.filter((r) => byRole.has(r)).map(
    (role) => ({ role, tickers: byRole.get(role)!.sort() })
  );

  // 传导提示：source 是被提及的标的
  const rawEdges = SUPPLY_EDGES.filter(
    ([a, b]) => seed.has(a) && included.has(b)
  );
  const catalysts = rawEdges
    .map(([a, b], i) => ({
      target: b,
      path: `${a} -> ${b}`,
      note: `${a} 信号沿供应链传导至 ${b}（${a} -> ${b}）。`,
      score: Math.round((60 - i * 1.5) * 10) / 10,
    }))
    .sort((x, y) => y.score - x.score);

  const edgeCount = SUPPLY_EDGES.filter(
    ([a, b]) => included.has(a) && included.has(b)
  ).length;

  return {
    nodes: included.size,
    edges: edgeCount,
    propagationEvents: catalysts.length,
    asOf: "",
    hopLabel: "1-hop graph",
    windowLabel: "7 day",
    roles,
    catalysts,
    derived: true,
  };
}

/** collect all tickers a blogger talks about, from priority queue + feed */
export function mentionedTickers(
  priorityQueue: { ticker: string }[],
  feed: { ticker: string }[]
): string[] {
  const s = new Set<string>();
  for (const p of priorityQueue) s.add(p.ticker);
  for (const f of feed) s.add(f.ticker);
  return [...s];
}
