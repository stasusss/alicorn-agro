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

function ratio(part: number, total: number) {
  if (total === 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}

export async function AdminOverview() {
  const data = await getAdminOverview();
  const cards = [
    ["Клієнти", String(data.clients), "господарства"],
    ["Датчики", String(data.sensors), "усі клієнти"],
    ["Шлюзи онлайн", String(data.gatewaysOnline), "за 15 хв"],
  ];
  const pipeline = [
    ["Чати", String(data.chats), "усі діалоги сайту"],
    ["Конверсія", ratio(data.chatsWithPhone, data.chats), `${data.chatsWithPhone} з телефоном`],
    ["Чекають", String(data.chatsWaiting), "на спеціалісті"],
    ["Без виконавця", String(data.unassigned.chats), `${data.unassigned.withPhone} з телефоном`],
    ["Заявки з форми", String(data.leads), "консультація"],
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="cab-title">Клієнти і звернення</h1>
          <p className="cab-subtitle">
            Зведення по господарствах, чатах сайту і роботі команди.
          </p>
        </div>
        <Link href="/cabinet/chats" className="cab-btn">
          Відкрити чати
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="cab-panel px-4 py-4">
            <p className="text-[12px] font-medium tracking-wide text-[#86868b]">{label}</p>
            <p className="mt-2 font-display text-[2rem] font-semibold leading-none tracking-tight">
              {value}
            </p>
            <p className="mt-2 text-[12px] text-[#86868b]">{hint}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {pipeline.map(([label, value, hint]) => (
          <div key={label} className="cab-panel px-4 py-4">
            <p className="text-[12px] font-medium tracking-wide text-[#86868b]">{label}</p>
            <p className="mt-2 font-display text-[2rem] font-semibold leading-none tracking-tight">
              {value}
            </p>
            <p className="mt-2 text-[12px] text-[#86868b]">{hint}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="cab-section-title">Працівники</h2>
            <p className="mt-1 max-w-2xl text-[13px] text-[#86868b]">
              Конверсія — частка чатів із телефоном. У колонці «Відповіді» перше число —
              діалоги з відповіддю спеціаліста, друге — скільки повідомлень надіслано.
            </p>
          </div>
          <Link href="/cabinet/team" className="cab-btn-ghost">
            Команда
          </Link>
        </div>
        {data.staff.length === 0 && data.unassigned.chats === 0 ? (
          <p className="cab-panel px-4 py-3 text-sm text-[#86868b]">
            Працівників ще немає. Додайте їх у розділі «Команда».
          </p>
        ) : (
          <div className="cab-panel overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="text-[12px] uppercase tracking-wide text-[#86868b]">
                <tr>
                  <th className="px-4 py-3 font-medium">Працівник</th>
                  <th className="px-4 py-3 font-medium">Чати</th>
                  <th className="px-4 py-3 font-medium">Телефон</th>
                  <th className="px-4 py-3 font-medium">Конверсія</th>
                  <th className="px-4 py-3 font-medium">Відповіді</th>
                  <th className="px-4 py-3 font-medium">Чекають</th>
                  <th className="px-4 py-3 font-medium">Закриті</th>
                  <th className="px-4 py-3 font-medium">Активність</th>
                </tr>
              </thead>
              <tbody>
                {data.unassigned.chats > 0 && (
                  <tr className="border-t border-black/[0.06]">
                    <td className="px-4 py-3">
                      <p className="font-medium">Не призначено</p>
                      <p className="text-[12px] text-[#86868b]">ще без виконавця</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{data.unassigned.chats}</td>
                    <td className="px-4 py-3 tabular-nums">{data.unassigned.withPhone}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {ratio(data.unassigned.withPhone, data.unassigned.chats)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {data.unassigned.answered}
                      <span className="text-[#86868b]"> · {data.unassigned.replies}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{data.unassigned.waiting}</td>
                    <td className="px-4 py-3 tabular-nums">{data.unassigned.closed}</td>
                    <td className="px-4 py-3 text-[#86868b]">—</td>
                  </tr>
                )}
                {data.staff.map((member) => (
                  <tr key={member.id} className="border-t border-black/[0.06]">
                    <td className="px-4 py-3">
                      <p className="font-medium">{member.name}</p>
                      <p className="text-[12px] text-[#86868b]">{member.email}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{member.chats}</td>
                    <td className="px-4 py-3 tabular-nums">{member.withPhone}</td>
                    <td className="px-4 py-3 tabular-nums">{ratio(member.withPhone, member.chats)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {member.answered}
                      <span className="text-[#86868b]"> · {member.replies}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{member.waiting}</td>
                    <td className="px-4 py-3 tabular-nums">{member.closed}</td>
                    <td className="px-4 py-3 text-[#86868b]">{when(member.lastMessageAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
