import { requireToolUser } from "@/lib/authorization";
import { extraAccessible, getExtrasFlags } from "@/lib/v2/extras";
import { withV2Db } from "@/lib/v2/runtime";
import { notFound } from "next/navigation";
import { FlashcardWorkspace } from "@/components/flashcard-workspace";
export default async function FlashcardsPage() {
  await requireToolUser();
  if (!extraAccessible(withV2Db(getExtrasFlags), "flashcards")) notFound();
  return <FlashcardWorkspace />;
}
