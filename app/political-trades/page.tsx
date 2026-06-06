import type { Metadata } from "next";
import SectionPage from "../section-page";

export const metadata: Metadata = {
  title: "美国政客持仓线索追踪 | Serenity Analysis",
  description: "从 CapitolTrades 原始披露中挖掘高资金政客、持仓主题与政策相关交易线索。",
};

export default function PoliticalTradesPage() {
  return <SectionPage initialNav="政客交易" />;
}
