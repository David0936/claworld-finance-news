import type {
  BloggerData,
  FeedItem,
  MentionPerformance,
  PriorityStock,
  StockPoolItem,
  TrackRecord,
} from "./types";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

interface LiveData {
  id: string;
  handle: string;
  source?: string;
  snapshotDate?: string;
  snapshotTime?: string;
  fetchedAt: string | null;
  feed: FeedItem[];
  mentions: Record<string, { h24: number; d7: number }>;
  metrics?: BloggerData["metrics"];
  priorityHeader?: BloggerData["priorityHeader"];
  priorityQueue?: PriorityStock[];
  stockPool?: StockPoolItem[];
  coverage?: number;
  mentionPerformance?: MentionPerformance;
  trackRecord?: TrackRecord;
}

const LIVE_DIR = join(process.cwd(), "data", "live");

function cleanHandle(handle: string): string {
  return handle.replace(/^@/, "").replace(/\/.*$/, "").toLowerCase();
}

function parseDT(s: string): number {
  const m = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s || "");
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : 0;
}

function recomputeMentions(feed: FeedItem[]): LiveData["mentions"] {
  const now = Date.now();
  const mentions: LiveData["mentions"] = {};
  for (const item of feed) {
    if (!item.ticker) continue;
    const dt = parseDT(item.datetime);
    const ageH = dt ? (now - dt) / 3.6e6 : Number.POSITIVE_INFINITY;
    mentions[item.ticker] ??= { h24: 0, d7: 0 };
    if (ageH <= 24) mentions[item.ticker].h24 += 1;
    if (ageH <= 24 * 7) mentions[item.ticker].d7 += 1;
  }
  return mentions;
}

