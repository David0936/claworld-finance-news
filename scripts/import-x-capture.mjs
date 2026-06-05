#!/usr/bin/env node
/**
 * 将已授权可见的 X / 会员频道内容导入 data/live/<id>.json。
 *
 * 这个脚本不负责登录或抓取 X；它只规范化你从浏览器插件、手动复制、
 * 或合规导出得到的内容。临时原文建议放在 scripts/captures/（已加入 .gitignore）。
 *
 * 用法：
 *   node scripts/import-x-capture.mjs scripts/captures/aleabit-member.json aleabitoreddit-member aleabitoreddit --restricted
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LIVE_DIR = join(ROOT, "data", "live");

const [inputFile, id, handle] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const RESTRICTED = process.argv.includes("--restricted");
const MAX_TWEETS = Number(process.env.MAX_TWEETS || 50);

if (!inputFile || !id || !handle) {
  console.error(
    "用法：node scripts/import-x-capture.mjs <capture-file> <id> <handle> [--restricted]"
  );
  process.exit(1);
}

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

function pickTweets(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  return (
    json.tweets ||
    json.items ||
    json.entries ||
    json.data?.tweets ||
    json.data?.items ||
    (Array.isArray(json.data) ? json.data : null) ||
    json.results ||
    []
  );
}

function parseTextCapture(raw) {
  return raw
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      const url = block.match(/https:\/\/(?:x|twitter)\.com\/[^\s)]+/i)?.[0];
      const date =
        block.match(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?/)?.[0] ||
        block.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      const text = block
        .replace(/https:\/\/(?:x|twitter)\.com\/[^\s)]+/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return { id: `capture-${i + 1}`, text, createdAt: date, url };
    });
}

function tweetText(t) {
  return t.text || t.full_text || t.body || t.content || t.tweet || "";
}

function tweetDate(t) {
  const raw = t.createdAt || t.created_at || t.datetime || t.date || t.time || t.timestamp;
  if (raw == null) return new Date();
  if (typeof raw === "number") return new Date(raw * (raw < 1e12 ? 1000 : 1));
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}

function tweetUrl(t) {
  const direct = t.url || t.tweetUrl || t.twitterUrl || t.permalink || t.link;
  if (direct) return direct;
  const tid = t.id || t.id_str || t.tweet_id || t.rest_id;
  return tid ? `https://x.com/${handle}/status/${tid}` : `https://x.com/${handle}`;
}

async function loadCapture(file) {
  const raw = await readFile(file, "utf8");
  try {
    return pickTweets(JSON.parse(raw));
  } catch {
    return parseTextCapture(raw);
  }
}

function buildLive(rawTweets) {
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
    const channel = RESTRICTED ? "会员频道" : "推文";
    feed.push({
      time: fmtTime(d),
      type: "推文",
      ticker,
      title: ticker ? `${channel}线索 · ${ticker}` : `${channel} · @${handle}`,
      body: text,
      author: RESTRICTED ? `@${handle} · 会员频道` : `@${handle}`,
      datetime: fmtDateTime(d),
      url: tweetUrl(raw),
    });
  }

  return {
    id,
    handle,
    source: RESTRICTED ? "restricted-capture" : "browser-capture",
    fetchedAt: fmtDateTime(new Date(now)),
    feed,
    mentions,
  };
}

await mkdir(LIVE_DIR, { recursive: true });
const tweets = await loadCapture(inputFile);
const live = buildLive(tweets);
const out = join(LIVE_DIR, `${id}.json`);
await writeFile(out, JSON.stringify(live, null, 2) + "\n");
console.log(
  `导入完成：${live.feed.length} 条内容，${Object.keys(live.mentions).length} 个 ticker → data/live/${id}.json`
);
