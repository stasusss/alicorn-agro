import { isChatOperator } from "@/lib/chat/access";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isChatOperator(session.user.email, session.user.role)) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <h1 className="font-display text-2xl text-forest-dark">Немає доступу</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          Цей розділ лише для операторів чату.
        </p>
      </main>
    );
  }

  return children;
}
