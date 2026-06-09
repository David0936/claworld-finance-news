"use client";

import { useEffect, useMemo, useState } from "react";
import type { BloggerData, FeedItem, SupplyChainData } from "@/data/types";
import LiveTweets from "./LiveTweets";
import clawIcon from "@/public/claw-icon.png";
import founderPhoto from "@/public/founder.jpg";
import xhsCard from "@/public/xhs-card.jpg";
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

const NAV_ITEMS = [
  { label: "总览", path: "/" },
  { label: "推文", path: "/tweets/" },
  { label: "股票", path: "/stocks/" },
  { label: "提及表现", path: "/mentions/" },
  { label: "战绩", path: "/performance/" },
  { label: "供应链", path: "/supply-chain/" },
  { label: "政客交易", path: "/political-trades/" },
  { label: "多源", path: "/sources/" },
  { label: "行业", path: "/industries/" },
  { label: "AI分析", path: "/llm/" },
  { label: "关注我", path: "/follow/" },
];

const NAV = NAV_ITEMS.map((item) => item.label);

function pathForNav(label: string) {
  return NAV_ITEMS.find((item) => item.label === label)?.path ?? "/";
}

function navFromPath(pathname: string) {
  const normalized = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return NAV_ITEMS.find((item) => item.path === normalized)?.label ?? "总览";
}

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
  政客交易: {
    eyebrow: "POLITICAL TRADES",
    title: "政客持仓线索",
    subtitle: "从 CapitolTrades 原始披露中筛高资金政客、持仓主题、重复交易与政策相关线索。",
  },
  多源: {
    eyebrow: "MULTI-SOURCE",
    title: "多源信号",
    subtitle: "外部观察源配置与共识覆盖；启用后才进入共识计算。",
  },
  行业: { title: "行业分布", subtitle: "按关注主题划分的覆盖分布。" },
  AI分析: { title: "AI 分析", subtitle: "GPT 更新与规则观点变化。" },
  关注我: { title: "关注我", subtitle: "作者主页与联系入口。" },
};

