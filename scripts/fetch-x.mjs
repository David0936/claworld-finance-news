#!/usr/bin/env node
/**
 * 抓取每个博主的最新推文，生成 data/live/<id>.json，供网站静态构建读取。
 *
 * 数据源：第三方抓取 API。换服务商只改环境变量，不用动代码。
 *   TWITTER_API_KEY    必填（没有则 dry-run 用 fixture，不会真请求）
 *   TWITTER_API_BASE   默认 https://api.twitterapi.io
 *   TWITTER_API_PATH   默认 /twitter/user/last_tweets
 *   TWITTER_API_KEY_HEADER 默认 X-API-Key（key 放请求头时用）
 *   TWITTER_API_METHOD GET（默认）| POST
 *   TWITTER_API_USER_PARAM  GET 时拼的用户名参数名，默认 userName（→ ?userName=<handle>）
 *   TWITTER_API_TOKEN_QUERY 若设了，key 改放 URL query（如 Apify 用 token）而非请求头
 *   TWITTER_API_BODY   POST 时的请求体模板，占位符 {{handle}} {{max}}；不填则用 Apify 默认体
 *
 * ── 两种现成配法 ──
 * A) twitterapi.io（默认，GET+header）：只配 TWITTER_API_KEY 即可。
 * B) Apify「最便宜抓取器」（POST，按你的量基本免费）：
 *      TWITTER_API_KEY        = <你的 Apify token>
 *      TWITTER_API_BASE       = https://api.apify.com
 *      TWITTER_API_PATH       = /v2/acts/kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest/run-sync-get-dataset-items
 *      TWITTER_API_METHOD     = POST
 *      TWITTER_API_TOKEN_QUERY= token
 *    （请求体默认就是 {"searchTerms":["from:<handle>"],"sort":"Latest","maxItems":<MAX_TWEETS>}）
 *
 * 用法：
 *   node scripts/fetch-x.mjs            正常抓取（需要 key）
 *   node scripts/fetch-x.mjs --dry-run  用 scripts/fixtures/<handle>.json 跑，不联网（验证管线）
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LIVE_DIR = join(ROOT, "data", "live");
const FIXTURE_DIR = join(__dirname, "fixtures");

const API_BASE = process.env.TWITTER_API_BASE || "https://api.twitterapi.io";
const API_PATH = process.env.TWITTER_API_PATH || "/twitter/user/last_tweets";
const KEY_HEADER = process.env.TWITTER_API_KEY_HEADER || "X-API-Key";
const API_KEY = process.env.TWITTER_API_KEY || "";
const METHOD = (process.env.TWITTER_API_METHOD || "GET").toUpperCase();
const USER_PARAM = process.env.TWITTER_API_USER_PARAM || "userName";
const TOKEN_QUERY = process.env.TWITTER_API_TOKEN_QUERY || ""; // 设了则 key 放 query（Apify=token）
const BODY_TMPL = process.env.TWITTER_API_BODY || "";

const DRY_RUN = process.argv.includes("--dry-run") || !API_KEY;
const MAX_TWEETS = Number(process.env.MAX_TWEETS || 20);

const pad = (n) => String(n).padStart(2, "0");
const fmtDateTime = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
const fmtTime = (d) =>
  `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes()
  )}`;

const TICKER_RE = /\$([A-Z]{1,6})\b/g;
function extractTickers(text) {
  const out = new Set();
  let m;
  while ((m = TICKER_RE.exec(text)) !== null) out.add(m[1]);
  return [...out];
}

// 兼容多种返回结构，尽量稳健地取出推文数组
function pickTweets(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  return (
    json.tweets ||
    json.data?.tweets ||
    json.data?.data ||
    (Array.isArray(json.data) ? json.data : null) ||
    json.results ||
    []
  );
}

function tweetText(t) {
  return t.text || t.full_text || t.content || t.tweet || "";
}
function tweetDate(t) {
  const raw =
    t.createdAt || t.created_at || t.date || t.time || t.timestamp || null;
  if (raw == null) return new Date(0);
  if (typeof raw === "number") return new Date(raw * (raw < 1e12 ? 1000 : 1));
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
}
function tweetUrl(t, handle) {
  // 优先用 API 直接给的链接；否则用 id 拼 X 永久链接；再不行退到主页
  const direct = t.url || t.tweetUrl || t.twitterUrl || t.permalink || t.link;
  if (direct) return direct;
  const id = t.id || t.id_str || t.tweet_id || t.rest_id;
  return id ? `https://x.com/${handle}/status/${id}` : `https://x.com/${handle}`;
}

function buildUrl(handle) {
  const params = new URLSearchParams();
  if (METHOD === "GET") params.set(USER_PARAM, handle); // GET：用户名拼 query；POST：放 body
  if (TOKEN_QUERY) params.set(TOKEN_QUERY, API_KEY);    // key 放 query（如 Apify token）
  const qs = params.toString();
  return `${API_BASE}${API_PATH}${qs ? `?${qs}` : ""}`;
}

function buildBody(handle) {
  if (METHOD !== "POST") return undefined;
  if (BODY_TMPL) {
    return BODY_TMPL.split("{{handle}}").join(handle).split("{{max}}").join(String(MAX_TWEETS));
  }
  // 默认按 Apify kaitoeasyapi「最便宜抓取器」：取某人最新 N 条推文
  return JSON.stringify({ searchTerms: [`from:${handle}`], sort: "Latest", maxItems: MAX_TWEETS });
}

async function fetchTweets(handle) {
  if (DRY_RUN) {
    const fx = join(FIXTURE_DIR, `${handle}.json`);
    if (!existsSync(fx)) {
      console.log(`  [dry-run] 无 fixture：${handle}，跳过`);
      return [];
    }
    return pickTweets(JSON.parse(await readFile(fx, "utf8")));
  }
  const url = buildUrl(handle);
  const headers = {};
  if (!TOKEN_QUERY && API_KEY) headers[KEY_HEADER] = API_KEY; // key 放请求头（默认）
  const init = { method: METHOD, headers };
  if (METHOD === "POST") {
    headers["Content-Type"] = "application/json";
    init.body = buildBody(handle);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${API_BASE}${API_PATH}`);
  }
  return pickTweets(await res.json());
}

function buildLive(id, handle, rawTweets) {
  const now = Date.now();
  const sorted = [...rawTweets]
    .map((t) => ({ raw: t, d: tweetDate(t) }))
    .sort((a, b) => b.d - a.d)
    .slice(0, MAX_TWEETS);

  const feed = [];
  const mentions = {};

  for (const { raw, d } of sorted) {
    const text = tweetText(raw).trim();
    if (!text) continue;
    const tickers = extractTickers(text);
    const ageH = (now - d.getTime()) / 3.6e6;

    for (const tk of tickers) {
      if (!mentions[tk]) mentions[tk] = { h24: 0, d7: 0 };
      if (ageH <= 24) mentions[tk].h24 += 1;
      if (ageH <= 24 * 7) mentions[tk].d7 += 1;
    }

    const ticker = tickers[0] || "";
    feed.push({
      time: fmtTime(d),
      type: "推文",
      ticker,
      title: ticker ? `推文线索 · ${ticker}` : `推文 · @${handle}`,
      body: text,
      author: `@${handle}`,
      datetime: fmtDateTime(d),
      url: tweetUrl(raw, handle),
    });
  }

  return {
    id,
    handle,
    fetchedAt: fmtDateTime(new Date(now)),
    feed,
    mentions,
  };
}

async function main() {
  console.log(
    DRY_RUN
      ? "== fetch-x DRY-RUN（使用 fixtures，不联网）=="
      : `== fetch-x LIVE（${API_BASE}）==`
  );
  await mkdir(LIVE_DIR, { recursive: true });
  const handles = JSON.parse(
    await readFile(join(__dirname, "handles.json"), "utf8")
  );

  let ok = 0;
  for (const { id, handle } of handles) {
    try {
      const raw = await fetchTweets(handle);
      const live = buildLive(id, handle, raw);
      const out = join(LIVE_DIR, `${id}.json`);
      await writeFile(out, JSON.stringify(live, null, 2) + "\n");
      console.log(
        `  ✓ @${handle} → ${live.feed.length} 条推文，写入 data/live/${id}.json`
      );
      ok += 1;
    } catch (err) {
      // 单个失败不影响整体；保留旧文件
      console.error(`  ✗ @${handle} 抓取失败：${err.message}（保留旧数据）`);
    }
  }
  console.log(`完成：${ok}/${handles.length} 个博主更新。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
