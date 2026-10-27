import { getAdminOverview } from "@/lib/cabinet/admin";
import Link from "next/link";

function when(iso: string | null) {
  if (!iso) return "немає даних";
  return new Date(iso).toLocaleString("uk-UA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  });
}

const statusLabel = {
  ai: "AI",
  human: "Спеціаліст",
  closed: "Закрито",
} as const;

export async function AdminOverview() {
  const data = await getAdminOverview();
  const cards = [
    ["Клієнти", String(data.clients)],
    ["Датчики", String(data.sensors)],
    ["Шлюзи онлайн", String(data.gatewaysOnline)],
    ["Чати", String(data.chats)],
    ["Заявки з форми", String(data.leads)],
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="cab-title">Клієнти і звернення</h1>
          <p className="cab-subtitle">
            Зведення по господарствах, чатах сайту і заявках на консультацію.
          </p>
        </div>
        <Link href="/cabinet/chats" className="cab-btn">
          Відкрити чати
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="cab-panel px-4 py-4">
            <p className="text-[12px] font-medium tracking-wide text-[#86868b]">{label}</p>
            <p className="mt-2 font-display text-[2rem] font-semibold leading-none tracking-tight">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="cab-section-title">Господарства</h2>
        <div className="cab-panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[12px] uppercase tracking-wide text-[#86868b]">
              <tr>
                <th className="px-4 py-3 font-medium">Клієнт</th>
                <th className="px-4 py-3 font-medium">Датчики</th>
                <th className="px-4 py-3 font-medium">Шлюз</th>
              </tr>
            </thead>
            <tbody>
              {data.clientRows.map((client) => (
                <tr key={client.id} className="border-t border-black/[0.06]">
                  <td className="px-4 py-3 font-medium">{client.name}</td>
                  <td className="px-4 py-3">{client.sensors}</td>
                  <td className="px-4 py-3">{when(client.gatewaySeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="cab-section-title">Останні чати</h2>
          <ul className="space-y-2">
            {data.recentChats.length === 0 ? (
              <li className="cab-panel px-4 py-3 text-sm text-[#86868b]">Поки немає діалогів.</li>
            ) : (
              data.recentChats.map((chat) => (
                <li key={chat.id}>
                  <Link href={`/cabinet/chats?id=${chat.id}`} className="cab-panel block px-4 py-3">
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-medium">{chat.name || "Відвідувач"}</span>
                      <span className="text-[11px] uppercase tracking-wide text-[#86868b]">
                        {statusLabel[chat.status]}
                      </span>
                    </span>
                    <span className="mt-1 block text-[13px] text-[#86868b]">
                      {chat.phone || "без телефону"} · {when(chat.lastMessageAt)}
                    </span>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="cab-section-title">Заявки на консультацію</h2>
          <ul className="space-y-2">
            {data.recentLeads.length === 0 ? (
              <li className="cab-panel px-4 py-3 text-sm text-[#86868b]">Поки немає заявок.</li>
            ) : (
              data.recentLeads.map((lead) => (
                <li key={lead.id} className="cab-panel px-4 py-3 text-sm">
                  <p className="font-medium">
                    {lead.name} · {lead.phone}
                  </p>
                  <p className="mt-1 text-[#86868b]">
                    {lead.email} · {lead.time}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
