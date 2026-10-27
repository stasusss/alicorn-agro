import { TeamManager } from "@/components/cabinet/team-manager";
import { auth } from "@/lib/auth";
import { listStaff } from "@/lib/cabinet/team";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Команда",
  robots: { index: false, follow: false },
};

export default async function TeamPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/cabinet");
  const members = await listStaff();
  return <TeamManager members={members} />;
}
