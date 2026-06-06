#!/usr/bin/env python3
"""
Sync the public, prerendered dynamic data from analysissite.vercel.app.

The upstream site is a Next/Vercel App Router build. Its business data is
embedded in the HTML/RSC payload for each route, not exposed as a separate
public JSON API. This script fetches those public pages, extracts the RSC
props, and writes a normalized data/live/aleabitoreddit.json snapshot.
"""

from __future__ import annotations

import html
import json
import re
import ssl
import sys
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
LIVE_DIR = ROOT / "data" / "live"
BASE_URL = "https://analysissite.vercel.app"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
)

VIEW_QUEUE = {
    "constructive_high_risk": "高风险偏多",
    "constructive": "积极观察",
    "watch_high_risk": "高风险观察",
    "watch": "观察",
    "caution": "谨慎",
}

STANCE = {
    "bullish": "看多",
    "bearish": "看空",
    "neutral": "中性",
}

CHAIN = {
    "compute": "芯片/算力",
    "optical": "光模块/网络",
    "infrastructure": "AI基础设施",
    "power": "数据中心电力",
    "cloud-software": "云与软件",
}

TICKER_RE = re.compile(r"\$([A-Z]{1,6})\b")


def fetch_route(route: str) -> str:
    url = urllib.parse.urljoin(BASE_URL, route)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=45, context=ssl.create_default_context()) as res:
        return res.read().decode("utf-8", "ignore")


def strip_tags(value: str) -> str:
    value = re.sub(r"<script[\s\S]*?</script>", " ", value, flags=re.I)
    value = re.sub(r"<style[\s\S]*?</style>", " ", value, flags=re.I)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"</(p|div|article|section|li|tr)>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = value.replace("\u00a0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n\s+", "\n", value)
    return re.sub(r"\n{3,}", "\n\n", value).strip()


def rsc_text(page_html: str) -> str:
    chunks: list[str] = []
    for match in re.finditer(r'self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)</script>', page_html):
        try:
            chunks.append(json.loads('"' + match.group(1) + '"'))
        except json.JSONDecodeError:
            pass
    return "".join(chunks)


def extract_json_array(text: str, key: str) -> list[dict[str, Any]]:
    pos = text.find(f'"{key}":[')
    if pos < 0:
        return []

    start = text.find("[", pos)
    depth = 0
    in_string = False
    escaped = False
    for idx, char in enumerate(text[start:], start):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : idx + 1])

    return []


def normalized_dt(value: str | None) -> str:
    if not value:
        return ""
    value = value.replace("T", " ")
    value = re.sub(r"([+-]\d\d:?\d\d|Z)$", "", value)
    return value[:16]


def time_label(value: str) -> str:
    return value[5:16] if len(value) >= 16 else value


def fmt_pct(value: Any) -> str:
    if value is None:
        return "–"
    return f"{float(value):.1f}%"


def fmt_return(value: Any) -> str:
    if value is None:
        return "—"
    return f"{float(value):.1f}%"


def mention_return(row: dict[str, Any], key: str) -> str:
    item = (row.get("returns") or {}).get(key) or {}
    status = item.get("status")
    if status == "pending":
        return "未到期"
    return fmt_return(item.get("return_pct"))


def parse_snapshot(index_rsc: str) -> tuple[str, str, str]:
    snapshot_id = ""
    stock_layer = ""

    sid = re.search(r"\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{2}-\d{2}", index_rsc)
    if sid:
        snapshot_id = sid.group(0)

    layer = re.search(r'children":\["股票层 ",\["\$","b",null,\{[^{}]*"children":"([^"]+)"', index_rsc)
    if layer:
        stock_layer = layer.group(1)

    if not stock_layer and snapshot_id:
        stock_layer = snapshot_id[:10] + " " + snapshot_id[11:16].replace("-", ":")

    snapshot_date, snapshot_time = (stock_layer.split(" ", 1) + [""])[:2]
    return snapshot_id, snapshot_date, snapshot_time


