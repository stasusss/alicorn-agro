import { KnowledgeEditor } from "@/components/cabinet/knowledge-editor";
import { auth } from "@/lib/auth";
import { buildKnowledgeBase } from "@/lib/chat/knowledge";
import { readKnowledge } from "@/lib/chat/knowledge-store";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "База знань",
  robots: { index: false, follow: false },
};

export default async function KnowledgePage() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "admin" && role !== "staff") redirect("/cabinet");
  const document = await readKnowledge();

  return (
    <KnowledgeEditor
      initialBody={document.body}
      initialUpdatedAt={document.updatedAt}
      generatedBody={buildKnowledgeBase()}
    />
  );
}
