"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/data/types";

/**
 * 实时推文条：直接拉常驻 worker（NEXT_PUBLIC_REALTIME_URL）暴露的 /api/tweets，
 * 每 POLL_MS 刷新一次。拿不到就回退到构建期 fallback，页面永远不空。
 *
 * worker 没配（本地预览 / 未部署）时，组件静默用 fallback，不报错。
 */

const REALTIME_URL = (process.env.NEXT_PUBLIC_REALTIME_URL || "").replace(/\/$/, "");
const POLL_MS = 15000;

type Status = "live" | "fallback" | "loading" | "offline";

type Ashare = { code: string; name?: string; via?: string };
type LiveFeedItem = FeedItem & { id?: string; ashare?: Ashare[] };

function keyOf(t: FeedItem) {
  return (t as { id?: string }).id || `${t.datetime}|${(t.body || "").slice(0, 40)}`;
}

export default function LiveTweets({
  fallback,
  handle,
  limit = 5,
}: {
  fallback: FeedItem[];
  handle: string;
  limit?: number;
}) {
  const [tweets, setTweets] = useState<FeedItem[]>(fallback.slice(0, limit));
  const [status, setStatus] = useState<Status>(REALTIME_URL ? "loading" : "fallback");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const prevTop = useRef<string | null>(fallback[0] ? keyOf(fallback[0]) : null);
  const profileUrl = `https://x.com/${handle.replace(/^@/, "")}`;

  useEffect(() => {
    if (!REALTIME_URL) return; // worker 未配置：保持 fallback
    let alive = true;

    async function tick() {
      try {
        const res = await fetch(`${REALTIME_URL}/api/tweets`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { feed?: FeedItem[]; fetchedAt?: string };
        if (!alive) return;
        const feed = (data.feed || []).filter((f) => f.type === "推文").slice(0, limit);
        if (feed.length) {
          const top = keyOf(feed[0]);
          if (prevTop.current && top !== prevTop.current) {
            setFlashKey(top); // 顶部出现新推 → 高亮一下
            setTimeout(() => alive && setFlashKey(null), 4000);
          }
          prevTop.current = top;
          setTweets(feed);
          setUpdatedAt(data.fetchedAt || new Date().toISOString());
        }
        setStatus("live");
      } catch {
        if (alive) setStatus((s) => (s === "live" ? "live" : "offline"));
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [limit]);

  const dot =
    status === "live"
      ? "bg-emerald-500"
      : status === "loading"
      ? "bg-amber-400"
      : "bg-slate-300";
  const label =
    status === "live"
      ? "实时"
      : status === "loading"
      ? "连接中"
      : status === "offline"
      ? "实时源离线 · 显示最近缓存"
      : "构建期快照";

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {status === "live" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot}`} />
        </span>
        <h2 className="text-base font-semibold text-slate-900">实时推文</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {label}
        </span>
        <a
          href={profileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-blue-600 hover:underline"
        >
          @{handle.replace(/^@/, "")}
        </a>
        {updatedAt && (
          <span className="ml-auto text-[11px] text-slate-400">
            更新于 {new Date(updatedAt.replace(" ", "T") + (updatedAt.includes("Z") ? "" : "Z")).toLocaleTimeString("zh-CN", { hour12: false })}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3">
        {tweets.map((t) => {
          const tickers = t.tickers ?? (t.ticker ? [t.ticker] : []);
          const ashare = (t as LiveFeedItem).ashare ?? [];
          const isNew = flashKey && keyOf(t) === flashKey;
          return (
            <article
              key={keyOf(t)}
              className={`rounded-xl border p-4 transition-colors ${
                ashare.length
                  ? "border-red-300 bg-red-50/60"
                  : isNew
                  ? "border-emerald-300 bg-emerald-50/60"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-500">{t.datetime}</span>
                <span className="text-xs text-slate-400">{t.author}</span>
                {isNew && (
                  <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    NEW
                  </span>
                )}
                <a
                  href={t.url ?? profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50"
                >
                  ↗ X 原文
                </a>
              </div>
              {ashare.length > 0 && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      🅰️ A股点名
                    </span>
                    {ashare.map((a) => (
                      <span
                        key={a.code}
                        className="rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-red-700 ring-1 ring-red-200"
                      >
                        {a.code}
                        {a.name ? ` ${a.name}` : ""}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-red-600/80">
                    该账号历史 2 次点名 A 股均涨停（用户观察）。⚠️ 仅信息提示，非投资建议，请自行判断与风控。
                  </p>
                </div>
              )}
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">
                {t.body}
              </p>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                <span>浏览 {t.stats?.views ?? "0"}</span>
                <span>赞 {t.stats?.likes ?? "0"}</span>
                <span>转发 {t.stats?.reposts ?? "0"}</span>
                <span>收藏 {t.stats?.bookmarks ?? "0"}</span>
              </div>
              {tickers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {tickers.map((tk) => (
                    <a
                      key={tk}
                      href="/stocks/"
                      className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
                    >
                      ${tk}
                    </a>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
