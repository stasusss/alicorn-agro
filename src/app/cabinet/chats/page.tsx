import { ChatInbox } from "@/components/staff/chat-inbox";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Чати",
  robots: { index: false, follow: false },
};

export default async function CabinetChatsPage() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "admin" && role !== "staff") redirect("/cabinet");

  return (
    <Suspense fallback={<p className="text-sm text-[#86868b]">Завантаження…</p>}>
      <ChatInbox role={role} />
    </Suspense>
  );
}
