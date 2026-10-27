import { redirect } from "next/navigation";

export default async function StaffChatPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;
  const id = params.id ? `?id=${encodeURIComponent(params.id)}` : "";
  redirect(`/cabinet/chats${id}`);
}