function mergeLive(a: LiveData | undefined, b: LiveData): LiveData {
  if (!a) return b;
  const preferred = (b.fetchedAt ?? "") >= (a.fetchedAt ?? "") ? b : a;
  const rich = {
    metrics: preferred.metrics ?? a.metrics ?? b.metrics,
    priorityHeader: preferred.priorityHeader ?? a.priorityHeader ?? b.priorityHeader,
    priorityQueue: preferred.priorityQueue ?? a.priorityQueue ?? b.priorityQueue,
    stockPool: preferred.stockPool ?? a.stockPool ?? b.stockPool,
    coverage: preferred.coverage ?? a.coverage ?? b.coverage,
    mentionPerformance:
      preferred.mentionPerformance ?? a.mentionPerformance ?? b.mentionPerformance,
    trackRecord: preferred.trackRecord ?? a.trackRecord ?? b.trackRecord,
  };
  const seen = new Set<string>();
  const feed = [...a.feed, ...b.feed]
    .filter((item) => {
      const key = `${item.author}|${item.datetime}|${item.body.slice(0, 80)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((x, y) => parseDT(y.datetime) - parseDT(x.datetime));
  return {
    ...preferred,
    ...rich,
    id: a.id,
    handle: a.handle || b.handle,
    source: b.fetchedAt && (!a.fetchedAt || b.fetchedAt >= a.fetchedAt) ? b.source : a.source,
    fetchedAt:
      (a.fetchedAt ?? "") > (b.fetchedAt ?? "") ? a.fetchedAt : b.fetchedAt,
    feed,
    mentions: recomputeMentions(feed),
  };
}

function loadLive(): Record<string, LiveData> {
  const live: Record<string, LiveData> = {};
  if (!existsSync(LIVE_DIR)) return live;

  for (const file of readdirSync(LIVE_DIR)) {
    if (!file.endsWith(".json") || file.startsWith("_")) continue;
    try {
      const path = join(LIVE_DIR, file);
      const parsed = JSON.parse(readFileSync(path, "utf8")) as LiveData;
      const id = parsed.id || basename(file, ".json");
      const normalized: LiveData = {
        ...parsed,
        id,
        handle: cleanHandle(parsed.handle || id),
        source: parsed.source,
        feed: parsed.feed ?? [],
        mentions: parsed.mentions ?? {},
      };
      const keys = new Set([id, basename(file, ".json"), normalized.handle]);
      for (const key of keys) live[key] = mergeLive(live[key], normalized);
    } catch {
      // 单个 live 文件坏了不影响页面构建；保留静态手写快照。
    }
  }

  return live;
}

// id/handle -> 抓取脚本或导入脚本产出的实时数据（data/live/*.json）
const LIVE: Record<string, LiveData> = loadLive();

function liveTimestamp(b: BloggerData, live: LiveData): string {
  return live.fetchedAt ?? `${b.snapshotDate} ${b.snapshotTime}`;
}

function liveTimeLabel(ts: string): string {
  return ts.length >= 16 ? ts.slice(5, 16) : ts;
}

function scoreMention(m: { h24: number; d7: number }): number {
  return m.h24 * 30 + m.d7 * 8;
}

function updateQueue(b: BloggerData, live: LiveData): PriorityStock[] {
  const ts = liveTimestamp(b, live);
  const time = liveTimeLabel(ts);
  const mentioned = live.mentions ?? {};
  const seen = new Set<string>();
  const base = b.priorityQueue.map((p) => {
    const m = mentioned[p.ticker];
    seen.add(p.ticker);
    if (!m) return p;
    return {
      ...p,
      time,
      mentions24h: m.h24,
      mentions7d: m.d7,
      source: m.h24 > 0 ? "推文" : p.source,
      sourceCount: m.h24 > 0 ? m.h24 : p.sourceCount,
      priority: Math.max(p.priority, p.priority + scoreMention(m)),
    };
  });

  const liveOnly: PriorityStock[] = Object.entries(mentioned)
    .filter(([ticker, m]) => !seen.has(ticker) && (m.h24 > 0 || m.d7 > 0))
    .sort((a, b) => scoreMention(b[1]) - scoreMention(a[1]))
    .slice(0, 8)
    .map(([ticker, m]) => ({
      rank: 0,
      ticker,
      time,
      mentions24h: m.h24,
      mentions7d: m.d7,
      source: "推文",
      sourceCount: m.h24 || m.d7,
      gptLevel: "live",
      sentiment: "中性",
      riskLabel: "实时观察",
      note: `实时抓取检测到 @${live.handle} 提及 $${ticker}；该标的尚未进入手写研究股票池，需后续用财报、公告与价格表现复核。`,
      priority: 180 + scoreMention(m),
    }));

  return [...base, ...liveOnly]
    .sort((a, b) => b.priority - a.priority)
    .map((p, idx) => ({ ...p, rank: idx + 1 }));
}

function updateStockPool(
  b: BloggerData,
  live: LiveData
): StockPoolItem[] | undefined {
  if (!b.stockPool) return b.stockPool;
  const ts = liveTimestamp(b, live);
  const mentioned = live.mentions ?? {};
  const seen = new Set<string>();
  const updated = b.stockPool.map((s) => {
    const m = mentioned[s.ticker];
    seen.add(s.ticker);
    if (!m) return s;
    return {
      ...s,
      updatedAt: ts,
      mentions24h: m.h24,
      mentions7d: m.d7,
      score: Math.max(s.score, s.score + scoreMention(m)),
    };
  });

  const liveOnly: StockPoolItem[] = Object.entries(mentioned)
    .filter(([ticker, m]) => !seen.has(ticker) && (m.h24 > 0 || m.d7 > 0))
    .map(([ticker, m]) => ({
      ticker,
      queue: "实时观察",
      stance: "中性",
      updatedAt: ts,
      mentions24h: m.h24,
      mentions7d: m.d7,
      mentions30d: m.d7,
      news: 0,
      disclosures: 0,
      revenue: "–",
      score: 180 + scoreMention(m),
      riskLevel: "待验证",
      confidence: "live",
      valuationRisk: "未知",
      sentimentRisk: "待观察",
      fundamentals: "待补充",
    }));

  return [...updated, ...liveOnly];
}

function updateMetrics(b: BloggerData, live: LiveData): BloggerData["metrics"] {
  const mentions = Object.values(live.mentions ?? {});
  const active24h = mentions.filter((m) => m.h24 > 0).length;
  const active7d = mentions.filter((m) => m.d7 > 0).length;
  const signalCount = live.feed.length + b.feed.filter((f) => f.type !== "推文").length;

  return b.metrics.map((m) => {
    if (m.label === "活跃信号") return { ...m, value: String(signalCount), delta: "live" };
    if (m.label === "24h 活跃") return { ...m, value: String(active24h), delta: "live" };
    if (m.label === "7天活跃") return { ...m, value: String(active7d), delta: "live" };
    return m;
  });
}

/**
 * 把抓取到的实时推文合并进博主数据：
 * - 有实时推文时，feed = 实时推文(推文类) + 作者手写的非推文条目(观点变化/GPT/新闻等)
 * - 同步把快照时间更新为抓取时间
 * - 没有实时数据时原样返回（占位博主、或还没填 key 时）
 */
export function applyLive(list: BloggerData[]): BloggerData[] {
  return list.map((b) => {
    const live = LIVE[b.id];
    const base: BloggerData = {
      ...b,
      liveStatus: b.liveStatus ?? {
        mode: "static",
        source: "manual-snapshot",
      },
    };
    if (!live || !live.feed || live.feed.length === 0) return base;

    const authoredNonTweets = base.feed.filter((f) => f.type !== "推文");
    const liveHasFullFeed = live.feed.some((item) => item.type !== "推文");
    const merged: BloggerData = {
      ...base,
      priorityHeader: live.priorityHeader ?? base.priorityHeader,
      feed: liveHasFullFeed ? (live.feed as FeedItem[]) : [...(live.feed as FeedItem[]), ...authoredNonTweets],
      liveStatus: {
        mode: "live",
        source: live.source || live.handle || "live",
        fetchedAt: live.fetchedAt ?? undefined,
      },
      metrics: live.metrics ?? updateMetrics(base, live),
      priorityQueue: live.priorityQueue ?? updateQueue(base, live),
      stockPool: live.stockPool ?? updateStockPool(base, live),
      coverage: live.coverage ?? base.coverage,
      mentionPerformance: live.mentionPerformance ?? base.mentionPerformance,
      trackRecord: live.trackRecord ?? base.trackRecord,
    };
    if (live.snapshotDate && live.snapshotTime) {
      merged.snapshotDate = live.snapshotDate;
      merged.snapshotTime = live.snapshotTime;
    } else if (live.fetchedAt) {
      merged.snapshotDate = live.fetchedAt.slice(0, 10);
      merged.snapshotTime = live.fetchedAt.slice(11);
    }
    return merged;
  });
}
