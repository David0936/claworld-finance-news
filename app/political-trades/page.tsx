import type { Metadata } from "next";
import PoliticalTradesDashboard from "@/components/PoliticalTradesDashboard";

export const metadata: Metadata = {
  title: "政客交易解析 | Serenity Analysis",
  description: "CapitolTrades 英文原站入口与邀请码会员制 AI 政客交易解析。",
};

export default function PoliticalTradesPage() {
  return <PoliticalTradesDashboard />;
}
