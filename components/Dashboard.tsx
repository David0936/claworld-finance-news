"use client";

import { useMemo, useState } from "react";
import type { BloggerData, FeedItem, SupplyChainData } from "@/data/types";
import {
  sentimentClass,
  deltaClass,
  feedTypeClass,
  feedDotClass,
} from "./ui";
import { deriveSupplyChain, mentionedTickers } from "@/data/supplychain";
import {
  resolveStockPool,
  resolveSources,
  resolveCoverage,
  findStock,
} from "@/data/derive";

const NAV = [
  "总览",
  "推文",
  "股票",
  "提及表现",
  "战绩",
  "供应链",
  "多源",
  "行业",
  "AI分析",
  "关注我",
];

const SECTION_TITLES: Record<
  string,
  { title: string; subtitle: string; eyebrow?: string }
> = {
  总览: {
    title: "投研看板",
    subtitle:
      "按最新推文、新闻、披露、AI 观点变化与风险队列重排，优先处理有边际变化的标的。",
  },
  推文: {
    eyebrow: "X / SERENITY",
    title: "最新推文",
    subtitle: "最新公开观点与对应公司线索，适合从推文到股票池快速复核。",
  },
  股票: {
    eyebrow: "搜索 / 筛选 / 统计",
    title: "股票池",
    subtitle: "按分数排序的覆盖标的，可按代码 / 行业搜索、按队列筛选。",
  },
  提及表现: {
    eyebrow: "PERFORMANCE",
    title: "AI产业链提及后收益跟踪",
    subtitle: "基准价取首次提及日之后的首个可用交易日；未到期窗口会显示未到期。",
  },
  战绩: {
    eyebrow: "TRACK RECORD",
    title: "战绩",
    subtitle: "按规则视图比较各时间窗的胜率与超额；分组校准胜率是跑赢 SPY 的比例。",
  },
  供应链: { title: "供应链线索", subtitle: "上下游与生态验证链线索。" },
  多源: {
    eyebrow: "MULTI-SOURCE",
    title: "多源信号",
    subtitle: "外部观察源配置与共识覆盖；启用后才进入共识计算。",
  },
  行业: { title: "行业分布", subtitle: "按关注主题划分的覆盖分布。" },
  AI分析: { title: "AI 分析", subtitle: "GPT 更新与规则观点变化。" },
  关注我: { title: "关注作者", subtitle: "博主主页与关注入口。" },
};

export default function Dashboard({ bloggers }: { bloggers: BloggerData[] }) {
  const [activeNav, setActiveNav] = useState("总览");
  const [stockQuery, setStockQuery] = useState("");
  const [stockQueue, setStockQueue] = useState("全部队列");
  const data = bloggers[0];
  const section = SECTION_TITLES[activeNav] ?? SECTION_TITLES["总览"];

  const goToStock = (ticker: string) => {
    setStockQuery(ticker);
    setStockQueue("全部队列");
    setActiveNav("股票");
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header pill bar */}
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 lg:px-6">
        <div className="mx-auto flex w-full max-w-shell items-center justify-between gap-4 rounded-full border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold ${data.avatarClass}`}
            >
              {data.initials}
            </div>
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate text-sm font-semibold text-slate-900">
                Serenity Analysis
              </span>
              <span className="truncate text-xs text-slate-400">
                动态投研终端 · {data.handle}
              </span>
            </div>
          </div>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <button
                key={item}
                onClick={() => setActiveNav(item)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  activeNav === item
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setActiveNav("多源")}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            数据源
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-shell flex-1 gap-4 px-3 py-4 sm:px-4 md:py-5 lg:px-6">
        {/* Main content */}
        <main className="min-w-0 flex-1 pb-24 xl:pb-6">
          {/* Mobile section tabs */}
          <div className="scroll-thin mb-4 flex gap-2 overflow-x-auto lg:hidden">
            {NAV.map((item) => (
              <button
                key={item}
                onClick={() => setActiveNav(item)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                  activeNav === item
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Title block */}
          <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {section.eyebrow && (
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {section.eyebrow}
                  </div>
                )}
                <h1 className="text-lg font-semibold text-slate-900">
                  {section.title}
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  {section.subtitle}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-right">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  当前快照
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {data.snapshotDate} {data.snapshotTime}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.focusTags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                >
                  {t}
                </span>
              ))}
            </div>
          </section>

          {/* Tab content */}
          <SectionContent
            nav={activeNav}
            data={data}
            stockQuery={stockQuery}
            setStockQuery={setStockQuery}
            stockQueue={stockQueue}
            setStockQueue={setStockQueue}
            goToStock={goToStock}
          />
        </main>
      </div>
    </div>
  );
}

