import Dashboard from "@/components/Dashboard";
import { bloggers } from "@/data/bloggers";

export default function SectionPage({ initialNav }: { initialNav: string }) {
  return <Dashboard bloggers={bloggers} initialNav={initialNav} />;
}