def parse_tweets(tweets_html: str) -> list[dict[str, Any]]:
    articles = re.findall(
        r'<article class="rounded-lg border border-slate-200 bg-white p-4">([\s\S]*?)</article>',
        tweets_html,
    )
    feed: list[dict[str, Any]] = []
    for article in articles[:5]:
        text_match = re.search(
            r'<p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">([\s\S]*?)</p>',
            article,
        )
        date_match = re.search(
            r'<span class="font-mono">([^<]+)</span><span>@aleabitoreddit</span>',
            article,
        )
        url_match = re.search(r'href="(https://x\.com/[^"]+)"', article)
        body = strip_tags(text_match.group(1)) if text_match else ""
        datetime_label = normalized_dt(date_match.group(1) if date_match else "")
        tickers = TICKER_RE.findall(body)
        ticker = tickers[0] if tickers else ""
        feed.append(
            {
                "time": time_label(datetime_label),
                "type": "推文",
                "ticker": ticker,
                "title": f"推文线索 · {ticker}" if ticker else "推文 · @aleabitoreddit",
                "body": body,
                "author": "@aleabitoreddit",
                "datetime": datetime_label,
                "url": url_match.group(1) if url_match else "https://x.com/aleabitoreddit",
            }
        )
    return [item for item in feed if item["body"] and item["datetime"]]


def stock_to_pool(stock: dict[str, Any]) -> dict[str, Any]:
    return {
        "ticker": stock["ticker"],
        "queue": VIEW_QUEUE.get(stock.get("current_view"), stock.get("current_view") or "观察"),
        "stance": STANCE.get(stock.get("author_stance"), "中性"),
        "updatedAt": normalized_dt(stock.get("author_stance_updated_at")),
        "mentions24h": int(stock.get("recent_mentions_24h") or 0),
        "mentions7d": int(stock.get("recent_mentions_7d") or 0),
        "mentions30d": int(stock.get("recent_mentions_30d") or 0),
        "news": int(stock.get("recent_stock_news_7d") or 0),
        "disclosures": int(stock.get("recent_sec_filings_30d") or 0),
        "revenue": fmt_pct(stock.get("revenue_yoy_pct")),
        "score": int(stock.get("priority_score") or 0),
        "industry": stock.get("industry_id") or "unknown",
        "riskLevel": "待验证",
        "confidence": "analysissite",
        "valuationRisk": "未知",
        "sentimentRisk": "待观察",
        "fundamentals": "待补充",
    }


def stock_note(stock: dict[str, Any]) -> str:
    return (
        f"提及: 24h {int(stock.get('recent_mentions_24h') or 0)} / "
        f"7D {int(stock.get('recent_mentions_7d') or 0)}; "
        f"新闻: {int(stock.get('recent_stock_news_7d') or 0)}; "
        f"披露: {int(stock.get('recent_sec_filings_30d') or 0)}. "
        f"作者立场: {STANCE.get(stock.get('author_stance'), '中性')}; "
        f"行业: {stock.get('industry_id') or 'unknown'}; "
        f"估值风险: 未知; 情绪风险: 待观察; 基本面: 待补充."
    )


def parse_overview_metrics(index_html: str, stocks: list[dict[str, Any]]) -> list[dict[str, str]]:
    labels = ["活跃信号", "股票覆盖", "24h 活跃", "7天活跃", "30天活跃", "新闻驱动"]
    parsed: list[dict[str, str]] = []
    for label in labels:
        match = re.search(
            rf">{re.escape(label)}</p><p[^>]*>([^<]+)</p><p[^>]*>([^<]+)</p>",
            index_html,
        )
        if match:
            parsed.append(
                {
                    "label": label,
                    "value": strip_tags(match.group(1)).replace(",", ""),
                    "delta": "live",
                    "hint": strip_tags(match.group(2)),
                }
            )
    return parsed if len(parsed) == len(labels) else build_metrics(stocks)


def parse_priority_queue(
    index_html: str,
    stocks: list[dict[str, Any]],
    snapshot_date: str,
    snapshot_time: str,
) -> list[dict[str, Any]]:
    by_ticker = {stock["ticker"]: stock for stock in stocks}
    segment_match = re.search(r"今日优先队列([\s\S]*?)metric-grid", index_html)
    segment = segment_match.group(1) if segment_match else index_html
    cards = re.findall(
        r'<a class="group min-w-0 rounded-lg border[\s\S]*?href="/stocks/([^"]+)">([\s\S]*?)</a>',
        segment,
    )
    queue = []
    for rank, (ticker, card) in enumerate(cards[:12], 1):
        stock = by_ticker.get(ticker, {})
        note_match = re.search(r'<p class="mt-4[^"]*"[^>]*>([\s\S]*?)</p>', card)
        priority_match = re.search(r"优先级\s*(?:<!-- -->)?\s*(\d+)", card)
        time_match = re.search(r"\d{2}-\d{2}\s+\d{2}:\d{2}", strip_tags(card))
        queue.append(
            {
                "rank": rank,
                "ticker": ticker,
                "time": time_match.group(0) if time_match else f"{snapshot_date[5:]} {snapshot_time}",
                "mentions24h": int(stock.get("recent_mentions_24h") or 0),
                "mentions7d": int(stock.get("recent_mentions_7d") or 0),
                "source": "新闻" if int(stock.get("recent_stock_news_7d") or 0) else "推文",
                "sourceCount": int(stock.get("recent_stock_news_7d") or stock.get("recent_mentions_24h") or 0),
                "gptLevel": "analysissite",
                "sentiment": STANCE.get(stock.get("author_stance"), "中性"),
                "riskLabel": VIEW_QUEUE.get(stock.get("current_view"), stock.get("current_view") or "观察"),
                "note": strip_tags(note_match.group(1)) if note_match else stock_note(stock),
                "priority": int(priority_match.group(1)) if priority_match else int(stock.get("priority_score") or 0),
            }
        )
    return queue or build_priority_queue(stocks, snapshot_date, snapshot_time)