interface SectionProps {
  nav: string;
  data: BloggerData;
  stockQuery: string;
  setStockQuery: (v: string) => void;
  stockQueue: string;
  setStockQueue: (v: string) => void;
  goToStock: (ticker: string) => void;
}

function SectionContent({
  nav,
  data,
  stockQuery,
  setStockQuery,
  stockQueue,
  setStockQueue,
  goToStock,
}: SectionProps) {
  switch (nav) {
    case "推文":
      return <TweetsView data={data} goToStock={goToStock} />;
    case "股票":
      return (
        <StocksView
          data={data}
          query={stockQuery}
          setQuery={setStockQuery}
          queue={stockQueue}
          setQueue={setStockQueue}
        />
      );
    case "提及表现":
      return <MentionsView data={data} />;
    case "多源":
      return <MultiSourceView data={data} />;
    case "AI分析":
      return <AiView data={data} />;
    case "关注我":
      return <FollowView data={data} />;
    case "战绩":
      return <TrackRecordView data={data} />;
    case "供应链":
      return <SupplyChainView data={data} />;
    case "行业":
      return <IndustryView data={data} />;
    default:
      return <OverviewView data={data} goToStock={goToStock} />;
  }
}

/* ---------- Views ---------- */

function OverviewView({
  data,
  goToStock,
}: {
  data: BloggerData;
  goToStock: (ticker: string) => void;
}) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="text-xs text-slate-400">{m.label}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900">
                {m.value}
              </span>
              <span className={`text-xs font-medium ${deltaClass(m.delta)}`}>
                {m.delta}
              </span>
            </div>
            {m.hint && (
              <div className="mt-1 text-[11px] text-slate-400">{m.hint}</div>
            )}
          </div>
        ))}
      </section>
      <OverviewInsightGrid data={data} goToStock={goToStock} />
      <PriorityQueue data={data} />
      <OverviewResearchGrid data={data} />
      <FeedTimeline items={data.feed} title="最新信息流" />
    </>
  );
}

