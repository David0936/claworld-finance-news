export type Sentiment = "看多" | "看空" | "中性";

export type FeedType = "推文" | "观点变化" | "GPT xhigh" | "新闻" | "披露";

export interface Metric {
  label: string;
  value: string;
  /** e.g. "+10" / "-4" / "持平" */
  delta: string;
  hint?: string;
}

export interface PriorityStock {
  rank: number;
  ticker: string;
  /** snapshot time label e.g. "05-29 09:00" */
  time: string;
  mentions24h: number;
  mentions7d: number;
  /** badge under the counts, e.g. "GPT" / "新闻" / "变化" */
  source: string;
  /** count next to the source badge */
  sourceCount: number;
  gptLevel: string; // e.g. "xhigh"
  sentiment: Sentiment;
  riskLabel: string; // e.g. "高风险偏多"
  note: string;
  priority: number;
}

export interface FeedItem {
  time: string; // "05-29 16:13"
  type: FeedType;
  ticker: string;
  title: string; // "推文线索 · SIVE"
  body: string;
  author: string; // "@aleabitoreddit" or "规则观点变化"
  datetime: string; // "2026-05-29 16:13"
}

export interface StockPoolItem {
  ticker: string;
  queue: string; // 高风险偏多 / 谨慎 / 高风险观察 / 积极观察
  stance: Sentiment; // SERENITY 立场
  updatedAt: string; // "2026-05-24 12:51"
  mentions24h: number;
  mentions7d: number;
  mentions30d: number;
  news: number;
  disclosures: number; // 披露
  revenue: string; // "65.5%" | "–"
  score: number; // 分数
  // 公司速读补充字段（可选）
  industry?: string; // optical-photonics-cpo
  riskLevel?: string; // 速读徽标：中低 / 中 / 高
  confidence?: string; // 置信度
  valuationRisk?: string; // 估值风险
  sentimentRisk?: string; // 情绪风险
  fundamentals?: string; // 基本面
}

export interface SignalSource {
  name: string;
  handle: string;
  status: "primary" | "enabled" | "disabled";
}

export interface StatCard {
  label: string;
  value: string;
  hint: string;
  tone?: string; // tailwind border/bg classes
}

export interface MentionPerfRow {
  ticker: string;
  chain: string; // 芯片/算力
  queue: string;
  firstMention: string;
  lastMention: string;
  basePrice: string; // "2025-07-28 @ 177"
  w1: string;
  m1: string;
  m6: string;
  y1: string;
  toDate: string;
  view: Sentiment;
  recentView: string;
}

export interface MentionPerformance {
  stats: StatCard[];
  chains: { name: string; count: number }[];
  positiveToDate: number;
  topGainers: { ticker: string; chain: string; gain: string }[];
  rows: MentionPerfRow[];
}

export interface TrackHeatRow {
  view: string;
  cells: number[]; // aligned to TrackRecord.horizons
}

export interface CalibrationRow {
  group: string; // "watch|medium_high"
  n: number;
  winRate: number; // 61.0
  meanExcess: number; // 3.7
  medianExcess: number; // 4.1
}

export interface TrackRecord {
  stats: StatCard[];
  horizons: string[]; // ["1D","5D","1W","1M","3M","6M"]
  heatmap: TrackHeatRow[];
  calibration: CalibrationRow[];
}

export interface SupplyChainRole {
  role: string; // "EQUIPMENT"
  tickers: string[];
}

export interface PropagationCatalyst {
  target: string; // "TSM"
  path: string; // "NVDA -> TSM"
  note: string;
  score: number; // e.g. 60
}

export interface SupplyChainData {
  nodes: number;
  edges: number;
  propagationEvents: number;
  asOf: string; // "2026-05-28 13:48"
  hopLabel: string; // "1-hop graph"
  windowLabel: string; // "7 day"
  roles: SupplyChainRole[];
  catalysts: PropagationCatalyst[];
  /** true when computed from the shared reference graph rather than the blogger's own pipeline */
  derived?: boolean;
}

export interface BloggerData {
  id: string;
  name: string;
  handle: string; // "@aleabitoreddit"
  /** short initials shown in the avatar */
  initials: string;
  /** tailwind gradient classes for the avatar background */
  avatarClass: string;
  bio: string;
  focusTags: string[];
  snapshotDate: string; // "2026-05-29"
  snapshotTime: string; // "09:00"
  priorityHeader: {
    riskLabel: string; // "高风险"
    riskCount: number; // 345
    gptCount: number; // 80
  };
  metrics: Metric[];
  priorityQueue: PriorityStock[];
  feed: FeedItem[];
  /** explicit supply-chain graph (e.g. Serenity). Others derive it from mentioned tickers. */
  supplyChain?: SupplyChainData;
  /** explicit stock pool (e.g. Serenity). Others derive it from priorityQueue/feed. */
  stockPool?: StockPoolItem[];
  /** configured external signal sources (多源). Others default to self as primary. */
  sources?: SignalSource[];
  /** 覆盖股票 total for the 多源 view. Others derive from stock pool size. */
  coverage?: number;
  /** 提及后收益跟踪（需要回测/收益数据，目前仅 Serenity 快照）。 */
  mentionPerformance?: MentionPerformance;
  /** 战绩：胜率热力图 + 校准曲线（需要回测数据，目前仅 Serenity 快照）。 */
  trackRecord?: TrackRecord;
}
