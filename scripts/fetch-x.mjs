#!/usr/bin/env node
/**
 * 抓取每个博主的最新推文，生成 data/live/<id>.json，供网站静态构建读取。
 *
 * 数据源：第三方抓取 API（默认按 twitterapi.io 形态：X-API-Key 头 + REST）。
 * 通过环境变量配置，方便以后换服务商：
 *   TWITTER_API_KEY   必填（没有则 dry-run 用 fixture，不会真请求）
 *   TWITTER_API_BASE  默认 https://api.twitterapi.io
 *   TWITTER_API_PATH  默认 /twitter/user/last_tweets   （?userName=<handle> 会自动拼）
 *   TWITTER_API_KEY_HEADER 默认 X-API-Key
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

async function fetchTweets(handle) {
  if (DRY_RUN) {
    const fx = join(FIXTURE_DIR, `${handle}.json`);
    if (!existsSync(fx)) {
      console.log(`  [dry-run] 无 fixture：${handle}，跳过`);
      return [];
    }
    return pickTweets(JSON.parse(await readFile(fx, "utf8")));
  }
  const url = `${API_BASE}${API_PATH}?userName=${encodeURIComponent(handle)}`;
  const res = await fetch(url, { headers: { [KEY_HEADER]: API_KEY } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
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
