import { CabinetNav } from "@/components/cabinet/nav";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="cabinet flex min-h-full flex-1 flex-col">
      <CabinetNav userEmail={session.user.email} admin={session.user.role === "admin"} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-28 sm:px-8 sm:py-14">
        {children}
      </main>
    </div>
  );
}
