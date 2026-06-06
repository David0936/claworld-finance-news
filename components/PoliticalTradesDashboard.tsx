import {
  actionChecklist,
  aiResearchLayers,
  clueMiningLenses,
  cluePipelineSteps,
  policyCatalysts,
  politicianRadar,
  rawResearchEntries,
  reportMeta,
  telecomIssuers,
  telecomTradeEvents,
  thesisBullets,
  watchIdeas,
} from "@/data/politicalTrades";

const sideClass = {
  buy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sell: "border-rose-200 bg-rose-50 text-rose-700",
  mixed: "border-amber-200 bg-amber-50 text-amber-700",
  watch: "border-sky-200 bg-sky-50 text-sky-700",
};

const signalClass = {
  high: "bg-rose-900 text-white",
  medium: "bg-slate-900 text-white",
  low: "bg-slate-100 text-slate-500",
};

const partyClass = {
  R: "bg-rose-50 text-rose-700 ring-rose-200",
  D: "bg-sky-50 text-sky-700 ring-sky-200",
  O: "bg-slate-50 text-slate-600 ring-slate-200",
};

export default function PoliticalTradesDashboard({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? "grid gap-4" : "min-h-screen bg-slate-50"}>
      {!embedded && (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-shell items-center justify-between gap-4">
            <div className="min-w-0">
              <a
                href="/"
                className="text-xs font-medium uppercase tracking-wide text-slate-400 hover:text-slate-900"
              >
                Serenity Analysis
              </a>
              <div className="truncate text-sm font-semibold text-slate-900">
                {reportMeta.title}
              </div>
            </div>
            <a
              href="#sources"
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              数据源
            </a>
          </div>
        </header>
      )}

      <main
        className={
          embedded
            ? "grid gap-4"
            : "mx-auto grid w-full max-w-shell gap-4 px-3 py-4 sm:px-4 md:py-5 lg:px-6"
        }
      >
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid min-w-0 gap-5 p-4 md:grid-cols-[1.35fr_0.65fr] md:p-6">
            <div className="min-w-0">
              <div className="break-words text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Political Holdings / Clue Mining / Trump Ecosystem
              </div>
              <h1 className="mt-2 max-w-3xl break-words text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
                美国政客持仓线索追踪：从原始披露到 AI 研报
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                {reportMeta.subtitle}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["持仓线索", "高资金优先", "共和党为主", "Trump 生态", "原站核验"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
            </div>
            <div className="grid min-w-0 gap-3 rounded-xl bg-slate-950 p-4 text-white">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  使用方式
                </div>
                <div className="mt-1 text-lg font-semibold">
                  原站看证据，AI 看线索；先从政客和持仓主题挖，不从单一行业出发。
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Metric label="主入口" value="Politicians" dark />
                <Metric label="核心过滤" value="金额 / 重复 / 政策" dark />
                <Metric label="强核验" value="McCaul / AESI" dark />
                <Metric label="数据日" value={reportMeta.asOf} dark />
              </div>
            </div>
          </div>
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500 md:px-6">
            {reportMeta.dataCutoff}
          </div>
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <SectionHead
              eyebrow="Raw Source"
              title="1. 原网站入口"
              meta="把 CapitolTrades 当证据层"
            />
            <p className="mt-3 text-sm leading-6 text-slate-500">
              原站保留完整披露和筛选能力。这里不强行 iframe 嵌入，避免安全检查、跨域限制和加载失败；用深链把用户带到最该看的页面。
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {rawResearchEntries.map((entry) => (
                <a
                  key={entry.url}
                  href={entry.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-slate-950">
                      {entry.label}
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs text-slate-400 ring-1 ring-slate-200 group-hover:text-slate-700">
                      open
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {entry.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <SectionHead
              eyebrow="AI Layer"
              title="2. AI 研报层"
              meta="把大量披露压成可判断信号"
            />
            <div className="mt-4 grid gap-3">
              {aiResearchLayers.map((layer) => (
                <article
                  key={layer.label}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {layer.label}
                    </div>
                    <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                      {layer.value}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {layer.description}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
              推荐阅读路径：先看 AI 页的结论和高优先级名单，再点原站深链核验交易 owner、金额区间、交易类型和披露日期。只有“AI 信号 + 原站核验”都成立，才进入正式研报观点。
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-3">
          {thesisBullets.map((item, index) => (
            <div
              key={item}
              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5"
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-slate-600">{item}</p>
            </div>
          ))}
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <SectionHead
              eyebrow="Clue Mining"
              title="持仓线索挖掘流程"
              meta="先找人，再找主题，再回原站核验"
            />
            <div className="mt-4 grid gap-3">
              {cluePipelineSteps.map((item) => (
                <article
                  key={item.step}
                  className="flex gap-3 rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-900 font-mono text-xs font-semibold text-white">
                    {item.step}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-950">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <SectionHead
              eyebrow="Signal Score"
              title="AI 线索评分框架"
              meta="让小白不用面对原始数据洪水"
            />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {clueMiningLenses.map((lens) => (
                <article
                  key={lens.label}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-950">{lens.label}</div>
                    <div className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600">
                      {lens.score}
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {lens.description}
                  </p>
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                    {lens.example}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
          <SectionHead
            eyebrow="Politician Radar"
            title="高资金共和党 / Trump 生态名单"
            meta="这是主线：先从人挖持仓和主题"
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {politicianRadar.map((person) => (
              <article
                key={person.name}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ring-1 ${partyClass[person.party]}`}
                      >
                        {person.party}
                      </span>
                      <a
                        href={person.source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-lg font-semibold text-slate-950 hover:text-slate-600"
                      >
                        {person.name}
                      </a>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {person.chamber} · {person.state} · {person.ecosystem}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950 px-3 py-2 text-right text-white">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Volume
                    </div>
                    <div className="text-sm font-semibold">{person.volume}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Metric label="Trades" value={person.trades} />
                  <Metric label="Issuers" value={person.issuers} />
                  <Metric label="Last" value={person.lastTraded} compact />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {person.focus.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{person.read}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <SectionHead
              eyebrow="Case Study"
              title="案例：三大运营商事件链怎么拆"
              meta="只是方法示范，不是本页主线"
            />
            <div className="mt-4 grid gap-3">
              {telecomIssuers.map((issuer) => {
                const repTotal = Math.max(1, issuer.republican.trades);
                const demTotal = Math.max(1, issuer.democrat.trades);
                return (
                  <article
                    key={issuer.ticker}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <a
                          href={issuer.source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-lg font-semibold text-slate-950 hover:text-slate-600"
                        >
                          {issuer.ticker}
                        </a>
                        <div className="text-sm text-slate-500">
                          {issuer.company} · {issuer.price} · {issuer.marketCap}
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-100 px-3 py-2 text-right">
                        <div className="text-[11px] text-slate-400">3Y Volume</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {issuer.volume3y}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Metric label="Trades" value={issuer.trades3y.toString()} />
                      <Metric label="Politicians" value={issuer.politicians3y.toString()} />
                      <Metric label="Filings" value={issuer.filings3y.toString()} />
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <PartyBar
                        label="共和党"
                        total={issuer.republican.trades}
                        buy={issuer.republican.buy}
                        sell={issuer.republican.sell}
                        buyPct={(issuer.republican.buy / repTotal) * 100}
                        color="rose"
                      />
                      <PartyBar
                        label="民主党"
                        total={issuer.democrat.trades}
                        buy={issuer.democrat.buy}
                        sell={issuer.democrat.sell}
                        buyPct={(issuer.democrat.buy / demTotal) * 100}
                        color="sky"
                      />
                    </div>
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                      <span className="font-medium text-slate-900">信号：</span>
                      {issuer.latestSignal}
                      <br />
                      <span className="font-medium text-slate-900">解读：</span>
                      {issuer.interpretation}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <SectionHead
              eyebrow="Case Tape"
              title="案例交易拆解"
              meta="示范如何看方向、金额、党派和披露滞后"
            />
            <div className="mt-4 max-w-full overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2 pr-3 font-medium">日期</th>
                    <th className="py-2 pr-3 font-medium">政客</th>
                    <th className="py-2 pr-3 font-medium">标的</th>
                    <th className="py-2 pr-3 font-medium">方向</th>
                    <th className="py-2 pr-3 font-medium">金额</th>
                    <th className="py-2 pr-3 font-medium">信号</th>
                    <th className="py-2 pr-3 font-medium">研判</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {telecomTradeEvents.map((event) => (
                    <tr key={`${event.politician}-${event.ticker}-${event.traded}`}>
                      <td className="py-3 pr-3 align-top">
                        <div className="font-medium text-slate-900">{event.traded}</div>
                        <div className="text-xs text-slate-400">
                          pub {event.published} · {event.filedAfter}
                        </div>
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ring-1 ${partyClass[event.party]}`}
                          >
                            {event.party}
                          </span>
                          <div>
                            <div className="font-medium text-slate-900">
                              {event.politician}
                            </div>
                            <div className="text-xs text-slate-400">
                              {event.chamber} · {event.state}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <a
                          href={event.source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-slate-900 hover:text-slate-600"
                        >
                          {event.ticker}
                        </a>
                        <div className="text-xs text-slate-400">{event.company}</div>
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium uppercase ${sideClass[event.side]}`}
                        >
                          {event.side}
                        </span>
                      </td>
                      <td className="py-3 pr-3 align-top font-mono text-xs text-slate-600">
                        {event.amount}
                      </td>
                      <td className="py-3 pr-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${signalClass[event.signal]}`}
                        >
                          {event.signal}
                        </span>
                      </td>
                      <td className="max-w-xs py-3 pr-3 align-top text-sm leading-6 text-slate-600">
                        {event.read}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <SectionHead
              eyebrow="Case Catalyst"
              title="案例：政策催化如何进入持仓线索"
              meta="三大运营商只是示范样本"
            />
            <div className="mt-4 grid gap-3">
              {policyCatalysts.map((item) => (
                <article
                  key={item.title}
                  className="border-l-2 border-slate-900 pl-4"
                >
                  <div className="text-xs font-medium text-slate-400">
                    {item.date}
                  </div>
                  <a
                    href={item.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-sm font-semibold text-slate-950 hover:text-slate-600"
                  >
                    {item.title}
                  </a>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {item.impact}
                  </p>
                  <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                    {item.read}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tickers.map((ticker) => (
                      <span
                        key={ticker}
                        className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600"
                      >
                        {ticker}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <SectionHead
              eyebrow="Theme Watchlist"
              title="持仓主题观察池"
              meta="由政客线索反推行业和标的"
            />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {watchIdeas.map((idea) => (
                <article
                  key={idea.ticker}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-lg font-semibold text-slate-950">
                        {idea.ticker}
                      </div>
                      <div className="text-sm text-slate-500">{idea.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-slate-900">
                        {idea.price}
                      </div>
                      <div
                        className={
                          idea.change.startsWith("-")
                            ? "text-xs text-rose-600"
                            : "text-xs text-emerald-600"
                        }
                      >
                        {idea.change}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-medium text-slate-700">
                    {idea.role}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    <span className="font-medium text-slate-900">看点：</span>
                    {idea.why}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    <span className="font-medium text-slate-700">风险：</span>
                    {idea.risk}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid min-w-0 gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <SectionHead
              eyebrow="Workflow"
              title="下一步核验清单"
              meta="把巧合筛成可交易信号"
            />
            <ol className="mt-4 grid gap-3">
              {actionChecklist.map((item, index) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div
            id="sources"
            className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 md:p-5"
          >
            <SectionHead
              eyebrow="Sources"
              title="主要来源"
              meta="页面内所有引用均可外跳复核"
            />
            <div className="mt-4 grid gap-2">
              {[
                ...telecomIssuers.map((x) => x.source),
                ...policyCatalysts.map((x) => x.source),
                ...politicianRadar.map((x) => x.source),
              ]
                .filter(
                  (source, index, list) =>
                    list.findIndex((item) => item.url === source.url) === index,
                )
                .map((source) => (
                  <a
                    key={source.url}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span>{source.label}</span>
                    <span className="text-xs text-slate-400">open</span>
                  </a>
                ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="break-words text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {eyebrow}
        </div>
        <h2 className="mt-1 break-words text-base font-semibold text-slate-950">
          {title}
        </h2>
      </div>
      <div className="max-w-full break-words text-xs text-slate-400">{meta}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  dark = false,
  compact = false,
}: {
  label: string;
  value: string;
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={dark ? "rounded-lg bg-white/10 p-3" : "rounded-lg bg-slate-50 p-3"}>
      <div
        className={
          dark
            ? "text-[10px] uppercase tracking-wide text-slate-400"
            : "text-[10px] uppercase tracking-wide text-slate-400"
        }
      >
        {label}
      </div>
      <div
        className={
          dark
            ? "mt-1 break-words text-sm font-semibold text-white"
            : compact
              ? "mt-1 break-words text-xs font-semibold text-slate-900"
              : "mt-1 break-words text-sm font-semibold text-slate-900"
        }
      >
        {value}
      </div>
    </div>
  );
}

function PartyBar({
  label,
  total,
  buy,
  sell,
  buyPct,
  color,
}: {
  label: string;
  total: number;
  buy: number;
  sell: number;
  buyPct: number;
  color: "rose" | "sky";
}) {
  const fill = color === "rose" ? "bg-rose-500" : "bg-sky-500";
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-400">{total} trades</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${buyPct}%` }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px]">
        <span className="text-emerald-600">BUY {buy}</span>
        <span className="text-rose-600">SELL {sell}</span>
      </div>
    </div>
  );
}
