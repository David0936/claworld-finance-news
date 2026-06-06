#!/usr/bin/env node
/**
 * 轻量数据验证：在 Netlify / 本地 build 前拦住最容易导致页面空白的配置错误。
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const LIVE_DIR = join(ROOT, "data", "live");
const FIXTURE_DIR = join(ROOT, "scripts", "fixtures");

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(path) {
  return readFile(path, "utf8").then((text) => JSON.parse(text));
}

function cleanHandle(handle) {
  return String(handle || "").replace(/^@/, "").replace(/\/.*$/, "").toLowerCase();
}

function parseBloggerIds(source) {
  return [...source.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
}

function validateFeedItem(item, context) {
  if (!isObject(item)) return fail(`${context}: feed item must be an object`);
  for (const key of ["time", "type", "ticker", "title", "body", "author", "datetime"]) {
    if (typeof item[key] !== "string") fail(`${context}: missing string field ${key}`);
  }
  if (item.type && item.type !== "推文") {
    fail(`${context}: live feed type must be 推文, got ${item.type}`);
  }
  if (item.datetime && !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(item.datetime)) {
    fail(`${context}: datetime must be YYYY-MM-DD HH:MM`);
  }
  if (item.time && !/^\d{2}-\d{2} \d{2}:\d{2}$/.test(item.time)) {
    fail(`${context}: time must be MM-DD HH:MM`);
  }
  if (item.ticker && !/^[A-Z]{1,6}$/.test(item.ticker)) {
    warn(`${context}: ticker "${item.ticker}" is unusual`);
  }
  if (item.url && !/^https:\/\/(x|twitter)\.com\//i.test(item.url)) {
    warn(`${context}: url is not an X/Twitter URL`);
  }
}

function validateMentions(mentions, context) {
  if (!isObject(mentions)) return fail(`${context}: mentions must be an object`);
  for (const [ticker, value] of Object.entries(mentions)) {
    if (!/^[A-Z]{1,6}$/.test(ticker)) warn(`${context}: mention ticker "${ticker}" is unusual`);
    if (!isObject(value)) {
      fail(`${context}: mention ${ticker} must be an object`);
      continue;
    }
    for (const key of ["h24", "d7"]) {
      if (!Number.isFinite(value[key]) || value[key] < 0) {
        fail(`${context}: mention ${ticker}.${key} must be a non-negative number`);
      }
    }
  }
}

const bloggersSource = await readFile(join(ROOT, "data", "bloggers.ts"), "utf8");
const bloggerIds = new Set(parseBloggerIds(bloggersSource));
if (!bloggerIds.size) fail("data/bloggers.ts: no blogger ids found");
if (!bloggersSource.includes("memberUrl: \"https://x.com/aleabitoreddit/superfollows\"")) {
  warn("data/bloggers.ts: Serenity memberUrl is not configured");
}

const handles = await readJson(join(ROOT, "scripts", "handles.json"));
if (!Array.isArray(handles)) fail("scripts/handles.json: root must be an array");
const handleIds = new Set();
for (const [index, item] of (Array.isArray(handles) ? handles : []).entries()) {
  const context = `scripts/handles.json[${index}]`;
  if (!isObject(item)) {
    fail(`${context}: item must be an object`);
    continue;
  }
  if (!item.id || typeof item.id !== "string") fail(`${context}: id is required`);
  if (!item.handle || typeof item.handle !== "string") fail(`${context}: handle is required`);
  if (item.handle?.startsWith("@")) fail(`${context}: handle should not include @`);
  if (item.id && handleIds.has(item.id)) fail(`${context}: duplicate id ${item.id}`);
  if (item.id) handleIds.add(item.id);
  if (item.id && !bloggerIds.has(item.id)) {
    fail(`${context}: id "${item.id}" does not exist in data/bloggers.ts`);
  }

  const fixture = join(FIXTURE_DIR, `${item.handle}.json`);
  if (!existsSync(fixture)) warn(`${context}: missing dry-run fixture for ${item.handle}`);
}

if (existsSync(LIVE_DIR)) {
  const files = (await readdir(LIVE_DIR)).filter((file) => file.endsWith(".json") && !file.startsWith("_"));
  for (const file of files) {
    const context = `data/live/${file}`;
    const live = await readJson(join(LIVE_DIR, file));
    if (!isObject(live)) {
      fail(`${context}: root must be an object`);
      continue;
    }
    if (!live.id || typeof live.id !== "string") fail(`${context}: id is required`);
    if (!live.handle || typeof live.handle !== "string") fail(`${context}: handle is required`);
    if (live.handle?.startsWith("@")) fail(`${context}: handle should not include @`);
    if (live.fetchedAt !== null && live.fetchedAt !== undefined) {
      if (typeof live.fetchedAt !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(live.fetchedAt)) {
        fail(`${context}: fetchedAt must be null or YYYY-MM-DD HH:MM`);
      }
    }
    if (live.source === "fixture") {
      fail(`${context}: fixture data must not be committed as live data`);
    }
    if (!Array.isArray(live.feed)) fail(`${context}: feed must be an array`);
    else live.feed.forEach((item, index) => validateFeedItem(item, `${context}.feed[${index}]`));
    validateMentions(live.mentions ?? {}, `${context}.mentions`);

    const matchesBlogger = bloggerIds.has(live.id) || bloggerIds.has(cleanHandle(live.handle));
    const isCaptureVariant = live.id?.startsWith(`${cleanHandle(live.handle)}-`);
    if (!matchesBlogger && !isCaptureVariant) {
      warn(`${context}: id "${live.id}" is not a known blogger id or capture variant`);
    }
  }
}

for (const message of warnings) console.warn(`warning: ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`error: ${message}`);
  process.exit(1);
}

console.log(`validate-data: ok (${warnings.length} warning${warnings.length === 1 ? "" : "s"})`);
