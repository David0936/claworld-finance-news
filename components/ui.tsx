import type { FeedType, Sentiment } from "@/data/types";

export function sentimentClass(s: Sentiment): string {
  switch (s) {
    case "看多":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "看空":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}

export function deltaClass(delta: string): string {
  if (delta.startsWith("+")) return "text-emerald-600";
  if (delta.startsWith("-")) return "text-red-600";
  return "text-slate-400";
}

export function feedTypeClass(t: FeedType): string {
  switch (t) {
    case "推文":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "观点变化":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "GPT xhigh":
      return "bg-slate-900 text-white";
    case "新闻":
      return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
    case "披露":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function feedDotClass(t: FeedType): string {
  switch (t) {
    case "推文":
      return "bg-blue-500";
    case "观点变化":
      return "bg-amber-500";
    case "GPT xhigh":
      return "bg-slate-900";
    case "新闻":
      return "bg-indigo-500";
    case "披露":
      return "bg-emerald-500";
    default:
      return "bg-slate-400";
  }
}