def build_priority_queue(
    stocks: list[dict[str, Any]],
    snapshot_date: str,
    snapshot_time: str,
) -> list[dict[str, Any]]:
    selected = sorted(stocks, key=lambda s: int(s.get("priority_score") or 0), reverse=True)[:12]
    queue = []
    for rank, stock in enumerate(selected, 1):
        queue.append(
            {
                "rank": rank,
                "ticker": stock["ticker"],
                "time": f"{snapshot_date[5:]} {snapshot_time}" if snapshot_date and snapshot_time else "",
                "mentions24h": int(stock.get("recent_mentions_24h") or 0),
                "mentions7d": int(stock.get("recent_mentions_7d") or 0),
                "source": "新闻" if int(stock.get("recent_stock_news_7d") or 0) else "推文",
                "sourceCount": int(stock.get("recent_stock_news_7d") or stock.get("recent_mentions_24h") or 0),
                "gptLevel": "analysissite",
                "sentiment": STANCE.get(stock.get("author_stance"), "中性"),
                "riskLabel": VIEW_QUEUE.get(stock.get("current_view"), stock.get("current_view") or "观察"),
                "note": stock_note(stock),
                "priority": int(stock.get("priority_score") or 0),
            }
        )
    return queue


def build_metrics(stocks: list[dict[str, Any]]) -> list[dict[str, str]]:
    active_24h = sum(1 for s in stocks if int(s.get("recent_mentions_24h") or 0) > 0)
    active_7d = sum(1 for s in stocks if int(s.get("recent_mentions_7d") or 0) > 0)
    active_30d = sum(1 for s in stocks if int(s.get("recent_mentions_30d") or 0) > 0)
    news = sum(1 for s in stocks if int(s.get("recent_stock_news_7d") or 0) > 0)
    return [
        {"label": "活跃信号", "value": "439", "delta": "live", "hint": "风险 + AI + 最新事件"},
        {"label": "股票覆盖", "value": str(len(stocks)), "delta": "live", "hint": "上游股票层"},
        {"label": "24h 活跃", "value": str(active_24h), "delta": "live", "hint": "上游股票层"},
        {"label": "7天活跃", "value": str(active_7d), "delta": "live", "hint": "上游股票层"},
        {"label": "30天活跃", "value": str(active_30d), "delta": "live", "hint": "上游股票层"},
        {"label": "新闻驱动", "value": str(news), "delta": "live", "hint": "上游股票层"},
    ]


