#!/usr/bin/env node
/**
 * 抓取每个博主的最新推文，生成 data/live/<id>.json，供网站静态构建读取。
 *
 * 数据源：第三方抓取 API。换服务商只改环境变量，不用动代码。
 *   TWITTER_API_KEY    必填（没有则 dry-run 用 fixture，不会真请求）
 *   TWITTER_API_PROVIDER 可选：twtapi | generic（不填按 TWITTER_API_BASE 推断）
 *   TWITTER_API_BASE   默认 https://api.twitterapi.io
 *   TWITTER_API_PATH   默认 /twitter/user/last_tweets
 *   TWITTER_API_KEY_HEADER 默认 X-API-Key（key 放请求头时用）
 *   TWITTER_API_METHOD GET（默认）| POST
 *   TWITTER_API_USER_PARAM  GET 时拼的用户名参数名，默认 userName（→ ?userName=<handle>）
 *   TWITTER_API_TOKEN_QUERY 若设了，key 改放 URL query（如 Apify 用 token）而非请求头
 *   TWITTER_API_BODY   POST 时的请求体模板，占位符 {{handle}} {{max}}；不填则用 Apify 默认体
 *
 * ── 三种现成配法 ──
 * A) TwtAPI（GET+header）：TWITTER_API_PROVIDER=twtapi，TWITTER_API_KEY=<你的 key>。
 * B) twitterapi.io（默认，GET+header）：只配 TWITTER_API_KEY 即可。
 * C) Apify「最便宜抓取器」（POST，按你的量基本免费）：
 *      TWITTER_API_KEY        = <你的 Apify token>
 *      TWITTER_API_BASE       = https://api.apify.com
 *      TWITTER_API_PATH       = /v2/acts/kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest/run-sync-get-dataset-items
 *      TWITTER_API_METHOD     = POST
 *      TWITTER_API_TOKEN_QUERY= token
 *    （请求体默认就是 {"searchTerms":["from:<handle>"],"sort":"Latest","maxItems":<MAX_TWEETS>}）
 *
 * 用法：
 *   node scripts/fetch-x.mjs            正常抓取（有 key 走 API；没 key 尝试公开镜像源）
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

const API_PROVIDER = (process.env.TWITTER_API_PROVIDER || "").toLowerCase();
const DEFAULT_API_BASE =
  API_PROVIDER === "twtapi" ? "https://api.twtapi.com" : "https://api.twitterapi.io";
const API_BASE = process.env.TWITTER_API_BASE || DEFAULT_API_BASE;
const API_PATH = process.env.TWITTER_API_PATH || "/twitter/user/last_tweets";
const KEY_HEADER = process.env.TWITTER_API_KEY_HEADER || "X-API-Key";
const API_KEY = process.env.TWITTER_API_KEY || "";
const METHOD = (process.env.TWITTER_API_METHOD || "GET").toUpperCase();
const USER_PARAM = process.env.TWITTER_API_USER_PARAM || "userName";
const TOKEN_QUERY = process.env.TWITTER_API_TOKEN_QUERY || ""; // 设了则 key 放 query（Apify=token）
const BODY_TMPL = process.env.TWITTER_API_BODY || "";
const PUBLIC_SOURCE = (process.env.TWITTER_PUBLIC_SOURCE || (API_KEY ? "" : "sotwe")).toLowerCase();
const SOTWE_BASE = process.env.SOTWE_BASE || "https://www.sotwe.com";
const API_LANG = process.env.TWITTER_API_LANG || "zh";
const IS_TWTAPI = API_PROVIDER === "twtapi" || API_BASE.includes("api.twtapi.com");

const DRY_RUN = process.argv.includes("--dry-run");
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
function tweetId(t) {
  return t.id || t.id_str || t.tweet_id || t.rest_id || t.conversation_id_str || "";
}
function tweetUrl(t, handle) {
  // 优先用 API 直接给的链接；否则用 id 拼 X 永久链接；再不行退到主页
  const direct = t.url || t.tweetUrl || t.twitterUrl || t.permalink || t.link;
  if (direct) return direct;
  const id = tweetId(t);
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

function decodeHtml(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|article|section|li|h\d|time)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseRelativeDate(label, now = new Date()) {
  const s = String(label || "").toLowerCase().trim();
  const d = new Date(now);
  const n = Number(s.match(/\d+/)?.[0] || 1);
  if (/minute|min/.test(s)) d.setUTCMinutes(d.getUTCMinutes() - n);
  else if (/hour|hr/.test(s)) d.setUTCHours(d.getUTCHours() - n);
  else if (/day/.test(s)) d.setUTCDate(d.getUTCDate() - n);
  else if (/week/.test(s)) d.setUTCDate(d.getUTCDate() - n * 7);
  else if (/month/.test(s)) d.setUTCMonth(d.getUTCMonth() - n);
  else if (/year/.test(s)) d.setUTCFullYear(d.getUTCFullYear() - n);
  else return null;
  return d;
}

function collectTweetObjects(value, out = [], seen = new Set()) {
  if (!value || out.length >= MAX_TWEETS * 4) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectTweetObjects(item, out, seen);
    return out;
  }
  if (typeof value !== "object") return out;

  const text = tweetText(value).trim();
  const id = tweetId(value);
  const date = tweetDate(value);
  const key = id || `${date.getTime()}|${text.slice(0, 80)}`;
  if (text.length >= 12 && !seen.has(key)) {
    seen.add(key);
    out.push(value);
  }

  for (const child of Object.values(value)) collectTweetObjects(child, out, seen);
  return out;
}

function extractJsonTweets(html) {
  const out = [];
  const scripts = [
    ...html.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi),
    ...html.matchAll(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const match of scripts) {
    try {
      out.push(...collectTweetObjects(JSON.parse(decodeHtml(match[1]))));
    } catch {
      // 页面脚本不是 JSON 时忽略，继续走文本解析。
    }
  }
  return out;
}

function extractTextTweets(html, handle) {
  const text = stripTags(html);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const out = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const isTweetLike =
      line.length >= 20 &&
      !line.startsWith("@") &&
      !/^ALEABITOREDDIT$/i.test(line) &&
      !/^Image$/i.test(line) &&
      (line.includes("$") || /tesla|robotaxi|lidar|partnership|earnings|stock|market/i.test(line));
    if (!isTweetLike) continue;

    const windowText = lines.slice(i, i + 8).join(" ");
    const rel = windowText.match(/\b(?:about\s+)?\d+\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\s+ago\b/i)?.[0];
    const d = parseRelativeDate(rel) || new Date();
    const key = `${fmtDateTime(d)}|${line.slice(0, 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      text: line.replace(/\s*Show more\s*$/i, "").trim(),
      createdAt: d.toISOString(),
      url: `https://x.com/${handle}`,
    });
  }
  return out;
}

async function fetchSotweTweets(handle) {
  const url = `${SOTWE_BASE.replace(/\/$/, "")}/${handle}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Sotwe HTTP ${res.status} ${res.statusText}`);
  const html = await res.text();
  const tweets = [...extractJsonTweets(html), ...extractTextTweets(html, handle)];
  const seen = new Set();
  return tweets.filter((t) => {
    const text = tweetText(t).trim();
    const key = `${tweetId(t)}|${tweetDate(t).getTime()}|${text.slice(0, 100)}`;
    if (!text || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function twtApiUrl(path, params = {}) {
  const base = API_BASE.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}/api/v1/twitter${normalizedPath}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  }
  return url;
}

async function fetchTwtApiJson(path, params = {}) {
  const url = twtApiUrl(path, params);
  const res = await fetch(url, {
    headers: {
      [KEY_HEADER]: API_KEY,
      "X-Lang": API_LANG,
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`TwtAPI HTTP ${res.status} ${res.statusText} — ${path}`);
  }
  if (json?.code && String(json.code) !== "200") {
    throw new Error(`TwtAPI ${json.code}: ${json.msg || "request failed"}`);
  }
  return json;
}

function twtApiUserId(json) {
  return (
    json?.id_str ||
    json?.rest_id ||
    json?.user_id ||
    json?.data?.id_str ||
    json?.data?.rest_id ||
    json?.data?.user_id ||
    json?.data?.user?.id_str ||
    json?.data?.user?.rest_id ||
    ""
  );
}

function twtApiScreenName(tweet) {
  return (
    tweet?.core?.user_results?.result?.core?.screen_name ||
    tweet?.core?.user_results?.result?.legacy?.screen_name ||
    tweet?.user_results?.result?.core?.screen_name ||
    tweet?.user_results?.result?.legacy?.screen_name ||
    ""
  );
}

function twtApiTweetText(tweet) {
  return (
    tweet?.note_tweet?.note_tweet_results?.result?.text ||
    tweet?.note_tweet?.note_tweet_results?.result?.richtext?.text ||
    tweet?.legacy?.full_text ||
    tweet?.legacy?.text ||
    ""
  );
}

function collectTwtApiTweets(value, handle, out = [], seen = new Set()) {
  if (!value || out.length >= MAX_TWEETS * 8) return out;
  if (Array.isArray(value)) {
    for (const item of value) collectTwtApiTweets(item, handle, out, seen);
    return out;
  }
  if (typeof value !== "object") return out;

  const legacy = value.legacy;
  const id = value.rest_id || legacy?.id_str || legacy?.conversation_id_str || "";
  const text = twtApiTweetText(value);
  const createdAt = legacy?.created_at || "";
  const screenName = twtApiScreenName(value).toLowerCase();
  const isSameAuthor = !screenName || screenName === handle.toLowerCase();

  if (legacy && id && text && createdAt && isSameAuthor && !seen.has(id)) {
    seen.add(id);
    out.push({
      id_str: id,
      full_text: text,
      created_at: createdAt,
      url: `https://x.com/${handle}/status/${id}`,
    });
  }

  for (const child of Object.values(value)) collectTwtApiTweets(child, handle, out, seen);
  return out;
}

async function fetchTwtApiTweets(handle, knownUserId = "") {
  let userId = knownUserId;
  if (!userId) {
    const user = await fetchTwtApiJson("/UsernameToUserId", { username: handle });
    userId = twtApiUserId(user);
  }
  if (!userId) throw new Error(`TwtAPI 未能解析 @${handle} 的 user_id`);

  const timeline = await fetchTwtApiJson("/UserTweets", { user_id: userId });
  return collectTwtApiTweets(timeline, handle);
}

async function fetchTweets(handle, options = {}) {
  if (DRY_RUN) {
    const fx = join(FIXTURE_DIR, `${handle}.json`);
    if (!existsSync(fx)) {
      console.log(`  [dry-run] 无 fixture：${handle}，跳过`);
      return [];
    }
    return pickTweets(JSON.parse(await readFile(fx, "utf8")));
  }
  if (!API_KEY) {
    if (PUBLIC_SOURCE === "sotwe") return fetchSotweTweets(handle);
    throw new Error("缺少 TWITTER_API_KEY，且未启用可用公开源（TWITTER_PUBLIC_SOURCE=sotwe）");
  }
  if (IS_TWTAPI) return fetchTwtApiTweets(handle, options.user_id);
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
    source: DRY_RUN ? "fixture" : API_KEY ? API_BASE : PUBLIC_SOURCE,
    fetchedAt: fmtDateTime(new Date(now)),
    feed,
    mentions,
  };
}

async function main() {
  console.log(
    DRY_RUN
      ? "== fetch-x DRY-RUN（使用 fixtures，不联网）=="
      : `== fetch-x LIVE（${API_KEY ? API_BASE : PUBLIC_SOURCE}）==`
  );
  await mkdir(LIVE_DIR, { recursive: true });
  const handles = JSON.parse(
    await readFile(join(__dirname, "handles.json"), "utf8")
  );

  let ok = 0;
  for (const entry of handles) {
    const { id, handle } = entry;
    try {
      const raw = await fetchTweets(handle, entry);
      const live = buildLive(id, handle, raw);
      const out = join(LIVE_DIR, `${id}.tweets.json`);
      await writeFile(out, JSON.stringify(live, null, 2) + "\n");
      console.log(
        `  ✓ @${handle} → ${live.feed.length} 条推文，写入 data/live/${id}.tweets.json`
      );
      ok += 1;
    } catch (err) {
      // 单个失败不影响整体；保留旧文件
      console.error(`  ✗ @${handle} 抓取失败：${err.message}（保留旧数据）`);
    }
  }
  console.log(`完成：${ok}/${handles.length} 个博主更新。`);
  if (!DRY_RUN && ok === 0) {
    console.error("没有任何博主抓取成功；拒绝生成空的“真数据”更新。");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
