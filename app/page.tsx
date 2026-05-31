import Dashboard from "@/components/Dashboard";
import { bloggers } from "@/data/bloggers";

export default function Page() {
  return <Dashboard bloggers={bloggers} />;
}