function OverviewInsightGrid({
  data,
  goToStock,
}: {
  data: BloggerData;
  goToStock: (ticker: string) => void;
}) {
  const pool = resolveStockPool(data);
  const queueCounts = pool.reduce<Record<string, number>>((acc, s) => {
    acc[s.queue] = (acc[s.queue] ?? 0) + 1;
    return acc;
  }, {});
  const queueRows = Object.entries(queueCounts).sort((a, b) => b[1] - a[1]);
  const queueMax = Math.max(1, ...queueRows.map(([, n]) => n));
  const hotStocks = [...data.priorityQueue]
    .sort((a, b) => b.mentions24h * 10 + b.mentions7d - (a.mentions24h * 10 + a.mentions7d))
    .slice(0, 6);
  const latest = data.feed[0];
  const restricted = resolveSources(data).filter((s) => s.status === "restricted");
  const publicTweets = data.feed.filter((f) => f.type === "推文").length;

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Queue
            </div>
            <h2 className="mt-1 text-base font-semibold text-slate-900">
              队列分布
            </h2>
          </div>
          <span className="text-xs text-slate-400">{pool.length} 标的</span>
        </div>
        <div className="mt-4 grid gap-3">
          {queueRows.slice(0, 5).map(([queue, count]) => (
            <div key={queue}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-600">{queue}</span>
                <span className="font-semibold text-slate-900">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900"
                  style={{ width: `${(count / queueMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Heat
        </div>
        <h2 className="mt-1 text-base font-semibold text-slate-900">热点股票</h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {hotStocks.map((s) => (
            <button
              key={s.ticker}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-slate-300 hover:bg-white"
              onClick={() => goToStock(s.ticker)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-slate-900">
                  ${s.ticker}
                </span>
                <span className="text-[11px] text-rose-600">{s.mentions24h}H</span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                7D {s.mentions7d} · {s.source}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Freshness
        </div>
        <h2 className="mt-1 text-base font-semibold text-slate-900">数据新鲜度</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-blue-50 px-3 py-2">
            <dt className="text-slate-500">公开推文</dt>
            <dd className="font-semibold text-slate-900">{publicTweets}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2">
            <dt className="text-slate-500">最新时间</dt>
            <dd className="font-mono text-xs font-semibold text-slate-900">
              {latest?.datetime ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-violet-50 px-3 py-2">
            <dt className="text-slate-500">受限源</dt>
            <dd className="font-semibold text-violet-700">{restricted.length}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function OverviewResearchGrid({ data }: { data: BloggerData }) {
  const feedTypeCounts = data.feed.reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] ?? 0) + 1;
    return acc;
  }, {});
  const sc: SupplyChainData =
    data.supplyChain ??
    deriveSupplyChain(mentionedTickers(data.priorityQueue, data.feed));
  const catalysts = sc.catalysts.slice(0, 5);
  const workflow = [
    { label: "公开推文", value: data.feed.filter((f) => f.type === "推文").length, hint: data.handle },
    { label: "会员频道", value: data.memberUrl ? "待导入" : "未配置", hint: data.memberUrl ? "restricted" : "none" },
    { label: "Ticker 解析", value: mentionedTickers(data.priorityQueue, data.feed).length, hint: "unique symbols" },
    { label: "IM 推送", value: "已接入", hint: "Feishu / Telegram" },
  ];

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 xl:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Pipeline
            </div>
            <h2 className="mt-1 text-base font-semibold text-slate-900">
              解析工作流
            </h2>
          </div>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
            {data.handle}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {workflow.map((step) => (
            <div key={step.label} className="rounded-xl border border-slate-200 p-3">
              <div className="text-[11px] text-slate-400">{step.label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {step.value}
              </div>
              <div className="mt-1 truncate text-[11px] text-slate-400">
                {step.hint}
              </div>
            </div>
          ))}
        </div>
        {data.memberUrl && (
          <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs leading-relaxed text-violet-700">
            会员频道只展示入口和导入状态。已授权内容可通过导出/粘贴进入同一解析管线，避免把登录态抓取或付费内容固化在仓库里。
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 xl:col-span-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Signal Mix
        </div>
        <h2 className="mt-1 text-base font-semibold text-slate-900">信号构成</h2>
        <div className="mt-4 grid gap-2">
          {Object.entries(feedTypeCounts).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between gap-3 text-sm">
              <span className={`rounded px-2 py-1 text-xs ${feedTypeClass(type as FeedItem["type"])}`}>
                {type}
              </span>
              <span className="font-semibold text-slate-900">{count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 xl:col-span-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Catalysts
        </div>
        <h2 className="mt-1 text-base font-semibold text-slate-900">
          下一批复核清单
        </h2>
        {catalysts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">当前没有供应链传导提示。</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {catalysts.map((c) => (
              <article key={`${c.target}-${c.path}`} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {c.target}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {c.score}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-400">
                  {c.path}
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500">
                  {c.note}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PriorityQueue({ data }: { data: BloggerData }) {
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            今日优先队列
          </h2>
          <p className="text-xs text-slate-400">先处理有边际变化的股票</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700 ring-1 ring-red-200">
            {data.priorityHeader.riskLabel} {data.priorityHeader.riskCount}
          </span>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 font-medium text-white">
            GPT {data.priorityHeader.gptCount}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {data.priorityQueue.map((s) => (
          <article
            key={s.ticker}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {s.rank}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">
                      {s.ticker}
                    </span>
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                      GPT {s.gptLevel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{s.time}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-center text-xs text-slate-500">
                <div>
                  <div className="font-semibold text-slate-900">
                    {s.mentions24h}
                  </div>
                  <div className="text-[10px]">24h</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    {s.mentions7d}
                  </div>
                  <div className="text-[10px]">7天</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    {s.source}
                    {s.sourceCount ? ` ${s.sourceCount}` : ""}
                  </div>
                  <div className="text-[10px]">来源</div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {s.note}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${sentimentClass(
                  s.sentiment
                )}`}
              >
                {s.sentiment}
              </span>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                {s.riskLabel}
              </span>
              <span className="ml-auto rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                优先级 {s.priority}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeedTimeline({
  items,
  title,
}: {
  items: FeedItem[];
  title: string;
}) {
  if (items.length === 0) {
    return <EmptyState title="暂无记录" note="当前博主在该类型下没有数据。" />;
  }
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <span className="text-xs text-slate-400">共 {items.length} 条</span>
      </div>
      <ol className="mt-4 space-y-0">
        {items.map((f, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${feedDotClass(
                  f.type
                )}`}
              />
              {i < items.length - 1 && (
                <span className="my-1 w-px flex-1 bg-slate-200" />
              )}
            </div>
            <div className="flex-1 pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${feedTypeClass(
                    f.type
                  )}`}
                >
                  {f.type}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {f.title}
                </span>
                <span className="ml-auto text-[11px] text-slate-400">
                  {f.time}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {f.body}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
                <span>{f.author}</span>
                <span>·</span>
                <span>{f.datetime}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function riskBadgeClass(level?: string): string {
  if (!level) return "bg-slate-100 text-slate-600";
  if (level.includes("极端") || level.includes("高"))
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (level.includes("中低") || level.includes("低"))
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
}

function TweetsView({
  data,
  goToStock,
}: {
  data: BloggerData;
  goToStock: (t: string) => void;
}) {
  const tweets = data.feed.filter((f) => f.type === "推文");
  const pool = resolveStockPool(data);
  const relatedTickers = [...new Set(tweets.map((t) => t.ticker))];

  if (tweets.length === 0) {
    return <EmptyState title="暂无推文" note="当前博主在本快照下没有推文线索。" />;
  }

  const profileUrl = `https://x.com/${data.handle.replace(/^@/, "")}`;

  return (
    <>
      <section className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs text-slate-500">推文</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">
            {tweets.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">最新 {tweets.length} 条</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs text-slate-500">相关公司</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">
            {relatedTickers.length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {relatedTickers.map((t) => `$${t}`).join(", ")}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* 时间线 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            最新 {tweets.length} 条
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">时间线</h2>
          <div className="mt-4 grid gap-3">
            {tweets.map((t, i) => {
              const stock = findStock(pool, t.ticker);
              return (
                <article
                  key={i}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">
                      {t.datetime}
                    </span>
                    <span className="text-xs text-slate-400">{t.author}</span>
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                    >
                      ↗ X
                    </a>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">
                    {t.body}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                    <span>浏览 0</span>
                    <span>赞 0</span>
                    <span>转发 0</span>
                    <span>收藏 0</span>
                  </div>
                  {stock && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          ${stock.ticker}
                        </span>
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                          {stock.queue}
                        </span>
                        <button
                          onClick={() => goToStock(stock.ticker)}
                          className="ml-auto text-[11px] font-medium text-blue-600 hover:underline"
                        >
                          打开股票页
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                        提及: 24h {stock.mentions24h} / 7D {stock.mentions7d};
                        新闻: {stock.news}; 披露: {stock.disclosures}. 作者立场:{" "}
                        {stock.stance}
                        {stock.confidence ? `; 置信度: ${stock.confidence}` : ""}
                        {stock.industry ? `. 行业: ${stock.industry}` : ""}
                        {stock.valuationRisk
                          ? `; 估值风险: ${stock.valuationRisk}`
                          : ""}
                        {stock.sentimentRisk
                          ? `; 情绪风险: ${stock.sentimentRisk}`
                          : ""}
                        {stock.fundamentals
                          ? `. 基本面: ${stock.fundamentals}.`
                          : ""}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* 公司速读 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                标签提取
              </div>
              <h2 className="mt-1 text-base font-semibold text-slate-900">
                公司速读
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {relatedTickers.length}
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {relatedTickers.map((ticker) => {
              const s = findStock(pool, ticker);
              if (!s) {
                return (
                  <div
                    key={ticker}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <span className="font-bold text-slate-900">${ticker}</span>
                    <p className="mt-1 text-xs text-slate-400">
                      该标的暂未进入股票池。
                    </p>
                  </div>
                );
              }
              return (
                <div key={ticker} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">
                      ${s.ticker}
                    </span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${riskBadgeClass(
                        s.riskLevel
                      )}`}
                    >
                      {s.riskLevel ?? s.queue}
                    </span>
                  </div>
                  {s.industry && (
                    <div className="mt-1 font-mono text-[11px] text-slate-400">
                      {s.industry}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[
                      ["24h", s.mentions24h],
                      ["7D", s.mentions7d],
                      ["新闻", s.news],
                    ].map(([label, val]) => (
                      <div key={label as string}>
                        <div className="text-sm font-semibold text-slate-900">
                          {val}
                        </div>
                        <div className="text-[10px] text-slate-400">{label}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                    提及: 24h {s.mentions24h} / 7D {s.mentions7d}; 新闻: {s.news};
                    披露: {s.disclosures}. 作者立场: {s.stance}
                    {s.confidence ? `; 置信度: ${s.confidence}` : ""}.
                    {s.industry ? ` 行业: ${s.industry};` : ""}
                    {s.valuationRisk ? ` 估值风险: ${s.valuationRisk};` : ""}
                    {s.sentimentRisk ? ` 情绪风险: ${s.sentimentRisk}.` : ""}
                    {s.fundamentals ? ` 基本面: ${s.fundamentals}.` : ""}
                  </p>
                  <button
                    onClick={() => goToStock(s.ticker)}
                    className="mt-3 text-xs font-medium text-blue-600 hover:underline"
                  >
                    打开股票页
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

function queueBadgeClass(queue: string): string {
  if (queue.includes("偏多"))
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  if (queue.includes("谨慎"))
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (queue.includes("观察") && queue.includes("高风险"))
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (queue.includes("积极"))
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  return "bg-slate-100 text-slate-600";
}

function revenueClass(rev: string): string {
  if (rev.startsWith("-")) return "text-red-600";
  if (rev === "–") return "text-slate-300";
  return "text-emerald-600";
}

function StocksView({
  data,
  query,
  setQuery,
  queue,
  setQueue,
}: {
  data: BloggerData;
  query: string;
  setQuery: (v: string) => void;
  queue: string;
  setQueue: (v: string) => void;
}) {
  const pool = resolveStockPool(data);
  const queues = useMemo(
    () => ["全部队列", ...new Set(pool.map((s) => s.queue))],
    [pool]
  );

  const q = query.trim().toLowerCase();
  const rows = pool
    .filter((s) => queue === "全部队列" || s.queue === queue)
    .filter(
      (s) =>
        !q ||
        s.ticker.toLowerCase().includes(q) ||
        (s.industry ?? "").toLowerCase().includes(q)
    )
    .sort((a, b) => b.score - a.score);

  if (pool.length === 0) {
    return <EmptyState title="暂无覆盖标的" note="当前博主没有覆盖的股票。" />;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索股票 / 行业"
          className="h-9 flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
        />
        <select
          value={queue}
          onChange={(e) => setQueue(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
        >
          {queues.map((qx) => (
            <option key={qx} value={qx}>
              {qx}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{rows.length} 条</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">股票</th>
              <th className="px-4 py-3 font-medium">队列</th>
              <th className="px-4 py-3 font-medium">SERENITY</th>
              <th className="px-4 py-3 font-medium">更新时间</th>
              <th className="px-3 py-3 text-right font-medium">24H</th>
              <th className="px-3 py-3 text-right font-medium">7D</th>
              <th className="px-3 py-3 text-right font-medium">30D</th>
              <th className="px-3 py-3 text-right font-medium">新闻</th>
              <th className="px-3 py-3 text-right font-medium">披露</th>
              <th className="px-3 py-3 text-right font-medium">收入</th>
              <th className="px-4 py-3 text-right font-medium">分数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((s) => (
              <tr key={s.ticker} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-bold text-slate-900">
                  {s.ticker}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${queueBadgeClass(
                      s.queue
                    )}`}
                  >
                    {s.queue}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${sentimentClass(
                      s.stance
                    )}`}
                  >
                    {s.stance}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">
                  {s.updatedAt}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-rose-600">
                  {s.mentions24h}
                </td>
                <td className="px-3 py-3 text-right text-slate-700">
                  {s.mentions7d}
                </td>
                <td className="px-3 py-3 text-right text-slate-700">
                  {s.mentions30d}
                </td>
                <td className="px-3 py-3 text-right text-slate-700">{s.news}</td>
                <td className="px-3 py-3 text-right text-slate-700">
                  {s.disclosures}
                </td>
                <td
                  className={`px-3 py-3 text-right font-medium ${revenueClass(
                    s.revenue
                  )}`}
                >
                  {s.revenue}
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">
                  {s.score}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function returnClass(v: string): string {
  if (v === "未到期" || v === "—") return "text-slate-300";
  if (v.startsWith("-")) return "text-red-600";
  return "text-emerald-600";
}

function MentionsView({ data }: { data: BloggerData }) {
  const mp = data.mentionPerformance;
  if (!mp) return <DerivedMentionsView data={data} />;

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {mp.stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border p-4 ${s.tone ?? "border-slate-200 bg-white"}`}
          >
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">{s.hint}</div>
          </div>
        ))}
      </section>

      <div className="mt-3 flex flex-wrap gap-2">
        {mp.chains.map((c) => (
          <span
            key={c.name}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
          >
            {c.name} <span className="font-semibold text-slate-900">{c.count}</span>
          </span>
        ))}
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
          至今为正 <span className="font-semibold">{mp.positiveToDate}</span>
        </span>
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <h2 className="text-base font-semibold text-slate-900">最大收益率 5 只</h2>
        <ol className="mt-3 divide-y divide-slate-100">
          {mp.topGainers.map((g, i) => (
            <li key={g.ticker} className="flex items-center gap-3 py-2.5">
              <span className="w-5 text-sm text-slate-400">{i + 1}</span>
              <span className="font-bold text-slate-900">{g.ticker}</span>
              <span className="text-xs text-slate-400">{g.chain}</span>
              <span className="ml-auto text-sm font-semibold text-emerald-600">
                {g.gain}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-base font-semibold text-slate-900">提及后表现</h2>
          <div className="flex gap-1.5 text-[11px]">
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
              +收益
            </span>
            <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">
              -收益
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-400">
              未到期/无价
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-y border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">股票</th>
                <th className="px-4 py-3 font-medium">链条</th>
                <th className="px-4 py-3 font-medium">队列</th>
                <th className="px-4 py-3 font-medium">首次提及</th>
                <th className="px-4 py-3 font-medium">基准价格</th>
                <th className="px-3 py-3 text-right font-medium">1W</th>
                <th className="px-3 py-3 text-right font-medium">1M</th>
                <th className="px-3 py-3 text-right font-medium">6M</th>
                <th className="px-3 py-3 text-right font-medium">1Y</th>
                <th className="px-3 py-3 text-right font-medium">至今</th>
                <th className="px-4 py-3 font-medium">观点</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mp.rows.map((r) => (
                <tr key={r.ticker} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {r.ticker}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.chain}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${queueBadgeClass(
                        r.queue
                      )}`}
                    >
                      {r.queue}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {r.firstMention}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                    {r.basePrice}
                  </td>
                  <td className={`px-3 py-3 text-right ${returnClass(r.w1)}`}>
                    {r.w1}
                  </td>
                  <td className={`px-3 py-3 text-right ${returnClass(r.m1)}`}>
                    {r.m1}
                  </td>
                  <td className={`px-3 py-3 text-right ${returnClass(r.m6)}`}>
                    {r.m6}
                  </td>
                  <td className={`px-3 py-3 text-right ${returnClass(r.y1)}`}>
                    {r.y1}
                  </td>
                  <td
                    className={`px-3 py-3 text-right font-semibold ${returnClass(
                      r.toDate
                    )}`}
                  >
                    {r.toDate}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${sentimentClass(
                        r.view
                      )}`}
                    >
                      {r.view}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DerivedMentionsView({ data }: { data: BloggerData }) {
  const rows = [...data.priorityQueue].sort(
    (a, b) => b.mentions7d - a.mentions7d
  );
  const max = Math.max(1, ...rows.map((r) => r.mentions7d));
  if (rows.length === 0) {
    return <EmptyState title="暂无提及数据" note="当前博主没有提及统计。" />;
  }
  return (
    <>
      <div className="mb-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-[11px] leading-relaxed text-slate-500">
        该博主没有接入收益回测数据。以下按 7 天累计提及次数做的轻量排名。
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.ticker} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm font-bold text-slate-900">
                {r.ticker}
              </span>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="flex h-full items-center justify-end rounded-full bg-slate-900 pr-2 text-[11px] font-medium text-white"
                  style={{ width: `${(r.mentions7d / max) * 100}%` }}
                >
                  {r.mentions7d}
                </div>
              </div>
              <span className="w-20 shrink-0 text-right text-xs text-slate-400">
                24h {r.mentions24h}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function heatClass(pct: number): string {
  if (pct >= 60) return "bg-emerald-500";
  if (pct >= 52) return "bg-emerald-400";
  if (pct >= 45) return "bg-slate-400";
  if (pct >= 35) return "bg-slate-300";
  return "bg-slate-200";
}

function excessClass(v: number): string {
  if (v > 0) return "text-emerald-600";
  if (v < 0) return "text-red-600";
  return "text-slate-400";
}

function TrackRecordView({ data }: { data: BloggerData }) {
  const tr = data.trackRecord;
  if (!tr) {
    return (
      <EmptyState
        title="战绩追踪待接入"
        note="该板块需要历史调用与回测数据（各时间窗胜率、超额、校准）。当前仅 Serenity 有快照。"
      />
    );
  }

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tr.stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border p-4 ${s.tone ?? "border-slate-200 bg-white"}`}
          >
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className="mt-1 text-3xl font-bold text-slate-900">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">{s.hint}</div>
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* Heatmap */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Heatmap
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            View × Horizon
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            按当前规则视图横向比较 1D 到 6M 的胜率；条块越满，代表该窗口跑赢 SPY 的比例越高。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-400">
                  <th className="py-2 font-medium">VIEW</th>
                  {tr.horizons.map((h) => (
                    <th key={h} className="py-2 text-right font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tr.heatmap.map((row) => (
                  <tr key={row.view} className="border-t border-slate-100">
                    <td className="py-2 pr-3 font-mono text-xs text-slate-600">
                      {row.view}
                    </td>
                    {row.cells.map((pct, i) => (
                      <td key={i} className="py-2 pl-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="h-2 w-8 overflow-hidden rounded-full bg-slate-100">
                            <span
                              className={`block h-full ${heatClass(pct)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span className="w-12 text-right text-xs tabular-nums text-slate-600">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Calibration */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            1M
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">校准曲线</h2>
          <p className="mt-1 text-xs text-slate-400">
            按 view 与 confidence 分组看 1M 后续表现；N 是样本数，胜率是跑赢 SPY 的比例，超额单位为百分点。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="text-left text-[11px] uppercase text-slate-400">
                <tr>
                  <th className="py-2 font-medium">分组</th>
                  <th className="py-2 text-right font-medium">N</th>
                  <th className="py-2 text-right font-medium">胜率</th>
                  <th className="py-2 text-right font-medium">均值超额</th>
                  <th className="py-2 text-right font-medium">中位超额</th>
                </tr>
              </thead>
              <tbody>
                {tr.calibration.map((c) => (
                  <tr key={c.group} className="border-t border-slate-100">
                    <td className="py-2 pr-2 font-mono text-xs text-slate-600">
                      {c.group}
                    </td>
                    <td className="py-2 text-right text-slate-500">{c.n}</td>
                    <td className="py-2 text-right font-semibold text-slate-900">
                      {c.winRate.toFixed(1)}%
                    </td>
                    <td className={`py-2 text-right ${excessClass(c.meanExcess)}`}>
                      {c.meanExcess}
                    </td>
                    <td
                      className={`py-2 text-right ${excessClass(c.medianExcess)}`}
                    >
                      {c.medianExcess}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function sourceStatusClass(status: string): string {
  if (status === "primary")
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "enabled")
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  if (status === "restricted")
    return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
  return "bg-slate-100 text-slate-500";
}

function MultiSourceView({ data }: { data: BloggerData }) {
  const sources = resolveSources(data);
  const coverage = resolveCoverage(data);
  const extra = sources.filter((s) => s.status !== "primary").length;
  const enabled = sources.filter((s) => s.status === "enabled").length;

  const stats = [
    { label: "覆盖股票", value: coverage, hint: `${data.snapshotDate} ${data.snapshotTime}`, tone: "border-blue-200 bg-blue-50" },
    { label: "配置源", value: extra, hint: "extra X sources", tone: "border-emerald-200 bg-emerald-50" },
    { label: "启用源", value: enabled, hint: "cost gated", tone: "border-amber-200 bg-amber-50" },
  ];

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.tone}`}>
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className="mt-1 text-3xl font-bold text-slate-900">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">{s.hint}</div>
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* Alpha 分类 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            V0 Scaffold
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            Serenity Alpha 分类
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            按多源 stance 共识给股票分层；当前只有主源启用，unique 表示暂时只有该源覆盖。
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="font-mono text-sm text-slate-700">unique</span>
            <span className="text-sm font-bold text-slate-900">{coverage}</span>
          </div>
        </section>

        {/* 信号源 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Configured
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">信号源</h2>
          <p className="mt-1 text-xs text-slate-400">
            列出已配置的外部观察源；disabled 表示为控制成本暂未抓取，enabled 后才会进入共识计算。
          </p>
          <ul className="mt-4 divide-y divide-slate-100">
            {sources.map((s) => (
              <li
                key={s.handle}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {s.name}
                  </div>
                  <div className="truncate font-mono text-xs text-slate-400">
                    {s.handle}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${sourceStatusClass(
                    s.status
                  )}`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function AiView({ data }: { data: BloggerData }) {
  const items = data.feed.filter(
    (f) => f.type === "GPT xhigh" || f.type === "观点变化"
  );
  return <FeedTimeline items={items} title="AI 更新与观点变化" />;
}

function IndustryView({ data }: { data: BloggerData }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <p className="text-sm text-slate-500">该博主的关注主题：</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.focusTags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
          >
            {t}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-slate-400">
        细分行业分布需要按标的所属行业的结构化数据，可在数据中新增 sector
        字段后扩展。
      </p>
    </section>
  );
}

function FollowView({ data }: { data: BloggerData }) {
  const url = `https://x.com/${data.handle.replace(/^@/, "")}`;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold ${data.avatarClass}`}
        >
          {data.initials}
        </div>
        <div>
          <div className="text-lg font-semibold text-slate-900">
            {data.name}
          </div>
          <div className="text-sm text-slate-400">{data.handle}</div>
        </div>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
        {data.bio}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.focusTags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          在 X 上关注 ↗
        </a>
        {data.memberUrl && (
          <a
            href={data.memberUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
          >
            打开会员频道 ↗
          </a>
        )}
      </div>
    </section>
  );
}

function SupplyChainView({ data }: { data: BloggerData }) {
  const sc: SupplyChainData =
    data.supplyChain ??
    deriveSupplyChain(mentionedTickers(data.priorityQueue, data.feed));

  if (sc.roles.length === 0) {
    return (
      <EmptyState
        title="暂无供应链关联"
        note="该博主提及的标的在共享供应链图谱中没有可识别的上下游关系。"
      />
    );
  }

  const stats = [
    { label: "节点", value: sc.nodes, hint: sc.asOf || sc.hopLabel, tone: "bg-blue-50" },
    { label: "边", value: sc.edges, hint: sc.hopLabel, tone: "bg-emerald-50" },
    {
      label: "传导事件",
      value: sc.propagationEvents,
      hint: sc.windowLabel,
      tone: "bg-amber-50",
    },
  ];

  return (
    <>
      {sc.derived && (
        <div className="mb-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-[11px] leading-relaxed text-slate-500">
          该博主未采用供应链研究方式。以下为根据其<strong>提及标的</strong>
          在共享供应链参考图谱上自动推导的关联视图（仅供参考）。
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl border border-slate-200 p-4 ${s.tone}`}>
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className="mt-1 text-3xl font-bold text-slate-900">
              {s.value}
            </div>
            {s.hint && (
              <div className="mt-1 text-[11px] text-slate-400">{s.hint}</div>
            )}
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* 角色分层 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Supply-Chain
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            角色分层
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            按供应链角色展示当前图谱覆盖的公司；节点只代表结构关系，不代表当前观点或仓位。
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {sc.roles.map((r) => (
              <div key={r.role}>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {r.role}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.tickers.map((t) => (
                    <span
                      key={t}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 传导提示 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Passive Catalysts
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">
            传导提示
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            从近期高优先级事件出发，沿供应链边传导后的二阶观察清单；分数是衰减后的优先级，不是涨跌预测。
          </p>
          {sc.catalysts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              当前没有触发供应链传导的高优先级事件。
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {sc.catalysts.map((c, i) => (
                <li key={i} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-bold text-slate-900">
                      {c.target}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">
                      {c.score}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                    {c.path}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {c.note}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function EmptyState({ title, note }: { title: string; note: string }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
        {note}
      </p>
    </section>
  );
}
