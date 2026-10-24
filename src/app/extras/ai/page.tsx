import { requireToolUser } from "@/lib/authorization";
import { AiWorkspace } from "@/components/ai-workspace";
import "@/app/ai.css";
export default async function AiPage() {
  await requireToolUser();
  return <AiWorkspace />;
}
