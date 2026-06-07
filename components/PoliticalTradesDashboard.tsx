"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  clueMiningLenses,
  cluePipelineSteps,
  holdingClues,
  policyCatalysts,
  politicianRadar,
  rawResearchEntries,
  reportMeta,
  watchIdeas,
} from "@/data/politicalTrades";

type Lang = "zh" | "en";
type PageKey = "trades" | "politicians" | "issuers" | "states" | "case";

const ACCESS_KEY = "serenity-political-trades-access";
const FOUNDER_CODE = "SERENITY-FOUNDER";

function monthlyInviteCode(date = new Date()) {
  return currentMonthLabel(date);
}

function monthlyInviteAlias(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `SA-${year}-${month}`;
}

function currentMonthLabel(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

const pageAnalysis: Record<
  PageKey,
  {
    zh: { label: string; title: string; contains: string[]; aiUse: string[]; filters: string[] };
    en: { label: string; title: string; contains: string[]; aiUse: string[]; filters: string[] };
  }
> = {
  trades: {
    zh: {
      label: "交易流",
      title: "CapitolTrades /trades 页面有什么信息",
      contains: [
        "逐笔披露：政客、标的、发布时间、交易日、披露滞后、owner、交易类型、金额区间、价格",
        "筛选器：Committee、Party、Chamber、State、Asset Type、Transaction Type、Trade Size、Market Cap、Sector",
        "最适合发现最新异常交易，但噪音最大",
      ],
      aiUse: [
        "先按金额和披露日期筛大单，再按政客和主题聚类",
        "区分 buy、sell、exchange、RSU、配偶和共同账户，避免误读",
        "把单笔交易压缩成线索：谁、买什么主题、金额强度、是否值得核验",
      ],
      filters: ["Trade size >= 50K", "Party = Republican", "Type = Purchase / Exchange", "Filed after <= 30d"],
    },
    en: {
      label: "Trades",
      title: "What the CapitolTrades /trades page contains",
      contains: [
        "Trade rows: politician, issuer, publication date, trade date, filing lag, owner, type, size range, price",
        "Filters: committee, party, chamber, state, asset type, transaction type, trade size, market cap, sector",
        "Best for fresh anomalies, but also the noisiest surface",
      ],
      aiUse: [
        "Rank by size and filing date, then cluster by politician and theme",
        "Separate buys, sells, exchanges, RSUs, spouse and joint-account activity",
        "Turn rows into clues: who traded, what theme, how strong, what needs verification",
      ],
      filters: ["Trade size >= 50K", "Party = Republican", "Type = Purchase / Exchange", "Filed after <= 30d"],
    },
  },
  politicians: {
    zh: {
      label: "政客",
      title: "Politicians 页面有什么信息",
      contains: [
        "按政客聚合：交易数、交易额、发行人数、最新披露、党派、州、参众院",
        "适合先找高资金、知名、政策相关的人，再回交易流拆持仓",
        "比交易流更适合作为研报入口",
      ],
      aiUse: [
        "给政客打权重：资金体量、委员会暴露、州产业、Trump 生态相关度",
        "识别持仓风格：能源、国防、AI、医保、债券和现金管理",
        "追踪同一政客的主题迁移，而非只看单只股票",
      ],
      filters: ["Party = Republican", "Volume desc", "Recent trades", "State / Committee relevance"],
    },
    en: {
      label: "Politicians",
      title: "What the Politicians page contains",
      contains: [
        "Aggregates by politician: trade count, volume, issuers, latest trade, party, state, chamber",
        "Best starting point for high-capital and policy-relevant actors",
        "More useful than raw rows for research intake",
      ],
      aiUse: [
        "Score politicians by volume, committee exposure, state industry and Trump-ecosystem relevance",
        "Identify holding styles: energy, defense, AI, healthcare, bonds and cash management",
        "Track thematic migration by politician, not just single-stock rows",
      ],
      filters: ["Party = Republican", "Volume desc", "Recent trades", "State / Committee relevance"],
    },
  },
  issuers: {
    zh: {
      label: "发行人",
      title: "Issuer 页面有什么信息",
      contains: [
        "按股票聚合：近三年交易、党派买卖比例、政客数量、交易额、最新披露",
        "适合判断一个标的是否有跨政客、跨党派、重复交易",
        "能把单个主题从新闻事件拉回披露证据",
      ],
      aiUse: [
        "比较共和党和民主党的买卖方向是否一致或分歧",
        "找多个政客同时出现的拥挤主题",
        "把标的页作为交易线索的二次验证，不作为唯一入口",
      ],
      filters: ["Ticker / Issuer", "3Y trades", "Party split", "Recent filings"],
    },
    en: {
      label: "Issuers",
      title: "What Issuer pages contain",
      contains: [
        "Aggregates by ticker: 3Y trades, party buy/sell split, politician count, volume, latest filings",
        "Useful for cross-politician and cross-party repetition",
        "Connects a news theme back to disclosure evidence",
      ],
      aiUse: [
        "Compare Republican and Democrat directionality",
        "Find crowded themes across multiple politicians",
        "Use issuer pages as secondary validation rather than the only starting point",
      ],
      filters: ["Ticker / Issuer", "3Y trades", "Party split", "Recent filings"],
    },
  },
  states: {
    zh: {
      label: "州/地区",
      title: "State 页面有什么信息",
      contains: [
        "按州聚合政客交易，适合能源州、边境州、科技州、医保和军工州主题挖掘",
        "能把州产业结构和政客持仓联系起来",
        "适合找地方政策、地方产业链和全国政策之间的交叉点",
      ],
      aiUse: [
        "按州产业给交易线索加背景权重",
        "筛德州能源、佛州医保和拉美、加州科技、俄克拉荷马能源等主题",
        "把州页作为找人和找主题的辅助入口",
      ],
      filters: ["State", "Party", "Sector", "Trade size"],
    },
    en: {
      label: "States",
      title: "What State pages contain",
      contains: [
        "Aggregates activity by state, useful for energy, border, tech, healthcare and defense states",
        "Links state industrial structure with politician holdings",
        "Good for finding intersections between local and national policy",
      ],
      aiUse: [
        "Add state-industry context to trade clues",
        "Screen themes such as Texas energy, Florida healthcare, California tech, Oklahoma energy",
        "Use state pages as a supporting entry point for people and themes",
      ],
      filters: ["State", "Party", "Sector", "Trade size"],
    },
  },
  case: {
    zh: {
      label: "案例拆解",
      title: "三大运营商案例页面有什么信息",
      contains: [
        "方法样本：新闻事件、发行人页、近期交易、党派方向、金额强弱",
        "用于展示如何从事件回查交易，不把运营商作为主线",
        "可替换成能源、国防、AI、医保等任意主题",
      ],
      aiUse: [
        "先确认事件，再查交易，再看金额和党派方向",
        "把不一致信号写出来，比如某标的共和党线索是卖出而非买入",
        "产出下一步监控条件，而非直接下投资结论",
      ],
      filters: ["Theme event", "Issuer pages", "Recent filings", "Party direction"],
    },
    en: {
      label: "Case study",
      title: "What case-study pages contain",
      contains: [
        "A method sample: news event, issuer page, recent trades, party direction and size strength",
        "Shows how to trace an event back to filings, not a telecom-first thesis",
        "Can be swapped for energy, defense, AI or healthcare themes",
      ],
      aiUse: [
        "Confirm the event, inspect filings, then score size and party direction",
        "Surface contradictions, such as a party clue being a sell rather than a buy",
        "Output monitoring conditions rather than a direct investment call",
      ],
      filters: ["Theme event", "Issuer pages", "Recent filings", "Party direction"],
    },
  },
};

const copy = {
  zh: {
    back: "返回主站",
    source: "英文原站",
    member: "会员解析",
    lang: "EN",
    eyebrow: "MEMBERS ONLY / POLITICAL TRADES",
    title: "政客交易解析",
    deck: "原始披露负责证据，AI 负责把噪音压缩成可读线索。",
    heroText:
      "这个页面独立于主站投研看板。公开区跳转 CapitolTrades 英文原站；会员区用邀请码解锁 AI 解析，重点挖高资金、共和党、知名政客和 Trump 生态相关持仓线索。",
    month: "本月邀请码",
    locked: "未解锁",
    unlocked: "已解锁",
    publicTitle: "1. 原英文网站",
    publicText: "保留原站入口，用户可以直接核验披露字段、页面筛选和发行人页。",
    privateTitle: "2. AI 解析会员区",
    privateText: "输入当月邀请码后查看 AI 压缩版：资金优先、政客优先、主题优先。",
    codePlaceholder: "输入邀请码",
    unlock: "解锁 AI 解析",
    invalid: "邀请码无效或已过期",
    expires: "每月更新",
    pageMenu: "页面解析",
    contains: "页面有什么",
    aiUse: "AI 怎么用",
    tableTitle: "高资金持仓线索",
    tableMeta: "按金额、党派、主题和可核验性排序",
    all: "全部",
    gop: "共和党",
    dem: "民主党",
    politician: "政客",
    issuer: "交易标的",
    published: "发布",
    traded: "交易日",
    filed: "滞后",
    owner: "Owner",
    type: "类型",
    size: "金额",
    price: "价格",
    signal: "AI 信号",
    radar: "政客资金雷达",
    process: "线索处理流程",
    score: "评分框架",
    caseTitle: "事件拆解样本",
    watch: "主题观察池",
    subscription: "订阅制实现路径",
    subscriptionText:
      "当前是前端邀请码原型。上线订阅制建议用后端校验邀请码、Stripe 管理订阅、数据库记录有效期和席位。",
  },
  en: {
    back: "Back",
    source: "Original Site",
    member: "AI Desk",
    lang: "中文",
    eyebrow: "MEMBERS ONLY / POLITICAL TRADES",
    title: "Political Trade Intelligence",
    deck: "Raw filings provide evidence. AI compresses the noise into research clues.",
    heroText:
      "This is a standalone member page. Public links open CapitolTrades for verification; the invite-only AI desk ranks high-capital, Republican, recognizable and Trump-ecosystem trading clues.",
    month: "Monthly invite",
    locked: "Locked",
    unlocked: "Unlocked",
    publicTitle: "1. Original English Site",
    publicText: "Keep the source layer intact so users can verify filing fields, filters and issuer pages.",
    privateTitle: "2. AI Analysis Desk",
    privateText: "Enter the monthly invite code to unlock AI-compressed clues by capital, politician and theme.",
    codePlaceholder: "Invite code",
    unlock: "Unlock AI desk",
    invalid: "Invalid or expired invite code",
    expires: "Rotates monthly",
    pageMenu: "Page Analysis",
    contains: "What it contains",
    aiUse: "How AI uses it",
    tableTitle: "High-Capital Holding Clues",
    tableMeta: "Ranked by size, party, theme and verifiability",
    all: "All",
    gop: "GOP",
    dem: "Dem",
    politician: "Politician",
    issuer: "Issuer",
    published: "Published",
    traded: "Traded",
    filed: "Lag",
    owner: "Owner",
    type: "Type",
    size: "Size",
    price: "Price",
    signal: "AI Signal",
    radar: "Politician Capital Radar",
    process: "Clue Workflow",
    score: "Scoring Framework",
    caseTitle: "Event Case Sample",
    watch: "Theme Watchlist",
    subscription: "Subscription Path",
    subscriptionText:
      "This is a frontend invite prototype. Production should verify codes server-side, use Stripe for subscription state, and store expiry plus seats in a database.",
  },
} satisfies Record<Lang, Record<string, string>>;

const partyClass = {
  R: "border-amber-400/30 bg-amber-300/10 text-amber-200",
  D: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  O: "border-zinc-500 bg-zinc-800 text-zinc-300",
};

const typeClass = {
  buy: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  sell: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  mixed: "border-amber-400/30 bg-amber-300/10 text-amber-200",
  watch: "border-zinc-500 bg-zinc-800 text-zinc-300",
  exchange: "border-violet-400/30 bg-violet-400/10 text-violet-200",
};

export default function PoliticalTradesDashboard() {
  const [lang, setLang] = useState<Lang>("zh");
  const [page, setPage] = useState<PageKey>("trades");
  const [partyFilter, setPartyFilter] = useState<"all" | "R" | "D">("all");
  const [code, setCode] = useState("");
  const [access, setAccess] = useState(false);
  const [error, setError] = useState("");
  const t = copy[lang];
  const active = pageAnalysis[page][lang];
  const activeMonth = currentMonthLabel();
  const activeInvite = monthlyInviteCode();
  const activeInviteAlias = monthlyInviteAlias();

  useEffect(() => {
    const saved = window.localStorage.getItem(ACCESS_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as { month?: string; ok?: boolean };
      setAccess(Boolean(parsed.ok && parsed.month === currentMonthLabel()));
    } catch {
      window.localStorage.removeItem(ACCESS_KEY);
    }
  }, []);

  const rows = useMemo(() => {
    return holdingClues.filter((row) => partyFilter === "all" || row.party === partyFilter);
  }, [partyFilter]);

  const handleUnlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = normalizeCode(code);
    const allowed =
      normalized === activeInvite ||
      normalized === activeInviteAlias ||
      normalized === FOUNDER_CODE;
    if (!allowed) {
      setError(t.invalid);
      return;
    }

    window.localStorage.setItem(
      ACCESS_KEY,
      JSON.stringify({ ok: true, month: activeMonth, code: normalized }),
    );
    setAccess(true);
    setError("");
  };

  return (
    <div className="min-h-screen bg-[#070605] text-stone-100">
      <header className="sticky top-0 z-40 border-b border-amber-200/10 bg-[#070605]/92 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <a href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-300/30 bg-amber-200/10 font-mono text-xs font-semibold text-amber-200">
              SA
            </span>
            <span className="grid min-w-0">
              <span className="truncate text-sm font-semibold text-amber-100">Serenity Analysis</span>
              <span className="truncate text-xs text-stone-500">Political Trades Intelligence</span>
            </span>
          </a>

          <nav className="hidden items-center gap-2 md:flex">
            <a className="rounded-full px-3 py-1.5 text-sm text-stone-400 transition hover:bg-stone-900 hover:text-amber-100" href="/">
              {t.back}
            </a>
            <a
              className="rounded-full px-3 py-1.5 text-sm text-stone-400 transition hover:bg-stone-900 hover:text-amber-100"
              href="#original"
            >
              {t.source}
            </a>
            <a
              className="rounded-full px-3 py-1.5 text-sm text-stone-400 transition hover:bg-stone-900 hover:text-amber-100"
              href="#ai-desk"
            >
              {t.member}
            </a>
          </nav>

          <button
            type="button"
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            className="rounded-full border border-amber-300/20 px-3 py-1.5 text-sm text-amber-100 transition hover:bg-amber-200/10"
          >
            {t.lang}
          </button>
        </div>
      </header>

      <main>
        <section className="border-b border-amber-200/10 px-4 py-10 md:py-14">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <div className="text-xs font-semibold uppercase text-amber-300/80">
                {t.eyebrow}
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold text-amber-50 md:text-6xl">
                {t.title}
              </h1>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-stone-300">
                {t.deck}
              </p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-stone-500">
                {t.heroText}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#original"
                  className="rounded-full bg-amber-200 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-100"
                >
                  {t.source}
                </a>
                <a
                  href="#ai-desk"
                  className="rounded-full border border-amber-300/30 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/10"
                >
                  {t.member}
                </a>
              </div>
            </div>

            <div className="border border-amber-300/15 bg-[#0d0b08] p-4 shadow-2xl shadow-black/40">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Metric label="Source" value="CapitolTrades" />
                <Metric label="Rows" value={`${holdingClues.length}`} />
                <Metric label="Mode" value={access ? t.unlocked : t.locked} />
              </div>
              <div className="mt-4 border border-amber-300/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3 border-b border-amber-300/10 pb-3">
                  <span className="text-xs uppercase text-stone-500">{t.month}</span>
                  <span className="font-mono text-xs text-amber-200">{activeMonth}</span>
                </div>
                <div className="mt-4 grid gap-2">
                  {holdingClues.slice(0, 4).map((row) => (
                    <div key={`${row.politician}-${row.ticker}`} className="grid grid-cols-[1fr_auto] gap-3 border-b border-stone-800 pb-2 last:border-b-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-amber-50">{row.politician}</div>
                        <div className="truncate text-xs text-stone-500">{row.theme}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xs text-amber-200">{row.size}</div>
                        <div className="font-mono text-xs text-stone-500">{row.aiScore}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="original" className="px-4 py-10">
          <div className="mx-auto max-w-7xl">
            <SectionKicker label={t.publicTitle} value={t.publicText} />
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {rawResearchEntries.slice(0, 4).map((entry) => (
                <a
                  key={entry.url}
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-amber-300/15 bg-[#0d0b08] p-4 transition hover:border-amber-300/40 hover:bg-[#151107]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-amber-50">{entry.label}</div>
                    <span className="font-mono text-xs text-amber-300">OPEN</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-500">{entry.description}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="ai-desk" className="border-y border-amber-200/10 bg-[#0b0906] px-4 py-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
              <div>
                <SectionKicker label={t.privateTitle} value={t.privateText} />
                <div className="mt-5 border border-amber-300/15 bg-black/25 p-4">
                  <form onSubmit={handleUnlock} className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-amber-50">
                        {access ? t.unlocked : t.locked}
                      </span>
                      <span className="font-mono text-xs text-stone-500">{t.expires}</span>
                    </div>
                    <input
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder={t.codePlaceholder}
                      className="h-11 border border-amber-300/20 bg-[#070605] px-3 font-mono text-sm text-amber-50 outline-none placeholder:text-stone-600 focus:border-amber-300/70"
                    />
                    <button
                      type="submit"
                      className="h-11 bg-amber-200 px-4 text-sm font-semibold text-black transition hover:bg-amber-100"
                    >
                      {t.unlock}
                    </button>
                    {error && <div className="text-sm text-rose-300">{error}</div>}
                  </form>
                </div>

                <div className="mt-5 border border-amber-300/15 bg-black/20 p-4">
                  <h2 className="text-base font-semibold text-amber-50">{t.subscription}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-500">{t.subscriptionText}</p>
                </div>
              </div>

              <div>
                {access ? (
                  <MemberDesk
                    lang={lang}
                    page={page}
                    setPage={setPage}
                    active={active}
                    partyFilter={partyFilter}
                    setPartyFilter={setPartyFilter}
                    rows={rows}
                    t={t}
                  />
                ) : (
                  <LockedPreview t={t} />
                )}
              </div>
            </div>
          </div>
        </section>

        {access && (
          <>
            <section className="px-4 py-10">
              <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <ResearchBlock title={t.radar} eyebrow="Politician Radar">
                  <div className="grid gap-3 md:grid-cols-2">
                    {politicianRadar.map((person) => (
                      <article key={person.name} className="border border-amber-300/15 bg-[#0d0b08] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`border px-2 py-1 font-mono text-xs ${partyClass[person.party]}`}>
                                {person.party}
                              </span>
                              <a
                                href={person.source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate font-semibold text-amber-50 hover:text-amber-200"
                              >
                                {person.name}
                              </a>
                            </div>
                            <div className="mt-2 text-xs text-stone-500">
                              {person.chamber} / {person.state} / {person.ecosystem}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase text-stone-600">Volume</div>
                            <div className="font-mono text-sm text-amber-200">{person.volume}</div>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-stone-400">{person.read}</p>
                      </article>
                    ))}
                  </div>
                </ResearchBlock>

                <ResearchBlock title={t.process} eyebrow="Workflow">
                  <div className="grid gap-3">
                    {cluePipelineSteps.map((step) => (
                      <div key={step.step} className="grid grid-cols-[auto_1fr] gap-3 border-b border-stone-800 pb-3 last:border-b-0 last:pb-0">
                        <span className="flex h-8 w-8 items-center justify-center bg-amber-200 font-mono text-xs font-semibold text-black">
                          {step.step}
                        </span>
                        <div>
                          <div className="font-semibold text-amber-50">{step.title}</div>
                          <p className="mt-1 text-sm leading-6 text-stone-500">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ResearchBlock>
              </div>
            </section>

            <section className="border-t border-amber-200/10 px-4 py-10">
              <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <ResearchBlock title={t.score} eyebrow="AI Framework">
                  <div className="grid gap-3 md:grid-cols-2">
                    {clueMiningLenses.map((lens) => (
                      <article key={lens.label} className="border border-amber-300/15 bg-[#0d0b08] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-amber-50">{lens.label}</div>
                          <div className="font-mono text-xs text-amber-200">{lens.score}</div>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-stone-500">{lens.description}</p>
                      </article>
                    ))}
                  </div>
                </ResearchBlock>

                <ResearchBlock title={t.caseTitle} eyebrow="Event Sample">
                  <div className="grid gap-3">
                    {policyCatalysts.map((item) => (
                      <article key={item.title} className="border-b border-stone-800 pb-3 last:border-b-0 last:pb-0">
                        <div className="font-mono text-xs text-stone-600">{item.date}</div>
                        <a
                          href={item.source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block font-semibold text-amber-50 hover:text-amber-200"
                        >
                          {item.title}
                        </a>
                        <p className="mt-2 text-sm leading-6 text-stone-500">{item.read}</p>
                      </article>
                    ))}
                  </div>
                </ResearchBlock>
              </div>
            </section>

            <section className="border-t border-amber-200/10 px-4 py-10">
              <div className="mx-auto max-w-7xl">
                <SectionKicker label={t.watch} value="From politician holdings to theme monitoring" />
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {watchIdeas.map((idea) => (
                    <article key={idea.ticker} className="border border-amber-300/15 bg-[#0d0b08] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-lg font-semibold text-amber-50">{idea.ticker}</div>
                          <div className="text-sm text-stone-500">{idea.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm text-amber-200">{idea.price}</div>
                          <div className={idea.change.startsWith("-") ? "text-xs text-rose-300" : "text-xs text-emerald-300"}>
                            {idea.change}
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-stone-500">{idea.why}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MemberDesk({
  lang,
  page,
  setPage,
  active,
  partyFilter,
  setPartyFilter,
  rows,
  t,
}: {
  lang: Lang;
  page: PageKey;
  setPage: (page: PageKey) => void;
  active: (typeof pageAnalysis)[PageKey][Lang];
  partyFilter: "all" | "R" | "D";
  setPartyFilter: (party: "all" | "R" | "D") => void;
  rows: typeof holdingClues;
  t: (typeof copy)[Lang];
}) {
  return (
    <div className="grid gap-4">
      <div className="border border-amber-300/15 bg-[#0d0b08] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionKicker label={t.pageMenu} value={active.title} compact />
          <select
            value={page}
            onChange={(event) => setPage(event.target.value as PageKey)}
            className="h-10 border border-amber-300/20 bg-[#070605] px-3 text-sm text-amber-50 outline-none focus:border-amber-300/70"
          >
            {(Object.keys(pageAnalysis) as PageKey[]).map((key) => (
              <option key={key} value={key}>
                {pageAnalysis[key][lang].label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <AnalysisList title={t.contains} items={active.contains} />
          <AnalysisList title={t.aiUse} items={active.aiUse} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {active.filters.map((filter) => (
            <span key={filter} className="border border-amber-300/15 px-2.5 py-1 text-xs text-stone-400">
              {filter}
            </span>
          ))}
        </div>
      </div>

      <div className="border border-amber-300/15 bg-[#0d0b08]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300/10 p-4">
          <SectionKicker label={t.tableTitle} value={t.tableMeta} compact />
          <div className="flex border border-amber-300/15 bg-black/20 p-1 text-xs">
            {[
              { key: "all", label: t.all },
              { key: "R", label: t.gop },
              { key: "D", label: t.dem },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPartyFilter(item.key as "all" | "R" | "D")}
                className={`px-3 py-1.5 transition ${
                  partyFilter === item.key
                    ? "bg-amber-200 text-black"
                    : "text-stone-500 hover:text-amber-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-amber-300/10 text-[11px] uppercase text-stone-600">
              <tr>
                <th className="px-4 py-3 font-medium">{t.politician}</th>
                <th className="px-4 py-3 font-medium">{t.issuer}</th>
                <th className="px-4 py-3 font-medium">{t.published}</th>
                <th className="px-4 py-3 font-medium">{t.traded}</th>
                <th className="px-4 py-3 font-medium">{t.filed}</th>
                <th className="px-4 py-3 font-medium">{t.owner}</th>
                <th className="px-4 py-3 font-medium">{t.type}</th>
                <th className="px-4 py-3 font-medium">{t.size}</th>
                <th className="px-4 py-3 font-medium">{t.price}</th>
                <th className="px-4 py-3 font-medium">{t.signal}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-900">
              {rows.map((row) => (
                <tr key={`${row.politician}-${row.ticker}-${row.published}`} className="hover:bg-amber-200/[0.03]">
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start gap-3">
                      <span className={`border px-2 py-1 font-mono text-xs ${partyClass[row.party]}`}>
                        {row.party}
                      </span>
                      <div>
                        <a
                          href={row.source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-amber-50 hover:text-amber-200"
                        >
                          {row.politician}
                        </a>
                        <div className="text-xs text-stone-600">
                          {row.chamber} / {row.state}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-mono text-xs font-semibold text-amber-100">{row.ticker}</div>
                    <div className="mt-0.5 max-w-[220px] text-xs text-stone-500">{row.issuer}</div>
                    <div className="mt-1 text-[11px] text-stone-600">{row.theme}</div>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-stone-400">{row.published}</td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-stone-400">{row.traded}</td>
                  <td className="px-4 py-3 align-top">
                    <span className="border border-amber-300/15 px-2 py-1 font-mono text-xs text-stone-400">
                      {row.filedAfter}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-stone-500">{row.owner}</td>
                  <td className="px-4 py-3 align-top">
                    <span className={`border px-2.5 py-1 text-xs font-medium uppercase ${typeClass[row.type]}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs font-semibold text-amber-100">{row.size}</td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-stone-500">{row.price}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-16 overflow-hidden bg-stone-900">
                        <div className="h-full bg-amber-200" style={{ width: `${row.aiScore}%` }} />
                      </div>
                      <span className="font-mono text-xs font-semibold text-amber-100">{row.aiScore}</span>
                    </div>
                    <p className="mt-2 max-w-[280px] text-xs leading-5 text-stone-500">{row.aiRead}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LockedPreview({ t }: { t: (typeof copy)[Lang] }) {
  return (
    <div className="relative min-h-[620px] overflow-hidden border border-amber-300/15 bg-[#0d0b08]">
      <div className="absolute inset-0 z-10 grid place-items-center bg-black/65 px-6 text-center backdrop-blur-sm">
        <div className="max-w-md">
          <div className="text-xs font-semibold uppercase text-amber-300/80">Invite Required</div>
          <h2 className="mt-3 text-2xl font-semibold text-amber-50">{t.privateTitle}</h2>
          <p className="mt-3 text-sm leading-6 text-stone-400">{t.privateText}</p>
        </div>
      </div>
      <div className="p-4 opacity-35">
        <div className="mb-4 h-16 border border-amber-300/15 bg-black/25" />
        {Array.from({ length: 9 }).map((_, index) => (
          <div key={index} className="grid grid-cols-[1fr_0.8fr_0.6fr] gap-3 border-b border-stone-900 py-4">
            <div className="h-4 bg-stone-800" />
            <div className="h-4 bg-stone-800" />
            <div className="h-4 bg-amber-300/20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-amber-300/10 bg-black/25 p-3">
      <div className="text-[10px] uppercase text-stone-600">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold text-amber-100">{value}</div>
    </div>
  );
}

function SectionKicker({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-amber-300/80">{label}</div>
      <p className={`${compact ? "mt-1 text-sm" : "mt-2 max-w-3xl text-sm"} leading-6 text-stone-500`}>
        {value}
      </p>
    </div>
  );
}

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-sm font-semibold text-amber-50">{title}</div>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-stone-500">
        {items.map((item) => (
          <li key={item} className="grid grid-cols-[auto_1fr] gap-2">
            <span className="mt-2 h-1.5 w-1.5 bg-amber-300/70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResearchBlock({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4">
        <div className="text-xs font-semibold uppercase text-amber-300/80">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold text-amber-50">{title}</h2>
        <div className="mt-1 text-xs text-stone-600">{reportMeta.asOf}</div>
      </div>
      {children}
    </section>
  );
}