export default function Dashboard({
  bloggers,
  initialNav = "总览",
}: {
  bloggers: BloggerData[];
  initialNav?: string;
}) {
  const [activeNav, setActiveNav] = useState(initialNav);
  const [stockQuery, setStockQuery] = useState("");
  const [stockQueue, setStockQueue] = useState("全部队列");
  const data = bloggers[0];
  const section = SECTION_TITLES[activeNav] ?? SECTION_TITLES["总览"];
  const live = liveSnapshot(data);

  const selectNav = (item: string) => {
    if (item === "政客交易") {
      window.location.href = "/political-trades/";
      return;
    }

    setActiveNav(item);
    if (typeof window !== "undefined") {
      const nextPath = pathForNav(item);
      if (window.location.pathname !== nextPath) {
        window.history.pushState({ nav: item }, "", nextPath);
      }
    }
  };

  useEffect(() => {
    const onPopState = () => setActiveNav(navFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const goToStock = (ticker: string) => {
    setStockQuery(ticker);
    setStockQueue("全部队列");
    selectNav("股票");
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header pill bar */}
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 lg:px-6">
        <div className="mx-auto flex w-full max-w-shell items-center justify-between gap-4 rounded-full border border-[#e3ddcf] bg-[#fffefb]/95 px-3 py-2 shadow-sm backdrop-blur md:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={clawIcon.src}
              alt="Claworld"
              className="h-9 w-9 shrink-0 rounded-md object-contain"
            />
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate font-serif-rpt text-[15px] font-semibold tracking-tight text-[#16140f]">
                CLAWORLD · Serenity
              </span>
              <span className="truncate text-xs text-[#8c887e]">
                动态投研终端 · {data.handle}
              </span>
            </div>
          </div>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) =>
              item === "政客交易" ? (
                <a
                  key={item}
                  href={pathForNav(item)}
                  className="rounded-full px-3 py-1.5 text-sm text-[#6f6b61] transition hover:bg-[#ece8dd] hover:text-[#16140f]"
                >
                  {item}
                </a>
              ) : (
                <button
                  key={item}
                  onClick={() => selectNav(item)}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    activeNav === item
                      ? "bg-[#cf3019] text-white"
                      : "text-[#6f6b61] hover:bg-[#ece8dd] hover:text-[#16140f]"
                  }`}
                >
                  {item}
                </button>
              ),
            )}
          </nav>
          <button
            onClick={() => selectNav("多源")}
            className="rounded-full border border-[#e3ddcf] px-3 py-1.5 text-sm text-[#4b463d] hover:bg-[#f3efe7]"
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
            {NAV.map((item) =>
              item === "政客交易" ? (
                <a
                  key={item}
                  href={pathForNav(item)}
                  className="shrink-0 rounded-full border border-[#e3ddcf] bg-[#fffefb] px-3 py-1.5 text-sm text-[#6f6b61]"
                >
                  {item}
                </a>
              ) : (
                <button
                  key={item}
                  onClick={() => selectNav(item)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                    activeNav === item
                      ? "border-[#16140f] bg-[#16140f] text-white"
                      : "border-[#e3ddcf] bg-[#fffefb] text-[#6f6b61]"
                  }`}
                >
                  {item}
                </button>
              ),
            )}
          </div>

          {/* Title block（总览自带报头，故隐藏） */}
          {activeNav !== "总览" && (
          <section className="mb-4 rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {section.eyebrow && (
                  <div className="font-mono-rpt text-[10px] font-medium uppercase tracking-[0.16em] text-[#cf3019]">
                    {section.eyebrow}
                  </div>
                )}
                <h1 className="mt-0.5 font-serif-rpt text-2xl font-semibold text-[#16140f]">
                  {section.title}
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-[#6f6b61]">
                  {section.subtitle}
                </p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-right ${live.isLive ? "bg-emerald-50" : "bg-amber-50"}`}>
                <div className="text-[11px] uppercase tracking-wide text-[#8c887e]">
                  {live.label}
                </div>
                <div className={`text-sm font-semibold ${live.isLive ? "text-emerald-900" : "text-amber-900"}`}>
                  {live.value}
                </div>
                <div className={`mt-0.5 text-[10px] ${live.isLive ? "text-emerald-600" : "text-amber-600"}`}>
                  {live.hint}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.focusTags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-[#ece8dd] px-2.5 py-1 text-xs text-[#4b463d]"
                >
                  {t}
                </span>
              ))}
            </div>
          </section>
          )}

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

// 总览研报 · huashu C「瑞士网格 · 数据」：纸底 + Claworld 红 + 大号 grotesk 数字 + 衬线引文
function OverviewView({
  data,
  goToStock,
}: {
  data: BloggerData;
  goToStock: (ticker: string) => void;
}) {
  const mp = data.mentionPerformance;
  const tr = data.trackRecord;
  const tweets = data.feed.filter((f) => f.type === "推文").slice(0, 3);
  const pq = [...data.priorityQueue].slice(0, 4);
  const pool = (data.stockPool ?? []).slice(0, 12);
  const gainers = (mp?.topGainers ?? []).slice(0, 5);
  const parseGain = (g: string) => Math.abs(parseFloat((g || "").replace(/[^0-9.]/g, "")) || 0);
  const maxGain = Math.max(1, ...gainers.map((g) => parseGain(g.gain)));
  const stamp = (data.snapshotDate || "").replace(/-/g, "·");
  const trStats = (tr?.stats ?? []).slice(0, 4);

  const RuleLabel = ({ children }: { children: React.ReactNode }) => (
    <span className="font-mono-rpt text-[9.5px] uppercase tracking-[0.16em] text-[#8c887e]">
      {children}
    </span>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-[#d9d6cd] bg-[#f7f6f3] text-[#16140f]">
      <div className="h-1 bg-[#cf3019]" />
      <div className="p-5 md:p-8">
        {/* MASTHEAD */}
        <header className="flex flex-wrap items-start justify-between gap-5 border-b-2 border-[#16140f] pb-5">
          <div className="flex items-center gap-3">
            <img src={clawIcon.src} alt="Claworld" className="h-11 w-11 shrink-0 object-contain" />
            <div>
              <RuleLabel>Claworld · 投资研究终端</RuleLabel>
              <h1 className="mt-1 font-serif-rpt text-[34px] font-semibold leading-none md:text-[42px]">
                Serenity <em className="italic text-[#cf3019]">总览研报</em>
              </h1>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono-rpt text-xl tracking-tight md:text-2xl">{stamp}</div>
            <dl className="mt-2 grid gap-1 text-[11px]">
              {[
                ["快照时间", `${data.snapshotTime ?? "—"} UTC`],
                ["编纂", data.handle],
                ["覆盖", `${data.coverage ?? "—"} 标的`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-end gap-5">
                  <RuleLabel>{k}</RuleLabel>
                  <span className="font-mono-rpt text-[#16140f]">{v}</span>
                </div>
              ))}
            </dl>
          </div>
        </header>

        {/* SUBBAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9d6cd] py-2.5 font-mono-rpt text-[11px] text-[#8c887e]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#cf3019]" />
              实时数据流
            </span>
            <span>
              高风险 <b className="text-[#16140f]">{data.priorityHeader?.riskCount ?? "—"}</b>
            </span>
            <span>/</span>
            <span>
              GPT 信号 <b className="text-[#16140f]">{data.priorityHeader?.gptCount ?? "—"}</b>
            </span>
          </div>
          <div>第 001 期 · 总览 · 机械汇编 · 非投资建议</div>
        </div>

        {/* METRICS WALL */}
        <section className="mt-6 grid grid-cols-2 divide-x divide-y divide-[#d9d6cd] border border-[#d9d6cd] md:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
          {data.metrics.map((m) => (
            <div key={m.label} className="px-4 py-4">
              <RuleLabel>{m.label}</RuleLabel>
              <div className="mt-2 font-grotesk text-[40px] font-medium leading-none tracking-tight">
                {m.value}
              </div>
              <div className="mt-2 font-mono-rpt text-[10px] text-[#8c887e]">
                {m.hint || m.delta}
              </div>
            </div>
          ))}
        </section>

        {/* PRIORITY QUEUE + FEED */}
        <div className="mt-8 grid gap-8 xl:grid-cols-[1.6fr_1fr]">
          <section>
            <div className="flex items-baseline justify-between border-b-2 border-[#16140f] pb-2">
              <h2 className="flex items-baseline gap-3 font-serif-rpt text-lg font-semibold">
                <span className="font-grotesk text-[#cf3019]">01</span>优先队列 · Top 信号
              </h2>
              <RuleLabel>观点 / 提及 / 风险</RuleLabel>
            </div>
            {pq.map((s) => (
              <article key={s.ticker} className="flex gap-4 border-b border-[#d9d6cd] py-5">
                <div className="w-9 shrink-0 font-serif-rpt text-[40px] leading-none text-[#cf3019]">
                  {String(s.rank).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToStock(s.ticker)}
                      className="font-grotesk text-lg font-bold tracking-tight hover:text-[#cf3019]"
                    >
                      {s.ticker}
                    </button>
                    {s.sentiment && (
                      <span className="border border-[#d9d6cd] px-1.5 py-0.5 font-mono-rpt text-[10px] uppercase tracking-wider">
                        {s.sentiment}
                      </span>
                    )}
                    {s.riskLabel && (
                      <span className="border border-[#cf3019]/30 bg-[#cf3019]/[0.06] px-1.5 py-0.5 font-mono-rpt text-[10px] text-[#cf3019]">
                        {s.riskLabel}
                      </span>
                    )}
                    <span className="ml-auto font-mono-rpt text-[10px] text-[#8c887e]">{s.time}</span>
                  </div>
                  {s.note && (
                    <p className="mt-2 border-l-2 border-[#cf3019] pl-3 font-serif-rpt text-[14px] leading-relaxed [text-wrap:pretty]">
                      <span className="text-[#cf3019]">「</span>
                      {s.note}
                      <span className="text-[#cf3019]">」</span>
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-4 gap-3">
                    {[
                      ["提及 24h", s.mentions24h],
                      ["提及 7d", s.mentions7d],
                      ["来源", s.source],
                      ["综合分", s.priority],
                    ].map(([k, v]) => (
                      <div key={String(k)}>
                        <RuleLabel>{k}</RuleLabel>
                        <div className="mt-0.5 font-mono-rpt text-[17px] font-medium tracking-tight">
                          {v as React.ReactNode}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section>
            <div className="flex items-baseline justify-between border-b-2 border-[#16140f] pb-2">
              <h2 className="flex items-baseline gap-3 font-serif-rpt text-lg font-semibold">
                <span className="font-grotesk text-[#cf3019]">02</span>最新推文线索
              </h2>
            </div>
            {tweets.length === 0 && (
              <p className="py-5 font-mono-rpt text-xs text-[#8c887e]">暂无推文</p>
            )}
            {tweets.map((t, i) => {
              const tickers = t.tickers ?? (t.ticker ? [t.ticker] : []);
              return (
                <article key={i} className="border-b border-[#d9d6cd] py-3.5">
                  <div className="flex items-center gap-2 font-mono-rpt text-[11px]">
                    <span className="font-medium text-[#cf3019]">{t.time}</span>
                    {tickers.map((tk) => (
                      <button
                        key={tk}
                        type="button"
                        onClick={() => goToStock(tk)}
                        className="text-[#8c887e] hover:text-[#cf3019]"
                      >
                        ${tk}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 font-serif-rpt text-[14px] leading-relaxed [text-wrap:pretty]">
                    {t.body}
                  </p>
                  {t.stats && (
                    <div className="mt-1.5 flex gap-4 font-mono-rpt text-[10px] text-[#8c887e]">
                      <span>浏览 {t.stats.views ?? "0"}</span>
                      <span>赞 {t.stats.likes ?? "0"}</span>
                      <span>转 {t.stats.reposts ?? "0"}</span>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        </div>

        {/* PERFORMANCE */}
        <div className="mt-8 grid gap-8 xl:grid-cols-[1.4fr_1fr]">
          <section>
            <div className="flex items-baseline justify-between border-b-2 border-[#16140f] pb-2">
              <h2 className="flex items-baseline gap-3 font-serif-rpt text-lg font-semibold">
                <span className="font-grotesk text-[#cf3019]">03</span>提及后表现 · 最大涨幅
              </h2>
              {mp && (
                <RuleLabel>
                  正收益 {mp.positiveToDate} / {mp.rows?.length ?? 0}
                </RuleLabel>
              )}
            </div>
            <div className="mt-4 grid gap-2.5">
              {gainers.map((g, i) => (
                <div key={g.ticker} className="flex items-center gap-3">
                  <span className="w-4 font-mono-rpt text-[11px] text-[#8c887e]">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => goToStock(g.ticker)}
                    className="w-16 text-left font-grotesk text-sm font-semibold hover:text-[#cf3019]"
                  >
                    ${g.ticker}
                  </button>
                  <div className="h-2 flex-1 bg-[#eceae3]">
                    <div
                      className="h-full bg-[#cf3019]"
                      style={{ width: `${(parseGain(g.gain) / maxGain) * 100}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-mono-rpt text-sm font-semibold tracking-tight text-[#cf3019]">
                    {g.gain}
                  </span>
                </div>
              ))}
            </div>
            {mp?.chains && mp.chains.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-[#d9d6cd] pt-4 sm:grid-cols-3">
                {mp.chains.map((c) => (
                  <div key={c.name} className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono-rpt text-[11px] text-[#8c887e]">{c.name}</span>
                    <span className="font-mono-rpt text-[12px] font-medium">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-baseline justify-between border-b-2 border-[#16140f] pb-2">
              <h2 className="flex items-baseline gap-3 font-serif-rpt text-lg font-semibold">
                <span className="font-grotesk text-[#cf3019]">04</span>战绩
              </h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5">
              {trStats.map((s) => (
                <div key={s.label}>
                  <div className="font-grotesk text-[32px] font-medium leading-none tracking-tight text-[#cf3019]">
                    {s.value}
                  </div>
                  <div className="mt-2 font-mono-rpt text-[10px] text-[#8c887e]">{s.label}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* STOCK POOL */}
        {pool.length > 0 && (
          <section className="mt-8">
            <div className="flex items-baseline justify-between border-b-2 border-[#16140f] pb-2">
              <h2 className="flex items-baseline gap-3 font-serif-rpt text-lg font-semibold">
                <span className="font-grotesk text-[#cf3019]">05</span>股票池样本
              </h2>
              <RuleLabel>队列 / 立场 / 提及 / 分数</RuleLabel>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse font-mono-rpt text-[11.5px]">
                <thead>
                  <tr className="border-b border-[#d9d6cd] text-left text-[#8c887e]">
                    {["标的", "队列", "立场", "24h", "7d", "30d", "新闻", "分数"].map((h) => (
                      <th key={h} className="px-2 py-2 font-normal uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pool.map((s) => (
                    <tr
                      key={s.ticker}
                      className="cursor-pointer border-b border-[#eceae3] hover:bg-[#fffefb]"
                      onClick={() => goToStock(s.ticker)}
                    >
                      <td className="px-2 py-2 font-grotesk text-[12px] font-semibold">${s.ticker}</td>
                      <td className="px-2 py-2 text-[#8c887e]">{s.queue}</td>
                      <td className="px-2 py-2">{s.stance}</td>
                      <td className="px-2 py-2">{s.mentions24h}</td>
                      <td className="px-2 py-2">{s.mentions7d}</td>
                      <td className="px-2 py-2">{s.mentions30d}</td>
                      <td className="px-2 py-2">{s.news}</td>
                      <td className="px-2 py-2 font-semibold text-[#cf3019]">{s.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* COLOPHON */}
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#d9d6cd] pt-4 font-mono-rpt text-[10px] text-[#8c887e]">
          <span>Claworld · Serenity 投研终端 · 数据机械汇编自公开来源</span>
          <span>⚠️ 仅信息提示，非投资建议</span>
        </footer>
      </div>
    </div>
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
      <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
              Queue
            </div>
            <h2 className="mt-1 text-base font-semibold text-[#16140f]">
              队列分布
            </h2>
          </div>
          <span className="text-xs text-[#8c887e]">{pool.length} 标的</span>
        </div>
        <div className="mt-4 grid gap-3">
          {queueRows.slice(0, 5).map(([queue, count]) => (
            <div key={queue}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-[#4b463d]">{queue}</span>
                <span className="font-semibold text-[#16140f]">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#ece8dd]">
                <div
                  className="h-full rounded-full bg-[#16140f]"
                  style={{ width: `${(count / queueMax) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
          Heat
        </div>
        <h2 className="mt-1 text-base font-semibold text-[#16140f]">热点股票</h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {hotStocks.map((s) => (
            <button
              key={s.ticker}
              className="rounded-xl border border-[#e3ddcf] bg-[#f3efe7] px-3 py-2 text-left hover:border-[#cfc7b6] hover:bg-[#fffefb]"
              onClick={() => goToStock(s.ticker)}
              type="button"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-[#16140f]">
                  ${s.ticker}
                </span>
                <span className="text-[11px] text-rose-600">{s.mentions24h}H</span>
              </div>
              <div className="mt-1 text-[11px] text-[#8c887e]">
                7D {s.mentions7d} · {s.source}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
          Freshness
        </div>
        <h2 className="mt-1 text-base font-semibold text-[#16140f]">数据新鲜度</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-[#f3efe7] px-3 py-2">
            <dt className="text-[#6f6b61]">公开推文</dt>
            <dd className="font-semibold text-[#16140f]">{publicTweets}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2">
            <dt className="text-[#6f6b61]">最新时间</dt>
            <dd className="font-mono text-xs font-semibold text-[#16140f]">
              {latest?.datetime ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-[#f3efe7] px-3 py-2">
            <dt className="text-[#6f6b61]">受限源</dt>
            <dd className="font-semibold text-[#a4220f]">{restricted.length}</dd>
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
      <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5 xl:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
              Pipeline
            </div>
            <h2 className="mt-1 text-base font-semibold text-[#16140f]">
              解析工作流
            </h2>
          </div>
          <span className="rounded-full bg-[#16140f] px-2.5 py-1 text-xs font-medium text-white">
            {data.handle}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {workflow.map((step) => (
            <div key={step.label} className="rounded-xl border border-[#e3ddcf] p-3">
              <div className="text-[11px] text-[#8c887e]">{step.label}</div>
              <div className="mt-1 text-sm font-semibold text-[#16140f]">
                {step.value}
              </div>
              <div className="mt-1 truncate text-[11px] text-[#8c887e]">
                {step.hint}
              </div>
            </div>
          ))}
        </div>
        {data.memberUrl && (
          <div className="mt-3 rounded-xl border border-[#e3ddcf] bg-[#f3efe7] px-3 py-2 text-xs leading-relaxed text-[#a4220f]">
            会员频道只展示入口和导入状态。已授权内容可通过导出/粘贴进入同一解析管线，避免把登录态抓取或付费内容固化在仓库里。
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5 xl:col-span-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
          Signal Mix
        </div>
        <h2 className="mt-1 text-base font-semibold text-[#16140f]">信号构成</h2>
        <div className="mt-4 grid gap-2">
          {Object.entries(feedTypeCounts).map(([type, count]) => (
            <div key={type} className="flex items-center justify-between gap-3 text-sm">
              <span className={`rounded px-2 py-1 text-xs ${feedTypeClass(type as FeedItem["type"])}`}>
                {type}
              </span>
              <span className="font-semibold text-[#16140f]">{count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5 xl:col-span-5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
          Catalysts
        </div>
        <h2 className="mt-1 text-base font-semibold text-[#16140f]">
          下一批复核清单
        </h2>
        {catalysts.length === 0 ? (
          <p className="mt-3 text-sm text-[#8c887e]">当前没有供应链传导提示。</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {catalysts.map((c) => (
              <article key={`${c.target}-${c.path}`} className="rounded-xl border border-[#e3ddcf] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-[#16140f]">
                    {c.target}
                  </span>
                  <span className="text-xs font-semibold text-[#6f6b61]">
                    {c.score}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[11px] text-[#8c887e]">
                  {c.path}
                </div>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#6f6b61]">
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
    <section className="mt-4 rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#16140f]">
            今日优先队列
          </h2>
          <p className="text-xs text-[#8c887e]">先处理有边际变化的股票</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700 ring-1 ring-red-200">
            {data.priorityHeader.riskLabel} {data.priorityHeader.riskCount}
          </span>
          <span className="rounded-full bg-[#16140f] px-2.5 py-1 font-medium text-white">
            GPT {data.priorityHeader.gptCount}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {data.priorityQueue.map((s) => (
          <article
            key={s.ticker}
            className="rounded-xl border border-[#e3ddcf] bg-[#f3efe7]/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#16140f] text-xs font-bold text-white">
                  {s.rank}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-[#16140f]">
                      {s.ticker}
                    </span>
                    <span className="rounded bg-[#16140f] px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                      GPT {s.gptLevel}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#8c887e]">{s.time}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-center text-xs text-[#6f6b61]">
                <div>
                  <div className="font-semibold text-[#16140f]">
                    {s.mentions24h}
                  </div>
                  <div className="text-[10px]">24h</div>
                </div>
                <div>
                  <div className="font-semibold text-[#16140f]">
                    {s.mentions7d}
                  </div>
                  <div className="text-[10px]">7天</div>
                </div>
                <div>
                  <div className="font-semibold text-[#16140f]">
                    {s.source}
                    {s.sourceCount ? ` ${s.sourceCount}` : ""}
                  </div>
                  <div className="text-[10px]">来源</div>
                </div>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-[#4b463d]">
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
              <span className="ml-auto rounded-full bg-[#16140f] px-2.5 py-1 text-xs font-semibold text-white">
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
    <section className="mt-4 rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#16140f]">{title}</h2>
        <span className="text-xs text-[#8c887e]">共 {items.length} 条</span>
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
                <span className="my-1 w-px flex-1 bg-[#ece8dd]" />
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
                <span className="text-sm font-semibold text-[#16140f]">
                  {f.title}
                </span>
                <span className="ml-auto text-[11px] text-[#8c887e]">
                  {f.time}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[#4b463d]">
                {f.body}
              </p>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#8c887e]">
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
  if (!level) return "bg-[#ece8dd] text-[#4b463d]";
  if (level.includes("极端") || level.includes("高"))
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (level.includes("中低") || level.includes("低"))
    return "bg-[#f3efe7] text-[#a4220f] ring-1 ring-[#e3ddcf]";
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
  const relatedTickers = [
    ...new Set(tweets.flatMap((t) => t.tickers ?? (t.ticker ? [t.ticker] : []))),
  ];

  if (tweets.length === 0) {
    return <EmptyState title="暂无推文" note="当前博主在本快照下没有推文线索。" />;
  }

  const profileUrl = `https://x.com/${data.handle.replace(/^@/, "")}`;

  return (
    <>
      <LiveTweets fallback={tweets} handle={data.handle} />

      <section className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#e3ddcf] bg-[#f3efe7] p-4">
          <div className="text-xs text-[#6f6b61]">推文</div>
          <div className="mt-1 text-3xl font-bold text-[#16140f]">
            {tweets.length}
          </div>
          <div className="mt-1 text-[11px] text-[#8c887e]">最新 {tweets.length} 条</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs text-[#6f6b61]">相关公司</div>
          <div className="mt-1 text-3xl font-bold text-[#16140f]">
            {relatedTickers.length}
          </div>
          <div className="mt-1 text-[11px] text-[#6f6b61]">
            {relatedTickers.map((t) => `$${t}`).join(", ")}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* 时间线 */}
        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
            最新 {tweets.length} 条
          </div>
          <h2 className="mt-1 text-base font-semibold text-[#16140f]">时间线</h2>
          <div className="mt-4 grid gap-3">
            {tweets.map((t, i) => {
              const tweetTickers = t.tickers ?? (t.ticker ? [t.ticker] : []);
              const tweetStocks = tweetTickers
                .map((ticker) => findStock(pool, ticker))
                .filter(
                  (stock): stock is NonNullable<ReturnType<typeof findStock>> =>
                    Boolean(stock)
                );
              return (
                <article
                  key={i}
                  className="rounded-xl border border-[#e3ddcf] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#6f6b61]">
                      {t.datetime}
                    </span>
                    <span className="text-xs text-[#8c887e]">{t.author}</span>
                    <a
                      href={t.url ?? profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto rounded-md border border-[#e3ddcf] px-2 py-1 text-[11px] text-[#6f6b61] hover:bg-[#f3efe7]"
                    >
                      ↗ X
                    </a>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[#3a352d]">
                    {t.body}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-[#8c887e]">
                    <span>浏览 {t.stats?.views ?? "0"}</span>
                    <span>赞 {t.stats?.likes ?? "0"}</span>
                    <span>转发 {t.stats?.reposts ?? "0"}</span>
                    <span>收藏 {t.stats?.bookmarks ?? "0"}</span>
                  </div>
                  {tweetStocks.length > 0 && (
                    <div className="mt-3 grid gap-2">
                      {tweetStocks.map((stock) => (
                        <div key={stock.ticker} className="rounded-lg bg-[#f3efe7] p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#16140f]">
                              ${stock.ticker}
                            </span>
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                              {stock.queue}
                            </span>
                            <button
                              onClick={() => goToStock(stock.ticker)}
                              className="ml-auto text-[11px] font-medium text-[#cf3019] hover:underline"
                            >
                              打开股票页
                            </button>
                          </div>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-[#6f6b61]">
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
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* 公司速读 */}
        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
                标签提取
              </div>
              <h2 className="mt-1 text-base font-semibold text-[#16140f]">
                公司速读
              </h2>
            </div>
            <span className="text-xs text-[#8c887e]">
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
                    className="rounded-xl border border-[#e3ddcf] p-4"
                  >
                    <span className="font-bold text-[#16140f]">${ticker}</span>
                    <p className="mt-1 text-xs text-[#8c887e]">
                      该标的暂未进入股票池。
                    </p>
                  </div>
                );
              }
              return (
                <div key={ticker} className="rounded-xl border border-[#e3ddcf] p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-[#16140f]">
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
                    <div className="mt-1 font-mono text-[11px] text-[#8c887e]">
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
                        <div className="text-sm font-semibold text-[#16140f]">
                          {val}
                        </div>
                        <div className="text-[10px] text-[#8c887e]">{label}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-[#6f6b61]">
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
                    className="mt-3 text-xs font-medium text-[#cf3019] hover:underline"
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
  return "bg-[#ece8dd] text-[#4b463d]";
}

function revenueClass(rev: string): string {
  if (rev.startsWith("-")) return "text-red-600";
  if (rev === "–") return "text-[#b8b2a4]";
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
  const [chain, setChain] = useState("全部链条");
  const [stance, setStance] = useState("全部观点");
  const [activity, setActivity] = useState("全部时间");
  const [returnFilter, setReturnFilter] = useState("全部收益");
  const [sortMode, setSortMode] = useState("分数");
  const performanceByTicker = useMemo(() => {
    const map = new Map<string, NonNullable<BloggerData["mentionPerformance"]>["rows"][number]>();
    data.mentionPerformance?.rows.forEach((row) => map.set(row.ticker, row));
    return map;
  }, [data.mentionPerformance]);
  const queues = useMemo(
    () => ["全部队列", ...new Set(pool.map((s) => s.queue))],
    [pool]
  );
  const chains = useMemo(
    () => [
      "全部链条",
      ...new Set(
        pool
          .map((s) => performanceByTicker.get(s.ticker)?.chain ?? s.industry)
          .filter(Boolean) as string[]
      ),
    ],
    [pool, performanceByTicker]
  );

  const q = query.trim().toLowerCase();
  const rows = pool
    .filter((s) => queue === "全部队列" || s.queue === queue)
    .filter((s) => stance === "全部观点" || s.stance === stance)
    .filter((s) => {
      if (chain === "全部链条") return true;
      const row = performanceByTicker.get(s.ticker);
      return row?.chain === chain || s.industry === chain;
    })
    .filter((s) => {
      if (activity === "24h有提及") return s.mentions24h > 0;
      if (activity === "7天有提及") return s.mentions7d > 0;
      if (activity === "30天有提及") return s.mentions30d > 0;
      if (activity === "有新闻") return s.news > 0;
      if (activity === "有披露") return s.disclosures > 0;
      return true;
    })
    .filter((s) => {
      if (returnFilter === "全部收益") return true;
      const value = parsePercent(performanceByTicker.get(s.ticker)?.toDate);
      if (returnFilter === "至今为正") return value !== null && value > 0;
      if (returnFilter === "至今为负") return value !== null && value < 0;
      if (returnFilter === "未到期/无价") return value === null;
      return true;
    })
    .filter(
      (s) =>
        !q ||
        s.ticker.toLowerCase().includes(q) ||
        (s.industry ?? "").toLowerCase().includes(q) ||
        (performanceByTicker.get(s.ticker)?.chain ?? "").toLowerCase().includes(q)
    )
    .sort((a, b) => {
      if (sortMode === "24H") return b.mentions24h - a.mentions24h;
      if (sortMode === "7D") return b.mentions7d - a.mentions7d;
      if (sortMode === "30D") return b.mentions30d - a.mentions30d;
      if (sortMode === "新闻") return b.news - a.news;
      if (sortMode === "收入") return (parsePercent(b.revenue) ?? -99999) - (parsePercent(a.revenue) ?? -99999);
      if (sortMode === "至今收益") {
        return (
          (parsePercent(performanceByTicker.get(b.ticker)?.toDate) ?? -99999) -
          (parsePercent(performanceByTicker.get(a.ticker)?.toDate) ?? -99999)
        );
      }
      return b.score - a.score;
    });

  if (pool.length === 0) {
    return <EmptyState title="暂无覆盖标的" note="当前博主没有覆盖的股票。" />;
  }

  return (
    <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb]">
      <div className="grid gap-3 border-b border-[#e3ddcf] bg-[#f3efe7]/70 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索股票 / 行业 / 链条"
            className="h-9 min-w-[220px] flex-1 rounded-lg border border-[#e3ddcf] bg-[#fffefb] px-3 text-sm outline-none focus:border-[#b8b2a4]"
          />
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setQueue("全部队列");
              setChain("全部链条");
              setStance("全部观点");
              setActivity("全部时间");
              setReturnFilter("全部收益");
              setSortMode("分数");
            }}
            className="h-9 rounded-lg border border-[#e3ddcf] bg-[#fffefb] px-3 text-sm text-[#4b463d] hover:bg-[#ece8dd]"
          >
            重置
          </button>
          <span className="ml-auto text-xs text-[#8c887e]">
            显示 {rows.length} / {pool.length}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["队列", queue, setQueue, queues],
            ["链条", chain, setChain, chains],
            ["观点", stance, setStance, ["全部观点", "看多", "中性", "看空"]],
            ["时间", activity, setActivity, ["全部时间", "24h有提及", "7天有提及", "30天有提及", "有新闻", "有披露"]],
            ["收益", returnFilter, setReturnFilter, ["全部收益", "至今为正", "至今为负", "未到期/无价"]],
            ["排序", sortMode, setSortMode, ["分数", "24H", "7D", "30D", "新闻", "收入", "至今收益"]],
          ].map(([label, value, setter, options]) => (
            <label key={label as string} className="grid gap-1">
              <span className="text-[11px] font-medium text-[#8c887e]">
                {label as string}
              </span>
              <select
                value={value as string}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                className="h-9 min-w-0 rounded-lg border border-[#e3ddcf] bg-[#fffefb] px-3 text-sm outline-none focus:border-[#b8b2a4]"
              >
                {(options as string[]).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-[#e3ddcf] bg-[#f3efe7] text-left text-xs text-[#6f6b61]">
            <tr>
              <th className="px-4 py-3 font-medium">股票</th>
              <th className="px-4 py-3 font-medium">链条</th>
              <th className="px-4 py-3 font-medium">队列</th>
              <th className="px-4 py-3 font-medium">SERENITY</th>
              <th className="px-4 py-3 font-medium">更新时间</th>
              <th className="px-3 py-3 text-right font-medium">24H</th>
              <th className="px-3 py-3 text-right font-medium">7D</th>
              <th className="px-3 py-3 text-right font-medium">30D</th>
              <th className="px-3 py-3 text-right font-medium">新闻</th>
              <th className="px-3 py-3 text-right font-medium">披露</th>
              <th className="px-3 py-3 text-right font-medium">收入</th>
              <th className="px-3 py-3 text-right font-medium">至今</th>
              <th className="px-4 py-3 text-right font-medium">分数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((s) => {
              const perf = performanceByTicker.get(s.ticker);
              const chainLabel = perf?.chain ?? s.industry ?? "—";
              return (
                <tr key={s.ticker} className="hover:bg-[#f3efe7]/60">
                  <td className="px-4 py-3 font-bold text-[#16140f]">
                    {s.ticker}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6f6b61]">
                    {chainLabel}
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
                  <td className="px-4 py-3 font-mono text-xs text-[#8c887e]">
                    {s.updatedAt}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-rose-600">
                    {s.mentions24h}
                  </td>
                  <td className="px-3 py-3 text-right text-[#3a352d]">
                    {s.mentions7d}
                  </td>
                  <td className="px-3 py-3 text-right text-[#3a352d]">
                    {s.mentions30d}
                  </td>
                  <td className="px-3 py-3 text-right text-[#3a352d]">{s.news}</td>
                  <td className="px-3 py-3 text-right text-[#3a352d]">
                    {s.disclosures}
                  </td>
                  <td
                    className={`px-3 py-3 text-right font-medium ${revenueClass(
                      s.revenue
                    )}`}
                  >
                    {s.revenue}
                  </td>
                  <td
                    className={`px-3 py-3 text-right font-medium ${returnClass(
                      perf?.toDate ?? "—"
                    )}`}
                  >
                    {perf?.toDate ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-[#16140f]">
                    {s.score}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function returnClass(v: string): string {
  if (v === "未到期" || v === "—") return "text-[#b8b2a4]";
  if (v.startsWith("-")) return "text-red-600";
  return "text-emerald-600";
}

function parsePercent(value?: string): number | null {
  if (!value || value === "–" || value === "—" || value === "未到期") return null;
  const parsed = Number.parseFloat(value.replace(/[%+,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
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
            className={`rounded-xl border p-4 ${s.tone ?? "border-[#e3ddcf] bg-[#fffefb]"}`}
          >
            <div className="text-xs text-[#6f6b61]">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-[#16140f]">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] text-[#8c887e]">{s.hint}</div>
          </div>
        ))}
      </section>

      <div className="mt-3 flex flex-wrap gap-2">
        {mp.chains.map((c) => (
          <span
            key={c.name}
            className="rounded-full border border-[#e3ddcf] bg-[#fffefb] px-3 py-1 text-xs text-[#4b463d]"
          >
            {c.name} <span className="font-semibold text-[#16140f]">{c.count}</span>
          </span>
        ))}
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
          至今为正 <span className="font-semibold">{mp.positiveToDate}</span>
        </span>
      </div>

      <section className="mt-4 rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
        <h2 className="text-base font-semibold text-[#16140f]">最大收益率 5 只</h2>
        <ol className="mt-3 divide-y divide-slate-100">
          {mp.topGainers.map((g, i) => (
            <li key={g.ticker} className="flex items-center gap-3 py-2.5">
              <span className="w-5 text-sm text-[#8c887e]">{i + 1}</span>
              <span className="font-bold text-[#16140f]">{g.ticker}</span>
              <span className="text-xs text-[#8c887e]">{g.chain}</span>
              <span className="ml-auto text-sm font-semibold text-emerald-600">
                {g.gain}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4 rounded-2xl border border-[#e3ddcf] bg-[#fffefb]">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-base font-semibold text-[#16140f]">提及后表现</h2>
          <div className="flex gap-1.5 text-[11px]">
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
              +收益
            </span>
            <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">
              -收益
            </span>
            <span className="rounded bg-[#ece8dd] px-2 py-0.5 text-[#8c887e]">
              未到期/无价
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-y border-[#e3ddcf] bg-[#f3efe7] text-left text-xs text-[#6f6b61]">
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
                <tr key={r.ticker} className="hover:bg-[#f3efe7]/60">
                  <td className="px-4 py-3 font-bold text-[#16140f]">
                    {r.ticker}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6f6b61]">{r.chain}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${queueBadgeClass(
                        r.queue
                      )}`}
                    >
                      {r.queue}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#8c887e]">
                    {r.firstMention}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#8c887e]">
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
      <div className="mb-3 rounded-xl border border-dashed border-[#cfc7b6] bg-[#fffefb] px-4 py-2.5 text-[11px] leading-relaxed text-[#6f6b61]">
        该博主没有接入收益回测数据。以下按 7 天累计提及次数做的轻量排名。
      </div>
      <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.ticker} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm font-bold text-[#16140f]">
                {r.ticker}
              </span>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-[#ece8dd]">
                <div
                  className="flex h-full items-center justify-end rounded-full bg-[#16140f] pr-2 text-[11px] font-medium text-white"
                  style={{ width: `${(r.mentions7d / max) * 100}%` }}
                >
                  {r.mentions7d}
                </div>
              </div>
              <span className="w-20 shrink-0 text-right text-xs text-[#8c887e]">
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
  if (pct >= 45) return "bg-[#b8b2a4]";
  if (pct >= 35) return "bg-[#d8d2c4]";
  return "bg-[#ece8dd]";
}

function excessClass(v: number): string {
  if (v > 0) return "text-emerald-600";
  if (v < 0) return "text-red-600";
  return "text-[#8c887e]";
}

function signedTextClass(v: string): string {
  if (v.trim().startsWith("-")) return "text-red-600";
  if (v.trim() === "-" || v.trim() === "—") return "text-[#b8b2a4]";
  return "text-emerald-600";
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
            className={`rounded-xl border p-4 ${s.tone ?? "border-[#e3ddcf] bg-[#fffefb]"}`}
          >
            <div className="text-xs text-[#6f6b61]">{s.label}</div>
            <div className="mt-1 text-3xl font-bold text-[#16140f]">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] text-[#8c887e]">{s.hint}</div>
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* Heatmap */}
        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
            Heatmap
          </div>
          <h2 className="mt-1 text-base font-semibold text-[#16140f]">
            View × Horizon
          </h2>
          <p className="mt-1 text-xs text-[#8c887e]">
            按当前规则视图横向比较 1D 到 6M 的胜率；条块越满，代表该窗口跑赢 SPY 的比例越高。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-[#8c887e]">
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
                  <tr key={row.view} className="border-t border-[#ece8dd]">
                    <td className="py-2 pr-3 font-mono text-xs text-[#4b463d]">
                      {row.view}
                    </td>
                    {row.cells.map((pct, i) => (
                      <td key={i} className="py-2 pl-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="h-2 w-8 overflow-hidden rounded-full bg-[#ece8dd]">
                            <span
                              className={`block h-full ${heatClass(pct)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span className="w-12 text-right text-xs tabular-nums text-[#4b463d]">
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
        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
            1M
          </div>
          <h2 className="mt-1 text-base font-semibold text-[#16140f]">校准曲线</h2>
          <p className="mt-1 text-xs text-[#8c887e]">
            按 view 与 confidence 分组看 1M 后续表现；N 是样本数，胜率是跑赢 SPY 的比例，超额单位为百分点。
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="text-left text-[11px] uppercase text-[#8c887e]">
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
                  <tr key={c.group} className="border-t border-[#ece8dd]">
                    <td className="py-2 pr-2 font-mono text-xs text-[#4b463d]">
                      {c.group}
                    </td>
                    <td className="py-2 text-right text-[#6f6b61]">{c.n}</td>
                    <td className="py-2 text-right font-semibold text-[#16140f]">
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

      {tr.groupTables && tr.groupTables.length > 0 && (
        <section className="mt-4 grid gap-4 xl:grid-cols-2">
          {tr.groupTables.map((table) => (
            <div
              key={table.key}
              className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5"
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
                {table.horizon}
              </div>
              <h2 className="mt-1 text-base font-semibold text-[#16140f]">
                {table.title}
              </h2>
              <p className="mt-1 text-xs text-[#8c887e]">{table.note}</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <thead className="text-left text-[11px] uppercase text-[#8c887e]">
                    <tr>
                      <th className="py-2 font-medium">分组</th>
                      <th className="py-2 text-right font-medium">N</th>
                      <th className="py-2 text-right font-medium">胜率</th>
                      <th className="py-2 text-right font-medium">均值超额</th>
                      <th className="py-2 text-right font-medium">中位超额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.group} className="border-t border-[#ece8dd]">
                        <td className="py-2 pr-2 font-mono text-xs text-[#4b463d]">
                          {row.group}
                        </td>
                        <td className="py-2 text-right text-[#6f6b61]">{row.n}</td>
                        <td className="py-2 text-right font-semibold text-[#16140f]">
                          {row.winRate.toFixed(1)}%
                        </td>
                        <td
                          className={`py-2 text-right ${excessClass(
                            row.meanExcess
                          )}`}
                        >
                          {row.meanExcess}
                        </td>
                        <td
                          className={`py-2 text-right ${excessClass(
                            row.medianExcess
                          )}`}
                        >
                          {row.medianExcess}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {tr.recentDecay && tr.recentDecay.rows.length > 0 && (
          <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
              recent_30d_vs_history
            </div>
            <h2 className="mt-1 text-base font-semibold text-[#16140f]">
              {tr.recentDecay.title}
            </h2>
            <p className="mt-1 text-xs text-[#8c887e]">{tr.recentDecay.note}</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-[11px] uppercase text-[#8c887e]">
                  <tr>
                    <th className="py-2 font-medium">分组</th>
                    <th className="py-2 text-right font-medium">Recent</th>
                    <th className="py-2 text-right font-medium">History</th>
                    <th className="py-2 text-right font-medium">差值</th>
                  </tr>
                </thead>
                <tbody>
                  {tr.recentDecay.rows.map((row) => (
                    <tr key={row.group} className="border-t border-[#ece8dd]">
                      <td className="py-2 pr-2 font-mono text-xs text-[#4b463d]">
                        {row.group}
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-[#6f6b61]">
                        {row.recent}
                      </td>
                      <td className="py-2 text-right font-mono text-xs text-[#6f6b61]">
                        {row.history}
                      </td>
                      <td
                        className={`py-2 text-right font-semibold ${signedTextClass(
                          row.delta
                        )}`}
                      >
                        {row.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tr.equalWeight && (
          <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
              equal-weight
            </div>
            <h2 className="mt-1 text-base font-semibold text-[#16140f]">
              {tr.equalWeight.title}
            </h2>
            <p className="mt-1 text-xs text-[#8c887e]">{tr.equalWeight.note}</p>
            {tr.equalWeight.stats.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {tr.equalWeight.stats.map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-xl border p-3 ${s.tone ?? "border-[#e3ddcf] bg-[#f3efe7]"}`}
                  >
                    <div className="text-[11px] text-[#6f6b61]">{s.label}</div>
                    <div
                      className={`mt-1 text-lg font-bold ${signedTextClass(
                        s.value
                      )}`}
                    >
                      {s.value}
                    </div>
                    <div className="mt-1 text-[10px] text-[#8c887e]">{s.hint}</div>
                  </div>
                ))}
              </div>
            )}
            {tr.equalWeight.rows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <thead className="text-left text-[11px] uppercase text-[#8c887e]">
                    <tr>
                      <th className="py-2 font-medium">月份</th>
                      <th className="py-2 text-right font-medium">持仓</th>
                      <th className="py-2 text-right font-medium">Proxy</th>
                      <th className="py-2 text-right font-medium">SPY</th>
                      <th className="py-2 text-right font-medium">SOXX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tr.equalWeight.rows.map((row) => (
                      <tr key={row.month} className="border-t border-[#ece8dd]">
                        <td className="py-2 font-mono text-xs text-[#4b463d]">
                          {row.month}
                        </td>
                        <td className="py-2 text-right text-[#6f6b61]">
                          {row.holdings}
                        </td>
                        <td
                          className={`py-2 text-right font-semibold ${signedTextClass(
                            row.proxy
                          )}`}
                        >
                          {row.proxy}
                        </td>
                        <td
                          className={`py-2 text-right ${signedTextClass(row.spy)}`}
                        >
                          {row.spy}
                        </td>
                        <td
                          className={`py-2 text-right ${signedTextClass(
                            row.soxx
                          )}`}
                        >
                          {row.soxx}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function sourceStatusClass(status: string): string {
  if (status === "primary")
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "enabled")
    return "bg-[#f3efe7] text-[#a4220f] ring-1 ring-[#e3ddcf]";
  if (status === "restricted")
    return "bg-[#f3efe7] text-[#a4220f] ring-1 ring-[#e3ddcf]";
  return "bg-[#ece8dd] text-[#6f6b61]";
}

function liveSnapshot(data: BloggerData) {
  const status = data.liveStatus;
  if (status?.mode === "live") {
    return {
      isLive: true,
      label: "实时快照",
      value: status.fetchedAt ?? `${data.snapshotDate} ${data.snapshotTime}`,
      hint: status.source,
    };
  }
  return {
    isLive: false,
    label: "实时状态",
    value: "等待真实抓取",
    hint: "未写入 live",
  };
}

function MultiSourceView({ data }: { data: BloggerData }) {
  const sources = resolveSources(data);
  const coverage = resolveCoverage(data);
  const extra = sources.filter((s) => s.status !== "primary").length;
  const enabled = sources.filter((s) => s.status === "enabled").length;
  const live = liveSnapshot(data);

  const stats = [
    { label: "覆盖股票", value: coverage, hint: live.isLive ? live.value : "等待 live", tone: "border-[#e3ddcf] bg-[#f3efe7]" },
    { label: "配置源", value: extra, hint: "extra X sources", tone: "border-emerald-200 bg-emerald-50" },
    { label: "启用源", value: enabled, hint: "cost gated", tone: "border-amber-200 bg-amber-50" },
  ];

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.tone}`}>
            <div className="text-xs text-[#6f6b61]">{s.label}</div>
            <div className="mt-1 text-3xl font-bold text-[#16140f]">
              {s.value}
            </div>
            <div className="mt-1 text-[11px] text-[#8c887e]">{s.hint}</div>
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* Alpha 分类 */}
        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
            V0 Scaffold
          </div>
          <h2 className="mt-1 text-base font-semibold text-[#16140f]">
            Serenity Alpha 分类
          </h2>
          <p className="mt-1 text-xs text-[#8c887e]">
            按多源 stance 共识给股票分层；当前只有主源启用，unique 表示暂时只有该源覆盖。
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-[#ece8dd] pt-4">
            <span className="font-mono text-sm text-[#3a352d]">unique</span>
            <span className="text-sm font-bold text-[#16140f]">{coverage}</span>
          </div>
        </section>

        {/* 信号源 */}
        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
            Configured
          </div>
          <h2 className="mt-1 text-base font-semibold text-[#16140f]">信号源</h2>
          <p className="mt-1 text-xs text-[#8c887e]">
            列出已配置的外部观察源；disabled 表示为控制成本暂未抓取，enabled 后才会进入共识计算。
          </p>
          <ul className="mt-4 divide-y divide-slate-100">
            {sources.map((s) => (
              <li
                key={s.handle}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#16140f]">
                    {s.name}
                  </div>
                  <div className="truncate font-mono text-xs text-[#8c887e]">
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
    <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
      <p className="text-sm text-[#6f6b61]">该博主的关注主题：</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.focusTags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-[#ece8dd] px-3 py-1.5 text-sm text-[#3a352d]"
          >
            {t}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-[#8c887e]">
        细分行业分布需要按标的所属行业的结构化数据，可在数据中新增 sector
        字段后扩展。
      </p>
    </section>
  );
}

function FollowView({ data }: { data: BloggerData }) {
  void data; // 本页只展示作者本人（David 小鱼 / Claworld）
  const rowCls =
    "inline-flex items-center justify-between gap-2 rounded-xl border border-[#e3ddcf] px-4 py-2.5 text-sm font-medium text-[#3a352d] transition hover:bg-[#f3efe7]";
  const copy = (t: string) => navigator.clipboard?.writeText(t);
  const links = [
    {
      name: "财富自由俱乐部",
      desc: "链接全球顶级人脉，享人生自由",
      url: "https://ff-club.vercel.app/",
    },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* 左列：作者 + 小红书 */}
      <div className="grid gap-4 lg:col-span-1">
        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-5 md:p-6">
          <div className="flex items-center gap-4">
            <img
              src={founderPhoto.src}
              alt="David 小鱼"
              className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200"
            />
            <div>
              <div className="text-lg font-semibold text-[#16140f]">David 小鱼</div>
              <div className="text-sm text-[#6f6b61]">Claworld 创始人 · 人类炼化师</div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#4b463d]">用蒸馏改变一切。</p>
          <a
            href="https://x.com/shark1996_"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#16140f] px-4 py-2 text-sm font-medium text-white hover:bg-[#2c2820]"
          >
            在 X 上关注 @Shark1996_ ↗
          </a>
        </section>

        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-5 text-center md:p-6">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
            小红书
          </div>
          <img
            src={xhsCard.src}
            alt="小红书 · David 小鱼 · 小红书号 677131897"
            className="mx-auto mt-3 w-full max-w-[280px] rounded-xl ring-1 ring-slate-200"
          />
          <a
            href="https://xhslink.com/m/6WBQosGc8F6"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs font-medium text-rose-600 hover:underline"
          >
            打开小红书主页 ↗
          </a>
        </section>
      </div>

      {/* 右列：站外导航 + 联系方式 + 更新公告 */}
      <div className="grid gap-4 lg:col-span-2">
        {links.length > 0 && (
          <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-5 md:p-6">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
              LINKS
            </div>
            <h2 className="mt-1 text-base font-semibold text-[#16140f]">站外导航</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block rounded-xl border border-[#e3ddcf] p-4 transition hover:bg-[#f3efe7]"
                >
                  <div className="text-sm font-semibold text-[#16140f]">{l.name}</div>
                  <div className="mt-0.5 text-xs text-[#6f6b61]">{l.desc}</div>
                  <div className="mt-2 text-xs font-medium text-[#cf3019]">
                    {l.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </div>
                  <span className="absolute right-3 top-3 text-[#b8b2a4]">↗</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-5 md:p-6">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
            CONTACT
          </div>
          <h2 className="mt-1 text-base font-semibold text-[#16140f]">联系方式</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a href="https://x.com/shark1996_" target="_blank" rel="noreferrer" className={rowCls}>
              <span>X · @Shark1996_</span>
              <span className="text-[#8c887e]">↗</span>
            </a>
            <a
              href="https://www.youtube.com/@Singularity2026"
              target="_blank"
              rel="noreferrer"
              className={rowCls}
            >
              <span>YouTube · @Singularity2026</span>
              <span className="text-[#8c887e]">↗</span>
            </a>
            <a
              href="https://xhslink.com/m/6WBQosGc8F6"
              target="_blank"
              rel="noreferrer"
              className={rowCls}
            >
              <span>小红书 · David小鱼</span>
              <span className="text-[#8c887e]">↗</span>
            </a>
            <button
              type="button"
              title="点击复制小红书号"
              onClick={() => copy("677131897")}
              className={rowCls}
            >
              <span>小红书号 · 677131897</span>
              <span className="text-[#8c887e]">⧉ 复制</span>
            </button>
            <button
              type="button"
              title="点击复制微信号"
              onClick={() => copy("dragon-yu-171728")}
              className={rowCls}
            >
              <span>微信 · dragon-yu-171728</span>
              <span className="text-[#8c887e]">⧉ 复制</span>
            </button>
            <button
              type="button"
              title="点击复制公众号名"
              onClick={() => copy("自家的鱼鱼")}
              className={rowCls}
            >
              <span>公众号 · 自家的鱼鱼 / Claworld</span>
              <span className="text-[#8c887e]">⧉ 复制</span>
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-5 md:p-6">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
            UPDATES
          </div>
          <h2 className="mt-1 text-base font-semibold text-[#16140f]">更新公告</h2>
          <div className="mt-3 rounded-xl bg-[#f3efe7] p-4">
            <div className="text-sm font-semibold text-[#2a261f]">反馈与沟通</div>
            <p className="mt-1 text-sm leading-relaxed text-[#4b463d]">
              X 用于即时沟通与反馈；小红书用于 Claworld 投研终端的教程、案例与中文沟通入口。
              有功能建议或问题，欢迎在 X 留言或小红书私信。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="https://xhslink.com/m/6WBQosGc8F6"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#e3ddcf] px-3 py-1.5 text-xs font-medium text-[#3a352d] hover:bg-[#fffefb]"
              >
                关注小红书
              </a>
              <a
                href="https://x.com/shark1996_"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#e3ddcf] px-3 py-1.5 text-xs font-medium text-[#3a352d] hover:bg-[#fffefb]"
              >
                X 留言
              </a>
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <div className="shrink-0 font-mono text-xs text-[#8c887e]">2026-06-08</div>
            <div>
              <div className="text-sm font-semibold text-[#2a261f]">
                实时推文 + A股喊单 + 中英双语
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[#4b463d]">
                推文页接入实时更新；博主点名 A股/美股时红色置顶提示并推飞书；每条推文附中英双语与财经解读。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
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
    { label: "节点", value: sc.nodes, hint: sc.asOf || sc.hopLabel, tone: "bg-[#f3efe7]" },
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
        <div className="mb-3 rounded-xl border border-dashed border-[#cfc7b6] bg-[#fffefb] px-4 py-2.5 text-[11px] leading-relaxed text-[#6f6b61]">
          该博主未采用供应链研究方式。以下为根据其<strong>提及标的</strong>
          在共享供应链参考图谱上自动推导的关联视图（仅供参考）。
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl border border-[#e3ddcf] p-4 ${s.tone}`}>
            <div className="text-xs text-[#6f6b61]">{s.label}</div>
            <div className="mt-1 text-3xl font-bold text-[#16140f]">
              {s.value}
            </div>
            {s.hint && (
              <div className="mt-1 text-[11px] text-[#8c887e]">{s.hint}</div>
            )}
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {/* 角色分层 */}
        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
            Supply-Chain
          </div>
          <h2 className="mt-1 text-base font-semibold text-[#16140f]">
            角色分层
          </h2>
          <p className="mt-1 text-xs text-[#8c887e]">
            按供应链角色展示当前图谱覆盖的公司；节点只代表结构关系，不代表当前观点或仓位。
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {sc.roles.map((r) => (
              <div key={r.role}>
                <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
                  {r.role}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.tickers.map((t) => (
                    <span
                      key={t}
                      className="rounded border border-[#e3ddcf] bg-[#f3efe7] px-2 py-0.5 font-mono text-xs text-[#3a352d]"
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
        <section className="rounded-2xl border border-[#e3ddcf] bg-[#fffefb] p-4 md:p-5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-[#8c887e]">
            Passive Catalysts
          </div>
          <h2 className="mt-1 text-base font-semibold text-[#16140f]">
            传导提示
          </h2>
          <p className="mt-1 text-xs text-[#8c887e]">
            从近期高优先级事件出发，沿供应链边传导后的二阶观察清单；分数是衰减后的优先级，不是涨跌预测。
          </p>
          {sc.catalysts.length === 0 ? (
            <p className="mt-4 text-sm text-[#8c887e]">
              当前没有触发供应链传导的高优先级事件。
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {sc.catalysts.map((c, i) => (
                <li key={i} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-bold text-[#16140f]">
                      {c.target}
                    </span>
                    <span className="text-sm font-semibold text-[#6f6b61]">
                      {c.score}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-[#8c887e]">
                    {c.path}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[#4b463d]">
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
    <section className="rounded-2xl border border-dashed border-[#cfc7b6] bg-[#fffefb] p-10 text-center">
      <div className="text-sm font-semibold text-[#3a352d]">{title}</div>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-[#8c887e]">
        {note}
      </p>
    </section>
  );
}
