import type { BloggerData, FeedItem } from "./types";
import aleabit from "./live/aleabit.json";
import playbooktrades from "./live/playbooktrades.json";

interface LiveData {
  id: string;
  handle: string;
  fetchedAt: string | null;
  feed: FeedItem[];
  mentions: Record<string, { h24: number; d7: number }>;
}

// id -> 抓取脚本产出的实时数据（data/live/<id>.json）
const LIVE: Record<string, LiveData> = {
  aleabit: aleabit as unknown as LiveData,
  playbooktrades: playbooktrades as unknown as LiveData,
};

/**
 * 把抓取到的实时推文合并进博主数据：
 * - 有实时推文时，feed = 实时推文(推文类) + 作者手写的非推文条目(观点变化/GPT/新闻等)
 * - 同步把快照时间更新为抓取时间
 * - 没有实时数据时原样返回（占位博主、或还没填 key 时）
 */
export function applyLive(list: BloggerData[]): BloggerData[] {
  return list.map((b) => {
    const live = LIVE[b.id];
    if (!live || !live.feed || live.feed.length === 0) return b;

    const authoredNonTweets = b.feed.filter((f) => f.type !== "推文");
    const merged: BloggerData = {
      ...b,
      feed: [...(live.feed as FeedItem[]), ...authoredNonTweets],
    };
    if (live.fetchedAt) {
      merged.snapshotDate = live.fetchedAt.slice(0, 10);
      merged.snapshotTime = live.fetchedAt.slice(11);
    }
    return merged;
  });
}