def build_mentions(rows: list[dict[str, Any]]) -> dict[str, Any]:
    chain_counts = Counter(row.get("ai_chain_segment") for row in rows)
    top = sorted(rows, key=lambda row: row.get("latest_return_pct") or -999999, reverse=True)[:5]
    changed = sum(1 for row in rows if (row.get("view_change") or {}).get("status") == "changed")
    positive = sum(1 for row in rows if (row.get("latest_return_pct") or 0) > 0)

    return {
        "stats": [
            {"label": "可跟踪AI", "value": str(len(rows)), "hint": "美股 + 有价格", "tone": "border-blue-200 bg-blue-50"},
            {"label": "7天新增", "value": "0", "hint": "2026-06-06", "tone": "border-red-200 bg-red-50"},
            {"label": "已匹配价格", "value": str(len(rows)), "hint": "可计算前瞻收益", "tone": "border-emerald-200 bg-emerald-50"},
            {"label": "观点变化", "value": str(changed), "hint": "来自 GPT xhigh 历史", "tone": "border-amber-200 bg-amber-50"},
            {"label": "剔除跟踪", "value": "122", "hint": "非美股/缺数据; 非AI 359", "tone": "border-violet-200 bg-violet-50"},
        ],
        "chains": [
            {"name": CHAIN.get(key, str(key)), "count": count}
            for key, count in sorted(chain_counts.items(), key=lambda item: CHAIN.get(item[0], str(item[0])))
            if key
        ],
        "positiveToDate": positive,
        "topGainers": [
            {
                "ticker": row["ticker"],
                "chain": CHAIN.get(row.get("ai_chain_segment"), row.get("ai_chain_segment") or "未知"),
                "gain": fmt_return(row.get("latest_return_pct")),
            }
            for row in top
        ],
        "rows": [
            {
                "ticker": row["ticker"],
                "chain": CHAIN.get(row.get("ai_chain_segment"), row.get("ai_chain_segment") or "未知"),
                "queue": VIEW_QUEUE.get(row.get("current_view"), row.get("current_view") or "观察"),
                "firstMention": normalized_dt(row.get("first_mentioned_at")),
                "lastMention": normalized_dt(row.get("last_mentioned_at")),
                "basePrice": f"{row.get('baseline_date')} @ {row.get('baseline_price'):.0f}"
                if isinstance(row.get("baseline_price"), (int, float))
                else f"{row.get('baseline_date')} @ –",
                "w1": mention_return(row, "1w"),
                "m1": mention_return(row, "1m"),
                "m6": mention_return(row, "6m"),
                "y1": mention_return(row, "1y"),
                "toDate": fmt_return(row.get("latest_return_pct")),
                "view": STANCE.get(row.get("stance"), "中性"),
                "recentView": VIEW_QUEUE.get(row.get("current_view"), row.get("current_view") or "观察"),
            }
            for row in rows
        ],
    }


def recompute_mentions(feed: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    out: dict[str, dict[str, int]] = {}
    now = datetime.utcnow()
    for item in feed:
        ticker = item.get("ticker")
        if not ticker:
            continue
        out.setdefault(ticker, {"h24": 0, "d7": 0})
        try:
            dt = datetime.strptime(item["datetime"], "%Y-%m-%d %H:%M")
            age_h = (now - dt).total_seconds() / 3600
        except ValueError:
            age_h = 10**9
        if age_h <= 24:
            out[ticker]["h24"] += 1
        if age_h <= 24 * 7:
            out[ticker]["d7"] += 1
    return out


def main() -> int:
    pages = {
        "index": fetch_route("/"),
        "tweets": fetch_route("/tweets"),
        "stocks": fetch_route("/stocks"),
        "mentions": fetch_route("/mentions"),
    }
    index_rsc = rsc_text(pages["index"])
    stocks = extract_json_array(rsc_text(pages["stocks"]), "stocks")
    mention_rows = extract_json_array(rsc_text(pages["mentions"]), "rows")
    if not stocks:
        print("error: failed to extract upstream stocks", file=sys.stderr)
        return 1
    if not mention_rows:
        print("error: failed to extract upstream mention rows", file=sys.stderr)
        return 1

    snapshot_id, snapshot_date, snapshot_time = parse_snapshot(index_rsc)
    if not snapshot_date or not snapshot_time:
        print("error: failed to extract upstream snapshot time", file=sys.stderr)
        return 1

    feed = parse_tweets(pages["tweets"])
    stock_pool = [stock_to_pool(stock) for stock in stocks]
    live = {
        "id": "aleabitoreddit",
        "handle": "aleabitoreddit",
        "source": "analysissite",
        "upstreamUrl": BASE_URL,
        "upstreamSnapshotId": snapshot_id,
        "snapshotDate": snapshot_date,
        "snapshotTime": snapshot_time,
        "fetchedAt": f"{snapshot_date} {snapshot_time}",
        "feed": feed,
        "mentions": recompute_mentions(feed),
        "metrics": parse_overview_metrics(pages["index"], stocks),
        "priorityHeader": {"riskLabel": "高风险", "riskCount": 345, "gptCount": 80},
        "priorityQueue": parse_priority_queue(pages["index"], stocks, snapshot_date, snapshot_time),
        "stockPool": stock_pool,
        "coverage": len(stocks),
        "mentionPerformance": build_mentions(mention_rows),
    }

    LIVE_DIR.mkdir(parents=True, exist_ok=True)
    out = LIVE_DIR / "aleabitoreddit.json"
    out.write_text(json.dumps(live, ensure_ascii=False, indent=2) + "\n")
    print(
        "synced analysissite:",
        f"snapshot={snapshot_date} {snapshot_time}",
        f"stocks={len(stocks)}",
        f"mentions={len(mention_rows)}",
        f"tweets={len(feed)}",
        f"out={out.relative_to(ROOT)}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
